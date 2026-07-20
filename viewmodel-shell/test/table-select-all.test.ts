// table-select-all.test.ts — jsdom render tests for the header "select all
// rendered rows" affordance.
//
// The header checkbox is a toggle over the leading-column per-row CheckboxNodes:
// it writes the SAME per-row binds (no new wire field), so the server learns the
// selection through the path it already knows, and agents (which set binds
// directly) never need it. Scope is "all RENDERED rows" — over-cap / zero-match
// render no rows, so the control is not drawn and can never claim to select rows
// that aren't on screen.
//
// When a per-row CheckboxNode carries an `action`, select-all also REPLAYS that
// dispatch for each rendered row — behaviorally identical to the user clicking
// each row by hand (Poppy/PBMInvoices 2026-07-20: a server-tracked SelectedMap
// went stale on select-all because only per-row toggles dispatched). A checkbox
// with NO action still dispatches nothing (the pure client-harvest model is
// untouched) — that backwards-compat guarantee is asserted below. This is NOT the
// removed 0.15.0 selection.action seam: it reuses CheckboxNode.action + the
// non-blocking coalescing loop and never forces a dispatch semantic.

import { describe, it, expect, afterEach } from "vitest";
import type { ActionEvent, StateAccess, ViewNode } from "../src/index.js";
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

// Checkboxes that carry a shared action (the live-server-side selection pattern:
// identity is in the bind/SelectedMap, the action is a uniform "recompute" ping).
function tableWithAction(ids: string[]): ViewNode {
  return {
    type: "table",
    columns: [{ key: "name", label: "Name" }],
    rows: ids.map(id => ({
      id,
      cells: { name: "Row " + id },
      actions: [{
        type: "checkbox" as const,
        name: "sel-" + id,
        bind: "selected." + id,
        action: { name: "toggle-selection" },
      }],
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

  it("does NOT dispatch when the row checkboxes carry no action (backwards-compat: pure client toggle)", () => {
    const c = freshContainer();
    const dispatched: unknown[] = [];
    new BrowserAdapter(c).render(tableWith(["1", "2"]), a => dispatched.push(a), mkSA({}));
    const box = headerBox(c)!;
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    expect(dispatched).toEqual([]);
  });

  it("DISPATCHES each row checkbox's action on select-all when they carry one (name only)", () => {
    const c = freshContainer();
    const state: Record<string, unknown> = {};
    const dispatched: ActionEvent[] = [];
    new BrowserAdapter(c).render(
      tableWithAction(["1", "2", "3"]),
      a => dispatched.push(a),
      mkSA(state),
    );
    const box = headerBox(c)!;

    box.checked = true;
    box.dispatchEvent(new Event("change"));

    // binds still written for every rendered row...
    expect(state.selected).toEqual({ "1": true, "2": true, "3": true });
    // ...AND the checkbox's own action replays once per rendered row (N toggles at
    // once — the app's non-blocking coalescing collapses these server-side).
    expect(dispatched).toHaveLength(3);
    for (const a of dispatched) {
      expect(a).toEqual({ name: "toggle-selection" });
      expect(Object.keys(a)).toEqual(["name"]); // no context payload
    }
  });

  it("binds are all written BEFORE any action dispatches (state is complete when the server sees it)", () => {
    const c = freshContainer();
    const state: Record<string, unknown> = {};
    const seen: Array<Record<string, unknown>> = [];
    new BrowserAdapter(c).render(
      tableWithAction(["1", "2"]),
      () => { seen.push({ ...(state.selected as Record<string, unknown>) }); },
      mkSA(state),
    );
    const box = headerBox(c)!;
    box.checked = true;
    box.dispatchEvent(new Event("change"));
    // every dispatch observed the FULL selection, not a partially-written map
    for (const snap of seen) expect(snap).toEqual({ "1": true, "2": true });
  });

  it("toggling OFF with an action dispatches too (unchecking is a toggle like any other)", () => {
    const c = freshContainer();
    const state: Record<string, unknown> = { selected: { "1": true, "2": true } };
    const dispatched: ActionEvent[] = [];
    new BrowserAdapter(c).render(
      tableWithAction(["1", "2"]),
      a => dispatched.push(a),
      mkSA(state),
    );
    const box = headerBox(c)!;
    expect(box.checked).toBe(true);

    box.checked = false;
    box.dispatchEvent(new Event("change"));

    expect(state.selected).toEqual({ "1": false, "2": false });
    expect(dispatched).toHaveLength(2);
    expect(dispatched.every(a => a.name === "toggle-selection")).toBe(true);
  });
});
