// 5.0.1 — FormNode.submitButton must honor the SAME click behavior a standalone
// ButtonNode does: pendingLabel (text swap + .vms-button--pending), disabled
// (class + attr + no-dispatch guard), and confirm (native destructive-action
// guard). Before this fix the submitButton render branch re-implemented button
// rendering (label/emphasis/tone/size/width only) and wired the FORM submit
// event, silently dropping all three. Reported by @hilda (Hecate PR #82).
//
// Both paths now go through BrowserAdapter.applyButtonBehavior, so they can't
// diverge again. We drive the form's submit event directly (the single dispatch
// point) — that's the path a real submit-button click / implicit Enter-submit
// takes — and assert the guarded activation runs.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { ViewNode, ActionEvent, StateAccess } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

const noopSA: StateAccess = { read: () => undefined, write: () => { /* noop */ } };

// A form whose submit is a consumer-provided ButtonNode (submitButton). `sbExtra`
// overrides ButtonNode fields (pendingLabel / disabled / confirm / …).
function renderForm(sbExtra: Record<string, unknown>): {
  form: HTMLFormElement;
  submit: HTMLButtonElement;
  dispatched: ActionEvent[];
} {
  const dispatched: ActionEvent[] = [];
  const container = freshContainer();
  const vm: ViewNode = {
    type: "form",
    submitAction: { name: "login" },
    children: [{ type: "field", name: "u", inputType: "text", label: "User", bind: "u" }],
    submitButton: {
      type: "button",
      label: "Sign In",
      action: { name: "login" },
      emphasis: "primary",
      ...sbExtra,
    },
  } as ViewNode;
  new BrowserAdapter(container).render(vm, (a) => dispatched.push(a), noopSA);
  const form = container.querySelector("form") as HTMLFormElement;
  const submit = form.querySelector("button[type=submit]") as HTMLButtonElement;
  return { form, submit, dispatched };
}

// Drive the single dispatch point: the form's submit event (a real submit-button
// click / implicit text-field Enter both route here).
function submitForm(form: HTMLFormElement): void {
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

describe("FormNode.submitButton — appearance parity with ButtonNode", () => {
  it("renders the consumer button's cosmetic props (label + emphasis)", () => {
    const { submit } = renderForm({});
    expect(submit.textContent).toBe("Sign In");
    expect(submit.classList.contains("vms-button")).toBe(true);
    expect(submit.classList.contains("vms-button--primary")).toBe(true);
  });
});

describe("FormNode.submitButton — pendingLabel", () => {
  it("swaps to pendingLabel and adds .vms-button--pending on submit, before dispatch", () => {
    const { form, submit, dispatched } = renderForm({ pendingLabel: "Signing in…" });
    expect(submit.textContent).toBe("Sign In");
    expect(submit.classList.contains("vms-button--pending")).toBe(false);

    submitForm(form);

    expect(submit.textContent).toBe("Signing in…");
    expect(submit.classList.contains("vms-button--pending")).toBe(true);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("login");
  });

  it("submit button WITHOUT pendingLabel does not get pending UI", () => {
    const { form, submit, dispatched } = renderForm({});
    submitForm(form);
    expect(submit.textContent).toBe("Sign In");
    expect(submit.classList.contains("vms-button--pending")).toBe(false);
    expect(dispatched).toHaveLength(1);
  });
});

describe("FormNode.submitButton — disabled", () => {
  it("sets the disabled attr + .vms-button--disabled and never dispatches", () => {
    const { form, submit, dispatched } = renderForm({ disabled: true, pendingLabel: "Signing in…" });
    expect(submit.disabled).toBe(true);
    expect(submit.classList.contains("vms-button--disabled")).toBe(true);

    submitForm(form);

    // guard suppresses dispatch AND the pendingLabel swap
    expect(dispatched).toHaveLength(0);
    expect(submit.textContent).toBe("Sign In");
    expect(submit.classList.contains("vms-button--pending")).toBe(false);
  });
});

describe("FormNode.submitButton — confirm", () => {
  it("accepting the confirm proceeds to dispatch (and pendingLabel swap)", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { form, submit, dispatched } = renderForm({ confirm: "Sign in as this user?", pendingLabel: "Signing in…" });

    submitForm(form);

    expect(confirmSpy).toHaveBeenCalledWith("Sign in as this user?");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("login");
    expect(submit.textContent).toBe("Signing in…");
    expect(submit.classList.contains("vms-button--pending")).toBe(true);
  });

  it("cancelling the confirm suppresses dispatch AND the pendingLabel swap", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { form, submit, dispatched } = renderForm({ confirm: "Sign in as this user?", pendingLabel: "Signing in…" });

    submitForm(form);

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(dispatched).toHaveLength(0);
    expect(submit.textContent).toBe("Sign In");
    expect(submit.classList.contains("vms-button--pending")).toBe(false);
  });
});
