// SectionNode.followTail — the append-only-feed scroll axis.
//
// The default 0.7.1 (#7) scroll-preservation contract restores an element's
// PRIOR scrollTop across a re-render (don't-lose-my-place, right for forms /
// tables). For a growing transcript that is inverted: the old bottom becomes
// mid-scroll once taller content is appended, so the newest content silently
// ends up off-screen. followTail flips the restore for that one element — a
// feed the user had scrolled to the bottom stays pinned to the NEW bottom, a
// feed the user scrolled UP in keeps its place.
//
// jsdom has no layout, so scrollHeight/clientHeight are stubbed with fixed
// prototype getters (2000 / 300) and scrollTop is a real stored value we set to
// stage "at bottom" (1700 = 2000-300) vs "scrolled up" (100). Mirrors the
// geometry-stubbing style of browser-scroll.test.ts.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SectionNode, ViewNode } from "../src/index.js";
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

function feed(extra?: Partial<SectionNode>): ViewNode {
  return {
    type: "page",
    children: [
      {
        type: "section",
        heading: "Transcript",
        fill: true,
        followTail: true,
        children: [{ type: "text", value: "message" }],
        ...extra,
      } as SectionNode,
    ],
  };
}

function feedEl(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>("[data-follow-tail]");
  if (!el) throw new Error("follow-tail section not found");
  return el;
}

describe("SectionNode.followTail — wire → data attribute", () => {
  it("emits data-follow-tail when followTail:true", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    new BrowserAdapter(c).render(feed(), () => {});
    expect(c.querySelector(".vms-section")!.hasAttribute("data-follow-tail")).toBe(true);
  });

  it("does NOT emit data-follow-tail when omitted (byte-identical to today)", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    new BrowserAdapter(c).render(feed({ followTail: undefined }), () => {});
    expect(c.querySelector(".vms-section")!.hasAttribute("data-follow-tail")).toBe(false);
  });
});

describe("SectionNode.followTail — pin-to-bottom vs preserve", () => {
  it("a brand-new feed opens pinned to the bottom (newest content in view)", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    // First render: no prior snapshot → the feed is pinned to the new bottom.
    new BrowserAdapter(c).render(feed(), () => {});
    expect(feedEl(c).scrollTop).toBe(SCROLL_HEIGHT);
  });

  it("a feed the user left AT the bottom re-pins to the new bottom on re-render", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    const adapter = new BrowserAdapter(c);
    adapter.render(feed(), () => {});
    // Simulate the user sitting at the bottom (within threshold).
    feedEl(c).scrollTop = BOTTOM; // distanceFromBottom = 0 ≤ 40 → nearBottom
    // Re-render with appended content → pin to the new (taller) bottom.
    adapter.render(feed(), () => {});
    expect(feedEl(c).scrollTop).toBe(SCROLL_HEIGHT);
  });

  it("a feed the user scrolled UP in keeps its position on re-render", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    const adapter = new BrowserAdapter(c);
    adapter.render(feed(), () => {});
    // Simulate the user scrolling up to read history (far from the bottom).
    feedEl(c).scrollTop = 100; // distanceFromBottom = 1600 > 40 → NOT nearBottom
    adapter.render(feed(), () => {});
    expect(feedEl(c).scrollTop).toBe(100);
  });

  it("just within the stick threshold still counts as following the tail", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    const adapter = new BrowserAdapter(c);
    adapter.render(feed(), () => {});
    feedEl(c).scrollTop = BOTTOM - 40; // distanceFromBottom = 40 = threshold → nearBottom
    adapter.render(feed(), () => {});
    expect(feedEl(c).scrollTop).toBe(SCROLL_HEIGHT);
  });

  it("just past the stick threshold is treated as scrolled-up (preserved)", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    const adapter = new BrowserAdapter(c);
    adapter.render(feed(), () => {});
    const parked = BOTTOM - 41; // distanceFromBottom = 41 > 40 → NOT nearBottom
    feedEl(c).scrollTop = parked;
    adapter.render(feed(), () => {});
    expect(feedEl(c).scrollTop).toBe(parked);
  });
});

// The follow decision is a pure function of the feed's scroll position at
// render time — render() has no knowledge of WHAT triggered it (a background
// poll, an SSE push, or a user's own form submit all call the same render()).
// So a "send" re-render (adds a bubble AND carries a focused composer field)
// and a "poll" re-render behave IDENTICALLY given the same scroll state. This
// is the answer to the /ai "scrolled-up + user-send jumps to bottom" report:
// followTail never pins a genuinely-scrolled-up feed; when a real browser
// jumps on send it's because the send INTERACTION moved the scroll to the
// bottom before render() snapshots (the standard chat "your own message pulls
// you down" UX), which followTail then correctly reads as at-bottom.
describe("SectionNode.followTail — the follow decision is trigger-agnostic", () => {
  // A send-like tree: the transcript grew by a bubble AND there's a composer
  // field (focused, like right after the user typed + hit send).
  function sendLikeFeed(bubbles: number): ViewNode {
    return {
      type: "page",
      children: [
        {
          type: "section", heading: "Transcript", fill: true, followTail: true,
          children: Array.from({ length: bubbles }, (_, i) => (
            { type: "text", value: `message ${i}` } as ViewNode)),
        } as SectionNode,
        { type: "field", name: "composer", inputType: "text", bind: "draft", label: "Message" },
      ],
    };
  }

  it("a send-like re-render (new bubble + composer field) from SCROLLED-UP preserves — same as a poll", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    const adapter = new BrowserAdapter(c);
    adapter.render(sendLikeFeed(3), () => {});
    feedEl(c).scrollTop = 100; // user scrolled up to read history
    // Focus the composer, as the user would have right before sending.
    const composer = c.querySelector<HTMLInputElement>("#vms-composer");
    composer?.focus();
    // The "send" re-render: transcript grew, composer still in the tree + focused.
    adapter.render(sendLikeFeed(4), () => {});
    // followTail does NOT hijack a scrolled-up feed on a content-adding,
    // composer-focused re-render — identical to the streaming-poll case.
    expect(feedEl(c).scrollTop).toBe(100);
  });

  it("the SAME send-like re-render from AT-BOTTOM pins to the new bottom (desired: your own message pulls you down)", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    const adapter = new BrowserAdapter(c);
    adapter.render(sendLikeFeed(3), () => {});
    feedEl(c).scrollTop = BOTTOM; // user was at the bottom when they sent
    adapter.render(sendLikeFeed(4), () => {});
    expect(feedEl(c).scrollTop).toBe(SCROLL_HEIGHT);
  });
});
