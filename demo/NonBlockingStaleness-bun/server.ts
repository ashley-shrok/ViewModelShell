// NonBlockingStaleness — out-of-order / staleness discard.
//
// The third of three purpose-built human-verification demo apps for the v4.1
// Non-Blocking Actions milestone (NBA-08). Proves NBA-03: a client-side
// sequence counter discards a stale/out-of-order response rather than
// letting it clobber a newer render.
//
//   - "① Start slow background check (3s)" fires a `blocking:false` action
//     that sleeps BG_CHECK_DELAY_MS (~3s) before applying its result.
//   - "② Set value instantly (fast)" fires a plain BLOCKING action (no
//     `blocking` field — default true) that sleeps FAST_DELAY_MS (~150ms)
//     before applying its result.
//   - Firing the slow trigger, then immediately the fast trigger, ends with
//     the fast value displayed — a blocking response always applies
//     unconditionally the instant it arrives, advancing the client's
//     appliedSeq. When the slow response finally lands (~3s later), its seq
//     is now stale (seq < appliedSeq) and the client discards it rather than
//     reverting the display. See .planning/design/non-blocking-actions.md,
//     "Epoch — client-side, off the wire".
//
// Single Bun.serve process serving both the Vite-built client and the
// /api/staleness wire, following the Tasks-fullstack-bun pattern.

import {
  UnknownActionError,
  createAction,
  createAgentSkillHandler,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

// ─── Domain model ────────────────────────────────────────────────────────────

interface DemoState {
  value: string;
  lastAppliedBy: "initial" | "background" | "user";
}

function initialState(): DemoState {
  return { value: "(no update yet)", lastAppliedBy: "initial" };
}

// ─── View ────────────────────────────────────────────────────────────────────

function buildVm(state: DemoState): ViewNode {
  return {
    type: "page",
    title: "NBA Demo — Out-of-Order Staleness",
    children: [
      {
        type: "text",
        value: "Out-of-Order / Staleness Discard",
        style: "heading",
      },
      {
        type: "text",
        value:
          `Click "① Start slow background check", then immediately click ` +
          `"② Set value instantly" — the displayed value should end up as ` +
          `the fast/user result. Wait a few seconds afterward (long enough ` +
          `for the slow background response to actually arrive) and the ` +
          `display should NOT revert: the late, now-stale response is ` +
          `discarded rather than clobbering the newer render.`,
        style: "muted",
      },
      {
        type: "text",
        value: state.value,
        style: "heading",
      },
      {
        type: "text",
        value: `last applied by: ${state.lastAppliedBy}`,
        style: "muted",
      },
      {
        type: "button",
        label: "① Start slow background check (3s)",
        action: { name: "bg-check", blocking: false },
      },
      {
        type: "button",
        label: "② Set value instantly (fast)",
        emphasis: "primary",
        action: { name: "set-fast" },
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

// The slow, non-blocking background check — deliberately far slower than the
// fast blocking update below, so the race (slow-fires-first, fast-lands-
// first, slow-arrives-late-and-is-discarded) needs no timing precision from
// the human: a few seconds' gap between clicks always reproduces it.
const BG_CHECK_DELAY_MS = 3000;
// The fast, default-blocking user update — resolves well before the slow
// background check, so it always applies first and advances appliedSeq.
const FAST_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const actionHandler = createAction<DemoState>(async (payload) => {
  let state = payload.state;

  if (payload.name === "bg-check") {
    await sleep(BG_CHECK_DELAY_MS);
    state = {
      ...state,
      value: "background result (slow, 3s delay)",
      lastAppliedBy: "background",
    };
  } else if (payload.name === "set-fast") {
    await sleep(FAST_DELAY_MS);
    state = {
      ...state,
      value: "user click result (fast, ~150ms)",
      lastAppliedBy: "user",
    };
  } else if (payload.name === "reset-demo") {
    state = initialState();
  } else {
    throw new UnknownActionError(payload.name);
  }

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
    "This is the out-of-order-staleness non-blocking-actions demo. " +
    "\"bg-check\" is a slow (~3s) `blocking:false` action; \"set-fast\" is a " +
    "fast (~150ms) plain blocking action. Firing bg-check then immediately " +
    "set-fast ends with the fast value displayed and permanently applied — " +
    "the late-arriving slow bg-check response is discarded because a " +
    "blocking response always applies unconditionally and a non-blocking " +
    "response is discarded once a strictly newer response has already " +
    "applied (NBA-03).",
});

const port = Number(process.env.PORT ?? "3010");

Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // --- API ---
    if (url.pathname === "/api/staleness" && request.method === "GET") {
      const state = initialState();
      return Response.json({ vm: buildVm(state), state });
    }
    if (url.pathname === "/api/staleness/action" && request.method === "POST") {
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
  `NonBlockingStaleness full-stack (client + API) → http://localhost:${port}  —  open it in a browser`,
);
