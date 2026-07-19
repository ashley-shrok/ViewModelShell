// table-bulk-harvest.test.ts — jsdom tests for TableNode.selection, the
// visible-scoped bulk-action toolbar.
//
// Each bulk button, on click, harvests the currently-CHECKED, currently-RENDERED
// row ids (from the leading-column per-row checkboxes) and writes that string[]
// to selection.harvestBind — OVERWRITING — before dispatching name-only. So a
// bulk action can only ever touch rows the user can currently see: a row that is
// selected and then filtered/paginated out of view (still truthy in the app's
// own selectedIds map, but NOT rendered) is not harvested. This is the fix for
// the accumulator footgun (a bulk handler reading every truthy key of a
// round-tripped selectedIds map acts on invisible rows).

import { describe, it, expect, afterEach } from "vitest";
import type { StateAccess, ViewNode, ActionEvent } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

afterEach(() => { document.body.innerHTML = ""; });

function mkSA(state: Record<string, unknown>): StateAccess {
  return {
    read(path: string): unknown {
      let cur: unknown = state;
      for (const seg of path.split(".")) {
        if (cur == null || typeof cur !== "object") return undefined;
        cur = (cur as Record<string, unknown>)[seg];
      }
      return cur;
    },
    write(path: string, value: unknown): void {
      const segs = path.split(".");
      let cur: Record<string, unknown> = state;
      for (let i = 0; i < segs.length - 1; i++) {
        const s = segs[i]!;
        if (typeof cur[s] !== "object" || cur[s] == null) cur[s] = {};
        cur = cur[s] as Record<string, unknown>;
      }
      cur[segs[segs.length - 1]!] = value;
    },
  };
}

// A table whose rendered rows are exactly `ids`, each with a leading checkbox
// bound to selected.{id}, plus a bulk toolbar writing to harvestBind "bulk".
function tableWith(ids: string[]): ViewNode {
  return {
    type: "table",
    columns: [{ key: "name", label: "Name" }],
    rows: ids.map(id => ({
      id,
      cells: { name: "Row " + id },
      actions: [{ type: "checkbox" as const, name: "sel-" + id, bind: "selected." + id }],
    })),
    selection: {
      harvestBind: "bulk",
      buttons: [{ type: "button" as const, label: "Act", action: { name: "bulk-act" } }],
    },
  };
}

const bulkButton = (c: HTMLElement) =>
  c.querySelector<HTMLButtonElement>(".vms-table__bulk-actions button")!;

describe("TableNode.selection — visible-scoped bulk harvest", () => {
  it("renders a bulk toolbar above the table when selection is set", () => {
    const c = freshContainer();
    new BrowserAdapter(c).render(tableWith(["1", "2"]), () => {}, mkSA({}));
    const toolbar = c.querySelector(".vms-table__bulk-actions");
    const table = c.querySelector("table");
    expect(toolbar).not.toBeNull();
    // toolbar precedes the table in the DOM
    expect(toolbar!.compareDocumentPosition(table!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does NOT render a toolbar when selection is absent", () => {
    const c = freshContainer();
    const noSel: ViewNode = {
      type: "table",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ id: "1", cells: { name: "A" }, actions: [{ type: "checkbox", name: "s1", bind: "selected.1" }] }],
    };
    new BrowserAdapter(c).render(noSel, () => {}, mkSA({}));
    expect(c.querySelector(".vms-table__bulk-actions")).toBeNull();
  });

  it("harvests ONLY the visible-checked rows and dispatches name-only", () => {
    const c = freshContainer();
    const state: Record<string, unknown> = { selected: { "1": true, "3": true } };
    const dispatched: ActionEvent[] = [];
    new BrowserAdapter(c).render(tableWith(["1", "2", "3"]), a => dispatched.push(a), mkSA(state));

    bulkButton(c).click();

    expect(state.bulk).toEqual(["1", "3"]);           // only the checked, rendered rows
    expect(dispatched).toEqual([{ name: "bulk-act" }]); // name-only wire
  });

  it("does NOT harvest a checked id whose row is not rendered (filtered out)", () => {
    const c = freshContainer();
    // "99" is truthy in the app's own map but its row is NOT in the table
    // (simulating a row selected under a prior filter, now off-screen).
    const state: Record<string, unknown> = { selected: { "1": true, "99": true } };
    new BrowserAdapter(c).render(tableWith(["1", "2"]), () => {}, mkSA(state));

    bulkButton(c).click();

    expect(state.bulk).toEqual(["1"]); // 99 is invisible → not acted on
  });

  it("OVERWRITES harvestBind (never accumulates)", () => {
    const c = freshContainer();
    const state: Record<string, unknown> = { bulk: ["1", "2", "3", "4"], selected: { "2": true } };
    new BrowserAdapter(c).render(tableWith(["1", "2"]), () => {}, mkSA(state));

    bulkButton(c).click();

    expect(state.bulk).toEqual(["2"]); // stale ["1".."4"] replaced by the current visible set
  });

  it("header select-all → bulk harvests every rendered row", () => {
    const c = freshContainer();
    const state: Record<string, unknown> = {};
    new BrowserAdapter(c).render(tableWith(["1", "2", "3"]), () => {}, mkSA(state));

    // click the header select-all (pure DOM toggle — checks all rendered rows)
    const header = c.querySelector<HTMLInputElement>(".vms-table__th--select .vms-checkbox__input")!;
    header.checked = true;
    header.dispatchEvent(new Event("change"));

    bulkButton(c).click();

    expect(state.bulk).toEqual(["1", "2", "3"]);
  });
});
