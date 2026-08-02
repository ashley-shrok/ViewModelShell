// VersionSkewVerification — Phase 29 v9.0.0 hard-lock verification tailnet
// sign-off page (Plan 29-09). page-marker: version-skew-verification
//
// A real-bundle, real-CSS, real-HTTP human-verification harness for the
// v9.0.0 shipped hard-lock behavior. Distinct from every prior VMS
// verification demo (StateAxis, Composites, RichText) because THIS one is
// TIME-BASED: the server's currentBuild is mutable and can be flipped
// mid-session via an admin route. That is the only way to exercise all
// three CONTEXT-mandated scenarios in a real browser:
//
//   Scenario A: initial-load stale bundle → shell rejected before render
//   Scenario B: mid-session server roll-forward → next dispatch fires modal
//   Scenario C: opt-out consumer with custom onError affordance
//
// The shipped fetch-shim pattern (StateAxis / Composites / RichText demos)
// CANNOT simulate scenarios B/C authentically — those require a real
// server-side state change between two client requests. Per Phase 21's
// banked lesson (fetch-shim is for static/synthetic scenarios; real HTTP
// for time-based scenarios), this demo uses real HTTP end-to-end.
//
// ── CRITICAL: per-request createVersionGuard construction ────────────────
//
// The shipped createAction({ currentBuild }) at viewmodel-shell/src/server.ts:1385
// captures currentBuild at FACTORY CREATION TIME via closure (line 1390) —
// both the guard check (line 1395) and the serverBuild stamp (line 1476)
// read the captured value, not a live variable. Same closure-capture in
// createVersionGuard at line 1334.
//
// For THIS demo's mutable CURRENT_BUILD, a naïve top-of-file construction
// would silently defeat Scenario B (the flip would be invisible; the guard
// would keep enforcing against the pre-flip build). PATTERN 1 (per-request
// factory construction) is adopted here so both the guard AND the
// serverBuild stamp reflect CURRENT_BUILD at request time.
//
// The admin route (`/_admin/set-build`) is demo-only; NOT a shipped VMS
// feature; a grep of viewmodel-shell/src/ and viewmodel-shell-dotnet/ for
// `/_admin/` returns 0 hits per T-29-29 in the threat register.

import {
  createAction,
  createVersionGuard,
  UnknownActionError,
  type ActionPayload,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

// ─── Mutable server-side build state ────────────────────────────────────────
// Flipped by the admin route. Read at request time by BOTH the per-request
// createVersionGuard and the per-request createAction (each factory call
// closes over the current value).
let CURRENT_BUILD = "build-A";

// ─── Demo state + VM ────────────────────────────────────────────────────────

interface DemoState {
  count: number;
  note: string;
}

function initialState(): DemoState {
  return { count: 0, note: "" };
}

function buildVm(state: DemoState): ViewNode {
  return {
    type: "page",
    children: [
      {
        type: "text",
        value: `Count: ${state.count}`,
        style: "heading",
      },
      {
        type: "field",
        name: "note",
        inputType: "text",
        bind: "note",
        label: "Your note (typing here will be lost when the modal fires)",
        placeholder: "Type something…",
      },
      {
        type: "text",
        value: state.note
          ? `Current note draft: "${state.note}"`
          : "(no note yet)",
        style: "muted",
      },
      {
        type: "button",
        label: "Increment",
        action: { name: "increment" },
      },
    ],
  };
}

// ─── Action handler ─────────────────────────────────────────────────────────
//
// createAction is constructed PER REQUEST so `currentBuild: CURRENT_BUILD`
// captures the mutable value at the moment the request arrives, not at
// server startup. This makes the admin-route flip immediately observable
// on the very next dispatch.

function actionHandler(): (req: Request) => Promise<Response> {
  return createAction<DemoState>(async (payload: ActionPayload<DemoState>) => {
    let state = payload.state;
    switch (payload.name) {
      case "increment":
        state = { ...state, count: state.count + 1 };
        break;
      case "set-note":
        // NOTE: this demo relies on the bind path in the field to round-trip
        // the note; there is no explicit set-note action fired from the VM.
        state = {
          ...state,
          note: (payload.state as { note?: string }).note ?? "",
        };
        break;
      default:
        throw new UnknownActionError(payload.name);
    }
    return { vm: buildVm(state), state };
  }, { currentBuild: CURRENT_BUILD });
}

// GET handler — the initial VM load. Guard-wrapped so a stale clientBuildId
// header rejects the load before any VM is emitted (Scenario A). Manual
// serverBuild stamp so the detection path (checkVersionSkew) can also fire
// on any never-reloaded tab.
async function getHandler(_request: Request): Promise<Response> {
  const state = initialState();
  const vm = buildVm(state);
  return Response.json({
    ok: true,
    vm,
    state,
    serverBuild: CURRENT_BUILD,
  });
}

// ─── Static file serving (Vite build output + shipped default.css) ─────────

const distDir = new URL("./dist/", import.meta.url);
const stylesDir = new URL("../../viewmodel-shell/styles/", import.meta.url);

async function serveShippedCss(pathname: string): Promise<Response | null> {
  // /vms/default.css → styles/default.css
  const m = pathname.match(/^\/vms\/(default\.css)$/);
  if (!m) return null;
  const file = Bun.file(new URL(m[1], stylesDir));
  if (await file.exists()) {
    return new Response(file, {
      headers: { "Content-Type": "text/css; charset=utf-8" },
    });
  }
  return new Response("Not Found", { status: 404 });
}

async function serveStatic(pathname: string): Promise<Response> {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (rel.split("/").some((seg) => seg === "..")) {
    return new Response("Forbidden", { status: 403 });
  }
  const file = Bun.file(new URL(rel, distDir));
  if (await file.exists()) return new Response(file);
  // SPA-style fallback for extension-less routes.
  if (!rel.includes(".")) {
    const index = Bun.file(new URL("index.html", distDir));
    if (await index.exists()) return new Response(index);
  }
  return new Response("Not Found", { status: 404 });
}

// ─── HTTP server ────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? "3023");

// Write our PID for cleanup + schedule a 60-min auto-kill per the identity
// file's "how to show the user a visual change" recipe (and per Plan 29-12
// cleanup responsibility).
await Bun.write(
  new URL("./server.pid", import.meta.url),
  String(process.pid),
);
setTimeout(() => {
  console.log(
    "VersionSkewVerification: 60-min auto-kill fired; exiting.",
  );
  process.exit(0);
}, 3600000);

Bun.serve({
  // hostname 0.0.0.0 so the page is reachable at 100.113.23.63:PORT on the
  // tailnet (host machine's Tailscale IP) AND at 127.0.0.1 for local smoke.
  hostname: "0.0.0.0",
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── Admin routes — demo-only, NOT a shipped VMS feature ──────────────
    if (path === "/_admin/set-build" && request.method === "POST") {
      const body = (await request.json()) as { build?: string };
      if (typeof body.build !== "string" || body.build.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: "missing build" }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      CURRENT_BUILD = body.build;
      console.log(`[admin] CURRENT_BUILD → ${CURRENT_BUILD}`);
      return Response.json({ ok: true, build: CURRENT_BUILD });
    }
    if (path === "/_admin/current-build" && request.method === "GET") {
      return Response.json({ build: CURRENT_BUILD });
    }

    // ── VMS routes — GUARD + HANDLER constructed per-request so both the
    // fail-closed check AND the serverBuild stamp read CURRENT_BUILD at
    // request time (PATTERN 1 — see comment at top of file for why). ─────
    if (path === "/api/shell" && request.method === "GET") {
      const guard = createVersionGuard({ currentBuild: CURRENT_BUILD });
      return guard(getHandler)(request);
    }
    if (path === "/api/shell/action" && request.method === "POST") {
      const guard = createVersionGuard({ currentBuild: CURRENT_BUILD });
      const handler = actionHandler();
      return guard(handler)(request);
    }

    // ── Shipped CSS (default.css served verbatim from viewmodel-shell) ───
    if (request.method === "GET") {
      const css = await serveShippedCss(path);
      if (css) return css;
    }

    // ── Vite-built client (dist/*) ───────────────────────────────────────
    if (request.method === "GET") {
      return serveStatic(path);
    }
    return new Response("Method Not Allowed", { status: 405 });
  },
});

// Startup banner — includes the tailnet URL so the console output is a
// one-line handoff for the operator to relay to Ashley.
console.log(
  `VersionSkewVerification (Phase 29 v9.0.0 hard-lock sign-off) → ` +
    `http://100.113.23.63:${port}/  (PID ${process.pid}, auto-kill in 60 min)`,
);

