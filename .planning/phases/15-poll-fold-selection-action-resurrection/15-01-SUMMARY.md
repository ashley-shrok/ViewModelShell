---
phase: 15-poll-fold-selection-action-resurrection
plan: 01
subsystem: client-dispatch
tags: [typescript, concurrency, dispatch-loop, epoch, coalescing, checkbox]

# Dependency graph
requires:
  - phase: 14-non-blocking-dispatch-core (14-01, 14-04-gap-closure)
    provides: "ActionEvent.blocking?; the two-lane dispatch loop (blockingInFlight/nonBlockingInFlight); pendingNonBlockingRefire coalescing (CR-01 fix: stores {action, silent}); the lane-aware dispatchSeq/appliedSeq epoch (CR-02 fix: blocking always applies unconditionally); performRoundTrip(action, nonBlocking)"
provides:
  - "NBA-06 fix: the non-blocking apply gate in performRoundTrip discards a response not only when seq < appliedSeq, but ALSO whenever pendingNonBlockingRefire !== null at apply time — closing the rapid-double-toggle-on-the-same-control gap (the 0.15.0 selection.action failure mode)"
  - "NBA-05 doc clarifications (no logic change): ShellOptions.pollInterval and schedulePoll now explicitly document that poll always rides the non-blocking lane (silent=true forces nonBlocking=true regardless of any blocking field), so pollInterval is sugar over the same non-blocking dispatch path as blocking:false"
  - "poll-fold.test.ts — real ShellOptions.pollInterval -> setTimeout -> auto-dispatch proof of NBA-05's three properties: coexistence (a blocking action fired while an auto-poll is in flight is honored), stale-discard (a late poll response after a newer blocking one is discarded), and loop-continuation (a new auto-poll fires again after the interval)"
  - "nonblocking-dispatch.test.ts — new NBA-06 regression test (internal-state level): a rapid double-toggle of the same control never applies the stale in-flight response, and the coalesced refire's own response is what wins"
  - "checkbox-rapid-toggle.test.ts — NBA-06 proof at the rendered-DOM level: a real jsdom-rendered checkbox, rapidly double-toggled via ViewModelShell + BrowserAdapter, ends with .checked matching the user's last click"
  - "Coalescing section of .planning/design/non-blocking-actions.md refined with the NBA-06 rule as design-of-record"
affects: [any future phase building on the dispatch epoch/coalescing mechanism]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Coalesce-aware epoch gating: a response can be non-stale by seq alone (it's the only one outstanding) yet still be provably obsolete because a coalesced re-fire is queued behind it and guaranteed to fire immediately after — discard on `pendingNonBlockingRefire !== null` as well as `seq >= appliedSeq`."
    - "FAIL-before/PASS-after verification via a temporary single-file git-show restore (not git stash, since the fix was already committed): copy the current fixed file aside, `git show HEAD~1:<file> > <file>` to restore the pre-fix version, run the new test to confirm it fails with the predicted symptom, then restore the fixed file and re-run to confirm it passes."
    - "Controllable/deferred fetch mock (first call resolves immediately with the seed load response, every subsequent call registers a deferred resolver) reused across three different test files (nonblocking-dispatch, poll-fold, checkbox-rapid-toggle) to get full manual control over response arrival order, including through the real BrowserAdapter DOM-rendering path."

key-files:
  created:
    - "viewmodel-shell/test/poll-fold.test.ts"
    - "viewmodel-shell/test/checkbox-rapid-toggle.test.ts"
  modified:
    - "viewmodel-shell/src/index.ts — performRoundTrip's non-blocking apply gate; appliedSeq field doc; ShellOptions.pollInterval doc; schedulePoll doc comment"
    - "viewmodel-shell/test/nonblocking-dispatch.test.ts — new NBA-06 describe block"
    - ".planning/design/non-blocking-actions.md — Coalescing section, NBA-06 refinement paragraph"

key-decisions:
  - "NBA-05 required no code change — Phase 14 already routed poll through the non-blocking lane via silent=true. The only remaining gap was proof (a real-timer test, not a manual dispatch(poll,true) call) and documentation, both closed without touching schedulePoll's logic."
  - "NBA-06's fix is a single added clause (`&& this.pendingNonBlockingRefire === null`) to the existing non-blocking apply gate, reusing the Phase-14 pendingNonBlockingRefire field with no wire change and no touch to the blocking (CR-02) arm."
  - "Since the NBA-06 code fix was committed in Task 1 (a separate commit from the Task 2 tests), the FAIL-before/PASS-after verification used git show HEAD~1:<file> to temporarily restore the pre-fix index.ts (not git stash, which only applies to uncommitted changes) — confirmed the predicted failure symptom exactly, then restored the fix."
  - "Test-file leaked-timer fix (discovered during Task 2): each poll-fold.test.ts test calls shell.stopPolling() at the end, because every applied response (including the blocking one used to prove coexistence) reschedules another poll via schedulePoll — an un-stopped timer from one test was bleeding an extra fetch call into the next test's global fetch stub."

patterns-established:
  - "A dispatch-loop test that fires a coalescing dispatch a second time must NOT rely on awaiting that second call's own returned promise to observe the coalesced refire's completion — the coalescing branch resolves its promise immediately (before firing anything). Use a microtask-drain wait (`await new Promise(r => setTimeout(r, 0))`) after resolving the refire's deferred response instead."

requirements-completed: [NBA-05, NBA-06]

# Metrics
duration: ~25min
completed: 2026-07-08
---

# Phase 15 Plan 1: Poll-Fold NBA-05 Proof + NBA-06 Coalesce-Pending Discard Fix Summary

**Added a single clause to the non-blocking dispatch apply gate (`pendingNonBlockingRefire === null`) closing the rapid-double-toggle checkbox-revert bug, and proved poll-vs-blocking coexistence end-to-end through the real `pollInterval`/`setTimeout` path rather than manual dispatch calls.**

## Performance

- **Duration:** ~25 min (plan creation to final task commit)
- **Started:** 2026-07-08T15:28:14Z
- **Completed:** 2026-07-08T15:50:35Z
- **Tasks:** 3
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Fixed the real, live-traced NBA-06 concurrency defect: a rapid double-toggle of the same non-blocking control (e.g. a selection checkbox) could apply a stale in-flight response's echo, reverting the user's second click AND poisoning the coalesced re-fire's own request with the wrong value — the exact 0.15.0 `selection.action` failure mode.
- Proved NBA-05 (poll coexists with a blocking action, doesn't get dropped, keeps rescheduling) through the REAL `ShellOptions.pollInterval` → `setTimeout` → auto-dispatch path, not just Phase 14's manual `dispatch({name:"poll"}, true)` calls.
- Proved the NBA-06 fix at both the internal-state level and the rendered-DOM level (a real jsdom checkbox via `ViewModelShell` + `BrowserAdapter`), so the ROADMAP Phase 15 Success Criteria are demonstrated, not just implied.
- Recorded both refinements as design-of-record in `.planning/design/non-blocking-actions.md`, matching the discipline of the Phase 14 gap-closure entries.
- Full suite (46 test files, 528 tests) stays green with zero regressions; `check:core-globals` and `tsc --noEmit` both clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: NBA-06 coalesce-pending discard fix + NBA-05 doc clarifications + design-doc update** - `9bd5381` (fix)
2. **Task 2: NBA-05 real-timer poll-fold tests + NBA-06 coalesce-pending-discard regression test** - `645f8a0` (test)
3. **Task 3: adapter/jsdom-level proof — a rapid checkbox double-toggle never permanently reverts** - `659f5ee` (test)

**Plan metadata:** (this commit) `docs: complete plan`

## Files Created/Modified

- `viewmodel-shell/src/index.ts` — non-blocking apply gate now requires `seq >= appliedSeq && pendingNonBlockingRefire === null`; `appliedSeq` field doc extended with the NBA-06 rationale; `ShellOptions.pollInterval` and a new doc comment above `schedulePoll` document NBA-05 (poll always rides the non-blocking lane)
- `viewmodel-shell/test/poll-fold.test.ts` (new) — real-timer NBA-05 coexistence/stale-discard/loop-continuation tests
- `viewmodel-shell/test/nonblocking-dispatch.test.ts` — new "Phase 15 (NBA-06)" describe block, internal-state regression test
- `viewmodel-shell/test/checkbox-rapid-toggle.test.ts` (new) — rendered-DOM proof via `ViewModelShell` + `BrowserAdapter` in jsdom
- `.planning/design/non-blocking-actions.md` — "Refinement (Phase 15, NBA-06)" paragraph appended to the Coalescing section

## Decisions Made

- NBA-05 was verify-then-document only (per the plan) — no `schedulePoll` logic change; the delta was a real-timer test plus doc comments citing NBA-05.
- NBA-06's fix stays minimal and purely client-side: one added boolean clause to an existing conditional, reusing the Phase-14 `pendingNonBlockingRefire` field, with zero wire/`.NET`/parity impact — matching the plan's hard exclusions.
- FAIL-before/PASS-after verification used `git show HEAD~1:<file>` to temporarily restore the pre-fix `index.ts` (rather than `git stash`, since Task 1's fix was already committed by the time Task 2 ran) — confirmed the new NBA-06 test failed with the exact predicted symptom (`state` equalling the stale echo `{tag:"stale-A"}`) before the fix, and all tests passed after restoring it. `index.ts` was fully restored to its committed (fixed) state before the Task 2 commit; `git status` showed zero diff on it at that point.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Leaked poll timer bled a fetch call across tests in poll-fold.test.ts**
- **Found during:** Task 2 (writing/running `poll-fold.test.ts`)
- **Issue:** Every applied response (including the blocking response used to prove coexistence) reschedules another poll via `schedulePoll` inside `processResponse`. Without explicit cleanup, that rescheduled timer from one test's shell instance fired during a LATER test, hitting that later test's global `fetch` stub and inflating its call count (`expected 3 to be 2`).
- **Fix:** Added `shell.stopPolling()` (an existing public method) at the end of each `poll-fold.test.ts` test body to cancel any pending timer before the test completes.
- **Files modified:** `viewmodel-shell/test/poll-fold.test.ts`
- **Verification:** Re-ran both `poll-fold.test.ts` tests together — both pass with the expected call counts; no cross-test bleed.
- **Committed in:** `645f8a0` (Task 2 commit)

**2. [Rule 1 - Bug] Test bug: awaiting the wrong promise to observe the coalesced refire's completion**
- **Found during:** Task 2 (writing the NBA-06 regression test in `nonblocking-dispatch.test.ts`)
- **Issue:** The coalescing dispatch call (toggle B) resolves its OWN returned promise immediately, before the refire's actual network round trip even fires — so `await`ing that promise after resolving the refire's deferred response did nothing, and the assertion `expect(shell.getCurrentState()).toEqual({tag:"applied-B"})` saw stale state (`{}`) because the refire's response processing hadn't run yet.
- **Fix:** Replaced the reliance on awaiting the second dispatch's own promise with a microtask-drain wait (`await new Promise(r => setTimeout(r, 0))`) after resolving the refire's deferred response, matching the pattern already used elsewhere in the same file and in `pending-label.test.ts`.
- **Files modified:** `viewmodel-shell/test/nonblocking-dispatch.test.ts`
- **Verification:** Test passes reliably; `checkbox-rapid-toggle.test.ts` (Task 3) used the correct pattern from the outset and passed on the first run.
- **Committed in:** `645f8a0` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — test-harness bugs discovered while writing/running the new tests, not framework code bugs)
**Impact on plan:** Both fixes are confined to the new test files; no change to plan scope, no change to `viewmodel-shell/src/index.ts` beyond what Task 1 specified.

## Issues Encountered

None beyond the two auto-fixed test-harness issues above (documented as deviations rather than separate issues, since they were fully resolved inline while executing Task 2).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both ROADMAP Phase 15 Success Criteria (#1 NBA-05, #2 NBA-06) are now proven end-to-end, not just theoretically implied by Phase 14's internals-only tests.
- No wire-level change, no new `ActionEvent`/`ShellResponse` field, and no `.NET`/parity-fixture changes were made — this plan stayed strictly TS-client-only per the phase's hard exclusions, so no cross-backend parity re-run was required.
- The design doc (`.planning/design/non-blocking-actions.md`) now carries both refinements as design-of-record for any future phase building on the dispatch epoch/coalescing mechanism (e.g. an admission barrier, per the doc's "Admission — staged, not built speculatively" section).

---
*Phase: 15-poll-fold-selection-action-resurrection*
*Completed: 2026-07-08*
