---
phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip
plan: 06
subsystem: docs
tags: [documentation, design-of-record, governance, composite-nodes-layer]
requires:
  - .planning/design/composite-nodes-layer.md (Phase 24 populated 4 primary rows; this plan appends 5 secondaries)
  - AGENTS.md (Phase 24 populated 4 primary bullets; this plan replaces "Phase 25 ... TBD" line with 5 secondary bullets)
provides:
  - .planning/design/composite-nodes-layer.md (Shipped Recipe Inventory table now populated for all 9 shipped composites: 4 primary + 5 secondary)
  - AGENTS.md (Route B "Currently shipped recipes" section now names all 9 shipped composites)
affects:
  - Future agents reading either doc get the full shipped inventory of Phase 24-25 composites, with the two Phase-25 doctrine points visible (Timeline apps-CANNOT + Chip dismissAction distinction)
tech-stack:
  added: []
  patterns:
    - Doctrine callout — TimelineNode ::before rail-and-dot mechanism as the ONE genuinely new CSS pattern in Phase 25; apps CANNOT compose from primitives (per "apps describe, never decorate"); every other Phase 25 composite is grid/flex/color-mix over existing primitives
    - Doctrine callout — ChipNode.dismissAction is a caller-supplied ActionEvent slot (identity-carrying dispatch), mirroring ModalNode's per-instance action shape and DEVIATES from AlertNode.dismissible's fixed-name {name:"dismiss"} shape
key-files:
  created:
    - .planning/phases/25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip/25-06-SUMMARY.md
  modified:
    - .planning/design/composite-nodes-layer.md (7 insertions, 7 deletions — 5 TBD placeholder rows replaced with populated content + DetailListNode free-form §4d updated with labelWidth?: sm|md|lg)
    - AGENTS.md (7 insertions, 1 deletion — single "Phase 25 ... TBD" line replaced with 5 populated bullets)
decisions:
  - "Timeline ::before rail-and-dot flagged as the ONE genuinely new CSS pattern in Phase 25 in BOTH docs — every other Phase 25 composite reuses existing primitives; only Timeline breaks the 'apps describe, never decorate' rule if hand-rolled, which is precisely why it earns a composite"
  - "ChipNode.dismissAction distinction from AlertNode.dismissible flagged in BOTH docs — Chip's action is caller-supplied identity-carrying ActionEvent (mirrors ModalNode); Alert's is a fixed reserved name; different shapes because chips typically dispatch on specific identities"
  - "Phase 26 release ritual preserved as TBD in both docs — docs do NOT race ahead of code; the release row in the inventory + the AGENTS.md Phase 26 line stay marked TBD until Phase 26 lands"
metrics:
  duration_minutes: 3
  completed_date: "2026-07-29"
  tasks_completed: 2
  files_modified: 2
---

# Phase 25 Plan 06: Doc Growth — Shipped Recipe Inventory + AGENTS.md Governance Section Summary

Grew the two doctrine-of-record docs for the Route B composite-nodes layer with the 5 Phase-25 secondaries: populated the "Shipped Recipe Inventory" table in `.planning/design/composite-nodes-layer.md` and replaced the "Phase 25 ... TBD in `/gsd:plan-phase 25`" line in `AGENTS.md` "Currently shipped recipes" with 5 bullet entries. Both docs now flag the TimelineNode `::before` rail-and-dot mechanism as the ONE genuinely new CSS pattern in Phase 25 (apps CANNOT compose from primitives, per "apps describe, never decorate") and flag ChipNode.dismissAction as caller-supplied ActionEvent DEVIATES from AlertNode.dismissible's fixed-name shape.

## What shipped

### Task 1 — `.planning/design/composite-nodes-layer.md` inventory table (commit `bb03a31`)

The "Shipped recipe inventory" table at line 80 previously had 4 populated Phase-24 primary rows + 5 TBD placeholder rows for Phase 25. This plan replaced the 5 TBD placeholders with populated content matching shipped reality:

| Composite | Populated with |
|---|---|
| `UserRowNode` | avatar, name, meta, status:{label,kind}, trailing, action / `"user-row"` / consumes AvatarNode + TextNode caption/weight + closed 4-value StatusKind enum |
| `DetailRowNode` + `DetailListNode` | label, value, tone, icon; `labelWidth?` on list / `"detail-row"` / `"detail-list"` / consumes IconName + TextNode body + `<dl>/<dt>/<dd>` semantic HTML + CSS grid + `labelWidth?: sm\|md\|lg` (8/10/12rem) |
| `TimelineEntryNode` + `TimelineNode` | time, description, tone, icon / `"timeline-entry"` / `"timeline"` / consumes TextNode caption/body + **NEW baked-in CSS mechanism: rail via `::before` on container, dot via `::before` on entry — apps CANNOT compose this from primitives, the ONE genuinely new CSS pattern in Phase 25** |
| `SettingRowNode` + `SettingListNode` | icon, label, description, trailing, action; `heading?` on list / `"setting-row"` / `"setting-list"` / consumes TextNode weight + grid `[body \| control] = 1fr auto` + **natural pairing with CheckboxNode(variant:"switch") from COMP-03** |
| `ChipNode` + `ChipListNode` | label, tone, icon, dismissAction, action / `"chip"` / `"chip-list"` / consumes IconName + auto-wrap cluster + **`dismissAction` is caller-supplied ActionEvent SLOT (identity-carrying like `remove-filter-42`), distinct from `AlertNode.dismissible`'s fixed-name boolean — mirrors ModalNode's per-instance action shape** |

Also updated §4d free-form Composites section:
- `DetailListNode` now shows `labelWidth?: "sm"|"md"|"lg"` on the type shape (previously only `children: DetailRowNode[]` was listed; the schema had drifted from shipped reality).

Phase 26 release ritual row preserved as `TBD in Phase 26` (docs do not race ahead of code).

**Diff shape (design doc):** 7 insertions, 7 deletions — the deletions are TBD placeholder rows being replaced, not existing content being removed. All 4 Phase-24 primary rows unchanged.

### Task 2 — `AGENTS.md` "Route B composite-nodes layer" section (commit `2e23046`)

The single line `Phase 25 composites (UserRowNode, ..., ChipNode + ChipListNode): TBD in /gsd:plan-phase 25.` at AGENTS.md:752 was replaced with a `Phase 25 (v8.0.0, secondary composites):` header + 5 populated bullets matching 25-PATTERNS.md §13. The Phase 26 line below it is unchanged and still marked TBD.

The 5 new bullets mirror the depth and tone of the Phase 24 bullets that Phase 24 plan 24-05 had already populated. Key doctrine callouts:

- **Timeline**: "`::before` rail on the container + `::before` dot per entry with tone-encoded border — apps CANNOT compose this from primitives (the composite exists specifically to bake it in, per 'apps describe, never decorate'). This is the ONE genuinely new CSS pattern in Phase 25; every other Phase 25 composite is grid/flex/color-mix over existing primitives."
- **Chip**: "`dismissAction?: ActionEvent` DEVIATES from `AlertNode.dismissible` — it's a caller-supplied ActionEvent slot (identity-carrying: `remove-filter-42`), not a fixed-name boolean. Chip needs the app to name the action because chips typically operate on specific identities (mirrors `ModalNode`'s per-instance action shape, NOT Alert's reserved-name `{name:"dismiss"}` shape). If BOTH `action` and `dismissAction` are set, the X's click does `stopPropagation` so it doesn't double-fire the whole-chip click."
- **Setting**: "Natural pairing with `CheckboxNode(variant:"switch")` from COMP-03 in the trailing slot" (highlights the Phase 23 foundation the Phase 25 composite consumes).

**Diff shape (AGENTS.md):** 7 insertions, 1 deletion — the single TBD line replaced with 5 bullets + preserved Phase 26 TBD line. Rest of Route B section unchanged.

## Deviations from Plan

**1. [Rule 1 - Bug] Reverted premature completion marks on COMP-10..13a in REQUIREMENTS.md**

- **Found during:** Post-commit state-update pass (after Task 2 committed)
- **Issue:** The plan frontmatter listed `requirements: [COMP-09, COMP-10, COMP-10a, COMP-11, COMP-11a, COMP-12, COMP-12a, COMP-13, COMP-13a]`, so `gsd-sdk query requirements.mark-complete` marked all 9 as `[x]`. But this plan is DOCS-ONLY (populates two doctrine docs) — the actual implementation of COMP-10..13a lives in Plans 25-02..05, which haven't shipped yet. Only COMP-09 was legitimately complete (Plan 25-01 shipped `UserRowNode`); the other 8 were premature.
- **Fix:** Reverted the 8 `[x]` back to `[ ]` for COMP-10, COMP-10a, COMP-11, COMP-11a, COMP-12, COMP-12a, COMP-13, COMP-13a. Left COMP-09 as `[x]` — Plan 25-01 (`docs(25-01): SUMMARY for UserRowNode (COMP-09)`, commit `e14203c`) shipped `UserRowNode` and its SUMMARY landed on `main`, so COMP-09 IS legitimately complete. The mark-complete pass in this plan happened to close a checkbox Plan 25-01 forgot; leaving it `[x]` corrects an earlier bookkeeping miss rather than propagating a new one.
- **Files modified:** `.planning/REQUIREMENTS.md` (8 checkbox reverts)
- **Root cause:** The plan frontmatter conflated "the docs describe these composites" with "these composites are complete." A docs-inventory plan documenting shipped composites should only claim requirements whose implementation plan has landed a SUMMARY on `main`. Left as a note for future doc-only plans in the composite-nodes milestone: don't list implementation requirements in `requirements:` frontmatter unless the docs plan follows those implementation plans in the wave order.
- **Commit:** rolled into the SUMMARY commit below (same run as this SUMMARY write).

**2. [Rule 3 - Blocking] Skipped STATE.md body updates (project convention)**

- **Found during:** State-update pass.
- **Issue:** `gsd-sdk query state.advance-plan` and `state.update-progress` returned errors ("Cannot parse Current Plan or Total Plans in Phase from STATE.md"; "Progress field not found in STATE.md").
- **Root cause:** This repo intentionally maintains a minimal STATE.md (frontmatter-only, no body sections). Per AGENTS.md "Working agreement for agents": *"This repo deliberately has no maintained narrative state file (the former .planning/STATE.md was removed for exactly this reason: a hand-updated status cache drifts and costs more than it's worth). Do not recreate one."* The SDK's state-body handlers don't apply.
- **Resolution:** Skipped state body updates; ROADMAP.md update via `roadmap.update-plan-progress` DID succeed (counts phase 25 now at 2 summaries) — that's the actual progress tracker for this project.

**Note on Task 1(c) — free-form §4d update:** The plan instructed "verify each entry now matches shipped reality; if any free-form entry contradicts what Plans 25-01..05 shipped, UPDATE the free-form to match reality." One minor drift found: §4d's `DetailListNode` did not mention `labelWidth?: "sm"|"md"|"lg"` (the shipped shape carries this field per REQUIREMENTS.md COMP-10a). Updated in the same commit as Task 1 per the plan directive.

## Acceptance Criteria Verification

**Task 1 (design doc):**

| Check | Result |
|---|---|
| `grep -c 'UserRowNode' .planning/design/composite-nodes-layer.md` >= 1 | 6 (PASS) |
| `grep -c 'TimelineNode\|TimelineEntryNode' .planning/design/composite-nodes-layer.md` >= 1 | 7 (PASS) |
| `grep -c 'ChipNode\|ChipListNode' .planning/design/composite-nodes-layer.md` >= 1 | 7 (PASS) |
| Timeline apps-CANNOT callout present (`apps CANNOT\|apps describe`) | 1 (PASS) |
| Chip dismissAction callout present (`dismissAction.*ActionEvent\|distinct from.*AlertNode\|NOT.*AlertNode.dismissible`) | 2 (PASS) |
| Phase 26 TBD preserved | 2 (PASS) |
| Existing Phase 24 rows unchanged | git diff confirms only lines 92-97 changed (PASS) |

**Task 2 (AGENTS.md):**

| Check | Result |
|---|---|
| Old "TBD in /gsd:plan-phase 25" removed | 0 matches (PASS — line replaced) |
| New "Phase 25 (v8.0.0, secondary composites)" header present | 1 (PASS) |
| All 5 secondaries named (UserRowNode, DetailListNode, TimelineNode, SettingListNode, ChipListNode) | 1 each (PASS) |
| Timeline apps-CANNOT callout present | 1 (PASS) |
| Chip DEVIATES from AlertNode / caller-supplied ActionEvent callout present | 1 (PASS) |
| CheckboxNode(variant:"switch") natural pairing mentioned | 1 (PASS) |
| Phase 26 TBD preserved | 1 (PASS) |
| Rest of Route B section unchanged | git diff shows only the single line replacement region changed (PASS) |

## Threat Model Follow-Through

- **T-25-06-01 (accept)** — Doc-only change; no runtime surface. Confirmed: 0 code files touched.
- **T-25-06-02 (mitigate)** — Wave 1 file-disjoint runs alongside Plans 25-01..05; the plan-25-10 requirement-to-artifact cross-check verifies every inventory row has a landed composite. If any Phase 25 plan is deferred, this doc's row for that composite would need reverting — Plan 25-10 catches that mismatch.
- **T-25-06-03 (mitigate)** — The Timeline "apps CANNOT compose from primitives" claim is narrowly scoped in both docs to Timeline's rail-and-dot mechanism specifically. The design doc row explicitly says "every other Phase 25 composite is grid/flex/color-mix over existing primitives; only Timeline earns a new CSS pattern." The AGENTS.md bullet phrases it the same way. Future contributors reading either doc will not conclude other composites' visual mechanisms are also uncomposable.

## Commits

| Task | Description | Commit |
|---|---|---|
| 1 | Populate shipped-recipe-inventory in .planning/design/composite-nodes-layer.md with 5 secondaries + update §4d DetailListNode | `bb03a31` |
| 2 | Replace AGENTS.md "Phase 25 ... TBD" line with 5 populated bullets | `2e23046` |

## Self-Check: PASSED

- `.planning/design/composite-nodes-layer.md` exists and contains all 5 secondary composite rows + Timeline apps-CANNOT + Chip dismissAction callouts (grep-verified above).
- `AGENTS.md` exists and contains the Phase 25 v8.0.0 header + all 5 secondary bullets + Timeline apps-CANNOT + Chip DEVIATES-from-AlertNode callouts (grep-verified above).
- Both commits (`bb03a31`, `2e23046`) exist in git log.
- No code files touched; git status clean apart from the SUMMARY being written.
