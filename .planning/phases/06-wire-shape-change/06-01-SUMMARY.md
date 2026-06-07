---
phase: 06-wire-shape-change
plan: 01
subsystem: wire-protocol-types
tags: [breaking-change, wire-format, types, bind-paths, table-selection-removed]
requires: []
provides:
  - TS ViewNode union with `bind` field on every input-bearing node
  - .NET ViewNode records mirroring TS byte-for-byte
  - `ActionEvent` / `ActionPayload<TState>` without `context`
  - Action dispatch envelope reduced to `{name, state, files?}`
affects:
  - viewmodel-shell/src/browser.ts (will type-error until Plan 03 rewrites it)
  - every demo controller (will compile-error until Plan 04 migrates them)
  - parity fixtures (Plan 05 rewrites action sequences)
tech-stack:
  added: []
  patterns: [discriminated-union, byte-aligned-backends, json-ignore-when-null]
key-files:
  created: []
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/src/server.ts
    - viewmodel-shell-dotnet/ViewModels.cs
decisions:
  - "Bind path syntax is a single dotted string (e.g. `fields.title`, `rows.42.completed`) — no richer wire shape. Complexity goes in the node, not the bind."
  - "Drop top-level `action` from TabsNode; each tab now carries its own unique-named action (`tabs[].action`). The renderer writes `value` to the bound state path, then dispatches the tab's action — preserves auto-dispatch UX without a context payload."
  - "TableRow.action → TableRow.actions (poly list of ButtonNodes). Per-row identity moves into the action name itself (e.g. `delete-row-42`). The wire-honest shape: a row's button is literally a ButtonNode."
  - "TablePagination drops `action`; gains `prevAction?` + `nextAction?`. Renderer writes target page to `paginationBind` slot before dispatch."
  - "TableNode keeps `filterAction` (single per-table dispatch) — simplest shape; per-column filter VALUES live in state at `filterBinds` paths."
  - "ActionDescriptor (.NET) becomes `(string Name)` only — the parsing layer no longer reads `context` from either multipart or JSON bodies."
metrics:
  duration: "~30min"
  completed: "2026-06-07"
  tasks: 3
  files_modified: 3
  commits: 3
---

# Phase 6 Plan 01: Type System & Action-Payload Parsers Summary

Reshaped the ViewNode types (TS + .NET) and the action-payload parsing layer (TS + .NET) to the new wire contract: every input declares a `bind` path into state, and the action envelope on the wire is `{name, state, files?}` — no `context` payload anywhere.

## What changed

- **`ActionEvent` (TS) / `ActionDescriptor` (.NET):** dropped `context` — actions are now name-only on the wire. Dispatch serializes `JSON.stringify({name: action.name})` instead of `{name, context}`.
- **`FieldNode` / `CheckboxNode` / `TabsNode`:** required `bind: string` field added on each, declaring the path into state where the input's current value is read and where user input is written. `FieldNode.value` and `CheckboxNode.checked` removed — values flow through state at the bind path.
- **`TabsNode`:** top-level `action` removed; each tab now carries its own unique-named action (e.g. `select-tab-pending`, `select-tab-active`, `select-tab-done`). Plan 02's `validateActionNames` will enforce uniqueness across the tree.
- **`TableRow.action` → `TableRow.actions`:** per-row buttons are full ButtonNodes with unique action names (e.g. `delete-row-42`). Wire-honest, supports multiple per-row actions naturally.
- **`TableSelection` deleted entirely:** selection is no longer a framework concept. Apps express per-row selection as a bound CheckboxNode cell + plain bulk-action buttons reading from state.
- **`TableNode` reshaped:** drop `sortColumn`, `sortDirection`, `sortAction`, `selection`; add `sortBind`, `filterBinds` (per-column), `paginationBind`, `sortActions` (per-column). Keep `filterAction` as a single per-table dispatch — simplest shape; per-column filter values live in state at the bound paths.
- **`TablePagination`:** drop `action`; add `prevAction?` + `nextAction?` (each a unique action name). Renderer writes the target page number to `paginationBind` before dispatch.
- **`ActionPayload<TState>` (TS + .NET):** dropped `context` field. `parseFormDataAction` / `parseJsonAction` (TS) and `Parse` / `ParseJson` (.NET) no longer read or surface `context` — they read `{name, state}` only. Multipart still routes files into `payload.files`.

## Verification

- `npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --lib ES2022,DOM,DOM.Iterable src/index.ts` — exits 0.
- `npx tsc --noEmit ... src/server.ts` — exits 0.
- `cd viewmodel-shell-dotnet && dotnet build --nologo -v minimal` — 0 Warning(s), 0 Error(s).
- `grep "TableSelection" viewmodel-shell/src/index.ts` — empty.
- `grep "TableSelection" viewmodel-shell-dotnet/ViewModels.cs` — empty.
- `grep "context" viewmodel-shell/src/server.ts` — empty.
- `grep "context?: Record" viewmodel-shell/src/index.ts` — empty.

The full project tsc (`npx tsc --noEmit -p .` on `viewmodel-shell`) intentionally still surfaces type errors inside `browser.ts` against the new ViewNode shape — Plan 03 rewrites browser.ts as a thin interpreter that consumes the new fields, and Plan 04 migrates demo handlers off `payload.context`. The expected break is explicitly noted in this plan's success criteria.

## Tasks completed

| Task | Name                                                                 | Commit  | Files                                    |
| ---- | -------------------------------------------------------------------- | ------- | ---------------------------------------- |
| 1    | Rewrite TS ViewNode types — add `bind` to inputs, drop `context`     | 61193ff | viewmodel-shell/src/index.ts             |
| 2    | Rewrite TS ActionPayload + parsers                                   | 6c0c09a | viewmodel-shell/src/server.ts            |
| 3    | Rewrite .NET ViewModels.cs to mirror TS byte-for-byte                | 58a0fb7 | viewmodel-shell-dotnet/ViewModels.cs     |

## Deviations from Plan

None — plan executed exactly as written.

The plan's verify steps used `npx tsc --noEmit src/index.ts` (and `src/server.ts`); with NodeNext module resolution in the project tsconfig, that invocation rejects single-file mode, so equivalent type-checking was done via explicit `--target/--module/--moduleResolution/--strict/--skipLibCheck/--lib` flags on the command line (same compiler options the tsconfig sets). The criterion the verify step checks for — "the file compiles" — is met. Recorded here for completeness, not as a structural deviation.

## Known Stubs

None.

## Threat Flags

None — this plan only reshapes type declarations and the action-payload parsing layer. No new endpoints, auth paths, or data-trust-boundary surfaces are introduced. The wire-shape break is the headline change of the phase; downstream plans (02 uniqueness check, 03 renderer, 04 demos, 05 parity) consume the new types.

## Self-Check: PASSED

- `viewmodel-shell/src/index.ts` exists and contains `bind: string` (3 declarations) + has no `TableSelection`, no `sortDirection`, no `sortAction` (singular).
- `viewmodel-shell/src/server.ts` exists and contains no `context` references.
- `viewmodel-shell-dotnet/ViewModels.cs` exists, compiles clean, contains 3 `string Bind` declarations and no `TableSelection`.
- Commits 61193ff, 6c0c09a, 58a0fb7 are present in `git log --oneline -5`.
