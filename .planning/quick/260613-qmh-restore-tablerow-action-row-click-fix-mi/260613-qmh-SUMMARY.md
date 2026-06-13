---
phase: quick-260613-qmh
plan: 01
subsystem: viewmodel-shell (TS + .NET) + HelpDesk demo
tags: [table, a11y, wire-shape, release, 1.1.0]
dependency-graph:
  requires: [13ce9f0]
  provides:
    - "TableRow.action restored (TS + .NET) — click-anywhere row dispatch primitive with full keyboard + ARIA"
    - "TableRow.actions[] widened to (ButtonNode | CheckboxNode)[] on TS; .NET stays IReadOnlyList<ViewNode>?; renderer dispatches by entry.type"
    - "HelpDesk demo migrated to the canonical pattern (row.action for navigation, row.actions[] for the bulk-selection checkbox)"
    - "npm + NuGet 1.1.0 release (lockstep) with CHANGELOG + MIGRATION + AGENTS.md updates"
  affects: [viewmodel-shell, viewmodel-shell-dotnet, demo/HelpDesk/AspNetCore, demo/HelpDesk-bun]
tech-stack:
  added: []
  patterns:
    - "row.action click-anywhere primitive + per-row controls coexist via stopPropagation containment on actions td and cell linkLabel anchors"
    - "actions[] dispatched by entry.type (ButtonNode → this.button; CheckboxNode → this.checkbox)"
key-files:
  created:
    - viewmodel-shell/test/table-row-action.test.ts
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell-dotnet/ViewModels.cs
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/styles/default.css
    - demo/HelpDesk/AspNetCore/AgentController.cs
    - demo/HelpDesk-bun/server.ts
    - demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs
    - viewmodel-shell/package.json
    - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
    - viewmodel-shell/package-lock.json
    - CHANGELOG.md
    - MIGRATION.md
    - AGENTS.md
decisions:
  - "Placed .NET TableRow.Action AFTER Variant in the record-parameter order, not after Actions, to minimize positional-construction churn. Codebase audit (7 hits of `new TableRow(`) confirmed all callers use named arguments — placement was free; chose end-of-record so the diff is purely additive."
  - "Browser renderer's Task-1 narrowing (skip non-button entries) shipped in commit e9dcf8c alongside the type widening, with a 1-line comment pointing to Task 2 as the replacement. The plan said 'do not touch the renderer in Task 1'; chose to ship the minimal 3-line type-bridge so tsc stays green between commits — green build is a basic correctness invariant for every intermediate commit. Task 2 replaced the bridge with the full entry.type dispatch."
  - "aria-label cell-text join uses ' · ' (middle-dot with spaces) per the orchestrator's `<constraints>` block (not the plain space the behavior block suggested), so the spoken label has a clear field boundary."
  - "Bun-twin row type widened locally (TS structural type only — no shared interface file in HelpDesk-bun) by adding `action?: { name: string }` to the inline row-object shape. Matches the wire."
  - "Did NOT touch parity/fixtures/helpdesk.json — the action sequence is unchanged (select-ticket-{id} still resolves to the same handler whether dispatched from a button or a row click). Parity passes step-for-step across all 15 backend pairs."
  - "package-lock.json was 0.16.0 (stale) on entry; npm install --package-lock-only synced it to 1.1.0 alongside the package.json bump. Included in the 1.1.0 release commit so lockfile matches the published version."
metrics:
  duration: ~25 minutes wall-clock
  completed: 2026-06-13
---

# Quick Task 260613-qmh: TableRow.action restore + actions[] mixed-types fix Summary

Restored the click-anywhere `TableRow.action` primitive (removed in the Phase-6 wire-shape refactor) with full keyboard + ARIA, AND fixed the latent silent breakage in `TableRow.actions[]` that was rendering CheckboxNode entries as empty buttons. Migrated the HelpDesk agent queue to the canonical pattern (row click navigates, per-row checkbox handles bulk selection), shipped as a lockstep npm + NuGet 1.1.0 minor.

## What Shipped (per task)

| # | Commit | Subject |
|---|---|---|
| 1 | `e9dcf8c` | feat(table): restore TableRow.action and widen actions[] to ButtonNode\|CheckboxNode |
| 2 | `633d01f` | feat(table): render TableRow.action with keyboard + ARIA; dispatch actions[] by entry.type |
| 3 | `d3be241` | test(table): cover row.action click+keyboard+ARIA and CheckboxNode-in-actions fix |
| 4 | `f81ff67` | feat(helpdesk): use row.action for click-anywhere navigation; drop Open button |
| 5 | `b9f7f19` | chore(release): viewmodel-shell 1.1.0 — restore TableRow.action + fix actions[] mixed types |

## Verification — all four CI suites green

Ran each suite at the end of Task 5 and read the actual output (per the orchestrator's "verify is non-negotiable" instruction):

| Suite | Command | Result | Delta from baseline |
|---|---|---|---|
| **vitest (full TS)** | `cd viewmodel-shell && npx vitest run` | **250 passed \| 1 skipped (251 total)** | +10 (was 240/240+1; ten new tests in `table-row-action.test.ts`) |
| **HelpDesk .NET** | `cd demo/HelpDesk/AspNetCore.Tests && dotnet test --filter "FullyQualifiedName~AgentControllerTests"` | **25/25 passed** | unchanged (one test renamed, assertions updated) |
| **Cross-backend parity** | `bun run parity/run.ts` | **✓ all backends agree** | unchanged (all 15 backends step-for-step; HelpDesk wire is additive) |
| **Core-globals + AA-contrast guards** | `npm run check:core-globals && npm run check:aa-contrast` | **both green** | focus-ring `:focus-visible` uses `var(--vms-accent)` — passes WCAG-AA on shipped default + all 12 themes |

## Version Delta

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `1.0.1` | **`1.1.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `1.0.0` | **`1.1.0`** |

Lockstep minor bump per the framework convention (major.minor aligned across both packages; wire is additive).

## Behavior delivered

**TableRow.action — click-anywhere primitive (restored).** When set on a row, the entire `<tr>` becomes clickable AND keyboard-activatable (`Enter` dispatches; `Space` `preventDefault()`s page scroll then dispatches; `Tab` does NOT dispatch) AND exposes accessibility (`role="button"`, `tabindex=0`, `aria-label` derived from non-empty cell text joined by ` · `, fallback to `Row {id}` if empty). Per-row identity is in the action name (e.g. `select-ticket-42`) — no `context` field, consistent with the Phase-6 wire. The renderer attaches `stopPropagation` to the per-row controls (`.vms-table__td--actions`) and to cell `linkLabel` anchors when `row.action` is set, so toggling a per-row checkbox or clicking the linkLabel never double-fires the row action. `:focus-visible` paints a 2px outline using `var(--vms-accent)` with `outline-offset: -2px` (ring stays inside row borders).

**TableRow.actions[] — mixed-type dispatch (fixed).** The TS type widened from `ButtonNode[]` to `(ButtonNode | CheckboxNode)[]`. The .NET side stays `IReadOnlyList<ViewNode>?` for polymorphic-discriminator emission (per the existing maintainer rule). The renderer now dispatches by `entry.type`: `"button"` → `this.button(entry, td, on)`, `"checkbox"` → `this.checkbox(entry, td, on)`, unknown types no-op (forward-compatible). Previously, calling `this.button()` blindly on every entry caused CheckboxNode entries to silently render as empty `<button>` elements — that was the source of the HelpDesk per-row selection toolbar appearing broken.

**HelpDesk demo migrated.** Both AspNetCore and bun backends now use `row.action = select-ticket-{id}` for the click-anywhere navigation and `row.actions[] = [CheckboxNode]` for the per-row bulk-selection checkbox. The per-row "Open" `ButtonNode` is gone — the row IS the affordance now, with keyboard + ARIA automatic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking issue] Task-1 renderer type-bridge to keep tsc green.**
- **Found during:** Task 1 verification (`npx tsc --noEmit`).
- **Issue:** The plan said "Do NOT touch the renderer in Task 1," but widening `TableRow.actions` to `(ButtonNode | CheckboxNode)[]` immediately type-errored at `browser.ts:790` because the existing loop called `this.button(btn, td, on)` blindly on a union type that no longer assigned to `ButtonNode`. Strict-tsc would have left every intermediate commit between Task 1 and Task 2 with a broken build.
- **Fix:** Replaced the 1-line `for (const btn of row.actions) this.button(btn, td, on);` with a 3-line `if (entry.type === "button") this.button(entry, td, on);` in Task 1's commit, marked with a header comment pointing to Task 2 as the replacement. Behavior is byte-identical to the pre-widening renderer for in-tree consumers (no one shipped a CheckboxNode entry yet — that's literally the bug being fixed). Task 2 then replaced the bridge with the full `entry.type` dispatch as planned.
- **Files modified:** `viewmodel-shell/src/browser.ts`
- **Commit:** `e9dcf8c` (Task 1)
- **Why not a Rule 4 (architectural):** Three-line type-bridge with explicit pointer to its successor commit. No new primitive. The alternative — leaving the build broken between commits 1 and 2 — would violate the "green build between commits" invariant for any tooling that bisects.

**2. [Rule 3 — Blocking issue] First parity run failed with "Timeout waiting for http://localhost:5002/api/tasks".**
- **Found during:** Task 4 parity verification.
- **Issue:** No `node_modules/` in any of the `demo/*-bun` folders (worktrees start fresh), AND the framework `dist/` artifacts were missing — bun backends couldn't resolve `@ashley-shrok/viewmodel-shell/server`.
- **Fix:** Ran `npm install` in `viewmodel-shell/`, `npm run build` to produce `dist/`, then `bun install` in every `demo/*-bun/` folder. Re-ran parity — `✓ all backends agree`. This is one-time worktree setup, not a code change.
- **Files modified:** none (only generated `node_modules/` and `dist/` artifacts; lockfile sync captured in Task 5).

**3. [Decision recorded — not auto-fix] aria-label separator.**
- **Plan behavior block:** "concatenated non-empty cell text values (space-separated)."
- **Orchestrator's `<constraints>` block:** "concatenate non-empty cell values with ` · ` separator."
- **Resolution:** Followed the orchestrator's explicit constraint (`· `) over the plan's looser guidance — the orchestrator constraints are more recent and more specific.

### Out of Scope / Did NOT do

- **`parity/fixtures/helpdesk.json` edits.** The plan flagged this as a possible touch-point. Inspected: the fixture's action sequence dispatches `select-ticket-1` by name only — that handler is unchanged on both backends. Parity passes step-for-step without fixture edits.

## Key Decisions

1. **Placement of `.NET TableRow.Action`** — appended to the end of the record (after `Variant`). All seven `new TableRow(` call sites in the codebase use named arguments, so positional order is free; chose end-of-record so the diff is purely additive.
2. **Bun row-shape widening** — the bun twin doesn't share an interface file; widened the inline row-object type locally to `{ ...; action?: { name: string } }`. Matches the wire.
3. **No parity-fixture changes** — the action sequence is unchanged. The fixture is data, not implementation.
4. **Lockfile synced to 1.1.0** — `package-lock.json` was 0.16.0 on entry (pre-existing drift). Ran `npm install --package-lock-only` to bring it forward alongside the version bump; included in the 1.1.0 release commit so the lockfile matches the published version.

## Self-Check: PASSED

- `viewmodel-shell/test/table-row-action.test.ts` — exists, 10 tests, all passing.
- `viewmodel-shell/src/index.ts` — contains `action?: ActionEvent` and `actions?: (ButtonNode | CheckboxNode)[]` on `TableRow`.
- `viewmodel-shell-dotnet/ViewModels.cs` — contains `ActionDescriptor? Action = null` with the `JsonIgnore-when-null` attribute.
- `viewmodel-shell/src/browser.ts` — contains the row-click + keydown handler, the `entry.type` dispatch, and the `stopPropagation` calls on actions td + linkLabel anchor.
- `viewmodel-shell/styles/default.css` — contains `.vms-table__row--clickable:focus-visible { outline: 2px solid var(--vms-accent); outline-offset: -2px; }`.
- `demo/HelpDesk/AspNetCore/AgentController.cs` and `demo/HelpDesk-bun/server.ts` — both set `row.Action / row.action = select-ticket-{id}`; neither includes the "Open" button anymore.
- `demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs` — renamed test asserts `Empty(row.Actions.OfType<ButtonNode>())` and `row.Action.Name == select-ticket-{id}`.
- `CHANGELOG.md` — has a top-of-file 1.1.0 entry.
- `MIGRATION.md` — has a 1.1.0 section ahead of the 1.0.0 section.
- `AGENTS.md` — "Tables in VMS" section gained the `row.action` + mixed-types paragraph.
- `viewmodel-shell/package.json` — version `1.1.0`. `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` — `<Version>1.1.0</Version>`. `viewmodel-shell/package-lock.json` — top-level version `1.1.0`.
- All five commits exist in `git log --oneline -6`: `e9dcf8c`, `633d01f`, `d3be241`, `f81ff67`, `b9f7f19` — verified.
