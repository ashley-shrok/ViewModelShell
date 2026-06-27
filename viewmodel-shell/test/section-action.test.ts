// 260614-9hq — SectionNode.action click-anywhere clickable-card primitive.
// Structural mirror of test/table-row-action.test.ts: same A–J case shape,
// substituting SectionNode for TableRow. Plus K + L tree-validation cases
// (action + collapsible, nested action-in-action) against the existing TS
// validateActionNames seam — those rejections live in
// viewmodel-shell/src/server.ts's validateSectionAction (added alongside this
// renderer change).

import { describe, it, expect, vi, afterEach } from "vitest";
import type { ActionEvent, StateAccess, ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";
import { validateSectionAction } from "../src/server.js";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function mkSA(state: Record<string, unknown>): StateAccess {
  return {
    read(path: string): unknown {
      const segs = path.split(".");
      let cur: unknown = state;
      for (const seg of segs) {
        if (cur == null || typeof cur !== "object") return undefined;
        cur = (cur as Record<string, unknown>)[seg];
      }
      return cur;
    },
    write(path: string, value: unknown): void {
      const segs = path.split(".");
      let cur: Record<string, unknown> = state;
      for (let i = 0; i < segs.length - 1; i++) {
        const seg = segs[i]!;
        if (typeof cur[seg] !== "object" || cur[seg] == null) cur[seg] = {};
        cur = cur[seg] as Record<string, unknown>;
      }
      cur[segs[segs.length - 1]!] = value;
    },
  };
}

// Tree used in most tests:
//   Section S1 ("Onboarding") — has action: select-card-1
//     contains a styling-only inner card (no action) with:
//       - ButtonNode close-card-1
//       - CheckboxNode pick-card-1
//       - LinkNode (href="/foo")
//   Section S2 — no action (backward-compat baseline)
const treeMixed = (): ViewNode => ({
  type: "page",
  children: [
    {
      type: "section",
      heading: "Onboarding",
      action: { name: "select-card-1" },
      children: [
        {
          type: "section",
          variant: "card",
          children: [
            { type: "text", value: "Welcome to the app" },
            { type: "button", label: "Close", action: { name: "close-card-1" } },
            {
              type: "checkbox",
              name: "pick-r1",
              bind: "picked.r1",
              label: "Pick",
              action: { name: "pick-card-1" },
            },
            { type: "link", label: "More info", href: "/foo" },
          ],
        },
      ],
    },
    {
      type: "section",
      heading: "Baseline",
      children: [{ type: "text", value: "no action here" }],
    },
  ],
});

function render(view: ViewNode, onAction: (a: ActionEvent) => void) {
  const container = freshContainer();
  const adapter = new BrowserAdapter(container);
  adapter.render(view, onAction, mkSA({ picked: { r1: false } }));
  return container;
}

// Resolve a section by its heading (S1 = "Onboarding", S2 = "Baseline").
function sectionByHeading(container: HTMLElement, heading: string): HTMLElement {
  const sections = Array.from(container.querySelectorAll("section.vms-section"));
  const found = sections.find(s => {
    const h = s.querySelector(".vms-section__heading");
    return h?.textContent === heading;
  });
  if (!found) throw new Error(`section "${heading}" not found`);
  return found as HTMLElement;
}

describe("SectionNode.action — click-anywhere clickable-card primitive (260614-9hq)", () => {
  it("A. clicking anywhere on the section dispatches section.action", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const s1 = sectionByHeading(container, "Onboarding");
    // Click on inner text content (not the button, checkbox, or link)
    const text = s1.querySelector(".vms-text") as HTMLElement;
    expect(text).toBeTruthy();
    text.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ name: "select-card-1" });
  });

  it("B. pressing Enter while focused dispatches section.action", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const s1 = sectionByHeading(container, "Onboarding");
    const ev = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    s1.dispatchEvent(ev);
    expect(onAction).toHaveBeenCalledWith({ name: "select-card-1" });
  });

  it("C. pressing Space dispatches section.action AND calls preventDefault", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const s1 = sectionByHeading(container, "Onboarding");
    const ev = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    s1.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(onAction).toHaveBeenCalledWith({ name: "select-card-1" });
  });

  it("D. pressing Tab does NOT dispatch section.action", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const s1 = sectionByHeading(container, "Onboarding");
    const ev = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    s1.dispatchEvent(ev);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("E. clicking a nested ButtonNode fires its own action but NOT section.action", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const s1 = sectionByHeading(container, "Onboarding");
    const button = s1.querySelector(".vms-button") as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ name: "close-card-1" });
    expect(onAction).not.toHaveBeenCalledWith({ name: "select-card-1" });
  });

  it("F. clicking a nested CheckboxNode does NOT fire section.action", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const s1 = sectionByHeading(container, "Onboarding");
    const checkbox = s1.querySelector(".vms-checkbox__input") as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).not.toHaveBeenCalledWith({ name: "select-card-1" });
  });

  it("G. clicking a nested LinkNode does NOT fire section.action", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const s1 = sectionByHeading(container, "Onboarding");
    const anchor = s1.querySelector("a[href]") as HTMLAnchorElement;
    expect(anchor).toBeTruthy();
    // jsdom's default click on an anchor tries to navigate; suppress.
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.addEventListener("click", (e) => e.preventDefault(), { once: true });
    anchor.dispatchEvent(ev);
    expect(onAction).not.toHaveBeenCalledWith({ name: "select-card-1" });
  });

  it("H. clickable sections expose role='button', tabindex=0, aria-label from heading", () => {
    const container = render(treeMixed(), () => {});
    const s1 = sectionByHeading(container, "Onboarding");
    expect(s1.getAttribute("role")).toBe("button");
    expect(s1.getAttribute("tabindex")).toBe("0");
    expect(s1.getAttribute("aria-label")).toBe("Onboarding");
  });

  it("I. headingless clickable section derives aria-label from descendant text; empty falls back to 'Card'", () => {
    // Headingless variant with descendant text
    const tree1: ViewNode = {
      type: "page",
      children: [
        {
          type: "section",
          action: { name: "select-plan" },
          children: [{ type: "text", value: "Choose plan" }],
        },
      ],
    };
    const c1 = render(tree1, () => {});
    const sec1 = c1.querySelector(".vms-section--clickable") as HTMLElement;
    expect(sec1).toBeTruthy();
    const label1 = sec1.getAttribute("aria-label") ?? "";
    expect(label1).toContain("Choose plan");

    // Fully empty headingless clickable section → "Card"
    document.body.innerHTML = "";
    const tree2: ViewNode = {
      type: "page",
      children: [
        {
          type: "section",
          action: { name: "select-empty" },
          children: [],
        },
      ],
    };
    const c2 = render(tree2, () => {});
    const sec2 = c2.querySelector(".vms-section--clickable") as HTMLElement;
    expect(sec2).toBeTruthy();
    expect(sec2.getAttribute("aria-label")).toBe("Card");
  });

  it("J. backward-compat — a section WITHOUT action has no --clickable class, tabindex, role, or aria-label", () => {
    const container = render(treeMixed(), () => {});
    const s2 = sectionByHeading(container, "Baseline");
    expect(s2.className).not.toContain("vms-section--clickable");
    expect(s2.getAttribute("tabindex")).toBeNull();
    expect(s2.getAttribute("role")).toBeNull();
    expect(s2.getAttribute("aria-label")).toBeNull();
  });

  // ─── Tree validation cases (K + L) — TS-side validateSectionAction ───

  it("K. action + collapsible:true on the same section throws (invalid_tree)", () => {
    const tree: ViewNode = {
      type: "page",
      children: [
        {
          type: "section",
          heading: "Bad",
          action: { name: "select-bad" },
          collapsible: true,
          children: [],
        },
      ],
    };
    expect(() => validateSectionAction(tree)).toThrow(
      /both Action and Collapsible: true/i,
    );
  });

  it("L. nested action-in-action throws (invalid_tree); styling-only inner card is fine", () => {
    const nested: ViewNode = {
      type: "page",
      children: [
        {
          type: "section",
          heading: "Outer",
          action: { name: "select-outer" },
          children: [
            {
              type: "section",
              heading: "Inner",
              action: { name: "select-inner" },
              children: [],
            },
          ],
        },
      ],
    };
    expect(() => validateSectionAction(nested)).toThrow(/Nested SectionNode\.Action/);
    expect(() => validateSectionAction(nested)).toThrow(/Outer/);
    expect(() => validateSectionAction(nested)).toThrow(/Inner/);

    // Styling-only inner card (no action) with internal buttons inside the
    // clickable card is VALID — locked decision.
    const fine: ViewNode = {
      type: "page",
      children: [
        {
          type: "section",
          heading: "Outer",
          action: { name: "select-outer" },
          children: [
            {
              type: "section",
              variant: "card",
              children: [
                { type: "button", label: "Close", action: { name: "close-outer" } },
              ],
            },
          ],
        },
      ],
    };
    expect(() => validateSectionAction(fine)).not.toThrow();
  });

  it("M. nested action-in-action is caught THROUGH a FitsNode wrapper (fits blind spot)", () => {
    // A clickable inner card nested (via a fits candidate) inside a clickable
    // outer card is the same ambiguity case L rejects — the walker must descend
    // into fits children, not stop at the fits node.
    const nestedViaFits: ViewNode = {
      type: "page",
      children: [
        {
          type: "section",
          heading: "Outer",
          action: { name: "select-outer" },
          children: [
            {
              type: "fits",
              children: [
                {
                  type: "section",
                  heading: "Inner",
                  action: { name: "select-inner" },
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(() => validateSectionAction(nestedViaFits)).toThrow(/Nested SectionNode\.Action/);
  });
});
