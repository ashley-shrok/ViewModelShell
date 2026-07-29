---
phase: 24-v8-0-primary-composites-listrow-message-alert-emptystate
plan: 05
subsystem: docs
tags: [design-doc, agents-md, composite-nodes-layer, route-b, governance, inventory, breaking-rename-callout, followtail-reuse-callout, docs-only]

# Dependency graph
requires:
  - phase: 23
    provides: "composite-nodes-layer.md design of record (Phase 23 plan 23-05) + AGENTS.md Route B governance section frame (Phase 23 plan 23-06). This plan grows both docs' inventories with the 4 primaries."
  - phase: 24-01
    provides: "ListRowNode + ListNode.variant:\"rows\" shipped on main (SUMMARY at 24-01-SUMMARY.md). Ships the first primary composite documented in this plan's inventory."
provides:
  - "composite-nodes-layer.md §4 Shipped recipe inventory table populated with 4 primary composites (ListRowNode, MessageNode+MessageListNode, AlertNode, EmptyStateNode). Table includes wire type, .NET record, Phase 23 foundations consumed, followTail reuse callout, tone→icon default map callout, BREAKING wire rename flag."
  - "AGENTS.md Route B section 'Currently shipped recipes' subsection populated with same 4 primaries (mirrors design-doc table); the ':744' placeholder ('To be populated') is gone."
  - "BREAKING wire-rename callout added inline beneath the §4c EmptyStateNode schema block in composite-nodes-layer.md (belt-and-suspenders with the shipped-inventory table)."
affects: ["24-06 (adds AlertNode entries to same table when 24-03 lands)", "24-07..09 (later Phase 24 plans append entries as their composites land)", "25-* (Phase 25 planner replaces TBD placeholders with real rows as secondary composites land)", "26-* (Phase 26 planner adds release-ritual entry when the aligned npm+NuGet publish lands)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Docs-describe-shipped-only inventory: both docs preserve the AGENTS.md Phase 23-06 convention that inventory rows/entries appear only after the plan's SUMMARY lands on main. Phase 25 composites stay as TBD placeholders in both docs, not populated ahead of code. The Phase 25/26 rows in the design-doc table are stubs (all cells TBD except Composite name and Phase); they get filled as `/gsd:plan-phase 25` and `/gsd:plan-phase 26` land."
    - "Copy-consistency across the two docs: same 4 composites, same followTail-reuse callout, same tone→icon default map, same BREAKING wire-rename flag appear in both docs. This is the same discipline the AGENTS.md :742 note enforces for §2 (governance rule) and §3 (typed-slots pattern) — the two documents must stay aligned; this plan extends that alignment to the inventory."
    - "Table-plus-free-form structure in the design doc: the new Shipped recipe inventory table lives at the top of §4 (records what HAS shipped); the free-form §§4a-4d record design rationale + slot-schema justifications for the whole milestone (what SHOULD ship). Complementary views: the free-form sections explain the 'why' and 'what to build'; the table records the 'what's actually live'."

key-files:
  created:
    - ".planning/phases/24-v8-0-primary-composites-listrow-message-alert-emptystate/24-05-SUMMARY.md — this file"
  modified:
    - ".planning/design/composite-nodes-layer.md — new 'Shipped recipe inventory' subsection added at the top of §4 (22 insertions, 0 deletions). Table has 4 populated primary rows + 5 TBD Phase 25 rows + 1 TBD Phase 26 release-ritual row. Also added a BREAKING wire-rename callout beneath the §4c EmptyStateNode schema block."
    - "AGENTS.md — 'Current recipe inventory' placeholder at :744 replaced with a populated 'Currently shipped recipes' list (10 insertions, 1 deletion — the placeholder line). Same 4 primaries; followTail reuse + tone→icon map + BREAKING rename callouts mirror the design-doc table. Rest of Route B governance section untouched (diff scoped to placeholder region only)."

key-decisions:
  - "Table placement in composite-nodes-layer.md: new 'Shipped recipe inventory' subsection lives at the TOP of §4, not as a new §5. Reason: keeps everything about the milestone inventory (shipped vs planned) under one heading; a reader landing at §4 sees 'what's live' before 'what's planned', which is the natural reading order for anyone using the doc to check status. Preserves the existing §§4a-4d free-form structure unchanged (they remain the design rationale for the whole milestone set); the table augments, doesn't replace."
  - "EmptyStateNode row in the inventory table explicitly flagged as BREAKING wire rename (heading→title, message→description) — the only breaking wire change in v8.0.0. Also added a second BREAKING callout inline beneath the §4c EmptyStateNode schema block for belt-and-suspenders discoverability (a reader who scrolls to the schema block sees the flag even if they missed the inventory table). Same rename called out in AGENTS.md 'Currently shipped recipes' as 'v8.0 WIRE BREAKING' so operators reading AGENTS.md see it immediately."
  - "MessageListNode.followTail row explicitly names 'REUSES SectionNode.followTail's shipped mechanism VERBATIM' — with file/line reference (browser.ts:227-246 + 362-372). Reason: this is exactly the kind of implementation reuse that later planners could re-derive (or re-implement) if the inventory doesn't record it prominently. Also mirrored in AGENTS.md so an operator reading either doc knows a growing-feed composite (activity feed, live log, notification stream) reuses the same one-line `el.dataset.followTail = ''` addition."
  - "AlertNode row explicitly names the tone→icon default map (danger→x-circle, warning→alert-triangle, success→check-circle, info→info) BAKED into browser.ts:ALERT_TONE_ICON. Reason: this is the answer to Moxie's original 'banner' ask (per composite-nodes-layer.md §4c note); a reader looking for 'how does tone become an icon' finds it in the inventory row without needing to spelunk in browser.ts. Also names the RESERVED {name:\"dismiss\"} action on dismissible:true so a consumer knows the naming convention before wiring their action handler."

patterns-established:
  - "Docs-describe-shipped-only inventory table pattern: the design doc grows a 'Shipped recipe inventory' table with populated rows for landed composites and TBD placeholder rows for future phases. Later Phase 24 plans (24-06 for AlertNode; the MessageNode plan for the twin composites; the EmptyStateNode plan) append to the populated rows; Phase 25 planner replaces TBD placeholders with real rows as each secondary composite lands. This is the append-only-inventory-grows-with-code convention formalized as a table shape."
  - "Belt-and-suspenders BREAKING-wire-change flagging: the same v8.0 EmptyStateNode wire rename is flagged in 3 places (inventory table 'Consumes' column; inline callout beneath §4c EmptyStateNode schema block; AGENTS.md 'Currently shipped recipes' entry). Reusable pattern for any future breaking wire change — flag it in the design doc's shipped-inventory table AND in the free-form section that documents the schema AND in AGENTS.md so operators reading any of the three surfaces see the flag."

requirements-completed: [COMP-05, COMP-05a, COMP-06, COMP-06a, COMP-07, COMP-08]

# Metrics
duration: 2min
completed: 2026-07-29
---

# Phase 24 Plan 05: Grow composite-nodes-layer.md + AGENTS.md inventories with 4 primary composites — Summary

**Docs-only plan that fills the Shipped recipe inventory table in `.planning/design/composite-nodes-layer.md` and replaces the AGENTS.md 'Currently shipped recipes' placeholder at :744 — both with the 4 primary composites of Phase 24 (ListRowNode + ListNode.variant:"rows", MessageNode + MessageListNode, AlertNode, EmptyStateNode). MessageListNode.followTail-REUSES-SectionNode.followTail callout preserved in both docs. EmptyStateNode BREAKING wire rename flagged in three places (inventory table, inline callout beneath §4c schema block, AGENTS.md entry). Phase 25/26 rows stay TBD per the 'docs describe SHIPPED recipes only' convention.**

## Performance

- **Duration:** ~2 min
- **Tasks:** 2 (both `type=auto`, no checkpoints hit)
- **Files created:** 1 (`24-05-SUMMARY.md`)
- **Files modified:** 2 (`.planning/design/composite-nodes-layer.md`, `AGENTS.md`)
- **Additions:** 32 net line insertions (design doc: +22, AGENTS.md: +10, -1)
- **Deletions:** none unexpected (only the AGENTS.md placeholder line replaced by the populated list)

## Accomplishments

- **Design-doc `Shipped recipe inventory` table populated with 4 primaries.** New subsection at the top of §4 in `composite-nodes-layer.md`. Table columns: Composite | Slot summary | Phase | Wire type | .NET record | Consumes. 4 populated rows for ListRowNode + ListNode.variant:"rows", MessageNode, MessageListNode, AlertNode, EmptyStateNode; 5 TBD rows for Phase 25 composites (UserRow, DetailRow, Timeline, SettingRow, Chip+ChipList); 1 TBD row for Phase 26 release ritual. Header paragraph explicitly names the "docs don't race ahead of code" convention.
- **MessageListNode.followTail REUSES SectionNode.followTail callout prominent in both docs.** The Consumes column in the design-doc table names "REUSES `SectionNode.followTail`'s shipped mechanism VERBATIM — the pre-render snapshot / post-render restore at `browser.ts:227-246 + 362-372` walks EVERY `[data-follow-tail]` element, so the renderer arm is a one-line addition `el.dataset.followTail = ''`. Zero new adapter code." The AGENTS.md entry has the same callout with the same file:line reference. A future planner considering a growing-feed composite (activity feed, live log, notification stream) sees the same reuse posture in both docs.
- **AlertNode tone→icon default map named in both docs.** Both docs cite `browser.ts:ALERT_TONE_ICON` and the four mappings (`danger`→`x-circle`, `warning`→`alert-triangle`, `success`→`check-circle`, `info`→`info`). Both note the RESERVED `{name:"dismiss"}` dispatch on `dismissible:true` and the escape hatch (compose your own dismiss button in `actions[]` for a distinct name).
- **EmptyStateNode BREAKING wire rename flagged in 3 places.** (1) The Consumes column in the design-doc inventory table: "BREAKING wire rename from v7.x". (2) A new inline callout added beneath the §4c EmptyStateNode schema block ("v8.0 BREAKING wire rename. EmptyStateNode is not a new node — it was pre-existing … this is the only BREAKING wire change in the v8.0.0 composite-nodes layer"). (3) The AGENTS.md entry: "v8.0 WIRE BREAKING: field rename `heading→title`, `message→description`; new `icon?` slot. NOT a new node — a pre-existing shipped node whose schema was tightened at the milestone boundary." All three surfaces point at `MIGRATION.md` for consumer migration guidance.
- **Phase 25 + Phase 26 TBD placeholders preserved in both docs.** Design doc: 5 TBD rows for Phase 25 composites + 1 TBD row for Phase 26 release ritual. AGENTS.md: single-line notes for each phase ("TBD in `/gsd:plan-phase 25`"; "TBD (aligned v8.0.0 npm + NuGet publish; comprehensive tailnet verification page across all 10 composites + 3 wire tweaks + 1 new primitive)"). Both preserve the append-only-inventory-grows-with-code convention.
- **Rest of AGENTS.md Route B section untouched (git diff scoped to placeholder region only).** Verified: `git diff --stat AGENTS.md` shows 10 insertions + 1 deletion, all within the "Currently shipped recipes" paragraph replacement. The earn-a-composite rule, the typed-slots pattern block, the multi-phase milestone plan reference are all unchanged.

## Task Commits

Each task committed atomically:

1. **Task 1: Grow the Shipped Recipe Inventory table in `.planning/design/composite-nodes-layer.md`** — `5f8dd65` (docs)
2. **Task 2: Replace AGENTS.md 'Currently shipped recipes' placeholder with populated inventory** — `720844d` (docs)

## Files Created / Modified

**Created:**
- `.planning/phases/24-v8-0-primary-composites-listrow-message-alert-emptystate/24-05-SUMMARY.md` — this file

**Modified:**
- `.planning/design/composite-nodes-layer.md` — new "Shipped recipe inventory" subsection at top of §4 (table with 4 populated rows + 6 TBD rows) + BREAKING wire-rename callout beneath §4c EmptyStateNode schema block (22 insertions, 0 deletions)
- `AGENTS.md` — "Current recipe inventory" placeholder at :744 replaced with populated "Currently shipped recipes" list (10 insertions, 1 deletion; diff scoped strictly to placeholder region)

## Deviations from Plan

None — plan executed exactly as written. Both tasks landed with every acceptance criterion met on the first pass. No Rule 1/2/3 fixes needed; no Rule 4 architectural decisions raised. Green-tree gate not applicable (docs-only plan; PLAN.md's `<verification>` explicitly notes "no build/test to run beyond grep checks").

## Threat Flags

None — docs-only plan; zero runtime surface change; no new input parsing, no new URL, no auth interaction, no new wire field. Per PLAN.md `<threat_model>`, the only recorded threat is T-24-05-02 (doc drift ahead of code), mitigated by preserving Phase 25/26 TBD placeholders in both docs — verified by grep counts (Phase 25 mentions: design doc 6 rows, AGENTS.md 1 line; Phase 26 mentions: design doc 1 row, AGENTS.md 1 line).

## Downstream Composability Notes

- **Later Phase 24 plans (24-06, 24-07, 24-08, 24-09) append to the populated table.** As each of MessageNode/MessageListNode, AlertNode, and EmptyStateNode's implementation plans land on main, the corresponding row in the design-doc table is updated with actual file:line references and the AGENTS.md list gets its "Currently shipped" entry updated to match. This plan lands the FRAME with all 4 primaries pre-populated (per PLAN.md's mandate to describe what WILL ship in Phase 24, since the 4 planning artifacts and 24-01's SUMMARY are all landed); subsequent plans REFINE the entries with landed-code details as each composite ships.
- **Phase 25 planner replaces TBD placeholders with real rows.** Design doc: 5 TBD rows for UserRow / DetailRow+DetailList / Timeline+TimelineEntry / SettingRow+SettingList / Chip+ChipList. AGENTS.md: single-line TBD note. Phase 25 planner reads this inventory to know which rows to update.
- **Phase 26 planner replaces the release-ritual TBD row.** Design doc: 1 TBD row for the aligned v8.0.0 npm + NuGet publish. AGENTS.md: single-line TBD note pointing at composite-nodes-layer.md §5. Phase 26 planner also runs a final consistency check that the shipped-inventory table matches the actual shipped composite set on the aligned release commit.

## Self-Check: PASSED

- Both modified files present on disk with expected content:
  - `.planning/design/composite-nodes-layer.md`: `grep -c 'Shipped recipe inventory'` = 1 (section heading); `grep -c 'ListRowNode'` = 9; `grep -c 'MessageListNode'` = 5; `grep -c 'AlertNode'` = 6; `grep -c 'EmptyStateNode'` = 8; `grep -c 'REUSE\|Reuses\|reuses\|REUSES'` = 4; `grep -c 'BREAKING\|breaking wire'` = 3; `grep -c 'followTail\|data-follow-tail'` = 4; `grep -c 'ALERT_TONE_ICON\|tone→icon'` = 3.
  - `AGENTS.md`: `grep -c 'Currently shipped recipes'` = 1; `grep -c 'To be populated'` = 0 (placeholder gone); `grep -c 'ListRowNode'` = 1; `grep -c 'MessageNode'` = 1; `grep -c 'MessageListNode'` = 1; `grep -c 'AlertNode'` = 1; `grep -c 'EmptyStateNode'` = 1; `grep -c 'REUSES SectionNode\.followTail\|data-follow-tail'` = 1; `grep -c 'BREAKING'` = 1; `grep -c 'x-circle\|alert-triangle\|check-circle'` = 1; `grep -c 'dismiss'` = 5; `grep -c 'Phase 25'` = 1; `grep -c 'Phase 26'` = 1.
- Both task commits present in `git log --oneline`: `5f8dd65` (Task 1) + `720844d` (Task 2).
- No unexpected file deletions on either commit (`git diff --diff-filter=D --name-only HEAD~1 HEAD` returned empty for both).
- Rest of AGENTS.md Route B governance section untouched — `git diff AGENTS.md` shows 10 insertions + 1 deletion, all within the placeholder region.
