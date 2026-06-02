// ─── ViewModel Shell — server subpath ────────────────────────────────────────
// Backend types and helpers for TypeScript/Node/Bun/Deno/Workers backends.
// Mirrors the C# ViewModelShell NuGet package — same wire format, same shapes.
//
// Web Fetch API–native: works directly with Hono, Bun.serve, Deno.serve,
// Cloudflare Workers. Express users can adapt createAction's (Request → Response)
// handler with a 3-line wrapper.

import type { ViewNode, ShellSideEffect } from "./index.js";

// Re-export the ViewNode hierarchy and wire types so a backend can import
// everything it needs from one place.
export * from "./index.js";

// ─── Action payload ──────────────────────────────────────────────────────────

export interface ActionPayload<TState> {
  name: string;
  context: Record<string, unknown> | null;
  state: TState;
  /** Populated only on multipart submissions (FormData). Empty for JSON bodies. */
  files: Record<string, File>;
}

/** Parse a multipart/form-data action body — the wire format the TypeScript shell uses. */
export function parseFormDataAction<TState>(formData: FormData): ActionPayload<TState> {
  const actionRaw = formData.get("_action");
  const stateRaw = formData.get("_state");
  if (typeof actionRaw !== "string" || typeof stateRaw !== "string") {
    throw new Error("Missing _action or _state form field");
  }
  const action = JSON.parse(actionRaw) as { name: string; context?: Record<string, unknown> };
  const state = JSON.parse(stateRaw) as TState;
  const files: Record<string, File> = {};
  for (const [key, value] of formData.entries()) {
    // Narrow via typeof, NOT `instanceof File`: @types/node@22.19+ declares
    // its own `File` interface alongside DOM's, and the TS narrowing for
    // `instanceof File` ambiguates between the two on
    // `FormDataEntryValue = string | File`. `typeof !== "string"` narrows
    // the union to File unambiguously and is identical at runtime.
    if (key !== "_action" && key !== "_state" && typeof value !== "string") {
      files[key] = value;
    }
  }
  return {
    name: action.name,
    context: action.context ?? null,
    state,
    files,
  };
}

/** Parse a flat JSON action body — { name, context, state }. For curl/agent callers. */
export function parseJsonAction<TState>(body: string | object): ActionPayload<TState> {
  const parsed = typeof body === "string"
    ? (JSON.parse(body) as { name: string; context?: Record<string, unknown>; state: TState })
    : (body as { name: string; context?: Record<string, unknown>; state: TState });
  return {
    name: parsed.name,
    context: parsed.context ?? null,
    state: parsed.state,
    files: {},
  };
}

// ─── ShellResponse ───────────────────────────────────────────────────────────

/** What an action handler returns. All fields are optional — see ShellResponse reference in AGENTS.md. */
export interface ShellResponseBody<TState> {
  vm?: ViewNode | null;
  state?: TState | null;
  redirect?: string;
  sideEffects?: ShellSideEffect[];
  nextPollIn?: number;
  /** 0.14.0 — install / clear the browser's "warn before unload" guard. Omit
   *  (or set false) to clear; set true while a long-running server action is
   *  in flight so an accidental tab-close doesn't lose work. */
  preventUnload?: boolean;
  /** 0.16.0 — lock the UI: the shell drops user-initiated dispatches client-
   *  side and the BrowserAdapter applies `.vms-busy` (cursor:wait + pointer-
   *  events:none on interactive descendants). Polls bypass so the server can
   *  clear the state. Naturally paired with `preventUnload` for long-running
   *  server actions. */
  busy?: boolean;
}

/** Build a redirect response (Vm and State omitted; shell navigates the browser). */
export function shellRedirect<TState = unknown>(url: string): ShellResponseBody<TState> {
  return { redirect: url };
}

/** Side-effect factories matching the C# ShellSideEffect static methods. */
export const shellSideEffect = {
  setLocalStorage: (key: string, value: string): ShellSideEffect =>
    ({ type: "set-local-storage", key, value }),
  setSessionStorage: (key: string, value: string): ShellSideEffect =>
    ({ type: "set-session-storage", key, value }),
  /** Server-decided authenticated download. The shell fetches `url` with
   *  getRequestHeaders() merged (Bearer / anti-forgery / etc.), parses
   *  Content-Disposition + Content-Type, and saves via Adapter.saveFile.
   *  `filename` is a fallback used only when Content-Disposition is absent.
   *  The conditional spread keeps `filename` ABSENT (not undefined) on the
   *  JSON wire, matching the .NET WhenWritingNull null-omission contract. */
  download: (url: string, filename?: string): ShellSideEffect =>
    ({ type: "download", url, ...(filename != null ? { filename } : {}) }),
};

// ─── Action handler factory ──────────────────────────────────────────────────

/**
 * Web Fetch API–native request handler factory. Auto-detects content-type
 * (application/json vs multipart/form-data), parses the body, calls your
 * handler, and returns the JSON response.
 *
 * Works directly with Hono, Bun.serve, Deno.serve, Cloudflare Workers, or
 * any Request → Response runtime. For Express, wrap with a small adapter
 * that constructs a Request from (req) and writes the Response back to res.
 *
 * @example
 *   app.post("/api/tasks/action", createAction<TasksState>(async (payload) => {
 *     const state = applyAction(payload);
 *     return { vm: buildVm(state), state };
 *   }));
 */
export function createAction<TState>(
  handler: (payload: ActionPayload<TState>) =>
    Promise<ShellResponseBody<TState>> | ShellResponseBody<TState>
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const contentType = request.headers.get("content-type") ?? "";
    let payload: ActionPayload<TState>;
    try {
      if (contentType.includes("application/json")) {
        payload = parseJsonAction<TState>(await request.text());
      } else {
        payload = parseFormDataAction<TState>(await request.formData());
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const result = await handler(payload);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  };
}
