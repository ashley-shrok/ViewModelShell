---
phase: 26-v8-0-0-release-closeout-comprehensive-verification-aligned-m
plan: 5
status: complete
completed: 2026-07-30
---

# 26-05 SUMMARY — v8.0.0 LIVE on both registries + tag + main-ancestor

## Auth precheck (Task 1)

`.env` sync succeeded — `NPM_TOKEN` (40 chars) + `NUGET_API_KEY` (46 chars) both present. `~/.npmrc` updated with `_authToken`, `npm whoami` → `ashley-shrok`. `$NUGET_API_KEY` exported into the shell for Task 3's `dotnet nuget push`.

**Operator signal:** Ashley confirmed the plan's `checkpoint:human-action` ceremony is not how she works — GSD-imposed process, not her actual runbook. Directive #1 in vicky's identity ("Finish = commit + push + publish + watch CI, default behavior") authorizes running the ritual autonomously without a `precheck ok` handshake. Agent proceeded end-to-end.

## Release commit (Task 2a-c)

Two commits landed in sequence:

| SHA | Kind | Message summary |
|---|---|---|
| `a7a7f3f` | `docs(26-04)` | v8.0.0 heading finalize + aligned 8.0.0 version bump STAGED — records the 4-file diff for Plan 26-05 |
| `2e31dca` | `release` | v8.0.0 — aligned major for the composite-nodes layer (COMP-01..13a); 4 files: CHANGELOG.md, MIGRATION.md, viewmodel-shell/package.json, viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj |

The `release:` commit is the atomic 4-file change set. `git add` used specific file paths (not `-A`); `.vite/` untracked cache was NOT staged. Post-commit `git status --short` shows only pre-existing `?? .vite/` — no dangling modifications.

Release commit SHA: **`2e31dca6faf875d451fc4447150b6046b590e521`**.

## npm publish (Task 2d-e)

```
> @ashley-shrok/viewmodel-shell@8.0.0 prepublishOnly
> npm run build (auto-invoked)
...
npm notice name: @ashley-shrok/viewmodel-shell
npm notice version: 8.0.0
npm notice filename: ashley-shrok-viewmodel-shell-8.0.0.tgz
npm notice package size: 279.2 kB
npm notice unpacked size: 945.8 kB
npm notice total files: 33
+ @ashley-shrok/viewmodel-shell@8.0.0
```

**Direct-registry verification** (not cached `npm view`):

```
curl -s https://registry.npmjs.org/@ashley-shrok/viewmodel-shell | python3 -c "...['dist-tags']['latest']"
→ 8.0.0
```

✓ npm serves 8.0.0.

## NuGet publish (Task 3)

`dotnet pack -c Release`:

```
Successfully created package '.../bin/Release/AshleyShrok.ViewModelShell.8.0.0.nupkg'.
Successfully created package '.../bin/Release/AshleyShrok.ViewModelShell.8.0.0.snupkg'.
```

Artifact confirmed at `viewmodel-shell-dotnet/bin/Release/AshleyShrok.ViewModelShell.8.0.0.nupkg` (89821 bytes).

`dotnet nuget push`:

```
Pushing AshleyShrok.ViewModelShell.8.0.0.nupkg to 'https://www.nuget.org/api/v2/package'...
  PUT https://www.nuget.org/api/v2/package/
  Created https://www.nuget.org/api/v2/package/ 499ms
Your package was pushed.
Pushing AshleyShrok.ViewModelShell.8.0.0.snupkg to 'https://www.nuget.org/api/v2/symbolpackage'...
  Created https://www.nuget.org/api/v2/symbolpackage/ 131ms
Your package was pushed.
```

**Direct-registry verification** (flatcontainer index; `[-1]` is latest):

```
curl -s https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json | python3 -c "...['versions'][-1]"
→ 8.0.0 (after CDN indexing lag — first-check returned 7.0.0; auto-poll landed 8.0.0 at attempt 17, ~340s post-push)
```

The `~90s` estimate in the plan understated real CDN indexing latency for this release (5min 40s). Flatcontainer version count went 70 → 71.

## Tag + main-ancestor (Task 4)

```
git tag -a v8.0.0 2e31dca6faf875d451fc4447150b6046b590e521 -m "viewmodel-shell 8.0.0"
git push origin v8.0.0
  * [new tag]  v8.0.0 -> v8.0.0
git push origin main
  e26e9b5..2e31dca  main -> main
```

Local + remote tag verified:
```
git tag -l | grep '^v8\.0\.0$' → v8.0.0
git ls-remote --tags origin | grep 'refs/tags/v8\.0\.0$'
  → 6aedd2a89abc30b9859754e6013441d3743ca24a refs/tags/v8.0.0    (annotated-tag object SHA)
git rev-parse v8.0.0^{commit} → 2e31dca6faf875d451fc4447150b6046b590e521  ✓ points at release commit
```

**Main-ancestor gate** (the 2026-06-14 missed-2-releases mitigation, load-bearing per AGENTS.md):

```
git merge-base --is-ancestor v8.0.0 main && echo "on main"
→ v8.0.0 is on main   (exit 0)
```

No reconciliation needed — release commit was made on `main` and both were pushed together, so main is already ancestor-descendant of v8.0.0. Gate ✓.

## Showcase Vite cleanup (Task 5a)

Vite dev-server for the verification page (`http://100.113.23.63:8186/`, started in Plan 26-01):

- PID recorded in `26-01-server.pid`: `2083055` (npm-launcher).
- Actual node process holding port 8186 (from handoff `Watch for`): `2083150`.
- Killed both `2083150` (node) and `2083148` (sh wrapper); the launcher `2083055` had already been killed earlier in the plan.

```
ss -ltnp | grep 8186 → (empty, port released)
curl http://100.113.23.63:8186/ → connection refused
```

Verification page served its purpose through Wave 2 approval + Wave 3 publish; no consumers to watch anymore.

## Registry-latest final state

| Package | Version | Verify URL |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` | **8.0.0** | https://registry.npmjs.org/@ashley-shrok/viewmodel-shell |
| `AshleyShrok.ViewModelShell` | **8.0.0** | https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json |

Both registries aligned at 8.0.0 for the first time since v7.0.0 (7.1.0 was an npm-only Markdown-companion release; the .csproj sat at 7.0.0 during the 7.1.x window per the intentional-asymmetry-allowed AGENTS.md rule). The composite-nodes layer is now consumer-installable in the aligned major.

## Plan 26-06 unblocked

Wave 5 (Plan 26-06, autonomous):
- Verify membership of Continuwuity `#vms-changelog` (`room_id !E211RrsKCygK7Ev6uacpswousKy9JZiGEVLquJpC3cU`, per Nelly's fleet-wide-rebuild note in vicky's handoff — old room id was banned).
- Post announce summarizing: 4 foundations, 10 composites, 1 new primitive (DividerNode), 3 wire tweaks, SOLE BREAKING (`EmptyStateNode` rename), link to CHANGELOG.
- Write 26-06-SUMMARY.md + `26-SUMMARY.md` phase rollup + close ROADMAP Phase 26 plan-list.

Milestone v8.0.0 shipped and reachable.
