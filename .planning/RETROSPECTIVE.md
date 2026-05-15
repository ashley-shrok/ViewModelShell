# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v0.3.13 — Platform-Agnosticism

**Shipped:** 2026-05-15
**Phases:** 2 | **Plans:** 6 | **Tasks:** 13 | **Sessions:** 1 (single-day, ~2h: c03d122 08:18 → f14d496 10:29)

### What Was Built
- Capability seam: the 3 core platform-global violations (`window.location.href`, `localStorage`, `sessionStorage`) relocated out of `viewmodel-shell/src/index.ts` behind generic optional `Adapter` verbs (`navigate`/`storage`/`transport`) implemented in `BrowserAdapter` — zero observable behavior change, with a fail-loud guarantee replacing the prior silent-no-op security risk.
- CI-enforced invariant: standalone grep-denylist guard (`check-core-platform-globals.mjs`, scoped to `src/index.ts`) plus a net-new vitest+jsdom adapter-seam harness proving the relocation actually fires; both wired as gating steps into the existing `parity.yml` workflow (no new workflow file).
- UPLOAD-01: upload progress (`ShellOptions.onUploadProgress`) shipped as the first feature built *through* the `transport` seam — `XMLHttpRequest` lives only in `BrowserAdapter.transport`, zero in core, three-condition routing with silent fetch fallback, failures reject into the existing `onError` path.
- MIGRATE-01: copy-pasteable root `MIGRATION.md` (+ `CHANGELOG.md`, README pointer); npm `0.3.12 → 0.3.13` PATCH with NuGet held at `0.3.9` and the major.minor-alignment rule byte-unchanged.
- AGENTS.md + README reframed the previously aspirational "core references zero platform globals" claim as a documented, CI-enforced, checkable invariant — every signature cited byte-for-byte from shipped source.

### What Worked
- **Refactor-then-feature sequencing.** Phase 1 (pure relocation, parity-verifiable, no behavior change) before Phase 2 (new feature through the now-clean seam) meant the upload-progress feature could not reintroduce a platform violation by construction — issue #4 became "the first feature done right."
- **Parity harness as the highest-signal gate.** The 7-fixture cross-backend diff caught wire-format drift as the objective definition of "no behavior change," letting an architecture-invariant refactor proceed with confidence rather than hope.
- **Enforcing the invariant instead of trusting it.** Converting a doc claim into a grep guard + jsdom proof closed the exact gap that had let the drift accumulate originally.

### What Was Inefficient
- **Closeout split across two concerns, with one artifact missed.** The release step (npm `0.3.13` published, git tag `v0.3.13` created at `1f668c4` and pushed) and the GSD archive (MILESTONES.md, PROJECT evolution, ROADMAP collapse at `f14d496`) both completed in the milestone session — but `RETROSPECTIVE.md`, the one remaining GSD closeout artifact, was never written. A later maintenance session also nearly created a *duplicate* local `v0.3.13` tag at `f14d496` by trusting `git tag -l` + a stale status snapshot instead of running `git fetch` first; caught and reverted before any remote write. Lesson banked below.
- **Doc-heavy commit ratio (21 of 39 commits were `docs`).** Appropriate for an invariant/migration milestone, but a signal that documentation-as-deliverable work benefits from being batched rather than interleaved commit-by-commit.

### Patterns Established
- **Capability-verb seam:** any new platform side-effect goes behind an optional `Adapter` method (and into `BrowserAdapter`), never into core; a capability with no safe core default must fail loudly, never silently no-op.
- **CI-enforced architecture invariants:** a stated core invariant must ship with a checkable guard in the gating workflow, not just prose.
- **Run milestone closeout immediately and atomically** — tag + retrospective + STATE update in the same session that archives, before any follow-on quick work.

### Key Lessons
1. When a framework's central promise is an invariant ("core touches zero platform types"), enforce it mechanically in CI the moment you assert it — unenforced invariants drift back.
2. Sequence pure refactors before features that depend on them so the feature physically cannot reintroduce the debt the refactor removed.
3. Verify remote state (`git fetch --tags`) before concluding a release artifact is missing — `git tag -l` shows only local tags and a session-start status snapshot goes stale. Acting on the phantom gap nearly produced a conflicting duplicate tag.

### Cost Observations
- Model mix: not precisely tracked this milestone (telemetry not captured). Profile: `balanced`.
- Sessions: 1 working day (2026-05-15), ~2h of milestone commits; closeout finalized in a later session.
- Notable: 39 commits / +6119 −102 across 37 files for 13 tasks — high doc-to-code ratio is expected for an invariant + migration milestone.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v0.3.13 Platform-Agnosticism | 1 | 2 | First milestone with a CI-enforced architecture invariant; refactor-before-feature sequencing |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v0.3.13 Platform-Agnosticism | 14/14 vitest + 7/7 parity + 136 C# | parity-gated (wire-format) | Capability seam, upload progress (no new runtime deps) |

### Top Lessons (Verified Across Milestones)

1. Mechanically enforce invariants the moment they are claimed — prose invariants drift. *(First observed: v0.3.13; re-verify next milestone.)*
2. Fetch before you conclude something is missing — reconcile against the remote, not local refs or stale snapshots, before creating tags/releases. *(First observed: v0.3.13.)*
