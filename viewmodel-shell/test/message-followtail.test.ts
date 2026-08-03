// v8.0.0 (COMP-06a) — MessageListNode.followTail: REUSES the shipped
// SectionNode.followTail `data-follow-tail` mechanism (browser.ts:227-246 +
// :362-372). This test proves the reuse works — it asserts the attribute is
// emitted AND that the shipped snapshot/restore machinery pins scroll to the
// new bottom when the container is scrolled to the bottom before a re-render.
//
// Direct template: test/follow-tail.test.ts (SectionNode.followTail). Every
// jsdom stub / staging pattern here is byte-aligned to that file — a
// re-render on the SAME container should walk BOTH the section-flavored and
// message-list-flavored [data-follow-tail] elements identically.
//
// The CODE-SEARCH test below is the plan-checker C-4 mutation-proof: if a
// future edit adds a parallel snapshot/restore inside `messageList()` (which
// would silently double-restore on every re-render), the code-search fails.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ViewNode, MessageListNode, PageNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

const SCROLL_HEIGHT = 2000;
const CLIENT_HEIGHT = 300;
const BOTTOM = SCROLL_HEIGHT - CLIENT_HEIGHT; // 1700 — scrollTop when at the bottom

let origScrollHeight: PropertyDescriptor | undefined;
let origClientHeight: PropertyDescriptor | undefined;

beforeEach(() => {
  origScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
  origClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() { return SCROLL_HEIGHT; },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() { return CLIENT_HEIGHT; },
  });
  // browser.ts touches CSS.escape on the id-scroll restore path; polyfill a
  // passthrough for the ASCII ids used here (jsdom doesn't always ship it).
  const g = globalThis as { CSS?: { escape?: (s: string) => string } };
  if (typeof g.CSS === "undefined") g.CSS = { escape: (s: string) => s };
  else if (typeof g.CSS.escape !== "function") g.CSS.escape = (s: string) => s;
});

afterEach(() => {
  if (origScrollHeight) Object.defineProperty(HTMLElement.prototype, "scrollHeight", origScrollHeight);
  if (origClientHeight) Object.defineProperty(HTMLElement.prototype, "clientHeight", origClientHeight);
  document.body.innerHTML = "";
});

function feed(bubbles: number, extra?: Partial<MessageListNode>): PageNode {
  return {
    type: "page",
    children: [
      {
        type: "message-list",
        followTail: true,
        children: Array.from({ length: bubbles }, (_, i) => ({
          type: "message",
          author: "Bot",
          content: `line ${i}`,
        })),
        ...extra,
      } as MessageListNode,
    ],
  };
}

function listEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>(".vms-message-list[data-follow-tail]");
  if (!el) throw new Error("MessageListNode follow-tail container not found");
  return el;
}

describe("MessageListNode.followTail — wire → data attribute (REUSE)", () => {
  it("emits data-follow-tail attribute when followTail:true", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    new BrowserAdapter(c).render(feed(1), () => {});
    const ml = c.querySelector<HTMLElement>(".vms-message-list");
    expect(ml).not.toBeNull();
    expect(ml!.hasAttribute("data-follow-tail")).toBe(true);
  });

  it("omits data-follow-tail attribute when followTail is omitted", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    new BrowserAdapter(c).render(feed(1, { followTail: undefined }), () => {});
    const ml = c.querySelector<HTMLElement>(".vms-message-list");
    expect(ml).not.toBeNull();
    expect(ml!.hasAttribute("data-follow-tail")).toBe(false);
  });

  it("omits data-follow-tail attribute when followTail:false", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    new BrowserAdapter(c).render(feed(1, { followTail: false }), () => {});
    const ml = c.querySelector<HTMLElement>(".vms-message-list");
    expect(ml).not.toBeNull();
    expect(ml!.hasAttribute("data-follow-tail")).toBe(false);
  });
});

describe("MessageListNode.followTail — pin-to-bottom vs preserve (REUSE proof)", () => {
  // The shipped SectionNode.followTail machinery at browser.ts:239-246 +
  // :362-372 walks EVERY [data-follow-tail] element in document order. If
  // MessageListNode's one-line dataset attribute correctly piggybacks that
  // walk, these tests pass. If the wire-in ever regresses (attribute misspelt,
  // condition inverted, `if` accidentally deleted), all three fail loudly.

  it("a brand-new feed opens pinned to the bottom (newest content in view)", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    // First render: no prior snapshot → the feed is pinned to the new bottom
    // (the same "no snapshot at this ordinal → pin" branch as SectionNode).
    new BrowserAdapter(c).render(feed(3), () => {});
    expect(listEl(c).scrollTop).toBe(SCROLL_HEIGHT);
  });

  it("a feed the user left AT the bottom re-pins to the new bottom on re-render", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    const adapter = new BrowserAdapter(c);
    adapter.render(feed(3), () => {});
    listEl(c).scrollTop = BOTTOM; // distanceFromBottom = 0 → nearBottom
    adapter.render(feed(4), () => {}); // more messages appended
    expect(listEl(c).scrollTop).toBe(SCROLL_HEIGHT);
  });

  it("a feed the user scrolled UP in keeps its position on re-render", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    const adapter = new BrowserAdapter(c);
    adapter.render(feed(3), () => {});
    listEl(c).scrollTop = 100; // distanceFromBottom = 1600 > 40 → NOT nearBottom
    adapter.render(feed(4), () => {});
    expect(listEl(c).scrollTop).toBe(100);
  });
});

describe("MessageListNode.followTail — REUSE-not-rebuild (code-search proof)", () => {
  // Plan-checker C-4 mutation-testable assertion: the messageList() renderer
  // MUST contain the single line `dataset.followTail` and MUST NOT contain
  // any parallel snapshot/restore logic (scrollHeight reads, scrollTop
  // assignments) inside its body. The shipped snapshot/restore lives in
  // render() at browser.ts:239-246 + :362-372 and is walked once per render
  // — a parallel implementation inside messageList() would silently
  // double-restore on every re-render (or, worse, drift out of sync with the
  // shipped mechanism).
  it("messageList() body contains ONLY dataset.followTail (no parallel scroll logic)", () => {
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../src/browser.ts"),
      "utf8",
    );
    // Extract the messageList() body — from the opening `private messageList(...)`
    // signature (whose parameter list contains ()-nested arrow types like
    // `(a: ActionEvent) => void`, so match the signature lazily up to its
    // trailing `: void {`) to its closing `}` (the first `\n  }\n`
    // after the signature).
    const startMatch = src.match(/private messageList\([\s\S]*?\): void \{\n([\s\S]*?)\n  \}\n/);
    expect(startMatch).not.toBeNull();
    const body = startMatch![1];

    // The single sanctioned line — verbatim from SectionNode's own emission
    // at browser.ts:1063 (per PATTERNS.md §2e).
    expect(body).toContain('dataset.followTail = ""');

    // NO parallel scroll manipulation. If any of these appear inside the
    // renderer body, the reuse contract has been violated. Note: the terms
    // may appear in COMMENTS (documenting what the shipped mechanism does)
    // — strip line comments before matching so an educational reference like
    // `// preserves old scrollTop when scrolled up` doesn't false-fail.
    const codeOnly = body
      .split("\n")
      .map(line => line.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(codeOnly).not.toMatch(/scrollHeight/);
    expect(codeOnly).not.toMatch(/scrollTop\s*=/);
    expect(codeOnly).not.toMatch(/scrollTop\b/);
    expect(codeOnly).not.toMatch(/querySelectorAll.*data-follow-tail/);
  });

  it("browser.ts total scrollHeight + scrollTop-assignment count is UNCHANGED from the shipped baseline", () => {
    // The banked count invariant: 24-02 must NOT increase the count of
    // `scrollHeight` reads or `scrollTop = ...` writes anywhere in browser.ts
    // that belong to the SectionNode.followTail machinery — the MessageListNode
    // piggyback introduces ZERO new follow-tail-related occurrences.
    //
    // Baseline breakdown (JavaScript regex, per-occurrence — differs from
    // `grep -c` which counts matching LINES):
    //   • 6 follow-tail occurrences (shipped SectionNode.followTail machinery
    //     at render() ~239-246 + ~362-372; verified at commit 7c546b0).
    //   • 3 chat-composer textarea auto-resize occurrences (CHAT-03, Plan
    //     30-03) — LEGITIMATELY DIFFERENT MECHANISM: this is textarea sizing
    //     (JS fallback for browsers without CSS `field-sizing: content`),
    //     NOT scroll-position preservation. All 3 occurrences live INSIDE the
    //     `chatComposer()` private method body; they cannot reach the
    //     `messageList()` renderer body (asserted above), so the reuse
    //     mandate remains enforced.
    //
    // If a future edit tries to add a PARALLEL follow-tail implementation
    // (i.e. scroll snapshot/restore logic) and this count grows beyond 9,
    // that's the exact class of bug the reuse mandate exists to catch.
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../src/browser.ts"),
      "utf8",
    );
    const count = (src.match(/scrollHeight|scrollTop\s*=/g) ?? []).length;
    expect(count).toBe(9);
  });
});
