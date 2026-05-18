---
phase: 05-canonical-examples-0-4-0-release-closeout
plan: 02
subsystem: ui
tags: [showcase, canonical-examples, few-shot, archetypes, layout-presets, theme-switcher, de-chrome, vite]

# Dependency graph
requires:
  - phase: 04-preset-grid-layout
    provides: "layout?: stack|split|cards closed-union + section variant:card + density on page/section — the presets the archetypes compose"
  - phase: 05-canonical-examples-0-4-0-release-closeout (Plan 01)
    provides: "default.css :root re-based to the AA-verified light-purple value set (--vms-warning #a37510); themes/dark-purple.css byte-exact prior dark default + package.json export — the switcher's new real dark-purple entry points at this"
provides:
  - "Navigable canonical reference set: top-level tabs nav (D-09) switching Components gallery + Dashboard/Form/List-detail archetypes"
  - "LOCKED archetype→preset→Bootstrap mapping applied: Dashboard=cards(+section variant:card) vs Bootstrap Dashboard, Form-heavy=stack vs Checkout, List/detail=split vs Album (D-10/D-13)"
  - "Theme switcher remapped (real dark-purple entry → darkPurpleCss, no empty slot) + light-purple boot (D-06); scoped to the gallery view only via state.view===components guard (D-14)"
  - "demo/Showcase/frontend/index.html de-chromed to the minimal zero-<style> scaffold (no reset, no body chrome, no #app max-width, no font <link>) — the canonical shape Plan 03 replicates (D-15)"
affects: [05-03, 05-04, 05-05, 05-06, showcase, demos, agents-md, release-closeout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Navigable reference set: single buildVm() with a top-level tabs nav + per-view builder functions, .vms-*-only, zero per-view <style>"
    - "Theme-switcher scope as a falsifiable static proxy: an explicit state.view===\"components\" guard gates the switcher section so D-14 is repo-scannable"
    - "Demo minimal zero-<style> scaffold: chrome owned entirely by .vms-page shell + default.css body rule + seam-loaded theme via main.ts (the shape Plan 03 mirrors)"

key-files:
  created:
    - .planning/phases/05-canonical-examples-0-4-0-release-closeout/05-02-SUMMARY.md
    - .planning/phases/05-canonical-examples-0-4-0-release-closeout/deferred-items.md
  modified:
    - demo/Showcase/frontend/src/main.ts
    - demo/Showcase/frontend/index.html

key-decisions:
  - "Form-heavy preset = stack (the UI-SPEC §Design Decisions Recorded default; safest few-shot exemplar of default vertical flow, matches Bootstrap Checkout's single-column form). split-with-aside not used."
  - "Showcase #app-max disposition = adopted the shipped 1080px .vms-page shell, NO per-app token file (the plan's expected/default outcome — a wider canonical surface is correct vs Bootstrap's full-width Dashboard/Checkout/Album pages)"
  - "Tasks 1+2 committed as one atomic commit (single inseparable holistic rebuild of main.ts — the nav-driven view branching and the D-14 switcher-scope guard are structurally interleaved); Task 3 (index.html) is the separable second atomic commit"

patterns-established:
  - "Archetype builder per view (dashboardView/formView/listDetailView/componentsView) selected by a viewChildren() switch on state.view; top-level tabs nav is always the first child of the page"
  - "D-14 switcher scope made statically falsifiable: themeSwitcherSection() returns [] unless state.view===\"components\" — no switcher control can leak onto an archetype view"

requirements-completed: [EXAMPLES-01]

# Metrics
duration: ~10min
completed: 2026-05-18
---

# Phase 5 Plan 02: Showcase Canonical Reference Set + De-Chrome Summary

**Rebuilt the Showcase into a navigable canonical few-shot surface — a top-level tabs nav switching the preserved kitchen-sink gallery + Dashboard (`cards`) / Form-heavy (`stack`) / List-detail (`split`) archetypes on the LOCKED Bootstrap-benchmarked mapping — remapped + gallery-scoped the 12-theme switcher onto the new light default, and stripped index.html to the minimal zero-`<style>` scaffold.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-18T04:50:07Z
- **Completed:** 2026-05-18T04:55:26Z
- **Tasks:** 3
- **Files modified:** 2 (main.ts, index.html); +2 docs created

## Accomplishments

- **Navigable canonical set (D-09):** `State.view` (`components|dashboard|form|list-detail`, default `components`) + a top-level `tabs` nav (action `view:set`) as the first child of the page; `handle()` `view:set` case; the entire prior kitchen-sink gallery moved verbatim into `componentsView()` (all 11 prior sections present: Text styles, Stat bar, Buttons, Copy button, Links, Tabs and progress, Form inputs, Checkbox, List with variants, Table, Modal).
- **LOCKED archetype→preset→Bootstrap mapping applied (D-10/D-13), no invention:**
  - **Dashboard** → `cards` preset section of 4 `section variant:"card"` stat tiles (Revenue/Active users/Conversion/Open issues, concrete numbers) + a summary `stat-bar` + a 5-row recent-activity `table` + primary CTA `New report`. Benchmark: Bootstrap **"Dashboard"**.
  - **Form-heavy** → `stack` default (no preset class) — Contact / Shipping address / Payment sections, each a `form` with concrete `field`s, ending in submit CTA `Place order`. Benchmark: Bootstrap **"Checkout"**.
  - **List/detail** → `split` preset section: LEFT a `list` of 6 catalog `list-item`s (each: title + meta `text` + `View details` button), RIGHT a `section variant:"card"` detail pane with `stat-bar` + blurb + `Add to cart`. Selection in `State.selectedItemId` + `list-detail:select` handler. Benchmark: Bootstrap **"Album"** (list half; detail pane our own composition).
- **Theme switcher remapped + scoped (D-06/D-14):** added `dark-purple.css?inline` import; `themeFiles["dark-purple"] = darkPurpleCss` (no empty-string slot remains); boot `state` is `mode:"light", accent:"purple"` (the new shipped light default); the switcher section lives in `themeSwitcherSection()` gated by an explicit `state.view === "components"` guard — archetype views render the fixed light default with **no** switcher control.
- **index.html de-chromed (D-15):** the entire `<style>` block (box-sizing reset, body chrome, `#app{max-width:720px}`) and **both** Google-Fonts `<link>`s deleted; doctype/`<html lang>`/meta charset+viewport/byte-unchanged `<title>` + `<div id="app"></div>` + `/src/main.ts` script retained. Zero `<style>`, zero `<link>`, no `#app` rule, no non-`--vms-*` var; theme stays seam-loaded via `main.ts`.
- **`.vms-*`-only / zero per-view `<style>`:** no raw HTML node construction, no `document.createElement` of content, no per-view `<style>`, no new wire field / node type / CSS / token (D-12 falsifiable proxies green; Plan 06's repo-scan guard will pass).

## Locked-mapping confirmation

| Archetype view | Preset (LOCKED) | Composition shipped | Bootstrap benchmark (LOCKED) |
|----------------|-----------------|---------------------|-------------------------------|
| Dashboard | `cards` (`section layout:"cards"`) | 4 `section variant:"card"` tiles + `stat-bar` + 5-row `table` + primary `New report` | **"Dashboard"** |
| Form-heavy | `stack` (default, no class) | 3 grouped `section`s (Contact/Shipping/Payment), each a `form`; submit `Place order` | **"Checkout"** |
| List/detail | `split` (`section layout:"split"`) | `list` (6 items, `View details` each) ↔ `section variant:"card"` detail (`Add to cart`) | **"Album"** |

Mapping applied exactly as locked — not discretionary. Only archetype CONTENT was discretionary.

## Form-heavy preset choice

**Chosen: `stack`** (the UI-SPEC §Design Decisions Recorded default). Rationale: the safest few-shot exemplar of the framework's default vertical flow (no layout class emitted, zero app breakpoints), and it matches Bootstrap "Checkout"'s single-column form. The `split`-with-static-aside alternative (permitted by D-10) was **not** used — `stack` is the clearer teaching signal for "a multi-section form is just sections of forms in the default flow."

## Showcase index.html de-chrome / #app-max disposition

- **`<style>` block:** fully deleted (box-sizing reset, `body{bg/color/font/font-size 14px/min-height/padding}`, `#app{width:100%;max-width:720px;margin:0 auto}`). The shipped `.vms-page` shell + `default.css` body rule own all of it.
- **Font `<link>`s:** both the `rel="preconnect"` and the `DM+Mono…DM+Serif+Display` stylesheet `<link>` deleted. The Showcase keeps **no** `--vms-font-*` token override, so per D-15/D-17 the font links are dropped.
- **#app-max disposition: adopted the shipped 1080px `.vms-page` shell, NO per-app token file** (the plan's expected/default outcome). A wider canonical surface is desirable here — the archetypes benchmark against Bootstrap's full-width Dashboard/Checkout/Album pages, so the shipped 1080px shell is the correct target, not a re-narrowed 720px. No concrete narrower-page reason arose, so the sanctioned single-token `--vms-page-max` per-app stylesheet mechanism (D-17/D-19) was **not** invoked and no token file was created.
- **Result:** the file shrank to a 12-line zero-`<style>` scaffold (Vite-emitted `index.html` 0.97 kB → 0.40 kB). This is the canonical minimal-scaffold shape Plan 03 replicates for the 7 non-Showcase demo HTML files.

## Task Commits

Each atomic unit committed (normal commits, git hooks enabled — no `--no-verify`):

1. **Tasks 1 + 2: navigable canonical set + remapped/scoped theme switcher** — `2db2f61` (feat) — single inseparable holistic rebuild of `main.ts` (the nav-driven view branching and the D-14 switcher-scope guard are structurally interleaved in one file)
2. **Task 3: de-chrome Showcase index.html to minimal zero-`<style>` scaffold** — `cbf96b8` (feat)

**Plan metadata:** _(final docs commit — SUMMARY/STATE/ROADMAP/REQUIREMENTS)_

## Files Created/Modified

- `demo/Showcase/frontend/src/main.ts` — restructured: `State.view`/`selectedItemId`, top-level `view:set` nav, `componentsView()` (gallery verbatim), `dashboardView()`/`formView()`/`listDetailView()` archetypes, `themeSwitcherSection()` gated to components, `dark-purple.css?inline` import + real `themeFiles` entry, light-purple boot, `view:set`/`list-detail:select` handlers
- `demo/Showcase/frontend/index.html` — de-chromed to the minimal zero-`<style>` scaffold (17 lines deleted)
- `.planning/phases/05-…/deferred-items.md` — created; logs the pre-existing out-of-scope `*.css?inline` tsc declaration gap
- `.planning/phases/05-…/05-02-SUMMARY.md` — this file

## Decisions Made

- **Form-heavy = `stack`** (UI-SPEC default; clearest few-shot signal; matches Bootstrap Checkout single-column) — `split`-with-aside not used.
- **#app-max = adopt shipped 1080px shell, no per-app token file** — the plan's expected outcome; a wider canonical surface is correct vs Bootstrap's full-width benchmark pages; no narrower-page reason arose.
- **Tasks 1+2 = one atomic commit** — `main.ts` is one inseparable holistic rebuild; the nav-driven `viewChildren()` branching is the exact mechanism the D-14 switcher-scope guard depends on. Splitting into two commits would require an artificial intermediate broken state. Task 3 (`index.html`) is the genuinely separable second atomic unit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed the literal `<style` substring from a source comment**
- **Found during:** Task 1 (static verification)
- **Issue:** The original `main.ts` carried the comment "the showcase swaps at runtime via a single `<style>` element." The Task-1 verify proxy (and Plan 06's repo-scan guard / D-12 falsifiability contract) is a blunt `!/<style/` static check — it fails on the literal `<style` substring **anywhere** in the source, including comments. Carrying it forward verbatim would fail the D-12 "zero per-view `<style>`" CI proxy.
- **Fix:** Reworded the comment to "via a single injected style tag" (semantics preserved, no literal `<style` substring). No behavior change.
- **Files modified:** `demo/Showcase/frontend/src/main.ts`
- **Verification:** Task-1 static check `TASK1 OK`; Plan 06's repo-scan proxy will pass.
- **Committed in:** `2db2f61` (Tasks 1+2 commit)

**2. [Rule 2 - Missing Critical] Made the D-14 switcher scope an explicit `state.view === "components"` guard**
- **Found during:** Task 2 (static verification)
- **Issue:** My first structure gated the switcher implicitly via the `viewChildren()` `switch`/`componentsView()` path. The Task-2 acceptance criterion **requires** the literal `state.view === "components"` gated condition to be present (the D-14 static proxy that the verifier / Plan 06 scan for — an implicit switch is not repo-scannable as "the switcher cannot leak onto an archetype view").
- **Fix:** Extracted `themeSwitcherSection()` that returns `[]` unless `state.view === "components"`, making the D-14 scope structurally explicit and statically falsifiable.
- **Files modified:** `demo/Showcase/frontend/src/main.ts`
- **Verification:** Task-2 static check `TASK2 OK`; archetype views provably render no switcher control.
- **Committed in:** `2db2f61` (Tasks 1+2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical) — both required to satisfy the plan's own acceptance criteria / D-12 falsifiability contract. No scope creep; both are in-file adjustments to the planned change.
**Impact on plan:** None negative. Both deviations strengthen the D-12/D-14 falsifiable proxies the plan explicitly requires.

## Issues Encountered

- **`npx tsc --noEmit` reports `TS2307` for every `*.css?inline` import (12: 11 inherited + 1 new D-06 `dark-purple`).** Confirmed **pre-existing and out of scope**: stashing the new file and re-running `tsc` on the *original* `main.ts` produced the identical class of 11 `TS2307` errors for the same `?inline` imports. This is a Vite virtual-module syntax `tsc` cannot resolve without an ambient `declare module "*.css?inline"`; Vite resolves it correctly (verified — `vite build` exit 0, all archetypes/themes bundle). The 05-02 archetype/view/nav code is **fully type-clean** (zero non-`?inline` `tsc` errors). The plan's own Task-1 verify line runs `tsc … 2>/dev/null` (output suppressed, exit not gated) because this gap is known-expected. Not fixed here per D-21 ("don't improve adjacent surfaces") and the scope-boundary rule — demo-wide TS/build hygiene is owned by Plans 03/06. Logged to `deferred-items.md` with a suggested usage-driven future fix (ambient `vite-env.d.ts`).

## User Setup Required

None - no external service configuration required (Showcase is client-only, D-11; no backend, no parity fixture added).

## Known Stubs

None — every archetype view is wired to concrete realistic data (dashboard metrics, checkout fields, a 6-item catalog with live `selectedItemId` selection). No placeholder text, no empty data sources, no `TODO`/`FIXME`. The empty-state copy (`Nothing here yet` / `No items to show…`) and the destructive `Delete forever` modal exist in the preserved gallery (the existing Showcase modal pattern, reused not re-authored); no archetype needed a plausible empty/destructive state, so the optional empty-state copy was correctly not force-fit.

## Threat Flags

None — this plan edits one client-only demo TS file + de-chromes one static HTML scaffold (the HTML change only *deletes* inline `<style>` + external font `<link>`s, reducing third-party network surface). No new endpoint, auth path, file access, or schema; no secrets introduced (the diff is demo view code + theme-map entries + an HTML deletion). Matches the plan's `<threat_model>` T-05-02 `accept` disposition exactly — no new surface beyond it.

## Next Phase Readiness

- **05-03 (de-chrome the 7 non-Showcase demo HTML files):** the Showcase `index.html` is now the **canonical minimal-scaffold reference shape** to replicate exactly (doctype + `<html lang="en">` + head[meta charset + meta viewport + `<title>`] + `<body>\n  <div id="app"></div>\n  <script type="module" src="/src/main.ts"></script>\n</body>`). File sets are disjoint (05-02 owns only the Showcase surface; 05-03 owns the other 7) — no overlap.
- **05-04 (AGENTS.md docs, D-23):** the live Showcase canonical set is now the single-source-of-truth worked example — AGENTS.md can point at the Dashboard=cards / Form-heavy=stack / List-detail=split mapping in `main.ts` rather than inventing separate doc snippets.
- **05-05 (MIGRATION/CHANGELOG):** unaffected by this plan; the Plan 05-01 `--vms-warning` forward-note remains the binding input.
- **05-06 (release closeout / RELEASE-04):** Plan 06's `check-no-demo-style.mjs` repo-scan guard (D-12/D-15) will pass on `demo/Showcase/frontend/index.html` (zero `<style>`) and on `main.ts` (no `<style` literal, `.vms-*`-only). Vite build is green. The pre-existing `*.css?inline` tsc gap is logged in `deferred-items.md` as a candidate for Plan 06's hygiene pass if demo `tsc` cleanliness becomes a gated invariant.

## Self-Check: PASSED

- Files verified present: `demo/Showcase/frontend/src/main.ts`, `demo/Showcase/frontend/index.html`, `.planning/phases/05-canonical-examples-0-4-0-release-closeout/05-02-SUMMARY.md`, `.planning/phases/05-canonical-examples-0-4-0-release-closeout/deferred-items.md` — all FOUND.
- Commits verified present: `2db2f61` (Tasks 1+2), `cbf96b8` (Task 3) — both FOUND in `git log`.
- Static verifications re-run at close: `TASK1 OK`, `TASK2 OK`, `TASK3 OK`. Archetype/view/nav code type-clean (zero non-`?inline` tsc errors). `vite build` exit 0. All 11 prior gallery sections present; `view:set` + `list-detail:select` handlers present; 5 `section variant:"card"` tiles; nav is first child; 6 catalog items (≥5).

---
*Phase: 05-canonical-examples-0-4-0-release-closeout*
*Completed: 2026-05-18*
