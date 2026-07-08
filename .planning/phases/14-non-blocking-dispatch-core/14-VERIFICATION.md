---
phase: 14-non-blocking-dispatch-core
verified: 2026-07-08T15:05:17Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/4
  gaps_closed:
    - "NBA-01 (ROADMAP Success Criterion #1): a dispatch with blocking:false runs a silent round-trip that does NOT trip the dispatch mutex or busy-lock; a user action fired while it is in flight is honored, not dropped (and vice versa)."
  gaps_remaining: []
  regressions: []
deferred: []
human_verification: []
---

# Phase 14: Non-Blocking Dispatch Core Verification Report

**Phase Goal:** A dispatch can carry `blocking: false` (optional, default `true` → existing apps byte-unchanged). A non-blocking (silent) round-trip no longer occupies the single global dispatch mutex — it coexists with user actions instead of silently dropping them (or being dropped). Rapid non-blocking triggers debounce/coalesce to one in-flight request. A client-side epoch/sequence counter discards stale, out-of-order responses (last-writer-wins) with no wire epoch and no server change. Both backends stay byte-aligned; new parity fixtures exercise a non-blocking dispatch, coalesced rapid fire, and out-of-order discard.

**Verified:** 2026-07-08T15:05:17Z
**Status:** passed
**Re-verification:** **Yes — after CR-01/CR-02 gap closure** (prior verification 2026-07-08T14:05:16Z scored 3/4, NBA-01 FAILED). This report supersedes that one in full; both CR-01 and CR-02 were re-derived independently from a fresh read of the current `viewmodel-shell/src/index.ts` — the gap-closure SUMMARY's claims were **not** taken on trust.

## Goal Achievement

### CR-01 / CR-02 verdicts (the specific gaps this re-verification exists to check)

#### CR-01 — coalesced refire losing its own dispatch classification: **CONFIRMED-CLOSED**

**Read directly from `viewmodel-shell/src/index.ts` (current tree, not the SUMMARY's description of it):**

- `pendingNonBlockingRefire` is now typed `{ action: ActionEvent; silent: boolean } | null` (field declaration, `index.ts:939`), not the bare `ActionEvent | null` from the pre-fix code.
- The coalescing assignment stores both fields together: `this.pendingNonBlockingRefire = { action, silent };` (`index.ts:1196`) — `silent` here is the **pending trigger's own** parameter (e.g. `true` for a poll's `dispatch({name:"poll"}, true)` call), captured at coalesce time, not derived later.
- The refire in the non-blocking lane's `finally` block reads both fields back out of the slot and replays them together: `if (refire) void this.dispatch(refire.action, refire.silent);` (`index.ts:1224`). This is the load-bearing line — it no longer references the resolving invocation's own `silent` parameter at all (the old bug was `void this.dispatch(refire, silent)`, where the bare `silent` identifier was the *outer* function's own argument, not the stored trigger's).

This exactly matches the fix spec in `14-04-GAP-SUMMARY.md` and the reviewer's suggested fix in `14-REVIEW.md`. A poll (`silent=true`, no `blocking` field of its own) coalescing behind an in-flight `blocking:false` user action (`silent=false`) now stores `{action:{name:"poll"}, silent:true}` and refires via `dispatch({name:"poll"}, true)` regardless of which invocation's `finally` block happens to run the refire — it can never inherit the resolving call's `silent=false` and misroute into the blocking lane.

**Regression test read directly (`viewmodel-shell/test/nonblocking-dispatch.test.ts:201-256`):** fires `dispatch({name:"live-refresh", blocking:false})` (silent=false at the call site — a real `ButtonNode`-shaped trigger, not a poll's own call), then while it's in flight fires `dispatch({name:"poll"}, true)` which coalesces. Resolves the in-flight live-refresh, then asserts (a) a third fetch call fires carrying the `poll` action name — proving the coalesced trigger actually replayed — and (b) `busyCalls` never contains `true` across the whole interleaving, including through the coalesced poll's own resolution. This is a genuine, non-tautological assertion of the exact CR-01 interleaving (mixed origin: a `blocking:false`-triggered dispatch resolving and refiring a coalesced *bare poll* action) — not merely re-testing the already-passing same-lane coalescing case from NBA-02.

**Live re-run:** `npx vitest run test/nonblocking-dispatch.test.ts` → 7/7 pass, including this test.

#### CR-02 — global (non-lane-aware) epoch silently discarding a blocking response: **CONFIRMED-CLOSED**

**Read directly from `viewmodel-shell/src/index.ts`:**

- `performRoundTrip` now takes a second parameter identifying the calling lane: `private async performRoundTrip(action: ActionEvent, nonBlocking: boolean): Promise<void>` (`index.ts:1038`).
- Both dispatch-loop call sites pass their own lane explicitly: the blocking branch calls `await this.performRoundTrip(action, false)` (`index.ts:1176`); the non-blocking branch calls `await this.performRoundTrip(action, true)` (`index.ts:1211`).
- The epoch gate inside `performRoundTrip` (`index.ts:1097-1118`) is lane-aware, exactly as specified:
  - `if (nonBlocking) { if (seq >= this.appliedSeq) { this.appliedSeq = Math.max(this.appliedSeq, seq); this.processResponse(body); } }` — the non-blocking lane keeps the original staleness-discard, unchanged in spirit.
  - `else { this.appliedSeq = Math.max(this.appliedSeq, seq); this.processResponse(body); }` — the blocking lane has **no gating condition at all**; a blocking response always applies unconditionally once it clears its own `ok:false`/`stale_client` handling above.
- `appliedSeq` is confirmed monotonic-only: every write site is `this.appliedSeq = Math.max(this.appliedSeq, seq)` — it is never assigned a bare `seq` that could lower it, on either branch.
- Because `blockingInFlight` (checked at `index.ts:1156`, `if (this.blockingInFlight) return;`) still guarantees at most one blocking dispatch is ever in flight — a second blocking trigger is dropped, not queued, confirmed by the unchanged "no regression" test at `nonblocking-dispatch.test.ts:117-134` — the "always applies unconditionally" rule for the blocking lane cannot reintroduce in-lane staleness: there is structurally only ever one blocking response to apply at a time.

This exactly matches the CR-02 fix spec: the epoch's gating condition is now lane-aware (only non-blocking responses are subject to `seq >= appliedSeq`), while the counter itself (`appliedSeq`) remains a single monotonic value shared across both lanes so a genuinely stale non-blocking response arriving after a blocking one still gets correctly discarded.

**Regression test read directly (`viewmodel-shell/test/nonblocking-dispatch.test.ts:258-291`):** fires a blocking `save` dispatch first (lower seq, slow), then a non-blocking `poll` dispatch second (higher seq). Resolves the non-blocking `poll` *first* (asserts it applies: `getCurrentState()` → `{tag:"poll-applied"}`), then resolves the blocking `save` *second* and asserts it **still applies** (`getCurrentState()` → `{tag:"save-applied"}`, overwriting the poll's stale value) and that `onError` was never called. This is the exact untested-in-the-original-suite direction CR-02 identified (blocking fires first/resolves last, non-blocking fires second/resolves first) — not a restatement of the pre-existing NBA-03 test, which only covers the reverse (safe) ordering.

**Live re-run:** same `npx vitest run test/nonblocking-dispatch.test.ts` pass, including this test.

**Design doc cross-check:** `.planning/design/non-blocking-actions.md`, "### Epoch — client-side, off the wire" section, carries a "**Refinement (Phase 14 gap closure, CR-02)**" paragraph (added in commit `d006106`) stating the exact rule implemented in code — verified by direct read, matches the code precisely (blocking response is authoritative and always applies; `appliedSeq` stays a single monotonic counter advanced via `Math.max`; only the gating *condition* is lane-aware, not the counter). This is now the design of record for Phase 15's poll-fold to build on.

### Observable Truths (from ROADMAP.md Success Criteria — the phase's binding contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | NBA-01: a `blocking:false` dispatch runs a silent round-trip that does NOT trip the busy-lock; a user action fired while it is in flight is honored, not dropped (and vice versa) | ✓ **VERIFIED** (was FAILED) | CR-01 and CR-02 both confirmed closed above, by direct source read + live test re-run, not by trusting the gap-closure SUMMARY. `nonblocking-dispatch.test.ts` direction-A/B tests (unchanged, still pass) plus the two new CR-01/CR-02 regression tests jointly cover: user-fires-while-non-blocking-in-flight, non-blocking-fires-while-user-in-flight, poll-coalesces-behind-blocking:false-and-refires-silent, and blocking-response-survives-a-faster-later-non-blocking-one. |
| 2 | NBA-02: rapid `blocking:false` triggers coalesce to a single in-flight request (latest wins) | ✓ VERIFIED — no regression | `pendingNonBlockingRefire` still overwrites (never queues); the coalescing test (`nonblocking-dispatch.test.ts:137-168`, unchanged) still passes. The CR-01 fix additionally makes the coalesced refire's *lane* correct, which was the last open caveat noted in the prior verification under this truth — that caveat is now resolved. |
| 3 | NBA-03: an out-of-order/late non-blocking response is discarded rather than clobbering a newer render, via a client-side sequence counter, no wire field, no server change | ✓ VERIFIED — refined, not regressed | The originally-tested direction (late non-blocking response discarded after a newer blocking one applied) is unchanged and still passes (`nonblocking-dispatch.test.ts:170-199`). The previously-untested reverse direction (CR-02) is now also correct and covered. `grep -n blocking form.append` in `performRoundTrip` still confirms `_action` carries `{name}` only — no wire field was added by the fix. |
| 4 | NBA-04: `blocking` absent-when-default on both backends; wire token stays `viewmodel-shell/1.0`; `bun run parity/run.ts` green with new fixtures | ✓ VERIFIED — no regression | `git show --stat` on both gap-closure commits (`cc3d9ac`, `3430011`) confirms only `viewmodel-shell/src/index.ts` and `viewmodel-shell/test/nonblocking-dispatch.test.ts` changed (plus the design-doc commit `d006106` touching only `.planning/design/non-blocking-actions.md`) — `.NET`, `browser.ts`, and the parity fixtures were untouched by the fix, exactly as the SUMMARY claims. Re-ran `bun run parity/run.ts` live in this session: 8-fixture suite green, "✓ all backends agree", skill parity green ("✓ skill source files byte-identical", "✓ skill HTTP twins byte-identical"), exit clean. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `viewmodel-shell/src/index.ts` | Lane-aware coalescing slot + lane-aware epoch gate | ✓ Exists, substantive, wired | Read directly (not from the SUMMARY): `pendingNonBlockingRefire: { action: ActionEvent; silent: boolean } \| null` (line 939), coalesce write at line 1196, refire read at line 1224, `performRoundTrip(action, nonBlocking)` signature at line 1038, lane-aware gate at lines 1097-1118. All match the fix spec exactly. |
| `viewmodel-shell/test/nonblocking-dispatch.test.ts` | Two new regression tests for the CR-01/CR-02 interleavings | ✓ Exists, substantive | Read directly: `describe("Phase 14 gap closure (CR-01)...")` (lines 201-256) and `describe("Phase 14 gap closure (CR-02)...")` (lines 258-291), both genuinely encoding the mixed-origin/mixed-lane-ordering interleavings the prior verification found missing — not tautological, both assert specific, falsifiable outcomes (fetch-call count + action name + `setBusy` history for CR-01; final applied state + `onError` call count for CR-02). File total now 7 describe/test cases, all pass. |
| `.planning/design/non-blocking-actions.md` | Epoch section updated with the lane-aware rule as the design of record | ✓ Exists, substantive, wired | "Refinement (Phase 14 gap closure, CR-02)" paragraph present under "### Epoch — client-side, off the wire", content matches the implemented code precisely. |
| `viewmodel-shell/src/browser.ts` | unchanged, still all 9 call sites forward full `ActionEvent` | ✓ Exists, substantive, wired | Untouched by the gap-closure commits (confirmed via `git show --stat`); no re-verification needed beyond the prior pass, no regression risk since the fix never touched this file. |
| `viewmodel-shell-dotnet/ViewModels.cs` | unchanged, `ActionDescriptor(string Name, bool? Blocking = null)` | ✓ Exists, substantive, wired | Untouched by the gap-closure commits; `dotnet test viewmodel-shell-dotnet/Tests` re-run live: 102/102 pass, no regression. |
| FeatureProbe demo pair + `parity/fixtures/feature-probe.json` | unchanged, `blockingSection` byte-identical wire shape | ✓ Exists, substantive, wired | Untouched by the gap-closure commits; `bun run parity/run.ts` re-run live: full 8-fixture suite green including `feature-probe`. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `dispatch()` non-blocking branch | coalescing slot | `this.pendingNonBlockingRefire = { action, silent };` | ✓ WIRED — CORRECT | Stores both fields; confirmed at `index.ts:1196`. |
| coalescing slot | `dispatch()` (recursive refire) | `void this.dispatch(refire.action, refire.silent);` | ✓ WIRED — CORRECT (was DEFECTIVE) | Reads both fields back from the slot; no longer references the resolving call's own `silent` parameter. Confirmed at `index.ts:1224`. |
| `dispatch()` blocking branch | `performRoundTrip` | `await this.performRoundTrip(action, false)` | ✓ WIRED — CORRECT | Confirmed at `index.ts:1176`. |
| `dispatch()` non-blocking branch | `performRoundTrip` | `await this.performRoundTrip(action, true)` | ✓ WIRED — CORRECT | Confirmed at `index.ts:1211`. |
| `performRoundTrip` blocking path | `processResponse` | unconditional apply, no epoch gate | ✓ WIRED — CORRECT (was DEFECTIVE) | Confirmed at `index.ts:1108-1118` — no `if (seq >= appliedSeq)` on this branch. |
| `performRoundTrip` non-blocking path | `processResponse` | `if (seq >= this.appliedSeq) { ...; this.processResponse(body); }` | ✓ WIRED — CORRECT, unchanged | Confirmed at `index.ts:1100-1107`. |

### Behavioral Spot-Checks / Reproductions (all re-run live in THIS session)

| Behavior | Command | Result | Status |
|---|---|---|---|
| `nonblocking-dispatch.test.ts` in isolation (incl. both new CR tests) | `cd viewmodel-shell && npx vitest run test/nonblocking-dispatch.test.ts` | 1 file, 7 tests, 7 passed | ✓ PASS |
| Full TS vitest suite | `cd viewmodel-shell && npx vitest run` | 44 files, 524 passed, 1 skipped | ✓ PASS |
| Core platform-agnosticism guard | `npm run check:core-globals` | `✓ AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals.` | ✓ PASS |
| Cross-backend parity | `PATH="$HOME/.dotnet:$PATH" bun run parity/run.ts` | 8-fixture suite green, `✓ all backends agree`, `✓ skill source files byte-identical`, `✓ skill HTTP twins byte-identical`, `✓ Parity tests passed` | ✓ PASS |
| .NET framework tests | `dotnet test viewmodel-shell-dotnet/Tests` | 102/102 passed | ✓ PASS |
| CR-01 code read | direct read of `index.ts:939, 1196, 1224` | classification stored + replayed together, never re-derived from the resolving call | ✓ CONFIRMS FIX |
| CR-02 code read | direct read of `index.ts:1038, 1097-1118, 1176, 1211` | blocking lane applies unconditionally; non-blocking lane keeps the staleness gate; `appliedSeq` only ever advances via `Math.max` | ✓ CONFIRMS FIX |
| Scope discipline | `git show --stat cc3d9ac 3430011` + `git log ... d006106` | fix touches only `index.ts` (71 insertions / 28 deletions); tests touch only the test file (92 insertions, new); design-doc commit touches only the design doc | ✓ CONFIRMS IN-SCOPE |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| NBA-01 | 14-01, 14-04 (gap closure) | Coexistence — replace the single mutex, no silent drops in either direction | ✓ **SATISFIED** (was BLOCKED) | CR-01 and CR-02 both confirmed closed by direct code read + live test re-run in this session. |
| NBA-02 | 14-01 | Coalescing/latest-wins | ✓ SATISFIED — caveat from prior verification now resolved | Coalescing arithmetic was already correct; the CR-01 fix additionally makes the coalesced refire's lane classification correct, closing the last open caveat. |
| NBA-03 | 14-01, 14-04 (gap closure) | Client-side epoch discards stale/out-of-order | ✓ SATISFIED — now bidirectionally correct | Tested direction unchanged and correct; the previously-untested reverse direction (CR-02) is now also correct and covered by a regression test. |
| NBA-04 | 14-02, 14-03 | `blocking` absent-when-default on both backends, parity green | ✓ SATISFIED — no regression | Untouched by the gap-closure fix; re-verified green live in this session. |

**⚠️ Note for the operator:** `.planning/REQUIREMENTS.md` line 29 still shows `NBA-01` unchecked (`- [ ]`) with a `_GAP (14-VERIFICATION.md): partially met..._` annotation pointing at the prior (now-superseded) verification. This re-verification confirms NBA-01 is now satisfied — REQUIREMENTS.md should be updated to `- [x]` with the gap annotation removed, but that file was out of scope for this re-verification pass (which was scoped to rewriting `14-VERIFICATION.md` only) and was left untouched.

No orphaned requirements — REQUIREMENTS.md's traceability table maps exactly NBA-01..04 to Phase 14, and all four appear in the plans' `requirements:` frontmatter (14-01, 14-02, 14-03, and now 14-04 gap-closure).

### Anti-Patterns Found

None. No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER in the modified files (`index.ts`, `nonblocking-dispatch.test.ts`, `non-blocking-actions.md`). No stub returns, no hardcoded empty data. The fix commit is a pure, well-commented logic correction — the new code carries extensive inline doc comments explaining exactly why the lane-aware classification/gating is necessary (e.g. `index.ts:927-939` on `pendingNonBlockingRefire`, `index.ts:940-956` on `appliedSeq`), which is good practice for a subtle concurrency fix future maintainers will need to reason about.

**Carried-forward warnings from `14-REVIEW.md` (not Phase-14-blocking, unaffected by this fix, recorded for continuity):**
- **WR-01** (`agent-skill.md` not updated for `blocking:false`): still correctly out of scope for Phase 14 — REQUIREMENTS.md maps **NBA-07** to **Phase 15**. Untouched by the gap-closure fix (confirmed — the fix's scope was exactly `index.ts` + the test file + the design doc).
- **WR-02** (`push()`'s in-flight guard stricter than the two-lane framing): unaffected by the gap-closure fix — `push()` was not touched. Still a deliberate, plan-documented scope boundary, not a regression.
- **IN-01** (duplicated pre-load guard): unaffected, still a deliberate plan directive.

### Human Verification Required

None — both previously-open issues (CR-01, CR-02) are deterministic and were re-confirmed closed via direct source inspection and reproducible, non-tautological unit tests (re-run live in this session), not matters of visual/UX judgment.

### Gaps Summary

**None remaining.** This re-verification independently re-derived both CR-01 and CR-02 from a fresh read of the current `viewmodel-shell/src/index.ts` — not from the gap-closure SUMMARY's narrative — and confirms both fixes are present, correctly implemented, and match the operator's fix spec precisely:

- **CR-01 (coalesced refire losing its own dispatch classification):** the coalescing slot now stores `{action, silent}` together at coalesce time and the refire replays both together, never re-deriving `silent` from whichever invocation happens to resolve first. Confirmed by direct line-level code read (`index.ts:939, 1196, 1224`) and by a genuine, falsifiable regression test that fires the exact mixed-origin interleaving (a `blocking:false` user action with a coalesced bare-poll refire behind it) and asserts both the refire's action name and that `setBusy(true)` never fires.
- **CR-02 (global epoch silently discarding a blocking response):** the epoch's staleness-discard gate is now lane-aware — only non-blocking responses are subject to `seq >= appliedSeq`; a blocking response (provably the only one of its kind ever in flight, per `blockingInFlight`) always applies unconditionally. `appliedSeq` remains a single, correctly-monotonic (`Math.max`-only) counter shared across both lanes. Confirmed by direct line-level code read (`index.ts:1038, 1097-1118, 1176, 1211`) and by a genuine regression test that fires a slow blocking dispatch, resolves a faster later non-blocking one first, then confirms the blocking response still applies and `onError` is never called.

Both fixes stayed strictly in scope: no wire field was added (`_action` still carries `{name}` only), no poll-fold, no admission barrier, and `.NET`/`browser.ts`/the parity fixtures were untouched (confirmed via `git show --stat` on the fix and test commits) — matching the design doc's explicit guardrails ("No wire-level epoch / no server-side reconciliation state... No admission barrier in Stage 1"). The full green-tree gate (TS vitest 524/525, core-globals guard, cross-backend parity, .NET framework tests 102/102) was re-run live in this verification session, not copied from the SUMMARY, and is fully green.

Phase 14's goal — a `blocking:false` dispatch that genuinely coexists with user actions, with rapid triggers coalescing and stale out-of-order responses discarded, on a byte-aligned two-backend wire — is now achieved without qualification.

---

_Verified: 2026-07-08T15:05:17Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after gap closure (CR-01, CR-02) — supersedes the 2026-07-08T14:05:16Z report in full._
