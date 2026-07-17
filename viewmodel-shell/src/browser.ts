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
  TextNode, LinkNode, ImageNode, StatBarNode, TabsNode, ProgressNode,
  ModalNode, TableNode, CopyButtonNode, DividerNode, FitsNode,
  EmptyStateNode, BadgeNode, ChartNode,
  BreadcrumbNode, StepsNode,
} from "./index.js";

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

  constructor(private container: HTMLElement) {}

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

    // Phase 12 (CHART-01/03) — reset the per-render chart bookkeeping (NOT
    // chartInstances, which is deliberately persistent). Same per-render reset
    // model as sectionKeyCounter: keys must compute identically across the
    // rebuild + the post-rebuild mark-sweep below.
    this.chartKeyCounter = new Map();
    this.chartKeysSeen = new Set();

    this.container.innerHTML = "";
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
      case "empty-state":  return this.emptyState(n, parent, on);
      case "badge":        return this.badge(n, parent);
      case "chart":        return this.chart(n, parent);
      case "breadcrumb":   return this.breadcrumb(n, parent, on);
      case "steps":        return this.steps(n, parent);
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
        n.variant === "card" ? " vms-section--card" : ""}${
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
      // Initial render is always closed — the post-render restore loop in
      // render() re-applies `open=true` for keys the user had open before.

      const summary = document.createElement("summary");
      summary.className = "vms-section__summary";
      // Headingless fallback label — documented in TSDoc on
      // SectionNode.collapsible and in AGENTS.md "Non-obvious framework
      // behaviors". Choice locked.
      summary.textContent = n.heading ?? "Show details";
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
        n.variant === "card" ? " vms-section--card" : ""}${
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
      // Mirror LinkNode's external-attribute pattern (browser.ts ~line 666)
      // byte-for-byte: target=_blank + rel=noopener noreferrer when external.
      if (n.link.external) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
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
    el.className = `vms-section${n.variant === "card" ? " vms-section--card" : ""}${
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
    // SectionNode.followTail — mark this as an append-only feed so render()'s
    // snapshot/restore keeps its newest content in view (see render() + the
    // FOLLOW_TAIL_STICK_THRESHOLD_PX constant). No CSS/class — the scroll comes
    // from the element already being an overflow region (pair with fill).
    if (n.followTail === true) el.dataset.followTail = "";
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
    const ul = document.createElement("ul");
    ul.className = "vms-list";
    if (n.id) ul.id = n.id;
    this.kids(n.children, ul, on);
    parent.appendChild(ul);
  }

  private listItem(n: ListItemNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const li = document.createElement("li");
    li.className = `vms-list-item${n.state ? ` vms-list-item--${n.state}` : ""}${
      n.tone ? ` vms-list-item--${n.tone}` : ""}`;
    if (n.id) li.dataset.id = n.id;
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
      // byte-for-byte the cadence `TableNode.filterAction` has always used
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
    lbl.className = "vms-checkbox";
    const inp = document.createElement("input");
    inp.type = "checkbox";
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
    btn.addEventListener("click", activate);
    parent.appendChild(btn);
  }

  private text(n: TextNode, parent: HTMLElement): void {
    const el = document.createElement(n.style === "pre" ? "pre" : "span");
    el.className = `vms-text${n.style ? ` vms-text--${n.style}` : ""}${n.tone ? ` vms-text--${n.tone}` : ""}`;
    el.textContent = n.value;
    parent.appendChild(el);
  }

  private link(n: LinkNode, parent: HTMLElement): void {
    const a = document.createElement("a");
    a.className = n.active ? "vms-link vms-link--active" : "vms-link";
    a.href = n.href;
    a.textContent = n.label;
    if (n.active) a.setAttribute("aria-current", "page");
    if (n.external) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
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
    parent.appendChild(img);
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
   *  sortActions[col.key]; filter inputs are bound to filterBinds[col.key],
   *  every keystroke writes, Enter dispatches filterAction; pagination
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
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const hasFilters = n.columns.some(c => c.filterable) && !!n.filterAction;
    if (hasFilters) {
      const filterAction = n.filterAction!;
      const filterRow = document.createElement("tr");
      filterRow.className = "vms-table__filter-row";
      if (tableHasCheckboxes) {
        filterRow.appendChild(document.createElement("th"));
      }
      n.columns.forEach(col => {
        const th = document.createElement("th");
        if (col.filterable) {
          const inp = document.createElement("input");
          inp.type = "text";
          inp.className = "vms-table__filter-input";
          inp.dataset.col = col.key;
          // Stable id so render()'s focus+caret restore can re-find this input
          // after a re-render — critical because a silent poll can fire mid-
          // keystroke while the user is typing a filter (the canonical
          // workflow-table pattern). Without an id the value survives (it's
          // bound state) but focus/caret are lost on every poll tick.
          inp.id = `vms-tablefilter-${col.key}`;
          const bindPath = n.filterBinds?.[col.key];
          const bound = bindPath != null ? this.sa.read(bindPath) : undefined;
          inp.value = bound != null
            ? String(bound)
            : (col.filterValue ?? "");
          inp.placeholder = `Filter…`;
          if (bindPath != null) {
            inp.addEventListener("input", () => { this.sa.write(bindPath, inp.value); });
          }
          inp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              if (bindPath != null) this.sa.write(bindPath, inp.value);
              on(filterAction);
            }
          });
          th.appendChild(inp);
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
    btn.addEventListener("click", () => {
      const write = navigator.clipboard?.writeText(n.text);
      if (write) {
        write.then(() => {
          btn.textContent = n.copiedLabel ?? "Copied!";
          setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
        }).catch(() => {
          if (legacyCopy(n.text)) {
            btn.textContent = n.copiedLabel ?? "Copied!";
            setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
          }
        });
      } else {
        if (legacyCopy(n.text)) {
          btn.textContent = n.copiedLabel ?? "Copied!";
          setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
        }
      }
    });
    parent.appendChild(btn);
  }

  /** EmptyStateNode — a centered "nothing here" block: a heading, an optional
   *  message, then the optional CTA ButtonNode (rendered via the shared button
   *  renderer so it dispatches like any other button). */
  private emptyState(n: EmptyStateNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const el = document.createElement("div");
    el.className = "vms-empty-state";

    const heading = document.createElement("div");
    heading.className = "vms-empty-state__heading";
    heading.textContent = n.heading;
    el.appendChild(heading);

    if (n.message != null && n.message !== "") {
      const msg = document.createElement("div");
      msg.className = "vms-empty-state__message";
      msg.textContent = n.message;
      el.appendChild(msg);
    }

    if (n.action) this.button(n.action, el, on);

    parent.appendChild(el);
  }

  /** BadgeNode — a compact inline status pill / count. Leaf node: label text +
   *  tone/emphasis modifier classes. */
  private badge(n: BadgeNode, parent: HTMLElement): void {
    const span = document.createElement("span");
    span.className = `vms-badge${n.tone ? ` vms-badge--${n.tone}` : ""}${
      n.emphasis ? ` vms-badge--${n.emphasis}` : ""}`;
    span.textContent = n.label;
    parent.appendChild(span);
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
}
