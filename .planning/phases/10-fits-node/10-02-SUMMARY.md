---
phase: 10-fits-node
plan: 02
subsystem: layout-system
tags: [fits-node, view-that-fits, tui-degradation, parity, showcase, changelog]
requires:
  - "FitsNode wire type (TS ViewNode union + .NET record + [JsonDerivedType] discriminator) — 10-01"
provides:
  - "TUI fits degradation: renderNode() + container walks render only the LAST child (FITS-02)"
  - "FeatureProbe fits wire parity (axis omitted + axis:both), byte-identical across .NET/Bun/Node (FITS-03 wire half)"
  - "Showcase fits demo (wide-row toolbar <-> compact stacked)"
  - "### Fits node — Phase 10 Unreleased CHANGELOG subsection (no version bump)"
affects:
  - viewmodel-shell/src/tui.tsx
  - demo/FeatureProbe-bun/handler.ts
  - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
  - parity/fixtures/feature-probe.json
  - demo/Showcase/frontend/src/main.ts
  - CHANGELOG.md
tech-stack:
  added: []
  patterns:
    - "TUI fits = transparent wrapper around its LAST child in renderNode() + the two recursive container walks (countPanes/visit, focusedPaneSummary); isPaneNode unchanged (fits is not itself a pane)"
    - "New node type rendered as STATIC view-shape in both FeatureProbe backends, captured by existing GET steps (no new action arm) — Phase 8/9 precedent"
key-files:
  created: []
  modified:
    - viewmodel-shell/src/tui.tsx
    - demo/FeatureProbe-bun/handler.ts
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - parity/fixtures/feature-probe.json
    - demo/Showcase/frontend/src/main.ts
    - CHANGELOG.md
decisions:
  - "isPaneNode left unchanged — a fits node is NOT itself a Tab-cyclable pane (like page/list-item/form); the last-child recursion belongs in the two recursive walkers, both updated"
  - ".NET inner candidate SectionNodes need explicit Heading:null (Heading is a required non-default record param) to mirror the bun side's heading-omitted candidates"
  - "Release DEFERRED — versions stay 1.11.0 (npm) / 1.9.0 (NuGet); CHANGELOG accumulates under ## Unreleased; Phase 11 cuts the consolidated bump+publish"
metrics:
  duration: ~25m
  completed: 2026-06-24
---

# Phase 10 Plan 02: Fits Node (TUI degradation + parity + demo + CHANGELOG) Summary

Landed the `fits` node's TUI degradation (FITS-02), the cross-backend wire parity (FITS-03 wire half), a minimal Showcase demo, and the deferred-release CHANGELOG record. The TUI renders a `fits` node as its **LAST child** (the guaranteed-fits fallback — terminals have no pixel layout); both FeatureProbe backends emit a `fits` with `axis` omitted (absent on wire) and a `fits` with `axis:"both"` (present) as static view-shape, byte-identical across .NET/Bun/Node; the Showcase gains a wide-row-toolbar ↔ compact-stacked `fits` demo. No version bump, no publish.

## What was built

- **Task 1 — TUI fits degradation (`tui.tsx`):** added a `case "fits":` to `renderNode()` that renders `node.children[last]` via the existing renderer (empty-children guarded → `null`), plus a `fits` arm to the two recursive container walks (`countPanes`/`visit` and `focusedPaneSummary`) that recurses into ONLY the last child (`isTopLevel=false`, like `section`), so pane counting / focus targeting match the rendered tree. `isPaneNode` was deliberately left unchanged (a fits node is not itself a pane). (commit `37a23e2`)
- **Task 2 — FeatureProbe parity (both backends + fixture):** appended two static fits sections to each `buildVm`/`BuildVm` (after the cards sections, before the table section) — `fits (axis omitted)` and `fits axis:both`, each wrapping a `fits` node with a `layout:"row"` candidate first and a `layout:"stack"` candidate last (preferred-first/fallback-last). Mirrored byte-identically in the .NET controller via `new FitsNode(Children, Axis?)`. Extended the `feature-probe.json` `$comment` to document the static fits coverage and that the client-side selection is NOT parity-tested. `bun run parity/run.ts` byte-identical green. (commit `96ce2f2`)
- **Task 3 — Showcase demo + CHANGELOG (`main.ts`, `CHANGELOG.md`):** added a "Fits (responsive selection)" `componentsView()` section — a muted explainer + a `{type:"fits", children:[<wide row toolbar>, <compact stacked>]}` node, zero `<style>`. Added the `### Fits node — Phase 10 (on \`main\`, unpublished)` subsection under the existing `## Unreleased` heading (lead paragraph + Added / Not changed / Demo + tests / Migration), with NO version bump. (commit `cd62f1a`)

## Deviations from Plan

**1. [Rule 3 - Blocking] `.NET` inner candidate `SectionNode`s required explicit `Heading: null`**
- **Found during:** Task 2 (first parity run failed the dotnet prebuild with CS7036).
- **Issue:** `SectionNode`'s record makes `Heading` a required (non-default) positional param; `new SectionNode(Children: ..., Layout: "row")` for the inner candidates omitted it → compile error.
- **Fix:** Passed `Heading: null` on the four inner candidate sections (serializes absent via `[JsonIgnore(WhenWritingNull)]`, matching the bun candidates which omit `heading`). No wire change; the second parity run was byte-identical green.

**Scope note (not a deviation):** `isPaneNode` (the third "container-aware walk" the plan named) was left unchanged. It is a boolean classifier, not a recursive walker — a `fits` node is correctly NOT a Tab-cyclable pane (consistent with `page`/`list-item`/`form` returning `false`). The last-child recursion the plan requires lives in the two ACTUAL recursive walkers (`countPanes/visit`, `focusedPaneSummary`), both of which got a `fits` arm. The invariant the plan specifies — "each walk sees only the LAST child of a fits node, consistent with the render" — holds.

No other deviations — plan executed as written.

## Release status

DEFERRED per CONTEXT — versions stay **1.11.0 (npm) / 1.9.0 (NuGet)** (confirmed: `git diff` on `package.json`/`.csproj` is empty). CHANGELOG changes are under `## Unreleased`. NO publish, NO tag. Consolidated release is Phase 11.

## Gate results

| Gate | Command | Result |
|------|---------|--------|
| TS typecheck (incl. tui.tsx fits) | `viewmodel-shell && npx tsc --noEmit` | CLEAN |
| vitest (full) | `viewmodel-shell && npx vitest run` | 29 files, **397 passed / 1 skipped** (pre-existing skip) |
| TUI subset | `npx vitest run test/conformance.tui.test.ts test/tui-lifecycle.test.ts` | 48 passed / 1 skipped |
| core platform-agnosticism | `npm run check:core-globals` | GREEN (index.ts unchanged) |
| WCAG-AA contrast | `node scripts/check-aa-contrast.mjs` | GREEN (13/13 pairs, default + 12 themes) |
| no-demo-style | `node scripts/check-no-demo-style.mjs` | GREEN (Showcase fits = .vms-*-only, zero `<style>`) |
| Showcase typecheck | `demo/Showcase/frontend && npx tsc --noEmit` | 12 errors, ALL pre-existing theme `?inline` (ZERO new from fits) |
| Showcase authoritative compile | `demo/Showcase/frontend && npx vite build` | built clean (17 modules) |
| .NET build | `viewmodel-shell-dotnet && dotnet build` | Build succeeded, 0 Errors |
| **Cross-backend parity** | `bun run parity/run.ts` | **✓ Parity tests passed — byte-identical, all backends agree** |

## Parity verdict

**`bun run parity/run.ts` → ✓ Parity tests passed.** All backends (dotnet-probe / bun-probe / node-probe + the other backends) agree byte-identically on the new `fits` wire: `type:"fits"` discriminator emitted, omitted `axis` ABSENT on the wire, `axis:"both"` present as the JSON string `"both"`, candidate children present in preferred-first/fallback-last order. The client-side measure-and-pick selection is browser-only and not part of parity.

## Self-Check: PASSED

- Modified files all present: `viewmodel-shell/src/tui.tsx`, `demo/FeatureProbe-bun/handler.ts`, `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`, `parity/fixtures/feature-probe.json`, `demo/Showcase/frontend/src/main.ts`, `CHANGELOG.md` — FOUND
- Commits present: `37a23e2`, `96ce2f2`, `cd62f1a` — FOUND on `main`
- Versions unchanged: npm `1.11.0`, NuGet `1.9.0` — CONFIRMED (empty `git diff`)
