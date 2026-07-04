---
phase: 12-chartnode-primitive
plan: 02
subsystem: data-visualization
tags: [chart-node, tui-degradation, wire-parity, showcase, changelog]
requires:
  - "ChartNode + ChartPoint wire types (from 12-01)"
provides:
  - "TUI renderNode() chart case (printed title + per-point label/value/ASCII-bar series)"
  - "Byte-identical static ChartNode across both FeatureProbe backends (parity-tested wire)"
  - "Showcase bar-chart demo (Phase 13 operator-review surface)"
  - "### ChartNode — Phase 12 CHANGELOG subsection (unpublished, on main)"
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
    - "Leaf-node TUI degradation: a childless ChartNode prints label/value/ASCII-bar; no container-walk arm (mirrors StatBarView/ProgressView)"
    - "Static view-shape parity: a NEW node rendered in both buildVm/BuildVm is captured by existing GET steps — no new action arm; whole-number values keep double/number byte-identical"
key-files:
  created:
    - .planning/phases/12-chartnode-primitive/12-02-SUMMARY.md
  modified:
    - viewmodel-shell/src/tui.tsx
    - demo/FeatureProbe-bun/handler.ts
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - parity/fixtures/feature-probe.json
    - demo/Showcase/frontend/src/main.ts
    - CHANGELOG.md
decisions:
  - "CHANGELOG has no literal `## Unreleased` heading anymore (restructured since the plan was written) — the current convention is `### … — Phase N (on `main`, unpublished)` subsections; the ChartNode subsection was appended after the most recent one (### Fits node — Phase 10)"
  - "TUI bold-title via `attributes={1}` (the file's BOLD idiom); label padEnd to common width, value padStart(4), bar in #4a9eff — matches StatBarView/ProgressView text-only leaf style"
metrics:
  duration: ~20m
  completed: 2026-07-04
---

# Phase 12 Plan 02: ChartNode TUI degradation + wire parity + Showcase Summary

Landed the non-browser + demo halves of the `ChartNode` (built in 12-01): a legible TUI
text degradation, byte-identical cross-backend wire parity, a Showcase bar-chart demo, and
the deferred-release CHANGELOG record. No version bump / publish / tag; agent-skill.md
untouched (deferred to Phase 13 / CHART-06).

## What landed

**Task 1 — TUI ChartNode degradation (commit `3c2b80a`).**
- `tui.tsx`: `ChartNode` added to the type imports; a `case "chart": return <ChartView …>` in
  the `renderNode()` dispatch (adjacent to `stat-bar`); a `ChartView` leaf component printing
  the title (if any, bold via `attributes={1}`) then per point a `label(padEnd) value(padStart 4)
  ASCII-bar` line where the bar is `"█".repeat(round(value/max × 20))`. Guards: empty `points`
  (renders just the title / nothing), non-positive `max` (labels+values, no bars) — never throws
  or divides by zero. NO container-walk arm added (ChartNode is a LEAF, like StatBarNode).
- Verify: `npx tsc --noEmit` exit 0; `test/conformance.tui.test.ts` + `test/tui-lifecycle.test.ts`
  green (48 passed, 1 skipped).

**Task 2 — FeatureProbe both backends + parity fixture (commit `aba2da4`).**
- `FeatureProbe-bun/handler.ts` `buildVm`: a `chartSection` (`heading:"chart (bar)"`) with a
  `{type:"chart", points:[Mon 12, Tue 19, Wed 7], title:"Weekly visits", tone:"info"}` node,
  appended to the page children after the fits sections (before `childModifiersSection`). `kind`
  omitted.
- `FeatureProbe/AspNetCore/FeatureProbeController.cs` `BuildVm`: the byte-identical
  `new ChartNode(Points: [new("Mon",12), new("Tue",19), new("Wed",7)], Title:"Weekly visits",
  Tone:"info")` in a `chart (bar)` SectionNode, added to `pageChildren` in the same position.
  `Kind` omitted (absent on the wire).
- `parity/fixtures/feature-probe.json`: `$comment` extended with a Phase-12 sentence documenting
  the static chart coverage (whole-number points, kind omitted = absent, pixels NOT parity-tested).
  No new fixture file.
- Verify: `PATH="$HOME/.dotnet:$PATH" bun run parity/run.ts` — byte-identical green across
  dotnet/bun/node probes; the skill twins stayed byte-identical (agent-skill.md untouched).

**Task 3 — Showcase demo + CHANGELOG (commit `52ee8f1`).**
- `demo/Showcase/frontend/src/main.ts` `componentsView()`: a `Chart (bar)` section (muted
  explainer TextNode + a `{type:"chart", points:[Jan 30, Feb 45, Mar 28, Apr 52],
  title:"Signups", tone:"success"}` node), placed after the fits block, zero `<style>`.
- `CHANGELOG.md`: a `### ChartNode — Phase 12 (on `main`, unpublished)` subsection (lead
  paragraph + Added / Not changed / Demo + tests / Migration), appended after the most recent
  `### Fits node — Phase 10` subsection.
- Verify: viewmodel-shell `tsc --noEmit` exit 0; greps for the CHANGELOG subsection + Showcase
  `"chart"` pass; the `git diff --quiet` version-lock guard on package.json + .csproj passes → `OK`.

## Deviations from Plan

**1. [Rule 3 — reality mismatch] CHANGELOG has no literal `## Unreleased` heading.**
- **Found during:** Task 3.
- **Issue:** The plan (and 12-01) reference "the EXISTING `## Unreleased` CHANGELOG heading",
  but the CHANGELOG was restructured after the plan was written — there is no `## Unreleased`
  heading. The Phase 8/9/10 unpublished work now lives as `### … — Phase N (on `main`,
  unpublished)` subsections nested under the most recent release heading (`## 1.12.0 / 1.10.0`).
- **Fix:** Followed the actual live convention — appended `### ChartNode — Phase 12 (on `main`,
  unpublished)` after the most recent such subsection (`### Fits node — Phase 10`). This fulfills
  the plan's intent (the Phase-12 record as an unpublished on-main subsection) against the current
  file structure. No version bump; agent-skill.md untouched.
- **Files:** `CHANGELOG.md`. **Commit:** `52ee8f1`.

**2. [Scope — pre-existing, out of scope] Showcase frontend `tsc --noEmit` has 13 pre-existing
`.css?inline` TS2307 errors.**
- The Showcase frontend imports Vite-only `*.css?inline` theme modules that `tsc --noEmit` can't
  resolve (the Showcase builds via Vite, not tsc). All 13 errors predate this plan and none
  reference the new chart node. The plan's Task 3 verify runs the `viewmodel-shell` tsc (which
  passes), not the Showcase frontend tsc. Left untouched (out of scope; logged here, not fixed).

**3. [Repo working-agreement] No STATE.md / ROADMAP / REQUIREMENTS bookkeeping.**
- Per this repo's `AGENTS.md` ("This repo deliberately has NO maintained narrative state file …
  ROADMAP.md may be READ for context, but is not to be maintained as session bookkeeping"), the
  generic GSD state-update step was skipped — only this SUMMARY.md (the plan's sole `<output>`)
  was written. Committed to the current branch (`main`) as-is per the repo's operator-driven git
  rule; NO push, NO branch, NO version bump / publish / tag.

## Gate results (green-tree gate for this plan)

- `cd viewmodel-shell && npx vitest run` (jsdom): **512 passed, 1 skipped** across 42 files
  (chart + TUI + no regressions).
- `PATH="$HOME/.dotnet:$PATH" bun run parity/run.ts`: **byte-identical green** across
  dotnet/bun/node probes incl. the new static ChartNode; **skill twins byte-identical**
  (agent-skill.md / AgentSkill.md untouched).
- `npm run check:core-globals`: **green** (index.ts references zero platform globals).
- `git diff --quiet -- viewmodel-shell/package.json …csproj`: **clean** (NO version bump).

## Self-Check: PASSED
