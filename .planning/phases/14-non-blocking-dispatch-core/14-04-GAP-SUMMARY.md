---
phase: 14-non-blocking-dispatch-core
plan: 04-gap-closure
subsystem: client-dispatch
tags: [typescript, concurrency, dispatch-loop, epoch, coalescing]

# Dependency graph
requires:
  - phase: 14-non-blocking-dispatch-core (14-01)
    provides: "ActionEvent.blocking?; the two-lane dispatch loop (blockingInFlight/nonBlockingInFlight); pendingNonBlockingRefire coalescing; dispatchSeq/appliedSeq epoch; performRoundTrip()"
provides:
  - "CR-01 fix: pendingNonBlockingRefire stores {action, silent} — the coalesced refire always replays with the pending trigger's OWN classification, never the resolving invocation's"
  - "CR-02 fix: lane-aware epoch — performRoundTrip(action, nonBlocking) gates the staleness-discard (seq >= appliedSeq) ONLY for non-blocking responses; a blocking response always applies unconditionally; appliedSeq advances via Math.max (monotonic, never lowered) from either lane"
  - "Two regression tests in nonblocking-dispatch.test.ts covering both previously-untested interleavings, verified FAIL-before / PASS-after"
  - "Design doc (.planning/design/non-blocking-actions.md, Epoch section) updated with the lane-aware refinement as the design of record"
affects: [15-non-blocking-dispatch-hardening, any future phase building on the dispatch epoch (e.g. a poll-fold or admission barrier)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Lane-aware epoch gating: a shared monotonic sequence counter can still be lane-symmetric in comparison logic even though only one lane (non-blocking) needs staleness protection — the OTHER lane (blocking, which is provably single-flight by its own mutex) applies unconditionally and only contributes to the high-water mark via Math.max."
    - "Coalescing slots that later re-dispatch must carry their own full dispatch classification (not just the payload) — never re-derive a queued trigger's semantics from whichever caller happens to service the queue."

key-files:
  created: []
  modified:
    - "viewmodel-shell/src/index.ts — pendingNonBlockingRefire type, performRoundTrip() signature + epoch gate, both dispatch() lane call sites, the coalesced-refire finally block"
    - "viewmodel-shell/test/nonblocking-dispatch.test.ts — two new regression tests (CR-01, CR-02 interleavings)"
    - ".planning/design/non-blocking-actions.md — Epoch section refined with the lane-aware rule"

key-decisions:
  - "Followed the operator's authoritative fix spec exactly: coalesce slot stores {action, silent}; blocking responses are authoritative and always apply; appliedSeq stays a single counter (advanced via Math.max, never lowered) but the GATING condition (seq >= appliedSeq) is lane-aware, applied only to non-blocking responses."
  - "No wire-level change, no new ActionEvent/ShellResponse fields, no poll-fold, no admission barrier — both fixes are pure client-side dispatch-loop corrections, exactly matching the review's suggested fix shape and staying in Phase 14's original scope."
  - "Regression tests reuse the existing makeControllableFetch/resolveDeferred/actionNameOf test harness in nonblocking-dispatch.test.ts rather than introducing a new test utility, to match the file's established style."

requirements-completed: [NBA-01]

# Metrics
duration: ~35min
completed: 2026-07-08
---

# Phase 14 Gap Closure: CR-01 (coalesce misclassification) + CR-02 (blocking response silently dropped) Summary

**Fixed two confirmed, live-reproduced concurrency defects in the client dispatch loop (`viewmodel-shell/src/index.ts`) that let a non-blocking poll misroute into the blocking lane, and let a slow blocking response be silently discarded by a faster later non-blocking one — closing the NBA-01 coexistence gap recorded in `14-VERIFICATION.md`.**

## Context

`14-VERIFICATION.md` (2026-07-08T14:05:16Z) scored Phase 14 at 3/4 must-haves, with NBA-01 (ROADMAP Success Criterion #1 — coexistence) FAILED due to two independently-confirmed, live-reproduced defects documented in `14-REVIEW.md` (CR-01, CR-02). This gap-closure plan applies the operator's precise fix spec for both, adds regression tests proving the fix (both FAIL-before/PASS-after the code change), updates the design doc, and re-runs the full green-tree gate.

## The two defects

### CR-01 — coalesced refire loses its own dispatch classification

**File:** `viewmodel-shell/src/index.ts` (coalescing slot + refire, originally ~lines 1149-1182).

The non-blocking lane's coalescing slot stored only the pending `ActionEvent`, not the `silent` value it was originally triggered with. When the in-flight dispatch resolved, its `finally` block replayed the coalesced action using **its own** `silent` parameter — so a bare `poll` action (whose non-blocking-ness lives entirely in the `silent=true` argument of `dispatch({name:"poll"}, true)`, since a poll carries no `blocking` field of its own) coalescing behind an in-flight `blocking:false` user action (`silent=false`) would refire as `dispatch({name:"poll"}, false)` — misrouting it into the **blocking lane**. Consequence: an invisible background poll could trip `setBusy(true)`, or (if `serverBusy` happened to be true at that instant) be silently eaten by the `if (this.serverBusy) return;` guard before `performRoundTrip` ever ran — since polling is self-perpetuating via `schedulePoll` inside `processResponse`, this could silently halt the entire poll loop.

### CR-02 — global (not lane-aware) epoch silently discards a blocking response

**File:** `viewmodel-shell/src/index.ts` (`dispatchSeq`/`appliedSeq`, originally ~lines 933-940 and the epoch gate in `performRoundTrip`, ~lines 1075-1081).

`appliedSeq` was a single monotonic counter gating both lanes symmetrically (`seq >= appliedSeq` before applying any response). Because `blockingInFlight` guarantees at most one blocking dispatch is ever in flight, a blocking response can never be superseded by *another blocking* response — the symmetric gate only ever hurt it: a slow blocking dispatch (e.g. `save`, lower seq) racing a faster later non-blocking dispatch (e.g. a poll tick, higher seq) that resolved first would advance `appliedSeq` past the blocking dispatch's own seq — so when the user's own `save` response finally arrived, `seq >= appliedSeq` was false and it was **silently discarded**: no render, no `onError`. The busy lock still cleared normally (the blocking lane's `finally` unconditionally resets it), so the user watched their click lock and unlock the UI with the action visibly doing nothing.

## The fixes applied

### CR-01 fix

`pendingNonBlockingRefire`'s type changed from `ActionEvent | null` to `{ action: ActionEvent; silent: boolean } | null` (index.ts, field declared ~line 939). The coalescing assignment now stores both: `this.pendingNonBlockingRefire = { action, silent };` (~line 1196). The refire in the non-blocking lane's `finally` block now replays both from the slot: `if (refire) void this.dispatch(refire.action, refire.silent);` (~line 1223) — it never inherits the resolving invocation's own `silent` parameter.

### CR-02 fix

`performRoundTrip` now takes a second parameter, `nonBlocking: boolean`, identifying which lane the CURRENT dispatch is on (~line 1038: `private async performRoundTrip(action: ActionEvent, nonBlocking: boolean): Promise<void>`). Both lane call sites in `dispatch()` pass their lane explicitly: the blocking lane calls `await this.performRoundTrip(action, false)` (~line 1176), the non-blocking lane calls `await this.performRoundTrip(action, true)` (~line 1211).

The epoch gate (~lines 1097-1118) is now lane-aware:
- **Non-blocking response:** subject to the staleness-discard, unchanged in spirit — `if (seq >= this.appliedSeq) { this.appliedSeq = Math.max(this.appliedSeq, seq); this.processResponse(body); }`.
- **Blocking response:** authoritative — always applies unconditionally: `this.appliedSeq = Math.max(this.appliedSeq, seq); this.processResponse(body);` with no gating condition at all.

`appliedSeq` remains a single counter shared across both lanes and is always advanced via `Math.max` (never lowered, and never decremented by a blocking response applying with a lower seq than what's already been applied) — this preserves the correctness of the non-blocking staleness-discard against the true high-water mark, while removing the incorrect gate on the blocking lane.

## Regression tests added

Both added to `viewmodel-shell/test/nonblocking-dispatch.test.ts`:

1. **`Phase 14 gap closure (CR-01) — a poll coalescing behind an in-flight blocking:false action refires SILENT`** ("does not trip setBusy and does not misroute the coalesced poll into the blocking lane"). Fires a `blocking:false` action, then (while in flight) a poll (`dispatch({name:"poll"}, true)`) which coalesces; resolves the in-flight action; asserts the coalesced refire (a) is a real third fetch call carrying the `poll` action name, and (b) never causes `setBusy(true)` anywhere in the interleaving.
2. **`Phase 14 gap closure (CR-02) — a slow blocking dispatch's response is never dropped by a faster later non-blocking one`** ("applies the blocking response even though a later-fired non-blocking one resolved first"). Fires a blocking `save` dispatch, then a non-blocking `poll` dispatch (later seq); resolves the non-blocking one first (its state applies); resolves the blocking one second and asserts its state is applied (not the stale poll state) and `onError` is never called.

**Verified FAIL-before / PASS-after ordering explicitly**, per the plan requirement:
- Stashed only the `index.ts` fix (kept the new tests) and re-ran `npx vitest run test/nonblocking-dispatch.test.ts`: both new tests FAILED with the exact predicted symptoms (`expected [ false, true ] to not include true` for CR-01; `expected { tag: 'poll-applied' } to deeply equal { tag: 'save-applied' }` for CR-02), while the other 5 pre-existing tests in the file still passed (5 passed / 2 failed / 7 total).
- Restored the `index.ts` fix and re-ran: all 7 tests in the file pass.

## Scope discipline

Confirmed in-scope per the operator's spec: pure client-side lane/epoch corrections only in `viewmodel-shell/src/index.ts` and its test file. No wire-level field was added (`ActionEvent`/`ShellResponse` unchanged), no poll-fold, no admission barrier, and no changes to `.NET`, the parity fixtures, or `browser.ts` — none of the two fixes required touching them. Confirmed by `git diff --stat`: only `viewmodel-shell/src/index.ts`, `viewmodel-shell/test/nonblocking-dispatch.test.ts`, and `.planning/design/non-blocking-actions.md` changed.

## Green-tree gate — full re-run, all green

| Check | Command | Result |
|---|---|---|
| Full TS vitest suite | `cd viewmodel-shell && npx vitest run` | 44 files, 524 passed, 1 skipped |
| Core platform-agnosticism guard | `cd viewmodel-shell && npm run check:core-globals` | AGNOSTIC-03 clean |
| Build | `cd viewmodel-shell && npm run build` | `tsc -b tsconfig.tui.json`, exit 0 |
| Cross-backend parity | `PATH="$HOME/.dotnet:$PATH" bun run parity/run.ts` (repo root) | 8-fixture suite green, "✓ all backends agree", skill parity green (source + HTTP twins byte-identical), "✓ Parity tests passed", exit 0 |
| .NET framework tests | `dotnet test viewmodel-shell-dotnet/Tests` | 102/102 passed |
| `demo/Tasks/AspNetCore.Tests` | `dotnet test` | 28/28 passed |
| `demo/ContactManager/AspNetCore.Tests` | `dotnet test` | 39/39 passed |
| `demo/RetroBoard/AspNetCore.Tests` | `dotnet test` | 33/33 passed |
| `demo/HelpDesk/AspNetCore.Tests` | `dotnet test` | 52/52 passed |
| `demo/ExpenseTracker/AspNetCore.Tests` | `dotnet test` | 29/29 passed |

Total demo `.Tests.csproj`: 28+39+33+52+29 = 181/181 passed — matching the pre-existing baseline recorded in `14-VERIFICATION.md`, confirming no regression was introduced anywhere in the tree.

`dotnet` was invoked via `~/.dotnet/dotnet` on `PATH` for all `.NET`/parity commands, per the operator's instructions.

## Design doc update

`.planning/design/non-blocking-actions.md`, "### Epoch — client-side, off the wire" section: added a "**Refinement (Phase 14 gap closure, CR-02)**" paragraph recording the authoritative rule for future phases — a blocking (user) response is authoritative and always applies (there is only ever one blocking dispatch in flight, so it can never be superseded within its own lane); the staleness-discard gates non-blocking/background responses only; `appliedSeq` remains a single monotonic counter (advanced via `Math.max`, never lowered) shared across both lanes for the purpose of gating non-blocking applications, but only the *gating condition* is lane-aware, not the counter itself. This is now the design of record any future phase (e.g. Phase 15's poll-fold) must build on.

## Deviations from Plan

None — the operator's fix spec was followed exactly as written (both fixes, both tests, the scope boundary, and the design-doc refinement all match the spec verbatim). No Rule 1/2/3 auto-fixes were needed beyond what the spec already called for.

## Self-Check

- `viewmodel-shell/src/index.ts` — FOUND, contains `pendingNonBlockingRefire: { action: ActionEvent; silent: boolean }` and `performRoundTrip(action: ActionEvent, nonBlocking: boolean)`.
- `viewmodel-shell/test/nonblocking-dispatch.test.ts` — FOUND, contains both new `describe` blocks (`Phase 14 gap closure (CR-01)` and `Phase 14 gap closure (CR-02)`).
- `.planning/design/non-blocking-actions.md` — FOUND, contains the "Refinement (Phase 14 gap closure, CR-02)" paragraph under "### Epoch — client-side, off the wire".
- All green-tree gate commands above were re-run in this session with the results shown (not copied from a prior report) — vitest 524 passed/1 skipped, core-globals clean, build exit 0, parity exit 0, .NET Tests 102/102, all 5 demo Tests 181/181 total.
- Both regression tests were verified to FAIL against the pre-fix code (via `git stash` on `index.ts` only) and PASS against the post-fix code, in that order, in this session.

**Result: PASSED**
