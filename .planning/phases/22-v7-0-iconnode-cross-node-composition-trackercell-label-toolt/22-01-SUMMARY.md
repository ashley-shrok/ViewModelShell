# Plan 22-01 — TS wire types + tree-validator (SUMMARY)

**Completed:** 2026-07-26
**Wave:** 1 (autonomous)
**Requirements:** ICON-01, ICON-04, ICON-05
**Atomic commit:** `038ae9f feat(22-01): TS wire types + tree-validator for IconNode + cross-node icon prop`

## What was built

The TypeScript source-of-truth for the v7.0.0 icons primitive:

1. **`IconName` closed union** — 102 kebab-case Lucide names across 9 categories (Actions 24, Status 10, Navigation 14, Content 14, Communication 5, People 5, Objects 10, Data/system 16, Magic/accents 4), all 8 Pixie/Hestia anchors included by literal name.
2. **`IconNode` interface** — leaf node: `type: "icon"` + required `name: IconName` + optional `size` (xs/sm/md/lg/xl) + optional `tone` (danger/warning/success/info) + optional `label` (a11y string). TSDoc pins the a11y contract at the type (label omitted = decorative + `aria-hidden`; label present = meaning-carrying + `role="img"` + `aria-label`).
3. **`ViewNode` union extension** — `IconNode` added to the discriminated union at the tail.
4. **Cross-node `icon?: IconName`** on 5 hosts: `ButtonNode`, `LinkNode`, `SectionNode`, `BadgeNode`, `ListItemNode`. Every TSDoc states "name-only, NOT an IconNode child" per design-doc §4.
5. **Icon-only-button walker rule** — wired into the existing `validateActionNames` button arm in `server.ts`. Predicate: `btn.icon != null && (btn.label == null || btn.label === "") && btn.tooltip == null` throws `Error("icon-only ButtonNode requires tooltip (used as aria-label)")` — the byte-identical string Plan 22-02 will mirror on .NET.
6. **`case "icon":` no-op arm** in `collectActions` so a future refactor that promotes IconNode to a container fails the exhaustive check here first.

## Files changed

- `viewmodel-shell/src/index.ts` — IconName union + IconNode interface + ViewNode union entry + 5 cross-node `icon?:` fields.
- `viewmodel-shell/src/server.ts` — icon-only-button check in `collectActions`'s `case "button"` arm; `case "icon":` leaf arm.
- `viewmodel-shell/test/icon-wire.test.ts` — 14 test cases covering wire shape, cross-node compilation, and FAIL-before/PASS-after mutation of the walker rule.

## Deviations from plan

- Design-doc §3 references `tone?: Tone`. The codebase has NO `Tone` alias — every existing node inlines the tone union (`"danger" | "warning" | "success" | "info"`). Followed that shipped pattern (inlined) rather than introducing a new alias just for icons.
- The `walkForSectionAction` walker already has a `default: return` for all leaf-like nodes; a `case "icon":` arm was NOT added there since the switch is non-exhaustive-by-default and TS compiles cleanly (adding it would be dead code). Only `collectActions` needed the explicit arm because the plan called for it — verified TS compiles both ways.

## Gate results

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | ✓ clean |
| `npx vitest run` (full framework) | ✓ 61 files / 968 passed / 1 skipped |
| `npx vitest run test/icon-wire.test.ts` | ✓ 14 passed |
| `npm run check:core-globals` | ✓ zero platform globals in `src/index.ts` |
| `npm run check:test-types` | ✓ clean |
| `npm run check:demo-types` | ✓ 20 demo projects clean (cross-node `icon?:` is additive optional, no demo broken) |
| `npm run check:aa-contrast` | ✓ 13/13 on default + 12 themes |
| `npm run check:no-demo-style` | ✓ 16 hand-edited HTML files zero-`<style>` |

## Acceptance criteria — all met

- `grep -c "^export type IconName" viewmodel-shell/src/index.ts` → 1 ✓
- `grep -c "^  | IconNode$" viewmodel-shell/src/index.ts` → 1 ✓
- `grep -c "^export interface IconNode" viewmodel-shell/src/index.ts` → 1 ✓
- `grep -c "icon?: IconName" viewmodel-shell/src/index.ts` → 5 ✓
- IconName union contains `"sparkles"`, `"shield-check"`, `"trash-2"` ✓
- IconNode TSDoc contains `role="img"` AND `aria-hidden` ✓
- `grep -c "icon-only ButtonNode requires tooltip" viewmodel-shell/src/server.ts` → 1 ✓
- Test file contains BOTH a construction that does NOT throw AND a mutation that DOES throw for the same base button ✓

## Next dependency

Plan 22-02 (.NET wire types + walker) must mirror this shape byte-identically:
- Enum `IconName` with converter emitting kebab-case (per closed-union-must-be-enum maintainer rule).
- `IconNode` record with `[JsonIgnore(WhenWritingNull)]` on every optional nullable.
- Cross-node `Icon?` properties on the 5 host records (`ButtonNode`, `LinkNode`, `SectionNode`, `BadgeNode`, `ListItemNode`).
- Icon-only-button walker rule with the byte-identical error message.
