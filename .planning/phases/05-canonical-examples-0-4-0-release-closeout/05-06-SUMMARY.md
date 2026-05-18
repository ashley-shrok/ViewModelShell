---
phase: 05-canonical-examples-0-4-0-release-closeout
plan: 06
subsystem: testing
tags: [release-closeout, parity, jsdom, ci-guards, static-scan, wcag-aa, byte-identity, reviewer-sign-off, 0.4.0]

# Dependency graph
requires:
  - phase: 05-canonical-examples-0-4-0-release-closeout
    plan: 01
    provides: "default.css :root dark→light re-baseline + themes/dark-purple.css byte-exact capture + check-aa-contrast.mjs (the AA proxy this gate re-confirms green) + the 11 byte-unchanged theme files"
  - phase: 05-canonical-examples-0-4-0-release-closeout
    plan: 02
    provides: "the navigable Showcase canonical set (gallery + Dashboard/Form-heavy/List-detail on the LOCKED cards/stack/split → Bootstrap Dashboard/Checkout/Album mapping) on the light default — the subject of the D-12 reviewer benchmark"
  - phase: 05-canonical-examples-0-4-0-release-closeout
    plan: 03
    provides: "the 7 de-chromed zero-<style> demo HTML scaffolds + Showcase scaffold — the no-demo-style guard's scan surface"
  - phase: 05-canonical-examples-0-4-0-release-closeout
    plan: 04
    provides: "AGENTS.md design-system docs (mirrors the Showcase; the docs side of the canonical few-shot surface)"
  - phase: 05-canonical-examples-0-4-0-release-closeout
    plan: 05
    provides: "aligned 0.4.0 npm+NuGet + consolidated CHANGELOG/MIGRATION — the release strings the .NET demo build picks up via local ProjectReference"
  - phase: 04-preset-grid-layout
    provides: "the Phase-4-widened FeatureProbe fixture — the 3-backend layout/density/card parity coverage RELEASE-02 inherits (zero new fixture)"
provides:
  - "Two static repo-scan CI guards committed + gated in parity.yml: check-no-demo-style.mjs (8 hand-edited HTML + Showcase main.ts, wwwroot HARD-EXCLUDED) + check-theme-byte-identity.mjs (11 themes byte-identical + dark-purple.css byte-exact)"
  - "Full 0.4.0 regression gate proven green: parity 7/7 byte-identical (.NET/Bun/Node), inherited jsdom 31/31 (zero new test files), all 4 static guards exit 0"
  - "Explicit, owned, dated human reviewer sign-off (reviewer: ahbarnum, 2026-05-18) for the irreducibly-subjective D-12 visual-quality benchmark vs the LOCKED Bootstrap Dashboard/Checkout/Album pages — present and explicit, NOT pretended-automated"
  - "0.4.0 milestone closed: RELEASE-02 + RELEASE-04 satisfied"
affects: [release-closeout, 0.4.0-milestone-complete, gsd-ui-checker, gsd-ui-auditor]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static repo-scan CI guard pattern (mirrors check-core-platform-globals.mjs): zero-dep standalone Node ESM, read targets, scan/compare, console + process.exit — the correct tool for static invariants (NOT jsdom), D-25"
    - "D-12 falsifiability split: mechanically-checkable structural proxies (.vms-*-only / zero-<style> / AA / byte-identity) carry the falsifiable load; the irreducibly-subjective 'looks comparable' is an explicit owned reviewer sign-off — never pretended-automated, never silently skipped"

key-files:
  created:
    - viewmodel-shell/scripts/check-no-demo-style.mjs
    - viewmodel-shell/scripts/check-theme-byte-identity.mjs
    - .planning/phases/05-canonical-examples-0-4-0-release-closeout/05-06-SUMMARY.md
  modified:
    - viewmodel-shell/package.json
    - .github/workflows/parity.yml
    - demo/ContactManager/frontend/vite.config.ts
    - demo/ExpenseTracker/frontend/vite.config.ts
    - demo/HelpDesk/frontend/vite.config.ts
    - demo/RetroBoard/frontend/vite.config.ts
    - demo/Tasks/frontend/vite.config.ts

key-decisions:
  - "wwwroot/** HARD-EXCLUDED from check-no-demo-style.mjs (FIXED plan branch (b), NOT executor improvisation): the 8 demo/**/AspNetCore/wwwroot/*.html are Vite build output (regenerated, not authoritative hand-edited source) and .NET parity diffs wire JSON not CSS (D-24) → served chrome has zero parity surface; literal 8-file allow-list, no demo/**/*.html glob; documented one-line rationale in the script header; NO wwwroot rebuild step added"
  - "D-12 visual quality made falsifiable via mechanically-checkable proxies (all green) + an explicit OWNED HUMAN reviewer sign-off — never pretended-automated (visual quality cannot be browser-unit-tested, by framework design); the sign-off is a first-class acceptance artifact, present and explicit"
  - "RELEASE-02 = pure regression-green gate, zero new parity surface (D-24): the existing 7 fixtures incl. the Phase-4-widened FeatureProbe; the re-based light default + Showcase are CSS/client-only with zero parity impact — backends.json + fixtures git-unchanged"
  - "RELEASE-04 = static CI guards for invariants + inherited jsdom for behavior (D-25): zero new jsdom behavior test added (Phase 5 adds no wire/DOM behavior, only CSS values + repo hygiene); the existing Phase 3/4 class-emission tests stay green"

patterns-established:
  - "Mechanically-falsifiable-proxy + explicit-owned-human-sign-off split for an irreducibly-subjective acceptance dimension (D-12) — the model for any future 'visually serviceable' gate in a no-browser-test framework"
  - "Closeout gate = regression-only: inherit the prior parity fixtures + jsdom tests unchanged, add only static invariant guards beside the existing ones (weaken nothing) — zero new wire/fixture/test surface"

requirements-completed: [RELEASE-02, RELEASE-04]

# Metrics
duration: ~9min
completed: 2026-05-18
---

# Phase 5 Plan 06: 0.4.0 Release Closeout — Regression Gate + Static CI Guards + Reviewer Sign-off Summary

**Closed the 0.4.0 milestone: added two static repo-scan CI guards (zero-`<style>` / `.vms-*`-only demos+Showcase, and 11-theme byte-identity + `dark-purple.css` byte-exact capture) gated in parity.yml beside core-globals/AA; proved the full regression gate green (parity 7/7 byte-identical across .NET/Bun/Node, inherited jsdom 31/31 with zero new test files, all 4 static guards exit 0); a Rule-3 fix added the missing `/themes/` Vite alias to 5 demo configs (the closeout build surfaced a real integration defect); and recorded an explicit, owned, dated human reviewer sign-off (reviewer: ahbarnum, 2026-05-18) for the irreducibly-subjective D-12 visual-quality benchmark vs the LOCKED Bootstrap Dashboard/Checkout/Album pages.**

## Performance

- **Duration:** ~9 min (across the prior-executor Tasks 1–2 run + this continuation Task 3 sign-off/finalize)
- **Started:** 2026-05-18T01:18:00Z (Task 1 work)
- **Completed:** 2026-05-18T01:40:00Z (Task 3 finalize)
- **Tasks:** 3 (Task 1 + Task 2 by the prior executor; Task 3 reviewer-sign-off + finalize by this continuation)
- **Files modified:** 7 (2 guards created, package.json + parity.yml, 5 demo vite.config.ts via the Rule-3 fix)

## Reviewer Sign-off (D-12) — first-class acceptance artifact, NOT automated

> **REVIEWER SIGN-OFF — APPROVED.** Reviewer: **ahbarnum** (the human reviewer; genuine human review, NOT pretended-automated). Date: **2026-05-18**. Benchmark performed: ran the Showcase on the new shipped **light default** and benchmarked each of the three canonical archetypes side-by-side against its **LOCKED Bootstrap example page** (D-13) —
> - **Dashboard** (`cards` preset: stat/summary cards + activity `table`, `section variant:"card"`) ↔ Bootstrap **"Dashboard"**
> - **Form-heavy** (`stack` preset: Contact / Shipping / Payment form) ↔ Bootstrap **"Checkout"**
> - **List / detail** (`split` preset: catalog list ↔ detail `section variant:"card"`) ↔ Bootstrap **"Album"**
>
> **Verdict: the canonical Showcase set is visually serviceable** — comparable-quality (not pixel-identical, comparable serviceability per D-12) against the locked Bootstrap benchmarks on the new shipped light default. **No visual issues reported.** This is the irreducibly-subjective dimension D-12 designs as an explicit, owned, dated human reviewer sign-off (visual quality cannot be browser-unit-tested — the framework's no-browser-test promise); it is present and explicit, never silently skipped, and explicitly **NOT** described as automated. D-12 satisfied as designed.

## Structural-Proxy Results — full green table (D-12 falsifiability contract, self-contained)

The D-12 falsifiability contract splits "visually serviceable benchmarked against Bootstrap" into mechanically-checkable proxies (all GREEN below, committed in Task 1/2) PLUS the explicit owned reviewer sign-off (above). This table makes D-12 demonstrably **present and explicit, not silently skipped**. All four static guards re-confirmed exit 0 in this continuation (cheap re-run, the gate already passed in Task 2 at `798232e`):

| Proxy / Gate | Mechanism | Result | exit code |
|--------------|-----------|--------|-----------|
| Cross-backend wire parity (RELEASE-02, D-24) | `cd parity && bun run run.ts` — existing 7 fixtures (contacts, expenses, feature-probe, helpdesk, reorder, retro, tasks) incl. the Phase-4-widened FeatureProbe; .NET / Bun / Node | **7/7 byte-identical green** — `✓ all backends agree`, `✓ Parity tests passed`; `backends.json` + `parity/fixtures/*` git-unchanged (zero new parity surface) | 0 |
| Inherited jsdom class-emission (RELEASE-04, D-25) | `cd viewmodel-shell && npx vitest run` — the Phase 3/4 `theme-modifiers.test.ts` layout/density/card class-emission + the other existing suites | **31/31 pass** — all existing tests green; **zero new `test/*.test.ts`** added (no new jsdom behavior test — Phase 5 adds no wire/DOM behavior) | 0 |
| Core platform-agnosticism (AGNOSTIC-03) | `npm run check:core-globals` — `viewmodel-shell/src/index.ts` references zero platform globals | **PASS** — `✓ AGNOSTIC-03: zero platform globals` | 0 |
| WCAG-AA on the new light default (D-07) | `npm run check:aa-contrast` — WCAG ratios from `default.css` `:root`: body+muted on bg/surface/surface-2 + semantic colors on light surfaces | **11/11 pairs PASS** — `✓ D-07: all 11 pairs meet WCAG-AA on the shipped default` (incl. `--vms-warning` 4.11:1, the 05-01 one-variable AA tighten) | 0 |
| Zero per-demo `<style>` / `.vms-*`-only (D-12/D-15) | `npm run check:no-demo-style` — 8 hand-edited frontend HTML files + Showcase `main.ts`; wwwroot HARD-EXCLUDED | **PASS** — `✓ D-12/D-15: 8 hand-edited frontend HTML files are zero-<style>, and Showcase main.ts is .vms-*-only … wwwroot/** hard-excluded (Vite build output, zero parity surface — D-24)` | 0 |
| 11-theme byte-identity + `dark-purple.css` byte-exact (D-03/D-02) | `npm run check:theme-byte-identity` — 11 pre-existing theme files SHA-256 byte-identical; `dark-purple.css` `:root` == prior default dark color block | **PASS** — `✓ D-03/D-02: all 11 pre-existing theme files byte-identical (SHA-256), and themes/dark-purple.css :root is a byte-exact capture of the prior default dark color block (18 declarations)` | 0 |
| All 4 static guards gated in parity.yml (D-25) | `parity.yml` includes `check:core-globals`, `check:aa-contrast`, `check:no-demo-style`, `check:theme-byte-identity` as gating steps; no existing step removed/weakened | **4 guards gated** beside core-globals/AA — added steps only (`git show 8366be2 -- .github/workflows/parity.yml` = +10 lines, additive) | n/a |
| Bootstrap benchmark mapping recorded (D-13) | Dashboard↔"Dashboard", Form-heavy↔"Checkout", List/detail↔"Album" recorded in this verification doc | **Recorded** (reviewer sign-off block above) | n/a |

**wwwroot disposition (FIXED plan branch (b), documented — not executor improvisation):** `check-no-demo-style.mjs` scans EXACTLY the 8 hand-edited source frontend HTML files (literal allow-list, no `demo/**/*.html` glob) + `demo/Showcase/frontend/src/main.ts`. `demo/**/AspNetCore/wwwroot/**` is HARD-EXCLUDED — it is Vite build output (regenerated, not authoritative hand-edited source), and .NET parity diffs wire JSON not CSS (D-24) so served chrome has zero parity surface. The script header carries the one-line rationale comment. **NO wwwroot rebuild step was added anywhere** (branch (a) explicitly rejected to keep the closeout regression-only with zero new build/parity surface).

## Accomplishments

- **Task 1 (`8366be2`):** created the two standalone-Node static repo-scan guards mirroring `check-core-platform-globals.mjs` exactly — `check-no-demo-style.mjs` (8-file literal allow-list + Showcase `main.ts`; wwwroot HARD-EXCLUDED with the documented one-line rationale header; the legitimate JS-created theme-switcher `<style>` element handled precisely so it does not false-positive) and `check-theme-byte-identity.mjs` (11 theme files SHA-256 byte-identity manifest + `dark-purple.css` `:root` byte-exact == prior default dark block, 18 declarations). Added `check:no-demo-style` + `check:theme-byte-identity` to `viewmodel-shell/package.json` scripts after `check:aa-contrast`; added the two named gating steps to `.github/workflows/parity.yml` immediately after the Plan-01 AA step — additive only, no existing step removed/weakened (D-25), no new fixture, `backends.json` unchanged, no new jsdom test, no wwwroot rebuild step.
- **Task 2 (`798232e`):** ran the concluding regression gate against the combined output of Plans 01–05. Result: parity **7/7 byte-identical green** across .NET/Bun/Node (the Phase-4-widened FeatureProbe inherited, zero new fixture, D-24); inherited jsdom **31/31 pass** with zero new test files (D-25); all **4 static guards exit 0**. A Rule-3 blocking-issue fix was required and folded into this commit (see Deviations).
- **Task 3 (this continuation — `<head>` finalize commit):** the human reviewer (ahbarnum) performed the D-12 visual benchmark on 2026-05-18 and explicitly signed off (canonical set visually serviceable vs the LOCKED Bootstrap Dashboard/Checkout/Album pages on the new light default, no issues). Recorded the explicit, owned, dated sign-off line verbatim + the full self-contained green structural-proxy table in this SUMMARY; finalized the SUMMARY; updated STATE.md/ROADMAP.md/REQUIREMENTS.md. **0.4.0 milestone closed.**

## Decisions Made

- **wwwroot HARD-EXCLUDED from the no-demo-style guard (FIXED plan branch (b), NOT improvisation):** the 8 `demo/**/AspNetCore/wwwroot/*.html` are Vite build output (regenerated, not authoritative hand-edited source); .NET parity diffs wire JSON not CSS (D-24) so served chrome has zero parity surface. The guard hard-codes a literal 8-file allow-list (no `demo/**/*.html` glob that would pull in the wwwroot mirrors) and carries the one-line rationale in its header. No wwwroot rebuild step added (branch (a) rejected — closeout stays regression-only with zero new build/parity surface).
- **D-12 visual quality = mechanically-falsifiable proxies + an explicit OWNED HUMAN sign-off, never pretended-automated:** visual quality cannot be browser-unit-tested (the framework's no-browser-test promise). The structural proxies (`.vms-*`-only / zero-`<style>` / AA / byte-identity / parity / inherited jsdom) carry the falsifiable load and are all green; the irreducibly-subjective "looks comparable to Bootstrap" is the explicit, owned, dated reviewer sign-off above — a first-class acceptance artifact, present and explicit, never silently skipped, never claimed as automated. D-12 satisfied as designed.
- **RELEASE-02 = pure regression-green gate, zero new parity surface (D-24):** the re-based light default + `dark-purple.css` are CSS-only and the Showcase is client-only (D-11) — parity diffs wire JSON, not CSS — so the existing 7 fixtures (incl. the Phase-4-widened FeatureProbe) stay byte-identical green with no new fixture and no `backends.json` change.
- **RELEASE-04 = static CI guards for invariants + inherited jsdom for behavior (D-25):** Phase 5 adds no wire/DOM behavior (only CSS values + repo hygiene), so no new jsdom behavior test was added; the existing Phase 3/4 class-emission tests stay green and the new invariants (zero-`<style>` / `.vms-*`-only, theme byte-identity) are static repo-scan CI guards — jsdom is the wrong tool for static invariants.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added the missing `/themes/` Vite alias to 5 demo `vite.config.ts`**
- **Found during:** Task 2 (the concluding regression gate — the .NET demo build, which runs `vite build` to regenerate wwwroot for the parity backends)
- **Issue:** Plan 03's de-chrome added `@ashley-shrok/viewmodel-shell/themes/<x>.css` imports to the Tasks/ContactManager/ExpenseTracker/RetroBoard/HelpDesk frontend entrypoints, but their `vite.config.ts` lacked a `/themes/` resolve alias (only the Showcase config, from Plan 02, had it). Without the alias, `vite build` (invoked by each demo `.csproj` post-build target → regenerates wwwroot) fails to resolve the theme subpath, breaking the .NET demo build (the parity backends). The closeout regression gate surfaced this real integration defect — a genuine blocking issue preventing Task 2 completion.
- **Fix:** Added the parameterized `/themes/` resolve alias (byte-identical to the working Showcase config pattern, `?query` preserved) immediately after the existing `/styles.css` alias in all 5 demo `vite.config.ts`. Build-config fix only — no wire/model/token/CSS/test change.
- **Files modified:** `demo/ContactManager/frontend/vite.config.ts`, `demo/ExpenseTracker/frontend/vite.config.ts`, `demo/HelpDesk/frontend/vite.config.ts`, `demo/RetroBoard/frontend/vite.config.ts`, `demo/Tasks/frontend/vite.config.ts`
- **Verification:** .NET demo build succeeds; parity **7/7 byte-identical green** confirmed (zero new parity surface, D-24)
- **Committed in:** `798232e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule-3 blocking integration defect).
**Impact on plan:** The Rule-3 fix was necessary to complete Task 2's regression gate (the .NET parity backends could not build without it) and is a pure build-config correction with zero wire/model/token/CSS/test impact and zero new parity surface — no scope creep. No Rule 1/2/4 deviations. No architectural changes.

## Issues Encountered

None beyond the Rule-3 blocking fix above (which is the closeout gate working as intended — the regression run surfaced a real cross-demo integration defect that Plans 02/03 left in disjoint config files). The Task 3 checkpoint was correctly handled: the prior executor paused at the `checkpoint:human-verify` D-12 gate WITHOUT self-signing; the human reviewer (ahbarnum) then performed the genuine visual benchmark and signed off; this continuation recorded that real human sign-off verbatim (never re-described as automated). Sequential mode on the main working tree; normal commits WITH hooks (no `--no-verify`).

## User Setup Required

None — no external service configuration. (Actual `npm publish` / `dotnet nuget push` to the public registries is a maintainer release action outside this planning surface; the repo source-of-truth is at aligned `0.4.0` and the full regression gate + reviewer sign-off are green.)

## Out-of-Scope Items (NOT touched — correct per scope boundary)

- `D CLAUDE.md` (pre-existing working-tree deletion), `?? .claude/worktrees/`, `?? parity-verify-out.txt` — pre-existing working-tree noise NOT caused by this plan's tasks; NOT staged, NOT gitignored (consistent with the 05-05-SUMMARY out-of-scope disposition). `parity-verify-out.txt` is the captured Task-2 parity run log (a verification artifact, not a release surface). These are logged here for a future hygiene pass, not fixed in this closeout (scope-boundary discipline: only auto-fix issues directly caused by this plan's tasks).

## Next Phase Readiness

- **RELEASE-02 + RELEASE-04 satisfied; the 0.4.0 milestone is CLOSED.** The wire contract is regression-proven (parity 7/7 byte-identical, zero new fixture/backends.json change), behavior is inherited-green (jsdom 31/31, zero new test files), the milestone invariants are CI-enforced (4 static guards gated in parity.yml beside core-globals/AA) with a deterministic documented wwwroot disposition (hard-excluded, no improvisation), and the irreducibly-subjective visual-quality dimension has an explicit, owned, dated human reviewer sign-off benchmarked against Bootstrap (D-12 present and explicit, never automated).
- This is the final plan of Phase 05 and the final phase of the 0.4.0 milestone (Phases 3–5). No blockers. No concerns. The aligned `0.4.0` source-of-truth (Plan 05) + the canonical Showcase/demos few-shot surface (Plans 01–04) + this concluding falsifiable gate together close 0.4.0.

## Known Stubs

None — this plan adds two static Node CI scripts + `package.json` script entries + `parity.yml` gating steps + a 5-file build-config alias fix, and runs the existing regression suite. No hardcoded empty values flowing to UI, no placeholder text, no unwired data source, no new wire/model field, no new design token, no new CSS rule, no new parity fixture, no new jsdom test (per the plan's hard constraints).

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, or schema change at a trust boundary. The static guards only READ repo files (no runtime input, network, secret, or auth surface); `git diff` is Node file-scan logic + parity.yml step additions + a 5-file Vite resolve-alias config addition — no secret-shaped strings, no new dependency, no network call in the guards (matches the plan's `<threat_model>` T-05-06 `accept` disposition, hygiene-only).

## Self-Check: PASSED

- Files verified present: `viewmodel-shell/scripts/check-no-demo-style.mjs`, `viewmodel-shell/scripts/check-theme-byte-identity.mjs`, `viewmodel-shell/package.json`, `.github/workflows/parity.yml`, `demo/{ContactManager,ExpenseTracker,HelpDesk,RetroBoard,Tasks}/frontend/vite.config.ts`, `.planning/phases/05-canonical-examples-0-4-0-release-closeout/05-06-SUMMARY.md` — all FOUND.
- Commits verified present in `git log`: `8366be2` (Task 1), `798232e` (Task 2) — both FOUND.
- All 4 static guards re-confirmed exit 0 in this continuation: `check:core-globals` (AGNOSTIC-03 PASS), `check:aa-contrast` (11/11 PASS), `check:no-demo-style` (8 HTML + Showcase main.ts PASS, wwwroot hard-excluded), `check:theme-byte-identity` (11 themes byte-identical + dark-purple.css 18 declarations byte-exact PASS).
- Parity 7/7 byte-identical green + inherited jsdom 31/31 confirmed committed green in Task 2 (`798232e`) — not re-run in this continuation per plan instruction (the gate already passed and is committed); the captured parity run log (`✓ all backends agree`, `✓ Parity tests passed`) corroborates.
- D-12 reviewer sign-off recorded explicitly + owned + dated (reviewer: ahbarnum, 2026-05-18), framed as a genuine human review, never automated.

---
*Phase: 05-canonical-examples-0-4-0-release-closeout*
*Completed: 2026-05-18*
