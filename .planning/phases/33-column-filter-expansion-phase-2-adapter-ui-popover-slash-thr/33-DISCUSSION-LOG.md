# Phase 33: column-filter expansion Phase 2 — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `33-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-08-18
**Phase:** 33-column-filter-expansion-phase-2-adapter-ui-popover-slash-thr
**Areas discussed:** Popover architecture, Portal mount target, Positioning strategy, Release version, MIGRATION.md reference example, Adapter test file location

---

## Popover architecture: client-only transient vs new wire node?

| Option | Description | Selected |
|--------|-------------|----------|
| A1: Client-only, adapter-owned | BrowserAdapter holds internal `Map<colKey, DraftFilterDescriptor>` (same pattern as `fileRegistry`, `detailsOpenSnapshot`, `lookupOpenSnapshot`, etc.); Apply flushes to state via ordinary action dispatch. No new wire node; wire only sees applied `FilterDescriptor`. | ✓ |
| A2: New `PopoverNode` wire node | Server declares "this column can be escalated"; renderer materializes on click. Server-driven open/close. | |

**User's choice:** A1 — Client-only, adapter-owned.
**Notes:** Rejected A2 because transient UI state doesn't belong on the wire per framework philosophy #2 ("the structured description must always be enough on its own") — a wire consumer (agent) reading the tree still sees the applied filter descriptor at the bind path without needing to model popover open/close as tree changes.

---

## Portal mount target for popover DOM node

| Option | Description | Selected |
|--------|-------------|----------|
| B1: Single `<div class="vms-popover-portal">` created by BrowserAdapter on construction | Appended to the shell's container element (the one the app hands to `new BrowserAdapter(container)`). Popover appended into it on open, removed on close. Sibling of table wrapper → escapes overflow-x clip by construction. | ✓ |
| B2: `document.body` directly | React Portal default. | |
| B3: Ancestor search with `data-vms-portal-root` escape hatch | Rare escape hatch for embedded-in-modal scenarios. | |

**User's choice:** B1 — Adapter-created portal div in container.
**Notes:** Rejected B2 because it leaks framework DOM outside the app-owned container root and complicates test teardown (jsdom `document.body` is shared across tests). Rejected B3 as premature escape-hatch machinery.

---

## Positioning strategy (avoiding floating-ui / popper.js)

| Option | Description | Selected |
|--------|-------------|----------|
| C1: `position: fixed` + `getBoundingClientRect()` + JS clamping | JS-computed top/left with viewport-edge clamping (nudge left when off-right, flip above when off-bottom). Update on window resize + capture-phase scroll. | ✓ |
| C2: CSS anchor positioning (`anchor-name`/`position-anchor`) | Chrome 125+ only; no Firefox. | |
| C3: Import floating-ui / popper.js | New dependency. | |

**User's choice:** C1 — JS-clamped fixed positioning.
**Notes:** Rejected C2 (outside polyfill-free posture — no Firefox support). Rejected C3 per Ashley's banked tooltip lesson (2026-07-23) about avoiding this bloat — "A 'known v1 limitation' that fires on FIRST USE is a defect ratified in prose." Viewport-edge clipping is a first-use ship-blocker; verification bar requires exercising near-viewport-edge on the served verification page.

---

## Release version resolution

| Option | Description | Selected |
|--------|-------------|----------|
| D1: 10.0.0 aligned on both | npm 9.2.1 → 10.0.0; NuGet 9.2.0 → 10.0.0; Markdown companion 0.2.2 → 0.2.3 rebuilt with floor dep on 10.0.0. | ✓ |
| D2: 11.0.0 aligned | Signal milestone weight with a bigger jump. | |
| D3: Other | | |

**User's choice:** D1 — 10.0.0 aligned.
**Notes:** Straight major bump; the semver major-line jump is the signaling. The 9.2.1 npm-only wheel-adjust asymmetry resolves at the major boundary. Markdown companion patch-bump per gotcha #9's core-major-rebuild rule.

---

## MIGRATION.md reference example

| Option | Description | Selected |
|--------|-------------|----------|
| E1: HelpDesk agent-queue tabs | Status column (fixed-set) + Title column (text) — shows kind declaration, operator vocab, `filterDescriptorBinds`, `FilterHelper.MatchesFilter` call. Diff `AgentController.cs`. | ✓ |
| E2: Other | | |

**User's choice:** E1 — HelpDesk agent-queue tabs.
**Notes:** Natural reference per plan doc; both interesting kinds represented. Wave-2 executor writing the migration outputs a `MIGRATION-DRAFT.md` snippet; docs wave folds it into final MIGRATION.md.

---

## Adapter test file location

| Option | Description | Selected |
|--------|-------------|----------|
| F1: New file `viewmodel-shell/test/filter-adapter.test.ts` | Byte-parallel with Phase 32's `test/column-filter.test.ts` naming. Groups filter feature tests. | ✓ |
| F2: Extend existing `viewmodel-shell/src/adapter.test.ts` | | |

**User's choice:** F1 — new file.
**Notes:** Same rationale as Phase 32 (truth-function tests earned their own file); the filter feature's adapter tests earn theirs.

---

## Claude's Discretion

- Exact `filter-slash` SVG geometry (path coords + stroke width to match existing icon-payload conventions).
- Popover DOM structure (element choices; ARIA attributes) — planner picks to match framework overlay conventions; ModalNode is the closest precedent.
- Inline read-only summary text format — SPEC gives examples (`contains "foo" AND >100`, `is empty`); exact join-word ("and" vs "AND" vs "&") is planner discretion.
- Popover animation absence — matches framework's overlay convention (no CSS enter/exit animations).
- Wave decomposition — preview per D-08 in CONTEXT.md; planner refines.

---

## Deferred Ideas

### For a follow-up phase (captured in bounty at REQ-CF2-09)
- **TUI filter-row refresh to the new wire shape** — Ashley's Q1 answer 2026-08-18 explicitly deferred this ("not going to do the terminal adapter update"). Bounty at `~/.claude/roles/vms-maintainer/bounties/tui-filter-refresh/` (to be created).

### For future / on signal (per shape doc "Deferred" section)
- Global "search everything" quick-filter box.
- Chip strip below the table showing active filters as removable pills.
- More matching hints beyond `ignore-punctuation` (case-sensitive opt-in, ignore-whitespace, ignore-diacritics).
- Cross-column filter combining; nested filter groups; multi-value `is any of` / `is none of` operators.
- Auto-inferring column type from cell content; auto-populating fixed-set options from row data.
- Custom-operator registration by apps.
- Free-form filter expression language.
