---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-05-15T12:38:14Z"
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 3
  completed_plans: 2
  percent: 67
---

# Project State: ViewModel Shell

## Project Reference

**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end.
**Current Milestone:** Restore & Enforce Core Platform-Agnosticism
**Current Focus:** Phase 01 — Capability Seam Refactor

---

## Current Position

Phase: 01 (Capability Seam Refactor) — EXECUTING
Plan: 3 of 3 (01-01, 01-02 complete)
**Phase:** 1 — Capability Seam Refactor
**Plan:** 01-02 complete — next: 01-03 (AGENTS.md + README capability-seam docs, D-14)
**Status:** Executing Phase 01

```
Progress: [ Phase 1 ███████░░░ ][ Phase 2 ░░░░░░░░░░ ]
           67%                                         100%
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases total | 2 |
| Phases complete | 0 |
| Requirements total | 6 |
| Requirements complete | 3 |
| Parity suite status | Green (7/7 fixtures, post-refactor — D-12 gate verified) |

---
| Phase 01 P01 | 3min | 3 tasks | 2 files |
| Phase 01 P02 | 8min | 3 tasks | 6 files |

## Accumulated Context

### Key Decisions Logged

- Capability seam over per-feature browser hooks — generic verbs (navigate/storage/transport) let any future front-end pick up redirect/side-effects/progress automatically; restores the core invariant the framework already claims
- 2 sequential phases, zero quicks — Phase 1 = refactor (no behavior change, parity-verifiable); Phase 2 = feature through the seam, depends on Phase 1. Quicks skip the verification gates this work centers on
- Upload progress built through the seam, not bolted on — avoids a third core platform violation; makes issue #4 the first feature done right
- Consumer migration blurb is a first-class milestone deliverable — downstream maintainers (multiple apps) must know what/whether to update
- [01-01] 3 core platform-global violations relocated behind optional Adapter verbs (navigate/storage/transport); fail-loud on missing capability (D-06); index.ts now references zero platform globals; onRedirect signature/precedence byte-identical (D-04/D-05); in-core fetch untouched (D-07)
- [01-02] AGNOSTIC-03 invariant is CI-enforced: standalone grep-denylist guard (5 tokens, scoped to src/index.ts only, D-08/D-09/D-11) via `npm run check:core-globals`; net-new framework vitest+jsdom harness proves the relocation fires (navigate/onRedirect-precedence/storage/fail-loud, D-12.2); D-12 dual gate satisfied locally (parity 7/7 incl feature-probe + adapter test green) and wired as gating steps into the existing parity workflow (D-10) — no new workflow file

### Architectural Notes

- Drift being corrected: src/index.ts directly calls window.location.href (redirect), localStorage/sessionStorage (side-effects, no override hook). This violates the framework's stated "core never references platform types" invariant.
- Risk is low: the wire contract is parity-covered by FeatureProbe fixtures. Refactor moves WHERE the browser binding executes, not WHAT the protocol does.
- Phase 1 verification gate: parity suite 100% green AND CI invariant guard passes.
- Phase 2 constraint: onUploadProgress byte-level progress is browser-runtime only — no parity surface. Unit-testable via mock XHR.

### Blockers

(None)

### TODOs

- ~~Plan 01-02: add the grep-based CI guard (D-08/D-10) AND the adapter-level jsdom/vitest test (D-12.2)~~ — DONE; D-12 dual gate verified locally (parity 7/7 + adapter test green) and CI-enforced
- Plan 01-03: AGENTS.md + README capability-seam documentation (D-14) — including how the invariant is enforced (check:core-globals guard + parity-workflow step)

---

## Session Continuity

**Last session:** 2026-05-15T12:38:14Z
**Stopped at:** Completed 01-02-PLAN.md
**Next action:** Execute 01-03-PLAN.md

---

*State initialized: 2026-05-15*
*Last updated: 2026-05-15 after 01-02 execution*
