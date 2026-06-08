// Parity test harness. Spins up each backend listed in backends.json, runs each
// fixture against all of them, and diffs the normalized responses step-for-step.
// Any wire-format drift (property casing, missing fields, ordering, etc.) fails
// the run.

import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalize, diff } from "./normalize";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface BackendConfig {
  name: string;
  cwd: string;
  start: string;
  args: string[];
  /** Optional command run serially before parallel startup. Used to pre-build .NET demos so they
   *  don't fight over a shared MSBuild lock when started simultaneously. */
  prebuild?: { cmd: string; args: string[] };
  /** Files to delete (relative to cwd) before starting the backend. Used to reset stateful resources
   *  like SQLite DBs between parity runs so the fixture sees a clean slate. */
  cleanupFiles?: string[];
  env?: Record<string, string>;
  baseUrl: string;
  ready: string;
  fixtures: string[];
}

interface Manifest {
  backends: BackendConfig[];
}

interface FixtureStep {
  id: string;
  method: "GET" | "POST";
  /** Optional override for this step. When set, used in place of the fixture's default endpoint/actionEndpoint.
   *  Lets a single fixture mix calls to multiple controllers (e.g. HelpDesk: requester creates a ticket, agent acts on it). */
  endpoint?: string;
  actionEndpoint?: string;
  /** When true, this step starts a fresh state thread (sends null as _state instead of the previous response's state). */
  freshState?: boolean;
  /** Phase 6 wire shape (0.17.0 / WIRE-07): the action envelope on the wire is `{name}` only — no `context`.
   *  Per-row / per-tab identity is encoded in the action name itself (e.g. `delete-row-42`, `filter-active`). */
  action?: { name: string };
  /** Phase 6 — fixture pre-dispatch state mutations (narrow scope).
   *
   *  The wire shape now relies on the renderer writing input values into state at bind paths BEFORE the
   *  user-action dispatch fires. The parity runner never renders, so for fixture steps that simulate
   *  "user typed something, then clicked Save" we need to inject the typed values into state ourselves.
   *
   *  Used in roughly 10-20% of fixture steps (form submits). Per-row actions, tab switches, sort/filter
   *  intents, and pagination clicks all use the server-derives-from-action-name pattern and need no
   *  state injection.
   *
   *  Each mutation is `{ path, value }` where `path` is a dotted bind path (same syntax as `BindNode.bind`).
   *  Numeric segments create/index arrays; string segments create/index objects. Mutations apply in order
   *  to the PRIOR step's response state, then the mutated state is sent as `_state` for this step. */
  stateMutations?: Array<{ path: string; value: unknown }>;
  /** File attachments to include in the multipart form (e.g. for FieldNode inputType="file").
   *  Keyed by form field name; value is { name, content }. */
  attach?: Record<string, { name: string; content: string }>;
  /** Phase 07 — for envelope-case steps that expect non-2xx. When set, the runner asserts
   *  res.status === expectStatus instead of throwing on !res.ok. */
  expectStatus?: number;
  /** Phase 07 — for parse-error steps. Instructs the runner to construct a deliberately
   *  malformed multipart body. "empty-action" sends _action with an empty-string value;
   *  "non-json" sends _action with a syntactically-broken JSON string; "missing-action-field"
   *  omits the _action form field entirely. When set, the step's `action` field is ignored. */
  malformedBody?: "empty-action" | "non-json" | "missing-action-field";
  /** Phase 07 — dotted paths into the captured response that the cross-backend diff should
   *  IGNORE for this step. Used when backends legitimately differ on a field (e.g. parse-error
   *  messages from System.Text.Json vs JSON.parse). Walked AFTER normalize, BEFORE diff.
   *  Example: ["errors.0.message"] skips the message on entry 0 of the errors array.
   *  Use SPARINGLY — its purpose is to accommodate library-flavored divergence (e.g. parse-error
   *  messages), NOT to paper over real wire-shape drift. */
  compareIgnoreFields?: string[];
}

interface Fixture {
  name: string;
  endpoint: string;
  actionEndpoint: string;
  steps: FixtureStep[];
}

interface CapturedResponse {
  step: string;
  status?: number;
  ok?: boolean;
  vm: unknown;
  state: unknown;
  redirect?: string;
  sideEffects?: unknown;
  nextPollIn?: number;
  errors?: unknown;
}

const manifestPath = resolve(__dirname, "backends.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;

/** Mirror of the framework's `writePath` (viewmodel-shell/src/index.ts) — applies a single dotted-path
 *  write to `obj`, creating intermediate arrays (numeric next segment) or objects on demand. Used to
 *  apply each fixture step's `stateMutations` to the prior step's response state before sending the
 *  request, so the runner can simulate the renderer's bind-path writes that happen before dispatch. */
function isArrayIndexSegment(seg: string): boolean {
  return /^[0-9]+$/.test(seg);
}
function isUnsafeSegment(seg: string): boolean {
  return seg === "__proto__" || seg === "constructor" || seg === "prototype";
}
function writePath(obj: unknown, path: string, value: unknown): unknown {
  if (path == null) return obj;
  if (path === "") return value;
  const segs = path.split(".");
  for (const seg of segs) {
    if (isUnsafeSegment(seg)) return obj;
  }
  let root: unknown = obj;
  if (root == null || typeof root !== "object") {
    root = isArrayIndexSegment(segs[0]!) ? [] : {};
  }
  let cur: unknown = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!;
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      let nxt = cur[idx];
      if (nxt == null || typeof nxt !== "object") {
        nxt = {};
        cur[idx] = nxt;
      }
      cur = nxt;
    } else {
      const o = cur as Record<string, unknown>;
      let nxt = o[seg];
      if (nxt == null || typeof nxt !== "object") {
        nxt = {};
        o[seg] = nxt;
      }
      cur = nxt;
    }
  }
  const last = segs[segs.length - 1]!;
  if (Array.isArray(cur)) {
    cur[Number(last)] = value;
  } else {
    (cur as Record<string, unknown>)[last] = value;
  }
  return root;
}

async function waitForReady(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function runOnce(cfg: BackendConfig): Promise<void> {
  if (!cfg.prebuild) return;
  const cwd = resolve(__dirname, cfg.cwd);
  console.log(`  [${cfg.name}] ${cfg.prebuild.cmd} ${cfg.prebuild.args.join(" ")}`);
  await new Promise<void>((res, rej) => {
    const child = spawn(cfg.prebuild!.cmd, cfg.prebuild!.args, {
      cwd,
      env: { ...process.env, ...(cfg.env ?? {}) },
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("exit", code => code === 0 ? res() : rej(new Error(`prebuild for ${cfg.name} exited ${code}`)));
    child.on("error", rej);
  });
}

function startBackend(cfg: BackendConfig): ChildProcess {
  const cwd = resolve(__dirname, cfg.cwd);
  const child = spawn(cfg.start, cfg.args, {
    cwd,
    env: { ...process.env, ...(cfg.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
  // Surface backend output prefixed with name for debugging
  child.stdout?.on("data", d => process.stdout.write(`[${cfg.name}] ${d}`));
  child.stderr?.on("data", d => process.stderr.write(`[${cfg.name}] ${d}`));
  return child;
}

async function runFixtureAgainst(cfg: BackendConfig, fixture: Fixture): Promise<CapturedResponse[]> {
  const captured: CapturedResponse[] = [];
  let lastState: unknown = null;

  for (const step of fixture.steps) {
    if (step.freshState) lastState = null;
    // Phase 6 — apply fixture pre-dispatch state mutations. The runner simulates the renderer's
    // bind-path writes (which happen between user input and the dispatch click) by writing each
    // mutation's value into the prior step's response state. Used only for form-submit steps where
    // the user "typed" something before the click; per-row / per-tab actions need no mutation
    // because the server derives identity from the action name.
    if (step.stateMutations && step.method === "POST") {
      for (const mut of step.stateMutations) {
        lastState = writePath(lastState, mut.path, mut.value);
      }
    }
    let url: string;
    let init: RequestInit;
    if (step.method === "GET") {
      url = `${cfg.baseUrl}${step.endpoint ?? fixture.endpoint}`;
      init = { method: "GET" };
    } else {
      url = `${cfg.baseUrl}${step.actionEndpoint ?? fixture.actionEndpoint}`;
      const form = new FormData();
      // Phase 7 — parse-error fixture support. When malformedBody is set, deliberately
      // construct a broken _action payload to exercise the framework's parse-error envelope.
      // Skip the normal `{name}` JSON construction entirely; the step's `action` field is
      // permitted to be absent in this branch.
      if (step.malformedBody === "empty-action") {
        form.append("_action", "");
      } else if (step.malformedBody === "non-json") {
        form.append("_action", "not json{");
      } else if (step.malformedBody === "missing-action-field") {
        // Skip appending _action entirely.
      } else {
        // Phase 6 wire shape (0.17.0 / WIRE-07): the _action JSON carries `{name}` only.
        // Per-row / per-tab identity is in the action name; typed form values live in state.
        form.append("_action", JSON.stringify({ name: step.action!.name }));
      }
      form.append("_state", JSON.stringify(lastState));
      if (step.attach) {
        for (const [fieldName, file] of Object.entries(step.attach)) {
          form.append(fieldName, new Blob([file.content], { type: "application/octet-stream" }), file.name);
        }
      }
      init = { method: "POST", body: form };
    }

    const res = await fetch(url, init);
    if (step.expectStatus != null) {
      if (res.status !== step.expectStatus) {
        throw new Error(`${cfg.name} step '${step.id}' expected status ${step.expectStatus}, got ${res.status} ${res.statusText}`);
      }
    } else {
      if (!res.ok) {
        throw new Error(`${cfg.name} step '${step.id}' failed: ${res.status} ${res.statusText}`);
      }
    }
    let body: any;
    try {
      body = await res.json();
    } catch (parseErr) {
      throw new Error(`${cfg.name} step '${step.id}' body was not JSON: ${(parseErr as Error).message}`);
    }
    // D-20 sweep — assert ok:true on success-path steps. expectStatus-bearing steps
    // assert ok:false (the whole point of those steps). Anything else is a fixture bug.
    if (step.expectStatus == null && body.ok !== true) {
      throw new Error(`${cfg.name} step '${step.id}' expected ok:true on success path, got ok:${body.ok}`);
    }
    if (step.expectStatus != null && body.ok !== false) {
      throw new Error(`${cfg.name} step '${step.id}' expected ok:false on envelope path, got ok:${body.ok}`);
    }
    captured.push({ step: step.id, status: res.status, ...body });
    lastState = body.state ?? lastState;  // envelope responses have no `state` — keep prior
  }

  return captured;
}

/** Phase 07 — walks a deep-clone of a captured response and deletes the value at the given
 *  dotted path. Used to implement per-step compareIgnoreFields before normalize/diff so that
 *  fields with legitimate cross-backend divergence (e.g. parse-error messages from
 *  System.Text.Json vs JSON.parse) don't fail the parity check. No-ops on missing segments. */
function clearPath(obj: unknown, path: string): void {
  if (obj == null || path === "") return;
  const segs = path.split(".");
  let cur: any = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!;
    const next = Array.isArray(cur) ? cur[Number(seg)] : cur[seg];
    if (next == null || typeof next !== "object") return;
    cur = next;
  }
  const last = segs[segs.length - 1]!;
  if (Array.isArray(cur)) delete cur[Number(last)];
  else delete cur[last];
}

function loadFixture(name: string): Fixture {
  const path = resolve(__dirname, "fixtures", `${name}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as Fixture;
}

async function main() {
  console.log(`Parity harness — ${manifest.backends.length} backends`);

  const processes: ChildProcess[] = [];
  let exitCode = 0;

  try {
    // Run prebuild commands serially so parallel builds don't fight for shared
    // MSBuild/NuGet/npm locks (e.g. two .NET demos referencing the same library).
    const withPrebuild = manifest.backends.filter(b => b.prebuild);
    if (withPrebuild.length > 0) {
      console.log("\nPre-building...");
      for (const cfg of withPrebuild) {
        await runOnce(cfg);
      }
    }

    // Delete stateful artifacts (e.g. SQLite DB files) so each backend starts fresh.
    for (const cfg of manifest.backends) {
      for (const file of cfg.cleanupFiles ?? []) {
        const full = resolve(__dirname, cfg.cwd, file);
        if (existsSync(full)) {
          rmSync(full, { force: true });
          console.log(`  cleaned ${cfg.name}: ${file}`);
        }
      }
    }

    // Start every backend in parallel and wait for all of them to be ready.
    console.log("\nStarting backends...");
    for (const cfg of manifest.backends) {
      processes.push(startBackend(cfg));
    }
    await Promise.all(manifest.backends.map(cfg =>
      waitForReady(`${cfg.baseUrl}${cfg.ready}`)
    ));
    console.log("All backends ready.\n");

    // Run each fixture against every backend that claims to implement it,
    // collect responses, diff across backends.
    const allFixtureNames = new Set(manifest.backends.flatMap(b => b.fixtures));

    for (const fixtureName of allFixtureNames) {
      const fixture = loadFixture(fixtureName);
      const eligible = manifest.backends.filter(b => b.fixtures.includes(fixtureName));
      console.log(`Fixture '${fixtureName}' across ${eligible.length} backends:`);

      const results = new Map<string, CapturedResponse[]>();
      for (const cfg of eligible) {
        const captured = await runFixtureAgainst(cfg, fixture);
        results.set(cfg.name, captured);
        console.log(`  ${cfg.name}: ${captured.length} steps captured`);
      }

      // Diff every backend against the first one.
      const [baseline, ...others] = eligible;
      const baselineResp = results.get(baseline.name)!;
      let fixtureOk = true;
      for (const other of others) {
        const otherResp = results.get(other.name)!;
        for (let i = 0; i < baselineResp.length; i++) {
          // Phase 07 — apply compareIgnoreFields before normalize/diff. Walk a deep clone of
          // each captured response and delete the named dotted paths for this step. This
          // accommodates library-flavored divergence (e.g. parse-error messages from
          // System.Text.Json vs JSON.parse) without touching shipped backend code (D-18).
          const step = fixture.steps[i];
          let baseClone: unknown = JSON.parse(JSON.stringify(baselineResp[i]));
          let otherClone: unknown = JSON.parse(JSON.stringify(otherResp[i]));
          if (step?.compareIgnoreFields) {
            for (const field of step.compareIgnoreFields) {
              clearPath(baseClone, field);
              clearPath(otherClone, field);
            }
          }
          const a = normalize(baseClone);
          const b = normalize(otherClone);
          const d = diff(a, b);
          if (d) {
            console.error(`\n  PARITY FAILURE at step '${baselineResp[i].step}' (${baseline.name} vs ${other.name}):`);
            console.error(`    ${d}`);
            exitCode = 1;
            fixtureOk = false;
          }
        }
      }
      if (fixtureOk) {
        console.log(`  ✓ all backends agree`);
      }
    }
  } finally {
    console.log("\nShutting down backends...");
    for (const p of processes) {
      try { p.kill(); } catch {}
    }
  }

  if (exitCode === 0) {
    console.log("\n✓ Parity tests passed");
  } else {
    console.error("\n✗ Parity tests failed");
  }
  process.exit(exitCode);
}

main().catch(err => {
  console.error("Harness error:", err);
  process.exit(1);
});
