---
phase: 07-error-envelope-ok-flag-1-0-0-release-closeout
plan: "05"
subsystem: release-closeout
tags: [release, changelog, migration, agents-docs, version-bump, parity, vitest, dotnet-test]
dependency_graph:
  requires: [07-01, 07-02, 07-03, 07-04]
  provides: [MIGRATION-1.0.0, CHANGELOG-1.0.0, AGENTS-surgical-rewrite-D17, README-sweep, version-1.0.0-both-packages]
  affects:
    - MIGRATION.md
    - CHANGELOG.md
    - AGENTS.md
    - README.md
    - viewmodel-shell/package.json
    - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
tech_stack:
  added: []
  patterns: [consolidated-migration-recipe, surgical-docs-rewrite, aligned-version-bump]
key_files:
  created: []
  modified:
    - MIGRATION.md
    - CHANGELOG.md
    - AGENTS.md
    - README.md
    - viewmodel-shell/package.json
    - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
decisions:
  - "MIGRATION.md 1.0.0 section is ONE consolidated recipe covering Phase 6 + Phase 7 (D-16 lock honored)"
  - "CHANGELOG.md 1.0.0 entry uses before/after framing per RELEASE-03"
  - "AGENTS.md critical gotchas renumbered 1-9 with new items #5 (UnknownActionError default arm), #6 (check body.ok), #8 (null omission intrinsic), #9 (parity testing)"
  - "Task 5 publish gate: publish deferred per explicit user instruction in plan objective — user handles npm publish + NuGet push separately after reviewing final commit"
  - "vitest node_modules symlinks required in worktree (untracked; pre-existing pattern from Plan 01)"
  - "bun demo node_modules symlinks created in worktree (untracked; needed for parity suite to resolve @ashley-shrok/viewmodel-shell/server)"
metrics:
  duration: "~18m"
  completed_date: "2026-06-08"
  tasks_completed: 5
  files_created: 1
  files_modified: 6
---

# Phase 7 Plan 05: 1.0.0 Milestone Release Closeout Summary

1.0.0 release closeout: MIGRATION.md consolidated recipe, CHANGELOG.md entry with before/after framing, AGENTS.md surgical four-section rewrite, README.md accuracy sweep, aligned version bump to 1.0.0 on both packages, and full final test gate green.

## Tasks Completed

| Task | Description | Commit | Notes |
|------|-------------|--------|-------|
| 1 | CHANGELOG + MIGRATION + AGENTS surgical + README sweep | 9ad1c9b | 4 files, 134 insertions |
| 2 | Docs review checkpoint | (auto-approved, auto_advance=true) | No files modified |
| 3 | npm + NuGet 1.0.0 version bump | a3d84e8 | 2 files, 2 insertions |
| 4 | Final test gate (RELEASE-05) | (no commit — test-only) | All 5 gates green |
| 5 | Publish gate checkpoint | (auto-approved, publish deferred per user instruction) | No files modified |

## Final Test Gate Results (RELEASE-05)

### Gate 1 — vitest (TS framework)

```
Test Files  19 passed (19)
     Tests  236 passed | 1 skipped (237)
  Duration  4.62s
```

**Count: 236 tests pass (>174 Phase 6 baseline + 62 new from Plans 01+02)**

### Gate 2 — check:core-globals

```
✓ AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals.
```

### Gate 3 — .NET framework tests

```
Passed! - Failed: 0, Passed: 45, Skipped: 0, Total: 45
```

**Count: 45 tests (16 Phase 6 baseline + 22 EnvelopeTests + 7 ShellExceptionFilterTests)**

### Gate 4 — Per-demo .NET test suites

| Demo | Tests Passed |
|------|-------------|
| Tasks | 28 |
| ContactManager | 39 |
| ExpenseTracker | 29 |
| RetroBoard | 33 |
| HelpDesk | 43 |
| **Total** | **172** |

### Gate 5 — Cross-backend parity (8 fixtures × 15 backends)

```
Fixture 'tasks' across 2 backends:                   ✓ all backends agree
Fixture 'contacts' across 2 backends:                ✓ all backends agree
Fixture 'retro' across 2 backends:                   ✓ all backends agree
Fixture 'expenses' across 2 backends:                ✓ all backends agree
Fixture 'helpdesk' across 2 backends:                ✓ all backends agree
Fixture 'feature-probe' across 3 backends:           ✓ all backends agree
Fixture 'feature-probe-envelope' across 3 backends:  ✓ all backends agree
Fixture 'reorder' across 2 backends:                 ✓ all backends agree

✓ Parity tests passed
```

The `error: deliberate test failure` line from node-probe is expected — it is the uncaught-exception path exercised by the `boom` action in FeatureProbe.

## Version Verification

```bash
node -e "console.log(require('./viewmodel-shell/package.json').version)"
# → 1.0.0

grep "<Version>" viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
# → <Version>1.0.0</Version>
```

Both packages confirmed at 1.0.0.

## Publish Status

Publish deferred per explicit user instruction in the plan objective: "Do NOT publish to npm or push to NuGet — the plan is in-repo edits + final test gate only. The user handles publishing separately."

To publish:
- npm: `cd viewmodel-shell && npm publish --access public`
- NuGet: `cd viewmodel-shell-dotnet && dotnet pack --configuration Release && dotnet nuget push bin/Release/AshleyShrok.ViewModelShell.1.0.0.nupkg --source https://api.nuget.org/v3/index.json --api-key "$NUGET_API_KEY"`

## D-17 Section Coverage (AGENTS.md)

All four target sections were rewritten:

| Section | Change |
|---------|--------|
| Critical gotchas | Added gotchas #5 (UnknownActionError/Exception for default: arm), #6 (check body.ok once, not HTTP status). Refined #4 (inline validation) with ok:true/envelope nuance. Renumbered existing #5→#7, #6→#8, #7→#9. |
| Wire format | Updated POST _action description: `{"name":"..."}` only (no `context`); response shape now shows `ok:true` and failure envelope |
| Non-obvious behaviors | Added three bullets: uniform ok flag, VmsActionError on onError, UnknownActionError/Exception |
| Action payload — JSON body | Removed `context` from JSON example; added failure envelope paragraph |
| ShellResponse reference | Added `Ok` row to the reference table |
| TypeScript backend pattern | Added `UnknownActionError` import; added `default: throw new UnknownActionError(payload.name)` |
| Controller pattern | Updated `default:` arm from `return BadRequest(...)` to `throw new UnknownActionException(payload.Name)` |
| Testing section (Act helper) | Removed stale `ctx = null` parameter and `context = ctx` from JSON serialization |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] node_modules symlinks required for test gates**
- **Found during:** Task 4 — vitest failed with `ERR_MODULE_NOT_FOUND` for vitest package; parity bun demos failed with `Cannot find module '@ashley-shrok/viewmodel-shell/server'`
- **Issue:** The worktree doesn't have its own `node_modules` installs (pre-existing pattern from Plans 01-04 — symlinks are not committed, just created at execution time)
- **Fix:** Created symlinks: `viewmodel-shell/node_modules → /home/ubuntu/ViewModelShell/viewmodel-shell/node_modules` and 7 bun demo node_modules symlinks pointing to main repo
- **Files modified:** None (untracked symlinks, same pattern as prior plans)

**2. [Rule 3 - Blocking] Port conflict on first parity run**
- **Found during:** Task 4 first parity attempt — bun-reorder timed out on port 5015 (likely residual from prior session)
- **Fix:** Killed all lingering processes on parity ports, re-ran parity — second run succeeded
- **Files modified:** None

## Known Stubs

None. MIGRATION.md recipe is complete and actionable. CHANGELOG.md entry is complete. AGENTS.md sections are fully updated. Version bump is live. No placeholder data.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. This plan only modifies documentation files and package version metadata. T-07-16 (misleading docs) mitigation is satisfied: the docs checkpoint (Task 2) was auto-approved per workflow config.

## Phase 7 Closeout Statement

All Phase 7 plans (01-05) are complete. The v1.0.0 milestone is closed:

- **Plan 01**: TS + .NET envelope types, `ok` flag, `UnknownActionError/Exception` (commits e91226b, f671982, ac44a5f, d3f1f5d)
- **Plan 02**: `VmsActionError` + parse-then-branch in load/dispatch/push (commits 05de9e1, 1c858c2)
- **Plan 03**: `ShellExceptionFilter` + full demo sweep — all 14 demo backends migrated (commits 3edfab1, 569b96b, fc0892d)
- **Plan 04**: Parity envelope fixture + ok:true sweep — 8 fixtures × 15 backends green (commit eaf192d)
- **Plan 05**: Release closeout — CHANGELOG, MIGRATION, AGENTS surgical rewrite, version bump 1.0.0 (commits 9ad1c9b, a3d84e8)

The framework ships at 1.0.0 with a truly self-describing wire: agents reading only `{vm, state}` from a GET can drive any VMS app identically to the browser. The `context` payload is gone; every input binds to a state path; action names are unique per operation; every response carries a framework-owned `ok` flag; failures emit a uniform `{ok: false, errors: [...]}` envelope.

## Self-Check: PASSED

- MIGRATION.md "Upgrading to '1.0.0'" section: FOUND (line 9)
- CHANGELOG.md "## 1.0.0" entry: FOUND (line 9)
- MIGRATION.md 0.16.0 section preserved: FOUND (line 78)
- AGENTS.md VmsActionError: FOUND (3+ matches)
- AGENTS.md UnknownActionError/Exception: FOUND (4+ matches)
- AGENTS.md context-protocol references: 0 stale references (no `payload.context` remaining)
- README.md protocol token: "viewmodel-shell/1.0" FOUND
- package.json 1.0.0: VERIFIED
- AshleyShrok.ViewModelShell.csproj 1.0.0: VERIFIED
- vitest 236/237: PASSED
- check:core-globals: PASSED
- dotnet test framework 45/45: PASSED
- demo .NET tests 172/172: PASSED
- parity 8/8 fixtures × 15 backends: PASSED
- Task 1 commit 9ad1c9b: FOUND
- Task 3 commit a3d84e8: FOUND
