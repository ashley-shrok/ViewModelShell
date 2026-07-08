---
phase: 14-non-blocking-dispatch-core
verified: 2026-07-08T14:05:16Z
status: gaps_found
score: 3/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "NBA-01 (ROADMAP Success Criterion #1): a dispatch with blocking:false runs a silent round-trip that does NOT trip the dispatch mutex or busy-lock; a user action fired while it is in flight is honored, not dropped (and vice versa)."
    status: failed
    reason: >
      Two independently-confirmed, reachable interleavings break this guarantee. Both were
      reproduced live against the actual code (not just traced) with two ad-hoc vitest cases
      run against the real src/index.ts — both bugs fired exactly as predicted, then the
      reproduction file was deleted (not committed) so this report's evidence is copied below
      instead. (1) CR-01: a `blocking:false` action's coalesced refire loses its own dispatch
      classification and can replay through the BLOCKING lane, tripping `setBusy(true)` for a
      supposedly-invisible background poll (or, if the server is busy at that instant, being
      eaten by the `if (this.serverBusy) return;` guard before ever firing — since polling is
      self-perpetuating via `schedulePoll` inside `processResponse`, this silently halts the
      poll loop with zero error, zero log). (2) CR-02: the epoch (`dispatchSeq`/`appliedSeq`) is
      a single counter shared across both lanes with no lane precedence, so when a slow
      *blocking* dispatch fires first and a faster *non-blocking* one (a poll, or any
      `blocking:false` trigger) fires later but resolves first, the user's own blocking
      response is silently discarded on arrival (`seq >= appliedSeq` is false) — no render, no
      `onError`, the busy lock still clears normally, so from the user's perspective they
      clicked a button, watched it lock, watched it unlock, and their action visibly did
      nothing even though the server processed it. Both directions directly contradict the
      literal ROADMAP Success Criterion #1 text ("does NOT trip the dispatch mutex or
      busy-lock" / "honored, not dropped (and vice versa)") and AGENTS.md's own stated
      framework philosophy ("Nothing important fails quietly... Silence is the bug").
    artifacts:
      - path: "viewmodel-shell/src/index.ts"
        issue: >
          Line ~1181: `if (refire) void this.dispatch(refire, silent);` replays the coalesced
          pending action using the RESOLVING invocation's own `silent` parameter instead of the
          pending trigger's own classification — safe only when the pending action itself
          carries `blocking:false` (a poll action has no such field; its non-blocking-ness was
          carried entirely by the discarded `silent=true` argument of ITS OWN original call).
          Lines ~935-940 and ~1078-1081: `dispatchSeq`/`appliedSeq` are a single monotonic pair
          with no lane-aware precedence, so a non-blocking response with a higher seq can
          retroactively invalidate an earlier-fired, still-pending blocking response.
    missing:
      - "Store the pending refire's own dispatch classification alongside the action (e.g. `pendingNonBlockingRefire: { action, silent } | null`) instead of re-deriving it from whichever invocation happens to resolve first, so a coalesced poll always refires as a poll and a coalesced blocking:false action always refires as blocking:false, regardless of which invocation's finally block runs the refire."
      - "Give the epoch lane-aware precedence: either gate `appliedSeq` advancement/comparison only for non-blocking applications (a blocking response — provably the only one of its kind in flight — always applies unconditionally when it arrives, after its own ok:false/stale_client handling), or otherwise ensure a legitimate blocking response is never silently discarded without at least an onError signal."
      - "Add regression tests for both currently-untested interleavings: (a) a poll coalescing behind an in-flight blocking:false user action, asserting the poll's eventual refire does NOT toggle setBusy and does NOT get eaten by a serverBusy gate; (b) a slow blocking dispatch resolving AFTER a later-fired, faster-resolving non-blocking one, asserting the blocking response IS applied (or, if intentionally discarded, that onError fires so the drop is not silent)."
deferred: []
human_verification: []
---

# Phase 14: Non-Blocking Dispatch Core Verification Report

**Phase Goal:** A dispatch can carry `blocking: false` (optional, default `true` → existing apps byte-unchanged). A non-blocking (silent) round-trip no longer occupies the single global dispatch mutex — it coexists with user actions instead of silently dropping them (or being dropped). Rapid non-blocking triggers debounce/coalesce to one in-flight request. A client-side epoch/sequence counter discards stale, out-of-order responses (last-writer-wins) with no wire epoch and no server change. Both backends stay byte-aligned; new parity fixtures exercise a non-blocking dispatch, coalesced rapid fire, and out-of-order discard.

**Verified:** 2026-07-08T14:05:16Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria — the phase's binding contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | NBA-01: a `blocking:false` dispatch runs a silent round-trip that does NOT trip the busy-lock; a user action fired while it is in flight is honored, not dropped (and vice versa) | ✗ **FAILED** | Two confirmed, reachable bugs (CR-01, CR-02 below) violate this in both directions. Independently reproduced live against `src/index.ts` (see "Independent reproduction" below), not just traced. |
| 2 | NBA-02: rapid `blocking:false` triggers coalesce to a single in-flight request (latest wins) | ✓ VERIFIED | `pendingNonBlockingRefire` overwrites (never queues); `nonblocking-dispatch.test.ts`'s "three rapid triggers → one refire, carries refresh-3" test passes and was re-run green. The *coalescing arithmetic* (1 request, latest action name) is correct — **but** the refired request's dispatch-lane classification can be wrong (see Truth 1 / CR-01), which is a distinct defect from the coalescing count itself. |
| 3 | NBA-03: an out-of-order/late non-blocking response is discarded rather than clobbering a newer render, via a client-side sequence counter, no wire field, no server change | ✓ VERIFIED (as literally specified) | The documented/tested direction (late non-blocking response arriving after a newer blocking one has applied) is correctly discarded — `nonblocking-dispatch.test.ts`'s NBA-03 test passes. No wire field was added (`grep -n blocking form.append` in `performRoundTrip` confirms `_action` stays `{name}` only). The mechanism is exactly as the design doc specifies ("last-writer-wins... late/stale responses discarded", stated as a global rule) — the *design itself*, applied symmetrically across lanes with no blocking-lane precedence, is what produces the Truth-1 failure in the untested reverse direction (CR-02). Recorded as a gap under Truth 1, not double-counted here. |
| 4 | NBA-04: `blocking` absent-when-default on both backends; wire token stays `viewmodel-shell/1.0`; `bun run parity/run.ts` green with new fixtures | ✓ VERIFIED | `ActionEvent.blocking?: boolean` (TS) and `ActionDescriptor(string Name, bool? Blocking = null)` with `[JsonIgnore(WhenWritingNull)]` (.NET) both present and correctly polarized (bool?+WhenWritingNull is the right mechanism for a true-is-default field — confirmed by direct read and by the 3 new `ActionDescriptorBlockingSerializationTests` passing: false→present, omitted→absent, true→present). `demo/FeatureProbe-bun/handler.ts` and `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` both carry a `blockingSection` with the omitted-vs-`false` button pair. `bun run parity/run.ts` re-run live: full 8-fixture suite green, "✓ all backends agree" on `feature-probe`. |

**Score:** 3/4 truths verified (Truth 1 / NBA-01 FAILED)

### Critical cross-check — CR-01 and CR-02 from 14-REVIEW.md

Both were independently re-derived from a direct read of `viewmodel-shell/src/index.ts` (not merely relayed from the review), and both were **reproduced live** with two throwaway vitest cases run against the actual, current `dispatch()`/`performRoundTrip()` implementation (the repro file was created, run, its output captured below, then deleted — it is not part of the committed tree).

#### CR-01 — CONFIRMED-REAL. Blocks NBA-01 (and, in effect, the safety of NBA-02's coalescing).

**File/lines:** `viewmodel-shell/src/index.ts:1153-1182` (coalescing slot + refire).

**Exact interleaving:**
1. A `blocking:false` user action fires via the normal render path: `adapter.render(vm, (action) => this.dispatch(action), ...)` calls `dispatch(action)` with the default `silent=false`. `action.blocking===false` → non-blocking lane. `nonBlockingInFlight=true`; awaits `performRoundTrip`.
2. While it's in flight, the poll timer fires: `schedulePoll` unconditionally calls `this.dispatch({ name: "poll" }, true)` — `silent=true`. `nonBlockingInFlight` is already true → coalesces: `this.pendingNonBlockingRefire = { name: "poll" }` (the bare action object; it carries no `blocking` field of its own — its non-blocking-ness lived entirely in the now-discarded `silent=true` *argument* of this specific call).
3. Step 1's dispatch resolves. Its own `finally` block runs with **its own** `silent` value (`false`, since it was entered via the default-`silent` call in step 1): `void this.dispatch(refire, silent)` → `this.dispatch({ name: "poll" }, false)`.
4. In this new invocation: `nonBlocking = silent || action.blocking === false = false || (undefined === false) = false` → routed into the **blocking lane**.

**Reproduced live:** a vitest case fired `shell.dispatch({name:"live-refresh", blocking:false})` then, while in flight, `shell.dispatch({name:"poll"}, true)` (coalesced), then resolved the in-flight response. Captured output:
```
CR-01 repro: setBusyCalls after refire = [ false, true ] fetch calls = 3
CR-01 repro: refire action name = poll
```
`setBusy(true)` fired for the coalesced "poll" refire — i.e. an invisible background poll tripped the busy-lock UI, exactly as CR-01 describes. In the sibling case where `this.serverBusy` happens to be true at that instant, the misrouted poll would instead be eaten by `if (this.serverBusy) return;` *before* `performRoundTrip` ever runs — and since `schedulePoll` is only ever called from inside `processResponse` (itself only reachable via `performRoundTrip`'s success path), this can silently stop the entire polling loop with zero signal.

**Verdict: CONFIRMED-REAL.** Not covered by `nonblocking-dispatch.test.ts` (its coalescing test only fires `blocking:false` actions against each other, never against a poll) or `busy.test.ts` (its poll test never interleaves a `blocking:false` action). Blocks NBA-01's "does NOT trip the busy-lock" clause and undermines the practical safety of NBA-02's coalescing (the coalesced action itself is correct, but its lane can be wrong).

#### CR-02 — CONFIRMED-REAL. Blocks NBA-01.

**File/lines:** `viewmodel-shell/src/index.ts:935-940` (`dispatchSeq`/`appliedSeq` fields), `:1075-1081` (the epoch gate in `performRoundTrip`).

**Exact interleaving:**
1. A blocking dispatch (e.g. `save`) fires first: `performRoundTrip` assigns `seq=1`, network call is slow/pending.
2. While it's in flight, a non-blocking dispatch (a poll tick, or any `blocking:false` trigger) fires: `performRoundTrip` assigns `seq=2`.
3. The non-blocking one (seq 2) resolves first (faster round trip): `2 >= appliedSeq(0)` → true → `appliedSeq=2`; `processResponse` applies it.
4. The blocking one (seq 1) then resolves: `1 >= appliedSeq(2)` → false → **discarded**. `processResponse` never runs. The blocking lane's `finally` still unconditionally clears `blockingInFlight`/`userDispatching`/`onLoading`/busy — so the UI locks, then unlocks, with no visible effect and no error.

**Reproduced live:** a vitest case fired `shell.dispatch({name:"save"})` (blocking, seq 1) then `shell.dispatch({name:"poll"}, true)` (non-blocking, seq 2), resolved the non-blocking one first, then the blocking one. Captured output:
```
CR-02 repro: final state = { tag: 'poll-applied' } onError calls = 0
```
The user's own `save` response (`{tag:"save-applied"}`) was silently discarded — final state stayed at the poll's stale-by-comparison value, and `onError` was never invoked.

**Verdict: CONFIRMED-REAL.** Not covered by `nonblocking-dispatch.test.ts`'s NBA-03 test (which only exercises the reverse ordering: non-blocking fires first, blocking fires second and resolves first — the tested direction is safe; this untested, symmetric-but-harmful direction is not). Directly contradicts AGENTS.md's own stated framework philosophy (point 8: "Nothing important fails quietly... Silence is the bug") and ROADMAP Success Criterion #1's explicit "(and vice versa)" clause — this untested direction *is* the vice-versa case.

**Both findings independently re-derived and reproduced, not merely relayed from 14-REVIEW.md.** Both are BLOCKER-severity: they are reachable in the exact combined use case the design doc itself calls out as the motivating scenario (PBMInvoices: a slow blocking action bar alongside live, frequent non-blocking selection/poll traffic), not exotic edge cases.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `viewmodel-shell/src/index.ts` | `ActionEvent.blocking?`, two-lane dispatch loop, `performRoundTrip()`, epoch/coalescing | ✓ Exists, substantive, wired | All required identifiers present (`blockingInFlight`, `nonBlockingInFlight`, `pendingNonBlockingRefire`, `dispatchSeq`, `appliedSeq`, `performRoundTrip`); `grep -n "this\.dispatching"` returns nothing (old mutex fully removed). Functionally wired end-to-end, but with the two logic defects above under specific interleavings — not a stub, a real bug. |
| `viewmodel-shell/src/browser.ts` | every `ActionEvent`-bearing call site forwards the full descriptor | ✓ Exists, substantive, wired | `grep -n "on({ name:"` returns nothing — all 9 call sites forward the full object as the plan specifies. |
| `viewmodel-shell/test/nonblocking-dispatch.test.ts` | NBA-01/02/03 coverage | ✓ Exists, substantive | 4 describe blocks, all passing; does NOT cover the CR-01/CR-02 mixed-origin/mixed-lane-ordering interleavings (confirmed by direct read — see gap). |
| `viewmodel-shell/test/blocking-propagation.test.ts` | `blocking:false` propagation from 5 node types | ✓ Exists, substantive, wired | 5 tests, all passing, real DOM events via `BrowserAdapter`. |
| `viewmodel-shell-dotnet/ViewModels.cs` | `ActionDescriptor(string Name, bool? Blocking = null)` + `WhenWritingNull` | ✓ Exists, substantive, wired | Correct polarity reasoning (bool?+WhenWritingNull, not bool+WhenWritingDefault) confirmed by direct read of the doc comment and the mechanism. |
| `viewmodel-shell-dotnet/Tests/ActionDescriptorBlockingSerializationTests.cs` | 3 serialization tests | ✓ Exists, substantive, wired | All 3 pass; confirmed via a full `dotnet test` run (102/102 on the framework Tests project). |
| `demo/FeatureProbe-bun/handler.ts`, `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`, `parity/fixtures/feature-probe.json` | `blockingSection` static wire-shape proof | ✓ Exists, substantive, wired | Both backends carry `blockingSection`; `bun run parity/run.ts` (re-run live) confirms byte-identical wire shape. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `dispatch()` | `performRoundTrip()` | `await this.performRoundTrip(action)` | ✓ WIRED | Confirmed by direct read, both lanes. |
| non-blocking lane `finally` | `dispatch()` (recursive refire) | `void this.dispatch(refire, silent)` | ⚠️ WIRED BUT DEFECTIVE | The link exists and fires, but replays with the wrong classification under the CR-01 interleaving (see gap). |
| `browser.ts` trigger sites | `index.ts dispatch()` | `on(<fullActionObject>)` | ✓ WIRED | `grep -c "on({ name:"` is 0; all forward the full object. |
| `.NET ActionDescriptor` | serialization tests | `JsonSerializer.Serialize<ViewNode>` | ✓ WIRED | 3/3 tests pass. |
| FeatureProbe `blockingSection` (both backends) | `parity/run.ts` diff | existing GET steps | ✓ WIRED | Confirmed live: byte-identical across dotnet-probe/bun-probe/node-probe. |

### Behavioral Spot-Checks / Reproductions

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full TS vitest suite | `cd viewmodel-shell && npx vitest run` | 44 files, 522 passed, 1 skipped | ✓ PASS |
| Core platform-agnosticism guard | `npm run check:core-globals` | AGNOSTIC-03 clean | ✓ PASS |
| Cross-backend parity | `PATH="$HOME/.dotnet:$PATH" bun run parity/run.ts` (from `parity/`) | 8-fixture suite green, `✓ all backends agree`, skill parity green | ✓ PASS |
| .NET framework tests | `dotnet test viewmodel-shell-dotnet/Tests` | 102/102 | ✓ PASS |
| All 5 demo `.Tests.csproj` | `dotnet test <each>` | 28+39+33+52+29 = 181/181 | ✓ PASS |
| CR-01 reproduction (poll coalesced behind blocking:false, refires into blocking lane) | ad-hoc vitest case against live `src/index.ts` | `setBusyCalls` includes `true` for the coalesced poll refire | ✗ CONFIRMS BUG |
| CR-02 reproduction (blocking response silently discarded by a faster later non-blocking one) | ad-hoc vitest case against live `src/index.ts` | final state stuck at the non-blocking value; `onError` never called | ✗ CONFIRMS BUG |

Note: the green automated-suite results above are all genuinely green — they are not in dispute. The gap is that the suite, as currently written, does not exercise either of the two interleavings that CR-01/CR-02 describe, so "all tests pass" does not mean "the mechanism is correct under all reachable orderings."

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| NBA-01 | 14-01 | Coexistence — replace the single mutex | ✗ **BLOCKED** | CR-01 and CR-02, both confirmed reachable and reproduced. |
| NBA-02 | 14-01 | Coalescing/latest-wins | ✓ SATISFIED (coalescing arithmetic) — see caveat under NBA-01 | `pendingNonBlockingRefire` correctly overwrites and carries the latest trigger; the *lane* the refire is classified into can be wrong (that defect is attributed to NBA-01, not double-counted here). |
| NBA-03 | 14-01 | Client-side epoch discards stale/out-of-order | ✓ SATISFIED (as literally specified) — design-level symmetry issue attributed to NBA-01 | Tested direction correct; untested reverse direction (CR-02) is a consequence of the epoch design being global/symmetric rather than lane-aware, recorded once under NBA-01. |
| NBA-04 | 14-02, 14-03 | `blocking` absent-when-default on both backends, parity green | ✓ SATISFIED | Both backends correct, parity green, 3 new .NET serialization tests + FeatureProbe fixture. |

No orphaned requirements — REQUIREMENTS.md's traceability table maps exactly NBA-01..04 to Phase 14, and all four appear in the plans' `requirements:` frontmatter.

### Anti-Patterns Found

None of TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER found in the phase's modified files. No stub returns, no hardcoded empty data. The two confirmed issues (CR-01, CR-02) are logic/concurrency defects, not incompleteness markers — the code is fully implemented, just incorrect under two specific, reachable interleavings.

**Warnings from 14-REVIEW.md (not phase-14-blocking, recorded for completeness):**
- **WR-01** (`agent-skill.md` not updated for `blocking:false`): correctly out of scope for Phase 14 — REQUIREMENTS.md explicitly maps **NBA-07** ("`agent-skill.md` documents `blocking:false` semantics... byte-copy to `.NET AgentSkill.md`") to **Phase 15**, and Phase 15's ROADMAP entry repeats this exact deliverable. Confirmed via `grep -n -i blocking` on both `agent-skill.md` files (both silent, matching each other, so parity itself doesn't regress — the gap is a missing feature note, correctly deferred, not a Phase 14 gap).
- **WR-02** (`push()`'s in-flight guard is stricter than the two-lane framing elsewhere): a deliberate, plan-documented scope boundary ("push has no seq — epoch reconciliation governs dispatch()-originated round trips only"), not a Phase 14 regression. No test exists proving this is intentional rather than an oversight — worth a regression test in a future phase, not a blocker here.
- **IN-01** (duplicated pre-load guard): explicit, deliberate plan directive, not an oversight.

### Human Verification Required

None — both confirmed issues are deterministic, reproducible via unit tests (as demonstrated above), not matters of visual/UX judgment.

### Gaps Summary

Phase 14 successfully delivers the *shape* of the non-blocking dispatch primitive on both backends — the wire field, the two in-flight lanes, the coalescing slot, the epoch counter, full `browser.ts` propagation, and cross-backend parity are all real, substantive, and correctly wired. NBA-02's coalescing arithmetic and NBA-04's wire-shape parity are genuinely solid.

However, the phase's own goal statement and ROADMAP Success Criterion #1 promise something stronger than what the current code delivers: that a blocking and a non-blocking dispatch **never drop or silently discard each other's outcome**. Two independently-reproduced defects in the core mechanism — the coalesced-refire losing its own dispatch classification (CR-01), and the global (not lane-aware) epoch silently discarding a legitimate blocking response superseded in wall-clock time by a faster background one (CR-02) — mean this promise does not hold under two realistic, reachable interleavings that combine ordinary poll traffic with `blocking:false` user actions, or a slow blocking mutation with any concurrent non-blocking traffic. Both are exactly the target use case (PBMInvoices) the design doc was written to serve, and both violate AGENTS.md's explicit "nothing important fails quietly" principle: a background poll can silently stall forever, and a user's own Save can silently vanish with the busy lock clearing normally, giving zero indication anything went wrong.

Both defects are narrowly scoped (one refire-classification fix, one epoch lane-precedence fix) and the review's suggested fixes are directly actionable. This is not a rewrite — it's closing two real gaps in an otherwise well-built mechanism, plus adding regression tests for the two now-proven-reachable interleavings.

---

_Verified: 2026-07-08T14:05:16Z_
_Verifier: Claude (gsd-verifier)_
