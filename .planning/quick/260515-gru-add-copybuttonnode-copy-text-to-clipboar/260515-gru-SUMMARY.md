---
quick_id: 260515-gru
subsystem: viewmodel-shell (npm + NuGet)
tags: [new-node-type, adapter-internal, clipboard, copy-button, parity, lockstep]
dependency_graph:
  requires: []
  provides: [CopyButtonNode-type, CopyButtonNode-renderer, CopyButtonNode-dotnet]
  affects: [viewmodel-shell/src/index.ts, viewmodel-shell/src/browser.ts, viewmodel-shell-dotnet/ViewModels.cs]
tech_stack:
  added: [navigator.clipboard.writeText, document.execCommand (legacy fallback)]
  patterns: [adapter-internal interaction (no dispatch), legacyCopy module-level helper, fake-timer vitest pattern]
key_files:
  created:
    - viewmodel-shell/test/copy-button.test.ts
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell-dotnet/ViewModels.cs
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - demo/FeatureProbe-bun/handler.ts
    - parity/fixtures/feature-probe.json
    - viewmodel-shell/package.json
    - viewmodel-shell/package-lock.json
    - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
    - AGENTS.md
    - CHANGELOG.md
    - .gitignore
decisions:
  - "CopyButtonNode uses no dispatch/onAction — adapter-internal only; server controls text, adapter controls the entire click lifecycle"
  - "legacyCopy lives as module-level function in browser.ts (not index.ts) to keep core-globals guard green"
  - "Silent failure on both clipboard paths (no error surfaced to user or server) — matches threat model T-gru-01/02 accept dispositions"
  - "C# defaults Label/CopiedLabel are null (not 'Copy'/'Copied!') so wire omits them under WhenWritingNull; adapter-side defaults apply at render"
  - "nupkg/ added to .gitignore (was untracked build artifact visible in git status)"
  - "Publish deferred to orchestrator — npm publish, dotnet nuget push, gh release not run by this agent"
metrics:
  duration: ~25min
  completed: 2026-05-15
  tasks: 3
  files: 12
---

# Quick 260515-gru: CopyButtonNode (copy text to clipboard) Summary

**One-liner:** CopyButtonNode (type: "copy-button") — adapter-internal clipboard copy with ephemeral label feedback, legacyCopy fallback, and silent dual-failure path; npm 0.3.14, NuGet 0.3.10.

---

## What Was Built

Three-surface lockstep addition of `CopyButtonNode` — a pure adapter-side node that copies server-supplied text to the clipboard on button click with no server round-trip.

### Task 1: Three-surface type + renderer + .NET record (commit `22b95e2`)

**viewmodel-shell/src/index.ts**
- `CopyButtonNode` interface: `{ type: "copy-button"; text: string; label?: string; copiedLabel?: string }`
- `| CopyButtonNode` appended to the `ViewNode` union
- Zero platform-global references — `check:core-globals` stays green

**viewmodel-shell/src/browser.ts**
- `CopyButtonNode` added to named imports from `./index.js`
- `case "copy-button": return this.copyButton(n, parent);` in the `node()` switch (no `on` parameter — adapter-internal)
- Module-level `legacyCopy(text: string): boolean` helper using `textarea + execCommand` (correct placement: browser.ts only, never index.ts)
- `private copyButton(n: CopyButtonNode, parent: HTMLElement): void` — click handler: `navigator.clipboard.writeText` first; on resolve: swap to `copiedLabel ?? "Copied!"` then setTimeout 1500ms revert to `label ?? "Copy"`; on reject: try `legacyCopy`; if that also fails: silent. If clipboard absent: try `legacyCopy` directly with same feedback. No `onAction`, no dispatch.

**viewmodel-shell-dotnet/ViewModels.cs**
- `[JsonDerivedType(typeof(CopyButtonNode), "copy-button")]` added to `[JsonPolymorphic]` block
- `public record CopyButtonNode(string Text, string? Label = null, string? CopiedLabel = null) : ViewNode;` added after `LinkNode`
- C# defaults are `null` (not "Copy"/"Copied!") — wire omits them under `WhenWritingNull`; adapter-side defaults apply at render time

### Task 2: jsdom tests + parity fixture + FeatureProbe backends (commit `9db7188`)

**viewmodel-shell/test/copy-button.test.ts** (3 cases)
- Case A: `navigator.clipboard.writeText` spy fires with `node.text`; textContent swaps to `copiedLabel`; reverts after `vi.advanceTimersByTime(1500)`
- Case B: Defaults apply when `label`/`copiedLabel` omitted — "Copy" before, "Copied!" after click, "Copy" after 1500ms
- Case C: Both clipboard paths fail (`writeText` rejects + `execCommand` returns false) — textContent stays "Copy", no error surfaced, no crash

**parity/fixtures/feature-probe.json**: Added step `{ "id": "copy-button-node", "method": "POST", "action": { "name": "show-copy-button" } }`

**demo/FeatureProbe/AspNetCore/FeatureProbeController.cs**: `case "show-copy-button": break;` + `new CopyButtonNode("npx @ashley-shrok/viewmodel-shell", "Copy install command", "Copied!")` always present in `BuildVm`

**demo/FeatureProbe-bun/handler.ts**: `case "show-copy-button": break;` + `{ type: "copy-button", text: "npx @ashley-shrok/viewmodel-shell", label: "Copy install command", copiedLabel: "Copied!" } as ViewNode` always present in `buildVm` (shared by bun-probe and node-probe backends)

### Task 3: Version bumps + docs (commit `8c8498c`)

- npm `0.3.13` → `0.3.14` (package.json + package-lock.json synced via `npm install --package-lock-only`)
- NuGet `0.3.9` → `0.3.10` (AshleyShrok.ViewModelShell.csproj)
- AGENTS.md: `copy-button` row in node-types table and CSS classes table
- CHANGELOG.md: `## 0.3.14` entry at top (above 0.3.13), matching format
- .gitignore: added `viewmodel-shell-dotnet/nupkg/` (was untracked build artifact)

**Publish deferred to orchestrator** — `npm publish`, `dotnet nuget push`, and `gh release create` were NOT run. The orchestrator performs those irreversible credentialed steps after independently verifying gates. The NuGet pack (`dotnet pack --nologo -c Release`) was run and produced `AshleyShrok.ViewModelShell.0.3.10.nupkg` at `viewmodel-shell-dotnet/bin/Release/`.

---

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `22b95e2` | feat(260515-gru-1): add CopyButtonNode — index.ts type, browser.ts renderer, ViewModels.cs record |
| 2 | `9db7188` | feat(260515-gru-2): jsdom tests + parity fixture + FeatureProbe backends for CopyButtonNode |
| 3 | `8c8498c` | feat(260515-gru-3): version bumps, docs (AGENTS.md + CHANGELOG), .gitignore nupkg/ |

---

## Verification Gate Output

### Gate 1: `cd viewmodel-shell && npm run check:core-globals`

```
> @ashley-shrok/viewmodel-shell@0.3.14 check:core-globals
> node scripts/check-core-platform-globals.mjs

✓ AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals.
```

Exit 0. CopyButtonNode added zero platform globals to index.ts; clipboard/legacyCopy live only in browser.ts.

### Gate 2: `cd viewmodel-shell && npm run build && npx vitest run`

```
> @ashley-shrok/viewmodel-shell@0.3.14 build
> tsc -p tsconfig.json

 ✓ test/adapter-seam.test.ts (8 tests) 11ms
 ✓ test/copy-button.test.ts (3 tests) 13ms
 ✓ test/upload-progress.test.ts (7 tests) 107ms

 Test Files  3 passed (3)
       Tests  18 passed (18)
    Start at  12:16:26
    Duration  687ms
```

All 18 tests green (8 pre-existing adapter-seam + 3 new copy-button + 7 pre-existing upload-progress).

### Gate 3: `bun run parity/run.ts`

```
  dotnet-tasks: 8 steps captured
  bun-tasks: 8 steps captured
  ✓ all backends agree
  dotnet-contacts: 11 steps captured
  bun-contacts: 11 steps captured
  ✓ all backends agree
  dotnet-retro: 9 steps captured
  bun-retro: 9 steps captured
  ✓ all backends agree
  dotnet-expenses: 9 steps captured
  bun-expenses: 9 steps captured
  ✓ all backends agree
  dotnet-helpdesk: 21 steps captured
  bun-helpdesk: 21 steps captured
  ✓ all backends agree
  dotnet-probe: 15 steps captured
  bun-probe: 15 steps captured
  node-probe: 15 steps captured
  ✓ all backends agree
  dotnet-reorder: 11 steps captured
  bun-reorder: 11 steps captured
  ✓ all backends agree
✓ Parity tests passed
```

All 7 fixtures green. feature-probe now runs 15 steps (was 14 before the copy-button-node step). dotnet-probe, bun-probe, and node-probe all agree byte-identically on the copy-button serialization.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] jsdom does not implement `document.execCommand`**
- **Found during:** Task 2, Case C test
- **Issue:** `vi.spyOn(document, "execCommand")` threw `"execCommand does not exist"` — jsdom doesn't define this method
- **Fix:** Added `Object.defineProperty(document, "execCommand", { value: () => false, writable: true, configurable: true })` before the spy in Case C, to create the property jsdom lacks
- **Files modified:** `viewmodel-shell/test/copy-button.test.ts`

**2. [Rule 2 - Missing critical functionality] nupkg/ directory untracked, not in .gitignore**
- **Found during:** Task 3 git status check
- **Issue:** `viewmodel-shell-dotnet/nupkg/` was listed as `??` in git status but absent from .gitignore; the plan noted it exists and must NOT be committed
- **Fix:** Added `viewmodel-shell-dotnet/nupkg/` to .gitignore
- **Files modified:** `.gitignore`

**3. [Rule 3 - Environment] Stale dotnet/bun processes locking DLLs during parity pre-build**
- **Found during:** Task 2 parity verification
- **Issue:** Multiple previous parity run processes (dotnet, bun) were holding DLL file locks causing `MSB3027`/`EBUSY` errors on fresh parity pre-build
- **Fix:** Used `Stop-Process` via PowerShell to kill all stale processes before each parity attempt (resolved automatically, not a wire regression — matches D-15 boundary from STATE.md)

---

## Known Stubs

None. All CopyButtonNode surfaces are fully wired: type in index.ts, renderer in browser.ts, record in ViewModels.cs, FeatureProbe backends emit the node unconditionally, parity fixture exercises it.

---

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information-disclosure (accepted) | viewmodel-shell/src/browser.ts | `copyButton` click handler writes `node.text` (server-controlled) to clipboard. Accepted per T-gru-01: text is already visible in rendered UI; no new information is disclosed. No auth tokens should travel via CopyButtonNode. |

---

## Publish Status (Deferred to Orchestrator)

The following steps were NOT performed by this agent per plan constraints:

| Step | Command | Status |
|------|---------|--------|
| npm publish | `cd viewmodel-shell && npm publish --access public` | DEFERRED |
| NuGet push | `dotnet nuget push nupkg/AshleyShrok.ViewModelShell.0.3.10.nupkg --api-key $NUGET_API_KEY ...` | DEFERRED |
| GitHub release | `gh release create v0.3.14 ...` | DEFERRED |

Pre-conditions satisfied for orchestrator:
- `npm run build` succeeded at 0.3.14 (dist/ populated)
- `dotnet pack --nologo -c Release` produced `AshleyShrok.ViewModelShell.0.3.10.nupkg` at `viewmodel-shell-dotnet/bin/Release/`
- All verification gates green (check:core-globals exit 0, vitest 18/18, parity 7/7)
- Commits on `main` at `8c8498c`

---

## Self-Check

**Created files exist:**
- `viewmodel-shell/test/copy-button.test.ts` — FOUND (committed `9db7188`)
- `.planning/quick/260515-gru-add-copybuttonnode-copy-text-to-clipboar/260515-gru-SUMMARY.md` — this file

**Commits exist:**
- `22b95e2` feat(260515-gru-1) — FOUND
- `9db7188` feat(260515-gru-2) — FOUND
- `8c8498c` feat(260515-gru-3) — FOUND

## Self-Check: PASSED
