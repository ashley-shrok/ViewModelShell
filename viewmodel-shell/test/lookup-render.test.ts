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
    // D2a — the selection lives in chip(s) OUTSIDE the input, in BOTH modes.
    chips: () => Array.from(container.querySelectorAll<HTMLElement>(".vms-field__chip")),
    chipText: () => Array.from(container.querySelectorAll<HTMLElement>(".vms-field__chip-label"))
      .map(c => c.textContent),
    chipRemove: () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>(".vms-field__chip-remove")),
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
  //
  // 🚨 EVERY NODE IN THIS BLOCK SETS `searchBind`, AND EVERY STATE SEEDS THE
  // QUERY SLOT AS `""`. THAT IS NOT INCIDENTAL — IT IS THE TEST.
  //
  // Phase 21-11: this suite PASSED while the feature was BROKEN in exactly this
  // case, because its fixtures OMITTED `searchBind` — so `query` came back
  // `undefined` and the renderer fell through to the label for a reason no real
  // app ever enjoys. A lookup without `searchBind` CANNOT SEARCH; the
  // configuration under test could not exist. A real app renders with
  // `searchBind` set and its query slot initialized to `""` (an empty string is
  // what a state record's query field IS before anyone types), and against that
  // the renderer showed the PLACEHOLDER instead of "Sally Omer" — the operator
  // saw it on the tailnet.
  //
  // ⇒ If a fixture here is ever missing a field a real app always sends, this
  // suite is proving nothing. Fixtures must be REAL, not minimal.
  //
  // 🚨 21-14 / D2a — THE ASSERTION MOVED, THE PROOF DID NOT. The label now
  // renders in a CHIP beside the input rather than inside it, so these tests
  // read `chipText()` where they used to read `input().value`. What is being
  // proved is unchanged and is still the whole reason `selected` and
  // `candidates` are separate fields: a preselected id resolves to its NAME with
  // no search having run.
  //
  // And note what the seeded `""` query now costs: NOTHING. It cannot beat the
  // label, because it is not competing with it — the label is in a chip and the
  // input holds the query, unconditionally. The bug this fixture rule was
  // written to catch is not merely fixed here; it has no place left to occur.
  it("renders the label from `selected` when `candidates` is absent entirely", () => {
    const { render, input, chipText } = setup({ f: { owner: "u-1", q: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      searchBind: "f.q", searchAction: { name: "search-owners" },
      placeholder: "Search people…",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    // 🚨 THE LABEL IS IN A CHIP, NOT IN THE INPUT (D2a). Same proof, new home:
    // "u-1" went in, "Sally Omer" came out, and no search ever ran.
    expect(chipText()).toEqual(["Sally Omer"]);
    expect(chipText()).not.toEqual(["u-1"]);
    // ...and the input is EMPTY, showing its placeholder — which is now CORRECT
    // rather than the bug. The empty query has nothing to beat: it is simply
    // what the box holds, because the box holds nothing but the query.
    expect(input().value).toBe("");
    expect(input().placeholder).toBe("Search people…");
  });

  it("the bound state still holds the ID and only the ID — the label never enters the bind", () => {
    const { render, state } = setup({ f: { owner: "u-1", q: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      searchBind: "f.q", searchAction: { name: "search-owners" },
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
  // 🚨 Same fixture rule as the headline block: `searchBind` is SET and the
  // query slot is seeded `""`, because that is what a real app sends.
  //
  // 🚨 21-14 / D2a — THIS IS NOW OBSERVABLE ON SINGLE-SELECT, AND THAT IS THE
  // THIRD THING THE CHIP BOUGHT. The trap is only WATCHABLE where the selection
  // and the candidate list are on screen AT THE SAME TIME. When single's
  // selection lived INSIDE the input, mid-search the box showed the query and
  // there was nothing to watch survive — the demo of this on the live page was
  // literally unperformable (21-13 moved it to the multi field for exactly that
  // reason). Now the chip and the list that excludes it are both visible, so the
  // fixture below is what a user can actually see with their own eyes.
  it("keeps the 'Sally Omer' chip even though `candidates` contains only Bob", () => {
    const { render, input, chipText, labels } = setup({ f: { owner: "u-1", q: "Bob" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      searchBind: "f.q", searchAction: { name: "search-owners" },
      selected: [{ value: "u-1", label: "Sally Omer" }],
      candidates: [{ value: "u-2", label: "Bob" }],
    } as ViewNode);
    // The chip sits unmoved...
    expect(chipText()).toEqual(["Sally Omer"]);
    // ...while the candidate list has nothing to do with it...
    expect(labels()).toEqual(["Bob"]);
    // ...and the query that excluded her is in the box. All three at once: that
    // is the whole trap, in one assertion, on the field where it used to be
    // invisible.
    expect(input().value).toBe("Bob");
  });

  it("an EMPTY candidate list does not erase the selected chip", () => {
    const { render, chipText } = setup({ f: { owner: "u-1", q: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      searchBind: "f.q", searchAction: { name: "search-owners" },
      selected: [{ value: "u-1", label: "Sally Omer" }],
      candidates: [],
    } as ViewNode);
    expect(chipText()).toEqual(["Sally Omer"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D5 / D6 — the item shape
// ─────────────────────────────────────────────────────────────────────────────

describe("D5 — a `selected` entry with `label` omitted displays its VALUE", () => {
  it("renders the value as the chip text (the free-form-tag case)", () => {
    const { render, chipText } = setup({ f: { tag: "urgent" } });
    render({
      type: "field", name: "tag", inputType: "lookup", bind: "f.tag",
      selected: [{ value: "urgent" }],
    } as ViewNode);
    expect(chipText()).toEqual(["urgent"]);
  });
});

describe("D6 — a polymorphic `type` tag is exposed without leaking into the bound value", () => {
  // 🚨 21-14 / D2a — the tag hangs on the CHIP (`data-vms-type`), not on the
  // input (`data-vms-selected-type`, gone). It tags THE REFERENCE, and the
  // reference is now the chip; leaving it on the input would have left a
  // type tag on a box that holds nothing but the query. This also gives MULTI
  // the exposure it never had — one tag per chip is the only shape that can work
  // for a mixed user/team set, which is D6's own motivating case.
  it("exposes type on the chip and leaves the bind holding the id alone", () => {
    const { render, chips, chipText, writes } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      selected: [{ value: "u-1", label: "Sally Omer", type: "user" }],
    } as ViewNode);
    expect(chips()[0].dataset.vmsType).toBe("user");
    expect(chipText()).toEqual(["Sally Omer"]);
    expect(writes).toEqual([]);
  });

  it("a monomorphic reference (type omitted) exposes no type tag", () => {
    const { render, chips } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect(chips()[0].dataset.vmsType).toBeUndefined();
  });

  it("each chip in a MULTI carries its OWN type — a mixed user/team set (D6's case)", () => {
    const { render, chips } = setup({ f: { owners: ["u-1", "t-9"] } });
    render({
      type: "field", name: "owners", inputType: "lookup-multiple", bind: "f.owners",
      selected: [
        { value: "u-1", label: "Sally Omer", type: "user" },
        { value: "t-9", label: "Platform", type: "team" },
      ],
    } as ViewNode);
    expect(chips().map(c => c.dataset.vmsType)).toEqual(["user", "team"]);
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
    // Phase 21 (LOOK-05) — `toContain`, not `toBe`: the §7 item 13 assistive
    // hint is also referenced here until the user's first input. decorateField
    // SEEDS its describedby list from the attribute the arm already set, so the
    // error joins the hint rather than clobbering it. Both must be present.
    expect(input().getAttribute("aria-describedby")).toContain("vms-owner-error");
  });

  it("help → wired into aria-describedby for free", () => {
    const { input } = renderLookup({ help: "Who owns this ticket" });
    // toContain — see the error test above (the assistive hint shares this slot).
    expect(input().getAttribute("aria-describedby")).toContain("vms-owner-help");
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

describe("🚨 D2a — `inp.value` IS THE QUERY, UNCONDITIONALLY, IN BOTH MODES", () => {
  // 🚨 THIS BLOCK IS THE ANTI-REGRESSION FOR THE BUG CLASS D2a DELETED, and it
  // is deliberately blunt: THE INPUT NEVER SHOWS THE LABEL. Not on a cold load,
  // not on an empty query, not on an undefined query slot, not in either mode.
  //
  // The history, because the next reader's instinct will be to "restore" the
  // fallback: the input used to answer TWO questions — is this the selection or
  // the query? — and the arbitration between them shipped a form that rendered
  // its PLACEHOLDER where the operator had already set a reference (a real state
  // record seeds its query slot to `""`, and `"" != null` was true, so the empty
  // query beat the label). 21-11 patched it by splitting the two tests. 21-14
  // DELETED THE QUESTION: the selection is a chip, so the box only ever holds the
  // query and there is nothing to arbitrate.
  //
  // ⇒ If a future change makes ANY of these assertions read a label, the
  // arbitration is back and so is the bug.
  it("a query in state is what the box holds (they are typing)", () => {
    const { render, input, chipText } = setup({ f: { owner: "u-1", q: "sal" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner", searchBind: "f.q",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect(input().value).toBe("sal");
    // ...and the selection is untouched beside it.
    expect(chipText()).toEqual(["Sally Omer"]);
  });

  it("🚨 an EMPTY-STRING query renders an EMPTY box — it has no label to beat", () => {
    // The exact fixture that produced the headline bug: a cold load with the
    // query slot seeded `""` and a reference already set. It renders the
    // placeholder, and that is now CORRECT — the label is in the chip, where a
    // query can never displace it.
    const { render, input, chipText } = setup({ f: { owner: "u-1", q: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner", searchBind: "f.q",
      searchAction: { name: "search-owners" }, placeholder: "Search people…",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect(input().value).toBe("");
    expect(chipText()).toEqual(["Sally Omer"]);
  });

  it("🚨 the box NEVER shows the label — not for single, not for multi", () => {
    // One assertion, both modes, no arity caveat: this is what "the input, in
    // both modes, holds nothing but the query" means, and it is the property
    // that makes the precedence rule unnecessary.
    for (const inputType of ["lookup", "lookup-multiple"] as const) {
      const t = setup({ f: { v: inputType === "lookup" ? "u-1" : ["u-1"], q: "" } });
      t.render({
        type: "field", name: "v", inputType, bind: "f.v", searchBind: "f.q",
        selected: [{ value: "u-1", label: "Sally Omer" }],
      } as ViewNode);
      expect(t.input().value).toBe("");
      expect(t.input().value).not.toBe("Sally Omer");
      expect(t.chipText()).toEqual(["Sally Omer"]);
      document.body.innerHTML = "";
    }
  });

  it("clearing the search text leaves the selection alone — the two are different things", () => {
    // This used to be the "clearing the box shows the label again" round trip.
    // There is nothing to come back now: the chip never left.
    const { render, input, chipText, state } = setup({ f: { owner: "u-1", q: "sal" } });
    const vm = {
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner", searchBind: "f.q",
      searchAction: { name: "search-owners" },
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode;
    render(vm);
    expect(input().value).toBe("sal");
    expect(chipText()).toEqual(["Sally Omer"]);

    (state.f as Record<string, unknown>).q = "";
    render(vm);
    expect(input().value).toBe("");
    expect(chipText()).toEqual(["Sally Omer"]);
    expect((state.f as Record<string, unknown>).owner).toBe("u-1");
  });

  it("no query slot yet (undefined) → an empty box, and the chip still shows", () => {
    const { render, input, chipText } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner", searchBind: "f.q",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect(input().value).toBe("");
    expect(chipText()).toEqual(["Sally Omer"]);
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

describe("committing a candidate writes the ID and chips the LABEL", () => {
  it("clicking an option writes the id to the bind and chips its label", () => {
    const { render, input, options, chipText, state } = setup({ f: { owner: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      candidates: [{ value: "u-9", label: "Zoe Adams" }, { value: "u-3", label: "Bob Lee" }],
    } as ViewNode);
    options()[1].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect((state.f as Record<string, unknown>).owner).toBe("u-3");
    expect(chipText()).toEqual(["Bob Lee"]);
    // 🚨 ...and the box is EMPTY, not holding the label. Committing does not put
    // text in the query slot; it never has anything to "spend" there again.
    expect(input().value).toBe("");
  });

  it("committing a candidate whose label is omitted writes and chips the value", () => {
    const { render, options, chipText, state } = setup({ f: { tag: "" } });
    render({
      type: "field", name: "tag", inputType: "lookup", bind: "f.tag",
      candidates: [{ value: "urgent" }],
    } as ViewNode);
    options()[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect((state.f as Record<string, unknown>).tag).toBe("urgent");
    expect(chipText()).toEqual(["urgent"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🚨 D2a — SINGLE'S SELECTION IS A CHIP, AND PICKING REPLACES (21-14)
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 D2a — single-select's selection is a CHIP outside the input, and picking REPLACES", () => {
  // THE DECISION, IN THE OPERATOR'S WORDS: "maybe we should just make the pill
  // separate from the input like the tag setup, even if it is a little awkward.
  // so you always have a place to type. but instead of adding a pill like with
  // tags, it replaces."
  //
  // 21-13 shipped SLDS's model — the input ITSELF styled as a pill. She drove it
  // and found it has NOWHERE TO CLICK TO TYPE: the pill was the entire input, so
  // clicking in just appended to "Sally Omer". This block holds what replaced it.
  //
  // 🚨 THE INVARIANT THESE TESTS EXIST FOR: `lookup` and `lookup-multiple` render
  // selections IDENTICALLY — chip(s) outside the input, from ONE implementation —
  // and the ONLY difference is arity. If a future change forks a parallel
  // single-select chip, the shared-a11y assertions below are what should catch it.
  const node = (extra: Record<string, unknown> = {}): ViewNode => ({
    type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
    label: "Ticket owner", searchBind: "f.q",
    selected: [{ value: "u-1", label: "Sally Omer" }],
    candidates: [],
    searchAction: { name: "search-owner" },
    ...extra,
  } as ViewNode);

  it("renders EXACTLY ONE chip for a single selection, outside the input", () => {
    const t = setup({ f: { owner: "u-1", q: "" } });
    t.render(node());
    expect(t.chips()).toHaveLength(1);
    expect(t.chipText()).toEqual(["Sally Omer"]);
    // OUTSIDE: the chip is not inside the input (an <input> cannot contain
    // elements at all) and not inside the popup — a listbox owning interactive
    // chips would be the §7 item 24 violation.
    expect(t.popup().querySelector(".vms-field__chip")).toBeNull();
  });

  it("🚨 there is ALWAYS somewhere to type — the input is empty and typeable with a selection set", () => {
    // This is the failure that produced D2a, asserted directly.
    const t = setup({ f: { owner: "u-1", q: "" } });
    t.render(node({ placeholder: "Search people…" }));
    const inp = t.input();
    expect(inp.value).toBe("");
    expect(inp.placeholder).toBe("Search people…");
    expect(inp.readOnly).toBe(false);
    expect(inp.disabled).toBe(false);
  });

  it("🚨 picking REPLACES the existing selection — never a second chip", () => {
    const t = setup({ f: { owner: "u-1", q: "sa" } });
    t.render(node({ candidates: [{ value: "u-2", label: "Bob Lee" }] }));
    expect(t.chipText()).toEqual(["Sally Omer"]);

    t.options()[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));

    // ONE chip, and it is the NEW one.
    expect(t.chips()).toHaveLength(1);
    expect(t.chipText()).toEqual(["Bob Lee"]);
    // The bind holds the new id ALONE — a bare string, never an array.
    expect((t.state.f as Record<string, unknown>).owner).toBe("u-2");
    expect(Array.isArray((t.state.f as Record<string, unknown>).owner)).toBe(false);
  });

  it("🚨 multi APPENDS where single replaces — the ONE difference between the two nodes", () => {
    // The contrast, asserted in one place, because "the only difference is arity"
    // is the claim the whole design rests on.
    const t = setup({ f: { watchers: ["u-1"], q: "sa" } });
    t.render({
      type: "field", name: "watchers", inputType: "lookup-multiple", bind: "f.watchers",
      label: "Watchers", searchBind: "f.q",
      selected: [{ value: "u-1", label: "Sally Omer" }],
      candidates: [{ value: "u-2", label: "Bob Lee" }],
    } as ViewNode);
    t.options()[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    expect(t.chips()).toHaveLength(2);
    expect(t.chipText()).toEqual(["Sally Omer", "Bob Lee"]);
    expect((t.state.f as Record<string, unknown>).watchers).toEqual(["u-1", "u-2"]);
  });

  it("no selection ⇒ no chips, and the box is still typeable", () => {
    const t = setup({ f: { owner: "", q: "" } });
    t.render(node({ selected: [] }));
    expect(t.chips()).toHaveLength(0);
    expect(t.input().value).toBe("");
  });

  it("🚨 the 21-13 pill treatment is GONE — no wrapper class, no inline clear ✕", () => {
    // The pill and its overlaid clear button are deleted, not hidden. A stray
    // `.vms-field--lookup-selected` would mean the arbitration flag came back.
    const t = setup({ f: { owner: "u-1", q: "" } });
    t.render(node());
    expect(t.container.querySelector(".vms-field--lookup-selected")).toBeNull();
    expect(t.container.querySelector(".vms-field__clear")).toBeNull();
  });

  it("🚨 the chip's ✕ clears the selection and hands focus back to the input (§7 item 29)", () => {
    // "Remove" on a single-select IS "clear the selection", and it exercises the
    // LAST fallback of the focus rule: no next chip, no previous chip ⇒ the
    // input. NEVER <body>.
    const t = setup({ f: { owner: "u-1", q: "" } });
    t.render(node());
    t.chipRemove()[0].click();
    expect((t.state.f as Record<string, unknown>).owner).toBe("");
    expect(t.chips()).toHaveLength(0);
    expect(document.activeElement).toBe(t.input());
    expect(document.activeElement).not.toBe(document.body);
  });

  it("🚨 the chip's remove button keeps the §7 item 25 item-specific name (the GOV.UK killer)", () => {
    // NOT "Remove", NOT "×". Reusing multi's chip is what makes this free — a
    // forked single-select chip is exactly where this would have been lost.
    const t = setup({ f: { owner: "u-1", q: "" } });
    t.render(node());
    const btn = t.chipRemove()[0];
    expect(btn.getAttribute("aria-label")).toBe("Remove Sally Omer");
    expect(btn.tagName).toBe("BUTTON");
    // MANDATORY: inside a FormNode this would otherwise submit on every click.
    expect(btn.type).toBe("button");
  });

  it("🚨 the chip group keeps the §7 item 24/28 structure for single too", () => {
    // role=list/listitem with a real <button> — NEVER listbox/option, because an
    // interactive descendant inside `option` destroys the a11y tree.
    const t = setup({ f: { owner: "u-1", q: "" } });
    t.render(node());
    const list = t.container.querySelector(".vms-field__chips")!;
    expect(list.getAttribute("role")).toBe("list");
    expect(list.getAttribute("aria-label")).toBe("Selected items");
    expect(t.chips()[0].getAttribute("role")).toBe("listitem");
    expect(list.querySelector("[role='option']")).toBeNull();
    expect(list.getAttribute("role")).not.toBe("listbox");
  });

  it("🚨 the combobox a11y contract is intact — the chip is a sibling, not a rewrite", () => {
    const t = setup({ f: { owner: "u-1", q: "" } });
    t.render(node());
    const inp = t.input();
    expect(inp.tagName).toBe("INPUT");
    expect(inp.getAttribute("role")).toBe("combobox");
    expect(inp.getAttribute("aria-expanded")).toBe("false");
    // The chip group must NOT have swallowed the combobox.
    expect(t.container.querySelector(".vms-field__chips")!.contains(inp)).toBe(false);
  });
});
