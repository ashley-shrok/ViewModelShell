// FeatureProbe demo — TypeScript backend mirror of demo/FeatureProbe/AspNetCore/.
// Synthetic test fixture that exercises every framework wire surface NOT
// otherwise covered by the demo apps: redirect, side effects, polling,
// file upload. Used by the parity harness to verify byte-identical
// behavior across backends for these features.

import {
  createAction,
  shellRedirect,
  shellSideEffect,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

interface FeatureProbeState {
  pollCount: number;
  lastUploadName: string | null;
  lastUploadSize: number;
}

function initialState(): FeatureProbeState {
  return { pollCount: 0, lastUploadName: null, lastUploadSize: 0 };
}

function buildVm(state: FeatureProbeState): ViewNode {
  const children: ViewNode[] = [
    { type: "text", value: `Poll count: ${state.pollCount}`, style: "muted" },
  ];
  if (state.lastUploadName !== null) {
    children.push({
      type: "text",
      value: `Last upload: ${state.lastUploadName} (${state.lastUploadSize} bytes)`,
      style: "muted",
    });
  }
  return { type: "page", title: "Feature Probe", children };
}

const actionHandler = createAction<FeatureProbeState>(async (payload) => {
  const ctx = payload.context ?? {};
  const str = (k: string): string | null => (typeof ctx[k] === "string" ? (ctx[k] as string) : null);

  let state = payload.state;

  switch (payload.name) {
    case "trigger-redirect":
      return shellRedirect<FeatureProbeState>(str("to") ?? "/default-redirect");

    case "set-storage":
      return {
        vm: buildVm(state),
        state,
        sideEffects: [
          shellSideEffect.setLocalStorage("probe-local",   str("local-value")   ?? "default-local"),
          shellSideEffect.setSessionStorage("probe-session", str("session-value") ?? "default-session"),
        ],
      };

    case "do-poll": {
      state = { ...state, pollCount: state.pollCount + 1 };
      const done = state.pollCount >= 3;
      return {
        vm: buildVm(state),
        state,
        // Omit nextPollIn when done so polling stops (matches .NET behavior with
        // WhenWritingNull stripping null property)
        ...(done ? {} : { nextPollIn: 100 }),
      };
    }

    case "upload": {
      const file = payload.files["attachment"];
      if (file) {
        state = { ...state, lastUploadName: file.name, lastUploadSize: file.size };
      }
      break;
    }

    case "reset":
      state = initialState();
      break;

    default:
      throw new Error(`Unknown action: ${payload.name}`);
  }

  return { vm: buildVm(state), state };
});

const port = Number(process.env.PORT ?? "3006");

Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/probe" && request.method === "GET") {
      const state = initialState();
      return Response.json({ vm: buildVm(state), state });
    }
    if (url.pathname === "/api/probe/action" && request.method === "POST") {
      return actionHandler(request);
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`FeatureProbe Bun backend listening on http://localhost:${port}`);
