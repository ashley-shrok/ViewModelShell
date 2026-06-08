---
phase: 06-wire-shape-change
verified: 2026-06-07T20:04:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
requirements_verified: 8/8
plans_verified: 5/5
phase_gates:
  framework_vitest: 174 passed | 1 skipped (175 total)
  framework_dotnet_tests: 16 passed
  demo_dotnet_tests: 172 passed (Tasks 28, ContactManager 39, ExpenseTracker 29, RetroBoard 33, HelpDesk 43)
  cross_backend_parity: 7 fixtures × 15 backends, byte-identical green
  check_core_globals: passes
  protocol_token_bump: 13 HTMLs at viewmodel-shell/1.0; 0 at older versions
deferred_items_acknowledged:
  - "Per-demo frontend adapter.test.ts files (~33 failing cases) — logged at deferred-items.md; CI does NOT run them"
  - "tui-lifecycle.test.ts 'server intent change' test it.skip'd with TODO Phase 7 marker"
code_review_findings:
  critical: 1 # writePath prototype-pollution guard (CR-01) — Phase 7 / 1.0 cutover concern, not goal-blocker
  warning: 8
  info: 6
  note: "Goal verification is orthogonal to code-review verdict per orchestrator instructions"
---

# Phase 6: Wire Shape Change — Verification Report

**Phase Goal:** Eliminate the `context` payload from the wire. Every input node declares a `bind` path into the state model; the renderer reads and writes through that path. The client maintains a locally-mutable state copy. On dispatch, the wire carries only `{action, state, files?}`. Every dispatch-bearing node carries an action name only; per-row identity encoded in the action name. The framework enforces "one action name = one operation" at tree-build time. The renderer is rewritten as a thin interpreter. All demos migrated. Cross-backend parity green across .NET / Bun / Node with every fixture rewritten.

**Verified:** 2026-06-07T20:04:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement — Roadmap Success Criteria

Each criterion checked directly against the codebase.

### Observable Truths

| # | Truth (from ROADMAP.md) | Status | Evidence |
|---|-------------------------|--------|----------|
| 1 | Agent reading only `{vm, state}` can compose mutated state + POST `{action, state}` with no `context` field (WIRE-01, WIRE-02, WIRE-03) | ✓ VERIFIED | `index.ts:3-6` defines `ActionEvent { name; files? }` — no context field. `index.ts:501` dispatches `JSON.stringify({ name: action.name })` only. `index.ts:17-20` defines `StateAccess { read(path), write(path,value) }` seam. `index.ts:571,585` ViewModelShell exposes `stateRead`/`stateWrite` operating on `currentState`. `browser.ts` has 21 `this.sa.read|write` sites at every input render path (input is read from bind, written on event). `FieldNode`/`CheckboxNode`/`TabsNode` declare required `bind: string` (lines 182, 201, 258). |
| 2 | Every dispatch-bearing node carries action name only; per-row names unique and self-identifying (WIRE-04, WIRE-05) | ✓ VERIFIED | `index.ts:262` TabsNode shape is `{value, label, action: ActionEvent}` per-tab. `TableRow.actions` is `ButtonNode[]` (per-row buttons with unique names) — `TableSelection` is removed. Demo evidence: `TasksController.cs:119` `toggle-row-{t.Id}`; `:122` `delete-row-{t.Id}`; `:88` `filter-{id}` per tab. `HelpDesk-bun` uses `start-row-${id}`, `select-ticket-${id}`. Action handlers consistently use `StartsWith`/`startsWith` to extract row identity. |
| 3 | Framework rejects at tree-build time any same action name for two semantically distinct operations (WIRE-05) | ✓ VERIFIED | `viewmodel-shell/src/server.ts:73` exports `validateActionNames(vm)` — walks tree, groups by name, allowed only when all occurrences share the same enclosing FormNode; otherwise throws with message `Duplicate action name '...' dispatched from semantically distinct nodes`. Auto-invoked in `createAction` at `server.ts:349`. .NET mirror at `ViewModels.cs:365` (`ViewTreeValidation.ValidateActionNames`) is auto-invoked by `ShellResponse<T>.Validate()` (`:129`). **13 TS unit tests** (tree-walker.test.ts) + **16 .NET unit tests** (ViewTreeValidationTests.cs) ALL PASS. **Re-ran on this verification:** vitest 174 pass / 1 skip; dotnet test 16/16 pass. |
| 4 | browser.ts has no context-assembly code paths; parity suite byte-identical across .NET/Bun/Node (WIRE-06, WIRE-08) | ✓ VERIFIED | `grep -n "context:" viewmodel-shell/src/browser.ts` returns no code-level matches (only comments explaining history). `grep -n "harvest" viewmodel-shell/src/browser.ts` finds 2 JSDoc references (no code). No `TableSelection` or `draftValues` remain. **Re-ran parity suite this verification:** all 7 fixtures green across 15 backends — `Fixture 'tasks' ✓ all backends agree`, `'contacts' ✓`, `'retro' ✓`, `'expenses' ✓`, `'helpdesk' ✓`, `'feature-probe' ✓` (3 backends incl. node twin), `'reorder' ✓`. Final: `✓ Parity tests passed`. `grep '"context"' parity/fixtures/*.json` returns empty. `check:core-globals` passes. |
| 5 | Every demo migrated; no demo references old context-payload shape (WIRE-07) | ✓ VERIFIED | `grep -rE 'payload\.[Cc]ontext\|\.Context\[' demo/ --include="*.ts" --include="*.cs"` returns nothing. `grep -r "TableSelection" demo/` returns nothing. State records carry draft slots (Tasks `DraftTitle`, ContactManager `DraftForm`, HelpDesk `SelectedIds`/`AgentNotes`, ExpenseTracker `DraftAmount`/`DraftNote`, RetroBoard `RetroDrafts`, FeatureProbe `RedirectTo`/`LocalValue`/`SortIntent`/`TableFilters`/`Note`). `.Validate()` is called on every .NET controller's return path (10 sites confirmed). Showcase migrated with local `StateAccess` closure + inlined `readPath`/`writePath`. **Demo .NET tests re-run this verification:** Tasks 28/28, ContactManager 39/39, ExpenseTracker 29/29, RetroBoard 33/33, HelpDesk 43/43 = 172/172 pass. |

**Score: 5/5 truths VERIFIED**

---

## Required Artifacts

### Plan 06-01 (Types + Parser)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `viewmodel-shell/src/index.ts` | TS ViewNode union with `bind` on inputs; ActionEvent without context | ✓ VERIFIED | 3 `bind: string` declarations (Field, Checkbox, Tabs); `ActionEvent { name; files? }`; dispatch sends `{name}` only at line 501 |
| `viewmodel-shell/src/server.ts` | `ActionPayload<TState>` without context; parsers don't read context | ✓ VERIFIED | `grep "context" server.ts` only matches comments; ActionPayload is `{name, state, files}` |
| `viewmodel-shell-dotnet/ViewModels.cs` | .NET records mirror TS — bind on inputs, no Context on ActionPayload, no TableSelection | ✓ VERIFIED | `ActionDescriptor(string Name)` only; `ActionPayload<TState>(name, state, files)`; 3 `string Bind` declarations; `TabItem(Value, Label, Action)`; `TablePagination` has `PrevAction`/`NextAction`; `TableNode` has `SortBind`/`FilterBinds`/`PaginationBind`/`SortActions`; no `TableSelection` |

### Plan 06-02 (Tree-Walker Uniqueness)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| TS `validateActionNames` | Walks tree, enforces uniqueness, throws on violation, auto-invoked | ✓ VERIFIED | `server.ts:73` exports function; `server.ts:349` `createAction` invokes on response.vm |
| .NET `ViewTreeValidation.ValidateActionNames` | Mirror TS, throws InvalidOperationException, ShellResponse.Validate() seam | ✓ VERIFIED | `ViewModels.cs:365` static class+method; `ShellResponse<T>.Validate()` at `:129` |
| TS tests | 9+ vitest cases | ✓ VERIFIED | `tree-walker.test.ts` — 13 cases, all pass (re-run confirmed) |
| .NET tests | 10+ xUnit cases | ✓ VERIFIED | `viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs` — 16 `[Fact]` tests, all 16 pass (re-run confirmed) |

### Plan 06-03 (Renderer)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `viewmodel-shell/src/browser.ts` | Thin interpreter — bind read/write, name-only dispatch | ✓ VERIFIED | 21 `this.sa.read|write` sites; no code-level `context:`; no `harvest` function; no `TableSelection`/`draftValues`; 870 lines (was 961) |
| `viewmodel-shell/src/index.ts` | stateRead/stateWrite seam | ✓ VERIFIED | `stateRead` at line 571, `stateWrite` at 585, `readPath`/`writePath` helpers at 713/736, `StateAccess` interface at 17 |
| `viewmodel-shell/src/adapter.test.ts` | jsdom tests for bind read/write, name-only dispatch | ✓ VERIFIED | 20 `it(` blocks; vitest run pass count (174) confirms (re-run this verification) |

### Plan 06-04 (Demo Migrations)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `demo/Tasks-bun/server.ts` | bind paths, state slots, action-name-encoded per-row | ✓ VERIFIED | `bind: "draftTitle"`, `bind: items.${i}.completed`, per-row actions `toggle-row-${t.id}`/`delete-row-${t.id}`; handler uses `startsWith` |
| `demo/Tasks/AspNetCore/TasksController.cs` | .NET twin matching above | ✓ VERIFIED | `DraftTitle` state slot, `Bind: "draftTitle"`, `StartsWith` action-name dispatch (read above) |
| `demo/HelpDesk-bun/server.ts` | TabsNode bind, per-row checkboxes, bulk actions read state.SelectedIds | ✓ VERIFIED | Reviewed AgentController.cs:30,48,55 — `name.StartsWith("filter-")`, `state.SelectedIds` read for bulk, `select-ticket-` per-row |
| All 14 demo backends | All on new wire shape | ✓ VERIFIED | grep across `demo/` finds no `payload.context`/`payload.Context`/`TableSelection` |

### Plan 06-05 (Parity)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| 7 parity fixture JSONs | `{action: {name}}` only, no context | ✓ VERIFIED | `grep '"context"' parity/fixtures/*.json` returns empty; sample tasks.json verified |
| `parity/run.ts` | Sends `{name}` only, supports `stateMutations` | ✓ VERIFIED | Line 60 declares `stateMutations` type, line 187 applies them, line 202 appends `{name: step.action!.name}` to `_action` |
| Demo HTML protocol bump | All meta tags at viewmodel-shell/1.0 | ✓ VERIFIED | 13 HTML files (7 source-tracked + 6 wwwroot mirrors, gitignored) all carry `viewmodel-shell/1.0`; zero matches for old versions |

---

## Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| BrowserAdapter | StateAccess seam | `this.sa.read(bind)` / `this.sa.write(bind, value)` | ✓ WIRED (21 sites in browser.ts) |
| ViewModelShell.dispatch | wire envelope | `JSON.stringify({ name: action.name })` at index.ts:501 | ✓ WIRED |
| createAction (TS) | validateActionNames | server.ts:349 auto-invocation | ✓ WIRED |
| .NET ShellResponse constructor | ViewTreeValidation | ViewModels.cs:129 (`if (Vm is not null) ViewTreeValidation.ValidateActionNames(Vm)`) when `.Validate()` called | ✓ WIRED |
| Demo controllers | .Validate() | Every `return new ShellResponse<T>(...).Validate()` | ✓ WIRED (10+ sites grepped) |
| .NET ViewModels.cs ↔ TS index.ts | byte-aligned wire shape | parity suite | ✓ WIRED (7 fixtures × 15 backends, byte-identical) |
| HTML protocol meta | viewmodel-shell/1.0 | every tracked demo HTML | ✓ WIRED |

---

## Data-Flow Trace (Level 4)

The phase's central data flow — input value → state at bind path → dispatch → server reads state — verified end-to-end:

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `<input>` rendered by `field()` in browser.ts | input.value | `this.sa.read(node.bind)` from `currentState` | YES — flows from state | ✓ FLOWING |
| `currentState` after user input event | (mutated in place) | `this.sa.write(node.bind, newValue)` via stateWrite → writePath | YES | ✓ FLOWING |
| `_state` in dispatch FormData | currentState JSON | `JSON.stringify(this.currentState)` at index.ts:502 | YES | ✓ FLOWING |
| Server handler (e.g. TasksController) | state.DraftTitle | `payload.State.DraftTitle` (read from JSON body) | YES — verified by 28 passing tests | ✓ FLOWING |
| Cross-backend parity diff | normalized response.state | server-emitted state after action | YES — byte-identical across .NET/Bun/Node | ✓ FLOWING |

---

## Behavioral Spot-Checks

Ran the following checks during this verification (commands took < 10s each except parity):

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Core platform-agnosticism guard passes | `cd viewmodel-shell && npm run check:core-globals` | `✓ AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals.` | ✓ PASS |
| Framework vitest passes | `cd viewmodel-shell && npx vitest run` | `Test Files 17 passed (17) / Tests 174 passed | 1 skipped (175)` | ✓ PASS |
| Framework .NET tests | `cd viewmodel-shell-dotnet/Tests && dotnet test --nologo` | `Passed!  - Failed: 0, Passed: 16` | ✓ PASS |
| Tasks demo .NET tests | `cd demo/Tasks/AspNetCore.Tests && dotnet test --nologo` | `Passed! - Failed: 0, Passed: 28` | ✓ PASS |
| ContactManager .NET tests | `cd demo/ContactManager/AspNetCore.Tests && dotnet test --nologo` | `Passed! - Failed: 0, Passed: 39` | ✓ PASS |
| ExpenseTracker .NET tests | (same shape) | `Passed - 29` | ✓ PASS |
| RetroBoard .NET tests | (same shape) | `Passed - 33` | ✓ PASS |
| HelpDesk .NET tests | `cd demo/HelpDesk/AspNetCore.Tests && dotnet test --nologo` | `Passed! - Failed: 0, Passed: 43` | ✓ PASS |
| Cross-backend parity | `cd parity && bun run run.ts` | All 7 fixtures green across 15 backends; `✓ Parity tests passed` | ✓ PASS |
| No `context:` in parity fixtures | `grep '"context"' parity/fixtures/*.json` | empty | ✓ PASS |
| No `payload.context` / `TableSelection` in demos | `grep -rE 'payload\.[Cc]ontext|TableSelection' demo/ --include="*.ts" --include="*.cs"` | empty | ✓ PASS |
| Protocol token bumped | `grep -rE 'viewmodel-shell/1\.0' demo/ --include="*.html"` returns 13; older versions return 0 | matches | ✓ PASS |
| Tree-walker enforces uniqueness | 13 vitest cases + 16 xUnit cases all green | matches | ✓ PASS |

---

## Requirements Coverage

All 8 WIRE-* requirement IDs from REQUIREMENTS.md mapped to Phase 6 are satisfied:

| Req | Plan | Description | Status | Evidence |
|-----|------|-------------|--------|----------|
| WIRE-01 | 06-01 | Every input declares `bind` path; renderer reads/writes through it | ✓ SATISFIED | `index.ts:182,201,258` required `bind: string` on Field/Checkbox/Tabs; .NET twin mirrors at `ViewModels.cs:209,221,248` |
| WIRE-02 | 06-03 | Client maintains locally-mutable state copy; events mutate at bind path | ✓ SATISFIED | `ViewModelShell.stateRead/stateWrite` + `writePath` in `index.ts`; `browser.ts` 21 sa.read/write sites |
| WIRE-03 | 06-01, 06-05 | Wire carries only `{action, state, files?}`; no `context` | ✓ SATISFIED | `index.ts:501` `JSON.stringify({ name: action.name })`; `ActionPayload<T>` is `{name, state, files}`; parity fixtures + run.ts emit `{name}` only |
| WIRE-04 | 06-01, 06-04 | Every dispatch-bearing node carries action name only; per-row identity in name | ✓ SATISFIED | `ActionEvent { name; files? }`; demos use `delete-row-${id}`, `toggle-row-${id}`, `select-ticket-${id}` etc. |
| WIRE-05 | 06-02 | Framework enforces "one action name = one operation" at tree-build time | ✓ SATISFIED | `validateActionNames` (TS) + `ViewTreeValidation.ValidateActionNames` (.NET); 13+16 tests pass; auto-invoked via `createAction` + `ShellResponse.Validate()` |
| WIRE-06 | 06-03 | Renderer rewritten as thin interpreter; 7 context-assembly paths collapsed | ✓ SATISFIED | `browser.ts` has no code-level `context:`, no `harvest` function, no `TableSelection`/`draftValues`; 21 bind read/write sites |
| WIRE-07 | 06-04 | Every demo migrated; handlers read from state, never `payload.context` | ✓ SATISFIED | `grep -r 'payload\.[Cc]ontext\|TableSelection' demo/` empty; 172 demo .NET tests pass |
| WIRE-08 | 06-05 | Cross-backend parity green across .NET/Bun/Node with rewritten fixtures | ✓ SATISFIED | Parity run: 7 fixtures × 15 backends byte-identical green; `check:core-globals` passes; CI gates green |

**8/8 requirements SATISFIED. No orphaned requirements.**

---

## Anti-Patterns Found

Anti-pattern scan against modified files. Most findings are tracked elsewhere or informational.

| Category | Severity | Notes |
|----------|----------|-------|
| Pre-existing per-demo `adapter.test.ts` failures (~33 tests) | ⚠️ Acknowledged | Pre-existing — tracked at `.planning/phases/06-wire-shape-change/deferred-items.md`; CI does NOT run them (`.github/workflows/parity.yml` runs only framework vitest + .NET demos + parity). Per orchestrator instructions: do not re-flag. |
| One `it.skip` in `tui-lifecycle.test.ts` with explicit `TODO Phase 7` | ℹ️ Info | Deliberate Phase 7 deferral for TUI bindable input. Acknowledged in 06-03-SUMMARY. |
| `writePath` prototype-pollution surface (CR-01) | ⚠️ Warning (out-of-band) | Code-review Critical finding (06-REVIEW.md). Server-controlled bind strings today, so not immediately exploitable; defense-in-depth fix should land before 1.0 cutover (Phase 7 concern). Per orchestrator: goal verification is orthogonal to code-review verdict. |
| `writePath` array-vs-object heuristic for numeric keys (WR-01) | ⚠️ Warning (out-of-band) | Code-review warning; demos sidestep by pre-initializing dictionaries. Documented in 06-REVIEW.md. Does not break parity. |
| Validator skips `CheckboxNode` actions in `TableRow.actions[]` (WR-03) | ⚠️ Warning (out-of-band) | Filter-to-ButtonNode in both backends. No demo today places a CheckboxNode with `.action` in `row.actions`, so the gap doesn't manifest. Tracked in 06-REVIEW.md. |
| TS bun GETs bypass `validateActionNames` (WR-04) | ⚠️ Warning (out-of-band) | Asymmetric initial-load coverage (.NET runs `.Validate()` on GET; bun returns `Response.json` directly). Parity catches divergences via fixtures. Tracked in 06-REVIEW.md. |
| Stale JSDoc on `FormNode.buttons` (WR-05) | ℹ️ Info | Doc-only drift; behavior matches Phase 6 model. Tracked in 06-REVIEW.md. |
| Defensive `-1` index fallbacks in demo controllers (WR-06) | ℹ️ Info | Demo-code defensive style; doesn't fire in practice. Tracked in 06-REVIEW.md. |

**No BLOCKER anti-patterns. Code-review findings are out-of-band quality concerns for Phase 7 / 1.0 cutover, not Phase 6 goal blockers, per orchestrator instructions.**

---

## Re-Verification Evidence

This verification re-ran the SUMMARY's claimed checks rather than trusting them:

- **Framework vitest:** `cd viewmodel-shell && npx vitest run` → `Test Files 17 passed (17) / Tests 174 passed | 1 skipped (175)` — MATCHES SUMMARY claim exactly.
- **Framework .NET tests:** `cd viewmodel-shell-dotnet/Tests && dotnet test --nologo` → `Passed: 16` — MATCHES.
- **Demo .NET test totals:** Tasks 28 + ContactManager 39 + ExpenseTracker 29 + RetroBoard 33 + HelpDesk 43 = 172 — MATCHES SUMMARY claim.
- **Cross-backend parity:** `cd parity && bun run run.ts` → All 7 fixtures × 15 backends green; `✓ Parity tests passed` — MATCHES SUMMARY's claim of byte-identical green across .NET / Bun / Node (including the node twin for feature-probe → 3 backends).
- **Anti-pattern absence:** `grep '"context"' parity/fixtures/*.json` empty; `grep -r 'payload\.[Cc]ontext\|TableSelection' demo/` empty; `grep -rE 'viewmodel-shell/0\.' demo/ --include="*.html"` empty — all MATCH summary's claimed grep results.
- **Code/file evidence:** `bind: string` declarations in `index.ts` line 182/201/258; `Bind` parameters in `ViewModels.cs` line 209/221/248; `validateActionNames` exported from `server.ts:73`; `ShellResponse<T>.Validate()` at `ViewModels.cs:129` — all confirmed by direct file reads.

---

## Gaps Summary

**No gaps.** All 8 WIRE-* requirements are demonstrably satisfied by code, by tests, and by the cross-backend parity gate. The phase's central architectural break — `context` payload elimination + `bind` path adoption + tree-walker uniqueness enforcement + thin-interpreter renderer + all demos migrated — landed coherently across both backends.

The two known pre-existing items (per-demo `adapter.test.ts` failures; one `it.skip`'d TUI test) are explicitly acknowledged in the executor's `deferred-items.md` and are NOT goal blockers per the orchestrator's pre-existing-items rule.

The 9 code-review findings (1 Critical + 8 Warning in 06-REVIEW.md) are quality concerns appropriate to address before the 1.0 cutover in Phase 7. None of them block the wire-shape change from being correctly delivered; the parity suite (the orthogonal correctness gate for this milestone) is byte-identical green across backends, which is the falsifiable bar this phase committed to.

---

_Verified: 2026-06-07T20:04:00Z_
_Verifier: Claude (gsd-verifier)_
