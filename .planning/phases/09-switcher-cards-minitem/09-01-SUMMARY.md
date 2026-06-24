---
phase: 09-switcher-cards-minitem
plan: 01
subsystem: framework-wire + renderer + parity
tags: [switcher, layout, threshold, limit, closed-enum, bounded-int, parity, byte-identical]
requires: []
provides:
  - "PageNode/SectionNode layout union gains \"switcher\" (TS) + threshold? (\"sm\"|\"md\"|\"lg\"|\"xl\") + limit? (2..8) closed/bounded wire fields; .NET Threshold string? + Limit int? [JsonIgnore(WhenWritingNull)]"
  - "vms-switch--{threshold} / vms-switch-limit--{limit} renderer modifier-class emission in all 5 page/section className builders"
  - "default.css negative-flex-basis Every-Layout Switcher block (atomic row↔stack flip, zero @media) + 4 threshold-var rules + 7 per-n limit quantity-query rules"
  - "FeatureProbe parity coverage for bare switcher (omitted=absent), every threshold value, and a limit cap — byte-identical across .NET/Bun/Node"
affects:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/styles/default.css
  - viewmodel-shell-dotnet/ViewModels.cs
tech-stack:
  added: []
  patterns:
    - "NEW layout VALUE carrying its own flex CSS block (vs Phase 8's alignment-only knobs) — negative flex-basis for atomic flip, no @media"
    - "closed-union/bounded-int wire field mirrored as free-form string?/int? on .NET, enforced TS-side + validated by parity"
    - "renderer chained-ternary modifier-class emission; omitted field emits no token (byte-identical guarantee)"
key-files:
  created: []
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/styles/default.css
    - viewmodel-shell/test/theme-modifiers.test.ts
    - viewmodel-shell-dotnet/ViewModels.cs
    - demo/FeatureProbe-bun/handler.ts
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - parity/fixtures/feature-probe.json
decisions:
  - "limit is a bounded numeric union 2..8 (TS) / int? (.NET) per P2 (bounded scalar, not raw CSS); the CSS ships one static :nth-last-child quantity-query rule per allowed n"
  - "the switcher flip is the negative-flex-basis calc((var(--vms-switch-threshold,30rem) - 100%) * 999) — clamped to 0 above threshold (one row) / hugely positive below (all stack), no intermediate partial-wrap (the distinction from cards auto-fit)"
  - "no runtime sanitization of the interpolated threshold/limit class string (T-09-01 accepted): closed TS union + bounded int + hostile-server-already-owns-the-tree, consistent with the Phase 8 vms-arrange--/vms-align-- and existing vms-page--{layout}/{width} interpolations"
  - "no new parity fixture FILE — FeatureProbe widened with static view-shape captured by existing GET steps, so parity/backends.json needs no edit"
metrics:
  duration: ~40m
  completed: 2026-06-24
---

# Phase 9 Plan 01: Switcher layout primitive (switcher / threshold / limit) Summary

Adds the `switcher` layout value — the one completeness primitive a grid provably
cannot express: an atomic all-row ↔ all-stack flip via negative `flex-basis`, zero
`@media` — to the `layout` union on `PageNode`/`SectionNode` across both backends,
plus its bounded `threshold` (flip width) and `limit` (max-per-row count cap) wire
fields, the CSS switcher block, renderer modifier-class emission, vitest coverage,
and a widened FeatureProbe parity fixture, with the byte-identical-when-omitted
guarantee proven on the wire and in tests.

## What changed

**Task 1 — wire fields (commit `ef0ad6d`)**
- `viewmodel-shell/src/index.ts`: extended the `layout?` closed union on both
  `PageNode` and `SectionNode` to add `"switcher"`; added `threshold?`
  (`"sm"|"md"|"lg"|"xl"`) + `limit?` (`2|3|4|5|6|7|8`) after `align?` on both,
  doc-commented in the adjacent arrange/align/width idiom (locked size scale
  sm→20rem … xl→48rem; omitted = no class → 30rem default / no cap). `src/server.ts`
  re-exports automatically — not edited.
- `viewmodel-shell-dotnet/ViewModels.cs`: appended `Threshold`
  `[JsonIgnore(WhenWritingNull)] string?` + `Limit` `[JsonIgnore(WhenWritingNull)] int?`
  trailing params after `Align` on both records; added a `"switcher"` note (1.13.0)
  to both `Layout` doc-comments. Trailing optional params → existing positional
  callers keep compiling; Task 3 sets them by NAME.

**Task 2 — renderer emission + CSS (TDD, commit `9f07fc9`)**
- `viewmodel-shell/src/browser.ts`: appended
  `${n.threshold ? \` vms-switch--${n.threshold}\` : ""}${n.limit ? \` vms-switch-limit--${n.limit}\` : ""}`
  to the className string in ALL FIVE page/section builders — `page()`, the
  `collapsible`, `flyout`, `link`, and base-`section` branches — on the same element
  that carries `vms-page--{layout}` / `vms-section--{layout}` (which already emits
  `switcher` via `n.layout !== "stack"`). Omitted field emits no token.
- `viewmodel-shell/styles/default.css`: added the Every-Layout Switcher block
  (`.vms-*--switcher { display:flex; flex-wrap:wrap }` + children
  `flex-grow:1; flex-basis: calc((var(--vms-switch-threshold,30rem) - 100%) * 999)`
  + title/heading `flex:0 0 100%`), the four `.vms-switch--{token}` threshold-var
  rules, and seven per-n `.vms-switch-limit--{n}` quantity-query rules
  (`:nth-last-child(n+{n+1})` → `flex-basis:100%`), inserted between the arrange/align
  rules and the `.vms-section--card` variant. Sidebar/row/arrange/align untouched.
- `viewmodel-shell/test/theme-modifiers.test.ts`: new `SWITCH-01/02` describe block —
  presence-when-set for every threshold + limit value on both page and section, the
  exact byte-identical-when-omitted assertions (bare switcher className
  `=== "vms-page vms-page--switcher"` / `"vms-section vms-section--switcher"` with no
  `vms-switch--`/`vms-switch-limit--`), and non-base-branch emission
  (collapsible/flyout still carry the classes). RED→GREEN confirmed (16 new cases
  failed before the renderer change, all 84 green after).

**Task 3 — FeatureProbe + parity fixture (commit `be283f5`)**
- `demo/FeatureProbe-bun/handler.ts` + `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`:
  byte-identical static `switcher` sections in `buildVm`/`BuildVm` — a bare switcher
  (neither field, 3 children), one switcher per threshold value (`sm`/`md`/`lg`/`xl`,
  3 children each, built via a `["sm","md","lg","xl"]` map), and one with `limit:4`
  + 6 children. Appended to the page children after the align sections, before the
  table section. Captured by existing GET steps (no new action arm).
- `parity/fixtures/feature-probe.json`: `$comment` extended to document the new 1.13.0
  static switcher coverage. No new fixture file → `parity/backends.json` unchanged.

Wire spot-check (bun probe GET `/api/probe`): "Bare switcher" carries NEITHER
`threshold` nor `limit` (omitted = absent), each `switcher {token}` carries exactly
its `threshold` (limit absent), and `switcher limit` carries `limit:4` (threshold
absent) with 6 children — confirming the byte-identical-when-omitted property on the
actual wire.

## Deviations from Plan

None — plan executed as written. Environment note (not a deviation): `dotnet` is at
`~/.dotnet/dotnet`, not on the non-interactive PATH; prepended `~/.dotnet` to PATH for
all .NET builds and the parity run (the parity harness invokes `dotnet` directly per
`parity/backends.json`). A NuGet vulnerability-data network lookup (NU1900 warning,
network unreachable) slows the .NET build but is benign — 0 errors.

## Gate Results

| Gate | Result |
|------|--------|
| `cd viewmodel-shell && npx tsc --noEmit` | CLEAN (TSC_OK) |
| `cd viewmodel-shell && npx vitest run` (full) | 28 files passed · 372 passed / 1 skipped (373) |
| `npm run check:core-globals` | ✓ AGNOSTIC-03: index.ts references zero platform globals |
| `cd viewmodel-shell-dotnet && dotnet build --nologo -v minimal` | Build succeeded · 0 Error(s) |
| `bun run parity/run.ts` | **✓ Parity tests passed** — `feature-probe` byte-identical across dotnet-probe / bun-probe / node-probe, 37 steps each, "✓ all backends agree" |

Parity final verdict line: `✓ Parity tests passed`

## Commits

- `ef0ad6d` feat(09-01): add switcher layout value + threshold/limit wire fields to PageNode/SectionNode
- `9f07fc9` feat(09-01): emit vms-switch--/vms-switch-limit-- classes + negative-flex-basis switcher CSS
- `be283f5` test(09-01): widen FeatureProbe both backends + parity fixture for switcher/threshold/limit

## Out of scope (release DEFERRED to Phase 11)

NO version bump (npm stays 1.11.0, NuGet stays 1.9.0), NO publish, NO tag. CHANGELOG
accumulation under the existing `## Unreleased` heading, the AGENTS.md Layout-policy
`switcher` "shipped" update, the Showcase demo entries, and the `cards` `minItem` field
(GRID-01) are separate plans (09-02 / later). NONE were done here.

## Self-Check: PASSED

All 8 modified files exist; all 3 commits (`ef0ad6d`, `9f07fc9`, `be283f5`) present in
git log. Version files confirmed unbumped.
