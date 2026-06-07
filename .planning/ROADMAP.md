# Roadmap: ViewModel Shell

## Milestones

- ✅ **0.3.13 Platform-Agnosticism** — Phases 1–2 (shipped 2026-05-15) — [archive](./milestones/0.3.13-ROADMAP.md)
- ✅ **0.4.0 Design System** — Phases 3–5 (shipped 2026-05-18; npm + NuGet 0.4.1)
- 🔄 **1.0.0 Truly Self-Describing Wire** — Phases 6–7 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (3, 4, 5): Planned milestone work (numbering continues from 0.3.13)
- Decimal phases (e.g. 3.1): Urgent insertions (marked INSERTED)

<details>
<summary>✅ 0.3.13 Platform-Agnosticism (Phases 1–2) — SHIPPED 2026-05-15</summary>

- [x] Phase 1: Capability Seam Refactor (3/3 plans) — completed 2026-05-15
- [x] Phase 2: Upload Progress + Milestone Closeout (3/3 plans) — completed 2026-05-15

Full detail: [milestones/0.3.13-ROADMAP.md](./milestones/0.3.13-ROADMAP.md)

</details>

### ✅ 0.4.0 Design System (Shipped 2026-05-18)

**Milestone Goal:** Ship a serviceable out-of-box look so agents — blind by design (no browser, no visual iteration loop) — produce decent apps without human intervention. The framework guarantees the baseline because the only entity that could compensate (the app-building agent) cannot see its output. Appearance is 100% CSS (untouched override seam); layout *intent* enters the wire as one preset enum on existing containers (the 0.4.0-forcing wire-format change), with the default value byte-identical to today's vertical flow.

- [x] **Phase 3: Default Design System** - Shipped stylesheet delivers page shell, spacing/type scale, density knob, card section variant — zero app CSS, override seam unchanged (completed 2026-05-17)
- [x] **Phase 4: Preset-Grid Layout** - One optional layout-preset enum on `page`/`section`, default = today's vertical flow, round-trips byte-identically across .NET/TS backends + new parity fixture (completed 2026-05-18)
- [x] **Phase 5: Canonical Examples + 0.4.0 Release Closeout** - Showcase/demos on the shipped stylesheet (no per-demo `<style>` chrome), AGENTS.md docs, aligned 0.4.0 npm+NuGet bump, full parity green, MIGRATION/CHANGELOG, tests green (completed 2026-05-18)

### 🔄 1.0.0 Truly Self-Describing Wire (In Progress)

**Milestone Goal:** Deliver the framework's original "agents drive what the browser drives" pitch without the asterisk. Eliminate the `context` payload from the wire entirely — every input binds to a path in state, action names are unique per operation, the renderer becomes a thin interpreter — so an agent reading only the JSON the server emits can drive any VMS app identically to the browser. Pair this with framework-owned error envelopes and a top-level `ok` flag so failures are uniformly legible. Hard wire-format break; aligned npm + NuGet `1.0.0` major bump; no compatibility shims.

- [ ] **Phase 6: Wire Shape Change** - Context payload eliminated; every input carries a bind path; action names are unique per operation; renderer rewritten as a thin interpreter; all demos migrated; cross-backend parity green
- [ ] **Phase 7: Error Envelope + ok Flag + 1.0.0 Release Closeout** - Framework-owned error envelope + top-level `ok` flag on every response; aligned 1.0.0 npm+NuGet bump; MIGRATION.md, CHANGELOG.md, AGENTS.md updated; full parity + tests green at release time

## Phase Details

### Phase 3: Default Design System
**Goal**: An app that imports only the shipped stylesheet and renders `.vms-*` nodes gets a serviceable, coherently-spaced page with no app-authored CSS — and the existing CSS-variable / alternate-theme override seam still fully reskins the UI with no behavior change.
**Depends on**: Phase 2 (0.3.13 baseline — parity green, capability seam shipped)
**Requirements**: THEME-01, THEME-02, THEME-03, THEME-04, THEME-05
**Success Criteria** (what must be TRUE):
  1. An app importing only the shipped stylesheet renders a centered, max-width page with responsive horizontal padding and zero app-authored CSS (THEME-01).
  2. A page composing form + table + stat-bar + section shows one coherent spacing scale and type scale with no per-app tuning (THEME-02).
  3. Setting a page density value (`comfortable` | `compact`) visibly changes global spacing / control sizing with no app CSS (THEME-03).
  4. A `section` with `variant: "card"` renders a visually grouped surface (background, border, padding, radius) (THEME-04).
  5. Overriding `:root` CSS variables / swapping the shipped theme file fully reskins the UI without editing rules — regression-guarded, no override-seam behavior change (THEME-05).
**Plans**: 3 plans
  - [x] 03-01-PLAN.md — Scale tokens + literals→variables + centered shell + D-17 AA fix (THEME-01, THEME-02, THEME-05)
  - [x] 03-02-PLAN.md — Additive PageNode.density?/SectionNode.variant? closed-union fields, TS + .NET (THEME-03, THEME-04)
  - [x] 03-03-PLAN.md — Renderer emission + .vms-page--compact/.vms-section--card CSS + jsdom tests + parity regression + AGENTS.md tables (THEME-03, THEME-04, THEME-05)
**UI hint**: yes

### Phase 4: Preset-Grid Layout
**Goal**: `page` and `section` accept one optional layout-preset enum that arranges their direct children; the default value renders byte-identically to today's vertical stack (non-breaking, no new node types), the preset is the only layout field on the wire, and it round-trips identically across the .NET and TS backends with a new parity fixture covering it.
**Depends on**: Phase 3 (presets arrange children *within* the shipped design system's spacing/grid; the design-system rhythm must exist before layout composes on top of it)
**Requirements**: LAYOUT-01, LAYOUT-02, LAYOUT-03, LAYOUT-04, LAYOUT-05
**Success Criteria** (what must be TRUE):
  1. With the layout-preset omitted/defaulted, `page`/`section` render byte-identically to current vertical-stack output — no new node types, existing apps unchanged (LAYOUT-01).
  2. The "split" preset lays children in columns on wide viewports and collapses to stacked on narrow viewports, with no app-specified breakpoints (LAYOUT-02).
  3. The "cards" preset auto-fits children from a single min-item-width value and collapses to one column on narrow screens (LAYOUT-03).
  4. The wire carries only the layout-preset enum — no spans, tracks, or named areas cross the contract (LAYOUT-04).
  5. The layout-preset field is present in `src/index.ts`, `src/server.ts`, all 5 demo `ViewModels.cs` copies + the NuGet source, and a new parity fixture exercises it with .NET/Bun/Node byte-identical (LAYOUT-05).
**Plans**: 4 plans
  - [x] 04-01-PLAN.md — Additive `layout?` closed-union field on PageNode/SectionNode, TS + .NET (LAYOUT-04, LAYOUT-05)
  - [x] 04-02-PLAN.md — Renderer emission + split/cards CSS + `--vms-card-min` + jsdom tests, zero media queries (LAYOUT-01, LAYOUT-02, LAYOUT-03)
  - [x] 04-03-PLAN.md — Widen FeatureProbe VM (TS+.NET) for layout/density/card; cross-backend parity green (closes D-05) (LAYOUT-01, LAYOUT-05)
  - [x] 04-04-PLAN.md — AGENTS.md node + CSS-class tables accurate-only for the `layout` field (LAYOUT-05)
**UI hint**: yes

### Phase 5: Canonical Examples + 0.4.0 Release Closeout
**Goal**: Showcase and every demo render on the shipped stylesheet with zero hand-rolled page chrome and a Bootstrap-benchmarked canonical reference set; AGENTS.md documents presets/density/card so an agent can use them from docs alone; and 0.4.0 ships with npm+NuGet aligned, the full cross-backend parity suite green (incl. the new layout fixture), MIGRATION/CHANGELOG written, and all tests green plus new jsdom unit tests for the new behavior.
**Depends on**: Phase 4 (demos can only switch to the shipped stylesheet once theme + layout exist; RELEASE-02 parity gate must include the Phase 4 layout fixture)
**Requirements**: EXAMPLES-01, EXAMPLES-02, EXAMPLES-03, RELEASE-01, RELEASE-02, RELEASE-03, RELEASE-04
**Success Criteria** (what must be TRUE):
  1. Showcase renders a canonical reference set (≥ dashboard, form-heavy page, list/detail) using only `.vms-*` nodes + the shipped stylesheet, visually serviceable benchmarked against Bootstrap's example pages (EXAMPLES-01).
  2. Every demo app imports the shipped stylesheet and contains zero hand-rolled per-demo `<style>` page chrome (EXAMPLES-02).
  3. AGENTS.md documents the layout presets, density control, and card variant with the node table + CSS-class table updated, usable from docs alone (EXAMPLES-03).
  4. npm `@ashley-shrok/viewmodel-shell` and NuGet `AshleyShrok.ViewModelShell` ship aligned at `0.4.0`, and MIGRATION.md + CHANGELOG document the additive layout preset (default = prior behavior, non-breaking) + theme/density/card additions + "existing apps render unchanged unless they opt in" (RELEASE-01, RELEASE-03).
  5. The full cross-backend parity suite is green across all fixtures + backends including the new layout-preset fixture, existing unit tests stay green, and new jsdom unit tests cover layout presets / density / card variant with no browser runtime (RELEASE-02, RELEASE-04).
**Plans**: 6 plans
  - [x] 05-01-PLAN.md — Palette re-baseline (light) + dark-purple.css capture + literals audit + WCAG-AA CI guard
  - [x] 05-02-PLAN.md — Showcase canonical reference set (gallery + Dashboard/Form-heavy/List-detail) + switcher remap/scope
  - [x] 05-03-PLAN.md — De-chrome every demo onto the shipped stylesheet + distinct pinned themes
  - [x] 05-04-PLAN.md — AGENTS.md Design system section + bounded accuracy pass
  - [x] 05-05-PLAN.md — Aligned 0.4.0 npm+NuGet bump + consolidated MIGRATION/CHANGELOG + README accuracy
  - [x] 05-06-PLAN.md — Closeout gate: parity 7/7 + inherited jsdom + static CI guards + reviewer sign-off
**UI hint**: yes

### Phase 6: Wire Shape Change
**Goal**: Eliminate the `context` payload from the wire. Every input node declares a `bind` path into the state model; the renderer reads and writes through that path. The client maintains a locally-mutable state copy — typing mutates local state in place rather than harvesting form values. On dispatch, the wire carries only `{action, state, files?}`. Every dispatch-bearing node carries an action name only; per-row identity is encoded in the action name itself. The framework enforces "one action name = one operation" at tree-build time. The renderer is rewritten as a thin interpreter: seven distinct context-assembly paths collapse into one declarative bind-path path, with no DOM harvest, no implicit scope rules, no synthetic context. All demos are migrated. Cross-backend parity green across .NET / Bun / Node with every fixture rewritten to the new wire shape.
**Depends on**: Phase 5 (0.4.0 baseline — all existing features stable, parity green, demos on shipped stylesheet)
**Requirements**: WIRE-01, WIRE-02, WIRE-03, WIRE-04, WIRE-05, WIRE-06, WIRE-07, WIRE-08
**Success Criteria** (what must be TRUE):
  1. An agent that reads only a GET `{vm, state}` response and walks the tree can identify every input's bind path, compose a mutated state, and POST `{action, state}` with no `context` field — the request the agent sends is byte-identical to what the browser renderer would send for the same interaction (WIRE-01, WIRE-02, WIRE-03).
  2. Every dispatch-bearing node in the rendered tree (button, tab, table control, checkbox) carries a fully-qualified action name with no embedded context payload; action names for per-row operations are unique and self-identifying (WIRE-04, WIRE-05).
  3. The framework rejects at tree-build time any attempt to register the same action name for two semantically distinct operations — the violation surfaces as an error before the tree is serialized to the wire (WIRE-05).
  4. The renderer source (`browser.ts`) has no context-assembly code paths; a grep for any prior context-harvesting pattern returns no matches; parity suite byte-identical across .NET / Bun / Node with new fixtures exercising bind-path round-trips (WIRE-06, WIRE-08).
  5. Every demo app (`Tasks`, `ContactManager`, `ExpenseTracker`, `RetroBoard`, `HelpDesk`, `FeatureProbe`, `Reorder`, `Showcase`, and all `-bun` twins) responds correctly to actions posted without a `context` field; no demo references the old context-payload shape (WIRE-07).
**Plans**: TBD
**UI hint**: no

### Phase 7: Error Envelope + ok Flag + 1.0.0 Release Closeout
**Goal**: Every VMS response carries a top-level `ok` flag set by the framework — not the app. Malformed submissions, unknown action names, and uncaught handler exceptions all return a uniform `{ok: false, errors: [{path, message}]}` envelope; the framework intercepts before the app handler runs so the silent-revert anti-pattern is no longer writable in app code. The milestone closes with aligned npm + NuGet `1.0.0` major bumps, a comprehensive MIGRATION.md covering all breaking changes from the wire-shape overhaul, CHANGELOG.md 1.0.0 entry, AGENTS.md rewritten for the new model (bind paths, unique action names, error envelope), and the full test suite green — vitest, dotnet test, and cross-backend parity.
**Depends on**: Phase 6 (the error envelope targets the new `{action, state}` wire shape; the release cannot ship until the wire change is complete and parity is green on the new format)
**Requirements**: ERROR-01, ERROR-02, ERROR-03, RELEASE-01, RELEASE-02, RELEASE-03, RELEASE-04, RELEASE-05
**Success Criteria** (what must be TRUE):
  1. Posting a malformed action submission to any VMS endpoint returns `{ok: false, errors: [{path, message}]}` at 4xx — the app handler never runs; no silent state revert occurs (ERROR-01).
  2. Posting an action name not present in the last-rendered tree returns the same `{ok: false, errors: [...]}` envelope; an uncaught exception thrown by an app handler is wrapped into the same shape — the error format is uniform regardless of failure origin (ERROR-02).
  3. Every successful response carries `ok: true`; every error response carries `ok: false` — an agent checking only that field gets a reliable success signal across every VMS app with no per-app convention (ERROR-03).
  4. npm `@ashley-shrok/viewmodel-shell` and NuGet `AshleyShrok.ViewModelShell` ship aligned at `1.0.0`; MIGRATION.md documents context-payload elimination, bind-path requirements, action-name uniqueness, and the error envelope as breaking changes with a per-app migration recipe; CHANGELOG.md has a 1.0.0 entry with crisp before/after framing (RELEASE-01, RELEASE-02, RELEASE-03).
  5. AGENTS.md "Critical gotchas" section is rewritten for the new model (no context references, bind-path pattern, unique-action-name rule, error envelope); vitest, dotnet test, and cross-backend parity suite are all green with new tests covering bind-path round-trip, action-name uniqueness enforcement, and error-envelope shape (RELEASE-04, RELEASE-05).
**Plans**: TBD
**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Milestone | Plans | Status | Completed |
|---|---|---|---|---|
| 1. Capability Seam Refactor | 0.3.13 | 3/3 | Complete | 2026-05-15 |
| 2. Upload Progress + Closeout | 0.3.13 | 3/3 | Complete | 2026-05-15 |
| 3. Default Design System | 0.4.0 | 3/3 | Complete | 2026-05-17 |
| 4. Preset-Grid Layout | 0.4.0 | 4/4 | Complete | 2026-05-18 |
| 5. Canonical Examples + 0.4.0 Closeout | 0.4.0 | 6/6 | Complete | 2026-05-18 |
| 6. Wire Shape Change | 1.0.0 | TBD | Pending | - |
| 7. Error Envelope + ok Flag + 1.0.0 Closeout | 1.0.0 | TBD | Pending | - |
