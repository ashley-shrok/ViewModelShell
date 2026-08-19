---
phase: 33-column-filter-expansion-phase-2-adapter-ui-popover-slash-thr
plan: "06"
subsystem: verification / gate / real-browser-exercise
tags: [filter, verification, checkpoint, human-verify, dispatch, css, real-browser, mutation-verify]
dependency_graph:
  requires:
    - "33-01 — BrowserAdapter filter-row rebuild (popover + portal + icon state grammar)"
    - "33-02 — old wire field removal from both backends"
    - "33-03 — HelpDesk .NET migration"
    - "33-04 — filter-adapter.test.ts (49 tests → 52 tests after Iter 2 dispatch additions)"
    - "33-05 — MIGRATION.md + AGENTS.md + CHANGELOG.md v10.0.0 promotion"
  provides:
    - "REQ-CF2-13 gate closure — full 11-command green-tree gate green"
    - "REQ-CF2-14 gate closure — Ashley's real-browser exercise 'taste ok' captured"
    - "4 shipped defect fixes discovered by real-browser exercise (Rules 1+2 auto-fixes)"
    - "Pre-release green-tree evidence for Wave 5 (Plan 33-07 release ritual)"
  affects:
    - viewmodel-shell/src/browser.ts (2 hunks over 2 commits — multi-column filter-row layout; dispatch on Enter/Apply/Clear)
    - viewmodel-shell/styles/default.css (2 hunks over 2 commits — popover row op/value flex layout; row-height alignment)
    - viewmodel-shell/test/filter-adapter.test.ts (dispatch-assertion tests added, 49 → 52)
    - AGENTS.md (typed column-filter primitive section — dispatch semantics corrected)
    - .planning/phases/33-.../33-01-SUMMARY.md (behavioral decisions correction)
    - .planning/phases/33-.../33-04-SUMMARY.md (mutation-verify session addendum)
tech_stack:
  added: []
  patterns:
    - "Real-browser exercise as SPEC-gate closure (REQ-CF2-14) — headless-chrome iteration encouraged but never substitutes for the human exercise"
    - "Iterative checkpoint cycle: served page → Ashley exercise → surface defect → Rule 1/2 auto-fix → re-serve → re-exercise until 'taste ok'"
    - "Dispatch-assertion mutation-verify per commit site (remove dispatch → confirm N tests fail → restore → confirm green)"
    - "CSS-only height alignment via explicit `height: 1.875rem + box-sizing: border-box` on both `<select>` and `<input>` (line-height alone insufficient because <select> ignores line-height and uses intrinsic sizing)"
    - "Session-recycle recovery via cherry-pick from worktree-agent branch reflog"
key_files:
  created:
    - .planning/phases/33-.../33-06-SUMMARY.md (this file)
  modified:
    - viewmodel-shell/src/browser.ts (2 fix commits)
    - viewmodel-shell/styles/default.css (2 fix commits)
    - viewmodel-shell/test/filter-adapter.test.ts (dispatch-assertion tests added)
    - AGENTS.md (dispatch semantics correction)
    - .planning/phases/33-.../33-01-SUMMARY.md (behavioral decisions correction)
    - .planning/phases/33-.../33-04-SUMMARY.md (mutation-verify addendum)
decisions:
  - "Auto-fix Rule 1 authorized for all 4 defects discovered during real-browser exercise — each was a genuine framework bug the shipped 49-test jsdom suite missed (jsdom does not compute CSS layout; jsdom cannot exercise UI grammar the way a human does; jsdom in-page reducers hide the missing-dispatch defect by auto-re-rendering)"
  - "Popover row-height fix pins `height: 1.875rem` (= 30px @ 16px root) specifically to preserve the pre-fix `<select>` height so the select-select paths Ashley already confirmed OK stay byte-identical"
  - "Verification page updated between Iter 2 and Iter 3 to remove auto-re-render on `sa.write` so the missing-dispatch defect became visibly reproducible (mirrors real server-round-trip semantics)"
  - "Deferred: verification-page info-bubble theme awareness (hand-CSS'd verification chrome, not framework — no follow-up needed unless Ashley requests)"
  - "Deferred: HelpDesk/Bun/Showcase demo links dead because services weren't running (Ashley can spin up on demand; not a framework defect)"
metrics:
  duration: ~5 hours across 3 iterations (initial gate + serve → Iter 1 defect+fix → Iter 2 defect+fix → Iter 3 polish+fix → SUMMARY)
  completed: 2026-08-18T21:45:00Z
  tasks_completed: 3 (gate, serve, checkpoint) — checkpoint reached 3 times before "taste ok"
  files_changed: 6 (browser.ts, default.css, filter-adapter.test.ts, AGENTS.md, 33-01-SUMMARY.md, 33-04-SUMMARY.md)
  commits_landed_on_main: 4 (052555a, 014e376, eb54fab, f46d5cb — original worktree SHAs 817fc5b, 1ed0ad5, 0c8c3a7 cherry-picked post-recycle)
---

# Phase 33 Plan 06: REQ-CF2-13 Green-Tree Gate + REQ-CF2-14 Real-Browser Exercise Summary

**One-liner:** Full 11-command green-tree gate passed + Ashley's real-browser exercise closed after 3 iterations that surfaced 4 shipped defects (multi-column filter-row layout, missing Enter/Apply/Clear dispatch, popover row layout, 2px height mismatch) — each fixed inline under Rule 1/2 auto-fix authority.

## What Was Built

Plan 33-06 is a **verification / gate plan**, not a code plan. Its output is (a) evidence that the full green-tree gate passes on the Phase 33 code delta, and (b) Ashley's real-browser exercise confirmation ("taste ok") — both hard prerequisites for Wave 5 (Plan 33-07 release ritual). Along the way, real-browser exercise surfaced 4 framework defects the shipped 49-test jsdom adapter suite could not catch; each was fixed inline under deviation Rule 1/2 (auto-fix bugs / auto-add missing critical functionality).

### Task 1: Full 11-command green-tree gate

Ran per AGENTS.md "NEVER PUBLISH OR PUSH ANYTHING BROKEN" — every command binary pass/fail, no `|| true` bypass.

| # | Command | Result |
|---|---------|--------|
| 1 | `npx vitest run` | 88 files, 1613 passed, 1 skipped |
| 2 | `npm run check:test-types` | exit 0 |
| 3 | `npm run check:core-globals` | AGNOSTIC-03 pass — `src/index.ts` references zero platform globals |
| 4 | `npm run check:demo-types` | 26 demo projects clean |
| 5 | `dotnet test viewmodel-shell-dotnet/Tests` | 622 passed |
| 6 | `for p in $(find demo -name "*.Tests.csproj"); do dotnet test "$p"; done` | 191 passed (Tasks 28 + ContactManager 39 + HelpDesk 61 + ExpenseTracker 30 + RetroBoard 33) |
| 7 | `bun run parity/run.ts` | All backends agree, skill parity byte-identical |
| 8 | `npm run check:no-demo-style` | 36 files clean (D-12/D-15 no-`<style>` guard) |
| 9 | `npm run build` | `dist/browser.js` rebuilt (~386KB, timestamp fresh) |
| 10 | `grep -nE "\b(filterable\|filterValue\|filterBinds\|filterAction)\b" viewmodel-shell/src/index.ts` | 0 matches (exit 1) |
| 11 | `grep -nE "\b(Filterable\|FilterValue\|FilterBinds\|FilterAction)\b" viewmodel-shell-dotnet/ViewModels.cs` | 0 matches (exit 1) |

All 11 exit clean.

### Task 2: Verification page served

**URL:** `http://100.113.23.63:8099/`
**Serve command:** `python3 -m http.server 8099 --bind 100.113.23.63 --directory /tmp/vms-v10-verify/`
**Server PID:** 3364849 (survived the mid-flow session recycle — python served fresh files from disk across all 3 iterations without a restart)

**Contents (per REQ-CF2-14):**
- **Section i** — all 5 value-kinds (text/number/date/fixed-set/yes-no), one filterable column each; type-and-Enter grammar exercised
- **Section ii** — popover full flow (2 filterable columns: title/priority); operator picker, add-rule, all-of/any-of joiner, Apply/Clear, outside-click discard, Escape discard
- **Section iii** — icon state grammar (3 side-by-side tables): filter-slash (empty), plain funnel (simple contains), plain funnel + dot (escalated)
- **Section iv** — near-viewport-edge column via `<div style="justify-content:flex-end;">` wrapper — proves the D-03 leftward-clamp fires without the page overflowing horizontally

Uses the REAL shipped bundle (`dist/browser.js` + `dist/icons-payload.js`), the REAL shipped CSS (`styles/default.css`), and an in-page reducer that mirrors real-app dispatch semantics: `sa.write` writes state without triggering a re-render (mirrors "server hasn't seen the change yet"); `onAction` dispatch triggers a re-render (mirrors server round-trip returning a fresh vm). This mirror was critical for Iter 3 — with an auto-re-render on `sa.write`, the missing-dispatch defect would have been invisible.

No `server.js` imports (gotcha #13); `matchesFilter` inlined in the page's `<script>` block.

### Task 3: Real-browser exercise (REQ-CF2-14)

Ashley exercised the served page in a real browser (Chrome or Firefox) — the hard gate before commit/push/publish/tag/announce, per AGENTS.md standing directive 2026-08-06. **Three iterations were required** before "taste ok"; each surfaced defects the shipped jsdom suite could not catch.

## Deviations from Plan — 4 Rule-1/2 auto-fixes across 3 iterations

The plan spec (`33-06-PLAN.md`) contains only 3 tasks (gate, serve, checkpoint) and describes no code changes. Iteration surfaced 4 shipped framework defects; each was fixed inline under Rule 1 (bug fix) or Rule 2 (missing critical functionality). All fixes track back to the underlying phase (33-01 adapter or 33-01 CSS), not new work — they close gaps that shipped through Wave 1 because jsdom cannot exercise UI grammar the way a human does.

**Note on commit SHAs:** The initial 3 fix commits (`817fc5b`, `1ed0ad5`, `0c8c3a7`) were created inside the pre-recycle worktree branch `worktree-agent-a7c323e9f9b40fd08`. A mid-flow session recycle stranded them on the worktree branch after the worktree filesystem was cleaned up. Recovery: the orchestrator cherry-picked them onto `main` via reflog before the branch was garbage-collected — the cherry-pick SHAs (`052555a`, `014e376`, `eb54fab`) are what's on `main` and represent the shipped fixes. The final polish commit (`f46d5cb`) was authored directly on `main` post-recycle since the worktree was gone.

### Iter 1 — multi-column filter-row layout collapse

**Defect (surfaced by Ashley's first exercise):** In Section i (5 filterable columns) and Section ii (2 filterable columns), the filter row's cells stacked vertically under the first column only instead of spreading across all columns. Section iv positioning (`margin-left: calc(100vw - 280px)`) also pushed the table off-screen forcing horizontal scroll.

**Root cause:** `browser.ts` (Plan 33-01) set `th.style.display = "flex"` directly on filter-row `<th>` cells. Setting `display: flex` on a `<th>` REPLACES its implicit `display: table-cell` — the browser stops laying it out as a table cell, so all cells collapse into a stack under column 1. **Only visible with 2+ filterable columns**; HelpDesk agent queue has 1, so every shipped demo was self-hiding.

**Fix (`052555a`, cherry-picked from worktree `817fc5b`):** Wrap the flex layout in a nested `<div>` inside the `<th>` so the `<th>` keeps `display: table-cell` and the flex container is a child.

```typescript
// Before (in browser.ts filter-row rendering path):
th.style.display = "flex";
th.style.alignItems = "center";
th.style.gap = "2px";
// ... appendChild(inp), appendChild(filterBtn) directly on `th`

// After:
const cellWrap = document.createElement("div");
cellWrap.style.display = "flex";
cellWrap.style.alignItems = "center";
cellWrap.style.gap = "2px";
// ... appendChild(inp/summary), appendChild(filterBtn) on `cellWrap`
th.appendChild(cellWrap);
```

Verification-page Section iv positioning also fixed: dropped `margin-left: calc(100vw - 280px)` in favor of a `<div style="display:flex; justify-content:flex-end">` wrapper — table hugs the right edge without forcing horizontal overflow.

- **Files modified:** `viewmodel-shell/src/browser.ts`
- **Existing tests:** 49 filter-adapter tests continued to pass (jsdom doesn't compute CSS layout, so the query-selector-based tests were structurally blind to this)

### Iter 2 — missing dispatch on Enter / Apply / Clear (SPEC REQ-CF2-01 violation)

**Defect (surfaced by Ashley's second exercise):** Typing in the filter input + pressing Enter did not visibly change the table. Popover Apply did not visibly commit. Popover Clear did not visibly reset. The verification page's in-page reducer had been masking the defect by auto-re-rendering on `sa.write`; changing the reducer to only re-render on `onAction` dispatch (mirroring real server-round-trip) exposed it.

**Root cause:** Wave 1 (Plan 33-01) shipped inline Enter, popover Apply, and popover Clear as pure state-writes (`sa.write` only, no `on(...)` dispatch). SPEC REQ-CF2-01 explicitly requires the dispatch: "typing text + Enter dispatches an action that writes a single `{operator:'contains', value:'...'}` rule at that column's bind path." Plan-checker W-2 flagged the SPEC/Wave-1 tension; it was let slide and shipped. For any paginated consumer, the missing dispatch means typing has zero visible effect until an unrelated action triggers a round trip — verbally documented as "state-write only, no named dispatch" in Wave 1's SUMMARY.

Also caught during Iter 2: popover rule-row layout defect (**Defect B**). Prior CSS set both `.vms-filter-op-select` and `.vms-filter-value-input` to `width: 100%` inside a `display: flex` row, so both children fought for space; the operator select's default width won and the value input collapsed under one character wide.

**Fix (`014e376`, cherry-picked from worktree `1ed0ad5`):**

*Defect A — dispatch on commit (`browser.ts`):*
- **Inline Enter**: keep `sa.write(bindPath, descriptor)`, ADD `on({ name: "filter-${col.key}" })`
- **Popover Apply**: write cleaned draft, ADD `on({ name: "filter-${col.key}" })`
- **Popover Clear**: write null, ADD `on({ name: "filter-${col.key}" })` (user expects Clear to visibly reset)
- **Inline `input` (keystroke)**: stays write-only, NO dispatch (preserves VMS's bind-on-keystroke draft pattern)
- **Outside-click / Escape**: remain discard (no state write, no dispatch)

Column-key convention (`filter-<colKey>`) mirrors the parity fixture `filter-*` catch-all reset-page arm on both backends.

*Defect B — popover row layout (`default.css`):*
- `.vms-filter-op-select`: `flex: 0 0 auto; max-width: min(14rem, 50%)` — sizes to content, bounded so "Does not equal" fits without wrapping
- `.vms-filter-value-input`: `flex: 1 1 0; min-width: 0` — fills remaining space

*Test suite (`test/filter-adapter.test.ts`):* Added 3 dispatch-assertion tests for inline Enter (default column, other column, empty-input reset). Tightened 4 existing tests (Apply, Apply-alt, Clear, outside-click-discard, Escape-discard) to assert dispatch presence/absence. Total: 49 → 52.

*Docs correction (`eb54fab`, cherry-picked from worktree `0c8c3a7`):*
- `33-01-SUMMARY.md` — Behavioral Decisions section rewritten in place, attributes correction to Ashley's Plan 33-06 checkpoint; frontmatter `patterns[]` + `decisions[]` updated in parallel
- `33-04-SUMMARY.md` — Mutation-Verify Session gets a 2026-08-18 addendum documenting three new mutation cases (remove Enter dispatch → 3 tests fail; Apply → 2; Clear → 1); test count updated 49 → 52
- `AGENTS.md` — "Typed column-filter primitive" section (added by Plan 33-05) — UI-grammar bullets + behavior #1 corrected to describe the actual shipped shape (dispatch on Enter/Apply/Clear, state-only on keystroke, no dispatch on discard)

**Mutation-verify session (Iter 2):** Removed each dispatch site one at a time, ran tests, confirmed failures, restored, confirmed green.
- Remove Enter dispatch → 3 tests fail: "Enter DISPATCHES {name: 'filter-<colKey>'}", "Enter on a different column key…", "Enter with empty input writes null AND still dispatches (reset signal)"
- Remove Apply dispatch → 2 tests fail: "(g) apply-on-Apply: Apply button commits draft to state, dispatches, and closes popover", "Apply DISPATCHES {name: 'filter-<colKey>'} so the server re-renders"
- Remove Clear dispatch → 1 test fails: "(g) clear-commits-empty: Clear button writes null, dispatches, and closes popover"

Every commit site is protected by an adversarial mutation-verify.

### Iter 3 — 2px filter-input vs op-select height mismatch (text-operator path only)

**Defect (surfaced by Ashley's third exercise):** In the popover rule row, when the operator produces a text `<input>` (contains / starts-with / ends-with / equals-on-text), the input's computed height was ~28px while the sibling operator `<select>` was ~30px — a 2px vertical sag. Only affected the text-input path; select-select paths (fixed-set is/is-not, yes-no is-true/is-false) were already aligned. Ashley called it "a caveat, otherwise totally good."

**Root cause:** UA-default intrinsic sizing differs between `<input type="text">` and `<select>`. Both had identical `font-size`, `padding`, and `border`, but `<select>` uses its own intrinsic line-height (~1.5) while `<input>`'s `line-height: normal` resolves ~1.2 per font metrics — the difference cascades to a 2px content-box gap. Chrome/Firefox both ship this asymmetry.

**Fix attempts (verified via headless-chrome DOM measurement against the shipped CSS):**
- `line-height: 1.2` alone: made it WORSE (input 28→25.59px, select ignored line-height and stayed at 30px)
- `height: 1.875rem + box-sizing: border-box + line-height: 1.2`: both paths compute to exactly 30.00px

**Fix (`f46d5cb`, authored directly on `main` post-recycle):** anchor both classes with an explicit `height: 1.875rem` (= 30px @ 16px root) + `box-sizing: border-box` + `line-height: 1.2`.

```css
.vms-filter-op-select,
.vms-filter-value-input {
  height: 1.875rem;
  box-sizing: border-box;
  line-height: 1.2;
  /* ...shared shipped properties (background, border, color, font, padding)... */
}
.vms-filter-op-select { flex: 0 0 auto; min-width: 0; max-width: min(14rem, 50%); }
.vms-filter-value-input { flex: 1 1 0; min-width: 0; }
```

Why `1.875rem` specifically: matches the pre-fix `<select>` height so the select-select paths Ashley already confirmed OK stay pixel-identical (byte-for-byte visual continuity for the previously-fine paths). Using `rem` instead of `px` respects user font-size preferences.

**Verification (headless-chrome DOM measurement against served CSS after fix):**

| Path | op-select | value | diff |
|------|-----------|-------|------|
| Text-input (contains / starts-with / etc.) | 30.00px | 30.00px | **0.00px** |
| Select-select (fixed-set is/is-not, yes-no) | 30.00px | 30.00px | **0.00px** |

- **Files modified:** `viewmodel-shell/styles/default.css`
- **Existing tests:** All 1613 vitest tests continue to pass (CSS changes don't affect jsdom tests)

## Ashley's Real-Browser Exercise Trail

**Iter 1 (initial serve):** Defects reported — filter cells stacked under column 1 only in Sections i + ii; no data in tables (this one was self-inflicted, I'd passed `cells: []` array instead of the required `Record<string,string>` shape — corrected in the same iteration); Section iv table 20% off-screen right.

**Iter 2 (after 052555a + verification page reshape):** Defect A — inline Enter, popover Apply, popover Clear all fail to dispatch (SPEC REQ-CF2-01 violation). Defect B — popover operator dropdown consumes ~60% of the row's horizontal space, squeezing the value input under one character wide.

**Iter 3 (after 014e376 + eb54fab):** Both Defect A + B confirmed fixed. One caveat: 2px vertical mismatch between text `<input>` (~15px inspector / ~28px DOMRect) and sibling `<select>` (~17px / ~30px) on the text-operator path only. Ashley greenlit fixing it inline before ship.

**Iter 4 (after f46d5cb):** **"good to go"** — popover row-height polish accepted; both defects + polish landed.

Each iteration used the same served URL (`http://100.113.23.63:8099/`) — python http.server survives the OS session recycle and re-reads files from disk on every request, so a CSS change hits Ashley on the next reload without a server restart.

## Non-blockers deferred

Per Ashley's Iter 2 directive:
- **Verification-page info bubbles not theme-aware** — the light-blue `.checklist` and yellow `.link-bar` bubbles above each section are hand-CSS'd verification-chrome, not framework. No follow-up needed unless Ashley requests.
- **HelpDesk / HelpDesk-bun / Showcase demo links dead** — those services weren't running during the exercise sessions. Not a framework defect; Ashley can spin them up on demand for in-situ exercise (standard ports: 5009 for HelpDesk .NET, 3000 for HelpDesk-bun, 5173 for Showcase). Ports were left free.

## Session-recycle recovery note

Mid-flow, the Claude Code session was recycled after Iter 3's fix commits landed on the worktree branch `worktree-agent-a7c323e9f9b40fd08`. The worktree filesystem was cleaned up as part of the recycle, orphaning the branch. The orchestrator recovered by cherry-picking the 3 relevant commits from the worktree branch's git reflog before it was garbage-collected:

- `817fc5b` (worktree) → `052555a` (main) — multi-column filter-row layout
- `1ed0ad5` (worktree) → `014e376` (main) — dispatch on Enter/Apply/Clear + popover row layout
- `0c8c3a7` (worktree) → `eb54fab` (main) — SUMMARY + AGENTS.md doc corrections

The post-recycle polish commit (`f46d5cb`) was authored directly on `main` since the worktree was gone. This SUMMARY (also on `main`) closes the plan.

**Verification page continuity:** The python http.server (PID 3364849 in `/tmp/vms-v10-verify/`) survived the OS-level session recycle and served all 4 Ashley iterations from the same URL without ever restarting. CSS updates were picked up automatically via disk re-reads.

## Commits landed on `main`

| Iter | Commit (main) | Original (worktree) | Message |
|------|---------------|---------------------|---------|
| 1 | `052555a` | `817fc5b` | fix(33-06): filter row cells collapse under column 1 when 2+ columns are filterable |
| 2 | `014e376` | `1ed0ad5` | fix(33-06): filter Enter/Apply/Clear now dispatch {name:'filter-<colKey>'}; popover row layout |
| 2 | `eb54fab` | `0c8c3a7` | docs(33-06): correct dispatch semantics in 33-01/33-04 SUMMARYs + AGENTS.md |
| 3 | `f46d5cb` | (authored on main post-recycle) | fix(33-06): align filter popover row heights — text-input path was 2px shorter than select |

## Known Stubs

None. All 4 defects were shipped-framework bugs, not stubs; each fix is complete and mutation-verified where applicable.

## Threat Flags

None. All 4 fixes are Rule 1 auto-fixes to existing shipped code paths (browser.ts filter-row rendering + CSS). No new network endpoints, no new auth paths, no new file-access patterns, no schema changes at trust boundaries. The `filter-<colKey>` action name convention introduced in Iter 2 mirrors an existing shipped convention on both backends' `filter-*` catch-all arms (parity fixture already exercises it) — not a new surface.

## Self-Check: PASSED

Files verified to exist:
- `viewmodel-shell/src/browser.ts` — modified (contains `cellWrap` + `on({ name: \`filter-${col.key}\` })` — verify: `grep -c "cellWrap\|filter-\\\${col.key}" viewmodel-shell/src/browser.ts`)
- `viewmodel-shell/styles/default.css` — modified (contains `height: 1.875rem` on `.vms-filter-op-select, .vms-filter-value-input` — verify: `grep -c "1.875rem" viewmodel-shell/styles/default.css`)
- `viewmodel-shell/test/filter-adapter.test.ts` — 52 tests, all pass
- `AGENTS.md` — "Typed column-filter primitive" section has corrected dispatch semantics
- `.planning/phases/33-.../33-01-SUMMARY.md` — Behavioral Decisions section corrected
- `.planning/phases/33-.../33-04-SUMMARY.md` — Mutation-Verify addendum present
- `.planning/phases/33-.../33-06-SUMMARY.md` — this file

Commits verified on main:
- `052555a` — filter row cells layout fix
- `014e376` — dispatch + popover row layout fix
- `eb54fab` — docs correction
- `f46d5cb` — popover row height polish

Gate results (all 11 green): documented above; last run 2026-08-18 21:37 UTC.

Ashley confirmation quote: **"good to go"** (Iter 4).
