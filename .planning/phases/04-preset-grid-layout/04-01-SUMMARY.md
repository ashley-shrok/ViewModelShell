---
phase: 04-preset-grid-layout
plan: 01
subsystem: wire-model-contract
tags: [layout, wire-format, closed-union, cross-backend, additive-field]
dependency_graph:
  requires:
    - "Phase 3 density?/variant? closed-union precedent (index.ts + ViewModels.cs)"
  provides:
    - "PageNode.layout? / SectionNode.layout? closed-union (TS) — the only layout field on the wire"
    - ".NET PageNode/SectionNode records' string? Layout = null trailing optional member"
    - "layout field reachable from src/server.ts via existing re-export (no server.ts edit)"
  affects:
    - "Wave 2 Plan 02 renderer (browser.ts) — consumes layout via closed-equality guard"
    - "Wave 2 Plan 02 CSS (default.css) — .vms-{page,section}--split/--cards rules"
    - "Wave 2 parity fixture (feature-probe) — exercises layout cross-backend (LAYOUT-05)"
tech_stack:
  added: []
  patterns:
    - "Closed-union additive optional wire field (mirrors Phase 3 density?/variant?)"
    - "Trailing optional positional record parameter (.NET, mirrors string? Density/Variant)"
key_files:
  created:
    - .planning/phases/04-preset-grid-layout/04-01-SUMMARY.md
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell-dotnet/ViewModels.cs
decisions:
  - "D-03 honored: server.ts NOT edited — line 13 `export * from \"./index.js\"` re-exports the new field automatically; LAYOUT-05's 'present in src/server.ts' satisfied by the re-export"
  - "D-10 honored: exactly one shared viewmodel-shell-dotnet/ViewModels.cs; no demo/**/ViewModels.cs exists or was created"
  - "D-11 honored: zero version bump (no package.json / .csproj / NuGet change)"
  - "D-01/D-02 honored: closed three-literal union (\"stack\" | \"split\" | \"cards\"), never an open string"
metrics:
  duration: 2min
  tasks: 2
  files: 2
  completed: 2026-05-18
---

# Phase 4 Plan 01: Layout Wire/Model Contract Summary

Added the single optional closed-union layout-preset field — `layout?: "stack" | "split" | "cards"` (TS) / `string? Layout = null` (.NET) — to `PageNode` and `SectionNode` on both backends, mechanically mirroring the Phase 3 `density?`/`variant?` precedent, with `server.ts` untouched (re-export carries it) and no version bump.

## What Was Built

This plan establishes the wire/model contract that the Wave 2 renderer, CSS, parity fixture, and tests build against. It is the *only* layout field that ever crosses the wire (LAYOUT-04).

### Task 1 — TS `layout?` closed-union (`viewmodel-shell/src/index.ts`)
- Added `layout?: "stack" | "split" | "cards"` to `PageNode` (after `density?`) and `SectionNode` (after `variant?`), each preceded by a JSDoc comment mirroring the adjacent `density?`/`variant?` style verbatim (RESEARCH Pattern 1).
- The PageNode JSDoc references `.vms-page--split` / `.vms-page--cards`; the SectionNode JSDoc references `.vms-section--split` / `.vms-section--cards`.
- `viewmodel-shell/src/server.ts` was NOT edited — line 13 `export * from "./index.js"` re-exports the new field automatically (D-03 / LAYOUT-05).
- Verification: `tsc --noEmit -p tsconfig.json` exits 0 (clean, no type errors introduced).
- Commit: `e7187bf`

### Task 2 — .NET `string? Layout = null` (`viewmodel-shell-dotnet/ViewModels.cs`)
- Added `string? Layout = null` as the final positional record parameter to `PageNode` (after `string? Density = null`) and `SectionNode` (after `string? Variant = null`), mirroring the existing Phase 3 precedent.
- `Layout` is the LAST positional parameter on each record, so existing positional construction sites stay valid.
- No `JsonDerivedType`/serializer change needed: `Layout` is a plain `string?` on records already registered; the demos' camelCase + `JsonIgnoreCondition.WhenWritingNull` config drops `Layout = null` automatically, exactly as `Density`/`Variant` are today.
- Single shared source (D-10): no `demo/**/ViewModels.cs` exists; demos consume via `<ProjectReference>`.
- Verification: `dotnet build AshleyShrok.ViewModelShell.csproj -c Release` exits 0 (0 warnings, 0 errors).
- Commit: `89bcbe5`

## Verification Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` in `viewmodel-shell` | Exit 0 (clean) |
| `dotnet build AshleyShrok.ViewModelShell.csproj -c Release` | Exit 0 (0W/0E) |
| `layout?: "stack" \| "split" \| "cards"` count in `index.ts` | Exactly 2 (PageNode, SectionNode) |
| `string? Layout = null` count in `ViewModels.cs` | Exactly 2 (PageNode, SectionNode) |
| Files changed across both commits | Only `viewmodel-shell/src/index.ts` + `viewmodel-shell-dotnet/ViewModels.cs` |
| `src/server.ts` in diff | NOT present (D-03 — re-export only, line 13 intact) |
| `demo/**/ViewModels.cs` created/edited | None exist (D-10) |
| `package.json` / `.csproj` version changed | None (D-11) |
| `layout` added to any other node interface | No (only PageNode/SectionNode) |
| `JsonDerivedType` lines added/modified | None |

## Deviations from Plan

None — plan executed exactly as written.

**Execution note (not a plan deviation):** The worktree had no `viewmodel-shell/node_modules`, so the plan's Task 1 verification command (`tsc --noEmit`) could not run until dependencies were installed. Ran `npm install` (blocking-issue resolution, Rule 3) — this produced zero tracked-file changes (`node_modules/` is gitignored; `package-lock.json` is tracked but unchanged because installed deps matched the lockfile). No git diff, no behavior impact, no version change. `npx tsc` initially resolved the wrong public `tsc@2.0.4` package; used the local `./node_modules/.bin/tsc` (the binary the project's `build` script uses) instead.

**Worktree base correction (pre-execution):** On entry the worktree branch was based on `f057cd6` (an unrelated v0.3.13-closeout line) rather than the required feature-branch base `1213f69` (which contains the phase 04 plans). Per the worktree-branch-check protocol, `git reset --hard 1213f69` was applied. The discarded commits (`f057cd6`, `b0aecd2`, `414a059`, `6b9f2e8`, `271cb30`) were unrelated v0.3.13 work, NOT plan 04-01 work; no plan content was lost. The pre-existing uncommitted `.planning/config.json` modification and `CLAUDE.md` deletion from that line were also reset (they belonged to the wrong base, not to this plan).

## Authentication Gates

None.

## Threat Surface

The plan's threat register assigns `mitigate` to T-04-01 (a `layout` value flowing toward a CSS class name). The register itself states the actual mitigation — the closed-union type plus the renderer's `n.layout === "split" || n.layout === "cards"` closed-equality guard — and that the guard is asserted in **Plan 02**, not this plan. This plan adds only the field; the closed-union type (`"stack" | "split" | "cards"`, never an open `string`) is in place exactly as the by-design mitigation requires. T-04-02 (new optional `string?` on an already-deserialized record) is `accept`: no new parse/network/file/exec surface introduced. No new threat surface beyond the plan's `<threat_model>` was created — no Threat Flags.

## Known Stubs

None. Both changes are pure additive optional type/record fields with no data flow, no placeholder values, no hardcoded empties, and no UI wiring. The downstream consumers (renderer/CSS/fixture/tests) are explicitly Wave 2 (Plans 02–04) by design, not stubs within this plan's goal.

## Self-Check: PASSED

- FOUND: .planning/phases/04-preset-grid-layout/04-01-SUMMARY.md
- FOUND: viewmodel-shell/src/index.ts (modified)
- FOUND: viewmodel-shell-dotnet/ViewModels.cs (modified)
- FOUND commit: e7187bf (Task 1 — TS layout? closed-union)
- FOUND commit: 89bcbe5 (Task 2 — .NET string? Layout = null)
