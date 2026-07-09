# Phase 18: Chart Base Set primitive — Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Source:** Design of record (LOCKED with Ashley 2026-07-09) — `.planning/design/chart-base-set.md`

<domain>
## Phase Boundary

Reshape VMS's data-visualization primitive from the 4.1 **single-series bar** (`ChartNode { kind?:"bar"; points: ChartPoint[]; title?; tone? }`) to a **multi-series-native base set**. This is a **breaking reshape of the published `ChartNode`** — taken now because **zero consumers have implemented a chart yet** (the free-reshape window closes on first adoption). This phase delivers the primitive + rendering + palette + parity. It does **NOT** cut the release — the verification page + `5.0.0` release closeout is Phase 19.

**In scope:** the reshaped wire type (both backends), the `--vms-chart-1..8` theme palette, the browser adapter widening (multi-series + line/area/pie/donut), parity, tree-validator leaf pass-through, TUI degradation, and the green-tree gate staying green.

**Out of scope (Phase 19):** the human-runnable tailnet verification page, CHANGELOG/MIGRATION, the `5.0.0` publish/tag/announce.

**Explicitly deferred (NOT this milestone):** scatter/bubble (correlation, `{x,y}` shape) — the designed-for additive-next `kind`.
</domain>

<decisions>
## Implementation Decisions (all LOCKED — do NOT re-open)

### Wire shape (both backends: `viewmodel-shell/src/index.ts` + `viewmodel-shell-dotnet/ViewModels.cs`)
- **`ChartNode`** replaces `points` with: `kind?: "bar" | "line" | "area" | "pie" | "donut"` (OMITTED = "bar"), `labels: string[]` (shared category axis), `series: ChartSeries[]`, `stacked?: boolean` (bar/area only), `title?: string`.
- **`ChartSeries`** = `{ name: string; data: number[]; tone?: "danger" | "warning" | "success" | "info" }`. `data[i]` aligns by index to `labels[i]`.
- **`ChartPoint` is retired for category charts** (the 4.1 `{label,value}` type). Single-series is just `series` with one entry.
- **Data model = aligned `labels[]` + `series[].data[]`** — the honest encoding of "these series share one x-axis." A conscious reversal of the 4.1 self-contained-point choice, correct for multi-series.
- **Optional-field wire rules (gotcha #8 / F2):** nullable members carry `[JsonIgnore(WhenWritingNull)]`; the optional `stacked` bool carries `[JsonIgnore(WhenWritingDefault)]` so `false` is ABSENT (matches TS optional `stacked?`). `ChartNode`/`ChartSeries` are action-free LEAVES — both tree-validators (`WalkForSectionAction` / `Collect`) fall through with no recursion (no fits-style blind spot). `data` values are `number`/`double`; whole-number fixtures keep the wire byte-identical across STJ / `JSON.stringify`.

### Color (three tiers, all theme-token, ZERO raw color on the wire)
1. **Default** — the browser adapter cycles a **categorical palette from theme tokens** `--vms-chart-1 … --vms-chart-8`, shipped in `styles/default.css` + **every** theme file under `styles/themes/`; the adapter assigns the next slot per series (per SLICE for pie/donut).
2. **Semantic per-series** — an optional `tone?` on a *series* (the existing closed tone union) → the theme's tone token (`danger→--vms-error`, etc.) instead of the next palette slot. For meaning (loss→danger), agent-readable.
3. **Whole-app brand** — a consumer retunes the `--vms-chart-*` theme tokens via the existing `--vms-*` override seam; every chart picks them up. Same as any reskin.
- **Contrast:** the `check:aa-contrast` gate covers a FIXED pair-set and does **NOT** auto-cover new chart-palette pairs — **hand-check each `--vms-chart-N` slot's contrast** against its plot background in the default + every theme (banked lesson).

### Rendering (browser adapter — the existing lazy/optional Chart.js binding)
- Widen to multi-series + `line` / `area` (= line + fill) / `pie` / `donut` (= pie + center cutout). `stacked` applies to bar/area; ignored elsewhere.
- **pie/donut are single-series**: render `series[0]`, colored per-SLICE from the palette; extra series ignored (validator/dev warning, lenient render).
- **Legend** auto-rendered from `series[].name` (no wire field).
- **core (`src/index.ts`), the .NET backend, and the bun backend stay DEPENDENCY-FREE** — only data crosses the wire; Chart.js is a private, lazy, optional adapter dependency (an app with no `ChartNode` ships zero Chart.js bytes).
- **TUI** degrades legibly (printed series / ASCII), never crashes.

### Parity
- Extend the chart fixture in `parity/` to a **multi-series + tone-bearing + stacked** case so TS/.NET wire byte-parity is enforced.
</decisions>

<canonical_refs>
## Canonical References — MUST read before planning/implementing

### Design of record (authoritative — all decisions settled here)
- `.planning/design/chart-base-set.md` — the locked shape, color model, deferred scatter, and the LOCKED decisions block.

### The primitive being reshaped + framework rules
- `viewmodel-shell/src/index.ts` — current `ChartNode`/`ChartPoint` (the 4.1 single-series shape to replace); the `ViewNode` union.
- `viewmodel-shell-dotnet/ViewModels.cs` — the .NET twin + the file-header optional-field rules (`WhenWritingNull` / `WhenWritingDefault`); `[JsonDerivedType]` discriminators.
- `viewmodel-shell/src/browser.ts` — the existing lazy/optional Chart.js binding + emitted DOM/classes to widen.
- `viewmodel-shell/styles/default.css` + `viewmodel-shell/styles/themes/*.css` — where the `--vms-chart-1..8` palette tokens ship (every theme).
- `parity/` (`backends.json`, `run.ts`, the chart fixture) — the cross-backend byte-parity harness to extend.
- `AGENTS.md` — Critical gotchas (#8 optional-field wire rules), the VMS design philosophy, the green-tree gate, and the concern→source table (node set is in the type source, not enumerated in docs).

### Prior-art analog (the 4.1 single-series ChartNode this reshapes)
- `.planning/phases/12-chartnode-primitive/` — Phase 12 plans/artifacts: how the original ChartNode + its Chart.js binding + parity/FeatureProbe + TUI degradation were structured. Mirror this structure.
</canonical_refs>

<specifics>
## Requirement IDs (every ID MUST appear in a plan's `requirements` field)

- **CHARTBASE-01** — Reshaped `ChartNode` + `ChartSeries` wire type in BOTH backends (kinds bar|line|area|pie|donut; `labels[]` + `series[{name,data,tone?}]`; `stacked?`; `title?`); `ChartPoint` retired for category charts; optional-field rules honored; both tree-validators fall through the leaf.
- **CHARTBASE-02** — `--vms-chart-1..8` categorical palette tokens in `default.css` + every theme; framework-palette-by-default + optional per-series `tone` override; zero raw color on the wire; each slot's contrast hand-checked against its plot background.
- **CHARTBASE-03** — Browser adapter renders every base-set kind (bar/line/area/pie/donut) + multi-series + `stacked`, via the lazy/optional Chart.js binding, with palette/tone resolution; core + .NET + bun backends stay dependency-free.
- **CHARTBASE-04** — Parity: a multi-series + tone + stacked fixture is byte-identical across TS/.NET; `bun run parity/run.ts` green.
- **CHARTBASE-05** — TUI adapter degrades legibly for the reshaped ChartNode (printed series / ASCII), never crashes.
- **CHARTBASE-06** — Green-tree gate stays green: `npx vitest run` (jsdom — NOT `bun test`), parity, `npm run check:core-globals`, the framework's own `viewmodel-shell-dotnet/Tests`, and every `demo/**/*.Tests.csproj`.
</specifics>

<deferred>
## Deferred Ideas

- **Scatter / bubble** (correlation, `{x,y}` series shape, no shared `labels`) — the designed-for additive-next `kind`; the v1 shape is chosen so scatter slots in without a second reshape.
- **Axis titles** (`xLabel`/`yLabel`), distribution charts (histogram/box-plot), any raw-color / per-datum styling / axis CSS knob — out (decoration / non-base-set).
- **The verification page + `5.0.0` release closeout** — Phase 19, not this phase.
</deferred>

---

*Phase: 18-chart-base-set-primitive*
*Context synthesized 2026-07-09 from the locked design of record.*
