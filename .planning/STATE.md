---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Not started
last_updated: "2026-05-15T12:02:17.284Z"
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: ViewModel Shell

## Project Reference

**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end.
**Current Milestone:** Restore & Enforce Core Platform-Agnosticism
**Current Focus:** Phase 1 — Capability Seam Refactor

---

## Current Position

**Phase:** 1 — Capability Seam Refactor
**Plan:** None started
**Status:** Not started

```
Progress: [ Phase 1 ░░░░░░░░░░ ][ Phase 2 ░░░░░░░░░░ ]
           0%                                          100%
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

## Accumulated Context

### Key Decisions Logged

- Capability seam over per-feature browser hooks — generic verbs (navigate/storage/transport) let any future front-end pick up redirect/side-effects/progress automatically; restores the core invariant the framework already claims
- 2 sequential phases, zero quicks — Phase 1 = refactor (no behavior change, parity-verifiable); Phase 2 = feature through the seam, depends on Phase 1. Quicks skip the verification gates this work centers on
- Upload progress built through the seam, not bolted on — avoids a third core platform violation; makes issue #4 the first feature done right
- Consumer migration blurb is a first-class milestone deliverable — downstream maintainers (multiple apps) must know what/whether to update

### Architectural Notes

- Drift being corrected: src/index.ts directly calls window.location.href (redirect), localStorage/sessionStorage (side-effects, no override hook). This violates the framework's stated "core never references platform types" invariant.
- Risk is low: the wire contract is parity-covered by FeatureProbe fixtures. Refactor moves WHERE the browser binding executes, not WHAT the protocol does.
- Phase 1 verification gate: parity suite 100% green AND CI invariant guard passes.
- Phase 2 constraint: onUploadProgress byte-level progress is browser-runtime only — no parity surface. Unit-testable via mock XHR.

### Blockers

(None)

### TODOs

- Start Phase 1: define the generic capability seam interface, then relocate window.location.href and localStorage/sessionStorage into BrowserAdapter
- Confirm parity suite baseline is green before starting refactor

---

## Session Continuity

**Last session:** 2026-05-15T12:02:17.282Z
**Next action:** `/gsd-plan-phase 1`

---

*State initialized: 2026-05-15*
*Last updated: 2026-05-15 after roadmap creation*
