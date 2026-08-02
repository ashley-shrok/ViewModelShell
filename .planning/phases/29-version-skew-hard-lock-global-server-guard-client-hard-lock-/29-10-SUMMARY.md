---
phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
plan: 10
subsystem: testing
tags: [release-gate, ci, green-tree, halt-on-failure, no-demo-style, d-12, d-15]

# Dependency graph
requires:
  - phase: 29-05
    provides: .NET ShellVersionGuardFilter unit tests + AddVersionFilters self-registration + dedup regression
  - phase: 29-07
    provides: parity GET-branch header hoist + helpdesk.json GET-stale fixture steps
  - phase: 29-08
    provides: agent-skill.md v9.0.0 rewording + AgentSkill.md byte-copy
  - phase: 29-09
    provides: /home/thenasty/ViewModelShell/demo/VersionSkewVerification-bun/ tailnet verification harness
provides:
  - FAILURE verdict — Phase 29 is NOT green-tree; Plans 29-11 + 29-12 are BLOCKED
  - Concrete evidence: check:no-demo-style gate fails on demo/VersionSkewVerification-bun/index.html
affects: [29-11, 29-12, phase-29-release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Halt-on-failure discipline — the gate's own rule: pre-existing failures are NOT waivable per AGENTS.md working agreement"

key-files:
  created:
    - .planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-10-SUMMARY.md
  modified: []

key-decisions:
  - "HALTED on first red gate per plan directive — did NOT run subsequent gates because the plan's `&&`-chain discipline halts on the first failure"
  - "Did NOT auto-fix the offending <style> block — the fix is a design decision (either the harness earns a sanctioned exception to D-12/D-15 or the chrome moves to inline style= attributes like NavVerification-bun / LookupVerification-bun); Plan 29-10's scope is gate execution, NOT fixing pre-existing violations"

patterns-established:
  - "Discovery-not-enumeration gate finds new pre-existing violations that plan-scope-limited work never introduces — this SUMMARY documents exactly that class of catch"

requirements-completed: []  # SKEW-09 NOT completed — verdict is FAILURE

# Metrics
duration: 1min
completed: 2026-08-02
---

# Phase 29 Plan 10: Full green-tree gate — **FAILURE**

**HALT: `npm run check:no-demo-style` fails on `demo/VersionSkewVerification-bun/index.html` (a Plan 29-09 artifact carrying a `<style>` block). Phase 29 is NOT green-tree; Plans 29-11 (docs staging) and 29-12 (release) remain BLOCKED per AGENTS.md 🚨 NEVER PUBLISH OR PUSH ANYTHING BROKEN rule.**

## Performance

- **Duration:** ~1 min (halted on first red gate — 4 of 9 TS-side gates completed)
- **Started:** 2026-08-02T22:29:15Z
- **Halted:** 2026-08-02T22:30:12Z
- **Tasks:** 0/3 completed (Task 1 halted mid-batch; Tasks 2 + 3 not run per halt discipline; this SUMMARY is the FAILURE artifact the plan explicitly mandates in place of a GREEN one)
- **Files modified:** 1 (this SUMMARY)

## Verdict

**FAILURE — check:no-demo-style gate.**

Plans 29-11 + 29-12 are BLOCKED. Per AGENTS.md working agreement: *"It was already failing on main / it's unrelated to my change / it's just a demo test are NOT exceptions — a red suite is a red suite, and shipping on top of it normalizes breakage and buries your own regressions in the noise. If you discover a pre-existing failure mid-release: STOP, surface it to the operator, and fix it (or get an explicit waiver) before pushing/publishing."*

## Per-gate exit code table (TS-side batch A — halted mid-batch)

| Gate | Exit code | Last lines of output |
|------|-----------|-----------------------|
| `cd viewmodel-shell && npm run build` | **0** | `> tsc -b tsconfig.tui.json` (clean; no diagnostics) |
| `npm run check:test-types` | **0** | `> tsc -p tsconfig.test.json --noEmit` (clean; no diagnostics) |
| `npm run check:core-globals` | **0** | `✓ AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals.` |
| `npm run check:aa-contrast` | **0** | `✓ D-07: all 13 pairs meet WCAG-AA on the shipped default + all 12 themes.` (default + 12 themes each 13/13 pairs) |
| **`npm run check:no-demo-style`** | **1** ✗ | `✗ D-12/D-15: 1 zero-<style> / .vms-*-only violation(s):`<br>`  demo/VersionSkewVerification-bun/index.html: contains a <style> block — demos must be zero-<style>, chrome owned by the shipped .vms-page shell + default.css body rule (D-15)`<br>`Demos + Showcase must be zero-<style> and .vms-*-only — chrome is owned by the shipped stylesheet (the canonical few-shot surface). wwwroot/** is hard-excluded (Vite build output; .NET parity diffs wire JSON not CSS — D-24).` |
| `npm run check:demo-types` | not run | halted before reaching |
| `npm run check:theme-byte-identity` | not run | halted before reaching |
| `npm run check:theme-function` | not run | halted before reaching |
| `npx vitest run` | not run | halted before reaching |
| **Batch B (.NET + companion binary-compat + parity)** | not run | halted before Task 2 per plan discipline |

## The failure — full detail

**Gate:** `viewmodel-shell/scripts/check-no-demo-style.mjs` (the D-12/D-15 zero-`<style>` guard for hand-edited demo/ HTML).

**Offending file:** `demo/VersionSkewVerification-bun/index.html` (created in Plan 29-09, committed as `6d2712e docs(29-09): record Ashley's release-gate sign-off — verified`; the `<style>` block was introduced by the earlier Plan 29-09 harness commit but tracked by git log against that path).

**What the file contains:** a `<style>` block from line 18 to line 123 (~105 lines of CSS) declaring `.verification-header`, `.admin-panel`, `.admin-panel button`, `.admin-panel #current-build`, `.scenarios`, `.scenario`, `.scenario-header`, `.scenario-mount`, `.scenario-banner`, plus a `@media (max-width: 900px)` breakpoint on `.scenarios`. The file's own comment claims this is "Host-chrome ONLY — bare-minimum layout for the verification harness around the three shell mount points. NOT part of any VMS view tree."

**Why the guard rejects it:** the D-12/D-15 rule is that demo HTML is zero-`<style>` — chrome is owned by the shipped `.vms-page` shell + `default.css` body rule. The guard's own header (`viewmodel-shell/scripts/check-no-demo-style.mjs` lines 39–46) explicitly documents that verification harnesses (e.g. `demo/NavVerification-bun`, `demo/LookupVerification-bun`) *are* covered and are expected to use inline `style=` attributes rather than a `<style>` block: *"A few demo pages … carry out-of-tree HOST CHROME (a theme toggle) built from plain HTML with inline `style=` attributes — the sanctioned exception for harness chrome. They contain no `<style>` block, so covering them asserts the status quo rather than changing it. If such a page ever genuinely needs a `<style>` block, that is a design conversation worth having and this gate failing is the right way to start it — not a reason to re-introduce an allow-list."*

**Sister-harness verification:** `grep '<style' demo/NavVerification-bun/index.html demo/LookupVerification-bun/index.html` returns no matches. The sanctioned pattern is inline `style=` on each element.

**Discovery, not enumeration:** the guard walks `demo/` recursively (`findDemoHtml`), so a new demo added after the guard was written is covered automatically. Plan 29-09's harness landed on 2026-08-01/02 (commit `6d2712e`), got included in the walk on the next green-tree gate run (this one), and the gate correctly caught it. This is exactly the class of catch the discovery-vs-enumeration change (2026-07-17) was designed to make possible.

## Why this is NOT auto-fixable in Plan 29-10's scope

Plan 29-10's action is *gate execution*, not *design remediation*. Three orthogonal design decisions are required to fix the violation, none of which belong to a green-tree-gate plan:

1. **Convert the `<style>` block to inline `style=` attributes on each element** — matches sister harnesses' sanctioned pattern, no design decision needed, but is a mechanical demo-HTML refactor with ~10 element classes to rewrite. Belongs in a follow-up plan (or a Plan 29-09 amendment).
2. **Add a documented exception to the D-12/D-15 rule** — a design decision about whether the D-12/D-15 rule permits `<style>` blocks in verification-harness chrome. That is the "design conversation worth having" the guard header calls out; it is not the green-tree gate's job.
3. **Waive the failure** — explicit operator waiver per AGENTS.md working agreement. Requires operator input; Plan 29-10 cannot self-waive.

The plan's own scope note in `<action>` reads: *"If any command exits non-zero, HALT and report to SUMMARY as FAILURE with the failing command name + output."* — halting was the correct behavior, not fixing.

## Batch B not run

Per plan discipline (halt on first red), Batch B (`.NET tests + demo tests + Markdown compile + companion binary-compat + parity`) was NOT run. In particular:

- **`bash parity/check-companion-binary-compat.sh`** — the AGENTS.md-mandated companion binary-compat gate for core MAJOR bumps — was not exercised in this session. Once the D-12/D-15 failure is resolved, this gate MUST run before Plan 29-12's companion republish, per AGENTS.md line ~693 core-major-bump rule. Its result at that time will determine whether Plan 29-12's Markdown companion republish will ship a binary-compatible package.

## Next steps (for the operator)

Three paths, operator-choose:

1. **(Cheapest, ~10 min)** Amend `demo/VersionSkewVerification-bun/index.html` to move all styling from the `<style>` block into inline `style=` attributes on each element, matching `demo/NavVerification-bun/index.html` + `demo/LookupVerification-bun/index.html`. Re-run this plan (29-10) after the amendment; if green, proceed to 29-11/12.
2. **(Design conversation, unbounded)** Have the D-12/D-15-rule conversation the guard header explicitly invites. Outcome: either the rule is amended to permit `<style>` blocks in verification-harness chrome (guard script + AGENTS.md updated in the same change) or the rule holds (path 1).
3. **(Explicit waiver)** Operator issues an in-turn waiver for this specific failure. The plan MUST record the waiver text verbatim in a follow-up amendment to this SUMMARY, then Plans 29-11/12 may proceed. AGENTS.md pattern precedent for waivers is minimal; the operator should decide the recording shape.

Until one of the three paths executes, Plans 29-11 + 29-12 remain BLOCKED.

## Files Created/Modified
- `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-10-SUMMARY.md` — this file (FAILURE verdict + per-gate evidence)

## Decisions Made
- **HALTED on first red gate** — did not opportunistically continue to Batch B for extra evidence; the plan's `&&`-chain discipline requires halt-on-first-failure so subsequent green results don't create false confidence
- **Did NOT auto-fix** — the fix requires a design decision (D-12/D-15 rule amendment vs. mechanical refactor vs. explicit waiver) that lies outside the green-tree-gate plan's scope; per Rule 4 (architectural), this class of change requires operator input, not autonomous action

## Deviations from Plan

None. The plan explicitly instructed: *"IF ANY gate fails: HALT. Do NOT create a SUMMARY marking Phase 29 green. The failing gate's output is recorded in a FAILURE SUMMARY; the executor fixes the failure OR reports it to the operator; the plan reopens only after the failure is genuinely green."* This SUMMARY is the mandated FAILURE artifact.

## Issues Encountered
- The offending `<style>` block was introduced by Plan 29-09 (harness landed on `main` before 29-10 ran). This is the discovery-not-enumeration walk's designed-for catch: Plan 29-09 did not run this gate as part of its own acceptance (the D-12/D-15 guard was not in 29-09's task list), and no other gate would have surfaced the violation, so it landed on `main` un-flagged. Plan 29-10 caught it at the release-gate boundary, which is exactly the layer this discipline exists for.

## Next Phase Readiness

**Plans 29-11 + 29-12 are BLOCKED.** Neither can proceed until:
1. The `check:no-demo-style` gate exits 0 on a fresh run, AND
2. Batch B (including `bash parity/check-companion-binary-compat.sh`) runs and exits 0 on a fresh run, AND
3. A GREEN SUMMARY replaces this FAILURE SUMMARY (this file will be superseded when the plan re-executes green).

## Self-Check: PASSED
- SUMMARY file exists at `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-10-SUMMARY.md`.
- Verdict is unambiguous: **FAILURE**.
- Per-gate exit code table present, including the failing gate's tail output verbatim.
- Explicit statement that Plans 29-11 + 29-12 are BLOCKED.
- Companion binary-compat gate (`bash parity/check-companion-binary-compat.sh`) named in the "Batch B not run" section — the operator knows it must be run in the eventual re-execution.

---
*Phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-*
*Halted: 2026-08-02*
