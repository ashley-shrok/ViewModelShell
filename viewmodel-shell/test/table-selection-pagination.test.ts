// Phase 6 — TableNode pagination under the new wire shape.
//
// TableSelection is removed (Plan 06-01). What remains, and is exercised
// here, is server-driven pagination: TablePagination drops `action`, gains
// `prevAction` + `nextAction` (each a unique action name); the renderer
// writes the target page number to TableNode.paginationBind before dispatch.
//
// Selection-as-a-framework-concept is gone — apps compose selectable rows
// out of bound CheckboxNode cells + plain bulk-action ButtonNodes; that
// pattern is covered in src/adapter.test.ts via the basic
// bind-read/bind-write tests.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { StateAccess, ViewNode, ActionEvent } from "../src/index.js";
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

function mkSA(state: Record<string, unknown>): StateAccess {
  return {
    read(path: string): unknown {
      const segs = path.split(".");
      let cur: unknown = state;
      for (const seg of segs) {
        if (cur == null || typeof cur !== "object") return undefined;
        cur = (cur as Record<string, unknown>)[seg];
      }
      return cur;
    },
    write(path: string, value: unknown): void {
      const segs = path.split(".");
      let cur: Record<string, unknown> = state;
      for (let i = 0; i < segs.length - 1; i++) {
        const seg = segs[i]!;
        if (typeof cur[seg] !== "object" || cur[seg] == null) cur[seg] = {};
        cur = cur[seg] as Record<string, unknown>;
      }
      cur[segs[segs.length - 1]!] = value;
    },
  };
}

const baseRows = [
  { id: "1", cells: { name: "Apple", status: "active" } },
  { id: "2", cells: { name: "Banana", status: "done" } },
  { id: "3", cells: { name: "Cherry", status: "active" } },
];

const paged = (page: number, totalRows: number): ViewNode => ({
  type: "table",
  columns: [{ key: "name", label: "Name" }],
  rows: baseRows.slice(0, 3),
  paginationBind: "page",
  pagination: {
    page,
    pageSize: 3,
    totalRows,
    prevAction: { name: "page-prev" },
    nextAction: { name: "page-next" },
  },
});

describe("Phase 6 — TableNode pagination", () => {
  it("renders the prev + next controls and the range label", () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(paged(2, 7), () => {}, mkSA({}));
    const labels = Array.from(container.querySelectorAll("button.vms-table__pagination-btn"))
      .map((b) => (b as HTMLButtonElement).textContent);
    expect(labels).toEqual(["‹ Prev", "Next ›"]);
    const range = container.querySelector(".vms-table__pagination-range");
    expect(range?.textContent).toBe("4–6 of 7");
  });

  it("disables Prev on the first page and Next on the last page", () => {
    const first = freshContainer();
    new BrowserAdapter(first).render(paged(1, 7), () => {}, mkSA({}));
    const firstBtns = first.querySelectorAll("button.vms-table__pagination-btn");
    expect((firstBtns[0]! as HTMLButtonElement).disabled).toBe(true);
    expect((firstBtns[1]! as HTMLButtonElement).disabled).toBe(false);

    const last = freshContainer();
    new BrowserAdapter(last).render(paged(3, 7), () => {}, mkSA({})); // 7 rows / size 3 → 3 pages
    const lastBtns = last.querySelectorAll("button.vms-table__pagination-btn");
    expect((lastBtns[0]! as HTMLButtonElement).disabled).toBe(false);
    expect((lastBtns[1]! as HTMLButtonElement).disabled).toBe(true);
  });

  it("clicking Next writes the target page to paginationBind then dispatches nextAction", () => {
    const dispatched: ActionEvent[] = [];
    const state: Record<string, unknown> = {};
    const container = freshContainer();
    new BrowserAdapter(container).render(paged(2, 7), (a) => dispatched.push(a), mkSA(state));
    const next = Array.from(container.querySelectorAll("button.vms-table__pagination-btn"))
      .find((b) => (b as HTMLButtonElement).textContent === "Next ›") as HTMLButtonElement;
    next.click();
    expect(state).toEqual({ page: 3 });
    expect(dispatched).toEqual([{ name: "page-next" }]);
  });

  it("clicking Prev writes the target page to paginationBind then dispatches prevAction", () => {
    const dispatched: ActionEvent[] = [];
    const state: Record<string, unknown> = {};
    const container = freshContainer();
    new BrowserAdapter(container).render(paged(2, 7), (a) => dispatched.push(a), mkSA(state));
    const prev = Array.from(container.querySelectorAll("button.vms-table__pagination-btn"))
      .find((b) => (b as HTMLButtonElement).textContent === "‹ Prev") as HTMLButtonElement;
    prev.click();
    expect(state).toEqual({ page: 1 });
    expect(dispatched).toEqual([{ name: "page-prev" }]);
  });

  it("no pagination → no pagination controls render", () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(
      { type: "table", columns: [{ key: "name", label: "Name" }], rows: baseRows } as ViewNode,
      () => {},
      mkSA({}),
    );
    expect(container.querySelector(".vms-table__pagination")).toBeNull();
  });
});

describe("Phase 6 — per-row buttons via TableRow.actions[]", () => {
  it("each row action renders as a ButtonNode and dispatches its unique action name", () => {
    const dispatched: ActionEvent[] = [];
    const container = freshContainer();
    new BrowserAdapter(container).render(
      {
        type: "table",
        columns: [{ key: "name", label: "Name" }],
        rows: [
          {
            id: "1",
            cells: { name: "Apple" },
            actions: [
              { type: "button", label: "Delete", action: { name: "delete-row-1" }, variant: "danger" },
            ],
          },
          {
            id: "2",
            cells: { name: "Banana" },
            actions: [
              { type: "button", label: "Delete", action: { name: "delete-row-2" }, variant: "danger" },
            ],
          },
        ],
      } as ViewNode,
      (a) => dispatched.push(a),
      mkSA({}),
    );
    const buttons = Array.from(container.querySelectorAll("button.vms-button")) as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);
    buttons[0]!.click();
    buttons[1]!.click();
    expect(dispatched).toEqual([{ name: "delete-row-1" }, { name: "delete-row-2" }]);
  });
});
