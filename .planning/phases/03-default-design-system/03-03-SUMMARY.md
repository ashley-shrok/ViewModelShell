---
phase: 03-default-design-system
plan: 03
subsystem: ui
tags: [typescript, css, jsdom, vitest, bem-modifier, theme-seam, parity, regression-guard]

# Dependency graph
requires:
  - phase: 03-default-design-system (Plan 01)
    provides: "default.css :root scale tokens (--vms-space-sm/md/lg) + seam vars (--vms-surface/--vms-border/--vms-radius) the .vms-page--compact remap & .vms-section--card surface consume"
  - phase: 03-default-design-system (Plan 02)
    provides: "PageNode.density? / SectionNode.variant? closed-union TS+.NET fields the renderer reads to emit the BEM modifiers"
provides:
  - "browser.ts page()/section() emit vms-page--compact / vms-section--card via the established strict-equality idiom (D-04)"
  - ".vms-page--compact scoped 3-token rhythm remap (D-10) + .vms-section--card grouped surface (existing seam vars, no new tokens, D-15)"
  - "Net-new jsdom test suite proving class emission + omitted-field byte-identical guarantee"
  - "Active THEME-05 regression proof: parity 7/7 byte-identical + zero theme-file edits"
affects: [04-preset-grid-layout, 05-canonical-examples]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BEM modifier emitted iff a closed-union field equals its exact literal (`n.density === \"compact\"`) — comfortable/omitted ⇒ byte-identical className, parity-regression-proven"
    - "Density as a scoped CSS custom-property remap (.vms-page--compact redeclares --vms-space-sm/md/lg) so all descendants inherit tighter rhythm with zero per-rule churn (D-10)"

key-files:
  created:
    - "viewmodel-shell/test/theme-modifiers.test.ts (5 jsdom assertions: compact/card emission + comfortable/omitted byte-identical)"
  modified:
    - "viewmodel-shell/src/browser.ts (page()/section() modifier-class emission, 2 lines)"
    - "viewmodel-shell/styles/default.css (+15 lines: .vms-page--compact remap + .vms-section--card surface, additive only)"
    - "AGENTS.md (node-types + CSS-class tables: page/section density/variant rows)"

key-decisions:
  - "Strict `=== \"compact\"` / `=== \"card\"` (not whole-field truthiness) so density:\"comfortable\" emits NO modifier — byte-identical guarantee (D-04)"
  - ".vms-page--compact remaps EXACTLY the 3 rhythm tokens (sm/md/lg); 2xs/xs/xl + all type tokens untouched — compact is density, not shrink (D-10, UI-SPEC)"
  - ".vms-section--card reuses --vms-surface/--vms-border/--vms-radius/--vms-space-md — zero new color/spacing tokens, palette frozen (D-15); no gap (inherits .vms-section), no heading restyle"
  - "Additive CSS only — existing .vms-page/.vms-section rules byte-unchanged; zero @media; zero styles/themes/*.css edits (THEME-05 sacred seam, actively proven)"
  - "No new parity fixture (D-05, deferred to Phase 4/5); no version bump (Phase 5 RELEASE-01); demos not switched to stylesheet (Phase 5)"

patterns-established:
  - "Theme-modifier wiring pattern: closed-union field → strict-equality BEM emission → scoped CSS (token remap or seam-var surface) → jsdom emission test asserting both the modifier-present and omitted-byte-identical cases, with parity 7/7 as the non-breaking regression proof"

requirements-completed: [THEME-03, THEME-04, THEME-05]

# Metrics
duration: 4min
completed: 2026-05-17
---

# Phase 3 Plan 3: Theme-Modifier Wiring + THEME-05 Regression Proof Summary

**Wired THEME-03/THEME-04 end to end: `browser.ts` emits `vms-page--compact`/`vms-section--card` via the established strict-equality idiom; `default.css` gained the `.vms-page--compact` 3-token rhythm remap (D-10) and the `.vms-section--card` grouped surface from existing seam vars (no new tokens); net-new jsdom tests prove emission AND the omitted-field byte-identical guarantee; parity 7/7 byte-identical with zero theme-file edits actively proves the THEME-05 sacred-seam + non-breaking regression invariant.**

## Performance

- **Duration:** ~4 min (most wall-clock in the cross-backend parity harness + an orphaned-process recovery)
- **Started:** 2026-05-17T22:49:10Z
- **Completed:** 2026-05-17T22:52:43Z
- **Tasks:** 3
- **Files created/modified:** 4 (1 created, 3 modified)

## Accomplishments
- `browser.ts` `page()` now sets `el.className = \`vms-page${n.density === "compact" ? " vms-page--compact" : ""}\``; `section()` sets `\`vms-section${n.variant === "card" ? " vms-section--card" : ""}\`` — exact established ternary template-literal idiom (list-item/button/modal), strict literal equality, no data-attributes.
- `default.css` gained `.vms-page--compact { --vms-space-sm: 0.5rem; --vms-space-md: 0.75rem; --vms-space-lg: 1rem; }` — a scoped redeclaration of exactly the 3 rhythm tokens (D-10, UI-SPEC §Density Modifier deltas); `--vms-space-2xs/xs/xl` and all `--vms-text-*` deliberately untouched (compact is density, not shrink).
- `default.css` gained `.vms-section--card { background: var(--vms-surface); border: 1px solid var(--vms-border); border-radius: var(--vms-radius); padding: var(--vms-space-md); }` — grouped surface from existing seam vars, no new color/spacing token, no `gap` (inherits `.vms-section`), no heading restyle (UI-SPEC §Card Section Surface verbatim).
- CSS is purely additive: pre-existing `.vms-page`/`.vms-section`/`:root` rules byte-unchanged; zero `@media` introduced.
- Net-new `viewmodel-shell/test/theme-modifiers.test.ts` (vitest + jsdom, `adapter-seam.test.ts` harness pattern): 5 assertions — `density:"compact"` ⇒ className contains `vms-page--compact`; `density:"comfortable"` ⇒ `className === "vms-page"`; density omitted ⇒ `className === "vms-page"`; `variant:"card"` ⇒ className contains `vms-section--card`; variant omitted ⇒ `className === "vms-section"`. Class-emission only, zero computed-pixel assertions (UI-SPEC regression item 5).
- `AGENTS.md` node-types table (`page`/`section` rows) + CSS-classes-emitted table updated to list `density`/`variant` + `.vms-page--compact`/`.vms-section--card`; minimal table-local edits only (full doc polish deferred to Phase 5 EXAMPLES-03).
- **THEME-05 sacred seam actively proven:** `git status --porcelain viewmodel-shell/styles/themes/` empty (zero edits to the 11 theme files); cross-backend parity 7/7 byte-identical across .NET/Bun/Node (existing fixtures omit density/variant ⇒ wire byte-identical ⇒ non-breaking guarantee, D-01).

## Task Commits

Each task was committed atomically (with hooks, no `--no-verify`):

1. **Task 1: Emit vms-page--compact / vms-section--card in browser.ts (D-04 idiom)** - `269016c` (feat)
2. **Task 2: Add .vms-page--compact remap and .vms-section--card surface to default.css** - `6e68084` (feat)
3. **Task 3: jsdom emission tests + full test/parity gates + AGENTS.md tables** - `597351d` (test)

**Plan metadata:** _(final docs commit — see git log)_

## Files Created/Modified
- `viewmodel-shell/src/browser.ts` (modified) — `page()`/`section()` className lines now emit the BEM modifier iff the field equals its exact literal; everything else (title/heading/kids/appendChild, all other render functions) byte-unchanged.
- `viewmodel-shell/styles/default.css` (modified, +15 lines) — `.vms-page--compact` 3-token remap block + `.vms-section--card` surface block, placed adjacent to `.vms-page`/`.vms-section`; additive only.
- `viewmodel-shell/test/theme-modifiers.test.ts` (created) — 5 jsdom class-emission assertions including the omitted-byte-identical guarantee.
- `AGENTS.md` (modified) — node-types `page`/`section` rows note `density`/`variant`; CSS-classes table `page`/`section` rows list `.vms-page--compact`/`.vms-section--card`.

## Verification Results
- Task 1 regex check (scoped script file) — `Task1 regex OK` (both emission lines match the exact idiom)
- `cd viewmodel-shell && npm run build` (tsc) — exit 0, clean
- `npm run check:core-globals` — PASS (`src/index.ts` references zero platform globals; emission lives in `browser.ts`, excluded from the guard — AGNOSTIC-03 held)
- Task 2 CSS check (scoped script file) — `Task2 CSS OK` (compact remaps exactly sm/md/lg, no forbidden tokens; card surface exact; zero `@media`)
- `npm test` (vitest) — **23/23 passed** across 4 files including the net-new `theme-modifiers.test.ts` (5 tests); no computed-pixel assertions added
- `dotnet build viewmodel-shell-dotnet` — exit 0 (Build succeeded, 0 Warnings, 0 Errors)
- `cd parity && bun run run.ts` — **"✓ Parity tests passed", "✓ all backends agree"** — all 7 fixtures byte-identical across .NET/Bun/Node (THEME-05/D-01 non-breaking regression proof; no new fixture added per D-05)
- `git status --porcelain viewmodel-shell/styles/themes/` — **empty** (THEME-05 sacred seam: zero theme-file edits, actively asserted)
- Task 3 combined check — `Task3 verification OK` (themes empty + AGENTS.md tables updated + test file has modifier assertions)

## Decisions Made
- Followed the plan exactly. Strict literal equality for emission (D-04); `.vms-page--compact` remaps only the 3 rhythm tokens (D-10); `.vms-section--card` reuses seam vars with no new tokens, no gap, no heading restyle (D-15, UI-SPEC); additive CSS only; no new parity fixture (D-05); no version bump (Phase 5); demos not switched (Phase 5).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Parity harness prebuild failed on stale orphaned demo/dotnet/bun processes holding DLL file locks**
- **Found during:** Task 3 overall verification (cross-backend parity)
- **Issue:** First `bun run parity/run.ts` failed at the `dotnet-contacts` prebuild with `MSB3027`/`MSB3021`: "The file is locked by: `ContactManager (29272)`". A large set of orphaned demo backends (`ContactManager`, `RetroBoard`, `ExpenseTracker`, `HelpDesk`, `FeatureProbe`, `Reorder`) plus stray `dotnet`/`bun` processes from a prior parity run held the `AshleyShrok.ViewModelShell.dll` copy lock. Purely environmental — not a defect in the `browser.ts`/`default.css` changes (no compile/test errors anywhere; only file-copy lock errors during the .NET prebuild).
- **Fix:** Terminated only the orphaned demo executables + stray `dotnet`/`bun` processes (deliberately NOT touching any `node` process, since this executor runs under node), then reran the parity suite.
- **Files modified:** None.
- **Verification:** Rerun `bun run parity/run.ts` → "✓ Parity tests passed; ✓ all backends agree" across all 7 fixtures. Post-run orphaned backends were also cleaned up to leave the environment tidy.
- **Committed in:** N/A (no code change).

**Tooling note (not a deviation):** The plan's inline `node -e` verify commands embed `${...}` template-literal patterns; PowerShell expands `$` before `node` receives the string, producing false "missing/wrong" failures. Verification was performed via equivalent temporary `.cjs` script files (deleted after use) asserting the identical regexes — the plan's actual acceptance criteria were checked precisely (`Task1 regex OK` / `Task2 CSS OK` / `Task3 verification OK`). No code or criteria changed.

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking, environmental orphaned-process DLL lock, zero code change).
**Impact on plan:** No scope creep, no code change beyond the 3 planned tasks. The deviation was environmental friction (stale prior-run processes) that did not affect correctness of the delivered renderer/CSS/tests; every plan gate was verified precisely and is green.

## Issues Encountered
None beyond the documented environmental deviation (orphaned prior-run demo/dotnet/bun processes holding a DLL lock, twice — once before the parity run, once left by the harness's incomplete Windows shutdown). Both cleared without code change; all gates green. No `CLAUDE.md` present (shows as a pre-existing unstaged deletion `D CLAUDE.md`, out of scope — left untouched). No project skills directories.

## Known Stubs
None. No hardcoded empty values, placeholders, or unwired data sources introduced. The delivered code is fully wired: the renderer reads real `density`/`variant` fields, the CSS rules are live, and the jsdom tests assert real rendered output.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- THEME-03, THEME-04, THEME-05 closed. Phase 3 (Default Design System) is complete — this is the last plan in the phase.
- Phase 4 (Preset-Grid Layout) inherits a serviceable shipped default theme (shell + scale + density + card) with the override seam regression-guarded and proven; presets will arrange children *within* this rhythm.
- Phase 5 (Canonical Examples + 0.4.0 Closeout) owns: switching demos/Showcase to the shipped stylesheet, the dedicated density/card cross-backend parity fixture (deferred per D-05), the aligned 0.4.0 npm+NuGet bump (RELEASE-01), and full AGENTS.md doc polish (EXAMPLES-03).
- No version bump performed (correct — npm 0.3.14 / NuGet 0.3.10 unchanged). No blockers.

## Self-Check: PASSED

- FOUND: `.planning/phases/03-default-design-system/03-03-SUMMARY.md`
- FOUND: commit `269016c` (Task 1)
- FOUND: commit `6e68084` (Task 2)
- FOUND: commit `597351d` (Task 3)
- FOUND: `viewmodel-shell/test/theme-modifiers.test.ts`
- FOUND: `vms-page--compact` emission in `viewmodel-shell/src/browser.ts` (L196)
- FOUND: `vms-section--card` emission in `viewmodel-shell/src/browser.ts` (L209)
- FOUND: `.vms-page--compact` + `.vms-section--card` rules in `viewmodel-shell/styles/default.css`
- FOUND: `.vms-page--compact` + `.vms-section--card` in `AGENTS.md` CSS-class table

---
*Phase: 03-default-design-system*
*Completed: 2026-05-17*
