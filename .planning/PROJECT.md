# ViewModel Shell

## What This Is

A server-driven UI framework where the wire format is structured enough that agents can build full-stack apps without ever opening a browser, and all UI tests are pure unit tests with no browser runtime. The server is a stateless transformer: it takes the client's current UI state plus an action and returns the next state plus a fresh view tree of typed nodes. A thin TypeScript adapter renders that tree to DOM with no app-specific code. Ships as two version-aligned packages: `@ashley-shrok/viewmodel-shell` (npm — frontend renderer + `/server` backend subpath) and `AshleyShrok.ViewModelShell` (NuGet — .NET backend types).

## Core Value

The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end. If platform assumptions leak into the core, the framework's central promise (and its main differentiator) is broken.

## Current Milestone: v4.1 Data Visualization

**Goal:** Add VMS's first data-visualization primitive — a structured `ChartNode` (bar, single-series, `title` + `tone`) whose payload is bounded declared data (a numeric series + labelled categories), rendered by **Chart.js behind the browser adapter** as a private implementation detail. Closes GitHub issue #6 (the lone open issue). Additive; the wire protocol token stays `viewmodel-shell/1.0`.

**Target features:**
- **`ChartNode` — a structured, agent-legible node, not an escape hatch.** The series/categories are declared fields an agent reads; parity diffs the DATA, not the pixels. A general "raw content / embed anything" node was explicitly REJECTED (the absence of an escape hatch is the product).
- **Chart.js behind the adapter, lazy/optional.** The library is a private detail of the browser adapter (apps never touch it); loaded only when a `ChartNode` is present so non-charting apps pay zero bytes; core + .NET/bun backends stay dependency-free (they only emit ChartNode data).
- **Closed appearance.** `title` + the existing `tone` axis (danger/warning/success/info) only — no raw hex/CSS/axis/tooltip config on the wire.
- **Re-render on new data.** The chart redraws in place when the server returns updated data (the standard VMS control→server→redraw loop).
- **Two-backend parity + TUI degradation.** Byte-identical TS/.NET node, both tree-validators descend into it, FeatureProbe/parity coverage, and a legible TUI fallback.

**Key context:** Design was settled with the operator ahead of planning (a design session + a live tailnet comparison of frappe-charts / Chart.js / ApexCharts / hand-drawn SVG — Chart.js chosen on maintenance health + v4 tree-shakeability + free interactivity). Scope is deliberately MINIMAL (bar only; `line` and multi-series deferred) and hard-gated against a config/CSS surface. Ships as an aligned additive **minor** (npm + NuGet `4.1.0`). This is a deliberate return to a formal GSD milestone for the flagship #6 feature; interstitial 2.x/3.x/4.0 releases since v1.12 were CHANGELOG-tracked direct releases.

## Last Shipped Milestone: v1.12 Layout System Completeness

> ✅ **SHIPPED 2026-06-24** (npm `1.12.0` / NuGet `1.10.0`). Work since shipped as CHANGELOG-tracked interstitial releases up to **4.0.0** (through 3.1.0 on 2026-06-26: 2.0.0 remove `SectionNode.flyout` [BREAKING], 2.1.0 `LinkNode.active`, 3.0.0 unified appearance axes [BREAKING], 3.0.1/3.0.2 CSS fixes, 3.1.0 admin-shell primitives; then the version-skew arc 3.5–3.11 and 4.0.0 file-upload `uploadOn` routing [BREAKING]). The description below is the milestone's original scope, kept as history; see `MILESTONES.md` + `CHANGELOG.md` for what shipped.

**Goal:** Finish VMS's layout vocabulary so the frontend can express any app's layout with zero app-authored CSS and zero app-specified breakpoints — grounded in a 4-framework research synthesis (`.planning/design/layout-system-research.md`) rather than invented. Completes the layout enum that 0.4.0's Design System milestone started (`stack`/`split`/`cards`).

**Target features:**
- **Main/cross-axis alignment enums (`arrange` / `align`).** Closed unions on the `row` layout (and applicable flex containers), copied verbatim from Jetpack Compose ∩ Flutter (the two that agree exactly): `arrange` (main-axis justify) = `start | center | end | space-between | space-around | space-evenly`; `align` (cross-axis) = `start | center | end | stretch | baseline`. Subsumes the live `justify` header-bar request from the PBMInvoices consumer (header bar = `arrange:"space-between"` + a heading-`TextNode` first child).
- **`switcher` primitive.** The one genuinely missing completeness primitive (Every-Layout): N equal-weight items that flip **atomically** all-in-a-row ↔ all-stacked at a content-width threshold — never an awkward "2-then-1" intermediate. One of only two layouts (with `sidebar`) that a grid provably cannot express, because it relies on the negative-`flex-basis` axis-flip trick. Closed `threshold` param + optional bounded `limit`.
- **`cards` `minItem` wire field.** Promote the existing CSS-only `--vms-card-min` token to explicit server intent — a bounded `minItem` token on the `cards` layout. Makes the industry-converged `repeat(auto-fit, minmax(min(X,100%),1fr))` grid substrate (Every-Layout Grid = Chakra SimpleGrid = Compose `GridCells.Adaptive` = Flutter `MaxCrossAxisExtent`) a declared, server-driven choice.
- **`fits` node (responsive selection).** SwiftUI `ViewThatFits` ported to the wire: render the first child whose intrinsic size fits the container, else the next — container-relative, decided client-side at layout time, zero breakpoints. Generalizes the existing `split`→`stack` collapse to arbitrary alternatives. The one genuinely novel borrow; highest design surface (likely its own phase).
- **Layout policy in AGENTS.md.** Write the two standing principles as the governing test for *all* future layout changes: (a) responsiveness must be intrinsic / container-relative with **zero viewport breakpoints** — container queries the only escape hatch, never `@media`; (b) every layout knob is a **closed enum or bounded scalar, never raw CSS**. A field joins the vocabulary iff it passes both.
- **Demo verification spread (the centerpiece).** A dedicated phase building as many temporary VMS demo apps as needed (under `demo/`, standard app structure, served locally) to visually verify every important layout — header-bar/`arrange`, each `align` value, `switcher` flip, `sidebar` collapse, `cards`/`minItem`, `fits` selection, plus real-app compositions (dashboard, list-detail). Human (operator) reviews every layout, then we iterate — not assume it worked.

**Key constraints:** **Two-backend parity is mandatory** — every new node/field lands byte-identically in TS (`src/index.ts` + `browser.ts` + `styles/default.css`) AND .NET (`viewmodel-shell-dotnet/ViewModels.cs`, with `[JsonIgnore(WhenWritingNull)]` on every nullable wire field), plus a widened/new `parity/` fixture; `bun run parity/run.ts` byte-identical green. **No raw CSS on the wire and no viewport `@media`** — both principles above are hard gates, not guidelines. **Lockstep npm + NuGet** version bumps + CHANGELOG + the manual publish ritual + git tag + advance `main` per AGENTS.md release rules (the milestone spans several minors as each primitive ships). Pre-production, so **no backward-compat burden** — `split`/`sidebar`/`row` may be re-expressed under the finished model if cleaner. Existing primitives (`stack`, `row`, `cards`, `sidebar`, `split`, `section variant:"card"`, `modal`) already cover Stack+Cluster+Grid+Sidebar+Box+Overlay — this milestone adds the gaps, it does not rewrite what works.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Stateless server / wire-format contract (GET → {vm,state}, POST multipart → {vm,state}) — existing
- ✓ Full ViewNode hierarchy (page, section, list, form, field, checkbox, button, text, link, stat-bar, tabs, progress, modal, table) — existing
- ✓ Server-initiated redirect (`ShellResponse.RedirectTo`) — existing
- ✓ Client side-effects (`set-local-storage`, `set-session-storage`) — existing
- ✓ Polling + push (`pollInterval`, `NextPollIn`, `shell.push()`) — existing
- ✓ TypeScript backend subpath (`@ashley-shrok/viewmodel-shell/server`), compiled JS so it runs in plain Node — existing (v0.3.11)
- ✓ Cross-backend parity harness — 7 fixtures, .NET/Bun/Node byte-identical, CI-gated — existing
- ✓ ModalNode size variants, table horizontal overflow, box-sizing reset (issue #3) — existing
- ✓ **AGNOSTIC-01**: Core (`src/index.ts`) references zero platform globals — generic capability seam delegates `navigate`, `storage`, and optional `transport` to the adapter — Validated in Phase 1: Capability Seam Refactor
- ✓ **AGNOSTIC-02**: Browser bindings (`window.location`, `localStorage`, `sessionStorage`) relocated out of core into `BrowserAdapter` behind the seam, zero observable behavior change (parity green, all 7 fixtures) — Validated in Phase 1
- ✓ **AGNOSTIC-03**: CI guard (`check-core-platform-globals.mjs`, step in `parity.yml`) fails the build if `src/index.ts` references a platform global — Validated in Phase 1
- ✓ **AGNOSTIC-04**: AGENTS.md + README document the capability seam and the CI-enforced "core references zero platform globals" invariant — Validated in Phase 1
- ✓ **UPLOAD-01**: Upload progress (issue #4) — `ShellOptions.onUploadProgress(sent,total)` shipped as the first feature built *through* the `transport` seam; `XMLHttpRequest` binding lives only in `BrowserAdapter.transport` (zero in core src/index.ts, CI-gated); three-condition routing with silent fetch fallback; XHR failures reject into the existing `onError` path (byte-identical to fetch, parity green) — Validated in Phase 2: Upload Progress + Milestone Closeout
- ✓ **MIGRATE-01**: Copy-pasteable `MIGRATION.md` at repo root — npm `0.3.13` (patch; NuGet unchanged `0.3.9`; major.minor-alignment rule honored), the `onUploadProgress` API addition, explicit NOT-breaking list, upgrade steps, and the two silent-behavior caveats (transport-fallback, `total > 0` divide-by-zero guard) — Validated in Phase 2
- ✓ **THEME-01**: Importing only `viewmodel-shell/styles.css` yields a centered, `--vms-page-max: 1080px`, `clamp()`-padded `.vms-page` shell with zero app CSS and zero `@media` queries (shell on the existing `.vms-page` rule, no DOM/renderer change) — Validated in Phase 3: Default Design System
- ✓ **THEME-02**: One coherent additive scale — 6 `--vms-space-*` + 7 all-`rem` `--vms-text-*` `:root` tokens; every literal spacing/font-size snapped to the nearest step (UI-SPEC ledger) — Validated in Phase 3
- ✓ **THEME-03**: `PageNode.density?: "comfortable" | "compact"` (additive closed-union wire field, both backends) → `.vms-page--compact` remaps the sm/md/lg rhythm tokens; omitted/comfortable byte-identical — Validated in Phase 3
- ✓ **THEME-04**: `SectionNode.variant?: "card"` (additive closed-union wire field, both backends) → `.vms-section--card` grouped surface built from existing seam vars, zero new color tokens — Validated in Phase 3
- ✓ **THEME-05**: Override seam regression-proven — every pre-existing `:root` var byte-identical except the one D-17 WCAG-AA fix (`--vms-text-muted #6b6b80→#9090a8`); zero edits to the 11 `styles/themes/*.css`; parity 7/7 byte-identical — Validated in Phase 3
- ✓ **LAYOUT-01**: One optional closed-union `layout?: "stack" | "split" | "cards"` on the existing `PageNode`/`SectionNode` (both backends); omitted AND explicit `"stack"` emit zero modifier class — DOM byte-identical to prior vertical stack, no new node types, existing apps unchanged — Validated in Phase 4: Preset-Grid Layout
- ✓ **LAYOUT-02**: `split` preset = capped-2-equal-column intrinsic grid collapsing to 1 on narrow, zero app breakpoints / zero `@media` (`minmax(max(16rem, calc(50% - gap)), 1fr)`) — Validated in Phase 4
- ✓ **LAYOUT-03**: `cards` preset = `repeat(auto-fit, minmax(min(var(--vms-card-min),100%),1fr))` auto-fit from the single additive `--vms-card-min: 16rem` token, collapses to one column intrinsically — Validated in Phase 4
- ✓ **LAYOUT-04**: Only the closed-union enum crosses the wire — no spans/tracks/named areas; all geometry lives in CSS (override seam sacred, one additive `:root` var) — Validated in Phase 4
- ✓ **LAYOUT-05**: Field present in `src/index.ts` (+ `src/server.ts` via re-export, no edit), the single shared `viewmodel-shell-dotnet/ViewModels.cs`; FeatureProbe parity fixture widened (layout+density+card) — .NET/Bun/Node byte-identical, existing 7 fixtures green (closed the Phase 3 D-05 deferral) — Validated in Phase 4
- ✓ **EXAMPLES-01**: Showcase gained a navigable canonical reference set — kitchen-sink gallery + Dashboard (`cards`) / Form-heavy (`stack`) / List-detail (`split`) archetypes on the locked Bootstrap mapping (Dashboard/Checkout/Album), `.vms-*`-only, zero per-view `<style>`; visual serviceability signed off by human reviewer (2026-05-18) against the CI-green structural proxies — Validated in Phase 5: Canonical Examples + 0.4.0 Closeout
- ✓ **EXAMPLES-02**: All 7 non-bun demo frontends de-chromed to zero-`<style>` scaffolds; each pins one distinct shipped theme via its TS entrypoint (incl. the demoted `dark-purple` on Tasks); sanctioned single-token retune only (RetroBoard `--vms-page-max` per-app file) — CI-guarded by `check-no-demo-style.mjs` — Validated in Phase 5
- ✓ **EXAMPLES-03**: AGENTS.md gained a focused "Design system" section + the locked preset→archetype→Bootstrap mapping pointing at the live Showcase as single source of truth; bounded accuracy-only pass; major.minor rule text byte-unchanged — Validated in Phase 5
- ✓ **RELEASE-01**: npm `0.3.14`→`0.4.0` + NuGet `0.3.10`→`0.4.0` aligned (+ `package-lock.json` synced) — the layout enum is the wire-format change forcing the aligned minor per the AGENTS.md major.minor rule — Validated in Phase 5
- ✓ **RELEASE-02**: Full cross-backend parity suite byte-identical green (7 fixtures, .NET/Bun/Node, incl. the Phase-4-widened FeatureProbe); zero new parity surface, `backends.json`/fixtures git-unchanged (CSS/client-only Showcase has no wire surface) — Validated in Phase 5
- ✓ **RELEASE-03**: One consolidated 0.4.0 CHANGELOG + MIGRATION covering the whole milestone; dark→light + the one-value `--vms-warning` AA tighten framed as intentional default-appearance change (NOT a wire/API break) with the one-line `themes/dark-purple.css` restore — Validated in Phase 5
- ✓ **RELEASE-04**: Existing tests stay green (vitest 31/31); no new jsdom behavior test added (layout/density/card behavior is the inherited Phase 3/4 suite — D-25); new invariants enforced via standalone static CI guards gated in `parity.yml` — Validated in Phase 5
- ✓ **WIRE-01**: Every input node (Field/Checkbox/Tabs in both backends) declares a required `bind: string` path; renderer reads/writes through it via `StateAccess.read/write`; agent reading the JSON sees the same path and can mutate state directly — Validated in Phase 6: Wire Shape Change
- ✓ **WIRE-02**: Client maintains a locally-mutable state copy; `BrowserAdapter` writes to bound paths on user input via the `StateAccess` seam; no DOM-only harvest path remains in `browser.ts` — Validated in Phase 6
- ✓ **WIRE-03**: Dispatch wire carries `{action: {name}, state, files?}` only; `context` field removed from `ActionEvent`, `ActionDescriptor`, `ActionPayload<T>`, `parseFormDataAction`, and `parseJsonAction` across both backends — Validated in Phase 6
- ✓ **WIRE-04**: Every dispatch-bearing node (button, tab, field-on-change/Enter, checkbox-on-change, table sort/filter/pagination) carries an action name only; demos use per-row unique names (`delete-row-${id}`, `toggle-row-${id}`, `select-ticket-${id}`) with framework agnostic about naming style — Validated in Phase 6
- ✓ **WIRE-05**: `validateActionNames` (TS, `server.ts:73`) auto-invoked by `createAction`; `ViewTreeValidation.ValidateActionNames` (.NET, `ViewModels.cs:365`) auto-invoked through `ShellResponse<T>.Validate()`; framework rejects duplicate-name-for-distinct-operation at tree-build time before serialization; 13 TS vitest cases + 16 .NET xUnit cases green — Validated in Phase 6
- ✓ **WIRE-06**: `browser.ts` rewritten as thin interpreter (961 → 870 LOC); the seven context-assembly paths identified by the codebase audit collapse to one declarative `StateAccess.read/write` seam (21 sites); zero DOM harvest, zero implicit scope rules, zero synthetic context — Validated in Phase 6
- ✓ **WIRE-07**: All 14 demo backends (`Tasks`, `ContactManager`, `ExpenseTracker`, `RetroBoard`, `HelpDesk`, `FeatureProbe`, `Reorder`, plus every `-bun` twin and the Showcase) migrated; every .NET controller calls `.Validate()`; 172 demo .NET tests pass; zero `payload.[Cc]ontext` or `TableSelection` references remain anywhere in `demo/` — Validated in Phase 6
- ✓ **WIRE-08**: Cross-backend parity suite byte-identical green across all 7 fixtures × 15 backends (.NET + Bun for tasks/contacts/expenses/retro/helpdesk/reorder; .NET + Bun + Node for feature-probe); `check:core-globals` still green; agent-discoverability protocol token bumped to `viewmodel-shell/1.0` in all 13 demo mount HTML files — Validated in Phase 6

### Active

<!-- Current scope. Building toward these. -->

- Active REQ-IDs for v1.0.0 are defined in `.planning/REQUIREMENTS.md` (scoped to this milestone).

<!-- Detailed REQ-IDs live in REQUIREMENTS.md, scoped per milestone. -->

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Drag-and-drop / `DraggableNode` / `DropTargetNode` (issue #2) — declined; drag is the most browser-runtime-dependent interaction (conflicts with no-browser-test promise), keyboard a11y is the unsolved hard 20%, and a single-child wrapper is a foreign structural pattern. Reorder is solved via the click-to-select-then-place pattern (Reorder demo) with zero framework changes.
- `reorderable` convenience on ListNode — deferred; revisit only if per-app reorder boilerplate proves painful across many real apps (driven by usage, not speculation).
- Global `*` box-sizing reset — rejected; the stylesheet is opt-in and must not stomp the host app's own page elements. Scoped reset shipped instead.
- Cross-runtime parity beyond Bun+Node (Deno/Workers) — deferred; same Web Fetch surface, low marginal value until a consumer needs it.
- `image`/media node ([issue #5](https://github.com/ashley-shrok/ViewModelShell/issues/5)) — deferred (not rejected); highest coverage-per-cost content node and zero tension with the no-browser promise, but scoped out of 0.4.0 to keep it tight on theme + layout + examples. Revisit as its own small change.
- `chart`/data-viz node ([issue #6](https://github.com/ashley-shrok/ViewModelShell/issues/6)) — deferred, needs design; collides with no-browser-testability + multi-target + parity. Tracked as a named deferred decision (server-rendered SVG/image vs. declarative ChartNode behind the seam vs. explicit out-of-scope), likely its own milestone — not a silent gap.

## Context

- Mature framework, mid-stream. Codebase, demos (Tasks, ContactManager, ExpenseTracker, RetroBoard, HelpDesk, FeatureProbe, Reorder + `-bun` mirrors), npm + NuGet packages, and a green cross-backend parity harness all already exist.
- Verification surface: 136 C# unit tests, ~97 frontend vitest, 7-fixture cross-backend parity (CI-gated on every push), plain-Node smoke. Parity is the highest-signal check — it catches wire-format drift between backends, the bug class that silently breaks consumers.
- The architectural drift being corrected: `src/index.ts` directly calls `window.location.href` (redirect; has an `onRedirect` hook but the default lives in core), and `localStorage`/`sessionStorage` (side-effects; **no** override hook — fully browser-bound in core). This violates the framework's own stated invariant ("the core never references HTMLElement, document, or any platform type"). Issue #4 (upload progress) would add `XMLHttpRequest` as a third violation if bolted on rather than built through a seam.
- Reassuring risk note: the wire contract (redirect/side-effect responses) is parity-covered by the FeatureProbe fixtures. The refactor moves *where the browser binding executes*, not *what the protocol does* — blast radius is "which layer holds the binding," not "does the feature still work."

## Constraints

- **Compatibility**: No wire-format or public-API breaking change. Consumers use bundlers (frontend) or the `/server` subpath (backend); the seam must be internal or backward-compatible.
- **Tech stack**: TypeScript ESM, compiled to `dist/` via tsc; npm + NuGet shipped version-aligned at major.minor for wire-format changes (npm-only bumps allowed for client-only changes).
- **Verification**: Phase is not done until the full parity suite is green AND the new CI invariant guard passes. Verifier/plan-check agents on — this is architecture-invariant work, not a quick.
- **Security**: Dual-use N/A; standard safe-code practices.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Capability seam over per-feature browser hooks | Generic verbs (navigate/storage/transport) let any future front-end pick up redirect/side-effects/progress automatically; restores the core invariant the framework already claims | ✓ Shipped Phase 1 — optional Adapter methods, CI-enforced, parity green |
| 2 sequential phases, zero quicks | Phase 1 = refactor (no behavior change, parity-verifiable); Phase 2 = feature through the seam, depends on Phase 1. Quicks skip the verification gates this work centers on | ✓ Good — both phases shipped, every gate (parity 7/7, core-globals guard, 15/15 unit) independently verified |
| Upload progress built *through* the seam, not bolted on | Avoids a third core platform violation; makes issue #4 the first feature done right | ✓ Good — `onUploadProgress` shipped; `XMLHttpRequest` lives only in `BrowserAdapter.transport`, zero in core |
| Consumer migration blurb is a first-class milestone deliverable | Downstream maintainers (multiple apps) must know what/whether to update; not an afterthought | ✓ Good — `MIGRATION.md` + `CHANGELOG.md` + GitHub release v0.3.13 shipped; consumers no longer rely on hand-relayed blurbs |
| npm 0.3.13 PATCH, not 0.4.0 (E pushback) | Generic SemVer "minor=feature" conflicts with the project's documented major.minor-alignment rule and established npm-only-patch cadence; held the project rule over generic convention | ✓ Good — npm 0.3.13, NuGet 0.3.9 unchanged, AGENTS.md rule byte-unchanged |
| Layout *intent* lives in the model (preset-grid enum on existing containers), not CSS-only | The framework's promise is agents build apps with no browser — the consuming agent is blind and can't iterate on ugliness, and non-browser/multi-target adapters can't read CSS. Appearance stays 100% CSS; arrangement is server intent | ✓ Shipped Phase 4 — LAYOUT-01..05 validated; `layout?` closed-union on `page`/`section` (both backends), split/cards pure-CSS presets (zero `@media`), omitted/`stack` byte-identical, parity .NET/Bun/Node green; no version bump (D-11, Phase 5 owns the 0.4.0 bump) |
| 0.4.0 minor bump (npm + NuGet aligned) | Same major.minor-alignment rule that kept 0.3.13 a PATCH (no wire change) now *requires* a minor: the layout enum is a wire-format change. Rule applied consistently, opposite outcome | ✓ Shipped Phase 5 — npm 0.3.14→0.4.0, NuGet 0.3.10→0.4.0 (+ lockfile synced), one consolidated CHANGELOG/MIGRATION; parity 7/7 green, AGENTS.md rule text byte-unchanged |
| Default palette re-based dark→light; D-01↔D-07 AA conflict resolved via the D-17 one-value precedent | Bootstrap-benchmarked few-shot surface needs a light default; the light-purple set verbatim failed the locked WCAG-AA floor on `--vms-warning` only. Tightening exactly one shipped-default value (not re-opening D-01, not exempting the floor) extends the proven D-17 pattern — the variable still exists, themes still override it | ✓ Shipped Phase 5 — default `:root` = light-purple set with `--vms-warning #c89610→#a37510`; `light-purple.css` + 11 theme files byte-unchanged; `themes/dark-purple.css` byte-exact prior-dark capture; AA CI-enforced 11/11; conflict surfaced to the user, not auto-resolved |
| Design-system scale = additive CSS variables; density/card = additive closed-union wire fields | Spacing/type as `--vms-space-*`/`--vms-text-*` keeps the override seam sacred (additive only) and lets density be a scoped token remap; the blind agent needs density/card as enumerable model intent, not host CSS. "Serviceable" made falsifiable via a WCAG-AA contrast floor (the one D-17 default-value change) | ✓ Shipped Phase 3 — THEME-01..05 validated; parity 7/7, zero theme-file edits, 23/23 vitest, build/core-globals/dotnet green |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-08 — Phase 15 (Poll-fold + `selection.action` resurrection) complete. The v4.1 non-blocking dispatch core is closed out: `performRoundTrip`'s non-blocking apply gate now also discards a response whenever a coalesced re-fire is queued (`pendingNonBlockingRefire === null`), fixing the rapid same-checkbox double-toggle revert (the exact 0.15.0 `selection.action` failure) — the blocking lane is untouched (CR-02 intact); poll dispatch is documented as always riding the non-blocking lane (NBA-05, doc-only); and `agent-skill.md` gained a `## Non-blocking actions (blocking:false)` section, byte-copied to the .NET `AgentSkill.md` (parity gate green). Proven by 3 new/extended TS test files (real-timer poll-fold, coalesce-discard regression with FAIL-before/PASS-after, jsdom checkbox double-toggle) with the full green-tree gate re-run in-session (vitest 528, parity 8/8 + skill twins, .NET 102, all 5 demo projects 181/181); requirements NBA-05/06/07 validated. No wire/API change, no version bump/publish (deferred to Phase 16: test apps + human verification + release).*
