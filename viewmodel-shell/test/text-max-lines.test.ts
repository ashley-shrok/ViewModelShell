// Phase 31 (v9.2.0) — TextNode `maxLines` axis renderer + shipped-CSS guards.
//
// Route A appearance axis: `maxLines?: 1 | 2 | 3` on TextNode. Closed enum
// chosen (per 31-CONTEXT.md §decisions, locked at the 2026-08-03 tasting)
// over Chakra's open int — 90th-percentile use is 1 (hug titles/labels),
// 2 (list previews), 3 (message summaries); the flagship survey (MUI noWrap,
// Ant Typography.Text ellipsis={rows:N}, Chakra Text noOfLines, Bootstrap
// .text-truncate) validated the closed-enum shape (Chakra was the outlier).
// Composes AFTER wrapping (existing overflow-wrap:anywhere still applies).
//
// This suite asserts:
//   (a) DOM shape / class emission — the renderer wires the new className
//       clause for each of the three maxLines values, in the framework-emitted
//       source order (style → tone → weight → maxLines).
//   (b) An UNSET maxLines emits NO `.vms-text--max-lines-` class at all —
//       proves the conditional clause (backwards-compat: default wrap unchanged).
//   (c) The shipped default.css contains the four CSS rule literals verbatim
//       (grep of cssText): the `.vms-text--max-lines-1` rule + the grouped
//       `.vms-text--max-lines-2, .vms-text--max-lines-3` selector + the two
//       `-webkit-line-clamp` declarations. Mutation-proof.
//   (d) The axis composes for FREE into any composite carrying a TextNode
//       slot (typed-slots pattern §3 in composite-nodes-layer.md) — proven
//       through UserRowNode.name (Angel's motivating case from 2026-08-03).
//   (e) The level axis (which switches the tag to `<h1>`–`<h6>`) doesn't
//       skip the maxLines class emission.
//
// jsdom caveat — jsdom does NOT lay out, so getComputedStyle CANNOT prove
// whether a line-clamp actually clamped pixels. The honest assertion floor
// is (a) class emission via classList.contains(...) and (c) shipped-CSS
// grep via cssText inclusion checks. That's what this suite asserts.
//
// Mutation-test proof (revert-and-run):
//   • Remove the `${n.maxLines ? ...}` clause from browser.ts's text render
//     path → tests (a) and (d)/(e) FAIL because the class no longer emits.
//   • Remove `maxLines?: 1 | 2 | 3` from TextNode in src/index.ts →
//     `npm run check:test-types` FAILS (this file no longer type-checks;
//     the `maxLines` key becomes "Object literal may only specify known
//     properties" errors).
//   • Remove any one of the three CSS rules (or the `-webkit-line-clamp: N`
//     declarations) from default.css → test (c) FAILS on the grep assertion
//     that names that rule.

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BrowserAdapter } from "../src/browser.js";
import type { ViewNode, TextNode as TN } from "../src/index.js";

// Load the shipped stylesheet ONCE per test process. Same pattern as
// text-caption.test.ts / text-weight.test.ts / composite-state-axis.test.ts.
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

describe("TextNode maxLines axis — class emission", () => {
  it("maxLines:1 emits vms-text--max-lines-1", () => {
    const { container, render } = setup();
    render({ type: "text", value: "hello", maxLines: 1 } as TN);
    const el = container.querySelector(".vms-text") as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.classList.contains("vms-text--max-lines-1")).toBe(true);
    expect(el!.classList.contains("vms-text--max-lines-2")).toBe(false);
    expect(el!.classList.contains("vms-text--max-lines-3")).toBe(false);
  });

  it("maxLines:2 emits vms-text--max-lines-2", () => {
    const { container, render } = setup();
    render({ type: "text", value: "hello", maxLines: 2 } as TN);
    const el = container.querySelector(".vms-text") as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.classList.contains("vms-text--max-lines-2")).toBe(true);
    expect(el!.classList.contains("vms-text--max-lines-1")).toBe(false);
    expect(el!.classList.contains("vms-text--max-lines-3")).toBe(false);
  });

  it("maxLines:3 emits vms-text--max-lines-3", () => {
    const { container, render } = setup();
    render({ type: "text", value: "hello", maxLines: 3 } as TN);
    const el = container.querySelector(".vms-text") as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.classList.contains("vms-text--max-lines-3")).toBe(true);
    expect(el!.classList.contains("vms-text--max-lines-1")).toBe(false);
    expect(el!.classList.contains("vms-text--max-lines-2")).toBe(false);
  });

  it("absent maxLines emits no vms-text--max-lines-* class (backwards-compat)", () => {
    // Proves the conditional clause: an unset maxLines produces NO
    // `.vms-text--max-lines-` class. This is the backwards-compat contract —
    // an existing TextNode consumer sees byte-identical emission, no wrap
    // behavior change.
    const { container, render } = setup();
    render({ type: "text", value: "no-max-lines", style: "body" });
    const el = container.querySelector(".vms-text") as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.className).toBe("vms-text vms-text--body");
    expect(
      Array.from(el!.classList).some((c) => /^vms-text--max-lines-/.test(c)),
    ).toBe(false);
  });
});

describe("TextNode maxLines axis — shipped CSS rules present (mutation-proof)", () => {
  // These grep assertions are the mutation-proof floor for the shipped CSS.
  // Removing any one of the four rule literals from default.css breaks the
  // matching assertion immediately — the shipped stylesheet cannot silently
  // regress.

  it("single-line rule literal (.vms-text--max-lines-1) present with ellipsis + nowrap", () => {
    expect(cssText).toContain(".vms-text--max-lines-1");
    expect(cssText).toContain("text-overflow: ellipsis");
    expect(cssText).toContain("white-space: nowrap");
  });

  it("grouped clamp selector (.vms-text--max-lines-2, .vms-text--max-lines-3) present", () => {
    expect(cssText).toMatch(
      /\.vms-text--max-lines-2\s*,\s*\.vms-text--max-lines-3/,
    );
    expect(cssText).toContain("display: -webkit-box");
    expect(cssText).toContain("-webkit-box-orient: vertical");
  });

  it("-webkit-line-clamp declarations present for N=2 and N=3", () => {
    expect(cssText).toContain("-webkit-line-clamp: 2");
    expect(cssText).toContain("-webkit-line-clamp: 3");
  });
});

describe("TextNode maxLines axis — orthogonal composition", () => {
  it("composes with style + tone + weight in source order (style → tone → weight → maxLines)", () => {
    // The point of an orthogonal axis: a body-styled, danger-toned,
    // medium-weight TextNode can ALSO be maxLines:2 — four orthogonal
    // class-modifier emissions, in the framework-emitted source order.
    const { container, render } = setup();
    render({
      type: "text",
      value: "x",
      style: "body",
      tone: "danger",
      weight: "medium",
      maxLines: 2,
    } as TN);
    const el = container.querySelector(".vms-text") as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.className).toBe(
      "vms-text vms-text--body vms-text--danger vms-text--weight-medium vms-text--max-lines-2",
    );
  });

  it("composes with level (semantic <h2> tag preserved) + maxLines class emitted", () => {
    // Proves the level axis (which switches the tag) doesn't skip the maxLines
    // class emission — the class lands on the semantic heading tag, not just
    // on a <span>.
    const { container, render } = setup();
    render({ type: "text", value: "x", level: 2, maxLines: 1 } as TN);
    const el = container.querySelector("h2") as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.classList.contains("vms-text--max-lines-1")).toBe(true);
  });

  it("composes into UserRowNode.name slot (Angel's motivating case)", () => {
    // Prove the axis composes into every composite carrying a TextNode slot
    // for FREE (no composite renderer changed in Phase 31). Verifies the
    // typed-slots governance rule from composite-nodes-layer.md §3:
    // consumers pass TextNode(..., maxLines:N) into a slot that accepts any
    // ViewNode. UserRowNode.name is Angel's motivating case verbatim (per
    // 31-CONTEXT.md §specifics — Angel's Kitsune /ai sidebar session titles
    // were the framework-gap surfacing that opened this bounty; she had been
    // hand-truncating server-side via `.Substring(0, 16) + "…"` in
    // BuildSessionLabel because VMS shipped no wire knob).
    const { container, render } = setup();
    render({
      type: "user-row",
      name: {
        type: "text",
        value:
          "The very long session title Angel showed us — 'Kitsune migration notes'",
        maxLines: 1,
      },
    } as ViewNode);
    const nameSlot = container.querySelector(
      ".vms-user-row__name",
    ) as HTMLElement | null;
    expect(nameSlot).not.toBeNull();
    const el = nameSlot!.querySelector(".vms-text") as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.classList.contains("vms-text--max-lines-1")).toBe(true);
  });
});
