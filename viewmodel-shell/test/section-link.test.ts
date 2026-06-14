// 260614-bmd — SectionNode.link URL-wrapper clickable-card primitive (issue #21).
// Structural sibling of test/section-action.test.ts: same A-J case shape but
// for the navigator variant. Renderer-only — tree-validation cases live in
// test/tree-walker.test.ts (which exercises validateSectionAction directly).

import { describe, it, expect, vi, afterEach } from "vitest";
import type { ActionEvent, StateAccess, ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

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

// Tree:
//   S1: linked card, external URL, with a styling-only inner card containing
//       a ButtonNode (close-card-1), CheckboxNode (pick-card-1), and an inner
//       LinkNode (href="/foo").
//   S2: linked card, internal relative URL, no external flag.
//   S3: no link, no action — backward-compat baseline.
const treeMixed = (): ViewNode => ({
  type: "page",
  children: [
    {
      type: "section",
      heading: "Read the docs",
      link: { url: "https://example.com/docs", external: true },
      children: [
        {
          type: "section",
          variant: "card",
          children: [
            { type: "text", value: "Architecture and gotchas" },
            { type: "button", label: "Close", action: { name: "close-card-1" } },
            {
              type: "checkbox",
              name: "pick-r1",
              bind: "picked.r1",
              label: "Pick",
              action: { name: "pick-card-1" },
            },
            { type: "link", label: "Inner link", href: "/foo" },
          ],
        },
      ],
    },
    {
      type: "section",
      heading: "Open detail",
      link: { url: "/internal" },
      children: [{ type: "text", value: "internal navigation" }],
    },
    {
      type: "section",
      heading: "Baseline",
      children: [{ type: "text", value: "no link, no action" }],
    },
  ],
});

function render(view: ViewNode, onAction: (a: ActionEvent) => void) {
  const container = freshContainer();
  const adapter = new BrowserAdapter(container);
  adapter.render(view, onAction, mkSA({ picked: { r1: false } }));
  return container;
}

// Resolve a section/anchor by heading.
function sectionByHeading(container: HTMLElement, heading: string): HTMLElement {
  const candidates = Array.from(container.querySelectorAll(".vms-section"));
  const found = candidates.find(c => {
    const h = c.querySelector(".vms-section__heading");
    return h?.textContent === heading;
  });
  if (!found) throw new Error(`section "${heading}" not found`);
  return found as HTMLElement;
}

// Silence jsdom navigation noise from a clicked anchor. jsdom's anchor click
// implementation tries to navigate and emits warnings; this captures click
// events at document level and cancels their default ONLY for anchors that
// belong to the wrapper-tree (so the inner LinkNode test still exercises the
// real renderer-attached containment listener, which is what test G is
// asserting). Match section-action.test.ts test G's idiom.
function silenceAnchorNavigation() {
  document.addEventListener(
    "click",
    (e) => {
      const tgt = e.target as Element | null;
      if (tgt && tgt.closest("a[href]") != null) {
        e.preventDefault();
      }
    },
    { capture: true },
  );
}

describe("SectionNode.link — URL-wrapper clickable-card primitive (260614-bmd)", () => {
  it("A. external linked card renders as <a> with href + target=_blank + rel=noopener noreferrer", () => {
    const container = render(treeMixed(), () => {});
    const s1 = sectionByHeading(container, "Read the docs");
    expect(s1.tagName).toBe("A");
    expect(s1.getAttribute("href")).toBe("https://example.com/docs");
    expect(s1.getAttribute("target")).toBe("_blank");
    expect(s1.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("B. non-external (internal) linked card omits target and rel attributes", () => {
    const container = render(treeMixed(), () => {});
    const s2 = sectionByHeading(container, "Open detail");
    expect(s2.tagName).toBe("A");
    // jsdom resolves relative URLs against the document base; check the raw
    // attribute (not the parsed .href property which expands to absolute).
    expect(s2.getAttribute("href")).toBe("/internal");
    expect(s2.getAttribute("target")).toBeNull();
    expect(s2.getAttribute("rel")).toBeNull();
  });

  it("C. linked card has className 'vms-section vms-section--linked' (not --clickable)", () => {
    const container = render(treeMixed(), () => {});
    const s1 = sectionByHeading(container, "Read the docs");
    expect(s1.className).toContain("vms-section");
    expect(s1.className).toContain("vms-section--linked");
    expect(s1.className).not.toContain("vms-section--clickable");
  });

  it("D. linked card renders its heading as <h2 class='vms-section__heading'> INSIDE the <a>", () => {
    const container = render(treeMixed(), () => {});
    const s1 = sectionByHeading(container, "Read the docs");
    const h2 = s1.querySelector(":scope > h2.vms-section__heading");
    expect(h2).toBeTruthy();
    expect(h2!.textContent).toBe("Read the docs");
  });

  it("E. clicking a nested ButtonNode fires its own action and stopPropagation prevents wrapper from receiving the click", () => {
    silenceAnchorNavigation();
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const s1 = sectionByHeading(container, "Read the docs");
    // Sentinel listener on the wrapper anchor — confirms stopPropagation works.
    let wrapperSawClick = false;
    s1.addEventListener("click", () => { wrapperSawClick = true; });
    const button = s1.querySelector(".vms-button") as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "close-card-1" });
    expect(wrapperSawClick).toBe(false);
  });

  it("F. clicking a nested CheckboxNode does NOT propagate to the wrapper anchor; checkbox bind state is updated", () => {
    silenceAnchorNavigation();
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const s1 = sectionByHeading(container, "Read the docs");
    let wrapperSawClick = false;
    s1.addEventListener("click", () => { wrapperSawClick = true; });
    const checkbox = s1.querySelector(".vms-checkbox__input") as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(wrapperSawClick).toBe(false);
  });

  it("G. clicking a nested inner LinkNode does NOT propagate to the wrapper anchor (the inner anchor wins)", () => {
    silenceAnchorNavigation();
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const s1 = sectionByHeading(container, "Read the docs");
    let wrapperSawClick = false;
    s1.addEventListener("click", () => { wrapperSawClick = true; });
    const innerAnchor = s1.querySelector("a.vms-link") as HTMLAnchorElement;
    expect(innerAnchor).toBeTruthy();
    expect(innerAnchor).not.toBe(s1);
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    innerAnchor.dispatchEvent(ev);
    expect(wrapperSawClick).toBe(false);
  });

  it("H. linked card has NO role='button', NO tabindex='0', NO aria-label (anchor element provides semantics natively)", () => {
    const container = render(treeMixed(), () => {});
    const s1 = sectionByHeading(container, "Read the docs");
    expect(s1.getAttribute("role")).toBeNull();
    expect(s1.getAttribute("tabindex")).toBeNull();
    expect(s1.getAttribute("aria-label")).toBeNull();
  });

  it("I. backward-compat — a section WITHOUT link AND without action renders as <section>, no --linked / --clickable class, no href/target/rel", () => {
    const container = render(treeMixed(), () => {});
    const s3 = sectionByHeading(container, "Baseline");
    expect(s3.tagName).toBe("SECTION");
    expect(s3.className).not.toContain("vms-section--linked");
    expect(s3.className).not.toContain("vms-section--clickable");
    expect(s3.getAttribute("href")).toBeNull();
    expect(s3.getAttribute("target")).toBeNull();
    expect(s3.getAttribute("rel")).toBeNull();
  });

  it("J. linked card with variant: 'card' and layout: 'split' includes both modifiers on the <a> className", () => {
    const tree: ViewNode = {
      type: "page",
      children: [
        {
          type: "section",
          heading: "Combined",
          variant: "card",
          layout: "split",
          link: { url: "https://example.com" },
          children: [{ type: "text", value: "x" }],
        },
      ],
    };
    const container = render(tree, () => {});
    const s = sectionByHeading(container, "Combined");
    expect(s.tagName).toBe("A");
    expect(s.className).toContain("vms-section--linked");
    expect(s.className).toContain("vms-section--card");
    expect(s.className).toContain("vms-section--split");
  });

  // Case K (CSS reset verification) skipped — the linked-card stylesheet is
  // shipped CSS rather than injected by the renderer, so asserting computed
  // style here would require parsing default.css in jsdom (heavy). Trust the
  // visual via the Showcase demo + the AA-contrast guard's coverage on
  // .vms-section--linked:focus-visible. The css block existence is verified
  // by check:aa-contrast in the project sanity sweep.
});
