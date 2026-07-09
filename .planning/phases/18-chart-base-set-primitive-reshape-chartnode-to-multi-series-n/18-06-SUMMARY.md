---
phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n
plan: 06
subsystem: testing
tags: [chartnode, green-tree-gate, vitest, parity, dotnet-test, chart.js, viewmodel-shell]

# Dependency graph
requires:
  - phase: 18-01
    provides: Reshaped ChartNode/ChartSeries wire type in both backends
  - phase: 18-02
    provides: "--vms-chart-1..8 palette tokens in default.css + all 12 themes"
  - phase: 18-03
    provides: Browser adapter multi-series/line/area/pie/donut/stacked rendering
  - phase: 18-04
    provides: TUI ChartView degradation for the reshaped ChartNode
  - phase: 18-05
    provides: Multi-series/tone/stacked FeatureProbe parity fixture + reconciled agent-skill.md
provides:
  - Full green-tree gate proven green post-reshape (vitest, parity, core-globals, aa-contrast, framework .NET Tests, all 5 demo *.Tests.csproj)
  - CHARTBASE-01..06 requirement-to-artifact cross-check table
  - Confirmation that ChartPoint is fully retired from tracked source (incl. a doc-comment reference)
  - Confirmation that core/.NET/bun stay dependency-free (chart.js is a lazy, optional peerDep only in browser.ts)
  - Confirmation that zero raw color crosses the wire in the chart fixture
affects: [phase-19-release-closeout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Green-tree-gate closer plan: owns no source files, only surgical fixes to reach a fully green integrated suite across both backends + parity + demos"

key-files:
  created: []
  modified:
    - viewmodel-shell-dotnet/ViewModels.cs

key-decisions:
  - "Reworded one ViewModels.cs doc comment that literally contained the string 'ChartPoint' (explaining the 4.1→CHARTBASE-01 reshape history) so the plan's strict grep-based retirement check returns nothing, without losing the explanatory content."
  - "Re-ran dotnet test (framework Tests) and the full parity suite after the comment edit to confirm zero behavioral impact before treating the gate as closed."

patterns-established:
  - "A gate acceptance criterion phrased as a literal grep (not just 'the type is gone') is honored literally — even a benign historical comment referencing a retired identifier is reworded rather than left as an accepted near-miss."

requirements-completed: [CHARTBASE-06]

# Metrics
duration: 25min
completed: 2026-07-09
---

# Phase 18 Plan 06: Full Green-Tree Gate + CHARTBASE Requirement Cross-Check Summary

**Proved the entire framework (vitest 552, parity 8 fixture groups + skill twins, core-globals, aa-contrast, framework .NET Tests 109, and all 5 demo *.Tests.csproj totaling 181 tests) fully green after the ChartNode multi-series reshape, with one surgical fix to fully retire the last literal `ChartPoint` reference (a doc comment) from tracked source.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-09T09:41:00Z (approx, per STATE.md `last_updated`)
- **Completed:** 2026-07-09T10:06:00Z (approx)
- **Tasks:** 2 completed
- **Files modified:** 1 (`viewmodel-shell-dotnet/ViewModels.cs`, comment-only)

## Accomplishments

- Ran the full green-tree gate (5 commands from the plan's `<gate_commands>` block, executed against both this plan's own verify block and the AGENTS.md working-agreement suite) and confirmed everything is green with **zero substantive integration breakage** left over from waves 1–2.
- Found and fixed the one gap: a `ViewModels.cs` doc comment literally spelled out "ChartPoint" while explaining the reshape history, which failed the plan's strict `grep -rn "ChartPoint" ...` acceptance check. Reworded to describe the old shape without the literal identifier; re-verified zero behavioral change.
- Built the CHARTBASE-01..06 requirement-to-artifact cross-check table (below), confirming every requirement traces to a landed artifact and a passing check.
- Confirmed all three cross-cutting invariants from Task 2: zero raw color on the wire, core/.NET/bun stay dependency-free (chart.js only as a lazy dynamic import + optional peerDep in `browser.ts`), and ChartPoint is fully retired.

## Full Green-Tree Gate Log

| # | Command | Result |
|---|---|---|
| 1 | `cd viewmodel-shell && npx vitest run` (jsdom) | **552 passed, 1 skipped** (553 total), 47 test files, 1.68s |
| 2 | `bun run parity/run.ts` | **✓ Parity tests passed** — all 8 fixture groups ("all backends agree" ×8: tasks, contacts, expenses, retro, helpdesk, reorder, feature-probe ×2 dotnet/bun/node combos) + skill source (14614B) + skill HTTP twins (14857B) byte-identical |
| 3 | `cd viewmodel-shell && npm run check:core-globals` | **✓ AGNOSTIC-03**: `src/index.ts` references zero platform globals |
| 4 | `cd viewmodel-shell && npm run check:aa-contrast` | **✓ D-07**: 13/13 pairs meet WCAG-AA on the shipped default + all 12 themes |
| 5 | `dotnet test viewmodel-shell-dotnet/Tests` | **109/109 passed** (0 failed) |
| 5a | `dotnet test demo/Tasks/AspNetCore.Tests` | 28/28 passed |
| 5b | `dotnet test demo/ContactManager/AspNetCore.Tests` | 39/39 passed |
| 5c | `dotnet test demo/RetroBoard/AspNetCore.Tests` | 33/33 passed |
| 5d | `dotnet test demo/ExpenseTracker/AspNetCore.Tests` | 29/29 passed |
| 5e | `dotnet test demo/HelpDesk/AspNetCore.Tests` | 52/52 passed |

Demo test total: **181/181 passed** across all 5 `demo/**/*.Tests.csproj` projects. No `FAILED:` line anywhere. `dotnet` was put on PATH via `export PATH="$HOME/.dotnet:$PATH"` per the plan/AGENTS.md note — required for both the `dotnet test` loop and `bun run parity/run.ts` (its dotnet pre-build step also needs `dotnet` resolvable).

After the ChartPoint-comment fix (see Deviations), the full gate was re-run a second time (dotnet Tests + parity) to confirm zero regression from the edit: 109/109 dotnet Tests, all 8 parity fixture groups + skill twins still green.

## Task Commits

1. **Task 1: Run the full green-tree gate; fix any integration breakage** - `db26f89` (fix)
2. **Task 2: Requirement-to-artifact cross-check + dependency-free confirmation** - verification only, no code change; recorded in this SUMMARY (no separate commit — the plan's `<files>` for Task 2 is "(verification only — recorded in the SUMMARY)")

**Plan metadata:** this SUMMARY commit (docs)

## CHARTBASE Requirement-to-Artifact Cross-Check

| Requirement | Landed Artifact(s) | Passing Check |
|---|---|---|
| **CHARTBASE-01** — Reshaped `ChartNode`/`ChartSeries` wire type in both backends (kind/labels/series/stacked/title); `ChartPoint` retired; optional-field rules honored; both tree-validators fall through the leaf | `viewmodel-shell/src/index.ts` (`ChartNode`, `ChartSeries` interfaces, ~L725-749); `viewmodel-shell-dotnet/ViewModels.cs` (`ChartSeries`/`ChartNode` records, `WhenWritingNull`/`WhenWritingDefault` per gotcha #8); `viewmodel-shell-dotnet/Tests/ChartNodeSerializationTests.cs` (from 18-01) | `dotnet test viewmodel-shell-dotnet/Tests` 109/109 (incl. the serialization tests); `grep -rn "ChartPoint" ...` returns nothing (fixed this plan) |
| **CHARTBASE-02** — `--vms-chart-1..8` palette in `default.css` + every theme; framework-default + optional per-series `tone`; zero raw color on wire; contrast hand-checked | `viewmodel-shell/styles/default.css` (`--vms-chart-1..8` L43+); all 12 files under `viewmodel-shell/styles/themes/*.css` (confirmed 12/12 carry the tokens); re-baselined `check-theme-byte-identity.mjs` (18-02) | `npm run check:aa-contrast` 13/13 pairs × default + 12 themes; `npm run check:theme-byte-identity` (18-02, unaffected by this plan) |
| **CHARTBASE-03** — Browser adapter renders bar/line/area/pie/donut + multi-series + `stacked` via lazy/optional Chart.js; core/.NET/bun stay dependency-free | `viewmodel-shell/src/browser.ts` `loadChart()` (dynamic `import("chart.js")` at L702); `test/chart.test.ts` + `test/chart-missing-dep.test.ts` (18-03) | `npx vitest run` (552 passed, incl. both chart test files); Task 2 grep: `index.ts`/`ViewModels.cs`/bun handler carry no `chart.js` import → "none (good)"; `chart.js` is `peerDependenciesMeta.optional:true` in `package.json` |
| **CHARTBASE-04** — Multi-series + tone + stacked fixture byte-identical TS/.NET | `parity/fixtures/feature-probe.json` (reshaped `$comment` + live chart section, 18-05); `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` + `demo/FeatureProbe-bun/handler.ts` (both emit the multi-series/tone/stacked + explicit-kind ChartNode) | `bun run parity/run.ts` → "✓ all backends agree" for feature-probe (dotnet/bun/node); "no raw color in chart fixture (good)" |
| **CHARTBASE-05** — TUI degrades legibly for the reshaped ChartNode, never crashes | `viewmodel-shell/src/tui.tsx` `ChartView` (L963, L1550+, 18-04); `viewmodel-shell/test/tui-chart.test.ts` | `npx vitest run` (part of the 552 passed) |
| **CHARTBASE-06** — Green-tree gate stays green: vitest, parity, core-globals, framework `.NET Tests`, every `demo/**/*.Tests.csproj` | This plan (18-06), Task 1 | All 5 gate commands green per the log above; `npm run check:aa-contrast` also re-confirmed (listed in this plan's must_haves though not in the original CHARTBASE-06 wording) |

### Cross-cutting invariant confirmations (Task 2)

1. **Zero raw color on the wire.** `grep -nE "#[0-9a-fA-F]{3,8}|rgb\(" parity/fixtures/feature-probe.json | grep -i chart` → no match ("no raw color in chart fixture (good)"). Color is exclusively CSS-token (`--vms-chart-N`) or tone-enum (`danger|warning|success|info`) — never a literal hex/rgb crossing the wire.
2. **core/.NET/bun stay dependency-free.** `grep -n "chart.js" viewmodel-shell/src/browser.ts | grep import` shows exactly the one dynamic `import("chart.js")` inside `loadChart()` (L702). `grep -rn "from \"chart.js\"\|require(.chart.js\|import(\"chart.js\")" viewmodel-shell/src/index.ts viewmodel-shell-dotnet/ViewModels.cs demo/FeatureProbe-bun/handler.ts` → "none (good)": zero chart.js references in core, the .NET backend, or the bun demo handler. `package.json` confirms `chart.js` is listed only under `peerDependencies` + `peerDependenciesMeta.optional: true` (and as a devDependency for the test/build environment) — an app with no `ChartNode` ships zero Chart.js bytes.
3. **ChartPoint fully retired.** Task 1's grep (after this plan's fix) returns nothing across `viewmodel-shell`, `viewmodel-shell-dotnet`, and `demo` (excluding `dist/`/`node_modules`) for the literal string `ChartPoint`.

## Files Created/Modified

- `viewmodel-shell-dotnet/ViewModels.cs` - Reworded a `ChartNode` doc comment to drop the literal string "ChartPoint" (comment-only; no behavioral, serialization, or wire change)

## Decisions Made

- The plan's Task 1 acceptance criterion phrases the ChartPoint-retirement check as a literal `grep -rn "ChartPoint" ...` returning nothing — not "no `ChartPoint` type exists." A doc comment mentioning the retired identifier by name, while harmless in spirit, still matches that grep. Rather than treat it as an acceptable near-miss, reworded the comment to preserve its explanatory value (describing the old `{Points}` shape) without the literal identifier, honoring the acceptance criterion exactly as written.
- After the comment edit, re-ran `dotnet test viewmodel-shell-dotnet/Tests` and the full `bun run parity/run.ts` a second time before considering the gate closed, since the edited file (`ViewModels.cs`) is the shared record type consumed by every .NET demo and the parity harness rebuilds all dotnet backends from source.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] One `ChartPoint` doc-comment reference failed the plan's literal grep check**
- **Found during:** Task 1 (running the acceptance-criteria grep after the 5 gate commands passed)
- **Issue:** `viewmodel-shell-dotnet/ViewModels.cs` carried a doc comment ("Reshaped from the 4.1 single-series `{Points}` shape (ChartPoint retired for category charts)...") that literally contained "ChartPoint," so `grep -rn "ChartPoint" --include=*.ts --include=*.tsx --include=*.cs viewmodel-shell viewmodel-shell-dotnet demo | grep -v /dist/ | grep -v node_modules` returned one line instead of nothing, failing the plan's stated acceptance criterion.
- **Fix:** Reworded the comment to describe the old shape ("the old per-point label/value record is fully retired for category charts") without using the literal identifier. No type, field, or serialization behavior changed — this is prose only.
- **Files modified:** `viewmodel-shell-dotnet/ViewModels.cs`
- **Verification:** Re-ran the grep (exit 1, no matches — "returns nothing"); re-ran `dotnet test viewmodel-shell-dotnet/Tests` (109/109, unchanged); re-ran `bun run parity/run.ts` (all 8 fixture groups + skill twins green, unchanged).
- **Committed in:** `db26f89` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug/gate-compliance)
**Impact on plan:** Purely a doc-comment wording fix to satisfy a literal acceptance-criteria grep; zero behavioral, serialization, or wire impact. No scope creep — no other integration breakage was found across any of the 5 gate commands (vitest, parity, core-globals, aa-contrast, all 6 `dotnet test` invocations), meaning the individual 18-01..18-05 plans left a genuinely clean, fully-integrated tree.

## Issues Encountered

None beyond the single ChartPoint-comment gap documented above. All five gate commands passed on the very first run with zero code changes required; `dotnet` needed to be added to `PATH` (`export PATH="$HOME/.dotnet:$PATH"`) for both the `dotnet test` loop and `bun run parity/run.ts` (whose pre-build step shells out to `dotnet build` for the dotnet-tasks backend), exactly as flagged in the plan's `<gate_commands>` note — not a defect, just the documented environment prerequisite.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 18 (Chart Base Set primitive) is fully closed: the reshaped `ChartNode` wire type, `--vms-chart-1..8` palette, browser rendering, parity, and TUI degradation are all landed and the full green-tree gate is proven green with a clean requirement-to-artifact trace for CHARTBASE-01..06.
- Phase 19 (verification page + `5.0.0` release closeout: publish/tag/announce/CHANGELOG/MIGRATION) is explicitly out of scope here and remains fully open — no release artifacts (version bump, CHANGELOG entry, git tag, npm/NuGet publish) were touched in this plan, per the plan's stated exclusion.
- No blockers. The tree is green and ready for Phase 19 planning.

---
*Phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n*
*Completed: 2026-07-09*

## Self-Check: PASSED

- FOUND: `viewmodel-shell-dotnet/ViewModels.cs`
- FOUND: `.planning/phases/18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n/18-06-SUMMARY.md`
- FOUND commit `db26f89` (Task 1 fix)
- FOUND commit `ee88f1b` (this SUMMARY)
