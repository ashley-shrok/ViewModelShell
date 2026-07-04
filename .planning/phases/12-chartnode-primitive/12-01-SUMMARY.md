---
phase: 12-chartnode-primitive
plan: 01
subsystem: data-visualization
tags: [chart-node, bar-chart, chart.js, lazy-optional-dep, wire-type, capability-seam]
requires: []
provides:
  - "ChartNode + ChartPoint wire types (TS ViewNode union + .NET records + [JsonDerivedType] discriminator)"
  - "BrowserAdapter.chart() single-series bar renderer via lazy/optional Chart.js"
  - "chartInstances redraw-in-place (.update()) + mark-sweep (.destroy()) lifecycle"
  - "chartFailLoud() capability-seam fail-loud on missing chart.js"
  - ".vms-chart structural CSS rule"
  - "chart.js as devDependency + optional peerDependency"
affects:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/styles/default.css
  - viewmodel-shell-dotnet/ViewModels.cs
  - viewmodel-shell/src/server.ts
  - viewmodel-shell/package.json
  - viewmodel-shell/test/chart.test.ts
  - viewmodel-shell/test/chart-missing-dep.test.ts
tech-stack:
  added:
    - "chart.js@^4 (devDependency + optional peerDependency; lazy dynamic import in browser.ts only)"
  patterns:
    - "Lazy dynamic import() of an optional peer dep reached only when the node renders; tree-shaken bar-only Chart.register → zero bytes when no chart renders"
    - "Persistent-across-renders instance registry (chartInstances) survives the innerHTML wipe → .update() redraw-in-place; mark-swept + destroy()'d post-rebuild on removal"
    - "Capability-seam fail-loud (chartFailLoud → console.error) for a fire-and-forget async loader instead of a floating unhandled rejection"
    - "tone → --vms-* token map (danger→--vms-error) read via getComputedStyle; no raw CSS on the wire"
key-files:
  created:
    - viewmodel-shell/test/chart.test.ts
    - viewmodel-shell/test/chart-missing-dep.test.ts
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/styles/default.css
    - viewmodel-shell-dotnet/ViewModels.cs
    - viewmodel-shell/src/server.ts
    - viewmodel-shell/package.json
decisions:
  - "Points shape = ChartPoint {label,value}[] (self-contained pairs mirroring StatItem), NOT parallel categories/values arrays — agent-legible, no index alignment"
  - "kind?:'bar' optional (omitted = bar) so a future 'line' is an additive union value (CHART-LINE), not a new node type"
  - "chart.js loaded ONLY via lazy dynamic import in browser.ts + tree-shaken bar-only registration; core (index.ts), /server, .NET/bun gain NO chart.js dependency"
  - ".NET Value is double (mirrors TS number); whole-number fixtures keep the wire byte-identical; Kind/Title/Tone nullable string? with [JsonIgnore(WhenWritingNull)]"
  - "Missing chart.js fails loud through the sanctioned seam (console.error, adapter has no onError) — deterministic test spies console.error, NOT a floating unhandled rejection"
metrics:
  duration: ~35m
  completed: 2026-07-04
---

# Phase 12 Plan 01: ChartNode Primitive (wire type + bar renderer) Summary

Added `ChartNode` — VMS's first data-visualization primitive — to the wire on both
backends plus the browser-adapter renderer that draws a single-series bar chart via
Chart.js loaded as a **private, lazy, optional** dependency. Apps that render no chart
load zero chart.js bytes; the core, the `/server` subpath, and the .NET/bun backends
stay dependency-free. Delivers the TS half of CHART-01..05.

## What landed

**Task 1 — wire types on both backends (commit `820d847`).**
- TS (`index.ts`): `| ChartNode` added to the `ViewNode` union; `ChartPoint {label,value}`
  and `ChartNode {type:"chart"; kind?:"bar"; points; title?; tone?}` interfaces with
  house-idiom doc-comments (closed `kind` union / omitted=bar / `line` is a future
  additive value; self-contained `{label,value}` pairs read directly; tone→`--vms-*`
  token, no raw CSS on the wire).
- .NET (`ViewModels.cs`): `[JsonDerivedType(typeof(ChartNode),"chart")]` discriminator;
  `ChartPoint(string Label, double Value)` + `ChartNode(IReadOnlyList<ChartPoint> Points,
  string? Kind, string? Title, string? Tone)` records. `Points` required + first;
  `Kind`/`Title`/`Tone` trailing nullable each with `[JsonIgnore(WhenWritingNull)]` per
  the file-header rule (omitted = absent on the wire). `Value` is `double` to mirror TS
  `number`.
- Both TS validators (`collectActions` + `walkForSectionAction` leaf comments in
  `server.ts`) and both .NET validators (`Collect` + `WalkForSectionAction` leaf comments
  in `ViewModels.cs`) name `chart`/`ChartNode` as a deliberate childless/action-free leaf
  — no new case arm (it falls through harmlessly), no fits-style blind spot.

**Task 2 — chart() renderer + CSS + optional dep (commit `a282780`).**
- `package.json`: `chart.js@^4` in `devDependencies` + `peerDependencies` +
  `peerDependenciesMeta.chart.js.optional:true` (mirrors the `vite` optional-peer
  pattern). `npm install` pulled the official `chart.js` 4.5.1.
- `browser.ts`: `ChartNode` import; `chartInstances` (persistent across renders),
  `chartKeyCounter`, `chartKeysSeen` (per-render, reset at top of `render()`) fields;
  `case "chart"` dispatch; the `chart()` method (stable title-derived+ordinal key,
  `.vms-chart` wrapper + `<canvas>`, tone→token color via `getComputedStyle`, bar config,
  reuse-or-create keyed by stable key with `.update()` redraw-in-place); the async
  `loadChart()` (lazy `await import("chart.js")`, tree-shaken `Chart.register(BarController,
  BarElement, CategoryScale, LinearScale, Tooltip)`, construct); and `chartFailLoud()`
  (console.error fail-loud seam). Post-rebuild mark-sweep in `render()` destroys +
  drops any instance the new tree omitted.
- `default.css`: `.vms-chart { display:block; position:relative; width:100%; height:20rem; }`
  (bounded + positioned for Chart.js responsive sizing — shipped framework CSS).
- `check:core-globals` stays green — `getComputedStyle`/`canvas`/`Chart.js` live only in
  `browser.ts`; `index.ts` gained the TYPE only.

**Task 3 — adapter + validator tests (commit `ff5b842`).**
- `test/chart.test.ts` (vi.mock chart.js with a fake `Chart` recording ctor/update/destroy):
  `.vms-chart`+`<canvas>` structure; one bar `Chart` constructed with `type:"bar"` +
  `labels:["A","B"]` + `data:[3,7]` + `register` called; title config; redraw-in-place
  (`.update()` on changed data, no reconstruct); removal `.destroy()` mark-sweep + fresh
  reconstruct on re-add; ChartNode tree passes `validateActionNames` + `validateSectionAction`;
  a ChartNode adds no action (no false duplicate).
- `test/chart-missing-dep.test.ts` (own file so the "missing" mock can't leak): a rejected
  `import("chart.js")` fails loud via `console.error` (spied deterministically), not a
  silent no-op and not a floating unhandled rejection.

## Deviations from Plan

**1. [Rule 3 — test structure] Fail-loud test split into a sibling file.**
- **Found during:** Task 3.
- **Issue:** The fail-loud case needs `import("chart.js")` to REJECT (a throwing `vi.mock`
  factory), while the other tests need it to RESOLVE to a working fake. vitest applies a
  module mock per-file, so a single file cannot hold both a resolving and a rejecting mock
  of the same module without brittle `vi.resetModules()` ordering.
- **Fix:** Put the fail-loud assertion in `test/chart-missing-dep.test.ts` (its own module
  registry). The plan's `<action>` explicitly sanctioned "a SEPARATE test file section or
  `vi.doMock`"; this is the cleaner, zero-flake option. Both files are committed; the
  fail-loud contract is proven deterministically.
- **Files:** `viewmodel-shell/test/chart-missing-dep.test.ts` (new).
- **Commit:** `ff5b842`.

**2. [Repo working-agreement override] No STATE.md / ROADMAP / REQUIREMENTS bookkeeping.**
- The generic GSD state-update step maintains a `STATE.md` ledger. This repo's `AGENTS.md`
  explicitly overrides that: "This repo deliberately has NO maintained narrative state
  file … Do not recreate one … ROADMAP.md may be READ for context, but is not to be
  maintained as session bookkeeping." Honored — only this SUMMARY.md was written (the
  plan's sole `<output>`). No version bump / publish / tag / `agent-skill.md` edit
  (deferred to Phase 13 per the plan).

No other deviations — the approved wire schema was implemented exactly.

## Gate results (green-tree gate for this plan)

- `npx vitest run` (jsdom): **512 passed, 1 skipped** across 42 files (chart tests + no regressions).
- `npm run build` (tsc `-b tsconfig.tui.json`): **exit 0**.
- `npm run check:core-globals`: **green** (index.ts references zero platform globals).
- `dotnet build` (framework project): **0 warnings, 0 errors**.
- `dotnet test viewmodel-shell-dotnet/Tests`: **99 passed, 0 failed**.

(The full parity suite + demo tests are deliberately out of scope for this plan — plan 12-02 / Phase 13.)

## Notes for downstream (Phase 13 / plan 12-02)

- **Parity fixture (12-02):** use WHOLE-NUMBER `value`s so `System.Text.Json` (`double` → `12`)
  and `JSON.stringify` (`12`) stay byte-identical — the neutralization the schema relies on.
- **agent-skill.md (CHART-06, Phase 13):** ChartNode is NOT yet documented in the agent skill;
  edit both the TS `agent-skill.md` and the .NET `AgentSkill.md` copy together so the parity
  skill gate stays green.
- **Real pixels** (bars/colors/title) are jsdom-untestable and verified by the Phase 13
  operator browser review (CHART-06).

## Self-Check: PASSED
