// @vitest-environment node
//
// TUI navigation-primitive degradation (NAV-03) — proves BreadcrumbNode and
// StepsNode render through the TuiAdapter's static renderTree() path without
// throwing and legibly, instead of falling through to UnsupportedView (the
// `[unknown node type: ...]` marker). The TUI is @experimental; the whole
// requirement here is "doesn't break + degrades sensibly" (the same bar the
// `fits` case documents), so the assertions are: no crash, no unknown-type
// marker, and every label surfaces — plus the steps markers derived from
// `current` (done ✓ / current ▸ / upcoming ·).
//
// Mirrors tui-chart.test.ts / conformance.tui.test.ts exactly: walk the React
// tree from renderTree(vm) directly (no OpenTUI CliRenderer / TTY), collecting
// visible text. Deliberately duplicates that small local walker rather than
// importing a test-only helper across files (same technique, not a new harness).

import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { renderTree } from "../src/tui.js";
import type { BreadcrumbNode, StepsNode } from "../src/index.js";

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
    return;
  }
}

function renderedText(node: BreadcrumbNode | StepsNode): string {
  const tokens: string[] = [];
  collectText(renderTree(node), tokens);
  return tokens.join(" ");
}

describe("TUI BreadcrumbView — legible degradation (NAV-03)", () => {
  it("renders the trail as an inline separator-joined line, never UnsupportedView", () => {
    const node: BreadcrumbNode = {
      type: "breadcrumb",
      items: [
        { label: "Home", href: "/" },
        { label: "Products", href: "/products" },
        { label: "Widget" }, // last = current, no href
      ],
    };
    let text = "";
    expect(() => { text = renderedText(node); }).not.toThrow();
    expect(text).not.toContain("unknown node type");
    expect(text).toContain("Home");
    expect(text).toContain("Products");
    expect(text).toContain("Widget");
    expect(text).toContain("›"); // framework-owned separator becomes a text glyph
  });

  it("renders a single-item breadcrumb without a separator or crash", () => {
    const node: BreadcrumbNode = { type: "breadcrumb", items: [{ label: "Home" }] };
    let text = "";
    expect(() => { text = renderedText(node); }).not.toThrow();
    expect(text).toContain("Home");
    expect(text).not.toContain("›");
    expect(text).not.toContain("unknown node type");
  });
});

describe("TUI StepsView — per-step state markers derived from current (NAV-03)", () => {
  it("marks each step done ✓ / current ▸ / upcoming · from `current`, surfacing every label", () => {
    const node: StepsNode = {
      type: "steps",
      current: 1,
      steps: [
        { label: "Cart" },      // index 0 < 1 → done
        { label: "Shipping" },  // index 1 === 1 → current
        { label: "Payment" },   // index 2 > 1 → upcoming
      ],
    };
    let text = "";
    expect(() => { text = renderedText(node); }).not.toThrow();
    expect(text).not.toContain("unknown node type");
    expect(text).toContain("Cart");
    expect(text).toContain("Shipping");
    expect(text).toContain("Payment");
    expect(text).toContain("✓"); // a done step
    expect(text).toContain("▸"); // the current step
    expect(text).toContain("·"); // an upcoming step
  });

  it("appends a step description when present", () => {
    const node: StepsNode = {
      type: "steps",
      current: 0,
      steps: [{ label: "Details", description: "Enter your info" }],
    };
    let text = "";
    expect(() => { text = renderedText(node); }).not.toThrow();
    expect(text).toContain("Details");
    expect(text).toContain("Enter your info");
  });

  it("renders current === 0 (first step active) with no done marker and no crash", () => {
    const node: StepsNode = {
      type: "steps",
      current: 0,
      steps: [{ label: "One" }, { label: "Two" }],
    };
    let text = "";
    expect(() => { text = renderedText(node); }).not.toThrow();
    expect(text).not.toContain("unknown node type");
    expect(text).toContain("▸"); // first step is current
    expect(text).not.toContain("✓"); // nothing is done yet
  });
});
