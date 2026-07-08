---
phase: 16-test-apps-human-verification-release
plan: 01
subsystem: testing
tags: [bun, viewmodel-shell, non-blocking-actions, human-verification-demo]

# Dependency graph
requires: []
provides:
  - "demo/NonBlockingActionBar-bun/ — a runnable single-process Bun full-stack app (port 3008) exercising selection → live server-computed action bar"
  - "Working proof surface for NBA-06 (checkbox optimistic-check/echo-back/coalescing) and shellRejection-based re-validation, for use by 16-04's combined operator script"
affects: ["16-02", "16-03", "16-04"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-row unique blocking:false action names (recompute-<id>) driving a live server-recomputed action bar, distinct from the client-computed anti-pattern"
    - "Dual-channel soft rejection: shellRejection(...) on the wire + state.actionError inline TextNode, both populated from the same message"

key-files:
  created:
    - demo/NonBlockingActionBar-bun/package.json
    - demo/NonBlockingActionBar-bun/tsconfig.json
    - demo/NonBlockingActionBar-bun/vite.config.ts
    - demo/NonBlockingActionBar-bun/index.html
    - demo/NonBlockingActionBar-bun/src/main.ts
    - demo/NonBlockingActionBar-bun/server.ts
    - demo/NonBlockingActionBar-bun/bun.lock
  modified: []

key-decisions:
  - "Empty-selection and disqualifying-row rejections use distinct messages (one generic, one naming the offending row's vendor/status) rather than a single shared message, satisfying the plan's 'specific reason, naming the offending row' requirement for the race-condition case while still covering the empty-selection case"
  - "recompute-<id> handler does not mutate state — it only sleeps RECOMPUTE_DELAY_MS (750ms) then falls through to buildVm, since the checkbox's own bind write already updated selectedIds client-side before the dispatch fired"

requirements-completed: [NBA-08]

duration: 12min
completed: 2026-07-08
---

# Phase 16 Plan 01: NonBlockingActionBar Demo Summary

**Bun full-stack demo (port 3008) where a table's per-row checkboxes fire `blocking:false` recompute dispatches that server-recompute an Approve/Reject action bar, with `shellRejection`-based re-validation on a stale-bar race click**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-08T16:52:00Z (approx, first commit 12:52:39 -0400)
- **Completed:** 2026-07-08T16:56:00Z (approx, second commit 12:55:37 -0400 + verification)
- **Tasks:** 2
- **Files modified:** 7 (6 created + bun.lock)

## Accomplishments
- Scaffolded `demo/NonBlockingActionBar-bun/` mirroring `Tasks-fullstack-bun`'s five config/shell files byte-for-byte except app-specific strings (name, title, `/api/actionbar` endpoint pair), zero custom CSS, agent-discoverability meta tag present.
- Built `server.ts`: a 6-row invoice table (3 pending, 1 locked, 1 approved, 1 rejected) with per-row `select-<id>` checkboxes bound to `selectedIds.<id>`, each firing a unique non-blocking `recompute-<id>` action (artificial 750ms delay) so the operator has a window to click Approve/Reject before the action bar visually catches up.
- Approve/Reject/Clear Selection action bar (`layout:"row"`) whose `disabled` flags are computed fresh every render from server-owned row status — never client-computed.
- `approve-selected`/`reject-selected` re-validate the submitted selection server-side: an empty selection or one including a non-pending row is rejected via `shellRejection` (wire) + `state.actionError` (inline `TextNode`, `tone:"danger"`), naming the offending row's vendor and status; a fully-pending selection mutates those rows and clears selection/error.
- `reset-demo` restores the seed so the operator (and 16-04's script) can re-run repeatedly without restarting the process.

## Task Commits

Each task was committed atomically:

1. **Task 1: scaffold the Bun full-stack app shell** - `560571e` (feat)
2. **Task 2: server.ts — invoice table, per-row recompute, and the live-validated action bar** - `47a30a7` (feat)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified
- `demo/NonBlockingActionBar-bun/package.json` - Bun/Vite scripts, `viewmodel-shell` link dependency
- `demo/NonBlockingActionBar-bun/tsconfig.json` - identical to Tasks-fullstack-bun's strict TS config
- `demo/NonBlockingActionBar-bun/vite.config.ts` - regex aliases into local framework source (same relative depth as sibling `-bun` demos)
- `demo/NonBlockingActionBar-bun/index.html` - zero-`<style>` shell, agent-discoverability meta tag (`viewmodel-shell/1.0`, `/api/actionbar` + `/api/actionbar/action`)
- `demo/NonBlockingActionBar-bun/src/main.ts` - `ViewModelShell` + `BrowserAdapter` wiring against the same-origin `/api/actionbar` endpoints
- `demo/NonBlockingActionBar-bun/server.ts` - invoice table model, `buildVm`, and the `createAction` handler (recompute-\*, approve-selected, reject-selected, clear-selection, reset-demo) + static-file serving + agent-skill mount
- `demo/NonBlockingActionBar-bun/bun.lock` - committed per repo convention (`node_modules/`/`dist/` remain gitignored)

## Decisions Made
- Split the rejection message into two cases (no selection vs. a disqualifying row) rather than one generic message, so the disqualifying-row case names the specific offending row's vendor and status as the plan required, while the empty-selection case still gets a clear, distinct message.
- `recompute-*` is a pure delay-then-re-render — it deliberately does not touch `state.rows`/`state.selectedIds`, since the checkbox's own client-side bind write already applied the selection change before the non-blocking dispatch fired; the server's only job here is to give the operator a comfortable window before the action bar catches up.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The first `tsc --noEmit` pass surfaced one structural-typing issue (an inline `Record<string, unknown>[]` array wasn't assignable to `TableNode.rows: TableRow[]`), fixed in the same task by importing and annotating with the `TableRow` type re-exported from `@ashley-shrok/viewmodel-shell/server` (mirroring how `HelpDesk-bun/server.ts` types its rows) — not a deviation from the plan, just an implementation detail resolved before the task's `<verify>` step ran.

## User Setup Required

None - no external service configuration required. The demo is a local/tailnet-only Bun process on port 3008 with no auth, no new dependencies, and no environment variables.

## Next Phase Readiness
- `demo/NonBlockingActionBar-bun/` builds (`bunx tsc --noEmit` clean, `vite build` succeeds) and serves a verified `{vm, state}` wire: `GET /api/actionbar` returns all 6 rows; `POST /api/actionbar/action` was smoke-tested for `recompute-<id>` (750ms delay confirmed via `time curl`), a rejected `approve-selected` against a selection including the locked row (message names "Fabrikam Freight" / "Locked", present in both `rejected.violations` and `state.actionError`), a successful `approve-selected` against an all-pending selection (rows flip to `approved`, `selectedIds` clears), and an `UnknownActionError` 400 for a bogus action name.
- No blockers for 16-02/16-03 (the other two purpose-built demo apps) or 16-04 (the combined operator verification script, which will point at this app's port 3008 alongside the other two).

---
*Phase: 16-test-apps-human-verification-release*
*Completed: 2026-07-08*

## Self-Check: PASSED

All 8 claimed files verified present on disk; all 3 commit hashes (`560571e`, `47a30a7`, `5759857`) verified present in `git log --oneline --all`.
