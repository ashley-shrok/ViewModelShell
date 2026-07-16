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
        jumpAction: { name: "page-jump" },
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

  it("throws: duplicate action name across FitsNode candidates (the fits blind spot)", () => {
    // FitsNode renders ONE candidate at runtime, but every candidate ships on
    // the wire. Two candidates sharing an action name is the same ambiguity the
    // validator rejects everywhere else — it must descend into fits children.
    const fits: ViewNode = {
      type: "fits",
      children: [button("save"), button("save")],
    };
    const tree = page(fits);
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'save'/);
  });

  it("throws: action inside a FitsNode collides with a top-level button", () => {
    const fits: ViewNode = { type: "fits", children: [button("delete")] };
    const tree = page(fits, button("delete"));
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'delete'/);
  });

  // ─── BreadcrumbNode / StepsNode (NAV-01..03) ──────────────────────────────
  // A crumb can navigate by DISPATCHING AN ACTION (not just an href). Those
  // action names must be uniqueness-checked or we reintroduce the
  // "silently-exempt dispatch-bearing descendant" bug the empty-state/fits arms
  // exist to prevent. StepsNode carries NO actions → action-free leaf.

  it("collects: a breadcrumb crumb action collides with a top-level button", () => {
    const crumbs: ViewNode = {
      type: "breadcrumb",
      items: [
        { label: "Home", action: { name: "go-home" } },
        { label: "Products", href: "/products" },
        { label: "Widget" /* current — no href/action */ },
      ],
    };
    // Proves the walk DESCENDS into crumb actions: `go-home` is recorded, so a
    // top-level button with the same name is caught as a duplicate.
    const tree = page(crumbs, button("go-home"));
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'go-home'/);
  });

  it("throws: two breadcrumb crumbs share an action name", () => {
    const crumbs: ViewNode = {
      type: "breadcrumb",
      items: [
        { label: "Home", action: { name: "nav-crumb" } },
        { label: "Section", action: { name: "nav-crumb" } },
        { label: "Page" },
      ],
    };
    const tree = page(crumbs);
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'nav-crumb'/);
  });

  it("passes: href-only breadcrumb crumbs record no actions", () => {
    const crumbs: ViewNode = {
      type: "breadcrumb",
      items: [
        { label: "Home", href: "/" },
        { label: "Docs", href: "/docs", external: true },
        { label: "Guide" },
      ],
    };
    const tree = page(crumbs);
    expect(() => validateActionNames(tree)).not.toThrow();
  });

  it("passes: StepsNode carries no actions (action-free leaf, does not throw)", () => {
    const steps: ViewNode = {
      type: "steps",
      current: 1,
      steps: [
        { label: "Cart" },
        { label: "Shipping", description: "Address + method" },
        { label: "Payment" },
      ],
    };
    // Two identical step labels + a same-named button must NOT collide — steps
    // record nothing into the action sink.
    const tree = page(steps, button("Cart"));
    expect(() => validateActionNames(tree)).not.toThrow();
  });

  // ─── Phase 21 (LOOK-01) — FieldNode.searchAction is a dispatch site ────────
  // The lookup's debounced search is a real round trip to a real handler, so its
  // name must name exactly one operation like every other dispatch site. A
  // walker that doesn't descend into `searchAction` fails SILENTLY: the tree
  // validates, then two different handlers answer to the same name at runtime.
  // These pin the descent so a missed walker fails the build instead of shipping.

  function lookup(overrides: Partial<FieldNode> = {}): FieldNode {
    return {
      type: "field",
      name: "owner",
      inputType: "lookup",
      bind: "fields.ownerId",
      searchBind: "fields.ownerQuery",
      ...overrides,
    };
  }

  it("throws: FieldNode searchAction collides with a top-level button (the walk descends)", () => {
    const tree = page(
      lookup({ searchAction: { name: "dupe" } }),
      button("dupe"),
    );
    expect(() => validateActionNames(tree)).toThrow(/Duplicate action name 'dupe'/);
  });

  it("throws: two lookups' searchActions collide with each other", () => {
    const tree = page(
      lookup({ name: "owner", searchAction: { name: "lookup-search" } }),
      lookup({ name: "assignee", searchAction: { name: "lookup-search" } }),
    );
    expect(() => validateActionNames(tree)).toThrow(
      /Duplicate action name 'lookup-search'/,
    );
  });

  it("records BOTH action and searchAction from one field (they are independent sites)", () => {
    // A lookup may legitimately carry both: Enter commits (`action`), typing
    // searches (`searchAction`). Each must reach the sink — proven by colliding
    // each, independently, with a same-named button elsewhere in the tree.
    const commitCollides = page(
      lookup({ action: { name: "owner-commit" }, searchAction: { name: "owner-search" } }),
      button("owner-commit"),
    );
    expect(() => validateActionNames(commitCollides)).toThrow(
      /Duplicate action name 'owner-commit'/,
    );

    const searchCollides = page(
      lookup({ action: { name: "owner-commit" }, searchAction: { name: "owner-search" } }),
      button("owner-search"),
    );
    expect(() => validateActionNames(searchCollides)).toThrow(
      /Duplicate action name 'owner-search'/,
    );
  });

  it("passes: a lookup carrying both action and searchAction with distinct names", () => {
    const tree = page(
      lookup({ action: { name: "owner-commit" }, searchAction: { name: "owner-search" } }),
    );
    expect(() => validateActionNames(tree)).not.toThrow();
  });

  it("passes: a lookup with NO searchAction records nothing and does not throw", () => {
    const tree = page(lookup(), button("unrelated"));
    expect(() => validateActionNames(tree)).not.toThrow();
  });
});
