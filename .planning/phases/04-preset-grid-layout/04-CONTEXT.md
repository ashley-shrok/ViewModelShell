# Phase 4: Preset-Grid Layout - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Add **one** optional, closed-union layout-preset enum to the *existing* `PageNode` and `SectionNode` that arranges their **direct children**. The enum is the only layout field that ever crosses the wire — arrangement intent lives in the model, every pixel lives in CSS.

- **LAYOUT-01** — omitted/default value renders byte-identically to today's vertical stack (non-breaking, no new node types).
- **LAYOUT-02** — `split` preset: columns on wide, collapses to stacked on narrow, no app-specified breakpoints.
- **LAYOUT-03** — `cards` preset: auto-fit from a single min-item-width, collapses to one column on narrow.
- **LAYOUT-04** — the preset is the ONLY layout field on the wire — no spans, tracks, or named areas.
- **LAYOUT-05** — the field round-trips byte-identically on .NET and TS backends, covered by a new parity fixture (.NET/Bun/Node).

**Out of this phase:** the 0.4.0 npm+NuGet version bump (Phase 5 RELEASE-01); Showcase/demos switching to the shipped stylesheet + Bootstrap-benchmarked canonical set (Phase 5 EXAMPLES-*); MIGRATION/CHANGELOG (Phase 5 RELEASE-03); AGENTS.md full doc polish (Phase 5 EXAMPLES-03 — Phase 4 keeps the node/CSS tables merely *accurate* for the field it ships); the fixed-N-column preset (LAYOUT-F1, v2/Out of Scope).

</domain>

<decisions>
## Implementation Decisions

### Preset model surface (LAYOUT-01, LAYOUT-04, LAYOUT-05)

- **D-01:** Single additive optional **closed-union** field `layout?: "stack" | "split" | "cards"`, the **same union on both** `PageNode` and `SectionNode` (CSS differs only by selector). Mirrors the Phase 3 D-01/D-03 pattern (additive, optional, closed union — like `density?`, not the open-string `ListItemNode.variant?`). This is the **only** layout field on the wire — no spans/tracks/named areas anywhere (LAYOUT-04; REQUIREMENTS Out of Scope "Spatial layout utilities").
- **D-02:** **Byte-identical default (LAYOUT-01):** *omitted* AND an *explicit `"stack"`* both emit **zero modifier class** → wire + DOM byte-identical to today regardless of which the agent uses. Only `"split"`/`"cards"` emit `.vms-page--split` / `.vms-page--cards` / `.vms-section--split` / `.vms-section--cards`. This exactly mirrors the Phase 3 density precedent (D-04): `"comfortable"` is a valid union member that emits nothing. **Class emission, not data-attributes**, following the established ``${n.x === "y" ? " vms-z--y" : ""}`` idiom (browser.ts: density line 196, variant line 209, button 459, modal 536).
- **D-03:** **Cross-backend surface (LAYOUT-05):** add the field to `viewmodel-shell/src/index.ts` `PageNode` (lines 59–65) and `SectionNode` (lines 67–73). It **auto-flows to `src/server.ts`** via the existing `export * from "./index.js"` re-export (line 13) — **no separate `server.ts` edit needed**; LAYOUT-05's "present in src/server.ts" is satisfied by the re-export. `viewmodel-shell-dotnet/ViewModels.cs` `PageNode` (lines 99–103) / `SectionNode` (lines 105–109) records each gain `string? Layout = null`, mirroring the existing `string? Density`/`string? Variant` precedent (Phase 3). See **D-10** for the "5 copies" wording reconciliation.

### `cards` preset (LAYOUT-03, LAYOUT-04)

- **D-04:** The cards **min-item-width is a fixed CSS constant, NOT a wire param.** `cards` = a pure semantic preset; zero geometry crosses the wire (strictest LAYOUT-04; the blind agent never authors geometry — REQUIREMENTS Out-of-Scope principle). CSS: `grid-template-columns: repeat(auto-fit, minmax(var(--vms-card-min), 1fr))` — intrinsic auto-collapse to one column, **zero media queries**. LAYOUT-03's "single min-item-width value" *is* the CSS constant, not an agent input.
- **D-05:** The min-width is exposed as an **additive overridable `--vms-card-min` `:root` variable** (host/theme-retunable like every other `--vms-*` token; the agent never touches it), consistent with Phase 3 D-06 override-seam discipline (additive `--vms-*`, seam stays sacred — never edit existing `:root` names/values).

### `split` preset (LAYOUT-02)

- **D-06:** `split` = exactly **2 equal-width columns** side-by-side, collapsing intrinsically to **1 column** when too narrow (no app-specified breakpoints). >2 direct children wrap into a 2-column flow (e.g. 4 children → 2×2). Equal columns, **not** content-natural — predictable for a blind agent operating with no visual feedback.
- **D-07:** **Zero media queries** (Phase 3 D-13, locked — default.css has zero today; LAYOUT-02/03 forbid app breakpoints). The behavior contract (exactly-2 → 1, intrinsic, equal) is **locked**; the exact zero-media-query *technique* that achieves "exactly 2 then 1" is **bounded researcher/Claude discretion** — see Specifics (RESEARCH ITEM).

### Parity fixture (LAYOUT-05; closes the Phase 3 D-05 deferral)

- **D-08:** Extend the existing **FeatureProbe** demo (`demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — `PageNode` at line ~100 — and `demo/FeatureProbe-bun/server.ts`) to emit `layout` (split/cards), and extend `parity/fixtures/feature-probe.json` to exercise it. FeatureProbe is the **only** fixture already wired for all 3 backends (`dotnet-probe`/`bun-probe`/`node-probe` in `parity/backends.json`) — exactly LAYOUT-05's "(.NET/Bun/Node byte-identical)" requirement. **No new backend entries needed.**
- **D-09:** This single fixture also exercises `density` (compact) and `variant: card`, **closing the Phase 3 D-05 deferral** ("dedicated density/card parity fixture rides with Phase 4 LAYOUT-05 / Phase 5 RELEASE-02") in one place. The existing 7 fixtures stay 100% green (regression — LAYOUT-01 + RELEASE-02 baseline).

### Scope / reconciliation (locked — not user-asked)

- **D-10:** LAYOUT-05's "all 5 demo `ViewModels.cs` copies" wording is **factually inaccurate for this codebase**. Verified: `find demo -name ViewModels.cs` returns nothing; every .NET demo references the single source via `<ProjectReference Include="../../../viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj" />`. There is **one** shared `viewmodel-shell-dotnet/ViewModels.cs`. Phase 3 D-05 already established this single-source reality. LAYOUT-05 is satisfied by: the field in the single shared .NET source + `index.ts` (+ `server.ts` re-export) + the new parity fixture. **Do not hunt for 5 files.**
- **D-11:** **No version bump in Phase 4** (Phase 5 RELEASE-01 owns the aligned 0.4.0). Parity must stay green; **verifier + plan-check agents ON** (PROJECT.md Constraints — this is architecture-invariant wire-format work, not a quick).

### Claude's Discretion

- Exact `--vms-card-min` default value (≈16–20rem is a sane card width).
- The zero-media-query `split` technique (bounded by D-07: must yield exactly-2-then-1, intrinsic, no media queries — see RESEARCH ITEM).
- Exact CSS for how `--split`/`--cards` modifiers override the existing `.vms-page`/`.vms-section` `display:flex; flex-direction:column; gap` (preserve the `gap` rhythm; switch axis/display) — provided omitted/`stack` stays byte-identical.
- Whether `.vms-page__title` / `.vms-section__heading` stay outside the grid/column flow (likely yes — a heading should not become a grid item) — must read sensibly.
- FeatureProbe VM + `feature-probe.json` step structure for exercising layout/density/card.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & locked decisions
- `.planning/REQUIREMENTS.md` — LAYOUT-01..05 acceptance criteria (Layout section); the LAYOUT-04 "only layout field on the wire" wording; Out of Scope "Spatial layout utilities (column spans, track templates, named areas, m-*/p-* utilities, 12-column grid)"; v2 `LAYOUT-F1` (fixed-N-column deferred)
- `.planning/ROADMAP.md` §"Phase 4: Preset-Grid Layout" — the 5 success criteria; "Depends on Phase 3" rationale (presets compose *within* the shipped design-system rhythm)
- `.planning/PROJECT.md` — Core Value (platform-agnostic, blind-agent rationale); Key Decisions ("Layout *intent* lives in the model … not CSS-only", "0.4.0 minor bump npm+NuGet aligned", "appearance is 100% CSS / override seam untouched"); Constraints (no wire/API break; parity gate; verifier/plan-check on); Out of Scope (spatial utilities; fixed-column = consider-only, settled to v2)
- `.planning/phases/03-default-design-system/03-CONTEXT.md` — D-01/D-03/D-04 (closed-union additive optional field; omitted = byte-identical; class emission idiom), **D-05 (density/card parity fixture explicitly deferred to "Phase 4 LAYOUT-05 / Phase 5 RELEASE-02" — this phase closes it, see D-09)**, D-06 (override-seam discipline: additive `--vms-*` only, never edit existing `:root`), D-13 (zero media queries, intrinsic responsive only)
- `.planning/STATE.md` §Architectural Notes — preset-grid framing ("ONE grid-backed layout enum on EXISTING page/section, no new node types, no spatial geometry, default = today's vertical flow byte-identical"); "parity is the highest-signal gate"

### Implementation targets
- `viewmodel-shell/src/index.ts` — `PageNode` (lines 59–65) + `SectionNode` (lines 67–73) gain `layout?: "stack" | "split" | "cards"` (closed union per D-01/D-02); model after the adjacent `density?`/`variant?` JSDoc + typing
- `viewmodel-shell/src/server.ts` — **no edit**; `export * from "./index.js"` (line 13) re-exports the new field automatically (D-03 — note this so the planner does not add a redundant edit)
- `viewmodel-shell/src/browser.ts` — `page()` (lines 194–205; className at 196) and `section()` (lines 207–218; className at 209) emit `vms-{page|section}--{layout}` ONLY for `"split"`/`"cards"`, following the existing ``${n.density === "compact" ? " vms-page--compact" : ""}`` idiom; omitted + `"stack"` emit nothing (D-02)
- `viewmodel-shell/styles/default.css` — `:root` (lines 17–59, beside `--vms-page-max` at 58) gains `--vms-card-min`; add `.vms-page--split`/`.vms-section--split`/`.vms-page--cards`/`.vms-section--cards` rules (intrinsic responsive, zero media queries, D-04/D-06/D-07); they override the existing `.vms-page`/`.vms-section` flex-column `gap` (line 91 / line 118) while preserving the `gap` rhythm
- `viewmodel-shell-dotnet/ViewModels.cs` — `PageNode` record (lines 99–103) + `SectionNode` record (lines 105–109) gain `string? Layout = null` (mirror the existing `string? Density`/`string? Variant`); single shared source, consumed by all demos via `ProjectReference` (D-10)
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (`PageNode` at ~line 100) + `demo/FeatureProbe-bun/server.ts` — add `layout` (split/cards) + `density` + `variant: card` usage so the fixture exercises all three (D-08/D-09)

### Verification & docs
- `parity/fixtures/feature-probe.json` — extend the recorded script so the new `layout`/`density`/`variant` fields appear in diffed responses; `parity/backends.json` already lists `dotnet-probe`/`bun-probe`/`node-probe` for `feature-probe` (the 3-backend coverage LAYOUT-05 wants — no edit to backends.json needed)
- `parity/run.ts` + `parity/normalize.ts` — harness diffs wire JSON; omitted/`stack` MUST serialize byte-identically to today (LAYOUT-01); `split`/`cards` add the `layout` key. The existing 7 fixtures stay green (regression)
- `viewmodel-shell/test/theme-modifiers.test.ts` — add jsdom class-emission tests for `layout` following the existing density/card pattern: `split`/`cards` ⇒ class present; omitted/`stack` ⇒ `className === "vms-page"`/`"vms-section"` (byte-identical). No real browser (Phase 1/2 discipline)
- `AGENTS.md` — node table (lines 105–106, `page`/`section` rows) + CSS-class table (lines 141–142) add the `layout` field + `.vms-{page|section}--split`/`--cards`. Keep merely *accurate* for what Phase 4 ships; full doc polish is Phase 5 EXAMPLES-03
- `AGENTS.md` (lines 5, 13) — the major.minor version-alignment rule (a `ViewNode`/wire-format change bumps both packages) — relevant context, but the bump itself is Phase 5 RELEASE-01 (D-11)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **BEM modifier-emission idiom** — ``el.className = `vms-page${n.density === "compact" ? " vms-page--compact" : ""}``` (browser.ts:196) and the section equivalent (browser.ts:209); also button (459), modal (536), list-item (230). `layout` slots directly into this; no new plumbing concept.
- **Closed-union additive field precedent** — `PageNode.density?: "comfortable" | "compact"`, `SectionNode.variant?: "card"` (index.ts 62/70) and `string? Density`/`string? Variant` (ViewModels.cs 102/108). `layout?` is structurally the same addition on the same two records, both backends.
- **`--vms-*` :root override seam** — Phase 3 added `--vms-space-*`/`--vms-text-*`/`--vms-page-max` additively (default.css 42–59). `--vms-card-min` extends the *same* mechanism (D-05).
- **`theme-modifiers.test.ts` jsdom harness** — already renders page/section through `BrowserAdapter` and asserts class presence + byte-identical `className` for omitted fields. The layout tests are a direct extension of this exact file/pattern.
- **FeatureProbe = the 3-backend probe** — the only fixture wired for .NET + Bun + Node (`feature-probe` in backends.json: dotnet-probe/bun-probe/node-probe). It is the canonical "exercise every node feature" demo — the natural and lowest-friction home for the LAYOUT-05 fixture (D-08).

### Established Patterns
- **Optional field, default = byte-identical** — every prior additive node field defaulted to prior behavior; D-02 follows it (omitted/`stack` emits no modifier; wire identical).
- **Verification = parity (wire JSON) + jsdom/vitest (DOM)** — no real browser (Phase 1/2 discipline). New behavior gets jsdom class-emission tests; CSS layout has no parity surface (parity diffs wire, not computed CSS — Phase 3 note).
- **Don't "improve" adjacent surfaces** — the override seam is sacred: only *add* `--vms-card-min`; never edit existing `:root` names/values or the 11 theme files (Phase 3 D-06 / THEME-05 discipline carried forward).
- **Zero media queries** — default.css has none; preserve that (D-07; Phase 3 D-13; LAYOUT-02/03 forbid app breakpoints).

### Integration Points
- `default.css` `:root` (~lines 17–59) — where `--vms-card-min` is added (beside `--vms-page-max`).
- `default.css` `.vms-page` (line 91) / `.vms-section` (line 118) — both are `display:flex; flex-direction:column; gap:var(--vms-space-*)`. The `--split`/`--cards` modifiers override `display`/`flex-direction` (→ grid or row-wrap) while keeping the `gap` rhythm; must be byte-identical when omitted/`stack`.
- `browser.ts` `page()` / `section()` render functions — the only renderer changes (two modifier-emission expressions).
- `index.ts` `PageNode`/`SectionNode` + `ViewModels.cs` `PageNode`/`SectionNode` records — the only type/model changes (one optional member each, both backends); `server.ts` rides via re-export.
- `FeatureProbe` controller (.NET) + `FeatureProbe-bun/server.ts` + `parity/fixtures/feature-probe.json` — the only verification-surface changes.

</code_context>

<specifics>
## Specific Ideas

- **RESEARCH ITEM — the zero-media-query `split` technique.** Strict "exactly 2 columns until it collapses to 1" with **zero media queries** (D-07) is the hardest knot in this phase. `grid-template-columns: 1fr 1fr` does NOT intrinsically collapse. Candidate techniques the researcher must resolve: (a) flexbox-wrap — children `flex: 1 1 <basis>` + `min-width` so exactly 2 fit per row until the basis can't, then 1; (b) grid `repeat(auto-fit, minmax(min(<thresh>, 100%), 1fr))` *capped to 2* (auto-fit alone yields N columns at very wide widths — not "exactly 2"); (c) container queries (newer baseline; framework has used clamp/intrinsic only to date — acceptable only if it cleanly beats (a)/(b), note explicitly if chosen). The **behavior contract is locked** (D-06); only the mechanism is open.
- **The "5 ViewModels.cs copies" trap (D-10).** A planner/researcher reading LAYOUT-05 literally will waste effort hunting 5 files that do not exist. There is ONE shared `viewmodel-shell-dotnet/ViewModels.cs`; demos consume it via `ProjectReference`. Treat LAYOUT-05's intent as "the field is in the single shared .NET source + TS source + a parity fixture proves cross-backend identity," exactly as Phase 3 D-05 already framed it.
- **`cards` LAYOUT-03↔LAYOUT-04 resolution is decisive (D-04).** "Single min-item-width value" is satisfied by a CSS constant, not a wire param. If a future real app proves one global `--vms-card-min` insufficient, that is usage-driven follow-up — NOT a reason to add geometry to the wire now (the whole point of preset-grid is the agent picks a semantic preset, never authors geometry).
- **Bootstrap is a visual benchmark only, never a CSS dependency** (carried from Phase 3 / REQUIREMENTS Out of Scope). Relevant when Phase 5 benchmarks these presets on the Showcase — not authored or depended on here.
- **The new fixture must do double duty** — prove the 3 new page/section wire fields (layout/density/card) round-trip byte-identical across .NET/Bun/Node AND keep the existing 7 fixtures green. FeatureProbe's existing 3-backend coverage is exactly the LAYOUT-05 "(.NET/Bun/Node byte-identical)" requirement (D-08/D-09).

</specifics>

<deferred>
## Deferred Ideas

- **Fixed-N-column preset (calendar/scheduling grids)** — `LAYOUT-F1`, REQUIREMENTS v2 / Out of Scope. PROJECT.md's "consider a fixed-column mode" is settled to **NOT in 0.4.0** (driven by usage, not speculation — revisit only if a calendar-class app proves vertical-flow + auto-fit insufficient).
- **Coarse card-size token / numeric min-width on the wire** — rejected this phase (D-04: pure CSS constant, zero wire geometry). Revisit only if a real app proves a single `--vms-card-min` insufficient (usage-driven).
- **N-up / content-natural `split`** — rejected (D-06: exactly-2, equal-width). Revisit only on a demonstrated real-app need.
- **Container queries as the responsive mechanism** — not chosen; permitted only as a bounded-discretion option for D-07's split technique if it cleanly beats flexbox-wrap/auto-fit (framework has used clamp/intrinsic only to date — note explicitly if adopted).
- **0.4.0 npm+NuGet aligned version bump** — Phase 5 RELEASE-01. Phase 4 adds the wire field but does NOT bump versions (D-11).
- **AGENTS.md full doc polish for presets/density/card + Showcase/demos on the shipped stylesheet** — Phase 5 EXAMPLES-03 / EXAMPLES-02. Phase 4 keeps the node/CSS tables merely *accurate* for the field it ships.
- **MIGRATION.md / CHANGELOG 0.4.0 entry** — Phase 5 RELEASE-03.

### Reviewed Todos (not folded)
None — `todo match-phase 4` returned 0 matches.

</deferred>

---

*Phase: 04-preset-grid-layout*
*Context gathered: 2026-05-17*
