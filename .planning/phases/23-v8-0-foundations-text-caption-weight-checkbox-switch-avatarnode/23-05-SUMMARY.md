# Plan 23-05 — Composite-Nodes Layer design of record (SUMMARY)

**Completed:** 2026-07-29
**Wave:** 1 (autonomous, doc-only)
**Requirements:** COMP-01, COMP-02, COMP-03, COMP-04 (cross-cutting — this plan writes the design-of-record doc for the whole v8.0.0 milestone; the four requirements are the wire tweaks + new primitive documented in §4a-4b that Phase 23-01..23-04 execute).
**Atomic commit:** `docs(23-05): write composite-nodes-layer design of record`

## What was built

A single canonical design-of-record markdown at `.planning/design/composite-nodes-layer.md` (372 lines) that serves as the doc-of-record for the entire v8.0.0 Composite-Nodes Layer milestone (Phases 23-26). It supersedes the pre-doc tasting page (`bounties/composite-nodes-layer/tasting-page/index.html`) as the canonical reference; Phase 24-26 planners cite this file, not the tasting page.

**Structure — nine sections, matching the shipped design-doc format of `icons-primitive.md`, `nav-primitives.md`, `lookup-field.md`:**

1. **Thesis — Route A + Route B coexist.** The two-track structure: primitive axes (Route A, what VMS ships today) + pre-made composite recipes with typed slots (Route B, what v8.0.0 adds). Both coexist; recipes never deprecate primitives. Precedent: every server-driven peer surveyed (MUI, Ant, Chakra, Bootstrap, Phoenix LiveView, Livewire, Hotwire, Blazor) ships this layer.

2. **The governance rule — earn a composite.** The rule Ashley canonicalized 2026-07-29, in the wording that Phase 23-06 mirrors into AGENTS.md verbatim: *"A shape earns a composite when the best-effort with today's primitives is a 'pretty bad approximation.' Bar is visual; judgment per shape; eyeballed against a served tasting."* Names the two failure modes explicitly (bloated grab-bag; too-rigid recipe) with mitigations.

3. **The typed-slots pattern.** The structural shape every composite obeys: `{ leading?, primary/heading, secondary/description?, meta?, trailing?, tone?, state? }`. Three governing rules: typed slots accept full ViewNode subtrees, variance goes through closed-enum axes, every slot is optional except the semantically-primary one.

4. **Milestone inventory** — the 10 composites + 3 wire tweaks + 1 new primitive, with schemas frozen from the tasting page:
   - **§4a wire tweaks (Phase 23):** `TextNode.style:"caption"` (COMP-01), `TextNode` weight axis (COMP-02, Option A recommended), `CheckboxNode.variant:"switch"` (COMP-03).
   - **§4b new primitive (Phase 23):** `AvatarNode` (COMP-04) — circular slot; image > initials > icon > empty priority; closed size + tone axes.
   - **§4c primary composites (Phase 24):** `ListRowNode` + `ListNode.variant:"rows"`, `MessageNode` + `MessageListNode`, `AlertNode`, `EmptyStateNode` (pending EmptyState-vs-property call).
   - **§4d secondary composites (Phase 25):** `UserRowNode`, `DetailRowNode` + `DetailListNode`, `TimelineEntryNode` + `TimelineNode`, `SettingRowNode` + `SettingListNode`, `ChipNode` + `ChipListNode`.

5. **Layered adoption order** — Phase 23 foundations → Phase 24 primary → Phase 25 secondary → Phase 26 adoption+release. Order justified by the dependency graph (every downstream composite consumes at least one Phase 23 foundation).

6. **Conventions the milestone follows** — every banked-lesson discipline documented:
   - Fleet-adoption discipline (helpers ship with demo adoption in the same batch).
   - Parity `expectBodyContains` tripwires per branch (a diff can only prove things about code it actually RUNS).
   - AA-contrast hand-check per new fg/bg pair (fixed 13-pair gate does NOT auto-cover new pairs).
   - Closed-union-must-be-enum on .NET.
   - Null-omission (`WhenWritingNull`) + optional-bool absence (`WhenWritingDefault`).
   - Batch-then-ship (v8.0.0 releases once at Phase 26 closeout).
   - Route A / Route B coexistence (recipes never deprecate primitives).
   - `@experimental` TUI drops composites for v1.
   - Green-tree gate before every commit.

7. **Deferred / open questions** — the decisions Phase 24-25 planners still own (per-composite slot names, `AlertNode.dismissible` a11y contract, `ChipListNode` role choice, `MessageListNode.followTail` sharing, `TimelineEntry.description` type; cross-composite typed-slot factoring, EmptyState composite-vs-property call, weight axis Option A/B). Plus a "shapes intentionally NOT promoted" ledger (PageHeader, MediaCard, PaginationBar, SectionHeader, NavRail/AppBar).

8. **References** — the pre-doc source (tasting page), the framework capability gap survey template, the four structural-precedent design docs, the AGENTS.md governance sections this doc plugs into, the banked-lesson entries referenced across §6.

9. **Change log for this doc** — dated table with 2026-07-29 initial-frame entry. Doc extends in Phase 24-25 as per-composite implementation notes land.

## Files changed

- `.planning/design/composite-nodes-layer.md` (new; 372 lines).
- `.planning/phases/23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode/23-05-SUMMARY.md` (this file).

## Deviations from plan

None. Every must_have in plan 23-05 is satisfied:

- ✓ Doc exists at the canonical path.
- ✓ Route A / Route B thesis stated explicitly (§1).
- ✓ Governance rule stated with the wording that will end up in AGENTS.md (§2, verbatim in an emphasis blockquote so plan 23-06 can copy it byte-identically).
- ✓ Typed-slots pattern defined — every composite is `{ leading?, primary/heading, secondary/description?, meta?, trailing?, tone?, state? }`-shaped; each slot accepts a full ViewNode subtree; recipe owns layout/typography/spacing (§3).
- ✓ 10 composites inventoried with slot summaries, schemas verbatim from the tasting page (§4c-4d).
- ✓ 3 wire tweaks named with Phase 23 as landing point (§4a).
- ✓ Layered adoption order documented (§5).
- ✓ Fleet-adoption, AA-contrast, parity `expectBodyContains`, batch-then-ship all cited (§6).
- ✓ Pre-doc source (tasting page) cited and superseded-by claim explicit (§8, plus the header block at the top of the doc).

## Gate results

Doc-only plan; no code changes, no compilation risk.

| Gate | Result |
|---|---|
| File exists at canonical path | ✓ |
| Line count ≥ 300 | ✓ (372) |
| `grep -c "Route B"` ≥ 3 | ✓ (5) |
| `grep -c "typed-slot"` ≥ 2 | ✓ (4) |
| `grep -c "earn"` ≥ 2 | ✓ (8) |
| `grep -c "batch-then-ship"` ≥ 1 | ✓ (2) |
| `grep -c "fleet-adoption"` ≥ 1 | ✓ (2) |
| `grep -c "AA-contrast"` ≥ 1 | ✓ (3) |
| `grep -c "expectBodyContains"` ≥ 1 | ✓ (3) |
| `grep -c "tasting-page"` ≥ 1 | ✓ (4) |
| `grep -c "Phase 24"` ≥ 2 | ✓ (16) |
| `grep -c "Phase 25"` ≥ 2 | ✓ (6) |
| `grep -c "Phase 26"` ≥ 1 | ✓ (4) |
| All 10 composite names present | ✓ (ListRowNode 6, MessageNode 7, AlertNode 5, EmptyStateNode 5, UserRowNode 5, DetailRowNode 5, TimelineEntryNode 5, AvatarNode 6, SettingRowNode 6, ChipNode 4) |
| All 3 wire tweaks present | ✓ (caption 6, weight 12, switch 6) |

## Acceptance criteria — all met

Every acceptance criterion in the task's `<acceptance_criteria>` block passes; verified via the grep table above.

## Next dependency

- **Plan 23-06** writes the AGENTS.md "Route B composite-nodes layer" governance section — the governance rule (§2 of this doc) and the typed-slots pattern (§3) get mirrored into AGENTS.md verbatim. The two documents must stay copy-consistent; this doc's wording is the source.
- **Plans 23-01 through 23-04** execute the four wire tweaks + AvatarNode (COMP-01..COMP-04) — this doc's §4a-4b are the authoritative shape references; the tasting page's §8 (AvatarNode) and "Adjacent seams" block are the direct source, matched byte-for-byte in this doc.
- **Phase 24 planning** cites §4c (primary composites) + §5 (adoption order) + §6 (conventions) + §7 (open questions).
- **Phase 25 planning** cites §4d (secondary composites) + §5 + §6 + §7.
- **Phase 26 planning** cites the whole doc; the release ritual gets its own §5 entry (Phase 26 line item) and the change log grows with the "shipped" milestone entry.
