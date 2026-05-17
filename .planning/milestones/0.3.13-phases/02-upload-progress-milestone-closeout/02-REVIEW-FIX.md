---
phase: 02-upload-progress-milestone-closeout
fixed_at: 2026-05-15T10:09:00Z
review_path: .planning/phases/02-upload-progress-milestone-closeout/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-05-15T10:09:00Z
**Source review:** .planning/phases/02-upload-progress-milestone-closeout/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (`all` = critical + warning + info): 5
- Fixed: 4 (WR-01, WR-02, IN-01, IN-02)
- Skipped: 1 (IN-03 — no change required, traceability-only note)
- Status: `partial` (the single skip is an intentional "no change required" confirmation note, not a failed fix)

The three user-priority findings (WR-01, WR-02, IN-02) are all resolved. IN-01
(in scope under `all`) applied the reviewer's low-risk defensive suggestion.
IN-03 required no change by the reviewer's own statement and is recorded as
intentionally skipped.

## Fixed Issues

### WR-01: `xhr.onload` resolves a Response even when `xhr.status === 0`

**Files modified:** `viewmodel-shell/src/browser.ts`
**Commit:** cf39df1
**Applied fix:** In `xhr.onload`, after emitting the terminal progress, added a
`if (xhr.status === 0) { reject(new Error(\`Transport request to ${input} failed (status 0)\`)); return; }`
guard *before* constructing the `Response`. This is the reviewer's exact fix.
Previously, a CORS/blocked failure that fired `onload` with `status 0` caused
`new Response(body, { status: 0 })` to throw a `RangeError` inside the `onload`
callback (outside the Promise executor), so the Promise never settled and
`dispatch()` hung forever (`dispatching` stuck `true`). Rejecting instead routes
the failure through `dispatch()`'s existing try/catch to `onError` — restoring
the D-08 "byte-identical to fetch on failure" property (fetch rejects on
CORS/network failure). Added an explanatory D-08 comment block.

### WR-02: Request-header / credentials parity gap left by the no-op mock

**Files modified:** `viewmodel-shell/src/browser.ts`, `viewmodel-shell/test/upload-progress.test.ts`
**Commit:** 0d8fc99
**Applied fix:** No wire-behavior change (per locked constraint — `withCredentials`
NOT introduced). Two parts:
1. `browser.ts`: added a WR-02 scope comment at the `setRequestHeader` loop
   documenting that (a) every header `dispatch()` builds in `init.headers`
   (Accept + `getRequestHeaders()`) is applied via `xhr.setRequestHeader`, so
   the XHR path's headers are byte-identical to the fetch path's, and (b) the
   seam is same-origin only (same-origin cookies match fetch's
   `credentials: "same-origin"` default without `withCredentials`; cross-origin
   action endpoints are out of scope).
2. `upload-progress.test.ts`: changed the mock `setRequestHeader` from a no-op
   to recording calls into a `setHeaderCalls` array exposed by the factory;
   added a new `describe("UPLOAD-01 / WR-02 …")` parity test that drives the
   shipped transport XHR path with a custom `getRequestHeaders`, captures the
   headers the XHR path applied, then runs the SAME options through the fetch
   fallback and asserts the XHR-applied headers are byte-identical to the
   `init.headers` the fetch path receives (`{ Accept: "application/json",
   "X-CSRF-Token": "abc123" }`). Closes the gap the no-op mock left open.
   Test count went 14 → 15; all pass.

### IN-01: `xhr.open` defaulted method to `"GET"`

**Files modified:** `viewmodel-shell/src/browser.ts`
**Commit:** 4bbefbc
**Applied fix:** Changed `xhr.open(init.method ?? "GET", input)` to
`xhr.open(init.method ?? "POST", input)` and added an IN-01 comment explaining
the seam only carries body+files action requests, the sole caller
(`dispatch()`) always passes `"POST"`, so defaulting to `"POST"` (not `"GET"`)
prevents a future caller bug from silently producing a body-bearing GET.
Reviewer's recommended low-risk defensive option.

### IN-02: `lastLoaded` terminal emission can legitimately be `(0,0)`

**Files modified:** `viewmodel-shell/src/browser.ts`
**Commit:** 232ec1d
**Applied fix:** Softened the inaccurate `"Explicitly NEVER (0, 0)."` comment
in `xhr.onload` to: "NEVER (0,0) once any progress event has fired; a body that
produces no progress event (e.g. a zero-byte upload, or a transport that
completes before the browser emits any upload progress) legitimately terminates
at (0,0), which the documented `total > 0` consumer guard (MIGRATION.md 5b)
handles." Comment-only change; no behavioral effect.

## Skipped Issues

### IN-03: MIGRATION.md cross-doc consistency confirmation

**File:** `MIGRATION.md:60-62`
**Reason:** No change required — intentionally skipped. The reviewer explicitly
classified this as a confirmation/traceability note, not a defect: the
`ShellOptions.onUploadProgress` signature `(sent, total) => void` is verified
byte-identical to the `Adapter.transport` `hooks.onUploadProgress` signature,
and the version strings / patch-bump rationale / silent-behavior callouts are
all internally consistent with the shipped code. The reviewer's **Fix:** field
states "None required." Recorded here for traceability per the workflow's
explicit instruction — this is an intentional "no change required" skip, NOT a
failed-fix skip.
**Original issue:** "MIGRATION.md states the `onUploadProgress` signature 'is
byte-identical to the already-documented `Adapter.transport` hook.' … the claim
is accurate. This is a confirmation note, not a defect … No change required;
recorded for traceability."

## Verification

All gates re-run after the four fixes (from `viewmodel-shell/`):

- `npm test` → **PASS** (2 test files, 15 tests passed; was 14 before WR-02
  added the parity test). Includes the new WR-02 header-parity assertion and
  all pre-existing D-14 (a–e) cases.
- `npm run check:core-globals` → **PASS, exit 0** (AGNOSTIC-03: `src/index.ts`
  references zero platform globals).
- `npx tsc --noEmit` → **PASS, exit 0** (no type errors).

Locked constraints re-verified intact:
- `viewmodel-shell/package.json` version: `0.3.13` (unchanged).
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj`: `<Version>0.3.9</Version>` (unchanged).
- `grep -c XMLHttpRequest viewmodel-shell/src/index.ts` → `0` (all XHR stays in `browser.ts`; none introduced into core).
- `processResponse()` in `src/index.ts` untouched.
- D-02 silent fetch-fallback path untouched (WR-01 fixed a different path: XHR `onload` with `status 0`).
- `AGENTS.md` versioning rule untouched.

No source files left in a broken state. No uncommitted source changes remain
(pre-existing unrelated working-tree entries — `.planning/config.json`,
deleted `CLAUDE.md`, untracked `viewmodel-shell-dotnet/nupkg/` — were present
before this session and were correctly NOT touched).

---

_Fixed: 2026-05-15T10:09:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
