// Phase 21 (LOOK-02) — the live-query CADENCE: the debounced, renderer-FORCED
// non-blocking `searchAction` dispatch.
//
// 🚨 WHAT THIS FILE IS AND IS NOT. This suite proves the CADENCE — debounce,
// forcing, the empty query, flush-at-fire-time. It is NOT a race suite. The
// four adversarial interleavings (user-action-races-background,
// background-resolves-first, rapid-fire-supersede, stale-arrives-late) are
// Plan 21-05's, and they must SCRIPT the arrival order through a deferred
// fetch. A green cadence suite proves NOTHING about the interleaving; do not
// let its greenness stand in for 21-05's.
//
// 🚨 THE LOAD-BEARING TESTS ARE "the renderer FORCES blocking:false". `blocking:
// false` on the ActionEvent is the ENTIRE opt-in to the v4.2 non-blocking lane
// (index.ts dispatch()). An app that declares `blocking: true` — or simply
// forgets the field — would otherwise busy-lock the whole page on EVERY
// keystroke (`.vms-busy` → `pointer-events: none` for the duration of any
// user-initiated dispatch). That failure is severe, silent at author time, and
// only visible when someone actually types. D11 says the renderer forces it and
// the app cannot opt out; these two tests are what hold that.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
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

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 🚨 D11 — THE RENDERER FORCES THE LANE
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 D11 — searchAction is renderer-FORCED onto the non-blocking lane", () => {
  it("forces blocking:false when the app declared NOTHING", () => {
    const t = setup();
    t.render(lookupVm({ searchAction: { name: "search-owner" } }));
    type(t.input(), "sa");
    vi.advanceTimersByTime(300);

    expect(t.actions).toHaveLength(1);
    // `blocking: false` is the entire opt-in to the non-blocking lane. An app
    // that omits it gets `undefined` — which classifies as BLOCKING.
    expect(t.actions[0].blocking).toBe(false);
  });

  it("forces blocking:false EVEN WHEN the app explicitly declared blocking:true", () => {
    const t = setup();
    t.render(lookupVm({ searchAction: { name: "search-owner", blocking: true } }));
    type(t.input(), "sa");
    vi.advanceTimersByTime(300);

    expect(t.actions).toHaveLength(1);
    // The app cannot opt out. A search query is DEFINITIONALLY a background
    // question; there is no coherent app that wants a blocking one.
    expect(t.actions[0].blocking).toBe(false);
  });

  it("carries the app's action NAME through unchanged (only `blocking` is synthesized)", () => {
    const t = setup();
    t.render(lookupVm({ searchAction: { name: "search-owner", blocking: true } }));
    type(t.input(), "sa");
    vi.advanceTimersByTime(300);
    expect(t.actions[0].name).toBe("search-owner");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The debounce
// ─────────────────────────────────────────────────────────────────────────────

describe("the 300ms query debounce", () => {
  it("three keystrokes inside one window produce EXACTLY ONE dispatch", () => {
    const t = setup();
    t.render(lookupVm());
    const inp = t.input();
    type(inp, "s");
    vi.advanceTimersByTime(100);
    type(inp, "sa");
    vi.advanceTimersByTime(100);
    type(inp, "sal");
    vi.advanceTimersByTime(300);

    expect(t.actions).toHaveLength(1);
  });

  it("does not dispatch BEFORE the window elapses", () => {
    const t = setup();
    t.render(lookupVm());
    type(t.input(), "sal");
    vi.advanceTimersByTime(299);
    expect(t.actions).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(t.actions).toHaveLength(1);
  });

  it("fires ~300ms after the LAST keystroke, not the first", () => {
    const t = setup();
    t.render(lookupVm());
    const inp = t.input();
    type(inp, "s");
    vi.advanceTimersByTime(250);
    type(inp, "sa");        // reschedules
    vi.advanceTimersByTime(299);
    expect(t.actions).toHaveLength(0);   // 549ms since the FIRST keystroke
    vi.advanceTimersByTime(1);
    expect(t.actions).toHaveLength(1);
  });

  it("writes searchBind IMMEDIATELY on every keystroke (the query is state)", () => {
    const t = setup();
    t.render(lookupVm());
    const inp = t.input();
    type(inp, "s");
    type(inp, "sa");
    // No timer advance — the bind is written eagerly, like the table filter.
    expect(t.state.ownerQuery).toBe("sa");
    expect(t.actions).toHaveLength(0);
  });

  it("re-reads inp.value FRESH inside the timer callback (flush at FIRE time, not schedule time)", () => {
    const t = setup();
    t.render(lookupVm());
    const inp = t.input();
    type(inp, "sa");
    // Mutate the value WITHOUT an input event — simulates an autofill/IME
    // landing after the debounce was scheduled. The dispatched state must be
    // the value as of FIRE time.
    inp.value = "sales";
    vi.advanceTimersByTime(300);

    expect(t.state.ownerQuery).toBe("sales");
    expect(t.actions).toHaveLength(1);
  });

  it("dispatches once per distinct burst (two bursts ⇒ two dispatches)", () => {
    const t = setup();
    t.render(lookupVm());
    const inp = t.input();
    type(inp, "sa");
    vi.advanceTimersByTime(300);
    type(inp, "sales");
    vi.advanceTimersByTime(300);
    expect(t.actions).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OPEN-6 — the empty query is a legitimate query
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 OPEN-6 — an EMPTY query dispatches (no minChars gate)", () => {
  it("clearing the input to \"\" fires searchAction after the debounce", () => {
    const t = setup({ ownerQuery: "sal" });
    t.render(lookupVm());
    const inp = t.input();
    type(inp, "");
    vi.advanceTimersByTime(300);

    // This is how an app serves a most-recently-used list (Salesforce's picker
    // `searchType` DEFAULTS to `Recent`). A `if (value)` gate here would void
    // the MRU decision silently.
    expect(t.actions).toHaveLength(1);
    expect(t.state.ownerQuery).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Independence from `action`
// ─────────────────────────────────────────────────────────────────────────────

describe("`action` and `searchAction` are independent", () => {
  it("Enter dispatches `action`, NOT `searchAction`", () => {
    const t = setup();
    t.render(lookupVm({ action: { name: "submit-owner" } }));
    const inp = t.input();
    inp.value = "sal";
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(t.actions).toHaveLength(1);
    expect(t.actions[0].name).toBe("submit-owner");
    // Enter is NOT a search trigger; the pending debounce is the only thing
    // that dispatches searchAction.
    expect(t.actions[0].blocking).toBeUndefined();
  });

  it("a lookup with NO searchAction never schedules a dispatch", () => {
    const t = setup();
    t.render(lookupVm({ searchAction: undefined }));
    type(t.input(), "sal");
    vi.advanceTimersByTime(5000);
    expect(t.actions).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 item 14 — the active option is cleared on every query change
// ─────────────────────────────────────────────────────────────────────────────

describe("§7 item 14 — the active option clears on query change", () => {
  it("typing drops aria-activedescendant", () => {
    const t = setup();
    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally" }, { value: "2", label: "Sam" }] }));
    const inp = t.input();
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(inp.getAttribute("aria-activedescendant")).not.toBeNull();

    type(inp, "sa");
    expect(inp.getAttribute("aria-activedescendant")).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🚨 POPUP-OPEN PRESERVATION — the bug the debounce EXPOSES
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 popup-open survives the re-render the search itself causes", () => {
  // 21-03's executor handed this forward: popup-open state is DOM-local and
  // dies in render()'s innerHTML wipe. It is invisible until a debounced search
  // lands — and then EVERY keystroke slams the popup shut ~300ms later, which
  // makes the control unusable. Preserve OPEN.
  it("a popup left open is still open after a full re-render", () => {
    const t = setup();
    const withResults = lookupVm({ candidates: [{ value: "1", label: "Sally" }] });
    t.render(withResults);
    type(t.input(), "sa");
    expect(t.popup().hidden).toBe(false);

    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally Omer" }, { value: "2", label: "Sam" }] }));
    expect(t.popup().hidden).toBe(false);
    expect(t.input().getAttribute("aria-expanded")).toBe("true");
  });

  it("🚨 preserves OPEN but NOT ACTIVE — §7 item 14's NVDA failure must not be resurrected", () => {
    // If popup-open preservation also restored the active index, an option would
    // be auto-highlighted the moment results land mid-typing — exactly the React
    // Aria NVDA finding item 14 exists to prevent ("character deletions and text
    // cursor movement in the ComboBox input weren't being announced at all").
    const t = setup();
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
    const t = setup();
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
    const t = setup({ ownerId: "1" });
    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally" }], selected: [{ value: "1", label: "Sally" }] }));
    type(t.input(), "sa");
    t.render(lookupVm({ candidates: [{ value: "1", label: "Sally" }], selected: [{ value: "1", label: "Sally" }] }));

    t.input().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(t.popup().hidden).toBe(true);
    expect(t.state.ownerId).toBe("1");   // NOT cleared
  });

  it("a lookup dropped from the tree does not leak its pending search timer", () => {
    const t = setup();
    t.render(lookupVm());
    type(t.input(), "sal");
    // The field is gone before the debounce fires — dispatching a search for a
    // field that no longer exists is a pointless round trip.
    t.render({ type: "text", text: "gone" } as unknown as ViewNode);
    vi.advanceTimersByTime(1000);
    expect(t.actions).toHaveLength(0);
  });
});
