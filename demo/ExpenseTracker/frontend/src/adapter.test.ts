import { describe, it, expect, vi } from "vitest";
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";
import type { ViewNode, ActionEvent } from "@ashley-shrok/viewmodel-shell";

function render(vm: ViewNode) {
  const container = document.createElement("div");
  const adapter = new BrowserAdapter(container);
  const onAction = vi.fn<[ActionEvent], void>();
  adapter.render(vm, onAction);
  return { container, onAction };
}

describe("BrowserAdapter — section", () => {
  it("renders section with heading", () => {
    const { container } = render({
      type: "section",
      heading: "Categories",
      children: [],
    });
    expect(container.querySelector(".vms-section")).not.toBeNull();
    expect(container.querySelector(".vms-section__heading")?.textContent).toBe("Categories");
  });

  it("renders section children", () => {
    const { container } = render({
      type: "section",
      heading: "Test",
      children: [{ type: "text", value: "Hello" }],
    });
    expect(container.querySelector(".vms-text")?.textContent).toBe("Hello");
  });
});

describe("BrowserAdapter — list-item warning variant", () => {
  it("applies warning variant class when over budget", () => {
    const { container } = render({
      type: "list",
      children: [{ type: "list-item", variant: "warning", children: [] }],
    });
    expect(container.querySelector(".vms-list-item--warning")).not.toBeNull();
  });

  it("does not apply variant class when under budget", () => {
    const { container } = render({
      type: "list",
      children: [{ type: "list-item", children: [] }],
    });
    expect(container.querySelector(".vms-list-item--warning")).toBeNull();
  });
});

describe("BrowserAdapter — list", () => {
  it("renders the correct number of items", () => {
    const { container } = render({
      type: "list",
      children: [
        { type: "list-item", children: [{ type: "text", value: "A" }] },
        { type: "list-item", children: [{ type: "text", value: "B" }] },
      ],
    });
    expect(container.querySelectorAll(".vms-list-item")).toHaveLength(2);
  });
});

describe("BrowserAdapter — button", () => {
  it("dispatches the action on click", () => {
    const action: ActionEvent = { name: "delete", context: { id: "1" } };
    const { container, onAction } = render({ type: "button", label: "Delete", action });
    container.querySelector<HTMLButtonElement>(".vms-button")!.click();
    expect(onAction).toHaveBeenCalledWith(action);
  });

  it("applies the danger variant class", () => {
    const { container } = render({
      type: "button", label: "X", variant: "danger", action: { name: "delete" },
    });
    expect(container.querySelector(".vms-button--danger")).not.toBeNull();
  });
});

describe("BrowserAdapter — form", () => {
  it("dispatches the submit action with field values merged into context", () => {
    const { container, onAction } = render({
      type: "form",
      submitAction: { name: "add" },
      children: [
        { type: "field", name: "amount", inputType: "number" },
        { type: "field", name: "note",   inputType: "text" },
      ],
    });
    container.querySelector<HTMLInputElement>("input[name=amount]")!.value = "25.00";
    container.querySelector<HTMLInputElement>("input[name=note]")!.value   = "Groceries";
    container.querySelector("form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    expect(onAction).toHaveBeenCalledWith({
      name: "add",
      context: { amount: "25.00", note: "Groceries" },
    });
  });
});

describe("BrowserAdapter — tabs", () => {
  it("marks the selected tab as active", () => {
    const { container } = render({
      type: "tabs",
      selected: "food",
      action: { name: "filter" },
      tabs: [
        { value: "all",  label: "All" },
        { value: "food", label: "Food" },
      ],
    });
    expect(container.querySelector(".vms-tabs__tab--active")?.textContent).toBe("Food");
  });

  it("dispatches select-category with the tab value on click", () => {
    const { container, onAction } = render({
      type: "tabs",
      selected: "food",
      action: { name: "select-category" },
      tabs: [
        { value: "food",      label: "Food" },
        { value: "transport", label: "Transport" },
      ],
    });
    container.querySelectorAll<HTMLButtonElement>(".vms-tabs__tab")[1].click();
    expect(onAction).toHaveBeenCalledWith({ name: "select-category", context: { value: "transport" } });
  });
});

describe("BrowserAdapter — progress", () => {
  it("sets the bar width from the value", () => {
    const { container } = render({ type: "progress", value: 60 });
    expect(container.querySelector<HTMLElement>(".vms-progress__bar")!.style.width).toBe("60%");
  });

  it("sets 100% width when over budget", () => {
    const { container } = render({ type: "progress", value: 100 });
    expect(container.querySelector<HTMLElement>(".vms-progress__bar")!.style.width).toBe("100%");
  });
});

describe("BrowserAdapter — stat-bar", () => {
  it("renders all three expense stats", () => {
    const { container } = render({
      type: "stat-bar",
      stats: [
        { label: "spent this month", value: "$932.24" },
        { label: "monthly budget",   value: "$1650.00" },
        { label: "remaining",        value: "$717.76" },
      ],
    });
    expect(container.querySelectorAll(".vms-stat-bar__item")).toHaveLength(3);
    expect(container.querySelectorAll(".vms-stat-bar__value")[0].textContent).toBe("$932.24");
  });
});

describe("BrowserAdapter — text", () => {
  it("renders the value as text content", () => {
    const { container } = render({ type: "text", value: "$12.50" });
    expect(container.querySelector(".vms-text")!.textContent).toBe("$12.50");
  });

  it("applies the subheading style for amounts", () => {
    const { container } = render({ type: "text", value: "$12.50", style: "subheading" });
    expect(container.querySelector(".vms-text--subheading")).not.toBeNull();
  });

  it("applies the muted style for category labels", () => {
    const { container } = render({ type: "text", value: "Food", style: "muted" });
    expect(container.querySelector(".vms-text--muted")).not.toBeNull();
  });
});
