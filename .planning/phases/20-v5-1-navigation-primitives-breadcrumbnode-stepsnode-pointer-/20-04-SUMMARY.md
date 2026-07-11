---
phase: 20-v5-1-navigation-primitives-breadcrumbnode-stepsnode-pointer-
plan: 04
subsystem: ui
tags: [breadcrumb, steps, tui, terminal, degradation, experimental, viewmodel-shell]

# Dependency graph
requires:
  - phase: 20-01
    provides: BreadcrumbNode + StepsNode TS wire types (the ViewNode union arms the switch narrows on)
provides:
  - tui.tsx renderNode case "breadcrumb" — inline separator-joined trail (last item = current, plain)
  - tui.tsx renderNode case "steps" — per-step lines with state marker derived from `current` (done ✓ / current ▸ / upcoming ·), description appended
  - test/tui-nav.test.ts — TUI degrade coverage (no crash, no UnsupportedView marker, labels + markers surface)
affects: [20-05, 20-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TUI @experimental node degrade: add an inline renderNode case that emits <text>/<box> only (no DOM, no browser-renderer import); the bar is 'doesn't break + degrades sensibly' — mirrors the divider inline case and the fits deliberate-degrade case"
    - "Steps state derives from the node's single `current` index in the renderer (i<current=done, i===current=current, i>current=upcoming) — no per-step status field, identical rule to the browser renderer"

key-files:
  created:
    - viewmodel-shell/test/tui-nav.test.ts
  modified:
    - viewmodel-shell/src/tui.tsx

key-decisions:
  - "Breadcrumb degrades to ONE joined text line (`Home › Products › Widget`) rather than a box-per-crumb — a terminal has no landmark/interactivity to preserve, and the joined trail is the legible analog (the framework-owned separator becomes the ` › ` text glyph)"
  - "Steps degrades to a column of per-step <text> lines (not a single joined line) so each step's state marker + optional description reads cleanly; markers ✓/▸/· + fg color both carry state (▸=accent #88aaff, done=#aaaaaa, upcoming=#666666)"
  - "Added test/tui-nav.test.ts mirroring tui-chart.test.ts (Rule 2 — coverage for new behavior); asserts no `unknown node type` marker, every label present, and the derived-from-current markers, since the TUI is the one target with no canvas where 'crashes vs legible' is the whole requirement"

patterns-established:
  - "Every new ViewNode gets a TUI degrade case in the same wave as its browser renderer so the @experimental terminal target never regresses to UnsupportedView"

requirements-completed: [NAV-03]

# Metrics
duration: 8min
completed: 2026-07-11
---

# Phase 20 Plan 04: Navigation Primitives — TUI Legible Degradation Summary

**The `@experimental` TUI adapter now renders BreadcrumbNode as an inline separator-joined trail and StepsNode as a per-step text list with state markers derived from `current`, so neither new node falls through to `UnsupportedView` on the non-browser target.**

## Performance
- **Duration:** ~8 min
- **Completed:** 2026-07-11
- **Tasks:** 1 completed
- **Files created:** 1 · **Files modified:** 1

## Accomplishments
- `case "breadcrumb"` in `renderNode`: renders `node.items.map(i => i.label).join(" › ")` as one muted `<text>` line — the last (current) crumb is rendered plainly with no interactivity, and the framework-owned separator becomes a ` › ` text glyph.
- `case "steps"` in `renderNode`: a column `<box>` of one `<text>` per step, each with a marker derived from `node.current` (`i < current` → `✓`, `i === current` → `▸`, `i > current` → `·`) and an accent/muted fg that reinforces the state; `description` is appended (`marker label — description`) when present.
- Both cases are text-only `@experimental` degrades — no DOM, no browser-renderer import — matching the `divider` inline case and the `fits` deliberate-degrade contract.
- `test/tui-nav.test.ts` (5 cases): walks the `renderTree()` React tree (same technique as `tui-chart.test.ts` / `conformance.tui.test.ts`) and asserts no `unknown node type` marker, every label surfaces, and the derived markers are correct (including `current === 0` → `▸` present / no `✓`, and a single-item breadcrumb → no separator).

## Task Commits
1. **Task 1: TUI degradation cases for breadcrumb + steps** — `75e18f1` (feat)

## Files Created/Modified
- `viewmodel-shell/src/tui.tsx` — two new `renderNode` switch cases (breadcrumb inline trail + steps per-step markers), inserted after the `divider` case; the switch narrows to `BreadcrumbNode`/`StepsNode` via the existing `ViewNode` import (no new imports).
- `viewmodel-shell/test/tui-nav.test.ts` — new node-environment vitest suite (local `collectText` walker duplicated per the existing convention, not a shared harness).

## Deviations from Plan
**None functionally.** The plan's acceptance criteria stated a TUI test assertion was optional ("add a minimal assertion if the TUI has a test harness, otherwise tsc + no-UnsupportedView is sufficient"). A harness exists (`tui-chart.test.ts` / `conformance.tui.test.ts`), so a mirroring `tui-nav.test.ts` was added (Rule 2 — coverage for new behavior). This exceeds the minimum verification, not a scope change.

## Verification Results
- `npx tsc --noEmit` — clean (exit 0).
- `grep -c 'case "breadcrumb"'` == 1, `grep -c 'case "steps"'` == 1; the steps case references `current` to derive markers.
- `npx vitest run` — 50 files, 581 passed / 1 skipped (the 5 new nav cases included; was 49/576 before).
- `bun run parity/run.ts` (with `~/.dotnet` on PATH) — all backends agree; skill twins byte-identical; **✓ Parity tests passed** (a TUI-only change does not touch the wire, confirmed).
- `npm run check:core-globals` — `src/index.ts` references zero platform globals.

## Self-Check: PASSED
- `viewmodel-shell/src/tui.tsx` — FOUND (`case "breadcrumb"` + `case "steps"` present in renderNode)
- `viewmodel-shell/test/tui-nav.test.ts` — FOUND (5 passing degrade cases)
- Commit `75e18f1` — present in `git log`.
