// Phase 27 (v8.1.0) — Composite state axis uniformity regression suite.
//
// Consolidated coverage for the state? axis across ALL 8 shipped composites
// carrying `state?: string`: the 3 pre-existing (ListItemNode, TableRow,
// ListRowNode — where Plan 27-04 UNIFIED the shipped `--active` styling to
// STYLE-3) + the 6 new v8.1.0 additions (UserRowNode, MessageNode,
// DetailRowNode, TimelineEntryNode, SettingRowNode, ChipNode). One file, 9
// describe blocks (Chip in a dedicated guardrail block), ~40 it() cases.
//
// Purpose: the machine-checkable proof that the state axis renders
// consistently. Without it, a future refactor could silently drop `state`
// emission on one composite and no CI signal would fire. The consolidated
// file also serves as an inventory — a new maintainer sees exactly which
// composites carry the axis and how it renders.
//
// ── jsdom caveats (banked from Phase 23/24 test-file headers + probed
// against the shipped default.css on 2026-07-30 during Plan 27-05 auth) ────
//
// (1) jsdom does NOT parse the `border-left: 3px solid var(--vms-accent)`
//     shorthand — `getComputedStyle(el).getPropertyValue("border-left-width")`
//     returns "" (not "3px") when the color component uses var(). The plan's
//     original `borderLeftWidth === '3px'` assertion is UNACHIEVABLE in
//     jsdom. Instead, this file asserts the shipped `--active` rule via a
//     TEXT GREP of the loaded stylesheet (100% mutation-testable: removing
//     the rule from default.css breaks the assertion instantly), combined
//     with runtime class-emission checks.
// (2) ListRow's shipped rule is `border-left-color: var(--vms-accent)`
//     (color-only variant — see Plan 27-04 key-decisions), and jsdom DOES
//     resolve the color-only longhand form. So ListRow uses a real
//     getComputedStyle assertion (borderLeftColor).
// (3) jsdom's CSS cascade is by SOURCE ORDER, not specificity. Since
//     default.css declares `.vms-list-row__primary { font-weight: 500 }`
//     at :1214 AFTER `.vms-list-row--active .vms-list-row__primary
//     { font-weight: 600 }` at :1210, jsdom returns 500 (the later rule
//     wins wrongly). In real browsers, specificity (0,2,0 vs 0,1,0) means
//     the --active sibling wins → 600. ListRow's weight:600 assertion
//     therefore uses a CSS-text grep instead of getComputedStyle. All
//     other composites' base rules for their primary slot come from
//     TextNode wrap classes (`.vms-text--weight-medium`, etc.), so
//     jsdom's source-order cascade doesn't collide, and their weight:600
//     assertions use getComputedStyle (probed green).
// (4) `getComputedStyle(el).opacity` returns literal float strings
//     correctly ("0.72", "0.55"). ✓ used verbatim per plan spec.
//
// ── Mutation-test proof (revert-and-run — DOCUMENTED, not permanent tests) ──
// The vitest suite for this file is designed to fail LOUDLY on any of these:
//
//   • Delete `if (n.state) cls.push("vms-{composite}--" + n.state);` in
//     browser.ts for any of the 8 composites → the "state active emits
//     vms-{composite}--active" test for that composite FAILS (class
//     missing from classList).
//   • Swap `--active` → `--activated` in ONE composite's browser.ts
//     emission → the corresponding "state active emits" test FAILS
//     (verified once by the executor during Plan 27-05 authorship, then
//     reverted — see SUMMARY.md mutation-test evidence).
//   • Delete a `--active` rule block from default.css → the composite's
//     "shipped --active CSS rule present in default.css" grep assertion
//     FAILS immediately.
//   • Accidentally add a `.vms-chip--active { ... }` rule to default.css
//     → the Chip guardrail's "no shipped --active rule" grep assertion
//     FAILS (positive-absence check per plan spec).
//   • Accidentally add a `.vms-list-item--active .vms-list-item__title
//     { font-weight: 600 }` rule to default.css → the ListItem
//     "regression: --active applies border-only (no weight:600)"
//     assertion FAILS (positive-absence check per plan-checker R1 fix).

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BrowserAdapter } from "../src/browser.js";
import type { ViewNode } from "../src/index.js";

// Load the shipped stylesheet ONCE per test process — mirrors
// text-caption.test.ts:64-76 verbatim. Enables getComputedStyle to resolve
// class-driven properties (opacity, font-weight) that jsdom supports, and
// gives every test a cssText handle for grep-based mutation assertions on
// properties jsdom cannot compute (border-left shorthand with var()).
const cssText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../styles/default.css"),
  "utf8",
);

beforeAll(() => {
  if (!document.head.querySelector('style[data-vms-default]')) {
    const style = document.createElement("style");
    style.setAttribute("data-vms-default", "true");
    style.textContent = cssText;
    document.head.appendChild(style);
  }
});

beforeEach(() => {
  document.body.innerHTML = "";
});

/**
 * Utility: render a VMS node and return the OUTER container `<div>` (parent
 * of the rendered tree — the shell's mount point). Tests then querySelector
 * inside this container to reach the rendered composite root (`.vms-message`,
 * `.vms-chip`, etc.) or any descendant primary slot. Kept DRY across the 9
 * describe blocks — every test uses this.
 */
function renderAndGet(vnode: ViewNode): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const adapter = new BrowserAdapter(container);
  adapter.render(vnode, () => {});
  return container;
}

/**
 * Utility: query a rendered subtree for the given selector; asserts non-null.
 */
function queryOr<T extends Element = HTMLElement>(root: Element, sel: string): T {
  const el = root.querySelector(sel);
  expect(el, `expected to find '${sel}' inside <${root.tagName.toLowerCase()}>`).not.toBeNull();
  return el as unknown as T;
}

// ══════════════════════════════════════════════════════════════════════════
// (1) ListItemNode — REGRESSION for STYLE-3 unification (Plan 27-04)
// ══════════════════════════════════════════════════════════════════════════
// Before Phase 27 the rule was:
//   .vms-list-item--active { border-color: var(--vms-accent);
//                            background: var(--vms-accent-glow); }
// Phase 27 (Plan 27-04) REPLACED with STYLE-3 border-only variant:
//   .vms-list-item--active { border-left: 3px solid var(--vms-accent);
//                            padding-left: calc(var(--vms-space-md) - 3px); }
// ListItem ships border-ONLY (no weight:600 sibling rule) because the
// ListItem renderer emits NO dedicated primary-text slot class — content
// goes into the <li> root as text nodes / children (see browser.ts:1987
// listItem()). This mirrors TableRow's exception in CONTEXT §Slot-mapping
// and Plan 27-04's W1 finding.
describe("ListItemNode — state axis (Phase 27) — REGRESSION for STYLE-3 unification", () => {
  it("no state → no --state class on the <li>", () => {
    const el = renderAndGet({
      type: "list",
      children: [{ type: "list-item", children: [{ type: "text", value: "hi" }] }],
    });
    const li = queryOr(el, "li.vms-list-item");
    const modifiers = li.className.split(" ").filter(c => c.startsWith("vms-list-item--"));
    expect(modifiers).toEqual([]);
  });

  it("state:active emits vms-list-item--active class", () => {
    const el = renderAndGet({
      type: "list",
      children: [{ type: "list-item", state: "active", children: [{ type: "text", value: "hi" }] }],
    });
    const li = queryOr(el, "li.vms-list-item");
    expect(li.classList.contains("vms-list-item--active")).toBe(true);
  });

  it("state:done emits vms-list-item--done class + applies opacity 0.75 (pre-existing, unchanged by Phase 27)", () => {
    const el = renderAndGet({
      type: "list",
      children: [{ type: "list-item", state: "done", children: [{ type: "text", value: "hi" }] }],
    });
    const li = queryOr(el, "li.vms-list-item");
    expect(li.classList.contains("vms-list-item--done")).toBe(true);
    // ListItem's pre-existing --done is opacity 0.75 (not 0.72 like ListRow) —
    // this predates Phase 27; assertion documents the historical value.
    expect(window.getComputedStyle(li).opacity).toBe("0.75");
  });

  it("state:disabled emits vms-list-item--disabled + applies opacity 0.55", () => {
    const el = renderAndGet({
      type: "list",
      children: [{ type: "list-item", state: "disabled", children: [{ type: "text", value: "hi" }] }],
    });
    const li = queryOr(el, "li.vms-list-item");
    expect(li.classList.contains("vms-list-item--disabled")).toBe(true);
    expect(window.getComputedStyle(li).opacity).toBe("0.55");
  });

  it("REGRESSION: --active is STYLE-3 border-left in shipped default.css (NOT the old accent-glow background)", () => {
    // Positive-presence: the shipped default.css contains the STYLE-3 rule.
    expect(cssText).toMatch(/\.vms-list-item--active[^{]*\{[^}]*border-left:\s*3px\s+solid\s+var\(--vms-accent\)/);
    expect(cssText).toMatch(/\.vms-list-item--active[^{]*\{[^}]*padding-left:\s*calc\(/);
    // Positive-ABSENCE: the old accent-glow background is GONE from the
    // --active rule block. This is the visual change flagged by MIGRATION.md
    // for 8.0.x → 8.1.0. Extract the rule text and assert it lacks the old
    // background.
    const activeRuleMatch = cssText.match(/\.vms-list-item--active[^{]*\{[^}]*\}/);
    expect(activeRuleMatch).not.toBeNull();
    expect(activeRuleMatch![0]).not.toMatch(/background:\s*var\(--vms-accent-glow\)/);
  });

  it("REGRESSION: --active applies STYLE-3 border-only (NO weight:600 rule targeting a __title slot)", () => {
    // Positive-absence per plan-checker R1 fix: ListItem has no __title
    // primary-slot class (browser.ts:1987 listItem() emits content directly
    // into <li> as text nodes / children). If a future refactor accidentally
    // adds a `.vms-list-item--active .vms-list-item__title { font-weight: 600 }`
    // rule without design work, this assertion FAILS immediately.
    expect(cssText).not.toMatch(/\.vms-list-item--active\s+\.vms-list-item__title\s*\{/);
    // Runtime confirmation: the rendered <li> contains no element with
    // class __title (the slot simply doesn't exist for this composite).
    const el = renderAndGet({
      type: "list",
      children: [{ type: "list-item", state: "active", children: [{ type: "text", value: "hi" }] }],
    });
    const li = queryOr(el, "li.vms-list-item");
    expect(li.querySelector(".vms-list-item__title")).toBeNull();
  });

  it("unrecognized state value round-trips as class with no shipped rule", () => {
    const el = renderAndGet({
      type: "list",
      children: [{ type: "list-item", state: "foobar", children: [{ type: "text", value: "hi" }] }],
    });
    const li = queryOr(el, "li.vms-list-item");
    expect(li.classList.contains("vms-list-item--foobar")).toBe(true);
    // No shipped rule for --foobar; opacity is unset via CSS (jsdom returns
    // "" for a property that no rule targets — the visible browser default
    // is 1, but jsdom's computed style is "" in that state). Asserting NOT
    // in the shipped-rule set (0.72 / 0.55 / 0.75) proves no rule fired.
    expect(window.getComputedStyle(li).opacity).not.toBe("0.72");
    expect(window.getComputedStyle(li).opacity).not.toBe("0.55");
    expect(window.getComputedStyle(li).opacity).not.toBe("0.75");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// (2) TableRow — NET-NEW --active rule (Plan 27-04)
// ══════════════════════════════════════════════════════════════════════════
// The `.vms-table__row--active` CLASS was already emitted by the renderer
// pre-Phase-27 (see browser.ts:4550 — `if (row.state) rowClass +=
// " vms-table__row--" + row.state;`), but had NO shipped CSS rule until
// Plan 27-04. Phase 27 shipped:
//   .vms-table__row--active { border-left: 3px solid var(--vms-accent); }
// TableRow ships border-ONLY (no weight:600 sibling rule) per CONTEXT
// §Slot-mapping — multi-cell rows have no single semantic primary text
// slot.
describe("TableRow — state axis (Phase 27) — NET-NEW --active rule", () => {
  const tableWith = (rowState?: string): ViewNode => ({
    type: "table",
    columns: [{ key: "name", label: "Name" }],
    rows: [{ cells: { name: "Ada" }, ...(rowState ? { state: rowState } : {}) }],
  });

  it("no row state → no --state class on the <tr>", () => {
    const el = renderAndGet(tableWith(undefined));
    const tr = queryOr(el, "tbody tr.vms-table__row");
    const modifiers = tr.className.split(" ").filter(c => c.startsWith("vms-table__row--"));
    expect(modifiers).toEqual([]);
  });

  it("state:active emits vms-table__row--active class", () => {
    const el = renderAndGet(tableWith("active"));
    const tr = queryOr(el, "tbody tr.vms-table__row");
    expect(tr.classList.contains("vms-table__row--active")).toBe(true);
  });

  it("shipped --active CSS rule present in default.css (STYLE-3 border-only)", () => {
    // TableRow's --active border-left rule uses var() → jsdom cannot compute
    // border-left-width; use a CSS-text grep for mutation coverage instead.
    expect(cssText).toMatch(/\.vms-table__row--active[^{]*\{[^}]*border-left:\s*3px\s+solid\s+var\(--vms-accent\)/);
  });

  it("SKIPS weight:600 primary-slot assertion (CONTEXT §Slot-mapping — no semantic primary slot)", () => {
    // Positive-absence assertion, per plan-checker R1 fix: TableRow ships
    // border-only STYLE-3 because a multi-cell row has no single primary
    // text slot to weight. Assert there is NO `.vms-table__row--active .*
    // { font-weight: 600 }` sibling rule in default.css.
    expect(cssText).not.toMatch(/\.vms-table__row--active\s+\.vms-table__[a-z_-]+\s*\{\s*font-weight:\s*600/);
  });

  it("state:done emits vms-table__row--done + applies opacity 0.6 (pre-existing)", () => {
    const el = renderAndGet(tableWith("done"));
    const tr = queryOr(el, "tbody tr.vms-table__row");
    expect(tr.classList.contains("vms-table__row--done")).toBe(true);
    // TableRow's pre-existing --done is opacity 0.6 (not 0.72 like the new
    // composites) — historical value, predates Phase 27, unchanged.
    expect(window.getComputedStyle(tr).opacity).toBe("0.6");
  });

  it("state:disabled emits vms-table__row--disabled + applies opacity 0.55", () => {
    const el = renderAndGet(tableWith("disabled"));
    const tr = queryOr(el, "tbody tr.vms-table__row");
    expect(tr.classList.contains("vms-table__row--disabled")).toBe(true);
    expect(window.getComputedStyle(tr).opacity).toBe("0.55");
  });

  it("unrecognized state value round-trips as class with no shipped rule", () => {
    const el = renderAndGet(tableWith("foobar"));
    const tr = queryOr(el, "tbody tr.vms-table__row");
    expect(tr.classList.contains("vms-table__row--foobar")).toBe(true);
    // TableRow's pre-existing --done (0.6), --disabled (0.55) are what a
    // stray rule could set; --foobar must land in NEITHER bucket. (jsdom
    // returns "" for CSS-unset opacity; visible browser default is 1.)
    const op = window.getComputedStyle(tr).opacity;
    expect(op).not.toBe("0.6");
    expect(op).not.toBe("0.55");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// (3) ListRowNode — REGRESSION for STYLE-3 unification (Plan 27-04)
// ══════════════════════════════════════════════════════════════════════════
// Before Phase 27 the rule was:
//   .vms-list-row--active { background: var(--vms-accent-glow); }
// Phase 27 (Plan 27-04) REPLACED with STYLE-3 border-color VARIANT:
//   .vms-list-row--active { border-left-color: var(--vms-accent); }
//   .vms-list-row--active .vms-list-row__primary { font-weight: 600; }
// The border-color variant is used because the base `.vms-list-row` rule
// at :1177 already reserves `border-left: 3px solid transparent` (Phase 24
// tone-axis mechanism). Coloring the existing border keeps the diff minimum
// AND avoids double-consuming the 3px (no padding-left compensation needed).
describe("ListRowNode — state axis (Phase 27) — REGRESSION for STYLE-3 unification", () => {
  it("no state → no --state class on the <li>", () => {
    const el = renderAndGet({
      type: "list",
      variant: "rows",
      children: [{ type: "list-row", primary: "Row" }],
    });
    const li = queryOr(el, "li.vms-list-row");
    const modifiers = li.className.split(" ").filter(c => c.startsWith("vms-list-row--"));
    expect(modifiers).toEqual([]);
  });

  it("state:active emits vms-list-row--active class", () => {
    const el = renderAndGet({
      type: "list",
      variant: "rows",
      children: [{ type: "list-row", primary: "Row", state: "active" }],
    });
    const li = queryOr(el, "li.vms-list-row");
    expect(li.classList.contains("vms-list-row--active")).toBe(true);
  });

  it("state:active applies STYLE-3 border-left-color = accent (color-only variant)", () => {
    // ListRow's shipped rule is `border-left-color: var(--vms-accent)` — the
    // color-only longhand form (unlike other composites which use the full
    // `border-left:` shorthand with var()). jsdom DOES resolve this longhand
    // → the raw var() string comes through in computed style.
    const el = renderAndGet({
      type: "list",
      variant: "rows",
      children: [{ type: "list-row", primary: "Row", state: "active" }],
    });
    const li = queryOr(el, "li.vms-list-row");
    expect(window.getComputedStyle(li).borderLeftColor).toBe("var(--vms-accent)");
  });

  it("REGRESSION: --active is border-left-color (NOT the old accent-glow background)", () => {
    // Positive-presence:
    expect(cssText).toMatch(/\.vms-list-row--active\s*\{\s*border-left-color:\s*var\(--vms-accent\)/);
    // Positive-ABSENCE of the old background rule (MIGRATION.md 8.0.x → 8.1.0).
    const activeRuleMatch = cssText.match(/\.vms-list-row--active\s*\{[^}]*\}/);
    expect(activeRuleMatch).not.toBeNull();
    expect(activeRuleMatch![0]).not.toMatch(/background:\s*var\(--vms-accent-glow\)/);
  });

  it("REGRESSION: --active applies weight:600 on __primary slot (via shipped CSS rule)", () => {
    // jsdom caveat #3: source-order cascade. `.vms-list-row__primary { font-
    // weight: 500 }` at :1214 comes AFTER `.vms-list-row--active .vms-list-
    // row__primary { font-weight: 600 }` at :1210, so jsdom's cascade returns
    // 500 (wrong per real-browser specificity, which would give 600). Assert
    // via CSS text grep instead — 100% mutation-testable.
    expect(cssText).toMatch(/\.vms-list-row--active\s+\.vms-list-row__primary\s*\{\s*font-weight:\s*600/);
  });

  it("state:done emits vms-list-row--done + applies opacity 0.72", () => {
    const el = renderAndGet({
      type: "list",
      variant: "rows",
      children: [{ type: "list-row", primary: "Row", state: "done" }],
    });
    const li = queryOr(el, "li.vms-list-row");
    expect(li.classList.contains("vms-list-row--done")).toBe(true);
    expect(window.getComputedStyle(li).opacity).toBe("0.72");
  });

  it("state:disabled emits vms-list-row--disabled + applies opacity 0.55", () => {
    const el = renderAndGet({
      type: "list",
      variant: "rows",
      children: [{ type: "list-row", primary: "Row", state: "disabled" }],
    });
    const li = queryOr(el, "li.vms-list-row");
    expect(li.classList.contains("vms-list-row--disabled")).toBe(true);
    expect(window.getComputedStyle(li).opacity).toBe("0.55");
  });

  it("unrecognized state value round-trips as class with no shipped rule", () => {
    const el = renderAndGet({
      type: "list",
      variant: "rows",
      children: [{ type: "list-row", primary: "Row", state: "foobar" }],
    });
    const li = queryOr(el, "li.vms-list-row");
    expect(li.classList.contains("vms-list-row--foobar")).toBe(true);
    // Base border-left is `3px solid transparent` — the "no shipped rule"
    // path leaves border-left-color at its base value.
    expect(window.getComputedStyle(li).borderLeftColor).toBe("rgba(0, 0, 0, 0)");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// (4) UserRowNode — v8.1.0 NET-NEW state? field + --active rule
// ══════════════════════════════════════════════════════════════════════════
describe("UserRowNode — state axis (Phase 27)", () => {
  const userRow = (state?: string): ViewNode => ({
    type: "user-row",
    name: "Ada",
    ...(state ? { state } : {}),
  });

  it("no state → no --state class on the <div>", () => {
    const el = renderAndGet(userRow());
    const row = queryOr(el, ".vms-user-row") as HTMLElement;
    const modifiers = row.className.split(" ").filter(c => c.startsWith("vms-user-row--"));
    expect(modifiers).toEqual([]);
  });

  it("state:active emits vms-user-row--active class", () => {
    const el = renderAndGet(userRow("active"));
    const row = queryOr(el, ".vms-user-row") as HTMLElement;
    expect(row.classList.contains("vms-user-row--active")).toBe(true);
  });

  it("state:active applies STYLE-3 in shipped default.css (border-left + padding-left compensation)", () => {
    // jsdom cannot compute border-left-width from the shorthand-with-var()
    // form; assert via CSS text grep. Padding-left compensation IS
    // computable (jsdom returns the raw calc() string).
    expect(cssText).toMatch(/\.vms-user-row--active\s*\{[^}]*border-left:\s*3px\s+solid\s+var\(--vms-accent\)/);
    expect(cssText).toMatch(/\.vms-user-row--active\s*\{[^}]*padding-left:\s*calc\(/);
    const el = renderAndGet(userRow("active"));
    const row = queryOr(el, ".vms-user-row") as HTMLElement;
    expect(window.getComputedStyle(row).paddingLeft).toContain("calc(");
  });

  it("state:active applies weight:600 on __name primary slot", () => {
    const el = renderAndGet(userRow("active"));
    const nameEl = queryOr(el, ".vms-user-row__name") as HTMLElement;
    expect(window.getComputedStyle(nameEl).fontWeight).toBe("600");
  });

  it("state:done emits vms-user-row--done + applies opacity 0.72", () => {
    const el = renderAndGet(userRow("done"));
    const row = queryOr(el, ".vms-user-row") as HTMLElement;
    expect(row.classList.contains("vms-user-row--done")).toBe(true);
    expect(window.getComputedStyle(row).opacity).toBe("0.72");
  });

  it("state:disabled emits vms-user-row--disabled + applies opacity 0.55", () => {
    const el = renderAndGet(userRow("disabled"));
    const row = queryOr(el, ".vms-user-row") as HTMLElement;
    expect(row.classList.contains("vms-user-row--disabled")).toBe(true);
    expect(window.getComputedStyle(row).opacity).toBe("0.55");
  });

  it("unrecognized state value round-trips as class with no shipped rule", () => {
    const el = renderAndGet(userRow("foobar"));
    const row = queryOr(el, ".vms-user-row") as HTMLElement;
    expect(row.classList.contains("vms-user-row--foobar")).toBe(true);
    // No shipped rule for --foobar; opacity must not match --done (0.72)
    // or --disabled (0.55). (jsdom returns "" for CSS-unset opacity;
    // visible browser default is 1.)
    const op = window.getComputedStyle(row).opacity;
    expect(op).not.toBe("0.72");
    expect(op).not.toBe("0.55");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// (5) MessageNode — v8.1.0 NET-NEW state? field + --active rule
// ══════════════════════════════════════════════════════════════════════════
// Additional coverage: multiplicative composition with `role` — a single
// wrapper carries BOTH `vms-message--assistant` AND `vms-message--active`
// simultaneously with no cascade collision (role tints the descendant
// content surface; state paints a left-accent border on the wrapper).
describe("MessageNode — state axis (Phase 27) — multiplicative role × state composition", () => {
  const message = (opts: { role?: "user" | "assistant" | "system"; state?: string } = {}): ViewNode => ({
    type: "message",
    author: "Ada",
    content: "Hello",
    ...opts,
  });

  it("no state → no --state class on the wrapper", () => {
    const el = renderAndGet(message());
    const wrap = queryOr(el, ".vms-message") as HTMLElement;
    const modifiers = wrap.className.split(" ")
      .filter(c => c.startsWith("vms-message--") && !["user","assistant","system"].some(r => c === "vms-message--" + r));
    expect(modifiers).toEqual([]);
  });

  it("state:active emits vms-message--active class", () => {
    const el = renderAndGet(message({ state: "active" }));
    const wrap = queryOr(el, ".vms-message") as HTMLElement;
    expect(wrap.classList.contains("vms-message--active")).toBe(true);
  });

  it("state:active applies STYLE-3 in shipped default.css (border-left no-padding variant)", () => {
    // Message is the STYLE-3 no-padding variant (base .vms-message has no
    // left padding to preserve) — grep for the border-left rule only.
    expect(cssText).toMatch(/\.vms-message--active\s*\{\s*border-left:\s*3px\s+solid\s+var\(--vms-accent\)/);
  });

  it("state:active applies weight:600 on __author primary slot", () => {
    const el = renderAndGet(message({ state: "active" }));
    const authorEl = queryOr(el, ".vms-message__author") as HTMLElement;
    expect(window.getComputedStyle(authorEl).fontWeight).toBe("600");
  });

  it("role:assistant + state:active composes BOTH classes on the wrapper (no cascade collision)", () => {
    // Multiplicative-composition assertion per plan spec: role tints the
    // descendant content surface, state paints the wrapper's border-left —
    // the two BEM modifiers stack on the same <div>.
    //
    // Mutation-check comment: if the state emission at browser.ts:1804
    // (`if (n.state) cls.push("vms-message--" + n.state);`) is removed,
    // this test fails (only the role class survives).
    const el = renderAndGet(message({ role: "assistant", state: "active" }));
    const wrap = queryOr(el, ".vms-message") as HTMLElement;
    expect(wrap.classList.contains("vms-message--assistant")).toBe(true);
    expect(wrap.classList.contains("vms-message--active")).toBe(true);
    // Both classes on the SAME element (not one on the wrapper, one on a
    // child) — grep the full className string.
    expect(wrap.className).toContain("vms-message--assistant");
    expect(wrap.className).toContain("vms-message--active");
  });

  it("state:done emits vms-message--done + applies opacity 0.72", () => {
    const el = renderAndGet(message({ state: "done" }));
    const wrap = queryOr(el, ".vms-message") as HTMLElement;
    expect(wrap.classList.contains("vms-message--done")).toBe(true);
    expect(window.getComputedStyle(wrap).opacity).toBe("0.72");
  });

  it("state:disabled emits vms-message--disabled + applies opacity 0.55", () => {
    const el = renderAndGet(message({ state: "disabled" }));
    const wrap = queryOr(el, ".vms-message") as HTMLElement;
    expect(wrap.classList.contains("vms-message--disabled")).toBe(true);
    expect(window.getComputedStyle(wrap).opacity).toBe("0.55");
  });

  it("unrecognized state value round-trips as class with no shipped rule", () => {
    const el = renderAndGet(message({ state: "foobar" }));
    const wrap = queryOr(el, ".vms-message") as HTMLElement;
    expect(wrap.classList.contains("vms-message--foobar")).toBe(true);
    // No shipped rule for --foobar; opacity must not match --done (0.72)
    // or --disabled (0.55). (jsdom returns "" for CSS-unset opacity.)
    const op = window.getComputedStyle(wrap).opacity;
    expect(op).not.toBe("0.72");
    expect(op).not.toBe("0.55");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// (6) DetailRowNode — v8.1.0 NET-NEW state? field + --active rule
// ══════════════════════════════════════════════════════════════════════════
describe("DetailRowNode — state axis (Phase 27)", () => {
  const detailRow = (state?: string): ViewNode => ({
    type: "detail-row",
    label: "Status",
    value: "Active",
    ...(state ? { state } : {}),
  });

  it("no state → no --state class on the <div>", () => {
    const el = renderAndGet(detailRow());
    const row = queryOr(el, ".vms-detail-row") as HTMLElement;
    const modifiers = row.className.split(" ").filter(c => c.startsWith("vms-detail-row--"));
    expect(modifiers).toEqual([]);
  });

  it("state:active emits vms-detail-row--active class", () => {
    const el = renderAndGet(detailRow("active"));
    const row = queryOr(el, ".vms-detail-row") as HTMLElement;
    expect(row.classList.contains("vms-detail-row--active")).toBe(true);
  });

  it("state:active applies STYLE-3 in shipped default.css (border-left + padding compensation)", () => {
    expect(cssText).toMatch(/\.vms-detail-row--active\s*\{[^}]*border-left:\s*3px\s+solid\s+var\(--vms-accent\)/);
    expect(cssText).toMatch(/\.vms-detail-row--active\s*\{[^}]*padding-left:\s*calc\(/);
    const el = renderAndGet(detailRow("active"));
    const row = queryOr(el, ".vms-detail-row") as HTMLElement;
    expect(window.getComputedStyle(row).paddingLeft).toContain("calc(");
  });

  it("state:active applies weight:600 on __value primary slot", () => {
    const el = renderAndGet(detailRow("active"));
    const valueEl = queryOr(el, ".vms-detail-row__value") as HTMLElement;
    expect(window.getComputedStyle(valueEl).fontWeight).toBe("600");
  });

  it("state:done emits vms-detail-row--done + applies opacity 0.72", () => {
    const el = renderAndGet(detailRow("done"));
    const row = queryOr(el, ".vms-detail-row") as HTMLElement;
    expect(row.classList.contains("vms-detail-row--done")).toBe(true);
    expect(window.getComputedStyle(row).opacity).toBe("0.72");
  });

  it("state:disabled emits vms-detail-row--disabled + applies opacity 0.55", () => {
    const el = renderAndGet(detailRow("disabled"));
    const row = queryOr(el, ".vms-detail-row") as HTMLElement;
    expect(row.classList.contains("vms-detail-row--disabled")).toBe(true);
    expect(window.getComputedStyle(row).opacity).toBe("0.55");
  });

  it("unrecognized state value round-trips as class with no shipped rule", () => {
    const el = renderAndGet(detailRow("foobar"));
    const row = queryOr(el, ".vms-detail-row") as HTMLElement;
    expect(row.classList.contains("vms-detail-row--foobar")).toBe(true);
    // No shipped rule for --foobar; opacity must not match --done (0.72)
    // or --disabled (0.55). (jsdom returns "" for CSS-unset opacity.)
    const op = window.getComputedStyle(row).opacity;
    expect(op).not.toBe("0.72");
    expect(op).not.toBe("0.55");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// (7) TimelineEntryNode — v8.1.0 NET-NEW state? field + --active rule
// ══════════════════════════════════════════════════════════════════════════
// Ashley locked STYLE-3 (not STYLE-6 bg-tint fallback) — the `::before` dot
// lives at `left: -1.5rem` external to the entry box, so the border-left at
// `left: 0` doesn't collide (Plan 27-04 key-decisions).
// No padding-left compensation (base .vms-timeline-entry has only padding-
// bottom).
describe("TimelineEntryNode — state axis (Phase 27) — STYLE-3 (Ashley lock: border-left, no bg-tint fallback)", () => {
  const timelineWith = (state?: string): ViewNode => ({
    type: "timeline",
    children: [{
      type: "timeline-entry",
      time: "12:00",
      description: "Event happened",
      ...(state ? { state } : {}),
    }],
  });

  it("no state → no --state class on the <li>", () => {
    const el = renderAndGet(timelineWith());
    const entry = queryOr(el, "li.vms-timeline-entry") as HTMLElement;
    const modifiers = entry.className.split(" ").filter(c => c.startsWith("vms-timeline-entry--"));
    expect(modifiers).toEqual([]);
  });

  it("state:active emits vms-timeline-entry--active class", () => {
    const el = renderAndGet(timelineWith("active"));
    const entry = queryOr(el, "li.vms-timeline-entry") as HTMLElement;
    expect(entry.classList.contains("vms-timeline-entry--active")).toBe(true);
  });

  it("state:active applies STYLE-3 in shipped default.css (border-left no-padding variant)", () => {
    // Timeline is the STYLE-3 no-padding variant (base has only padding-
    // bottom) — grep for the border-left rule only.
    expect(cssText).toMatch(/\.vms-timeline-entry--active\s*\{\s*border-left:\s*3px\s+solid\s+var\(--vms-accent\)/);
  });

  it("state:active applies weight:600 on __description primary slot", () => {
    const el = renderAndGet(timelineWith("active"));
    const descEl = queryOr(el, ".vms-timeline-entry__description") as HTMLElement;
    expect(window.getComputedStyle(descEl).fontWeight).toBe("600");
  });

  it("state:done emits vms-timeline-entry--done + applies opacity 0.72", () => {
    const el = renderAndGet(timelineWith("done"));
    const entry = queryOr(el, "li.vms-timeline-entry") as HTMLElement;
    expect(entry.classList.contains("vms-timeline-entry--done")).toBe(true);
    expect(window.getComputedStyle(entry).opacity).toBe("0.72");
  });

  it("state:disabled emits vms-timeline-entry--disabled + applies opacity 0.55", () => {
    const el = renderAndGet(timelineWith("disabled"));
    const entry = queryOr(el, "li.vms-timeline-entry") as HTMLElement;
    expect(entry.classList.contains("vms-timeline-entry--disabled")).toBe(true);
    expect(window.getComputedStyle(entry).opacity).toBe("0.55");
  });

  it("unrecognized state value round-trips as class with no shipped rule", () => {
    const el = renderAndGet(timelineWith("foobar"));
    const entry = queryOr(el, "li.vms-timeline-entry") as HTMLElement;
    expect(entry.classList.contains("vms-timeline-entry--foobar")).toBe(true);
    // No shipped rule for --foobar; opacity must not match --done (0.72)
    // or --disabled (0.55). (jsdom returns "" for CSS-unset opacity.)
    const op = window.getComputedStyle(entry).opacity;
    expect(op).not.toBe("0.72");
    expect(op).not.toBe("0.55");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// (8) SettingRowNode — v8.1.0 NET-NEW state? field + --active rule
// ══════════════════════════════════════════════════════════════════════════
describe("SettingRowNode — state axis (Phase 27)", () => {
  const settingRow = (state?: string): ViewNode => ({
    type: "setting-list",
    children: [{
      type: "setting-row",
      label: "Notifications",
      ...(state ? { state } : {}),
    }],
  });

  it("no state → no --state class on the <li>", () => {
    const el = renderAndGet(settingRow());
    const row = queryOr(el, "li.vms-setting-row") as HTMLElement;
    const modifiers = row.className.split(" ").filter(c => c.startsWith("vms-setting-row--"));
    expect(modifiers).toEqual([]);
  });

  it("state:active emits vms-setting-row--active class", () => {
    const el = renderAndGet(settingRow("active"));
    const row = queryOr(el, "li.vms-setting-row") as HTMLElement;
    expect(row.classList.contains("vms-setting-row--active")).toBe(true);
  });

  it("state:active applies STYLE-3 in shipped default.css (border-left + padding compensation)", () => {
    expect(cssText).toMatch(/\.vms-setting-row--active\s*\{[^}]*border-left:\s*3px\s+solid\s+var\(--vms-accent\)/);
    expect(cssText).toMatch(/\.vms-setting-row--active\s*\{[^}]*padding-left:\s*calc\(/);
    const el = renderAndGet(settingRow("active"));
    const row = queryOr(el, "li.vms-setting-row") as HTMLElement;
    expect(window.getComputedStyle(row).paddingLeft).toContain("calc(");
  });

  it("state:active applies weight:600 on __label primary slot", () => {
    const el = renderAndGet(settingRow("active"));
    const labelEl = queryOr(el, ".vms-setting-row__label") as HTMLElement;
    expect(window.getComputedStyle(labelEl).fontWeight).toBe("600");
  });

  it("state:done emits vms-setting-row--done + applies opacity 0.72", () => {
    const el = renderAndGet(settingRow("done"));
    const row = queryOr(el, "li.vms-setting-row") as HTMLElement;
    expect(row.classList.contains("vms-setting-row--done")).toBe(true);
    expect(window.getComputedStyle(row).opacity).toBe("0.72");
  });

  it("state:disabled emits vms-setting-row--disabled + applies opacity 0.55", () => {
    const el = renderAndGet(settingRow("disabled"));
    const row = queryOr(el, "li.vms-setting-row") as HTMLElement;
    expect(row.classList.contains("vms-setting-row--disabled")).toBe(true);
    expect(window.getComputedStyle(row).opacity).toBe("0.55");
  });

  it("unrecognized state value round-trips as class with no shipped rule", () => {
    const el = renderAndGet(settingRow("foobar"));
    const row = queryOr(el, "li.vms-setting-row") as HTMLElement;
    expect(row.classList.contains("vms-setting-row--foobar")).toBe(true);
    // No shipped rule for --foobar; opacity must not match --done (0.72)
    // or --disabled (0.55). (jsdom returns "" for CSS-unset opacity.)
    const op = window.getComputedStyle(row).opacity;
    expect(op).not.toBe("0.72");
    expect(op).not.toBe("0.55");
  });
});

// ══════════════════════════════════════════════════════════════════════════
// (9) ChipNode — WIRE ONLY, NO SHIPPED --active RULE (guardrail)
// ══════════════════════════════════════════════════════════════════════════
// Chip is the ONE composite in this suite whose `state?: string` field
// ships WITHOUT a shipped `--active` CSS rule. Per CONTEXT §Out-of-scope:
// a tinted-pill shape doesn't map to STYLE-3's border-left convention
// (chips have no border-left convention, and the pill IS the primary). The
// field ships for wire uniformity per the typed-slots pattern; `--done` and
// `--disabled` opacity rules DO ship per Ashley's lock (mirrors ListRow
// precedent).
//
// This describe block is the guardrail that prevents a future maintainer
// from accidentally adding a `.vms-chip--active { ... }` rule without
// deliberate design work. If someone adds such a rule, the "NO shipped
// --active rule" grep assertion fails immediately.
describe("ChipNode — state axis (Phase 27) — WIRE ONLY, NO SHIPPED --active RULE (guardrail)", () => {
  const chip = (state?: string): ViewNode => ({
    type: "chip",
    label: "filter",
    ...(state ? { state } : {}),
  });

  it("state:active emits vms-chip--active class (wire uniformity)", () => {
    // The class DOES ship — the wire field round-trips per the typed-slots
    // pattern. Only the CSS rule is deferred.
    const el = renderAndGet(chip("active"));
    const span = queryOr(el, ".vms-chip") as HTMLElement;
    expect(span.classList.contains("vms-chip--active")).toBe(true);
  });

  it("state:active applies NO --active-specific CSS effect (deferred per CONTEXT §Out-of-scope)", () => {
    // Guardrail: render TWO chips, one with state:"active", one without.
    // Their computed styles must be IDENTICAL — proving that NO shipped
    // --active rule differentiates them. If a future maintainer adds
    // `.vms-chip--active { ... }` (any property) without deliberate design
    // work, this test FAILS.
    const base = renderAndGet(chip());
    const active = renderAndGet(chip("active"));
    const baseSpan = queryOr(base, ".vms-chip") as HTMLElement;
    const activeSpan = queryOr(active, ".vms-chip") as HTMLElement;
    const csBase = window.getComputedStyle(baseSpan);
    const csActive = window.getComputedStyle(activeSpan);
    // Compare the properties a hypothetical --active rule would most
    // naturally touch: border, background, opacity, font-weight, padding.
    // IDENTICAL across the pair proves no shipped rule applies.
    const propsToCheck = [
      "border-left-width", "border-left-color", "border-left-style",
      "background-color", "background-image",
      "opacity", "font-weight",
      "padding-left", "padding-right", "padding-top", "padding-bottom",
    ] as const;
    for (const prop of propsToCheck) {
      expect(
        csActive.getPropertyValue(prop),
        `Chip base and Chip[state=active] must have IDENTICAL ${prop} — a shipped .vms-chip--active rule would break this guardrail. Deferred per CONTEXT §Out-of-scope; requires deliberate design work to unlock.`,
      ).toBe(csBase.getPropertyValue(prop));
    }
  });

  it("NO shipped .vms-chip--active rule in default.css (guardrail grep)", () => {
    // Positive-absence assertion: grep the loaded stylesheet for any
    // `.vms-chip--active { ... }` rule block. If one appears (via a future
    // refactor that didn't consult CONTEXT §Out-of-scope), this fails.
    //
    // The default.css DOES contain the string ".vms-chip--active" inside an
    // inline CSS comment block that documents the intentional omission
    // (see the Plan 27-04 SUMMARY key-decisions and the shipped comment at
    // default.css:~1856). To distinguish comment mentions from a real rule
    // declaration, assert absence of the RULE SYNTAX form:
    // `.vms-chip--active {` (with only whitespace before the opening brace,
    // possibly on the next line — but NOT preceded by an unclosed `/*`).
    //
    // Simplest robust form: strip block comments first, then grep.
    const cssWithoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(cssWithoutComments).not.toMatch(/\.vms-chip--active[^_\w-][^{]*\{/);
  });

  it("state:done emits vms-chip--done + applies opacity 0.72 (--done DOES ship per Ashley lock)", () => {
    const el = renderAndGet(chip("done"));
    const span = queryOr(el, ".vms-chip") as HTMLElement;
    expect(span.classList.contains("vms-chip--done")).toBe(true);
    expect(window.getComputedStyle(span).opacity).toBe("0.72");
  });

  it("state:disabled emits vms-chip--disabled + applies opacity 0.55 (--disabled DOES ship per Ashley lock)", () => {
    const el = renderAndGet(chip("disabled"));
    const span = queryOr(el, ".vms-chip") as HTMLElement;
    expect(span.classList.contains("vms-chip--disabled")).toBe(true);
    expect(window.getComputedStyle(span).opacity).toBe("0.55");
  });

  it("unrecognized state value round-trips as class with no shipped rule", () => {
    const el = renderAndGet(chip("foobar"));
    const span = queryOr(el, ".vms-chip") as HTMLElement;
    expect(span.classList.contains("vms-chip--foobar")).toBe(true);
    // No shipped rule for --foobar; opacity must not match --done (0.72)
    // or --disabled (0.55). (jsdom returns "" for CSS-unset opacity.)
    const op = window.getComputedStyle(span).opacity;
    expect(op).not.toBe("0.72");
    expect(op).not.toBe("0.55");
  });
});
