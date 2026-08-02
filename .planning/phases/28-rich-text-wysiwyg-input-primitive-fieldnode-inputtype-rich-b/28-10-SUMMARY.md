---
phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
plan: 10
subsystem: release-gate
tags: [viewmodel-shell, green-tree-gate, phase-28, release-precondition, machine-verifiable, autonomous]

# Dependency graph
requires:
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 06
    provides: The Markdown-companion URL-scheme sanitizer that Wave 2 landed; Task 2 exercises it via `viewmodel-shell-dotnet/Markdown/Tests/Tests.csproj` (53 tests) plus the companion csproj build gate.
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 07
    provides: The FeatureProbe cross-backend byte-parity fixture that Wave 3 landed; Task 2 exercises it via `bun run parity/run.ts` — the last cross-backend byte-check before release.
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 09
    provides: Ashley's release-gate sign-off (commit 3de7f2e, Wave 7). HEAD at gate-run time was exactly this commit, so the gate ran against the sign-off-blessed tree.

provides:
  - Machine-verifiable evidence that HEAD (3de7f2e) passes the FULL green-tree gate defined in AGENTS.md 🚨 NEVER PUBLISH OR PUSH ANYTHING BROKEN — the exact CI set, run locally, with per-command exit codes captured. Phase 28's Wave 1-7 work does NOT regress any pre-existing suite. Ready for Plan 28-11 (v8.2.0 aligned npm + NuGet release ritual) to proceed under the AGENTS.md release-gated publish rule.

affects: [28-11 (v8.2.0 release ritual — UNBLOCKED; the release plan may now bump version files, tag, and publish under the operator's own auth precheck), 28-12 (release verification demo — depends on release ritual completing)]

# Tech tracking
tech-stack:
  added: []  # Verify-only plan — no code changes; the gate exists to prove the tree ships green.
  patterns:
    - "Autonomous machine-verifiable release-gate plan (banked 2026-07-31 Ashley directive — no theatrical human-verify checkpoint on gate outcomes): exit codes ARE the confirmation. Green → proceed; red → HALT and report to operator. This plan is the load-bearing precondition for every future v-line release ritual; the shape here is the template."

key-files:
  created:
    - path: ".planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-10-SUMMARY.md"
      role: "Per-gate exit-code + tail-output evidence + final GREEN verdict."
      lines: ~140
  modified: []  # No code changes — verify-only.

decisions:
  - "Ran the gate against HEAD=3de7f2e (Wave 7 sign-off commit) — did not create branches, did not amend prior commits, did not touch versioned files. The gate proves Wave 1-7 ships green as-is."
  - "Executed the EXACT command set from AGENTS.md 🚨 rule + plan spec, no shortcuts — including check:theme-byte-identity + check:theme-function (theme defense-in-depth gates the plan explicitly asks for)."
  - "Verified `viewmodel-shell-dotnet/Markdown/Tests/Tests.csproj` runs green alongside every `demo/**/*.Tests.csproj` — the Markdown-companion test project is easy to forget (mirroring the 3.0.0-3.3.0 framework-Tests uncompilable stretch), so the plan spec's explicit inclusion is honored."

metrics:
  duration: ~4 minutes
  completed: 2026-08-02
---

# Phase 28 Plan 10: Full green-tree gate before release Summary

Executed the AGENTS.md 🚨 NEVER PUBLISH OR PUSH ANYTHING BROKEN gate — the exact machine-verifiable command set CI runs — against HEAD=`3de7f2e` (Wave 7 release-gate sign-off commit). Every gate exited 0. Phase 28 is release-ready; Plan 28-11 (v8.2.0 aligned npm + NuGet publish ritual) is unblocked.

## Gate results — Task 1 (TS-side, run from `viewmodel-shell/`)

| # | Command | Exit | Summary |
|---|---------|------|---------|
| 1 | `npm run build` | 0 | `tsc -b tsconfig.tui.json` — clean. |
| 2 | `npm run check:test-types` | 0 | `tsc -p tsconfig.test.json --noEmit` — clean (CI-only-catches per banked lesson; ran green here so no test file has drifted out of the test tsconfig's coverage). |
| 3 | `npm run check:core-globals` | 0 | `✓ AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals.` |
| 4 | `npm run check:aa-contrast` | 0 | `✓ D-07: all 13 pairs meet WCAG-AA on the shipped default + all 12 themes.` |
| 5 | `npm run check:no-demo-style` | 0 | `✓ D-12/D-15: 22 hand-edited frontend HTML file(s) are zero-<style> … Showcase main.ts is .vms-*-only.` |
| 6 | `npm run check:demo-types` | 0 | `✓ check:demo-types: 24 demo project(s) type-check clean (discovered, not enumerated).` |
| 7 | `npm run check:theme-byte-identity` | 0 | `✓ D-03/D-26: all 11 theme files match their recorded baseline (SHA-256).` |
| 8 | `npm run check:theme-function` | 0 | `✓ D-26: all 12 theme files function as their name claims (scheme + bg correct merged over shipped default).` |
| 9 | `npx vitest run` | 0 | `Test Files 82 passed (82) / Tests 1348 passed | 1 skipped (1349)` — Duration 3.04s. |

## Gate results — Task 2 (.NET + parity, repo root, `PATH="$HOME/.dotnet:$PATH"` exported)

| # | Command | Exit | Summary |
|---|---------|------|---------|
| 10 | `dotnet test viewmodel-shell-dotnet/Tests` (the framework's OWN test project — historically forgotten; 3.0.0-3.3.0 uncompilable stretch is why it's now in the gate) | 0 | `Passed! - Failed: 0, Passed: 451, Skipped: 0, Total: 451, Duration: 162 ms`. One xUnit2013 style warning on `LookupSerializationTests.cs:200` — non-fatal, pre-existing, not Phase-28-introduced. |
| 11 | `dotnet test demo/ContactManager/AspNetCore.Tests/ContactManager.Tests.csproj` | 0 | `Passed! - Failed: 0, Passed: 39, Skipped: 0, Total: 39`. |
| 12 | `dotnet test demo/Tasks/AspNetCore.Tests/AspNetCore.Tests.csproj` | 0 | `Passed! - Failed: 0, Passed: 28, Skipped: 0, Total: 28`. |
| 13 | `dotnet test demo/HelpDesk/AspNetCore.Tests/HelpDesk.Tests.csproj` | 0 | `Passed! - Failed: 0, Passed: 61, Skipped: 0, Total: 61`. |
| 14 | `dotnet test demo/ExpenseTracker/AspNetCore.Tests/AspNetCore.Tests.csproj` | 0 | `Passed! - Failed: 0, Passed: 30, Skipped: 0, Total: 30`. |
| 15 | `dotnet test demo/RetroBoard/AspNetCore.Tests/RetroBoard.Tests.csproj` | 0 | `Passed! - Failed: 0, Passed: 33, Skipped: 0, Total: 33`. |
| 16 | `dotnet test viewmodel-shell-dotnet/Markdown/Tests/Tests.csproj` (includes Plan 28-06 URL-scheme sanitizer tests) | 0 | `Passed! - Failed: 0, Passed: 53, Skipped: 0, Total: 53`. |
| 17 | `dotnet build viewmodel-shell-dotnet/Markdown/AshleyShrok.ViewModelShell.Markdown.csproj` | 0 | `Build succeeded. 0 Warning(s) 0 Error(s)`. |
| 18 | `bun run parity/run.ts` | 0 | `✓ Parity tests passed` — all backends agree on every fixture; skill source files byte-identical (26622B); skill HTTP twins byte-identical (26777B) across 2 backends. Includes the Plan 28-07 FeatureProbe fixture. |

**Aggregate .NET test count:** 451 (framework) + 39 + 28 + 61 + 30 + 33 (demos) + 53 (Markdown companion) = **695 .NET tests, all passing**.

**Aggregate TS test count:** 1348 passed + 1 intentionally skipped across 82 test files.

## Deviations from Plan

None. The plan is verify-only; no code changes were required, and none were made. Every gate command in Tasks 1 and 2 was run exactly as specified; every gate exited 0 on the first attempt. No pre-existing failure surfaced, so the AGENTS.md working-agreement "pre-existing failure is NOT an exception" clause was not triggered.

## Verdict

**GREEN.** HEAD=`3de7f2e` passes the full AGENTS.md 🚨 NEVER PUBLISH OR PUSH ANYTHING BROKEN gate. Phase 28 Wave 1-7 does not regress any pre-existing suite. Plan 28-11 (v8.2.0 aligned npm + NuGet release ritual) is unblocked; the operator may proceed under the AGENTS.md release-gated publish rule (auth precheck → bump version files → publish npm + NuGet in the same session → tag → advance `main`).

## Self-Check: PASSED
