---
phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
plan: 03
subsystem: ui

tags: [viewmodel-shell, composite-nodes, typed-slots, state-axis, browser-renderer, bem-emission]

# Dependency graph
requires:
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    provides: Plan 27-01 landed the 6 `state?: string` TS wire fields on UserRowNode/MessageNode/DetailRowNode/TimelineEntryNode/SettingRowNode/ChipNode — TypeScript needs those field declarations before it will resolve `n.state` in the renderer.
provides:
  - Six new BEM state-class emission sites in viewmodel-shell/src/browser.ts (userRow, detailRow, timelineEntry, settingRow, chip, message renderers)
  - Each emission follows the ListRowNode:1171 golden pattern verbatim: `if (n.state) cls.push(\`vms-{composite}--${n.state}\`);`
  - Consistent classList position across all 8 shipped composites (list-row, list-item, table-row + the 6 wired here): state class pushed AFTER any `--{tone}`/`--{role}` push and BEFORE any `--clickable`/`--has-trailing` push, so downstream Plan 27-04 CSS specificity is predictable
  - Emission coverage closed on 7 of 9 composites via the `if (n.state) cls.push(...)` pattern; ListItemNode (line 1983) uses an inline template-literal variant, TableRow (line 4544) uses string concatenation — both were shipped pre-Phase-27 with equivalent BEM output, no touch needed
affects: [27-04 (lands the CSS rules the emitted classes match), 27-05 (asserts the emission via vitest), 27-08 (verifies visual composition on the tailnet page)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BEM state-class emission pattern (uniform across 7 composite renderers): `if (n.state) cls.push(\`vms-{composite}--${n.state}\`);` — template literal, positioned AFTER any tone/role push, BEFORE any clickable/has-trailing push"

key-files:
  created: []
  modified:
    - "viewmodel-shell/src/browser.ts (6 new one-line BEM state-class emissions, +6 lines net; no other logic changed in these renderers)"

key-decisions:
  - "Placement per composite follows the plan's ordering rule verbatim — state class pushed AFTER any `--{tone}` or `--{role}` push (so tone/role comes first in classList, matching ListRow) and BEFORE any `--clickable` / `--has-trailing` / role-specific push. This gives a stable classList position for `.vms-{composite}--{state}` across all 8 composites, so the shipped CSS in Plan 27-04 has predictable specificity behavior across the whole composite family."
  - "MessageNode's state emission goes on the outer `<div class=\"vms-message\">` wrapper (line 1804), composing multiplicatively with the shipped `.vms-message--{role}` class on the same element. Verified via the CSS structure: both are single-hyphen-double-hyphen BEM modifiers on the same element with no descendant cascade collision — matches the Plan 27-01 TSDoc annotation on MessageNode.state."
  - "TimelineEntry's state emission goes on the outer `<li class=\"vms-timeline-entry\">` element (line 1536). The class composes with the shipped `.vms-timeline-entry--{tone}::before` rail-dot rule; Plan 27-04 owns the pixel-geometry decision (STYLE-3 border-left survivability vs STYLE-6 bg-tint fallback) noted in the Phase 27 CONTEXT §specifics TimelineEntry note."
  - "No changes to ListItemNode (:1983 already emits via inline template literal) or TableRow (:4544 already emits via string concatenation). Both were shipped pre-Phase-27 with equivalent BEM output; adding a redundant `if (n.state) cls.push(...)` next to the existing emission would double-emit. Scope stays exactly the 6 new sites the plan mandated."

patterns-established:
  - "Wiring a composite's typed-slot axis field through to a BEM class on the outer element: mirror the ListRowNode:1171 pattern verbatim; place per the ordering rule (after tone/role modifiers, before interaction modifiers); one line per site; verify via `grep -c 'if (n.state) cls.push(\`vms-'`."

requirements-completed: [STATE-AXIS-EMIT]

# Metrics
duration: 4min
completed: 2026-07-30
---

# Phase 27 Plan 03: Composite state axis browser.ts emission Summary

**Wired the BEM class emission for `state?` on the 6 v8 composite renderers (userRow / detailRow / timelineEntry / settingRow / chip / message) in `viewmodel-shell/src/browser.ts`, mirroring the shipped ListRowNode:1171 pattern verbatim and following the plan's per-composite ordering rule — closing the wire→render gap between Plan 27-01's TS field additions and Plan 27-04's forthcoming CSS rules.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-30 (session-local; wall clock ~20:13 UTC)
- **Completed:** 2026-07-30 (session-local; wall clock ~20:16 UTC)
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Six new one-line BEM state-class emission sites added to `viewmodel-shell/src/browser.ts`, one per composite renderer, using the golden ListRowNode:1171 pattern (`if (n.state) cls.push(\`vms-{composite}--${n.state}\`);`).
- Placement per composite verified against the plan's ordering rule: state push AFTER any `--{tone}` / `--{role}` push and BEFORE any `--clickable` / `--has-trailing` push, so classList position of `.vms-{composite}--{state}` is uniform across all 8 shipped composites.
- TypeScript build (`npm run build` in `viewmodel-shell/`) succeeds — the emissions are pure string manipulation reading the `n.state` field Plan 27-01 added; no other logic paths touched.
- Core-globals guard (`npm run check:core-globals`) passes — additions introduce no new platform globals (className is a string property; no DOM/storage/network access added).
- Full vitest suite passes: 1251 passed | 1 skipped across 78 test files (unchanged from pre-plan baseline; the additive emissions don't touch any assertion path).
- File isolation confirmed: `git status --short` shows only `M viewmodel-shell/src/browser.ts` for tracked-file modifications from this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add 6 BEM state-class emission lines to browser.ts composite renderers** — `93186e2` (feat)

**Insertion sites (post-edit line numbers):**

| Composite         | Renderer entry | `if (n.state)` line | Placement rule satisfied                                    |
|-------------------|---------------:|--------------------:|-------------------------------------------------------------|
| ListRowNode       |         (~1149) |              1171   | (pre-existing; the golden template)                        |
| UserRowNode       |           1293 |              1301   | AFTER `standalone` push, BEFORE `--clickable` push          |
| DetailRowNode     |           1456 |              1461   | AFTER `--tone` push                                         |
| TimelineEntryNode |           1530 |              1536   | AFTER `--tone` push                                         |
| SettingRowNode    |           1620 |              1626   | AFTER `const cls =`, BEFORE `--clickable` push              |
| ChipNode          |           1737 |              1745   | AFTER `--tone` push, BEFORE `--clickable` push              |
| MessageNode       |           1795 |              1804   | AFTER `--role` push, BEFORE `wrap.className = cls.join(...)` |

Existing state emissions using DIFFERENT patterns (unchanged by this plan):

- Line 1983 — ListItemNode: `\`vms-list-item${n.state ? \` vms-list-item--${n.state}\` : ""}\`` (inline template literal in className assignment)
- Line 4544 — TableRow: `if (row.state) rowClass += \` vms-table__row--${row.state}\`;` (string concatenation into a running rowClass)

Both are equivalent-output pre-Phase-27 emissions and were correctly left untouched.

**Plan metadata commit:** _will be created as the final commit in this session (SUMMARY.md + STATE.md + ROADMAP.md)_

## Files Created/Modified

- `viewmodel-shell/src/browser.ts` — 6 new state-class emission lines added, one per composite renderer. +6 lines net. No other logic in any of these renderers was modified.

## Verification Evidence

**Grep verification (after edits) — count = 1 pre-existing + 6 new = 7 total:**

```
$ cd viewmodel-shell && grep -c 'if (n.state) cls.push(`vms-' src/browser.ts
7

$ cd viewmodel-shell && grep -n 'if (n.state) cls.push(`vms-' src/browser.ts
1171:    if (n.state) cls.push(`vms-list-row--${n.state}`);
1301:    if (n.state) cls.push(`vms-user-row--${n.state}`);
1461:    if (n.state) cls.push(`vms-detail-row--${n.state}`);
1536:    if (n.state) cls.push(`vms-timeline-entry--${n.state}`);
1626:    if (n.state) cls.push(`vms-setting-row--${n.state}`);
1745:    if (n.state) cls.push(`vms-chip--${n.state}`);
1804:    if (n.state) cls.push(`vms-message--${n.state}`);
```

All 6 required BEM prefixes present with the exact `${n.state}` template-literal interpolation.

**Ordering verification (context from source):**

- **userRow** (:1299-1302): `["vms-user-row"]` → `!isInList` standalone → `state` → `--clickable` → `--has-trailing` ✓
- **detailRow** (:1458-1461): `["vms-detail-row"]` → `--tone` → `state` ✓ (no `--clickable` push in this renderer)
- **timelineEntry** (:1532-1536): `["vms-timeline-entry"]` → `--tone` → `state` ✓
- **settingRow** (:1622-1626): `["vms-setting-row"]` → `state` → `--clickable` ✓ (no `--tone` push in this renderer)
- **chip** (:1739-1745): `["vms-chip"]` → `--tone` → `state` → `--clickable` ✓
- **message** (:1797-1804): `["vms-message"]` → `--role` → `state` → `wrap.className = cls.join(" ")` ✓

**Build verification:**

```
$ cd viewmodel-shell && npm run build
> @ashley-shrok/viewmodel-shell@8.0.3 build
> tsc -b tsconfig.tui.json
(clean exit; no diagnostics)
```

**Core-globals guard:**

```
$ cd viewmodel-shell && npm run check:core-globals
> @ashley-shrok/viewmodel-shell@8.0.3 check:core-globals
> node scripts/check-core-platform-globals.mjs

✓ AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals.
```

**Vitest suite (unchanged from pre-plan baseline):**

```
$ cd viewmodel-shell && npm test
 Test Files  78 passed (78)
      Tests  1251 passed | 1 skipped (1252)
   Start at  20:14:27
   Duration  2.78s
```

**File isolation (post-task-commit, pre-SUMMARY commit):**

```
$ git status --short
 M viewmodel-shell/src/browser.ts   # (this plan's only tracked-file mod, committed in 93186e2)
?? .planning/phases/27-.../.gitkeep # planning artifacts — untracked, matching Plans 27-01/27-02 posture
?? .planning/phases/27-.../27-01-PLAN.md ... 27-11-PLAN.md
?? .planning/phases/27-.../27-CONTEXT.md
?? .vite/                          # pre-existing dev cache (unrelated)
```

Only `viewmodel-shell/src/browser.ts` was modified by this plan (staged and committed in `93186e2`). The Phase 27 planning artifacts (PLAN files + CONTEXT) are untracked — Plans 27-01 and 27-02 followed the same posture, so this plan maintains that convention.

## Decisions Made

- **Followed the plan's placement rules verbatim** for all 6 renderers. UserRow got state between `standalone` and `--clickable` (no `--tone` axis on UserRow). Message got state between `--role` and `wrap.className = cls.join(" ")` (no `--tone` axis; `role` serves the surface-tint concept). DetailRow, TimelineEntry, and Chip got state immediately after `--tone` (Chip additionally before `--clickable`). SettingRow got state between `const cls = ...` and `--clickable` (no `--tone` axis).
- **Did NOT touch ListItemNode (:1983) or TableRow (:4544)**. Both were shipped pre-Phase-27 with equivalent BEM output; ListItem uses an inline template-literal variant baked into its `className` assignment, TableRow uses string concatenation into a running `rowClass`. Adding a redundant `if (n.state) cls.push(...)` next to either would double-emit the class. The plan's scope was precisely the 6 new sites — the existing 2 shipped patterns for state emission were correctly left untouched.
- **The `grep -c` count came out as 7 (1 pre-existing ListRow + 6 new)**, matching the plan's acceptance criterion exactly. Because ListItem and TableRow use different emission patterns, they don't fall in this grep, and that's expected — this plan measures the `cls.push` pattern specifically to prove the 6 new sites conform to the golden ListRow shape.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All 6 edits landed on first pass; grep, build, core-globals, and vitest all passed on the first attempt.

## User Setup Required

None - no external service configuration required. Purely additive TypeScript renderer changes.

## Next Phase Readiness

- **27-04** (lands the CSS rules `.vms-{composite}--{state}` for `--active` and optional `--done` / `--disabled` on the 6 new composites, plus unifies the existing 3 to STYLE-3) is unblocked by this plan — the BEM classes it needs to style are now being emitted on the shipped renderers.
- **27-05** (vitest assertions for BEM class emission per composite) is unblocked — the assertions can now test the presence of `vms-{composite}--{state}` on rendered DOM.
- **27-08** (tailnet verification page) will need this emission in place for the "same state value renders visually consistent across 8 composites" side-by-side to actually render the state class per composite.
- No blockers. Additive emission; existing tests all pass.

## Self-Check: PASSED

Verified after write:

- **Grep count = 7 matching `if (n.state) cls.push(\`vms-` in browser.ts** — verified via `grep -c`.
- **6 new distinct BEM prefixes present** — verified via `grep -n`: `vms-user-row--`, `vms-detail-row--`, `vms-timeline-entry--`, `vms-setting-row--`, `vms-chip--`, `vms-message--`.
- **`npm run build` clean** — no TypeScript diagnostics; the emissions resolve `n.state` correctly via the field additions Plan 27-01 landed.
- **`npm run check:core-globals` green** — no new platform globals introduced.
- **`npm test` unchanged from baseline** — 1251 passed | 1 skipped; additive emissions don't affect any assertion.
- **Task 1 commit exists** — `93186e2 feat(27-03): emit BEM state class on 6 composite renderers in browser.ts` — verified via `git log --oneline -1`.

---
*Phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a*
*Completed: 2026-07-30*
