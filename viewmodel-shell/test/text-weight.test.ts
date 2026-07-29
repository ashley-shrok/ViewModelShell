// v8.0.0 (COMP-02) — TextNode `weight` axis renderer + serialization guards.
//
// Orthogonal type-weight axis: `weight?: "regular" | "medium" | "bold"`, chosen
// (per CONTEXT.md §Decisions 2) over the Option-B `style: "strong"` extension
// so a body-styled TextNode can be `weight: "medium"` without becoming a
// heading. Mirrors the tone orthogonal-axis pattern already shipped.
//
// This suite asserts:
//   (a) DOM shape / class emission — the renderer wires the new className
//       clause for each of the three weight values, in the framework-emitted
//       order (style → tone → weight).
//   (b) An UNSET weight emits NO `.vms-text--weight-` class at all — proves
//       the conditional clause (not a blanket "always emit vms-text--weight-
//       regular" default), matching the style / tone posture.
//   (c) getComputedStyle for font-weight returns the shipped literals
//       (400 / 500 / 700). Unlike font-size (which uses `var(--vms-text-xs)`
//       and jsdom cannot resolve), font-weight is a plain integer literal
//       in default.css so jsdom returns it verbatim.
//
// Mutation-test proof (revert-and-run):
//   • Remove the `${n.weight ? ` vms-text--weight-${n.weight}` : ""}` clause
//     from `browser.ts:3219` → tests (a) FAIL because the class no longer
//     emits, and test (c) FAILS because the class no longer matches any
//     declaration (jsdom returns "" for the property).
//   • Remove `weight?: "regular" | "medium" | "bold"` from TextNode in
//     src/index.ts → this file FAILS to type-check under the strict tsc
//     harness (npm run check:test-types); the `weight` key becomes an
//     "Object literal may only specify known properties" error.
//   • Remove any one of the three `.vms-text--weight-{regular|medium|bold}`
//     rules from default.css → test (c) FAILS for that value only
//     (jsdom returns "" instead of "400"/"500"/"700").

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BrowserAdapter } from "../src/browser.js";
import type { ViewNode } from "../src/index.js";

// Load the shipped stylesheet ONCE per test process so getComputedStyle can
// return real font-weight values. Same pattern as text-caption.test.ts /
// theme-modifiers.test.ts.
const cssText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../styles/default.css"),
  "utf8",
);

beforeAll(() => {
  if (!document.head.querySelector("style[data-vms-default]")) {
    const style = document.createElement("style");
    style.setAttribute("data-vms-default", "true");
    style.textContent = cssText;
    document.head.appendChild(style);
  }
});

beforeEach(() => {
  document.body.innerHTML = "";
});

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const adapter = new BrowserAdapter(container);
  return {
    container,
    render(vm: ViewNode) {
      adapter.render(vm, () => {});
    },
  };
}

describe("TextNode weight axis (COMP-02)", () => {
  it("renders <span class='vms-text vms-text--weight-regular'> for weight:'regular'", () => {
    const { container, render } = setup();
    render({ type: "text", value: "Row primary", weight: "regular" });
    const el = container.querySelector("span.vms-text--weight-regular") as HTMLSpanElement | null;
    expect(el).not.toBeNull();
    // Full className is exactly the two class names, in the framework-emitted order.
    expect(el!.className).toBe("vms-text vms-text--weight-regular");
    expect(el!.textContent).toBe("Row primary");
    expect(el!.tagName).toBe("SPAN");
  });

  it("renders <span class='vms-text vms-text--weight-medium'> for weight:'medium'", () => {
    const { container, render } = setup();
    render({ type: "text", value: "Row primary", weight: "medium" });
    const el = container.querySelector("span.vms-text--weight-medium") as HTMLSpanElement | null;
    expect(el).not.toBeNull();
    expect(el!.className).toBe("vms-text vms-text--weight-medium");
    expect(el!.textContent).toBe("Row primary");
    expect(el!.tagName).toBe("SPAN");
  });

  it("renders <span class='vms-text vms-text--weight-bold'> for weight:'bold'", () => {
    const { container, render } = setup();
    render({ type: "text", value: "Row primary", weight: "bold" });
    const el = container.querySelector("span.vms-text--weight-bold") as HTMLSpanElement | null;
    expect(el).not.toBeNull();
    expect(el!.className).toBe("vms-text vms-text--weight-bold");
    expect(el!.textContent).toBe("Row primary");
    expect(el!.tagName).toBe("SPAN");
  });

  it("emits no weight class when weight is absent", () => {
    // Proves the conditional clause: an unset weight produces NO
    // `.vms-text--weight-` class (not a blanket "always emit
    // vms-text--weight-regular" default). Matches the style / tone posture
    // where absent = no class, not the-default-value class.
    const { container, render } = setup();
    render({ type: "text", value: "no-weight", style: "body" });
    const el = container.querySelector("span.vms-text") as HTMLSpanElement | null;
    expect(el).not.toBeNull();
    // The className is exactly the base class + the style class — no weight suffix.
    expect(el!.className).toBe("vms-text vms-text--body");
    expect(el!.className).not.toContain("vms-text--weight-");
  });

  it("composes orthogonally with style and tone (all three axes together)", () => {
    // The point of Option A: a body-styled, danger-toned TextNode can ALSO
    // be weight:"medium" — three orthogonal axes, three class-modifier
    // emissions, in the framework-emitted order (style → tone → weight).
    const { container, render } = setup();
    render({ type: "text", value: "Row primary", style: "body", tone: "danger", weight: "medium" });
    const el = container.querySelector("span.vms-text--weight-medium") as HTMLSpanElement;
    expect(el).not.toBeNull();
    expect(el.className).toBe("vms-text vms-text--body vms-text--danger vms-text--weight-medium");
  });

  it("computed font-weight is 400 / 500 / 700 (from shipped default.css)", () => {
    // font-weight is a plain integer literal in default.css (unlike
    // font-size which uses `var(--vms-text-xs)`), so jsdom returns it
    // verbatim. If the CSS rule is removed, the property comes back as
    // "" (empty string) — mutation-tested by header note above.
    const { container, render } = setup();
    render({ type: "section", children: [
      { type: "text", value: "reg", weight: "regular" },
      { type: "text", value: "med", weight: "medium" },
      { type: "text", value: "bld", weight: "bold" },
    ]});
    const reg = container.querySelector("span.vms-text--weight-regular") as HTMLSpanElement;
    const med = container.querySelector("span.vms-text--weight-medium") as HTMLSpanElement;
    const bld = container.querySelector("span.vms-text--weight-bold") as HTMLSpanElement;
    expect(window.getComputedStyle(reg).getPropertyValue("font-weight")).toBe("400");
    expect(window.getComputedStyle(med).getPropertyValue("font-weight")).toBe("500");
    expect(window.getComputedStyle(bld).getPropertyValue("font-weight")).toBe("700");
  });
});
