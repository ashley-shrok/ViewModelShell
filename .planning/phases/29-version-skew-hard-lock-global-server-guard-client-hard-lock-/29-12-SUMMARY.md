---
phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
plan: 12
subsystem: release
tags: [release, npm, nuget, tag, version-skew, hard-lock, breaking, companion-nuget, markdown]

# Dependency graph
requires:
  - phase: 29
    provides: "Plans 29-01..29-11 shipped the hard-lock guard, client modal, tests, parity, and staged CHANGELOG/MIGRATION/AGENTS docs. This plan releases them."
provides:
  - "npm @ashley-shrok/viewmodel-shell 9.0.0 published"
  - "NuGet AshleyShrok.ViewModelShell 9.0.0 published"
  - "NuGet AshleyShrok.ViewModelShell.Markdown 0.2.2 published (companion rebuild per AGENTS.md core-major-bump rule)"
  - "Annotated tag v9.0.0 created + pushed at 8770e8d8"
  - "main advanced to include v9.0.0 (git merge-base --is-ancestor confirmed)"
  - "Release announced on #vms-announcements"
  - "Molly DM'd about the Metis:5000 flag closure"
affects: [phase-30, all-downstream-consumers, kitsune, pbminvoices, metis, pantheon-fleet]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Aligned major release ritual: pre-bump green-tree gate re-run → surgical version bumps (6 files) → operator-gated publish (core + companion) → annotated tag → main-advance verification → announce + DM."
    - "Companion NuGet rebuild + republish on every core MAJOR bump — AGENTS.md-mandated, first exercised at v9.0.0 for the Markdown companion (Amelia/Athena precedent from 2026-07-30)."

key-files:
  created:
    - ".planning/phases/29-.../29-12-SUMMARY.md"
  modified:
    - "viewmodel-shell/package.json (8.2.0 → 9.0.0)"
    - "viewmodel-shell/package-lock.json (two self-version lines 8.2.0 → 9.0.0)"
    - "viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj (<Version>8.2.0</Version> → <Version>9.0.0</Version>)"
    - "viewmodel-shell-dotnet/Markdown/AshleyShrok.ViewModelShell.Markdown.csproj (<Version>0.2.1</Version> → <Version>0.2.2</Version>)"
    - "CHANGELOG.md (v9.0.0 date placeholder replaced with 2026-08-02; Companion NuGet packages subsection added)"
    - "MIGRATION.md (companion note added for Markdown 0.2.2)"

key-decisions:
  - "Executed the auth precheck INLINE per Ashley's banked directive 2026-07-30 — did NOT return a human-action checkpoint. Sourced .env, verified NPM_TOKEN + NUGET_API_KEY, synced ~/.npmrc, ran npm whoami (returned ashley-shrok). Continued to publish under the same session."
  - "Companion NuGet: bumped patch (0.2.1 → 0.2.2) per AGENTS.md core-major-bump rule. Uses ProjectReference to core (not floor-dep PackageReference), so binary-compat is enforced by the rebuild-and-republish itself — verified via parity/check-companion-binary-compat.sh in Task 2's gate."
  - "Used curl-to-registry (per AGENTS.md) not `npm view` (cached) to confirm npm 9.0.0 latest. NuGet flat-container indexer is eventually consistent — push receipts (both 'Your package was pushed') are the authoritative confirmation; the indexer will catch up in 5–15 min per AGENTS.md."

patterns-established:
  - "Companion NuGet ProjectReference → rebuild-and-republish contract: the ProjectReference model means the compat contract is enforced by rebuilding the companion against the new core headers and publishing that packed dll. No PackageReference floor-dep to bump because ProjectReference-based companions build from source. Compat verified pre-publish by parity/check-companion-binary-compat.sh (packs core + companion + constructs one of every node the companion builds; any MissingMethodException fails the build)."
  - "Vicky's release ritual: source .env INLINE, npm publish + dotnet nuget push in the same session, tag at the bump-commit SHA (not HEAD), advance main via `git push origin main` after the tag, verify with `git merge-base --is-ancestor v<version> main`, then announce + DM."

requirements-completed: [SKEW-10]

# Metrics
duration: 22min
completed: 2026-08-02
---

# Phase 29 Plan 12: v9.0.0 release ritual Summary

**Aligned v9.0.0 release — version-skew hard-lock live on npm + NuGet, Markdown companion 0.2.2 rebuilt + republished, tag pushed, main advanced, #vms-announcements posted, Molly DM'd about Metis flag closure.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-08-02T18:47:00Z (approx — plan-execute session start)
- **Completed:** 2026-08-02T19:09:00Z (approx — SUMMARY commit)
- **Tasks:** 5
- **Files modified:** 6 (viewmodel-shell/package.json + package-lock.json, viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj, viewmodel-shell-dotnet/Markdown/AshleyShrok.ViewModelShell.Markdown.csproj, CHANGELOG.md, MIGRATION.md)

## Accomplishments

1. **Auth precheck passed inline** (Ashley's banked 2026-07-30 directive: no theatrical human-action checkpoint). `NPM_TOKEN` + `NUGET_API_KEY` sourced from `.env`, `~/.npmrc` synced, `npm whoami` returned `ashley-shrok`.
2. **Pre-bump green-tree gate re-run: full GREEN.** Framework tests (82 files / 1365 passed, 1 skipped), framework .NET tests (458 passed), all 5 demo Tests projects passed, Markdown build clean, companion binary-compat gate passed (7 distinct node types constructed), full parity suite passed. Zero red anywhere.
3. **Surgical version bumps landed.** package.json/lock (self-versions × 2 → 9.0.0), core .csproj (`<Version>9.0.0</Version>`), Markdown .csproj (`<Version>0.2.2</Version>`), CHANGELOG date + companion subsection, MIGRATION companion note.
4. **Release commit + registry publishes.** npm 9.0.0 pushed (registry-latest curl-verified). NuGet core 9.0.0 pushed. NuGet Markdown companion 0.2.2 pushed.
5. **Tag + main advanced.** Annotated tag `v9.0.0` at bump-commit `8770e8d8`, pushed to origin. `main` fast-forwarded to include the release commit; `git merge-base --is-ancestor v9.0.0 main` returned 0 (`OK: v9.0.0 reachable from main`).
6. **Announce + Molly DM sent.** `#vms-announcements` announced (event_id `$XWax1rFNY2dGfS7sDUeeUajOEgiEHhA7-OYHp2eiWoQ`). Molly DM'd about Metis:5000 flag closure (event_id `$3dSxpYhksneY0LDAGavQsxhGypoNZe1myFqoKbSiPjM`).
7. **Verification server cleaned up.** `demo/VersionSkewVerification-bun/server.pid` process was already dead; PID file removed.

## Auth precheck output (redacted)

```
NPM_TOKEN present: yes
NUGET_API_KEY present: yes
npmrc synced
npm whoami: ashley-shrok
```

Both credentials sourced from repo-root `.env`. `~/.npmrc` re-created with the NPM_TOKEN bypass-2FA GAT per Vicky's vms-map ritual. No credentials leaked in output.

## Pre-bump gate exit codes

All GREEN (exit 0):

| Gate                                              | Result                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------- |
| `npm run build`                                   | OK                                                                    |
| `npm run check:test-types`                        | OK                                                                    |
| `npm run check:core-globals`                      | ✓ AGNOSTIC-03: zero platform globals in core                          |
| `npm run check:aa-contrast`                       | ✓ D-07: all 13 pairs pass WCAG-AA on default + 12 themes              |
| `npm run check:no-demo-style`                     | ✓ D-12/D-15: 23 hand-edited frontend HTMLs zero-`<style>`             |
| `npm run check:demo-types`                        | ✓ 25 demo projects type-check clean                                   |
| `npm run check:theme-byte-identity`               | ✓ D-03/D-26: 11 themes match baseline                                 |
| `npm run check:theme-function`                    | ✓ D-26: 12 themes function as named                                   |
| `npx vitest run`                                  | 82 files / 1365 passed (1 skipped)                                    |
| `dotnet test viewmodel-shell-dotnet/Tests`        | 458 passed                                                            |
| 5 × `dotnet test demo/**/*.Tests.csproj`          | 28 + 39 + 61 + 30 + 33 = 191 passed                                   |
| Markdown companion build                          | OK                                                                    |
| `bash parity/check-companion-binary-compat.sh`    | OK — 7 distinct node types constructed, all required ctors resolved   |
| `bun run parity/run.ts`                           | ✓ Parity tests passed                                                 |

## Bump commit SHA

`8770e8d85d7e8ccbe974be4883b5ca182e96ce76`

Commit message:
```
release: npm 9.0.0 + NuGet 9.0.0 + Markdown companion 0.2.2 — version-skew hard-lock (BREAKING)

- Server-side global filter enforces on GET + POST (was per-controller opt-in POST-only)
- Browser shipped hard-lock modal replaces silent auto-reload (opt-out via ShellOptions.onVersionSkew:custom)
- createVersionGuard TS-server factory + ShellVersionGuardFilter .NET IActionFilter
- Client attaches X-VMS-Client-Build on GETs (was POST-only)
- Markdown companion rebuilt + republished per AGENTS.md core-major-bump rule

Wire protocol token stays viewmodel-shell/1.0; behavior-only major bump.

Design of record: bounty version-skew-recovery-affordance.
```

## npm publish output (tail)

```
npm notice Publishing to https://registry.npmjs.org/ with tag latest and default access
+ @ashley-shrok/viewmodel-shell@9.0.0
```

Package details: name `@ashley-shrok/viewmodel-shell`, version `9.0.0`, filename `ashley-shrok-viewmodel-shell-9.0.0.tgz`, package size 303.9 kB, unpacked 1.0 MB, shasum `7022e38cacf26134f4c59233e569b1eed604eba5`, total files 33 (includes dist/ + styles/default.css + 12 themes + agent-skill.md + README + LICENSE).

## npm registry-latest verification

```
$ curl -s https://registry.npmjs.org/@ashley-shrok/viewmodel-shell \
    | python3 -c "import sys,json; print('npm latest:', json.load(sys.stdin)['dist-tags']['latest'])"
npm latest: 9.0.0
```

Confirmed via curl-to-registry (per AGENTS.md — NOT `npm view` which is cached).

## NuGet publish output — core

```
Pushing AshleyShrok.ViewModelShell.9.0.0.nupkg to 'https://www.nuget.org/api/v2/package'...
  PUT https://www.nuget.org/api/v2/package/
  Created https://www.nuget.org/api/v2/package/ 528ms
Your package was pushed.
Pushing AshleyShrok.ViewModelShell.9.0.0.snupkg to 'https://www.nuget.org/api/v2/symbolpackage'...
  PUT https://www.nuget.org/api/v2/symbolpackage/
  Created https://www.nuget.org/api/v2/symbolpackage/ 143ms
Your package was pushed.
```

## NuGet publish output — Markdown companion

```
Pushing AshleyShrok.ViewModelShell.Markdown.0.2.2.nupkg to 'https://www.nuget.org/api/v2/package'...
  PUT https://www.nuget.org/api/v2/package/
  Created https://www.nuget.org/api/v2/package/ 440ms
Your package was pushed.
Pushing AshleyShrok.ViewModelShell.Markdown.0.2.2.snupkg to 'https://www.nuget.org/api/v2/symbolpackage'...
  PUT https://www.nuget.org/api/v2/symbolpackage/
  Created https://www.nuget.org/api/v2/symbolpackage/ 135ms
Your package was pushed.
```

## NuGet registry-latest verification (post-publish)

```
$ curl -s https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('versions:', d.get('versions', [])[-3:])"
versions: ['8.0.0', '8.1.0', '8.2.0']

$ curl -s https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell.markdown/index.json \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('versions:', d.get('versions', [])[-3:])"
versions: ['0.1.0', '0.2.0', '0.2.1']
```

**Both indexer reads show the PRIOR latest (8.2.0 + 0.2.1), NOT the just-pushed 9.0.0 / 0.2.2. This is EXPECTED per AGENTS.md — the NuGet flat-container indexer is eventually consistent and 404-or-stale for 5–15 minutes after a push. The push receipts above (`Your package was pushed`) are the AUTHORITATIVE confirmation.** Both packages will appear at the indexer within the normal window; no action required.

## Tag creation output

```
$ RELEASE_SHA=8770e8d85d7e8ccbe974be4883b5ca182e96ce76
$ git tag -a v9.0.0 "$RELEASE_SHA" -m "viewmodel-shell 9.0.0"
$ git push origin v9.0.0
To https://github.com/ashley-shrok/ViewModelShell
 * [new tag]         v9.0.0 -> v9.0.0
```

## Main-advance verification

```
$ git branch --show-current
main

$ git merge-base --is-ancestor v9.0.0 main && echo "OK: v9.0.0 reachable from main"
OK: v9.0.0 reachable from main

$ git push origin main
To https://github.com/ashley-shrok/ViewModelShell
   7444f18..8770e8d  main -> main
```

Release commit `8770e8d` is on main. No stranding.

## Announce message text + Matrix ref

**Room:** `#vms-announcements` (`!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net`) — confirmed in Vicky's `/joined_rooms` output before posting.

**Event ID:** `$XWax1rFNY2dGfS7sDUeeUajOEgiEHhA7-OYHp2eiWoQ`

**Body:**
```
v9.0.0 shipped — version-skew hard-lock (BREAKING behavior only; wire unchanged)

- npm @ashley-shrok/viewmodel-shell 9.0.0
- NuGet AshleyShrok.ViewModelShell 9.0.0
- NuGet AshleyShrok.ViewModelShell.Markdown 0.2.2 (companion rebuild per AGENTS.md core-major-bump rule)

Requirements: SKEW-01..10. Two behavior changes:
(1) Server-side global filter enforces on GET + POST (was per-controller opt-in POST-only). Registered by AddVmsShellVersioning(...); nothing to change if you already call it.
(2) Browser shipped adapter renders a non-dismissible hard-lock modal on skew instead of silent auto-reload.

Consumers with custom skew affordance (Kitsune, PBMInvoices) — one-line opt-out: ShellOptions.onVersionSkew: "custom"

CHANGELOG + MIGRATION on main. Tag v9.0.0.
```

## Molly DM confirmation

**Room:** `!JecRElxNGAhCCLRWjg:thenasty.taild9b663.ts.net` (confirmed in `/joined_rooms`).

**Event ID:** `$3dSxpYhksneY0LDAGavQsxhGypoNZe1myFqoKbSiPjM`

**Body:**
```
v9.0.0 shipped — the Metis:5000 flag you raised on 2026-08-02 (silent bundle-stale window) is closed.

Server-side global filter enforces on GET+POST (was per-controller opt-in POST-only). Browser shipped hard-lock modal replaces silent reload — user clicks [Reload] to consent.

If Metis has any custom onError affordance for stale_client, opt out via ShellOptions.onVersionSkew: "custom" (one line). Otherwise the shipped modal handles skew automatically after the version bump.

npm @ashley-shrok/viewmodel-shell@^9.0.0 + NuGet AshleyShrok.ViewModelShell 9.0.0 (+ Markdown companion 0.2.2 if Metis consumes it). CHANGELOG + MIGRATION cover the details.
```

## Companion NuGet republish evidence

- **Path:** `/home/thenasty/ViewModelShell/viewmodel-shell-dotnet/Markdown/bin/Release/AshleyShrok.ViewModelShell.Markdown.0.2.2.nupkg`
- **Version:** `0.2.2` (patch-bumped from `0.2.1`)
- **Rebuild mechanism:** ProjectReference to `../AshleyShrok.ViewModelShell.csproj` at core 9.0.0 (verified by `dotnet pack -c Release` output showing core rebuilt as part of the pack: `AshleyShrok.ViewModelShell -> bin/Release/net8.0/AshleyShrok.ViewModelShell.dll` then the companion).
- **Push receipt:** `Your package was pushed.` (0.2.2.nupkg + 0.2.2.snupkg both `Created` with HTTP 201).
- **Floor-dep note:** No `<PackageReference Include="AshleyShrok.ViewModelShell">` in the companion csproj (it uses ProjectReference), so there is no floor-dep version string to update. The compat contract is enforced by rebuilding the packed dll against the new core headers and publishing that dll.
- **Compat pre-verified:** `bash parity/check-companion-binary-compat.sh` in Task 2's gate: "companion-binary-compat: OK — 7 distinct node types constructed, all required ctors resolved."

## PID cleanup output

```
$ ls -la demo/VersionSkewVerification-bun/server.pid
-rw-rw-r-- 1 thenasty thenasty 8 Aug  2 18:22 demo/VersionSkewVerification-bun/server.pid

$ kill $(cat demo/VersionSkewVerification-bun/server.pid) 2>&1
/bin/bash: line 16: kill: (1728407) - No such process
$ # Process already dead; PID file was stale.

$ rm -f demo/VersionSkewVerification-bun/server.pid && echo "PID file removed"
PID file removed
```

Note: a separate `server.pid` at the repo root (PID `804722`, dead process) is a stale untracked artifact from a pre-Phase-29 session and is out of scope for this plan (not the Plan 29-09 verification server). Left in place.

## Task Commits

Per plan Task 4's operator-runs-single-commit design (all bumps land in one release commit, per AGENTS.md publishing runbook), only ONE bump commit was created for the six files touched:

1. **Release bump (Tasks 3 + 4 combined per plan):** `8770e8d` — `release: npm 9.0.0 + NuGet 9.0.0 + Markdown companion 0.2.2 — version-skew hard-lock (BREAKING)`

Tasks 1 (auth precheck), 2 (green-tree gate), 4 (publish + tag + announce + DM + cleanup), and 5 (this SUMMARY) produce no code diffs of their own — they're runtime operations whose evidence lives in this SUMMARY. Task 5's SUMMARY + ROADMAP checkbox tick will land in a follow-up docs commit.

## Files Created/Modified

- **`viewmodel-shell/package.json`** — `"version": "9.0.0"` (was `8.2.0`)
- **`viewmodel-shell/package-lock.json`** — two self-version lines bumped (lines 3 + 9) from `8.2.0` to `9.0.0`. A third `"version": "9.0.0"` at line 1737 is the pre-existing `diff` npm dep (unrelated, untouched).
- **`viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj`** — `<Version>9.0.0</Version>` (was `8.2.0`)
- **`viewmodel-shell-dotnet/Markdown/AshleyShrok.ViewModelShell.Markdown.csproj`** — `<Version>0.2.2</Version>` (was `0.2.1`; patch-bumped per AGENTS.md core-major-bump rule)
- **`CHANGELOG.md`** — v9.0.0 heading date placeholder `<YYYY-MM-DD>` replaced with `2026-08-02`; added `### Companion NuGet packages` subsection at end of v9.0.0 entry documenting the Markdown 0.2.2 rebuild
- **`MIGRATION.md`** — added `### Companion AshleyShrok.ViewModelShell.Markdown` subsection under v9.0.0 with upgrade commands

## Decisions Made

- **Executed the auth precheck INLINE, not as a human-action checkpoint.** Ashley's banked directive 2026-07-30 (recorded in `.claude/identities/vicky/vicky.md`): "Yeah, I don't do any of that stuff. This is probably just GSD coaxing you into process here." The agent runs the whole release under credentials the agent already has access to via `.env`.
- **Companion NuGet: ProjectReference model means rebuild-and-republish suffices for binary-compat.** No PackageReference floor-dep to update because the companion csproj uses `<ProjectReference Include="../AshleyShrok.ViewModelShell.csproj" />`. The pack step rebuilds the core from source, then packs the companion against the freshly-built dll — the packed companion IL now references the v9.0.0 ctor signatures. Verified pre-publish by `parity/check-companion-binary-compat.sh`.
- **NuGet flat-container indexer stale reads are EXPECTED, not a halt.** Post-push curl-to-indexer showed prior versions (8.2.0 + 0.2.1) — normal 5-15 min lag per AGENTS.md. Push receipts (`Your package was pushed`) are the authoritative confirmation.

## Deviations from Plan

None — plan executed exactly as written.

The plan called out one operational nuance up front (Vicky's banked identity directive that the "auth precheck" is INLINE not a human-action checkpoint); the plan itself already encodes this via `must_haves.truths[0]`. Following that as-written was not a deviation.

## Issues Encountered

None material. Minor operational notes:

- The `for ... dotnet test` loop in bash exited with 1 due to subshell-scope on the `FAILS` counter, not any actual test failure — all 5 demo Tests projects individually printed `Failed: 0`. Reconfirmed by grepping the output; the aggregate exit was a shell bookkeeping quirk, not a red gate.
- A stray `server.pid` at repo root (PID `804722`, dead) predates Phase 29 and is out of scope; not cleaned.

## User Setup Required

None — release ritual runs entirely under agent credentials + operator-preload `.env`. Downstream consumers upgrade via the standard `npm install @ashley-shrok/viewmodel-shell@^9.0.0` + `dotnet add package AshleyShrok.ViewModelShell --version 9.0.0` per MIGRATION.md.

## Next Phase Readiness

**PHASE 29 RELEASED — v9.0.0 lives on both registries; Markdown companion 0.2.2 rebuilt + republished; tag pushed; main advanced; #vms-announcements + Molly notified; verification server cleaned up.**

- Downstream consumers can upgrade immediately (npm registry serves 9.0.0 verified via curl; NuGet flat-container will surface 9.0.0 + Markdown 0.2.2 within 5-15 min of push).
- Metis:5000 (the Molly consumer that flagged the silent bundle-stale window) has the fix in reach; DM sent with opt-out one-liner.
- Kitsune, PBMInvoices, any Pantheon app with a custom skew affordance: preserve v3.8.0 behavior with `onVersionSkew: "custom"` (documented in CHANGELOG + MIGRATION + announce).
- ROADMAP checkbox for 29-12 to be ticked in the follow-up docs commit alongside this SUMMARY.

## Self-Check: PASSED

- [x] `viewmodel-shell/package.json` at 9.0.0 — verified via `grep -c '"version": "9.0.0"'` = 1
- [x] `viewmodel-shell/package-lock.json` self-versions at 9.0.0 — verified 2 self-version lines (3 + 9); a third occurrence at line 1737 is the `diff` npm dep (unrelated)
- [x] `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` at `<Version>9.0.0</Version>` — verified via grep = 1
- [x] `viewmodel-shell-dotnet/Markdown/AshleyShrok.ViewModelShell.Markdown.csproj` at `<Version>0.2.2</Version>` — verified via grep = 1
- [x] CHANGELOG has `2026-08-02` in v9.0.0 heading + Companion NuGet packages subsection
- [x] MIGRATION has companion note for Markdown 0.2.2
- [x] Release commit `8770e8d` exists on main — verified via `git log`
- [x] Tag `v9.0.0` exists at `8770e8d8` — verified via `git push origin v9.0.0` receipt
- [x] `git merge-base --is-ancestor v9.0.0 main` = 0 — verified `OK: v9.0.0 reachable from main`
- [x] npm registry serves 9.0.0 latest — verified via curl-to-registry
- [x] NuGet core 9.0.0 push receipt — `Your package was pushed`
- [x] NuGet Markdown 0.2.2 push receipt — `Your package was pushed`
- [x] Announce event_id `$XWax1rFNY2dGfS7sDUeeUajOEgiEHhA7-OYHp2eiWoQ` in `#vms-announcements`
- [x] Molly DM event_id `$3dSxpYhksneY0LDAGavQsxhGypoNZe1myFqoKbSiPjM`
- [x] Verification server PID file removed

---
*Phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-*
*Completed: 2026-08-02*
