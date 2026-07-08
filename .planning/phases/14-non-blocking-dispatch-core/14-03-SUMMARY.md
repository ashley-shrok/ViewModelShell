---
phase: 14-non-blocking-dispatch-core
plan: 03
subsystem: testing
tags: [parity-harness, cross-backend, dotnet, typescript, bun, csharp, green-tree-gate]

# Dependency graph
requires:
  - phase: 14-non-blocking-dispatch-core (14-01)
    provides: "ActionEvent.blocking?: boolean (TS wire type) and rebuilt dist/"
  - phase: 14-non-blocking-dispatch-core (14-02)
    provides: "ActionDescriptor.Blocking (bool? + WhenWritingNull, .NET wire twin)"
provides:
  - "Cross-backend parity proof (dotnet-probe/bun-probe/node-probe byte-identical) that ActionEvent.blocking/ActionDescriptor.Blocking is absent-by-default and present-as-literal-false-when-set"
  - "Complete Phase 14 green-tree gate: vitest, check-core-globals, parity, .NET framework tests, every demo .Tests.csproj"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static wire-shape fixture addition (no new POST step, no new action-handler case) mirroring the axes-noop-* / chartSection precedent for additive-field parity coverage"

key-files:
  created: []
  modified:
    - demo/FeatureProbe-bun/handler.ts
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - parity/fixtures/feature-probe.json

key-decisions:
  - "Appended the $comment string via a targeted single-string Edit rather than a JSON-parse-and-rewrite — a first attempt via python json.dump reformatted the entire file (unicode-escaped em-dashes, expanded compact arrays), producing a 401-line diff instead of a 1-line append; reverted and redid it as a minimal string replacement to keep the diff surgical, matching the plan's explicit 'append, do not restructure' instruction."

requirements-completed: [NBA-04]

# Metrics
duration: 8min
completed: 2026-07-08
---

# Phase 14 Plan 03: Cross-Backend Parity + Green-Tree Gate Summary

**Proved `ActionEvent.blocking`/`ActionDescriptor.Blocking` serializes byte-identically (absent-by-default, `false`-when-set) across `dotnet-probe`/`bun-probe`/`node-probe` via a static FeatureProbe addition, then ran and confirmed green the complete Phase 14 close-out gate (vitest 522/523, core-globals guard, full 8-fixture parity suite, .NET framework tests 102/102, and all 5 demo `.Tests.csproj` — 181 tests total, zero failures, zero skips beyond the one pre-existing).**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 completed (Task 2 was gate-verification-only, no file changes)
- **Files modified:** 3

## Accomplishments
- Added a byte-identical "Non-blocking actions (blocking field)" static section to both `demo/FeatureProbe-bun/handler.ts` and `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`: a "Blocking (default)" button whose action omits `blocking` (proving the default stays absent on the wire) and a "Non-blocking" button whose action sets `blocking: false` (proving it serializes as the literal JSON boolean `false`).
- Neither `nba-blocking-default` nor `nba-non-blocking` was wired to a fixture POST step or an action-handler case — matching the existing `axes-noop-*` convention, these buttons exist purely as static wire-shape proof captured by the fixture's existing GET steps.
- Appended one sentence to `parity/fixtures/feature-probe.json`'s `$comment` running changelog documenting the NBA-04 addition and explicitly noting that the client-side coalescing/epoch behavior (NBA-02/NBA-03) is NOT parity-tested (pure client-only mechanics, no wire signal) — that coverage lives in Plan 14-01's `nonblocking-dispatch.test.ts` / `blocking-propagation.test.ts`.
- Ran `bun run parity/run.ts` twice (once for Task 1's fixture verification, once as part of Task 2's full gate re-run): the `feature-probe` fixture captured 39 steps on all three backends (`dotnet-probe`, `bun-probe`, `node-probe`) with `✓ all backends agree` both times — the `blocking` field's wire shape is confirmed byte-identical across all three implementations.
- Ran the complete Phase 14 green-tree gate and confirmed every command green: TS vitest (44 files, 522 passed, 1 skipped — unchanged from Plan 14-01's baseline), `check:core-globals` (AGNOSTIC-03 clean), the full 8-fixture cross-backend parity suite (tasks/contacts/retro/expenses/helpdesk/feature-probe/feature-probe-envelope/reorder, plus skill-source and skill-HTTP-twin parity — all `✓ all backends agree`), the framework's own `.NET` `Tests` project (102/102, matching Plan 14-02's 99 pre-existing + 3 new), and all 5 `demo/**/*.Tests.csproj` projects (Tasks 28/28, ContactManager 39/39, RetroBoard 33/33, HelpDesk 52/52, ExpenseTracker 29/29 — 181 demo tests total, zero failures).
- Confirmed the mutex-rename final self-check from Plan 14-01: `grep -rn "this\.dispatching" viewmodel-shell/src/` returns nothing, proving the old single-mutex field was fully replaced by the two-lane (`blockingInFlight`/`nonBlockingInFlight`) design, not merely partially renamed.
- Ran `npx tsc --noEmit` as an additional sanity check (not in the plan's required gate list, but standard practice for this repo) — zero errors.

## Task Commits

Each task was committed atomically:

1. **Task 1: static blockingSection wire-shape fixture (both backends) + parity run** - `4547124` (test)
2. **Task 2: full Phase 14 green-tree gate** - no commit (verification-only task; `<files>` was empty in the plan and no files were changed — the entire task consisted of running and confirming the five gate commands, documented here in the Summary rather than in a code commit)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `demo/FeatureProbe-bun/handler.ts` - Added `blockingSection` (static `ViewNode`) with two buttons proving `ActionEvent.blocking`'s omitted-vs-`false` wire behavior; inserted into the page's `children` array immediately before `probeModal`.
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` - Added the byte-identical `blockingSection` (`SectionNode` + two `ButtonNode`s using `ActionDescriptor(..., Blocking: false)` / `ActionDescriptor(...)`), added to `pageChildren` immediately before `new ModalNode(...)`.
- `parity/fixtures/feature-probe.json` - Appended one sentence to the `$comment` running changelog documenting the NBA-04 addition; no new fixture step, no `backends.json` edit (both `dotnet-probe`/`bun-probe`/`node-probe` already reference the `feature-probe` fixture).

## Decisions Made
- The `$comment` append was redone after a first attempt (Python `json.load`/`json.dump`) silently reformatted the entire file — `json.dump` re-serialized every field, unicode-escaping literal em-dashes (`—` → `—`) and re-indenting the previously-compact single-line `steps` array entries into multi-line blocks, producing a 401-line diff instead of the intended one-sentence append. Reverted with `git checkout` and redid it as a single targeted string `Edit`, landing a 1-line diff that matches the plan's explicit "append, do not restructure" instruction.
- Followed the plan's explicit precedent (the `axes-noop-*` buttons, the `chartSection`/`kind`-omitted pattern) exactly: no new fixture POST step, no new action-handler `case` arm for either new button name — the static GET-captured tree addition is sufficient to prove the wire shape.

## Deviations from Plan

None - plan executed exactly as written, after self-correcting the one JSON-formatting misstep described above (caught and fixed before committing; the committed diff is the minimal 3-file, ~49-line change the plan specifies).

## Issues Encountered
- `bun run parity/run.ts` initially failed with `Executable not found in $PATH: "dotnet"` — the harness's `dotnet-probe`/etc. pre-build steps need `dotnet` on `PATH`, and the shell session's `PATH` didn't yet include `~/.dotnet`. Resolved by exporting `PATH="$HOME/.dotnet:$PATH"` before invoking `bun run run.ts` (per the plan's own read_first note that `dotnet` lives at `~/.dotnet/dotnet`) — not a code issue, purely an invocation-environment detail.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 14 (Non-Blocking Dispatch Core) is fully green and complete: NBA-01 (TS two-lane coexistence), NBA-02 (client-side coalescing), NBA-03 (client-side out-of-order discard via epoch), and NBA-04 (cross-backend `blocking` wire-shape parity) are all validated.
- Per the plan's explicit scope and the phase's HARD EXCLUSIONS, **no version bump, no publish (npm/NuGet), and no git push were performed** — the release is batched to a later milestone phase per the operator's explicit instruction. The working tree is fully green and ready whenever that batching phase runs.
- No blockers for whatever phase/milestone work follows.

---
*Phase: 14-non-blocking-dispatch-core*
*Completed: 2026-07-08*

## Self-Check: PASSED

- FOUND: `demo/FeatureProbe-bun/handler.ts` contains `blockingSection`
- FOUND: `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` contains `blockingSection`
- FOUND: `parity/fixtures/feature-probe.json` `$comment` contains "Phase 14 (NBA-04)"
- FOUND commit: `4547124` (Task 1)
- VERIFIED: `bun run parity/run.ts` — feature-probe fixture 39/39/39 steps, byte-identical across dotnet-probe/bun-probe/node-probe, full 8-fixture suite green
- VERIFIED: `npx vitest run` — 44 files, 522 passed, 1 skipped
- VERIFIED: `npm run check:core-globals` — AGNOSTIC-03 clean
- VERIFIED: `dotnet test viewmodel-shell-dotnet/Tests` — 102/102
- VERIFIED: all 5 `demo/**/*.Tests.csproj` — 181/181 passed
- VERIFIED: `grep -rn "this\.dispatching" viewmodel-shell/src/` — no matches
