// v8.0.0 (COMP-06) — MessageNode browser renderer tests.
//
// Mirrors avatar-render.test.ts structure: jsdom DOM shape + class-name +
// a11y attribute checks. No computed-style / visual / pixel checks (those
// live on the AA-contrast hand-check documented below).
//
// The tests cover:
//   • DOM shape (wrapper, avatar column, body, header, content, actions).
//   • Role variance (user/assistant/system/omitted) → class emission.
//   • String-vs-ViewNode content dispatch (string-lift into TextNode{style:"body"}).
//   • Timestamp presence/absence (element rendered vs entirely absent).
//   • Avatar-slot dispatch (AvatarNode nested render).
//   • Actions bar always-visible when non-empty; hidden entirely when empty/omitted.
//   • Actions have NO hover-reveal class (banked a11y doctrine).
//
// Mutation-test proof (revert-and-run):
//   • Remove the `if (n.role) cls.push("vms-message--" + n.role)` line in
//     browser.ts messageList/message → the four role tests fail (class missing).
//   • Remove the `typeof n.content === "string"` branch → the
//     "wraps string content" test fails (no .vms-text--body span appears).
//   • Remove the `if (n.actions && n.actions.length > 0)` guard → the
//     "actions=[] hides bar" test fails (empty .vms-message__actions div appears).
//   • Remove the `if (n.timestamp)` guard → the "timestamp absent hides" test
//     fails (empty span rendered).
//
// ── AA-contrast hand-check (COMP-06, banked lesson: check:aa-contrast does
//    NOT auto-cover new pairs — 13 pair-checks: default + 12 themes) ──────
//
// Pair — MessageNode assistant surface × body text.
// Assistant background:
//   color-mix(in srgb, var(--vms-info) 6%, var(--vms-surface))
// Body text: var(--vms-text)
//
// Computed sRGB luminance (WCAG 2.1 §1.4.3) — see comment tail for the
// per-theme --vms-info / --vms-surface / --vms-text values verified against
// styles/themes/*.css:
//
//   Light-family (default, light-amber/blue/green/purple/rose/teal):
//     --vms-info    = #2277dd   (7 themes; all use the same info blue)
//     --vms-surface = #ffffff
//     --vms-text    = #1a1a22
//     Mixed assistant background = #f2f7fd (6% info over white surface)
//     Contrast (bg × text)       = 16.05:1  ✓ AAA-normal (≥ 7)
//
//   Dark-family (dark-amber/blue/green/purple/rose/teal):
//     --vms-info    = #4a9eff   (6 themes)
//     --vms-surface = #18181c
//     --vms-text    = #e8e8f0
//     Mixed assistant background = #1b202a (6% info over dark surface)
//     Contrast (bg × text)       = 13.39:1  ✓ AAA-normal (≥ 7)
//
// Result — AA hand-check GREEN on default + 12 themes @ assistant tinted-info
// surface × body text. 6% is a light enough tint that the base surface × body
// contrast (light 17.29:1 / dark 14.53:1) is barely reduced — every theme
// clears AAA-normal (7:1) with margin. No deepening required.
//
// The other new elements on MessageNode (author weight-600, timestamp caption)
// reuse Phase 23 primitives (TextNode weight axis + caption style) whose
// contrast profile was hand-checked in the shipping Phase 23 test files
// (text-caption.test.ts, text-weight.test.ts) — this file does NOT re-check them.

import { describe, it, expect, beforeEach } from "vitest";
import { BrowserAdapter } from "../src/browser.js";
import type { ViewNode, MessageNode, AvatarNode, ButtonNode } from "../src/index.js";

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispatched: Array<{ name: string }> = [];
  const adapter = new BrowserAdapter(container);
  return {
    container,
    dispatched,
    render(vm: ViewNode) {
      adapter.render(vm, (a) => { dispatched.push(a); });
    },
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("MessageNode (COMP-06) — DOM shape", () => {
  it("emits <div class='vms-message'> with an avatar column and body column", () => {
    const { container, render } = setup();
    render({
      type: "message",
      author: "Ada",
      content: "Hello",
    } as MessageNode);
    const wrap = container.querySelector<HTMLDivElement>(".vms-message");
    expect(wrap).not.toBeNull();
    expect(wrap!.tagName).toBe("DIV");
    // Avatar column is emitted UNCONDITIONALLY so the grid baseline stays
    // aligned across a MessageList (even when a single message has no avatar).
    expect(wrap!.querySelector(".vms-message__avatar")).not.toBeNull();
    expect(wrap!.querySelector(".vms-message__body")).not.toBeNull();
  });

  it("renders author textContent in .vms-message__author", () => {
    const { container, render } = setup();
    render({ type: "message", author: "Ada Lovelace", content: "hi" } as MessageNode);
    const author = container.querySelector<HTMLSpanElement>(".vms-message__author");
    expect(author).not.toBeNull();
    expect(author!.tagName).toBe("SPAN");
    expect(author!.textContent).toBe("Ada Lovelace");
  });

  it("renders header row containing author (always) and timestamp (optional)", () => {
    const { container, render } = setup();
    render({ type: "message", author: "Ada", timestamp: "2:14 PM", content: "hi" } as MessageNode);
    const header = container.querySelector(".vms-message__header");
    expect(header).not.toBeNull();
    expect(header!.querySelector(".vms-message__author")).not.toBeNull();
    expect(header!.querySelector(".vms-message__timestamp")).not.toBeNull();
  });

  it("timestamp present renders .vms-message__timestamp with textContent", () => {
    const { container, render } = setup();
    render({ type: "message", author: "Ada", timestamp: "2:14 PM", content: "hi" } as MessageNode);
    const ts = container.querySelector<HTMLSpanElement>(".vms-message__timestamp");
    expect(ts).not.toBeNull();
    expect(ts!.textContent).toBe("2:14 PM");
  });

  it("timestamp absent hides .vms-message__timestamp element entirely", () => {
    const { container, render } = setup();
    render({ type: "message", author: "Ada", content: "hi" } as MessageNode);
    // The whole timestamp span MUST be absent from the DOM — not present-but-empty
    // (which would still show a gap/margin via the flex layout).
    expect(container.querySelector(".vms-message__timestamp")).toBeNull();
    // The header itself is still there (author still needs a container).
    expect(container.querySelector(".vms-message__header")).not.toBeNull();
  });
});

describe("MessageNode (COMP-06) — role variance", () => {
  it("role='user' emits vms-message--user class", () => {
    const { container, render } = setup();
    render({ type: "message", author: "A", content: "hi", role: "user" } as MessageNode);
    const wrap = container.querySelector<HTMLDivElement>(".vms-message");
    expect(wrap!.classList.contains("vms-message--user")).toBe(true);
  });

  it("role='assistant' emits vms-message--assistant class", () => {
    const { container, render } = setup();
    render({ type: "message", author: "A", content: "hi", role: "assistant" } as MessageNode);
    const wrap = container.querySelector<HTMLDivElement>(".vms-message");
    expect(wrap!.classList.contains("vms-message--assistant")).toBe(true);
  });

  it("role='system' emits vms-message--system class", () => {
    const { container, render } = setup();
    render({ type: "message", author: "A", content: "hi", role: "system" } as MessageNode);
    const wrap = container.querySelector<HTMLDivElement>(".vms-message");
    expect(wrap!.classList.contains("vms-message--system")).toBe(true);
  });

  it("role omitted emits NO --{role} class", () => {
    const { container, render } = setup();
    render({ type: "message", author: "A", content: "hi" } as MessageNode);
    const wrap = container.querySelector<HTMLDivElement>(".vms-message");
    // Only the base class — no --user / --assistant / --system suffix.
    expect(wrap!.className).toBe("vms-message");
  });
});

describe("MessageNode (COMP-06) — content string-lift", () => {
  it("wraps string content in TextNode{style:'body'} inside .vms-message__content", () => {
    const { container, render } = setup();
    render({ type: "message", author: "A", content: "Hello world" } as MessageNode);
    const content = container.querySelector(".vms-message__content");
    expect(content).not.toBeNull();
    // The lift emits <span class="vms-text vms-text--body">Hello world</span>.
    const textSpan = content!.querySelector<HTMLSpanElement>("span.vms-text--body");
    expect(textSpan).not.toBeNull();
    expect(textSpan!.classList.contains("vms-text")).toBe(true);
    expect(textSpan!.textContent).toBe("Hello world");
  });

  it("passes ViewNode content through without wrapping", () => {
    const { container, render } = setup();
    // A pre-shaped TextNode with style:"muted" — proves the else-branch dispatches
    // the caller-provided ViewNode as-is (would render as body via the lift branch).
    render({
      type: "message",
      author: "A",
      content: { type: "text", value: "custom", style: "muted" } as ViewNode,
    } as MessageNode);
    const content = container.querySelector(".vms-message__content");
    // The ViewNode branch does NOT force style:"body"; the muted class stays.
    expect(content!.querySelector(".vms-text--muted")).not.toBeNull();
    // And the body class (from the string-lift path) MUST NOT appear.
    expect(content!.querySelector(".vms-text--body")).toBeNull();
  });
});

describe("MessageNode (COMP-06) — avatar slot", () => {
  it("renders avatar slot through node() dispatch (AvatarNode inside .vms-message__avatar)", () => {
    const { container, render } = setup();
    const avatar: AvatarNode = { type: "avatar", initials: "AL" };
    render({ type: "message", author: "A", content: "hi", avatar } as MessageNode);
    const avatarSlot = container.querySelector(".vms-message__avatar");
    expect(avatarSlot).not.toBeNull();
    // The nested AvatarNode renders as .vms-avatar inside the avatar slot.
    expect(avatarSlot!.querySelector(".vms-avatar")).not.toBeNull();
  });

  it("avatar slot element exists even when n.avatar is absent (empty column)", () => {
    const { container, render } = setup();
    render({ type: "message", author: "A", content: "hi" } as MessageNode);
    // The empty slot is deliberately present so the [avatar | body] grid keeps
    // a consistent baseline across a MessageList; documented in the message()
    // renderer TSDoc.
    const avatarSlot = container.querySelector(".vms-message__avatar");
    expect(avatarSlot).not.toBeNull();
    expect(avatarSlot!.children.length).toBe(0);
  });
});

describe("MessageNode (COMP-06) — actions bar (ALWAYS visible)", () => {
  it("actions[] renders as .vms-message__actions with each button", () => {
    const { container, render } = setup();
    const actions: ButtonNode[] = [
      { type: "button", label: "OK", action: { name: "msg-ok" } },
      { type: "button", label: "Dismiss", action: { name: "msg-dismiss" } },
    ];
    render({ type: "message", author: "A", content: "hi", actions } as MessageNode);
    const bar = container.querySelector(".vms-message__actions");
    expect(bar).not.toBeNull();
    expect(bar!.querySelectorAll(".vms-button").length).toBe(2);
  });

  it("actions=[] (empty array) hides .vms-message__actions entirely", () => {
    const { container, render } = setup();
    render({ type: "message", author: "A", content: "hi", actions: [] } as MessageNode);
    expect(container.querySelector(".vms-message__actions")).toBeNull();
  });

  it("actions omitted hides .vms-message__actions entirely", () => {
    const { container, render } = setup();
    render({ type: "message", author: "A", content: "hi" } as MessageNode);
    expect(container.querySelector(".vms-message__actions")).toBeNull();
  });

  it("actions bar has NO hover-reveal class — always visible when present", () => {
    // Banked doctrine: hover-reveal has a11y + touch failure modes; the shipped
    // design of record explicitly excludes it. The class MUST be exactly
    // "vms-message__actions" (no conditional hide-until-hover modifier).
    const { container, render } = setup();
    render({
      type: "message", author: "A", content: "hi",
      actions: [{ type: "button", label: "OK", action: { name: "msg-only-ok" } }],
    } as MessageNode);
    const bar = container.querySelector<HTMLDivElement>(".vms-message__actions");
    expect(bar).not.toBeNull();
    // No hover / hide / reveal / visible-on-hover class — banked doctrine.
    expect(bar!.className).toBe("vms-message__actions");
    // And the class name itself carries NO ":hover" pseudo-class or -hover suffix.
    expect(bar!.className).not.toMatch(/hover|reveal|hidden/i);
  });

  it("action click dispatches through the on() callback", () => {
    const { container, dispatched, render } = setup();
    render({
      type: "message", author: "A", content: "hi",
      actions: [{ type: "button", label: "OK", action: { name: "msg-click-ok" } }],
    } as MessageNode);
    const btn = container.querySelector<HTMLButtonElement>(".vms-message__actions .vms-button");
    btn!.click();
    expect(dispatched.some(a => a.name === "msg-click-ok")).toBe(true);
  });
});
