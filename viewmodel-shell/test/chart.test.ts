// Phase 18 (CHARTBASE-02/03) — ChartNode jsdom coverage for the reshaped
// multi-series base set: { kind?, labels: string[], series: ChartSeries[],
// stacked?, title? }.
//
// ⚠️ jsdom has NO canvas 2D context, so a REAL Chart.js instance cannot be
// created under jsdom. These tests MOCK chart.js (vi.mock) and assert on the
// INTEGRATION SEAM, not on rendered pixels:
//   - STRUCTURE: a ChartNode renders a `.vms-chart` wrapper containing a <canvas>
//   - BAR CONFIG (multi-series): the mocked Chart is constructed ONCE with
//     type:"bar", one dataset per series (label/data mapped 1:1), and the
//     tree-shaken `register` is called
//   - STACKED: `stacked:true` sets both axis `stacked` flags; omitted → not stacked
//   - KIND MAPPING: line/area → Chart type "line" (area sets fill:true per
//     dataset); pie → "pie"; donut → "doughnut"
//   - PALETTE / TONE: a tone-less series resolves a --vms-chart-N palette slot;
//     a tone-bearing series resolves its tone token instead
//   - PIE/DONUT EXTRA SERIES: >1 series triggers exactly one console.warn and
//     still renders series[0] with a per-slice color array
//   - REDRAW-IN-PLACE: a re-render with CHANGED data reuses the SAME instance —
//     `.update()` is called and Chart is NOT re-constructed
//   - REMOVAL MARK-SWEEP: dropping the ChartNode from the next tree calls the
//     prior instance's `.destroy()` and removes it from the registry (no leak)
//   - VALIDATOR NO-BLIND-SPOT: a tree containing a ChartNode passes BOTH
//     validateActionNames + validateSectionAction without throwing
//
// The FAIL-LOUD-on-missing-chart.js path lives in the sibling file
// `chart-missing-dep.test.ts` — it needs the `import("chart.js")` to REJECT,
// which is cleanest in its own module registry (vitest isolates mocks per file).
//
// The REAL rendered chart (bars, colors, title) is verified by the operator
// BROWSER REVIEW (Phase 19), not by this suite.
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
  BarController: {}, BarElement: {},
  LineController: {}, LineElement: {}, PointElement: {}, Filler: {},
  PieController: {}, DoughnutController: {}, ArcElement: {},
  CategoryScale: {}, LinearScale: {},
  Tooltip: {}, Legend: {},
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
      { type: "chart", labels: ["A"], series: [{ name: "S1", data: [3] }] },
      () => {},
    );
    const wrap = container.querySelector(".vms-chart");
    expect(wrap).not.toBeNull();
    expect((wrap as HTMLElement).tagName).toBe("DIV");
    expect(wrap!.querySelector("canvas")).not.toBeNull();
  });
});

describe("ChartNode — multi-series bar config (mocked)", () => {
  it("constructs one bar Chart with a dataset per series (label/data 1:1), and registers", async () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      {
        type: "chart",
        labels: ["Jan", "Feb"],
        series: [
          { name: "Revenue", data: [30, 45] },
          { name: "Costs", data: [10, 15] },
        ],
      },
      () => {},
    );
    await flush();
    expect(h.constructed.length).toBe(1);
    const cfg = h.constructed[0].config;
    expect(cfg.type).toBe("bar");
    expect(cfg.data.labels).toEqual(["Jan", "Feb"]);
    expect(cfg.data.datasets.length).toBe(2);
    expect(cfg.data.datasets[0].label).toBe("Revenue");
    expect(cfg.data.datasets[0].data).toEqual([30, 45]);
    expect(cfg.data.datasets[1].label).toBe("Costs");
    expect(cfg.data.datasets[1].data).toEqual([10, 15]);
    // Multi-series → legend shown.
    expect(cfg.options.plugins.legend.display).toBe(true);
    expect(h.registerCalls).toBeGreaterThanOrEqual(1);
  });

  it("hides the legend for a single-series bar (matches prior behavior)", async () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      { type: "chart", labels: ["A", "B"], series: [{ name: "Only", data: [3, 7] }] },
      () => {},
    );
    await flush();
    expect(h.constructed[0].config.options.plugins.legend.display).toBe(false);
  });

  it("renders the title into the chart title config, colored by --vms-text (prominent, not Chart.js default grey)", async () => {
    const container = freshContainer();
    const getPropSpy = vi.spyOn(CSSStyleDeclaration.prototype, "getPropertyValue")
      .mockImplementation(function (this: CSSStyleDeclaration, prop: string) {
        if (prop === "--vms-text") return "#0a0a0a";
        return "";
      });
    new BrowserAdapter(container).render(
      { type: "chart", title: "Sales", labels: ["A"], series: [{ name: "S", data: [1] }] },
      () => {},
    );
    await flush();
    // title text is NAMED information → full-contrast --vms-text, not the fixed #666 default.
    expect(h.constructed[0].config.options.plugins.title).toEqual({ display: true, text: "Sales", color: "#0a0a0a" });
    getPropSpy.mockRestore();
  });

  it("colors the legend labels with --vms-text so series names read prominently (not the Chart.js default grey)", async () => {
    const container = freshContainer();
    const getPropSpy = vi.spyOn(CSSStyleDeclaration.prototype, "getPropertyValue")
      .mockImplementation(function (this: CSSStyleDeclaration, prop: string) {
        if (prop === "--vms-text") return "#0a0a0a";
        return "";
      });
    new BrowserAdapter(container).render(
      { type: "chart", labels: ["A"], series: [{ name: "S1", data: [1] }, { name: "S2", data: [2] }] },
      () => {},
    );
    await flush();
    const legend = h.constructed[0].config.options.plugins.legend;
    expect(legend.display).toBe(true);
    expect(legend.labels.color).toBe("#0a0a0a");
    getPropSpy.mockRestore();
  });
});

describe("ChartNode — stacked (bar/area)", () => {
  it("sets scales.x.stacked and scales.y.stacked true when stacked:true", async () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      {
        type: "chart",
        labels: ["A", "B"],
        series: [{ name: "S1", data: [1, 2] }, { name: "S2", data: [3, 4] }],
        stacked: true,
      },
      () => {},
    );
    await flush();
    const cfg = h.constructed[0].config;
    expect(cfg.options.scales.x.stacked).toBe(true);
    expect(cfg.options.scales.y.stacked).toBe(true);
  });

  it("leaves stacked unset (falsy) when omitted", async () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      { type: "chart", labels: ["A"], series: [{ name: "S1", data: [1] }] },
      () => {},
    );
    await flush();
    const cfg = h.constructed[0].config;
    expect(cfg.options.scales.x.stacked).toBeFalsy();
    expect(cfg.options.scales.y.stacked).toBeFalsy();
  });
});

describe("ChartNode — kind → Chart.js type mapping", () => {
  it('kind "line" maps to Chart type "line" with fill:false', async () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      { type: "chart", kind: "line", labels: ["A", "B"], series: [{ name: "S", data: [1, 2] }] },
      () => {},
    );
    await flush();
    const cfg = h.constructed[0].config;
    expect(cfg.type).toBe("line");
    expect(cfg.data.datasets[0].fill).toBe(false);
  });

  it('kind "area" maps to Chart type "line" with fill:true', async () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      { type: "chart", kind: "area", labels: ["A", "B"], series: [{ name: "S", data: [1, 2] }] },
      () => {},
    );
    await flush();
    const cfg = h.constructed[0].config;
    expect(cfg.type).toBe("line");
    expect(cfg.data.datasets[0].fill).toBe(true);
  });

  it('kind "pie" maps to Chart type "pie"', async () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      { type: "chart", kind: "pie", labels: ["A", "B"], series: [{ name: "S", data: [1, 2] }] },
      () => {},
    );
    await flush();
    expect(h.constructed[0].config.type).toBe("pie");
  });

  it('kind "donut" maps to Chart type "doughnut"', async () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      { type: "chart", kind: "donut", labels: ["A", "B"], series: [{ name: "S", data: [1, 2] }] },
      () => {},
    );
    await flush();
    expect(h.constructed[0].config.type).toBe("doughnut");
  });

  it('omitted kind defaults to "bar"', async () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      { type: "chart", labels: ["A"], series: [{ name: "S", data: [1] }] },
      () => {},
    );
    await flush();
    expect(h.constructed[0].config.type).toBe("bar");
  });
});

describe("ChartNode — palette vs tone color resolution", () => {
  it("a tone-less series resolves a --vms-chart-N palette slot via getComputedStyle", async () => {
    const container = freshContainer();
    const getPropSpy = vi.spyOn(CSSStyleDeclaration.prototype, "getPropertyValue")
      .mockImplementation(function (this: CSSStyleDeclaration, prop: string) {
        if (prop === "--vms-chart-1") return "#111111";
        if (prop === "--vms-chart-2") return "#222222";
        return "";
      });
    new BrowserAdapter(container).render(
      {
        type: "chart",
        labels: ["A"],
        series: [{ name: "S1", data: [1] }, { name: "S2", data: [2] }],
      },
      () => {},
    );
    await flush();
    const cfg = h.constructed[0].config;
    expect(cfg.data.datasets[0].backgroundColor).toBe("#111111");
    expect(cfg.data.datasets[1].backgroundColor).toBe("#222222");
    getPropSpy.mockRestore();
  });

  it("falls back to --vms-accent when the theme has no --vms-chart-N token defined (WR-01 regression)", async () => {
    const container = freshContainer();
    const getPropSpy = vi.spyOn(CSSStyleDeclaration.prototype, "getPropertyValue")
      .mockImplementation(function (this: CSSStyleDeclaration, prop: string) {
        // A theme that predates the chart palette: no --vms-chart-* tokens,
        // but the pre-existing --vms-accent token is still defined.
        if (prop === "--vms-accent") return "#7c3aed";
        return "";
      });
    new BrowserAdapter(container).render(
      {
        type: "chart",
        labels: ["A"],
        series: [{ name: "S1", data: [1] }, { name: "S2", data: [2] }],
      },
      () => {},
    );
    await flush();
    const cfg = h.constructed[0].config;
    expect(cfg.data.datasets[0].backgroundColor).toBe("#7c3aed");
    expect(cfg.data.datasets[1].backgroundColor).toBe("#7c3aed");
    getPropSpy.mockRestore();
  });

  it("a tone-bearing series resolves its tone token (--vms-error for danger) instead of the palette slot", async () => {
    const container = freshContainer();
    const getPropSpy = vi.spyOn(CSSStyleDeclaration.prototype, "getPropertyValue")
      .mockImplementation(function (this: CSSStyleDeclaration, prop: string) {
        if (prop === "--vms-chart-1") return "#111111";
        if (prop === "--vms-error") return "#dc2626";
        return "";
      });
    new BrowserAdapter(container).render(
      { type: "chart", labels: ["A"], series: [{ name: "Losses", data: [1], tone: "danger" }] },
      () => {},
    );
    await flush();
    const cfg = h.constructed[0].config;
    expect(cfg.data.datasets[0].backgroundColor).toBe("#dc2626");
    getPropSpy.mockRestore();
  });
});

describe("ChartNode — pie/donut single-series + extra-series dev warn", () => {
  it("renders series[0] with a per-slice palette color array", async () => {
    const container = freshContainer();
    const getPropSpy = vi.spyOn(CSSStyleDeclaration.prototype, "getPropertyValue")
      .mockImplementation(function (this: CSSStyleDeclaration, prop: string) {
        if (prop === "--vms-chart-1") return "#111111";
        if (prop === "--vms-chart-2") return "#222222";
        return "";
      });
    new BrowserAdapter(container).render(
      { type: "chart", kind: "pie", labels: ["A", "B"], series: [{ name: "S", data: [3, 7] }] },
      () => {},
    );
    await flush();
    const cfg = h.constructed[0].config;
    expect(cfg.data.datasets.length).toBe(1);
    expect(cfg.data.datasets[0].data).toEqual([3, 7]);
    expect(cfg.data.datasets[0].backgroundColor).toEqual(["#111111", "#222222"]);
    // pie/donut are always considered multi-slice → legend shown.
    expect(cfg.options.plugins.legend.display).toBe(true);
    getPropSpy.mockRestore();
  });

  it("warns exactly once when a pie/donut ChartNode has more than one series, and still renders series[0]", async () => {
    const container = freshContainer();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    new BrowserAdapter(container).render(
      {
        type: "chart",
        kind: "donut",
        labels: ["A", "B"],
        series: [
          { name: "Primary", data: [3, 7] },
          { name: "Extra", data: [1, 1] },
        ],
      },
      () => {},
    );
    await flush();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/single series/);
    const cfg = h.constructed[0].config;
    expect(cfg.data.datasets.length).toBe(1);
    expect(cfg.data.datasets[0].data).toEqual([3, 7]);
    warnSpy.mockRestore();
  });

  it("does NOT re-warn on a re-render of the same mis-shaped pie/donut chart (WR-02 regression — no poll spam)", async () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const node: ViewNode = {
      type: "chart",
      kind: "donut",
      title: "T",
      labels: ["A", "B"],
      series: [
        { name: "Primary", data: [3, 7] },
        { name: "Extra", data: [1, 1] },
      ],
    };
    adapter.render(node, () => {});
    await flush();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // Simulate several poll re-renders of the SAME (still mis-shaped) chart —
    // the warning must not fire again.
    adapter.render(node, () => {});
    await flush();
    adapter.render(node, () => {});
    await flush();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });
});

describe("ChartNode — redraw-in-place via .update()", () => {
  it("reuses the instance and calls .update() on a re-render with changed data (no reconstruct)", async () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    adapter.render(
      { type: "chart", title: "T", labels: ["A", "B"], series: [{ name: "S", data: [3, 7] }] },
      () => {},
    );
    await flush();
    expect(h.constructed.length).toBe(1);
    const inst = h.constructed[0].instance;
    expect(inst.updateCount).toBe(0);

    // Re-render the SAME chart (same stable key) with CHANGED values.
    adapter.render(
      { type: "chart", title: "T", labels: ["A", "B"], series: [{ name: "S", data: [5, 9] }] },
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
      { type: "chart", title: "T", labels: ["A"], series: [{ name: "S", data: [3] }] },
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
      { type: "chart", title: "T", labels: ["A"], series: [{ name: "S", data: [3] }] },
      () => {},
    );
    await flush();
    expect(h.constructed.length).toBe(2);
  });
});

describe("ChartNode — validator no-blind-spot", () => {
  it("passes validateActionNames + validateSectionAction (childless action-free leaf)", () => {
    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "chart", title: "T", labels: ["A"], series: [{ name: "S", data: [3] }] },
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
        { type: "chart", labels: ["A"], series: [{ name: "S", data: [1] }] },
        { type: "chart", labels: ["B"], series: [{ name: "S", data: [2] }] },
        { type: "button", label: "Only", action: { name: "only" } },
      ],
    };
    expect(() => validateActionNames(tree)).not.toThrow();
  });
});
