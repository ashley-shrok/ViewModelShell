# Phase 8: Alignment Enums + Layout Policy - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning
**Source:** Authored by orchestrator from the locked design doc (`.planning/design/layout-system-research.md`) + the milestone-scoping conversation. Decisions below are LOCKED (no further discussion needed); the design doc is the rationale of record.

<domain>
## Phase Boundary

This phase adds **main-axis (`arrange`) and cross-axis (`align`) alignment** to the `row` layout on `PageNode` and `SectionNode`, as closed wire enums, with byte-identical TS/.NET parity; writes the two standing layout principles into AGENTS.md as the governing test for all future layout work; ships a minimal demo proving the canonical header-bar; and releases a lockstep npm + NuGet minor.

IN SCOPE: `arrange`/`align` enum fields + CSS + parity fixture + AGENTS.md policy + a minimal header-bar demo/Showcase entry + the lockstep release.
OUT OF SCOPE (later phases): `switcher` (Phase 9), `cards` `minItem` (Phase 9), `fits` node (Phase 10), the comprehensive demo spread + real-app compositions (Phase 11). Do NOT build those here.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Wire fields
- Add **two optional fields** to BOTH `PageNode` and `SectionNode` (both can carry `layout:"row"`):
  - `arrange?` — closed union: `"start" | "center" | "end" | "space-between" | "space-around" | "space-evenly"` (copied verbatim from Jetpack Compose `Arrangement` ∩ Flutter `MainAxisAlignment`).
  - `align?` — closed union: `"start" | "center" | "end" | "stretch" | "baseline"` (Flutter `CrossAxisAlignment`, fullest set).
- TS: add to the `PageNode`/`SectionNode` interfaces in `viewmodel-shell/src/index.ts` (re-exported through `src/server.ts` automatically; do NOT edit server.ts). Follow the EXACT doc-comment + closed-union style of the existing `density`/`width`/`variant` fields right above them.
- .NET: add to the `PageNode` (record ~line 266) and `SectionNode` (record ~line 287) records in `viewmodel-shell-dotnet/ViewModels.cs` as `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Arrange = null` and `... string? Align = null`, mirroring the existing `Density`/`Layout`/`Variant`/`Width` fields (free-form `string?` on the .NET side — the closed union is enforced on the TS side and validated by parity; this matches the existing `Layout` field's pattern, see its comment).

### CSS / rendering
- The renderer (`viewmodel-shell/src/browser.ts`) emits modifier classes when the field is set: `vms-arrange--{value}` and `vms-align--{value}` on the same element that carries the `vms-page--row` / `vms-section--row` class. Mirror the existing layout-modifier emission idiom (see how `n.layout && n.layout !== "stack"` emits `vms-page--${n.layout}` around browser.ts ~line 266/292).
- CSS in `viewmodel-shell/styles/default.css`: add closed-set rules mapping the classes to box-alignment:
  - `arrange`: `start→justify-content:flex-start`, `center→center`, `end→flex-end`, `space-between→space-between`, `space-around→space-around`, `space-evenly→space-evenly`.
  - `align`: `start→align-items:flex-start`, `center→center`, `end→flex-end`, `stretch→stretch`, `baseline→baseline`.
  - Place these immediately after the existing `.vms-page--row`/`.vms-section--row` block (~line 221-229). These are intended for `layout:"row"` (the cluster primitive); the rules are generic box-alignment so they're harmless if ever combined with another flex container.
- **Default-omitted = byte-identical:** an omitted `arrange` emits no class → `justify-content` stays the row default (`flex-start`, left-pack) = today's behavior. An omitted `align` emits no class → `align-items` stays the row default (`center`) = today's behavior. This MUST hold (verify in the parity fixture by including a plain `row` with neither field).
- The existing title/heading full-width rule (`.vms-page--row > .vms-page__title { flex: 0 0 100% }`) stays UNTOUCHED. The header-bar pattern (ALIGN-04) uses a heading **`TextNode`** as the first child (NOT `PageNode.title`/`SectionNode.heading`), so it participates in the row; `arrange:"space-between"` then pushes it left and the nav right.

### Parity
- Widen the existing FeatureProbe parity fixture (or add a focused fixture) under `parity/` so the wire carries `row` + every `arrange` value and every `align` value, plus a bare `row` (neither field) to prove the byte-identical-when-omitted property. Update `parity/backends.json` only if a new fixture file is added. `bun run parity/run.ts` MUST be byte-identical green across .NET / Bun / Node.

### Policy doc (POLICY-01)
- Add a **"Layout policy"** section to `AGENTS.md` (the repo-root one, the framework's AGENTS.md — NOT the home one) stating the two principles as the governing test for ALL future layout changes:
  - **P1**: responsiveness must be intrinsic / container-relative with ZERO viewport breakpoints — container queries are the only escape hatch, never `@media`.
  - **P2**: every layout knob crossing the wire is a closed enum or bounded scalar, never raw CSS (no spans/tracks/areas/breakpoint-objects).
  - State the rule: a layout field joins the vocabulary IFF it passes both. Name `sidebar` and `switcher` as the two flexbox idioms a grid provably cannot express (switcher arrives in Phase 9; naming it here is intentional forward-reference). Point at `.planning/design/layout-system-research.md` as the rationale of record.

### Demo (incremental verification for this phase)
- Add a minimal demonstration of the new capability so it's independently verifiable as it lands — preferably a small entry in the existing `demo/Showcase/` (zero per-view `<style>`, per the VMS no-demo-CSS guard) showing: the canonical header-bar (`row` + `arrange:"space-between"` + heading TextNode first child + a nav cluster), and a small matrix of the `align` values. The COMPREHENSIVE spread + real-app compositions are Phase 11 — keep this minimal.

### Release (RELEASE gate)
- Lockstep minor bump: npm `@ashley-shrok/viewmodel-shell` **1.11.0 → 1.12.0**; NuGet `AshleyShrok.ViewModelShell` **1.9.0 → 1.10.0** (additive wire fields = aligned minor per the AGENTS.md major.minor rule). Wire protocol token stays `viewmodel-shell/1.0` (additive, non-breaking). CHANGELOG entry (+ a MIGRATION note is NOT needed — purely additive). Then the publish ritual + annotated `v1.12.0` tag + advance `main`.
- ⚠️ EXECUTION CHECKPOINT: the actual `git commit`, the npm/NuGet **publish**, the tag, and the `main` advance are OPERATOR-GATED — the orchestrator pauses for the user's explicit go before running them (repo git policy + outward-facing publish). The plan should sequence the code/test/doc work to completion, then STOP at the release step for sign-off. Code, fixtures, CHANGELOG, and version-number edits can be staged; the publish/commit/tag/push are the gated actions.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design rationale (source of truth for scope)
- `.planning/design/layout-system-research.md` — the 4-framework synthesis; the exact enum values, the two principles, and why this shape.

### Code anchors to mirror
- `viewmodel-shell/src/index.ts` (PageNode ~line 114, SectionNode ~line 126) — the existing `density`/`layout`/`width`/`variant` closed-union fields + doc-comment style to copy.
- `viewmodel-shell/src/browser.ts` (~line 266, 292) — the existing `vms-page--{layout}` / `vms-section--{layout}` modifier-class emission idiom.
- `viewmodel-shell/styles/default.css` (~line 221-229) — the existing `.vms-page--row`/`.vms-section--row` flex rules; new alignment rules go right after.
- `viewmodel-shell-dotnet/ViewModels.cs` (PageNode ~line 266, SectionNode ~line 287) — the `[JsonIgnore(WhenWritingNull)] string?` field pattern to mirror.
- `parity/` + `parity/backends.json` + `parity/run.ts` — the cross-backend fixture harness; the FeatureProbe fixture is the one to widen.
- `AGENTS.md` (repo root) — release rules (major.minor, publish ritual, tag, advance-main), VMS layout philosophy, the node-type concern→source table.

### Prior-art precedent in this codebase (how a layout field was added before)
- Milestone 0.4.0 Phase 4 "Preset-Grid Layout" added the `layout` enum (LAYOUT-01..05) — same shape of change (closed-union wire field + CSS + both backends + widened FeatureProbe parity). Follow that precedent.
</canonical_refs>

<specifics>
## Specific Ideas
- Header-bar acceptance (ALIGN-04): a `section`/`page` with `layout:"row"`, `arrange:"space-between"`, children `[ TextNode{value:"Title", style:"heading"}, section{layout:"row", children:[...nav links...]} ]` renders title-left / nav-right with zero app CSS.
- The `align` values most likely exercised: `center` (vertical-center a bar's items — already the default but explicit), `baseline` (align a heading TextNode's baseline with nav text), `stretch` (equal-height cards in a row).
</specifics>

<deferred>
## Deferred Ideas
- `switcher`, `cards` `minItem`, `fits` node, comprehensive demo spread, real-app compositions — all later phases (9/10/11). A per-child `Spacer{grow}` and proportional `weight` are deferred milestone-wide (see REQUIREMENTS.md Future/Out-of-Scope).
</deferred>

---

*Phase: 08-alignment-enums-layout-policy*
*Context authored 2026-06-24 by orchestrator from locked design doc (no discuss-phase needed — decisions settled).*
