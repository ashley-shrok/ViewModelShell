---
phase: 15-poll-fold-selection-action-resurrection
reviewed: 2026-07-08T12:10:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/test/poll-fold.test.ts
  - viewmodel-shell/test/nonblocking-dispatch.test.ts
  - viewmodel-shell/test/checkbox-rapid-toggle.test.ts
  - viewmodel-shell/agent-skill.md
  - viewmodel-shell-dotnet/AgentSkill.md
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-07-08T12:10:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found (no blockers — one non-blocking quality concern + two informational notes)

## Summary

Phase 15 changes exactly one production line: the non-blocking apply gate in
`ViewModelShell.performRoundTrip` gained a second conjunct,
`this.pendingNonBlockingRefire === null`, alongside the existing
`seq >= this.appliedSeq` check. Everything else in the diff is documentation
(JSDoc + the two byte-identical `agent-skill.md`/`AgentSkill.md` copies + the
design doc) or new tests.

I traced the fix against the full dispatch loop (`dispatch()`,
`performRoundTrip()`, the two `finally` blocks, `processResponse()`, and
`browser.ts`'s `checkbox()` handler) rather than trusting the plan's narrative,
and independently reproduced the FAIL-before/PASS-after claim by temporarily
restoring the pre-fix `index.ts` via `git show 9bd5381~1:...` and re-running
the new NBA-06 regression test — it fails with the exact predicted symptom
(`state` stuck at the stale echo `{tag:"stale-A"}`) before the fix and passes
after, matching the SUMMARY's account.

**Correctness verdict:** the fix is sound. It cannot wedge the dispatch loop —
the `finally` block in `dispatch()`'s non-blocking branch (lines ~1237-1250)
unconditionally clears `nonBlockingInFlight`, reads and clears
`pendingNonBlockingRefire`, and re-dispatches the queued refire regardless of
whether the gate applied or discarded the just-arrived response, so a queued
refire is always guaranteed to fire next and eventually apply once toggling
stops. The blocking (`else`) arm is byte-for-byte untouched — confirmed via
diff — so CR-02's "always applies unconditionally" guarantee is intact. Full
suite (46 files / 528 tests) is green, `tsc --noEmit` is clean, and the
`check:core-globals` guard passes (no platform globals leaked into `index.ts`,
consistent with test files being out of the guard's scope). The two
`agent-skill.md` copies are verified byte-identical.

The one WARNING below is a documentation-precision issue in the new JSDoc/design-doc
prose (the stated rationale is narrower than what the code actually does), not
a functional defect — I found no case where the broader actual behavior causes
incorrect output, only a discrepancy between the written justification and the
implemented condition scope.

## Warnings

### WR-01: The NBA-06 doc comments justify the fix only for same-control toggles, but the code discards for *any* queued non-blocking refire, regardless of which action it is

**File:** `viewmodel-shell/src/index.ts:960-972` (the `appliedSeq` field doc)
and `viewmodel-shell/src/index.ts:1117-1129` (the inline comment at the apply
gate), plus `.planning/design/non-blocking-actions.md:121-141`

**Issue:** `pendingNonBlockingRefire` is a single, global slot shared across
*all* non-blocking dispatches — it is not scoped to "the same control" or
even "the same action name." The new gate condition
(`this.pendingNonBlockingRefire === null`) therefore discards an
about-to-apply non-blocking response whenever *any* other non-blocking
trigger fired while it was in flight — e.g. checkbox A's response can be
discarded because an unrelated checkbox B (or a poll tick, since
`schedulePoll` always dispatches non-blocking per NBA-05) coalesced behind it
— not only in the "rapid double-toggle of the SAME control" scenario the
prose walks through. Both the field doc ("toggle A ... toggle B ... on the
same control") and the design doc's Coalescing refinement ("a rapid
double-toggle of the SAME control") describe and justify the fix purely in
terms of the same-control interleaving.

This does not appear to be a correctness bug given the framework's
"stateless, whole-tree-recomputed-every-request" model (the queued refire —
whatever action it is — reads `this.currentState` fresh at its own fire time
and will carry forward any local optimistic write, and the server recomputes
all server-observable view content from scratch on every request per the
architecture doc). But the documentation, read literally, describes and
justifies a narrower rule than the one actually implemented, which will
mislead a future maintainer reasoning about the gate's blast radius (e.g.
someone extending coalescing to be per-action-name-scoped later, or debugging
"why did my poll's fresh data get dropped even though nothing about the
checkbox changed").

**Fix:** Broaden the doc language to state the actual, global scope of the
gate — e.g. "...whenever *any* coalesced non-blocking re-fire is queued (the
single global `pendingNonBlockingRefire` slot is shared across all
non-blocking triggers, not scoped to the responding action), not only when
the queued refire happens to target the same control" — and keep the
same-control double-toggle as the motivating *example*, not the stated scope
of the fix.

## Info

### IN-01: `poll-fold.test.ts`'s real-timer waits are duration-based and could flake under CI load

**File:** `viewmodel-shell/test/poll-fold.test.ts:91, 137, 158`

**Issue:** The three real-`setTimeout` waits (`await new Promise(r => setTimeout(r, 30))` against a `pollInterval: 10`) assume a ~3x margin is always enough for the timer to fire and the microtask queue to drain under real wall-clock scheduling. This matches the codebase's existing convention (`busy.test.ts` uses the same style, per the plan's own read_first pointer), so it's not a new pattern introduced by this phase, and CI here has evidently been stable with it. Flagged only because it's a source of rare, hard-to-reproduce CI flakiness inherent to real-timer tests (vs. `vi.useFakeTimers()`), which the plan explicitly chose not to introduce for this file. No action needed beyond awareness if this file is ever seen to flake.

**Fix:** None required now; if flakiness is observed later, consider widening the margin further or migrating to fake timers for this file specifically.

### IN-02: `stopPolling()` cleanup is manual per-test and easy to forget when this file is extended

**File:** `viewmodel-shell/test/poll-fold.test.ts:117, 163`

**Issue:** The SUMMARY documents that a leaked poll timer from one test bled a fetch call into the next test before `shell.stopPolling()` was added at the end of each test body. This is now handled correctly in both existing tests, but the mitigation is opt-in per test (an explicit trailing call) rather than structural (e.g. an `afterEach` that tracks and stops the shell instance created in that test). A future test added to this file that forgets the trailing `shell.stopPolling()` will silently reintroduce the exact cross-test bleed already discovered and fixed once in this phase.

**Fix:** Consider capturing the shell instance in a per-test variable, or an `afterEach(() => currentShell?.stopPolling())` pattern, so the guard is structural rather than relying on every future test author remembering it — optional given the file's current small size, but worth doing if `poll-fold.test.ts` grows more test cases.

---

_Reviewed: 2026-07-08T12:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
