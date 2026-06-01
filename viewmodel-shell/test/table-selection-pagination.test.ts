// 0.12.0 (#16) — TableNode.selection + TableNode.pagination.
//
// Bulk row selection (checkbox column + select-all header + selected-row tint)
// and server-driven pagination (range label + prev/next controls), both as
// optional fields on the existing TableNode. Selection is server-truth: the
// adapter checks rows whose id ∈ selectedIds and dispatches { id, checked } /
// { all: true, checked }; pagination dispatches { page }. The server slices.
//
// BrowserAdapter coverage:
//   - leading checkbox column renders only when selection is set;
//   - per-row checkbox reflects selectedIds; toggling dispatches { id, checked };
//   - a selected row carries .vms-table__row--selected;
//   - the header select-all reflects all/some/none and dispatches { all, checked };
//   - a checkbox click does NOT also fire the row's click action (stopPropagation);
//   - a row without id renders a disabled checkbox (can't be addressed);
//   - pagination renders the "from–to of total" range + prev/next, disables the
//     edges, and dispatches the target { page };
//   - neither column appears when the fields are absent (no behavior change).

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

const baseRows = [
  { id: "1", cells: { name: "Apple", status: "active" } },
  { id: "2", cells: { name: "Banana", status: "done" } },
  { id: "3", cells: { name: "Cherry", status: "active" } },
];

const selectableTable = (selectedIds: string[], extra: Record<string, unknown> = {}): ViewNode =>
  ({
    type: "table",
    columns: [
      { key: "name", label: "Name" },
      { key: "status", label: "Status" },
    ],
    rows: baseRows,
    selection: { selectedIds },
    ...extra,
  }) as ViewNode;

// TableNode.selection — rendering invariants. Selection is purely client-side
// (0.15.0 removed the per-toggle dispatch "action" mode); the visible state
// is driven by selectedIds + DOM toggles. Bulk actions live in
// selection.buttons[] — see the dedicated describe block below.
describe("TableNode.selection rendering", () => {
  it("renders a leading checkbox column only when selection is set", () => {
    const withSel = freshContainer();
    new BrowserAdapter(withSel).render(selectableTable([]), () => {});
    // header select-all + one per data row
    expect(withSel.querySelectorAll("input.vms-table__select").length).toBe(4);
    expect(withSel.querySelector("input.vms-table__select--all")).not.toBeNull();

    const noSel = freshContainer();
    new BrowserAdapter(noSel).render(
      { type: "table", columns: [{ key: "name", label: "Name" }], rows: baseRows } as ViewNode,
      () => {},
    );
    expect(noSel.querySelectorAll("input.vms-table__select").length).toBe(0);
  });

  it("per-row checkbox reflects selectedIds and a selected row carries the modifier class", () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(selectableTable(["2"]), () => {});

    const rows = Array.from(container.querySelectorAll("tr.vms-table__row"));
    const row2 = rows.find((r) => (r as HTMLElement).dataset.id === "2")!;
    const row1 = rows.find((r) => (r as HTMLElement).dataset.id === "1")!;

    expect(row2.classList.contains("vms-table__row--selected")).toBe(true);
    expect(row1.classList.contains("vms-table__row--selected")).toBe(false);

    const box2 = row2.querySelector("input.vms-table__select") as HTMLInputElement;
    const box1 = row1.querySelector("input.vms-table__select") as HTMLInputElement;
    expect(box2.checked).toBe(true);
    expect(box1.checked).toBe(false);
  });

  it("a checkbox click does NOT trigger the row's click action (stopPropagation)", () => {
    const dispatched: ActionEvent[] = [];
    const container = freshContainer();
    // rows carry their own click action (open-detail) alongside selection.
    const rowsWithAction = baseRows.map((r) => ({ ...r, action: { name: "open", context: { id: r.id } } }));
    new BrowserAdapter(container).render(
      selectableTable([], { rows: rowsWithAction }),
      (a) => dispatched.push(a),
    );

    const row1 = Array.from(container.querySelectorAll("tr.vms-table__row")).find(
      (r) => (r as HTMLElement).dataset.id === "1",
    )!;
    const cell = row1.querySelector("td.vms-table__td--select") as HTMLElement;
    const box = cell.querySelector("input.vms-table__select") as HTMLInputElement;

    // Toggle the checkbox (change) then bubble a click through the cell. The
    // cell's stopPropagation prevents the row's "open" action from firing.
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(dispatched.some((d) => d.name === "open")).toBe(false);
  });

  it("header select-all is indeterminate when only some rows are selected", () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(selectableTable(["2"]), () => {});
    const all = container.querySelector("input.vms-table__select--all") as HTMLInputElement;
    expect(all.checked).toBe(false);
    expect(all.indeterminate).toBe(true);
  });

  it("a row without an id renders a disabled checkbox (can't be addressed)", () => {
    const container = freshContainer();
    const vm: ViewNode = {
      type: "table",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ cells: { name: "Orphan" } }], // no id
      selection: { selectedIds: [] },
    } as ViewNode;
    new BrowserAdapter(container).render(vm, () => {});
    const box = container.querySelector("tbody input.vms-table__select") as HTMLInputElement;
    expect(box.disabled).toBe(true);
  });
});

describe("0.12.0 (#16) — TableNode.pagination", () => {
  const paged = (page: number, totalRows: number): ViewNode =>
    ({
      type: "table",
      columns: [{ key: "name", label: "Name" }],
      rows: baseRows,
      pagination: { page, pageSize: 3, totalRows, action: { name: "go-page" } },
    }) as ViewNode;

  it("renders the from–to of total range", () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(paged(2, 7), () => {});
    const range = container.querySelector(".vms-table__pagination-range")!;
    // page 2, size 3, total 7 → rows 4–6 of 7
    expect(range.textContent).toBe("4–6 of 7");
  });

  it("disables Prev on the first page and Next on the last page", () => {
    const first = freshContainer();
    new BrowserAdapter(first).render(paged(1, 7), () => {});
    let btns = Array.from(first.querySelectorAll(".vms-table__pagination-btn")) as HTMLButtonElement[];
    expect(btns.find((b) => b.textContent!.includes("Prev"))!.disabled).toBe(true);
    expect(btns.find((b) => b.textContent!.includes("Next"))!.disabled).toBe(false);

    const last = freshContainer();
    new BrowserAdapter(last).render(paged(3, 7), () => {}); // 7 rows / size 3 → 3 pages
    btns = Array.from(last.querySelectorAll(".vms-table__pagination-btn")) as HTMLButtonElement[];
    expect(btns.find((b) => b.textContent!.includes("Prev"))!.disabled).toBe(false);
    expect(btns.find((b) => b.textContent!.includes("Next"))!.disabled).toBe(true);
  });

  it("clicking Next/Prev dispatches the target { page }", () => {
    const dispatched: ActionEvent[] = [];
    const container = freshContainer();
    new BrowserAdapter(container).render(paged(2, 7), (a) => dispatched.push(a));
    const btns = Array.from(container.querySelectorAll(".vms-table__pagination-btn")) as HTMLButtonElement[];

    btns.find((b) => b.textContent!.includes("Next"))!.click();
    btns.find((b) => b.textContent!.includes("Prev"))!.click();

    expect(dispatched.map((d) => [d.name, d.context])).toEqual([
      ["go-page", { page: 3 }],
      ["go-page", { page: 1 }],
    ]);
  });

  it("renders no pagination footer when the field is absent", () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      { type: "table", columns: [{ key: "name", label: "Name" }], rows: baseRows } as ViewNode,
      () => {},
    );
    expect(container.querySelector(".vms-table__pagination")).toBeNull();
  });
});

// 0.13.0 (#17) — local-mode selection + bulk-action buttons toolbar. selection.action
// becomes optional; when omitted the adapter toggles the DOM checkbox + the row
// class purely client-side (no dispatch, no dropped clicks under the dispatch
// guard). selection.buttons[] renders a toolbar above the table; each click
// harvests the currently-checked rows and dispatches with selectedIds in context.

const localTable = (extra: Record<string, unknown> = {}): ViewNode =>
  ({
    type: "table",
    columns: [
      { key: "name", label: "Name" },
      { key: "status", label: "Status" },
    ],
    rows: baseRows,
    // No `action` — local mode.
    selection: {
      selectedIds: [],
      buttons: [
        { type: "button", label: "Bulk Resolve",  action: { name: "bulk-resolve" }, variant: "primary"   },
        { type: "button", label: "Bulk Reopen",   action: { name: "bulk-reopen"  }, variant: "secondary" },
      ],
    },
    ...extra,
  }) as ViewNode;

describe("0.13.0 — TableNode.selection local mode (action omitted)", () => {
  it("toggling a row checkbox does NOT dispatch — pure DOM state", () => {
    const dispatched: ActionEvent[] = [];
    const container = freshContainer();
    new BrowserAdapter(container).render(localTable(), (a) => dispatched.push(a));

    const row = Array.from(container.querySelectorAll("tr.vms-table__row")).find(
      (r) => (r as HTMLElement).dataset.id === "2",
    )!;
    const box = row.querySelector("input.vms-table__select") as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));

    // No round trip — local mode means no per-toggle dispatch.
    expect(dispatched).toEqual([]);
    // DOM and row class reflect the toggle.
    expect(box.checked).toBe(true);
    expect(row.classList.contains("vms-table__row--selected")).toBe(true);
  });

  it("header select-all toggles every row checkbox + class without dispatching", () => {
    const dispatched: ActionEvent[] = [];
    const container = freshContainer();
    new BrowserAdapter(container).render(localTable(), (a) => dispatched.push(a));

    const all = container.querySelector("input.vms-table__select--all") as HTMLInputElement;
    all.checked = true;
    all.dispatchEvent(new Event("change", { bubbles: true }));

    expect(dispatched).toEqual([]);
    const rowBoxes = Array.from(
      container.querySelectorAll("tbody input.vms-table__select"),
    ) as HTMLInputElement[];
    expect(rowBoxes.every((b) => b.checked)).toBe(true);
    const rows = Array.from(container.querySelectorAll("tr.vms-table__row"));
    expect(rows.every((r) => r.classList.contains("vms-table__row--selected"))).toBe(true);
  });

  it("toggling a single row reconciles the header select-all to indeterminate", () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(localTable(), () => {});
    const all = container.querySelector("input.vms-table__select--all") as HTMLInputElement;

    const row2box = (Array.from(container.querySelectorAll("tr.vms-table__row")).find(
      (r) => (r as HTMLElement).dataset.id === "2",
    )!.querySelector("input.vms-table__select") as HTMLInputElement);
    row2box.checked = true;
    row2box.dispatchEvent(new Event("change", { bubbles: true }));

    expect(all.checked).toBe(false);
    expect(all.indeterminate).toBe(true);
  });
});

describe("0.13.0 — TableNode.selection.buttons[] bulk-action toolbar", () => {
  it("renders the toolbar above the table as the wrapper's first child", () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(localTable(), () => {});
    const wrapper = container.querySelector(".vms-table-wrapper")!;
    const first = wrapper.firstElementChild!;
    expect(first.classList.contains("vms-table__bulk-actions")).toBe(true);
    // Both buttons render.
    const labels = Array.from(first.querySelectorAll("button")).map((b) => b.textContent);
    expect(labels).toEqual(["Bulk Resolve", "Bulk Reopen"]);
  });

  it("clicking a bulk button harvests the checked row ids and dispatches with selectedIds in context", () => {
    const dispatched: ActionEvent[] = [];
    const container = freshContainer();
    new BrowserAdapter(container).render(localTable(), (a) => dispatched.push(a));

    // Check rows 1 and 3 (not 2).
    const rows = Array.from(container.querySelectorAll("tr.vms-table__row"));
    for (const id of ["1", "3"]) {
      const r = rows.find((row) => (row as HTMLElement).dataset.id === id)!;
      const b = r.querySelector("input.vms-table__select") as HTMLInputElement;
      b.checked = true;
      b.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // Now click Bulk Resolve.
    const resolveBtn = Array.from(container.querySelectorAll(".vms-table__bulk-actions button"))
      .find((b) => b.textContent === "Bulk Resolve") as HTMLButtonElement;
    resolveBtn.click();

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("bulk-resolve");
    expect(dispatched[0]!.context).toEqual({ selectedIds: ["1", "3"] });
  });

  it("clicking a bulk button on an empty selection dispatches with selectedIds: []", () => {
    const dispatched: ActionEvent[] = [];
    const container = freshContainer();
    new BrowserAdapter(container).render(localTable(), (a) => dispatched.push(a));

    const btn = Array.from(container.querySelectorAll(".vms-table__bulk-actions button"))
      .find((b) => b.textContent === "Bulk Reopen") as HTMLButtonElement;
    btn.click();

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.context).toEqual({ selectedIds: [] });
  });

  it("buttons[] honors selectedIds pre-selection in the harvest", () => {
    const dispatched: ActionEvent[] = [];
    const container = freshContainer();
    const vm: ViewNode = {
      type: "table",
      columns: [{ key: "name", label: "Name" }],
      rows: baseRows,
      selection: {
        selectedIds: ["1", "2"],
        buttons: [{ type: "button", label: "Process", action: { name: "process" } }],
      },
    } as ViewNode;
    new BrowserAdapter(container).render(vm, (a) => dispatched.push(a));

    // The two pre-selected rows render with checked boxes; clicking the button
    // harvests them without any user interaction.
    const btn = container.querySelector(".vms-table__bulk-actions button") as HTMLButtonElement;
    btn.click();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("process");
    expect(dispatched[0]!.context).toEqual({ selectedIds: ["1", "2"] });
  });
});
