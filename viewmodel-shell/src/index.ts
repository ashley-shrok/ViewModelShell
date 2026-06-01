// ─── Action ──────────────────────────────────────────────────────────────────

export interface ActionEvent {
  name: string;
  context?: Record<string, unknown>;
  files?: Record<string, File>;
}

// ─── Adapter interface ────────────────────────────────────────────────────────
// Implement this to target a new platform (browser, mobile, terminal, …).
// The core references zero platform globals (this is a CI-enforced invariant) —
// platform side-effects are delegated through this seam, exactly like render().
// `render` is required; `navigate`/`storage`/`transport`/`saveFile` are optional
// capability verbs a target opts into. A target that handles redirects must
// implement `navigate`; one that supports storage side-effects must implement
// `storage`; one that supports authenticated downloads must implement
// `saveFile`; `transport` is an optional override point (default transport is
// the core's own `fetch`).

export interface Adapter {
  render(vm: ViewNode, onAction: (action: ActionEvent) => void): void;
  /** Hand the platform off to a URL (the browser adapter sets the page location).
   *  No safe no-op exists — if a redirect arrives and neither ShellOptions.onRedirect
   *  nor this method is available, the shell fails loudly. */
  navigate?(url: string): void;
  /** Write a client side-effect to platform storage. Write-only — the wire
   *  contract has no storage read. scope is "local" | "session". */
  storage?(scope: "local" | "session", key: string, value: string): void;
  /** OPTIONAL transport override. Phase 1 leaves the core's `fetch` as the
   *  universal default and does NOT route load()/dispatch() through this.
   *  Defined now so Phase 2 (upload progress) can plug an XHR binding in via
   *  the `hooks.onUploadProgress` callback with no further wire/API change. */
  transport?(
    input: string,
    init: { method?: string; headers?: Record<string, string>; body?: FormData | string },
    hooks?: { onUploadProgress?: (sent: number, total: number) => void }
  ): Promise<Response>;
  /** Save an authenticated-download blob to platform-appropriate storage. The
   *  shell fetches the URL with getRequestHeaders() merged, parses
   *  Content-Disposition filename + Content-Type, and calls saveFile().
   *  No safe no-op exists — a silently-dropped authenticated download is a
   *  correctness/security bug (cf. navigate/storage). If a "download"
   *  side-effect arrives and this method is absent, the shell fails loudly.
   *  May return void or Promise<void>; the shell awaits the return value so
   *  async I/O errors surface via onError. */
  saveFile?(data: Blob, filename: string, contentType: string): void | Promise<void>;
  /** 0.14.0 — install / clear a "warn before navigating away" guard, driven
   *  by `ShellResponse.preventUnload` on every response (load, dispatch,
   *  push). Idempotent: the shell calls with the boolean from each response,
   *  the adapter installs when true / clears when false. Designed for
   *  long-running server actions where an accidental tab close would lose
   *  in-flight work. Fail-quiet by absence (unlike navigate/storage/saveFile)
   *  — this is a UX safety net, not a security guarantee, and non-browser
   *  targets (TUI) have no terminal equivalent. Modern browsers show a
   *  generic "Leave site?" dialog; the message is not customizable. */
  setPreventUnload?(active: boolean): void;
}

// ─── Node types ───────────────────────────────────────────────────────────────

export type ViewNode =
  | PageNode
  | SectionNode
  | ListNode
  | ListItemNode
  | FormNode
  | FieldNode
  | CheckboxNode
  | ButtonNode
  | TextNode
  | LinkNode
  | ImageNode
  | StatBarNode
  | TabsNode
  | ProgressNode
  | ModalNode
  | TableNode
  | CopyButtonNode;

export interface PageNode {
  type: "page";
  title?: string;
  /** Density of global spacing. Omitted or "comfortable" = current behavior (no modifier class). "compact" emits .vms-page--compact. Closed union (D-03). */
  density?: "comfortable" | "compact";
  /** Layout preset arranging direct children. Omitted or "stack" = current vertical flow (no modifier class). "split" (equal 2-up), "cards" (uniform grid), "sidebar" (thin + wide app shell) emit .vms-page--{value}. Closed union (D-01/D-02; sidebar D-28). */
  layout?: "stack" | "split" | "cards" | "sidebar";
  /** Page-shell max-width override. Omitted = framework default cap (`--vms-page-max`, 1080px). "wide" = `--vms-page-max-wide` (1440px default), for data-heavy pages with wide tables. "full" = uncapped (max-width: none), for full-bleed dashboards. TUI ignores this (terminals fill naturally). Closed union (D-13 / issue #13). */
  width?: "wide" | "full";
  children: ViewNode[];
}

export interface SectionNode {
  type: "section";
  heading?: string;
  /** Section surface variant. Omitted = current behavior (no modifier class). "card" emits .vms-section--card. Closed union (D-03). */
  variant?: "card";
  /** Layout preset arranging direct children. Omitted or "stack" = current vertical flow (no modifier class). "split" (equal 2-up), "cards" (uniform grid), "sidebar" (thin + wide app shell) emit .vms-section--{value}. Closed union (D-01/D-02; sidebar D-28). */
  layout?: "stack" | "split" | "cards" | "sidebar";
  children: ViewNode[];
}

export interface ListNode {
  type: "list";
  id?: string;
  children: ViewNode[];
}

export interface ListItemNode {
  type: "list-item";
  id?: string;
  /** Appended as a BEM modifier: vms-list-item--{variant} */
  variant?: string;
  children: ViewNode[];
}

export interface FormNode {
  type: "form";
  /** The default submit action — renders an auto submit button + fires on
   *  Enter in a text field. OPTIONAL since 0.10.0 (#15): omit it for a form
   *  whose only triggers are `buttons[]`. When omitted, no default submit
   *  button renders and Enter does not submit at the form level (a
   *  FieldNode.action still fires per-field). */
  submitAction?: ActionEvent;
  submitLabel?: string;
  /** Layout preset for the form's controls. Omitted or "stack" = fields stacked (current, no modifier class). "inline" = field row + submit on one line (add/search bar) — emits .vms-form--inline. Closed union (D-29). */
  layout?: "stack" | "inline";
  /** Multi-action submit buttons (#15). Each is a full ButtonNode (so
   *  `variant` + `pendingLabel` apply) that, on activation, HARVESTS this
   *  form's current field values into its `action.context` and dispatches —
   *  the same harvest the default submit performs, but carrying a different
   *  action. Mirrors HTML's multiple submit buttons / `formaction`. A plain
   *  ButtonNode placed in `children` keeps its no-harvest behavior; only
   *  buttons in THIS slot harvest. */
  buttons?: ButtonNode[];
  children: ViewNode[];
}

export interface FieldNode {
  type: "field";
  name: string;
  inputType:
    | "text" | "email" | "password" | "number"
    | "date" | "time" | "datetime-local"
    | "textarea" | "hidden" | "file"
    | "select" | "select-multiple" | "checkbox"
    | "code";
  label?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  /** Optional language hint for `inputType: "code"`. Emitted as a class
   *  (`vms-field--code-{language}`) so apps can attach a syntax-highlighter
   *  library (CodeMirror, Monaco, etc.) — the framework only ships
   *  monospaced editable text, no coloring. */
  language?: string;
  /** Dispatched when Enter is pressed (text-like inputs only). Adapter merges { [name]: value } into context. */
  action?: ActionEvent;
}

export interface CheckboxNode {
  type: "checkbox";
  name: string;
  checked: boolean;
  label?: string;
  /** Dispatched immediately on change. Adapter merges { checked: boolean } into context. */
  action?: ActionEvent;
}

export interface ButtonNode {
  type: "button";
  label: string;
  action: ActionEvent;
  variant?: "primary" | "secondary" | "danger";
  /** Transient label shown from click until the dispatch resolves (response
   *  arrives or dispatch errors). Mirrors `CopyButtonNode.copiedLabel`'s
   *  lifecycle pattern at a different beat: shown DURING the round-trip
   *  rather than AFTER it. The adapter additionally adds `.vms-button--pending`
   *  while in this state so the button visibly disables (cursor + opacity).
   *  Omitted = no pending feedback (existing instant-click behavior). */
  pendingLabel?: string;
}

export interface TextNode {
  type: "text";
  value: string;
  style?: "heading" | "subheading" | "body" | "muted" | "strikethrough" | "error" | "warning" | "pre";
}

export interface LinkNode {
  type: "link";
  label: string;
  href: string;
  /** true = open outside current app context (browser: new tab + noopener) */
  external?: boolean;
}

export interface ImageNode {
  type: "image";
  /** Image source URL (required). */
  src: string;
  /** Accessibility text. Non-browser adapters (TUI) degrade to this. */
  alt?: string;
  /** Design-system sizing hint → `.vms-image--{size}`. Omit for intrinsic size
   *  (capped at 100% of the container). NOT free-form CSS. */
  size?: "small" | "medium" | "large" | "full";
  /** `"circle"` → square-cropped circular image (avatars). */
  shape?: "circle";
}

export interface StatBarNode {
  type: "stat-bar";
  stats: Array<{ label: string; value: string | number }>;
}

export interface TabsNode {
  type: "tabs";
  selected: string;
  /** Base action. Adapter merges { value: tab.value } into context on click. */
  action: ActionEvent;
  tabs: Array<{ value: string; label: string }>;
}

export interface ProgressNode {
  type: "progress";
  value: number; // 0–100
}

export interface ModalNode {
  type: "modal";
  title?: string;
  children: ViewNode[];
  /** Optional footer row (typically holds action buttons). Rendered as an inline row at the bottom of the modal. */
  footer?: ViewNode[];
  /** Dispatched when the close button is clicked. If omitted, no close button is rendered. */
  dismissAction?: ActionEvent;
  /** Width variant. Default is "medium" (~520px). "wide" (~800px) suits tables/dashboards;
   *  "fullscreen" (~95vw/95vh) for content that needs the whole viewport. */
  size?: "narrow" | "medium" | "wide" | "fullscreen";
}

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  filterValue?: string;
  /** If set, cell values render as <a href={value}>{linkLabel}</a> */
  linkLabel?: string;
  /** true = open outside current app context (browser: new tab + noopener) */
  linkExternal?: boolean;
}

export interface TableRow {
  id?: string;
  cells: Record<string, string>;
  action?: ActionEvent;
  variant?: string;
}

export interface TableSelection {
  /** Row ids that should render PRE-SELECTED on this render. In server-truth
   *  mode (`action` set) this is the live selection, round-tripped in state and
   *  authoritative every render. In local mode (`action` omitted) this is the
   *  server's initial pre-selection only — subsequent toggles are purely
   *  client-side DOM state and the server doesn't see them until a `buttons[]`
   *  click harvests them. */
  selectedIds: string[];
  /** OPTIONAL (0.13.0). When present: server-truth mode — every checkbox toggle
   *  dispatches this action with merged `{ id, checked }` per row or
   *  `{ all: true, checked }` for the header select-all (where "all" = the
   *  rendered page). Selection survives sort/filter/pagination via the state
   *  round-trip. When OMITTED: local mode — the adapter toggles the DOM
   *  checkbox + `.vms-table__row--selected` class purely client-side with no
   *  dispatch. Local mode is the recommended pattern for rapid-selection
   *  workflows (no dropped clicks under the dispatch guard); see `buttons` for
   *  how bulk actions read the resulting selection. */
  action?: ActionEvent;
  /** OPTIONAL (0.13.0). When present, the adapter renders these as a bulk-action
   *  toolbar ABOVE the table. On click, each button harvests the currently
   *  checked rows from the DOM and dispatches its `action` with
   *  `{ selectedIds: [...] }` merged into its `context`. Designed primarily to
   *  pair with local mode (`action` absent) — it's how the server learns the
   *  selection without a per-toggle round-trip — but works in server-truth mode
   *  too (the harvest matches `selectedIds` since the DOM reflects server-truth
   *  after each render). */
  buttons?: ButtonNode[];
}

export interface TablePagination {
  /** 1-based current page. */
  page: number;
  /** Rows per page. Drives the "X–Y of N" range label and the last-page calc. */
  pageSize: number;
  /** Total rows across all pages — server-truth. The adapter renders the range
   *  label and enables/disables prev/next from this; it does NOT slice. */
  totalRows: number;
  /** Dispatched on a page-control click. The adapter merges `{ page }` — the
   *  target 1-based page. */
  action: ActionEvent;
}

export interface TableNode {
  type: "table";
  columns: TableColumn[];
  rows: TableRow[];
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  /** Base action. Adapter merges { column, direction } into context on header click. */
  sortAction?: ActionEvent;
  /** Base action. Adapter merges { column, value, filters } into context on Enter. */
  filterAction?: ActionEvent;
  /** Per-row multi-select. When set, the adapter renders a leading checkbox
   *  column + a header select-all checkbox and tints selected rows. `TableRow.id`
   *  is REQUIRED on every row when selection is set — it's the address the
   *  toggle action reports back. */
  selection?: TableSelection;
  /** Server-driven pagination. When set, the adapter renders an "X–Y of N"
   *  range + prev/next controls below the table. **The server slices `rows` to
   *  the current page** — the adapter never paginates client-side (that would
   *  break for DB-backed tables, which are most of them). By convention
   *  `sortAction` / `filterAction` reset `page` to 1 on the server side, since
   *  the row window changes underneath them. */
  pagination?: TablePagination;
}

export interface CopyButtonNode {
  type: "copy-button";
  /** The string to write to the clipboard on click. */
  text: string;
  /** Label shown on the button before copying. Adapter default: "Copy". */
  label?: string;
  /** Ephemeral label shown after a successful copy, reverts after ~1.5 s. Adapter default: "Copied!". */
  copiedLabel?: string;
  /** Visual variant — mirrors ButtonNode.variant (issue #14). Adapter emits
   *  `vms-button vms-button--{variant}` (browser) / variant-tinted text
   *  (TUI), so a copy-button can read distinctly from neighboring default
   *  buttons. Closed union; omitted = current behavior (no modifier). */
  variant?: "primary" | "secondary" | "danger";
}

// ─── Shell ────────────────────────────────────────────────────────────────────
// Owns the fetch → render → action → fetch cycle.
// fetch is universal (browsers, Node 18+, Deno) so it belongs in the core.

export interface ShellOptions {
  endpoint: string;
  actionEndpoint: string;
  adapter: Adapter;
  onError?: (err: Error) => void;
  onLoading?: (loading: boolean) => void;
  /** Called before each dispatch — merge the returned headers into every POST request. */
  getRequestHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Called when the server responds with a redirect URL. When unset, falls back to adapter.navigate(url); if the adapter has no navigate, the shell fails loudly. */
  onRedirect?: (url: string) => void;
  /** Called during a files-bearing dispatch when the plugged-in adapter implements transport().
   *  sent = bytes uploaded so far; total = total bytes, or 0 when the total is indeterminate
   *  (guard total > 0 before computing sent / total). Never fires on the fetch fallback path. */
  onUploadProgress?: (sent: number, total: number) => void;
  /** When set, the shell dispatches a "poll" action at this interval (ms) after every load/dispatch.
   *  The server can override the next interval via ShellResponse.nextPollIn, or stop polling by
   *  omitting nextPollIn when no pollInterval is configured. */
  pollInterval?: number;
}

export interface ShellSideEffect {
  /** "set-local-storage" | "set-session-storage" | "download" — unknown types are silently ignored. */
  type: string;
  /** For "set-local-storage" / "set-session-storage": the storage key. */
  key?: string;
  /** For "set-local-storage" / "set-session-storage": the storage value. */
  value?: string;
  /** For "download": the URL to fetch (shell merges getRequestHeaders() into the request). */
  url?: string;
  /** For "download": optional filename hint. Response Content-Disposition wins
   *  when present; this is the fallback before the URL basename. */
  filename?: string;
}

export interface ShellResponse {
  vm: ViewNode;
  state: unknown;
  /** When set, the shell navigates to this URL instead of re-rendering. */
  redirect?: string;
  /** Applied in order before redirect or re-render. */
  sideEffects?: ShellSideEffect[];
  /** When set, schedules the next poll at this delay (ms). Overrides pollInterval for one tick. */
  nextPollIn?: number;
  /** 0.14.0 — when true, the shell asks the adapter to install a "warn before
   *  unload" guard; when false / absent, the guard is cleared. Drives long-
   *  running-work workflows: while server-side work is in flight, return
   *  `preventUnload: true` from each response; clear it when the work
   *  completes (typically via polling). See `Adapter.setPreventUnload`. */
  preventUnload?: boolean;
}

export class ViewModelShell {
  private currentVm: ViewNode | null = null;
  private currentState: unknown = null;
  private dispatching = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private options: ShellOptions) {}

  async load(params?: Record<string, string>): Promise<void> {
    const { endpoint, adapter, onError, onLoading } = this.options;
    this.stopPolling();
    try {
      onLoading?.(true);
      const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
      const extraHeaders = this.options.getRequestHeaders ? await this.options.getRequestHeaders() : {};
      const res = await fetch(url, { headers: { Accept: "application/json", ...extraHeaders } });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const body = (await res.json()) as ShellResponse;
      this.currentVm = body.vm;
      this.currentState = body.state;
      // 0.14.0 — apply the unload guard from the initial-load response too. The
      // server may legitimately want it on at first paint (e.g. the page was
      // refreshed mid-work and the long action is still pending server-side).
      adapter.setPreventUnload?.(body.preventUnload ?? false);
      adapter.render(body.vm, (action) => this.dispatch(action));
      this.schedulePoll(body.nextPollIn);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError ? onError(error) : console.error("[ViewModelShell]", error);
    } finally {
      onLoading?.(false);
    }
  }

  async dispatch(action: ActionEvent, silent = false): Promise<void> {
    if (this.dispatching) return;
    const { actionEndpoint, onError, onLoading } = this.options;
    if (this.currentState === null) {
      const err = new Error(
        `Cannot dispatch '${action.name}' before initial load completes. ` +
        `Call shell.load() and wait for it before allowing user interaction.`
      );
      onError ? onError(err) : console.error("[ViewModelShell]", err);
      return;
    }
    try {
      this.dispatching = true;
      if (!silent) onLoading?.(true);
      const form = new FormData();
      form.append("_action", JSON.stringify({ name: action.name, context: action.context ?? {} }));
      form.append("_state", JSON.stringify(this.currentState));
      if (action.files) {
        for (const [name, file] of Object.entries(action.files)) {
          form.append(name, file);
        }
      }
      const extraHeaders = this.options.getRequestHeaders ? await this.options.getRequestHeaders() : {};
      const adapter = this.options.adapter;
      const init = {
        method: "POST",
        headers: { Accept: "application/json", ...extraHeaders },
        body: form,
      };
      let res: Response;
      if (action.files && this.options.onUploadProgress && adapter.transport) {
        res = await adapter.transport(actionEndpoint, init, {
          onUploadProgress: this.options.onUploadProgress,
        });
      } else {
        res = await fetch(actionEndpoint, init);
      }
      if (!res.ok) throw new Error(`Action '${action.name}' failed: ${res.status}`);
      this.processResponse((await res.json()) as ShellResponse);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError ? onError(error) : console.error("[ViewModelShell]", error);
      // 0.8.0 (#11) — re-render the current VM on dispatch error. Adapters
      // may have applied client-side ephemeral state in onAction handlers
      // (e.g., BrowserAdapter swaps button text for ButtonNode.pendingLabel).
      // Re-rendering snaps that back to the authoritative server state.
      // Skipped when no VM has loaded yet (pre-initial-load dispatch is
      // already an error case handled above; currentVm stays null there).
      if (this.currentVm !== null) {
        this.options.adapter.render(this.currentVm, (a) => this.dispatch(a));
      }
    } finally {
      this.dispatching = false;
      if (!silent) onLoading?.(false);
    }
  }

  /** Feed a pre-parsed ShellResponse into the shell — for SSE/WebSocket integrations. */
  push(response: ShellResponse): void {
    if (this.dispatching) return;
    this.processResponse(response);
  }

  stopPolling(): void {
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
  }

  getCurrentVm(): ViewNode | null { return this.currentVm; }
  getCurrentState(): unknown { return this.currentState; }

  private failCapability(capability: "navigate" | "storage" | "saveFile", detail: string): void {
    const err = new Error(
      `[ViewModelShell] Adapter is missing the "${capability}" capability but the ` +
      `server response requires it (${detail}). This is a hard failure, not a no-op: ` +
      `a silently-dropped ${capability} (e.g. an auth token never persisted, a ` +
      `redirect that never happens, or an authenticated download silently swallowed) ` +
      `is a correctness/security bug. Implement ${capability}() on your Adapter, ` +
      `or (for redirect) pass ShellOptions.onRedirect.`
    );
    this.options.onError ? this.options.onError(err) : console.error("[ViewModelShell]", err);
  }

  private processResponse(body: ShellResponse): void {
    const adapter = this.options.adapter;
    for (const effect of body.sideEffects ?? []) {
      if (effect.type === "set-local-storage" && effect.key != null) {
        if (adapter.storage) adapter.storage("local", effect.key, effect.value ?? "");
        else this.failCapability("storage", `side-effect "${effect.type}" key="${effect.key}"`);
      } else if (effect.type === "set-session-storage" && effect.key != null) {
        if (adapter.storage) adapter.storage("session", effect.key, effect.value ?? "");
        else this.failCapability("storage", `side-effect "${effect.type}" key="${effect.key}"`);
      } else if (effect.type === "download" && effect.url != null) {
        // Fire-and-forget. Surfaces errors via onError. Does not block the
        // render/redirect branch below — downloads are a side channel, like
        // storage, and a slow download MUST NOT delay the user-visible update.
        void this.download(effect.url, effect.filename);
      }
    }
    // 0.14.0 — apply the unload guard before the redirect/render branch so it's
    // in place (or cleared) consistently across both branches. A server that
    // wants a redirect to NOT be blocked by its own guard simply omits
    // preventUnload (or sets it false) on that response — standard pattern.
    adapter.setPreventUnload?.(body.preventUnload ?? false);
    if (body.redirect) {
      if (this.options.onRedirect) {
        this.options.onRedirect(body.redirect);
      } else if (adapter.navigate) {
        adapter.navigate(body.redirect);
      } else {
        this.failCapability("navigate", `redirect to "${body.redirect}"`);
      }
      return;
    }
    this.currentVm = body.vm!;
    this.currentState = body.state;
    this.options.adapter.render(body.vm!, (a) => this.dispatch(a));
    this.schedulePoll(body.nextPollIn);
  }

  private schedulePoll(nextPollIn?: number): void {
    const delay = nextPollIn ?? this.options.pollInterval;
    if (delay == null) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      this.dispatch({ name: "poll" }, true);
    }, delay);
  }

  /**
   * Authenticated download: fetch the URL with getRequestHeaders() merged
   * (Bearer / anti-forgery / etc.), parse the response filename + content
   * type, and hand the bytes to the adapter's platform-specific save verb.
   *
   * Deliberately uses core `fetch`, NOT adapter.transport. The existing
   * transport override (XHR for upload-progress) constructs Response from
   * xhr.responseText (a string) and would corrupt binary blobs. Download
   * progress is a future, opt-in extension on its own seam.
   *
   * Errors (missing capability / non-OK status / adapter throw) surface
   * via onError; the download() call itself never throws into the caller.
   */
  private async download(url: string, hintFilename?: string): Promise<void> {
    const adapter = this.options.adapter;
    if (!adapter.saveFile) {
      this.failCapability("saveFile", `download from "${url}"`);
      return;
    }
    try {
      const extraHeaders = this.options.getRequestHeaders
        ? await this.options.getRequestHeaders()
        : {};
      const res = await fetch(url, { headers: extraHeaders });
      if (!res.ok) {
        throw new Error(`Download from ${url} failed: ${res.status} ${res.statusText}`);
      }
      const contentType = res.headers.get("Content-Type") ?? "application/octet-stream";
      const filename =
        parseContentDispositionFilename(res.headers.get("Content-Disposition")) ??
        hintFilename ??
        basenameFromUrl(url) ??
        "download";
      const blob = await res.blob();
      await adapter.saveFile(blob, filename, contentType);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.options.onError ? this.options.onError(error) : console.error("[ViewModelShell]", error);
    }
  }
}

// ─── Download helpers (file-private; no platform globals) ────────────────────
// `Blob` and `URL` are universals (browser, Node 18+, Deno, Bun) — confirmed
// off the check:core-globals denylist. `URL.createObjectURL` is browser-only
// and stays in BrowserAdapter behind the capability seam.

/**
 * Parse a `Content-Disposition` header for a filename. RFC 5987 `filename*`
 * (UTF-8, percent-encoded, internationalized) wins over the plain `filename`
 * parameter when both are present — that's the spec-canonical preference.
 * Returns null when the header is absent or no filename parameter is found.
 */
function parseContentDispositionFilename(header: string | null): string | null {
  if (header == null) return null;
  // RFC 5987 extended form: filename*=UTF-8''<percent-encoded>
  const ext = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (ext) {
    try {
      const decoded = decodeURIComponent(ext[2].trim());
      if (decoded.length > 0) return decoded;
    } catch {
      // Malformed percent-encoding — fall through to plain `filename`.
    }
  }
  // Plain form: filename="..." or filename=...
  const plain = /filename\s*=\s*"([^"]*)"|filename\s*=\s*([^;]+)/i.exec(header);
  if (plain) {
    const val = (plain[1] ?? plain[2] ?? "").trim();
    if (val.length > 0) return val;
  }
  return null;
}

/**
 * Extract a basename from a URL (relative or absolute). Returns null if the
 * path is empty or ends with `/`. Uses a dummy base so relative URLs parse;
 * the base is discarded.
 */
function basenameFromUrl(url: string): string | null {
  try {
    const u = new URL(url, "http://_/");
    const last = u.pathname.split("/").pop();
    return last && last.length > 0 ? decodeURIComponent(last) : null;
  } catch {
    return null;
  }
}
