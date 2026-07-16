// 3.3.0 — renderer correctness + a11y fixes (core audit B4/B5/B1).
//
// Direct BrowserAdapter render assertions for:
//   - ProgressNode: value clamped to 0–100 + role/aria-valuenow (B5)
//   - Unknown node type: renders nothing but warns loudly, not silently (B4)
//   - Stable ids on table filter input / tabs / standalone checkbox so the
//     existing focus+caret restore can re-find them across a re-render (B1)

import { describe, it, expect, vi, afterEach } from "vitest";
import type { ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function render(node: ViewNode): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  new BrowserAdapter(container).render({ type: "page", children: [node] }, () => {});
  return container;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("ProgressNode — clamp + ARIA (B5)", () => {
  it("renders role=progressbar with aria value attributes", () => {
    const c = render({ type: "progress", value: 42 });
    const track = c.querySelector(".vms-progress")!;
    expect(track.getAttribute("role")).toBe("progressbar");
    expect(track.getAttribute("aria-valuemin")).toBe("0");
    expect(track.getAttribute("aria-valuemax")).toBe("100");
    expect(track.getAttribute("aria-valuenow")).toBe("42");
    expect((c.querySelector(".vms-progress__bar") as HTMLElement).style.width).toBe("42%");
  });

  it("clamps an over-range value to 100 (no overflow)", () => {
    const c = render({ type: "progress", value: 140 });
    expect((c.querySelector(".vms-progress__bar") as HTMLElement).style.width).toBe("100%");
    expect(c.querySelector(".vms-progress")!.getAttribute("aria-valuenow")).toBe("100");
  });

  it("clamps a negative value to 0 (no negative-width bar)", () => {
    const c = render({ type: "progress", value: -10 });
    expect((c.querySelector(".vms-progress__bar") as HTMLElement).style.width).toBe("0%");
    expect(c.querySelector(".vms-progress")!.getAttribute("aria-valuenow")).toBe("0");
  });
});

describe("Unknown node type — fail loud, not silent (B4)", () => {
  it("warns and renders nothing for the unknown node, but keeps rendering siblings", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const c = render({
      type: "page",
      children: [
        { type: "text", value: "before" },
        { type: "future-node-from-a-newer-server" } as unknown as ViewNode,
        { type: "text", value: "after" },
      ],
    } as unknown as ViewNode);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/Unknown node type/);
    expect(warn.mock.calls[0][0]).toMatch(/future-node-from-a-newer-server/);
    // Siblings still render — forward-compatible degradation, not a blank page.
    expect(c.textContent).toContain("before");
    expect(c.textContent).toContain("after");
  });
});

describe("Stable ids for focus restore (B1)", () => {
  it("table filter input carries a stable id keyed on the column", () => {
    const c = render({
      type: "table",
      columns: [{ key: "title", label: "Title", filterable: true }],
      rows: [{ cells: { title: "Alpha" } }],
      filterBinds: { title: "filters.title" },
      filterAction: { name: "apply-filters" },
    });
    expect(c.querySelector("#vms-tablefilter-title")).not.toBeNull();
    expect((c.querySelector("#vms-tablefilter-title") as HTMLInputElement).className)
      .toContain("vms-table__filter-input");
  });

  it("tabs buttons carry stable per-tab ids", () => {
    const c = render({
      type: "tabs",
      bind: "tab",
      selected: "all",
      tabs: [
        { label: "All", value: "all", action: { name: "set-tab" } },
        { label: "Open", value: "open", action: { name: "set-tab" } },
      ],
    });
    expect(c.querySelector("#vms-tab-tab-all")).not.toBeNull();
    expect(c.querySelector("#vms-tab-tab-open")).not.toBeNull();
  });

  it("standalone checkbox carries a stable id distinct from field ids", () => {
    const c = render({ type: "checkbox", name: "agree", bind: "agree", label: "I agree" });
    const cb = c.querySelector("#vms-checkbox-agree") as HTMLInputElement;
    expect(cb).not.toBeNull();
    expect(cb.type).toBe("checkbox");
  });
});
