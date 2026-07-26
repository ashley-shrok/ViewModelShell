# Plan 22-07 — Parity FeatureProbe + expectBodyContains tripwires (SUMMARY)

**Completed:** 2026-07-26
**Wave:** 3 (autonomous)
**Requirements:** ICON-09
**Atomic commit:** `14d1196 feat(22-07): parity FeatureProbe extension + expectBodyContains tripwires`

## What was built

Extended the FeatureProbe `buildVm` on both TS + .NET backends byte-identically to exercise every icon surface, added an `icon-only-invalid` action to both backends that exercises the walker, and added per-branch `expectBodyContains` coverage tripwires to the parity fixture and envelope fixture.

### `iconsSection` (added to both backend twins)

Byte-identical emission covering:

- **Standalone IconNode**: bare (all optionals absent per WhenWritingNull), one per size (xs/sm/md/lg/xl), one per tone (info/success/warning/danger — 4 matches the closed union), a meaning-carrying one with label, and two names that exercise the `.NET` `IconNameConverter`'s digit-aware kebab conversion: `shield-check` (multi-word) and `trash-2` (number-suffixed — the specific defect the plain `KebabEnum<T>` would silently drift on, flagged in Plan 22-02).
- **Cross-node `icon?:` on all 5 hosts**: `Button+icon:sparkles`, `Link+icon:external-link`, `Section+icon:activity`, `Badge+icon:check-circle`, `ListItem+icon:folder`.
- **VALID icon-only ButtonNode**: label=`""` + tooltip=`"Settings"` + icon=`wrench` — proves the walker's positive branch.

### `icon-only-invalid` action (added to both backends)

Returns a tree with an icon-only ButtonNode WITHOUT tooltip. The walker throws `InvalidOperationException("icon-only ButtonNode requires tooltip (used as aria-label)")` on both backends. The framework catches this and surfaces `{ok:false, errors:[{code:"invalid_tree", message:"icon-only ButtonNode requires tooltip (used as aria-label)"}]}` at 500.

### Fixture updates

- `parity/fixtures/feature-probe.json`:
  - Appended a `$comment` clause per the v5.1 pattern naming every branch the icons section exercises.
  - Added 9 `expectBodyContains` tripwire strings to the initial GET step:
    - `"type":"icon"`, `"name":"sparkles"`, `"name":"shield-check"`, `"name":"trash-2"` (all three enum-boundary cases)
    - `"size":"xl"`, `"tone":"danger"`, `"label":"Delete permanently"`
    - `"icon":"external-link"`, `"icon":"folder"` (cross-node)
    - `"tooltip":"2026-07-15 14:02 UTC · Success"` (TrackerCell.tooltip rename verification — proves the field renamed on the wire, not just the .NET record parameter)
- `parity/fixtures/feature-probe-envelope.json`:
  - Extended the `$comment` clause naming the new step.
  - Added a 5th step `icon-only-invalid` POSTing to the new action; `expectStatus: 500` + `expectBodyContains: ["icon-only ButtonNode requires tooltip (used as aria-label)", "invalid_tree"]`. No `compareIgnoreFields` — the message is asserted byte-identical across backends, which IS the proof.

## Files changed

- `demo/FeatureProbe-bun/handler.ts` — new `iconsSection` + `icon-only-invalid` action handler.
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — byte-identical `iconsSection` emission + `icon-only-invalid` action handler.
- `parity/fixtures/feature-probe.json` — `$comment` clause + 9 new tripwires on the initial GET step.
- `parity/fixtures/feature-probe-envelope.json` — `$comment` clause + new `icon-only-invalid` step.

## Deviations from plan

### Tone set narrowed to 4 (matches Plan 22-04's finding)

The plan expected 6 tones (`info/success/warning/danger/muted/brand`). The `IconNode.tone` closed union in `viewmodel-shell/src/index.ts` (declared in Plan 22-01) has only 4 members — matching every other node's tone axis in the framework. Emitted 4 tones. This is consistent with the Plan 22-04 CSS decision.

## Gate results

| Gate | Result |
|---|---|
| `bun run parity/run.ts` (17+ backends) | ✓ Parity tests passed — all backends agree on both fixtures |
| Parity log shows the byte-identical error message thrown on both backends for `icon-only-invalid` | ✓ `System.InvalidOperationException: icon-only ButtonNode requires tooltip (used as aria-label)` |
| `npx vitest run` (full TS framework) | ✓ 62 files / 981 passed / 1 skipped |
| `npm run check:demo-types` | ✓ 20 demo projects clean |
| `dotnet test viewmodel-shell-dotnet/Tests` | ✓ 215 passed |
| `dotnet test demo/Tasks/AspNetCore.Tests` | ✓ 28 passed |
| `dotnet test demo/ContactManager/AspNetCore.Tests` | ✓ 39 passed |
| `dotnet test demo/RetroBoard/AspNetCore.Tests` | ✓ 33 passed |
| `dotnet test demo/ExpenseTracker/AspNetCore.Tests` | ✓ 30 passed |
| `dotnet test demo/HelpDesk/AspNetCore.Tests` | ✓ 61 passed |

## Acceptance criteria — all met

- Both backends contain the new section with sparkles + shield-check + trash-2 + TrackerCell tooltip + valid icon-only Button + 5-host matrix ✓
- Both backends contain the `icon-only-invalid` action returning the invalid tree ✓
- `$comment` mentions `v7.0.0` AND `ICON-` AND `TrackerCell` AND `icon-only` ✓
- Initial GET expectBodyContains grew by 9 entries covering every branch ✓
- New POST step `icon-only-invalid` with expectBodyContains asserting the byte-identical message + `invalid_tree` code ✓
- Both fixture files are valid JSON ✓
- `bun run parity/run.ts` green ✓

## Coverage tripwire discipline (banked lesson)

The plan explicitly asked for per-branch `expectBodyContains` strings. Each string added is a substring only its branch emits — a fixture step whose branch stopped rendering would fail LOUDLY (`expected substring not found`) instead of vacuously passing byte-diff (`both backends emit nothing → agree`). Verified this operates: the parity harness prints "all backends agree" when both agree AND when both fail to emit the string; the `expectBodyContains` fails loudly on either backend when the substring is missing.

## Next dependency

Plan 22-08 (AA-contrast hand-check) — Ashley-gated, autonomous:false. This orchestration STOPS at 22-08 per the caller's directive.
