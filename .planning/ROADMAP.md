# Roadmap: ViewModel Shell

## Milestones

- ✅ **0.3.13 Platform-Agnosticism** — Phases 1–2 (shipped 2026-05-15) — [archive](./milestones/0.3.13-ROADMAP.md)
- ✅ **0.4.0 Design System** — Phases 3–5 (shipped 2026-05-18; npm + NuGet 0.4.1)
- ✅ **1.0.0 Truly Self-Describing Wire** — Phases 6–7 (shipped 2026-06-08; npm + NuGet 1.0.0)
- ✅ **v1.12 Layout System Completeness** — Phases 8–11 (shipped 2026-06-24; npm 1.12.0 / NuGet 1.10.0)
- ✅ **v4.1 Data Visualization** — Phases 12–13 (shipped 2026-07-08; npm + NuGet `4.1.0`) — `ChartNode` primitive, closed issue #6
- ✅ **v4.2 Non-Blocking Actions** — Phases 14–16 (shipped 2026-07-08; npm + NuGet `4.2.0`) — `blocking:false` dispatch + client-side lane-aware epoch; fixed the single-mutex poll/user contention; resurrected `selection.action` correctly; human-verified via 3 tailnet demo apps. Phase 17 (admission barrier) stays CONDITIONAL/unbuilt (design of record: [non-blocking-actions.md](./design/non-blocking-actions.md))
- ✅ **v5.0 Chart Base Set + batch** — Phases 18–19 (shipped 2026-07-09; npm + NuGet `5.0.0`, tag `v5.0.0`) — multi-series `ChartNode` (kinds `bar|line|area|pie|donut`, `--vms-chart-1..8` palette + per-series `tone`; **BREAKING** reshape, `points`→`labels`+`series`, taken while zero chart consumers) + `ButtonNode.confirm` (native destructive guard) + canonical reorder demo (up/down + move-to-group modal; DnD stays rejected) + `TablePagination.jumpAction`. Verified via a combined tailnet run-through (Ashley sign-off) incl. a chart legend/title contrast fix. Design of record: [chart-base-set.md](./design/chart-base-set.md)

**Post-v1.12 interstitial releases** (not phased milestones — direct feature commits + CHANGELOG, the same cadence as the 1.7–1.11 interstitials): **2.0.0** remove `SectionNode.flyout` (BREAKING), **2.1.0** `LinkNode.active`, **3.0.0** unified appearance axes (BREAKING — `variant` split into `tone`/`emphasis`/`size`/`state`/`style`), **3.0.1**/**3.0.2** CSS-only fixes, **3.1.0** admin-shell primitives (`ButtonNode.width`, `DividerNode`, `FormNode.submitButton`). Both registries currently at **3.1.0** (2026-06-26). See [CHANGELOG.md](../CHANGELOG.md) for the authoritative per-version history.

## Phases

**Phase Numbering:**
- Integer phases: Planned milestone work (numbering continues sequentially — v1.12 starts at Phase 8, the prior milestone ended at Phase 7)
- Decimal phases (e.g. 8.1): Urgent insertions (marked INSERTED)

<details>
<summary>✅ 0.3.13 Platform-Agnosticism (Phases 1–2) — SHIPPED 2026-05-15</summary>

- [x] Phase 1: Capability Seam Refactor (3/3 plans) — completed 2026-05-15
- [x] Phase 2: Upload Progress + Milestone Closeout (3/3 plans) — completed 2026-05-15

Full detail: [milestones/0.3.13-ROADMAP.md](./milestones/0.3.13-ROADMAP.md)

</details>

<details>
<summary>✅ 0.4.0 Design System (Phases 3–5) — SHIPPED 2026-05-18</summary>

- [x] Phase 3: Default Design System (3/3 plans) — completed 2026-05-17
- [x] Phase 4: Preset-Grid Layout (4/4 plans) — completed 2026-05-18
- [x] Phase 5: Canonical Examples + 0.4.0 Release Closeout (6/6 plans) — completed 2026-05-18

</details>

<details>
<summary>✅ 1.0.0 Truly Self-Describing Wire (Phases 6–7) — SHIPPED 2026-06-08</summary>

- [x] Phase 6: Wire Shape Change (5/5 plans) — completed 2026-06-07
- [x] Phase 7: Error Envelope + ok Flag + 1.0.0 Release Closeout (5/5 plans) — completed 2026-06-08

</details>

<details>
<summary>✅ v1.12 Layout System Completeness (Phases 8–11) — SHIPPED 2026-06-24</summary>

- [x] Phase 8: Alignment Enums + Layout Policy (2/2 plans) — completed 2026-06-24
- [x] Phase 9: Switcher + Cards minItem (2/2 plans) — completed 2026-06-24
- [x] Phase 10: Fits Node (2/2 plans) — completed 2026-06-24
- [x] Phase 11: Demo Verification Spread + Milestone Closeout — completed 2026-06-24

Shipped as one consolidated additive release (npm `1.12.0` / NuGet `1.10.0`): alignment enums (`arrange`/`align`), the `switcher` primitive, the `cards` `minItem` field, and the `fits` node — governed by the new Layout policy (AGENTS.md), grounded in `.planning/design/layout-system-research.md`. The whole vocabulary was human-verified in a browser before release (two real bugs — switcher always-stacked, fits always-first — were caught and fixed). Full detail: CHANGELOG `1.12.0 / 1.10.0` + phase artifacts under [.planning/phases/](./phases/) (08–11).

</details>

### 🚧 v4.1 Data Visualization (Phases 12–13) — IN PROGRESS

**Milestone Goal:** Add VMS's first data-visualization primitive — a structured `ChartNode` (bar, single-series, `title` + `tone`) whose payload is bounded declared data (a numeric series + labelled categories), rendered by Chart.js behind the browser adapter as a private implementation detail. Closes GitHub issue #6 (the lone open issue). Additive; the wire protocol token stays `viewmodel-shell/1.0`. Ships as an aligned minor (npm + NuGet `4.1.0`).

- [x] **Phase 12: ChartNode Primitive** (2/2 plans) — completed 2026-07-04 — Structured bar `ChartNode` across both backends + `browser.ts` renderer via lazy/optional Chart.js + both tree-validators + TUI degradation + parity/FeatureProbe + adapter/backend tests (green-tree gate green; agent-skill.md + release deferred to Phase 13)
- [x] **Phase 13: Data-Viz Verification + Release Closeout** — Operator browser sign-off on the rendered chart, CHANGELOG/MIGRATION, aligned `4.1.0` npm+NuGet release, tag, advance `main`, announce `#vms-changelog`, close issue #6 — ⏳ **operator sign-off RECEIVED 2026-07-08** (a chart grid/tick theme-token fix was applied during review — `browser.ts`); the `4.1.0` **publish is BATCHED into Phase 16's release session** per Ashley (avoid running the whole release ceremony twice) — its remaining deliverables (CHART-06 ChartNode `agent-skill.md` doc, CHART-07 4.1.0 publish/tag/announce/close #6) are carried by Phase 16 plans **16-05/16-06**. This checkbox resolves when Phase 16's release lands. No version bump yet.

### ⏳ v4.2 Non-Blocking Actions (Phases 14–17) — PLANNED

**Milestone Goal:** Give the dispatch loop a real concurrency model. Add the **non-blocking action** primitive (`blocking:false` on a dispatch, default `true` → fully backward-compatible): a silent round-trip that coexists with user actions instead of being silently dropped by today's single global dispatch mutex. Reconcile with a **client-side epoch/sequence counter** (stale/out-of-order responses discarded; no wire epoch, no server change) and **debounce/coalescing**. Fold `poll` into this path (fixing the poll/user-action contention) and **resurrect `selection.action`** correctly (the 0.15.0 rapid-toggle bug is fixed by optimistic-check + echo-back + epoch). Correctness stays server-side (re-validation + the `rejected` envelope). The admission barrier (hold-and-full-node-diff) is a **conditional Stage 2** (Phase 17), built only if intent-drift bites. Additive → wire token stays `viewmodel-shell/1.0`; ships as an aligned minor (npm + NuGet), sequenced after v4.1. Design of record: [design/non-blocking-actions.md](./design/non-blocking-actions.md).

- [x] **Phase 14: Non-blocking dispatch core** — `blocking:false` optional field (F2 WhenWritingDefault), replace the single dispatch mutex so a silent round-trip coexists with user actions, client-side epoch ordering (discard stale/out-of-order), debounce/coalesce rapid triggers to one in-flight; both backends + new parity fixtures (non-blocking dispatch, coalesced rapid fire, out-of-order discard). No admission barrier. — **COMPLETE** (3 plans + gap closure; NBA-01..04 verified 4/4 after fixing 2 dispatch-lane defects — see 14-VERIFICATION.md) (completed 2026-07-08)
- [x] **Phase 15: Poll-fold + `selection.action` resurrection** — `pollInterval` becomes sugar over the non-blocking path (kills the mutex contention); per-checkbox/selection server-refresh returns correctly (optimistic local check + echo-back so a stale response can't revert a rapid toggle); `agent-skill.md` note on `blocking:false` + byte-copy to `.NET AgentSkill.md`. (completed 2026-07-08)
- [x] **Phase 16: Test apps + human verification + release** — 3 purpose-built demo apps, each with a step-by-step "trigger X, then Y, expect Z" script (selection→live action bar; poll+user coexistence contrast; out-of-order staleness), served over the tailnet for operator sign-off; then aligned minor release npm+NuGet, tag, advance `main`, announce `#vms-changelog`.
- [ ] **Phase 17 (CONDITIONAL): Admission barrier (Stage 2)** — hold blocking actions while any non-blocking round-trip is in flight; full-node-diff at departure; drop on any difference. Built ONLY if transient intent-drift actually bites in PBMInvoices UX after Stage 1 ships.

## Phase Details

### Phase 12: ChartNode Primitive
**Goal**: A `ChartNode` renders a single-series bar chart (labelled categories × numeric values, `title` + `tone`) from structured wire data — declared and agent-legible, drawn by Chart.js as a private browser-adapter detail (lazy/optional dependency; core + .NET/bun backends stay dependency-free), redrawing in place on new server data, byte-identical across TS/.NET with BOTH tree-validators descending into it and parity/FeatureProbe green, plus a legible TUI degradation. Appearance is `title` + `tone` only — no raw CSS/config on the wire.
**Depends on**: Phase 11 (v1.12 baseline — parity green; current release 4.0.0)
**Requirements**: CHART-01, CHART-02, CHART-03, CHART-04, CHART-05
**Success Criteria** (what must be TRUE):
  1. A `ChartNode` carrying labelled categories + a numeric series renders a single-series bar chart in the browser, colored by its `tone` axis value, with an optional title (CHART-01, CHART-02).
  2. Returning a new view tree with changed chart data redraws the chart in place — no full-page reload (CHART-03).
  3. An app that renders no `ChartNode` ships zero Chart.js bytes; the core (`src/index.ts`) and the .NET/bun backends gain no dependency (CHART-04).
  4. The `ChartNode` round-trips byte-identically across TS + .NET, both tree-validators descend into it, and `bun run parity/run.ts` is green with a FeatureProbe fixture exercising it (CHART-05).
  5. The TUI adapter renders a defined legible fallback for a `ChartNode` (printed series / ASCII bars) instead of crashing (CHART-05).
**Plans**: 2 plans
- [x] 12-01-PLAN.md — ChartNode + ChartPoint wire type (both backends) + browser.ts bar renderer (lazy/optional Chart.js) + validators + adapter tests (wave 1) — completed 2026-07-04
- [x] 12-02-PLAN.md — TUI degradation + FeatureProbe/parity + Showcase demo + CHANGELOG (wave 2) — completed 2026-07-04
**UI hint**: yes

### Phase 13: Data-Viz Verification + Release Closeout
**Goal**: The rendered chart is human-verified in a browser and the milestone ships as an aligned additive minor (npm + NuGet `4.1.0`) with docs, git tag, `main` advanced, `#vms-changelog` announcement, and GitHub issue #6 closed — full green-tree gate at release time.
**Depends on**: Phase 12 (the `ChartNode` must exist to review and release)
**Requirements**: CHART-06, CHART-07
**Success Criteria** (what must be TRUE):
  1. The operator reviews the rendered `ChartNode` in a real browser (served over the tailnet) and signs off (CHART-06).
  2. `agent-skill.md` documents the `ChartNode` and is byte-identical to the .NET `AgentSkill.md` (parity gate green) (CHART-06).
  3. npm + NuGet `4.1.0` are published, tagged `v4.1.0`, with `main` advanced (verified `git merge-base --is-ancestor`) and `#vms-changelog` announced (CHART-07).
  4. GitHub issue #6 is closed with a comment citing the `4.1.0` release (CHART-07).
**Plans**: TBD (set by `/gsd:plan-phase 13`)
**UI hint**: no

### Phase 14: Non-blocking dispatch core
**Goal**: A dispatch can carry `blocking: false` (optional, default `true` → existing apps byte-unchanged). A non-blocking (silent) round-trip no longer occupies the single global dispatch mutex — it coexists with user actions instead of silently dropping them (or being dropped). Rapid non-blocking triggers debounce/coalesce to one in-flight request. A client-side epoch/sequence counter discards stale, out-of-order responses (last-writer-wins) with no wire epoch and no server change. Correctness comes from server re-validation + the `rejected` envelope; NO admission barrier this phase. Both backends stay byte-aligned (the optional bool follows the F2 `WhenWritingDefault` rule → absent-when-default on both), and new parity fixtures exercise a non-blocking dispatch, coalesced rapid fire, and out-of-order discard.
**Depends on**: Phase 13 (v4.1 released — clean baseline; parity green) — design of record `.planning/design/non-blocking-actions.md`
**Requirements**: NBA-01, NBA-02, NBA-03, NBA-04
**Success Criteria** (what must be TRUE):
  1. A dispatch with `blocking:false` runs a silent round-trip that does NOT trip the dispatch mutex or busy-lock; a user action fired while it is in flight is honored, not dropped (and vice versa) (NBA-01).
  2. Rapid `blocking:false` triggers coalesce to a single in-flight request (latest wins) (NBA-02).
  3. An out-of-order / late non-blocking response is discarded rather than clobbering a newer render, via a client-side sequence counter — no wire field, no server change (NBA-03).
  4. `blocking` is absent-when-default on BOTH backends (F2), the wire token stays `viewmodel-shell/1.0`, and `bun run parity/run.ts` is green with fixtures for non-blocking dispatch + coalesced rapid fire + out-of-order discard (NBA-04).
**Plans**: 3 plans
- [x] 14-01-PLAN.md — `ActionEvent.blocking` + two-lane dispatch loop (mutex replacement, coalescing, epoch) in `index.ts` + full `browser.ts` propagation fix + vitest coverage for NBA-01/02/03 (wave 1)
- [x] 14-02-PLAN.md — .NET `ActionDescriptor.Blocking` (`bool?` + `WhenWritingNull`) + serialization tests (wave 1, independent of 14-01)
- [x] 14-03-PLAN.md — FeatureProbe parity fixture proving `blocking` is byte-identical/absent-when-default across backends (NBA-04) + full Phase 14 green-tree gate (wave 2, depends on 14-01 + 14-02)
**UI hint**: no

### Phase 15: Poll-fold + `selection.action` resurrection
**Goal**: `pollInterval` becomes sugar over the non-blocking dispatch path, so the today-observed single-mutex contention (a poll in flight silently dropping a user click) is gone. Per-checkbox / table-selection server-refresh returns as a first-class pattern, correctly this time: the checkbox checks immediately (optimistic local `bind` write) AND fires a `blocking:false` action whose returned tree echoes the selection back, so a stale response can never revert a rapid toggle (the exact 0.15.0 failure that got `selection.action` removed). `agent-skill.md` gains a note on `blocking:false` semantics, byte-copied to `.NET AgentSkill.md` (parity gate diffs both).
**Depends on**: Phase 14 (the non-blocking primitive + epoch must exist)
**Requirements**: NBA-05, NBA-06, NBA-07
**Success Criteria** (what must be TRUE):
  1. An app configuring `pollInterval` runs its polls over the non-blocking path; a user action clicked during a poll round-trip is honored, not dropped (NBA-05).
  2. Rapid checkbox/selection toggling with a `blocking:false` refresh never visually reverts a checked box, and the server-computed fragment (e.g. an action bar) reflects the latest coalesced selection (NBA-06).
  3. `agent-skill.md` documents `blocking:false` and is byte-identical to `.NET AgentSkill.md` (parity gate green) (NBA-07).
**Plans**: 3 plans
- [x] 15-01-PLAN.md — TS dispatch-loop: NBA-06 coalesce-pending discard fix + NBA-05 real-pollInterval-timer docs/tests + adapter-level rapid-toggle proof (wave 1)
- [x] 15-02-PLAN.md — agent-skill.md `blocking:false` section + byte-copy to .NET AgentSkill.md + skill parity check (wave 1)
- [x] 15-03-PLAN.md — full green-tree gate re-run + NBA-05/06/07 requirement-to-artifact cross-check (wave 2, depends on 15-01 + 15-02)
**UI hint**: yes

### Phase 16: Test apps + human verification + release
**Goal**: Three purpose-built demo apps — each shipped with a step-by-step "trigger X, then Y, expect Z" script so coverage is explicit — let the operator verify the concurrency behavior in a real browser: (1) selection → live server-computed action bar (the PBMInvoices shape); (2) poll + user-action coexistence (today-vs-fixed contrast); (3) out-of-order/staleness (a delayed background response discarded). Served over the tailnet for sign-off. Then the milestone ships as an aligned additive minor (npm + NuGet) with CHANGELOG/MIGRATION, git tag, `main` advanced (verified `git merge-base --is-ancestor`), and `#vms-changelog` announced — full green-tree gate at release time.
**Depends on**: Phase 15 (the full Stage-1 behavior must exist to demo + release)
**Requirements**: NBA-08, NBA-09 — PLUS the **batched** deferred chart requirements **CHART-06, CHART-07** (the v4.1 release closeout was folded into this session per Ashley's "don't run the release ceremony twice"; see Phase 13). The release plans (16-05/16-06) close all four.
**Success Criteria** (what must be TRUE):
  1. The 3 demo apps + their trigger scripts exist, are served over the tailnet, and the operator signs off that rapid-toggle, poll-coexistence, and staleness all behave as specified (NBA-08).
  2. The release session ships BOTH `4.1.0` (chart: ChartNode `agent-skill.md` doc [CHART-06], CHANGELOG extracted out of the mis-nested `## 1.12.0` draft, tag, close issue #6 [CHART-07]) AND `4.2.0` (non-blocking) on npm + NuGet, tagged, `main` advanced (`git merge-base --is-ancestor`), full green-tree gate, `#vms-changelog` announced (NBA-09).
**Plans**: 6 plans
- [x] 16-01-PLAN.md — Demo: selection -> live server-computed action bar (NonBlockingActionBar-bun, port 3008)
- [x] 16-02-PLAN.md — Demo: poll + user-action coexistence (NonBlockingPoll-bun, port 3009)
- [x] 16-03-PLAN.md — Demo: out-of-order staleness discard (NonBlockingStaleness-bun, port 3010)
- [x] 16-04-PLAN.md — Combined verification script + operator sign-off checkpoint (NBA-08 gate)
- [x] 16-05-PLAN.md — Release prep: ChartNode agent-skill.md doc (CHART-06) + CHANGELOG/MIGRATION for 4.1.0+4.2.0 + green-tree gate
- [ ] 16-06-PLAN.md — Release execution: version bump, npm+NuGet publish, tag, advance main, announce, close issue #6 (CHART-07, NBA-09)
**UI hint**: yes

### Phase 17: Admission barrier (Stage 2) — CONDITIONAL
**Goal**: (Built ONLY if transient intent-drift actually bites in PBMInvoices UX after Stage 1 ships.) When a blocking action is triggered while any non-blocking round-trip is in flight, hold it until that round-trip resolves and the tree reaches the new epoch, then compare the clicked node's click-time snapshot against the current-epoch tree; if the node is missing or differs in any part, drop the action rather than dispatch a different action than the user believed they triggered. Global barrier (not scoped to affected nodes — scoping would require app-ish client reasoning). The dropped-action UX (silent vs surfaced) is decided as part of this phase, not left silent.
**Depends on**: Phase 16 (Stage 1 shipped + observed); GATED on a real intent-drift report
**Requirements**: NBA-10 (conditional)
**Success Criteria** (what must be TRUE):
  1. A blocking action whose target node changed under an in-flight non-blocking round-trip is not dispatched with stale intent; the outcome is surfaced to the user, not silently swallowed (NBA-10).
**Plans**: TBD — do NOT plan until a concrete intent-drift case is reported
**UI hint**: yes

## ✅ v5.0 Chart Base Set (Phases 18–19) — SHIPPED 2026-07-09 (npm + NuGet `5.0.0`, tag `v5.0.0`)

**Milestone Goal:** Widen VMS's data-visualization primitive from the 4.1 single-series bar to a coherent, multi-series-native **base set** — `kind` ∈ `bar | line | area | pie | donut` over shared `labels[]` + `series[]`. This is a **breaking reshape of the published `ChartNode`** (removes `points`/`ChartPoint` for category charts), which we take now because **zero consumers have implemented a chart yet** — the free-reshape window closes on first adoption. Color stays framework-owned (`--vms-chart-1..8` theme-token palette) with an optional semantic per-series `tone`; **zero raw color on the wire**. Scatter (correlation, `{x,y}` shape) is **deferred** as the designed-for additive-next `kind`. Ships as an aligned **breaking major `5.0.0`** (npm + NuGet). Design of record: [design/chart-base-set.md](./design/chart-base-set.md).

### Phase 18: Chart Base Set primitive — multi-series-native ChartNode

**Goal:** A reshaped `ChartNode` (`kind` ∈ `bar|line|area|pie|donut`; shared `labels: string[]` + `series: [{name, data: number[], tone?}]`; `stacked?` for bar/area; `title?`) renders every base-set chart type from structured wire data — multi-series where it applies, single-series as one entry — drawn by the existing lazy/optional Chart.js browser-adapter binding (core + .NET/bun stay dependency-free), colored by a framework-owned `--vms-chart-1..8` theme palette with optional semantic per-series `tone`, byte-identical across TS/.NET with both tree-validators descending into it and parity green. Zero raw color/CSS on the wire.
**Requirements**: CHARTBASE-01, CHARTBASE-02, CHARTBASE-03, CHARTBASE-04, CHARTBASE-05, CHARTBASE-06
**Depends on:** Phase 16 (v4.2 baseline — parity green; current release 4.2.0). NOT Phase 17 (conditional/unbuilt).
**Success Criteria** (what must be TRUE):
  1. A `ChartNode` with `kind` `bar`/`line`/`area`/`pie`/`donut` and one-or-more `series` over shared `labels` renders correctly in the browser; multi-series bar groups (or stacks when `stacked`), multi-line overlays, pie/donut draw `series[0]` as slices.
  2. Series colors come from the `--vms-chart-1..8` theme palette by default; a series with `tone` uses the theme tone token; **no raw color crosses the wire**; the palette tokens exist in `default.css` + every theme and each slot's contrast is hand-checked.
  3. `ChartPoint` is retired for category charts; `ChartNode`/`ChartSeries` round-trip byte-identically across TS + .NET (optional-field rules honored: `WhenWritingNull` / `stacked` `WhenWritingDefault`), both tree-validators descend into the leaf, and `bun run parity/run.ts` is green with a multi-series + tone + stacked fixture.
  4. An app that renders no `ChartNode` ships zero Chart.js bytes; core (`src/index.ts`) + the .NET/bun backends gain no dependency. TUI degrades legibly.
**Plans:** 6/6 plans complete
- [x] 18-01-PLAN.md — Reshape ChartNode + ChartSeries wire type (both backends) + .NET serialization test; retire ChartPoint (wave 1)
- [x] 18-02-PLAN.md — --vms-chart-1..8 categorical palette in default.css + all 12 themes + contrast hand-check (wave 1)
- [x] 18-03-PLAN.md — Browser adapter: widen chart()/loadChart() to bar/line/area/pie/donut + multi-series + stacked + palette/tone; update chart tests + Showcase (wave 2)
- [x] 18-04-PLAN.md — TUI ChartView degradation for the reshaped multi-series node + TUI test (wave 2)
- [x] 18-05-PLAN.md — Parity: reshape FeatureProbe chart fixture (multi-series+tone+stacked) both backends + agent-skill.md reconcile/byte-copy; parity green (wave 2)
- [x] 18-06-PLAN.md — Full green-tree gate + CHARTBASE-01..06 requirement-to-artifact cross-check (wave 3)

### Phase 19: Chart verification page + 5.0.0 release closeout

**Goal:** A human-runnable tailnet verification page (real shipped CSS + real renderer/bundle) renders every kind × single- and multi-series × a tone-bearing series × a stacked case with a "confirm these" checklist for Ashley to run through — the in-question publish gate (charts are a visual change → **do NOT publish 5.0.0 until she confirms**). Then CHANGELOG + MIGRATION (the `ChartNode` reshape), aligned **breaking `5.0.0`** npm + NuGet release, tag `v5.0.0`, advance `main`, watch CI green, announce `#vms-changelog`.
**Requirements**: TBD (set in plan-phase)
**Depends on:** Phase 18
**Success Criteria** (what must be TRUE):
  1. The verification page exercises every base-set kind and the multi-series/tone/stacked cases, served over the tailnet; Ashley runs through it and confirms before any publish.
  2. `5.0.0` is published to npm + NuGet (aligned), tagged `v5.0.0`, `main` advanced to the release commit (`git merge-base --is-ancestor v5.0.0 main`), CI green, and a release line posted to `#vms-changelog`; MIGRATION documents the reshape (only break = the unused 4.1 single-series ChartNode).
**Plans:** 0 plans

Plans:
- [x] Release closeout done manually 2026-07-09 — combined tailnet verification (Ashley sign-off) + legend contrast fix; CHANGELOG/MIGRATION; npm+NuGet 5.0.0 published; tag v5.0.0; main advanced; CI green; announced #vms-changelog.

## 🚧 v5.1 Navigation Primitives (Phase 20) — PLANNED

**Milestone Goal:** Add the two orientation/navigation primitives VMS lacks — **BreadcrumbNode** (a "you are here" trail: ordered `items:[{label, href?}]`, last item = current page / non-clickable) and **StepsNode** (a stepper: `steps:[{label, description?}]` + a 0-based `current` index, per-step done/current/upcoming DERIVED from `current`; orientation = a closed-enum INTENT — default responsive-horizontal that auto-stacks to vertical intrinsically, plus an explicit `vertical` deliberate-wizard mode [A+C, Ashley 2026-07-11]) — plus the pointer-cursor-on-clickable-table-rows CSS finish. Both nodes were **surveyed against the mature frameworks** (MUI/Ant/Chakra/Bootstrap + WAI-ARIA APG) and confirmed standard + pure structured data: the framework owns separators/connectors/intrinsic reflow/all a11y, **zero appearance on the wire**. Additive → wire token stays `viewmodel-shell/1.0`. Aligned **npm + NuGet `5.1.0`** minor, batched into ONE verification page + ONE publish. Design of record: [design/nav-primitives.md](./design/nav-primitives.md).

### Phase 20: v5.1 Navigation Primitives — BreadcrumbNode + StepsNode + pointer-cursor fix

**Goal:** BreadcrumbNode + StepsNode ship across both backends as pure-structured-data nodes (framework draws all appearance + a11y), StepsNode supporting A+C orientation (responsive-horizontal default that auto-collapses vertical + a deliberate-vertical wizard intent), plus clickable table rows showing `cursor:pointer`; both tree-validators descend into the new nodes and parity is green with new FeatureProbe fixtures for each; then an aligned npm+NuGet `5.1.0` release gated on a tailnet verification page Ashley signs off.
**Requirements**: NAV-01, NAV-02, NAV-03, NAV-04
**Depends on:** Phase 19 (v5.0 baseline — parity green; current release npm `5.0.1` / NuGet `5.0.0`). Design of record: [design/nav-primitives.md](./design/nav-primitives.md).
**Success Criteria** (what must be TRUE):
  1. A BreadcrumbNode (`items:[{label, href? / action?}]`) renders a nav trail with the last item as the current page (`aria-current="page"`), a framework-drawn fixed separator inside a `<nav>` landmark + `<ol>`; byte-identical across TS/.NET, both tree-validators descend, parity green with a new FeatureProbe fixture.
  2. A StepsNode (`steps:[{label, description?}]` + `current`) renders done/current/upcoming purely from the current index in BOTH orientations — responsive-horizontal (auto-collapses to vertical intrinsically, no breakpoint) and the deliberate-vertical wizard — with correct a11y (`aria-current="step"`, non-interactive not focusable, NOT `role=progressbar`); byte-identical across backends; parity green with a new fixture.
  3. Clickable table rows (`TableRow.action`) show `cursor:pointer` on hover; CSS-only, no wire/type change.
  4. Aligned npm + NuGet `5.1.0` published (batched), tagged `v5.1.0`, `main` advanced to the release commit (`git merge-base --is-ancestor v5.1.0 main`), CI green, a release line posted to `#vms-changelog` — after a tailnet verification page (both nodes, both step orientations, a clickable-row cursor check, light + dark) Ashley confirms.
**Plans:** 7 plans

Plans:
- [ ] 20-01-PLAN.md — TS wire types (BreadcrumbNode + StepsNode) + both TS tree-validators (wave 1)
- [ ] 20-02-PLAN.md — .NET byte-identical twin records + discriminators + validators + serialization test (wave 1)
- [ ] 20-03-PLAN.md — browser.ts renderers + default.css (tokens only, intrinsic collapse, a11y) + jsdom tests + white-on-accent aa-contrast hand-check (wave 2)
- [ ] 20-04-PLAN.md — TUI legible degradation for both nodes (wave 2)
- [ ] 20-05-PLAN.md — FeatureProbe parity fixtures (both backends) + fixture doc + Showcase gallery entries; parity green (wave 2)
- [ ] 20-06-PLAN.md — Full green-tree gate + combined tailnet verification page + Ashley pre-publish sign-off (wave 3)
- [ ] 20-07-PLAN.md — CHANGELOG/MIGRATION + agent-skill no-change + version bump 5.1.0 + operator publish/tag/advance-main/announce (wave 4)
