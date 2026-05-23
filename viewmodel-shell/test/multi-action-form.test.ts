// 0.10.0 (#15) — multi-action forms: FormNode.buttons[] lets several buttons
// each harvest the form's CURRENT field values and dispatch a DIFFERENT action.
// Closes the "fetch-then-save shares a URL field" gap (two-form workaround
// silently dropped input).
//
// BrowserAdapter coverage:
//   - each buttons[] entry dispatches its own action name carrying the live
//     field values (the motivating fetch-meta vs add-item case);
//   - a buttons[]-only form (no submitAction) renders no default submit button;
//   - submitAction + buttons[] coexist (both render, both harvest);
//   - buttons[] entries support variant + pendingLabel (ButtonNode reuse).

import { describe, it, expect, vi, afterEach } from "vitest";
import type { ViewNode, ActionEvent } from "../src/index.js";
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

const urlForm = (extra: Partial<Record<string, unknown>> = {}): ViewNode => ({
  type: "form",
  // no submitAction — buttons[]-only (the motivating modal shape)
  children: [
    { type: "field", name: "url", inputType: "text", label: "URL", value: "" },
  ],
  buttons: [
    { type: "button", label: "✨ Fetch & fill", action: { name: "fetch-meta" }, pendingLabel: "Fetching…" },
    { type: "button", label: "Save", action: { name: "add-item" }, variant: "primary" },
  ],
  ...extra,
}) as ViewNode;

describe("0.10.0 (#15) — FormNode.buttons[] harvest", () => {
  it("each button dispatches its own action carrying the form's current field values", () => {
    const dispatched: ActionEvent[] = [];
    const container = freshContainer();
    new BrowserAdapter(container).render(urlForm(), (a) => dispatched.push(a));

    // Type a URL into the shared field.
    const input = container.querySelector("input") as HTMLInputElement;
    input.value = "https://example.com/item/42";

    // Find the two buttons by label.
    const btns = Array.from(container.querySelectorAll("button")) as HTMLButtonElement[];
    const fetchBtn = btns.find(b => b.textContent === "✨ Fetch & fill")!;
    const saveBtn = btns.find(b => b.textContent === "Save")!;
    expect(fetchBtn, "fetch button rendered").toBeDefined();
    expect(saveBtn, "save button rendered").toBeDefined();

    fetchBtn.click();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("fetch-meta");
    expect(dispatched[0]!.context).toEqual({ url: "https://example.com/item/42" });

    saveBtn.click();
    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]!.name).toBe("add-item");
    expect(dispatched[1]!.context).toEqual({ url: "https://example.com/item/42" });
  });

  it("a buttons[]-only form (no submitAction) renders NO default submit button", () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(urlForm(), () => {});
    // Only the two buttons[] entries — no auto "Submit".
    const labels = Array.from(container.querySelectorAll("button")).map(b => b.textContent);
    expect(labels).toEqual(["✨ Fetch & fill", "Save"]);
    expect(labels).not.toContain("Submit");
    // No type="submit" button exists.
    expect(container.querySelector("button[type=submit]")).toBeNull();
  });

  it("submitAction + buttons[] coexist: default submit harvests too", () => {
    const dispatched: ActionEvent[] = [];
    const vm: ViewNode = {
      type: "form",
      submitAction: { name: "save-default" },
      submitLabel: "Save",
      children: [
        { type: "field", name: "title", inputType: "text", label: "Title", value: "" },
      ],
      buttons: [
        { type: "button", label: "Preview", action: { name: "preview" } },
      ],
    };
    const container = freshContainer();
    new BrowserAdapter(container).render(vm, (a) => dispatched.push(a));
    (container.querySelector("input") as HTMLInputElement).value = "Draft";

    // Default submit button (type=submit) harvests via the form submit event.
    const submit = container.querySelector("button[type=submit]") as HTMLButtonElement;
    expect(submit.textContent).toBe("Save");
    submit.click();
    expect(dispatched[0]!.name).toBe("save-default");
    expect(dispatched[0]!.context).toEqual({ title: "Draft" });

    // buttons[] Preview harvests the same field.
    const preview = Array.from(container.querySelectorAll("button"))
      .find(b => b.textContent === "Preview") as HTMLButtonElement;
    preview.click();
    expect(dispatched[1]!.name).toBe("preview");
    expect(dispatched[1]!.context).toEqual({ title: "Draft" });
  });

  it("buttons[] entries carry ButtonNode features: variant class + pendingLabel swap", () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(urlForm(), () => {});
    const save = Array.from(container.querySelectorAll("button"))
      .find(b => b.textContent === "Save") as HTMLButtonElement;
    // variant: "primary" → modifier class (ButtonNode reuse).
    expect(save.classList.contains("vms-button--primary")).toBe(true);

    // pendingLabel on the fetch button swaps + adds .vms-button--pending on click.
    const fetchBtn = Array.from(container.querySelectorAll("button"))
      .find(b => b.textContent === "✨ Fetch & fill") as HTMLButtonElement;
    fetchBtn.click();
    expect(fetchBtn.textContent).toBe("Fetching…");
    expect(fetchBtn.classList.contains("vms-button--pending")).toBe(true);
  });

  it("checkbox + select fields harvest correctly through buttons[] (boolean coercion preserved)", () => {
    const dispatched: ActionEvent[] = [];
    const vm: ViewNode = {
      type: "form",
      children: [
        { type: "field", name: "title", inputType: "text", label: "Title", value: "seed" },
        { type: "field", name: "active", inputType: "checkbox", label: "Active", value: "true" },
      ],
      buttons: [{ type: "button", label: "Apply", action: { name: "apply" } }],
    };
    const container = freshContainer();
    new BrowserAdapter(container).render(vm, (a) => dispatched.push(a));
    (Array.from(container.querySelectorAll("button")).find(b => b.textContent === "Apply") as HTMLButtonElement).click();
    expect(dispatched[0]!.name).toBe("apply");
    // text field keeps its seed value; checkbox harvests as boolean true.
    expect(dispatched[0]!.context).toMatchObject({ title: "seed", active: true });
  });
});
