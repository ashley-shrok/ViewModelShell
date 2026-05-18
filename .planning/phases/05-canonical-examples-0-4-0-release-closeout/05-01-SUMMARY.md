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
  - "D-01 ↔ D-07 conflict resolved (user-approved, D-17 precedent): one :root value tightened — --vms-warning #c89610 → #a37510 — so the shipped default clears WCAG-AA; all 17 other colors + color-scheme verbatim light-purple; light-purple.css byte-unchanged"
  - "New light default passes WCAG-AA on all 11 required pairs (CI-enforced via parity.yml)"

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

- **Duration:** ~15min (spanned a Rule-4 checkpoint pause for the D-01↔D-07 user decision)
- **Started:** 2026-05-18T04:28:34Z
- **Completed:** 2026-05-18T04:45:00Z
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

Research item 2: WCAG-AA re-verification of the new light default (the `light-purple.css` value set adopted by D-01, never AA-audited in Phase 3 which only verified the dark default). Measured by `viewmodel-shell/scripts/check-aa-contrast.mjs` (WCAG 2.x relative luminance, contrast `(L1+0.05)/(L2+0.05)`; thresholds: text pairs ≥ 4.5:1 SC 1.4.3, semantic-on-surface ≥ 3.0:1 SC 1.4.11). Script math cross-checked against the WCAG reference value `#767676` on `#fff` = 4.54:1 (matches the published reference).

**Final ratio table (post-resolution, `--vms-warning` tightened to `#a37510`):**

| Pair | Ratio | Threshold | Result |
|------|-------|-----------|--------|
| `--vms-text` on `--vms-bg` | 16.16:1 | 4.5:1 | PASS |
| `--vms-text` on `--vms-surface` | 17.29:1 | 4.5:1 | PASS |
| `--vms-text` on `--vms-surface-2` | 15.21:1 | 4.5:1 | PASS |
| `--vms-text-muted` on `--vms-bg` | 4.79:1 | 4.5:1 | PASS |
| `--vms-text-muted` on `--vms-surface` | 5.13:1 | 4.5:1 | PASS |
| `--vms-text-muted` on `--vms-surface-2` | 4.51:1 | 4.5:1 | PASS |
| `--vms-error` on `--vms-surface` | 4.99:1 | 3.0:1 | PASS |
| `--vms-success` on `--vms-surface` | 3.23:1 | 3.0:1 | PASS |
| **`--vms-warning` on `--vms-surface`** | **4.11:1** | **3.0:1** | **PASS** |
| `--vms-info` on `--vms-surface` | 4.42:1 | 3.0:1 | PASS |
| `--vms-priority-high` on `--vms-surface` | 3.67:1 | 3.0:1 | PASS |

**Verdict: the new light default passes WCAG-AA on all 11 required pairs (`npm run check:aa-contrast` → exit 0).** This required resolving a conflict between two locked decisions; see "## D-01 ↔ D-07 conflict resolution (one-variable `--vms-warning` AA tighten, D-17 precedent)" below.

## D-01 ↔ D-07 conflict resolution (one-variable `--vms-warning` AA tighten, D-17 precedent)

**The conflict.** Task 3's WCAG-AA re-verification surfaced a direct collision between two *locked* decisions:

- **D-01** — the shipped `default.css` `:root` must adopt the `light-purple.css` value set **verbatim**.
- **D-07** — the shipped default must meet the WCAG-AA "serviceable" floor, **CI-enforced**.

The verbatim light-purple `--vms-warning` `#c89610` fails the 3.0:1 AA non-text floor (SC 1.4.11) on all three light surfaces: **2.68:1** on `--vms-surface` `#ffffff`, **2.51:1** on `--vms-bg` `#f7f7f9`, **2.36:1** on `--vms-surface-2` `#f0f0f4`. Honoring D-01 verbatim would ship a default that fails D-07's CI gate; honoring D-07 requires deviating one value from the D-01 set. This was escalated as a Rule-4 locked-decision conflict (a fresh executor cannot resolve a contradiction between two locked decisions without a user call).

**The resolution (user-approved, Option 1 — the D-17 precedent).** In `viewmodel-shell/styles/default.css` `:root` **only**, exactly **one** value was tightened: `--vms-warning` `#c89610` → **`#a37510`** (a marginally darker amber/gold — same hue family, minimum darkening that clears the AA floor with a small safety margin). Every other `:root` value remains the light-purple set **verbatim** (17 colors + `--vms-color-scheme: light` byte-identical to `themes/light-purple.css`; verified mechanically). This is precisely the **Phase 3 D-17 precedent**: *the variable still exists, themes still override it; only the shipped default value tightens to pass AA.* D-03 ("THEME-05 is mechanism-invariant, not value-frozen") and D-07 pre-authorize exactly this one-variable shipped-default tightening — it is **not** a seam behavior change.

**Before / after (`--vms-warning`, AA non-text floor 3.0:1, SC 1.4.11):**

| Surface | Before `#c89610` | After `#a37510` | Floor |
|---------|------------------|-----------------|-------|
| `--vms-surface` `#ffffff` | 2.68:1 FAIL | **4.11:1 PASS** | 3.0:1 |
| `--vms-bg` `#f7f7f9` | 2.51:1 FAIL | **3.84:1 PASS** | 3.0:1 |
| `--vms-surface-2` `#f0f0f4` | 2.36:1 FAIL | **3.62:1 PASS** | 3.0:1 |

Worst surface = 3.62:1 (`--vms-surface-2`), comfortably above the 3.0:1 floor with the targeted ≈3.6:1+ headroom. The committed `check-aa-contrast.mjs` was the oracle: candidate values were iterated against it until `npm run check:aa-contrast` reported **11/11 PASS** (exit 0). `#a37510` is the minimum-darkening value satisfying both the hard 3.0:1 AA floor on all three surfaces and the user's ≈3.6:1+ worst-surface safety margin, staying as close to the original dark-amber/gold hue as the AA floor allows.

**Scope of the deviation (audited mechanically):**

- `git diff` of `default.css` vs the Task-2 commit = **exactly one changed line** (`--vms-warning`). No other `:root` value, no rule body, no non-color token touched.
- `themes/light-purple.css` is **byte-unchanged** (D-02/D-03 — editing it would be a THEME-05 seam behavior change). The 11 pre-existing theme files + the Task-2 `themes/dark-purple.css` are all **byte-identical** (`git status` on `styles/themes/` empty).
- No new `--vms-*` variable, no renamed variable, no new CSS rule, no new wire/model field.

**Net:** `light-purple.css` byte-unchanged; only `default.css` `:root` `--vms-warning` tightened (`#c89610` → `#a37510`), D-17 precedent. The shipped default is now WCAG-AA serviceable and CI-gated.

**Forward-note for Plan 05-05 (MIGRATION/CHANGELOG, D-05/D-26):** **Plan 05-05 (MIGRATION/CHANGELOG, D-05/D-26) MUST document this one-variable `--vms-warning` AA tightening alongside the dark→light default flip as part of the honest-framing migration copy.** The 0.4.0 migration story is not only "the shipped default flipped dark→light (prior look one import away via `themes/dark-purple.css`)" — it also includes that the new light default's `--vms-warning` shipped value is `#a37510` (a slightly darker amber than `light-purple.css`'s `#c89610`) so the shipped default meets the WCAG-AA non-text floor. Consumers importing `themes/light-purple.css` explicitly still get `#c89610` (that theme file is byte-unchanged); only the *unthemed shipped default* carries the tightened amber. Same honest-framing style as the 0.3.13 silent-behavior caveats (D-05).

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Color-literal audit verdict (pure :root swap) | `32baaae` |
| 2 | default.css :root re-base dark→light + dark-purple.css + package.json export (D-01/D-02/D-03) | `de2f497` |
| 3 (partial) | check-aa-contrast.mjs WCAG-AA CI guard + package.json script entry | `c79a843` |
| 3 (resolution) | `--vms-warning` AA tighten `#c89610`→`#a37510` (D-01↔D-07 resolved, D-17 precedent) | `6f601e4` |
| 3 (gating) | parity.yml AA gating step + SUMMARY/STATE finalize | _(final docs commit)_ |

## Files Created/Modified

- `viewmodel-shell/styles/default.css` — `:root` re-based dark→light (Task 2); rule bodies unchanged (Task 1 audit verdict: pure swap)
- `viewmodel-shell/styles/themes/dark-purple.css` — NEW, byte-exact capture of prior dark default (Task 2)
- `viewmodel-shell/package.json` — exports `./themes/dark-purple.css`; scripts `check:aa-contrast` (Tasks 2, 3)
- `viewmodel-shell/scripts/check-aa-contrast.mjs` — NEW, standalone WCAG-AA CI guard (Task 3)
- `.github/workflows/parity.yml` — new "Enforce WCAG-AA on shipped default (D-07)" gating step (Task 3)

## Decisions Made

- **Color-literal audit = pure `:root` swap** (no rule-body edits): the three dark-era translucent tints are sub-perceptual at 4–6% alpha on the new light surface (~1 sRGB unit/channel delta vs the new semantic vars); foreground-on-accent `#fff` literals are correct because the accent stays brand-purple; the modal-scrim black is theme-agnostic.

## Deviations from Plan

### Rule 4 — locked-decision conflict (escalated, user-resolved)

**1. [Rule 4 - Architectural/Locked-decision] D-01 (verbatim light-purple :root) ↔ D-07 (WCAG-AA CI floor) conflict on `--vms-warning`**
- **Found during:** Task 3 (WCAG-AA re-verification — research item 2)
- **Issue:** The verbatim light-purple `--vms-warning` `#c89610` fails the 3.0:1 AA non-text floor on all three light surfaces (2.68/2.51/2.36:1). D-01 (verbatim) and D-07 (AA, CI-enforced) cannot both hold.
- **Resolution:** Escalated as a Rule-4 checkpoint (a contradiction between two locked decisions requires a user call). User approved Option 1 (the D-17 precedent): tighten exactly one `:root` value — `--vms-warning` `#c89610` → `#a37510` — in `default.css` only. All 17 other colors + `--vms-color-scheme` stay verbatim light-purple; `light-purple.css` byte-unchanged. See "## D-01 ↔ D-07 conflict resolution" above for the full before/after table and rationale.
- **Files modified:** `viewmodel-shell/styles/default.css` (one line: `--vms-warning`)
- **Commit:** see Task Commits table — "Task 3 (resolution)" row.

No Rule 1–3 auto-fixes were applied (no bugs, missing critical functionality, or blocking issues encountered — the only deviation was the escalated locked-decision conflict above).

## Issues Encountered

The D-01↔D-07 locked-decision conflict (above) was the sole issue. It was correctly escalated rather than silently resolved (the plan's Task 3 explicitly instructs: "a failing default is a phase blocker, NOT a silent pass; do not adjust :root values to force a pass without escalating, since :root values are locked to the light-purple set by D-01"). Resolved by user decision; the one-variable tighten is the sanctioned D-17 precedent (D-03/D-07 pre-authorize it). No CI steps were weakened; the AA guard was gated in parity.yml only after it passed 11/11.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave-2 / downstream plans can now render against a correct, AA-verified light default:

- **05-02..05-06 (Showcase, demos, AGENTS.md):** the shipped `default.css` `:root` is the final light value set; render against it directly. The shipped `--vms-warning` is `#a37510` (not `#c89610`) — Showcase/demo screenshots and the D-12 reviewer sign-off should expect the slightly darker amber on the unthemed default.
- **05-05 (MIGRATION/CHANGELOG, D-05/D-26):** MUST document the one-variable `--vms-warning` AA tighten alongside the dark→light flip — see the explicit forward-note in "## D-01 ↔ D-07 conflict resolution" above. This is a required input to the honest-framing migration copy, not optional.
- **05-06 (release closeout / RELEASE-04):** `parity.yml` now has the `Enforce WCAG-AA on shipped default (D-07)` gating step beside `check:core-globals`; the AA guard is a permanent CI invariant. Parity wire suite unaffected (CSS has no parity surface — D-24).
- `themes/dark-purple.css` (byte-exact prior dark default) + all 11 prior theme files remain byte-identical; the override seam is intact (every `--vms-*` name present).

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources. This plan changes a single CSS value, adds a static Node math script, and adds a CI step; nothing stubbed or deferred within the plan's goal.

## Self-Check: PASSED

- Files verified present: `viewmodel-shell/styles/default.css`, `viewmodel-shell/styles/themes/dark-purple.css`, `viewmodel-shell/scripts/check-aa-contrast.mjs`, `.github/workflows/parity.yml`, `.planning/phases/05-canonical-examples-0-4-0-release-closeout/05-01-SUMMARY.md` — all FOUND.
- Commits verified present: `32baaae`, `de2f497`, `c79a843`, `6f601e4` — all FOUND in `git log`.
- `npm run check:aa-contrast` re-run at close: exit 0, all 11 pairs PASS.
- `git diff` of `default.css` vs Task-2 commit = exactly one changed line (`--vms-warning`); `git status` on `styles/themes/` empty (11 prior theme files + dark-purple.css byte-unchanged); `parity.yml` diff = purely additive AA step (no existing step removed/weakened).

---
*Phase: 05-canonical-examples-0-4-0-release-closeout*
*Completed: 2026-05-18*
