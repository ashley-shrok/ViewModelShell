---
phase: 16-test-apps-human-verification-release
plan: 03
subsystem: testing
tags: [bun, vite, vms-demo, non-blocking-actions, staleness, human-verification]

# Dependency graph
requires:
  - phase: 14-non-blocking-dispatch-core
    provides: "NBA-03 (client-side sequence counter that discards a stale/out-of-order response rather than letting it clobber a newer render)"
provides:
  - "demo/NonBlockingStaleness-bun/ — a runnable single-process Bun full-stack app proving out-of-order/staleness discard"
  - "A deterministic, always-reproducible human-verification surface for NBA-03 (a 3s slow background check vs. a ~150ms fast blocking update, no timing precision required from the operator)"
affects: [16-04-combined-human-verification-script, 16-05-release-prep]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Tasks-fullstack-bun single-process demo pattern (server.ts serves both the wire API and the Vite-built static client)"]

key-files:
  created:
    - demo/NonBlockingStaleness-bun/package.json
    - demo/NonBlockingStaleness-bun/tsconfig.json
    - demo/NonBlockingStaleness-bun/vite.config.ts
    - demo/NonBlockingStaleness-bun/index.html
    - demo/NonBlockingStaleness-bun/src/main.ts
    - demo/NonBlockingStaleness-bun/server.ts
  modified: []

key-decisions:
  - "The 3s slow background delay (BG_CHECK_DELAY_MS) is deliberately wide relative to the 150ms fast delay so the race (fire slow, then immediately fire fast, then wait for the slow response to arrive late) reproduces reliably with a casual couple-second gap between clicks — no operator timing precision needed."
  - "'set-fast' omits the `blocking` field entirely (defaults to blocking:true) — the scenario's whole point is that a blocking response always applies unconditionally the instant it arrives, advancing appliedSeq past the still-in-flight slow response's seq."
  - "No automated test file — per NBA-08's own verification method, this demo is human-verified in 16-04."

patterns-established: []

requirements-completed: [NBA-08]

# Metrics
duration: 10min
completed: 2026-07-08
---

# Phase 16 Plan 03: NonBlockingStaleness-bun Demo Summary

**Bun full-stack demo app (port 3010) with a slow (~3s) `blocking:false` background check racing a fast (~150ms) default-blocking update, proving NBA-03's client-side staleness discard never lets a late-arriving out-of-order response clobber a newer render.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-08T21:05:00Z (approx.)
- **Completed:** 2026-07-08T21:15:00Z (approx.)
- **Tasks:** 2 completed
- **Files modified:** 7 (6 new source files + 1 generated bun.lock; dist/ and node_modules/ gitignored)

## Accomplishments
- Scaffolded `demo/NonBlockingStaleness-bun/` mirroring the `Tasks-fullstack-bun` / `NonBlockingActionBar-bun` / `NonBlockingPoll-bun` single-process pattern (zero custom CSS, agent-discoverability meta tag, dark-purple theme, no poll configured).
- Implemented `server.ts`: `bg-check` is a `blocking:false` action that sleeps ~3s before setting `value`/`lastAppliedBy` to the background result; `set-fast` is a plain default-blocking action that sleeps ~150ms before setting the user result; `reset-demo` restores initial state; unknown actions throw `UnknownActionError`.
- Mounted the agent-skill handler at `/.well-known/vms-skill.md` with an app-specific preamble naming the NBA-03 mechanism under test.
- Verified end-to-end: `tsc --noEmit` clean, `vite build` succeeds, and a live `bun run server.ts` smoke test confirmed `GET /api/staleness` returns the initial `{vm, state}`, `POST .../action` correctly applies both `bg-check` and `set-fast` results, and the agent skill endpoint serves the app-specific preamble.

## Task Commits

Each task was committed atomically:

1. **Task 1: scaffold the Bun full-stack app shell** - `c41ed56` (feat)
2. **Task 2: server.ts — the slow background check vs. the fast blocking update** - `0ed12d2` (feat)

_No TDD tasks in this plan — per NBA-08's own verification method (human-verified in 16-04), no automated test file was written._

## Files Created/Modified
- `demo/NonBlockingStaleness-bun/package.json` - app manifest, `name: "nonblocking-staleness-bun"`, same deps as the sibling bun demos
- `demo/NonBlockingStaleness-bun/tsconfig.json` - copied verbatim from `Tasks-fullstack-bun`
- `demo/NonBlockingStaleness-bun/vite.config.ts` - copied verbatim (regex aliases mapping the published package specifiers to in-repo source)
- `demo/NonBlockingStaleness-bun/index.html` - zero `<style>`, agent-discoverability meta tag pointing at `/api/staleness` + `/api/staleness/action`
- `demo/NonBlockingStaleness-bun/src/main.ts` - `ViewModelShell` wiring, same-origin endpoint config, no `pollInterval`
- `demo/NonBlockingStaleness-bun/server.ts` - `DemoState { value, lastAppliedBy }`, `buildVm`, the three-action handler (`bg-check`/`set-fast`/`reset-demo`), static file server, agent-skill mount, `Bun.serve` on port 3010
- `demo/NonBlockingStaleness-bun/bun.lock` - generated by `bun install`

## Decisions Made
- `BG_CHECK_DELAY_MS = 3000` vs. `FAST_DELAY_MS = 150` — a wide, deliberate gap so the operator can casually click slow-then-fast within a couple of seconds and always reproduce the race, matching the plan's stated goal of "no timing precision required from the human."
- `set-fast`'s action omits the `blocking` field entirely (defaults to blocking) — this is the scenario's whole point: a blocking response always applies unconditionally the instant it arrives, regardless of any in-flight non-blocking response.
- No `nextPollIn`/`pollInterval` anywhere — this demo has no poll surface by design (distinct from 16-02's NonBlockingPoll-bun).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `demo/NonBlockingStaleness-bun/` is a fully building, runnable demo ready for 16-04's combined human-verification script (operator clicks the slow background check, then immediately the fast button, confirms the fast value displays, and confirms it never reverts after waiting for the slow response to land).
- No blockers. Port 3010 is free of conflicts with the other phase-16 demo apps (3008 = NonBlockingActionBar-bun from 16-01, 3009 = NonBlockingPoll-bun from 16-02).

---
*Phase: 16-test-apps-human-verification-release*
*Completed: 2026-07-08*
