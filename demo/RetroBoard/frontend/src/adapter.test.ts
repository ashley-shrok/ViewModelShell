import { describe, it, expect, vi } from "vitest";
import { BrowserAdapter } from "viewmodel-shell/browser";
import type { ViewNode, ActionEvent } from "viewmodel-shell";

function render(vm: ViewNode) {
  const container = document.createElement("div");
  const adapter = new BrowserAdapter(container);
  const onAction = vi.fn<[ActionEvent], void>();
  adapter.render(vm, onAction);
  return { container, onAction };
}

describe("BrowserAdapter — section", () => {
  it("renders the section heading", () => {
    const { container } = render({
      type: "section",
      heading: "Went Well (3)",
      children: [],
    });
    expect(container.querySelector(".vms-section__heading")!.textContent).toBe("Went Well (3)");
  });

  it("renders children inside the section", () => {
    const { container } = render({
      type: "section",
      heading: "Action Items (1)",
      children: [{ type: "text", value: "Fix the thing" }],
    });
    expect(container.querySelector(".vms-text")!.textContent).toBe("Fix the thing");
  });
});

describe("BrowserAdapter — stat-bar (multiple stats)", () => {
  it("renders all four stat items", () => {
    const { container } = render({
      type: "stat-bar",
      stats: [
        { label: "cards", value: "5" },
        { label: "votes", value: "12" },
        { label: "open", value: "3" },
        { label: "resolved", value: "2" },
      ],
    });
    expect(container.querySelectorAll(".vms-stat-bar__item")).toHaveLength(4);
  });

  it("renders correct values for each stat", () => {
    const { container } = render({
      type: "stat-bar",
      stats: [
        { label: "cards", value: "5" },
        { label: "votes", value: "12" },
      ],
    });
    const values = Array.from(
      container.querySelectorAll(".vms-stat-bar__value")
    ).map(el => el.textContent);
    expect(values).toContain("5");
    expect(values).toContain("12");
  });
});

describe("BrowserAdapter — checkbox (resolve action)", () => {
  it("dispatches resolve-card with card id and checked state", () => {
    const { container, onAction } = render({
      type: "checkbox",
      name: "resolved",
      checked: false,
      action: { name: "resolve-card", context: { id: "abc123" } },
    });
    const inp = container.querySelector<HTMLInputElement>("input[type=checkbox]")!;
    inp.checked = true;
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onAction).toHaveBeenCalledWith({
      name: "resolve-card",
      context: { id: "abc123", checked: true },
    });
  });

  it("renders checked when card is already resolved", () => {
    const { container } = render({
      type: "checkbox",
      name: "resolved",
      checked: true,
      action: { name: "resolve-card", context: { id: "abc123" } },
    });
    expect(
      container.querySelector<HTMLInputElement>("input[type=checkbox]")!.checked
    ).toBe(true);
  });
});

describe("BrowserAdapter — form (add-card)", () => {
  it("dispatches add-card action with baked-in section and typed text", () => {
    const { container, onAction } = render({
      type: "form",
      submitAction: { name: "add-card", context: { section: "went-well" } },
      submitLabel: "Add",
      children: [{ type: "field", name: "text", inputType: "text" }],
    });
    container.querySelector<HTMLInputElement>("input[name=text]")!.value = "Fast deploys";
    container.querySelector("form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    expect(onAction).toHaveBeenCalledWith({
      name: "add-card",
      context: { section: "went-well", text: "Fast deploys" },
    });
  });
});

describe("BrowserAdapter — list-item (done variant)", () => {
  it("applies done variant class on resolved cards", () => {
    const { container } = render({
      type: "list",
      children: [{ type: "list-item", variant: "done", children: [] }],
    });
    expect(container.querySelector(".vms-list-item--done")).not.toBeNull();
  });

  it("renders delete button with danger variant", () => {
    const { container } = render({
      type: "list-item",
      children: [
        {
          type: "button",
          label: "Delete",
          variant: "danger",
          action: { name: "delete-card", context: { id: "1" } },
        },
      ],
    });
    expect(container.querySelector(".vms-button--danger")).not.toBeNull();
  });
});

describe("BrowserAdapter — upvote button", () => {
  it("dispatches upvote-card action on click", () => {
    const action: ActionEvent = { name: "upvote-card", context: { id: "abc" } };
    const { container, onAction } = render({
      type: "button",
      label: "▲ 3",
      action,
    });
    container.querySelector<HTMLButtonElement>(".vms-button")!.click();
    expect(onAction).toHaveBeenCalledWith(action);
  });

  it("shows vote count in button label", () => {
    const { container } = render({
      type: "button",
      label: "▲ 7",
      action: { name: "upvote-card", context: { id: "x" } },
    });
    expect(container.querySelector(".vms-button")!.textContent).toBe("▲ 7");
  });
});

describe("BrowserAdapter — text (strikethrough on resolved)", () => {
  it("applies strikethrough style class", () => {
    const { container } = render({
      type: "text",
      value: "Fix it",
      style: "strikethrough",
    });
    expect(container.querySelector(".vms-text--strikethrough")).not.toBeNull();
  });
});
