# Roadmap: ViewModel Shell

## Milestones

- ✅ **0.3.13 Platform-Agnosticism** — Phases 1–2 (shipped 2026-05-15) — [archive](./milestones/0.3.13-ROADMAP.md)
- ✅ **0.4.0 Design System** — Phases 3–5 (shipped 2026-05-18; npm + NuGet 0.4.1)
- ✅ **1.0.0 Truly Self-Describing Wire** — Phases 6–7 (shipped 2026-06-08; npm + NuGet 1.0.0)
- ✅ **v1.12 Layout System Completeness** — Phases 8–11 (shipped 2026-06-24; npm 1.12.0 / NuGet 1.10.0)
- ✅ **v4.1 Data Visualization** — Phases 12–13 (shipped 2026-07-08; npm + NuGet `4.1.0`) — `ChartNode` primitive, closed issue #6
- ✅ **v4.2 Non-Blocking Actions** — Phases 14–16 (shipped 2026-07-08; npm + NuGet `4.2.0`) — `blocking:false` dispatch + client-side lane-aware epoch; fixed the single-mutex poll/user contention; resurrected `selection.action` correctly; human-verified via 3 tailnet demo apps. Phase 17 (admission barrier) stays CONDITIONAL/unbuilt (design of record: [non-blocking-actions.md](./design/non-blocking-actions.md))
- ✅ **v5.0 Chart Base Set + batch** — Phases 18–19 (shipped 2026-07-09; npm + NuGet `5.0.0`, tag `v5.0.0`) — multi-series `ChartNode` (kinds `bar|line|area|pie|donut`, `--vms-chart-1..8` palette + per-series `tone`; **BREAKING** reshape, `points`→`labels`+`series`, taken while zero chart consumers) + `ButtonNode.confirm` (native destructive guard) + canonical reorder demo (up/down + move-to-group modal; DnD stays rejected) + `TablePagination.jumpAction`. Verified via a combined tailnet run-through (Ashley sign-off) incl. a chart legend/title contrast fix. Design of record: [chart-base-set.md](./design/chart-base-set.md)
- ✅ **v8.0.0 Composite-Nodes Layer** — Phases 23–26 (shipped 2026-07-30; npm + NuGet `8.0.0`, tag `v8.0.0`) — Route B composite recipes atop primitive axes: **4 foundations** (COMP-01..04: TextNode caption tier + weight axis, CheckboxNode variant switch, AvatarNode) + **10 composite recipes** (COMP-05..13a: ListRow + ListNode rows variant, Message + MessageList with follow-tail, Alert, EmptyState BREAKING rewrite, UserRow, DetailRow + DetailList with `<dl>/<dt>/<dd>` semantics, TimelineEntry + Timeline with baked-in `::before` rail-and-dot CSS, SettingRow + SettingList natural switch pairing, Chip + ChipList with caller-supplied `dismissAction`) + **1 new primitive** (DividerNode) + **3 wire tweaks**. **BREAKING** = `EmptyStateNode` field rename only (`{heading, message}` → `{icon?, title, description?}`); every other change additive. Verified via comprehensive tailnet page with full-milestone visual sign-off + green-tree gate at release commit. Design of record: [composite-nodes-layer.md](./design/composite-nodes-layer.md)

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

## ✅ v5.1 Navigation Primitives (Phase 20) — SHIPPED 2026-07-11 (npm + NuGet `5.1.0`, tag `v5.1.0`)

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
- [x] 20-01-PLAN.md — TS wire types (BreadcrumbNode + StepsNode) + both TS tree-validators (wave 1) ✅ 2026-07-11
- [x] 20-02-PLAN.md — .NET byte-identical twin records + discriminators + validators + serialization test (wave 1) ✅ 2026-07-11
- [x] 20-03-PLAN.md — browser.ts renderers + default.css (tokens only, intrinsic collapse, a11y) + jsdom tests + white-on-accent aa-contrast hand-check (wave 2) ✅ 2026-07-11
- [x] 20-04-PLAN.md — TUI legible degradation for both nodes (wave 2) ✅ 2026-07-11
- [x] 20-05-PLAN.md — FeatureProbe parity fixtures (both backends) + fixture doc + Showcase gallery entries; parity green (wave 2) ✅ 2026-07-11
- [x] 20-06-PLAN.md — Full green-tree gate + combined tailnet verification page + Ashley pre-publish sign-off (wave 3) — gate GREEN, `demo/NavVerification-bun/` page served over the tailnet, Ashley signed off ✅ 2026-07-11
- [x] 20-07-PLAN.md — CHANGELOG/MIGRATION + agent-skill no-change + version bump 5.1.0 + publish/tag/advance-main/announce (wave 4) ✅ 2026-07-11

## ✅ v5.2 Lookup / remote-search reference field (Phase 21) — SHIPPED 2026-07-16 (npm + NuGet `5.2.0`, tag `v5.2.0`)

**Milestone Goal:** Close the primitive VMS has been missing since the beginning: `select`/`select-multiple` both assume the option set can be **enumerated into the tree**, so the moment the set is a 5,000-person directory or an 80,000-row customer table VMS has no answer and the app is forced into a workaround (which by our own rule is the signal a primitive is missing). The industry calls it a **lookup / reference / relation** field — conceptually NOT a big select: a select says *"here are all the values, pick one"*; a lookup says *"the values are a database table, describe which row you mean."* Bread-and-butter for the workflow/queue/admin tools VMS targets (assign a ticket to one of 5k agents; attach an invoice to one of 80k customers). **The gap predates the request that surfaced it** (a Metis @mention brief) and is not shaped by it — inline caret-spliced @mention is explicitly OUT ("maybe we do text editing but certainly not right now", Ashley 2026-07-16).

Surveyed three ways before designing (borrow-before-inventing): mature component libraries, **enterprise reference fields** (the only surveyed systems that are server-driven like us, hence the only ones that solved label resolution honestly), and the combobox a11y contract. Design of record: [design/lookup-field.md](./design/lookup-field.md) — **read it before proposing any change here.**

**The load-bearing decision (D1): the label is VIEW, not STATE.** `bind` holds the id; the node carries a server-computed label; **direction is the whole safety argument** — the label is server→client only, recomputed every render, never trusted coming back. All seven surveyed enterprise platforms store the id alone, and staleness appears in ZERO of their docs because there is no copy to drift. Resolving the label out of the *candidate list* is the trap (filter the list ⇒ forget what's selected — the same operation); Ant Design ships that failure silently by rendering the raw id, and Salesforce needed a whole non-blocking error code (`ERR_RP004`) purely because their picker is handed a bare id.

### Phase 21: v5.2 Lookup field — `lookup` + `lookup-multiple` + the live-query lane

**Goal:** `inputType:"lookup"` and `inputType:"lookup-multiple"` ship across both backends as pure structured data (framework owns all appearance + a11y), resolving labels from the NODE rather than the candidate list; VMS gains its first **live-query dispatch cadence** (debounced ~250-300ms on the existing v4.2 non-blocking lane, stale responses never clobbering newer ones); custom entries are an EXPLICIT declared axis (superseding the parked `inputType:"tags"` design); both tree-validators descend; parity green with new FeatureProbe fixtures; then an aligned npm + NuGet `5.2.0` release gated on a tailnet verification page Ashley signs off.
**Requirements**: LOOK-01, LOOK-02, LOOK-03, LOOK-04, LOOK-05, LOOK-06, LOOK-07
**Depends on:** Phase 20 (v5.1 baseline — parity green; current release npm `5.1.2` / NuGet `5.1.0`) and the **v4.2 non-blocking dispatch lane** (Phases 14/15), whose lane-aware epoch this is the first real consumer of. Design of record: [design/lookup-field.md](./design/lookup-field.md).
**Success Criteria** (what must be TRUE):
  1. **The preselected-value case works with no search having occurred**: a form loads with a reference already set and renders its label, because the label came from the node — not from a candidate list that is empty. Label ABSENT when it equals the value (principle 7); `type` tag present only for polymorphic refs.
  2. **The live-query lane is correct under adversarial interleaving**, not merely green: user-action-races-background, background-resolves-first, rapid-fire-supersede, and stale-arrives-late each have a FAIL-before/PASS-after test. (Banked lesson: the first implementation of concurrency is almost never right, and a suite that doesn't script the interleaving proves nothing about the race.) Debounce ~250-300ms; NO min-chars gate.
  3. **`lookup-multiple` chips meet the a11y baseline** (design §7): item-specific `aria-label="Remove {item}"`, roving tabindex, add/remove announced with the running count, focus after removal next→previous→input and never `<body>`, chips as `role=list`/`listitem` with real buttons. `select-multiple` REMAINS the enumerable-set control — that split is an a11y requirement (the APG combobox has "tested poorly with users for more than two decades"; GOV.UK's own chips multiselect was RETIRED as inaccessible).
  4. **The live region survives re-render with node identity intact**, proven by a jsdom test — the one failure that is invisible rather than merely unverified (a rebuilt live region never announces, while the page looks perfect and every structural test passes). ⚠️ CORRECTED 2026-07-16: this is **NOT** a new mechanism — it reuses the shipped **`chartInstances`** idiom (`browser.ts:83-95`), a persistent mark-swept map whose nodes deliberately survive `render()`'s innerHTML wipe. The earlier "genuinely new 4th preservation category" framing was wrong (asserted from memory instead of grepped) and would have had us build a parallel mechanism. See design D10.
  5. Both inputTypes byte-identical across TS/.NET (`allowCustom` ⇒ `WhenWritingDefault`; nullables ⇒ `WhenWritingNull`), both tree-validators descend, `bun run parity/run.ts` green with FeatureProbe coverage extended per inputType (⚠️ CORRECTED: the actual shipped v5.1 pattern is to EXTEND `buildVm` in the 3 FeatureProbe backends + append to the `$comment` — NOT a new fixture file, NOT a `backends.json` change), TUI degrades legibly, chip fill hand-checked for AA contrast across the default + all 12 themes (the fixed 13-pair gate does NOT auto-cover a new fg/bg pair).
  6. `agent-skill.md` documents the picker as a public first-class protocol (no surveyed platform publishes its picker's transport — we'd be the first), byte-identical .NET twin, `parity/check-skill.ts` green.
  7. Aligned npm + NuGet `5.2.0` published, tagged `v5.2.0`, `main` advanced (`git merge-base --is-ancestor v5.2.0 main`), CI green, `#vms-changelog` announced — after a tailnet verification page (single + multi, preselected-value, custom entries, light + dark) Ashley confirms. **The page's fetch-shim MUST run `buildVm` output through the REAL tree validator** (banked lesson: the shim otherwise accepts trees the real server rejects).
**Plans:** 10 plans

Plans:
- [ ] 21-01-PLAN.md — TS wire surface (lookup/lookup-multiple inputTypes, LookupItem, selected/candidates/searchBind/searchAction/allowCustom, D1/D7/D8/D12 stated at the type) + collectActions descends into searchAction; settles OPEN-1/OPEN-3/OPEN-6 (wave 1)
- [ ] 21-02-PLAN.md — .NET twin: LookupItem + five appended FieldNode members (WhenWritingNull/WhenWritingDefault), the .NET walker's SearchAction descent, LookupSerializationTests (wave 2)
- [ ] 21-03-PLAN.md — single-select renderer: label-from-the-node, order-preserving popup (D12), combobox ARIA, and the §7 keyboard contract; settles OPEN-2/OPEN-5 (wave 2)
- [ ] 21-04-PLAN.md — the live-query lane: debounced renderer-FORCED non-blocking searchAction + the persistent live region (chartInstances idiom) with the D9 node-identity proof (wave 3)
- [ ] 21-05-PLAN.md — the four adversarial interleavings, each FAIL-before/PASS-after through field()'s search path; settles OPEN-4 + closes the Phase 17 barrier question (wave 4)
- [ ] 21-06-PLAN.md — lookup-multiple: chips a11y baseline (item-specific remove labels, roving tabindex, focus-after-removal, count announcements), allowCustom tags path, chip CSS (wave 5)
- [ ] 21-07-PLAN.md — TUI degradation + FeatureProbe buildVm extension in all 3 backends + $comment clause; parity green (wave 6)
- [ ] 21-08-PLAN.md — agent-skill.md picker-as-public-protocol (D1 + D12) + byte-identical .NET twin + Showcase entry (wave 6)
- [ ] 21-09-PLAN.md — full green-tree gate + 13-theme chip AA hand-check (+ re-gate) + tailnet verification page (REAL-validator shim) + Ashley sign-off (wave 7)
- [ ] 21-10-PLAN.md — aligned npm + NuGet 5.2.0 release: docs, bumps, operator-gated publish, tag, advance main, announce (wave 8)

## 🚧 v7.0 Icons Primitive (Phase 22) — IN PLANNING

**Milestone Goal:** Close VMS's oldest capability gap: the framework ships **zero** icon primitive today (both `src/index.ts:1255-1256` and `ViewModels.cs:1666-1667` explicitly comment *"no icon set"*), so apps that need visual target identification (Hestia's Pantheon launcher card grid, Angel's `/ai` chat surface) resort to emoji-in-TextNode-label — platform-inconsistent by construction, un-configurable, and un-a11y-able. Every mature UI framework ships icons as first-class; VMS has been the outlier. Cleared the **easy-yes rule** on both criteria (Ashley 2026-07-26): capability gap STRONG (no primitive, no clean fallback), containment STRONG (self-contained render primitive, one-time set-selection decision, no combinatoric fan-out) — plus directly from Ashley = zero signal-count debate.

Ship **IconNode** (standalone) + **`icon?: IconName` prop** on the five tight-coupled hosts (Button, Link, Section, Badge, ListItem) — two independent consumers (Pixie, Angel) converged on the same 4 surfaces + Link for parity with Button. Set choice: **Lucide** (MIT, uniform 24×24/2px stroke, all 8 of Pixie's concept anchors are literal Lucide names — the winner against Heroicons/Material/Feather in the survey). Curated set of ~102 names inline-bundled in the browser adapter; framework grows by addition (consumers bounty new names, additive minor). **Closed union** on both backends (enum on .NET per the closed-union-must-be-enum maintainer rule); wire carries only NAMES (never SVG payloads).

**Icon-only ButtonNode a11y rule:** when `icon` is set AND `label` empty, `tooltip` (shipped in 6.12.0) is REQUIRED and double-duties as `aria-label` — validator-enforced `invalid_tree` on both backends. Avoids adding a redundant `ariaLabel` field.

**Companion breaking task — rename `TrackerCell.label` → `TrackerCell.tooltip`** and swap its renderer from the browser-native `<span title=...>` to the TOOL-01 styled-tooltip infrastructure. Molly is the single fleet consumer of `TrackerCell` (Ashley 2026-07-26: permission granted to not preserve wire shape for her); the rename fixes both the fleet-consistency gap (8 other TOOL-01 nodes carry `tooltip?:`; `label` elsewhere in VMS means visible text) and the styling inconsistency Ashley caught during Metis pretty-pass. This is the ONE break that forces the release to major — icons alone are additive.

Design of record: [design/icons-primitive.md](./design/icons-primitive.md) — read before proposing any change here.

### Phase 22: v7.0 IconNode + cross-node composition + TrackerCell.label→tooltip rename

**Goal:** `IconNode` + the five `icon?: IconName` cross-node props ship across both backends as pure structured data (framework owns the SVG payloads + all appearance + a11y), the icon-only ButtonNode validator rule enforces `tooltip`-as-`aria-label` on both backends, TrackerCell rename lands with the render-path swap to the TOOL-01 styled tooltip infrastructure, both tree-validators descend and parity is green with `expectBodyContains` coverage tripwires per surface; then an aligned **major** npm + NuGet `7.0.0` release gated on a tailnet verification page Ashley signs off (icon glyphs are visual → in-question publish gate).
**Requirements**: ICON-01, ICON-02, ICON-03, ICON-04, ICON-05, ICON-06, ICON-07, ICON-08, ICON-09, ICON-10, ICON-11
**Depends on:** Phase 21 (v5.2 baseline — parity green) + the shipped v6.12.0/6.12.1 TOOL-01 styled-tooltip infrastructure (which ICON-05's icon-only rule and ICON-06's TrackerCell rename both build on). Design of record: [design/icons-primitive.md](./design/icons-primitive.md).
**Success Criteria** (what must be TRUE):
  1. `IconNode` renders across both backends as a closed-union `name` + optional `size`/`tone`/`label`; framework emits `<svg class="vms-icon vms-icon--{size} vms-icon--{tone}" ...>` with the payload from the bundled Lucide subset, `stroke="currentColor"` (so tone or the parent's text color drives visual color), correct `role`/`aria-label`/`aria-hidden` per §8 of the design doc; byte-identical across TS/.NET (`name` a closed union on TS, an enum with converter on .NET); both tree-validators descend; unknown-name fails `invalid_tree`.
  2. The five host nodes (`ButtonNode`, `LinkNode`, `SectionNode`, `Badge`, `ListItem`) each accept `icon?: IconName` and render the icon at host-appropriate size per §4's table (Button/Link/Badge/ListItem = `sm`/`xs`, Section = `xl`); tone inherits from the host's own `tone` axis, never a separate wire slot.
  3. Icon-only ButtonNode validator rule is enforced on both backends: `icon != null && !label && !tooltip` → `invalid_tree` at buildVm/action-response time; test coverage on both backends verifies the rule fires FAIL-before/PASS-after (banked lesson: verify by mutation, not by assertion).
  4. `TrackerCell` renames `label` → `tooltip`; renderer swaps from `el.title = ...` to the TOOL-01 body-appended `.vms-tooltip-host` singleton + JS positioning (the exact 6.12.1 infrastructure). Molly is DM'd the heads-up + exact rename BEFORE publish so Metis integration is uninterrupted; MIGRATION.md carries the one-line rename note as the ONE break.
  5. Parity green: `bun run parity/run.ts` extends FeatureProbe `buildVm` in ALL backends to emit standalone `IconNode` + each of the 5 host-node icon props + the icon-only-button validator case + the renamed TrackerCell tooltip; adds `expectBodyContains` coverage tripwires per branch (banked lesson: a diff can only prove things about code it actually RUNS). No new fixture file; `$comment` clause updated per the v5.1 pattern.
  6. AA-contrast hand-check for the icon-on-tone / icon-on-fill pairs the primitive introduces (the fixed 13-pair `check:aa-contrast` gate does NOT auto-cover new fg/bg pairs — banked lesson); default + all 12 themes; deepen only the failing tones via `color-mix` per the shipped v3.5.0 pattern.
  7. TUI drops icons entirely for v1 (`@experimental` scope, not-invested-in per standing directive); no unicode-fallback mapping.
  8. Aligned npm + NuGet **v7.0.0** major published (batched), tagged `v7.0.0`, `main` advanced to the release commit (`git merge-base --is-ancestor v7.0.0 main`), CI green, `#vms-changelog` release line — after a tailnet verification page Ashley signs off (Hestia-style card grid with all 8 Pixie concept anchors + icon-in-Button/Badge/ListItem/Link examples + all 5 sizes + tone matrix + a live TrackerCell strip showing the new styled-tooltip render, light + dark, real bundle + shipped CSS + REAL tree-validator in the fetch-shim per banked lesson).
**Plans:** 0 plans (to be created by `/gsd:plan-phase 22`)

## 🚧 v8.0.0 Composite-Nodes Layer (Phases 23–26) — IN PLANNING

**Milestone Goal:** Grow the **Route B recipe layer** atop VMS's primitive axes. VMS today ships the AXES (tone/emphasis/size/state/layout/density) and a few recipes for shapes with **unambiguous intent** (StatBar, Steps, Table, Tracker). For common web shapes with **variance** — list rows, chat messages, alerts, empty states, user rows, key-value details, timeline entries, settings toggles, dismissable chip clusters — consumers compose from primitives and the result reliably falls short of what the same shape looks like on the modern web. Every mature UI framework has this layer atop primitives; VMS has it partial-and-uneven. Every request that arrived under "the framework has all the nodes but the shape looks bad" (Moxie's banner, Molly's incident list, Angel's chat messages) is one instance of this pattern; closing it as a coherent layer beats closing each ask one-off.

Ashley's **governance rule** (2026-07-29, canonicalized): a shape earns a composite node when the best-effort with today's primitives is a "pretty bad approximation" of the common shape. Bar is **visual** — the after has to look right; the before has to look wrong enough to justify the primitive earning a promotion. Judgment per shape, eyeball each in a served tasting before it earns the composite.

**Approved via before/after tasting** (2026-07-29, tasting served at `bounties/composite-nodes-layer/tasting-page/index.html`):
- **10 new composites:** `ListRowNode`, `MessageNode`, `AlertNode`, `EmptyStateNode`, `UserRowNode`, `DetailRowNode`, `TimelineEntryNode`, `AvatarNode` (standalone primitive), `SettingRowNode`, `ChipListNode` + `ChipNode`.
- **3 adjacent wire tweaks** (foundations everything else consumes): `TextNode.style: "caption"` (the 3rd typographic tier), `TextNode` weight axis (semi-bold body-size weight), `CheckboxNode.variant: "switch"` (visual-only render mode).
- **Governance rule** added to AGENTS.md as a maintainer policy so the "when does a shape earn a composite?" call stays consistent going forward.

**Every composite obeys the philosophy:** typed slots with semantic names, closed enums for variance axes, unconstrained content nested inside each slot. Recipes own the shape (DOM + typography + spacing); apps own the content. Both layers coexist — consumers with a shape we didn't foresee still drop to primitives and compose. This is the pattern every surveyed peer converged on (MUI `ListItemText`, Ant `List.Item.Meta`, Chakra `Card` composites, Phoenix LiveView function-component slots, Blazor Razor typed content).

**Everything technically ADDITIVE** — no wire breaks. Old renderers gracefully degrade on unknown enum values (a `.vms-text--caption` class with no CSS falls back to unstyled `.vms-text`). Semver-wise a minor bump would suffice, but this earns **v8.0.0** for comms — largest capability expansion since 3.0.0's axes unification, warrants "consumers should read the release notes."

**Milestone-wide success criteria:**
1. All 10 composites + 3 wire tweaks land byte-identical across TS/.NET, both tree-validators descend where applicable, parity green with `expectBodyContains` per branch (banked lesson: a diff can only prove things about code it actually RUNS).
2. Every composite shipped WITH real demo adoption (banked lesson from `UseVmsShellStaticFiles`: helpers don't ship without demo adoption or the wiring reference teaches the wrong thing). Showcase gains a `Composites` tab exercising every new node.
3. AA-contrast hand-check for every new fg/bg pair the composites introduce (Alert toned surfaces, Chip toned pills, SettingRow switch states) across default + all 12 themes.
4. `agent-skill.md` updated with the new wire vocabulary (byte-identical .NET twin, `parity/check-skill.ts` green).
5. AGENTS.md gains a **"Route B composite-nodes layer"** governance section codifying the earn-a-composite rule + the typed-slots pattern.
6. Aligned npm + NuGet **v8.0.0** major published, tagged, main advanced, CI green, `#vms-changelog` announced — after a comprehensive tailnet verification page Ashley signs off (10 composites × light + dark, real bundle + shipped CSS + REAL tree-validator in the fetch-shim).

Design of record: `bounties/composite-nodes-layer/tasting-page/index.html` (the approved before/after tasting) + a design doc `.planning/design/composite-nodes-layer.md` (to be written as part of Phase 23).

### Phase 23: v8.0 Foundations — text style caption + weight axis + checkbox switch variant + AvatarNode

**Goal:** Land the 4 foundation additions every downstream composite depends on. `TextNode` gains `style: "caption"` (text-xs, muted, opacity — the 3rd typographic tier `ListRowNode`/`MessageNode`/`TimelineEntryNode` all consume) and a weight axis for the semi-bold body-size weight that row primaries need; `CheckboxNode` gains `variant: "switch"` (visual-only render mode — the switch slider `SettingRowNode` pairs with); `AvatarNode` ships as a standalone primitive (circular slot with initials/image/icon, closed size `sm|md|lg|xl`, closed tone). All byte-identical across TS/.NET, parity green with FeatureProbe extended per addition + `expectBodyContains` coverage tripwires. Everything additive — no wire breaks. Aligned pre-release verification via tailnet page: Ashley eyeballs each addition against the tasting mockup before Phase 24 opens.
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04
**Depends on:** Phase 22 (v7.0 icons — `AvatarNode` reuses the icon rendering + `IconName` closed union for the fallback-icon slot). Design of record: `.planning/design/composite-nodes-layer.md` (to be written in this phase; approved tasting at `bounties/composite-nodes-layer/tasting-page/`).
**Success Criteria** (what must be TRUE):
  1. `TextNode.style` gains `"caption"` on both backends — closed union extension (`"heading" | "subheading" | "body" | "muted" | "strikethrough" | "pre" | "caption"`). Renders `.vms-text--caption` with `font-size: var(--vms-text-xs)`, muted color, 0.85 opacity. Existing consumers unaffected (they never emit `caption`; old renderer gracefully degrades on the new value if a new backend sends it).
  2. `TextNode` gains an optional weight axis for the semi-bold body-size variant. Shape TBD in planning (either `weight?: "regular" | "medium" | "bold"` closed enum OR `style: "strong"` as an additional value). Whichever shape wins is byte-identical across backends and closed-enum on .NET per the closed-union-must-be-enum maintainer rule.
  3. `CheckboxNode.variant: "switch"` renders as a switch slider (visual only — wire and semantics unchanged; the value on the wire is still boolean, dispatch shape is still standard checkbox `bind`/change semantics). Emits `.vms-field--switch` modifier; falls back to the standard checkbox on renderers that don't know the variant.
  4. `AvatarNode` renders as a circular slot with `initials?: string`, `image?: string` (URL), `icon?: IconName` (fallback), `size?: "sm" | "md" | "lg" | "xl"` (1.5/2/2.5/3rem — closed enum), `tone?: Tone` (background palette for initials/icon mode), `alt?: string` (a11y). Both tree-validators descend; content resolution priority is image > initials > icon > (empty circle if none).
  5. Byte-identical across TS/.NET (`[JsonIgnore(WhenWritingNull)]` on every optional nullable; closed unions as .NET enums with converters).
  6. Parity green: `bun run parity/run.ts` extends FeatureProbe `buildVm` in ALL 3 backends to emit `TextNode style:"caption"` + a weight variant + a `CheckboxNode variant:"switch"` + an `AvatarNode` at each size × tone × content-mode; `expectBodyContains` coverage tripwires per addition (banked lesson: a diff can only prove things about code it actually RUNS). No new fixture file; `$comment` clause updated per the v5.1 pattern.
  7. AA-contrast hand-check: caption text (opacity-adjusted muted) against default + 12 themes; avatar tone-tinted background against every `initials` text-color rendering; switch on/off state colors. Fixed 13-pair `check:aa-contrast` does NOT auto-cover new pairs (banked lesson) — hand-check + deepen via `color-mix` where AA fails.
  8. Every foundation adopted in the Showcase demo (a "Foundations" sub-tab in the eventual Composites tab, or standalone demonstration) — the fleet-adoption discipline applies to foundations too. No orphaned primitive.
  9. Vitest + .NET test coverage for each addition (rendering, tree-validation, wire round-trip).
 10. AGENTS.md gains an **initial** "Route B composite-nodes layer" governance section — the earn-a-composite rule + the typed-slots pattern + the multi-phase milestone plan. The section grows as Phases 24-26 land; Phase 23's version establishes the frame.
 11. NO release ship yet — Phase 23 lands the foundations to a green tree with full test/parity/gate coverage, but v8.0.0 publishes only at Phase 26 closeout (batch-then-ship discipline). CHANGELOG entries accumulate under an "Unreleased" section.
**Plans:** 9 plans

Plans:
- [x] 23-01-PLAN.md — COMP-01: TextNode.style: "caption" end-to-end (wire type + CSS + .NET twin + vitest + .NET test + AA hand-check) (wave 1)
- [x] 23-02-PLAN.md — COMP-02: TextNode weight axis end-to-end (Option A chosen — new orthogonal `weight?` field; TS + browser + CSS + .NET twin + tests + WhenWritingNull proof) (wave 2, depends on 23-01)
- [x] 23-03-PLAN.md — COMP-03: CheckboxNode.variant: "switch" end-to-end (wire type + role=switch + slider CSS + .NET twin + tests + wire-semantics-unchanged proof + AA hand-check) (wave 3, depends on 23-02)
- [x] 23-04-PLAN.md — COMP-04: AvatarNode new standalone primitive end-to-end (wire type + discriminator + walker + browser renderer with renderIconSvg reuse + CSS + .NET twin + tests + priority-order mutation test + AA hand-check) (wave 4, depends on 23-03)
- [x] 23-05-PLAN.md — .planning/design/composite-nodes-layer.md design of record for the v8.0.0 milestone (thesis, governance rule, typed-slots pattern, 10-composite inventory, adoption order) (wave 1)
- [x] 23-06-PLAN.md — AGENTS.md "Route B composite-nodes layer" governance section (initial frame; recipe inventory deferred to Phase 24-26) (wave 2, depends on 23-05)
- [x] 23-07-PLAN.md — Showcase Foundations demo section + FeatureProbe buildVm extension in both backends + parity fixture $comment + expectBodyContains tripwires (wave 5, depends on 23-01..04)
- [x] 23-08-PLAN.md — CHANGELOG.md Unreleased — v8.0.0 (in progress) heading + 4 foundation entries + batch-then-ship reminder (wave 5, depends on 23-01..04)
- [x] 23-09-PLAN.md — Full green-tree gate re-run + AA-contrast hand-check re-verify + Showcase visual smoke on tailnet (Ashley sign-off) + requirement-to-artifact cross-check (wave 6, depends on 23-01..08)


### Phase 24: v8.0 Primary composites — ListRowNode + MessageNode + AlertNode + EmptyStateNode

**Goal:** Land the 4 primary composite recipes that the v8.0.0 tasting approved with the strongest evidence + live consumer pressure. Each is a **Route B recipe** — typed semantic slots with unconstrained ViewNode content, closed-enum variance axes, framework owns layout/typography/spacing. Every composite consumes Phase 23 foundations (`TextNode.style: "caption"` for tertiary meta; `TextNode.weight` for row primaries; `AvatarNode` for user identity). Both backends byte-identical, tree-validators descend where applicable, parity green with `expectBodyContains` per branch, AA hand-check per new fg/bg pair, tests per composite (vitest + .NET), Showcase adoption. **NO release ship** — accumulate CHANGELOG under "Unreleased"; v8.0.0 publishes at Phase 26 closeout.

**Requirements**: COMP-05 (ListRowNode + ListNode variant:"rows"), COMP-06 (MessageNode + MessageListNode with followTail semantics), COMP-07 (AlertNode with icon-tone default mapping), COMP-08 (EmptyStateNode with icon + title + description + action slot)

**Depends on:** Phase 23 (foundations landed on main via commits 97163e1..133967d). Design of record: `.planning/design/composite-nodes-layer.md`. Approved tasting: `~/.claude/identities/vicky/bounties/composite-nodes-layer/tasting-page/index.html`.

**Success Criteria** (what must be TRUE):
  1. **`ListRowNode`** ships with slots `{ leading?, primary, secondary?, meta?, trailing?, tone?, state?, action? }`. `primary` rendered with trained `TextNode` typography (body + weight:"medium"); `secondary` = muted; `meta[]` = caption tier. `tone` (closed 4-way) sets left-accent border; `state` freeform (matches ListItem — active/done/disabled/high framework-styled); `action` enables whole-row `role="button" tabindex=0`. Byte-identical TS/.NET.
  2. **`ListNode` gains `variant?: "items" | "rows"`** — omitted/`"items"` = today's ListItem behavior (byte-identical); `"rows"` = ListRowNode-only container rendering as a single bordered surface with per-row dividers. Old renderers gracefully degrade on unknown variant.
  3. **`MessageNode`** ships with slots `{ avatar?, author, timestamp?, content, role?, actions? }`. `role:"assistant"` gets tinted-info surface; `role:"user"`/`"system"`/omitted gets neutral. `author` weight:600; `timestamp` caption tier; `actions[]` right-aligned. Byte-identical TS/.NET.
  4. **`MessageListNode`** ships with `{ children: MessageNode[], followTail?: boolean }`. When `followTail:true` inherits `SectionNode.followTail` semantics (at-bottom detection pre-render, pin-to-new-bottom post-render). Pairs naturally with `PageNode.fill:true`.
  5. **`AlertNode`** ships with slots `{ tone (required), title?, message, icon?, actions?, dismissible? }`. `tone` closed 4-way — this IS the point of the node. `icon` overrides tone→icon default mapping (danger→`x-circle`, warning→`alert-triangle`, success→`check-circle`, info→`info`). `title` weight:600; `message` muted. `actions[]` right-aligned size:"sm". `dismissible:true` adds close-X that dispatches a `dismiss` action name.
  6. **`EmptyStateNode`** ships with slots `{ icon?, title, description?, action? }`. Centered stack, generous vertical padding. `icon` large in tinted-circle background; `title` text-lg weight:600; `description` muted with max-width for readable line length; `action` single ButtonNode centered. Composable in TableNode/ListNode empty-cell slot (resolves open bounty `empty-state-on-collections` via composite-consumable-in-empty-slot, NOT collection-property).
  7. Every composite: both tree-validators descend into ViewNode-typed slots; action-name uniqueness enforced across the tree (banked from Nelly's TODO discovery).
  8. Every composite: `[JsonIgnore(WhenWritingNull)]` on every optional nullable + `[JsonIgnore(WhenWritingDefault)]` on optional non-nullable bools per gotcha #8.
  9. Parity green: FeatureProbe `buildVm` extended in all 3 backends (v5.1 pattern) per composite; minimum one `expectBodyContains` per composite that only its branch emits. `$comment` clause appended.
 10. AA-contrast hand-check for new fg/bg pairs per composite (Alert toned surfaces × 4 tones × 13 themes; Message assistant tinted content surface; ListRowNode hover-tint; EmptyStateNode tinted-circle icon backdrop). Fixed 13-pair gate does NOT auto-cover (banked lesson).
 11. Showcase adoption of every composite (Composites tab extending Foundations; fleet-adoption discipline — banked from UseVmsShellStaticFiles 6.7.0). Each composite demonstrated in situ.
 12. Vitest per composite (mutation-testable — rendering + slot passing + tree-validator descent) + .NET serialization tests (byte-identical wire + WhenWritingNull round-trip).
 13. `.planning/design/composite-nodes-layer.md` recipe-inventory table filled in for these 4 (Phase 23 landed the frame with empty inventory).
 14. AGENTS.md "Route B composite-nodes layer" section grown: add the 4 primary composites to the shipped recipe inventory + note their consumption of Phase 23 foundations.
 15. NO release ship — v8.0.0 releases at Phase 26 closeout. CHANGELOG accumulates all 4 under "Unreleased".

**Plans:** 6/9 plans executed

Plans:
- [x] 24-01-PLAN.md — ListRowNode (COMP-05) + ListNode.variant:"rows" (COMP-05a) end-to-end (wave 1)
- [x] 24-02-PLAN.md — MessageNode (COMP-06) + MessageListNode (COMP-06a) end-to-end; followTail REUSES SectionNode.followTail (wave 2, depends on 24-01)
- [x] 24-03-PLAN.md — AlertNode (COMP-07) end-to-end with tone→icon default map (wave 3, depends on 24-02)
- [x] 24-04-PLAN.md — EmptyStateNode (COMP-08) BREAKING RENAME end-to-end + framework rename cascade (wave 4, depends on 24-03)
- [x] 24-05-PLAN.md — design/composite-nodes-layer.md Shipped Recipe Inventory + AGENTS.md Currently shipped recipes (wave 1, file-disjoint)
- [x] 24-06-PLAN.md — Showcase Primary Composites section (wave 5, depends on 24-04)
- [x] 24-07-PLAN.md — FeatureProbe parity extension + $comment + tripwires (wave 5, depends on 24-04)
- [x] 24-08-PLAN.md — CHANGELOG.md + MIGRATION.md updates for Unreleased v8.0.0 (wave 5, depends on 24-04)
- [x] 24-09-PLAN.md — Full green-tree gate + Ashley visual sign-off + requirement cross-check + bounty close (wave 6, depends on all prior)

### Phase 25: v8.0 Secondary composites — UserRowNode + DetailRow + Timeline + SettingRow + Chip

**Goal:** Land the 5 remaining Route B composite recipes approved via the tasting: **UserRowNode** (person entity — avatar + name + meta + status dot), **DetailRowNode + DetailListNode** (aligned key-value with proper `<dl>`/`<dt>`/`<dd>` semantics), **TimelineEntryNode + TimelineNode** (activity feed with rail + dot markers — a shape today's primitives literally cannot produce), **SettingRowNode + SettingListNode** (label + description + trailing control — pairs with COMP-03's CheckboxNode.variant:"switch"), and **ChipNode + ChipListNode** (dismissible pill cluster — the only way to close out the "filter chip with X" pattern since BadgeNode isn't dismissable). Every composite consumes Phase 23 foundations + AvatarNode where applicable. Both backends byte-identical, parity green with `expectBodyContains` per branch, AA hand-check per new fg/bg pair, tests per composite, Showcase adoption. **NO release ship** — accumulate CHANGELOG under "Unreleased"; v8.0.0 publishes at Phase 26 closeout.

**Requirements**: COMP-09 (UserRowNode), COMP-10 + 10a (DetailRowNode + DetailListNode), COMP-11 + 11a (TimelineEntryNode + TimelineNode), COMP-12 + 12a (SettingRowNode + SettingListNode), COMP-13 + 13a (ChipNode + ChipListNode)

**Depends on:** Phase 24 (primary composites landed on main). Design of record: `.planning/design/composite-nodes-layer.md`. Approved tasting: `~/.claude/identities/vicky/bounties/composite-nodes-layer/tasting-page/index.html` (sections 5, 6, 7, 9, 10).

**Success Criteria** (what must be TRUE):
  1. **`UserRowNode`** ships with slots `{avatar?, name, meta?, status?, trailing?, action?}`. `avatar` typically an `AvatarNode` (COMP-04) but slot accepts any ViewNode. `name` = trained TextNode body + weight:"medium"; `meta` = TextNode muted. `status` a small `{label, kind}` object where `kind: "online"|"away"|"offline"|"busy"` closed enum. `action` = whole-row click (member-picker pattern). Byte-identical TS/.NET.
  2. **`DetailRowNode` + `DetailListNode`** ship as a pair. DetailRow slots `{label, value, tone?, icon?}` where `label` trained text-xs uppercase weight:500 muted and `value` trained TextNode body. DetailListNode renders as a `<dl>` with fixed label column (`labelWidth?: "sm"|"md"|"lg"` closed enum) and consistent alignment across all rows. Byte-identical TS/.NET; tree-validator rejects non-DetailRow children in a DetailListNode.
  3. **`TimelineEntryNode` + `TimelineNode`** ship as a pair. TimelineEntry slots `{time, description, tone?, icon?}` where `time` = trained caption tier (COMP-01) and `description` = TextNode body accepting rich content. TimelineNode renders the vertical rail + dot markers (a decorative `::before` line + per-entry `::before` dots), tone-encoded borders on dots. Byte-identical TS/.NET.
  4. **`SettingRowNode` + `SettingListNode`** ship as a pair. SettingRow slots `{icon?, label, description?, trailing?, action?}` where `label` = trained TextNode body + weight:"medium" and `description` = TextNode muted with max-width. `trailing` typically holds a `CheckboxNode(variant:"switch")` from COMP-03 (natural pairing), a ButtonNode, or a LinkNode. SettingListNode renders as a single bordered surface with per-row dividers (same pattern as ListNode.variant:"rows"). Byte-identical TS/.NET.
  5. **`ChipNode` + `ChipListNode`** ship as a pair. ChipNode slots `{label, tone?, icon?, dismissAction?, action?}` — different from BadgeNode by being standalone-interactive + supporting `dismissAction` (emits X + dispatches on click) + participating in a ChipListNode group. ChipListNode = flex-wrap horizontal cluster with tuned inline gap. Byte-identical TS/.NET.
  6. Every composite: both tree-validators descend into ViewNode-typed slots; action-name uniqueness enforced across the tree.
  7. Every composite: `[JsonIgnore(WhenWritingNull)]` on nullables + `[JsonIgnore(WhenWritingDefault)]` on optional non-nullable bools per gotcha #8.
  8. Parity green: FeatureProbe `buildVm` extended in all 3 backends per composite (v5.1 pattern); minimum one `expectBodyContains` per composite branch that only that branch emits.
  9. AA-contrast hand-check for new fg/bg pairs (Chip tinted-pill × 4 tones × 13 themes; status-dot colors on default + all themes; DetailRow label uppercase muted; TimelineEntry dot-border tones; SettingRow switch reuses Phase 23's checks).
 10. Showcase adoption of every composite (Secondary Composites section extending Primary Composites; fleet-adoption discipline).
 11. Vitest per composite + .NET serialization tests (byte-identical wire + WhenWritingNull round-trip + WhenWritingDefault for `dismissAction`-less chips).
 12. `.planning/design/composite-nodes-layer.md` recipe-inventory table filled in for these 5 (Phase 24 filled in the 4 primaries; this phase completes the shipped set).
 13. AGENTS.md "Route B composite-nodes layer" section grows: add the 5 secondaries to the shipped recipe inventory.
 14. NO release ship — v8.0.0 releases at Phase 26 closeout. CHANGELOG accumulates all 5 under "Unreleased".

**Plans:** 10/10 plans executed

Plans:
- [x] 25-01-PLAN.md — UserRowNode (COMP-09) end-to-end
- [x] 25-02-PLAN.md — DetailRowNode + DetailListNode (COMP-10 + 10a) end-to-end
- [x] 25-03-PLAN.md — TimelineEntryNode + TimelineNode (COMP-11 + 11a) end-to-end with NEW ::before rail+dot CSS
- [x] 25-04-PLAN.md — SettingRowNode + SettingListNode (COMP-12 + 12a) end-to-end with CheckboxNode(variant:"switch") pairing
- [x] 25-05-PLAN.md — ChipNode + ChipListNode (COMP-13 + 13a) end-to-end with caller-supplied dismissAction posture
- [x] 25-06-PLAN.md — design/composite-nodes-layer.md + AGENTS.md inventory growth
- [x] 25-07-PLAN.md — Showcase Secondary Composites section (fleet-adoption)
- [x] 25-08-PLAN.md — FeatureProbe parity extension + 15 tripwires
- [x] 25-09-PLAN.md — CHANGELOG.md + MIGRATION.md v8.0.0 additive entries
- [x] 25-10-PLAN.md — Full green-tree gate + Ashley visual sign-off + requirement cross-check

### Phase 26: v8.0.0 release closeout — comprehensive verification + aligned major publish

**Goal:** Close the v8.0.0 milestone (Phases 23-25) with an aligned major release on both packages. Build a **comprehensive tailnet verification page** covering all 10 shipped composites (COMP-05..13a) + 3 wire tweaks (Phase 24's `EmptyStateNode` rewrite + Phase 25's landings) + 1 new primitive (`AvatarNode` COMP-04) + 4 foundations (COMP-01..04) for a full-milestone visual sign-off in one served page — the compensating discipline that makes the "apps don't test their UI" thesis honest (per AGENTS.md standing directive on verification pages). Finalize `CHANGELOG.md` heading `Unreleased — v8.0.0 (in progress)` → `v8.0.0 — <publish-date>`, finalize `MIGRATION.md` heading similarly. Verify `agent-skill.md` still accurate for v8.0 wire (Phase 25 was additive — likely inventory grow only; no wire-shape break). Bump `viewmodel-shell/package.json` 7.1.0 → **8.0.0** and `AshleyShrok.ViewModelShell.csproj` 7.0.0 → **8.0.0** (aligned major; the sole v8.0 wire break was Phase 24's `EmptyStateNode` rename, per AGENTS.md publishing runbook). Operator publish + tag `v8.0.0` + advance `main` + registry verify + announce on `#vms-changelog` new `room_id !E211RrsKCygK7Ev6uacpswousKy9JZiGEVLquJpC3cU`.

**Requirements**: No new COMP-XX (v8.0.0 milestone is COMP-01..13a; Phases 23-25 shipped them all). Phase 26 is the release ritual + full-milestone verification for that set.

**Depends on:** Phase 25 (all 10 composites landed on main + CHANGELOG + MIGRATION accumulated; commit `358e6f0`). Design of record: `.planning/design/composite-nodes-layer.md`. AGENTS.md publishing runbook + operator auth precheck.

**Success Criteria** (what must be TRUE):
  1. **Comprehensive tailnet verification page** served on `100.113.23.63:<port>` demonstrates all 10 shipped composites + 4 foundations + 3 wire tweaks + 1 new primitive in one page, driven by the real bundle (built `dist/browser.js` + shipped `default.css` + all theme files), with theme switcher; smoke-tested `curl` 200 before hand-off; Ashley signs off visually.
  2. **`agent-skill.md` verified accurate for v8.0** — either unchanged (if Phase 25 additions don't require operator-manual updates) or updated + byte-copied to `viewmodel-shell-dotnet/AgentSkill.md` per AGENTS.md maintainer rule; parity gate proves both sources + both served HTTP twins byte-identical.
  3. **CHANGELOG.md heading finalized** `Unreleased — v8.0.0 (in progress)` → `v8.0.0 — <publish-date>`; MIGRATION.md `## Upgrading to v8.0.0 (in progress)` heading finalized similarly. Batch-then-ship reminder removed from finalized section.
  4. **Aligned version bump**: `viewmodel-shell/package.json` version → `8.0.0`; `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>` → `8.0.0`.
  5. **Green-tree gate green** one final time BEFORE any registry action: full framework + parity + all `demo/**/*.Tests.csproj` + core-globals + demo-types + no-demo-style + test-types + aa-contrast.
  6. **Operator publish + tag + advance main**: `.env` sync, `npm publish` (prepublishOnly rebuilds `dist/`), `dotnet pack -c Release` + `dotnet nuget push`, curl-verify BOTH registries return `8.0.0` as latest, annotated tag `v8.0.0` at release commit + push, verify `git merge-base --is-ancestor v8.0.0 main` (the load-bearing "release must merge into main" gate — the missed-2-releases-2026-06-14 lesson).
  7. **Announce on `#vms-changelog`** — new room `!E211RrsKCygK7Ev6uacpswousKy9JZiGEVLquJpC3cU` (Nelly's heads-up post fleet-wide Continuwuity rebuild). Message summarizes the 10 composites + wire tweaks + the single BREAKING (`EmptyStateNode` rename) + link to CHANGELOG.
  8. **No consumer broken silently**: pre-publish grep of every VMS demo + framework test for `EmptyStateNode(Heading|Message` (the pre-v8 field spelling) returns zero occurrences (all internal callsites already migrated in Phase 24).
  9. **Phase 26 SUMMARY records**: green-tree evidence, comprehensive verification page URL + Ashley's sign-off + timestamped screenshot log, agent-skill.md diff (if any), CHANGELOG/MIGRATION heading diff, version-file diff, registry verify output, tag + advance-main verify, `#vms-changelog` announce URL.

**Plans:** 6 plans complete

Plans:
- [x] 26-01-PLAN.md — Comprehensive tailnet verification page (wave 1, Showcase served on 100.113.23.63:8186)
- [x] 26-02-PLAN.md — agent-skill.md audit + byte-copy verify (wave 1, file-disjoint from 26-01)
- [x] 26-03-PLAN.md — Full green-tree gate + Ashley visual sign-off (wave 2, depends on 26-01 + 26-02)
- [x] 26-04-PLAN.md — CHANGELOG/MIGRATION heading finalize + aligned version bump to 8.0.0 (wave 3, depends on 26-03)
- [x] 26-05-PLAN.md — Operator publish + tag v8.0.0 + advance main (wave 4, depends on 26-04)
- [x] 26-06-PLAN.md — Announce on #vms-changelog + phase SUMMARY (wave 5, depends on 26-05)

### Phase 27: Composite state axis uniformity — close the state? gap across all composites, unify --active styling (STYLE-3: left accent + bold primary)

**Goal:** Close the framework's `state?: string` axis gap uniformly across all composites, and unify the shipped `--active` styling to a single rule set (STYLE-3: `border-left: 3px solid var(--vms-accent) + font-weight: 600` on the composite's semantic primary text slot). Two moving parts: (a) add `state?: string` to the 6 composites currently missing it (UserRowNode, MessageNode, DetailRowNode, TimelineEntryNode, SettingRowNode, ChipNode) — both backends byte-identical; (b) unify the shipped `--active` CSS rule across the 3 composites that already have `state?` — REPLACE ListItem + ListRow's shipped `--active` rules with STYLE-3 (documented visual change; MIGRATION.md flags), add TableRow's first-time shipped `--active` rule. ChipNode ships the wire field for uniformity but ships NO shipped `--active` rule (deferred per composite-nodes-layer.md — Chip's tinted-pill shape doesn't map to STYLE-3's border-left + bold-primary convention). Also ships `--done`/`--disabled` opacity rules on the 6 new composites per ListRow precedent. Aligned MINOR release npm + NuGet 8.1.0.

**Requirements:** STATE-AXIS-TS, STATE-AXIS-DOTNET, STATE-AXIS-EMIT, STATE-AXIS-CSS-UNIFY, STATE-AXIS-VITEST, STATE-AXIS-DOTNET-TESTS, STATE-AXIS-PARITY, STATE-AXIS-VERIFICATION-PAGE, STATE-AXIS-GREEN-TREE-GATE, STATE-AXIS-DOCS, STATE-AXIS-RELEASE

**Depends on:** Phase 26 (v8.0.0 shipped; 8.0.x baseline)

**Success Criteria** (what must be TRUE):
  1. `state?: string` field present on all 6 target composite interfaces in `viewmodel-shell/src/index.ts` with mirrored TSDoc.
  2. Matching `State` trailing-append parameters on all 6 .NET records in `viewmodel-shell-dotnet/ViewModels.cs` with `[JsonIgnore(WhenWritingNull)]` per gotcha #8.
  3. 6 new BEM class emission sites in `viewmodel-shell/src/browser.ts`, one per composite (`.vms-{composite}--{state}`).
  4. Unified STYLE-3 `--active` rules across 7 composites (ListItem REPLACED, TableRow NET-NEW, ListRow REPLACED, plus UserRow, Message, DetailRow, SettingRow), plus Timeline per pixel-geometry decision (STYLE-3 default, STYLE-6 fallback if collision); ChipNode ships NO `--active` rule (deferred, documented).
  5. `--done` + `--disabled` opacity rules landed on the 6 new composites per ListRow precedent (opacity 0.72 / 0.55).
  6. Consolidated vitest coverage: `test/composite-state-axis.test.ts` asserts BEM emission + STYLE-3 CSS effect + Chip guardrail + Message role×state composition + ListItem/ListRow regression on the visual change.
  7. Consolidated .NET serialization tests: `Tests/CompositeStateAxisSerializationTests.cs` proves WhenWritingNull round-trip on all 6 new State params + class-2 findNulls defense + arbitrary-state round-trip.
  8. FeatureProbe fixture extended in all 3 backends (Bun handler, Node server, .NET controller) with `state:"active"` on each of the 6 new composites; `parity/fixtures/feature-probe.json` gains per-composite tripwires + Phase-27 `$comment` sentence. `bun run parity/run.ts` green.
  9. Comprehensive tailnet verification page (`demo/StateAxisVerification-bun/`) served on 100.113.23.63:3020 with 2×9 grid × 13-theme switcher × real bundle; Ashley visual sign-off recorded; before/after screenshots saved for MIGRATION.md.
 10. Full green-tree gate green per AGENTS.md: framework vitest + core-globals + demo-types + AA-contrast + parity + `viewmodel-shell-dotnet/Tests` + every `demo/**/*.Tests.csproj` + Markdown companion compile check.
 11. Docs shipped: CHANGELOG.md v8.1.0 section (Added / Changed / Note); MIGRATION.md upgrade section with before/after visual references; AGENTS.md "Route B composite-nodes layer" inventory gains Phase 27 note.
 12. Aligned MINOR release npm 8.0.3 → 8.1.0 + NuGet 8.0.0 → 8.1.0; operator-gated auth precheck + publish; annotated tag `v8.1.0` at release commit + pushed; `git merge-base --is-ancestor v8.1.0 main` verified; announced on `#vms-changelog` (`!E211RrsKCygK7Ev6uacpswousKy9JZiGEVLquJpC3cU`); Angel DM'd that composition-swap unblocks.

**Plans:** 1/11 plans executed

Plans:
- [x] 27-01-PLAN.md — TS wire additions: state?: string on 6 composite interfaces in index.ts (wave 1)
- [ ] 27-02-PLAN.md — .NET twin: State trailing-append on 6 records in ViewModels.cs with WhenWritingNull (wave 1, file-disjoint from 27-01)
- [ ] 27-03-PLAN.md — browser.ts renderer emission: 6 new BEM state-class push sites (wave 2, depends on 27-01)
- [ ] 27-04-PLAN.md — default.css unification pass: REPLACE ListItem + ListRow --active, add TableRow --active net-new, add 5 new composite --active + 6 --done/--disabled opacity rules (wave 3, depends on 27-01 + 27-03)
- [ ] 27-05-PLAN.md — Consolidated vitest coverage (composite-state-axis.test.ts) for all 8 composites + Chip guardrail + regression cases (wave 4, depends on 27-03 + 27-04)
- [ ] 27-06-PLAN.md — Consolidated .NET serialization tests (CompositeStateAxisSerializationTests.cs) for 6 new State params + findNulls defense (wave 4, depends on 27-02)
- [ ] 27-07-PLAN.md — Parity fixture extension: FeatureProbe 3-backend state:"active" emissions + expectBodyContains tripwires + $comment (wave 5, depends on 27-01/02/03/05/06)
- [ ] 27-08-PLAN.md — Tailnet verification page (demo/StateAxisVerification-bun/) + Ashley visual sign-off + before/after screenshots (wave 6, depends on 27-04 + 27-05)
- [ ] 27-09-PLAN.md — Full green-tree gate: framework vitest + core-globals + demo-types + AA-contrast + parity + all .NET Tests + Markdown companion compile (wave 7, depends on 27-07 + 27-08)
- [ ] 27-10-PLAN.md — Docs: CHANGELOG.md v8.1.0 + MIGRATION.md upgrade section + AGENTS.md inventory note (wave 8, depends on 27-09)
- [ ] 27-11-PLAN.md — Operator-gated release: version bump + auth precheck + npm publish + NuGet publish + tag v8.1.0 + advance main + announce #vms-changelog (wave 9, depends on 27-10)
