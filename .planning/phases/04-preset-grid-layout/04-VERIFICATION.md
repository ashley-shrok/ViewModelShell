---
phase: 04-preset-grid-layout
verified: 2026-05-17T22:05:00Z
status: passed
score: 18/18 must-haves verified
overrides_applied: 0
---

# Phase 4: Preset-Grid Layout Verification Report

**Phase Goal:** `page` and `section` accept one optional layout-preset enum that arranges their direct children; the default value renders byte-identically to today's vertical stack (non-breaking, no new node types), the preset is the only layout field on the wire, and it round-trips identically across the .NET and TS backends with a new parity fixture covering it.
**Verified:** 2026-05-17T22:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Merged from ROADMAP Success Criteria (5, the non-negotiable contract) + PLAN frontmatter must-haves (4 plans).

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | (SC1/LAYOUT-01) Omitted/defaulted layout renders byte-identically — no new node types, existing apps unchanged | ✓ VERIFIED | `browser.ts:196-197,210-211` closed guard `n.layout === "split" \|\| n.layout === "cards"` appended AFTER density/variant; jsdom tests `theme-modifiers.test.ts:85-90,105-110` assert `className === "vms-page"`/`"vms-section"` for both omitted AND `"stack"`; 7 pre-existing parity fixtures green (author no layout → wire byte-unchanged); no new node interfaces added |
| 2  | (SC2/LAYOUT-02) "split" preset = columns wide, collapses stacked narrow, no app breakpoints | ✓ VERIFIED | `default.css:139-152` `.vms-page--split`/`.vms-section--split` use `repeat(auto-fit, minmax(max(16rem, calc(50% - var(--vms-space-{lg,sm}))), 1fr))` capped-2-then-1; zero `@media` (grep count 0); heading-exclusion `grid-column: 1 / -1` present. Visual exactly-2-then-1 geometry = RESEARCH A2 accepted Phase-5 eyeball, not a phase-4 gap |
| 3  | (SC3/LAYOUT-03) "cards" preset = auto-fit from single min-item-width, collapses to 1 column | ✓ VERIFIED | `default.css:60` `--vms-card-min: 16rem` in `:root` beside `--vms-page-max`; `default.css:123-126` cards rule `repeat(auto-fit, minmax(min(var(--vms-card-min), 100%), 1fr))`; zero media queries; heading-exclusion present |
| 4  | (SC4/LAYOUT-04) Wire carries ONLY the layout-preset enum — no spans/tracks/named areas | ✓ VERIFIED | `index.ts:65,75` PageNode/SectionNode have only `layout?: "stack" \| "split" \| "cards"` (closed union, no spans/tracks/areas); `ViewModels.cs:103,110` only `string? Layout = null`; geometry (`--vms-card-min`, column count) lives entirely in CSS, never on the wire |
| 5  | (SC5/LAYOUT-05) Field present in index.ts, server.ts, shared .NET source, parity fixture, .NET/Bun/Node byte-identical | ✓ VERIFIED | index.ts (both nodes), server.ts via `export * from "./index.js"` line 13 (NOT edited — D-03), single shared `viewmodel-shell-dotnet/ViewModels.cs` (D-10 — no demo/**/ViewModels.cs exist), FeatureProbe widened. **Parity harness: feature-probe `dotnet-probe`/`bun-probe`/`node-probe` 15 steps each, `✓ all backends agree`, `✓ Parity tests passed`, exit 0** |
| 6  | (Plan01) TS PageNode/SectionNode accept `layout?: "stack" \| "split" \| "cards"` | ✓ VERIFIED | `index.ts:65` and `:75` — exactly twice, JSDoc references `.vms-page--split`/`--cards` and `.vms-section--split`/`--cards`; tsc --noEmit exit 0 |
| 7  | (Plan01) .NET records accept `string? Layout = null` | ✓ VERIFIED | `ViewModels.cs:103` (PageNode) and `:110` (SectionNode) — trailing positional param after Density/Variant; .NET builds clean in parity prebuild |
| 8  | (Plan01) layout field reachable from server.ts via re-export, no server.ts edit | ✓ VERIFIED | `server.ts:13` `export * from "./index.js"` intact; server.ts NOT in phase diff (`git diff 1213f69 HEAD`) |
| 9  | (Plan01) No layout field other than the single closed-union string crosses the wire | ✓ VERIFIED | grep confirms only PageNode/SectionNode gained layout; no other node interface; no spans/tracks/areas anywhere |
| 10 | (Plan02) layout:split emits `.vms-page--split`/`.vms-section--split` | ✓ VERIFIED | jsdom tests pass: `theme-modifiers.test.ts:75-78,95-98`; renderer guard verified |
| 11 | (Plan02) layout:cards emits `.vms-page--cards`/`.vms-section--cards` | ✓ VERIFIED | jsdom tests pass: `theme-modifiers.test.ts:80-82,100-102`; renderer guard verified |
| 12 | (Plan02) omitted AND "stack" emit ZERO modifier (byte-identical) | ✓ VERIFIED | `theme-modifiers.test.ts:85-90,105-110` `.toBe("vms-page")`/`.toBe("vms-section")`; all 31 vitest tests pass |
| 13 | (Plan02) split = exactly-2-then-1, zero media queries | ✓ VERIFIED | capped `max(16rem, calc(50% - gap))` floor `default.css:142,147`; `@media` count 0; (visual = A2 Phase-5 human item) |
| 14 | (Plan02) cards = auto-fit from single `--vms-card-min`, zero media queries | ✓ VERIFIED | `default.css:60,126`; `@media`/`container-type` count 0 |
| 15 | (Plan02) page/section heading spans all columns under split/cards | ✓ VERIFIED | `default.css:128-130,149-151` `grid-column: 1 / -1` for both presets, both heading selectors (Pitfall 2 CSS-only fix, no DOM restructure) |
| 16 | (Plan03) FeatureProbe TS + .NET emit IDENTICAL VM exercising layout(cards page/split section)+density compact+variant card | ✓ VERIFIED | `handler.ts:36-49` and `FeatureProbeController.cs:100-101` mirror exactly; parity `✓ all backends agree` |
| 17 | (Plan03) Cross-backend parity green + existing 7 fixtures green; D-05 deferral closed | ✓ VERIFIED | parity exit 0; all of tasks/contacts/retro/expenses/helpdesk/reorder/feature-probe show `✓ all backends agree` |
| 18 | (Plan04) AGENTS.md node + CSS-class tables accurately document the layout field/classes, accurate-only | ✓ VERIFIED | `git diff` AGENTS.md = exactly 4 table rows; layout closed-union + 4 CSS classes added; density/variant clauses preserved; no version string change |

**Score:** 18/18 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `viewmodel-shell/src/index.ts` | layout? closed-union on PageNode + SectionNode | ✓ VERIFIED | Lines 65, 75 — exact `layout?: "stack" \| "split" \| "cards"` ×2; wired (re-exported by server.ts, consumed by browser.ts + test) |
| `viewmodel-shell-dotnet/ViewModels.cs` | string? Layout = null on both records | ✓ VERIFIED | Lines 103, 110 — trailing optional param; single shared source; consumed by FeatureProbeController |
| `viewmodel-shell/src/server.ts` | re-export only, NO edit (D-03) | ✓ VERIFIED | Line 13 `export * from "./index.js"` intact; not in phase diff |
| `viewmodel-shell/src/browser.ts` | layout modifier emission via closed equality guard | ✓ VERIFIED | Lines 196-197, 210-211 — closed two-literal guard ×2, no open-interpolation form |
| `viewmodel-shell/styles/default.css` | --vms-card-min + 4 modifier rules + 2 heading rules, zero media queries | ✓ VERIFIED | +37/-0 purely additive; line 60 var, 123-152 presets; `@media`/`container-type` count 0; no theme files touched |
| `viewmodel-shell/test/theme-modifiers.test.ts` | jsdom class-emission + byte-identity tests | ✓ VERIFIED | 2 new describe blocks (lines 74-111); existing THEME-03/04 + helpers intact; 13/13 theme-modifiers, 31/31 total pass |
| `demo/FeatureProbe-bun/handler.ts` | buildVm widened with section(card/split) in page(compact/cards) | ✓ VERIFIED | Lines 36-49; not server.ts/server-node.ts (Pitfall 3); no "stack" (Pitfall 1) |
| `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` | BuildVm byte-identical .NET mirror | ✓ VERIFIED | Lines 100-101; SectionNode(Variant:card,Layout:split) in PageNode(Density:compact,Layout:cards) |
| `AGENTS.md` | node table + CSS-class table rows for layout | ✓ VERIFIED | Exactly 4 rows changed, accurate-only, no version churn |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| server.ts | index.ts | `export * from "./index.js"` line 13 | ✓ WIRED | Re-export intact, no server.ts edit (D-03) |
| browser.ts page()/section() | .vms-{page,section}--{split,cards} CSS | className template literal, split/cards only | ✓ WIRED | Closed guard interpolates only whitelisted literals; CSS rules present |
| .vms-{page,section}--split CSS | exactly-2-then-1 track sizing, zero media | `repeat(auto-fit, minmax(max(16rem, calc(50% - gap)), 1fr))` | ✓ WIRED | Math present; visual geometry = A2 Phase-5 eyeball |
| handler.ts buildVm() | FeatureProbeController.cs BuildVm() | byte-identical VM across backends | ✓ WIRED | Parity proves `✓ all backends agree` for feature-probe ×3 backends |
| buildVm()/BuildVm() widened VM | parity cross-backend diff | existing fixture steps re-call builder | ✓ WIRED | No structural fixture/backends.json/run.ts/normalize.ts edit; 15 steps ×3 backends |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| browser.ts page()/section() | `n.layout` | deserialized PageNode/SectionNode from wire | Yes — FeatureProbe emits real `cards`/`split` values; renderer reflects them into className | ✓ FLOWING |
| FeatureProbe VM | layout/density/variant literals | static author-chosen literals in buildVm/BuildVm (parity probe, by design) | Yes — appear in every diffed parity response | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| jsdom class-emission + byte-identity suite | `npx vitest run` (viewmodel-shell) | 31/31 pass (4 files, theme-modifiers 13/13) | ✓ PASS |
| TypeScript typecheck | `tsc --noEmit -p tsconfig.json` | exit 0 | ✓ PASS |
| Cross-backend parity (LAYOUT-05 + LAYOUT-01 regression) | `bun run run.ts` (parity) | feature-probe dotnet/bun/node 15 steps each `✓ all backends agree`; all 7 fixtures green; `✓ Parity tests passed`; exit 0 | ✓ PASS |
| No "stack" literal in demo builders (Pitfall 1) | grep `"stack"` in demo/ | 0 matches | ✓ PASS |
| Zero @media / container-type (D-07) | grep in default.css | 0 / 0 | ✓ PASS |
| No version bump (D-11) | git diff 1213f69 HEAD on *.csproj/package.json/AGENTS.md | no version strings changed | ✓ PASS |

Note on parity environment: the harness initially failed in the serial **prebuild/cleanup stage** (before any wire diff) due to stale orphaned demo backend `.exe` processes from prior interrupted runs holding Windows file locks on `AshleyShrok.ViewModelShell.dll` (`ViewModelShell`, `Reorder`, `RetroBoard`, `HelpDesk`, `ContactManager`, `ExpenseTracker`). This is the exact environmental issue documented in 04-03-SUMMARY "Issues Encountered" — never caused by this phase's edits; the shared .NET library compiled cleanly on every attempt. Resolved by terminating the orphaned processes and removing the stale `helpdesk-parity-bun.db`, after which the harness ran fully green (exit 0).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LAYOUT-01 | 04-02, 04-03 | Optional layout-preset; default renders identically to vertical-stack, non-breaking, no new node types | ✓ SATISFIED | Closed guard + jsdom byte-identity tests + 7 existing parity fixtures byte-unchanged green |
| LAYOUT-02 | 04-02 | "split" preset: columns wide, collapses stacked narrow, no app breakpoints | ✓ SATISFIED | Capped-2-then-1 Grid CSS, zero media queries (visual geometry = A2 Phase-5 human eyeball) |
| LAYOUT-03 | 04-02 | "cards" preset: auto-fit from single min-item-width, collapses to 1 column | ✓ SATISFIED | `repeat(auto-fit, minmax(min(--vms-card-min,100%),1fr))`, zero media queries |
| LAYOUT-04 | 04-01 | Preset is the ONLY layout field on the wire — no spans/tracks/areas | ✓ SATISFIED | Single closed-union string on PageNode/SectionNode only; geometry CSS-only |
| LAYOUT-05 | 04-01, 04-03, 04-04 | Round-trips identically .NET+TS, present index.ts/server.ts/shared .NET source/parity fixture/docs | ✓ SATISFIED | Parity 3-backend byte-identity proven; field in all required surfaces; AGENTS.md documented |

All 5 LAYOUT requirement IDs from plan frontmatter accounted for. REQUIREMENTS.md maps exactly LAYOUT-01..05 to Phase 4 — no orphaned requirements (every Phase-4-mapped ID appears in a plan's `requirements` field and is verified). Out-of-Scope "Spatial layout utilities" honored: no column spans / track templates / named areas / m-*/p-* utilities anywhere.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No TODO/FIXME/placeholder/empty-impl/stub patterns in modified source. Independent 04-REVIEW.md: 0 critical, 0 warning, 3 info (all no-action). |

### Human Verification Required

None blocking. One documented, accepted in-research limitation (RESEARCH A2 — NOT a phase-4 gap):

- **Phase-5 visual eyeball:** The split/cards preset *visual* geometry (split renders exactly-2-then-1 equal columns; cards auto-fits without overflow) has no jsdom test surface — jsdom has no layout engine. The CSS math is sound and uses only Baseline features; class emission and wire round-trip ARE fully tested here. Per RESEARCH A2 and the Phase-3 precedent ("CSS layout has no parity surface"), this is an accepted Phase-5 Showcase visual sanity check, explicitly NOT a Phase-4 blocking gap. Recorded for Phase 5, does not affect this phase's status.

### Gaps Summary

No gaps. All 18 must-haves (5 ROADMAP success criteria + 13 plan-specific truths) verified against the actual codebase, not summary claims. Independently confirmed: TS/.NET closed-union contract present on both nodes; server.ts untouched (re-export); renderer closed two-literal guard ×2 with no open-interpolation form; omitted/"stack" byte-identical (jsdom 31/31 green); pure-CSS split (capped-2-then-1) + cards (auto-fit) + `--vms-card-min` + heading-exclusion with zero `@media`/`container-type` and zero theme-file/`:root`-existing-line edits; FeatureProbe widened identically on both backends with no "stack" (Pitfall 1) and no parity-harness structural edits; full cross-backend parity green (feature-probe ×3 backends 15 steps `✓ all backends agree`, all 7 fixtures green, exit 0) proving LAYOUT-05 round-trip and LAYOUT-01 regression; AGENTS.md accurate-only 4-row update; no version bump anywhere (D-11). All 5 LAYOUT requirements satisfied; Out-of-Scope spatial utilities honored.

---

_Verified: 2026-05-17T22:05:00Z_
_Verifier: Claude (gsd-verifier)_
