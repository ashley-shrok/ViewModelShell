// Fill layout axis — page.fill + section.fill render the full-height app-shell
// modifier classes (.vms-page--fill / .vms-section--fill), and are ABSENT when
// the field is omitted/false. Mirrors the direct-BrowserAdapter assertion style
// of renderer-correctness.test.ts.

import { describe, it, expect, afterEach } from "vitest";
import type { PageNode, ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function renderPage(page: PageNode): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  new BrowserAdapter(container).render(page, () => {});
  return container;
}

function renderInPage(node: ViewNode): HTMLElement {
  return renderPage({ type: "page", children: [node] });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("PageNode.fill — full-height app shell", () => {
  it("emits .vms-page--fill when fill:true", () => {
    const c = renderPage({ type: "page", fill: true, children: [{ type: "text", value: "x" }] });
    const page = c.querySelector(".vms-page")!;
    expect(page.classList.contains("vms-page--fill")).toBe(true);
  });

  it("omits .vms-page--fill when fill is absent", () => {
    const c = renderPage({ type: "page", children: [{ type: "text", value: "x" }] });
    const page = c.querySelector(".vms-page")!;
    expect(page.classList.contains("vms-page--fill")).toBe(false);
  });

  it("omits .vms-page--fill when fill:false", () => {
    const c = renderPage({ type: "page", fill: false, children: [{ type: "text", value: "x" }] });
    const page = c.querySelector(".vms-page")!;
    expect(page.classList.contains("vms-page--fill")).toBe(false);
  });
});

describe("SectionNode.fill — internally-scrolling body region", () => {
  it("emits .vms-section--fill when fill:true", () => {
    const c = renderInPage({ type: "section", fill: true, children: [{ type: "text", value: "x" }] });
    const section = c.querySelector(".vms-section")!;
    expect(section.classList.contains("vms-section--fill")).toBe(true);
  });

  it("emits .vms-section--fill on a linked section (a[href]) when fill:true", () => {
    const c = renderInPage({
      type: "section",
      fill: true,
      link: { url: "/somewhere" },
      children: [{ type: "text", value: "x" }],
    });
    const section = c.querySelector(".vms-section")!;
    expect(section.tagName.toLowerCase()).toBe("a");
    expect(section.classList.contains("vms-section--fill")).toBe(true);
  });

  it("emits .vms-section--fill on a collapsible section (<details>) when fill:true", () => {
    const c = renderInPage({
      type: "section",
      fill: true,
      collapsible: true,
      heading: "More",
      children: [{ type: "text", value: "x" }],
    });
    const section = c.querySelector(".vms-section")!;
    expect(section.tagName.toLowerCase()).toBe("details");
    expect(section.classList.contains("vms-section--fill")).toBe(true);
  });

  it("composes with layout — a fill section still arranges its own children", () => {
    const c = renderInPage({ type: "section", fill: true, layout: "row", children: [{ type: "text", value: "x" }] });
    const section = c.querySelector(".vms-section")!;
    expect(section.classList.contains("vms-section--fill")).toBe(true);
    expect(section.classList.contains("vms-section--row")).toBe(true);
  });

  it("omits .vms-section--fill when fill is absent", () => {
    const c = renderInPage({ type: "section", children: [{ type: "text", value: "x" }] });
    const section = c.querySelector(".vms-section")!;
    expect(section.classList.contains("vms-section--fill")).toBe(false);
  });

  it("omits .vms-section--fill when fill:false", () => {
    const c = renderInPage({ type: "section", fill: false, children: [{ type: "text", value: "x" }] });
    const section = c.querySelector(".vms-section")!;
    expect(section.classList.contains("vms-section--fill")).toBe(false);
  });
});
