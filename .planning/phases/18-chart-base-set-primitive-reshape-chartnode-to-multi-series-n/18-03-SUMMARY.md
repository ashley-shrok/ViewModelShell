---
phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n
plan: 03
subsystem: ui
tags: [chart.js, browser-adapter, viewmodel-shell, jsdom-testing, showcase]

# Dependency graph
requires:
  - phase: 18-01
    provides: "Reshaped ChartNode/ChartSeries wire type ({kind?,labels,series,stacked?,title?}) this plan's renderer consumes"
  - phase: 18-02
    provides: "--vms-chart-1..8 categorical palette tokens in default.css + every theme, read here via getComputedStyle"
provides:
  - "Widened chart()/loadChart() in browser.ts rendering the full base set (bar/line/area/pie/donut) with multi-series, stacked, palette/tone color, and an auto legend"
  - "chart.test.ts + chart-missing-dep.test.ts rewritten and green against the reshaped node (20 tests)"
  - "Showcase demo chart section reshaped to labels/series (multi-series bar + donut examples)"
affects: [18-04-tui-adapter, 18-05-parity, 18-06-green-tree-gate, 19-verification-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chart.js base-set registration: BarController/BarElement, LineController/LineElement/PointElement/Filler, PieController/DoughnutController/ArcElement, CategoryScale/LinearScale, Tooltip, Legend — all from the existing chart.js ^4 optional peer dep, still behind the lazy dynamic import"
    - "Palette-slot-vs-tone-token color resolution: seriesColor(i, tone) picks the tone token when a series declares one, else cycles --vms-chart-((i%8)+1); pie/donut always cycle per-slice (tone deliberately unused there — a per-slice chart has no single semantic tone to apply)"

key-files:
  created: []
  modified:
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/test/chart.test.ts
    - viewmodel-shell/test/chart-missing-dep.test.ts
    - demo/Showcase/frontend/src/main.ts

key-decisions:
  - "pie/donut ignore a series' tone entirely (not just extra series) — the per-slice palette is the only sensible coloring for a single-series pie; tone is a per-series semantic and doesn't compose with per-slice rendering. Matches the design doc's rendering_spec, which specifies tone only for the bar/line/area per-series path."
  - "Legend display rule implemented exactly as locked: series.length > 1 OR kind is pie/donut. A single-series bar/line/area chart keeps the legend hidden, byte-identical to the 4.1 single-series behavior — no visual regression for the simplest case."
  - "Area's fill color is deliberately NOT alpha-adjusted — backgroundColor is set to the SAME resolved token as borderColor (token-derived, per the locked rendering_spec wording), leaving Chart.js's default fill opacity handling untouched rather than inventing a new alpha-blend rule not in the design doc."

patterns-established:
  - "getComputedStyle-stub-per-test palette assertions: chart.test.ts spies on CSSStyleDeclaration.prototype.getPropertyValue per-test (not globally) to deterministically assert which --vms-chart-N slot or tone token a given series resolves to, restoring the spy immediately after each assertion so it doesn't leak into sibling tests."

requirements-completed: [CHARTBASE-02, CHARTBASE-03]

# Metrics
duration: 12min
completed: 2026-07-09
---

# Phase 18 Plan 03: Browser Adapter Chart.js Widening Summary

**Widened the browser adapter's Chart.js binding from a single-series bar renderer to the full base set — multi-series bar (grouped/stacked), line, area, pie, and donut — colored from the `--vms-chart-1..8` theme palette (or a series' `tone` override), with the redraw-in-place/mark-sweep/lazy-import/fail-loud machinery fully preserved; updated both chart jsdom test files (20/20 green) and reshaped the Showcase demo chart to the new `labels`/`series` shape.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-09T09:20:00Z
- **Completed:** 2026-07-09T09:32:00Z
- **Tasks:** 3 completed
- **Files modified:** 4

## Accomplishments
- `viewmodel-shell/src/browser.ts`'s `chart()` now maps `kind` (omitted→bar) to the correct Chart.js type (`bar`/`line`/`doughnut`, with `area` = `line` + `fill:true`), builds one dataset per series for bar/line/area (colored by palette slot or tone-token override, `dataset.label = series.name`) and a single per-slice-colored dataset for pie/donut (rendering `series[0]`, warning once via `console.warn` if extra series are present — lenient, never a crash). `stacked` applies to bar/area scales only. Legend displays for multi-series or pie/donut, hidden for single-series bar/line/area (byte-identical to prior behavior). `loadChart()`'s `Chart.register(...)` widened to the base-set controllers/elements/scales/plugins, still behind the lazy `import("chart.js")` and the `chartFailLoud` fail-loud path — both fully preserved, along with the persistent `chartInstances` reuse/`.update()`/mark-sweep-destroy machinery. `browser.ts` compiles clean under `tsc --noEmit`.
- `viewmodel-shell/test/chart.test.ts` rewritten to the reshaped node: 19 tests covering structure, multi-series bar config + legend rules, stacked on/off, kind→type mapping for all 5 kinds, palette-vs-tone color resolution (via a per-test `getComputedStyle` stub), pie/donut single-series rendering + the extra-series dev-warn, redraw-in-place, removal mark-sweep, and validator no-blind-spot. `chart-missing-dep.test.ts` updated to a reshaped node with its fail-loud assertion unchanged. 20/20 green under `npx vitest run`; full package suite (46 files / 546 tests) also green.
- `demo/Showcase/frontend/src/main.ts`'s chart section reshaped from the retired `points:[...]` single-series example to two reshaped examples: a multi-series bar ("Signups vs. Churn", 2 tone-bearing series over 4 labels) and a donut ("Traffic by channel", single series, 4 slices) — explanatory copy now names `labels`/`series`/`kind`/`tone`/`stacked`. `vite build` succeeds (the only `tsc --noEmit` noise is pre-existing CSS-module `?inline` import errors unrelated to and predating this change, confirmed via `grep -v "\.css"` showing zero non-CSS errors).

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen chart() config construction + loadChart() controller registration** - `98ed11a` (feat)
2. **Task 2: Update chart.test.ts + chart-missing-dep.test.ts to the reshaped node** - `bb0e320` (test)
3. **Task 3: Reshape the Showcase demo chart to the new multi-series shape** - `db19096` (feat)

## Files Created/Modified
- `viewmodel-shell/src/browser.ts` - Widened `chart()`'s config construction (kind mapping, multi-series datasets, per-slice pie/donut, palette/tone color resolution, stacked, legend rule) and `loadChart()`'s `Chart.register(...)` to the base-set controllers/elements/scales/plugins
- `viewmodel-shell/test/chart.test.ts` - Rewritten to the reshaped `{labels,series,kind?,stacked?,title?}` shape; 19 tests covering every new behavior plus the preserved redraw/mark-sweep/validator paths
- `viewmodel-shell/test/chart-missing-dep.test.ts` - Fixture updated to a reshaped node; fail-loud assertion unchanged
- `demo/Showcase/frontend/src/main.ts` - Chart section reshaped to two `labels`/`series` examples (multi-series bar + donut) with updated explanatory copy

## Decisions Made
- pie/donut ignore a series' `tone` entirely, always cycling the per-slice palette — a single-series pie has no single semantic tone to apply per-slice, and the locked `rendering_spec` only specifies `tone` for the bar/line/area per-series path.
- Legend display implemented exactly per the locked rule (`series.length > 1 || isPie`) — single-series bar/line/area stays legend-less, matching the 4.1 behavior with zero visual regression.
- Area's fill color reuses the same resolved token as the stroke (no invented alpha-blend) — "token-derived" per the locked spec wording, nothing beyond what the design doc called for.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria were met without needing any Rule 1-4 deviation: `browser.ts` compiled clean on the first pass, both test files passed on the first `vitest run` (including the `getComputedStyle` stub approach for palette/tone assertions), and the Showcase reshape compiled via `vite build` with the only `tsc --noEmit` noise being pre-existing, unrelated CSS-module import errors (confirmed present regardless of this change and never referencing the chart section).

## Issues Encountered

None. The full green-tree gate was not re-run in this plan (parity, `check:core-globals`, `.NET` tests, and demo `*.Tests.csproj` projects are out of this plan's explicit scope per its file list) — the package's own `npx vitest run` (46 files, 546 passed / 1 pre-existing skip) and `npx tsc --noEmit` (zero errors) were both confirmed green, consistent with the plan's stated `<verification>` section.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The widened `chart()`/`loadChart()` is the rendering surface 18-04 (TUI adapter) and 18-05 (parity fixture widening) build against next.
- Known, expected out-of-scope items (per the 18-01 SUMMARY and this plan's explicit file list, unaffected by this plan): the FeatureProbe demos (.NET + bun) and `tui.tsx` still reference the retired single-series shape — these are 18-04/18-05's scope, not touched here.
- No blockers for 18-04/18-05. The reshaped Showcase demo, the two rewritten test files, and the widened `browser.ts` are all independently green.

---
*Phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 4 modified files confirmed present on disk; all 3 commit hashes (98ed11a, bb0e320, db19096) confirmed present in `git log`.
