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
  it('layout: "row" => root className contains vms-page--row (1.11.0)', () => {
    const el = renderPage({ type: "page", children: [], layout: "row" });
    expect(el.classList.contains("vms-page--row")).toBe(true);
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
  it('layout: "row" => section className contains vms-section--row (1.11.0)', () => {
    const el = renderSection({ type: "section", children: [], layout: "row" });
    expect(el.classList.contains("vms-section")).toBe(true);
    expect(el.classList.contains("vms-section--row")).toBe(true);
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

describe("ALIGN-01/02/03 — arrange/align modifier emission (1.12.0)", () => {
  const arrangeValues = [
    "start", "center", "end", "space-between", "space-around", "space-evenly",
  ] as const;
  const alignValues = ["start", "center", "end", "stretch", "baseline"] as const;

  // page — arrange
  for (const v of arrangeValues) {
    it(`page arrange:"${v}" => root className contains vms-arrange--${v}`, () => {
      const el = renderPage({ type: "page", children: [], layout: "row", arrange: v });
      expect(el.classList.contains(`vms-arrange--${v}`)).toBe(true);
    });
  }
  // page — align
  for (const v of alignValues) {
    it(`page align:"${v}" => root className contains vms-align--${v}`, () => {
      const el = renderPage({ type: "page", children: [], layout: "row", align: v });
      expect(el.classList.contains(`vms-align--${v}`)).toBe(true);
    });
  }
  // section — arrange
  for (const v of arrangeValues) {
    it(`section arrange:"${v}" => section className contains vms-arrange--${v}`, () => {
      const el = renderSection({ type: "section", children: [], layout: "row", arrange: v });
      expect(el.classList.contains(`vms-arrange--${v}`)).toBe(true);
    });
  }
  // section — align
  for (const v of alignValues) {
    it(`section align:"${v}" => section className contains vms-align--${v}`, () => {
      const el = renderSection({ type: "section", children: [], layout: "row", align: v });
      expect(el.classList.contains(`vms-align--${v}`)).toBe(true);
    });
  }

  // byte-identical-when-omitted: neither field ⇒ no vms-arrange--/vms-align-- token
  it("page with NEITHER arrange nor align => no vms-arrange-- / vms-align-- class", () => {
    const el = renderPage({ type: "page", children: [], layout: "row" });
    expect(el.className).not.toMatch(/vms-arrange--/);
    expect(el.className).not.toMatch(/vms-align--/);
  });
  it("section with NEITHER arrange nor align => no vms-arrange-- / vms-align-- class", () => {
    const el = renderSection({ type: "section", children: [], layout: "row" });
    expect(el.className).not.toMatch(/vms-arrange--/);
    expect(el.className).not.toMatch(/vms-align--/);
  });
  // a bare row (no arrange/align) is byte-identical to today's plain row class
  it("bare row page => className === 'vms-page vms-page--row' (byte-identical to today)", () => {
    const el = renderPage({ type: "page", children: [], layout: "row" });
    expect(el.className).toBe("vms-page vms-page--row");
  });
  it("bare row section => className === 'vms-section vms-section--row' (byte-identical to today)", () => {
    const el = renderSection({ type: "section", children: [], layout: "row" });
    expect(el.className).toBe("vms-section vms-section--row");
  });

  // emission present in non-base section branches (collapsible / link)
  it("collapsible section with arrange/align still carries the modifier classes", () => {
    const el = renderSection({
      type: "section", children: [], layout: "row",
      collapsible: true, arrange: "space-between", align: "stretch",
    });
    expect(el.classList.contains("vms-section--collapsible")).toBe(true);
    expect(el.classList.contains("vms-arrange--space-between")).toBe(true);
    expect(el.classList.contains("vms-align--stretch")).toBe(true);
  });
  it("link section with arrange/align still carries the modifier classes", () => {
    const el = renderSection({
      type: "section", children: [], layout: "row",
      link: { url: "/x" }, arrange: "end", align: "start",
    });
    expect(el.classList.contains("vms-section--linked")).toBe(true);
    expect(el.classList.contains("vms-arrange--end")).toBe(true);
    expect(el.classList.contains("vms-align--start")).toBe(true);
  });
});

describe("CHILD-01/02 — alignSelf/maxWidth child-side modifier emission (3.2.0)", () => {
  const alignSelfValues = ["start", "center", "end"] as const;
  const maxWidthValues = ["half", "two-thirds", "three-quarters", "prose"] as const;

  // section — alignSelf
  for (const v of alignSelfValues) {
    it(`section alignSelf:"${v}" => section className contains vms-self--${v}`, () => {
      const el = renderSection({ type: "section", children: [], alignSelf: v });
      expect(el.classList.contains(`vms-self--${v}`)).toBe(true);
    });
  }
  // section — maxWidth
  for (const v of maxWidthValues) {
    it(`section maxWidth:"${v}" => section className contains vms-maxw--${v}`, () => {
      const el = renderSection({ type: "section", children: [], maxWidth: v });
      expect(el.classList.contains(`vms-maxw--${v}`)).toBe(true);
    });
  }

  // byte-identical-when-omitted: neither field ⇒ no vms-self--/vms-maxw-- token
  it("section with NEITHER alignSelf nor maxWidth => no vms-self-- / vms-maxw-- class", () => {
    const el = renderSection({ type: "section", children: [] });
    expect(el.className).not.toMatch(/vms-self--/);
    expect(el.className).not.toMatch(/vms-maxw--/);
  });

  // emission present in the non-base section branches (collapsible / link)
  it("collapsible section carries alignSelf/maxWidth classes", () => {
    const el = renderSection({
      type: "section", children: [], collapsible: true,
      alignSelf: "center", maxWidth: "prose",
    });
    expect(el.classList.contains("vms-section--collapsible")).toBe(true);
    expect(el.classList.contains("vms-self--center")).toBe(true);
    expect(el.classList.contains("vms-maxw--prose")).toBe(true);
  });
  it("link section carries alignSelf/maxWidth classes", () => {
    const el = renderSection({
      type: "section", children: [], link: { url: "/x" },
      alignSelf: "end", maxWidth: "half",
    });
    expect(el.classList.contains("vms-section--linked")).toBe(true);
    expect(el.classList.contains("vms-self--end")).toBe(true);
    expect(el.classList.contains("vms-maxw--half")).toBe(true);
  });

  // the motivating chat-bubble composition: one card pinned right, capped
  it("chat-bubble combo (alignSelf:end + maxWidth:three-quarters) carries both", () => {
    const el = renderSection({
      type: "section", children: [], variant: "card",
      alignSelf: "end", maxWidth: "three-quarters", tone: "info",
    });
    expect(el.classList.contains("vms-section--card")).toBe(true);
    expect(el.classList.contains("vms-self--end")).toBe(true);
    expect(el.classList.contains("vms-maxw--three-quarters")).toBe(true);
    expect(el.classList.contains("vms-section--info")).toBe(true);
  });
});

describe("SWITCH-01/02 — switcher threshold/limit modifier emission (1.13.0)", () => {
  const thresholdValues = ["sm", "md", "lg", "xl"] as const;
  const limitValues = [2, 4, 8] as const;

  // page — threshold
  for (const v of thresholdValues) {
    it(`page switcher + threshold:"${v}" => root className contains vms-switch--${v}`, () => {
      const el = renderPage({ type: "page", children: [], layout: "switcher", threshold: v });
      expect(el.classList.contains("vms-page--switcher")).toBe(true);
      expect(el.classList.contains(`vms-switch--${v}`)).toBe(true);
    });
  }
  // section — threshold
  for (const v of thresholdValues) {
    it(`section switcher + threshold:"${v}" => section className contains vms-switch--${v}`, () => {
      const el = renderSection({ type: "section", children: [], layout: "switcher", threshold: v });
      expect(el.classList.contains("vms-section--switcher")).toBe(true);
      expect(el.classList.contains(`vms-switch--${v}`)).toBe(true);
    });
  }
  // page — limit
  for (const v of limitValues) {
    it(`page switcher + limit:${v} => root className contains vms-switch-limit--${v}`, () => {
      const el = renderPage({ type: "page", children: [], layout: "switcher", limit: v });
      expect(el.classList.contains(`vms-switch-limit--${v}`)).toBe(true);
    });
  }
  // section — limit
  for (const v of limitValues) {
    it(`section switcher + limit:${v} => section className contains vms-switch-limit--${v}`, () => {
      const el = renderSection({ type: "section", children: [], layout: "switcher", limit: v });
      expect(el.classList.contains(`vms-switch-limit--${v}`)).toBe(true);
    });
  }

  // byte-identical-when-omitted: a bare switcher (no threshold, no limit) emits
  // EXACTLY the layout class — no vms-switch-- and no vms-switch-limit-- token.
  it("bare switcher page => className === 'vms-page vms-page--switcher' (byte-identical)", () => {
    const el = renderPage({ type: "page", children: [], layout: "switcher" });
    expect(el.className).toBe("vms-page vms-page--switcher");
  });
  it("bare switcher section => className === 'vms-section vms-section--switcher' (byte-identical)", () => {
    const el = renderSection({ type: "section", children: [], layout: "switcher" });
    expect(el.className).toBe("vms-section vms-section--switcher");
  });
  it("bare switcher page => no vms-switch-- / vms-switch-limit-- class", () => {
    const el = renderPage({ type: "page", children: [], layout: "switcher" });
    expect(el.className).not.toMatch(/vms-switch--/);
    expect(el.className).not.toMatch(/vms-switch-limit--/);
  });

  // emission present in non-base section branches (collapsible)
  it("collapsible switcher section with threshold/limit still carries the modifier classes", () => {
    const el = renderSection({
      type: "section", children: [], layout: "switcher",
      collapsible: true, threshold: "md", limit: 4,
    });
    expect(el.classList.contains("vms-section--collapsible")).toBe(true);
    expect(el.classList.contains("vms-switch--md")).toBe(true);
    expect(el.classList.contains("vms-switch-limit--4")).toBe(true);
  });
});

describe("GRID-01 — cards minItem modifier emission (1.13.0)", () => {
  const minItemValues = ["xs", "sm", "md", "lg", "xl"] as const;

  // page — minItem (every value)
  for (const v of minItemValues) {
    it(`page cards + minItem:"${v}" => root className contains vms-cards-min--${v}`, () => {
      const el = renderPage({ type: "page", children: [], layout: "cards", minItem: v });
      expect(el.classList.contains("vms-page--cards")).toBe(true);
      expect(el.classList.contains(`vms-cards-min--${v}`)).toBe(true);
    });
  }
  // section — minItem (every value)
  for (const v of minItemValues) {
    it(`section cards + minItem:"${v}" => section className contains vms-cards-min--${v}`, () => {
      const el = renderSection({ type: "section", children: [], layout: "cards", minItem: v });
      expect(el.classList.contains("vms-section--cards")).toBe(true);
      expect(el.classList.contains(`vms-cards-min--${v}`)).toBe(true);
    });
  }

  // byte-identical-when-omitted: a bare cards page/section (no minItem) emits
  // EXACTLY the layout class — no vms-cards-min-- token.
  it("bare cards page => className === 'vms-page vms-page--cards' (byte-identical)", () => {
    const el = renderPage({ type: "page", children: [], layout: "cards" });
    expect(el.className).toBe("vms-page vms-page--cards");
  });
  it("bare cards section => className === 'vms-section vms-section--cards' (byte-identical)", () => {
    const el = renderSection({ type: "section", children: [], layout: "cards" });
    expect(el.className).toBe("vms-section vms-section--cards");
  });
  it("bare cards page => no vms-cards-min-- class", () => {
    const el = renderPage({ type: "page", children: [], layout: "cards" });
    expect(el.className).not.toMatch(/vms-cards-min--/);
  });

  // emission present in non-base section branches (collapsible)
  it("collapsible cards section with minItem still carries the modifier class", () => {
    const el = renderSection({
      type: "section", children: [], layout: "cards",
      collapsible: true, minItem: "sm",
    });
    expect(el.classList.contains("vms-section--collapsible")).toBe(true);
    expect(el.classList.contains("vms-cards-min--sm")).toBe(true);
  });
});

describe('3.0.0 — CopyButtonNode emphasis/tone modifier emission (mirrors ButtonNode)', () => {
  it('emphasis: "primary" ⇒ className contains vms-button--primary', () => {
    const el = renderCopyButton({
      type: "copy-button", text: "x", emphasis: "primary",
    });
    expect(el.classList.contains("vms-button")).toBe(true);
    expect(el.classList.contains("vms-button--primary")).toBe(true);
  });
  it('emphasis: "secondary" ⇒ className contains vms-button--secondary', () => {
    const el = renderCopyButton({
      type: "copy-button", text: "x", emphasis: "secondary",
    });
    expect(el.classList.contains("vms-button--secondary")).toBe(true);
  });
  it('tone: "danger" ⇒ className contains vms-button--danger', () => {
    const el = renderCopyButton({
      type: "copy-button", text: "x", tone: "danger",
    });
    expect(el.classList.contains("vms-button--danger")).toBe(true);
  });
  it('all axes omitted ⇒ className === "vms-button"', () => {
    const el = renderCopyButton({ type: "copy-button", text: "x" });
    expect(el.className).toBe("vms-button");
  });
  it('emphasis × tone × size compose into three independent modifier classes', () => {
    const el = renderCopyButton({
      type: "copy-button", text: "x", emphasis: "primary", tone: "danger", size: "sm",
    });
    expect(el.classList.contains("vms-button--primary")).toBe(true);
    expect(el.classList.contains("vms-button--danger")).toBe(true);
    expect(el.classList.contains("vms-button--sm")).toBe(true);
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

describe('3.0.0 — TextNode tone modifier emission (was style:"error"/"warning")', () => {
  it('tone: "warning" ⇒ className contains vms-text--warning', () => {
    const el = renderText({ type: "text", value: "w", tone: "warning" });
    expect(el.classList.contains("vms-text")).toBe(true);
    expect(el.classList.contains("vms-text--warning")).toBe(true);
  });
  it('tone: "danger" ⇒ className contains vms-text--danger (renamed from vms-text--error)', () => {
    const el = renderText({ type: "text", value: "e", tone: "danger" });
    expect(el.classList.contains("vms-text--danger")).toBe(true);
  });
  it('style (typography) and tone (color) compose on one text node', () => {
    const el = renderText({ type: "text", value: "h", style: "heading", tone: "danger" });
    expect(el.classList.contains("vms-text--heading")).toBe(true);
    expect(el.classList.contains("vms-text--danger")).toBe(true);
  });
  it('style omitted ⇒ className === "vms-text" (byte-identical to pre-0.11.0)', () => {
    const el = renderText({ type: "text", value: "x" });
    expect(el.className).toBe("vms-text");
  });
});

describe('3.0.0 — SectionNode tone modifier emission (status surfaces)', () => {
  // Regression guard: a renderer-only bug once shipped the tone class on the
  // collapsible/linked section paths but NOT the plain <section> path (the
  // common one), so card+tone rendered as a plain gray card. Parity can't catch
  // this — it diffs the backend WIRE, not the emitted DOM classes — so it is
  // unit-tested here. Cover all three section render paths.
  it('plain section: tone "warning" ⇒ className contains vms-section--warning', () => {
    const el = renderSection({ type: "section", tone: "warning", children: [] });
    expect(el.classList.contains("vms-section--warning")).toBe(true);
  });
  it('card + tone compose: both vms-section--card and vms-section--danger present', () => {
    const el = renderSection({ type: "section", variant: "card", tone: "danger", children: [] });
    expect(el.classList.contains("vms-section--card")).toBe(true);
    expect(el.classList.contains("vms-section--danger")).toBe(true);
  });
  it('collapsible section path emits the tone class', () => {
    const el = renderSection({ type: "section", collapsible: true, tone: "success", children: [] });
    expect(el.classList.contains("vms-section--success")).toBe(true);
  });
  it('linked section path emits the tone class', () => {
    const el = renderSection({ type: "section", link: { url: "/x" }, tone: "info", children: [] });
    expect(el.classList.contains("vms-section--info")).toBe(true);
  });
  it('no tone ⇒ no tone modifier class', () => {
    const el = renderSection({ type: "section", variant: "card", children: [] });
    expect(el.className).toBe("vms-section vms-section--card");
  });
});

describe('3.1.0 / #22 — button width, divider, form submitButton', () => {
  function render(node: ViewNode): HTMLElement {
    const c = freshContainer();
    new BrowserAdapter(c).render(node, () => {});
    return c;
  }
  it('button width:"full" ⇒ className contains vms-button--full', () => {
    const c = render({ type: "button", label: "x", action: { name: "a" }, width: "full" });
    expect(c.querySelector(".vms-button")!.classList.contains("vms-button--full")).toBe(true);
  });
  it('button width:"auto" (or omitted) ⇒ no vms-button--full', () => {
    const c = render({ type: "button", label: "x", action: { name: "a" }, width: "auto" });
    expect(c.querySelector(".vms-button")!.classList.contains("vms-button--full")).toBe(false);
  });
  it('divider (horizontal) ⇒ <hr class="vms-divider">', () => {
    const c = render({ type: "divider" });
    const hr = c.querySelector("hr.vms-divider");
    expect(hr).not.toBeNull();
  });
  it('divider orientation:"vertical" ⇒ role=separator div with aria-orientation', () => {
    const c = render({ type: "divider", orientation: "vertical" });
    const el = c.querySelector(".vms-divider--vertical")!;
    expect(el.getAttribute("role")).toBe("separator");
    expect(el.getAttribute("aria-orientation")).toBe("vertical");
  });
  it('form submitButton ⇒ a type=submit button carrying the button\'s axis classes', () => {
    const c = render({
      type: "form",
      children: [{ type: "field", name: "q", inputType: "text", bind: "q", label: "Q" }],
      submitButton: { type: "button", label: "Search", action: { name: "search" }, emphasis: "primary", width: "full" },
    });
    const submit = c.querySelector("button[type=submit]")!;
    expect(submit.textContent).toBe("Search");
    expect(submit.classList.contains("vms-button--primary")).toBe(true);
    expect(submit.classList.contains("vms-button--full")).toBe(true);
  });
  it('form submitButton dispatches its action on submit', () => {
    const c = freshContainer();
    let fired: string | null = null;
    new BrowserAdapter(c).render({
      type: "form",
      children: [{ type: "field", name: "q", inputType: "text", bind: "q", label: "Q" }],
      submitButton: { type: "button", label: "Go", action: { name: "did-submit" } },
    }, (a) => { fired = a.name; });
    c.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    expect(fired).toBe("did-submit");
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
  it('size + shape compose; alt omitted ⇒ explicit empty alt="" (a11y: decorative)', () => {
    const el = renderImage({ type: "image", src: "/a.png", size: "small", shape: "circle" });
    expect(el.classList.contains("vms-image--small")).toBe(true);
    expect(el.classList.contains("vms-image--circle")).toBe(true);
    // alt is ALWAYS set: empty string for a decorative image (assistive tech
    // skips alt="" rather than announcing the src for a missing alt).
    expect(el.hasAttribute("alt")).toBe(true);
    expect(el.getAttribute("alt")).toBe("");
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

  it('section with layout: "row" computes display: flex, flex-direction: row (1.11.0)', () => {
    const el = renderSection({
      type: "section",
      children: [
        { type: "text", value: "a" },
        { type: "text", value: "b" },
      ],
      layout: "row",
    });
    const cs = window.getComputedStyle(el);
    expect(cs.display).toBe("flex");
    expect(cs.flexDirection).toBe("row");
  });
});
