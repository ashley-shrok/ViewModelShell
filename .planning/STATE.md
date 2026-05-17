---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Phase 3 UI-SPEC approved
last_updated: "2026-05-17T22:13:09.945Z"
last_activity: "2026-05-17 — Roadmap created: Phases 3–5, 17/17 requirements mapped (THEME→3, LAYOUT→4, EXAMPLES+RELEASE→5)"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: ViewModel Shell

## Project Reference

**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end.
**Current Milestone:** 0.4.0 Design System (Phases 3–5)
**Current Focus:** Phase 3 — Default Design System (shipped stylesheet: page shell, spacing/type scale, density, card variant; override seam unchanged)

---

## Current Position

Phase: 3 of 5 (Default Design System) — 0.4.0's first phase; numbering continues from 0.3.13
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-05-17 — Roadmap created: Phases 3–5, 17/17 requirements mapped (THEME→3, LAYOUT→4, EXAMPLES+RELEASE→5)

Progress: [░░░░░░░░░░] 0%

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases total (0.4.0) | 3 (Phases 3–5) |
| Phases complete (0.4.0) | 0 |
| Requirements total (0.4.0) | 17 |
| Requirements complete | 0 |
| Parity suite status | Green at 0.3.13 baseline (7/7 fixtures) — must stay green through 0.4.0; Phase 4 adds a new layout fixture, Phase 5 RELEASE-02 gates on full suite green |

## Phase Structure (0.4.0)

| Phase | Goal | Requirements | Success Criteria |
|---|---|---|---|
| 3. Default Design System | Shipped stylesheet → serviceable page shell, coherent spacing/type scale, density knob, card section variant; override seam unchanged (regression-guarded) | THEME-01..05 | 5 |
| 4. Preset-Grid Layout | One optional layout-preset enum on `page`/`section`; default = today's vertical flow (byte-identical); only layout field on wire; round-trips .NET/TS + new parity fixture | LAYOUT-01..05 | 5 |
| 5. Canonical Examples + 0.4.0 Closeout | Showcase/demos on shipped stylesheet (no per-demo `<style>`); AGENTS.md docs; aligned 0.4.0 npm+NuGet bump; full parity green; MIGRATION/CHANGELOG; tests green + new jsdom unit tests | EXAMPLES-01..03, RELEASE-01..04 | 5 |

## Accumulated Context

### Key Decisions Logged

- [PROJECT.md] Layout *intent* lives in the model (preset-grid enum on existing containers), not CSS-only — blind agents + non-browser/multi-target adapters can't read CSS; appearance stays 100% CSS, arrangement is server intent
- [PROJECT.md] 0.4.0 minor bump (npm + NuGet aligned) — the same major.minor-alignment rule that kept 0.3.13 a PATCH now *requires* a minor: the layout enum is a wire-format change
- [Roadmap] 3 phases, coarse granularity: theme foundation (no wire change) → layout wire change (the 0.4.0-forcing change) → examples + release closeout (RELEASE-02 parity + RELEASE-04 tests are the concluding gates)
- [Roadmap] Phase 4 depends on Phase 3 (presets arrange children *within* the shipped design-system rhythm); Phase 5 depends on Phase 4 (demos can't switch to shipped stylesheet until theme+layout exist; parity gate must include Phase 4's layout fixture)
- [0.3.13] Capability seam shipped; core references zero platform globals (CI-enforced via check:core-globals); parity is the highest-signal gate — must stay green

### Architectural Notes (0.4.0 Design System)

- Appearance (color/type/spacing/borders/density) = 100% CSS, untouched override seam (THEME-05 is a regression guard, no override-seam behavior change). Arrangement (layout intent) = server-emitted, lives in the wire.
- Preset-grid: ONE grid-backed layout enum on EXISTING `page`/`section` nodes. No new node types. No spatial geometry/spans in the wire (LAYOUT-04). Default value = today's vertical flow, byte-identical (LAYOUT-01).
- Wire-format change ⇒ 0.4.0 minor bump, npm + NuGet aligned; all 5 `ViewModels.cs` copies sync; new parity fixture (LAYOUT-05); cross-backend parity must stay green (RELEASE-02).
- Agent-familiarity principle: canonical good-looking examples (Showcase + demos on the shipped stylesheet) are the highest-leverage quality lever, benchmarked against Bootstrap example pages (benchmark only, not a dependency).
- Deferred (Out of Scope, tracked): image node #5, chart/data-viz #6, LAYOUT-F1 fixed-N-column (v2).

### Blockers

(None)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260515-gru | Add CopyButtonNode (copy text to clipboard) | 2026-05-15 | 8c8498c | [260515-gru-add-copybuttonnode-copy-text-to-clipboar](./quick/260515-gru-add-copybuttonnode-copy-text-to-clipboar/) |

### TODOs

- (Cleared — all 0.3.13 plan TODOs completed and shipped. Full history in `.planning/milestones/0.3.13-phases/`.)
- 0.4.0: roadmap done. Next: `/gsd-plan-phase 3` (Default Design System).

---

## Session Continuity

**Last session:** 2026-05-17T22:13:09.942Z
**Stopped at:** Phase 3 UI-SPEC approved
**Next action:** `/gsd-plan-phase 3` — plan Phase 3: Default Design System (THEME-01..05).

---

*State initialized: 2026-05-15*
*Last updated: 2026-05-17 — roadmap created for milestone 0.4.0 (Phases 3–5, 17/17 requirements mapped). Ready to plan Phase 3.*
