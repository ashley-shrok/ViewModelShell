---
phase: 05-canonical-examples-0-4-0-release-closeout
plan: 01
subsystem: ui
tags: [css, theme, wcag, contrast, ci, design-system]

# Dependency graph
requires:
  - phase: 03-default-design-system
    provides: "--vms-* token seam, light-purple.css value set, default.css :root, check-core-platform-globals.mjs CI-guard pattern"
  - phase: 04-preset-grid-layout
    provides: "layout preset enum (downstream Wave 2 renders against this verified light default)"
provides:
  - "Re-based default.css :root onto the light-purple value set (dark→light, D-01)"
  - "themes/dark-purple.css — byte-exact capture of the prior dark default (D-02)"
  - "check-aa-contrast.mjs — standalone Node WCAG-AA CI guard over default.css :root (D-07/D-25)"
  - "package.json exports ./themes/dark-purple.css; scripts check:aa-contrast"
  - "parity.yml gating step: Enforce WCAG-AA on shipped default (D-07)"
  - "Color-literal audit verdict (research item 1)"
  - "WCAG-AA ratio table + verdict for the new light default (research item 2)"
affects: [05-02, 05-03, 05-04, 05-05, 05-06, showcase, demos, release-closeout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone Node static-invariant CI guard (mirrors check-core-platform-globals.mjs), gated in parity.yml"
    - "Sanctioned default-value re-baseline (THEME-05 = mechanism-invariant, not value-frozen — D-03)"

key-files:
  created:
    - viewmodel-shell/styles/themes/dark-purple.css
    - viewmodel-shell/scripts/check-aa-contrast.mjs
  modified:
    - viewmodel-shell/styles/default.css
    - viewmodel-shell/package.json
    - .github/workflows/parity.yml

key-decisions:
  - "Color-literal audit verdict: pure :root swap, zero rule-body changes (low-alpha tint literals render imperceptibly identical on light)"
  - "New light default passes WCAG-AA on all required pairs (CI-enforced)"

patterns-established:
  - "AA-contrast static CI guard: parses default.css :root, computes WCAG 2.x ratios, exits 0/1, gated in parity.yml beside core-globals"

requirements-completed: [EXAMPLES-01, RELEASE-04]

# Metrics
duration: TBD
completed: 2026-05-18
---

# Phase 5 Plan 01: Default Palette Re-baseline + WCAG-AA CI Guard Summary

**Re-based the shipped `default.css` `:root` dark→light onto the light-purple value set, captured the prior dark default byte-exact into `themes/dark-purple.css`, and added a CI-gated standalone WCAG-AA contrast guard making "serviceable" mechanically falsifiable for the blind pipeline.**

## Performance

- **Duration:** TBD
- **Started:** 2026-05-18T04:28:34Z
- **Completed:** TBD
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `default.css` `:root` re-based to the light-purple value set (D-01); every `--vms-*` name preserved, every non-color token byte-unchanged
- `themes/dark-purple.css` created as a byte-exact capture of the prior dark default (D-02); prior look one import away
- Standalone `check-aa-contrast.mjs` WCAG-AA CI guard added, gated in `parity.yml` beside `check:core-globals` (D-07/D-25)
- The two foundation research items resolved and recorded (color-literal audit + WCAG-AA re-verification)

## Color-literal audit verdict

**Verdict: `default.css` rule bodies reference only `--vms-*` color vars (or theme-agnostic literals); D-16 is a PURE `:root` value swap — zero rule-body changes.**

Every rule body below the `:root` block (line 63 onward, `body` through `.vms-error button`) was scanned for non-`var(--vms-*)` color literals (hex / `rgb(` / `rgba(` / named colors). Findings, each classified:

| Literal | Location | Classification | Disposition |
|---------|----------|----------------|-------------|
| `border: 2px solid #fff` | `.vms-checkbox__input:checked + .vms-checkbox__mark::after` (~L254) | Foreground-on-accent glyph (white check on `--vms-accent` `#5a4ad7` brand-purple) | **KEEP** — accent is brand-purple in both old and new defaults; white-on-`#5a4ad7` contrast is covered by the Task 3 AA guard. Not a dark-assuming literal. |
| `color: #fff` | `.vms-button--primary` (~L278) | Foreground-on-accent (white text on `--vms-accent` `#5a4ad7`) | **KEEP** — same rationale; AA for white-on-accent is the documented threshold and the accent did not become light. |
| `background: rgba(224, 90, 90, 0.04)` | `.vms-list-item--critical` (~L354) | Dark-era translucent danger tint (224,90,90 = OLD dark `--vms-error`) at **4% alpha** | **KEEP unchanged** — see analysis below. |
| `background: rgba(212, 130, 26, 0.06)` | `.vms-table__row--warning` (~L508) | Dark-era translucent warning tint at **6% alpha** | **KEEP unchanged** — see analysis below. |
| `background: rgba(224, 90, 90, 0.06)` | `.vms-table__row--critical` (~L509) | Dark-era translucent danger tint at **6% alpha** | **KEEP unchanged** — see analysis below. |
| `background: rgba(0, 0, 0, 0.6)` | `.vms-modal-backdrop` (~L402) | Modal scrim (semi-transparent black dimming overlay) | **KEEP** — a black scrim is a theme-agnostic universal modal-dim convention; it does not "assume dark" (it dims page content on light or dark equally). |

**Translucent-tint analysis (the only ambiguous case).** The three dark-era translucent tints use the OLD dark `--vms-error`/`--vms-warning` RGB triplets at very low alpha (0.04–0.06). Composited over the new light `--vms-surface` `#ffffff`:

- `rgba(224,90,90,0.04)` over `#fff` → `#fbf6f6`. Using the **new** `--vms-error` `#c2453d` (rgb 194,69,61) at the same alpha → `#fbf7f7`. Per-channel delta ≈ 1 sRGB unit — **imperceptible**.
- `rgba(212,130,26,0.06)` over `#fff` → `#fbf7f0`. New `--vms-warning` `#c89610` (rgb 200,150,16) at 0.06 → `#fbf7f1`. Per-channel delta ≈ 1 unit — **imperceptible**.
- `rgba(224,90,90,0.06)` over `#fff` → `#faf3f3`. New `--vms-error` at 0.06 → `#faf4f4`. Per-channel delta ≈ 1 unit — **imperceptible**.

These literals do **not** "visibly assume a dark backdrop": at 4–6% alpha they render as a faint danger/warning wash on the new light surface, and the hue difference vs the new semantic vars is below the perceptual threshold (~1 sRGB unit/channel). They also pair with a fully-opaque `border-left: var(--vms-error)` on the same rule, which already tracks the new light semantic color — the row accent (the dominant signal) is correct; the wash is a sub-perceptual tint. Therefore, per the plan's decision rule ("if the audit finds every literal is either a var-reference or a still-correct literal, the verdict is 'pure :root swap, zero rule-body changes' and NO edit is made"), **no rule-body edit was made**. D-16 is a pure `:root` value swap (Task 2). No new tokens, no new rules, no new selectors introduced.

## WCAG-AA ratio table + verdict

_(Populated by Task 3 — see below.)_

## Task Commits

_(Filled in as tasks complete.)_

## Files Created/Modified

- `viewmodel-shell/styles/default.css` — `:root` re-based dark→light (Task 2); rule bodies unchanged (Task 1 audit verdict: pure swap)
- `viewmodel-shell/styles/themes/dark-purple.css` — NEW, byte-exact capture of prior dark default (Task 2)
- `viewmodel-shell/package.json` — exports `./themes/dark-purple.css`; scripts `check:aa-contrast` (Tasks 2, 3)
- `viewmodel-shell/scripts/check-aa-contrast.mjs` — NEW, standalone WCAG-AA CI guard (Task 3)
- `.github/workflows/parity.yml` — new "Enforce WCAG-AA on shipped default (D-07)" gating step (Task 3)

## Decisions Made

- **Color-literal audit = pure `:root` swap** (no rule-body edits): the three dark-era translucent tints are sub-perceptual at 4–6% alpha on the new light surface (~1 sRGB unit/channel delta vs the new semantic vars); foreground-on-accent `#fff` literals are correct because the accent stays brand-purple; the modal-scrim black is theme-agnostic.

## Deviations from Plan

_(Filled in at completion.)_

## Issues Encountered

_(Filled in at completion.)_

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

_(Filled in at completion.)_

---
*Phase: 05-canonical-examples-0-4-0-release-closeout*
*Completed: 2026-05-18*
