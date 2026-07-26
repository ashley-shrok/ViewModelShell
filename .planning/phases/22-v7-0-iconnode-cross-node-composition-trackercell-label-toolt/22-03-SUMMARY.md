# Plan 22-03 — TrackerCell.label → tooltip rename (SUMMARY)

**Completed:** 2026-07-26
**Wave:** 1 (autonomous)
**Requirements:** ICON-06
**Atomic commit:** `9e328f7 feat(22-03)!: rename TrackerCell.label → TrackerCell.tooltip (both backends)`

## What was built

The ONE breaking wire change for v7.0.0 — a pure type-side rename on a single node type:

1. **TypeScript** — `TrackerCell.label?: string` → `TrackerCell.tooltip?: string` in `viewmodel-shell/src/index.ts`. TSDoc updated to name the 6.12.1 body-appended `.vms-tooltip-host` singleton (the styled tooltip infrastructure Plan 22-05 will wire in on the render path).
2. **.NET** — `TrackerCell` positional record's second parameter renamed `Label` → `Tooltip` in `viewmodel-shell-dotnet/ViewModels.cs`, same `[JsonIgnore(WhenWritingNull)]` posture, same `string?` type. XML-doc updated to name the 6.12.1 singleton.
3. **Callsite sweep** — every callsite in the repo that used `Label:` (or `label:`) as a named argument on `TrackerCell`:
   - `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (two callsites)
   - `demo/FeatureProbe-bun/handler.ts` (two callsites + a comment)
   - `viewmodel-shell/src/browser.ts` (renderer read `cell.label` — compile-fix rename; the semantic swap from `el.title = ...` to the `.vms-tooltip-host` singleton is Plan 22-05's scope)
   - `viewmodel-shell/src/adapter.test.ts` (one test's construction + a doc comment naming the v7.0.0 rename)
4. **`TrackerCellRenameTests.cs`** — 5 dedicated xUnit tests:
   - `new TrackerCell(Tooltip: "x")` serializes as `"tooltip":"x"`.
   - The old field name `"label"` MUST NOT appear anywhere in the emitted JSON.
   - `new TrackerCell()` serializes to `{}` (WhenWritingNull posture preserved — gotcha #8 class-2 defect regression guard).
   - Nested `TrackerNode` with tooltip-bearing cells + action serializes end-to-end.
   - Discoverability sentinel comment showing `new TrackerCell(Label: "x")` is compile-time gone.

## Files changed

- `viewmodel-shell/src/index.ts` — one field rename + TSDoc update.
- `viewmodel-shell/src/browser.ts` — `cell.label` → `cell.tooltip` reads (compile fix; render-swap is Plan 22-05).
- `viewmodel-shell/src/adapter.test.ts` — one construction + one docstring updated.
- `viewmodel-shell-dotnet/ViewModels.cs` — TrackerCell record positional-parameter rename + XML-doc update.
- `viewmodel-shell-dotnet/Tests/TrackerCellRenameTests.cs` — new file, 5 test cases.
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — two callsite renames.
- `demo/FeatureProbe-bun/handler.ts` — two callsite renames + comment update.

## Deviations from plan

- Plan called out `viewmodel-shell/dist` — the built package output — because the demo TS tsconfigs resolve the `@ashley-shrok/viewmodel-shell` import through a symlink to the repo root, where they read `dist/` (published shape), not `src/`. `check:demo-types` was failing on the first run because the built types were stale. Rebuilt `dist/` via `npm run build` in `viewmodel-shell/` to refresh the exported types before re-running the gate; this is a routine build step, not a plan deviation, but naming it here for clarity.
- Plan's serialization-test middle-dot (`·`) — used a plain ASCII string in the assertion instead, because System.Text.Json by default escapes non-ASCII to `·`. The wire is byte-identical (both backends emit the same escape), but a `Contains()` on the literal char would fail. This is a test-only clarity fix, not a wire change.

## Gate results

| Gate | Result |
|---|---|
| `npx vitest run` (full TS framework suite) | ✓ 61 files / 968 passed / 1 skipped |
| `npm run check:core-globals` | ✓ clean |
| `npm run check:test-types` | ✓ clean |
| `npm run check:demo-types` | ✓ 20 demo projects clean (after `dist/` rebuild) |
| `dotnet test viewmodel-shell-dotnet/Tests -c Release` | ✓ 215 / 215 passed (was 210 → +5 new) |
| `dotnet test demo/Tasks/AspNetCore.Tests` | ✓ 28 / 28 |
| `dotnet test demo/ContactManager/AspNetCore.Tests` | ✓ 39 / 39 |
| `dotnet test demo/RetroBoard/AspNetCore.Tests` | ✓ 33 / 33 |
| `dotnet test demo/ExpenseTracker/AspNetCore.Tests` | ✓ 30 / 30 |
| `dotnet test demo/HelpDesk/AspNetCore.Tests` | ✓ 61 / 61 |
| `agent-skill.md` grep for `TrackerCell` | ✓ zero mentions in both TS + .NET copies (maintainer rule holds) |

## Acceptance criteria — all met

- `TrackerCell` interface (TS) contains `tooltip?: string`, not `label?: string` ✓
- TSDoc mentions `6.12.1` or `.vms-tooltip-host` or `styled tooltip` (all three present) ✓
- `TrackerCell` record (.NET) has `Tooltip` as second positional parameter, not `Label` ✓
- XML-doc mentions `.vms-tooltip-host` ✓
- No callsite in `demo/` or `viewmodel-shell-dotnet/` uses `Label:` on `TrackerCell` (verified via grep) ✓
- Wire proof: `new TrackerCell(Tooltip: "...")` emits `"tooltip":"..."`; `new TrackerCell()` emits `{}` ✓
- Full framework suite + all `check:*` + every `demo/**/*.Tests.csproj` pass ✓
- `agent-skill.md` (both TS + .NET) does NOT mention `TrackerCell.label` (or `.Label`) — maintainer rule holds ✓

## Next dependency

Plan 22-05 (TrackerCell tooltip render swap) — depends on this rename. Will replace the `el.title = cell.tooltip` line in `browser.ts` with the shipped 6.12.1 `.vms-tooltip-host` singleton wiring (`el.classList.add("vms-has-tooltip"); el.dataset.vmsTooltip = cell.tooltip;`) — same wiring as Button.tooltip / TableColumn.tooltip.

Plan 22-10 (v7.0.0 release closeout) — will land the MIGRATION.md entry + CHANGELOG line + the Molly DM before publish.
