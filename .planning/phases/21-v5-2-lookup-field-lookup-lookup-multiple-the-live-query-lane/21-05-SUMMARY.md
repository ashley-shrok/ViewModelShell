---
phase: 21-v5-2-lookup-field-lookup-lookup-multiple-the-live-query-lane
plan: 05
subsystem: test
tags: [lookup, live-query, non-blocking-lane, races, interleaving, mutation-testing]
requires:
  - "21-04 (the 300ms debounced, renderer-forced non-blocking searchAction)"
  - "the v4.2 non-blocking lane (Phases 14/15) — CALLED and MUTATED-FOR-PROOF, never changed"
provides:
  - "the four scripted adversarial interleavings, each FAIL-before/PASS-after"
  - "the fake-timers + deferred-fetch harness (the phase's one genuinely new test technique)"
  - "realTick() — the drain seam that makes the two combine"
  - "OPEN-4 closed: discard-only, on the two-suppressor arithmetic"
  - "the Phase 17 admission-barrier question CLOSED: not the signal, stays deferred"
affects:
  - "21-06+ (the chips layer inherits this harness for any race of its own)"
tech-stack:
  added: []
  patterns:
    - "fake timers + deferred fetch, bridged by a real-macrotask drain captured pre-useFakeTimers"
    - "mutation-verified race tests: a race that survives its mutation is a broken test, not a passing one"
    - "every negative assertion paired with a positive one so a regressed drain cannot pass vacuously"
key-files:
  created:
    - viewmodel-shell/test/lookup-search-races.test.ts
  modified: []
decisions:
  - "OPEN-4 = DISCARD-ONLY for v1. No AbortController. Two independent suppressors (debounce + coalesce slot) cap a typing burst at ~2 requests, not per-keystroke."
  - "Phase 17 admission barrier: NOT the signal. A lookup is a single self-throttled producer that WANTS to be superseded; a barrier would serve a producer happiest being dropped."
  - "Race 4 is written in TWO forms because two searches can NEVER be concurrently in flight through field()'s path — the plan's literal script is not constructible. See Flags."
  - "RACE 3's 'latest wins' is asserted on _state.ownerQuery, not the action name: for a lookup the action is identical every keystroke; the query is the only thing that can prove it."
metrics:
  duration: ~35 min
  tasks: 2
  commits: 2
  files: 1
  tests_added: 8
  completed: 2026-07-16
---

# Phase 21 Plan 05: The four adversarial interleavings Summary

The live-query lane is now proven correct **under adversarial interleaving**, not merely green: four
races scripted through `field()`'s own search path with deliberately out-of-order response arrival,
each proven able to fail against the mutation that should break it.

## What landed

| Task | Commit | What |
|---|---|---|
| 1 | `95a704c` | The fake-timers + deferred-fetch harness + `realTick()`; proven able to fail |
| 2 | `b1e1ed7` | The four races (6 tests), each FAIL-before/PASS-after under 5 distinct mutations |

**Tests:** 711 → **719 passing, 1 skipped** (8 added). Sole file:
`viewmodel-shell/test/lookup-search-races.test.ts`. **No implementation file was changed** — every
mutation was applied for proof and reverted byte-identically.

## Verification

- `npx vitest run` — **719 passed | 1 skipped**, 56 files.
- `npx tsc --noEmit` — clean.
- `npm run check:core-globals` — passes.
- `grep -c "shell.dispatch(" test/lookup-search-races.test.ts` → **0**.
- `diff -q /tmp/vms-race-snap/index.ts.orig src/index.ts` → **silent**.
- `diff -q /tmp/vms-race-snap/browser.ts.orig src/browser.ts` → **silent**. (Per-file snapshot, NOT
  `git diff` — see the plan's note on why a tree-wide diff can never pass here.)

## The harness self-test (Task 1) — TWO proofs, and the second is the one that matters

**Proof 1 — a deliberately wrong expectation goes red.** Asserting the popup shows candidates from a
response that was never resolved:

```
AssertionError: expected [ 'Sara Vance' ] to deeply equal [ 'THROWAWAY — never resolved' ]
```

**Proof 2 — the flush is LOAD-BEARING, not decoration.** Downgrading `realTick()` from a real
macrotask turn to `Promise.resolve()` — *exactly the "unnecessary await" a future reader would
delete* — makes the popup assertion fail:

```
AssertionError: expected [] to deeply equal [ 'Sara Vance' ]
```

The popup never updates at all without the drain. **Good news, recorded because it shaped the
tests:** the harness degrades **loudly** on a *positive* assertion — but it would degrade **silently**
on a negative one (`not.toContain` passes trivially against an empty popup). Races 3 and 4 lean
heavily on negative assertions, so **every negative assertion in this file is paired with a positive
one** that pins the drain. Without that pairing, a regressed flush would turn the two most important
races into green no-ops. This is the T-21-18 failure mode, and it was live here.

## Per-race mutation / red output / green-after

All five mutations reverted; all races green after.

| Race | Mutation applied | Observed RED |
|---|---|---|
| **1** user-action-races-background (both directions) | `browser.ts`: `on({...searchAction, blocking: true})` — undo D11 | `expected 2 to be 3` ×2 — the third fetch never fired; the search took the blocking lane and `blockingInFlight` swallowed the user's click (dir A) and the search (dir B) |
| **2** background-resolves-first | `index.ts`: blocking arm gated `if (seq >= this.appliedSeq)` — a symmetric epoch | `expected 'sa' to be 'Priya Raman'` — **the user's pick vanished; the box still shows their half-typed query.** The v4.2 defect, reproduced at composition level |
| **3** rapid-fire-supersede | `index.ts`: coalesce slot removed — every trigger fires its own request (append) | `expected 4 to be 2` — three concurrent searches instead of one coalesced re-fire (the T-21-17 DoS) |
| **4a** stale-arrives-late (vs newer blocking) | `index.ts`: dropped `seq >= this.appliedSeq` from the non-blocking arm | `expected 'sa' to be 'Priya Raman'` — the stale search clobbered the newer render |
| **4b** stale-arrives-late ("type sar, see sa") | `index.ts`: dropped `this.pendingNonBlockingRefire === null` (NBA-06) | `expected [ 'Sara Vance', 'Samuel Ortiz' ] to not include 'Sara Vance'` — **the abandoned query's answers filled the popup.** The literal bug |

**4a and 4b are non-redundant, and the mutations prove it:** 4a's mutation broke form A while form B
stayed green; 4b's mutation broke form B while form A stayed green. Each form pins its own guard.
Had they been redundant, one mutation would have reddened both.

**No race failed on the unmutated implementation.** Plan 21-04's composition is correct as landed —
the design's "the first implementation of concurrency is almost never right" did not bite here, and
that is now a *demonstrated* claim rather than an untested assumption.

## Decision records

### OPEN-4 — stale-response handling ⇒ **DISCARD-ONLY for v1. No `AbortController`, no cancellation.**

The design worried a per-keystroke directory search against a 5,000-person directory is real server
load. **The arithmetic says otherwise, and the arithmetic is the point of recording this:** that
concern applies only to requests *already in flight*, and **two independent suppressors stack before
a request ever exists**:

1. **The 300ms debounce** (21-03/21-04) suppresses most keystrokes *before they reach dispatch at
   all* — a fast typist produces roughly one dispatch per word, not per character.
2. **The lane's latest-wins coalescing slot** (index.ts:1546-1554) means rapid triggers never produce
   more than **2 concurrent requests total** — one in flight, one queued, overwrite-never-append.

⇒ Realistic worst case is **~2 requests per typing burst**, not per keystroke. **RACE 3 now measures
this rather than assuming it**: three full-debounce-separated searches produced exactly **2** requests
(`expect(fetchMock.mock.calls.length).toBe(2)` while all three were pending, then exactly one
re-fire). The `AbortController` argument is much weaker than it looked; cancellation is new machinery
in a lane this phase explicitly does not touch; discard-only is what react-select does
(`if (request !== lastRequest.current) return;`) and what we already have, built and tested.
**Purely additive later if a real signal appears** — a future phase reconsidering this starts from
the arithmetic above, not from intuition.

### D4's open question — is a typeahead the signal for the deferred Phase 17 admission barrier? ⇒ **NO. Not the signal. The barrier stays deferred. CLOSED.**

The barrier was recorded as conditional on a real signal of **lane contention** — many independent
non-blocking producers fighting for one slot. A lookup is a **single producer**, already self-throttled
by its own debounce, and the existing latest-wins coalesce slot is **precisely the right semantic for
it**: an older query is worthless the instant a newer one exists, so it *wants* to be dropped, not
queued. RACE 3 is the evidence — the slot dropping the intermediate query is the *correct* outcome,
not a loss. A barrier would add admission machinery to serve a producer that is happiest being
superseded. **Recorded as CLOSED so it is not re-asked next phase.**

## Deviations from Plan

**1. [Plan wrong — flagged, not worked around] RACE 4's literal script is not constructible; written in two forms instead.**
- The plan says: *"Fire search A, fire search B (newer), resolve B first, then resolve A late."*
  **Two searches can never be concurrently in flight through `field()`'s path.** The lane's
  coalescing slot is shell-wide: search B, arriving while A is in flight, *coalesces* rather than
  firing, and its re-fire happens inside A's own `finally`. The arrival order is therefore
  **structurally forced**, not scriptable — the interleaving the plan describes cannot exist.
- **Resolution (not a workaround):** RACE 4 is written in the two forms the composition *can*
  actually produce — **form A** (a stale search vs a newer **blocking** response: genuinely
  concurrent, genuinely out-of-order, the NBA-03 analog) and **form B** (a stale search vs its own
  queued re-fire: the literal "type 'sar', see results for 'sa'" bug, the NBA-06 analog). Both are
  real; both are mutation-proven; together they cover strictly more than the plan's single script.
- This is worth knowing forward: **the lane makes an entire class of typeahead race structurally
  impossible.** That is a property, not a gap.

**2. [Scope] `grep -c "shell.dispatch(" == 0` forced a comment reword.**
- The file's header states the rule "no test may call the shell's dispatch method directly" — and
  naming it would have made the plan's *literal* grep gate report 1 and false-fail. Reworded to avoid
  the literal token, with an inline note saying why. (The core-globals guard solves this properly by
  stripping comments before matching; this plan's gate is a bare grep, so the comment yields.)

## 🚩 Flags — where the plan or the design turned out wrong

**1. The plan's RACE 4 script is impossible.** See Deviation 1. The plan (and PATTERNS §10a's mapping
table) assumed the lane-level NBA-03 analog transfers 1:1 to the composition. It does not: at the lane
level a test can call dispatch twice and get two concurrent non-blocking requests; through `field()`
only one search can ever be in flight. **Any future plan that maps a lane-level test onto the
composition should re-check this** — the coalescing slot changes what interleavings exist.

**2. RACE 3's "latest wins" needed a different assertion than its analog.** NBA-02 asserts the
re-fire carries the latest *action name* (`refresh-3`). For a lookup the action is the **identical**
`search-owner` on every keystroke — latest-wins comes entirely from `_state` being read **fresh at
fire time**. So the analog's assertion would have passed vacuously. Asserting
`_state.ownerQuery === "sar"` is what actually proves it. **A mechanical copy of the analog would
have been decoration** — precisely the class of failure this plan exists to catch, and it nearly
landed.

**3. 21-04's handoff ("the cadence turns previously-invisible DOM-local state into a bug") did NOT
produce a third instance here.** The races exercise popup-open and `querying` hard (every race
re-renders the lookup mid-interaction, several times) and both held. No new instance of that class
surfaced. Reporting the negative result because the handoff asked.

## Threat Flags

None. Test-only plan; no new network surface, auth path, file access, or schema change.
T-21-15 (stale overwrite) → RACE 4 form A, mutation-proven. T-21-16 (background clobbering the user's
pick) → RACE 2, mutation-proven. T-21-17 (unbounded round trips) → RACE 3, explicit fetch-count
assertion, mutation-proven, plus OPEN-4's recorded arithmetic. T-21-18 (a race test that cannot fail)
→ the harness self-test's two proofs, five per-race mutations, and the negative/positive assertion
pairing rule.

## Known Stubs

None new. `lookup-multiple` still renders no chips — that seam is untouched by this plan.

## Self-Check: PASSED

- `viewmodel-shell/test/lookup-search-races.test.ts` — FOUND (8 tests; `makeControllableFetch`,
  `flushSearch`, `realTick` present; `shell.dispatch(` count 0)
- `viewmodel-shell/src/index.ts` — byte-identical to pre-mutation snapshot
- `viewmodel-shell/src/browser.ts` — byte-identical to pre-mutation snapshot
- commit `95a704c` — FOUND
- commit `b1e1ed7` — FOUND
