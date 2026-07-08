---
phase: 14-non-blocking-dispatch-core
plan: 01
subsystem: ui
tags: [typescript, dispatch-loop, concurrency, viewmodel-shell-core]

# Dependency graph
requires:
  - phase: 12-chartnode-primitive
    provides: stable src/index.ts dispatch loop baseline (dispatching mutex, busy flags, epoch-free)
provides:
  - "ActionEvent.blocking?: boolean (client-side dispatch-lane hint, never on the wire)"
  - "Two-lane dispatch loop (blockingInFlight / nonBlockingInFlight) replacing the single `dispatching` mutex"
  - "NBA-02 coalescing (pendingNonBlockingRefire, latest-wins)"
  - "NBA-03 client-side epoch (dispatchSeq / appliedSeq) discarding stale/out-of-order responses"
  - "performRoundTrip() — the extracted, lane-agnostic network round trip"
  - "Every browser.ts trigger (checkbox, field select-change/Enter, tabs, section.action, table sort/filter/row-action/pagination) forwards the full ActionEvent object"
affects: [14-02-dotnet-wire-twin, 14-03-parity-fixture]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dispatch-lane split: a boolean-guarded 'lane' (blockingInFlight vs nonBlockingInFlight) replacing a single global mutex, so two conceptually-independent round-trip classes can coexist"
    - "Coalesce-on-in-flight (pendingNonBlockingRefire): overwrite a single pending-refire slot instead of queueing, bounded memory by construction"
    - "Client-side monotonic epoch (dispatchSeq/appliedSeq) for last-writer-wins response ordering with zero wire-level field"

key-files:
  created:
    - viewmodel-shell/test/nonblocking-dispatch.test.ts
    - viewmodel-shell/test/blocking-propagation.test.ts
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/src/browser.ts

key-decisions:
  - "No debounceMs / time-based debounce — coalesce-on-in-flight alone satisfies NBA-02 with zero timers and zero new wire surface (closed design open-item per the plan)."
  - "performRoundTrip() extracted verbatim from the old dispatch() body (plus the seq assignment and epoch gate) so both lanes share byte-identical network/parse/error-handling logic — no duplicated request logic."
  - "blocking travels purely client-side on the existing ActionEvent object; the _action POST payload stays {name} only (Phase 6 wire shape unchanged)."

requirements-completed: [NBA-01, NBA-02, NBA-03, NBA-04]

# Metrics
duration: 6min
completed: 2026-07-08
---

# Phase 14 Plan 01: Non-Blocking Dispatch Core (TS) Summary

**Replaced the single `dispatching` mutex in `ViewModelShell.dispatch()` with two independent in-flight lanes (blocking/non-blocking), added NBA-02 coalescing and an NBA-03 client-side epoch, and made every `browser.ts` trigger forward the full `ActionEvent` object instead of a reconstructed `{name}` literal.**

## Performance

- **Duration:** ~6 min (task commits span 09:29:38–09:34:35)
- **Tasks:** 3 completed
- **Files modified:** 2 (`src/index.ts`, `src/browser.ts`)
- **Files created:** 2 (`test/nonblocking-dispatch.test.ts`, `test/blocking-propagation.test.ts`)

## Accomplishments
- `ActionEvent` gained an optional `blocking?: boolean` field (omitted = `true`, byte-identical default), read purely client-side to pick a dispatch lane — it never rides inside the `_action` POST payload.
- The single `dispatching` mutex is gone. `blockingInFlight` guards the blocking lane with today's exact rapid-click-drop behavior; `nonBlockingInFlight` guards an independent lane so a `silent`/`blocking:false` round trip coexists with a blocking one instead of contending for one shared slot (NBA-01, both directions verified).
- `pendingNonBlockingRefire` coalesces rapid non-blocking triggers to at most one extra round trip, always carrying the latest trigger (NBA-02).
- `dispatchSeq`/`appliedSeq` discard a stale/out-of-order response instead of clobbering a newer already-applied render (NBA-03) — entirely client-side, zero wire-level epoch field.
- `performRoundTrip()` extracted from the old `dispatch()` body so both lanes share identical network/parse/error-handling logic.
- All 9 `browser.ts` call sites that previously reconstructed a bare `{name: X.name}` now forward the full captured `ActionEvent`/`TableRow.action`/`TablePagination` action object, so `blocking` (and any future field) survives every trigger path.
- Two new vitest files deterministically prove NBA-01 (both directions + no-regression), NBA-02 (coalesce to one, latest wins), NBA-03 (out-of-order discard), and blocking propagation from CheckboxNode/ButtonNode/TabsNode/SectionNode.action/TableRow.action.

## Task Commits

Each task was committed atomically:

1. **Task 1: ActionEvent.blocking + two-lane dispatch loop (mutex replacement, coalescing, epoch) in index.ts** - `71ddde9` (feat)
2. **Task 2: propagate the full ActionEvent object at every browser.ts trigger call site** - `74fbc2d` (fix)
3. **Task 3: vitest coverage for coexistence (NBA-01), coalescing (NBA-02), out-of-order discard (NBA-03), and blocking propagation** - `4e7c424` (test)

_Task 3 is a `tdd="true"` task, but per the plan's own design its implementation (Tasks 1–2) intentionally precedes its coverage tests within this same plan — there is no separate RED-phase commit; the plan's `<action>` for Task 3 is "create the two test files" directly, and all 10 new tests passed on first run against the already-implemented Task 1/2 code._

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `viewmodel-shell/src/index.ts` - `ActionEvent.blocking?`; `blockingInFlight`/`nonBlockingInFlight`/`pendingNonBlockingRefire`/`dispatchSeq`/`appliedSeq` fields; extracted `performRoundTrip()`; rewritten `dispatch()` with the blocking/non-blocking branch; `push()`'s guard updated
- `viewmodel-shell/src/browser.ts` - all 9 trigger call sites (field select-change, field Enter, checkbox, tabs, section.action ×3, table sort, table filter, table row.action ×3, table pagination) forward the full `ActionEvent` object
- `viewmodel-shell/test/nonblocking-dispatch.test.ts` - new: `ViewModelShell`-level coexistence/coalescing/epoch tests with a controllable out-of-order fetch mock
- `viewmodel-shell/test/blocking-propagation.test.ts` - new: `BrowserAdapter`/jsdom-level tests proving `blocking:false` survives dispatch from 5 node types

## Decisions Made
- No `debounceMs` / time-based debounce implemented — the design's own closed open-item; coalesce-on-in-flight fully satisfies NBA-02 with zero timers and zero new wire surface.
- `performRoundTrip()` is a straight verbatim extraction (plus the `seq` assignment and epoch gate) so the two lanes cannot silently diverge in their network/error-handling logic over time.
- `blocking` is a pure client-side scheduling hint — confirmed via `grep` that it never appears in the `form.append("_action", ...)` payload; the wire shape stays `{name}` only (Phase 6).

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria (grep checks for removed `dispatching` field/references, presence of the five new fields, zero `on({ name:` reconstructions in browser.ts) passed on first verification; `npx tsc --noEmit`, the full `npx vitest run` (44 files / 522 passed / 1 skipped, +10 new tests vs. the pre-plan baseline of 512), `npm run check:core-globals`, and `npm run build` all passed clean without needing any fixes.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The TS-only "core mechanism" half of Phase 14 is complete and green. Plan 14-02 (the .NET wire twin, `ActionDescriptor.Blocking`, same wave, no shared files) and Plan 14-03 (wave 2, cross-backend parity fixture proving the `blocking` field's wire shape is byte-identical) can proceed.
- No blockers. `dist/` was rebuilt via `npm run build` so any locally-linked consumer (demo apps, Plan 14-03's parity fixture) sees current code.

---
*Phase: 14-non-blocking-dispatch-core*
*Completed: 2026-07-08*

## Self-Check: PASSED

- FOUND: `viewmodel-shell/test/nonblocking-dispatch.test.ts`
- FOUND: `viewmodel-shell/test/blocking-propagation.test.ts`
- FOUND: `.planning/phases/14-non-blocking-dispatch-core/14-01-SUMMARY.md`
- FOUND commit: `71ddde9` (Task 1)
- FOUND commit: `74fbc2d` (Task 2)
- FOUND commit: `4e7c424` (Task 3)
