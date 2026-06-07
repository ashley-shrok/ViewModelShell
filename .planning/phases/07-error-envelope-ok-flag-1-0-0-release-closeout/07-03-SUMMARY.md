---
phase: 07-error-envelope-ok-flag-1-0-0-release-closeout
plan: "03"
subsystem: framework-demos-wiring
tags: [error-envelope, ShellExceptionFilter, demo-sweep, dotnet, typescript, unknown-action]
dependency_graph:
  requires: [07-01]
  provides: [ShellExceptionFilter-dotnet, demo-sweep-dotnet, demo-sweep-ts, FeatureProbe-boom-both]
  affects:
    - viewmodel-shell-dotnet/ShellExceptionFilter.cs
    - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
    - viewmodel-shell-dotnet/Tests/Tests.csproj
    - viewmodel-shell-dotnet/Tests/ShellExceptionFilterTests.cs
    - demo/Tasks/AspNetCore/Program.cs
    - demo/ContactManager/AspNetCore/Program.cs
    - demo/ExpenseTracker/AspNetCore/Program.cs
    - demo/RetroBoard/AspNetCore/Program.cs
    - demo/HelpDesk/AspNetCore/Program.cs
    - demo/FeatureProbe/AspNetCore/Program.cs
    - demo/Reorder/AspNetCore/Program.cs
    - demo/Tasks/AspNetCore/TasksController.cs
    - demo/ContactManager/AspNetCore/ContactsController.cs
    - demo/ExpenseTracker/AspNetCore/ExpensesController.cs
    - demo/RetroBoard/AspNetCore/RetroBoardController.cs
    - demo/HelpDesk/AspNetCore/AgentController.cs
    - demo/HelpDesk/AspNetCore/RequesterController.cs
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - demo/Reorder/AspNetCore/ReorderController.cs
    - demo/Tasks/AspNetCore.Tests/TasksControllerTests.cs
    - demo/ContactManager/AspNetCore.Tests/ContactsControllerTests.cs
    - demo/ExpenseTracker/AspNetCore.Tests/ExpensesControllerTests.cs
    - demo/RetroBoard/AspNetCore.Tests/RetroBoardControllerTests.cs
    - demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs
    - demo/HelpDesk/AspNetCore.Tests/RequesterControllerTests.cs
    - demo/Tasks-bun/server.ts
    - demo/ContactManager-bun/server.ts
    - demo/ExpenseTracker-bun/server.ts
    - demo/RetroBoard-bun/server.ts
    - demo/HelpDesk-bun/server.ts
    - demo/Reorder-bun/server.ts
    - demo/FeatureProbe-bun/handler.ts
tech_stack:
  added: []
  patterns: [IAsyncExceptionFilter+IAsyncResultFilter, framework-edge-filter, demo-default-arm-throw]
key_files:
  created:
    - viewmodel-shell-dotnet/ShellExceptionFilter.cs
    - viewmodel-shell-dotnet/Tests/ShellExceptionFilterTests.cs
  modified:
    - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
    - viewmodel-shell-dotnet/Tests/Tests.csproj
    - 7 .NET demo Program.cs files (filter registration)
    - 8 .NET controller files (default-arm sweep)
    - 6 .NET demo test files (unknown-action test update)
    - 7 TS demo server/handler files (default-arm sweep)
decisions:
  - "ShellExceptionFilter implements both IAsyncExceptionFilter and IAsyncResultFilter — exception path catches thrown exceptions; result filter rewrites BadRequestObjectResult/BadRequestResult returns (D-08 pattern)"
  - "FrameworkReference Microsoft.AspNetCore.App added to both the main csproj and Tests.csproj — filter uses ASP.NET MVC types; framework Tests project now also has access for filter tests"
  - "InvalidOperationException from ValidateActionNames identified by StackTrace heuristic (contains 'ValidateActionNames') — safe for v1.0.0; can be promoted to dedicated ShellTreeValidationException later"
  - "Test method names renamed from *_ReturnsBadRequest to *_Throws to reflect the new throw-based behavior"
  - "boom action added to FeatureProbe on both backends with exact message 'deliberate test failure' — Plan 04 parity fixture asserts byte-identical messages across all backends"
metrics:
  duration: "11m 1s"
  completed_date: "2026-06-07"
  tasks_completed: 3
  files_created: 2
  files_modified: 36
---

# Phase 7 Plan 03: ShellExceptionFilter + Full Demo Sweep Summary

Framework-edge .NET exception filter created and registered in all 7 .NET demos; all 8 .NET controller default-arms migrated to throw UnknownActionException; all 8 TS dispatch sites migrated to throw UnknownActionError; FeatureProbe gains boom action on both backends; 6 unknown-action unit tests updated to Assert.Throws pattern.

## Tasks Completed

| Task | Description | Commit | Tests |
|------|-------------|--------|-------|
| 1 | ShellExceptionFilter + 7 Program.cs registrations | 3edfab1 | 45/45 (+7 ShellExceptionFilterTests) |
| 2a | .NET controller sweep (8 sites) + 6 test updates + FeatureProbe boom | 569b96b | 172/172 all suites pass |
| 2b | TypeScript demo sweep (8 sites) + FeatureProbe-bun boom | fc0892d | all bun smoke OK |

## ShellExceptionFilter Interface

```csharp
public class ShellExceptionFilter : IAsyncExceptionFilter, IAsyncResultFilter
```

Implements both interfaces to cover:
- **OnExceptionAsync**: Thrown exceptions from controllers — catches UnknownActionException (400), JsonException (400), InvalidOperationException from ValidateActionNames (500), generic Exception (500 + ILogger full stacktrace server-side only)
- **OnResultExecutionAsync**: Controller BadRequestObjectResult / BadRequestResult returns — rewrites to ShellErrorResponse envelope (D-08: no code field)

JSON serialization: `new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }` to match the demo wire convention and TS twin.

## File:Line Changes — .NET Controllers

| Controller | Line (before) | Change |
|---|---|---|
| demo/Tasks/AspNetCore/TasksController.cs | 62 | `return BadRequest(...)` → `throw new UnknownActionException(name)` |
| demo/ContactManager/AspNetCore/ContactsController.cs | 108 | same |
| demo/ExpenseTracker/AspNetCore/ExpensesController.cs | 69 | same |
| demo/RetroBoard/AspNetCore/RetroBoardController.cs | 62 | same |
| demo/HelpDesk/AspNetCore/AgentController.cs | 97 | same |
| demo/HelpDesk/AspNetCore/RequesterController.cs | 101 | same |
| demo/FeatureProbe/AspNetCore/FeatureProbeController.cs | 193 | same (+ boom action added at ~191) |
| demo/Reorder/AspNetCore/ReorderController.cs | 99 | same |

No drift from the planner's verified table.

## File:Line Changes — TypeScript Servers

| File | Line (before) | Change |
|---|---|---|
| demo/Tasks-bun/server.ts | 221 | `throw new BadRequestError("Unknown action: ...")` → `throw new UnknownActionError(name)` |
| demo/ContactManager-bun/server.ts | 302 | same |
| demo/ExpenseTracker-bun/server.ts | 293 | same |
| demo/RetroBoard-bun/server.ts | 233 | same |
| demo/HelpDesk-bun/server.ts | 601 | same |
| demo/HelpDesk-bun/server.ts | 851 | same |
| demo/Reorder-bun/server.ts | 152 | same |
| demo/FeatureProbe-bun/handler.ts | 272 | same (+ boom action added at ~272) |

No drift from the planner's verified table.

## Updated Unknown-Action Unit Tests

| Test File | Old Method Name | New Method Name | New Assertion |
|---|---|---|---|
| Tasks/AspNetCore.Tests/TasksControllerTests.cs | Action_UnknownName_ReturnsBadRequest | Action_UnknownName_Throws | Assert.Throws\<UnknownActionException\>(() => Act(ctrl, ..., "fly-to-moon")) |
| ContactManager/AspNetCore.Tests/ContactsControllerTests.cs | Action_UnknownAction_ReturnsBadRequest | Action_UnknownAction_Throws | Assert.Throws\<UnknownActionException\>(() => Act(ctrl, ..., "teleport")) |
| ExpenseTracker/AspNetCore.Tests/ExpensesControllerTests.cs | Action_UnknownName_ReturnsBadRequest | Action_UnknownName_Throws | Assert.Throws\<UnknownActionException\>(() => Act(ctrl, ..., "fly-to-moon")) |
| RetroBoard/AspNetCore.Tests/RetroBoardControllerTests.cs | Action_UnknownName_ReturnsBadRequest | Action_UnknownName_Throws | Assert.Throws\<UnknownActionException\>(() => Act(ctrl, ..., "blast-off")) |
| HelpDesk/AspNetCore.Tests/AgentControllerTests.cs | UnknownAction_ReturnsBadRequest | UnknownAction_Throws | Assert.Throws\<UnknownActionException\>(() => Act(..., "do-the-thing")) |
| HelpDesk/AspNetCore.Tests/RequesterControllerTests.cs | UnknownAction_ReturnsBadRequest | UnknownAction_Throws | Assert.Throws\<UnknownActionException\>(() => Act(..., "fly-to-moon")) |

## Demo Test Counts (Pre vs Post)

| Demo | Pre-change | Post-change | Note |
|---|---|---|---|
| Tasks | 28 | 28 | one test updated (same count; assert changed not removed) |
| ContactManager | 39 | 39 | same |
| ExpenseTracker | 29 | 29 | same |
| RetroBoard | 33 | 33 | same |
| HelpDesk (Agent+Requester) | 43 | 43 | two tests updated |
| Framework (Tests/) | 38 | 45 | +7 ShellExceptionFilterTests |
| FeatureProbe | no test project | no test project | per plan note |
| Reorder | no test project | no test project | per plan note |

10 input-validation `Assert.IsType<BadRequestObjectResult>` assertions remain unchanged across the 6 test files (D-08: `return BadRequest("title required")` pattern stays in controllers; filter rewrites them on the way out).

## TS Smoke Test Results

| Demo | Result |
|---|---|
| Tasks-bun | OK — started, served, killed cleanly |
| ContactManager-bun | OK |
| ExpenseTracker-bun | OK |
| RetroBoard-bun | OK |
| HelpDesk-bun | OK |
| Reorder-bun | OK |
| FeatureProbe-bun | OK |

## Deviations from Plan

**1. [Rule 2 - Missing capability] Added FrameworkReference to AshleyShrok.ViewModelShell.csproj**
- **Found during:** Task 1 — ShellExceptionFilter.cs uses ASP.NET MVC types (IAsyncExceptionFilter, ExceptionContext, BadRequestObjectResult) which need the framework reference in the main csproj
- **Issue:** The main csproj had no `<FrameworkReference Include="Microsoft.AspNetCore.App" />`, so ShellExceptionFilter.cs failed to compile
- **Fix:** Added FrameworkReference to the main csproj and to Tests.csproj (so tests can use the same types)
- **Files modified:** viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj, viewmodel-shell-dotnet/Tests/Tests.csproj
- **Commit:** 3edfab1

**2. [Rule 1 - Test accuracy] Test method renames for semantic clarity**
- **Found during:** Task 2a — the old method names like `Action_UnknownName_ReturnsBadRequest` and `UnknownAction_ReturnsBadRequest` are now misleading since the controller throws rather than returns
- **Fix:** Renamed all 6 test methods to `*_Throws` variants (e.g., `Action_UnknownName_Throws`) — the plan mentioned this as optional but the rename was applied for correctness. Functionally identical test behavior.
- **Commit:** 569b96b

## Known Stubs

None — all new types are fully implemented and wired. No placeholder data.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. The `ShellExceptionFilter` is within the existing request-handling pipeline — it catches exceptions that would otherwise propagate to ASP.NET's default error handler and returns the same structured response channel that controllers already use. T-07-07 mitigation (T1 information disclosure) is implemented: `OfUncaught` reads only `ex.Message`; full stack traces go to `ILogger` server-side only. The T1 assertion is present and passing in ShellExceptionFilterTests.

## Self-Check: PASSED

- viewmodel-shell-dotnet/ShellExceptionFilter.cs: FOUND
- viewmodel-shell-dotnet/Tests/ShellExceptionFilterTests.cs: FOUND
- 7 Program.cs files registering ShellExceptionFilter: VERIFIED (grep returns 7)
- 8 .NET UnknownActionException throws: VERIFIED (grep returns 8)
- 8 TS UnknownActionError throws: VERIFIED (grep returns 8)
- 6 Assert.Throws\<UnknownActionException\> in test files: VERIFIED (grep returns 6)
- 10 Assert.IsType\<BadRequestObjectResult\> remaining: VERIFIED (grep returns 10)
- 0 stale "Unknown action:" strings: VERIFIED (full sweep returns 0)
- Commit 3edfab1 (Task 1): FOUND
- Commit 569b96b (Task 2a): FOUND
- Commit fc0892d (Task 2b): FOUND
- Framework tests 45/45: PASSED
- All 5 demo test suites (172 total): PASSED
- All bun smoke tests: PASSED
