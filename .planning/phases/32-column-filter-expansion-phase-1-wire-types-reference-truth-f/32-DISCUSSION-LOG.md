# Phase 32: column-filter expansion Phase 1 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-18
**Phase:** 32-column-filter-expansion-phase-1-wire-types-reference-truth-f
**Areas discussed:** A wire shape (split declaration/instance); B cross-backend byte-parallel mechanism; C date operator semantics (contested + resolved); D per-column override seam; E file locations

---

## A — FilterSpec wire shape: schema on column, instance in state

| Option | Description | Selected |
|--------|-------------|----------|
| A1 | Split: column carries `filter?: FilterSpec` (kind/options/hints); state carries the current rules via new `TableNode.filterDescriptorBinds` (parallel to today's `filterBinds`). | ✓ |
| A2 | Monolithic: `TableColumn.filter?: FilterSpec` carries both schema AND current-value blob together. | |

**User's choice:** A1 (split)
**Notes:** Vicky's lean; Ashley agreed without pushback. The split matches VMS's existing "wire node describes what CAN be, state carries what IS" pattern used everywhere else (pagination page, sort intent, text-input values). Monolithic would have collapsed that distinction and put state on the tree in a place we've been careful not to.

---

## B — Cross-backend byte-parallel mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| B1 | Extend `parity/` HTTP harness — add `FilterHelperProbe` endpoint on FeatureProbe (.NET + bun); fixture drives representative ~100-case sample through both backends; diffs response byte-parallel. | ✓ |
| B2 | NEW direct-execute gate — bun + dotnet run truth function against shared JSON test corpus without HTTP; diff outputs. | |
| Combined | B1 for cross-backend agreement on representative sample + in-process exhaustive Cartesian per backend (vitest + xUnit). Best of both. | ✓ (final shape) |

**User's choice:** B1 combined with in-process exhaustive suites per backend (final: two layers).
**Notes:** Vicky's lean; Ashley agreed without pushback. Same shape Phase 31 used for TextNode.maxLines — framework tests own the exhaustive coverage in-process (thousands of cases, milliseconds-fast, native to test infrastructure); parity fixture proves wire agreement on a curated ~100-case set covering every operator × type + multi-rule combinations + all four ISO date shapes. Running the full Cartesian through HTTP would add nothing (HTTP proves wire byte-parallelism, not correctness).

---

## C — Date operator semantics (CONTESTED, then resolved with correction to Vicky's initial lean)

| Option | Description | Selected |
|--------|-------------|----------|
| C1 (Vicky's initial lean) | Calendar-date strings only (`YYYY-MM-DD`, no timezone). Simple, universal. | |
| C2 (Vicky's initial alternative) | Full ISO datetime with offset-aware semantics; drags in parser dep. | |
| **C-revised (Ashley's correction)** | **Format-agnostic string comparison against raw value. No parsing, no timezone math, no arithmetic. Works for date-only AND full datetime with offset AND UTC-Z AND naive — ISO-8601 sorts chronologically by design. All four shapes exhaustively tested.** | ✓ |

**User's choice:** C-revised (format-agnostic string comparison — supports date-only AND full datetime)
**Notes:** Ashley pushed back on Vicky's C1: "if you're filtering and maybe you're talking about situations where somebody wants to do a filter that says between this time and date and this time and date, and I don't see how that's a problem. Because if they're all displayed already, then asking for what's between what just uses the same data that's already there. So it kind of is irrelevant what the time zone is in for any of it? unless I'm misunderstanding."

Vicky's re-check confirmed she was right: ISO-8601 date and datetime strings sort chronologically by construction; string comparison is timezone-agnostic because it's not doing arithmetic. The "timezone handling" concern was a phantom — the framework does no parsing / no math / no offset normalization. Also Ashley: "I guess my only other point that I would say is that it would be nice if it was still possible to do filters where you're saying, you know, you want it to be between this date time and this date time, which still doesn't need to care about what time zone things are in. But I do think it would be good to include that."

The revised C explicitly names all four ISO shapes as value-shape variants in the NASA test suite. One edge case flagged as app-side (not framework-side): bare-date filter against datetime cell won't smooth over the string-length boundary — apps normalize their filter value or write their own truth function.

**Lesson banked** (Vicky's role file "her technical instinct beat my caution — check a claim before defending it"): the "timezone handling" cost Vicky asserted was never measured; asserting it drove her toward an arbitrary narrowing that the mechanism didn't require. Ashley's read was closer to the mechanism reality.

---

## D — Per-column override seam

| Option | Description | Selected |
|--------|-------------|----------|
| D1 | No framework machinery. Truth function is a public helper; consumer calls it or doesn't. Override = write your own filter loop for that column. | ✓ |
| D2 | Named-strategy registry on the column; consumer registers handlers by name. | |

**User's choice:** D1 (no machinery)
**Notes:** Vicky's lean; Ashley agreed without pushback. VMS action handlers already run consumer code with full authority. Adding a registry would be framework machinery that solves nothing the consumer can't already do inside their own action code.

---

## E — File locations (confirmation, no alternative)

| Option | Description | Selected |
|--------|-------------|----------|
| E1 | TS entry point in `viewmodel-shell/src/server.ts` alongside existing `createAction` / `shellRedirect` / `shellRejection` helpers. New `.NET` file `FilterHelper.cs` at root of main package alongside `ViewModels.cs` / `AgentSkill.cs`. | ✓ |

**User's choice:** E1 (confirmed, no alternative offered)
**Notes:** Truth function is core wire logic (every server-side consumer of the filter feature needs it) — belongs in the main package, not the sibling `Markdown/` companion pattern.

---

## Claude's Discretion

Areas left to planner:
- **Exact name of the FilterSpec wire type** and its internal field shape (record vs discriminated union tagged by kind).
- **Exact function signature for `matchesFilter`** — parameter order, whether `valueKind` is a separate arg or embedded in the descriptor, whether the "display string" is passed alongside the raw value or derived by the caller.
- **Exact name of the FeatureProbe HTTP probe endpoint** for the cross-backend parity fixture.
- **Whether to short-circuit multi-rule evaluation** — SPEC D-06 semantics say "no short-circuit — simpler + more testable"; planner can lean the other way if in-process test perf demands, but must document if diverging.

## Deferred Ideas

### Phase 33 (adapter UI + demo migration + release)
- Popover date input UX (calendar-day picker vs full datetime picker).
- Migration of every old-wire caller (HelpDesk, Showcase, FeatureProbe + tests).
- Removal of old wire fields from `index.ts` and `ViewModels.cs`.
- MIGRATION.md entry + major version bump + tag + `main` advance + `#vms-announcements` post.
- Poppy pilot coordination.

### Future / on signal
- More matching hints (case-sensitive opt-in, ignore-whitespace, ignore-diacritics).
- Global quick-filter box.
- Chip strip below the table.
- Custom-operator registration by apps.
- Cross-column filter combining.
- Nested filter groups.
