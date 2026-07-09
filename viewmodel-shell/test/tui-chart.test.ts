// @vitest-environment node
//
// TUI chart degradation (CHARTBASE-05) — proves the reshaped multi-series
// ChartNode { kind?; labels; series; stacked?; title? } renders through the
// TuiAdapter's static renderTree() path without throwing, and that the
// printed text legibly surfaces the title, every label, and each series'
// name. Also locks the guarded-division edge cases (empty series, all-zero
// data, pie/donut single-series degrade) that the browser adapter can't
// exercise — the TUI is the one target with no canvas, so "does it crash"
// and "is it legible" are the whole requirement here.
//
// Mirrors the exact rendering + assertion approach used by
// conformance.tui.test.ts and tui-lifecycle.test.ts: walk the React tree
// returned by renderTree(vm) directly (no OpenTUI CliRenderer / TTY needed),
// collecting visible text the same way the cross-adapter conformance suite
// does. Deliberately duplicates that small walker rather than importing a
// test-only helper across files (conformance.tui.test.ts's collectText is a
// local, unexported function) — same technique, not a new harness.

import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { renderTree } from "../src/tui.js";
import type { ChartNode } from "../src/index.js";

function collectText(node: ReactNode, out: string[]): void {
  if (node == null || node === false || node === true) return;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return;
  }
  if (typeof node === "object" && "type" in node && "props" in node) {
    const el = node as { type: unknown; props?: Record<string, unknown> };
    const props = el.props ?? {};
    if (typeof el.type === "function") {
      const result = (el.type as (p: Record<string, unknown>) => ReactNode)(props);
      collectText(result, out);
      return;
    }
    if (typeof props.title === "string" && props.title.length > 0) out.push(props.title);
    collectText(props.children as ReactNode, out);
    if (typeof props.bottomTitle === "string" && props.bottomTitle.length > 0) {
      out.push(props.bottomTitle);
    }
    return;
  }
}

function renderedText(node: ChartNode): string {
  const tokens: string[] = [];
  collectText(renderTree(node), tokens);
  return tokens.join(" ");
}

describe("TUI ChartView — reshaped multi-series degradation (CHARTBASE-05)", () => {
  it("renders a 2-series bar chart without throwing, surfacing the title, all labels, and both series names", () => {
    const node: ChartNode = {
      type: "chart",
      kind: "bar",
      title: "Quarterly Results",
      labels: ["Q1", "Q2", "Q3"],
      series: [
        { name: "Revenue", data: [10, 20, 30] },
        { name: "Costs", data: [5, 15, 25] },
      ],
    };
    let text = "";
    expect(() => { text = renderedText(node); }).not.toThrow();
    expect(text).toContain("Quarterly Results");
    expect(text).toContain("Q1");
    expect(text).toContain("Q2");
    expect(text).toContain("Q3");
    expect(text).toContain("Revenue");
    expect(text).toContain("Costs");
  });

  it("renders an empty-series ChartNode without throwing (no bars, no crash)", () => {
    const node: ChartNode = {
      type: "chart",
      title: "Nothing Yet",
      labels: ["A", "B"],
      series: [],
    };
    let text = "";
    expect(() => { text = renderedText(node); }).not.toThrow();
    expect(text).toContain("Nothing Yet");
  });

  it("renders an all-zero-data ChartNode without throwing, NaN, or Infinity", () => {
    const node: ChartNode = {
      type: "chart",
      title: "Flatline",
      labels: ["A", "B", "C"],
      series: [{ name: "S", data: [0, 0, 0] }],
    };
    let text = "";
    expect(() => { text = renderedText(node); }).not.toThrow();
    expect(text).toContain("Flatline");
    expect(text).toContain("S");
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("Infinity");
  });

  it("renders a non-positive-max (all-negative) ChartNode without dividing by zero or throwing", () => {
    const node: ChartNode = {
      type: "chart",
      labels: ["A", "B"],
      series: [{ name: "Losses", data: [-3, -7] }],
    };
    let text = "";
    expect(() => { text = renderedText(node); }).not.toThrow();
    expect(text).toContain("Losses");
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("Infinity");
  });

  it("renders a pie ChartNode's series[0] slice labels without throwing", () => {
    const node: ChartNode = {
      type: "chart",
      kind: "pie",
      title: "Market Share",
      labels: ["Alpha", "Beta", "Gamma"],
      series: [{ name: "Share", data: [50, 30, 20] }],
    };
    let text = "";
    expect(() => { text = renderedText(node); }).not.toThrow();
    expect(text).toContain("Market Share");
    expect(text).toContain("Share");
    expect(text).toContain("Alpha");
    expect(text).toContain("Beta");
    expect(text).toContain("Gamma");
  });

  it("renders a donut ChartNode with an extra ignored series without throwing", () => {
    const node: ChartNode = {
      type: "chart",
      kind: "donut",
      labels: ["X", "Y"],
      series: [
        { name: "Primary", data: [7, 3] },
        { name: "Ignored", data: [1, 2] },
      ],
    };
    let text = "";
    expect(() => { text = renderedText(node); }).not.toThrow();
    expect(text).toContain("Primary");
    expect(text).toContain("X");
    expect(text).toContain("Y");
  });
});
