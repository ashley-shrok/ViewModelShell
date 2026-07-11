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
  FitsNode,
  EmptyStateNode,
  BreadcrumbNode,
} from "./index.js";

// Re-export the ViewNode hierarchy and wire types so a backend can import
// everything it needs from one place.
export * from "./index.js";

// ─── Canonical agent skill load (1.6.0 / 1.5.0) ──────────────────────────────
// Loaded once at module init so createAgentSkillHandler can bake the body at
// handler-creation time (no per-request fs work). The path resolution works for
// BOTH layouts:
//   - Source/dev (vitest):    src/server.ts → ../agent-skill.md
//   - Published tarball:      dist/server.js → ../agent-skill.md (file is in
//                             package root, listed in package.json `files`)
// If `agent-skill.md` is missing at module init the import throws — the
// fail-loud rule (see AGENTS.md capability-seam doc) applies: a silent 404
// from the skill endpoint would defeat the purpose.
import { readFileSync as __vmsReadFileSync } from "node:fs";
import { fileURLToPath as __vmsFileURLToPath } from "node:url";
import { dirname as __vmsDirname, join as __vmsJoin } from "node:path";
const __vmsAgentSkillDir = __vmsDirname(__vmsFileURLToPath(import.meta.url));
const AGENT_SKILL_MARKDOWN = __vmsReadFileSync(
  __vmsJoin(__vmsAgentSkillDir, "..", "agent-skill.md"),
  "utf8",
);

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
      if (table.pagination?.jumpAction) {
        recordAction(table.pagination.jumpAction, enclosingForm, out);
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
    case "fits": {
      // FitsNode.children are full ViewNode[] (can hold forms, buttons,
      // sections with action/link) — the renderer picks ONE at runtime but
      // every candidate ships on the wire, so all must be validated. Without
      // this arm the entire fits subtree skipped action-name uniqueness checks.
      const fits = node as FitsNode;
      for (const child of fits.children) collectActions(child, enclosingForm, out);
      return;
    }
    case "empty-state": {
      // EmptyStateNode.action is an optional ButtonNode carrying a real action
      // name. It is a dispatch-bearing descendant, so the uniqueness collector
      // MUST descend into it — otherwise the CTA is silently exempt from the
      // one-name-one-operation rule (the 3.3.0 missed-walk failure class).
      const es = node as EmptyStateNode;
      if (es.action) collectActions(es.action, enclosingForm, out);
      return;
    }
    case "breadcrumb": {
      // A breadcrumb crumb can navigate by DISPATCHING AN ACTION instead of an
      // href (the VMS navigate-by-state model). Each such action is a
      // dispatch-bearing descendant, so the uniqueness collector MUST descend
      // into it — modeled on the `tabs` arm, with the optional guard the
      // empty-state arm uses (not every crumb carries an action; the last/current
      // crumb and href-only crumbs carry none). Skipping this would silently
      // exempt crumb actions from the one-name-one-operation rule.
      const bc = node as BreadcrumbNode;
      for (const item of bc.items) {
        if (item.action) recordAction(item.action, enclosingForm, out);
      }
      return;
    }
    // Nodes with no dispatch-bearing actions of their own:
    //   text, link, image, stat-bar, progress, copy-button, badge, chart, steps
    //   (breadcrumb crumb actions ARE recorded above via the "breadcrumb" arm)
    // ChartNode (CHART-05) and StepsNode (NAV-02) are DELIBERATE
    // childless/action-free leaves — they carry only data, so they fall through
    // here with no recursion (no fits-style blind spot).
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

// ─── SectionNode.action / .link shape checks (1.4.0 / 1.5.0) ─────────────────
//
// Five invalid combos a clickable-card or linked-card primitive can produce at
// build time:
//   (a) SectionNode.action set together with collapsible:true on the same
//       section — a collapsible section's <summary> IS the click target; a
//       clickable card makes the whole section the click target. Pick one.
//   (b) A SectionNode with .action nested inside another SectionNode with
//       .action OR .link — nested role="button"/nested-<a> is an a11y/HTML5
//       violation, and click-ownership in the overlap is ambiguous.
//   (c) (1.5.0) SectionNode.action set together with SectionNode.link on the
//       same section — a section is either a dispatcher (action) or a
//       navigator (link); they create different user expectations of a click.
//   (d) (1.5.0) SectionNode.link set together with collapsible:true — same
//       rationale as (a).
//   (e) (1.5.0) A SectionNode with .link nested inside another SectionNode
//       with .link OR .action — HTML5 prohibits nested <a> elements; the
//       mixed case is ambiguous click-ownership.
// A styling-only SectionNode { variant: "card" } (no .action and no .link)
// inside a clickable or linked card with internal buttons is VALID — only
// nested .action / .link errors.
//
// Mirrors viewmodel-shell-dotnet/ViewModels.cs's
// ViewTreeValidation.ValidateSectionAction. The createAction wrapper invokes
// this alongside validateActionNames so a server-built tree that violates
// any rule surfaces as a 500 with code "invalid_tree" before the response
// leaves the wire.

/**
 * Walk a ViewNode tree and reject five invalid SectionNode.action / .link
 * combos: (a) action + collapsible:true; (b) nested action-in-action or
 * action-in-link; (c) action + link on the same section; (d) link +
 * collapsible:true; (e) nested link-in-link or link-in-action. Pure check —
 * does not mutate the tree.
 *
 * @throws Error when any invalid combo is found. The message names the
 *   offending section(s) by heading (or `(headingless)`).
 */
export function validateSectionAction(vm: ViewNode): void {
  walkForSectionAction(vm, null);
}

function walkForSectionAction(
  node: ViewNode,
  outerInteractive: SectionNode | null,
): void {
  switch (node.type) {
    case "page": {
      const page = node as PageNode;
      for (const child of page.children) walkForSectionAction(child, outerInteractive);
      return;
    }
    case "section": {
      const section = node as SectionNode;
      const hdr = section.heading && section.heading.length > 0
        ? section.heading
        : "(headingless)";
      // (c) action + link on the same section — invalid. Checked FIRST so
      // the most actionable message wins when the consumer accidentally sets
      // both (they get told "pick action OR link" instead of any nested or
      // collapsible message that follows from a still-ambiguous tree).
      if (section.action != null && section.link != null) {
        throw new Error(
          `SectionNode '${hdr}' has both Action and Link set. ` +
          "A SectionNode is either a dispatcher (action) or a navigator (link) — " +
          "they create different user expectations of what a click means. Pick one.",
        );
      }
      // (d) link + collapsible:true — invalid.
      if (section.link != null && section.collapsible === true) {
        throw new Error(
          `SectionNode '${hdr}' has both Link and Collapsible: true set. ` +
          "A collapsible section's summary IS the click target; a linked card " +
          "makes the whole section the click target. Pick one.",
        );
      }
      // (a) action + collapsible:true — invalid (existing, unchanged).
      if (section.action != null && section.collapsible === true) {
        throw new Error(
          `SectionNode '${hdr}' has both Action and Collapsible: true set. ` +
          "A collapsible section's summary IS the click target; a clickable card " +
          "makes the whole section the click target. Pick one.",
        );
      }
      // (e) nested link-in-link / link-in-action — invalid.
      if (section.link != null && outerInteractive !== null) {
        const outerHdr = outerInteractive.heading && outerInteractive.heading.length > 0
          ? outerInteractive.heading
          : "(headingless)";
        if (outerInteractive.link != null) {
          throw new Error(
            `Nested SectionNode.Link: inner section '${hdr}' is inside linked outer ` +
            `section '${outerHdr}'. HTML5 prohibits nested <a> elements.`,
          );
        } else {
          throw new Error(
            `SectionNode.Link inner section '${hdr}' is inside clickable outer ` +
            `SectionNode.Action '${outerHdr}'. Click-ownership in the overlap is ambiguous — ` +
            "a linked card inside a dispatcher card creates two competing primary interactions.",
          );
        }
      }
      // (b) nested action-in-action / action-in-link — invalid.
      if (section.action != null && outerInteractive !== null) {
        const outerHdr = outerInteractive.heading && outerInteractive.heading.length > 0
          ? outerInteractive.heading
          : "(headingless)";
        if (outerInteractive.action != null) {
          throw new Error(
            `Nested SectionNode.Action: inner section '${hdr}' is inside clickable outer ` +
            `section '${outerHdr}'. Nested role='button' elements are an accessibility violation, ` +
            "and click-ownership in the overlap is ambiguous. Use a styling-only inner section " +
            "(variant: 'card', no Action) with internal buttons instead.",
          );
        } else {
          throw new Error(
            `SectionNode.Action inner section '${hdr}' is inside linked outer ` +
            `SectionNode.Link '${outerHdr}'. Click-ownership in the overlap is ambiguous — ` +
            "a dispatcher card inside a linked card creates two competing primary interactions.",
          );
        }
      }
      const nextOuter = (section.action != null || section.link != null) ? section : outerInteractive;
      for (const child of section.children) walkForSectionAction(child, nextOuter);
      return;
    }
    case "list": {
      const list = node as ListNode;
      for (const child of list.children) walkForSectionAction(child, outerInteractive);
      return;
    }
    case "list-item": {
      const li = node as ListItemNode;
      for (const child of li.children) walkForSectionAction(child, outerInteractive);
      return;
    }
    case "form": {
      const form = node as FormNode;
      for (const child of form.children) walkForSectionAction(child, outerInteractive);
      return;
    }
    case "modal": {
      const modal = node as ModalNode;
      for (const child of modal.children) walkForSectionAction(child, outerInteractive);
      if (modal.footer) {
        for (const child of modal.footer) walkForSectionAction(child, outerInteractive);
      }
      return;
    }
    case "fits": {
      // A fits candidate can itself be a section with action/link (or contain
      // one), so the nested-section-interaction rules must descend here too.
      const fits = node as FitsNode;
      for (const child of fits.children) walkForSectionAction(child, outerInteractive);
      return;
    }
    case "empty-state": {
      // EmptyStateNode.action is a ButtonNode (no SectionNode descendants), but
      // descend for consistency with every other walk so a future shape can't
      // slip an interactive section past this validator.
      const es = node as EmptyStateNode;
      if (es.action) walkForSectionAction(es.action, outerInteractive);
      return;
    }
    // Leaf-like nodes (field, checkbox, button, text, link, image, stat-bar,
    // tabs, progress, table, copy-button, badge, chart, breadcrumb, steps) carry
    // no SectionNode descendants — TableNode rows hold strings + per-row controls,
    // not sections; ChartNode (CHART-05) is a childless/action-free data leaf;
    // BreadcrumbNode/StepsNode (NAV-01..03) hold plain { label, ... } records,
    // not ViewNode children, so no recursion is needed here (deliberate, not a
    // missed walk).
    default:
      return;
  }
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
    ? (JSON.parse(body) as { name?: string; state: TState })
    : (body as { name?: string; state: TState });
  if (typeof parsed.name !== "string" || parsed.name === "") {
    throw new Error("Missing required 'name' field in action payload");
  }
  // C4 (3.3.0) — require `state`. The shell always sends it, but a hand-rolled
  // curl/agent caller that posts `{name}` only would otherwise run the handler
  // with `undefined` state and crash on the first property access → a 500
  // uncaught_exception, the wrong error class. A missing/null state is a
  // malformed request the caller can fix, so surface it as a 400 parse_error
  // (this throw is caught by createAction's parse arm). An EMPTY object `{}` is
  // a valid state and is left alone.
  if (parsed.state == null) {
    throw new Error(
      "Missing required 'state' field in action payload. The action wire is " +
      "{name, state} — echo back the state from the GET response (or the prior " +
      "action response); send {} only if the app's state really is empty.",
    );
  }
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
  /** A SOFT (domain/validation) rejection that rides on an ok:true render —
   *  the action was refused but vm/state are still returned so the form keeps
   *  the user's input. Distinct from the ok:false + errors[] channel (which
   *  carries NO view): ok:false = "no view for you"; ok:true + rejected =
   *  "here's your view back, but the action did not take". An agent driving the
   *  wire checks `rejected` IN ADDITION to `ok`. Each violation reuses the
   *  ErrorEntry {path?, message, code?} shape; `path` is OPTIONAL — a violation
   *  with no path is a form/action-level rejection (vs field-bound when set). */
  rejected?: ShellRejection;
  /** 3.8.0 — the server's current-deployed client-build id. Normally stamped
   *  automatically by `createAction(handler, { currentBuild })`; also settable
   *  by hand on a response built outside createAction (e.g. a GET handler or a
   *  server-pushed SSE/WebSocket body) so those responses carry `serverBuild`
   *  too. Absent = the versioning feature is off for this response. */
  serverBuild?: string;
}

/** Wrapper for a soft-validation rejection on an ok:true response. */
export interface ShellRejection {
  violations: ErrorEntry[];
}

/** Build a redirect response (Vm and State omitted; shell navigates the browser). */
export function shellRedirect<TState = unknown>(url: string): ShellResponseBody<TState> {
  return { redirect: url };
}

/** Attach a soft-validation rejection to a normal re-render. Spread alongside
 *  vm/state — unlike a redirect, a rejection KEEPS the view:
 *    return { vm, state, ...shellRejection([{ path: "x", message: "…" }]) };
 *  Mirrors the C# `ShellResponse<T>.WithRejection(...)` fluent helper. */
export function shellRejection(violations: ErrorEntry[]): { rejected: ShellRejection } {
  return { rejected: { violations } };
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
  /** Transient confirmation toast (a UX nicety, fail-quiet by absence — see
   *  Adapter.toast). `message` is required; `tone`/`durationMs` are optional and
   *  kept ABSENT (not undefined) from the JSON wire via conditional spread,
   *  matching the .NET WhenWritingNull null-omission contract. */
  toast: (
    message: string,
    opts?: { tone?: string; durationMs?: number },
  ): ShellSideEffect => ({
    type: "toast",
    message,
    ...(opts?.tone != null ? { tone: opts.tone } : {}),
    ...(opts?.durationMs != null ? { durationMs: opts.durationMs } : {}),
  }),
};

// ─── Canonical agent skill mount helper (1.6.0 / 1.5.0) ──────────────────────

/**
 * Mount the canonical VMS agent skill markdown as an HTTP handler.
 *
 * The skill is a self-contained operating manual for the VMS wire protocol
 * (action dispatch shape, state round-trip rules, response envelope vocabulary,
 * side-effect verbs, polling, errors, file uploads). Advertise it to agents
 * driving your app via the `skill` field on the
 * `<meta name="viewmodel-shell">` discoverability tag, pointing at whatever URL
 * you mount this handler at (recommended: `/.well-known/vms-skill.md`).
 *
 * **Canonical source:** `viewmodel-shell/agent-skill.md` (shipped in the npm
 * package's `files` array; the .NET package embeds a byte-identical copy at
 * `viewmodel-shell-dotnet/AgentSkill.md` — see `parity/check-skill.ts`).
 *
 * **Preamble shape.** When `appPreamble` is supplied (non-empty after trim),
 * the served body is:
 *
 * ```
 * ## App-specific notes
 *
 * <preamble verbatim>
 *
 * ---
 *
 * <canonical-skill-body verbatim>
 * ```
 *
 * When omitted (or whitespace-only), the served body is the canonical skill
 * verbatim. The body is computed ONCE at handler-creation time; per-request
 * cost is a single `new Response(body)`. Multiple handlers with different
 * preambles are cheap and fully independent.
 *
 * **Cross-runtime.** Pure Web Fetch API — works in Bun, Deno, Hono, Cloudflare
 * Workers, and Node 18+. The application's router owns method/path routing;
 * the handler accepts any request and unconditionally serves the markdown body
 * with `Content-Type: text/markdown; charset=utf-8`.
 *
 * @example
 * ```ts
 * import { createAgentSkillHandler } from "@ashley-shrok/viewmodel-shell/server";
 * const skillHandler = createAgentSkillHandler({
 *   appPreamble: "This is the foo app. Auth: Bearer JWT in Authorization.",
 * });
 * Bun.serve({
 *   async fetch(req) {
 *     const url = new URL(req.url);
 *     if (url.pathname === "/.well-known/vms-skill.md" && req.method === "GET") {
 *       return skillHandler(req);
 *     }
 *     // ... your other routes
 *   },
 * });
 * ```
 */
export function createAgentSkillHandler(
  opts: { appPreamble?: string } = {},
): (req: Request) => Response {
  const preamble = opts.appPreamble?.trim() ?? "";
  const body = preamble.length === 0
    ? AGENT_SKILL_MARKDOWN
    : `## App-specific notes\n\n${preamble}\n\n---\n\n${AGENT_SKILL_MARKDOWN}`;
  return (_req: Request) =>
    new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
}

// ─── Action handler factory ──────────────────────────────────────────────────

/**
 * Thrown by an action handler to signal a malformed/invalid request. The
 * createAction wrapper catches this and returns a 400 with the error
 * message in the body, matching the .NET twin's BadRequest("...") path.
 * Reserved for "structurally invalid request the user can't see" (missing
 * required action field, etc.) — NOT for routine app validation (that stays
 * state-based per gotcha #4). No `code` is set on the wire entry (D-08).
 */
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

/**
 * Thrown by an action handler to signal that the dispatched action name is
 * not recognised. The createAction wrapper catches this and returns a 400
 * with `code: "unknown_action"` in the envelope, allowing agents to distinguish
 * "I sent a name your tree doesn't expose" from "your handler crashed."
 *
 * Usage — add a default arm to your dispatch switch:
 *   default: throw new UnknownActionError(payload.name);
 *
 * Mirrors .NET `UnknownActionException` — both backends use the same wire code.
 */
export class UnknownActionError extends Error {
  /** The offending action name sent by the client. */
  readonly actionName: string;
  constructor(actionName: string) {
    super(`Unknown action: ${actionName}`);
    this.name = "UnknownActionError";
    this.actionName = actionName;
  }
}

/**
 * The entry shape inside the `errors[]` array of an `ok: false` envelope.
 * `path` and `code` are optional — absent (not null) when not applicable,
 * per the WhenWritingNull / conditional-spread null-omission contract.
 */
export interface ErrorEntry {
  path?: string;
  message: string;
  code?: string;
}

/**
 * Stable, framework-only error code vocabulary. Apps MUST NOT set these —
 * the framework sets `code` on framework-detected failures only. Agents
 * that want generic handling check `ok`; agents that want to branch by
 * failure class check `code` against these constants.
 *
 * D-03 lock: "small, stable, framework-only set."
 */
export const ERR_CODES = {
  /** Malformed / unparseable request body. HTTP 400. */
  PARSE: "parse_error",
  /** App threw `UnknownActionError` (action name not recognised). HTTP 400. */
  UNKNOWN_ACTION: "unknown_action",
  /** Built view tree violates the action-name uniqueness rule. HTTP 500. */
  INVALID_TREE: "invalid_tree",
  /** App handler threw an unrecognised exception. HTTP 500. */
  UNCAUGHT: "uncaught_exception",
  /** 3.8.0 — request's `X-VMS-Client-Build` header ≠ the server's current-deployed
   *  build id (a stale, never-reloaded tab attempting a mutation). The request is
   *  rejected BEFORE `_state` is deserialized. HTTP 400. */
  STALE_CLIENT: "stale_client",
} as const;

/** Union type of the framework error codes from ERR_CODES. Useful for narrowing `errors[0].code`. */
export type ErrCode = typeof ERR_CODES[keyof typeof ERR_CODES];

/**
 * Build a JSON-stringified `{ok: false, errors: [...]}` envelope.
 * Uses the conditional-spread pattern to omit `path` and `code` when
 * undefined — matching the .NET WhenWritingNull null-omission contract.
 */
function errorEnvelope(entries: ErrorEntry[]): string {
  const serialized = entries.map(({ message, path, code }) => ({
    message,
    ...(path != null ? { path } : {}),
    ...(code != null ? { code } : {}),
  }));
  return JSON.stringify({ ok: false, errors: serialized });
}

/**
 * Derive a safe wire message from an unknown thrown value.
 * T1 info-disclosure mitigation: only copies `Error.prototype.message`
 * for Error instances; substitutes a generic string for non-Error throws
 * so unknown shapes never reach the wire.
 */
function errorMessageFromUnknownThrow(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Internal server error";
}

/**
 * Shared response factory — deduplicates the JSON + Content-Type header
 * boilerplate across the four error cases and the success path.
 */
function jsonResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
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
 *
 * 3.8.0 — optional version-skew half. Pass `{ currentBuild }` (the id of the
 * client bundle this server currently deploys) to opt in:
 *   - GUARD (fail-closed): if the request carries an `X-VMS-Client-Build` header
 *     whose value ≠ `currentBuild`, the mutation is rejected with a 400
 *     `stale_client` envelope BEFORE the body/`_state` is deserialized (the
 *     app's typed handler never runs on a stale client's payload).
 *   - STAMP: every successful response includes `serverBuild: currentBuild` so
 *     the client can detect a never-reloaded tab.
 * Omit `currentBuild` (or pass nothing) and behavior is byte-identical to
 * before — no guard, no stamp. The existing handler-only call signature is
 * unchanged.
 */
export function createAction<TState>(
  handler: (payload: ActionPayload<TState>) =>
    Promise<ShellResponseBody<TState>> | ShellResponseBody<TState>,
  options?: { currentBuild?: string },
): (request: Request) => Promise<Response> {
  const currentBuild = options?.currentBuild;
  return async (request: Request): Promise<Response> => {
    // 3.8.0 — fail-closed stale-client guard. Runs FIRST, before any body parse,
    // so a stale client's `_state` is never deserialized. Only when the app
    // configured `currentBuild` AND the header is present AND it mismatches.
    if (currentBuild) {
      const clientBuild = request.headers.get("x-vms-client-build");
      if (clientBuild !== null && clientBuild !== currentBuild) {
        return jsonResponse(
          errorEnvelope([{
            message:
              `Stale client: request build "${clientBuild}" does not match the ` +
              `current deployed build "${currentBuild}". Reload to continue.`,
            code: ERR_CODES.STALE_CLIENT,
          }]),
          400,
        );
      }
    }
    const contentType = request.headers.get("content-type") ?? "";
    let payload: ActionPayload<TState>;
    try {
      if (contentType.includes("application/json")) {
        payload = parseJsonAction<TState>(await request.text());
      } else {
        payload = parseFormDataAction<TState>(await request.formData());
      }
    } catch (err) {
      // Parse failure — client sent malformed input. 400.
      return jsonResponse(
        errorEnvelope([{ message: (err as Error).message, code: ERR_CODES.PARSE }]),
        400,
      );
    }
    let result: ShellResponseBody<TState>;
    try {
      result = await handler(payload);
    } catch (err) {
      if (err instanceof BadRequestError) {
        // Structurally invalid request — no `code` per D-08.
        return jsonResponse(
          errorEnvelope([{ message: err.message }]),
          400,
        );
      }
      if (err instanceof UnknownActionError) {
        // App threw to signal an unknown action name. 400 per D-11.
        return jsonResponse(
          errorEnvelope([{ message: err.message, code: ERR_CODES.UNKNOWN_ACTION }]),
          400,
        );
      }
      // Any other throw: server-side failure. Log server-side for observability
      // (T1: stack trace stays on the server, only safe message reaches the wire).
      console.error("[ViewModelShell] Uncaught exception in action handler:", err);
      return jsonResponse(
        errorEnvelope([{ message: errorMessageFromUnknownThrow(err), code: ERR_CODES.UNCAUGHT }]),
        500,
      );
    }
    // Phase 06 / WIRE-05 — enforce action-name uniqueness on the built tree
    // before it leaves the server. A violation here is a server-side bug, so
    // we surface it as a 500 (the parse-error path above is a 400 because the
    // client sent malformed input). Only run when the response carries a vm
    // (redirect-only responses have nothing to walk).
    if (result.vm) {
      try {
        validateActionNames(result.vm);
        // 1.4.0 — SectionNode.action shape checks (action+collapsible,
        // nested action-in-action). Same invalid_tree exit path.
        validateSectionAction(result.vm);
      } catch (err) {
        return jsonResponse(
          errorEnvelope([{ message: (err as Error).message, code: ERR_CODES.INVALID_TREE }]),
          500,
        );
      }
    }
    // Phase 07 / ERROR-01 — every successful response acquires ok:true at the
    // response edge. Controllers / app handlers do NOT set ok themselves.
    // 3.8.0 — stamp serverBuild when versioning is configured. Placed after the
    // result spread so `currentBuild` wins over any hand-set result.serverBuild.
    return jsonResponse(
      JSON.stringify({
        ok: true,
        ...result,
        ...(currentBuild ? { serverBuild: currentBuild } : {}),
      }),
      200,
    );
  };
}
