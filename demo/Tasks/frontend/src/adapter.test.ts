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

  it("applies variant class", () => {
    const { container } = render({
      type: "list",
      children: [{ type: "list-item", variant: "done", children: [] }],
    });
    expect(container.querySelector(".vms-list-item--done")).not.toBeNull();
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
      children: [{ type: "field", name: "title", inputType: "text" }],
    });
    container.querySelector<HTMLInputElement>("input[name=title]")!.value = "New task";
    container.querySelector("form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    expect(onAction).toHaveBeenCalledWith({ name: "add", context: { title: "New task" } });
  });
});

describe("BrowserAdapter — tabs", () => {
  it("marks the selected tab as active", () => {
    const { container } = render({
      type: "tabs",
      selected: "active",
      action: { name: "filter" },
      tabs: [{ value: "all", label: "All" }, { value: "active", label: "Active" }],
    });
    expect(container.querySelector(".vms-tabs__tab--active")?.textContent).toBe("Active");
  });

  it("dispatches the action with the tab value on click", () => {
    const { container, onAction } = render({
      type: "tabs",
      selected: "all",
      action: { name: "filter" },
      tabs: [{ value: "all", label: "All" }, { value: "active", label: "Active" }],
    });
    container.querySelectorAll<HTMLButtonElement>(".vms-tabs__tab")[1].click();
    expect(onAction).toHaveBeenCalledWith({ name: "filter", context: { value: "active" } });
  });
});

describe("BrowserAdapter — checkbox", () => {
  it("dispatches the action with checked state merged into context", () => {
    const { container, onAction } = render({
      type: "checkbox",
      name: "done",
      checked: false,
      action: { name: "toggle", context: { id: "1" } },
    });
    const inp = container.querySelector<HTMLInputElement>("input[type=checkbox]")!;
    inp.checked = true;
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "toggle", context: { id: "1", checked: true } });
  });
});

describe("BrowserAdapter — progress", () => {
  it("sets the bar width from the value", () => {
    const { container } = render({ type: "progress", value: 75 });
    expect(container.querySelector<HTMLElement>(".vms-progress__bar")!.style.width).toBe("75%");
  });
});

describe("BrowserAdapter — stat-bar", () => {
  it("renders label and value", () => {
    const { container } = render({
      type: "stat-bar",
      stats: [{ label: "complete", value: "2 of 5" }],
    });
    expect(container.querySelector(".vms-stat-bar__value")!.textContent).toBe("2 of 5");
    expect(container.querySelector(".vms-stat-bar__label")!.textContent).toBe("complete");
  });
});

describe("BrowserAdapter — text", () => {
  it("renders the value as text content", () => {
    const { container } = render({ type: "text", value: "Hello" });
    expect(container.querySelector(".vms-text")!.textContent).toBe("Hello");
  });

  it("applies the strikethrough style class", () => {
    const { container } = render({ type: "text", value: "Done", style: "strikethrough" });
    expect(container.querySelector(".vms-text--strikethrough")).not.toBeNull();
  });
});

describe("BrowserAdapter — draft value preservation", () => {
  it("retains typed field values across re-renders when server sends no value", () => {
    const container = document.createElement("div");
    const adapter = new BrowserAdapter(container);
    const onAction = vi.fn();

    const vm = (label: string): ViewNode => ({
      type: "form",
      submitAction: { name: "submit" },
      children: [{ type: "field", name: "title", inputType: "text", label }],
    });

    adapter.render(vm("First"), onAction);
    container.querySelector<HTMLInputElement>("input[name=title]")!.value = "My draft";

    adapter.render(vm("Second"), onAction);
    expect(container.querySelector<HTMLInputElement>("input[name=title]")!.value).toBe("My draft");
  });

  it("does not overwrite a value the server explicitly set", () => {
    const container = document.createElement("div");
    const adapter = new BrowserAdapter(container);
    const onAction = vi.fn();

    adapter.render({
      type: "form",
      submitAction: { name: "submit" },
      children: [{ type: "field", name: "title", inputType: "text" }],
    }, onAction);
    container.querySelector<HTMLInputElement>("input[name=title]")!.value = "My draft";

    adapter.render({
      type: "form",
      submitAction: { name: "submit" },
      children: [{ type: "field", name: "title", inputType: "text", value: "Server value" }],
    }, onAction);
    expect(container.querySelector<HTMLInputElement>("input[name=title]")!.value).toBe("Server value");
  });

  it("does not restore a field that disappeared in the new render", () => {
    const container = document.createElement("div");
    const adapter = new BrowserAdapter(container);
    const onAction = vi.fn();

    adapter.render({
      type: "form",
      submitAction: { name: "submit" },
      children: [{ type: "field", name: "device_model", inputType: "text" }],
    }, onAction);
    container.querySelector<HTMLInputElement>("input[name=device_model]")!.value = "ThinkPad";

    adapter.render({
      type: "form",
      submitAction: { name: "submit" },
      children: [{ type: "field", name: "application", inputType: "text" }],
    }, onAction);
    expect(container.querySelector("input[name=device_model]")).toBeNull();
    expect(container.querySelector<HTMLInputElement>("input[name=application]")!.value).toBe("");
  });
});
