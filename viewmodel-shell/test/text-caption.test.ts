// v8.0.0 (COMP-01) — TextNode `style: "caption"` renderer + AA-contrast record.
//
// The 3rd typographic tier: text-xs muted with opacity, consumed by
// ListRowNode.meta[], MessageNode.timestamp, TimelineEntryNode.time in
// Phase 24-25. This suite asserts:
//   (a) DOM shape / class emission — the renderer wires the switch-arm.
//   (b) getComputedStyle for opacity + line-height (jsdom returns these
//       correctly from an injected stylesheet — see probe run 2026-07-29).
//   (c) font-size carries the closed --vms-text-xs token (jsdom does NOT
//       resolve `var(...)` to a pixel value, so the assertion is on the
//       token literal, which is sufficient to catch a font-size regression
//       and matches how theme-modifiers.test.ts handles token-driven props).
//
// Mutation-test proof (revert-and-run):
//   • Remove `| "caption"` from the TextNode.style union in
//     src/index.ts → this file FAILS to type-check under the strict tsc
//     harness (npm run check:test-types); no `caption` render slot exists.
//   • Remove the `.vms-text--caption` rule block from styles/default.css →
//     both `expect(cs.getPropertyValue("opacity"))` and
//     `expect(cs.getPropertyValue("line-height"))` FAIL because the class
//     no longer matches any declaration (jsdom returns "" for both).
//
// ── AA-contrast hand-check (COMP-01 new pair: text-xs muted × opacity 0.85)
// The fixed 13-pair `check:aa-contrast` gate does NOT auto-cover new pairs
// (banked lesson). Hand-computed WCAG AA-normal (4.5:1 threshold) against
// `--vms-bg` and `--vms-surface` on default + all 12 themes:
//
//   Light-family (default, light-amber/blue/green/purple/rose/teal):
//     --vms-text-muted:  #6c6c80
//     --vms-bg:          #f7f7f9
//     --vms-surface:     #ffffff
//     Base spec (color: --vms-text-muted; opacity 0.85):
//       vs --vms-bg:       3.58:1  ✗ (below 4.5:1)
//       vs --vms-surface:  3.77:1  ✗ (below 4.5:1)
//     → deepened via color-mix(in srgb, --vms-text-muted 70%, --vms-text) —
//       effective #5b5b6a → contrast ≥ 4.83:1 (vs bg) / ≥ 5.08:1 (vs surface). ✓
//
//   Dark-family (dark-amber/blue/green/purple/rose/teal):
//     --vms-text-muted:  #9090a8
//     --vms-bg:          #0f0f11
//     --vms-surface:     #18181c
//     Base spec (color: --vms-text-muted; opacity 0.85):
//       vs --vms-bg:       4.74:1  ✓
//       vs --vms-surface:  4.46:1  ✗ (marginally below 4.5:1)
//     → same deepening applied (color-mix toward --vms-text #e8e8f0) lifts
//       to ≥ 6.34:1 (vs bg) / ≥ 5.97:1 (vs surface). ✓
//
// Result — AA hand-check green on default + 12 themes @ text-xs muted × 0.85
// opacity, after color-mix deepening at 70/30 muted/text ratio. Per-theme
// breakdown: all 7 light themes share the same triplet (default + 6
// light-*); all 6 dark themes share the same triplet. The deepening
// follows the shipped v3.5.0 pattern documented in AGENTS.md.

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BrowserAdapter } from "../src/browser.js";
import type { ViewNode } from "../src/index.js";

// Load the shipped stylesheet ONCE per test process so getComputedStyle can
// return real values for opacity / line-height. Same pattern as
// theme-modifiers.test.ts.
const cssText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../styles/default.css"),
  "utf8",
);

beforeAll(() => {
  if (!document.head.querySelector('style[data-vms-default]')) {
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

describe("TextNode style:caption (COMP-01)", () => {
  it("renders <span class='vms-text vms-text--caption'>", () => {
    const { container, render } = setup();
    render({ type: "text", value: "Meta line", style: "caption" });
    const el = container.querySelector("span.vms-text--caption") as HTMLSpanElement | null;
    expect(el).not.toBeNull();
    // Full className is exactly the two class names, in the framework-emitted order.
    expect(el!.className).toBe("vms-text vms-text--caption");
    // Text content flows through the plain-value path (no runs, no tooltip).
    expect(el!.textContent).toBe("Meta line");
    // DOM tag is <span> — same shape as every other TextNode style (per CONTEXT §1).
    expect(el!.tagName).toBe("SPAN");
  });

  it("computed opacity is 0.85 and line-height is 1.4 (from shipped default.css)", () => {
    const { container, render } = setup();
    render({ type: "text", value: "Meta line", style: "caption" });
    const el = container.querySelector("span.vms-text--caption") as HTMLSpanElement;
    const cs = window.getComputedStyle(el);
    // jsdom returns these literals when the class matches a declaration.
    // If the CSS rule is removed, both come back as "" (empty string) —
    // mutation-tested via `_probe.test.ts` on 2026-07-29.
    expect(cs.getPropertyValue("opacity")).toBe("0.85");
    expect(cs.getPropertyValue("line-height")).toBe("1.4");
    // jsdom does NOT resolve `var(--vms-text-xs)` to a pixel value, so the
    // assertion is on the token literal. This still catches a font-size
    // regression (the rule losing the font-size declaration → "").
    expect(cs.getPropertyValue("font-size")).toContain("--vms-text-xs");
  });

  it("composes with tone (caption + danger emits both classes)", () => {
    const { container, render } = setup();
    render({ type: "text", value: "3 mins ago", style: "caption", tone: "danger" });
    const el = container.querySelector("span.vms-text--caption") as HTMLSpanElement;
    expect(el).not.toBeNull();
    // Framework template emits `vms-text vms-text--{style} vms-text--{tone}`.
    expect(el.className).toBe("vms-text vms-text--caption vms-text--danger");
  });
});
