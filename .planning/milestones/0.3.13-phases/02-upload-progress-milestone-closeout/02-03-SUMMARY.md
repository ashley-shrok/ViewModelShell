---
phase: 02-upload-progress-milestone-closeout
plan: 03
subsystem: infra
tags: [versioning, semver, migration-docs, npm, nuget, parity, milestone-closeout]

# Dependency graph
requires:
  - phase: 02-upload-progress-milestone-closeout
    plan: 01
    provides: "The shipped public-API addition ShellOptions.onUploadProgress?: (sent: number, total: number) => void + the D-02 silent-fetch-fallback and D-05/D-05a indeterminate-total semantics that MIGRATION.md documents"
  - phase: 02-upload-progress-milestone-closeout
    plan: 02
    provides: "viewmodel-shell/test/upload-progress.test.ts — the behavioral gate (D-14 a-e) that, together with parity, satisfies ROADMAP Phase 2 criterion 1; runs under the npx vitest run gate here"
provides:
  - "npm @ashley-shrok/viewmodel-shell bumped 0.3.12 -> 0.3.13 (PATCH, D-10/D-10a) with package-lock.json synced"
  - "NuGet AshleyShrok.ViewModelShell confirmed unchanged at 0.3.9 (D-11) — no .NET action"
  - "AGENTS.md 'two packages share major.minor' versioning rule verified byte-unchanged (D-10a)"
  - "MIGRATION.md at repo root — copy-pasteable MIGRATE-01 blurb (D-13 items 1-5 incl. both silent-behavior caveats 5a/5b and the why-patch + why-no-NuGet rationale)"
  - "README.md one-line pointer to MIGRATION.md (D-12)"
  - "Full milestone gate executed green: check:core-globals + npx vitest run (14/14) + parity 7/7 fixtures all backends agree"
affects: [milestone-closeout, future-version-bumps, downstream-consumer-upgrades]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Migration blurb as a first-class milestone deliverable: dedicated copy-pasteable MIGRATION.md at repo root + single README pointer (one canonical URL for downstream maintainers)"
    - "Version policy is NOT refactored mid-phase: a client-only feature ships as an npm-only PATCH; npm/NuGet stay aligned on the 0.3 major.minor; the AGENTS.md versioning rule is the cited justification, never edited"
    - "Parity is the wire-contract gate even for a no-wire-change release: 7 fixtures all-backends-agree proves the shared processResponse() path is byte-unchanged (D-08/D-09)"

key-files:
  created:
    - "MIGRATION.md — MIGRATE-01 copy-pasteable consumer/maintainer migration blurb (D-13 1-5)"
  modified:
    - "viewmodel-shell/package.json — version 0.3.12 -> 0.3.13 (PATCH, single line)"
    - "viewmodel-shell/package-lock.json — self-version sync 0.3.12 -> 0.3.13 (two lines, no dep-tree change)"
    - "README.md — one additive sentence pointing to MIGRATION.md"

key-decisions:
  - "D-10/D-10a: npm version is exactly 0.3.13 (PATCH), NEVER 0.4.0 — zero wire/ViewNode change + AGENTS.md major.minor-alignment rule + established patch cadence; the AGENTS.md rule is byte-unchanged (user explicitly declined adopting 'minor = feature')"
  - "D-11: NuGet stays 0.3.9 — no wire/.NET delta; not bumping PRESERVES npm/NuGet alignment (bumping would be the divergence); MIGRATION.md states the no-op + rationale explicitly"
  - "D-12/D-13: MIGRATION.md is a dedicated root file with all 5 mandatory items incl. both non-obvious silent behaviors (5a transport-fetch-fallback, 5b total===0 / total>0 divide-by-zero guard with copy-pasteable snippet)"
  - "D-09/D-15: parity proves the shared response path is unchanged (no parity surface for progress); no parity fixture / FeatureProbe / src modified"

patterns-established:
  - "Locked-fact enforcement: package.json==0.3.13, csproj==0.3.9, AGENTS.md rule byte-unchanged are automated-verified (asserted, not trusted) — supply-chain semantics threat T-02-09 mitigated"
  - "Doc-omission threats mitigated by mandatory acceptance-checked content: the 5b divide-by-zero caveat and 5a false-reassurance caveat are required strings, not optional prose (T-02-07/T-02-08)"

requirements-completed: [MIGRATE-01]

# Metrics
duration: 7min
completed: 2026-05-15
---

# Phase 2 Plan 03: MIGRATE-01 Milestone Closeout Summary

**npm `@ashley-shrok/viewmodel-shell` bumped `0.3.12 → 0.3.13` (PATCH, D-10 — never `0.4.0`) with NuGet held at `0.3.9` and the AGENTS.md versioning rule byte-unchanged; a copy-pasteable root `MIGRATION.md` ships all D-13 items 1-5 (exact versions + why-patch/why-no-NuGet rationale, the one `onUploadProgress` API addition, the NOT-breaking list incl. existing custom Adapters, upgrade steps, and both non-obvious silent-behavior caveats with a `total > 0` divide-by-zero guard); the full milestone gate is green — `check:core-globals` exit 0, vitest 14/14, and the 7-fixture cross-backend parity suite "all backends agree".**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-15T13:46:17Z
- **Completed:** 2026-05-15T13:53:16Z
- **Tasks:** 3
- **Files modified:** 3 (1 created: MIGRATION.md; 2 modified: package.json, README.md) + package-lock.json (deviation-fix)

## Accomplishments

- **npm PATCH bump locked exactly:** `viewmodel-shell/package.json` `0.3.12 → 0.3.13` — a single-line change, NOT `0.4.0`/`0.3.14`/a minor (D-10/D-10a). `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` confirmed unchanged at `<Version>0.3.9</Version>` (D-11). `git diff AGENTS.md` is empty — the "two packages share major.minor" versioning rule is byte-identical (D-10a; the user explicitly declined adopting "minor = feature").
- **MIGRATION.md authored at repo root, copy-pasteable, all D-13 items 1-5:** (1) exact versions npm `0.3.13` / NuGet unchanged `0.3.9` WITH the why-patch rationale (AGENTS.md `major.minor`-alignment rule + zero wire/ViewNode change + the established patch cadence redirect 0.3.4 / side-effects 0.3.5 / polling 0.3.6 / npm-only 0.3.10–0.3.12) AND the why-no-NuGet-bump rationale (preserves alignment, not divergence); (2) the single public-API addition `ShellOptions.onUploadProgress?: (sent: number, total: number) => void`; (3) an explicit NOT-breaking table with one-line reasons — wire format, redirect, side-effects, polling/push, every existing ViewNode type, AND existing custom `Adapter` implementations (`transport?` stays optional); (4) upgrade steps (`npm update @ashley-shrok/viewmodel-shell`, optional `onUploadProgress`, .NET: **No action**); (5) both non-obvious silent behaviors — **5a** progress fires only if the adapter implements `transport` (custom adapters without it silently fall back to fetch, upload succeeds, no events, not an error), **5b** `total` may be `0`/indeterminate with a copy-pasteable `const pct = total > 0 ? Math.round((sent / total) * 100) : null;` divide-by-zero guard.
- **README.md pointer added (D-12):** one additive sentence after the capability-seam non-breaking paragraph linking `[MIGRATION.md](./MIGRATION.md)`; no restructure, nothing removed; AGENTS.md NOT touched.
- **Full milestone gate executed and GREEN** (all three gates, exact evidence below): `npm run check:core-globals` exit 0 (ROADMAP criterion 2), `npx vitest run` exit 0 with 14/14 (8 adapter-seam + 6 upload-progress, ROADMAP criterion 1 via 02-02), and the cross-backend parity suite exit 0 with all 7 fixtures "all backends agree" (ROADMAP criterion 3 — shared `processResponse()`/wire contract byte-unchanged, D-08/D-09).
- **D-15 boundary held:** `git status --porcelain parity/` empty — no parity fixture, FeatureProbe, normalize, or `viewmodel-shell/src/` change. This plan is version-string + docs + verification only.

## Task Commits

Each task was committed atomically (with hooks, specific files staged):

1. **Task 1: Bump npm version to 0.3.13 (PATCH)** — `6caac19` (chore)
2. **Task 2: Author MIGRATION.md (D-13 1-5) + README pointer** — `31aa2e6` (docs)
3. **Task 3: Run the full milestone verification gate** — verification-only (no files modified by the task itself); the discovered lockfile inconsistency was fixed in `35ab2d9` (chore, deviation Rule 1)

**Plan metadata:** _(final docs commit — this SUMMARY + STATE/ROADMAP/REQUIREMENTS)_

## Files Created/Modified

- `MIGRATION.md` *(created, +165)* — repo-root copy-pasteable MIGRATE-01 blurb; D-13 items 1-5 incl. why-patch/why-no-NuGet rationale, the one API addition with exact signature, NOT-breaking table (incl. existing custom Adapters), upgrade steps, and both 5a/5b silent-behavior caveats with a `total > 0` guard snippet.
- `viewmodel-shell/package.json` *(modified, +1/-1)* — `"version": "0.3.12"` → `"version": "0.3.13"`. Single line; valid JSON; only file touched in Task 1.
- `README.md` *(modified, +2)* — one additive sentence: "Upgrading from a previous version? See [MIGRATION.md](./MIGRATION.md) …" after the capability-seam non-breaking paragraph.
- `viewmodel-shell/package-lock.json` *(modified, +2/-2 — deviation fix)* — self-version sync `0.3.12 → 0.3.13` (root `version` + `packages[""].version`); no dependency-tree change; keeps the tracked lockfile consistent with package.json.

## Decisions Made

None beyond the pre-locked decisions. All facts (D-10/D-10a npm `0.3.13` PATCH, D-11 NuGet `0.3.9` unchanged, D-12/D-13 MIGRATION.md content, D-09/D-15 parity boundary) were pre-locked in 02-CONTEXT.md (the area-E user correction) and executed exactly as written. The earlier stale `0.4.0` reasoning was NOT applied — `0.3.13` is final.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Version/lockfile consistency] Synced package-lock.json to 0.3.13**
- **Found during:** Task 3 (running the milestone gate; `npm install` in Gate 1 resolved the lockfile)
- **Issue:** Task 1 bumped `package.json` to `0.3.13`, but the tracked `viewmodel-shell/package-lock.json` still pinned `0.3.12` in two self-version fields. An out-of-sync lockfile is an `npm ci` / publish correctness defect (the version-bump intent of Task 1 was incomplete without it).
- **Fix:** Committed the lockfile's exact two-line self-version sync (`0.3.12 → 0.3.13`, root + `packages[""]`). Verified the diff is ONLY those two lines — no dependency-tree change.
- **Files modified:** `viewmodel-shell/package-lock.json`
- **Verification:** `git diff` shows exactly `+2/-2` self-version lines; `npm run build` ran as `@ashley-shrok/viewmodel-shell@0.3.13`; package.json remains valid JSON.
- **Committed in:** `35ab2d9` (separate chore commit, scoped to the Task 1 version-bump intent)

---

**Total deviations:** 1 auto-fixed (1 Rule 1 — correctness/version consistency)
**Impact on plan:** Necessary to complete the version bump correctly (tracked lockfile must match package.json for `npm ci`/publish). No scope creep — the only locked constraint adjacent to this is "package.json is exactly 0.3.13", which this preserves and reinforces. AGENTS.md, csproj, parity, and all D-13 content were executed exactly as the plan specified.

## Issues Encountered

**Parity harness environment file-lock flakiness (Windows) — RESOLVED, not a regression.**
- The first `cd parity && bun run run.ts` failed at the `dotnet-tasks` **prebuild** (`MSB3027`/`MSB3021` — `AshleyShrok.ViewModelShell.dll` locked by another process). Root cause: **stale orphaned demo/parity backend processes from a prior session** (a `ViewModelShell` PID started 8:56 AM — ~5h before this plan began at 13:46, plus ContactManager/ExpenseTracker/FeatureProbe/HelpDesk/Reorder/RetroBoard and 7 stale `bun` backends, all started 8:56:38 AM) holding demo DLLs and the `helpdesk-parity-bun.db` SQLite file open. This is an environment leak entirely unrelated to this plan's changes (a version string + two docs files; zero `.NET`/`server.ts`/parity-fixture change).
- **Resolution (deviation Rule 3 — auto-fix blocking issue, no files touched):** terminated the stale orphaned backend processes and removed the leftover parity SQLite artifacts, then re-ran parity from a clean environment.
- **Definitive evidence (final clean run, exit 0):**
  - `tasks` → dotnet-tasks 8 / bun-tasks 8 steps — ✓ all backends agree
  - `contacts` → dotnet-contacts 11 / bun-contacts 11 — ✓ all backends agree
  - `retro` → dotnet-retro 9 / bun-retro 9 — ✓ all backends agree
  - `expenses` → dotnet-expenses 9 / bun-expenses 9 — ✓ all backends agree
  - `helpdesk` → dotnet-helpdesk 21 / bun-helpdesk 21 — ✓ all backends agree
  - `feature-probe` → dotnet-probe 14 / bun-probe 14 / node-probe 14 — ✓ all backends agree
  - `reorder` → dotnet-reorder 11 / bun-reorder 11 — ✓ all backends agree
  - Final line: `✓ Parity tests passed`, exit 0.
- Note: rapid back-to-back parity invocations on Windows can re-trigger the same `EBUSY` SQLite-lock race during the harness's pre-run cleanup; this is a known Windows file-lock timing artifact of *successive local runs*, not a wire/fixture failure. The authoritative CI gate (`.github/workflows/parity.yml`, "Run cross-backend parity tests" step) runs on a clean Ubuntu runner after a fresh checkout with no such file-locks. A single clean local run with the environment de-contaminated reproduced a fully green 7-fixture pass, so ROADMAP criterion 3 is satisfied with recorded evidence (not silently marked).

## ROADMAP Phase 2 Success Criteria — explicit pass/fail with evidence

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `dispatch()` with FormData + `onUploadProgress` invokes callback `(sent,total)`; never fires without files / without option | **PASS** | Plan 02-02's `viewmodel-shell/test/upload-progress.test.ts` D-14 (a)/(b1)/(b2)/(c); re-confirmed green here via `npx vitest run` → 14/14 exit 0 |
| 2 | XHR binding locatable only in BrowserAdapter — grep of core `src/index.ts` for `XMLHttpRequest` returns no matches | **PASS** | `cd viewmodel-shell && npm run check:core-globals` exit 0 ("✓ AGNOSTIC-03: src/index.ts references zero platform globals") |
| 3 | Full parity suite (7 fixtures) 100% green — shared `processResponse()`/wire contract preserved | **PASS** | `cd parity && bun run run.ts` exit 0, all 7 fixtures "✓ all backends agree", "✓ Parity tests passed" (clean run; per-fixture step counts recorded above). D-15: `git status --porcelain parity/` empty |
| 4 | Copy-pasteable migration blurb: exact npm/NuGet versions, API additions, NOT-breaking list, upgrade steps | **PASS** | `MIGRATION.md` at repo root contains `0.3.13`, `0.3.9`, `(sent: number, total: number) => void`, NOT-breaking table incl. custom Adapters, `npm update`, .NET no-action, and both 5a/5b caveats with the `total > 0` guard; README points to it; automated content checks pass |

All four ROADMAP Phase 2 success criteria are satisfied with recorded command evidence.

## Threat Model Verification

- **T-02-07 (Information Disclosure — `total===0` divide-by-zero omission):** mitigated — MIGRATION.md item 5b states the `total` may be `0` indeterminate sentinel and the mandatory `total > 0` guard, with a copy-pasteable `const pct = total > 0 ? Math.round((sent / total) * 100) : null;` snippet. Automated verify required the `total > 0` string.
- **T-02-08 (Tampering — false reassurance, "progress always fires"):** mitigated — MIGRATION.md item 5a explicitly states progress fires ONLY if the adapter implements `transport` and a custom adapter without it silently falls back to fetch (upload succeeds, no events, not an error), preventing a "looks fine but uploads aren't reported" false reassurance.
- **T-02-09 (supply-chain semantics — wrong version breaking npm/NuGet alignment):** mitigated — automated asserts: package.json is exactly `0.3.13` (not `0.4.0`/`0.3.12`), csproj stays `0.3.9`, AGENTS.md `share major.minor` rule byte-unchanged (`git diff AGENTS.md` empty). Locked D-10/D-10a/D-11 enforced, not trusted.
- **T-02-10 (Repudiation — claiming parity green without running it):** mitigated — parity was actually run to a clean green completion; exact per-fixture step counts and exit codes recorded; the back-to-back-run Windows lock flake is documented honestly and the criterion is backed by a reproduced clean run + the authoritative CI gate, NOT silently passed.

No new threat surface introduced: the plan ships one version string + two docs files + a verification run; no runtime code, no wire change.

## User Setup Required

None - no external service configuration required. (.NET consumers: explicitly **no action** — NuGet unchanged at `0.3.9`.)

## Next Phase Readiness

- **MIGRATE-01 complete.** UPLOAD-01 (02-01 structural + 02-02 behavioral) and MIGRATE-01 (this plan) are both delivered. All 6 milestone requirements are now complete (AGNOSTIC-01..04 Phase 1; UPLOAD-01, MIGRATE-01 Phase 2). Phase 2 is the final phase of the milestone "Restore & Enforce Core Platform-Agnosticism".
- All four ROADMAP Phase 2 success criteria satisfied with evidence. Ready for milestone closeout / `/gsd-complete-milestone`.
- Out-of-scope pre-existing working-tree items (`.planning/config.json` modified, `CLAUDE.md` deleted, `viewmodel-shell-dotnet/nupkg/` untracked) were present before this plan (documented in 02-01/02-02 SUMMARYs) and were deliberately NOT touched.
- No blockers.

## Self-Check: PASSED

- FOUND: `MIGRATION.md`
- FOUND: `.planning/phases/02-upload-progress-milestone-closeout/02-03-SUMMARY.md`
- FOUND commit: `6caac19` (Task 1 — package.json 0.3.13)
- FOUND commit: `31aa2e6` (Task 2 — MIGRATION.md + README pointer)
- FOUND commit: `35ab2d9` (Task 3 deviation — package-lock.json sync)
- VERIFIED: `viewmodel-shell/package.json` == `"version": "0.3.13"`
- VERIFIED: `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` == `<Version>0.3.9</Version>` (unchanged)
- VERIFIED: `git diff AGENTS.md` empty (versioning rule byte-unchanged)
- VERIFIED: parity exit 0, 7/7 fixtures "all backends agree", "✓ Parity tests passed"

---
*Phase: 02-upload-progress-milestone-closeout*
*Completed: 2026-05-15*
