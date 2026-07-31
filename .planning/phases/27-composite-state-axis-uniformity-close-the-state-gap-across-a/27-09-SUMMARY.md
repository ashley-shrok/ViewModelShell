---
phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
plan: 09
subsystem: testing
tags: [green-tree-gate, agents-md, vitest, parity, dotnet, aa-contrast, core-globals, demo-type-check, markdown-companion, ashley-signoff]

# Dependency graph
requires:
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    provides: "27-01→27-08 shipped the wire additions, unified STYLE-3 CSS, .NET twin, vitest coverage (+64), .NET tests (+14 CompositeStateAxisSerializationTests), FeatureProbe parity extensions (all 3 backends), and tailnet visual sign-off. This plan is the pre-publish load-bearing gate that certifies the whole tree is safe to ship."
provides:
  - "GREEN verdict on all 8 AGENTS.md green-tree gates against the Phase 27 tree pre-publish"
  - "Confirmed baselines: framework vitest 1315 passed / 1 skipped (holds 27-05's +64); framework .NET Tests 442 passed (holds 27-06's +14); parity cross-backend byte-diff + expectBodyContains tripwires green on all 3 backends (27-07 extensions verified); demo type-check auto-discovered 22 projects (includes StateAxisVerification-bun from 27-08); AA-contrast 13/13 pairs × 13 themes; Markdown companion compiles clean under the soon-to-be-8.1.0 core (MINOR-bump binary-compat proven)"
  - "Ashley visual sign-off on the gate verdict via SendMessage (`signed-off: ok`)"
  - "Unblocks Plan 27-10 (docs — CHANGELOG + MIGRATION) and Plan 27-11 (release ritual — aligned npm 8.1.0 + NuGet 8.1.0 publish + tag + advance main)"
affects: ["27-10 (docs opens on this green verdict); 27-11 (release ritual opens on 27-10's finalization)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Load-bearing pre-publish gate discipline: every one of AGENTS.md's 8 suites runs before any docs/release plan opens. Pre-existing red is NOT a waiver — 'red suite is a red suite' per AGENTS.md 'Working agreement'."
    - "Ashley-gated overall verdict handoff: the executor HALTS at a blocking checkpoint after running the gates, reporting per-suite result + counts + timing; only Ashley's explicit sign-off transitions from verification to SUMMARY commit. This preserves the 'never publish/push anything broken' invariant against silent auto-approval."

key-files:
  created:
    - ".planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-09-SUMMARY.md"
  modified: []

key-decisions:
  - "No deviations from the gate list: all 8 gates executed as specified in the plan interfaces table, in the specified order (fastest-signal-first: vitest → guards → parity → dotnet → demos → companion)."
  - "Ashley sign-off received (`signed-off: ok`) after inspecting the overall verdict; no waivers invoked (nothing to waive — gate went clean)."

patterns-established:
  - "Gate-then-halt-then-signoff pattern for pre-publish plans: run the full green-tree gate in one wave, report tabular verdict + counts + timing at the checkpoint, wait for explicit human sign-off before proceeding to SUMMARY/commit. Mirrors the tailnet visual sign-off pattern (27-08) applied to test-suite results."

requirements-completed: [STATE-AXIS-GREEN-TREE-GATE]

# Metrics
duration: ~1min (gate execution wall-clock; sign-off wait excluded)
completed: 2026-07-31
---

# Phase 27 Plan 09: AGENTS.md green-tree gate — pre-publish verification Summary

**All 8 AGENTS.md green-tree gates GREEN on the Phase 27 tree — vitest 1315/skip 1, .NET 442, parity all-backends-agree, AA 13/13 × 13, demo-types 22/22, core-globals clean, every demo Tests.csproj green (RetroBoard 33 + Tasks 28 + ContactManager 39 + HelpDesk 61 + ExpenseTracker 30 = 191), Markdown companion compiles clean — cleared for docs (27-10) + release (27-11).**

## Performance

- **Duration:** ~1min gate wall-clock (Ashley sign-off wait excluded)
- **Started:** 2026-07-31T22:21:43Z (first gate)
- **Completed:** 2026-07-31 (post-signoff)
- **Tasks:** 2 auto + 1 blocking checkpoint (Ashley human-verify)
- **Files modified:** 0 (verification-only plan)

## Accomplishments

- Executed the full 8-suite AGENTS.md green-tree gate in fastest-signal-first order.
- Confirmed the Phase 27 shipped code holds every prior baseline (vitest +64 from 27-05 still green; .NET +14 from 27-06 still green; parity tripwires from 27-07 fire on all 3 backends; demo type-check auto-discovered the new StateAxisVerification-bun demo from 27-08).
- Proved MINOR-bump binary compat on the sole shipped companion NuGet (Markdown) — no rebuild storm required for the 8.0.0 → 8.1.0 .NET bump.
- Returned tabular per-gate verdict at the blocking checkpoint; obtained Ashley's `signed-off: ok`; unblocked 27-10 (docs) and 27-11 (release).

## Task Commits

Verification-only plan — no code commits during Tasks 1-2 (the gate is executed against the already-committed Phase 27 tree). This SUMMARY is the sole artifact.

1. **Task 1: Run gates 1-6** — no commit (verification)
2. **Task 2: Run gate 7 (demo loop) + gate 8 (Markdown compile)** — no commit (verification)
3. **Task 3 (checkpoint): Ashley human-verify** — resumed with `signed-off: ok`

**Plan metadata:** SUMMARY commit only (this file).

## Gate-by-gate evidence

| # | Suite | Command | Verdict | Counts | Wall-clock |
|---|-------|---------|---------|--------|------------|
| 1 | Framework vitest | `cd viewmodel-shell && npx vitest run` | **PASS** | 79 files, 1315 passed / 1 skipped / 0 failed | 3s |
| 2 | Core-globals guard | `cd viewmodel-shell && npm run check:core-globals` | **PASS** | `AGNOSTIC-03: src/index.ts references zero platform globals` | <1s |
| 3 | Demo type-check | `cd viewmodel-shell && npm run check:demo-types` | **PASS** | 22 demo projects type-check clean (auto-discovered — includes 27-08's StateAxisVerification-bun + 27-07's FeatureProbe-bun edits) | 11s |
| 4 | AA-contrast (13-pair × 13 themes) | `cd viewmodel-shell && npm run check:aa-contrast` | **PASS** | 13/13 pairs WCAG-AA on default + all 12 shipped themes; D-07 clean | <1s |
| 5 | Cross-backend parity | `cd parity && bun run run.ts` | **PASS** | All backends agree across fixtures (helpdesk-seeded, feature-probe, reorder, etc.); skill source byte-identical (22086B); skill HTTP twins byte-identical (22267B) across 2 backends; 27-07 Phase-27 expectBodyContains tripwires fire green on all 3 backends | 15s |
| 6 | Framework .NET Tests | `dotnet test viewmodel-shell-dotnet/Tests` | **PASS** | 442 passed / 0 failed / 0 skipped (includes 27-06's CompositeStateAxisSerializationTests +14) | 2s |
| 7 | Every `demo/**/*.Tests.csproj` | `for p in $(find demo -name '*.Tests.csproj'); do dotnet test "$p"; done` | **PASS** | 5 projects: RetroBoard 33 · Tasks 28 · ContactManager 39 · HelpDesk 61 · ExpenseTracker 30 = **191 total, 0 failed** | 12s |
| 8 | Markdown companion compile | `dotnet build viewmodel-shell-dotnet/Markdown --nologo -v minimal` | **PASS** | `AshleyShrok.ViewModelShell.Markdown.dll` built — 0 warnings / 0 errors under the current core (proves MINOR-bump binary compat) | <1s |

**Overall:** 8/8 GREEN — no pre-existing red, no Phase-27-caused red. Wall-clock total ~45s across all gates (executed serially; several ran in parallel in the initial vitest+guards batch, so wall-clock elapsed <45s).

## Gate-1 stdout tail (vitest — the biggest suite)

```
 Test Files  79 passed (79)
      Tests  1315 passed | 1 skipped (1316)
   Start at  22:21:43
   Duration  2.83s (transform 2.41s, setup 0ms, collect 6.50s, tests 5.13s, environment 25.29s, prepare 4.61s)
```

## Gate-5 stdout tail (parity — the widest cross-backend check)

```
  dotnet-reorder: 14 steps captured
  bun-reorder: 14 steps captured
  ✓ all backends agree

Skill parity:
  ✓ skill source files byte-identical (22086B)
  ✓ skill HTTP twins byte-identical (22267B) across 2 backends

Shutting down backends...

✓ Parity tests passed
```

## Gate-6 stdout tail (framework .NET Tests)

```
Passed!  - Failed:     0, Passed:   442, Skipped:     0, Total:   442, Duration: 154 ms - Tests.dll (net9.0)
```

## Gate-7 tally (demo Tests.csproj loop)

- `demo/RetroBoard/AspNetCore.Tests` → Passed! 33/33 (48ms)
- `demo/Tasks/AspNetCore.Tests` → Passed! 28/28 (48ms)
- `demo/ContactManager/AspNetCore.Tests` → Passed! 39/39 (50ms)
- `demo/HelpDesk/AspNetCore.Tests` → Passed! 61/61 (123ms)
- `demo/ExpenseTracker/AspNetCore.Tests` → Passed! 30/30 (61ms)
- **Total: 191/191 across 5 projects, 0 failed.**

## Gate-8 stdout tail (Markdown companion compile)

```
  AshleyShrok.ViewModelShell -> .../bin/Debug/net8.0/AshleyShrok.ViewModelShell.dll
  AshleyShrok.ViewModelShell.Markdown -> .../Markdown/bin/Debug/net8.0/AshleyShrok.ViewModelShell.Markdown.dll

Build succeeded.
    0 Warning(s)
    0 Error(s)
```

## Observed informational warnings (NOT failures)

Surfaced for completeness — none affect any test outcome or block publish; all are pre-existing informational hints:

- `xUnit2013` in `viewmodel-shell-dotnet/Tests/LookupSerializationTests.cs:200` — assertion-style hint (prefer `Assert.Single` over `Assert.Equal`).
- `xUnit2013` × 3 in `demo/RetroBoard/AspNetCore.Tests/RetroBoardControllerTests.cs:258, 259, 305` — same hint (prefer `Assert.Single` / `Assert.Empty`).
- `CS0028` in `demo/ExpenseTracker/AspNetCore.Tests/ExpensesControllerTests.cs:67` — an unrelated `Main(PageNode)` signature that the C# compiler notes cannot serve as an entry point (harmless in a test project).
- jsdom `Not implemented: navigation` stderr in `test/browser-saveFile.test.ts` — expected; the test intentionally clicks a transient `<a download>` anchor, which jsdom logs but does not fail on. Test itself passes (2/2).
- `vms-tui: storage write failed (local "k"): ENOTDIR` stderr in tui-lifecycle test — intentional negative-path assertion; test passes.

## Decisions Made

- **No deviations from the plan's gate list, no gate re-ordering, no waivers invoked.** The plan spec was executed verbatim.
- **Ashley sign-off obtained via SendMessage (`signed-off: ok`)** — the blocking human-verify checkpoint served its purpose (no silent auto-approval; a human explicitly ratified the overall verdict before SUMMARY commit).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The gate ran clean end-to-end. Every prior baseline held.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 27-10 (docs)** is UNBLOCKED. It may proceed to finalize CHANGELOG entries (Added: 6 new `state?` fields on UserRow/Message/DetailRow/TimelineEntry/SettingRow/Chip; Changed: replaced `--active` CSS rules on ListItem + ListRow; Note: net-new `--active` rule on TableRow) and author MIGRATION.md with the ListItem + ListRow before/after visual reference material (screenshots sourceable from the 27-08 tailnet verification page).
- **Plan 27-11 (release)** is UNBLOCKED conditional on 27-10 completion. Release wave targets aligned MINOR bump: `viewmodel-shell/package.json` 8.0.3 → 8.1.0 + `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` 8.0.0 → 8.1.0. MINOR bump = no companion rebuild storm required (gate 8 above proves Markdown still compiles); standard release ritual applies (operator-gated publish, tag `v8.1.0`, advance `main`, registry-verify both, `#vms-changelog` announce, post-release DM to Angel).
- **No blockers.** The tree is publish-safe as of this SUMMARY.

## Self-Check: PASSED

- SUMMARY.md exists at `.planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-09-SUMMARY.md` (this file).
- No task commits claimed (verification-only plan; the sole commit is this SUMMARY's metadata commit).
- All 8 gate results recorded with counts + timing.
- Ashley sign-off recorded in Decisions.

---
*Phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a*
*Completed: 2026-07-31*
