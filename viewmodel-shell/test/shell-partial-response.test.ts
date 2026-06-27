// 3.3.0 (core audit C2) — a non-redirect response that omits `vm` must NOT
// blank the screen. Side-effects-only / poll-keepalive responses ("persist +
// keep polling, don't rebuild the view") are legitimate; the shell keeps the
// current view, updates state only if fresh state arrived, and still schedules
// the next poll. Pre-3.3.0, `render(body.vm!)` rendered `undefined` → blank.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ViewModelShell,
  type ShellResponse,
  type ViewNode,
} from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

const endpoint = "/api/x";
const actionEndpoint = "/api/x/action";

const vm: ViewNode = {
  type: "page",
  children: [{ type: "text", value: "original view" }],
};

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("C2 — vm-less non-redirect response keeps the current view", () => {
  it("a sideEffects-only response does not blank the page", () => {
    const container = freshContainer();
    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(container),
      endpoint,
      actionEndpoint,
    });

    // First render establishes the view.
    shell.push({ vm, state: { n: 1 } } as ShellResponse);
    expect(container.textContent).toContain("original view");

    // A response with NO vm (and no redirect) — e.g. "persist a flag and keep
    // going". The view must remain, not vanish.
    shell.push({ state: { n: 2 } } as unknown as ShellResponse);
    expect(container.textContent).toContain("original view");
  });

  it("updates state from a vm-less response so the next render reflects it", () => {
    const container = freshContainer();
    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(container),
      endpoint,
      actionEndpoint,
    });

    shell.push({ vm, state: { n: 1 } } as ShellResponse);
    shell.push({ state: { n: 9 } } as unknown as ShellResponse); // vm-less, fresh state
    expect((shell.getCurrentState() as { n: number }).n).toBe(9);
  });

  it("a vm-less response with no state preserves the prior state (no wipe to undefined)", () => {
    const container = freshContainer();
    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(container),
      endpoint,
      actionEndpoint,
    });

    shell.push({ vm, state: { n: 7 } } as ShellResponse);
    shell.push({ sideEffects: [] } as unknown as ShellResponse); // no vm, no state
    expect((shell.getCurrentState() as { n: number }).n).toBe(7);
    expect(container.textContent).toContain("original view");
  });
});
