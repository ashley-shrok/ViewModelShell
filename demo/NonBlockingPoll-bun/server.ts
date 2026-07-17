// NonBlockingPoll — poll + user-action coexistence.
//
// The second of three purpose-built human-verification demo apps for the
// v4.1 Non-Blocking Actions milestone (NBA-08). Proves NBA-05: folding
// `pollInterval` into the non-blocking dispatch lane means an always-on
// server poll never contends with a blocking user action — a click fired
// mid-poll-round-trip is honored immediately, and the poll keeps ticking on
// its own cadence afterward.
//
//   - The client (`src/main.ts`) sets `pollInterval: 1200` — every 1.2s it
//     auto-dispatches {name:"poll"} via the non-blocking lane.
//   - Every "poll" round trip here is artificially slowed to ~1.8s
//     (POLL_DELAY_MS), which comfortably EXCEEDS the 1.2s client cadence —
//     so a poll round trip is essentially always in flight, making
//     "click during a poll" trivial to trigger without precise timing.
//   - The plain "Click me" button is a normal BLOCKING action (no
//     `blocking: false` on its action — the default). It should still land
//     instantly regardless of whatever poll round trip is mid-flight.
//
// Single Bun.serve process serving both the Vite-built client and the
// /api/poll wire, following the Tasks-fullstack-bun pattern.

import {
  UnknownActionError,
  createAction,
  createAgentSkillHandler,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

// ─── Domain model ────────────────────────────────────────────────────────────

interface DemoState {
  pollTicks: number;
  userClicks: number;
}

function initialState(): DemoState {
  return { pollTicks: 0, userClicks: 0 };
}

// ─── View ────────────────────────────────────────────────────────────────────

function buildVm(state: DemoState): ViewNode {
  return {
    type: "page",
    title: "NBA Demo — Poll + User Coexistence",
    children: [
      {
        type: "text",
        value: "Poll + User-Action Coexistence",
        style: "heading",
      },
      {
        type: "text",
        value:
          `An automatic poll fires every ~1.2s and is artificially slowed to ` +
          `~${POLL_DELAY_MS}ms server-side — so a poll round trip is nearly always ` +
          `in flight. The "Click me" button below is a plain BLOCKING action; ` +
          `clicking it while a poll is mid-flight should still land instantly, and ` +
          `the poll should keep ticking afterward.`,
        style: "muted",
      },
      {
        type: "stat-bar",
        stats: [
          { label: "Poll ticks (auto, ~1.2s cadence)", value: String(state.pollTicks) },
          { label: "Button clicks (blocking, instant)", value: String(state.userClicks) },
        ],
      },
      {
        type: "button",
        label: "Click me — increments instantly",
        emphasis: "primary",
        action: { name: "increment-click" },
      },
      {
        type: "button",
        label: "Reset Demo",
        action: { name: "reset-demo" },
      },
    ],
  };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

// Artificial delay on every poll round trip — deliberately longer than the
// client's 1.2s pollInterval cadence, so a poll round trip is essentially
// always in flight and overlap with a user click needs no precise timing.
const POLL_DELAY_MS = 1800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const actionHandler = createAction<DemoState>(async (payload) => {
  let state = payload.state;

  if (payload.name === "poll") {
    await sleep(POLL_DELAY_MS);
    state = { ...state, pollTicks: state.pollTicks + 1 };
  } else if (payload.name === "increment-click") {
    // A short, realistic round trip — deliberately far shorter than the
    // poll delay, so it's obviously the fast/blocking path by comparison.
    await sleep(120);
    state = { ...state, userClicks: state.userClicks + 1 };
  } else if (payload.name === "reset-demo") {
    state = initialState();
  } else {
    throw new UnknownActionError(payload.name);
  }

  // Deliberately omit nextPollIn — the client's own ShellOptions.pollInterval
  // keeps driving the poll cadence (see <interfaces> in the plan).
  return { vm: buildVm(state), state };
});

// ─── HTTP server ─────────────────────────────────────────────────────────────

const distDir = new URL("./dist/", import.meta.url);

async function serveStatic(pathname: string): Promise<Response> {
  // "/" → index.html; strip leading slashes so the rest resolves under dist/.
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");

  // A static server must never escape its root.
  if (rel.split("/").some((seg) => seg === "..")) {
    return new Response("Forbidden", { status: 403 });
  }

  const file = Bun.file(new URL(rel, distDir));
  if (await file.exists()) {
    // Bun infers Content-Type from the file extension.
    return new Response(file);
  }

  // SPA-style fallback: an extension-less path (a client route) gets
  // index.html so the shell can still boot and load(). A genuinely missing
  // asset (has a `.`) is a real 404.
  if (!rel.includes(".")) {
    const index = Bun.file(new URL("index.html", distDir));
    if (await index.exists()) return new Response(index);
  }
  return new Response("Not Found", { status: 404 });
}

const skillHandler = createAgentSkillHandler({
  appPreamble:
    "This is the poll-coexistence non-blocking-actions demo. An automatic " +
    "\"poll\" action fires every ~1.2s client-side (ShellOptions.pollInterval) " +
    "and is artificially slowed ~1.8s server-side, so a poll round trip is " +
    "nearly always in flight. The \"increment-click\" action is a plain " +
    "blocking action that lands independently of any in-flight poll " +
    "(NBA-05: poll always rides the non-blocking lane).",
});

const port = Number(process.env.PORT ?? "3009");

Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // --- API ---
    if (url.pathname === "/api/poll" && request.method === "GET") {
      const state = initialState();
      return Response.json({ vm: buildVm(state), state });
    }
    if (url.pathname === "/api/poll/action" && request.method === "POST") {
      return actionHandler(request);
    }
    if (url.pathname === "/.well-known/vms-skill.md" && request.method === "GET") {
      return skillHandler(request);
    }

    // --- Everything else: the bundled shell client ---
    if (request.method === "GET") {
      return serveStatic(url.pathname);
    }
    return new Response("Method Not Allowed", { status: 405 });
  },
});

console.log(
  `NonBlockingPoll full-stack (client + API) → http://localhost:${port}  —  open it in a browser`,
);
