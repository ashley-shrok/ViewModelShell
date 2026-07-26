// v7.0.0 (ICON-01..ICON-04) — browser renderer + cross-node icon emission tests.
//
// jsdom coverage for the standalone icon() renderer AND the 5 host cross-node
// leading-icon emissions. Assertions are DOM shape / class-name / attribute
// checks — no computed-style / visual / pixel checks (those live on the
// verification page in Plan 22-09).

import { describe, it, expect, beforeEach } from "vitest";
import { BrowserAdapter } from "../src/browser.js";
import type { ViewNode } from "../src/index.js";

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispatched: Array<{ name: string }> = [];
  const adapter = new BrowserAdapter(container);
  return {
    container,
    render(vm: ViewNode) {
      adapter.render(vm, (a) => { dispatched.push({ name: a.name }); });
    },
    dispatched,
  };
}

// Reset the container between tests to keep assertions independent.
beforeEach(() => {
  document.body.innerHTML = "";
});

describe("Standalone IconNode (ICON-03)", () => {
  it("bare — default size md, decorative aria-hidden", () => {
    const { container, render } = setup();
    render({ type: "icon", name: "sparkles" });
    const svg = container.querySelector("svg.vms-icon") as SVGElement;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("class")).toBe("vms-icon vms-icon--md");
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("height")).toBe("20");
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("stroke-width")).toBe("2");
    expect(svg.getAttribute("fill")).toBe("none");
    // Decorative branch: aria-hidden, no role, no aria-label.
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
    expect(svg.getAttribute("aria-label")).toBeNull();
    // Payload from ICONS map — sparkles renders at least one <path>.
    expect(svg.innerHTML).toContain("<path");
  });

  it("uses SVG namespace (not HTML) so real browsers actually render", () => {
    const { container, render } = setup();
    render({ type: "icon", name: "activity" });
    const svg = container.querySelector("svg.vms-icon") as SVGElement;
    // createElementNS produces an SVGElement, whose namespaceURI matches the
    // SVG namespace. createElement("svg") would produce an HTMLUnknownElement.
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
  });

  it("size lg + tone danger + label = 24×24 + tone class + role=img + aria-label", () => {
    const { container, render } = setup();
    render({
      type: "icon",
      name: "trash-2",
      size: "lg",
      tone: "danger",
      label: "Delete permanently",
    });
    const svg = container.querySelector("svg.vms-icon") as SVGElement;
    expect(svg.getAttribute("class")).toBe("vms-icon vms-icon--lg vms-icon--danger");
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("height")).toBe("24");
    // Meaning-carrying branch: role=img + aria-label; NOT aria-hidden.
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Delete permanently");
    expect(svg.getAttribute("aria-hidden")).toBeNull();
  });

  it("each size maps to the expected px pair", () => {
    const cases: Array<[
      "xs" | "sm" | "md" | "lg" | "xl",
      string,
    ]> = [
      ["xs", "12"],
      ["sm", "16"],
      ["md", "20"],
      ["lg", "24"],
      ["xl", "32"],
    ];
    for (const [size, px] of cases) {
      const { container, render } = setup();
      render({ type: "icon", name: "star", size });
      const svg = container.querySelector("svg.vms-icon") as SVGElement;
      expect(svg.getAttribute("width")).toBe(px);
      expect(svg.getAttribute("height")).toBe(px);
      expect(svg.getAttribute("class")).toBe(`vms-icon vms-icon--${size}`);
    }
  });
});

describe("Cross-node icon emission (ICON-04)", () => {
  it("ButtonNode.icon → leading <svg class='vms-icon vms-icon--sm'> before label", () => {
    const { container, render } = setup();
    render({
      type: "button",
      label: "Sparkle",
      action: { name: "sparkle" },
      icon: "sparkles",
    });
    const btn = container.querySelector("button.vms-button") as HTMLButtonElement;
    const svg = btn.querySelector("svg.vms-icon") as SVGElement;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("class")).toBe("vms-icon vms-icon--sm");
    // Icon is DECORATIVE inside a labelled button — the button's own text
    // carries the semantic name.
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    // Label text present + comes AFTER the icon (DOM order).
    expect(btn.textContent).toContain("Sparkle");
    // Icon is the first child; label span second.
    expect(btn.firstChild).toBe(svg);
  });

  it("ButtonNode icon+tone → SVG picks up tone class from button", () => {
    const { container, render } = setup();
    render({
      type: "button",
      label: "Delete",
      action: { name: "del" },
      icon: "trash-2",
      tone: "danger",
    });
    const svg = container.querySelector("button svg.vms-icon") as SVGElement;
    expect(svg.getAttribute("class")).toBe("vms-icon vms-icon--sm vms-icon--danger");
  });

  it("Icon-only ButtonNode (label empty, tooltip set) — button carries a11y, icon decorative", () => {
    const { container, render } = setup();
    render({
      type: "button",
      label: "",
      action: { name: "del" },
      icon: "trash-2",
      tooltip: "Delete",
    });
    const btn = container.querySelector("button.vms-button") as HTMLButtonElement;
    // The button-level tooltip → title attr + data-vms-tooltip (existing
    // TOOL-01 behavior). Screen readers announce `title` as the accessible
    // name when no aria-label is present.
    expect(btn.title).toBe("Delete");
    expect(btn.dataset.vmsTooltip).toBe("Delete");
    // The icon inside stays DECORATIVE — the button carries the a11y label,
    // not the SVG.
    const svg = btn.querySelector("svg.vms-icon") as SVGElement;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
  });

  it("SectionNode.icon → leading <svg class='vms-icon vms-icon--xl'> as prominent header glyph", () => {
    const { container, render } = setup();
    render({
      type: "section",
      heading: "Angels",
      variant: "card",
      icon: "sparkles",
      children: [],
    });
    const section = container.querySelector("section.vms-section") as HTMLElement;
    const svg = section.querySelector("svg.vms-icon") as SVGElement;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("class")).toBe("vms-icon vms-icon--xl");
    // Icon is the first child; heading second.
    expect(section.firstChild).toBe(svg);
  });

  it("SectionNode with tone → icon inherits tone class", () => {
    const { container, render } = setup();
    render({
      type: "section",
      heading: "Warning",
      tone: "warning",
      icon: "alert-triangle",
      children: [],
    });
    const svg = container.querySelector("section svg.vms-icon") as SVGElement;
    expect(svg.getAttribute("class")).toBe("vms-icon vms-icon--xl vms-icon--warning");
  });

  it("BadgeNode.icon → leading <svg class='vms-icon vms-icon--xs vms-icon--info'>", () => {
    const { container, render } = setup();
    render({
      type: "badge",
      label: "New",
      tone: "info",
      icon: "star",
    });
    const badge = container.querySelector("span.vms-badge") as HTMLElement;
    const svg = badge.querySelector("svg.vms-icon") as SVGElement;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("class")).toBe("vms-icon vms-icon--xs vms-icon--info");
    // Icon first, label span second — icon is prepended.
    expect(badge.firstChild).toBe(svg);
    expect(badge.textContent).toContain("New");
  });

  it("LinkNode.icon → leading svg WITHOUT a tone class (inherits currentColor)", () => {
    const { container, render } = setup();
    render({
      type: "link",
      label: "Open docs",
      href: "/docs",
      icon: "external-link",
    });
    const a = container.querySelector("a.vms-link") as HTMLAnchorElement;
    const svg = a.querySelector("svg.vms-icon") as SVGElement;
    expect(svg).not.toBeNull();
    // Size sm; NO tone class (link inherits currentColor from surrounding text).
    expect(svg.getAttribute("class")).toBe("vms-icon vms-icon--sm");
    expect(a.firstChild).toBe(svg);
    expect(a.textContent).toContain("Open docs");
  });

  it("ListItemNode.icon → leading <svg class='vms-icon vms-icon--sm'>", () => {
    const { container, render } = setup();
    render({
      type: "list-item",
      children: [{ type: "text", value: "Files" }],
      icon: "folder",
    });
    const li = container.querySelector("li.vms-list-item") as HTMLElement;
    const svg = li.querySelector("svg.vms-icon") as SVGElement;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("class")).toBe("vms-icon vms-icon--sm");
    expect(li.textContent).toContain("Files");
  });

  it("Node without icon renders unchanged (regression guard — icon? optional posture)", () => {
    const { container, render } = setup();
    render({
      type: "button",
      label: "Save",
      action: { name: "save" },
    });
    const btn = container.querySelector("button.vms-button") as HTMLButtonElement;
    // No icon slot; button's text is the label directly, no leading SVG.
    expect(btn.querySelector("svg.vms-icon")).toBeNull();
    expect(btn.textContent).toBe("Save");
  });
});
