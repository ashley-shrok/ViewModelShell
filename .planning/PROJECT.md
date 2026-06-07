# ViewModel Shell

## What This Is

A server-driven UI framework where the wire format is structured enough that agents can build full-stack apps without ever opening a browser, and all UI tests are pure unit tests with no browser runtime. The server is a stateless transformer: it takes the client's current UI state plus an action and returns the next state plus a fresh view tree of typed nodes. A thin TypeScript adapter renders that tree to DOM with no app-specific code. Ships as two version-aligned packages: `@ashley-shrok/viewmodel-shell` (npm — frontend renderer + `/server` backend subpath) and `AshleyShrok.ViewModelShell` (NuGet — .NET backend types).

## Core Value

The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end. If platform assumptions leak into the core, the framework's central promise (and its main differentiator) is broken.

## Current Milestone: 1.0.0 Truly Self-Describing Wire

**Goal:** Deliver the framework's original pitch — "agents drive what the browser drives" — without the asterisk. Eliminate the `context` payload from the wire entirely; every input node binds to a path in state; action names are unique per operation; the renderer becomes a thin interpreter; the agent path and browser path become genuinely identical. Pair this with framework-owned error envelopes and a top-level success flag so failures are uniformly legible across every VMS app.

**Target features:**
- **State bindings + context elimination.** Every input node (text/number/checkbox/select/file/etc.) declares a `bind` path into the state model. Typing/changing mutates local state in place. On dispatch, the wire carries only `{action, state, files?}` — the `context` field is gone entirely. The renderer is rewritten as a thin interpreter: it reads/writes state at declared paths and dispatches action names. No DOM harvest, no scope rules, no implicit gathering. An agent reading the JSON sees the same declarations the renderer sees, and assembles requests identically.
- **Unique action names per operation.** Every dispatch-bearing node (button, table sort/filter/page/selection, tabs, fields, checkboxes) stops carrying a context payload. Per-row identity (which used to be `context: {id: 42}`) moves into the action name itself (`delete-row-42`, etc.). Framework enforces "one action name = one operation" at tree-build time. Apps choose their own naming style; no framework router primitive.
- **Framework-owned error envelope.** Malformed payloads, unknown action names, and uncaught handler exceptions all return a uniform `{ok: false, errors: [{path, message}]}` shape — the framework intercepts before the app's handler runs, so the silent-revert anti-pattern stops being writable in app code.
- **Top-level `ok` flag on every response.** Set by the framework, not the app. Gives agents one stable place to check "did the thing work" across every VMS app.

**Key constraints:** **Hard wire-format break** — every consuming app must migrate. No backwards-compatibility helpers; the framework simply ships the corrected protocol. Aligned npm + NuGet bump to `1.0.0` per the major.minor-alignment rule. Files stay on their own multipart channel (only path exempt from "everything lives in state"). All existing 0.4.0–0.16.0 features (busy, preventUnload, table modes, side effects, polling, redirects) continue to work; they just no longer use `context`. Cross-backend parity stays green; renderer simplification (~7 distinct context-assembly paths today, collapsed to one declarative path) must not change the rendered DOM for equivalent inputs.

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
*Last updated: 2026-06-07 — Phase 6 (Wire Shape Change) complete. The `context` payload is gone from the wire end-to-end: every input node declares a `bind: string` path into state; the renderer reads and writes through that path via a single `StateAccess` seam (the seven prior context-assembly sites in `browser.ts` collapsed to one); dispatch carries `{action: {name}, state, files?}` only; the framework enforces "one action name = one operation" at tree-build time in both backends; all 14 demos migrated; cross-backend parity is byte-identical green across 7 fixtures × 15 backends; agent-discoverability protocol token bumped to `viewmodel-shell/1.0`. Phase 7 (error envelope, `ok` flag, aligned 1.0.0 npm+NuGet release closeout) is next.*
