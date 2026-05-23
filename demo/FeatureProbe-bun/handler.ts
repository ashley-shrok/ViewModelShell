// FeatureProbe — runtime-neutral request handler.
// Imported by server.ts (Bun) and server-node.ts (Node 22+) to prove the
// same TypeScript code runs unchanged on multiple Web Fetch runtimes.

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
  lastSubmit?: string | null;   // 0.10.0/#15: "{action}: {note}" from the multi-action form
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
  children.push(
    { type: "copy-button", text: "npx @ashley-shrok/viewmodel-shell", label: "Copy install command", copiedLabel: "Copied!", variant: "secondary" } as ViewNode,   // 0.9.0/#14
  );
  if (state.lastSubmit != null) {
    children.push({ type: "text", value: `Last submit: ${state.lastSubmit}`, style: "muted" });
  }
  // 0.10.0/#15: one form, shared "note" field, two buttons each dispatching a
  // DIFFERENT action carrying the field's current value.
  children.push({
    type: "form",
    children: [{ type: "field", name: "note", inputType: "text", label: "Note", placeholder: "Type a note…", required: false }],
    buttons: [
      { type: "button", label: "Save Draft", action: { name: "save-draft" }, variant: "secondary" },
      { type: "button", label: "Publish", action: { name: "publish" }, variant: "primary" },
    ],
  } as ViewNode);
  const probeSection: ViewNode = {
    type: "section",
    heading: "Probe",
    variant: "card",
    layout: "split",
    children,
  };
  return {
    type: "page",
    title: "Feature Probe",
    density: "compact",
    layout: "cards",
    children: [probeSection],
  };
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

    case "trigger-download":
      return {
        vm: buildVm(state),
        state,
        sideEffects: [
          shellSideEffect.download(
            str("url")      ?? "/api/probe/file/hello.txt",
            str("filename") ?? "hello.txt",
          ),
        ],
      };

    case "do-poll": {
      state = { ...state, pollCount: state.pollCount + 1 };
      const done = state.pollCount >= 3;
      return {
        vm: buildVm(state),
        state,
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

    case "show-copy-button":
      break;  // state unchanged; buildVm always includes the copy-button node

    // 0.10.0/#15: two buttons[] on ONE form sharing the "note" field.
    case "save-draft":
      state = { ...state, lastSubmit: `draft: ${str("note") ?? ""}` };
      break;
    case "publish":
      state = { ...state, lastSubmit: `published: ${str("note") ?? ""}` };
      break;

    case "reset":
      state = initialState();
      break;

    default:
      throw new Error(`Unknown action: ${payload.name}`);
  }

  return { vm: buildVm(state), state };
});

export async function fetchHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/probe" && request.method === "GET") {
    const state = initialState();
    return Response.json({ vm: buildVm(state), state });
  }
  if (url.pathname === "/api/probe/action" && request.method === "POST") {
    return actionHandler(request);
  }
  return new Response("Not Found", { status: 404 });
}
