# Roadmap: ViewModel Shell

## Milestones

- ✅ **0.3.13 Platform-Agnosticism** — Phases 1–2 (shipped 2026-05-15) — [archive](./milestones/0.3.13-ROADMAP.md)
- ✅ **0.4.0 Design System** — Phases 3–5 (shipped 2026-05-18; npm + NuGet 0.4.1)
- ✅ **1.0.0 Truly Self-Describing Wire** — Phases 6–7 (shipped 2026-06-08; npm + NuGet 1.0.0)
- 🚧 **v1.12 Layout System Completeness** — Phases 8–11 (in progress)

## Phases

**Phase Numbering:**
- Integer phases: Planned milestone work (numbering continues sequentially — v1.12 starts at Phase 8, the prior milestone ended at Phase 7)
- Decimal phases (e.g. 8.1): Urgent insertions (marked INSERTED)

<details>
<summary>✅ 0.3.13 Platform-Agnosticism (Phases 1–2) — SHIPPED 2026-05-15</summary>

- [x] Phase 1: Capability Seam Refactor (3/3 plans) — completed 2026-05-15
- [x] Phase 2: Upload Progress + Milestone Closeout (3/3 plans) — completed 2026-05-15

Full detail: [milestones/0.3.13-ROADMAP.md](./milestones/0.3.13-ROADMAP.md)

</details>

<details>
<summary>✅ 0.4.0 Design System (Phases 3–5) — SHIPPED 2026-05-18</summary>

- [x] Phase 3: Default Design System (3/3 plans) — completed 2026-05-17
- [x] Phase 4: Preset-Grid Layout (4/4 plans) — completed 2026-05-18
- [x] Phase 5: Canonical Examples + 0.4.0 Release Closeout (6/6 plans) — completed 2026-05-18

</details>

<details>
<summary>✅ 1.0.0 Truly Self-Describing Wire (Phases 6–7) — SHIPPED 2026-06-08</summary>

- [x] Phase 6: Wire Shape Change (5/5 plans) — completed 2026-06-07
- [x] Phase 7: Error Envelope + ok Flag + 1.0.0 Release Closeout (5/5 plans) — completed 2026-06-08

</details>

### 🚧 v1.12 Layout System Completeness (Phases 8–11)

**Milestone Goal:** Finish VMS's layout vocabulary so the frontend can express any app's layout with zero app-authored CSS and zero app-specified breakpoints — grounded in the 4-framework research synthesis (`.planning/design/layout-system-research.md`). Completes the layout enum that 0.4.0 started (`stack`/`split`/`cards`) by adding the alignment enums, the one missing completeness primitive (`switcher`), the converged-grid `minItem` wire field, and the responsive-selection `fits` node. Nothing built on the framework is in production, so the now-or-never window to get the primitive set right. The centerpiece is human-reviewed demo verification of every layout. Two standing principles are hard gates on every change: **P1** intrinsic/container-relative responsiveness with zero viewport breakpoints, and **P2** every layout knob a closed enum or bounded scalar, never raw CSS.

- [ ] **Phase 8: Alignment Enums + Layout Policy** — `arrange`/`align` closed enums on the `row` layout (subsumes the PBMInvoices header-bar request) + the two standing layout principles written into AGENTS.md; lockstep npm + NuGet release. Ships first and standalone to unblock the waiting external consumer.
- [ ] **Phase 9: Switcher + Cards minItem** — the `switcher` primitive (atomic row↔stack flip via negative-flex-basis) + promote `--vms-card-min` to a bounded `minItem` wire field on `cards`; lockstep release.
- [ ] **Phase 10: Fits Node** — the `fits` responsive-selection node (SwiftUI `ViewThatFits` port) including its TUI degradation; highest design surface, its own phase; lockstep release.
- [ ] **Phase 11: Demo Verification Spread + Milestone Closeout** — THE CENTERPIECE: temporary VMS demo apps verifying every layout in isolation + two real-app compositions (dashboard, list-detail), operator personally reviews and signs off; finalize AGENTS.md layout docs and the milestone release gate.

## Phase Details

### Phase 8: Alignment Enums + Layout Policy
**Goal**: The `row` layout gains main-axis (`arrange`) and cross-axis (`align`) closed-enum alignment, so any app can express bars, centered groups, and the canonical title-left/nav-right header without one line of app CSS; and AGENTS.md codifies the two standing layout principles as the governing test for all future layout work. Ships first and standalone because it unblocks the live PBMInvoices header-bar consumer.
**Depends on**: Phase 7 (1.0.x baseline — wire shape stable, error envelope + `ok` flag shipped, parity green)
**Requirements**: ALIGN-01, ALIGN-02, ALIGN-03, ALIGN-04, POLICY-01
**Success Criteria** (what must be TRUE):
  1. A `row` layout with `arrange` set to any of `start | center | end | space-between | space-around | space-evenly` visibly justifies its children along the main axis; omitting `arrange` renders byte-identical to today's left-pack `row` (ALIGN-01).
  2. A `row` layout with `align` set to any of `start | center | end | stretch | baseline` visibly aligns its children on the cross axis; omitting `align` renders byte-identical to today's `align-items:center` (ALIGN-02).
  3. A `row` with `arrange:"space-between"` and a heading `TextNode` first child renders title-left / nav-right with zero app CSS — the PBMInvoices header-bar pattern served by the general primitive (ALIGN-04).
  4. `arrange`/`align` land byte-identically in TS (`src/index.ts` + `browser.ts` + `styles/default.css`) and .NET (`ViewModels.cs`, both nullable fields carrying `[JsonIgnore(WhenWritingNull)]`); a parity fixture exercises every enum value and `bun run parity/run.ts` is byte-identical green (ALIGN-03).
  5. AGENTS.md has a "Layout policy" section stating P1 (intrinsic / zero-viewport-breakpoint) and P2 (closed-enum / bounded-scalar) as the test a field must pass to join the vocabulary, naming `sidebar` and `switcher` as the two flexbox idioms a grid cannot express; a lockstep npm + NuGet minor is published (version bump + CHANGELOG + publish ritual + annotated tag + `main` advanced) (POLICY-01, RELEASE gate).
**Plans**: 2 plans
- [ ] 08-01-PLAN.md — arrange/align wire fields + CSS + browser emission + .NET parity + FeatureProbe fixture (ALIGN-01/02/03)
- [ ] 08-02-PLAN.md — AGENTS.md Layout policy (POLICY-01) + Showcase header-bar/align demo (ALIGN-04) + CHANGELOG/version bumps + operator-gated lockstep release
**UI hint**: yes

### Phase 9: Switcher + Cards minItem
**Goal**: VMS gains the one missing completeness primitive — a `switcher` layout that flips N equal-weight children atomically between all-in-a-row and all-stacked at a content-width threshold (no awkward partial-wrap state) — and the industry-converged auto-fit grid becomes declared server intent by promoting the CSS-only `--vms-card-min` token to a bounded `minItem` wire field on `cards`. Both land in both backends with parity coverage and a lockstep release.
**Depends on**: Phase 8 (builds on the shipped alignment vocabulary and the just-codified layout policy; `switcher`/`minItem` must pass the P1/P2 gates Phase 8 wrote)
**Requirements**: SWITCH-01, SWITCH-02, SWITCH-03, GRID-01, GRID-02
**Success Criteria** (what must be TRUE):
  1. A `switcher` layout lays N equal-weight children in a single row above its content-width threshold and stacks ALL of them below it — an atomic flip with no intermediate partial-wrap state — implemented via negative-`flex-basis`, zero `@media` (SWITCH-01).
  2. `switcher` accepts a bounded `threshold` token (the flip width) and an optional bounded `limit` (max items before forcing vertical regardless of width); both are closed/bounded, never raw CSS (SWITCH-02).
  3. A `cards` layout with `minItem` set to a bounded size value sets the auto-fit minimum track width; omitting `minItem` renders byte-identical to today's `--vms-card-min` default (GRID-01).
  4. `switcher` and `minItem` land byte-identically in TS and .NET (nullable params / fields with `[JsonIgnore(WhenWritingNull)]`); parity fixtures cover both and `bun run parity/run.ts` is byte-identical green (SWITCH-03, GRID-02).
  5. A lockstep npm + NuGet minor is published per AGENTS.md release rules (version bump + CHANGELOG + publish ritual + annotated tag + `main` advanced); the full release gate is green (RELEASE gate).
**Plans**: TBD
**UI hint**: yes

### Phase 10: Fits Node
**Goal**: VMS gains the one genuinely novel borrow — a `fits` node (SwiftUI `ViewThatFits` ported to the wire) that renders the first child whose intrinsic size fits the available container, else the next: container-relative selection decided client-side at layout time with zero breakpoints, generalizing the existing `split`→`stack` collapse to arbitrary alternatives. It carries an axis enum and an ordered children list, has a sensible documented degradation on the non-browser TUI target, and lands in both backends with parity coverage and a lockstep release. Highest design surface, so its own phase.
**Depends on**: Phase 9 (the responsive-selection node sits atop the completed primitive set — its children are typically the row/switcher/cards layouts from Phases 8–9; landing it last lets it select among the finished vocabulary)
**Requirements**: FITS-01, FITS-02, FITS-03
**Success Criteria** (what must be TRUE):
  1. A `fits` node renders the first child whose intrinsic size fits the available container width, else the next — selection is container-relative and decided client-side at layout time with zero viewport breakpoints; it carries an axis enum (`horizontal | vertical | both`) and an ordered children list (FITS-01).
  2. `fits` has a defined, sensible degradation on the TUI adapter (a documented fixed-rule child choice, since a terminal has no pixel fit) so it does not break the non-browser target (FITS-02).
  3. `fits` lands byte-identically in TS and .NET — a new node record with a `[JsonDerivedType]` discriminator and nullable fields carrying `[JsonIgnore(WhenWritingNull)]`; a parity fixture exercises it and `bun run parity/run.ts` is byte-identical green (FITS-03).
  4. A lockstep npm + NuGet minor is published per AGENTS.md release rules (version bump + CHANGELOG + publish ritual + annotated tag + `main` advanced); the full release gate is green (RELEASE gate).
**Plans**: TBD
**UI hint**: yes

### Phase 11: Demo Verification Spread + Milestone Closeout
**Goal**: The centerpiece — prove the completed layout vocabulary actually works by building as many temporary VMS demo apps as needed (under `demo/`, standard app structure, served locally) so the operator can visually verify EVERY layout in a browser: header-bar/`arrange`, each `align` value, the `switcher` flip across its threshold, `sidebar` collapse, `cards`/`minItem`, and `fits` selection — plus two real-app compositions (a dashboard and a list-detail view) proving the primitives compose. The operator personally reviews every layout and signs off (or returns feedback that is iterated to sign-off). The milestone closes with the AGENTS.md node-table / Design-system docs updated to reflect the new primitives (pointing at source/Showcase, no drift-prone enumeration) and every release gate green.
**Depends on**: Phase 10 (the verification spread and real-app compositions can only exercise the full set once `arrange`/`align`, `switcher`, `minItem`, and `fits` have all shipped)
**Requirements**: DEMO-01, DEMO-02, DEMO-03, POLICY-02, RELEASE-01, RELEASE-02
**Success Criteria** (what must be TRUE):
  1. Temporary demo apps (under `demo/`, standard VMS app structure, served locally) visually verify each new/affected layout in isolation — header-bar/`arrange`, every `align` value, the `switcher` flip across its threshold, `sidebar` collapse, `cards`/`minItem`, and `fits` selection (DEMO-01).
  2. At least two real-app compositions — a dashboard and a list-detail view — are built from the completed primitive set and demonstrably compose without app CSS (DEMO-02).
  3. The operator personally reviews every demo layout in a browser and signs off; any returned feedback is iterated to sign-off — verification is by human review, not assumed (DEMO-03).
  4. AGENTS.md's node-type/CSS-class concern→source table and Design-system section are updated to reflect the new primitives by pointing at source/Showcase per existing convention (no drift-prone enumeration) (POLICY-02).
  5. Every release gate is green at ship — full cross-backend parity byte-identical, vitest, the static CI guards (core-globals, WCAG-AA, no-demo-style, layout-classes), and `dotnet test`; each primitive that shipped in Phases 8–10 was released lockstep across npm + NuGet per AGENTS.md release rules (RELEASE-01, RELEASE-02).
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 8 → 9 → 10 → 11

| Phase | Milestone | Plans | Status | Completed |
|---|---|---|---|---|
| 8. Alignment Enums + Layout Policy | v1.12 | 0/2 | Planned | - |
| 9. Switcher + Cards minItem | v1.12 | 0/TBD | Not started | - |
| 10. Fits Node | v1.12 | 0/TBD | Not started | - |
| 11. Demo Verification Spread + Closeout | v1.12 | 0/TBD | Not started | - |
