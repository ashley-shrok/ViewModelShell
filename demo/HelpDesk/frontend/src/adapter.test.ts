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

// ── error text style ───────────────────────────────────────────────────────────

describe("BrowserAdapter — text error style", () => {
  it("applies vms-text--error class", () => {
    const { container } = render({ type: "text", value: "Title is required.", style: "error" });
    expect(container.querySelector(".vms-text--error")).not.toBeNull();
  });

  it("renders the error message", () => {
    const { container } = render({ type: "text", value: "Title is required.", style: "error" });
    expect(container.querySelector(".vms-text")!.textContent).toBe("Title is required.");
  });
});

// ── secondary button variant ──────────────────────────────────────────────────

describe("BrowserAdapter — secondary button", () => {
  it("applies vms-button--secondary class", () => {
    const { container } = render({
      type: "button", label: "View", variant: "secondary", action: { name: "select-ticket" },
    });
    expect(container.querySelector(".vms-button--secondary")).not.toBeNull();
  });

  it("dispatches the action on click", () => {
    const action: ActionEvent = { name: "select-ticket", context: { id: "42" } };
    const { container, onAction } = render({ type: "button", label: "View", action, variant: "secondary" });
    container.querySelector<HTMLButtonElement>(".vms-button")!.click();
    expect(onAction).toHaveBeenCalledWith(action);
  });
});

// ── date field ────────────────────────────────────────────────────────────────

describe("BrowserAdapter — date field", () => {
  it("renders an input with type=date", () => {
    const { container } = render({
      type: "field", name: "due_date", inputType: "date", label: "Due By",
    });
    const input = container.querySelector<HTMLInputElement>("input[type=date]");
    expect(input).not.toBeNull();
    expect(input!.name).toBe("due_date");
  });

  it("includes date field value in form submit context", () => {
    const { container, onAction } = render({
      type: "form",
      submitAction: { name: "create-ticket", context: { type: "hardware", priority: "high" } },
      submitLabel: "Submit",
      children: [
        { type: "field", name: "title",    inputType: "text" },
        { type: "field", name: "due_date", inputType: "date" },
      ],
    });
    container.querySelector<HTMLInputElement>("input[name=title]")!.value    = "Laptop broken";
    container.querySelector<HTMLInputElement>("input[name=due_date]")!.value = "2026-06-15";
    container.querySelector("form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    expect(onAction).toHaveBeenCalledWith({
      name: "create-ticket",
      context: { type: "hardware", priority: "high", title: "Laptop broken", due_date: "2026-06-15" },
    });
  });
});

// ── baked context merging with form fields ────────────────────────────────────

describe("BrowserAdapter — form with baked context", () => {
  it("merges baked action context with form field values", () => {
    const { container, onAction } = render({
      type: "form",
      submitAction: { name: "create-ticket", context: { type: "software", priority: "low" } },
      children: [
        { type: "field", name: "title",       inputType: "text" },
        { type: "field", name: "application", inputType: "text" },
      ],
    });
    container.querySelector<HTMLInputElement>("input[name=title]")!.value       = "Crashes on start";
    container.querySelector<HTMLInputElement>("input[name=application]")!.value = "Outlook";
    container.querySelector("form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    expect(onAction).toHaveBeenCalledWith({
      name: "create-ticket",
      context: {
        type: "software", priority: "low",
        title: "Crashes on start", application: "Outlook",
      },
    });
  });
});

// ── multiple tab groups on one page ──────────────────────────────────────────

describe("BrowserAdapter — multiple tab groups", () => {
  it("each tab group dispatches its own action", () => {
    const { container, onAction } = render({
      type: "page",
      title: "New Ticket",
      children: [
        {
          type: "tabs", selected: "hardware", action: { name: "set-type" },
          tabs: [{ value: "hardware", label: "Hardware" }, { value: "software", label: "Software" }],
        },
        {
          type: "tabs", selected: "medium", action: { name: "set-priority" },
          tabs: [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }],
        },
      ],
    });
    const tabGroups = container.querySelectorAll(".vms-tabs");
    expect(tabGroups).toHaveLength(2);

    // Click "Software" in the first group
    tabGroups[0].querySelectorAll<HTMLButtonElement>(".vms-tabs__tab")[1].click();
    expect(onAction).toHaveBeenCalledWith({ name: "set-type", context: { value: "software" } });

    // Click "Low" in the second group
    tabGroups[1].querySelectorAll<HTMLButtonElement>(".vms-tabs__tab")[0].click();
    expect(onAction).toHaveBeenCalledWith({ name: "set-priority", context: { value: "low" } });
  });
});

// ── list-item priority variants ───────────────────────────────────────────────

describe("BrowserAdapter — list-item priority variants", () => {
  it("applies critical variant class", () => {
    const { container } = render({
      type: "list",
      children: [{ type: "list-item", variant: "critical", children: [] }],
    });
    expect(container.querySelector(".vms-list-item--critical")).not.toBeNull();
  });

  it("applies high variant class", () => {
    const { container } = render({
      type: "list",
      children: [{ type: "list-item", variant: "high", children: [] }],
    });
    expect(container.querySelector(".vms-list-item--high")).not.toBeNull();
  });
});

// ── section rendering ─────────────────────────────────────────────────────────

describe("BrowserAdapter — section", () => {
  it("renders heading and nested form", () => {
    const { container } = render({
      type: "section",
      heading: "Agent Notes",
      children: [
        {
          type: "form",
          submitAction: { name: "save-notes", context: { id: "1" } },
          submitLabel: "Save Notes",
          children: [{ type: "field", name: "agent_notes", inputType: "textarea" }],
        },
      ],
    });
    expect(container.querySelector(".vms-section__heading")!.textContent).toBe("Agent Notes");
    expect(container.querySelector("textarea[name=agent_notes]")).not.toBeNull();
  });

  it("textarea value included in form submit", () => {
    const { container, onAction } = render({
      type: "form",
      submitAction: { name: "save-notes", context: { id: "7" } },
      children: [{ type: "field", name: "agent_notes", inputType: "textarea" }],
    });
    (container.querySelector("textarea[name=agent_notes]") as HTMLTextAreaElement).value =
      "Replaced the hard drive.";
    container.querySelector("form")!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
    expect(onAction).toHaveBeenCalledWith({
      name: "save-notes",
      context: { id: "7", agent_notes: "Replaced the hard drive." },
    });
  });
});

// ── stat-bar with four items ──────────────────────────────────────────────────

describe("BrowserAdapter — stat-bar four items", () => {
  it("renders all four stat items", () => {
    const { container } = render({
      type: "stat-bar",
      stats: [
        { label: "open", value: "3" },
        { label: "in progress", value: "1" },
        { label: "resolved", value: "12" },
        { label: "total", value: "16" },
      ],
    });
    expect(container.querySelectorAll(".vms-stat-bar__item")).toHaveLength(4);
    expect(container.querySelectorAll(".vms-stat-bar__value")[2].textContent).toBe("12");
  });
});

// ── hidden field ──────────────────────────────────────────────────────────────

describe("BrowserAdapter — hidden field", () => {
  it("renders a bare input with type=hidden (no wrapper)", () => {
    const { container } = render({ type: "field", name: "record_version", inputType: "hidden", value: "42" });
    const inp = container.querySelector<HTMLInputElement>("input[type=hidden]");
    expect(inp).not.toBeNull();
    expect(inp!.name).toBe("record_version");
    expect(inp!.value).toBe("42");
    expect(container.querySelector(".vms-field")).toBeNull();
  });

  it("hidden value is included in form submit context", () => {
    const { container, onAction } = render({
      type: "form",
      submitAction: { name: "save" },
      children: [
        { type: "field", name: "title", inputType: "text" },
        { type: "field", name: "record_version", inputType: "hidden", value: "42" },
      ],
    });
    container.querySelector<HTMLInputElement>("input[name=title]")!.value = "Hello";
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "save", context: { title: "Hello", record_version: "42" } });
  });

  it("hidden field is excluded from draft value snapshot", () => {
    const container = document.createElement("div");
    const adapter = new BrowserAdapter(container);
    const onAction = vi.fn();
    const vm = (val: string): ViewNode => ({
      type: "form", submitAction: { name: "save" },
      children: [{ type: "field", name: "token", inputType: "hidden", value: val }],
    });
    adapter.render(vm("v1"), onAction);
    adapter.render(vm("v2"), onAction);
    expect(container.querySelector<HTMLInputElement>("input[name=token]")!.value).toBe("v2");
  });
});

// ── time and datetime-local fields ────────────────────────────────────────────

describe("BrowserAdapter — time field", () => {
  it("renders an input with type=time", () => {
    const { container } = render({ type: "field", name: "start_time", inputType: "time", label: "Start" });
    expect(container.querySelector<HTMLInputElement>("input[type=time]")).not.toBeNull();
  });

  it("time value included in form submit", () => {
    const { container, onAction } = render({
      type: "form", submitAction: { name: "book" },
      children: [{ type: "field", name: "start_time", inputType: "time" }],
    });
    container.querySelector<HTMLInputElement>("input[name=start_time]")!.value = "09:30";
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "book", context: { start_time: "09:30" } });
  });
});

describe("BrowserAdapter — datetime-local field", () => {
  it("renders an input with type=datetime-local", () => {
    const { container } = render({ type: "field", name: "scheduled_at", inputType: "datetime-local" });
    expect(container.querySelector<HTMLInputElement>("input[type=datetime-local]")).not.toBeNull();
  });

  it("datetime-local value included in form submit", () => {
    const { container, onAction } = render({
      type: "form", submitAction: { name: "schedule" },
      children: [{ type: "field", name: "scheduled_at", inputType: "datetime-local" }],
    });
    container.querySelector<HTMLInputElement>("input[name=scheduled_at]")!.value = "2026-06-01T10:00";
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "schedule", context: { scheduled_at: "2026-06-01T10:00" } });
  });
});

// ── select field ──────────────────────────────────────────────────────────────

describe("BrowserAdapter — select field", () => {
  it("renders a select with options", () => {
    const { container } = render({
      type: "field", name: "priority", inputType: "select", label: "Priority",
      options: [{ value: "low", label: "Low" }, { value: "high", label: "High" }],
    });
    expect(container.querySelector("select")).not.toBeNull();
    expect(container.querySelector("select")!.options).toHaveLength(2);
  });

  it("pre-selects the option matching value", () => {
    const { container } = render({
      type: "field", name: "priority", inputType: "select", value: "high",
      options: [{ value: "low", label: "Low" }, { value: "high", label: "High" }],
    });
    expect(container.querySelector<HTMLSelectElement>("select")!.value).toBe("high");
  });

  it("select value included in form submit", () => {
    const { container, onAction } = render({
      type: "form", submitAction: { name: "create" },
      children: [{
        type: "field", name: "priority", inputType: "select",
        options: [{ value: "low", label: "Low" }, { value: "high", label: "High" }],
      }],
    });
    container.querySelector<HTMLSelectElement>("select[name=priority]")!.value = "high";
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "create", context: { priority: "high" } });
  });
});

// ── select-multiple field ─────────────────────────────────────────────────────

describe("BrowserAdapter — select-multiple field", () => {
  it("renders a multi-select", () => {
    const { container } = render({
      type: "field", name: "tags", inputType: "select-multiple",
      options: [{ value: "a", label: "A" }, { value: "b", label: "B" }],
    });
    expect(container.querySelector<HTMLSelectElement>("select")!.multiple).toBe(true);
  });

  it("pre-selects multiple options from comma-separated value", () => {
    const { container } = render({
      type: "field", name: "tags", inputType: "select-multiple", value: "a,c",
      options: [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }],
    });
    const opts = Array.from(container.querySelector<HTMLSelectElement>("select")!.options);
    expect(opts.find(o => o.value === "a")!.selected).toBe(true);
    expect(opts.find(o => o.value === "b")!.selected).toBe(false);
    expect(opts.find(o => o.value === "c")!.selected).toBe(true);
  });

  it("multi-select values joined comma-separated in form submit", () => {
    const { container, onAction } = render({
      type: "form", submitAction: { name: "save" },
      children: [{
        type: "field", name: "tags", inputType: "select-multiple",
        options: [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }],
      }],
    });
    const sel = container.querySelector<HTMLSelectElement>("select[name=tags]")!;
    sel.options[0].selected = true;
    sel.options[2].selected = true;
    container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "save", context: { tags: "a,c" } });
  });
});

// ── field Enter-key action ────────────────────────────────────────────────────

describe("BrowserAdapter — field Enter-key action", () => {
  it("dispatches action on Enter key", () => {
    const { container, onAction } = render({
      type: "field", name: "query", inputType: "text",
      action: { name: "search", context: { scope: "all" } },
    });
    const inp = container.querySelector<HTMLInputElement>("input[name=query]")!;
    inp.value = "laptop";
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "search", context: { scope: "all", query: "laptop" } });
  });

  it("does not dispatch on other keys", () => {
    const { container, onAction } = render({
      type: "field", name: "query", inputType: "text", action: { name: "search" },
    });
    container.querySelector<HTMLInputElement>("input[name=query]")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(onAction).not.toHaveBeenCalled();
  });
});

// ── modal node ────────────────────────────────────────────────────────────────

describe("BrowserAdapter — modal", () => {
  it("renders backdrop and modal with title and body content", () => {
    const { container } = render({
      type: "modal", title: "Confirm Delete",
      children: [{ type: "text", value: "Are you sure?" }],
      dismissAction: { name: "dismiss" },
    });
    expect(container.querySelector(".vms-modal-backdrop")).not.toBeNull();
    expect(container.querySelector(".vms-modal__title")!.textContent).toBe("Confirm Delete");
    expect(container.querySelector(".vms-modal__body .vms-text")!.textContent).toBe("Are you sure?");
  });

  it("close button dispatches dismissAction", () => {
    const { container, onAction } = render({
      type: "modal", title: "Alert", children: [],
      dismissAction: { name: "dismiss-modal", context: { reason: "close" } },
    });
    container.querySelector<HTMLButtonElement>(".vms-modal__close")!.click();
    expect(onAction).toHaveBeenCalledWith({ name: "dismiss-modal", context: { reason: "close" } });
  });

  it("no close button when dismissAction is omitted", () => {
    const { container } = render({ type: "modal", title: "Loading", children: [] });
    expect(container.querySelector(".vms-modal__close")).toBeNull();
  });

  it("modal has role=dialog and aria-modal", () => {
    const { container } = render({ type: "modal", children: [] });
    const modal = container.querySelector(".vms-modal")!;
    expect(modal.getAttribute("role")).toBe("dialog");
    expect(modal.getAttribute("aria-modal")).toBe("true");
  });
});

// ── table node ────────────────────────────────────────────────────────────────

describe("BrowserAdapter — table", () => {
  const tableVm: ViewNode = {
    type: "table",
    columns: [
      { key: "name", label: "Name", sortable: true },
      { key: "status", label: "Status" },
    ],
    rows: [
      { id: "1", cells: { name: "Alice", status: "open" } },
      { id: "2", cells: { name: "Bob", status: "closed" }, variant: "done" },
    ],
    sortColumn: "name",
    sortDirection: "asc",
    sortAction: { name: "sort-table" },
  };

  it("renders column headers", () => {
    const { container } = render(tableVm);
    const ths = container.querySelectorAll(".vms-table__th");
    expect(ths).toHaveLength(2);
    expect(ths[0].textContent).toBe("Name");
  });

  it("marks the sorted column with asc class", () => {
    const { container } = render(tableVm);
    const th = container.querySelector(".vms-table__th--sortable")!;
    expect(th.classList.contains("vms-table__th--asc")).toBe(true);
  });

  it("renders rows with correct cell content and data-id", () => {
    const { container } = render(tableVm);
    const rows = container.querySelectorAll(".vms-table__row");
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelectorAll(".vms-table__td")[0].textContent).toBe("Alice");
    expect((rows[0] as HTMLElement).dataset.id).toBe("1");
  });

  it("applies variant class to row", () => {
    const { container } = render(tableVm);
    expect(container.querySelector(".vms-table__row--done")).not.toBeNull();
  });

  it("clicking sorted-asc column dispatches desc", () => {
    const { container, onAction } = render(tableVm);
    container.querySelector<HTMLElement>(".vms-table__th--sortable")!.click();
    expect(onAction).toHaveBeenCalledWith({ name: "sort-table", context: { column: "name", direction: "desc" } });
  });

  it("clicking a different unsorted column dispatches asc", () => {
    const vm: ViewNode = {
      type: "table",
      columns: [{ key: "name", label: "Name", sortable: true }, { key: "status", label: "Status" }],
      rows: [],
      sortColumn: "status", sortDirection: "asc",
      sortAction: { name: "sort-table" },
    };
    const { container, onAction } = render(vm);
    container.querySelector<HTMLElement>(".vms-table__th--sortable")!.click();
    expect(onAction).toHaveBeenCalledWith({ name: "sort-table", context: { column: "name", direction: "asc" } });
  });

  it("row click dispatches row action", () => {
    const vm: ViewNode = {
      type: "table",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ id: "1", cells: { name: "Alice" }, action: { name: "select-row", context: { id: "1" } } }],
    };
    const { container, onAction } = render(vm);
    container.querySelector<HTMLElement>(".vms-table__row--clickable")!.click();
    expect(onAction).toHaveBeenCalledWith({ name: "select-row", context: { id: "1" } });
  });

  it("per-column filter input is populated with filterValue and dispatches on Enter", () => {
    const vm: ViewNode = {
      type: "table",
      columns: [
        { key: "name", label: "Name", filterable: true, filterValue: "al" },
        { key: "status", label: "Status" },
      ],
      rows: [],
      filterAction: { name: "filter-table" },
    };
    const { container, onAction } = render(vm);
    const inp = container.querySelector<HTMLInputElement>(".vms-table__filter-input")!;
    expect(inp.value).toBe("al");
    inp.value = "alice";
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(onAction).toHaveBeenCalledWith({
      name: "filter-table",
      context: { column: "name", value: "alice", filters: { name: "alice" } },
    });
  });

  it("link column renders anchor with href and label", () => {
    const vm: ViewNode = {
      type: "table",
      columns: [{ key: "log", label: "Log", linkLabel: "Download" }],
      rows: [{ cells: { log: "/jobs/output?path=abc" } }],
    };
    const { container } = render(vm);
    const a = container.querySelector<HTMLAnchorElement>(".vms-table__link")!;
    expect(a.href).toContain("/jobs/output?path=abc");
    expect(a.textContent).toBe("Download");
    expect(a.target).toBe("");
  });

  it("linkExternal opens in new tab with noopener", () => {
    const vm: ViewNode = {
      type: "table",
      columns: [{ key: "log", label: "Log", linkLabel: "Download", linkExternal: true }],
      rows: [{ cells: { log: "/jobs/output?path=abc" } }],
    };
    const { container } = render(vm);
    const a = container.querySelector<HTMLAnchorElement>(".vms-table__link")!;
    expect(a.target).toBe("_blank");
    expect(a.rel).toBe("noopener noreferrer");
  });

  it("empty cell value does not render anchor", () => {
    const vm: ViewNode = {
      type: "table",
      columns: [{ key: "log", label: "Log", linkLabel: "Download" }],
      rows: [{ cells: { log: "" } }],
    };
    const { container } = render(vm);
    expect(container.querySelector(".vms-table__link")).toBeNull();
  });

  it("non-filterable columns have no filter input", () => {
    const vm: ViewNode = {
      type: "table",
      columns: [
        { key: "name", label: "Name", filterable: true },
        { key: "status", label: "Status" },
      ],
      rows: [],
      filterAction: { name: "filter-table" },
    };
    const { container } = render(vm);
    expect(container.querySelectorAll(".vms-table__filter-input")).toHaveLength(1);
  });
});
