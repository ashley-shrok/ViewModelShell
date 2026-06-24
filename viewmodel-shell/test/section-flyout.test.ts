// 1.11.0 — SectionNode.flyout jsdom regression coverage.
//
// Asserts:
//   - render shape: flyout:true ⇒ <div class="vms-section vms-section--flyout">
//       with a focusable <button class="vms-section__trigger" type="button">
//       trigger and a <div class="vms-section__panel"> wrapping the children.
//   - headingless fallback: trigger text = "Menu".
//   - variant/layout classes still combine on the flyout wrapper.
//   - precedence: collapsible:true + flyout:true ⇒ renders as collapsible
//       (<details>), flyout ignored (collapsible wins — documented).
//   - default-hidden: the panel computes visibility:hidden with the shipped
//       stylesheet injected (content is not shown until hover/focus).
//   - reveal rule presence: default.css carries the :hover / :focus-within
//       reveal selectors. (The reveal itself is browser-native pseudo-class
//       behavior — not meaningfully evaluable in jsdom — so it's covered by the
//       rule's presence here plus the manual browser verification step.)
//
// Same harness shape as theme-modifiers.test.ts / section-collapsible.test.ts.
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

const cssText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../styles/default.css"),
  "utf8",
);

function injectStylesheet(): void {
  if (document.head.querySelector("style[data-vms-default]")) return;
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

function renderInto(adapter: BrowserAdapter, vm: ViewNode): void {
  adapter.render(vm, () => {});
}

describe("SectionNode.flyout — render shape", () => {
  it("flyout:true ⇒ wrapper is <div> with vms-section + vms-section--flyout classes", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Admin",
      flyout: true,
      children: [],
    });
    const el = container.querySelector(".vms-section") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.tagName).toBe("DIV");
    expect(el.classList.contains("vms-section")).toBe(true);
    expect(el.classList.contains("vms-section--flyout")).toBe(true);
  });

  it('flyout:true ⇒ first child is <button type="button" class="vms-section__trigger"> with textContent === heading', () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Admin",
      flyout: true,
      children: [],
    });
    const wrapper = container.querySelector(".vms-section--flyout") as HTMLElement;
    const trigger = wrapper.firstElementChild as HTMLButtonElement;
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("type")).toBe("button");
    expect(trigger.className).toBe("vms-section__trigger");
    expect(trigger.textContent).toBe("Admin");
  });

  it("flyout:true with no heading ⇒ trigger textContent === 'Menu' (documented fallback)", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      flyout: true,
      children: [],
    });
    const trigger = container.querySelector(".vms-section__trigger") as HTMLElement;
    expect(trigger.textContent).toBe("Menu");
  });

  it("flyout:true ⇒ children are wrapped in a <div class=\"vms-section__panel\">", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Admin",
      flyout: true,
      children: [
        { type: "link", label: "Settings", href: "/settings", external: false },
        { type: "link", label: "Profile", href: "/profile", external: false },
      ],
    });
    const wrapper = container.querySelector(".vms-section--flyout") as HTMLElement;
    const panel = wrapper.querySelector(".vms-section__panel") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.tagName).toBe("DIV");
    // Panel is the wrapper's last child (after the trigger) and holds the links.
    expect(wrapper.lastElementChild).toBe(panel);
    const links = panel.querySelectorAll("a.vms-link");
    expect(links.length).toBe(2);
    expect(links[0].textContent).toBe("Settings");
  });

  it("flyout:true + variant:'card' + layout:'row' ⇒ classes combine on the wrapper", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Admin",
      flyout: true,
      variant: "card",
      layout: "row",
      children: [],
    });
    const el = container.querySelector(".vms-section--flyout") as HTMLElement;
    expect(el.classList.contains("vms-section--card")).toBe(true);
    expect(el.classList.contains("vms-section--row")).toBe(true);
  });

  it("flyout omitted ⇒ ordinary <section> rendering, byte-identical (no flyout artifacts)", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Plain",
      children: [],
    });
    const el = container.querySelector(".vms-section") as HTMLElement;
    expect(el.tagName).toBe("SECTION");
    expect(el.className).toBe("vms-section");
    expect(container.querySelector(".vms-section__trigger")).toBeNull();
    expect(container.querySelector(".vms-section__panel")).toBeNull();
  });
});

describe("SectionNode.flyout — precedence with collapsible (collapsible wins)", () => {
  it("collapsible:true + flyout:true ⇒ renders as collapsible <details>, flyout ignored", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Both",
      collapsible: true,
      flyout: true,
      children: [],
    });
    const el = container.querySelector(".vms-section") as HTMLElement;
    expect(el.tagName).toBe("DETAILS");
    expect(el.classList.contains("vms-section--collapsible")).toBe(true);
    expect(el.classList.contains("vms-section--flyout")).toBe(false);
    expect(container.querySelector(".vms-section__trigger")).toBeNull();
  });
});

describe("SectionNode.flyout — styling (shipped default.css)", () => {
  beforeAll(() => injectStylesheet());

  it("panel computes visibility:hidden by default (content hidden until hover/focus)", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Admin",
      flyout: true,
      children: [{ type: "link", label: "Settings", href: "/settings", external: false }],
    });
    const panel = container.querySelector(".vms-section__panel") as HTMLElement;
    expect(window.getComputedStyle(panel).visibility).toBe("hidden");
  });

  it("default.css carries the :hover / :focus-within reveal rule for the panel", () => {
    // The reveal is browser-native pseudo-class behavior (not evaluable in jsdom);
    // assert the selectors exist so the reveal can't be silently dropped.
    expect(cssText).toContain(".vms-section--flyout:hover > .vms-section__panel");
    expect(cssText).toContain(".vms-section--flyout:focus-within > .vms-section__panel");
  });
});
