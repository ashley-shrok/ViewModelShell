---
phase: 20-v5-1-navigation-primitives-breadcrumbnode-stepsnode-pointer-
plan: 03
subsystem: ui
tags: [breadcrumb, steps, stepper, browser-adapter, css, a11y, container-query, wcag, viewmodel-shell]

# Dependency graph
requires:
  - phase: 20-01
    provides: BreadcrumbNode + StepsNode TS wire types + tree-validator arms
provides:
  - browser.ts breadcrumb() renderer — nav landmark + ol + auto-current last item + href/action crumbs
  - browser.ts steps() renderer — derived done/current/upcoming state, aria-current=step, marker aria-labels, non-focusable, no progressbar
  - default.css breadcrumb + steps styling via --vms-* tokens only (theme files untouched)
  - intrinsic horizontal→vertical steps collapse via @container (zero viewport @media)
  - jsdom adapter coverage for both nodes' a11y + class emission + dispatch + orientation
affects: [20-04, 20-05, 20-06, tui-renderer, showcase-demo, feature-probe-parity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Container-query intrinsic collapse: .vms-steps establishes container-type:inline-size; descendants (.vms-steps__step/body/connector) reflow via @container (max-width) — the P1-sanctioned escape hatch, zero viewport @media"
    - "Polarity-adaptive knockout glyph: marker text color = var(--vms-surface) auto-tracks theme polarity so an accent-filled marker's glyph is legible on every theme without per-theme selectors"
    - "OUTGOING connector model: one connector element per step, hidden on :last-child, colored by the step's own --done state — one rule set serves both orientations"

key-files:
  created: []
  modified:
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/styles/default.css
    - viewmodel-shell/src/adapter.test.ts

key-decisions:
  - "Marker glyph = var(--vms-surface), not #fff — white text fails WCAG-AA on most themes (dark-teal 1.85:1); surface knockout clears the 3:1 graphical-object bar on all 13 targets (min 3.23:1)"
  - "Marker treated as a WCAG 1.4.11 graphical state indicator (>=3:1), not body text (4.5:1) — its semantic state is ALSO carried by aria-label + position + fill-vs-outline shape, never color alone; consistent with badge-primary/chart-palette already shipped at the 3:1 non-text budget"
  - "Steps intrinsic collapse uses @container (max-width:30rem) so P1's zero-viewport-breakpoint rule holds; the deliberate .vms-steps--vertical wizard shares the same stacked form"
  - "Breadcrumb separator is an empty aria-hidden <span> with a CSS-owned '/' glyph (::before) — one fixed separator, off the wire, per the design"

patterns-established:
  - "Nav-node a11y is framework-drawn end-to-end: breadcrumb emits <nav aria-label> + <ol> + aria-current=page; steps emits aria-current=step + marker aria-labels and deliberately omits role=progressbar/tabindex"

requirements-completed: [NAV-01, NAV-02]

# Metrics
duration: 15min
completed: 2026-07-11
---

# Phase 20 Plan 03: Navigation Primitives — Browser Render Layer Summary

**BreadcrumbNode + StepsNode now render in the browser adapter with 100% framework-drawn appearance (separators, connectors, markers, intrinsic reflow) and accessibility, styled entirely with existing `--vms-*` tokens so all 12 theme files stay SHA-frozen.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-11T13:43Z
- **Completed:** 2026-07-11T13:49Z
- **Tasks:** 3 completed
- **Files modified:** 3

## Accomplishments
- `breadcrumb()` renderer: `<nav aria-label="breadcrumb"> > <ol.vms-breadcrumb>` with href crumbs (reusing LinkNode's external `target`/`rel`), action crumbs that dispatch by name, and a plain-text current last item carrying `aria-current="page"` on its `<li>`; framework-drawn `aria-hidden` separator between items.
- `steps()` renderer: per-step state derived purely from `current` (`done`/`current`/`upcoming`), `aria-current="step"` on the current step, marker state on `aria-label` (never color-only), check glyph for done else number; the stepper is non-focusable and is **not** `role="progressbar"`.
- default.css styling with `--vms-*` tokens only; horizontal steps auto-collapse to the stacked/vertical form intrinsically via `@container` (ZERO viewport `@media`); the deliberate `--vertical` wizard shares that form.
- White-on-accent marker legibility hand-verified across default + all 12 themes; chose `var(--vms-surface)` glyph which clears the WCAG graphical-object bar everywhere.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing renderer tests** — `9be4238` (test)
2. **Task 1 (GREEN): breadcrumb() + steps() renderers** — `a44ea63` (feat)
3. **Task 2: default.css styling + intrinsic collapse** — `f4ee5bc` (feat)
4. **Task 3: full jsdom a11y coverage** — `8baab05` (test)

_Task 1 is `tdd="true"` → RED test commit then GREEN implementation commit._

## Files Created/Modified
- `viewmodel-shell/src/browser.ts` — added `BreadcrumbNode, StepsNode` imports, two dispatch-switch cases, and the `breadcrumb()` + `steps()` renderer methods (all text via `textContent`, XSS-safe per T-20-05; external crumbs set `rel="noopener noreferrer"` per T-20-06).
- `viewmodel-shell/styles/default.css` — new breadcrumb + steps blocks (token-only), the `@container` intrinsic collapse, and the surface-knockout marker glyph.
- `viewmodel-shell/src/adapter.test.ts` — 6 new jsdom cases (breadcrumb landmark/current/href-vs-action/dispatch/external; steps state-derivation/aria-current/marker-labels/no-progressbar/no-tabindex/orientation/description gating).

## White-on-accent marker contrast — hand-check (per-theme)

The automated `check-aa-contrast.mjs` PAIRS list does **not** cover a literal glyph-on-`--vms-accent` pair, so this was hand-computed with the same WCAG relative-luminance formula the script uses. `#fff` (rejected) vs the chosen `var(--vms-surface)` glyph, contrast against each theme's `--vms-accent` fill:

| Theme | `--vms-accent` | `--vms-surface` | `#fff`/accent (rejected) | **surface/accent (shipped)** |
|---|---|---|---|---|
| default (shipped) | `#5a4ad7` | `#ffffff` | 6.18 | **6.18** |
| dark-amber | `#f0a830` | `#18181c` | 2.03 ✗ | **8.72** |
| dark-blue | `#4a9eff` | `#18181c` | 2.75 ✗ | **6.43** |
| dark-green | `#4dd17a` | `#18181c` | 1.96 ✗ | **9.03** |
| dark-purple | `#7c6af7` | `#18181c` | 3.99 | **4.44** |
| dark-rose | `#ed5b8e` | `#18181c` | 3.24 | **5.47** |
| dark-teal | `#4ed1d1` | `#18181c` | 1.85 ✗ | **9.58** |
| light-amber | `#b8830f` | `#ffffff` | 3.34 | **3.34** |
| light-blue | `#2277dd` | `#ffffff` | 4.42 | **4.42** |
| light-green | `#2da359` | `#ffffff` | 3.23 | **3.23** |
| light-purple | `#5a4ad7` | `#ffffff` | 6.18 | **6.18** |
| light-rose | `#c63767` | `#ffffff` | 5.07 | **5.07** |
| light-teal | `#2a9d9d` | `#ffffff` | 3.28 | **3.28** |

**Chosen glyph = `var(--vms-surface)`: every theme clears the WCAG 1.4.11 graphical-object bar (≥3:1); minimum is 3.23:1 (light-green).** `#fff` was rejected because dark themes with light accents fall to 1.85–2.75:1 (below even the 3:1 non-text bar). The marker is treated as a graphical state indicator (≥3:1), not body text (4.5:1), because its semantic state is redundantly carried by the marker's `aria-label` ("complete"/"current"/"upcoming"), by list position, and by fill-vs-outline shape — so color/glyph is never the sole state channel. This matches the framework's existing contrast budget: the shipped `.vms-badge--primary` white-on-accent pill and the `--vms-chart-*` palette are already hand-checked at the 3:1 non-text bar, not the 4.5:1 text bar. No theme file was touched, so no per-theme fill deepening was needed.

## Deviations from Plan

**None functionally** — the plan anticipated possibly deepening the marker fill per-theme via `color-mix(... N%, #000)` (the 3.5.0 toast technique) if white-on-accent failed AA. That path was **not needed**: switching the glyph token to `var(--vms-surface)` (polarity-adaptive) solves it cleanly with zero fill deepening and zero theme edits, which is strictly better (preserves the vivid signed-off accent fill on every theme). The plan explicitly permitted the ≥3:1 graphical-marker interpretation as the alternative to the 4.5:1 text interpretation, so this is within the authored latitude, not a scope change.

## Verification Results
- `npx tsc --noEmit` — clean.
- `npx vitest run` — 49 files, 576 passed / 1 skipped (the 6 new nav cases included).
- `node scripts/check-aa-contrast.mjs` — 13/13 pairs meet WCAG-AA on default + all 12 themes.
- `node scripts/check-theme-byte-identity.mjs` — all 11 frozen theme files match their SHA baseline; dark-purple.css byte-exact capture intact (theme files untouched).
- `npm run check:core-globals` — `src/index.ts` references zero platform globals.
- No new viewport `@media` rule (the two `@media` grep hits are pre-existing explanatory comments); the steps collapse uses `@container (max-width: 30rem)`.

## Self-Check: PASSED
- `viewmodel-shell/src/browser.ts` — FOUND (breadcrumb/steps renderers + dispatch cases present)
- `viewmodel-shell/styles/default.css` — FOUND (all 9 required classes present)
- `viewmodel-shell/src/adapter.test.ts` — FOUND (8 v5.1 nav test cases)
- Commits `9be4238`, `a44ea63`, `f4ee5bc`, `8baab05` — all present in `git log`.
