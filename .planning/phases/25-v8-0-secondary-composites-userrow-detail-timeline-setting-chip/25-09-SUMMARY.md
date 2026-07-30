---
phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip
plan: 09
status: complete
completed: 2026-07-30
---

# 25-09 SUMMARY — CHANGELOG + MIGRATION additive entries (COMP-09..13a)

## What landed

- `CHANGELOG.md` **Unreleased — v8.0.0 (in progress)** section gained **5 additive `Added` entries** covering all 5 secondaries: UserRowNode, DetailRowNode + DetailListNode, TimelineEntryNode + TimelineNode, SettingRowNode + SettingListNode, ChipNode + ChipListNode. Inserted immediately after the Phase 24 AlertNode entry, before the Phase 24 `### Changed (BREAKING)` sub-section.
- `MIGRATION.md` **Upgrading to v8.0.0 (in progress)** section gained **one additive note** (`### UserRowNode, DetailRowNode + DetailListNode, TimelineEntryNode + TimelineNode, SettingRowNode + SettingListNode, ChipNode + ChipListNode (COMP-09..COMP-13) — new node types`) with two callouts:
  - **Chip.dismissAction posture** (identity-carrying ActionEvent slot; distinct from Alert.dismissible; both action + dismissAction may coexist with X-click stopPropagation).
  - **Two ::before CSS mechanisms baked in** (Timeline rail-and-dot; UserRow status-dot palette).

## No BREAKING added

Phase 25 is entirely additive. `### Changed (BREAKING)` sub-section in CHANGELOG (Phase 24 EmptyStateNode rename) UNCHANGED. Phase 23 + Phase 24 sections in MIGRATION.md UNCHANGED.

## No release fired

- `viewmodel-shell/package.json` version: **7.1.0** (unchanged).
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>`: **7.0.0** (unchanged).
- Batch-then-ship reminder at the top of the Unreleased CHANGELOG section preserved.
- v8.0.0 aligned publish + tag + advance-main happens at Phase 26 closeout.

## Verification (grep-based per plan)

All 15+ acceptance-criteria grep checks passed:
- CHANGELOG: `Unreleased — v8.0.0` (1), `UserRowNode` (3), `DetailRowNode|DetailListNode` (1), `TimelineEntryNode|TimelineNode` (2), `SettingRowNode|SettingListNode` (2), `ChipNode|ChipListNode` (2), `apps CANNOT compose|NEW CSS MECHANISM|::before` (1), `distinct from AlertNode|caller-supplied ActionEvent|CALLER-SUPPLIED` (2), `Batch-then-ship` (1).
- MIGRATION: `Upgrading to v8.0.0` (1), `COMP-09..COMP-13` (1), `Additive` (6), `ChipNode.dismissAction|CALLER-SUPPLIED` (1), `distinct from AlertNode` (1), `remove-filter-42` (1), `apps cannot compose|apps describe|::before` (1).

## Diff stats

- `CHANGELOG.md`: +5 lines (5 new Added entries appended)
- `MIGRATION.md`: +10 lines (1 new heading + additive note + Chip callout + Timeline callout)

## Cross-references preserved

Both CHANGELOG.md and MIGRATION.md name the same Chip.dismissAction posture in complementary voices — CHANGELOG documents the wire property; MIGRATION expands on it for chip-building consumers (per plan-file key_links).
