---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-15T12:27:38.722Z"
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 3
  completed_plans: 1
  percent: 33
---

# Project State: ViewModel Shell

## Project Reference

**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end.
**Current Milestone:** Restore & Enforce Core Platform-Agnosticism
**Current Focus:** Phase 01 — Capability Seam Refactor

---

## Current Position

Phase: 01 (Capability Seam Refactor) — EXECUTING
Plan: 2 of 3 (01-01 complete)
**Phase:** 1 — Capability Seam Refactor
**Plan:** 01-01 complete — next: 01-02 (CI guard + adapter-level jsdom test, D-12 gate)
**Status:** Executing Phase 01

```
Progress: [ Phase 1 ███░░░░░░░ ][ Phase 2 ░░░░░░░░░░ ]
           33%                                         100%
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases total | 2 |
| Phases complete | 0 |
| Requirements total | 6 |
| Requirements complete | 0 |
| Parity suite status | Green (pre-refactor baseline) |

---
| Phase 01 P01 | 3min | 3 tasks | 2 files |

## Accumulated Context

### Key Decisions Logged

- Capability seam over per-feature browser hooks — generic verbs (navigate/storage/transport) let any future front-end pick up redirect/side-effects/progress automatically; restores the core invariant the framework already claims
- 2 sequential phases, zero quicks — Phase 1 = refactor (no behavior change, parity-verifiable); Phase 2 = feature through the seam, depends on Phase 1. Quicks skip the verification gates this work centers on
- Upload progress built through the seam, not bolted on — avoids a third core platform violation; makes issue #4 the first feature done right
- Consumer migration blurb is a first-class milestone deliverable — downstream maintainers (multiple apps) must know what/whether to update
- [01-01] 3 core platform-global violations relocated behind optional Adapter verbs (navigate/storage/transport); fail-loud on missing capability (D-06); index.ts now references zero platform globals; onRedirect signature/precedence byte-identical (D-04/D-05); in-core fetch untouched (D-07)

### Architectural Notes

- Drift being corrected: src/index.ts directly calls window.location.href (redirect), localStorage/sessionStorage (side-effects, no override hook). This violates the framework's stated "core never references platform types" invariant.
- Risk is low: the wire contract is parity-covered by FeatureProbe fixtures. Refactor moves WHERE the browser binding executes, not WHAT the protocol does.
- Phase 1 verification gate: parity suite 100% green AND CI invariant guard passes.
- Phase 2 constraint: onUploadProgress byte-level progress is browser-runtime only — no parity surface. Unit-testable via mock XHR.

### Blockers

(None)

### TODOs

- Plan 01-02: add the grep-based CI guard (D-08/D-10) AND the adapter-level jsdom/vitest test (D-12.2) — Phase 1 is not done until parity green + the dual gate passes (D-12/D-13)
- Plan 01-03: AGENTS.md + README capability-seam documentation (D-14)

---

## Session Continuity

**Last session:** 2026-05-15T12:27:38.720Z
**Stopped at:** Completed 01-01-PLAN.md
**Next action:** Execute 01-02-PLAN.md

---

*State initialized: 2026-05-15*
*Last updated: 2026-05-15 after roadmap creation*
