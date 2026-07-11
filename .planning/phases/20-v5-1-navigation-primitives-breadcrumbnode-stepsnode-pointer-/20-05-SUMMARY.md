---
phase: 20-v5-1-navigation-primitives-breadcrumbnode-stepsnode-pointer-
plan: 05
subsystem: parity
tags: [breadcrumb, steps, parity, feature-probe, showcase, cross-backend, viewmodel-shell]

# Dependency graph
requires:
  - phase: 20-01
    provides: BreadcrumbNode + StepsNode TS wire types (the ViewNode arms the bun handler builds)
  - phase: 20-02
    provides: .NET byte-identical BreadcrumbNode/StepsNode records + discriminators (the controller twin builds)
provides:
  - demo/FeatureProbe-bun/handler.ts navSection — breadcrumb (href-only / external:true / action-crumb / auto-current) + two steps (orientation omitted vs "vertical")
  - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs navSection — byte-identical .NET twin
  - parity/fixtures/feature-probe.json $comment — nav coverage doc (no new POST step; rides existing GET steps)
  - demo/Showcase/frontend/src/main.ts — Breadcrumb + Steps gallery sections (both step orientations) for the Wave-3 verification page
affects: [20-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New ViewNode cross-backend proof = append a byte-aligned static section to BOTH FeatureProbe twins (same labels/hrefs/omit-choices/action-name/current/orientation) captured by the existing GET steps; parity byte-diffs it with NO new POST step (same convention as feedback/chart/blocking sections)"
    - "A dispatch-bearing descendant that must exercise (not trip) the action-name uniqueness validator uses a UNIQUE name never POSTed by any step (nav-crumb-probe), proving the collectActions walk descends into breadcrumb items in a real tree"

key-files:
  created: []
  modified:
    - demo/FeatureProbe-bun/handler.ts
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - parity/fixtures/feature-probe.json
    - demo/Showcase/frontend/src/main.ts

key-decisions:
  - "navSection rides the existing GET steps (static view-shape) — no new POST step; the crumb action-name nav-crumb-probe is present in both backends and nowhere else in the fixture, so it exercises the action-name descent without a duplicate-action collision"
  - "Full omitted-vs-present matrix packed into one section: href-only crumb (external absent) / external:true crumb / action crumb / label-only current crumb; steps with orientation OMITTED (default horizontal) + description omitted-vs-present, and a second steps orientation:\"vertical\" — both current:1"
  - "Showcase uses 4-step trails and current:2 on the vertical wizard (with per-step descriptions) so both orientations render distinctly as the visual reference; zero custom CSS"

patterns-established:
  - "Every new node's byte-identity is proven by a parity-diffed FeatureProbe twin section; the Showcase gallery is the discretionary visual host the tailnet verification page draws from"

requirements-completed: [NAV-03, NAV-04]

# Metrics
duration: 15min
completed: 2026-07-11
---

# Phase 20 Plan 05: Navigation Primitives — Parity Fixtures + Showcase Gallery Summary

**A byte-identical `navSection` (BreadcrumbNode + StepsNode across the full omitted/present wire matrix, both step orientations, plus an action crumb with a unique name) now lives in both FeatureProbe backends and is proven byte-identical by a green `bun run parity/run.ts`; the Showcase has Breadcrumb + Steps gallery sections (both orientations) as the visual reference.**

## Performance
- **Duration:** ~15 min
- **Completed:** 2026-07-11
- **Tasks:** 3 completed
- **Files created:** 0 · **Files modified:** 4

## Accomplishments
- **navSection in both FeatureProbe twins (byte-aligned):** a `breadcrumb` with an href-only crumb (`external` omitted → absent), an `external:true` crumb (literal boolean), an action crumb whose UNIQUE name `nav-crumb-probe` proves the action-name uniqueness walk descends into breadcrumb items, and a final label-only crumb (framework auto-renders as current); plus two `steps` nodes — one with `orientation` OMITTED (default horizontal) mixing a `description`-bearing step with two bare ones, and one with `orientation:"vertical"` — both `current:1`. Same labels/hrefs/omit-choices/action-name/current/orientation in the bun handler and the .NET controller.
- **Fixture doc updated:** appended a sentence to `feature-probe.json` `$comment` describing exactly what the nav section proves; **no new POST step** — the section rides the existing GET steps (step count unchanged at 41), same convention as the feedback/chart/blocking sections.
- **Showcase gallery:** a "Breadcrumb" section (href crumbs + an action crumb + an auto-current last item) and a "Steps" section rendering BOTH a default-horizontal steps and a vertical steps (`orientation:"vertical"`) with per-step descriptions — the visual reference the Wave-3 tailnet verification page draws from. Zero custom CSS.

## Task Commits
1. **Task 1: byte-identical navSection in both FeatureProbe backends** — `12cafab` (test)
2. **Task 2: fixture $comment + parity green** — `7177350` (test)
3. **Task 3: Showcase gallery sections (breadcrumb + steps, both orientations)** — `391cb44` (docs)

## Files Created/Modified
- `demo/FeatureProbe-bun/handler.ts` — added `navSection: ViewNode` (breadcrumb + two steps) with the standing byte-identical-twin comment; appended to the `buildVm` return `children` before `probeModal`.
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — the byte-identical .NET twin (`new BreadcrumbNode`/`new BreadcrumbItem`/`new StepsNode`/`new StepItem`), appended to `pageChildren` at the mirror position (after `blockingSection`, before the modal).
- `parity/fixtures/feature-probe.json` — one-sentence `$comment` addition documenting the nav coverage (no new step).
- `demo/Showcase/frontend/src/main.ts` — Breadcrumb + Steps gallery sections inserted in `componentsView` before the Modal section.

## Deviations from Plan
**None functionally.** The nav code was implemented exactly as specified and parity is green.

### Auto-fixed Issues
None.

## Verification Results
- **Task 1:** `dotnet build` (FeatureProbe/AspNetCore) — **Build succeeded, 0 warnings/0 errors**; `grep` confirms `new BreadcrumbNode` + `Orientation: "vertical"` (cs) and `breadcrumb` + `orientation: "vertical"` (ts). `bun build handler.ts --target=bun` — exit 0.
- **Task 2:** `feature-probe.json` valid JSON, **41 steps (unchanged — no new POST step)**, `$comment` mentions breadcrumb/steps/orientation, `nav-crumb-probe` is NOT a POST step. `bun run parity/run.ts` (with `~/.dotnet` on PATH) — **exit 0, ✓ Parity tests passed**; feature-probe = 41 steps captured identically across dotnet-probe / bun-probe / node-probe.
- **Task 3:** `grep -q 'type: "breadcrumb"'` true, `grep -c 'type: "steps"'` == 2 (both orientations). `npx vite build` (Showcase) — **exit 0, built in ~0.5s**; `npx tsc --noEmit` reports only pre-existing `?inline` theme-CSS import errors (lines 4-15, palette.ts:6 — untouched by this plan; zero errors from the breadcrumb/steps additions).

## Known Stubs
None.

## Deferred Issues
- **Stale framework `dist/*.d.ts` blocks bun-demo tsc (pre-existing, out of scope).** `viewmodel-shell/dist/*.d.ts` (dated Jul 9/2) predates today's `src/index.ts` nav-type additions (Plans 20-01/20-02, Jul 11), so `bunx tsc --noEmit` in `demo/FeatureProbe-bun` cannot resolve BreadcrumbNode/StepsNode AND fails on a pre-existing ModalNode size `"small"` error (line 556 — proving the failure predates plan 20-05). FeatureProbe-bun resolves types via the package `exports` map (dist); Showcase resolves via a tsconfig src alias so it is unaffected. Runtime is unaffected (types erased): `bun build --target=bun` succeeds and parity is green. Fix belongs to a framework build refresh (rebuild `dist` from current `src`), not this fixtures plan. Logged to `deferred-items.md`.

## Self-Check: PASSED
- `demo/FeatureProbe-bun/handler.ts` — FOUND (`navSection` with `type: "breadcrumb"` + `orientation: "vertical"`)
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — FOUND (`new BreadcrumbNode` + `Orientation: "vertical"`)
- `parity/fixtures/feature-probe.json` — FOUND (`$comment` names the nav coverage; 41 steps)
- `demo/Showcase/frontend/src/main.ts` — FOUND (Breadcrumb + 2 Steps gallery sections)
- Commits `12cafab`, `7177350`, `391cb44` — present in `git log`.
