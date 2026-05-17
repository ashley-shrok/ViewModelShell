---
phase: 03-default-design-system
plan: 02
subsystem: api
tags: [typescript, csharp, dotnet, wire-format, viewnode, closed-union, additive-optional]

# Dependency graph
requires:
  - phase: 03-default-design-system (Plan 01)
    provides: "default.css scale/page-shell tokens + D-17 AA fix (the CSS the Plan 03 renderer + density/card rules consume; this plan supplies the contracts those rules ride on)"
provides:
  - "PageNode.density?: \"comfortable\" | \"compact\" closed-union optional field (TS + .NET)"
  - "SectionNode.variant?: \"card\" closed-union optional field (TS + .NET)"
  - "Structurally-aligned cross-backend model surface for THEME-03/THEME-04 (D-05)"
affects: [03-default-design-system (Plan 03 renderer/CSS emission), 04-preset-grid-layout, 05-canonical-examples]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive optional closed-union wire field: TS string-literal union + .NET trailing nullable-default positional parameter; omitted => WhenWritingNull => byte-identical wire (D-01)"

key-files:
  created: []
  modified:
    - "viewmodel-shell/src/index.ts (PageNode.density?, SectionNode.variant? closed-union TS types)"
    - "viewmodel-shell-dotnet/ViewModels.cs (PageNode/SectionNode records gain trailing string? Density/Variant = null)"

key-decisions:
  - "Closed string-literal unions (D-03) for both TS fields, not open string — enumerable contract for the blind agent + AGENTS.md"
  - ".NET mirrors structurally with trailing string? = null positional parameter (D-05); closed-union enforcement lives in the TS contract + AGENTS.md vocabulary, not .NET runtime"
  - "No version bump (still npm 0.3.14 / NuGet 0.3.10) — the 0.4.0 aligned bump is Phase 5 RELEASE-01"
  - "No renderer/CSS/parity-fixture change here — Plan 03 owns emission; dedicated density/card parity fixture deferred to Phase 4/5 (D-05)"

patterns-established:
  - "Additive optional wire field pattern: TS closed union + .NET trailing nullable-default param, parity-verified byte-identical when omitted"

requirements-completed: [THEME-03, THEME-04]

# Metrics
duration: 13min
completed: 2026-05-17
---

# Phase 3 Plan 2: Density/Card Model Surface Summary

**Added `PageNode.density?: "comfortable" | "compact"` and `SectionNode.variant?: "card"` as additive optional closed-union fields on both backends (TS `src/index.ts` + .NET `ViewModels.cs`), structurally aligned per D-05, with parity proving omitted ⇒ byte-identical wire (the non-breaking guarantee).**

## Performance

- **Duration:** ~13 min (includes a parity-harness file-lock recovery deviation)
- **Started:** 2026-05-17T22:42:56Z
- **Completed:** 2026-05-17T22:45:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `PageNode.density?: "comfortable" | "compact"` added to `viewmodel-shell/src/index.ts` as a closed-union optional field (D-03), purely additive — existing `type`/`title`/`children` order unchanged.
- `SectionNode.variant?: "card"` added to `src/index.ts` as a closed-union optional field (D-03), purely additive.
- `PageNode` .NET record gains trailing `string? Density = null`; `SectionNode` gains trailing `string? Variant = null` — multi-line positional records preserved, params not reordered, following the `ListItemNode` `string? Variant` precedent.
- Non-breaking guarantee verified end-to-end: cross-backend parity 7/7 byte-identical (new fields omitted everywhere in existing fixtures ⇒ serialize identically to today, D-01).
- Backends structurally aligned (D-05) — TS contract + .NET record carry the same two optional members.

## Task Commits

Each task was committed atomically (with hooks, no `--no-verify`):

1. **Task 1: Add PageNode.density? and SectionNode.variant? closed-union fields to src/index.ts** - `a1d480d` (feat)
2. **Task 2: Add matching optional members to PageNode/SectionNode records in ViewModels.cs** - `8e8314b` (feat)

**Plan metadata:** _(final docs commit — see git log)_

## Files Created/Modified
- `viewmodel-shell/src/index.ts` - `PageNode` interface gains `density?: "comfortable" | "compact"`; `SectionNode` interface gains `variant?: "card"` (both closed unions, additive optional, with contract JSDoc).
- `viewmodel-shell-dotnet/ViewModels.cs` - `PageNode` record gains trailing `string? Density = null`; `SectionNode` record gains trailing `string? Variant = null` (multi-line positional, no `[JsonDerivedType]` change).

## Verification Results
- `cd viewmodel-shell && npm run build` (tsc) — exit 0, clean
- `npm run check:core-globals` — PASS (`src/index.ts` references zero platform globals; pure type additions, AGNOSTIC-03 held)
- `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` — exit 0 (Build succeeded, 0 Warnings, 0 Errors)
- `npm test` (vitest) — 18/18 passed (adapter-seam, copy-button, upload-progress)
- `bun run parity/run.ts` — Parity tests passed; all backends agree across all 7 fixtures (.NET/Bun byte-identical) — proves the D-01 non-breaking guarantee
- Scope check: only `index.ts` + `ViewModels.cs` changed — no `browser.ts`, no CSS, no parity fixture, no `styles/themes` touched
- Both new TS fields are closed unions (not `string`); no `[JsonDerivedType]` registration changed; no version bump

## Decisions Made
- Followed the plan as specified. Both fields are closed unions (D-03); .NET mirrors structurally with `string? = null` trailing params (D-05); no version bump (Phase 5 RELEASE-01 owns the aligned 0.4.0 bump); no renderer/CSS here (Plan 03 owns emission).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 verification grep false-positive on pre-existing open-string `variant?: string` lines**
- **Found during:** Task 1 (Add closed-union fields to src/index.ts)
- **Issue:** The plan's Task 1 `<automated>` verify command scans the *entire* `index.ts` for `/variant\?:\s*string/`. It tripped on the pre-existing `ListItemNode` (L85) and `TableRow` (L196) `variant?: string;` declarations — the documented open-string precedent the plan's own `<interfaces>` block explicitly references ("Do NOT use the open-string `ListItemNode.variant?: string` style"). These lines were not introduced by this task and are out of scope.
- **Fix:** No code change. Substituted a scoped verification that isolates the `PageNode`/`SectionNode` interface bodies (the surface this task actually touches) and asserts: (a) `density?: "comfortable" | "compact"` present, (b) `variant?: "card"` present, (c) neither new field typed as open `string`. This precisely matches the plan's stated acceptance criteria #1–#3. Confirmed pre-existing L85/L196 lines remain byte-untouched (`git diff` shows only 4 insertions in `index.ts`).
- **Files modified:** None (verification tooling false-positive only).
- **Verification:** Scoped grep `OK`; `git diff --name-only HEAD~2 HEAD` = only `index.ts` + `ViewModels.cs`; `index.ts` diff = +4 lines, no deletions.
- **Committed in:** N/A (no code change).

**2. [Rule 3 - Blocking] Parity harness prebuild failed on a stale orphaned `ViewModelShell` process holding a DLL file lock**
- **Found during:** Overall verification (cross-backend parity)
- **Issue:** First `bun run parity/run.ts` failed at the `dotnet-tasks` prebuild with `MSB3027`/`MSB3021`: "The process cannot access the file ... `AshleyShrok.ViewModelShell.dll` because it is being used by another process. The file is locked by: `ViewModelShell (51260)`." An orphaned demo backend (PID 51260) plus stray `dotnet`/`bun` processes from a prior run held the DLL lock. Environmental, not a defect in the `ViewModels.cs` change (no compile errors — only file-copy lock errors).
- **Fix:** Terminated the orphaned PID 51260 and the stray `dotnet`/`bun` processes, removed the stale locked DLL, and reran the parity suite.
- **Files modified:** None.
- **Verification:** Rerun `bun run parity/run.ts` → "Parity tests passed; all backends agree" across all 7 fixtures.
- **Committed in:** N/A (no code change).

---

**Total deviations:** 2 auto-fixed (2× Rule 3 — blocking-issue, both environmental/tooling, zero code change).
**Impact on plan:** No scope creep, no code change beyond the two planned tasks. Both deviations were environmental/tooling friction that did not affect correctness of the delivered fields; the plan's actual acceptance criteria were verified precisely.

## Issues Encountered
None beyond the two environmental deviations documented above (verification grep false-positive on pre-existing lines; parity harness DLL file lock from an orphaned prior-run process). Both resolved without code change; all gates green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03 (this phase) can now wire `browser.ts` to emit `.vms-page--compact` / `.vms-section--card` from these contracts and add the `default.css` density-remap + card-surface rules — the model surface it depends on now exists on both backends.
- Phase 4 (preset-grid layout) and Phase 5 (canonical examples + 0.4.0 closeout) inherit a clean structurally-aligned wire surface; the dedicated density/card cross-backend parity fixture remains deferred to Phase 4 LAYOUT-05 / Phase 5 RELEASE-02 per D-05 (the existing 7 fixtures stay green, regression-only obligation satisfied).
- No version bump performed (correct — npm 0.3.14 / NuGet 0.3.10 unchanged; the aligned 0.4.0 bump is Phase 5 RELEASE-01).
- No blockers.

## Self-Check: PASSED

- FOUND: `.planning/phases/03-default-design-system/03-02-SUMMARY.md`
- FOUND: commit `a1d480d` (Task 1)
- FOUND: commit `8e8314b` (Task 2)
- FOUND: `PageNode.density?: "comfortable" | "compact"` closed union in `src/index.ts`
- FOUND: `SectionNode.variant?: "card"` closed union in `src/index.ts`
- FOUND: `string? Density = null` on `PageNode` record in `ViewModels.cs`
- FOUND: `string? Variant = null` on `SectionNode` record in `ViewModels.cs`

---
*Phase: 03-default-design-system*
*Completed: 2026-05-17*
