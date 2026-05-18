---
phase: 05-canonical-examples-0-4-0-release-closeout
plan: 05
subsystem: release
tags: [release, versioning, semver, changelog, migration, npm, nuget, docs]

# Dependency graph
requires:
  - phase: 05-canonical-examples-0-4-0-release-closeout
    plan: 01
    provides: "themes/dark-purple.css (the one-line dark restore path the MIGRATION/CHANGELOG cites); the --vms-warning #c89610->#a37510 shipped-default AA tighten the migration copy must document (05-01 forward-note)"
  - phase: 04-preset-grid-layout
    provides: "the layout enum — the wire-format change that forces the aligned 0.4.0 minor per the AGENTS.md major.minor rule"
provides:
  - "npm @ashley-shrok/viewmodel-shell 0.4.0 (package.json + package-lock.json)"
  - "NuGet AshleyShrok.ViewModelShell 0.4.0 (.csproj <Version>)"
  - "Consolidated CHANGELOG ## 0.4.0 milestone entry (theme/density/card + layout enum + palette re-baseline + de-chrome)"
  - "MIGRATION ## Upgrading to 0.4.0 section (why-MINOR-aligned + dark->light intentional-not-breaking + --vms-warning AA tighten + one-line restore)"
  - "README accuracy fix (no false 'ships a dark-purple theme'; all 12 themes listed)"
  - "Complete classified version-string enumeration table (research item 3)"
affects: [05-06, release-closeout, consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Consolidated one-section-per-milestone CHANGELOG/MIGRATION entry (D-26) — symmetric why-MINOR-aligned mirroring the existing 0.3.13 why-PATCH"
    - "Version-string completeness sweep before bump (research item 3) — every source-of-truth location classified, package-lock.json kept in sync with package.json"

key-files:
  created:
    - .planning/phases/05-canonical-examples-0-4-0-release-closeout/05-05-SUMMARY.md
  modified:
    - viewmodel-shell/package.json
    - viewmodel-shell/package-lock.json
    - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
    - CHANGELOG.md
    - MIGRATION.md
    - README.md

key-decisions:
  - "package-lock.json (viewmodel-shell/) IS an authoritative npm version-string location (2 spots: root .version + packages[''].version) — bumped in sync with package.json; a stale lockfile is exactly the classic missed-location closeout failure research item 3 guards against"
  - "AGENTS.md major.minor-alignment RULE TEXT (line 13) is GOVERNING and stays byte-unchanged — the layout enum is a wire-format change, so the rule REQUIRES an aligned minor (symmetric to the 0.3.13 why-PATCH); confirmed git status --short AGENTS.md empty"
  - "The dark->light flip AND the one-variable --vms-warning #c89610->#a37510 shipped-default AA tighten (05-01 forward-note) are both documented as intentional default-appearance changes, NOT wire/API/ViewNode breaks, with the one-line themes/dark-purple.css restore (D-05/D-26)"

patterns-established:
  - "Symmetric SemVer-rationale framing: 0.3.13 'why PATCH' (no wire change) <-> 0.4.0 'why MINOR aligned' (layout wire change) — same governing AGENTS.md rule, opposite outcome"

requirements-completed: [RELEASE-01, RELEASE-03]

# Metrics
duration: 3min
completed: 2026-05-18
---

# Phase 5 Plan 05: 0.4.0 Release Closeout (Aligned Version Bump + Consolidated MIGRATION/CHANGELOG) Summary

**Bumped npm + NuGet to aligned `0.4.0` (the layout wire-format change forces the minor per the AGENTS.md major.minor rule), wrote one consolidated CHANGELOG `## 0.4.0` + one MIGRATION `## Upgrading to 0.4.0` framing the dark→light flip and the one-variable `--vms-warning` AA tighten as intentional default changes (not wire/API breaks) with the one-line `themes/dark-purple.css` restore, and fixed the now-false README styling claim — with every version-string source-of-truth location enumerated and confirmed bumped (no missed location).**

## Performance

- **Duration:** ~3min
- **Started:** 2026-05-18T05:10:35Z
- **Completed:** 2026-05-18T05:13:13Z
- **Tasks:** 2
- **Files modified:** 6

## Research Item 3 — Complete Classified Version-String Enumeration Table

Repo-wide sweep for `0.3.14` (npm), `0.3.10` (NuGet), and version-shaped strings, excluding `node_modules/`, `.planning/`, `.claude/`, and build-generated `bin/`/`obj/` (refresh on rebuild, NOT a release surface). **Every** source-of-truth hit classified into exactly one bucket:

| # | Location | Current value | Classification | Target / Action | Status |
|---|----------|---------------|----------------|-----------------|--------|
| 1 | `viewmodel-shell/package.json` line 3 `"version"` | `0.3.14` | **MUST bump (npm)** | `0.4.0` | ✅ Bumped (Task 2A) |
| 2 | `viewmodel-shell/package-lock.json` line 3 root `.version` | `0.3.14` | **MUST bump (npm — lockfile mirror)** | `0.4.0` | ✅ Bumped (Task 2A, sync) |
| 3 | `viewmodel-shell/package-lock.json` line 9 `packages[""].version` | `0.3.14` | **MUST bump (npm — lockfile self-entry)** | `0.4.0` | ✅ Bumped (Task 2A, sync) |
| 4 | `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` line 13 `<Version>` | `0.3.10` | **MUST bump (NuGet)** | `0.4.0` | ✅ Bumped (Task 2B) |
| 5 | `CHANGELOG.md` | n/a (new entry) | **MUST add NEW entry (not bump)** | new `## 0.4.0` ABOVE `## 0.3.14` | ✅ Added (Task 2C) |
| 6 | `MIGRATION.md` | n/a (new entry) | **MUST add NEW section (not bump)** | new `## Upgrading to 0.4.0` ABOVE `## Upgrading to npm 0.3.13` | ✅ Added (Task 2D) |
| 7 | `README.md` line ~54 "ships a dark-purple theme" + line ~61 theme list | false claim + missing `dark-purple` | **Accuracy-touch (D-22)** | light default stated; `dark-purple` added (all 12 listed) | ✅ Fixed (Task 2E) |
| 8 | `AGENTS.md` line 13 major.minor-alignment **rule text** | (no version numbers in the rule text) | **GOVERNING rule — rule TEXT byte-unchanged** | only NUMBERS change elsewhere; AGENTS.md not edited (Plan 04 owns it) | ✅ Confirmed byte-unchanged (`git status --short AGENTS.md` empty) |
| 9 | Prior `CHANGELOG.md` / `MIGRATION.md` `0.3.x` entries | `0.3.1`–`0.3.14` | **Historical — DO NOT touch** | unchanged (D-26: intermediate `0.3.x` dev states are non-events, not re-enumerated) | ✅ Untouched |
| 10 | `demo/*/frontend/package-lock.json` (6 files) | (no `0.3.14`/`0.3.10` refs) | **NOT a release surface** | demos consume `viewmodel-shell` via local Vite alias, not a published npm dep — zero version-string hits, nothing to bump | ✅ Verified zero hits, excluded |
| 11 | `demo/**/bin/**`, `demo/**/obj/**`, `.claude/worktrees/**/{bin,obj}/**` (`*.deps.json`, `project.assets.json`, `*.nuget.dgspec.json`) | `0.3.x` restore artifacts | **Build-generated — DO NOT hand-edit** | refreshes on Plan 06 .NET rebuild; in-repo demos use a local `ProjectReference` so bin/obj numbers are not a release surface | ✅ Excluded with refresh note |

**Note on the lockfile (rows 2–3 — beyond the plan's explicit `<interfaces>` list):** the plan's `<interfaces>` enumerated package.json/.csproj/CHANGELOG/MIGRATION/README. The repo-wide sweep mandated by research item 3 ("enumerate EVERY version-string source-of-truth location before bumping … a missed bump location is a classic closeout failure") additionally surfaced `viewmodel-shell/package-lock.json` carrying `"version": "0.3.14"` at two spots (it is git-tracked and mirrors `package.json`). Leaving it stale at `0.3.14` while `package.json` says `0.4.0` would be precisely the missed-location failure this research item exists to prevent (npm would otherwise rewrite it on the next `install`, but shipping it inconsistent is the failure mode). It was therefore bumped in sync — recorded as a documented enumeration completeness finding (a small additive correctness step, Rule 2: missing critical correctness for a clean release).

### AGENTS.md major.minor rule cross-check (research item 3, second half)

Confirmed `AGENTS.md` line 13 is the GOVERNING rule:

> *"The two packages share major.minor — bumping a `ViewNode` type or wire-format change bumps both sides."*

The Phase 4 `layout?` enum is a **wire-format change**, so this rule **REQUIRES** the `major.minor` to move and **REQUIRES** both packages to bump together → aligned `0.4.0` on npm + NuGet. This is the *same rule, opposite outcome* to `0.3.13` (which had zero wire change → the rule held `major.minor` fixed → npm-only PATCH). The rule **TEXT itself is byte-unchanged** — only the version *numbers* change, and they change in `package.json`/`package-lock.json`/`.csproj`, never in the rule statement. `AGENTS.md` is not modified by this plan (Plan 04 owns it; `git status --short AGENTS.md` is empty, confirming byte-identity).

## Final Bumped Values

| Package | Source of truth | Before | After |
|---------|-----------------|--------|-------|
| npm `@ashley-shrok/viewmodel-shell` | `viewmodel-shell/package.json` `"version"` | `0.3.14` | **`0.4.0`** |
| npm (lockfile mirror) | `viewmodel-shell/package-lock.json` root `.version` + `packages[""].version` | `0.3.14` (×2) | **`0.4.0`** (×2, in sync) |
| NuGet `AshleyShrok.ViewModelShell` | `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>` | `0.3.10` | **`0.4.0`** |

npm + NuGet **aligned at `0.4.0`** (RELEASE-01). Validated: `package.json` parses as valid JSON; lockfile both spots = `0.4.0`; `.csproj` `<Version>0.4.0</Version>`.

## Accomplishments

- **Task 1 (research item 3):** complete classified version-string enumeration produced (table above) BEFORE any bump — every source-of-truth location classified, the lockfile surfaced and included, build-generated bin/obj excluded with a refresh note, the AGENTS.md major.minor rule confirmed governing with its TEXT byte-unchanged. No edits in Task 1 (enumeration only, per acceptance criteria).
- **Task 2:** npm `package.json` + `package-lock.json` `0.3.14`→`0.4.0`; NuGet `.csproj` `<Version>` `0.3.10`→`0.4.0` (aligned). One consolidated CHANGELOG `## 0.4.0` milestone entry positioned ABOVE `## 0.3.14` in the existing one-section-per-release format. One MIGRATION `## Upgrading to 0.4.0` section ABOVE `## Upgrading to npm 0.3.13` mirroring its structure (exact-versions table, why-MINOR-aligned symmetric to the 0.3.13 why-PATCH, dark→light intentional-not-breaking framing, the `--vms-warning` AA-tighten caveat, the one-line restore). README accuracy-fixed (D-22).
- The **05-01 mandatory forward-note honored:** both CHANGELOG and MIGRATION explicitly document the one-variable `--vms-warning` `#c89610`→`#a37510` shipped-default WCAG-AA tightening (with the exact before/after ratios 2.68/2.51/2.36:1 → 4.11/3.84/3.62:1 cited from 05-01-SUMMARY) ALONGSIDE the dark→light default flip, framed as part of the honest "the shipped default appearance changed; here's exactly what and how to restore" migration copy. `themes/light-purple.css` byte-unchanged is explicitly stated (consumers importing it explicitly still get `#c89610`).

## Decisions Made

- **`package-lock.json` is an authoritative npm version-string location and was bumped in sync** — surfaced by the research-item-3 repo-wide sweep (not in the plan's explicit `<interfaces>` list); leaving it stale is the exact missed-location closeout failure the research item guards against. Recorded as an enumeration completeness finding.
- **AGENTS.md confirmed governing and untouched** — the major.minor rule TEXT is byte-unchanged; only version numbers moved (and only in package.json/lockfile/.csproj). Plan 04 owns AGENTS.md; verified `git status --short AGENTS.md` empty.
- **One consolidated milestone entry (D-26)** — single `## 0.4.0` CHANGELOG + single `## Upgrading to 0.4.0` MIGRATION covering the whole milestone (theme/density/card + layout enum + palette re-baseline + de-chrome); intermediate `0.3.x` dev states NOT separately enumerated (non-events).
- **Dark→light + `--vms-warning` AA tighten framed as intentional default changes, NOT breaks (D-05)** — explicit "additive optional closed unions; omitted = byte-identical; existing apps that set their own `:root`/import a theme are unaffected; prior look one line away via `themes/dark-purple.css`"; same honest-framing discipline as the 0.3.13 silent-behavior caveats.

## Deviations from Plan

### Auto-added missing critical correctness

**1. [Rule 2 - Missing critical correctness] `viewmodel-shell/package-lock.json` bumped in sync with `package.json`**
- **Found during:** Task 1 (research item 3 — the mandated repo-wide version-string sweep)
- **Issue:** The plan's `<interfaces>` enumerated package.json/.csproj/CHANGELOG/MIGRATION/README but not the git-tracked `package-lock.json`, which carries `"version": "0.3.14"` at two spots (root `.version` + `packages[""].version`) mirroring `package.json`. Research item 3 explicitly mandates enumerating EVERY version-string source-of-truth location ("a missed bump location is a classic closeout failure"). Shipping the lockfile stale at `0.3.14` while `package.json` is `0.4.0` is precisely that failure mode.
- **Fix:** Bumped both lockfile version spots to `0.4.0` in sync with `package.json` (no dependency-tree change — only the package's own self-version mirror). Validated the lockfile still parses as valid JSON and both spots = `0.4.0`.
- **Files modified:** `viewmodel-shell/package-lock.json`
- **Commit:** `85f2c20`

No Rule 1/3/4 deviations. No architectural changes. No checkpoints (fully autonomous plan, both tasks `type="auto"`).

## Out-of-Scope Items (NOT touched — correct per scope boundary)

- `D CLAUDE.md` (pre-existing deletion in working tree), `?? .claude/worktrees/`, `?? parity-verify-out.txt` — pre-existing working-tree noise NOT caused by this plan's tasks; this is a version+docs plan. Not staged, not gitignored — a candidate for the Plan 06 hygiene pass (consistent with the deferred-items discipline established in 05-02/05-03). `.claude/` and `parity-verify-out.txt` are correctly excluded from the version-string sweep (not a release surface).
- `demo/**/bin/**`, `demo/**/obj/**` NuGet restore artifacts carrying old `0.3.x` — build-generated, refresh on the Plan 06 .NET rebuild; in-repo demos use a local `ProjectReference` so these are not a release surface. NOT hand-edited (per plan instruction).

## Issues Encountered

None. The only deviation was the documented Rule-2 lockfile completeness fix (above), which is the research item working as intended (the sweep caught a location the plan's `<interfaces>` list did not pre-enumerate). Sequential mode, normal commit WITH hooks (no `--no-verify`); hooks ran clean.

## User Setup Required

None — no external service configuration. (Actual `npm publish` / `dotnet nuget push` to the public registries is a maintainer release action outside this planning surface; the repo source-of-truth is now at `0.4.0` aligned and ready.)

## Next Phase Readiness

- **RELEASE-01 + RELEASE-03 satisfied:** npm + NuGet aligned at `0.4.0`, every version-string source-of-truth location enumerated and confirmed bumped (no missed-location closeout failure), the milestone migration story honestly framed.
- **05-06 (release closeout / RELEASE-02/04):** the version + docs surface is final at `0.4.0`. Parity wire suite is unaffected by this plan (version strings + Markdown + a README accuracy fix have zero parity surface — `git diff` is a version-number change + release notes + a README factual fix, no secret-shaped strings, no new dependency/install-script change; T-05-05 hygiene confirmed). The AA guard + parity gates from 05-01 remain the concluding RELEASE-02/04 gates.
- AGENTS.md major.minor rule text byte-unchanged (Plan 04 verifies the AGENTS.md side; this plan confirmed `git status --short AGENTS.md` empty).

## Known Stubs

None — this plan changes version strings, adds two Markdown release entries, and applies one README accuracy fix. Nothing stubbed, no placeholder text, no unwired data source. No new wire/model field, no new design token, no new CSS rule (per the plan's critical constraints).

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary. `git diff` is a version-number bump + Markdown release notes + a README factual correction; no secret-shaped strings, no new dependency, no install-script change (matches the plan's `<threat_model>` T-05-05 `accept` disposition, hygiene-only).

## Self-Check: PASSED

- Files verified present: `viewmodel-shell/package.json`, `viewmodel-shell/package-lock.json`, `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj`, `CHANGELOG.md`, `MIGRATION.md`, `README.md`, `.planning/phases/05-canonical-examples-0-4-0-release-closeout/05-05-SUMMARY.md` — all FOUND.
- Commit verified present: `85f2c20` — FOUND in `git log`.
- Task 2 automated verification re-run: `OK 0.4.0 aligned` (npm 0.4.0 + NuGet `<Version>0.4.0</Version>` + CHANGELOG `## 0.4.0` above `## 0.3.14` + MIGRATION `Upgrading to 0.4.0` + `themes/dark-purple.css` in both CHANGELOG & MIGRATION + README has `dark-purple` & no longer "ships a dark-purple theme").
- `package.json` + `package-lock.json` parse as valid JSON; `.csproj` `<Version>0.4.0</Version>`; lockfile both spots = `0.4.0`; `git status --short AGENTS.md` empty (rule text byte-unchanged).
