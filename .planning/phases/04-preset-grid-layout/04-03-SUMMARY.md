---
phase: 04-preset-grid-layout
plan: 03
subsystem: testing
tags: [parity, cross-backend, wire-format, layout, density, feature-probe, dotnet, bun, node]

# Dependency graph
requires:
  - phase: 04-01
    provides: "PageNode/SectionNode `layout?: stack|split|cards` (TS) + `string? Layout = null` (.NET) closed-union wire field"
  - phase: 04-02
    provides: "renderer modifier emission + default.css split/cards rules (no parity surface; not exercised here)"
provides:
  - "FeatureProbe TS handler + .NET controller emit a byte-identical VM exercising layout (cards page / split section) + density:compact + variant:card"
  - "LAYOUT-05 cross-backend round-trip proof: feature-probe parity green across dotnet-probe/bun-probe/node-probe with the widened VM"
  - "Phase 3 D-05 deferral closed (D-09): one widened fixture now covers density + card + layout across 3 backends"
affects: [04-04, phase-5-release-closeout, parity-regression-baseline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Widen a shared VM builder (not the fixture) so new wire fields ride into every existing recorded parity step automatically"
    - "FeatureProbe as the canonical 3-backend wire-surface probe for any new page/section field"

key-files:
  created:
    - .planning/phases/04-preset-grid-layout/04-03-SUMMARY.md
  modified:
    - demo/FeatureProbe-bun/handler.ts
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs

key-decisions:
  - "Edited handler.ts (shared VM home for bun-probe + node-probe), not server.ts/server-node.ts (Pitfall 3) — one edit covers both TS backends"
  - "Used layout split (section) + cards (page); never stack (Pitfall 1) — stack is a non-null string that crosses the wire"
  - "No structural fixture/backends.json/run.ts/normalize.ts edit — existing 15 feature-probe steps re-call the builder, so new fields ride automatically (RESEARCH A4)"
  - "No version bump (D-11) — Phase 5 RELEASE-01 owns the aligned 0.4.0"

patterns-established:
  - "Pattern: Prove a new wire field round-trips cross-backend by widening the shared FeatureProbe builder on BOTH backends identically and re-running the existing parity harness (zero fixture-script change)"
  - "Pattern: A single widened FeatureProbe fixture can close multiple deferred parity-coverage debts (layout + density + card together)"

requirements-completed: [LAYOUT-01, LAYOUT-05]

# Metrics
duration: 14min
completed: 2026-05-18
---

# Phase 4 Plan 03: FeatureProbe Cross-Backend Layout Parity Summary

**FeatureProbe TS handler + .NET controller now emit a byte-identical VM (PageNode density:compact, layout:cards wrapping a SectionNode variant:card, layout:split) — proving LAYOUT-05's `layout` wire field round-trips identically across dotnet-probe/bun-probe/node-probe and closing the Phase 3 D-05 density/card deferral (D-09) in one fixture.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-05-18T01:16:00Z
- **Completed:** 2026-05-18T01:30:37Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `demo/FeatureProbe-bun/handler.ts` `buildVm()` widened: existing `children` now wrapped in a `SectionNode` (`heading: "Probe"`, `variant: "card"`, `layout: "split"`), returned inside a `PageNode` (`density: "compact"`, `layout: "cards"`).
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` `BuildVm()` widened to the byte-identical .NET mirror: `new SectionNode("Probe", children, Variant: "card", Layout: "split")` inside `new PageNode("Feature Probe", [...], Density: "compact", Layout: "cards")`.
- Cross-backend parity harness run green: `feature-probe` byte-identical across **dotnet-probe / bun-probe / node-probe** (15 steps each, `✓ all backends agree`); all 7 pre-existing fixtures (tasks, contacts, retro, expenses, helpdesk, reorder, + feature-probe) still green; `✓ Parity tests passed`, exit 0.
- Phase 3 D-05 deferral (dedicated density/card parity fixture) closed by this single widened fixture (D-09).

## Task Commits

Each task was committed atomically:

1. **Task 1: Widen buildVm (TS) and BuildVm (.NET) to emit an identical layout+density+card VM** - `6f9c2d4` (feat)

**Plan metadata:** committed by orchestrator (STATE.md/ROADMAP.md owned by orchestrator this run).

## Files Created/Modified
- `demo/FeatureProbe-bun/handler.ts` - `buildVm()` final return widened: children wrapped in a `section` (variant:card, layout:split) inside a `page` (density:compact, layout:cards). Shared by bun-probe + node-probe.
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` - `BuildVm()` final return widened to the byte-identical .NET mirror (`SectionNode` Variant/Layout + `PageNode` Density/Layout).
- `.planning/phases/04-preset-grid-layout/04-03-SUMMARY.md` - this summary.

## Decisions Made
- None beyond the plan's locked guardrails — followed the plan's `<action>` blocks verbatim. Key plan-mandated choices honored: `handler.ts` not `server.ts` (Pitfall 3); `split`/`cards` not `stack` (Pitfall 1); no fixture/backends.json/run.ts/normalize.ts edit (RESEARCH A4); no version bump (D-11).

## Deviations from Plan

None - plan executed exactly as written. The single `type="auto"` task was implemented per its `<action>` block; both backends emit the byte-identical VM; verification passed.

## Issues Encountered

**Environment: orphaned parity backend processes from prior interrupted runs (resolved, not a code defect).**
- The parity harness failed three times in its **serial prebuild/cleanup stage** (before any wire diff) due to stale processes from previously interrupted runs holding Windows file locks: (1) `ViewModelShell.exe`/demo backends locking `AshleyShrok.ViewModelShell.dll` (MSB3027 copy failure on `dotnet-tasks`); (2) a stray `Reorder.exe` locking the same DLL for `dotnet-reorder`; (3) orphaned `bun run server.ts` / `node server-node.ts` backends locking `helpdesk-parity-bun.db` (`EBUSY` on `rmSync`).
- **Resolution:** Identified orphaned processes precisely by command line (excluding agent tooling), terminated the 10 stale parity backends, removed the stale `helpdesk-parity-bun.db`, then re-ran. The `dotnet-probe` build (carrying this plan's `FeatureProbeController.cs` change) compiled cleanly on every attempt — the failures were purely environmental file-lock contention from prior runs, never caused by this plan's edits. Final run: `✓ all backends agree`, `✓ Parity tests passed`, exit 0.
- No code change was required to resolve this; no scope creep.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- LAYOUT-05 cross-backend round-trip proven; the parity regression baseline now includes the widened feature-probe fixture (15 steps × 3 backends, byte-identical).
- 04-04 (AGENTS.md doc accuracy for the `layout` field) is unblocked and unaffected by this plan (this plan deliberately did NOT touch AGENTS.md — that is 04-04's scope).
- No blockers. No version bump performed (Phase 5 RELEASE-01 owns the aligned 0.4.0 bump).

## Known Stubs

None - both builders emit fully-wired, real VM data; the widened section/page fields are static author-chosen literals (`"split"`/`"cards"`/`"compact"`/`"card"`) by design (parity probe), not placeholder/empty stubs.

## Self-Check: PASSED

- FOUND: `.planning/phases/04-preset-grid-layout/04-03-SUMMARY.md`
- FOUND: `demo/FeatureProbe-bun/handler.ts`
- FOUND: `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`
- FOUND: commit `6f9c2d4` (Task 1)

---
*Phase: 04-preset-grid-layout*
*Completed: 2026-05-18*
