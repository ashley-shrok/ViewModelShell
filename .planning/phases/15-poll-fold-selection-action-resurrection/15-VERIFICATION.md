---
phase: 15-poll-fold-selection-action-resurrection
verified: 2026-07-08T16:11:28Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 15: Poll-Fold + Selection-Action Resurrection Verification Report

**Phase Goal:** `pollInterval` becomes sugar over the non-blocking dispatch path so a poll in flight
no longer silently drops a user click. Per-checkbox/table-selection server-refresh returns as a
first-class pattern: the checkbox checks immediately (optimistic local bind write) AND fires a
`blocking:false` action whose returned tree echoes the selection back, so a stale response can
never revert a rapid toggle (the exact 0.15.0 `selection.action` failure). `agent-skill.md` gains a
note on `blocking:false` semantics, byte-copied to `.NET AgentSkill.md`.

**Verified:** 2026-07-08T16:11:28Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A blocking user action dispatched while an auto-scheduled poll round trip is in flight fires and applies — not dropped (NBA-05) | ✓ VERIFIED | `viewmodel-shell/test/poll-fold.test.ts` drives this through the REAL `pollInterval`→`setTimeout`→auto-dispatch path (not a manual `dispatch(poll,true)` call); re-ran independently — 2/2 tests pass. `schedulePoll`/`ShellOptions.pollInterval` doc comments (index.ts:764, 1414) explain poll always computes `nonBlocking=true` via `silent=true`, so it never contends with `blockingInFlight`. |
| 2 | The poll loop continues to reschedule itself after coexisting with a user action | ✓ VERIFIED | `poll-fold.test.ts`'s second describe block explicitly waits a second full interval after a blocking action applies and asserts a new auto-poll fires (`fetchMock` call count increments, action name `"poll"`). Passed on independent re-run. |
| 3 | A stale/delayed poll response arriving after a newer blocking render is discarded | ✓ VERIFIED | `poll-fold.test.ts` test 1 resolves the poll's deferred response AFTER the blocking response already applied and asserts state is unchanged (`{tag:"blocking-applied"}`, not `{tag:"poll-stale"}`). Mechanism: blocking arm sets `appliedSeq` unconditionally via `Math.max`, so the later-processed lower-seq poll response fails the `seq >= appliedSeq` check. |
| 4 | Rapid double-toggling of the SAME checkbox (blocking:false) never permanently reverts — final rendered value matches the user's LAST toggle | ✓ VERIFIED | Internal-state level: `nonblocking-dispatch.test.ts`'s new "Phase 15 (NBA-06)" describe block (line 293) proves toggle A's stale echo is discarded and toggle B's response wins. Rendered-DOM level: `checkbox-rapid-toggle.test.ts` renders a real checkbox via `ViewModelShell`+`BrowserAdapter`+jsdom and asserts `.checked` never reverts to the stale value and ends matching the last click (3 `checked).toBe(false)` assertions at steps for initial/post-A/post-B). Both independently re-ran green. |
| 5 | The non-blocking apply gate correctly implements the coalesce-pending discard rule; the blocking lane is untouched | ✓ VERIFIED | `grep -n "pendingNonBlockingRefire === null" viewmodel-shell/src/index.ts` matches exactly once (line 1129), inside the non-blocking `if` arm (`if (seq >= this.appliedSeq && this.pendingNonBlockingRefire === null)`). The `else` (blocking) arm at lines 1132-1141 is unconditional (`this.appliedSeq = Math.max(...); this.processResponse(body);` with no gating `if`) — confirmed by direct read and by the code review's independent diff-against-parent check. |
| 6 | `agent-skill.md` documents `blocking:false` for wire-driving agents and is byte-identical to the .NET twin | ✓ VERIFIED | `diff viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md` → empty, exit 0. New `## Non-blocking actions (\`blocking:false\`)` section present in both, at line 138, correctly placed between `## Polling` (134) and `## Files` (148). States the field is client-side-only, never rides the `_action` POST payload, and is informational-only for wire-driving agents. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `viewmodel-shell/src/index.ts` | Coalesce-pending discard gate + NBA-05/NBA-06 doc comments | ✓ VERIFIED | Gate present exactly once at line 1129; NBA-05 doc at lines 764, 1414; NBA-06 doc at lines 960, 1120. `npx tsc --noEmit` exits 0. |
| `viewmodel-shell/test/poll-fold.test.ts` | NBA-05 real-pollInterval-timer coverage | ✓ VERIFIED | 165 lines, 2 tests, both use `pollInterval: 10` and real `setTimeout` waits (no manual poll dispatch). Passes independently. |
| `viewmodel-shell/test/nonblocking-dispatch.test.ts` | NBA-06 regression test | ✓ VERIFIED | New describe block at line 293 containing literal "NBA-06"; FAIL-before/PASS-after documented in 15-01-SUMMARY.md via `git show HEAD~1`. |
| `viewmodel-shell/test/checkbox-rapid-toggle.test.ts` | Rendered-DOM proof of NBA-06 | ✓ VERIFIED | 146 lines, 1 test, uses real `BrowserAdapter`+jsdom; 3 `checked).toBe(false)` assertions (>= 2 required). |
| `.planning/design/non-blocking-actions.md` | Coalescing section refinement (NBA-06 design-of-record) | ✓ VERIFIED | "Refinement (Phase 15, NBA-06)" paragraph present at line 121, in the Coalescing section, matching the style of the existing CR-02 refinement. |
| `viewmodel-shell/agent-skill.md` | New `## Non-blocking actions` section | ✓ VERIFIED | Present, correctly placed, correct content. |
| `viewmodel-shell-dotnet/AgentSkill.md` | Byte-identical copy | ✓ VERIFIED | `diff` empty. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `CheckboxNode.action (blocking:false)` dispatched from `browser.ts`'s `checkbox()` handler | `ViewModelShell.performRoundTrip`'s non-blocking apply gate | the two-lane dispatch loop + `pendingNonBlockingRefire` coalescing slot | ✓ WIRED | Confirmed via `checkbox-rapid-toggle.test.ts`, which drives the actual `checkbox()` DOM handler (not a synthetic `dispatch()` call) through the fix and observes the correct end state at the rendered `.checked` property. |
| `viewmodel-shell/agent-skill.md` | `viewmodel-shell-dotnet/AgentSkill.md` | `parity/check-skill.ts`'s `checkSourceTwins()` byte-diff | ✓ WIRED | Independently re-ran `bun run parity/run.ts` — `✓ skill source files byte-identical (12490B)` and `✓ skill HTTP twins byte-identical (12757B) across 2 backends`. |

### Behavioral Spot-Checks (independently re-run by the verifier, not copied from SUMMARY)

| Behavior | Command | Result | Status |
|---|---|---|---|
| New/extended test files pass in isolation | `npx vitest run test/poll-fold.test.ts test/checkbox-rapid-toggle.test.ts test/nonblocking-dispatch.test.ts` | 3 files, 11 tests, all pass | ✓ PASS |
| Full TS suite green, exact count match | `npx vitest run` | 46 files, 528 passed, 1 skipped — matches 15-03-SUMMARY.md exactly | ✓ PASS |
| Core platform-agnosticism guard | `npm run check:core-globals` | `✓ AGNOSTIC-03: ... zero platform globals.` | ✓ PASS |
| TS compiles clean | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Cross-backend parity + skill twins | `PATH="$HOME/.dotnet:$PATH" bun run parity/run.ts` | 8/8 `✓ all backends agree` + skill source (12490B) + skill HTTP twins (12757B) byte-identical + `✓ Parity tests passed` | ✓ PASS |
| .NET framework tests | `dotnet test viewmodel-shell-dotnet/Tests` | 102/102 passed | ✓ PASS |
| Demo test project spot-check | `dotnet test demo/HelpDesk/AspNetCore.Tests/HelpDesk.Tests.csproj` | 52/52 passed — matches 15-03-SUMMARY.md exactly | ✓ PASS |
| No debt markers in modified files | `grep -n "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all 7 phase-modified files | no matches | ✓ PASS |
| Git tree state | `git status` / `git log` | working tree clean, all 5 task commits present (9bd5381, 645f8a0, 659f5ee, aafd9cb, 050e7f7) on `main`; repo intentionally ahead of `origin/main` (no push performed, per plan's explicit exclusion and AGENTS.md's operator-gated push rule) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| NBA-05 | 15-01 | `pollInterval` runs polls over the non-blocking path; a user action during a poll is honored, not dropped | ✓ SATISFIED | Doc comments (index.ts:764,1414) + real-timer test (`poll-fold.test.ts`), independently re-verified passing. |
| NBA-06 | 15-01 | Per-checkbox/table-selection server-refresh: optimistic check + `blocking:false` echo-back, no stale-response revert | ✓ SATISFIED | Code fix (index.ts:1129) + internal-state regression test (`nonblocking-dispatch.test.ts`) + rendered-DOM proof (`checkbox-rapid-toggle.test.ts`), all independently re-verified passing. |
| NBA-07 | 15-02 | `agent-skill.md` documents `blocking:false`, byte-identical to `.NET AgentSkill.md` | ✓ SATISFIED | New section present in both files at identical line 138; `diff` empty; independently re-ran parity suite confirming both source-twin and HTTP-twin byte-identity. |

REQUIREMENTS.md maps exactly these three IDs to Phase 15 (lines 71-73); no orphaned requirements found.

### Anti-Patterns Found

None. Code review (`15-REVIEW.md`, 0 critical / 1 warning / 2 info) found:
- **WR-01 (warning, non-blocking):** the NBA-06 JSDoc/design-doc prose describes the fix's rationale in terms of "the same control" toggling, but `pendingNonBlockingRefire` is actually a single global slot shared across all non-blocking dispatches — the code's actual discard scope is broader (any queued non-blocking refire, not just same-control) than the prose states. Reviewed and independently confirmed accurate: this is a documentation-precision gap, not a functional defect (the review traced that the broader actual behavior causes no incorrect output, given the framework's stateless whole-tree-recompute model). Does not block phase completion — flagged as a WARNING for optional doc tightening in a future pass, not a gap in what was delivered.
- IN-01, IN-02: informational notes about test-file conventions (real-timer margin, manual `stopPolling()` cleanup pattern) — no action required, not correctness issues.

No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) found in any of the 7 files this phase modified.

### Human Verification Required

None. This phase is a pure client-dispatch-loop fix + documentation change, fully covered by automated tests at both the internal-state level and the rendered-DOM level (via jsdom + `BrowserAdapter`, which is the established testing convention for this framework's UI-facing behavior — see AGENTS.md's "Testing" section: "no browser, no Playwright, no running server" is the framework's own design intent, and this phase's verification adheres to it). No visual/UX judgment call, no external service integration, no real-time behavior beyond what the real-timer poll tests already exercise deterministically.

### Gaps Summary

None. All 6 derived observable truths verified, all 7 required artifacts present and correct, both key links wired and independently re-confirmed, all 3 requirement IDs (NBA-05, NBA-06, NBA-07) satisfied with concrete on-disk evidence, and every gate command in the green-tree suite re-run independently by the verifier producing counts that match the SUMMARY's claims exactly (46/528/1-skip vitest, 8/8+skill parity, 102/102 .NET framework tests, and a spot-checked demo project at 52/52). The one code-review WARNING (WR-01) is a documentation-precision nit that does not affect correctness and does not block the phase goal.

---

*Verified: 2026-07-08T16:11:28Z*
*Verifier: Claude (gsd-verifier)*
