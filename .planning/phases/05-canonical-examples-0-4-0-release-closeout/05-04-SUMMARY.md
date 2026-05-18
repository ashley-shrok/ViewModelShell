---
phase: 05-canonical-examples-0-4-0-release-closeout
plan: 04
subsystem: docs
tags: [agents-md, design-system, docs, few-shot, accuracy-pass, examples-03]

# Dependency graph
requires:
  - phase: 05-canonical-examples-0-4-0-release-closeout
    plan: 02
    provides: "Live Showcase navigable canonical set (Dashboard=cards / Form-heavy=stack / List-detail=split, D-10/D-13) — the single-source-of-truth worked example the docs point at"
  - phase: 05-canonical-examples-0-4-0-release-closeout
    plan: 03
    provides: "7 de-chromed demos pinning distinct shipped themes via TS entrypoints; RetroBoard src/app-tokens.css --vms-page-max retune — the corrected reference points the accuracy pass cites"
  - phase: 05-canonical-examples-0-4-0-release-closeout
    plan: 01
    provides: "default.css :root re-based to light-purple value set; themes/dark-purple.css byte-exact prior dark default — the shipped-default + prior-default-restore facts the section states"
provides:
  - "AGENTS.md ## Design system section: serviceable-by-default + --vms-* override seam + when-to-use guide + LOCKED preset->archetype->Bootstrap mapping pointing at the live Showcase (D-20/D-23, EXAMPLES-03)"
  - "Bounded accuracy-only pass: the now-false 'app owns the CSS / Reference dark-theme stylesheets' footer + the is-loading-dim-implying onLoading example corrected; all unrelated content byte-unchanged (D-21)"
  - "Confirmation: the major.minor-alignment rule text (AGENTS.md line 13) is byte-identical to its pre-phase state — UNTOUCHED by this plan (Plan 05-05 owns version numbers)"
affects: [05-05, 05-06, agents-md, release-closeout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Docs mirror the live Showcase as single source of truth (D-23): AGENTS.md states the LOCKED mapping and points at demo/Showcase/frontend/src/main.ts + demo/* worked examples rather than inventing separate doc snippets — docs and Showcase cannot drift"
    - "Bounded accuracy-only doc pass: change ONLY the statements the design-system work invalidated; non-styling prose byte-unchanged (carries the Phase 1-4 'don't improve adjacent surfaces' discipline)"

key-files:
  created:
    - .planning/phases/05-canonical-examples-0-4-0-release-closeout/05-04-SUMMARY.md
  modified:
    - AGENTS.md

key-decisions:
  - "Line-158 footer correction (Task 2 Part A) was applied in the Task 1 commit because the new ## Design system section's insertion point shares an exact edit boundary with that sentence — the two are one atomic textual unit (the corrected footer is the lead-in to the new section). Recorded as a deliberate commit-grouping choice, not a deviation: every Task 2 acceptance criterion is still satisfied and the full-plan diff is exactly the new section + the two false-statement corrections."
  - "onLoading example rewritten to a no-op app-level-hook comment (no class toggle) rather than deleted: per the plan's <interfaces> note the doc must not imply a shipped is-loading dim affordance (dropped D-15), but the onLoading callback itself is still valid framework API — keeping a (now affordance-neutral) example preserves accurate API documentation while removing the false visual implication. Minimal one-line surgical change."
  - "Demo apps table / Testing / Dispatch-guard bullet left byte-unchanged: none of them claim per-demo hand-rolled page CSS (they describe functional demonstrations + test commands + the still-accurate 'onLoading fires around every dispatch' JS fact). D-21 bounded discipline — corrected ONLY genuinely now-false statements."

requirements-completed: [EXAMPLES-03]

# Metrics
duration: ~2min
completed: 2026-05-18
---

# Phase 5 Plan 04: AGENTS.md Design-System Docs + Bounded Accuracy Pass Summary

**Added one tight ~52-line `## Design system` section to AGENTS.md (serviceable-by-default import + the `--vms-*` override seam + a when-to-use guide for stack/split/cards/density/card + the LOCKED preset→archetype→Bootstrap mapping pointing at the live Showcase as single source of truth), and performed a bounded accuracy-only pass correcting exactly the two now-false design-system statements — with the major.minor-alignment rule text verified byte-unchanged.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-18T05:05:15Z
- **Completed:** 2026-05-18T05:07:23Z
- **Tasks:** 2
- **Files modified:** 1 (AGENTS.md); +1 doc created (this SUMMARY)

## Design system section outline (Task 1, D-20/D-23)

Placed immediately after §"CSS classes emitted by BrowserAdapter" and before §"Non-obvious framework behaviors" — adjacent to the class table it complements, matching the doc's terse markdown voice. 52 lines (well under the ~70-line D-20 "tight, not sprawling" cap). Four parts, exactly the contract:

1. **Serviceable by default** — the real-app two-line import (`styles.css` + one optional theme), all **12** theme names listed **including `dark-purple`**, the shipped **default = `light-purple` value set**, and the one-import prior-dark-default restore (`themes/dark-purple.css`, byte-for-byte). Points at `demo/ContactManager/frontend/src/main.ts` (single static theme import) and `demo/HelpDesk/frontend/src/agent.ts` vs `requester.ts` (multi-role distinct themes via the seam) as worked examples.
2. **The `--vms-*` override seam** — the ONLY sanctioned per-app deviation: a tiny per-app `:root{}` stylesheet (`--vms-page-max` / `--vms-font-body|head|mono` / any `--vms-*` color var), imported **after** the theme, **never** an HTML `<style>`; "override the token, don't hand-roll"; additive only (never remove/rename a var). Live example cited: **`demo/RetroBoard/frontend/src/app-tokens.css`** (the actual `--vms-page-max` retune path from the Plan 03 SUMMARY).
3. **When to use which layout preset / density / card** — the agent-decision guide: `stack` (default, byte-identical) / `split` (two-col collapsing, zero app breakpoints) / `cards` (auto-fit from `--vms-card-min`, default 16rem) / `density:"compact"` (global rhythm tighten, no app CSS) / `section variant:"card"` (grouped surface). Framed as "decide from the tree, not the browser."
4. **The canonical worked example (single source of truth, D-23)** — a table stating the LOCKED mapping **verbatim**: Dashboard=`cards`→Bootstrap "Dashboard"; Form-heavy=`stack`→Bootstrap "Checkout" (the **actual** Plan 02 SUMMARY choice — `stack`, not split-aside); List/detail=`split`→Bootstrap "Album". Points at the live `demo/Showcase/frontend/src/main.ts` and explicitly states docs + Showcase reinforce each other and cannot drift.

## Itemized accuracy fixes made (Task 2, D-21/D-22)

| # | Now-false statement (pre-plan) | Correction | Where |
|---|--------------------------------|------------|-------|
| A | `The framework emits class names; the app owns the CSS. Reference dark-theme stylesheets: \`demo/Tasks/frontend/index.html\` and \`demo/HelpDesk/frontend/requester.html\`.` (footer of §"CSS classes emitted by BrowserAdapter", was line ~158) | Replaced with: `The framework emits class names; the shipped viewmodel-shell/styles/default.css styles them. Apps import styles.css (+ optionally one theme) and author zero page CSS — see Design system below…` (those demos now have zero `<style>` and the default is light; the dark-theme-stylesheet line was false) | §"CSS classes emitted by BrowserAdapter" footer |
| B | `onLoading: (loading) => document.body.classList.toggle("is-loading", loading),` (implied a shipped `is-loading` dim affordance) | Replaced with `onLoading: (loading) => { /* app-level hook — e.g. toggle a spinner. No shipped dim affordance. */ },` — valid framework API preserved, false visual implication removed (the dim CSS was dropped, D-15) | §"Patterns" → "Frontend wiring" |

**Recurring "app owns the CSS" framing:** after fix A, **0** occurrences remain anywhere in AGENTS.md (verified by regex scan). No other location mis-stated reality.

**Left byte-unchanged (D-21 bounded discipline — verified not now-false):** the §"Demo apps" table (describes functional demonstrations, no CSS claim), §"Testing" (vitest/dotnet commands + patterns), the §"Non-obvious framework behaviors" "Dispatch guard" bullet ("`onLoading` fires around every dispatch" — still true: the JS callback fires; only the CSS dim was dropped), and all controller/state-record/action-payload/redirect/polling/MSBuild/backend content. The full-plan diff vs the pre-plan baseline is exactly: +52-line new section, the 2 corrected lines, and the 2 removed false lines — nothing else.

## major.minor-alignment rule text — BYTE-UNCHANGED confirmation (Task 2 Part C, CRITICAL)

**Confirmed byte-identical to its pre-phase state. UNTOUCHED by this plan.**

- Pre-phase baseline (`git show HEAD~7:AGENTS.md`, line 13):
  `The two packages share major.minor — bumping a \`ViewNode\` type or wire-format change bumps both sides. Source for both lives in this repo; demos here consume them via local \`ProjectReference\`/Vite alias to keep the dev loop tight.`
- Post-plan AGENTS.md line 13: **string-identical** (verified programmatically — `JSON.stringify(lines[12])` equality + regex `ruleIntact: true`).
- No version string or rule wording was changed by Plan 05-04. Per the plan's `<interfaces>` and D-21, Plan 05-05 owns version-NUMBER references; this plan touched neither the rule text nor any version number. This confirmation is the cross-check input for research item 3 (Plan 05-05 owns the full version-string enumeration).

## Task Commits

Each atomic unit committed (normal commits, git hooks enabled — no `--no-verify`):

1. **Task 1: focused `## Design system` section (D-20/D-23)** — `8a18029` (feat) — also carried the line-158 footer correction (Task 2 Part A), because the new section's insertion point and that sentence are one atomic textual unit (the corrected footer is the section's lead-in). 1 file changed, 52 insertions, 1 deletion.
2. **Task 2: bounded accuracy pass — `onLoading` is-loading-dim implication corrected; rule text verified byte-unchanged (D-21/D-22)** — `af9ff2c` (fix). 1 file changed, 1 insertion, 1 deletion.

**Plan metadata:** _(final docs commit — SUMMARY/STATE/ROADMAP/REQUIREMENTS)_

## Files Created/Modified

- `AGENTS.md` — added the `## Design system` section (after the CSS-class table); corrected the now-false footer sentence + the `onLoading` is-loading-dim implication; major.minor rule text untouched
- `.planning/phases/05-canonical-examples-0-4-0-release-closeout/05-04-SUMMARY.md` — this file

## Decisions Made

- **Task 2 Part A folded into the Task 1 commit** — the new section's insertion point shares an exact edit boundary with the stale footer sentence (the corrected footer is the section's lead-in line). Splitting them would require an artificial intermediate state. Recorded as a deliberate commit-grouping choice; all Task 2 acceptance criteria remain satisfied and verified.
- **`onLoading` example made affordance-neutral, not deleted** — keeps accurate framework-API documentation (the `onLoading` callback is real) while removing the false shipped-dim implication (D-15). Minimal one-line surgical change.
- **Demo apps table / Testing / Dispatch-guard bullet left byte-unchanged** — none claimed per-demo hand-rolled page CSS; D-21 bounded discipline corrected ONLY genuinely now-false statements.

## Deviations from Plan

None — plan executed exactly as written. The Task 2 Part A correction landing in the Task 1 commit is a commit-grouping choice explicitly anticipated by the plan (Task 1's `<action>` places the section at the exact boundary of the footer sentence Task 2(A) targets; the plan's Task 2 verify and acceptance criteria are written to be satisfied regardless of which commit carries the footer fix). Recorded above as a decision, not a deviation.

## Known Stubs

None — the Design system section documents only shipped, live capabilities (verified against the built Showcase `main.ts` and the de-chromed demos from Plans 02/03). No placeholder text, no "coming soon", no TODO/FIXME, no invented capability. The preset→archetype mapping is the LOCKED D-10/D-13 mapping that the live Showcase actually implements (cross-checked against `05-02-SUMMARY.md`'s "Locked-mapping confirmation" table).

## Threat Flags

None — this plan edits documentation prose in AGENTS.md only. No code, config, runtime surface, endpoint, auth path, file access, or schema; no secret-shaped strings introduced (the diff is prose + import-example snippets). Matches the plan's `<threat_model>` T-05-04 `accept` disposition exactly.

## Verification

- **Task 1 automated (plan-supplied):** `OK len=52` — `## Design system` section present; contains `dark-purple`, `--vms-page-max`, `stack`, `split`, `cards`, `variant…card`, `Showcase`, `Bootstrap`; 52 lines (≤70, D-20 tight).
- **Task 2 automated (plan-supplied):** `Task2 verify: OK` — stale `the app owns the CSS. Reference dark-theme stylesheets` sentence absent; major.minor rule text intact; 0 "app owns the CSS" framing occurrences; no `is-loading` dim assertion; no dark-stylesheet reference.
- **Diff scope:** full-plan diff vs pre-plan baseline = the +52-line section + 2 corrected lines + 2 removed false lines; all non-styling content (controller/payload/redirect/polling/MSBuild/testing/Demo-apps) byte-unchanged. AGENTS.md only — no README, no new standalone doc (D-22).
- **Rule-text byte-unchanged:** line 13 string-identical to `git show HEAD~7:AGENTS.md` line 13 (programmatically verified).

## Next Phase Readiness

- **05-05 (MIGRATION/CHANGELOG + version bump):** owns ALL version-NUMBER references and the version-string enumeration (research item 3). This plan's confirmation that the AGENTS.md major.minor-alignment **rule text** is byte-unchanged is the binding cross-check input — Plan 05-05 changes version numbers (npm `0.3.14`→`0.4.0`, NuGet `0.3.10`→`0.4.0`) NOT the rule wording. The Plan 05-01 `--vms-warning` forward-note remains a separate binding 05-05 input.
- **05-06 (release closeout / RELEASE-04):** AGENTS.md docs surface (EXAMPLES-03) is now satisfied; the Design system section points at the live Showcase + de-chromed demos that Plan 06's static repo-scan guards already gate (D-12/D-15). No new behavioral surface added by this docs-only plan.

## Self-Check: PASSED

- Created file exists: `.planning/phases/05-canonical-examples-0-4-0-release-closeout/05-04-SUMMARY.md` — FOUND.
- Modified file present + change applied: `AGENTS.md` — `## Design system` section present (Task 1 verify `OK len=52`); Task 2 verify `OK`.
- Commits exist: `8a18029` (Task 1, feat), `af9ff2c` (Task 2, fix) — both FOUND in `git log`.
- Constraint checks: major.minor rule text byte-unchanged (verified vs `git show HEAD~7:AGENTS.md`); AGENTS.md only (no README / no new standalone doc — D-22); full-plan diff = section + 2 accuracy fixes only (D-21).

---
*Phase: 05-canonical-examples-0-4-0-release-closeout*
*Completed: 2026-05-18*
