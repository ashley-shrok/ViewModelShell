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

describe("6.10.0 — ListItemNode.completed: task-list marker (GFM checklist)", () => {
  function renderLI(node: ViewNode): HTMLElement {
    const container = freshContainer();
    new BrowserAdapter(container).render({ type: "page", children: [node] }, () => {});
    return container;
  }

  it("completed absent ⇒ NO marker glyph rendered (byte-identical baseline)", () => {
    const c = renderLI({ type: "list", children: [
      { type: "list-item", children: [{ type: "text", value: "plain item" }] },
    ]});
    const li = c.querySelector("li.vms-list-item") as HTMLElement;
    expect(li).not.toBeNull();
    expect(li.querySelector(".vms-list-item__marker")).toBeNull();
    expect(li.classList.contains("vms-list-item--task-done")).toBe(false);
    expect(li.classList.contains("vms-list-item--task-todo")).toBe(false);
  });

  it("completed: true ⇒ filled ☑ glyph + .vms-list-item--task-done modifier", () => {
    const c = renderLI({ type: "list", children: [
      { type: "list-item", completed: true, children: [{ type: "text", value: "done thing" }] },
    ]});
    const li = c.querySelector("li.vms-list-item") as HTMLElement;
    expect(li.classList.contains("vms-list-item--task-done")).toBe(true);
    const marker = li.querySelector(".vms-list-item__marker") as HTMLElement;
    expect(marker).not.toBeNull();
    expect(marker.textContent).toBe("☑");
    // aria-hidden — the glyph is a visual cue only; the a11y-readable text
    // lives in the item's content nodes.
    expect(marker.getAttribute("aria-hidden")).toBe("true");
  });

  it("completed: false ⇒ empty ☐ glyph + .vms-list-item--task-todo modifier", () => {
    const c = renderLI({ type: "list", children: [
      { type: "list-item", completed: false, children: [{ type: "text", value: "todo thing" }] },
    ]});
    const li = c.querySelector("li.vms-list-item") as HTMLElement;
    expect(li.classList.contains("vms-list-item--task-todo")).toBe(true);
    const marker = li.querySelector(".vms-list-item__marker") as HTMLElement;
    expect(marker).not.toBeNull();
    expect(marker.textContent).toBe("☐");
  });

  it("completed composes with tone + state (all three axes together)", () => {
    const c = renderLI({ type: "list", children: [
      { type: "list-item", completed: true, state: "active", tone: "success",
        children: [{ type: "text", value: "priority done" }] },
    ]});
    const li = c.querySelector("li.vms-list-item") as HTMLElement;
    expect(li.classList.contains("vms-list-item--task-done")).toBe(true);
    expect(li.classList.contains("vms-list-item--active")).toBe(true);
    expect(li.classList.contains("vms-list-item--success")).toBe(true);
  });

  it("mixed list — completed / not-completed / absent renders all three cases correctly", () => {
    const c = renderLI({ type: "list", children: [
      { type: "list-item", completed: true,  children: [{ type: "text", value: "done" }] },
      { type: "list-item", completed: false, children: [{ type: "text", value: "todo" }] },
      { type: "list-item",                   children: [{ type: "text", value: "plain" }] },
    ]});
    const items = c.querySelectorAll("li.vms-list-item");
    expect(items.length).toBe(3);
    expect(items[0].querySelector(".vms-list-item__marker")?.textContent).toBe("☑");
    expect(items[1].querySelector(".vms-list-item__marker")?.textContent).toBe("☐");
    expect(items[2].querySelector(".vms-list-item__marker")).toBeNull();
  });
});

describe("6.10.0 — BlockquoteNode: semantic <blockquote> holding block-level children", () => {
  function renderBQ(node: ViewNode): HTMLElement {
    const container = freshContainer();
    new BrowserAdapter(container).render({ type: "page", children: [node] }, () => {});
    return container;
  }

  it("emits <blockquote class='vms-blockquote'> with children", () => {
    const c = renderBQ({
      type: "blockquote",
      children: [{ type: "text", value: "quoted paragraph" }],
    });
    const bq = c.querySelector("blockquote.vms-blockquote") as HTMLElement;
    expect(bq).not.toBeNull();
    expect(bq.tagName).toBe("BLOCKQUOTE");
    expect(bq.textContent).toBe("quoted paragraph");
  });

  it("holds arbitrary block-level children (list, text, nested blockquote)", () => {
    const c = renderBQ({
      type: "blockquote",
      children: [
        { type: "text", value: "outer intro" },
        { type: "list", children: [
          { type: "list-item", children: [{ type: "text", value: "item A" }] },
        ]},
        { type: "blockquote", children: [
          { type: "text", value: "inner nested quote" },
        ]},
      ],
    });
    const outer = c.querySelector("blockquote.vms-blockquote") as HTMLElement;
    expect(outer).not.toBeNull();
    // The nested blockquote lives INSIDE the outer one.
    const nested = outer.querySelector("blockquote.vms-blockquote") as HTMLElement;
    expect(nested).not.toBeNull();
    expect(nested.textContent).toBe("inner nested quote");
    // The list and its item also render inside.
    expect(outer.querySelector("ul.vms-list li.vms-list-item")).not.toBeNull();
  });

  it("empty children ⇒ empty <blockquote> (still valid — quote with no visible content)", () => {
    const c = renderBQ({ type: "blockquote", children: [] });
    const bq = c.querySelector("blockquote.vms-blockquote") as HTMLElement;
    expect(bq).not.toBeNull();
    expect(bq.children.length).toBe(0);
  });
});

describe("6.10.0 — TextNode.level: semantic h1–h6 emission (heading landmark)", () => {
  function renderTextRaw(node: ViewNode): HTMLElement {
    const container = freshContainer();
    new BrowserAdapter(container).render({ type: "page", children: [node] }, () => {});
    return container;
  }
  // Cover every valid level 1–6: each must emit its own <hN> tag (screen-reader
  // landmark), still carry the .vms-text class (so all existing typography +
  // tone rules keep applying), and render the value the same way TextNode
  // always has.
  for (const lvl of [1, 2, 3, 4, 5, 6] as const) {
    it(`level: ${lvl} ⇒ <h${lvl} class="vms-text">value`, () => {
      const c = renderTextRaw({ type: "text", value: `Level ${lvl}`, level: lvl });
      const el = c.querySelector(`h${lvl}.vms-text`) as HTMLElement;
      expect(el).not.toBeNull();
      expect(el.tagName).toBe(`H${lvl}`);
      expect(el.textContent).toBe(`Level ${lvl}`);
    });
  }

  it("level absent ⇒ <span class=vms-text> (byte-identical baseline)", () => {
    const c = renderTextRaw({ type: "text", value: "paragraph" });
    const el = c.querySelector(".vms-text") as HTMLElement;
    expect(el.tagName).toBe("SPAN");
  });

  it("level composes with tone: <h2 class='vms-text vms-text--danger'>", () => {
    const c = renderTextRaw({ type: "text", value: "warning heading", level: 2, tone: "danger" });
    const el = c.querySelector("h2.vms-text") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.classList.contains("vms-text--danger")).toBe(true);
  });

  it("level composes with runs: <h3> contains the rich-run <strong>", () => {
    const c = renderTextRaw({
      type: "text",
      value: "Section one",
      level: 3,
      runs: [{ text: "Section " }, { text: "one", bold: true }],
    });
    const el = c.querySelector("h3.vms-text") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.textContent).toBe("Section one");
    expect(el.querySelector("strong.vms-text__strong")).not.toBeNull();
  });

  it("level wins over style: 'pre' (level = semantic outline; style:pre = typography)", () => {
    const c = renderTextRaw({ type: "text", value: "heading beats pre", level: 2, style: "pre" });
    // The semantic tag is h2; style="pre" still emits its class for CSS but
    // does NOT force a <pre> tag when level is set.
    const el = c.querySelector("h2.vms-text.vms-text--pre") as HTMLElement;
    expect(el).not.toBeNull();
  });

  it("level out-of-range (e.g. 7 from a less-strict backend) ⇒ fallback <span>, NOT <h7>", () => {
    // Simulate a wire-drift value the compile-time union would reject but the
    // .NET twin's int? does not gate. Cast escapes the TS union check.
    const c = renderTextRaw({ type: "text", value: "invalid", level: 7 as unknown as 1 });
    // No invalid <h7>.
    expect(c.querySelector("h7")).toBeNull();
    // Falls back to the span baseline.
    const el = c.querySelector("span.vms-text") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.textContent).toBe("invalid");
  });

  it("existing style: 'heading' still renders as <span class=vms-text--heading> (backward compat)", () => {
    const c = renderTextRaw({ type: "text", value: "old-style", style: "heading" });
    const el = c.querySelector("span.vms-text.vms-text--heading") as HTMLElement;
    expect(el).not.toBeNull();
    // NOT a semantic heading — this is the deprecation contract: the old
    // style values keep working as styled spans (no landmark), while `level`
    // is the new path for semantic headings.
    expect(c.querySelector("h1,h2,h3,h4,h5,h6")).toBeNull();
  });
});

describe("6.10.0 — ImageNode.caption: figure/figcaption emission when caption present", () => {
  // Local render helper — we can't reuse renderImage() because a captioned
  // image emits <figure> wrapping <img>, so the "img.vms-image" selector still
  // works but the parent structure matters.
  function renderCaptionedImage(node: ViewNode): HTMLElement {
    const container = freshContainer();
    new BrowserAdapter(container).render({ type: "page", children: [node] }, () => {});
    return container;
  }

  it("caption absent ⇒ bare <img>, NO <figure> wrapper (byte-identical baseline)", () => {
    const c = renderCaptionedImage({ type: "image", src: "/a.png", alt: "a" });
    expect(c.querySelector("figure")).toBeNull();
    expect(c.querySelector("figcaption")).toBeNull();
    const img = c.querySelector("img.vms-image");
    expect(img).not.toBeNull();
    expect(img!.parentElement!.tagName).not.toBe("FIGURE");
  });

  it("caption present ⇒ <figure class=vms-figure><img><figcaption class=vms-figcaption>", () => {
    const c = renderCaptionedImage({
      type: "image",
      src: "/a.png",
      alt: "a",
      caption: "Figure 1: the setup",
    });
    const fig = c.querySelector("figure.vms-figure") as HTMLElement;
    expect(fig).not.toBeNull();
    // <img> is the first child; <figcaption> is the second.
    const img = fig.querySelector("img.vms-image") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.src).toContain("/a.png");
    const cap = fig.querySelector("figcaption.vms-figcaption") as HTMLElement;
    expect(cap).not.toBeNull();
    expect(cap.textContent).toBe("Figure 1: the setup");
  });

  it("caption + size/shape modifiers compose: <img> classes unchanged; figure wraps regardless", () => {
    const c = renderCaptionedImage({
      type: "image",
      src: "/a.png",
      size: "small",
      shape: "circle",
      caption: "avatar",
    });
    const img = c.querySelector("figure.vms-figure > img.vms-image") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.classList.contains("vms-image--small")).toBe(true);
    expect(img.classList.contains("vms-image--circle")).toBe(true);
  });

  it("captionRuns present ⇒ figcaption renders runs INSTEAD of plain caption text", () => {
    const c = renderCaptionedImage({
      type: "image",
      src: "/a.png",
      caption: "figure from the paper",
      captionRuns: [
        { text: "figure from " },
        { text: "the paper", bold: true },
      ],
    });
    const cap = c.querySelector("figcaption.vms-figcaption") as HTMLElement;
    expect(cap).not.toBeNull();
    // Text content is the sum of runs (the derivation contract).
    expect(cap.textContent).toBe("figure from the paper");
    // Bold run emits <strong class="vms-text__strong">.
    const strong = cap.querySelector("strong.vms-text__strong");
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe("the paper");
  });

  it("captionRuns present + href ⇒ figcaption anchor wraps the run (link inside caption)", () => {
    const c = renderCaptionedImage({
      type: "image",
      src: "/a.png",
      caption: "see the docs",
      captionRuns: [
        { text: "see " },
        { text: "the docs", href: "https://example.com/docs", external: true },
      ],
    });
    const cap = c.querySelector("figcaption.vms-figcaption") as HTMLElement;
    const a = cap.querySelector("a.vms-text__link") as HTMLAnchorElement;
    expect(a).not.toBeNull();
    expect(a.href).toBe("https://example.com/docs");
    expect(a.target).toBe("_blank");
    expect(a.rel).toBe("noopener noreferrer");
    expect(a.textContent).toBe("the docs");
  });

  it("caption present but captionRuns EMPTY array ⇒ falls back to plain caption text (matches TextNode rule)", () => {
    const c = renderCaptionedImage({
      type: "image",
      src: "/a.png",
      caption: "fallback",
      captionRuns: [],
    });
    const cap = c.querySelector("figcaption.vms-figcaption") as HTMLElement;
    expect(cap.textContent).toBe("fallback");
    expect(cap.querySelector("strong,em,code,s,a")).toBeNull();
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

describe('sidebar flex children get min-width: 0 (wide-table wrap regression)', () => {
  // A flex item defaults to min-width: auto, so a sidebar child whose min-content
  // exceeds its flex track (e.g. a plain section wrapping a wide/nowrap TableNode)
  // could not shrink and forced the flex line to wrap — rail alone, main dropped
  // below with dead space. The fix adds `min-width: 0` to `.vms-*--sidebar > *`,
  // mirroring the split/cards rule that had explicitly skipped sidebar (#17).
  // Unlike computed grid tracks, min-width is a plain cascaded value jsdom resolves
  // from the injected stylesheet, so this is a real regression assertion.
  beforeAll(() => injectStylesheet());

  it('section layout="sidebar" child computes min-width: 0px', () => {
    const el = renderSection({
      type: "section",
      children: [
        { type: "text", value: "rail" },
        { type: "text", value: "main" },
      ],
      layout: "sidebar",
    });
    // Assert on the SECOND child (main) — the one whose wide-table content used to
    // force the wrap. The rule applies to every child, so first child is 0 too.
    const mw = window.getComputedStyle(el.children[1] as Element).minWidth;
    expect(mw === "0" || mw === "0px").toBe(true); // jsdom emits "0"; a browser "0px"
  });

  it('page layout="sidebar" child computes min-width: 0px', () => {
    const el = renderPage({
      type: "page",
      children: [
        { type: "text", value: "rail" },
        { type: "text", value: "main" },
      ],
      layout: "sidebar",
    });
    const mw = window.getComputedStyle(el.children[1] as Element).minWidth;
    expect(mw === "0" || mw === "0px").toBe(true); // jsdom emits "0"; a browser "0px"
  });
});
