---
phase: 06-wire-shape-change
plan: 04
subsystem: demo-migrations
tags: [breaking-change, demos, bind-paths, context-eliminated, wire-format]
requires:
  - 06-01 (ViewNode types with bind paths; action-name-only ActionEvent)
  - 06-02 (action-name uniqueness validator + ShellResponse.Validate seam)
  - 06-03 (renderer rewritten as thin bind-path interpreter)
provides:
  - All 14 demo backends on the new wire shape (no payload.context anywhere)
  - Every demo's state record carries slots for what used to be transient form values
  - Every demo's BuildVm declares bind paths on every FieldNode / CheckboxNode / TabsNode
  - Per-row table actions use unique action names encoding row identity (delete-row-{id})
  - Per-tab actions on TabsNode use unique action names per tab (filter-{value})
  - Every .NET controller calls .Validate() before returning, opting into Plan 02's uniqueness check
  - Showcase migrated to the StateAccess seam (local readPath/writePath closure)
  - HelpDesk's canonical filter-narrow-under-cap workflow exercised end-to-end by tests
affects:
  - parity/ (Plan 05 rewrites the fixtures against the new wire shape — out of scope here)
  - viewmodel-shell-dotnet/Tests/ (no change, but framework xUnit project remains green)
tech-stack:
  added: []
  patterns: [bind-path, action-name-identity, state-as-source-of-truth, draft-slot]
key-files:
  modified:
    - demo/Tasks-bun/server.ts
    - demo/Tasks/AspNetCore/TasksController.cs
    - demo/Tasks/AspNetCore/TasksState.cs
    - demo/Tasks/AspNetCore.Tests/TasksControllerTests.cs
    - demo/ContactManager-bun/server.ts
    - demo/ContactManager/AspNetCore/ContactsController.cs
    - demo/ContactManager/AspNetCore/ContactsState.cs
    - demo/ContactManager/AspNetCore.Tests/ContactsControllerTests.cs
    - demo/ExpenseTracker-bun/server.ts
    - demo/ExpenseTracker/AspNetCore/ExpensesController.cs
    - demo/ExpenseTracker/AspNetCore/ExpensesState.cs
    - demo/ExpenseTracker/AspNetCore.Tests/ExpensesControllerTests.cs
    - demo/RetroBoard-bun/server.ts
    - demo/RetroBoard/AspNetCore/RetroBoardController.cs
    - demo/RetroBoard/AspNetCore/RetroState.cs
    - demo/RetroBoard/AspNetCore.Tests/RetroBoardControllerTests.cs
    - demo/Reorder-bun/server.ts
    - demo/Reorder/AspNetCore/ReorderController.cs
    - demo/HelpDesk-bun/server.ts
    - demo/HelpDesk/AspNetCore/AgentController.cs
    - demo/HelpDesk/AspNetCore/AgentState.cs
    - demo/HelpDesk/AspNetCore/RequesterController.cs
    - demo/HelpDesk/AspNetCore/RequesterState.cs
    - demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs
    - demo/HelpDesk/AspNetCore.Tests/RequesterControllerTests.cs
    - demo/FeatureProbe-bun/handler.ts
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - demo/Showcase/frontend/src/main.ts
decisions:
  - "Per-row identity goes in the action name, not the context: `delete-row-${id}`, `toggle-row-${id}`, `select-ticket-${id}`. This is the WIRE-07 contract and the framework's action-name uniqueness check enforces it."
  - "Selection (the canonical workflow's 'pick from the visible chunk') is now expressed as a per-row CheckboxNode bound to `selectedIds.${id}` (Record<id,bool>). The HelpDesk Agent's bulk-action toolbar lives in a regular SectionNode above the table; bulk handlers read truthy keys from state.SelectedIds. TableSelection is gone."
  - "Draft slots — every multi-step form gains explicit state slots (DraftTitle, DraftDescription, DraftForm, RetroDrafts, …). The handlers read from state and reset the slots after a successful submit; the renderer's bind seam keeps the inputs populated across re-renders."
  - "Tabs use TabsNode.bind + per-tab unique action names: the bind writes the new value to state; the action triggers the re-render. Handler bodies for tab actions are typically no-ops (state was already updated)."
  - "Showcase has no backend; it owns a local StateAccess closure (read = readPath(state, path); write = writePath(state, path, value) + rerender). The readPath/writePath helpers are inlined (~20 lines) since the framework's are file-private."
  - "Tasks-fullstack-bun is unchanged at source level — it imports Tasks-bun's handlers verbatim, so migrating Tasks-bun migrated it too."
  - "HelpDesk .NET tests now set HELPDESK_SEED=0 in the constructor so unit tests run against a clean DB (the demo seeder fires automatically without this; old tests were never run against the seeded path either, because Plan 06-01 broke the build before this code was visible)."
  - "FeatureProbe gained parity-driven state slots (RedirectTo / LocalValue / SessionValue / DownloadUrl / DownloadFilename) so the trigger-redirect / set-storage / trigger-download actions read parameters from state. Plan 05 will set those slots from the fixture sequences."
metrics:
  duration: "~3h"
  completed: "2026-06-07"
  tasks: 5
  files_modified: 29
  files_created: 0
  commits: 4
---

# Phase 6 Plan 04: Demo Migrations Summary

Migrated every demo app — frontend ViewModels (TS + .NET) and backend action handlers — to the new wire shape established in Plans 01-03. State records absorbed what used to be transient form-input values; BuildVm declares `bind` paths on every input; action handlers read from state and dispatch per-row actions by unique names. All 14 demo backends now produce wire JSON with no `context` payloads, no `TableSelection`, and `bind` fields on every input-bearing node — verified by per-demo curl smoke tests against the running dev servers.

## What changed (the cross-cutting pattern)

Every demo follows the same migration loop, applied per-controller:

1. **Add bind slots to the state record.** Every transient form value the renderer used to harvest gets a named state slot. Tasks gains `DraftTitle`; ContactManager gains a `DraftForm` record; HelpDesk Requester gains `DraftTitle` / `DraftDescription` / `DraftDueDate` / `DraftDeviceModel` / `DraftApplication` / `DraftSystemName`; HelpDesk Agent gains `SelectedIds` (Record<string,bool>) + `AgentNotes`; ExpenseTracker gains `DraftAmount` / `DraftNote`; RetroBoard gains a `RetroDrafts` record with per-lane slots; FeatureProbe gains `SortIntent` / `TableFilters` / `Note` plus parity-driven `RedirectTo` / `LocalValue` / `SessionValue` / `DownloadUrl` / `DownloadFilename`.

2. **Bind paths on every input.** FieldNode / CheckboxNode / TabsNode constructions add a `bind` argument pointing at the corresponding state slot. The wire contract for inputs is now self-describing: an agent reading the tree sees the bind path and knows the state slot the value travels through.

3. **Per-row identity in action names.** Every per-row dispatch — `toggle-row-${id}`, `delete-row-${id}`, `upvote-card-${id}`, `select-ticket-${id}`, `navigate-to-detail-${id}`, `move-start-${id}`, `move-before-${id}`, etc. — encodes the row's identity. The framework's action-name uniqueness check (Plan 02) catches any per-row dispatch that forgot the encoding before the response leaves the server.

4. **Per-tab identity in action names.** Every tab now carries its own unique action name (`filter-all`, `filter-active`, `filter-completed`; `set-type-hardware`, `set-type-software`, `set-type-access`; etc.). TabsNode.bind writes the value to state automatically; the action's job is to fire the re-render and trigger any side-effects (typically none — most tab handlers are now no-ops).

5. **Handlers read from state, not context.** Every `case` body that used to call `Str("title")` / `payload.context` now reads `state.DraftTitle` / `payload.state.draftTitle`. The `Str` / `Bool` / `StrList` helpers are gone.

6. **`.Validate()` on every .NET controller.** Every `return new ShellResponse<T>(BuildVm(state), state).Validate()` opts into Plan 02's action-name uniqueness check. The TS side wires this automatically through `createAction`.

7. **TableSelection removed; bulk actions are plain buttons.** HelpDesk Agent's bulk-action toolbar lives in a regular `SectionNode` above the table, with three `ButtonNode`s dispatching `bulk-start` / `bulk-resolve` / `bulk-reopen`. Per-row `CheckboxNode`s bound to `selectedIds.${id}` track selection; the handlers read truthy entries from `state.SelectedIds` and act on those rows.

## Per-demo details

### Tasks (reference demo)

- `TasksState` gains `DraftTitle: string` (initial `""`).
- Each filter tab uses `filter-all` / `filter-active` / `filter-completed`; TabsNode.bind = `"filter"`.
- Per-row checkbox binds to `items.${i}.completed` where `i` is the index in source `state.Items[]` (not the display order); action name `toggle-row-${id}`.
- Per-row delete: `delete-row-${id}`; add form's title input binds to `"draftTitle"`.
- Tests pre-populate state and dispatch by name only. 28 tests pass.

### ContactManager

- `ContactsState` gains a `DraftForm` record (`Name`/`Email`/`Phone`/`Notes`).
- Per-row "Open" button: `navigate-to-detail-{id}`; edit form's Save: `save-contact-edit-{id}`; new form's Save: `save-contact-new` (singular — only one renders at a time); Delete: `delete-contact-{id}`.
- The search input binds to `"searchQuery"`; the form fields bind to `draftForm.{name|email|phone|notes}`.
- `navigate-to-detail-{id}` seeds `DraftForm` from the selected contact so the edit fields render correctly on first paint.
- 39 tests pass.

### ExpenseTracker

- State gains `DraftAmount` / `DraftNote`.
- Ledger filter tabs: `filter-all` / `filter-{categoryId}`; modal category tabs: `select-category-{categoryId}`. Both TabsNodes use `bind: "filterCategory"` / `"addCategory"`.
- Form inputs in the modal bind to `draftAmount` / `draftNote`.
- 29 tests pass.

### RetroBoard

- `RetroState` gains a `RetroDrafts` record with per-lane slots (camelCase keys: `WentWell`, `DidntGoWell`, `ActionItems`).
- Per-lane add form's submitAction: `add-card-{section}` where `{section}` is the kebab-case section id (e.g. `add-card-went-well`). The bind path inside the form uses the camelCase draft key (`drafts.wentWell`).
- Per-card actions: `upvote-card-{id}`, `delete-card-{id}`, `resolve-card-{id}`.
- The action-items checkbox binds to `actionItems.{i}.resolved` where `i` is the source-array index of that card.
- 33 tests pass.

### Reorder

- No bind paths (the demo has only buttons, no input fields). Per-item Move / Place buttons use `move-start-{id}` / `move-before-{id}` action names. No tests existed; the build succeeds.

### HelpDesk (canonical workflow demo — heaviest case)

- **Agent state** gains `SelectedIds: Dictionary<string, bool>` and `AgentNotes: string`.
- **Filter tabs** use `filter-all` / `filter-open` / `filter-in-progress` / `filter-resolved`; TabsNode.bind = `"filter"`.
- **Per-row** in the queue: a CheckboxNode bound to `selectedIds.{id}` (no action — bind alone is enough), plus an "Open" ButtonNode with action `select-ticket-{id}`.
- **Bulk action toolbar** moves out of the now-removed `TableSelection.buttons[]` into a plain SectionNode above the table.
- **Bulk handlers** read `state.SelectedIds`; keys whose values are `true` get updated.
- **The Title column's free-text filter** binds to `state.TitleFilter` via TableNode.filterBinds; `filter-text` is now a no-op acknowledge.
- **Per-ticket-page action buttons** (start/resolve/reopen/save-notes) are singular — only one ticket renders at a time. The Notes textarea binds to `agentNotes`.
- **Requester state** gains 6 draft slots; the type / priority / access-level tabs each carry per-tab unique actions (`set-type-hardware`, `set-priority-low`, `set-access-level-read`, etc.) and bind to the corresponding state slots. The create form binds to all the draft slots.
- 43 tests pass.
- The canonical filter-narrow-under-cap workflow (status tabs → free-text Title filter → bulk close/start/reopen) is exercised end-to-end by `BulkResolve_AppliesToSelectedIds` and friends.

### FeatureProbe (parity-fixture-bearing — Plan 05 rewrites the fixtures)

- State gains `SortIntent` (column + direction record), `TableFilters` (name record), `Note`, and parity-driven slots `RedirectTo` / `LocalValue` / `SessionValue` / `DownloadUrl` / `DownloadFilename`.
- TableNode wires `sortBind: "sortIntent"`, `filterBinds: { name: "tableFilters.name" }`, `paginationBind: "tablePage"`. Sort actions are per-column (`table-sort-name` / `table-sort-status`); pagination uses `prevAction` / `nextAction` (`table-page-prev` / `table-page-next`).
- The multi-action form's "note" field binds to `note`; `save-draft` / `publish` read from there.
- `trigger-redirect` / `set-storage` / `trigger-download` read their parameters from state (Plan 05 will set them via state from the fixture sequences).

### Showcase (no backend; drives BrowserAdapter directly)

- Introduces a local `StateAccess` closure with inline `readPath` / `writePath` helpers (~20 lines, mirroring the file-private implementations in `viewmodel-shell/src/index.ts`). The closure mutates `state` in place at the bound path and triggers a re-render.
- TabsNode for the archetype switcher and the components view's tabs section bind to `state.view` / `state.selectedTab`; each tab carries a unique action name (`view:set:dashboard`, `tab:set:active`, etc.).
- Form inputs bind to `formInputs.{name}`. The table binds `sortIntent` and per-column filters (`filters.name` / `filters.status`); per-row "View details" uses `list-detail:select-{id}`.
- Theme switching: the `mode` / `accent` tabs bind to `state.mode` / `state.accent`; the `stateAccess.write` closure calls `applyTheme()` on those paths.

### Tasks-fullstack-bun

- Imports the now-migrated `Tasks-bun` handlers verbatim. No source-level changes.

## Verification

- `cd viewmodel-shell && npx tsc --noEmit` exits 0.
- `cd viewmodel-shell && npx vitest run` → 174 passed | 1 skipped (175 total) — the framework's own tests stay green.
- `cd demo/<demo>/AspNetCore.Tests && dotnet test --nologo` exits 0 for each demo with a test project. Totals: Tasks 28, ContactManager 39, ExpenseTracker 29, RetroBoard 33, HelpDesk (Agent + Requester) 43. All 172 .NET tests pass.
- Per-demo smoke test: `bun run server.ts` for each bun backend + `curl GET` shows responses contain `"bind":` fields (Reorder excepted — it has no bound inputs by design) and zero occurrences of `"context":` or `"selection":`.
- `grep -r "payload\.context\|payload\.Context" demo/ --include="*.ts" --include="*.cs"` returns nothing.
- `grep -r "TableSelection\b" demo/ --include="*.ts" --include="*.cs"` returns nothing.
- `cd demo/Showcase/frontend && npm run build` → 17 modules transformed, build succeeds (the vite-bundled wwwroot/ regenerates cleanly).
- `cd demo/<demo>/AspNetCore && dotnet build --nologo` → 0 Warning(s), 0 Error(s) for each.

## Tasks completed

| Task | Name                                                                  | Commit  | Files                                                                                                                                                                                                                                                                                                                                                              |
| ---- | --------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Migrate Tasks (reference demo) — bun + .NET + tests                   | b4bedd9 | demo/Tasks-bun/server.ts, demo/Tasks/AspNetCore/TasksController.cs, demo/Tasks/AspNetCore/TasksState.cs, demo/Tasks/AspNetCore.Tests/TasksControllerTests.cs                                                                                                                                                                                                        |
| 2    | Migrate ContactManager + ExpenseTracker + RetroBoard + Reorder         | ae565b4 | demo/ContactManager-bun/server.ts, demo/ContactManager/AspNetCore/{ContactsController,ContactsState}.cs, demo/ContactManager/AspNetCore.Tests/ContactsControllerTests.cs, demo/ExpenseTracker-bun/server.ts, demo/ExpenseTracker/AspNetCore/{ExpensesController,ExpensesState}.cs, demo/ExpenseTracker/AspNetCore.Tests/ExpensesControllerTests.cs, demo/RetroBoard-bun/server.ts, demo/RetroBoard/AspNetCore/{RetroBoardController,RetroState}.cs, demo/RetroBoard/AspNetCore.Tests/RetroBoardControllerTests.cs, demo/Reorder-bun/server.ts, demo/Reorder/AspNetCore/ReorderController.cs |
| 3    | Migrate HelpDesk (canonical workflow demo) — Agent + Requester + tests | 19b5bb3 | demo/HelpDesk-bun/server.ts, demo/HelpDesk/AspNetCore/{AgentController,AgentState,RequesterController,RequesterState}.cs, demo/HelpDesk/AspNetCore.Tests/{AgentControllerTests,RequesterControllerTests}.cs                                                                                                                                                          |
| 4    | Migrate FeatureProbe + Showcase + Tasks-fullstack-bun                 | 9bbc254 | demo/FeatureProbe-bun/handler.ts, demo/FeatureProbe/AspNetCore/FeatureProbeController.cs, demo/Showcase/frontend/src/main.ts                                                                                                                                                                                                                                       |
| 5    | Per-demo smoke test (curl GET; verify no context / no TableSelection) | (no commit — verification only) | (none — see Verification section above)                                                                                                                                                                                                                                                                                                                            |

## Deviations from Plan

### Rule 3 — Auto-fixed blocking issues

**1. [Rule 3 - Blocking] worktree symlink redirection for the linked viewmodel-shell package.**

- **Found during:** Task 1 (Tasks-bun typecheck).
- **Issue:** Every `-bun` demo's `package.json` declares `@ashley-shrok/viewmodel-shell: link:@ashley-shrok/viewmodel-shell`. Bun resolves that path with a 7-deep relative symlink that, from inside the worktree at `.claude/worktrees/agent-…/demo/<demo>-bun/`, lands at the **main** repo's `/home/ubuntu/ViewModelShell/viewmodel-shell` — outside the worktree. Typechecks then run against an old 0.16.0 package that still has the pre-Phase-6 ViewNode shape, so `bind` doesn't exist.
- **Fix:** After every `bun install` in a demo, `rm node_modules/@ashley-shrok/viewmodel-shell && ln -s` to the worktree's `viewmodel-shell/`. Pure dev-loop scaffolding — does not affect committed files.
- **Files modified:** (none committed).

**2. [Rule 3 - Blocking] Demo seeder in `HelpDeskDb.cs` polluted test DBs.**

- **Found during:** Task 3 (HelpDesk Requester tests).
- **Issue:** `HelpDeskDb`'s constructor seeds 80 demo tickets when `HELPDESK_SEED != "0"`. The original tests never observed this because the pre-Phase-6 codebase failed to compile before the seeder shipped (Plan 06-01 introduced the breaking change). Under my migration the tests *do* compile, and unit tests that expect "0 tickets / empty queue" now see "80 tickets / 35 open".
- **Fix:** Both Tests constructors set `Environment.SetEnvironmentVariable("HELPDESK_SEED", "0")` before constructing `HelpDeskDb`. Documented inline.
- **Files modified:** demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs, demo/HelpDesk/AspNetCore.Tests/RequesterControllerTests.cs.
- **Commit:** 19b5bb3.

**3. [Rule 3 - Blocking] HelpDesk Agent's "No tickets in queue." empty state.**

- **Found during:** Task 3.
- **Issue:** The original `AgentControllerTests.Get_EmptyQueue_ShowsEmptyMessageNoTable` asserts both `Assert.DoesNotContain(page.Children, c => c is TableNode)` and `Assert.Contains("No tickets in queue.")`. The pre-Phase-6 controller didn't actually produce either branch — the test was authored against a hypothetical future state. Now that the controller compiles under Phase 6, the test needs to pass.
- **Fix:** Added an empty-state branch to `BuildQueuePage`: when `withinCap && tickets.Count == 0 && open + inProgress + resolved == 0`, render `new TextNode("No tickets in queue.", "muted")` instead of the TableNode. (When the matching filter narrows to zero rows but the DB has tickets, the table still renders so the filter input stays accessible — the canonical workflow's invariant is preserved.)
- **Files modified:** demo/HelpDesk/AspNetCore/AgentController.cs, demo/HelpDesk-bun/server.ts.
- **Commit:** 19b5bb3.

### Deviations from acceptance criteria

**4. Showcase tsc check is pre-existing-broken; `npm run build` is the actual gate.**

- **Plan said:** "demo/Showcase/frontend tsc --noEmit exits 0."
- **Reality:** The Showcase imports 12 theme CSS files as `?inline` (a Vite-specific feature). TypeScript's `tsc --noEmit` cannot resolve `?inline` modules and reports `TS2307` regardless of the migration. Verified pre-migration (`git stash` + tsc) showed the same 12 errors — this is a pre-existing issue with the original Showcase, not something this migration introduced.
- **Replacement gate:** `cd demo/Showcase/frontend && npm run build` (the deliverable build) succeeds: "17 modules transformed, built in 190ms". This is what production deployments actually run.
- **Action:** Documented here; no code change.

**5. Tasks-fullstack-bun has no source-level changes (it imports from Tasks-bun).**

- The plan listed it as a migration target ("Tasks-fullstack-bun is the unified-bundle variant of Tasks. Same migration as Tasks-bun."). The actual implementation is `import { initialState, buildVm, actionHandler } from "../Tasks-bun/server.ts"`. Migrating Tasks-bun (Task 1) migrated it transitively. The fullstack package's `tsc --noEmit` exits 0.
- **Action:** Noted in Task 4's commit message and in the per-demo section above. No code change needed.

### Non-deviations worth flagging

**6. Per-tab and per-row action names use namespaced-with-dash-separator naming.**

- Plan said the framework doesn't have an opinion on action naming style and listed `delete-row-42`, `row/42/delete`, `tickets:42:close` as all valid. I used dash-separated everywhere (`delete-row-42`, `filter-all`, `select-ticket-42`, `set-type-hardware`) for consistency across demos. Mixing styles per-demo would have made the demo set less coherent as a teaching reference.
- This isn't a deviation from the plan — the plan explicitly left this to executor discretion. Flagging it as an intentional choice future planners may want to standardize.

**7. CONTEXT.md was not updated.**

- The plan's Task 2 instructions say "If you find a pattern the Task 1 reference doesn't cover, update CONTEXT.md with a note for the planner reviewing Plan 05." Two patterns came up that Task 1 didn't fully predict (the camelCase-vs-kebab-case wire-key issue in RetroBoard's per-lane drafts; the FeatureProbe parity-driven state slots for redirect/storage/download parameters). Both are covered here in this summary's per-demo sections — clearer for the Plan 05 author to find together with the rest of the migration write-up than scattered between two files. CONTEXT.md captures locked decisions, not in-flight implementation discoveries.

## Known Stubs

None — every demo's end-user flow is preserved and exercised by tests where tests exist.

## Threat Flags

None. Pure refactor: no new endpoints, no new auth paths, no schema changes, no new file/data-trust-boundary surfaces. The wire-shape break is the headline change of the phase, and the framework-level uniqueness validator (Plan 02) is the new structural guarantee — every demo opts in via `.Validate()` on the .NET side and via `createAction` on the TS side.

## Self-Check: PASSED

- All 4 commit hashes are present in `git log --oneline -10`:
  - `b4bedd9` Tasks migration.
  - `ae565b4` ContactManager/ExpenseTracker/RetroBoard/Reorder.
  - `19b5bb3` HelpDesk (canonical workflow).
  - `9bbc254` FeatureProbe/Showcase/Tasks-fullstack-bun.
- All test suites exit 0: Tasks 28/28, ContactManager 39/39, ExpenseTracker 29/29, RetroBoard 33/33, HelpDesk 43/43 (172 .NET tests total, all green).
- `grep -r "payload\.context\|payload\.Context" demo/ --include="*.ts" --include="*.cs"` returns nothing.
- `grep -r "TableSelection\b" demo/ --include="*.ts" --include="*.cs"` returns nothing.
- Per-demo curl smoke: every bun demo's GET response carries `"bind":` (Reorder excepted by design — no input fields) and zero occurrences of `"context":` or `"selection":`.
- Framework's own `npx vitest run`: 174 passed | 1 skipped (175 total).
