---
phase: 15-poll-fold-selection-action-resurrection
plan: 02
subsystem: docs
tags: [agent-skill, blocking, non-blocking-dispatch, wire-protocol, parity]

# Dependency graph
requires:
  - phase: 14-non-blocking-dispatch-core
    provides: "the `ActionEvent.blocking?` / `ActionDescriptor.Blocking` field itself (TS `src/index.ts`, .NET `ViewModels.cs`), already shipped and wire-stable"
provides:
  - "A new '## Non-blocking actions (blocking:false)' section in the canonical agent operating manual explaining the field to wire-driving agents"
  - "Confirmation that viewmodel-shell/agent-skill.md and viewmodel-shell-dotnet/AgentSkill.md remain byte-identical after the addition, with the parity skill-diff gate green"
affects: [16-*, any future phase touching agent-skill.md or the non-blocking-dispatch design]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Documentation-only plans still run the full parity suite (bun run parity/run.ts) as verification, not just a text diff, per the plan's <verification> block"

key-files:
  created: []
  modified:
    - viewmodel-shell/agent-skill.md
    - viewmodel-shell-dotnet/AgentSkill.md

key-decisions:
  - "Placed the new section between '## Polling' and '## Files' per the plan's exact interface spec, and closed with a one-sentence tie-back to polling (poll is itself a non-blocking-lane dispatch) as instructed."

patterns-established: []

requirements-completed: [NBA-07]

# Metrics
duration: 2min
completed: 2026-07-08
---

# Phase 15 Plan 02: Document blocking:false for wire-driving agents Summary

**Added a "Non-blocking actions (blocking:false)" section to agent-skill.md clarifying the Phase 14 field is a client-side-only scheduling hint that never rides the `_action` POST payload and requires no special handling from wire-driving agents.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-08T15:56:00Z
- **Completed:** 2026-07-08T15:57:33Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `viewmodel-shell/agent-skill.md` gained a new `## Non-blocking actions (blocking:false)` section, correctly placed between `## Polling` and `## Files`, explaining that `blocking:false` is a client-side dispatch-lane hint, never appears in the `_action` POST body, is informational-only for agents with no dispatch loop, and connects it to the existing polling docs (poll is itself a non-blocking-lane dispatch).
- Byte-copied the updated file to `viewmodel-shell-dotnet/AgentSkill.md` so the two canonical skill sources stay identical.
- Ran the full cross-backend parity suite (`bun run parity/run.ts`) — exit code 0, both the skill source-twin diff and the skill HTTP-twin check (against the live dotnet-helpdesk/bun-helpdesk backends) reported green.

## Task Commits

Each task was committed atomically:

1. **Task 1: document `blocking:false` for wire-driving agents in agent-skill.md** - `aafd9cb` (docs)
2. **Task 2: byte-copy to the .NET twin + parity skill-diff verification** - `050e7f7` (docs)

_No plan-metadata commit yet — this SUMMARY.md + STATE.md/ROADMAP.md update will be captured in the final commit per the execute-plan workflow._

## Files Created/Modified
- `viewmodel-shell/agent-skill.md` - new `## Non-blocking actions (blocking:false)` section (10 lines) inserted between Polling and Files
- `viewmodel-shell-dotnet/AgentSkill.md` - byte-identical copy of the above (maintains the `checkSourceTwins()` parity invariant)

## Decisions Made
None - followed plan as specified. The plan's `<interfaces>` block pinned the exact placement and the `checkSourceTwins()`/`cp` fix command, leaving no open decisions.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both acceptance-criteria grep checks (Task 1) and the byte-diff + full parity run (Task 2) passed on the first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

NBA-07 is now satisfied: the ROADMAP-named documentation gap for `blocking:false` is closed, both skill sources are byte-identical, and the parity gate (including the skill source + HTTP twin checks) is green. Plan 15-03 (if it depends on this doc surface) can proceed; no blockers.

---
*Phase: 15-poll-fold-selection-action-resurrection*
*Completed: 2026-07-08*

## Self-Check: PASSED

- FOUND: viewmodel-shell/agent-skill.md
- FOUND: viewmodel-shell-dotnet/AgentSkill.md
- FOUND: commit aafd9cb
- FOUND: commit 050e7f7
