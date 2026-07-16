// Phase 21 (21-11) — the `searchAction` CADENCE: an ORDINARY, BLOCKING action
// fired on ENTER.
//
// 🚨 WHAT THIS FILE HOLDS, AND WHY IT LOOKS SO MUCH SMALLER THAN IT USED TO.
//
// This suite used to prove a live-query lane: a 300ms debounce, a renderer that
// FORCED `blocking: false`, and — in a companion file — four scripted
// adversarial interleavings, each mutation-proved. All of it is gone, because
// D4 and D11 were REVERSED after the operator drove the real control.
//
// `searchAction` is now byte-for-byte `TableNode.filterAction`'s cadence:
// keystrokes write the bind, ENTER dispatches, the action is whatever the app
// declared. The payoff is not tidiness — it is that a BLOCKING action is
// SERIALIZED BY THE EXISTING DISPATCH GUARD, so the entire stale-response race
// category the deleted suite worked so hard to verify is now STRUCTURALLY
// IMPOSSIBLE rather than merely mitigated. There is nothing left to interleave.
//
// ⇒ The lesson banked in the design doc, and the reason the deleted suite is
// worth remembering: it was NOT sloppy. It was rigorous inside the wrong frame.
// Before verifying a race exhaustively, ask whether the race should exist.
//
// 🚨 THE LOAD-BEARING TESTS ARE NOW THE INVERSE OF WHAT THEY WERE. They used to
// hold "the renderer FORCES blocking:false"; they now hold that the renderer
// NEVER TOUCHES `blocking` — in either polarity, or by absence. Non-blocking is
// ALWAYS the app's explicit opt-in (AGENTS.md); `blocking: false` is semantic
// (the response may be discarded, may arrive out of order, may coexist with
// another in flight) and an app that did not ask for it can be broken by it.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { ActionEvent, StateAccess, ViewNode } from "../src/index.js";
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
  const actions: ActionEvent[] = [];
  return {
    container,
    state,
    writes,
    actions,
    adapter,
    render: (vm: ViewNode) => adapter.render(vm, (a) => { actions.push(a); }, sa),
    input: () => container.querySelector<HTMLInputElement>("input.vms-field__input")!,
    popup: () => container.querySelector<HTMLElement>(".vms-field__popup")!,
    options: () => Array.from(container.querySelectorAll<HTMLElement>(".vms-field__option")),
  };
}

/** Type `value` into the input the way a user does: set the value, fire `input`. */
function type(inp: HTMLInputElement, value: string): void {
  inp.value = value;
  inp.dispatchEvent(new Event("input", { bubbles: true }));
}

function enter(inp: HTMLInputElement): void {
  inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
}

/**
 * 🚨 A REAL FIXTURE, NOT A MINIMAL ONE. `searchBind` is SET and the query slot is
 * seeded `""` in state, exactly as a real app sends — a lookup WITHOUT
 * `searchBind` cannot search, so a fixture omitting it tests a configuration
 * that cannot exist. (That omission is precisely what let this phase's headline
 * render test PASS while the feature was broken.)
 */
function lookupVm(over: Record<string, unknown> = {}): ViewNode {
  return {
    type: "field",
    name: "owner",
    label: "Owner",
    inputType: "lookup",
    bind: "ownerId",
    searchBind: "ownerQuery",
    searchAction: { name: "search-owner" },
    ...over,
  } as unknown as ViewNode;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 🚨 THE FRAMEWORK RULE — the renderer NEVER sets `blocking`
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 the renderer passes `blocking` through EXACTLY as the app declared it — it never sets it", () => {
  it("app declared NOTHING ⇒ `blocking` is ABSENT on the dispatched action (not false, not true)", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ searchAction: { name: "search-owner" } }));
    type(t.input(), "sa");
    enter(t.input());

    expect(t.actions).toHaveLength(1);
    // 🚨 The old renderer synthesized `blocking: false` here and the app could
    // not opt out. Absence is the app's declaration and must survive intact —
    // undefined classifies as BLOCKING, which is the safe, serialized lane.
    expect(t.actions[0].blocking).toBeUndefined();
    expect("blocking" in t.actions[0]).toBe(false);
  });

  it("app declared blocking:true ⇒ it stays TRUE (the framework does not 'upgrade' the lane)", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ searchAction: { name: "search-owner", blocking: true } }));
    type(t.input(), "sa");
    enter(t.input());

    expect(t.actions).toHaveLength(1);
    expect(t.actions[0].blocking).toBe(true);
  });

  it("app declared blocking:false ⇒ it stays FALSE (opt-in is honored, just never forced)", () => {
    // The other polarity. Non-blocking is the app's call to MAKE — the rule is
    // that the framework must not make it FOR them, not that it is forbidden.
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ searchAction: { name: "search-owner", blocking: false } }));
    type(t.input(), "sa");
    enter(t.input());

    expect(t.actions).toHaveLength(1);
    expect(t.actions[0].blocking).toBe(false);
  });

  it("carries the app's action NAME through unchanged", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ searchAction: { name: "search-owner" } }));
    type(t.input(), "sa");
    enter(t.input());
    expect(t.actions[0].name).toBe("search-owner");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enter dispatches; typing does not
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 ENTER dispatches the search — typing does NOT", () => {
  it("Enter fires searchAction exactly once", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm());
    type(t.input(), "sal");
    enter(t.input());

    expect(t.actions).toHaveLength(1);
    expect(t.actions[0].name).toBe("search-owner");
  });

  it("🚨 TYPING DISPATCHES NOTHING — no debounce, no timer, no round trip", () => {
    // The whole D4 reversal in one assertion. There is no timer to advance:
    // keystrokes write the bind and stop, exactly as the table filter's do.
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm());
    const inp = t.input();
    type(inp, "s");
    type(inp, "sa");
    type(inp, "sal");
    expect(t.actions).toHaveLength(0);
  });

  it("typing still writes searchBind IMMEDIATELY on every keystroke (the query is state)", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm());
    const inp = t.input();
    type(inp, "s");
    type(inp, "sa");
    expect(t.state.ownerQuery).toBe("sa");
    expect(t.actions).toHaveLength(0);
  });

  it("two Enters ⇒ two dispatches (each question is asked once, when asked)", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm());
    const inp = t.input();
    type(inp, "sa");
    enter(inp);
    type(inp, "sales");
    enter(inp);
    expect(t.actions).toHaveLength(2);
  });

  it("flushes the box to state at ENTER time, not merely on `input` (autofill/IME safety)", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm());
    const inp = t.input();
    type(inp, "sa");
    // Mutate the value WITHOUT an input event — an autofill/IME commit that
    // lands then submits. The dispatched state must be what the box SAYS.
    inp.value = "sales";
    enter(inp);

    expect(t.state.ownerQuery).toBe("sales");
    expect(t.actions).toHaveLength(1);
  });

  it("a lookup with NO searchAction never dispatches on Enter", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ searchAction: undefined }));
    const inp = t.input();
    type(inp, "sal");
    enter(inp);
    expect(t.actions).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OPEN-6 — the empty query is a legitimate query
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 OPEN-6 — an EMPTY query dispatches on Enter (no minChars gate, no truthiness gate)", () => {
  it("Enter on an emptied box fires searchAction", () => {
    const t = setup({ ownerQuery: "sal" });
    t.render(lookupVm());
    const inp = t.input();
    type(inp, "");
    enter(inp);

    // This is how an app serves a most-recently-used list (Salesforce's picker
    // `searchType` DEFAULTS to `Recent`). An `if (value)` gate here would void
    // the MRU decision silently.
    expect(t.actions).toHaveLength(1);
    expect(t.state.ownerQuery).toBe("");
  });

  it("Enter on a never-typed empty box fires searchAction (the cold MRU open)", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm());
    enter(t.input());
    expect(t.actions).toHaveLength(1);
    expect(t.state.ownerQuery).toBe("");
  });

  it("🚨 the empty query dispatches EVEN THOUGH the display falls back to the label", () => {
    // The two questions the old renderer fused into one `!= null` test. DISPLAY
    // keys on non-EMPTY (so the label shows); DISPATCH keys on non-NULL (so the
    // empty query still reaches the server). Both, at once, in one assertion —
    // this pair is what regressed.
    const t = setup({ ownerId: "u-1", ownerQuery: "" });
    t.render(lookupVm({ selected: [{ value: "u-1", label: "Sally Omer" }] }));
    expect(t.input().value).toBe("Sally Omer");   // display: the label wins

    enter(t.input());
    expect(t.actions).toHaveLength(1);            // dispatch: the empty query still goes
    expect(t.state.ownerQuery).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enter's precedence — the price of overloading one key
// ─────────────────────────────────────────────────────────────────────────────

describe("Enter's precedence among the acts a lookup can declare", () => {
  it("an ACTIVE OPTION wins over the search (§7 item 17 — Enter accepts it)", () => {
    const t = setup({ ownerQuery: "sa" });
    t.render(lookupVm({ candidates: [{ value: "u-1", label: "Sally" }] }));
    const inp = t.input();
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    enter(inp);

    expect(t.state.ownerId).toBe("u-1");
    expect(t.actions).toHaveLength(0);   // committing is local; no round trip
  });

  it("searchAction wins over the field's own `action` when both are declared", () => {
    // ⚠️ They now COMPETE for Enter — the cost of the D4 reversal, recorded in
    // the renderer. A lookup declaring both gets its searchAction.
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ action: { name: "submit-owner" } }));
    type(t.input(), "sal");
    enter(t.input());

    expect(t.actions).toHaveLength(1);
    expect(t.actions[0].name).toBe("search-owner");
  });

  it("`action` still fires on Enter when NO searchAction is declared", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ searchAction: undefined, action: { name: "submit-owner" } }));
    const inp = t.input();
    inp.value = "sal";
    enter(inp);

    expect(t.actions).toHaveLength(1);
    expect(t.actions[0].name).toBe("submit-owner");
    expect(t.actions[0].blocking).toBeUndefined();
  });

  it("⚠️ allowCustom + a typed value INVENTS rather than searching (the documented, flagged cost)", () => {
    // Ordering search first would starve invention forever: Enter would search,
    // the server would answer, and the next Enter would search the same string
    // again. The reverse only bites a field declaring BOTH, and only for
    // non-empty text — the empty (MRU) Enter below still searches.
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ allowCustom: true }));
    const inp = t.input();
    type(inp, "brand-new");
    enter(inp);

    expect(t.state.ownerId).toBe("brand-new");
    expect(t.actions).toHaveLength(0);
  });

  it("allowCustom + an EMPTY box still searches (the MRU path survives the precedence)", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ allowCustom: true }));
    enter(t.input());
    expect(t.actions).toHaveLength(1);
    expect(t.actions[0].name).toBe("search-owner");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 item 14 — the active option is cleared on every query change
// ─────────────────────────────────────────────────────────────────────────────

describe("§7 item 14 — the active option clears on query change", () => {
  it("typing drops aria-activedescendant", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally" }, { value: "2", label: "Sam" }] }));
    const inp = t.input();
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(inp.getAttribute("aria-activedescendant")).not.toBeNull();

    type(inp, "sa");
    expect(inp.getAttribute("aria-activedescendant")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🚨 POPUP-OPEN PRESERVATION — the search still causes a re-render
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 popup-open survives the re-render the search itself causes", () => {
  // Enter-to-search makes this ONE re-render per question instead of one every
  // ~300ms, but it does NOT make it go away: the answer still lands on a
  // rebuilt tree, and popup state is DOM-local.
  it("the answer to a search arrives with the popup OPEN (first search: no prior options)", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm());
    type(t.input(), "sa");
    enter(t.input());
    // The server answers.
    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally Omer" }] }));

    expect(t.popup().hidden).toBe(false);
    expect(t.input().getAttribute("aria-expanded")).toBe("true");
  });

  it("a popup left open is still open after a full re-render", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally" }] }));
    type(t.input(), "sa");
    expect(t.popup().hidden).toBe(false);

    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally Omer" }, { value: "2", label: "Sam" }] }));
    expect(t.popup().hidden).toBe(false);
    expect(t.input().getAttribute("aria-expanded")).toBe("true");
  });

  it("🚨 preserves OPEN but NOT ACTIVE — §7 item 14's NVDA failure must not be resurrected", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally" }, { value: "2", label: "Sam" }] }));
    const inp = t.input();
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(inp.getAttribute("aria-activedescendant")).not.toBeNull();

    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally" }, { value: "2", label: "Sam" }] }));
    expect(t.popup().hidden).toBe(false);                                  // open: preserved
    expect(t.input().getAttribute("aria-activedescendant")).toBeNull();    // active: NOT
    expect(t.options().every(o => o.getAttribute("aria-selected") === "false")).toBe(true);
  });

  it("a popup that was closed stays closed across a re-render", () => {
    const t = setup({ ownerQuery: "" });
    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally" }] }));
    expect(t.popup().hidden).toBe(true);
    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally" }] }));
    expect(t.popup().hidden).toBe(true);
    expect(t.input().getAttribute("aria-expanded")).toBe("false");
  });

  it("Escape after a preserved-open re-render CLOSES (it does not fall through to stage two and clear)", () => {
    // The sharp edge of preserving open in the DOM only: if the closure's `open`
    // flag disagreed with the popup's visibility, Escape would take stage TWO
    // (popup-already-closed) and CLEAR the user's selection — silent data loss
    // on a keypress that meant "get this out of my way".
    const t = setup({ ownerId: "1", ownerQuery: "" });
    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally" }], selected: [{ value: "1", label: "Sally" }] }));
    type(t.input(), "sa");
    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally" }], selected: [{ value: "1", label: "Sally" }] }));

    t.input().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(t.popup().hidden).toBe(true);
    expect(t.state.ownerId).toBe("1");   // NOT cleared
  });
});
