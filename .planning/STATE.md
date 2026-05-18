---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 05-03-PLAN.md
last_updated: "2026-05-18T05:02:55.472Z"
last_activity: 2026-05-18
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 13
  completed_plans: 10
  percent: 77
---

# Project State: ViewModel Shell

## Project Reference

**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end.
**Current Milestone:** 0.4.0 Design System (Phases 3–5)
**Current Focus:** Phase 05 — canonical-examples-0-4-0-release-closeout

---

## Current Position

Phase: 05 (canonical-examples-0-4-0-release-closeout) — EXECUTING
Plan: 4 of 6
Status: Ready to execute
Last activity: 2026-05-18

Progress: [█░░░░░░░░░] 1 of 6 plans (Phase 05)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases total (0.4.0) | 3 (Phases 3–5) |
| Phases complete (0.4.0) | 0 |
| Requirements total (0.4.0) | 17 |
| Requirements complete | 0 |
| Parity suite status | Green at 0.3.13 baseline (7/7 fixtures) — must stay green through 0.4.0; Phase 4 adds a new layout fixture, Phase 5 RELEASE-02 gates on full suite green |
| Phase 03 P01 | 6min | 3 tasks | 1 files |
| Phase 03 P02 | 13min | 2 tasks | 2 files |
| Phase 03 P03 | 4min | 3 tasks | 4 files |
| Phase 05 P01 | 15min | 3 tasks | 5 files |
| Phase 05 P02 | 10min | 3 tasks | 2 files |
| Phase 05 P03 | 9min | 2 tasks | 14 files |

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
- [03-01] Spacing scale: 6 steps base xs=0.5rem modular ~1.5; type scale: 7 all-rem steps base 0.8125rem modular ~1.2 (UI-SPEC, D-06/07/09) — scale-as-variables is the prerequisite for the Plan 02 density remap (D-10)
- [03-01] D-17 WCAG-AA fix: --vms-text-muted #6b6b80 → #9090a8 is the ONLY allowed default-value change; THEME-05 sacred seam held (every other :root name/value byte-identical, 11 theme files byte-unchanged); parity 7/7 unchanged (CSS has no wire surface)
- [03-02] PageNode.density?/SectionNode.variant? added as additive optional CLOSED unions (D-03) on TS index.ts + .NET ViewModels.cs, structurally aligned (D-05); omitted ⇒ byte-identical wire proven by parity 7/7 (D-01 non-breaking); no version bump (Phase 5 RELEASE-01 owns the aligned 0.4.0); no renderer/CSS here (Plan 03 owns emission)
- [05-01] default.css :root re-based dark→light onto the light-purple value set (D-01); prior dark default captured byte-exact in themes/dark-purple.css (D-02); 11 prior theme files byte-identical (D-03); standalone check-aa-contrast.mjs WCAG-AA CI guard gated in parity.yml beside core-globals (D-07/D-25); color-literal audit verdict = pure :root swap (D-16)
- [05-01] D-01 ↔ D-07 locked-decision conflict resolved (user-approved, D-17 precedent): default.css :root --vms-warning #c89610 → #a37510 (ONLY this one value) so the shipped light default clears the WCAG-AA non-text floor (4.11/3.84/3.62:1 vs surface/bg/surface-2, was 2.68/2.51/2.36:1); 17 other colors + --vms-color-scheme verbatim light-purple; themes/light-purple.css + 11 theme files + dark-purple.css byte-unchanged. **Plan 05-05 (MIGRATION/CHANGELOG, D-05/D-26) MUST document this one-variable tighten alongside the dark→light flip**
- [05-02] Showcase = navigable canonical set: top-level tabs nav (D-09) over the preserved kitchen-sink gallery + Dashboard(cards+section variant:card)/Form-heavy(stack)/List-detail(split) archetypes on the LOCKED Bootstrap-benchmarked mapping (D-10/D-13 — Dashboard↔"Dashboard", Form-heavy↔"Checkout", List/detail↔"Album"); .vms-*-only, zero per-view <style>, no new wire/node/CSS/token. EXAMPLES-01 complete
- [05-02] Switcher remapped (real dark-purple entry → darkPurpleCss, no empty-string slot, light-purple boot — D-06) and scoped to the gallery via an explicit state.view==="components" guard (D-14 statically falsifiable); Form-heavy=stack (UI-SPEC default, NOT split-aside); Showcase index.html de-chromed to the minimal zero-<style> scaffold adopting the shipped 1080px shell with NO per-app token file (D-15) — this is the canonical minimal-scaffold shape Plan 05-03 replicates for the 7 non-Showcase demo HTML files (disjoint file sets). Pre-existing *.css?inline tsc declaration gap logged to deferred-items.md (out of scope, D-21; candidate for Plan 06 hygiene pass)
- [05-03] 7 non-bun demo HTML de-chromed to zero-<style> scaffolds (mirrors 05-02 Showcase pattern); each pins one distinct shipped theme via its TS entrypoint (Tasks=dark-purple the demoted file, CM=light-blue, ET=light-green, RB=light-amber, HelpDesk agent=dark-blue/requester=light-teal via the seam — no inline :root); RB sole sanctioned --vms-page-max retune in src/app-tokens.css after the theme (D-08/D-15/D-17/D-18/D-19). EXAMPLES-02 complete
- [05-03] HelpDesk landing kept a static HTML page (no JS ViewModelShell entrypoint for a static 2-link picker — disproportionate); re-expressed via only shipped .vms-* classes + a one-line inline module script importing styles.css+light-teal, zero <style>/zero non-vms vars. Dropped functional overrides (horizontal forms, dispatch-dim, CM scrollbar, ET heading/spinner/tint) render shipped default and logged deferred in deferred-items.md — explicitly NO new wire (D-16)

### Architectural Notes (0.4.0 Design System)

- Appearance (color/type/spacing/borders/density) = 100% CSS, untouched override seam (THEME-05 is a regression guard, no override-seam behavior change). Arrangement (layout intent) = server-emitted, lives in the wire.
- Preset-grid: ONE grid-backed layout enum on EXISTING `page`/`section` nodes. No new node types. No spatial geometry/spans in the wire (LAYOUT-04). Default value = today's vertical flow, byte-identical (LAYOUT-01).
- Wire-format change ⇒ 0.4.0 minor bump, npm + NuGet aligned; all 5 `ViewModels.cs` copies sync; new parity fixture (LAYOUT-05); cross-backend parity must stay green (RELEASE-02).
- Agent-familiarity principle: canonical good-looking examples (Showcase + demos on the shipped stylesheet) are the highest-leverage quality lever, benchmarked against Bootstrap example pages (benchmark only, not a dependency).
- Deferred (Out of Scope, tracked): image node #5, chart/data-viz #6, LAYOUT-F1 fixed-N-column (v2).

### Blockers

()

- ~~Phase 5 Plan 01 Task 3: D-01 vs D-07 conflict (--vms-warning #c89610 = 2.68:1 < 3.0:1 AA floor)~~ — **RESOLVED 2026-05-18** (user-approved, D-17 precedent): default.css :root --vms-warning → #a37510, 11/11 AA PASS, parity.yml gates check:aa-contrast. Plan 05-01 complete (32baaae, de2f497, c79a843, 6f601e4).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260515-gru | Add CopyButtonNode (copy text to clipboard) | 2026-05-15 | 8c8498c | [260515-gru-add-copybuttonnode-copy-text-to-clipboar](./quick/260515-gru-add-copybuttonnode-copy-text-to-clipboar/) |

### TODOs

- (Cleared — all 0.3.13 plan TODOs completed and shipped. Full history in `.planning/milestones/0.3.13-phases/`.)
- 0.4.0: roadmap done. Next: `/gsd-plan-phase 3` (Default Design System).

---

## Session Continuity

**Last session:** 2026-05-18T05:02:55.443Z
**Stopped at:** Completed 05-03-PLAN.md
**Next action:** Execute Plan 05-02 (Phase 5, plan 2 of 6).

---

*State initialized: 2026-05-15*
*Last updated: 2026-05-17 — roadmap created for milestone 0.4.0 (Phases 3–5, 17/17 requirements mapped). Ready to plan Phase 3.*
