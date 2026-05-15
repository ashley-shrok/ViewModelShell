---
phase: 02-upload-progress-milestone-closeout
reviewed: 2026-05-15T10:05:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/test/upload-progress.test.ts
  - viewmodel-shell/package.json
  - MIGRATION.md
  - README.md
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-05-15T10:05:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the Phase 2 diff (`6a6ac6b^..HEAD`) covering UPLOAD-01 (the `ShellOptions.onUploadProgress`
field + `dispatch()` routing branch in `src/index.ts`, and the XHR upload-progress binding in
`BrowserAdapter.transport` in `src/browser.ts`), the net-new jsdom/vitest harness, and MIGRATE-01
(MIGRATION.md + the npm `0.3.13` patch bump).

The five key correctness properties from the phase intent all hold:

1. **Routing + silent fallback** — `dispatch()` (`index.ts:308`) gates on the correct three-condition
   guard (`action.files && this.options.onUploadProgress && adapter.transport`) and falls through to
   the plain `fetch` `else` branch when `adapter.transport` is absent. It does **not** throw or
   fail-loud — consistent with the locked Phase 1 D-07 design (verified by test case `D-14 (c)`).
2. **XHR progress emission rule** — in-flight emits `(loaded,total)` when `lengthComputable` else
   `(loaded,0)`; terminal emits `(knownTotal,knownTotal)` when known else
   `(lastLoaded,lastLoaded)`. The `(0,0)` terminal value is correctly avoided in all normal cases.
3. **Error/timeout/abort** — `onerror`/`ontimeout`/`onabort` all `reject(...)`, so the existing
   `dispatch()` try/catch routes them to `onError` exactly like a failed fetch.
4. **Shared response path** — the XHR branch resolves a real `Response`, so `res.ok` /
   `await res.json()` / `processResponse()` is byte-identical to the fetch path (verified by
   `D-14 (d)`). One caveat is documented in WR-01 below (`xhr.status === 0`).
5. **No `XMLHttpRequest` in core** — confirmed: `npm run check:core-globals` passes; the only
   `XMLHttpRequest` reference is in `src/browser.ts`.

`MIGRATION.md` correctly states npm `0.3.13` (not `0.4.0`) and `package.json` is `0.3.13`; the
test suite (14 tests) and the AGNOSTIC-03 CI guard both pass. The findings below are all
non-blocking edge-case / quality items; none affect the locked design decisions.

## Warnings

### WR-01: `xhr.onload` resolves a Response even when `xhr.status === 0` (network-level failure that didn't trigger `onerror`)

**File:** `viewmodel-shell/src/browser.ts:101-115`
**Issue:** `xhr.onload` unconditionally builds `new Response(xhr.responseText, { status: xhr.status, statusText: xhr.statusText })`. In some browser failure modes — notably a CORS rejection or certain aborted/blocked requests — `onload` can fire (or `xhr.status` is `0`) without `onerror` firing. `new Response(body, { status: 0 })` throws a `RangeError: init["status"] must be in the range of 200 to 599` because the Fetch `Response` constructor rejects status `0`. That `RangeError` is thrown *inside the `onload` callback*, which runs outside the `Promise` executor's synchronous frame, so it is **not** caught by the `Promise` rejection path — the Promise never settles and `dispatch()` hangs (no `onError`, `dispatching` stuck `true`, all subsequent dispatches silently no-op via the `if (this.dispatching) return;` guard at `index.ts:279`). The plain `fetch` path does not have this failure mode (a CORS/network failure rejects the fetch promise, caught by the existing try/catch). This is a real divergence from the "byte-identical to fetch" property and a potential hard-lock of the shell.
**Fix:** Treat `xhr.status === 0` as a transport failure (reject), and guard the `Response` construction so a malformed status can never throw inside `onload`:
```ts
xhr.onload = () => {
  if (knownTotal > 0) onUploadProgress(knownTotal, knownTotal);
  else onUploadProgress(lastLoaded, lastLoaded);
  if (xhr.status === 0) {
    reject(new Error(`Transport request to ${input} failed (status 0)`));
    return;
  }
  resolve(
    new Response(xhr.responseText, {
      status: xhr.status,
      statusText: xhr.statusText,
    }),
  );
};
```

### WR-02: Request headers set before `xhr.open()` completes vs. response-type/cookie parity not covered

**File:** `viewmodel-shell/src/browser.ts:83-86`
**Issue:** Header fidelity between the XHR path and the fetch path is asserted nowhere in the new harness — the mock `setRequestHeader()` is an explicit no-op (`upload-progress.test.ts:64-66`), and the comment defers it to "parity." The fetch path sends `credentials: same-origin` by default; `XMLHttpRequest.withCredentials` defaults to `false`, but for *same-origin* requests both send cookies, so the common case matches. However, the XHR path never sets `withCredentials`, so a consumer whose `actionEndpoint` is cross-origin (uncommon but allowed — `actionEndpoint` is a free-form string) would silently drop cookies on the upload-progress path while the fetch fallback keeps them. This is a behavioral divergence not covered by the "byte-identical" claim in MIGRATION.md section 3. Not a crash, but a latent correctness gap for cross-origin action endpoints.
**Fix:** Either explicitly document that `transport()` is same-origin only, or mirror fetch's credentials behavior by adding a parity assertion and, if cross-origin is intended to be supported, set `xhr.withCredentials = true` to match `fetch`'s `same-origin` default for the same-origin case is already fine — the action item is to add a parity test asserting headers/credentials match, closing the gap the no-op mock leaves open.

## Info

### IN-01: `xhr.open` defaults method to `"GET"` but a GET with a body is non-sensical for this seam

**File:** `viewmodel-shell/src/browser.ts:83`
**Issue:** `xhr.open(init.method ?? "GET", input)` defaults to `"GET"` when `init.method` is undefined, then `xhr.send(init.body ?? null)` would attempt to send a body on a GET (XHR silently ignores the body on GET, but this is a latent inconsistency). In practice `dispatch()` always passes `method: "POST"` in `init` (`index.ts:303`), so this default is unreachable from the shipped call site — hence Info, not Warning. The `"GET"` default is dead/defensive code that could mask a future caller bug.
**Fix:** Since the only caller always supplies `POST`, consider defaulting to `"POST"` (matching the realistic transport use) or asserting `init.method` is present. Low priority — purely defensive.

### IN-02: `lastLoaded` terminal emission can still legitimately be `(0,0)` when no progress event ever fires

**File:** `viewmodel-shell/src/browser.ts:101-106`
**Issue:** The comment states the terminal emission is "Explicitly NEVER (0, 0)." That is true only if at least one `upload.onprogress` event fires before `onload`. For a zero-byte body (or a transport that completes so fast the browser emits no upload progress event), `knownTotal` stays `0` and `lastLoaded` stays `0`, so the terminal emission is `(0,0)` — exactly the value the comment claims is impossible. MIGRATION.md (5b) tells consumers to guard `total > 0`, so a correctly-written consumer is unaffected, but the in-code comment overstates the guarantee. This is a documentation/comment-accuracy issue, not a behavioral bug (a 0-byte file upload is a degenerate case and the guard in the migration doc covers it).
**Fix:** Soften the comment to "NEVER (0,0) once any progress event has fired; a body that produces no progress event legitimately terminates at (0,0), which the documented `total > 0` consumer guard handles."

### IN-03: MIGRATION.md WR-02 fix paragraph in section 2 references `Adapter.transport` hook as "already-documented" — verify cross-doc consistency

**File:** `MIGRATION.md:60-62`
**Issue:** MIGRATION.md states the `onUploadProgress` signature "is byte-identical to the already-documented `Adapter.transport` hook." The `Adapter.transport` `hooks.onUploadProgress` signature in `src/index.ts:35` is `(sent: number, total: number) => void` and the `ShellOptions.onUploadProgress` at `index.ts:223` matches exactly — so the claim is accurate. This is a confirmation note, not a defect: the version strings (npm `0.3.13`, NuGet unchanged `0.3.9`), the patch-bump rationale, and the two silent-behavior callouts (5a fetch fallback, 5b `total === 0` guard) are all internally consistent with the shipped code. No change required; recorded for traceability.
**Fix:** None required — included to document that the MIGRATE-01 doc was cross-checked against the implementation and is consistent.

---

_Reviewed: 2026-05-15T10:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
