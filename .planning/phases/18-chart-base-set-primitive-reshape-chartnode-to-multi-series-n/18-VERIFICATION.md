---
phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n
verified: 2026-07-09T10:12:40Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
---

# Phase 18: Chart Base Set primitive Verification Report

**Phase Goal:** A reshaped `ChartNode` (`kind` ∈ bar|line|area|pie|donut; shared `labels: string[]` + `series: [{name, data: number[], tone?}]`; `stacked?` for bar/area; `title?`) renders every base-set chart type from structured wire data — multi-series where it applies, single-series as one entry — drawn by the existing lazy/optional Chart.js browser-adapter binding (core + .NET/bun stay dependency-free), colored by a framework-owned `--vms-chart-1..8` theme palette with optional semantic per-series `tone`, byte-identical across TS/.NET with both tree-validators descending into it and parity green. Zero raw color/CSS on the wire.

**Verified:** 2026-07-09T10:12:40Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Reshaped `ChartNode`/`ChartSeries` wire type exists in BOTH backends, `ChartPoint` retired, optional-field rules honored, both tree-validators fall through the leaf (CHARTBASE-01) | ✓ VERIFIED | `viewmodel-shell/src/index.ts` L722-749: `ChartSeries{name,data,tone?}` + `ChartNode{type,kind?,labels,series,stacked?,title?}`. `viewmodel-shell-dotnet/ViewModels.cs` L806-818: `record ChartSeries(Name,Data,Tone?)` / `record ChartNode(Labels,Series,Kind?,Stacked,Title?)` with `[JsonIgnore(WhenWritingNull)]` on Kind/Tone/Title and `[JsonIgnore(WhenWritingDefault)]` on Stacked — matches AGENTS.md gotcha #8 exactly. `grep -rn "ChartPoint" viewmodel-shell viewmodel-shell-dotnet demo` (excluding dist/node_modules) returns **zero** matches — fully retired, including the doc-comment fix (commit `db26f89`). Both `WalkForSectionAction` (.NET) and `collectActions` (TS, `server.ts`) have explicit comments confirming ChartNode is treated as an action-free leaf with no recursion case added — confirmed by direct read of both functions (no `case ChartNode`/`case "chart"` present; falls through to the no-op default). `dotnet test viewmodel-shell-dotnet/Tests` → 109/109 passed (live re-run), including `ChartNodeSerializationTests.cs`. |
| 2 | `--vms-chart-1..8` palette tokens exist in `default.css` + every theme; framework-default + optional per-series `tone` override; zero raw color on wire; contrast hand-checked (CHARTBASE-02) | ✓ VERIFIED | `viewmodel-shell/styles/default.css` L43-50: 8 `--vms-chart-N` hex tokens in `:root`. `grep -c vms-chart- styles/themes/*.css` → all 12 theme files show exactly 8. Live re-run of `npm run check:aa-contrast` → 13/13 pairs pass WCAG-AA on default + all 12 themes (unaffected fixed-pair gate, as locked). SUMMARY's hand-check table (light family ≥3.45:1, dark family ≥7.11:1, both well above the 3.0:1 non-text floor) is internally consistent and traceable to the actual committed hex values. Zero raw color on the wire confirmed via `grep -nE "#[0-9a-fA-F]{3,8}|rgb\(" parity/fixtures/feature-probe.json \| grep -i chart` → no matches. |
| 3 | Browser adapter renders every base-set kind + multi-series + `stacked`, via lazy/optional Chart.js; core/.NET/bun stay dependency-free (CHARTBASE-03) | ✓ VERIFIED | `viewmodel-shell/src/browser.ts` L560-700: `chart()` maps kind→Chart.js type (bar/line+fill=area/pie/doughnut=donut), builds one dataset per series for bar/line/area with palette/tone color resolution, single per-slice dataset for pie/donut (series[0] only, lenient warn on extras), `stacked` applied to bar/area scale options only, legend rule (`series.length>1 \|\| isPie`). `loadChart()` L705-733: dynamic `import("chart.js")` behind try/catch with fail-loud (`chartFailLoud`) on missing dep, registers the full base-set controller/element/scale/plugin set. Confirmed **zero** `chart.js` references in `src/index.ts`, `ViewModels.cs`, or `demo/FeatureProbe-bun/handler.ts` (grep, no matches); `package.json` lists `chart.js` only under `peerDependencies`+`peerDependenciesMeta.optional:true`. Live re-run `npx vitest run` (jsdom) → 555 passed / 1 skipped (47 files), including `chart.test.ts`/`chart-missing-dep.test.ts`. |
| 4 | Parity: multi-series+tone+stacked fixture byte-identical TS/.NET; `bun run parity/run.ts` green (CHARTBASE-04) | ✓ VERIFIED | `parity/fixtures/feature-probe.json` `$comment` documents the reshaped chart section (2 ChartNodes: mandatory-coverage node with 2 series incl. one toned `danger`, `stacked:true`, whole-number data, title; explicit-`kind:"line"` node). `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (L511-531) and `demo/FeatureProbe-bun/handler.ts` (L445-469) emit structurally identical `ChartNode`s (verified by direct read, byte-for-byte matching field values). Live re-run of `bun run parity/run.ts` → **✓ Parity tests passed**, including `Fixture 'feature-probe' across 3 backends: ✓ all backends agree` (dotnet/bun/node) and the skill source/HTTP-twin byte checks. |
| 5 | TUI adapter degrades legibly for the reshaped ChartNode, never crashes (CHARTBASE-05) | ✓ VERIFIED | `viewmodel-shell/src/tui.tsx` `ChartView` (~L1560-1622) groups output by series (name header + per-label `<label> <value> <bar>` rows), scales ASCII bars to a global max across all series, degrades pie/donut to series[0] label/value rows. **CR-01 crash fix confirmed present**: `barLen = maxValue > 0 ? Math.max(0, Math.round(...)) : 0` (commit `ef4f76c`) — the negative-bar-length `RangeError` the code review found is clamped. `viewmodel-shell/test/tui-chart.test.ts` (6 tests, one added as the explicit CR-01 regression: mixed-sign series `[5,-3,8]` alongside a positive series) all pass in the live `npx vitest run` (555 passed total includes this file). |
| 6 | Green-tree gate stays green: vitest (jsdom), parity, core-globals, framework `.NET Tests`, every `demo/**/*.Tests.csproj` (CHARTBASE-06) | ✓ VERIFIED | All commands independently re-run live by this verification (not trusted from SUMMARY): `cd viewmodel-shell && npx vitest run` → 555 passed/1 skipped (47 files); `npm run check:core-globals` → ✓ AGNOSTIC-03 zero platform globals in `index.ts`; `npm run check:aa-contrast` → ✓ 13/13 all themes; `npm run check:theme-byte-identity` → ✓; `dotnet test viewmodel-shell-dotnet/Tests` → 109/109; `dotnet test` on all 5 `demo/**/*.Tests.csproj` → 28+39+33+52+29 = 181/181 passed; `bun run parity/run.ts` → ✓ Parity tests passed (all fixture groups + skill twins). Git tree clean (`git status --short` empty), HEAD on `main` at the last fix commit. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `viewmodel-shell/src/index.ts` | Reshaped `ChartNode`/`ChartSeries` | ✓ VERIFIED | Lines 722-749, matches design doc exactly |
| `viewmodel-shell-dotnet/ViewModels.cs` | Reshaped `ChartNode`/`ChartSeries` records | ✓ VERIFIED | Lines 806-818, correct `WhenWritingNull`/`WhenWritingDefault` attrs |
| `viewmodel-shell-dotnet/Tests/ChartNodeSerializationTests.cs` | Locks optional-field omission rules | ✓ VERIFIED | Exists, part of the 109/109 green `Tests` project |
| `viewmodel-shell/styles/default.css` | `--vms-chart-1..8` tokens | ✓ VERIFIED | Lines 43-50 |
| `viewmodel-shell/styles/themes/*.css` (12 files) | `--vms-chart-1..8` per theme | ✓ VERIFIED | All 12 confirmed via grep count |
| `viewmodel-shell/src/browser.ts` | Widened `chart()`/`loadChart()` | ✓ VERIFIED | Lines 560-733, base-set rendering + lazy Chart.js registration |
| `viewmodel-shell/src/tui.tsx` | Reshaped `ChartView`, crash-safe | ✓ VERIFIED | Lines ~1560-1622, CR-01 fix present |
| `viewmodel-shell/test/tui-chart.test.ts` | Multi-series/pie/donut/negative/mixed-sign degradation tests | ✓ VERIFIED | 6 tests, incl. CR-01 regression, all passing |
| `viewmodel-shell/test/chart.test.ts`, `chart-missing-dep.test.ts` | Reshaped node tests, incl. WR-01/WR-02 regressions | ✓ VERIFIED | Present and passing in live vitest run |
| `parity/fixtures/feature-probe.json` | Multi-series+tone+stacked `$comment`/wire | ✓ VERIFIED | `$comment` describes the reshape; live parity run confirms byte-identical across backends |
| `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`, `demo/FeatureProbe-bun/handler.ts` | Emit matching multi-series/tone/stacked charts | ✓ VERIFIED | Byte-matching field values confirmed by direct read |
| `viewmodel-shell/agent-skill.md`, `viewmodel-shell-dotnet/AgentSkill.md` | Reconciled "Chart data" docs | ✓ VERIFIED (not independently re-diffed pixel-for-pixel, but parity's `check-skill.ts` step confirms byte-identical source + served bodies live) | Parity run: "skill source files byte-identical (14614B)"; "skill HTTP twins byte-identical (14857B)" |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `ChartNode.series[].tone` | theme tone token (`--vms-error` etc.) | `seriesColor()` in `browser.ts` | ✓ WIRED | Confirmed in code; `toneToken` map L569-574, used in `seriesColor()` L586-587 |
| `ChartNode` (no tone) | `--vms-chart-N` palette cycling | `paletteColor()` in `browser.ts` | ✓ WIRED | Confirmed, with WR-01 fallback to `--vms-accent` when a chart token resolves empty |
| Reshaped wire type | both tree-validators | `WalkForSectionAction`/`collectActions` fall-through | ✓ WIRED | No recursion case added (correct — leaf), confirmed by direct read of both functions |
| FeatureProbe chart section | parity harness | live GET/POST steps, byte-diffed | ✓ WIRED | Live re-run: "all backends agree" for `feature-probe` fixture |

### Data-Flow Trace (Level 4)

Not applicable in the traditional dynamic-data sense — `ChartNode` is a wire *primitive* (like `TableNode`/`FormNode`), not an app with a live data source. The relevant trace is: parity fixture → both backend controllers → live GET response → structural diff — verified above via the live `bun run parity/run.ts` re-run, which fetches real HTTP responses from running dotnet/bun/node backend processes (not static fixtures) and diffs them at runtime. This is the strongest available "data flows" proof for a framework primitive.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| TUI chart never crashes on mixed-sign data | `npx vitest run` (includes `tui-chart.test.ts` CR-01 regression case) | 555 passed / 1 skipped | ✓ PASS |
| Browser chart renders multi-series/stacked/tone/pie/donut | `npx vitest run` (includes `chart.test.ts`, 19+ assertions per SUMMARY) | passing, part of 555 | ✓ PASS |
| Missing chart.js dependency fails loud, doesn't crash | `npx vitest run` (`chart-missing-dep.test.ts`) | 1 test passed | ✓ PASS |
| Cross-backend byte parity for the chart fixture | `bun run parity/run.ts` | "Fixture 'feature-probe' ... ✓ all backends agree" | ✓ PASS |
| Framework .NET serialization rules (WhenWritingNull/Default) | `dotnet test viewmodel-shell-dotnet/Tests --filter ChartNodeSerializationTests` (covered by full 109/109 run) | 109/109 passed | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention exists in this repository (it is not a migration/tooling-phase project of that shape); no PLAN/SUMMARY/success-criteria in this phase reference a `probe-*.sh` script. Step 7c is not applicable — skipped with reason: no probe scripts declared or found (`find scripts -path '*/tests/probe-*.sh' -type f` returns nothing).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CHARTBASE-01 | 18-01-PLAN.md | Reshaped ChartNode/ChartSeries wire type, both backends | ✓ SATISFIED | Verified in code + 109/109 .NET tests |
| CHARTBASE-02 | 18-02-PLAN.md, 18-03-PLAN.md | Palette tokens, tone override, zero raw color, contrast hand-check | ✓ SATISFIED | Verified in CSS + live aa-contrast run |
| CHARTBASE-03 | 18-03-PLAN.md | Browser adapter base-set rendering, dependency-free core/.NET/bun | ✓ SATISFIED | Verified in browser.ts + grep for chart.js absence |
| CHARTBASE-04 | 18-05-PLAN.md | Parity fixture byte-identical | ✓ SATISFIED | Live `bun run parity/run.ts` green |
| CHARTBASE-05 | 18-04-PLAN.md | TUI never crashes | ✓ SATISFIED | CR-01 fix verified present + regression test passing |
| CHARTBASE-06 | 18-06-PLAN.md | Full green-tree gate | ✓ SATISFIED | All 5+ gate commands independently re-run green by this verification |

**Note (documentation gap, non-blocking):** `.planning/REQUIREMENTS.md` does not yet contain any `CHARTBASE-*` entries (confirmed via `grep -c CHARTBASE .planning/REQUIREMENTS.md` → 0). Per the verification task's explicit instruction, this is a known planning-doc gap (only prior v4.1/v4.2 IDs exist there) and does NOT block phase pass — it is flagged here as a documentation follow-up for whoever next updates REQUIREMENTS.md (likely alongside the Phase 19 release closeout).

### Anti-Patterns Found

None found in the phase's modified/created files. Scanned `browser.ts`, `tui.tsx`, `index.ts`, `ViewModels.cs` for `TODO|FIXME|XXX|HACK|PLACEHOLDER` and empty-implementation patterns — none present in the reshaped chart code paths. The three code-review findings (1 Critical CR-01, 2 Warnings WR-01/WR-02) were all fixed in dedicated commits (`ef4f76c`, `1124951`, `0d2e99b`) with regression tests, and those fixes are confirmed present and passing above. The three remaining Info-level findings from 18-REVIEW.md (IN-01 `any`-typing in `browser.ts`'s Chart.js config construction, IN-02 undocumented palette-slot-index behavior for mixed toned/untoned series, IN-03 pie/donut background-color array keyed off `labels.length` rather than `data.length`) are non-blocking design notes, not defects — left as-is per the review's own "non-blocking" classification; no debt markers, no unresolved TODOs.

### Human Verification Required

None. This phase's scope is fully machine-verifiable (wire shape, CSS tokens, adapter code, TUI degradation, parity byte-diffing, and the full automated test/gate suite) — there is no human-only concern (visual pixel rendering, real browser interaction) in Phase 18's own success criteria. The human-runnable visual verification page (actually looking at the rendered charts in a browser) is explicitly Phase 19's scope, not Phase 18's — the 18-CONTEXT.md phase boundary and ROADMAP.md both confirm this ("Out of scope (Phase 19): the human-runnable tailnet verification page").

### Gaps Summary

No gaps found. All 6 CHARTBASE requirements are implemented, tested, and independently re-verified live in this session (not merely trusted from SUMMARY.md claims): the wire reshape is byte-correct in both backends with the correct optional-field JSON attributes, the theme palette is complete and contrast-passing in all 12 themes + default, the browser adapter renders the full base set with dependency-free core/.NET/bun, the parity fixture is confirmed byte-identical across three live backend processes, the TUI degrades legibly and the one real crash bug found by code review (CR-01, a `RangeError` on mixed-sign multi-series data) is fixed with a regression test now passing, and the full green-tree gate (vitest 555/1-skip, core-globals, aa-contrast, theme-byte-identity, framework .NET Tests 109/109, all 5 demo Tests.csproj 181/181, and the parity suite) was independently re-run and is green. The one documentation gap (CHARTBASE-* IDs absent from REQUIREMENTS.md) is noted per instruction as non-blocking.

---

_Verified: 2026-07-09T10:12:40Z_
_Verifier: Claude (gsd-verifier)_
