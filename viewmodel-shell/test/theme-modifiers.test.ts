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
import { describe, it, expect } from "vitest";
import type { ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

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
