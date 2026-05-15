---
phase: 02-upload-progress-milestone-closeout
plan: 01
subsystem: api
tags: [xhr, upload-progress, capability-seam, transport, fetch, formdata]

# Dependency graph
requires:
  - phase: 01-capability-seam-refactor
    provides: "Adapter.transport?(input, init, hooks?) seam shape with hooks.onUploadProgress (locked index.ts:32-37), BrowserAdapter.transport fetch-passthrough stub, check:core-globals CI guard scoped to src/index.ts"
provides:
  - "ShellOptions.onUploadProgress?: (sent: number, total: number) => void — additive public API"
  - "dispatch() three-condition transport-routing branch (files && onUploadProgress && adapter.transport)"
  - "BrowserAdapter.transport XHR upload-progress branch (xhr.upload.onprogress, real Response reconstruction)"
  - "UPLOAD-01 structurally implemented through the capability seam (zero XMLHttpRequest in core)"
affects: [02-02 (mock-XHR unit test extends this binding), 02-03 (MIGRATION.md + version bump documents this public-API addition + parity gate)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First feature built *through* the Phase 1 capability seam: core gains one additive ShellOptions field + one dispatch() routing branch; all XMLHttpRequest lives in BrowserAdapter"
    - "Asymmetric transport verb: missing adapter.transport silently falls back to in-core fetch (D-02), unlike navigate/storage fail-loud"
    - "XHR branch resolves a real Response so the shared processResponse() path is byte-identical regardless of transport (D-08)"

key-files:
  created: []
  modified:
    - "viewmodel-shell/src/index.ts — ShellOptions.onUploadProgress + dispatch() transport-routing branch"
    - "viewmodel-shell/src/browser.ts — BrowserAdapter.transport XHR upload-progress branch"

key-decisions:
  - "D-03: onUploadProgress signature byte-identical to the locked Adapter.transport hook; purely additive"
  - "D-01/D-02: route through adapter.transport only when files+callback+adapter.transport all present; missing transport is a SILENT fetch fallback (no failCapability)"
  - "D-05: terminal emission mirrors what was reported — (knownTotal,knownTotal) when known, (lastLoaded,lastLoaded) when indeterminate; never (0,0)"
  - "D-07/D-08: XHR error/timeout/abort reject the Promise (reuses dispatch try/catch → onError); resolves a real Response so processResponse() is untouched"

patterns-established:
  - "Feature-through-the-seam: a new platform binding (XHR) enters via BrowserAdapter behind a capability verb, never into core src/index.ts"
  - "Indeterminate-total sentinel (total === 0) for non-lengthComputable uploads; consumer-facing divide-by-zero guidance deferred to MIGRATION.md (plan 02-03, D-05a)"

requirements-completed: [UPLOAD-01]

# Metrics
duration: 2min
completed: 2026-05-15
---

# Phase 2 Plan 01: Upload Progress Through the Seam Summary

**`ShellOptions.onUploadProgress(sent,total)` shipped as the first feature built *through* the Phase 1 capability seam — one additive core field + one `dispatch()` routing branch, with the entire XHR `upload.onprogress` binding confined to `BrowserAdapter.transport` and zero `XMLHttpRequest` in core.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-15T13:34:00Z
- **Completed:** 2026-05-15T13:36:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added the additive `ShellOptions.onUploadProgress?: (sent: number, total: number) => void` field — signature byte-identical to the locked `Adapter.transport` hook (D-03); no existing `ShellOptions`/`Adapter` member changed.
- `dispatch()` now routes the POST through `adapter.transport` only when `action.files && this.options.onUploadProgress && adapter.transport` all hold (D-01); every other case runs the unchanged in-core `fetch`. Missing `adapter.transport` (or no files / no callback) is a SILENT fallback to fetch — no `failCapability` (D-02; `transport` is the asymmetric verb per Phase 1 D-07).
- `BrowserAdapter.transport` implements the XHR branch: falsy `onUploadProgress` → identical `fetch` passthrough; otherwise binds `xhr.upload.onprogress` with the exact D-05 in-flight rule (computable → `(loaded,total)`; not → `(loaded,0)`) and the exact D-05 terminal rule (`(knownTotal,knownTotal)` when known, `(lastLoaded,lastLoaded)` when indeterminate — never `(0,0)`).
- XHR `error`/`timeout`/`abort` reject the returned Promise so the existing `dispatch()` try/catch → `onError` handles it with no new error channel (D-07); the branch resolves a real `Response` from `xhr.status`/`statusText`/`responseText` so the shared `processResponse()` path is byte-identical (D-08).
- `processResponse()` (index.ts ~337-362) and the `Adapter` interface (lines 19-37) are byte-unchanged; `npm run check:core-globals` exits 0; `XMLHttpRequest` count in `src/index.ts` == 0 (ROADMAP success criterion 2); all 8 existing vitest tests still pass.

## Task Commits

Each task was committed atomically (with hooks, specific files staged):

1. **Task 1: ShellOptions.onUploadProgress + dispatch() transport-routing branch** - `6a6ac6b` (feat)
2. **Task 2: XHR upload-progress branch in BrowserAdapter.transport** - `0af91ed` (feat)

**Plan metadata:** _(final docs commit)_

## Files Created/Modified
- `viewmodel-shell/src/index.ts` - Added `ShellOptions.onUploadProgress` field (after `onRedirect?`, before `pollInterval?`); replaced the `dispatch()` fetch send + response lines with a shared-`init` three-condition `adapter.transport` vs `fetch` routing branch. +15/-2, two hunks only (ShellOptions ~217, dispatch ~298).
- `viewmodel-shell/src/browser.ts` - Replaced the `BrowserAdapter.transport` fetch-passthrough body with an XHR upload-progress branch (third optional `hooks?` param; falsy-hook → fetch; else `XMLHttpRequest` + `xhr.upload.onprogress` + real `Response` reconstruction + error/timeout/abort reject). +51/-3.

## Decisions Made
None - followed plan as specified. All decisions (D-01..D-09) were pre-locked in 02-CONTEXT.md and implemented exactly as written.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The `commit_docs` config is true; pre-existing untracked/modified files (`viewmodel-shell-dotnet/nupkg/`, `.planning/config.json`, deleted `CLAUDE.md`) were present before this plan and are out of scope — not touched.

## Verification Results
- `cd viewmodel-shell && npx tsc -p tsconfig.json --noEmit` → exit 0 (both tasks)
- `cd viewmodel-shell && npm run check:core-globals` → exit 0 ("AGNOSTIC-03: src/index.ts references zero platform globals")
- `XMLHttpRequest` count in `viewmodel-shell/src/index.ts` → **0** (ROADMAP success criterion 2; still only in `browser.ts`)
- All Task 1 + Task 2 structural string-checks pass (onUploadProgress field, routing condition, `new XMLHttpRequest()`, `xhr.upload.onprogress`, `lengthComputable`, `new Response(xhr.responseText`, both completion paths, error/timeout/abort reject, falsy-hook fetch path)
- `git diff` confirms `processResponse()` and `Adapter` interface byte-unchanged (index.ts diff is 2 hunks: ShellOptions + dispatch only)
- `npx vitest run` → 8/8 existing tests pass (no regression). _Note: the net-new mock-XHR behavioral unit test (D-14) is plan 02-02's scope; full parity gate is plan 02-03's scope._

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UPLOAD-01 is structurally complete and verified. Plan 02-02 can now extend `test/adapter-seam.test.ts` with the mock-XHR behavioral unit test (D-14) against the binding shipped here.
- Plan 02-03 documents this single public-API addition in `MIGRATION.md` (incl. the D-05a `total === 0` divide-by-zero guard), bumps npm to `0.3.13` (NuGet unchanged `0.3.9`), and runs the full parity gate.
- No blockers. Behavioral proof (callback fires/never-fires, indeterminate terminal emission) is deferred to plan 02-02's unit test by design — this plan delivered the structural implementation only, exactly as scoped.

## Self-Check: PASSED

- FOUND: `.planning/phases/02-upload-progress-milestone-closeout/02-01-SUMMARY.md`
- FOUND: `viewmodel-shell/src/index.ts`
- FOUND: `viewmodel-shell/src/browser.ts`
- FOUND commit: `6a6ac6b` (Task 1)
- FOUND commit: `0af91ed` (Task 2)

---
*Phase: 02-upload-progress-milestone-closeout*
*Completed: 2026-05-15*
