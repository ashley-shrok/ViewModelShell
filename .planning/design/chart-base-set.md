# Chart Base Set — Design of Record

**Status:** design converged (Ashley + Vicky, 2026-07-09). Rationale-of-record for widening VMS's
data-visualization primitive from the single-series bar shipped in 4.1.0 to a coherent base set of
chart types. Origin: Ashley asked whether we only shipped one kind of chart and what a good base set
would be.

## The reshape is free right now — and only right now

4.1.0 shipped **one** chart type: a single-series bar (`ChartNode { kind?: "bar"; points: ChartPoint[]; title?; tone? }`,
`ChartPoint = {label, value}`). It was deliberately built for *additive* `kind` widening (the source
comment names `line` as the planned next value).

**Zero consumers have implemented a chart yet** (confirmed with Ashley). That is the load-bearing fact:
it means we are **not** forced into an awkward additive "keep `points` AND bolt on `series`" widening
to preserve a shape nobody depends on. We can reshape the wire to be **multi-series-native from the
ground up**, once, cleanly — and this window closes the moment the first consumer ships a chart. So we
take it now.

## Scope — the base set

Organized by the relationship each chart shows (the universal Chart.js / Recharts / Metabase taxonomy):

| Relationship | `kind` | In this cut? |
|---|---|---|
| Comparison across categories | `bar` | ✅ (grouped + stacked) |
| Trend over an ordered axis | `line`, `area` | ✅ (area = line + fill) |
| Part-to-whole / share | `pie`, `donut` | ✅ |
| Correlation between two variables | `scatter` | **deferred — additive-next** |

**v1 `kind` union: `"bar" | "line" | "area" | "pie" | "donut"`.** These four relationships over ONE
data shape (shared categories + series) cover the overwhelming majority of real app dashboards.
**Scatter is explicitly out of this cut** — not because it's unwanted, but because it needs a
different data shape (`{x,y}` points, no shared categories). Folding it in now would carry two data
shapes into a spec that's otherwise coherent. It's the designed-for *next* additive `kind` (see
"Designed-for future" below), exactly the way `line` was noted as additive in 4.1.

## Wire shape (the locked decisions)

Replaces the 4.1 single-series `ChartNode`. `ChartPoint` is retired for category charts.

```ts
export interface ChartSeries {
  /** Series name — rendered in the legend and read by agents to identify the series. */
  name: string;
  /** Values aligned by index to the chart's `labels`: data[i] is the value at labels[i]. */
  data: number[];
  /** OPTIONAL semantic tone from the existing closed tone axis. When set, this series is
   *  drawn in the theme's tone token (danger→--vms-error, etc.) instead of the next
   *  categorical-palette slot. For MEANING (a loss series → danger), not decoration.
   *  Omitted → framework assigns the next --vms-chart-N slot. NO raw color on the wire. */
  tone?: "danger" | "warning" | "success" | "info";
}

export interface ChartNode {
  type: "chart";
  /** CLOSED union; OMITTED = "bar". Widened additively later (scatter, …). */
  kind?: "bar" | "line" | "area" | "pie" | "donut";
  /** Shared category axis. labels[i] is the category for every series' data[i]. */
  labels: string[];
  /** One or more series over the shared labels. Single-series = exactly one entry. */
  series: ChartSeries[];
  /** bar/area only: stack series instead of grouping side-by-side. Omitted/false = grouped. */
  stacked?: boolean;
  /** Optional chart title rendered above the plot. */
  title?: string;
}
```

### Decision 1 — aligned `labels[]` + `series[].data[]` (a conscious reversal for multi-series)

The 4.1 single-series shape used self-contained `{label, value}` points *specifically* to avoid
parallel-array index alignment (its comment: "an agent reads the series DIRECTLY with no
parallel-array index alignment"). For **multi-series** we deliberately reverse that: shared `labels`
+ index-aligned `series[].data` is the correct model because it **structurally encodes "these series
share one x-axis"** — which is the actual semantic of a grouped bar / multi-line chart. The
self-contained alternative (each series repeats its own labels) is strictly worse here: redundant,
and ambiguous when two series disagree on their categories. The mild index-alignment cost is the
honest encoding of a shared axis, and it's the universal shape every charting library uses. Agents
still read `series[].name` + `labels` + `data` as plain structured data.

### Decision 2 — color: framework-owned palette + optional semantic `tone`, never raw color

Three tiers, all theme-token, zero inline hex on the wire — identical to how color already works for
buttons/badges/sections:

1. **Default** — the framework cycles a **categorical palette from theme tokens** (`--vms-chart-1 … --vms-chart-8`,
   shipped in `default.css` + every theme; the adapter assigns the next slot per series). The app
   sends no color. This is the common case: the reader needs *distinguishable* series, not specific
   hues, and a curated palette beats hand-picking (the reason our dataviz guidance exists).
2. **Semantic per-series** — an optional `tone?` on a *series*, from the existing closed tone union.
   Covers the one legitimate expectation for app-controlled color: when a color *means* something
   (revenue→success, loss→danger). It resolves to the theme's tone token — a meaning, agent-readable,
   still no raw color.
3. **Whole-app brand control** — a consumer needing exact brand hues retunes the `--vms-chart-*`
   **theme tokens** via the existing `--vms-*` override seam, once, for the whole app; every chart
   picks them up. Same answer VMS already gives for "I want a custom button color": reskin at the
   token layer, not inline.

**Per-datum raw color never crosses the wire.** That's not a chart-specific rule — it's the framework's
universal no-raw-color/no-decoration posture, and charts staying consistent with it is the point.

### Per-kind rendering notes

- **Palette colors by SERIES for bar/line/area; by LABEL (slice) for pie/donut** — standard, and what
  Chart.js does natively.
- **pie/donut are single-series**: the renderer draws `series[0]`; additional series are ignored (a
  validator warning, not a hard error — lenient render). `donut` = `pie` with a center cutout.
- **`stacked`** applies to `bar` and `area`; ignored elsewhere.
- **Legend** is auto-rendered from `series[].name` by the adapter — no wire field. (A single-series
  chart can suppress it in the adapter; not a wire concern.)

## Deferred / explicitly out of v1

- **Scatter / bubble** — the designed-for additive-next `kind`. See below.
- **Axis titles** (`xLabel`/`yLabel`) — kept out to stay minimal (the same discipline that kept the
  4.1 bar minimal so it never grew a CSS surface). Add later only on a real request.
- **Distribution charts** (histogram, box-plot) — more specialized; not base-set.
- **Any raw color / per-datum styling / axis CSS knob** — rejected, permanently (decoration).

## Designed-for future (so scatter never forces a second reshape)

Scatter/bubble is correlation: two continuous variables, no shared category axis. It slots in
additively as a new `kind` whose series carry `points: {x:number,y:number}[]` instead of
`data:number[]`, and such a chart omits `labels`. Concretely that means when scatter lands, `labels`
relaxes from required to optional (a backward-compatible relaxation — every existing category chart
still sends it; the closed `kind` union tells the renderer which shape to expect). We do **not** build
this now, but the shape above is chosen so scatter is a pure addition, not a reshape.

## Cross-cutting impact

- **Both backends** — `ChartNode` + `ChartSeries` in `viewmodel-shell/src/index.ts` and
  `viewmodel-shell-dotnet/ViewModels.cs` (retire `ChartPoint` for category charts; both are
  action-free leaves → no validator recursion, same as 4.1). Honor the file-header optional-field
  rules (nullable → `WhenWritingNull`; the optional `stacked` bool → `WhenWritingDefault` so `false`
  is absent, per gotcha #8 / F2).
- **Parity** — extend the chart fixture(s) in `parity/` to a multi-series, tone-bearing, stacked case
  so TS/.NET wire byte-parity is enforced; whole-number values keep the wire byte-identical across
  STJ / `JSON.stringify`.
- **Browser adapter** — the existing lazy/optional Chart.js binding widens to the new kinds +
  multi-series datasets + palette-token resolution. Core, `.NET`, and the bun backend stay
  dependency-free (data only crosses the wire).
- **Theme tokens** — add `--vms-chart-1 … --vms-chart-8` to `default.css` + every theme file;
  hand-check each palette slot's contrast on its plot background (the aa-contrast gate covers a FIXED
  pair-set and will NOT auto-cover new chart-palette pairs — banked lesson).
- **agent-skill.md** — chart types are not in the protocol-token-scoped verb/envelope surface the
  skill enumerates, so likely no change; confirm during build (and re-copy to the .NET `AgentSkill.md`
  if it does change, per the parity gate).
- **Demo** — extend the chart demo (or `FeatureProbe`) to render every kind statically for the visual
  gate; served over the tailnet for Ashley's eyes before publish (charts are a visual change → the
  "in-question" path applies; do NOT auto-publish without her confirmation).
- **Docs** — CHANGELOG entry; MIGRATION note for the ChartNode reshape.

## Decisions — LOCKED (Ashley + Vicky, 2026-07-09)

1. **Version: `5.0.0`** (major). Removing `points` from the published `ChartNode` is a breaking change
   under strict semver even with zero consumers; we take the honest major, because downstream trust in
   our versioning is load-bearing. MIGRATION note states the only break is the unused 4.1 single-series
   ChartNode.
2. **v1 kind set: `bar | line | area | pie | donut`.** Scatter deferred as the designed-for
   additive-next `kind` (keeps this cut to one coherent data shape).
3. **Palette: 8 categorical slots** (`--vms-chart-1 … --vms-chart-8`) in `default.css` + every theme.

## Deliverable — human-runnable verification page (standing directive, 2026-07-09)

Per the standing directive: this feature closes out with a **page Ashley can open and run through** —
every kind (bar/line/area/pie/donut) × single- and multi-series × a tone-bearing series × a stacked
case — served over the tailnet (`100.` address, real shipped CSS + real renderer/bundle), with a short
"confirm these" checklist. Charts are a visual change → the in-question publish gate applies: **do NOT
publish 5.0.0 until Ashley has run through the page and confirmed.**
