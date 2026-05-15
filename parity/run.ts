// Parity test harness. Spins up each backend listed in backends.json, runs each
// fixture against all of them, and diffs the normalized responses step-for-step.
// Any wire-format drift (property casing, missing fields, ordering, etc.) fails
// the run.

import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
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
  action?: { name: string; context?: Record<string, unknown> };
}

interface Fixture {
  name: string;
  endpoint: string;
  actionEndpoint: string;
  steps: FixtureStep[];
}

interface CapturedResponse {
  step: string;
  vm: unknown;
  state: unknown;
  redirect?: string;
  sideEffects?: unknown;
  nextPollIn?: number;
}

const manifestPath = resolve(__dirname, "backends.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;

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
    let url: string;
    let init: RequestInit;
    if (step.method === "GET") {
      url = `${cfg.baseUrl}${fixture.endpoint}`;
      init = { method: "GET" };
    } else {
      url = `${cfg.baseUrl}${fixture.actionEndpoint}`;
      const form = new FormData();
      form.append("_action", JSON.stringify({ name: step.action!.name, context: step.action!.context ?? {} }));
      form.append("_state", JSON.stringify(lastState));
      init = { method: "POST", body: form };
    }

    const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error(`${cfg.name} step '${step.id}' failed: ${res.status} ${res.statusText}`);
    }
    const body = await res.json() as CapturedResponse & { vm: unknown; state: unknown };
    captured.push({ step: step.id, ...body });
    lastState = body.state;
  }

  return captured;
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
      for (const other of others) {
        const otherResp = results.get(other.name)!;
        for (let i = 0; i < baselineResp.length; i++) {
          const a = normalize(baselineResp[i]);
          const b = normalize(otherResp[i]);
          const d = diff(a, b);
          if (d) {
            console.error(`\n  PARITY FAILURE at step '${baselineResp[i].step}' (${baseline.name} vs ${other.name}):`);
            console.error(`    ${d}`);
            exitCode = 1;
          }
        }
      }
      if (exitCode === 0) {
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
