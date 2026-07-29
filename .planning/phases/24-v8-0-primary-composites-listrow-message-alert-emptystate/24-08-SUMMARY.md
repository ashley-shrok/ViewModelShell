---
phase: 24-v8-0-primary-composites-listrow-message-alert-emptystate
plan: 08
subsystem: docs
tags: [viewmodel-shell, changelog, migration, composite-nodes, v8-accumulate, batch-then-ship, breaking-rename, doc-only]

# Dependency graph
requires:
  - phase: 24-01
    provides: ListRowNode + ListNode.variant:"rows" shipped
  - phase: 24-02
    provides: MessageNode + MessageListNode shipped
  - phase: 24-03
    provides: AlertNode shipped
  - phase: 24-04
    provides: EmptyStateNode BREAKING RENAME (heading→title, message→description) + .NET Tooltip removed
  - phase: 23-08
    provides: pre-existing "Unreleased — v8.0.0 (in progress)" CHANGELOG heading + v8.0.0 MIGRATION section (foundations)
provides:
  - CHANGELOG.md: 4 new Added entries (ListRow/Message+MessageList/Alert + note w/ FeatureProbe pending 24-08) + 1 Changed (BREAKING) entry (EmptyStateNode rename + Tooltip removal)
  - MIGRATION.md: v8.0.0 section restructured with sub-headings (Phase 23 additive + Phase 24 breaking rename + Phase 24 additive composites); before/after code blocks + sed one-liners for the EmptyStateNode rewrite
  - Explicit callout: AlertNode's dismissible dispatches RESERVED action name "dismiss"
  - Explicit callout: MessageListNode.followTail REUSES SectionNode's shipped `data-follow-tail` mechanism verbatim
affects: [24-09 (final gate — verifies CHANGELOG + MIGRATION accurate), phase-26 (v8.0.0 release closeout — flips Unreleased heading to versioned)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BATCH-THEN-SHIP CHANGELOG ACCUMULATION: v8.0.0 heading created in Phase 23 plan 23-08 GROWS across Phase 23-26 without a release. The Unreleased heading + batch-then-ship reminder stay put; entries append. Phase 24 adds 4 Added + 1 Changed (BREAKING) under the existing heading. Version files (npm 7.1.0, NuGet 7.0.0) UNTOUCHED — verified post-write."
    - "MIGRATION.md HEADING PROMOTION: The v8.0.0 section heading was 'nothing to do (all foundations additive)' after Phase 23; Phase 24 promotes it to 'ONE break: EmptyStateNode field rename' since the EmptyStateNode COMP-08 rename is now the ONLY v8.0 wire break. Sub-headings organize Phase 23 (additive) + Phase 24 breaking rename + Phase 24 additive composites."
    - "MANDATORY REUSE-DISCIPLINE CALLOUTS: Both docs explicitly state MessageListNode.followTail REUSES SectionNode's shipped `data-follow-tail` mechanism (no parallel implementation) and AlertNode.dismissible dispatches RESERVED `dismiss` action name. These callouts protect against future re-implementations by making the reuse a documented contract."

key-files:
  created:
    - .planning/phases/24-v8-0-primary-composites-listrow-message-alert-emptystate/24-08-SUMMARY.md
  modified:
    - CHANGELOG.md
    - MIGRATION.md

key-decisions:
  - "UPDATED batch-then-ship reminder wording: Changed 'Do NOT publish Phase 23 as its own release' → 'Do NOT publish Phase 24 as its own release' (per PLAN.md task 1(d) explicit text) — reflects the currently-active phase; the general prohibition on mid-major release remains."
  - "PROMOTED MIGRATION heading: Changed 'nothing to do (all foundations additive)' → 'ONE break: EmptyStateNode field rename' because Phase 24 introduces the one wire break v8.0 carries. The batch-then-ship note remains; the Phase 23 additive content is preserved as a sub-heading below."
  - "GROUPED ListRowNode + ListNode.variant:'rows' as a single CHANGELOG Added entry (COMP-05 + 05a) since 05a is a one-line extension of the shipped ListNode consumed by 05, not a standalone new node — following PATTERNS.md §13 exactly."
  - "GROUPED MessageNode + MessageListNode as a single Added entry (COMP-06 + 06a) with the followTail-reuse callout inline, since they form one recipe pair (the list is only usable with messages)."
  - "AlertNode reserved-dismiss callout FLAGGED as RESERVED (uppercase word for scannability) — matches PATTERNS.md §13 language. Apps needing a distinct name compose their own button in `actions[]`."
  - "MIGRATION includes explicit sed one-liners for BOTH TS and .NET consumers — a copy-pasteable rewrite recipe, not just prose. .NET recipe includes a manual step for the Tooltip removal since sed can't cleanly strip a named argument."
  - "Tooltip removal documented with 'no TS consumer impact' clarification — since Tooltip was .NET-only, TS consumers see no change, only .NET consumers who happened to be passing Tooltip need to remove that named argument."

patterns-established:
  - "Doc-only plan at end of a phase captures a batch of shipped work under an accumulating Unreleased heading — the pattern for every batch-then-ship major line (v8.0.0's Phase 23-26). No version bump, no publish; the heading flips to versioned only at the final phase's release closeout."
  - "The BREAKING wire change in a major line gets prominent flagging + a copy-pasteable rewrite recipe (before/after code blocks + sed one-liners for both TS and .NET) — mirrors the v7.0.0 TrackerCell.label→tooltip pattern in the same MIGRATION.md file."

metrics:
  duration_minutes: 8
  completed: 2026-07-29
---

# Phase 24 Plan 08: CHANGELOG + MIGRATION accumulate 4 primary composites + EmptyStateNode BREAKING rename Summary

Doc-only plan: `CHANGELOG.md` and `MIGRATION.md` grew under the existing "Unreleased — v8.0.0 (in progress)" heading (created by Phase 23 plan 23-08). No code touched; no version bumped; no release fired.

## What changed

### CHANGELOG.md (+9 lines net; +8 additions in the `## Unreleased — v8.0.0` section)

Under `### Added` (4 new entries below the existing 4 Phase-23 foundations):

- **`ListRowNode` + `ListNode.variant: "rows"`** — dense list row with 3-tier typography; slots `{leading?, primary, secondary?, meta?[], trailing?, tone?, state?, action?}`; consumes v8.0 COMP-01 (`TextNode.style:"caption"`) + COMP-02 (`TextNode.weight:"medium"`). Pairs with the ListNode `"rows"` variant extension. (COMP-05 + 05a)
- **`MessageNode` + `MessageListNode`** — chat/comment recipe; slots `{avatar?, author, timestamp?, content, role?, actions?}` on MessageNode + `followTail?: boolean` on MessageListNode. **Explicit callout**: `followTail` REUSES `SectionNode`'s shipped `data-follow-tail` mechanism verbatim; the only new adapter code is `el.dataset.followTail = ""`. (COMP-06 + 06a)
- **`AlertNode`** — prominent status message; slots `{tone(required), title?, message, icon?, actions?, dismissible?}`. Framework owns the tone→icon default map (`danger`→`x-circle`, `warning`→`alert-triangle`, `success`→`check-circle`, `info`→`info`). `dismissible: true` dispatches **RESERVED** action name `"dismiss"`. (COMP-07)

New `### Changed (BREAKING)` sub-section (Phase 24's ONE wire break):

- **`EmptyStateNode` field rename + new icon slot (COMP-08)**. Old `{ heading, message?, action? }` → new `{ icon?, title, description?, action? }`. `title` is now REQUIRED where `heading` was optional. .NET record additionally REMOVES the legacy `Tooltip` field for byte-alignment (never in TS twin — Class-1 defect cleanup). References `MIGRATION.md` for the rewrite.

Batch-then-ship reminder updated: `"Do NOT publish Phase 23..."` → `"Do NOT publish Phase 24..."` (per PLAN.md task 1(d) explicit wording).

### MIGRATION.md (+49 lines / -2 lines net)

Restructured the v8.0.0 heading from `"nothing to do (all foundations additive)"` → `"ONE break: EmptyStateNode field rename"` since Phase 24 introduces the sole v8.0 wire break. Sub-headings now organize:

1. **Phase 23 foundations — purely additive** (preserved from Phase 23 plan 23-08).
2. **EmptyStateNode field rename (COMP-08, BREAKING) — Phase 24** — before/after TypeScript code blocks; .NET record rename; automated rewrite recipe with `sed` one-liners for both TS/bun (`sed -i 's/heading:/title:/g; s/message:/description:/g'`) and .NET/C# (`sed -i 's/Heading:/Title:/g; s/Message:/Description:/g'` + manual `Tooltip:` removal note).
3. **ListRowNode, MessageNode, MessageListNode, AlertNode (COMP-05, 06, 06a, 07) — new node types** — additive; explicit `AlertNode.dismissible` RESERVED `"dismiss"` action-name callout + `MessageListNode.followTail` reuse-of-`data-follow-tail` callout.

Older-release sections (v7.0.0, v6.12.0, etc.) UNCHANGED — verified via `git diff --stat` showing net +49/-2 in one file.

## Version files untouched — verified post-write

- `viewmodel-shell/package.json` → `"version": "7.1.0"` (unchanged from Phase 23; Markdown-hooks patch line).
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` → `<Version>7.0.0</Version>` (unchanged from Phase 22; NuGet sits out the 7.1.0 npm patch).
- `grep -c '"version": "8'` on `package.json` → `0` (no v8 leak).
- `grep -c '<Version>8'` on `.csproj` → `0` (no v8 leak).

## No release fired

Batch-then-ship discipline: v8.0.0 publishes at Phase 26 closeout with all 10 composites + 3 wire tweaks + 4 foundations in one aligned release. This plan touches `CHANGELOG.md` + `MIGRATION.md` only. No `npm publish`, no `dotnet nuget push`, no `git tag`, no `git push`.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met on the first pass; grep verifications listed in the plan all returned expected counts.

## Verification (per plan acceptance criteria)

### CHANGELOG.md
- `grep -c 'Unreleased — v8\.0\.0' CHANGELOG.md` → `1` ✓ (heading preserved)
- `grep -c 'ListRowNode' CHANGELOG.md` → `3` ✓ (Added entry + prior COMP-01/02 cross-references)
- `grep -c 'MessageListNode' CHANGELOG.md` → `1` ✓
- `grep -c 'AlertNode' CHANGELOG.md` → `1` ✓
- `grep -c 'Changed (BREAKING)' CHANGELOG.md` → `3` ✓ (new v8.0 entry + 2 prior historical entries)
- `grep -c 'data-follow-tail' CHANGELOG.md` → `2` ✓ (reuse callout)
- `grep -c 'RESERVED' CHANGELOG.md` → `1` ✓ (dismiss action callout)
- `grep -c 'Tooltip' CHANGELOG.md` → `9` ✓ (Tooltip removal named)
- `grep -c 'Batch-then-ship' CHANGELOG.md` → `1` ✓ (reminder preserved, updated to Phase 24)
- Version files unchanged: `"version": "7.1.0"` + `<Version>7.0.0</Version>` ✓

### MIGRATION.md
- `grep -c 'v8\.0\.0' MIGRATION.md` → `1` ✓
- `grep -c 'EmptyStateNode' MIGRATION.md` → `5` ✓ (heading + sections + record rename + demos)
- `grep -c 'heading → title' MIGRATION.md` → `1` ✓ (rename spelled out)
- `grep -c 'ListRowNode\|MessageNode\|AlertNode' MIGRATION.md` → `2` ✓ (heading + prose)
- `grep -c 'Additive' MIGRATION.md` → `5` ✓ (both this v8.0 section + prior release sections)
- `grep -c 'RESERVED' MIGRATION.md` → `1` ✓
- `grep -c 'data-follow-tail\|followTail' MIGRATION.md` → `1` ✓
- `grep -c 'Tooltip.*REMOVED\|Tooltip.*removed' MIGRATION.md` → `1` ✓

### Green-tree gate (per PLAN.md — doc-only, not strictly required)

Doc-only plan; no code, no tests, no build. `git status --short` after commit shows only the 3 expected files (CHANGELOG.md + MIGRATION.md + this SUMMARY).

## Self-Check: PASSED

All files created + committed on record; all grep verifications above return non-zero counts as specified in the plan; version files verified untouched.
