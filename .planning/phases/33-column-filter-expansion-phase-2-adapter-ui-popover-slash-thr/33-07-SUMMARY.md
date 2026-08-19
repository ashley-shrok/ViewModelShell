---
phase: 33-column-filter-expansion-phase-2-adapter-ui-popover-slash-thr
plan: "07"
subsystem: release
tags: [release, publish, npm, nuget, tag, main, poppy, announce, v10.0.0]
dependency_graph:
  requires:
    - "33-01 — BrowserAdapter filter-row rebuild (popover + portal + icon state grammar)"
    - "33-02 — old wire field removal from both backends"
    - "33-03 — HelpDesk .NET migration (and all peer migration plans folded via committer executions)"
    - "33-04 — filter-adapter.test.ts (52 tests)"
    - "33-05 — MIGRATION.md + AGENTS.md + CHANGELOG.md v10.0.0 promotion"
    - "33-06 — full 11-command green-tree gate + Ashley taste ok"
  provides:
    - "REQ-CF2-12 — the aligned major-version release (npm + NuGet core + Markdown companion)"
    - "REQ-CF2-13 — v10.0.0 live on npm as latest dist-tag"
    - "v10.0.0 annotated tag pushed; main advanced past tag; Poppy DMed; #vms-announcements posted"
    - "Phase 33 closure — end of column-filter-expansion milestone"
  affects:
    - "PBMInvoices consumer migration (Poppy piloting)"
    - "Every downstream .NET consumer of AshleyShrok.ViewModelShell.Markdown must upgrade to 0.2.3 when adopting core 10.0.0 (per gotcha #9)"
tech_stack:
  added: []
  patterns:
    - "Auth precheck-inline (source .env → sync ~/.npmrc → npm whoami → verify NUGET_API_KEY) executed mechanically per the banked 'DO NOT echo GSD checkpoint:human-action auth-precheck at operator' rule"
    - "Companion NuGet rebuild via <ProjectReference>-driven floor-dep pickup — no manual PackageReference version edit needed on the companion csproj; dotnet pack computes the correct floor from the ProjectReference'd core csproj's <Version> at pack time"
    - "Release-preflight gate re-run AFTER version bump commit (catches regressions the bump itself introduces — this session had none)"
    - "Announce-room preflight via GET /joined_rooms + m.room.name state read (per Phase 27 stranded-room lesson) — verified member of !QvlInhfVNZRUxQPtcR and name=vms-announcements before posting"
    - "Push-worktree-branch-to-remote-main via `git push origin worktree-agent-...:main` (the worktree HEAD is a per-agent branch; the remote-side target is main)"
key_files:
  created:
    - .planning/phases/33-.../33-07-SUMMARY.md (this file)
  modified:
    - viewmodel-shell/package.json (9.2.1 → 10.0.0)
    - viewmodel-shell/package-lock.json (9.2.1 → 10.0.0, both name-level and package-graph-root entries)
    - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj (9.2.0 → 10.0.0)
    - viewmodel-shell-dotnet/Markdown/AshleyShrok.ViewModelShell.Markdown.csproj (0.2.2 → 0.2.3; floor dep on core inherited via ProjectReference → auto-bumped to 10.0.0)
key_decisions:
  - "Single release commit for all three package files (per plan Task 1) — not three individual commits — because the batch belongs to one atomic release moment"
  - "Auth precheck failed on first run (npm 401 on Vicky's saved token); surfaced to operator per AGENTS.md 'stop and tell operator before bumping' rule; operator refreshed token, precheck re-ran clean, THEN version bumps landed"
  - "Markdown companion floor dep bumped automatically via ProjectReference (not a manual <PackageReference> Version edit) — the packed .nuspec correctly shows AshleyShrok.ViewModelShell 10.0.0 as the floor"
  - "Push target: git push origin worktree-agent-a5c2f2cb40bbeba81:main (from the isolated worktree branch, direct-to-main on the remote — this is the standard worktree release flow)"
requirements_completed:
  - REQ-CF2-12
  - REQ-CF2-13
duration: 25min
completed: 2026-08-18
---

# Phase 33 Plan 07: v10.0.0 Release Ritual Summary

**v10.0.0 aligned major-version release shipped — npm @ashley-shrok/viewmodel-shell 10.0.0 + NuGet AshleyShrok.ViewModelShell 10.0.0 + companion AshleyShrok.ViewModelShell.Markdown 0.2.3 published; v10.0.0 tag pushed; main advanced; Poppy DMed; #vms-announcements posted. Phase 33 (and the entire column-filter-expansion milestone) closed.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-19T01:48:00Z (worktree agent spawn / auth precheck)
- **Completed:** 2026-08-19T02:10:00Z (SUMMARY commit)
- **Tasks:** 2 (per plan)
- **Files modified:** 4 (package.json + package-lock.json + 2 csproj files)

## Accomplishments

- **npm 10.0.0 live** as `latest` dist-tag on `@ashley-shrok/viewmodel-shell` (registry-verified via curl to `registry.npmjs.org`).
- **NuGet core 10.0.0 pushed** to `api.nuget.org` — `dotnet nuget push` returned `Created` (HTTP 201) for both `.nupkg` and `.snupkg`. CDN propagation is asynchronous (5-15 min typical); flat-container index at the time of SUMMARY commit still shows `9.2.0` as `versions[-1]` — the push itself succeeded and the version will surface as CDN caches refresh.
- **NuGet Markdown companion 0.2.3 pushed** — same `Created` response. Packed `.nuspec` verified in-place: `<dependency id="AshleyShrok.ViewModelShell" version="10.0.0" ...>` — the ProjectReference correctly picked up the core's bumped `<Version>` at pack time (gotcha #9 satisfied without a manual PackageReference edit).
- **Annotated tag `v10.0.0`** created at release SHA `5c8c30da85bbe936078235e61e33f5cc024d0d0d` and pushed to `origin`.
- **main advanced** past the tag — `git merge-base --is-ancestor v10.0.0 origin/main` returned success (the 1.5.0/1.6.0 stranded-tag anti-pattern avoided).
- **Poppy DMed** on `!dKuMpeCcOqsMSPUIiZ:thenasty.taild9b663.ts.net` — release version + wire replacement pointers + MIGRATION.md link. Event `$0Ds24fNt6PJXPocjDmbN55g-yRgFIgKQC5tWz00KGT8`.
- **#vms-announcements posted** to `!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net` (name pre-verified as `vms-announcements` via `GET /rooms/{rid}/state/m.room.name/`; membership pre-verified via `GET /joined_rooms`). Event `$Hkv2QFKZpEPzL-ItV7RgoHKNnhrBUE6punI9eji5azk`.

## Task Commits

1. **Task 1: Version bumps (npm + NuGet core + Markdown companion)** — `5c8c30d` (release)
   - viewmodel-shell/package.json: 9.2.1 → 10.0.0
   - viewmodel-shell/package-lock.json: 9.2.1 → 10.0.0 (both top-level and package-graph-root entries)
   - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj: 9.2.0 → 10.0.0
   - viewmodel-shell-dotnet/Markdown/AshleyShrok.ViewModelShell.Markdown.csproj: 0.2.2 → 0.2.3 (ProjectReference-driven floor dep auto-bumped to 10.0.0 at pack time)
   - Commit message: `release: v10.0.0 — typed column-filter UI (adapter + popover + icon grammar) + old wire removal + 7-demo migration`
2. **Task 2: Preflight gate + push + publish + tag + advance-main + Poppy DM + announce**
   - Preflight (post-bump gate): all green (vitest 88f/1613t, check:test-types green, check:core-globals green, check:demo-types 26/26 green, check:no-demo-style 36f green, npm run build clean, dotnet test viewmodel-shell-dotnet/Tests 622 passed)
   - Push: `git push origin worktree-agent-a5c2f2cb40bbeba81:main` — `b84a58e..5c8c30d main`
   - npm publish: `+ @ashley-shrok/viewmodel-shell@10.0.0`; registry-verified latest=`10.0.0`
   - NuGet core push: HTTP 201 Created for both `.nupkg` (10.0.0) and `.snupkg`
   - NuGet Markdown push: HTTP 201 Created for both `.nupkg` (0.2.3) and `.snupkg`
   - Tag: `git tag -a v10.0.0 5c8c30d ...` + `git push origin v10.0.0`
   - Advance-main verify: `git merge-base --is-ancestor v10.0.0 origin/main` succeeded → `main advanced OK`
   - Poppy DM sent, event `$0Ds24fNt6PJXPocjDmbN55g-yRgFIgKQC5tWz00KGT8`
   - #vms-announcements post sent, event `$Hkv2QFKZpEPzL-ItV7RgoHKNnhrBUE6punI9eji5azk`

**Plan metadata:** (this SUMMARY commit — see final commit below)

## Preflight Gate Results (Step 0)

Re-ran after the version-bump commit landed, per the plan's "gate green after code delta AND at release-preflight" rule:

| Gate                    | Result                                                    |
|-------------------------|-----------------------------------------------------------|
| vitest                  | 88 files / 1613 passed / 1 skipped                        |
| check:test-types        | green                                                     |
| check:core-globals      | green (AGNOSTIC-03: index.ts references zero globals)     |
| check:demo-types        | 26 demos type-check clean (all 18 bun demos + 8 npm demos) |
| check:no-demo-style     | 36 hand-edited frontend HTML files zero-`<style>`         |
| npm run build           | clean (tsc -b tsconfig.tui.json)                          |
| dotnet test (framework) | Passed! Failed: 0, Passed: 622, Skipped: 0                |

**Note on demo installs:** the worktree does not carry demo `node_modules` — the gate requires each demo's local `tsc` binary. Installed all 26 demos (`bun install` for 18 bun demos in parallel + `npm ci` for 7 frontend demos + `bun install` for demo/ChatComposerVerification-bun which lacks a bun.lock but uses the `link:` protocol) before the gate would pass. This is worktree-execution-specific setup — the demos were type-checked green in Plan 33-06 on the main tree.

## Registry Verification Outputs

**npm (verified live):**
```
$ curl -s https://registry.npmjs.org/@ashley-shrok/viewmodel-shell | python3 -c "import sys,json; print(json.load(sys.stdin)['dist-tags']['latest'])"
10.0.0
```

**NuGet core (push confirmed; CDN propagation pending at SUMMARY-commit time):**
```
$ ~/.dotnet/dotnet nuget push bin/Release/AshleyShrok.ViewModelShell.10.0.0.nupkg --api-key "$NUGET_API_KEY" --source https://api.nuget.org/v3/index.json
Pushing AshleyShrok.ViewModelShell.10.0.0.nupkg to 'https://www.nuget.org/api/v2/package'...
  PUT https://www.nuget.org/api/v2/package/
  Created https://www.nuget.org/api/v2/package/ 553ms
Your package was pushed.
Pushing AshleyShrok.ViewModelShell.10.0.0.snupkg to 'https://www.nuget.org/api/v2/symbolpackage'...
  Created https://www.nuget.org/api/v2/symbolpackage/ 138ms
Your package was pushed.
```

**NuGet Markdown companion (push confirmed; same propagation timing):**
```
$ ~/.dotnet/dotnet nuget push bin/Release/AshleyShrok.ViewModelShell.Markdown.0.2.3.nupkg --api-key "$NUGET_API_KEY" --source https://api.nuget.org/v3/index.json
Pushing AshleyShrok.ViewModelShell.Markdown.0.2.3.nupkg to 'https://www.nuget.org/api/v2/package'...
  Created https://www.nuget.org/api/v2/package/ 452ms
Your package was pushed.
Pushing AshleyShrok.ViewModelShell.Markdown.0.2.3.snupkg to 'https://www.nuget.org/api/v2/symbolpackage'...
  Created https://www.nuget.org/api/v2/symbolpackage/ 162ms
Your package was pushed.
```

**Markdown companion .nuspec (verified before push):**
```
<dependencies>
  <group targetFramework="net8.0">
    <dependency id="AshleyShrok.ViewModelShell" version="10.0.0" exclude="Build,Analyzers" />
    <dependency id="Markdig" version="0.37.0" exclude="Build,Analyzers" />
  </group>
</dependencies>
```
The `<ProjectReference>` on the companion csproj resolved to core 10.0.0 at pack time (dotnet pack reads the referenced csproj's `<Version>` to determine the floor dep). No manual PackageReference edit needed. Gotcha #9 satisfied.

**NuGet propagation status at SUMMARY-commit time:**
- `curl -s https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json` → `versions[-1]` = `9.2.0` (10.0.0 not yet indexed)
- `curl -s https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell.markdown/index.json` → `versions[-1]` = `0.2.2` (0.2.3 not yet indexed)
- Push responses were HTTP 201 Created → packages accepted by nuget.org; CDN cache refresh is the pending step (5-15 min typical). No action required.

## Tag + Advance-Main Verification

```
$ git rev-parse HEAD
5c8c30da85bbe936078235e61e33f5cc024d0d0d

$ git tag -a v10.0.0 5c8c30da85bbe936078235e61e33f5cc024d0d0d -m "viewmodel-shell 10.0.0 — column-filter typed-wire major"
$ git push origin v10.0.0
 * [new tag]         v10.0.0 -> v10.0.0

$ git fetch origin main
$ git merge-base --is-ancestor v10.0.0 origin/main && echo "main advanced OK"
main advanced OK
```

**Release SHA:** `5c8c30da85bbe936078235e61e33f5cc024d0d0d`
**Tag:** `v10.0.0` (annotated) — pushed
**Main state:** `origin/main` contains the release commit (verified via `git merge-base --is-ancestor v10.0.0 origin/main`)

## Poppy DM

- **Room:** `!dKuMpeCcOqsMSPUIiZ:thenasty.taild9b663.ts.net`
- **Identity:** `@vicky:thenasty.taild9b663.ts.net` (relay creds from `~/.claude/identities/vicky/relay.json`, password-login for fresh token)
- **Event ID:** `$0Ds24fNt6PJXPocjDmbN55g-yRgFIgKQC5tWz00KGT8`
- **Timestamp:** ~2026-08-19T02:03:00Z
- **Message excerpt (load-bearing points early per receiver-truncation rule):**
  > Poppy — v10.0.0 shipped (npm 10.0.0 + NuGet 10.0.0 + Markdown 0.2.3). This is the column-filter typed-wire major — old filterable/filterValue/filterBinds/filterAction fields are GONE, replaced by filter: FilterSpec + filterDescriptorBinds + matchesFilter/FilterHelper.MatchesFilter reference truth function. MIGRATION.md section "Migrating to v10.0.0" carries the wire replacement + HelpDesk agent-queue before/after diff. Adapter UI: always-visible-input + escalation-popover; icon state grammar (slash / plain / plain+dot); JS-clamped positioning. You are the pilot for the release — hit me on the relay if anything breaks in PBMInvoices migration.

## #vms-announcements Post

- **Room:** `!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net` (`m.room.name` = `vms-announcements` — verified via `GET /rooms/{rid}/state/m.room.name/` per Phase 27 preflight rule; membership pre-verified via `GET /joined_rooms`)
- **Event ID:** `$Hkv2QFKZpEPzL-ItV7RgoHKNnhrBUE6punI9eji5azk`
- **Timestamp:** ~2026-08-19T02:04:00Z
- **Message excerpt:**
  > v10.0.0 shipped — npm + NuGet aligned. Column-filter typed-wire MAJOR: old filterable/filterValue/filterBinds/filterAction removed; new FilterSpec + FilterDescriptor + matchesFilter reference truth fn. Adapter UI: always-visible-input + escalation-popover with per-type operator vocab. Companion Markdown 0.2.3 rebuilt with core-10 floor dep. See MIGRATION.md section "Migrating to v10.0.0" for the wire replacement + HelpDesk before/after.

## Registry URLs

Consumer-facing verification links:

- npm: https://www.npmjs.com/package/@ashley-shrok/viewmodel-shell/v/10.0.0
- NuGet core: https://www.nuget.org/packages/AshleyShrok.ViewModelShell/10.0.0
- NuGet Markdown companion: https://www.nuget.org/packages/AshleyShrok.ViewModelShell.Markdown/0.2.3

(NuGet package pages appear once CDN propagation completes — same 5-15 min timing as the flat-container index above.)

## Decisions Made

- **Preflight gate re-run after version-bump commit.** The plan Step 0 explicitly requires this (per AGENTS.md "gate green (a) after code delta AND (b) at release-preflight"). No regressions — the version bumps are text-only edits to package metadata; no code impact.
- **Single release commit for all three package files.** Per plan Task 1's exact `git commit` invocation. The three packages ship together, so they belong in one atomic commit.
- **ProjectReference-driven Markdown floor dep bump.** The plan's `<read_first>` for Task 1 called out `<PackageReference>` bump — but the Markdown csproj actually uses `<ProjectReference>` to the core csproj (not `<PackageReference>`). At `dotnet pack` time, the ProjectReference is resolved against the referenced csproj's `<Version>` element to produce the packed `<dependency>` entry. Bumping the core `<Version>` to 10.0.0 automatically produced `<dependency id="AshleyShrok.ViewModelShell" version="10.0.0" ...>` in the packed .nuspec — verified via `unzip -p` inspection before push. No manual PackageReference edit needed. Gotcha #9 fully satisfied.
- **Auth precheck stopped-and-surfaced on first failure.** Per AGENTS.md "if auth is broken or a credential is missing, stop and tell the operator BEFORE bumping." Vicky's saved npm token in `.env` returned 401 on first `npm whoami`. Surfaced to operator; token refreshed; second precheck returned `ashley-shrok`; then version bumps proceeded. This is the correct discipline — a bumped-but-unpublished version drifts the repo from the registry silently (per the 1.0.1-stuck-through-1.1.0/1.2.0/1.3.0 loophole).

## Deviations from Plan

**None significant.** Two minor operational notes:

1. **Auth precheck failed on first run** — surfaced to operator per AGENTS.md rule; user refreshed the npm token in `.env` mid-plan; precheck re-ran clean; execution continued from the top of Task 1. Not a Rule 1/2/3 auto-fix — this is the sanctioned "stop and tell operator" behavior for missing/expired publish credentials. No code or plan artifacts affected.
2. **Demo installs required to run `check:demo-types` in the worktree** — the plan assumes the demo `node_modules` are present, which they are on the main tree (per Plan 33-06 gate) but not on this worktree. Installed all 26 demos (18 bun + 7 npm + 1 special-case bun-with-link-protocol) before the gate could run. This is worktree-execution overhead, not a plan gap. The demos were verified green in Plan 33-06 on the main tree; installing them here to re-verify was the fast path.

**Total deviations:** 0 auto-fixed. Plan executed as written after the auth-precheck operator gate cleared.

## Issues Encountered

- **NuGet CDN propagation timing.** The `dotnet nuget push` returned HTTP 201 `Created` for both core (10.0.0) and Markdown (0.2.3) `.nupkg` and `.snupkg` files, but the flat-container index at `https://api.nuget.org/v3-flatcontainer/{pkg}/index.json` still showed the prior version as `versions[-1]` at SUMMARY-commit time. This is the documented 5-15 min CDN propagation window — the push itself succeeded (verified by the 201 response), and the versions will surface as caches refresh. Not an error condition; no action required. Documented in AGENTS.md publishing runbook.

## Next Phase Readiness

**Phase 33 CLOSED.** Column-filter-expansion milestone COMPLETE.

- v10.0.0 live on npm; NuGet CDN propagation in progress; tag pushed; main advanced; Poppy alerted; #vms-announcements posted.
- Poppy will migrate PBMInvoices as pilot consumer. If she surfaces a breakage in the migration, that gets handled as a follow-up patch release (10.0.1 or 10.1.0 depending on shape).
- **Deferred to follow-up bounty (per plan):** TUI filter-row refresh to the new wire shape — captured in `~/.claude/roles/vms-maintainer/bounties/tui-filter-refresh/bounty.json` (already documented; Wave 3 Plan 33-05 committed the follow-up pointer).

**Relay sweep note (per role directive):** No other open promises to peers in-flight related to the column-filter milestone. Poppy is the only downstream in the pilot loop and is now notified. The batch is done.

---
*Phase: 33-column-filter-expansion-phase-2-adapter-ui-popover-slash-thr*
*Completed: 2026-08-19*
