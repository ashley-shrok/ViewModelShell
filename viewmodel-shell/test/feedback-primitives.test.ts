// Feedback primitives — Toast (side-effect), EmptyStateNode, BadgeNode.
//
// Direct BrowserAdapter render/route assertions in jsdom (no browser, no
// running server). Covers:
//   - BadgeNode: label + tone/emphasis modifier classes
//   - EmptyStateNode: heading / message / CTA action button render
//   - BrowserAdapter.toast(): creates the host region + a toast element
//   - core processResponse routes a "toast" side-effect to adapter.toast
//   - core is FAIL-QUIET when the adapter omits toast (no throw, no onError)
//   - EmptyStateNode.action is reachable by the action-name uniqueness walk

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ViewModelShell,
  type ViewNode,
  type ShellResponse,
  type Adapter,
} from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";
import { validateActionNames } from "../src/server.js";

function render(node: ViewNode, on: (a: { name: string }) => void = () => {}): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  new BrowserAdapter(container).render({ type: "page", children: [node] }, on);
  return container;
}

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("BadgeNode", () => {
  it("renders the label in a .vms-badge span (leaf, no children)", () => {
    const c = render({ type: "badge", label: "New" });
    const badge = c.querySelector(".vms-badge");
    expect(badge).not.toBeNull();
    expect(badge!.tagName).toBe("SPAN");
    expect(badge!.textContent).toBe("New");
    // Default (no tone, no emphasis) → no modifier classes.
    expect(badge!.className).toBe("vms-badge");
  });

  it("emits tone + emphasis modifier classes", () => {
    const c = render({ type: "badge", label: "3", tone: "danger", emphasis: "primary" });
    const badge = c.querySelector(".vms-badge")!;
    expect(badge.classList.contains("vms-badge--danger")).toBe(true);
    expect(badge.classList.contains("vms-badge--primary")).toBe(true);
  });

  it("emits only the tone class when emphasis is omitted", () => {
    const c = render({ type: "badge", label: "Beta", tone: "info" });
    const badge = c.querySelector(".vms-badge")!;
    expect(badge.classList.contains("vms-badge--info")).toBe(true);
    expect(badge.className).not.toContain("vms-badge--primary");
    expect(badge.className).not.toContain("vms-badge--secondary");
  });
});

describe("EmptyStateNode", () => {
  it("renders heading, optional message, and the CTA action button", () => {
    const dispatched: string[] = [];
    const c = render(
      {
        type: "empty-state",
        heading: "No tickets yet",
        message: "Create your first ticket to get started.",
        action: { type: "button", label: "New ticket", action: { name: "create-ticket" }, emphasis: "primary" },
      },
      (a) => dispatched.push(a.name),
    );
    const empty = c.querySelector(".vms-empty-state")!;
    expect(empty.querySelector(".vms-empty-state__heading")!.textContent).toBe("No tickets yet");
    expect(empty.querySelector(".vms-empty-state__message")!.textContent).toBe(
      "Create your first ticket to get started.",
    );
    const btn = empty.querySelector(".vms-button") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("New ticket");
    btn.click();
    expect(dispatched).toEqual(["create-ticket"]);
  });

  it("omits the message element and the button when not provided", () => {
    const c = render({ type: "empty-state", heading: "Nothing here" });
    const empty = c.querySelector(".vms-empty-state")!;
    expect(empty.querySelector(".vms-empty-state__heading")!.textContent).toBe("Nothing here");
    expect(empty.querySelector(".vms-empty-state__message")).toBeNull();
    expect(empty.querySelector(".vms-button")).toBeNull();
  });

  it("EmptyStateNode.action is reachable by the action-name uniqueness walk", () => {
    // Two empty-state CTAs sharing one action name (outside any form) is the
    // exact bug the walk exists to catch — it must THROW. If the walk failed to
    // descend into empty-state.action, this would pass silently (the regression).
    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "empty-state", heading: "A", action: { type: "button", label: "Go", action: { name: "dup" } } },
        { type: "empty-state", heading: "B", action: { type: "button", label: "Go", action: { name: "dup" } } },
      ],
    };
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'dup'/);
  });

  it("a single empty-state CTA passes the uniqueness walk", () => {
    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "empty-state", heading: "A", action: { type: "button", label: "Go", action: { name: "go-a" } } },
        { type: "button", label: "Other", action: { name: "go-b" } },
      ],
    };
    expect(() => validateActionNames(tree)).not.toThrow();
  });
});

describe("BrowserAdapter.toast()", () => {
  it("lazily creates the host region and appends a toast element with the message", () => {
    const adapter = new BrowserAdapter(freshContainer());
    adapter.toast("Saved!");
    const region = document.querySelector(".vms-toast-region");
    expect(region).not.toBeNull();
    const toast = region!.querySelector(".vms-toast")!;
    expect(toast.textContent).toBe("Saved!");
    expect(toast.getAttribute("role")).toBe("status");
  });

  it("applies the tone modifier and stacks multiple toasts in one region", () => {
    const adapter = new BrowserAdapter(freshContainer());
    adapter.toast("One", { tone: "success" });
    adapter.toast("Two", { tone: "danger" });
    const regions = document.querySelectorAll(".vms-toast-region");
    expect(regions.length).toBe(1); // reused, not duplicated
    const toasts = regions[0].querySelectorAll(".vms-toast");
    expect(toasts.length).toBe(2);
    expect(toasts[0].classList.contains("vms-toast--success")).toBe(true);
    expect(toasts[1].classList.contains("vms-toast--danger")).toBe(true);
  });

  it("auto-dismisses after durationMs", () => {
    vi.useFakeTimers();
    try {
      const adapter = new BrowserAdapter(freshContainer());
      adapter.toast("Bye", { durationMs: 1000 });
      expect(document.querySelectorAll(".vms-toast").length).toBe(1);
      vi.advanceTimersByTime(1000); // fire the leave timer
      vi.advanceTimersByTime(200);  // fire the removal timer
      expect(document.querySelectorAll(".vms-toast").length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("core routes the toast side-effect (and is fail-quiet)", () => {
  const vm: ViewNode = { type: "text", value: "x" };
  const state = {};
  const endpoint = "/api/x";
  const actionEndpoint = "/api/x/action";

  it("routes a {type:'toast'} side-effect to adapter.toast with message + opts", () => {
    const toastSpy = vi
      .spyOn(BrowserAdapter.prototype, "toast")
      .mockImplementation(() => {});
    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(freshContainer()),
      endpoint,
      actionEndpoint,
    });
    const response: ShellResponse = {
      vm,
      state,
      sideEffects: [{ type: "toast", message: "Done", tone: "success", durationMs: 2000 }],
    };
    shell.push(response);
    expect(toastSpy).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith("Done", { tone: "success", durationMs: 2000 });
  });

  it("does NOT route a toast effect missing its message (guarded)", () => {
    const toastSpy = vi
      .spyOn(BrowserAdapter.prototype, "toast")
      .mockImplementation(() => {});
    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(freshContainer()),
      endpoint,
      actionEndpoint,
    });
    shell.push({ vm, state, sideEffects: [{ type: "toast" }] });
    expect(toastSpy).not.toHaveBeenCalled();
  });

  it("is FAIL-QUIET when the adapter omits toast — no throw, no onError (cf. setBusy)", () => {
    const onError = vi.fn();
    const renderOnlyAdapter: Adapter = { render() {} };
    const shell = new ViewModelShell({
      adapter: renderOnlyAdapter,
      endpoint,
      actionEndpoint,
      onError,
    });
    expect(() =>
      shell.push({ vm, state, sideEffects: [{ type: "toast", message: "ignored" }] }),
    ).not.toThrow();
    // Unlike storage/navigate/saveFile, a dropped toast must NOT surface a
    // capability error — it's a UX nicety, not a correctness/security guarantee.
    expect(onError).not.toHaveBeenCalled();
  });
});
