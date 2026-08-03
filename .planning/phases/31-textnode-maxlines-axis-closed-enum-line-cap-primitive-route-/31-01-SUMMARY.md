---
phase: 31-textnode-maxlines-axis-closed-enum-line-cap-primitive-route-
plan: 01
subsystem: ui
tags: [textnode, maxLines, css-line-clamp, ellipsis, route-a-axis, orthogonal-axis]

# Dependency graph
requires:
  - phase: 24-composite-nodes-primary
    provides: TextNode Route A axes precedent (COMP-01 caption tier, COMP-02 weight axis) — same source-order-append pattern
  - phase: 27-composite-state-axis-uniformity
    provides: `state?: string` axis uniformity precedent — the earned-a-composite bar remains eyeball-per-visual; row-shaped composites automatically carry lifecycle axes
provides:
  - TypeScript wire field TextNode.maxLines?: 1 | 2 | 3
  - BrowserAdapter renderer emitting .vms-text--max-lines-{N} class on the .vms-text element
  - Three shipped CSS rules (single-line ellipsis + 2/3-line -webkit-box line-clamp)
  - Mutation-proof vitest suite (10 tests) covering all four states + composition + composite slot round-trip
affects: [31-02 (.NET twin), 31-03 (parity fixture), 31-04 (release ritual v9.2.0)]

# Tech tracking
tech-stack:
  added: []  # no new dependency — pure CSS + one TS type field + one template-literal segment
  patterns:
    - "Route A orthogonal appearance axis via source-order className append (matches COMP-02 weight axis posture)"
    - "Closed-enum wire axis (1 | 2 | 3) with tooltip-not-auto-wired policy (server-tree-is-truth per AGENTS.md #2/#3)"
    - "Line-clamp via -webkit-box + -webkit-line-clamp (universal cross-browser today; -webkit prefix persists as the standard)"

key-files:
  created:
    - viewmodel-shell/test/text-max-lines.test.ts
  modified:
    - viewmodel-shell/src/index.ts (TextNode interface — appended maxLines?: 1 | 2 | 3 after weight?)
    - viewmodel-shell/src/browser.ts (text() render path — extended className template literal with maxLines segment)
    - viewmodel-shell/styles/default.css (three CSS rules appended after weight axis, before tone axis)

key-decisions:
  - "Followed 31-CONTEXT.md §decisions verbatim: value set 1|2|3 closed enum; tooltip NOT auto-wired (consumer composes TooltipNode explicitly per MUI/Ant opt-in posture); middle-truncate out of scope; table cell truncation deferred to future TableColumn.maxLines?; three CSS rules verbatim; class emission after weight in source order."
  - "TSDoc names the closed-enum + tooltip-not-auto-wired + wrapping-composes semantics so consumers hitting the field via IDE hover get the whole design contract, not just the type signature."

patterns-established:
  - "Fourth TextNode class-modifier axis (style → tone → weight → maxLines) — the same source-order-append pattern established by COMP-02 in Phase 24; a fifth axis (if it ever earns one) extends the template rightward."
  - "A new appearance axis that ships CSS-only (no --vms-* token, no theme change) can be a self-contained one-plan wave-1 change on the TS side; parity with .NET twin is a separate parallel plan (31-02) and a follow-up parity-fixture plan (31-03)."

requirements-completed: [MAXLINES-TS-WIRE, MAXLINES-TS-RENDER, MAXLINES-CSS, MAXLINES-TS-TEST]

# Metrics
duration: ~5 min
completed: 2026-08-03
---

# Phase 31 Plan 01: TextNode.maxLines axis (TS side) Summary

**Adds closed-enum wire field `TextNode.maxLines?: 1 | 2 | 3` on the TypeScript side: interface field, BrowserAdapter class emission, three shipped CSS rules (single-line ellipsis + 2/3-line -webkit-box line-clamp), and a 10-test mutation-proof vitest suite. Closes the framework gap Angel /ai hit on 2026-08-03 while hand-truncating Kitsune sidebar session titles server-side via `.Substring(0, 16) + "…"`.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-08-03T06:39:15Z
- **Completed:** 2026-08-03T06:43:51Z
- **Tasks:** 1 (TDD — 1 task with test → feat gate structure)
- **Files modified:** 3 (index.ts, browser.ts, default.css) + 1 created (test file)

## Accomplishments

- `TextNode.maxLines?: 1 | 2 | 3` field appended to the exported TypeScript interface at `viewmodel-shell/src/index.ts` after `weight?`, with a 21-line TSDoc block explaining the closed-enum rationale, orthogonal composition with every other TextNode axis, wrap-then-clamp semantics, and the tooltip-not-auto-wired policy.
- BrowserAdapter's `text()` render path in `viewmodel-shell/src/browser.ts` extended to emit `vms-text--max-lines-{N}` on the rendered `.vms-text` element when `maxLines` is set. Omitted = no class, byte-identical to today's emission (backwards-compat).
- Three shipped CSS rules appended to `viewmodel-shell/styles/default.css` VERBATIM per 31-CONTEXT.md §decisions: single-line ellipsis for N=1, `-webkit-box` line-clamp grouped selector for N=2|3, and the two `-webkit-line-clamp: N` declarations.
- 10-test mutation-proof vitest suite at `viewmodel-shell/test/text-max-lines.test.ts` covering: class emission for each of the 3 values; absent-maxLines emits no class (backwards-compat); shipped-CSS grep assertions for all 4 rule literals (mutation-proof — removing a rule from default.css breaks the grep instantly); orthogonal composition with style + tone + weight in source order; composition with `level` (semantic `<h2>` tag preserved + class emitted); composition into `UserRowNode.name` slot (Angel's motivating case verbatim).
- Full framework vitest suite: **85 test files, 1396 tests passing, 0 failing.** Zero regressions.
- `check:test-types` GREEN (proves the TS interface actually declares the field with the right type — mutation test #2 in the file header).
- `check:core-globals` GREEN (no platform-global drift into `index.ts` — the class emission edit was in `browser.ts` which legitimately owns DOM bindings).

## Task Commits

Task 1 (TDD): TextNode.maxLines axis — TypeScript wire + renderer + CSS + tests

1. **RED gate (test)** — `b5a90c2` `test(31-01): RED — TextNode.maxLines axis vitest suite (10 tests)`
2. **GREEN gate (feat)** — `dc753ff` `feat(31-01): TextNode.maxLines axis — TS wire + renderer + CSS`

REFACTOR gate not needed — the source-order append pattern is already the cleanest expression of the axis (mirrors COMP-02 weight verbatim).

**Plan metadata:** (created below by orchestrator's final commit — includes SUMMARY.md)

## Files Created/Modified

- `viewmodel-shell/src/index.ts` — TextNode interface: appended `maxLines?: 1 | 2 | 3` field after `weight?`, with 21-line TSDoc block naming closed-enum rationale + orthogonal composition + wrap-then-clamp + tooltip-opt-in policy.
- `viewmodel-shell/src/browser.ts` — `text()` render path: extended className template literal (line ~5271) with `${n.maxLines ? \` vms-text--max-lines-${n.maxLines}\` : ""}` segment; updated the axis-composition comment block (lines ~5265-5270) to name the new axis.
- `viewmodel-shell/styles/default.css` — appended three CSS rules VERBATIM per 31-CONTEXT.md §decisions after the weight axis block, before the tone axis block. Header comment names the vendor-prefix persistence rationale.
- `viewmodel-shell/test/text-max-lines.test.ts` **NEW** — 215-line mutation-proof vitest suite (10 tests across 3 describe blocks) with a header block explaining the jsdom caveat (no layout → no line-clamp visual proof possible; class-emission + cssText-grep is the honest floor) and the mutation-test-proof enumeration (which mutation breaks which test).

## Decisions Made

None beyond what 31-CONTEXT.md §decisions already locked at the 2026-08-03 tasting. The plan explicitly said "do NOT re-derive"; all five design questions were resolved by the operator's visual sign-off. My work was verbatim execution:
- Value set 1|2|3 closed enum — direct spec.
- Class emission after `weight` in source order — direct spec ("Append maxLines LAST in the className template").
- Three CSS rules verbatim — direct spec ("must be BYTE-VERBATIM per CONTEXT §decisions").
- No `--vms-*` token added — direct spec.
- Tooltip NOT auto-wired — TSDoc names the design decision per §decisions.

## Deviations from Plan

None — plan executed exactly as written.

The plan's `<action>` block explicitly enumerated: (1) append the field on the interface; (2) extend the className template literal; (3) append three CSS rules verbatim; (4) create the test file. Each ran cleanly against the pre-verified line numbers (interface at ~1005, className at ~5271, weight-axis block at ~1897-1899).

Two items to flag for the SUMMARY reader but NOT deviations:

- **`viewmodel-shell/package-lock.json` had a stale version stamp** (`9.0.0` vs `package.json`'s `9.1.1`). `npm install` corrected it in-tree. Left unstaged per the SCOPE BOUNDARY deviation rule ("Only auto-fix issues DIRECTLY caused by the current task's changes"). This is drift from a prior release, not from my edits, and belongs to the Phase 30 v9.1.0/v9.1.1 release ritual reconciliation. Logging here so the next release-ritual agent sees it.

- **`npm install` was required** because `viewmodel-shell/node_modules` was absent in this worktree at spawn time. This is a worktree environmental artifact (not a change to `package.json`); the install correctly populated node_modules matching the shipped lockfile shape. No deviation from the plan.

## Issues Encountered

None. The plan was locked at the 2026-08-03 tasting, executed atomically in a single TDD cycle, RED gate went red as expected (9 of 10 tests failed; the backwards-compat "no class emitted" test was the only pre-existing pass — deliberate design), GREEN gate went fully green after the three-file edit, full framework suite stayed at 1396 passing / 0 failing.

## User Setup Required

None — additive optional wire field. Every existing TextNode consumer sees byte-identical emission (no class emitted, no wrap behavior change). Adopters opt in by passing `TextNode(value, maxLines:N)` into any composite slot that accepts a ViewNode. The axis composes for FREE into every composite carrying a TextNode slot (UserRowNode.name, ListRowNode.primary+secondary, MessageNode.content, TimelineEntryNode.description, DetailRowNode.label+value, ChipNode.label, standalone TextNode) — no composite renderer changed in this plan.

## Next Phase Readiness

- **Plan 31-02 (.NET twin, parallel wave 1)** — ready to run. Modifies `viewmodel-shell-dotnet/ViewModels.cs` and adds `viewmodel-shell-dotnet/Tests/TextMaxLinesSerializationTests.cs`. ZERO file overlap with this plan (verified per the plan's phase note).
- **Plan 31-03 (parity fixture, wave 2)** — waits on 31-01 + 31-02. Adds `parity/fixtures/textnode-maxlines.json` with `expectBodyContains` tripwires proving both backends emit the same class name for each value + omit the wire key when unset.
- **Plan 31-04 (release ritual, wave 3)** — waits on 31-01 + 31-02 + 31-03. Bumps package versions (npm 9.2.0 + NuGet 9.2.0 — minor), CHANGELOG entry, MIGRATION note, publishes to registries, tags, advances main.

## Self-Check: PASSED

- `viewmodel-shell/src/index.ts` — `grep -c "maxLines?: 1 | 2 | 3"` → 1 ✓
- `viewmodel-shell/src/browser.ts` — `grep -c "vms-text--max-lines-"` → 2 ✓
- `viewmodel-shell/styles/default.css` — `grep -c "\.vms-text--max-lines-1"` → 1 ✓; `grep -c "\-webkit-line-clamp: 2"` → 1 ✓; `grep -c "\-webkit-line-clamp: 3"` → 1 ✓
- `viewmodel-shell/test/text-max-lines.test.ts` — exists ✓
- `npx vitest run test/text-max-lines.test.ts` — 10/10 passing ✓
- `npm run check:test-types` — green (exit 0) ✓
- `npm run check:core-globals` — green (exit 0) ✓
- `npx vitest run` (full suite) — 85 files, 1396 tests passing, 0 failing ✓
- Commits present in `git log --oneline`:
  - `b5a90c2` (RED) ✓
  - `dc753ff` (GREEN) ✓

---
*Phase: 31-textnode-maxlines-axis-closed-enum-line-cap-primitive-route-*
*Completed: 2026-08-03*
