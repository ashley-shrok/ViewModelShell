# Phase 32: column-filter expansion Phase 1 — wire types + reference truth function + NASA-level tests — Specification

**Created:** 2026-08-18
**Ambiguity score:** 0.11 (gate: ≤ 0.20)
**Requirements:** 8 locked

## Goal

Ship the framework-internal foundation for typed column filtering — the additive wire vocabulary (column value-kinds, per-type operator vocabularies, multi-rule filter descriptors with all-of/any-of joiners) and a reference truth function that is byte-identical across both backend languages, proven by exhaustive tests. No adapter changes, no demo changes, no publish; Phase 33 replaces the old wire and lands the UI.

## Background

Today (grepped 2026-08-18) a filterable column on a `TableNode` is one text input per column and one dispatch per table. The wire carries:

- `TableColumn.filterable?: boolean` + `TableColumn.filterValue?: string` (`viewmodel-shell/src/index.ts:1283-1284`, `viewmodel-shell-dotnet/ViewModels.cs:2010-2011`)
- `TableNode.filterBinds?: Record<string, string>` + `TableNode.filterAction?: ActionEvent` (`viewmodel-shell/src/index.ts:1351,1362`, `ViewModels.cs:2079,2084`)

There is no wire notion of a column's value-kind, no operator vocabulary, no way to express "empty" as a filter, no way to combine two conditions on one column, no reference truth function — every consumer writes its own substring-contains match server-side, so "these filters are reliable" is a promise each app makes for itself and can silently drift on. This gap has bitten a downstream consumer already (PBMInvoices / Kara feedback via Poppy — see bounty `table-column-filter-expansion`).

The design that resolves the gap is captured in `.planning/design/shape-column-filter-expansion.md` (locked with Ashley via two rounds of served tastings) and translated into a milestone plan in `.planning/design/plan-column-filter-expansion.md`. This phase (Phase 32) is Phase 1 of that milestone; Phase 33 will replace the old wire, land the popover UI, migrate demos, and publish the major release.

**Coexistence-then-remove reconciliation (Round 1, Ashley greenlit 2026-08-18):** Phase 32 is fully ADDITIVE — the new typed-filter wire vocabulary and the reference truth function ship alongside the existing `filterable`/`filterValue`/`filterBinds`/`filterAction` shape. Old callers (HelpDesk, Showcase, FeatureProbe, all associated tests) continue to compile and run unchanged. Phase 33 removes the old shape as part of the adapter migration + demo migration + major-version release. This keeps the green-tree gate green at Phase 32 close by construction and honors AGENTS.md's "NEVER PUSH ANYTHING BROKEN" rule.

## Requirements

1. **Typed value-kind on filterable columns**: A filterable column declares what kind of value it holds — text, number, date, fixed-set, or yes-no. The new field lives alongside `filterable`/`filterValue`; the old fields remain valid and unmodified.
   - Current: `TableColumn` has no value-kind field; filter shape is untyped text-only.
   - Target: A new wire field (name deferred to discuss-phase; e.g. `TableColumn.filter?: FilterSpec` or discrete fields) declares the value-kind as a closed enum `"text" | "number" | "date" | "fixed-set" | "yes-no"` on both backends. For `fixed-set`, the column additionally declares its option list.
   - Acceptance: TypeScript emits the new field with the closed union; .NET emits the byte-parallel counterpart with `JsonIgnore(WhenWritingNull)` posture per gotcha #8; a static wire-shape fixture in `parity/` shows both backends serialize a `fixed-set` column with option list byte-identically; grep of `viewmodel-shell/src/index.ts` and `viewmodel-shell-dotnet/ViewModels.cs` shows the field type is a closed union on TS and the .NET twin's enum (or serialized-string) matches the TS values set 1:1.

2. **Per-type closed operator vocabularies**: Every value-kind carries a closed operator vocabulary matching the shape doc exactly.
   - Current: No operator concept exists on the wire.
   - Target: The following closed operator enums exist on both backends, byte-parallel:
     - Text: `contains`, `equals`, `starts-with`, `ends-with`, `is-empty`, `is-not-empty`
     - Number: `contains`, `equals`, `does-not-equal`, `greater-than`, `greater-than-or-equal`, `less-than`, `less-than-or-equal`, `between`, `is-empty`, `is-not-empty`
     - Date: `contains`, `is`, `before`, `after`, `in-range`, `is-empty`, `is-not-empty`
     - Fixed-set: `contains`, `is`, `is-not`, `is-empty`, `is-not-empty`
     - Yes-no: `contains`, `is-true`, `is-false`, `is-empty`, `is-not-empty`
   - Acceptance: TypeScript operator type is a closed string union per type (or one union tagged by type); .NET operator representation preserves the exact same string vocabulary; a parity fixture proves the enum values wire byte-identically; every listed operator string appears in exactly ONE place per backend (no duplication risk).

3. **Filter descriptor shape (multi-rule with joiner)**: A column's filter is an ordered list of `{operator, value}` rules plus an all-of / any-of joiner. Rules whose operator carries no value (e.g. `is-empty`) omit the `value` field entirely (absent, not `null`, per AGENTS.md null-omission rule).
   - Current: No multi-rule concept exists on the wire; today's single `filterValue` string is the only filter carrier.
   - Target: A `FilterDescriptor` wire type exists on both backends carrying `{ rules: Rule[], joiner: "all-of" | "any-of" }`; `Rule` = `{ operator: <closed enum>, value?: <typed to operator's shape> }`; `joiner` defaults to `"all-of"` and follows the closed-union rule (present when non-default per WhenWritingDefault posture, or explicit — decision deferred to discuss-phase).
   - Acceptance: A parity fixture emits a descriptor with (a) one `contains` rule, (b) one `is-empty` rule (no value field), (c) two rules joined `any-of`, (d) three rules joined `all-of` — all four cases wire byte-identically across both backends via `bun run parity/run.ts`; a `findNulls` per-response invariant on the fixture confirms no `null` value fields leak through when an operator carries no value.

4. **Per-column matching hints (opt-in)**: A filterable column can declare an optional matching-hints set; the initial member is `ignore-punctuation`.
   - Current: No matching-hints concept exists.
   - Target: A `matchingHints?: MatchingHint[]` (or equivalent) closed-enum-set field on the column; `MatchingHint` = `"ignore-punctuation"` (single member for v1, extensible per shape doc).
   - Acceptance: The field is a closed enum on both backends (single-value initially); a column declaring `["ignore-punctuation"]` wires byte-identically across backends via parity fixture; the reference truth function's `contains` implementation honors the hint (see Requirement 6).

5. **Reference truth function — per-backend entry point**: Both backends ship a public function that, given a `FilterDescriptor`, a raw cell value, and the column's display-formatted string, returns match / no-match.
   - Current: No reference truth function exists on either backend; every consumer app writes its own substring-contains match server-side.
   - Target: One entry point per backend (TypeScript in the framework's server subpath OR its own module — name/location deferred to discuss-phase; .NET in the framework's Markdown/companion assembly OR the main package — location deferred to discuss-phase). Signature (conceptual, not final): `matchesFilter(descriptor: FilterDescriptor, rawValue: unknown, displayString: string, valueKind: ValueKind): boolean`. Consumer apps import and call it during their action handling.
   - Acceptance: Both backends expose the entry point as a public API; a smoke test on each backend imports and calls it against a `contains` descriptor and gets a correct result.

6. **Reference truth function — behavior**: Every operator × every applicable value-kind is implemented with the semantics specified in the shape doc.
   - Current: No implementation exists.
   - Target:
     - `contains` on every value-kind matches against the display-formatted string (per shape doc: "matches what the user sees"), case-insensitive by default, honoring the `ignore-punctuation` hint (strips currency symbols, commas, periods before comparing) when set on the column.
     - `is-empty` / `is-not-empty` treat `null`, `undefined` (TS) / `null` (.NET), and empty string as equivalent "empty" — the shape doc's collapsed-empty decision. Whitespace-only is NOT empty (this is the closest-to-cell-value reading; discuss-phase can adjust if needed).
     - Number operators (`equals`, `does-not-equal`, `greater-than`, `greater-than-or-equal`, `less-than`, `less-than-or-equal`, `between`) compare against the raw numeric value; `contains` on number still uses the display string.
     - Date operators (`is`, `before`, `after`, `in-range`) compare against the raw date value using ISO date-string comparison (calendar-date semantics, timezone handling deferred to discuss-phase); `contains` on date still uses the display string.
     - Fixed-set `is` / `is-not` compare against the raw value using string equality; `contains` still uses display string.
     - Yes-no `is-true` / `is-false` compare against the raw boolean value; `contains` still uses display string.
     - Multi-rule combination via `all-of` = every rule matches; `any-of` = any rule matches. NO short-circuit — every rule is evaluated (simpler semantics, easier to test — per plan doc).
   - Acceptance: The behavior of every operator × applicable value-kind case is proven by the test suite in Requirement 8, and every case is proven byte-identical between the two backends by Requirement 7.

7. **Byte-identical backend behavior (byte-parallel truth function)**: For every input the reference truth function receives, both backend implementations return the same result.
   - Current: No implementation exists on either side; no cross-backend consistency mechanism for filter logic.
   - Target: The parity harness (or a new adjacent gate) runs every test case in the NASA test suite through both backends and asserts identical output per case. Wire byte-parallel (descriptor serialization) is separately proven per Requirement 3.
   - Acceptance: Every test case in Requirement 8's suite runs on both backends and produces the identical `true` / `false` verdict; the parity gate (or its adjacent cross-backend harness) fails loudly on ANY divergence, verified by mutation-injecting a single-case inequality on one backend and confirming the gate goes red.

8. **NASA-level test coverage on the truth function**: Exhaustive 1-rule coverage, representative 2-rule and diagonal 3-rule coverage, both joiners, mutation-verified.
   - Current: No test coverage exists (no implementation).
   - Target:
     - **1-rule EXHAUSTIVE:** every (operator × applicable value-kind × representative value-shape set) combination. Value-shape set per type MUST include: `null`, empty string, whitespace-only, unicode (multi-byte + combining marks + RTL), very-long (≥1000 chars), type-specifics (numeric formatting variants including negative and decimal for number; ISO-8601 vs display-formatted for date; upper/mixed-case for text). Empty-vs-nonempty variants proven per operator.
     - **2-rule representative:** a representative sample per value-kind (both joiners × 2–3 rule-pair combinations per type), including at least one case where the two rules disagree (proves the joiner actually chooses).
     - **3-rule diagonal:** for each value-kind, one 3-rule case per joiner covering the diagonal (e.g. all three match / two match one doesn't for all-of; one matches two don't for any-of) — proves flat-list combination without grouping.
     - **Mutation-verified:** revert each operator's implementation to a bogus stub (returns constant `false`, or returns `true`, or swaps operands) and confirm the corresponding test cases go red. A silent-pass suite is not evidence of reliability per Vicky's role directive.
   - Acceptance:
     - Test file exists on both backends with the enumerated Cartesian product realized (a table-driven test infrastructure is fine; per-case names are auto-generated from the tuple).
     - `npm run test` (framework vitest) and `dotnet test viewmodel-shell-dotnet/Tests` (framework .NET) both pass with the new suite included.
     - A one-time mutation-verification session (run and documented in the phase SUMMARY.md; not gated on every CI run) confirms each operator's implementation is proven necessary — reverting any one operator to a stub makes at least one test go red on that backend.
     - Cross-backend parity per Requirement 7 confirms both backends return identical results per case.

## Boundaries

**In scope:**
- Additive wire types on both backends: column value-kind field, per-type operator closed enums, `FilterDescriptor` shape with rules + joiner, per-column matching-hints set (single member: `ignore-punctuation`).
- Reference truth function on both backends: one public entry point per backend, every operator × applicable value-kind implemented, behavior per shape doc.
- Test coverage per Requirement 8 including cross-backend byte-parallel assertion.
- Static wire-shape parity fixture proving the new types serialize byte-identically across backends.
- Green-tree gate green at phase close (framework vitest + core-globals + demo-types + check:test-types + parity + all `.NET` Tests + Markdown companion compile + `check:no-demo-style`).
- CHANGELOG staged under `## Unreleased` with the additive wire additions listed (release itself happens in Phase 33).

**Out of scope:**
- **Adapter changes.** No `browser.ts` or `tui.tsx` changes — the renderer stays on the existing `filterable`/`filterValue`/`filterBinds`/`filterAction` fields for its filter row. Phase 33 replaces the renderer.
- **Removal of the old wire fields.** `TableColumn.filterable`, `TableColumn.filterValue`, `TableNode.filterBinds`, `TableNode.filterAction` remain on the wire (with existing behavior) at Phase 32 close. Phase 33 removes them.
- **Demo migration.** No demo controllers, no demo tests, no demo frontends touched. HelpDesk, Showcase, FeatureProbe, and all associated tests continue to compile and run against the OLD wire unchanged. Phase 33 migrates every caller.
- **The popover UI, the always-visible-input + escalation shape, the slash-through funnel glyph, the read-only inline summary.** All Phase 33.
- **Publish.** No `npm publish`, no `dotnet nuget push`, no git tag, no `main` advance, no `#vms-announcements` post. Phase 33 ships the major release.
- **The per-column truth-function override seam** (mentioned in the plan doc — a consumer can override the whole helper on one column). Deferred to discuss-phase decision on whether the override lives in Phase 32 or Phase 33; the plan lists it under Phase 1 deliverables but it's a consumer-facing API surface that pairs naturally with the migration in Phase 33. Discuss-phase settles.
- **MIGRATION.md notes.** MIGRATION notes describe consumer migration from old→new wire and belong with the removal (Phase 33). Phase 32 stages CHANGELOG only.

**Tempting but no:**
- **Whitespace-only-is-empty semantics for the empty operator.** Universally trims-then-checks is one honest reading; leaving whitespace as non-empty (raw string equality against `""`) is another. This spec locks the raw-empty reading (matches "the closest-to-cell-value" heuristic) so tests are deterministic; if a consumer signals need, discuss/plan future revision.
- **Auto-registering the truth function via some app-side auto-discovery.** The consumer imports and calls it explicitly. No dependency-injection.
- **Multi-value operators (`is any of` / `is none of`).** Shape doc rules them out — express as OR of individual `is` rules.

## Constraints

- **Both backends touched in lockstep.** Any wire type added TS-side has a byte-parallel .NET twin in the same phase. Any truth-function operator implemented in TS is implemented in .NET in the same phase. Byte-parallel cross-backend assertion is not deferred.
- **AGENTS.md gotcha #8 posture.** Every new nullable wire field carries `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` on the .NET side; every new optional non-nullable bool whose `false` means "absent/unset" carries `WhenWritingDefault`. Failing to attribute correctly re-introduces null/false-vs-absent drift.
- **AGENTS.md gotcha #9 posture.** The parity gate (`bun run parity/run.ts`) must be green with a static wire-shape fixture exercising the new types AND per-response invariants (`findNulls`, `expectBodyContains`) covering the branches structurally invisible to diff.
- **Wire protocol token stays `viewmodel-shell/1.0`.** Additive optional fields do not bump the protocol token; the shape doc's "major version bump" is npm+NuGet package version at Phase 33 release, not the wire-protocol token.
- **Green-tree gate at phase close.** Full framework tests, parity, core-globals guard, demo type-check (`npm run check:demo-types`), test-tree type-check (`npm run check:test-types`), framework `.NET` Tests project (`viewmodel-shell-dotnet/Tests`), AND every `demo/**/*.Tests.csproj`. No exceptions for pre-existing red tests — surface + fix (or Ashley-waive) before phase close.

## Acceptance Criteria

- [ ] Both backends declare the `TableColumn` value-kind field byte-parallel (closed enum: text / number / date / fixed-set / yes-no); a static parity fixture proves byte-identical serialization for each of the 5 kinds.
- [ ] Both backends declare per-type closed operator vocabularies matching the shape doc exactly (text=6, number=10, date=7, fixed-set=5, yes-no=5); the exact string vocabulary is byte-parallel; each operator string appears in exactly one place per backend.
- [ ] Both backends declare the `FilterDescriptor` shape (`rules: Rule[]`, `joiner: "all-of" | "any-of"`); a parity fixture emits (a) 1 rule with value, (b) 1 rule without value (`is-empty`), (c) 2 rules joined `any-of`, (d) 3 rules joined `all-of` — all four wire byte-identically; `findNulls` per-response invariant confirms no `null` value leaks when an operator carries no value.
- [ ] Both backends declare the per-column `matching-hints` field with the closed enum containing `ignore-punctuation`; parity fixture proves byte-identical.
- [ ] Both backends ship a public reference truth function entry point; smoke test on each imports and calls it successfully against a `contains` descriptor.
- [ ] Every operator × applicable value-kind is implemented per Requirement 6 semantics on both backends.
- [ ] NASA test suite (per Requirement 8) exists on both backends: 1-rule EXHAUSTIVE, 2-rule representative, 3-rule diagonal, both joiners; per-case names generated from the (operator × type × value-shape × join) tuple.
- [ ] Every test case in the NASA suite runs on both backends and returns identical results; mutation-injecting a single-case backend inequality causes the cross-backend gate to go red.
- [ ] Mutation-verify session documented in the phase SUMMARY: reverting each operator's implementation to a stub makes at least one test go red on that backend.
- [ ] `bun run parity/run.ts` green (byte-identical) — includes the new wire-shape fixture AND the truth-function cross-backend harness.
- [ ] Full green-tree gate green at phase close (framework vitest + core-globals + demo-types + check:test-types + parity + framework .NET Tests + every `demo/**/*.Tests.csproj` + Markdown companion compile + `check:no-demo-style`).
- [ ] Old wire fields (`TableColumn.filterable`, `TableColumn.filterValue`, `TableNode.filterBinds`, `TableNode.filterAction`) remain present, unmodified, and functional at phase close; HelpDesk / Showcase / FeatureProbe / their tests unchanged.
- [ ] CHANGELOG staged under `## Unreleased` listing the additive wire additions + the reference truth function; MIGRATION.md untouched (belongs with removal in Phase 33).
- [ ] No `npm publish`, no `dotnet nuget push`, no git tag, no `main`-advance, no `#vms-announcements` post in this phase.

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                  |
|--------------------|-------|------|--------|------------------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Coexistence-then-remove reconciles wire-removal vs green-tree tension. |
| Boundary Clarity   | 0.90  | 0.70 | ✓      | Explicit out-of-scope: adapter, demos, removal, publish, popover UI.   |
| Constraint Clarity | 0.85  | 0.65 | ✓      | Byte-parallel + gotcha #8/#9 posture + protocol-token-stays-1.0.       |
| Acceptance Criteria| 0.90  | 0.70 | ✓      | 13 pass/fail criteria; NASA bar sized (exhaustive/repr/diagonal + mutation). |
| **Ambiguity**      | 0.11  | ≤0.20| ✓      |                                                                        |

## Interview Log

| Round | Perspective | Question summary | Decision locked |
|-------|-------------|------------------|-----------------|
| 1     | Researcher  | How does Phase 32 close green when the plan says wire removes old shape but demos still call it? | Option A: wire is ADDITIVE in Phase 32; old shape coexists; Phase 33 removes old + migrates demos + releases. Aligned with AGENTS.md "NEVER PUSH ANYTHING BROKEN." Ashley: "let's go" |
| 1     | Researcher  | What's the actual measurable NASA bar for the truth function's tests? | 1-rule EXHAUSTIVE (op × type × value-shape × empty variants) + 2-rule representative per type × both joiners + 3-rule diagonal per type × both joiners + cross-backend byte-parallel per case + mutation-verify (revert each operator, confirm suite goes red). Ashley: "let's go" |

---

*Phase: 32-column-filter-expansion-phase-1-wire-types-reference-truth-f*
*Spec created: 2026-08-18*
*Next step: /gsd:discuss-phase 32 — implementation decisions (where the wire fields live on TableColumn vs a new `filter?: FilterSpec` container; where the truth function's public entry point lives on each backend; timezone handling for date operators; the per-column override seam mechanism; the exact parity-fixture structure for the truth-function cross-backend harness)*
