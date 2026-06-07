// ─── ViewModel Shell — server subpath ────────────────────────────────────────
// Backend types and helpers for TypeScript/Node/Bun/Deno/Workers backends.
// Mirrors the C# ViewModelShell NuGet package — same wire format, same shapes.
//
// Web Fetch API–native: works directly with Hono, Bun.serve, Deno.serve,
// Cloudflare Workers. Express users can adapt createAction's (Request → Response)
// handler with a 3-line wrapper.

import type {
  ViewNode,
  ShellSideEffect,
  ActionEvent,
  FormNode,
  FieldNode,
  CheckboxNode,
  ButtonNode,
  TabsNode,
  TableNode,
  ModalNode,
  PageNode,
  SectionNode,
  ListNode,
  ListItemNode,
} from "./index.js";

// Re-export the ViewNode hierarchy and wire types so a backend can import
// everything it needs from one place.
export * from "./index.js";

// ─── Action-name uniqueness check (Phase 06 / WIRE-05) ───────────────────────
//
// The wire contract says "one action name = one operation." Per-row identity
// lives in the action name itself (`delete-row-42` instead of `delete-row` with
// a context `{id: 42}`). Two dispatch-bearing nodes that share an action name
// must be firing the *same* operation, or the server has produced an ambiguous
// tree — the agent driving the wire cannot tell which row a `delete-row` click
// is meant to target.
//
// `validateActionNames` walks a built tree and throws when two dispatch-bearing
// nodes share an action name but represent semantically distinct operations.
// The heuristic — "same name is allowed iff both nodes share the same enclosing
// FormNode reference" — is intentionally strict outside forms: the most common
// bug class this exists to catch is per-row buttons that forgot to include the
// row ID in the action name. A looser heuristic would swallow exactly that bug.
//
// Two ButtonNodes inside one FormNode firing `save-ticket-42` → PASS
//   (top-of-form and bottom-of-form "Save" button — canonical valid duplicate).
// Two ButtonNodes in different FormNodes firing `submit`                → FAIL.
// Two ButtonNodes at the page level (no enclosing form) firing `delete` → FAIL
//   (per-row delete buttons that forgot the row ID).
// A ButtonNode in a form and one at page level firing `save`            → FAIL.

interface ActionOccurrence {
  name: string;
  /** The enclosing FormNode reference, or null when not inside a form. */
  enclosingForm: FormNode | null;
}

/**
 * Walk a ViewNode tree and assert that every dispatch-bearing action name names
 * exactly one operation. Two occurrences are considered "the same operation"
 * iff they share the same enclosing FormNode reference; otherwise a duplicate
 * action name is a violation.
 *
 * Call this from your GET handler before returning the initial response if you
 * want the same protection at initial-load time — the action-handler wrapper
 * (`createAction`) calls it automatically on every response that carries `vm`.
 *
 * @throws Error when a violation is found. The message names the colliding
 *   action and suggests the two fixes (rename one node, or move both into the
 *   same enclosing form).
 */
export function validateActionNames(vm: ViewNode): void {
  const occurrences: ActionOccurrence[] = [];
  collectActions(vm, null, occurrences);

  // Group by action name; for each group, verify all occurrences share the
  // same enclosing FormNode (and that form is non-null). Anything else is a
  // violation.
  const byName = new Map<string, ActionOccurrence[]>();
  for (const occ of occurrences) {
    const bucket = byName.get(occ.name);
    if (bucket) bucket.push(occ);
    else byName.set(occ.name, [occ]);
  }

  for (const [name, group] of byName) {
    if (group.length < 2) continue;
    const firstForm = group[0].enclosingForm;
    // Allowed iff every occurrence is inside the SAME non-null form.
    const allInSameForm =
      firstForm !== null && group.every((o) => o.enclosingForm === firstForm);
    if (!allInSameForm) {
      throw new Error(
        `Duplicate action name '${name}' dispatched from semantically distinct nodes. ` +
        `Each action name must name exactly one operation. Either rename one of the ` +
        `nodes (e.g. '${name}-X' / '${name}-Y') or move them into the same surrounding ` +
        `form if they are intended to fire the same operation.`
      );
    }
  }
}

function collectActions(
  node: ViewNode,
  enclosingForm: FormNode | null,
  out: ActionOccurrence[]
): void {
  switch (node.type) {
    case "page": {
      const page = node as PageNode;
      for (const child of page.children) collectActions(child, enclosingForm, out);
      return;
    }
    case "section": {
      const section = node as SectionNode;
      for (const child of section.children) collectActions(child, enclosingForm, out);
      return;
    }
    case "list": {
      const list = node as ListNode;
      for (const child of list.children) collectActions(child, enclosingForm, out);
      return;
    }
    case "list-item": {
      const li = node as ListItemNode;
      for (const child of li.children) collectActions(child, enclosingForm, out);
      return;
    }
    case "form": {
      const form = node as FormNode;
      if (form.submitAction) recordAction(form.submitAction, form, out);
      if (form.buttons) {
        for (const btn of form.buttons) recordAction(btn.action, form, out);
      }
      for (const child of form.children) collectActions(child, form, out);
      return;
    }
    case "field": {
      const field = node as FieldNode;
      if (field.action) recordAction(field.action, enclosingForm, out);
      return;
    }
    case "checkbox": {
      const cb = node as CheckboxNode;
      if (cb.action) recordAction(cb.action, enclosingForm, out);
      return;
    }
    case "button": {
      const btn = node as ButtonNode;
      recordAction(btn.action, enclosingForm, out);
      return;
    }
    case "tabs": {
      const tabs = node as TabsNode;
      for (const tab of tabs.tabs) recordAction(tab.action, enclosingForm, out);
      return;
    }
    case "modal": {
      const modal = node as ModalNode;
      if (modal.dismissAction) recordAction(modal.dismissAction, enclosingForm, out);
      for (const child of modal.children) collectActions(child, enclosingForm, out);
      if (modal.footer) {
        for (const child of modal.footer) collectActions(child, enclosingForm, out);
      }
      return;
    }
    case "table": {
      const table = node as TableNode;
      if (table.sortActions) {
        for (const action of Object.values(table.sortActions)) {
          recordAction(action, enclosingForm, out);
        }
      }
      if (table.filterAction) recordAction(table.filterAction, enclosingForm, out);
      if (table.pagination?.prevAction) {
        recordAction(table.pagination.prevAction, enclosingForm, out);
      }
      if (table.pagination?.nextAction) {
        recordAction(table.pagination.nextAction, enclosingForm, out);
      }
      for (const row of table.rows) {
        if (row.actions) {
          // row.actions is ViewNode[] — it can include bind-only nodes (e.g. a
          // per-row CheckboxNode used for selection has no .action). Filter to
          // ButtonNodes the same way the .NET validator does (OfType<ButtonNode>())
          // before recording — otherwise the validator throws on a non-button
          // entry's missing .action property. Phase 6 surfaced this when
          // TableSelection was removed and per-row selection moved into
          // row.actions as bound CheckboxNodes (06-04).
          for (const node of row.actions) {
            // TableRow.actions is typed ButtonNode[] but Phase 6 (06-04)
            // started using it for bind-only CheckboxNodes too — the .NET
            // twin types it IReadOnlyList<ViewNode>. Narrow through unknown
            // so both branches type-check until the TS type widens.
            const n = node as unknown as ButtonNode | CheckboxNode;
            if (n.type === "button") {
              recordAction(n.action, enclosingForm, out);
            } else if (n.type === "checkbox") {
              if (n.action) recordAction(n.action, enclosingForm, out);
            }
          }
        }
      }
      return;
    }
    // Nodes with no dispatch-bearing actions of their own:
    //   text, link, image, stat-bar, progress, copy-button
    default:
      return;
  }
}

function recordAction(
  action: ActionEvent,
  enclosingForm: FormNode | null,
  out: ActionOccurrence[]
): void {
  out.push({ name: action.name, enclosingForm });
}

// ─── Action payload ──────────────────────────────────────────────────────────

export interface ActionPayload<TState> {
  name: string;
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
  const action = JSON.parse(actionRaw) as { name: string };
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
    state,
    files,
  };
}

/** Parse a flat JSON action body — `{name, state}`. For curl/agent callers. */
export function parseJsonAction<TState>(body: string | object): ActionPayload<TState> {
  const parsed = typeof body === "string"
    ? (JSON.parse(body) as { name: string; state: TState })
    : (body as { name: string; state: TState });
  return {
    name: parsed.name,
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
 * Thrown by an action handler to signal a malformed/invalid request. The
 * createAction wrapper catches this and returns a 400 with the error
 * message in the body, matching the .NET twin's BadRequest("...") path.
 * Any other thrown Error propagates to the runtime (Bun.serve / Hono /
 * etc.) as a 500.
 */
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

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
    let result: ShellResponseBody<TState>;
    try {
      result = await handler(payload);
    } catch (err) {
      if (err instanceof BadRequestError) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw err;
    }
    // Phase 06 / WIRE-05 — enforce action-name uniqueness on the built tree
    // before it leaves the server. A violation here is a server-side bug, so
    // we surface it as a 500 (the parse-error path above is a 400 because the
    // client sent malformed input). Only run when the response carries a vm
    // (redirect-only responses have nothing to walk).
    if (result.vm) {
      try {
        validateActionNames(result.vm);
      } catch (err) {
        return new Response(JSON.stringify({ error: (err as Error).message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  };
}
