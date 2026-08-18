---
phase: 33-column-filter-expansion-phase-2-adapter-ui-popover-slash-thr
plan: "03"
subsystem: demo-migration
tags:
  - filter-wire-migration
  - helpdesk
  - featureprobe
  - expensetracker
  - FilterSpec
  - FilterDescriptor
  - FilterHelper

dependency_graph:
  requires:
    - 33-01  # adapter filter-row rebuild (browser.ts popover)
    - 33-02  # old wire field removal from ViewModels.cs + index.ts
  provides:
    - HelpDesk AgentController migration (MIGRATION.md reference source D-05)
    - ExpenseTracker test migration
    - FeatureProbe controller migration
  affects:
    - demo/HelpDesk/AspNetCore/
    - demo/ExpenseTracker/AspNetCore.Tests/
    - demo/FeatureProbe/AspNetCore/

tech_stack:
  added: []
  patterns:
    - FilterHelper.MatchesFilter for in-memory row filtering
    - Dictionary<string, FilterDescriptor?> for per-column filter state
    - FilterDescriptorBinds on TableNode to wire state paths
    - FilterSpec("text") on TableColumn to declare filter kind
    - FilterDescriptor? with [JsonIgnore WhenWritingNull] for nullable state fields

key_files:
  created: []
  modified:
    - demo/HelpDesk/AspNetCore/AgentState.cs
    - demo/HelpDesk/AspNetCore/AgentController.cs
    - demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs
    - demo/ExpenseTracker/AspNetCore.Tests/ExpensesControllerTests.cs
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs

decisions:
  - "Use Dictionary<string, FilterDescriptor?> FilterDescriptors in AgentState to keep state open for future filterable columns (HelpDesk) vs per-column fields"
  - "Fetch all tickets by status then filter in-memory via FilterHelper.MatchesFilter in HelpDesk AgentController (removes dependency on DB LIKE filter)"
  - "Collapse filter-text action case into general filter-* handler in HelpDesk (filter descriptors already in state via bind)"
  - "Remove table-filter action case entirely in FeatureProbe — new wire writes descriptor to state at bind path on keystroke; no separate action needed"
  - "Add FilterDescriptor? NameFilter field to FeatureProbeState (not a generic dict) per plan guidance; WhenWritingNull per gotcha #8"

metrics:
  duration: "~4 minutes"
  completed: "2026-08-18"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 5
---

# Phase 33 Plan 03: .NET Demo Filter Wire Migration Summary

Migrated 5 .NET files (AgentState + AgentController + AgentControllerTests + ExpensesControllerTests + FeatureProbeController) from the Phase 32 legacy filter wire to the new typed filter wire using FilterSpec, FilterDescriptorBinds, and FilterHelper.MatchesFilter.

## What Was Built

HelpDesk AgentController.cs is now the MIGRATION.md reference source (D-05): `FilterSpec("text")` on the Title column; `FilterDescriptorBinds: { ["title"] = "filterDescriptors.title" }` on the TableNode; two new static helpers (`MatchesFilters` + `GetCellInfo`) in the controller; all ticket fetching goes through `db.GetMatching(status, "", MaxValue)` followed by in-memory `FilterHelper.MatchesFilter` application.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | HelpDesk AgentController + tests | ec623e1 | AgentState.cs, AgentController.cs, AgentControllerTests.cs |
| 2 | ExpenseTracker tests + FeatureProbe | eb26d32 | ExpensesControllerTests.cs, FeatureProbeController.cs |

## Test Results

- `dotnet test demo/HelpDesk/AspNetCore.Tests/` — 61/61 passed
- `dotnet test demo/ExpenseTracker/AspNetCore.Tests/` — 30/30 passed
- `dotnet build demo/FeatureProbe/AspNetCore/FeatureProbe.csproj` — BUILD SUCCEEDED (0 errors, 0 warnings)
- `grep Filterable|FilterValue|FilterBinds|FilterAction demo/HelpDesk/AspNetCore/ demo/FeatureProbe/AspNetCore/ demo/ExpenseTracker/AspNetCore.Tests/` — zero matches

## Key Migration Pattern (MIGRATION.md Reference — D-05)

**Before (AgentController.cs):**
```csharp
// State:
string TitleFilter

// BuildVm:
new TableColumn("title", "Title", Filterable: true,
    FilterValue: state.TitleFilter.Length > 0 ? state.TitleFilter : null),
// ...
FilterBinds: new Dictionary<string, string> { ["title"] = "titleFilter" },
FilterAction: new ActionDescriptor("filter-text"),

// Action handler:
else if (name == "filter-text") {
    state = state with { ... };
}

// DB call + filter:
var matching = db.CountMatching(status, state.TitleFilter);
var tickets = withinCap ? db.GetMatching(status, state.TitleFilter, Cap) : new List<Ticket>();
```

**After (AgentController.cs):**
```csharp
// State:
Dictionary<string, FilterDescriptor?> FilterDescriptors

// BuildVm:
new TableColumn("title", "Title", Filter: new FilterSpec("text")),
// ...
FilterDescriptorBinds: new Dictionary<string, string> { ["title"] = "filterDescriptors.title" },
// (no FilterAction)

// Action handler — filter-* cases merged:
if (name.StartsWith("filter-")) {
    state = state with { SelectedIds = new(), BulkSelection = [] };
}

// In-memory filter via FilterHelper:
var allByStatus = db.GetMatching(status, "", int.MaxValue);
var filtered = allByStatus.Where(t => MatchesFilters(state, t)).ToList();

private static bool MatchesFilters(AgentState state, Ticket ticket) {
    foreach (var (colKey, descriptor) in state.FilterDescriptors) {
        if (descriptor == null || descriptor.Rules.Count == 0) continue;
        var (raw, display, kind) = GetCellInfo(ticket, colKey);
        if (!FilterHelper.MatchesFilter(descriptor, raw, display, kind)) return false;
    }
    return true;
}
```

## Deviations from Plan

### Infra deviation — worktree behind main

**Found during:** Task 1 (compile step)

**Issue:** The worktree was created at main HEAD `b84a58e` (v9.2.1 release) before Phase 32 and 33-01/33-02 were merged into main. The worktree's ViewModels.cs lacked `FilterSpec`/`FilterDescriptor`/`FilterHelper`, causing CS0246 compile errors.

**Fix:** `git merge main --ff-only` — the worktree branch had no divergent commits, so a fast-forward merge pulled in Phase 32 (FilterSpec/FilterDescriptor types + FilterHelper.cs) and Phase 33-01/33-02 (old wire field removal) cleanly. Working file changes (AgentState.cs etc.) were preserved across the merge.

**Files modified:** none (git operation only)

**Rule:** Rule 3 (auto-fix blocking issue). No new packages were installed.

### Additional infra — TipTap npm install

**Found during:** Task 1 (frontend build triggered by dotnet test MSBuild target)

**Issue:** `viewmodel-shell/node_modules/@tiptap` was not installed in the worktree (Phase 28 added TipTap to the main repo's node_modules; worktree has its own copy).

**Fix:** `npm install` in both `viewmodel-shell/` and `demo/HelpDesk/frontend/` within the worktree.

**Rule:** Rule 3 (auto-fix blocking issue). No new packages — packages were already in package.json; this was a missing `npm install` in the worktree environment.

## No Test Project for FeatureProbe .NET

`find demo/FeatureProbe -name "*.Tests.csproj"` returns nothing. FeatureProbe has no .NET test project. Verification was performed via `dotnet build` (compile check only). This is pre-existing — no test project was added as part of this plan. Documented as a known gap.

## Known Stubs

None. All migrated code paths are fully wired. The `MatchesFilters()` helper in AgentController processes all columns in `state.FilterDescriptors`, and `GetCellInfo()` has a default `_` arm returning `(null, "", "text")` for unknown column keys — this is safe and intentional (FilterHelper returns `true` for null raw values on operators like "is-empty").

## Threat Flags

None. All changes are internal app-state processing using the Framework's own `FilterHelper.MatchesFilter`. No new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- AgentController.cs: FOUND
- AgentState.cs: FOUND
- AgentControllerTests.cs: FOUND
- ExpensesControllerTests.cs: FOUND
- FeatureProbeController.cs: FOUND
- Commit ec623e1 (Task 1): FOUND
- Commit eb26d32 (Task 2): FOUND
