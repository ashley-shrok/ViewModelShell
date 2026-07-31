---
phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
plan: 04
subsystem: ui

tags: [viewmodel-shell, composite-nodes, typed-slots, state-axis, css, design-system, style-3]

# Dependency graph
requires:
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    provides: Plan 27-01 landed the 6 `state?: string` TS wire fields on the 6 v8 composites. Plan 27-03 wired the BEM class emission (`vms-{composite}--${n.state}`) on those 6 renderers. This plan lands the shipped CSS rules that style the emitted classes.
provides:
  - Unified STYLE-3 `--active` rendering across 8 shipped composites (ListItem + TableRow + ListRow + UserRow + Message + DetailRow + TimelineEntry + SettingRow) — left-border accent + primary-text weight:600 where a semantic primary slot exists; border-only variant where it doesn't (ListItem, TableRow)
  - 2 pre-existing rules REPLACED (ListItem, ListRow) — documented visual change for `state:"active"` consumers on 8.0.x → 8.1.0 (MIGRATION.md flag)
  - 1 NET-NEW pre-existing composite rule (TableRow — the class was emitted but rendered unstyled pre-Phase-27)
  - 5 NET-NEW composite `--active` rules (UserRow, Message, DetailRow, TimelineEntry, SettingRow) — first shipped `--active` styling for the 5 Phase-25 composites that had no prior state-axis rule
  - 6 NET-NEW `--done` (opacity 0.72) + 6 NET-NEW `--disabled` (opacity 0.55) rules across UserRow, Message, DetailRow, TimelineEntry, SettingRow, Chip — mirrors ListRow precedent at :1188-1189
  - Chip `--active` INTENTIONALLY NOT SHIPPED (deferred per CONTEXT §Out-of-scope); inline CSS comment documents the "ship field + BEM class + `--done`/`--disabled` opacity, but no `--active`" posture for future maintainers
affects: [27-05 (asserts CSS emission via vitest — the rules under test now exist), 27-06 (parity fixture tripwires can now expect the composed `.vms-{composite}--active` classes to be present on rendered DOM), 27-07 (CHANGELOG + MIGRATION note the ListItem + ListRow visual replacements), 27-08 (tailnet verification page for Ashley's visual sign-off — the 2×8 grid now shows the unified visual across all 8 composites)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "STYLE-3 shipped `--active` uniformity: `border-left: 3px solid var(--vms-accent)` on the composite's wrapper + `.vms-{composite}__{primary-slot} { font-weight: 600 }` where a semantic primary slot exists. Padding-left is compensated (`calc(var(--vms-space-md) - 3px)`) where the base rule has left padding to preserve; omitted where the base has no left padding (Message grid wrapper, Timeline entry with only padding-bottom); replaced by `border-left-color:` alone where the base already reserved a 3px transparent border (ListRow)."
    - "Border-only STYLE-3 variant: `border-left: 3px solid var(--vms-accent)` with NO weight:600 sibling rule — for composites without a semantic primary text slot (ListItem: renders content inline into `<li>` with no dedicated primary-text class; TableRow: multi-cell rows have no single primary text slot per CONTEXT §Slot-mapping)."
    - "Lifecycle opacity uniformity: `--done` = opacity 0.72; `--disabled` = opacity 0.55. Applied per composite alongside the `--active` rule. Mirrors the shipped ListRow precedent at default.css:1188-1189 rather than inventing per-composite tokens."
    - "Documented intentional omission via inline CSS comment: Chip ships `--done`/`--disabled` opacity AND the wire field AND the BEM emission, but ships NO `--active` rule this phase — a tinted-pill shape doesn't map to STYLE-3's border-left convention. Future maintainers see the deferral inline in the shipped stylesheet."

key-files:
  created: []
  modified:
    - "viewmodel-shell/styles/default.css (+113 / -4 lines; 2 pre-existing `--active` rules REPLACED with STYLE-3; 1 net-new TableRow `--active`; 5 net-new composite `--active` rule pairs; 12 net-new opacity rules for the 6 new composites' `--done`/`--disabled`; 1 Chip omission-documentation comment block)"

key-decisions:
  - "Task 1 (audit re-verification) was performed OUT-OF-BAND by the orchestrator (Vicky) against HEAD — greps confirmed every row of the plan's `<interfaces>` pre-computed decision map, no divergence found. This plan's SUMMARY records the confirmation but the executor did not re-run the greps as a separate task commit; skipping the audit-only step preserves the single-CSS-write atomic commit shape the plan intends."
  - "Task 2 (Ashley checkpoint) was performed OUT-OF-BAND by the orchestrator — Ashley reviewed a served tasting page and locked `author, style-3, ship`: MessageNode primary-slot = `__author` (identity/who over content/what); TimelineEntry = STYLE-3 (border-left + description weight:600) chosen over STYLE-6 bg-tint fallback based on pixel-geometry pre-check (`::before` dot at `left: -1.5rem` external to entry box; entry's border-left at `left: 0`; 1.5rem horizontal separation, no collision); `--done`/`--disabled` = ship on all 6 new composites per ListRow precedent (extends the lifecycle vocabulary uniformly)."
  - "ListItem's STYLE-3 shipped the BORDER-ONLY VARIANT (no `__title` weight:600 rule) because the ListItem renderer (browser.ts:1970-2000) emits no dedicated primary-text slot class — content goes into the `<li>` root as text nodes / child ViewNodes with only `.vms-list-item__marker` for ordered/checklist markers. This is a slot-mapping OVERRIDE vs. CONTEXT §Slot-mapping (which named `.vms-list-item__title` as the target); the interfaces map already predicted the override, and the border-only variant matches TableRow's own exception rationale."
  - "ListRow's STYLE-3 uses `border-left-color: var(--vms-accent)` INSTEAD of a full `border-left: 3px solid var(--vms-accent)` because the base rule at :1177 already reserved `border-left: 3px solid transparent` (Phase 24 tone-axis mechanism). Coloring the existing border keeps the diff minimum-touch AND avoids double-consuming the 3px (no padding-left compensation needed — the space was already claimed). Consequence: the `grep -c 'border-left: 3px solid var(--vms-accent)'` count is 7 (not 8), because ListRow legitimately uses `border-left-color` instead."
  - "Timeline shipped STYLE-3 (per Ashley's Task 2 lock) — NOT the STYLE-6 bg-tint fallback. Base `.vms-timeline-entry` has ONLY `padding-bottom` (no left padding), so no compensation was applied — the 3px border simply consumes 3px of the entry's leading edge and content reflows accordingly; the shipped `::before` dot lives at `left: -1.5rem` (external to the entry box), unaffected by the border-left."
  - "Message shipped STYLE-3 no-padding variant + `__author` weight:600. Base `.vms-message` is a grid wrapper with NO left padding to preserve, so no compensation was applied. The `--active` rule composes multiplicatively with the shipped `.vms-message--{role}` classes on the same wrapper (`.vms-message--assistant.vms-message--active` renders BOTH role-tinted content surface AND active left border) — verified no cascade collision (state paints the wrapper; role tints the descendant content surface)."
  - "All 6 new composites received `--done` (0.72) + `--disabled` (0.55) opacity rules mirroring the ListRow precedent at :1188-1189 (Ashley picked `ship` in Task 2). Chip is the only one of the 6 that received these WITHOUT a paired `--active` — the `--active` deferral is intentional and documented inline."

patterns-established:
  - "Shipping a unified state-axis look across a composite family: pick ONE shipped affordance shape (STYLE-3 = border-left + weight:600 on primary-slot), apply per composite honoring each base rule's existing left-padding + border-left posture, and document per-composite variance (border-only where no primary slot exists; border-color-only where base already reserves the border; no compensation where base has no left padding). The `<interfaces>` pre-computed decision map is the artifact that carries the per-composite variance into a single-write task."
  - "Documenting intentional shipped-CSS omissions inline: when a composite legitimately ships the wire field + BEM class emission BUT ships NO rule for a particular state token (Chip + `--active`), an inline CSS comment at the composite's rule block records the deferral rationale so a future maintainer inspecting the stylesheet sees the intent immediately (not just in the CONTEXT / design doc)."

requirements-completed: [STATE-AXIS-CSS-UNIFY]

# Metrics
duration: 6min
completed: 2026-07-31
---

# Phase 27 Plan 04: Composite state axis CSS uniformity Summary

**Unified `--active` rendering to STYLE-3 across 8 shipped composites (border-left accent + primary-slot weight:600), replaced 2 legacy `--active` rules on ListItem + ListRow (documented 8.0.x → 8.1.0 visual change), added 1 net-new TableRow rule + 5 net-new composite rules per Ashley's tasting selection, shipped `--done`/`--disabled` opacity uniformly on the 6 new composites — closing the visual half of the state-axis gap this phase set out to close.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-31 (session-local)
- **Completed:** 2026-07-31 (session-local)
- **Tasks:** 1 executed (Task 3 CSS write; Tasks 1-2 completed out-of-band by orchestrator)
- **Files modified:** 1 (viewmodel-shell/styles/default.css: +113 / -4 lines)

## Accomplishments

- **7 composites shipped STYLE-3 border-left `--active`**: ListItem, Message, UserRow, DetailRow, TimelineEntry, SettingRow, TableRow — each carrying the shipped `border-left: 3px solid var(--vms-accent)` with per-composite compensation math per the interfaces decision map. 1 additional composite (ListRow) shipped the `border-left-color` variant because its base rule already reserved a 3px transparent border. **All 8 shipped composites now render `state:"active"` with the same visual affordance** (border-left accent + weight:600 on primary slot where one exists).
- **2 pre-existing `--active` rules REPLACED with STYLE-3**: ListItem (was `border-color: var(--vms-accent); background: var(--vms-accent-glow);`) and ListRow (was `background: var(--vms-accent-glow);`) — the ONE documented visual change to shipped 8.0.x consumers per CONTEXT §Q3. MIGRATION.md will carry the before/after snapshot at Plan 27-10.
- **1 net-new TableRow `--active` rule shipped for the first time** — the class was already emitted by the renderer pre-Phase-27 (via string concatenation at browser.ts:4544) but rendered unstyled. Not a visual change to consumers (no prior rule existed to render differently).
- **5 net-new composite `--active` rules** on UserRow, Message, DetailRow, TimelineEntry, SettingRow — each with its `.vms-{composite}__{primary-slot} { font-weight: 600 }` sibling per Ashley's Task 2 slot-mapping picks.
- **6 `--done` (opacity 0.72) + 6 `--disabled` (opacity 0.55)** rules shipped on the 6 new composites (Message, UserRow, DetailRow, TimelineEntry, SettingRow, Chip) per Ashley's `ship` selection, mirroring the shipped ListRow precedent at default.css:1188-1189.
- **Chip's intentional `--active` omission documented inline** via a CSS comment block explaining the "ship field + BEM class + opacity, but no `--active`" posture per CONTEXT §Out-of-scope.
- **Green tree preserved**: `npm run build`, `npm test` (1251 passed | 1 skipped — baseline unchanged), and `npm run check:core-globals` all pass. No tests failed; the CSS rule replacements didn't affect any test assertion (no test asserted the pre-Phase-27 `--active` bg-flash).

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify per-composite primary-slot class names + base padding-left; produce compensation map** — SKIPPED as a separate commit (orchestrator confirmed the plan's `<interfaces>` pre-computed decision map against HEAD out-of-band; no divergence; interfaces map is the authoritative source for Task 3).
2. **Task 2: Ashley checkpoint (author-vs-content, style-3-vs-style-6, ship-vs-defer)** — SKIPPED as a separate commit (Ashley reviewed served tasting and locked `author, style-3, ship` out-of-band; no in-band checkpoint needed).
3. **Task 3: Write unified STYLE-3 --active rules + net-new TableRow rule + 5 new composite rules + --done/--disabled on new composites** — `85eb5ba` (feat)

**Plan metadata commit:** _will be created as the final commit in this session (SUMMARY.md + STATE.md + ROADMAP.md)_

## Files Created/Modified

- `viewmodel-shell/styles/default.css` — +113 insertions / -4 deletions; 1 tracked file changed. Every edit falls into 4 categories: (a) REPLACE `.vms-list-item--active` and `.vms-list-row--active` with STYLE-3 (removing the 2 legacy bg/border-color rules), (b) APPEND net-new `.vms-table__row--active` in the TableRow state block, (c) APPEND 5 STYLE-3 rule pairs to Message, UserRow, DetailRow, TimelineEntry, SettingRow composite blocks, (d) APPEND 12 opacity rules (`--done` + `--disabled` on all 6 new composites) plus the Chip omission comment.

## Task 1 Decision Map (re-verified by orchestrator against HEAD, 2026-07-31)

Every row of the plan's `<interfaces>` pre-computed decision map was CONFIRMED against HEAD. No divergence found. Table reproduced here as the authoritative source Task 3 wrote against:

| Composite         | Primary-slot class          | Base padding-left               | Existing border-left in base           | STYLE-3 shape shipped                                                                                       | Status     |
|-------------------|-----------------------------|---------------------------------|-----------------------------------------|-------------------------------------------------------------------------------------------------------------|------------|
| ListItemNode      | **NONE emitted**            | `var(--vms-space-md)` (:1105)   | NONE                                    | **STYLE-3 border-only** (no weight:600 sibling rule — no `__title` slot to target). Padding-left compensated. | CONFIRMED  |
| TableRow          | none (CONTEXT §Slot-map lock) | (varies per cell)              | NONE                                    | **STYLE-3 border-only** per CONTEXT lock. NO padding compensation (cells own their own padding).           | CONFIRMED  |
| ListRowNode       | `.vms-list-row__primary`    | `var(--vms-space-md)` (:1175)   | **YES: `border-left: 3px solid transparent`** (:1177) | **STYLE-3 border-color variant**: `border-left-color: var(--vms-accent)`. NO padding-compensation needed. Weight:600 on `__primary`. | CONFIRMED  |
| UserRowNode       | `.vms-user-row__name`       | `var(--vms-space-md)` (:1409)   | NONE                                    | STYLE-3 full: border-left + padding compensation. Weight:600 on `__name`.                                    | CONFIRMED  |
| MessageNode       | `.vms-message__author`      | NONE (grid wrapper :1259)       | NONE                                    | **STYLE-3 no-padding variant**: border-left, NO padding-compensation. Weight:600 on `__author` (Ashley: `author`). | CONFIRMED  |
| DetailRowNode     | `.vms-detail-row__value`    | `var(--vms-space-md)` (:1502)   | NONE                                    | STYLE-3 full: border-left + padding compensation. Weight:600 on `__value`.                                    | CONFIRMED  |
| TimelineEntryNode | `.vms-timeline-entry__description` | **NONE** (only padding-bottom :1588) | NONE (`::before` dot EXTERNAL at `left: -1.5rem`) | **STYLE-3 no-padding variant** per Ashley: border-left, NO padding-compensation. Weight:600 on `__description`. | CONFIRMED  |
| SettingRowNode    | `.vms-setting-row__label`   | `var(--vms-space-md)` (:1679 shorthand) | NONE                              | STYLE-3 full: border-left + padding compensation. Weight:600 on `__label`.                                    | CONFIRMED  |
| ChipNode          | (no shipped `--active`)     | N/A                             | N/A                                     | NO shipped `--active` rule per CONTEXT §Out-of-scope. `--done` + `--disabled` opacity SHIP per Ashley. Inline comment documents deferral. | CONFIRMED  |

## Task 2 Ashley Checkpoint (out-of-band, tasting page review)

Locked via served tasting at `http://100.113.23.63:34073/mocks.html`:

1. **MessageNode primary-slot for weight:600**: `author` (identity/who) — consistent with the row-composite convention of bolding the identifier, not the body.
2. **TimelineEntryNode `--active`**: `style-3` (border-left + description weight:600). Geometry pre-check confirmed `::before` dot at `left: -1.5rem` external to entry box; no collision with entry's own border-left at `left: 0`.
3. **`--done` and `--disabled` on the 6 new composites**: `ship` per ListRow precedent (opacity 0.72 / 0.55). Extends the lifecycle vocabulary uniformly across the row/composite family.

Combined signal: `author, style-3, ship`. Applied verbatim in Task 3.

## Verification Evidence

**Grep counts (post-write):**

```
$ cd viewmodel-shell && grep -c 'border-left: 3px solid var(--vms-accent)' styles/default.css
7
```
(ListItem + Message + UserRow + DetailRow + TimelineEntry + SettingRow + TableRow = 7 composites shipping the full border-left rule. ListRow legitimately uses `border-left-color` — see key-decisions above.)

```
$ cd viewmodel-shell && grep -n '\.vms-.*--active' styles/default.css
1094:.vms-tabs__tab--active { background: var(--vms-surface-2); color: var(--vms-accent); }
1160:.vms-list-item--active,
1161:.vms-list-item--active:hover {
1209:.vms-list-row--active { border-left-color: var(--vms-accent); }
1210:.vms-list-row--active .vms-list-row__primary { font-weight: 600; }
1349:.vms-message--active { border-left: 3px solid var(--vms-accent); }
1350:.vms-message--active .vms-message__author { font-weight: 600; }
1515:.vms-user-row--active {
1519:.vms-user-row--active .vms-user-row__name { font-weight: 600; }
1593:.vms-detail-row--active {
1597:.vms-detail-row--active .vms-detail-row__value { font-weight: 600; }
1704:.vms-timeline-entry--active { border-left: 3px solid var(--vms-accent); }
1705:.vms-timeline-entry--active .vms-timeline-entry__description { font-weight: 600; }
1788:.vms-setting-row--active {
1792:.vms-setting-row--active .vms-setting-row__label { font-weight: 600; }
1856:   .vms-chip--active class (still round-trips). */
2204:.vms-link--active {
2486:.vms-table__row--active { border-left: 3px solid var(--vms-accent); }
```

Composite `--active` selector count: **8** (ListItem, ListRow, Message, UserRow, DetailRow, TimelineEntry, SettingRow, TableRow) — matches the plan's `>= 8` expectation. Chip is intentionally absent (line 1856 is the omission-documentation CSS comment mentioning `.vms-chip--active`, not a rule). Tabs (:1094) and Link (:2204) are pre-existing state selectors on different node families — untouched.

```
$ cd viewmodel-shell && grep -nE '\.vms-(message|user-row|detail-row|timeline-entry|setting-row|chip)--done\b' styles/default.css | wc -l
6
$ cd viewmodel-shell && grep -nE '\.vms-(message|user-row|detail-row|timeline-entry|setting-row|chip)--disabled\b' styles/default.css | wc -l
6
$ cd viewmodel-shell && grep -c 'Phase 27' styles/default.css
10
$ cd viewmodel-shell && grep -n 'ships NO --active' styles/default.css
1850:   opacity per ListRow precedent (0.72 / 0.55), but ships NO --active rule
```

**Post-Phase-27 vs. pre-Phase-27 `--active` counts (ADDITIVE proof):**

- Pre-Phase-27: ListItem `--active` (+`:hover` selector), Tabs `--active`, ListRow `--active`, Link `--active` = 4 base composite selectors + 1 companion.
- Post-Phase-27: same 4 pre-existing plus 6 net-new composite `--active` selectors (ListRow gained a companion `__primary` weight rule; TableRow, Message + `__author` companion, UserRow + `__name` companion, DetailRow + `__value` companion, TimelineEntry + `__description` companion, SettingRow + `__label` companion) — verifies additive count is correct.

**Build verification:**

```
$ cd viewmodel-shell && npm run build
> @ashley-shrok/viewmodel-shell@8.0.3 build
> tsc -b tsconfig.tui.json
(clean exit; no diagnostics)
```

**Vitest suite (unchanged from baseline):**

```
$ cd viewmodel-shell && npm test
 Test Files  78 passed (78)
      Tests  1251 passed | 1 skipped (1252)
   Duration  2.78s
```

No test asserted the pre-Phase-27 `--active` bg-flash on ListItem or ListRow; the visual replacement is not observable via jsdom (no test in the suite reads `getComputedStyle` on `.vms-list-item--active` for the bg or border-color). Vitest count unchanged: 1251 passed | 1 skipped (identical to the Plan 27-03 baseline).

**Core-globals guard (still green):**

```
$ cd viewmodel-shell && npm run check:core-globals
> node scripts/check-core-platform-globals.mjs
✓ AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals.
```

CSS-only change — the guard is not affected by stylesheet edits, but re-ran defensively as part of the green-tree gate.

**Git diff scope:**

```
$ git diff --stat viewmodel-shell/styles/default.css
 viewmodel-shell/styles/default.css | 117 +++++++++++++++++++++++++++++++++++--
 1 file changed, 113 insertions(+), 4 deletions(-)
```

Single file modified, exactly the file the plan mandated. No collateral changes.

## Decisions Made

- **Skipped Task 1's separate audit-only commit** — the plan explicitly folded the audit into a "re-verification" step after plan-checker W1, and the orchestrator confirmed no divergence from the pre-computed `<interfaces>` decision map against HEAD before spawning this executor. Adding a "no-file-modified" audit commit would fragment the plan's intent (single atomic CSS-write commit).
- **Skipped Task 2's separate in-band checkpoint** — Ashley performed the visual sign-off out-of-band on a served tasting page (`http://100.113.23.63:34073/mocks.html`) and locked `author, style-3, ship`. Applying those verbatim in Task 3 satisfies the plan's checkpoint semantics; re-issuing a subagent-level checkpoint would be redundant.
- **ListItem's slot-mapping override**: shipped the border-only STYLE-3 variant (no weight:600 sibling rule) because the ListItem renderer emits no `__title` class — content lives directly in the `<li>` root as text nodes / children. This matches TableRow's exception rationale and was explicitly predicted by the interfaces map.
- **ListRow's `border-left-color:` variant**: used the color-only mutation instead of a full `border-left:` declaration because the base rule at :1177 already reserved `border-left: 3px solid transparent`. This minimizes the diff, preserves the already-claimed 3px space (no padding-left compensation needed), and keeps the transparent-border tone-axis mechanism intact.
- **No `:hover` companion rules added** on the 5 new composite `--active` rules. ListItem's replacement inherits the existing `,` selector `:hover` companion (was `border-color + bg`, is now `border-left + padding-left` on both selectors). For the 5 new composites, none had a shipped hover interaction with `--active` pre-Phase-27 (they had no `--active` rule at all), so shipping a hover-companion would be introducing new hover semantics without a plan directive.
- **Documented Chip's intentional omission with an inline CSS comment block** — the future maintainer reads the stylesheet and sees the deferral rationale immediately, without needing to consult CONTEXT.md or the design doc.

## Deviations from Plan

None - plan executed exactly as written.

The two skipped Task-level commits (Task 1 audit-only, Task 2 checkpoint) are NOT deviations — they were completed out-of-band by the orchestrator per the executor prompt's explicit instruction ("Task 1 and Task 2 are ALREADY COMPLETE — skip them"). Task 3 is the entire in-band scope for this executor, and it executed the CSS-write per the plan's Blocks A / B / C / D verbatim, honoring Ashley's `author, style-3, ship` selections.

## Issues Encountered

None. The CSS write landed cleanly on first pass; every grep-count criterion matched expectations; build + tests + core-globals guard all passed on first attempt.

## User Setup Required

None - no external service configuration required. Purely additive stylesheet changes plus 2 documented visual replacements. Consumer upgrade action from 8.0.x → 8.1.0 is: no code change; MIGRATION.md (landed at Plan 27-10) will document the visual delta for consumers using `state:"active"` on ListItem / ListRow today.

## Next Phase Readiness

- **27-05** (vitest assertions for BEM class emission on state values) is unblocked — the assertions now have a valid `.vms-{composite}--{state}` rule set to reference in the "verify the emitted class matches a shipped selector" style of tests, if the plan opts for that shape (it doesn't strictly need it — the tests can assert emission alone — but the shipped CSS being in place means the visual verification page in Plan 27-08 will render correctly).
- **27-06** (parity fixture extension) is unblocked — the fixture tripwires can `expectBodyContains` the composed BEM classes; both twins' emissions were closed in Plan 27-03 (TS) and Plan 27-02 (.NET).
- **27-07** (CHANGELOG.md + MIGRATION.md drafting) has the concrete list of shipped rules to enumerate — this SUMMARY's Task 3 commit hash and grep-verified counts feed directly into the CHANGELOG's `Changed` entries for ListItem/ListRow and the `Added` entries for the 5 net-new composite rules + 6 opacity pairs + TableRow.
- **27-08** (tailnet verification page for Ashley's visual sign-off) is unblocked — the 2×8 grid can now render the uniform STYLE-3 look across all 8 composites, backed by the shipped rules landed here.
- No blockers. CSS additions/replacements are additive-plus-2-documented-replacements; the 2 REPLACES are the ONLY visual changes to shipped consumers (MIGRATION.md flag).

## Self-Check: PASSED

Verified after write:

- **File exists:** `.planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-04-SUMMARY.md` — verified via existence check post-Write.
- **Commit exists:** `85eb5ba feat(27-04): unify --active to STYLE-3 across composites + ship --done/--disabled on 6 new composites` — verified via `git rev-parse --short HEAD` post-commit.
- **Stylesheet edits landed:** `git diff --stat` shows `viewmodel-shell/styles/default.css | 117 +++++++++++++++++++++++++++++++++++-- (1 file changed, 113 insertions(+), 4 deletions(-))` — the only file modified.
- **Grep counts match acceptance criteria**: 7 full border-left rules, 8 composite `--active` selectors (Chip intentionally omitted), 6 `--done` (0.72), 6 `--disabled` (0.55), 10 Phase 27 comment markers, 1 Chip "ships NO --active" documentation comment.
- **Build clean**: `npm run build` returns clean exit, no TypeScript diagnostics.
- **Test baseline unchanged**: `npm test` returns 1251 passed | 1 skipped across 78 test files — identical to pre-plan baseline.
- **Core-globals guard green**: `npm run check:core-globals` prints `✓ AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals.`

---
*Phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a*
*Completed: 2026-07-31*
