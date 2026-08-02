---
phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
plan: 03
subsystem: ui
tags: [version-skew, client-header, hard-lock, retire-auto-reload, viewmodel-shell, tests]

# Dependency graph
requires:
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-01"
    provides: Adapter.showSkewLock verb + ShellOptions.onVersionSkew opt-out + skewLocked shell state + private lockSkew helper + dispatch/processResponse early-return guards
provides:
  - X-VMS-Client-Build header attachment on GET (load()) — symmetric with the shipped POST-side attachment in performRoundTrip()
  - stale_client catch arm now calls lockSkew() INSTEAD of the silent adapter.reload() (SKEW-04 fail-closed → hard-lock)
  - checkVersionSkew mismatch branch ALSO calls lockSkew({clientBuild, serverBuild}) (SKEW-04 detection → hard-lock; preserves onError signal)
  - Test SpyAdapter extended with skewLocks counter + showSkewLock mock method
  - 4 new describe blocks + 2 updated pre-9.0.0 tests in test/version-skew.test.ts
affects: [29-06 (BrowserAdapter DOM impl — the button that finally calls adapter.reload on user consent), 29-11 (MIGRATION.md v9.0.0 behavior-change note)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Symmetric header attachment between load() and performRoundTrip() — both paths guard with `if (this.options.clientBuildId)` and merge the header AFTER getRequestHeaders() so app headers can't clobber it"
    - "Test-side counter pattern extended (skewLocks alongside the shipped reloads) — same shape as the two shipped counters (renders, reloads); adapter.showSkewLock mock is a one-liner increment"
    - "Behavior-change test-update pattern: update the pre-9.0.0 assertion in place with a comment naming the plan (Plan 29-03) — the updated test IS the executable proof of the behavior change consumers will see"

key-files:
  created:
    - .planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-03-SUMMARY.md
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/test/version-skew.test.ts

key-decisions:
  - "load() header attachment mirrors performRoundTrip() literally — same guard shape, same comment about ordering vs getRequestHeaders(), just a different context (GET vs POST). Comment names SKEW-03 for traceability."
  - "lockSkew() is called with NO argument from the stale_client catch arm (the ShellExceptionFilter envelope carries the exception message, not the server's build id — the info arg would be undefined-shaped). The custom adapter's showSkewLock signature already accepts an optional info arg per Plan 29-01."
  - "lockSkew() is called WITH { clientBuild, serverBuild } from checkVersionSkew — both ids are already in scope from the mismatch check, useful for custom-adapter debugging."
  - "checkVersionSkew's onError line is PRESERVED byte-for-byte — the new lockSkew() call is APPENDED after it, not a replacement. The onError signal is what consumers on onVersionSkew:'custom' rely on for backward-compat."
  - "Updated pre-9.0.0 test (was asserting spy.reloads === 1) is rewritten in place rather than deleted, so the file's total describe count still covers the shipped stale_client path (spy.skewLocks === 1 now, but the test still lives under the same 3.8.0 describe as the historical anchor). Second pre-9.0.0 test (fail-quiet by absence) also updated: makeAdapter(false, false) — no reload verb, no showSkewLock verb — and asserts both counters stay 0."

requirements-completed: [SKEW-03, SKEW-04, SKEW-06]

# Metrics
duration: ~15min
completed: 2026-08-02
---

# Phase 29 Plan 03: Client X-VMS-Client-Build header on GET + retire silent auto-reload + wire lockSkew from checkVersionSkew and stale_client arm + vitest coverage

**Landed the Wave-2 client-side behavior swap that hard-locks on skew: (a) X-VMS-Client-Build header attached on GET (load()) symmetric with the shipped POST attachment (SKEW-03), (b) silent adapter.reload() at the stale_client catch arm retired in favor of this.lockSkew() (SKEW-04), (c) checkVersionSkew mismatch branch extended with a lockSkew({clientBuild, serverBuild}) call while preserving the onError signal for opt-out consumers (SKEW-04), (d) SpyAdapter extended with skewLocks counter, 4 new describe blocks added covering the four new behaviors, 2 pre-9.0.0 assertions updated to reflect the retirement (SKEW-06). Full framework vitest suite green (1353/1353 tests, was 1348 pre-plan). Client-side wiring complete; Plan 29-06 provides the last missing piece (BrowserAdapter.showSkewLock DOM impl) before the primitive works end-to-end in a browser.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-02T17:20Z
- **Completed:** 2026-08-02T17:35Z
- **Tasks:** 3
- **Files modified:** 2 (viewmodel-shell/src/index.ts, viewmodel-shell/test/version-skew.test.ts)

## Modification Sites (exact final line numbers)

Post-plan line numbers in `viewmodel-shell/src/index.ts`:

| # | Site | Line | What lands |
|---|------|------|------------|
| 1 | `load()` — GET header hoist (SKEW-03) | 3124 | 6-line comment + `const headers: Record<string, string>` construction + `if (this.options.clientBuildId) headers["X-VMS-Client-Build"] = ...` + `fetch(url, { headers })` |
| 2 | `processResponse()` catch — stale_client arm replacement (SKEW-04) | 3283 | 8-line comment updating rationale + `this.lockSkew();` (was `this.options.adapter.reload?.();`) + preserved `return;` |
| 3 | `checkVersionSkew` — mismatch branch extension (SKEW-04) | 3566 | Preserved onError line + new comment + `this.lockSkew({ clientBuild, serverBuild });` call |

Test file `viewmodel-shell/test/version-skew.test.ts` (5 modification sites — SpyAdapter interface, makeAdapter helper, 1st pre-9.0.0 stale_client test, 2nd pre-9.0.0 fail-quiet test, + 4 new describe blocks appended at the bottom).

## Accomplishments

- **`load()` GET header hoist landed** (line 3124) — `X-VMS-Client-Build` header attached when `clientBuildId` is configured; symmetric with performRoundTrip()'s POST-side block. The pattern MATCHES performRoundTrip's exact shape: build a `headers: Record<string, string>` object with the `Accept: "application/json"` + `...extraHeaders` spread, then `if (this.options.clientBuildId) headers[...] = ...`. Comment names SKEW-03 and points to performRoundTrip's ordering invariant.
- **Silent `adapter.reload?.()` at stale_client catch arm RETIRED** (line 3283) — replaced with a single `this.lockSkew()` call (no args; the stale_client envelope carries no build id). The `return;` after is preserved. Comment updated to name SKEW-04 + explain the button-consented reload flow. Consumer opt-out via `onVersionSkew:"custom"` bypasses the lock/stop/modal via lockSkew's internal gate.
- **`checkVersionSkew` mismatch branch EXTENDED** (line 3566) — the shipped onError line stays byte-identical, and a new `this.lockSkew({ clientBuild, serverBuild })` call is APPENDED. Both build ids are in scope from the mismatch check and are threaded to the modal for custom-adapter debugging. Both trigger paths (detection + fail-closed) now route through the single lockSkew helper.
- **`SpyAdapter` extended in test file** (~line 24) — added `skewLocks: number` field alongside `reloads`. `makeAdapter(withReload = true, withSkewLock = true)` now takes a 2nd param controlling the showSkewLock method; default is opt-in, matching the shipped fail-quiet-by-absence posture (adapters without the verb still work — this test verifies both cases).
- **Pre-9.0.0 stale_client test UPDATED in place** (~line 199) — the shipped assertion `expect(spy.reloads).toBe(1)` is REPLACED with `expect(spy.reloads).toBe(0)` + `expect(spy.skewLocks).toBe(1)`. Test name renamed to reflect the new behavior ("surfaces via onError AND hard-locks (via showSkewLock) on a stale_client ok:false response"). Comment names Plan 29-03 as the behavior change. Purpose of the test is preserved — it still asserts the shell's response to a stale_client response, just against the new hard-lock behavior.
- **Pre-9.0.0 fail-quiet test UPDATED in place** (~line 222) — the "adapter has no reload" test now also omits the showSkewLock verb (`makeAdapter(false, false)`) and asserts neither counter increments. Test name updated to "does not throw when the adapter has no reload or showSkewLock (fail-quiet by absence)".
- **4 new describe blocks appended:**
  - `9.0.0 — X-VMS-Client-Build header on GET (SKEW-03)` — 2 tests: header attached when configured; omitted when not configured. Inspects `fetchSpy.mock.calls[0]` (the load() call) rather than `[1]` (the dispatch, per the shipped POST test).
  - `9.0.0 — hard-lock modal on VmsVersionSkewError (SKEW-04)` — asserts `spy.skewLocks === 1`, `onError` fires (signal preserved), subsequent dispatch drops (fetch not called a 2nd time — the guarded queue would throw), and `spy.reloads === 0` (no auto-reload).
  - `9.0.0 — hard-lock modal on stale_client VmsActionError (SKEW-04)` — asserts `spy.skewLocks === 1`, `spy.reloads === 0` (button now consents), `onError` fires with VmsActionError.
  - `9.0.0 — onVersionSkew:'custom' opt-out (SKEW-06)` — asserts `spy.skewLocks === 0` (modal did NOT fire), `onError` fires (signal preserved byte-for-byte from v3.8.0), subsequent dispatch still succeeds (fetch called 2x — not locked).

## Task Commits

Each task was committed atomically on `main`:

1. **Task 1: Hoist X-VMS-Client-Build header into load() (GET path)** — `d521d0f` (feat)
2. **Task 2: Retire silent adapter.reload() on stale_client + wire lockSkew from both trigger sites** — `98fdb38` (feat)
3. **Task 3: Extend version-skew.test.ts with 9.0.0 behavior coverage + update pre-9.0.0 assertions** — `4a70055` (test)

## Files Modified

- `viewmodel-shell/src/index.ts` — 2 commits (feat), +24 lines net across three modification sites. Task 1: +7 net (load() header hoist). Task 2: +8 net (stale_client arm rewrite + checkVersionSkew extension).
- `viewmodel-shell/test/version-skew.test.ts` — 1 commit (test), +117 lines net. SpyAdapter interface + makeAdapter helper updates + 2 pre-9.0.0 test rewrites + 4 new describe blocks appended.

## Gate Verification (pre-plan baseline vs post-plan)

| Gate | Pre-plan | Post-plan |
|------|----------|-----------|
| `cd viewmodel-shell && npm run build` | exit 0 | exit 0 |
| `cd viewmodel-shell && npm run check:test-types` | exit 0 | exit 0 |
| `cd viewmodel-shell && npx vitest run` | 82 files, 1348 tests + 1 skipped | 82 files, **1353 tests** + 1 skipped |
| `cd viewmodel-shell && npx vitest run test/version-skew.test.ts` | 10 tests | **15 tests** (all passing) |
| `grep -c 'X-VMS-Client-Build' src/index.ts` | 2 (doc + POST attach) | **3** (doc + POST attach + GET attach) |
| `grep -c 'SKEW-03' src/index.ts` | 0 | **1** (Task 1 comment) |
| `grep -c 'this.lockSkew(' src/index.ts` | 0 (declared but not called per 29-01 contract-first split) | **2** (stale_client arm no-arg + checkVersionSkew info-arg) |
| `grep -c 'this.lockSkew();' src/index.ts` (no-arg form) | 0 | **1** (stale_client arm) |
| `grep -c 'this.lockSkew({ clientBuild, serverBuild })' src/index.ts` (info-arg form) | 0 | **1** (checkVersionSkew) |
| `grep -c 'SKEW-04' src/index.ts` (skew-04 comment count) | 4 (declared sites from 29-01) | **6** (+1 from stale_client arm rewrite; +1 from checkVersionSkew extension) |
| `grep -c 'this.options.adapter.reload?.()' src/index.ts` | 1 (stale_client arm — the site being retired) | **0** (retired) |
| `grep -c 'describe("9.0.0' test/version-skew.test.ts` | 0 | **4** (four new describe blocks) |
| `grep -c 'skewLocks' test/version-skew.test.ts` | 0 | **9** (SpyAdapter field + makeAdapter init + method + test assertions) |
| `grep -c 'onVersionSkew: "custom"' test/version-skew.test.ts` | 0 | **1** (the opt-out test) |
| `grep -c 'X-VMS-Client-Build' test/version-skew.test.ts` | 4 (shipped POST test + POST-omitted test) | **7** (+ GET test + GET-omitted test + describe title) |

**Note on the plan's stated "grep -c 'X-VMS-Client-Build' returns exactly 2" acceptance criterion:** the plan's target count of 2 assumed a pre-plan baseline of 1, but the actual pre-plan baseline was 2 (one in the ShellOptions.clientBuildId TSDoc at line ~2883, one in performRoundTrip's runtime attachment at line 3207). Post-plan the count is 3 (doc + POST + new GET), which is the plan's intent (+1 from the new GET-side attachment). The intent — "one more X-VMS-Client-Build reference than before, at the new GET site" — is met.

## Byte-Identity Verification (must be unchanged per plan scope)

**`Adapter.showSkewLock?` verb declaration** — untouched (line ~145; owned by Plan 29-01).
**`ShellOptions.onVersionSkew?: "default" | "custom"` opt-out** — untouched (line ~2902; owned by Plan 29-01).
**`private skewLocked = false;` field** — untouched (line 3109; owned by Plan 29-01).
**`private lockSkew(info?)` helper implementation** — untouched (line 3574; owned by Plan 29-01). This plan CALLS it from two sites; it does NOT modify the helper.
**Two `if (this.skewLocked) return;` guards** (dispatch entry line 3309 + processResponse render line 3520) — untouched (owned by Plan 29-01).
**BrowserAdapter.showSkewLock DOM impl** — DOES NOT EXIST YET (owned by Plan 29-06, not this plan). Tests use SpyAdapter's mock method (a one-line counter increment), which is sufficient to prove the shell-side wiring is correct.
**Server-side ShellVersionGuardFilter (.NET) + TS createVersionGuard factory** — untouched (owned by Plans 29-02, 29-04, and 29-05).

## Decisions Made

- **Symmetric header shape between load() and performRoundTrip():** the two paths now use IDENTICAL header construction (build a `Record<string, string>`, spread getRequestHeaders after Accept, add X-VMS-Client-Build if clientBuildId is set, pass the object to fetch). Comment on the load() side names performRoundTrip's ordering invariant explicitly so a future reader sees the parallel immediately.
- **Bare `lockSkew()` from stale_client, info-arg `lockSkew({...})` from checkVersionSkew:** the stale_client envelope from ShellExceptionFilter carries the exception message, not the server's build id — passing `{}` or `{ clientBuild: this.options.clientBuildId }` would be a false signal (the receiver couldn't distinguish "server didn't stamp" from "server stamped an equal value"). The plan explicitly calls out this asymmetry as intentional; lockSkew's signature accepts `undefined` per Plan 29-01's contract.
- **Update pre-9.0.0 tests in place, don't delete:** the plan explicitly requires updating the shipped `spy.reloads === 1` assertion to `spy.reloads === 0 && spy.skewLocks === 1`, with a comment naming Plan 29-03 as the behavior change. This keeps the file's historical structure (3.8.0 describes stay; 9.0.0 describes are appended below) so a future reader sees the behavior change through a diff of the same test, not through the addition of a wholly new test replacing an implicit-deleted old one.
- **Both pre-9.0.0 tests updated symmetrically:** the "fail-quiet by absence" test was also updated (`makeAdapter(false, false)` — no reload verb, no showSkewLock verb — asserts both counters stay 0). Keeps the two shipped stale_client tests aligned on the same behavior surface post-9.0.0.

## Deviations from Plan

None — plan executed exactly as written. All three tasks land with the exact comment text specified. Grep-based acceptance criteria all pass (with the one noted counting-off in the plan's own `X-VMS-Client-Build` baseline reconciled above). No auto-fixes needed; the pre-plan tests were byte-identical to what the plan described.

## Issues Encountered

None. Pre-plan gates (`npm run build`, `npm run check:test-types`) already exited 0. Post-plan the full framework vitest suite went from 1348 tests to 1353 tests (all passing), which is the plan's own expected delta of 4 new tests (2 in the GET-header block + 1 for detection modal + 1 for fail-closed modal + 1 for opt-out) — the +5 is because the opt-out block has one `it`, plus the 2-in-block for GET-header, plus 1 each for detection/fail-closed, giving exactly 5.

## User Setup Required

None. This is a pure client-side wiring change inside `viewmodel-shell/`. No new dependencies, no config, no runtime behavior change for CONSUMERS on their existing shipped `onError` handler (they still receive the same VmsActionError / VmsVersionSkewError). The behavior change is visible to consumers only when they upgrade to the v9.0.0 line AND do not set `onVersionSkew: "custom"` — the modal now hard-locks the page instead of silent auto-reload.

## Next Phase Readiness

- **Plan 29-06 (BrowserAdapter.showSkewLock DOM)** — READY. The shell calls `this.options.adapter.showSkewLock?.(info)` from two sites now; a real BrowserAdapter implementation replaces the SpyAdapter mock in the browser. Plan 29-06 owns the .vms-skew-lock DOM + CSS + jsdom test.
- **Plan 29-04 (TS createVersionGuard factory)** — READY. The client-side GET header attachment landed here means the TS server-subpath global guard has something to enforce against on every request.
- **Plan 29-11 (MIGRATION.md v9.0.0)** — READY to draft the "auto-reload retired" behavior-change note. The updated test in this plan (`spy.reloads === 0 && spy.skewLocks === 1` where the shipped test used to assert `spy.reloads === 1`) IS the executable proof of the behavior change consumers will read about in MIGRATION.md.

## Self-Check: PASSED

**Files created:** verified
- `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-03-SUMMARY.md` — FOUND (this file, written by Write tool)

**Files modified:** verified
- `viewmodel-shell/src/index.ts` — FOUND (3 modification sites, git diff HEAD~2..HEAD confirms)
- `viewmodel-shell/test/version-skew.test.ts` — FOUND (5 modification sites, git diff HEAD~1..HEAD confirms)

**Commits exist:** verified via `git log --oneline -3`
- `d521d0f` — FOUND (Task 1: load() X-VMS-Client-Build header on GET)
- `98fdb38` — FOUND (Task 2: retire silent adapter.reload + wire lockSkew from both trigger sites)
- `4a70055` — FOUND (Task 3: version-skew.test.ts + 4 new describe blocks + 2 updated pre-9.0.0 assertions)

**Vitest exit output confirming all tests pass** — captured verbatim:
```
 ✓ test/version-skew.test.ts (15 tests) 8ms

 Test Files  82 passed (82)
      Tests  1353 passed | 1 skipped (1354)
   Duration  3.03s
```

---
*Phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-*
*Completed: 2026-08-02*
