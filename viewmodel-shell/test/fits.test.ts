// Phase 10 (FITS-01) — FitsNode jsdom coverage.
//
// ⚠️ The REAL measure-and-pick selection (render each candidate, force a
// reflow, compare scrollWidth/clientWidth on the axis, keep the first that
// fits) CANNOT be unit-tested in jsdom: jsdom has NO layout engine, so it
// reports clientWidth/scrollWidth as 0 for every element. There is no way to
// drive the "candidate B fits but candidate A overflows" branch in this
// environment. These tests therefore cover only:
//   - STRUCTURE: a fits node renders a `.vms-fits` container element
//   - NO-LAYOUT FALLBACK: clientWidth===0 ⇒ the LAST (safe-fallback) child is
//     the one rendered (the jsdom / SSR / detached path)
//   - AXIS ACCEPTANCE: "horizontal" | "vertical" | "both" + omitted all render
//     without throwing (proves the field is accepted across its union + the
//     omitted-default path)
//   - RESIZEOBSERVER LIFECYCLE: one observer registered per fits container, and
//     ALL disconnected when the next render rebuilds the tree (leak prevention)
//
// The REAL container-relative selection behavior (operator resizes a browser
// and confirms the candidate switches) is verified by the Phase 11 HUMAN
// REVIEW, not by this suite.
//
// Same harness shape as theme-modifiers.test.ts / section-collapsible.test.ts.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

function renderInto(adapter: BrowserAdapter, vm: ViewNode): void {
  adapter.render(vm, () => {});
}

function text(value: string): ViewNode {
  return { type: "text", value };
}

// ─── Stubbed ResizeObserver (lifecycle assertions only) ──────────────────────
// Records observe()/disconnect() calls. The constructor accepts (and ignores)
// the callback so `new ResizeObserver(() => pick())` works; the callback is
// NEVER invoked here — real measure-and-pick is jsdom-untestable (see header),
// so the stub exists purely to assert the observe/disconnect lifecycle.
interface StubInstance {
  observeCount: number;
  disconnectCount: number;
}
let stubInstances: StubInstance[];
let RealResizeObserver: typeof ResizeObserver | undefined;

class StubResizeObserver {
  instance: StubInstance;
  constructor(_cb: ResizeObserverCallback) {
    this.instance = { observeCount: 0, disconnectCount: 0 };
    stubInstances.push(this.instance);
  }
  observe(): void {
    this.instance.observeCount++;
  }
  unobserve(): void {}
  disconnect(): void {
    this.instance.disconnectCount++;
  }
}

beforeEach(() => {
  stubInstances = [];
  RealResizeObserver = globalThis.ResizeObserver;
  // @ts-expect-error — minimal stub for lifecycle assertions
  globalThis.ResizeObserver = StubResizeObserver;
  // jsdom does not implement window.scrollTo; render() calls it for scroll
  // preservation. Stub it to a no-op so the unrelated "Not implemented" noise
  // doesn't clutter output (same approach as browser-scroll.test.ts).
  window.scrollTo = () => {};
});

afterEach(() => {
  // @ts-expect-error — restore (may be undefined in jsdom)
  globalThis.ResizeObserver = RealResizeObserver;
});

describe("FitsNode — structure", () => {
  it("renders a .vms-fits container element", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "fits",
      children: [text("A"), text("B"), text("C")],
    });
    const fits = container.querySelector(".vms-fits");
    expect(fits).not.toBeNull();
    expect((fits as HTMLElement).tagName).toBe("DIV");
  });
});

describe("FitsNode — no-layout fallback (jsdom clientWidth === 0)", () => {
  it("renders ONLY the LAST child when measurement is unavailable", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "fits",
      children: [text("FIRST"), text("MIDDLE"), text("LAST")],
    });
    const fits = container.querySelector(".vms-fits") as HTMLElement;
    expect(fits.textContent).toBe("LAST");
    expect(fits.textContent).not.toContain("FIRST");
    expect(fits.textContent).not.toContain("MIDDLE");
    // Exactly one child rendered (the fallback), not the whole candidate list.
    expect(fits.querySelectorAll(".vms-text").length).toBe(1);
  });

  it("renders the last child for distinguishable section candidates too", () => {
    const container = freshContainer();
    const section = (heading: string): ViewNode => ({
      type: "section",
      heading,
      children: [],
    });
    renderInto(new BrowserAdapter(container), {
      type: "fits",
      children: [section("WIDE"), section("NARROW")],
    });
    const fits = container.querySelector(".vms-fits") as HTMLElement;
    expect(fits.textContent).toContain("NARROW");
    expect(fits.textContent).not.toContain("WIDE");
  });
});

describe("FitsNode — axis acceptance", () => {
  for (const axis of ["horizontal", "vertical", "both"] as const) {
    it(`accepts axis:"${axis}" and renders the .vms-fits container (last child under jsdom)`, () => {
      const container = freshContainer();
      expect(() =>
        renderInto(new BrowserAdapter(container), {
          type: "fits",
          axis,
          children: [text("FIRST"), text("LAST")],
        }),
      ).not.toThrow();
      const fits = container.querySelector(".vms-fits") as HTMLElement;
      expect(fits).not.toBeNull();
      expect(fits.textContent).toBe("LAST");
    });
  }

  it("accepts an OMITTED axis (defaults to horizontal) and renders the container", () => {
    const container = freshContainer();
    expect(() =>
      renderInto(new BrowserAdapter(container), {
        type: "fits",
        children: [text("FIRST"), text("LAST")],
      }),
    ).not.toThrow();
    const fits = container.querySelector(".vms-fits") as HTMLElement;
    expect(fits).not.toBeNull();
    expect(fits.textContent).toBe("LAST");
  });
});

describe("FitsNode — ResizeObserver lifecycle", () => {
  it("registers exactly one ResizeObserver (observe called once) per fits container", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "fits",
      children: [text("A"), text("B")],
    });
    expect(stubInstances.length).toBe(1);
    expect(stubInstances[0].observeCount).toBe(1);
    expect(stubInstances[0].disconnectCount).toBe(0);
  });

  it("disconnects the prior observer when the next render omits the fits node", () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    renderInto(adapter, { type: "fits", children: [text("A"), text("B")] });
    expect(stubInstances.length).toBe(1);
    expect(stubInstances[0].disconnectCount).toBe(0);

    // Re-render a tree WITHOUT a fits node — the prior observer must disconnect.
    renderInto(adapter, { type: "text", value: "no fits here" });
    expect(stubInstances[0].disconnectCount).toBe(1);
    // No new observer was registered for the fits-less tree.
    expect(stubInstances.length).toBe(1);
    expect(container.querySelector(".vms-fits")).toBeNull();
  });

  it("registers two observers for two fits nodes and disconnects BOTH on the next render", () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    renderInto(adapter, {
      type: "page",
      children: [
        { type: "fits", children: [text("A1"), text("B1")] },
        { type: "fits", children: [text("A2"), text("B2")] },
      ],
    });
    expect(stubInstances.length).toBe(2);
    expect(stubInstances.every(i => i.observeCount === 1)).toBe(true);
    expect(stubInstances.every(i => i.disconnectCount === 0)).toBe(true);

    renderInto(adapter, { type: "text", value: "cleared" });
    expect(stubInstances.length).toBe(2);
    expect(stubInstances.every(i => i.disconnectCount === 1)).toBe(true);
  });
});
