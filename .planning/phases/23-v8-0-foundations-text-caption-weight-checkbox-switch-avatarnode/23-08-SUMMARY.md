---
phase: 23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode
plan: 08
subsystem: docs
tags: [changelog, migration, unreleased, batch-then-ship, v8.0.0]
requires: [23-01, 23-02, 23-03, 23-04]
provides:
  - "CHANGELOG.md `## Unreleased — v8.0.0 (in progress)` heading + Added section with 4 foundation entries"
  - "MIGRATION.md `Upgrading to v8.0.0 (in progress)` accumulator noting all Phase 23 additions are additive"
affects: [CHANGELOG.md, MIGRATION.md]
tech-stack:
  added: []
  patterns: [batch-then-ship (LOCKED per CONTEXT.md §5)]
key-files:
  modified:
    - CHANGELOG.md
    - MIGRATION.md
decisions:
  - "Under critical_directives from the executor prompt: BOTH CHANGELOG.md AND MIGRATION.md were updated (plan text said 'do NOT touch MIGRATION.md' but the prompt's critical_directives explicitly override with 'Also update MIGRATION.md with a v8.0.0 (in progress) entry'). Prompt directives take precedence over plan body text."
  - "Inserted the Unreleased section at the very top of CHANGELOG.md, immediately below the intro paragraph and separator, above the most recent release (`## npm 7.1.0 / NuGet ...Markdown 0.2.0`) — matches CHANGELOG.md's newest-first ordering."
  - "MIGRATION.md accumulator sits above the most recent versioned entry (`Upgrading to npm 7.0.0 / NuGet 7.0.0`)."
metrics:
  duration_minutes: 3
  completed_date: 2026-07-29
---

# Phase 23 Plan 08: CHANGELOG + MIGRATION accumulate v8.0.0 foundations Summary

Accumulate Phase 23's four foundation additions (COMP-01..04) as append-only, in-progress entries under `Unreleased — v8.0.0 (in progress)` in both `CHANGELOG.md` and `MIGRATION.md`. No version bumps, no publish — batch-then-ship remains LOCKED per CONTEXT.md §5; the entries flip to a versioned release heading at Phase 26 closeout.

## What was done

### CHANGELOG.md — Unreleased heading inserted at top

Position: below the two-line intro paragraph + first `---` separator, immediately above the previous newest entry (`## npm 7.1.0 / NuGet AshleyShrok.ViewModelShell.Markdown 0.2.0`). CHANGELOG is newest-first.

Content added (22 net-new lines including the surrounding blank lines and closing `---`):

- `## Unreleased — v8.0.0 (in progress)` heading
- Prominent `> **Batch-then-ship:** …` reminder callout, citing `.planning/design/composite-nodes-layer.md` by exact path
- `### Added` subsection with 4 wire-shape-detailed entries — one each for COMP-01 (TextNode caption), COMP-02 (TextNode weight), COMP-03 (CheckboxNode switch variant), COMP-04 (AvatarNode)
- Each entry names the CSS class it emits (`.vms-text--caption`, `.vms-text--weight-{value}`, `.vms-field--switch`), the wire shape or option set, and the a11y attribute where relevant (`role="switch"`, `role="img"`)
- Trailing `---` separator preserving the existing convention between release entries

### MIGRATION.md — Upgrading to v8.0.0 (in progress) accumulator

Position: below the intro paragraph + first `---` separator, immediately above `## Upgrading to npm 7.0.0 / NuGet 7.0.0`.

Content added (13 net-new lines):

- `## Upgrading to v8.0.0 (in progress) — nothing to do (all foundations additive)` heading
- Batch-then-ship reminder + Phase 26 closeout note
- Statement that all 4 additions are additive, degrading gracefully on old renderers when unknown enum values appear
- Per-addition one-liner reiterating the additive nature (opt-in by setting the field; omit for existing behavior)
- Pointer to CHANGELOG's Unreleased section for wire-level detail

## Files modified

- `CHANGELOG.md` — +22 lines net (Unreleased heading + reminder + 4 Added entries + separator). All pre-existing content (v7.1.0 down through the earliest entries) UNTOUCHED.
- `MIGRATION.md` — +13 lines net (Upgrading to v8.0.0 heading + accumulator body). All pre-existing content UNTOUCHED.

## Verification (all acceptance criteria met)

Grep counts on CHANGELOG.md:

- `Unreleased` → 1 (heading present)
- `v8.0.0` → 2 (heading + reminder)
- `Batch-then-ship` → 1 (reminder prominent)
- `composite-nodes-layer` → 1 (design doc cited by exact path)
- `AvatarNode` → 1 (COMP-04 addition named)
- `COMP-01`, `COMP-02`, `COMP-03`, `COMP-04` → 1 each (all 4 requirements documented)
- `## 7` or `## npm 7` → 3 (existing v7.x headings preserved: 7.1.0, 7.0.1, 7.0.0)
- `caption` → 7, `weight` → 3, `switch` → 22 (all 4 foundation names appear)

Version files unchanged (no v8 bump):

- `viewmodel-shell/package.json` still `"version": "7.1.0"` (`grep -c '"version": "8'` returns 0)
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` still `<Version>7.0.0</Version>` (`grep -c '<Version>8'` returns 0)

Working tree state at commit time — `git status --short`:

```
 M CHANGELOG.md
 M MIGRATION.md
?? .vite/    (pre-existing, unrelated)
```

Only the two documentation files changed. `.vite/` is a pre-existing untracked directory unrelated to this plan (present at plan start per `git status` in the executor context).

## Deviations from Plan

### Prompt directive override

**1. Prompt `<critical_directives>` explicitly required MIGRATION.md update; plan body text said do NOT touch it.**
- **Found during:** Task 1 execution — plan action step said "Do NOT touch MIGRATION.md" but the prompt's `<critical_directives>` item 2 explicitly said "Also update MIGRATION.md with a v8.0.0 (in progress) entry".
- **Resolution:** Prompt directives take precedence over plan body text (the prompt is the freshest instruction from the orchestrator; plans may lag when the orchestrator updates context between planning and execution). Wrote the MIGRATION.md accumulator per the prompt directive, matching the format of the shipped `Upgrading to npm 7.0.0 / NuGet 7.0.0 — ONE break…` and `Upgrading to npm 6.12.0 / NuGet 6.12.0 — nothing to do (additive)` entries.
- **Files modified:** `MIGRATION.md` (+13 lines net).
- **Rationale:** Both files are the "release-gated documentation" pair per AGENTS.md; accumulating Phase 23 in only one of them would leave MIGRATION.md silent on the additions until Phase 26. The accumulator flips to a released heading at Phase 26 closeout — same lifecycle as the CHANGELOG heading.

No auto-fixed bugs. No auth gates. No architectural changes.

## Batch-then-ship state at end of Phase 23-08

- `viewmodel-shell/package.json` version: `7.1.0` (unchanged) ✓
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` Version: `7.0.0` (unchanged) ✓
- No `git tag` created ✓
- No `npm publish` run ✓
- No `dotnet nuget push` run ✓
- Batch-then-ship reminder prominent in both CHANGELOG and MIGRATION Unreleased sections ✓

Phase 26 will (a) flip the two `Unreleased` / `in progress` headings to `## npm 8.0.0 / NuGet 8.0.0 — Composite Nodes Layer` (or equivalent), (b) accumulate the remaining Phase 24-25 composite additions into the same section, (c) bump both package versions in lockstep, and (d) publish + tag.

## Self-Check: PASSED

- CHANGELOG.md exists and contains all required strings (verified via grep counts above)
- MIGRATION.md exists and contains the v8.0.0 accumulator (verified via file read after edit)
- Version files unchanged (verified via grep)
- No unexpected file changes in working tree (verified via `git status --short`)
