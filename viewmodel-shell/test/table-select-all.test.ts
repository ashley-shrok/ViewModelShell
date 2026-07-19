// table-select-all.test.ts — jsdom render tests for the header "select all
// rendered rows" affordance.
//
// The header checkbox is a PURE CLIENT-SIDE toggle over the leading-column
// per-row CheckboxNodes: it writes the SAME per-row binds (no new wire field),
// so the server learns the selection through the path it already knows, and
// agents (which set binds directly) never need it. Scope is "all RENDERED
// rows" — over-cap / zero-match render no rows, so the control is not drawn
// and can never claim to select rows that aren't on screen. This re-adds only
// the DOM toggle, never the per-toggle dispatch that got the old
// TableNode.selection seam removed in 0.15.0.

import { describe, it, expect, afterEach } from "vitest";
import type { StateAccess, ViewNode } from "../src/index.js";
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

function tableWith(ids: string[]): ViewNode {
  return {
    type: "table",
    columns: [{ key: "name", label: "Name" }],
    rows: ids.map(id => ({
      id,
      cells: { name: "Row " + id },
      actions: [{ type: "checkbox" as const, name: "sel-" + id, bind: "selected." + id }],
    })),
  };
}

// no-checkbox table (baseline: leading select cell only appears with checkboxes)
const plainTable: ViewNode = {
  type: "table",
  columns: [{ key: "name", label: "Name" }],
  rows: [{ id: "1", cells: { name: "Apple" } }],
};

const headerBox = (c: HTMLElement) =>
  c.querySelector<HTMLInputElement>(".vms-table__th--select .vms-checkbox__input");

describe("header select-all", () => {
  it("renders a header checkbox when the table has row checkboxes", () => {
    const c = freshContainer();
    new BrowserAdapter(c).render(tableWith(["1", "2"]), () => {}, mkSA({}));
    expect(headerBox(c)).not.toBeNull();
  });

  it("does NOT render a header checkbox for a table with no row checkboxes", () => {
    const c = freshContainer();
    new BrowserAdapter(c).render(plainTable, () => {}, mkSA({}));
    // no leading select <th> at all, so no header box
    expect(headerBox(c)).toBeNull();
  });

  it("does NOT render a header checkbox when there are zero rendered rows (over-cap / zero-match)", () => {
    const c = freshContainer();
    // empty rows — the server renders rows:[] for the over-cap and zero-match paths
    new BrowserAdapter(c).render(tableWith([]), () => {}, mkSA({}));
    expect(headerBox(c)).toBeNull();
  });

  it("reflects tri-state: none=unchecked, some=indeterminate, all=checked", () => {
    const c = freshContainer();
    const adapter = new BrowserAdapter(c);

    adapter.render(tableWith(["1", "2"]), () => {}, mkSA({}));
    let box = headerBox(c)!;
    expect(box.checked).toBe(false);
    expect(box.indeterminate).toBe(false);

    adapter.render(tableWith(["1", "2"]), () => {}, mkSA({ selected: { "1": true } }));
    box = headerBox(c)!;
    expect(box.checked).toBe(false);
    expect(box.indeterminate).toBe(true);

    adapter.render(tableWith(["1", "2"]), () => {}, mkSA({ selected: { "1": true, "2": true } }));
    box = headerBox(c)!;
    expect(box.checked).toBe(true);
    expect(box.indeterminate).toBe(false);
  });

  it("toggling ON writes true to every rendered row's bind and checks each row input", () => {
    const c = freshContainer();
    const state: Record<string, unknown> = {};
    new BrowserAdapter(c).render(tableWith(["1", "2", "3"]), () => {}, mkSA(state));
    const box = headerBox(c)!;

    box.checked = true;
    box.dispatchEvent(new Event("change"));

    expect(state.selected).toEqual({ "1": true, "2": true, "3": true });
    for (const id of ["1", "2", "3"]) {
      const rowInp = c.querySelector<HTMLInputElement>("#vms-checkbox-sel-" + id)!;
      expect(rowInp.checked).toBe(true);
    }
    expect(box.indeterminate).toBe(false);
  });

  it("toggling OFF (all checked) writes false to every rendered row's bind", () => {
    const c = freshContainer();
    const state: Record<string, unknown> = { selected: { "1": true, "2": true } };
    new BrowserAdapter(c).render(tableWith(["1", "2"]), () => {}, mkSA(state));
    const box = headerBox(c)!;
    expect(box.checked).toBe(true);

    box.checked = false;
    box.dispatchEvent(new Event("change"));

    expect(state.selected).toEqual({ "1": false, "2": false });
    for (const id of ["1", "2"]) {
      const rowInp = c.querySelector<HTMLInputElement>("#vms-checkbox-sel-" + id)!;
      expect(rowInp.checked).toBe(false);
    }
  });

  it("does not dispatch any action (pure client toggle, no round-trip)", () => {
    const c = freshContainer();
    const dispatched: unknown[] = [];
    new BrowserAdapter(c).render(tableWith(["1", "2"]), a => dispatched.push(a), mkSA({}));
    const box = headerBox(c)!;
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    expect(dispatched).toEqual([]);
  });
});
