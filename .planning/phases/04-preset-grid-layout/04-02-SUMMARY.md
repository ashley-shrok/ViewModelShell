---
phase: 04-preset-grid-layout
plan: 02
subsystem: renderer-css-emission
tags: [layout, css-grid, bem-modifier, zero-media-query, jsdom, intrinsic-responsive]
dependency_graph:
  requires:
    - "04-01 PageNode.layout? / SectionNode.layout? closed-union (index.ts) — the field this plan consumes"
    - "Phase 3 density?/variant? class-emission idiom (browser.ts) + theme-modifiers.test.ts jsdom harness"
  provides:
    - "Renderer emission: .vms-{page,section}--split / --cards via closed two-literal equality guard (LAYOUT-01/02/03)"
    - "default.css --vms-card-min :root var + split (capped-2-then-1) + cards (auto-fit) + heading-exclusion rules, zero media queries"
    - "jsdom class-emission + byte-identity tests for layout (page + section), 13/13 theme-modifiers green"
  affects:
    - "Wave 2 parity fixture (04-03 feature-probe) — exercises layout cross-backend over this emission"
    - "Phase 5 Showcase — eyeballs split/cards visual correctness (A2; jsdom has no layout engine — accepted, not a gap)"
    - "AGENTS.md node/CSS tables (04-04) — documents the .vms-{page,section}--split/--cards classes this plan emits"
tech_stack:
  added: []
  patterns:
    - "BEM modifier appended AFTER density/variant in template literal (preserves omitted/stack byte-identity)"
    - "Closed two-literal equality guard (n.layout === split || cards) — class-injection mitigation, never open interpolation"
    - "Capped auto-fit Grid: minmax(max(16rem, calc(50% - gap)), 1fr) — exactly-2-then-1, zero media queries"
    - "grid-column: 1 / -1 heading-exclusion — CSS-only Pitfall 2 fix, no DOM restructure"
key_files:
  created:
    - .planning/phases/04-preset-grid-layout/04-02-SUMMARY.md
  modified:
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/styles/default.css
    - viewmodel-shell/test/theme-modifiers.test.ts
decisions:
  - "D-02 honored: closed two-literal guard `n.layout === \"split\" || n.layout === \"cards\"` (exactly 2x); layout modifier appended AFTER density/variant so omitted/\"stack\" => className byte-identical (LAYOUT-01)"
  - "D-04/D-05 honored: --vms-card-min: 16rem added additively to :root beside --vms-page-max; cards = repeat(auto-fit, minmax(min(var(--vms-card-min),100%),1fr))"
  - "D-06/D-07 honored: split = capped max(16rem, calc(50% - gap)) floor → exactly-2-then-1 equal-width; ZERO @media in default.css (count = 0)"
  - "Open Question 1 resolved: referenced existing per-container space token (--vms-space-lg page / --vms-space-sm section) in the split calc — no new --vms-split-* knob; page/section split rules differ only by selector (D-01)"
  - "Pitfall 2 honored: grid-column: 1 / -1 heading-exclusion (CSS-only); no .vms-page__content wrapper, no DOM restructure (LAYOUT-01 byte-identity preserved)"
  - "D-11 honored: zero version bump (no package.json / .csproj change)"
metrics:
  duration: 3min
  tasks: 2
  files: 3
  completed: 2026-05-18
---

# Phase 4 Plan 02: Layout Renderer Emission + CSS Presets Summary

Made the `layout` field do something: the renderer now emits `.vms-{page|section}--split` / `--cards` ONLY for `"split"`/`"cards"` via a closed two-literal equality guard (omitted AND `"stack"` stay byte-identical to pre-change, LAYOUT-01), and `default.css` gained the additive `--vms-card-min` `:root` var plus the pure-CSS capped-2-then-1 `split` and auto-fit `cards` presets with heading-exclusion — all with ZERO media queries. jsdom class-emission + byte-identity tests mirror the Phase 3 density/variant pattern; full theme-modifiers suite 13/13 green.

## What Was Built

This plan delivers the actual layout behavior on the contract Plan 01 established. CSS *visual* correctness has no automated test surface (jsdom has no layout engine — a known, accepted limitation eyeballed in the Phase 5 Showcase, A2); jsdom here proves class emission + byte-identity only.

### Task 1 (TDD) — Renderer emission + jsdom tests (`browser.ts`, `theme-modifiers.test.ts`)

- **RED:** Appended two new describe blocks to `theme-modifiers.test.ts` ("LAYOUT-02/03 — page …" and "… section layout preset modifier emission") AFTER the existing THEME-03/THEME-04 blocks, mirroring the verified density/variant shape verbatim and reusing the existing `renderPage`/`renderSection`/`freshContainer` helpers (extended, not re-authored). Ran vitest: the 4 new split/cards class-presence tests failed (renderer not yet emitting); the byte-identity tests already passed (no modifier emitted yet); the 9 existing density/variant tests stayed green. Commit `4b96335`.
- **GREEN:** Extended the className template literal in `page()` (line 196) and `section()` (line 209), appending the layout modifier AFTER the existing density/variant modifier using the exact RESEARCH Pattern 2 expression: `${n.layout === "split" || n.layout === "cards" ? \` vms-page--${n.layout}\` : ""}` (and the section equivalent). The closed two-literal equality guard is the T-04-01 security mitigation — only the two literal values can ever be interpolated into `className`; `"stack"`, `undefined`, and any other value emit the empty string. Ran `tsc --noEmit` (exit 0) and vitest (13/13 pass — 9 existing + 4 new). Commit `e5e5a7a`.
- No REFACTOR step needed — the change is minimal and idiomatic (matches the shipped density/variant idiom exactly).

### Task 2 — `--vms-card-min` + split/cards CSS + heading-exclusion (`default.css`)

Three purely additive edits (37 insertions, 0 deletions):
- **EDIT 1:** Added `--vms-card-min: 16rem;` to `:root` immediately after the existing `--vms-page-max: 1080px;` (line 58), with an additive-seam comment. No other `:root` line touched (THEME-05 / Pitfall 5 held).
- **EDIT 2 (cards):** `.vms-page--cards, .vms-section--cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(var(--vms-card-min), 100%), 1fr)); }` (RESEARCH "Code Examples" verbatim) + the `grid-column: 1 / -1` heading-exclusion pair. `min(...,100%)` floor prevents single-column overflow (Pitfall 4); `gap` inherited, NOT redeclared.
- **EDIT 3 (split):** Separate `.vms-page--split` and `.vms-section--split` rules (they differ only by the per-container gap token — `--vms-space-lg` for page, `--vms-space-sm` for section — acceptable per D-01 "CSS differs only by selector") using the DEFINITIVE capped form `repeat(auto-fit, minmax(max(16rem, calc(50% - var(--vms-space-*))), 1fr))` → exactly-2-then-1, equal-width via shared `1fr` max, zero media queries. Plus the `grid-column: 1 / -1` heading-exclusion pair.
- Verification: vitest 13/13 still pass (no jsdom CSS surface — confirms no regression). Commit `cb97ebb`.

## Verification Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` in `viewmodel-shell` | Exit 0 (clean) |
| `npx vitest run test/theme-modifiers.test.ts` | 13/13 pass (9 existing density/variant + 4 new layout) |
| RED proven before GREEN | Yes — 4 new tests failed pre-implementation, 9 existing stayed green |
| `n.layout === "split" \|\| n.layout === "cards"` in `browser.ts` | Exactly 2 (page line 197, section line 211) |
| Open-interpolation `n.layout ?` form in `browser.ts` | None (grep returns no matches) |
| `vms-page--split`/`--cards`, `vms-section--split`/`--cards` in test file | All 4 present + byte-identity `.toBe("vms-page")`/`.toBe("vms-section")` for omitted+"stack" |
| Existing THEME-03/04 blocks + helpers | Present and unmodified (file extended, not rewritten) |
| `@media` count in `default.css` | 0 (D-07 held) |
| `container-type` count in `default.css` | 0 |
| `--vms-card-min` declaration in `:root` | Exactly 1 declaration (+ 1 consuming reference in cards rule) |
| Required CSS substrings | All present (cards minmax, split calc(50% - lg)/(sm), 2× grid-column: 1 / -1) |
| `default.css` git diff | 37 insertions, 0 deletions — purely additive |
| Any `viewmodel-shell/styles/themes/` file changed | None (THEME-05 seam intact) |
| `package.json` / `.csproj` version changed | None (D-11) |

## Deviations from Plan

None — plan executed exactly as written. No Rule 1–4 deviations; the plan's `<action>` blocks contained the exact CSS rules and className expressions, applied verbatim.

**Worktree base correction (pre-execution, not a plan deviation):** On entry the worktree branch was based on `f057cd6` rather than the required phase HEAD `325fe1d`. Per the worktree-branch-check protocol, `git reset --hard 325fe1d8b840387671c05e1d283d3fbb55f19590` was applied (working tree was clean — no changes lost). `325fe1d` contains 04-01's `layout?` field, confirmed present in `index.ts` lines 65/75 before any work began, so the TDD test nodes typecheck and the renderer guard compiles.

**Resolved Open Question (RESEARCH OQ-1, within bounded discretion):** The split floor references the existing per-container space token (`--vms-space-lg` / `--vms-space-sm`) directly in the `calc(50% - gap)` term rather than introducing a new `--vms-split-gap`/`--vms-split-min` knob — fewer override knobs, closest to D-01. This is the RESEARCH-recommended option, not a plan change.

## Authentication Gates

None.

## Threat Surface

The plan's threat register assigns `mitigate` to **T-04-01** (class-name reflection via the renderer template literal). The mitigation is implemented exactly as the register requires: the interpolation is gated by the CLOSED two-literal equality check `n.layout === "split" || n.layout === "cards"` — only `vms-{page,section}--split` / `--cards` can ever reach `className`; `"stack"`, `undefined`, or any malformed runtime value yields the empty string. The open-interpolation anti-pattern is verified absent (grep: no `n.layout ?` form). **T-04-02** (`default.css` modifier rules) is `accept` and held: every CSS value is a static author-written constant (`16rem`, `calc(50% - var(--vms-space-lg))`, `repeat(auto-fit, …)`) — no data path into the stylesheet. **T-04-03** (DoS on adversarial child counts) is `accept`: grid reflow is bounded by the browser's existing layout engine, same children already render under flex-column today. No new network/file/exec/parse surface introduced — no Threat Flags.

## Known Stubs

None. The renderer emission is fully wired (real `n.layout` → real modifier class) and the CSS rules are complete, functional presets — not placeholders. The split/cards *visual* correctness having no jsdom test is a documented, accepted limitation (jsdom has no layout engine; eyeballed in Phase 5 Showcase per RESEARCH A2), explicitly NOT a stub or a gap to plan around — it is the established Phase 3 precedent ("CSS layout has no parity surface").

## Self-Check: PASSED

- FOUND: .planning/phases/04-preset-grid-layout/04-02-SUMMARY.md
- FOUND: viewmodel-shell/src/browser.ts (modified — closed guard ×2)
- FOUND: viewmodel-shell/styles/default.css (modified — +37/-0, --vms-card-min + split/cards)
- FOUND: viewmodel-shell/test/theme-modifiers.test.ts (modified — +40, 2 new describe blocks)
- FOUND commit: 4b96335 (test 04-02 — RED layout tests)
- FOUND commit: e5e5a7a (feat 04-02 — GREEN renderer emission)
- FOUND commit: cb97ebb (feat 04-02 — CSS presets)
