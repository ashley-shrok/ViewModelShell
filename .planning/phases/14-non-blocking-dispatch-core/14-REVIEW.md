---
phase: 14-non-blocking-dispatch-core
reviewed: 2026-07-08T13:57:56Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell-dotnet/ViewModels.cs
  - demo/FeatureProbe-bun/handler.ts
  - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
  - parity/fixtures/feature-probe.json
  - viewmodel-shell/test/nonblocking-dispatch.test.ts
  - viewmodel-shell/test/blocking-propagation.test.ts
  - viewmodel-shell-dotnet/Tests/ActionDescriptorBlockingSerializationTests.cs
findings:
  critical: 2
  warning: 2
  info: 1
  total: 5
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-07-08T13:57:56Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 14 replaces the single `dispatching` mutex in `ViewModelShell.dispatch()` with two
independent in-flight lanes (`blockingInFlight` / `nonBlockingInFlight`), adds NBA-02
coalescing (`pendingNonBlockingRefire`) and an NBA-03 client-side epoch
(`dispatchSeq`/`appliedSeq`), threads the `blocking` field through all 9 previously-truncating
`browser.ts` trigger call sites, and lands the byte-aligned `.NET` wire twin
(`ActionDescriptor.Blocking`, correctly using `bool?` + `WhenWritingNull`). Mechanically the
work is careful: the `.NET` polarity reasoning is correct and well-documented, `browser.ts`'s
9 call-site edits are complete and verified by grep, the epoch gate is applied only on the
success path (never on `ok:false`), and both dispatch-loop `finally` blocks unconditionally
reset their in-flight flags — so there is no lane leak on any error path.

However, tracing the two new concurrency primitives (coalescing + epoch) against every
reachable interleaving surfaces two genuine, provable defects that were not caught by the new
test suite because the tests never mix a *poll* with a *user-triggered* non-blocking dispatch,
and never race a *slow blocking* dispatch against a *fast non-blocking* one arriving later but
resolving first. Both are exactly the classes of bug this review was asked to hunt for
("lane leaks", "lost coalesced refires", "sequence-counter races", "any way a blocking and
non-blocking dispatch can deadlock or drop each other") and both are reachable by any app that
combines `pollInterval` with `blocking:false` triggers, or that has a slow blocking action and
any non-blocking traffic running concurrently — i.e., precisely the target use case this phase
exists to serve (PBMInvoices: live selection refresh + a normal blocking action bar).

## Critical Issues

### CR-01: Coalesced non-blocking refire loses its own dispatch classification — can misroute a poll into the blocking lane and silently halt polling

**File:** `viewmodel-shell/src/index.ts:1149-1182`
**Issue:**

The non-blocking lane's coalescing re-fire replays the *pending* action using the `silent`
parameter of the **currently-resolving** `dispatch()` invocation, not the `silent`/`blocking`
classification the coalesced action was originally triggered with:

```ts
if (this.nonBlockingInFlight) {
  this.pendingNonBlockingRefire = action;   // the ACTION is stored, its own "silent"-ness is not
  return;
}
...
this.nonBlockingInFlight = true;
try {
  await this.performRoundTrip(action);
} finally {
  this.nonBlockingInFlight = false;
  const refire = this.pendingNonBlockingRefire;
  this.pendingNonBlockingRefire = null;
  if (refire) void this.dispatch(refire, silent);   // `silent` = the RESOLVING call's own param
}
```

`dispatch()`'s lane selection is `const nonBlocking = silent || action.blocking === false;` — an
OR. This is only safe when the *replayed* action carries its own `blocking: false`. It silently
breaks the moment the two triggers are of different origin:

1. A `blocking:false` user action A fires: `dispatch({name:"live-refresh", blocking:false})`
   (default `silent=false`). Not in flight yet → proceeds, `nonBlockingInFlight=true`, awaits.
2. While A is in flight, the poll timer fires (`schedulePoll` always calls
   `this.dispatch({ name: "poll" }, true)` — index.ts:1351). `nonBlockingInFlight` is true, so
   it coalesces: `this.pendingNonBlockingRefire = { name: "poll" }`. Note: the bare poll action
   has **no** `blocking` field of its own — its non-blocking-ness was carried entirely by the
   `silent=true` *argument*, which is now discarded (only the action object survives).
3. A resolves. A's own `finally` block runs with **A's `silent` value (`false`)**:
   `void this.dispatch({ name: "poll" }, false)`.
4. In this new call, `nonBlocking = false || (undefined === false)` → **`false`**. The poll is
   routed into the **blocking lane**.

Two consequences, both reachable in ordinary combined use of `pollInterval` + `blocking:false`:

- **UX regression / documented-invariant violation:** if `blockingInFlight` and `serverBusy` are
  both false at that moment, the misrouted "poll" proceeds through the blocking lane:
  `blockingInFlight=true; userDispatching=true; syncBusy(); onLoading?.(true);` — i.e. a
  supposedly-invisible background poll now locks the UI (`.vms-busy`) and fires the app's
  loading indicator. This directly contradicts the documented invariant restated in this same
  phase's non-blocking-lane comment ("Deliberately does NOT set userDispatching / call onLoading
  / toggle .vms-busy") and the pre-existing `busy.test.ts` comment ("polls (silent dispatches)
  do NOT toggle setBusy").
- **Silent poll-loop stall (more severe):** if `this.serverBusy` happens to be `true` at that
  moment, the misrouted poll hits `if (this.serverBusy) return;` **before** `performRoundTrip`
  ever runs — so `processResponse` (and therefore `schedulePoll`, which is only ever called
  *from inside* `processResponse`) never fires for this tick. Since polling is self-perpetuating
  (each response schedules the next tick), this can silently stop the entire polling loop dead,
  with no error, no log, nothing — and per the `Adapter.setBusy` doc comment, polls are
  documented as "the only way out of a server-busy state," so this can leave the app stuck
  showing the busy lock indefinitely.

This is asymmetric: the reverse direction (a `blocking:false` action's own trigger coalescing
behind an in-flight *poll*) is safe, because `silent=true || anything` is always `true` — the
bug only manifests when the *resolving* invocation was itself a plain `blocking:false` dispatch
(`silent=false`) and the *coalesced* pending trigger was a bare poll action lacking its own
`blocking` field.

Not covered by the new test suite: `nonblocking-dispatch.test.ts`'s coalescing test only fires
three `blocking:false` actions against each other (never a poll); `busy.test.ts`'s poll test
never interleaves a `blocking:false` action. The specific mixed-origin interleaving above has no
test coverage.

**Fix:** Store the pending refire's own dispatch classification alongside the action instead of
re-deriving it from whichever invocation happens to resolve first, e.g.:

```ts
private pendingNonBlockingRefire: { action: ActionEvent; silent: boolean } | null = null;
...
if (this.nonBlockingInFlight) {
  this.pendingNonBlockingRefire = { action, silent };
  return;
}
...
} finally {
  this.nonBlockingInFlight = false;
  const refire = this.pendingNonBlockingRefire;
  this.pendingNonBlockingRefire = null;
  if (refire) void this.dispatch(refire.action, refire.silent);
}
```

Add a test that interleaves a poll (`pollInterval` configured, or a manual
`dispatch({name:"poll"}, true)`) with a `blocking:false` user action so the mixed-origin
coalescing path is actually exercised.

---

### CR-02: Global cross-lane epoch can silently discard a blocking (user-initiated) dispatch's response

**File:** `viewmodel-shell/src/index.ts:933-940, 1078-1081`
**Issue:**

`dispatchSeq`/`appliedSeq` are a single monotonic pair shared across *both* lanes with no
lane-aware precedence:

```ts
private dispatchSeq = 0;
private appliedSeq = 0;
...
if (seq >= this.appliedSeq) {
  this.appliedSeq = seq;
  this.processResponse(body);
}
```

Because `blockingInFlight` already guarantees at most one blocking round trip is ever in flight,
and `nonBlockingInFlight` + coalescing already guarantee at most one non-blocking round trip is
ever in flight, **neither lane can ever race against itself** — there is no possible in-lane
staleness for the epoch to protect against. The epoch's only real effect is therefore
*cross-lane*, and it is symmetric in a way that actively harms the blocking lane:

- Tested direction (`nonblocking-dispatch.test.ts`, "NBA-03 epoch" describe block): non-blocking
  fires first (lower seq), blocking fires second (higher seq) and resolves first — the later,
  stale non-blocking response is correctly discarded when it eventually arrives. This matches
  the design doc's stated concern ("a stale background response landing after a newer one and
  overwriting the view with old truth").
- **Untested, symmetric-but-harmful direction:** a slow **blocking** dispatch fires first
  (lower seq, e.g. the user clicks Save on a slow endpoint), and a **non-blocking** dispatch
  (e.g. a poll tick, or any `blocking:false` trigger) fires afterward (higher seq) and resolves
  *first* because it's faster. `appliedSeq` advances to the non-blocking dispatch's seq. When
  the user's Save response finally arrives, `seq >= this.appliedSeq` is now false — the gate
  silently discards it. `processResponse` never runs: no re-render, no side effects, no error
  surfaced via `onError`. The busy lock still clears (the `finally` block in the blocking branch
  unconditionally resets `blockingInFlight`/`userDispatching`/`onLoading`), so from the user's
  perspective they clicked a button, watched the UI lock, watched it unlock — and their action
  visibly appears to have done nothing, even though the server almost certainly processed it.

This directly contradicts AGENTS.md's own stated framework philosophy (point 8, "Nothing
important fails quietly... A capability invoked without the means to honor it raises a hard
error rather than doing nothing... Silence is the bug") — here a legitimate, applied,
`ok:true` response to a directly-user-initiated blocking action is dropped with zero signal.
It is also exactly the failure mode called out in this review's brief ("any way a blocking and
non-blocking dispatch can... drop each other").

**Fix:** Since each lane already serializes itself, the epoch only needs to protect the
non-blocking lane against being superseded by a newer blocking response (the one direction the
design doc actually describes and the tests actually cover) — not the reverse. Options:
- Track `appliedSeq` for gating purposes only when applying a **non-blocking** response (compare
  it against the highest seq assigned to *any* dispatch, blocking or non-blocking), while a
  **blocking** response — being provably the only one of its kind ever in flight — always
  applies unconditionally when it arrives (after its own `ok:false`/`stale_client` handling).
- Or: keep a single epoch but bias it (e.g. track `appliedSeq` only from non-blocking
  applications, and never let a non-blocking apply retroactively invalidate an
  already-in-flight blocking response).

Either way, add a test for the currently-untested direction: fire a blocking dispatch, then a
non-blocking one with a later seq, resolve the non-blocking one first, then resolve the
blocking one — and assert the blocking response's state IS applied (or, if the discard is
intentionally kept, that `onError` fires so the drop is not silent).

## Warnings

### WR-01: `agent-skill.md` was not updated for the new `blocking` wire field, per both the design doc and the repo's own maintainer rule

**File:** `viewmodel-shell/agent-skill.md`, `viewmodel-shell-dotnet/AgentSkill.md`
**Issue:** The design of record (`.planning/design/non-blocking-actions.md`, "Both backends +
parity" section) explicitly lists as a deliverable: *"`agent-skill.md` gains a note on
`blocking:false` semantics (then byte-copy to `.NET AgentSkill.md`; the parity gate diffs
both) — an agent driving the wire should know a dispatch can be non-blocking."* Neither file
contains any mention of `blocking` (`grep -n blocking` on both returns nothing). This also
falls under AGENTS.md's own maintainer rule: *"any change to the wire shape... MUST update
`viewmodel-shell/agent-skill.md` in the same change"* — `ActionEvent.blocking` /
`ActionDescriptor.Blocking` is a new field on the wire-carried action descriptor, i.e. a wire
shape addition. No task in any of the three Phase 14 plans addressed this, and no summary
mentions it. The cross-backend "skill-source parity" gate (confirmed green in the 14-03
summary) only diffs the two `agent-skill.md` copies against *each other*, so it cannot catch
this — both are equally silent on the new field, so they still agree.
**Fix:** Add a short section to `viewmodel-shell/agent-skill.md` documenting that a dispatch can
carry `blocking:false` (client-side scheduling hint; server-visible only as a plain boolean on
`_action`... actually note precisely that the wire shape is unaffected server-side — `_action`
still carries `{name}` only, per `index.ts:1023-1026` — so the skill note should clarify this
is purely a tree-authoring concern: "a `ButtonNode`/`CheckboxNode`/etc.'s `action` object may
carry `blocking: false` to make the *client* dispatch this action on a non-blocking lane; this
has no effect on the POST payload your action handler receives"). Byte-copy to
`viewmodel-shell-dotnet/AgentSkill.md` per the existing convention.

### WR-02: `push()`'s in-flight guard is unconditionally stricter than the two-lane design would suggest, with no test coverage for the new (or old) behavior

**File:** `viewmodel-shell/src/index.ts:1186-1187`
**Issue:** `push(response)` still drops any pushed response whenever *either* lane has an
in-flight dispatch: `if (this.blockingInFlight || this.nonBlockingInFlight) return;`. This is
a faithful behavior-preserving rename of the pre-Phase-14 guard (`if (this.dispatching) return;`)
and the plan explicitly scoped it this way ("push has no seq — epoch reconciliation governs
dispatch()-originated round trips only"), so this is not a regression. However, it is worth
flagging because it is now a materially more conservative gate than the rest of Phase 14's
philosophy: a long-running background poll or a `blocking:false` live-refresh action (which,
per NBA-01's whole point, is meant to coexist with everything else) will now cause **every**
SSE/WebSocket push to be dropped for its entire duration, not just during a blocking
round-trip as before. No test in this phase (or pre-existing) exercises `push()` racing a
non-blocking dispatch to confirm this is the intended, accepted tradeoff rather than an
oversight of the "two lanes" framing being applied everywhere except here.
**Fix:** Not necessarily a code change — but this asymmetry should be a deliberate, documented
decision (a one-line comment already gestures at it) and ideally a regression test proving a
push is (correctly, per current design) dropped while a non-blocking dispatch — e.g. a poll —
is in flight, so a future refactor doesn't accidentally "fix" this into a lane-aware guard
without noticing the behavior change.

## Info

### IN-01: Duplicated pre-load guard between the two dispatch lanes

**File:** `viewmodel-shell/src/index.ts:1120-1128` and `1161-1169`
**Issue:** The `if (this.currentState === null) { ... }` guard (identical error message, identical
`onError`-or-`console.error` fallback) is now duplicated verbatim across the blocking and
non-blocking branches of `dispatch()`, where pre-Phase-14 it existed once. This was an explicit,
deliberate plan directive ("Mirrors the blocking lane's pre-load guard, identical error
message"), not an oversight, so it's low priority — but a small private helper (e.g.
`private guardLoaded(name: string): boolean`) would remove the duplication and the risk of the
two copies drifting (e.g. a future error-message wording tweak applied to only one branch).
**Fix:** Optional refactor; extract to a shared private method returning a boolean.

---

_Reviewed: 2026-07-08T13:57:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
