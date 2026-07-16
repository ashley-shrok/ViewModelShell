// Phase 21 (LOOK-01) — the single-select `lookup` renderer: the display path,
// the popup, and the combobox ARIA (design §7 items 1-7).
//
// 🚨 THE FIRST TWO DESCRIBE BLOCKS ARE THE REASON THIS PHASE EXISTS. They are
// deliberately first in the file. If a future refactor "simplifies" the display
// path by resolving the label out of `candidates` — the instinct the select arm
// forty lines above actively encourages (`o.textContent = opt.label`) — it must
// fail HERE, loudly, rather than ship a picker that renders a raw database id on
// the one case that matters most.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { StateAccess, ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function setup(initial: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const adapter = new BrowserAdapter(container);
  const state = initial as Record<string, unknown>;
  const writes: Array<{ path: string; value: unknown }> = [];
  const sa: StateAccess = {
    read(path: string): unknown {
      return path.split(".").reduce<unknown>(
        (o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), state);
    },
    write(path: string, value: unknown): void {
      writes.push({ path, value });
      const keys = path.split(".");
      let o = state as Record<string, unknown>;
      for (let i = 0; i < keys.length - 1; i++) {
        if (o[keys[i]] == null || typeof o[keys[i]] !== "object") o[keys[i]] = {};
        o = o[keys[i]] as Record<string, unknown>;
      }
      o[keys[keys.length - 1]] = value;
    },
  };
  const actions: unknown[] = [];
  return {
    container,
    state,
    writes,
    actions,
    render: (vm: ViewNode) => adapter.render(vm, (a) => { actions.push(a); }, sa),
    input: () => container.querySelector<HTMLInputElement>("input.vms-field__input")!,
    popup: () => container.querySelector<HTMLElement>(".vms-field__popup")!,
    options: () => Array.from(container.querySelectorAll<HTMLElement>(".vms-field__option")),
    labels: () => Array.from(container.querySelectorAll<HTMLElement>(".vms-field__option"))
      .map(o => o.textContent),
  };
}

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

// ─────────────────────────────────────────────────────────────────────────────
// 🚨 THE HEADLINE PROOF
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 D1 THE HEADLINE PROOF — a preselected value renders its label with NO search having occurred", () => {
  // This is the case that kills naive designs, and the whole reason `selected`
  // and `candidates` are separate fields. A form loads with a reference already
  // set: `candidates` is ABSENT (nobody has searched), `selected` carries the
  // label. A picker that resolved its label from the candidate list renders
  // "u-1" (Ant Design) or nothing. Ours renders "Sally Omer".
  it("renders the label from `selected` when `candidates` is absent entirely", () => {
    const { render, input } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect(input().value).toBe("Sally Omer");
    expect(input().value).not.toBe("u-1");
    expect(input().value).not.toBe("");
  });

  it("the bound state still holds the ID and only the ID — the label never enters the bind", () => {
    const { render, state } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect((state.f as Record<string, unknown>).owner).toBe("u-1");
  });
});

describe("🚨 D1 THE ANTI-TRAP — the selected label survives a candidate list that EXCLUDES the selection", () => {
  // Mid-search: the user has typed something that narrows `candidates` so the
  // currently-selected item is NOT in the list. With an id-valued field,
  // "filter the candidate list" and "forget what's selected" are the SAME
  // OPERATION — which is exactly why the label must never come from there.
  // Zag's maintainer, on why no automatic fix is possible: "When you start
  // filtering, and the value isn't part of the filtered options, the selected
  // item isn't up to date."
  it("displays 'Sally Omer' even though `candidates` contains only Bob", () => {
    const { render, input } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      selected: [{ value: "u-1", label: "Sally Omer" }],
      candidates: [{ value: "u-2", label: "Bob" }],
    } as ViewNode);
    expect(input().value).toBe("Sally Omer");
  });

  it("an EMPTY candidate list does not erase the selected label", () => {
    const { render, input } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      selected: [{ value: "u-1", label: "Sally Omer" }],
      candidates: [],
    } as ViewNode);
    expect(input().value).toBe("Sally Omer");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D5 / D6 — the item shape
// ─────────────────────────────────────────────────────────────────────────────

describe("D5 — a `selected` entry with `label` omitted displays its VALUE", () => {
  it("renders the value as the display text (the free-form-tag case)", () => {
    const { render, input } = setup({ f: { tag: "urgent" } });
    render({
      type: "field", name: "tag", inputType: "lookup", bind: "f.tag",
      selected: [{ value: "urgent" }],
    } as ViewNode);
    expect(input().value).toBe("urgent");
  });
});

describe("D6 — a polymorphic `type` tag is exposed without leaking into the bound value", () => {
  it("exposes type on the control and leaves the bind holding the id alone", () => {
    const { render, input, writes } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      selected: [{ value: "u-1", label: "Sally Omer", type: "user" }],
    } as ViewNode);
    expect(input().dataset.vmsSelectedType).toBe("user");
    expect(input().value).toBe("Sally Omer");
    expect(writes).toEqual([]);
  });

  it("a monomorphic reference (type omitted) exposes no type tag", () => {
    const { render, input } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect(input().dataset.vmsSelectedType).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🚨 D12 — candidate order is the app's
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 D12 — the popup presents `candidates` AS GIVEN: no sort, no dedupe, no truncate", () => {
  // The fixture is DELIBERATELY NON-ALPHABETICAL — it is what a real consumer
  // sends: candidates ranked server-side by recency-weighted mention frequency.
  // A `toContain`-style assertion would pass on an alphabetized list and prove
  // NOTHING, so this asserts the FULL ORDERED ARRAY.
  const ranked: ViewNode = {
    type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
    candidates: [
      { value: "u-9", label: "Zoe Adams" },
      { value: "u-3", label: "Bob Lee" },
      { value: "u-7", label: "Al Ng" },
    ],
  } as ViewNode;

  it("renders the server's ranking in EXACTLY the order given (not alphabetized)", () => {
    const { render, labels } = setup({ f: { owner: "" } });
    render(ranked);
    expect(labels()).toEqual(["Zoe Adams", "Bob Lee", "Al Ng"]);
  });

  it("does not dedupe — duplicate candidate entries BOTH render", () => {
    const { render, labels, options } = setup({ f: { owner: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      candidates: [
        { value: "u-1", label: "Sally Omer" },
        { value: "u-1", label: "Sally Omer" },
      ],
    } as ViewNode);
    expect(labels()).toEqual(["Sally Omer", "Sally Omer"]);
    // ...and each still has a UNIQUE id, or aria-activedescendant would break.
    const ids = options().map(o => o.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("does not truncate — a long candidate list renders in full", () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ value: `u-${i}`, label: `User ${i}` }));
    const { render, options } = setup({ f: { owner: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner", candidates: many,
    } as ViewNode);
    expect(options().length).toBe(250);
  });

  it("a candidate with `label` omitted renders its value (D5, at the candidate level)", () => {
    const { render, labels } = setup({ f: { tag: "" } });
    render({
      type: "field", name: "tag", inputType: "lookup", bind: "f.tag",
      candidates: [{ value: "urgent" }, { value: "blocked", label: "Blocked" }],
    } as ViewNode);
    expect(labels()).toEqual(["urgent", "Blocked"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 items 1-7 — the combobox ARIA
// ─────────────────────────────────────────────────────────────────────────────

describe("§7 items 1-7 — combobox ARIA", () => {
  function renderLookup(extra: Record<string, unknown> = {}) {
    const h = setup({ f: { owner: "" } });
    h.render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner", label: "Owner",
      candidates: [{ value: "u-1", label: "Sally Omer" }, { value: "u-2", label: "Bob Lee" }],
      ...extra,
    } as ViewNode);
    return h;
  }

  it("item 1: role=combobox is on the <input> ITSELF, not a wrapper (ARIA 1.2)", () => {
    const { container, input } = renderLookup();
    expect(input().getAttribute("role")).toBe("combobox");
    expect(input().tagName).toBe("INPUT");
    // the deprecated ARIA 1.0 wrapper pattern must NOT be present
    expect(container.querySelector("div[role='combobox']")).toBeNull();
    expect(input().getAttribute("aria-owns")).toBeNull();
  });

  it("item 2: aria-expanded is ALWAYS present, even when the popup is closed", () => {
    const { input } = renderLookup();
    expect(input().getAttribute("aria-expanded")).toBe("false");
  });

  it("item 2: aria-controls points at the popup and stays valid while it is hidden", () => {
    const { input, popup } = renderLookup();
    expect(popup().hidden).toBe(true);
    expect(input().getAttribute("aria-controls")).toBe(popup().id);
    expect(popup().id).not.toBe("");
  });

  it("item 2: aria-autocomplete=list", () => {
    expect(renderLookup().input().getAttribute("aria-autocomplete")).toBe("list");
  });

  it("item 2: aria-activedescendant is ABSENT when no option is active", () => {
    expect(renderLookup().input().getAttribute("aria-activedescendant")).toBeNull();
  });

  it("item 2: the accessible name comes from <label for>", () => {
    const { container, input } = renderLookup();
    const lbl = container.querySelector("label.vms-field__label")!;
    expect(lbl.getAttribute("for")).toBe(input().id);
    expect(lbl.textContent).toBe("Owner");
  });

  it("🚨 item 3: aria-haspopup is NOT set (listbox is implicit for role=combobox)", () => {
    expect(renderLookup().input().getAttribute("aria-haspopup")).toBeNull();
  });

  it("item 4: the popup is role=listbox with its own accessible name", () => {
    const { popup } = renderLookup();
    expect(popup().getAttribute("role")).toBe("listbox");
    expect(popup().getAttribute("aria-label")).toBeTruthy();
  });

  it("item 4: options are role=option with unique, stable ids", () => {
    const { options } = renderLookup();
    expect(options().map(o => o.getAttribute("role"))).toEqual(["option", "option"]);
    const ids = options().map(o => o.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every(id => id !== "")).toBe(true);
  });

  it("🚨 item 7: options are NEVER <button>/<a> — an interactive descendant destroys the listbox a11y tree", () => {
    const { popup, options } = renderLookup();
    expect(options().every(o => o.tagName !== "BUTTON" && o.tagName !== "A")).toBe(true);
    expect(popup().querySelector("button")).toBeNull();
    expect(popup().querySelector("a")).toBeNull();
  });

  it("item 6: only the input is tabbable — the popup and its options are out of the tab sequence", () => {
    const { input, popup, options } = renderLookup();
    expect(input().tabIndex).toBe(0);
    expect(popup().getAttribute("tabindex")).toBeNull();
    expect(options().every(o => o.getAttribute("tabindex") === null)).toBe(true);
  });

  it("item 32: aria-selected is accurate on EVERY option (false when not highlighted)", () => {
    const { options } = renderLookup();
    expect(options().map(o => o.getAttribute("aria-selected"))).toEqual(["false", "false"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Staying in the decorateField chain / the no-seed-write rule
// ─────────────────────────────────────────────────────────────────────────────

describe("the lookup arm stays in the decorateField chain", () => {
  function renderLookup(extra: Record<string, unknown> = {}) {
    const h = setup({ f: { owner: "" } });
    h.render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner", label: "Owner", ...extra,
    } as ViewNode);
    return h;
  }

  it("the text input carries .vms-field__input (or every decoration silently no-ops)", () => {
    const { container } = renderLookup();
    expect(container.querySelector("input.vms-field__input")).not.toBeNull();
  });

  it("the text input has the stable id vms-{name} (focus+caret restore depends on it)", () => {
    expect(renderLookup().input().id).toBe("vms-owner");
  });

  it("error → .vms-field--error + aria-invalid + role=alert, all for free via decorateField", () => {
    const { container, input } = renderLookup({ error: "Owner is required" });
    expect(container.querySelector(".vms-field--error")).not.toBeNull();
    expect(input().getAttribute("aria-invalid")).toBe("true");
    const err = container.querySelector(".vms-field__error")!;
    expect(err.getAttribute("role")).toBe("alert");
    expect(input().getAttribute("aria-describedby")).toBe("vms-owner-error");
  });

  it("help → wired into aria-describedby for free", () => {
    const { input } = renderLookup({ help: "Who owns this ticket" });
    expect(input().getAttribute("aria-describedby")).toBe("vms-owner-help");
  });

  it("disabled → the native attribute + .vms-field--disabled for free", () => {
    const { container, input } = renderLookup({ disabled: true });
    expect(input().disabled).toBe(true);
    expect(container.querySelector(".vms-field--disabled")).not.toBeNull();
  });

  it("readonly → the native attribute for free", () => {
    expect(renderLookup({ readonly: true }).input().readOnly).toBe(true);
  });

  it("the wrapper carries .vms-field--lookup", () => {
    expect(renderLookup().container.querySelector(".vms-field--lookup")).not.toBeNull();
  });
});

describe("🚨 NO SEED-WRITE — a lookup has no auto-selected default", () => {
  // The select arm seeds state from the DOM because <select> AUTO-SELECTS its
  // first option. That rationale does not transfer: an empty lookup means
  // "nothing chosen", a legitimate absent. Seeding would INVENT a selection the
  // user never made.
  it("rendering a lookup with EMPTY state writes NOTHING to the bind", () => {
    const { render, writes } = setup({});
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      candidates: [{ value: "u-1", label: "Sally Omer" }, { value: "u-2", label: "Bob Lee" }],
    } as ViewNode);
    expect(writes).toEqual([]);
  });

  it("rendering a lookup WITH a selection writes nothing either", () => {
    const { render, writes } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      selected: [{ value: "u-1", label: "Sally Omer" }],
      candidates: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect(writes).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The query / searchBind display split
// ─────────────────────────────────────────────────────────────────────────────

describe("the input's value: the query when one is in state, else the selected label", () => {
  it("a query in state is what the user sees (they are typing)", () => {
    const { render, input } = setup({ f: { owner: "u-1", q: "sal" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner", searchBind: "f.q",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect(input().value).toBe("sal");
  });

  it("🚨 an EMPTY-STRING query is a REAL query, not an absent one — it does not fall back to the label", () => {
    // OPEN-6: an empty query is legitimate (it is how an app serves a
    // most-recently-used list). `undefined` (no query yet) and `""` (the user
    // cleared the box) are different facts and must not be conflated by a
    // truthiness check.
    const { render, input } = setup({ f: { owner: "u-1", q: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner", searchBind: "f.q",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect(input().value).toBe("");
  });

  it("no query slot yet (undefined) → the selected label shows", () => {
    const { render, input } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner", searchBind: "f.q",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect(input().value).toBe("Sally Omer");
  });

  it("typing writes the query to searchBind — UNCONDITIONALLY, including when cleared", () => {
    // 🚨 The empty-query path MUST reach state (and, once 21-04 lands, the
    // server): gating this on `if (value)` silently voids the MRU decision.
    const { render, input, writes } = setup({ f: { owner: "", q: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner", searchBind: "f.q",
    } as ViewNode);
    input().value = "sal";
    input().dispatchEvent(new Event("input"));
    expect(writes).toEqual([{ path: "f.q", value: "sal" }]);
    input().value = "";
    input().dispatchEvent(new Event("input"));
    expect(writes).toEqual([{ path: "f.q", value: "sal" }, { path: "f.q", value: "" }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The diagnostic
// ─────────────────────────────────────────────────────────────────────────────

describe("[vms:lookup-no-searchbind] — a searchAction with no searchBind is a silently dead typeahead", () => {
  it("warns once when searchAction is present but searchBind is not", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { render } = setup({ f: { owner: "" } });
    const node = {
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      searchAction: { name: "search-owners" },
    } as ViewNode;
    render(node);
    render(node);
    const hits = warn.mock.calls.filter(c => String(c[0]).includes("[vms:lookup-no-searchbind]"));
    expect(hits.length).toBe(1);
    expect(String(hits[0][0])).toContain("owner");
  });

  it("does not warn when searchBind is present", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { render } = setup({ f: { owner: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      searchBind: "f.q", searchAction: { name: "search-owners" },
    } as ViewNode);
    expect(warn.mock.calls.filter(c => String(c[0]).includes("[vms:lookup-no-searchbind]")).length).toBe(0);
  });

  it("does not warn for a lookup with no searchAction at all (a plain preselected reference)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { render } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect(warn.mock.calls.filter(c => String(c[0]).includes("[vms:lookup-no-searchbind]")).length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Commit (mouse) — the single-select path end to end
// ─────────────────────────────────────────────────────────────────────────────

describe("committing a candidate writes the ID and displays the LABEL", () => {
  it("clicking an option writes the id to the bind and shows its label", () => {
    const { render, input, options, state } = setup({ f: { owner: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      candidates: [{ value: "u-9", label: "Zoe Adams" }, { value: "u-3", label: "Bob Lee" }],
    } as ViewNode);
    options()[1].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect((state.f as Record<string, unknown>).owner).toBe("u-3");
    expect(input().value).toBe("Bob Lee");
  });

  it("committing a candidate whose label is omitted writes and displays the value", () => {
    const { render, input, options, state } = setup({ f: { tag: "" } });
    render({
      type: "field", name: "tag", inputType: "lookup", bind: "f.tag",
      candidates: [{ value: "urgent" }],
    } as ViewNode);
    options()[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect((state.f as Record<string, unknown>).tag).toBe("urgent");
    expect(input().value).toBe("urgent");
  });
});
