---
phase: 20-v5-1-navigation-primitives-breadcrumbnode-stepsnode-pointer-
plan: 01
subsystem: ui
tags: [viewnode, breadcrumb, steps, wire-types, tree-validator, typescript]

# Dependency graph
requires:
  - phase: 19-v5-0
    provides: "v5.0 baseline — parity green; ViewNode union + tree-validator conventions (LinkNode, ChartNode, empty-state/fits action-descent arms)"
provides:
  - "BreadcrumbNode + BreadcrumbItem TS wire interfaces (crumb nav-vs-dispatch model: href/external OR action; last item auto-current)"
  - "StepsNode + StepItem TS wire interfaces (0-based required current; per-step status derives; orientation? closed enum, omitted = horizontal)"
  - "Both new nodes registered in the ViewNode union"
  - "collectActions descends into breadcrumb crumb actions (uniqueness-checked); steps + breadcrumb documented as action-free/section-free leaves in both TS walks"
affects: [20-02 (.NET byte-identical twin), 20-03 (browser.ts renderer + default.css), 20-04 (TUI degradation), 20-05 (FeatureProbe parity fixtures)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Crumb dispatch = a dispatch-bearing descendant → collectActions must descend (tabs-arm + empty-state optional-guard pattern) to avoid the silently-exempt-action bug"
    - "A childless data/nav node is a documented action-free/section-free leaf named in the fall-through comment (no fits-style blind spot)"

key-files:
  created: []
  modified:
    - "viewmodel-shell/src/index.ts — BreadcrumbItem/BreadcrumbNode + StepItem/StepsNode interfaces + two ViewNode union entries"
    - "viewmodel-shell/src/server.ts — collectActions `breadcrumb` arm + BreadcrumbNode import + leaf comments in both TS walks"
    - "viewmodel-shell/src/tree-walker.test.ts — 4 new vitests (crumb-action descent, duplicate crumb rejection, href-only records nothing, steps action-free)"

key-decisions:
  - "LOCKED crumb shape: { label, href?, external?, action? } — href = browser nav (external ⇒ new tab, exactly LinkNode), action = server dispatch. NO per-item current flag; last item is auto-current (position is the signal)."
  - "StepsNode.current is a REQUIRED non-optional number (0 is meaningful — first step current — so it always crosses the wire); per-step done/current/upcoming derives from it, no per-step status field."
  - "orientation? is a closed-enum INTENT; omitted = horizontal (documented in ChartNode.kind phrasing). Framework owns markers/connectors/reflow/a11y — zero appearance on the wire."
  - "walkForSectionAction gets NO new arm — neither node holds ViewNode children — only an extended leaf comment so the omission is provably deliberate."

patterns-established:
  - "Nav-by-dispatch crumbs: the action-name walk descends into crumb actions the same way it descends into tab/empty-state/fits actions — closing the missed-walk failure class for a new dispatch site."

# Metrics
duration: 12min
completed: 2026-07-11
---

# Phase 20 Plan 01: TS BreadcrumbNode + StepsNode Wire Types + Validators Summary

**Declared BreadcrumbNode + StepsNode (and their sub-record types) as first-class TypeScript ViewNode wire shapes and taught both TS tree-validators about them — collectActions now uniqueness-checks nav-by-dispatch crumb actions, and both nodes are documented action-free/section-free leaves.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `BreadcrumbNode`/`BreadcrumbItem` and `StepsNode`/`StepItem` exist as typed wire shapes and are members of the `ViewNode` union — the source of truth the .NET twin (20-02) mirrors and the renderer (20-03) consumes.
- `collectActions` descends into each crumb's optional `action`, so crumb dispatch action names are subject to the one-name-one-operation uniqueness rule (no silently-exempt dispatch-bearing descendant — the exact bug the empty-state/fits arms exist to prevent).
- Both nodes are named in the fall-through leaf comments of both TS walks (`collectActions` + `walkForSectionAction`) so their action-free/section-free status is explicit, not a fits-style blind spot.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare BreadcrumbNode + StepsNode wire types in index.ts** — `d62b714` (feat)
2. **Task 2: Teach both TS tree-validators about the new nodes** — `9d8cca8` (feat; TDD RED→GREEN in one atomic commit — test + validator arm)

## Files Created/Modified
- `viewmodel-shell/src/index.ts` — Added `BreadcrumbItem` (`label`, `href?`, `external?`, `action?: ActionEvent`) + `BreadcrumbNode { type:"breadcrumb", items }` near LinkNode; `StepItem` (`label`, `description?`) + `StepsNode { type:"steps", steps, current, orientation? }` near ChartNode; appended `| BreadcrumbNode | StepsNode` to the `ViewNode` union. TSDoc states last crumb is auto-current + framework-drawn separator, and that step status derives from `current`, omitted orientation = horizontal, framework owns all appearance/a11y.
- `viewmodel-shell/src/server.ts` — Added a `case "breadcrumb"` arm in `collectActions` iterating `items` and `recordAction`-ing each `item.action` (tabs-arm shape + empty-state optional guard); imported `BreadcrumbNode`; extended the leaf comments in both `collectActions` and `walkForSectionAction` to name `breadcrumb` + `steps`.
- `viewmodel-shell/src/tree-walker.test.ts` — 4 new `validateActionNames` cases: (a) a crumb action collides with a top-level button (proves descent), (b) two crumbs sharing an action name are rejected, (c) href-only crumbs record nothing, (d) StepsNode records no actions.

## Per-Task Verification

| Task | Verification | Result |
|------|--------------|--------|
| 1 | `npx tsc --noEmit`; grep interfaces == 1 each; union entries; `action?: ActionEvent`; `current: number` (non-optional) | tsc exit 0; all greps pass |
| 2 | `grep 'case "breadcrumb"'` == 1; leaf comments name both nodes; `npx tsc --noEmit`; `npx vitest run` | tsc exit 0; full suite **49 files, 570 passed / 1 skipped** |

TDD note: Task 2 followed RED→GREEN — the two crumb-action-descent tests were confirmed failing (breadcrumb fell through `default:`) before the `breadcrumb` arm was added, then all green after.

## Deviations from Plan

None — plan executed exactly as written. The `BreadcrumbNode` type import into `server.ts` (needed for the `bc as BreadcrumbNode` cast) is an intrinsic part of the Task 2 action and not a scope deviation.

## Known Stubs

None. This is the type + validator layer only; the renderer (browser.ts/default.css), TUI degradation, .NET twin, and parity fixtures are explicitly separate downstream plans (20-02..20-05), not stubs.

## Threat Surface Scan

No new security-relevant surface. Per the plan's threat register: T-20-01 (Tampering — crumb action uniqueness) is MITIGATED (collectActions descends into crumb actions → duplicate/ambiguous names caught at build time as `invalid_tree`). T-20-02 (steps/breadcrumb leaf handling) was accepted (type-only + validator-comment change, no runtime input parsing, no new external boundary). No package installs.
