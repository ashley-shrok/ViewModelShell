---
phase: 32-column-filter-expansion-phase-1-wire-types-reference-truth-f
plan: "04"
subsystem: release-gating
tags: [green-tree-gate, changelog, phase-32, column-filter]
dependency_graph:
  requires: [32-03]
  provides: [green-tree-gate-verified, changelog-unreleased-staged]
  affects: [CHANGELOG.md]
tech_stack:
  added: []
  patterns: [keep-a-changelog-unreleased]
key_files:
  created: []
  modified:
    - CHANGELOG.md
    - demo/FeatureProbe-bun/handler.ts
decisions:
  - "Rule 1 bug fix in FeatureProbe-bun/handler.ts: operator cast via FilterDescriptor[\"rules\"][0][\"operator\"] since FilterRule is not imported in that file"
  - "CHANGELOG.md lives at repo root (not viewmodel-shell/ subdirectory)"
  - "Gate 11 fix: bun install in demo/FeatureProbe-bun required to resolve local @ashley-shrok/viewmodel-shell (link:) instead of Bun global cache at v9.2.1"
metrics:
  duration: "~45 minutes (including parity suite 300s run)"
  completed: "2026-08-18"
  tasks_completed: 1
  files_changed: 2
---

# Phase 32 Plan 04: Green-Tree Gate + CHANGELOG Staging Summary

**One-liner:** Full 11-command green-tree gate passes; `## Unreleased` CHANGELOG entry staged for Phase 32's typed column filter wire vocabulary and `matchesFilter`/`FilterHelper.MatchesFilter` reference truth function.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1a | Green-tree gate (11 commands) + Rule 1 bug fix | 5d18a80 | demo/FeatureProbe-bun/handler.ts |
| 1b | Stage CHANGELOG Unreleased entry | c984cae | CHANGELOG.md |

## Green-Tree Gate Results (All 11 Commands — Exit 0)

| # | Command | Exit | Notes |
|---|---------|------|-------|
| 1 | `npm run build` | 0 | dist/ rebuilt including matchesFilter |
| 2 | `npm run check:test-types` | 0 | |
| 3 | `npm run check:core-globals` | 0 | |
| 4 | `npm run check:aa-contrast` | 0 | 13/13 pairs on all themes |
| 5 | `npm run check:no-demo-style` | 0 | |
| 6 | `npm run check:demo-types` | 0 | After Rule 1 fix to handler.ts |
| 7 | `npx vitest run` | 0 | 87 files, 1561 passed, 1 skipped |
| 8 | `dotnet test viewmodel-shell-dotnet/Tests` | 0 | 622 passed |
| 9 | `demo *.Tests.csproj` | 0 | 5 projects: Tasks(28), RetroBoard(33), ContactManager(39), HelpDesk(61), ExpenseTracker(30) |
| 10 | `dotnet build Markdown companion` | 0 | |
| 11 | `bun run parity/run.ts` | 0 | All backends agree; skill byte-identical (35141B/35196B); column-filter-wire-shape + column-filter-helper fixtures green |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FeatureProbe-bun/handler.ts type error (Phase 32 Plan 03 leftover)**
- **Found during:** Gate 6 (check:demo-types)
- **Issue:** `probe.operator` typed as `string` not assignable to the closed operator union for `FilterRule.operator`. Fix attempt using `FilterRule["operator"]` failed because `FilterRule` is not imported in handler.ts — only `FilterDescriptor` is imported.
- **Fix:** `probe.operator as FilterDescriptor["rules"][0]["operator"]` — accesses the operator union via `FilterDescriptor`'s own rules array element type, requiring no additional import.
- **Files modified:** `demo/FeatureProbe-bun/handler.ts` (line 2092)
- **Commit:** 5d18a80

**2. [Rule 3 - Blocking] Bun global cache shadowed local matchesFilter (Gate 11)**
- **Found during:** Gate 11 (parity)
- **Issue:** `bun-probe` crashed with `SyntaxError: Export named 'matchesFilter' not found in module '/home/thenasty/.bun/install/cache/@ashley-shrok/viewmodel-shell@9.2.1@@@1/dist/server.js'`. The `demo/FeatureProbe-bun/` directory had no `node_modules/` (gitignored; not pre-seeded in worktree), so Bun resolved `link:@ashley-shrok/viewmodel-shell` from its global cache at v9.2.1, which predates Phase 32.
- **Fix:** `cd demo/FeatureProbe-bun && bun install` — created local node_modules with symlink resolving to the worktree's `viewmodel-shell/` (which has Phase 32's matchesFilter in dist/server.js). bun.lock unchanged; node_modules gitignored.
- **Files modified:** none (node_modules is gitignored; bun.lock unchanged)
- **Commit:** N/A (no file change; runtime fix)

## CHANGELOG.md Entry (Staged)

Inserted `## Unreleased` section at the top of `CHANGELOG.md` (repo root) above `## 9.2.1`, with `### Added` bullets documenting:
1. Typed column filter wire vocabulary (FilterSpec, FilterDescriptor, FilterRule, ValueKind, MatchingHint, per-type operator aliases; both backends)
2. Reference truth function (matchesFilter on TS server subpath; FilterHelper.MatchesFilter on .NET main package; full operator × kind matrix)
3. Parity coverage (wire-shape + helper fixtures; NASA-level in-process suites on both backends)

No version bump, no MIGRATION.md entry, no publish. Phase 33 owns the release ritual.

## Phase 32 SPEC Acceptance Criteria — All 13 Satisfied

| Criterion | Satisfied by | Evidence |
|-----------|-------------|----------|
| REQ-CF1-01: FilterSpec on TableColumn (TS) | Plan 32-01 | viewmodel-shell/src/index.ts; commit 11c5163 |
| REQ-CF1-02: FilterDescriptor/FilterRule types (TS + .NET) | Plans 32-01, 32-02 | index.ts + ViewModels.cs; commits 11c5163, 2f262d3 |
| REQ-CF1-03: Wire serialization byte-identical across backends | Plan 32-03 | parity fixture column-filter-wire-shape.json; Gate 11 green |
| REQ-CF1-04: matchesFilter on TS server subpath | Plan 32-01 | viewmodel-shell/src/server.ts; commit 944eda4 |
| REQ-CF1-05: FilterHelper.MatchesFilter on .NET | Plan 32-02 | viewmodel-shell-dotnet/FilterHelper.cs; commit 47725fe |
| REQ-CF1-06: NASA-level vitest suite (162 cases) | Plan 32-01 | 87 test files, 1561 passed — Gate 7 green |
| REQ-CF1-07: NASA-level xUnit suite (126 cases) | Plan 32-02 | 622 passed — Gate 8 green |
| REQ-CF1-08: Parity fixture byte-identical helpers | Plan 32-03 | parity fixture column-filter-helper.json; Gate 11 green |
| No breakage of existing filterable/filterValue wire | Plans 32-01, 32-02 | Old fields untouched in index.ts + ViewModels.cs |
| FeatureProbe-bun type error fixed | This plan (Rule 1) | handler.ts; commit 5d18a80; Gate 6 green |
| Parity wire-shape fixture passes | Plan 32-03 + Gate 11 | column-filter-wire-shape.json — includes is-empty absent value field |
| CHANGELOG Unreleased staged | This plan | CHANGELOG.md; commit c984cae |
| No publish / no tag / no MIGRATION.md | This plan | Version 9.2.1 unchanged; MIGRATION.md unchanged |

## Mutation-Verify Cross-Reference (from Plans 32-01 and 32-02)

Per Plan 32-01 SUMMARY (commit 944eda4): 8/8 matchesFilter operator stubs mutation-verified in vitest. Per Plan 32-02 SUMMARY (commit 47725fe): 7/7 FilterHelper.MatchesFilter stubs mutation-verified in xUnit. Note from 32-03: "Mutation-verify requires rebuilding dist/server.js after applying the source stub — the bun/node-probe backends load dist/server.js not the raw TypeScript source."

## Known Stubs

None. All operator × kind combinations are implemented (not stubbed) in both backends as confirmed by mutation-verify results from Plans 32-01 and 32-02.

## Threat Flags

None. No new network endpoints or auth paths introduced in this plan (gate + CHANGELOG only).

## Self-Check

Checking file existence and commits:
- CHANGELOG.md modified: YES (`grep -c "matchesFilter" CHANGELOG.md` = 1)
- demo/FeatureProbe-bun/handler.ts fix committed: YES (5d18a80)
- CHANGELOG entry committed: YES (c984cae)
- Gate 11 (parity) passed: YES ("✓ Parity tests passed")
- Version unchanged: YES (9.2.1 in package.json)
- MIGRATION.md unchanged: YES (not in git diff)

## Self-Check: PASSED
