---
phase: 10-fits-node
plan: 01
subsystem: layout-system
tags: [fits-node, view-that-fits, measure-and-pick, resize-observer, wire-type]
requires: []
provides:
  - "FitsNode wire type (TS ViewNode union + .NET record + [JsonDerivedType] discriminator)"
  - "BrowserAdapter.fits() measure-and-pick renderer + fitsObservers lifecycle"
  - ".vms-fits structural CSS rule"
affects:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/styles/default.css
  - viewmodel-shell-dotnet/ViewModels.cs
  - viewmodel-shell/test/fits.test.ts
tech-stack:
  added: []
  patterns:
    - "Per-render ResizeObserver registry disconnected at the top of render() (mirrors detailsOpenSnapshot/sectionKeyCounter reset idiom)"
    - "Synchronous measure-and-pick (no flash); 1px overflow tolerance; clientWidth===0 no-layout last-child fallback"
key-files:
  created:
    - viewmodel-shell/test/fits.test.ts
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/styles/default.css
    - viewmodel-shell-dotnet/ViewModels.cs
decisions:
  - "Measurement (ResizeObserver + DOM reads) lives ONLY in browser.ts; core index.ts gains the FitsNode TYPE only → check:core-globals stays green"
  - "axis is a closed TS union ('horizontal'|'vertical'|'both'), free-form string? in .NET with [JsonIgnore(WhenWritingNull)]; omitted = absent on wire = 'horizontal'"
  - "Children ordered preferred/widest FIRST → safe-fallback/narrowest LAST (SwiftUI ViewThatFits direction)"
metrics:
  duration: ~20m
  completed: 2026-06-24
---

# Phase 10 Plan 01: Fits Node (wire type + measure-and-pick renderer) Summary

Added the `fits` node — the SwiftUI `ViewThatFits` port — to the wire on both backends plus the real layout-measurement renderer in `browser.ts`. The renderer measures available container width via a `ResizeObserver` and synchronously picks the FIRST child that does not overflow the axis (1px tolerance), falling back to the LAST (guaranteed-fits) child; in no-layout contexts (`clientWidth === 0`) it renders only the last child. ResizeObservers are tracked per-render and disconnected at the top of `render()` so they never leak.

## What was built

- **Task 1 — wire type (both backends):** `FitsNode { type:"fits"; axis?:"horizontal"|"vertical"|"both"; children }` added to the TS `ViewNode` union + interface (with a prominent doc-comment on the preferred-first/fallback-last ordering and the horizontal default), and a `.NET` `FitsNode` record + `[JsonDerivedType(typeof(FitsNode),"fits")]` discriminator with `[JsonIgnore(WhenWritingNull)] string? Axis`. (commit `a58e2d5`)
- **Task 2 — renderer + lifecycle + CSS:** `BrowserAdapter.fits()` measure-and-pick (synchronous, no-flash, 1px tolerance, `clientWidth===0`→last-child no-layout path), the `fitsObservers: ResizeObserver[]` field, the disconnect-and-clear at the top of `render()` before the `innerHTML` wipe, the `fits` case in `node()` dispatch, and the minimal `.vms-fits { display: block; }` structural rule in `default.css`. Measurement stays entirely in `browser.ts`. (commit `db8c276`)
- **Task 3 — tests (TDD GREEN):** `test/fits.test.ts` (10 tests) covering structure (`.vms-fits` container), the no-layout last-child fallback, axis acceptance for all three values + omitted, and the ResizeObserver lifecycle (one observer registered per container; disconnected on the next render; two-fits-both-disconnected). Header comment documents that real measure-and-pick is NOT jsdom-testable (no layout engine) and is verified by Phase 11 human review. (commit `39b65c5`)

## Deviations from Plan

**1. [Rule 3 - Blocking] Stubbed `window.scrollTo` in the test's `beforeEach`**
- **Found during:** Task 3.
- **Issue:** `render()` calls `window.scrollTo` for scroll preservation, which jsdom does not implement → a "Not implemented" stderr log on every render in the suite.
- **Fix:** Added `window.scrollTo = () => {}` in `beforeEach` (the same approach `browser-scroll.test.ts` already uses). No assertion changed; this only suppresses unrelated jsdom noise. (Note: other pre-existing suites, e.g. `conformance.browser.test.ts`, still emit the same stderr log — out of scope for this plan.)

No other deviations — plan executed as written.

## TDD note

The plan marks Task 3 `tdd="true"`, but the implementation (Tasks 1–2) necessarily preceded the test (a renderer must exist for `fits.test.ts` to assert against the `.vms-fits` container + observer lifecycle). The test was authored to its `<behavior>` spec and verified GREEN against the completed renderer; no RED commit was produced because the wire type + renderer are the unit under test and were built first per the task ordering.

## Release status

DEFERRED per CONTEXT — NO version bump, NO publish/tag, NO CHANGELOG entry (that is Plan 10-02 / Phase 11). Pure source edits, no new dependencies.

## Gate results

| Gate | Command | Result |
|------|---------|--------|
| 1 — TS typecheck | `npx tsc --noEmit` | CLEAN |
| 2 — core platform-agnosticism | `npm run check:core-globals` | GREEN (index.ts references zero platform globals) |
| 3 — vitest | `npx vitest run` | 29 files, **397 passed / 1 skipped** (pre-existing skip; all 10 new fits tests pass) |
| 4 — .NET build | `dotnet build --nologo -v minimal` | Build succeeded, 0 Errors |

## Self-Check: PASSED

- Files created/modified all present:
  - `viewmodel-shell/test/fits.test.ts` (created) — FOUND
  - `viewmodel-shell/src/index.ts`, `src/browser.ts`, `styles/default.css`, `viewmodel-shell-dotnet/ViewModels.cs` (modified) — FOUND
- Commits present: `a58e2d5`, `db8c276`, `39b65c5` — FOUND
