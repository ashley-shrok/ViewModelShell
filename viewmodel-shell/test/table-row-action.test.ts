// 260613-qmh — TableRow.action restored as the click-anywhere primitive +
// TableRow.actions[] now dispatches by entry.type so a CheckboxNode renders
// as a real <input type="checkbox"> (it was silently rendering as an empty
// button under the old ButtonNode-only renderer).

import { describe, it, expect, vi, afterEach } from "vitest";
import type { ActionEvent, StateAccess, ViewNode } from "../src/index.js";
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

// Tree used in most tests:
//   Row 1 — has row.action + actions[Checkbox, Button] + a linkLabel cell
//   Row 2 — no row.action (backward-compat baseline)
const treeMixed = (): ViewNode => ({
  type: "table",
  columns: [
    { key: "title", label: "Title" },
    { key: "status", label: "Status" },
    { key: "url", label: "Link", linkLabel: "Open" },
  ],
  rows: [
    {
      id: "r1",
      cells: { title: "Outlook crash", status: "Open", url: "/tickets/r1" },
      action: { name: "select-row-1" },
      actions: [
        { type: "checkbox", name: "select-r1", bind: "selected.r1" },
        { type: "button", label: "Close", action: { name: "close-r1" } },
      ],
    },
    {
      id: "r2",
      cells: { title: "Outlook hangs", status: "Closed", url: "/tickets/r2" },
    },
  ],
});

function render(view: ViewNode, onAction: (a: ActionEvent) => void) {
  const container = freshContainer();
  const adapter = new BrowserAdapter(container);
  adapter.render(view, onAction, mkSA({ selected: { r1: false } }));
  return container;
}

describe("TableRow.action — click-anywhere primitive (260613-qmh)", () => {
  it("A. clicking anywhere on a row dispatches row.action", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const tr = container.querySelector('tr[data-id="r1"]') as HTMLTableRowElement;
    expect(tr).toBeTruthy();
    // Click on a plain data cell (not the leading select cell, the link, or the
    // actions td). td[0] is now the --select cell (which stopPropagations), so
    // target the title cell — the first non-select data column.
    const titleTd = tr.querySelector(".vms-table__td:not(.vms-table__td--select):not(.vms-table__td--actions)") as HTMLTableCellElement;
    expect(titleTd.textContent).toBe("Outlook crash");
    titleTd.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ name: "select-row-1" });
  });

  it("B. pressing Enter while focused dispatches row.action", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const tr = container.querySelector('tr[data-id="r1"]') as HTMLTableRowElement;
    const ev = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    tr.dispatchEvent(ev);
    expect(onAction).toHaveBeenCalledWith({ name: "select-row-1" });
  });

  it("C. pressing Space dispatches row.action AND calls preventDefault", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const tr = container.querySelector('tr[data-id="r1"]') as HTMLTableRowElement;
    const ev = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    tr.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(onAction).toHaveBeenCalledWith({ name: "select-row-1" });
  });

  it("D. pressing Tab does NOT dispatch row.action", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const tr = container.querySelector('tr[data-id="r1"]') as HTMLTableRowElement;
    const ev = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    tr.dispatchEvent(ev);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("E. clicking a per-row ButtonNode in actions[] does NOT fire row.action", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const tr = container.querySelector('tr[data-id="r1"]') as HTMLTableRowElement;
    const button = tr.querySelector(".vms-table__td--actions button") as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // Only the button's action — never the row's
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ name: "close-r1" });
    expect(onAction).not.toHaveBeenCalledWith({ name: "select-row-1" });
  });

  it("F. clicking a per-row CheckboxNode in actions[] does NOT fire row.action", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const tr = container.querySelector('tr[data-id="r1"]') as HTMLTableRowElement;
    const checkbox = tr.querySelector(
      ".vms-table__td--select input[type='checkbox']",
    ) as HTMLInputElement;
    expect(checkbox).toBeTruthy();
    checkbox.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).not.toHaveBeenCalledWith({ name: "select-row-1" });
  });

  it("G. clicking a cell linkLabel <a> does NOT fire row.action", () => {
    const onAction = vi.fn();
    const container = render(treeMixed(), onAction);
    const tr = container.querySelector('tr[data-id="r1"]') as HTMLTableRowElement;
    const anchor = tr.querySelector("a.vms-table__link") as HTMLAnchorElement;
    expect(anchor).toBeTruthy();
    // jsdom's default click on an anchor tries to navigate; we just check propagation.
    const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
    // Prevent the navigation attempt so jsdom doesn't warn.
    anchor.addEventListener("click", (e) => e.preventDefault(), { once: true });
    anchor.dispatchEvent(ev);
    expect(onAction).not.toHaveBeenCalledWith({ name: "select-row-1" });
  });

  it("H. CheckboxNode renders in the leading select cell; ButtonNode in the trailing actions cell", () => {
    const container = render(treeMixed(), () => {});
    const tr = container.querySelector('tr[data-id="r1"]') as HTMLTableRowElement;
    // Checkbox lives in the leading --select cell (not the actions cell).
    const selectTd = tr.querySelector(".vms-table__td--select") as HTMLTableCellElement;
    expect(selectTd).toBeTruthy();
    expect(selectTd.querySelector("input[type='checkbox']")).not.toBeNull();
    // Button lives in the trailing --actions cell, which now holds no checkbox.
    const actionsTd = tr.querySelector(".vms-table__td--actions") as HTMLTableCellElement;
    expect(actionsTd).toBeTruthy();
    expect(actionsTd.querySelector("input[type='checkbox']")).toBeNull();
    const button = actionsTd.querySelector("button");
    expect(button).not.toBeNull();
    expect(button?.textContent).toBe("Close");
  });

  it("J. select cell is the FIRST <td> and actions cell is the LAST", () => {
    const container = render(treeMixed(), () => {});
    const tr = container.querySelector('tr[data-id="r1"]') as HTMLTableRowElement;
    const tds = Array.from(tr.querySelectorAll("td"));
    expect(tds[0]!.classList.contains("vms-table__td--select")).toBe(true);
    expect(tds[tds.length - 1]!.classList.contains("vms-table__td--actions")).toBe(true);
    // Header gets a matching leading --select <th> so columns stay aligned.
    const headerSelectTh = container.querySelector("thead tr th");
    expect(headerSelectTh!.classList.contains("vms-table__th--select")).toBe(true);
  });

  it("I. clickable rows expose role='button', tabindex=0, and a non-empty aria-label", () => {
    const container = render(treeMixed(), () => {});
    const tr = container.querySelector('tr[data-id="r1"]') as HTMLTableRowElement;
    expect(tr.getAttribute("role")).toBe("button");
    expect(tr.getAttribute("tabindex")).toBe("0");
    const aria = tr.getAttribute("aria-label") ?? "";
    expect(aria.length).toBeGreaterThan(0);
    // aria-label is derived from cell text values
    expect(aria).toContain("Outlook crash");
  });

  it("J. backward-compat — a row WITHOUT row.action has no --clickable class, tabindex, role, or aria-label", () => {
    const container = render(treeMixed(), () => {});
    const tr = container.querySelector('tr[data-id="r2"]') as HTMLTableRowElement;
    expect(tr.className).not.toContain("vms-table__row--clickable");
    expect(tr.getAttribute("tabindex")).toBeNull();
    expect(tr.getAttribute("role")).toBeNull();
    expect(tr.getAttribute("aria-label")).toBeNull();
  });

  // K. `state` is an APPEARANCE axis only — it must NEVER suppress clickability.
  // A `state:"disabled"` row that ALSO sets `action` stays fully clickable: it
  // keeps --clickable (which drives the pointer cursor + hover in CSS), keeps
  // role/tabindex, AND still dispatches. (Regression guard for the CSS override
  // that used to force cursor:default on disabled+clickable rows — an
  // already-paid-but-still-openable invoice line.)
  it("K. a state:'disabled' row WITH row.action stays clickable (dim is appearance-only)", () => {
    const onAction = vi.fn();
    const view: ViewNode = {
      type: "table",
      columns: [{ key: "line", label: "Line" }],
      rows: [
        {
          id: "paid1",
          cells: { line: "Invoice line — PAID" },
          state: "disabled",
          action: { name: "view-line-paid1" },
        },
      ],
    };
    const container = render(view, onAction);
    const tr = container.querySelector('tr[data-id="paid1"]') as HTMLTableRowElement;
    // Dimmed (appearance) AND clickable (behavior) at the same time.
    expect(tr.className).toContain("vms-table__row--disabled");
    expect(tr.className).toContain("vms-table__row--clickable");
    expect(tr.getAttribute("role")).toBe("button");
    expect(tr.getAttribute("tabindex")).toBe("0");
    // And it actually dispatches — the dim never disabled the action.
    tr.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "view-line-paid1" });
  });
});
