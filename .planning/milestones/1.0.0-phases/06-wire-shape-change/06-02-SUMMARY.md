---
phase: 06-wire-shape-change
plan: 02
subsystem: wire-protocol-validation
tags: [validation, tree-walker, action-name-uniqueness, byte-aligned-backends]
requires:
  - 06-01 (ViewNode types with bind paths, action-name-only ActionEvent / ActionDescriptor)
provides:
  - TS `validateActionNames(vm: ViewNode): void` exported from /server subpath
  - TS `createAction` auto-invokes the validator on every response carrying `vm`
  - .NET `ViewTreeValidation.ValidateActionNames(ViewNode root)` static method
  - .NET `ShellResponse<TState>.Validate()` fluent invocation seam
  - Vitest coverage (13 cases) colocated with the validator
  - Framework-level xUnit test project (`viewmodel-shell-dotnet/Tests/`, 16 [Fact] tests)
affects:
  - viewmodel-shell/vitest.config.ts (include extended to src/**/*.test.ts)
  - viewmodel-shell/tsconfig.json (exclude src/**/*.test.ts from the build)
  - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj (Tests/** excluded
    from the package's compile graph)
  - Plan 06-04 (must call `.Validate()` from every demo controller it migrates)
tech-stack:
  added: []
  patterns: [tree-walker, enclosing-scope-stack, byte-aligned-backends]
key-files:
  created:
    - viewmodel-shell/src/tree-walker.test.ts
    - viewmodel-shell-dotnet/Tests/Tests.csproj
    - viewmodel-shell-dotnet/Tests/GlobalUsings.cs
    - viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs
  modified:
    - viewmodel-shell/src/server.ts
    - viewmodel-shell/vitest.config.ts
    - viewmodel-shell/tsconfig.json
    - viewmodel-shell-dotnet/ViewModels.cs
    - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
decisions:
  - "Enclosing-scope rule: two occurrences of an action name share an operation iff they're inside the SAME non-null FormNode reference. Anything else (different forms, one in/one out of any form, both at page level) is a violation. The strict outside-form heuristic catches the canonical per-row-buttons-missing-row-id bug class — the exact bug the rule exists to prevent."
  - "TS invocation: createAction auto-validates on every response that carries vm, returns 500 on violation (matches the 400-on-parse-error symmetry). Redirect responses are skipped — they have no tree to walk."
  - ".NET invocation: ShellResponse<TState>.Validate() instance method (fluent — returns the same instance). Skipped silently when Vm is null. Plan 06-04 wires .Validate() into every demo controller's return path."
  - "Error surface: TS throws Error, .NET throws InvalidOperationException. Both messages name the colliding action name verbatim and suggest the two fixes (rename one node, or move both into the same enclosing form)."
  - "Framework test project at viewmodel-shell-dotnet/Tests/ supersedes the plan's proposed demo-Tests location, because demo controllers are mid-migration through the planned 06-01 → 06-04 intermediate state and can't compile right now."
metrics:
  duration: "~45min"
  completed: "2026-06-07"
  tasks: 4
  files_created: 4
  files_modified: 5
  commits: 4
---

# Phase 6 Plan 02: Action-Name Uniqueness Tree Walker Summary

Shipped framework-side enforcement of the wire contract's "one action name = one operation" rule. The TS server subpath and the .NET twin both walk a built ViewNode tree, collect every dispatch-bearing action with its enclosing-form context, and throw a distinct error when two occurrences of the same action name don't share the same non-null enclosing FormNode. The rule is structural — a tree-build-time check, not a runtime guess — so the bug class it targets (per-row buttons that forgot to encode the row ID, two distinct Save buttons that collide on `save`) is caught before the tree leaves the server.

## What changed

- **TS `validateActionNames(vm: ViewNode): void`** lives in `viewmodel-shell/src/server.ts`, exported from the `/server` subpath. Walks every dispatch-bearing site identified in 06-01's reshaped types: `FormNode.submitAction`, `FormNode.buttons`, `FieldNode.action`, `CheckboxNode.action`, `ButtonNode.action`, `TabsNode.tabs[].action`, `TableNode.sortActions` values, `TableNode.filterAction`, `TablePagination.prevAction` / `nextAction`, `TableRow.actions[].action`, `ModalNode.dismissAction`. Groups by name; for each group of 2+, the rule is "allowed iff every occurrence is inside the same non-null FormNode reference." Anything else throws with a message containing `Duplicate action name '<name>'`.

- **TS `createAction` wraps the validator.** After the user's handler returns, if `result.vm` is non-null, `validateActionNames(result.vm)` runs before serialization. A violation returns a 500 (matches the 400-on-parse-error symmetry already in the file).

- **.NET `ViewTreeValidation.ValidateActionNames(ViewNode root)`** mirrors the TS walker exactly — same dispatch-site coverage, same enclosing-form heuristic (using `ReferenceEquals` for the FormNode comparison), same error message shape, throws `InvalidOperationException`.

- **.NET `ShellResponse<TState>.Validate()`** instance method invokes the walker on the response's `Vm` (skips when `Vm` is null) and returns the same instance for fluent chaining. Plan 06-04 will wire `.Validate()` into every demo controller's return path; until then the validator is opt-in on .NET.

- **Vitest coverage** at `viewmodel-shell/src/tree-walker.test.ts` — 13 tests: the 10 cases enumerated in the plan plus 3 bonus dispatch-site pins (FieldNode / CheckboxNode / ModalNode.dismissAction colliding with a top-level button) so a future refactor that drops one of those walks turns red here.

- **Framework xUnit coverage** at `viewmodel-shell-dotnet/Tests/` — 16 [Fact] tests: the same 13 cases the TS twin has + 3 ShellResponse.Validate seam tests (Validate runs the walker; returns self on valid trees; skips when Vm is null on redirect responses).

## Verification

- `cd viewmodel-shell && npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --lib ES2022,DOM,DOM.Iterable src/server.ts` exits 0.
- `cd viewmodel-shell && npx vitest run src/tree-walker.test.ts` → 13 tests pass.
- `cd viewmodel-shell && npx vitest run` → 16 test files, 169 tests pass (full suite green; my additions don't regress existing tests).
- `cd viewmodel-shell-dotnet && dotnet build --nologo` → 0 Warning(s), 0 Error(s).
- `cd viewmodel-shell-dotnet/Tests && dotnet test --nologo` → 16/16 pass.
- `grep -c "validateActionNames\|ValidateActionNames" viewmodel-shell/src/server.ts viewmodel-shell-dotnet/ViewModels.cs` → 3 / 4 respectively (non-empty in both).

`viewmodel-shell/src/browser.ts` and the demo controllers (`demo/Tasks/AspNetCore/`, etc.) still surface the type/compile errors documented in 06-01-SUMMARY — that is the planned intermediate state until Plan 03 rewrites browser.ts and Plan 04 migrates the demos. Plan 02's verifications are scoped to the type layer + the new validator surface and pass cleanly there.

## Tasks completed

| Task | Name                                                                | Commit  | Files                                                                                                                                                |
| ---- | ------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | TS validateActionNames + createAction integration                   | c95b316 | viewmodel-shell/src/server.ts                                                                                                                        |
| 2    | Vitest coverage for validateActionNames (13 cases)                  | 5a52f35 | viewmodel-shell/src/tree-walker.test.ts, viewmodel-shell/vitest.config.ts, viewmodel-shell/tsconfig.json                                              |
| 3    | .NET ViewTreeValidation + ShellResponse.Validate() seam             | 8902b76 | viewmodel-shell-dotnet/ViewModels.cs                                                                                                                 |
| 4    | Framework xUnit test project mirroring the TS coverage (16 [Fact])  | 4b01e1c | viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj, viewmodel-shell-dotnet/Tests/Tests.csproj, .../GlobalUsings.cs, .../ViewTreeValidationTests.cs |

## Deviations from Plan

### Rule 3 — Auto-fixed blocking issues

**1. [Rule 3 - Blocking] Vitest discovery for tests under `src/`.**
- **Found during:** Task 2.
- **Issue:** The plan put the new vitest file at `viewmodel-shell/src/tree-walker.test.ts`, but `vitest.config.ts` had `include: ["test/**/*.test.ts"]` — so `npx vitest run src/tree-walker.test.ts` (the plan's verify command) reported "No test files found." The CLI path arg filters the include set, it doesn't override it.
- **Fix:** Extended `include` to `["test/**/*.test.ts", "src/**/*.test.ts"]`. Documented inline why: pure-TS framework tests (no jsdom needed) can colocate with their unit; `test/` remains the home for jsdom adapter / integration suites.
- **Files modified:** `viewmodel-shell/vitest.config.ts`.
- **Commit:** 5a52f35.

**2. [Rule 3 - Blocking] Build hygiene for tests under `src/`.**
- **Found during:** Task 2.
- **Issue:** `viewmodel-shell/tsconfig.json` had `include: ["src/**/*.ts"]` — a `src/*.test.ts` file would be compiled by `tsc -b` (the package's build command) and end up in `dist/` and the published NuGet/npm tarball.
- **Fix:** Added `src/**/*.test.ts` to the tsconfig `exclude` list, alongside the existing TUI excludes. Verified with `tsc -b tsconfig.json` (test file not in the compile graph; remaining errors are the expected 06-01 → 06-03 intermediate state in `browser.ts`).
- **Files modified:** `viewmodel-shell/tsconfig.json`.
- **Commit:** 5a52f35.

**3. [Rule 3 - Blocking] Test project location for .NET coverage.**
- **Found during:** Task 4.
- **Issue:** The plan instructed Task 4 to place tests at `demo/Tasks/AspNetCore.Tests/ViewTreeValidationTests.cs`. The test project there transitively `ProjectReference`s `demo/Tasks/AspNetCore/ViewModelShell.csproj`, which is mid-migration through the planned 06-01 intermediate state (`payload.Context` references, two-arg `ActionDescriptor` calls). Dotnet test there currently exits 1 with `CS1061: 'ActionPayload<TasksState>' does not contain a definition for 'Context'` — Plan 04 will fix this. There is no way to get a green test signal for the new validator from the demo Tests project at this wave point.
- **Fix:** Created a standalone framework-level test project at `viewmodel-shell-dotnet/Tests/` (`Tests.csproj`, `GlobalUsings.cs`, `ViewTreeValidationTests.cs`) that ProjectReferences only the framework csproj. The 13 TS-twin cases plus 3 ShellResponse.Validate seam tests live there. The framework csproj gains `Compile Remove="Tests/**"` so the new test files don't bloat the shipped NuGet's compile graph. Tests target `net9.0` (the installed SDK runtime); the framework stays on `net8.0` to keep the NuGet floor.
- **Plan's `<done>` for Task 4 explicitly allows this:** ".NET test coverage in place OR deferral documented." — we landed coverage rather than deferring, just in a different project.
- **Files modified / created:** `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` (Tests exclude), `viewmodel-shell-dotnet/Tests/Tests.csproj` (new), `viewmodel-shell-dotnet/Tests/GlobalUsings.cs` (new), `viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs` (new).
- **Commit:** 4b01e1c.

### Non-deviation note

The plan's Task 2 acceptance criterion says "9 vitest tests" and the verify command line says "passes 9 tests," but the action lists 10 case scenarios. I shipped all 10 cases (every one in the plan's action) plus 3 bonus dispatch-site coverage tests for a total of 13. The discrepancy looks like a minor authoring slip in the plan; the acceptance criteria's structural ask — "All test cases listed in action above are present (grep for the test names)" — is satisfied.

## Known Stubs

None.

## Threat Flags

None. This plan adds a server-side validation function and its tests; no new endpoints, auth paths, file/data-trust-boundary surfaces, or schema changes. The validator's error path returns 500 on violation — an internal server bug, not an attacker-controllable surface (the rule fires on the *server-built* tree, before serialization).

## Self-Check: PASSED

- `viewmodel-shell/src/server.ts` exists and contains `export function validateActionNames` (1 occurrence) and `validateActionNames(result.vm)` invocation in `createAction` (1 occurrence).
- `viewmodel-shell-dotnet/ViewModels.cs` exists and contains `public static class ViewTreeValidation` (1), `ValidateActionNames` (3), `public ShellResponse<TState> Validate()` (1).
- `viewmodel-shell/src/tree-walker.test.ts` exists; `npx vitest run src/tree-walker.test.ts` → 13 tests pass.
- `viewmodel-shell-dotnet/Tests/Tests.csproj` + `Tests/ViewTreeValidationTests.cs` exist; `dotnet test --nologo` → 16/16 pass.
- Commits c95b316, 5a52f35, 8902b76, 4b01e1c are present in `git log --oneline -5`.
- `cd viewmodel-shell-dotnet && dotnet build --nologo` → 0 Warning(s), 0 Error(s).
