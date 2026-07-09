---
phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n
plan: 04
subsystem: ui
tags: [chartnode, tui, opentui, terminal, degradation, viewmodel-shell]

# Dependency graph
requires:
  - phase: 18-01
    provides: Reshaped ChartNode/ChartSeries wire type (labels[]/series[]/stacked?/title?) in both backends
provides:
  - Reshaped TUI ChartView degradation for the multi-series ChartNode
  - test/tui-chart.test.ts locking the multi-series/empty/all-zero/negative/pie/donut degradation paths
affects: [18-05, 18-06, parity-suite, tui-adapter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TUI chart degradation groups output BY SERIES (name sub-header, then per-label rows), scaling every series' ASCII bar to the GLOBAL max across all series so multi-series bars stay comparable to one another"
    - "pie/donut TUI degrade prints series[0]'s label/value slices with no bars (single-series by design per CHARTBASE-03); an extra series on pie/donut is silently ignored, matching the browser adapter's lenient render"

key-files:
  created:
    - viewmodel-shell/test/tui-chart.test.ts
  modified:
    - viewmodel-shell/src/tui.tsx

key-decisions:
  - "Grouped-by-series layout (series name header + its label rows) chosen over grouped-by-label, per the plan's explicit 'pick whichever reads most legibly' latitude — series identity stays visually intact as a block."
  - "Bars scale to the global max across ALL series (not per-series max) so two series' bar lengths are directly comparable in one terminal view — the reshape's whole point (multi-series) would be undermined by per-series independent scaling."
  - "Rebuilt dist/ (npx tsc -b tsconfig.json) before the tui.tsx typecheck — tsconfig.tui.json resolves ./index.js via TypeScript project references to the built dist/index.d.ts, which was stale from before the 18-01/18-02/18-03 wire reshape landed. Not a plan deviation: the plan's own verify command (tsc --noEmit -p tsconfig.tui.json) requires it to pass, and dist/ is a gitignored build artifact with no source changes of its own."

patterns-established:
  - "TUI test files duplicate the small collectText + renderTree(vm) walker from conformance.tui.test.ts (a local, unexported function there) rather than importing it, matching the plan's 'reuse the pattern, don't invent a new harness' instruction."

requirements-completed: [CHARTBASE-05]

# Metrics
duration: 4min
completed: 2026-07-09
---

# Phase 18 Plan 04: TUI ChartView Multi-Series Degradation Summary

**Reshaped the TUI adapter's `ChartView` from the retired single-series `points[]` ASCII-bar degradation to the multi-series `labels[]`/`series[]` shape — grouped-by-series output with bars scaled to the global max across all series, guarded against empty/all-zero/negative data, and a `series[0]`-only degrade for pie/donut — locked by a new 6-test `tui-chart.test.ts`.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-09T09:27:00Z
- **Completed:** 2026-07-09T09:31:09Z
- **Tasks:** 2 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `viewmodel-shell/src/tui.tsx`'s `ChartView` now reads `node.labels`/`node.series` (the retired `node.points` is gone from the file); output groups by series (a bold series-name header, then one `<label> <value> <bar>` row per label), with every series' ASCII bar scaled to the single global max value across ALL series so multi-series bars are visually comparable to each other, not just within their own series.
- Every scaling division is guarded by `maxValue > 0` (carried over from the original single-series guard, re-verified against the reshaped data path) — empty `series`, empty `labels`, all-zero data, and all-negative data (`Math.max(0, ...allValues)` floors the max at 0) all render legibly with no bars, never divide by zero, never throw.
- pie/donut degrade by printing `series[0]`'s label/value slices with no bars (matches the browser adapter's single-series-by-design pie/donut rule from CHARTBASE-03); extra series beyond `series[0]` on pie/donut are silently ignored.
- New `viewmodel-shell/test/tui-chart.test.ts` (6 tests, mirroring the `conformance.tui.test.ts` `collectText` + `renderTree(vm)` walker with no OpenTUI `CliRenderer`/TTY needed) proves: a 2-series bar chart renders without throwing and its text contains the title + all 3 labels + both series names; an empty-series node and an all-zero-data node render without throwing (checked for absence of `"NaN"`/`"Infinity"` in the output); an all-negative-data node exercises the non-positive-max guard; a pie node surfaces `series[0]`'s slice labels; a donut node with an extra ignored series renders cleanly.
- `tsconfig.tui.json` (`npx tsc --noEmit`) is clean — zero `tui.tsx` errors.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reshape ChartView to the multi-series labels+series degradation** - `fb26b61` (feat)
2. **Task 2: TUI degradation test for the reshaped ChartNode** - `d25f82b` (test)

## Files Created/Modified
- `viewmodel-shell/src/tui.tsx` - `ChartView` rewritten for the multi-series `ChartNode`: grouped-by-series ASCII-bar rendering scaled to the global max, pie/donut `series[0]`-only degrade, all divisions guarded
- `viewmodel-shell/test/tui-chart.test.ts` - New: 6 tests locking the multi-series bar/pie/donut/empty/all-zero/negative-data degradation paths

## Decisions Made
- Grouped-by-series layout over grouped-by-label — the plan explicitly left this choice open ("pick whichever ... reads most legibly"); grouped-by-series keeps each series visually intact as a labeled block, which reads more legibly in a narrow terminal column than interleaving series per label.
- Global-max bar scaling (not per-series max) — the entire point of the reshape is multi-series comparability; scaling each series independently would make two series' bars visually meaningless relative to each other.
- Rebuilt `dist/` via `npx tsc -b tsconfig.json` before running the plan's own `tsconfig.tui.json` typecheck. This is not a scope deviation: `tui.tsx` imports types from `./index.js`, and `tsconfig.tui.json` is a TypeScript project reference to `tsconfig.json` — `--noEmit` resolves the referenced project's already-built `dist/index.d.ts` rather than re-checking `src/index.ts` live. That declaration file was stale from before 18-01/18-02/18-03 landed their wire reshape, so the plan's mandated verify command could not otherwise pass. `dist/` is `.gitignore`d (confirmed via `git ls-files`/`git status`), so this produced no tracked file changes to commit.

## Deviations from Plan

None - plan executed exactly as written. The `dist/` rebuild noted above is a build-tooling prerequisite for running the plan's own specified verify command, not a change to plan scope, files, or behavior — no source files outside `viewmodel-shell/src/tui.tsx` and `viewmodel-shell/test/tui-chart.test.ts` were touched, matching the plan's `files_modified` list exactly.

## Issues Encountered
- Initial `npx tsc --noEmit -p tsconfig.tui.json` run failed with `ChartNode` missing `labels`/`series` — traced to the composite project reference resolving a stale `dist/index.d.ts` (pre-18-01 single-series shape) rather than the live `src/index.ts`. Resolved by rebuilding the referenced project (`npx tsc -b tsconfig.json`), after which the tui typecheck passed clean. See "Decisions Made" above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The TUI target is now fully aligned with the reshaped `ChartNode` wire shape; no remaining `node.points` references exist anywhere in `viewmodel-shell/src/tui.tsx` (grep-confirmed).
- Full `npx vitest run` (47 test files, 552 passed / 1 pre-existing skip) stayed green after this plan's changes — no regressions introduced to the existing TUI conformance/lifecycle suites or any other suite.
- Remaining phase work (per `.planning/phases/18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n/18-CONTEXT.md`): 18-05 (parity fixture widening to multi-series + tone + stacked) and 18-06 (the full green-tree gate re-run across vitest/parity/core-globals/.NET/demo tests) remain outstanding for Phase 18 completion.

---
*Phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n*
*Completed: 2026-07-09*

## Self-Check: PASSED

Verified `viewmodel-shell/src/tui.tsx` and `viewmodel-shell/test/tui-chart.test.ts` exist on disk with the expected reshaped content (grep for `node.labels`/`node.series` present, `node.points` absent). Verified both commit hashes (`fb26b61`, `d25f82b`) present in `git log --oneline`.
