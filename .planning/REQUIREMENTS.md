# Requirements: ViewModel Shell — Milestone 0.4.0 Design System

**Defined:** 2026-05-17
**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end.

**Milestone goal:** Ship a serviceable out-of-box look so agents — blind by design (no browser, no visual iteration loop) — produce decent apps without human intervention. The framework itself must guarantee the baseline because the only entity that could compensate is the blind app-building agent.

## v1 Requirements

Requirements for milestone 0.4.0. Each maps to exactly one roadmap phase (numbering continues from 0.3.13 → starts at Phase 3).

### Theme

- [x] **THEME-01**: An app that imports the shipped stylesheet and renders only `.vms-*` nodes gets a serviceable page shell (centered, max-width container, responsive horizontal padding) with zero app-authored CSS.
- [x] **THEME-02**: The shipped stylesheet applies one coherent spacing scale and type scale across all node types, so a page composing form + table + stat-bar + section has consistent vertical rhythm with no per-app tuning.
- [x] **THEME-03**: A density control on the page (`comfortable` | `compact`) adjusts global spacing / control sizing without app CSS.
- [x] **THEME-04**: `section` accepts `variant: "card"`, rendering a visually grouped surface (background, border, padding, radius).
- [x] **THEME-05**: The existing CSS-variable / alternate-theme override seam still fully reskins the UI via `:root` variables and the shipped theme files without editing rules (regression-guarded — no override-seam behavior change).

### Layout

- [ ] **LAYOUT-01**: `page` and `section` accept an optional layout-preset value that arranges their direct children; the default value renders identically to current vertical-stack behavior (non-breaking, no new node types).
- [ ] **LAYOUT-02**: A side-by-side ("split") preset lays children in columns on wide viewports and collapses to stacked on narrow viewports with no app-specified breakpoints.
- [ ] **LAYOUT-03**: A responsive card-grid ("cards") preset lays children via auto-fit from a single min-item-width value, collapsing to one column on narrow screens.
- [ ] **LAYOUT-04**: The layout preset is the only layout field on the wire — no spans, tracks, or named areas cross the contract.
- [ ] **LAYOUT-05**: The layout-preset field round-trips identically on .NET and TS backends — present in `src/index.ts`, `src/server.ts`, all 5 demo `ViewModels.cs` copies + the NuGet source, and covered by a parity fixture.

### Examples

- [x] **EXAMPLES-01**: Showcase renders a canonical reference set (at least: dashboard, form-heavy page, list/detail) using only `.vms-*` nodes + the shipped stylesheet, visually serviceable benchmarked against Bootstrap's example pages.
- [x] **EXAMPLES-02**: Every demo app imports the shipped stylesheet and contains no hand-rolled per-demo `<style>` page chrome.
- [x] **EXAMPLES-03**: AGENTS.md documents the layout presets, density control, and card variant (node table + CSS-class table updated) so an agent can use them from docs alone.

### Release

- [ ] **RELEASE-01**: npm `@ashley-shrok/viewmodel-shell` and NuGet `AshleyShrok.ViewModelShell` ship aligned at `0.4.0` (wire-format change per the AGENTS.md major.minor-alignment rule).
- [ ] **RELEASE-02**: The full cross-backend parity suite is green (all fixtures, all backends agree) including the new layout-preset field.
- [ ] **RELEASE-03**: MIGRATION.md + CHANGELOG document 0.4.0 — the additive layout preset (default = prior behavior, non-breaking), the theme/density/card additions, and that existing apps render unchanged unless they opt in.
- [ ] **RELEASE-04**: Existing unit tests stay green and new behavior (layout presets, density, card variant) has jsdom unit tests (no browser runtime).

## v2 Requirements

Deferred. Tracked but not in the current roadmap.

### Layout

- **LAYOUT-F1**: Fixed-N-column preset for calendar / scheduling-style grids — deferred; revisit only if a calendar-class app proves vertical-flow and auto-fit insufficient (driven by usage, not speculation, per project discipline).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| `image`/media node ([#5](https://github.com/ashley-shrok/ViewModelShell/issues/5)) | Highest coverage-per-cost content node and zero tension with the no-browser promise, but scoped out to keep 0.4.0 tight on theme + layout + examples. Deferred, not rejected. |
| `chart`/data-viz node ([#6](https://github.com/ashley-shrok/ViewModelShell/issues/6)) | Collides with no-browser-testability + multi-target + parity; needs design (server-rendered SVG vs. declarative ChartNode behind the seam vs. explicit out-of-scope). Likely its own milestone. |
| External CSS framework as a dependency (Bootstrap / Tailwind / Pico) | The `.vms-*` semantic-class contract makes external frameworks a poor fit (they expect utility/component classes or bare semantic HTML); a bridge stylesheet collapses into theme work with added coupling. Bootstrap used only as a visual quality benchmark. |
| Spatial layout utilities (column spans, track templates, named areas, `m-*`/`p-*` utilities, 12-column grid) | Dumps visual 2D reasoning onto a blind agent and explodes the wire contract; the whole point of preset-grid is the agent picks a semantic preset, never authors geometry. |

## Traceability

Which phases cover which requirements. Phase numbering continues from 0.3.13 (Phases 1–2) → 0.4.0 starts at Phase 3.

| Requirement | Phase | Status |
|-------------|-------|--------|
| THEME-01 | Phase 3 | Complete |
| THEME-02 | Phase 3 | Complete |
| THEME-03 | Phase 3 | Complete |
| THEME-04 | Phase 3 | Complete |
| THEME-05 | Phase 3 | Complete |
| LAYOUT-01 | Phase 4 | Pending |
| LAYOUT-02 | Phase 4 | Pending |
| LAYOUT-03 | Phase 4 | Pending |
| LAYOUT-04 | Phase 4 | Pending |
| LAYOUT-05 | Phase 4 | Pending |
| EXAMPLES-01 | Phase 5 | Complete |
| EXAMPLES-02 | Phase 5 | Complete |
| EXAMPLES-03 | Phase 5 | Complete |
| RELEASE-01 | Phase 5 | Pending |
| RELEASE-02 | Phase 5 | Pending |
| RELEASE-03 | Phase 5 | Pending |
| RELEASE-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17 (Phase 3: 5, Phase 4: 5, Phase 5: 7)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-17*
*Last updated: 2026-05-17 — roadmap created: all 17 v1 requirements mapped across Phases 3–5 (THEME→Phase 3, LAYOUT→Phase 4, EXAMPLES+RELEASE→Phase 5).*
