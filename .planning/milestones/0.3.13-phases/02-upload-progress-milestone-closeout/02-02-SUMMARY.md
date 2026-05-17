---
phase: 02-upload-progress-milestone-closeout
plan: 02
subsystem: testing
tags: [vitest, jsdom, mock-xhr, upload-progress, behavioral-test, capability-seam]

# Dependency graph
requires:
  - phase: 02-upload-progress-milestone-closeout
    plan: 01
    provides: "ShellOptions.onUploadProgress + dispatch() three-condition transport-routing branch + BrowserAdapter.transport XHR upload-progress branch (the shipped binding this test exercises)"
  - phase: 01-capability-seam-refactor
    provides: "test/adapter-seam.test.ts net-new jsdom/vitest harness pattern (NodeNext ../src/*.js specifiers, freshContainer(), afterEach vi.restoreAllMocks()) — the D-12.2 pattern this test mirrors"
provides:
  - "viewmodel-shell/test/upload-progress.test.ts — D-14 (a)-(e) mock-XHR behavioral proof of UPLOAD-01"
  - "Gating coverage: the test runs under existing `npm test` (vitest/jsdom) and the CI parity.yml adapter-seam step (test/**/*.test.ts glob auto-pickup)"
affects: [02-03 (MIGRATION.md + version bump + full parity gate — this test is the behavioral half of UPLOAD-01's verification surface)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mock-XMLHttpRequest under jsdom drives the SHIPPED BrowserAdapter.transport (not a re-implementation) — the established 'no real browser for tests' verification idiom extended to a byte-level XHR binding (anti-mock-masking T-02-05)"
    - "shell.push({vm,state}) seeds dispatch()'s currentState!==null precondition without any network — reused from the Phase-1 adapter-seam harness"
    - "queueMicrotask in the mock's send() defers event delivery so the Promise inside transport() is wired before resolution — mirrors real async XHR delivery"

key-files:
  created:
    - "viewmodel-shell/test/upload-progress.test.ts — 6 it() cases (5 describe blocks = D-14 a/b/c/d/e; b has b1+b2) driving real BrowserAdapter.transport + ViewModelShell.dispatch() via a controllable mock XHR"
  modified: []

key-decisions:
  - "D-14: five behaviors authored as separate describe blocks; (b) split into b1 (files absent, option set) + b2 (files present, option unset) as two it() cases — both prove the fetch path is taken and the callback never fires"
  - "D-15: ONLY the test file created; no demo, no FeatureProbe, no parity fixture, no src/ change — git status --porcelain shows upload-progress.test.ts as the sole new artifact"
  - "TDD-on-shipped-source: the implementation was shipped in 02-01, so RED means authoring genuinely-exercising assertions (cases a/d/e run production BrowserAdapter.transport + processResponse, so a broken 02-01 wiring would fail them) rather than reverting source"

patterns-established:
  - "Behavioral verification of a browser-runtime-only binding = mock-platform-primitive under jsdom driving the real shipped adapter through ViewModelShell, asserting exact tuples/rendered-VM (not the binding re-implemented in the test)"

requirements-completed: [UPLOAD-01]

# Metrics
duration: 2min
completed: 2026-05-15
---

# Phase 2 Plan 02: UPLOAD-01 Mock-XHR Behavioral Verification Summary

**A net-new `viewmodel-shell/test/upload-progress.test.ts` proves UPLOAD-01's D-14 (a)–(e) by driving the *real shipped* `BrowserAdapter.transport` + `ViewModelShell.dispatch()` with a controllable mock `XMLHttpRequest` under jsdom — cases a/d/e exercise production code (anti-mock-masking T-02-05), including the highest-risk rules: (c) fetch-fallback fires no progress and no error, and (e) an indeterminate completion is `(73,73)` and never `(0,0)`.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-15T13:40:25Z
- **Completed:** 2026-05-15T13:42:05Z
- **Tasks:** 1
- **Files created:** 1

## Accomplishments
- Created `viewmodel-shell/test/upload-progress.test.ts` mirroring the Phase-1 D-12.2 adapter-seam harness exactly: `import … from "../src/index.js"` / `"../src/browser.js"` NodeNext specifiers (local source, NOT the published package), a `freshContainer()` helper, `beforeEach` storage clear, `afterEach(() => vi.restoreAllMocks())`.
- Defined a controllable mock `XMLHttpRequest` (per-test scriptable progress steps + response body) installed via `vi.stubGlobal("XMLHttpRequest", MockXHR)`; its `send()` defers via `queueMicrotask` then replays `upload.onprogress` step(s) and `onload` against the **shipped** `BrowserAdapter.transport` XHR branch.
- **(a)** A files-bearing dispatch with `onUploadProgress` set drives the real transport: asserts `calls` contains `[50,100]` (in-flight, D-05 computable) and `calls.at(-1)` is `[100,100]` (terminal, knownTotal>0), plus the mock's `open()` ran `POST /api/x/action` (proves the routing branch selected transport, not fetch).
- **(b1)** Files absent + option set → core `fetch` path taken (stubbed), `calls` length 0. **(b2)** Files present + option unset → core `fetch` path taken, `calls` length 0. Both also assert `fetch` was called with the action endpoint + `method: POST`.
- **(c)** Render-only adapter `{ render() {} }` (no `transport`) + `onUploadProgress` set + files present: D-02 silent fetch fallback — dispatch resolves, `calls` length 0, **`onError` never called** (explicitly NOT fail-loud, unlike navigate/storage).
- **(d)** A files-bearing dispatch via the mock XHR resolves a real `Response` whose JSON is `{ vm: {type:"text",value:"updated"}, state:{} }`; asserts `shell.getCurrentVm()` is `{type:"text",value:"x"}` *before* and `{type:"text",value:"updated"}` *after* — proving the reconstructed `Response` traversed the unchanged shared `processResponse()` (D-08).
- **(e)** Mock XHR emits `lengthComputable:false, loaded:73`; asserts `calls` contains the in-flight indeterminate sentinel `[73,0]`, the terminal is `expect(calls.at(-1)).toEqual([73,73])` **AND** `expect(calls.at(-1)).not.toEqual([0,0])` (D-05 / D-05a divide-by-zero hazard guard).
- `npm test` exits 0: **14/14** (8 pre-existing `adapter-seam.test.ts` still green + 6 new); `npm run check:core-globals` exits 0 (test file provoked no core change); `git status --porcelain` shows the test file as the only new artifact (D-15 boundary held).

## Task Commits

Each task was committed atomically (with hooks, specific file staged):

1. **Task 1: Net-new mock-XHR jsdom/vitest test asserting D-14 (a)-(e)** — `3c297db` (test)

**Plan metadata:** _(final docs commit)_

## Files Created/Modified
- `viewmodel-shell/test/upload-progress.test.ts` *(created, +314)* — 5 `describe` blocks mapping 1:1 to D-14 (a)–(e); 6 `it()` cases ((b) = b1+b2). Contains `onUploadProgress`, `XMLHttpRequest`, `lengthComputable`, `getCurrentVm`. Cases a/d/e use a real `new BrowserAdapter(freshContainer())`; case c uses a render-only `{ render() {} }` adapter + stubbed `fetch`.

## Decisions Made
- (b) was authored as two `it()` cases (b1: files absent/option set; b2: files present/option unset) inside one `describe` — the plan's `<behavior>` explicitly enumerates both sub-conditions; two cases give precise failure attribution. Total `it()` count is 6 across 5 D-14 `describe` blocks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed a stray duplicate mock-XHR construction in case (d)**
- **Found during:** Task 1 (self-review immediately after authoring, before first test run)
- **Issue:** The first draft of the (d) case constructed `makeMockXHR()` twice (once directly, once inside an IIFE), stubbing `XMLHttpRequest` redundantly and leaving an unused mock — a latent confusion/correctness smell, not a passing-test masker.
- **Fix:** Collapsed to a single `const { MockXHR, setScript } = makeMockXHR(); vi.stubGlobal(...)`.
- **Files modified:** `viewmodel-shell/test/upload-progress.test.ts`
- **Commit:** `3c297db` (folded into the single task commit — the fix was applied before any commit)

No other deviations. Cases, harness style, import specifiers, and the D-15 boundary were executed exactly as the plan specified.

## Issues Encountered
None. Pre-existing untracked/modified files (`.planning/config.json` modified, `CLAUDE.md` deleted, `viewmodel-shell-dotnet/nupkg/` untracked) were present before this plan (documented as out-of-scope in 02-01-SUMMARY) — not touched.

## Verification Results
- `cd viewmodel-shell && npx vitest run test/upload-progress.test.ts` → **6/6 pass** (exit 0)
- `cd viewmodel-shell && npm test` → **14/14 pass** (exit 0; 8 pre-existing adapter-seam + 6 new — no regression)
- `cd viewmodel-shell && npm run check:core-globals` → exit 0 ("AGNOSTIC-03: src/index.ts references zero platform globals")
- `git status --porcelain` → only `?? viewmodel-shell/test/upload-progress.test.ts` is new; **no** modification to `src/index.ts`, `src/browser.ts`, `test/adapter-seam.test.ts`, `parity/`, FeatureProbe, or any demo (D-15 held)
- Acceptance-criteria string checks: file contains `onUploadProgress`, `XMLHttpRequest`, `lengthComputable`, `getCurrentVm`; five D-14 `describe` blocks; (e) has both `.toEqual([73, 73])` and `.not.toEqual([0, 0])`; (c) asserts `calls` length 0 AND `onError` not called

## Threat Model Verification
- **T-02-05 (mock could mask a real defect):** mitigated as planned — cases (a)/(d)/(e) drive the *shipped* `BrowserAdapter.transport` (real `../src/browser.js`) and the unchanged `processResponse()`; (e) asserts the exact `(73,73)` / not-`(0,0)` rule and (d) asserts the real rendered `getCurrentVm()`, so the mock cannot trivially pass a broken binding.
- **T-02-06 (coverage gap):** accepted as planned — D-14's five mandatory cases are encoded as explicit `it()` cases picked up by the CI `parity.yml` adapter-seam step (`npx vitest run`, gating).
- No new threat surface introduced: the plan is test-only, adds no runtime code, weakens no security posture.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UPLOAD-01 is now both structurally implemented (02-01) and behaviorally verified (02-02). Plan 02-03 can proceed with MIGRATE-01: `MIGRATION.md` + README pointer, npm `0.3.13` (patch, D-10), NuGet unchanged `0.3.9` (D-11), `AGENTS.md` versioning rule NOT changed (D-10a), and the full parity gate.
- No blockers.

## Self-Check: PASSED

- FOUND: `viewmodel-shell/test/upload-progress.test.ts`
- FOUND: `.planning/phases/02-upload-progress-milestone-closeout/02-02-SUMMARY.md`
- FOUND commit: `3c297db` (Task 1)

---
*Phase: 02-upload-progress-milestone-closeout*
*Completed: 2026-05-15*
