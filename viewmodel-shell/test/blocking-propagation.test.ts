// Phase 14 (Task 2) — every ActionEvent-bearing trigger in browser.ts now
// forwards the FULL action descriptor object instead of reconstructing a
// bare `{name: ...}` literal, so `blocking` (and any future ActionEvent
// field) survives the dispatch. This proves it end-to-end via real DOM
// events for CheckboxNode, ButtonNode, TabsNode, SectionNode.action, and
// TableRow.action — mirroring table-row-action.test.ts's harness.

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

function render(view: ViewNode, onAction: (a: ActionEvent) => void, state: Record<string, unknown> = {}) {
  const container = freshContainer();
  const adapter = new BrowserAdapter(container);
  adapter.render(view, onAction, mkSA(state));
  return container;
}

describe("Phase 14 — blocking:false propagates from every trigger node type", () => {
  it("CheckboxNode — change event dispatches the action with blocking:false intact", () => {
    const onAction = vi.fn();
    const container = render(
      { type: "checkbox", name: "opt-in", bind: "optIn", label: "Opt in", action: { name: "toggle-opt-in", blocking: false } },
      onAction,
      { optIn: false },
    );
    const inp = container.querySelector(".vms-checkbox__input") as HTMLInputElement;
    expect(inp).toBeTruthy();
    inp.checked = true;
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ name: "toggle-opt-in", blocking: false });
  });

  it("ButtonNode — click event dispatches the action with blocking:false intact", () => {
    const onAction = vi.fn();
    const container = render(
      { type: "button", label: "Refresh", action: { name: "refresh", blocking: false } },
      onAction,
    );
    const btn = container.querySelector(".vms-button") as HTMLButtonElement;
    expect(btn).toBeTruthy();
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ name: "refresh", blocking: false });
  });

  it("TabsNode — tab click dispatches the tab's action with blocking:false intact", () => {
    const onAction = vi.fn();
    const container = render(
      {
        type: "tabs",
        selected: "a",
        bind: "activeTab",
        tabs: [
          { value: "a", label: "A", action: { name: "select-tab-a", blocking: false } },
          { value: "b", label: "B", action: { name: "select-tab-b" } },
        ],
      },
      onAction,
      { activeTab: "a" },
    );
    const tabs = container.querySelectorAll(".vms-tabs__tab");
    expect(tabs.length).toBe(2);
    (tabs[0] as HTMLButtonElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "select-tab-a", blocking: false });
  });

  it("SectionNode.action — click-anywhere dispatches the action with blocking:false intact", () => {
    const onAction = vi.fn();
    const container = render(
      {
        type: "section",
        heading: "Live totals",
        action: { name: "recompute-totals", blocking: false },
        children: [{ type: "text", value: "some content" }],
      },
      onAction,
    );
    const section = container.querySelector(".vms-section") as HTMLElement;
    expect(section).toBeTruthy();
    section.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "recompute-totals", blocking: false });
  });

  it("TableRow.action — click-anywhere row dispatch carries blocking:false intact", () => {
    const onAction = vi.fn();
    const container = render(
      {
        type: "table",
        columns: [{ key: "title", label: "Title" }],
        rows: [
          {
            id: "r1",
            cells: { title: "Invoice #42" },
            action: { name: "select-row-1", blocking: false },
          },
        ],
      },
      onAction,
    );
    const tr = container.querySelector('tr[data-id="r1"]') as HTMLTableRowElement;
    expect(tr).toBeTruthy();
    const titleTd = tr.querySelector(
      ".vms-table__td:not(.vms-table__td--select):not(.vms-table__td--actions)",
    ) as HTMLTableCellElement;
    titleTd.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onAction).toHaveBeenCalledWith({ name: "select-row-1", blocking: false });
  });
});
