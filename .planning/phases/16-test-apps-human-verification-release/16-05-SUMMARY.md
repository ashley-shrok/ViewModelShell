---
phase: 16-test-apps-human-verification-release
plan: 05
subsystem: docs
tags: [agent-skill, chart, non-blocking-dispatch, changelog, migration, release-prep, parity]

# Dependency graph
requires:
  - phase: 16-04-combined-verification
    provides: "Operator PASS sign-off on all three NonBlocking demos (NBA-08 satisfied), unblocking release-prep"
  - phase: 13-chartnode-visual-review
    provides: "The unresolved CHART-06 documentation gap (ChartNode never added to agent-skill.md) and the cfa3175 grid/tick/axis theme-token review fix, both closed here"
provides:
  - "viewmodel-shell/agent-skill.md documents ChartNode (kind/points/title/tone) for wire-driving agents, byte-identical to viewmodel-shell-dotnet/AgentSkill.md, parity-gate confirmed"
  - "CHANGELOG.md carries a correctly-ordered ## 4.2.0 (non-blocking actions milestone) above a correctly-promoted ## 4.1.0 (ChartNode, extracted from its stale 1.12.0-nested draft + the review fix), above the existing ## 4.0.0"
  - "MIGRATION.md entries for 4.2.0 and 4.1.0, both stating no consumer action is required"
  - "A confirmed-green full test/parity/guard suite at the exact commit 16-06 will version-bump and tag"
affects: [16-06-release-execution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CHANGELOG staging-draft promotion: extract a nested `### Phase N (on main, unpublished)` subsection verbatim (header text untouched) out of an unrelated enclosing `## ` release heading and re-home it under its own correctly-versioned heading, leaving sibling legitimate subsections in place — used here for the ChartNode/1.12.0 mis-nesting."
    - "Python-scripted line-range extraction (not the Edit tool) for large, multi-hundred-line CHANGELOG.md surgery, to avoid transcription risk in an old_string/new_string diff; followed immediately by grep-based acceptance-criteria verification."

key-files:
  created: []
  modified:
    - viewmodel-shell/agent-skill.md
    - viewmodel-shell-dotnet/AgentSkill.md
    - CHANGELOG.md
    - MIGRATION.md

key-decisions:
  - "Left the extracted ChartNode subsection's body text completely verbatim (including its now-stale internal note 'ChartNode is documented in the agent skill in Phase 13 / CHART-06' cross-reference) per the plan's explicit instruction to leave nested Phase-N subsection content untouched at promotion time — this preserves the historical record of when the doc gap was originally deferred, rather than silently rewriting history."
  - "Did NOT run `requirements mark-complete` for CHART-07 or NBA-09 despite them appearing in this plan's frontmatter `requirements` list — both require the actual publish/tag/`main`-advance/announcement ceremony, which is 16-06's job and explicitly out of scope here (per the orchestrator's HARD BOUNDARY). Only CHART-06 (the doc-gap closure) is marked complete by this plan."

patterns-established:
  - "Two-heading CHANGELOG promotion in one edit: when a version needs to both retroactively promote a stale draft AND introduce a brand-new entry for undocumented completed work, insert both `## ` headings together above the last-released version in one pass, newest-first, rather than two separate edits that could leave the file in an inconsistent intermediate state."

requirements-completed: [CHART-06]

# Metrics
duration: ~25min
completed: 2026-07-08
---

# Phase 16 Plan 05: Release Prep — ChartNode Doc Gap + CHANGELOG/MIGRATION Correction + Green-Tree Gate Summary

**Closed the CHART-06 documentation gap in agent-skill.md, corrected CHANGELOG.md's mis-nested ChartNode draft into a real 4.1.0 release entry, authored a from-scratch 4.2.0 entry for the whole non-blocking-actions milestone, added both MIGRATION.md entries, and re-confirmed the full green-tree gate (vitest, core-globals, parity, both .NET test suites) — all immediately before 16-06's version bump.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-08T17:50:00Z
- **Completed:** 2026-07-08T18:05:00Z
- **Tasks:** 3 completed
- **Files modified:** 4

## Accomplishments
- `viewmodel-shell/agent-skill.md` gained a new `## Chart data (type:"chart")` section (between `## Files` and `## Versioning`) documenting `kind` (optional, omitted = `"bar"`), `points` (self-contained `{label, value}` pairs, no parallel-array alignment), optional `title`, and optional `tone` (informational-only for a wire-driving agent). Byte-copied verbatim to `viewmodel-shell-dotnet/AgentSkill.md`; the full cross-backend parity suite confirms both the skill source-twin diff and the skill HTTP-twin check are green (`✓ skill source files byte-identical (13459B)`, `✓ skill HTTP twins byte-identical (13714B) across 2 backends`).
- Extracted the `### ChartNode — Phase 12 (on \`main\`, unpublished)` subsection out of its incorrect nesting inside `## 1.12.0 / 1.10.0` (a pure staging artifact from commit `52ee8f1`) and re-homed it, verbatim, under a new, correctly-versioned `## 4.1.0 / 4.1.0` heading — including a new `### Review fixes` subsection documenting the `cfa3175` grid/tick/axis theme-token fix found during the operator's Phase 13 browser review. The three legitimate Phase 8/9/10 subsections (`### Alignment enums`, `### Switcher + cards minItem`, `### Fits node`) remain exactly where they were, untouched, still nested under `## 1.12.0`.
- Authored a brand-new `## 4.2.0 / 4.2.0` CHANGELOG heading (no prior draft existed) covering the entire non-blocking-actions milestone: `blocking?: boolean` on `ActionEvent`/`ActionDescriptor` (with the .NET nullable+`WhenWritingNull` nuance explicitly called out as the exception to the usual `WhenWritingDefault` F2 pattern), the two-lane dispatch loop replacing the single `dispatching` mutex, coalescing, the lane-aware client-side epoch, `pollInterval` as documented sugar over the non-blocking path, the corrected `selection.action` resurrection (closing the exact 0.15.0 rapid-toggle revert bug), the three human-verification demos + `NonBlocking-VERIFICATION.md`'s operator PASS sign-off, and the vitest coverage added across Phases 14–15.
- Final CHANGELOG.md top-to-bottom order confirmed: `## 4.2.0`, `## 4.1.0`, `## 4.0.0` (unchanged below) — exactly 3 `## 4.` headings, zero duplication of the ChartNode subsection.
- Added two new MIGRATION.md entries (`4.2.0` above `4.1.0`, both above the existing `4.0.0` entry) — both state plainly that no consumer action is required.
- Re-ran the complete green-tree gate in this session, immediately after the doc edits and before any version bump: vitest (46 files, 528 passed, 1 skipped), `check:core-globals` (AGNOSTIC-03 clean), cross-backend parity (8/8 fixtures + skill source/HTTP twins, all green), the framework's own `.NET` test project (102/102), and every `demo/**/*.Tests.csproj` (Tasks 28/28, ContactManager 39/39, RetroBoard 33/33, HelpDesk 52/52, ExpenseTracker 29/29 = 181/181) — **all green, zero failures, zero fix/diagnose cycles needed.**

## Task Commits

Each task was committed atomically:

1. **Task 1: close CHART-06 — document ChartNode in agent-skill.md, byte-copy, verify parity** - `e916d83` (docs)
2. **Task 2: promote the ChartNode CHANGELOG draft into a real 4.1.0 heading + author 4.2.0 from scratch** - `fa7f8c7` (docs)
3. **Task 3 (part 1): MIGRATION.md entries for 4.1.0 + 4.2.0** - `67e6c37` (docs)

_Task 3's second half (the full green-tree gate run) produced no code changes — it is a verification-only step recorded in this SUMMARY, not a separate commit._

**Plan metadata:** (this commit) `docs: complete plan`

## Files Created/Modified
- `viewmodel-shell/agent-skill.md` - new `## Chart data (type:"chart")` section (18 lines) inserted between `## Files` and `## Versioning`
- `viewmodel-shell-dotnet/AgentSkill.md` - byte-identical copy of the above (maintains the parity skill-diff invariant)
- `CHANGELOG.md` - extracted the mis-nested `### ChartNode — Phase 12` subsection from `## 1.12.0`; inserted new `## 4.2.0` (from scratch) and `## 4.1.0` (promoted draft + review-fix subsection) headings above `## 4.0.0`
- `MIGRATION.md` - two new entries (`4.2.0`, `4.1.0`), both additive/opt-in/no-forced-action, inserted above the existing `4.0.0` entry

## Decisions Made
- Left the extracted ChartNode subsection's own header text and body completely verbatim (per the plan's explicit "leave nested Phase-N subsection headers/content untouched at promotion time" convention), including its now-slightly-stale internal note that ChartNode documentation is "Phase 13 / CHART-06" work — that note is now historically accurate (it correctly predicted this exact plan would close it) rather than something to rewrite.
- Used a Python line-range script (not the Edit tool's old_string/new_string) to extract the 26-line ChartNode subsection from its nested position, to avoid any transcription risk in reproducing several hundred words of existing prose verbatim; followed immediately by grep-based verification of every acceptance criterion in the plan.
- Deliberately did NOT run `requirements mark-complete` for `CHART-07` or `NBA-09` (both listed in this plan's frontmatter `requirements` field) — their acceptance criteria require the actual publish/tag/`main`-advance/`#vms-changelog`-announcement ceremony, which belongs to 16-06 and is explicitly out of this plan's scope per the orchestrator's hard boundary. Only `CHART-06` (the documentation-gap closure, fully satisfied by Task 1) is marked complete here.

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria in Tasks 1–3 passed on the first verification pass; no auto-fixes, no blocking issues, no architectural questions arose.

## Issues Encountered

None. The one operational hiccup — an Edit-tool "file has been modified since read" error after a Python script had rewritten CHANGELOG.md out-of-band — was resolved by simply re-reading the file before retrying the edit; not a deviation from the plan's substance, just a tool-usage correction.

## User Setup Required

None - no external service configuration required. This plan performs no publish/auth action (no credential is read or required here) per its own threat model.

## Next Phase Readiness

- CHART-06 is fully closed: ChartNode is documented in `agent-skill.md`, byte-identical to the `.NET` twin, and the parity skill gate is green.
- CHANGELOG.md and MIGRATION.md correctly and completely describe both `4.1.0` and `4.2.0`, in the right order, with nothing lost or duplicated from the ChartNode extraction.
- The repo is green-tree-clean at the exact commit 16-06 will tag — vitest 528/528 (+1 skipped), core-globals clean, parity 8/8 + skill twins green, .NET framework tests 102/102, all 5 demo test projects 181/181.
- **16-06 (release execution) is fully unblocked** — it is now a pure mechanical bump-publish-tag-announce sequence with nothing left to decide: no version bump, no `npm publish`/`dotnet nuget push`, no git tag, and no push were performed by this plan (all correctly deferred, per this plan's hard boundary, to 16-06's operator-gated ceremony).

---
*Phase: 16-test-apps-human-verification-release*
*Completed: 2026-07-08*

## Self-Check: PASSED

- FOUND: viewmodel-shell/agent-skill.md (contains "ChartNode")
- FOUND: viewmodel-shell-dotnet/AgentSkill.md (byte-identical to agent-skill.md, diff empty)
- FOUND: CHANGELOG.md (`## 4.2.0`, `## 4.1.0`, `## 4.0.0` in order; `### ChartNode — Phase 12` appears exactly once; Phase 8/9/10 subsections intact)
- FOUND: MIGRATION.md (`## Upgrading to \`4.2.0\`` above `## Upgrading to \`4.1.0\`` above `## Upgrading to \`4.0.0\``)
- FOUND commit: e916d83 (Task 1)
- FOUND commit: fa7f8c7 (Task 2)
- FOUND commit: 67e6c37 (Task 3, MIGRATION.md)
