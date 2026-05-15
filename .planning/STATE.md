---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 02-01-PLAN.md
last_updated: "2026-05-15T13:36:58.043Z"
progress:
  total_phases: 2
  completed_phases: 1
  total_plans: 6
  completed_plans: 4
  percent: 67
---

# Project State: ViewModel Shell

## Project Reference

**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end.
**Current Milestone:** Restore & Enforce Core Platform-Agnosticism
**Current Focus:** Phase 02 — Upload Progress + Milestone Closeout

---

## Current Position

Phase: 02 (Upload Progress + Milestone Closeout) — EXECUTING
Plan: 2 of 3
**Phase:** 2
**Plan:** 02-01 complete; next is 02-02
**Status:** Executing Phase 02

```
Progress: [ Phase 1 ██████████ ][ Phase 2 ███░░░░░░░ ]
           67% (Phase 1 of 2 complete; 02-01 done)    100%
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases total | 2 |
| Phases complete | 1 |
| Requirements total | 6 |
| Requirements complete | 4 |
| Parity suite status | Green (7/7 fixtures, post-refactor — D-12 gate verified) |

---
| Phase 01 P01 | 3min | 3 tasks | 2 files |
| Phase 01 P02 | 8min | 3 tasks | 6 files |
| Phase 01 P03 | 2min | 1 tasks | 2 files |
| Phase 02 P01 | 2min | 2 tasks | 2 files |

## Accumulated Context

### Key Decisions Logged

- Capability seam over per-feature browser hooks — generic verbs (navigate/storage/transport) let any future front-end pick up redirect/side-effects/progress automatically; restores the core invariant the framework already claims
- 2 sequential phases, zero quicks — Phase 1 = refactor (no behavior change, parity-verifiable); Phase 2 = feature through the seam, depends on Phase 1. Quicks skip the verification gates this work centers on
- Upload progress built through the seam, not bolted on — avoids a third core platform violation; makes issue #4 the first feature done right
- Consumer migration blurb is a first-class milestone deliverable — downstream maintainers (multiple apps) must know what/whether to update
- [01-01] 3 core platform-global violations relocated behind optional Adapter verbs (navigate/storage/transport); fail-loud on missing capability (D-06); index.ts now references zero platform globals; onRedirect signature/precedence byte-identical (D-04/D-05); in-core fetch untouched (D-07)
- [01-02] AGNOSTIC-03 invariant is CI-enforced: standalone grep-denylist guard (5 tokens, scoped to src/index.ts only, D-08/D-09/D-11) via `npm run check:core-globals`; net-new framework vitest+jsdom harness proves the relocation fires (navigate/onRedirect-precedence/storage/fail-loud, D-12.2); D-12 dual gate satisfied locally (parity 7/7 incl feature-probe + adapter test green) and wired as gating steps into the existing parity workflow (D-10) — no new workflow file
- [01-03] AGNOSTIC-04 docs shipped with the phase (D-14): AGENTS.md gained `### The capability seam` (verbs, optional-methods shape, onRedirect->adapter.navigate->loud-error order, fail-loud rule w/ hecate_jwt rationale) + the core-platform-globals invariant restated as CI-enforced (check:core-globals guard, parity.yml step, src/index.ts-only scope) + an enforced-invariant convention bullet; README.md gained a consumer-facing capability-seam subsection with non-breaking/onRedirect-unchanged reassurance; purely additive (50 ins / 0 del), every signature cited byte-for-byte from shipped source. Phase 1 complete (3/3 plans).
- [02-01] UPLOAD-01 built through the Phase 1 seam: additive `ShellOptions.onUploadProgress` (byte-identical to the locked `Adapter.transport` hook, D-03) + `dispatch()` three-condition routing branch (`action.files && onUploadProgress && adapter.transport`, D-01); missing transport is a SILENT fetch fallback (D-02, not failCapability — transport is the asymmetric verb per Phase 1 D-07); XHR upload-progress binding confined to `BrowserAdapter.transport` with the D-05 in-flight/terminal emission rule (never `(0,0)`), D-07 reject-to-onError, D-08 real-`Response` so `processResponse()` is byte-unchanged; zero `XMLHttpRequest` in core `src/index.ts` (check:core-globals green); 8/8 existing vitest pass. Behavioral mock-XHR test = 02-02; MIGRATION.md + version bump + parity gate = 02-03.

### Architectural Notes

- Drift being corrected: src/index.ts directly calls window.location.href (redirect), localStorage/sessionStorage (side-effects, no override hook). This violates the framework's stated "core never references platform types" invariant.
- Risk is low: the wire contract is parity-covered by FeatureProbe fixtures. Refactor moves WHERE the browser binding executes, not WHAT the protocol does.
- Phase 1 verification gate: parity suite 100% green AND CI invariant guard passes.
- Phase 2 constraint: onUploadProgress byte-level progress is browser-runtime only — no parity surface. Unit-testable via mock XHR.

### Blockers

(None)

### TODOs

- ~~Plan 01-02: add the grep-based CI guard (D-08/D-10) AND the adapter-level jsdom/vitest test (D-12.2)~~ — DONE; D-12 dual gate verified locally (parity 7/7 + adapter test green) and CI-enforced
- ~~Plan 01-03: AGENTS.md + README capability-seam documentation (D-14) — including how the invariant is enforced (check:core-globals guard + parity-workflow step)~~ — DONE; AGNOSTIC-04 complete, Phase 1 fully delivered
- ~~Plan 02-01 (UPLOAD-01): build the upload-progress XHR binding through the documented `transport?(input, init, hooks?)` seam — no wire/public-API change~~ — DONE; structural implementation shipped (ShellOptions.onUploadProgress + dispatch routing + BrowserAdapter XHR branch), core-globals green, 8/8 existing tests pass
- Plan 02-02: net-new mock-XHR behavioral unit test extending `test/adapter-seam.test.ts` (D-14 — callback fires/never-fires, indeterminate terminal emission never `(0,0)`, fetch-fallback parity)
- Plan 02-03 (MIGRATE-01): `MIGRATION.md` + README pointer; npm `0.3.13` (patch), NuGet unchanged `0.3.9`; AGENTS.md versioning rule NOT changed; full parity gate

---

## Session Continuity

**Last session:** 2026-05-15T13:36:58.041Z
**Stopped at:** Completed 02-01-PLAN.md
**Next action:** Execute plan 02-02 (mock-XHR behavioral unit test for UPLOAD-01, D-14)

---

*State initialized: 2026-05-15*
*Last updated: 2026-05-15 after 02-01 execution (UPLOAD-01 structural implementation shipped)*
