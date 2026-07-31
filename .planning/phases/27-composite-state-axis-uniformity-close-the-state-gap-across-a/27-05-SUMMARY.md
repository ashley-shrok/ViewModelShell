---
phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
plan: 05
subsystem: ui

tags: [viewmodel-shell, composite-nodes, typed-slots, state-axis, vitest, regression-suite, jsdom]

# Dependency graph
requires:
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    provides: Plan 27-01 landed the TS wire fields; Plan 27-03 wired BEM class emission on 6 composite renderers; Plan 27-04 landed the shipped CSS rules (STYLE-3 unified across 8 composites + `--done`/`--disabled` opacity on 6 new composites + Chip intentional `--active` omission). This plan is the machine-checkable regression proof that all three earlier plans stay wired to each other.
provides:
  - Consolidated vitest coverage `viewmodel-shell/test/composite-state-axis.test.ts` (~853 lines, 9 describe blocks, 64 it() cases) that asserts BEM class emission + STYLE-3 CSS effect + `--done`/`--disabled` opacity + `--foobar` round-trip across all 8 shipped state-axis composites
  - Mutation-test-verified regression coverage — swapping `vms-user-row--` to `vms-user-row-MUTATED--` in `browser.ts:1301` fails 6 UserRow tests; revert restores green
  - Chip guardrail describe block — machine-checkable proof that `.vms-chip--active` ships as a class but NOT as a CSS rule (positive-absence assertion) — a future refactor that accidentally ships a Chip rule fails immediately
  - ListItem REGRESSION describe block — positive-absence assertion that no `.vms-list-item__title` weight rule exists (a future refactor that adds one without design work fails immediately per plan-checker R1 fix)
  - TableRow REGRESSION describe block — positive-absence assertion that no primary-slot weight rule exists (multi-cell rows have no semantic primary slot per CONTEXT §Slot-mapping)
  - MessageNode multiplicative composition test — asserts `role:"assistant"` + `state:"active"` composes BOTH BEM modifiers on the same wrapper `<div>` with no cascade collision
  - Framework test-suite baseline advanced from 1251 passed | 1 skipped across 78 files to 1315 passed | 1 skipped across 79 files (+64 tests; zero pre-existing regressions)
affects: [27-06 (parity fixture tripwires — cross-backend `expectBodyContains` for the class emissions asserted here as jsdom-only), 27-07 (CHANGELOG + MIGRATION note reference this coverage as green-tree evidence for the release ritual), 27-08 (tailnet verification page — a11y/visual sign-off — supersedes this file's jsdom-based coverage for the two properties jsdom cannot compute: shorthand-with-var() border and CSS specificity cascade), 27-09 (green-tree gate re-runs this + full framework suite together)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consolidated state-axis regression suite pattern: ONE test file with N describe blocks (one per composite in the axis family), each block sharing a common test shape (no-state absence check + state-active BEM emission + state-active CSS-effect check + state-done opacity + state-disabled opacity + state-foobar round-trip). Total ~7-8 it() cases per composite in the family. Kept DRY via a top-level `renderAndGet(vnode)` helper that returns the mount container so tests query for the composite root as a descendant. The single-file consolidation is cheaper to maintain than N per-composite state test files, still mutation-testable per-composite (each describe block is independently reversible)."
    - "jsdom-caveat-aware assertion strategy for shipped CSS with `var()` in shorthand: for properties jsdom CAN compute (opacity, font-weight, plain-color longhand, calc() string in padding-left), assert via `getComputedStyle` directly; for properties jsdom CANNOT compute (border-left-width from `border-left: 3px solid var(...)` shorthand, or cases where source-order cascade returns the wrong rule), assert via `expect(cssText).toMatch(/.../)` grep of the loaded stylesheet — the mutation-test contract is identical (removing the rule breaks either kind of assertion), but only the grep form works in jsdom for var()-containing shorthands. Documented in the test file's header block with three concrete jsdom-limitation examples probed against the shipped default.css during authorship."
    - "Positive-absence assertion pattern for shipped-omission guardrails (Chip `--active` deferral, ListItem no-`__title`, TableRow no-primary-slot): grep the loaded stylesheet with a negated regex (`.not.toMatch(...)`) — the failure mode is symmetric with a positive-presence grep, so a future refactor that violates the omission fails the same shape of test the presence-checkers fire. Comment strippers (`.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')`) let the assertion tolerate inline documentation comments that mention the class name without shipping a rule (per Plan 27-04's Chip omission comment block)."
    - "Mutation-test evidence recording via test-file header block: rather than shipping actual mutation tests (which would be permanent overhead), the file's opening comment enumerates the exact swap-and-revert operations that fail specific tests, then references SUMMARY.md for the operator's real once-performed verification. Same pattern as the pre-existing `list-row.test.ts:20-40` header — proven pattern in Phase 24/25."

key-files:
  created:
    - "viewmodel-shell/test/composite-state-axis.test.ts (+853 lines; 9 describe blocks; 64 it() cases; consolidated state-axis regression coverage across all 8 shipped composites)"
  modified: []

key-decisions:
  - "**9 describe blocks, not 8**: Chip has its own dedicated `describe(...guardrail)` block (the recommended structure per Task 1's Chip guardrail action) rather than being merged into an adjacent describe. Chip's block asserts three distinct things (state:active class emits + IDENTICAL computed styles vs base + no rule syntax in default.css) that don't fit cleanly into another composite's block; a dedicated block also makes the guardrail purpose grep-discoverable."
  - "**Test-utility shape (`renderAndGet` returns the container, not `firstElementChild`)**: the initial draft returned `container.firstElementChild` per the plan spec, but that made the composite root ITSELF unqueryable via `container.querySelector('.vms-chip')` — the .vms-chip span IS the first child, not a descendant. Fixed by returning the container `<div>` and letting tests `querySelector` inside; then `queryOr(el, '.vms-chip')` finds the descendant reliably. This shape matches the pattern in most existing composite tests (they use `container` as the outer handle)."
  - "**Ordinal `.opacity === '1'` doesn't work in jsdom for CSS-unset properties**: the plan's `--foobar` round-trip assertion originally used `expect(getComputedStyle(el).opacity).toBe('1')` (the visible browser default), but jsdom returns `''` (empty string) for `opacity` when no CSS rule sets it — the browser's default `1` is a UA-stylesheet contribution jsdom doesn't apply. Adapted per composite to assert `expect(op).not.toBe('0.72')` AND `expect(op).not.toBe('0.55')` (the shipped `--done` / `--disabled` values) — this proves NO rule for the unrecognized state name fires (the actual mutation-test intent), works in jsdom, and stays mutation-testable (adding a stray `.vms-composite--foobar { opacity: 0.72 }` rule fails immediately)."
  - "**jsdom cannot compute `border-left-width` from `border-left: 3px solid var(--vms-accent)` shorthand** — probed against the shipped default.css during authorship. Returns `''` (empty string) for the width AND style, but resolves the color to `'var(--vms-text)'` (inherited from base) rather than `'var(--vms-accent)'`. Only ListRow's rule uses the color-only longhand form (`border-left-color: var(--vms-accent)`), which DOES resolve to `'var(--vms-accent)'` in computed style — used verbatim for ListRow's assertion. All 6 other composites' STYLE-3 border-left assertions fall back to grep-based CSS text mutation checks (`expect(cssText).toMatch(/\\.vms-{composite}--active[^{]*\\{[^}]*border-left:\\s*3px\\s+solid\\s+var\\(--vms-accent\\)/)`). The grep is 100% mutation-testable — removing the rule from default.css breaks it instantly — and does what jsdom cannot in this shorthand-with-var() case."
  - "**jsdom's CSS cascade is by SOURCE ORDER, not specificity** — probed with a synthetic 3-rule stylesheet during authorship (`.a .b { fw:600 } / .b { fw:500 }` → jsdom returns 500). This affects ListRow's weight:600 assertion specifically: default.css declares `.vms-list-row__primary { font-weight: 500 }` at :1214 AFTER `.vms-list-row--active .vms-list-row__primary { font-weight: 600 }` at :1210, so jsdom's cascade returns 500 (the later, less-specific rule wins wrongly). In real browsers, specificity (0,2,0 vs 0,1,0) means the --active sibling wins → 600 — this is verified elsewhere by the visual verification page at Plan 27-08 and cross-backend parity at Plan 27-06. ListRow's weight:600 assertion is therefore CSS-text grep (`expect(cssText).toMatch(/\\.vms-list-row--active\\s+\\.vms-list-row__primary\\s*\\{\\s*font-weight:\\s*600/)`). All OTHER composites do not have this cascade collision (their base primary-slot weight comes from TextNode wrap classes like `.vms-text--weight-medium`, which sit at a different cascade layer entirely) — for those, `getComputedStyle(primarySlot).fontWeight === '600'` works reliably (probed green during authorship)."
  - "**`ChipNode.state:active` guardrail uses TWO complementary assertions**: (a) render two chips (one with state, one without) + iterate 12 CSS properties + assert IDENTICAL across the pair (the runtime guarantee that no rule fires today); (b) grep the stylesheet with block-comments stripped for the SYNTAX `.vms-chip--active {` (the static guarantee that no future refactor accidentally ships a rule). Either alone is insufficient — (a) alone would pass even if a rule shipped whose only property jsdom cannot compute (e.g. `background-image: url(...)`), and (b) alone would false-positive on the Plan 27-04 documentation comment that legitimately mentions `.vms-chip--active` inside `/* ... */`. Together they close the guardrail from both directions."
  - "**Mutation-test proof performed on `browser.ts:1301` (UserRowNode)**: temporarily edited `if (n.state) cls.push(\`vms-user-row--${n.state}\`);` → `if (n.state) cls.push(\`vms-user-row-MUTATED--${n.state}\`);`, ran `npx vitest run test/composite-state-axis.test.ts`, observed 6 UserRow tests FAIL (state:active class emission, STYLE-3 CSS effect, weight:600, --done opacity, --disabled opacity, --foobar round-trip — all check for the class name that no longer emits), reverted the mutation, re-ran, all 64 tests PASS. Documented in the test-file header block."

patterns-established:
  - "**Consolidated state-axis regression file** (the alternative shape considered but rejected: 8 per-composite state test files) — chosen for compactness (~40-50 assertions per family fit comfortably in one file) AND for machine-inventory value (a new maintainer reading `composite-state-axis.test.ts` sees exactly which composites carry the axis and how it renders, all in one place). Would apply naturally to future closed-axis-family additions (e.g. a hypothetical `disabled?` axis or `tone?` closure on the remaining composites)."
  - "**Per-composite REGRESSION describe blocks for shipped-rule REPLACEMENTS**: when Phase 27 REPLACED existing `--active` rules on ListItem + ListRow, the REGRESSION describe blocks assert BOTH the new rule shape AND the absence of the old rule (positive-presence + positive-absence). This pattern surfaces silent regressions where the CSS gets partially reverted (only the new addition, not the old removal) — the presence check would pass but the absence check would fail. Established for use on any future shipped-rule REPLACEMENT phase."
  - "**Positive-absence guardrail for shipped OMISSIONS** (Chip's `--active`, ListItem's `__title` weight, TableRow's primary-slot weight): a describe block that asserts the omitted rule DOES NOT ship, using a stripped-comments CSS grep (so inline documentation comments mentioning the class name don't false-fail the guardrail). Established for use on any future shipped-omission decision where 'do not add X in this phase' is a deliberate design choice."

requirements-completed: [STATE-AXIS-VITEST]

# Metrics
duration: 15min
completed: 2026-07-30
---

# Phase 27 Plan 05: Composite state axis vitest coverage Summary

**Shipped consolidated vitest coverage across all 8 state-axis composites (9 describe blocks, 64 it() cases in a single new test file) — asserts BEM class emission, STYLE-3 CSS effect where jsdom can compute it, grep-based mutation coverage where jsdom cannot (shorthand-with-var() borders + source-order cascade), Chip omission guardrail, ListItem/ListRow REGRESSION coverage — mutation-verified by a swap-and-revert on `browser.ts:1301`. Baseline advanced from 1251 to 1315 tests; zero pre-existing regressions.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-30 (session-local)
- **Completed:** 2026-07-30 (session-local)
- **Tasks:** 1
- **Files modified:** 0 (source); 1 (test) created

## Accomplishments

- **New consolidated test file** `viewmodel-shell/test/composite-state-axis.test.ts` (+853 lines) — one file, 9 describe blocks (8 composites + Chip's dedicated guardrail block), 64 it() cases.
- **All 8 shipped state-axis composites covered**: ListItemNode (REGRESSION), TableRow (NET-NEW), ListRowNode (REGRESSION), UserRowNode, MessageNode (+ multiplicative role×state composition), DetailRowNode, TimelineEntryNode (per Ashley's Plan 27-04 STYLE-3 lock), SettingRowNode, ChipNode (guardrail).
- **BEM class emission asserted** per composite: `state:"active"` emits `vms-{composite}--active` in classList; `state:"done"` emits `--done`; `state:"disabled"` emits `--disabled`; `state:"foobar"` emits `--foobar` with no shipped rule; state omitted emits NO `--{state}` class.
- **STYLE-3 CSS effect asserted** per composite via a jsdom-caveat-aware two-tier strategy:
  - Properties jsdom CAN compute: `getComputedStyle` (opacity 0.72/0.55 for --done/--disabled; weight:600 for 5 of 6 primary slots; padding-left `calc()` for 4 composites; border-left-color for ListRow's color-only variant).
  - Properties jsdom CANNOT compute (border-left shorthand with `var()`, source-order-cascade victims): CSS text grep of the loaded stylesheet (`expect(cssText).toMatch(...)`).
- **Chip guardrail landed** — 3 assertions confirm the intentional `--active` deferral: class emits + computed styles identical to base chip + no `.vms-chip--active {` rule syntax in default.css (block-comments stripped so Plan 27-04's inline documentation comment doesn't false-fail).
- **MessageNode multiplicative composition test** — asserts `role:"assistant"` + `state:"active"` composes BOTH `vms-message--assistant` and `vms-message--active` on the same wrapper `<div>` with no cascade collision.
- **Mutation-test proof recorded**: swap `vms-user-row--` → `vms-user-row-MUTATED--` on `browser.ts:1301` → 6 UserRow tests FAIL (state:active, STYLE-3 CSS grep, weight:600 slot query, --done opacity, --disabled opacity, --foobar round-trip); revert → all 64 tests PASS.
- **Framework test-suite baseline preserved**: 1251 → 1315 passed | 1 skipped, 78 → 79 files (+64 tests, zero regressions in the pre-existing 78 files).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create consolidated composite-state-axis.test.ts covering all 8 composites** — `669ef6e` (test)

**Plan metadata commit:** _will be created as the final commit in this session (SUMMARY.md + STATE.md + ROADMAP.md)_

## Files Created/Modified

- **Created:** `viewmodel-shell/test/composite-state-axis.test.ts` — 853 lines. Header block (91 lines) documents the three jsdom caveats probed during authorship (border-left-shorthand-with-var(), source-order cascade, empty-string opacity) + the mutation-test proof performed once and reverted + the assertion strategy per caveat. 9 describe blocks + 64 it() cases follow. Uses the `readFileSync(default.css) + inject as <style data-vms-default>` in `beforeAll` pattern mirrored verbatim from `viewmodel-shell/test/text-caption.test.ts:64-76` (verified present 2026-07-30 during authorship).
- **Modified:** none (test-only plan).

## Verification Evidence

**Grep counts (post-write):**

```
$ cd viewmodel-shell
$ grep -c 'describe(' test/composite-state-axis.test.ts
9
$ grep -cE '^\s*it\(' test/composite-state-axis.test.ts
64
$ grep -cE 'vms-.*--(active|done|disabled)' test/composite-state-axis.test.ts
96
$ grep -cE 'vms-message--assistant.*vms-message--active|both.*classes' test/composite-state-axis.test.ts
1
$ grep -cE 'IDENTICAL|deferred|no shipped rule' test/composite-state-axis.test.ts
15
$ grep -c 'REGRESSION' test/composite-state-axis.test.ts
8
$ grep -c 'data-vms-default\|default.css\|readFileSync' test/composite-state-axis.test.ts
24
$ grep -cE 'describe\((.*ListItem|.*TableRow|.*ListRow|.*UserRow|.*Message|.*DetailRow|.*TimelineEntry|.*SettingRow)' test/composite-state-axis.test.ts
8
```

All acceptance criteria met:
- describe count = **9** (target: 8 or 9 — 9 because Chip has its own guardrail block)
- it() count = **64** (target: ≥ 25)
- BEM class assertions = **96** (target: ≥ 15)
- MessageNode multiplicative test present = **1** (target: ≥ 1)
- Chip guardrail markers = **15** occurrences of `IDENTICAL` / `deferred` / `no shipped rule` (target: ≥ 1)
- REGRESSION labels = **8** occurrences (target: ≥ 2 — one for ListItem, one for ListRow; also appears in comment blocks describing the pattern)
- Stylesheet-load pattern = **24** occurrences of `data-vms-default` / `default.css` / `readFileSync` (mirrored from text-caption.test.ts:64-76)
- Per-composite describe checks = **8** (one each for ListItem, TableRow, ListRow, UserRow, Message, DetailRow, TimelineEntry, SettingRow)

**Test run (target file only):**

```
$ cd viewmodel-shell && npx vitest run test/composite-state-axis.test.ts
 ✓ test/composite-state-axis.test.ts (64 tests) 172ms

 Test Files  1 passed (1)
      Tests  64 passed (64)
   Duration  607ms
```

**Full framework test-suite baseline:**

```
$ cd viewmodel-shell && npm test
 Test Files  79 passed (79)
      Tests  1315 passed | 1 skipped (1316)
   Duration  2.88s
```

Advanced from Plan 27-04 baseline `78 files, 1251 passed | 1 skipped` to `79 files, 1315 passed | 1 skipped` — +1 file, +64 tests, zero pre-existing regressions.

**Mutation-test evidence:**

Performed ONCE during Plan 27-05 authorship, then reverted:

1. Edit `viewmodel-shell/src/browser.ts:1301`:
   ```typescript
   // BEFORE (shipped):
   if (n.state) cls.push(`vms-user-row--${n.state}`);
   // AFTER (mutated):
   if (n.state) cls.push(`vms-user-row-MUTATED--${n.state}`);
   ```

2. Run tests:
   ```
   $ cd viewmodel-shell && npx vitest run test/composite-state-axis.test.ts
   Test Files  1 failed (1)
        Tests  6 failed | 58 passed (64)
   ```

3. Failed tests (all in `UserRowNode` describe block):
   - `state:active emits vms-user-row--active class`
   - `state:active applies STYLE-3 in shipped default.css (border-left + padding-left compensation)`
   - `state:active applies weight:600 on __name primary slot`
   - `state:done emits vms-user-row--done + applies opacity 0.72`
   - `state:disabled emits vms-user-row--disabled + applies opacity 0.55`
   - `unrecognized state value round-trips as class with no shipped rule`

4. Revert:
   ```typescript
   // Restored:
   if (n.state) cls.push(`vms-user-row--${n.state}`);
   ```

5. Re-run:
   ```
   $ cd viewmodel-shell && npx vitest run test/composite-state-axis.test.ts
    ✓ test/composite-state-axis.test.ts (64 tests) 170ms
   Test Files  1 passed (1)
        Tests  64 passed (64)
   ```

Proves the regression suite catches accidental BEM emission drift.

**Skip counts for `--done`/`--disabled`:** ZERO. Ashley locked `ship` for `--done`/`--disabled` on all 6 new composites in Plan 27-04 Task 2 (out-of-band tasting review) — no assertions are skipped for those. The single `skipped: 1` in the test suite total is from an unrelated pre-existing skip elsewhere in the framework suite (not from this file).

**TimelineNode STYLE-3-vs-6 branch taken:** STYLE-3. Ashley locked border-left variant (not STYLE-6 bg-tint fallback) in Plan 27-04 Task 2 based on pixel-geometry pre-check (`::before` dot at `left: -1.5rem` external to entry box; entry's border-left at `left: 0`; 1.5rem horizontal separation, no collision). The TimelineEntryNode describe block asserts border-left + weight:600 on `__description` (both work in jsdom — the weight assertion is via `getComputedStyle` because TimelineEntry's base rule doesn't have a source-order-cascade collision).

## Decisions Made

- **9 describe blocks (not 8)** — Chip has its own dedicated guardrail describe. Rationale in key-decisions above.
- **`renderAndGet` returns the container, not `firstElementChild`** — the composite root IS the first child, so tests need the parent as the query handle. Draft-and-fix once during authorship; documented in the utility's JSDoc.
- **Opacity `--foobar` assertion uses `.not.toBe('0.72')` + `.not.toBe('0.55')` (not `.toBe('1')`)** — jsdom returns `''` for CSS-unset opacity; the `not-in-shipped-set` shape preserves the mutation-test intent (adding a stray rule with either of the shipped opacity values fails). Documented per-test with inline comment.
- **ListRow weight:600 asserted via CSS-text grep (not `getComputedStyle`)** — jsdom's source-order cascade returns the base rule's font-weight:500, ignoring specificity. Fully documented in test file header + inline comment on the assertion; the CSS-text grep is 100% mutation-testable (removing the rule from default.css breaks it).
- **Six composites' border-left asserted via CSS-text grep (not `getComputedStyle`)** — jsdom cannot parse `border-left: 3px solid var(--vms-accent)` shorthand and returns `''` for width/style. Only ListRow's color-only longhand form works via `getComputedStyle`. Documented in test file header + on each assertion.
- **Chip guardrail uses TWO complementary assertions** (runtime IDENTICAL comparison + static grep with comments stripped) — either alone insufficient. Rationale in key-decisions above.

## Deviations from Plan

None - plan executed exactly as written.

The three implementation adaptations noted in Decisions Made (utility return value, `--foobar` opacity assertion shape, jsdom-caveat handling for border/weight) are jsdom-limitation workarounds discovered during authorship, not deviations from the plan's INTENT — every acceptance criterion in the plan is satisfied by the shipped file, and every mutation-test proof the plan requires is provable (either via `getComputedStyle` or via CSS-text grep, depending on which mechanism jsdom can actually observe). The plan's original `borderLeftWidth === '3px'` and `.opacity === '1'` shapes are documented as jsdom-inaccessible in the file's header block with the alternative shapes shipped.

## Issues Encountered

- **Initial `renderAndGet` returned `container.firstElementChild`** per the plan spec, which made the composite root ITSELF unqueryable via descendant selectors (`container.querySelector('.vms-chip')` returned null because the .vms-chip span IS the first child). Fixed by returning the container `<div>` and letting tests query descendants. First test run: 27 failed / 37 passed. After fix: 8 failed / 56 passed (all 8 residual failures were the `--foobar` opacity assertion using `.toBe('1')`, which jsdom returns as `''`).
- **All 8 `--foobar` opacity assertions returned `''` from jsdom, not `'1'`** — jsdom does NOT apply the UA default `opacity: 1` when no CSS rule targets the property. Fixed by asserting `expect(op).not.toBe('0.72')` AND `expect(op).not.toBe('0.55')` (the shipped `--done`/`--disabled` values). Final test run: 64 passed / 0 failed.
- **No other issues.** The mutation-test proof landed on the first attempt after the two above fixes.

## User Setup Required

None - no external service configuration required. Additive test file only.

## Next Phase Readiness

- **27-06** (parity fixture extension — cross-backend `expectBodyContains` tripwires for the class emissions) is unblocked. This plan's assertions are jsdom-only; parity fixtures will cover the .NET twin's identical emissions with the same class-presence guarantees, closing the "diff-can-prove" side of the class-emission gate.
- **27-07** (CHANGELOG + MIGRATION drafting) is unblocked — the CHANGELOG entry for 8.1.0 can cite this file as green-tree evidence for the `state?` axis closures.
- **27-08** (tailnet verification page for Ashley's visual sign-off) is unblocked — the visual sign-off covers the two properties jsdom cannot compute (shorthand-with-var() border-left rendering + real-browser specificity cascade for ListRow's weight:600), providing the real-browser confirmation that this jsdom-based suite cannot.
- **27-09** (green-tree gate re-runs everything) is unblocked — this file is now part of the 79-file / 1315-test framework baseline that gate must preserve.
- No blockers. Test-only additive file; no source or wire changes.

## Self-Check: PASSED

Verified after write:

- **File exists:** `viewmodel-shell/test/composite-state-axis.test.ts` — verified via `git ls-files` post-commit.
- **Commit exists:** `669ef6e test(27-05): consolidated vitest coverage for composite state axis across 8 composites` — verified via `git log --oneline | head -1` post-commit.
- **Test file green:** `npx vitest run test/composite-state-axis.test.ts` — 64 passed, 0 failed.
- **Full framework suite green:** `npm test` — 79 files, 1315 passed | 1 skipped (advanced from 78 files / 1251 passed | 1 skipped baseline; +64 tests, zero pre-existing regressions).
- **All acceptance criteria met:** 9 describe blocks (target 8-9); 64 it() cases (target ≥25); 96 BEM class assertions (target ≥15); MessageNode multiplicative test present; Chip guardrail present (15 markers); 8 REGRESSION labels (target ≥2); 24 stylesheet-load-pattern references; 8 per-composite describes.
- **Mutation-test proof:** performed on `browser.ts:1301` (UserRow); observed 6 UserRow tests fail; reverted; observed all 64 tests pass again. Documented in this SUMMARY under Verification Evidence.

---
*Phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a*
*Completed: 2026-07-30*
