# Roadmap: ViewModel Shell

## Milestones

- ✅ **0.3.13 Platform-Agnosticism** — Phases 1–2 (shipped 2026-05-15) — [archive](./milestones/0.3.13-ROADMAP.md)
- 🚧 **0.4.0 Design System** — Phases 3–5 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (3, 4, 5): Planned milestone work (numbering continues from 0.3.13)
- Decimal phases (e.g. 3.1): Urgent insertions (marked INSERTED)

<details>
<summary>✅ 0.3.13 Platform-Agnosticism (Phases 1–2) — SHIPPED 2026-05-15</summary>

- [x] Phase 1: Capability Seam Refactor (3/3 plans) — completed 2026-05-15
- [x] Phase 2: Upload Progress + Milestone Closeout (3/3 plans) — completed 2026-05-15

Full detail: [milestones/0.3.13-ROADMAP.md](./milestones/0.3.13-ROADMAP.md)

</details>

### 🚧 0.4.0 Design System (In Progress)

**Milestone Goal:** Ship a serviceable out-of-box look so agents — blind by design (no browser, no visual iteration loop) — produce decent apps without human intervention. The framework guarantees the baseline because the only entity that could compensate (the app-building agent) cannot see its output. Appearance is 100% CSS (untouched override seam); layout *intent* enters the wire as one preset enum on existing containers (the 0.4.0-forcing wire-format change), with the default value byte-identical to today's vertical flow.

- [x] **Phase 3: Default Design System** - Shipped stylesheet delivers page shell, spacing/type scale, density knob, card section variant — zero app CSS, override seam unchanged (completed 2026-05-17)
- [ ] **Phase 4: Preset-Grid Layout** - One optional layout-preset enum on `page`/`section`, default = today's vertical flow, round-trips byte-identically across .NET/TS backends + new parity fixture
- [ ] **Phase 5: Canonical Examples + 0.4.0 Release Closeout** - Showcase/demos on the shipped stylesheet (no per-demo `<style>` chrome), AGENTS.md docs, aligned 0.4.0 npm+NuGet bump, full parity green, MIGRATION/CHANGELOG, tests green

## Phase Details

### Phase 3: Default Design System
**Goal**: An app that imports only the shipped stylesheet and renders `.vms-*` nodes gets a serviceable, coherently-spaced page with no app-authored CSS — and the existing CSS-variable / alternate-theme override seam still fully reskins the UI with no behavior change.
**Depends on**: Phase 2 (0.3.13 baseline — parity green, capability seam shipped)
**Requirements**: THEME-01, THEME-02, THEME-03, THEME-04, THEME-05
**Success Criteria** (what must be TRUE):
  1. An app importing only the shipped stylesheet renders a centered, max-width page with responsive horizontal padding and zero app-authored CSS (THEME-01).
  2. A page composing form + table + stat-bar + section shows one coherent spacing scale and type scale with no per-app tuning (THEME-02).
  3. Setting a page density value (`comfortable` | `compact`) visibly changes global spacing / control sizing with no app CSS (THEME-03).
  4. A `section` with `variant: "card"` renders a visually grouped surface (background, border, padding, radius) (THEME-04).
  5. Overriding `:root` CSS variables / swapping the shipped theme file fully reskins the UI without editing rules — regression-guarded, no override-seam behavior change (THEME-05).
**Plans**: 3 plans
  - [x] 03-01-PLAN.md — Scale tokens + literals→variables + centered shell + D-17 AA fix (THEME-01, THEME-02, THEME-05)
  - [x] 03-02-PLAN.md — Additive PageNode.density?/SectionNode.variant? closed-union fields, TS + .NET (THEME-03, THEME-04)
  - [x] 03-03-PLAN.md — Renderer emission + .vms-page--compact/.vms-section--card CSS + jsdom tests + parity regression + AGENTS.md tables (THEME-03, THEME-04, THEME-05)
**UI hint**: yes

### Phase 4: Preset-Grid Layout
**Goal**: `page` and `section` accept one optional layout-preset enum that arranges their direct children; the default value renders byte-identically to today's vertical stack (non-breaking, no new node types), the preset is the only layout field on the wire, and it round-trips identically across the .NET and TS backends with a new parity fixture covering it.
**Depends on**: Phase 3 (presets arrange children *within* the shipped design system's spacing/grid; the design-system rhythm must exist before layout composes on top of it)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LAYOUT-05
**Success Criteria** (what must be TRUE):
  1. With the layout-preset omitted/defaulted, `page`/`section` render byte-identically to current vertical-stack output — no new node types, existing apps unchanged (LAYOUT-01).
  2. The "split" preset lays children in columns on wide viewports and collapses to stacked on narrow viewports, with no app-specified breakpoints (LAYOUT-02).
  3. The "cards" preset auto-fits children from a single min-item-width value and collapses to one column on narrow screens (LAYOUT-03).
  4. The wire carries only the layout-preset enum — no spans, tracks, or named areas cross the contract (LAYOUT-04).
  5. The layout-preset field is present in `src/index.ts`, `src/server.ts`, all 5 demo `ViewModels.cs` copies + the NuGet source, and a new parity fixture exercises it with .NET/Bun/Node byte-identical (LAYOUT-05).
**Plans**: TBD
**UI hint**: yes

### Phase 5: Canonical Examples + 0.4.0 Release Closeout
**Goal**: Showcase and every demo render on the shipped stylesheet with zero hand-rolled page chrome and a Bootstrap-benchmarked canonical reference set; AGENTS.md documents presets/density/card so an agent can use them from docs alone; and 0.4.0 ships with npm+NuGet aligned, the full cross-backend parity suite green (incl. the new layout fixture), MIGRATION/CHANGELOG written, and all tests green plus new jsdom unit tests for the new behavior.
**Depends on**: Phase 4 (demos can only switch to the shipped stylesheet once theme + layout exist; RELEASE-02 parity gate must include the Phase 4 layout fixture)
**Requirements**: EXAMPLES-01, EXAMPLES-02, EXAMPLES-03, RELEASE-01, RELEASE-02, RELEASE-03, RELEASE-04
**Success Criteria** (what must be TRUE):
  1. Showcase renders a canonical reference set (≥ dashboard, form-heavy page, list/detail) using only `.vms-*` nodes + the shipped stylesheet, visually serviceable benchmarked against Bootstrap's example pages (EXAMPLES-01).
  2. Every demo app imports the shipped stylesheet and contains zero hand-rolled per-demo `<style>` page chrome (EXAMPLES-02).
  3. AGENTS.md documents the layout presets, density control, and card variant with the node table + CSS-class table updated, usable from docs alone (EXAMPLES-03).
  4. npm `@ashley-shrok/viewmodel-shell` and NuGet `AshleyShrok.ViewModelShell` ship aligned at `0.4.0`, and MIGRATION.md + CHANGELOG document the additive layout preset (default = prior behavior, non-breaking) + theme/density/card additions + "existing apps render unchanged unless they opt in" (RELEASE-01, RELEASE-03).
  5. The full cross-backend parity suite is green across all fixtures + backends including the new layout-preset fixture, existing unit tests stay green, and new jsdom unit tests cover layout presets / density / card variant with no browser runtime (RELEASE-02, RELEASE-04).
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Milestone | Plans | Status | Completed |
|---|---|---|---|---|
| 1. Capability Seam Refactor | 0.3.13 | 3/3 | Complete | 2026-05-15 |
| 2. Upload Progress + Closeout | 0.3.13 | 3/3 | Complete | 2026-05-15 |
| 3. Default Design System | 0.4.0 | 3/3 | Complete    | 2026-05-17 |
| 4. Preset-Grid Layout | 0.4.0 | 0/TBD | Not started | - |
| 5. Canonical Examples + 0.4.0 Closeout | 0.4.0 | 0/TBD | Not started | - |
