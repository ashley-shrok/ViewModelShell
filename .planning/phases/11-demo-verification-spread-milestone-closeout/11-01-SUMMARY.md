---
phase: 11-demo-verification-spread-milestone-closeout
plan: 01
subsystem: showcase-demo
tags: [showcase, layouts-view, demo-spread, arrange-align, switcher, cards-minitem, fits, real-app-composition]
requires:
  - "arrange/align row enums (Phase 8) + switcher/cards minItem (Phase 9) + fits node (Phase 10) — all shipped on main"
provides:
  - "Dedicated Showcase \"Layouts\" review surface (DEMO-01): organized, labeled per-primitive demos for arrange/align/header-bar/switcher/cards-minItem/fits"
  - "Real-app compositions (DEMO-02): dashboard header-bar + cards minItem grid; list-detail fits-driven split<->stack"
affects:
  - demo/Showcase/frontend/src/main.ts
tech-stack:
  added: []
  patterns:
    - "fits candidates factored to shared ViewNode locals (listPane/detailPane) so wide split + narrow stack render identical content"
    - "incremental phase-8/9/10 demos consolidated OUT of componentsView() into a dedicated layoutsView() reviewable surface"
key-files:
  created: []
  modified:
    - demo/Showcase/frontend/src/main.ts
decisions:
  - "Pre-existing presets (stack/split/cards/sidebar/row) NOT duplicated in layoutsView() — demonstrated in archetype views per CONTEXT"
  - "Added a switcher limit:3 variant (5 children over the cap -> all-stack) beyond the required default+threshold, for fuller coverage"
  - "tsc stash-compare done by error-set identity: the 12 errors are exactly the documented pre-existing theme ?inline TS2307s, none reference added view code -> zero new"
metrics:
  duration: ~20m
  completed: 2026-06-24
---

# Phase 11 Plan 01: Demo Verification Spread (DEMO-01 + DEMO-02) Summary

Built the operator review surface for the v1.12 layout milestone: a dedicated, well-labeled Showcase **"Layouts"** view consolidating every primitive built in Phases 8/9/10, plus two real-app compositions that actually use the new primitives. All in `demo/Showcase/frontend/src/main.ts`, zero `<style>` / zero app CSS — ViewNodes only.

## What was built

**DEMO-01 — dedicated "Layouts" view.**
- Added `"layouts"` to the `View` type, a `"Layouts"` tab in `buildVm()`'s tabs, a `case "layouts": return layoutsView();` in `viewChildren()`, and the new `layoutsView(): ViewNode[]`.
- MOVED the incremental layout demos that Phases 8/9/10 had appended into `componentsView()` OUT into `layoutsView()`, each primitive on its own with a heading + a one-line muted caption stating what to look for (resize cues where applicable). `componentsView()` is now clean of layout demos (Stat bar → Image directly).
- Coverage in `layoutsView()`, each labeled:
  - **arrange** — a `layout:"row"` per value: `start / center / end / space-between / space-around / space-evenly` (3 visible link children each).
  - **align** — a `layout:"row"` per value: `start / center / end / stretch / baseline`, with deliberately different-sized children (large heading + small link) so `baseline` and `stretch` are visible.
  - **header-bar** — the canonical `arrange:"space-between"` + heading-TextNode-first-child + nested row nav cluster (ALIGN-04).
  - **switcher** — default (~4 equal cards, atomic row↔stack flip caption), a `threshold:"sm"` variant, AND a `limit:3` variant (5 children over the cap → all-stack).
  - **cards minItem** — `xs / md / xl` grids (6 cards each) side by side with resize-to-collapse caption.
  - **fits** — wide-row toolbar (preferred FIRST) ↔ compact stacked (fallback LAST) with the measure-and-pick caption.

**DEMO-02 — real-app compositions.**
- `dashboardView()`: replaced the plain heading with a header-bar (`layout:"row"` + `arrange:"space-between"` + title TextNode + nested nav-cluster row), and added an explicit `minItem:"sm"` to the cards stat grid.
- `listDetailView()`: factored the list + detail panes into shared `ViewNode` locals and wrapped them in a `fits` node — a side-by-side `layout:"split"` candidate FIRST (wide) and a `layout:"stack"` candidate LAST (narrow fallback) — the canonical fits split→stack generalization, measured client-side.

## Coverage confirmation

Every CONTEXT.md DEMO-01 coverage item is present and labeled; both DEMO-02 enhancements compose the new primitives. Pre-existing presets (stack/split/cards/sidebar/row) intentionally not duplicated — they live in the archetype views.

## Deviations from Plan

**1. [Rule 2 - Added coverage] switcher `limit` variant**
- Added a third switcher demo using `limit:3` (5 children) so the count-cap behavior is reviewable alongside the required default + `threshold` variants. Pure additive demo content; no framework change.

## Verification

- `cd viewmodel-shell && node scripts/check-no-demo-style.mjs` → **GREEN** (8 HTML files zero-`<style>`, `main.ts` `.vms-*`-only).
- `cd demo/Showcase/frontend && npm run build` (vite, authoritative compile) → **clean** (`✓ built in 127ms`, 17 modules).
- `npx tsc --noEmit` → exactly **12 errors, all pre-existing** theme `?inline` TS2307 module-resolution errors; **zero new** (no error references any added function/field).
- Git: 1 file changed (`main.ts` only, +179/−144); `wwwroot` is gitignored build output. **Zero** `package.json` / `.csproj` / `CHANGELOG` changes.

## Out of scope (operator-gated, NOT done)

- DEMO-03 operator browser review.
- POLICY-02 AGENTS.md docs.
- RELEASE-01/02 — version bumps, CHANGELOG versioning, publish, tag. No versions touched; no dev server run.

## Self-Check: PASSED

- `demo/Showcase/frontend/src/main.ts` exists and contains `layoutsView` + the `layouts` tab/case. FOUND.
- Commit `67b0f7f` (`demo(11-01): organize Layouts review surface…`). FOUND.
