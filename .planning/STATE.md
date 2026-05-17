---
gsd_state_version: 1.0
milestone: 0.4.0
milestone_name: Design System
status: defining_requirements
stopped_at: Milestone 0.4.0 "Design System" started — PROJECT.md updated, defining requirements next
last_updated: "2026-05-17T00:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: ViewModel Shell

## Project Reference

**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end.
**Current Milestone:** 0.4.0 Design System
**Current Focus:** Defining requirements — out-of-box default theme + preset-grid layout enum + canonical examples

---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-17 — Milestone 0.4.0 "Design System" started (continues phase numbering from 0.3.13 → starts at Phase 3)

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Phases total | TBD (roadmap pending) |
| Phases complete | 0 |
| Requirements total | TBD (defining) |
| Requirements complete | 0 |
| Parity suite status | Green at 0.3.13 baseline (7/7 fixtures) — must stay green through 0.4.0 |

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
- [02-02] UPLOAD-01 behaviorally verified: net-new `viewmodel-shell/test/upload-progress.test.ts` mirrors the Phase-1 D-12.2 adapter-seam harness and drives the SHIPPED `BrowserAdapter.transport` + `ViewModelShell.dispatch()` via a controllable mock `XMLHttpRequest` under jsdom (anti-mock-masking T-02-05 — cases a/d/e run production code). Asserts D-14 (a) fires `(50,100)`->`(100,100)` on files+option; (b1/b2) never fires without files or option (fetch path); (c) missing `adapter.transport` = SILENT fetch fallback, no progress, no `onError` (D-02); (d) reconstructed Response round-trips through shared `processResponse()` (`getCurrentVm()`->"updated", D-08); (e) indeterminate terminal is `(73,73)` asserted `.toEqual([73,73])` AND `.not.toEqual([0,0])` (D-05). `npm test` 14/14 (8 pre-existing + 6 new); check:core-globals exit 0; only the test file added (D-15). MIGRATION.md + version bump + full parity gate = 02-03.
- [02-03] MIGRATE-01 milestone closeout: npm `@ashley-shrok/viewmodel-shell` bumped `0.3.12 -> 0.3.13` (PATCH, D-10/D-10a — never `0.4.0`; package-lock.json synced via Rule-1 deviation `35ab2d9`); NuGet `AshleyShrok.ViewModelShell` unchanged `0.3.9` (D-11); `git diff AGENTS.md` empty — the "share major.minor" rule is byte-unchanged (D-10a, user declined "minor=feature"). Copy-pasteable `MIGRATION.md` at repo root with D-13 items 1-5 (exact versions + why-patch [AGENTS.md alignment rule + patch cadence] + why-no-NuGet, the one `onUploadProgress` API addition, NOT-breaking table incl. existing custom `Adapter` impls, upgrade steps incl. ".NET: no action", and BOTH silent-behavior caveats: 5a transport-fetch-fallback + 5b `total>0` divide-by-zero guard with snippet); `README.md` one-line pointer. Full milestone gate GREEN: `check:core-globals` exit 0, `npx vitest run` 14/14, parity 7/7 fixtures "all backends agree" / "✓ Parity tests passed" exit 0 (one Windows stale-process file-lock flake auto-resolved via Rule 3 — environment, not a wire regression; D-15 boundary held, no parity/FeatureProbe/src change). All 4 ROADMAP Phase 2 success criteria satisfied with recorded command evidence. Phase 2 complete (3/3 plans); all 6 milestone requirements done.

### Architectural Notes (0.4.0 Design System)

- Appearance (color/type/spacing/borders/density) = 100% CSS, untouched override seam. Arrangement (layout intent) = server-emitted, lives in the wire — blind agents + non-browser/multi-target adapters can't read CSS-only layout.
- Preset-grid: ONE grid-backed layout enum on EXISTING `page`/`section` nodes. No new node types. No spatial geometry/spans in the wire. Default value = today's vertical flow (non-breaking).
- The layout enum is a wire-format change ⇒ 0.4.0 minor bump, npm + NuGet aligned; all 5 `ViewModels.cs` copies sync; cross-backend parity must stay green (highest-signal gate, as in 0.3.13).
- Agent-familiarity principle: agents are few-shot pattern matchers — canonical good-looking examples (Showcase + demos on the shipped stylesheet) are the highest-leverage quality lever, benchmarked against Bootstrap example pages (benchmark only, not a dependency).
- Deferred (Out of Scope, tracked): image node #5, chart/data-viz #6.

### Blockers

(None)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260515-gru | Add CopyButtonNode (copy text to clipboard) | 2026-05-15 | 8c8498c | [260515-gru-add-copybuttonnode-copy-text-to-clipboar](./quick/260515-gru-add-copybuttonnode-copy-text-to-clipboar/) |

### TODOs

- (Cleared — all 0.3.13 plan TODOs completed and shipped. Full history in `.planning/milestones/0.3.13-phases/`.)
- 0.4.0: define REQUIREMENTS.md (REQ-IDs per category), then roadmap (starts at Phase 3).

---

## Session Continuity

**Last session:** 2026-05-17
**Stopped at:** Milestone 0.4.0 "Design System" initialized. PROJECT.md updated (Current Milestone section, Active themes, Out-of-Scope #5/#6, Key Decisions, footer); STATE.md reset; 0.3.13 phase dirs archived to `.planning/milestones/0.3.13-phases/`; image (#5) + chart (#6) issues filed. Continues phase numbering → starts at Phase 3.
**Next action:** Define REQUIREMENTS.md (REQ-IDs per category) → spawn roadmapper (Phase 3+). Research is OFF (config).

---

*State initialized: 2026-05-15*
*Last updated: 2026-05-17 — milestone 0.4.0 "Design System" started: PROJECT.md + STATE.md updated, 0.3.13 phases archived, #5/#6 deferred. Next: define REQUIREMENTS.md → roadmap (Phase 3+).*
