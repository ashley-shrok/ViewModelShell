# Phase 32: column-filter expansion Phase 1 — Context

**Gathered:** 2026-08-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the framework-internal foundation for typed column filtering — the additive wire vocabulary (column value-kinds, per-type operator vocabularies, multi-rule filter descriptors with all-of/any-of joiners) and a reference truth function that is byte-identical across both backend languages, proven by exhaustive tests. No adapter changes, no demo changes, no publish; Phase 33 replaces the old wire, lands the popover UI, migrates demos, and publishes the major release.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**8 requirements are locked.** See `32-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `32-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- Additive wire types on both backends: column value-kind field, per-type operator closed enums, `FilterDescriptor` shape with rules + joiner, per-column matching-hints set (single member: `ignore-punctuation`).
- Reference truth function on both backends: one public entry point per backend, every operator × applicable value-kind implemented, behavior per shape doc.
- Test coverage per Requirement 8 including cross-backend byte-parallel assertion.
- Static wire-shape parity fixture proving the new types serialize byte-identically across backends.
- Green-tree gate green at phase close (framework vitest + core-globals + demo-types + check:test-types + parity + all `.NET` Tests + Markdown companion compile + `check:no-demo-style`).
- CHANGELOG staged under `## Unreleased` with the additive wire additions listed (release itself happens in Phase 33).

**Out of scope (from SPEC.md):**
- Adapter changes (`browser.ts` / `tui.tsx` untouched — renderer stays on old wire).
- Removal of the old wire fields (`TableColumn.filterable`, `TableColumn.filterValue`, `TableNode.filterBinds`, `TableNode.filterAction` remain functional).
- Demo migration (HelpDesk, Showcase, FeatureProbe, all associated tests continue to compile and run against the OLD wire unchanged).
- The popover UI, always-visible-input + escalation shape, slash-through funnel glyph, read-only inline summary (all Phase 33).
- Publish (no `npm publish`, no `dotnet nuget push`, no git tag, no `main` advance, no `#vms-announcements` post — Phase 33 ships the major release).
- The per-column truth-function override seam as framework machinery — see D-04 below.
- MIGRATION.md notes (belong with removal in Phase 33; CHANGELOG-only staging here).

</spec_lock>

<decisions>
## Implementation Decisions

### D-01 (Wire shape: split declaration from instance)

The column DECLARES the filter schema — value-kind, options for fixed-set, optional matching hints. The current filter INSTANCE (the ordered list of rules + joiner) lives in state, referenced from a bind path. Concretely: a new `TableColumn.filter?: FilterSpec` block on the column carries schema-only (`{ kind, options?, matchingHints? }`); a new `TableNode.filterDescriptorBinds?: Record<colKey, statePath>` (parallel to today's `filterBinds`) points at where each column's current `FilterDescriptor` lives in state.

**Why this shape:** Every other bind-driven affordance in VMS separates the wire's affordance description from the state's current value — pagination page, sort intent, text input values, checkbox state — all live in state at bind paths that the tree references. Putting the current rules on the column blob would collapse that distinction and set a precedent for "state-on-tree" that breaks the pattern.

**Coexistence:** The new `filter` block and `filterDescriptorBinds` sit alongside the existing `filterable` / `filterValue` / `filterBinds` / `filterAction` fields. Old fields untouched. Phase 33 removes the old fields as part of the adapter migration.

**Deferred field-shape details** (planner resolves): the internal shape of `FilterSpec` (record with named subfields vs. discriminated union tagged by kind); whether `options` on fixed-set kind lives inside `FilterSpec` or as a separate optional column-level field. Both are workable; planner picks the one that matches existing wire-type shape conventions best.

### D-02 (Cross-backend byte-parallel via HTTP parity fixture on a representative sample + in-process exhaustive per backend)

Two test layers, complementary:

**Layer 1 — in-process exhaustive per backend.** The NASA Cartesian product (1-rule exhaustive + 2-rule representative + 3-rule diagonal, all per SPEC Requirement 8) runs in each backend's native test framework: vitest on the TS side, xUnit on the .NET side. Each backend's suite is thousands of cases; in-process is milliseconds-fast and native to the existing test infrastructure. Both backends' suites use table-driven definitions (each test-case tuple auto-generates a per-case name).

**Layer 2 — HTTP parity fixture proves cross-backend agreement on a curated representative sample.** The `parity/` harness gets a new fixture that walks a REPRESENTATIVE ~100-case set (covering every operator × every value-kind + every multi-rule combination + the four ISO date shapes from D-03) through both backends via a new `FilterHelperProbe` HTTP endpoint on FeatureProbe (both .NET and bun twins). The endpoint accepts a filter descriptor + value-kind + raw value + display string; returns `{ match: bool }`. The fixture diffs the response byte-parallel across backends. Reuses proven parity machinery; no new gate infrastructure.

**Why this shape:** Same shape Phase 31 used for `TextNode.maxLines` — framework tests own the exhaustive coverage in-process; the parity fixture proves the WIRE agreement on a smaller, curated set. Running the full Cartesian through HTTP would be excruciating and add nothing (HTTP proves wire byte-parallelism, not correctness of the truth function — that's the in-process suites' job).

**Mutation-verify (from SPEC Requirement 8):** documented one-time session in phase SUMMARY, not gated on every CI run. Reverting each operator's implementation to a stub must make at least one in-process test go red on that backend. Not the HTTP fixture's job.

### D-03 (Date operators: format-agnostic string comparison — supports date-only AND full datetime)

Date operators (`is`, `before`, `after`, `in-range`, `is-empty`, `is-not-empty`) compare against the raw value using **string comparison**. The framework does no parsing, no timezone math, no offset normalization, no arithmetic. ISO-8601's design guarantees that consistently-formatted ISO date strings sort chronologically — the framework relies on that property directly.

The "date" value-kind is CONCEPTUALLY a date-ish column; the MECHANISM accepts any ISO-8601 date shape the app chooses to store. Datetime filtering ("between this datetime and this datetime") is fully supported by the same mechanism — string comparison of consistent-format ISO datetimes sorts chronologically the same way ISO date-only strings do.

**Four ISO shapes exhaustively tested** as value-shape variants of the date value-kind in the NASA test suite:
- Date-only: `2026-08-15`
- Datetime with offset: `2026-08-15T09:00:00-04:00`
- Datetime UTC-Z: `2026-08-15T13:00:00Z`
- Datetime naive: `2026-08-15T09:00:00`

Every date operator proven correct against each shape on both backends.

**One edge case flagged as app-side, not framework-side:** if an app's cells carry datetimes with times and a user's filter carries a bare date, string comparison won't smooth over the boundary (a cell of `2026-08-15T09:00:00-04:00` compared against a bare filter of `2026-08-15` won't match, because the cell string is longer). Framework's answer: string comparison of the raw value, format-agnostic. Apps that want date-only filters against datetime cells either normalize their filter values (extend to end-of-day) or write their own truth-function loop for that column (see D-04).

**One thing that IS a Phase 33 UX concern** (deferred to Phase 33 discuss): the popover date input for value entry. If Phase 33's popover renders a plain calendar-day picker, users can't type datetime precision by hand — Phase 33 likely wants "calendar OR full datetime, app declares which per column." Phase 32's mechanism supports both; Phase 33 decides the input UX.

### D-04 (Per-column override seam: no framework machinery — calling the helper is optional)

Consumer apps that need special filter handling for a column (compile-to-SQL, exotic data, custom cell rendering with weird underlying values) write their own filter logic for that column and skip the framework's truth function. There is no framework machinery — no strategy registry, no override slot, no dispatch layer. The "override seam" IS "call the helper, or don't."

**Why this shape:** VMS action handlers already run consumer code with full authority. The truth function is a public helper the consumer can call — or not — inside their own action code. Adding a registry or a strategy pattern would be framework machinery that solves nothing the consumer can't already do.

### D-05 (File locations — confirmation, no alternative)

**TypeScript truth-function entry point:** `viewmodel-shell/src/server.ts` — the server subpath that already exports `createAction`, `parseFormDataAction`, `shellRedirect`, `shellRejection`, `createVersionGuard`, `createAgentSkillHandler`. Natural sibling for the new `matchesFilter` (or equivalent name — planner picks).

**.NET truth-function entry point:** new file `viewmodel-shell-dotnet/FilterHelper.cs` (or equivalent — planner picks name) at the root of the main package, alongside `ViewModels.cs`, `AgentSkill.cs`, `ShellExceptionFilter.cs`, `Versioning.cs`, `StaticFiles.cs`. Ships in the main NuGet package.

**Why not a companion package on .NET:** the `Markdown/` sibling companion pattern is for heavyweight OPTIONAL dependencies that not every consumer wants. The truth function is core wire logic — every server-side consumer of the filter feature needs it — so it belongs in the main package.

**Public API surface:** each backend's entry point is a plain public function (or module method) with a signature approximately `matchesFilter(descriptor, rawValue, displayString, valueKind) → bool` (planner refines the exact signature; the shape above is illustrative). No auto-registration, no dependency injection.

### Claude's Discretion

Areas where the planner has flexibility (spec-locked outcomes, mechanism unconstrained):

- **Exact name of the FilterSpec wire type** and its internal field shape (record vs discriminated union tagged by kind).
- **Exact function signature for `matchesFilter`** — parameter order, whether `valueKind` is a separate arg or embedded in the descriptor, whether the "display string" is passed alongside the raw value or derived by the caller.
- **Exact name of the FeatureProbe HTTP probe endpoint** for the cross-backend parity fixture.
- **Whether to short-circuit** multi-rule evaluation (SPEC D-06 semantics say "no short-circuit — every rule evaluated, simpler + more testable" — planner can lean the other way if in-process test perf demands, but should document if diverging).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements
- `.planning/phases/32-column-filter-expansion-phase-1-wire-types-reference-truth-f/32-SPEC.md` — **Locked requirements — MUST read before planning.** 8 falsifiable requirements + boundaries + acceptance criteria. Every requirement has Current / Target / Acceptance fields.

### Design docs (shape + plan)
- `.planning/design/shape-column-filter-expansion.md` — locked design shape from two rounds of served tastings with Ashley (2026-08-09, 2026-08-18). Section "Prior context" holds the three-population recon summary; "What would make it wrong" holds the anti-goals; "Scope edges" enumerates in/out for the milestone.
- `.planning/design/plan-column-filter-expansion.md` — milestone plan (2 sequential GSD phases, this being Phase 1). "Phase 1 — deliverables" section names every wire addition + every reference-truth-function requirement + the NASA test bar. "Cross-phase considerations" flags what Phase 33 depends on Phase 32 landing.

### VMS framework rules (from repo root)
- `AGENTS.md` gotcha #8 (JSON null-omission on .NET nullable wire fields — every new nullable field carries `[JsonIgnore(WhenWritingNull)]`; every optional non-nullable bool whose `false` means absent carries `WhenWritingDefault`).
- `AGENTS.md` gotcha #9 (parity harness is only half the gate — per-response invariants `findNulls` + `expectBodyContains` cover branches the diff structurally cannot see; a fixture that stops exercising its branch fails loudly instead of silently going vacuous).
- `AGENTS.md` "Working agreement for agents" — the full green-tree gate list (framework vitest + core-globals + demo-types + check:test-types + parity + framework `.NET` Tests + every `demo/**/*.Tests.csproj` + Markdown companion compile + `check:no-demo-style`).
- `AGENTS.md` "Node types, action payloads & emitted CSS classes" — the concern→source table (source of truth for node vocabulary is `index.ts` + `ViewModels.cs`).

### Prior phase pattern precedent
- `.planning/phases/31-textnode-maxlines-axis-closed-enum-line-cap-primitive-route-/31-CONTEXT.md` + `31-SPEC.md` — recent additive-wire phase with the same "TS wire → .NET twin → parity fixture → framework tests in-process" shape. The plan structure Phase 32 mirrors: wave 1 (TS wire + tests) parallel with wave 1' (.NET wire + tests); wave 2 (parity fixture); wave 3 (docs staging).

### Repo entry points touched by this phase
- `viewmodel-shell/src/index.ts` — wire types (TableColumn, TableNode). The new `filter?: FilterSpec` block on TableColumn + `filterDescriptorBinds?` on TableNode + operator/value-kind closed unions land here.
- `viewmodel-shell/src/server.ts` — TS truth-function public entry point lands here (D-05).
- `viewmodel-shell-dotnet/ViewModels.cs` — .NET wire twin (byte-parallel additions per gotcha #8).
- `viewmodel-shell-dotnet/FilterHelper.cs` (NEW) — .NET truth-function public entry point (D-05).
- `parity/fixtures/` — new fixture for cross-backend byte-parallel + wire-shape byte-parallel. Fixture name planner picks; suggested `column-filter-helper.json` and `column-filter-wire-shape.json` (two fixtures) OR one combined `column-filter.json`.
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` + `demo/FeatureProbe-bun/handler.ts` — new HTTP probe endpoint for the parity fixture (D-02 layer 2).
- `viewmodel-shell/CHANGELOG.md` — staged entry under `## Unreleased`.

### Reference bounty
- `~/.claude/roles/vms-maintainer/bounties/table-column-filter-expansion/bounty.json` — full session-by-session history of how the milestone got here (Poppy DM 2026-08-09 → 3-population recon → 2 tasting rounds → shape+plan greenlit 2026-08-18). Recon reports also in that folder (`recon-operator-familiar.md`, `recon-js-component-libraries.md`, `recon-server-driven-peers.md`) if the researcher wants deep dive on the vocabulary/behavior peers ship.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`viewmodel-shell/src/server.ts` export shape.** Existing exports (`createAction`, `parseFormDataAction`, `parseJsonAction`, `shellRedirect`, `shellRejection`, `shellSideEffect`, `createAgentSkillHandler`, `createVersionGuard`, `UnknownActionError`, `BadRequestError`, `ERR_CODES`) show the convention for new public helper: named function export at module top level, imported by consumer's action handler alongside the existing ones.

- **`.NET` main package root layout.** Existing sibling files at `viewmodel-shell-dotnet/` root (`ViewModels.cs`, `AgentSkill.cs`, `ShellExceptionFilter.cs`, `StaticFiles.cs`, `Versioning.cs`) show the convention for new `FilterHelper.cs`: single top-level static class in the `ViewModelShell` namespace, plain public API surface.

- **`parity/` harness cross-backend HTTP mechanism.** `parity/run.ts` walks fixtures against every backend registered in `backends.json`; `parity/normalize.ts` masks volatile fields before diffing. FeatureProbe (`.NET` + bun twin) is the primary probe target — adding a new endpoint on both twins wires the new `FilterHelperProbe` fixture into existing machinery. `expectBodyContains` per-step invariants are how per-branch coverage gets proven (see gotcha #9's "helpdesk-seeded" precedent).

- **`FeatureProbe` state slot precedent.** `FeatureProbeState.TableFilters` and `FeatureProbeState.SortIntent` records show the shape for adding a new state slot to hold the filter descriptor instance (Phase 32 doesn't render it, but the FeatureProbe probe endpoint needs a payload shape).

### Established Patterns

- **`[JsonIgnore(WhenWritingNull)]` on every nullable .NET wire field.** Gotcha #8. Every new nullable field (`FilterSpec?`, `Dictionary<string, string>? FilterDescriptorBinds`, etc.) MUST carry this attribute or absent-vs-null drift re-appears between backends.

- **Closed unions enforced TS-side only.** Documented invariant in AGENTS.md: TS union types (`"text" | "number" | "date" | ...`) are the specification; .NET twins are typed as `string` (or `string?`). No .NET-side enum, no runtime validation — the TS union is the source of truth for the vocabulary.

- **Table-driven test pattern for exhaustive Cartesian.** Both vitest (TS) and xUnit (.NET) support parameterized test cases. The Phase 32 NASA suite uses this pattern — each test-case tuple `(operator, valueKind, valueShape, joinerCombo)` becomes an auto-named case. Existing precedent: Phase 31's `viewmodel-shell/src/adapter.test.ts` maxLines suite is table-driven.

- **Backend twin pattern for demos.** Every backend-bearing demo has a .NET twin AND a bun twin (`HelpDesk/AspNetCore/` + `HelpDesk-bun/`, `FeatureProbe/AspNetCore/` + `FeatureProbe-bun/`). The new FilterHelperProbe HTTP endpoint gets added to BOTH twins, in the same session.

- **Additive-wire coexistence pattern.** Precedent: many recent phases (see Phase 31 for the freshest example) have added optional wire fields alongside existing ones without breaking. The removal in Phase 33 follows the aligned-major-release pattern (npm + NuGet both bump; MIGRATION.md documents the removal; consumer pilot upgrades on the same release).

### Integration Points

- **Wire types integrate at `TableColumn` and `TableNode`.** The new `filter?: FilterSpec` field extends TableColumn; the new `filterDescriptorBinds?: Record<string, string>` field extends TableNode. Both are optional and default-absent — every existing tree remains valid.

- **Truth function integrates at consumer action handlers.** Consumers who use the new filter shape call `matchesFilter(...)` inside their server-side action handling. The framework doesn't invoke it automatically — no middleware, no reflection, no dispatch. Consumer code owns when to call it.

- **Parity fixture integrates at `FeatureProbe` HTTP endpoint.** The new probe endpoint receives `{descriptor, valueKind, rawValue, displayString}` in the action payload (or query params — planner picks), invokes the truth function, returns `{match: bool}` in the response body. The parity fixture drives it per-case and diffs.

- **CHANGELOG integrates at `viewmodel-shell/CHANGELOG.md` under `## Unreleased`.** Phase 32 stages the additive-wire entry; Phase 33 finalizes the release header (major version bump + MIGRATION.md entry for the removal + published dates).

</code_context>

<specifics>
## Specific Ideas

**Ashley's datetime call (2026-08-18):** date operators should support datetime filtering (`"between this datetime and this datetime"`) — the mechanism doesn't need to care about timezones because string comparison of consistent-format ISO datetimes sorts chronologically by the format's design. Explicitly captured in D-03 with all four ISO shapes in the NASA test suite. The concern I had about "timezone handling" was a phantom — the framework does no parsing / no arithmetic / no offset math, so nothing needs handling.

**Pattern precedent to lean on: Phase 31 (`TextNode.maxLines`).** Same shape: additive-wire on both backends, byte-parallel via parity fixture, framework tests in-process, three waves (TS + .NET parallel wave 1; parity fixture wave 2; docs staging wave 3). The Phase 32 plan should mirror this structure closely; the planner should read `31-CONTEXT.md` and the 4 `31-XX-PLAN.md` files as templates.

**Poppy is the pilot consumer.** Phase 33 will migrate her PBMInvoices via the new adapter UI. Phase 32 has no direct pilot deliverable — the mechanism she'll see is in Phase 33 — but her framing-only ask from 2026-08-09 (Kara feedback: empty filters + type-aware dropdowns) is the entire reason this milestone exists.

</specifics>

<deferred>
## Deferred Ideas

### For Phase 33 (adapter UI + demo migration + release)
- **Popover date input UX** — calendar-day picker vs full datetime picker (per D-03 discussion). Phase 32's mechanism supports both; Phase 33's popover decides the input.
- **Migration of old wire callers** — HelpDesk (.NET + bun), Showcase, FeatureProbe (.NET + bun), and their tests all move from `filterable`/`filterValue`/`filterBinds`/`filterAction` to the new `filter` block + `filterDescriptorBinds`.
- **Removal of the old wire fields** from `index.ts` and `ViewModels.cs`.
- **MIGRATION.md entry** documenting the removal + consumer upgrade guidance.
- **Major version bump** (npm + NuGet aligned) + tag + `main` advance + `#vms-announcements` post.
- **Poppy pilot coordination** — the release announcement + Poppy migrating PBMInvoices on the same release.

### For future / on signal
- **More matching hints beyond `ignore-punctuation`** — case-sensitive opt-in, ignore-whitespace, ignore-diacritics. Ship on real consumer signal per shape doc "Deferred" section.
- **Global quick-filter box** (a single search box that filters all columns simultaneously). Deferred per shape doc.
- **Chip strip below the table showing active filters as removable pills** — mentioned in shape doc "Out (v1)".
- **Custom-operator registration by apps** — per shape doc "Tempting but no"; can be added later on real signal, but unbounded custom operators expand the reliability surface without bound.
- **Cross-column filter combining** (`col A matches X OR col B matches Y`) — shape doc "Out (v1)". Across-column combination stays implicit-and.
- **Nested filter groups** (`(A AND B) OR (C AND D)` within a column or across) — shape doc "Out (v1)".

</deferred>

---

*Phase: 32-column-filter-expansion-phase-1-wire-types-reference-truth-f*
*Context gathered: 2026-08-18*
