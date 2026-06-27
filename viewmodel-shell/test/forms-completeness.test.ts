// 3.4.0 (PROPOSED — forms completeness) — FieldNode.error/help/disabled/readonly
// + ButtonNode.disabled. Direct BrowserAdapter render + a11y wiring assertions.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { ViewNode, ActionEvent } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function renderField(extra: Record<string, unknown>): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const node = { type: "field", name: "email", inputType: "text", bind: "email", label: "Email", ...extra } as ViewNode;
  new BrowserAdapter(container).render({ type: "page", children: [node] }, () => {});
  return container;
}

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("FieldNode.error", () => {
  it("renders an inline error with role=alert, marks the wrapper, and sets aria-invalid + aria-describedby", () => {
    const c = renderField({ error: "Email is required" });
    const err = c.querySelector(".vms-field__error")!;
    expect(err).not.toBeNull();
    expect(err.getAttribute("role")).toBe("alert");
    expect(err.textContent).toBe("Email is required");
    expect(c.querySelector(".vms-field--error")).not.toBeNull();
    const input = c.querySelector(".vms-field__input")!;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("vms-email-error");
  });
  it("no error → no error element, no aria-invalid", () => {
    const c = renderField({});
    expect(c.querySelector(".vms-field__error")).toBeNull();
    expect(c.querySelector(".vms-field__input")!.getAttribute("aria-invalid")).toBeNull();
  });
});

describe("FieldNode.help", () => {
  it("renders help text wired into aria-describedby", () => {
    const c = renderField({ help: "We never share it." });
    const help = c.querySelector(".vms-field__help")!;
    expect(help.textContent).toBe("We never share it.");
    expect(c.querySelector(".vms-field__input")!.getAttribute("aria-describedby")).toBe("vms-email-help");
  });
  it("help + error both wired into aria-describedby (help first, then error)", () => {
    const c = renderField({ help: "hint", error: "bad" });
    expect(c.querySelector(".vms-field__input")!.getAttribute("aria-describedby"))
      .toBe("vms-email-help vms-email-error");
  });
});

describe("FieldNode.disabled / readonly", () => {
  it("disabled sets the native attribute + wrapper class", () => {
    const c = renderField({ disabled: true });
    expect((c.querySelector(".vms-field__input") as HTMLInputElement).disabled).toBe(true);
    expect(c.querySelector(".vms-field--disabled")).not.toBeNull();
  });
  it("readonly sets readOnly without disabling", () => {
    const c = renderField({ readonly: true });
    const input = c.querySelector(".vms-field__input") as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
  });
  it("works on a textarea too", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    new BrowserAdapter(c).render(
      { type: "page", children: [{ type: "field", name: "bio", inputType: "textarea", bind: "bio", disabled: true } as ViewNode] },
      () => {},
    );
    expect((c.querySelector("textarea.vms-field__input") as HTMLTextAreaElement).disabled).toBe(true);
  });
});

describe("FieldNode constraints (min/max/step/maxLength)", () => {
  it("min/max/step pass through to a number input", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    new BrowserAdapter(c).render(
      { type: "page", children: [{ type: "field", name: "qty", inputType: "number", bind: "qty", min: "0", max: "10", step: "0.5" } as ViewNode] },
      () => {},
    );
    const inp = c.querySelector(".vms-field__input") as HTMLInputElement;
    expect(inp.getAttribute("min")).toBe("0");
    expect(inp.getAttribute("max")).toBe("10");
    expect(inp.getAttribute("step")).toBe("0.5");
  });
  it("date bounds pass through as strings", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    new BrowserAdapter(c).render(
      { type: "page", children: [{ type: "field", name: "d", inputType: "date", bind: "d", min: "2020-01-01", max: "2030-12-31" } as ViewNode] },
      () => {},
    );
    const inp = c.querySelector(".vms-field__input") as HTMLInputElement;
    expect(inp.getAttribute("min")).toBe("2020-01-01");
    expect(inp.getAttribute("max")).toBe("2030-12-31");
  });
  it("maxLength applies to text input and textarea", () => {
    const c = document.createElement("div");
    document.body.appendChild(c);
    new BrowserAdapter(c).render(
      { type: "page", children: [
        { type: "field", name: "t", inputType: "text", bind: "t", maxLength: 20 } as ViewNode,
        { type: "field", name: "ta", inputType: "textarea", bind: "ta", maxLength: 200 } as ViewNode,
      ] },
      () => {},
    );
    expect((c.querySelector("input.vms-field__input") as HTMLInputElement).maxLength).toBe(20);
    expect((c.querySelector("textarea.vms-field__input") as HTMLTextAreaElement).maxLength).toBe(200);
  });
});

describe("ButtonNode.disabled", () => {
  function renderButton(disabled: boolean): { c: HTMLElement; fired: ActionEvent[] } {
    const c = document.createElement("div");
    document.body.appendChild(c);
    const fired: ActionEvent[] = [];
    new BrowserAdapter(c).render(
      { type: "page", children: [{ type: "button", label: "Save", action: { name: "save" }, disabled } as ViewNode] },
      (a) => fired.push(a),
    );
    return { c, fired };
  }
  it("disabled button sets native disabled + class and does NOT dispatch on click", () => {
    const { c, fired } = renderButton(true);
    const btn = c.querySelector(".vms-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.classList.contains("vms-button--disabled")).toBe(true);
    btn.dispatchEvent(new Event("click"));
    expect(fired).toHaveLength(0);
  });
  it("enabled button dispatches normally", () => {
    const { c, fired } = renderButton(false);
    (c.querySelector(".vms-button") as HTMLButtonElement).dispatchEvent(new Event("click"));
    expect(fired).toEqual([{ name: "save" }]);
  });
});
