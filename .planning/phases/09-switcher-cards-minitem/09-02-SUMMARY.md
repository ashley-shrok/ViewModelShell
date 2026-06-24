---
phase: 09-switcher-cards-minitem
plan: 02
subsystem: framework-wire + renderer + parity + demo + docs
tags: [cards, minItem, grid, closed-enum, parity, byte-identical, showcase, changelog, switcher-shipped]
requires:
  - "09-01 (switcher/threshold/limit landed; minItem added alongside, same files)"
provides:
  - "PageNode/SectionNode gain minItem? (\"xs\"|\"sm\"|\"md\"|\"lg\"|\"xl\") closed-union wire field (TS) + .NET string? MinItem [JsonIgnore(WhenWritingNull)]"
  - "vms-cards-min--{minItem} renderer modifier-class emission in all 5 page/section className builders"
  - "default.css five .vms-cards-min--{token} rules setting --vms-card-min (10/13/16/20/24rem); auto-fit cards rule untouched"
  - "FeatureProbe parity coverage for a section-level bare cards (omitted=absent) + every minItem value — byte-identical across .NET/Bun/Node"
  - "Showcase switcher atomic-flip demo + cards minItem width matrix (zero <style>)"
  - "AGENTS.md Layout policy marks switcher shipped (forward-reference dropped)"
  - "CHANGELOG ### Switcher + cards minItem — Phase 9 subsection under ## Unreleased (no version bump)"
affects:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/styles/default.css
  - viewmodel-shell-dotnet/ViewModels.cs
  - demo/Showcase/frontend/src/main.ts
tech-stack:
  added: []
  patterns:
    - "promote a CSS-only token (--vms-card-min, the D-05 seam) to a declared bounded wire field via a modifier class that sets the existing variable — auto-fit rule reads it unchanged"
    - "closed-union wire field mirrored as free-form string? on .NET, enforced TS-side + validated by parity"
    - "renderer chained-ternary modifier-class emission; omitted field emits no token (byte-identical guarantee)"
    - "named-arg .NET FeatureProbe sections + as-const TS map for byte-identical cross-backend matrices"
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
    - demo/Showcase/frontend/src/main.ts
    - AGENTS.md
    - CHANGELOG.md
decisions:
  - "minItem placed after limit on both PageNode/SectionNode (TS) and both .NET records, following the 09-01 ordering convention"
  - "the five .vms-cards-min--{token} rules placed immediately after the cards auto-fit title rule (~L161) — near the cards rules where they belong; the auto-fit .vms-page--cards/.vms-section--cards rule itself is untouched"
  - "FeatureProbe adds a dedicated SECTION-level bare cards section to prove omitted=absent at the section level even though the page root is already layout:cards"
  - "Showcase demos built from nested variant:card sections (not bespoke cards) so they are zero-<style> ViewNodes only"
  - "RELEASE DEFERRED to Phase 11: versions stay at npm 1.11.0 / NuGet 1.9.0; CHANGELOG note under ## Unreleased, no ## 1.13.0 heading, no publish/tag"
metrics:
  duration: ~12 min
  tasks: 2
  files: 11
  completed: 2026-06-24
---

# Phase 9 Plan 02: Cards minItem Wire Field + Showcase/Docs Close-out Summary

Promoted the CSS-only `--vms-card-min` token to an explicit bounded `minItem` wire field (`xs|sm|md|lg|xl` → 10/13/16/20/24rem) on `cards` across both backends with renderer emission, CSS, unit tests, and byte-identical parity — then closed out the phase's non-code deliverables (Showcase switcher + minItem demos, AGENTS.md marking `switcher` shipped, CHANGELOG Phase-9 subsection under `## Unreleased`).

## What was built

**Task 1 — `cards` minItem (GRID-01/02), commit `136ff92`:**
- `minItem?: "xs"|"sm"|"md"|"lg"|"xl"` added to `PageNode` + `SectionNode` (TS, after `limit?`); `[JsonIgnore(WhenWritingNull)] string? MinItem = null` added to both .NET records (after `Limit`).
- Renderer emits ` vms-cards-min--${n.minItem}` in all 5 page/section className builders (page, collapsible, flyout, link, base section), appended after the `limit` ternary.
- `default.css`: five `.vms-cards-min--{token}` rules setting `--vms-card-min`; the auto-fit `.vms-page--cards`/`.vms-section--cards` rule reads it unchanged, so omitted `minItem` = 16rem default = byte-identical.
- `theme-modifiers.test.ts` GRID-01 block: per-value emission on page+section, exact byte-identical-when-omitted (`className === "vms-page vms-page--cards"` / `"vms-section vms-section--cards"`), collapsible + flyout branch coverage.
- FeatureProbe both backends: a section-level bare `cards` section (proves omitted=absent) + one section per `minItem` value; parity `$comment` extended.

**Task 2 — demos + docs, commit `678ada5`:**
- Showcase: a `switcher` atomic-flip section (~4 equal `variant:card` cells in one row → all stack on resize, plus a `threshold:"sm"` variant) and a `cards`/`minItem` matrix (`sm`/`md`/`xl` side-by-side, 6 cells each), zero `<style>`, ViewNodes only.
- AGENTS.md Layout policy: "VMS ships `sidebar`; `switcher` arrives in Phase 9…" → "VMS ships both `sidebar` and `switcher`." (concern→source convention preserved; token scales NOT enumerated).
- CHANGELOG: `### Switcher + cards minItem — Phase 9 (on `main`, unpublished)` subsection under the existing `## Unreleased` heading, mirroring the Phase-8 Added/Not-changed/Demo+tests/Migration structure, covering both the switcher (Wave 1) and cards minItem changes.

## Verification (all green)

| Gate | Result |
|------|--------|
| `viewmodel-shell` tsc --noEmit | clean |
| `viewmodel-shell` vitest run | 387 passed / 1 skipped (388) |
| `npm run check:core-globals` | ✓ AGNOSTIC-03 zero platform globals |
| `node scripts/check-aa-contrast.mjs` | ✓ D-07 all 13 pairs WCAG-AA |
| `node scripts/check-no-demo-style.mjs` | ✓ D-12/D-15 Showcase `.vms-*`-only, zero `<style>` |
| Showcase frontend | `vite build` clean; tsc = 12 PRE-EXISTING `?inline` theme errors, **ZERO new** (stash-compare confirmed 12→12) |
| `viewmodel-shell-dotnet` dotnet build | Build succeeded, 0 Error(s) |
| `bun run parity/run.ts` | **byte-identical green** — `feature-probe` across 3 backends: all backends agree; Parity tests passed |

**Parity verdict:** `feature-probe` across 3 backends (.NET / Bun / Node) — **all backends agree; byte-identical green**. The new `cards` minItem sections (bare + per-value) serialize identically; omitted `minItem` is ABSENT on the wire. (The "deliberate test failure" line in parity output is the intentional uncaught-exception envelope fixture arm, not a regression.)

**Byte-identical-when-omitted:** confirmed by the theme-modifiers exact-equality tests (a bare `cards` page/section emits exactly `vms-page vms-page--cards` / `vms-section vms-section--cards`, no `vms-cards-min--`) and the section-level bare-cards parity fixture (16rem `--vms-card-min` default holds; auto-fit rule untouched).

## Deviations from Plan

None — plan executed exactly as written. No package installs (pure source + doc edits). T-09-SC mitigation (no installs) satisfied by construction.

## Release status (DEFERRED to Phase 11)

Versions UNCHANGED: **npm 1.11.0 / NuGet 1.9.0**. No `## 1.13.0` released heading; notes accumulate under `## Unreleased`. No publish, no tag. The consolidated bump+publish is Phase 11.

## Self-Check: PASSED

- Commits `136ff92` (feat) and `678ada5` (docs) both present in `git log`.
- All referenced modified files exist on disk.
- 5 `vms-cards-min--` emission sites in browser.ts; 5 `.vms-cards-min--` CSS rules in default.css.
- AGENTS.md says "ships both"; CHANGELOG has the Phase-9 subsection under `## Unreleased`; no `## 1.13.0` heading; versions at 1.11.0/1.9.0.
