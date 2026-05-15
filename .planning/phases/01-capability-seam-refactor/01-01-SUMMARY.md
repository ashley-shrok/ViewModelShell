---
phase: 01-capability-seam-refactor
plan: 01
subsystem: framework-core
tags: [typescript, adapter-pattern, capability-seam, platform-agnostic, refactor]
provides:
  - Extended Adapter interface with optional navigate/storage/transport verbs
  - processResponse() routing side-effects + redirect through the adapter seam (D-05/D-06)
  - failCapability() fail-loud helper for missing navigate/storage capabilities
  - BrowserAdapter.navigate / BrowserAdapter.storage / BrowserAdapter.transport implementations
  - viewmodel-shell/src/index.ts now references zero platform globals
affects: [01-02 ci-guard, 01-03 docs, phase-2-upload-progress]
tech-stack:
  added: []
  patterns: [optional-methods-on-Adapter capability seam, fail-loud on missing capability, verbatim binding relocation core->adapter]
key-files:
  created: []
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/src/browser.ts
key-decisions:
  - "Capability seam exposed as optional methods on existing Adapter interface (D-01) — keeps custom Adapter impls non-breaking"
  - "Redirect resolution order onRedirect -> adapter.navigate -> loud error (D-05); onRedirect signature byte-identical (D-04)"
  - "Missing navigate/storage fails loudly via onError/console.error, never silent no-op (D-06) — closes Hecate JWT silent-swallow"
  - "In-core fetch in load()/dispatch() left untouched; transport? is a defined-but-unwired Phase 2 extension point (D-07)"
duration: 3min
completed: 2026-05-15
---

# Phase 1 Plan 01: Capability Seam Refactor Summary

**The 3 core platform-global violations (window.location.href, localStorage, sessionStorage) were relocated out of `viewmodel-shell/src/index.ts` behind a generic optional-verb capability seam implemented in BrowserAdapter — with zero observable behavior change and a fail-loud guarantee replacing the prior silent-no-op risk.**

## Performance
- **Duration:** ~3 min (start 2026-05-15T12:23:36Z, end 2026-05-15T12:25:52Z)
- **Tasks:** 3 / 3 completed
- **Files modified:** 2

## Accomplishments
- `Adapter` interface gained three NEW OPTIONAL members (`navigate?`, `storage?`, `transport?`); `render` stays required and unchanged — existing single-method custom Adapter implementations still compile (verified: build green against BrowserAdapter which only declared `render` before Task 2).
- `BrowserAdapter` now implements `navigate` (verbatim `window.location.href = url` relocated from index.ts:316), `storage` (verbatim `localStorage`/`sessionStorage.setItem` relocated from index.ts:307/309), and a thin `fetch`-backed `transport` passthrough.
- `processResponse()` rewritten to route storage side-effects through `adapter.storage` and redirects through the D-05 order: `onRedirect` (byte-identical to before) -> `adapter.navigate` -> `failCapability("navigate", ...)`. Non-redirect render path is byte-identical to the original.
- `failCapability()` private helper added — surfaces a missing `navigate`/`storage` capability via the file's existing `onError ? onError(err) : console.error(...)` idiom with an explicit correctness/security message. Never a silent no-op (D-06; closes the Hecate JWT-to-localStorage swallow, threats T-01-01 / T-01-02).
- `viewmodel-shell/src/index.ts` now contains **zero** occurrences of `window`, `document`, `localStorage`, `sessionStorage`, `XMLHttpRequest` — the framework's already-claimed "core never references platform types" invariant is now actually true and ready for the Plan 01-02 grep guard.
- In-core `fetch` in `load()`/`dispatch()` untouched (2 occurrences remain — D-07). `onRedirect?: (url: string) => void` signature byte-identical (D-04).
- `cd viewmodel-shell && npm run build` exits 0 (tsc, noEmitOnError) after every task and at final verification.

## Task Commits
1. **Task 1: Extend the Adapter interface with optional navigate/storage/transport verbs** - `a26f18b`
2. **Task 2: Implement navigate/storage/transport in BrowserAdapter (relocate the bindings)** - `34f8327`
3. **Task 3: Rewrite processResponse() to route through the seam (purge the 3 violations, D-05 order, D-06 fail-loud)** - `b71e763`

## Files Created/Modified
- `viewmodel-shell/src/index.ts` - Extended `Adapter` interface (optional `navigate`/`storage`/`transport`); rewrote `processResponse()` to route side-effects + redirect through the adapter seam; added `failCapability()` helper; updated stale `onRedirect` doc comment; purged all 3 platform-global bindings.
- `viewmodel-shell/src/browser.ts` - Added `navigate()`, `storage()`, and a `fetch`-backed `transport()` to `BrowserAdapter` (verbatim relocations of the bindings formerly in core).

## Decisions & Deviations

### Decisions (followed plan / honored CONTEXT.md)
- D-01: optional-methods-on-Adapter seam shape (non-breaking for custom adapters).
- D-02: `storage(scope, key, value)` write-only signature.
- D-03: bindings relocated verbatim into BrowserAdapter (moves *where*, not *what*).
- D-04: `onRedirect?: (url: string) => void` preserved byte-identical.
- D-05: redirect resolution order onRedirect -> adapter.navigate -> loud error; precedence preserved.
- D-06: fail-loud via `failCapability()` (onError/console.error), never silent no-op.
- D-07: in-core `fetch` untouched; `transport?` defined but unwired (Phase 2 extension point).

### Deviations from Plan

**Auto-fixed Issues**

**1. [Rule 3 - Blocking / Rule 1 - Plan internal inconsistency] Rephrased two doc comments to avoid denylist tokens**
- **Found during:** Task 3 (zero-token verification)
- **Issue:** The plan's verbatim Task 1 comment text contained the literal strings `document` (in the Adapter-interface block comment: "The core never references HTMLElement, document, or any platform global") and `window.location.href` (in the `navigate?` JSDoc: "browser: window.location.href = url"). These textual occurrences directly contradict Task 3's explicit hard acceptance criterion ("`index.ts` contains NONE of these tokens **anywhere in the file**"), this plan's own `<success_criteria>`, and the Plan 01-02 grep guard denylist (D-09: "any hit fails the build"). Two parts of the plan were internally inconsistent: the verbatim Task 1 comment wording vs. the absolute zero-token invariant the phase exists to establish.
- **Fix:** Rephrased both comments to convey identical meaning without any denylist token:
  - Adapter block comment -> "The core references zero platform globals (this is a CI-enforced invariant) —"
  - `navigate?` JSDoc -> "Hand the platform off to a URL (the browser adapter sets the page location)."
  The plan explicitly grants comment/error-message prose to Claude's discretion; the zero-token invariant is non-negotiable and is the entire point of the phase.
- **Files modified:** `viewmodel-shell/src/index.ts`
- **Commit:** `b71e763`

Note: The Shell-section comment at index.ts ("fetch is universal (browsers, Node 18+, Deno) so it belongs in the core") legitimately remains — it contains the word "browsers" but no denylist token, and it is the D-07 rationale that must stay.

## Authentication Gates
None — no auth required during execution.

## Next Phase Readiness
- **Plan 01-02 (CI guard):** `viewmodel-shell/src/index.ts` now passes the zero-token denylist (`window`/`document`/`localStorage`/`sessionStorage`/`XMLHttpRequest` = 0 matches) — the grep guard can be added and will pass on the current tree.
- **Plan 01-03 (docs):** The capability-seam pattern, redirect resolution order (D-05), and fail-loud rule (D-06) are implemented and stable for AGENTS.md / README documentation.
- **Verification gate (D-12):** This plan's correctness is NOT yet fully proven — by construction (D-13), parity proves the wire contract is unchanged but does NOT prove the core->adapter relocation fires. The adapter-level jsdom/vitest test (D-12.2: `BrowserAdapter.navigate` performs navigation, `onRedirect` precedence, `BrowserAdapter.storage` writes) is a required deliverable established/run in Plan 01-02. Phase 1 is not done until that dual gate passes.
- **Phase 2 (UPLOAD-01):** `transport?(input, init, hooks?)` is shaped to carry an `onUploadProgress` callback — Phase 2 can plug an XHR binding into BrowserAdapter via the `hooks` arg with no Phase-1 wire or public-API change.

## Self-Check: PASSED
- Files verified: `viewmodel-shell/src/index.ts`, `viewmodel-shell/src/browser.ts`, `.planning/phases/01-capability-seam-refactor/01-01-SUMMARY.md` — all present.
- Commits verified: `a26f18b`, `34f8327`, `b71e763` — all present in git history.
