---
phase: 33-column-filter-expansion-phase-2-adapter-ui-popover-slash-thr
plan: "05"
subsystem: docs / release
tags: [docs, changelog, migration, agents-md, filter, v10, breaking]
dependency_graph:
  requires:
    - "33-02 — old wire field removal from both backends"
    - "33-03 — HelpDesk .NET migration (D-05 reference source)"
  provides:
    - "MIGRATION.md v10.0.0 section with 8-removed-fields table + before/after HelpDesk C# + TS snippets"
    - "AGENTS.md Typed column-filter primitive section (wire shape + truth function + UI grammar + C# + TS examples + 5 non-obvious behaviors)"
    - "CHANGELOG.md ## Unreleased promoted to ## 10.0.0 — 2026-08-18 with Phase 32 content preserved + Phase 33 additions"
  affects:
    - MIGRATION.md
    - AGENTS.md
    - CHANGELOG.md
tech_stack:
  added: []
  patterns:
    - "MIGRATION.md top-of-file append-latest-first ordering (new section at top)"
    - "AGENTS.md new subsection under ### Tables in VMS — natural insertion point"
    - "CHANGELOG.md section-header promotion only (single line edit) + content append"
key_files:
  created: []
  modified:
    - MIGRATION.md
    - AGENTS.md
    - CHANGELOG.md
decisions:
  - "MIGRATION.md before/after sourced from real git history (commit 7b22cee pre-migration vs current AgentController.cs post-33-03)"
  - "AGENTS.md section inserted between 'Tables in VMS — the canonical workflow pattern' and 'In-modal success feedback (modal-swap-to-success)' — natural table-feature grouping"
  - "CHANGELOG.md Phase 32 content text updated from 'additive, no version bump yet' to 'first staged in ## Unreleased' to reflect the now-released state"
  - "Deferred: browser.ts mutation fix observed in worktree (outsideClickHandler committing instead of discarding) was NOT staged — pre-existing change belonging to a parallel plan wave, not this docs plan"
metrics:
  duration: ~4 minutes
  completed: 2026-08-18T22:27:00Z
  tasks_completed: 2
  files_changed: 3
---

# Phase 33 Plan 05: Docs — MIGRATION.md + AGENTS.md + CHANGELOG.md Promotion Summary

**One-liner:** v10.0.0 release documentation — MIGRATION.md wire-replacement guide with real before/after HelpDesk C# snippets, AGENTS.md typed column-filter primitive section with wire shape + UI grammar + code examples, CHANGELOG.md `## Unreleased` promoted to `## 10.0.0 — 2026-08-18`.

## What Was Built

### Task 1: MIGRATION.md v10.0.0 section (commit 868f2b5)

New `## Migrating to v10.0.0 — Typed column-filter wire (BREAKING)` section at the top of MIGRATION.md (most-recent-first ordering). Contains:

- **8-removed-fields table** — 4 TypeScript fields (`TableColumn.filterable`, `TableColumn.filterValue`, `TableNode.filterBinds`, `TableNode.filterAction`) + 4 .NET equivalents, presented as a two-column table (Backend | Removed from | Field).
- **Replacement shape description** — `filter?: FilterSpec` per column + `filterDescriptorBinds` per table + `FilterDescriptor` in state + truth function call in action handler.
- **C# before/after diff** sourced from real git history (commit 7b22cee = pre-migration HelpDesk AgentController.cs; current file post-33-03 = after). Shows:
  - State record: `string TitleFilter` → `FilterDescriptor? TitleFilterDescriptor` with `[property: JsonIgnore(WhenWritingNull)]`
  - BuildVm column: `Filterable: true, FilterValue: state.TitleFilter.Length > 0 ? state.TitleFilter : null` → `Filter: new FilterSpec("text")`
  - BuildVm table: `FilterBinds: { ["title"] = "titleFilter" }, FilterAction: new ActionDescriptor("filter-text")` → `FilterDescriptorBinds: { ["title"] = "titleFilterDescriptor" }`
  - Action handler: separate `else if (name == "filter-text")` case + `db.GetMatching(status, state.TitleFilter, Cap)` → merged `if (name.StartsWith("filter-"))` + in-memory `FilterHelper.MatchesFilter` application
- **TypeScript before/after** — brief, showing the filterBinds/filterAction → filterDescriptorBinds + matchesFilter pattern; includes the browser-only-page caveat (Gotcha #13).
- **Consumer upgrade note** — no compatibility layer; upgrade in place.
- **Companion NuGet** — `AshleyShrok.ViewModelShell.Markdown` must upgrade to `0.2.3` alongside core 10.0.0 (mandatory rebuild per AGENTS.md core-major-bump rule).
- **Bumping instructions** — npm + NuGet copy-paste install commands.

### Task 2: AGENTS.md new section + CHANGELOG.md promotion (commit b74e987)

**AGENTS.md:** New `### Typed column-filter primitive (v10.0.0)` section inserted between the existing "Worked example" paragraph of the Tables-in-VMS section and the `### In-modal success feedback` section. Section covers:

1. **Concern→source table** pointing at `index.ts`, `ViewModels.cs`, `browser.ts`, `server.ts`, and `MIGRATION.md` as authoritative sources (per AGENTS.md convention — no drift-prone catalog of enum values inline).
2. **Wire shape concept map** — four fields in a table: `filter?: FilterSpec` on column, `filterDescriptorBinds` on table, `FilterDescriptor` in state, `FilterRule` inside descriptor.rules.
3. **Reference truth function** — TS (`import { matchesFilter } from "@ashley-shrok/viewmodel-shell/server"`) + C# (`FilterHelper.MatchesFilter`), brief with signature.
4. **C# wiring example** — 15-line state record snippet + column FilterSpec declaration + filterDescriptorBinds map + in-memory FilterHelper.MatchesFilter call.
5. **TypeScript wiring example** — column filter declaration + filterDescriptorBinds + matchesFilter call with server-subpath import.
6. **UI grammar description** — always-visible inline input, icon state grammar (filter-slash/filter/filter+dot), escalation popover (operator picker, typed value inputs, add-rule, joiner, Apply/Clear), portal positioning, inline read-only summary.
7. **5 non-obvious behaviors** — filter commits are state-writes not named actions; contains works on every kind; "is empty" definition; `filterDescriptorBinds` keys are column keys; browser-only pages cannot import from server subpath.
8. **Worked examples** — HelpDesk + FeatureProbe demos for both backends.

**CHANGELOG.md:** Replaced `## Unreleased` header line with `## 10.0.0 — 2026-08-18 (npm + NuGet aligned) — BREAKING`. Phase 32 content preserved with one minor text clarification ("first staged in `## Unreleased`" instead of "additive, no version bump yet"). Phase 33 additions appended under the same version header:
- Added: column-filter UI (browser adapter), new `filter-slash` icon glyph, demo migration
- Breaking changes: 8 removed old filter wire fields, migration guide reference
- Deferred: TUI filter-row refresh
- Consumers: upgrade note + Markdown companion 0.2.3 note

## Verification Results

```
grep -c "Migrating to v10.0.0" MIGRATION.md → 1 ✓
grep -c "FilterSpec" MIGRATION.md            → 4 ✓ (≥ 2 required)
grep -c "^## Unreleased" CHANGELOG.md        → 0 ✓ (promoted)
grep -c "^## 10.0.0" CHANGELOG.md            → 1 ✓
grep -c "filter-slash" CHANGELOG.md          → 2 ✓ (≥ 1 required)
grep -c "Typed column-filter" AGENTS.md      → 1 ✓
grep -c "FilterSpec" AGENTS.md               → 3 ✓ (≥ 1 required)
npx vitest run                               → 88 files, 1610 passed, 1 skipped ✓
npm run check:no-demo-style                  → PASS ✓
```

## Deviations from Plan

### None affecting plan outcomes

**1. Pre-existing browser.ts modification in worktree (not staged)**
- **Found during:** Task 2 commit staging
- **Issue:** A 4-line modification to `viewmodel-shell/src/browser.ts` (outsideClickHandler committing instead of discarding) was present in the worktree but not committed. This appears to be from a parallel plan wave (33-04, tests), not from this docs plan.
- **Action:** Deliberately NOT staged — only AGENTS.md and CHANGELOG.md were staged per this task's scope. The browser.ts change remains unstaged in the worktree for the parallel wave to handle.

## Known Stubs

None. All documentation describes real shipped functionality from Plans 33-01, 33-02, and 33-03.

## Threat Flags

None. Documentation files only — no new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

Files verified:
- `MIGRATION.md`: FOUND with "Migrating to v10.0.0" section
- `AGENTS.md`: FOUND with "Typed column-filter primitive" section
- `CHANGELOG.md`: FOUND with "10.0.0" header, no "^## Unreleased" section

Commits verified:
- `git log --oneline | grep 868f2b5` — FOUND (Task 1: MIGRATION.md)
- `git log --oneline | grep b74e987` — FOUND (Task 2: AGENTS.md + CHANGELOG.md)

## Commits

| Task | Commit | Message | Files |
|------|--------|---------|-------|
| 1 | 868f2b5 | docs(33-05): add Migrating to v10.0.0 section to MIGRATION.md | MIGRATION.md |
| 2 | b74e987 | docs(33-05): add typed column-filter section to AGENTS.md + promote CHANGELOG Unreleased to 10.0.0 | AGENTS.md, CHANGELOG.md |
