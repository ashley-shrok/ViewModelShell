---
phase: 03-default-design-system
plan: 01
subsystem: ui
tags: [css, design-tokens, spacing-scale, type-scale, wcag-aa, page-shell, theme-seam]

# Dependency graph
requires:
  - phase: 02-upload-progress
    provides: "0.3.13 baseline (npm 0.3.14 / NuGet 0.3.10), green parity 7/7, shipped default.css (458 lines)"
provides:
  - "Additive :root token surface: 6 --vms-space-* (modular ~1.5), 7 --vms-text-* (all-rem, modular ~1.2), --vms-page-max"
  - "All rhythm spacing/font-size literals in default.css now reference scale var() tokens (THEME-02 coherence)"
  - "Centered, max-width (1080px), clamp()-padded .vms-page shell with zero media queries (THEME-01)"
  - "WCAG AA muted-text fix: --vms-text-muted #6b6b80 -> #9090a8 (D-17), only allowed palette change"
  - "THEME-05 additive half satisfied: every pre-existing :root name/semantic byte-identical; 11 theme files byte-unchanged"
affects: [03-02 (density remap depends on scale-as-variables D-10), 03-03 (card variant + AGENTS.md doc rows), 04-preset-grid, 05-canonical-examples]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scale-as-CSS-variables: rhythm/type expressed as named :root tokens, literals reference them (prerequisite for density remap D-10)"
    - "clamp()-based responsive padding, zero @media queries (framework ethos: no app-specified breakpoints)"
    - "Additive override-seam extension: new tokens append to :root; existing names/semantics frozen (THEME-05-safe)"

key-files:
  created:
    - ".planning/phases/03-default-design-system/03-01-SUMMARY.md"
  modified:
    - "viewmodel-shell/styles/default.css"

key-decisions:
  - "Spacing scale: 6 steps (2xs 0.25 / xs 0.5 / sm 0.75 / md 1 / lg 1.5 / xl 2.25 rem), base xs=0.5rem, modular ~1.5 (UI-SPEC, D-06/D-07)"
  - "Type scale: 7 steps, all-rem, base --vms-text-base 0.8125rem (13px), modular ~1.2 (UI-SPEC, D-06/D-09)"
  - "--vms-page-max 1080px; .vms-page padding-inline clamp(1rem, 5vw, 2.25rem); shell on .vms-page itself, no DOM/renderer change (D-11/D-12/D-13)"
  - ".vms-page stays transparent; body keeps --vms-bg byte-identical (D-14)"
  - "D-08 snapping ledger applied verbatim — pixel shifts (e.g. .vms-field gap -0.05rem, .vms-list gap +0.125rem) are intentional coherence, not regressions"
  - "line-height values deliberately unchanged — already match UI-SPEC role table (body 1.6 / controls 1.4); intended no-op, not a missed refactor"

patterns-established:
  - "Component-geometry exceptions kept literal: checkbox 18px hit target + tick geometry, progress 3px/99px pill, modal max-width breakpoints (400/520/800px, 95vw/95vh), 1px borders"
  - "Theme-override seam regression guard: styles/themes/*.css must require zero edits and stay byte-identical (THEME-05 sacred)"

requirements-completed: [THEME-01, THEME-02, THEME-05]

# Metrics
duration: 6min
completed: 2026-05-17
---

# Phase 3 Plan 01: Token Surface + Centered Page Shell Summary

**Refactored shipped default.css into a coherent additive :root token surface (6 spacing + 7 type + page-max), snapped every rhythm literal to scale var()s per the D-08 ledger, added a centered 1080px clamp-padded .vms-page shell, and applied the one D-17 WCAG-AA muted-text fix — override seam additive-only, parity 7/7 unchanged.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-17T22:34:32Z
- **Completed:** 2026-05-17T22:40:12Z
- **Tasks:** 3
- **Files modified:** 1 (default.css; +83 / -57 net since milestone baseline 2155086)

## Accomplishments
- Added a purely-additive token surface to `:root`: 6 `--vms-space-*` (modular ~1.5, base 0.5rem), 7 all-rem `--vms-text-*` (modular ~1.2, base 0.8125rem), and `--vms-page-max: 1080px` (THEME-02 foundation + the prerequisite for the Plan 02 density remap, D-10).
- Snapped every rhythm spacing/font-size literal across all node-type rules to its scale token per the UI-SPEC snapping ledger verbatim (D-08 pixel shifts accepted as intended coherence); component-geometry exceptions and `line-height` no-ops preserved exactly.
- Turned `.vms-page` into a centered, max-width (`var(--vms-page-max)`), `clamp(1rem, 5vw, 2.25rem)`-padded shell with **zero media queries** and no DOM/renderer change — `.vms-page` stays transparent, `body` byte-identical (THEME-01, D-11/D-12/D-13/D-14).
- Applied the single allowed default-value change: `--vms-text-muted` `#6b6b80` → `#9090a8` (WCAG AA fix, D-17); `#6b6b80` now appears nowhere in the file.
- THEME-05 (additive half) held: every pre-existing `:root` name/semantic byte-identical; the 11 `styles/themes/*.css` files byte-unchanged; build / core-globals / tests / parity all green.

## Task Commits

Each task was committed atomically (commit hooks ran, no `--no-verify`):

1. **Task 1: Add additive scale + page-max tokens, apply D-17 AA fix** - `012d9a3` (feat)
2. **Task 2: Snap literal spacing/font-size to scale tokens** - `6c8c8dd` (refactor)
3. **Task 3: Add centered max-width shell to .vms-page** - `43aaaec` (feat)

**Plan metadata:** see final docs commit.

## Files Created/Modified
- `viewmodel-shell/styles/default.css` - `:root` gains 6 spacing + 7 type + 1 page-max additive tokens and the D-17 muted-text value change; every rhythm spacing/font-size literal now references a scale `var()`; `.vms-page` gains the centered/max-width/clamp-padded shell.
- `.planning/phases/03-default-design-system/03-01-SUMMARY.md` - this summary.

## Decisions Made
None beyond plan — followed the UI-SPEC prescriptive token values and the snapping ledger exactly as specified. The Claude's-discretion items (step counts/names/ratios, `--vms-page-max` value, clamp bounds, AA-passing muted value) were all already resolved to concrete numbers in 03-UI-SPEC.md and inlined in the plan; no independent judgment was required.

## Deviations from Plan

None - plan executed exactly as written. All three task automated `<verify>` checks passed on first run; no Rule 1-4 deviations triggered (CSS-only token refactor, no missing-functionality/bug/blocking-code surface).

## Issues Encountered

**Stale-process locks blocking the parity gate (environment, not code).** The first two `bun run parity/run.ts` attempts failed during the .NET prebuild (`MSB3021/MSB3027`: DLL locked by leftover `ViewModelShell` PID 3240) and then on a locked `helpdesk-parity-bun.db` SQLite file. Root cause: ~14 stale `dotnet`/`bun`/`ViewModelShell` processes from a prior session dated **2026-05-15** still running and holding file locks — entirely unrelated to this CSS change (CSS has zero wire surface). Resolved by terminating only the pre-2026-05-16 stale processes and removing the orphaned locked parity DB file (Rule 3 blocking-issue cleanup of the verification environment, no code touched). The subsequent clean run: .NET build succeeded 0 errors/0 warnings and **parity passed — all backends agree, 7/7**, confirming the failures were stale locks, not a regression.

## Verification Results

- `npm run build` (viewmodel-shell) → exit 0
- `npm run check:core-globals` → PASS (AGNOSTIC-03: `src/index.ts` references zero platform globals)
- `npm test` (vitest) → 18/18 passed (3 files: adapter-seam, copy-button, upload-progress)
- Cross-backend parity (`bun run parity/run.ts`) → PASS, all backends agree, 7/7 (CSS has no wire surface — unaffected as required)
- Theme-seam regression guard → `styles/themes/*.css` byte-unchanged (zero edits since milestone baseline)
- Zero `@media` occurrences in default.css (all three tasks)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The scale-as-CSS-variables architecture (D-06) is in place — Plan 02's `.vms-page--compact` density remap (D-10) can now redeclare a small set of `--vms-space-*` tokens with zero per-rule churn.
- `.vms-section` is unchanged and ready for Plan 03's `.vms-section--card` grouped-surface variant; the `--vms-radius`/`--vms-surface`/`--vms-border` seam tokens it will reuse are byte-identical.
- AGENTS.md was intentionally NOT edited (Plan 03 owns the node/CSS-class doc-table rows for `density`/`variant`).
- No blockers. Override seam additive-only and parity green — Plans 02/03 inherit a clean, regression-guarded base.

## Self-Check: PASSED

- FOUND: `.planning/phases/03-default-design-system/03-01-SUMMARY.md`
- FOUND: `viewmodel-shell/styles/default.css`
- FOUND commit: `012d9a3` (Task 1)
- FOUND commit: `6c8c8dd` (Task 2)
- FOUND commit: `43aaaec` (Task 3)

---
*Phase: 03-default-design-system*
*Completed: 2026-05-17*
