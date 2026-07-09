---
phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n
plan: 02
subsystem: ui
tags: [css, theming, chart.js, accessibility, wcag]

# Dependency graph
requires:
  - phase: 18-01
    provides: "Reshaped ChartNode/ChartSeries wire type (both backends) that 18-03's browser adapter will read series/tone from"
provides:
  - "--vms-chart-1..8 categorical palette tokens in styles/default.css :root"
  - "--vms-chart-1..8 re-tuned per theme family in all 12 styles/themes/*.css files"
  - "Hand-verified per-theme contrast/distinguishability table (non-CI-gated acceptance evidence)"
affects: [18-03-browser-adapter-chartjs-widening, 19-verification-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two hand-tuned hue families (light/dark) reused across all themes sharing the same bg/surface pair, rather than 12 bespoke palettes — since every light theme shares identical --vms-bg/--vms-surface (and likewise every dark theme), contrast/distinguishability is a property of the family, not the individual accent hue"
    - "Deliberate, recorded re-baseline of a pinned SHA-256 guard (check-theme-byte-identity.mjs) when a locked framework change legitimately requires editing frozen theme files — the guard's own comments document this exact precedent (D-26)"

key-files:
  created: []
  modified:
    - viewmodel-shell/styles/default.css
    - viewmodel-shell/styles/themes/dark-amber.css
    - viewmodel-shell/styles/themes/dark-blue.css
    - viewmodel-shell/styles/themes/dark-green.css
    - viewmodel-shell/styles/themes/dark-purple.css
    - viewmodel-shell/styles/themes/dark-rose.css
    - viewmodel-shell/styles/themes/dark-teal.css
    - viewmodel-shell/styles/themes/light-amber.css
    - viewmodel-shell/styles/themes/light-blue.css
    - viewmodel-shell/styles/themes/light-green.css
    - viewmodel-shell/styles/themes/light-purple.css
    - viewmodel-shell/styles/themes/light-rose.css
    - viewmodel-shell/styles/themes/light-teal.css
    - viewmodel-shell/scripts/check-theme-byte-identity.mjs

key-decisions:
  - "Two palettes (light-family, dark-family), not 12 bespoke ones — default.css + all 6 light themes share identical --vms-bg/--vms-surface, and all 6 dark themes (incl. dark-purple.css) share identical --vms-bg/--vms-surface, so contrast/distinguishability math is identical within each family regardless of the theme's own accent hue"
  - "check-theme-byte-identity.mjs re-baselined (11 SHA-256 hashes updated; dark-purple.css exact-match widened to explicitly allow exactly the 8 chart tokens) — required because the plan mandates editing all 12 frozen theme files, and the guard's own comments document 're-baseline deliberately + recorded' as the sanctioned response, not silent drift"

patterns-established:
  - "Chart-palette hand-check pattern: a throwaway node script (not committed) reusing check-aa-contrast.mjs's hex/luminance/contrast helpers, run against the real cascade (theme merged over default), with results recorded in the plan SUMMARY rather than added to the permanent CI gate — matches the locked 18-CONTEXT.md decision that check:aa-contrast intentionally covers a fixed pair-set"

requirements-completed: [CHARTBASE-02]

# Metrics
duration: 15min
completed: 2026-07-09
---

# Phase 18 Plan 02: Chart Palette Tokens Summary

**8-slot categorical `--vms-chart-1..8` palette added to `default.css` and all 12 theme files (two hand-tuned hue families — light and dark — each clearing the ≥3:1 non-text WCAG floor against both plot backgrounds and mutually distinguishable), with a required re-baseline of the pinned theme-byte-identity CI guard.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-09T09:13:51Z
- **Tasks:** 2 (Task 2 produced no code changes — see below)
- **Files modified:** 14 (13 CSS + 1 script)

## Accomplishments
- Added `--vms-chart-1` … `--vms-chart-8` as raw hex tokens to `styles/default.css` `:root` and all 12 `styles/themes/*.css` files — zero raw color crosses the wire, exactly like every other themed surface.
- Hand-verified (throwaway script, not committed) that every slot clears the ~3:1 non-text contrast floor against both plot backgrounds (`--vms-surface`, `--vms-bg`) in the default and every theme, and that all 8 slots are mutually distinguishable per theme (no near-identical hue pairs) — see the table below.
- Kept `check:aa-contrast` untouched and green (its fixed pair-set is unaffected by the new tokens, as locked in 18-CONTEXT.md).

## Task Commits

1. **Task 1: Add `--vms-chart-1..8` to default.css and all 12 theme files** - `5872df7` (feat) — also includes the necessary `check-theme-byte-identity.mjs` re-baseline (see Deviations)
2. **Task 2: Hand-check palette contrast/distinguishability vs the plot background** - no commit (verification-only; every slot passed on the first design pass, so no re-tuning of Task 1's files was needed — see Issues Encountered)

**Plan metadata:** (this commit, following SUMMARY.md)

_Note: Task 2's acceptance criteria (a recorded per-theme contrast table) is satisfied by this SUMMARY; because no palette value needed adjustment, there is no separate Task 2 code commit._

## Files Created/Modified
- `viewmodel-shell/styles/default.css` - added the 8-slot light-family chart palette to `:root`
- `viewmodel-shell/styles/themes/light-{amber,blue,green,purple,rose,teal}.css` (6 files) - added the same light-family palette (identical values — these themes share `--vms-bg`/`--vms-surface` with default.css)
- `viewmodel-shell/styles/themes/dark-{amber,blue,green,purple,rose,teal}.css` (6 files) - added a lighter/more-saturated dark-family palette (identical values across all 6 — these themes share `--vms-bg`/`--vms-surface`)
- `viewmodel-shell/scripts/check-theme-byte-identity.mjs` - re-baselined 11 SHA-256 hashes to the post-palette files; widened the `dark-purple.css` exact-declaration check to explicitly allow the 8 new `--vms-chart-N` tokens

## Decisions Made

- **Two hue families instead of 12 bespoke per-theme palettes.** `default.css` and all 6 `light-*` themes carry byte-identical `--vms-bg: #f7f7f9` / `--vms-surface: #ffffff` (only each theme's `--vms-accent` differs); all 6 `dark-*` themes (including `dark-purple.css`) carry byte-identical `--vms-bg: #0f0f11` / `--vms-surface: #18181c`. Since the plan's legibility/distinguishability acceptance criteria are purely a function of the plot background (not the theme's own accent hue), one light-family palette and one dark-family palette satisfy every theme's requirement identically — 12 bespoke palettes would add risk (harder to keep mutually consistent, more surface for a stray low-contrast slot) with no acceptance-criteria benefit. The plan's "keep each theme's family character" language is satisfied at the light/dark family level, which is the level the surface/bg split actually operates at.
- **`check-theme-byte-identity.mjs` re-baseline (Rule 3 — blocking pre-existing gate).** This guard SHA-256-pins 11 of the 12 theme files and separately byte-exact-captures `dark-purple.css`'s `:root` against the historical pre-0.4.0 dark default with **zero extra declarations allowed**. The plan requires editing all 12 theme files, which unavoidably changes those bytes — so without a fix, `npm run check:theme-byte-identity` (CI-gated in `parity.yml`) would fail on this plan's own required change. The guard's own header comments document exactly this situation as sanctioned ("intentional changes are re-baselined deliberately + recorded (D-26 precedent), not silently") — the same pattern used for the prior `#8` warning-AA re-baseline. Applied the same pattern: recomputed and updated the 11 SHA-256 hashes, and widened the `dark-purple.css` check with a narrow regex (`/^--vms-chart-[1-8]$/`) that allows *only* the 8 chart tokens as an addition, so any other unexpected declaration still fails the guard. `check:theme-function` needed no change (it only inspects effective scheme/bg, unaffected by adding unrelated tokens).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-baselined `check-theme-byte-identity.mjs`**
- **Found during:** Task 1 (adding tokens to all 12 theme files)
- **Issue:** `npm run check:theme-byte-identity` (CI-gated) SHA-256-pins 11 theme files and byte-exact-captures `dark-purple.css`'s `:root` against the historical dark-default color block with no extra declarations permitted. Adding the plan-mandated `--vms-chart-1..8` tokens to all 12 files necessarily changed those bytes, so the guard failed with 19 violations (11 hash mismatches + 8 "unexpected extra declaration" errors on `dark-purple.css`) immediately after Task 1's edits.
- **Fix:** Recomputed the SHA-256 for the 11 affected files and updated `THEME_SHA256` in `scripts/check-theme-byte-identity.mjs`; widened the `dark-purple.css` exact-match loop to explicitly allow (not flag) declarations matching `/^--vms-chart-[1-8]$/`, documented inline as the CHARTBASE-02 addition. This is the guard's own documented precedent for a deliberate, recorded re-baseline (same class as the prior `#8` warning-AA change) — not a silent workaround.
- **Files modified:** `viewmodel-shell/scripts/check-theme-byte-identity.mjs`
- **Verification:** `npm run check:theme-byte-identity` and `npm run check:theme-function` both pass; `npm run check:aa-contrast` (untouched file) still passes; `git diff --stat -- viewmodel-shell/scripts/check-aa-contrast.mjs` confirms that file is unchanged, per the plan's explicit instruction.
- **Committed in:** `5872df7` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking pre-existing gate)
**Impact on plan:** Necessary to keep the framework's own CI-gated invariants green while completing exactly what the plan asked for (tokens in all 12 theme files). No scope creep — the fix is scoped to the minimum needed (re-baseline + a narrow allow-list for the 8 new tokens specifically), and the guard's original purpose (catching *accidental* theme drift, and preserving `dark-purple.css` as a byte-exact historical restore path for its original 18 declarations) is fully intact.

## Issues Encountered

- **Palette design required no re-tuning.** Both hand-designed hue families (light: `#3366cc #cc6b1c #1f8a5f #b3314d #7a4fc9 #1f8fa3 #767a1f #c23fa0`; dark: `#6fa8ff #ffa552 #5ed19a #ff7a90 #b79bfa #5cd6e8 #d0d661 #ef8fd6`) cleared the ~3:1 non-text floor and the mutual-distinguishability check on the first pass (verified via a throwaway measurement script reusing `check-aa-contrast.mjs`'s hex/luminance/contrast helpers), so Task 2 required no adjustment to Task 1's committed values — it is purely a verification/recording task, satisfied by the table below.
- **Cross-plan build state (informational, not a deviation of this plan):** `npm run build` currently fails with 6 TS errors in `viewmodel-shell/src/browser.ts` (`Property 'tone'/'points' does not exist on type 'ChartNode'`). This is caused by plan **18-01** (already landed on `main` as commits `d732f3b`/`9bbe01f`/`a42154c`), which reshaped the `ChartNode` wire type ahead of `browser.ts` being updated to match — that update is explicitly plan **18-03**'s scope (wave 2, `depends_on: [18-01]`), not this plan's. This plan's own files (`styles/*.css`, the one script) are unaffected by and unrelated to that break; `18-02`'s own verification (`check:aa-contrast`, `check:theme-byte-identity`, `check:theme-function`, `check:no-demo-style`, `check:core-globals`) all pass. Documented here only so a later reader isn't surprised that `npm run build` is red mid-wave — it is expected to clear once 18-03 lands.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `--vms-chart-1..8` is now a stable, theme-token-driven color contract that 18-03's browser adapter can read via `getComputedStyle().getPropertyValue('--vms-chart-N')` and cycle per series (per slice for pie/donut).
- The permanent `check:aa-contrast` gate, `check:theme-byte-identity`, and `check:theme-function` all remain green — no lingering CI risk for this plan's changes.
- No blockers for 18-03. The only open item (the `browser.ts` type errors) is 18-03's own explicit scope, already anticipated by the phase's wave dependency ordering.

---
*Phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n*
*Completed: 2026-07-09*

## Contrast/Distinguishability Table (hand-check evidence, Task 2)

All ratios computed with the same WCAG relative-luminance / contrast-ratio formulas as `check-aa-contrast.mjs`, using a throwaway node script (not committed) that parses the real cascade (each theme's `:root` merged over `default.css`'s `:root`, theme wins — the exact cascade a consumer gets). Floor: **≥ 3.0:1** (WCAG SC 1.4.11 non-text/graphical-object).

Because every light theme shares `--vms-bg:#f7f7f9` / `--vms-surface:#ffffff` with `default.css`, and every dark theme (incl. `dark-purple.css`) shares `--vms-bg:#0f0f11` / `--vms-surface:#18181c`, the ratios are identical across all members of a family — shown once per family below, with the full 13-target enumeration underneath for completeness.

### Light family (`default`, `light-amber`, `light-blue`, `light-green`, `light-purple`, `light-rose`, `light-teal`)

| Slot | Hex | vs `--vms-surface` (#ffffff) | vs `--vms-bg` (#f7f7f9) |
|---|---|---|---|
| chart-1 | `#3366cc` | 5.37:1 | 5.02:1 |
| chart-2 | `#cc6b1c` | 3.69:1 | 3.45:1 |
| chart-3 | `#1f8a5f` | 4.32:1 | 4.04:1 |
| chart-4 | `#b3314d` | 6.06:1 | 5.67:1 |
| chart-5 | `#7a4fc9` | 5.54:1 | 5.18:1 |
| chart-6 | `#1f8fa3` | 3.81:1 | 3.56:1 |
| chart-7 | `#767a1f` | 4.59:1 | 4.29:1 |
| chart-8 | `#c23fa0` | 4.65:1 | 4.35:1 |

All 8 clear the 3.0:1 floor against both plot backgrounds; lowest is chart-2 at 3.45:1 vs `--vms-bg`. No two slots are mutually indistinguishable (pairwise hue-delta / contrast check found zero warnings).

### Dark family (`dark-purple`, `dark-amber`, `dark-blue`, `dark-green`, `dark-rose`, `dark-teal`)

| Slot | Hex | vs `--vms-surface` (#18181c) | vs `--vms-bg` (#0f0f11) |
|---|---|---|---|
| chart-1 | `#6fa8ff` | 7.35:1 | 7.95:1 |
| chart-2 | `#ffa552` | 9.07:1 | 9.81:1 |
| chart-3 | `#5ed19a` | 9.33:1 | 10.09:1 |
| chart-4 | `#ff7a90` | 7.11:1 | 7.69:1 |
| chart-5 | `#b79bfa` | 7.66:1 | 8.28:1 |
| chart-6 | `#5cd6e8` | 10.32:1 | 11.16:1 |
| chart-7 | `#d0d661` | 11.36:1 | 12.28:1 |
| chart-8 | `#ef8fd6` | 8.07:1 | 8.73:1 |

All 8 clear the 3.0:1 floor with wide margin (lowest is chart-4 at 7.11:1); mutual-distinguishability check found zero warnings.

### Full 13-target enumeration (per-theme, as required by the acceptance criteria)

| Theme | chart-1 vs surface/bg | chart-2 | chart-3 | chart-4 | chart-5 | chart-6 | chart-7 | chart-8 |
|---|---|---|---|---|---|---|---|---|
| default | 5.37/5.02 | 3.69/3.45 | 4.32/4.04 | 6.06/5.67 | 5.54/5.18 | 3.81/3.56 | 4.59/4.29 | 4.65/4.35 |
| light-amber | 5.37/5.02 | 3.69/3.45 | 4.32/4.04 | 6.06/5.67 | 5.54/5.18 | 3.81/3.56 | 4.59/4.29 | 4.65/4.35 |
| light-blue | 5.37/5.02 | 3.69/3.45 | 4.32/4.04 | 6.06/5.67 | 5.54/5.18 | 3.81/3.56 | 4.59/4.29 | 4.65/4.35 |
| light-green | 5.37/5.02 | 3.69/3.45 | 4.32/4.04 | 6.06/5.67 | 5.54/5.18 | 3.81/3.56 | 4.59/4.29 | 4.65/4.35 |
| light-purple | 5.37/5.02 | 3.69/3.45 | 4.32/4.04 | 6.06/5.67 | 5.54/5.18 | 3.81/3.56 | 4.59/4.29 | 4.65/4.35 |
| light-rose | 5.37/5.02 | 3.69/3.45 | 4.32/4.04 | 6.06/5.67 | 5.54/5.18 | 3.81/3.56 | 4.59/4.29 | 4.65/4.35 |
| light-teal | 5.37/5.02 | 3.69/3.45 | 4.32/4.04 | 6.06/5.67 | 5.54/5.18 | 3.81/3.56 | 4.59/4.29 | 4.65/4.35 |
| dark-purple | 7.35/7.95 | 9.07/9.81 | 9.33/10.09 | 7.11/7.69 | 7.66/8.28 | 10.32/11.16 | 11.36/12.28 | 8.07/8.73 |
| dark-amber | 7.35/7.95 | 9.07/9.81 | 9.33/10.09 | 7.11/7.69 | 7.66/8.28 | 10.32/11.16 | 11.36/12.28 | 8.07/8.73 |
| dark-blue | 7.35/7.95 | 9.07/9.81 | 9.33/10.09 | 7.11/7.69 | 7.66/8.28 | 10.32/11.16 | 11.36/12.28 | 8.07/8.73 |
| dark-green | 7.35/7.95 | 9.07/9.81 | 9.33/10.09 | 7.11/7.69 | 7.66/8.28 | 10.32/11.16 | 11.36/12.28 | 8.07/8.73 |
| dark-rose | 7.35/7.95 | 9.07/9.81 | 9.33/10.09 | 7.11/7.69 | 7.66/8.28 | 10.32/11.16 | 11.36/12.28 | 8.07/8.73 |
| dark-teal | 7.35/7.95 | 9.07/9.81 | 9.33/10.09 | 7.11/7.69 | 7.66/8.28 | 10.32/11.16 | 11.36/12.28 | 8.07/8.73 |

**No exceptions needed** — every slot in every theme clears the ≥3:1 non-text floor against both plot backgrounds, and no theme has two mutually-indistinguishable slots.

## Self-Check: PASSED

All 14 modified files confirmed present on disk; the Task 1 commit hash `5872df7` confirmed present in `git log`. No missing items.
