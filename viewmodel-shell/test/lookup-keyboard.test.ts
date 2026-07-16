// Phase 21 (LOOK-01) — the lookup's keyboard contract, design §7 items 14-22.
//
// 🚨 WHY THIS FILE IS SEPARATE AND WHY EVERY ITEM GETS ITS OWN NAMED TEST:
// these rules are individually small, individually easy to drop, and INVISIBLE
// when dropped. A lookup with a broken Escape still looks perfect and still
// passes every structural test in lookup-render.test.ts. The three
// counter-intuitive ones — Home/End are text-editing keys, Escape never clears
// while open, and Tab abandons rather than accepts (OPEN-2) — are the ones a
// future reader will "fix" on reasonable-sounding instinct. They must fail here.
//
// ⚠️ A note on caret assertions: jsdom does not implement the browser's own
// caret movement, so "the caret moved" is not directly observable. What IS
// observable — and what is actually the contract — is that we DO NOT intercept
// the key: `defaultPrevented === false` means the browser's built-in editing
// behavior runs. That is precisely the APG's "avoid JavaScript interference
// with browser-provided editing functions", so it is the right assertion, not a
// consolation prize.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { StateAccess, ViewNode, ActionEvent } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function setup(initial: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const adapter = new BrowserAdapter(container);
  const state = initial as Record<string, unknown>;
  const sa: StateAccess = {
    read(path: string): unknown {
      return path.split(".").reduce<unknown>(
        (o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), state);
    },
    write(path: string, value: unknown): void {
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
  const node = {
    type: "field", name: "owner", inputType: "lookup", bind: "f.owner", label: "Owner",
    candidates: [
      { value: "u-9", label: "Zoe Adams" },
      { value: "u-3", label: "Bob Lee" },
      { value: "u-7", label: "Al Ng" },
    ],
    ...extra,
  } as ViewNode;
  adapter.render(node, (a) => { actions.push(a); }, sa);
  const input = container.querySelector<HTMLInputElement>("input.vms-field__input")!;
  const options = Array.from(container.querySelectorAll<HTMLElement>(".vms-field__option"));
  const key = (k: string, init: KeyboardEventInit = {}): KeyboardEvent => {
    const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init });
    input.dispatchEvent(e);
    return e;
  };
  return {
    container, state, actions, input, options, key,
    isOpen: () => input.getAttribute("aria-expanded") === "true",
    active: () => input.getAttribute("aria-activedescendant"),
    owner: () => (state.f as Record<string, unknown> | undefined)?.owner,
    /** Open the popup with the first option highlighted (the Down path). */
    openWithActive: () => { key("ArrowDown"); },
  };
}

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

// ─────────────────────────────────────────────────────────────────────────────
// §7 item 15 — the CLOSED popup
// ─────────────────────────────────────────────────────────────────────────────

describe("§7 item 15 — keys on a CLOSED popup", () => {
  it("Down opens the popup and focuses the FIRST option", () => {
    const h = setup({ f: { owner: "" } });
    expect(h.isOpen()).toBe(false);
    h.key("ArrowDown");
    expect(h.isOpen()).toBe(true);
    expect(h.active()).toBe(h.options[0].id);
  });

  it("🚨 Alt+Down opens the popup WITHOUT moving focus into the list", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowDown", { altKey: true });
    expect(h.isOpen()).toBe(true);
    // The whole point of Alt+Down: the list is revealed, nothing is highlighted.
    expect(h.active()).toBeNull();
  });

  it("Up opens the popup and focuses the LAST option", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowUp");
    expect(h.isOpen()).toBe(true);
    expect(h.active()).toBe(h.options[2].id);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 item 16 — the OPEN popup
// ─────────────────────────────────────────────────────────────────────────────

describe("§7 item 16 — Down/Up move through options and WRAP", () => {
  it("Down walks forward through every option", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowDown");
    expect(h.active()).toBe(h.options[0].id);
    h.key("ArrowDown");
    expect(h.active()).toBe(h.options[1].id);
    h.key("ArrowDown");
    expect(h.active()).toBe(h.options[2].id);
  });

  it("Down WRAPS from the last option back to the first", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowUp"); // opens on the LAST option
    expect(h.active()).toBe(h.options[2].id);
    h.key("ArrowDown");
    expect(h.active()).toBe(h.options[0].id);
  });

  it("Up WRAPS from the first option back to the last", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowDown"); // opens on the FIRST option
    expect(h.active()).toBe(h.options[0].id);
    h.key("ArrowUp");
    expect(h.active()).toBe(h.options[2].id);
  });

  it("aria-selected tracks the active option and is accurate on EVERY option", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowDown");
    expect(h.options.map(o => o.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    h.key("ArrowDown");
    expect(h.options.map(o => o.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
  });
});

describe("🚨 §7 item 16 — Left/Right RETURN TO THE INPUT TEXT; they EXIT the list, they do not navigate it", () => {
  it("Left clears the active option and does NOT intercept the caret", () => {
    const h = setup({ f: { owner: "" } });
    h.openWithActive();
    expect(h.active()).toBe(h.options[0].id);
    const e = h.key("ArrowLeft");
    expect(h.active()).toBeNull();
    // NOT preventDefault'd — the browser's own caret movement is the point.
    expect(e.defaultPrevented).toBe(false);
  });

  it("Right clears the active option and does NOT intercept the caret", () => {
    const h = setup({ f: { owner: "" } });
    h.openWithActive();
    const e = h.key("ArrowRight");
    expect(h.active()).toBeNull();
    expect(e.defaultPrevented).toBe(false);
  });
});

describe("🚨 §7 item 16 — Home/End are TEXT-EDITING keys (caret to start/end), NOT first/last option", () => {
  // This is the one most likely to be "helpfully" implemented as list
  // navigation. It is an EDITABLE combobox: the caret wins.
  it("Home does NOT jump to the first option — it leaves the active option alone and lets the browser edit", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowUp"); // active = LAST option
    expect(h.active()).toBe(h.options[2].id);
    const e = h.key("Home");
    // If Home were wired to the list, this would now be options[0].
    expect(h.active()).toBe(h.options[2].id);
    expect(e.defaultPrevented).toBe(false);
  });

  it("End does NOT jump to the last option — it leaves the active option alone and lets the browser edit", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowDown"); // active = FIRST option
    expect(h.active()).toBe(h.options[0].id);
    const e = h.key("End");
    // If End were wired to the list, this would now be options[2].
    expect(h.active()).toBe(h.options[0].id);
    expect(e.defaultPrevented).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 item 17 — Enter
// ─────────────────────────────────────────────────────────────────────────────

describe("§7 item 17 — Enter with an option active accepts it", () => {
  it("writes the ID, displays the LABEL, closes the popup, and keeps focus in the input", () => {
    const h = setup({ f: { owner: "" } });
    h.input.focus();
    h.key("ArrowDown");
    h.key("ArrowDown"); // active = Bob Lee (u-3)
    const e = h.key("Enter");
    expect(e.defaultPrevented).toBe(true);
    expect(h.owner()).toBe("u-3");          // the id — and only the id
    expect(h.input.value).toBe("Bob Lee");  // the label — display only
    expect(h.isOpen()).toBe(false);
    expect(h.active()).toBeNull();
    expect(document.activeElement).toBe(h.input);
  });

  it("Enter with NO option active does not commit anything", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowDown", { altKey: true }); // open, nothing highlighted
    h.key("Enter");
    expect(h.owner()).toBe("");
  });

  it("Enter with no option active dispatches the field's own `action` (action and searchAction are independent)", () => {
    const h = setup({ f: { owner: "", q: "" } }, { action: { name: "submit-owner" }, searchBind: "f.q" });
    h.key("Enter");
    expect(h.actions).toEqual([{ name: "submit-owner" }]);
  });

  it("Enter that ACCEPTS an option does not also fire the field's `action`", () => {
    const h = setup({ f: { owner: "" } }, { action: { name: "submit-owner" } });
    h.key("ArrowDown");
    h.key("Enter");
    expect(h.actions).toEqual([]);
    expect(h.owner()).toBe("u-9");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🚨 §7 item 18 — Escape is TWO-STAGE
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 §7 item 18 — Escape is TWO-STAGE and NEVER clears while the popup is open", () => {
  it("STAGE ONE (popup OPEN): closes the popup and KEEPS the value — the load-bearing assertion", () => {
    // The user is dismissing the popup, NOT discarding their selection.
    // Clearing here would silently destroy data on a keypress that meant
    // "get this out of my way".
    const h = setup({ f: { owner: "u-1" } }, { selected: [{ value: "u-1", label: "Sally Omer" }] });
    expect(h.input.value).toBe("Sally Omer");
    h.key("ArrowDown");
    expect(h.isOpen()).toBe(true);
    const e = h.key("Escape");
    expect(e.defaultPrevented).toBe(true);
    expect(h.isOpen()).toBe(false);
    // 🚨 THE VALUE SURVIVED.
    expect(h.owner()).toBe("u-1");
    expect(h.input.value).toBe("Sally Omer");
  });

  it("STAGE ONE also abandons the highlighted option without committing it", () => {
    const h = setup({ f: { owner: "u-1" } }, { selected: [{ value: "u-1", label: "Sally Omer" }] });
    h.key("ArrowDown");
    h.key("ArrowDown"); // Bob Lee highlighted
    h.key("Escape");
    expect(h.owner()).toBe("u-1"); // NOT u-3
    expect(h.active()).toBeNull();
  });

  it("STAGE TWO (popup ALREADY CLOSED): clears — the only keyboard path to un-set a lookup", () => {
    // Deleting the input text cannot clear the selection: the text is the
    // LABEL, a view of the id in `bind` (D1). Without this, a keyboard user who
    // picked the wrong person could never undo it.
    const h = setup({ f: { owner: "u-1", q: "" } }, {
      selected: [{ value: "u-1", label: "Sally Omer" }], searchBind: "f.q",
    });
    expect(h.isOpen()).toBe(false);
    h.key("Escape");
    expect(h.owner()).toBe("");
    expect(h.input.value).toBe("");
  });

  it("the two stages in sequence: first Escape keeps, second Escape clears", () => {
    const h = setup({ f: { owner: "u-1" } }, { selected: [{ value: "u-1", label: "Sally Omer" }] });
    h.key("ArrowDown");
    h.key("Escape");
    expect(h.owner()).toBe("u-1"); // stage one KEPT it
    h.key("Escape");
    expect(h.owner()).toBe("");    // stage two cleared it
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🚨 §7 item 19 / OPEN-2 — Tab
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 §7 item 19 / OPEN-2 — Tab closes the popup and does NOT select", () => {
  // APG is SILENT here, so this is a recorded decision. Tab is a NAVIGATION
  // key; a navigation key must never silently commit. Tab-accepts would
  // silently write a wrong reference into a record when someone tabs past a
  // field mid-typing — unannounced data corruption.
  it("Tab with an option ACTIVE leaves the bind UNCHANGED", () => {
    const h = setup({ f: { owner: "u-1" } }, { selected: [{ value: "u-1", label: "Sally Omer" }] });
    h.key("ArrowDown");
    h.key("ArrowDown"); // Bob Lee (u-3) highlighted
    expect(h.active()).toBe(h.options[1].id);
    h.key("Tab");
    // 🚨 The active option was ABANDONED, not committed.
    expect(h.owner()).toBe("u-1");
    expect(h.owner()).not.toBe("u-3");
  });

  it("Tab closes the popup and drops the highlight", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowDown");
    h.key("Tab");
    expect(h.isOpen()).toBe(false);
    expect(h.active()).toBeNull();
  });

  it("Tab is NOT preventDefault'd — focus must actually move on", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowDown");
    const e = h.key("Tab");
    expect(e.defaultPrevented).toBe(false);
  });

  it("Tab on an unselected lookup commits nothing at all", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowDown");
    h.key("Tab");
    expect(h.owner()).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 item 20 — PageUp/PageDown
// ─────────────────────────────────────────────────────────────────────────────

describe("§7 item 20 — PageUp/PageDown are NOT in the contract; do not invent them", () => {
  it("PageDown is a no-op: the active option is unchanged", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowDown");
    const e = h.key("PageDown");
    expect(h.active()).toBe(h.options[0].id);
    expect(h.isOpen()).toBe(true);
    expect(e.defaultPrevented).toBe(false);
  });

  it("PageUp is a no-op: the active option is unchanged", () => {
    const h = setup({ f: { owner: "" } });
    h.key("ArrowDown");
    const e = h.key("PageUp");
    expect(h.active()).toBe(h.options[0].id);
    expect(e.defaultPrevented).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 items 14 + 21 — typing
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 §7 items 14 + 21 — typing clears the active option and is never swallowed", () => {
  it("a printable character typed while an option is active CLEARS the active option", () => {
    // React Aria's NVDA finding: with an option auto-focused, "character
    // deletions and text cursor movement in the ComboBox input weren't being
    // announced at all."
    const h = setup({ f: { owner: "", q: "" } }, { searchBind: "f.q" });
    h.key("ArrowDown");
    expect(h.active()).toBe(h.options[0].id);
    h.input.value = "z";
    h.input.dispatchEvent(new Event("input"));
    expect(h.active()).toBeNull();
  });

  it("a printable character is NOT intercepted by list-typeahead", () => {
    const h = setup({ f: { owner: "", q: "" } }, { searchBind: "f.q" });
    h.key("ArrowDown");
    const e = h.key("z");
    expect(e.defaultPrevented).toBe(false);
  });

  it("typing refilters (writes the query) and opens the popup", () => {
    const h = setup({ f: { owner: "", q: "" } }, { searchBind: "f.q" });
    h.input.value = "bo";
    h.input.dispatchEvent(new Event("input"));
    expect((h.state.f as Record<string, unknown>).q).toBe("bo");
    expect(h.isOpen()).toBe(true);
  });
});

describe("🚨 §7 item 14 — the first option is NOT auto-highlighted when results arrive", () => {
  it("a fresh render carrying candidates highlights nothing", () => {
    // The natural implementation highlights option 1 the moment results land,
    // mid-typing — which is exactly what the live-query lane produces on every
    // debounce fire. Starting at -1 makes this structural.
    const h = setup({ f: { owner: "", q: "bo" } }, { searchBind: "f.q" });
    expect(h.active()).toBeNull();
    expect(h.isOpen()).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 item 22 — Backspace/Delete
// ─────────────────────────────────────────────────────────────────────────────

describe("§7 item 22 — Backspace/Delete are plain text editing and are never intercepted", () => {
  it("Backspace is not intercepted and does not touch the bind (single-select)", () => {
    const h = setup({ f: { owner: "u-1" } }, { selected: [{ value: "u-1", label: "Sally Omer" }] });
    const e = h.key("Backspace");
    expect(e.defaultPrevented).toBe(false);
    expect(h.owner()).toBe("u-1");
  });

  it("Delete is not intercepted and does not touch the bind (single-select)", () => {
    const h = setup({ f: { owner: "u-1" } }, { selected: [{ value: "u-1", label: "Sally Omer" }] });
    const e = h.key("Delete");
    expect(e.defaultPrevented).toBe(false);
    expect(h.owner()).toBe("u-1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Empty candidate list — the keys must not throw
// ─────────────────────────────────────────────────────────────────────────────

describe("a lookup with NO candidates survives every key", () => {
  it("Down/Up open the popup but highlight nothing (there is nothing to highlight)", () => {
    const h = setup({ f: { owner: "" } }, { candidates: [] });
    h.key("ArrowDown");
    expect(h.isOpen()).toBe(true);
    expect(h.active()).toBeNull();
    h.key("ArrowUp");
    expect(h.active()).toBeNull();
    h.key("Enter");
    expect(h.owner()).toBe("");
  });
});
