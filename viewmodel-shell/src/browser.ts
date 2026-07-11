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
  // Per-render disambiguator for chart keys (title-derived or anonymous). Reset
  // at the TOP of every render() (like sectionKeyCounter) so snapshot keys and
  // rebuild keys compute identically across a render pass.
  private chartKeyCounter = new Map<string, number>();
  // Per-render set of every chart key rendered this pass. Reset at the TOP of
  // every render(); render() mark-sweeps any chartInstances key NOT in this set
  // (a ChartNode removed from the new tree → its Chart instance is destroyed).
  private chartKeysSeen = new Set<string>();

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

    // Phase 10 (FITS-01) — disconnect every ResizeObserver registered by the
    // prior render's fits() calls before the tree is rebuilt (leak prevention).
    // Same per-render reset model as the focus/scroll/details snapshots above.
    this.fitsObservers.forEach(o => o.disconnect());
    this.fitsObservers = [];

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
    const describedBy: string[] = [];
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
      item.className = "vms-stat-bar__item";
      const val = document.createElement("span");
      val.className = "vms-stat-bar__value";
      val.textContent = String(stat.value);
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
      li.className = `vms-steps__step vms-steps__step--${state}`;
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
