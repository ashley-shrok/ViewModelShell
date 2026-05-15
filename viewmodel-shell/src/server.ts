// ─── ViewModel Shell — server subpath ────────────────────────────────────────
// Backend types and helpers for TypeScript/Node/Bun/Deno/Workers backends.
// Mirrors the C# ViewModelShell NuGet package — same wire format, same shapes.
//
// Web Fetch API–native: works directly with Hono, Bun.serve, Deno.serve,
// Cloudflare Workers. Express users can adapt createAction's (Request → Response)
// handler with a 3-line wrapper.

import type { ViewNode, ShellSideEffect } from "./index";

// Re-export the ViewNode hierarchy and wire types so a backend can import
// everything it needs from one place.
export * from "./index";

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
    if (key !== "_action" && key !== "_state" && value instanceof File) {
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
