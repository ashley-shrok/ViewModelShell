// v5.0 — ButtonNode.confirm: a destructive-action guard via the NATIVE browser
// confirm(). On click of a button with `confirm` set, the BrowserAdapter shows
// window.confirm(message) BEFORE dispatching; the action fires only on accept,
// Cancel suppresses it entirely (no dispatch, no pendingLabel swap). It is a
// client-only human affordance — an agent dispatches the action name directly
// over the wire and never reaches this click handler.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { ViewNode, ActionEvent } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function renderButton(extra: Record<string, unknown>): { c: HTMLElement; onAction: ReturnType<typeof vi.fn> } {
  const c = document.createElement("div");
  document.body.appendChild(c);
  const onAction = vi.fn();
  const node = { type: "button", label: "Delete", action: { name: "delete" }, ...extra } as ViewNode;
  new BrowserAdapter(c).render({ type: "page", children: [node] } as ViewNode, onAction as (a: ActionEvent) => void);
  return { c, onAction };
}

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("ButtonNode.confirm — native destructive-action guard", () => {
  it("accepting the confirm dispatches the action", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { c, onAction } = renderButton({ confirm: "Delete this? This cannot be undone." });
    (c.querySelector(".vms-button") as HTMLButtonElement).click();
    expect(confirmSpy).toHaveBeenCalledWith("Delete this? This cannot be undone.");
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ name: "delete" });
  });

  it("cancelling the confirm suppresses the dispatch entirely", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { c, onAction } = renderButton({ confirm: "Delete this? This cannot be undone." });
    (c.querySelector(".vms-button") as HTMLButtonElement).click();
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("cancelling the confirm does NOT swap the pendingLabel (no visual change)", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const { c } = renderButton({ confirm: "Sure?", pendingLabel: "Deleting…" });
    const btn = c.querySelector(".vms-button") as HTMLButtonElement;
    btn.click();
    expect(btn.textContent).toBe("Delete");
    expect(btn.classList.contains("vms-button--pending")).toBe(false);
  });

  it("a button without confirm dispatches immediately, never calling window.confirm", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { c, onAction } = renderButton({});
    (c.querySelector(".vms-button") as HTMLButtonElement).click();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledWith({ name: "delete" });
  });
});
