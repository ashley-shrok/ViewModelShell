// Phase 12 (CHART-01..05) — ChartNode jsdom coverage.
//
// ⚠️ jsdom has NO canvas 2D context, so a REAL Chart.js instance cannot be
// created under jsdom. These tests MOCK chart.js (vi.mock) and assert on the
// INTEGRATION SEAM, not on rendered pixels:
//   - STRUCTURE: a ChartNode renders a `.vms-chart` wrapper containing a <canvas>
//   - BAR CONFIG: the mocked Chart is constructed ONCE with type:"bar",
//     data.labels + data.datasets[0].data derived from `points`, and the
//     tree-shaken `register` is called (only the bar pieces)
//   - REDRAW-IN-PLACE (CHART-03): a re-render with CHANGED data reuses the SAME
//     instance — `.update()` is called and Chart is NOT re-constructed
//   - REMOVAL MARK-SWEEP: dropping the ChartNode from the next tree calls the
//     prior instance's `.destroy()` and removes it from the registry (no leak)
//   - VALIDATOR NO-BLIND-SPOT (CHART-05): a tree containing a ChartNode passes
//     BOTH validateActionNames + validateSectionAction without throwing
//
// The FAIL-LOUD-on-missing-chart.js path lives in the sibling file
// `chart-missing-dep.test.ts` — it needs the `import("chart.js")` to REJECT,
// which is cleanest in its own module registry (vitest isolates mocks per file).
//
// The REAL rendered chart (bars, colors, title) is verified by the Phase 13
// operator BROWSER REVIEW (CHART-06), not by this suite.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";
import { validateActionNames, validateSectionAction } from "../src/server.js";

// Shared controller (hoisted so the vi.mock factory below can reference it).
const h = vi.hoisted(() => {
  const constructed: Array<{ canvas: unknown; config: any; instance: FakeChart }> = [];
  let registerCalls = 0;
  class FakeChart {
    data: any;
    options: any;
    updateCount = 0;
    destroyCount = 0;
    constructor(canvas: unknown, config: any) {
      this.data = config?.data;
      this.options = config?.options;
      constructed.push({ canvas, config, instance: this });
    }
    update(): void { this.updateCount++; }
    destroy(): void { this.destroyCount++; }
    static register(): void { registerCalls++; }
  }
  return {
    constructed,
    get registerCalls() { return registerCalls; },
    resetRegisterCalls() { registerCalls = 0; },
    FakeChart,
  };
});

vi.mock("chart.js", () => ({
  Chart: h.FakeChart,
  BarController: {},
  BarElement: {},
  CategoryScale: {},
  LinearScale: {},
  Tooltip: {},
}));

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

// loadChart awaits `import("chart.js")`, so tests MUST flush the microtask/task
// queue before asserting on the constructed instance. A macrotask tick is the
// robust flush (covers the awaited dynamic-import resolution).
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
  h.constructed.length = 0;
  h.resetRegisterCalls();
  window.scrollTo = () => {};
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChartNode — structure", () => {
  it("renders a .vms-chart wrapper containing a <canvas>", async () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      { type: "chart", points: [{ label: "A", value: 3 }] },
      () => {},
    );
    const wrap = container.querySelector(".vms-chart");
    expect(wrap).not.toBeNull();
    expect((wrap as HTMLElement).tagName).toBe("DIV");
    expect(wrap!.querySelector("canvas")).not.toBeNull();
  });
});

describe("ChartNode — Chart.js bar config (mocked)", () => {
  it("constructs exactly one bar Chart with labels + data from points, and registers", async () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      { type: "chart", points: [{ label: "A", value: 3 }, { label: "B", value: 7 }], tone: "success" },
      () => {},
    );
    await flush();
    expect(h.constructed.length).toBe(1);
    const cfg = h.constructed[0].config;
    expect(cfg.type).toBe("bar");
    expect(cfg.data.labels).toEqual(["A", "B"]);
    expect(cfg.data.datasets[0].data).toEqual([3, 7]);
    // Single-series → no legend; tree-shaken registration ran.
    expect(cfg.options.plugins.legend.display).toBe(false);
    expect(h.registerCalls).toBeGreaterThanOrEqual(1);
  });

  it("renders the title into the chart title config when provided", async () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      { type: "chart", title: "Sales", points: [{ label: "A", value: 1 }] },
      () => {},
    );
    await flush();
    expect(h.constructed[0].config.options.plugins.title).toEqual({ display: true, text: "Sales" });
  });
});

describe("ChartNode — redraw-in-place via .update() (CHART-03)", () => {
  it("reuses the instance and calls .update() on a re-render with changed data (no reconstruct)", async () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    adapter.render(
      { type: "chart", title: "T", points: [{ label: "A", value: 3 }, { label: "B", value: 7 }] },
      () => {},
    );
    await flush();
    expect(h.constructed.length).toBe(1);
    const inst = h.constructed[0].instance;
    expect(inst.updateCount).toBe(0);

    // Re-render the SAME chart (same stable key) with CHANGED values.
    adapter.render(
      { type: "chart", title: "T", points: [{ label: "A", value: 5 }, { label: "B", value: 9 }] },
      () => {},
    );
    await flush();
    // No second Chart constructed; the existing one was updated in place.
    expect(h.constructed.length).toBe(1);
    expect(inst.updateCount).toBe(1);
    expect(inst.data.datasets[0].data).toEqual([5, 9]);
  });
});

describe("ChartNode — removal mark-sweep (.destroy())", () => {
  it("destroys the instance and drops it from the registry when the next tree omits the chart", async () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    adapter.render(
      { type: "chart", title: "T", points: [{ label: "A", value: 3 }] },
      () => {},
    );
    await flush();
    const inst = h.constructed[0].instance;
    expect(inst.destroyCount).toBe(0);

    // Re-render a tree WITHOUT the chart — mark-sweep must destroy it.
    adapter.render({ type: "text", value: "no chart here" }, () => {});
    await flush();
    expect(inst.destroyCount).toBe(1);
    expect(container.querySelector(".vms-chart")).toBeNull();

    // Re-adding the SAME-keyed chart constructs a FRESH instance (old was swept).
    adapter.render(
      { type: "chart", title: "T", points: [{ label: "A", value: 3 }] },
      () => {},
    );
    await flush();
    expect(h.constructed.length).toBe(2);
  });
});

describe("ChartNode — validator no-blind-spot (CHART-05)", () => {
  it("passes validateActionNames + validateSectionAction (childless action-free leaf)", () => {
    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "chart", title: "T", points: [{ label: "A", value: 3 }] },
        { type: "button", label: "Go", action: { name: "go" } },
      ],
    };
    expect(() => validateActionNames(tree)).not.toThrow();
    expect(() => validateSectionAction(tree)).not.toThrow();
  });

  it("a ChartNode adds no action, so it never triggers a duplicate-action-name error", () => {
    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "chart", points: [{ label: "A", value: 1 }] },
        { type: "chart", points: [{ label: "B", value: 2 }] },
        { type: "button", label: "Only", action: { name: "only" } },
      ],
    };
    expect(() => validateActionNames(tree)).not.toThrow();
  });
});
