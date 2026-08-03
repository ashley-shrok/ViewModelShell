# Plan 31-04 — Release Ritual v9.2.0

**Status:** COMPLETE
**Executed:** 2026-08-03 (inline by vicky per standing directive #1)
**Release commit:** `858fd20`
**Tag:** `v9.2.0`

## What shipped

- **npm** `@ashley-shrok/viewmodel-shell@9.2.0` — LIVE + indexed (`curl https://registry.npmjs.org/... | .dist-tags.latest → "9.2.0"`)
- **NuGet** `AshleyShrok.ViewModelShell` 9.2.0 — push receipt authoritative (`Your package was pushed`); flat-container index eventually consistent (still showed 9.1.1 at close of session — expected, normal 5-15 min lag)
- **CHANGELOG.md** — new `## 9.2.0 — 2026-08-03 (npm + NuGet aligned)` entry above 9.1.1 (append-only)
- **MIGRATION.md** — new `## Upgrading to v9.2.0` entry above 9.0.0 (copy-pasteable examples on both backends; explicit "no consumer action required")
- **Tag** `v9.2.0` at `858fd20` — pushed to origin
- **main** advanced `45d6990` (v9.1.1) → `858fd20` (v9.2.0); `git merge-base --is-ancestor v9.2.0 main` → ✓ on main (not stranded)
- **Announce** in `#vms-announcements` (`!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net`) — event `$LtM4CuvCyJHiUWK1ZRvrqLBJCoVf8QSkBwjS0Fh9abo`

## Green-tree gate — every command exited 0

Ran the FULL gate before any bump per AGENTS.md working-agreement:

**TS side (in `viewmodel-shell/`):**
- `npm run build` ✓
- `npm run check:test-types` ✓
- `npm run check:core-globals` ✓ (AGNOSTIC-03 held)
- `npm run check:aa-contrast` ✓ (13/13 pairs across all 13 themes)
- `npm run check:no-demo-style` ✓ (36 hand-edited HTML files zero-`<style>`)
- `npm run check:demo-types` ✓ (26 demo projects type-check clean)
- `npm run check:theme-byte-identity` ✓ (11 themes match baseline)
- `npm run check:theme-function` ✓ (12 themes function correctly)
- `npx vitest run` ✓ (1396 passed / 1 skipped / 0 failed across 85 files)

**.NET side + parity (repo root, PATH exported):**
- `dotnet test viewmodel-shell-dotnet/Tests` ✓ (465 passed)
- `dotnet test viewmodel-shell-dotnet/Markdown/Tests` ✓ (53 passed)
- `dotnet build viewmodel-shell-dotnet/Markdown/AshleyShrok.ViewModelShell.Markdown.csproj` ✓ (0 warnings, 0 errors)
- Every demo `*.Tests.csproj` (Tasks 28, ContactManager 39, HelpDesk 61, ExpenseTracker 30, RetroBoard 33; TOTAL FAILURES: 0)
- `bun run parity/run.ts` ✓ (all backends agree; skill parity byte-identical; new `textnode-maxlines` fixture ran against all 3 FeatureProbe backends)
- **`bash parity/check-companion-binary-compat.sh` ✓** — **`companion-binary-compat: OK — 7 distinct node types constructed, all required ctors resolved.`** This was the LOAD-BEARING check: Plan 31-02 placed `TextNode.MaxLines` as an init-only property outside the primary ctor precisely so Markdown 0.2.x's packed IL (which references the 7-param primary ctor via `newobj`) continues to bind. The gate proved the placement discipline delivered on its promise. If it had failed, the property would have leaked into the primary ctor and I'd have HALTED before bumping.

## Files modified in this plan

- `CHANGELOG.md` — new 9.2.0 entry
- `MIGRATION.md` — new v9.2.0 upgrading section
- `viewmodel-shell/package.json` — version 9.1.1 → 9.2.0
- `viewmodel-shell/package-lock.json` — synced to 9.2.0 (also reconciles pre-existing 9.0.0 lockfile drift Phase 30 flagged in its release ritual)
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` — `<Version>` 9.1.1 → 9.2.0

All committed in a single `release: v9.2.0 — TextNode.maxLines axis (npm + NuGet aligned)` commit at `858fd20`.

## Auth precheck (inline per standing directive #1 banked 2026-07-30)

Ran the sync ritual inline — no operator handshake, no `checkpoint:human-action` echo:

- `.env` at repo root read (holds `NPM_TOKEN` bypass-2FA GAT + `NUGET_API_KEY`)
- `~/.npmrc` refreshed from `NPM_TOKEN` (chmod 600)
- `npm whoami` → `ashley-shrok` ✓
- `$NUGET_API_KEY` loaded (46 chars) ✓

## Announce operational note

The relay token in `~/.claude/identities/vicky/relay.json` was invalidated at some point between session start and this send; the first announce attempt got `M_UNKNOWN_TOKEN`. Fresh token minted by logging in with the stored password, `relay.json` updated in-place, announce sent successfully. The receiver Monitor started at session load is running against the OLD token — silently deaf until session recycle refreshes it. Not blocking this release; flagged for the next session load's receiver relaunch.

## Deferred items surfaced during execution

None. Every plan-scoped item shipped. The two pre-existing drift items Plan 31-01 and Plan 31-03 flagged (`package-lock.json` version stamp 9.0.0 → 9.1.1 residual from Phase 30) were reconciled inline by `npm install --package-lock-only` (which synced to 9.2.0, closing both the residual drift AND this release's bump).

## What was NOT touched in this release (per CONTEXT.md scope_fence)

- `AshleyShrok.ViewModelShell.Markdown` companion NuGet — NOT rebuilt. MINOR core bump; the "on any VMS core MAJOR bump, every companion NuGet is rebuilt" rule fires only on MAJOR. AND (more importantly) the init-only-property placement means the ctor arity is unchanged, so pre-9.2.0 Markdown IL binds cleanly against 9.2.0 core. Companion binary-compat gate PROVED this.
- No composite renderer changes. The axis composes into every composite's TextNode slot via the typed-slots pattern (consumer passes TextNode instead of a bare string; renderer treats it as a ViewNode child unchanged).
- No theme changes. No new `--vms-*` token. No new AA-contrast pair.

## Verification for the next agent inspecting this release

- `git log --oneline -1 v9.2.0` → `858fd20 release: v9.2.0 — TextNode.maxLines axis (npm + NuGet aligned)`
- `git merge-base --is-ancestor v9.2.0 main && echo "on main"` → on main
- `curl -s https://registry.npmjs.org/@ashley-shrok/viewmodel-shell | jq -r '.["dist-tags"].latest'` → `9.2.0`
- `curl -s https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json | jq -r '.versions[-1]'` — may need ~5-15 min after this session for indexer to catch up; push receipt was authoritative
- Announce event `$LtM4CuvCyJHiUWK1ZRvrqLBJCoVf8QSkBwjS0Fh9abo` in `!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net`
