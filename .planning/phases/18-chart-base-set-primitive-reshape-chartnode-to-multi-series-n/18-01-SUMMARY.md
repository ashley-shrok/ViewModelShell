---
phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n
plan: 01
subsystem: api
tags: [chartnode, wire-protocol, dotnet, typescript, json-serialization, viewmodel-shell]

# Dependency graph
requires: []
provides:
  - Reshaped `ChartNode` wire type in both backends (kind?/labels[]/series[]/stacked?/title?)
  - New `ChartSeries` interface/record (name/data[]/tone?) in both backends
  - `ChartPoint` fully retired from both backends for category charts
  - `.NET` serialization test locking the optional-field omission rules
affects: [18-02, 18-03, 18-04, 18-05, chart-rendering, browser-adapter, tui-adapter, parity-suite]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Multi-series chart wire shape: shared labels[] + index-aligned series[].data[] (reversal from the 4.1 self-contained ChartPoint shape, deliberate per the design doc)"
    - ".NET optional bool default=false + WhenWritingDefault for a field whose false means 'absent/unset' (Stacked), vs WhenWritingNull for nullable reference fields (Kind/Title/Tone)"

key-files:
  created:
    - viewmodel-shell-dotnet/Tests/ChartNodeSerializationTests.cs
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell-dotnet/ViewModels.cs

key-decisions:
  - "Reshaped ChartNode from single-series {kind?:\"bar\"; points: ChartPoint[]} to multi-series {kind?; labels: string[]; series: ChartSeries[]; stacked?; title?} exactly per the locked design doc — no deviation."
  - "ChartPoint fully deleted (not deprecated/kept-alongside) since zero consumers had shipped a chart yet — the free-reshape window."
  - "Confirmed (not modified) that WalkForSectionAction and Collect in ViewModels.cs still treat ChartNode as an action-free leaf — the reshape added no children so no validator case was needed."

patterns-established:
  - "Breaking-reshape-while-free: when a wire type has zero live consumers, retire the old shape outright rather than layering an additive-compat shim."

requirements-completed: [CHARTBASE-01]

# Metrics
duration: 8min
completed: 2026-07-09
---

# Phase 18 Plan 01: ChartNode Wire Reshape Summary

**Reshaped the published `ChartNode` wire type in both TS and .NET backends from single-series `{kind?; points: ChartPoint[]}` to the multi-series-native `{kind?; labels: string[]; series: ChartSeries[]; stacked?; title?}`, retiring `ChartPoint` entirely and locking the new optional-field omission rules with a .NET serialization test.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-09T08:56:00Z
- **Completed:** 2026-07-09T09:04:08Z
- **Tasks:** 3 completed
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- `viewmodel-shell/src/index.ts` now declares `ChartSeries { name, data, tone? }` and the reshaped `ChartNode { kind?, labels, series, stacked?, title? }`; `ChartPoint` deleted; `index.ts` compiles with zero self-contained errors (remaining tsc errors are 100% confined to `browser.ts`, the expected transient red repaired by plan 18-03/18-04).
- `viewmodel-shell-dotnet/ViewModels.cs` mirrors the reshape exactly: `record ChartSeries(Name, Data, Tone?)` and `record ChartNode(Labels, Series, Kind?, Stacked, Title?)` with the correct `WhenWritingNull`/`WhenWritingDefault` attributes; the library builds clean; the file's leaf-validator comments were updated to describe the multi-series shape.
- New `ChartNodeSerializationTests.cs` (7 tests) proves: `type` always `"chart"`; `labels`/`series` always present; default bar (kind/title null, stacked false) omits all three keys; explicit `kind:"area"`/`stacked:true`/`title:"T"` all emit; `ChartSeries.tone` absent when null, `"danger"` when set; whole-number `data` serializes as `12`, not `12.0`. All 7 pass; the framework's full `Tests.csproj` remains 109/109 green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reshape the TypeScript ChartNode + add ChartSeries; retire ChartPoint** - `d732f3b` (feat)
2. **Task 2: Reshape the .NET ChartNode + ChartSeries records with correct optional-field attributes** - `9bbe01f` (feat)
3. **Task 3: .NET serialization/omission unit test for the reshaped ChartNode** - `a42154c` (test)

## Files Created/Modified
- `viewmodel-shell/src/index.ts` - Deleted `ChartPoint`; replaced single-series `ChartNode` with the multi-series shape; added `ChartSeries`
- `viewmodel-shell-dotnet/ViewModels.cs` - Deleted `record ChartPoint`; replaced `record ChartNode` with the multi-series shape; added `record ChartSeries`
- `viewmodel-shell-dotnet/Tests/ChartNodeSerializationTests.cs` - New: locks the reshaped node's optional-field wire rules

## Decisions Made
None beyond what the design doc + plan `<interfaces>` block already locked — the plan's exact TS/.NET shapes were authored verbatim, no re-derivation.

## Deviations from Plan

None - plan executed exactly as written. Both backends were reshaped verbatim per the `<interfaces>` block, `ChartPoint` was fully deleted (not kept as a compat shim), and the leaf-validator pass-through was confirmed unchanged (no new validator case added, matching the plan's explicit "do NOT add a case" instruction).

## Issues Encountered
None. `npx tsc` on `index.ts` confirmed zero self-contained errors, with the only remaining errors (in `browser.ts`, referencing the now-removed `points`/`tone` fields) being the explicitly expected transient red called out in the plan's `<output>` section — deferred to plans 18-03/18-04, not touched here.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The reshaped wire contract is now the locked interface for every downstream plan in this phase: 18-02 (theme palette tokens), 18-03/18-04 (browser adapter + TUI rendering), 18-05 (parity fixture widening).
- **Known, expected transient red left in place per plan instruction:** `viewmodel-shell/src/browser.ts` (references removed `ChartNode.points`/`.tone`), the FeatureProbe demos (.NET + bun), Showcase `main.ts`, `tui.tsx`, and the existing chart tests. None of these were touched in this plan — they are explicitly out of scope here and are repaired by 18-03/18-04/18-05.
- The framework's own `viewmodel-shell-dotnet/Tests` project (109/109) and the reshaped package's library build are both green. The full green-tree gate (vitest, parity, core-globals, all `demo/**/*.Tests.csproj`) was NOT re-run in this plan — it is expected to be red in the browser/demo layer until 18-03+ land, consistent with the plan's stated scope.

---
*Phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n*
*Completed: 2026-07-09*
