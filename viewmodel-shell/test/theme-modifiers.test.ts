// THEME-03 / THEME-04 class-emission + omitted-field byte-identical guarantee.
//
// Net-new jsdom/vitest harness (no real browser). It renders page/section nodes
// through BrowserAdapter and asserts:
//   (a) density: "compact"   ⇒ root className CONTAINS  vms-page--compact
//   (b) density: "comfortable" / omitted ⇒ className === "vms-page"    (byte-identical, UI-SPEC regression item 4)
//   (c) variant: "card"      ⇒ section className CONTAINS vms-section--card
//   (d) variant omitted      ⇒ section className === "vms-section"     (byte-identical)
//
// These are class-emission assertions ONLY — no computed pixel-value
// assertions (UI-SPEC regression item 5: D-08 normalization breaks no test).
//
// Imports use the local source via `.js` specifiers (NodeNext convention — the
// same way src/browser.ts imports src/index.ts), NOT the published package.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

// #17 — load the real shipped stylesheet so we can assert getComputedStyle().display
// (not just emitted className). Module-scope: executes once per test process.
const cssText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../styles/default.css"),
  "utf8",
);

function injectStylesheet(): void {
  if (document.head.querySelector('style[data-vms-default]')) return;
  const style = document.createElement("style");
  style.setAttribute("data-vms-default", "true");
  style.textContent = cssText;
  document.head.appendChild(style);
}

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

function renderPage(node: ViewNode): HTMLElement {
  const container = freshContainer();
  new BrowserAdapter(container).render(node, () => {});
  const page = container.querySelector(".vms-page");
  if (!page) throw new Error("no .vms-page rendered");
  return page as HTMLElement;
}

function renderSection(node: ViewNode): HTMLElement {
  const container = freshContainer();
  new BrowserAdapter(container).render(node, () => {});
  const section = container.querySelector(".vms-section");
  if (!section) throw new Error("no .vms-section rendered");
  return section as HTMLElement;
}

function renderCopyButton(node: ViewNode): HTMLElement {
  // The copy-button isn't a page-shell, so wrap it in a minimal page tree.
  const container = freshContainer();
  new BrowserAdapter(container).render(
    { type: "page", children: [node] },
    () => {},
  );
  // Both ButtonNode and CopyButtonNode render as <button class="vms-button">.
  // querySelector returns the first match — which is the only button in
  // this minimal tree, the copy-button.
  const btn = container.querySelector(".vms-button");
  if (!btn) throw new Error("no .vms-button rendered");
  return btn as HTMLElement;
}

function renderText(node: ViewNode): HTMLElement {
  const container = freshContainer();
  new BrowserAdapter(container).render({ type: "page", children: [node] }, () => {});
  const el = container.querySelector(".vms-text");
  if (!el) throw new Error("no .vms-text rendered");
  return el as HTMLElement;
}

function renderImage(node: ViewNode): HTMLImageElement {
  const container = freshContainer();
  new BrowserAdapter(container).render({ type: "page", children: [node] }, () => {});
  const el = container.querySelector("img.vms-image");
  if (!el) throw new Error("no img.vms-image rendered");
  return el as HTMLImageElement;
}

describe("THEME-03 — page density modifier emission (D-04 idiom)", () => {
  it('density: "compact" ⇒ root className contains vms-page--compact', () => {
    const el = renderPage({ type: "page", children: [], density: "compact" });
    expect(el.className).toContain("vms-page--compact");
    expect(el.classList.contains("vms-page")).toBe(true);
    expect(el.classList.contains("vms-page--compact")).toBe(true);
  });

  it('density: "comfortable" ⇒ className === "vms-page" (NO modifier — byte-identical, UI-SPEC regression item 4)', () => {
    const el = renderPage({ type: "page", children: [], density: "comfortable" });
    expect(el.className).toBe("vms-page");
  });

  it('density omitted ⇒ className === "vms-page" (byte-identical to pre-change)', () => {
    const el = renderPage({ type: "page", children: [] });
    expect(el.className).toBe("vms-page");
  });
});

describe("THEME-04 — section card variant emission (D-04 idiom)", () => {
  it('variant: "card" ⇒ section className contains vms-section--card', () => {
    const el = renderSection({ type: "section", children: [], variant: "card" });
    expect(el.className).toContain("vms-section--card");
    expect(el.classList.contains("vms-section")).toBe(true);
    expect(el.classList.contains("vms-section--card")).toBe(true);
  });

  it('variant omitted ⇒ className === "vms-section" (NO modifier — byte-identical, UI-SPEC regression item 4)', () => {
    const el = renderSection({ type: "section", children: [] });
    expect(el.className).toBe("vms-section");
  });
});

describe("LAYOUT-02/03 — page layout preset modifier emission (D-02 idiom)", () => {
  it('layout: "split" => root className contains vms-page--split', () => {
    const el = renderPage({ type: "page", children: [], layout: "split" });
    expect(el.classList.contains("vms-page")).toBe(true);
    expect(el.classList.contains("vms-page--split")).toBe(true);
  });
  it('layout: "cards" => root className contains vms-page--cards', () => {
    const el = renderPage({ type: "page", children: [], layout: "cards" });
    expect(el.classList.contains("vms-page--cards")).toBe(true);
  });
  it('layout: "stack" => className === "vms-page" (NO modifier — byte-identical, LAYOUT-01)', () => {
    const el = renderPage({ type: "page", children: [], layout: "stack" });
    expect(el.className).toBe("vms-page");
  });
  it('layout omitted => className === "vms-page" (byte-identical to pre-change)', () => {
    const el = renderPage({ type: "page", children: [] });
    expect(el.className).toBe("vms-page");
  });
});

describe("LAYOUT-02/03 — section layout preset modifier emission (D-02 idiom)", () => {
  it('layout: "split" => section className contains vms-section--split', () => {
    const el = renderSection({ type: "section", children: [], layout: "split" });
    expect(el.classList.contains("vms-section")).toBe(true);
    expect(el.classList.contains("vms-section--split")).toBe(true);
  });
  it('layout: "cards" => section className contains vms-section--cards', () => {
    const el = renderSection({ type: "section", children: [], layout: "cards" });
    expect(el.classList.contains("vms-section--cards")).toBe(true);
  });
  it('layout: "stack" => className === "vms-section" (NO modifier — byte-identical, LAYOUT-01)', () => {
    const el = renderSection({ type: "section", children: [], layout: "stack" });
    expect(el.className).toBe("vms-section");
  });
  it('layout omitted => className === "vms-section" (byte-identical to pre-change)', () => {
    const el = renderSection({ type: "section", children: [] });
    expect(el.className).toBe("vms-section");
  });
});

describe('0.9.0 / #14 — CopyButtonNode.variant modifier emission (mirrors ButtonNode)', () => {
  it('variant: "primary" ⇒ className contains vms-button--primary', () => {
    const el = renderCopyButton({
      type: "copy-button", text: "x", variant: "primary",
    });
    expect(el.classList.contains("vms-button")).toBe(true);
    expect(el.classList.contains("vms-button--primary")).toBe(true);
  });
  it('variant: "secondary" ⇒ className contains vms-button--secondary', () => {
    const el = renderCopyButton({
      type: "copy-button", text: "x", variant: "secondary",
    });
    expect(el.classList.contains("vms-button--secondary")).toBe(true);
  });
  it('variant: "danger" ⇒ className contains vms-button--danger', () => {
    const el = renderCopyButton({
      type: "copy-button", text: "x", variant: "danger",
    });
    expect(el.classList.contains("vms-button--danger")).toBe(true);
  });
  it('variant omitted ⇒ className === "vms-button" (byte-identical to pre-0.9.0)', () => {
    const el = renderCopyButton({ type: "copy-button", text: "x" });
    expect(el.className).toBe("vms-button");
  });
});

describe('0.7.0 / #13 — PageNode.width modifier emission', () => {
  it('width: "wide" ⇒ className contains vms-page--wide', () => {
    const el = renderPage({ type: "page", children: [], width: "wide" });
    expect(el.classList.contains("vms-page")).toBe(true);
    expect(el.classList.contains("vms-page--wide")).toBe(true);
  });
  it('width: "full" ⇒ className contains vms-page--full', () => {
    const el = renderPage({ type: "page", children: [], width: "full" });
    expect(el.classList.contains("vms-page--full")).toBe(true);
  });
  it('width omitted ⇒ className === "vms-page" (byte-identical to pre-0.7.0)', () => {
    const el = renderPage({ type: "page", children: [] });
    expect(el.className).toBe("vms-page");
  });
  it('width composes with density and layout (all three modifier classes present)', () => {
    const el = renderPage({
      type: "page",
      children: [],
      density: "compact",
      layout: "cards",
      width: "wide",
    });
    expect(el.classList.contains("vms-page--compact")).toBe(true);
    expect(el.classList.contains("vms-page--cards")).toBe(true);
    expect(el.classList.contains("vms-page--wide")).toBe(true);
  });
});

describe('0.11.0 / #8 — TextNode "warning" style emission (symmetric with "error")', () => {
  it('style: "warning" ⇒ className contains vms-text--warning', () => {
    const el = renderText({ type: "text", value: "w", style: "warning" });
    expect(el.classList.contains("vms-text")).toBe(true);
    expect(el.classList.contains("vms-text--warning")).toBe(true);
  });
  it('style: "error" still emits vms-text--error (unregressed)', () => {
    const el = renderText({ type: "text", value: "e", style: "error" });
    expect(el.classList.contains("vms-text--error")).toBe(true);
  });
  it('style omitted ⇒ className === "vms-text" (byte-identical to pre-0.11.0)', () => {
    const el = renderText({ type: "text", value: "x" });
    expect(el.className).toBe("vms-text");
  });
});

describe('0.11.0 / #5 — ImageNode rendering', () => {
  it('renders <img class="vms-image"> carrying src + alt', () => {
    const el = renderImage({ type: "image", src: "/logo.png", alt: "Acme logo" });
    expect(el.tagName).toBe("IMG");
    expect(el.getAttribute("src")).toBe("/logo.png");
    expect(el.getAttribute("alt")).toBe("Acme logo");
    expect(el.className).toBe("vms-image");
  });
  it('size: "medium" ⇒ className contains vms-image--medium', () => {
    const el = renderImage({ type: "image", src: "/a.png", size: "medium" });
    expect(el.classList.contains("vms-image--medium")).toBe(true);
  });
  it('shape: "circle" ⇒ className contains vms-image--circle', () => {
    const el = renderImage({ type: "image", src: "/a.png", shape: "circle" });
    expect(el.classList.contains("vms-image--circle")).toBe(true);
  });
  it('size + shape compose; alt omitted ⇒ no alt attribute', () => {
    const el = renderImage({ type: "image", src: "/a.png", size: "small", shape: "circle" });
    expect(el.classList.contains("vms-image--small")).toBe(true);
    expect(el.classList.contains("vms-image--circle")).toBe(true);
    expect(el.hasAttribute("alt")).toBe(false);
  });
  it('size/shape omitted ⇒ className === "vms-image" (byte-identical baseline)', () => {
    const el = renderImage({ type: "image", src: "/a.png" });
    expect(el.className).toBe("vms-image");
  });
});

describe('#17 — layout="cards"/"split" computed display is actually grid (cascade regression)', () => {
  // The pre-existing describe blocks above are class-emission assertions: they
  // verify the renderer emits e.g. `vms-section--cards`, but never load the
  // stylesheet, so they cannot catch a cascade-shadowing bug where the modifier
  // class is present yet overridden by a later base rule. That is exactly how
  // #17 slipped through. The tests below inject the real default.css into the
  // jsdom document and assert window.getComputedStyle(el).display — the actual
  // property the shadowing broke.
  //
  // jsdom limitation: it does NOT compute grid track layout, so we can't assert
  // "renders as >=2 columns" — but the cascaded `display` value IS the property
  // that the shadowing bug clobbered, and asserting it directly is sufficient
  // regression coverage. The min-width:0 grid-child rule (the secondary fix in
  // Task 1) is not assertable in jsdom for the same reason; it's covered by
  // inspection and the explanatory CSS comment.
  beforeAll(() => injectStylesheet());

  it('section with layout: "cards" computes display: grid (not flex) — #17 cascade fix', () => {
    const el = renderSection({
      type: "section",
      children: [
        { type: "text", value: "a" },
        { type: "text", value: "b" },
      ],
      layout: "cards",
    });
    expect(window.getComputedStyle(el).display).toBe("grid");
  });

  it('section with layout: "split" computes display: grid', () => {
    const el = renderSection({
      type: "section",
      children: [
        { type: "text", value: "a" },
        { type: "text", value: "b" },
      ],
      layout: "split",
    });
    expect(window.getComputedStyle(el).display).toBe("grid");
  });

  it('page with layout: "cards" still computes display: grid (no regression)', () => {
    const el = renderPage({ type: "page", children: [], layout: "cards" });
    expect(window.getComputedStyle(el).display).toBe("grid");
  });

  it('section with layout: "sidebar" still computes display: flex (intentional, untouched)', () => {
    const el = renderSection({ type: "section", children: [], layout: "sidebar" });
    expect(window.getComputedStyle(el).display).toBe("flex");
  });
});
