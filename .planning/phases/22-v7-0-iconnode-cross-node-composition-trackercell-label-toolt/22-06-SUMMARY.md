# Plan 22-06 — TUI drop icons (SUMMARY)

**Completed:** 2026-07-26
**Wave:** 2 (autonomous)
**Requirements:** ICON-07
**Atomic commit:** `d313782 feat(22-06): TUI drops icons per design-doc §9 — @experimental degradation`

## What was built

Added an explicit `case "icon": return null;` arm to the TUI renderer's node dispatch switch in `viewmodel-shell/src/tui.tsx`. Icons render as nothing in the TUI, matching design-doc §9 and the standing directive that the TUI is `@experimental` and explicitly not-invested-in.

## Rationale — why explicit, not fall-through

The TUI dispatch has a `default:` arm that renders `<UnsupportedView type={...}>` (red text `[unknown node type: icon]`). Falling through would be wrong-facts: the TUI has NOT failed to recognize the type; it has DECIDED to drop it. The explicit arm expresses the decision at the code, is grep-discoverable (`grep case '"icon"'` finds it), and cannot regress to the noisy default if a future refactor rearranges the switch.

The comment at the arm names design-doc §9 explicitly so a future reviewer sees the intent.

## Verification of host renderers

Design-doc §9 also says the 5 host renderers (button/link/section/badge/list-item) should IGNORE the new `icon?:` prop. Verified via `grep -c "n\.icon\|node\.icon" viewmodel-shell/src/tui.tsx` → 0. The TUI host renderers read only `label`/`children`/similar fields; the new `icon?:` prop is silently ignored by omission, exactly as required.

## Files changed

- `viewmodel-shell/src/tui.tsx` — one `case "icon": return null;` arm added before the `default:` in `renderNode()`.

## Gate results

| Gate | Result |
|---|---|
| `npx vitest run` (full framework) | ✓ 62 files / 981 passed / 1 skipped |
| `npm run check:core-globals` | ✓ index.ts platform-global-free |
| `npm run check:test-types` | ✓ clean |
| `npm run check:demo-types` | ✓ 20 demo projects clean |

## Acceptance criteria — all met

- `grep -c "case \"icon\":" viewmodel-shell/src/tui.tsx` → 1 ✓
- The case arm returns `null` (explicit no-op) ✓
- File contains `§9` in a comment near the arm (discoverability signal) ✓
- `grep -c "n\.icon\|node\.icon" viewmodel-shell/src/tui.tsx` → 0 (no host renderer reads the icon field in the TUI) ✓
- `npx tsc --noEmit` clean ✓
- `npx vitest run` clean ✓

## Next dependency

Plan 22-07 (Parity FeatureProbe + expectBodyContains tripwires) — extends the FeatureProbe backends' `buildVm` on both TS + .NET to exercise every icon surface, plus adds per-branch coverage tripwires to `parity/fixtures/feature-probe.json` so a diff-passing fixture can't silently go vacuous.
