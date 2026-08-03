// v9.1.1 regression gate — AvatarNode image-mode size fidelity (COMP-04).
//
// Motivating bug: in v9.1.0, a shared CSS rule set width/height on both
// `.vms-avatar img` (nested-img fallback) AND `img.vms-avatar` (direct case).
// The `img.vms-avatar` selector has element+class specificity (0,1,1), which
// beat the size class `.vms-avatar--{size}` (0,1,0) — so image-mode avatars
// silently rendered at 100%×100% of their parent regardless of size. Angel
// caught it in a sidebar list at ~10x oversized. Root cause was pure CSS
// specificity; the renderer was correct.
//
// This suite is a PROPERTY gate: prior avatar-render.test.ts asserts the
// SHAPE (className, src, alt) but never the applied SIZE, so the bug shipped
// through the whole test suite. This test asserts getComputedStyle(img).width
// / .height match the shipped size-class values — the property that actually
// matters to a consumer. Same pattern as text-weight.test.ts /
// text-caption.test.ts (load default.css, assert computed style).
//
// Direct-family sibling of the banked lesson "our gates check the SHAPE of a
// thing, not the PROPERTY we care about" — see vicky.md.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BrowserAdapter } from "../src/browser.js";
import type { ViewNode } from "../src/index.js";

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
  // A wide parent container — mirrors the real Angel-DM'd bug shape, where
  // 100%-of-parent would blow the img out to sidebar width. If the size class
  // is silently overridden by a 100% rule, computed width returns "100%" (or
  // resolved to the parent's width in some jsdom versions), NOT the size-class
  // rem value — either way, the assertion fails.
  const container = document.createElement("div");
  container.style.width = "600px";
  document.body.appendChild(container);
  const adapter = new BrowserAdapter(container);
  return {
    container,
    render(vm: ViewNode) {
      adapter.render(vm, () => {});
    },
  };
}

// Shipped size-class values from default.css:
//   sm = 1.5rem, md = 2rem, lg = 2.5rem, xl = 3rem
// The gate reads them off getComputedStyle so a future rem retune stays honest
// (no hardcoded rem strings duplicated from CSS).
const SIZES = ["sm", "md", "lg", "xl"] as const;

describe("AvatarNode image mode size fidelity (v9.1.1 regression gate)", () => {
  it.each(SIZES)("size:%s — <img> width/height match .vms-avatar--%s, not 100%%", (size) => {
    const { container, render } = setup();
    render({
      type: "avatar",
      image: "https://example.com/photo.png",
      size,
    });
    const img = container.querySelector("img.vms-avatar") as HTMLImageElement;
    expect(img).not.toBeNull();

    // The size class's own width/height — the ground truth this test compares
    // against. If someone retunes the rem values, this reads the new value.
    const probe = document.createElement("div");
    probe.className = `vms-avatar vms-avatar--${size}`;
    document.body.appendChild(probe);
    const probeCs = window.getComputedStyle(probe);
    const expectedWidth = probeCs.getPropertyValue("width");
    const expectedHeight = probeCs.getPropertyValue("height");

    const imgCs = window.getComputedStyle(img);
    // Guard: the direct-case rule `img.vms-avatar` MUST NOT ship width/height,
    // otherwise its (0,1,1) specificity overrides the (0,1,0) size class and
    // the whole point of splitting the CSS is lost.
    expect(imgCs.getPropertyValue("width")).toBe(expectedWidth);
    expect(imgCs.getPropertyValue("height")).toBe(expectedHeight);
    // Neither collapses to "auto" (missing rule) nor blows out to a parent %.
    expect(imgCs.getPropertyValue("width")).not.toBe("100%");
    expect(imgCs.getPropertyValue("width")).not.toBe("auto");
  });

  it("default (size omitted) — <img> matches .vms-avatar--md (renderer default)", () => {
    const { container, render } = setup();
    render({ type: "avatar", image: "https://example.com/photo.png" });
    const img = container.querySelector("img.vms-avatar") as HTMLImageElement;
    const probe = document.createElement("div");
    probe.className = "vms-avatar vms-avatar--md";
    document.body.appendChild(probe);
    expect(window.getComputedStyle(img).getPropertyValue("width"))
      .toBe(window.getComputedStyle(probe).getPropertyValue("width"));
  });

  it("nested-img fallback still fills its wrapper (100%/100%)", () => {
    // The OTHER half of the split — a consumer that wraps an <img> inside a
    // `<div class="vms-avatar vms-avatar--{size}">` wrapper (hypothetical
    // future case) still gets the img filling the sized wrapper. Proves the
    // split kept both cases correct, not just the direct one.
    const { container } = setup();
    const wrapper = document.createElement("div");
    wrapper.className = "vms-avatar vms-avatar--lg";
    const inner = document.createElement("img");
    inner.src = "https://example.com/photo.png";
    wrapper.appendChild(inner);
    container.appendChild(wrapper);

    const cs = window.getComputedStyle(inner);
    expect(cs.getPropertyValue("width")).toBe("100%");
    expect(cs.getPropertyValue("height")).toBe("100%");
  });
});
