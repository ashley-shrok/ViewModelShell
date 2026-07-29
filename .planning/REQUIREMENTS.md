# Requirements: ViewModel Shell — Milestone v4.1 Data Visualization

**Defined:** 2026-07-04
**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end, and drivable end-to-end by an agent reading only the JSON the server emits.

This milestone adds VMS's first data-visualization primitive: a **structured `ChartNode`** whose payload is bounded declared data (a numeric series + labelled categories), rendered by **Chart.js behind the browser adapter** as a private implementation detail. It closes GitHub issue #6 (the lone open issue). Design was settled with the operator ahead of planning (a design session + a live tailnet comparison of frappe-charts / Chart.js / ApexCharts / hand-drawn SVG). Additive, no wire break — the protocol token stays `viewmodel-shell/1.0`.

**Locked design principles every requirement must satisfy:**
- **(D1) Structured, not an escape hatch.** The ChartNode carries bounded declared data (numeric series + labelled categories) an agent reads directly; parity diffs the DATA, not the pixels. A general "raw content / embed anything" node is explicitly REJECTED (the absence of an escape hatch is the product; agents would reach for it as least-resistance).
- **(D2) Library behind the adapter.** Chart.js is a PRIVATE implementation detail of the browser adapter (apps never touch it, same as the adapter using the DOM). The core (`src/index.ts`) and the .NET/bun backends stay dependency-free — they only EMIT ChartNode data; only the browser renders pixels.
- **(D3) Closed appearance, never raw CSS.** Chart appearance is `title` + the existing `tone` axis (danger/warning/success/info) only — no raw hex, no CSS, no arbitrary axis/tooltip config.

---

## v1 Requirements

### Chart primitive
- [x] **CHART-01**: A `ChartNode` renders a single-series **bar** chart (labelled categories × numeric values) from structured wire data — the series/categories are declared, agent-legible fields, not opaque pixels.
- [x] **CHART-02**: Chart appearance is limited to an optional `title` and a `tone` drawn from the existing tone axis (`danger | warning | success | info`) mapped to the theme's `--vms-*` tone tokens. No raw color/CSS/axis/tooltip config crosses the wire (D3).
- [x] **CHART-03**: When the server returns a new view tree with updated chart data, the adapter **redraws the chart in place** (re-render on view update — the standard VMS control→server→redraw loop), via Chart.js's native update path.
- [x] **CHART-04**: **Chart.js is a lazy/optional dependency of the browser package** — loaded only when a `ChartNode` is present (the optional-subpath pattern used by `@ashley-shrok/viewmodel-shell/vite`), tree-shaken to the registered controllers (bar first). Apps that render no chart pay zero chart bytes; the core + .NET/bun backends gain no dependency (D2).
- [x] **CHART-05**: The `ChartNode` lands byte-identically in TS (`src/index.ts` + `browser.ts`) and .NET (`ViewModels.cs` record + `[JsonDerivedType]` discriminator, every nullable wire field carrying `[JsonIgnore(WhenWritingNull)]`); **both** tree-validators descend into it (no fits-node-style blind spot); a `parity/` fixture (FeatureProbe) exercises it and `bun run parity/run.ts` is byte-identical green (data diffed, not pixels). The TUI adapter has a defined legible degradation (e.g. printed series / ASCII bars) so it doesn't break the non-browser target.

### Verification & release
- [x] **CHART-06**: The operator personally reviews the rendered chart in a browser (served over the tailnet) and signs off — a chart is visual, so verification is by human review, not assumed. `agent-skill.md` documents the `ChartNode` for wire-driving agents, byte-copied to the .NET `AgentSkill.md` (the parity gate diffs both).
- [x] **CHART-07**: Aligned additive **minor** release on both packages (npm + NuGet `4.1.0`) with CHANGELOG + MIGRATION, git tag, `main` advanced (verified `git merge-base --is-ancestor`), full green-tree gate at release time, `#vms-changelog` announcement, and GitHub issue #6 closed. Wire protocol token stays `viewmodel-shell/1.0`.

### Non-blocking actions (v4.2) — design of record `.planning/design/non-blocking-actions.md`
- [x] **NBA-01**: A dispatch can carry `blocking: false` (optional; default `true` → existing apps byte-unchanged). A non-blocking (silent) round-trip no longer occupies the single global dispatch mutex: a user action fired while a non-blocking round-trip is in flight is honored, not silently dropped, and vice versa. _(Gap-closed: CR-01 coalesce-refire misclassification + CR-02 non-lane-aware epoch fixed and re-verified — 14-VERIFICATION.md passed 4/4; refire replays its own {action,silent}, blocking responses are authoritative and always apply.)_
- [x] **NBA-02**: Rapid `blocking:false` triggers debounce/coalesce to a single in-flight request (latest wins) — the rapid-fire selection case never queues N round-trips.
- [x] **NBA-03**: A stale / out-of-order non-blocking response is discarded rather than clobbering a newer render, via a **client-side** sequence/epoch counter — NO wire epoch field, NO server-side reconciliation state, server code unchanged beyond handling the (normal) action name.
- [x] **NBA-04**: `blocking` is absent-when-default on BOTH backends. ⚠️ Because `blocking`'s default is `true` (inverted polarity from the usual false-default bools), the correct .NET pattern is `bool?` + `WhenWritingNull` (NOT the F2 `WhenWritingDefault`, which drops on `false` and would omit the meaningful value while emitting the default) — byte-aligned with the TS `blocking?: boolean` (omit=true; explicit `false` serializes). The wire token stays `viewmodel-shell/1.0`; `bun run parity/run.ts` is byte-identical green with a static wire-shape fixture proving `blocking`'s presence/absence. (NBA-02/NBA-03's client-only mechanics are verified by vitest, not parity — they have no wire signal.)
- [x] **NBA-05**: `pollInterval` runs its polls over the non-blocking path so the poll/user-action contention is gone — a user action clicked during a poll round-trip is honored, not dropped.
- [x] **NBA-06**: Per-checkbox/table-selection server-refresh works correctly: the box checks immediately (optimistic local `bind` write) AND fires a `blocking:false` action whose returned tree echoes selection back, so a stale response can never revert a rapid toggle (the 0.15.0 `selection.action` failure is fixed).
- [x] **NBA-07**: `agent-skill.md` documents `blocking:false` semantics for wire-driving agents and is byte-identical to the .NET `AgentSkill.md` (parity gate diffs both).
- [x] **NBA-08**: Three purpose-built demo apps (selection→live action bar; poll+user coexistence contrast; out-of-order staleness), each with a step-by-step "trigger X, then Y, expect Z" script, served over the tailnet; the operator signs off that rapid-toggle, poll-coexistence, and staleness behave as specified — this is a concurrency/timing feature, verified by human review, not assumed.
- [x] **NBA-09**: Aligned additive **minor** release on both packages (npm + NuGet) with CHANGELOG + MIGRATION, git tag, `main` advanced (verified `git merge-base --is-ancestor`), full green-tree gate at release time, `#vms-changelog` announcement. Wire token stays `viewmodel-shell/1.0`.
- [ ] **NBA-10** (CONDITIONAL — Phase 17, only if intent-drift is reported): a blocking action whose target node changed under an in-flight non-blocking round-trip is not dispatched with stale intent (hold + full-node-diff at departure; drop on any difference); the dropped-action outcome is surfaced, not silently swallowed.

---

## Future Requirements (deferred — not this milestone)

- **CHART-LINE**: A `line` chart type (ordered / time-ish series) — the natural second type; pull in when a real consumer needs it.
- **CHART-MULTI**: Multi-series charts (grouped/stacked bars, multiple lines) with the legend/per-series color surface that implies — deferred until a real consumer need justifies the added surface.
- **CHART-PIE**: Pie/donut — less agent-legible (parts-of-a-whole), more decorative; deferred.

## Out of Scope (explicit exclusions)

- **A general raw-content / embed / iframe node.** Rejected on principle (D1): an "put anything here" node is invisible to agents, browser-only, and erodes the discipline that makes VMS drivable. The sanctioned valve for genuinely un-expressible content is a separate non-VMS page reached via `LinkNode` (the existing vault `/upload-page` pattern), never a tree node.
- **Raw color / CSS / arbitrary axis-tick / tooltip configuration on the wire** (D3). If a needed appearance can't be expressed by `title` + `tone`, that's a gap to discuss, not a raw-style escape hatch.
- **Exposing Chart.js (its config objects, plugins, or instance) to apps.** The library is an adapter implementation detail (D2); an app that could pass Chart.js config would be authoring browser-only, un-testable UI.

---

## Traceability

| REQ-ID | Phase |
|--------|-------|
| CHART-01 | 12 |
| CHART-02 | 12 |
| CHART-03 | 12 |
| CHART-04 | 12 |
| CHART-05 | 12 |
| CHART-06 | 13 |
| CHART-07 | 13 |
| NBA-01 | 14 |
| NBA-02 | 14 |
| NBA-03 | 14 |
| NBA-04 | 14 |
| NBA-05 | 15 |
| NBA-06 | 15 |
| NBA-07 | 15 |
| NBA-08 | 16 |
| NBA-09 | 16 |
| NBA-10 | 17 |

---

*Milestone: v4.1 Data Visualization*
*Requirements defined: 2026-07-04*

---

## Milestone v5.1 — Navigation Primitives (Phase 20)

**Defined:** 2026-07-11
**Design of record:** `.planning/design/nav-primitives.md` (survey-confirmed standard + Ashley tailnet-sketch sign-off). Additive, wire token stays `viewmodel-shell/1.0`. Aligned npm + NuGet `5.1.0`.

- [ ] **NAV-01**: A **BreadcrumbNode** (`items:[{label, href?, external?, action?}]`) renders a nav trail across both backends — framework draws a `<nav aria-label>` landmark + `<ol>`, the LAST item is the current page (auto non-clickable, `aria-current="page"`), and a FIXED separator (off the wire). Crumbs support both `href` navigation (external ⇒ new tab) and `action` dispatch, per LinkNode's precedent.
- [ ] **NAV-02**: A **StepsNode** (`steps:[{label, description?}]` + a 0-based `current` index, `orientation?:"horizontal"|"vertical"`) renders per-step done/current/upcoming DERIVED from `current` (no per-step status field) in both orientations — default responsive-horizontal that auto-collapses to vertical INTRINSICALLY (zero viewport breakpoints) and a deliberate `vertical` wizard — with correct a11y (`aria-current="step"`, accessible group name, marker state via `aria-label` not color alone, non-interactive stepper not focusable, NOT `role=progressbar`).
- [ ] **NAV-03**: Both nodes land BYTE-IDENTICALLY in TS (`src/index.ts` + `browser.ts`) and .NET (`ViewModels.cs` record + `[JsonDerivedType]`; optional-field attributes exact; `current` a required plain `int`); BOTH tree-validators descend into them (breadcrumb action-name uniqueness where crumbs carry `action`); a new FeatureProbe parity fixture per node keeps `bun run parity/run.ts` green; the TUI adapter degrades legibly for both.
- [ ] **NAV-04**: Gated **5.1.0** release — `agent-skill.md` verified no-change (byte-identical .NET twin), a Showcase demo (both orientations), a combined tailnet verification page (both nodes, both step orientations, light + dark) for Ashley's pre-publish sign-off (visual change = in-question gate); then CHANGELOG + MIGRATION, aligned npm + NuGet `5.1.0` (npm 5.0.1→5.1.0, .NET 5.0.0→5.1.0), tag `v5.1.0`, `main` advanced (`git merge-base --is-ancestor v5.1.0 main`), CI green, `#vms-changelog` announced.
- [ ] **LOOK-01**: A **lookup** field (`inputType:"lookup"`, `bind` holds the id) resolves its display label from the NODE, never from the candidate list — `selected?: [{value,label?,type?}]` is server→client only, recomputed every render, never trusted from the client; `label` ABSENT when it equals `value`; `type` ABSENT for monomorphic refs. A form that loads with a value already set renders its label with NO search having occurred (the preselected-value case that kills naive designs). Design of record: [design/lookup-field.md](../design/lookup-field.md) D1/D5/D6.
- [ ] **LOOK-02**: A **live-query lane** — `searchAction` dispatches DEBOUNCED (~250-300ms) on keystroke via the existing v4.2 non-blocking lane, with `searchBind` round-tripping the query. Stale/out-of-order responses never clobber a newer one. VMS has ZERO live-query dispatch today (every text field fires on Enter, `browser.ts:1291-1303`), so this is a new dispatch cadence. Adversarial interleavings (user-races-background, background-resolves-first, rapid-fire-supersede, stale-arrives-late) each carry a FAIL-before/PASS-after test — a green suite that doesn't script the interleaving proves nothing about the race. Design: D4.
- [ ] **LOOK-03**: A **lookup-multiple** field (`bind` holds `string[]`) renders selections as removable chips with the mandatory a11y baseline — item-specific `aria-label="Remove {item}"`, roving tabindex across chips, add/remove announced WITH the running count, and focus after removal going next→previous→input and NEVER `<body>`. Chips are `role=list`/`listitem` with real `<button>`s, never `listbox`/`option` (an interactive descendant inside `option` destroys the a11y tree). `select-multiple` REMAINS the control for enumerable sets — that split is an a11y requirement, not taste. Design: D2 + §7.
- [ ] **LOOK-04**: **Custom entries are an EXPLICIT, DECLARED axis** (`allowCustom`) — never inferred from behavior. An invented value stays a HOMOGENEOUS object (never a bare string, so no `Value|string` union), and `allowCustom:true` + no candidates yields a free-form tags input with NO special case in the renderer. Supersedes the separately-designed `inputType:"tags"` proposal. Design: D3.
- [ ] **LOOK-05**: The **live region survives re-render with its node identity intact** — a jsdom test asserts the SAME node persists across renders. `BrowserAdapter` full-rebuilds every response, and a rebuilt live region never announces while the page looks perfect and every structural test passes. This is a genuinely NEW 4th preservation category (focus/scroll/details restore STATE onto fresh nodes; a live region needs the SAME node). Design: D9 + §7 item 8.
- [ ] **LOOK-06**: Both inputTypes land BYTE-IDENTICALLY in TS (`src/index.ts` + `browser.ts`) and .NET (`ViewModels.cs`; `allowCustom` carries `WhenWritingDefault` so `false` is ABSENT; every nullable carries `WhenWritingNull`); both tree-validators descend; new FeatureProbe parity fixtures per inputType keep `bun run parity/run.ts` green; the TUI degrades legibly. TSDoc states the direction invariant, that any result cap must be VISIBLE in the tree (principle 8), and that **the picker's filter is UX, NEVER authorization** (D7/D8).
- [ ] **LOOK-07**: `agent-skill.md` documents the picker as a **first-class public protocol** — no surveyed platform publishes its picker's transport (ServiceNow's `/xmlhttp.do` undocumented; Strapi's `/relations` has no doc page), so an agent driving a lookup exactly like a human is a category difference that falls out of the architecture. Byte-identical .NET twin; `parity/check-skill.ts` green. Gated release (npm + NuGet aligned) after a tailnet verification page whose fetch-shim runs `buildVm` through the REAL tree validator (banked lesson); CHANGELOG + MIGRATION; tag; `main` advanced; CI green; `#vms-changelog` announced.

| Requirement | Phase |
|---|---|
| NAV-01 | 20 |
| NAV-02 | 20 |
| NAV-03 | 20 |
| NAV-04 | 20 |
| LOOK-01 | 21 |
| LOOK-02 | 21 |
| LOOK-03 | 21 |
| LOOK-04 | 21 |
| LOOK-05 | 21 |
| LOOK-06 | 21 |
| LOOK-07 | 21 |

---

*Milestone: v5.1 Navigation Primitives*
*Requirements defined: 2026-07-11*

---

## Milestone v7.0 — Icons Primitive (Phase 22)

**Defined:** 2026-07-26
**Design of record:** `.planning/design/icons-primitive.md` (surveyed set choice + Ashley green-light on the shape). Icons additive; `TrackerCell.label`→`tooltip` rename is the ONE break that forces the major bump. Aligned npm + NuGet `7.0.0`.

- [ ] **ICON-01**: An **`IconNode`** wire type (`type:"icon"`, closed-union `name`, optional `size:"xs"|"sm"|"md"|"lg"|"xl"`, optional `tone` from the framework tone axis, optional `label` for a11y) lands byte-identically in TS (`src/index.ts` + `browser.ts`) and .NET (`ViewModels.cs` record + `[JsonDerivedType]`; `name` an enum with a converter that emits the wire kebab-case string; every optional nullable carries `[JsonIgnore(WhenWritingNull)]`); BOTH tree-validators descend into it; an unknown `name` fails `invalid_tree` on both backends.
- [ ] **ICON-02**: The framework ships the curated **Lucide subset** (~102 icons per design-doc §6, including all 8 of Pixie's Hestia concept anchors — `sparkles`, `wrench`, `shield-check`, `route`, `book-open`, `activity`, `workflow`, `receipt`) inline-bundled in the browser adapter as `ICONS: Record<IconName, string>` (SVG payload strings); the wire NEVER carries an SVG — only the name; framework grows by addition (consumers bounty new names, additive minor).
- [ ] **ICON-03**: The browser renderer emits `<svg class="vms-icon vms-icon--{size} vms-icon--{tone}" role="img"|aria-hidden ...>` with `stroke="currentColor"` (so `tone` OR the parent's text color drives visual color); size mapping per design-doc §3 (xs=12, sm=16, md=20 default, lg=24, xl=32); jsdom tests verify DOM shape + a11y attributes (decorative when `label` absent → `aria-hidden="true"`; meaning-carrying when `label` set → `role="img"` + `aria-label`).
- [ ] **ICON-04**: Cross-node **`icon?: IconName` prop** lands on `ButtonNode`, `LinkNode`, `SectionNode`, `Badge`, `ListItem` (both backends, byte-identical); framework renders at host-appropriate size per design-doc §4 (`Button`/`Link`/`Badge`/`ListItem` = leading `xs`/`sm`; `Section` = prominent card `xl`); tone inherits from the host's own tone axis — NEVER a separate wire slot on the icon prop (avoids two-ways-to-say-the-same-thing).
- [ ] **ICON-05**: The **icon-only ButtonNode validator rule** is enforced on both backends — `button.icon != null && (!button.label || button.label === "") && button.tooltip == null` → `invalid_tree` at tree-validation time; the `tooltip` field (shipped 6.12.0) double-duties as `aria-label` on icon-only buttons; test coverage on both backends verifies the rule fires FAIL-before/PASS-after by mutation, not by assertion.
- [ ] **ICON-06**: **`TrackerCell` renames `label` → `tooltip`** (both backends; wire-breaking); renderer swaps from `el.title = cell.label` (`browser.ts:4161`) to the TOOL-01 body-appended `.vms-tooltip-host` singleton + JS positioning (the exact 6.12.1 infrastructure that already ships for `Button.tooltip`/`TableColumn.tooltip`); Molly is DM'd on the relay BEFORE publish with the exact rename (`label:` → `tooltip:` in Metis buildVm) + MIGRATION.md excerpt; MIGRATION documents this as the ONE break.
- [ ] **ICON-07**: TUI drops icons entirely for v1 (@experimental scope, not-invested-in per standing directive) — `IconNode` renders as nothing; cross-node `icon?:` props are ignored; no unicode-fallback mapping (deferred until TUI investment ever resumes).
- [ ] **ICON-08**: **AA-contrast hand-check** for the icon-on-tone / icon-on-fill pairs the primitive introduces (icon rendered on `tone:"danger"` card, `tone:"warning"` card, etc., across default + all 12 themes) — the fixed 13-pair `check:aa-contrast` gate does NOT auto-cover NEW fg/bg pairs (banked lesson); deepen only the failing tones via `color-mix` per the shipped v3.5.0 pattern; graphical-state-indicator icons (WCAG 1.4.11) meeting 3:1 are acceptable ONLY when state is also carried by non-color channels (aria-label + shape) per the TrackerNode precedent.
- [ ] **ICON-09**: Parity green — `bun run parity/run.ts` extends FeatureProbe `buildVm` in ALL backends (the shipped v5.1 pattern: EXTEND, not new fixture file; `$comment` clause appended) to emit standalone `IconNode` + each of the 5 host-node icon props + the icon-only-button validator case + the renamed TrackerCell tooltip; adds `expectBodyContains` coverage tripwires per branch (banked lesson: a diff can only prove things about code it actually RUNS — a fixture step covering a specific branch declares a substring only that branch emits).
- [ ] **ICON-10**: Demo usage across the Showcase (icon gallery — every icon at every size × the tone matrix) + a Hestia-style card grid demo (all 8 Pixie concept anchors as `Section.icon` cards); interactive **tailnet verification page** driving the REAL bundle (real shipped CSS + real `BrowserAdapter` + `buildVm` output run through the REAL tree validator in the fetch-shim per banked lesson) with the Hestia grid + icon-in-Button/Badge/ListItem/Link examples + all 5 sizes + tone matrix + live TrackerCell strip showing the styled-tooltip render (light + dark, HTTPS if the page ever needs secure-context features per banked lesson); Ashley pre-publish sign-off (visual change = in-question publish gate).
- [ ] **ICON-11**: Aligned **npm + NuGet `7.0.0`** major published (batched — major is forced by ICON-06's rename; icons alone would be additive), CHANGELOG + MIGRATION (the ONE break = TrackerCell field rename), operator-gated publish per AGENTS.md `.env` token-sync ritual, tag `v7.0.0` at the release commit, `main` advanced (`git merge-base --is-ancestor v7.0.0 main`), CI green, `#vms-changelog` release line posted.

| Requirement | Phase |
|---|---|
| ICON-01 | 22 |
| ICON-02 | 22 |
| ICON-03 | 22 |
| ICON-04 | 22 |
| ICON-05 | 22 |
| ICON-06 | 22 |
| ICON-07 | 22 |
| ICON-08 | 22 |
| ICON-09 | 22 |
| ICON-10 | 22 |
| ICON-11 | 22 |

---

*Milestone: v7.0 Icons Primitive*

## Milestone v8.0.0 — Composite-Nodes Layer (Phases 23–26)

**Defined:** 2026-07-29
**Design of record:** `bounties/composite-nodes-layer/tasting-page/index.html` (approved before/after tasting) + `.planning/design/composite-nodes-layer.md` (to be written in Phase 23)

Ship the **Route B composite layer** atop VMS's primitive axes. VMS today ships axes + a few recipes for shapes with unambiguous intent (StatBar, Steps, Table, Tracker); for common web shapes with variance (list rows, chat messages, alerts, empty states, user rows, key-value details, timeline entries, settings toggles, dismissable chip clusters) consumers compose from primitives and the result reliably falls short of what the same shape looks like on the modern web. Every mature UI framework has this layer atop primitives; VMS has it partial-and-uneven. Every request that arrived under "the framework has all the nodes but the shape looks bad" (Moxie's banner, Molly's incident list, Angel's chat messages) is one instance of this pattern — this milestone closes it as a coherent layer.

**Governance rule** (Ashley, 2026-07-29, canonicalized): A shape earns a composite node when the best-effort with today's primitives is a "pretty bad approximation" of the common shape. Bar is **visual** — the after has to look right; the before has to look wrong enough to justify the primitive earning a promotion. Judgment per shape, eyeballed against a served tasting page before it earns the composite.

**All 10 composites + 3 wire tweaks approved via the before/after tasting on 2026-07-29** (served at 100.113.23.63:8182). Everything technically additive — no wire breaks; old renderers gracefully degrade on unknown enum values. Version bumped to **v8.0.0** for comms (largest capability expansion since 3.0.0's axes unification, warrants "consumers should read the release notes"); technically a minor bump under semver.

### Phase 23 — Foundations (COMP-01..04)

The 4 foundation additions every downstream composite depends on. Land these first so Phase 24-26 composites can consume them.

- [ ] **COMP-01**: `TextNode.style` gains `"caption"` as a closed-union value on both backends. Renders `.vms-text--caption` with `font-size: var(--vms-text-xs)` (0.75rem), muted color, ~0.85 opacity — the 3rd typographic tier `ListRowNode`/`MessageNode`/`TimelineEntryNode` all consume for micro-meta lines. Byte-identical across TS/.NET (.NET enum extension with converter per closed-union-must-be-enum maintainer rule). Existing consumers unaffected (never emit `"caption"`; graceful degradation on new value if a backend sends it to an older renderer). AA-contrast hand-check for opacity-adjusted muted vs default + all 12 themes.
- [ ] **COMP-02**: `TextNode` gains a weight axis for the semi-bold body-size variant. Shape TBD in planning — either `weight?: "regular" | "medium" | "bold"` (closed enum axis) OR `style: "strong"` (additional closed-union value). Whichever shape wins, byte-identical across backends, closed-enum on .NET, semantic intent not raw CSS. Required for row primaries (`ListRowNode.primary`, `MessageNode.author`, `UserRowNode.name`, `SettingRowNode.label`) that need medium weight; today `.vms-text` inherits body default (400) with no way to elevate.
- [ ] **COMP-03**: `CheckboxNode.variant: "switch"` renders as a switch slider (visual only — wire and semantics unchanged; the value is still boolean, dispatch shape is still standard checkbox `bind`/change). Emits `.vms-field--switch` modifier; falls back to the standard checkbox render on older adapters (graceful degradation on unknown variant). Pairs with `SettingRowNode` in Phase 25. Byte-identical across backends; a11y contract intact (still a real `<input type="checkbox">` under the hood, only the visual is different).
- [ ] **COMP-04**: `AvatarNode` ships as a standalone primitive — circular slot with `initials?: string`, `image?: string` (URL), `icon?: IconName` (fallback using the Phase 22 icon system), `size?: "sm" | "md" | "lg" | "xl"` (1.5/2/2.5/3rem — closed enum), `tone?: Tone` (background palette for initials/icon mode), `alt?: string` (a11y — screen-reader announcement). Both tree-validators descend; content-resolution priority: image > initials > icon > (empty circle if none). Byte-identical across TS/.NET. Consumed by `UserRowNode` + `MessageNode` in Phase 24-25; also usable standalone in mention pickers, assignee columns, comment threads. AA-contrast hand-check for tone-tinted background against every `initials` text-color rendering across default + all 12 themes.

### Phase 24 — Primary composites (COMP-05..08, to be defined in `/gsd:plan-phase 24`)

Strongest evidence + live consumer pressure. Requirements defined after Phase 23 lands and consumers see the foundations.

### Phase 25 — Secondary composites (COMP-09..15, to be defined in `/gsd:plan-phase 25`)

Broader coverage — user rows, detail lists, timeline entries, setting rows, chip clusters. Requirements defined after Phase 24 lands.

### Phase 24 — Primary composites (COMP-05..08)

The 4 composite recipes with the strongest evidence + live consumer pressure. Each consumes Phase 23 foundations.

- [x] **COMP-05**: **`ListRowNode`** — Route B recipe for the "dense row-per-item list" pattern. Slots: `leading?: ViewNode` (icon, badge, avatar, checkbox); `primary: string | ViewNode` (trained: TextNode body + weight:"medium"); `secondary?: string | ViewNode` (trained: TextNode muted); `meta?: (string | ViewNode)[]` (trained: TextNode style:"caption" — consumes COMP-01); `trailing?: ViewNode` (right-aligned — timestamp, count, actions); `tone?: "danger"|"warning"|"success"|"info"` (left-accent border); `state?: string` (freeform — active/done/disabled/high framework-styled, mirrors ListItem.state axis); `action?: ActionEvent` (whole-row click, same shape as TableRow.action). Renders as `<li>` inside a `ListNode(variant:"rows")` container that provides the single bordered surface with per-row dividers. Byte-identical TS/.NET; both tree-validators descend; string-form primary/secondary/meta lifted into TextNode by the renderer; action-name uniqueness enforced across the tree.
- [x] **COMP-05a**: **`ListNode` gains `variant?: "items" | "rows"`** — closed-union extension. Omitted/`"items"` = today's ListItem behavior (byte-identical). `"rows"` = ListRowNode-only container rendering as a single bordered surface with per-row dividers (denser than card-per-row). Old renderers gracefully degrade on unknown variant (renders as unstyled `<ul>` with `<li>` children).
- [x] **COMP-06**: **`MessageNode`** — Route B recipe for chat/comment messages with actor. Slots: `avatar?: ViewNode` (typically AvatarNode from COMP-04 — but slot accepts any ViewNode); `author: string` (trained: TextNode text-sm weight:600 — consumes COMP-02); `timestamp?: string` (trained: caption tier — consumes COMP-01); `content: string | ViewNode` (wrapped in padded surface); `role?: "user" | "assistant" | "system"` (closed union — controls surface tone: assistant = tinted-info surface; user/system/omitted = neutral surface); `actions?: ButtonNode[]` (right-aligned trailing action bar, always-visible per doctrine — no hover-reveal). Byte-identical TS/.NET; both tree-validators descend; content-as-string lifted to TextNode.
- [x] **COMP-06a**: **`MessageListNode`** — container for a stream of MessageNodes. Slots: `children: MessageNode[]` (typed to accept only messages — validator rejects other types); `followTail?: boolean` (WhenWritingDefault; when true the container inherits SectionNode.followTail semantics — at-bottom-detection pre-render, pin-to-new-bottom post-render — the shipped chartInstances/persistent-node idiom already handles this). Pairs naturally with `PageNode.fill:true` for full-height chat surfaces. Byte-identical TS/.NET.
- [x] **COMP-07**: **`AlertNode`** — Route B recipe for prominent status messages (banner asks from Moxie 2026-07-17 discoverability-miss + generally). Slots: `tone: "danger" | "warning" | "success" | "info"` (REQUIRED — this is the whole point of the node); `title?: string` (trained: TextNode text-md weight:600); `message: string | ViewNode` (trained: TextNode text-sm muted); `icon?: IconName` (overrides the tone→icon default mapping — see below); `actions?: ButtonNode[]` (right-aligned, size:"sm"); `dismissible?: boolean` (WhenWritingDefault; when true renders a close-X that dispatches a `dismiss` action name — framework handles the wire; app catches the action name via its normal dispatch loop). **Tone→icon default mapping** (baked in the browser renderer): danger→`x-circle`, warning→`alert-triangle`, success→`check-circle`, info→`info`. Byte-identical TS/.NET.
- [x] **COMP-08**: **`EmptyStateNode`** — Route B recipe for "nothing here" states (every collection view when there's nothing to show; the open bounty `empty-state-on-collections` proposed devolving onto collections as properties — this composite supersedes that direction, per the tasting-approval discussion). Slots: `icon?: IconName` (trained: large in tinted-circle background, 3rem circle, 1.5rem icon inside); `title: string` (trained: TextNode text-lg weight:600 — consumes COMP-02); `description?: string` (trained: TextNode text-sm muted with max-width for readable line length); `action?: ButtonNode` (centered below, single action only). Renders as a centered stack with generous vertical padding. Composable via drop-in: pass an EmptyStateNode to `TableNode`'s or `ListNode`'s empty-cell rendering slot (which the tasting-approved direction resolves — standalone composite wins vs. devolve-to-collection-property). Byte-identical TS/.NET.

### Phase 25 — Secondary composites (COMP-09..13a)

The 5 remaining composite recipes from the approved tasting. Each consumes Phase 23 foundations + AvatarNode where applicable, and one (SettingRowNode) naturally pairs with COMP-03's `CheckboxNode.variant:"switch"`.

- [ ] **COMP-09**: **`UserRowNode`** — Route B recipe for person entity display. Slots: `avatar?: ViewNode` (typically AvatarNode from COMP-04 — but slot accepts any ViewNode); `name: string | ViewNode` (trained: TextNode body + weight:"medium"); `meta?: string | ViewNode` (trained: TextNode muted — typically "email · role" or similar composite string); `status?: { label: string; kind: "online" | "away" | "offline" | "busy" }` (renders as small dot + label right-aligned; `kind` closed enum for palette); `trailing?: ViewNode` (optional trailing slot for actions or extra badge); `action?: ActionEvent` (whole-row click — member-picker pattern). Byte-identical TS/.NET; both tree-validators descend; string-form name/meta lifted into TextNode by the renderer. Wired inside a bordered surface with per-row dividers (same pattern as ListNode.variant:"rows" from COMP-05a).

- [ ] **COMP-10**: **`DetailRowNode`** — Route B recipe for key-value pair with proper `<dt>`/`<dd>` semantics. Slots: `label: string` (trained: TextNode text-xs uppercase weight:500 muted — the "micro-label" convention common on the web for this pattern); `value: string | ViewNode` (trained: TextNode body); `tone?: "danger" | "warning" | "success" | "info"` (optional accent — e.g. red for "Deleted" status); `icon?: IconName` (optional leading icon on the label). Byte-identical TS/.NET.

- [ ] **COMP-10a**: **`DetailListNode`** — container for a set of DetailRowNodes. Slots: `children: DetailRowNode[]` (tree-validator rejects non-DetailRow entries); `labelWidth?: "sm" | "md" | "lg"` (closed enum for consistent-label-column-width across all rows — the whole point of this being a list vs. individually-rendered rows). Renders as `<dl>` with `<div class="vms-detail-row">` wrappers containing `<dt>`/`<dd>`. Trained styling: single bordered surface with per-row dividers. Byte-identical TS/.NET.

- [ ] **COMP-11**: **`TimelineEntryNode`** — Route B recipe for a single activity/history/audit-log entry. Slots: `time: string` (trained: caption tier per COMP-01); `description: string | ViewNode` (trained: TextNode body accepting rich content — bold actor names via TextNode.weight from COMP-02); `tone?: "danger" | "warning" | "success" | "info"` (dot border color, default = accent); `icon?: IconName` (overrides dot with an icon — bigger dot slot). Byte-identical TS/.NET.

- [ ] **COMP-11a**: **`TimelineNode`** — container for a set of TimelineEntryNodes. Slots: `children: TimelineEntryNode[]` (tree-validator rejects non-TimelineEntry entries). Framework owns the vertical rail (decorative `::before` line on `.vms-timeline`) + per-entry dot markers (decorative `::before` circles on `.vms-timeline-entry`) with tone-encoded borders. **This is critical**: the rail + dots are impossible to compose from primitives today ("apps describe, never decorate" precludes app-CSS for a rail); the composite bakes it in. Byte-identical TS/.NET.

- [ ] **COMP-12**: **`SettingRowNode`** — Route B recipe for settings-pattern rows (feature-flag toggles, notification-preferences, "manage account" panels). Slots: `icon?: IconName` (optional leading icon); `label: string` (trained: TextNode body + weight:"medium"); `description?: string | ViewNode` (trained: TextNode muted with `max-width` for readable line length); `trailing?: ViewNode` (typically a `CheckboxNode(variant:"switch")` from COMP-03 — natural pairing; also accepts ButtonNode, LinkNode, or any ViewNode); `action?: ActionEvent` (whole-row click, opt-in). Byte-identical TS/.NET.

- [ ] **COMP-12a**: **`SettingListNode`** — container for a set of SettingRowNodes. Slots: `children: SettingRowNode[]`; `heading?: string` (optional heading for the settings group). Renders as single bordered surface with per-row dividers (same pattern as ListNode.variant:"rows" from COMP-05a). Byte-identical TS/.NET.

- [ ] **COMP-13**: **`ChipNode`** — Route B recipe for dismissible/interactive pills. **Distinct from BadgeNode**: Badge is an *annotation* on another element (a "New" tag next to a title, a "3" count on an icon); Chip is a *standalone interactive element* that participates in a group (filter set, tag input, selected items). Slots: `label: string`; `tone?: "danger" | "warning" | "success" | "info"` (color palette, neutral if omitted); `icon?: IconName` (leading icon — e.g. tag/user); `dismissAction?: ActionEvent` (**showing the X requires this** — no dismiss action, no X; respects "no dead UI"); `action?: ActionEvent` (whole-chip click, filter-chip toggle pattern). Byte-identical TS/.NET.

- [ ] **COMP-13a**: **`ChipListNode`** — container for a set of ChipNodes. Slots: `children: ChipNode[]` (tree-validator rejects non-Chip entries). Renders as flex-wrap horizontal cluster with tuned inline gap. Byte-identical TS/.NET.

| Requirement | Phase |
|---|---|
| COMP-01 | 23 |
| COMP-02 | 23 |
| COMP-03 | 23 |
| COMP-04 | 23 |
| COMP-05 | 24 |
| COMP-05a | 24 |
| COMP-06 | 24 |
| COMP-06a | 24 |
| COMP-07 | 24 |
| COMP-08 | 24 |
| COMP-09 | 25 |
| COMP-10 | 25 |
| COMP-10a | 25 |
| COMP-11 | 25 |
| COMP-11a | 25 |
| COMP-12 | 25 |
| COMP-12a | 25 |
| COMP-13 | 25 |
| COMP-13a | 25 |

---

*Milestone: v8.0.0 Composite-Nodes Layer*
*Requirements defined: 2026-07-26*
