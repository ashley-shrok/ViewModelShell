# Roadmap: ViewModel Shell

## Milestones

- ✅ **0.3.13 Platform-Agnosticism** — Phases 1–2 (shipped 2026-05-15) — [archive](./milestones/0.3.13-ROADMAP.md)
- ✅ **0.4.0 Design System** — Phases 3–5 (shipped 2026-05-18; npm + NuGet 0.4.1)
- ✅ **1.0.0 Truly Self-Describing Wire** — Phases 6–7 (shipped 2026-06-08; npm + NuGet 1.0.0)
- ✅ **v1.12 Layout System Completeness** — Phases 8–11 (shipped 2026-06-24; npm 1.12.0 / NuGet 1.10.0)
- 🚧 **v4.1 Data Visualization** — Phases 12–13 (in progress) — `ChartNode` primitive, closes issue #6 (ships npm + NuGet 4.1.0)

**Post-v1.12 interstitial releases** (not phased milestones — direct feature commits + CHANGELOG, the same cadence as the 1.7–1.11 interstitials): **2.0.0** remove `SectionNode.flyout` (BREAKING), **2.1.0** `LinkNode.active`, **3.0.0** unified appearance axes (BREAKING — `variant` split into `tone`/`emphasis`/`size`/`state`/`style`), **3.0.1**/**3.0.2** CSS-only fixes, **3.1.0** admin-shell primitives (`ButtonNode.width`, `DividerNode`, `FormNode.submitButton`). Both registries currently at **3.1.0** (2026-06-26). See [CHANGELOG.md](../CHANGELOG.md) for the authoritative per-version history.

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

<details>
<summary>✅ v1.12 Layout System Completeness (Phases 8–11) — SHIPPED 2026-06-24</summary>

- [x] Phase 8: Alignment Enums + Layout Policy (2/2 plans) — completed 2026-06-24
- [x] Phase 9: Switcher + Cards minItem (2/2 plans) — completed 2026-06-24
- [x] Phase 10: Fits Node (2/2 plans) — completed 2026-06-24
- [x] Phase 11: Demo Verification Spread + Milestone Closeout — completed 2026-06-24

Shipped as one consolidated additive release (npm `1.12.0` / NuGet `1.10.0`): alignment enums (`arrange`/`align`), the `switcher` primitive, the `cards` `minItem` field, and the `fits` node — governed by the new Layout policy (AGENTS.md), grounded in `.planning/design/layout-system-research.md`. The whole vocabulary was human-verified in a browser before release (two real bugs — switcher always-stacked, fits always-first — were caught and fixed). Full detail: CHANGELOG `1.12.0 / 1.10.0` + phase artifacts under [.planning/phases/](./phases/) (08–11).

</details>

### 🚧 v4.1 Data Visualization (Phases 12–13) — IN PROGRESS

**Milestone Goal:** Add VMS's first data-visualization primitive — a structured `ChartNode` (bar, single-series, `title` + `tone`) whose payload is bounded declared data (a numeric series + labelled categories), rendered by Chart.js behind the browser adapter as a private implementation detail. Closes GitHub issue #6 (the lone open issue). Additive; the wire protocol token stays `viewmodel-shell/1.0`. Ships as an aligned minor (npm + NuGet `4.1.0`).

- [ ] **Phase 12: ChartNode Primitive** — Structured bar `ChartNode` across both backends + `browser.ts` renderer via lazy/optional Chart.js + both tree-validators + TUI degradation + `agent-skill.md` + parity/FeatureProbe + adapter/backend tests
- [ ] **Phase 13: Data-Viz Verification + Release Closeout** — Operator browser sign-off on the rendered chart, CHANGELOG/MIGRATION, aligned `4.1.0` npm+NuGet release, tag, advance `main`, announce `#vms-changelog`, close issue #6

## Phase Details

### Phase 12: ChartNode Primitive
**Goal**: A `ChartNode` renders a single-series bar chart (labelled categories × numeric values, `title` + `tone`) from structured wire data — declared and agent-legible, drawn by Chart.js as a private browser-adapter detail (lazy/optional dependency; core + .NET/bun backends stay dependency-free), redrawing in place on new server data, byte-identical across TS/.NET with BOTH tree-validators descending into it and parity/FeatureProbe green, plus a legible TUI degradation. Appearance is `title` + `tone` only — no raw CSS/config on the wire.
**Depends on**: Phase 11 (v1.12 baseline — parity green; current release 4.0.0)
**Requirements**: CHART-01, CHART-02, CHART-03, CHART-04, CHART-05
**Success Criteria** (what must be TRUE):
  1. A `ChartNode` carrying labelled categories + a numeric series renders a single-series bar chart in the browser, colored by its `tone` axis value, with an optional title (CHART-01, CHART-02).
  2. Returning a new view tree with changed chart data redraws the chart in place — no full-page reload (CHART-03).
  3. An app that renders no `ChartNode` ships zero Chart.js bytes; the core (`src/index.ts`) and the .NET/bun backends gain no dependency (CHART-04).
  4. The `ChartNode` round-trips byte-identically across TS + .NET, both tree-validators descend into it, and `bun run parity/run.ts` is green with a FeatureProbe fixture exercising it (CHART-05).
  5. The TUI adapter renders a defined legible fallback for a `ChartNode` (printed series / ASCII bars) instead of crashing (CHART-05).
**Plans**: TBD (set by `/gsd:plan-phase 12`)
**UI hint**: yes

### Phase 13: Data-Viz Verification + Release Closeout
**Goal**: The rendered chart is human-verified in a browser and the milestone ships as an aligned additive minor (npm + NuGet `4.1.0`) with docs, git tag, `main` advanced, `#vms-changelog` announcement, and GitHub issue #6 closed — full green-tree gate at release time.
**Depends on**: Phase 12 (the `ChartNode` must exist to review and release)
**Requirements**: CHART-06, CHART-07
**Success Criteria** (what must be TRUE):
  1. The operator reviews the rendered `ChartNode` in a real browser (served over the tailnet) and signs off (CHART-06).
  2. `agent-skill.md` documents the `ChartNode` and is byte-identical to the .NET `AgentSkill.md` (parity gate green) (CHART-06).
  3. npm + NuGet `4.1.0` are published, tagged `v4.1.0`, with `main` advanced (verified `git merge-base --is-ancestor`) and `#vms-changelog` announced (CHART-07).
  4. GitHub issue #6 is closed with a comment citing the `4.1.0` release (CHART-07).
**Plans**: TBD (set by `/gsd:plan-phase 13`)
**UI hint**: no
