---
phase: 08-alignment-enums-layout-policy
plan: 01
subsystem: framework-wire + renderer + parity
tags: [alignment, layout, arrange, align, closed-enum, parity, byte-identical]
requires: []
provides:
  - "PageNode/SectionNode arrange?/align? closed-union wire fields (TS) + Arrange/Align [JsonIgnore(WhenWritingNull)] string? (.NET)"
  - "vms-arrange--{value} / vms-align--{value} renderer modifier-class emission in all 5 page/section className builders"
  - "default.css closed-set arrange→justify-content / align→align-items box-alignment rules"
  - "FeatureProbe parity coverage for every arrange/align value + the byte-identical-when-omitted bare row"
affects:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/styles/default.css
  - viewmodel-shell-dotnet/ViewModels.cs
tech-stack:
  added: []
  patterns:
    - "closed-union wire field mirrored as free-form string? on .NET, enforced TS-side + validated by parity"
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
  - "header-bar (ALIGN-04) uses a heading TextNode as first child (NOT PageNode.title/SectionNode.heading) so it participates in the row; the existing title/heading full-width rule is untouched"
  - "no runtime sanitization of the interpolated arrange/align class string (T-08-01 accepted): closed TS union + hostile-server-already-owns-the-tree, consistent with existing vms-page--{layout}/{width} interpolations"
  - "no new parity fixture FILE — the FeatureProbe fixture was widened with static view-shape captured by existing GET steps, so parity/backends.json needs no edit"
metrics:
  duration: ~25m
  completed: 2026-06-24
---

# Phase 8 Plan 01: Alignment Enums (arrange/align) Summary

Adds main-axis (`arrange`) and cross-axis (`align`) closed-enum alignment to the
`row` layout on `PageNode`/`SectionNode` across both backends — wire fields, CSS
box-alignment rules, renderer modifier-class emission, vitest coverage, and a
widened FeatureProbe parity fixture — with the byte-identical-when-omitted
guarantee proven on the wire and in tests.

## What changed

**Task 1 — wire fields (commit `116f73d`)**
- `viewmodel-shell/src/index.ts`: added `arrange?` (`"start"|"center"|"end"|"space-between"|"space-around"|"space-evenly"`) and `align?` (`"start"|"center"|"end"|"stretch"|"baseline"`) closed-union fields to `PageNode` (after `width?`) and `SectionNode` (after `layout?`), with doc-comments in the adjacent `density`/`width` idiom (Jetpack Compose `Arrangement` ∩ Flutter `MainAxisAlignment` for arrange; Flutter `CrossAxisAlignment` for align). `src/server.ts` re-exports automatically — not edited.
- `viewmodel-shell-dotnet/ViewModels.cs`: added `Arrange`/`Align` `[JsonIgnore(WhenWritingNull)] string? = null` trailing params to the `PageNode` (after `Width`) and `SectionNode` (after `Flyout`) records, mirroring the `Layout`/`Width` free-form-string pattern. Trailing optional params → existing positional callers keep compiling.

**Task 2 — renderer emission + CSS (TDD, commit `cedae2e`)**
- `viewmodel-shell/src/browser.ts`: appended `${n.arrange ? \` vms-arrange--${n.arrange}\` : ""}${n.align ? \` vms-align--${n.align}\` : ""}` to the className string in ALL FIVE page/section builders — `page()`, the `collapsible`, `flyout`, `link`, and base-`section` branches — on the same element that carries the `vms-page--{layout}` / `vms-section--{layout}` class. Omitted field emits no token.
- `viewmodel-shell/styles/default.css`: added closed-set rules (`.vms-arrange--*`→`justify-content`, `.vms-align--*`→`align-items`) IMMEDIATELY after the `.vms-page--row`/`.vms-section--row` title/heading full-width rule; the existing row block + title/heading rule are untouched.
- `viewmodel-shell/test/theme-modifiers.test.ts`: new `ALIGN-01/02/03` describe block — presence-when-set for every arrange/align value on both page and section, the byte-identical-when-omitted assertion (bare `row` className `=== "vms-page vms-page--row"` / `"vms-section vms-section--row"` with no `vms-arrange--`/`vms-align--`), and non-base-branch emission (collapsible/flyout/link still carry the classes). RED→GREEN confirmed (25 new cases failed before the renderer change, all green after).

**Task 3 — FeatureProbe + parity fixture (commit `ec2f6b4`)**
- `demo/FeatureProbe-bun/handler.ts` + `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`: byte-identical static `row` sections in `buildVm`/`BuildVm` — a bare row (neither field), the canonical header-bar (`arrange:"space-between"` + heading `TextNode` first child + nested row nav cluster, ALIGN-04), one row per remaining arrange value (`start`/`center`/`end`/`space-around`/`space-evenly`), and one row per align value (`start`/`center`/`end`/`stretch`/`baseline`). Captured by existing GET steps (no new action arm), mirroring the 1.11.0 row precedent.
- `parity/fixtures/feature-probe.json`: `$comment` extended to document the new 1.12.0 static coverage. No new fixture file → `parity/backends.json` unchanged.

Wire spot-check (bun probe GET `/api/probe`): "Bare row" and the header-bar's nested nav cluster carry NEITHER `arrange` nor `align` (omitted = absent), the header-bar carries `arrange:"space-between"`, and each enum value appears on exactly its dedicated section.

## Deviations from Plan

None — plan executed as written, with the two pre-noted corrections applied:
1. The core-globals guard is `viewmodel-shell/scripts/check-core-platform-globals.mjs`; ran it via `npm run check:core-globals` (passes; `index.ts` references zero platform globals).
2. Confirmed exact anchors by reading the files first — the `.NET` SectionNode last param was `Flyout` (1.11.0), so Arrange/Align were appended after it; the `~Lxxx` references were approximate but the structure matched.

Environment note (not a deviation): `dotnet` is installed at `~/.dotnet/dotnet` but not on the non-interactive PATH; prepended `~/.dotnet` to PATH for all `.NET` builds and the parity run (the parity harness invokes `dotnet` directly per `parity/backends.json`).

## Gate Results

| Gate | Result |
|------|--------|
| `cd viewmodel-shell && npx tsc --noEmit` | CLEAN |
| `cd viewmodel-shell && npx vitest run` (full) | 28 files passed · 353 passed / 1 skipped |
| `npm run check:core-globals` | ✓ AGNOSTIC-03: index.ts references zero platform globals |
| `cd viewmodel-shell-dotnet && dotnet build --nologo -v minimal` | Build succeeded · 0 Error(s) |
| `bun run parity/run.ts` | **✓ Parity tests passed** (exit 0) — `feature-probe` byte-identical across dotnet-probe / bun-probe / node-probe, 37 steps each, "✓ all backends agree" |

Parity final verdict line: `✓ Parity tests passed`

## Commits

- `116f73d` feat(08-01): add arrange/align closed-enum wire fields to PageNode/SectionNode
- `cedae2e` feat(08-01): emit vms-arrange--/vms-align-- modifier classes + CSS box-alignment
- `ec2f6b4` test(08-01): widen FeatureProbe both backends + parity fixture for arrange/align

## Out of scope (Plan 08-02, operator-gated)

Version bumps (npm 1.11.0→1.12.0 / NuGet 1.9.0→1.10.0), CHANGELOG, the AGENTS.md Layout-policy section, the Showcase demo entry, npm/NuGet publish, the `v1.12.0` tag, and the `main` advance. NONE were done here.

## Self-Check: PASSED

All 8 modified files exist; all 3 commits (`116f73d`, `cedae2e`, `ec2f6b4`) present in git log.
