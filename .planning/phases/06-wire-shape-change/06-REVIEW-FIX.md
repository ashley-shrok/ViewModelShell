---
phase: 06-wire-shape-change
fixed_at: 2026-06-07T20:38:00Z
review_path: .planning/phases/06-wire-shape-change/06-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-06-07T20:38:00Z
**Source review:** .planning/phases/06-wire-shape-change/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01 + WR-01 through WR-08)
- Fixed: 9
- Skipped: 0
- Info findings (IN-01 through IN-06): not in scope (deferred per `--fix critical_warning` scope)

**Sanity-check results (run from worktree before report write):**
- `viewmodel-shell && npx vitest run`: 174 passed, 1 pre-existing skipped (clean)
- `viewmodel-shell-dotnet/Tests && dotnet test`: 16 passed (clean)
- `bun run parity/run.ts`: all 7 fixtures across all backends agree (clean)
- `viewmodel-shell && npx tsc --noEmit`: clean

## Fixed Issues

### CR-01: Bind-path `writePath` allows `__proto__` / `constructor` segments → prototype pollution surface

**Files modified:** `viewmodel-shell/src/index.ts`, `parity/run.ts`, `demo/Showcase/frontend/src/main.ts`
**Commit:** d31a4c9
**Applied fix:** Added `isUnsafeSegment(seg)` guard rejecting `__proto__`, `constructor`, `prototype` to `writePath` (drops writes silently) and `readPath` (returns undefined) in all three walker mirrors. Defense-in-depth for the public `stateWrite()` seam and demo code that builds bind paths dynamically.
**Verification:** Tier 2 (`tsc --noEmit` clean; `bun build` clean on parity/run.ts).
**Status:** fixed

### WR-01: `writePath`'s container-shape heuristic mis-creates arrays for maps keyed by numeric IDs

**Files modified:** `viewmodel-shell/src/index.ts`, `parity/run.ts`
**Commit:** 61a0a60
**Applied fix:** Per Option B from REVIEW.md — kept the next-segment-shape heuristic at the root bootstrap (no parent shape available there) and defaulted every intermediate slot creation to `{}`. The Showcase walker already followed this pattern, so it required no change (aligned now). Eliminates the `selectedIds.42 → []` mis-creation when `state.selectedIds` is uninitialized.
**Verification:** Tier 1 + Tier 2 (re-read confirmed; full vitest run 174/174 green; tsc clean).
**Status:** fixed

### WR-02: `tui-lifecycle.test.ts` still asserts the OLD `FieldNode.value` / `ActionEvent.context` wire shape

**Files modified:** `viewmodel-shell/test/tui-lifecycle.test.ts`
**Commit:** 88720ee
**Applied fix:**
- Dropped `value:` from every FieldNode fixture (8 sites) and added the now-required `bind:` field.
- Dropped `context:` from action fixtures (3 sites) and assertions.
- Rewrote the mock submit closure (lines 312–326) to dispatch `{ name: formNode.submitAction.name }` only — matching `FormView.submitFormWith` in `src/tui.tsx`. The old closure re-implemented pre-Phase-6 harvest behavior IN THE TEST.
- Rewrote the "form submit: collects current field values..." test to assert name-only dispatch.
- Rewrote the "checkbox field submits as boolean" test to assert name-only dispatch (TUI bindable write-back is TODO Phase 7, so the per-field state assertion can land later).
**Verification:** Tier 1 + Tier 2 (re-read confirmed; tui-lifecycle.test.ts 34 passed + 1 pre-existing skipped; full vitest run 174/174 green).
**Status:** fixed: requires human verification — test logic was rewritten to match Phase-6 semantics. Reviewer should confirm the new assertions accurately reflect the post-Phase-6 wire contract (`{ name }`-only dispatch; no merged context).

### WR-03: Validator skips `CheckboxNode` actions inside `TableRow.actions[]` — gap in duplicate detection

**Files modified:** `viewmodel-shell/src/server.ts`, `viewmodel-shell-dotnet/ViewModels.cs`
**Commits:** 2ef0257 (initial), 2bed0bc (TS type-narrow follow-up)
**Applied fix:** Extended both walkers to also record `CheckboxNode` whose `.action` is non-null inside `row.actions`. The .NET twin uses pattern-matching (`rowAction is CheckboxNode cb && cb.Action is { } cbAct`); the TS twin narrows through `unknown` to `ButtonNode | CheckboxNode` because the TS `TableRow.actions` type is `ButtonNode[]` (the .NET twin is `IReadOnlyList<ViewNode>` — broader). The first WR-03 commit shipped a cast (`as CheckboxNode`) that failed `tsc --noEmit` (TS2352); the follow-up commit corrected the narrowing.
**Verification:** Tier 1 + Tier 2 (`tsc --noEmit` clean; tree-walker.test.ts 13/13 green; `dotnet test` 16/16 green).
**Status:** fixed

### WR-04: TS bun backends bypass `validateActionNames` on initial-load GET; .NET runs it via `.Validate()`

**Files modified:** `demo/Tasks-bun/server.ts`, `demo/ContactManager-bun/server.ts`, `demo/ExpenseTracker-bun/server.ts`, `demo/RetroBoard-bun/server.ts`, `demo/HelpDesk-bun/server.ts`, `demo/Reorder-bun/server.ts`, `demo/FeatureProbe-bun/handler.ts`
**Commit:** e10b65d
**Applied fix:** Per REVIEW Option (a) — added `validateActionNames(vm)` call in every TS bun GET handler before `Response.json(...)`. Imported the existing named export from `@ashley-shrok/viewmodel-shell/server`. HelpDesk-bun has two GET handlers (`/api/agent`, `/api/requester`) — both updated. Closes the asymmetric initial-load validation gap with .NET.
**Note:** `demo/Tasks-fullstack-bun/server.ts` has its own hand-rolled GET handler (not listed in REVIEW.md WR-04) that re-uses `buildVm`/`initialState` from Tasks-bun. It was NOT modified per "apply fix to ALL files referenced in finding" — flagged here so a reviewer can decide whether to land the same guard there in a follow-up.
**Verification:** Tier 1 + Tier 2 (`tsc --noEmit` clean; `bun build` clean on every backend; parity green across all fixtures).
**Status:** fixed

### WR-05: Stale doc comments still describe pre-Phase-6 "harvest into action.context" behavior

**Files modified:** `viewmodel-shell/src/index.ts`, `viewmodel-shell-dotnet/ViewModels.cs`
**Commit:** 682c200
**Applied fix:** Rewrote both `FormNode.buttons` / `FormNode.Buttons` doc comments using the canonical text from REVIEW.md. The TS interface comment is now Phase-6-correct: dispatches its declared action by name; field values live in state at each input's `bind` path. The .NET twin comment matches semantically (positional-record context preserved). No code changes.
**Verification:** Tier 1 + Tier 2 (`tsc --noEmit` clean; `dotnet build` clean).
**Status:** fixed

### WR-06: Demo controllers silently produce `bind: "items.-1.completed"` when the index lookup fails

**Files modified:** `demo/Tasks/AspNetCore/TasksController.cs`, `demo/Tasks-bun/server.ts`, `demo/RetroBoard/AspNetCore/RetroBoardController.cs`, `demo/RetroBoard-bun/server.ts`
**Commit:** 71436f5
**Applied fix:** Replaced the defensive `-1` fallback with an explicit `throw` when the source-array lookup fails in all four demo controllers. Uses `InvalidOperationException` on .NET and plain `Error` on bun (this is a server bug, not a client error — both stacks treat it as 500). The lookup never fails today (the filtered list is always a subset of the source list), but the throw turns a future silent corruption into a loud error.
**Verification:** Tier 1 + Tier 2 (.NET tests: Tasks 28/28 green; RetroBoard 33/33 green; parity green).
**Status:** fixed: requires human verification — this is a logic change in production controllers. Reviewer should confirm the invariant "the filtered list always has matching ids in sourceItems" holds; if violated, the throw would surface a bug that was previously silent.

### WR-07: Reorder bun handler diverges from .NET — `splice(-1, ...)` vs. .NET `Insert(-1, ...)` throw

**Files modified:** `demo/Reorder-bun/server.ts`
**Commit:** 3c90191
**Applied fix:** Added explicit `if (idx < 0) throw new Error(...)` guard before `rest.splice(idx, 0, moving)`, matching .NET's `List<T>.Insert(-1, ...)` `ArgumentOutOfRangeException` → 500. The throw uses plain `Error` (not `BadRequestError`) to match .NET's 500 status — see WR-08 note. Parity fixtures only exercise valid `beforeId` values; the guard prevents the silent-misplace divergence from regressing.
**Verification:** Tier 1 + Tier 2 (`tsc --noEmit` clean; parity green on `reorder` fixture).
**Status:** fixed

### WR-08: Bun backends throw `Error` from action handlers → 500 where .NET returns 400 (`BadRequest`)

**Files modified (part 1 — framework):** `viewmodel-shell/src/server.ts`
**Files modified (part 2 — backends):** `demo/Tasks-bun/server.ts`, `demo/ContactManager-bun/server.ts`, `demo/ExpenseTracker-bun/server.ts`, `demo/RetroBoard-bun/server.ts`, `demo/HelpDesk-bun/server.ts`, `demo/Reorder-bun/server.ts`, `demo/FeatureProbe-bun/handler.ts`
**Commits:** 60332c6 (part 1 — framework), 43b3b18 (part 2 — backends)
**Applied fix:** Per REVIEW Option (b) — split into two commits as suggested in the orchestrator brief:
1. **Part 1 (framework):** Added `export class BadRequestError extends Error` to `viewmodel-shell/src/server.ts`. Wrapped the `handler(payload)` call in `createAction` with a try/catch that returns a 400 with `{ error: err.message }` for `BadRequestError` and re-throws anything else (preserving the existing 500 path for genuine server bugs).
2. **Part 2 (backends):** Converted client-input validation throws and unknown-action throws in all 7 bun backends from `throw new Error(...)` to `throw new BadRequestError(...)`. Three throws deliberately stayed as plain `Error` (mapped to 500):
   - `Tasks-bun:117` — WR-06 bind-index throw (server bug)
   - `RetroBoard-bun:143` — WR-06 bind-index throw (server bug)
   - `Reorder-bun:132` — WR-07 beforeId throw (matches .NET 500)

   Total client-validation throws converted: 13 across 7 backends.
**Verification:** Tier 1 + Tier 2 (`tsc --noEmit` clean; `bun build` clean on every backend; full vitest 174/174 green; parity green across all fixtures — same fixture-valid requests hit both stacks identically, the 400-vs-500 divergence only surfaces on malformed input which the fixtures don't exercise).
**Status:** fixed

## Operational notes

- **Bun demo node_modules linking:** The bun demos in this repo resolve `@ashley-shrok/viewmodel-shell` via a global bun link (`~/.bun/install/global/node_modules/@ashley-shrok/viewmodel-shell`) that points at the main repo's framework path (`/home/ubuntu/ViewModelShell/viewmodel-shell`). After fast-forward the global link now points at the post-fix framework, so any bun demo run from main repo picks up CR-01/WR-01/WR-03/WR-04/WR-08 correctly. Per-demo `node_modules` symlinks were created inside the temp worktree to validate the changes before fast-forward; they were removed with the worktree.
- **Framework dist:** `viewmodel-shell/dist/` was rebuilt after every framework-touching commit (CR-01, WR-01, WR-03 follow-up, WR-05, WR-08 part 1) during the fix run. `dist/` is gitignored — only the `src/` changes are in the commits. The main worktree's `dist/` will need a fresh `npm run build` from `viewmodel-shell/` to pick up the new source.
- **Tasks-fullstack-bun:** has a hand-rolled GET handler that reuses `buildVm`/`initialState` from Tasks-bun but isn't listed in WR-04's file set. Not modified. Flagged for follow-up if cross-backend symmetry is desired there too.

---

_Fixed: 2026-06-07T20:38:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
