# Requirements: ViewModel Shell — Milestone v1.12 Layout System Completeness

**Defined:** 2026-06-24
**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end, and drivable end-to-end by an agent reading only the JSON the server emits.

Source of truth for scope: `.planning/design/layout-system-research.md` (4-framework research synthesis). This milestone completes the layout vocabulary started by the 0.4.0 Design System milestone. Pre-production: no backward-compat burden.

**Two standing principles every requirement must satisfy** (also shipped as AGENTS.md policy, POLICY-01):
- **(P1) Intrinsic responsiveness, zero viewport breakpoints.** Collapse must be container-relative — auto-fit/`minmax`, flex-wrap, negative-flex-basis, or container queries. Never a viewport `@media` rule.
- **(P2) Closed enum or bounded scalar, never raw CSS.** Every layout knob crossing the wire is a closed union or bounded token. No CSS values, no spans/tracks/areas, no breakpoint objects.

---

## v1 Requirements

### Alignment (main/cross-axis enums)
- [ ] **ALIGN-01**: The `row` layout (on `PageNode`/`SectionNode`, and any flex-row container) accepts an optional `arrange` closed enum — `start | center | end | space-between | space-around | space-evenly` — mapping to `justify-content`. Omitted renders byte-identical to today's left-pack `row`.
- [ ] **ALIGN-02**: The `row` layout accepts an optional `align` closed enum — `start | center | end | stretch | baseline` — mapping to `align-items`. Omitted renders byte-identical to today's `align-items:center`.
- [ ] **ALIGN-03**: `arrange`/`align` land byte-identically in TS (`src/index.ts` + `browser.ts` + `styles/default.css`) and .NET (`ViewModels.cs`, both nullable fields carrying `[JsonIgnore(WhenWritingNull)]`); a parity fixture exercises every enum value and `bun run parity/run.ts` is byte-identical green.
- [ ] **ALIGN-04**: The canonical header-bar pattern — a `row` with `arrange:"space-between"` and a heading-`TextNode` first child — renders title-left / nav-right with zero app CSS (the PBMInvoices consumer's request, served by the general primitive).

### Switcher (atomic row↔stack primitive)
- [ ] **SWITCH-01**: A new `switcher` layout exists that lays N equal-weight children in a single row above a content-width threshold and stacks ALL of them below it — an atomic flip with no intermediate partial-wrap state — implemented via the negative-`flex-basis` trick, zero `@media`.
- [ ] **SWITCH-02**: `switcher` takes a bounded `threshold` token (the flip width) and an optional bounded `limit` (max items before forcing vertical regardless of width). Both closed/bounded, never raw CSS.
- [ ] **SWITCH-03**: `switcher` lands byte-identically in TS and .NET (nullable params with `[JsonIgnore(WhenWritingNull)]`); a parity fixture covers it; `bun run parity/run.ts` green.

### Grid (cards minItem wire field)
- [ ] **GRID-01**: The `cards` layout accepts an optional bounded `minItem` token (a closed size scale) that sets the auto-fit minimum track width — promoting the CSS-only `--vms-card-min` to explicit server intent. Omitted renders byte-identical to today's `--vms-card-min` default.
- [ ] **GRID-02**: `minItem` lands byte-identically in TS and .NET (`[JsonIgnore(WhenWritingNull)]`); a parity fixture exercises it; `bun run parity/run.ts` green.

### Fits (responsive selection node)
- [ ] **FITS-01**: A new `fits` node type renders the first child whose intrinsic size fits the available container width, else the next — container-relative selection decided client-side at layout time, zero breakpoints. Carries an axis enum (`horizontal | vertical | both`) and an ordered children list.
- [ ] **FITS-02**: `fits` has a defined, sensible degradation on the TUI adapter (terminal has no pixel fit — renders a documented child per a fixed rule) so it doesn't break the non-browser target.
- [ ] **FITS-03**: `fits` lands byte-identically in TS and .NET (record + `[JsonDerivedType]` discriminator, nullable fields `[JsonIgnore(WhenWritingNull)]`); a parity fixture exercises it; `bun run parity/run.ts` green.

### Policy & docs
- [ ] **POLICY-01**: AGENTS.md gains a "Layout policy" section stating P1 (intrinsic/zero-viewport-breakpoint) and P2 (closed-enum/bounded-scalar) as the governing test for ALL future layout changes — a field joins the vocabulary iff it passes both. The two flexbox-idiom primitives a grid cannot express (`sidebar`, `switcher`) are named.
- [ ] **POLICY-02**: The node-type/CSS-class concern→source table and the Design-system section in AGENTS.md are updated to reflect the new primitives without enumerating them in a way that drifts (point at source/Showcase, per existing convention).

### Demo verification (the centerpiece)
- [ ] **DEMO-01**: Temporary demo apps (under `demo/`, standard VMS app structure, served locally) visually verify EACH new/affected layout in isolation: header-bar/`arrange`, every `align` value, `switcher` flip across the threshold, `sidebar` collapse, `cards`/`minItem`, and `fits` selection.
- [ ] **DEMO-02**: At least two real-app compositions (a dashboard and a list-detail view) built from the completed primitive set, proving they compose.
- [ ] **DEMO-03**: The operator personally reviews every demo layout in a browser and signs off (or returns feedback that is iterated to sign-off) — verification is by human review, not assumed.

### Release
- [ ] **RELEASE-01**: Each shipped primitive is released lockstep — aligned npm + NuGet version bumps, CHANGELOG (+ MIGRATION note if consumers must act), the manual publish ritual, an annotated `v<version>` git tag, and `main` advanced to contain the release commit (per AGENTS.md release rules). The milestone spans several minors.
- [ ] **RELEASE-02**: Every release gate is green at ship — full cross-backend parity byte-identical, vitest, the static CI guards (core-globals, WCAG-AA, no-demo-style, layout-classes), and `dotnet test`.

---

## v2 / Future Requirements (deferred, not this milestone)
- **CENTER-01** (deferred): a nestable `center` primitive (center + measure-cap an inner subtree, not just the page). Cheap; add when a real app hits it.
- **COVER-01** (deferred): a `cover` primitive (vertical-center a region for login/splash/empty-state). Add when an app needs it.
- **SPACER-01** (deferred): a `Spacer{grow}` node for asymmetric push-apart cases `arrange` can't cover. Add only if a real composition needs it (`arrange:"space-between"` covers ~90%).
- **CQ-DISCRETE-01** (deferred): container-query-driven discrete reflow (named app-shell regions, "exactly 2 cols above width X else 1") for what auto-fit can't express. The Tier-2 escape hatch; build when needed.

## Out of Scope (explicit exclusions)
- **12-column placement/span grid** (`colSpan`/`col-start`) — rejected by the research: breakpoint-driven by construction, violates P1; spans violate P2. Never on the VMS wire.
- **Viewport-breakpoint objects** (`{xs, md, lg}` per-node) — makes the *app* own breakpoints, the opposite of the framework contract; violates P1. Never on the wire.
- **`frame` (aspect-ratio media crop)** and **`reel` (horizontal scroller)** — out of a forms/tables/workflow framework's wheelhouse; pure-CSS-cheap to add later if ever needed.
- **Per-child proportional `weight`/`flex` field** — superseded for now by `arrange` + (deferred) `Spacer`; revisit only if proportional column splits are genuinely needed.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ALIGN-01 | Phase 8 | Pending |
| ALIGN-02 | Phase 8 | Pending |
| ALIGN-03 | Phase 8 | Pending |
| ALIGN-04 | Phase 8 | Pending |
| POLICY-01 | Phase 8 | Pending |
| SWITCH-01 | Phase 9 | Pending |
| SWITCH-02 | Phase 9 | Pending |
| SWITCH-03 | Phase 9 | Pending |
| GRID-01 | Phase 9 | Pending |
| GRID-02 | Phase 9 | Pending |
| FITS-01 | Phase 10 | Pending |
| FITS-02 | Phase 10 | Pending |
| FITS-03 | Phase 10 | Pending |
| DEMO-01 | Phase 11 | Pending |
| DEMO-02 | Phase 11 | Pending |
| DEMO-03 | Phase 11 | Pending |
| POLICY-02 | Phase 11 | Pending |
| RELEASE-01 | Phase 11 | Pending |
| RELEASE-02 | Phase 11 | Pending |
