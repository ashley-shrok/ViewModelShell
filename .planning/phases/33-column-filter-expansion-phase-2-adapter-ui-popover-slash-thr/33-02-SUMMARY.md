---
phase: "33"
plan: "02"
subsystem: wire-migration
tags: [filter, wire-removal, demo-migration, breaking-change]
dependency_graph:
  requires: [33-01]
  provides: [clean-wire-no-old-filter-fields, demo-migration-source]
  affects: [33-03, 33-05]
tech_stack:
  added: []
  patterns: [FilterSpec-on-column, filterDescriptorBinds-on-table, matchesFilter-helper, FilterDescriptor-state]
key_files:
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell-dotnet/ViewModels.cs
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/src/server.ts
    - viewmodel-shell/src/tui.tsx
    - viewmodel-shell/src/tree-walker.test.ts
    - viewmodel-shell/test/renderer-correctness.test.ts
    - demo/Showcase/frontend/src/main.ts
    - demo/HelpDesk-bun/server.ts
    - demo/FeatureProbe-bun/handler.ts
    - demo/HelpDesk/AspNetCore/AgentState.cs
    - demo/HelpDesk/AspNetCore/AgentController.cs
    - demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs
    - demo/ExpenseTracker/AspNetCore.Tests/ExpensesControllerTests.cs
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs
  created:
    - ~/.claude/roles/vms-maintainer/bounties/tui-filter-refresh/bounty.json
decisions:
  - "Showcase cannot use matchesFilter from server subpath (Gotcha #13 — NEVER import server bundle in browser); inline filter logic applied directly against FilterDescriptor.rules instead"
  - "HelpDesk .NET and FeatureProbe .NET demo migrations done inline (Rule 3 deviation) — .NET tests directly broke when old fields were removed; couldn't defer to Plan 03"
  - "AgentControllerTests filter test updated: uses TitleFilterDescriptor with contains-xyzzy rule, dispatches filter-open action, asserts Filter?.Kind=='text' instead of removed FilterValue property"
  - "FeatureProbe TableFilters.Name changed from string to FilterDescriptor? with WhenWritingNull to match AGENTS.md null-omission contract"
  - "TUI filter block commented out (not deleted) to preserve implementation context for the tui-filter-refresh bounty"
  - "filter-* action handler in FeatureProbe catches the new dispatch name (no dedicated filter action needed; descriptor comes via bind state)"
metrics:
  duration_minutes: 80
  tasks_completed: 2
  files_changed: 16
  completed_date: "2026-08-18"
---

# Phase 33 Plan 02: Old Wire Field Removal + 3 TS Demo Migration Summary

Removed all 8 old filter wire fields from both backends and migrated 6 consumer files (3 TS + 3 .NET) to the new typed filter vocabulary (FilterSpec + FilterDescriptor + filterDescriptorBinds).

## What Was Built

**Task 1 — Wire field removal (commit 3c266dc):**

Removed from `viewmodel-shell/src/index.ts` (TableColumn + TableNode):
- `filterable?: boolean`
- `filterValue?: string`
- `filterBinds?: Record<string, string>`
- `filterAction?: ActionEvent`

Removed from `viewmodel-shell-dotnet/ViewModels.cs` (TableColumn + TableNode positional parameters):
- `bool Filterable = false`
- `string? FilterValue = null`
- `Dictionary<string, string>? FilterBinds = null`
- `ActionDescriptor? FilterAction = null`

Also removed:
- Tree-validator call `if (table.FilterAction is { } filter) Record(filter, enclosingForm, sink);` in ViewModels.cs
- The `else if (hasLegacyFilters)` bridge branch in browser.ts (Wave 1 bridge installed by Plan 01)
- `filterAction` tree-walker registration in server.ts
- Test fixtures that referenced removed fields in tree-walker.test.ts and renderer-correctness.test.ts

TUI filter block commented out in tui.tsx with bounty pointer to `tui-filter-refresh`.

Bounty created at `~/.claude/roles/vms-maintainer/bounties/tui-filter-refresh/bounty.json`.

**Task 2 — Consumer migration (commit c91f18a):**

TypeScript demos:
- `demo/Showcase/frontend/src/main.ts` — FilterDescriptor state, inline filter logic (server import prohibited by Gotcha #13), filter:FilterSpec + filterDescriptorBinds
- `demo/HelpDesk-bun/server.ts` — FilterDescriptor|null titleFilterDescriptor state, matchesFilter from server subpath
- `demo/FeatureProbe-bun/handler.ts` — FilterDescriptor|null in TableFilters.name, matchesFilter applied

.NET demos (Rule 3 deviation — migrated inline because tests broke):
- `demo/HelpDesk/AspNetCore/AgentState.cs` — TitleFilter:string → TitleFilterDescriptor:FilterDescriptor?
- `demo/HelpDesk/AspNetCore/AgentController.cs` — SQL filter derived from first contains rule; FilterHelper.MatchesFilter for in-memory post-filtering; FilterSpec("text") on column; FilterDescriptorBinds on table
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — TableFilters.Name to FilterDescriptor?; Window() uses FilterHelper.MatchesFilter; BuildTableSection migrated

Tests fixed:
- `AgentControllerTests.cs` — TitleFilter → TitleFilterDescriptor with contains rule; dispatches filter-open; asserts Filter?.Kind
- `ExpensesControllerTests.cs` — Assert.False(c.Filterable) → Assert.Null(c.Filter)
- `ViewTreeValidationTests.cs` — removed FilterAction from fixture

## Verification Results

```
grep -nE "\b(filterable|filterValue|filterBinds|filterAction)\b" viewmodel-shell/src/index.ts
  → zero matches (exit 1)

grep -nE "\b(Filterable|FilterValue|FilterBinds|FilterAction)\b" viewmodel-shell-dotnet/ViewModels.cs
  → zero matches (exit 1)

npx vitest run: 1561 passed | 1 skipped (87 test files)
npm run check:test-types: clean
npm run check:core-globals: AGNOSTIC-03 passes
npm run check:demo-types: 26 demo projects clean
npm run check:no-demo-style: passes
dotnet test viewmodel-shell-dotnet/Tests: 622 passed
dotnet test demo/HelpDesk/...: 61 passed
dotnet test demo/ExpenseTracker/...: 30 passed
dotnet test demo/ContactManager/...: 39 passed
dotnet test demo/Tasks/...: 28 passed
dotnet test demo/RetroBoard/...: 33 passed

bounty.json status: in_progress
tui-filter-refresh in tui.tsx: 1 match
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] .NET demo test compilation failures from field removal**
- **Found during:** Task 2 (after Task 1 removed the 4 .NET fields)
- **Issue:** `demo/HelpDesk/AspNetCore.Tests` and `demo/ExpenseTracker/AspNetCore.Tests` failed to compile because they referenced `Filterable`, `FilterValue`, `TitleFilter` — all removed in Task 1
- **Fix:** Migrated `AgentState.cs`, `AgentController.cs`, `FeatureProbeController.cs` to new wire inline; updated `AgentControllerTests.cs` and `ExpensesControllerTests.cs` to use new filter API
- **Files modified:** AgentState.cs, AgentController.cs, AgentControllerTests.cs, ExpensesControllerTests.cs, FeatureProbeController.cs
- **Commits:** c91f18a

**2. [Rule 1 - Bug] Showcase cannot import from server bundle**
- **Found during:** Task 2 — Showcase is a browser-only page
- **Issue:** AGENTS.md Gotcha #13 prohibits importing `@ashley-shrok/viewmodel-shell/server` in browser pages; the plan instruction to "use matchesFilter" would trigger the node:fs import → blank page
- **Fix:** Implemented inline filter logic in `visibleRows()` that reads FilterDescriptor.rules directly and applies contains/is/is-not operators without the server import
- **Files modified:** demo/Showcase/frontend/src/main.ts
- **Commits:** c91f18a

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 3c266dc | feat(33-02): remove 8 old wire filter fields; comment out TUI block; create bounty |
| Task 2 | c91f18a | feat(33-02): migrate 3 TS demos + 3 .NET demos to new filter wire |

## Known Stubs

None. All filter columns carry real FilterSpec definitions; all filtering logic reads real FilterDescriptor state. No placeholder data.

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- viewmodel-shell/src/index.ts: zero old filter field matches confirmed
- viewmodel-shell-dotnet/ViewModels.cs: zero old filter field matches confirmed
- viewmodel-shell/src/tui.tsx: bounty comment present
- ~/.claude/roles/vms-maintainer/bounties/tui-filter-refresh/bounty.json: exists, status=in_progress
- All TS + .NET tests green
- Commits 3c266dc + c91f18a verified in git log
