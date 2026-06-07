// Phase 06 Plan 02 / WIRE-05 — validateActionNames tree walker.
//
// Pure-TS test (no jsdom; no shell): the validator imports cleanly from the
// /server subpath and walks plain ViewNode object literals. We build minimal
// trees per case to keep the intent visible.

import { describe, it, expect } from "vitest";
import { validateActionNames } from "./server.js";
import type {
  ButtonNode,
  CheckboxNode,
  FieldNode,
  FormNode,
  ModalNode,
  PageNode,
  TableNode,
  TabsNode,
  ViewNode,
} from "./index.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function button(name: string, label = name): ButtonNode {
  return { type: "button", label, action: { name } };
}

function page(...children: ViewNode[]): PageNode {
  return { type: "page", children };
}

function form(submitName: string | null, ...children: ViewNode[]): FormNode {
  const f: FormNode = {
    type: "form",
    children,
    ...(submitName != null ? { submitAction: { name: submitName } } : {}),
  };
  return f;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("validateActionNames", () => {
  it("passes: unique action names across distinct buttons", () => {
    const tree = page(button("add"), button("clear"));
    expect(() => validateActionNames(tree)).not.toThrow();
  });

  it("passes: same action name, same form (canonical valid duplicate — top + bottom Save)", () => {
    const saveTop: ButtonNode = {
      type: "button",
      label: "Save top",
      action: { name: "save-ticket-42" },
    };
    const saveBottom: ButtonNode = {
      type: "button",
      label: "Save bottom",
      action: { name: "save-ticket-42" },
    };
    // Both buttons live inside the SAME form (placed in its children so the
    // walker discovers them while the form is the enclosing scope).
    const f = form(null, saveTop, saveBottom);
    const tree = page(f);
    expect(() => validateActionNames(tree)).not.toThrow();
  });

  it("throws: same action name across different forms", () => {
    const fA = form("submit");
    const fB = form("submit");
    const tree = page(fA, fB);
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'submit'/);
  });

  it("throws: same action name between a top-level button and a form-internal button", () => {
    const topLevel: ButtonNode = button("delete");
    const internal: ButtonNode = button("delete");
    const f = form(null, internal);
    const tree = page(topLevel, f);
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'delete'/);
  });

  it("passes: per-tab unique action names", () => {
    const tabs: TabsNode = {
      type: "tabs",
      selected: "a",
      bind: "filter",
      tabs: [
        { value: "a", label: "A", action: { name: "select-tab-a" } },
        { value: "b", label: "B", action: { name: "select-tab-b" } },
        { value: "c", label: "C", action: { name: "select-tab-c" } },
      ],
    };
    const tree = page(tabs);
    expect(() => validateActionNames(tree)).not.toThrow();
  });

  it("throws: TabsNode with duplicated tab action names", () => {
    const tabs: TabsNode = {
      type: "tabs",
      selected: "a",
      bind: "filter",
      tabs: [
        { value: "a", label: "A", action: { name: "select-tab" } },
        { value: "b", label: "B", action: { name: "select-tab" } },
      ],
    };
    const tree = page(tabs);
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'select-tab'/);
  });

  it("passes: per-row actions on a TableNode use unique action names", () => {
    const table: TableNode = {
      type: "table",
      columns: [{ key: "title", label: "Title" }],
      rows: [
        {
          id: "1",
          cells: { title: "Row 1" },
          actions: [{ type: "button", label: "Delete", action: { name: "delete-row-1" } }],
        },
        {
          id: "2",
          cells: { title: "Row 2" },
          actions: [{ type: "button", label: "Delete", action: { name: "delete-row-2" } }],
        },
      ],
    };
    const tree = page(table);
    expect(() => validateActionNames(tree)).not.toThrow();
  });

  it("throws: per-row actions duplicate (the canonical missing-row-id bug)", () => {
    const table: TableNode = {
      type: "table",
      columns: [{ key: "title", label: "Title" }],
      rows: [
        {
          id: "1",
          cells: { title: "Row 1" },
          actions: [{ type: "button", label: "Delete", action: { name: "delete-row" } }],
        },
        {
          id: "2",
          cells: { title: "Row 2" },
          actions: [{ type: "button", label: "Delete", action: { name: "delete-row" } }],
        },
      ],
    };
    const tree = page(table);
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'delete-row'/);
  });

  it("passes: TableNode sortActions, pagination prev/next, filterAction all uniquely named", () => {
    const table: TableNode = {
      type: "table",
      columns: [
        { key: "title", label: "Title", sortable: true },
        { key: "date", label: "Date", sortable: true },
      ],
      rows: [],
      sortBind: "sort",
      sortActions: {
        title: { name: "sort-by-title" },
        date: { name: "sort-by-date" },
      },
      filterAction: { name: "apply-filter" },
      paginationBind: "page",
      pagination: {
        page: 1,
        pageSize: 20,
        totalRows: 100,
        prevAction: { name: "page-prev" },
        nextAction: { name: "page-next" },
      },
    };
    const tree = page(table);
    expect(() => validateActionNames(tree)).not.toThrow();
  });

  it("throws: two top-level buttons (no enclosing form) share an action name", () => {
    // The strict-outside-form heuristic exists exactly to catch this — the
    // most common bug is per-row buttons that forgot to encode the row ID in
    // the action name. A looser heuristic would let it slip past.
    const tree = page(button("delete"), button("delete"));
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'delete'/);
  });

  // ─── Bonus coverage (FieldNode / CheckboxNode / ModalNode dismissAction) ──
  // Not in the plan's enumerated 10 cases, but trivially follows from the
  // implementation and worth pinning so a future renderer change doesn't
  // silently drop one of these dispatch sites from the walk.

  it("throws: FieldNode action collides with a top-level button", () => {
    const f: FieldNode = {
      type: "field",
      name: "title",
      inputType: "text",
      bind: "fields.title",
      action: { name: "commit" },
    };
    const tree = page(f, button("commit"));
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'commit'/);
  });

  it("throws: CheckboxNode action collides with a top-level button", () => {
    const cb: CheckboxNode = {
      type: "checkbox",
      name: "accept",
      bind: "fields.accept",
      action: { name: "toggle" },
    };
    const tree = page(cb, button("toggle"));
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'toggle'/);
  });

  it("throws: ModalNode dismissAction collides with a top-level button", () => {
    const modal: ModalNode = {
      type: "modal",
      children: [],
      dismissAction: { name: "close" },
    };
    const tree = page(modal, button("close"));
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'close'/);
  });
});
