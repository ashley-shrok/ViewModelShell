# 20-07 SUMMARY — v5.1.0 release closeout

**Plan:** 20-07 (wave 4) · **Executed by:** Vicky (maintainer, directly — not delegated; publish uses maintainer `.env` creds + the `@vicky` relay account)
**Date:** 2026-07-11

## Task 1 — docs + version bumps
- `agent-skill.md` confirmed byte-identical to `viewmodel-shell-dotnet/AgentSkill.md` (`diff` = 0). No edit — these are new node TYPES, not new wire verbs/side-effects, so the protocol skill doesn't change.
- CHANGELOG `5.1.0 / 5.1.0` entry added (both packages, BreadcrumbNode + StepsNode, additive, wire token stays `viewmodel-shell/1.0`).
- MIGRATION `5.1.0` note added ("new optional nodes — no action required; existing apps + agents byte-unchanged").
- Versions bumped: `viewmodel-shell/package.json` 5.0.1→5.1.0; `package-lock.json` two self-version fields (surgical) →5.1.0; `AshleyShrok.ViewModelShell.csproj` 5.0.0→5.1.0.

## Task 2 — full green-tree gate at release version (ALL GREEN)
`npm run build` OK · `npx vitest run` 581 passed/1 skipped · `check:core-globals` OK · `check-aa-contrast` 13/13 · `check-theme-byte-identity` OK · `bun run parity/run.ts` byte-identical green · framework `.NET Tests` 121 · demo Tests: ContactManager 39, ExpenseTracker 29, HelpDesk 52, RetroBoard 33, Tasks 28. No version-pinned test broke.

## Task 3 — publish ritual
- Auth precheck: `.env` NPM_TOKEN synced to `~/.npmrc`, `npm whoami` = `ashley-shrok`; `NUGET_API_KEY` loaded. (Never `npm login`.)
- Release commit → npm publish (`5.1.0`) → `dotnet pack` + `dotnet nuget push` (`5.1.0`) → tag `v5.1.0` → push `main` + tag → CI watched green → `#vms-changelog` announced as `@vicky`.
- `git merge-base --is-ancestor v5.1.0 main` verified (main carries the release).

See the release commit + the `v5.1.0` tag for the authoritative record; CHANGELOG `5.1.0` is the consumer-facing log.
