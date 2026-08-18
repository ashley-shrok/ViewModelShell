---
phase: 33-column-filter-expansion-phase-2-adapter-ui-popover-slash-thr
plan: "04"
subsystem: browser-adapter / filter-tests
tags: [filter, popover, adapter-tests, jsdom, mutation-verify, tdd]
dependency_graph:
  requires:
    - "33-01 — BrowserAdapter filter-row rebuild (popover + portal + icon state grammar)"
    - "33-02 — old wire field removal (filterAction/filterable/filterValue/filterBinds)"
  provides:
    - "filter-adapter.test.ts: 49 tests covering all 8 D-06 scenario groups"
    - "Mutation-verify session documented (outside-click discard vs commit)"
  affects:
    - viewmodel-shell/test/filter-adapter.test.ts
    - viewmodel-shell/src/browser.ts
tech_stack:
  added: []
  patterns:
    - "jsdom + BrowserAdapter + mutable StateAccess double (per adapter.test.ts precedent)"
    - "Popover click via btn.click() + document fireMousedown for outside-click"
    - "Popover content re-query after renderFilterPopoverContent re-renders (joiner toggle)"
    - "fakeRect via vi.spyOn(el, 'getBoundingClientRect') for positioning assertions"
key_files:
  created:
    - viewmodel-shell/test/filter-adapter.test.ts
  modified:
    - viewmodel-shell/src/browser.ts
decisions:
  - "Rule 1 auto-fix: portal re-append after innerHTML wipe (see Deviations below)"
  - "Joiner toggle test re-queries popoverEl after renderFilterPopoverContent re-renders (stale-ref guard)"
  - "Escalated state test uses is-empty single rule — computeFilterState correctly classifies it as escalated"
metrics:
  duration: ~45 minutes
  completed: 2026-08-18T18:27:00Z
  tasks_completed: 1
  files_changed: 2
---

# Phase 33 Plan 04: Filter Adapter Test Suite Summary

**One-liner:** 49-test jsdom + BrowserAdapter suite covering all 8 D-06 scenario groups for the Phase 33 filter UI grammar, with mutation-verify session proving the outside-click discard path is genuinely tested.

## What Was Built

### Task 1: filter-adapter.test.ts (commit a042ad4)

New file `viewmodel-shell/test/filter-adapter.test.ts` (900 lines). Uses jsdom + `new BrowserAdapter(container)` + mutable `StateAccess` double (same setup pattern as `src/adapter.test.ts`).

**Test structure — 7 describe blocks, 49 tests:**

| Block | Scenarios | Tests |
|-------|-----------|-------|
| A — REQ-CF2-01: Always-visible input + type-and-enter | D-06(a), D-06(d) | 5 |
| B — REQ-CF2-02: Icon state grammar | D-06(e) | 5 |
| C — REQ-CF2-03: Popover vocabulary per kind | D-06(c) partial | 8 |
| D — REQ-CF2-04 + D-06(f,g): Popover interactions | D-06(b,c,f,g) | 16 |
| E — REQ-CF2-05: Portal + keyboard | D-06(h) | 5 |
| F — REQ-CF2-06: Inline read-only summary | D-06(e) partial | 6 |
| G — Additional behavioral assertions | aria, multi-column, re-render | 4 |

**All 8 D-06 scenario groups covered:**

- **(a) Type-and-enter contains flow** — Describe A: typing into inline input writes `{rules:[{operator:"contains",value:...}],joiner:"all-of"}` to state via StateAccess; Enter also writes; no named action dispatched.
- **(b) Escalate-via-popover multi-condition** — Describe D: open popover, set first rule value, Add Rule, set second rule value, Apply — state receives 2-rule descriptor. Apply does NOT dispatch a named action.
- **(c) Is-empty on each of 5 value-kinds** — Describe D: 5 dedicated tests (text/number/date/fixed-set/yes-no); each verifies that after setting operator to "is-empty" and clicking Apply, the descriptor has `{operator:"is-empty"}` with no value field.
- **(d) Contains on non-string kind** — Describe A: date column, type "2026" + Enter → state has `{operator:"contains",value:"2026"}`. Proves the inline input is always text and the filter-adapter does not restrict the contains operator to text columns.
- **(e) Icon state transitions** — Describe B: empty (filter-slash glyph detected via `<line>` element in SVG), simple (no `<line>`, no `.vms-filter-dot`), escalated (no `<line>`, `.vms-filter-dot` present). Also Describe F for the editable/read-only boundary.
- **(f) Popover pre-load from inline** — Describe D: state has `{rules:[{operator:"contains",value:"foo"}]}` → open popover → first rule op-select reads "contains", value input reads "foo".
- **(g) Discard-on-outside-click, discard-on-Escape, apply-on-Apply, clear-commits-empty** — Describe D: 4 dedicated tests. Discard path fires `fireMousedown(document.body)`; Escape path fires `document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape"}))`. Apply commits; Clear writes null.
- **(h) Keyboard flow** — Describe E: Escape closes + button aria-expanded is "false"; Tab order verified via DOM position (opSel precedes valInp in querySelectorAll); Enter in inline input does not open popover.

**Portal escape test:** Describe E verifies the `.vms-popover-portal` div is a direct child of the container and NOT inside `.vms-table__wrapper`, confirming the portal mechanism escapes the table wrapper overflow clip.

**Mutation-verify session:** See the dedicated section below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed popoverPortal disappearing after innerHTML wipe in browser.ts**

- **Found during:** Task 1 — first test run, 25 out of 49 tests failed with `openPopover()` returning null.
- **Issue:** `BrowserAdapter.render()` does `this.container.innerHTML = ""` on every render. This wipes ALL container children, including the `popoverPortal` div appended in the constructor. After the first `render()` call, `this.popoverPortal` was detached — `container.querySelector(".vms-filter-popover")` found nothing and `openFilterPopover`'s `this.popoverPortal.appendChild(popoverEl)` appended into a detached node that was invisible to the container's DOM tree.
- **The Plan 01 comment** ("popoverPortal survives the innerHTML wipe — it's a sibling of the table wrapper, not inside the wiped subtree") was **wrong** — the portal IS inside the container and IS wiped. The Plan 01 adapter tests passed only because Plan 01 had no popover-open tests; this plan was the first to exercise the popover path.
- **Fix:** In `render()`, immediately after `this.container.innerHTML = ""`, re-append the portal: `this.container.appendChild(this.popoverPortal)`. This brings the portal back into the live DOM before `this.node(vm, ...)` runs, so the filter row click handler's `openFilterPopover` appends correctly into a connected portal.
- **Files modified:** `viewmodel-shell/src/browser.ts` — 3-line insertion after `this.container.innerHTML = ""`
- **Commit:** a042ad4 (included in the same commit as the test file)

**2. [Rule 1 - Bug] Fixed stale joiner-toggle reference in test**

- **Found during:** Task 1 — joiner toggle test returned wrong `.active` class state.
- **Issue:** After clicking OR in the joiner toggle, `renderFilterPopoverContent` re-renders the popover's innerHTML. The pre-click `joinerDiv` and `orBtn` references pointed at detached DOM nodes. The re-rendered OR button had `.active` but the test was checking the old (detached) button.
- **Fix:** After the OR click, re-query `popoverEl.querySelector(".vms-filter-joiner")` and find the fresh buttons in the re-rendered content.
- **Files modified:** `viewmodel-shell/test/filter-adapter.test.ts` — joiner toggle test updated

## Mutation-Verify Session

**Purpose:** REQ-CF2-10 requires that reverting the outside-click-discard handler to "commit-on-outside-click" makes at least one test go red. This proves the discard-on-outside-click test is not a false positive.

**Mutation applied:**

In `browser.ts`, changed the outside-click handler from:
```typescript
const outsideClickHandler = (e: Event) => {
  if (!popoverEl.contains(e.target as Node) && e.target !== button) {
    this.closeFilterPopover(true);  // discard
    button.focus();
```
To (mutation):
```typescript
const outsideClickHandler = (e: Event) => {
  if (!popoverEl.contains(e.target as Node) && e.target !== button) {
    this.closeFilterPopover(false);  // MUTATION: commit instead of discard
    const mutDraft = this.filterDrafts.get(bindPath);
    if (mutDraft) this.sa.write(bindPath, mutDraft);
    button.focus();
```

**Result with mutation:**
```
Tests  1 failed | 48 passed (49)

× D — REQ-CF2-04 + D-06(f,g): Popover interactions
  > (g) discard-on-outside-click: clicking outside discards the draft; state is unchanged
```

The test `"(g) discard-on-outside-click: clicking outside discards the draft; state is unchanged"` went red exactly as required. The assertion `expect(afterVal).toBe(beforeVal)` failed because the mutation wrote the draft to state instead of discarding it.

**Revert:** Mutation reverted; all 49 tests pass again.

**Conclusion:** The outside-click discard path is genuinely tested. The test would catch a developer accidentally changing `closeFilterPopover(true)` to `closeFilterPopover(false)` or adding a `sa.write` call after the close.

## Self-Check

Files confirmed to exist:
- `viewmodel-shell/test/filter-adapter.test.ts` — 900 lines

Commits verified:
- `a042ad4` — "test(33-04): add filter-adapter.test.ts — 8 D-06 scenario groups + portal re-append fix"

Local gate results:
- `npx vitest run test/filter-adapter.test.ts` → 49 passed (exit 0)
- `npx vitest run` → 88 test files, 1610 passed, 1 skipped (exit 0)
- `npm run check:test-types` → exit 0

## Self-Check: PASSED

All artifacts present and all local gates green.

## Commits

| Task | Commit | Message | Files |
|------|--------|---------|-------|
| 1 | a042ad4 | test(33-04): add filter-adapter.test.ts — 8 D-06 scenario groups + portal re-append fix | test/filter-adapter.test.ts, src/browser.ts |
