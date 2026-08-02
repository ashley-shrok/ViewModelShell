---
phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
plan: 01
subsystem: ui
tags: [version-skew, adapter-capability, shell-options, hard-lock, viewmodel-shell]

# Dependency graph
requires:
  - phase: 28-composite-nodes-layer-v8-2-0
    provides: v8.2.0 baseline (framework build/test infrastructure)
provides:
  - Adapter.showSkewLock capability verb (fail-quiet posture, matches toast/reload)
  - ShellOptions.onVersionSkew closed-union opt-out ("default" | "custom")
  - Private skewLocked shell-level lock state (one-way, only reload clears)
  - Private lockSkew helper (gate + stopPolling + verb), idempotent
  - dispatch() early-return guard placed BEFORE the (!nonBlocking) lane split
  - processResponse() early-return guard placed BEFORE adapter.render
affects: [29-03 (behavior swap wiring), 29-06 (BrowserAdapter DOM implementation), 29-11 (docs/MIGRATION)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adapter fail-quiet-by-absence verb (matches setPreventUnload/setBusy/toast/reload posture) — a missing skew-lock modal is a UX nicety, never a correctness bug, because VmsVersionSkewError / VmsActionError still surface via onError"
    - "Closed-union string enum for opt-out flags ('default' | 'custom') — enable-by-default posture: any value that is not literally 'custom' activates hard-lock (default-safe)"
    - "One-way shell-level lock state (skewLocked never resets — only reload navigates away, discarding the shell)"
    - "Extracted helper for gate + stop + verb sequence to avoid duplication across two future call sites (checkVersionSkew mismatch + stale_client catch arm)"
    - "Dispatch guard placement BEFORE the lane split — the CONTEXT-mandated 'polls stop firing by construction' guarantee lives entirely in this placement, verified by the placement-gate acceptance criterion (line-number comparison)"

key-files:
  created: []
  modified:
    - viewmodel-shell/src/index.ts

key-decisions:
  - "Contract-first split: only DECLARE the field/helper/guards here; DO NOT wire lockSkew from checkVersionSkew or stale_client catch arm. That swap lands in Plan 29-03 — this split unblocks 29-06 (adapter DOM) in parallel."
  - "Placement of dispatch guard is above the (!nonBlocking) lane split (line 3309 < line 3315), NOT adjacent to serverBusy (which lives inside the block at line 3320). This is what makes polls drop by construction."
  - "Placement of processResponse guard is between prior checkVersionSkew calls in load() (line 3160) and the render call inside processResponse (line 3530). Position 3520 satisfies both bounds — the acceptance-criteria placement gate."
  - "Adjacent placement of lockSkew immediately after checkVersionSkew — they are conceptually paired (one detects, one reacts)."

patterns-established:
  - "The four sibling fail-quiet verbs (setPreventUnload / setBusy / toast / reload) become five with showSkewLock — the FAIL-QUIET BY ABSENCE TSDoc clause is now searchable across five sites."
  - "The opt-out flag shape ('default' | 'custom' closed-union) is the recommended shape for future consumer-facing opt-outs where the framework wants to ship a new default without breaking existing custom paths."

requirements-completed: [SKEW-04, SKEW-05, SKEW-06]

# Metrics
duration: ~20min
completed: 2026-08-02
---

# Phase 29 Plan 01: TS contract for the version-skew hard-lock — Adapter verb + opt-out flag + skewLocked shell state + placement-gated guards

**Landed the Wave-1 TS contract that Waves 2 (client wiring 29-03) and 3 (adapter DOM 29-06) build against: `Adapter.showSkewLock?` capability verb, `ShellOptions.onVersionSkew?: "default" | "custom"` opt-out, private `skewLocked` shell state, private `lockSkew()` helper, and two placement-gated early-return guards (`dispatch()` before the lane split; `processResponse()` before render). No behavior change yet — the two triggering sites (`checkVersionSkew` mismatch + `stale_client` catch arm) are byte-identical to the pre-plan baseline.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-02T17:15Z
- **Completed:** 2026-08-02T17:35Z
- **Tasks:** 3
- **Files modified:** 1 (viewmodel-shell/src/index.ts)

## Accomplishments

- **`Adapter.showSkewLock?` capability verb declared** (line 145) — inserted immediately after `reload?()` at line 127, with FAIL-QUIET-BY-ABSENCE TSDoc verbatim-mirroring the sibling toast/reload posture. The verb is optional; an adapter without it (TUI, a custom target) still learns of skew via the pre-existing onError surface, so the missing modal is a UX nicety, not a correctness/security bug.
- **`ShellOptions.onVersionSkew?: "default" | "custom"` opt-out declared** (line 2902) — inserted immediately after `clientBuildId?` at line 2871 (both are version-skew family fields, grouped for future readers). Enable-by-default: runtime check is `!== "custom"` so any typo activates the hard-lock (default-safe).
- **`private skewLocked = false` field declared** (line 3109) — inserted immediately after `userDispatching` at line 3073. One-way lock: set in exactly one place (the new `lockSkew` helper), never reset. Only `reload()` clears it — and reload navigates away, discarding the shell instance.
- **`private lockSkew(info?)` helper declared** (line 3574) — inserted immediately after `checkVersionSkew` at line 3550 (adjacent placement per the "conceptually paired" pattern). Three-step sequence: gate on `onVersionSkew === "custom"`, set flag, call `stopPolling()`, call `adapter.showSkewLock?.(info)`. Idempotent by construction (double-lock is safe). NOT called from anywhere yet — Plan 29-03 wires the two call sites.
- **Two `if (this.skewLocked) return;` early-return guards** — dispatch entry at line 3309 (BEFORE the `if (!nonBlocking) {` lane split at line 3315) and processResponse render at line 3520 (BEFORE the `adapter.render(body.vm, ...)` call at line 3530). Placement is the CONTEXT-mandated invariant.

## Placement Gate Verification

The two acceptance-criteria placement gates confirmed:

**Dispatch lane-split anchor:**
```
3302:    // MUST be placed BEFORE the `if (!nonBlocking) {` lane split below so
3309:    if (this.skewLocked) return;    ← guard (FIRST skewLocked occurrence)
3315:    if (!nonBlocking) {              ← lane split
```
3309 < 3315 ✓ — guard sits BEFORE the lane split, so polls (which take the non-blocking lane that skips the entire `if (!nonBlocking)` block) are dropped by construction.

**processResponse anchor:**
```
3160:      this.checkVersionSkew(body);                             ← load()'s checkVersionSkew call
3520:    if (this.skewLocked) return;                              ← guard (SECOND skewLocked occurrence)
3530:      this.options.adapter.render(body.vm, (a) => this.dispatch(a), ...);  ← processResponse's render
3538:    this.checkVersionSkew(body);                             ← processResponse's own tail-position checkVersionSkew
```
3160 < 3520 < 3530 ✓ — guard falls BETWEEN a `checkVersionSkew` line (from `load()`) and an `adapter.render(` line (from `processResponse`). First-response detection can still fire; subsequent responses arriving after lock cannot repaint.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare Adapter.showSkewLock verb + ShellOptions.onVersionSkew opt-out** — `42476a4` (feat)
2. **Task 2: Declare private skewLocked field + private lockSkew helper** — `0af74f2` (feat)
3. **Task 3: Add skewLocked early-return guards at dispatch + processResponse** — `36f89d1` (feat)

## Files Created/Modified

- `viewmodel-shell/src/index.ts` — TS contract additions (four sites: line 145 verb declaration, line 2902 opt-out flag, line 3109 field, line 3574 helper) + two early-return guards (line 3309 dispatch, line 3520 processResponse). Total +75 lines across three commits (31 + 27 + 17).

## Gate Verification (pre-plan baseline vs post-plan)

| Gate | Pre-plan | Post-plan |
|------|----------|-----------|
| `cd viewmodel-shell && npm run build` | exit 0 | exit 0 |
| `cd viewmodel-shell && npm run check:test-types` | exit 0 | exit 0 |
| `cd viewmodel-shell && npx vitest run` | (not baseline-run) | exit 0 (82 files, 1348 tests, 1 skipped) |
| `grep -c 'showSkewLock' src/index.ts` | 0 | 3 (verb declaration + optional-chain call + Adapter TSDoc reference) |
| `grep -c 'onVersionSkew' src/index.ts` | 0 | 3 (declaration + opt-out check + Adapter TSDoc reference) |
| `grep -c 'skewLocked' src/index.ts` | 0 | 5 (field declaration + set-to-true in lockSkew + two early-return guards + field-doc comment reference) |
| `grep -c 'lockSkew' src/index.ts` | 0 | 1 (helper declaration only — NOT called from anywhere yet, per contract-first split) |
| `grep -c 'this.stopPolling()' src/index.ts` | 1 | 2 (baseline + 1 new call inside lockSkew) |
| `grep -c 'FAIL-QUIET BY ABSENCE' src/index.ts` | 2 | 3 (baseline + 1 new for showSkewLock TSDoc — the searchable-phrase invariant that keeps the five sibling verbs findable together) |

## Byte-Identity Verification (must be unchanged per contract-first split)

**`checkVersionSkew` body** — pre and post identical:
```typescript
private checkVersionSkew(body: ShellResponse): void {
  const clientBuild = this.options.clientBuildId;
  const serverBuild = body.serverBuild;
  if (clientBuild && serverBuild && serverBuild !== clientBuild) {
    const err = new VmsVersionSkewError(serverBuild, clientBuild);
    this.options.onError ? this.options.onError(err) : console.error("[ViewModelShell]", err);
  }
}
```

**`stale_client` catch arm** — pre and post identical:
```typescript
if (error instanceof VmsActionError && error.code === "stale_client") {
  this.options.adapter.reload?.();
  return;
}
```

Both blocks confirmed byte-identical to pre-plan baseline. Plan 29-03 owns the swap that will call `this.lockSkew({...})` from these two sites.

## Decisions Made

- **Contract-first split:** land only DECLARATIONS + GUARDS here. Do NOT call `lockSkew` from anywhere — that call-site wiring is Plan 29-03's territory. This split lets 29-06 (BrowserAdapter DOM implementation) start immediately against a committed contract without waiting on 29-03's behavior swap.
- **Dispatch guard placement:** BEFORE the `if (!nonBlocking) {` lane split, not adjacent to `serverBusy`. The CONTEXT-mandated "polls stop firing by construction" guarantee lives entirely in this placement. Verified by the acceptance-criteria placement gate (line 3309 < line 3315).
- **processResponse guard placement:** BEFORE the `if (body.vm != null)` render section. Skips both the render call AND the state mutation for post-lock responses; the semantic "no re-renders paint" is preserved AND the shell's internal state doesn't drift under a locked screen.
- **Adjacent placement of `lockSkew` next to `checkVersionSkew`:** the two are conceptually paired (one detects, one reacts) — grouping them in the source order aids future readers of the class.

## Deviations from Plan

None — plan executed exactly as written. All three tasks, the placement gates, and the byte-identity assertions for the untouched blocks all pass on the first pass. No auto-fixes required; no analog-model refactors needed. The plan's `<interfaces>` section was precisely accurate about the pre-plan line numbers (Adapter interface ~50-127, `clientBuildId` at ~line 2862, `serverBusy` at ~line 3072, dispatch lane-split at ~line 3269, `processResponse` render at ~line 3425, `checkVersionSkew` at ~line 3497).

## Issues Encountered

None. The pre-plan gates (`npm run build`, `npm run check:test-types`) already exited 0, and the vitest suite is byte-identical to the pre-plan behavior since nothing sets `skewLocked` yet (all existing tests behave identically because `if (this.skewLocked) return;` is a no-op with `skewLocked === false`).

## User Setup Required

None — pure TS type-shape and gating additions inside `viewmodel-shell/src/index.ts`. No new dependencies, no configuration, no runtime behavior change.

## Next Phase Readiness

- **Plan 29-06 (BrowserAdapter DOM)** — UNBLOCKED. Can implement `BrowserAdapter.showSkewLock` against the committed verb signature `showSkewLock?(info?: { clientBuild?: string; serverBuild?: string }): void`.
- **Plan 29-03 (client wiring + behavior swap)** — UNBLOCKED. Can now (a) wire `this.lockSkew({clientBuild, serverBuild})` into the `checkVersionSkew` mismatch branch, (b) replace `this.options.adapter.reload?.();` in the stale_client catch arm with `this.lockSkew({});` (or with structured build info), and (c) add the `X-VMS-Client-Build` header hoist in `load()`.
- **Plan 29-11 (docs)** — Ready to draft the MIGRATION.md v9.0.0 upgrade section referencing `onVersionSkew: "custom"` as the opt-out for consumers with pre-existing custom `onError` affordances.

## Self-Check: PASSED

**Files created:** verified
- `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-01-SUMMARY.md` — FOUND (this file, written by Write tool)

**Commits exist:** verified via `git log --oneline`
- `42476a4` — FOUND (Task 1: Adapter.showSkewLock + ShellOptions.onVersionSkew)
- `0af74f2` — FOUND (Task 2: skewLocked field + lockSkew helper)
- `36f89d1` — FOUND (Task 3: two early-return guards)

---
*Phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-*
*Completed: 2026-08-02*
