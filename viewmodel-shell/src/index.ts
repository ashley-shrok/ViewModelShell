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
// `render` is required; `navigate`/`storage`/`transport` are optional capability
// verbs a target opts into. A target that handles redirects must implement
// `navigate`; a target that supports the storage side-effects must implement
// `storage`; `transport` is an optional override point (default transport is
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
  | StatBarNode
  | TabsNode
  | ProgressNode
  | ModalNode
  | TableNode;

export interface PageNode {
  type: "page";
  title?: string;
  children: ViewNode[];
}

export interface SectionNode {
  type: "section";
  heading?: string;
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
  submitAction: ActionEvent;
  submitLabel?: string;
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
}

export interface TextNode {
  type: "text";
  value: string;
  style?: "heading" | "subheading" | "body" | "muted" | "strikethrough" | "error" | "pre";
}

export interface LinkNode {
  type: "link";
  label: string;
  href: string;
  /** true = open outside current app context (browser: new tab + noopener) */
  external?: boolean;
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
  /** When set, the shell dispatches a "poll" action at this interval (ms) after every load/dispatch.
   *  The server can override the next interval via ShellResponse.nextPollIn, or stop polling by
   *  omitting nextPollIn when no pollInterval is configured. */
  pollInterval?: number;
}

export interface ShellSideEffect {
  /** "set-local-storage" | "set-session-storage" — unknown types are silently ignored. */
  type: string;
  key?: string;
  value?: string;
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
      const res = await fetch(actionEndpoint, {
        method: "POST",
        headers: { Accept: "application/json", ...extraHeaders },
        body: form,
      });
      if (!res.ok) throw new Error(`Action '${action.name}' failed: ${res.status}`);
      this.processResponse((await res.json()) as ShellResponse);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError ? onError(error) : console.error("[ViewModelShell]", error);
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

  private failCapability(capability: "navigate" | "storage", detail: string): void {
    const err = new Error(
      `[ViewModelShell] Adapter is missing the "${capability}" capability but the ` +
      `server response requires it (${detail}). This is a hard failure, not a no-op: ` +
      `a silently-dropped ${capability} (e.g. an auth token never persisted, or a ` +
      `redirect that never happens) is a correctness/security bug. Implement ` +
      `${capability}() on your Adapter, or (for redirect) pass ShellOptions.onRedirect.`
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
      }
    }
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
}
