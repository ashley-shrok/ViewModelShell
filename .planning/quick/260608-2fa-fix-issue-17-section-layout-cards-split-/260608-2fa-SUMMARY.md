---
phase: 260608-2fa-fix-issue-17-section-layout-cards-split-
plan: 01
subsystem: viewmodel-shell-styles
tags: [bugfix, css-cascade, regression-test, npm-patch, issue-17]
dependency_graph:
  requires: []
  provides:
    - "SectionNode layout=cards/split now actually renders as grid (cascade fix)"
    - "min-width:0 on grid children prevents wide-media blowout"
    - "jsdom regression test loading real default.css + asserting getComputedStyle().display"
  affects:
    - "viewmodel-shell @ 1.0.1 (npm only — NuGet unchanged at 1.0.0)"
tech_stack:
  added: []
  patterns:
    - "CSS source-order discipline: base rules MUST precede their modifier rules (same specificity → later wins)"
    - "Regression tests for cascade bugs must inject the actual stylesheet and assert getComputedStyle, not className"
key_files:
  created:
    - .planning/quick/260608-2fa-fix-issue-17-section-layout-cards-split-/260608-2fa-SUMMARY.md
  modified:
    - viewmodel-shell/styles/default.css
    - viewmodel-shell/test/theme-modifiers.test.ts
    - viewmodel-shell/package.json
    - CHANGELOG.md
decisions:
  - "Used `git checkout HEAD~1 -- default.css` (not `git stash`) for the falsifiability gate — global git-stash refs are shared across worktrees per AGENTS.md, so stash from inside a worktree is forbidden. Checkout/restore is the sanctioned alternative."
  - "Falsifiability gate verified end-to-end: with the CSS reverted to pre-fix state, the two new section-cards/split tests FAILED (display='flex'); the page-cards-grid and section-sidebar-flex guards still PASSED (correctly, since those weren't affected by the cascade bug). After restoring the fix, all 33 tests in theme-modifiers.test.ts and all 240 tests across the full suite passed."
  - "package-lock.json was modified by `npm install` (deps weren't installed in this worktree). Per project convention, this is a side-effect artifact, NOT a release-changing edit — left unstaged, will be cleaned up by orchestrator or next dev with `git checkout`."
metrics:
  duration: "~5 minutes"
  completed_date: 2026-06-08
  tasks_total: 3
  tasks_completed: 3
  files_modified: 4
---

# Quick Task 260608-2fa: Fix issue #17 — section layout=cards/split cascade Summary

One-liner: Move `.vms-section` base rule above `.vms-section--cards/--split` modifiers in default.css so the grid `display` wins (was silently shadowed by later flex base); add `min-width:0` on grid children to prevent wide-media blowout; add jsdom regression test asserting computed `display`; bump npm to 1.0.1.

## What Was Built

### Task 1 — CSS cascade fix (commit `b7504eb`)
Moved the `/* ── Section ── */` block (`.vms-section { display: flex }` + `.vms-section__heading`) from below the layout-modifier rules (line 197 in pre-fix) to immediately above the cards/split blocks (now at line 137). Mirrors the existing `.vms-page` ordering pattern. Added a new selector list (line 181-184) setting `min-width: 0` on direct children of `.vms-page--cards / --section--cards / --page--split / --section--split` with an explanatory comment about grid items defaulting to `min-width: auto`.

Surgical diff: +15/-9 lines, only `default.css` modified. `.vms-section--sidebar` byte-identical. `.vms-page` block byte-identical. All 11 theme files under `styles/themes/` untouched (verified via `git diff HEAD~3 HEAD -- viewmodel-shell/styles/themes/` returning empty).

### Task 2 — jsdom regression test (commit `9acd452`)
Appended new describe block `#17 — layout="cards"/"split" computed display is actually grid (cascade regression)` to `viewmodel-shell/test/theme-modifiers.test.ts`. Added module-scope `readFileSync` of `../styles/default.css` plus an idempotent `injectStylesheet()` helper that appends `<style data-vms-default>` to `document.head`. `beforeAll` runs the injection once per describe block. Four `it()` cases assert `window.getComputedStyle(el).display`:

1. section layout="cards" → "grid" (the cascade fix)
2. section layout="split" → "grid"
3. page layout="cards" → "grid" (no-regression guard for the case that always worked)
4. section layout="sidebar" → "flex" (intentional-flex guard so a future "everything grid" refactor can't silently invert design)

In-source comment explains the jsdom limitation: jsdom does not compute grid track layout, so we can't assert ">=2 columns" — but the cascaded `display` value IS the property the bug clobbered, so direct assertion is sufficient regression coverage. The `min-width:0` grid-child rule (Task 1 secondary fix) is not assertable in jsdom for the same reason; it's covered by inspection and the explanatory CSS comment.

### Task 3 — Release (commit `8d84f59`)
- `viewmodel-shell/package.json`: `"version": "1.0.0"` → `"1.0.1"`. No other field changed (1-line diff).
- `CHANGELOG.md`: prepended new `## 1.0.1 — CSS cascade fix for section layout=cards/split (#17) (npm only)` entry above the existing 1.0.0 entry, with `### Fixed`, `### Tests`, `### Consumers` subsections per the established format. Cites #17. Notes NuGet unchanged at 1.0.0 per the npm-only patch policy stated in the CHANGELOG preamble.
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` deliberately NOT touched (verified empty diff). Pure client-side CSS bugfix, no wire-format change.

## How It Works

The bug was a CSS cascade-shadowing problem with zero JavaScript involvement. CSS rules with equal specificity are resolved by source order: later wins. The pre-fix `default.css` declared `.vms-section--cards { display: grid }` at line 141, then `.vms-section { display: flex }` at line 198 — every `.vms-section.vms-section--cards` element matched both rules at equal specificity, but the later flex rule won, so the grid was silently shadowed. `.vms-page--cards` was never affected because `.vms-page { display: flex }` was declared at line 101, BEFORE its `--cards` modifier.

The fix moves the section base above its modifiers (correct CSS architecture matching the page block's pattern). No selector specificity hack, no `!important`, no `@layer` — just source-order correction.

Secondary fix: `min-width: 0` on direct grid children. Grid items default to `min-width: auto`, which means a wide child (full-width image, long unbroken string, nested `overflow:auto` table-wrapper) can blow out its track. CSS grid then either overflows or collapses back to one column even when there's room for two. Setting `min-width: 0` lets the child shrink to the track. This is the standard companion to any auto-fit/minmax grid layout.

## Verification

### Plan's automated verification (all passed):
1. `cd viewmodel-shell && npm test` → **240 passed | 1 skipped (241 total)** across 19 test files. Existing tests unchanged.
2. `cd viewmodel-shell && npm run check:core-globals` → **AGNOSTIC-03 passed**: `viewmodel-shell/src/index.ts` references zero platform globals.
3. `git log --oneline -5` → three new commits in correct order (newest first): `8d84f59` release, `9acd452` test, `b7504eb` CSS fix.
4. `git diff HEAD~3 HEAD -- viewmodel-shell/styles/themes/` → empty (no theme touched).
5. `git diff HEAD~3 HEAD -- viewmodel-shell-dotnet/` → empty (.NET package untouched).
6. `grep '"version"' viewmodel-shell/package.json` → `"version": "1.0.1"`.
7. `head -10 CHANGELOG.md` → 1.0.1 entry near the top, above 1.0.0.

### Falsifiability gate (the key "would the test actually catch this bug" check):
Used `git checkout HEAD~1 -- viewmodel-shell/styles/default.css` (NOT `git stash` — that would mutate global stash refs shared with sibling worktrees, forbidden per `~/AGENTS.md`) to revert the CSS to its pre-fix state with the cascade bug, while keeping the new tests in place. Ran `npm test -- theme-modifiers`:

```
×  section with layout: "cards" computes display: grid (not flex) — #17 cascade fix
×  section with layout: "split" computes display: grid
✓  page with layout: "cards" still computes display: grid (no regression)
✓  section with layout: "sidebar" still computes display: flex (intentional, untouched)
Tests  2 failed | 31 passed (33)
```

Exactly the two cases the bug breaks failed; the two guards stayed green (they were always green, since the bug never affected them). Then restored the fix via `git checkout HEAD -- viewmodel-shell/styles/default.css`, re-ran:

```
✓ test/theme-modifiers.test.ts (33 tests) 104ms
Tests  33 passed (33)
```

The regression test is genuinely falsifiable — it asserts the exact property the fix changes, and it would fail loudly if anyone re-introduced the source-order bug (or e.g. moved the section base block back below the modifiers during a future refactor).

### Additional sanity:
- `npm run check:theme-byte-identity` → passes (all 11 themes match their recorded SHA-256 baselines).

## Deviations from Plan

None — plan executed exactly as written. One small clarification on the falsifiability-gate mechanic: the plan said to use `git stash push` for the gate, but `~/AGENTS.md` explicitly forbids `git stash` inside worktrees (the stash list is shared with the main repo and sibling worktrees, so a `stash pop` could silently apply someone else's WIP). I used `git checkout HEAD~1 -- <file>` instead, which produces the same effect (file content reverted, restored, no leftover stash). Both branches of the gate behaved exactly as the plan predicted; result documented in Decisions.

## Auth Gates

None.

## Known Stubs

None — pure CSS bugfix with full test coverage.

## Threat Flags

None — no new network surface, no auth changes, no schema changes. Pure stylesheet/test/version edits in a frontend rendering library.

## Self-Check: PASSED

- File `viewmodel-shell/styles/default.css` exists and contains the `min-width: 0` rule at line 184 (FOUND).
- File `viewmodel-shell/test/theme-modifiers.test.ts` exists and contains `#17` references (FOUND, 5 occurrences via `grep -c "#17"`).
- File `viewmodel-shell/package.json` has `"version": "1.0.1"` (FOUND).
- File `CHANGELOG.md` has `## 1.0.1` entry near top (FOUND at line 9).
- Commit `b7504eb` exists: `git log --oneline --all | grep b7504eb` → FOUND.
- Commit `9acd452` exists → FOUND.
- Commit `8d84f59` exists → FOUND.
- `viewmodel-shell-dotnet/` byte-identical across the three commits → FOUND (empty diff).
- `viewmodel-shell/styles/themes/` byte-identical across the three commits → FOUND (empty diff).
- Full test suite green (240 passed, 1 skipped, 0 failed) → FOUND.
- `check:core-globals` exits 0 (AGNOSTIC-03) → FOUND.
- `check:theme-byte-identity` exits 0 → FOUND.
