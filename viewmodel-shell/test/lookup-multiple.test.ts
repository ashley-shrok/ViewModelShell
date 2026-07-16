// Phase 21 (LOOK-03 / LOOK-04) — `lookup-multiple`: the chips layer + the
// `allowCustom` axis.
//
// 🚨 WHY THIS FILE IS PARANOID, AND WHY EVERY TEST IN IT MUST SURVIVE A
// "SIMPLIFICATION" PASS.
//
// The naive chips multi-select is a KNOWN, PUBLICLY FAILED design.
// `alphagov/accessible-autocomplete-multiselect` carries the notice "This
// project is retired as the component is not accessible." It failed GOV.UK's
// OWN review because it "does not announce the selections effectively or the
// presence of the 'Remove' button for screenreaders", and they judged the fixes
// "will be challenging" enough to WITHDRAW the component rather than repair it.
// The UK government shipped this exact control and had to pull it.
//
// There is also NO APG PATTERN FOR CHIPS AT ALL — design §7 items 23-31 are
// extrapolation from that public failure plus vendor convention. So the three
// items that killed GOV.UK get named, dedicated tests here:
//
//   §7 #25 — each remove button needs a UNIQUE, ITEM-SPECIFIC accessible name
//            ("Remove Sally Omer", not "Remove", not "x"). THIS EXACT FAILURE
//            IS WHAT KILLED IT.
//   §7 #27 — add AND remove announced WITH THE RUNNING COUNT. Without the count
//            an AT user cannot know the size of the selection they are building
//            without leaving the input to audit the chips. GOV.UK failed review
//            for precisely "not announcing the selections effectively".
//   §7 #29 — focus after removing a chip: next -> previous -> the text input,
//            NEVER <body>. Removing the focused element dumps focus to <body>
//            and strands the user at the top of the page.
//
// If you are here to delete one of these because it looks like ceremony: it is
// the difference between this control and a retired one.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { ActionEvent, StateAccess, ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

const STATUS_DEBOUNCE = 1400;

// jsdom doesn't ship CSS.escape; render()'s focus-id restore uses it. The house
// polyfill (test/browser-scroll.test.ts, test/follow-tail.test.ts) — a
// passthrough is fine for the simple ASCII ids here. This suite needs it because
// it is the first to re-render WHILE a chip button holds focus, which is exactly
// the path the preservation tests below exercise.
if (typeof (globalThis as { CSS?: { escape?: unknown } }).CSS === "undefined") {
  (globalThis as unknown as { CSS: { escape: (s: string) => string } }).CSS = {
    escape: (s: string) => s,
  };
} else if (typeof (globalThis as { CSS: { escape?: unknown } }).CSS.escape !== "function") {
  (globalThis as unknown as { CSS: { escape: (s: string) => string } }).CSS.escape = (s) => s;
}

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
    chipList: () => container.querySelector<HTMLElement>(".vms-field__chips"),
    chips: () => Array.from(container.querySelectorAll<HTMLElement>(".vms-field__chip")),
    removeButtons: () =>
      Array.from(container.querySelectorAll<HTMLButtonElement>(".vms-field__chip-remove")),
    /** The live region currently holding announced text (only one ever does). */
    announced: () =>
      Array.from(container.querySelectorAll<HTMLElement>('[data-vms-live="tags"]'))
        .find(el => el.textContent !== "") ?? null,
    text: () =>
      Array.from(container.querySelectorAll<HTMLElement>('[data-vms-live="tags"]'))
        .find(el => el.textContent !== "")?.textContent ?? "",
  };
}

/** The two-selection baseline node used by most of this suite. */
function node(extra: Record<string, unknown> = {}): ViewNode {
  return {
    type: "field",
    name: "tags",
    inputType: "lookup-multiple",
    bind: "f.tags",
    searchBind: "f.q",
    selected: [
      { value: "u-1", label: "Sally Omer" },
      { value: "u-2", label: "Bob Lee" },
    ],
    ...extra,
  } as ViewNode;
}

function type(inp: HTMLInputElement, value: string): void {
  inp.value = value;
  inp.dispatchEvent(new Event("input", { bubbles: true }));
}

function key(el: HTMLElement, k: string): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e;
}

afterEach(() => { document.body.innerHTML = ""; });

// ─────────────────────────────────────────────────────────────────────────────
describe("🚨 D1 THE MULTI ANTI-TRAP — chip labels come from `selected`, NEVER `candidates`", () => {
  // The same trap as single-select, on the chip path. With an id-valued field,
  // "filter the candidate list" and "forget what's selected" are THE SAME
  // OPERATION. Mid-search the candidate list routinely EXCLUDES what is already
  // chosen — so a chip whose label was resolved out of `candidates` renders a
  // raw database id (Ant Design ships exactly this) or vanishes.
  it("both chips keep their labels while `candidates` EXCLUDES both selections", () => {
    const { render, chips } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node({ candidates: [{ value: "u-9", label: "Zoe Nobody" }] }));
    expect(chips().map(c => c.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Sally Omer")]),
    );
    const text = chips().map(c => c.textContent ?? "").join("|");
    expect(text).toContain("Sally Omer");
    expect(text).toContain("Bob Lee");
    expect(text).not.toContain("u-1");
    expect(text).not.toContain("u-2");
  });

  it("renders both chips with NO `candidates` field at all (the cold-start form load)", () => {
    const { render, chips } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    expect(chips()).toHaveLength(2);
    expect(chips()[0].textContent).toContain("Sally Omer");
    expect(chips()[1].textContent).toContain("Bob Lee");
  });

  it("D5 — a chip whose `label` is omitted displays its VALUE (label==value is absent)", () => {
    const { render, chips } = setup({ f: { tags: ["urgent"] } });
    render(node({ selected: [{ value: "urgent" }] }));
    expect(chips()[0].textContent).toContain("urgent");
  });

  it("the multi input carries ONLY the query — the selection lives in chips (SLDS/D2)", () => {
    const { render, input } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    expect(input().value).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("§7 #24/#28 — the chip group is role=list/listitem with REAL buttons, never a listbox", () => {
  // A chip CONTAINS a remove button. An interactive descendant inside
  // role="option" is invalid and destroys the accessibility tree — which is why
  // the chip group must NOT mirror the popup's listbox/option shape.
  it("the group is role=list and each chip is role=listitem", () => {
    const { render, chipList, chips } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    expect(chipList()!.getAttribute("role")).toBe("list");
    chips().forEach(c => expect(c.getAttribute("role")).toBe("listitem"));
  });

  it("§7 #28 — the chip group has an accessible name so it is findable", () => {
    const { render, chipList } = setup({ f: { tags: ["u-1"] } });
    render(node());
    expect(chipList()!.getAttribute("aria-label")).toBe("Selected items");
  });

  it("NO listbox/option roles anywhere in the chip path", () => {
    const { render, chipList } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    const group = chipList()!;
    expect(group.getAttribute("role")).not.toBe("listbox");
    expect(group.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(group.querySelectorAll('[role="listbox"]')).toHaveLength(0);
  });

  it("each remove control is a REAL <button> (operable, focusable), not a div", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    expect(removeButtons()).toHaveLength(2);
    removeButtons().forEach(b => expect(b.tagName).toBe("BUTTON"));
  });

  it("the remove button is type=button — a chip inside a form must never SUBMIT it", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1"] } });
    render(node());
    expect(removeButtons()[0].type).toBe("button");
  });

  it("single-select `lookup` renders NO chip group at all (SLDS: no pill element exists)", () => {
    const { render, chipList } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    expect(chipList()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("🚨 §7 #25 — UNIQUE, ITEM-SPECIFIC remove labels (THE FAILURE THAT KILLED GOV.UK)", () => {
  // GOV.UK's multiselect was retired because it "does not announce ... the
  // presence of the 'Remove' button for screenreaders". A screen-reader user
  // tabbing a chip row hears "Remove button, Remove button, Remove button" and
  // has no idea which is which. The name must carry the ITEM.
  it("two chips produce two DIFFERENT accessible names", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    const names = removeButtons().map(b => b.getAttribute("aria-label"));
    expect(new Set(names).size).toBe(2);
  });

  it("each name is item-specific: 'Remove Sally Omer' / 'Remove Bob Lee'", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    const names = removeButtons().map(b => b.getAttribute("aria-label"));
    expect(names).toEqual(["Remove Sally Omer", "Remove Bob Lee"]);
  });

  it("the name is NEVER the bare word 'Remove' and never just the glyph", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    removeButtons().forEach(b => {
      const name = b.getAttribute("aria-label")!;
      expect(name).not.toBe("Remove");
      expect(name).not.toBe("x");
      expect(name).not.toBe("×");
      expect(name.length).toBeGreaterThan("Remove".length);
    });
  });

  it("D5 — a label-less item names its remove button by VALUE, never leaving it unnamed", () => {
    const { render, removeButtons } = setup({ f: { tags: ["urgent"] } });
    render(node({ selected: [{ value: "urgent" }] }));
    expect(removeButtons()[0].getAttribute("aria-label")).toBe("Remove urgent");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("§7 #26 — roving tabindex across the chips (NOT aria-activedescendant)", () => {
  // Correct HERE, unlike the listbox, because chips are not text-editable: DOM
  // focus can move freely. The remove buttons need REAL focus to be operable,
  // which aria-activedescendant cannot give them.
  it("exactly ONE remove button is in the tab sequence at a time", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    const zeroes = removeButtons().filter(b => b.tabIndex === 0);
    expect(zeroes).toHaveLength(1);
    expect(removeButtons()[0].tabIndex).toBe(0);
    expect(removeButtons()[1].tabIndex).toBe(-1);
  });

  it("ArrowRight moves focus AND the tabindex to the next chip", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    removeButtons()[0].focus();
    key(removeButtons()[0], "ArrowRight");
    expect(document.activeElement).toBe(removeButtons()[1]);
    expect(removeButtons()[1].tabIndex).toBe(0);
    expect(removeButtons()[0].tabIndex).toBe(-1);
    expect(removeButtons().filter(b => b.tabIndex === 0)).toHaveLength(1);
  });

  it("ArrowLeft moves focus back", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    removeButtons()[1].focus();
    key(removeButtons()[1], "ArrowRight"); // clamp/wrap to establish position
    key(removeButtons()[1], "ArrowLeft");
    expect(document.activeElement).toBe(removeButtons()[0]);
    expect(removeButtons()[0].tabIndex).toBe(0);
  });

  it("does NOT use aria-activedescendant for chips — the buttons hold real focus", () => {
    const { render, chipList, removeButtons } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    expect(chipList()!.hasAttribute("aria-activedescendant")).toBe(false);
    removeButtons()[0].focus();
    key(removeButtons()[0], "ArrowRight");
    expect(chipList()!.hasAttribute("aria-activedescendant")).toBe(false);
    expect(document.activeElement).toBe(removeButtons()[1]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("🚨 §7 #29 — THE FOCUS-AFTER-REMOVAL RULE: next -> previous -> input, NEVER <body>", () => {
  // Removing the focused element dumps focus to <body>, which strands the user
  // at the TOP OF THE PAGE with no idea where they are. This is one of the two
  // failures that retired GOV.UK's component, and it has NO analog anywhere
  // else in this codebase — nothing else here manages focus across a SET.
  // All three arms are asserted explicitly, and every one of them also asserts
  // focus did not land on <body>.

  const three = () => node({
    selected: [
      { value: "u-1", label: "Sally Omer" },
      { value: "u-2", label: "Bob Lee" },
      { value: "u-3", label: "Ann Kim" },
    ],
  });

  it("ARM 1 — removing a MIDDLE chip focuses the NEXT chip's remove button", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1", "u-2", "u-3"] } });
    render(three());
    removeButtons()[1].focus();
    removeButtons()[1].click();
    const after = removeButtons();
    expect(after).toHaveLength(2);
    expect(document.activeElement).not.toBe(document.body);
    // "Ann Kim" shifted into the gap and is the NEXT chip.
    expect(document.activeElement).toBe(after[1]);
    expect(after[1].getAttribute("aria-label")).toBe("Remove Ann Kim");
  });

  it("ARM 2 — removing the LAST chip falls back to the PREVIOUS chip's remove button", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1", "u-2", "u-3"] } });
    render(three());
    removeButtons()[2].focus();
    removeButtons()[2].click();
    const after = removeButtons();
    expect(after).toHaveLength(2);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(after[1]);
    expect(after[1].getAttribute("aria-label")).toBe("Remove Bob Lee");
  });

  it("ARM 3 — removing the ONLY chip falls back to the TEXT INPUT", () => {
    const { render, removeButtons, input } = setup({ f: { tags: ["u-1"] } });
    render(node({ selected: [{ value: "u-1", label: "Sally Omer" }] }));
    removeButtons()[0].focus();
    removeButtons()[0].click();
    expect(removeButtons()).toHaveLength(0);
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(input());
  });

  it("focus NEVER lands on <body> — draining every chip one by one from the front", () => {
    const { render, removeButtons, input } = setup({ f: { tags: ["u-1", "u-2", "u-3"] } });
    render(three());
    for (let i = 0; i < 3; i++) {
      removeButtons()[0].focus();
      removeButtons()[0].click();
      expect(document.activeElement).not.toBe(document.body);
    }
    expect(removeButtons()).toHaveLength(0);
    expect(document.activeElement).toBe(input());
  });

  it("after a removal the roving tabindex is still coherent — exactly one 0", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1", "u-2", "u-3"] } });
    render(three());
    removeButtons()[0].click();
    expect(removeButtons().filter(b => b.tabIndex === 0)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("chip removal writes the bind — and NEVER reads `candidates`", () => {
  it("removing a chip writes the remaining string[] to bind, ORDER preserved", () => {
    const { render, removeButtons, state } = setup({ f: { tags: ["u-1", "u-2", "u-3"] } });
    render(node({
      selected: [
        { value: "u-1", label: "Sally Omer" },
        { value: "u-2", label: "Bob Lee" },
        { value: "u-3", label: "Ann Kim" },
      ],
    }));
    removeButtons()[1].click();
    expect((state.f as Record<string, unknown>).tags).toEqual(["u-1", "u-3"]);
  });

  it("removal works with `candidates` EMPTY — the chip path never consults them", () => {
    const { render, removeButtons, state } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node({ candidates: [] }));
    removeButtons()[0].click();
    expect((state.f as Record<string, unknown>).tags).toEqual(["u-2"]);
    expect(document.activeElement).not.toBe(document.body);
  });

  it("removal works when `candidates` contains UNRELATED rows (mid-search)", () => {
    const { render, removeButtons, state } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node({ candidates: [{ value: "u-9", label: "Zoe Nobody" }] }));
    removeButtons()[0].click();
    expect((state.f as Record<string, unknown>).tags).toEqual(["u-2"]);
  });

  it("the removed chip actually leaves the DOM (the control is not silently dead)", () => {
    const { render, removeButtons, chips } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    expect(chips()).toHaveLength(2);
    removeButtons()[0].click();
    expect(chips()).toHaveLength(1);
    expect(chips()[0].textContent).toContain("Bob Lee");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("adding a chip — the bind write and the optimistic chip", () => {
  it("committing a candidate APPENDS its value to the bind array, order preserved", () => {
    const { render, input, state } = setup({ f: { tags: ["u-1"] } });
    render(node({
      selected: [{ value: "u-1", label: "Sally Omer" }],
      candidates: [{ value: "u-2", label: "Bob Lee" }],
    }));
    key(input(), "ArrowDown");
    key(input(), "Enter");
    expect((state.f as Record<string, unknown>).tags).toEqual(["u-1", "u-2"]);
  });

  it("the picked item appears as a chip immediately — picking is not silently invisible", () => {
    const { render, input, chips } = setup({ f: { tags: ["u-1"] } });
    render(node({
      selected: [{ value: "u-1", label: "Sally Omer" }],
      candidates: [{ value: "u-2", label: "Bob Lee" }],
    }));
    key(input(), "ArrowDown");
    key(input(), "Enter");
    expect(chips()).toHaveLength(2);
    expect(chips()[1].textContent).toContain("Bob Lee");
  });

  it("the new chip's remove button is item-specific and wired (§7 #25 holds for added chips too)", () => {
    const { render, input, removeButtons, state } = setup({ f: { tags: [] } });
    render(node({ selected: [], candidates: [{ value: "u-2", label: "Bob Lee" }] }));
    key(input(), "ArrowDown");
    key(input(), "Enter");
    expect(removeButtons()[0].getAttribute("aria-label")).toBe("Remove Bob Lee");
    removeButtons()[0].click();
    expect((state.f as Record<string, unknown>).tags).toEqual([]);
  });

  it("§7 #30 — the popup does NOT close on select (the user is usually picking several)", () => {
    const { render, input, popup } = setup({ f: { tags: [] } });
    render(node({
      selected: [],
      candidates: [{ value: "u-2", label: "Bob Lee" }, { value: "u-3", label: "Ann Kim" }],
    }));
    key(input(), "ArrowDown");
    expect(popup().hidden).toBe(false);
    key(input(), "Enter");
    expect(popup().hidden).toBe(false);
    expect(input().getAttribute("aria-expanded")).toBe("true");
  });

  it("single-select DOES close on select — the multi rule is multi-only", () => {
    const { render, input, popup } = setup({ f: { owner: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      candidates: [{ value: "u-2", label: "Bob Lee" }],
    } as ViewNode);
    key(input(), "ArrowDown");
    expect(popup().hidden).toBe(false);
    key(input(), "Enter");
    expect(popup().hidden).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("§7 #30 — multi listbox semantics", () => {
  it("the popup carries aria-multiselectable=true", () => {
    const { render, popup } = setup({ f: { tags: [] } });
    render(node({ candidates: [{ value: "u-2", label: "Bob Lee" }] }));
    expect(popup().getAttribute("aria-multiselectable")).toBe("true");
  });

  it("single-select does NOT carry aria-multiselectable", () => {
    const { render, popup } = setup({ f: { owner: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      candidates: [{ value: "u-2", label: "Bob Lee" }],
    } as ViewNode);
    expect(popup().hasAttribute("aria-multiselectable")).toBe(false);
  });

  it("aria-selected is accurate on EVERY option — true AND false, never absent", () => {
    const { render, input, options } = setup({ f: { tags: [] } });
    render(node({
      selected: [],
      candidates: [
        { value: "u-2", label: "Bob Lee" },
        { value: "u-3", label: "Ann Kim" },
      ],
    }));
    options().forEach(o => expect(o.getAttribute("aria-selected")).toBe("false"));
    key(input(), "ArrowDown");
    expect(options().map(o => o.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    key(input(), "ArrowDown");
    expect(options().map(o => o.getAttribute("aria-selected"))).toEqual(["false", "true"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("🚨 §7 #31 — Backspace-on-empty is TWO-STEP and NON-DESTRUCTIVE", () => {
  // No authority addresses this; it is our convention. A single-press silent
  // delete is destructive, invisible to AT, and trivially mis-triggered while
  // fixing a typo. The two-step costs mouse users nothing.
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("the FIRST press does NOT remove anything", () => {
    const { render, input, state, chips } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    input().focus();
    key(input(), "Backspace");
    expect(chips()).toHaveLength(2);
    expect((state.f as Record<string, unknown>).tags).toEqual(["u-1", "u-2"]);
  });

  it("the FIRST press highlights the LAST chip", () => {
    const { render, input, chips } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    input().focus();
    key(input(), "Backspace");
    expect(chips()[1].classList.contains("vms-field__chip--armed")).toBe(true);
    expect(chips()[0].classList.contains("vms-field__chip--armed")).toBe(false);
  });

  it("the FIRST press ANNOUNCES the item and how to remove it", () => {
    const { render, input, text } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    input().focus();
    key(input(), "Backspace");
    vi.advanceTimersByTime(STATUS_DEBOUNCE);
    expect(text()).toBe("Bob Lee, press Backspace or Delete to remove");
  });

  it("the SECOND press removes", () => {
    const { render, input, state, chips } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    input().focus();
    key(input(), "Backspace");
    key(input(), "Backspace");
    expect(chips()).toHaveLength(1);
    expect((state.f as Record<string, unknown>).tags).toEqual(["u-1"]);
  });

  it("Delete also confirms an armed chip — the announcement says it does", () => {
    const { render, input, state } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    input().focus();
    key(input(), "Backspace");
    key(input(), "Delete");
    expect((state.f as Record<string, unknown>).tags).toEqual(["u-1"]);
  });

  it("the removal applies the focus rule — focus lands on the input, never <body>", () => {
    const { render, input } = setup({ f: { tags: ["u-1"] } });
    render(node({ selected: [{ value: "u-1", label: "Sally Omer" }] }));
    input().focus();
    key(input(), "Backspace");
    key(input(), "Backspace");
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toBe(input());
  });

  it("Backspace with a NON-EMPTY input is plain text editing — never intercepted (§7 #22)", () => {
    const { render, input, chips } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    input().focus();
    type(input(), "sal");
    const e = key(input(), "Backspace");
    expect(e.defaultPrevented).toBe(false);
    expect(chips()).toHaveLength(2);
    expect(chips()[1].classList.contains("vms-field__chip--armed")).toBe(false);
  });

  it("typing DISARMS — an armed chip cannot be deleted by a later stray Backspace", () => {
    const { render, input, state, chips } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    input().focus();
    key(input(), "Backspace");
    expect(chips()[1].classList.contains("vms-field__chip--armed")).toBe(true);
    type(input(), "s");
    type(input(), "");
    expect(chips()[1].classList.contains("vms-field__chip--armed")).toBe(false);
    key(input(), "Backspace"); // re-arms; does NOT delete
    expect((state.f as Record<string, unknown>).tags).toEqual(["u-1", "u-2"]);
  });

  it("Backspace on an empty input with NO chips does nothing at all", () => {
    const { render, input, state } = setup({ f: { tags: [] } });
    render(node({ selected: [] }));
    input().focus();
    const e = key(input(), "Backspace");
    expect(e.defaultPrevented).toBe(false);
    expect((state.f as Record<string, unknown>).tags).toEqual([]);
  });

  it("single-select NEVER intercepts Backspace (§7 #22 — the two-step is multi-only)", () => {
    const { render, input } = setup({ f: { owner: "u-1" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      selected: [{ value: "u-1", label: "Sally Omer" }],
    } as ViewNode);
    input().value = "";
    input().focus();
    const e = key(input(), "Backspace");
    expect(e.defaultPrevented).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("DOM-local chip state survives the re-render the search cadence causes", () => {
  // 21-04's handed-forward warning: this arm's cadence turns previously-invisible
  // DOM-local state into a bug. The roving position and the ARMED chip are both
  // DOM-local and die in render()'s innerHTML wipe. A 300ms debounced search
  // means a re-render lands MID-INTERACTION routinely.
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("the roving position survives a re-render", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    removeButtons()[0].focus();
    key(removeButtons()[0], "ArrowRight");
    expect(removeButtons()[1].tabIndex).toBe(0);
    render(node());
    expect(removeButtons()[1].tabIndex).toBe(0);
    expect(removeButtons()[0].tabIndex).toBe(-1);
  });

  it("the ARMED chip survives a re-render — the two-step is not silently reset", () => {
    const { render, input, state, chips } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    input().focus();
    key(input(), "Backspace");
    render(node());
    expect(chips()[1].classList.contains("vms-field__chip--armed")).toBe(true);
    key(input(), "Backspace");
    expect((state.f as Record<string, unknown>).tags).toEqual(["u-1"]);
  });

  it("🚨 the arm does NOT survive if the server CHANGED the last chip — never delete the wrong item", () => {
    // Preserving an armed FLAG by position would confirm a delete against a
    // DIFFERENT item than the one announced — exactly the silent data
    // corruption the two-step exists to prevent. The arm is keyed by VALUE.
    const { render, input, state, chips } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    input().focus();
    key(input(), "Backspace"); // arms "Bob Lee" (u-2)
    render(node({
      selected: [
        { value: "u-1", label: "Sally Omer" },
        { value: "u-7", label: "Someone Else" },
      ],
    }));
    expect(chips()[1].classList.contains("vms-field__chip--armed")).toBe(false);
    key(input(), "Backspace"); // re-arms the NEW last chip; does NOT delete
    expect((state.f as Record<string, unknown>).tags).toEqual(["u-1", "u-2"]);
  });

  it("the roving position clamps when the server returns FEWER chips", () => {
    const { render, removeButtons } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    removeButtons()[0].focus();
    key(removeButtons()[0], "ArrowRight");
    render(node({ selected: [{ value: "u-1", label: "Sally Omer" }] }));
    expect(removeButtons()).toHaveLength(1);
    expect(removeButtons().filter(b => b.tabIndex === 0)).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("🚨 §7 #27 — add AND remove announce WITH THE RUNNING COUNT", () => {
  // GOV.UK FAILED REVIEW FOR EXACTLY THIS OMISSION ("does not announce the
  // selections effectively"). Without the count an AT user cannot know the SIZE
  // of the selection they are building without abandoning the input to audit the
  // chips one by one. The count is the whole point — a test that only asserted
  // "the item name is announced" would pass on the retired GOV.UK component.
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("ADD is announced with the item AND the count", () => {
    const { render, input, text } = setup({ f: { tags: ["u-1"] } });
    render(node({
      selected: [{ value: "u-1", label: "Sally Omer" }],
      candidates: [{ value: "u-2", label: "Bob Lee" }],
    }));
    key(input(), "ArrowDown");
    key(input(), "Enter");
    vi.advanceTimersByTime(STATUS_DEBOUNCE);
    expect(text()).toBe("Bob Lee selected. 2 items selected.");
    expect(text()).toContain("2");
  });

  it("REMOVE is announced with the item AND the count", () => {
    const { render, removeButtons, text } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    removeButtons()[0].click();
    vi.advanceTimersByTime(STATUS_DEBOUNCE);
    expect(text()).toBe("Sally Omer removed. 1 items selected.");
    expect(text()).toContain("1");
  });

  it("the count TRACKS the selection as it is built up", () => {
    const { render, input, text } = setup({ f: { tags: [] } });
    render(node({
      selected: [],
      candidates: [{ value: "u-2", label: "Bob Lee" }, { value: "u-3", label: "Ann Kim" }],
    }));
    key(input(), "ArrowDown");
    key(input(), "Enter");
    vi.advanceTimersByTime(STATUS_DEBOUNCE);
    expect(text()).toContain("1 items selected.");
    key(input(), "ArrowDown");
    key(input(), "ArrowDown");
    key(input(), "Enter");
    vi.advanceTimersByTime(STATUS_DEBOUNCE);
    expect(text()).toContain("2 items selected.");
  });

  it("§7 #12 — two successive IDENTICAL announcements land in DIFFERENT regions", () => {
    // Writing identical text into a live region twice is NOT a change and is NOT
    // re-announced. Committing the same item twice must still be heard.
    const { render, input, container } = setup({ f: { tags: [] } });
    render(node({ selected: [], candidates: [{ value: "u-2", label: "Bob Lee" }] }));
    const regionOf = (t: string) =>
      Array.from(container.querySelectorAll<HTMLElement>('[data-vms-live="tags"]'))
        .find(el => el.textContent === t) ?? null;

    key(input(), "ArrowDown");
    key(input(), "Enter");
    vi.advanceTimersByTime(STATUS_DEBOUNCE);
    const first = regionOf("Bob Lee selected. 1 items selected.");
    expect(first).not.toBeNull();

    // Same item again — a duplicate. Same sentence, and it must still register.
    key(input(), "ArrowDown");
    key(input(), "Enter");
    vi.advanceTimersByTime(STATUS_DEBOUNCE);
    const second = regionOf("Bob Lee selected. 1 items selected.");
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it("🚨 §7 #32 — a selection change produces live-region TEXT, not merely an attribute flip", () => {
    // aria-selected/aria-multiselectable are "mostly not announced when true",
    // and on Safari/VoiceOver the ARIA path conveys NOTHING. Every fact they
    // encode must ALSO be in the live-region text — so this asserts the TEXT,
    // not the attributes.
    const { render, input, announced, options, popup } = setup({ f: { tags: [] } });
    render(node({ selected: [], candidates: [{ value: "u-2", label: "Bob Lee" }] }));
    key(input(), "ArrowDown");
    // The ARIA is set, and it is set correctly...
    expect(options()[0].getAttribute("aria-selected")).toBe("true");
    expect(popup().getAttribute("aria-multiselectable")).toBe("true");
    key(input(), "Enter");
    // ...and it is NOT the delivery mechanism. Note the attribute is now back to
    // "false" (§7 #14 clears the active option on commit), so at this instant
    // the ARIA encodes NOTHING about the selection the user just made — the
    // live-region text is quite literally the only carrier.
    expect(options()[0].getAttribute("aria-selected")).toBe("false");
    vi.advanceTimersByTime(STATUS_DEBOUNCE);
    expect(announced()).not.toBeNull();
    expect(announced()!.textContent).toContain("Bob Lee");
    expect(announced()!.getAttribute("role")).toBe("status");
  });

  it("chip announcements route through the EXISTING 1400ms helper — not a second mechanism", () => {
    const { render, removeButtons, text } = setup({ f: { tags: ["u-1", "u-2"] } });
    render(node());
    removeButtons()[0].click();
    // Nothing before the debounce elapses: same helper, same cadence.
    vi.advanceTimersByTime(STATUS_DEBOUNCE - 1);
    expect(text()).toBe("");
    vi.advanceTimersByTime(1);
    expect(text()).toContain("Sally Omer removed.");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("D3 (LOOK-04) — `allowCustom` is a DECLARED axis, never inferred", () => {
  it("🚨 allowCustom ABSENT — a typed non-candidate value commits NOTHING", () => {
    const { render, input, writes, state } = setup({ f: { tags: [] } });
    render(node({ selected: [] }));
    type(input(), "invented");
    key(input(), "Enter");
    expect((state.f as Record<string, unknown>).tags).toEqual([]);
    expect(writes.filter(w => w.path === "f.tags")).toHaveLength(0);
  });

  it("allowCustom EXPLICITLY false — still commits nothing", () => {
    const { render, input, state } = setup({ f: { tags: [] } });
    render(node({ selected: [], allowCustom: false }));
    type(input(), "invented");
    key(input(), "Enter");
    expect((state.f as Record<string, unknown>).tags).toEqual([]);
  });

  it("allowCustom TRUE — a typed non-candidate value commits", () => {
    const { render, input, state, chips } = setup({ f: { tags: [] } });
    render(node({ selected: [], allowCustom: true }));
    type(input(), "invented");
    key(input(), "Enter");
    expect((state.f as Record<string, unknown>).tags).toEqual(["invented"]);
    expect(chips()).toHaveLength(1);
  });

  it("an invented value's chip LABEL EQUALS ITS VALUE (D5 — a tag is a value that labels itself)", () => {
    const { render, input, chips, removeButtons } = setup({ f: { tags: [] } });
    render(node({ selected: [], allowCustom: true }));
    type(input(), "urgent");
    key(input(), "Enter");
    expect(chips()[0].textContent).toContain("urgent");
    expect(removeButtons()[0].getAttribute("aria-label")).toBe("Remove urgent");
  });

  it("an invented value is announced with the running count, exactly like a picked one", () => {
    vi.useFakeTimers();
    try {
      const { render, input, text } = setup({ f: { tags: [] } });
      render(node({ selected: [], allowCustom: true }));
      type(input(), "urgent");
      key(input(), "Enter");
      vi.advanceTimersByTime(STATUS_DEBOUNCE);
      expect(text()).toBe("urgent selected. 1 items selected.");
    } finally { vi.useRealTimers(); }
  });

  it("committing an invented value clears the input and the query bind", () => {
    const { render, input, state } = setup({ f: { tags: [], q: "urgent" } });
    render(node({ selected: [], allowCustom: true }));
    type(input(), "urgent");
    key(input(), "Enter");
    expect(input().value).toBe("");
    expect((state.f as Record<string, unknown>).q).toBe("");
  });

  it("Enter with an ACTIVE option still picks the candidate — allowCustom does not hijack it", () => {
    const { render, input, state } = setup({ f: { tags: [] } });
    render(node({
      selected: [], allowCustom: true,
      candidates: [{ value: "u-2", label: "Bob Lee" }],
    }));
    type(input(), "Bob");
    key(input(), "ArrowDown");
    key(input(), "Enter");
    expect((state.f as Record<string, unknown>).tags).toEqual(["u-2"]);
  });

  it("allowCustom + an EMPTY input commits nothing", () => {
    const { render, input, state } = setup({ f: { tags: [] } });
    render(node({ selected: [], allowCustom: true }));
    key(input(), "Enter");
    expect((state.f as Record<string, unknown>).tags).toEqual([]);
  });

  it("single-select allowCustom commits the invented value to the bind as the id", () => {
    const { render, input, state } = setup({ f: { owner: "" } });
    render({
      type: "field", name: "owner", inputType: "lookup", bind: "f.owner",
      allowCustom: true, selected: [],
    } as ViewNode);
    type(input(), "someone-new");
    key(input(), "Enter");
    expect((state.f as Record<string, unknown>).owner).toBe("someone-new");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("🚨 D3 — the bind stays HOMOGENEOUS: no `Value | string` union can arise", () => {
  // MUI's `multiple + freeSolo` yields `Array<Value | string>` — a heterogeneous
  // array that forces EVERY consumer to branch on `typeof`, and whose own docs
  // warn it "may cause type mismatch". Their tags demo dodges it only by
  // degrading options to bare strings. We never admit a bare string: an invented
  // value is a homogeneous LookupItem whose label equals its value, and `bind`
  // is string[] of ids either way.
  it("a bind built from BOTH picked and invented entries is uniformly strings", () => {
    const { render, input, state } = setup({ f: { tags: [] } });
    render(node({
      selected: [], allowCustom: true,
      candidates: [{ value: "u-2", label: "Bob Lee" }],
    }));
    // Picked.
    key(input(), "ArrowDown");
    key(input(), "Enter");
    // Invented.
    type(input(), "urgent");
    key(input(), "Enter");

    const tags = (state.f as Record<string, unknown>).tags as unknown[];
    expect(tags).toEqual(["u-2", "urgent"]);
    tags.forEach(t => expect(typeof t).toBe("string"));
    // The load-bearing assertion: NOTHING in the array is an object. If a bare
    // LookupItem ever leaked into the bind, this is what would catch it.
    tags.forEach(t => expect(typeof t).not.toBe("object"));
  });

  it("the invented entry is indistinguishable IN SHAPE from a picked one (OPEN-3)", () => {
    // Picked-vs-invented is SERVER-decidable — the server produced every
    // candidate it ever offered, so it can test an id against its own id space.
    // There is deliberately no wire marker for provenance.
    const { render, input, state } = setup({ f: { tags: [] } });
    render(node({
      selected: [], allowCustom: true,
      candidates: [{ value: "u-2", label: "Bob Lee" }],
    }));
    key(input(), "ArrowDown");
    key(input(), "Enter");
    type(input(), "urgent");
    key(input(), "Enter");
    const tags = (state.f as Record<string, unknown>).tags as string[];
    expect(tags.join("|")).not.toContain("__isNew__");
    expect(JSON.stringify(tags)).toBe('["u-2","urgent"]');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("D3 — `allowCustom: true` + NO candidates IS a free-form tags input", () => {
  // The design's claim, asserted end-to-end: this composition needs NO special
  // case in the renderer, which is why it SUPERSEDED the separately-designed
  // `inputType: "tags"` proposal. Every node field below is one a tags input
  // would need anyway; nothing is tags-specific.
  const tagsNode = (extra: Record<string, unknown> = {}): ViewNode => ({
    type: "field", name: "tags", inputType: "lookup-multiple",
    bind: "f.tags", searchBind: "f.q", allowCustom: true, selected: [],
    ...extra,
  } as ViewNode);

  it("types three tags, gets three chips and three strings — no candidates anywhere", () => {
    const { render, input, state, chips } = setup({ f: { tags: [] } });
    render(tagsNode());
    for (const t of ["alpha", "beta", "gamma"]) {
      type(input(), t);
      key(input(), "Enter");
    }
    expect((state.f as Record<string, unknown>).tags).toEqual(["alpha", "beta", "gamma"]);
    expect(chips().map(c => c.textContent?.replace("×", ""))).toEqual(["alpha", "beta", "gamma"]);
  });

  it("its chips carry the full a11y baseline — item-specific removes, roving, focus rule", () => {
    const { render, input, removeButtons } = setup({ f: { tags: [] } });
    render(tagsNode());
    for (const t of ["alpha", "beta"]) { type(input(), t); key(input(), "Enter"); }
    expect(removeButtons().map(b => b.getAttribute("aria-label")))
      .toEqual(["Remove alpha", "Remove beta"]);
    expect(removeButtons().filter(b => b.tabIndex === 0)).toHaveLength(1);
    removeButtons()[1].focus();
    removeButtons()[1].click();
    expect(document.activeElement).not.toBe(document.body);
  });

  it("a tag is removable and the bind keeps up", () => {
    const { render, input, state, removeButtons } = setup({ f: { tags: [] } });
    render(tagsNode());
    for (const t of ["alpha", "beta", "gamma"]) { type(input(), t); key(input(), "Enter"); }
    removeButtons()[1].click();
    expect((state.f as Record<string, unknown>).tags).toEqual(["alpha", "gamma"]);
  });

  it("the popup stays empty and closed — there is nothing to suggest", () => {
    const { render, input, popup, options } = setup({ f: { tags: [] } });
    render(tagsNode());
    type(input(), "alpha");
    expect(options()).toHaveLength(0);
    expect(popup().hidden).toBe(true);
  });

  it("the two-step Backspace works in the tags composition too", () => {
    const { render, input, state } = setup({ f: { tags: [] } });
    render(tagsNode());
    for (const t of ["alpha", "beta"]) { type(input(), t); key(input(), "Enter"); }
    key(input(), "Backspace");
    expect((state.f as Record<string, unknown>).tags).toEqual(["alpha", "beta"]);
    key(input(), "Backspace");
    expect((state.f as Record<string, unknown>).tags).toEqual(["alpha"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("commit-path dedupe + trim (D12 SCOPE — a state write, NOT a presentation)", () => {
  // ⚠️ This is NOT a D12 violation. D12 forbids second-guessing the SERVER'S
  // answer — reordering/filtering/deduping/truncating `candidates` FOR DISPLAY.
  // This is a STATE WRITE about the user's OWN accumulated selection, and a
  // selection set has set semantics. Presentation vs. state write.
  it("committing a DUPLICATE does not add a second id to the bind", () => {
    const { render, input, state, chips } = setup({ f: { tags: [] } });
    render(node({ selected: [], candidates: [{ value: "u-2", label: "Bob Lee" }] }));
    key(input(), "ArrowDown");
    key(input(), "Enter");
    key(input(), "ArrowDown");
    key(input(), "Enter");
    expect((state.f as Record<string, unknown>).tags).toEqual(["u-2"]);
    expect(chips()).toHaveLength(1);
  });

  it("a duplicate INVENTED value does not double up either", () => {
    const { render, input, state, chips } = setup({ f: { tags: [] } });
    render(node({ selected: [], allowCustom: true }));
    type(input(), "urgent");
    key(input(), "Enter");
    type(input(), "urgent");
    key(input(), "Enter");
    expect((state.f as Record<string, unknown>).tags).toEqual(["urgent"]);
    expect(chips()).toHaveLength(1);
  });

  it("leading/trailing whitespace is TRIMMED before commit", () => {
    const { render, input, state } = setup({ f: { tags: [] } });
    render(node({ selected: [], allowCustom: true }));
    type(input(), "  urgent  ");
    key(input(), "Enter");
    expect((state.f as Record<string, unknown>).tags).toEqual(["urgent"]);
  });

  it("trim + dedupe compose: '  urgent  ' does not re-add 'urgent'", () => {
    const { render, input, state } = setup({ f: { tags: [] } });
    render(node({ selected: [], allowCustom: true }));
    type(input(), "urgent");
    key(input(), "Enter");
    type(input(), "  urgent  ");
    key(input(), "Enter");
    expect((state.f as Record<string, unknown>).tags).toEqual(["urgent"]);
  });

  it("a WHITESPACE-ONLY entry commits nothing", () => {
    const { render, input, state } = setup({ f: { tags: [] } });
    render(node({ selected: [], allowCustom: true }));
    type(input(), "   ");
    key(input(), "Enter");
    expect((state.f as Record<string, unknown>).tags).toEqual([]);
  });

  it("🚨 D12 — the renderer still dedupes NOTHING in the candidate PRESENTATION", () => {
    // The other half of the scope line, asserted so the dedupe above can never
    // creep into the display path: duplicate candidates render as given.
    const { render, options } = setup({ f: { tags: [] } });
    render(node({
      selected: [],
      candidates: [
        { value: "u-2", label: "Bob Lee" },
        { value: "u-2", label: "Bob Lee" },
        { value: "u-1", label: "Sally Omer" },
      ],
    }));
    expect(options()).toHaveLength(3);
    // ...and ORDER is preserved: unsorted is the app's judgment, not a bug.
    expect(options().map(o => o.textContent)).toEqual(["Bob Lee", "Bob Lee", "Sally Omer"]);
  });
});
