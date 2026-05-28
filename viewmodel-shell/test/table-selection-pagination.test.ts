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
    selection: { selectedIds, action: { name: "toggle-sel" } },
    ...extra,
  }) as ViewNode;

describe("0.12.0 (#16) — TableNode.selection", () => {
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

  it("toggling a row checkbox dispatches { id, checked }", () => {
    const dispatched: ActionEvent[] = [];
    const container = freshContainer();
    new BrowserAdapter(container).render(selectableTable([]), (a) => dispatched.push(a));

    const row3 = Array.from(container.querySelectorAll("tr.vms-table__row")).find(
      (r) => (r as HTMLElement).dataset.id === "3",
    )!;
    const box = row3.querySelector("input.vms-table__select") as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("toggle-sel");
    expect(dispatched[0]!.context).toEqual({ id: "3", checked: true });
  });

  it("a checkbox click does NOT also fire the row's click action", () => {
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

    // Toggle the checkbox (change) then bubble a click through the cell.
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Only the selection toggle — never the row's "open" action.
    expect(dispatched.map((d) => d.name)).toEqual(["toggle-sel"]);
    expect(dispatched.some((d) => d.name === "open")).toBe(false);
  });

  it("header select-all reflects all/some/none and dispatches { all, checked }", () => {
    const dispatched: ActionEvent[] = [];
    const container = freshContainer();
    // all three rows selected → header checked, not indeterminate.
    new BrowserAdapter(container).render(selectableTable(["1", "2", "3"]), (a) => dispatched.push(a));
    const all = container.querySelector("input.vms-table__select--all") as HTMLInputElement;
    expect(all.checked).toBe(true);
    expect(all.indeterminate).toBe(false);

    all.checked = false;
    all.dispatchEvent(new Event("change", { bubbles: true }));
    expect(dispatched[0]!.name).toBe("toggle-sel");
    expect(dispatched[0]!.context).toEqual({ all: true, checked: false });
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
      selection: { selectedIds: [], action: { name: "toggle-sel" } },
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
