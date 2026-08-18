// Phase 6 — thin-interpreter rewrite.
//
// Every input declares a `bind` dotted path into state; the renderer reads
// that slot to render and writes back on user-input events. Dispatch carries
// only the action name. The 7 context-assembly sites that lived here
// (form harvest, select-on-change, field-on-Enter, standalone CheckboxNode,
// TabsNode, TableNode sort/filter/pagination/selection, ButtonNode pre-baked
// context) collapse to one pattern: read via sa.read(bind); write via
// sa.write(bind, value); dispatch { name }. Drafts ARE state. File-input
// persistence keeps a fileRegistry for the binary side channel; the picked
// file also lands in state as {filename, size}. Focus/caret/scroll
// preservation continue to operate on the DOM.

import type {
  ViewNode, ActionEvent, Adapter, StateAccess,
  PageNode, SectionNode, ListNode, ListItemNode,
  FormNode, FieldNode, CheckboxNode, ButtonNode,
  TextNode, InlineRun, LinkNode, ImageNode, StatBarNode, TabsNode, ProgressNode,
  ModalNode, TableNode, CopyButtonNode, DividerNode, FitsNode,
  EmptyStateNode, BadgeNode, ChartNode,
  BlockquoteNode, CodeBlockNode, BreadcrumbNode, StepsNode, TrackerNode, DiffNode,
  IconNode, IconName, AvatarNode, ListRowNode,
  MessageNode, MessageListNode, AlertNode, UserRowNode,
  DetailRowNode, DetailListNode,
  TimelineEntryNode, TimelineNode,
  SettingRowNode, SettingListNode,
  ChipNode, ChipListNode,
  RichTextFieldNode, RichTextToolbarNode, RichTextTool,
  ChatComposerNode, ChatComposerStatus, ChatComposerSubmitMode,
  FilterDescriptor, FilterRule, FilterSpec, ValueKind, TableColumn,
} from "./index.js";
import { ICONS } from "./icons-payload.js";

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * No-op StateAccess fallback for callers that mount the adapter without a
 * live shell (theme-modifier tests, conformance fixture walks, etc.). Reads
 * return undefined; writes are dropped. This keeps the static-tree test
 * surface intact while the bind-path contract is mandatory for real apps.
 */
const noopStateAccess: StateAccess = {
  read: () => undefined,
  write: () => { /* drop */ },
};

// SectionNode.followTail — a `[data-follow-tail]` element counts as "at the
// bottom" (and should stay pinned to the newest content on re-render) when it
// is within this many pixels of the bottom. A small tolerance so sub-pixel
// rounding and being ~a line off the bottom still counts as "following"; scroll
// up past it and the adapter respects the user reading history instead.
const FOLLOW_TAIL_STICK_THRESHOLD_PX = 40;

export class BrowserAdapter implements Adapter {
  private fileRegistry = new Map<string, File>();
  private sa: StateAccess = noopStateAccess;
  // Dev-console diagnostics dedup (3.9.0). Both [vms:no-bind] and
  // [vms:type-mismatch] warn at most once per key over this adapter's lifetime.
  // The client bundle can't distinguish dev/prod, so these fire in both — which
  // is intentional: prod telemetry that captures console.warn sees them too.
  private diagWarned = new Set<string>();
  // 1.2.0 — open-state snapshot for SectionNode.collapsible. Captured by
  // render() BEFORE this.container.innerHTML = "" by walking
  // [data-section-key] details elements; consumed by render() AFTER node()
  // rebuilds the tree to restore user-opened sections. Cleared at the bottom
  // of every render(). Same conceptual seam as focusId / scrollMap above.
  private detailsOpenSnapshot: Map<string, boolean> = new Map();
  // 1.2.0 — per-render disambiguator for collapsible-section preservation
  // keys. Reset at the top of every render(); incremented in section() when
  // collapsible:true so that multiple sections sharing the same base key
  // (anonymous, or duplicate heading) get distinct final keys.
  private sectionKeyCounter: Map<string, number> = new Map();
  // Phase 10 (FITS-01) — per-render registry of the ResizeObservers created by
  // fits() containers. ALL are disconnected and the array cleared at the TOP of
  // every render() (before the innerHTML wipe) so observers from a prior tree
  // never leak when the tree is rebuilt — the same per-render reset idiom as
  // detailsOpenSnapshot / sectionKeyCounter above.
  private fitsObservers: ResizeObserver[] = [];
  // Phase 12 (CHART-01/03) — live Chart.js instances keyed by a stable per-render
  // ordinal chart key. DELIBERATELY PERSISTENT across renders (NOT reset like the
  // per-render fields below): the canvas + Chart instance must SURVIVE render()'s
  // innerHTML wipe so a re-render with changed data redraws IN PLACE via
  // .update() instead of re-constructing. `chart` is `any` (the module is
  // dynamically imported, so there's no compile-time Chart type dependency);
  // `latest` stashes the newest config while an async load is in flight so a fast
  // second render still applies once the import resolves. Instances are
  // mark-swept (destroy()'d + deleted) in render() when the new tree drops them.
  private chartInstances = new Map<string, { canvas: HTMLCanvasElement; chart: any | null; latest: any | null }>();
  // v8.2.0 (RICH-01) — persist TipTap Editor instances across render() calls,
  // for exactly the reason chartInstances does (see the block-comment above):
  // the Editor's DOM host + its caret + its selection + its undo history must
  // survive the innerHTML wipe. Mark-swept in render() against editorKeysSeen,
  // exactly as chartInstances is. Values are `any` because the tiptap +
  // turndown modules are LAZY-loaded (avoids a top-level import that would
  // defeat D-04's zero-bytes-for-non-consumers guarantee).
  //
  // `host` is the <div> the Editor is attached to — reused across renders (its
  // internal DOM state IS the editor state, and TipTap will re-attach it
  // seamlessly). `latestBindValue` is the last markdown value we've seen on
  // this bind, used to decide whether an incoming server value differs from
  // what the user has typed — a difference means "the server changed it,
  // setContent()"; equality means "we already have that content, do NOT
  // setContent() or we'd wipe the user's caret/selection/undo history".
  private editorInstances = new Map<string, {
    host: HTMLElement;
    editor: any | null;
    turndown: any | null;
    latestBindValue: string;
  }>();
  // Phase 21 (LOOK-05) — the lookup's aria-live status regions, keyed by
  // FieldNode.name. DELIBERATELY PERSISTENT across renders (NOT reset like the
  // per-render fields below), for exactly the reason chartInstances is: these
  // NODES must SURVIVE render()'s innerHTML wipe. They are re-appended each
  // render, never rebuilt.
  //
  // 🚨 IF YOU RESET THIS MAP, EVERY ANNOUNCEMENT SILENTLY STOPS AND NOTHING
  // LOOKS WRONG. A screen reader only announces changes to an element it has
  // ALREADY REGISTERED for. A region re-created each render is registered,
  // wiped, and re-created — so it is never heard from again, while the DOM
  // still contains a perfect-looking role="status" div and every structural
  // test still passes. This is the one a11y failure that is INVISIBLE rather
  // than merely unverified, and on Safari/VoiceOver the live region is the ONLY
  // thing that works at all (the ARIA plumbing conveys nothing there — verified
  // against the APG's own reference example). The comment on chartInstances
  // below exists for the same reason: the next person's instinct is to "tidy"
  // these into the per-render group.
  //
  // Two regions, not one (§7 item 12): writing IDENTICAL text into one live
  // region twice is not a change and is NOT re-announced — re-highlight the
  // same option, hear silence. `next` alternates them, which is why the value
  // is an object rather than a bare element (same shape reason as the chart's
  // {canvas, chart, latest} triple).
  // `hintShown` tracks §7 item 13's assistive hint, which is dropped after the
  // first input so it is not a per-keystroke tax.
  //
  // 🚨 NO TIMER HERE, AND THAT IS THE POINT (21-11). This map used to carry a
  // ~1400ms status debounce (GOV.UK's `statusDebounceMillis`), which existed for
  // ONE reason: search fired on a ~300ms type-as-you-go cadence, so the region
  // faced a per-keystroke firehose and had to wait for the user to pause or the
  // typing echo would eat the announcement. `searchAction` now fires on ENTER —
  // ONE Enter, ONE announcement — so the firehose is gone and with it every
  // reason to make an AT user wait 1.4s to hear their own answer. If you are
  // here to re-add a debounce, first re-add the cadence that justified it; you
  // will find you cannot (D4, reversed).
  //
  // Keyed by n.name — a deliberate, documented DIVERGENCE from the chart's
  // title+ordinal scheme (and NO ordinal counter: do not cargo-cult
  // chartKeyCounter). FieldNode.name is already unique-ish per field, stable
  // across renders, and is already the id basis for the control itself
  // (`inp.id = vms-${n.name}`).
  //
  // Mark-swept in render() against lookupKeysSeen, exactly as chartInstances is:
  // a lookup dropped from the tree must drop its regions rather than leak them
  // across a long session.
  private liveRegions = new Map<string, {
    a: HTMLElement;
    b: HTMLElement;
    next: "a" | "b";
    hintShown: boolean;
  }>();
  // Phase 21 (21-11) — document-level "click outside closes the popup" handlers,
  // registered by field()'s lookup arm. PER-RENDER, exactly like fitsObservers
  // above: every entry is removed from `document` at the TOP of render(), before
  // the innerHTML wipe, so a handler closing over a destroyed popup can never
  // fire. The listener MUST live on `document` (an outside click is by
  // definition not on our own subtree), and `document` outlives the wipe — so
  // without this reset the adapter would leak one dead listener per lookup per
  // render for the life of the page.
  private lookupOutsideHandlers: Array<(e: Event) => void> = [];
  // Phase 21 (LOOK-02) — popup-open snapshot for the lookup combobox, keyed by
  // FieldNode.name. Captured by render() BEFORE this.container.innerHTML = ""
  // by walking [data-vms-lookup-key] popups; consumed IN field()'s lookup arm
  // (not by a post-render DOM pass, unlike the [data-section-key] details
  // restore below) because the arm's `open` CLOSURE VARIABLE must agree with
  // the DOM: setting popup.hidden from outside would leave the closure thinking
  // it is closed, and Escape would then take its popup-already-closed branch
  // and CLEAR the user's selection. Cleared at the bottom of every render().
  //
  // 🚨 OPEN is preserved. ACTIVE IS NOT — see the arm.
  //
  // `querying` rides along: it marks "this render is the answer to a search the
  // user just asked for" — set when Enter dispatches `searchAction` (21-11; it
  // used to be set by TYPING, when typing is what searched). It is what lets
  // results arriving from the server open the popup (a first search has no
  // prior options, so the input listener's own open cannot fire) and what gates
  // the live region's result announcements, so a lookup that merely re-renders
  // for unrelated reasons never narrates its candidate count at an AT user out
  // of nowhere.
  // Phase 21 (LOOK-03) — `roving`/`armed` join this snapshot rather than growing
  // a fourth mechanism, exactly as 21-04's executor asked. Both are chip state,
  // and both are DOM-local: the roving tabindex POSITION and the "last chip is
  // highlighted, press again to remove" arm die in render()'s innerHTML wipe.
  // A search re-render lands mid-interaction, so neither can be left to chance.
  //
  // 🚨 `armed` is a VALUE, not a boolean, and that is load-bearing. Restoring an
  // armed FLAG by position would confirm the user's second Backspace against
  // whatever the server happens to have put last — a DIFFERENT item than the one
  // announced. That is precisely the silent, unannounced deletion of the wrong
  // record that §7 item 31's two-step exists to prevent, reintroduced by the
  // preservation pass meant to make it work. Keyed by value, a changed last chip
  // simply fails to match and the arm is dropped (fail-safe: the user re-arms).
  private lookupOpenSnapshot: Map<string, {
    open: boolean; querying: boolean; roving: number; armed: string | null;
  }> = new Map();
  // Per-render disambiguator for chart keys (title-derived or anonymous). Reset
  // at the TOP of every render() (like sectionKeyCounter) so snapshot keys and
  // rebuild keys compute identically across a render pass.
  private chartKeyCounter = new Map<string, number>();
  // Per-render set of every chart key rendered this pass. Reset at the TOP of
  // every render(); render() mark-sweeps any chartInstances key NOT in this set
  // (a ChartNode removed from the new tree → its Chart instance is destroyed).
  private chartKeysSeen = new Set<string>();
  // Per-render set of every lookup key rendered this pass. Reset at the TOP of
  // every render(); render() mark-sweeps the persistent liveRegions map against
  // it, so a lookup removed from the tree drops its live regions rather than
  // leaking them across a long session. Same idiom as chartKeysSeen above.
  private lookupKeysSeen = new Set<string>();
  // v8.2.0 (RICH-01) — per-render bookkeeping for the editorInstances map,
  // exact same idiom as chartKeyCounter + chartKeysSeen. Both reset at the top
  // of render() and drive the post-rebuild mark-sweep of editorInstances.
  private editorKeyCounter = new Map<string, number>();
  private editorKeysSeen = new Set<string>();

  // v9.1.0 (Plan 30-05, CHAT-04..08) — persistent per-composer attachment
  // registry. Keyed by a stable composer key (bind + per-render ordinal — same
  // disambiguation shape as sectionKeyCounter, so two ChatComposerNodes with
  // the same bind on one page get distinct entries; plan-checker M-1).
  // DELIBERATELY PERSISTENT across renders (NOT reset like the per-render
  // counters below): the attachedFiles list must survive server-driven
  // re-renders that redraw the composer's DOM subtree (a user drops a file,
  // types text, server re-renders on-input via poll — attachments MUST stay).
  // Mark-swept in render() against composerKeysSeen, exactly as chartInstances
  // is: a ChatComposerNode removed from the new tree drops its registry entry
  // AND revokes every pending blob URL (browser does NOT revoke via GC).
  private composerRegistry = new Map<string, {
    attachedFiles: { id: string; file: File; previewUrl?: string; kind: "image" | "file"; sizeBytes: number }[];
    removeAttachment?: (id: string) => void;
  }>();
  private composerKeyCounter = new Map<string, number>();
  private composerKeysSeen = new Set<string>();

  // Phase 33 (33-01) — typed column-filter popover infrastructure.
  //
  // `filterDrafts` — persistent (NOT per-render) Map from bind-path to the
  //   in-progress FilterDescriptor for that column. Keyed by the BIND PATH
  //   (the value from filterDescriptorBinds[colKey]) so drafts survive
  //   server-driven re-renders that redraw the table. Same pattern as
  //   fileRegistry, editorInstances, composerRegistry.
  private filterDrafts = new Map<string, FilterDescriptor>();

  // `popoverPortal` — a single <div class="vms-popover-portal"> created ONCE
  //   in the constructor, appended AFTER the container's main content area so
  //   it is a SIBLING of the table wrapper — escaping the wrapper's
  //   overflow-x:auto clip by construction (REQ-CF2-05, D-02). Popover DOM
  //   nodes are appended into it on open and removed on close.
  private popoverPortal!: HTMLDivElement;

  // `activePopover` — tracks the currently-open popover (null when closed).
  //   Cleared by render() preamble (any re-render closes the popover) and by
  //   closeFilterPopover().
  private activePopover: {
    bindPath: string;
    colKey: string;
    button: HTMLButtonElement;
    popoverEl: HTMLDivElement;
  } | null = null;

  // `popoverOutsideHandler` / `popoverScrollResizeCleanup` — document-level
  //   outside-click + key listeners, and resize/scroll reposition cleanup.
  //   Both are registered on popover open and removed on close (and in the
  //   render() preamble). Same discipline as lookupOutsideHandlers.
  private popoverOutsideHandler: ((e: Event) => void) | null = null;
  private popoverScrollResizeCleanup: (() => void) | null = null;

  constructor(private container: HTMLElement) {
    // Create the popover portal div and append it to the container. It is a
    // SIBLING of the table wrapper element, so it escapes the table wrapper's
    // overflow-x:auto clip (D-02, REQ-CF2-05). Created in the constructor
    // (not lazily) so render() calls that access it always find a stable target.
    this.popoverPortal = document.createElement("div");
    this.popoverPortal.className = "vms-popover-portal";
    container.appendChild(this.popoverPortal);
  }

  render(
    vm: ViewNode,
    onAction: (action: ActionEvent) => void,
    stateAccess?: StateAccess,
  ): void {
    this.sa = stateAccess ?? noopStateAccess;

    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const focusId = active?.id || null;
    const selStart = active?.selectionStart ?? null;
    const selEnd = active?.selectionEnd ?? null;

    // 0.7.1 (#7) — snapshot the WINDOW scroll position alongside element-level
    // scroll. Without this, an action-driven re-render rebuilds the entire
    // subtree and the viewport jumps. Same preservation contract as before;
    // unchanged by the Phase 6 rewrite.
    const winScrollX = window.scrollX;
    const winScrollY = window.scrollY;

    const scrollMap = new Map<string, { top: number; left: number }>();
    this.container.querySelectorAll<HTMLElement>("[id]").forEach(el => {
      // follow-tail elements own their own restore (see below) — the generic
      // preserve-the-prior-scrollTop contract is exactly what they must NOT do.
      if (el.hasAttribute("data-follow-tail")) return;
      if (el.scrollTop !== 0 || el.scrollLeft !== 0)
        scrollMap.set(el.id, { top: el.scrollTop, left: el.scrollLeft });
    });

    // SectionNode.followTail — snapshot, in document order, whether each
    // append-only feed was scrolled near its bottom (and its prior scrollTop
    // for the scrolled-up case). Ordinal-matched to the post-render walk below,
    // the same stable-order approach as the collapsible-section snapshot; a
    // brand-new feed has no entry at its ordinal and is pinned to the bottom.
    const followTail: Array<{ nearBottom: boolean; top: number }> = [];
    this.container.querySelectorAll<HTMLElement>("[data-follow-tail]").forEach(el => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      followTail.push({
        nearBottom: distanceFromBottom <= FOLLOW_TAIL_STICK_THRESHOLD_PX,
        top: el.scrollTop,
      });
    });

    // 1.2.0 — snapshot collapsible-section open state by stable key. Same
    // pattern as focusId/scrollMap above: capture before innerHTML wipe, walk
    // the rebuilt tree after node() returns, restore matching keys. Reset
    // the per-render section-key counter to 0 so snapshot keys and restore
    // keys compute identically across the two walks.
    const openMap = new Map<string, boolean>();
    this.container.querySelectorAll<HTMLDetailsElement>("[data-section-key]").forEach(el => {
      const key = el.dataset.sectionKey;
      if (key != null) openMap.set(key, el.open);
    });
    this.detailsOpenSnapshot = openMap;
    this.sectionKeyCounter = new Map();

    // Phase 21 (LOOK-02) — snapshot lookup popup-open state by field name.
    // Same capture-before-the-wipe contract as the details snapshot above, but
    // RESTORED INSIDE field()'s lookup arm rather than by a post-render walk
    // (see the field declaration for why: the closure and the DOM must not be
    // allowed to disagree).
    //
    // Why this pass exists at all: the popup is DOM-local state, and the ~300ms
    // debounced search means a re-render lands MID-TYPING on every search. With
    // no preservation the popup the user is typing into snaps shut every time
    // and the control is unusable. This was invisible before the search cadence
    // existed — nothing re-rendered a lookup mid-interaction.
    //
    // Phase 21 (LOOK-03) — the popup element is this lookup's DOM-local state
    // CARRIER, not just its popup: `roving` and `armed` are chip facts parked on
    // the same node so ONE snapshot pass covers every piece of DOM-local lookup
    // state. A fourth mechanism per fact is the drift hazard chartInstances
    // warns about.
    const lookupOpenMap = new Map<string, {
      open: boolean; querying: boolean; roving: number; armed: string | null;
    }>();
    this.container.querySelectorAll<HTMLElement>("[data-vms-lookup-key]").forEach(el => {
      const key = el.dataset.vmsLookupKey;
      if (key != null) {
        const roving = Number(el.dataset.vmsLookupRoving);
        const armed = el.dataset.vmsLookupArmed;
        lookupOpenMap.set(key, {
          open: !el.hidden,
          querying: el.dataset.vmsLookupQuerying === "true",
          roving: Number.isFinite(roving) ? roving : 0,
          // "" is the no-arm sentinel: a dataset value is always a string, and a
          // legitimate chip value is never empty (commitCustom trims and rejects
          // empty; a server candidate with an empty id is meaningless).
          armed: armed != null && armed !== "" ? armed : null,
        });
      }
    });
    this.lookupOpenSnapshot = lookupOpenMap;
    this.lookupKeysSeen = new Set();

    // Phase 10 (FITS-01) — disconnect every ResizeObserver registered by the
    // prior render's fits() calls before the tree is rebuilt (leak prevention).
    // Same per-render reset model as the focus/scroll/details snapshots above.
    this.fitsObservers.forEach(o => o.disconnect());
    this.fitsObservers = [];

    // Phase 21 (21-11) — drop the prior render's click-outside handlers before
    // the tree is rebuilt, for exactly the fits reason above: they live on
    // `document`, which the innerHTML wipe does not touch, so each would
    // otherwise outlive the popup it closes over and accumulate forever.
    this.lookupOutsideHandlers.forEach(h => document.removeEventListener("mousedown", h));
    this.lookupOutsideHandlers = [];

    // Phase 33 (33-01) — drop any open filter popover on re-render. The
    // popoverPortal survives the innerHTML wipe (it's a sibling of the table
    // wrapper, not inside the wiped subtree), so the popover DOM must be
    // removed here. The document-level handlers are removed before the wipe
    // so a handler closing over a destroyed popup can never fire.
    if (this.popoverOutsideHandler) {
      document.removeEventListener("mousedown", this.popoverOutsideHandler, true);
      document.removeEventListener("keydown", this.popoverOutsideHandler as EventListener, true);
      this.popoverOutsideHandler = null;
    }
    if (this.popoverScrollResizeCleanup) {
      this.popoverScrollResizeCleanup();
      this.popoverScrollResizeCleanup = null;
    }
    // Remove popover DOM node from the portal (if any open popover was rendered).
    const existingPopover = this.popoverPortal.querySelector<HTMLDivElement>(".vms-filter-popover");
    if (existingPopover) this.popoverPortal.removeChild(existingPopover);
    this.activePopover = null;

    // Phase 12 (CHART-01/03) — reset the per-render chart bookkeeping (NOT
    // chartInstances, which is deliberately persistent). Same per-render reset
    // model as sectionKeyCounter: keys must compute identically across the
    // rebuild + the post-rebuild mark-sweep below.
    this.chartKeyCounter = new Map();
    this.chartKeysSeen = new Set();

    // v8.2.0 (RICH-01) — reset the per-render TipTap editor bookkeeping (NOT
    // editorInstances, which is deliberately persistent). Same posture as the
    // chart bookkeeping above.
    this.editorKeyCounter = new Map();
    this.editorKeysSeen = new Set();

    // v9.1.0 (Plan 30-05) — reset the per-render chat-composer bookkeeping
    // (NOT composerRegistry, which is deliberately persistent so attachments
    // survive re-renders). Same posture as the chart/editor bookkeeping above.
    this.composerKeyCounter = new Map();
    this.composerKeysSeen = new Set();

    this.container.innerHTML = "";
    // Re-append the popover portal after the innerHTML wipe (the wipe removes
    // all container children, including the portal — it must be re-attached so
    // openFilterPopover's appendChild and container.querySelector both work).
    this.container.appendChild(this.popoverPortal);
    this.node(vm, this.container, onAction);

    // Phase 12 (CHART-03) — mark-sweep: destroy + drop any Chart instance whose
    // key was NOT rendered this pass (a ChartNode removed from the new tree), so
    // instances never leak across a long session. Swept POST-rebuild (unlike the
    // fits pre-wipe disconnect) because a persisting chart's canvas must survive
    // the innerHTML wipe to be reused for an in-place .update().
    for (const [key, entry] of this.chartInstances) {
      if (!this.chartKeysSeen.has(key)) {
        entry.chart?.destroy();
        this.chartInstances.delete(key);
      }
    }

    // v8.2.0 (RICH-01) — mark-sweep the editorInstances map against the keys
    // rendered this pass, exact same shape as the chart sweep above. A
    // RichTextFieldNode removed from the new tree destroys its TipTap Editor
    // and drops the entry rather than leaking it across a long session. The
    // editor DOM host is naturally already gone (part of the innerHTML wipe);
    // the destroy() call is what tears down TipTap's event listeners, undo
    // manager, and internal state.
    for (const [key, entry] of this.editorInstances) {
      if (!this.editorKeysSeen.has(key)) {
        entry.editor?.destroy();
        this.editorInstances.delete(key);
      }
    }

    // v9.1.0 (Plan 30-05, CHAT-04..08) — mark-sweep the composerRegistry
    // against the keys rendered this pass, exact same shape as the chart /
    // editor sweeps above. A ChatComposerNode removed from the new tree
    // drops its registry entry AND revokes every pending blob URL — the
    // browser does NOT revoke blob URLs via GC, so an unattended composer
    // unmount would leak the createObjectURL() slots for the life of the
    // document. Revocation is idempotent; images pointing at the revoked
    // URL are already detached (part of the innerHTML wipe).
    for (const [key, entry] of this.composerRegistry) {
      if (!this.composerKeysSeen.has(key)) {
        for (const f of entry.attachedFiles) {
          if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
        }
        this.composerRegistry.delete(key);
      }
    }

    // Phase 21 (LOOK-05) — mark-sweep the live regions against the keys rendered
    // this pass, exactly as the chart sweep above does: a lookup removed from
    // the new tree drops its two region nodes rather than leaking them for the
    // life of the session. Swept POST-rebuild, like the charts and for the same
    // reason — a PERSISTING lookup's regions must survive the innerHTML wipe to
    // be re-appended by field().
    for (const key of this.liveRegions.keys()) {
      if (!this.lookupKeysSeen.has(key)) this.liveRegions.delete(key);
    }

    if (focusId) {
      const el = this.container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `#${CSS.escape(focusId)}`
      );
      if (el) {
        el.focus({ preventScroll: true });
        if (selStart !== null && selEnd !== null) {
          try { el.setSelectionRange(selStart, selEnd); } catch { /* nothing */ }
        }
      }
    }

    scrollMap.forEach(({ top, left }, id) => {
      const el = this.container.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (el) { el.scrollTop = top; el.scrollLeft = left; }
    });

    // SectionNode.followTail restore — runs AFTER the generic scrollMap restore
    // so it wins on any element carrying both an id and data-follow-tail. Walk
    // the rebuilt feeds in document order and match them to the pre-render
    // snapshot by ordinal: a feed that WAS near the bottom (or is brand new, no
    // snapshot at its ordinal) is pinned to the NEW bottom so freshly appended
    // content is visible; a feed the user had scrolled up in keeps its place.
    this.container.querySelectorAll<HTMLElement>("[data-follow-tail]").forEach((el, i) => {
      const snap = followTail[i];
      if (!snap || snap.nearBottom) el.scrollTop = el.scrollHeight;
      else el.scrollTop = snap.top;
    });

    // Only restore window scroll when the page was actually scrolled — restoring
    // to (0,0) is a no-op, and skipping it avoids jsdom's noisy "Not implemented:
    // window.scrollTo" virtual-console log in unit tests (jsdom never scrolls, so
    // the captured offsets are 0). Mirrors the `el.scrollTop !== 0` guard above.
    if (winScrollX !== 0 || winScrollY !== 0) window.scrollTo(winScrollX, winScrollY);

    // 1.2.0 — restore collapsible-section open state after node() rebuild +
    // after focus/scroll restore. Keys absent from the new tree are
    // naturally dropped (querySelectorAll just doesn't find them); new
    // sections that didn't exist pre-render are naturally fresh-closed (no
    // map entry). Only true entries need restore action — false entries
    // match the native default and are no-ops.
    this.container.querySelectorAll<HTMLDetailsElement>("[data-section-key]").forEach(el => {
      const key = el.dataset.sectionKey;
      if (key != null && this.detailsOpenSnapshot.get(key) === true) {
        el.open = true;
      }
    });
    this.detailsOpenSnapshot.clear();
    this.sectionKeyCounter.clear();
    this.lookupOpenSnapshot.clear();
  }

  navigate(url: string): void {
    window.location.href = url;
  }

  storage(scope: "local" | "session", key: string, value: string): void {
    const store = scope === "session" ? sessionStorage : localStorage;
    store.setItem(key, value);
  }

  saveFile(data: Blob, filename: string, _contentType: string): void {
    const url = URL.createObjectURL(data);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }

  setBusy(active: boolean): void {
    this.container.classList.toggle("vms-busy", active);
  }

  /** 3.8.0 — force a full page reload. The shell calls this as the fail-closed
   *  recovery for a `stale_client` rejection (a mutation refused because this
   *  tab is running an out-of-date bundle). `window.location.reload()` pulls the
   *  fresh, cache-revalidated shell + bundle. Fail-quiet by absence in core (the
   *  `stale_client` VmsActionError already surfaced via onError), so this is a
   *  plain implementation, not a fail-loud capability. */
  reload(): void {
    window.location.reload();
  }

  /** 9.0.0 (SKEW-05) — implementation of the Adapter.showSkewLock verb.
   *  Fired by the shell's lockSkew helper on either version-skew signal
   *  (see viewmodel-shell/src/index.ts checkVersionSkew mismatch branch +
   *  stale_client catch arm). Framework-owned non-dismissible modal:
   *  backdrop + centered warning-tone dialog + single [Reload] button that
   *  calls this.reload(). The consumer's onVersionSkew:"custom" opt-out
   *  short-circuits BEFORE the verb is invoked, so if execution reaches
   *  here, we ARE going to hard-lock.
   *
   *  Idempotent: a second call while the lock is up finds the existing DOM
   *  and no-ops (matches toast-region idiom). The container gets `inert`
   *  so the underlying page is unfocusable/uninteractable while the modal
   *  is up.
   *
   *  DELIBERATE DEVIATIONS from the shipped modal() renderer:
   *   - NO `.vms-modal__close` X button
   *   - NO backdrop-click dismiss handler
   *   - NO Escape key handler
   *   - NOT part of the render pipeline (imperative verb; attaches to
   *     document.body directly, not to a parent supplied by render())
   *  The only path out is the [Reload] button — that IS the point of the
   *  phase. Silent auto-reload is retired; the user MUST consent. */
  showSkewLock(_info?: { clientBuild?: string; serverBuild?: string }): void {
    // Idempotent: second call finds existing DOM and no-ops.
    if (document.querySelector<HTMLElement>(".vms-skew-lock")) return;

    // Make the underlying page unfocusable while the modal is up (CONTEXT specifics).
    this.container.setAttribute("inert", "");

    const backdrop = document.createElement("div");
    backdrop.className = "vms-skew-lock";

    const dialog = document.createElement("div");
    dialog.className = "vms-skew-lock__dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "vms-skew-lock-title");

    // Warning-tone icon (Lucide alert-triangle via renderIconSvg — same seam
    // as AlertNode; matches ALERT_TONE_ICON.warning mapping).
    const iconWrap = document.createElement("div");
    iconWrap.className = "vms-skew-lock__icon";
    iconWrap.appendChild(this.renderIconSvg("alert-triangle", "lg", undefined, undefined));
    dialog.appendChild(iconWrap);

    const title = document.createElement("div");
    title.id = "vms-skew-lock-title";
    title.className = "vms-skew-lock__title";
    title.textContent = "This app is out of date"; // CONTEXT-locked copy
    dialog.appendChild(title);

    const body = document.createElement("div");
    body.className = "vms-skew-lock__body";
    body.textContent = "Reload to continue. Any unsaved changes will be lost."; // CONTEXT-locked copy
    dialog.appendChild(body);

    const reloadBtn = document.createElement("button");
    reloadBtn.type = "button";
    reloadBtn.className = "vms-skew-lock__reload-btn";
    reloadBtn.textContent = "Reload"; // CONTEXT-locked copy
    reloadBtn.addEventListener("click", () => this.reload()); // reuse shipped verb
    dialog.appendChild(reloadBtn);

    // NO close X button. NO backdrop-click dismiss handler. NO Escape handler.
    // Only path out is the [Reload] button. This is the point of the phase —
    // "silent recovery is retired; user must consent to reload."

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    // Auto-focus the Reload button for keyboard/SR accessibility (learned gap
    // from ExpenseTracker's in-modal success card per AGENTS.md's "In-modal
    // success feedback" section).
    reloadBtn.focus();
  }

  /** Transient confirmation toast. Lazily creates/reuses a single fixed-corner
   *  host region (.vms-toast-region) appended to <body> so toasts stack and
   *  survive the container's innerHTML wipe on each render(); appends a
   *  .vms-toast element (+ tone modifier) and auto-removes it after
   *  durationMs (default 4000), with a brief fade-out. This is the ONLY place
   *  toast DOM lives — core stays platform-agnostic (it just calls this verb).
   *  Fail-quiet by absence is the core's concern (it optional-chains the call). */
  toast(message: string, opts?: { tone?: string; durationMs?: number }): void {
    let region = document.querySelector<HTMLElement>(".vms-toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "vms-toast-region";
      document.body.appendChild(region);
    }
    const el = document.createElement("div");
    el.className = `vms-toast${opts?.tone ? ` vms-toast--${opts.tone}` : ""}`;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.textContent = message;
    region.appendChild(el);

    const duration = opts?.durationMs ?? 4000;
    setTimeout(() => {
      el.classList.add("vms-toast--leaving");
      // Remove after the fade-out transition; a short fixed delay keeps it
      // simple (no transitionend bookkeeping). Clean up the region if it empties.
      setTimeout(() => {
        el.remove();
        if (region && region.childElementCount === 0) region.remove();
      }, 200);
    }, duration);
  }

  private unloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
  setPreventUnload(active: boolean): void {
    if (active && this.unloadHandler == null) {
      this.unloadHandler = (e: BeforeUnloadEvent): void => {
        e.preventDefault();
        e.returnValue = "";
      };
      window.addEventListener("beforeunload", this.unloadHandler);
    } else if (!active && this.unloadHandler != null) {
      window.removeEventListener("beforeunload", this.unloadHandler);
      this.unloadHandler = null;
    }
  }

  async transport(
    input: string,
    init: { method?: string; headers?: Record<string, string>; body?: FormData | string },
    hooks?: { onUploadProgress?: (sent: number, total: number) => void },
  ): Promise<Response> {
    const onUploadProgress = hooks?.onUploadProgress;
    if (!onUploadProgress) {
      return fetch(input, init);
    }

    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(init.method ?? "POST", input);
      for (const [k, v] of Object.entries(init.headers ?? {})) {
        xhr.setRequestHeader(k, v);
      }

      let knownTotal = 0;
      let lastLoaded = 0;

      xhr.upload.onprogress = (e: ProgressEvent) => {
        lastLoaded = e.loaded;
        if (e.lengthComputable) {
          knownTotal = e.total;
          onUploadProgress(e.loaded, e.total);
        } else {
          onUploadProgress(e.loaded, 0);
        }
      };

      xhr.onload = () => {
        if (knownTotal > 0) onUploadProgress(knownTotal, knownTotal);
        else onUploadProgress(lastLoaded, lastLoaded);
        if (xhr.status === 0) {
          reject(new Error(`Transport request to ${input} failed (status 0)`));
          return;
        }
        resolve(
          new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
          }),
        );
      };

      xhr.onerror = () => reject(new Error(`Transport request to ${input} failed`));
      xhr.ontimeout = () => reject(new Error(`Transport request to ${input} timed out`));
      xhr.onabort = () => reject(new Error(`Transport request to ${input} aborted`));

      xhr.send(init.body ?? null);
    });
  }

  private node(n: ViewNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    switch (n.type) {
      case "page":      return this.page(n, parent, on);
      case "section":   return this.section(n, parent, on);
      case "list":      return this.list(n, parent, on);
      case "list-item": return this.listItem(n, parent, on);
      case "form":      return this.form(n, parent, on);
      case "field":     return this.field(n, parent, on);
      case "checkbox":  return this.checkbox(n, parent, on);
      case "button":    return this.button(n, parent, on);
      case "text":      return this.text(n, parent);
      case "link":      return this.link(n, parent);
      case "image":     return this.image(n, parent);
      case "stat-bar":  return this.statBar(n, parent);
      case "tabs":      return this.tabs(n, parent, on);
      case "progress":  return this.progress(n, parent);
      case "modal":        return this.modal(n, parent, on);
      case "table":        return this.table(n, parent, on);
      case "copy-button":  return this.copyButton(n, parent);
      case "divider":      return this.divider(n, parent);
      case "fits":         return this.fits(n, parent, on);
      case "blockquote":   return this.blockquote(n, parent, on);
      case "code-block":   return this.codeBlock(n, parent);
      case "empty-state":  return this.emptyState(n, parent, on);
      case "badge":        return this.badge(n, parent);
      case "chart":        return this.chart(n, parent);
      case "breadcrumb":   return this.breadcrumb(n, parent, on);
      case "steps":        return this.steps(n, parent);
      case "tracker":      return this.tracker(n, parent, on);
      case "diff":         return this.diff(n, parent);
      case "icon":         return this.icon(n, parent);
      case "avatar":       return this.avatar(n, parent);
      case "list-row":     return this.listRow(n, parent, on);
      case "message":      return this.message(n, parent, on);
      case "message-list": return this.messageList(n, parent, on);
      case "alert":        return this.alert(n, parent, on);
      case "user-row":     return this.userRow(n, parent, on);
      case "detail-row":   return this.detailRow(n, parent, on);
      case "detail-list":  return this.detailList(n, parent, on);
      case "timeline":       return this.timeline(n, parent, on);
      case "timeline-entry": return this.timelineEntry(n, parent, on);
      case "setting-list":   return this.settingList(n, parent, on);
      case "setting-row":    return this.settingRow(n, parent, on);
      case "chip":           return this.chip(n, parent, on);
      case "chip-list":      return this.chipList(n, parent, on);
      case "rich-text-field":   return this.richTextField(n, parent, on);
      case "rich-text-toolbar": return this.richTextToolbar(n, parent, on);
      case "chat-composer":     return this.chatComposer(n, parent, on);
      default: {
        // Fail loud, not silent (AGENTS.md: "Nothing important fails quietly").
        // Runtime trees are server-controlled JSON, so an unknown/forward-version
        // node type CAN reach here at runtime even though the union is
        // exhaustive at compile time. We keep rendering the rest of the tree
        // (forward-compatible, like unknown sideEffect types) but warn so the
        // node doesn't just vanish without a trace.
        const unknownType = (n as { type?: unknown }).type;
        console.warn(
          `[viewmodel-shell] Unknown node type ${JSON.stringify(unknownType)} — ` +
          `rendering nothing for it. The client may be older than the server's tree.`,
        );
        return;
      }
    }
  }

  private kids(nodes: ViewNode[], parent: HTMLElement, on: (a: ActionEvent) => void): void {
    nodes.forEach(n => this.node(n, parent, on));
  }

  private page(n: PageNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const el = document.createElement("div");
    el.className = `vms-page${n.density === "compact" ? " vms-page--compact" : ""}${
      n.layout && n.layout !== "stack" ? ` vms-page--${n.layout}` : ""}${
      n.fill === true ? " vms-page--fill" : ""}${
      n.width ? ` vms-page--${n.width}` : ""}${
      n.arrange ? ` vms-arrange--${n.arrange}` : ""}${
      n.align ? ` vms-align--${n.align}` : ""}${
      n.threshold ? ` vms-switch--${n.threshold}` : ""}${
      n.limit ? ` vms-switch-limit--${n.limit}` : ""}${
      n.minItem ? ` vms-cards-min--${n.minItem}` : ""}`;
    if (n.title) {
      const h = document.createElement("h1");
      h.className = "vms-page__title";
      h.textContent = n.title;
      el.appendChild(h);
    }
    this.kids(n.children, el, on);
    parent.appendChild(el);
  }

  /**
   * Phase 10 (FITS-01) — the SwiftUI `ViewThatFits` measure-and-pick renderer.
   * Renders each candidate in order and keeps the FIRST that does not overflow
   * the container on `axis` (1px tolerance to avoid sub-pixel false positives),
   * leaving the LAST candidate rendered as the guaranteed-fits fallback if none
   * fit. `pick()` runs SYNCHRONOUSLY inside one frame, so the browser paints
   * only the final choice — no flash of intermediate candidates.
   *
   * No-layout fallback: when `container.clientWidth === 0` (jsdom / SSR /
   * detached / display:none) measurement is unavailable, so it renders ONLY the
   * LAST (safe-fallback) child.
   *
   * The `.vms-fits` container is a full-width block (CSS), so its observed width
   * is PARENT-driven — it reflects the available space, not the chosen child.
   * That keeps measurement correct AND prevents a measure→resize feedback loop,
   * making observing the container stable. A `ResizeObserver` re-runs `pick()`
   * on a window/parent resize and is tracked in `fitsObservers` for the next
   * render's disconnect-and-clear.
   *
   * Known v1 limitation (document, don't solve): a resize-triggered candidate
   * switch rebuilds the fits subtree, so focus/caret/draft state INSIDE a fits
   * child may reset on a resize-switch. The framework's normal focus/scroll
   * preservation covers server-driven re-renders, not this resize-switch path.
   */
  private fits(n: FitsNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const container = document.createElement("div");
    container.className = "vms-fits";
    parent.appendChild(container);

    const axis = n.axis ?? "horizontal";
    const candidates = n.children;

    const pick = (): void => {
      // Defensive: a fits with no children is a degenerate tree.
      if (candidates.length === 0) return;

      const vertical = axis === "vertical";
      // The available space is the container's REAL (constrained) box. The
      // container is block / full-width so this is the slot the parent gave it,
      // not the chosen child's size.
      const available = vertical ? container.clientHeight : container.clientWidth;

      // No-layout guard: measurement unavailable (jsdom / SSR / display:none /
      // detached) → render the safe LAST child (guaranteed-fits fallback).
      if (available === 0) {
        container.innerHTML = "";
        this.node(candidates[candidates.length - 1], container, on);
        return;
      }

      // Measure each candidate's INTRINSIC size in an off-screen probe, NOT its
      // constrained rendered size. This is the crux of a correct ViewThatFits:
      // a candidate like a flex-wrap `row` SHRINKS / WRAPS to fit any width, so
      // its in-container scrollWidth never exceeds clientWidth — measuring that
      // would make every candidate "fit" and the selection would never change
      // (the bug this replaces). Measuring the probe at `width: max-content`
      // lets the candidate lay out at its IDEAL width (one line, no wrap), which
      // is what ViewThatFits compares against the proposed size. The probe is
      // appended to `container` for correct style/font inheritance but kept
      // off-screen + hidden, and it does NOT change the container's observed
      // border-box, so the ResizeObserver below cannot feed back into itself.
      const probe = document.createElement("div");
      probe.setAttribute("aria-hidden", "true");
      probe.style.cssText =
        "position:absolute;left:-99999px;top:0;visibility:hidden;pointer-events:none;";
      if (vertical) {
        // Vertical fit: constrain width to the real available width and measure
        // the resulting intrinsic height against the available height.
        probe.style.width = `${available}px`;
      } else {
        probe.style.width = "max-content"; // intrinsic (ideal, unwrapped) width
      }
      container.appendChild(probe);

      let chosen = candidates.length - 1; // fallback = last
      for (let i = 0; i < candidates.length; i++) {
        probe.innerHTML = "";
        this.node(candidates[i], probe, on);
        void probe.offsetWidth; // force a synchronous reflow before reading
        const intrinsic = vertical ? probe.scrollHeight : probe.scrollWidth;
        // First candidate whose intrinsic size fits the available space wins.
        if (intrinsic <= available + 1) { chosen = i; break; }
      }

      probe.remove();
      container.innerHTML = "";
      this.node(candidates[chosen], container, on);
    };

    pick();

    const ro = new ResizeObserver(() => pick());
    ro.observe(container);
    this.fitsObservers.push(ro);
  }

  /**
   * ChartNode (CHARTBASE-02/03) — the multi-series base set (bar/line/area/
   * pie/donut) drawn by Chart.js, loaded as a PRIVATE, LAZY, OPTIONAL adapter
   * dependency: the dynamic `import("chart.js")` in loadChart() is reached
   * ONLY when a ChartNode renders, and it registers the base-set pieces so an
   * app that renders no chart loads zero chart.js bytes (the core + .NET/bun
   * backends gain no dependency). Every color is read via getComputedStyle
   * from the `--vms-chart-1..8` categorical palette (18-02) or, when a series
   * carries a `tone`, from the theme's tone token — NO raw CSS crosses the wire.
   *
   * The canvas + Chart instance are keyed by a stable per-render ordinal and kept
   * in `chartInstances` ACROSS renders, so a re-render with changed data reuses
   * the SAME canvas (detached, not destroyed, by render()'s innerHTML wipe — its
   * 2D context + bitmap survive) and redraws IN PLACE via `.update()` rather than
   * reconstructing. render() mark-sweeps + destroy()s any instance the new tree
   * dropped (leak prevention). getComputedStyle / canvas / Chart.js live ONLY
   * here in browser.ts — the core (index.ts) stays platform-agnostic.
   */
  private chart(n: ChartNode, parent: HTMLElement): void {
    // Stable key: title-derived base disambiguated by a per-render ordinal so
    // multiple/anonymous charts get distinct keys that compute identically across
    // renders (mirrors the collapsible-section key disambiguation).
    const baseKey = n.title ?? "vms-chart-anon";
    const ordinal = this.chartKeyCounter.get(baseKey) ?? 0;
    this.chartKeyCounter.set(baseKey, ordinal + 1);
    const key = `${baseKey}#${ordinal}`;
    this.chartKeysSeen.add(key);

    const wrapper = document.createElement("div");
    wrapper.className = "vms-chart";
    parent.appendChild(wrapper);

    // tone → theme token, NOT `--vms-${tone}`: `danger` maps to `--vms-error`
    // (matching .vms-section--danger). Used ONLY when a series declares a
    // `tone` — otherwise a series/slice gets the next categorical palette slot.
    const toneToken: Record<string, string> = {
      danger: "--vms-error",
      warning: "--vms-warning",
      success: "--vms-success",
      info: "--vms-info",
    };
    const cs = getComputedStyle(this.container);
    // Categorical palette slot i (0-based) → --vms-chart-1..8, cycling. Falls
    // back to --vms-accent (the pre-reshape safety net) when a consumer's
    // custom theme (built via the sanctioned --vms-* override seam) predates
    // this phase and doesn't define the chart tokens — every SHIPPED theme
    // does, so this only matters for external reskins.
    const paletteColor = (i: number): string =>
      cs.getPropertyValue(`--vms-chart-${(i % 8) + 1}`).trim() || cs.getPropertyValue("--vms-accent").trim();
    // A series' resolved color: its tone token if set, else the next palette slot.
    const seriesColor = (i: number, tone?: string): string =>
      (tone && toneToken[tone]) ? cs.getPropertyValue(toneToken[tone]).trim() : paletteColor(i);
    // Grid/tick/axis/text colors track the theme so the chart reads consistently
    // in light AND dark. Chart.js's defaults are FIXED near-black — its grid is
    // rgba(0,0,0,0.1) and its text (legend labels + title) is #666 — visible on a
    // light background but low-contrast/~invisible on a dark one. So wire the grid
    // + axis border to `--vms-border` (subtle in every theme), the tick labels
    // (secondary) to `--vms-text-muted`, and the legend labels + title (the text
    // that NAMES the series/chart — primary information) to the full-contrast
    // `--vms-text` so they read prominently, not washed out.
    const gridColor = cs.getPropertyValue("--vms-border").trim();
    const tickColor = cs.getPropertyValue("--vms-text-muted").trim();
    const textColor = cs.getPropertyValue("--vms-text").trim();
    const scaleOpts = {
      grid:   { color: gridColor },
      border: { color: gridColor },
      ticks:  { color: tickColor },
    };

    const kind = n.kind ?? "bar";
    const isPie = kind === "pie" || kind === "donut";

    let type: string;
    let datasets: any[];

    if (isPie) {
      // pie/donut are single-series (LOCKED design): render series[0] only,
      // colored PER SLICE from the palette (tone is a per-series concept and
      // doesn't apply to a per-slice pie). Extra series are lenient — one dev
      // warning, series[0] still renders — never a crash. Gated to the FIRST
      // render of this chart key (chartInstances doesn't have it yet) so a
      // mis-shaped pie/donut in a polling view warns once, not once per poll.
      if (n.series.length > 1 && !this.chartInstances.has(key)) {
        console.warn(
          `[ViewModelShell] ChartNode kind "${kind}" renders a single series; ` +
          `${n.series.length - 1} extra series ignored.`
        );
      }
      const primary = n.series[0];
      type = kind === "donut" ? "doughnut" : "pie";
      datasets = [{
        data: primary ? primary.data : [],
        backgroundColor: n.labels.map((_, j) => paletteColor(j)),
      }];
    } else {
      // bar/line/area — one dataset per series, sharing the `labels` x-axis.
      type = (kind === "line" || kind === "area") ? "line" : "bar";
      datasets = n.series.map((s, i) => {
        const color = seriesColor(i, s.tone);
        const dataset: any = {
          label: s.name,
          data: s.data,
          backgroundColor: color,
          borderColor: color,
        };
        if (kind === "line" || kind === "area") {
          // area = line + fill; the fill is token-derived (same resolved color
          // as the stroke) — no raw color literal introduced for the fill.
          dataset.fill = kind === "area";
        }
        return dataset;
      });
    }

    // `stacked` applies to bar/area only (LOCKED design); ignored for line/pie/donut.
    const stacked = (kind === "bar" || kind === "area") && !!n.stacked;
    // Legend: multi-series always, OR pie/donut (always multi-slice).
    const legendDisplay = n.series.length > 1 || isPie;

    const config = {
      type,
      data: { labels: n.labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...(isPie ? {} : {
          scales: {
            x: { ...scaleOpts, stacked },
            y: { ...scaleOpts, stacked },
          },
        }),
        plugins: {
          title: n.title ? { display: true, text: n.title, color: textColor } : { display: false },
          legend: { display: legendDisplay, labels: { color: textColor } },
        },
      },
    };

    const existing = this.chartInstances.get(key);
    if (existing) {
      // Reuse the SAME canvas element (detached by the innerHTML wipe, not
      // destroyed) — its 2D context + drawn bitmap survive.
      wrapper.appendChild(existing.canvas);
      if (existing.chart) {
        // Redraw in place (CHARTBASE-03).
        existing.chart.data = config.data;
        existing.chart.options = config.options;
        existing.chart.update();
      } else {
        // Still loading — stash the newest config to apply when the import resolves.
        existing.latest = config;
      }
      return;
    }

    // First render of this key: create a fresh canvas + kick the lazy loader
    // (do NOT await inside the synchronous render()).
    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);
    this.chartInstances.set(key, { canvas, chart: null, latest: config });
    void this.loadChart(key, config);
  }

  /**
   * Lazily import chart.js and construct the Chart for `key`. The dynamic import
   * is what keeps chart.js zero-bytes-when-absent; registering the base-set
   * controllers/elements/scales/plugins (bar, line+fill, pie/doughnut, plus the
   * shared category/linear scales, tooltip, and legend) covers every kind the
   * widened chart() config can construct. Fire-and-forget from chart()
   * (`void this.loadChart(...)`), so a missing dependency is surfaced through the
   * fail-loud seam (chartFailLoud), NEVER a floating unhandled rejection.
   */
  private async loadChart(key: string, config: any): Promise<void> {
    let mod: any;
    try {
      mod = await import("chart.js");
    } catch {
      this.chartFailLoud(
        "ChartNode present but the optional peer dependency 'chart.js' is not " +
        "installed. Run: npm install chart.js"
      );
      return;
    }
    const {
      Chart,
      BarController, BarElement,
      LineController, LineElement, PointElement, Filler,
      PieController, DoughnutController, ArcElement,
      CategoryScale, LinearScale,
      Tooltip, Legend,
    } = mod;
    // Base-set registration — bar, line/area (+ Filler for the area fill),
    // pie/donut (+ Arc element), the shared scales, tooltip, and the legend.
    Chart.register(
      BarController, BarElement,
      LineController, LineElement, PointElement, Filler,
      PieController, DoughnutController, ArcElement,
      CategoryScale, LinearScale,
      Tooltip, Legend,
    );
    const entry = this.chartInstances.get(key);
    // A later render may have mark-swept this key before the import resolved.
    if (!entry) return;
    entry.chart = new Chart(entry.canvas, entry.latest ?? config);
    entry.latest = null;
  }

  /**
   * Fail-loud for a missing chart.js — routed through the SAME sanctioned seam as
   * the other no-safe-default capabilities (AGENTS.md fail-loud rule). The
   * BrowserAdapter holds no ShellOptions.onError reference, so it uses the
   * AGENTS.md-sanctioned fallback (console.error). NEVER a silent no-op, NEVER a
   * floating unhandled rejection — deterministic + spy-able in tests.
   */
  private chartFailLoud(msg: string): void {
    console.error("[ViewModelShell]", new Error(msg));
  }

  /**
   * v8.2.0 (RICH-01) — RichTextFieldNode. First-class WYSIWYG rich text input
   * primitive. Wire value is a MARKDOWN STRING on `bind`; the editor renders
   * TipTap (bundled + lazy-imported per D-04 / Chart.js precedent). On the
   * editor's `update` event turndown converts editor HTML → markdown and
   * writes the markdown string to `bind` — the exact same write-back seam
   * FieldNode(textarea) uses.
   *
   * The Editor + host DOM SURVIVE render()'s innerHTML wipe via the
   * `editorInstances` persist-across-renders map (byte-analog of
   * `chartInstances`). Reusing the host preserves the user's caret,
   * selection, undo history, and IME composition state — a fresh Editor per
   * render would wipe them all.
   *
   * The lazy import from `loadRichText()` keeps consumers who never render a
   * RichTextFieldNode at ZERO TipTap/turndown bytes (D-04). The symmetric
   * test in `test/rich-text.test.ts` proves that guarantee holds.
   */
  private richTextField(
    n: RichTextFieldNode,
    parent: HTMLElement,
    _on: (a: ActionEvent) => void,
  ): void {
    // Stable key: `name` disambiguated by per-render ordinal (mirrors the
    // chart title+ordinal scheme). Multiple RichTextFieldNodes with the same
    // name in one tree still get distinct keys that compute identically
    // across renders.
    const baseKey = n.name;
    const ordinal = this.editorKeyCounter.get(baseKey) ?? 0;
    this.editorKeyCounter.set(baseKey, ordinal + 1);
    const key = `${baseKey}#${ordinal}`;
    this.editorKeysSeen.add(key);

    // Field wrapper — mirrors FieldNode's shape (label above input; state-axis
    // BEM modifier applied to the wrapper). `data-editor-key` is the pointer
    // the RichTextToolbarNode composite reads via closest() to resolve which
    // editor a nested-slot toolbar drives (Plan 28-05 richTextToolbarInvoke).
    const wrapper = document.createElement("div");
    const classes = ["vms-rich-text-field"];
    if (n.state) classes.push(`vms-rich-text-field--state-${n.state}`);
    wrapper.className = classes.join(" ");
    wrapper.dataset.editorKey = key;

    if (n.label) {
      const label = document.createElement("label");
      label.className = "vms-rich-text-field__label";
      label.htmlFor = `vms-${n.name}`;
      label.textContent = n.label;
      wrapper.appendChild(label);
    }

    // Default toolbar strip (D-08 floor) — rendered ONLY when the app has NOT
    // supplied its own `toolbar?` slot. When they have, richTextToolbar()
    // renders that composite in its place (Plan 28-05 replaces the placeholder).
    if (!n.toolbar) {
      wrapper.appendChild(this.renderDefaultRichTextToolbar(key));
    } else {
      this.richTextToolbar(n.toolbar, wrapper, _on);
    }

    const stateValue = this.readBind(n.bind);
    const md = stateValue == null ? "" : String(stateValue);

    const existing = this.editorInstances.get(key);
    if (existing) {
      // Reuse the SAME host across renders — its DOM state IS the editor
      // state. This preserves caret / selection / undo history.
      wrapper.appendChild(existing.host);
      // Only setContent if the SERVER changed the value (differs from what
      // the user last typed). Equality means "we already have that content"
      // — calling setContent anyway would wipe caret/selection/undo history.
      if (existing.editor && md !== existing.latestBindValue) {
        // Reuse existing markdown-loader via loadRichText — but here the
        // editor exists, so we just re-parse + setContent inline.
        void (async (): Promise<void> => {
          const marked = await import("marked");
          const html = marked.marked.parse(md);
          existing.editor.commands.setContent(html);
          existing.latestBindValue = md;
        })();
      }
      parent.appendChild(wrapper);
      return;
    }

    // First render of this key: create the host + kick the lazy loader (do
    // NOT await inside the synchronous render()). Mirrors the chart()
    // `void this.loadChart(...)` pattern at browser.ts:882-884.
    const host = document.createElement("div");
    host.className = "vms-rich-text-field__editor";
    host.id = `vms-${n.name}`;
    if (n.placeholder) host.dataset.placeholder = n.placeholder;
    if (n.disabled) host.setAttribute("aria-disabled", "true");
    wrapper.appendChild(host);
    this.editorInstances.set(key, {
      host,
      editor: null,
      turndown: null,
      latestBindValue: md,
    });
    void this.loadRichText(key, n);

    parent.appendChild(wrapper);
  }

  /**
   * Default toolbar strip renderer — D-08 Slack/GitHub floor. Emits a
   * `.vms-rich-text-field__toolbar-default` container with one button per
   * shipped tool. Button clicks resolve to TipTap chain commands lazily via
   * the loaded editor at editorInstances.get(key).editor.chain()....
   */
  private renderDefaultRichTextToolbar(key: string): HTMLElement {
    const strip = document.createElement("div");
    strip.className = "vms-rich-text-field__toolbar-default";
    strip.setAttribute("role", "toolbar");
    const FLOOR: RichTextTool[] = [
      "bold", "italic", "link", "bullet-list", "ordered-list",
      "heading-1", "heading-2", "heading-3", "inline-code", "code-block",
      "blockquote",
    ];
    for (const tool of FLOOR) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `vms-rich-text-field__tool vms-rich-text-field__tool--${tool}`;
      btn.textContent = this.richTextToolLabel(tool);
      btn.setAttribute("aria-label", this.richTextToolLabel(tool));
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const entry = this.editorInstances.get(key);
        if (!entry?.editor) return;
        this.applyRichTextTool(entry.editor, tool);
      });
      strip.appendChild(btn);
    }
    return strip;
  }

  private richTextToolLabel(tool: RichTextTool): string {
    switch (tool) {
      case "bold":         return "Bold";
      case "italic":       return "Italic";
      case "link":         return "Link";
      case "bullet-list":  return "Bulleted list";
      case "ordered-list": return "Numbered list";
      case "heading-1":    return "Heading 1";
      case "heading-2":    return "Heading 2";
      case "heading-3":    return "Heading 3";
      case "inline-code":  return "Inline code";
      case "code-block":   return "Code block";
      case "blockquote":   return "Quote";
    }
  }

  private applyRichTextTool(editor: any, tool: RichTextTool): void {
    const chain = editor.chain().focus();
    switch (tool) {
      case "bold":         chain.toggleBold().run(); return;
      case "italic":       chain.toggleItalic().run(); return;
      case "link": {
        const url = typeof window !== "undefined"
          ? window.prompt?.("URL") ?? null
          : null;
        if (url === null) return;
        if (url === "") { chain.unsetLink().run(); return; }
        chain.setLink({ href: url }).run();
        return;
      }
      case "bullet-list":  chain.toggleBulletList().run(); return;
      case "ordered-list": chain.toggleOrderedList().run(); return;
      case "heading-1":    chain.toggleHeading({ level: 1 }).run(); return;
      case "heading-2":    chain.toggleHeading({ level: 2 }).run(); return;
      case "heading-3":    chain.toggleHeading({ level: 3 }).run(); return;
      case "inline-code":  chain.toggleCode().run(); return;
      case "code-block":   chain.toggleCodeBlock().run(); return;
      case "blockquote":   chain.toggleBlockquote().run(); return;
    }
  }

  /**
   * Lazily import TipTap + turndown + marked; construct the Editor for `key`.
   * The three dynamic imports run in a single `Promise.all` under one
   * try/catch — a single rejection fails loud via `richTextFailLoud()` and
   * NEVER a silent no-op fallback (AGENTS.md "The capability seam" fail-loud
   * rule; same posture as `chartFailLoud`).
   *
   * Marked is used for the initial-content pre-load only (markdown → HTML →
   * editor.commands.setContent) per Q7 in the phase context. On subsequent
   * user input, turndown converts editor HTML → markdown and writes to the
   * bind path (the round-trip closes cleanly against the display-side
   * markdown.ts → InlineRuns pipeline).
   */
  private async loadRichText(key: string, n: RichTextFieldNode): Promise<void> {
    let tiptap: any, starterKit: any, turndownMod: any, marked: any;
    try {
      [tiptap, starterKit, turndownMod, marked] = await Promise.all([
        import("@tiptap/core"),
        import("@tiptap/starter-kit"),
        import("turndown"),
        import("marked"),
      ]);
    } catch {
      this.richTextFailLoud(
        "RichTextFieldNode present but TipTap or turndown failed to load. " +
        "Run: npm install @tiptap/core @tiptap/starter-kit turndown"
      );
      return;
    }
    const entry = this.editorInstances.get(key);
    // A later render may have mark-swept this key before the import resolved.
    if (!entry) return;

    const TurndownCtor = turndownMod.default;
    const turndownSvc = new TurndownCtor({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    });

    const initialHtml = marked.marked.parse(entry.latestBindValue);

    const StarterKit = starterKit.default;
    const editor = new tiptap.Editor({
      element: entry.host,
      extensions: [StarterKit],
      content: initialHtml,
      editable: !n.disabled,
    });
    editor.on("update", () => {
      const html: string = editor.getHTML();
      const md: string = turndownSvc.turndown(html);
      entry.latestBindValue = md;
      this.writeBind(n.bind, md);
    });

    entry.editor = editor;
    entry.turndown = turndownSvc;
  }

  /**
   * Fail-loud for a missing / broken TipTap load — routed through the SAME
   * sanctioned seam as chartFailLoud (AGENTS.md fail-loud rule for
   * capabilities with no safe default). NEVER a silent no-op, NEVER a
   * floating unhandled rejection — deterministic + spy-able in tests.
   */
  private richTextFailLoud(msg: string): void {
    console.error("[ViewModelShell]", new Error(msg));
  }

  /**
   * v8.2.0 (RICH-02) — RichTextToolbarNode composite renderer. Emits the
   * first-class .vms-rich-text-toolbar strip with one <button> per entry in
   * `n.tools[]`, plus BEM modifier classes for the closed-enum variance axes
   * (`size`, `tone`, `state`). If `tools` is empty/missing the renderer falls
   * back to the shipped FLOOR (backwards-compat for consumers that supply the
   * slot only to pin a size/tone axis).
   *
   * NESTED-SLOT PATH: richTextField() calls this with `parent = wrapper` BEFORE
   * appending the editor host, so the composite renders inline above the
   * editor. The toolbar walks up the DOM via closest(".vms-rich-text-field")
   * to find its ancestor field's `data-editor-key`, then dispatches the
   * clicked tool through `applyRichTextTool(entry.editor, tool)` — reusing
   * the exact same chain-command mapping as the default-toolbar strip.
   *
   * STANDALONE PATH: a bare RichTextToolbarNode (no ancestor RichTextFieldNode)
   * still renders — variance classes still emit, buttons still appear — but
   * clicks console.warn once per click and are inert. Rare (tasting/demo
   * only). Warn-not-throw contract per the STRIDE T-28-13 disposition.
   */
  private richTextToolbar(
    n: RichTextToolbarNode,
    parent: HTMLElement,
    _on: (a: ActionEvent) => void,
  ): void {
    const el = document.createElement("div");
    const classes = ["vms-rich-text-toolbar"];
    if (n.size)  classes.push(`vms-rich-text-toolbar--size-${n.size}`);
    if (n.tone)  classes.push(`vms-rich-text-toolbar--tone-${n.tone}`);
    if (n.state) classes.push(`vms-rich-text-toolbar--state-${n.state}`);
    el.className = classes.join(" ");
    el.setAttribute("role", "toolbar");

    // Empty/missing tools[] defaults to the full FLOOR — a toolbar node
    // present with no tools still renders a functional strip (matches the
    // default-toolbar path so a consumer who supplies the slot solely to
    // pin `size:"compact"` gets sensible output).
    const FLOOR: RichTextTool[] = [
      "bold", "italic", "link", "bullet-list", "ordered-list",
      "heading-1", "heading-2", "heading-3", "inline-code", "code-block",
      "blockquote",
    ];
    const tools = (n.tools && n.tools.length > 0) ? n.tools : FLOOR;

    for (const tool of tools) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `vms-rich-text-toolbar__tool vms-rich-text-toolbar__tool--${tool}`;
      btn.dataset.tool = tool;
      btn.textContent = this.richTextToolLabel(tool);
      btn.setAttribute("aria-label", this.richTextToolLabel(tool));
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        this.richTextToolbarInvoke(el, tool);
      });
      el.appendChild(btn);
    }
    parent.appendChild(el);
  }

  /**
   * Resolve the ancestor RichTextField's editor and invoke the TipTap chain
   * command via the shared `applyRichTextTool()` helper (byte-identical to
   * the default-toolbar path — no duplicated chain logic). Walks up from the
   * clicked toolbar to find `.vms-rich-text-field`, then looks up the editor
   * from `editorInstances` via the wrapper's `data-editor-key` attribute
   * (written by richTextField() at mount).
   *
   * Standalone case (no ancestor RichTextField): logs a one-shot console.warn
   * and returns — the click is inert, but does not throw. Per STRIDE T-28-13:
   * this is the ONLY safe cross-editor-hijack posture; the closest() walk
   * stops at the nearest field wrapper, so a standalone toolbar cannot
   * silently drive a sibling editor.
   */
  private richTextToolbarInvoke(toolbarEl: HTMLElement, tool: RichTextTool): void {
    const fieldEl = toolbarEl.closest(".vms-rich-text-field") as HTMLElement | null;
    if (!fieldEl) {
      console.warn(
        "[ViewModelShell]",
        "RichTextToolbarNode rendered standalone (no ancestor RichTextFieldNode); toolbar clicks are inert.",
      );
      return;
    }
    const key = fieldEl.dataset.editorKey;
    if (!key) return;
    const entry = this.editorInstances.get(key);
    if (!entry?.editor) return;
    this.applyRichTextTool(entry.editor, tool);
  }

  /** v9.1.0 (CHAT-02..08) — ChatComposerNode adapter.
   *
   *  Emits the unified pill container: framework-owned rounded surface with
   *  three vertical slots (header, main row, footer). The main row lays out
   *  as `flex-align-items:flex-end` with a growable-center textarea flanked
   *  by fixed 34px circular icon buttons — the layout logic Route A
   *  primitives cannot compose (per CONTEXT.md §Problem statement; Panel-3
   *  taste-locked by Ashley 2026-08-02).
   *
   *  Coverage across the CHAT-* requirement set:
   *    - CHAT-02/03: DOM shell + slots + textarea auto-resize (Plan 30-03).
   *    - CHAT-09..12: send-button state machine + keyboard + IME guard
   *      + Backspace-on-empty (Plan 30-04).
   *    - CHAT-04: click-to-picker attach (Plan 30-05).
   *    - CHAT-05: drag-drop-on-composer with dropScope closed union.
   *    - CHAT-06: paste-image handler.
   *    - CHAT-07: attachment preview chip strip + X-remove per chip.
   *    - CHAT-08: sendAction dispatch bundles the attachment registry as
   *      multipart form entries under attachBind.
   *
   *  Auto-resize (CHAT-03) uses CSS `field-sizing: content` on the shipped
   *  `.vms-chat-composer__textarea` rule (single declaration; browser-native;
   *  zero JS on Chrome 123+, Firefox 132+, Safari TP). Feature-detected via
   *  `CSS.supports("field-sizing", "content")`; when unsupported, a compact
   *  JS fallback resizes on `input` by computing scrollHeight capped at
   *  `maxRows` (default 6). Both paths cap identically; overflow scrolls
   *  internally once cap hit.
   *
   *  Attachment registry persistence (Plan 30-05, plan-checker M-1): keyed
   *  by `${bind}:${ordinal}` on `composerRegistry` (persistent Map), NOT
   *  by `bind` alone — two ChatComposerNodes with the same bind on one page
   *  (a threaded chat with per-thread reply composers all bound to "draft",
   *  or two panes each mounting `bind:"draft"`) get distinct entries. Same
   *  disambiguation as sectionKeyCounter. Mark-swept in render(); a
   *  composer removed from the new tree revokes every pending blob URL.
   */
  private chatComposer(
    n: ChatComposerNode,
    parent: HTMLElement,
    on: (a: ActionEvent) => void,
  ): void {
    // Capture `this` for helper closures below (function declarations lose
    // instance-method binding). Declared FIRST so any downstream closure
    // that runs during setup (updateSendButtonDisabled from the initial
    // send-button paint) can safely dereference it — TDZ otherwise fires.
    const chatComposerAdapter = this;

    // ── Persistent per-composer registry key (M-1 hardening: bind + ordinal
    // so two ChatComposerNodes with the same bind don't cross-pollinate).
    const baseKey = n.bind;
    const ordinal = this.composerKeyCounter.get(baseKey) ?? 0;
    this.composerKeyCounter.set(baseKey, ordinal + 1);
    const composerKey = `${baseKey}:${ordinal}`;
    this.composerKeysSeen.add(composerKey);

    let composerState = this.composerRegistry.get(composerKey);
    if (!composerState) {
      composerState = { attachedFiles: [] };
      this.composerRegistry.set(composerKey, composerState);
    }
    // Alias to a local const for closure capture below. Reassigning the
    // shared reference (e.g. splice-in-place) keeps the persisted registry
    // in sync automatically; the closures below MUST NOT rebind this to a
    // new array (`composerState.attachedFiles = [...]`) or the persisted
    // entry decouples. Follow the mutating-only convention.
    const cs = composerState;

    // Fail-loud tree-configuration guards per AGENTS.md capability-seam
    // rule — a misconfigured tree gets a hard, debuggable failure, never a
    // silent no-op. The TS + .NET tree validators (Plan 30-01/02) will
    // eventually reject these at buildVm; the runtime guard closes the
    // wire-drift case for a caller that skipped validation.
    if (n.dropScope !== undefined && !n.attachAction) {
      console.error(
        "[ViewModelShell] ChatComposerNode: dropScope requires attachAction " +
        "(nowhere for a dropped file to go).",
      );
    }
    if (n.attachBind !== undefined && !n.attachAction) {
      console.error(
        "[ViewModelShell] ChatComposerNode: attachBind requires attachAction " +
        "(no picker means no attachments to ride the bind).",
      );
    }

    const root = document.createElement("div");
    root.className = n.disabled === true
      ? "vms-chat-composer vms-chat-composer--disabled"
      : "vms-chat-composer";
    // Wire → DOM: status axis (default "idle") drives Plan 30-04's send-button
    // state machine + Plan 30-07's parity fixture expectBodyContains tripwires.
    root.dataset.composerStatus = n.status ?? "idle";
    // Wire → DOM: drop-scope (default "composer") — Plan 30-05's drag-drop
    // handler reads this to decide document vs composer listener attachment.
    root.dataset.dropScope = n.dropScope ?? "composer";

    // ── Header slot (composer's header row) — the attachment-preview chip
    // strip prepends here when attachedFiles.length > 0. Consumer headerSlot
    // content mounts after; both render together (chip strip first). The
    // `:empty` CSS rule hides the row entirely when neither is present.
    const headerRow = document.createElement("div");
    headerRow.className = "vms-chat-composer__header";
    // Chip strip container mounted FIRST (framework-owned surface); consumer
    // headerSlot content mounts AFTER (below the chips) — per Plan 30-05
    // spec "chip strip FIRST (framework-owned), then the consumer's content
    // BELOW".
    const chipStripEl = document.createElement("div");
    chipStripEl.className = "vms-chat-composer__attachments";
    headerRow.appendChild(chipStripEl);
    if (n.headerSlot) this.node(n.headerSlot, headerRow, on);
    root.appendChild(headerRow);

    // ── Main row: leading slot → attach button → textarea/inputSlot →
    // send button → trailing slot. `flex align-items:flex-end` in CSS
    // keeps buttons aligned to the last line as textarea grows.
    const row = document.createElement("div");
    row.className = "vms-chat-composer__row";

    // Leading slot (rare — most consumers leave empty). Wrap in a 34px min-height
    // flex-centered container so bare icons align vertically with the buttons
    // (row uses align-items:flex-end so buttons stick to bottom as textarea grows;
    // without the wrapper a bare IconNode reads visually offset — Ashley 2026-08-02).
    if (n.leadingSlot) {
      const leading = document.createElement("div");
      leading.className = "vms-chat-composer__leading";
      row.appendChild(leading);
      this.node(n.leadingSlot, leading, on);
    }

    // Attach-button (Plan 30-05, CHAT-04). Renders the icon-only paperclip
    // button when attachAction is set; click triggers the hidden file input.
    // Reuses the shared `.vms-chat-composer__icon-btn` 34px circular geometry.
    // The hidden <input type="file"> is appended INSIDE the row so it lives
    // in the same subtree — cleaned up naturally by the innerHTML wipe.
    let fileInput: HTMLInputElement | null = null;
    if (n.attachAction) {
      const attachBtn = document.createElement("button");
      attachBtn.type = "button";
      attachBtn.className = "vms-chat-composer__attach vms-chat-composer__icon-btn";
      attachBtn.dataset.action = "attach";
      attachBtn.setAttribute("aria-label", "Attach file");
      if (n.disabled === true) attachBtn.disabled = true;
      attachBtn.appendChild(this.renderIconSvg("paperclip", "sm", undefined, undefined));
      row.appendChild(attachBtn);

      // Hidden file input (display:none so no visual chrome). `multiple` when
      // maxFiles is unset or > 1 (the default: unlimited multi-file); accept
      // MIME filter passed straight through when provided.
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.style.display = "none";
      fileInput.className = "vms-chat-composer__file-input";
      const multi = n.maxFiles === undefined || n.maxFiles > 1;
      if (multi) fileInput.multiple = true;
      if (n.accept?.length) fileInput.accept = n.accept.join(",");
      row.appendChild(fileInput);

      // Wire click-to-picker. attachAction fires AFTER files are selected —
      // some apps use it for logging/telemetry; the picker OPEN itself is
      // NOT a dispatchable event (per CONTEXT §L-5 ambiguity, resolved:
      // fire on files-selected so the app sees the actual attach event).
      attachBtn.addEventListener("click", () => {
        if (attachBtn.disabled) return;
        fileInput!.click();
      });

      fileInput.addEventListener("change", () => {
        const files = Array.from(fileInput!.files ?? []);
        const added = addFiles(files);
        fileInput!.value = "";  // reset so re-picking the same file re-fires change
        if (added > 0 && n.attachAction) on(n.attachAction);
      });
    }

    // ── Send-button (Plan 30-04, CHAT-09..10). Full state-machine wiring:
    // icon swap per `n.status`, click routes to sendAction or stopAction,
    // disabled derives from bind text length + attachedFiles count when idle.
    // Runtime guard (fail-loud per capability-seam rule): status="streaming"
    // MUST carry stopAction. The .NET/TS tree validators (CHAT-13) reject
    // such trees at buildVm; this guard closes the wire-drift case at render.
    const status: ChatComposerStatus = n.status ?? "idle";
    const sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.className = "vms-chat-composer__send vms-chat-composer__icon-btn";
    sendBtn.dataset.action = "send";
    sendBtn.dataset.composerStatus = status;

    if (status === "streaming" && !n.stopAction) {
      console.error(
        "[ViewModelShell] ChatComposerNode: status=\"streaming\" requires " +
        "stopAction. Falling back to disabled send button.",
      );
      sendBtn.appendChild(this.renderIconSvg("send", "sm", undefined, undefined));
      sendBtn.classList.add("vms-chat-composer__send--idle");
      sendBtn.disabled = true;
      sendBtn.setAttribute("aria-label", "Send (misconfigured)");
    } else if (status === "sending") {
      // Uses the shipped `loader-2` icon (Phase 22 IconName closed union)
      // spun via the CSS-only `.vms-chat-composer__send--sending .vms-icon`
      // animation shipped in default.css — no new icon, no JS animation lib.
      sendBtn.appendChild(this.renderIconSvg("loader-2", "sm", undefined, undefined));
      sendBtn.classList.add("vms-chat-composer__send--sending");
      sendBtn.disabled = true;
      sendBtn.setAttribute("aria-label", "Sending");
    } else if (status === "streaming") {
      sendBtn.appendChild(this.renderIconSvg("square", "sm", undefined, undefined));
      sendBtn.classList.add("vms-chat-composer__send--streaming");
      sendBtn.setAttribute("aria-label", "Stop generating");
      if (n.disabled === true) sendBtn.disabled = true;
      const stopAction = n.stopAction!;               // guarded above
      sendBtn.addEventListener("click", () => {
        if (sendBtn.disabled) return;
        on(stopAction);
      });
    } else {
      // status === "idle" — the natural case. Send icon + click dispatches
      // sendAction; disabled derives from !canSend when composer isn't
      // explicitly disabled. attachedFiles ride the dispatch as multipart
      // entries under attachBind (Plan 30-05, CHAT-08).
      sendBtn.appendChild(this.renderIconSvg("send", "sm", undefined, undefined));
      sendBtn.classList.add("vms-chat-composer__send--idle");
      const sendAction = n.sendAction;
      sendBtn.setAttribute("aria-label", "Send");
      // Initial disabled + --ready state derived immediately; the shared
      // updateSendButtonDisabled() below re-derives after any attach/remove.
      updateSendButtonDisabled();
      sendBtn.addEventListener("click", () => {
        if (sendBtn.disabled) return;
        // Bundle attached files as multipart entries under attachBind
        // (default "attachments"). Server reads via
        // Request.Form.Files.GetFiles(attachBind) (.NET) / formData
        // multi-value getAll(name) (TS server).
        const attachBind = n.attachBind ?? "attachments";
        const files: File[] = cs.attachedFiles.map(a => a.file);
        const dispatchAction: ActionEvent = files.length > 0
          ? { ...sendAction, files: { ...(sendAction.files ?? {}), [attachBind]: files } }
          : sendAction;
        on(dispatchAction);
        // Clear registry immediately on dispatch (fire-and-forget: the
        // shipped onAction API returns void so we cannot await success).
        // v1 limitation: files are LOST on dispatch failure — an app that
        // needs retain-on-failure must add a shell-level completion
        // callback in a follow-up plan. Documented in Plan 30-05 SUMMARY.
        for (const item of cs.attachedFiles) {
          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        }
        cs.attachedFiles.length = 0;
        renderChipStrip();
        updateSendButtonDisabled();
      });
    }
    // Shared `triggerSend` closure for the textarea keyboard handler below.
    // Routes through the button's own click so the state-machine's branch
    // decision (send vs stop vs no-op-when-disabled) stays in one place.
    const triggerSend = (): void => { sendBtn.click(); };

    // ── Textarea (or inputSlot if consumer provided — opt-in rich-text).
    // The textarea reference is captured in `ta` so the paste-image handler
    // below can attach to it. When inputSlot is set, paste-image is NOT
    // wired (the consumer's RichTextFieldNode has its own paste handling).
    let ta: HTMLTextAreaElement | null = null;
    if (n.inputSlot) {
      this.node(n.inputSlot, row, on);
    } else {
      const stateValue = this.readBind(n.bind);
      ta = document.createElement("textarea");
      ta.className = "vms-chat-composer__textarea";
      ta.value = stateValue == null ? "" : String(stateValue);
      if (n.placeholder != null) ta.placeholder = n.placeholder;
      if (n.disabled === true) ta.disabled = true;
      ta.rows = 1;
      // Bind write-back on input — draft text IS state per bind model.
      // Also re-derive canSend so the send button's disabled state stays
      // in sync with typed text (bind writes are immediate; canSend depends
      // on trim().length + attachedFiles.length).
      ta.addEventListener("input", () => {
        this.writeBind(n.bind, ta!.value);
        updateSendButtonDisabled();
      });

      // Auto-resize (CHAT-03). CSS `field-sizing: content` handles this on
      // modern browsers via the shipped `.vms-chat-composer__textarea` rule
      // (max-height cap in CSS). JS fallback for older browsers.
      const maxRows = n.maxRows ?? 6;
      // The shipped CSS max-height is a hard-coded 6-row cap; override inline
      // so wire `maxRows` is respected on BOTH the modern-CSS path (field-sizing
      // still honors this max-height) and the JS-fallback path — Ashley 2026-08-02.
      ta.style.maxHeight = `calc(${maxRows} * 1.5em + 0.75rem)`;
      const supportsFieldSizing =
        typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content") === true;
      if (!supportsFieldSizing) {
        // Fallback: adjust height on input by measuring scrollHeight.
        const resize = (): void => {
          ta!.style.height = "auto";
          const cs = getComputedStyle(ta!);
          const lineHeight = parseFloat(cs.lineHeight) || 20;
          const paddingY =
            (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
          const maxHeight = lineHeight * maxRows + paddingY;
          const desired = ta!.scrollHeight;
          ta!.style.height = Math.min(desired, maxHeight) + "px";
          ta!.style.overflowY = desired > maxHeight ? "auto" : "hidden";
        };
        ta.addEventListener("input", resize);
        // Initial sizing after mount (queueMicrotask so the element is
        // measurable — layout properties are 0 until parented + laid out).
        queueMicrotask(resize);
      }

      // ── Keyboard (Plan 30-04, CHAT-11..12 + CHAT-08 keyboard side).
      // ONE keydown handler; branches Backspace-vs-Enter-vs-other. Multiple
      // handlers fight over preventDefault (RESEARCH.md §P2 note).
      const submitMode: ChatComposerSubmitMode = n.submitMode ?? "enter";

      // IME composition tracking — belt-and-braces per CHAT-12 correctness
      // requirement. Different browsers commit `isComposing` at different
      // points relative to keydown; the closure var + `e.isComposing` native
      // property together cover the full browser matrix. Adversarial CJK
      // jsdom test in Plan 30-06 proves the guard fires.
      let isComposing = false;
      ta.addEventListener("compositionstart", () => { isComposing = true; });
      ta.addEventListener("compositionend", () => { isComposing = false; });

      ta.addEventListener("keydown", (e: KeyboardEvent) => {
        // Backspace-on-empty removes last attachment (CHAT-08 keyboard side).
        // Now backed by the real removeAttachment helper below, which handles
        // splice + blob-URL revocation + re-render.
        if (
          e.key === "Backspace"
          && ta!.value === ""
          && cs.attachedFiles.length > 0
        ) {
          e.preventDefault();
          const last = cs.attachedFiles[cs.attachedFiles.length - 1];
          if (cs.removeAttachment) {
            cs.removeAttachment(last.id);
          }
          return;
        }

        // Enter handling — IME guard MUST run before any modifier check so
        // CJK-composition Enter (candidate confirm) never fires send.
        if (e.key !== "Enter") return;
        if (isComposing || e.isComposing) return;

        if (submitMode === "enter") {
          if (e.shiftKey) return;                     // native newline
          e.preventDefault();
          triggerSend();
        } else {
          // submitMode === "ctrl-enter"
          if (!(e.ctrlKey || e.metaKey)) return;     // native newline
          e.preventDefault();
          triggerSend();
        }
      });

      // ── Paste-image handler (Plan 30-05, CHAT-06). Iterates
      // clipboardData.items; every item.kind === "file" extracted via
      // getAsFile() rides addFiles() (same validation path as click/drop).
      // Text pastes fall through to native textarea behavior (no preventDefault
      // unless we actually consumed files). Only wired when attachAction is
      // set — no picker means paste has nowhere to attach.
      if (n.attachAction) {
        ta.addEventListener("paste", (e: ClipboardEvent) => {
          const items = e.clipboardData?.items;
          if (!items) return;
          const pastedFiles: File[] = [];
          for (const item of Array.from(items)) {
            if (item.kind === "file") {
              const f = item.getAsFile();
              if (f) pastedFiles.push(f);
            }
          }
          if (pastedFiles.length > 0) {
            e.preventDefault();  // prevent fallback data-URL text paste
            addFiles(pastedFiles);
          }
        });
      }

      row.appendChild(ta);
    }

    row.appendChild(sendBtn);

    // Trailing slot (common: model selector, emoji trigger, tool chips).
    // Mirrors leadingSlot's wrapper — 34px flex-centered so caption/text/icons
    // in the trailing slot align with the buttons instead of bottom-aligning
    // to the row's flex-end (Ashley 2026-08-02, same asymmetry she caught on
    // leading — trailing exhibited it too, less obvious with text vs icon).
    if (n.trailingSlot) {
      const trailing = document.createElement("div");
      trailing.className = "vms-chat-composer__trailing";
      row.appendChild(trailing);
      this.node(n.trailingSlot, trailing, on);
    }

    root.appendChild(row);

    // ── Footer slot (helper text, footer chips). `:empty` CSS rule hides
    // the row when consumer provides no footerSlot.
    const footerRow = document.createElement("div");
    footerRow.className = "vms-chat-composer__footer";
    if (n.footerSlot) this.node(n.footerSlot, footerRow, on);
    root.appendChild(footerRow);

    // ── Drag-drop (Plan 30-05, CHAT-05). Only wired when attachAction is set.
    // Composer-local by default; global opt-in via dropScope:"global" attaches
    // listeners to document instead. Both scopes guard on
    // dataTransfer.types.includes("Files") per RESEARCH.md §Q1 — this avoids
    // stealing text/DOM drags. The dragging visual class always lands on the
    // composer root regardless of scope.
    if (n.attachAction) {
      const dropTarget: HTMLElement | Document =
        n.dropScope === "global" ? document : root;

      const dragOverHandler = (e: Event): void => {
        const dt = (e as DragEvent).dataTransfer;
        if (!dt || !dt.types.includes("Files")) return;
        e.preventDefault();
        root.classList.add("vms-chat-composer--dragging");
      };
      const dragLeaveHandler = (e: Event): void => {
        // Only remove the class when the drag actually leaves the composer
        // (not when it moves between children). `e.target === root` is the
        // pattern that survives child re-entrances.
        if ((e as DragEvent).target === root) {
          root.classList.remove("vms-chat-composer--dragging");
        }
      };
      const dropHandler = (e: Event): void => {
        const dt = (e as DragEvent).dataTransfer;
        if (!dt || !dt.types.includes("Files")) return;
        e.preventDefault();
        root.classList.remove("vms-chat-composer--dragging");
        const files = Array.from(dt.files ?? []);
        addFiles(files);
      };

      dropTarget.addEventListener("dragover", dragOverHandler);
      dropTarget.addEventListener("dragleave", dragLeaveHandler);
      dropTarget.addEventListener("drop", dropHandler);

      // Cleanup posture: for dropScope:"composer" the listeners live on
      // `root`, which is discarded by the next render()'s innerHTML wipe —
      // handlers point at detached elements and no-op naturally. For
      // dropScope:"global" the document-level handlers WOULD leak across
      // renders; the composer's persistent registry entry means the
      // handlers stay reachable via `cs` but a re-render's fresh `root`
      // means the CLASS-add targets the OLD root (a detached element).
      // Accepted small leak per Plan 30-05 §Task 2 — the fresh render also
      // registers fresh handlers, so a global-scope composer that renders
      // N times accumulates N sets of listeners on document. For v1 this
      // is bounded (a chat composer typically renders on the order of
      // seconds/user-actions, not thousands of times), and every handler
      // closes over the same persistent cs so behavior stays consistent.
      // Follow-up plan can add a document-level cleanup via the mark-sweep
      // in render() if the leak matters in practice.
    }

    parent.appendChild(root);

    // ── Attachment helpers (Plan 30-05, CHAT-04..08). Declared AFTER the
    // DOM is built so they can capture `sendBtn`, `chipStripEl`, etc. — the
    // click/drop/paste handlers above call these forward-referenced names,
    // which JS resolves at call time (not declaration time) via the closure.

    // Validation-error banner element (nullable — created on demand). Mounts
    // inside headerRow ABOVE the chip strip on validation failure; auto-clears
    // on next successful add. Uses tone-danger surface (see CSS).
    let errorBannerEl: HTMLElement | null = null;
    function showValidationErrors(errors: string[]): void {
      if (errorBannerEl) {
        errorBannerEl.remove();
        errorBannerEl = null;
      }
      if (errors.length === 0) return;
      errorBannerEl = document.createElement("div");
      errorBannerEl.className = "vms-chat-composer__error";
      errorBannerEl.setAttribute("role", "alert");
      errorBannerEl.textContent = errors.join(" · ");
      headerRow.insertBefore(errorBannerEl, headerRow.firstChild);
    }

    // MIME → shipped icon-name mapping. Ordered check (first match wins).
    // Images use their previewUrl thumbnail so the icon path is a fallback
    // only; kept in the map for completeness (used if a thumbnail load
    // fails, though we don't currently hook onerror). Every icon name
    // referenced here MUST exist in icons-payload.ts.
    const MIME_ICON_MAP: Array<[string, IconName]> = [
      ["image/", "image"],
      ["text/", "file-text"],
      ["application/pdf", "file-text"],
      ["application/", "file"],
    ];
    function iconForFile(mime: string): IconName {
      for (const [prefix, iconName] of MIME_ICON_MAP) {
        if (mime.startsWith(prefix)) return iconName;
      }
      return "paperclip";
    }
    function humanFileSize(bytes: number): string {
      const units = ["B", "KB", "MB", "GB"];
      let i = 0;
      let val = bytes;
      while (val >= 1024 && i < units.length - 1) {
        val /= 1024;
        i++;
      }
      return `${val.toFixed(val < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
    }

    // MIME-accept matcher — pattern per HTML spec: entries can be a bare
    // MIME (`image/png`), a prefix wildcard (`image/*`), a `.` extension
    // (`.pdf`), or the special tokens `audio/*`/`video/*`/`image/*`. We
    // support MIME + wildcard (the two forms the attachBind accept covers);
    // extension-only entries pass through as no-match against a MIME-typed
    // file, which is the correct falsy result.
    function matchesAccept(fileType: string, accept: string[]): boolean {
      if (accept.length === 0) return true;
      for (const entry of accept) {
        const trimmed = entry.trim();
        if (trimmed === "") continue;
        if (trimmed.endsWith("/*")) {
          const prefix = trimmed.slice(0, -1);  // "image/"
          if (fileType.startsWith(prefix)) return true;
        } else if (trimmed === fileType) {
          return true;
        }
      }
      return false;
    }

    // Send-button disabled derivation, called from initial render + every
    // attach/remove/input. Reads bind text length + registry count; sets
    // disabled + --ready class. Only runs on "idle" status — sending /
    // streaming manage their own disabled state. Uses the chatComposerAdapter
    // captured at method-entry (see the top of chatComposer) so we can read
    // this.readBind safely from a function-declaration closure.
    function updateSendButtonDisabled(): void {
      if ((n.status ?? "idle") !== "idle") return;
      const stateValue = chatComposerAdapter.readBind(n.bind);
      const hasText = typeof stateValue === "string" && stateValue.trim().length > 0;
      const canSend = hasText || cs.attachedFiles.length > 0;
      if (n.disabled === true || !canSend) {
        sendBtn.disabled = true;
        sendBtn.classList.remove("vms-chat-composer__send--ready");
      } else {
        sendBtn.disabled = false;
        sendBtn.classList.add("vms-chat-composer__send--ready");
      }
    }

    // Chip-strip renderer. Called on every registry mutation. Full innerHTML
    // reset per render — N is small (attachment count), and rebuilding is
    // simpler than diffing. Empty registry produces empty innerHTML; the
    // CSS `:empty` rule on `.vms-chat-composer__attachments` hides the row.
    const chatComposerRenderIcon = (name: IconName): SVGElement =>
      this.renderIconSvg(name, "sm", undefined, undefined);
    function renderChipStrip(): void {
      chipStripEl.innerHTML = "";
      for (const item of cs.attachedFiles) {
        const chip = document.createElement("div");
        chip.className = "vms-chat-composer__chip";
        chip.dataset.attachmentId = item.id;

        if (item.kind === "image" && item.previewUrl) {
          const thumb = document.createElement("img");
          thumb.className = "vms-chat-composer__chip-thumb";
          thumb.src = item.previewUrl;
          thumb.alt = item.file.name;
          chip.appendChild(thumb);
        } else {
          const iconEl = chatComposerRenderIcon(iconForFile(item.file.type));
          iconEl.classList.add("vms-chat-composer__chip-icon");
          chip.appendChild(iconEl);
        }

        const name = document.createElement("span");
        name.className = "vms-chat-composer__chip-name";
        name.textContent = item.file.name;
        chip.appendChild(name);

        const size = document.createElement("span");
        size.className = "vms-chat-composer__chip-size";
        size.textContent = humanFileSize(item.sizeBytes);
        chip.appendChild(size);

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "vms-chat-composer__chip-remove";
        removeBtn.setAttribute("aria-label", `Remove ${item.file.name}`);
        removeBtn.appendChild(chatComposerRenderIcon("x"));
        const capturedId = item.id;
        removeBtn.addEventListener("click", () => {
          if (cs.removeAttachment) cs.removeAttachment(capturedId);
        });
        chip.appendChild(removeBtn);

        chipStripEl.appendChild(chip);
      }
    }

    // Register the removeAttachment helper on the persistent registry entry.
    // The Backspace-on-empty keyboard handler above dereferences this
    // (`cs.removeAttachment(last.id)`); the chip X-remove button does the
    // same. Splices in-place so the persisted array reference stays stable.
    cs.removeAttachment = (id: string): void => {
      const idx = cs.attachedFiles.findIndex(f => f.id === id);
      if (idx < 0) return;
      const [removed] = cs.attachedFiles.splice(idx, 1);
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      renderChipStrip();
      updateSendButtonDisabled();
    };

    // Client-side file ingestion — the ONE convergence point for click/drop/
    // paste. Returns the count of successfully added files (used by the
    // click-picker's change handler to decide whether to dispatch
    // attachAction). Validates per file against maxFiles / maxFileSize /
    // accept; rejected files surface as inline error banner text. Per
    // AGENTS.md class-A note: client validation is UX; server MUST
    // re-validate on the sendAction handler.
    function addFiles(files: File[]): number {
      const errors: string[] = [];
      let addedCount = 0;
      for (const file of files) {
        // Max-files cap (client-side; server re-checks per class-A note).
        if (
          n.maxFiles !== undefined
          && cs.attachedFiles.length + addedCount >= n.maxFiles
        ) {
          errors.push(`Max files (${n.maxFiles}) reached`);
          break;
        }
        // Max-file-size cap. maxFileSize is in bytes.
        if (n.maxFileSize !== undefined && file.size > n.maxFileSize) {
          errors.push(`${file.name}: exceeds ${humanFileSize(n.maxFileSize)}`);
          continue;
        }
        // MIME accept filter.
        if (n.accept?.length && !matchesAccept(file.type, n.accept)) {
          errors.push(`${file.name}: type ${file.type} not accepted`);
          continue;
        }
        const isImage = file.type.startsWith("image/");
        cs.attachedFiles.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
          kind: isImage ? "image" : "file",
          sizeBytes: file.size,
        });
        addedCount++;
      }
      renderChipStrip();
      showValidationErrors(errors);
      updateSendButtonDisabled();
      return addedCount;
    }

    // Initial paint of the chip strip — the persisted registry may already
    // hold attachments from a prior render pass (a re-render triggered by
    // typing or a poll while attachments are pending). renderChipStrip is
    // idempotent; the empty case produces an empty strip that CSS hides.
    renderChipStrip();
  }

  private section(n: SectionNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    // 1.2.0 — collapsible:true branch emits native <details>/<summary>; the
    // open/closed state is DOM-local and preserved across re-renders by the
    // render() snapshot/restore loop. Omitted/false renders byte-identical
    // to the pre-1.2.0 <section> tree (no className drift, no data-* attr).
    if (n.collapsible === true) {
      const baseKey = n.id ?? n.heading ?? "vms-section-anon";
      const ordinal = this.sectionKeyCounter.get(baseKey) ?? 0;
      this.sectionKeyCounter.set(baseKey, ordinal + 1);
      const finalKey = `${baseKey}:${ordinal}`;

      const el = document.createElement("details");
      el.className = `vms-section vms-section--collapsible${
        n.variant ? ` vms-section--${n.variant}` : ""}${
        n.tone ? ` vms-section--${n.tone}` : ""}${
        n.layout && n.layout !== "stack" ? ` vms-section--${n.layout}` : ""}${
        n.fill === true ? " vms-section--fill" : ""}${
        n.arrange ? ` vms-arrange--${n.arrange}` : ""}${
        n.align ? ` vms-align--${n.align}` : ""}${
        n.threshold ? ` vms-switch--${n.threshold}` : ""}${
        n.limit ? ` vms-switch-limit--${n.limit}` : ""}${
        n.minItem ? ` vms-cards-min--${n.minItem}` : ""}${
        n.alignSelf ? ` vms-self--${n.alignSelf}` : ""}${
        n.maxWidth ? ` vms-maxw--${n.maxWidth}` : ""}`;
      el.dataset.sectionKey = finalKey;
      if (n.id) el.id = n.id;  // addressable DOM id (e.g. CopyButtonNode.copyTargetId target)
      // Initial render is always closed — the post-render restore loop in
      // render() re-applies `open=true` for keys the user had open before.

      const summary = document.createElement("summary");
      summary.className = "vms-section__summary";
      // Headingless fallback label — documented in TSDoc on
      // SectionNode.collapsible and in AGENTS.md "Non-obvious framework
      // behaviors". Choice locked.
      // v7.0.0 (ICON-04) — leading icon inside the <summary> when set (size xl,
      // tone inherited from section.tone). Prepended before the label text so
      // the disclosure triangle still owns its native marker slot.
      if (n.icon) {
        summary.appendChild(this.renderIconSvg(n.icon, "xl", n.tone, undefined));
        const labelSpan = document.createElement("span");
        labelSpan.className = "vms-section__summary-label";
        labelSpan.textContent = n.heading ?? "Show details";
        summary.appendChild(labelSpan);
      } else {
        summary.textContent = n.heading ?? "Show details";
      }
      el.appendChild(summary);

      this.kids(n.children, el, on);
      parent.appendChild(el);
      return;
    }

    // 1.5.0 — SectionNode.link URL-wrapper variant (issue #21). When set,
    // emit a wrapping <a href> element instead of <section> so every native
    // browser link affordance works for free (middle-click / Ctrl/Cmd-click
    // new tab, right-click context menu, drag-to-bookmarks, status-bar URL).
    // Validation guarantees link + action and link + collapsible are
    // mutually exclusive, and link cannot be nested inside another link or
    // action — see validateSectionAction in server.ts.
    if (n.link) {
      const a = document.createElement("a");
      a.className = `vms-section vms-section--linked${
        n.variant ? ` vms-section--${n.variant}` : ""}${
        n.tone ? ` vms-section--${n.tone}` : ""}${
        n.layout && n.layout !== "stack" ? ` vms-section--${n.layout}` : ""}${
        n.fill === true ? " vms-section--fill" : ""}${
        n.arrange ? ` vms-arrange--${n.arrange}` : ""}${
        n.align ? ` vms-align--${n.align}` : ""}${
        n.threshold ? ` vms-switch--${n.threshold}` : ""}${
        n.limit ? ` vms-switch-limit--${n.limit}` : ""}${
        n.minItem ? ` vms-cards-min--${n.minItem}` : ""}${
        n.alignSelf ? ` vms-self--${n.alignSelf}` : ""}${
        n.maxWidth ? ` vms-maxw--${n.maxWidth}` : ""}`;
      a.href = n.link.url;
      if (n.id) a.id = n.id;  // addressable DOM id (e.g. CopyButtonNode.copyTargetId target)
      // Mirror LinkNode's external-attribute pattern (browser.ts ~line 666)
      // byte-for-byte: target=_blank + rel=noopener noreferrer when external.
      if (n.link.external) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      // v7.0.0 (ICON-04) — leading icon (size xl, tone inherited from
      // section.tone) prepended before the heading if any.
      if (n.icon) a.appendChild(this.renderIconSvg(n.icon, "xl", n.tone, undefined));
      if (n.heading) {
        const h = document.createElement("h2");
        h.className = "vms-section__heading";
        h.textContent = n.heading;
        a.appendChild(h);
      }
      this.kids(n.children, a, on);
      // Containment: clicks on nested interactive controls must NOT trigger
      // the wrapper anchor's navigation. For non-anchor controls, stopPropagation
      // is enough — the wrapper anchor's default navigation only fires on the
      // anchor element itself, and stopPropagation prevents bubbled re-fires.
      // For nested anchors (cell linkLabels), we additionally preventDefault on
      // the click so a bubbled click cannot re-trigger the wrapper anchor's
      // default navigation in browsers that handle nested <a> ambiguously. The
      // catch-all `a[href]` selector includes the wrapper itself — skip it via
      // `ctrl === a` so the wrapper's own click is NOT preventDefaulted.
      //
      // TODO: LinkNode-inside-section.link is left to the existing LinkNode
      // renderer; spec-wise nested <a> is invalid HTML (issue #21 deliberately
      // does NOT block it because the tree-validation rule only catches the
      // sibling SectionNode-level case). A follow-up runtime warning when an
      // inner LinkNode lives inside a section.link wrapper could surface this
      // to consumers; until then, consumers can avoid the combo.
      a.querySelectorAll<HTMLElement>(
        ".vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, .vms-table__link, a[href]"
      ).forEach(ctrl => {
        if (ctrl === a) return;
        ctrl.addEventListener("click", (e) => {
          e.stopPropagation();
          if (ctrl instanceof HTMLAnchorElement) e.preventDefault();
        });
      });
      parent.appendChild(a);
      return;
    }

    const el = document.createElement("section");
    el.className = `vms-section${n.variant ? ` vms-section--${n.variant}` : ""}${
      n.tone ? ` vms-section--${n.tone}` : ""}${
      n.layout && n.layout !== "stack" ? ` vms-section--${n.layout}` : ""}${
      n.fill === true ? " vms-section--fill" : ""}${
      n.arrange ? ` vms-arrange--${n.arrange}` : ""}${
      n.align ? ` vms-align--${n.align}` : ""}${
      n.threshold ? ` vms-switch--${n.threshold}` : ""}${
      n.limit ? ` vms-switch-limit--${n.limit}` : ""}${
      n.minItem ? ` vms-cards-min--${n.minItem}` : ""}${
      n.alignSelf ? ` vms-self--${n.alignSelf}` : ""}${
      n.maxWidth ? ` vms-maxw--${n.maxWidth}` : ""}${
      n.action ? " vms-section--clickable" : ""}`;
    if (n.id) el.id = n.id;  // addressable DOM id (e.g. CopyButtonNode.copyTargetId target)
    // SectionNode.followTail — mark this as an append-only feed so render()'s
    // snapshot/restore keeps its newest content in view (see render() + the
    // FOLLOW_TAIL_STICK_THRESHOLD_PX constant). No CSS/class — the scroll comes
    // from the element already being an overflow region (pair with fill).
    if (n.followTail === true) el.dataset.followTail = "";
    // v7.0.0 (ICON-04) — leading icon (size xl, tone inherited from
    // section.tone) prepended before the heading if any. Rendered as an
    // header-slot glyph — the Hestia launcher-card use case.
    if (n.icon) el.appendChild(this.renderIconSvg(n.icon, "xl", n.tone, undefined));
    if (n.heading) {
      const h = document.createElement("h2");
      h.className = "vms-section__heading";
      h.textContent = n.heading;
      el.appendChild(h);
    }
    this.kids(n.children, el, on);
    // SectionNode.action — click-anywhere + keyboard + ARIA. Mirrors
    // TableRow.action (1.1.0). Containment via stopPropagation on nested
    // interactive controls AFTER kids() has rendered them.
    if (n.action) {
      const action = n.action;
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      // aria-label derivation: heading > flattened descendant text (capped) > "Card".
      // Whitespace runs (textContent collapses across child elements, so we
      // get long runs of spaces / newlines from the DOM tree) are collapsed
      // to a single space — preserving normal in-text spacing like
      // "Choose plan" intact instead of mangling it to "Choose · plan".
      let ariaLabel = "";
      if (n.heading && n.heading.trim().length > 0) {
        ariaLabel = n.heading.trim();
      } else {
        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        ariaLabel = text.length > 0 ? text.slice(0, 200) : "Card";
      }
      el.setAttribute("aria-label", ariaLabel);
      el.addEventListener("click", () => { on(action); });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          on(action);
        } else if (e.key === " " || e.key === "Spacebar") {
          e.preventDefault(); // suppress page scroll
          on(action);
        }
      });
      // Containment: clicks on nested interactive controls must NOT bubble to
      // the section's click handler. Selectors mirror the TableRow.action
      // wiring (per-row button / checkbox / linkLabel anchor) plus a catch-all
      // for any anchor inside the card (LinkNode renders as <a>).
      el.querySelectorAll<HTMLElement>(
        ".vms-button, .vms-checkbox__input, .vms-checkbox, .vms-table__link, a[href]"
      ).forEach(ctrl => {
        ctrl.addEventListener("click", (e) => { e.stopPropagation(); });
      });
    }
    parent.appendChild(el);
  }

  private list(n: ListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const ul = document.createElement(n.ordered ? "ol" : "ul");
    // v8.0.0 (COMP-05a) — variant:"rows" adds .vms-list--rows which turns the
    // container into a single bordered surface with per-row dividers (see
    // default.css). Omitted/"items" = byte-identical to the pre-Phase-24 render.
    // A ListRowNode child detects its container via
    // parent.classList.contains("vms-list") || contains("vms-list--rows")
    // in listRow() below to emit an <li>.
    ul.className = `vms-list${n.ordered ? " vms-list--ordered" : ""}${n.variant === "rows" ? " vms-list--rows" : ""}`;
    if (n.id) ul.id = n.id;
    this.kids(n.children, ul, on);
    parent.appendChild(ul);
  }

  /** v8.0.0 (COMP-05) — ListRowNode renderer. Emits an <li> when in a
   *  .vms-list / .vms-list--rows container, else <div class="vms-list-row-standalone">.
   *  String-lift trained typography per CONTEXT §1:
   *    primary   string → TextNode{style:"body", weight:"medium"} (COMP-01/02)
   *    secondary string → TextNode{style:"muted"}
   *    meta[i]   string → TextNode{style:"caption"}                (COMP-01)
   *  Whole-row action mirrors TableRow.action (browser.ts:3689-3714) —
   *  role="button", tabIndex=0, Enter/Space dispatch, aria-label from
   *  flattened text. Interactive descendants stopPropagation via the same
   *  selector list as SectionNode.action (browser.ts:1107-1110). */
  private listRow(n: ListRowNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    // Standalone-vs-in-container detection — the parent's own className tells
    // us whether we're inside a list or free-floating. Matches the checkbox
    // scoped-vs-standalone dispatch idiom.
    const isInList = parent.classList.contains("vms-list") || parent.classList.contains("vms-list--rows");
    // Explicit HTMLElement type so downstream addEventListener("keydown", ...)
    // resolves the callback param to KeyboardEvent (a ternary tag narrows the
    // return to a union that TS resolves loosely; both HTMLLIElement and
    // HTMLDivElement extend HTMLElement, so widening is safe).
    const el: HTMLElement = document.createElement(isInList ? "li" : "div");
    const cls = ["vms-list-row"];
    if (!isInList) cls.push("vms-list-row-standalone");
    if (n.tone) cls.push(`vms-list-row--${n.tone}`);
    if (n.state) cls.push(`vms-list-row--${n.state}`);
    if (n.action) cls.push("vms-list-row--clickable");
    el.className = cls.join(" ");

    // Leading slot — any ViewNode.
    if (n.leading) {
      const lead = document.createElement("div");
      lead.className = "vms-list-row__leading";
      this.node(n.leading, lead, on);
      el.appendChild(lead);
    }

    // Content stack — primary/secondary/meta[]. String slots auto-wrap in
    // trained TextNode per the string-lift rule.
    const content = document.createElement("div");
    content.className = "vms-list-row__content";

    const primaryEl = document.createElement("div");
    primaryEl.className = "vms-list-row__primary";
    if (typeof n.primary === "string") {
      // COMP-01 body tier + COMP-02 weight axis — the trained primary
      // typography a row visually expects. Consumers who need custom shapes
      // pass a ViewNode (see the else branch below).
      this.node({ type: "text", value: n.primary, style: "body", weight: "medium" }, primaryEl, on);
    } else {
      this.node(n.primary, primaryEl, on);
    }
    content.appendChild(primaryEl);

    if (n.secondary != null) {
      const secEl = document.createElement("div");
      secEl.className = "vms-list-row__secondary";
      if (typeof n.secondary === "string") {
        this.node({ type: "text", value: n.secondary, style: "muted" }, secEl, on);
      } else {
        this.node(n.secondary, secEl, on);
      }
      content.appendChild(secEl);
    }

    for (const m of n.meta ?? []) {
      const metaEl = document.createElement("div");
      metaEl.className = "vms-list-row__meta";
      if (typeof m === "string") {
        // COMP-01 caption tier — the meta-line typography.
        this.node({ type: "text", value: m, style: "caption" }, metaEl, on);
      } else {
        this.node(m, metaEl, on);
      }
      content.appendChild(metaEl);
    }

    el.appendChild(content);

    // Trailing slot — any ViewNode.
    if (n.trailing) {
      const trail = document.createElement("div");
      trail.className = "vms-list-row__trailing";
      this.node(n.trailing, trail, on);
      el.appendChild(trail);
    }

    // Whole-row action — click-anywhere + keyboard + ARIA. Mirrors
    // TableRow.action at browser.ts:3694-3714 exactly.
    if (n.action) {
      const action = n.action;
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      // aria-label from flattened primary+meta text (collapse whitespace,
      // slice to 200 chars — same banked posture as TableRow's
      // `labelParts.join(" · ")` but sourced from el.textContent since our
      // slots are already rendered into the DOM at this point).
      const ariaText = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (ariaText) el.setAttribute("aria-label", ariaText);
      el.addEventListener("click", () => { on(action); });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          on(action);
        } else if (e.key === " " || e.key === "Spacebar") {
          e.preventDefault(); // suppress page scroll
          on(action);
        }
      });
      // Containment: clicks on nested interactive controls must NOT bubble to
      // the row's click handler. Selectors mirror the SectionNode.action
      // wiring at browser.ts:1107-1110 exactly (button / checkbox input +
      // label / field input / any anchor).
      el.querySelectorAll<HTMLElement>(
        ".vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, a[href]"
      ).forEach(ctrl => {
        ctrl.addEventListener("click", (e) => { e.stopPropagation(); });
      });
    }

    // v8.0.3 CQ scope fix — outer wrapper establishes the CQ context.
    // .vms-list-row-standalone can't be its own container per CSS Containment
    // spec (a container's rules don't apply to itself). See default.css:
    // .vms-list-row-standalone-container. In-list path is unchanged (byte-
    // identical DOM); the <ul class="vms-list--rows"> IS the CQ container
    // and the <li class="vms-list-row"> is a descendant already.
    if (isInList) {
      parent.appendChild(el);
    } else {
      const wrapper = document.createElement("div");
      wrapper.className = "vms-list-row-standalone-container";
      wrapper.appendChild(el);
      parent.appendChild(wrapper);
    }
  }

  /** v8.0.0 (COMP-09) — UserRowNode renderer. The person-entity display
   *  recipe. Emits an <li> when in a .vms-user-row-list container, else
   *  <div class="vms-user-row-standalone">. Grid: [avatar | content |
   *  trailing? | status]. String-lift trained typography per CONTEXT §1:
   *    name string → TextNode{style:"body", weight:"medium"} (COMP-01/02)
   *    meta string → TextNode{style:"muted"}
   *  Status is a leaf sub-record with a closed 4-value StatusKind enum that
   *  drives .vms-status-dot--{kind} class emission (palette baked in
   *  default.css). Whole-row action mirrors listRow() at browser.ts:1220-1250
   *  — role="button", tabIndex=0, Enter/Space dispatch, aria-label from
   *  flattened text. Interactive descendants stopPropagation via the same
   *  selector list as ListRowNode.action. */
  private userRow(n: UserRowNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    // Container detection — parent's own className tells us whether we're
    // inside a list or free-floating. Mirrors listRow()'s idiom at
    // browser.ts:1149.
    const isInList = parent.classList.contains("vms-user-row-list");
    const el: HTMLElement = document.createElement(isInList ? "li" : "div");
    const cls = ["vms-user-row"];
    if (!isInList) cls.push("vms-user-row-standalone");
    if (n.state) cls.push(`vms-user-row--${n.state}`);
    if (n.action) cls.push("vms-user-row--clickable");
    // PLAN-CHECKER FIX #1: trailing slot needs a dedicated grid cell. Emit
    // .vms-user-row--has-trailing when present so the CSS switches from
    // 3-col to 4-col grid. Mutation-testable: removing the class breaks the
    // "trailing renders in its correct grid cell" test.
    if (n.trailing) cls.push("vms-user-row--has-trailing");
    el.className = cls.join(" ");

    // Avatar slot — any ViewNode (typically AvatarNode from COMP-04).
    if (n.avatar) {
      const avatarEl = document.createElement("div");
      avatarEl.className = "vms-user-row__avatar";
      this.node(n.avatar, avatarEl, on);
      el.appendChild(avatarEl);
    }

    // Content stack — name + optional meta. String slots auto-wrap in trained
    // TextNode per the string-lift rule (CONTEXT §1).
    const content = document.createElement("div");
    content.className = "vms-user-row__content";

    const nameEl = document.createElement("div");
    nameEl.className = "vms-user-row__name";
    if (typeof n.name === "string") {
      // COMP-01 body tier + COMP-02 weight axis — the trained name typography
      // a user row visually expects.
      this.node({ type: "text", value: n.name, style: "body", weight: "medium" }, nameEl, on);
    } else {
      this.node(n.name, nameEl, on);
    }
    content.appendChild(nameEl);

    if (n.meta != null) {
      const metaEl = document.createElement("div");
      metaEl.className = "vms-user-row__meta";
      if (typeof n.meta === "string") {
        this.node({ type: "text", value: n.meta, style: "muted" }, metaEl, on);
      } else {
        this.node(n.meta, metaEl, on);
      }
      content.appendChild(metaEl);
    }

    el.appendChild(content);

    // Trailing slot — any ViewNode. Rendered before the status column so the
    // 4-column grid `[avatar | content | trailing | status]` places it
    // between content and status. (When trailing is absent, the grid is 3-col
    // and status sits directly after content.)
    if (n.trailing) {
      const trail = document.createElement("div");
      trail.className = "vms-user-row__trailing";
      this.node(n.trailing, trail, on);
      el.appendChild(trail);
    }

    // Status slot — small typed sub-record (NOT a ViewNode). Renders a
    // colored dot + label right-aligned. kind → CSS class mapping is closed:
    //   online → --success, away → --warning, offline → muted, busy → --error
    // The CSS ships in default.css. Label emitted via createTextNode (textContent
    // — safe by construction; no innerHTML).
    if (n.status) {
      const statusEl = document.createElement("span");
      statusEl.className = "vms-user-row__status";
      const dot = document.createElement("span");
      dot.className = `vms-status-dot vms-status-dot--${n.status.kind}`;
      statusEl.appendChild(dot);
      statusEl.appendChild(document.createTextNode(n.status.label));
      el.appendChild(statusEl);
    }

    // Whole-row action — click-anywhere + keyboard + ARIA. Mirrors listRow()
    // at browser.ts:1220-1250 verbatim (role/tabIndex/aria-label/keydown/
    // stopPropagation selectors).
    if (n.action) {
      const action = n.action;
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      // aria-label from flattened text content (collapse whitespace, slice to
      // 200 chars — same posture as listRow).
      const ariaText = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (ariaText) el.setAttribute("aria-label", ariaText);
      el.addEventListener("click", () => { on(action); });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          on(action);
        } else if (e.key === " " || e.key === "Spacebar") {
          e.preventDefault(); // suppress page scroll
          on(action);
        }
      });
      // Containment: clicks on nested interactive controls must NOT bubble to
      // the row's click handler. Selectors mirror listRow()'s wiring at
      // browser.ts:1245-1249 exactly.
      el.querySelectorAll<HTMLElement>(
        ".vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, a[href]"
      ).forEach(ctrl => {
        ctrl.addEventListener("click", (e) => { e.stopPropagation(); });
      });
    }

    parent.appendChild(el);
  }

  /** v8.0.0 (COMP-10a) — DetailListNode renderer.
   *
   *  Aligned key-value container. Emits `<dl>` — the semantic HTML element for
   *  a definition list. This choice is LOAD-BEARING: screen readers announce
   *  each child `<dt>`/`<dd>` pair as a term/definition, and the `<dl>` gives
   *  the whole group its "list of term-definition pairs" semantic. A `<div>`
   *  swap would drop that semantic (mutation-testable in
   *  test/detail-row.test.ts).
   *
   *  labelWidth closed enum (sm/md/lg → 8/10/12rem) → modifier class that
   *  sets `--vms-detail-label` CSS-var on the container; each `.vms-detail-row`
   *  child reads it as `grid-template-columns: var(--vms-detail-label) 1fr`.
   *  Omitted labelWidth = NO modifier class (byte-identical to md — the
   *  container's default `--vms-detail-label` is 10rem, matching md
   *  explicitly). */
  private detailList(n: DetailListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const dl = document.createElement("dl");
    const cls = ["vms-detail-list"];
    if (n.labelWidth) cls.push(`vms-detail-list--${n.labelWidth}`);
    dl.className = cls.join(" ");
    // Children are DetailRowNode[] on the type — the tree-validator rejects
    // non-DetailRowNode entries server-side (byte-identical error message
    // across TS + .NET). The renderer just walks children through the
    // standard node() dispatch (which will render each as detailRow()).
    this.kids(n.children as unknown as ViewNode[], dl, on);
    parent.appendChild(dl);
  }

  /** v8.0.0 (COMP-10) — DetailRowNode renderer.
   *
   *  Emits `<div class="vms-detail-row [vms-detail-row--{tone}]">
   *  <dt class="vms-detail-row__label">{icon?}{label}</dt>
   *  <dd class="vms-detail-row__value">{value}</dd></div>`. The wrapping
   *  `<div>` is load-bearing — it carries the grid layout that positions the
   *  `<dt>` + `<dd>` sibling pair as two grid columns. Screen readers still
   *  see the `<dt>`/`<dd>` inside the parent `<dl>` (browsers treat these as
   *  the definition-list terms/definitions regardless of the intervening
   *  `<div>` in the flat DOM tree).
   *
   *  LABEL — appended to `<dt>` as a RAW text node (via
   *  `document.createTextNode`). NOT wrapped in a TextNode. The trained
   *  typography (text-xs uppercase weight:500 muted) is BAKED into
   *  `.vms-detail-row__label` CSS. Mutation-testable: wrapping the label in
   *  a TextNode would emit a nested `<div class="vms-text">` inside the
   *  `<dt>` and break the "label renders as raw text inside <dt>" test.
   *
   *  VALUE — `string` → renderer wraps in `TextNode { style: "body" }`;
   *  `ViewNode` → rendered as-is (escape hatch for rich content).
   *
   *  ICON — optional; renders inside the `<dt>` BEFORE the label text at
   *  `sm` size. */
  private detailRow(n: DetailRowNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const row = document.createElement("div");
    const cls = ["vms-detail-row"];
    if (n.tone) cls.push(`vms-detail-row--${n.tone}`);
    if (n.state) cls.push(`vms-detail-row--${n.state}`);
    row.className = cls.join(" ");

    const dt = document.createElement("dt");
    dt.className = "vms-detail-row__label";
    // Icon-before-label: append the SVG first, then the label text node. The
    // CSS applies `display:flex` + `gap` on .vms-detail-row__label so the
    // icon and text sit inline with proper spacing.
    if (n.icon) dt.appendChild(this.renderIconSvg(n.icon, "sm", undefined, undefined));
    // Label is a RAW text node — NOT a TextNode wrap. The trained typography
    // is baked in CSS (.vms-detail-row__label). This is deliberate and
    // mutation-testable — see the renderer TSDoc.
    dt.appendChild(document.createTextNode(n.label));
    row.appendChild(dt);

    const dd = document.createElement("dd");
    dd.className = "vms-detail-row__value";
    if (typeof n.value === "string") {
      // Trained value typography: body tier (COMP-01). String-lift rule.
      this.node({ type: "text", value: n.value, style: "body" }, dd, on);
    } else {
      // ViewNode value: render as-is (escape hatch for rich content).
      this.node(n.value, dd, on);
    }
    row.appendChild(dd);

    parent.appendChild(row);
  }

  /** v8.0.0 (COMP-11a) — TimelineNode renderer.
   *
   *  Emits `<ol class="vms-timeline">` — semantic ordered list, since timeline
   *  entries are chronological. The decorative left rail is installed
   *  ENTIRELY via CSS `::before` on `.vms-timeline` (default.css); the
   *  renderer emits NO decoration itself. Children are TimelineEntryNode[]
   *  on the type — the tree-validator rejects non-TimelineEntryNode entries
   *  server-side (byte-identical error message across TS + .NET). The
   *  renderer just walks children through the standard node() dispatch
   *  (which will render each as timelineEntry()).
   *
   *  Mutation test: swapping `<ol>` → `<ul>` breaks the semantic-list test
   *  in test/timeline.test.ts (an ordered list is the right semantic for
   *  chronological entries; a bulleted list drops that meaning).
   */
  private timeline(n: TimelineNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const ol = document.createElement("ol");
    ol.className = "vms-timeline";
    this.kids(n.children as unknown as ViewNode[], ol, on);
    parent.appendChild(ol);
  }

  /** v8.0.0 (COMP-11) — TimelineEntryNode renderer.
   *
   *  Emits `<li class="vms-timeline-entry [vms-timeline-entry--{tone}]">
   *  <div class="vms-timeline-entry__time">{time}</div>
   *  <div class="vms-timeline-entry__description">{description}</div></li>`.
   *  The dot marker on each entry lives ENTIRELY in the
   *  `.vms-timeline-entry::before` CSS rule (default.css); the renderer emits
   *  NO DOM node for the dot. The tone modifier class routes to the tone-
   *  encoded border-color rule (`.vms-timeline-entry--{tone}::before`).
   *
   *  STRING-LIFT trained typography:
   *   - `time` (primitive string, no ViewNode variant) → renderer wraps in
   *     `TextNode { style: "caption" }` (COMP-01 caption tier).
   *   - `description` string → renderer wraps in `TextNode { style: "body" }`;
   *     ViewNode → rendered as-is (escape hatch for rich content).
   *
   *  ICON — optional; renders inside `.vms-timeline-entry__icon` wrapper
   *  which is CSS-absolutely-positioned into the dot slot (larger than a
   *  bare dot). Reuses `renderIconSvg` from Phase 22 at `sm` size.
   */
  private timelineEntry(n: TimelineEntryNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const li = document.createElement("li");
    const cls = ["vms-timeline-entry"];
    if (n.tone) cls.push(`vms-timeline-entry--${n.tone}`);
    if (n.state) cls.push(`vms-timeline-entry--${n.state}`);
    li.className = cls.join(" ");

    // time — always string, always caption-tier trained typography (COMP-01)
    const time = document.createElement("div");
    time.className = "vms-timeline-entry__time";
    this.node({ type: "text", value: n.time, style: "caption" }, time, on);
    li.appendChild(time);

    // description — string → body-tier; ViewNode → as-is (rich content OK)
    const desc = document.createElement("div");
    desc.className = "vms-timeline-entry__description";
    if (typeof n.description === "string") {
      this.node({ type: "text", value: n.description, style: "body" }, desc, on);
    } else {
      this.node(n.description, desc, on);
    }
    li.appendChild(desc);

    // Optional icon — larger dot slot (CSS-positioned via .vms-timeline-entry__icon)
    if (n.icon) {
      const iconWrap = document.createElement("span");
      iconWrap.className = "vms-timeline-entry__icon";
      iconWrap.appendChild(this.renderIconSvg(n.icon, "sm", undefined, undefined));
      li.appendChild(iconWrap);
    }

    parent.appendChild(li);
  }

  /** v8.0.0 (COMP-12a) — SettingListNode renderer. Container for
   *  SettingRowNode children with an optional heading. Emits an optional
   *  <h3 class="vms-setting-list__heading"> as a SIBLING BEFORE the <ul>
   *  (NOT a child) — same posture as Phase 24 EmptyStateNode's "structural
   *  elements outside the semantic list" approach; the <ul> stays a clean
   *  list of <li> items with no non-list-item children. Single bordered
   *  surface via .vms-setting-list; per-row dividers via CSS on
   *  .vms-setting-row (see default.css). */
  private settingList(n: SettingListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    // Heading is emitted as a SIBLING of the <ul>, not inside. A
    // non-list-item child inside a <ul> would be semantic garbage and would
    // trip a11y validators. Same posture as EmptyState (Phase 24) which
    // places structural elements outside the list.
    if (n.heading) {
      const h = document.createElement("h3");
      h.className = "vms-setting-list__heading";
      h.textContent = n.heading;
      parent.appendChild(h);
    }
    const ul = document.createElement("ul");
    ul.className = "vms-setting-list";
    // Runtime tree may smuggle non-SettingRowNode children — the tree
    // validator (server.ts collectActions "setting-list" arm) rejects them
    // with invalid_tree before we get here.
    this.kids(n.children as unknown as ViewNode[], ul, on);
    parent.appendChild(ul);
  }

  /** v8.0.0 (COMP-12) — SettingRowNode renderer. The settings-page primitive
   *  — one row per toggleable / configurable setting. Emits
   *  <li class="vms-setting-row [vms-setting-row--clickable]"> with a
   *  [body | control] grid (1fr auto, align-items:center). The body column
   *  stacks [icon? label description?]; the control column holds the
   *  trailing slot vertically centered.
   *
   *  STRING-LIFT trained typography:
   *   - label string → TextNode { style: "body", weight: "medium" }
   *     (COMP-01/02 body + weight axes from Phase 23).
   *   - label ViewNode → rendered as-is (escape hatch — rich content OK).
   *   - description string → TextNode { style: "muted" } inside a <p>.
   *     The <p class="vms-setting-row__description"> is what receives the
   *     max-width:42rem readable-line-length cap (CSS-owned, framework
   *     concern per the Phase 24 primary composite posture).
   *   - description ViewNode → rendered as-is.
   *
   *  TRAILING slot accepts ANY ViewNode. The NATURAL PAIRING is
   *  CheckboxNode(variant:"switch") from COMP-03 (Phase 23) — the whole
   *  recipe exists so an app hands the framework
   *  { label, description, trailing: switch } and gets the shipped
   *  settings-row layout for free. Also common: ButtonNode, LinkNode.
   *
   *  WHOLE-ROW ACTION (opt-in) — same shape as listRow() at browser.ts:1220-
   *  1250. The stopPropagation selector list is EXTENDED to include
   *  .vms-field--switch so a click on the trailing switch does NOT
   *  double-fire the row action (the natural pairing must behave
   *  correctly — a switch inside a clickable row should toggle without
   *  triggering the row's own click). */
  private settingRow(n: SettingRowNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const li = document.createElement("li");
    const cls = ["vms-setting-row"];
    if (n.state) cls.push(`vms-setting-row--${n.state}`);
    if (n.action) cls.push("vms-setting-row--clickable");
    li.className = cls.join(" ");

    // Body column — icon? + label + description?
    const body = document.createElement("div");
    body.className = "vms-setting-row__body";
    if (n.icon) body.appendChild(this.renderIconSvg(n.icon, "sm", undefined, undefined));

    const label = document.createElement("div");
    label.className = "vms-setting-row__label";
    if (typeof n.label === "string") {
      // String-lift trained typography (COMP-01/02 body + weight axes).
      // MUTATION test: swap weight:"medium" → weight:"bold" breaks the
      // typography assertion in test/setting-row.test.ts.
      this.node({ type: "text", value: n.label, style: "body", weight: "medium" }, label, on);
    } else {
      this.node(n.label, label, on);
    }
    body.appendChild(label);

    if (n.description != null) {
      // <p> element receives the .vms-setting-row__description max-width:42rem
      // readable-line-length cap from default.css. String → TextNode{muted};
      // ViewNode → rendered as-is (rich content OK).
      const desc = document.createElement("p");
      desc.className = "vms-setting-row__description";
      if (typeof n.description === "string") {
        this.node({ type: "text", value: n.description, style: "muted" }, desc, on);
      } else {
        this.node(n.description, desc, on);
      }
      body.appendChild(desc);
    }
    li.appendChild(body);

    // Trailing control — any ViewNode; typically CheckboxNode(variant:"switch")
    // from COMP-03. Vertically centered via grid align-items:center on the
    // <li> (CSS-owned).
    if (n.trailing) {
      const ctrl = document.createElement("div");
      ctrl.className = "vms-setting-row__control";
      this.node(n.trailing, ctrl, on);
      li.appendChild(ctrl);
    }

    // Whole-row action — click-anywhere + keyboard + ARIA. Mirrors
    // listRow() at browser.ts:1220-1250 (which mirrors TableRow.action at
    // browser.ts:3694-3714). The stopPropagation selector list is EXTENDED
    // to include .vms-field--switch so the natural switch pairing doesn't
    // double-fire the row action — that's the mitigation for threat
    // T-25-04-02 and the test/setting-row.test.ts stopPropagation-from-
    // switch test proves it.
    if (n.action) {
      const action = n.action;
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      const ariaText = (li.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (ariaText) li.setAttribute("aria-label", ariaText);
      li.addEventListener("click", () => { on(action); });
      li.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          on(action);
        } else if (e.key === " " || e.key === "Spacebar") {
          e.preventDefault(); // suppress page scroll
          on(action);
        }
      });
      // Containment: clicks on nested interactive controls must NOT bubble
      // to the row's click handler. Selector list is the ListRowNode.action
      // list PLUS .vms-field--switch — the checkbox() renderer emits
      // .vms-checkbox on the <label> (with a .vms-field--switch modifier
      // for switch variant) and .vms-checkbox__input on the <input>. All
      // three selectors ensure BOTH click-on-input AND click-on-label
      // (which native <label>-for semantics would forward) are contained.
      li.querySelectorAll<HTMLElement>(
        ".vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, .vms-field--switch, a[href]"
      ).forEach(ctrl => {
        ctrl.addEventListener("click", (e) => { e.stopPropagation(); });
      });
    }

    parent.appendChild(li);
  }

  /** v8.0.0 (COMP-13a) — ChipListNode renderer. Flex-wrap horizontal pill
   *  cluster (`<div class="vms-chip-list" role="list">`). Tree-validator
   *  (server.ts) enforces the ChipNode-only child invariant with a
   *  byte-identical error message across both backends; at runtime we still
   *  descend via kids() — any non-Chip that slips past goes through node()
   *  and is warned by the unknown-type default arm. */
  private chipList(n: ChipListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const div = document.createElement("div");
    div.className = "vms-chip-list";
    div.setAttribute("role", "list");
    this.kids(n.children as unknown as ViewNode[], div, on);
    parent.appendChild(div);
  }

  /** v8.0.0 (COMP-13) — ChipNode renderer. Tinted-pill primitive for filter
   *  chips, selected tags, category pills. Renders as
   *  `<span class="vms-chip" role="listitem">`; upgraded to `role="button"`
   *  + tabIndex=0 + Enter/Space keydown when `action` is set (chip IS the
   *  button when action is set — the last setAttribute wins).
   *
   *  🚨 CRITICAL — the dismissAction dispatch calls `on(n.dismissAction)`
   *  with the CALLER-SUPPLIED ActionEvent (mirrors ModalNode.dismissAction
   *  shape), NOT `on({name:"dismiss"})` like AlertNode.dismissible. Chips
   *  need identity-carrying dispatch (`remove-filter-42`, `unselect-tag-foo`).
   *  If a future contributor reverts this to the AlertNode fixed-name shape,
   *  the vitest KEY MUTATION TEST fails immediately. Do not "fix" the
   *  divergence — it is intentional and load-bearing.
   *
   *  When BOTH `n.action` and `n.dismissAction` are present, the X button's
   *  click stopPropagation()s so the whole-chip click does NOT double-fire. */
  private chip(n: ChipNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const span = document.createElement("span");
    const cls = ["vms-chip"];
    if (n.tone) cls.push(`vms-chip--${n.tone}`);
    if (n.state) cls.push(`vms-chip--${n.state}`);
    if (n.action) cls.push("vms-chip--clickable");
    span.className = cls.join(" ");
    span.setAttribute("role", "listitem");

    if (n.icon) span.appendChild(this.renderIconSvg(n.icon, "xs", undefined, undefined));
    span.appendChild(document.createTextNode(n.label));

    // 🚨 dismissAction — CALLER-SUPPLIED ActionEvent (mirrors
    // ModalNode.dismissAction shape, NOT AlertNode.dismissible's fixed-name
    // shape). Absent = no X rendered (respects "no dead UI"; CONTEXT §5
    // explicitly notes this). If a future contributor reverts
    // `on(dismissAction)` → `on({name:"dismiss"})` matching AlertNode, the
    // vitest KEY MUTATION TEST fails.
    if (n.dismissAction) {
      const dismissAction = n.dismissAction;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vms-chip__dismiss";
      btn.setAttribute("aria-label", `Remove ${n.label}`);
      btn.textContent = "✕";
      btn.addEventListener("click", (e) => {
        // When BOTH n.action and n.dismissAction are set, the X must not
        // double-fire the whole-chip click.
        if (n.action) e.stopPropagation();
        on(dismissAction);
      });
      span.appendChild(btn);
    }

    // Whole-chip click — SAME pattern as listRow()'s action wiring
    // (role="button", tabIndex=0, Enter/Space keydown with Space
    // preventDefault). Applied to the .vms-chip span itself; the last
    // setAttribute("role", ...) wins over the earlier "listitem".
    if (n.action) {
      const action = n.action;
      span.tabIndex = 0;
      span.setAttribute("role", "button");
      span.addEventListener("click", () => { on(action); });
      span.addEventListener("keydown", (e) => {
        if (e.key === "Enter") on(action);
        else if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); on(action); }
      });
    }

    parent.appendChild(span);
  }

  /** v8.0.0 (COMP-06) — MessageNode renderer. Chat/comment message with a
   *  [avatar | body] grid. Body is a stack: header (author + timestamp) →
   *  padded content surface → optional actions bar. String content wraps in
   *  `TextNode { style: "body" }`; ViewNode content renders as-is. Role
   *  ("assistant"/"user"/"system") emits `.vms-message--{role}` which the
   *  shipped CSS uses to tint the content surface. Actions are ALWAYS
   *  VISIBLE — no hover-reveal (banked a11y doctrine). */
  private message(n: MessageNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const wrap = document.createElement("div");
    const cls = ["vms-message"];
    if (n.role) cls.push(`vms-message--${n.role}`);
    if (n.state) cls.push(`vms-message--${n.state}`);
    wrap.className = cls.join(" ");

    // Avatar column — auto-sized (matches AvatarNode's size). The column
    // element is emitted UNCONDITIONALLY so the [avatar | body] grid keeps a
    // consistent baseline across a MessageList (even when a single message
    // has no avatar, its body-column position stays aligned with siblings
    // that do). Empty when n.avatar is absent.
    const avatarEl = document.createElement("div");
    avatarEl.className = "vms-message__avatar";
    if (n.avatar) this.node(n.avatar, avatarEl, on);
    wrap.appendChild(avatarEl);

    // Body column: header (author + optional timestamp) → content → optional actions.
    const body = document.createElement("div");
    body.className = "vms-message__body";

    // Header — author (required) + timestamp (optional). textContent, no innerHTML.
    const header = document.createElement("div");
    header.className = "vms-message__header";
    const author = document.createElement("span");
    author.className = "vms-message__author";
    author.textContent = n.author;
    header.appendChild(author);
    if (n.timestamp) {
      const ts = document.createElement("span");
      ts.className = "vms-message__timestamp";
      ts.textContent = n.timestamp;
      header.appendChild(ts);
    }
    body.appendChild(header);

    // Content surface — string → trained TextNode{style:"body"} (COMP-01 body
    // tier); ViewNode → dispatched through node() as-is.
    const content = document.createElement("div");
    content.className = "vms-message__content";
    if (typeof n.content === "string") {
      this.node({ type: "text", value: n.content, style: "body" }, content, on);
    } else {
      this.node(n.content, content, on);
    }
    body.appendChild(content);

    // Actions bar — right-aligned, ALWAYS VISIBLE when actions is non-empty.
    // NO hover-reveal / conditional-hide class (banked a11y doctrine — the
    // shipped design of record explicitly excludes hover-reveal).
    if (n.actions && n.actions.length > 0) {
      const actions = document.createElement("div");
      actions.className = "vms-message__actions";
      for (const btn of n.actions) this.button(btn, actions, on);
      body.appendChild(actions);
    }

    wrap.appendChild(body);
    parent.appendChild(wrap);
  }

  /** v8.0.0 (COMP-06a) — MessageListNode renderer.
   *
   *  🚨 FOLLOW-TAIL REUSE (plan-checker C-4): the ONLY new adapter code for
   *  followTail semantics is `div.dataset.followTail = ""`. The shipped
   *  SectionNode.followTail mechanism at browser.ts:227-231 (skip generic
   *  scroll-map), :239-246 (pre-render snapshot), :362-372 (post-render
   *  restore) walks EVERY [data-follow-tail] element in document order —
   *  MessageListNode piggybacks by setting the same attribute. NO parallel
   *  snapshot/restore code exists (or should exist) inside this method.
   *
   *  Tree-validator (server.ts + ViewModels.cs) rejects non-MessageNode
   *  children with `invalid_tree` — the renderer trusts that and dispatches
   *  children through the standard node() walk (which will render each as
   *  message()). */
  private messageList(n: MessageListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const div = document.createElement("div");
    div.className = "vms-message-list";
    // MessageListNode.followTail — REUSES SectionNode's shipped mechanism.
    // The pre-render snapshot at browser.ts:239-246 walks EVERY
    // [data-follow-tail] element in document order; the post-render restore at
    // browser.ts:362-372 pins each to its new bottom (or preserves old
    // scrollTop when scrolled up). NO new adapter code — this line is the
    // only change. Verbatim from SectionNode.followTail's own emission at
    // browser.ts:1063.
    if (n.followTail === true) div.dataset.followTail = "";
    // Children are MessageNode[] on the type — the tree-validator rejects
    // non-MessageNode entries server-side. The renderer just walks children
    // through the standard node() dispatch (which will render each as
    // message()); a belt-and-braces filter here would be redundant.
    this.kids(n.children as unknown as ViewNode[], div, on);
    parent.appendChild(div);
  }

  /** v8.0.0 (COMP-07) — Tone → default icon mapping. Baked into the browser
   *  renderer as a static, frozen table (matches CONTEXT §5 locked schema).
   *  All four default names are LUCIDE icons shipped in the Phase 22 v7.0
   *  curated IconName union. `AlertNode.icon` overrides the tone default. */
  private static readonly ALERT_TONE_ICON: Record<
    "danger" | "warning" | "success" | "info", IconName
  > = {
    danger: "x-circle",
    warning: "alert-triangle",
    success: "check-circle",
    info: "info",
  };

  /** v8.0.0 (COMP-07) — AlertNode renderer.
   *
   *  Prominent status-message primitive. Grid: [icon | body | actions].
   *  `tone` is REQUIRED — drives surface palette (`.vms-alert--{tone}` +
   *  color-mix tinted background from default.css) AND selects the default
   *  icon (baked-in `ALERT_TONE_ICON` map). `n.icon` overrides the tone
   *  default.
   *
   *  DISMISSIBLE — deliberate deviation from `ModalNode.dismissAction`.
   *  `dismissible: true` renders a close-X that dispatches the RESERVED
   *  fixed action name `{ name: "dismiss" }` LOCALLY at click time (no
   *  caller-supplied ActionEvent slot on the wire — see the interface's
   *  TSDoc for the rationale). Apps needing a specific name compose their
   *  own dismiss button in `actions[]` and set `dismissible: false`. */
  private alert(n: AlertNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const wrap = document.createElement("div");
    wrap.className = `vms-alert vms-alert--${n.tone}`;

    // Icon slot — n.icon overrides; else tone default. renderIconSvg reused
    // verbatim (Phase 22 shared factory — the single anti-drift lock).
    const iconName = n.icon ?? BrowserAdapter.ALERT_TONE_ICON[n.tone];
    const iconWrap = document.createElement("div");
    iconWrap.className = "vms-alert__icon";
    iconWrap.appendChild(this.renderIconSvg(iconName, "md", undefined, undefined));
    wrap.appendChild(iconWrap);

    // Body column: optional title + required message.
    const body = document.createElement("div");
    body.className = "vms-alert__body";
    if (n.title) {
      const title = document.createElement("div");
      title.className = "vms-alert__title";
      // Trained typography: text-md, weight:medium (COMP-02 weight axis).
      // String-lift via TextNode — matches CONTEXT §5 slot string-lift table.
      this.node({ type: "text", value: n.title, style: "body", weight: "medium" }, title, on);
      body.appendChild(title);
    }
    const message = document.createElement("div");
    message.className = "vms-alert__message";
    if (typeof n.message === "string") {
      // String-lift into TextNode{style:"muted"} — trained typography for the
      // secondary/subordinate line, matching CONTEXT §5.
      this.node({ type: "text", value: n.message, style: "muted" }, message, on);
    } else {
      // ViewNode branch — rendered as-is (consumers who need a custom shape
      // pass a ViewNode instead of a string).
      this.node(n.message, message, on);
    }
    body.appendChild(message);
    wrap.appendChild(body);

    // Actions column — right-aligned buttons + optional dismiss X. The column
    // is emitted ONLY when there are actions OR dismissible is true; an alert
    // with neither has no third grid column populated (the `grid-template-
    // columns: auto 1fr auto` still lays out cleanly because the auto track
    // collapses to zero when no child is present).
    if ((n.actions && n.actions.length > 0) || n.dismissible === true) {
      const actionsEl = document.createElement("div");
      actionsEl.className = "vms-alert__actions";
      for (const btn of n.actions ?? []) this.button(btn, actionsEl, on);
      if (n.dismissible === true) {
        // DEVIATION from ModalNode.dismissAction (CONTEXT §5): the composite
        // emits the FIXED, RESERVED action name `"dismiss"` locally rather
        // than accepting a caller-supplied ActionEvent slot. Apps that need
        // a distinct name compose their own dismiss button in `actions[]`
        // and set `dismissible: false`. Documented in AlertNode TSDoc.
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "vms-alert__dismiss";
        closeBtn.setAttribute("aria-label", "Dismiss");
        closeBtn.textContent = "✕";
        closeBtn.addEventListener("click", () => on({ name: "dismiss" }));
        actionsEl.appendChild(closeBtn);
      }
      wrap.appendChild(actionsEl);
    }

    parent.appendChild(wrap);
  }

  private listItem(n: ListItemNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const li = document.createElement("li");
    li.className = `vms-list-item${n.state ? ` vms-list-item--${n.state}` : ""}${
      n.tone ? ` vms-list-item--${n.tone}` : ""}${
      n.completed === true ? " vms-list-item--task-done" :
      n.completed === false ? " vms-list-item--task-todo" : ""}`;
    if (n.id) li.dataset.id = n.id;
    // Task-list marker: fixed check glyph in front of the content when
    // `completed` is set. Filled check for done, empty box for todo, nothing
    // when absent (byte-identical to the pre-task-list rendering).
    // aria-hidden on the glyph — the assistive-tech-readable text lives in
    // the item's actual content nodes; the glyph is a visual cue only.
    if (n.completed !== undefined) {
      const glyph = document.createElement("span");
      glyph.className = "vms-list-item__marker";
      glyph.setAttribute("aria-hidden", "true");
      glyph.textContent = n.completed ? "☑" : "☐"; // ☑ / ☐
      li.appendChild(glyph);
    }
    // v7.0.0 (ICON-04) — leading icon (size sm, tone inherited from
    // list-item.tone) rendered after any task-list marker and before the item
    // content.
    if (n.icon) li.appendChild(this.renderIconSvg(n.icon, "sm", n.tone, undefined));
    this.kids(n.children, li, on);
    parent.appendChild(li);
  }

  /** FormNode — no harvest. Field values live in state via their bind paths;
   *  submit dispatches just `{name}`. File inputs are walked for binaries to
   *  attach to action.files (multipart side channel). */
  private form(n: FormNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const form = document.createElement("form");
    form.className = `vms-form${n.layout && n.layout !== "stack" ? ` vms-form--${n.layout}` : ""}`;
    form.noValidate = true;

    // File collection is by DECLARED intent, not button position: a file input
    // rides an action iff that action's name is listed in the input's `uploadOn`
    // (carried here via the data-vms-upload-on attribute set in field()). EVERY
    // trigger inside the form — submit, buttons[], a ButtonNode or
    // FieldNode.action nested in children — routes through this one path, so
    // where a trigger sits is irrelevant; the file's own uploadOn decides. An
    // input with no uploadOn rides nothing (there is no positional fallback).
    const dispatchWithFiles = (action: ActionEvent): void => {
      const files: Record<string, File> = {};
      form.querySelectorAll<HTMLInputElement>("input[type=file]").forEach(inp => {
        if (!inp.name || !inp.files?.[0]) return;
        let uploadOn: string[] = [];
        try { uploadOn = JSON.parse(inp.dataset.vmsUploadOn ?? "[]"); } catch { uploadOn = []; }
        if (uploadOn.includes(action.name)) files[inp.name] = inp.files[0];
      });
      const ev: ActionEvent = { name: action.name };
      if (Object.keys(files).length > 0) ev.files = files;
      on(ev);
    };

    // Children dispatch through the file-aware path too — so a ButtonNode (or a
    // FieldNode.action Enter) nested anywhere in the form carries files per the
    // uploadOn contract, identical to a footer buttons[] trigger.
    this.kids(n.children, form, dispatchWithFiles);

    // #22 — submitButton takes precedence: the form renders the consumer's own
    // button (its label + emphasis/tone/size/width) as the submit and fires its
    // action; submitLabel/submitAction for the implicit button are then ignored.
    const sb = n.submitButton;
    const effectiveSubmit = sb ? sb.action : n.submitAction;
    if (sb) {
      const submit = document.createElement("button");
      submit.type = "submit";
      // Same appearance + activation as a standalone button — disabled/confirm/
      // pendingLabel included. The form's submit event is the single dispatch
      // point (keeps native Enter-to-submit for text fields working); activate()
      // carries the disabled guard, confirm guard, and pendingLabel swap.
      const activate = this.applyButtonBehavior(submit, sb, dispatchWithFiles);
      form.appendChild(submit);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        activate();
      });
    } else if (n.submitAction) {
      const submitAction = n.submitAction;
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "vms-button vms-button--primary";
      submit.textContent = n.submitLabel ?? "Submit";
      form.appendChild(submit);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        dispatchWithFiles(submitAction);
      });
    } else {
      // No default submit — neutralize implicit Enter submission so a
      // single-field buttons[]-only form doesn't reload via native submit.
      form.addEventListener("submit", (e) => e.preventDefault());
    }

    // Opt-in chat-composer affordance: bare Enter in a descendant textarea
    // dispatches the submit (a textarea otherwise eats Enter as a newline and
    // never submits). Modifier-Enter falls through to a normal newline, and an
    // IME composition Enter (candidate confirmation) must NOT submit. No-op
    // when submitAction is absent. Same dispatch path as the submit button.
    if (n.submitOnEnter && effectiveSubmit) {
      const submitAction = effectiveSubmit;
      form.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(ta => {
        ta.addEventListener("keydown", (e) => {
          if (e.key !== "Enter") return;
          if (e.isComposing || e.keyCode === 229) return;             // IME candidate confirm — not a send
          if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return; // newline / shortcut
          e.preventDefault();
          dispatchWithFiles(submitAction);
        });
      });
    }

    if (n.buttons && n.buttons.length > 0) {
      const row = document.createElement("div");
      row.className = "vms-form__buttons";
      const buttonOn = (action: ActionEvent): void => dispatchWithFiles(action);
      for (const btn of n.buttons) this.button(btn, row, buttonOn);
      form.appendChild(row);
    }

    parent.appendChild(form);
  }

  /** FieldNode — reads value from `sa.read(bind)`; writes back on input/change.
   *  When `action` is set, it fires on Enter (text-like) or change (select) —
   *  the new value is already in state by that point. */
  /** Warn to the dev console at most once per key (deduped over this adapter's
   *  lifetime). Fires in dev AND prod — the client bundle can't tell them apart,
   *  and prod telemetry that captures console.warn should see these too. */
  private warnOnce(key: string, msg: string): void {
    if (!this.diagWarned.has(key)) {
      this.diagWarned.add(key);
      console.warn(msg);
    }
  }

  /** Read a bind path, tolerating a bind-less field (file inputs) — null bind
   *  reads nothing. */
  private readBind(bind: string | undefined): unknown {
    return bind == null ? undefined : this.sa.read(bind);
  }

  /** Write to a bind path, no-op when the field has no bind (file inputs). */
  private writeBind(bind: string | undefined, value: unknown): void {
    if (bind != null) this.sa.write(bind, value);
  }

  /** 6.12.1 (TOOL-01) — apply a hover-only info tooltip to any rendered element.
   *
   *  🚨 REVISED FROM 6.12.0 CSS-pseudo-element approach after Ashley's first-use
   *  verification found two real bugs the pure-CSS shape structurally couldn't
   *  fix: (a) tooltip on a Save button near the page edge got clipped by the
   *  viewport (no CSS-only way to detect the edge and shift); (b) tooltip on a
   *  TableColumn header was clipped by `.vms-table-wrapper { overflow-x: auto }`
   *  because the `::after` pseudo lives INSIDE the wrapper's overflow context.
   *  Also latent: `.vms-table__th--asc/desc::after` sort arrows would collide
   *  with a tooltip `::after` on the same header. The pure-CSS v1 was too
   *  limited; the fix is a body-appended singleton positioned by JS — the
   *  same shape MUI/Ant use.
   *
   *  Stamps THREE things on the anchor element:
   *  (a) the native `title=` attribute (agent-legible + headless fallback +
   *      touch long-press affordance; always works without JS/CSS);
   *  (b) the `.vms-has-tooltip` class hook (for consumers who want to target
   *      the anchor CSS-wise);
   *  (c) `data-vms-tooltip=` for parity introspection.
   *  Then attaches `mouseenter`/`mouseleave`/`focusin`/`focusout` handlers
   *  that show/hide a SINGLETON `.vms-tooltip-host` element appended to
   *  `document.body`. Because the host is a body child (NOT a descendant of
   *  the anchor's wrapper), no `overflow:hidden` / `overflow:auto` on any
   *  ancestor of the anchor can clip it — table wrappers, modal frames,
   *  scroll containers all pass through.
   *
   *  Positioning strategy on show:
   *    1. Measure the anchor's viewport rect.
   *    2. Measure the (temporarily rendered) tooltip's own rect.
   *    3. Prefer ABOVE the anchor; flip BELOW if `anchor.top < tt.height + 8`
   *       — closes the top-of-viewport clip that CSS-only couldn't detect.
   *    4. Center horizontally under/over the anchor.
   *    5. Clamp the horizontal offset into the viewport with an 8px margin —
   *       closes the horizontal edge clip Ashley hit on the Save button.
   *    6. Convert viewport-relative to document-relative via `scrollX`/`Y`
   *       for `position: absolute` on body (survives page scroll).
   *
   *  Non-dismissible, hover-only. The string wire field enforces info-only
   *  structurally (no ViewNode can nest inside a `string`). Absent = no
   *  tooltip; the helper no-ops on null/empty. */
  private applyTooltip(el: HTMLElement, tooltip: string | undefined): void {
    if (tooltip == null || tooltip === "") return;
    el.title = tooltip;
    el.classList.add("vms-has-tooltip");
    el.dataset.vmsTooltip = tooltip;

    const show = (): void => {
      const host = this.ensureTooltipHost();
      host.textContent = tooltip;
      host.hidden = false;
      // Two-phase measure: force layout with an offscreen top/left so the
      // measurement is stable, then re-position with the real coordinates.
      host.style.top = "0px";
      host.style.left = "0px";
      const anchor = el.getBoundingClientRect();
      const tt = host.getBoundingClientRect();
      const margin = 8;
      const gap = 6;
      const preferAbove = anchor.top >= tt.height + gap + margin;
      const viewportY = preferAbove
        ? anchor.top - tt.height - gap
        : anchor.bottom + gap;
      let viewportX = anchor.left + anchor.width / 2 - tt.width / 2;
      viewportX = Math.max(
        margin,
        Math.min(viewportX, window.innerWidth - tt.width - margin),
      );
      // Convert viewport-relative → document-relative so the tooltip stays
      // pinned to the anchor even after the user scrolls the page.
      host.style.top = `${viewportY + window.scrollY}px`;
      host.style.left = `${viewportX + window.scrollX}px`;
    };
    const hide = (): void => {
      if (this.tooltipHost) this.tooltipHost.hidden = true;
    };

    el.addEventListener("mouseenter", show);
    el.addEventListener("mouseleave", hide);
    // Keyboard disclosure: keeps the a11y property that a keyboard user can
    // reach the same info as a mouse user (mirrors :focus-visible in the old
    // CSS approach, but now works even for non-natively-focusable elements
    // if the app makes them focusable via tabindex).
    el.addEventListener("focusin", show);
    el.addEventListener("focusout", hide);
  }

  /** Lazy-create the singleton `.vms-tooltip-host` appended to `document.body`.
   *  One per adapter instance; survives adapter re-renders (the container's
   *  innerHTML wipe doesn't touch body children). */
  private tooltipHost: HTMLElement | undefined;
  private ensureTooltipHost(): HTMLElement {
    if (this.tooltipHost) return this.tooltipHost;
    const host = document.createElement("div");
    host.className = "vms-tooltip-host";
    host.setAttribute("role", "tooltip");
    host.hidden = true;
    document.body.appendChild(host);
    this.tooltipHost = host;
    return host;
  }

  private field(n: FieldNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const stateValue = this.readBind(n.bind);

    // [vms:no-bind] — a value-bearing input with no bind renders but silently
    // drops user input (nothing to persist to). Exclude `file` (bind is
    // legitimately optional — the binary rides multipart) and `hidden`
    // (server-authoritative, no user input).
    if (n.inputType !== "file" && n.inputType !== "hidden" && n.bind == null) {
      this.warnOnce(
        "no-bind:" + n.name,
        "[vms:no-bind] FieldNode '" + n.name + "' (inputType=" + n.inputType +
          ") has no bind — value-bearing inputs need a bind path to persist; the field renders but user input is dropped.",
      );
    }

    if (n.inputType === "hidden") {
      // Hidden fields don't write back — server is authoritative for hidden.
      const inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = n.name;
      inp.value = stateValue == null ? "" : String(stateValue);
      parent.appendChild(inp);
      return;
    }

    if (n.inputType === "checkbox") {
      // FieldNode of type checkbox — used as a form-collected checkbox (the
      // standalone CheckboxNode is the immediate-dispatch variant). Bind path
      // holds a boolean.
      const wrapper = document.createElement("div");
      wrapper.className = "vms-field vms-field--checkbox";

      const inp = document.createElement("input");
      inp.type = "checkbox";
      inp.className = "vms-field__input";
      inp.id = `vms-${n.name}`;
      inp.name = n.name;
      inp.checked = Boolean(stateValue);
      inp.addEventListener("change", () => {
        this.writeBind(n.bind, inp.checked);
      });

      wrapper.appendChild(inp);

      if (n.label) {
        const lbl = document.createElement("label");
        lbl.className = "vms-field__label";
        lbl.htmlFor = `vms-${n.name}`;
        lbl.textContent = n.label;
        wrapper.appendChild(lbl);
      }
      parent.appendChild(wrapper);
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "vms-field";

    if (n.label) {
      const lbl = document.createElement("label");
      lbl.className = "vms-field__label";
      lbl.htmlFor = `vms-${n.name}`;
      lbl.textContent = n.label;
      wrapper.appendChild(lbl);
    }

    if (n.inputType === "select" || n.inputType === "select-multiple") {
      const sel = document.createElement("select");
      sel.className = "vms-field__input";
      sel.id = `vms-${n.name}`;
      sel.name = n.name;
      sel.multiple = n.inputType === "select-multiple";
      const isMulti = n.inputType === "select-multiple";
      const selectedSet: Set<string> = isMulti && Array.isArray(stateValue)
        ? new Set((stateValue as unknown[]).map(String))
        : new Set();
      const selectedSingle: string = !isMulti && stateValue != null ? String(stateValue) : "";
      (n.options ?? []).forEach(opt => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        o.selected = isMulti ? selectedSet.has(opt.value) : opt.value === selectedSingle;
        sel.appendChild(o);
      });
      // A <select> ALWAYS displays a selected option — HTML auto-selects the
      // first when none is explicitly `selected`. VMS is state-driven: the
      // submitted _state carries the value, NOT a DOM harvest, so the value the
      // user SEES selected must be reflected in state. Without this seed a select
      // whose bound path has no value (or that the user leaves at its displayed
      // default) writes NOTHING to state — its key is ABSENT on dispatch even
      // though an option is visibly chosen — so presence-checking server
      // validators report it unset. Seed the effective displayed value whenever
      // state doesn't already carry it. An app wanting a "please choose" state
      // uses a placeholder option (value ""): the seeded value is then "" — an
      // explicit empty the server can reject, never a silently-missing key.
      if (isMulti) {
        if (!Array.isArray(stateValue)) {
          this.writeBind(n.bind, Array.from(sel.selectedOptions, o => o.value));
        }
      } else if (stateValue === undefined || String(stateValue) !== sel.value) {
        this.writeBind(n.bind, sel.value);
      }
      sel.addEventListener("change", () => {
        if (isMulti) {
          const arr = Array.from(sel.selectedOptions).map(o => o.value);
          this.writeBind(n.bind, arr);
        } else {
          this.writeBind(n.bind, sel.value);
        }
        if (n.action) on(n.action);
      });
      wrapper.appendChild(sel);
    } else if (n.inputType === "lookup" || n.inputType === "lookup-multiple") {
      // Phase 21 (LOOK-01) — the lookup / reference picker: an editable
      // combobox over a candidate set the SERVER resolves. A `select` says
      // "here are all the values, pick one"; a lookup says "the values are a
      // database table — describe which row you mean". Built to the ARIA 1.2
      // combobox contract (design §7 items 1-7; keyboard items 14-22).
      //
      // Cardinality is a local bool, exactly as the select arm above does it:
      // D2 splits the WIRE tokens (lookup / lookup-multiple are separate
      // inputTypes because the chips layer is a second widget grafted on, not
      // an orthogonal flag), but the renderer may still share one code path.
      const isMulti = n.inputType === "lookup-multiple";
      wrapper.classList.add("vms-field--lookup");
      if (isMulti) wrapper.classList.add("vms-field--lookup-multiple");
      // Phase 21 (LOOK-02) — mark this key rendered so render()'s mark-sweep
      // keeps this lookup's pending debounce timer and live regions alive.
      this.lookupKeysSeen.add(n.name);

      // [vms:lookup-no-searchbind] — a searchAction with no searchBind
      // dispatches the query but the server can never READ what was typed: a
      // silently dead typeahead that renders perfectly and returns nothing
      // forever. Structurally invisible, so warn.
      if (n.searchAction && n.searchBind == null) {
        this.warnOnce(
          "lookup-no-searchbind:" + n.name,
          "[vms:lookup-no-searchbind] lookup FieldNode '" + n.name +
            "' has a searchAction but no searchBind — the query is dispatched but never round-trips, " +
            "so the server cannot see what was typed and the typeahead returns nothing forever; add searchBind:\"<path>\".",
        );
      }

      // [vms:lookup-ambiguous-enter] — D15. `allowCustom` + `searchAction` on
      // ONE field overloads Enter: "urgent" + Enter is BOTH "invent the tag"
      // and "search for it", and both are legitimate readings of the keystroke.
      // There is no precedence that serves both (invent-first starves search
      // the moment anything is typed; search-first starves invention forever) —
      // and that there is no good ordering is the tell that the SHAPE is wrong,
      // so v1 does not guess. A combination that silently half-works is exactly
      // the quiet failure principle 8 forbids ⇒ loud, but NOT fatal (the
      // [vms:orphan-file] precedent): we degrade to the searchAction reading
      // below and render a coherent directory picker.
      if (n.allowCustom === true && n.searchAction) {
        this.warnOnce(
          "lookup-ambiguous-enter:" + n.name,
          "[vms:lookup-ambiguous-enter] lookup FieldNode '" + n.name +
            "' declares BOTH allowCustom and searchAction — one Enter cannot both invent a value and " +
            "run a search, so this combination is NOT supported in v1 and allowCustom is being IGNORED " +
            "(Enter searches). Declare exactly one: searchAction WITHOUT allowCustom (a directory/reference " +
            "picker — Enter searches, arrow+Enter accepts a candidate), or allowCustom WITHOUT searchAction " +
            "(a free-form tags field — Enter invents). Suggestions on a tags field are deferred.",
        );
      }

      const inp = document.createElement("input");
      inp.type = "text";
      // MANDATORY: decorateField() finds the control via
      // wrapper.querySelector(".vms-field__input"). Without this class every
      // decoration (disabled/readonly/error/help/aria-describedby/aria-invalid)
      // silently no-ops — it fails quietly and structurally passes.
      inp.className = "vms-field__input";
      // Stable id so render()'s focus+caret restore can re-find this input
      // after a re-render. The table filter needs this because an unlucky
      // silent poll can land mid-keystroke; a lookup is WORSE — it dispatches
      // on its OWN keystrokes, so a re-render lands mid-typing on EVERY search
      // (~300ms), not just on an unlucky tick. Without the id the value
      // survives (it's bound state) but focus and caret are destroyed on every
      // debounce fire and the control is unusable.
      inp.id = `vms-${n.name}`;
      inp.name = n.name;
      if (n.placeholder) inp.placeholder = n.placeholder;
      if (n.required) inp.required = true;
      // The browser's own autofill dropdown would fight the listbox popup.
      inp.autocomplete = "off";

      // ── THE DISPLAY PATH (D1) — the decision this primitive exists to protect
      //
      // 🚨 The label is VIEW, not STATE. It is read from `n.selected` and ONLY
      // from `n.selected`. It is NEVER resolved out of `n.candidates`, which
      // feeds the popup listbox and NOTHING ELSE. In BOTH modes it is rendered
      // as a CHIP (D2a) — it never enters `inp.value`.
      //
      // The select arm ~40 lines above resolves what it displays out of its
      // `options` (`o.textContent = opt.label`). Mirroring that instinct here
      // is THE TRAP: with an id-valued field, "filter the candidate list" and
      // "forget what's selected" are THE SAME OPERATION — no cache separates
      // them, and one cannot be seeded for a value the client has never seen.
      // So a lookup that resolved its label from `candidates` renders a raw
      // database id on the one case that matters most: a form that loads with a
      // value already set, where nobody has searched and `candidates` is empty.
      // Ant Design ships exactly this failure silently (`label: ... ?? item.value`);
      // Zag chased it across four changelog entries and two years; SAP names it
      // as its own degenerate case. If you are here to "simplify" this by
      // reading `candidates`, the tests at the top of test/lookup-render.test.ts
      // are telling you not to.
      //
      // Per D5, an entry whose `label` is omitted displays its `value` — a
      // label that merely repeats the id carries no information, so it is
      // absent (that is exactly the free-form-tag case).
      const selectedItems = n.selected ?? [];

      // ══ 🚨 `inp.value` IS THE QUERY. UNCONDITIONALLY. IN BOTH MODES. (D2a) ══
      //
      // There is NO precedence rule here, NO `query != null` vs truthiness
      // split, and NO flag tracking "is the box showing a label or a query?".
      // Their ABSENCE is the point of 21-14, so read why before adding one back:
      //
      // The headline bug (`ownerQuery: ""` beating the label ⇒ the placeholder
      // rendering where a reference was already set) existed because THE INPUT
      // ANSWERED TWO QUESTIONS AT ONCE — *is this the selection or the query?* —
      // arbitrated by a fragile test that ALSO had to not break OPEN-6's
      // empty-query dispatch. Two correct decisions colliding in one field:
      //
      //   • OPEN-6 — an EMPTY QUERY IS A LEGITIMATE QUERY (it is how an app
      //     serves a most-recently-used list), so `""` must still reach the
      //     server ⇒ that rule is about DISPATCH.
      //   • D1 — the label comes from `selected` ⇒ that rule is about DISPLAY.
      //
      // 21-11 fixed it by SPLITTING the two tests (display keyed on non-empty,
      // dispatch on non-null). Correct, and still a patch: the arbitration
      // remained, so the next reader could still get it wrong.
      //
      // 🚨 D2a DISSOLVES THE ROOT CAUSE INSTEAD. The operator hit the real
      // problem at the live page — with the input BEING the selection (the
      // 21-13 SLDS pill), THERE IS NOWHERE TO CLICK TO TYPE; clicking in just
      // appends to "Sally Omer":
      //
      //   "maybe we should just make the pill separate from the input like the
      //    tag setup, even if it is a little awkward. so you always have a place
      //    to type. but instead of adding a pill like with tags, it replaces."
      //
      // So the selection MOVED OUT of the input and became a chip — the same
      // chip multi already used. With the selection in a chip, `inp.value` is
      // unconditionally the query: THERE IS NO QUESTION LEFT TO ARBITRATE, so
      // there is no precedence rule left to get wrong. The class of bug is gone,
      // not fixed.
      //
      // ⇒ IF YOU ARE ABOUT TO ADD A BRANCH HERE THAT DECIDES WHAT THE INPUT
      //   SHOWS, STOP — that branch is the bug, and re-adding it re-opens the
      //   placeholder-instead-of-label failure the operator saw on the tailnet.
      //
      // (OPEN-6 is untouched and lives where it always belonged: the DISPATCH
      // question, answered in the Enter handler / search(). An empty query still
      // dispatches — it just no longer has a display rule to fight with.)
      const query = n.searchBind != null ? this.readBind(n.searchBind) : undefined;
      inp.value = query != null ? String(query) : "";

      // §7 items 1-3 — role="combobox" on the INPUT ITSELF (ARIA 1.2; the 1.0
      // wrapper + aria-owns pattern is deprecated). aria-expanded is ALWAYS
      // present, even when closed. NO aria-haspopup: `listbox` is implicit for
      // role="combobox", so setting it is noise.
      const popupId = `vms-${n.name}-popup`;
      inp.setAttribute("role", "combobox");
      inp.setAttribute("aria-expanded", "false");
      inp.setAttribute("aria-controls", popupId);
      inp.setAttribute("aria-autocomplete", "list");

      // §7 items 4-6 — the popup. Rendered ALWAYS and merely hidden when
      // closed, because aria-controls must stay valid while the popup is
      // hidden. Excluded from the tab sequence (no tabindex anywhere in here):
      // only the input is tabbable, and DOM focus NEVER leaves it — the active
      // option is conveyed by aria-activedescendant rather than a roving
      // tabindex, because moving real focus out of a text input breaks typing.
      const popup = document.createElement("div");
      popup.className = "vms-field__popup";
      popup.id = popupId;
      popup.setAttribute("role", "listbox");
      popup.setAttribute("aria-label", n.label ?? n.name);
      // §7 item 30 — the multi listbox declares itself multi-selectable. Set
      // because it is correct and cheap, but treated as NON-COMMUNICATING (§7
      // item 32): like aria-selected it is barely announced, so the live region
      // is what actually tells an AT user what is happening. Absent (not
      // "false") on single-select — an unset optional is simply absent.
      if (isMulti) popup.setAttribute("aria-multiselectable", "true");
      popup.hidden = true;
      // The key render()'s pre-wipe popup-open snapshot walks.
      popup.dataset.vmsLookupKey = n.name;

      const optionEls: HTMLElement[] = [];
      // 🚨 D12 — CANDIDATES ARE PRESENTED AS GIVEN. This forEach SORTS NOTHING,
      // DEDUPES NOTHING, and TRUNCATES NOTHING, and it must stay that way.
      //
      // The reason is written here because the next reader's instinct is to
      // "tidy" an unsorted list: candidate ORDER IS MEANINGFUL APP DATA.
      // Relevance ordering is the SERVER's judgment, never the widget's — that
      // is universal in mature pickers (Salesforce's picker `searchType`
      // defaults to `Recent`; Dynamics shows 5 most-recently-used rows plus 5
      // favourites, explicitly NOT filtered by the search term). A real
      // consumer ranks candidates by recency-weighted mention frequency in
      // their own handler, and a renderer that helpfully alphabetized for
      // tidiness would SILENTLY DESTROY that ranking with no way for the app to
      // stop it. If an app wants a cap, D7 applies: it says so visibly in the
      // tree (a TextNode — "Refine your filter — N matches, max is X"), because
      // nothing truncates silently.
      (n.candidates ?? []).forEach((c, i) => {
        const opt = document.createElement("div");
        opt.className = "vms-field__option";
        // Index-keyed, NOT value-keyed: candidates are deliberately not deduped
        // (D12), so two entries may legitimately share a value — an id derived
        // from the value would collide and break aria-activedescendant.
        opt.id = `${popupId}-opt-${i}`;
        // §7 item 7 — a role="option" ELEMENT, never a <button>/<a>: an
        // interactive descendant destroys the listbox accessibility tree.
        opt.setAttribute("role", "option");
        opt.setAttribute("aria-selected", "false");
        // textContent, never innerHTML — a server-supplied label is text, not
        // markup (the house idiom throughout this file).
        opt.textContent = c.label ?? c.value;
        opt.dataset.vmsValue = c.value;
        if (c.type != null) opt.dataset.vmsType = c.type;
        popup.appendChild(opt);
        optionEls.push(opt);
      });

      // Popup/highlight state is DOM-local and starts fresh on every render.
      // 🚨 That is deliberate and is half of §7 item 14: we NEVER auto-highlight
      // the first option when results arrive. React Aria's NVDA finding is why
      // — with an option auto-focused, "character deletions and text cursor
      // movement in the ComboBox input weren't being announced at all", and it
      // bites async HARDEST, because the natural implementation highlights
      // option 1 the moment results land, mid-typing. Starting at -1 makes that
      // structural rather than a rule someone has to remember.
      let open = false;
      let activeIndex = -1;

      // Phase 21 (LOOK-05) — the two aria-live regions. Fetched from the
      // PERSISTENT map and RE-APPENDED (never rebuilt): these exact node objects
      // predate this render and must outlive it, or the assistive tech's
      // registration dies with them and every announcement stops silently. This
      // is the chartInstances idiom; see lookupLiveRegions().
      const live = this.lookupLiveRegions(n.name);
      const announce = (message: string): void => this.announceLookup(n.name, message);

      // 🚨 §7 item 27 — ANNOUNCE ADD AND REMOVE, AND ON MULTI ALWAYS WITH THE
      // RUNNING COUNT. GOV.UK FAILED REVIEW FOR EXACTLY THIS OMISSION ("does not
      // announce the selections effectively"): without the count an AT user
      // cannot know the SIZE of the set they are building without abandoning the
      // input to audit the chips one by one. If you are here to shorten the multi
      // strings, that is what you are deleting.
      //
      // 🚨 SINGLE DROPS THE COUNT, AND THAT IS NOT A WEAKENING OF ITEM 27 (D2a).
      // Item 27's count exists to convey THE SIZE OF AN ACCUMULATING SET. Single
      // has no set: picking REPLACES, so the count is always exactly 1 and
      // carries zero information — while "Sally Omer selected. 1 items selected."
      // is both ungrammatical and actively misleading, because it implies an
      // additive control the user does not have (the D2a "watch for": a chip on a
      // single-select could read as "you can add more"). The remove string is the
      // 21-13 clear ✕'s wording, kept verbatim: it says what actually happened.
      const announceAdd = (label: string, count: number): void =>
        announce(isMulti ? `${label} selected. ${count} items selected.` : `${label} selected.`);
      const announceRemove = (label: string, count: number): void =>
        announce(isMulti ? `${label} removed. ${count} items selected.` : `${label} removed. Selection cleared.`);

      // §7 item 13 — the assistive hint, wired via aria-describedby and REMOVED
      // after the first input so it is not a per-keystroke tax. `hintShown`
      // lives on the persistent entry because "the user has typed here before"
      // must survive the re-render their own typing causes.
      //
      // Set on the input directly rather than passed to decorateField: that
      // method seeds its own describedBy list from this attribute (see there),
      // so a lookup carrying `help` and/or `error` keeps all of them.
      let hintEl: HTMLElement | undefined;
      if (!live.hintShown) {
        hintEl = document.createElement("div");
        hintEl.id = `vms-${n.name}-hint`;
        hintEl.className = "vms-field__live";
        hintEl.textContent =
          "When results are available use up and down arrows to review and enter to select.";
        inp.setAttribute("aria-describedby", hintEl.id);
      }

      // "The user is mid-search" — survives the re-render the search causes, via
      // the same pre-wipe snapshot that preserves popup-open.
      const snapshot = this.lookupOpenSnapshot.get(n.name);
      let querying = snapshot?.querying === true;
      const setQuerying = (v: boolean): void => {
        querying = v;
        popup.dataset.vmsLookupQuerying = String(v);
      };
      setQuerying(querying);

      // ══ THE CHIPS LAYER (LOOK-03; BOTH MODES since D2a) ═════════════════════
      //
      // 🚨 D2a — `lookup` AND `lookup-multiple` RENDER SELECTIONS IDENTICALLY:
      // chip(s) OUTSIDE the input, from the SAME code below. THE ONLY DIFFERENCE
      // IS ARITY — single REPLACES on pick, multi APPENDS — and it lives in
      // exactly one place (addValue()). Do NOT fork a parallel single-select
      // chip: the banked "provide-your-own-X" lesson is that a divergent second
      // implementation of the same shape is where behavior silently drops, and
      // everything below (the item-specific remove name, the running-count
      // announcement, the focus-after-removal rule) is what a fork would lose.
      //
      // ⚠️ READ design §7 items 23-31 BEFORE CHANGING ANYTHING BELOW. There is
      // NO APG PATTERN FOR CHIPS AT ALL — every rule here is extrapolation from
      // a PUBLIC FAILURE plus vendor convention, so it is built conservatively
      // and it is all tested (test/lookup-multiple.test.ts).
      //
      // The failure it is extrapolated from: `alphagov/accessible-autocomplete-
      // multiselect` carries the notice "This project is retired as the
      // component is not accessible." It failed GOV.UK's OWN review because it
      // "does not announce the selections effectively or the presence of the
      // 'Remove' button for screenreaders", and they judged the fixes "will be
      // challenging" enough to WITHDRAW rather than repair it. The UK government
      // shipped this control and had to pull it. Items 25 (item-specific remove
      // names), 27 (announce WITH the running count) and 29 (the focus rule) are
      // not polish — they are the difference between this and a retired control.
      //
      // This is why D2 makes multi a SEPARATE inputType: the selected set is a
      // SECOND FOCUSABLE DIMENSION — a second widget grafted onto the first, as
      // Downshift charges a separate hook for. It is NOT an orthogonal flag.
      // And `select-multiple` REMAINS the control for ENUMERABLE sets: that
      // split is an ACCESSIBILITY REQUIREMENT, not taste (the APG combobox has
      // "tested poorly with users for more than two decades"). The lookup must
      // never try to swallow it.
      const chipButtons: HTMLButtonElement[] = [];
      const chipValues: string[] = [];
      const chipLabels: string[] = [];
      let chipList: HTMLElement | undefined;
      // The value of the chip currently armed for the two-step Backspace
      // (§7 item 31), or null. A VALUE rather than an index — see the snapshot.
      let armed: string | null = null;
      let roving = 0;

      /** Mirror the DOM-local chip facts onto the snapshot carrier. */
      const syncChipSnapshot = (): void => {
        popup.dataset.vmsLookupRoving = String(roving);
        popup.dataset.vmsLookupArmed = armed ?? "";
      };

      /**
       * §7 item 26 — ROVING TABINDEX across the remove buttons: exactly one is
       * in the tab sequence at a time; Left/Right traverse.
       *
       * 🚨 Roving tabindex is correct HERE and WRONG for the popup 40 lines
       * below, and the difference is not a style choice. A chip is NOT
       * text-editable, so real DOM focus can move onto it freely — and the
       * remove buttons NEED real focus to be operable at all, which
       * aria-activedescendant cannot give them. The input IS text-editable, so
       * moving DOM focus out of it would break typing, which is why the popup
       * uses aria-activedescendant instead. Same control, two focus models, for
       * two different reasons. Do not "unify" them.
       */
      const setRoving = (i: number): void => {
        if (chipButtons.length === 0) { roving = 0; syncChipSnapshot(); return; }
        roving = Math.min(Math.max(i, 0), chipButtons.length - 1);
        chipButtons.forEach((b, j) => { b.tabIndex = j === roving ? 0 : -1; });
        syncChipSnapshot();
      };

      const setArmed = (value: string | null): void => {
        armed = value;
        chipList?.querySelectorAll<HTMLElement>(".vms-field__chip").forEach((li, i) => {
          li.classList.toggle("vms-field__chip--armed", value != null && chipValues[i] === value);
        });
        syncChipSnapshot();
      };

      /**
       * 🚨 §7 item 29 — THE FOCUS-AFTER-REMOVAL RULE.
       *
       *     next chip's remove button -> else previous chip's -> else the text
       *     input. NEVER <body>.
       *
       * Removing the focused element dumps focus to <body>, which strands the
       * user AT THE TOP OF THE PAGE with no idea where they are or what just
       * happened. This is one of the two failures that retired GOV.UK's
       * component, and it has NO ANALOG in this codebase — nothing else here
       * manages focus across a SET (the <details> restore is by id, not by set
       * position). It is a single named helper on purpose: it is the highest-risk
       * item in this arm and it must be findable, greppable, and testable.
       *
       * Called AFTER the removed entry has been spliced out of `chipButtons`,
       * so `chipButtons[removedIndex]` IS the chip that shifted into the gap —
       * i.e. the "next" one — and it is `undefined` when the removed chip was
       * last. Both fallbacks are therefore structural rather than conditional
       * branches someone can forget to write.
       */
      const focusAfterChipRemoval = (removedIndex: number): void => {
        const next = chipButtons[removedIndex];
        const previous = chipButtons[removedIndex - 1];
        const target: HTMLElement = next ?? previous ?? inp;
        target.focus();
        if (target !== inp) setRoving(chipButtons.indexOf(target as HTMLButtonElement));
        else setRoving(0);
      };

      const removeChipAt = (i: number): void => {
        const value = chipValues[i];
        const label = chipLabels[i];
        const li = chipButtons[i]?.closest<HTMLElement>(".vms-field__chip");
        if (value == null || li == null) return;

        // The id — and ONLY the id — is what persists (D1). The label was never
        // in the bind, so there is nothing to keep in sync here.
        //
        // 🚨 THE ARITY SPLIT, WRITE SIDE (D2a). The wire is explicit and the two
        // shapes are NOT interchangeable: `bind` is a `string` for `lookup` and a
        // `string[]` for `lookup-multiple`. Writing `[]` into a single-select's
        // scalar slot would hand the server an array where its state record
        // declares a string — a cross-backend type mismatch that System.Text.Json
        // rejects outright on the `_state` deserialize. Removing single's one
        // chip IS clearing the selection, so it writes the empty id.
        let remaining: number;
        if (isMulti) {
          const current = this.readBind(n.bind);
          const ids = Array.isArray(current) ? (current as unknown[]).map(String) : [];
          const nextIds = ids.filter(id => id !== value);
          this.writeBind(n.bind, nextIds);
          remaining = nextIds.length;
        } else {
          this.writeBind(n.bind, "");
          remaining = 0;
        }

        // The chip leaves the DOM NOW, not when the server answers. A bind write
        // does not re-render — `selected` is server-owned VIEW — so without this
        // the user clicks "Remove Sally Omer" and Sally's chip just sits there.
        // Same model as every other input in this file: the DOM shows the change
        // immediately, state round-trips, and the SERVER'S NEXT RENDER IS
        // AUTHORITATIVE (chips are rebuilt from `selected` above, so a server
        // that rejects the removal simply puts the chip back).
        li.remove();
        chipButtons.splice(i, 1);
        chipValues.splice(i, 1);
        chipLabels.splice(i, 1);
        if (armed === value) setArmed(null);

        // Focus BEFORE announcing: the user must never be left on <body>, and
        // the announcement is debounced anyway.
        //
        // 🚨 §7 item 29 STILL APPLIES AT ONE CHIP, and single-select is the case
        // that exercises its LAST fallback: with one chip, `next` and `previous`
        // are both undefined, so focus lands on the INPUT. That is exactly right
        // (the user just cleared their selection and the next thing they want is
        // to type), and it is why the rule is written as a structural chain
        // rather than as conditionals someone could forget to extend to single.
        focusAfterChipRemoval(i);
        announceRemove(label, remaining);
      };

      /** Empty the chip list and the parallel DOM-local arrays. Single-select's
       *  REPLACE is "clear, then append one" — see addValue(). */
      const clearChips = (): void => {
        chipList?.replaceChildren();
        chipButtons.length = 0;
        chipValues.length = 0;
        chipLabels.length = 0;
      };

      /** Render one chip. `label` is display-only; `value` is the id (D1).
       *  `type` is D6's polymorphic tag — see the dataset write below. */
      const appendChip = (value: string, label: string, type?: string): void => {
        if (chipList == null) return;
        const i = chipValues.length;
        const li = document.createElement("li");
        li.className = "vms-field__chip";
        // §7 item 24 — role="listitem" EXPLICITLY. `list-style: none` strips the
        // implicit list/listitem roles in Safari/VoiceOver, so a styled <ul>
        // silently stops being a list exactly where it matters most.
        li.setAttribute("role", "listitem");
        // D6 — the polymorphic type tag rides ALONGSIDE the display and never
        // leaks into the bound value: `bind` holds the id and nothing else. An id
        // alone is not an identity (a Dataverse owner GUID "doesn't tell you
        // whether the owner of the record is a user or a team"), so a polymorphic
        // reference exposes what KIND of thing it names.
        //
        // 🚨 It hangs on the CHIP, which is where the selection now IS (D2a). It
        // used to hang on the INPUT as `data-vms-selected-type`, single-select
        // only — correct when the input WAS the selection, stale the moment the
        // selection moved out, and it would have left a type tag on a box that
        // holds nothing but the query. Chipping it also gives MULTI the exposure
        // it never had (each chip tags its own reference, which is the only shape
        // that can work for a mixed user/team set).
        if (type != null) li.dataset.vmsType = type;

        const text = document.createElement("span");
        text.className = "vms-field__chip-label";
        // textContent, never innerHTML — a server-supplied label is text, not
        // markup (the house idiom throughout this file).
        text.textContent = label;
        li.appendChild(text);

        const btn = document.createElement("button");
        // MANDATORY: a chip inside a FormNode would otherwise SUBMIT it on every
        // remove click — <button>'s default type is "submit".
        btn.type = "button";
        btn.className = "vms-field__chip-remove";
        // Index-keyed, matching the popup options' id scheme and for the same
        // reason: `selected` is the server's array and is not guaranteed deduped,
        // so a value-derived id could collide — and a value may contain spaces
        // (a free-form tag), which an id may not. render()'s generic focus
        // restore re-finds this button by id after a re-render.
        btn.id = `vms-${n.name}-chip-${i}-remove`;
        // 🚨 §7 item 25 — A UNIQUE, ITEM-SPECIFIC ACCESSIBLE NAME. NOT "Remove",
        // NOT "x", NOT an unlabelled icon. THIS EXACT FAILURE IS WHAT KILLED THE
        // GOV.UK MULTISELECT: their review found it "does not announce ... the
        // presence of the 'Remove' button for screenreaders", and a row of
        // identically-named buttons is unusable — the user hears "Remove button,
        // Remove button, Remove button" and cannot tell which is which. Per D5 an
        // item whose label is omitted names itself by its value, so this is never
        // unnamed. setAttribute takes an attribute VALUE — never parsed as
        // markup — so a hostile server label cannot inject here.
        btn.setAttribute("aria-label", `Remove ${label}`);
        // Decorative: the accessible name above is the real one.
        btn.textContent = "×";
        btn.setAttribute("aria-hidden", "false");
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          // stopPropagation for the same reason the table's row-action does it:
          // a chip row may live inside a clickable ancestor.
          e.stopPropagation();
          removeChipAt(chipButtons.indexOf(btn));
        });
        btn.addEventListener("keydown", (e) => {
          const lastChip = chipButtons.length - 1;
          const at = chipButtons.indexOf(btn);
          if (e.key === "ArrowRight") {
            e.preventDefault();
            // §7 item 26 — traverse. Clamped, NOT wrapped: the popup listbox
            // wraps (§7 item 16) because it is a closed loop the user is
            // cycling; a chip row is a line the user is walking, and wrapping
            // from the last chip back to the first silently moves focus across
            // the whole widget.
            const to = Math.min(at + 1, lastChip);
            chipButtons[to]?.focus();
            setRoving(to);
            return;
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            const to = Math.max(at - 1, 0);
            chipButtons[to]?.focus();
            setRoving(to);
            return;
          }
        });
        li.appendChild(btn);

        chipList.appendChild(li);
        chipButtons.push(btn);
        chipValues.push(value);
        chipLabels.push(label);
      };

      /**
       * Commit `value` into the selection. The ONE path both a picked candidate
       * and an invented (allowCustom) value take (see commitCustom()) — and, since
       * D2a, the ONE path BOTH MODES take.
       *
       * 🚨 THIS FUNCTION IS THE ONLY PLACE `lookup` AND `lookup-multiple` BEHAVE
       * DIFFERENTLY, AND THE DIFFERENCE IS ARITY AND NOTHING ELSE:
       *
       *     single REPLACES  ·  multi APPENDS
       *
       * Everything else about the two — the chip markup, the a11y contract, the
       * focus rules, the input holding nothing but the query — is identical by
       * construction, because it is literally the same code. If you find yourself
       * adding a second `isMulti` branch somewhere else in this arm, check first
       * whether it belongs here instead.
       */
      const addValue = (value: string, label: string, type?: string): void => {
        if (!isMulti) {
          // 🚨 REPLACE (D2a). The operator's words: "instead of adding a pill like
          // with tags, it replaces." There is never a second chip, which is also
          // what makes replace-on-pick self-evident in use — the mitigation for
          // the one risk D2a records ("a chip on a single-select could imply you
          // can add more").
          //
          // The id — and ONLY the id — is what persists (D1), and for `lookup`
          // that id is a bare `string`, never an array — see removeChipAt() for
          // why the two shapes are not interchangeable.
          this.writeBind(n.bind, value);
          // Optimistic, and the SERVER'S NEXT RENDER IS AUTHORITATIVE — the chip
          // render path reads `n.selected` and only `n.selected`. Rebuilt rather
          // than mutated in place so the chip's stable index-keyed id, its
          // roving tabindex and its aria-label are all produced by the one
          // appendChip() path instead of a second, drifting update path.
          clearChips();
          appendChip(value, label, type);
          setRoving(0);
          announceAdd(label, 1);
          inp.value = "";
          this.writeBind(n.searchBind, "");
          setArmed(null);
          return;
        }

        const current = this.readBind(n.bind);
        const ids = Array.isArray(current) ? (current as unknown[]).map(String) : [];

        // 🚨 D12 SCOPE — deduping `bind` ON COMMIT is ALLOWED AND CORRECT, and is
        // NOT a D12 violation. A reader fresh off D12 WILL flag this line (the
        // phase planner did, which is why the decision now spells the scope out
        // and why this comment exists).
        //
        //   D12 forbids second-guessing the SERVER'S ANSWER: the renderer may not
        //   reorder, filter, dedupe or truncate `candidates` FOR DISPLAY. That
        //   list is the app's judgment — a real consumer ranks it by
        //   recency-weighted mention frequency — and a renderer with an opinion
        //   about it would silently destroy that ranking.
        //
        //   THIS IS NOT THAT. This is a STATE WRITE about the user's OWN
        //   accumulated selection. A selection set has set semantics; a duplicate
        //   id in `bind` is meaningless in every case anyone has been able to
        //   construct, and mature libraries prevent it structurally
        //   (react-select's `hideSelectedOptions` defaults on for multi).
        //
        // Presentation vs. state write. Two different things.
        const already = ids.includes(value);
        const nextIds = already ? ids : [...ids, value];
        if (!already) {
          this.writeBind(n.bind, nextIds);
          // Optimistic, for the same reason removeChipAt() is — see there. The
          // label is the one the user JUST PICKED (or JUST TYPED), held in hand
          // at the moment of the act.
          //
          // 🚨 This is NOT the D1 trap, and the distinction is exact: the trap is
          // RESOLVING AN ALREADY-SELECTED ID'S LABEL BY SEARCHING `candidates` —
          // which fails precisely when it matters (a cold-start form load, or a
          // filtered list that excludes the selection) because there is nothing
          // to find. Nothing here searches: this label is the clicked item's own,
          // used once, immediately, and replaced by the server's authoritative
          // `selected` on the very next render. The chip RENDER path above reads
          // `n.selected` and only `n.selected`.
          appendChip(value, label, type);
          setRoving(roving);
        }
        // 🚨 §7 items 27 + 32 — announce WITH THE RUNNING COUNT (see
        // announceAdd(), which holds the rule and the reason). This is also the
        // ONLY thing that actually conveys the selection: aria-selected /
        // aria-multiselectable are "mostly not announced when true", and on
        // Safari/VoiceOver the ARIA path conveys NOTHING. Set the attributes
        // (correct, cheap, support improves); TELL the user here.
        //
        // A duplicate still announces, and the sentence stays true — the item IS
        // selected and the count IS accurate. Silence would just look broken.
        announceAdd(label, nextIds.length);
        inp.value = "";
        this.writeBind(n.searchBind, "");
        setArmed(null);
      };

      // 🚨 BOTH MODES (D2a) — this used to be gated on `isMulti`. Single-select's
      // selection is now a chip built by the SAME code, and the whole a11y
      // contract below comes with it for free precisely BECAUSE it is not a fork.
      {
        chipList = document.createElement("ul");
        chipList.className = "vms-field__chips";
        // §7 item 24 — role="list", NOT a listbox with option children. A chip
        // CONTAINS a remove button, and an interactive descendant inside
        // role="option" is invalid and DESTROYS the accessibility tree. Explicit
        // despite the <ul> for the Safari `list-style: none` bug (see appendChip).
        chipList.setAttribute("role", "list");
        // §7 item 28 — the group needs an accessible name or it cannot be found.
        chipList.setAttribute("aria-label", "Selected items");

        // 🚨 THE DISPLAY PATH (D1) — chips are built from `n.selected`, and ONLY
        // from `n.selected`. `candidates` feeds the popup listbox and NOTHING
        // else. Mid-search the candidate list routinely EXCLUDES what is already
        // chosen, so a chip labelled out of `candidates` renders a raw database
        // id or vanishes on the case that matters most. Per D5 an item whose
        // label is omitted displays its value.
        //
        // 🚨 `selected` IS ALWAYS AN ARRAY, INCLUDING FOR SINGLE-SELECT, where it
        // holds 0 or 1 entries — that is the wire shape (§4), chosen so a `T |
        // T[]` union could not drift across the two backends. Which means this
        // one line renders BOTH modes with no arity branch: single is simply the
        // array that is never longer than one. Nothing clamps it here on purpose
        // — `selected` is the SERVER'S answer, and if a server ever sent two
        // entries for a `lookup`, silently hiding one would be this renderer
        // second-guessing it (D12's instinct, if not its letter). Two chips on a
        // single-select is a server bug, and it should look like one.
        selectedItems.forEach(item => appendChip(item.value, item.label ?? item.value, item.type));

        // Restore the DOM-local chip facts the wipe destroyed. Clamped, because
        // the server may have returned fewer chips than the last render had.
        setRoving(snapshot?.roving ?? 0);
        // Only re-arm if the LAST chip is still the SAME ITEM — see the snapshot
        // declaration for why this is keyed by value and not by a boolean.
        // Single never arms (the two-step Backspace is multi-only, D14), so this
        // is structurally a no-op there rather than a branch.
        const armedValue = snapshot?.armed;
        if (armedValue != null && chipValues[chipValues.length - 1] === armedValue) {
          setArmed(armedValue);
        } else {
          setArmed(null);
        }
      }

      const setActive = (i: number): void => {
        activeIndex = i;
        // §7 item 32 — keep aria-selected accurate on EVERY option (true AND
        // false), while treating it as NON-COMMUNICATING: it is "mostly not
        // announced when true", so the live region (Plan 21-04) is what
        // actually tells an AT user what is highlighted. Set it anyway: it is
        // correct, it is cheap, and support improves.
        optionEls.forEach((el, j) => el.setAttribute("aria-selected", String(j === i)));
        const activeEl = i >= 0 ? optionEls[i] : undefined;
        // §7 item 2 — present ONLY while an option is active; removed otherwise.
        if (activeEl) inp.setAttribute("aria-activedescendant", activeEl.id);
        else inp.removeAttribute("aria-activedescendant");
        // §7 items 11 + 32 — the highlight is ALSO spoken. The ARIA above is set
        // because it is correct and cheap, but it is NOT the delivery mechanism:
        // aria-selected is "mostly not announced when true", and on
        // Safari/VoiceOver the ARIA path conveys nothing at all. Every fact the
        // ARIA encodes must also reach the user as live-region TEXT.
        if (activeEl) {
          announce(`${activeEl.textContent} ${i + 1} of ${optionEls.length} is highlighted`);
        }
      };
      const setOpen = (v: boolean): void => {
        open = v;
        popup.hidden = !v;
        inp.setAttribute("aria-expanded", String(v));
        // Closing the popup ends the search session: the user has committed,
        // escaped, or tabbed away. Anything they hear after that is noise about
        // a question they stopped asking.
        if (!v) { setActive(-1); setQuerying(false); }
      };

      // ══ THE 21-13 PILL-INPUT TREATMENT IS GONE — DO NOT BRING IT BACK ══════
      //
      // 21-13 styled THE INPUT ITSELF as a pill when a record was selected (the
      // SLDS shape: for single-select no separate pill element exists at all),
      // plus an inline clear ✕ overlaid on the input's right edge. Both are
      // DELETED, along with the `labelShown` flag that drove them and the
      // `.vms-field--lookup-selected` CSS.
      //
      // 🚨 WHY, so nobody restores it as "the missing polish": the operator drove
      // it and found it had NOWHERE TO CLICK TO TYPE. The pill WAS the input, so
      // clicking into it just appended to "Sally Omer". SLDS's model is coherent
      // GIVEN clear-then-search; the operator demonstrated clear-then-search has
      // no click target. Ours is coherent given always-typeable. That divergence
      // from the survey is deliberate and recorded at D2a §"The honest divergence
      // from the survey" — do not "correct" us back toward SLDS on the strength
      // of the citation in the design doc's §2.
      //
      // The clear ✕ went with it because THE CHIP'S OWN ✕ now does that job, in
      // both modes, from one implementation — a second, differently-shaped clear
      // affordance beside a chip that already has one would be exactly the
      // parallel-path drift D2a's "reuse the chip" rule exists to prevent.
      //
      // And `labelShown` went with BOTH because the question it answered ("is the
      // box showing a label or a query?") NO LONGER EXISTS. See the display path
      // above: `inp.value` is the query, unconditionally.

      // ── POPUP-OPEN PRESERVATION (Phase 21, LOOK-02) ──────────────────────
      //
      // 🚨 PRESERVE OPEN. DO NOT PRESERVE ACTIVE. The two lines below look like
      // they are missing a third; they are not.
      //
      // Why open is preserved: this arm's popup state is DOM-local, so it dies
      // in render()'s innerHTML wipe — and the search itself CAUSES a re-render.
      // Without this, the results of the very search the user just asked for
      // would arrive with the popup slammed shut. (Enter-to-search makes this
      // one re-render per question rather than one every ~300ms, but it does not
      // make it go away: the answer still lands on a rebuilt tree.)
      //
      // Why active is NOT preserved: `activeIndex` starts at -1 on every render,
      // and that is HALF OF §7 item 14 — we never auto-highlight when results
      // arrive. Restoring the highlight here is the natural-looking completion
      // of this pass and it would resurrect the exact React Aria NVDA failure
      // item 14 exists to prevent: with an option auto-focused, "character
      // deletions and text cursor movement in the ComboBox input weren't being
      // announced at all". Restoring open costs nothing; restoring active
      // silently breaks the announcement of the user's own typing.
      //
      // Restored HERE rather than in a post-render DOM walk (the [data-section-key]
      // details pattern) because `open` is a CLOSURE variable: setting
      // popup.hidden from outside would leave the closure believing the popup is
      // closed, and Escape would then take its popup-already-closed branch and
      // CLEAR the user's selection — silent data loss on a keypress that meant
      // "get this out of my way". The closure and the DOM must never disagree.
      //
      // An empty candidate set stays closed: there is nothing to show, matching
      // the input listener's own `optionEls.length > 0` gate below.
      //
      // `querying` opens it too, and that is NOT redundant with `open`: on the
      // FIRST search there are no prior options, so the input listener's own
      // `if (optionEls.length > 0) setOpen(true)` cannot fire and the popup was
      // never open to preserve. Without this, the results of the very first
      // search would arrive invisibly and the user would have to press ArrowDown
      // to discover the answer they just asked for. `querying` is now set by
      // search() — the Enter that ASKED — rather than by typing.
      if ((snapshot?.open === true || querying) && optionEls.length > 0) {
        setOpen(true);
      }

      // §7 item 11 — results arriving is a fact the user must be TOLD, not just
      // shown. Gated on `querying` so that a re-render for unrelated reasons (a
      // poll tick, another action) never narrates a candidate count out of
      // nowhere. One Enter, one announcement — no debounce, because there is no
      // longer a per-keystroke firehose to tame.
      if (querying) {
        announce(optionEls.length > 0
          ? `${optionEls.length} results are available.`
          : "No search results");
      }

      /** Accept the candidate at `i` — the ONLY path that writes the bind.
       *
       *  🚨 ONE PATH FOR BOTH MODES (D2a). This used to fork: multi called
       *  addValue(), single hand-wrote its own bind write + `inp.value = label` +
       *  query clear + pill flag, and that duplicated commit path is precisely
       *  where the "leaving a stale query behind redraws the box as 'sal'" bug
       *  lived. The arity difference lives in addValue() and NOWHERE ELSE. */
      const commit = (i: number): void => {
        const c = (n.candidates ?? [])[i];
        if (c == null) return;
        // Per D5 an omitted label means the label IS the value.
        addValue(c.value, c.label ?? c.value, c.type);
        if (isMulti) {
          // §7 item 30 — do NOT close the popup on select in a multi-select;
          // the user is usually picking several.
          setActive(-1);
        } else {
          // Single is done: the question was "which one?", it has been answered,
          // and the list has nothing left to offer.
          setOpen(false);
        }
        inp.focus();
      };

      /**
       * D3 (LOOK-04) — commit an INVENTED value: one the server never offered.
       *
       * 🚨 GATED ON THE DECLARED `allowCustom` AXIS, NEVER INFERRED FROM
       * BEHAVIOR. The rationale is the whole decision: "choosing somebody to
       * mention is very different from inventing a new tag." Those are different
       * ACTS sharing one widget, so the control DECLARES which it is doing
       * rather than leaving it to be guessed from what the user happened to
       * type. Omitted/false ⇒ a typed non-candidate commits NOTHING.
       *
       * 🚨 An invented value is a HOMOGENEOUS LookupItem — a value whose label
       * equals itself (and is therefore omitted, D5) — and NEVER a bare string.
       * That is the entire reason one control can serve both acts. MUI's
       * `multiple + freeSolo` yields `Array<Value | string>`: a heterogeneous
       * union that forces EVERY consumer to branch on `typeof`, and whose own
       * docs warn it "may cause type mismatch". Their tags demo dodges it only by
       * degrading options to bare strings. We never admit a bare string, so the
       * union cannot arise: `bind` stays uniformly string[] of ids whether the
       * entries were picked or invented.
       *
       * ⇒ `allowCustom: true` + NO candidates + labels omitted IS a free-form
       * tags input, with NO SPECIAL CASE ANYWHERE IN THIS RENDERER — this
       * function is the same one the picked path uses. That composition is why
       * the separately-designed `inputType: "tags"` proposal was superseded
       * rather than built.
       *
       * 🚨 NO PROVENANCE MARKER, DELIBERATELY. Do not add react-select's
       * `__isNew__`, and do not add a distinct `create-option` action. The next
       * person WILL reach for them — react-select is the obvious precedent —
       * so: react-select needs a marker because it is CLIENT-ONLY and has no
       * server to ask. We have a server, and it produced every candidate it ever
       * offered, so "is this id one of mine?" is server-decidable and picked-vs-
       * invented needs no wire field (OPEN-3). The explicitness D3 demands is
       * carried by `allowCustom` being a DECLARED AXIS ON THE NODE — the app
       * declares the act — not by a per-value flag.
       */
      const commitCustom = (raw: string): void => {
        // Trim on the commit path (carried over from the superseded `tags`
        // research per D3): a trailing space is a slip, not a distinct tag.
        const value = raw.trim();
        if (value === "") return;
        // An invented value is a value whose label equals itself (D5), and it
        // takes the SAME commit path as a picked one — including D2a's arity
        // split, so a single-select tags field replaces its one tag rather than
        // accumulating. Dedupe lives in addValue() — see the D12 SCOPE note there.
        addValue(value, value);
        if (isMulti) setActive(-1);
        else setOpen(false);
        inp.focus();
      };

      optionEls.forEach((opt, i) => {
        // mousedown (not click) + preventDefault: keeps DOM focus in the input
        // instead of letting the press blur it, which is the same reason the
        // active option is tracked with aria-activedescendant at all.
        opt.addEventListener("mousedown", (e) => {
          e.preventDefault();
          commit(i);
        });
      });

      // ── THE SEARCH (Phase 21, 21-11 / D4 / D11 — BOTH REVERSED) ───────────
      //
      // 🚨 `searchAction` IS AN ORDINARY, BLOCKING ACTION FIRED ON ENTER. It is
      // byte-for-byte the same cadence as table filter actions
      // (table(), below: keystrokes write the bind; ENTER dispatches) and the one
      // the text arm uses. There is NO debounce timer, NO live-query lane, and
      // NOTHING here touches `blocking`.
      //
      // It did not start that way. The first cut of this control searched on a
      // ~300ms type-as-you-go debounce and FORCED `blocking: false`, and the
      // operator drove it on the tailnet and reversed both. The reasons are
      // recorded here because every deleted mechanism will look like a missing
      // feature to the next reader:
      //
      // 1. WHY BLOCKING IS A CORRECTNESS WIN, not a UX preference. A blocking
      //    action is SERIALIZED BY THE EXISTING DISPATCH GUARD — a second action
      //    cannot dispatch while a round trip is in flight, and has not been able
      //    to since long before this control existed. So the entire stale-response
      //    race category is not MITIGATED here; it is STRUCTURALLY IMPOSSIBLE.
      //    That is stronger than any test suite, and it is why the four
      //    adversarial race tests that used to guard this file are GONE rather
      //    than ported: they rigorously proved properties of a mechanism we no
      //    longer use. Rigor inside the wrong frame is not rigor.
      //
      // 2. WHY THE RENDERER MUST NEVER SET `blocking` (the framework rule, which
      //    outlives this control — see AGENTS.md):
      //
      //      NON-BLOCKING IS ALWAYS THE APP'S EXPLICIT, OPT-IN CHOICE. The
      //      framework never forces, infers, or upgrades a dispatch onto the
      //      non-blocking lane.
      //
      //    `blocking: false` is SEMANTIC: it means this response may be
      //    discarded, may arrive out of order, and may coexist with another in
      //    flight. An app that did not ask for those semantics can have its logic
      //    broken by them, silently. That is not the framework's call to make.
      //    The old argument for forcing it here was circular — it forced the lane
      //    because an app that forgot the flag would busy-lock the page on every
      //    keystroke, but that failure only existed because typing triggered round
      //    trips in the first place. The feature invented the problem, then took a
      //    power away from the app to paper over it.
      //
      //    ⇒ The spread below is `on(searchAction)` — the app's ActionEvent,
      //    UNTOUCHED. If you find yourself wanting to force the lane here, STOP:
      //    that urge is the exact smell the rule names, and it means the shape is
      //    wrong, not the rule.
      //
      // 3. WHAT DIED WITH THE CADENCE, so nobody "restores" it piecemeal: the
      //    300ms query debounce and its adapter-keyed timer map; the ~1400ms
      //    announcement debounce (a firehose tamer with no firehose left); the
      //    popup slamming shut mid-typing; the chips dying mid-interaction; and
      //    the results jumping under the operator's cursor as she reached to click
      //    a name. EVERY ONE of those existed to serve type-as-you-go.
      const search = (): void => {
        const searchAction = n.searchAction;
        if (searchAction == null) return;
        // Belt-and-suspenders, exactly as the text arm's Enter handler and the
        // table filter's do: flush the box to state BEFORE dispatching, in case
        // the browser has not fired `input` yet (an autofill or IME commit that
        // lands then submits). The dispatched `_state` must be what the box
        // actually says.
        //
        // 🚨 DISPATCHED UNCONDITIONALLY — never gated on a non-empty value. AN
        // EMPTY QUERY IS A LEGITIMATE QUERY (OPEN-6): it is how an app serves a
        // most-recently-used list on an empty box (Salesforce's picker
        // `searchType` DEFAULTS to `Recent`; Dynamics shows 5 MRU + 5 favourites).
        // An `if (inp.value)` gate here voids the MRU decision silently. This is
        // the DISPATCH question — it keys on the query being non-null, NOT
        // non-empty. The DISPLAY question is the other one, and it is answered
        // ~200 lines above; conflating the two is what shipped the
        // placeholder-instead-of-label bug.
        //
        // 🚨 THE BOX IS THE QUERY. FLUSH IT. NO CONDITION (D2a).
        //
        // This line used to read `labelShown ? "" : inp.value` — it had to know
        // whether the box was holding the server's label or the user's query,
        // because in single-select it could be either, and flushing a label would
        // have sent "Sally Omer" as the search term for a field whose owner
        // already IS Sally Omer. With the selection in a chip, the box can only
        // ever hold a query, so there is nothing to ask and nothing to get wrong.
        // Enter on an untouched box sends "" — the MRU question it looks like it
        // is asking (OPEN-6) — because the box is genuinely empty, not because a
        // flag said to pretend it was.
        this.writeBind(n.searchBind, inp.value);
        // "The user just asked a question": lets the answer open the popup (a
        // first search has no prior options, so the input listener's own open
        // cannot fire) and gates the result announcement, so an unrelated
        // re-render never narrates a candidate count out of nowhere.
        setQuerying(true);
        // §7 item 11 — announce LOADING. An async combobox that is silent during
        // the fetch leaves AT users unable to tell a slow server from a dead one.
        announce("Loading results");
        on(searchAction);
      };

      inp.addEventListener("input", () => {
        // 🚨 Written UNCONDITIONALLY — NEVER gated on a non-empty value; see
        // search() above for why (OPEN-6 / the MRU decision). Keystrokes WRITE
        // the bind and dispatch NOTHING: this is the table filter's cadence
        // exactly.
        //
        // 🚨 There is no `setLabelShown(false)` here any more and NOTHING is
        // missing (D2a). The box was never showing a label, so typing cannot
        // change what it means: it is the query before the keystroke and the
        // query after it. The whole "typing drops the pill" dance existed only
        // because the input did double duty.
        this.writeBind(n.searchBind, inp.value);
        // 🚨 §7 items 14 + 21 — clear the active option whenever the query text
        // changes, and never let list-typeahead swallow typing. Typing is the
        // user's; the list does not get to eat it.
        setActive(-1);
        // §7 item 31 — typing DISARMS the two-step Backspace. This is what
        // BOUNDS the armed window: an arm can never survive across an unrelated
        // edit and turn a later Backspace into a delete of something the user
        // was told about minutes ago.
        setArmed(null);
        // 🚨 TYPING DOES NOT OPEN THE POPUP. THIS IS NOT A MISSING LINE (21-13).
        //
        // It used to: `if (optionEls.length > 0) setOpen(true)` lived here, a
        // leftover from the type-as-you-go model D4 reversed. Under Enter-to-
        // search it is actively WRONG, and the operator named the harm exactly:
        //
        //   "it shouldn't pop up the box before I hit enter, because otherwise
        //    it's just kind of throwing random possibilities at me."
        //
        // She is describing the popup volunteering the PREVIOUS query's answers
        // (or a server-supplied MRU list) against text she is still typing —
        // candidates she never asked for, presented as though she had. Under a
        // typeahead the list tracked the keystrokes and that was the contract;
        // under Enter-to-search THE USER ASKS, and the answer arrives when they
        // ask. A popup that opens on its own is guessing.
        //
        // ⇒ THE POPUP OPENS ON EXACTLY TWO EVENTS, AND NEITHER IS TYPING:
        //   1. RESULTS ARRIVE from a search the user ran (the `querying` branch
        //      of the open-preservation block ~200 lines above — Enter → dispatch
        //      → the response's candidates render → open).
        //   2. Down / Alt+Down / Up on a CLOSED popup that HAS candidates (§7
        //      item 15, in the keydown handler below) — an EXPLICIT request for
        //      the list, which is the opposite of a guess.
        //
        // Focus does not open it either, and there is deliberately no focus
        // listener in this arm — same reason.
        //
        // Options already on screen are the previous query's answer: if the
        // popup is ALREADY open the user asked for them, so they stay visible
        // and pickable (nothing here closes it). This is NOT a new search
        // session either way, so `querying` is left alone: only search() sets it.
        // §7 item 13 — the assistive hint has done its job the moment the user
        // starts typing; from here on it would be a per-keystroke tax read out
        // on every visit to the field.
        live.hintShown = true;
        hintEl?.remove();
      });

      // ── CLICK-OUTSIDE CLOSES THE POPUP (21-11) ────────────────────────────
      //
      // The APG does NOT specify this, which is exactly why §7 missed it and why
      // the operator found it by hand: every real combobox has it, and a popup
      // that only Escape can dismiss feels broken to a mouse user who has simply
      // moved on.
      //
      // 🚨 IT CLOSES. IT DOES NOT CLEAR — not the selection, not the query.
      // setOpen(false) drops the highlight and ends the search session and
      // touches NOTHING ELSE. Escape is the only thing that clears (see its
      // handler); silently discarding a reference because the user clicked
      // elsewhere would be exactly the unannounced data loss that stage one of
      // Escape's two-stage rule exists to prevent.
      //
      // `mousedown`, not `click`, and `wrapper.contains()` as the test — both
      // load-bearing for picking a candidate:
      //   • An option commits on MOUSEDOWN (it preventDefaults to keep DOM focus
      //     in the input). A `click`-based close would fire on the same press;
      //     mousedown ordering plus the containment test keeps the two apart.
      //   • The option, the chips and their remove buttons all live INSIDE the
      //     wrapper, so every in-widget press is excluded by containment rather
      //     than by a pile of per-element special cases.
      // Registered on `document` (an outside click is by definition not on our
      // subtree) and swept per-render — see lookupOutsideHandlers.
      const onOutsideMouseDown = (e: Event): void => {
        if (!open) return;
        const target = e.target as Node | null;
        if (target != null && wrapper.contains(target)) return;
        setOpen(false);
      };
      document.addEventListener("mousedown", onOutsideMouseDown);
      this.lookupOutsideHandlers.push(onOutsideMouseDown);

      inp.addEventListener("keydown", (e) => {
        const last = optionEls.length - 1;

        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (!open) {
            setOpen(true);
            // §7 item 15 — Alt+Down opens WITHOUT moving focus into the list.
            if (!e.altKey && optionEls.length > 0) setActive(0);
          } else if (optionEls.length > 0) {
            // §7 item 16 — wrap: last → first.
            setActive(activeIndex >= last ? 0 : activeIndex + 1);
          }
          return;
        }

        if (e.key === "ArrowUp") {
          e.preventDefault();
          if (!open) {
            // §7 item 15 — Up opens and focuses the LAST option.
            setOpen(true);
            if (optionEls.length > 0) setActive(last);
          } else if (optionEls.length > 0) {
            // §7 item 16 — wrap: first → last.
            setActive(activeIndex <= 0 ? last : activeIndex - 1);
          }
          return;
        }

        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          // §7 item 16 — Left/Right RETURN TO THE INPUT TEXT and move the
          // caret: they EXIT the list, they do NOT navigate it. Deliberately
          // NOT preventDefault'd — the browser's own caret movement is the
          // entire point, and the APG's own warning is to "avoid JavaScript
          // interference with browser-provided editing functions". We only drop
          // the highlight.
          setActive(-1);
          return;
        }

        if (e.key === "Home" || e.key === "End") {
          // 🚨 §7 item 16 — Home/End are TEXT-EDITING keys here (caret to
          // start/end of the text), NOT first/last-option. This is an EDITABLE
          // combobox: the caret wins. Wiring these to the list is the single
          // most likely well-meaning break in this handler — a combobox with a
          // listbox popup is not a listbox, and the user is typing in it.
          // So: no preventDefault, and no active-option change. The browser
          // edits, we stay out of the way. This early return exists ONLY to say
          // so; deleting it changes nothing today and invites the "fix"
          // tomorrow.
          return;
        }

        if (e.key === "Enter") {
          if (open && activeIndex >= 0) {
            // §7 item 17 — accept, set the input value, close, keep focus in
            // the input (all of which commit() does).
            e.preventDefault();
            commit(activeIndex);
            return;
          }
          // ── ENTER'S PRECEDENCE (21-12, D15) ─────────────────────────────
          //
          // ⚠️ Enter carries a dispatch because of the D4 reversal, and the
          // table filter this copies has exactly ONE Enter act. D15 restores
          // that precondition rather than out-clevering it: `allowCustom` +
          // `searchAction` together is UNSUPPORTED and fails loud at render
          // (see [vms:lookup-ambiguous-enter] above). With that combo excluded,
          // NO TWO ARMS BELOW CAN BOTH APPLY — the order is a formality, not a
          // tie-break, and Enter means exactly one thing in every SUPPORTED
          // shape:
          //
          //   1. an active option → commit it     (§7 item 17; either shape)
          //   2. searchAction     → ask the server (D4 — a directory picker)
          //   3. allowCustom      → invent it      (D3 — a tags field)
          //   4. action           → the field's own act
          //
          // 🚩 2 BEFORE 3 IS THE DEGRADE PATH, NOT A PRECEDENCE. It only ever
          // fires for the unsupported combo, where it makes the field read as
          // the directory picker the warning names. Do NOT reintroduce a
          // heuristic that guesses the act from what the user typed — D3's whole
          // point is that the act is DECLARED, never inferred. The deferred
          // answer is already known (react-select's synthetic "Create 'urgent'"
          // candidate, so Enter always means "accept the active option"); see
          // D15 before building it.
          //
          // 🚨 THE SEARCH. Fires with NO option active — including on an EMPTY
          // box, which is the MRU path (OPEN-6). See search().
          if (n.searchAction) {
            e.preventDefault();
            search();
            return;
          }
          if (n.allowCustom === true && inp.value.trim() !== "") {
            e.preventDefault();
            commitCustom(inp.value);
            return;
          }
          // No option active, nothing to search, nothing to invent: fall through
          // to the field's own `action`.
          //
          // ⚠️ KNOWN, DELIBERATE LIMITATION (21-12) — `action` IS UNREACHABLE ON
          // A LOOKUP THAT DECLARES `searchAction`, and that is correct, not a
          // bug. Enter is this control's ONLY dispatch key, `searchAction` owns
          // it, and there is no second Enter to hand `action`. This is NOT the
          // D15 ambiguity (two acts fighting over one key); it is one act
          // OCCUPYING the key, which is what declaring a search means. Fixing it
          // would require inventing a second submit gesture — a new key binding
          // no APG pattern sanctions — so the honest answer is: on a searching
          // lookup, put the submit on a ButtonNode. Documented on the node's
          // TSDoc; do NOT "fix" it by re-ordering the arms above.
          if (n.action) {
            e.preventDefault();
            this.writeBind(n.searchBind, inp.value);
            on(n.action);
          }
          return;
        }

        if (e.key === "Escape") {
          if (open) {
            // 🚨 §7 item 18 — Escape is TWO-STAGE, and THIS stage is the
            // load-bearing half: with the popup OPEN it closes and KEEPS the
            // value. ESCAPE MUST NEVER CLEAR WHILE THE POPUP IS OPEN. The user
            // is dismissing the popup, not discarding their selection;
            // conflating the two silently destroys data on a keypress that
            // meant "get this out of my way".
            e.preventDefault();
            setOpen(false);
            return;
          }
          // Stage two — the popup is ALREADY CLOSED. The design leaves clearing
          // OPTIONAL ("optionally clear"), and what it clears is THE QUERY TEXT,
          // in BOTH modes.
          //
          // 🚨 IT NO LONGER CLEARS SINGLE-SELECT'S SELECTION, AND THAT IS D2a
          // FOLLOWED THROUGH RATHER THAN A DROPPED FEATURE. Escape used to clear
          // the bind on single, for a reason written down at the time: "this is
          // the ONLY keyboard path to un-set a single-select lookup — deleting
          // the input text does NOT clear the selection, because the text is the
          // LABEL, a view of the id in `bind`." BOTH HALVES OF THAT PREMISE ARE
          // NOW FALSE. The text is not the label (it is the query, always), and
          // Escape is not the only keyboard path: single's selection is a chip
          // whose remove ✕ is a real, focusable <button> in the tab sequence with
          // an item-specific accessible name — the same path multi has always
          // had, and a far more discoverable one than "hunt for Escape".
          //
          // Keeping the old behavior would also have required clearing the bind
          // here AND tearing the chip out of the DOM by hand — a second removal
          // path beside removeChipAt(), which is exactly the fork D2a forbids.
          // So the two modes now agree: Escape gets the popup and the query out
          // of your way; the chip's ✕ removes the selection.
          e.preventDefault();
          inp.value = "";
          this.writeBind(n.searchBind, "");
          setActive(-1);
          return;
        }

        if (e.key === "Tab") {
          // 🚨 §7 item 19 / OPEN-2 — Tab CLOSES the popup and does NOT SELECT.
          // It abandons the active option; the field keeps whatever value it
          // already had.
          //
          // ⚠️ APG IS SILENT here — its table only specifies where Tab GOES,
          // never what it does to the active option — so this is our call, and
          // it is a RECORDED DECISION rather than an accident. The next person
          // WILL be asked "why doesn't Tab accept like my IDE?", so the answer
          // lives here:
          //
          // Tab is a NAVIGATION key, and a navigation key must never silently
          // commit a value. The failure modes are ASYMMETRIC. Tab-abandons
          // costs a user who wanted IDE/URL-bar accept semantics ONE EXTRA
          // KEYSTROKE (press Enter, then Tab) — and they SEE that nothing was
          // selected. Tab-accepts silently writes a WRONG REFERENCE into a
          // record when someone tabs past a field mid-typing, and an accidental
          // commit is UNANNOUNCED DATA CORRUPTION — invisible to sighted users
          // and doubly invisible to AT users. It also matches Escape's
          // keep-the-value semantics above, so the two "get me out of here"
          // keys behave consistently rather than one committing and one not.
          // This will generate complaints; that is accepted.
          //
          // NOT preventDefault'd — focus must actually move on.
          setOpen(false);
          return;
        }

        // ── §7 item 31 — THE TWO-STEP, NON-DESTRUCTIVE BACKSPACE ────────────
        //
        // 🚨 NO AUTHORITY ADDRESSES THIS. It is our convention, and it is a
        // RECORDED DECISION rather than an accident, because the obvious
        // implementation — one Backspace, chip gone — is what every other
        // library does and what the next person will "restore".
        //
        // Why two steps: a single-press delete is DESTRUCTIVE, INVISIBLE TO AT,
        // and TRIVIALLY MIS-TRIGGERED. The trigger is Backspace on an empty
        // input — which is exactly the keystroke of someone who has just cleared
        // a typo and is still deleting. One press too many and a reference they
        // chose is silently gone, with no announcement and nothing on screen to
        // notice. The two-step makes the first press SAY what is about to
        // happen. It costs mouse users nothing (they have a remove button) and
        // costs keyboard users one keystroke.
        //
        // §7 item 22 — Backspace/Delete are PLAIN TEXT EDITING everywhere else
        // and are never intercepted: this arm is gated on isMulti AND an EMPTY
        // input, so it can never eat a real edit.
        if (isMulti && inp.value === "" && (e.key === "Backspace" || e.key === "Delete")) {
          if (chipButtons.length === 0) return;
          const lastIdx = chipButtons.length - 1;
          if (armed != null) {
            // Step two — confirmed. Either key confirms, because the
            // announcement promises both ("press Backspace or Delete").
            e.preventDefault();
            removeChipAt(chipValues.indexOf(armed));
            return;
          }
          // Step one — Backspace ARMS. Delete does not: the design specifies
          // Backspace-on-empty as the entry point, and a bare Delete on an empty
          // input is not a "remove the last chip" gesture anyone has asked for.
          if (e.key === "Backspace") {
            e.preventDefault();
            setArmed(chipValues[lastIdx]);
            // 🚨 The highlight is a VISUAL fact, so it is ALSO spoken (§7 item
            // 32). An arm that only added a CSS class would leave an AT user
            // pressing Backspace, hearing nothing, pressing again, and deleting
            // something they were never told about — the two-step would become a
            // single-press delete FOR EXACTLY THE USERS IT EXISTS TO PROTECT.
            announce(`${chipLabels[lastIdx]}, press Backspace or Delete to remove`);
          }
          return;
        }
        // Any other key is the user moving on — disarm, so a stale arm can never
        // turn a later stray Backspace into a delete. (Typing disarms via the
        // input listener; this covers navigation keys that fire no input event.)
        if (armed != null && e.key !== "Backspace" && e.key !== "Delete") setArmed(null);

        // §7 item 20 — PageUp/PageDown are NOT part of the listbox-popup
        // contract. Do not invent them; they fall through untouched.
      });

      // The chip group sits OUTSIDE the combobox, BEFORE the input — in BOTH
      // modes now (D2a). Outside is not cosmetic: a listbox popup owning
      // interactive chips would be the §7 item 24 violation. Before the input is
      // what gives the user somewhere to type — the failure that produced D2a was
      // a control whose selection occupied the only place there was to click.
      //
      // (SLDS renders single's selection INSIDE the input and ships no pill
      // element for single at all. We diverge deliberately; see the deleted-pill
      // note above and D2a.)
      if (chipList) wrapper.appendChild(chipList);
      wrapper.appendChild(inp);
      wrapper.appendChild(popup);
      if (hintEl) wrapper.appendChild(hintEl);
      // 🚨 RE-APPEND, never rebuild. These two nodes were detached by render()'s
      // innerHTML wipe, NOT destroyed — the same move the chart makes with its
      // canvas. Creating fresh ones here would look identical in the DOM and
      // announce nothing, forever.
      wrapper.appendChild(live.a);
      wrapper.appendChild(live.b);
    } else if (n.inputType === "file") {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.className = "vms-field__input";
      inp.id = `vms-${n.name}`;
      inp.name = n.name;
      // Carry the declared upload routing to dispatch time — form()'s
      // dispatchWithFiles reads this and attaches the file only to an action
      // named here. Absent/empty => the file rides no action.
      inp.dataset.vmsUploadOn = JSON.stringify(n.uploadOn ?? []);
      // File-input persistence: re-apply any registered file to the new node.
      const existingFile = this.fileRegistry.get(n.name);
      if (existingFile) {
        try {
          const dt = new DataTransfer();
          dt.items.add(existingFile);
          inp.files = dt.files;
        } catch { /* nothing */ }
      }
      inp.addEventListener("change", () => {
        const file = inp.files?.[0];
        if (file) {
          this.fileRegistry.set(n.name, file);
          // [vms:orphan-file] — a picked file that declares no uploadOn action
          // will never be sent (the binary rides an action, and this input
          // names none). Silent under-attach is the dangerous failure, so warn.
          if (!n.uploadOn || n.uploadOn.length === 0) {
            this.warnOnce(
              "orphan-file:" + n.name,
              "[vms:orphan-file] file field '" + n.name + "' has a picked file but no uploadOn action — " +
                "its binary will not be sent; add uploadOn:[\"<action>\"] naming the action that should carry it.",
            );
          }
          // [vms:type-mismatch] — OBSERVABLE-SUBSET diagnostic. The client is
          // untyped JS: it CANNOT know a state slot's *declared* server type, so
          // it only catches the observable case where a file object overwrites a
          // slot that already holds a scalar. It does NOT catch an empty/null slot
          // typed string-map server-side — certain detection of that is a
          // server-side `_state` deserialize diagnostic (a separate follow-up).
          if (n.bind != null) {
            const existing = this.readBind(n.bind);
            if (existing != null && typeof existing !== "object") {
              this.warnOnce(
                "type-mismatch:" + n.name + ":" + n.bind,
                "[vms:type-mismatch] file FieldNode '" + n.name +
                  "' writes a {filename,size} object into bind '" + n.bind +
                  "', whose current state value is a " + (typeof existing) +
                  " — if that slot is typed string/string-map the _state round-trip will FAIL (cannot convert object to String). Give the file field an object-typed slot, or omit bind (the file rides multipart regardless).",
              );
            }
          }
          // Per Phase-6 decision: the picked file is visible in state as a
          // serialization-safe placeholder; the binary travels on the
          // multipart side channel. Backward-compat: apps binding a file field
          // to an object slot still get the placeholder. A bind-less file input
          // writes nothing (writeBind no-ops) — the binary rides multipart.
          this.writeBind(n.bind, { filename: file.name, size: file.size });
        } else {
          this.fileRegistry.delete(n.name);
          this.writeBind(n.bind, null);
        }
      });
      wrapper.appendChild(inp);
    } else if (n.inputType === "textarea") {
      const ta = document.createElement("textarea");
      ta.className = "vms-field__input";
      ta.id = `vms-${n.name}`;
      ta.name = n.name;
      if (n.placeholder) ta.placeholder = n.placeholder;
      ta.value = stateValue == null ? "" : String(stateValue);
      if (n.required) ta.required = true;
      ta.addEventListener("input", () => { this.writeBind(n.bind, ta.value); });
      wrapper.appendChild(ta);
    } else if (n.inputType === "radio") {
      // Radio group — the ≤5-option mutually-exclusive input. The outer wrapper's
      // <label> already emits with htmlFor pointing at vms-${name}; we give the
      // group that id (parallels the <select> case), so a click on the label is a
      // no-op (correct — the label labels the group, not a specific option), and
      // aria wiring via decorateField's aria-describedby still lands on the
      // group. Options render as <label> wrapping <input type="radio"> + <span>,
      // the checkbox-style label-follows-input arrangement browsers make focusable
      // by clicking anywhere in the label.
      const group = document.createElement("div");
      group.className = "vms-field__input vms-field--radio";
      group.setAttribute("role", "radiogroup");
      group.id = `vms-${n.name}`;
      const selectedValue: string = stateValue == null ? "" : String(stateValue);
      (n.options ?? []).forEach((opt) => {
        const optLabel = document.createElement("label");
        optLabel.className = "vms-field__radio-option";
        const inp = document.createElement("input");
        inp.type = "radio";
        inp.className = "vms-field__radio-input";
        inp.name = n.name;
        inp.value = opt.value;
        inp.checked = opt.value === selectedValue;
        inp.addEventListener("change", () => {
          if (inp.checked) this.writeBind(n.bind, opt.value);
        });
        const span = document.createElement("span");
        span.className = "vms-field__radio-label";
        span.textContent = opt.label;
        optLabel.appendChild(inp);
        optLabel.appendChild(span);
        group.appendChild(optLabel);
      });
      wrapper.appendChild(group);
    } else if (n.inputType === "code") {
      // Monospaced editable text. Tab inserts a literal tab instead of moving
      // focus. Apps wanting syntax highlighting attach their own library
      // (CodeMirror, Monaco) using the .vms-field--code-{language} class hook.
      wrapper.classList.add("vms-field--code");
      if (n.language) wrapper.classList.add(`vms-field--code-${n.language}`);
      const ta = document.createElement("textarea");
      ta.className = "vms-field__input vms-field__input--code";
      ta.id = `vms-${n.name}`;
      ta.name = n.name;
      ta.spellcheck = false;
      ta.autocapitalize = "off";
      ta.autocomplete = "off";
      ta.setAttribute("autocorrect", "off");
      if (n.placeholder) ta.placeholder = n.placeholder;
      ta.value = stateValue == null ? "" : String(stateValue);
      if (n.required) ta.required = true;
      ta.addEventListener("input", () => { this.writeBind(n.bind, ta.value); });
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = ta.selectionStart ?? 0;
          const end   = ta.selectionEnd   ?? 0;
          ta.value = ta.value.slice(0, start) + "\t" + ta.value.slice(end);
          ta.selectionStart = ta.selectionEnd = start + 1;
          this.writeBind(n.bind, ta.value);
        }
      });
      wrapper.appendChild(ta);
    } else {
      const inp = document.createElement("input");
      inp.className = "vms-field__input";
      inp.id = `vms-${n.name}`;
      inp.type = n.inputType;
      // On a focused `<input type="number">`, mouse wheel silently steps the
      // value. Blur so the value doesn't move; wheel bubbles unimpeded so the
      // page still scrolls. Never preventDefault (traps operator scroll).
      if (inp.type === "number") {
        inp.addEventListener("wheel", () => inp.blur());
      }
      inp.name = n.name;
      if (n.placeholder) inp.placeholder = n.placeholder;
      inp.value = stateValue == null ? "" : String(stateValue);
      if (n.required) inp.required = true;
      inp.addEventListener("input", () => { this.writeBind(n.bind, inp.value); });
      if (n.action) {
        const action = n.action;
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // Belt-and-suspenders: flush the latest value to state before
            // dispatching, in case the browser hasn't fired `input` yet
            // (e.g. an autofill that lands then submits).
            this.writeBind(n.bind, inp.value);
            on(action);
          }
        });
      }
      wrapper.appendChild(inp);
    }

    this.decorateField(wrapper, n);
    this.applyTooltip(wrapper, n.tooltip);
    parent.appendChild(wrapper);
  }

  /** Forms-completeness (3.4.0) — apply disabled/readonly to the control and
   *  render help + error text below it, wiring aria-describedby / aria-invalid.
   *  Runs on the main field path (the hidden + checkbox-FieldNode variants
   *  return before this). */
  /**
   * The lookup's two aria-live status regions for `key`, created ONCE and
   * reused forever after (§7 items 8 + 12).
   *
   * 🚨 This is the `chartInstances` idiom, not a new mechanism: the nodes are
   * DETACHED by render()'s innerHTML wipe, NOT destroyed, and field() re-appends
   * these same objects on every render. That is the entire point — a screen
   * reader's registration is held against the OBJECT, so a structurally
   * identical replacement is a region it has never heard of, and announcements
   * stop silently while the DOM still looks perfect.
   *
   * Created EMPTY, before any results exist (§7 item 8): creating an element and
   * injecting its text in the same tick announces NOTHING, because there was no
   * registered element to observe a change on.
   */
  private lookupLiveRegions(key: string): {
    a: HTMLElement; b: HTMLElement; next: "a" | "b"; hintShown: boolean;
  } {
    const existing = this.liveRegions.get(key);
    if (existing) return existing;

    const make = (slot: "a" | "b"): HTMLElement => {
      const el = document.createElement("div");
      // §7 item 9 — role="status" IS politeness=polite. Never assertive:
      // assertive interrupts the user's own typing echo, and is reserved for
      // errors (which arrive via decorateField's role="alert" region instead).
      el.setAttribute("role", "status");
      el.className = "vms-field__live";
      el.dataset.vmsLive = key;
      el.dataset.vmsLiveSlot = slot;
      el.textContent = "";
      return el;
    };
    const entry = { a: make("a"), b: make("b"), next: "a" as "a" | "b", hintShown: false };
    this.liveRegions.set(key, entry);
    return entry;
  }

  /**
   * Announce `message` in `key`'s live region, IMMEDIATELY (§7 items 11 + 12).
   *
   * 🚨 NO DEBOUNCE, DELIBERATELY (21-11). This used to wait ~1400ms — GOV.UK's
   * `statusDebounceMillis` — and that timer had exactly one job: the lookup
   * searched on a ~300ms type-as-you-go cadence, so the region faced a
   * PER-KEYSTROKE FIREHOSE, and on Safari/VoiceOver "typing echo can otherwise
   * interrupt announcement of the aria live content". `searchAction` now fires on
   * ENTER: one Enter, one announcement. The firehose is gone, so the tamer goes
   * with it — and keeping it would mean an AT user waits 1.4 seconds to hear the
   * answer to a question they explicitly asked, which is the opposite of the
   * item-11 goal ("an async combobox silent during the fetch leaves AT users
   * with no signal").
   *
   * ⇒ Do not re-add a debounce here without first re-adding the cadence that
   * justified it. There isn't one.
   *
   * Alternates the two regions (§7 item 12) and clears the other, so identical
   * consecutive messages still register as a change and are re-announced —
   * writing the same text into one region twice is not a change, and is silence.
   */
  private announceLookup(key: string, message: string): void {
    const entry = this.liveRegions.get(key);
    if (entry == null) return;
    const target = entry.next === "a" ? entry.a : entry.b;
    const other = entry.next === "a" ? entry.b : entry.a;
    other.textContent = "";
    target.textContent = message;
    entry.next = entry.next === "a" ? "b" : "a";
  }

  private decorateField(wrapper: HTMLElement, n: FieldNode): void {
    const control = wrapper.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      ".vms-field__input",
    );
    if (n.disabled) {
      if (control) (control as HTMLInputElement).disabled = true;
      wrapper.classList.add("vms-field--disabled");
    }
    if (n.readonly && control && "readOnly" in control) {
      (control as HTMLInputElement | HTMLTextAreaElement).readOnly = true;
    }
    // Native input constraints — min/max/step on <input>, maxLength on
    // <input>/<textarea>. Strings pass straight to the attribute.
    if (control instanceof HTMLInputElement) {
      if (n.min != null) control.min = n.min;
      if (n.max != null) control.max = n.max;
      if (n.step != null) control.step = n.step;
    }
    if (n.maxLength != null &&
        (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) {
      control.maxLength = n.maxLength;
    }
    // Seed from any aria-describedby an inputType arm already wired (Phase 21:
    // the lookup's §7 item 13 assistive hint). The control is freshly created on
    // every render, so this cannot accumulate stale ids — and without the seed,
    // the unconditional set below would silently CLOBBER the arm's hint the
    // moment the field also carried a `help` or an `error`.
    const describedBy: string[] = [];
    const preset = control?.getAttribute("aria-describedby");
    if (preset != null && preset !== "") describedBy.push(...preset.split(" "));
    if (n.help != null && n.help !== "") {
      const helpEl = document.createElement("div");
      helpEl.className = "vms-field__help";
      helpEl.id = `vms-${n.name}-help`;
      helpEl.textContent = n.help;
      wrapper.appendChild(helpEl);
      describedBy.push(helpEl.id);
    }
    if (n.error != null && n.error !== "") {
      wrapper.classList.add("vms-field--error");
      const errEl = document.createElement("div");
      errEl.className = "vms-field__error";
      errEl.id = `vms-${n.name}-error`;
      errEl.setAttribute("role", "alert");
      errEl.textContent = n.error;
      wrapper.appendChild(errEl);
      describedBy.push(errEl.id);
      control?.setAttribute("aria-invalid", "true");
    }
    if (control && describedBy.length > 0) {
      control.setAttribute("aria-describedby", describedBy.join(" "));
    }
  }

  /** CheckboxNode (standalone, immediate-dispatch) — bound boolean; on toggle,
   *  write to state then dispatch the action name (if any). */
  private checkbox(n: CheckboxNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const lbl = document.createElement("label");
    // v8.0.0 (COMP-03) — switch variant is a visual-only .vms-field--switch
    // modifier on the same label wrapper. Wire and dispatch semantics
    // unchanged; the CSS restyles the checkbox+mark into a slider.
    lbl.className = `vms-checkbox${n.variant === "switch" ? " vms-field--switch" : ""}`;
    const inp = document.createElement("input");
    inp.type = "checkbox";
    // v8.0.0 (COMP-03) — role="switch" so screen readers announce
    // "switch on"/"switch off" instead of "checked"/"unchecked". Native
    // Space still toggles; keyboard traversal unchanged.
    if (n.variant === "switch") inp.setAttribute("role", "switch");
    inp.className = "vms-checkbox__input";
    inp.name = n.name;
    // Stable id so keyboard focus survives a re-render (poll or action). The
    // wrapping <label> gives the click/label association; the id is purely for
    // focus restore. Namespaced distinctly from field() ids (vms-${name}) to
    // avoid an id collision when a field and a standalone checkbox share a name.
    inp.id = `vms-checkbox-${n.name}`;
    inp.checked = Boolean(this.sa.read(n.bind));
    const mark = document.createElement("span");
    mark.className = "vms-checkbox__mark";
    lbl.appendChild(inp);
    lbl.appendChild(mark);
    if (n.label) {
      const span = document.createElement("span");
      span.className = "vms-checkbox__label";
      span.textContent = n.label;
      lbl.appendChild(span);
    }
    inp.addEventListener("change", () => {
      this.sa.write(n.bind, inp.checked);
      if (n.action) on(n.action);
    });
    this.applyTooltip(lbl, n.tooltip);
    parent.appendChild(lbl);
  }

  /** Shared button appearance + activation behavior, applied to a <button> element
   *  (a standalone ButtonNode's button, OR a form's submitButton). Sets the full
   *  className (emphasis/tone/size/width/disabled), label, and the `disabled` attr,
   *  and returns a guarded `activate()` that runs disabled -> confirm -> pendingLabel
   *  swap -> dispatch. Both the standalone button() renderer and the FormNode
   *  submitButton branch use this so the two can NEVER diverge — the divergence WAS
   *  the bug (a form-level submit button silently dropped pendingLabel/disabled/
   *  confirm because it re-implemented rendering without the click behavior). */
  private applyButtonBehavior(
    btn: HTMLButtonElement,
    n: ButtonNode,
    dispatch: (a: ActionEvent) => void,
  ): () => void {
    btn.className = `vms-button${n.emphasis ? ` vms-button--${n.emphasis}` : ""}${
      n.tone ? ` vms-button--${n.tone}` : ""}${n.size ? ` vms-button--${n.size}` : ""}${
      n.width === "full" ? " vms-button--full" : ""}${
      n.disabled ? " vms-button--disabled" : ""}`;
    btn.textContent = n.label;
    if (n.disabled) btn.disabled = true;
    return () => {
      // Forms-completeness (3.4.0): a disabled button never dispatches. (Native
      // `disabled` already suppresses a click, but guard anyway — a form submit
      // isn't a native button click, and the attribute could be cleared out-of-band.)
      if (n.disabled) return;
      // confirm: a destructive-action guard. Show the NATIVE browser confirm
      // BEFORE any pendingLabel swap or dispatch; Cancel suppresses everything
      // (no dispatch, no visual change). Native by design — zero app/framework
      // state, and it's a client-only human affordance (an agent never reaches
      // this handler; it dispatches the action directly over the wire).
      if (n.confirm && !window.confirm(n.confirm)) return;
      // pendingLabel: instant client-side feedback. Swap text + add
      // .vms-button--pending BEFORE handing off to the dispatcher. On
      // success the next render replaces the button entirely. On dispatch
      // error, the shell re-renders so the original label snaps back.
      if (n.pendingLabel) {
        btn.textContent = n.pendingLabel;
        btn.classList.add("vms-button--pending");
      }
      dispatch(n.action);
    };
  }

  private button(n: ButtonNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const btn = document.createElement("button");
    btn.type = "button";
    const activate = this.applyButtonBehavior(btn, n, on);
    // v7.0.0 (ICON-04) — leading icon at size sm, tone inherited from button.
    // applyButtonBehavior sets textContent (which would wipe an already-appended
    // icon), so prepend the icon AFTER it, using a nested label span for the
    // text so the two coexist honestly.
    if (n.icon) {
      const labelSpan = document.createElement("span");
      labelSpan.className = "vms-button__label";
      labelSpan.textContent = n.label;
      btn.textContent = ""; // wipe the applyButtonBehavior textContent
      // On emphasis:"primary" the button fill IS var(--_btn-tone) (= --vms-error/success/info),
      // so a tone-colored icon disappears into the background. The label text handles this
      // by rendering in surface color (#fff / --vms-on-warning-fill); icons follow suit —
      // drop the tone axis and inherit currentColor from the button's own color. Filled
      // outline/secondary buttons DO show the tone (icon on neutral surface, honest contrast).
      const iconTone = n.emphasis === "primary" ? undefined : n.tone;
      btn.appendChild(this.renderIconSvg(n.icon, "sm", iconTone, undefined));
      btn.appendChild(labelSpan);
    }
    btn.addEventListener("click", activate);
    this.applyTooltip(btn, n.tooltip);
    parent.appendChild(btn);
  }

  private text(n: TextNode, parent: HTMLElement): void {
    // Tag precedence: level (semantic heading) wins over style:"pre" (typography
    // role), style:"pre" wins over the default <span>. Level is clamped to 1–6
    // at runtime — a wire-drift value like 7 falls back to <span> rather than
    // emitting an invalid <h7> element (defense against a less-strictly-typed
    // backend). Level itself always emits the real semantic tag so screen
    // readers see the heading landmark, not a generic span.
    const tag = (typeof n.level === "number" && n.level >= 1 && n.level <= 6)
      ? `h${n.level}`
      : (n.style === "pre" ? "pre" : "span");
    const el = document.createElement(tag);
    // v8.0.0 (COMP-02) — weight axis is a third class-modifier axis (orthogonal
    // to style + tone). Appended AFTER tone so a heavier weight visually
    // reinforces tone rather than competing with it in source-order specificity
    // (all three classes carry the same specificity; source-order only matters
    // for conflicting declarations, which weight does not have). Omitted =
    // no class emitted, matching the style / tone posture.
    //
    // v9.2.0 (Phase 31) — maxLines axis is a fourth class-modifier (orthogonal
    // to style + tone + weight). Appended LAST in the template. Emits
    // `.vms-text--max-lines-{1|2|3}` when set; omitted = no class = default
    // wrap behavior unchanged (backwards-compat). Line-clamp composes AFTER
    // wrapping — existing `overflow-wrap:anywhere` still applies. The axis
    // composes for free into every composite carrying a TextNode slot;
    // no composite renderer change needed (composite-nodes-layer.md §3
    // typed-slots pattern).
    el.className = `vms-text${n.style ? ` vms-text--${n.style}` : ""}${n.tone ? ` vms-text--${n.tone}` : ""}${n.weight ? ` vms-text--weight-${n.weight}` : ""}${n.maxLines ? ` vms-text--max-lines-${n.maxLines}` : ""}`;
    // runs present => draw runs INSTEAD of value. Absent => byte-identical to the
    // pre-runs rendering (a single text node), so every existing consumer is
    // untouched. The rule is unconditional, so a value/runs mismatch is never
    // ambiguous — see TextNode.value's TSDoc for why it isn't validated.
    // Tooltip anchoring: `.vms-text` carries `flex: 1` in default.css so it
    // fills flex-row containers. That means the outer element's bounding box
    // is much wider than the actual text (Ashley 2026-07-23 verification: the
    // tooltip appeared floating far to the right of "MTD" because the span
    // stretched across the whole row's remaining space). When a tooltip is
    // set, wrap the text in an inner `.vms-text__anchor` span so the tooltip
    // measures its position against the LETTERS, not the flex-stretched span.
    // The `runs` path doesn't hit this because inlineRuns emits its own
    // per-run inline elements sized to their content; the plain-value path
    // is the one that emitted a bare text node.
    if (n.runs && n.runs.length > 0) {
      this.inlineRuns(n.runs, el);
      // Runs on the outer with tooltip: apply to the outer because inlineRuns
      // emits multiple children — no single inner element to attach to.
      // Accepts the flex-width anchor; the value case (below) is the common
      // path and the one that got the fix.
      this.applyTooltip(el, n.tooltip);
    } else if (n.tooltip != null && n.tooltip !== "") {
      const inner = document.createElement("span");
      inner.className = "vms-text__anchor";
      inner.textContent = n.value;
      this.applyTooltip(inner, n.tooltip);
      el.appendChild(inner);
    } else {
      el.textContent = n.value;
    }
    parent.appendChild(el);
  }

  /** Render a flat inline-run list into `parent`. Two responsibilities:
   *  (1) COALESCE adjacent runs sharing an identical href+external into ONE
   *      anchor — otherwise "a link containing a bold word" renders as two
   *      anchors, i.e. two tab stops and two screen-reader link announcements.
   *  (2) Delegate per-run emphasis to `inlineEmphasis`, which nests in a FIXED
   *      order so the same input always yields byte-identical DOM.
   *  All text lands via createTextNode/textContent — never innerHTML. */
  private inlineRuns(runs: InlineRun[], parent: HTMLElement): void {
    let i = 0;
    while (i < runs.length) {
      const href = runs[i].href;
      if (href === undefined) {
        this.inlineEmphasis(runs[i], parent);
        i++;
        continue;
      }
      const external = runs[i].external === true;
      const a = document.createElement("a");
      a.className = "vms-text__link";
      a.href = href;
      if (external) {
        // Identical to link() — kept byte-for-byte so the standalone and inline
        // link paths cannot drift (the submitButton divergence lesson).
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      // Absorb every adjacent run pointing at the same target.
      while (i < runs.length && runs[i].href === href && (runs[i].external === true) === external) {
        this.inlineEmphasis(runs[i], a);
        i++;
      }
      parent.appendChild(a);
    }
  }

  /** Wrap one run's text in its emphasis elements, innermost → outermost in a
   *  FIXED order (code, strike, italic, bold) so nesting is deterministic and the
   *  DOM is diffable. A run with no flags appends a BARE text node — no wrapper
   *  span — so `runs:[{text:"hi"}]` renders exactly like `value:"hi"`. */
  private inlineEmphasis(run: InlineRun, parent: HTMLElement | HTMLAnchorElement): void {
    let node: Node = document.createTextNode(run.text);
    if (run.code) node = this.wrapRun("code", "vms-text__code", node);
    if (run.strike) node = this.wrapRun("s", "vms-text__strike", node);
    if (run.italic) node = this.wrapRun("em", "vms-text__em", node);
    if (run.bold) node = this.wrapRun("strong", "vms-text__strong", node);
    parent.appendChild(node);
  }

  private wrapRun(tag: string, className: string, child: Node): HTMLElement {
    const el = document.createElement(tag);
    el.className = className;
    el.appendChild(child);
    return el;
  }

  private link(n: LinkNode, parent: HTMLElement): void {
    const a = document.createElement("a");
    a.className = n.active ? "vms-link vms-link--active" : "vms-link";
    a.href = n.href;
    // v7.0.0 (ICON-04) — leading icon at size sm; NO tone class (link inherits
    // currentColor per design-doc §4). Icon prepended before the label text.
    if (n.icon) {
      a.appendChild(this.renderIconSvg(n.icon, "sm", undefined, undefined));
      const labelSpan = document.createElement("span");
      labelSpan.className = "vms-link__label";
      labelSpan.textContent = n.label;
      a.appendChild(labelSpan);
    } else {
      a.textContent = n.label;
    }
    if (n.active) a.setAttribute("aria-current", "page");
    if (n.external) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    this.applyTooltip(a, n.tooltip);
    parent.appendChild(a);
  }

  private divider(n: DividerNode, parent: HTMLElement): void {
    if (n.orientation === "vertical") {
      // <hr> is semantically horizontal; a vertical rule is a separator div.
      const el = document.createElement("div");
      el.className = "vms-divider vms-divider--vertical";
      el.setAttribute("role", "separator");
      el.setAttribute("aria-orientation", "vertical");
      parent.appendChild(el);
      return;
    }
    const hr = document.createElement("hr"); // implicit role="separator"
    hr.className = "vms-divider";
    parent.appendChild(hr);
  }

  private statBar(n: StatBarNode, parent: HTMLElement): void {
    const bar = document.createElement("div");
    bar.className = "vms-stat-bar";
    n.stats.forEach(stat => {
      const item = document.createElement("div");
      item.className = stat.tone
        ? `vms-stat-bar__item vms-stat-bar__item--toned vms-stat-bar__item--tone-${stat.tone}`
        : "vms-stat-bar__item";
      const val = document.createElement("span");
      val.className = "vms-stat-bar__value";
      val.textContent = stat.value;
      const lbl = document.createElement("span");
      lbl.className = "vms-stat-bar__label";
      lbl.textContent = stat.label;
      item.appendChild(val);
      item.appendChild(lbl);
      bar.appendChild(item);
    });
    parent.appendChild(bar);
  }

  /** TabsNode — on click, write tab.value to state at node.bind, then dispatch
   *  the tab's own action name. */
  private tabs(n: TabsNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const nav = document.createElement("nav");
    nav.className = "vms-tabs";
    nav.setAttribute("role", "tablist");
    n.tabs.forEach(tab => {
      const btn = document.createElement("button");
      btn.className = `vms-tabs__tab${tab.value === n.selected ? " vms-tabs__tab--active" : ""}`;
      btn.textContent = tab.label;
      // Stable id so focus survives the re-render a tab click triggers (and any
      // poll re-render) — render()'s restore keys off id.
      btn.id = `vms-tab-${n.bind}-${tab.value}`;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(tab.value === n.selected));
      btn.addEventListener("click", () => {
        this.sa.write(n.bind, tab.value);
        on(tab.action);
      });
      nav.appendChild(btn);
    });
    parent.appendChild(nav);
  }

  private image(n: ImageNode, parent: HTMLElement): void {
    const img = document.createElement("img");
    let cls = "vms-image";
    if (n.size) cls += ` vms-image--${n.size}`;
    if (n.shape) cls += ` vms-image--${n.shape}`;
    img.className = cls;
    img.src = n.src;
    // Always set alt: a present alt for meaningful images, an explicit empty
    // string for decorative ones (alt="" tells assistive tech to skip it,
    // whereas a missing alt may make it announce the src/URL).
    img.alt = n.alt ?? "";
    // Caption: when present, wrap the image + caption in a <figure>/<figcaption>
    // pair — the standard captioned-figure landmark. When absent, emit the bare
    // <img> exactly as before (byte-identical to pre-caption consumers). Rich
    // runs on the caption follow TextNode's rule: runs override plain text.
    if (n.caption !== undefined) {
      const fig = document.createElement("figure");
      fig.className = "vms-figure";
      fig.appendChild(img);
      const cap = document.createElement("figcaption");
      cap.className = "vms-figcaption";
      if (n.captionRuns && n.captionRuns.length > 0) this.inlineRuns(n.captionRuns, cap);
      else cap.textContent = n.caption;
      fig.appendChild(cap);
      parent.appendChild(fig);
    } else {
      parent.appendChild(img);
    }
  }
  private progress(n: ProgressNode, parent: HTMLElement): void {
    const track = document.createElement("div");
    track.className = "vms-progress";
    // Clamp to 0–100 (the documented range): an out-of-range value would
    // otherwise overflow the track or render a negative-width bar.
    const value = Math.max(0, Math.min(100, n.value));
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(value));
    const bar = document.createElement("div");
    bar.className = "vms-progress__bar";
    bar.style.width = `${value}%`;
    track.appendChild(bar);
    parent.appendChild(track);
  }

  private modal(n: ModalNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const backdrop = document.createElement("div");
    backdrop.className = "vms-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = `vms-modal${n.size ? ` vms-modal--${n.size}` : ""}`;
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const header = document.createElement("div");
    header.className = "vms-modal__header";

    if (n.title) {
      const title = document.createElement("span");
      title.className = "vms-modal__title";
      title.textContent = n.title;
      header.appendChild(title);
    }

    if (n.dismissAction) {
      const action = n.dismissAction;
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "vms-modal__close";
      closeBtn.textContent = "✕";
      closeBtn.addEventListener("click", () => on(action));
      header.appendChild(closeBtn);
    }

    modal.appendChild(header);

    const body = document.createElement("div");
    body.className = "vms-modal__body";
    this.kids(n.children, body, on);
    modal.appendChild(body);

    if (n.footer && n.footer.length > 0) {
      const footer = document.createElement("div");
      footer.className = "vms-modal__footer";
      this.kids(n.footer, footer, on);
      modal.appendChild(footer);
    }

    backdrop.appendChild(modal);
    parent.appendChild(backdrop);
  }

  /** TableNode — sort writes {column, direction} to sortBind then dispatches
   *  sortActions[col.key]; filter inputs are bound to filterDescriptorBinds[col.key],
   *  every keystroke writes a FilterDescriptor to state; pagination
   *  prev/next write the target page to paginationBind then dispatch
   *  prevAction/nextAction. Per-row controls (row.actions[]) are a mix of
   *  ButtonNode and CheckboxNode; the renderer partitions them by entry.type —
   *  CheckboxNodes render in a dedicated LEADING column (left, the data-grid
   *  selection convention), ButtonNodes in the TRAILING actions cell (right).
   *  When row.action
   *  is set, the entire <tr> becomes clickable + keyboard-activatable
   *  (Enter / Space — Space preventDefaults page scroll) and exposes
   *  role="button", tabindex=0, and an aria-label derived from cell text;
   *  clicks on per-row controls or cell linkLabel anchors stopPropagation
   *  so they don't also fire row.action. Selection is no longer a framework
   *  concept. */
  private table(n: TableNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const wrapper = document.createElement("div");
    wrapper.className = "vms-table-wrapper";

    const table = document.createElement("table");
    table.className = "vms-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    // Per-row checkboxes render in a dedicated LEADING column. If ANY row
    // carries a checkbox, every row gets a leading select cell (empty when the
    // row has none) and the header/filter rows get a matching leading <th>, so
    // body cells stay column-aligned with their headers. (The trailing actions
    // cell needs no header because it's the LAST column — a leading column does.)
    const tableHasCheckboxes = n.rows.some(
      r => r.actions?.some(e => e.type === "checkbox") ?? false,
    );
    if (tableHasCheckboxes) {
      const selTh = document.createElement("th");
      selTh.className = "vms-table__th vms-table__th--select";
      // Header "select all rendered rows" affordance. A pure client-side toggle
      // over the leading-column checkboxes: it writes the SAME per-row binds the
      // row checkboxes use, so the server learns the selection through the exact
      // path it already knows — no new wire field, and agents (which set binds
      // directly) never need it. Scope is deliberately "all RENDERED rows": under
      // filter-narrow that equals all matches; under pagination it is the current
      // page (selection accumulates via the round-tripped binds); over-cap /
      // zero-match render no rows, so the control below simply is not drawn and
      // can never claim to select rows that are not on screen. It writes the binds
      // and — for checkboxes that carry an `action` — replays each one's dispatch,
      // so select-all does EXACTLY what clicking each row by hand does (see the
      // change handler below). It is NOT the removed 0.15.0 selection.action seam:
      // that was the framework's own per-toggle seam racing with no coalescing loop;
      // this reuses CheckboxNode.action (a shipped, app-declared capability) and the
      // v4.2 non-blocking latest-wins loop, and never forces a dispatch semantic.
      const rowCheckboxes = n.rows.flatMap(
        r => (r.actions ?? []).filter((e): e is CheckboxNode => e.type === "checkbox"),
      );
      if (rowCheckboxes.length > 0) {
        const lbl = document.createElement("label");
        lbl.className = "vms-checkbox vms-table__select-all";
        const inp = document.createElement("input");
        inp.type = "checkbox";
        inp.className = "vms-checkbox__input";
        inp.setAttribute("aria-label", "Select all rows");
        const states = rowCheckboxes.map(cb => Boolean(this.sa.read(cb.bind)));
        const allChecked = states.every(Boolean);
        inp.checked = allChecked;
        inp.indeterminate = !allChecked && states.some(Boolean);
        const mark = document.createElement("span");
        mark.className = "vms-checkbox__mark";
        inp.addEventListener("change", () => {
          const target = inp.checked;
          for (const cb of rowCheckboxes) {
            this.sa.write(cb.bind, target);
            const rowInp = document.getElementById(
              `vms-checkbox-${cb.name}`,
            ) as HTMLInputElement | null;
            if (rowInp) rowInp.checked = target;
          }
          inp.indeterminate = false;
          // Select-all is N per-row toggles expressed at once: after writing every
          // bind, replay each checkbox's OWN dispatch. Behaviorally identical to the
          // user clicking each row by hand — same actions, same order, same blocking/
          // coalescing — so it introduces ZERO new dispatch semantics. A checkbox with
          // no `action` dispatches nothing, so the pure client-harvest model (selection
          // stays client-side until a bulk-button harvest) is untouched. The app owns
          // what a burst means: the non-blocking latest-wins loop it opted into
          // collapses N identical dispatches to one server recompute; a blocking
          // checkbox serializes under the dispatch guard exactly as rapid manual
          // clicking would. (Consumer-driven — Poppy/PBMInvoices 2026-07-20: a
          // server-tracked SelectedMap went stale on select-all because only per-row
          // toggles dispatched, not the header box.)
          for (const cb of rowCheckboxes) {
            if (cb.action) on(cb.action);
          }
        });
        lbl.appendChild(inp);
        lbl.appendChild(mark);
        selTh.appendChild(lbl);
      }
      headerRow.appendChild(selTh);
    }

    const sortIntent = (n.sortBind != null ? this.sa.read(n.sortBind) : null) as
      | { column?: string; direction?: "asc" | "desc" }
      | null
      | undefined;
    const sortedCol = sortIntent?.column;
    const sortedDir = sortIntent?.direction;

    n.columns.forEach(col => {
      const th = document.createElement("th");
      const isSorted = col.key === sortedCol;
      const dir = isSorted ? (sortedDir ?? "asc") : null;
      let classes = "vms-table__th";
      if (col.sortable) classes += " vms-table__th--sortable";
      if (dir === "asc") classes += " vms-table__th--asc";
      if (dir === "desc") classes += " vms-table__th--desc";
      th.className = classes;
      th.textContent = col.label;
      const sortAction = n.sortActions?.[col.key];
      if (col.sortable && sortAction && n.sortBind != null) {
        const sortBind = n.sortBind;
        th.addEventListener("click", () => {
          // Read current sort intent at click time (not render time): if no
          // re-render has happened between clicks, the closure-captured
          // sortedDir would be stale.
          const cur = this.sa.read(sortBind) as
            | { column?: string; direction?: "asc" | "desc" }
            | null
            | undefined;
          const nextDir: "asc" | "desc" =
            cur?.column === col.key && cur?.direction === "asc" ? "desc" : "asc";
          this.sa.write(sortBind, { column: col.key, direction: nextDir });
          on(sortAction);
        });
      }
      this.applyTooltip(th, col.tooltip);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    // Phase 33 (33-01) — filter row rendering: filterDescriptorBinds present →
    //   always-visible input + filter button per filterable column
    //   (Round 2 hybrid shape, REQ-CF2-01..06).
    const hasNewFilters = !!n.filterDescriptorBinds && n.columns.some(c => c.filter != null);
    if (hasNewFilters) {
      const filterRow = document.createElement("tr");
      filterRow.className = "vms-table__filter-row";
      if (tableHasCheckboxes) {
        filterRow.appendChild(document.createElement("th"));
      }
      n.columns.forEach(col => {
        const th = document.createElement("th");
        if (col.filter != null && n.filterDescriptorBinds?.[col.key] != null) {
          const bindPath = n.filterDescriptorBinds[col.key];
          const descriptor = this.sa.read(bindPath) as FilterDescriptor | null | undefined ?? null;

          // Icon-state determination (REQ-CF2-02):
          //   "empty" — no active filter at all
          //   "simple" — exactly one contains rule with no matching hints
          //   "escalated" — more complex (>1 rule, non-contains op, or matching hints)
          const filterState = this.computeFilterState(descriptor, col.filter);

          // Cell wrapper (flex row: inline input/summary + filter button)
          th.style.display = "flex";
          th.style.alignItems = "center";
          th.style.gap = "2px";

          // Inline input or read-only summary (REQ-CF2-06)
          if (filterState === "escalated") {
            // Read-only compact summary for nontrivial descriptors
            const summary = document.createElement("span");
            summary.className = "vms-filter-inline-summary";
            summary.textContent = this.buildFilterSummary(descriptor!);
            summary.title = summary.textContent; // full text in tooltip
            th.appendChild(summary);
          } else {
            // Editable inline input (empty or simple contains)
            const inp = document.createElement("input");
            inp.type = "text";
            inp.className = "vms-table__filter-input";
            inp.dataset.col = col.key;
            // Stable id for focus+caret restore across re-renders (same as legacy path)
            inp.id = `vms-tablefilter-${col.key}`;
            inp.placeholder = "Filter…";
            // Seed from the current contains rule value (or empty string)
            const currentContainsValue =
              filterState === "simple" && descriptor?.rules[0]?.value != null
                ? String(descriptor.rules[0].value)
                : "";
            inp.value = currentContainsValue;
            inp.addEventListener("input", () => {
              // Write a single contains rule to state on every keystroke.
              // NOTE: This writes STATE only — no named action is dispatched.
              // The server picks up the updated descriptor on the next regular
              // action (e.g. a poll, page navigation, or any user-initiated
              // dispatch). This is the Phase 33 filter-state contract: the
              // descriptor bind path IS a state path and is round-tripped on
              // every dispatch without a separate filter-specific action wire.
              if (inp.value === "") {
                this.sa.write(bindPath, null);
              } else {
                this.sa.write(bindPath, {
                  rules: [{ operator: "contains", value: inp.value }],
                  joiner: "all-of",
                } as FilterDescriptor);
              }
            });
            inp.addEventListener("keydown", (e) => {
              if (e.key === "Enter") {
                // Enter: write the contains descriptor to state (same as input
                // event) and do NOT dispatch a named action — state update is
                // the commit. See SUMMARY.md "Inline Enter behavior" for the
                // documented behavioral change from the legacy filterAction path.
                if (inp.value === "") {
                  this.sa.write(bindPath, null);
                } else {
                  this.sa.write(bindPath, {
                    rules: [{ operator: "contains", value: inp.value }],
                    joiner: "all-of",
                  } as FilterDescriptor);
                }
              }
            });
            th.appendChild(inp);
          }

          // Filter icon button (REQ-CF2-02) — three states:
          //   "empty"    → filter-slash glyph (no active filter)
          //   "simple"   → filter glyph (plain funnel, simple contains active)
          //   "escalated"→ filter glyph + dot (nontrivial descriptor)
          const filterBtn = document.createElement("button");
          filterBtn.type = "button";
          filterBtn.className = "vms-filter-button";
          filterBtn.setAttribute("aria-label", `Filter ${col.label ?? col.key}`);
          filterBtn.setAttribute("aria-expanded", "false");
          filterBtn.setAttribute("aria-haspopup", "dialog");

          const iconName: IconName = filterState === "empty" ? "filter-slash" : "filter";
          filterBtn.appendChild(this.renderIconSvg(iconName, "sm", undefined, undefined));

          if (filterState === "escalated") {
            const dot = document.createElement("span");
            dot.className = "vms-filter-dot";
            dot.setAttribute("aria-hidden", "true");
            filterBtn.appendChild(dot);
          }

          filterBtn.addEventListener("click", () => {
            this.openFilterPopover(bindPath, col, col.filter!, filterBtn, on);
          });

          th.appendChild(filterBtn);
        }
        filterRow.appendChild(th);
      });
      thead.appendChild(filterRow);
    }

    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    n.rows.forEach(row => {
      const tr = document.createElement("tr");
      let rowClass = "vms-table__row";
      if (row.state) rowClass += ` vms-table__row--${row.state}`;
      if (row.tone) rowClass += ` vms-table__row--${row.tone}`;
      if (row.action) rowClass += " vms-table__row--clickable";
      tr.className = rowClass;
      if (row.id) tr.dataset.id = row.id;
      // row.action — click-anywhere + keyboard + ARIA. Per-row controls and
      // cell linkLabel anchors stopPropagation below so they don't double-fire.
      if (row.action) {
        const rowAction = row.action;
        tr.tabIndex = 0;
        tr.setAttribute("role", "button");
        const labelParts = Object.values(row.cells)
          .filter(v => v && v.trim())
          .map(v => v.trim());
        const ariaLabel = labelParts.length > 0
          ? labelParts.join(" · ")
          : (row.id ? `Row ${row.id}` : "");
        if (ariaLabel) tr.setAttribute("aria-label", ariaLabel);
        tr.addEventListener("click", () => { on(rowAction); });
        tr.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            on(rowAction);
          } else if (e.key === " " || e.key === "Spacebar") {
            e.preventDefault(); // suppress page scroll
            on(rowAction);
          }
        });
      }
      // Leading select cell — holds this row's checkbox controls (empty when
      // the row has none). Rendered for every row whenever the table has any
      // checkboxes, so columns line up with the leading <th> added above. When
      // row.action is set, swallow clicks so toggling doesn't fire the row action.
      if (tableHasCheckboxes) {
        const selTd = document.createElement("td");
        selTd.className = "vms-table__td vms-table__td--select";
        for (const entry of row.actions ?? []) {
          if (entry.type === "checkbox") this.checkbox(entry, selTd, on);
        }
        if (row.action) {
          selTd.addEventListener("click", (e) => { e.stopPropagation(); });
        }
        tr.appendChild(selTd);
      }
      n.columns.forEach(col => {
        const td = document.createElement("td");
        td.className = "vms-table__td";
        const cellValue = row.cells[col.key] ?? "";
        if (col.linkLabel && cellValue) {
          const a = document.createElement("a");
          a.href = cellValue;
          a.textContent = col.linkLabel;
          a.className = "vms-table__link";
          if (col.linkExternal) {
            a.target = "_blank";
            a.rel = "noopener noreferrer";
          }
          if (row.action) {
            a.addEventListener("click", (e) => { e.stopPropagation(); });
          }
          td.appendChild(a);
        } else {
          td.textContent = cellValue;
        }
        tr.appendChild(td);
      });
      // Trailing actions cell — per-row ButtonNodes only (checkboxes render in
      // the leading select cell above). When row.action is set, swallow clicks
      // on the actions td so pressing a button doesn't ALSO fire the row action.
      const buttonEntries = (row.actions ?? []).filter(
        (e): e is ButtonNode => e.type === "button",
      );
      if (buttonEntries.length > 0) {
        const td = document.createElement("td");
        td.className = "vms-table__td vms-table__td--actions";
        for (const entry of buttonEntries) this.button(entry, td, on);
        if (row.action) {
          td.addEventListener("click", (e) => { e.stopPropagation(); });
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    wrapper.appendChild(table);

    // Visible-scoped bulk-action toolbar (n.selection). Rendered ABOVE the table.
    // Each button, on click, harvests the currently-CHECKED, currently-RENDERED
    // rows (by walking tbody for a checked leading-column checkbox and reading the
    // row's data-id) and writes that id array to n.selection.harvestBind —
    // OVERWRITING — before dispatching. So the server only ever sees rows the user
    // can currently see; a row selected then filtered/paginated out of view is not
    // harvested. This revives the old selection.buttons[] harvest (removed with the
    // `context` wire in Phase 6), adapted to write a BIND instead of context. It
    // adds NONE of the per-toggle dispatch that got the 0.15.0 selection.action
    // seam removed — selection stays a pure client concern until a bulk click.
    if (n.selection && n.selection.buttons.length > 0) {
      const sel = n.selection;
      const toolbar = document.createElement("div");
      toolbar.className = "vms-table__bulk-actions";
      const harvest = (action: ActionEvent): void => {
        const ids: string[] = [];
        tbody.querySelectorAll<HTMLTableRowElement>("tr").forEach(tr => {
          const box = tr.querySelector<HTMLInputElement>(
            ".vms-table__td--select input.vms-checkbox__input",
          );
          if (box?.checked && tr.dataset.id) ids.push(tr.dataset.id);
        });
        this.sa.write(sel.harvestBind, ids);
        on({ name: action.name });
      };
      for (const btn of sel.buttons) this.button(btn, toolbar, harvest);
      wrapper.insertBefore(toolbar, table);
    }

    if (n.pagination) {
      const pg = n.pagination;
      const footer = document.createElement("div");
      footer.className = "vms-table__pagination";

      const totalPages = Math.max(1, Math.ceil(pg.totalRows / pg.pageSize));
      const from = pg.totalRows === 0 ? 0 : (pg.page - 1) * pg.pageSize + 1;
      const to = Math.min(pg.page * pg.pageSize, pg.totalRows);

      const range = document.createElement("span");
      range.className = "vms-table__pagination-range";
      range.textContent = `${from}–${to} of ${pg.totalRows}`;
      footer.appendChild(range);

      const paginationBind = n.paginationBind;
      const mkBtn = (
        label: string,
        targetPage: number,
        action: ActionEvent | undefined,
        disabled: boolean,
      ): HTMLButtonElement => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "vms-button vms-button--secondary vms-table__pagination-btn";
        b.textContent = label;
        b.disabled = disabled;
        if (!disabled && action) {
          b.addEventListener("click", () => {
            if (paginationBind != null) this.sa.write(paginationBind, targetPage);
            on(action);
          });
        }
        return b;
      };
      const prevDisabled = pg.page <= 1 || pg.prevAction == null;
      const nextDisabled = pg.page >= totalPages || pg.nextAction == null;
      footer.appendChild(mkBtn("‹ Prev", pg.page - 1, pg.prevAction, prevDisabled));

      if (pg.jumpAction) {
        const jumpAction = pg.jumpAction;
        const jump = document.createElement("span");
        jump.className = "vms-table__pagination-jump";

        const label = document.createElement("span");
        label.className = "vms-table__pagination-jump-label";
        label.textContent = "Page";
        jump.appendChild(label);

        const input = document.createElement("input");
        input.type = "number";
        // See field() — wheel on a focused number input silently steps the
        // value; blur so the value doesn't move while the page still scrolls.
        input.addEventListener("wheel", () => input.blur());
        input.className = "vms-table__pagination-jump-input";
        input.min = "1";
        input.max = String(totalPages);
        input.inputMode = "numeric";
        input.setAttribute("aria-label", "Page number");
        input.value = String(pg.page);
        jump.appendChild(input);

        const ofLabel = document.createElement("span");
        ofLabel.className = "vms-table__pagination-jump-label";
        ofLabel.textContent = `of ${totalPages}`;
        jump.appendChild(ofLabel);

        const submitJump = (): void => {
          const parsed = Number.parseInt(input.value.trim(), 10);
          if (!Number.isFinite(parsed)) return;
          const clamped = Math.min(Math.max(parsed, 1), totalPages);
          input.value = String(clamped);
          if (paginationBind != null) this.sa.write(paginationBind, clamped);
          on(jumpAction);
        };

        const goBtn = document.createElement("button");
        goBtn.type = "button";
        goBtn.className = "vms-button vms-button--secondary vms-table__pagination-btn";
        goBtn.textContent = "Go";
        goBtn.addEventListener("click", submitJump);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") submitJump();
        });
        jump.appendChild(goBtn);

        footer.appendChild(jump);
      }

      footer.appendChild(mkBtn("Next ›", pg.page + 1, pg.nextAction, nextDisabled));

      wrapper.appendChild(footer);
    }

    parent.appendChild(wrapper);
  }

  private copyButton(n: CopyButtonNode, parent: HTMLElement): void {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `vms-button${n.emphasis ? ` vms-button--${n.emphasis}` : ""}${
      n.tone ? ` vms-button--${n.tone}` : ""}${n.size ? ` vms-button--${n.size}` : ""}${
      n.width === "full" ? " vms-button--full" : ""}`;
    btn.textContent = n.label ?? "Copy";

    const showCopied = () => {
      btn.textContent = n.copiedLabel ?? "Copied!";
      setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
    };
    // Plain-text copy (today's behavior, unchanged): async writeText with the
    // execCommand fallback for engines without the async Clipboard API.
    const copyPlain = (text: string) => {
      const write = navigator.clipboard?.writeText(text);
      if (write) {
        write.then(showCopied).catch(() => { if (legacyCopy(text)) showCopied(); });
      } else {
        if (legacyCopy(text)) showCopied();
      }
    };

    btn.addEventListener("click", () => {
      // RICH COPY — resolve the two representations by precedence: copyTargetId > html > plain.
      let html: string | null = null;
      let plain = n.text;
      if (n.copyTargetId != null) {
        // Harvest route: lift both representations off the already-rendered region.
        const target = document.getElementById(n.copyTargetId);
        if (target) {
          html = target.outerHTML;
          plain = target.textContent ?? n.text;
        } else {
          // Fail LOUD — a copy target that resolves to nothing is a bug, not a
          // silent no-op — then still give the user the plain fallback.
          console.error(
            `[viewmodel-shell] CopyButtonNode.copyTargetId "${n.copyTargetId}" matched no ` +
            `element on the page; falling back to plain-text copy. The target must be a ` +
            `described region that emits that DOM id (e.g. SectionNode.id / ListNode.id).`,
          );
          copyPlain(n.text);
          return;
        }
      } else if (n.html != null) {
        // Server-provided route: the formatted representation the server authored.
        html = n.html;
      }

      // No rich representation → today's plain-text write.
      if (html === null) { copyPlain(plain); return; }

      // Two representations at once via the async Clipboard API. A destination that
      // understands formatting takes text/html; a plain one takes text/plain. If the
      // API is unavailable or the write is rejected (permissions, older engine),
      // degrade to the plain representation so the button is never dead.
      if (navigator.clipboard?.write && typeof ClipboardItem === "function") {
        const item = new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        });
        navigator.clipboard.write([item]).then(showCopied).catch(() => copyPlain(plain));
      } else {
        copyPlain(plain);
      }
    });

    this.applyTooltip(btn, n.tooltip);
    parent.appendChild(btn);
  }

  /** EmptyStateNode — a centered "nothing here" block: an optional
   *  tinted-circle icon backdrop, a title, an optional description, then the
   *  optional CTA ButtonNode (rendered via the shared button renderer so it
   *  dispatches like any other button).
   *
   *  🚨 v8.0.0 BREAKING RENAME:
   *    `heading` → `title` (required), `message` → `description` (optional),
   *    NEW `icon?: IconName` slot. Class-name rename cascades to CSS block. */
  private emptyState(n: EmptyStateNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const el = document.createElement("div");
    el.className = "vms-empty-state";

    // NEW in v8.0 — tinted-circle icon backdrop. Renders <div class="vms-empty-state__icon">
    // wrapping an <svg class="vms-icon vms-icon--lg">. CSS ships the 3rem × 3rem
    // circle + accent-tinted background per the tasting mockup.
    if (n.icon) {
      const iconWrap = document.createElement("div");
      iconWrap.className = "vms-empty-state__icon";
      iconWrap.appendChild(this.renderIconSvg(n.icon, "lg", undefined, undefined));
      el.appendChild(iconWrap);
    }

    // RENAMED: `heading` → `title`, class `__heading` → `__title`
    const title = document.createElement("div");
    title.className = "vms-empty-state__title";
    title.textContent = n.title;
    el.appendChild(title);

    // RENAMED: `message` → `description`, class `__message` → `__description`
    if (n.description != null && n.description !== "") {
      const desc = document.createElement("div");
      desc.className = "vms-empty-state__description";
      desc.textContent = n.description;
      el.appendChild(desc);
    }

    if (n.action) this.button(n.action, el, on);

    parent.appendChild(el);
  }

  /** BlockquoteNode — a real semantic <blockquote> holding arbitrary block-level
   *  children. Every child renders through the standard child-dispatch (nested
   *  blockquotes, lists, paragraphs, interactive descendants — all supported).
   *  Emits <blockquote class="vms-blockquote"> for the shipped indent + accent
   *  bar styling. */
  private blockquote(n: BlockquoteNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const el = document.createElement("blockquote");
    el.className = "vms-blockquote";
    this.kids(n.children, el, on);
    parent.appendChild(el);
  }

  /** CodeBlockNode — a display-only <pre><code> block with an optional header
   *  row (filename + language badge + copy button). Non-interactive; the copy
   *  button reuses the existing this.copyButton() renderer with a synthesized
   *  CopyButtonNode so the copy behavior can never drift from the standalone
   *  copy-button primitive (the "provide-your-own-X embedded slots are
   *  divergence risks" lesson: share the render, don't parallel-implement). */
  private codeBlock(n: CodeBlockNode, parent: HTMLElement): void {
    const wrap = document.createElement("div");
    wrap.className = "vms-code-block";

    const showCopy = n.copyable !== false;
    const hasHeader = n.filename != null || n.language != null || showCopy;
    if (hasHeader) {
      const header = document.createElement("div");
      header.className = "vms-code-block__header";

      if (n.filename != null) {
        const fn = document.createElement("span");
        fn.className = "vms-code-block__filename";
        fn.textContent = n.filename;
        header.appendChild(fn);
      }

      if (n.language != null) {
        const lang = document.createElement("span");
        lang.className = "vms-code-block__language";
        lang.textContent = n.language;
        header.appendChild(lang);
      }

      // Push the copy button to the far right of the header.
      const spacer = document.createElement("span");
      spacer.className = "vms-code-block__spacer";
      header.appendChild(spacer);

      if (showCopy) {
        // Synthesize a CopyButtonNode so the copy path routes through the
        // exact same code as the standalone primitive. size:"sm" fits the
        // header row visually; emphasis:"secondary" keeps it visually quiet.
        this.copyButton({
          type: "copy-button",
          text: n.code,
          emphasis: "secondary",
          size: "sm",
        }, header);
      }

      wrap.appendChild(header);
    }

    const pre = document.createElement("pre");
    pre.className = "vms-code-block__pre";
    const code = document.createElement("code");
    // .language-{name} is a convention external highlighters (Prism, hljs)
    // adopt; the framework itself ships no coloring in v1 (deferred, see
    // AGENTS.md AA-contrast gate hole rationale in the design report).
    code.className = "vms-code-block__code" + (n.language != null ? ` language-${n.language}` : "");
    // textContent, not innerHTML — code is untrusted display content.
    code.textContent = n.code;
    pre.appendChild(code);
    wrap.appendChild(pre);

    parent.appendChild(wrap);
  }

  /** BadgeNode — a compact inline status pill / count. Leaf node: label text +
   *  tone/emphasis modifier classes. */
  private badge(n: BadgeNode, parent: HTMLElement): void {
    const span = document.createElement("span");
    span.className = `vms-badge${n.tone ? ` vms-badge--${n.tone}` : ""}${
      n.emphasis ? ` vms-badge--${n.emphasis}` : ""}`;
    // v7.0.0 (ICON-04) — leading icon at size xs, tone inherited from badge.
    if (n.icon) span.appendChild(this.renderIconSvg(n.icon, "xs", n.tone, undefined));
    // textContent replaces existing content, so use a nested span when we
    // already prepended an icon so the two don't clobber each other.
    if (n.icon) {
      const labelSpan = document.createElement("span");
      labelSpan.className = "vms-badge__label";
      labelSpan.textContent = n.label;
      span.appendChild(labelSpan);
    } else {
      span.textContent = n.label;
    }
    this.applyTooltip(span, n.tooltip);
    parent.appendChild(span);
  }

  // ─── Icons (v7.0.0 — ICON-01/02/03/04) ─────────────────────────────────────
  //
  // The framework owns the SVG payload map (ICONS in icons-payload.ts) and the
  // <svg> wrapper attrs (viewBox, fill, stroke, stroke-width, stroke-linecap,
  // stroke-linejoin). The wire carries only the icon NAME + optional size/tone/
  // label — same posture as TextNode.style / SectionNode.tone (framework
  // renders, apps describe). See .planning/design/icons-primitive.md §3.
  //
  // A11y contract enforced HERE (a discipline the type's TSDoc + walker also
  // enforce): label present ⇒ role="img" + aria-label; label absent ⇒
  // aria-hidden="true" (decorative).

  private static readonly ICON_SIZE_PX: Record<"xs" | "sm" | "md" | "lg" | "xl", number> = {
    xs: 12, sm: 16, md: 20, lg: 24, xl: 32,
  };

  /** Shared SVG factory used by BOTH the standalone icon() renderer and the
   *  cross-node leading-icon emission on the 5 hosts. The single factory is
   *  the anti-drift lock: an app-side change to icon rendering can only be a
   *  change to this method, not five slightly-different renderers. */
  private renderIconSvg(
    name: IconName,
    size: "xs" | "sm" | "md" | "lg" | "xl",
    tone: "danger" | "warning" | "success" | "info" | undefined,
    label: string | undefined,
  ): SVGElement {
    const px = BrowserAdapter.ICON_SIZE_PX[size];
    // SVG-namespace element is REQUIRED — createElement("svg") produces an
    // HTMLUnknownElement that renders as nothing in real browsers (though jsdom
    // is lenient about it). See risk section of Plan 22-04.
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const classes = ["vms-icon", `vms-icon--${size}`];
    if (tone) classes.push(`vms-icon--${tone}`);
    svg.setAttribute("class", classes.join(" "));
    svg.setAttribute("width", String(px));
    svg.setAttribute("height", String(px));
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    if (label != null && label !== "") {
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", label);
    } else {
      svg.setAttribute("aria-hidden", "true");
    }
    const payload = ICONS[name];
    if (payload == null) {
      // Belt-and-braces: the tree validator already rejects unknown names at
      // buildVm time, but a wire that skips validation would land here at
      // runtime. Match the framework's overall unknown-node posture: warn and
      // emit nothing rather than throw (forward-compatibility).
      console.warn(
        `[viewmodel-shell] Unknown icon name ${JSON.stringify(name)} — ` +
        `rendering an empty svg. The client may be older than the server's icon set.`,
      );
    } else {
      // innerHTML on an SVG element in the SVG namespace parses inner elements
      // as SVG per HTML spec — verified by the jsdom tests (Task 22-04-05) and
      // by real browsers. The payload contains only path/circle/line elements
      // from the framework's own bundle, never user data.
      svg.innerHTML = payload;
    }
    return svg;
  }

  private icon(n: IconNode, parent: HTMLElement): void {
    const size = n.size ?? "md";
    parent.appendChild(this.renderIconSvg(n.name, size, n.tone, n.label));
  }

  /** AvatarNode (v8.0.0, COMP-04) — circular slot with content-resolution
   *  priority image > initials > icon > empty. See CONTEXT §4 / PATTERNS §6
   *  for the LOCKED priority table; the priority is enforced by the if/else
   *  branch order below and mutation-tested in test/avatar-render.test.ts.
   *  Icon-mode reuses `renderIconSvg` verbatim — the same Phase 22 shared
   *  helper every host icon slot uses (anti-drift lock).
   *
   *  Tone applies to initials/icon modes only — the image mode's <img>
   *  element covers the circle background, so a --{tone} class on the wrapper
   *  would be pointless (and the tests assert that <img> does NOT receive a
   *  tone class, only the size class).
   *
   *  A11y: image mode uses <img alt> (empty string is legal for a decorative
   *  image); non-image modes use <div role="img" aria-label>. On initials
   *  mode the label falls back to the initials themselves; on icon/empty it
   *  falls back to "" (decorative — meaning lives elsewhere). */
  private avatar(n: AvatarNode, parent: HTMLElement): void {
    const size = n.size ?? "md";

    // Image mode — <img> element. img displaces the background; alt="" is legal.
    if (n.image != null && n.image !== "") {
      const img = document.createElement("img");
      img.className = `vms-avatar vms-avatar--${size}`;
      img.src = n.image;
      img.alt = n.alt ?? "";
      parent.appendChild(img);
      return;
    }

    // Non-image modes render as <div role="img"> with a computed aria-label
    // per the CONTEXT §4 priority table.
    const el = document.createElement("div");
    const classes = ["vms-avatar", `vms-avatar--${size}`];
    if (n.tone) classes.push(`vms-avatar--${n.tone}`);

    if (n.initials != null && n.initials !== "") {
      el.className = classes.join(" ");
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", n.alt ?? n.initials);
      el.textContent = n.initials;
    } else if (n.icon != null) {
      classes.push("vms-avatar--icon");
      el.className = classes.join(" ");
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", n.alt ?? "");
      // v7.0.0 icon renderer reused — the circle background carries the tone,
      // not the icon stroke (pass tone=undefined so the SVG stays currentColor,
      // which .vms-avatar--icon .vms-icon overrides to #fff). Label=undefined
      // because the outer div owns the aria-label; the inner SVG stays
      // decorative (aria-hidden).
      el.appendChild(this.renderIconSvg(n.icon, size === "sm" ? "sm" : "md", undefined, undefined));
    } else {
      // Empty circle — no visual content, still role="img" for a11y consistency.
      el.className = classes.join(" ");
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", n.alt ?? "");
    }

    parent.appendChild(el);
  }

  /** BreadcrumbNode — a `<nav aria-label="breadcrumb">` landmark wrapping an
   *  `<ol>`. Every crumb but the last navigates (href → `<a>`, action →
   *  dispatching `<button>`); the LAST crumb is the current page, rendered as
   *  plain text with `aria-current="page"` on its `<li>` (position is the
   *  signal — no per-item flag). A framework-drawn, `aria-hidden` separator
   *  sits between items (its glyph is CSS-owned — see default.css). All text is
   *  set via textContent (never innerHTML). */
  private breadcrumb(n: BreadcrumbNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "breadcrumb");
    const ol = document.createElement("ol");
    ol.className = "vms-breadcrumb";
    n.items.forEach((item, i) => {
      const isLast = i === n.items.length - 1;
      const li = document.createElement("li");
      li.className = "vms-breadcrumb__item";
      if (isLast) {
        // Current page: plain, non-clickable, aria-current on the <li>.
        li.setAttribute("aria-current", "page");
        const span = document.createElement("span");
        span.className = "vms-breadcrumb__current";
        span.textContent = item.label;
        li.appendChild(span);
      } else if (item.href != null) {
        // URL navigation — reuse LinkNode's external target/rel handling.
        const a = document.createElement("a");
        a.className = "vms-breadcrumb__link";
        a.href = item.href;
        a.textContent = item.label;
        if (item.external) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }
        li.appendChild(a);
      } else if (item.action) {
        // Server dispatch — a button that fires the action name only.
        const action = item.action;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "vms-breadcrumb__link vms-breadcrumb__link--action";
        btn.textContent = item.label;
        btn.addEventListener("click", () => { on({ name: action.name }); });
        li.appendChild(btn);
      } else {
        // Non-last crumb with neither href nor action — inert label.
        const span = document.createElement("span");
        span.className = "vms-breadcrumb__link";
        span.textContent = item.label;
        li.appendChild(span);
      }
      // Framework-drawn separator after every non-last crumb (glyph via CSS).
      if (!isLast) {
        const sep = document.createElement("span");
        sep.className = "vms-breadcrumb__separator";
        sep.setAttribute("aria-hidden", "true");
        li.appendChild(sep);
      }
      ol.appendChild(li);
    });
    nav.appendChild(ol);
    parent.appendChild(nav);
  }

  /** StepsNode — a discrete stepper. Per-step status DERIVES from `current`
   *  (index < current = done, === current = current, > current = upcoming);
   *  there is NO per-step status field. The framework draws numbered markers
   *  (a check glyph for done), the connector lines, and the intrinsic
   *  horizontal→vertical collapse (CSS). a11y: the group carries an accessible
   *  name; the current step's `<li>` gets `aria-current="step"`; each marker's
   *  state (complete/current/upcoming) rides an `aria-label` so it's never
   *  conveyed by color alone. The stepper is NOT focusable and is NOT
   *  `role="progressbar"` (that's a continuous %). All text via textContent. */
  private steps(n: StepsNode, parent: HTMLElement): void {
    const ol = document.createElement("ol");
    ol.className = n.orientation === "vertical"
      ? "vms-steps vms-steps--vertical"
      : "vms-steps";
    ol.setAttribute("aria-label", "progress");
    n.steps.forEach((step, i) => {
      const state = i < n.current ? "done" : i === n.current ? "current" : "upcoming";
      const li = document.createElement("li");
      li.className = step.tone
        ? `vms-steps__step vms-steps__step--${state} vms-steps__step--toned vms-steps__step--tone-${step.tone}`
        : `vms-steps__step vms-steps__step--${state}`;
      if (state === "current") li.setAttribute("aria-current", "step");

      // Connector — CSS-drawn line marker-center to marker-center, behind the
      // opaque marker (hidden on the first step via CSS).
      const connector = document.createElement("span");
      connector.className = "vms-steps__connector";
      connector.setAttribute("aria-hidden", "true");
      li.appendChild(connector);

      // Marker — number, or a check glyph for done. State rides aria-label so
      // it's not color-only (the aria-label overrides the visual glyph name).
      const marker = document.createElement("span");
      marker.className = "vms-steps__marker";
      marker.setAttribute("aria-label",
        state === "done" ? "complete" : state === "current" ? "current" : "upcoming");
      marker.textContent = state === "done" ? "✓" : String(i + 1);
      li.appendChild(marker);

      // Body — label + optional one-line description.
      const body = document.createElement("span");
      body.className = "vms-steps__body";
      const label = document.createElement("span");
      label.className = "vms-steps__label";
      label.textContent = step.label;
      body.appendChild(label);
      if (step.description != null && step.description !== "") {
        const desc = document.createElement("span");
        desc.className = "vms-steps__description";
        desc.textContent = step.description;
        body.appendChild(desc);
      }
      li.appendChild(body);

      ol.appendChild(li);
    });
    parent.appendChild(ol);
  }

  /** TrackerNode — a status/heat strip: a tight horizontal row of discrete
   *  colored cells, one per time bucket. The framework owns ALL appearance and
   *  a11y (never on the wire): the hairline gap, the intrinsic
   *  shrink-to-a-min-then-scroll overflow, and the baked colorblind-safe palette
   *  (success=blue / danger=red / warning=amber / muted=gray) via the
   *  .vms-tracker__cell--{state} classes. A cell with a `label` carries it as both
   *  the native tooltip AND aria-label (meaning as text, not color-only). A cell
   *  with an `action` becomes a role="button" tabstop with Enter/Space activation
   *  (Space suppresses page scroll), mirroring TableRow.action / SectionNode.action. */
  private tracker(n: TrackerNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const strip = document.createElement("div");
    strip.className = "vms-tracker";
    if (n.id != null) strip.id = n.id;
    // The strip is a graphical status summary — expose it as an img group with a
    // label so a screen reader announces it as one thing; per-cell state is on
    // each cell's aria-label.
    strip.setAttribute("role", "img");
    strip.setAttribute("aria-label", "status tracker");
    for (const cell of n.cells) {
      const state = cell.state ?? "muted";
      const el = document.createElement("div");
      el.className = `vms-tracker__cell vms-tracker__cell--${state}`;
      // tooltip → styled tooltip + aria-label (non-color channel). When absent,
      // the state name is still the a11y fallback so a cell is never color-only.
      // v7.0.0 (ICON-06 / Plan 22-05): the render path was swapped from the
      // native `el.title = ...` gray box to the shipped 6.12.1 TOOL-01
      // .vms-tooltip-host singleton (same styled bubble as ButtonNode.tooltip /
      // TableColumn.tooltip / FieldNode.tooltip / etc. — the 8 hosts already on
      // the styled path). applyTooltip() is the single shared binding: sets
      // el.title (still — screen-reader accessible name), adds
      // .vms-has-tooltip class + data-vms-tooltip attribute, and registers the
      // mouseenter/focusin listeners that drive the body-appended singleton.
      const aria = cell.tooltip != null && cell.tooltip !== "" ? cell.tooltip : state;
      el.setAttribute("aria-label", aria);
      this.applyTooltip(el, cell.tooltip);
      if (cell.action) {
        const action = cell.action;
        el.classList.add("vms-tracker__cell--clickable");
        el.tabIndex = 0;
        el.setAttribute("role", "button");
        el.addEventListener("click", () => { on(action); });
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            on(action);
          } else if (e.key === " " || e.key === "Spacebar") {
            e.preventDefault(); // suppress page scroll
            on(action);
          }
        });
      }
      strip.appendChild(el);
    }
    parent.appendChild(strip);
  }

  /** DiffNode — aligned before/after primitive. Row-kind (add/remove/context)
   *  is derived client-side from the shape of DiffRow: old-only = remove,
   *  new-only = add, matching text = context, differing text = modified pair
   *  (side-by-side shows both cells; unified splits into remove-then-add).
   *  Line-number cells carry the same kind class as their content cell so the
   *  whole row-side reads as one connected colored band. Left-stripe lives only
   *  on the leftmost cell of each colored row-side (linenum cell). In unified
   *  mode the two linenum columns visually collapse into a single left margin
   *  for context rows; for add/remove rows the second linenum keeps its tint so
   *  the color band runs continuously, minus the stripe. Design of record:
   *  `.planning/design/diff-node.md`. Spike-validated 2026-07-19. */
  private diff(n: DiffNode, parent: HTMLElement): void {
    const mode = n.mode ?? "side-by-side";
    const root = document.createElement("div");
    root.className = `vms-diff vms-diff--${mode}`;
    if (n.id != null) root.id = n.id;
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", "Diff");

    // Optional header row(s) — file paths for old / new.
    if (n.header) {
      if (mode === "side-by-side") {
        const hOld = document.createElement("div");
        hOld.className = "vms-diff__header vms-diff__header--old";
        hOld.textContent = n.header.old;
        root.appendChild(hOld);
        const hNew = document.createElement("div");
        hNew.className = "vms-diff__header vms-diff__header--new";
        hNew.textContent = n.header.new;
        root.appendChild(hNew);
      } else {
        const h = document.createElement("div");
        h.className = "vms-diff__header";
        h.textContent = `${n.header.old}  →  ${n.header.new}`;
        root.appendChild(h);
      }
    }

    for (const row of n.rows) {
      const oldCell = row.old ?? null;
      const newCell = row.new ?? null;
      const kindOld: "empty" | "remove" | "context" =
        oldCell == null ? "empty"
          : newCell == null ? "remove"
            : oldCell.text === newCell.text ? "context"
              : "remove";
      const kindNew: "empty" | "add" | "context" =
        newCell == null ? "empty"
          : oldCell == null ? "add"
            : newCell.text === oldCell.text ? "context"
              : "add";

      if (mode === "side-by-side") {
        this._diffCell(root, oldCell?.lineNumber, kindOld, true, "old");
        this._diffCell(root, oldCell?.text, kindOld, false, "old", oldCell?.runs);
        this._diffCell(root, newCell?.lineNumber, kindNew, true, "new");
        this._diffCell(root, newCell?.text, kindNew, false, "new", newCell?.runs);
      } else {
        // Unified: context = one visual row; change = a remove row then an add row.
        if (kindOld === "context") {
          this._diffCell(root, oldCell?.lineNumber, "context", true, "old");
          this._diffCell(root, newCell?.lineNumber, "context", true, "new");
          this._diffCell(root, oldCell?.text, "context", false, "old", oldCell?.runs);
        } else {
          if (oldCell !== null) {
            this._diffCell(root, oldCell?.lineNumber, "remove", true, "old");
            this._diffCell(root, "", "remove", true, "new");
            this._diffCell(root, oldCell?.text, "remove", false, "old", oldCell?.runs);
          }
          if (newCell !== null) {
            this._diffCell(root, "", "add", true, "old");
            this._diffCell(root, newCell?.lineNumber, "add", true, "new");
            this._diffCell(root, newCell?.text, "add", false, "new", newCell?.runs);
          }
        }
      }
    }
    parent.appendChild(root);
  }

  private _diffCell(
    parent: HTMLElement,
    content: string | number | undefined,
    kind: "empty" | "add" | "remove" | "context",
    isLinenum: boolean,
    side: "old" | "new",
    // Optional word-level inline runs (DiffCell.runs). Same contract as
    // TextNode: present ⇒ drawn INSTEAD of `content`. Never passed for linenum
    // gutter cells, which are numeric and aria-hidden.
    runs?: InlineRun[],
  ): void {
    const el = document.createElement("div");
    const parts = ["vms-diff__cell", `vms-diff__cell--${kind}`];
    if (isLinenum) {
      parts.push("vms-diff__cell--linenum");
      parts.push(side === "old" ? "vms-diff__cell--old-linenum" : "vms-diff__cell--new-linenum");
      // Line numbers are visual gutter — hide from SR (the actual content
      // announces on the content cell). Also mark unselectable via CSS.
      el.setAttribute("aria-hidden", "true");
    }
    el.className = parts.join(" ");
    if (runs && runs.length > 0) this.inlineRuns(runs, el);
    else el.textContent = content == null ? "" : String(content);
    parent.appendChild(el);
  }

  // ─── Phase 33 (33-01): typed column-filter popover helpers ──────────────────

  /** Determines the three-state icon grammar for a column's filter.
   *  "empty"    → no active filter (filter-slash glyph)
   *  "simple"   → exactly one contains rule with no matching hints (plain funnel)
   *  "escalated"→ anything more complex (plain funnel + dot)
   */
  private computeFilterState(
    descriptor: FilterDescriptor | null | undefined,
    spec: FilterSpec,
  ): "empty" | "simple" | "escalated" {
    if (descriptor == null || descriptor.rules.length === 0) return "empty";
    const hasMatchingHints = (spec.matchingHints?.length ?? 0) > 0;
    if (
      descriptor.rules.length === 1 &&
      descriptor.rules[0].operator === "contains" &&
      !hasMatchingHints
    ) return "simple";
    return "escalated";
  }

  /** Builds a compact human-readable summary of a nontrivial FilterDescriptor
   *  for the inline read-only display (REQ-CF2-06). Truncated to 40 chars.
   */
  private buildFilterSummary(descriptor: FilterDescriptor): string {
    const joiner = descriptor.joiner === "all-of" ? " AND " : " OR ";
    const parts = descriptor.rules.map(rule => {
      const op = rule.operator;
      const val = rule.value;
      if (op === "is-empty") return "is empty";
      if (op === "is-not-empty") return "is not empty";
      if (op === "is-true") return "yes";
      if (op === "is-false") return "no";
      if (op === "between" && Array.isArray(val)) return `between ${val[0]} and ${val[1]}`;
      if (op === "in-range" && Array.isArray(val)) return `${val[0]} to ${val[1]}`;
      if (val != null) return `${op} "${val}"`;
      return op;
    });
    const full = parts.join(joiner);
    return full.length > 40 ? full.slice(0, 39) + "…" : full;
  }

  /** Returns the default operator for a value kind (used when adding a new rule). */
  private defaultOpForKind(kind: ValueKind): string {
    return kind === "yes-no" ? "is-true" : "contains";
  }

  /** Returns the operator options for a value kind. */
  private operatorsForKind(kind: ValueKind): Array<{ value: string; label: string }> {
    const ops: Record<ValueKind, Array<{ value: string; label: string }>> = {
      "text":      [
        { value: "contains",    label: "Contains" },
        { value: "equals",      label: "Equals" },
        { value: "starts-with", label: "Starts with" },
        { value: "ends-with",   label: "Ends with" },
        { value: "is-empty",    label: "Is empty" },
        { value: "is-not-empty",label: "Is not empty" },
      ],
      "number":    [
        { value: "contains",           label: "Contains" },
        { value: "equals",             label: "Equals" },
        { value: "does-not-equal",     label: "Does not equal" },
        { value: "greater-than",       label: ">" },
        { value: "greater-than-or-equal", label: "≥" },
        { value: "less-than",          label: "<" },
        { value: "less-than-or-equal", label: "≤" },
        { value: "between",            label: "Between" },
        { value: "is-empty",           label: "Is empty" },
        { value: "is-not-empty",       label: "Is not empty" },
      ],
      "date":      [
        { value: "contains",    label: "Contains" },
        { value: "is",          label: "Is" },
        { value: "before",      label: "Before" },
        { value: "after",       label: "After" },
        { value: "in-range",    label: "In range" },
        { value: "is-empty",    label: "Is empty" },
        { value: "is-not-empty",label: "Is not empty" },
      ],
      "fixed-set": [
        { value: "contains",    label: "Contains" },
        { value: "is",          label: "Is" },
        { value: "is-not",      label: "Is not" },
        { value: "is-empty",    label: "Is empty" },
        { value: "is-not-empty",label: "Is not empty" },
      ],
      "yes-no":    [
        { value: "contains",    label: "Contains" },
        { value: "is-true",     label: "Yes" },
        { value: "is-false",    label: "No" },
        { value: "is-empty",    label: "Is empty" },
        { value: "is-not-empty",label: "Is not empty" },
      ],
    };
    return ops[kind] ?? ops["text"];
  }

  /** Returns true if the operator has no value input (it's a boolean/empty test). */
  private isNoValueOperator(op: string): boolean {
    return ["is-empty", "is-not-empty", "is-true", "is-false"].includes(op);
  }

  /** Returns true if the operator takes a range value (2-element array). */
  private isRangeOperator(op: string): boolean {
    return op === "between" || op === "in-range";
  }

  /** Opens the filter popover for a column (REQ-CF2-03, D-01, D-02, D-03).
   *  Called by the filter-button click handler in the new filter row path.
   */
  private openFilterPopover(
    bindPath: string,
    col: TableColumn,
    spec: FilterSpec,
    button: HTMLButtonElement,
    on: (action: ActionEvent) => void,
  ): void {
    // Close any already-open popover (discard its draft)
    this.closeFilterPopover(true);

    // Seed the draft from current state (or a single empty rule if nothing)
    const currentDescriptor = this.sa.read(bindPath) as FilterDescriptor | null | undefined ?? null;
    let draft: FilterDescriptor;
    if (currentDescriptor && currentDescriptor.rules.length > 0) {
      draft = {
        rules: currentDescriptor.rules.map(r => ({ ...r })),
        joiner: currentDescriptor.joiner,
      };
    } else {
      draft = {
        rules: [{ operator: this.defaultOpForKind(spec.kind) as FilterRule["operator"] }],
        joiner: "all-of",
      };
    }
    this.filterDrafts.set(bindPath, draft);

    // Build the popover element
    const popoverEl = document.createElement("div");
    popoverEl.className = "vms-filter-popover";
    popoverEl.setAttribute("role", "dialog");
    popoverEl.setAttribute("aria-label", `Filter ${col.label ?? col.key}`);
    popoverEl.setAttribute("aria-modal", "false");

    // Render initial content
    this.renderFilterPopoverContent(popoverEl, bindPath, col, spec, on);

    // Append to portal (REQ-CF2-05, D-02)
    this.popoverPortal.appendChild(popoverEl);
    this.activePopover = { bindPath, colKey: col.key, button, popoverEl };
    button.setAttribute("aria-expanded", "true");

    // Position immediately (D-03)
    this.positionPopover(button, popoverEl);

    // Outside-click handler (document-level, capture phase): close + discard
    // if the click is not inside the popover and not on the trigger button.
    const outsideClickHandler = (e: Event) => {
      if (!popoverEl.contains(e.target as Node) && e.target !== button) {
        this.closeFilterPopover(true);
        button.focus();
      }
    };
    // Escape key handler: close + discard
    const keyHandler = (e: Event) => {
      if ((e as KeyboardEvent).key === "Escape") {
        this.closeFilterPopover(true);
        button.focus();
      }
    };
    document.addEventListener("mousedown", outsideClickHandler, true);
    document.addEventListener("keydown", keyHandler, true);
    // Combine both handlers under a single removal function for render() preamble
    // cleanup. We track a combined "outside handler" reference for the render
    // preamble to call (it stores the cleanup in popoverOutsideHandler).
    // We need to remove BOTH from document on cleanup, so we store a wrapper:
    const combinedCleanup = () => {
      document.removeEventListener("mousedown", outsideClickHandler, true);
      document.removeEventListener("keydown", keyHandler, true);
    };
    // Store as a pseudo-event-listener for the render() preamble cleanup
    // (the preamble calls removeEventListener with this.popoverOutsideHandler).
    // Since we need to remove TWO listeners, we repurpose the field as a
    // "call this to remove all document listeners" reference via a closure trick:
    // We set popoverOutsideHandler to a dummy that calls combinedCleanup on first
    // invocation. The render() preamble calls its specialized removal using the
    // stored references — but since we changed the approach (storing cleanup as
    // popoverScrollResizeCleanup is the right slot), let's store the doc-listener
    // cleanup there and keep popoverScrollResizeCleanup for resize/scroll.
    // Actually: keep popoverOutsideHandler for the click listener only, and add
    // a dedicated keyHandler field. Since we only have two cleanup slots, we
    // compose them: store ONE cleanup function that removes ALL doc listeners
    // in popoverScrollResizeCleanup. The render() preamble calls it.
    // This is cleaner than the two-listener approach. Let's revise:

    // Reposition on resize / scroll (capture-phase scroll, since the portal
    // is not a descendant of the table's scroll container — D-03).
    const repositionHandler = () => this.positionPopover(button, popoverEl);
    window.addEventListener("resize", repositionHandler);
    window.addEventListener("scroll", repositionHandler, true);

    // Store cleanup for render() preamble. We put doc-listener cleanup here
    // and combine it with the resize/scroll cleanup:
    this.popoverScrollResizeCleanup = () => {
      document.removeEventListener("mousedown", outsideClickHandler, true);
      document.removeEventListener("keydown", keyHandler, true);
      window.removeEventListener("resize", repositionHandler);
      window.removeEventListener("scroll", repositionHandler, true);
    };
    // popoverOutsideHandler is not used for removal here (cleanup is in
    // popoverScrollResizeCleanup). Set to null to avoid render() preamble
    // double-cleanup. The render() preamble checks popoverScrollResizeCleanup.
    this.popoverOutsideHandler = null;
  }

  /** Renders (or re-renders) the content inside the filter popover element.
   *  Called on open and on any in-popover state change (add-rule, op-change).
   */
  private renderFilterPopoverContent(
    popoverEl: HTMLDivElement,
    bindPath: string,
    col: TableColumn,
    spec: FilterSpec,
    on: (action: ActionEvent) => void,
  ): void {
    popoverEl.innerHTML = "";
    const draft = this.filterDrafts.get(bindPath);
    if (!draft) return;

    const operators = this.operatorsForKind(spec.kind);

    // Render each rule
    draft.rules.forEach((rule, idx) => {
      // Joiner toggle between rules (only when > 1 rule, shown BEFORE rule idx > 0)
      if (idx > 0) {
        const joinerDiv = document.createElement("div");
        joinerDiv.className = "vms-filter-joiner";
        const andBtn = document.createElement("button");
        andBtn.type = "button";
        andBtn.textContent = "AND";
        if (draft.joiner === "all-of") andBtn.classList.add("active");
        andBtn.addEventListener("click", () => {
          draft.joiner = "all-of";
          this.renderFilterPopoverContent(popoverEl, bindPath, col, spec, on);
          this.positionPopover(this.activePopover!.button, popoverEl);
        });
        const orBtn = document.createElement("button");
        orBtn.type = "button";
        orBtn.textContent = "OR";
        if (draft.joiner === "any-of") orBtn.classList.add("active");
        orBtn.addEventListener("click", () => {
          draft.joiner = "any-of";
          this.renderFilterPopoverContent(popoverEl, bindPath, col, spec, on);
          this.positionPopover(this.activePopover!.button, popoverEl);
        });
        joinerDiv.appendChild(andBtn);
        joinerDiv.appendChild(orBtn);
        popoverEl.appendChild(joinerDiv);
      }

      const ruleRow = document.createElement("div");
      ruleRow.className = "vms-filter-rule-row";
      ruleRow.style.display = "flex";
      ruleRow.style.gap = "4px";
      ruleRow.style.alignItems = "flex-start";
      ruleRow.style.marginBottom = "4px";

      // Operator select
      const opSelect = document.createElement("select");
      opSelect.className = "vms-filter-op-select";
      operators.forEach(op => {
        const opt = document.createElement("option");
        opt.value = op.value;
        opt.textContent = op.label;
        if (op.value === rule.operator) opt.selected = true;
        opSelect.appendChild(opt);
      });
      opSelect.addEventListener("change", () => {
        draft.rules[idx] = { operator: opSelect.value as FilterRule["operator"] };
        this.renderFilterPopoverContent(popoverEl, bindPath, col, spec, on);
        this.positionPopover(this.activePopover!.button, popoverEl);
      });
      ruleRow.appendChild(opSelect);

      // Value input(s) — hidden for no-value operators
      if (!this.isNoValueOperator(rule.operator)) {
        if (this.isRangeOperator(rule.operator)) {
          // Two inputs for range (between / in-range)
          const rangeVal = Array.isArray(rule.value) ? rule.value : ["", ""];
          const inp0 = document.createElement("input");
          inp0.type = rule.operator === "between" ? "number" : "date";
          inp0.className = "vms-filter-value-input";
          inp0.value = rangeVal[0] != null ? String(rangeVal[0]) : "";
          inp0.placeholder = "From";
          inp0.style.flex = "1";
          inp0.addEventListener("input", () => {
            const cur = Array.isArray(draft.rules[idx].value) ? draft.rules[idx].value as unknown[] : ["", ""];
            draft.rules[idx] = { ...draft.rules[idx], value: [inp0.value, cur[1]] };
          });
          const sep = document.createElement("span");
          sep.textContent = "–";
          sep.style.alignSelf = "center";
          const inp1 = document.createElement("input");
          inp1.type = rule.operator === "between" ? "number" : "date";
          inp1.className = "vms-filter-value-input";
          inp1.value = rangeVal[1] != null ? String(rangeVal[1]) : "";
          inp1.placeholder = "To";
          inp1.style.flex = "1";
          inp1.addEventListener("input", () => {
            const cur = Array.isArray(draft.rules[idx].value) ? draft.rules[idx].value as unknown[] : ["", ""];
            draft.rules[idx] = { ...draft.rules[idx], value: [cur[0], inp1.value] };
          });
          ruleRow.appendChild(inp0);
          ruleRow.appendChild(sep);
          ruleRow.appendChild(inp1);
        } else {
          // Single value input
          const valueInp = this.buildFilterValueInput(spec, rule);
          valueInp.style.flex = "1";
          valueInp.addEventListener("change", () => {
            draft.rules[idx] = { ...draft.rules[idx], value: (valueInp as HTMLInputElement | HTMLSelectElement).value };
          });
          if (valueInp.tagName === "INPUT") {
            (valueInp as HTMLInputElement).addEventListener("input", () => {
              draft.rules[idx] = { ...draft.rules[idx], value: (valueInp as HTMLInputElement).value };
            });
          }
          ruleRow.appendChild(valueInp);
        }
      }

      // Remove-rule button (only for rules after the first)
      if (idx > 0) {
        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "vms-filter-remove-rule";
        removeBtn.setAttribute("aria-label", "Remove rule");
        removeBtn.textContent = "×";
        removeBtn.style.alignSelf = "center";
        removeBtn.addEventListener("click", () => {
          draft.rules.splice(idx, 1);
          this.renderFilterPopoverContent(popoverEl, bindPath, col, spec, on);
          this.positionPopover(this.activePopover!.button, popoverEl);
        });
        ruleRow.appendChild(removeBtn);
      }

      popoverEl.appendChild(ruleRow);
    });

    // Footer: Add rule + Clear + Apply
    const footer = document.createElement("div");
    footer.className = "vms-filter-footer";

    const addRuleBtn = document.createElement("button");
    addRuleBtn.type = "button";
    addRuleBtn.className = "vms-filter-add-rule";
    addRuleBtn.textContent = "+ Add rule";
    addRuleBtn.addEventListener("click", () => {
      draft.rules.push({ operator: this.defaultOpForKind(spec.kind) as FilterRule["operator"] });
      this.renderFilterPopoverContent(popoverEl, bindPath, col, spec, on);
      this.positionPopover(this.activePopover!.button, popoverEl);
    });

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "vms-filter-clear";
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => {
      // Clear writes an empty/null descriptor to state and closes the popover.
      // No named action is dispatched — same state-only contract as inline Enter.
      this.sa.write(bindPath, null);
      this.closeFilterPopover(false);
    });

    const applyBtn = document.createElement("button");
    applyBtn.type = "button";
    applyBtn.className = "vms-filter-apply";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => {
      // Apply: commit the draft to state, then close (no named action dispatch —
      // state update IS the commit; server picks it up on next dispatch).
      const cleanDraft: FilterDescriptor = {
        rules: draft.rules.filter(r => {
          // Drop empty contains rules (user clicked Add Rule but didn't type)
          if (r.operator === "contains" && (r.value == null || r.value === "")) return false;
          return true;
        }),
        joiner: draft.joiner,
      };
      if (cleanDraft.rules.length === 0) {
        this.sa.write(bindPath, null);
      } else {
        this.sa.write(bindPath, cleanDraft);
      }
      this.closeFilterPopover(false);
    });

    footer.appendChild(addRuleBtn);
    footer.appendChild(clearBtn);
    footer.appendChild(applyBtn);
    popoverEl.appendChild(footer);
  }

  /** Builds the value input element for a single filter rule. */
  private buildFilterValueInput(spec: FilterSpec, rule: FilterRule): HTMLInputElement | HTMLSelectElement {
    const op = rule.operator;
    const val = rule.value;

    if (spec.kind === "fixed-set" && (op === "is" || op === "is-not")) {
      // <select> populated from spec.options
      const sel = document.createElement("select");
      sel.className = "vms-filter-value-input";
      (spec.options ?? []).forEach(opt => {
        const o = document.createElement("option");
        o.value = opt;
        o.textContent = opt;
        if (opt === val) o.selected = true;
        sel.appendChild(o);
      });
      return sel;
    }

    const inp = document.createElement("input");
    inp.className = "vms-filter-value-input";

    if (spec.kind === "number" && op !== "contains" && op !== "equals") {
      inp.type = "number";
    } else if (spec.kind === "date" && (op === "is" || op === "before" || op === "after")) {
      inp.type = "date";
    } else {
      inp.type = "text";
    }

    inp.value = val != null ? String(val) : "";
    return inp;
  }

  /** Positions the popover element relative to the trigger button using
   *  position:fixed + getBoundingClientRect() + viewport-edge clamping (D-03).
   */
  private positionPopover(button: HTMLButtonElement, popoverEl: HTMLDivElement): void {
    const rect = button.getBoundingClientRect();
    const gap = 4;

    // Initial placement: directly below the button, left-aligned
    let top = rect.bottom + gap;
    let left = rect.left;

    // Apply initial position so we can measure the popover
    popoverEl.style.position = "fixed";
    popoverEl.style.top = `${top}px`;
    popoverEl.style.left = `${left}px`;
    popoverEl.style.visibility = "hidden"; // hide while measuring
    popoverEl.style.display = "block";

    // Measure the popover (now it's in the DOM and positioned)
    const pr = popoverEl.getBoundingClientRect();

    // Right-edge clamp: nudge left if off right edge
    if (pr.right > window.innerWidth - gap) {
      left = Math.max(gap, left - (pr.right - (window.innerWidth - gap)));
    }

    // Bottom-edge clamp: flip above if too tall, else clamp to top with scroll
    if (pr.bottom > window.innerHeight - gap) {
      const flipTop = rect.top - pr.height - gap;
      if (flipTop >= gap) {
        top = flipTop; // flip above the trigger
      } else {
        top = gap; // clamp to near-top; CSS max-height + overflow-y:auto handles internal scroll
      }
    }

    popoverEl.style.top = `${top}px`;
    popoverEl.style.left = `${left}px`;
    popoverEl.style.visibility = ""; // restore visibility
  }

  /** Closes the filter popover, optionally discarding (not committing) the draft.
   *  Called by: outside-click, Escape, Apply button, Clear button, render() preamble.
   */
  private closeFilterPopover(discard: boolean): void {
    if (!this.activePopover) return;

    // discard = true → drop the draft without committing (outside-click, Escape)
    // discard = false → draft has already been committed to state (Apply/Clear)
    // Either way, remove the popover DOM and clear state.

    const { button, popoverEl } = this.activePopover;

    // Remove popover from portal
    if (popoverEl.parentNode) popoverEl.parentNode.removeChild(popoverEl);

    // Restore button state
    button.setAttribute("aria-expanded", "false");

    // Clear all listeners (popoverScrollResizeCleanup covers all of them)
    if (this.popoverScrollResizeCleanup) {
      this.popoverScrollResizeCleanup();
      this.popoverScrollResizeCleanup = null;
    }
    if (this.popoverOutsideHandler) {
      // Belt-and-braces: remove the listener if it was set via the old path
      document.removeEventListener("mousedown", this.popoverOutsideHandler, true);
      this.popoverOutsideHandler = null;
    }

    this.activePopover = null;
  }
}
