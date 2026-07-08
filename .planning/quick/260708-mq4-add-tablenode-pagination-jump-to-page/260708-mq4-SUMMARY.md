---
phase: 260708-mq4-add-tablenode-pagination-jump-to-page
plan: 01
subsystem: ui
tags: [viewmodel-shell, table, pagination, dotnet, typescript, parity]

requires: []
provides:
  - "TablePagination.jumpAction (TS) / .JumpAction (.NET) — optional jump-to-page control on TableNode's server-driven pagination footer"
  - "Renderer 'Page [N] of TOTAL  Go' control, clamp-or-ignore submit logic, Enter-to-submit"
  - "FeatureProbe demo + parity fixture exercising a valid direct jump and a server-side out-of-range clamp across dotnet/bun/node backends"
affects: [viewmodel-shell-frontend, viewmodel-shell-dotnet, demo-featureprobe, parity-suite]

tech-stack:
  added: []
  patterns:
    - "New TablePagination field follows the existing prevAction/nextAction convention: ActionEvent/ActionDescriptor?, WhenWritingNull on .NET, recorded in both action-uniqueness walkers (server.ts collectActions, ViewModels.cs Collect)."
    - "Client-side clamp is a UX nicety only — the real trust boundary is the pre-existing server-side clamp in each demo's Window()/tableWindow(), unchanged by this plan."

key-files:
  created: []
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/src/server.ts
    - viewmodel-shell/styles/default.css
    - viewmodel-shell/test/table-selection-pagination.test.ts
    - viewmodel-shell/src/tree-walker.test.ts
    - viewmodel-shell-dotnet/ViewModels.cs
    - viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - demo/FeatureProbe-bun/handler.ts
    - parity/fixtures/feature-probe.json

key-decisions:
  - "Jump control renders between Prev and Next (footer order: ‹ Prev · Page [N] of TOTAL · Go · Next ›), matching the plan's exact placement."
  - "No version bump, publish, tag, or CHANGELOG/MIGRATION edit — left for the operator's separate release ritual, per the plan constraints."

patterns-established:
  - "A third TablePagination action (jumpAction) reusing the existing paginationBind write + ActionEvent dispatch mechanism, with zero new wire shape and no context field — the template for any future pagination control."

requirements-completed: [MQ4-01]

duration: ~35min
completed: 2026-07-08
---

# Quick Task 260708-mq4: Add jump-to-page to TableNode pagination Summary

**Added `TablePagination.jumpAction` (TS + .NET, byte-aligned) with a rendered "Page [N] of TOTAL  Go" control, clamp-or-ignore submit semantics, and a parity fixture proving both backends clamp out-of-range jumps identically.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 completed
- **Files modified:** 11 (code only; this SUMMARY + STATE/ROADMAP docs handled separately by the orchestrator)

## Accomplishments

- `TablePagination.jumpAction?: ActionEvent` (TS) / `TablePagination.JumpAction` (.NET, nullable `ActionDescriptor`, `WhenWritingNull`) — additive, omitted = no jump control, byte-unchanged existing apps.
- Renderer inserts a "Page [input] of N  Go" control between the existing Prev/Next buttons only when `jumpAction` is set; typed value clamps into `[1, totalPages]` before writing to `paginationBind` and dispatching; non-numeric/empty input is silently ignored (no write, no dispatch); Enter key produces the identical write+dispatch as clicking Go.
- Action-uniqueness walkers (TS `collectActions`, .NET `Collect`) record `jumpAction` alongside `prevAction`/`nextAction`.
- Shipped CSS only (`.vms-table__pagination-jump*`), zero app CSS required; `.vms-table__pagination` gained `flex-wrap: wrap` for intrinsic reflow.
- FeatureProbe demo (AspNetCore + bun/node twin) wired with `table-page-jump` (a no-op dispatch arm — the pre-existing server-side `Math.Clamp`/`Math.min+Math.max` in `Window()`/`tableWindow()` already re-clamps regardless of what arrives in state).
- Two new parity fixture steps (`tbl-page-jump-valid`, `tbl-page-jump-clamp`) prove a valid direct jump and a 99-page out-of-range jump clamp to page 3 identically across `dotnet-probe`/`bun-probe`/`node-probe` (feature-probe fixture went from 39 to 41 captured steps, all backends agree).

## Task Commits

Each task was committed atomically (code only — this SUMMARY and STATE/ROADMAP updates are handled separately by the orchestrator):

1. **Task 1: TS package — type, renderer, action-walker, CSS, tests** - `8870347` (feat)
2. **Task 2: .NET mirror, FeatureProbe demo wiring, parity fixture** - `de23159` (feat)
3. **Task 3: Green-tree gate** - no code changes; verification only (see Gate Results below)

## Files Created/Modified

- `viewmodel-shell/src/index.ts` — `TablePagination.jumpAction?: ActionEvent` field + doc comment
- `viewmodel-shell/src/browser.ts` — jump-control renderer (label, number input, "of N" label, Go button), shared `submitJump()` closure for click + Enter, clamp-or-ignore logic
- `viewmodel-shell/src/server.ts` — `collectActions` records `table.pagination?.jumpAction`
- `viewmodel-shell/styles/default.css` — `flex-wrap` on `.vms-table__pagination`; new `.vms-table__pagination-jump`/`-jump-label`/`-jump-input` rules
- `viewmodel-shell/test/table-selection-pagination.test.ts` — new `describe("TableNode pagination — jump-to-page")` block, 6 tests, `pagedWithJump()` fixture (existing `paged()` fixture/tests untouched)
- `viewmodel-shell/src/tree-walker.test.ts` — extended the pagination-uniqueness fixture with `jumpAction: { name: "page-jump" }`
- `viewmodel-shell-dotnet/ViewModels.cs` — `TablePagination.JumpAction` (nullable `ActionDescriptor`, `WhenWritingNull`) + `Collect()` recording
- `viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs` — extended `Validate_FullTableWithSortFilterPagination_AllUnique_Passes` with `JumpAction: new("page-jump")`
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — `JumpAction` on the table `Pagination`, `table-page-jump` no-op dispatch arm
- `demo/FeatureProbe-bun/handler.ts` — mirrors the above (`jumpAction` in `pagination`, `table-page-jump` no-op arm; shared by `bun-probe` and `node-probe`)
- `parity/fixtures/feature-probe.json` — two new steps (`tbl-page-jump-valid`, `tbl-page-jump-clamp`) + extended `$comment`

## Decisions Made

- Jump control placed between Prev and Next per the plan's exact spec (footer order "‹ Prev  Page [N] of TOTAL  Go  Next ›").
- No version bump / publish / tag / CHANGELOG / MIGRATION edit — deferred to the operator's separate release step, as instructed.
- No workaround/app-side patching — this is an additive framework primitive per the VMS shell policy, implemented directly in both framework packages.

## Deviations from Plan

None - plan executed exactly as written. All 3 tasks completed with no auto-fixes, no blockers, no architectural questions.

## Issues Encountered

None. Every verification step in the plan passed on the first attempt:
- Task 1: `npx vitest run table-selection-pagination.test.ts tree-walker.test.ts` — 35 tests passed (3 files) on first run.
- Task 2: `.NET` build clean, `dotnet test Tests` — 102/102 passed; `bun run parity/run.ts` — all backends agree, feature-probe fixture 41/41/41 steps captured across dotnet/bun/node-probe.
- Task 3: full green-tree gate — all green (details below).

## Green-Tree Gate Results (Task 3)

All run with `export PATH="$HOME/.dotnet:$PATH"` in effect, in the order specified by AGENTS.md's "NEVER PUBLISH OR PUSH ANYTHING BROKEN" rule:

| Suite | Command | Result |
|---|---|---|
| Full framework test suite | `cd viewmodel-shell && npx vitest run` | **46 test files passed, 534 tests passed, 1 skipped (535 total)** |
| Core-globals guard | `npm run check:core-globals` | **PASS** — `src/index.ts` references zero platform globals |
| Full cross-backend parity suite | `bun run parity/run.ts` | **PASS** — every fixture backend group reports "✓ all backends agree" (tasks 8/8, contacts 11/11, retro 9/9, expenses 8/8, helpdesk 28/28, feature-probe 41/41/41 across 3 backends, feature-probe-envelope 5/5/5, reorder 11/11); skill parity byte-identical (source 13459B, HTTP twins 13714B) |
| Framework .NET tests | `dotnet test viewmodel-shell-dotnet/Tests --nologo` | **PASS — 102/102, 0 failed, 0 skipped** |
| `demo/Tasks/AspNetCore.Tests` | `dotnet test ... --nologo` | **PASS — 28/28** |
| `demo/ContactManager/AspNetCore.Tests` | `dotnet test ... --nologo` | **PASS — 39/39** |
| `demo/RetroBoard/AspNetCore.Tests` | `dotnet test ... --nologo` | **PASS — 33/33** (pre-existing xUnit2013 style warnings only, no failures) |
| `demo/HelpDesk/AspNetCore.Tests` | `dotnet test ... --nologo` | **PASS — 52/52** |
| `demo/ExpenseTracker/AspNetCore.Tests` | `dotnet test ... --nologo` | **PASS — 29/29** (one pre-existing unrelated CS0028 warning, no failures) |

**Zero failures across every suite.** No pre-existing red tests were found; nothing needed fixing beyond the plan's own scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The framework primitive is complete, tested, and parity-clean in both packages. Ready for the operator's separate release ritual (version bump + `npm publish` / `dotnet nuget push` + tag + CHANGELOG/MIGRATION entries) after a visual check — none of that was performed here, per the plan's explicit constraint.
- No blockers or concerns.

---
*Quick task: 260708-mq4-add-tablenode-pagination-jump-to-page*
*Completed: 2026-07-08*
