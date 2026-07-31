---
phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
plan: 01
subsystem: ui

tags: [viewmodel-shell, composite-nodes, typed-slots, state-axis, wire-shape, typescript]

# Dependency graph
requires:
  - phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip
    provides: The 6 Phase-25 composite interfaces (UserRowNode, MessageNode, DetailRowNode, TimelineEntryNode, SettingRowNode, ChipNode) that this plan extends with the state? axis; the shipped ListRowNode.state TSDoc that serves as the golden template.
provides:
  - Six new `state?: string` optional fields on the 6 v8 composite interfaces in viewmodel-shell/src/index.ts
  - TSDoc mirroring the ListRowNode.state golden template on each (freeform lifecycle axis; framework ships styling for active/done/disabled; unrecognized values round-trip unstyled; BEM emission .vms-{composite}--{state}; orthogonal to tone/role/status)
  - Composite-specific TSDoc annotations: MessageNode documents multiplicative role x state composition; TimelineEntryNode flags the ::before rail + dot geometry interaction (Plan 27-04 CSS concern); ChipNode explicitly notes NO shipped --active rule (deferred per CONTEXT §Out-of-scope)
  - Wire uniformity closed on the TS side: 9 of 9 row/list/composite types now carry state?: string (was 3 of 8/9)
affects: [27-02 (mirrors these 6 additions on the .NET side), 27-03 (wires the browser.ts emission sites), 27-04 (lands the CSS rules for --active + optional --done/--disabled), 27-05..09 (tests + parity + release wave for the whole phase)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed-slots pattern uniformity (composite-nodes-layer.md §3): every composite carries the same state?: string axis with mirrored TSDoc; unrecognized values round-trip so the axis stays extensible"
    - "Composite-specific TSDoc annotations for cross-mechanism interactions (Message role x state, Timeline rail x --active, Chip 'ship field, no rule' deferral)"

key-files:
  created: []
  modified:
    - "viewmodel-shell/src/index.ts (6 new state? fields on UserRowNode/MessageNode/DetailRowNode/TimelineEntryNode/SettingRowNode/ChipNode interfaces, +64 lines TSDoc + field declarations)"

key-decisions:
  - "Placement per composite followed the plan's rules: state? goes after tone? and before action? where both exist (DetailRow, TimelineEntry, Chip — Chip already had this ordering); before action? where no tone? exists (UserRow, SettingRow); at end of interface body where neither exists (Message — role serves the surface-tint concept)"
  - "TSDoc composite-specific notes were added exactly per the plan's task instructions (Message multiplicative composition, Timeline rail interaction, Chip 'no shipped rule / deferred') so downstream planners (27-02 .NET twin, 27-04 CSS) have the cross-mechanism context inline in the type source"
  - "DetailRow TSDoc was reflowed mid-execution to keep 'BEM modifier' on a single line so the acceptance-criterion `grep -c 'BEM modifier'` returns 9 (not 8 via a line-break); semantic content unchanged"

patterns-established:
  - "Adding an optional axis field to a composite interface: mirror the golden TSDoc template (freeform / framework-styles-a-vocabulary / unrecognized-values-round-trip / BEM-emission / orthogonal-to-{other-axis}) and add a composite-specific note for any cross-mechanism interaction the field's rendering must respect"

requirements-completed: [STATE-AXIS-TS]

# Metrics
duration: 3min
completed: 2026-07-31
---

# Phase 27 Plan 01: Composite state axis TS wire uniformity Summary

**Added `state?: string` to 6 v8 composites (UserRow/Message/DetailRow/TimelineEntry/SettingRow/Chip) with mirrored golden-template TSDoc, closing the typed-slots pattern gap on the TS side — 9 of 9 row/list composites now carry the axis uniformly**

## Performance

- **Duration:** 3 min (197 sec)
- **Started:** 2026-07-30T23:58:26Z
- **Completed:** 2026-07-31T00:01:43Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Six new `state?: string` optional fields added to UserRowNode, MessageNode, DetailRowNode, TimelineEntryNode, SettingRowNode, and ChipNode in `viewmodel-shell/src/index.ts` — closing the typed-slots pattern gap on the TS side.
- Every added field carries a TSDoc block mirroring the ListRowNode.state golden template (lines 1647-1653): freeform lifecycle axis (NOT severity), framework ships styling for `active`/`done`/`disabled` where applicable, unrecognized values render unstyled but still round-trip, BEM emission `.vms-{composite}--{state}`, orthogonal to tone/role/status.
- Composite-specific TSDoc annotations landed as prescribed: **MessageNode** documents multiplicative `.vms-message--{role}.vms-message--{state}` composition with no cascade collision; **TimelineEntryNode** flags the `::before` rail + per-entry dot geometry interaction that Plan 27-04 must resolve (STYLE-3 border-left vs STYLE-6 bg-tint fallback); **ChipNode** explicitly notes the framework ships **no** `--active` rule (deferred per CONTEXT §Out-of-scope), field exists for wire uniformity + future extension.
- TypeScript build (`npm run build` in `viewmodel-shell/`) succeeds — additions are backward-compatible optional fields, no consumer break, protocol token stays `viewmodel-shell/1.0` (additive optional wire fields).
- Acceptance-criteria greps all pass: `state?: string` count = 9 (was 3), `BEM modifier` count = 9, ChipNode block contains "deferred" + "no shipped" keywords, MessageNode block contains "MULTIPLICATIVELY", TimelineEntry block contains "rail" + "::before".

## Task Commits

Each task was committed atomically:

1. **Task 1: Add state?: string to all 6 composite interfaces in index.ts with TSDoc** — `ea41115` (feat)

**Insertion sites (post-edit line numbers):**

| Composite         | Interface line | `state?` line | Placement                                    |
|-------------------|---------------:|--------------:|----------------------------------------------|
| MessageNode       |           1687 |          1722 | End of interface body (no `tone?`, no whole-msg `action?`) |
| UserRowNode       |           1876 |          1917 | After `trailing?`, before `action?` (no `tone?`) |
| DetailRowNode     |           1944 |          1987 | After `tone?`, before `icon?` (no `action?`) |
| TimelineEntryNode |           2033 |          2091 | After `tone?`, before `icon?` (no `action?`) |
| SettingRowNode    |           2126 |          2196 | After `trailing?`, before `action?` (no `tone?`) |
| ChipNode          |           2225 |          2295 | After `tone?`, before `icon?` (matches original file ordering; `dismissAction?` and `action?` follow) |

Existing `state?: string` occurrences (unchanged):

- Line 395 — ListItemNode (existing)
- Line 1257 — TableRow (existing)
- Line 1653 — ListRowNode (existing; the golden template)

**Plan metadata commit:** _will be created as the final commit in this session (SUMMARY.md + STATE.md + ROADMAP.md)_

## Files Created/Modified

- `viewmodel-shell/src/index.ts` — 6 new optional `state?: string` fields added to composite interfaces, each with a full TSDoc block. +64 lines total. No other logic changed.

## Verification Evidence

**Grep verification (after edits):**

```
$ cd viewmodel-shell && grep -c 'state?: string' src/index.ts
9

$ cd viewmodel-shell && grep -n 'state?: string' src/index.ts
395:  state?: string;      # ListItemNode (existing)
1257:  state?: string;     # TableRow (existing)
1653:  state?: string;     # ListRowNode (existing, golden template)
1722:  state?: string;     # MessageNode (new)
1917:  state?: string;     # UserRowNode (new)
1987:  state?: string;     # DetailRowNode (new)
2091:  state?: string;     # TimelineEntryNode (new)
2196:  state?: string;     # SettingRowNode (new)
2295:  state?: string;     # ChipNode (new)

$ cd viewmodel-shell && grep -c 'BEM modifier' src/index.ts
9

$ cd viewmodel-shell && awk '/^export interface ChipNode/,/^}/' src/index.ts | grep -Ec '(no shipped|framework ships no|deferred)'
1

$ cd viewmodel-shell && awk '/^export interface MessageNode/,/^}/' src/index.ts | grep -Ec '(multiplicative|compose|MULTIPLICATIVELY)'
1

$ cd viewmodel-shell && awk '/^export interface TimelineEntryNode/,/^}/' src/index.ts | grep -Ec '(rail|::before)'
3
```

**Build verification:**

```
$ cd viewmodel-shell && npm run build
> @ashley-shrok/viewmodel-shell@8.0.3 build
> tsc -b tsconfig.tui.json
(clean exit; no diagnostics)
```

**File isolation (post-task-commit, pre-SUMMARY commit):**

```
$ git status --short
 M .planning/ROADMAP.md          # pre-existing (phase transition)
?? .planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/  # untracked; phase dir
?? .vite/                        # pre-existing (dev cache)
```

Only `viewmodel-shell/src/index.ts` was modified by this task (staged and committed in `ea41115`); the two remaining modifications above were already present at plan start and are not caused by this plan.

## TSDoc Text Used (per composite)

**MessageNode** (end of interface body):

```typescript
/** Message lifecycle STATE (NOT severity — no `tone` axis on Message;
 *  `role` drives surface tint, `state` drives lifecycle). Freeform,
 *  app-extensible token; the framework ships styling for `active`,
 *  `done`, `disabled`. Appended as a BEM modifier: `.vms-message--{state}`.
 *  An unrecognized state renders an unstyled class (it still round-trips;
 *  just no shipped rule). Composes MULTIPLICATIVELY with the shipped
 *  `.vms-message--{role}` classes on the same wrapper `<div>` — the two
 *  BEM modifiers stack (`.vms-message--assistant.vms-message--active`)
 *  with no cascade collision (role tints the content surface; state
 *  paints a left-accent border on the wrapper). Orthogonal to `role`. */
state?: string;
```

**UserRowNode** (after `trailing?`, before `action?`):

```typescript
/** User-row lifecycle STATE (NOT severity — Message-style; UserRow has no
 *  `tone` axis, `status` drives the online/away/offline/busy dot).
 *  Freeform, app-extensible token; the framework ships styling for
 *  `active`, `done`, `disabled`. Appended as a BEM modifier:
 *  `.vms-user-row--{state}`. An unrecognized state renders an unstyled
 *  class (it still round-trips; just no shipped rule). Orthogonal to
 *  `status` (the status dot is an independent axis — a user row can be
 *  `state:"active"` AND `status:{kind:"away"}` simultaneously). */
state?: string;
```

**DetailRowNode** (after `tone?`, before `icon?`):

```typescript
/** Detail-row lifecycle STATE (NOT severity — that's `tone`). Freeform,
 *  app-extensible token; the framework ships styling for `active`, `done`,
 *  `disabled` (mirrors ListRowNode.state). Appended as a BEM modifier:
 *  `.vms-detail-row--{state}`. An unrecognized state renders an unstyled
 *  class (it still round-trips; just no shipped rule). Orthogonal to
 *  `tone` (a row can be `state:"active"` AND `tone:"warning"` — one paints
 *  a left-accent border on the wrapper, the other tints the value text). */
state?: string;
```

**TimelineEntryNode** (after `tone?`, before `icon?`):

```typescript
/** Timeline-entry lifecycle STATE (NOT severity — that's `tone`). Freeform,
 *  app-extensible token; the framework ships styling for `active`, `done`,
 *  `disabled` (mirrors ListRowNode.state). Appended as a BEM modifier:
 *  `.vms-timeline-entry--{state}`. An unrecognized state renders an
 *  unstyled class (it still round-trips; just no shipped rule).
 *  Orthogonal to `tone`. **Interaction with the shipped `::before` rail +
 *  per-entry dot mechanism** (see TimelineNode above): the `--active`
 *  left-border approach may collide with the entry's own `::before` dot
 *  positioned at `-1.5rem` on the rail. Plan 27-04 resolves whether
 *  STYLE-3 (border-left) survives that geometry, or whether Timeline falls
 *  back to a bg-tint variant of `--active` (STYLE-6, kept only for
 *  Timeline). No behavior change from THIS wire-shape addition — the
 *  interaction is a CSS-only concern. */
state?: string;
```

**SettingRowNode** (after `trailing?`, before `action?`):

```typescript
/** Setting-row lifecycle STATE (SettingRow has no `tone` axis — its trailing
 *  control carries the semantic weight). Freeform, app-extensible token;
 *  the framework ships styling for `active`, `done`, `disabled` (mirrors
 *  ListRowNode.state). Appended as a BEM modifier:
 *  `.vms-setting-row--{state}`. An unrecognized state renders an unstyled
 *  class (it still round-trips; just no shipped rule). Common use:
 *  `state:"active"` for "this setting is currently highlighted" (jumped-to
 *  from a search result / anchored deep link). */
state?: string;
```

**ChipNode** (after `tone?`, before `icon?`):

```typescript
/** Chip lifecycle STATE (NOT severity — that's `tone`). Freeform,
 *  app-extensible token; appended as a BEM modifier:
 *  `.vms-chip--{state}`. **The framework ships NO `--active` rule for
 *  Chip** — STYLE-3's "left-border + bold primary text" active affordance
 *  doesn't map to a tinted-pill shape (chips have no border-left
 *  convention, and the pill IS the primary). This field ships for wire
 *  uniformity per the typed-slots pattern (composite-nodes-layer.md §3)
 *  and future extensibility; unrecognized values including `"active"`
 *  render an unstyled `.vms-chip--{state}` class (still round-trips).
 *  A follow-up phase can design Chip's shipped `--active` when the use
 *  case surfaces — deferred per Phase 27 CONTEXT §Out-of-scope.
 *  Orthogonal to `tone`. */
state?: string;
```

## Decisions Made

- **Placement per composite** followed the plan's placement rules exactly (documented in the Task Commits table above). For MessageNode specifically, the field went to the end of the interface body since MessageNode has neither `tone?` (the `role?` axis serves the surface-tint concept) nor a whole-message `action?` slot.
- **Chip's TSDoc explicitly documents the "ship field, no rule" posture** so a downstream reader (or a future planner considering an active-chip design) sees the deferral rationale inline in the type source, not just in the CONTEXT file. Same discipline applied to TimelineEntry's rail-interaction note and Message's multiplicative composition note — cross-mechanism concerns live at the type definition.
- **DetailRow TSDoc reflow (post-write refinement, not a deviation):** the initial DetailRow TSDoc broke "BEM modifier" across two lines (as `BEM\n * modifier`) which made the acceptance-criterion `grep -c 'BEM modifier'` return 8 instead of 9. Reflowed to keep the phrase on one line; semantic content unchanged; final count matches the criterion.

## Deviations from Plan

None - plan executed exactly as written.

The DetailRow TSDoc reflow noted above is not a deviation — it's a mid-task refinement to satisfy the plan's own acceptance criterion; no scope, semantic content, or logic changed.

## Issues Encountered

None. Task 1 executed cleanly on the first pass; the DetailRow reflow was a self-caught pre-commit refinement to satisfy the grep-count criterion.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **27-02** can now proceed: mirror these 6 additions on the .NET side (`viewmodel-shell-dotnet/ViewModels.cs`) with matching `[JsonIgnore(WhenWritingNull)]` `string? State = null` parameters appended at the tail of each record's primary constructor per the AGENTS.md "trailing-append zero-retype convention". The 6 target records in `ViewModels.cs` are: `UserRowNode`, `MessageNode`, `DetailRowNode`, `TimelineEntryNode`, `SettingRowNode`, `ChipNode`.
- **27-03** (wire the `browser.ts` emission sites) is unblocked by this plan — 6 new emission sites needed, one per composite, following the ListRowNode BEM emission pattern (`if (n.state) cls.push(`vms-{composite}--${n.state}`);`).
- **27-04** (CSS rules) is downstream of 27-02 + 27-03; the TimelineEntry rail-interaction note in this plan's TSDoc flags the pixel-geometry decision (STYLE-3 border-left vs STYLE-6 bg-tint fallback) for that plan to resolve.
- No blockers. Additive optional wire fields — protocol token stays `viewmodel-shell/1.0`; no consumer break.

## Self-Check: PASSED

Verified after write:

- **File exists:** `.planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-01-SUMMARY.md` — will be verified post-write.
- **Commit exists:** `ea41115` — verified via `git log --oneline -3`.
- **`viewmodel-shell/src/index.ts` compiled successfully** — `npm run build` clean exit.

---
*Phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a*
*Completed: 2026-07-31*
