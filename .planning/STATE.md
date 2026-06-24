---
gsd_state_version: 1.0
milestone: v1.12
milestone_name: Layout System Completeness
status: roadmapped
last_updated: "2026-06-24T21:30:00.000Z"
last_activity: 2026-06-24
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 8 — Alignment Enums + Layout Policy (not started)
Plan: —
Status: Roadmapped — awaiting phase planning
Last activity: 2026-06-24 — Roadmap created for milestone v1.12 (Phases 8–11)

### Milestone Reference

**Core value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end, and drivable end-to-end by an agent reading only the JSON the server emits.

**Current focus:** Finish the layout vocabulary (alignment enums, `switcher`, `cards minItem`, `fits`) under two hard gates — P1 intrinsic/zero-viewport-breakpoint responsiveness, P2 closed-enum/bounded-scalar knobs — each primitive shipped lockstep npm + NuGet, capped by human-reviewed demo verification.

**Phase map (Phases 8–11, granularity: coarse):**

| Phase | Goal | Requirements |
|-------|------|--------------|
| 8 — Alignment Enums + Layout Policy | `arrange`/`align` enums on `row` + AGENTS.md layout policy; ships first to unblock PBMInvoices | ALIGN-01..04, POLICY-01 |
| 9 — Switcher + Cards minItem | `switcher` primitive + `minItem` wire field on `cards` | SWITCH-01..03, GRID-01..02 |
| 10 — Fits Node | `fits` responsive-selection node + TUI degradation | FITS-01..03 |
| 11 — Demo Verification Spread + Closeout | Demo apps verifying every layout + 2 real-app compositions + operator sign-off + docs/release gate | DEMO-01..03, POLICY-02, RELEASE-01..02 |

**Cross-cutting per phase (baked into success criteria, not separate phases):** two-backend TS/.NET byte-parity with `[JsonIgnore(WhenWritingNull)]` on nullable wire fields + `bun run parity/run.ts` green; P1 + P2 as hard gates; lockstep npm + NuGet release.

## Accumulated Context

### Decisions
- Phase numbering continues sequentially from the prior milestone (ended Phase 7) → v1.12 starts at Phase 8. No reset.
- 4 phases at coarse granularity: Phase 8 ships standalone first (unblocks external consumer); Phases 9 and 10 add primitives; Phase 11 is the human-reviewed verification centerpiece + closeout.
- Each implementation phase (8/9/10) ships its own minimal demo/Showcase entry + parity fixture + lockstep release; Phase 11 is the comprehensive visual spread, real-app compositions, and human sign-off.

### Todos
- (none yet — first phase to plan is Phase 8)

### Blockers
- (none)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260608-2fa | Fix issue #17: section layout cards/split collapses to single column due to CSS cascade ordering; add min-width:0 to grid children; add regression test; bump 1.0.0->1.0.1; update CHANGELOG | 2026-06-08 | 8d84f59 | [260608-2fa-fix-issue-17-section-layout-cards-split-](./quick/260608-2fa-fix-issue-17-section-layout-cards-split-/) |
| 260613-qmh | Restore TableRow.action row-click + fix mixed-type row.actions renderer; HelpDesk demo migration; full keyboard + ARIA; lockstep npm + NuGet 1.1.0 release | 2026-06-13 | b9f7f19 | [260613-qmh-restore-tablerow-action-row-click-fix-mi](./quick/260613-qmh-restore-tablerow-action-row-click-fix-mi/) |
| 260613-w4z | Add SectionNode.collapsible — client-side disclosure primitive via native &lt;details&gt;/&lt;summary&gt;; open state preserved across re-renders via existing draft-preservation seam; HelpDesk Agent Notes demo; lockstep npm + NuGet 1.2.0 release | 2026-06-13 | 766902a | [260613-w4z-add-sectionnode-collapsible-client-side-](./quick/260613-w4z-add-sectionnode-collapsible-client-side-/) |
| 260614-bmd | Add SectionNode.link — URL-wrapper clickable cards that preserve native browser link affordances (middle-click, Ctrl/Cmd-click, drag-to-bookmarks, status-bar URL, right-click context menu) via `<a href>` wrapper; mutually exclusive with .action and .collapsible; nested-anchor and click-ownership combos rejected by tree validation; FeatureProbe parity coverage + Showcase Resources demo; issue #21; lockstep npm 1.5.0 + NuGet 1.4.0 release | 2026-06-14 | 99804c9 | [260614-bmd-issue-21-sectionnode-url-link-variant-cl](./quick/260614-bmd-issue-21-sectionnode-url-link-variant-cl/) |

## Session Continuity

Roadmap for v1.12 written (`.planning/ROADMAP.md`), REQUIREMENTS.md traceability filled, STATE.md updated. Next step: `/gsd:plan-phase 8`.
