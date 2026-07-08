# Requirements: ViewModel Shell — Milestone v4.1 Data Visualization

**Defined:** 2026-07-04
**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end, and drivable end-to-end by an agent reading only the JSON the server emits.

This milestone adds VMS's first data-visualization primitive: a **structured `ChartNode`** whose payload is bounded declared data (a numeric series + labelled categories), rendered by **Chart.js behind the browser adapter** as a private implementation detail. It closes GitHub issue #6 (the lone open issue). Design was settled with the operator ahead of planning (a design session + a live tailnet comparison of frappe-charts / Chart.js / ApexCharts / hand-drawn SVG). Additive, no wire break — the protocol token stays `viewmodel-shell/1.0`.

**Locked design principles every requirement must satisfy:**
- **(D1) Structured, not an escape hatch.** The ChartNode carries bounded declared data (numeric series + labelled categories) an agent reads directly; parity diffs the DATA, not the pixels. A general "raw content / embed anything" node is explicitly REJECTED (the absence of an escape hatch is the product; agents would reach for it as least-resistance).
- **(D2) Library behind the adapter.** Chart.js is a PRIVATE implementation detail of the browser adapter (apps never touch it, same as the adapter using the DOM). The core (`src/index.ts`) and the .NET/bun backends stay dependency-free — they only EMIT ChartNode data; only the browser renders pixels.
- **(D3) Closed appearance, never raw CSS.** Chart appearance is `title` + the existing `tone` axis (danger/warning/success/info) only — no raw hex, no CSS, no arbitrary axis/tooltip config.

---

## v1 Requirements

### Chart primitive
- [ ] **CHART-01**: A `ChartNode` renders a single-series **bar** chart (labelled categories × numeric values) from structured wire data — the series/categories are declared, agent-legible fields, not opaque pixels.
- [ ] **CHART-02**: Chart appearance is limited to an optional `title` and a `tone` drawn from the existing tone axis (`danger | warning | success | info`) mapped to the theme's `--vms-*` tone tokens. No raw color/CSS/axis/tooltip config crosses the wire (D3).
- [ ] **CHART-03**: When the server returns a new view tree with updated chart data, the adapter **redraws the chart in place** (re-render on view update — the standard VMS control→server→redraw loop), via Chart.js's native update path.
- [ ] **CHART-04**: **Chart.js is a lazy/optional dependency of the browser package** — loaded only when a `ChartNode` is present (the optional-subpath pattern used by `@ashley-shrok/viewmodel-shell/vite`), tree-shaken to the registered controllers (bar first). Apps that render no chart pay zero chart bytes; the core + .NET/bun backends gain no dependency (D2).
- [ ] **CHART-05**: The `ChartNode` lands byte-identically in TS (`src/index.ts` + `browser.ts`) and .NET (`ViewModels.cs` record + `[JsonDerivedType]` discriminator, every nullable wire field carrying `[JsonIgnore(WhenWritingNull)]`); **both** tree-validators descend into it (no fits-node-style blind spot); a `parity/` fixture (FeatureProbe) exercises it and `bun run parity/run.ts` is byte-identical green (data diffed, not pixels). The TUI adapter has a defined legible degradation (e.g. printed series / ASCII bars) so it doesn't break the non-browser target.

### Verification & release
- [ ] **CHART-06**: The operator personally reviews the rendered chart in a browser (served over the tailnet) and signs off — a chart is visual, so verification is by human review, not assumed. `agent-skill.md` documents the `ChartNode` for wire-driving agents, byte-copied to the .NET `AgentSkill.md` (the parity gate diffs both).
- [ ] **CHART-07**: Aligned additive **minor** release on both packages (npm + NuGet `4.1.0`) with CHANGELOG + MIGRATION, git tag, `main` advanced (verified `git merge-base --is-ancestor`), full green-tree gate at release time, `#vms-changelog` announcement, and GitHub issue #6 closed. Wire protocol token stays `viewmodel-shell/1.0`.

### Non-blocking actions (v4.2) — design of record `.planning/design/non-blocking-actions.md`
- [x] **NBA-01**: A dispatch can carry `blocking: false` (optional; default `true` → existing apps byte-unchanged). A non-blocking (silent) round-trip no longer occupies the single global dispatch mutex: a user action fired while a non-blocking round-trip is in flight is honored, not silently dropped, and vice versa. _(Gap-closed: CR-01 coalesce-refire misclassification + CR-02 non-lane-aware epoch fixed and re-verified — 14-VERIFICATION.md passed 4/4; refire replays its own {action,silent}, blocking responses are authoritative and always apply.)_
- [x] **NBA-02**: Rapid `blocking:false` triggers debounce/coalesce to a single in-flight request (latest wins) — the rapid-fire selection case never queues N round-trips.
- [x] **NBA-03**: A stale / out-of-order non-blocking response is discarded rather than clobbering a newer render, via a **client-side** sequence/epoch counter — NO wire epoch field, NO server-side reconciliation state, server code unchanged beyond handling the (normal) action name.
- [x] **NBA-04**: `blocking` is absent-when-default on BOTH backends. ⚠️ Because `blocking`'s default is `true` (inverted polarity from the usual false-default bools), the correct .NET pattern is `bool?` + `WhenWritingNull` (NOT the F2 `WhenWritingDefault`, which drops on `false` and would omit the meaningful value while emitting the default) — byte-aligned with the TS `blocking?: boolean` (omit=true; explicit `false` serializes). The wire token stays `viewmodel-shell/1.0`; `bun run parity/run.ts` is byte-identical green with a static wire-shape fixture proving `blocking`'s presence/absence. (NBA-02/NBA-03's client-only mechanics are verified by vitest, not parity — they have no wire signal.)
- [x] **NBA-05**: `pollInterval` runs its polls over the non-blocking path so the poll/user-action contention is gone — a user action clicked during a poll round-trip is honored, not dropped.
- [x] **NBA-06**: Per-checkbox/table-selection server-refresh works correctly: the box checks immediately (optimistic local `bind` write) AND fires a `blocking:false` action whose returned tree echoes selection back, so a stale response can never revert a rapid toggle (the 0.15.0 `selection.action` failure is fixed).
- [ ] **NBA-07**: `agent-skill.md` documents `blocking:false` semantics for wire-driving agents and is byte-identical to the .NET `AgentSkill.md` (parity gate diffs both).
- [ ] **NBA-08**: Three purpose-built demo apps (selection→live action bar; poll+user coexistence contrast; out-of-order staleness), each with a step-by-step "trigger X, then Y, expect Z" script, served over the tailnet; the operator signs off that rapid-toggle, poll-coexistence, and staleness behave as specified — this is a concurrency/timing feature, verified by human review, not assumed.
- [ ] **NBA-09**: Aligned additive **minor** release on both packages (npm + NuGet) with CHANGELOG + MIGRATION, git tag, `main` advanced (verified `git merge-base --is-ancestor`), full green-tree gate at release time, `#vms-changelog` announcement. Wire token stays `viewmodel-shell/1.0`.
- [ ] **NBA-10** (CONDITIONAL — Phase 17, only if intent-drift is reported): a blocking action whose target node changed under an in-flight non-blocking round-trip is not dispatched with stale intent (hold + full-node-diff at departure; drop on any difference); the dropped-action outcome is surfaced, not silently swallowed.

---

## Future Requirements (deferred — not this milestone)

- **CHART-LINE**: A `line` chart type (ordered / time-ish series) — the natural second type; pull in when a real consumer needs it.
- **CHART-MULTI**: Multi-series charts (grouped/stacked bars, multiple lines) with the legend/per-series color surface that implies — deferred until a real consumer need justifies the added surface.
- **CHART-PIE**: Pie/donut — less agent-legible (parts-of-a-whole), more decorative; deferred.

## Out of Scope (explicit exclusions)

- **A general raw-content / embed / iframe node.** Rejected on principle (D1): an "put anything here" node is invisible to agents, browser-only, and erodes the discipline that makes VMS drivable. The sanctioned valve for genuinely un-expressible content is a separate non-VMS page reached via `LinkNode` (the existing vault `/upload-page` pattern), never a tree node.
- **Raw color / CSS / arbitrary axis-tick / tooltip configuration on the wire** (D3). If a needed appearance can't be expressed by `title` + `tone`, that's a gap to discuss, not a raw-style escape hatch.
- **Exposing Chart.js (its config objects, plugins, or instance) to apps.** The library is an adapter implementation detail (D2); an app that could pass Chart.js config would be authoring browser-only, un-testable UI.

---

## Traceability

| REQ-ID | Phase |
|--------|-------|
| CHART-01 | 12 |
| CHART-02 | 12 |
| CHART-03 | 12 |
| CHART-04 | 12 |
| CHART-05 | 12 |
| CHART-06 | 13 |
| CHART-07 | 13 |
| NBA-01 | 14 |
| NBA-02 | 14 |
| NBA-03 | 14 |
| NBA-04 | 14 |
| NBA-05 | 15 |
| NBA-06 | 15 |
| NBA-07 | 15 |
| NBA-08 | 16 |
| NBA-09 | 16 |
| NBA-10 | 17 |

---

*Milestone: v4.1 Data Visualization*
*Requirements defined: 2026-07-04*
