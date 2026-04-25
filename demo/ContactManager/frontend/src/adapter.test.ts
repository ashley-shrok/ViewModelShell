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

// ── Field with action (real-time search) ─────────────────────────────────────

describe("BrowserAdapter — field with action", () => {
  it("dispatches action on input event with field value in context", () => {
    const { container, onAction } = render({
      type: "form",
      submitAction: { name: "search" },
      children: [
        { type: "field", name: "query", inputType: "text", action: { name: "search" } },
      ],
    });
    const inp = container.querySelector<HTMLInputElement>("input[name=query]")!;
    inp.value = "alice";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "search", context: { query: "alice" } });
  });

  it("merges existing action context with field value", () => {
    const { container, onAction } = render({
      type: "form",
      submitAction: { name: "search" },
      children: [
        {
          type: "field",
          name: "query",
          inputType: "text",
          action: { name: "search", context: { source: "list" } },
        },
      ],
    });
    const inp = container.querySelector<HTMLInputElement>("input[name=query]")!;
    inp.value = "bob";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "search", context: { source: "list", query: "bob" } });
  });

  it("does not add input listener when field has no action", () => {
    const { container, onAction } = render({
      type: "form",
      submitAction: { name: "submit" },
      children: [{ type: "field", name: "title", inputType: "text" }],
    });
    const inp = container.querySelector<HTMLInputElement>("input[name=title]")!;
    inp.value = "hello";
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it("dispatches action on textarea input event", () => {
    const { container, onAction } = render({
      type: "form",
      submitAction: { name: "save" },
      children: [
        { type: "field", name: "notes", inputType: "textarea", action: { name: "autosave" } },
      ],
    });
    const ta = container.querySelector<HTMLTextAreaElement>("textarea[name=notes]")!;
    ta.value = "some notes";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "autosave", context: { notes: "some notes" } });
  });
});

// ── Contact list items ────────────────────────────────────────────────────────

describe("BrowserAdapter — contact list items", () => {
  it("renders name, email, phone as text nodes", () => {
    const { container } = render({
      type: "list",
      children: [
        {
          type: "list-item",
          id: "c1",
          children: [
            { type: "text", value: "Alice Johnson" },
            { type: "text", value: "alice@example.com", style: "muted" },
            { type: "text", value: "555-0101", style: "muted" },
            { type: "button", label: "View", action: { name: "navigate-to-detail", context: { id: "c1" } } },
          ],
        },
      ],
    });
    const texts = container.querySelectorAll(".vms-text");
    expect(texts).toHaveLength(3);
    expect(texts[0].textContent).toBe("Alice Johnson");
  });

  it("dispatches navigate-to-detail on View click", () => {
    const { container, onAction } = render({
      type: "list",
      children: [
        {
          type: "list-item",
          id: "c1",
          children: [
            { type: "text", value: "Alice Johnson" },
            {
              type: "button",
              label: "View",
              action: { name: "navigate-to-detail", context: { id: "c1" } },
            },
          ],
        },
      ],
    });
    container.querySelector<HTMLButtonElement>(".vms-button")!.click();
    expect(onAction).toHaveBeenCalledWith({ name: "navigate-to-detail", context: { id: "c1" } });
  });
});

// ── Detail view form ──────────────────────────────────────────────────────────

describe("BrowserAdapter — detail view form", () => {
  it("pre-fills inputs with contact values", () => {
    const { container } = render({
      type: "form",
      submitAction: { name: "save-contact", context: { id: "c1" } },
      submitLabel: "Save",
      children: [
        { type: "field", name: "name",  inputType: "text",  label: "Name",  value: "Alice Johnson",    required: true },
        { type: "field", name: "email", inputType: "email", label: "Email", value: "alice@example.com" },
      ],
    });
    expect(container.querySelector<HTMLInputElement>("input[name=name]")!.value).toBe("Alice Johnson");
    expect(container.querySelector<HTMLInputElement>("input[name=email]")!.value).toBe("alice@example.com");
  });

  it("submits save-contact with baked-in id merged with field values", () => {
    const { container, onAction } = render({
      type: "form",
      submitAction: { name: "save-contact", context: { id: "c1" } },
      submitLabel: "Save",
      children: [
        { type: "field", name: "name", inputType: "text", value: "Alice Johnson" },
      ],
    });
    container.querySelector<HTMLInputElement>("input[name=name]")!.value = "Alice Updated";
    container.querySelector("form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    expect(onAction).toHaveBeenCalledWith({
      name: "save-contact",
      context: { id: "c1", name: "Alice Updated" },
    });
  });

  it("dispatches navigate-to-list on Back button click", () => {
    const { container, onAction } = render({
      type: "page",
      title: "Alice Johnson",
      children: [
        { type: "button", label: "← Back", action: { name: "navigate-to-list" } },
        {
          type: "form",
          submitAction: { name: "save-contact", context: { id: "c1" } },
          children: [],
        },
      ],
    });
    container.querySelector<HTMLButtonElement>(".vms-button")!.click();
    expect(onAction).toHaveBeenCalledWith({ name: "navigate-to-list" });
  });
});
