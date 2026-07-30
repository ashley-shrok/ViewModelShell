---
phase: 26-v8-0-0-release-closeout-comprehensive-verification-aligned-m
plan: 4
status: complete
completed: 2026-07-30
---

# 26-04 SUMMARY — Finalize v8.0.0 headings + aligned 8.0.0 version bump (STAGED, not committed)

## Four-file atomic release change set

All 4 file modifications landed as a single atomic staging pass — no partial edits, no git commit made (per plan Task 3 acceptance + AGENTS.md working-agreement: git is operator-driven; Plan 26-05 begins with the commit).

### 1. `CHANGELOG.md` — heading finalize + batch-then-ship blockquote removal (Task 1)

**Before:**
```
## Unreleased — v8.0.0 (in progress)

> **Batch-then-ship:** v8.0.0 publishes at Phase 26 closeout with all 10 composites + 3 wire tweaks + 4 foundations in one aligned release. Do NOT publish Phase 24 as its own release. See `.planning/design/composite-nodes-layer.md` for the milestone design of record.

### Added
```

**After:**
```
## v8.0.0 — 2026-07-30

### Added
```

Publish date `2026-07-30` = today (`date +%Y-%m-%d` at plan run). The `### Added` heading now directly follows the `## v8.0.0` heading with a single blank line between — matches every prior release entry in the file. Every entry under v8.0.0 (10 composites + 4 foundations + wire tweaks + 1 BREAKING) is byte-identical to the pre-edit state; every prior release entry (7.1.0, 7.0.1, 7.0.0, ...) is untouched.

Acceptance:
- `grep -c '^## v8\.0\.0 — 20' CHANGELOG.md` == **1** ✓
- `grep -c '^## Unreleased' CHANGELOG.md` == **0** ✓
- `grep -c 'Batch-then-ship' CHANGELOG.md` == **0** ✓

### 2. `MIGRATION.md` — heading finalize + batch-then-ship blockquote removal + 2 cross-refs (Task 2)

**Heading before:**
```
## Upgrading to v8.0.0 (in progress) — ONE break: `EmptyStateNode` field rename

**Batch-then-ship:** v8.0.0 publishes at Phase 26 closeout with all 10 composites + 3 wire tweaks + 4 foundations in one aligned release. This entry accumulates as Phase 23-26 land; it flips to a versioned release heading at Phase 26.

### Phase 23 foundations — purely additive
```

**Heading after:**
```
## Upgrading to v8.0.0 — ONE break: `EmptyStateNode` field rename

### Phase 23 foundations — purely additive
```

**Cross-reference edits (2 occurrences, `replace_all`):**
```
See the `Unreleased — v8.0.0 (in progress)` section of `CHANGELOG.md`
```
→
```
See the `v8.0.0 — 2026-07-30` section of `CHANGELOG.md`
```

The cross-references were necessary to satisfy the plan's `grep -c '(in progress)' MIGRATION.md == 0` acceptance criterion — the marker had to go everywhere, not just the heading. Pointing at the finalized CHANGELOG heading name keeps the two files internally consistent.

Every Phase 23 foundations / EmptyStateNode BREAKING / COMP-05..07 / COMP-09..13a section is byte-identical to the pre-edit state; every prior migration entry (v7.0.0 TrackerCell rename, etc.) is untouched.

Acceptance:
- `grep -c '^## Upgrading to v8\.0\.0 — ONE break' MIGRATION.md` == **1** ✓
- `grep -c '(in progress)' MIGRATION.md` == **0** ✓
- `grep -c 'Batch-then-ship' MIGRATION.md` == **0** ✓

### 3. `viewmodel-shell/package.json` — npm version bump (Task 3a)

**Before (line 3):**
```
  "version": "7.1.0",
```

**After:**
```
  "version": "8.0.0",
```

Exact-string bump. Every other field (name, description, exports, scripts, deps) untouched.

Acceptance:
- `grep -c '"version": "8.0.0"' viewmodel-shell/package.json` == **1** ✓
- `grep -c '"version": "7.1.0"' viewmodel-shell/package.json` == **0** ✓

### 4. `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` — NuGet version bump (Task 3b)

**Before (line 13):**
```
    <Version>7.0.0</Version>
```

**After:**
```
    <Version>8.0.0</Version>
```

Exact-string bump. Preserves 4-space indentation inside `<PropertyGroup>`. Intentional aligned major from the prior 7.1.0/7.0.0 asymmetry (7.1.0 was the Markdown-companion npm-only release) — both packages now on the aligned 8.0.0 major, per AGENTS.md "two packages share major.minor LINE" invariant.

Acceptance:
- `grep -c '<Version>8\.0\.0</Version>' viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` == **1** ✓
- `grep -c '<Version>7\.0\.0</Version>' viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` == **0** ✓

## Post-bump green-verify (Task 3c)

Fast subset per plan (NOT the full green-tree gate — that was Plan 26-03; version-bump-only changes should not affect any test).

| Command | Result | Notes |
|---|---|---|
| `cd viewmodel-shell && npm run build` | ✓ green | `> @ashley-shrok/viewmodel-shell@8.0.0 build` — new version stamped into `dist/` |
| `cd viewmodel-shell && npx vitest run` | ✓ green | **1250 passed / 1 skipped** (78 files, 2.78s) — same numbers as Plan 25-10 + 26-03 baselines |
| `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj -c Release` | ✓ green | 0 Warning(s), 0 Error(s); `AshleyShrok.ViewModelShell.dll` rebuilt Release/net8.0 |

The `.nupkg` for `8.0.0` is NOT produced by `dotnet build` — only `dotnet pack -c Release` does, which is Plan 26-05 Task 2. `bin/Release/` currently has all prior `.nupkg`s (latest `7.0.0`); the `8.0.0.nupkg` appears when the operator runs the publish ritual.

## No git commit made (plan invariant)

`git rev-parse HEAD` at plan close: **`5cb8799b892485772a9e0465ce1571ae35b734f5`** — byte-identical to the Wave 2 (Plan 26-03) approved commit. HEAD unchanged from plan start.

`git status --short` at plan close:
```
 M CHANGELOG.md
 M MIGRATION.md
 M viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
 M viewmodel-shell/package.json
?? .vite/
```

Exactly the 4 modified files the plan requires + pre-existing `.vite/` untracked artifact from Plan 26-01's Vite server (unchanged). All 4 modifications sit staged in the working tree for Plan 26-05's operator-gated commit.

## Plan 26-05 unblocked

Wave 4 (Plan 26-05, `autonomous: false`) is now ready for Ashley to run:

1. `checkpoint:human-action` — auth precheck (`.env` sync, `npm whoami`, `$NUGET_API_KEY` in shell).
2. Atomic release commit staging + commit of the 4-file change set.
3. `cd viewmodel-shell && npm publish` (prepublishOnly rebuilds `dist/`).
4. `cd viewmodel-shell-dotnet && dotnet pack -c Release && dotnet nuget push bin/Release/AshleyShrok.ViewModelShell.8.0.0.nupkg --api-key "$NUGET_API_KEY" --source https://api.nuget.org/v3/index.json`.
5. Direct-registry read verification (curl, not cached `npm view` per AGENTS.md).
6. Annotated tag `git tag -a v8.0.0 <release-sha> -m 'viewmodel-shell 8.0.0'` + `git push origin v8.0.0`.
7. Advance-`main` gate: `git merge-base --is-ancestor v8.0.0 main` must exit 0 (the 2026-06-14 missed-releases mitigation).
8. Kill Vite server on `100.113.23.63:8186` (PID `2083150`, recorded in `26-01-server.pid`) — the verification page's purpose is served through publish + tag.

Wave 5 (Plan 26-06, autonomous announce on Continuwuity `#vms-changelog` `room_id !E211RrsKCygK7Ev6uacpswousKy9JZiGEVLquJpC3cU`) follows.
