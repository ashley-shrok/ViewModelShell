---
phase: 05-canonical-examples-0-4-0-release-closeout
verified: 2026-05-18T02:05:00Z
status: human_needed
score: 16/16 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  note: Initial verification (no previous VERIFICATION.md)
human_verification:
  - test: "Visual-quality benchmark of the three Showcase archetypes vs the LOCKED Bootstrap pages"
    expected: "Dashboard (cards) ≈ Bootstrap 'Dashboard'; Form-heavy (stack) ≈ Bootstrap 'Checkout'; List/detail (split) ≈ Bootstrap 'Album' — comparable serviceability on the new shipped light default"
    why_human: "D-12 by framework design — visual quality cannot be browser-unit-tested (the no-browser-test promise). The structural proxies (.vms-*-only / zero-<style> / WCAG-AA / byte-identity) are all CI-green and verified; the irreducibly-subjective 'looks comparable' dimension is an explicit, owned, dated human reviewer sign-off recorded in 05-06-SUMMARY.md (reviewer: ahbarnum, 2026-05-18, APPROVED, no issues). Per the verification brief this present, explicit human sign-off IS the EXAMPLES-01 visual-acceptance evidence and must not be re-judged here — it is surfaced as a human-owned acceptance artifact, satisfied as designed."
---

# Phase 5: Canonical Examples + 0.4.0 Release Closeout Verification Report

**Phase Goal:** Showcase and every demo render on the shipped stylesheet with zero hand-rolled page chrome and a Bootstrap-benchmarked canonical reference set; AGENTS.md documents presets/density/card so an agent can use them from docs alone; and 0.4.0 ships with npm+NuGet aligned, the full cross-backend parity suite green (incl. the new layout fixture), MIGRATION/CHANGELOG written, and all tests green plus new jsdom unit tests for the new behavior.
**Verified:** 2026-05-18T02:05:00Z
**Status:** human_needed (all automated must-haves PASS; the D-12 visual sign-off is a designed human-owned acceptance artifact, present and explicit)
**Re-verification:** No — initial verification

## Goal Achievement

All must-haves were verified by **running the shipped guards and the parity suite against the actual codebase**, not by trusting SUMMARY claims. Each guard was executed; each artifact was read; the full cross-backend parity suite was run to completion (after clearing Windows process-lock noise from prior runs that is unrelated to parity correctness).

### Observable Truths

| #  | Truth (Success Criterion / merged must-have) | Status | Evidence |
|----|----------------------------------------------|--------|----------|
| 1 | **SC1 / EXAMPLES-01** — Showcase renders a canonical reference set (dashboard, form-heavy, list/detail) using only `.vms-*` nodes + the shipped stylesheet | ✓ VERIFIED | `demo/Showcase/frontend/src/main.ts`: top-level `tabs` `view:set` nav (Components/Dashboard/Form/List-detail); `dashboardView()` = `layout:"cards"` + 4 `section variant:"card"` tiles + stat-bar + 5-row table + `New report` CTA; `formView()` = `stack` Contact/Shipping/Payment forms + `Place order`; `listDetailView()` = `layout:"split"` list↔`section variant:"card"` detail + `Add to cart`, wired `list-detail:select`/`selectedItem()`. `check:no-demo-style` exit 0 (`.vms-*`-only, no `<style>`). |
| 2 | **EXAMPLES-01** — Archetype views render the fixed light-purple default; switcher scoped to gallery only | ✓ VERIFIED | `themeSwitcherSection()` returns `[]` unless `state.view === "components"` (explicit, repo-scannable, D-14); boot `state` = `mode:"light", accent:"purple"`; `themeFiles["dark-purple"] = darkPurpleCss` (real entry, no empty slot, D-06). |
| 3 | **SC1 (D-12 visual)** — Visually serviceable benchmarked against Bootstrap | ✓ VERIFIED (human sign-off present) | Structural proxies all CI-green (truths 1,2,7,8); explicit owned dated reviewer sign-off in `05-06-SUMMARY.md` (reviewer: ahbarnum, 2026-05-18, APPROVED, no issues). Surfaced as human-verification item — designed-human, not re-judged. |
| 4 | **SC2 / EXAMPLES-02** — Every demo imports the shipped stylesheet, zero hand-rolled per-demo `<style>` page chrome | ✓ VERIFIED | All 8 hand-edited HTML files (Showcase, Tasks, ContactManager, ExpenseTracker, RetroBoard, HelpDesk index/agent/requester): `<style>`=0, `<link>`=0 (direct grep). Each demo pins a distinct shipped theme via its TS entrypoint after `styles.css`. `npm run check:no-demo-style` → exit 0. |
| 5 | **EXAMPLES-02** — Distinct shipped theme per demo; HelpDesk roles distinct via seam; demoted dark-purple on one demo | ✓ VERIFIED | Tasks=dark-purple (the demoted file), ContactManager=light-blue, ExpenseTracker=light-green, RetroBoard=light-amber, HelpDesk agent=dark-blue / requester=light-teal. HelpDesk agent/requester have **0** inline `:root`. RetroBoard `app-tokens.css` = single `:root{--vms-page-max:1280px}` imported after the theme (D-17/D-19). |
| 6 | **SC3 / EXAMPLES-03** — AGENTS.md documents presets/density/card usable from docs alone | ✓ VERIFIED | `AGENTS.md` `## Design system` (line 162): serviceable-by-default import, the `--vms-*` override seam, when-to-use guide (stack/split/cards/density/card), LOCKED D-10/D-13 mapping table pointing at the live Showcase. Node table (105-106) + CSS-class table (141-142) updated. Now-false "app owns the CSS" line corrected (158). |
| 7 | **EXAMPLES-03** — major.minor rule TEXT byte-unchanged; only version numbers change | ✓ VERIFIED | `AGENTS.md` line 13 byte-identical pre-phase (`git show da5ec7d:AGENTS.md`) vs HEAD; rule text absent from the phase diff (untouched). |
| 8 | **SC4 / RELEASE-01** — npm + NuGet ship aligned at 0.4.0 | ✓ VERIFIED | `package.json` `0.4.0`; `package-lock.json` root + `packages[""]` `0.4.0` (×2); `.csproj` `<Version>0.4.0</Version>`. No missed location (sweep table in 05-05-SUMMARY). |
| 9 | **SC4 / RELEASE-03** — MIGRATION + CHANGELOG document 0.4.0 (additive/non-breaking, theme/density/card, opt-in) | ✓ VERIFIED | One consolidated `CHANGELOG ## 0.4.0` + one `MIGRATION ## Upgrading to 0.4.0`; dark→light framed as intentional NOT a wire/API break; one-line `themes/dark-purple.css` restore; `--vms-warning` AA tighten documented. WR-01 (transposed AA numbers) fixed in `b6aa781` — labels now match `bg/surface/surface-2` order. |
| 10 | **SC5 / RELEASE-02** — Full cross-backend parity suite green (incl. layout fixture), no new parity surface | ✓ VERIFIED | `cd parity && bun run run.ts` → `✓ all backends agree` + `✓ Parity tests passed` (exit 0). 7 fixtures (contacts/expenses/feature-probe/helpdesk/reorder/retro/tasks) across .NET/Bun/Node incl. Phase-4-widened FeatureProbe. `parity/backends.json` + `parity/fixtures/` git-unchanged (D-24). |
| 11 | **SC5 / RELEASE-04** — Existing unit tests stay green; layout/density/card jsdom coverage | ✓ VERIFIED | `npx vitest run` → 31/31 pass, 4 files. `theme-modifiers.test.ts` (13 tests) is the inherited Phase 3/4 layout/density/card class-emission coverage. No new test file added (`git diff da5ec7d HEAD viewmodel-shell/test/` empty; latest test commit is Phase 4). Matches D-25 (closeout = inherited-green, no new jsdom behavior test). |
| 12 | **D-01/D-02/D-03** — default.css :root re-based light; dark-purple.css byte-exact prior dark; 11 themes byte-identical | ✓ VERIFIED | `default.css` phase diff = exactly the 18-color + color-scheme `:root` swap (zero new rules/tokens/rule-body edits — pure swap verdict confirmed). `themes/dark-purple.css` `:root` byte-matches the removed prior dark block. `git diff --stat .../themes/` = only dark-purple.css added (+24); `light-purple.css` byte-unchanged (still `#c89610`). `check:theme-byte-identity` → exit 0. |
| 13 | **D-07** — New light default passes WCAG-AA, CI-enforced | ✓ VERIFIED | `npm run check:aa-contrast` → exit 0, 11/11 pairs PASS (text ≥4.5:1, semantic ≥3.0:1; `--vms-warning` 4.11:1 via the one-variable `#a37510` D-17-precedent tighten). Gated in `parity.yml`. |
| 14 | **D-25** — All 4 static guards gated in parity.yml; no existing step weakened | ✓ VERIFIED | `parity.yml` steps: `check:core-globals`, `check:aa-contrast`, `check:no-demo-style`, `check:theme-byte-identity` (lines 36/41/46/51) + `npx vitest run` (54) + `bun run run.ts` (80). Phase diff = +15 additive lines, no existing step removed/weakened. |
| 15 | **Phase intent** — No new wire/model field, no new node type | ✓ VERIFIED | `git diff da5ec7d HEAD` over `viewmodel-shell/src/**`, `viewmodel-shell-dotnet/**/*.cs`, `demo/**/ViewModels.cs`, `demo/**/server.ts` = **empty**. Only `.csproj` `<Version>` line changed on the .NET side. |
| 16 | **Phase intent** — No new design token / no new CSS rule beyond D-01 :root re-baseline + D-02 dark-purple.css | ✓ VERIFIED | `default.css` phase diff = pure `:root` value swap (no added selector/brace/rule). Only new CSS files: `themes/dark-purple.css` (sanctioned D-02 capture) + `demo/RetroBoard/frontend/src/app-tokens.css` (sanctioned single-token D-17/D-19 seam, only `--vms-page-max`). Dropped affordances logged in `deferred-items.md`, explicitly NOT built. |

**Score:** 16/16 must-haves verified (truth 3's subjective dimension surfaced as a designed human-owned acceptance artifact, present and explicit — not a gap).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `viewmodel-shell/styles/default.css` | Re-based light `:root` (light-purple set) | ✓ VERIFIED | `--vms-bg #f7f7f9`, `--vms-surface #ffffff`, `--vms-accent #5a4ad7`, `--vms-color-scheme light`; non-color tokens byte-unchanged; pure-swap diff. |
| `viewmodel-shell/styles/themes/dark-purple.css` | Byte-exact prior dark `:root` capture | ✓ VERIFIED | NEW (+24); every value matches the removed default.css dark block; structure mirrors dark-blue.css. |
| `viewmodel-shell/scripts/check-aa-contrast.mjs` | Standalone WCAG-AA CI guard | ✓ VERIFIED | 146 lines; runs, exit 0, 11/11 PASS; zero-dep Node ESM. |
| `viewmodel-shell/scripts/check-no-demo-style.mjs` | Zero-`<style>` + `.vms-*`-only repo-scan | ✓ VERIFIED | 105 lines; exit 0; wwwroot hard-excluded with documented rationale. |
| `viewmodel-shell/scripts/check-theme-byte-identity.mjs` | 11-theme byte-identity + dark-purple byte-exact | ✓ VERIFIED | 157 lines; exit 0; SHA-256 manifest + 18-declaration capture check. |
| `demo/Showcase/frontend/src/main.ts` | Navigable canonical set, switcher remapped+scoped | ✓ VERIFIED | +900 rebuild; 3 archetypes on LOCKED mapping; `view:set`/`list-detail:select` wired; switcher gated to components view. |
| `demo/Showcase/frontend/index.html` | Minimal zero-`<style>` scaffold | ✓ VERIFIED | -17; zero `<style>`, zero font `<link>`, no `#app` rule; theme seam-loaded via main.ts. |
| `demo/RetroBoard/frontend/src/app-tokens.css` | Single `:root{--vms-page-max}` seam | ✓ VERIFIED | NEW (+7); only `--vms-page-max:1280px`, imported after the pinned theme. |
| `AGENTS.md` | Design system section + bounded accuracy pass | ✓ VERIFIED | +53/-2; `## Design system` section + 2 accuracy fixes; major.minor rule text byte-unchanged. |
| `viewmodel-shell/package.json` / `package-lock.json` | npm 0.4.0 + exports + scripts | ✓ VERIFIED | version 0.4.0 (×3 incl. lockfile); `./themes/dark-purple.css` export; 4 check scripts. |
| `viewmodel-shell-dotnet/...csproj` | NuGet 0.4.0 | ✓ VERIFIED | `<Version>0.4.0</Version>`. |
| `CHANGELOG.md` / `MIGRATION.md` | Consolidated 0.4.0 entry/section | ✓ VERIFIED | `## 0.4.0` above `## 0.3.14`; `## Upgrading to 0.4.0`; dark-purple restore + AA-tighten documented; WR-01 corrected. |
| `README.md` | Accuracy fix (no false dark-purple claim) | ✓ VERIFIED | "ships a **light** default"; all 12 themes incl. dark-purple listed. |
| `.github/workflows/parity.yml` | 4 guards + vitest + parity gated | ✓ VERIFIED | +15 additive; no existing step weakened. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `parity.yml` | `check-aa-contrast.mjs` | `npm run check:aa-contrast` step | ✓ WIRED | line 41; guard runs exit 0 |
| `parity.yml` | `check-no-demo-style.mjs` / `check-theme-byte-identity.mjs` | gating steps beside core-globals | ✓ WIRED | lines 46/51; both exit 0 |
| `package.json` | `themes/dark-purple.css` | exports map entry | ✓ WIRED | `./themes/dark-purple.css` → `./styles/themes/dark-purple.css` |
| `Showcase/main.ts` | `themes/dark-purple.css` | real `themeFiles["dark-purple"]` entry | ✓ WIRED | `darkPurpleCss` import + map entry; no empty slot |
| `Showcase/main.ts` | archetype nav | `tabs` `view:set` switching `viewChildren()` | ✓ WIRED | Components/Dashboard/Form/List-detail; `view:set` + `list-detail:select` handlers |
| Tasks `main.ts` | `themes/dark-purple.css` | static import after styles.css | ✓ WIRED | line 2 after styles.css |
| HelpDesk `agent.ts`/`requester.ts` | dark-blue / light-teal themes | static theme import (seam) | ✓ WIRED | distinct themes; zero inline `:root` in HTML |
| `CHANGELOG.md` | one-line dark restore | `import themes/dark-purple.css` | ✓ WIRED | present in CHANGELOG + MIGRATION |
| `AGENTS.md` Design system | live Showcase | single-source-of-truth pointer (D-23) | ✓ WIRED | points at `demo/Showcase/frontend/src/main.ts` + demo worked examples |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Core platform-agnosticism | `node scripts/check-core-platform-globals.mjs` | exit 0, zero platform globals | ✓ PASS |
| WCAG-AA on shipped default | `node scripts/check-aa-contrast.mjs` | exit 0, 11/11 pairs PASS | ✓ PASS |
| Zero per-demo `<style>` / `.vms-*`-only | `node scripts/check-no-demo-style.mjs` | exit 0, 8 HTML + Showcase main.ts | ✓ PASS |
| 11-theme byte-identity + dark-purple byte-exact | `node scripts/check-theme-byte-identity.mjs` | exit 0, SHA-256 + 18-decl capture | ✓ PASS |
| Inherited jsdom suite | `npx vitest run` | 31/31 pass, 4 files | ✓ PASS |
| Cross-backend parity (7 fixtures, .NET/Bun/Node) | `cd parity && bun run run.ts` | `✓ all backends agree` / `✓ Parity tests passed` (exit 0) | ✓ PASS |
| npm/NuGet aligned 0.4.0 | JSON/csproj read | 0.4.0 / 0.4.0 / 0.4.0 (×3) | ✓ PASS |

> Note: the parity suite required two prior aborted runs to be cleaned (stale `ViewModelShell`/`bun`/`dotnet` processes from earlier runs held the demo DLL / SQLite DB on Windows → `MSB3027` / `EBUSY`). These are environment process-lock artifacts, NOT parity-correctness failures: after killing the stale processes and removing the locked DB files, the suite ran fully and passed (`✓ all backends agree`, exit 0). This matches the 05-06-SUMMARY claim of 7/7 byte-identical green.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXAMPLES-01 | 05-01, 05-02 | Showcase canonical set, .vms-*-only, Bootstrap-benchmarked | ✓ SATISFIED | Truths 1–3; structural proxies green + reviewer sign-off |
| EXAMPLES-02 | 05-03 | Every demo on shipped stylesheet, zero per-demo `<style>` chrome | ✓ SATISFIED | Truths 4–5; `check:no-demo-style` exit 0 |
| EXAMPLES-03 | 05-04 | AGENTS.md documents presets/density/card from docs alone | ✓ SATISFIED | Truths 6–7; Design system section + updated tables; rule text byte-unchanged |
| RELEASE-01 | 05-05 | npm + NuGet aligned at 0.4.0 | ✓ SATISFIED | Truth 8; version reads (×3) |
| RELEASE-02 | 05-06 | Full cross-backend parity green incl. layout fixture | ✓ SATISFIED | Truth 10; parity suite run to completion, passed |
| RELEASE-03 | 05-05 | MIGRATION + CHANGELOG document 0.4.0 (non-breaking, opt-in) | ✓ SATISFIED | Truth 9; consolidated entries + WR-01 fix |
| RELEASE-04 | 05-01, 05-06 | Existing tests green + layout/density/card jsdom coverage | ✓ SATISFIED | Truth 11; vitest 31/31, inherited Phase 3/4 coverage (D-25 — closeout = inherited-green) |

No orphaned requirements: REQUIREMENTS.md maps exactly EXAMPLES-01..03 + RELEASE-01..04 to Phase 5; all 7 are claimed across the 6 plans.

> Note on the goal/SC wording "**new** jsdom unit tests for the new behavior" / "incl. the **new** layout fixture": this is satisfied via inheritance, by sanctioned design. CONTEXT D-24/D-25 (locked) scope RELEASE-02/04 as a pure regression gate — the layout/density/card jsdom tests and the Phase-4-widened FeatureProbe parity fixture were authored in Phases 3/4; Phase 5 adds no wire/DOM behavior so it correctly adds none. The goal text describes the milestone-cumulative state (the layout fixture and jsdom tests DO exist and ARE green); Phase 5's contribution is proving them inherited-green plus the new static CSS/repo-hygiene invariants. Verified consistent with the locked decisions and the verification brief (D-24/D-25 explicitly: no new fixture, no new jsdom behavior test).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No blocker/warning anti-patterns. Code review (`05-REVIEW.md`) ran: 0 critical, 2 warning, 4 info. WR-01 (transposed AA numbers) fixed in `b6aa781` and re-verified corrected. WR-02 (unvalidated `ctx.value` casts in Showcase — framework-emitted values, does not misfire) + the 4 Info items are advisory/non-blocking robustness/maintainability notes, not phase-goal gaps. Showcase archetypes are wired to concrete realistic data (no stubs, no placeholder, no empty data sources). |

### Human Verification Required

#### 1. D-12 visual-quality benchmark (designed-human, present and explicit — NOT a gap)

**Test:** Run the Showcase on the new shipped light default and compare each archetype side-by-side against its LOCKED Bootstrap page.
**Expected:** Dashboard (`cards`) ≈ Bootstrap "Dashboard"; Form-heavy (`stack`) ≈ Bootstrap "Checkout"; List/detail (`split`) ≈ Bootstrap "Album" — comparable serviceability (not pixel-identical).
**Why human:** By framework design, visual quality cannot be browser-unit-tested (the no-browser-test promise). D-12 splits this into CI-checkable structural proxies (all verified green here) + an explicit, owned, dated human reviewer sign-off. That sign-off **is present and explicit** in `05-06-SUMMARY.md` (reviewer: **ahbarnum**, **2026-05-18**, **APPROVED**, "no visual issues reported", explicitly NOT pretended-automated). Per the verification brief this present human sign-off IS the EXAMPLES-01 visual-acceptance evidence and is not re-judged here — it is surfaced as the designed human-owned acceptance artifact, satisfied as designed. Status is `human_needed` solely because a human-owned acceptance artifact exists for this phase (per the status decision tree); there is no missing work and no gap.

### Gaps Summary

**No gaps.** Every automated must-have was verified by running the shipped guards and the full parity suite against the actual codebase (not by trusting SUMMARYs):

- All 4 static CI guards (`check:core-globals`, `check:aa-contrast`, `check:no-demo-style`, `check:theme-byte-identity`) exit 0 and are gated in `parity.yml`.
- The 7-fixture cross-backend parity suite ran to completion across .NET/Bun/Node and passed (`✓ all backends agree`, exit 0), with `backends.json` + `parity/fixtures/` git-unchanged (D-24 — zero new parity surface).
- `npx vitest run` → 31/31 green; no new test file added (D-25 — inherited-green, correct).
- RELEASE-01 version alignment confirmed at three source-of-truth locations (npm package.json, lockfile ×2, NuGet csproj) — all `0.4.0`.
- The Showcase canonical set, demo de-chrome, AGENTS.md docs, and CHANGELOG/MIGRATION were all read in the actual files and match the contract.
- Phase-intent guards confirmed by full git-diff: **zero wire/model source changed**, `default.css` is a pure `:root` value swap (no new rules/tokens), `light-purple.css` byte-unchanged, the only sanctioned new CSS is `dark-purple.css` (D-02) + RetroBoard's single-token `app-tokens.css` (D-17/D-19). Dropped affordances logged in `deferred-items.md`, explicitly not built (D-15/D-16).
- WR-01 (the one real code-review defect) fixed in `b6aa781` and re-verified corrected in CHANGELOG/MIGRATION.

The phase goal is achieved. The single human-verification item is the D-12 reviewer sign-off — a deliberately-human acceptance artifact that is **present, explicit, owned, and dated** in the phase record; it is surfaced (not re-judged) per the framework's no-browser-test design and the verification brief.

---

_Verified: 2026-05-18T02:05:00Z_
_Verifier: Claude (gsd-verifier)_
