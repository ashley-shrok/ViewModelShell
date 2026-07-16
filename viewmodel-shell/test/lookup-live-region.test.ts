// Phase 21 (LOOK-05) — the lookup's live region (design §7 items 8-14).
//
// 🚨 WHY THIS FILE IS THE ONE A11Y TEST THAT SURVIVES (D9). Every other item in
// the §7 baseline is BUILT but not verified — a11y verification was explicitly
// declined (D9), because building correctly is near-free and retrofitting is a
// rewrite. This one is different in kind, and that is why it is the exception:
//
//   A live region rebuilt on every render NEVER ANNOUNCES, and it fails
//   SILENTLY — the page looks perfect and every structural test passes.
//
// A screen reader only announces changes to an element it has ALREADY
// registered for. `BrowserAdapter` full-rebuilds the tree on every response, so
// a naively-rendered live region is registered, wiped, re-created, and never
// heard from again. Nothing about the DOM looks wrong. On Safari/VoiceOver the
// ARIA plumbing conveys NOTHING (a11ysupport.io verified this against the APG's
// OWN reference example), so the live region is the ONLY thing that works there
// — it is load-bearing, not decorative.
//
// The mechanism is NOT new: this is a fifth instance of the `chartInstances`
// idiom (a persistent, mark-swept map whose nodes deliberately survive
// render()'s innerHTML wipe), shipped since Phase 12.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { ActionEvent, StateAccess, ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

const STATUS_DEBOUNCE = 1400;

function setup(initial: Record<string, unknown> = {}) {
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
  return {
    container,
    state,
    actions,
    adapter,
    render: (vm: ViewNode) => adapter.render(vm, (a) => { actions.push(a); }, sa),
    input: () => container.querySelector<HTMLInputElement>("input.vms-field__input")!,
    regions: () => Array.from(container.querySelectorAll<HTMLElement>('[data-vms-live="owner"]')),
    /** The region currently holding announced text (only one ever does). */
    announced: () => Array.from(container.querySelectorAll<HTMLElement>('[data-vms-live="owner"]'))
      .find(el => el.textContent !== "") ?? null,
    text: () => (Array.from(container.querySelectorAll<HTMLElement>('[data-vms-live="owner"]'))
      .find(el => el.textContent !== "")?.textContent ?? ""),
  };
}

function type(inp: HTMLInputElement, value: string): void {
  inp.value = value;
  inp.dispatchEvent(new Event("input", { bubbles: true }));
}

function key(inp: HTMLInputElement, k: string): void {
  inp.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
}

const CANDIDATES = [{ value: "1", label: "Sally" }, { value: "2", label: "Sam" }];

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
// 🚨 THE D9 PROOF — node identity survives the innerHTML wipe
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 D9 — the live region SURVIVES a full re-render with node identity intact", () => {
  it("is the SAME node object after a rebuild (toBe — reference identity)", () => {
    const t = setup();
    t.render(lookupVm());
    const first = t.container.querySelector('[data-vms-live="owner"]');
    expect(first).not.toBeNull();

    t.render(lookupVm({ candidates: CANDIDATES }));   // full rebuild — innerHTML wipe
    const second = t.container.querySelector('[data-vms-live="owner"]');

    // 🚨 IDENTITY (toBe), NOT toEqual. Do NOT "simplify" this to toEqual.
    // `toEqual` compares structure and would PASS on a freshly-created,
    // never-registered node — proving exactly nothing, which is the silent
    // failure this test exists to catch. The assistive tech's registration is
    // held against THIS OBJECT; a structurally-identical replacement is a region
    // no screen reader has ever heard of.
    expect(second).toBe(first);
  });

  it("BOTH regions keep their identity across several rebuilds", () => {
    const t = setup();
    t.render(lookupVm());
    const [a1, b1] = t.regions();
    t.render(lookupVm({ candidates: CANDIDATES }));
    t.render(lookupVm({ candidates: [] }));
    const [a2, b2] = t.regions();
    expect(a2).toBe(a1);
    expect(b2).toBe(b1);
  });

  it("survives a rebuild while still attached to the rendered tree", () => {
    const t = setup();
    t.render(lookupVm());
    const first = t.container.querySelector('[data-vms-live="owner"]')!;
    t.render(lookupVm());
    // Re-APPENDED (detached by the wipe, not destroyed) — not orphaned.
    expect(t.container.contains(first)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 items 8, 9, 12 — the shape of the region
// ─────────────────────────────────────────────────────────────────────────────

describe("§7 item 8 — the region exists EMPTY at mount", () => {
  it("renders before any results exist, with empty text", () => {
    const t = setup();
    t.render(lookupVm());   // no candidates, no search has occurred
    const regions = t.regions();
    expect(regions).toHaveLength(2);
    regions.forEach(r => expect(r.textContent).toBe(""));
  });
});

describe("§7 item 9 — politeness", () => {
  it('both regions are role="status" (polite), never assertive', () => {
    const t = setup();
    t.render(lookupVm());
    t.regions().forEach(r => {
      // polite. `assertive` is wrong for counts and loading — it interrupts the
      // user's own typing echo. Assertive is reserved for errors (which reach
      // the user through decorateField's role="alert" error region instead).
      expect(r.getAttribute("role")).toBe("status");
      expect(r.getAttribute("aria-live")).not.toBe("assertive");
    });
  });
});

describe("§7 item 12 — TWO alternating regions", () => {
  it("renders exactly two regions per lookup", () => {
    const t = setup();
    t.render(lookupVm());
    expect(t.regions()).toHaveLength(2);
  });

  it("🚨 two successive IDENTICAL messages land in DIFFERENT region elements", () => {
    // This is the whole reason there are two. Writing identical text into ONE
    // live region twice is NOT A CHANGE and is NOT RE-ANNOUNCED — re-highlight
    // the same option, get "Sally 1 of 2 is highlighted" again, hear SILENCE.
    // GOV.UK alternates two divs; React Aria independently landed on the same.
    const t = setup();
    t.render(lookupVm({ candidates: CANDIDATES }));
    const inp = t.input();

    key(inp, "ArrowDown");                       // Sally highlighted
    const firstEl = t.announced();
    expect(firstEl!.textContent).toBe("Sally 1 of 2 is highlighted");

    // Dismiss and re-open onto the same option — the second announcement is
    // IDENTICAL to the one already showing. (Escape closes and drops the
    // highlight without announcing; ArrowDown re-opens onto Sally.)
    key(inp, "Escape");
    key(inp, "ArrowDown");                       // Sally again
    const secondEl = t.announced();

    expect(secondEl!.textContent).toBe("Sally 1 of 2 is highlighted");
    expect(secondEl).not.toBe(firstEl);          // ← the alternation
    expect(firstEl!.textContent).toBe("");       // the previous region is cleared
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🚨 21-11 — the ~1400ms status debounce is GONE. One Enter, one announcement.
// ─────────────────────────────────────────────────────────────────────────────

describe("🚨 announcements are IMMEDIATE — the 1400ms status debounce is gone", () => {
  // The debounce (GOV.UK's `statusDebounceMillis`) existed for ONE reason: the
  // lookup searched on a ~300ms type-as-you-go cadence, so the region faced a
  // PER-KEYSTROKE FIREHOSE and had to wait for the user to pause or the typing
  // echo would eat the announcement (Safari/VoiceOver). `searchAction` now fires
  // on ENTER. No firehose ⇒ no tamer — and keeping it would have meant an AT
  // user waits 1.4s to hear the answer to a question they explicitly asked,
  // which inverts §7 item 11's whole point.
  it("a highlight is announced with NO timer advance at all", () => {
    const t = setup();
    t.render(lookupVm({ candidates: CANDIDATES }));
    key(t.input(), "ArrowDown");
    expect(t.text()).toBe("Sally 1 of 2 is highlighted");
  });

  it("🚨 there is NO pending timer to flush — advancing time changes nothing", () => {
    // The anti-regression: if a debounce were re-added, the assertion ABOVE
    // would fail. This one proves the announcement is not merely early — it is
    // final, with no queued write landing later.
    const t = setup();
    t.render(lookupVm({ candidates: CANDIDATES }));
    key(t.input(), "ArrowDown");
    const before = t.text();
    vi.advanceTimersByTime(5000);
    expect(t.text()).toBe(before);
  });

  it("each highlight move announces its own option (no coalescing window)", () => {
    const t = setup();
    t.render(lookupVm({ candidates: CANDIDATES }));
    const inp = t.input();
    key(inp, "ArrowDown");
    expect(t.text()).toBe("Sally 1 of 2 is highlighted");
    key(inp, "ArrowDown");
    expect(t.text()).toBe("Sam 2 of 2 is highlighted");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 item 11 — the GOV.UK announcement set, including LOADING
// ─────────────────────────────────────────────────────────────────────────────

describe("§7 item 11 — the announcement strings", () => {
  it('announces "Loading results" when the search dispatches on Enter', () => {
    // An async combobox that is SILENT during the fetch leaves AT users with no
    // signal at all — they cannot tell a slow server from a dead one.
    const t = setup();
    t.render(lookupVm());
    type(t.input(), "sa");
    key(t.input(), "Enter");            // ← the search; typing announces nothing
    expect(t.text()).toBe("Loading results");
  });

  it("typing announces NOTHING — only the Enter that asks does", () => {
    const t = setup();
    t.render(lookupVm());
    const inp = t.input();
    type(inp, "s");
    type(inp, "sa");
    type(inp, "sal");
    expect(t.text()).toBe("");
    expect(t.actions).toHaveLength(0);
  });

  it('announces "${n} results are available." when results arrive', () => {
    const t = setup();
    t.render(lookupVm());
    type(t.input(), "sa");
    key(t.input(), "Enter");
    t.render(lookupVm({ candidates: CANDIDATES }));   // the response lands
    expect(t.text()).toBe("2 results are available.");
  });

  it('announces "No search results" for an empty result set', () => {
    const t = setup();
    t.render(lookupVm());
    type(t.input(), "zzz");
    key(t.input(), "Enter");
    t.render(lookupVm({ candidates: [] }));
    expect(t.text()).toBe("No search results");
  });

  it('announces "${option} ${i+1} of ${n} is highlighted"', () => {
    const t = setup();
    t.render(lookupVm({ candidates: CANDIDATES }));
    key(t.input(), "ArrowDown");
    key(t.input(), "ArrowDown");
    expect(t.text()).toBe("Sam 2 of 2 is highlighted");
  });

  it("the answer REPLACES the loading announcement (the region ends on the result)", () => {
    const t = setup();
    t.render(lookupVm());
    type(t.input(), "sa");
    key(t.input(), "Enter");
    expect(t.text()).toBe("Loading results");         // spoken while the trip is out
    t.render(lookupVm({ candidates: CANDIDATES }));   // the response lands
    // Both are heard, in order, and the region ends holding the ANSWER — the
    // loading message is not left standing as the last thing said.
    expect(t.text()).toBe("2 results are available.");
  });

  it("does NOT announce results when the user is not querying (no search session)", () => {
    // A lookup that merely re-renders (an unrelated action, a poll tick) must
    // not narrate its candidate count at an AT user out of nowhere.
    const t = setup();
    t.render(lookupVm({ candidates: CANDIDATES }));
    t.render(lookupVm({ candidates: CANDIDATES }));
    expect(t.text()).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 item 32 — ARIA is set, but treated as NON-COMMUNICATING
// ─────────────────────────────────────────────────────────────────────────────

describe("§7 item 32 — every fact the ARIA encodes is ALSO in the live-region text", () => {
  it("a highlight change produces live-region TEXT, not merely an aria-activedescendant change", () => {
    // aria-activedescendant + aria-selected are set because they are correct and
    // cheap and support improves — but they are NOT the delivery mechanism.
    // aria-selected is "mostly not announced when true", and on Safari/VoiceOver
    // the whole ARIA path conveys nothing. If the highlight is only in the ARIA,
    // an AT user does not know what is highlighted.
    const t = setup();
    t.render(lookupVm({ candidates: CANDIDATES }));
    const inp = t.input();
    key(inp, "ArrowDown");

    expect(inp.getAttribute("aria-activedescendant")).not.toBeNull();   // the ARIA is set...
    vi.advanceTimersByTime(STATUS_DEBOUNCE);
    expect(t.text()).toBe("Sally 1 of 2 is highlighted");               // ...AND the text carries it.
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 item 13 — the assistive hint
// ─────────────────────────────────────────────────────────────────────────────

describe("§7 item 13 — the assistive hint rides aria-describedby and is removed after first input", () => {
  it("is present at mount and referenced by aria-describedby", () => {
    const t = setup();
    t.render(lookupVm());
    const hint = t.container.querySelector("#vms-owner-hint");
    expect(hint).not.toBeNull();
    expect(t.input().getAttribute("aria-describedby")).toContain("vms-owner-hint");
  });

  it("is GONE after the first input — it must not be a per-keystroke tax", () => {
    const t = setup();
    t.render(lookupVm());
    type(t.input(), "s");
    t.render(lookupVm({ candidates: CANDIDATES }));

    expect(t.container.querySelector("#vms-owner-hint")).toBeNull();
    expect(t.input().getAttribute("aria-describedby") ?? "").not.toContain("vms-owner-hint");
  });

  it("coexists with a help text (decorateField's describedby does not clobber it)", () => {
    const t = setup();
    t.render(lookupVm({ help: "Pick the owning agent." }));
    const describedBy = t.input().getAttribute("aria-describedby") ?? "";
    expect(describedBy).toContain("vms-owner-hint");
    expect(describedBy).toContain("vms-owner-help");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The mark-sweep — regions must not leak across a long session
// ─────────────────────────────────────────────────────────────────────────────

describe("the mark-sweep (the chartInstances idiom)", () => {
  it("a lookup DROPPED from the new tree has its regions removed from the map", () => {
    const t = setup();
    t.render(lookupVm());
    const map = (t.adapter as unknown as { liveRegions: Map<string, unknown> }).liveRegions;
    expect(map.size).toBe(1);

    t.render({ type: "text", text: "the lookup is gone" } as unknown as ViewNode);
    expect(map.size).toBe(0);       // swept — no leak across a long session
    expect(t.regions()).toHaveLength(0);
  });

  it("a lookup that PERSISTS keeps its entry (the sweep does not over-collect)", () => {
    const t = setup();
    t.render(lookupVm());
    const map = (t.adapter as unknown as { liveRegions: Map<string, unknown> }).liveRegions;
    t.render(lookupVm({ candidates: CANDIDATES }));
    expect(map.size).toBe(1);
  });

  it("two lookups each get their own pair of regions", () => {
    const t = setup();
    t.render({
      type: "section",
      children: [lookupVm(), lookupVm({ name: "assignee", bind: "assigneeId", searchBind: "assigneeQuery" })],
    } as unknown as ViewNode);
    const map = (t.adapter as unknown as { liveRegions: Map<string, unknown> }).liveRegions;
    expect(map.size).toBe(2);
    expect(t.container.querySelectorAll('[data-vms-live="owner"]')).toHaveLength(2);
    expect(t.container.querySelectorAll('[data-vms-live="assignee"]')).toHaveLength(2);
  });
});
