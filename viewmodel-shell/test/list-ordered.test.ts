// list-ordered.test.ts — jsdom render tests for ListNode.ordered.
// Verifies: ordered:true renders <ol class="vms-list vms-list--ordered">,
// omitted/false renders <ul class="vms-list"> (byte-identical to today), and the
// numbering is the CSS-counter class (not native markers), so the marker class is
// present exactly when ordered. Harness mirrors copy-button.test.ts.
import { describe, it, expect } from "vitest";
import { type ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

function render(vm: ViewNode): HTMLElement {
  const container = freshContainer();
  new BrowserAdapter(container).render(vm, () => {});
  return container;
}

const items: ViewNode[] = [
  { type: "list-item", children: [{ type: "text", value: "First" }] },
  { type: "list-item", children: [{ type: "text", value: "Second" }] },
];

describe("ListNode.ordered", () => {
  it("ordered:true renders <ol> with the ordered marker class", () => {
    const c = render({ type: "list", ordered: true, children: items });
    const ol = c.querySelector("ol");
    expect(ol).not.toBeNull();
    expect(c.querySelector("ul")).toBeNull();
    expect(ol!.className).toBe("vms-list vms-list--ordered");
    expect(ol!.querySelectorAll("li.vms-list-item")).toHaveLength(2);
  });

  it("omitted renders <ul> with no ordered class (byte-identical to today)", () => {
    const c = render({ type: "list", children: items });
    const ul = c.querySelector("ul");
    expect(ul).not.toBeNull();
    expect(c.querySelector("ol")).toBeNull();
    expect(ul!.className).toBe("vms-list");
  });

  it("ordered:false renders <ul> (false is unset, not an ordered list)", () => {
    const c = render({ type: "list", ordered: false, children: items });
    expect(c.querySelector("ul")).not.toBeNull();
    expect(c.querySelector("ol")).toBeNull();
  });
});
