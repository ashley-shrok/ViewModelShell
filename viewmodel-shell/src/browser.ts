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
  EmptyStateNode, BadgeNode,
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

    this.container.innerHTML = "";
    this.node(vm, this.container, onAction);

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
      const actionName = n.action.name;
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
      el.addEventListener("click", () => { on({ name: actionName }); });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          on({ name: actionName });
        } else if (e.key === " " || e.key === "Spacebar") {
          e.preventDefault(); // suppress page scroll
          on({ name: actionName });
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
    this.kids(n.children, form, on);

    const dispatchWithFiles = (action: ActionEvent): void => {
      const files: Record<string, File> = {};
      form.querySelectorAll<HTMLInputElement>("input[type=file]").forEach(inp => {
        if (inp.name && inp.files?.[0]) files[inp.name] = inp.files[0];
      });
      const ev: ActionEvent = { name: action.name };
      if (Object.keys(files).length > 0) ev.files = files;
      on(ev);
    };

    // #22 — submitButton takes precedence: the form renders the consumer's own
    // button (its label + emphasis/tone/size/width) as the submit and fires its
    // action; submitLabel/submitAction for the implicit button are then ignored.
    const sb = n.submitButton;
    const effectiveSubmit = sb ? sb.action : n.submitAction;
    if (sb) {
      const submitAction = sb.action;
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = `vms-button${sb.emphasis ? ` vms-button--${sb.emphasis}` : ""}${
        sb.tone ? ` vms-button--${sb.tone}` : ""}${sb.size ? ` vms-button--${sb.size}` : ""}${
        sb.width === "full" ? " vms-button--full" : ""}`;
      submit.textContent = sb.label;
      form.appendChild(submit);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        dispatchWithFiles(submitAction);
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
  private field(n: FieldNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const stateValue = this.sa.read(n.bind);

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
        this.sa.write(n.bind, inp.checked);
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
          this.sa.write(n.bind, Array.from(sel.selectedOptions, o => o.value));
        }
      } else if (stateValue === undefined || String(stateValue) !== sel.value) {
        this.sa.write(n.bind, sel.value);
      }
      sel.addEventListener("change", () => {
        if (isMulti) {
          const arr = Array.from(sel.selectedOptions).map(o => o.value);
          this.sa.write(n.bind, arr);
        } else {
          this.sa.write(n.bind, sel.value);
        }
        if (n.action) on({ name: n.action.name });
      });
      wrapper.appendChild(sel);
    } else if (n.inputType === "file") {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.className = "vms-field__input";
      inp.id = `vms-${n.name}`;
      inp.name = n.name;
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
          // Per Phase-6 decision: the picked file is visible in state as a
          // serialization-safe placeholder; the binary travels on the
          // multipart side channel.
          this.sa.write(n.bind, { filename: file.name, size: file.size });
        } else {
          this.fileRegistry.delete(n.name);
          this.sa.write(n.bind, null);
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
      ta.addEventListener("input", () => { this.sa.write(n.bind, ta.value); });
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
      ta.addEventListener("input", () => { this.sa.write(n.bind, ta.value); });
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = ta.selectionStart ?? 0;
          const end   = ta.selectionEnd   ?? 0;
          ta.value = ta.value.slice(0, start) + "\t" + ta.value.slice(end);
          ta.selectionStart = ta.selectionEnd = start + 1;
          this.sa.write(n.bind, ta.value);
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
      inp.addEventListener("input", () => { this.sa.write(n.bind, inp.value); });
      if (n.action) {
        const action = n.action;
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // Belt-and-suspenders: flush the latest value to state before
            // dispatching, in case the browser hasn't fired `input` yet
            // (e.g. an autofill that lands then submits).
            this.sa.write(n.bind, inp.value);
            on({ name: action.name });
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
      if (n.action) on({ name: n.action.name });
    });
    parent.appendChild(lbl);
  }

  private button(n: ButtonNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `vms-button${n.emphasis ? ` vms-button--${n.emphasis}` : ""}${
      n.tone ? ` vms-button--${n.tone}` : ""}${n.size ? ` vms-button--${n.size}` : ""}${
      n.width === "full" ? " vms-button--full" : ""}${
      n.disabled ? " vms-button--disabled" : ""}`;
    btn.textContent = n.label;
    if (n.disabled) btn.disabled = true;
    btn.addEventListener("click", () => {
      // Forms-completeness (3.4.0): a disabled button never dispatches. (Native
      // `disabled` already suppresses the click, but guard anyway in case the
      // attribute was cleared out-of-band.)
      if (n.disabled) return;
      // pendingLabel: instant client-side feedback. Swap text + add
      // .vms-button--pending BEFORE handing off to the dispatcher. On
      // success the next render replaces the button entirely. On dispatch
      // error, the shell re-renders so the original label snaps back.
      if (n.pendingLabel) {
        btn.textContent = n.pendingLabel;
        btn.classList.add("vms-button--pending");
      }
      on(n.action);
    });
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
        on({ name: tab.action.name });
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
          on({ name: sortAction.name });
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
              on({ name: filterAction.name });
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
        const rowActionName = row.action.name;
        tr.tabIndex = 0;
        tr.setAttribute("role", "button");
        const labelParts = Object.values(row.cells)
          .filter(v => v && v.trim())
          .map(v => v.trim());
        const ariaLabel = labelParts.length > 0
          ? labelParts.join(" · ")
          : (row.id ? `Row ${row.id}` : "");
        if (ariaLabel) tr.setAttribute("aria-label", ariaLabel);
        tr.addEventListener("click", () => { on({ name: rowActionName }); });
        tr.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            on({ name: rowActionName });
          } else if (e.key === " " || e.key === "Spacebar") {
            e.preventDefault(); // suppress page scroll
            on({ name: rowActionName });
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
            on({ name: action.name });
          });
        }
        return b;
      };
      const prevDisabled = pg.page <= 1 || pg.prevAction == null;
      const nextDisabled = pg.page >= totalPages || pg.nextAction == null;
      footer.appendChild(mkBtn("‹ Prev", pg.page - 1, pg.prevAction, prevDisabled));
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
}
