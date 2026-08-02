---
phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
plan: 11
subsystem: docs
tags: [docs-staging, changelog, migration, agents-md, v9.0.0, breaking, pre-release, date-placeholder-handoff]

# Dependency graph
requires:
  - phase: 29-10
    provides: GREEN release-gate — Plans 29-11 (docs) + 29-12 (release) unblocked
provides:
  - CHANGELOG.md v9.0.0 BREAKING entry staged with <YYYY-MM-DD> placeholder for Plan 29-12 to finalize atomically with the release commit
  - MIGRATION.md "Upgrading to v9.0.0" section staged with three consumer-path guidance blocks (custom-affordance opt-out; TS-server GET-side enforcement; .NET no-op) + bump-both-packages code block
  - AGENTS.md new gotcha #10 documenting v9.0.0 hard-lock behavior + Phase 29 postscript appended to existing gotcha #9 (cross-verified fixture reference `agt-get-build-stale`)
affects: [29-12, phase-29-release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Date placeholder handoff — Phase 27/28's pre-release doc staging pattern preserved: `<YYYY-MM-DD>` stays in CHANGELOG until Plan 29-12 replaces it at bump-commit time"
    - "Fixture cross-verification — Task 3 mandated a grep against parity/fixtures/helpdesk.json to confirm the hard-coded fixture ID `agt-get-build-stale` exists before writing the AGENTS.md gotcha #9 addendum (prevents doc-string-vs-fixture drift)"

key-files:
  created:
    - .planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-11-SUMMARY.md
  modified:
    - CHANGELOG.md (v9.0.0 BREAKING entry appended at top of entry stream; +30 lines; commit f1daa76)
    - MIGRATION.md (Upgrading to v9.0.0 section appended at top of upgrade-notes stream; +57 lines; commit a45c0c2)
    - AGENTS.md (new gotcha #10 + Phase 29 postscript to gotcha #9; +10 lines; commit 758b9f3)
    - .planning/ROADMAP.md (29-11 checkbox → [x]; plan counter 9/12 → 10/12)

key-decisions:
  - "MIGRATION.md required a second `onVersionSkew` mention to satisfy plan verify (`grep -c 'onVersionSkew' >= 2`) — added inline mention in the prose leading into the code snippet (Rule 3 auto-fix; specification quirk in the plan's own acceptance criteria vs. its example content)"
  - "Task 4 (guardrail) had NO file changes to commit — verification-only; the `.vite/` and `server.pid` untracked entries flagged by `git status --porcelain | grep -v ...` are pre-existing from the session-start snapshot and NOT caused by this plan's doc edits"
  - "Date placeholder `<YYYY-MM-DD>` preserved intact in CHANGELOG (grep count exactly 1) per the Plan 29-12 handoff pattern established in Phases 27/28"

patterns-established:
  - "Fixture-cross-verify-before-write — when a doc string hard-codes a fixture/artifact ID owned by an upstream plan, grep the upstream artifact BEFORE writing to catch phantom references (avoids readers chasing IDs that don't exist)"

requirements-completed: [SKEW-10]

# Metrics
duration: ~4min
completed: 2026-08-02
---

# Phase 29 Plan 11: Docs staging — CHANGELOG + MIGRATION + AGENTS.md for v9.0.0

## One-liner

Staged three doc edits (CHANGELOG.md v9.0.0 BREAKING entry with date placeholder; MIGRATION.md v9.0.0 upgrade section with three consumer paths; AGENTS.md new gotcha #10 + Phase 29 postscript to gotcha #9) atomically per task; no version bumps, no source-code drift.

## Verdict

**GREEN — all 4 tasks executed and committed atomically. Plan 29-12 (release) unblocked; date placeholder preserved for 29-12 to finalize at bump-commit time.**

## Performance

- **Duration:** ~4 min end-to-end
- **Started:** 2026-08-02T22:42:10Z
- **Tasks:** 4/4 completed

## Per-task commit table

| Task | Description | Commit | Verify |
|------|-------------|--------|--------|
| 1 | CHANGELOG.md v9.0.0 BREAKING entry (30 lines added at top of entry stream, above `## 8.2.0`) | `f1daa76` | `grep -c '## 9.0.0' CHANGELOG.md == 1`; `<YYYY-MM-DD>` count = 1; BREAKING count 13→14 |
| 2 | MIGRATION.md "Upgrading to v9.0.0" section (57 lines added at top of upgrade-notes stream, above `## Upgrading to v8.2.0`) | `a45c0c2` | `grep -c '## Upgrading to v9.0.0' == 1`; onVersionSkew ≥ 2; createVersionGuard = 3; AddVmsShellVersioning 5→7 |
| 3 | AGENTS.md new gotcha #10 (v9.0.0 hard-lock) + Phase 29 postscript appended to gotcha #9 (10 lines total added between existing gotcha #9 and `---` separator at line 81) | `758b9f3` | gotcha count 21→22; `v9.0.0 postscript` = 1; `agt-get-build-stale` present in AGENTS.md AND cross-verified in `parity/fixtures/helpdesk.json` (both = 1) |
| 4 | Guardrail: no source-code drift; `npm run build` exit 0 | (no commit — verification-only) | `git status` shows only expected files; TS build clean |

## Fixture cross-verification (Task 3 checker-mandated)

Ran `grep -c 'agt-get-build-stale' parity/fixtures/helpdesk.json` → returned `1`. Plan 29-07's GET-side skew fixture exists under exactly the ID the AGENTS.md gotcha #9 postscript names. No adjustment needed to the hard-coded fixture reference in the addendum.

Also cross-referenced Plan 29-10 SUMMARY line 144 which confirms `agt-get-build-match` / `agt-get-build-stale` "ran within the helpdesk-seeded fixture set and passed" during the green-tree gate — the fixture is real, runnable, and named exactly as the AGENTS.md addendum cites.

## Line-range map for Plan 29-12's release-commit awareness

| File | Section added | Approx line range (post-edit) |
|------|---------------|-------------------------------|
| CHANGELOG.md | `## 9.0.0 — <YYYY-MM-DD> (npm + NuGet aligned) — BREAKING` block (30 lines) | lines 9–38 |
| MIGRATION.md | `## Upgrading to v9.0.0` block (57 lines) | lines 9–65 |
| AGENTS.md | Gotcha #9 postscript (bullet) + new gotcha #10 (paragraph) | lines 80–90 (approx; after existing gotcha #9 at line 79, before `---` at line 91) |

## What Plan 29-12 must do to close out

1. Replace `<YYYY-MM-DD>` in CHANGELOG.md line 9 with the actual release date at bump-commit time.
2. Bump `viewmodel-shell/package.json` `"version"` to `9.0.0`.
3. Bump `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>` to `9.0.0`.
4. Rebuild + republish `AshleyShrok.ViewModelShell.Markdown` companion with bumped floor dep on core 9.0.0 (per AGENTS.md core-major-bump rule — Plan 29-10's SUMMARY line 138 explicitly reminded).
5. Re-run `parity/check-companion-binary-compat.sh` against the 9.0.0-packed core (proves the companion is STILL binary-compatible after the core version bump).
6. Publish npm + NuGet aligned per AGENTS.md working agreement.
7. Tag `v9.0.0` + advance `main` per the "release isn't done until main contains it" AGENTS.md rule.

The docs are ready; the version numbers wait for Plan 29-12's operator-gated ceremony.

## Files Created/Modified

- `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-11-SUMMARY.md` — this file
- `CHANGELOG.md` — v9.0.0 BREAKING entry staged (commit `f1daa76`)
- `MIGRATION.md` — Upgrading to v9.0.0 section staged (commit `a45c0c2`)
- `AGENTS.md` — gotcha #10 + gotcha #9 postscript staged (commit `758b9f3`)
- `.planning/ROADMAP.md` — 29-11 checkbox → [x]; plan counter 9/12 → 10/12

## Decisions Made

- **Date placeholder preserved intact** — `<YYYY-MM-DD>` in CHANGELOG (grep count exactly 1) per the Plan 29-12 handoff pattern established in Phases 27/28. Plan 29-12 substitutes at bump-commit time (atomically with version bump, not in a separate doc commit).
- **Fixture cross-verified BEFORE writing** — plan explicitly mandated this (Task 3 pre-write step). `grep -c 'agt-get-build-stale' parity/fixtures/helpdesk.json` returned `1` before the addendum was pasted into AGENTS.md; no adjustment needed.
- **MIGRATION.md `onVersionSkew` count deviated from plan verify** — plan's action text produced only 1 occurrence (the code snippet); plan verify required ≥2. Added a second inline prose mention leading into the code snippet (transparent rewording, no semantic change; Rule 3 auto-fix for a specification quirk internal to the plan itself).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MIGRATION.md `onVersionSkew` grep count off-by-one vs plan verify**
- **Found during:** Task 2 post-edit verification (`grep -c 'onVersionSkew' MIGRATION.md` returned `1`, plan required `>=2`)
- **Issue:** The plan's action text produces exactly one `onVersionSkew` mention (inside the code snippet), but the plan's acceptance criteria require at least two. Plan-internal spec inconsistency.
- **Fix:** Added a second inline prose mention ("...preserve that affordance by setting `onVersionSkew: \"custom\"` — the shell still surfaces the signals to your existing `onError`:") immediately preceding the code snippet. Same semantic content, satisfies the count.
- **Files modified:** `MIGRATION.md`
- **Commit:** `a45c0c2` (rolled into Task 2's atomic commit rather than a separate deviation commit — the fix was authored before the commit)

### Non-Deviations Explicitly Confirmed

- **No source-code file touched.** `git status --porcelain | grep -v CHANGELOG.md | grep -v MIGRATION.md | grep -v AGENTS.md | grep -v '.planning/'` returned only `.vite/` and `server.pid`, both of which appeared in the session-start git-status snapshot and are pre-existing untracked artifacts from earlier phases (server dev-loop artifacts + Vite cache). Not caused by this plan.
- **TS build guardrail green.** `cd viewmodel-shell && npm run build` exit 0 (Task 4 confirmation).
- **Existing gotcha #9 text preserved.** Grep for the pre-existing phrase "The diff is only" still returns 1 in AGENTS.md — the addendum was purely additive, no in-place edit to gotcha #9's own text.

## Threat Flags

None — this is a pure doc-staging plan; no wire, no runtime, no security surface.

## Next Phase Readiness

**Plan 29-12 (operator-gated release) UNBLOCKED.**

The three doc files carry the v9.0.0 story ready to ship. Plan 29-12's atomic release commit will:
1. Substitute `<YYYY-MM-DD>` → actual release date in CHANGELOG.md.
2. Bump both packages to 9.0.0.
3. Rebuild + republish the Markdown companion.
4. npm publish + NuGet publish + tag + main-advance + announce.

## Self-Check: PASSED

- SUMMARY file exists at `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-11-SUMMARY.md`.
- Commit `f1daa76` (Task 1) verified in `git log`.
- Commit `a45c0c2` (Task 2) verified in `git log`.
- Commit `758b9f3` (Task 3) verified in `git log`.
- CHANGELOG.md contains `## 9.0.0` at line 9 (above `## 8.2.0` at line 39).
- MIGRATION.md contains `## Upgrading to v9.0.0` at line 9 (first upgrade section).
- AGENTS.md contains new gotcha #10 (`^10\. \*\*Version-skew is a HARD LOCK`) + `v9.0.0 postscript` inside gotcha #9.
- Fixture `agt-get-build-stale` cross-verified present in `parity/fixtures/helpdesk.json` (count = 1).
- Date placeholder `<YYYY-MM-DD>` preserved in CHANGELOG (count = 1); Plan 29-12 will substitute.
- ROADMAP.md 29-11 checkbox flipped to `[x]`; plan counter advanced 9/12 → 10/12.

---
*Phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-*
*Completed: 2026-08-02*
