---
phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n
reviewed: 2026-07-09T09:59:05Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell-dotnet/ViewModels.cs
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/src/tui.tsx
  - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
  - demo/FeatureProbe-bun/handler.ts
  - viewmodel-shell-dotnet/Tests/ChartNodeSerializationTests.cs
  - demo/Showcase/frontend/src/main.ts
  - parity/fixtures/feature-probe.json
  - viewmodel-shell/agent-skill.md
  - viewmodel-shell-dotnet/AgentSkill.md
  - viewmodel-shell/scripts/check-theme-byte-identity.mjs
  - viewmodel-shell/styles/default.css
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 18: Code Review Report

**Reviewed:** 2026-07-09T09:59:05Z
**Depth:** standard
**Files Reviewed:** 13 (+ theme CSS files, test files spot-checked)
**Status:** issues_found

## Summary

Phase 18 reshapes the published `ChartNode` from a single-series bar shape to a multi-series-native base set across both wire backends (TS + .NET), the browser adapter's Chart.js binding, the TUI degradation, the theme palette, and parity/docs. The core wire-shape work is careful and correct: the TS `ChartNode`/`ChartSeries` interfaces and the .NET twin's `[JsonIgnore(WhenWritingNull)]`/`[JsonIgnore(WhenWritingDefault)]` posture match field-for-field (verified by direct read plus a live re-run of `dotnet test viewmodel-shell-dotnet/Tests --filter ChartNodeSerializationTests`, 7/7 green), both tree-validators correctly leave `ChartNode`/`ChartSeries` as action-free leaves with no new case needed, `ChartPoint` is fully retired from tracked source, and the FeatureProbe/parity fixture is structurally identical across the .NET and bun backends. `check:theme-byte-identity` and `check:aa-contrast` both pass live against the current tree.

One genuine crash bug was found and reproduced live: the reshaped TUI `ChartView` (`viewmodel-shell/src/tui.tsx`) divides by a single **global** max across all series, but only guards against a non-positive max — a series that mixes a negative value with an overall-positive max produces a negative bar length, and `"█".repeat(negativeCount)` throws a `RangeError` synchronously during render. This is a real regression against the phase's own explicit "never crashes" requirement (CHARTBASE-05), reachable with ordinary data (e.g. a P&L-style series with one negative entry alongside other series' positive values), and is not covered by the existing `tui-chart.test.ts` (which only exercises *all*-negative data, not *mixed*-sign data). Two further robustness/quality issues were found in the widened `browser.ts` Chart.js binding (a missing color fallback when a chart-palette CSS token is absent, and an un-deduplicated `console.warn` that will spam on every poll/re-render for a mis-shaped pie/donut chart), plus a few minor `any`-typing and design-ambiguity notes below.

## Critical Issues

### CR-01: TUI `ChartView` crashes (`RangeError`) on a series with mixed positive/negative values

**File:** `viewmodel-shell/src/tui.tsx:1595-1610`
**Issue:** The reshaped bar/line/area TUI degradation computes one **global** `maxValue` across all series (`Math.max(0, ...allValues)`, line 1595) and then, per label row, computes `barLen = Math.round((value / maxValue) * CHART_BAR_WIDTH)` (line 1605), guarded only by `maxValue > 0`. This guard correctly handles the *all-values-non-positive* case (guard fails, `barLen = 0`), but it does **not** guard against an individual `value` being negative while `maxValue` (from some other series or label) is positive. In that case `barLen` is negative, and `"█".repeat(barLen)` (line 1610) throws `RangeError: Invalid count value` — a hard, synchronous crash of the entire chart render (and, since `ChartView` has no error boundary in `tui.tsx`, of the surrounding render as well).

Reproduced live against the current tree:
```ts
const node: ChartNode = {
  type: "chart",
  labels: ["A", "B"],
  series: [{ name: "Net", data: [10, -5] }],
};
// renderTree(node) → ChartView renders fine structurally, but the moment the
// function component body actually executes (e.g. via React/the real
// renderer, or the same collectText() walker tui-chart.test.ts itself uses),
// it throws: RangeError: Invalid count value: -10
```
This exact scenario (one series with a positive value elsewhere driving `maxValue` up, and a *different* value within a series being negative) is common for realistic multi-series or even single-series data — e.g. a "Net change" series with some positive and some negative entries, or a "Revenue"/"Profit" pairing where Profit dips negative in one period. `tui-chart.test.ts`'s existing "all-negative" test (`data: [-3, -7]`) does not exercise this path because `maxValue` is `0` in that case, not positive — it never actually reaches the crash. This is a genuine gap in the phase's own explicit acceptance criterion: "every division is guarded by `maxValue > 0`, never throws" (the code comment at `tui.tsx:1562-1563`) is not actually true once mixed-sign data is considered.

**Fix:** Clamp the bar length to be non-negative before calling `.repeat()` — e.g.:
```ts
const barLen = maxValue > 0 ? Math.max(0, Math.round((value / maxValue) * CHART_BAR_WIDTH)) : 0;
```
Add a test case with a mixed-sign series (e.g. `data: [10, -5]`) to `tui-chart.test.ts` to lock the fix and prevent regression — the existing "all-negative" test alone does not cover this branch.

## Warnings

### WR-01: `paletteColor()` has no fallback when a `--vms-chart-N` token is absent (regression vs. the prior `--vms-accent` safety net)

**File:** `viewmodel-shell/src/browser.ts:578-584`
**Issue:** The pre-reshape code always resolved to a token with a hard-coded fallback: `const token = (n.tone && toneToken[n.tone]) || "--vms-accent"; const color = cs.getPropertyValue(token).trim();` — so even a theme/consumer with no chart-specific tokens still got a sensible neutral color. The reshaped `paletteColor(i)` (line 580-581) has **no such fallback**: `cs.getPropertyValue(\`--vms-chart-${(i % 8) + 1}\`).trim()`. If a consumer's custom theme (built via the framework's own sanctioned `--vms-*` override seam, see AGENTS.md "The `--vms-*` override seam") predates this phase and doesn't define `--vms-chart-1..8`, `getPropertyValue` returns `""`, and the resulting Chart.js `backgroundColor`/`borderColor` is an empty string — Chart.js's behavior for an empty-string color is typically to render nothing/transparent or fall back to its own internal default palette, silently producing a chart that doesn't visually match the app's theme, with no warning to the developer. Every *shipped* theme in this repo does carry the 8 tokens (verified: `grep -c vms-chart- styles/themes/*.css` shows 8 per file), so this is invisible in-repo — but it's a real fail-soft gap for any external consumer who reskins via the override seam without adding the new tokens, which the design system explicitly sanctions as the standard customization path.
**Fix:** Add a neutral fallback consistent with the pre-reshape behavior, e.g.:
```ts
const paletteColor = (i: number): string =>
  cs.getPropertyValue(`--vms-chart-${(i % 8) + 1}`).trim() || cs.getPropertyValue("--vms-accent").trim();
```

### WR-02: Pie/donut extra-series `console.warn` is not de-duplicated — fires on every render, including every poll tick

**File:** `viewmodel-shell/src/browser.ts:604-614`
**Issue:** `chart()` runs on every call to `render()` for any `ChartNode` in the tree — including every poll re-render (VMS's `pollInterval` mechanism dispatches on a fixed cadence, often ~1s) and every user-action re-render. The dev-warning for a pie/donut chart with `series.length > 1` (lines 609-613) has no de-duplication (unlike, e.g., the `chartInstances` Map that tracks per-key state across renders) — so an app that (by mistake, or simply because its server-side data model always emits more than one series into a pie chart) ships a mis-shaped pie/donut `ChartNode` into a polling view will spam `console.warn` once per poll indefinitely, for as long as that view is open. This drowns out other console diagnostics and, in a long browser session, can produce thousands of duplicate warnings.
**Fix:** De-duplicate per stable chart `key` (the same key already used for `chartInstances`), e.g. track a `Set<string>` of keys already warned, or gate the warning behind a "first render only" check using the existing `chartInstances.get(key)` presence test.

## Info

### IN-01: Widened `chart()` config construction relies on `any` typing

**File:** `viewmodel-shell/src/browser.ts:602, 626`
**Issue:** `let datasets: any[];` and `const dataset: any = { ... };` bypass TypeScript's structural checking for the Chart.js dataset/config shape. This was already loosely typed pre-reshape (the original single-series `config` object was also untyped inline), so this isn't a new pattern, but the widening (multi-kind, multi-series, conditional `fill`) increases the amount of code running under `any` with no compile-time guardrail against, e.g., a typo'd Chart.js option name.
**Fix (non-blocking):** Consider a minimal local interface (`interface ChartJsDataset { label?: string; data: number[]; backgroundColor: string | string[]; borderColor?: string; fill?: boolean }`) to catch shape mistakes without pulling in Chart.js's own (heavier) types.

### IN-02: Palette slot assignment is not documented for mixed toned/untoned series

**File:** `viewmodel-shell/src/browser.ts:583-584, 624-625`
**Issue:** `seriesColor(i, tone)` resolves the palette slot from the series' raw array index `i`, regardless of whether earlier series in the array used a `tone` override instead of a palette slot. E.g. `series: [{tone:"danger"}, {/* no tone */}]` assigns the *second* series `--vms-chart-2` (index 1), not `--vms-chart-1` — the palette slot "skips" past the toned series rather than being assigned only among untoned series. This isn't necessarily wrong (the 18-CONTEXT.md design doc doesn't specify which behavior is intended), but it is undocumented, and a future maintainer or a chart with many toned + untoned series mixed could be surprised that the palette isn't tightly packed. Neither `chart.test.ts` nor the design doc pins down which behavior is correct.
**Fix (non-blocking):** Add a one-line code comment stating the index is the raw series-array index (not an "untoned-only" counter), or add a test that locks the current behavior so a future change is deliberate rather than accidental.

### IN-03: Pie/donut background-color array length is keyed off `labels.length`, not the rendered series' `data.length`

**File:** `viewmodel-shell/src/browser.ts:617-620`
**Issue:** `backgroundColor: n.labels.map((_, j) => paletteColor(j))` sizes the per-slice color array to `n.labels.length`, while the actual rendered `data` is `primary.data` (i.e. `n.series[0].data`). For well-formed wire data these are the same length (per the locked index-alignment contract), so this is not exploitable in practice — but if a caller ever sends `labels`/`series[0].data` of different lengths (malformed/buggy server code), the color array and the data array would be mismatched in length, and Chart.js would silently fall back to its own default color cycling for the uncovered indices rather than the intended palette. Low severity since it requires malformed input, but worth noting since it's an easy one-line correctness improvement.
**Fix (non-blocking):** `backgroundColor: (primary?.data ?? []).map((_, j) => paletteColor(j))` would tie the color array's length to the actually-rendered data instead of the (possibly mismatched) labels array.

---

_Reviewed: 2026-07-09T09:59:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
