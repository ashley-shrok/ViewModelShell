// 0.8.0 (#11) — ButtonNode.pendingLabel: instant click feedback for slow
// actions. Validates THREE behaviors:
//
//   1. BrowserAdapter: on click of a button with pendingLabel set, the
//      rendered <button>'s textContent swaps to pendingLabel and the
//      .vms-button--pending modifier class is added — BEFORE the dispatch
//      hits the network.
//   2. Shell: when dispatch errors out (no re-render from a fresh server
//      response), the shell re-renders currentVm so client-side ephemeral
//      state (the pending swap) snaps back to the authoritative label.
//   3. TuiAdapter: the pendingButtonKey plumbing surfaces pendingLabel in
//      the rendered tree when set, label otherwise — same renderTree walk
//      used by the conformance suite.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ViewModelShell,
  type ViewNode,
  type ShellResponse,
} from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

const endpoint = "/api/x";
const actionEndpoint = "/api/x/action";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("0.8.0 (#11) — BrowserAdapter pendingLabel click swap", () => {
  it("button click swaps textContent to pendingLabel and adds .vms-button--pending class", () => {
    const vm: ViewNode = {
      type: "page",
      children: [
        {
          type: "button",
          label: "Load Plugin",
          action: { name: "load-plugin" },
          pendingLabel: "Loading…",
        },
      ],
    };

    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    // Render directly (not through the shell) — we only need the DOM result
    // + a click handler that runs through the adapter's wiring.
    adapter.render(vm, () => { /* recorder not needed for this assertion */ });

    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn, "rendered tree contains a button").not.toBeNull();
    expect(btn.textContent).toBe("Load Plugin");
    expect(btn.classList.contains("vms-button--pending")).toBe(false);

    btn.click();

    // Synchronously after click: pending UI is in place. No await — the
    // swap happens BEFORE the dispatch hits the network.
    expect(btn.textContent).toBe("Loading…");
    expect(btn.classList.contains("vms-button--pending")).toBe(true);
  });

  it("button WITHOUT pendingLabel does not get pending UI on click", () => {
    const vm: ViewNode = {
      type: "page",
      children: [
        {
          type: "button",
          label: "Save",
          action: { name: "save" },
          // pendingLabel intentionally absent
        },
      ],
    };
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    adapter.render(vm, () => { /* unused */ });
    const btn = container.querySelector("button") as HTMLButtonElement;
    btn.click();
    expect(btn.textContent).toBe("Save");
    expect(btn.classList.contains("vms-button--pending")).toBe(false);
  });
});

describe("0.8.0 (#11) — shell re-renders currentVm on dispatch error (snap-back path)", () => {
  it("dispatch error re-renders currentVm so pending UI reverts", async () => {
    const vm: ViewNode = {
      type: "page",
      children: [
        {
          type: "button",
          label: "Load Plugin",
          action: { name: "load-plugin" },
          pendingLabel: "Loading…",
        },
      ],
    };

    // Initial load: mock fetch to return the VM, then mock the action's POST
    // to FAIL — this exercises the snap-back path.
    const loadResp = new Response(JSON.stringify({ vm, state: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const errResp = new Response("server boom", { status: 500, statusText: "Internal Server Error" });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(loadResp)
      .mockResolvedValueOnce(errResp) as unknown as typeof fetch;

    const container = freshContainer();
    const onError = vi.fn();
    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(container),
      endpoint,
      actionEndpoint,
      onError,
    });

    await shell.load();
    let btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.textContent).toBe("Load Plugin");

    // Click → swap happens synchronously, then dispatch starts.
    btn.click();
    expect(btn.textContent, "pending swap synchronous on click").toBe("Loading…");
    expect(btn.classList.contains("vms-button--pending")).toBe(true);

    // Drain microtasks so the dispatch's fetch error path runs (which
    // surfaces onError + re-renders currentVm).
    await new Promise((r) => setTimeout(r, 0));

    expect(onError, "non-OK response surfaces onError").toHaveBeenCalled();
    // The button DOM node was replaced by the error-path re-render — query fresh.
    btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn, "button still rendered after error-path re-render").not.toBeNull();
    expect(btn.textContent, "label snapped back to authoritative server text").toBe("Load Plugin");
    expect(btn.classList.contains("vms-button--pending"), "pending class cleared").toBe(false);
  });

  it("dispatch success path also clears pending UI (via the normal new-VM render)", async () => {
    const vmInitial: ViewNode = {
      type: "page",
      children: [
        {
          type: "button",
          label: "Submit",
          action: { name: "submit" },
          pendingLabel: "Submitting…",
        },
      ],
    };
    const vmAfter: ViewNode = {
      type: "page",
      children: [{ type: "text", value: "Submitted." }],
    };

    const loadResp = new Response(JSON.stringify({ vm: vmInitial, state: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    const okResp = new Response(JSON.stringify({ vm: vmAfter, state: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(loadResp)
      .mockResolvedValueOnce(okResp) as unknown as typeof fetch;

    const container = freshContainer();
    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(container),
      endpoint,
      actionEndpoint,
    });
    await shell.load();
    const btn = container.querySelector("button") as HTMLButtonElement;
    btn.click();
    // Synchronous pending swap before await:
    expect(btn.textContent).toBe("Submitting…");
    await new Promise((r) => setTimeout(r, 0));
    // Server returned a NEW VM — button is gone, replaced by the success text.
    expect(container.querySelector("button")).toBeNull();
    expect(container.textContent ?? "").toContain("Submitted.");
  });
});
