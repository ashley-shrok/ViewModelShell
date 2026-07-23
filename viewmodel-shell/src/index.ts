// ─── Action ──────────────────────────────────────────────────────────────────

export interface ActionEvent {
  name: string;
  files?: Record<string, File>;
  /**
   * Phase 14 (NBA-01..04) — optional dispatch-scheduling hint, read PURELY
   * client-side to pick a dispatch lane. Omitted = `true`, the framework's
   * pre-Phase-14 behavior: byte-identical for every existing app. `false` =
   * a non-blocking round trip that coexists with a blocking dispatch instead
   * of contending for the client's single dispatch mutex (see
   * `.planning/design/non-blocking-actions.md`).
   *
   * This field never rides inside the `_action` POST payload — the wire shape
   * stays `{name}` only (the Phase 6 shape). `blocking` travels on the SAME
   * ActionEvent object already embedded on a triggering node's
   * `action`/`dismissAction`/`sortActions[...]`/`filterAction`/`prevAction`/
   * `nextAction`/tab `action` field; the server never needs to see it.
   */
  blocking?: boolean;
}

// ─── Bind-path state access (Phase 6) ────────────────────────────────────────
//
// The shell exposes a `{ read, write }` seam over its mutable state object so
// adapters can read each input's bound value (to render it) and write back on
// user events (to keep state authoritative). The bind path is a dotted string
// (e.g. `fields.title`, `rows.42.selected`); the helpers walk JSON-style:
// numeric segments index into arrays, anything else into objects. Adapters
// only ever see this interface — they never reference the shell directly.

export interface StateAccess {
  read(path: string): unknown;
  write(path: string, value: unknown): void;
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
  /** Render the view tree. `stateAccess` is the shell-owned `{ read, write }`
   *  seam over the live state object: the adapter reads input values via
   *  `stateAccess.read(node.bind)` and writes user input back via
   *  `stateAccess.write(node.bind, value)`. The third arg is OPTIONAL so
   *  callers (tests, embedders) that have no live state can still mount
   *  the adapter for class-emission / static-tree checks — adapters supply
   *  a no-op fallback internally when omitted. */
  render(
    vm: ViewNode,
    onAction: (action: ActionEvent) => void,
    stateAccess?: StateAccess,
  ): void;
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
  /** 0.16.0 — visually lock the UI during periods where user dispatches will
   *  be dropped. Called by the shell on every transition with `active = true`
   *  when EITHER a user-initiated dispatch is in flight OR the server returned
   *  `ShellResponse.busy: true` on its most recent response. Polls (silent
   *  dispatches) bypass — they're the only way out of a server-busy state.
   *  `BrowserAdapter` toggles `.vms-busy` on its container; default CSS makes
   *  every interactive descendant non-clickable (cursor: wait + pointer-events:
   *  none), so a rapid checkbox click during an in-flight round-trip never
   *  visually flips the box. Fail-quiet by absence (TUI has no equivalent). */
  setBusy?(active: boolean): void;
  /** Show a transient confirmation toast, driven by a `{ type: "toast" }`
   *  ShellSideEffect. `BrowserAdapter` stacks toasts in a single fixed-corner
   *  host region and auto-dismisses each after `opts.durationMs` (default
   *  ~4000ms). FAIL-QUIET BY ABSENCE — modeled on setPreventUnload/setBusy,
   *  NOT on navigate/storage/saveFile: a dropped toast is a missed UX nicety,
   *  never a correctness/security bug, so the core MUST NOT call failCapability
   *  when this verb is absent (non-browser targets like the TUI simply have no
   *  toast surface and the effect is a no-op). */
  toast?(message: string, opts?: { tone?: string; durationMs?: number }): void;
  /** 3.8.0 — force a full reload of the running client (the browser adapter
   *  calls `window.location.reload()`). The shell invokes this ONLY as the
   *  fail-closed recovery for a `stale_client` rejection: the server refused a
   *  mutation because the tab is running an out-of-date bundle, nothing was
   *  applied, and reloading to the fresh bundle is the only honest recovery.
   *  FAIL-QUIET BY ABSENCE — modeled on setBusy/toast, NOT on
   *  navigate/storage/saveFile: the `stale_client` failure ALSO surfaces via
   *  `onError` (as a VmsActionError), so an adapter without this verb still
   *  learns of the skew and can recover its own way. A missing `reload` is
   *  therefore NOT a silent failure, so the core MUST NOT call failCapability
   *  when it is absent (non-browser targets like the TUI have no reload
   *  concept). */
  reload?(): void;
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
  | CopyButtonNode
  | DividerNode
  | FitsNode
  | EmptyStateNode
  | BadgeNode
  | ChartNode
  | BlockquoteNode
  | BreadcrumbNode
  | StepsNode
  | TrackerNode
  | DiffNode;

export interface PageNode {
  type: "page";
  title?: string;
  /** Density of global spacing. Omitted or "comfortable" = current behavior (no modifier class). "compact" emits .vms-page--compact. Closed union (D-03). */
  density?: "comfortable" | "compact";
  /** Layout preset arranging direct children. Omitted or "stack" = current vertical flow (no modifier class). "split" (equal 2-up), "cards" (uniform grid), "sidebar" (thin + wide app shell), "row" (left-aligned wrapping horizontal row; items hug content), "switcher" (N equal items flipping all-row ↔ all-stack atomically at a content-width `threshold` — the negative-flex-basis primitive a grid cannot express; distinct from `cards` auto-fit which passes through intermediate column counts) emit .vms-page--{value}. Closed union (D-01/D-02; sidebar D-28; row D-30; switcher SWITCH-01). */
  layout?: "stack" | "split" | "cards" | "sidebar" | "row" | "switcher";
  /** When true the page fills the viewport height (`height:100dvh`) so a `fill` section inside it can take the leftover space and scroll internally — the full-height app-shell axis (a pinned footer/header with an internally-scrolling body, the Flutter Column+Expanded mechanism). Meant to pair with a `SectionNode.fill` child, which becomes the `flex:1 1 auto; min-height:0; overflow-y:auto` region. Absent/false = normal document flow (byte-identical to today). Orthogonal to `layout`. */
  fill?: boolean;
  /** Page-shell max-width override. Omitted = framework default cap (`--vms-page-max`, 1080px). "wide" = `--vms-page-max-wide` (1440px default), for data-heavy pages with wide tables. "full" = uncapped (max-width: none), for full-bleed dashboards. TUI ignores this (terminals fill naturally). Closed union (D-13 / issue #13). */
  width?: "wide" | "full";
  /** Main-axis arrangement for `layout:"row"` (the cluster primitive) — maps to `justify-content`. Omitted = no class → the row default (`flex-start`, left-pack) holds = byte-identical to today. Closed union copied verbatim from Jetpack Compose `Arrangement` ∩ Flutter `MainAxisAlignment` (ALIGN-01). Emits .vms-arrange--{value}. */
  arrange?: "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
  /** Cross-axis alignment for `layout:"row"` (the cluster primitive) — maps to `align-items`. Omitted = no class → the row default (`center`) holds = byte-identical to today. Closed union copied verbatim from Flutter `CrossAxisAlignment` (ALIGN-02). Emits .vms-align--{value}. */
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  /** For `layout:"switcher"`: the content-width FLIP point — a CLOSED size scale (NOT raw CSS, per P2) mapping sm→20rem, md→30rem, lg→40rem, xl→48rem. Emits .vms-switch--{token} which sets `--vms-switch-threshold`. Omitted = no class → the `var(--vms-switch-threshold, 30rem)` CSS default (30rem) holds = well-defined, byte-identical to today. (SWITCH-02) */
  threshold?: "sm" | "md" | "lg" | "xl";
  /** For `layout:"switcher"`: the OPTIONAL max-items-per-row count cap — once the child count exceeds `limit`, every child goes full-width regardless of container width. A bounded numeric union (2..8) per P2 (bounded scalar, not raw CSS). Emits .vms-switch-limit--{n}. Omitted = no class → no count cap, byte-identical to today. (SWITCH-02) */
  limit?: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** For `layout:"cards"`: overrides the auto-fit minimum track width (today's fixed `--vms-card-min: 16rem`) — a CLOSED size scale (NOT raw CSS, per P2) mapping xs→10rem, sm→13rem, md→16rem (= today's default), lg→20rem, xl→24rem. Emits .vms-cards-min--{token} which sets `--vms-card-min` on that element (the existing `repeat(auto-fit, minmax(min(var(--vms-card-min),100%),1fr))` cards rule reads it). Omitted = no class → the inherited 16rem default holds = byte-identical to today. Intended for `cards`; harmless elsewhere (it only sets a variable the cards rule reads). (GRID-01) */
  minItem?: "xs" | "sm" | "md" | "lg" | "xl";
  children: ViewNode[];
}

export interface SectionNode {
  type: "section";
  heading?: string;
  /** Section surface variant — the structural KIND of the section's surface (the single meaning of "variant" framework-wide). Omitted = current behavior (no modifier class). "card" emits .vms-section--card. Closed union (D-03). */
  variant?: "card";
  /** Semantic intent/severity tone — the universal status color axis (orthogonal to `variant`; a section can be a `card` AND `tone:"warning"`). Emits .vms-section--{tone} (subtle tinted surface + colored border, reusing the --vms-error/-warning/-success/-info tokens). Omitted = neutral. Closed union. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Layout preset arranging direct children. Omitted or "stack" = current vertical flow (no modifier class). "split" (equal 2-up), "cards" (uniform grid), "sidebar" (thin + wide app shell), "row" (left-aligned wrapping horizontal row; items hug content), "switcher" (N equal items flipping all-row ↔ all-stack atomically at a content-width `threshold` — the negative-flex-basis primitive a grid cannot express; distinct from `cards` auto-fit which passes through intermediate column counts) emit .vms-section--{value}. Closed union (D-01/D-02; sidebar D-28; row D-30; switcher SWITCH-01). */
  layout?: "stack" | "split" | "cards" | "sidebar" | "row" | "switcher";
  /** When true (and inside a `fill` page) this section takes the remaining column height and scrolls internally (`flex:1 1 auto; min-height:0; overflow-y:auto`) — the body region of a full-height app shell (e.g. a chat transcript above a pinned composer). Orthogonal to `layout` — a fill section still arranges its own children via `layout`. Outside a `fill` page it's a harmless no-op (the modifier class is inert without a `100dvh` parent). Absent/false = byte-identical to today. */
  fill?: boolean;
  /** When true, this section is a "follow the tail" scroll region — an append-only feed that keeps its NEWEST content in view across re-renders, unless the user has scrolled up to read history. The general primitive for a growing transcript: a chat log above a pinned composer, a live `tail -f` log view, an activity/audit stream, streamed job output. It exists because the default scroll-preservation contract (0.7.1/#7 — restore the prior `scrollTop`) is INVERTED for a growing feed: the old bottom becomes mid-scroll once taller content is appended, so the newest content silently ends up off-screen. Pure client-side render behavior (the server stays stateless — scroll position never rides the wire): the BrowserAdapter records, before each re-render, whether this element was within a small threshold of the bottom; after the re-render it pins a near-bottom element to the NEW bottom (`scrollTop = scrollHeight`) and leaves a scrolled-up element exactly where the user parked it. The decision is a pure function of the feed's scroll position at render time — `render()` doesn't know (or care) what triggered it, so a background poll, an SSE push, and the user's own form submit all follow the same rule; a genuinely scrolled-up feed is never hijacked. (When a chat visibly jumps to the bottom on the user's OWN send, that's the send interaction scrolling to the bottom before the re-render — the standard "your message pulls you down" UX — which the feed then correctly reads as at-bottom, not a special case here.) A brand-new follow-tail section starts pinned to the bottom (opens at the latest message). Emits `data-follow-tail` (no CSS — the scroll comes from the element already being an overflow region), so it's meant to pair with `fill` (which provides the internal `overflow-y:auto`) or any app that makes the section scroll; on a non-scrolling element it's an inert no-op. Orthogonal to `fill` and `layout`. The TUI ignores it (terminals follow naturally). Absent/false = byte-identical to today's preserve-my-place restore. */
  followTail?: boolean;
  /** Main-axis arrangement for `layout:"row"` (the cluster primitive) — maps to `justify-content`. Omitted = no class → the row default (`flex-start`, left-pack) holds = byte-identical to today. Closed union copied verbatim from Jetpack Compose `Arrangement` ∩ Flutter `MainAxisAlignment` (ALIGN-01). Emits .vms-arrange--{value}. */
  arrange?: "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";
  /** Cross-axis alignment for `layout:"row"` (the cluster primitive) — maps to `align-items`. Omitted = no class → the row default (`center`) holds = byte-identical to today. Closed union copied verbatim from Flutter `CrossAxisAlignment` (ALIGN-02). Emits .vms-align--{value}. */
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  /** For `layout:"switcher"`: the content-width FLIP point — a CLOSED size scale (NOT raw CSS, per P2) mapping sm→20rem, md→30rem, lg→40rem, xl→48rem. Emits .vms-switch--{token} which sets `--vms-switch-threshold`. Omitted = no class → the `var(--vms-switch-threshold, 30rem)` CSS default (30rem) holds = well-defined, byte-identical to today. (SWITCH-02) */
  threshold?: "sm" | "md" | "lg" | "xl";
  /** For `layout:"switcher"`: the OPTIONAL max-items-per-row count cap — once the child count exceeds `limit`, every child goes full-width regardless of container width. A bounded numeric union (2..8) per P2 (bounded scalar, not raw CSS). Emits .vms-switch-limit--{n}. Omitted = no class → no count cap, byte-identical to today. (SWITCH-02) */
  limit?: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  /** For `layout:"cards"`: overrides the auto-fit minimum track width (today's fixed `--vms-card-min: 16rem`) — a CLOSED size scale (NOT raw CSS, per P2) mapping xs→10rem, sm→13rem, md→16rem (= today's default), lg→20rem, xl→24rem. Emits .vms-cards-min--{token} which sets `--vms-card-min` on that element (the existing `repeat(auto-fit, minmax(min(var(--vms-card-min),100%),1fr))` cards rule reads it). Omitted = no class → the inherited 16rem default holds = byte-identical to today. Intended for `cards`; harmless elsewhere (it only sets a variable the cards rule reads). (GRID-01) */
  minItem?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Per-child cross-axis self-alignment — maps to CSS `align-self`, the per-child counterpart to the parent-level `align`. In the default vertical `stack` (a flex column) the cross axis is horizontal, so `start | center | end` = left/center/right, overriding the parent's alignment for THIS section only. The motivating case is a chat bubble (a `variant:"card"` section aligned to one side); general-purpose otherwise (a centered narrow group). Omitted = no class → the child inherits the parent's cross-axis alignment = byte-identical to today. Emits .vms-self--{value}. Closed union (CHILD-01). */
  alignSelf?: "start" | "center" | "end";
  /** Bounded content-width cap — a CLOSED token set (NOT raw CSS, per P2), implemented with `max-inline-size` (writing-mode-safe). Fractional values are proportional to the container (half→50%, two-thirds→66.6667%, three-quarters→75%) — the chat-gutter case, scaling with width; `prose` caps at the readable measure (min(65ch,100%), the Tailwind `max-w-prose` / Every-Layout `--measure` cap). The section still shrinks to its content below the cap. Omitted = no class → no cap (today's full-width behavior) = byte-identical. Emits .vms-maxw--{value}. Closed union (CHILD-02). */
  maxWidth?: "half" | "two-thirds" | "three-quarters" | "prose";
  /** Optional stable identifier for the section. Two uses: (1) it is emitted as the
   *  rendered element's DOM `id`, which makes the section addressable — e.g. as a
   *  `CopyButtonNode.copyTargetId` harvest target; and (2) when `collapsible: true`
   *  it is the renderer's open-state preservation key. Provide when `heading` isn't
   *  unique within a page or is absent — otherwise the collapsible snapshot falls
   *  back to `heading ?? "vms-section-anon"`, disambiguated by per-render ordinal.
   *  DOM ids must be unique on a page (the same uniqueness the collapse-key already
   *  wants). Omitted = no DOM id emitted and the heading fallback is used for collapse. */
  id?: string;
  /** When true, the section renders as a native `<details>`/`<summary>` disclosure widget (closed by default). Aesthetic, client-side primitive — the open/closed state is DOM-local and the server does NOT round-trip it (same conceptual model as draft text values in unsubmitted form inputs). The browser adapter snapshots `<details>.open` before each re-render and restores it after, keyed by `id ?? heading ?? "vms-section-anon"` (disambiguated by per-render ordinal); a re-key drops the preserved state (the documented escape hatch for rare server-driven expansion). The summary label is the section's `heading`; a headingless collapsible section uses the fallback string `"Show details"`. If a section needs to start open, do not mark it collapsible. Omitted/false = today's `<section>` rendering, byte-identical. */
  collapsible?: boolean;
  /** Click-anywhere section dispatch primitive — mirrors `TableRow.action` (1.1.0)
   *  at the section level. When set, the renderer makes the entire section
   *  clickable AND keyboard-activatable (Enter / Space — Space preventDefaults
   *  page scroll) AND exposes accessibility (role="button", tabindex=0,
   *  aria-label derived from `heading` when set, else from joined text content
   *  of descendants, else fallback `"Card"`). The per-section identity is
   *  encoded in the action name (e.g. `select-card-1`) — no context field,
   *  consistent with the Phase 6 wire. Clicks on nested ButtonNode / CheckboxNode /
   *  LinkNode / cell `linkLabel` anchors INSIDE the section do NOT also fire
   *  `action` (the renderer stops propagation on those targets).
   *
   *  Tree validation rejects two invalid combos at the server edge with
   *  `invalid_tree`:
   *    (a) `action` set together with `collapsible: true` on the same section
   *        (a collapsible section's `<summary>` IS the click target; a clickable
   *        card makes the whole section the click target — pick one).
   *    (b) a SectionNode with `action` nested inside another SectionNode with
   *        `action` (nested role="button" is an a11y violation; click-ownership
   *        in the overlap is ambiguous). A styling-only `variant: "card"`
   *        section (no `action`) with internal buttons inside a clickable card
   *        is VALID — only nested `action` errors.
   *
   *  Omitted = today's section rendering, byte-identical (no class drift, no
   *  extra attrs, no listeners). */
  action?: ActionEvent;
  /** URL-link navigator variant of the clickable-card primitive — the sibling
   *  of `action` (1.4.0). Set this to make the entire section a navigational
   *  anchor: the BrowserAdapter emits a wrapping `<a href={url}>` element so
   *  every NATIVE browser link affordance works for free — left-click navigate,
   *  middle-click new tab, Ctrl/Cmd-click new tab, Shift-click new window,
   *  right-click context menu, drag-to-bookmarks, status-bar URL preview, and
   *  accessible link semantics. No JS substitute exists for those; browsers
   *  implement them at the anchor-element level.
   *
   *  Reach for `link` (this field) when the card is conceptually a
   *  NAVIGATIONAL target (docs tile, gallery item, launcher tile). Reach for
   *  `action` (the sibling above) when the card is a DISPATCHER that runs
   *  server-side work. Closes [issue #21](https://github.com/ashley-shrok/ViewModelShell/issues/21).
   *
   *  Wire shape — INLINE object `{ url, external? }`, not flat sibling fields.
   *  When `external: true` is set, the renderer additionally adds
   *  `target="_blank"` and `rel="noopener noreferrer"` (mirroring LinkNode's
   *  external attribute pattern byte-for-byte). Clicks on nested ButtonNode /
   *  CheckboxNode / FieldNode / LinkNode / cell `linkLabel` anchors INSIDE a
   *  linked card do NOT also fire the wrapper anchor's navigation (the
   *  renderer stops propagation on those targets; for nested anchors it
   *  additionally `preventDefault`s the wrapper's default so the inner anchor
   *  wins). No `role`, no `tabindex`, no `aria-label` — the anchor element
   *  provides every link / keyboard / focus / a11y semantic natively.
   *
   *  Tree validation rejects four invalid combos at the server edge with
   *  `invalid_tree`:
   *    (a) `link` set together with `action` on the same section — a
   *        SectionNode is either a dispatcher (action) or a navigator (link);
   *        they create different user expectations of what a click means.
   *        Pick one.
   *    (b) `link` set together with `collapsible: true` on the same section —
   *        same rationale as action+collapsible (the summary IS the click
   *        target; a linked card makes the whole section the click target).
   *    (c) a SectionNode with `link` nested inside another SectionNode with
   *        `link` — HTML5 prohibits nested `<a>` elements.
   *    (d) a SectionNode with `link` nested inside a SectionNode with `action`
   *        (or vice versa) — click-ownership in the overlap is ambiguous.
   *
   *  Omitted = today's section rendering, byte-identical (no `<a>` wrapper,
   *  no class drift, no extra attrs). */
  link?: { url: string; external?: boolean };
  children: ViewNode[];
}

export interface ListNode {
  type: "list";
  id?: string;
  /** When true, this is an ORDERED list — renders `<ol>` (numbered) instead of
   *  `<ul>`. The semantic element gives real ordinal meaning (a11y: screen
   *  readers announce position/count; agent-legibility: the order is structural,
   *  not baked into item text). The visible "1." / "2." markers come from a CSS
   *  counter (`.vms-list--ordered`), not native list markers, because `.vms-list`
   *  is a flex column with `list-style:none` — so numbering survives the styled
   *  list-item layout. Omitted/false = `<ul>` (byte-identical to today). */
  ordered?: boolean;
  children: ViewNode[];
}

export interface ListItemNode {
  type: "list-item";
  id?: string;
  /** Row lifecycle/selection STATE (NOT severity — that's `tone`). A freeform, app-extensible token; the framework ships list-item styling for `active` (selected), `done`, `disabled`, and `high` (priority). Appended as a BEM modifier: vms-list-item--{state}. An unrecognized state renders an unstyled class (it still round-trips; just no shipped rule). Orthogonal to `tone` (a row can be `state:"active"` AND `tone:"danger"`). (TableRow additionally ships a `running` style; ListItem does not yet.) */
  state?: string;
  /** Semantic intent/severity — the universal status tone axis (closed). Emits .vms-list-item--{tone} (colored accent border, reusing the shared tokens). Omitted = neutral. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Task-list marker (GFM `- [ ]` / `- [x]`). Non-interactive — the framework
   *  draws a FIXED check glyph in front of the item content (a filled check
   *  when `true`, an empty box when `false`, no glyph when absent). Distinct
   *  from a CheckboxNode child: this is a semantic checklist ITEM, not a form
   *  input, so it has no bind and no action and is never clickable — a
   *  screen reader announces it as content, not as a control.
   *
   *  For an interactive check that dispatches on toggle, use a CheckboxNode
   *  inside `children` instead. */
  completed?: boolean;
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
  /** Full control of the submit button (#22). When set, the form renders THIS
   *  button as its submit — carrying its own `label` + `emphasis`/`tone`/`size`/
   *  `width`/`pendingLabel` — instead of synthesizing a plain one from
   *  `submitLabel`. The form fires `submitButton.action` on click, on native
   *  submit (Enter in a text field), and on textarea Enter (`submitOnEnter`).
   *  Mirrors the universal "write your own submit button" pattern (e.g. a
   *  full-width submit: `width:"full"`). Takes precedence over
   *  `submitLabel`/`submitAction`, which are ignored for the button when set. */
  submitButton?: ButtonNode;
  /** Layout preset for the form's controls. Omitted or "stack" = fields stacked (current, no modifier class). "inline" = field row + submit on one line (add/search bar) — emits .vms-form--inline. Closed union (D-29). */
  layout?: "stack" | "inline";
  /** Multi-action submit buttons (#15). Each is a full ButtonNode (so
   *  `variant` + `pendingLabel` apply) that, on activation, dispatches its
   *  declared action by name. Field values live in state at each input's
   *  `bind` path and travel with the dispatch's `_state` payload. Mirrors
   *  HTML's multiple submit buttons / `formaction` — different action per
   *  button, same underlying state. A plain ButtonNode placed in `children`
   *  has identical dispatch semantics: both flow through the same file-aware
   *  dispatch, so file collection is governed by each file input's `uploadOn`
   *  (below), NOT by whether the trigger sits in `buttons[]` or `children`. The
   *  buttons[] slot is purely a layout hint. */
  buttons?: ButtonNode[];
  /** Opt-in: bare Enter inside a descendant <textarea> dispatches submitAction
   *  (chat-composer "Enter sends, Shift/Ctrl/Meta/Alt+Enter = newline"). No-op
   *  when submitAction is absent or during IME composition. Default false. */
  submitOnEnter?: boolean;
  children: ViewNode[];
}

/**
 * Phase 21 (LOOK-01) — one reference in a `lookup` / `lookup-multiple` field:
 * an id, optionally the label to show for it, optionally what KIND of thing it
 * is. Used by BOTH `FieldNode.selected` (what is currently chosen) and
 * `FieldNode.candidates` (the current search results) — the same shape in both
 * places, which is what lets a picked value and an invented one stay
 * homogeneous (see `allowCustom`).
 *
 * `value` is the id and the only thing that ever round-trips. It is typed as a
 * `string` deliberately — not `string | number` — so the wire stays
 * byte-identical across backends (the same rationale as `min`/`max`/`step`
 * above): a numeric id serialized by System.Text.Json and by `JSON.stringify`
 * must produce the same bytes, and a union invites exactly that drift.
 *
 * `label` is OPTIONAL and MUST be **omitted when it equals `value`** — an
 * option not set is simply absent, and a label that merely repeats the id
 * carries no information. This is exactly the free-form-tag case: a tag is a
 * value whose label is itself, so the label is absent. (Salesforce models the
 * same rule: `displayValue` is null for a plain string field and populated
 * only when it carries something `value` doesn't — a localization, a format,
 * or a related record's name.)
 *
 * `type` is the polymorphic-reference tag, and it exists because an id alone is
 * not an identity. Microsoft, on Dataverse's `_ownerid_value`, verbatim: the
 * GUID *"doesn't tell you whether the owner of the record is a user or a
 * team."* Set it when one field can reference more than one kind of record;
 * **omit it for monomorphic references**, where it would say nothing the field
 * doesn't already say.
 */
export interface LookupItem {
  /** The id. The only half that round-trips. */
  value: string;
  /** Display text for `value`. Omitted = the label equals the value. */
  label?: string;
  /** What KIND of record `value` names. Omitted = a monomorphic reference. */
  type?: string;
}

export interface FieldNode {
  type: "field";
  name: string;
  inputType:
    | "text" | "email" | "password" | "number"
    | "date" | "time" | "datetime-local"
    | "textarea" | "hidden" | "file"
    | "select" | "select-multiple" | "checkbox"
    | "lookup" | "lookup-multiple"
    | "code";
  /** Path into state where this input reads its current value and writes user
   *  changes (e.g. `fields.title`). REQUIRED for value-bearing inputs
   *  (text/email/password/number/date/time/datetime-local/textarea/select/
   *  select-multiple/checkbox/lookup/lookup-multiple/code) and OPTIONAL for
   *  `file` inputs — a file
   *  input's binary rides the multipart side channel (fileRegistry keyed on
   *  `name`), so omit `bind` on a file input to avoid writing a
   *  `{filename,size}` placeholder object into state (which breaks a
   *  string/string-map state slot on round-trip).
   *
   *  For the lookup inputTypes this path holds the ID and NOTHING ELSE:
   *  `lookup` binds a `string` (one id), `lookup-multiple` binds a `string[]`
   *  (the ids). The human-readable label never lives here — it travels on
   *  `selected`, server→client only (see the `selected` doc). The id is state;
   *  the label is view. */
  bind?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
  /** Disables the control (greys it out, blocks input, excludes it from form
   *  submission). Server-owned. Emits `.vms-field--disabled` on the wrapper +
   *  the native `disabled` attribute. Omitted = enabled. */
  disabled?: boolean;
  /** Read-only: the value is shown and submitted but the user can't edit it
   *  (distinct from `disabled`, which also greys out + excludes from submit).
   *  Text-like inputs + textarea only. Emits the native `readonly` attribute. */
  readonly?: boolean;
  /** Per-field validation error message, rendered inline below the control as
   *  `.vms-field__error` (role="alert"); also sets the wrapper's
   *  `.vms-field--error`, the control's `aria-invalid="true"`, and wires the
   *  message into `aria-describedby`. The view-side complement to the
   *  response-level `rejected` channel — set it on the offending field when you
   *  build the tree. Omitted = no error shown.
   *
   *  **Lookup note (5.2.0, OPEN-5): a SEARCH failure reuses this slot** — if the
   *  directory query behind a `lookup` / `lookup-multiple` fails, put the message
   *  here. Do NOT swallow it: react-select actively discards fetch errors
   *  (`loader.then(callback, () => callback())`), which makes a dead backend
   *  indistinguishable from "no results" — a direct violation of principle 8
   *  (nothing important fails quietly), and no surveyed library has a
   *  search-error state at all. Reusing `error` closes that gap at zero wire
   *  cost, and §7 item 9 reserves the assertive channel for errors, so a genuine
   *  search failure is a correct fit for this slot's `role="alert"`.
   *
   *  ⚠️ **The known, accepted wart:** this overloads the slot. "The server is
   *  down" is NOT "your input is invalid", so the `aria-invalid="true"` it sets
   *  on the combobox is semantically wrong for a search failure; and one slot
   *  with two meanings COLLIDES if a field has a live search failure and a
   *  pending validation error at once (last writer wins). Accepted for v1: the
   *  app owns which message it puts here, the collision needs both conditions
   *  simultaneously on the same field, and a distinct search-error slot is
   *  purely additive later. Recorded rather than hidden, so a future phase can
   *  promote it with the reasoning already written down. */
  error?: string;
  /** Hint/help text rendered below the control as `.vms-field__help` and wired
   *  into the control's `aria-describedby`. Omitted = no hint. */
  help?: string;
  /** `min`/`max`/`step` passed through to the native input attribute for
   *  `number`/`range`/date-time inputs. STRINGS (HTML-attribute semantics): a
   *  numeric bound (`"0"`), a date bound (`"2020-01-01"`), and `step` also
   *  accepts `"any"`. Typed as strings (not numbers) so the wire stays
   *  byte-identical across backends. Omitted = no constraint. */
  min?: string;
  max?: string;
  step?: string;
  /** Maximum input length (characters) for text-like inputs + textarea →
   *  native `maxlength`. Integer. Omitted = no cap. */
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
  /**
   * LOOKUP INPUTS ONLY (Phase 21, LOOK-01). What is currently chosen, resolved
   * to display text by the server.
   *
   * 🚨 **THE LOAD-BEARING INVARIANT: `selected` is VIEW, not STATE.** It travels
   * **server→client ONLY**, is recomputed on every render, and is **NEVER
   * authoritative and NEVER trusted coming back from the client.** `bind` holds
   * the id and is the only authoritative thing. **Direction is the entire safety
   * argument** — a client cannot forge a label into a handler because a client
   * never sends one. Why, from our own principles: the view is a pure function
   * of state; the id persists and round-trips (state), while the label is
   * derived, server-owned, and recomputed every render (view). Putting the label
   * in the bind is putting view into state, and it manufactures a
   * cache-invalidation problem that every mature enterprise reference field
   * designed away by storing the id alone — rename a user and every label on
   * every referencing record changes with zero writes.
   *
   * 🚨 **`selected` and `candidates` are SEPARATE FIELDS ON PURPOSE, and the
   * selected label is NEVER resolved from `candidates`.** Fusing them is the
   * original sin. With an id-valued field, *"filter the candidate list"* and
   * *"forget what's selected"* are **the same operation** — so a picker that
   * resolves its label out of the candidate list renders a raw database id the
   * moment a form loads with a value already set and no search has occurred
   * (the cold-start case, which is the case that matters most). Ant Design ships
   * this failure silently (`label: ... ?? item.value`); Zag chased it across
   * four changelog entries and two years. Read the label from `selected` and
   * only from `selected`.
   *
   * **Always an array**, including for single `lookup`, where it holds 0 or 1
   * entries. This is deliberate and there is no precedent for it elsewhere in
   * this file, so the reasoning lives here: a `T | T[]` union drifts across
   * backends (it does not serialize byte-identically under both
   * System.Text.Json and `JSON.stringify`), and the banked parity lesson is to
   * prefer the shape that cannot drift over the shape that reads nicer.
   *
   * `selected[].value` duplicating `bind` is **accepted, deliberate
   * redundancy** — keying by value is robust; positional parallel arrays are
   * not.
   *
   * Omitted = nothing currently selected.
   */
  selected?: LookupItem[];
  /**
   * LOOKUP INPUTS ONLY (Phase 21, LOOK-01). The current search results — what
   * the popup listbox offers. Feeds the popup and **nothing else**. **NEVER the
   * source of a selected label** (see `selected`).
   *
   * 🚨 **ORDER IS MEANINGFUL APP DATA. The renderer presents candidates AS
   * GIVEN — it sorts nothing, dedupes nothing, and truncates nothing.** The app
   * decides what comes back and in what order; **relevance ordering is the
   * SERVER's judgment, never the widget's.** This is universal in mature
   * pickers: Salesforce's picker `searchType` **defaults to `Recent`**, and
   * Dynamics shows the five most-recently-used rows plus five favourites,
   * explicitly NOT filtered by the search term. A renderer that "helpfully"
   * alphabetized for tidiness would **silently destroy a server-side ranking
   * with no way for the app to stop it** — a real consumer sorts candidates by
   * recency-weighted mention frequency in their own provider handler, and that
   * ranking is the whole product. (Scope: this governs the PRESENTATION of
   * `candidates`. It is not a ban on the renderer having logic — deduping
   * `bind` on commit in `lookup-multiple` is a state write about the user's own
   * accumulated selection, and is correct.)
   *
   * 🚨 **Any cap MUST be VISIBLE in the tree. Nothing truncates silently.**
   * There is no wire field for a cap: the app renders a `TextNode` saying so —
   * *"Refine your filter — N matches, max is X"*, the canonical table-workflow
   * pattern. The anti-pattern is ServiceNow's 15-result cap applied post-ACL
   * behind a hard 250-row SQL ceiling, where **an exact-match record can be
   * silently invisible** in a large table. A cap the user cannot see is a
   * correctness bug wearing a performance knob's clothes.
   *
   * 🚨 **The picker's filter is UX, NEVER authorization.** Narrowing what is
   * *offered* is not a security boundary, and a filter that looks like one is
   * precisely what gets trusted by mistake. ServiceNow says it outright: *"To
   * restrict what data specific users can access, use ACLs not reference
   * qualifiers."* Salesforce runs two separate layers for exactly this reason —
   * a metadata `lookupFilter` enforced server-side on save, versus the
   * component's UI-only `filter`. **The server authorizes in the action
   * handler, with the real auth context, exactly as every other VMS action
   * does.** Omitting a record from `candidates` hides it from the dropdown and
   * from nothing else — a client that already knows an id can still put it in
   * `bind`, so the handler is the only thing standing between a user and a
   * record they may not touch.
   *
   * Omitted = no results to offer.
   */
  candidates?: LookupItem[];
  /**
   * LOOKUP INPUTS ONLY (Phase 21, LOOK-04). Path into state where the typed
   * query lives, so the server can see it and the view stays a pure function of
   * state. Separate from `bind`, which holds the id — the query and the
   * selection are different facts and never share a slot.
   *
   * Required for a working search: with a `searchAction` but no `searchBind`,
   * the query is dispatched but the server can never read what was typed — a
   * silently dead search that renders perfectly and returns nothing forever. The
   * browser warns `[vms:lookup-no-searchbind]`.
   *
   * Keystrokes write here immediately (the query is state); **Enter** dispatches
   * `searchAction`. That is the same cadence `TableNode.filterAction` uses.
   *
   * 🚨 The query is what the user TYPED. It is **not** the display text: an
   * input showing the selected label (a form loaded with a reference already
   * set) holds a label, not a query, and the renderer does not flush it here.
   * Clearing the box clears the query and reveals the label again — clearing the
   * SEARCH TEXT is not clearing the SELECTION (only `bind` holds that).
   *
   * Omitted = the query is not round-tripped.
   */
  searchBind?: string;
  /**
   * LOOKUP INPUTS ONLY (Phase 21). Dispatched **on ENTER**, as an **ordinary
   * action** — the same cadence `TableNode.filterAction` uses, and the same one
   * `action` above uses. Keystrokes write `searchBind` and dispatch nothing;
   * there is **no debounce** and **no live-query lane**.
   *
   * 🚨 **`blocking` means exactly what it means everywhere else, and the
   * framework NEVER sets it.** Your `ActionEvent` is dispatched as you declared
   * it — omit `blocking` (the default, blocking/serialized lane) unless you have
   * a specific reason not to.
   *
   * **Leaving it blocking is the recommended default, and it is a correctness
   * property, not a preference:** a blocking action is serialized by the shell's
   * dispatch guard (a second action cannot dispatch while a round trip is in
   * flight), so a stale search response can never land after — and clobber — a
   * newer action. Opting into `blocking: false` means *this response may be
   * discarded, may arrive out of order, and may coexist with another in flight*;
   * that is yours to choose, and yours to handle.
   *
   * 🚨 **Do NOT combine with {@link FieldNode.allowCustom} — it is UNSUPPORTED
   * in v1 and warns `[vms:lookup-ambiguous-enter]`.** One Enter cannot both
   * invent a value and run a search. The two supported shapes are: this field
   * WITHOUT `allowCustom` (a directory/reference picker — Enter searches,
   * arrow+Enter accepts a candidate), or `allowCustom` WITHOUT `searchAction`
   * (a free-form tags field — Enter invents). Declaring both is ignored in
   * favour of the search, loudly.
   *
   * ⚠️ **`searchAction` OCCUPIES Enter, so {@link FieldNode.action} is
   * unreachable on a lookup that declares one.** This is a deliberate
   * limitation, not a bug: Enter is this control's only dispatch key and the
   * search owns it — there is no second Enter to give `action`, and inventing a
   * second submit gesture is a keybinding no combobox pattern sanctions. **On a
   * searching lookup, put the submit on a `ButtonNode`.**
   *
   * **There is NO minimum-character gate**, deliberately. **An EMPTY query is a
   * legitimate query and IS dispatched**, so an app may answer it with
   * most-recently-used candidates rather than nothing (Salesforce's picker
   * `searchType` defaults to `Recent`).
   *
   * Omitted = no search; the field is a plain id input.
   */
  searchAction?: ActionEvent;
  /**
   * LOOKUP INPUTS ONLY (Phase 21, LOOK-06). The **declared** custom-entry axis:
   * may the user commit a value that isn't one of the offered candidates?
   *
   * **Never inferred from behavior.** *Choosing somebody to mention* is very
   * different from *inventing a new tag* — different ACTS sharing one widget —
   * so the control DECLARES which it is doing rather than leaving it to be
   * guessed from what the user typed.
   *
   * An invented value stays a homogeneous {@link LookupItem}, **never a bare
   * string**, so no `LookupItem | string` union ever arises. MUI's `multiple +
   * freeSolo` yields exactly that heterogeneous union — forcing every consumer
   * to branch on `typeof`, and their own docs warn it *"may cause type
   * mismatch."* We never admit a bare string, so it cannot happen here. A
   * free-form tag is simply a value whose label equals itself (and is therefore
   * omitted — see {@link LookupItem}).
   *
   * ⇒ `allowCustom: true` + no `candidates` + labels omitted **is a free-form
   * tags input, with NO special case in the renderer.** This supersedes the
   * separately-designed `inputType: "tags"` proposal.
   *
   * 🚨 **Do NOT combine with {@link FieldNode.searchAction} — it is UNSUPPORTED
   * in v1 and warns `[vms:lookup-ambiguous-enter]`.** Type "urgent", press
   * Enter: invent the tag, or search for it? Both are legitimate readings of the
   * same keystroke, and no precedence serves both (invent-first starves the
   * search; search-first starves invention forever) — that there is no good
   * ordering is the tell that the shape is wrong, so v1 does not guess.
   * Suggestions on a tags field are deferred, exactly as the parked `tags`
   * design already deferred them. Declaring both ignores `allowCustom`.
   *
   * Whether a given value was picked or invented is **server-decidable** — the
   * server produced every candidate it ever offered, so it can test the id
   * against its own id space. There is deliberately no wire marker for
   * provenance (no `__isNew__`): react-select needs one because it is
   * client-only and has no server to ask; we have a server. The explicitness
   * this decision demands is satisfied by `allowCustom` being a declared axis on
   * the node — the app declares the act — not by a per-value flag.
   *
   * Omitted = false (custom entries rejected; only offered candidates commit).
   */
  allowCustom?: boolean;
  // DESIGNED AND DELIBERATELY DEFERRED (Phase 21, OPEN-1) — `textArrangement`,
  // a closed `"text" | "text-id" | "id-text"` enum adopted from SAP's
  // `UI.TextArrangement`, answering "does the user see 'Sally Omer', the raw
  // id, or both?" (default `"text"` = label only; SAP annotates its equivalent
  // "e.g. for UUIDs", i.e. when the id is noise). It is NOT an oversight and it
  // is NOT unresolved: the enum is fully designed, and it is purely additive, so
  // shipping it later costs nothing and breaks nothing. It is out of v1 because
  // v1's surface is already large (two inputTypes, five fields, a new dispatch
  // cadence, a chips a11y contract) and no v1 proof needs the id rendered beside
  // the label. Add it when an app actually needs to surface a meaningful id (an
  // order number, a SKU, a ticket ref) — not before.
  // SAP's `TextSeparate` (code here, text rendered somewhere else entirely) is
  // permanently out of scope: it is a layout intent no {label,value} pair can
  // carry.
  /** Optional language hint for `inputType: "code"`. Emitted as a class
   *  (`vms-field--code-{language}`) so apps can attach a syntax-highlighter
   *  library (CodeMirror, Monaco, etc.) — the framework only ships
   *  monospaced editable text, no coloring. */
  language?: string;
  /** Dispatched when Enter is pressed (text-like inputs only). Carries an
   *  action name only — the current value is already in state at the bind path. */
  action?: ActionEvent;
  /** FILE INPUTS ONLY. The action name(s) whose dispatch carries this file's
   *  binary over the multipart wire. A file rides an action iff that action's
   *  name is listed here — declared on the *file*, so which trigger sends it no
   *  longer depends on where a button sits (the trigger can live anywhere in the
   *  form; footer `buttons[]`, `children`, submit, and Enter all honor this
   *  equally). An absent or empty `uploadOn` means the file rides **nothing**
   *  (there is no positional fallback); the browser warns `[vms:orphan-file]`
   *  when a file is picked with no `uploadOn`. Ignored on non-file inputs. */
  uploadOn?: string[];
}

export interface CheckboxNode {
  type: "checkbox";
  name: string;
  /** Path into state where this input reads its current value and writes user changes (e.g. `fields.title`). */
  bind: string;
  label?: string;
  /** Dispatched immediately on change. Carries an action name only — the new
   *  checked value is already in state at the bind path. */
  action?: ActionEvent;
}

export interface ButtonNode {
  type: "button";
  label: string;
  action: ActionEvent;
  /** Visual emphasis (how loud) — `primary` = filled, `secondary` = outline. Orthogonal to `tone` and `size`. Emits .vms-button--{emphasis}. Omitted = the neutral default button. Closed union. */
  emphasis?: "primary" | "secondary";
  /** Semantic intent/severity (what it means) — the universal status color axis, orthogonal to `emphasis`. A destructive primary button is `emphasis:"primary"` + `tone:"danger"`. Emits .vms-button--{tone}. Omitted = neutral. Closed union. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Box geometry (padding + font), orthogonal to color/emphasis — the one axis no design system bakes into variant. Emits .vms-button--{size}. Omitted = the default (md) size. Closed union. */
  size?: "sm" | "lg";
  /** Width axis — `"full"` stretches the button to fill its container's cross
   *  axis (the standard full-width / "block" button: MUI `fullWidth`, Ant
   *  `block`, Chakra `width="full"`). Emits `.vms-button--full`. Omitted/`"auto"`
   *  = content-width (the default hug). Orthogonal to emphasis/tone/size. */
  width?: "auto" | "full";
  /** Disables the button — greys it out (`.vms-button--disabled` + native
   *  `disabled`) and the renderer will NOT dispatch its action on click.
   *  Server-owned (e.g. a submit gated on a precondition). Omitted = enabled. */
  disabled?: boolean;
  /** Transient label shown from click until the dispatch resolves (response
   *  arrives or dispatch errors). Mirrors `CopyButtonNode.copiedLabel`'s
   *  lifecycle pattern at a different beat: shown DURING the round-trip
   *  rather than AFTER it. The adapter additionally adds `.vms-button--pending`
   *  while in this state so the button visibly disables (cursor + opacity).
   *  Omitted = no pending feedback (existing instant-click behavior). */
  pendingLabel?: string;
  /** Optional confirmation question for a destructive/irreversible action
   *  (delete, reset, archive). When set, the BrowserAdapter shows a NATIVE
   *  browser confirm dialog with this message on click; the action dispatches
   *  only if the user accepts, and Cancel suppresses it entirely (no dispatch,
   *  no pendingLabel swap). Deliberately NATIVE, not a framework-drawn dialog:
   *  it adds ZERO app or framework state (no modal in the tree, nothing to
   *  round-trip or tear down) and its OS-native, deliberately-jarring look
   *  reinforces "this one is serious — stop." It is a CLIENT-ONLY human
   *  affordance: an agent dispatches the action directly over the wire and is
   *  never gated by it (the confirm exists only at browser render time). The
   *  TUI has no confirm() and dispatches as normal. Omitted = instant dispatch. */
  confirm?: string;
}

/** One inline run — a contiguous piece of text inside a paragraph, carrying
 *  intra-paragraph emphasis and/or a link target. The unit of VMS's inline
 *  rich-text vocabulary (`TextNode.runs`, `DiffCell.runs`).
 *
 *  ## Why a FLAT run list and not a nested inline tree
 *  A nested model (`strong(em(x))`) has combinatorially MANY encodings of one
 *  visual result — `strong(em(x))` vs `em(strong(x))`, `strong("a"),strong("b")`
 *  vs `strong("ab")`. VMS keeps its two backends honest by STRUCTURALLY DIFFING
 *  the JSON they produce (`parity/`), so a model where two backends can be
 *  equally correct yet compare as different defeats the whole gate. A flat run
 *  list has exactly ONE encoding per result, which keeps that diff meaningful.
 *  (Every system surveyed for this design has a SINGLE implementation, so none
 *  of them ever had to care — this constraint is ours alone. Note also that a
 *  nested model needs a style-INHERITANCE/merge rule implemented identically in
 *  TS and C#; two independent cascades diverging silently is exactly the failure
 *  class we cannot detect.)
 *
 *  ## Why boolean flags and not a `marks: Mark[]` array
 *  NOT because an array has order — a SORTED array is equally canonical, so that
 *  argument does not distinguish them. The real reason: `href`/`external` are
 *  already PARAMETERIZED marks living in this same record, so the model is
 *  inherently a hybrid — valueless marks as flags, parameterized marks as named
 *  fields. A `Mark[]` array would have to become an array of OBJECTS to carry a
 *  link target, at which point it is a worse nested model.
 *
 *  **Extension policy (follow it, don't re-argue it):** a new VALUELESS mark
 *  becomes a new optional flag here; a new PARAMETERIZED mark becomes a named
 *  field, exactly as `href` did. A different string-valued field that later wants
 *  rich text gains a SIBLING optional `runs` field (as `DiffCell` did) — NEVER a
 *  union type on the wire.
 *
 *  ## Flags are typed `true`, not `boolean`, on purpose
 *  `bold?: boolean` would admit an explicit `bold: false`, which is NOT null, so
 *  `parity/normalize.ts` would not drop it and `findNulls` would not flag it —
 *  giving two wire encodings of "not bold" and a fresh cross-backend drift class
 *  (gotcha #8's family). Typed `true`, `false` is unrepresentable and ABSENT is
 *  the only encoding of "off", matching the .NET twin's
 *  `bool Bold = false` + `WhenWritingDefault`.
 *
 *  ## A run carries NO action — `href` only, and that is STRUCTURAL
 *  A type needs an arm in `collectActions` (server.ts) / `ViewTreeValidation.Collect`
 *  (.NET) iff it holds child nodes or an action. `InlineRun` holds NEITHER, so
 *  ZERO walker changes are needed on either backend — the requirement disappears
 *  structurally rather than having to be remembered. That matters because a
 *  missing walker arm fails SILENTLY on both sides and nothing gates walker
 *  parity (see the live `tracker-net-walker-gap` note in ViewModels.cs).
 *  ⚠️ **If this record ever gains an `action`, BOTH walkers need an arm.**
 *  Markdown links are always plain addresses, so dispatch buys the driving use
 *  case nothing; a dispatching inline element is a separate, deliberate feature. */
export interface InlineRun {
  /** The run's literal text. Always rendered via textContent — never as HTML. */
  text: string;
  /** Bold emphasis → `<strong class="vms-text__strong">`. */
  bold?: true;
  /** Italic emphasis → `<em class="vms-text__em">`. */
  italic?: true;
  /** Inline code → `<code class="vms-text__code">`. A SEMANTIC run, not a font
   *  knob: for a whole monospace/preformatted block use `TextNode.style:"pre"`. */
  code?: true;
  /** Struck text → `<s class="vms-text__strike">`. Distinct from
   *  `TextNode.style:"strikethrough"`, which strikes the WHOLE node AND recolors
   *  it to the muted "done" tone. This one is emphasis only and never recolors,
   *  so the two are not interchangeable. Run flags are additive, never subtractive:
   *  a run cannot UN-strike itself inside a struck node. */
  strike?: true;
  /** Link target → wraps the run in `<a class="vms-text__link">`. Presence alone
   *  makes this run a link; there is no `kind` discriminator (shape carries the
   *  meaning, same as `DiffRow`), so a label can never disagree with the content.
   *  ⚠️ ADJACENT runs sharing an IDENTICAL `href` + `external` coalesce into
   *  exactly ONE anchor — otherwise "a link containing a bold word" would render
   *  as two anchors, i.e. two tab stops and two screen-reader announcements.
   *  Emits `.vms-text__link`, NOT `.vms-link` — the latter is `display:inline-block`
   *  + `align-self:flex-start` (correct for a standalone LinkNode that is a flex
   *  child of a section, WRONG inside flowing text, where it breaks line wrapping). */
  href?: string;
  /** true = open outside the current app context (browser: new tab + noopener).
   *  Only meaningful alongside `href`; ignored without it. */
  external?: true;
}

export interface TextNode {
  type: "text";
  /** The plain-text reading of this node. REQUIRED and unchanged — it does three
   *  jobs at once: (1) the rendering when `runs` is absent, (2) the FALLBACK for
   *  any adapter that does not implement runs (the TUI renders this verbatim and
   *  needed no change for inline rich text), and (3) the agent-legible form — an
   *  agent reads the sentence straight off the wire without reassembling runs.
   *
   *  When `runs` is present, `value` SHOULD be the concatenation of the run texts
   *  — use the `richText()` helper (server subpath) / `TextNode.FromRuns(...)` (.NET)
   *  to DERIVE it rather than typing the text twice. Nothing enforces this at
   *  runtime, deliberately: enforcing it would criminalize the legitimate
   *  degradation pattern (spelling a URL out in `value` while `runs` carries a
   *  proper link, so link-less adapters still show the target), and a validator
   *  would give `TextNode` a walker arm on both backends — reintroducing the very
   *  asymmetric-walker risk the no-actions rule above eliminates. The framework's
   *  own reference usage is gated in CI (`parity/fixtures/feature-probe.json`)
   *  instead. A mismatch is not ambiguous — the renderer's rule is unconditional
   *  — it just means browser readers and agent/TUI readers see different text. */
  value: string;
  /** OPTIONAL inline rich-text runs. When present the BrowserAdapter draws these
   *  INSTEAD of `value`; when absent, rendering is byte-identical to before runs
   *  existed (a plain `<span>` with `value` as its only text node), so this field
   *  is fully backward compatible for every existing consumer.
   *
   *  Scope note: runs are carried by `TextNode` and `DiffCell`. Everything that
   *  holds `ViewNode[]` children (list items, sections, pages, modals, form
   *  bodies) gets rich text for free by nesting a TextNode. `TableRow.cells` is
   *  deliberately NOT covered — cells are a flat `Record<string,string>`, so
   *  enriching them changes what a cell IS rather than adding a field, and that
   *  is a separate design call (likely a purpose-built content-table primitive
   *  rather than overloading the data-grid TableNode). Leaf label fields
   *  (button/badge/breadcrumb/tab labels) are deliberately NOT covered either —
   *  markdown never produces emphasis inside a control label. */
  runs?: InlineRun[];
  /** Semantic outline level (1–6). When set, the renderer emits a real
   *  `<h1>`–`<h6>` HTML tag instead of the default `<span>`, giving screen
   *  readers the correct heading landmark and giving agents an unambiguous
   *  semantic signal from the DOM tag itself (not just a class name). Closed
   *  union — the compile-time check keeps this in the intended range; the
   *  renderer additionally clamps at runtime and falls back to `<span>` for
   *  out-of-range values, so wire drift from a less-strictly-typed backend
   *  cannot produce an invalid `<h7>` element.
   *
   *  Composes with `runs`, `tone`, and `style` orthogonally: `{ level: 2,
   *  tone: "danger" }` is an `<h2>` in the danger color; `{ level: 3, runs: [
   *  { text: "Section ", bold: true }, { text: "one" } ] }` is an `<h3>`
   *  whose content contains a bold run.
   *
   *  Precedence when both `level` and `style: "pre"` are set: `level` wins
   *  (semantic outline beats typography role). Don't set both — they name
   *  different content shapes; the rule is only a defensive tie-breaker. */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Typography role only (NOT color) — emits .vms-text--{style}. Semantic color moved to `tone` (the old `error`/`warning` style values are now `tone:"danger"`/`tone:"warning"`). Closed union.
   *  Orthogonal to `runs`: `style` is the NODE-level typography role, `runs` is
   *  intra-paragraph emphasis. Uniform emphasis over a whole paragraph should use
   *  `style` and omit `runs` entirely. With `style:"pre"` the runs nest inside the
   *  `<pre>` and its `white-space: pre` still applies.
   *
   *  @deprecated `"heading"` and `"subheading"` remain SUPPORTED for backward
   *  compatibility but new code should use the `level` axis above instead.
   *  Level emits real semantic `<h1>`–`<h6>` tags; these style values only
   *  produce a `<span class="vms-text--heading">` with no landmark semantics. */
  style?: "heading" | "subheading" | "body" | "muted" | "strikethrough" | "pre";
  /** Semantic intent/severity color — the universal status tone axis, orthogonal to `style` (a heading can be `tone:"danger"`). Emits .vms-text--{tone}; the tone color wins over a `style` color via source order. Omitted = default text color. Closed union.
   *  A run's `href` colors as a link (`.vms-text__link`) even inside a toned node —
   *  a link that does not look like a link is worse than a tone that does not reach. */
  tone?: "danger" | "warning" | "success" | "info";
}

/** Build a TextNode from inline runs, DERIVING `value` as the concatenation of
 *  the run texts so the plain reading and the rich reading cannot disagree.
 *  Prefer this over writing `value` by hand whenever you set `runs` — a
 *  hand-written pair is the one way this feature can lie, and both backends would
 *  agree with each other while telling a human and an agent different things.
 *  (The .NET twin is `TextNode.FromRuns(...)`.)
 *
 *  Build the object literal directly, NOT via this helper, for the deliberate
 *  divergence case — e.g. spelling a URL out in `value` so that adapters which
 *  cannot draw a link still show the target. That case is legitimate and is
 *  exactly why the match is a documented SHOULD rather than a runtime check. */
export function richText(
  runs: InlineRun[],
  opts?: { style?: TextNode["style"]; tone?: TextNode["tone"] },
): TextNode {
  return {
    type: "text",
    value: runs.map((r) => r.text).join(""),
    runs,
    // Conditional spread, not `style: opts?.style` — an explicit `undefined`
    // would emit `"style": null` on some serializers and break the
    // absent-never-null wire contract (gotcha #8).
    ...(opts?.style ? { style: opts.style } : {}),
    ...(opts?.tone ? { tone: opts.tone } : {}),
  };
}

export interface LinkNode {
  type: "link";
  label: string;
  href: string;
  /** true = open outside current app context (browser: new tab + noopener) */
  external?: boolean;
  /** true = this link points at the current location (nav "you are here").
   *  Emits `.vms-link--active` + `aria-current="page"`. Server-owned: the
   *  backend decides which nav item is active from its route/state, exactly
   *  like every other view decision — there is no client-side route matching. */
  active?: boolean;
}

/** One crumb in a BreadcrumbNode trail. Mirrors LinkNode's nav model:
 *  `href` = browser navigation (`external` ⇒ new tab + noopener, exactly like
 *  LinkNode); `action` = a server dispatch instead of a URL (the VMS-native
 *  navigate-by-state path). There is NO per-item "current" flag — position is
 *  the signal: the LAST item in `items` is auto-rendered as the current page
 *  (non-clickable, `aria-current="page"`), so it needs neither `href` nor
 *  `action`. A crumb that carries `action` is a dispatch-bearing descendant, so
 *  the action-name uniqueness walk descends into it (see collectActions). */
export interface BreadcrumbItem {
  /** Visible crumb text (required). */
  label: string;
  /** Browser navigation target. Omit on the last (current) crumb. */
  href?: string;
  /** true = open outside the current app context (browser: new tab + noopener),
   *  exactly like LinkNode.external. Only meaningful alongside `href`. */
  external?: boolean;
  /** Server dispatch instead of a URL — the VMS navigate-by-state alternative to
   *  `href`. Its name is uniqueness-checked by the tree validator. */
  action?: ActionEvent;
}

/** A breadcrumb trail — an ordered list of labelled positions from the site/app
 *  root to the current page. The framework owns ALL appearance and a11y (never
 *  on the wire): it draws the `<nav aria-label="breadcrumb">` landmark, the
 *  `<ol>`, `aria-current="page"` on the last item, and a FIXED separator between
 *  items (the one appearance knob other frameworks expose stays framework-drawn
 *  here — cf. DividerNode's framework-drawn separator). The wire carries only the
 *  ordered labels + their nav targets. */
export interface BreadcrumbNode {
  type: "breadcrumb";
  /** Ordered root→current list. The LAST entry is the current page (auto
   *  non-clickable); earlier entries navigate via `href` or `action`. */
  items: BreadcrumbItem[];
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
  /** Optional caption text. When present, the image and its caption are drawn
   *  together as a `<figure><img><figcaption>` unit — the standard HTML pattern
   *  screen readers announce as a single captioned figure. When absent, the
   *  rendering is byte-identical to the pre-caption output (a bare `<img>`).
   *  Maps to markdown's `![alt](src "caption")` third-argument title. */
  caption?: string;
  /** OPTIONAL inline rich-text runs for the caption. Same contract as
   *  `TextNode.runs`: when present, the BrowserAdapter draws these INSTEAD of
   *  `caption`; when absent, the plain `caption` string renders. Meaningless
   *  without `caption` (used as the fallback + agent-legible plain reading);
   *  the renderer ignores `captionRuns` if `caption` is missing. */
  captionRuns?: InlineRun[];
}

export interface StatBarNode {
  type: "stat-bar";
  stats: Array<{
    label: string;
    /** The stat's value. Typed `string` (not `string | number`) so the TS and
     *  .NET backends emit BYTE-IDENTICAL wire — a bare number would serialize as
     *  JSON `12` in TS but the .NET twin's `string Value` can only emit `"12"`,
     *  a real cross-backend drift the parity suite never exercised. Format the
     *  number server-side (`String(n)`, `n.toFixed(2)`, `$${n}`) — the value is
     *  display text, and any formatting an app wants is richer than a bare
     *  number anyway. (Narrowed in 6.0.0 — see CHANGELOG; the field was unused.) */
    value: string;
    /** Optional semantic status tone for this tile — the universal status color
     *  axis (same closed set as Section/Button/ListItem/TableRow). Renders the
     *  tile as a subtly tinted chip (surface tint + colored border, reusing the
     *  --vms-error/-warning/-success/-info tokens), so an unhealthy stat reads at
     *  a glance rather than via one small line of text. Omitted = today's neutral
     *  inline stat. Closed union. */
    tone?: "danger" | "warning" | "success" | "info";
  }>;
}

export interface TabsNode {
  type: "tabs";
  selected: string;
  /** Path into state where this input reads its current value and writes user changes (e.g. `fields.title`). */
  bind: string;
  /** Each tab declares its own action — the framework requires a unique action
   *  name per tab (e.g. `select-tab-pending`, `select-tab-active`). The renderer
   *  writes `value` to the bound state path before dispatching the action. */
  tabs: Array<{ value: string; label: string; action: ActionEvent }>;
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
  /** Click-anywhere row dispatch primitive. When set, the renderer makes the
   *  entire row clickable AND keyboard-activatable (Enter / Space — Space
   *  preventDefaults page scroll) AND exposes accessibility (role="button",
   *  tabindex=0, aria-label derived from cell text). Per-row identity is
   *  encoded in the action name (e.g. `select-ticket-42`) — no context field,
   *  consistent with the Phase 6 wire. Coexists with `actions[]`: clicking a
   *  per-row button, checkbox, or cell linkLabel anchor does NOT also fire
   *  `row.action` (the renderer stops propagation on those targets). */
  action?: ActionEvent;
  /** Per-row interactive controls. Each entry is either a ButtonNode (its own
   *  unique action name encodes per-row identity, e.g. `delete-row-42`) or a
   *  CheckboxNode (its own `bind` path per row). The renderer partitions by
   *  `entry.type`: CheckboxNodes render in a dedicated LEADING column (left —
   *  the data-grid selection convention), ButtonNodes in the TRAILING actions
   *  cell (right). A previous version typed this as `ButtonNode[]` and called
   *  the button renderer blindly, silently dropping non-button entries. */
  actions?: (ButtonNode | CheckboxNode)[];
  /** Row lifecycle STATE (NOT severity — that's `tone`). A freeform, app-extensible token; the framework ships styling for `done`, `disabled`, `running`. Emits .vms-table__row--{state}. Orthogonal to `tone`.
   *  APPEARANCE ONLY — `state` dims/tints the row and NEVER affects clickability or the cursor. Clickability is governed solely by `action`: a `state:"disabled"` row that ALSO sets `action` is dimmed AND still clickable (pointer cursor + hover + role=button), e.g. an already-paid invoice line shown muted but still openable for details. To make a row literally non-clickable, omit `action` (optionally still dim it with `state`). */
  state?: string;
  /** Semantic intent/severity — the universal status tone axis (closed). Emits .vms-table__row--{tone} (subtle tinted row background, reusing the shared tokens). Omitted = neutral. */
  tone?: "danger" | "warning" | "success" | "info";
}

export interface TablePagination {
  /** 1-based current page. */
  page: number;
  /** Rows per page. Drives the "X–Y of N" range label and the last-page calc. */
  pageSize: number;
  /** Total rows across all pages — server-truth. The adapter renders the range
   *  label and enables/disables prev/next from this; it does NOT slice. */
  totalRows: number;
  /** Dispatched on the prev page-control click. Carries an action name only —
   *  the renderer writes the target page to TableNode.paginationBind before dispatch. */
  prevAction?: ActionEvent;
  /** Dispatched on the next page-control click. Carries an action name only —
   *  the renderer writes the target page to TableNode.paginationBind before dispatch. */
  nextAction?: ActionEvent;
  /** Dispatched when the user submits a typed target page via the jump-to-page
   *  control's Go button or Enter key. The renderer clamps the typed value into
   *  [1, totalPages] before writing it to TableNode.paginationBind and dispatching —
   *  same mechanism as prevAction/nextAction. Omitted = no jump control renders. */
  jumpAction?: ActionEvent;
}

export interface TableNode {
  type: "table";
  columns: TableColumn[];
  rows: TableRow[];
  /** Path into state where the current sort intent (`{column, direction}`) is read/written. */
  sortBind?: string;
  /** Per-column filter input bind paths. The renderer reads/writes filter
   *  values at these paths; the values then travel with the next dispatch. */
  filterBinds?: Record<string, string>;
  /** Path into state where the renderer writes the target page number before
   *  firing `pagination.prevAction` / `pagination.nextAction`. */
  paginationBind?: string;
  /** Per-column sort header click actions, keyed by column key. Each carries a
   *  unique action name — the renderer writes the new sort intent to `sortBind`
   *  before dispatching. */
  sortActions?: Record<string, ActionEvent>;
  /** One filter-dispatch action per table. The renderer fires this when the
   *  user submits the filter form; per-column filter values are already in
   *  state at the `filterBinds` paths. */
  filterAction?: ActionEvent;
  /** Server-driven pagination. When set, the adapter renders an "X–Y of N"
   *  range + prev/next controls below the table. **The server slices `rows` to
   *  the current page** — the adapter never paginates client-side (that would
   *  break for DB-backed tables, which are most of them). By convention
   *  filter dispatches reset `page` to 1 on the server side, since
   *  the row window changes underneath them. */
  pagination?: TablePagination;
  /** Visible-scoped bulk-action toolbar (opt-in). When set, the adapter renders
   *  `selection.buttons[]` ABOVE the table; each button, on click, harvests the
   *  currently-CHECKED, currently-RENDERED row ids (from the leading-column
   *  per-row checkboxes) and writes them — a `string[]` of `TableRow.id` — to
   *  `selection.harvestBind`, OVERWRITING, before dispatching its own action.
   *  The server reads that path to act, so a bulk action can only ever affect
   *  rows the user can currently see: a row selected under one filter and then
   *  filtered/paginated out of view is NOT harvested. This is the safe default
   *  for the common case; an app that genuinely wants cross-page/persistent
   *  selection simply ignores this block and reads its own bound `selectedIds`
   *  map instead (the framework never introspects app state, so that escape
   *  hatch is always open). Selectable rows must carry `TableRow.id`. */
  selection?: TableSelection;
}

/** Visible-scoped bulk-action toolbar for a `TableNode` — see `TableNode.selection`. */
export interface TableSelection {
  /** Bulk-action buttons rendered above the table. On click, each harvests the
   *  visible-checked row ids into `harvestBind` (overwriting) and dispatches its
   *  own `action` — name-only, per the Phase-6 wire. Full ButtonNodes, so they
   *  carry their own emphasis/tone/confirm/disabled. */
  buttons: ButtonNode[];
  /** State path the harvest writes the visible-checked row-id array (`string[]`)
   *  to right before dispatch. The server reads THIS to act — not a per-row
   *  `selectedIds` map — which is what makes the action visible-scoped. */
  harvestBind: string;
}

export interface CopyButtonNode {
  type: "copy-button";
  /** The plain-text string written to the clipboard on click. Always the
   *  `text/plain` representation and the universal fallback: it is what a plain
   *  destination (a code box, a terminal, a plain-text field) receives, and what
   *  is copied when neither rich-copy route below applies. Required. */
  text: string;
  /** RICH COPY — harvest route (adapter-side, the default; no server authoring).
   *  The DOM id of an already-rendered region to copy. On click the adapter reads
   *  that element's rendered markup as the `text/html` representation and its plain
   *  text as `text/plain`, writing BOTH to the clipboard at once — so a paste into a
   *  formatted destination (email, doc) keeps its structure while a plain
   *  destination still gets clean text. The framework carries its look in
   *  class-keyed styling rather than inline, so the app's theme naturally falls away
   *  on paste and the *semantic structure* (headings, tables, bold, lists) survives —
   *  the desired outcome, achieved by the conventional native-copy mechanism (the
   *  destination sanitizes; the framework invents no cleaning pass). The target must
   *  be a described region carrying an emitted DOM id (e.g. `SectionNode.id`,
   *  `ListNode.id`); because ids only live on described nodes, this can never point
   *  at undescribed chrome, so the intent stays fully readable from the wire. Point
   *  it at a *content* region, not one containing this button. If the id resolves to
   *  no element the adapter fails LOUD (console error) and falls back to writing
   *  `text` — never a silent dead button. Absent = no harvest.
   *  Precedence: `copyTargetId` > `html` > plain `text`. */
  copyTargetId?: string;
  /** RICH COPY — server-provided route (opt-in). A ready-made formatted
   *  representation the server authored, written as `text/html` alongside `text`
   *  (`text/plain`). Reach for this only when the content to copy is NOT already
   *  rendered on the page (a cleaner or richer export than what's shown) — otherwise
   *  prefer `copyTargetId`, which authors nothing. This is a WRITE-ONLY clipboard
   *  export bound for a foreign destination; it never re-enters the rendered view
   *  (that would be decoration and is forbidden). Ignored when `copyTargetId` is set.
   *  Absent = no server-provided rich representation. */
  html?: string;
  /** Label shown on the button before copying. Adapter default: "Copy". */
  label?: string;
  /** Ephemeral label shown after a successful copy, reverts after ~1.5 s. Adapter default: "Copied!". */
  copiedLabel?: string;
  /** Visual emphasis — mirrors ButtonNode.emphasis. `primary` = filled, `secondary` = outline. Emits .vms-button--{emphasis}. Closed union. */
  emphasis?: "primary" | "secondary";
  /** Semantic intent/severity — mirrors ButtonNode.tone. Emits .vms-button--{tone}. Closed union. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Box geometry — mirrors ButtonNode.size. Emits .vms-button--{size}. Omitted = md. Closed union. */
  size?: "sm" | "lg";
  /** Width axis — `"full"` stretches the button to fill its container's cross
   *  axis (the standard full-width / "block" button: MUI `fullWidth`, Ant
   *  `block`, Chakra `width="full"`). Emits `.vms-button--full`. Omitted/`"auto"`
   *  = content-width (the default hug). Orthogonal to emphasis/tone/size. */
  width?: "auto" | "full";
}

/**
 * A first-class "nothing here" presentation — the empty-state primitive
 * (MUI/Ant `<Empty>`, the standard zero-data placeholder). A centered block
 * with a required heading, an optional supporting message, and an optional
 * call-to-action ButtonNode (e.g. "Create your first ticket"). No icon field —
 * the framework ships no icon set.
 *
 * The `action` ButtonNode carries a real action name and is a dispatch-bearing
 * descendant, so EVERY tree-walk (action-name uniqueness collector, section
 * shape validator) descends into it — exactly like `modal.footer` / `fits`
 * candidates / `section.action`. A missed walk would silently exempt the CTA
 * from the one-name-one-operation rule.
 */
export interface EmptyStateNode {
  type: "empty-state";
  /** The primary line — what's missing / what to do. Required. */
  heading: string;
  /** Optional supporting line below the heading. */
  message?: string;
  /** Optional call-to-action button (e.g. "Add the first item"). */
  action?: ButtonNode;
}

/**
 * A compact status pill / count — the badge primitive (MUI/Ant `<Badge>`,
 * `<Tag>`). A leaf inline node (no children, no action) for a short label or
 * count that appears inside text/section/list/table contexts. Appearance is
 * the universal `tone` (semantic color) + `emphasis` (filled vs outline) axes,
 * matching the rest of the framework's appearance vocabulary.
 */
export interface BadgeNode {
  type: "badge";
  /** The pill text — a short label or count (e.g. "New", "3", "Beta"). */
  label: string;
  /** Semantic intent/severity — the universal status tone axis. Emits
   *  .vms-badge--{tone}. Omitted = neutral. Closed union. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Visual weight — `primary` = filled solid tone, `secondary` = outline.
   *  Mirrors ButtonNode's emphasis semantics. Emits .vms-badge--{emphasis}.
   *  Omitted = the default filled tint. Closed union. */
  emphasis?: "primary" | "secondary";
}

/**
 * The SwiftUI `ViewThatFits` port. The renderer picks the FIRST child whose
 * intrinsic size FITS the available container (no axis overflow), else the next,
 * else the LAST child as the guaranteed-fits fallback — container-relative
 * responsive SELECTION decided CLIENT-SIDE at layout time via real measurement,
 * with zero viewport breakpoints. Generalizes the `split`→`stack` collapse to
 * arbitrary alternatives (e.g. a wide toolbar `row` first, a compact stacked
 * `switcher` last).
 *
 * Children ordering convention (load-bearing): candidates are ordered
 * preferred/widest FIRST → safe-fallback/narrowest LAST. Same direction as
 * SwiftUI `ViewThatFits`.
 *
 * This is the ONE primitive that is NOT pure CSS — the selection requires real
 * layout measurement and therefore lives ENTIRELY in `BrowserAdapter`
 * (`browser.ts`), never in platform-agnostic core. The renderer measures each
 * candidate's INTRINSIC (max-content / ideal, unwrapped) size in an off-screen
 * probe and picks the first whose intrinsic size fits the container's available
 * box — NOT its constrained rendered size, because a flex-wrap candidate shrinks
 * to fit any width and would always appear to "fit". A `ResizeObserver` re-runs
 * the selection on resize. In any no-layout context (TUI, SSR, jsdom,
 * `clientWidth === 0`) it degrades to rendering the LAST (safe-fallback) child.
 *
 * ⚠️ SCOPE: `fits` is for selecting between layouts whose intrinsic width is
 * BOUNDED and meaningful — a toolbar row vs. a stacked menu, icon-only vs.
 * icon+label controls, a compact vs. full control cluster. It is NOT the tool
 * for text-heavy multi-column page layouts: a paragraph's max-content width is
 * "all text on one line" (effectively unbounded), so measuring it is not
 * meaningful. For list/detail and similar text panes use `split` / `sidebar`,
 * which collapse to a single column intrinsically on their own (zero @media).
 */
/** A thematic break / separator (#22) — the standard divider primitive (MUI/Ant
 *  `<Divider>`, Radix `<Separator>`). Horizontal (default) renders an `<hr>` with
 *  its implicit `role="separator"`; vertical renders a `role="separator"` div with
 *  `aria-orientation="vertical"` for row layouts. No content. */
export interface DividerNode {
  type: "divider";
  orientation?: "horizontal" | "vertical";
}

/** A quoted block of content — the standard blockquote primitive. Holds
 *  arbitrary block-level `children` (paragraphs, lists, nested blockquotes,
 *  any ViewNode). Renders as a real semantic `<blockquote>` element, the
 *  standard HTML landmark screen readers and outline tools treat as a quote.
 *  Maps to markdown's `> ...` construct.
 *
 *  Chosen as a dedicated primitive (not a `SectionNode.variant`) because
 *  section variants describe surface KIND (card, etc.) — blockquote is a
 *  semantic content KIND, and mixing the two axes blurs concepts. And chosen
 *  as a children-bearing node (not a `TextNode.style`) because quotes hold
 *  block-level content, not just formatted text.
 *
 *  `children` is a dispatch-bearing descendant path — the walker arms in
 *  `server.ts` (collectActions) and `ViewModels.cs` (Collect) MUST descend
 *  into it so buttons/actions inside a quoted callout participate in the
 *  action-name uniqueness check. */
export interface BlockquoteNode {
  type: "blockquote";
  children: ViewNode[];
}

export interface FitsNode {
  type: "fits";
  /** Axis on which the container's fit is tested. CLOSED union; OMITTED =
   *  `"horizontal"` (the dominant case: pick the widest layout that fits the
   *  available WIDTH). `"horizontal"` tests width overflow, `"vertical"` tests
   *  height overflow, `"both"` tests EITHER axis. The renderer treats an absent
   *  `axis` as `"horizontal"`. */
  axis?: "horizontal" | "vertical" | "both";
  /** Ordered candidate list. ORDERING CONVENTION (load-bearing — document
   *  prominently): candidates are ordered **preferred/widest FIRST →
   *  safe-fallback/narrowest LAST**, the same direction as SwiftUI
   *  `ViewThatFits`. The renderer picks the FIRST candidate whose intrinsic
   *  size fits the container on `axis` (no overflow); the LAST candidate is the
   *  guaranteed-fits fallback rendered when none fit. */
  children: ViewNode[];
}

export interface ChartSeries {
  /** Series name — rendered in the legend and read by agents to identify the series. */
  name: string;
  /** Values aligned by index to the chart's `labels`: data[i] is the value at labels[i]. */
  data: number[];
  /** OPTIONAL semantic tone from the existing closed tone axis. When set, this series is
   *  drawn in the theme's tone token (danger→--vms-error, etc.) instead of the next
   *  categorical-palette slot. For MEANING (a loss series → danger), not decoration.
   *  Omitted → framework assigns the next --vms-chart-N slot. NO raw color crosses the wire. */
  tone?: "danger" | "warning" | "success" | "info";
}

export interface ChartNode {
  type: "chart";
  /** Chart type. CLOSED union; OMITTED = "bar". Widened additively later (e.g. scatter) —
   *  consumers/agents key off `kind`, never assume a fixed set. The renderer treats an
   *  absent `kind` as "bar". */
  kind?: "bar" | "line" | "area" | "pie" | "donut";
  /** Shared category axis. labels[i] is the category for every series' data[i]. */
  labels: string[];
  /** One or more series over the shared `labels`. Single-series charts are just one entry.
   *  Multi-series charts share ONE x-axis (labels) — this is the honest encoding of that
   *  shared axis, and the shape every charting library uses. */
  series: ChartSeries[];
  /** bar/area only: stack series instead of grouping side-by-side. Omitted/false = grouped
   *  (ignored for line/pie/donut). */
  stacked?: boolean;
  /** Optional chart title rendered above the plot. */
  title?: string;
}

/** One stage in a StepsNode progression. Carries only display data — status
 *  (done/current/upcoming) is NEVER on the item; it DERIVES from the node's
 *  `current` index. */
export interface StepItem {
  /** Stage name (required). */
  label: string;
  /** Optional one-line supporting text shown beside/under the label. */
  description?: string;
  /** Optional semantic status tone for this step — the universal status color
   *  axis (same closed set as Section/Button/ListItem/TableRow). ORTHOGONAL to
   *  the done/current/upcoming state the framework DERIVES from `current`: tone
   *  overlays a semantic color onto the marker (e.g. a failed/blocked stage read
   *  as `danger`, a stage needing attention as `warning`) regardless of its
   *  position in the sequence. Omitted = the derived state's default appearance
   *  (accent for done/current, muted for upcoming). Because tone is app-authored
   *  status reinforced by the step's own label text, it is NOT color-only (same
   *  posture as Section tone). Closed union. */
  tone?: "danger" | "warning" | "success" | "info";
}

/** A discrete step / stepper / wizard progress indicator — an ordered list of
 *  stages with a single 0-based `current` index. Per-step status DERIVES from
 *  `current` (index < current = done, index === current = current, index >
 *  current = upcoming); there is NO per-step status field. The framework owns
 *  ALL appearance and a11y (never on the wire): numbered markers (check glyph
 *  for done), connector lines drawn marker-center to marker-center, the
 *  intrinsic horizontal→vertical reflow, and the discrete `aria-current="step"`
 *  a11y pattern (it is NOT `role="progressbar"`). The wire carries only the
 *  ordered labels + which one is current. */
export interface StepsNode {
  type: "steps";
  /** Ordered stages. */
  steps: StepItem[];
  /** 0-based index of the active step. Required — `0` is a meaningful value
   *  (the first step is current), so it always crosses the wire. */
  current: number;
  /** Layout INTENT (a closed enum, not a raw directive — the framework owns the
   *  actual layout + reflow). OMITTED = `"horizontal"`: the renderer treats an
   *  absent `orientation` as horizontal — a responsive strip that auto-stacks to
   *  vertical INTRINSICALLY when the container is narrow (zero viewport
   *  breakpoints). `"vertical"` = a deliberate vertical wizard (markers down the
   *  left, connector running down, descriptions beside each step). */
  orientation?: "horizontal" | "vertical";
}

/** One bucket in a TrackerNode strip — a single time slot's status. Carries only
 *  display data: the semantic state, an optional hover label, and an optional
 *  click-through action. */
export interface TrackerCell {
  /** Semantic status for this bucket. A CLOSED set specific to a status strip:
   *  `success` (good), `danger` (bad), `warning` (soft flag), `muted` (no data /
   *  no run this slot — the universal honest-uncertainty convention). Omitted =
   *  `muted`. NOTE the color axis differs from the rest of the framework on
   *  PURPOSE: a dense, color-ONLY strip must survive colorblindness by color
   *  alone, so the framework bakes a colorblind-safe palette where `success`
   *  renders BLUE (not the global green success tone), `danger` red, `warning`
   *  amber, `muted` gray — no "colorblind mode" needed. Only the rendered color
   *  diverges; the state NAME stays semantic on the wire (agent-legible). `info`
   *  is intentionally NOT a member — it would collide with `success`=blue and has
   *  no meaning in a pass/fail history. */
  state?: "success" | "danger" | "warning" | "muted";
  /** Optional hover label for this bucket (e.g. "2026-07-15 14:22 UTC · Success").
   *  Rendered as the cell's native tooltip AND its aria-label, so the strip's
   *  meaning is carried by TEXT, not color alone — the a11y + agent-legibility
   *  channel a color-only glyph strip could never provide. */
  label?: string;
  /** Optional click-through: dispatches this action when the bucket is clicked or
   *  keyboard-activated (Enter / Space — Space preventDefaults page scroll). Makes
   *  the cell a `role="button"` tabstop. Per-bucket identity is encoded in the
   *  action name (e.g. `open-run-4021`), consistent with `TableRow.action` — no
   *  context field. Omitted = a non-interactive status swatch (no tabstop). */
  action?: ActionEvent;
}

/** A status tracker / heat strip — a tight horizontal row of discrete colored
 *  cells, one per time bucket, where color encodes each bucket's semantic status.
 *  This is the "uptime strip" / "sentinel history" primitive (industry precedent:
 *  Tremor Tracker, Grafana Status History, Statuspage), NOT a numeric value
 *  sparkline (a tiny line chart — a separate, chart-family concern, deliberately
 *  not built here). The framework owns ALL appearance and a11y: the hairline gap,
 *  the intrinsic shrink-to-a-min-then-scroll overflow (zero viewport
 *  breakpoints), and the baked colorblind-safe palette (see TrackerCell.state).
 *  Bucket count is simply `cells.length` (60 slots, 24 hourly, 7 daily…). */
export interface TrackerNode {
  type: "tracker";
  id?: string;
  /** Ordered buckets, oldest → newest (rendered left → right). */
  cells: TrackerCell[];
}

/** One cell of a diff row (either the "old" side or the "new" side). Carries the
 *  cell's text plus an optional line number for the gutter. `text` may be an
 *  empty string. The wire distinction "cell present but empty" vs "cell absent"
 *  (the `null` case on the parent DiffRow) carries meaning — see DiffRow. */
export interface DiffCell {
  text: string;
  lineNumber?: number;
  /** OPTIONAL inline runs for WORD-LEVEL intra-line highlighting — the feature
   *  DiffNode v1 deferred pending "the inline rich text architectural question",
   *  now answered. Same contract as `TextNode.runs`: when present the renderer
   *  draws the runs instead of `text`, and `text` remains REQUIRED as the plain
   *  reading + fallback + agent-legible form. Consumers still compute the
   *  word-level diff themselves (server-computes / framework-renders) and express
   *  the result as runs — typically `strike` for removed words on the old side and
   *  `bold` for added words on the new side. */
  runs?: InlineRun[];
}

/** One row of a DiffNode. Row-KIND (add / remove / context) is derived
 *  client-side from the shape of the row itself — no separate `kind` wire field:
 *
 *    old != null && new == null  →  REMOVE  (left-side content, right side empty)
 *    old == null && new != null  →  ADD     (right-side content, left side empty)
 *    old.text === new.text       →  CONTEXT (unchanged; both sides identical)
 *    old.text !== new.text       →  a modified pair — both cells shown side-by-side
 *                                    and tinted in side-by-side mode; splits into
 *                                    a REMOVE then ADD row-pair in unified mode
 *
 *  This "shape carries the meaning" pattern makes it impossible for a `kind`
 *  label to disagree with the content, and keeps the wire compact. Line numbers
 *  are optional so diff sources that don't track them (e.g. two prose versions)
 *  degrade to a content-only column. */
export interface DiffRow {
  /** Old (pre-change) cell. OMIT to signal a pure addition (no left-side content).
   *  Wire contract (gotcha #8): omit the key rather than emit `"old": null` — an
   *  unset optional is ABSENT, never `"field": null`. The renderer treats a
   *  missing key as "no old side" (pure add). */
  old?: DiffCell;
  /** New (post-change) cell. OMIT to signal a pure removal (no right-side content).
   *  Same wire contract as `old` — omit the key rather than emit `null`. */
  new?: DiffCell;
}

/** DiffNode — aligned before/after primitive for review, audit, and
 *  change-comparison apps. Consumers compute the diff server-side (LibGit2Sharp
 *  on .NET, `diff` lib on TS, `git diff --json`, whatever they have) and hand
 *  VMS the structured rows — same server-computes / framework-renders doctrine
 *  as the markdown → tree pattern. The framework owns ALL appearance and a11y:
 *  the CSS-Grid alignment (4 tracks in side-by-side, 3 in unified), the tint +
 *  left-stripe row coloring, the long-line horizontal-scroll-per-cell that
 *  preserves row alignment, the empty-cell styling, the tinted line numbers,
 *  and the unified-mode collapse of the two linenum columns into a single left
 *  margin. This is the CHARTS/TRACKER precedent applied to before/after
 *  content — aligned side-by-side is a genuinely uncomposable capability that
 *  no combination of existing nodes produces (two `pre` blocks in `layout:"split"`
 *  give you two independent walls of text with no row alignment). Explicitly
 *  out of scope for v1: syntax highlighting on cells (a separate CodeBlockNode
 *  question), word-level intra-line diff highlighting (would need inline rich
 *  text, an open architectural question), in-line review comments, and
 *  collapse/expand of hunks (consumers who want that compute a smaller `rows`
 *  array server-side). Design of record: [design/diff-node.md](../../.planning/design/diff-node.md). */
export interface DiffNode {
  type: "diff";
  id?: string;
  /** Ordered rows, top → bottom (rendered in order). */
  rows: DiffRow[];
  /** Layout mode. Omitted = "side-by-side" (the default — the whole reason this
   *  primitive exists over composition of two `pre` blocks). "unified" = a
   *  single-column form with dual line-number columns, useful when horizontal
   *  space is constrained or the app prefers the git-log-style presentation.
   *  Closed union (DIFF-01). */
  mode?: "unified" | "side-by-side";
  /** Optional header row showing file paths (or any labels) for old/new. In
   *  side-by-side mode: spans the two column-groups (2 tracks each). In unified
   *  mode: spans all 3 tracks and joins the two labels with " → ". Omitted =
   *  no header. */
  header?: { old: string; new: string };
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
   *  omitting nextPollIn when no pollInterval is configured. NBA-05 (Phase 15): every poll dispatch
   *  rides the non-blocking lane (see `schedulePoll`'s doc comment) — a blocking user action fired
   *  while a poll round trip is in flight is never dropped or delayed by it. See
   *  `.planning/design/non-blocking-actions.md`. */
  pollInterval?: number;
  /** 3.8.0 — the id of the client bundle this shell instance is running (the app
   *  injects it at build time, e.g. from a Vite `define`/env — VMS never derives
   *  it, staying platform-agnostic). When set, the shell (1) attaches it as the
   *  `X-VMS-Client-Build` header on every action POST so the server can
   *  fail-closed on a stale mutation, and (2) compares it against a response's
   *  `serverBuild` and fires a `VmsVersionSkewError` via `onError` when they
   *  differ (AFTER rendering — detection never swallows the render). Absent =
   *  the whole version-skew feature is off; behavior is byte-identical to a
   *  build without it. */
  clientBuildId?: string;
}

export interface ShellSideEffect {
  /** "set-local-storage" | "set-session-storage" | "download" | "toast" — unknown types are silently ignored. */
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
  /** For "toast": the text shown in the transient confirmation. Required for a
   *  toast effect (the shell guards `message != null` before routing). */
  message?: string;
  /** For "toast": optional semantic tone — "danger" | "warning" | "success" | "info". */
  tone?: string;
  /** For "toast": optional auto-dismiss delay in ms (adapter default ~4000). */
  durationMs?: number;
}

// ─── Error envelope types (Phase 7 / v1.0.0) ─────────────────────────────────
//
// `ErrorEntry` is structurally identical to the one exported from server.ts.
// It is kept local here to avoid a circular dependency (server.ts imports from
// index.ts via `export * from "./index.js"`). Keep both definitions in sync
// when changing the shape.

/** One entry in the structured error payload returned on `ok: false`. */
export interface ErrorEntry {
  /** Absent when not tied to a specific input slot (parse errors, uncaught
   *  exceptions, etc.). Present when bound to a specific bind-path on an input. */
  path?: string;
  /** Human-readable description of the error. Always present. */
  message: string;
  /** Framework-set discriminator for the failure class. Initial vocabulary:
   *  "parse_error" | "unknown_action" | "invalid_tree" | "uncaught_exception".
   *  Absent when not applicable (e.g. BadRequest / D-08 path). */
  code?: string;
}

/**
 * Private helper: compose a human-readable `.message` from an errors array.
 * Single entry → the entry's message verbatim.
 * Multiple entries → "<first> (and N more)" so console.error is still useful.
 */
function summarizeErrors(errors: ErrorEntry[]): string {
  if (errors.length === 0) return "Server returned ok:false with no error details";
  if (errors.length === 1) return errors[0].message;
  return `${errors[0].message} (and ${errors.length - 1} more)`;
}

/**
 * Structured error surfaced via `onError` when the server returns `ok: false`.
 * Extends `Error` so existing `onError` consumers that don't know about the
 * envelope continue receiving a normal Error with a useful `.message`.
 *
 * Consumers that want the structured payload: `if (err instanceof VmsActionError) { ... err.errors ... }`.
 *
 * `status` is the HTTP status code (0 for push-originated errors with no
 * HTTP transaction). `code` is a shortcut to `errors[0].code` for ergonomic
 * branching on single-error responses.
 */
export class VmsActionError extends Error {
  constructor(
    public readonly errors: ErrorEntry[],
    public readonly status: number,
  ) {
    super(summarizeErrors(errors));
    this.name = "VmsActionError";
  }
  /** Shortcut to `errors[0]?.code`. Undefined when the first entry has no code. */
  get code(): string | undefined {
    return this.errors[0]?.code;
  }
}

/**
 * 3.8.0 — surfaced via `onError` when a SUCCESS response's `serverBuild` differs
 * from the configured `ShellOptions.clientBuildId` (client/server version skew:
 * a long-lived tab is running an out-of-date bundle against a server that has
 * rolled forward). This is fired AFTER the response renders normally — it never
 * swallows the render — so it is a loud, catchable signal, not a failure. The
 * app distinguishes it with `if (err instanceof VmsVersionSkewError)` (typically
 * to prompt the user to reload). Distinct from `VmsActionError`: this rides on a
 * fully-successful `ok:true` response.
 */
export class VmsVersionSkewError extends Error {
  /** Stable discriminator for this failure class (parallels VmsActionError.code). */
  readonly code = "version_skew";
  constructor(
    public readonly serverBuild: string,
    public readonly clientBuild: string,
  ) {
    super(
      `Client build "${clientBuild}" is out of date — the server is now serving ` +
      `build "${serverBuild}". Reload to get the current app.`,
    );
    this.name = "VmsVersionSkewError";
  }
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
  /** 0.16.0 — when true, the shell locks the UI (drops user-initiated
   *  dispatches; the adapter applies `.vms-busy` for the visual cue). Polls
   *  bypass so the server can clear the state. See `Adapter.setBusy`. */
  busy?: boolean;
  /** 1.0.0 — framework-set envelope flag. Present on every framework-rendered
   *  response; absent on hand-constructed legacy push bodies (treated as ok:true
   *  for backwards compatibility). On ok:false responses, only `errors[]` is
   *  consumed — any vm/state present in the body is IGNORED at runtime (D-15
   *  hardening: the shell throws before the currentVm/currentState writes run). */
  ok?: boolean;
  /** 1.0.0 — structured error entries. Present when `ok: false`. */
  errors?: ErrorEntry[];
  /** 3.8.0 — the server's current-deployed client-build id, stamped on every
   *  response when the app configures versioning. Compared against
   *  `ShellOptions.clientBuildId` to detect a never-reloaded tab running against
   *  a rolled-forward server. Absent = the feature is off. */
  serverBuild?: string;
}

export class ViewModelShell {
  private currentVm: ViewNode | null = null;
  private currentState: unknown = null;
  // Phase 14 (NBA-01..03) — the single `dispatching` mutex is replaced by two
  // independent in-flight lanes so a non-blocking (silent/blocking:false)
  // round trip coexists with a blocking one instead of contending for one
  // shared slot. See `.planning/design/non-blocking-actions.md`.
  /** Guards ONLY the blocking lane — renamed 1:1 from `dispatching`. Today's
   *  rapid-click-during-a-round-trip protection, byte-identical. */
  private blockingInFlight = false;
  /** Guards the non-blocking lane so at most one non-blocking round trip is
   *  ever in flight at once. */
  private nonBlockingInFlight = false;
  /** NBA-02 coalescing slot. Holds the LATEST non-blocking dispatch requested
   *  while one is already in flight; each subsequent trigger OVERWRITES it
   *  (never appended/queued — "latest wins"), so at most one extra round
   *  trip fires once the in-flight one resolves. Stores the pending trigger's
   *  OWN `silent` classification alongside its action (CR-01 fix, Phase 14
   *  gap closure) — the refire must replay with the classification the
   *  coalesced trigger was ORIGINALLY dispatched with, never with whichever
   *  invocation happens to resolve first and run the refire. Without this, a
   *  bare `poll` action (silent=true, no `blocking` field of its own)
   *  coalescing behind an in-flight `blocking:false` action would refire
   *  through the resolving action's `silent=false`, misrouting the poll into
   *  the blocking lane. See `.planning/design/non-blocking-actions.md`. */
  private pendingNonBlockingRefire: { action: ActionEvent; silent: boolean } | null = null;
  /** Monotonic counter incremented once per ACTUAL network dispatch attempt,
   *  shared across both lanes, assigned at the moment the request is fired
   *  (not at trigger/coalesce time) so it reflects real fire order. */
  private dispatchSeq = 0;
  /** The highest dispatchSeq whose response has been applied (rendered) so
   *  far. NBA-03: a NON-BLOCKING response is applied only when its seq >=
   *  appliedSeq; a lower seq means a strictly newer dispatch already applied
   *  and this response is stale — discard it rather than clobber the newer
   *  render. A BLOCKING response is authoritative and always applies
   *  unconditionally (CR-02 fix, Phase 14 gap closure): `blockingInFlight`
   *  guarantees at most one blocking dispatch is ever in flight, so a
   *  blocking response can never be superseded by another blocking one —
   *  gating it against a faster-resolving, later-fired NON-blocking response
   *  would silently discard the user's own action with no signal. Always
   *  advanced via `Math.max` (never lowered) regardless of which lane
   *  applied. See `.planning/design/non-blocking-actions.md` — "Epoch".
   *
   *  NBA-06 (Phase 15): the non-blocking apply gate ALSO discards a response
   *  whenever `pendingNonBlockingRefire !== null` at apply time, even if its
   *  own seq is not stale by the `seq >= appliedSeq` test above. This closes
   *  the rapid-double-toggle gap: toggle A fires, toggle B (the user's very
   *  next click on the same control) coalesces into `pendingNonBlockingRefire`
   *  while A is still in flight; A's response is the ONLY one outstanding, so
   *  it is never stale by seq alone — but it necessarily echoes state as of
   *  A's own send time, predating B's local write. Applying it would revert
   *  B's not-yet-sent value AND poison the refire (which reads `currentState`
   *  fresh at its own fire time). Discarding A here is safe because the
   *  queued refire (B) is guaranteed to fire immediately next, in the same
   *  `finally` block, and will itself advance `appliedSeq` when it applies.
   *  See `.planning/design/non-blocking-actions.md` — "Coalescing". */
  private appliedSeq = 0;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  // 0.16.0 — busy = serverBusy OR a user-initiated dispatch is in flight.
  // Polls (silent=true dispatches) don't flip userDispatching so they never
  // toggle the busy class — that's how a server-busy state stays continuously
  // locked across many ticks without flicker.
  private serverBusy = false;
  private userDispatching = false;

  constructor(private options: ShellOptions) {}

  private syncBusy(): void {
    this.options.adapter.setBusy?.(this.serverBusy || this.userDispatching);
  }

  async load(params?: Record<string, string>): Promise<void> {
    const { endpoint, adapter, onError, onLoading } = this.options;
    this.stopPolling();
    try {
      onLoading?.(true);
      const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
      const extraHeaders = this.options.getRequestHeaders ? await this.options.getRequestHeaders() : {};
      const res = await fetch(url, { headers: { Accept: "application/json", ...extraHeaders } });
      // 1.0.0 — parse-then-branch: always parse the body even on 4xx/5xx so the
      // structured envelope is available. The ok:false check throws BEFORE the
      // currentVm/currentState writes below — D-15 runtime hardening (throw-before-
      // write ordering means the shell never mutates state from a failure body).
      let body: ShellResponse;
      try {
        body = (await res.json()) as ShellResponse;
      } catch (_parseErr) {
        // Non-JSON body on a 4xx/5xx (proxy error page, 502, etc.).
        // Fall back to a plain Error — the body was never a VMS envelope.
        throw new Error(`${res.status} ${res.statusText}`);
      }
      if (body.ok === false) {
        // D-15 runtime hardening: throw BEFORE currentVm/currentState are written.
        // Even if the server (incorrectly) sent vm/state on an ok:false response,
        // neither field is consumed — type-erosion-safe.
        throw new VmsActionError(
          body.errors ?? [{ message: `${res.status} ${res.statusText}` }],
          res.status,
        );
      }
      this.currentVm = body.vm;
      this.currentState = body.state;
      // 0.14.0 — apply the unload guard from the initial-load response too. The
      // server may legitimately want it on at first paint (e.g. the page was
      // refreshed mid-work and the long action is still pending server-side).
      adapter.setPreventUnload?.(body.preventUnload ?? false);
      // 0.16.0 — same for the busy lockout.
      this.serverBusy = body.busy ?? false;
      this.syncBusy();
      adapter.render(body.vm, (action) => this.dispatch(action), this.stateAccessForAdapter());
      this.schedulePoll(body.nextPollIn);
      // 3.8.0 — version-skew DETECTION (Phase 1). Render happened above FIRST;
      // this only fires a loud, catchable signal and never affects the render.
      // At initial load the ids normally match (fresh bundle) so it's a no-op.
      this.checkVersionSkew(body);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError ? onError(error) : console.error("[ViewModelShell]", error);
    } finally {
      onLoading?.(false);
    }
  }

  /**
   * The actual network round trip for a single dispatch: builds the
   * multipart body, fires the request, parses/validates the response, and
   * applies it per the lane-aware epoch rule (Phase 14 / NBA-03, refined by
   * the CR-02 gap closure — see the `appliedSeq` field doc). Never throws to
   * its caller — every error path is swallowed here exactly as it was in
   * pre-Phase-14 `dispatch()`, so lane call sites need only a bare
   * `try { await this.performRoundTrip(action, nonBlocking); } finally { ... }`
   * with no `catch` of their own.
   *
   * @param nonBlocking whether THIS dispatch is on the non-blocking lane
   *   (silent=true or action.blocking===false). Determines whether the
   *   response is subject to the staleness-discard (non-blocking) or always
   *   applies unconditionally (blocking — see the `appliedSeq` field doc).
   */
  private async performRoundTrip(action: ActionEvent, nonBlocking: boolean): Promise<void> {
    // Phase 14 (NBA-03) — assigned at the moment the request actually fires
    // (not at trigger/coalesce time) so it reflects real fire order.
    const seq = ++this.dispatchSeq;
    const { actionEndpoint, onError } = this.options;
    try {
      const form = new FormData();
      // Phase 6 — wire-shape break: `_action` carries the action name only.
      // The state at the input's bind path holds whatever value the previous
      // `context` payload used to carry; the server reads it from there.
      form.append("_action", JSON.stringify({ name: action.name }));
      form.append("_state", JSON.stringify(this.currentState));
      if (action.files) {
        for (const [name, file] of Object.entries(action.files)) {
          form.append(name, file);
        }
      }
      const extraHeaders = this.options.getRequestHeaders ? await this.options.getRequestHeaders() : {};
      const adapter = this.options.adapter;
      // 3.8.0 — Phase 2 fail-closed guard: advertise the running bundle id so the
      // server can reject a mutation from a stale client BEFORE deserializing
      // _state. Merged AFTER getRequestHeaders() so app headers can't clobber it.
      const headers: Record<string, string> = { Accept: "application/json", ...extraHeaders };
      if (this.options.clientBuildId) headers["X-VMS-Client-Build"] = this.options.clientBuildId;
      const init = {
        method: "POST",
        headers,
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
      // 1.0.0 — parse-then-branch: always parse the body even on 4xx/5xx so the
      // structured envelope is available to construct VmsActionError. The existing
      // catch arm below re-renders currentVm on error (D-15 behavior) — VmsActionError
      // flows through that same path since it IS an Error instance.
      let body: ShellResponse;
      try {
        body = (await res.json()) as ShellResponse;
      } catch (_parseErr) {
        // Non-JSON body on a 4xx/5xx (proxy error page, 502, etc.).
        // Fall back to a plain Error — the body was never a VMS envelope.
        throw new Error(`Action '${action.name}' failed: ${res.status} ${res.statusText}`);
      }
      if (body.ok === false) {
        // D-15 runtime hardening: throw BEFORE this.processResponse(body) runs.
        // The throw skips processResponse entirely, so currentVm/currentState are
        // NOT updated from the failure body — even if the server (incorrectly) sent
        // vm/state on an ok:false response. Type-erosion-safe.
        throw new VmsActionError(
          body.errors ?? [{ message: `Action '${action.name}' failed: ${res.status}` }],
          res.status,
        );
      }
      // Phase 14 (NBA-03, refined by the CR-02 gap closure) — lane-aware
      // epoch gate. Purely client-side; no wire field (see
      // .planning/design/non-blocking-actions.md — "Epoch").
      if (nonBlocking) {
        // Non-blocking (background) response: apply only if no strictly-newer
        // dispatch (of either lane) has already been applied — this is the
        // staleness-discard NBA-03 exists for. Phase 15 (NBA-06) ALSO
        // discards when a coalesced re-fire is already queued
        // (`pendingNonBlockingRefire !== null`) at the moment this response
        // is ready to apply: a strictly newer round trip — carrying the
        // user's latest local writes — is guaranteed to fire immediately
        // after (in this same dispatch's `finally` block) and supersede it,
        // so applying THIS response first would only clobber those
        // not-yet-sent writes with a stale echo. See the `pendingNonBlockingRefire`
        // field doc and .planning/design/non-blocking-actions.md — "Coalescing".
        if (seq >= this.appliedSeq && this.pendingNonBlockingRefire === null) {
          this.appliedSeq = Math.max(this.appliedSeq, seq);
          this.processResponse(body);
        }
      } else {
        // Blocking (user) response: authoritative — ALWAYS applies. At most
        // one blocking dispatch is ever in flight (blockingInFlight guards
        // it), so it can never be superseded by another blocking response;
        // gating it against a faster non-blocking response would silently
        // discard the user's own action. appliedSeq still advances (via max,
        // never lowered) so a later-arriving stale non-blocking response is
        // correctly discarded against this newer high-water mark.
        this.appliedSeq = Math.max(this.appliedSeq, seq);
        this.processResponse(body);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError ? onError(error) : console.error("[ViewModelShell]", error);
      // 3.8.0 — Phase 2 fail-closed recovery. The server rejected this mutation
      // because the tab is running a stale bundle (nothing was applied). Order
      // per the locked design: surface via onError FIRST (done above), THEN
      // force a reload to the fresh bundle — the only safe recovery. reload is
      // fail-quiet by absence (the VmsActionError already surfaced), so this is
      // a plain optional-chain call, and we return before the below re-render
      // (the page is reloading; re-rendering the stale tree is pointless).
      if (error instanceof VmsActionError && error.code === "stale_client") {
        this.options.adapter.reload?.();
        return;
      }
      // 0.8.0 (#11) — re-render the current VM on dispatch error. Adapters
      // may have applied client-side ephemeral state in onAction handlers
      // (e.g., BrowserAdapter swaps button text for ButtonNode.pendingLabel).
      // Re-rendering snaps that back to the authoritative server state.
      // Skipped when no VM has loaded yet (pre-initial-load dispatch is
      // already an error case handled above; currentVm stays null there).
      if (this.currentVm !== null) {
        this.options.adapter.render(this.currentVm, (a) => this.dispatch(a), this.stateAccessForAdapter());
      }
    }
  }

  async dispatch(action: ActionEvent, silent = false): Promise<void> {
    // Phase 14 (NBA-01) — unifies the existing poll-only `silent` flag with
    // the new `blocking:false` field under one "non-blocking lane" concept
    // (design doc: "Poll = a non-blocking action on a timer").
    const nonBlocking = silent || action.blocking === false;

    if (!nonBlocking) {
      // ─── Blocking lane — byte-identical guard order/behavior to the
      // pre-Phase-14 single `dispatching` mutex, renamed to `blockingInFlight`. ───
      // 0.16.0 — drop user-initiated dispatches while server-busy.
      if (this.serverBusy) return;
      if (this.blockingInFlight) return;
      if (this.currentState === null) {
        const err = new Error(
          `Cannot dispatch '${action.name}' before initial load completes. ` +
          `Call shell.load() and wait for it before allowing user interaction.`
        );
        const { onError } = this.options;
        onError ? onError(err) : console.error("[ViewModelShell]", err);
        return;
      }
      // 0.16.0 — flag a user dispatch as in-flight + apply .vms-busy. This
      // is what kills the "rapid clicks during a round-trip silently flip the
      // checkbox" UX bug: by the time the user's second click arrives, the
      // container has pointer-events: none and the click never reaches the
      // input.
      this.blockingInFlight = true;
      this.userDispatching = true;
      this.syncBusy();
      this.options.onLoading?.(true);
      try {
        await this.performRoundTrip(action, false);
      } finally {
        this.blockingInFlight = false;
        this.userDispatching = false;
        this.syncBusy();
        this.options.onLoading?.(false);
      }
      return;
    }

    // ─── Non-blocking lane — covers BOTH silent===true (poll) and
    // action.blocking===false (NBA-01). Deliberately does NOT set
    // userDispatching / call onLoading / toggle .vms-busy — that is what
    // "does not trip the busy-lock" means; only the blocking lane does.
    if (this.nonBlockingInFlight) {
      // NBA-02 — coalesce; do NOT fire a second concurrent request. Overwrite
      // (never append/queue) so at most one extra round trip fires once the
      // in-flight one resolves, carrying the LATEST trigger. CR-01 fix: store
      // this trigger's OWN `silent` alongside its action — see the field doc
      // on `pendingNonBlockingRefire`.
      this.pendingNonBlockingRefire = { action, silent };
      return;
    }
    // Mirrors the blocking lane's pre-load guard, identical error message.
    if (this.currentState === null) {
      const err = new Error(
        `Cannot dispatch '${action.name}' before initial load completes. ` +
        `Call shell.load() and wait for it before allowing user interaction.`
      );
      const { onError } = this.options;
      onError ? onError(err) : console.error("[ViewModelShell]", err);
      return;
    }
    this.nonBlockingInFlight = true;
    try {
      await this.performRoundTrip(action, true);
    } finally {
      this.nonBlockingInFlight = false;
      const refire = this.pendingNonBlockingRefire;
      this.pendingNonBlockingRefire = null;
      // CR-01 fix — the coalesced re-fire recurses into dispatch() with the
      // PENDING TRIGGER'S OWN `silent` classification (stored alongside its
      // action in the slot), never with the value THIS (resolving)
      // invocation happened to be entered with. A poll's coalesced refire
      // always stays silent regardless of what resolved first; a
      // blocking:false action's coalesced refire always re-enters the
      // non-blocking branch via its own action.blocking===false. See the
      // field doc on `pendingNonBlockingRefire`.
      if (refire) void this.dispatch(refire.action, refire.silent);
    }
  }

  /** Feed a pre-parsed ShellResponse into the shell — for SSE/WebSocket integrations. */
  push(response: ShellResponse): void {
    if (this.blockingInFlight || this.nonBlockingInFlight) return;
    // 1.0.0 — parse-then-branch for push. External push consumers (SSE, WebSocket)
    // may feed ok:false responses (e.g. a server-pushed error notification). Route
    // them to onError WITHOUT calling processResponse — currentVm/currentState
    // are NOT updated (D-15 runtime hardening for the push path).
    // status: 0 because there was no HTTP transaction in an external push.
    if (response.ok === false) {
      const err = new VmsActionError(
        response.errors ?? [{ message: "Server pushed ok:false envelope" }],
        0,
      );
      this.options.onError ? this.options.onError(err) : console.error("[ViewModelShell]", err);
      return;
    }
    this.processResponse(response);
  }

  stopPolling(): void {
    if (this.pollTimer) { clearTimeout(this.pollTimer); this.pollTimer = null; }
  }

  getCurrentVm(): ViewNode | null { return this.currentVm; }
  getCurrentState(): unknown { return this.currentState; }

  /**
   * Read the bound state value at a dotted path (e.g. "fields.title",
   * "rows.42.selected"). Used by adapters (BrowserAdapter, TuiAdapter, …) to
   * render an input's current value. Returns `undefined` when any segment
   * along the path is missing — adapters treat that as "no value set" and
   * render the appropriate empty form (empty string, unchecked, etc.).
   *
   * This is half of the bind-path seam introduced in Phase 6: the shell holds
   * state mutably so that input events can update it (via `stateWrite`)
   * without round-tripping to the server until a real dispatch fires.
   */
  stateRead(path: string): unknown {
    return readPath(this.currentState, path);
  }

  /**
   * Write a value into state at a dotted path. The shell mutates the held
   * state object in place at the bind path; the next dispatch sends the
   * updated state to the server. Intermediate objects/arrays are created on
   * demand (numeric next segment → array, else object).
   *
   * This is the other half of the bind-path seam — the BrowserAdapter (or any
   * adapter that supports user input) calls this on every keystroke / change
   * event so drafts ARE state.
   */
  stateWrite(path: string, value: unknown): void {
    this.currentState = writePath(this.currentState, path, value);
  }

  /**
   * Build the read/write seam the Adapter receives as its third render arg.
   * Backed by `stateRead` / `stateWrite` so the adapter never needs a direct
   * reference to the shell.
   */
  private stateAccessForAdapter(): StateAccess {
    return {
      read: (path: string) => this.stateRead(path),
      write: (path: string, value: unknown) => this.stateWrite(path, value),
    };
  }

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
      } else if (effect.type === "toast" && effect.message != null) {
        // FAIL-QUIET (cf. setPreventUnload/setBusy): a toast is a UX nicety,
        // not a correctness/security guarantee, so an adapter without the
        // capability simply drops it — NO failCapability, no onError. The
        // optional-chaining call is the entire contract.
        adapter.toast?.(effect.message, {
          tone: effect.tone,
          durationMs: effect.durationMs,
        });
      }
    }
    // 0.14.0 — apply the unload guard before the redirect/render branch so it's
    // in place (or cleared) consistently across both branches. A server that
    // wants a redirect to NOT be blocked by its own guard simply omits
    // preventUnload (or sets it false) on that response — standard pattern.
    adapter.setPreventUnload?.(body.preventUnload ?? false);
    // 0.16.0 — likewise for the busy lockout.
    this.serverBusy = body.busy ?? false;
    this.syncBusy();
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
    // C2 (3.3.0) — a non-redirect response MAY legitimately omit `vm` (e.g. a
    // side-effects-only or poll-keepalive response: "persist to storage and
    // keep polling, but don't rebuild the view"). Do NOT blank the screen by
    // rendering `undefined` — keep the current view, update state only if the
    // server sent fresh state, and still schedule the next poll. Render only
    // when a fresh tree actually arrived.
    if (body.vm != null) {
      this.currentVm = body.vm;
      if (body.state !== undefined) this.currentState = body.state;
      this.options.adapter.render(body.vm, (a) => this.dispatch(a), this.stateAccessForAdapter());
    } else if (body.state !== undefined) {
      this.currentState = body.state;
    }
    this.schedulePoll(body.nextPollIn);
    // 3.8.0 — version-skew DETECTION (Phase 1) on the dispatch / poll / push
    // success path. Fired AFTER the render above (never swallows it). A redirect
    // response returned early above, so this is the non-redirect path only.
    this.checkVersionSkew(body);
  }

  /**
   * 3.8.0 — Phase 1 detection. When the app configured `clientBuildId` and the
   * response carries a differing `serverBuild`, fire a `VmsVersionSkewError`
   * through the existing `onError` seam so the app can react (e.g. prompt a
   * reload). Called from BOTH success paths (`load()` and `processResponse()`)
   * AFTER the response has rendered — detection is additive and never affects
   * the render. No-op when `clientBuildId` is unset, `serverBuild` is absent, or
   * the two ids match.
   */
  private checkVersionSkew(body: ShellResponse): void {
    const clientBuild = this.options.clientBuildId;
    const serverBuild = body.serverBuild;
    if (clientBuild && serverBuild && serverBuild !== clientBuild) {
      const err = new VmsVersionSkewError(serverBuild, clientBuild);
      this.options.onError ? this.options.onError(err) : console.error("[ViewModelShell]", err);
    }
  }

  /**
   * NBA-05 (Phase 15): the timer-driven poll dispatch below always calls
   * `this.dispatch({ name: "poll" }, true)` — passing `silent = true` — so
   * `nonBlocking = silent || action.blocking === false` in `dispatch()` is
   * ALWAYS `true` for a poll, regardless of any `blocking` field on the
   * action itself. This means poll ALWAYS rides the non-blocking lane and
   * never contends with `blockingInFlight`: `ShellOptions.pollInterval` is
   * sugar over the same non-blocking dispatch path a `blocking: false`
   * action uses, not a separate mechanism. See
   * `.planning/design/non-blocking-actions.md` — "Wire / API surface" (the
   * "`pollInterval` becomes sugar over the same non-blocking path" line).
   */
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

// ─── Bind-path walkers (file-private; no platform globals) ───────────────────
//
// Tiny JSON walk + write helpers consumed by stateRead/stateWrite. Numeric
// segments index into arrays when the current value is an array; otherwise
// they're object keys. writePath creates intermediate objects/arrays on
// demand when the next segment shape implies one. Bind paths arrive trimmed
// of leading/trailing dots; an empty path writes to the root.

// Reject segments that would mutate Object.prototype on write or expose it on
// read. The bind string is server-controlled today, but stateWrite() is a
// public method and demos build bind paths dynamically; the guard is defense
// in depth so consumer code can never turn a path string into prototype pollution.
function isUnsafeSegment(seg: string): boolean {
  return seg === "__proto__" || seg === "constructor" || seg === "prototype";
}

function readPath(obj: unknown, path: string): unknown {
  // Defense: a bind-less input that somehow reached the renderer would call
  // here with path=undefined. The wire contract guarantees `bind` on every
  // input, but the runtime should not crash if a malformed tree leaks
  // through — return undefined and let the field render as empty.
  if (path == null || path === "") return path == null ? undefined : obj;
  const segs = path.split(".");
  let cur: unknown = obj;
  for (const seg of segs) {
    if (isUnsafeSegment(seg)) return undefined;
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0) return undefined;
      cur = cur[idx];
    } else if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

function writePath(obj: unknown, path: string, value: unknown): unknown {
  // Defense: drop writes from bind-less inputs (see readPath).
  if (path == null) return obj;
  if (path === "") return value;
  const segs = path.split(".");
  for (const seg of segs) {
    if (isUnsafeSegment(seg)) return obj;
  }
  // Bootstrap a root if the current state is null/undefined; choose the shape
  // implied by the first segment (numeric ⇒ array, else object).
  let root: unknown = obj;
  if (root == null || typeof root !== "object") {
    root = isArrayIndexSegment(segs[0]!) ? [] : {};
  }
  let cur: unknown = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!;
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      let nxt = cur[idx];
      if (nxt == null || typeof nxt !== "object") {
        // Intermediate slot creation: default to object. The next segment's
        // shape can't be inferred safely (numeric keys appear in both arrays
        // and maps keyed by id), so the round-trip-safe default is {}. The
        // root bootstrap above remains the only place the array heuristic
        // fires — there we genuinely have no parent shape to honor.
        nxt = {};
        cur[idx] = nxt;
      }
      cur = nxt;
    } else {
      const o = cur as Record<string, unknown>;
      let nxt = o[seg];
      if (nxt == null || typeof nxt !== "object") {
        nxt = {};
        o[seg] = nxt;
      }
      cur = nxt;
    }
  }
  const last = segs[segs.length - 1]!;
  if (Array.isArray(cur)) {
    cur[Number(last)] = value;
  } else {
    (cur as Record<string, unknown>)[last] = value;
  }
  return root;
}

function isArrayIndexSegment(seg: string): boolean {
  return /^[0-9]+$/.test(seg);
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
