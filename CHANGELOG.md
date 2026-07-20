# Changelog

All notable changes to ViewModel Shell. Format follows [Keep a Changelog](https://keepachangelog.com/).

This repo ships two version-aligned packages: **npm** `@ashley-shrok/viewmodel-shell` and **NuGet** `AshleyShrok.ViewModelShell`. They share major.minor; npm may take patch-only bumps for client-only changes (NuGet unchanged in those cases). Each entry notes which package(s) moved and **what, if anything, consumers must do**.

---

## npm 6.5.0 / NuGet 6.6.0 — `DiffNode`: aligned before/after primitive

**npm:** `6.5.0` (minor, from `6.4.0`) · **NuGet:** `6.6.0` (minor, from `6.5.0`). New wire node type — additive on both sides (old apps/agents unaffected; wire protocol token stays `viewmodel-shell/1.0`).

### Added

- **`DiffNode` — an aligned before/after primitive.** Row-by-row aligned side-by-side (default) or single-column unified rendering for review, audit, and change-comparison apps. Consumers compute the diff **server-side** (LibGit2Sharp on .NET, `diff` on TS, `git diff --json`, whatever they have) and hand VMS the structured rows — same server-computes / framework-renders doctrine as the markdown → tree pattern. The framework owns all appearance: CSS-Grid alignment (4 tracks in side-by-side, 3 in unified), tint + left-stripe row coloring, long-line horizontal-scroll-per-cell that preserves row alignment, empty-cell styling, tinted line numbers, and unified-mode collapse of the two linenum columns into a single left margin for context rows (with a continuous color band across for add/remove).
  - **Shape**: `{ type: "diff", id?, rows: DiffRow[], mode?: "unified" | "side-by-side", header?: { old: string, new: string } }`. Each `DiffRow` is `{ old?: DiffCell, new?: DiffCell }` where `DiffCell` is `{ text: string, lineNumber?: number }`. Row-**kind** (add / remove / context / modified pair) is derived client-side from the shape of the row itself — no separate `kind` wire field. Omit the `old` key for a pure addition, omit the `new` key for a pure removal, both present with identical `text` = context, both present with differing `text` = modified pair (side-by-side shows both cells tinted in the same visual row; unified splits into remove-then-add). "Shape carries the meaning" makes it impossible for a `kind` label to disagree with the content.
  - **Line numbers are optional.** Diff sources that don't track them (e.g. two prose versions) render with a content-only column; the framework does not synthesize a gutter for missing line numbers.
  - **Colorblind safety.** Color is one of THREE channels: color (green add, red remove — industry standard) + column position (left = old, right = new in side-by-side; row order = removed-then-added in unified) + line-number presence (removed rows have no new-side line#; added rows have no old-side line#). Safe to use the shared `--vms-success` / `--vms-error` tokens. Text on the tint layered over the surface is AA-safe across the default + all 12 themes.
  - Appearance is 100% framework-owned: the grid tracks, the 22%-alpha tint background, the 3px inset left stripe on the leftmost cell of each colored row-side, the muted empty-cell fill, the unified-mode linenum-column collapse, and the header row shape. Design of record: [`.planning/design/diff-node.md`](.planning/design/diff-node.md).

### Explicitly out of scope for this primitive

- **Syntax highlighting on cell content.** That's the `CodeBlockNode` question (currently on hold — a polish primitive whose only genuine gap is highlighting, and uncolored monospace code IS a functional fallback via `TextNode style:"pre" + card + copy` composition). If we ever ship highlighting, `DiffNode` can compose richer cell content additively without a wire break.
- **Word-level intra-line diff highlighting.** Would need inline rich text — an open architectural question.
- **In-line review comments / collapse/expand of hunks.** Consumers who want collapsed hunks compute a smaller `rows` array server-side.

### Notes for adopters

- **Both packages, purely additive — no action required.** Reach for `DiffNode` for any before/after content comparison (code review, config audit, doc revision, change history). Requested by Amelia (Athena — the Pantheon IT-documentation viewer) for her review path; shipped as a general primitive.
- **A parity gap surfaced during this build**: the `.NET` `Collect()` walker doesn't descend into `TrackerCell.Action` (the TS twin does — a real cross-backend inconsistency in the tree-validation contract). No consumer impact today (no fleet consumer has hit it), but it's tracked and will be closed in a follow-up.

---

## npm 6.4.0 / NuGet 6.5.0 — Visible-scoped table selection: header select-all + `TableNode.selection`

**npm:** `6.4.0` (minor, from `6.3.0`) · **NuGet:** `6.5.0` (minor, from `6.4.0`). Additive on both sides — old apps/agents unaffected; wire protocol token stays `viewmodel-shell/1.0`.

### Added

- **Header "select all" checkbox on tables (renderer, npm).** Whenever a `TableNode`'s rows carry per-row `CheckboxNode`s, the adapter auto-renders a tri-state (all / none / indeterminate) select-all checkbox in the leading header cell. It is a **pure client-side DOM toggle** over the *rendered* rows' checkbox binds — no new wire field, no dispatch, agent-irrelevant (agents set binds directly). Selects all rendered rows only (under filter-narrow that equals all matches; under pagination it's the current page).

- **`TableNode.selection` — a visible-scoped bulk-action toolbar (both backends).** `TableNode.selection = { buttons: ButtonNode[]; harvestBind: string }`. The adapter renders `buttons[]` as a toolbar above the table; on a bulk-button click it **harvests the currently-checked, currently-rendered row ids**, writes that `string[]` to `harvestBind` (overwriting), then dispatches name-only. The server reads `state.{harvestBind}` and acts on **exactly the rows on screen** — a bulk action can never touch a row the operator can't see, even if the app's own `selectedIds` map still holds it. This closes the "selection carried across a filter/page change silently acts on invisible rows" footgun (surfaced by PBMInvoices) **by construction**, for the common case.
  - Revives the old `selection.buttons[]` harvest (removed with the `context` wire in Phase 6), adapted to write a **bind** instead of `context`. It carries **none** of the per-*toggle* dispatch that got the 0.15.0 `selection.action` mode removed — selection stays a pure client concern until a bulk click.
  - Per-row checkboxes remain app-composed (`CheckboxNode` bound to `selectedIds.{id}` in `row.actions`); the block only adds the toolbar + header box. Selectable rows must carry `TableRow.id`.
  - **Whether the visual check-state persists across a view change is app policy** (the framework treats your selection map as opaque `TState`). The safe default is **reset-on-nav** — clear your selection map in the filter/paginate handler — demonstrated in `demo/HelpDesk` (both twins). An app wanting cross-page accumulation simply doesn't clear.

- **`.vms-checkbox__input:indeterminate` styling** — the header select-all's indeterminate state renders a dash (CSS, npm).

### Changed

- `demo/HelpDesk` (both twins) adopt the safe pattern: bulk buttons moved into `TableNode.selection`; the `bulk-*` handlers read the visible-scoped `state.bulkSelection` harvest (not every truthy key of the `selectedIds` map); filter changes reset selection (reset-on-nav).

### Consumers

Nothing required — both additions are optional. To adopt: put your bulk buttons in `TableNode.selection` with a `harvestBind`, read that array in your handler, and clear your selection map on filter/page changes. See `MIGRATION.md`.

## npm 6.3.0 / NuGet 6.4.0 — `TrackerNode`: status tracker / heat strip

**npm:** `6.3.0` (minor, from `6.2.1`) · **NuGet:** `6.4.0` (minor, from `6.3.0`). New wire node type — additive on both sides (old apps/agents unaffected; wire protocol token stays `viewmodel-shell/1.0`).

### Added

- **`TrackerNode` — a status tracker / heat strip.** A tight horizontal row of discrete colored cells, one per time bucket, where color encodes each bucket's semantic status: the "uptime strip" / "sentinel history" primitive (industry precedent: Tremor Tracker, Grafana Status History, Atlassian Statuspage). This is **not** a numeric value-sparkline (a tiny line chart — a separate, chart-family concern deliberately not built here). Shape: `{ type: "tracker", id?, cells: TrackerCell[] }`; each `TrackerCell` is `{ state?, label?, action? }`. Bucket count is simply `cells.length` (60 slots, 24 hourly, 7 daily…).
  - **`TrackerCell.state`** — a closed set specific to a status strip: `success` / `danger` / `warning` / `muted` (no-data / no-run — the universal honest-uncertainty convention; the default when omitted). Note `info` is intentionally excluded (it would collide with `success` in the palette). **The framework bakes a colorblind-safe palette** — `success` renders **blue** (not the global green success tone), `danger` red, `warning` amber, `muted` gray — verified separable (ΔE ≥ 28 worst-pair) under deuteranopia / protanopia / tritanopia, so it needs **no "colorblind mode."** Only the rendered color diverges from the global tones; the state *name* stays semantic on the wire (agent-legible). The palette is overridable via the `--vms-tracker-{pass,fail,warn,nodata}` token seam.
  - **`TrackerCell.label`** — optional hover text (e.g. `"2026-07-15 14:02 UTC · Success"`), rendered as the cell's native tooltip **and** its `aria-label`, so the strip's meaning is carried by text, not color alone (a11y + agent-legibility).
  - **`TrackerCell.action`** — optional per-bucket click-through; makes the cell a `role="button"` tabstop with Enter/Space activation (Space suppresses page scroll), mirroring `TableRow.action`. Per-bucket identity is encoded in the action name; the server-side action-name uniqueness walk descends into tracker cells.
  - Appearance is 100% framework-owned: the hairline (1px) gap, square cells, the intrinsic shrink-to-a-min-then-scroll overflow (zero viewport breakpoints), the baked palette, and a keyboard focus ring. No hover border (a gentle brighten only).

### Notes for adopters

- **Both packages, purely additive — no action required.** Reach for `TrackerNode` for uptime/sentinel/run-history strips instead of composing many `TextNode`s in a `layout:"row"` section (which wraps and gaps by design — it's a navbar cluster, not a data strip). Asked for by a consumer (Metis, an incident-management console) but shipped as a general primitive.

---

## npm 6.2.1 — `layout:"sidebar"` no longer wraps a wide-table main below the rail (CSS fix, npm only)

**npm:** `6.2.1` (patch, from `6.2.0`) · **NuGet:** unchanged (`6.3.0`). CSS-only bug fix; no wire/type change, so NuGet is untouched.

### Fixed

- **A `layout:"sidebar"` child whose min-content is wider than its flex track (e.g. a plain section wrapping a wide / `nowrap` `TableNode`) forced the flex line to wrap** — the rail sat alone on the first line and the main region dropped below it with dead space, instead of the intended rail │ main side-by-side. Flex items default to `min-width: auto`, so the wide child could not shrink to its track. Fixed by adding `min-width: 0` to `.vms-page--sidebar > *` / `.vms-section--sidebar > *`, so the child shrinks to its track and its inner overflow container (`.vms-table-wrapper { overflow-x: auto }`, long unbroken strings) scrolls instead of blowing out the layout. This mirrors the `split` / `cards` `min-width: 0` rule from #17 — which had **explicitly excluded** `sidebar`, leaving this latent. A jsdom regression test asserts the computed `min-width` on sidebar children (mutation-proved: red without the fix).

### Notes for adopters

- **npm only, purely a fix — no action required.** A three-region operator shell (`sidebar` outer + a nested `sidebar`/`split` main) and any `sidebar` whose main holds a wide table now fill correctly with no app change. Surfaced by a consumer (Metis) building an incident console; normal sidebar usage (rail + normal-width content) is byte-unchanged.

---

## npm 6.2.0 / NuGet 6.3.0 — Rich copy (formatted + plain clipboard)

**npm:** `6.2.0` (minor, from `6.1.0`) · **NuGet:** `6.3.0` (minor, from `6.2.0`). Purely additive on both sides.

### Added

- **`CopyButtonNode.copyTargetId?: string` — the harvest route (adapter-side, no server authoring).** Names an already-rendered region by its DOM id; on click the adapter lifts that element's rendered markup as the `text/html` representation and its plain text as `text/plain`, writing **both** to the clipboard at once (`navigator.clipboard.write` + `ClipboardItem`). A paste into a formatted destination (email, doc) keeps its **semantic structure** — headings, lists, tables, bold — while a plain destination still receives clean text. Because the framework carries its look in class-keyed styling rather than inline, the app's theme naturally falls away on paste and only the structure survives (the desired outcome). The target must be a described region that emits a DOM id (`SectionNode.id`, `ListNode.id`) — so a wire-driving agent can always resolve what a copy would carry, and the button can never point at undescribed chrome. A `copyTargetId` that resolves to no element fails **loud** (a console error) and falls back to the plain `text` — never a silent dead button.
- **`CopyButtonNode.html?: string` — the server-provided route (opt-in).** A ready-made formatted representation the server authored, written as `text/html` alongside the plain `text`. Reach for it only when the content to copy is **not** already on the page; otherwise prefer `copyTargetId`, which authors nothing. This is a **write-only clipboard export** bound for a foreign destination — it never re-enters the rendered view (that would be decoration). Ignored when `copyTargetId` is set. Precedence: `copyTargetId` > `html` > plain `text` (today's behavior, byte-unchanged for every existing copy button).
- **`SectionNode.id` is now emitted as the rendered element's DOM `id`.** Previously it was an internal collapsible-open-state preservation key only; it now *also* becomes the element's real DOM id, which is what makes a formatted card addressable as a `copyTargetId` harvest target. `ListNode.id` already emitted a DOM id; this brings sections in line.

### Notes for adopters

- **Both packages:** purely additive — every existing copy button is byte-unchanged. Set `copyTargetId` (point at a described region's id) or `html` (hand over formatted markup) when you want a paste to keep its formatting.
- **Rich copy needs a secure context.** The two-representation write goes through the async Clipboard API, which browsers expose only over **HTTPS or `http://localhost`** (this has always been true of clipboard writes). In an insecure context the button degrades to the legacy plain-text copy — the plain representation still works, the formatted one can't be written. Nothing to configure; just don't expect rich paste over plain-`http://<ip>`.
- Asked for by a consumer (`/ai`, whose CEO wanted paste-out of the app to keep its formatting) but shipped as a general capability. Parity: FeatureProbe (both twins) now carries `html` on one copy button and `copyTargetId` on another, with `expectBodyContains` tripwires asserting both cross the wire.

---

## npm 6.1.0 / NuGet 6.2.0 — Ordered lists (`<ol>`)

**npm:** `6.1.0` (minor, from `6.0.0`) · **NuGet:** `6.2.0` (minor, from `6.1.0`). Purely additive on both sides.

### Added

- **`ListNode.ordered?: boolean`** — an ordered list. When true the list renders as a semantic `<ol>` (numbered) instead of `<ul>`; omitted/`false` is byte-identical to today's `<ul>`. The semantic element is the point: screen readers announce ordinal position and count, and the ordering is structural on the wire rather than baked into item text (so a wire-driving agent reads it as an ordered list, not `"1. "`-prefixed strings). The visible `1.` / `2.` markers come from a CSS counter (`.vms-list--ordered`), not native list markers, because `.vms-list` is a styled flex column with `list-style:none` — so numbering survives the framework's list-item layout, tone borders, and item states. Asked for by a consumer (`/ai`, whose Markdown→ViewNode transform was emitting visible number prefixes inside text nodes). Parity: FeatureProbe (both twins) now renders an ordered list beside the existing unordered one, with an `expectBodyContains` tripwire asserting `"ordered":true` crosses the wire.

### Notes for adopters

- **Both packages:** purely additive. Set `ordered: true` (TS) / `Ordered: true` (.NET) on a `ListNode` when you want a numbered list; existing lists are unchanged.



**npm:** `6.0.0` (major, from `5.2.0`) · **NuGet:** `6.1.0` (minor, from `6.0.0`). npm takes the major for one breaking type-narrowing (below); the tone fields are additive on both sides. Both packages now sit on major `6`.

### Added

- **`StatItem.tone` and `StepItem.tone`** — the universal status-color axis (`danger`/`warning`/`success`/`info`) now rides two more per-item composites, the same closed set already on Section/Button/ListItem/TableRow. A toned stat renders as a subtly tinted chip (tint + border carry the status; text stays neutral and readable — the Section-tone model), so an unhealthy count reads at a glance. A toned step overlays its status color onto the marker: filled states fill in the tone, an upcoming step outlines in it — orthogonal to the done/current/upcoming state the framework derives from `current`, so a failed or attention-needing stage reads without losing the reached/not-reached distinction. Both optional; omitted = today's neutral rendering. Asked for by consumers (Morpheus dashboards; PBMInvoices stuck-step rows).

### Changed

- **(BREAKING, npm/TypeScript only) `StatBarNode` stat `value` is now `string`, not `string | number`.** The two backends could not emit the same wire: a TS backend serialized a bare number as JSON `12` while the .NET twin's `string Value` could only emit `"12"` — a real cross-backend drift no parity fixture ever exercised (nothing rendered a stat-bar). Format the number server-side (`String(n)`, `n.toFixed(2)`, `$${n}`). See MIGRATION.md — the fix is one call and only affects code that emitted a numeric stat value. .NET was already `string`, so **NuGet is unaffected by this change.**
- **(visual, npm) Warning's solid fills are now a bright, accessible yellow.** Every solid warning fill — toast, primary badge, primary button, and the new toned step marker — switched from the dark brown-amber `--vms-warning` (which is dark *because it doubles as a text/border color*, where a bright yellow on white would be unreadable) to a new **`--vms-warning-fill`** (bright amber) with a **`--vms-on-warning-fill`** dark foreground. This is the standard "yellow gets dark text" pattern: warning now reads as an attention-grabbing yellow on light themes (7.37:1 dark-on-bright), and it also **fixes a latent AA failure on dark themes** (white on the bright amber was 2.14:1). Tints (section/table/chip surfaces) keep the base `--vms-warning` as their own consistent family. **Consumer-visible:** apps using a warning toast/button/badge will see the color shift — it is a strict accessibility improvement, nothing to do.

### Fixed

- **Two demos emitted a numeric stat value** — `demo/Showcase` (the canonical teaching demo) and `demo/NonBlockingPoll-bun` — teaching a shape the .NET backend cannot produce. Both corrected to strings. Parity now renders a stat-bar in FeatureProbe (both twins) with an `expectBodyContains` coverage tripwire asserting the value crosses as a JSON string; mutation-proved to fail loudly if a bare number returns.

### Notes for adopters

- **npm:** if you build a `StatBarNode`, its stat `value` must now be a `string` — `tsc` will flag any numeric literal. Nothing else changed for TypeScript consumers. The warning color shift needs no action.
- **NuGet:** purely additive (`StatItem.Tone`, `StepItem.Tone`). Nothing to do; adopt the tone fields when you want them.

---

## 6.0.0 — Closed wire unions are enums, not `string?` (NuGet only)

**NuGet:** `6.0.0` (major, from `5.2.0`) · **npm:** unchanged at `5.2.0`. **BREAKING for .NET apps; the wire is byte-identical and TypeScript consumers are entirely unaffected.**

⚠️ **Version alignment:** this is the first release where the packages' **majors diverge** (npm `5.2.0` / NuGet `6.0.0`). The "share major.minor" convention exists so that a **wire-format or ViewNode-shape change moves both sides together**; that is not what this is. The wire here is byte-identical (parity proves it across 8 fixtures / 3 backends), the TS types are untouched, and npm has **zero** code changes. Publishing an npm `6.0.0` would tell every TypeScript consumer "this is breaking, act now" when nothing changed for them — a major that lies is worse than a version gap. Pair npm `5.2.0` with NuGet `6.0.0`.

### Changed (BREAKING, .NET only)

- **Every closed union is now an enum instead of `string?`.** Audited: **39 of 39** closed unions in the TypeScript twin were typed `string?` in `ViewModels.cs`. The TS union was the only definition of validity and it did **not** bind the .NET backend — a .NET app could emit any string for a closed-list field, the renderer would silently ignore it, and the screen would quietly render wrong with no error anywhere. Parity could not catch it either: two backends emitting the same wrong value agree, and a diff passes. C# is strongly typed; it now carries the same protection TypeScript always had, and an invalid value is a **compile error**.

  New enums: `Tone`, `Emphasis`, `ControlSize`, `ControlWidth`, `ImageSize`, `ImageShape`, `ModalSize`, `ChartKind`, `FormLayout`, `Layout`, `PageWidth`, `Density`, `Arrange`, `Align`, `AlignSelf`, `Threshold`, `MinItem`, `MaxWidth`, `Orientation`, `Axis`, `TextStyle`, `SectionVariant`.

  **Still deliberately open:** `state` on `ListItemNode`/`TableRow` — freeform and app-extensible by design (`string` in the TS twin too).

  **Adding a value later is NOT breaking** — a new enum member is additive and existing consumer code keeps compiling untouched.

### Fixed

- **`demo/HelpDesk` agent queue emitted drifted wire** — the migration found it on the first build. The over-cap "refine your filter" message passed `"warning"` as a text **style** (a value removed in 3.0.0, when severity moved to the `tone` axis) where the bun twin correctly emits `tone: "warning"`. This is the **canonical workflow demo consumers copy from**. Three things hid it: it renders correctly *by accident* (style and tone share the `.vms-text--{value}` class, and `.vms-text--warning` exists for tone); parity **structurally cannot reach it** (the harness sets `HELPDESK_SEED=0` for stable ids, so there are 2 tickets instead of ~80, the cap never trips, and the over-cap branch never executes); and a hand audit missed it (it scanned named arguments only — this one is positional).

### Notes for adopters

- The enum→string conversion is **intrinsic** to the types (`KebabEnum<T>`), so it works under default ASP.NET options with **zero host setup**. You do **not** need to register a converter in `Program.cs`. This is deliberate and load-bearing: a bare enum serializes as a **number** (`"tone": 0`) and the stock `JsonStringEnumConverter` attribute emits PascalCase (`"tone": "Danger"`) — both silently wrong on the wire, both compile fine. Mutation-proved: removing the attribute makes parity fail with `"tone": 2` vs `"danger"`.
- `DefaultIgnoreCondition = WhenWritingNull` in your `Program.cs` remains **load-bearing** for your own state record — unchanged by this release, and still not optional (see gotcha #8).

---

## 5.2.0 / 5.2.0 — Lookup / remote-search reference field: `lookup` + `lookup-multiple` (npm + NuGet)

**npm:** `5.2.0` (minor, from `5.1.2`) · **NuGet:** `5.2.0` (minor, from `5.1.0`). **Additive** — the wire protocol token stays `viewmodel-shell/1.0`; existing apps and wire-driving agents are byte-unchanged. Both packages gain two new `FieldNode.inputType` values.

### Added

- **`inputType: "lookup"` and `inputType: "lookup-multiple"`** — the reference/relation field VMS has been missing since the beginning. `select`/`select-multiple` both assume the option set can be **enumerated into the tree**; the moment it's a 5,000-person directory or an 80,000-row customer table, VMS had no answer and apps were forced into a workaround. A lookup is conceptually **not a big select**: a select says *"here are all the values, pick one"*; a lookup says *"the values are a database table — describe which row you mean."*

  Wire shape (new optional `FieldNode` members): `bind` holds the **id** (`string`, or `string[]` for multi); `selected?: [{ value, label?, type? }]` carries the resolved label(s); `searchBind` holds the typed query; `searchAction` is dispatched on **Enter**; `candidates?` carries the current results; `allowCustom?` declares whether invented values are permitted.

  **The load-bearing rule: the label is VIEW, not STATE.** `bind` holds the id and only the id — the label rides on the node, server→client, recomputed every render, and is **never trusted coming back from the client**. It is **never** resolved out of `candidates`. That distinction is the whole design: with an id-valued field, *"filter the candidate list"* and *"forget what's selected"* are the same operation, which is why a form that loads with a reference already set renders its label with **no search having occurred** — the case that breaks naive implementations.

  **Both nodes render selections as chips outside the input**; the only difference is arity — single **replaces** on pick, multi **appends**. The input holds nothing but the query, in both modes. Framework owns the full accessibility layer (combobox ARIA on the input itself, item-specific `aria-label="Remove {item}"` per chip, add/remove announced via a live region, focus after removal moving next→previous→input and never to `<body>`, roving tabindex across chips, two-step Backspace armed by value). Zero appearance crosses the wire.

  **`allowCustom: true` with no candidate source is a free-form tags field** — no special case in the renderer. `allowCustom` **and** `searchAction` on the same field is **not supported in v1** and fails loud (`[vms:lookup-ambiguous-enter]`): Enter cannot mean both *invent this* and *search for this*.

  Designed against a three-part survey (mature component libraries; enterprise reference fields; the combobox accessibility contract) — design of record: [`.planning/design/lookup-field.md`](https://github.com/ashley-shrok/ViewModelShell/blob/main/.planning/design/lookup-field.md). Both backends emit them byte-identically (parity-gated), both tree-validators descend (`searchAction` participates in action-name uniqueness), the TUI degrades legibly, and `agent-skill.md` documents the picker as a first-class public protocol — **no surveyed platform publishes its picker's transport**, so an agent driving a lookup exactly like a human is a property that falls straight out of the architecture.

### Changed

- **`agent-skill.md`** gains a "Lookup / reference fields" section (byte-identical .NET twin, parity-gated). No new wire verbs, side-effect types, or error codes — the protocol token is unchanged.

**Consumers:** no action needed. Purely additive — nothing existing changes shape or behavior. Reach for a lookup when your option set is too large to enumerate; keep `select`/`select-multiple` for enumerable sets (that split is deliberate and is an accessibility requirement, not a stylistic one).

---

## 5.1.2 — Fixed: a lone `BadgeNode` stretched to full width in a `stack` section; per-row action buttons rendered flush together (npm)

**npm:** `5.1.2` (patch, from `5.1.1`) · **NuGet:** unchanged at `5.1.0`. Client-CSS-only fixes — no renderer logic, no wire or type change; the .NET package has no CSS, so it does not move. The wire protocol token stays `viewmodel-shell/1.0`.

### Fixed

- **`BadgeNode` now hugs its content in every parent layout.** A lone badge placed as a direct child of a `stack` section stretched to the full width of the card instead of sizing to its label. Cause: `.vms-badge` is `inline-flex`, but a flex item is **blockified** (`inline-flex` → `flex`), and a `stack` section's `align-items: stretch` then stretched it edge-to-edge. Fixed with `width: fit-content`, which gives the badge a definite cross-size and opts it out of the stretch (`align-items: stretch` only stretches items whose cross size is `auto`). Deliberately **not** `align-self: start` — that would top-anchor a badge inside a `row` section (whose `align-items: center` a child's `align-self` would override), trading one bug for another. `width: fit-content` touches only the main-axis size, so a badge hugs in a `stack` **and** stays vertically centered in a `row`, and is inert for a badge sitting inline in flowing text.
- **Trailing per-row action buttons no longer render flush against each other.** `TableRow.actions[]` `ButtonNode`s in the trailing actions cell had no spacing between adjacent buttons. Added `white-space: nowrap` on the cell plus a `.vms-button + .vms-button` left margin. Uses **margin-adjacency rather than `display: flex` on the `<td>`**, so the cell stays a proper table-cell and column widths are unaffected.

**Consumers:** no action needed. Both are pure appearance corrections in the shipped stylesheet — no wire, type, renderer, or dispatch change. Apps that worked around the badge stretch by wrapping it in a `row` section can drop the wrapper; the wrapper is harmless if kept.

---

## 5.1.1 — Fixed: dimmed (`state:"disabled"`) table rows that are still clickable now show the pointer cursor (npm)

**npm:** `5.1.1` (patch, from `5.1.0`) · **NuGet:** unchanged at `5.1.0`. Client-CSS-only fix — no renderer logic, no wire or type change; the .NET package has no CSS, so it does not move. The wire protocol token stays `viewmodel-shell/1.0`.

### Fixed

- **`TableRow` cursor now follows actual clickability.** `default.css` carried an override — `.vms-table__row--disabled.vms-table__row--clickable { cursor: default }` (+ hover neutralized) — that baked in a false *"disabled ⇒ not clickable"* assumption. But `state` is an **appearance axis only**: a `state:"disabled"` row that also sets `row.action` is dimmed **and still clickable** (e.g. an already-paid invoice line shown muted but still openable for details), so it should show the **pointer cursor + hover highlight** like any clickable row. Removed the override; the cursor is now a pure function of `--clickable` (i.e. whether `row.action` is set). To make a row literally non-clickable, omit `row.action` (optionally still dim it with `state`) — that path is unchanged (default cursor, no dispatch).

**Consumers:** no action needed. Purely corrects the cursor/hover on dimmed-but-clickable rows; appearance, dispatch behavior, and non-clickable rows are all unchanged. The `TableRow.state` doc (TS + .NET) now states explicitly that `state` never affects clickability or the cursor.

---

## 5.1.0 / 5.1.0 — Navigation primitives: `BreadcrumbNode` + `StepsNode` (npm + NuGet)

**npm:** `5.1.0` (minor, from `5.0.1`) · **NuGet:** `5.1.0` (minor, from `5.0.0`). **Additive** — the wire protocol token stays `viewmodel-shell/1.0`; existing apps and wire-driving agents are byte-unchanged. Both packages gain two new optional `ViewNode` types.

### Added

- **`BreadcrumbNode`** — a hierarchical "you are here" navigation trail. Wire shape: `{ type: "breadcrumb", items: [{ label, href?, external?, action? }] }`. The framework renders a `<nav aria-label="breadcrumb">` landmark + `<ol>`, marks the **last item as the current page** (auto non-clickable, `aria-current="page"` — position is the signal, no per-item flag), and draws a **fixed separator** (never on the wire). Crumbs navigate by `href` (`external: true` ⇒ new tab) or dispatch an `action`, matching `LinkNode`'s model.
- **`StepsNode`** — a multi-step / wizard progress indicator. Wire shape: `{ type: "steps", steps: [{ label, description? }], current, orientation? }`. Per-step **done / current / upcoming state is derived from the 0-based `current` index** (no per-step status field). `orientation` is a closed-enum intent: the default responsive **horizontal** strip auto-collapses to a vertical stack **intrinsically** by container width (zero viewport breakpoints), and an explicit `"vertical"` renders a deliberate wizard layout where per-step descriptions sit beside each step. The framework draws all markers, connectors (marker-center to marker-center, behind the markers), and the full accessibility layer (`aria-current="step"`, an accessible group name, marker state via `aria-label` — never color alone; non-interactive, so not focusable; not `role="progressbar"`).

Both nodes are pure structured data — the framework owns 100% of appearance and accessibility, nothing decorative crosses the wire. Both backends emit them byte-identically (parity-gated), both tree-validators descend into them (a breadcrumb crumb's `action` participates in action-name uniqueness), the TUI degrades them legibly, and the step marker glyph uses a surface-knockout that clears WCAG contrast across the default + all 12 themes. `agent-skill.md` is unchanged (new node types, not new wire verbs/side-effects).

---

## 5.0.1 — Fixed: `FormNode.submitButton` now honors `pendingLabel` / `disabled` / `confirm` (npm)

**npm:** `5.0.1` (patch, from `5.0.0`) · **NuGet:** unchanged at `5.0.0`. Client-renderer-only fix — the .NET package has no renderer, so it does not move. The wire protocol token stays `viewmodel-shell/1.0`; there is **no wire or type change** (the types already promised this behavior).

### Fixed

- A **form-level `submitButton`** (the consumer-provided submit button, from 3.1.0) rendered its cosmetic props (`label`/`emphasis`/`tone`/`size`/`width`) but silently **dropped `pendingLabel`, `disabled`, and `confirm`** on the submit path — it wired only the form's submit event and never ran the click behavior a standalone `ButtonNode` runs. So a submit button with a `pendingLabel` never swapped (no `.vms-button--pending`), a `disabled` submit button lacked the class/attr/dispatch-guard, and a `confirm` destructive-action guard never fired. Both paths now share one code path (the submit button's activation runs on the form's submit event — native Enter-to-submit preserved), so they can't diverge again. **No consumer action needed beyond bumping to `5.0.1`** — any `submitButton` already carrying those props starts working. Reported by a consumer (Hecate).

---

## 5.0.0 / 5.0.0 — Chart base set (multi-series, **BREAKING** `ChartNode` reshape) + destructive-action confirm + canonical reorder (npm + NuGet)

**npm:** `5.0.0` (MAJOR, from `4.2.0`) · **NuGet:** `5.0.0` (MAJOR, from `4.2.0`). Three features, one breaking reshape. The wire protocol token stays `viewmodel-shell/1.0` (the change is a node's shape, not the envelope). **The only breaking change is `ChartNode`**, and it was taken deliberately as a major while it is safe: **zero consumers had implemented a chart** (the 4.1 single-series `ChartNode` was the sole break surface), so the free reshape window was still open. If you never rendered a 4.1 chart, this is effectively additive for you — see MIGRATION.md.

### Changed (BREAKING) — `ChartNode` reshaped to multi-series-native

- `ChartNode` no longer carries `points: ChartPoint[]` (single-series). It now carries **shared `labels: string[]` + `series: ChartSeries[]`** where `ChartSeries = { name: string; data: number[]; tone? }`, plus `kind?`, `stacked?`, `title?`. `ChartPoint` is **removed**. The aligned `labels[]` + `series[].data[]` shape is the honest encoding of "these series share one x-axis." See MIGRATION.md for the one-shape rewrite (only needed if you adopted the 4.1 chart).

### Added — chart base set

- **Five chart kinds** via the closed `kind?` union: `bar | line | area | pie | donut` (omitted = `bar`). `line`/`area` (area = line + fill), `pie`/`donut` (single-series, per-slice palette) join the original bar. `stacked?` applies to bar/area.
- **Multi-series** everywhere it applies (grouped/stacked bars, multi-line overlays); single-series is just one `series` entry.
- **A framework-owned categorical palette** — new theme tokens **`--vms-chart-1 … --vms-chart-8`** in `default.css` and every theme; the browser adapter assigns the next slot per series (per slice for pie/donut). A series may set an optional **semantic `tone`** to use a theme status token instead. **Zero raw color crosses the wire** — brand palettes are a `--vms-chart-*` theme-token retune, same as any reskin.
- Chart.js remains a **private, lazy, optional** browser-adapter dependency — an app with no `ChartNode` still ships zero Chart.js bytes; core, the .NET backend, and the bun backend stay dependency-free.

### Added — `ButtonNode.confirm` (destructive-action guard)

- **`confirm?: string`** on `ButtonNode` (both backends). When set, the BrowserAdapter shows a **native** browser `confirm()` with the message before dispatch; Cancel suppresses the dispatch entirely (no action, no `pendingLabel` swap). Deliberately native, not a framework-drawn dialog: it adds **zero app/framework state** (no modal in the tree, nothing to round-trip) and is **client-only** — an agent dispatches the action name directly over the wire and is never gated. The TUI dispatches as normal.

### Added — canonical reorder pattern (demo + doc, no new framework code)

- The `demo/Reorder` demo is rewritten to the **blessed** reordering patterns, both composed from existing primitives (buttons + modal + named actions): **Up/Down** buttons reorder within a group (first-row Up / last-row Down `disabled`; the server **clamps** out-of-range moves to no-ops, since `disabled` is a client-only hint an agent can bypass), and a **Move…** button opens a modal to relocate an item to another group. `demo/Reorder/README.md` documents the pattern and restates that **pointer drag-and-drop is rejected** (mouse-only → not agent/keyboard-drivable); if ever added it could only be sugar over these same actions. Retires the old janky select-then-place prototype.

### Added — table jump-to-page

- **`TablePagination.jumpAction` / `JumpAction`** (both backends) — an optional action that lets a paginated table jump directly to a typed page number (alongside the existing prev/next), with the server-side page clamp applied. Built + verified before this release but not previously published; it ships here in 5.0.0. Additive — omit it for unchanged prev/next-only pagination.

### Fixed

- **Chart legend labels + titles now use the `--vms-text` theme token** (full contrast) instead of Chart.js's fixed default grey (`#666`) — the old grey was washed-out on light and near-invisible on dark themes. Axis ticks stay `--vms-text-muted` (secondary). Browser-only.

### Migration

- **Only if you adopted the 4.1 single-series `ChartNode`:** rewrite `points: [{label,value}…]` → `labels: [...]` + `series: [{ name, data: [...] }]`. Full recipe in **MIGRATION.md**. `ButtonNode.confirm` and the reorder rewrite are additive — nothing to do.

---

## 4.2.0 / 4.2.0 — Non-blocking actions: `blocking:false` dispatch lane + poll-fold + selection.action resurrection (npm + NuGet)

**npm:** `4.2.0` (MINOR, from `4.1.0`) · **NuGet:** `4.2.0` (MINOR, from `4.1.0`). A real concurrency model for the dispatch loop: non-blocking round trips that coexist with user actions instead of contending for a single global mutex. Fully additive — wire protocol token stays `viewmodel-shell/1.0`. `ActionEvent.blocking?` / `ActionDescriptor.Blocking` is the only new wire-adjacent field, and it never actually rides the `_action` payload (it is a purely client-side dispatch-lane hint). **Migration: none** — `blocking` defaults to `true`, byte-identical to every existing app's behavior until it opts in.

### Added

- **`blocking?: boolean`** on TS `ActionEvent` (omitted = `true`, byte-identical default) and the .NET twin `bool? Blocking` (note: NOT the usual F2 `WhenWritingDefault` pattern — because the default is `true`, not `false`, the correct .NET shape is nullable + `[JsonIgnore(WhenWritingNull)]`, byte-aligned with the TS optional-defaults-true field).
- **A two-lane dispatch loop** (`blockingInFlight` / `nonBlockingInFlight`) replacing the old single `dispatching` mutex — a `blocking:false` round trip now coexists with an in-flight blocking one instead of contending for one shared slot, fixing the poll/user-action contention as a side effect (today's poll silently occupied the one dispatch slot and could drop a user click, and vice versa).
- **Coalescing** (`pendingNonBlockingRefire`) — rapid repeated triggers of the same non-blocking action collapse to at most one background round trip in flight, latest-wins.
- **A client-side, lane-aware epoch** (`dispatchSeq` / `appliedSeq`) — a blocking response always applies unconditionally (there is only ever one blocking dispatch in flight, so it can never be superseded within its own lane); a non-blocking response is discarded once a strictly newer response has already applied OR a coalesced re-fire is already queued (closing the exact rapid-double-toggle revert bug — see below).
- **`pollInterval` formally documented as sugar over the non-blocking path** — no behavior change from 3.x, just now provably contention-free (a poll always rides the non-blocking lane, proven by a real-timer test, not just a manual dispatch call).
- **`selection.action` / per-checkbox live-refresh, correctly resurrected** — a selection checkbox checks immediately (optimistic local `bind` write) and fires its action with `blocking: false`; the returned tree echoes the selection back so the response can't un-check what the user just checked. This closes the exact 0.15.0 rapid-toggle revert bug that got the old `selection.action` mechanism removed: a stale in-flight response could previously apply after a same-control double-toggle and silently revert the user's second click (and poison the coalesced re-fire's own request with the wrong value). The fix discards a response whenever a coalesced re-fire is already queued, not just when it's stale by sequence number alone.
- **`agent-skill.md` gained a `## Non-blocking actions (blocking:false)` section** (already shipped in Phase 15), byte-copied to the .NET `AgentSkill.md`, explaining to wire-driving agents that `blocking` is informational-only — dispatch exactly the same way regardless of its value.

### Demo + tests

- Three new human-verification demos exercise every edge of the concurrency model: `demo/NonBlockingActionBar-bun` (rapid checkbox toggling + a server-computed live action bar + locked-row rejection), `demo/NonBlockingPoll-bun` (poll + user-action coexistence), `demo/NonBlockingStaleness-bun` (out-of-order/staleness discard). `demo/NonBlocking-VERIFICATION.md` carries the combined numbered "trigger X, then Y, expect Z" script; the operator signed off **PASS** on 2026-07-08 — every expected outcome held across all three scenarios (no checkbox revert, no dropped clicks, action bar recomputed server-side, locked-row rejection surfaced with a message, poll + clicks coexist without contention, stale background response discarded in favor of the newer user result).
- Vitest coverage added across Phases 14–15: `nonblocking-dispatch.test.ts` (lane coexistence, coalescing, epoch discard, the CR-01/CR-02 gap-closure regressions, the NBA-06 coalesce-pending-discard regression), `poll-fold.test.ts` (real `pollInterval` → `setTimeout` → auto-dispatch proof of coexistence, stale-discard, and loop-continuation), `checkbox-rapid-toggle.test.ts` (a real jsdom-rendered checkbox, rapidly double-toggled through the actual `ViewModelShell` + `BrowserAdapter` path, ends up matching the user's last click), `blocking-propagation.test.ts` (the `blocking` field survives dispatch from every trigger node: checkbox, button, tabs, section action, table row action).

### Migration

- **None needed** — purely additive; `blocking` defaults to `true`, byte-identical to every existing app's behavior until it opts in to `blocking: false` on a specific action.

---

## 4.1.0 / 4.1.0 — ChartNode: single-series bar-chart data-viz primitive (npm + NuGet)

**npm:** `4.1.0` (MINOR, from `4.0.0`) · **NuGet:** `4.1.0` (MINOR, from `4.0.0`). VMS's first data-visualization primitive — a structured `ChartNode` (bar, single-series, `title` + `tone`) rendered by Chart.js behind the browser adapter as a private implementation detail. Closes GitHub issue #6. Additive — the wire protocol token stays `viewmodel-shell/1.0`.

### Review fixes (pre-release visual verification)

Found during the operator's Phase 13 browser review: the default Chart.js grid used a fixed color (`rgba(0,0,0,0.1)`) that clashed with dark themes — visible on light backgrounds, nearly invisible on dark. Fixed in `cfa3175` (`fix(12): chart grid/tick/axis colors track theme tokens`) by wiring the grid/border/tick colors to the `--vms-border` / `--vms-text-muted` theme tokens so the chart reads consistently in every theme. Browser-only (no wire/.NET/parity impact).

### ChartNode — Phase 12 (on `main`, unpublished)

The **`ChartNode`** (`type:"chart"`) — VMS's first data-visualization primitive. It carries **bounded declared data** an agent reads directly (`points: {label, value}[]` + an optional `title` + a `tone` from the existing tone axis) and renders a single-series **bar** chart drawn by **Chart.js as a PRIVATE, lazy, optional dependency of the browser adapter** — apps never import or touch Chart.js. On new server data the chart **redraws in place** via Chart.js `.update()` (a persistent-across-renders instance registry survives the `innerHTML` wipe). Closes the design of GitHub issue #6. Additive — the wire protocol token stays `viewmodel-shell/1.0`.

### Added

- **`ChartNode`** — a new `ViewNode` (`type:"chart"`; `kind?:"bar"` [omitted = `"bar"`, the only v4.1 value — `line` is a future ADDITIVE union value, CHART-LINE, not a new node]; `points: {label, value}[]`; `title?`; `tone?:"danger" | "warning" | "success" | "info"`) + the **`ChartPoint`** sub-record (self-contained `{label, value}` pairs mirroring `StatItem` — no parallel-array index alignment) in the TS `ViewNode` union, mirrored as a .NET `ChartNode` / `ChartPoint` record + `[JsonDerivedType(typeof(ChartNode),"chart")]` discriminator (`Points` required + first; `Kind` / `Title` / `Tone` free-form `string?` each with `[JsonIgnore(WhenWritingNull)]`; `Value` is `double` to mirror TS `number`).
- **The `browser.ts` renderer** — `BrowserAdapter.chart()`: a `.vms-chart` wrapper + `<canvas>` drawing a single-series bar chart via a **lazy tree-shaken `import("chart.js")`** (registers only `BarController` / `BarElement` / `CategoryScale` / `LinearScale` / `Tooltip`, so a tree with no chart loads zero chart.js bytes); tone → theme-token color via `getComputedStyle` (`danger→--vms-error`, `warning→--vms-warning`, `success→--vms-success`, `info→--vms-info`, omitted → `--vms-accent`); **redraw-in-place** via `.update()` keyed by a stable title-derived + ordinal key with a per-render mark-sweep that `.destroy()`s any chart the new tree omitted; and a **fail-loud** `console.error` (the sanctioned capability seam) when the optional `chart.js` peer dep is absent — never a silent no-op or a floating unhandled rejection.
- **The `.vms-chart`** structural framework CSS (`display:block; position:relative; width:100%; height:20rem` — bounded + positioned for Chart.js responsive sizing).
- **The TUI degradation (CHART-05)** — `tui.tsx` renders a `ChartNode` as a legible **printed series**: the `title` (if any), then per point a `label  value  ASCII-bar` line where the bar is a run of `█` scaled to `value / max × 20`, with empty-points / non-positive-max guards. A terminal has no canvas, but the ChartNode is structured data, so it prints. `ChartNode` is a **LEAF** (no children) → no container-walk arm (same as `StatBarNode` / `ProgressNode`). The TUI is `@experimental`; the requirement is only that `ChartNode` doesn't break it and degrades legibly.
- **`chart.js@^4`** declared as a `devDependency` + an **OPTIONAL** `peerDependency` (`peerDependenciesMeta.chart.js.optional:true`) — apps that render no chart install nothing and load zero chart.js bytes.

### Not changed

- No wire-shape change — the protocol token stays `viewmodel-shell/1.0` (a new optional-field-bearing leaf ViewNode is additive). The core `index.ts` gains the **TYPE only** — all rendering / canvas / `getComputedStyle` / Chart.js live in `browser.ts`, so the `check:core-globals` guard stays green. The **.NET / bun backends gain NO chart.js dependency** (they only EMIT the data). `agent-skill.md` / `AgentSkill.md` are **untouched here** — ChartNode is documented in the agent skill in Phase 13 / CHART-06 (both copies must change together to keep the parity skill gate green).

### Demo + tests

- **FeatureProbe** twins (`FeatureProbe-bun/handler.ts` + `FeatureProbe/AspNetCore/FeatureProbeController.cs`) render a static `chart (bar)` node (whole-number points `Mon/Tue/Wed` = 12/19/7, `title:"Weekly visits"`, `tone:"info"`, `kind` omitted); the existing `feature-probe` GET steps capture it, so both backends emit **byte-identical** `{type:"chart", kind?, points, title?, tone?}` wire (cross-backend parity verified; whole-number values keep `double`/`number` serialization byte-identical — `12` not `12.0`). **The client-side Chart.js pixels are browser-only and explicitly NOT part of parity** — parity proves only identical serialization.
- `viewmodel-shell/test/chart.test.ts` (+ `test/chart-missing-dep.test.ts`) cover the bar-config integration (mocked chart.js), redraw-in-place via `.update()`, removal `.destroy()` mark-sweep, fail-loud on a missing dep, and the validator no-blind-spot. Real pixels (bars / colors / title) are **jsdom-untestable** and verified by the Phase 13 operator browser review (CHART-06).
- The **Showcase** (`demo/Showcase/frontend/src/main.ts`) gains a bar-chart demo (`title:"Signups"`, `tone:"success"`), built only from ViewNodes (zero `<style>`).

### Migration

- **None needed** — a purely additive new leaf node; existing trees, callers, and agents are unaffected. **Consumers who render a `ChartNode` must install the optional `chart.js` peer dependency**; apps that render no chart need nothing.

---

## 4.0.0 / 4.0.0 — file uploads route by declared `uploadOn`, not button position (npm + NuGet)

**npm:** `4.0.0` (MAJOR, from `3.11.0`) · **NuGet:** `4.0.0` (MAJOR, from `3.11.1`). **BREAKING** runtime change to file-upload forms. Wire protocol token unchanged (`viewmodel-shell/1.0`) — the wire *shape* is identical (multipart `_action` + `_state` + file entries); `uploadOn` is an additive optional field on the tree. **Migration: add `uploadOn: ["<action>"]` to every file input — see MIGRATION.md.**

Fixes a positional coupling surfaced by a consumer (`/ai`): whether a button's dispatch carried a form's file uploads used to depend on WHERE the button sat in the tree. The submit paths and `FormNode.buttons[]` swept every `<input type=file>`, but a byte-identical `ButtonNode` in `FormNode.children` silently carried none — forcing the upload button into the footer, away from its file field. The routing intent now lives on the **file input**, which declares which action(s) carry it; the stateless server is unchanged (it never enforced browser file-routing), and the contract lives in each adapter — the browser renderer for humans, `agent-skill.md` for agents.

### Changed (BREAKING)
- **File collection is by declared `uploadOn`, not button position.** A file rides an action **iff** the dispatched action's name is listed in that file input's `uploadOn`, regardless of whether the trigger is a submit, a footer `buttons[]` entry, a `ButtonNode`/`FieldNode.action` nested anywhere in `children`, or textarea-Enter. **The old positional auto-sweep is removed** — submit and `buttons[]` no longer carry files automatically. A file input with no `uploadOn` (absent/empty) rides **nothing**. This is the break: an existing upload form stops sending its file until each file input declares `uploadOn`.
- **The click-vs-Enter inconsistency is gone.** Because the file rides the *action* (not the trigger), any trigger of a declared action carries it — a `FieldNode.action` Enter now carries files identically to a button.

### Added
- **`FieldNode.uploadOn`** (`uploadOn?: string[]` / `IReadOnlyList<string>? UploadOn`) on both backends — file-input-only, omitted-when-absent on the wire (last positional param on the .NET record).
- **`[vms:orphan-file]` dev-console warning** (browser): picking a file into an input with no `uploadOn` warns once that its binary will never be sent — silent under-attach is the dangerous failure the declared model makes visible.
- **`agent-skill.md` documents the contract:** an agent attaches a file's entry only when dispatching an action listed in that file input's `uploadOn` — mirroring the browser, so an agent can't send a file with an action a human's click could not have.

### Fixed
- The false `FormNode.buttons?` TSDoc invariant (claimed `children`/`buttons[]` had identical dispatch semantics — was false for files). It is now true: both route through the same file-aware dispatch governed by `uploadOn`.

### Migration
Add `uploadOn: ["<your-submit-or-upload-action>"]` to each file `FieldNode`. See MIGRATION.md for the recipe. Wire token stays `viewmodel-shell/1.0`.

---

## 3.11.0 / 3.11.0 — packaged version-skew build id: Vite plugin + no-arg `AddVmsShellVersioning()` (npm + NuGet)

**npm:** `3.11.0` (MINOR, from `3.9.0` — skips the NuGet-only `3.10.0`) · **NuGet:** `3.11.0` (MINOR, from `3.10.0`). The two packages converge at `3.11.0`. Additive and opt-in. Wire protocol token unchanged (`viewmodel-shell/1.0`); no wire/envelope/error-code change; `agent-skill.md` untouched. **Migration: none — opt-in ergonomics.**

Turns the 3.8.0 version-skew build-id boilerplate (every adopter hand-rolled ~40 lines: a placeholder-`define` → `writeBundle` two-step Vite plugin, the load-bearing `build.manifest:"manifest.json"` path gotcha, and a C# hash snippet) into two packaged one-liners. VMS now owns the build-id contract end-to-end, so two adopters can't hash the same manifest differently and silently break skew detection across a fleet.

### Added
- **npm — new `@ashley-shrok/viewmodel-shell/vite` subpath** exporting `vmsBuildIdPlugin(options?)`. Adoption drops to: `plugins: [vmsBuildIdPlugin()]` in `vite.config.ts` + `clientBuildId: import.meta.env.VITE_VMS_BUILD` in the shell init. The plugin injects an internal placeholder via `import.meta.env.VITE_VMS_BUILD`, sets `build.manifest = "manifest.json"` when unset (and **warns, without overriding,** if the app set a different manifest path — killing the path-alignment gotcha), and in `writeBundle` hashes the emitted `manifest.json` and substitutes the placeholder in every emitted chunk that carries it (default `extensions: [".js"]`, `hashLength: 12`; both overridable). The `vite` import is **type-only** → `dist/vite.js` has no runtime `vite` require; `vite` is an **optional peer dependency** so non-Vite consumers of the root package aren't nagged. Also exports `vmsHashManifestBytes(bytes, hashLength=12)`.
- **NuGet — new no-arg `AddVmsShellVersioning()` overload** that self-hashes the build id from the built `wwwroot/manifest.json` (via the new internal `VmsManifestBuildId.Compute`). Adoption drops to `services.AddVmsShellVersioning();` — no more hand-rolled `SHA256.HashData(File.ReadAllBytes(...))` snippet. Registered via a **lazy factory** (the hash needs `IWebHostEnvironment.WebRootPath`, unavailable at ConfigureServices time; computed once on first resolution). The existing `AddVmsShellVersioning(string)` overload, `VmsVersioningOptions`, and `ShellVersionResultFilter` are unchanged.

### Hash contract (locked, both sides)
**SHA-256 of the RAW `manifest.json` file bytes on disk → the FIRST 12 hex chars, LOWERCASE.** No re-serialize, no normalization, no BOM. A missing manifest → the sentinel `"dev-none"` (guard inert in dev). A cross-backend test asserts both `vmsHashManifestBytes` (npm) and `VmsManifestBuildId.Compute` (.NET) produce the same 12-hex against one byte-identical shared fixture.

### Fleet constraint
**Do NOT modify `manifest.json` post-build.** The server hashes it at startup; the client id is hashed at build time — a deploy-pipeline step that minifies/prettifies/re-formats `manifest.json` between Vite emit and .NET startup changes the raw bytes and diverges the two hashes. Ship the manifest byte-for-byte as Vite wrote it.

### Migration
None — additive/opt-in. Existing hand-rolled 3.8.0 wire-ups keep working; migrate to the packaged path at leisure. See MIGRATION.md.

---

## NuGet 3.10.0 — server-side `[vms:type-mismatch]` diagnostic (the certain half) (NuGet)

**NuGet:** `3.10.0` (MINOR) · **npm:** unchanged at `3.9.0`. Backend-only, additive. Wire protocol token unchanged (`viewmodel-shell/1.0`); no wire/envelope/error-code change. **Migration: none — the signal is a server log line.**

Completes the `[vms:type-mismatch]` story begun in 3.9.0. That release added the *client* observable-subset warning; but the untyped JS client can't see an empty/null slot's declared server type — the exact shape that broke PBMInvoices (a `{filename,size}` object into an empty `Dictionary<string,string>`). This is the **certain** detection, server-side.

### Added
- **`[vms:type-mismatch]` server-log diagnostic.** When a typed `_state` deserialize fails with a **conversion** failure (a `System.Text.Json.JsonException` whose `.Path` is set and whose message contains "could not be converted" — e.g. an object landing in a `string` / `Dictionary<string,string>` slot), `ShellExceptionFilter` now emits a structured `_logger.LogWarning` carrying the **same `[vms:type-mismatch]` prefix** as the client warn (grep symmetry), the failing **JSON path**, the STJ message (which names the target type), and a fix-hint. It reuses the filter's existing injected `ILogger`, so it flows through the app's normal logging pipeline (e.g. Serilog → CloudWatch) with **zero wiring**. A structurally-malformed body (no path / not a conversion failure) stays a plain `parse_error` and does NOT emit this.
- **The wire response is UNCHANGED** — still a `400 parse_error`. This is a maintainer diagnostic surface, not a behavior change for callers/users.
- **.NET-only by nature:** the TS backend has no typed `_state` deserialize (untyped at runtime), so there is nothing to detect there — hence the NuGet-only bump (npm stays `3.9.0`). All ASP.NET consumers are covered.

---

## NuGet 3.11.1 — `AddVmsShellVersioning` self-registers its stamp filter (NuGet)

**NuGet:** `3.11.1` (PATCH) · **npm:** unchanged at `3.11.0`. Bug fix, no wire change (`viewmodel-shell/1.0`). **Migration: 3.11.0 adopters drop the manual filter line — see MIGRATION.md.**

### Fixed
- **`AddVmsShellVersioning()` now self-registers `ShellVersionResultFilter`** (both the no-arg and `string` overloads), via `Configure<MvcOptions>`. Before this, the call registered only the `VmsVersioningOptions` singleton, NOT the result filter — so the **Phase-1 `serverBuild` stamp silently no-op'd** and version-skew *detection* (the `VmsVersionSkewError` / banner path) never fired unless the app *also* added the filter by hand. The Phase-2 fail-closed guard (`ActionPayload<T>.Parse(Request, id)`) was unaffected. The one-line adoption story (`services.AddVmsShellVersioning();`) now actually works. Caught in prod by the first packaged-3.11.0 adopter. The registration is **dedup-guarded**, so a legacy caller that still adds the filter manually gets exactly one (a double-stamp would be harmless anyway — the stamp is idempotent). The HelpDesk demo drops its now-redundant manual `Filters.Add<ShellVersionResultFilter>()`.

---

## 3.9.0 / 3.9.0 — `FieldNode.bind` optional (file inputs) + two dev-console diagnostics (npm + NuGet)

**npm:** `3.9.0` (MINOR) · **NuGet:** `3.9.0` (MINOR). Additive — a required field became optional (widening, not breaking) and two console diagnostics were added. Wire protocol token stays `viewmodel-shell/1.0` (a `bind`-less file field simply omits the `bind` key). **Migration: none — opt-in.**

### Changed
- **`FieldNode.bind` is now OPTIONAL.** TS `bind?: string`; .NET `Bind` is now `string?` (kept in its positional slot, `WhenWritingNull` → absent). A file input's binary rides the multipart side channel (the `fileRegistry`, keyed on the field's `name`, NOT its `bind`), so a file field needs no bind — **omit it** (drop the old `Bind: null!` type-lie workaround). This avoids writing the `{filename,size}` placeholder object into state, which broke a state slot typed `string` / `Dictionary<string,string>` on the `_state` round-trip (System.Text.Json "could not convert object to String"). Value-bearing inputs (text/email/password/number/date/time/datetime-local/textarea/select/select-multiple/checkbox/code) still require a bind. A `bind`-less file field serializes with NO `bind` key identically from both backends.

### Added
- **`[vms:no-bind]` diagnostic (dev console).** A value-bearing (non-file, non-hidden) `FieldNode` rendered with no `bind` warns once (deduped per adapter) — the field renders but user input has nowhere to persist and is dropped.
- **`[vms:type-mismatch]` diagnostic (dev console, observable subset).** When a file `FieldNode` is about to write its `{filename,size}` object into a bind slot whose current value is a non-object scalar, it warns once — if that slot is typed `string`/string-map server-side the `_state` round-trip will fail. The client is untyped JS, so it only catches the OBSERVABLE case (a file object overwriting an already-scalar slot); it can't see an empty/null slot's declared server type (certain detection of that is a separate server-side deserialize diagnostic, not in this release). Fix by giving the file field an object-typed slot, or by omitting `bind`.
- Both warnings fire in dev AND prod (the client bundle can't distinguish environments) and are deduped, so prod telemetry that captures `console.warn` sees them without spam.

### Migration
None — additive/opt-in. A Phase-6 string/string-map state that held a file field can drop the placeholder; omit `bind` on file inputs. See MIGRATION.md.

---

## 3.8.0 / 3.8.0 — client/server version-skew detection + fail-closed stale-client guard (npm + NuGet)

**npm:** `3.8.0` (MINOR) · **NuGet:** `3.8.0` (MINOR). Additive and **fully opt-in** — supply no build ids and behavior is byte-identical to 3.7.0. Wire protocol token stays `viewmodel-shell/1.0` (all additions are optional fields / an optional header). **Migration: none.**

Closes the never-reloaded-tab gap: `UseVmsShellStaticFiles` (1.8.0) makes any *reload* pick up a fresh shell, but a tab that loaded this morning and is never reloaded keeps running yesterday's in-memory JS against a server that rolled forward at midday. This release lets that fail-loud (detection) and, for correctness-sensitive apps, fail-closed on mutations.

### Added
- **Response `serverBuild` field (`ShellResponse.serverBuild` TS / `ShellResponse<TState>.ServerBuild` .NET).** The server's current-deployed client-build id, stamped on every response when versioning is enabled. Absent ⇒ the feature is off (WhenWritingNull on .NET).
- **`X-VMS-Client-Build` request header.** The client auto-attaches it to every action POST when `clientBuildId` is configured.
- **Client `ShellOptions.clientBuildId?: string`** — the running bundle's id, injected by the app at build time (VMS never derives it, staying platform-agnostic). Enables both halves below.
- **Phase 1 — detection.** On a *successful* response, if `serverBuild` differs from `clientBuildId`, the shell renders normally FIRST, then fires a new catchable `VmsVersionSkewError` (`serverBuild`, `clientBuild`, `code = "version_skew"`) via the existing `onError` seam. Distinguish it with `if (err instanceof VmsVersionSkewError)`. Never fires at initial load (ids match on a fresh bundle), when `clientBuildId` is unset, or when `serverBuild` is absent — and never swallows the render.
- **Phase 2 — fail-closed guard + recovery.** A new framework error code **`stale_client`** (peer of `unknown_action`/`invalid_tree`/`parse_error`/`uncaught_exception`). When a mutating request's `X-VMS-Client-Build` header ≠ the server's current build, the server returns `ok:false` / HTTP 400 / `code:"stale_client"` **before `_state` is deserialized** (the app's typed handler never runs on a stale payload). The client surfaces it via `onError` (as `VmsActionError`), then calls a new optional `Adapter.reload?()` verb to reload to the fresh bundle (the rejected action applied nothing; reload is the only safe recovery). `reload` is **fail-quiet by absence** (the `stale_client` error already surfaces via `onError`); `BrowserAdapter.reload()` = `window.location.reload()`.

### How to enable
- **Client (both backends' apps):** set `ShellOptions.clientBuildId` to the running bundle id.
- **Server — TypeScript:** `createAction(handler, { currentBuild: "<id>" })` (new optional second arg; the handler-only signature is unchanged). Stamps `serverBuild` and enforces the guard centrally.
- **Server — .NET:** `builder.Services.AddVmsShellVersioning("<id>")` + register `ShellVersionResultFilter` (stamps `ServerBuild` on every controller-returned `ShellResponse`, GET and POST) + change each action controller's parse to the new `ActionPayload<T>.Parse(Request, "<id>")` overload (the fail-closed guard; the existing `Parse(actionJson, stateJson)` overload is unchanged). New `StaleClientException` → 400 `stale_client` via `ShellExceptionFilter`.

### Migration
None — additive, opt-in. Supply no build ids and nothing changes. See MIGRATION.md for the opt-in recipe.

---

## 3.7.0 / 3.7.0 — `SectionNode.followTail`: append-only feed / stick-to-bottom scroll (npm + NuGet)

**npm:** `3.7.0` (MINOR) · **NuGet:** `3.7.0` (MINOR). One additive optional boolean, `SectionNode.followTail`. Wire protocol token stays `viewmodel-shell/1.0` (additive optional field; old agents/apps unaffected). **Migration: none.** (Includes the 3.6.2 select empty-bind fix.)

### Added
- **`SectionNode.followTail` (boolean) — the append-only-feed scroll axis.** A growing transcript (chat log above a pinned composer, a live `tail -f` view, an activity/audit stream, streamed job output) whose NEWEST content stays in view across re-renders, unless the user has scrolled up to read history. It exists because the default scroll-preservation contract (0.7.1/#7 — restore the prior `scrollTop`) is INVERTED for a growing feed: the old bottom becomes mid-scroll once taller content is appended, so the newest content silently ends up off-screen. **Pure client-side render behavior** — scroll position never rides the wire, the server stays stateless. The `BrowserAdapter` records, before each re-render, whether a `[data-follow-tail]` element was within a small threshold (40px) of the bottom; after the re-render it pins a near-bottom (or brand-new) feed to the new bottom and leaves a scrolled-up feed exactly where the user parked it. The follow decision is a pure function of the feed's scroll position at render time — a background poll, an SSE push, and the user's own submit all follow the same rule, so a genuinely scrolled-up feed is never hijacked. Emits `data-follow-tail` (no CSS — the scroll comes from the element already being an overflow region), so it pairs with `fill` (which provides the internal `overflow-y:auto`); inert on a non-scrolling element. Orthogonal to `fill` and `layout`. The TUI ignores it (terminals follow naturally). Absent/false = byte-identical to today's preserve-my-place restore. Reported + prod-verified by a consumer (`/ai`).

### Migration
None — additive optional field. Set `followTail: true` (TS) / `FollowTail: true` (.NET) on the `fill` body section of a chat/log shell to opt in; every existing section is byte-identical.

---

## 3.6.2 / — Select FieldNode: seed the displayed value into state (empty-bind data-loss fix) (npm only)

**npm:** `3.6.2` (PATCH) · **NuGet:** unchanged (`3.6.0`). Client-only (`browser.ts`) — no wire/type change, no `.NET` change. **Migration: none** — `npm i @ashley-shrok/viewmodel-shell@3.6.2` and re-bundle.

### Fixed
- **A `select` FieldNode whose bound path had no value never wrote its displayed value into state → the key was ABSENT on dispatch.** A `<select>` always displays a selected option (HTML auto-selects the first when none is explicitly `selected`), but VMS only wrote to the bound state path on the `change` event — and the submitted `_state` is the state object, not a DOM harvest. So a select left at its displayed default (or whose bind had no initial value) contributed **nothing** to state: on the wire the key was missing entirely (not `""`), and presence-checking server validators reported the field unset even though the user saw an option chosen. Text/number/date fields were unaffected (an untouched text input legitimately has `""`). Latent since the Phase-6 bind model; surfaced when a consumer (PBMInvoices) first operator-drove a select-bearing form in prod. **Fix:** on render, seed the select's effective displayed value into state whenever state doesn't already carry it — state now faithfully mirrors the control. An app wanting a "please choose" state uses a placeholder option with value `""`: the seeded value is then `""` (an explicit empty a `required` validator correctly rejects), never a silently-missing key. Applies to single- and multi-select (a multi with no selection seeds `[]`).

### Migration
None — client-only. Update the package and re-bundle; no app or server changes. Any consumer-side workaround that pre-seeded select defaults in server state can stay or be removed — the seed is idempotent when state already matches the display.

---

## 3.6.1 / — Fill axis CSS fixes: body-margin overflow + fill·sidebar composition (npm only)

**npm:** `3.6.1` (PATCH) · **NuGet:** unchanged (`3.6.0`). CSS-only — no wire/type change, no `.NET` change. Two rendering bugs in the 3.6.0 fill axis, both surfaced by a live consumer (`/ai`) and DevTools-verified, fixed in `styles/default.css`. **Migration: none** — re-bundle the stylesheet (`npm i @ashley-shrok/viewmodel-shell@3.6.1`); no app code changes. Consumers carrying an app-side `body{margin:0}` stopgap for fill pages can drop it.

### Fixed
- **`page.fill` + the host body margin overflowed the viewport.** The base `body` rule deliberately leaves `margin` to the host (the one-line `body{margin:0}` convention), but a `100dvh` fill page plus the UA's default 8px body margin = `100dvh + 16px` → ~16px of scroll and a clipped pinned footer/composer. Fill is the feature that makes that gap load-bearing, so the framework now owns the reset **only when a fill page is present** — `body:has(.vms-page--fill) { margin: 0 }`. Scoped via `:has()` so non-fill pages keep the existing host-owns-margin convention untouched.
- **`page.fill` + `layout:"sidebar"` + `align:"stretch"` burst the fill height.** `.vms-page--sidebar` is `flex-wrap: wrap` (for the breakpoint-free stacked collapse), so the wrapped flex line's cross-size is the children's *natural* max, not the container's `100dvh`; `align:stretch` then stretched both children to that natural max (e.g. a long sidebar list pushed the page past the viewport, clipping the composer). Fixed by capping each child at the page height and letting it scroll internally: `.vms-page--fill.vms-page--sidebar > * { max-height: 100%; overflow-y: auto }`. Scoped to the fill+sidebar composition so no other layout is affected.

### Migration
None — CSS-only. Update the package and re-bundle; remove any app-side `body{margin:0}` stopgap added for fill pages.

---

## 3.6.0 / 3.6.0 — Fill layout axis (page.fill + section.fill): full-height app shells (npm + NuGet)

**npm:** `3.6.0` (MINOR) · **NuGet:** `3.6.0` (MINOR). Until now VMS's layout vocabulary was entirely the **inline (horizontal-flow) axis** — `stack`/`row`/`cards`/`sidebar`/`switcher`/`fits` — with no **block-axis / height** knob, so it could not express the everyday **full-height app shell**: a page that fills the viewport with a pinned header/footer and ONE body region that takes the leftover height and scrolls internally (the chat shell — a transcript above a fixed composer; a sticky-toolbar admin frame). This is the Flutter `Column` + `Expanded` mechanism. Two additive optional booleans add it. Wire protocol token stays `viewmodel-shell/1.0` (additive optional fields; old agents/apps unaffected). **Migration: none.**

### Added
- **`PageNode.fill`** — when `true`, the page fills the viewport height (`.vms-page--fill` → `height:100dvh`) so a `fill` section inside it can claim the leftover column height. Absent/false = normal document flow, byte-identical to 3.5.0.
- **`SectionNode.fill`** — when `true` (inside a `fill` page), the section becomes the Expanded body region: `.vms-section--fill` → `flex:1 1 auto; min-height:0; overflow-y:auto` (take remaining height, allow shrink-below-content, scroll internally). Orthogonal to `layout` — a fill section still arranges its own children via `layout`. Outside a `fill` page the modifier class is an inert no-op.

Passes the layout gate cleanly: **P1** — the mechanism is intrinsic flex distribution of leftover height (`100dvh` + `flex:1; min-height:0; overflow-y:auto`), zero viewport breakpoints; **P2** — each field is a single boolean, the most-closed value set possible, no raw CSS on the wire. Distinct from the deferred `Cover` primitive (vertical-centering for splash/empty-state), which stays deferred. Both backends drop `false` from the wire (`WhenWritingDefault` / TS optional absent), so the false-vs-absent contract holds. FeatureProbe renders a static `section` with `fill:true` so the new wire field is byte-diffed across all backends in parity; `PageNode.fill` is covered by the .NET serialization tests.

### Migration
None — both fields are additive and optional; omitting them is byte-identical to 3.5.0.

---

## 3.5.0 / 3.5.0 — Feedback primitives: toast, empty-state, badge (npm + NuGet)

**npm:** `3.5.0` (MINOR) · **NuGet:** `3.5.0` (MINOR). The audit's feedback cluster: VMS had no first-class way to *acknowledge* an action ("Saved"), present *emptiness* ("nothing here yet"), or show *status at a glance* (a pill/count). Three additive primitives close it. Wire protocol token stays `viewmodel-shell/1.0` (additive optional nodes + one new side-effect type; old agents/apps unaffected). **Migration: none.**

### Added
- **Toast — a transient confirmation via the side-effect seam (not a view node).** A new `ShellSideEffect` of `type: "toast"` (`message`, optional `tone` + `durationMs`), created with `ShellSideEffect.Toast(...)` (.NET) / `shellSideEffect.toast(...)` (TS). It rides the existing side-effect channel, so the server stays stateless — a toast fires **once** when the response lands rather than living in the view tree (which would re-show it on every render). Routed to a **new optional `Adapter.toast?()` capability verb**, which is **fail-quiet by absence** (modeled on `setPreventUnload`/`setBusy`, *not* on `navigate`/`storage`/`saveFile`): a dropped toast is a missed UX nicety, never a correctness/security bug, so a non-toast adapter simply no-ops. `BrowserAdapter` stacks toasts in one fixed-corner region (`role="status"` / `aria-live="polite"`) and auto-dismisses each after `durationMs` (default ~4000ms). Neutral toasts render as a high-contrast inverted chip; tone toasts are fully filled in the status color so an important alert is impossible to miss. (MUI Snackbar, Sonner, Ant message.)
- **`EmptyStateNode`** — a first-class "nothing here" block: required `heading`, optional `message`, optional `action` (a call-to-action `ButtonNode`, e.g. "Create your first invoice"). Replaces hand-rolled muted-`TextNode` empty messages (HelpDesk alone hand-rolled three). The `action` button is a real dispatch-bearing descendant, so both tree validators descend into it (action-name uniqueness is enforced on the CTA). No icon field — the framework ships no icon set. (MUI/Ant `<Empty>`.)
- **`BadgeNode`** — a compact inline status pill / count: `label` + the universal `tone` (semantic color) × `emphasis` (filled vs outline) axes — no new appearance concepts. A leaf node for `"3"`, `"New"`, `"Overdue"`, etc., inside headings, list items, or table cells. (MUI/Ant `<Badge>`/`<Tag>`.)

All three render zero app CSS (shipped `default.css` styles `.vms-toast`/`.vms-empty-state`/`.vms-badge` + their tone/emphasis modifiers). FeatureProbe renders both nodes statically and emits the toast side-effect (both the omitted-field and fully-populated cases) so every new wire field is byte-diffed across all backends in parity.

### Migration
None — the two nodes and the `"toast"` side-effect are additive and optional; omitting them is byte-identical to 3.4.0. The new `Adapter.toast?()` verb is optional, so any existing custom adapter compiles unchanged (it just no-ops on toast effects until it implements the verb).

---

## 3.4.0 / 3.4.0 — Forms completeness: per-field validation, hints, disabled/readonly, input constraints (npm + NuGet)

**npm:** `3.4.0` (MINOR) · **NuGet:** `3.4.0` (MINOR). The audit's clearest gap was forms — `FieldNode` was bare and per-field validation had no first-class home. Eight additive optional fields close it. Wire protocol token stays `viewmodel-shell/1.0` (additive optional fields; old agents/apps unaffected). **Migration: none.**

### Added
- **`FieldNode.error?: string`** — first-class per-field inline validation error, rendered below the control as `.vms-field__error` (`role="alert"`), with the wrapper marked `.vms-field--error`, the control's `aria-invalid="true"`, and the message wired into `aria-describedby`. The **view-side** complement to the response-level `rejected` channel: `rejected.violations[]` is the structured wire/agent signal, `field.error` is the rendered message you bake onto the offending field. They compose (every form library ships both a field-error and a form-level error list); use either or both. Previously the only way to show a field error was a loose `TextNode` (gotcha #4). (MUI `TextField error`, Formik/RHF field errors.)
- **`FieldNode.help?: string`** — hint/description text below the control (`.vms-field__help`), wired into `aria-describedby`. (MUI `helperText`.)
- **`FieldNode.disabled?` / `readonly?`** — native disabled (greyed, excluded from submit) / read-only (shown + submitted, not editable) states. `disabled` adds `.vms-field--disabled`.
- **`FieldNode.min?` / `max?` / `step?` (strings) + `maxLength?` (int)** — passthrough to the native input attributes for `number`/`range`/date-time bounds and text length caps. `min`/`max`/`step` are **strings** (HTML-attribute semantics — a numeric bound `"0"`, a date bound `"2020-01-01"`, or `step:"any"`), typed as strings so the wire stays byte-identical across backends.
- **`ButtonNode.disabled?: boolean`** — server-declared disabled button (greyed via `.vms-button--disabled` + native `disabled`); the renderer refuses to dispatch its action. Distinct from the transient `pendingLabel` (which only covers the in-flight round-trip). (Universal.)

All eight are optional and render zero app CSS (the shipped `default.css` styles `.vms-field__help`/`__error`/`--error`/`--disabled` + `.vms-button--disabled`). FeatureProbe renders the full set statically so the new wire fields are byte-diffed across all backends in parity.

### Migration
None — every field is optional and additive; omitting them is byte-identical to 3.3.0. `FieldNode.error` does not replace or change the `rejected` envelope channel; it's an independent view-side primitive you opt into.

---

## 3.3.0 / 3.3.0 — Correctness, a11y & cross-backend parity hardening (npm + NuGet)

**npm:** `3.3.0` (MINOR) · **NuGet:** `3.3.0` (MINOR). A consolidated correctness/robustness pass — renderer + shell-loop bug fixes, accessibility fixes, a closed validation blind spot, a wire-normalization that removes a long-standing TS↔.NET asymmetry, and new parity coverage. Wire protocol token stays `viewmodel-shell/1.0` (all changes are additive or absent-vs-false normalizations; old agents/apps keep working). **Migration: effectively none** — one .NET raw-wire normalization noted below.

### Fixed
- **`fits` subtree was skipped by both tree validators** (`validateActionNames` / `validateSectionAction`, both backends). A `FitsNode` renders one candidate at runtime but ships every candidate on the wire, so two candidates sharing an action name — or a nested clickable `SectionNode.action` inside a `fits` — passed validation and shipped an ambiguous tree. Both walkers now descend into `fits` children. The exact same fix lands in the TS and .NET twins.
- **Focus + caret loss on re-render** for table filter inputs, tabs buttons, and standalone checkboxes. These interactive elements were created without a stable `id`, so the renderer's focus/caret-restore couldn't re-find them after a re-render — worst case, a `pollInterval` tick firing mid-keystroke while you type a table filter (the canonical workflow-table pattern) lost your focus and cursor. They now carry stable ids (`vms-tablefilter-{col}`, `vms-tab-{bind}-{value}`, `vms-checkbox-{name}`).
- **A side-effects-only / poll-keepalive response (`vm` omitted, no redirect) blanked the page.** The shell asserted `body.vm!` and rendered `undefined`. It now keeps the current view, updates state only if fresh state arrived, and still schedules the next poll — so "persist a flag and keep polling, don't rebuild the view" is a valid response shape.
- **A JSON action body missing `state` returned a 500 `uncaught_exception`** (the handler ran with undefined/null state and crashed). It now returns an actionable 400 `parse_error` in both backends (an empty object `{}` is still a valid state). The .NET `ParseJson` missing-`name` path is likewise normalized to `parse_error` to match TS.

### Fixed (accessibility)
- **`ProgressNode`** now renders `role="progressbar"` + `aria-valuemin/max/now`, and **clamps `value` to 0–100** (an out-of-range value previously overflowed the track or drew a negative-width bar).
- **`ImageNode`** always sets `alt` — an explicit `alt=""` for a decorative image (assistive tech skips it) rather than a missing `alt` (which may announce the src URL).
- **Unknown node types fail loud, not silent.** An unrecognized `n.type` (e.g. a newer server's node reaching an older client) now `console.warn`s instead of vanishing with no trace; sibling nodes still render (forward-compatible degradation).

### Changed
- **`.NET` optional bools drop their `false` default from the wire (F2).** `LinkNode.External`, `SectionLink.External`, `FieldNode.Required`, and `TableColumn.Sortable`/`Filterable`/`LinkExternal` now carry `[JsonIgnore(WhenWritingDefault)]`, so a `false` value is **absent** on the wire — matching the TS optional (`external?`, `required?`, …) and the framework's "unset optional = absent" contract (same posture `PreventUnload`/`Busy` already used). This removes a real TS↔.NET asymmetry: previously the .NET backend emitted `"external": false` while the TS backend omitted it, and every `*-bun` demo hand-wrote `external: false` / `required: false` purely to match the .NET side (94 such compensations removed across 6 demos).
- **The framework's own .NET test project (`viewmodel-shell-dotnet/Tests`) is back in the build + CI.** It had been uncompilable since 3.0.0 (a stale `ButtonNode.Variant` argument removed by the appearance-axes unification) because neither the documented green-tree gate nor `parity.yml` ran it. Both now do, so it can't silently rot again.

### Added (parity coverage)
- **`ModalNode`** is now rendered statically by the FeatureProbe demo on every GET, so the full modal wire shape (title/children/footer/dismissAction/size) is byte-diffed across all backends (it was previously gated behind a state flag no fixture ever opened — zero cross-backend coverage).
- **`invalid_tree`** (duplicate-action-name → 500) now has a parity fixture step, asserted byte-identical across backends — which is the proof the two hand-mirrored tree validators agree on the error message, not just the status.

### Docs
- Corrected the npm README's .NET setup (it pointed at a deleted `demo/Tasks/AspNetCore/ViewModels.cs` — now the NuGet package).
- AGENTS.md: gotcha #4 uses `Tone:"danger"` (the removed `"error"` style); documents the first-class `rejected`/`WithRejection` soft-validation channel; gotcha #8 reflects the F2 `WhenWritingDefault` rule and drops the nonexistent `CheckboxNode.Checked` example; the "Draft value preservation" note now describes the bind model (selects ARE preserved); GET wire shape shows `ok:true`; stale version anchor + a dead test-file path corrected.
- `ListItemNode.state` TSDoc/.NET comment corrected to the four list-item states actually shipped (`active/done/disabled/high`); a `running` style is TableRow-only for now.

### Migration
**Apps: none.** Both backends keep the same node types, wire token, and public API. The single behavioral note is for anyone parsing the **raw .NET JSON** directly: the optional bools above are now **absent when false** instead of `"field": false`. Absent and `false` are semantically identical for these fields (and the typed/`viewmodel-shell` clients already treat them so), so no change is needed unless you string-matched a literal `"external": false` / `"required": false` etc. in the raw wire.

---

## 3.2.1 / — Fix: inline-form submit button bottom-aligns (npm only)

**npm:** `3.2.1` (PATCH) · **NuGet:** unchanged (`3.2.0`). CSS-only bugfix ([#23](https://github.com/ashley-shrok/ViewModelShell/issues/23)); no wire/type change, no .NET change. **Migration: none.**

### Fixed
- **`.vms-form--inline` submit button no longer top-anchors.** The inline form preset bottom-aligns its row (`align-items: flex-end`) so the submit lines up with the field inputs (labels sit above), but the base `align-self: flex-start` on `.vms-button` and `.vms-form__buttons` escaped that (an item's `align-self` beats the parent's `align-items`) — leaving the submit hanging from the top while the fields sat at the bottom. Added `.vms-form--inline > .vms-button, .vms-form--inline > .vms-form__buttons { align-self: auto }` (the child combinator scopes it to the form's own submit / buttons-row, not buttons nested elsewhere), the same override the modal footer already applies. Restores the documented "submit lines up with the input" behavior and lets inline filter bars use a real `FormNode` with an implicit submit — preserving native Enter-to-submit — instead of the buttons-outside-the-form workaround.

### Migration
None — purely a CSS alignment fix for the inline form preset; nothing else changes.

---

## 3.2.0 / 3.2.0 — Child-side layout modifiers: alignSelf + maxWidth (npm + NuGet)

**npm:** `3.2.0` (MINOR) · **NuGet:** `3.2.0` (MINOR). Two additive `SectionNode` fields. Wire protocol token stays `viewmodel-shell/1.0` (additive node fields; old agents/apps unaffected). **Migration: none.**

### Added
- **`SectionNode.alignSelf?: "start" | "center" | "end"`** — per-child cross-axis self-alignment, the child-side counterpart to the parent-level `align`. Maps to CSS `align-self`; in the default flex-column stack the cross axis is horizontal, so `start`/`center`/`end` = left/center/right, overriding the parent's alignment for one section. Emits `.vms-self--{value}`. Omitted = inherits parent alignment (byte-identical to today). (Mirrors CSS `align-self` / Jetpack Compose `Modifier.align` / SwiftUI `.frame(alignment:)`.)
- **`SectionNode.maxWidth?: "half" | "two-thirds" | "three-quarters" | "prose"`** — a bounded content-width cap (closed token set, never raw CSS → passes the P2 gate), implemented with `max-inline-size`. Fractional values are proportional to the container (50% / 66.6667% / 75%); `prose` caps at the readable measure (`min(65ch, 100%)`, the Tailwind `max-w-prose` / Every-Layout `--measure` cap). The section still shrinks to content below the cap. Emits `.vms-maxw--{value}`. Omitted = no cap (today's full-width behavior). Intrinsic, zero `@media` → passes P1.

### Why
These are the two per-child modifiers mature frameworks universally use to express aligned, width-capped content. Together they compose a **chat transcript** — a flex-column stack of `variant:"card"` bubbles, each `alignSelf:"start"|"end"` + `maxWidth:"three-quarters"` + `tone` by sender — with **zero app CSS**, plus prose columns and centered narrow groups. Per the framework's compose-don't-special-case rule there is **no `ChatBubble` node**: general-purpose design systems build chat from `align-self` + `max-width`, so VMS does too. Also substantially satisfies the formerly-deferred nestable center+measure-cap (`alignSelf:"center"` + `maxWidth:"prose"`). `SectionNode` only in this release; broadening to other node types is additive-future.

### Migration
None — both fields are optional and additive; omitting them is byte-identical to 3.1.0.

---

## 3.1.0 / 3.1.0 — Admin-shell primitives: button width, divider, form submitButton (npm + NuGet)

**npm:** `3.1.0` (MINOR) · **NuGet:** `3.1.0` (MINOR). Three additive features (issue #22). Wire protocol token stays `viewmodel-shell/1.0` (additive node fields + one new node type; old agents/apps unaffected). **Migration: none.**

### Added
- **`ButtonNode.width?: "auto" | "full"`** (+ `CopyButtonNode.width`) — the standard full-width / "block" button (MUI `fullWidth`, Ant `block`, Chakra `width="full"`). `"full"` emits `.vms-button--full { align-self: stretch; width: 100% }`, so a form submit lines up with a column of `width:100%` inputs. Orthogonal to `emphasis`/`tone`/`size`.
- **`DividerNode { type:"divider", orientation?: "horizontal" | "vertical" }`** — the standard separator (MUI/Ant `<Divider>`, Radix `<Separator>`). Horizontal → `<hr class="vms-divider">` (implicit `role="separator"`); vertical → a `role="separator"` div with `aria-orientation="vertical"` for row layouts.
- **`FormNode.submitButton?: ButtonNode`** — full control of the submit button (its `label` + `emphasis`/`tone`/`size`/`width`/`pendingLabel`) instead of synthesizing one from `submitLabel`. The form fires `submitButton.action` on click, native Enter-submit, and textarea Enter. Mirrors the universal "write your own submit button" pattern (so a full-width submit is `submitButton:{ …, width:"full" }`). **Precedence:** when set, `submitLabel`/`submitAction` for the implicit button are ignored.

### Resolved
- **#21** (clickable URL cards) was already delivered by `SectionNode.link` (1.5.0); closed.

---

## 3.0.2 — Standardized form-control height (npm only)

**npm:** `3.0.2` (PATCH) · **NuGet:** unchanged at `3.0.0` (CSS-only; no API/wire change). **Visual change to control heights across all apps.**

Inputs/selects and buttons placed in a row (the filter-bar / toolbar pattern) didn't line up: `.vms-field__input` uses `--vms-text-md` (1rem) and `.vms-button` uses `--vms-text-base` (0.875rem) with the same padding, so with the browsers' `normal` line-height a button computed ~2–3px shorter than the input next to it. Now both default-size controls share an **absolute** `line-height` (new `--vms-control-line: 1.5rem` token), so — with their already-matching padding + border — an input and a button compute to the **same height** and align pixel-for-pixel in a row. The token is on the `--vms-*` override seam (retune control height in one place). The `--sm`/`--lg` button sizes and the compact inline list-item delete-X set their own line-height so they stay proportionate (not control-height). No markup or wire change; purely the shipped `default.css`.

**npm:** `3.0.1` (PATCH) · **NuGet:** unchanged at `3.0.0` (frontend-only — the .NET backend types and the wire are untouched). No API change.

`BrowserAdapter.render` restored window scroll with an unconditional `window.scrollTo(x, y)`. Under jsdom (vitest) that triggers a noisy `Not implemented: window.scrollTo` virtual-console log on every render — harmless (it doesn't throw; tests pass) but it pollutes test output. The call is now guarded to run only when the page was actually scrolled (`winScrollX !== 0 || winScrollY !== 0`) — restoring to (0,0) is a no-op anyway, and jsdom never scrolls, so the log is gone. Mirrors the existing `el.scrollTop !== 0` element-scroll guard. (Note: a `typeof window.scrollTo === "function"` guard would NOT have worked — jsdom defines `scrollTo` as a function that logs not-implemented.)

---

## 3.0.0 / 3.0.0 — Unified appearance axes (npm + NuGet) — BREAKING

**npm:** `3.0.0` (MAJOR) · **NuGet:** `3.0.0` (MAJOR). The overloaded `variant` field — which was doing four unrelated jobs across the node tree — is split into orthogonal, composable axes so **no field carries two concepts**. Wire protocol token stays `viewmodel-shell/1.0` (the dispatch/state/response envelope is unchanged; only node field *shapes* change — an agent that reads `{vm, state}` and dispatches actions is structurally unaffected, though code that hardcoded the old field names must update).

**Why:** `ButtonNode`/`CopyButtonNode` `variant: "primary"|"secondary"|"danger"` fused **emphasis** (how loud) with **intent** (what it means), and the CSS silently leaked **size** into it (`--primary` had wider padding, `--secondary` a smaller font) — so a primary and a danger button rendered at *different sizes*. `ListItem`/`TableRow` freeform `variant` mixed **severity** (`critical`/`warning`/`success`) with row **state** (`active`/`done`/`moving`/`running`/`disabled`/`high`). `TextNode` `style` fused **typography** with **intent color** (`error`/`warning`). Every mature design system (MUI, Chakra, Ant) keeps these as separate composable axes; the universal rule even the "fused" systems honor is that *size is never baked into the color/variant*.

### The unified model (one job per field)
| Axis | Field | Values | Lives on |
|---|---|---|---|
| Intent/severity | `tone` | `danger \| warning \| success \| info` | Button, CopyButton, Section, TextNode, ListItem, TableRow |
| Emphasis | `emphasis` | `primary \| secondary` | Button, CopyButton |
| Size | `size` | `sm \| lg` (omit = md) | Button, CopyButton |
| Surface kind | `variant` | `card` | Section (now the single meaning of "variant") |
| Typography | `style` | `heading \| subheading \| body \| muted \| strikethrough \| pre` | TextNode |
| Row/item state | `state` | freeform (framework-styled: `active`/`done`/`disabled`/`high`/`running`/`moving`) | ListItem, TableRow |

`tone` reuses the existing AA-cleared tokens (`--vms-error`/`-warning`/`-success`/`-info`); `critical` everywhere maps to `danger`. Axes compose: `emphasis:"primary" + tone:"danger"` is a filled red button; `variant:"card" + tone:"warning"` is a warning-tinted status card; a row can be `state:"active"` and `tone:"danger"` at once.

### Removed / renamed (BREAKING)
- **Button/CopyButton `variant`** → `emphasis` (primary/secondary) + `tone` (danger) + new `size`. The CSS is normalized so emphasis/tone never change box metrics — only `size` does.
- **ListItem/TableRow `variant`** → `state` (lifecycle) + `tone` (severity). `critical` → `tone:"danger"`.
- **TextNode `style:"error"`/`"warning"`** → `tone:"danger"`/`"warning"`; `style` keeps typography only.
- **Section** gains `tone` (additive); `variant:"card"` unchanged.
- CSS: `.vms-text--error` renamed to `.vms-text--danger`; new `.vms-button--{sm,lg}` size classes, `.vms-section--{tone}` and `.vms-button--{tone}` classes; the `.vms-table__row--critical` alias dropped (use `--danger`).

### Migration
See MIGRATION.md for the full old→new map. Mechanical: rename the field per the table above (the compiler / `tsc` flags every call site). Apps that never set these fields are unaffected.

---

## 2.1.0 / 2.1.0 — `LinkNode.active` (npm + NuGet)

**npm:** `2.1.0` (MINOR) · **NuGet:** `2.1.0` (MINOR). One additive change: links can now mark themselves as the current location ("you are here") for navigation. Wire protocol token stays `viewmodel-shell/1.0` (one new optional node field; omitting it is byte-identical to before). **Migration: none** — purely additive.

### Added
- **`LinkNode.active?: boolean`** (TS) / **`Active` `bool?`** (.NET, `[JsonIgnore(WhenWritingNull)]`). When `true`, the renderer emits `.vms-link--active` (solid accent underline + 600 weight in the shipped CSS) and sets `aria-current="page"` for assistive tech. **Server-owned** — the backend decides which nav item is current from its own route/state; there is no client-side route matching (consistent with every other view decision). Absent/false = not active.
- The canonical navbar examples in the Showcase ("Header bar" + the dashboard header) and the FeatureProbe parity twins now mark their current item active. The FeatureProbe coverage is static view-shape captured by the existing GET steps (mirrors the 1.11/1.12 row-addition precedent — no new fixture step), so the byte-identical cross-backend diff covers the new field.

### Changed (CSS)
- **The `row` layout preset now declares its own gap** (`--vms-space-lg` = 1.5rem, up from the inherited `--vms-space-sm` = 0.75rem). Horizontal clusters (navbars, toolbars, header rows) read cramped at the tight vertical rhythm; this is the one place `row` overrides the inherited section gap. Affects every `layout:"row"` section. No wire change; CSS-only. If you relied on the tighter spacing, override `--vms-space-lg` on the row via the `--vms-*` token seam.

---

## 2.0.0 / 2.0.0 — Remove `SectionNode.flyout` (npm + NuGet) — BREAKING

**npm:** `2.0.0` (MAJOR) · **NuGet:** `2.0.0` (MAJOR). A single breaking change: the `SectionNode.flyout` overlay-disclosure primitive is **removed entirely** (TS field, .NET `Flyout`, the renderer branch, the `.vms-section--flyout`/`__trigger`/`__panel` CSS, and the dedicated test).

**Why:** `flyout` was a hover-reveal overlay added in 1.11.0 for navbar submenus, but its only consumer abandoned it over an unfixable CSS hover-gap bug (moving the pointer to the revealed panel across a gap closed it), and it overlapped awkwardly with the more robust `collapsible` (inline disclosure), `modal` (overlay content), and "navigate to a sub-page" patterns. It didn't earn its place next to the intentional, robust primitives the Layout policy now governs.

### Removed
- **`SectionNode.flyout?: boolean`** (TS) / **`Flyout`** (.NET) and all rendering, CSS, and tests for it.
- The section disclosure-precedence is now **`collapsible > link > action`** (was `collapsible > flyout > link > action`).

### Migration
- If you used `flyout: true`: switch to **`collapsible: true`** (inline disclosure, robust on touch/keyboard), a **`modal`** (for overlay content), or — for a navbar submenu — a **`link`/card-link to a sub-page** (what the original consumer settled on). See MIGRATION.md.
- Not changed: the wire-driving protocol token stays `viewmodel-shell/1.0` (dispatch/state/response envelope is unchanged — only one optional node field was removed; agents reading `{vm, state}` are unaffected). Every other node, field, and the entire 1.12 layout vocabulary is untouched.

---

## 1.12.0 / 1.10.0 — Layout System Completeness (npm + NuGet)

**npm:** `1.12.0` (MINOR) · **NuGet:** `1.10.0` (MINOR). One consolidated, additive release for the whole v1.12 "Layout System Completeness" milestone — alignment enums (`arrange`/`align`), the `switcher` primitive, the `cards` `minItem` field, and the `fits` node — grounded in a 4-framework research synthesis (`.planning/design/layout-system-research.md`) and governed by the new **Layout policy** (AGENTS.md). Wire protocol token stays `viewmodel-shell/1.0` (all additive optional fields/nodes; omitting any of them is byte-identical to before). The whole layout vocabulary was human-verified in a browser before release (see **Review fixes** below). **Migration: none** — purely additive.

### Review fixes (pre-release visual verification)

The milestone closed with a human review of every primitive in a real browser (the `fits` selection and the CSS flip behaviors are not unit-testable in jsdom, which has no layout engine — only a person resizing a window can verify them). Two real framework bugs surfaced and were fixed before publish:

- **`switcher` was permanently stacked at every width.** `.vms-*--switcher` set `display:flex` + `flex-wrap:wrap` but inherited the base `.vms-page`/`.vms-section` `flex-direction: column`, so the negative-`flex-basis` flip ran on the vertical axis and never produced the horizontal row. Fixed by adding the `flex-direction: row` override (which `row`/`sidebar` already had). A regression guard (`test/layout-flex-direction.test.ts`) now asserts every horizontal-flow preset declares the override.
- **`fits` always selected the first candidate.** The measure-and-pick rendered each candidate inside the full-width container and tested `scrollWidth > clientWidth` — but a flex-wrap candidate *wraps* instead of overflowing, so it never exceeded `clientWidth` and always "fit". Fixed to measure each candidate's **intrinsic (max-content) width in an off-screen probe** and compare against the available box — the correct `ViewThatFits` semantics. Documented scope: `fits` is for selecting between layouts of **bounded** intrinsic width (toolbar ↔ menu, compact ↔ full controls), not text-heavy multi-column panes (a paragraph's max-content width is unbounded) — those use `split`/`sidebar`'s own intrinsic collapse.

### Alignment enums (`arrange` / `align`) on the `row` layout — Phase 8 (on `main`, unpublished)

Additive `arrange` (`start|center|end|space-between|space-around|space-evenly` → `justify-content`) and `align` (`start|center|end|stretch|baseline` → `align-items`) closed-union fields on `PageNode` / `SectionNode` (TS), mirrored as `Arrange`/`Align` nullable string fields on both .NET records (both carry `[JsonIgnore(WhenWritingNull)]`).

The `arrange`/`align` follow-up flagged in 1.11.0's deferred list, now shipped — closing out the PBMInvoices/Pantheon header-bar request via the general primitive rather than a bespoke navbar node. The values are copied verbatim from the declarative-native toolkits (Jetpack Compose `Arrangement` ∩ Flutter `MainAxisAlignment` for `arrange`; Flutter `CrossAxisAlignment` for `align`), the framework families' point of exact agreement. This is the first field landed under the new **Layout policy** (AGENTS.md "### Layout policy" / `.planning/design/layout-system-research.md`): both pass the governing P1 (intrinsic, zero viewport breakpoints) + P2 (closed enum) test.

### Added

- **`arrange?`** on `PageNode` / `SectionNode` — closed union `"start" | "center" | "end" | "space-between" | "space-around" | "space-evenly"`, mapped to `justify-content` (main-axis distribution). Emits `.vms-arrange--{value}`.
- **`align?`** on `PageNode` / `SectionNode` — closed union `"start" | "center" | "end" | "stretch" | "baseline"`, mapped to `align-items` (cross-axis alignment). Emits `.vms-align--{value}`.
- Both are intended for `layout:"row"` (the cluster primitive). The canonical header-bar is `arrange:"space-between"` on a `row` with a heading **`TextNode`** as its first child (NOT `PageNode.title`/`SectionNode.heading`, which keeps its full-width rule) + a nested `row` nav cluster — title-left / nav-right with zero app CSS, no bespoke node. **.NET `Arrange`/`Align` are free-form `string?`** (closed union enforced TS-side + validated by parity), mirroring the existing `Layout`/`Width` pattern.

### Not changed

- No wire-shape change; protocol token stays `viewmodel-shell/1.0` (additive optional fields). `agent-skill.md` / `AgentSkill.md` untouched (the wire protocol / response envelope is unchanged; new ViewNode fields don't touch it). **Omitting `arrange`/`align` is byte-identical to today** — no class is emitted, so `justify-content` stays the row default (`flex-start`) and `align-items` stays the row default (`center`).

### Demo + tests

- **FeatureProbe** twins (`FeatureProbe-bun/handler.ts` + `FeatureProbe/AspNetCore/FeatureProbeController.cs`) render a bare `row` (neither field) + the canonical header-bar + one section per remaining `arrange` value and per `align` value; the existing `feature-probe` GET steps capture them, so both backends emit byte-identical wire (cross-backend parity verified).
- `viewmodel-shell/test/theme-modifiers.test.ts` asserts class emission for every enum value on both page and section, the byte-identical-when-omitted property (bare `row` carries no `vms-arrange--`/`vms-align--`), and emission on the non-base section branches (collapsible/flyout/link).
- The **Showcase** (`demo/Showcase/frontend/src/main.ts`) demonstrates the header-bar (`row` + `arrange:"space-between"` + heading TextNode first child + nav cluster) and an `align`-value matrix, built only from ViewNodes.

### Migration

- **None needed** — purely additive optional fields. Existing trees, callers, and agents are unaffected.

### Switcher + cards minItem — Phase 9 (on `main`, unpublished)

The two layout-completeness primitives the survey identified a grid provably cannot express, landed under the **Layout policy**. **`switcher`** is the headline: a new `layout` value where N equal items flip **all-row ↔ all-stack atomically** at a content-width `threshold` — never the awkward "2-then-1" intermediate state `cards` auto-fit passes through. It's pure CSS (the Every-Layout negative-`flex-basis` trick: children get `flex-basis: calc((threshold - 100%) * 999)`, clamped to one row above the threshold and to full lines below it), **zero `@media` queries**, intrinsic by container width. Alongside it, **`cards` `minItem`** promotes the previously CSS-only `--vms-card-min` token to declared server intent — the auto-fit minimum track width becomes a bounded wire field instead of a hidden CSS variable. (Phase 9 Wave 1 shipped `switcher`/`threshold`/`limit`; Wave 2 added `minItem` + the demos/docs/CHANGELOG.)

### Added

- **`layout: "switcher"`** on `PageNode` / `SectionNode` — the atomic row↔stack flip primitive (negative-flex-basis, zero breakpoints). Emits `.vms-page--switcher` / `.vms-section--switcher`. **.NET `Layout` is already a free-form `string?`**, so this is a TS-union + CSS addition.
- **`threshold?`** on `PageNode` / `SectionNode` — the switcher flip width, a closed size scale `"sm" | "md" | "lg" | "xl"` → 20 / 30 / 40 / 48rem (md = the 30rem default). Emits `.vms-switch--{token}` which sets `--vms-switch-threshold`.
- **`limit?`** on `PageNode` / `SectionNode` — the switcher OPTIONAL max-items-per-row count cap, a bounded numeric union `2 | 3 | 4 | 5 | 6 | 7 | 8` (TS) / `int? Limit` (.NET). Once the child count exceeds `limit`, every child goes full-width regardless of container width (a static `:nth-last-child` quantity query per allowed `n`). Emits `.vms-switch-limit--{n}`.
- **`minItem?`** on `PageNode` / `SectionNode` — for `layout:"cards"`, overrides the auto-fit minimum track width (today's fixed `--vms-card-min: 16rem`); a closed size scale `"xs" | "sm" | "md" | "lg" | "xl"` → 10 / 13 / 16 / 20 / 24rem (md = today's default). Emits `.vms-cards-min--{token}` which sets `--vms-card-min`; the existing `repeat(auto-fit, minmax(min(var(--vms-card-min),100%),1fr))` cards rule reads it unchanged. A smaller token packs more, narrower columns; a larger token yields fewer, wider ones.
- **.NET `Threshold`/`MinItem` are free-form `string?`, `Limit` is `int?`** (the closed unions/bound are enforced TS-side + validated by parity), all carrying `[JsonIgnore(WhenWritingNull)]`, mirroring the existing `Layout`/`Arrange`/`Align` pattern.

### Not changed

- No wire-shape change; protocol token stays `viewmodel-shell/1.0` (additive optional fields + a new closed-union `layout` value). `agent-skill.md` / `AgentSkill.md` untouched (the wire protocol / response envelope is unchanged; new ViewNode fields don't touch it). **Omitting any of `threshold` / `limit` / `minItem` is byte-identical to today** — no class is emitted, so the switcher keeps its 30rem default + no count cap and `cards` keeps its 16rem track default. The auto-fit `cards` rule itself is untouched.

### Demo + tests

- **FeatureProbe** twins (`FeatureProbe-bun/handler.ts` + `FeatureProbe/AspNetCore/FeatureProbeController.cs`) render the switcher vocabulary (a bare switcher proving omitted = absent, one per `threshold` value, one with `limit:4` over 6 children) and the cards `minItem` matrix (a section-level bare `cards` proving omitted = absent, one section per `minItem` value); the existing `feature-probe` GET steps capture them, so both backends emit byte-identical wire (cross-backend parity verified).
- `viewmodel-shell/test/theme-modifiers.test.ts` asserts class emission for every `threshold` / `limit` / `minItem` value on both page and section, the byte-identical-when-omitted property (bare switcher carries no `vms-switch--`/`vms-switch-limit--`; bare cards carries no `vms-cards-min--`), and emission on the non-base section branches (collapsible / flyout).
- The **Showcase** (`demo/Showcase/frontend/src/main.ts`) demonstrates the switcher atomic flip (~4 equal cards in one row → all stack on resize, with a `threshold:"sm"` variant) and the `cards`/`minItem` width matrix (`sm` / `md` / `xl` side-by-side), built only from ViewNodes (zero `<style>`).

### Migration

- **None needed** — purely additive optional fields (+ one additive closed-union `layout` value). Existing trees, callers, and agents are unaffected.

### Fits node — Phase 10 (on `main`, unpublished)

The **`fits` node** — SwiftUI `ViewThatFits` ported to the wire. The one genuinely novel borrow this milestone, and the **ONLY non-pure-CSS layout primitive**: it renders the first child whose intrinsic size fits the available container, else the next, else the LAST (the guaranteed-fits fallback). Unlike every other layout primitive (all pure CSS), the choice is decided **CLIENT-SIDE at layout time via real measurement** — a `ResizeObserver`-driven measure-and-pick in `BrowserAdapter` — with **zero viewport breakpoints**. It generalizes the existing `split`→`stack` collapse to arbitrary alternatives: a wide toolbar row → a compact stacked version, a 3-column dashboard → a 1-column one, etc., switching live on container resize with no `@media` and no app code. It passes the governing **P1** test (intrinsic / zero-viewport-breakpoint — the selection is container-relative, not viewport-relative); **P2** (closed enum) applies to its `axis` field.

### Added

- **`FitsNode`** — a new `ViewNode` (`type:"fits"`, `axis?:"horizontal" | "vertical" | "both"` [omitted = `"horizontal"`, the dominant case], ordered `children`) in the TS `ViewNode` union, mirrored as a .NET `FitsNode` record + `[JsonDerivedType(typeof(FitsNode),"fits")]` discriminator (`Axis` free-form `string?` with `[JsonIgnore(WhenWritingNull)]`, `Children` required). **Children ordering convention: preferred/widest FIRST → safe-fallback/narrowest LAST** (same direction as SwiftUI `ViewThatFits`) — the renderer picks the first that fits; the last is the guaranteed-fits fallback.
- **The `browser.ts` measure-and-pick renderer** — `BrowserAdapter.fits()`: a full-width `<div class="vms-fits">` whose observed width is parent-driven. For each candidate in order it measures the candidate's **intrinsic (max-content) size in an off-screen, hidden probe** (`width: max-content` for the horizontal axis; for vertical, the probe is constrained to the available width and its height is measured) and compares that against the container's available box, picking the first that fits (the last is the fallback). Measuring intrinsic — not constrained — size is the crux: a flex-wrap candidate shrinks/wraps to fit any width, so its *rendered* `scrollWidth` never exceeds `clientWidth` and it would always appear to "fit". The probe is appended for correct style inheritance but kept off-screen and does not change the container's border-box, so it can't feed back into the observer. Selection is synchronous → the browser paints only the final choice (no flash). A `ResizeObserver` re-runs the pick when the container box changes; observers are tracked in a per-render `fitsObservers` array disconnected at the top of `render()` so they never leak.
- **The no-layout fallback** — when `container.clientWidth === 0` (jsdom / SSR / detached / `display:none`), the renderer renders ONLY the LAST child (the safe fallback) and returns; measurement is unavailable.
- **The minimal `.vms-fits { display: block; }`** structural rule (full-width block so the observed width is parent-driven; no visual styling — `fits` is a structural selector).
- **The TUI degradation (FITS-02)** — `tui.tsx` renders a `fits` node as its **LAST child** via the existing node renderer (a terminal has no pixel fit, so the guaranteed-fits candidate is correct); the three container-aware walks (pane counting / focus targeting) treat a `fits` node as a transparent wrapper around its last child only, matching what is rendered. The TUI is `@experimental`; the requirement is only that `fits` doesn't break it and degrades sensibly.

### Not changed

- No wire-shape change; protocol token stays `viewmodel-shell/1.0` (a new optional-field-bearing ViewNode is additive). `agent-skill.md` / `AgentSkill.md` untouched (the wire protocol / response envelope is unchanged; a new ViewNode doesn't touch it). The core `index.ts` gains the **TYPE only** — all measurement (`ResizeObserver` + DOM reads) lives in `browser.ts`, so the `check:core-globals` guard stays green.

### Demo + tests

- **FeatureProbe** twins (`FeatureProbe-bun/handler.ts` + `FeatureProbe/AspNetCore/FeatureProbeController.cs`) render a `fits` with `axis` omitted (proving omitted = absent on the wire) and a `fits` with `axis:"both"` (present as `"both"`), each with preferred-first/fallback-last candidate children; the existing `feature-probe` GET steps capture them, so both backends emit byte-identical `{type:"fits", axis?, children}` wire (cross-backend parity verified). **The client-side measure-and-pick selection is browser-only and explicitly NOT part of parity** — parity proves only identical serialization.
- `viewmodel-shell/test/fits.test.ts` covers structure (`.vms-fits` container), the no-layout last-child fallback, `axis` acceptance for all three values + omitted, and the `ResizeObserver` lifecycle (one observer registered per container; disconnected on the next render). It documents that the real measure-and-pick selection is **jsdom-untestable** (no layout engine) and is verified by the Phase 11 human review.
- The **Showcase** (`demo/Showcase/frontend/src/main.ts`) gains a `fits` demo — a wide horizontal `row` toolbar (preferred) ↔ a compact stacked version (fallback), built only from ViewNodes (zero `<style>`).

### Migration

- **None needed** — a purely additive new node; existing trees, callers, and agents are unaffected (an agent that doesn't know `fits` simply ignores it; a non-browser adapter degrades to the last child). **Known v1 limitation:** a resize-triggered candidate switch rebuilds the `fits` subtree, so focus / caret / draft state inside a fits child may reset on a resize-switch (the framework's normal focus/scroll preservation still applies to server-driven re-renders; this is specifically the resize-switch path). Acceptable for v1.

## 1.11.0 / 1.9.0 — Horizontal `row` layout + Section `flyout` (overlay disclosure) (npm + NuGet)

**npm:** `1.11.0` (MINOR — additive layout value + `SectionNode.flyout`) · **NuGet:** `1.9.0` (MINOR — additive `SectionNode.Flyout`; `Layout` already free-form string).

Requested by the PBMInvoices/Pantheon (AitherCloud2) maintainer for an information-architecture reorg — replacing a 10-link "junk drawer" with a persistent top nav, reusable across Cloud2 apps (Metis, AitherIntelligence, Hermes). The original ask was three things (`NavBarNode`, `DropdownMenuNode`, badges); scoping reduced it to the **two genuinely-missing general primitives**. A navbar is then *composed* from them — a `row` of links with a `flyout` for the Admin menu — rather than baked in as a bespoke composite node. `NavBarNode`, badges, `active`, and `sticky` were all dropped (composable / deferred follow-ups).

### Added

- **`layout: "row"`** on `PageNode` / `SectionNode` — a left-aligned wrapping horizontal row; children hug their content. The general horizontal-row primitive that was missing (every prior horizontal layout was special-cased: `--form--inline`, `--table__bulk-actions`, `--stat-bar`, `--sidebar` app-shell). Emits `.vms-page--row` / `.vms-section--row`. No renderer change (the existing generic `.vms-*--{layout}` emission handles it); **.NET `Layout` is already a free-form `string?`, so this is a TS-union + CSS + TUI-`layoutProps` addition only.**
- **`SectionNode.flyout?: boolean`** (.NET `Flyout`) — an **overlay** disclosure, the hover/focus sibling of `collapsible`'s inline `<details>`. The `heading` becomes a focusable `<button class="vms-section__trigger">`; the `children` are wrapped in an absolutely-positioned `<div class="vms-section__panel">` revealed on `:hover` / `:focus-within`. **Pure CSS — no JavaScript, no state machine, no round-tripped open state.** Hover (desktop), tap-to-focus (touch), and Tab-to-trigger (keyboard a11y) all reveal it; it hides on blur / pointer-leave. Use it (rather than `collapsible`) when the revealed content should float over siblings instead of pushing them — e.g. a menu inside a `layout:"row"` bar. Headingless flyout uses the trigger label `"Menu"`.

### Behavior / precedence

- The section modes are mutually exclusive; the renderer resolves a fixed precedence and never combines them: **`collapsible` > `flyout` > `link` > `action`.** So `collapsible:true` wins if both are set, and a `flyout` section ignores `link`/`action`. This mirrors the existing parallel-optional-fields pattern on `SectionNode` (no new validation rule — invalid combos degrade deterministically rather than throwing).
- **TUI:** `layout:"row"` maps to a row flex container; `flyout` has no terminal overlay, so it **degrades to a plain labeled section** (children render inline) — `SectionView` ignores the flag, which is the correct graceful degradation (the information is still surfaced).

### Not changed

- No wire-shape change; protocol token stays `viewmodel-shell/1.0` (additive optional field + a new closed-union value). `agent-skill.md` / `AgentSkill.md` untouched (the wire protocol / response envelope is unchanged; new ViewNode fields don't touch it).

### Demo + tests

- **FeatureProbe** twins (`FeatureProbe-bun/handler.ts` + `FeatureProbe/AspNetCore/FeatureProbeController.cs`) render a `layout:"row"` section and a `flyout:true` section (each with `LinkNode` children); the existing `feature-probe` GET steps capture them, so both backends emit byte-identical wire (cross-backend parity verified).
- New `viewmodel-shell/test/section-flyout.test.ts` (trigger/panel structure, headingless fallback, class combination, collapsible-wins precedence, default-hidden computed style, reveal-rule presence) + `theme-modifiers.test.ts` row cases (class emission + computed `display:flex`/`flex-direction:row`) + a `conformance-fixtures.ts` row+flyout fixture (both adapters surface the items/trigger/panel children — proves the TUI degradation surfaces information).

### Deferred follow-ups

- A `justify` knob on `row` (brand-left / admin-right navbars), plus `LinkNode`/`ButtonNode` badges, `active` on `LinkNode`, and `sticky` on `SectionNode` — all clean additive follow-ups if the need is confirmed.

## NuGet 1.8.0 — `UseVmsShellStaticFiles()` so the SPA shell never gets browser-cached (NuGet)

**NuGet:** `1.8.0` (MINOR — additive `IApplicationBuilder` host helper) · **npm:** unchanged at `1.10.0` (.NET-only; ASP.NET hosting helper with no TS/Bun analog).

ASP.NET Core's `app.UseStaticFiles()` sets `ETag`/`Last-Modified` but no `Cache-Control`, so browsers apply heuristic freshness to a Vite-built SPA's **shell HTML**. Hashed asset bundles are content-addressed (a stale cached asset is harmless — the new build references a new filename), but the shell HTML keeps its URL across deploys, so a cached shell silently pins the *old* bundle: a deploy succeeds on the box yet the user still loads the previous build. Reported by the Pantheon/AitherIntelligence maintainer after exactly that — a shipped redirect change masked by a cached `index.html`.

### Added

- **`app.UseVmsShellStaticFiles(options?, noCacheSuffixes?)`** — a drop-in replacement for `app.UseStaticFiles()` that stamps **`Cache-Control: no-cache`** on served files whose name ends in one of `noCacheSuffixes` (default `[".html"]`). `no-cache` (not `no-store`): the shell is still cached but **revalidated every load** against the ETag `UseStaticFiles` already emits — a cheap `304` when unchanged, a full `200` right after a deploy. Hashed assets keep default caching. Composable (a caller's `OnPrepareResponse` runs first, then the no-cache rule) and configurable (pass e.g. `["html", "sw.js", "config.json"]` for other non-hashed, stable-URL files).
- Lives alongside `MapVmsAgentSkill` as a host-side convenience; the package already references `Microsoft.AspNetCore.App`, so no new dependency.

### Deliberately not done

- **No `no-store`, `Pragma`, or `Expires`** — `no-store` discards the 304 for no benefit; `Pragma`/`Expires` are HTTP/1.0 cruft modern browsers ignore.
- **No auto-`immutable` on hashed assets** — detecting a hash in a filename is fragile, and assets on default caching are already correct.
- **NuGet-only.** The npm/Bun backends serve statics per-framework (Hono `serveStatic`, `Bun.serve`); no shared helper fits and there's no demand — to be revisited if a TS consumer hits the same wall.

### Not changed

- No wire-format / ViewNode / protocol change; protocol token stays `viewmodel-shell/1.0`. npm package untouched.

## 1.10.0 / 1.7.0 — First-class soft-validation rejection on ok:true (`rejected.violations[]`) (npm + NuGet)

**npm:** `1.10.0` (MINOR — additive wire field + helpers) · **NuGet:** `1.7.0` (MINOR — additive `ShellResponse.Rejected` + `ShellRejection` + `WithRejection`).

VMS had two error channels and nothing between them: soft/domain validation went in a state field and returned `ok:true` (renders for a human, preserves input), while hard failures returned `ok:false` + `errors[]` (machine-detectable, but no view). For an **agent driving the wire** the manual says "check `ok`; `ok:false` carries `errors[]`; stop on `ok:false`" — so a *rejected* write (`ok:true`, no `errors[]`) was **indistinguishable from success**. "Save failed: targets must be non-negative" read as a successful write. This adds a first-class, machine-detectable soft-rejection signal that still re-renders.

### Added

- **`rejected: { violations: [{ path?, message, code? }] }`** on the `ok:true` response envelope — the action was refused but `vm`/`state` are still returned, so the form keeps the user's input. Distinct from `errors[]` **by design**: `ok:false` = "no view for you"; `ok:true` + `rejected` = "here's your view back, but the action did not take." An agent checks `rejected` **in addition to** `ok`.
  - Violations reuse the existing **`ErrorEntry`** `{ path?, message, code? }` shape — same vocabulary as `errors[]`. **`path` is optional**: present → field-bound; **absent → a form/action-level rejection** (e.g. "can't remove the only person").
  - **npm:** `ShellRejection` interface + `rejected?` on `ShellResponseBody` + helper `shellRejection(violations)` (spread into a normal re-render: `return { vm, state, ...shellRejection([...]) }`).
  - **NuGet:** `ShellRejection` record + `Rejected` (nullable, null-omitted) appended to `ShellResponse<TState>` + fluent `WithRejection(violations)` (`new ShellResponse<T>(vm, state).WithRejection([...])`).
- Documented in the agent manual (`agent-skill.md`, byte-copied to the .NET embedded `AgentSkill.md`): a dedicated "Soft rejections" subsection in the Response envelope section.

### Why / not changed

- **Does NOT overload `errors[]`/`ok:false`.** That channel stays welded to failures (and to the shell's `VmsActionError` → `onError` path), so existing `onError` consumers never fire on routine validation.
- **No shell behavior change.** The browser shell reads only the fields it knows and **ignores `rejected` harmlessly** — the human path already renders validation via the app's error TextNode; `rejected` is wire metadata for agents. Verified by a shell-side test (ok:true + rejected → normal render, `onError` not called).
- **Protocol token stays `viewmodel-shell/1.0`** — additive, backward-compatible (old agents that ignore `rejected` keep working; existing apps unaffected).

### Demo + tests

- **HelpDesk** twins (`RequesterController.cs` + `HelpDesk-bun/server.ts`) now attach `rejected` on the empty-title `create-ticket` path, coexisting with the existing `validationError` state — the canonical worked example. The existing `req-validation-empty` parity step exercises it; both backends emit byte-identical `rejected` (cross-backend verified).
- New `viewmodel-shell/test/rejected.test.ts` (emission present/absent, form-level no-path case, shell tolerance) + extended `RequesterControllerTests` (object-model + JSON null-omission).

### Follow-ups (deferred, by consensus)

- `FieldNode.error?: string` (first-class inline field errors) and an `onRejected` shell hook (typed-consumer parity + browser auto-populating field errors from `rejected.violations`). Additive; a later release.

## 1.9.0 / 1.6.0 — Opt-in Enter-to-submit on textareas + modals no longer re-flash (npm + NuGet)

**npm:** `1.9.0` (MINOR — additive wire field + a default styling change) · **NuGet:** `1.6.0` (MINOR — additive `FormNode.SubmitOnEnter` member on the .NET record).

Two changes ship together. (1) A new opt-in `FormNode.submitOnEnter` lets chat-style composers express "Enter sends, Shift+Enter newline" — previously impossible, since a `<textarea>` eats Enter as a newline and never submits. (2) The modal backdrop's entry animation is removed, fixing a visible re-flash on every in-modal action.

### Added

- **`FormNode.submitOnEnter?: boolean`** (TS) / **`bool? SubmitOnEnter`** (.NET, appended as the last positional param with the standard null-omission attribute). When `true` **and** `submitAction` is set, a bare `Enter` keydown inside any descendant `<textarea>` dispatches `submitAction` via the exact submit-button path (harvest / files / pending-label semantics identical). **Modifier-Enter** (`Shift`/`Ctrl`/`Meta`/`Alt`) falls through to a normal newline, and an **IME-composition Enter** (`isComposing` / `keyCode === 229` — candidate confirmation) is never treated as a send, so CJK input is safe. **No-op** when `submitAction` is absent. Default (unset) is byte-identical to prior behavior. Form-level by design — it mirrors HTML's implicit-submit affordance; a form that also holds a code editor simply wouldn't set it.

### Changed

- **`.vms-modal-backdrop`** no longer carries `animation: vms-in 0.15s ease` (and the now-orphaned `@keyframes vms-in` is removed). The renderer rebuilds the whole tree on every dispatch (`innerHTML=""` + rebuild), so the backdrop was a fresh element each time and the entry animation **replayed on every in-modal action** — a dropdown/field change inside a modal made it visibly disappear and reappear. Removing the animation fixes the re-flash. **Trade-off:** modals no longer fade in on first open (they appear instantly). Apps that want the fade back can re-add the rule in an app stylesheet after importing the default CSS.

### Not changed

- **No wire-envelope, side-effect, error, or polling change.** The action envelope stays `{name}`-only — `submitOnEnter` is a renderer hint, not part of the dispatch payload. Protocol token stays `viewmodel-shell/1.0`; the agent skill is unchanged. Parity + skill-parity suites unaffected (the new field is additive and renderer-handled on the client).

### Tests

- New `viewmodel-shell/test/form-submit-on-enter.test.ts` (6 cases): bare Enter dispatches with the typed value in state; Shift/Ctrl/Meta/Alt+Enter do not; IME `isComposing` and `keyCode===229` do not; no-op without `submitAction`; default-unset stays inert.

## 1.8.0 — Input placeholders read as faint hints, not committed text (npm)

**npm:** `1.8.0` (MINOR — default styling change, no API/wire change) · **NuGet:** unchanged at `1.5.0` (CSS-only; no .NET surface touched).

Field placeholders were rendered with `--vms-text-muted` at full opacity (`#6c6c80` ≈ **5.1:1** on white in the default theme). That's high enough contrast that, in an empty field, the placeholder reads as real entered text — users reported mistaking empty inputs for filled ones, especially where an input has no visible label. Placeholders now derive from the theme's own text color at reduced strength (the browser-UA / Bootstrap mechanism), so they read as a faint hint and an empty field is unmistakable from a filled one.

### Changed

- **`.vms-field__input::placeholder`** now resolves to `color: var(--vms-text); opacity: 0.5` instead of `color: var(--vms-text-muted)`. Result ≈ **3.5:1** on light themes, and — because it's the theme text color faded by opacity rather than a fixed gray — it adapts correctly across all 12 light/dark themes with a single rule (themes override token values, not rules).
- This **decouples** the placeholder from `--vms-text-muted`, which is shared by labels/captions/table-meta and must stay AA-contrast. Those are unaffected.

### Trade-off (intentional)

- Placeholder contrast is now **below WCAG AA 4.5:1 by design** — matching the de-facto industry standard (browser default ~0.54 opacity, Bootstrap `rgba(text,.5)`, Tailwind `gray-400` ≈ 2.6:1). The rationale: a placeholder must never be the sole carrier of meaning — pair inputs with a `label`. The rule carries an in-source comment documenting this so it isn't "fixed" back. Apps that want the old high-contrast behavior can override the one rule in a `:root`/app stylesheet.

### Not changed

- **No wire-format, type, or API change.** Protocol token stays `viewmodel-shell/1.0`. Parity suite + skill parity unaffected (this is a stylesheet-only change).
- The 14 muted-text usages elsewhere (`--vms-text-muted`) keep their AA contrast.

## 1.7.0 — Per-row table checkboxes render in a leading column (npm)

**npm:** `1.7.0` (MINOR — default rendering change, no API/wire change) · **NuGet:** unchanged at `1.5.0` (renderer-only change; the .NET package gained only a doc-comment touch-up that rides along for the next functional release).

Per-row table controls (`TableRow.actions[]`, a mix of `ButtonNode` and `CheckboxNode`) used to all render into a single **trailing** cell on the right. Selection checkboxes therefore appeared on the far right — the opposite of the data-grid / Gmail convention where the selection checkbox leads the row. The BrowserAdapter now **partitions `actions[]` by type at render time**: `CheckboxNode` entries render in a dedicated **leading** column (left), `ButtonNode` entries stay in the **trailing** actions cell (right). Result: `| ☑ | Name | Status | [Edit] [Delete] |`.

### Changed

- **`BrowserAdapter` table renderer** — when any row carries a checkbox, every row gets a leading `vms-table__td--select` cell (empty for rows without one) and the header + filter rows get a matching leading `vms-table__th--select` so columns stay aligned. The trailing `vms-table__td--actions` cell now renders **buttons only**. Both cells keep the existing `stopPropagation` guard so toggling/clicking a control never also fires `row.action`.
- Reuses the already-shipped `.vms-table__th--select` / `.vms-table__td--select` CSS (authored for exactly this); **no stylesheet change**.

### Not changed

- **No wire-format change.** Backends keep emitting `actions[]` as one mixed array — the partition is purely client-side rendering. The protocol token stays `viewmodel-shell/1.0`.
- **No type change.** `TableRow.actions` is still `(ButtonNode | CheckboxNode)[]`; only its doc comment was updated (both TS and .NET sources).
- Parity is wire-only and unaffected (full 15-backend suite + skill parity green).

### Consumers

Nothing required — existing apps re-render with checkboxes on the left automatically. This is a visual-layout change, not an API break.

---

## 1.6.0 / 1.5.0 — Canonical agent skill + discoverability endpoint (npm + NuGet)

**npm:** `1.6.0` (MINOR — additive surface, new helper export from the `/server` subpath, new shipped markdown file) · **NuGet:** `1.5.0` (MINOR — additive surface, new `MapVmsAgentSkill` extension on `IEndpointRouteBuilder`, embedded resource for the canonical skill).

Both packages now ship a canonical markdown operating manual for the VMS wire protocol — the same content an LLM or curl-driven agent would need to drive a VMS app without a browser. A new optional `skill` field on the existing `<meta name="viewmodel-shell">` tag advertises where the skill is served; agents that know about it fetch it for the protocol manual, old agents ignore the unknown field. Mounting the endpoint is a one-liner on either backend. The skill IS the protocol manual: it documents action dispatch shape (JSON + multipart), state round-trip rules + bind paths, response envelope vocabulary (`ok`, `vm`, `state`, `redirect`, `sideEffects`, `nextPollIn`, `busy`, `preventUnload`), side-effect verbs + the forward-compat "silently ignore unknown" rule, error code vocabulary, polling cadence, file uploads, and protocol versioning. Tone is imperative and operational — the reader is an agent that needs to do work in the next 60 seconds.

### Added

- **`viewmodel-shell/agent-skill.md`** — the canonical agent skill markdown (shipped in the npm `files` array; embedded as a logical resource by the .NET package as `AshleyShrok.ViewModelShell.AgentSkill.md`; byte-identical between the two backends, parity-gated to prevent drift). Eleven sections in fixed order: What this is · Endpoints · Action dispatch shape · The round-trip rule · Response envelope · Side-effect verbs · Errors · Auth · Polling · Files · Versioning.
- **TypeScript helper `createAgentSkillHandler({appPreamble?})`** exported from `@ashley-shrok/viewmodel-shell/server` — returns a Web Fetch `(Request) => Response` handler. Compatible with Bun, Deno, Hono, Cloudflare Workers, Node 18+. Body cached at handler creation; per-request cost is a single `new Response(body)`.
- **.NET helper `AgentSkillExtensions.MapVmsAgentSkill(this IEndpointRouteBuilder, string path = "/.well-known/vms-skill.md", string? appPreamble = null)`** — minimal-API endpoint extension. Lazily loads the embedded resource ONCE at mount time and fails loud at startup (`InvalidOperationException`) if absent — the fail-loud rule applies, a silently-404'd skill endpoint would defeat the purpose.
- **Optional `skill` field on the existing `<meta name="viewmodel-shell">` JSON content.** Purely additive: omitting it is the pre-1.6.0 behavior; old apps and old agents both still work.
- **Per-app preamble support:** when `appPreamble` is supplied (non-empty after trim), the served body prepends the preamble under a `## App-specific notes` heading + `---` separator, then the canonical body verbatim. Apps use this to name their domain, auth specifics, or any context an agent should read before the protocol manual. Whitespace-only preamble is treated as no preamble.

### Demo migration

- **HelpDesk** (both .NET twin and bun twin) mounts the skill endpoint at `/.well-known/vms-skill.md` with a short help-desk-specific preamble naming the domain (requesters / agents / one SQLite DB / per-controller bind paths). Both `agent.html` and `requester.html` meta tags now carry the `skill` field. This is the worked example and the parity surface — `parity/check-skill.ts` GETs the URL from both backends and asserts byte-identical bodies + correct content-type + preamble plumbing.
- Other demos are unchanged. Future demos can adopt the mount via the one-liner per backend.

### Tests

- **New vitest suite `viewmodel-shell/test/agent-skill.test.ts`** (6 cases): handler returns 200 + correct content-type; canonical body verbatim when no preamble; preamble prepended under heading with separator; whitespace-only preamble treated as no preamble; idempotent across invocations; independent across handler instances.
- **New xUnit suite `viewmodel-shell-dotnet/Tests/AgentSkillTests.cs`** (6 facts): default-path 200 + canonical body verbatim; custom path 200 + default 404; preamble prepended; content-type `text/markdown; charset=utf-8`; empty/whitespace preamble omits header; `LoadCanonical` returns non-empty body containing the protocol token (proves the embedded resource is the real canonical skill, not a placeholder).
- **Parity gate:** `parity/check-skill.ts` runs after the JSON-fixture sweep — phase 1 diffs the npm + .NET source files byte-for-byte (catches a drifted .NET copy with a clear "Fix: cp …" message); phase 2 GETs the skill URL from both HelpDesk backends and asserts identical bodies + content-type + preamble substring. Wired into `parity/run.ts` after the existing fixture loop.

### Consumers

Additive — nothing required. No existing API changed; no existing wire shape changed; old apps without the meta-tag `skill` field continue to work; old agents that don't know about the field continue to work. Consumers that want to advertise a skill mount the helper + add the `skill` field; everyone else upgrades cleanly without code changes.

---

## 1.5.0 / 1.4.0 — SectionNode.link URL-wrapper clickable cards (npm + NuGet)

**npm:** `1.5.0` (MINOR — additive wire field; new TS optional field) · **NuGet:** `1.4.0` (MINOR — additive wire field on the SectionNode record + new SectionLink helper record)

Closes [issue #21](https://github.com/ashley-shrok/ViewModelShell/issues/21). `SectionNode.action` (1.4.0 / 1.3.0 — see entry below) covers the dispatcher case: clicking the card runs server-side work. When a card is conceptually a NAVIGATIONAL link (docs tile, gallery item, launcher tile, "View on GitHub" tile), nesting a `LinkNode` inside loses click-anywhere ergonomics, and using `.action` plus a server redirect loses every modifier-click affordance the browser would otherwise grant for free — middle-click new tab, Ctrl/Cmd-click new tab, Shift-click new window, right-click context menu, drag-to-bookmarks, status-bar URL preview, accessible link semantics. `SectionNode.link` is the navigator sibling of `.action`: the renderer emits a wrapping `<a href>` element so every one of those affordances works natively, no JS substitute needed (browsers implement them at the anchor-element level).

### Added

- **`SectionNode.link?: { url: string; external?: boolean }`** (TS) / **`SectionNode.Link: SectionLink?`** (.NET — with `SectionLink(string Url, bool External = false)` as a new positional helper record). When set, the BrowserAdapter creates an `<a>` element (instead of `<section>`), wires `href = link.url`, and (when `external: true`) adds `target="_blank"` and `rel="noopener noreferrer"` — mirroring `LinkNode`'s external-attribute pattern byte-for-byte. The heading still renders as `<h2 class="vms-section__heading">` inside the anchor. No `role="button"`, no `tabindex="0"`, no `aria-label` — the anchor element provides every link / keyboard / focus / a11y semantic natively. Containment: clicks on nested `ButtonNode` / `CheckboxNode` / `FieldNode` / `LinkNode` and cell `linkLabel` anchors INSIDE a linked card stop propagation so they don't trigger the wrapper anchor's navigation; for nested anchors the renderer additionally `preventDefault`s so a bubbled click cannot re-trigger the wrapper.
- **`.vms-section--linked` CSS class** with cursor + anchor color reset (`color: inherit`) + text-decoration reset (`text-decoration: none`) — without these the wrapper anchor would render with browser-default blue underlined heading text. Hover ring (`box-shadow: 0 0 0 1px var(--vms-accent-dim)`) and `:focus-visible` outline (`2px solid var(--vms-accent)` with positive `outline-offset: 2px`) mirror the `.vms-section--clickable` idiom. AA-contrast guard passes on the shipped default plus all 12 themes (the outline uses `--vms-accent`, the same token gated by the existing pair coverage).
- **Tree validation — four new rejections**, on top of the two from 1.4.0 / 1.3.0. All throw at the server edge with `code: "invalid_tree"` (500) so a server-built tree that violates any rule fails fast in dev rather than silently producing broken click-ownership or invalid HTML:
  - `action` + `link` on the same section — a `SectionNode` is either a dispatcher (action) or a navigator (link); they create different user expectations of what a click means. Pick one.
  - `link` + `collapsible: true` on the same section — same rationale as `action` + `collapsible`.
  - `link` nested inside another `link` — HTML5 prohibits nested `<a>` elements.
  - `link` nested inside `action` (and vice versa) — click-ownership in the overlap is ambiguous (a linked card inside a dispatcher card, or vice versa, creates two competing primary interactions).
- **`validateSectionAction` walk extended** (TS twin in `viewmodel-shell/src/server.ts` + .NET `ViewTreeValidation.ValidateSectionAction` in `viewmodel-shell-dotnet/ViewModels.cs`). The threaded ancestor parameter was renamed `outerClickable` → `outerInteractive` (semantic widening — "an ancestor section has either action OR link set"). The existing two rules (`action` + `collapsible:true`; nested `action`-in-`action`) are preserved unchanged; the action-in-action rule now also catches `action`-in-`link` due to the unified parameter, with a differentiated message.
- **TUI experimental adapter (`viewmodel-shell/src/tui.tsx`):** a focused pane whose section has `link.url` set is treated as link-actionable — pressing Enter dispatches `this.navigate(url)`, mirroring how `LinkNode` is handled at the pane level. Parity for the TUI experience at minimal cost.

### Demo migration

- `demo/Showcase/frontend/src/main.ts` (Dashboard archetype) gains a "Resources" cards strip with three external-link tiles ("Read the docs", "View on GitHub", "Report an issue") demonstrating `SectionNode.link` with real GitHub URLs.
- `demo/FeatureProbe/AspNetCore` and `demo/FeatureProbe-bun` gain a sibling `Linked card` section next to the existing `Clickable Card` (issue #20 — `SectionNode.action` parity). Cross-backend parity confirms both backends emit byte-identical wire including the new `link: { url, external }` shape on the SectionNode.

### Tests

- New `viewmodel-shell/test/section-link.test.ts` (10 jsdom cases) covers A external linked card emits `<a>` with href + target + rel; B internal (non-external) linked card omits target/rel; C className shape (`vms-section vms-section--linked`, NOT `--clickable`); D heading renders inside the anchor; E/F/G containment for nested Button / Checkbox / inner LinkNode (sentinel listener on the wrapper anchor never fires); H anchor element has no role / no tabindex / no aria-label; I backward-compat (section without link AND without action renders as `<section>`, no class drift, no href/target/rel); J combined `variant: "card"` + `layout: "split"` modifiers on the linked `<a>`.
- New `viewmodel-shell/test/tree-walker.test.ts` (8 cases) covers the four new rejections (link+action, link+collapsible, link-in-link, link-in-action / action-in-link) plus regression baselines (styling-only inner card inside both action and link cards still passes after the rename).
- `viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs` gains nine new `[Fact]`s: plain linked card passes, link+action throws, link+collapsible throws, three nesting throws (link-in-link, link-in-action, action-in-link), styling-only inner card passes, `SectionLink.External` defaults to false (record-shape pin to catch accidental default flips), and the `ShellResponse<TState>.Validate()` integration pin for the link case. The Tests project goes from 51 to 60 facts.

### Consumers

Additive — nothing to do. A `SectionNode` without `link` renders byte-identical to 1.4.0 / 1.3.0 (no `<a>` wrapper, no `vms-section--linked` class, no `href` / `target` / `rel`, no listeners). The wire stays absent when `link` is omitted (`JsonIgnore-on-null` on the .NET nullable; optional field in TS).

If you want to opt a card into URL-link navigation, set `link: { url: "...", external?: true }`. See `MIGRATION.md` § 1.5.0 / 1.4.0 for copy-pasteable TS + C# snippets plus the four mutually-exclusive combos the framework rejects.

---

## 1.4.0 / 1.3.0 — SectionNode.action clickable cards (npm + NuGet)

**npm:** `1.4.0` (MINOR — additive wire field; new TS optional field) · **NuGet:** `1.3.0` (MINOR — additive wire field, NuGet catches up from being unchanged in CSS-only npm 1.3.0)

Closes the unfixed half of [issue #19](https://github.com/ashley-shrok/ViewModelShell/issues/19) (per-button presentational hierarchy) via [issue #20](https://github.com/ashley-shrok/ViewModelShell/issues/20). A `SectionNode { variant: "card" }` is styling-only today; making the whole card clickable required an inner `ButtonNode` that split the click affordance from the surface. `SectionNode.action` adds the missing primitive without inventing new node types — mirrors `TableRow.action` (1.1.0) at the section level.

### Added

- **`SectionNode.action: ActionEvent`** (TS) / **`SectionNode.Action: ActionDescriptor?`** (.NET). When set, the BrowserAdapter makes the whole section clickable AND keyboard-activatable (Enter dispatches; Space `preventDefault`s page scroll then dispatches; Tab does NOT dispatch) AND exposes accessibility (`role="button"`, `tabindex=0`, `aria-label` derived from `heading` when set, else from joined descendant text capped at 200 chars, else fallback `"Card"`). Clicks on nested `ButtonNode` / `CheckboxNode` / `LinkNode` and cell `linkLabel` anchors INSIDE a clickable card stop propagation, so they never double-fire the card action. Per-section identity is encoded in the action name (e.g. `select-card-1`) — no `context` field, consistent with the Phase-6 wire.
- **`.vms-section--clickable` CSS class** with cursor + hover ring (`box-shadow: 0 0 0 1px var(--vms-accent-dim)` — the card already paints `--vms-surface` as its background, so a background swap would be invisible) + `:focus-visible` outline (`2px solid var(--vms-accent)` with positive `outline-offset: 2px` — the section is a box, the ring lives outside the edge). AA-contrast guard passes on the shipped default plus all 12 themes (the outline uses `--vms-accent`, the same token gated by the existing pair coverage).
- **Tree validation — two rejections.** Both throw at the server edge with `code: "invalid_tree"` (500) so a server-built tree that violates either rule fails fast in dev rather than silently producing broken a11y or ambiguous click ownership:
  - `action` + `collapsible: true` on the same section — the collapsible section's `<summary>` IS the click target; a clickable card makes the whole section the click target. Pick one.
  - Nested `SectionNode.action` — a clickable section inside another clickable section. Nested `role="button"` elements are an a11y violation, and click-ownership in the overlap is ambiguous. Use a styling-only `variant: "card"` (no `action`) inner section with internal buttons instead — that case is explicitly VALID.
- **`validateSectionAction` (TS) / `ViewTreeValidation.ValidateSectionAction` (.NET).** New exported tree walks; both are invoked alongside `validateActionNames` from the existing wire-edge validation seam (`createAction` in TS; `ShellResponse<TState>.Validate()` in .NET).

### Demo migration

- `demo/FeatureProbe/AspNetCore` and `demo/FeatureProbe-bun` gain a `Clickable Card` section that increments a `CardClickCount` counter on each click. Cross-backend parity confirms both backends emit byte-identical wire including the new `action` field on the SectionNode.

### Tests

- New `viewmodel-shell/test/section-action.test.ts` (12 jsdom cases) covers A click anywhere, B Enter, C Space + preventDefault, D Tab no-dispatch, E/F/G containment for nested Button/Checkbox/Link, H ARIA shape, I headingless aria-label derivation + empty fallback to `"Card"`, J backward-compat (a section without `action` has no class drift / no tabindex / no role / no aria-label — byte-identical to today's output), plus K + L validation rejections for `action` + `collapsible: true` and nested `action`-in-`action`.
- `viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs` gains six `[Fact]`s for the .NET twin: plain pass, action+collapsible throw, headingless label substitution, nested throw, styling-only inner card pass, and the `ShellResponse<TState>.Validate()` integration pin. The Tests project goes from 45 to 51 facts.

### Consumers

Additive — nothing to do. A `SectionNode` without `action` renders byte-identical to 1.3.0 (no `vms-section--clickable` class, no `tabindex`, no `role`, no `aria-label`, no listeners). The wire stays absent when `action` is omitted (JsonIgnore-on-null on the .NET nullable; optional field in TS).

If you want to opt a card into clickability, set `action: { name: "..." }`. See `MIGRATION.md` § 1.4.0 / 1.3.0 for copy-pasteable TS + C# snippets.

---

## 1.3.0 — Type-scale realignment to web-density norms (npm only)

**npm:** `1.3.0` (MINOR — visible default shift, no wire/API change) · **NuGet:** unchanged (CSS-only change, no .NET surface)

The shipped `default.css` type scale was a desktop-app-density set — `--vms-text-base` was `0.8125rem` (13px), so buttons, body text, checkboxes, and error/warning text all rendered at 13px. That reads as small on web/launcher pages, where users expect web-scale type (16px is the browser default, Tailwind/Bootstrap/Material body is 16px). The whole scale shifts up one rung to align with modern dense-productivity UIs (Linear, Notion, GitHub) — `--vms-text-base` is now `0.875rem` (14px). The shift originated in issue #19 (per-button size scale): the underlying complaint was "text feels small," not "buttons need a presentational `size` prop" — addressing it at the scale level resolves the root cause without adding a non-semantic node field.

### Changed

- **`--vms-text-*` tokens in `viewmodel-shell/styles/default.css`** bumped one rung each:
  | Token | Was | Now | px (at 16px root) |
  |---|---|---|---|
  | `--vms-text-xs` | `0.6875rem` | `0.75rem` | 11 → 12 |
  | `--vms-text-sm` | `0.75rem` | `0.8125rem` | 12 → 13 |
  | `--vms-text-base` | `0.8125rem` | `0.875rem` | 13 → **14** |
  | `--vms-text-md` | `0.875rem` | `1rem` | 14 → 16 |
  | `--vms-text-lg` | `1rem` | `1.125rem` | 16 → 18 |
  | `--vms-text-xl` | `1.375rem` | `1.5rem` | 22 → 24 |
  | `--vms-text-2xl` | `2.25rem` | `2.25rem` | 36 (unchanged) |
- **Spacing tokens (`--vms-space-*`) unchanged.** The complaint was about type, not gaps; bumping spacing would push every table row, section, and form taller without addressing the actual readability gap.
- **No node/wire/API change.** The fix lives entirely in shipped CSS; every `ViewNode` type, action payload, and emitted class name is byte-identical to 1.2.0. The parity suite emits the same JSON; the .NET package is not republished.

### Themes

- None of the shipped themes under `viewmodel-shell/styles/themes/` redefine `--vms-text-*` (only colors), so every theme picks up the new scale automatically. No theme-file changes were required.

### Consumers

- **Most apps: nothing to do.** Rebuild and the new scale ships through.
- **Apps that want to pin the old scale** (e.g. a dense admin tool that liked the 13px-base look): override all seven tokens in a per-app `:root{}` stylesheet imported after the theme. The exact override block is in `MIGRATION.md` § 1.3.0.
- **Apps that already retuned `--vms-text-base`** via the documented `--vms-*` override seam keep their override unchanged — the per-app `:root{}` value still wins over the new default.

### Issue resolved

- Closes the framing portion of #19 (ButtonNode.size). The presentational `size` prop is **not** added — it conflates "visual emphasis" (a structural concern best expressed via `SectionNode variant:"card"` tiles) with "type feels small" (the actual gap, now fixed at the scale level). Apps that need a single prominent launcher action should reach for the card-tile pattern; see `demo/Showcase/` archetype views for the canonical hierarchy idiom.

---

## 1.2.0 — SectionNode.collapsible (npm + NuGet)

**npm:** `1.2.0` (MINOR — additive wire field; new TS optional fields) · **NuGet:** `1.2.0` (MINOR — additive wire field, lockstep)

A new client-side aesthetic disclosure primitive on `SectionNode`. Apps can mark secondary content (e.g. HelpDesk "Agent Notes" beneath the ticket header) collapsible without inventing per-app JS, custom CSS, or a server-driven open/close protocol.

### Added

- **`SectionNode.collapsible: true`.** Renders the section as a native `<details>`/`<summary>` widget — closed on first render — with the heading promoted to the `<summary>` label. Open/closed state is DOM-local and the server does NOT round-trip it (intentional — same conceptual model as draft text values in unsubmitted form inputs). The renderer snapshots `<details>.open` before each re-render and restores it after, the same pattern already used for focus and scroll preservation. Keying: `id ?? heading ?? "vms-section-anon"`, disambiguated by per-render ordinal. Headingless collapsible sections use the documented fallback summary label `"Show details"`. Omitted/false renders byte-identical to 1.1.0 — existing call sites unchanged.
- **`SectionNode.id?: string`.** Optional stable preservation key for the renderer's open-state snapshot when `collapsible: true`. Use it when `heading` isn't unique within a page or is absent; otherwise the renderer falls back to the heading + per-render ordinal.

### Demo migration

- HelpDesk Agent ticket detail page (both `demo/HelpDesk/AspNetCore` and `demo/HelpDesk-bun`) now marks "Agent Notes" as collapsible. Ticket Info and Actions remain non-collapsible. Cross-backend parity confirms both backends emit the same wire shape on the `select-ticket-*` step.

### A11y

- Native `<details>` gives keyboard activation (Enter/Space), focus, and SR announcement for free — no app ARIA needed.
- `.vms-section__summary:focus-visible` uses `var(--vms-accent)` (the 1.1.0 row-click ring idiom), AA-contrast across the shipped default plus all 12 themes.

### Tests

- New `viewmodel-shell/test/section-collapsible.test.ts` (13 jsdom cases) covers render shape, default-closed, summary-is-heading, no double-heading, byte-identical fallthrough when omitted/false, and the full preservation matrix (open survives same-key re-render, identity change drops, removal + re-add drops, id-keying for duplicate headings, ordinal-keying for anonymous, keyboard summary-click toggle).
- New `demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.TicketPage_AgentNotesSection_IsCollapsible` guards both halves of the demo contract (Agent Notes IS collapsible; Ticket Info / Actions are NOT). AgentControllerTests goes from 25 to 26.

### Consumers

Additive — nothing to do. If you want to opt a section into collapsibility, set `collapsible: true`. The escape hatch for the rare server-driven-expansion case (e.g. auto-expand the section containing a validation error) is documented in `MIGRATION.md` § 1.2.0: re-key the section by changing its heading or id, or wrap it in a new node — the renderer drops the preserved state and the section re-renders in its (closed) default. No `forceExpand` / `defaultOpen` wire field by design.

---

## 1.1.0 — TableRow.action restored + actions[] mixed-type fix (npm + NuGet)

**npm:** `1.1.0` (MINOR — additive wire field; widened TS union) · **NuGet:** `1.1.0` (MINOR — additive wire field, lockstep)

Two related `TableNode` bugs ship as one minor bump. Both were silent in the Phase-6 refactor that introduced unique-named per-row actions; the second one was actively masking the per-row selection checkbox in HelpDesk.

### Fixed

- **`TableRow.actions[]` silently dropped non-`ButtonNode` entries.** The TypeScript type was `ButtonNode[]` but consumers (including HelpDesk) were putting `CheckboxNode` entries in there for per-row selection; the renderer called `this.button()` blindly on every entry, so the checkbox rendered as an empty `<button>`. The TS type is now `(ButtonNode | CheckboxNode)[]` (closed union); the .NET side stays `IReadOnlyList<ViewNode>` so System.Text.Json keeps emitting the polymorphic `type` discriminator. The renderer now dispatches by `entry.type` — `"button"` → `this.button()`, `"checkbox"` → `this.checkbox()` — and per-row checkboxes render as real `<input type="checkbox">` elements again.

### Restored / Improved

- **`TableRow.action` — click-anywhere row dispatch primitive.** This was removed during the Phase-6 wire-shape refactor (commit 61193ff, cleaned up in 2410fe3). 1.1.0 brings it back, now with full keyboard activation (`Enter` dispatches; `Space` `preventDefault`s page scroll then dispatches; `Tab` does NOT dispatch) and ARIA exposure (`role="button"`, `tabindex=0`, `aria-label` derived from non-empty cell text joined by ` · `, falling back to `Row {id}` if cells are empty). Clicking a per-row button/checkbox or a cell `linkLabel` anchor stops propagation, so the row action never double-fires. A `.vms-table__row--clickable:focus-visible` outline using `var(--vms-accent)` passes the WCAG-AA contrast guard on the shipped default plus all 12 themes. No `context` field — per-row identity is encoded in the action name, consistent with the Phase-6 wire.

### Demo migration

- **HelpDesk agent queue** (both `demo/HelpDesk/AspNetCore` and `demo/HelpDesk-bun`) migrated to the canonical pattern: `row.action = select-ticket-{id}` for the click-anywhere navigation, `row.actions[] = [CheckboxNode]` for the per-row bulk-selection checkbox. The per-row "Open" `ButtonNode` is gone — the row IS the affordance now, and the renderer adds the keyboard + ARIA automatically. HelpDesk is the canonical reference for using both together.

### Tests

- New `viewmodel-shell/test/table-row-action.test.ts` (10 jsdom tests) covers click/keyboard/ARIA for `row.action`, `stopPropagation` containment on per-row controls and cell anchors, the `CheckboxNode`-actually-renders fix, and the row-without-`action` backward-compat case.
- `demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs` updated: asserts CheckboxNode still present in `row.Actions`, asserts `ButtonNode` is gone, asserts `row.Action.Name == select-ticket-{id}`.
- Cross-backend parity (`bun run parity/run.ts`) green — the wire action sequence is unchanged, so the fixture script needed no edits.
- vitest: 240 → 250 + 1 skipped (10 new, no regressions). .NET HelpDesk AgentController tests: 25/25 (was 25/25 with the prior test renamed). CI guards (`check:core-globals`, `check:aa-contrast`) both green.

### Consumers

Additive — nothing to do. Apps working around the broken `actions[]` rendering by avoiding non-`ButtonNode` entries can now drop the workaround. See `MIGRATION.md` § 1.1.0.

---

## 1.0.1 — CSS cascade fix for section layout=cards/split (#17) (npm only)

**npm:** `1.0.1` (PATCH — client-side CSS bugfix; no wire change) · **NuGet:** unchanged at `1.0.0` (no .NET-side change)

### Fixed

- **`SectionNode` with `layout: "cards"` or `"split"` no longer collapses to a 1-column flex stack** (#17). The base `.vms-section { display: flex }` rule was written below the `.vms-section--cards` / `.vms-section--split` `{ display: grid }` modifier rules in `default.css`. Equal specificity + later-wins meant the base flex always shadowed the grid modifiers — so a `SectionNode` with `layout: "cards"` or `"split"` silently rendered as a 1-per-row flex stack. The base block now ships above the modifier blocks (mirroring the already-correct `.vms-page` ordering). Additionally, `min-width: 0` is now set on direct children of `.vms-page--cards` / `.vms-section--cards` / `.vms-page--split` / `.vms-section--split` so wide media (full-width images, long unbroken strings, nested `overflow:auto` containers) shrinks to the grid track instead of blowing it out and re-collapsing the grid back to one column. `PageNode` was unaffected (`.vms-page` was already declared in the correct order); `.vms-section--sidebar` (intentionally `display: flex`) is unaffected.

### Tests

- New jsdom regression test in `viewmodel-shell/test/theme-modifiers.test.ts` loads the actual `default.css` into the test DOM and asserts the cascaded `getComputedStyle().display` value for the four affected cases (section cards/split = grid, page cards = grid, section sidebar = flex). The prior tests in this file only checked emitted classNames, which is exactly why this slipped through — the bug was in the cascade, not the emission. The new tests close that coverage gap.

### Consumers

Nothing to do — pure CSS bugfix, no API/wire change. `npm update @ashley-shrok/viewmodel-shell` and any `SectionNode` with `layout: "cards"` or `"split"` will start rendering as the intended grid. No MIGRATION.md note needed.

---

## 1.0.0 — Truly Self-Describing Wire (npm + NuGet)

**npm:** `1.0.0` (MAJOR — breaking wire-format change: context payload removed, bind paths added, error envelope, ok flag) · **NuGet:** `1.0.0` (MAJOR — same wire contract, aligned per the major.minor rule)

Before: the wire was self-describing only when paired with the browser renderer — agents driving the API had to mentally simulate the renderer to know what `context` payload to send. After: an agent reading only `{vm, state}` from a GET and walking the tree can dispatch any action identically to the browser. The `context` field is gone; every input binds to a state path; action names are unique per operation; the renderer is a thin interpreter. Paired with a framework-owned `ok` flag + `{ok: false, errors: [...]}` envelope so failures are uniformly legible across every VMS app.

### Why

The original framework pitch — "agents drive what the browser drives" — had an asterisk: the browser renderer assembled a `context` payload using scope rules absent from the wire. v1.0.0 removes the asterisk. Agents now have one stable failure-check (`body.ok`) and one stable dispatch shape (`{action: {name}, state, files?}`).

### Added (wire-shape and protocol)

- Every input node declares a `bind` path (`bind: "fields.title"`); the renderer reads/writes through it.
- Dispatch wire is `{action: {name}, state, files?}` — no `context` field.
- Action-name uniqueness enforced at tree-build time (`ValidateActionNames`).
- Top-level `ok: true | false` on every response.
- `{ok: false, errors: [{path?, message, code?}]}` envelope on framework failures.
- Stable framework-only `code` vocabulary: `parse_error`, `unknown_action`, `invalid_tree`, `uncaught_exception`.
- New exception classes: `UnknownActionError` (TS, `@ashley-shrok/viewmodel-shell/server`) / `UnknownActionException` (.NET, `ViewModelShell` namespace).
- New client error class: `VmsActionError extends Error` exported from `@ashley-shrok/viewmodel-shell` — surfaced via the existing `onError` callback with `errors`, `status`, and `code` shortcut.
- .NET: `ShellExceptionFilter` registered in `Program.cs` translates thrown exceptions to envelope responses (no per-controller boilerplate).

### Demo + parity

- All 14 demo backends (.NET + bun, plus FeatureProbe-node) migrated to the new shape — `default:` arms throw the new exception classes, FeatureProbe gains a `boom` action exercising the uncaught-throw path.
- Cross-backend parity: 8 fixtures (the existing 7 + new `feature-probe-envelope`) across all 15 backends byte-identical. The new fixture covers all three envelope cases (parse / unknown-action / uncaught) with strict status-code assertions per case.
- `vitest run`: full TS suite green; new tests cover the envelope wrap on the server side and the parse-then-branch on the shell side.
- `dotnet test`: full .NET suite green; new tests cover the envelope types, exception filter, and round-trip through every demo controller.

### Consumers

Breaking change — aligned npm + NuGet major bump. No compatibility shims. Upgrade path is one consolidated section in MIGRATION.md (single 0.4.x → 1.0.0 recipe; you don't read it in two chunks). The migration is mechanical: add bind paths on inputs, make action names unique, swap `default:` arms to throw the new exception, register the .NET filter, and optionally branch on `VmsActionError` in `onError`.

---

## 0.16.0 — `ShellResponse.busy` (UI lockout) + generic per-round-trip lock (npm + NuGet)

**npm:** `0.16.0` (MINOR — new optional wire field + new optional `Adapter` capability verb + default CSS rule) · **NuGet:** `0.16.0` (MINOR — `ShellResponse.Busy` property)

Both packages move together (wire-format addition). Purely additive — every existing response renders byte-identically.

### Why

Two interaction-honesty problems we kept brushing against:

1. **Rapid clicks during a single round-trip silently mislead** — the dispatch guard drops them (correct behavior), but the DOM-default checkbox flip / button depression *happens visually* before the dispatch is dropped. The user sees a state that the framework never accepted. This is what made `TableSelection.action` un-shippable in 0.15.0.
2. **Long-running server actions have no client-side lockout** — the server can render a "Working…" view, but between polls the user can still keyboard-activate elements behind the modal, race the first response, etc. The server-side gate catches it after the dispatch reaches the server, which is too late.

Both reduce to one principle: **when a user dispatch is going to be dropped, the UI must not appear responsive**. 0.16.0 wires that principle into the framework.

### Added

- **`ShellResponse.busy?: bool`** (TS) / **`ShellResponse<TState>.Busy: bool`** (C#, `WhenWritingDefault` → wire omits `false`). When `true`, the shell drops user-initiated dispatches client-side; polls (`silent: true`) bypass so the server can clear the state. Same idempotent on-every-response shape as `PreventUnload`; the two pair naturally for long-running server actions.
- **`Adapter.setBusy?(active: boolean)`** — new optional capability verb. Shell calls it on every transition with `serverBusy || userDispatching`. Fail-quiet by absence (TUI has no equivalent).
- **`BrowserAdapter.setBusy`** — toggles `.vms-busy` on the container. Idempotent.
- **Default CSS:** `.vms-busy { cursor: wait }` + `pointer-events: none` on interactive descendants. The lock is **honest**: clicks never reach the input, so checkboxes can't visually flip during a round-trip; buttons can't depress.
- **Generic per-round-trip lock** (the lesson from `TableSelection.action`): the shell *also* applies `.vms-busy` for the duration of every user-initiated dispatch automatically — no server flag required. Polls (silent dispatches) don't toggle the class, so a long action with `busy: true` + polling stays continuously locked without flicker.

### Demo + parity

FeatureProbe's "Start long action" handler now returns both `PreventUnload = true` AND `Busy = true` (and clears both on completion). Existing fixture steps validate the pairing across all 7 backend groups (dotnet-probe / bun-probe / node-probe).

### Consumers

Nothing to do — additive. To opt into the explicit long-action lockout, return `Busy = true` from every render handler while server-side work is pending; clear it (omit or set `false`) when the work completes. The implicit per-round-trip lock applies to every existing app automatically; the dispatch guard's UX is now visually honest by default.

---

## 0.15.0 — Remove `TableSelection.action` (server-truth toggle mode) (npm + NuGet)

**npm:** `0.15.0` (MINOR — breaking removal in pre-1.0, but no app in our orbit was using it) · **NuGet:** `0.15.0` (MINOR — same)

Both packages move together. Intentional pruning, not a deprecation.

### Removed (breaking)

- **`TableSelection.action`** — the per-toggle round-trip "server-truth" mode. It had a known UX foot-gun (rapid checkbox clicks were silently dropped by the dispatch guard while a round-trip was in flight, and the in-flight response then re-rendered the table with stale `selectedIds` that wiped the visually-flipped checkbox). The 0.13.0 release made it optional and added `selection.buttons[]` as the recommended path; this release deletes the mode entirely so the latent bug can't bite anyone who happens to wire it up later. The way back, if it ever turns out we need it, is a redesigned wire shape (dispatch queueing + optimistic DOM preservation), not the original `action` field.
- **`TableSelection.Action`** parameter (C#) removed from the record. Now only `(IReadOnlyList<string> SelectedIds, IReadOnlyList<ViewNode>? Buttons = null)`.

### Adapters simplified

- **`BrowserAdapter`** — header select-all and per-row checkbox handlers are now single-path: toggle DOM + `.vms-table__row--selected` class. No more dispatch branch.
- **`TuiAdapter`** — checkbox column is render-only (was already inert in local mode); the `onToggleAll`/`onToggleRow` callbacks are gone since they had no purpose left.
- **CSS** unchanged. **`selection.buttons[]` unchanged.**

### Migration

If you happened to wire `selection.action` somewhere, the 60-second swap is documented in `MIGRATION.md` — drop the field, move bulk handlers from "read state.SelectedIds" to "read context selectedIds harvested by `selection.buttons[]`" (the pattern HelpDesk-Agent uses since 0.13.0). For everyone else: nothing to do.

### Demo + parity

`FeatureProbe`'s table-matrix demo had selection wired through the removed `action` path. Selection is now stripped from that matrix — sort / filter / pagination coverage stays. Selection.buttons[] parity coverage lives in HelpDesk-Agent (unchanged). The feature-probe fixture loses 6 `tbl-select-*` steps; helpdesk still validates the bulk-action-with-`selectedIds`-in-context flow end-to-end.

### Why now

The framework's first-app shipping caught the bug in the wild. With direct visibility that no other consumer was using the mode, removing it is cheaper than carrying a known-buggy code path "for completeness." This is the same principle as the AGENTS.md "if your app needs a workaround, that's a signal the framework needs a new primitive" — the inverse: if a primitive is known-buggy and no one needs it, remove it.

---

## 0.14.0 — `ShellResponse.preventUnload` (warn-before-leave guard) (npm + NuGet)

**npm:** `0.14.0` (MINOR — new optional wire field + new optional `Adapter` capability verb) · **NuGet:** `0.14.0` (MINOR — `ShellResponse.PreventUnload` property)

Both packages move together (wire-format addition). Closes [#18](https://github.com/ashley-shrok/ViewModelShell/issues/18). Purely additive — every existing response renders byte-identically.

### Added

- **`ShellResponse.preventUnload?: bool`** (TS) / **`ShellResponse<TState>.PreventUnload: bool`** (C#, `WhenWritingDefault` → wire omits `false`). When `true`, the shell asks the adapter to install a "warn before navigating away" guard until the next response that clears it. The natural pattern is "set it on every response while server-side work is pending, omit it (or set false) once the work completes" — exactly the same shape `NextPollIn` uses for polling cadence, drives the same lock-and-release lifecycle.
- **`Adapter.setPreventUnload?(active: boolean)`** — new optional capability verb. Called by the shell on every response (load + dispatch + push) with `body.preventUnload ?? false`. **Fail-quiet by absence** (unlike `navigate` / `storage` / `saveFile`): this is a UX safety net, not a security guarantee, and non-browser targets (TUI) have no terminal equivalent.
- **`BrowserAdapter.setPreventUnload`** — installs / removes a `beforeunload` listener that calls `preventDefault()` + sets `returnValue` (the two-signal pattern modern browsers accept). Idempotent: install when already installed is a no-op; remove when not installed is a no-op. **Modern browsers control the dialog text** ("Leave site? Changes you made may not be saved") and do not allow custom messages — the API only signals *whether* to warn.

### Demo

`FeatureProbe` gains a "Start long action" button. The handler sets `LongActionPolls = 3` and returns `PreventUnload = true` + `NextPollIn = 100`; each subsequent `long-action-poll` tick decrements until 0, then clears both. Parity coverage: `feature-probe.json` adds a 5-step long-action block (`fresh-long` + `long-start` + 3 polls). `dotnet-probe` / `bun-probe` / `node-probe` agree byte-for-byte; the conditional spread on the bun side mirrors C#'s `WhenWritingDefault` (drops `preventUnload` from the wire when `false`).

### Consumers

Nothing to do — additive. To opt in, set `PreventUnload = state.IsWorkPending` from every render handler that has long-running server-side work; clear it (omit or set `false`) when the work completes. See `MIGRATION.md` for the pattern + `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` for a worked example.

---

## 0.13.0 — `TableNode` local-mode selection + bulk-action toolbar (npm + NuGet)

**npm:** `0.13.0` (MINOR — `selection.action` relaxed to optional + new `selection.buttons[]` + adapter changes) · **NuGet:** `0.13.0` (MINOR — `TableSelection.Action` becomes nullable + new `TableSelection.Buttons`)

Both packages move together. Closes [#17](https://github.com/ashley-shrok/ViewModelShell/issues/17). Purely additive — every existing table that sets `selection.action` keeps the same behavior. The new shape is opt-in.

### Why

0.12.0's `selection.action` mode is server-truth: every checkbox click dispatches a round-trip toggle action, so the server can render "N selected" indicators, conditional toolbars, cross-page persistence, etc. It pays a real cost — when a user clicks checkboxes in quick succession, the dispatch guard (AGENTS.md non-obvious behavior #4) **silently drops** the second click while the first round-trip is in flight, *and* the in-flight response re-renders the table with server-truth `selectedIds` that wipes the second checkbox's DOM state. From the user's seat: "I clicked that box, why's it unchecked?" Reported in the field after the first 0.12.0 app shipped — and it's the framework's biggest UX limitation against rapid bulk-selection workflows.

### Added

- **`TableSelection.action` is now optional.** When omitted, the table enters **local mode**: the adapter toggles the DOM checkbox + the `.vms-table__row--selected` class purely client-side, no dispatch. No round-trip per click → the dispatch guard can't drop anything → no silently-wiped checkboxes. Selection still surfaces visually via the design-system class (no app CSS). `selectedIds` continues to drive *initial* / pre-selected rows; subsequent toggles live in the DOM. **Trade-off:** local-mode selection doesn't persist across server re-renders (paginating, filtering, polling rebuilds the table → DOM state resets). For server-truth selection that survives those transitions, keep using `action` mode.
- **`TableSelection.buttons?: ButtonNode[]`** — bulk-action toolbar rendered ABOVE the table by the adapter (new CSS hook `.vms-table__bulk-actions`). On click, each button harvests the currently-checked row ids from the DOM and merges them as `selectedIds` into the action's context, then dispatches. Designed primarily to pair with local mode (it's how the server learns the selection at action time without a per-toggle round-trip), but works in server-truth mode too — the DOM mirrors `selectedIds` after each render, so the harvest matches state.
- **CSS:** `.vms-table__bulk-actions` — flex row above the table with the standard spacing rhythm. Reuses `.vms-button` classes; no new color/size tokens.

### TUI

The TUI is **experimental** (per its 0.11.0 marking) and treats local mode as render-only: checkboxes show the server's `selectedIds`, clicks are inert, `buttons[]` toolbar renders and dispatches with whatever the server pre-selected. Interactive local-mode selection lives in the browser. The wire format and the cross-backend parity contract are unchanged.

### Migrated

`demo/HelpDesk/AspNetCore/AgentController.cs` (and its bun twin) switch from server-truth to local mode — drop `AgentState.SelectedIds`, drop the `toggle-select` action, move bulk buttons into `selection.buttons[]`. The helpdesk parity fixture replaces six toggle/page steps with four `bulk-*` steps that pass `selectedIds` in context. `dotnet-helpdesk` and `bun-helpdesk` agree byte-for-byte.

### Consumers

**If your app today uses `selection.action` with bulk-action buttons** — you should probably switch. The rapid-click bug is real; local mode kills it. See `MIGRATION.md` for the step-by-step.

**If your app uses cross-page selection** (sweep-selecting across paginated rows) — stay in server-truth mode; that's its home turf. We may layer in a dispatch-queueing fix for that case in a future release.

---

## 0.12.0 — `TableNode` selection + pagination (npm + NuGet)

**npm:** `0.12.0` (MINOR — two new optional `TableNode` fields + renderer/CSS) · **NuGet:** `0.12.0` (MINOR — `TableSelection` + `TablePagination` records, two new `TableNode` members)

Both packages move together (AGENTS.md: a `ViewNode` wire change bumps both sides). Closes [#16](https://github.com/ashley-shrok/ViewModelShell/issues/16). Purely additive — every existing `TableNode` renders byte-identically.

### Added

- **`TableNode.selection`** (`{ selectedIds: string[]; action }`) — first-class bulk row selection. The adapter renders a leading checkbox column + a header select-all checkbox, tints selected rows with `.vms-table__row--selected`, and dispatches the action with merged `{ id, checked }` per row or `{ all: true, checked }` for select-all (where "all" = the rows currently rendered, i.e. the current page). `selectedIds` is **server-truth** and round-trips in state, so selection survives sort/filter/pagination independent of which rows are in view. Crucially, **`TableRow.action` stays free** — selection is its own seam, so a row can still be click-to-open *and* selectable. Buttons that act on the selection live outside the table as ordinary `ButtonNode`s reading `selectedIds` from state. The "select all N matching" (not just the page) affordance is the app's own node composed above the table — the framework ships the primitive, not the policy.
- **`TableNode.pagination`** (`{ page; pageSize; totalRows; action }`) — server-driven pagination. The adapter renders an "X–Y of N" range + prev/next controls below the table (disabling the edges), and dispatches `{ page }`. **The server slices `rows` to the current page** — the adapter never paginates client-side (that would break for DB-backed tables, which are most of them). By convention `sortAction`/`filterAction` reset `page` to 1 server-side (documented at the type).
- **CSS:** `.vms-table__row--selected` (accent tint via `color-mix`, recolors with the active theme — no literals), `.vms-table__th--select`/`.vms-table__td--select` (checkbox column), `.vms-table__select` (`accent-color` from `--vms-accent`), and `.vms-table__pagination*` (range + reused `.vms-button` controls). No new app CSS surface.

### Cross-backend + tested

- TS (`index.ts` + `browser.ts` + `tui.tsx`) and C# (`TableSelection`/`TablePagination` records, both carrying the null-omission attribute on the `TableNode` members) — kept byte-aligned by the parity suite. The `feature-probe` fixture grew a 14-step **selection × pagination × sort × filter** matrix proven identical across `dotnet`/`bun`/`node` backends; the `helpdesk` fixture grew a 6-step agent **bulk-action over SQLite** block (select-all, page, bulk reopen/start) proven identical across `dotnet`/`bun`.
- 9 new BrowserAdapter unit tests (checkbox state, dispatch payloads, selected-row class, stopPropagation vs. row click, disabled-edge pagination) + a cross-adapter conformance fixture (browser + TUI both surface the controls).

### Demos

- **HelpDesk-Agent** ticket queue is now a real bulk-action workflow: selectable rows + SQL `LIMIT/OFFSET` pagination + "Mark In Progress / Mark Resolved / Reopen" buttons outside the table that act on the selection.
- **FeatureProbe** gained a table feature-matrix section exercising every `TableNode` knob at once.

### Consumers

Nothing to do — additive. Existing tables are unaffected; opt into a feature by setting `selection` and/or `pagination` on a `TableNode`. See `MIGRATION.md`.

---

## 0.11.0 — `ImageNode` + `TextNode` "warning" style + WCAG-AA hardening; TUI experimental (npm + NuGet)

**npm:** `0.11.0` (MINOR — new `ImageNode`, `TextNode` style widened) · **NuGet:** `0.11.0` (MINOR — new `ImageNode` record + discriminator)

Both packages move together (AGENTS.md: a `ViewNode` type change bumps both sides). Closes [#5](https://github.com/ashley-shrok/ViewModelShell/issues/5) and [#8](https://github.com/ashley-shrok/ViewModelShell/issues/8). Purely additive.

### Added

- **`ImageNode`** (`{ type: "image"; src; alt?; size?; shape? }`) — renders pictures/media: product catalogs, avatars, logos, thumbnails. Browser emits `<img class="vms-image" src alt>` with design-system sizing/shape modifier classes (`size: "small" | "medium" | "large" | "full"` → widths from `--vms-image-*` tokens; `shape: "circle"` → square-cropped circular avatar via `border-radius:50% + aspect-ratio:1 + object-fit:cover`). No free-form CSS — sizing is the closed enum. Multi-target safe: the TUI degrades to `[image: <alt>]`, so the wire's accessibility intent carries to non-browser adapters. Cross-backend (TS `index.ts`/`server.ts` + C# `ImageNode` record with the `"image"` discriminator), parity-checked, jsdom + conformance tested.
- **`TextNode.style: "warning"`** — an inline warning text affordance, symmetric with the existing `"error"`. A one-line advisory ("Conversation truncated at 500 rows.") is now one `TextNode`, not a `ListNode` + `ListItemNode{variant:"warning"}` wrapper. Emits `.vms-text--warning` (browser) / amber foreground (TUI). The C# side needs no change — `TextNode.Style` has always been a free `string?`, so `new TextNode("…", "warning")` already compiled; 0.11.0 just makes the renderer style it.

### Changed (accessibility — the non-obvious part)

- **`--vms-warning` darkened `#a37510` → `#8a630d`** in the shipped default, and **`#c89610` → `#8a630d`** across all six `light-*` themes. Reason: `warning` was only ever a **non-text border accent** (list-item left-border, table-row tint), tuned to the WCAG 3.0:1 *non-text* bar. Promoting it to a **text** color means it must clear the **4.5:1** bar (SC 1.4.3); the old values were ~4.1:1 (default) / ~2.7:1 (light themes) as text — sub-AA. The new value clears 4.5:1 on both surface and bg. Dark themes were already compliant (light amber on dark ≈ 8:1) and are untouched, including the byte-frozen `dark-purple.css`. This is a cosmetic deepening of existing warning borders/tints — no API or wire change.
- **`check:aa-contrast` extended** from default-only to **default + all 12 themes** (each merged over the default `:root`, the real consumer cascade), and `error` + `warning` are now checked at the **text** threshold (4.5:1, on surface *and* bg) rather than the non-text 3.0:1 — closing a latent gap where `error` (a text style since 0.4.1) was only ever guarded at the non-text bar. The six `light-*` theme SHAs in `check:theme-byte-identity` were deliberately re-baselined (recorded in the guard, per the D-26 precedent).

### Consumers

Nothing to do — additive. Code that previously passed `Style: "warning"` and silently rendered unstyled now renders as styled warning text. No migration step.

### Also: terminal adapter (TUI) marked **experimental** (npm only)

The terminal target (`@ashley-shrok/viewmodel-shell/tui` + the `vms-tui` CLI) is now explicitly flagged experimental — it's incomplete (scrolling, keyboard/focus ergonomics, and layout coverage need more work) and not under active development for now. Non-breaking, layered signal:

- **`@experimental` TSDoc** on `TuiAdapter` + `renderTree` (surfaces in editors / API tooling).
- **One-time runtime notice** to stderr the first time a `TuiAdapter` is constructed (covers both the CLI and programmatic use). Silence with `VMS_TUI_SILENCE_EXPERIMENTAL=1`.
- **Docs callouts** in the README "Terminal (TUI)" section and AGENTS.md.

No rename, no API removal — existing `import { TuiAdapter }` and `bunx vms-tui` keep working unchanged. **The browser, server, and core packages are stable and unaffected.** NuGet has no TUI surface, so this is npm-only.

---

## 0.10.0 — Multi-action forms: `FormNode.buttons[]` (npm + NuGet)

**npm:** `0.10.0` (MINOR — wire-format addition) · **NuGet:** `0.10.0` (MINOR — wire-format addition)

Both packages move together. Closes [#15](https://github.com/ashley-shrok/ViewModelShell/issues/15). Additive field + a back-compat relaxation of `submitAction`.

### Added

- **`FormNode.buttons?: ButtonNode[]`** — multiple submit buttons on one form, each harvesting the form's *current* field values into its own action's context and dispatching. Mirrors HTML's multiple submit buttons / `formaction`. Closes the "one form, shared fields, multiple actions" gap (fetch-then-save, save-vs-save-and-close, apply-vs-preview) that previously forced a two-form workaround which silently dropped input. Each entry is a **full `ButtonNode`**, so `variant` and `pendingLabel` apply — the slow "Fetch & fill" button gets instant pending feedback for free:

  C#:
  ```csharp
  new FormNode(SubmitAction: null, SubmitLabel: null,
      Children: [ new FieldNode("url", "text", "URL", null, null) ],
      Buttons: [
          new ButtonNode("Fetch & fill", new ActionDescriptor("fetch-meta"), null, PendingLabel: "Fetching…"),
          new ButtonNode("Save",         new ActionDescriptor("add-item"),   "primary"),
      ])
  ```

  TypeScript backend:
  ```typescript
  { type: "form",
    children: [{ type: "field", name: "url", inputType: "text", label: "URL" }],
    buttons: [
      { type: "button", label: "Fetch & fill", action: { name: "fetch-meta" }, pendingLabel: "Fetching…" },
      { type: "button", label: "Save", action: { name: "add-item" }, variant: "primary" },
    ] }
  ```

  A plain `ButtonNode` placed in `children` keeps its no-harvest behavior — only buttons in the `buttons[]` slot harvest. Browser renders them in a `.vms-form__buttons` row; TUI renders them as activatable buttons (mouse + Enter) sharing the form's harvest closure.

### Changed

- **`FormNode.submitAction` relaxed from required to optional.** A `buttons[]`-only form omits it and renders no default submit button (and Enter doesn't submit at the form level — a `FieldNode.action` still fires per-field). Existing forms with `submitAction` are byte-identical. (C#: `SubmitAction` kept positional-but-nullable so existing positional call sites compile unchanged; serialized with `WhenWritingNull`.)

### Consumers

- **None required — additive.** Existing single-submit forms unchanged. Cross-backend parity unchanged. Demo: `demo/FeatureProbe` (and Bun twin) now has a one-form / two-button (`Save Draft` + `Publish`) example sharing a `note` field.

---

## 0.9.0 — `CopyButtonNode.variant`: visual differentiation from default buttons (npm + NuGet)

**npm:** `0.9.0` (MINOR — wire-format addition) · **NuGet:** `0.9.0` (MINOR — wire-format addition)

Both packages move together. Closes [#14](https://github.com/ashley-shrok/ViewModelShell/issues/14). One additive `CopyButtonNode` field; no breaking change.

### Added

- **`CopyButtonNode.variant?: "primary" | "secondary" | "danger"`.** Mirrors `ButtonNode.variant` exactly. Previously, copy-buttons rendered with class `vms-button` (no modifier), visually indistinguishable from default `ButtonNode`s in the same layout — so a copy-button sitting alongside a column of bare action buttons just looked like another row, even though it does something semantically different (clipboard write vs. server action). With `variant`, the same `.vms-button--primary` / `--secondary` / `--danger` CSS rules that already exist for `ButtonNode` now apply to `CopyButtonNode` too.

  C#:
  ```csharp
  new CopyButtonNode("npx @ashley-shrok/viewmodel-shell",
      "Copy install command",
      "Copied!",
      Variant: "secondary")
  ```

  TypeScript backend:
  ```typescript
  { type: "copy-button", text: "npx …", label: "Copy install command",
    copiedLabel: "Copied!", variant: "secondary" }
  ```

  **No new CSS rules ship** — the existing `.vms-button--{variant}` selectors already match `.vms-button.vms-button--{variant}` regardless of whether the underlying `<button>` came from a `ButtonNode` or a `CopyButtonNode`. The TUI adapter applies the same `fg` color rules its `ButtonView` uses (`#ff5555` for danger, `#88aaff` for primary, undefined for secondary/omitted). Omitted variant = byte-identical to pre-0.9.0 behavior.

### Consumers

- **None required — additive.** Existing `CopyButtonNode` consumers untouched. Cross-backend parity unchanged.
- **Demo worked example:** `demo/FeatureProbe` (and Bun twin) now sets `variant: "secondary"` on its "Copy install command" copy-button.

---

## 0.8.0 — `ButtonNode.pendingLabel`: instant click feedback for slow actions (npm + NuGet)

**npm:** `0.8.0` (MINOR — wire-format addition) · **NuGet:** `0.8.0` (MINOR — wire-format addition)

Both packages move together. Closes [#11](https://github.com/ashley-shrok/ViewModelShell/issues/11). One additive `ButtonNode` field; no breaking change.

### Added

- **`ButtonNode.pendingLabel?: string`.** Transient label shown from click until the dispatch resolves. Adapter additionally adds `.vms-button--pending` (browser) or visually dims the button (TUI) while pending so the affordance visibly disables — preventing re-clicks both via the shell's existing dispatch-guard AND via the new visual signal. Mirrors `CopyButtonNode.copiedLabel`'s lifecycle pattern at a different beat (DURING the round-trip, rather than AFTER it):

  C#:
  ```csharp
  new ButtonNode("Load Plugin",
      new ActionDescriptor("load-plugin"),
      "primary",
      PendingLabel: "Loading…")
  ```

  TypeScript backend:
  ```typescript
  { type: "button", label: "Load Plugin", action: { name: "load-plugin" },
    variant: "primary", pendingLabel: "Loading…" }
  ```

  Omitted = no pending feedback (existing instant-click behavior, byte-identical). Pure-client ephemeral state — never round-trips through the wire. The shell's dispatch-error path (see *Changed* below) reverts pending UI without per-button cleanup wiring.

### Changed

- **Shell re-renders `currentVm` on dispatch error.** Previously, a failed dispatch (non-OK response, fetch throw) surfaced `onError` but did NOT trigger a re-render — any client-side ephemeral UI applied in the click handler (e.g. the new `pendingLabel` swap, but applicable to any future similar pattern) would be left visually stuck. Now the shell calls `adapter.render(currentVm, …)` from `dispatch()`'s catch block when `currentVm` is non-null. This snaps client-side state back to the authoritative server tree automatically. Existing apps that previously depended on "no re-render after error" should be unaffected (the re-render uses the *same* VM that was last rendered; idempotent for any adapter that doesn't mutate the DOM in ways the snapshot/restore doesn't already cover).

### Consumers

- **None required — additive.** Existing `ButtonNode` consumers untouched (new `pendingLabel`/`PendingLabel` field is optional, null-omitted on the wire). Existing dispatch-error behavior is now "re-render currentVm + fire onError" rather than just "fire onError"; this is strictly more correct for adapters that mutate the DOM on click. Cross-backend parity unchanged.
- **Demo worked example:** `demo/HelpDesk` (and its Bun twin) now sets `pendingLabel` on the ticket-status-change buttons (`"Marking…"`, `"Resolving…"`, `"Reopening…"`) — exercise it in the agent view of a HelpDesk ticket.

---

## 0.7.1 — Browser scroll preservation across re-render (npm only)

**npm:** `0.7.1` (PATCH — client-only bug fix) · **NuGet:** unchanged at `0.7.0`

Closes [#7](https://github.com/ashley-shrok/ViewModelShell/issues/7). No wire, type, or API change; NuGet untouched; major.minor stays `0.7`.

### Fixed

- **`BrowserAdapter.render()` now preserves the window scroll position across action-driven re-renders.** Previously, the snapshot/restore block preserved element-level `scrollTop`/`scrollLeft` for nodes with an `id` and restored focus + caret, but it did NOT snapshot `window.scrollX`/`window.scrollY`. Combined with `el.focus()` being called without `{ preventScroll: true }`, the re-render would yank the viewport to the focused element (or to the top), making long-page apps jump on every action. Fix: snapshot `window.scrollX`/`Y` alongside the existing snapshot, pass `preventScroll: true` to the focus restore call, and `window.scrollTo(x, y)` after all DOM restoration so the position is the last thing written. **Behavior change is "scroll stays where the user left it"**, which is what every other framework does in the same situation — apps that previously relied on the implicit scroll-to-top can still navigate explicitly via `ShellResponse.redirect`.

### Consumers

- **None required.** Client-only fix; no wire/type/API change. Static/non-interactive rendering unaffected. Server consumers (.NET / TS server subpath) untouched — NuGet stays at `0.7.0`. Apps that depended on the scroll-to-top behavior of action-driven re-renders should switch to explicit `ShellResponse.redirect` for that intent (the existing wire affordance for app-driven navigation).

---

## 0.7.0 — `PageNode.width` override seam + page-max docs (npm + NuGet)

**npm:** `0.7.0` (MINOR — wire-format addition) · **NuGet:** `0.7.0` (MINOR — wire-format addition)

Both packages move together. The shared wire gains one optional `PageNode` field — no breaking change; existing consumers untouched. Closes [#13](https://github.com/ashley-shrok/ViewModelShell/issues/13).

### Added

- **`PageNode.width?: "wide" | "full"`.** Opt-in per-page max-width override. Omitted = framework default cap (`--vms-page-max`, 1080px). `"wide"` emits `.vms-page--wide` which expands to `var(--vms-page-max-wide)` (default 1440px). `"full"` emits `.vms-page--full` which removes the cap entirely. Sibling of the existing `density` and `layout` closed-union appearance modifiers; same wire shape (null-omitted on the wire, no modifier class when absent). `TuiAdapter` ignores the field — width caps are a browser concern; the terminal naturally fills.

  C#:
  ```csharp
  return new PageNode(
      Title: "Invoices",
      Layout: "stack",
      Width: "wide",       // wider page for the data-heavy table
      Children: [...]);
  ```

  TypeScript backend:
  ```typescript
  return {
    type: "page",
    title: "Invoices",
    layout: "stack",
    width: "wide",
    children: [...],
  };
  ```

- **`--vms-page-max` formally annotated as an additive override seam** in `styles/default.css` (matching the existing `--vms-card-min` treatment). Hosts can globally retune via a single `:root { --vms-page-max: 1280px }` after the theme import — already documented in `AGENTS.md`, now sanctioned in the inline CSS comment too. Companion token `--vms-page-max-wide` (default `1440px`) backs the `.vms-page--wide` modifier and is independently host-retunable.

### Fixed

- **`server.ts` multipart-file narrowing.** A latent build break in `parseFormDataAction` surfaced when `@types/node@22.19+` started shipping its own `File` interface alongside DOM's: `value instanceof File` ambiguates the narrow on `FormDataEntryValue`. Switched to `typeof value !== "string"`, which narrows the union to `File` unambiguously and is identical at runtime. Behavior unchanged; latent fix.

### Consumers

- **None required — additive.** Existing `PageNode` consumers untouched (new `width`/`Width` field is optional and null-omitted on the wire). Wire is forward-compatible. Cross-backend parity unchanged. The shipped `demo/ContactManager` now uses `width: "wide"` as a worked example of the new field.

---

## 0.6.0 — Terminal substrate rewrite (OpenTUI, Bun runtime) + interaction polish

**npm:** `0.6.0` (MINOR — client adapter rewrite, optional-dep set changes) · **NuGet:** `0.6.0` (MINOR — version-aligned no-op; no functional changes)

The terminal/TUI front-end is rewritten from scratch on a new substrate. **No wire change** — `ViewNode` types, `ShellSideEffect`, `ShellResponse`, every backend, and `parity/` are all untouched. NuGet bumps to `0.6.0` purely to keep shared major.minor with npm (the existing alignment rule); the package contents are identical to `0.5.0`. Browser and server consumers are unaffected.

### Changed

- **`@ashley-shrok/viewmodel-shell/tui` rewritten on [OpenTUI](https://github.com/anomalyco/opentui).** The Ink-based adapter (4 of its arc versions: 0.4.5–0.4.9) had two structural limitations end-users reported on real apps: no mouse support at all, and no scrollable-view primitive (overflow clipped silently). The Node TUI ecosystem in 2026 doesn't have an active library that delivers both with React-style ergonomics — `blessed` and `neo-blessed` are abandoned (2015 / 2018), `terminal-kit` is active but imperative, and OpenTUI is the only library that ships a React reconciler (`@opentui/react`) alongside `ScrollBox`, native mouse handling, focus management, and prebuilt platform binaries (`@opentui/core-{linux,darwin,win32}-{x64,arm64}` via `optionalDependencies`). OpenTUI is **currently Bun-only** (their docs: "Node and Deno support in-progress"), so the `/tui` subpath + `vms-tui` CLI now require Bun runtime. **Browser/server consumers are unaffected** — `.`, `./browser`, `./server` are pure JS with no native binaries and run on Node/Deno/Bun/Workers as before.
- **Mouse support throughout.** Click any button, checkbox (with action), link, copy-button, table header (sortable columns), or table row (with action) and the appropriate event dispatches. Wheel scrolls the focused pane's `<scrollbox>`. Cmd/Ctrl-click on external links opens them in the system browser via OSC-8 (already supported by every modern terminal).
- **Per-pane scrolling + Tab focus cycle (lazygit-style).** Each `section`/top-level `list`/top-level `table` is its own scrollable pane with a focus border. Tab/Shift-Tab cycles focus across panes; ↑↓ PgUp/PgDn scroll inside the focused pane.
- **Keyboard activation.** Enter on the focused pane activates its primary actionable (first button → dispatch action; first link → navigate; first copy-button → OSC-52 copy). Space toggles the focused pane's first checkbox-with-action. Both are no-ops when the focused pane has a field input (FieldView's `<input onSubmit>` owns Enter; Space is a printable character there).
- **Pane-aware status bar.** A persistent status line at the bottom of the viewport shows the current keybinds: always `Tab next pane | Shift-Tab prev | ↑↓ PgUp/PgDn scroll | Ctrl-C quit`, plus a context-aware slot — `Enter <button-label>` when a button is the primary actionable, `Enter submit` when the pane has fields, `Space toggle` when a checkbox is the primary, etc. The focused pane's section heading shows on the right so you always know where you are.
- **Modal overlay + focus trap (carried from B4).** Modals portal to the app-root z-level and trap Tab inside their interior — outer panes still render but aren't part of the cycle. Click `[ Close ]` or wire any `dismissAction` button to exit.
- **Draft preservation, copy-button OSC-52 + 1500ms revert, alt-screen + Ctrl-C teardown** (carried from earlier OpenTUI arc phases B1–B4) all unchanged.

### Removed

- **Ink, react@18, ink-text-input, ink-select-input** from `optionalDependencies`. Replaced with `@opentui/core` + `@opentui/react` + `react@19`. Existing consumers using `import { TuiAdapter } from "@ashley-shrok/viewmodel-shell/tui"` must update their install (and switch from `node`/`npx` to `bun`/`bunx` for the TUI subpath — see MIGRATION.md).

### Consumers

- **Browser / server consumers:** nothing to do. `.`, `./browser`, `./server` runtime-agnostic; NuGet contents are byte-identical to `0.5.0` (alignment-only version bump).
- **TUI consumers** (`vms-tui` CLI or programmatic `TuiAdapter`): one-time `curl -fsSL https://bun.sh/install | bash`, then `bunx vms-tui …` or `bun install`. See `MIGRATION.md` for the full step-by-step including the optionalDependency swap.
- **No wire change.** `parity/` 14-backend suite green; `conformance.tui.test.ts` (information parity vs. `BrowserAdapter`) green throughout the rewrite.

---

## 0.5.0 — Authenticated downloads (npm + NuGet)

**npm:** `0.5.0` (MINOR — wire-format addition) · **NuGet:** `0.5.0` (MINOR — wire-format addition)

Both packages move together. The shared wire gains one additive `ShellSideEffect` type — no breaking change; existing consumers untouched.

### Added

- **`ShellSideEffect "download"` — first-class authenticated file downloads.** Closes [#10](https://github.com/ashley-shrok/ViewModelShell/issues/10). Header-auth consumers (the `Authorization: Bearer <jwt>` pattern via `getRequestHeaders()`) previously had no way to offer auth-gated downloads: a `LinkNode` with `external: true` is a top-level browser navigation that carries no shell headers, so every auth-gated download endpoint returned 401. The new side-effect rides along with any action response — server authorizes inline (in the action handler, with the real Bearer-authenticated request context), then emits `ShellSideEffect.Download(url, filename?)`; the shell fetches the URL with `getRequestHeaders()` merged, parses `Content-Disposition` (RFC 5987 `filename*` wins over plain `filename`) + `Content-Type`, and saves via the new optional `Adapter.saveFile` capability. **No signed URL machinery required** — the existing header seam is reused. Wire shape: `{ "type": "download", "url": "...", "filename": "..." }` (filename optional).

  C#:
  ```csharp
  return new ShellResponse<MyState>(BuildVm(state), state)
      .WithEffect(ShellSideEffect.Download("/api/invoices/42/pdf", "invoice-42.pdf"));
  ```
  TypeScript backend:
  ```typescript
  return {
    vm: buildVm(state), state,
    sideEffects: [shellSideEffect.download("/api/invoices/42/pdf", "invoice-42.pdf")],
  };
  ```

- **`Adapter.saveFile?(data, filename, contentType)` — new optional capability verb.** Sibling of `navigate?` / `storage?` / `transport?`. `BrowserAdapter` implements it via `URL.createObjectURL` + a transient `<a download>` (revoked on the next tick). `TuiAdapter` writes to `$XDG_DOWNLOAD_DIR` → `~/Downloads` → CWD (filename sanitized — path separators stripped to prevent traversal — and prints the saved path to stderr). Missing the capability on an adapter that receives a `"download"` side-effect **fails loud** via `onError`, never a silent no-op (extends the existing fail-loud rule — a swallowed authenticated download is the same class of correctness/security bug as a swallowed auth-token write).

### Consumers

- **None required — additive.** Existing `ShellSideEffect` consumers untouched (new `Url`/`Filename` fields are optional and null-omitted on the wire). Existing custom `Adapter` implementations untouched — `saveFile?` is optional; adapters that want to support downloads implement the verb. Wire is forward-compatible (unknown side-effect types remain silently ignored). Cross-backend parity passes — the harness already diffs `sideEffects` arrays; the new `download-default` / `download-custom` fixture steps verify .NET and Bun emit byte-identical downloads.

---

## 0.4.9 — Terminal sidebar rail is proportional (npm only)

**npm:** `0.4.9` (PATCH — client-only) · **NuGet:** unchanged at `0.4.2`

No wire, type, or API change; NuGet untouched; major.minor stays `0.4`.

### Changed

- **`layout:"sidebar"`'s rail is now proportional, not a hardcoded 24 cols.** The rail was pinned to ~24 columns regardless of terminal width — ~16% of a 146-col terminal, too narrow for the idiomatic master/detail rail (a view-switcher + list), which hard-wrapped to vertical confetti; the only alternative, `split`, is a fixed 50/50 (too wide a master). On the fill path the rail is now `clamp(round(cols/3), 24, 56)` — ~⅓ on wide terminals (146 → ~49 ≈ 33%), never narrower than the legacy 24 on small terminals, capped so ultra-wide keeps the detail pane dominant — and the detail pane fills the remainder. This is adapter medium-adaptation (the terminal analog of the browser's CSS sidebar proportion); **deliberately not a wire field** — rail proportion is appearance, not layout arrangement, so it carries zero NuGet/parity blast radius. Tunable via `new TuiAdapter({ sidebarFraction: 0.3 })` (0.15–0.6; default ⅓). `split` stays 50/50 by definition; the proportional path is gated to a real interactive TTY so static/non-interactive output is byte-identical.

### Consumers

- **None required.** Client-only; no wire/type/NuGet change; static (`renderTree`) and non-interactive output byte-identical. Terminal master/detail apps now get a usable rail on wide terminals (tune via `{ sidebarFraction }`). Viewport fill / alt-screen / Ctrl-C·SIGINT·SIGTERM teardown re-verified.

---

## 0.4.8 — Terminal link OSC 8 fix (npm only)

**npm:** `0.4.8` (PATCH — client-only bug fix) · **NuGet:** unchanged at `0.4.2`

Long-latent terminal `link` rendering bug. No wire, type, or API change; NuGet untouched; major.minor stays `0.4`.

### Fixed

- **`link` nodes now emit a real OSC 8 hyperlink.** The terminal `link` renderer built its escape string with the ESC introducer and ST terminator missing — `]8;;<href><label>]8;;` instead of `ESC ]8;; <href> BEL <label> ESC ]8;; BEL` — so every `link` rendered as raw `]8;;…` garbage text (then truncated) in every terminal, in and out of tmux. Latent since the node was introduced; orthogonal to the 0.4.5–0.4.7 viewport work (the `link` case was untouched by it; `osc52()` was always correct, `link` simply lacked the escapes). Now emits a correct clickable OSC 8 hyperlink (BEL-terminated, matching `osc52()`'s proven `\x1b`/`\x07` style); terminals without OSC 8 ignore the escape and show just the label — graceful, vs. the old visible garbage. Empty/blank `href` still degrades to plain underlined text (no OSC wrapper) — unchanged.
- **Test gap closed.** The prior assertion only checked for the `]8;;` substring, which is present even in the broken (ESC-less) form, so it never caught this. The test now asserts the full byte form (ESC introducer + URI + BEL ST + closer) — a missing-ESC regression fails loudly.

### Consumers

- **None required.** Client-only bug fix — no wire/type/behavior change for browser/server consumers, no NuGet change. Terminal users with `link` nodes: `0.4.8` is required to get working hyperlinks (`0.4.7` and earlier render them as garbage). Static/non-interactive output now carries a proper escape instead of literal `]8;;` text; alt-screen + Ctrl-C/SIGINT/SIGTERM teardown re-verified.

---

## 0.4.7 — Terminal fill reaches section-wrapped content (npm only)

**npm:** `0.4.7` (PATCH — client-only fix) · **NuGet:** unchanged at `0.4.2`

Completes the `0.4.5`/`0.4.6` viewport-fill work. No wire, type, or API change; NuGet untouched; major.minor stays `0.4`.

### Fixed

- **Section-wrapped content now scales with the terminal.** `0.4.6` propagated fill through the `page`/`layoutContainer` boxes but not into `section` — the idiomatic content container (e.g. the shipped Tasks shape: `page(sidebar)` › `section(card)` rail + `section` detail) — so `sidebar`-laid content still rendered at a fixed intrinsic width while the surrounding surface filled. Root cause: the `width:"100%"` strategy resolved fragilely against an uncertain parent and content-fell-back on the flexShrink rail, and `flexGrow` did not distribute past it. Reworked to **explicit numeric-width threading**: the page container and the page's top layout container take a real numeric width derived from the terminal; the sidebar splits into a fixed numeric rail + an exact-remainder main pane (a single numeric-width column directly holding the sections); everything below fills via Yoga align-stretch from those numeric anchors. `sidebar`, `split`, `stack`, and nested sections now scale and re-flow with terminal size (verified end-to-end against the real adapter at multiple widths). `cards` is intentionally still a uniform small-tile grid.

### Consumers

- **None required.** Client-only; gated on the same real-TTY/alt-screen condition, so static (`renderTree`) and non-interactive (pipe/CI/agent/`</dev/null`) output is byte-identical (verified: core dist + the 143 existing + conformance tests unchanged). Opt-out unchanged: `new TuiAdapter({ viewport: "content" })`. Alt-screen + Ctrl-C/SIGINT/SIGTERM/crash restore re-verified.

---

## 0.4.6 — Terminal viewport fill now reaches the content (npm only)

**npm:** `0.4.6` (PATCH — client-only fix) · **NuGet:** unchanged at `0.4.2`

Completes `0.4.5`. No wire, type, or API change; NuGet untouched; major.minor stays `0.4`.

### Fixed

- **Content now scales with terminal size, not just the (invisible) root.** `0.4.5` made the root surface terminal-sized + alt-screen, but the layout spine didn't propagate that width: `page` → `layoutContainer` panes stayed intrinsic-width, so `layout:"sidebar"`/`"split"`/`"stack"` content rendered at a fixed width at any terminal size (probed: identical at cols=100 and cols=160). Root cause: Ink/Yoga `align-stretch` does **not** reliably fill a nested content column here — an explicit `width:"100%"` on the spine wrappers does. The fix propagates fill (gated on the same real-TTY/alt-screen condition as `0.4.5`) through the `page` container and the sidebar/split/stack layout containers so panes occupy the terminal and re-flow with it. `cards` is intentionally left as a uniform small-tile grid (filling it would defeat the preset).

### Consumers

- **None required.** Client-only; no wire/type/NuGet change; static (`renderTree`) and non-interactive (pipe/CI/agent/`</dev/null`) output is byte-identical (the fill gate is off there). Opt-out unchanged: `new TuiAdapter({ viewport: "content" })`. Alt-screen + Ctrl-C/SIGINT/SIGTERM/crash restore re-verified; width now scales with terminal size (PTY: cols 100 vs 160).

---

## 0.4.5 — Terminal full-viewport + alternate screen (npm only)

**npm:** `0.4.5` (PATCH — additive, client-only) · **NuGet:** unchanged at `0.4.2`

Client-only terminal-adapter enhancement; per the versioning model an npm patch bump while NuGet is untouched (major.minor stays `0.4`). No wire, type, or API change; no backend change.

### Added / Changed

- **The terminal adapter now fills the viewport.** On an interactive TTY `TuiAdapter` occupies the whole terminal via the alternate-screen buffer (vim/htop-style takeover; prior scrollback restored verbatim on exit) and re-flows on `resize`, so `layout: "sidebar"` and any `flexGrow` content expand instead of rendering a small box in a corner — the terminal analog of `BrowserAdapter` filling the browser viewport. Root cause of the old behavior: Ink does not size its root to the terminal, so `flexGrow` had no terminal-sized ancestor to expand into. **This changes the default look on an interactive terminal** (previously intrinsic content size).
- **Opt-out:** `new TuiAdapter({ viewport: "content" })` keeps the prior content-size behavior with no screen takeover.
- **Non-interactive runs are unaffected.** Pipe / CI / agent / `</dev/null` keep the `0.4.4` behavior exactly: one static frame, exit, **no alternate-screen escape emitted**. The fill/alt-screen gate keys off the real `process.stdout`/`process.stdin` TTYs; alternate-screen restore is funnelled through the same idempotent teardown as the cursor restore (re-verified Ctrl-C/SIGINT/SIGTERM/crash).

### Consumers

- **None required for browser/server consumers** — client-only, no wire/type/NuGet change. **Terminal consumers:** the default is now full-screen on an interactive TTY; pass `new TuiAdapter({ viewport: "content" })` if you need the old intrinsic size. Non-TTY/CI behavior is unchanged.

---

## 0.4.4 — Terminal non-TTY crash fix (npm only)

**npm:** `0.4.4` (PATCH — client-only bug fix) · **NuGet:** unchanged at `0.4.2`

Patches a `0.4.3` regression in the new terminal adapter. No wire, type, or API change; NuGet untouched; major.minor stays `0.4`.

### Fixed

- **`vms-tui` no longer crashes on non-TTY stdin.** Run with a non-interactive stdin (pipe, `</dev/null`, CI/cron, an agent shell), the adapter dumped a React/Ink "Raw mode is not supported" error frame instead of degrading to the intended one-shot static render. Root cause: Ink reports `isRawModeSupported` as `undefined` (not `false`) on a non-TTY stdin, and Ink's `useInput` skips raw mode only when `isActive === false` *strictly* — so the gate passed `undefined` and Ink still enabled raw mode. The adapter now coerces the gate to a strict boolean; the CLI additionally treats a non-TTY *stdin* (not only stdout) as non-interactive, preventing a hang when stdout is a TTY but stdin is piped. Interactive terminals are unchanged (Ctrl-C / SIGINT → 130, SIGTERM → 143, cursor restored — re-verified).
- **Missing-optional-deps hint corrected.** `vms-tui`'s hint listed only `ink react`; the adapter also imports `ink-text-input` and `ink-select-input`. The hint now lists all four, and the README documents that programmatic / `bun install` consumers must add them explicitly (optional deps are not pulled transitively).

### Consumers

- **None required.** Client-only bug fix — no wire/type/behavior change for browser or server consumers, no NuGet change. Terminal users in non-interactive shells must take `0.4.4` (`0.4.3` errors there); `npx vms-tui@latest` picks it up automatically.

---

## 0.4.3 — Terminal (TUI) front-end (npm only)

**npm:** `0.4.3` (PATCH — additive, client-only) · **NuGet:** unchanged at `0.4.2`

The packages stay aligned at major.minor `0.4`: this is a client-only npm change, so per the versioning model it takes an npm patch bump while NuGet is untouched — the same independent-patch model used at `0.4.1`. **No wire, type, or API change in either package; no backend change of any kind.**

### Added

- **`@ashley-shrok/viewmodel-shell/tui` adapter + the `vms-tui` CLI.** Drive any ViewModel Shell backend from a terminal — `npx vms-tui <endpoint-url>`, or `new TuiAdapter()` programmatically, wired exactly like `BrowserAdapter`. Same wire, same `(state, action) → { vm, state }` contract, zero backend change: a backend that serves a browser serves a terminal unchanged. Built on [Ink](https://github.com/vadimdemedes/ink) as an **optional** dependency — installed automatically for CLI/`npx` use, never imported by the `.`/`./browser`/`./server` entrypoints, so web and server consumers are byte-unaffected (the compiled core `dist` is byte-identical, machine-verified). A cross-adapter conformance suite asserts the terminal and DOM adapters surface the same information for the same view tree.

### Consumers

- **None required.** Additive and client-only — no wire, type, behavior, or NuGet change; existing browser/server apps are unaffected and need not upgrade. Cross-backend parity is unchanged (the TUI is a client; it cannot affect the wire). Optional: `npx vms-tui <your-endpoint>` to drive an existing app from a terminal.

---

## 0.4.2 — Documentation de-drift (npm + NuGet, docs only)

**npm:** `0.4.2` (PATCH — README only) · **NuGet:** `0.4.2` (PATCH — packaged README only)

**No code, type, wire, or API change in either package.** Both packages move together at `0.4.2` solely to ship corrected package READMEs; major.minor stays aligned at `0.4`.

### Fixed

- **NuGet packaged README no longer enumerates the `ViewNode` set.** The shipped `README.md` "What's in the package" section hand-listed the node types and had fallen behind the assembly — it omitted `CopyButtonNode`, which is present in the `0.4.0` and `0.4.1` DLLs (the type was added before `0.4.0` shipped). That stale list — *not* any missing type — is what [issue #9](https://github.com/ashley-shrok/ViewModelShell/issues/9) reported. The README now points to `ViewModels.cs` as the single source of truth instead of duplicating the list, so it cannot drift from the assembly again. The `0.4.0`/`0.4.1` assemblies were always correct (a .NET backend on either *can* emit `copy-button`); this release only refreshes the README rendered on nuget.org.
- **npm packaged README corrected.** It still claimed the base stylesheet "ships a dark-purple theme" and listed the theme files inline; the shipped default has been **light** since `0.4.0`. The default-theme text is now accurate and points to `styles/themes/` rather than an inline list that drifts as themes are added.

### Consumers

- **None required.** Doc-only — no behavior, wire, or type change. Upgrade only to read the corrected package pages; not needed for any functional reason. Cross-backend parity remains 7/7 byte-identical (verified).

---

## 0.4.1 — Table-row variants styled (npm) · null-omission made intrinsic (NuGet)

**npm:** `0.4.1` (PATCH — stylesheet only) · **NuGet:** `0.4.1` (PATCH — serialization hardening; **no contract/type change** — symmetric to how npm `0.4.1` was a NuGet-untouched CSS patch; the wire *contract* is unchanged, only non-conforming hosts are corrected toward it)

The two packages moved independently at `0.4.1` (the versioning model permits this for patch-level package-local changes; major.minor stays aligned at `0.4`). npm `0.4.1` shipped first (CSS only); NuGet `0.4.1` ships the serialization fix below.

### Fixed — npm (stylesheet)
- **`vms-table__row--<variant>` was a styled-only-for-some passthrough.** `browser.ts` emits `vms-table__row--${variant}` for *any* `TableRow.Variant`, but `default.css` shipped rules for only `clickable/done/warning/critical`. `disabled`, `success`, `danger`, and `running` were **emitted-but-unstyled** — forcing consuming apps to keep an app-local CSS shim to mute/tint those rows, which contradicts the "apps shouldn't roll their own CSS" goal. (The original report flagged only `--disabled`; full audit found `success`/`danger`/`running` equally unstyled — all four are now closed, so *every* such shim can be deleted, not just the disabled one.) Added, mirroring the `.vms-list-item--*` precedent:
  - `--disabled` — `opacity` + `var(--vms-text-muted)`; also neutralises the `--clickable` cursor/hover when a row is both.
  - `--success` / `--running` / `--danger` — subtle full-row status tints.
- **`--warning`/`--critical` re-based onto theme vars.** They previously hardcoded non-themeable `rgba()` literals that ignored a custom `:root`; now `color-mix(in srgb, var(--vms-…) 8–9%, transparent)` like the new variants, so all row tints recolor automatically under any theme (latent bug fixed). `--danger` is a `--critical` alias (shared `--vms-error` tint), matching `.vms-button--danger`/`.vms-list-item--critical`.

### Fixed — NuGet (serialization contract)
- **Null-omission is now intrinsic to the published wire types.** The contract has always been "an unset optional is *absent*, never `"field": null`" (npm `.d.ts` declares optionals as `T | undefined`; the parity normalizer treats `null` ≡ missing; the renderer tolerates both). But on the .NET side this was enforced *only* by host boilerplate — `DefaultIgnoreCondition = WhenWritingNull` in `Program.cs` (documented as footgun #6 in `AGENTS.md`). A host that skipped it (e.g. default ASP.NET web JSON options) emitted `"placeholder": null`, so consumers with strict TS wire-fidelity tests failed `tsc` against the correct published `.d.ts`. Every nullable (`T?`) member of every outbound wire record now carries `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`, which System.Text.Json honors **regardless of host `JsonSerializerOptions`**. The contract is now self-enforcing and cannot drift per app; footgun #6 is disarmed (the `Program.cs` line becomes redundant defense-in-depth). Non-nullable members (incl. `bool`/`int` with semantic defaults like `Required:false`) deliberately still serialize their value. *Rejected the alternative "widen npm types to `T | null`" — that would corrupt a correct published contract to legitimise a misconfigured host.*

### Consumer action
- **npm:** bump to `^0.4.1`. CSS-only — no wire/API/ViewNode change, existing apps render unchanged unless they used these variants. Delete any app-local `.vms-table__row--{disabled,success,danger,running}` shim. (`color-mix()` is Baseline-2023; the shipped default already requires modern CSS — `clamp()` etc.)
- **NuGet:** bump to `^0.4.1`. **Correctly-configured hosts (those following the documented `Program.cs`): zero wire change — byte-identical.** Misconfigured hosts: their wire is *corrected* (stray `"field": null` → field absent), matching the published `.d.ts` — delete any per-app `T | null` casts / wire-fidelity test workarounds. No `ViewNode`/type/contract change; cross-backend parity for the wire contract (the `feature-probe` fixture) stays green across dotnet/bun/node. The `Program.cs` `DefaultIgnoreCondition` line is now optional (kept in demos as harmless defense-in-depth).

---

## 0.4.0 — Design system: theme + layout + canonical examples

**npm:** `0.4.0` (MINOR) · **NuGet:** `0.4.0` (MINOR — wire-format change, aligned)

One consolidated milestone: a serviceable shipped default look, an additive layout-preset enum, and the canonical-example surface. The npm `0.3.14`→`0.4.0` / NuGet `0.3.10`→`0.4.0` jump is a **MINOR because the `layout` enum is a wire-format change** — by the [`AGENTS.md`](./AGENTS.md) `major.minor`-alignment rule both packages move together (this is the same rule that kept `0.3.13` a PATCH because it had *no* wire change — symmetric reasoning, opposite outcome).

### Realistic-demo stress-test (post-execution, D-26–D-29)

A human visual review rebuilt every demo to look like a real app of its type; it surfaced gaps closed as small **additive** semantic presets (no wire-breaking change — new fields optional, omitted = prior behavior byte-identical):

- **D-26** — fixed 5 dark themes (`dark-blue/green/rose/amber/teal`) the light re-base broke (accent-only partials that had inherited the old dark default); now self-sufficient full overrides. New CI guard `check:theme-function` asserts every theme yields its named scheme. *Consumers: none — corrected files; the `dark-purple` one-line restore is unchanged.*
- **D-27** — shipped `.vms-list-item--active` default (master-detail / nav selection highlight; themable via accent seam vars, no wire change). *Consumers: set `variant:"active"` on the selected row to use it.*
- **D-28** — new `layout:"sidebar"` value on `PageNode`/`SectionNode` (thin + wide app shell; wraps to stacked on narrow, zero `@media`). Additive enum value. *Consumers: opt-in.*
- **D-29** — new `FormNode.layout?: "stack" | "inline"` (`inline` = field row + submit on one line — add/search bar). Additive optional field. *Consumers: opt-in.*

Deferred (explicit, not silent): HelpDesk requester realistic redesign; FeatureProbe value-level parity for the new `sidebar`/`inline` values (the layout *field* is parity-covered; opaque string values can't drift between backends); `.vms-list-item` is a fixed horizontal row (cramps very narrow columns — a list-item layout option is the real fix); `LAYOUT-F1` fixed-N grid stays deferred (`cards` proven a credible board).

### Added
- **Shipped default design system** — `viewmodel-shell/styles.css` now delivers a centered `.vms-page` page shell (`--vms-page-max: 1080px`, `clamp()`-padded, zero `@media`), a coherent additive spacing scale (6 `--vms-space-*`) and type scale (7 all-`rem` `--vms-text-*`), so the look is handled with zero app CSS.
- **`PageNode.density?: "comfortable" | "compact"`** — additive optional closed-union wire field (both backends); `compact` remaps the rhythm tokens. Omitted/`comfortable` is byte-identical to prior behavior.
- **`SectionNode.variant?: "card"`** — additive optional closed-union wire field (both backends); grouped card surface built from existing seam vars, zero new color tokens.
- **`layout?: "stack" | "split" | "cards"`** on `PageNode`/`SectionNode` — additive optional closed-union layout-preset enum (both backends). `split` = capped-2-equal-column intrinsic grid collapsing to 1 narrow; `cards` = auto-fit grid from one additive `--vms-card-min: 16rem`. Pure CSS, no spans/tracks/areas on the wire.
- **`themes/dark-purple.css`** — a new shipped theme file that is a byte-exact capture of the prior (pre-0.4.0) dark default `:root`. Importable as `@ashley-shrok/viewmodel-shell/themes/dark-purple.css`.
- **Canonical reference set** — the Showcase gains navigable Dashboard / Form-heavy / List-detail archetypes (benchmarked against Bootstrap's Dashboard/Checkout/Album pages) alongside the kitchen-sink component gallery; every demo runs on the shipped stylesheet with zero per-demo `<style>` chrome.

### Changed
- **Shipped default palette re-based dark→light.** The unthemed `default.css` `:root` now uses the light `light-purple` value set (`--vms-bg #f7f7f9`, `--vms-surface #fff`, `--vms-accent #5a4ad7`, `--vms-color-scheme light`) instead of the prior dark default. This is an **intentional default-appearance change, NOT a wire/API/ViewNode break**. `themes/light-purple.css` is byte-unchanged (it becomes a harmless no-op override). The prior dark look is preserved byte-exact in the new `themes/dark-purple.css`.
- **One shipped-default value tightened for WCAG-AA.** The unthemed default's `--vms-warning` ships as `#a37510` (a slightly darker amber than `light-purple.css`'s `#c89610`) so the shipped default clears the WCAG-AA non-text contrast floor (≥3.0:1 on `--vms-bg`/`--vms-surface`/`--vms-surface-2`; was 2.51/2.68/2.36:1, now 3.84/4.11/3.62:1, CI-enforced). This is **only** the unthemed shipped default — consumers importing `themes/light-purple.css` explicitly still get `#c89610` (that theme file is byte-unchanged). Same one-value-tighten-to-pass-AA precedent as the `0.3` `--vms-text-muted` fix; it is not a seam behavior change (the variable still exists and themes still override it).
- **Demos de-chromed** onto the shipped stylesheet — per-demo hand-rolled `<style>` blocks removed; each demo statically pins a distinct shipped theme via its entrypoint import (the real-app pattern).

### Consumer action
- **None required for the wire contract.** The `layout`, `density`, and `variant` fields are all **additive optional closed unions** — omitted = byte-identical prior behavior; cross-backend parity stays 100% green. Existing apps render unchanged unless they opt in.
- **The shipped default look changed dark→light.** If you relied on the prior dark default and set **no** theme / no `:root`, restore the exact prior look with one line: `import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css";`. Existing apps that already set their own `:root` or import any theme are **unaffected** (the default never applied to them).
- The npm `0.3.14`→`0.4.0` / NuGet `0.3.10`→`0.4.0` jump is a MINOR because the `layout` enum is a wire-format change — by the `AGENTS.md` `major.minor` rule both packages move together (symmetric to the `0.3.13` "why PATCH" explanation: no wire change → PATCH; wire change → aligned MINOR).
- Full detail and the upgrade walkthrough: [`MIGRATION.md`](./MIGRATION.md).

---

## 0.3.14 — CopyButtonNode (copy text to clipboard)

**npm:** `0.3.14` (PATCH) · **NuGet:** `0.3.10` (PATCH — new ViewNode type on both sides)

### Added
- `CopyButtonNode` (`type: "copy-button"`) — inline copy-to-clipboard node. Set `text` (the string to copy), optionally `label` (button label, default "Copy") and `copiedLabel` (ephemeral feedback label, default "Copied!"). Pure adapter-side: no dispatch, no server round-trip. Browser adapter writes via `navigator.clipboard.writeText`; falls back to legacy `execCommand("copy")` on insecure contexts; silent on both failures.

### Consumer action
- **None required.** Additive; backward-compatible. Use `new CopyButtonNode(text)` (.NET) or `{ type: "copy-button", text: "..." }` (TypeScript) to include a copy button anywhere in the view tree.

---

## 0.3.13 — Capability seam + upload progress

**npm:** `0.3.13` (PATCH) · **NuGet:** `0.3.9` (unchanged — no .NET/wire change)

**Architecture:** The core (`src/index.ts`) is now a strict wire-protocol transformer that references **zero platform globals** — a CI-enforced, checkable invariant, not an aspiration. `window.location`/`localStorage`/`sessionStorage` relocated out of core into `BrowserAdapter` behind a capability seam (`navigate?`/`storage?`/`transport?` optional `Adapter` methods).

### Added
- `ShellOptions.onUploadProgress?: (sent: number, total: number) => void` — real upload progress for file-bearing dispatches, built through the new `transport` seam (XHR binding lives in `BrowserAdapter`, never core).

### Consumer action
- **None required.** Fully backward-compatible. `transport?` is optional; `fetch` remains the universal default. Existing custom `Adapter` implementations keep working. Wire format, redirect, side-effects, polling, all ViewNode types unchanged.
- Opt into upload progress by setting `onUploadProgress`. Note two documented behaviors: it only fires if the active adapter implements `transport` (`BrowserAdapter` does); and `total` may be `0` meaning indeterminate — guard against divide-by-zero in percentage math.
- Full detail and upgrade steps: [`MIGRATION.md`](./MIGRATION.md).

## 0.3.12 — Scoped box-sizing reset

**npm:** `0.3.12` (PATCH) · **NuGet:** unchanged

### Fixed
- `.vms-field__input` and `.vms-table__filter-input` overflowed padded containers (missing `box-sizing`). Fixed with `box-sizing: border-box` scoped to `.vms-page`/`.vms-modal-backdrop` subtrees — not a global `*` reset (the opt-in stylesheet must not stomp host-app elements).

### Consumer action
- Bump npm to `^0.3.12`. CSS-only; remove any local `box-sizing` override you added to work around this.

## 0.3.11 — Compiled output (works in plain Node)

**npm:** `0.3.11` (PATCH) · **NuGet:** unchanged

### Changed
- Package now ships compiled `.js` + `.d.ts` (was raw `.ts`). Previously failed in vanilla Node with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`; worked only under Bun/Deno/bundlers.

### Consumer action
- Use `^0.3.11`. Transparent to bundler/Bun consumers; **unblocks plain-Node consumers** (no loaders/flags needed). Same imports, resolves to compiled output.

## 0.3.10 — TypeScript backend subpath

**npm:** `0.3.10` · **NuGet:** unchanged

### Added
- `@ashley-shrok/viewmodel-shell/server` subpath — backend types + `createAction`, `parseFormDataAction`, `parseJsonAction`, `shellRedirect`, `shellSideEffect`. Web Fetch–native (Hono/Bun/Deno/Workers). Mirrors the NuGet backend; same npm package so types can't drift.

### Consumer action
- None for existing consumers. New: TypeScript backends can drop .NET. (Prefer `^0.3.11` — see above; 0.3.10 raw-TS fails in plain Node.)

## 0.3.4–0.3.9 — Feature run

Shipped as patch bumps (project convention: features are patches; minor reserved for ViewNode/wire-format changes that move both packages):

- **0.3.9** — `ActionPayload<TState>.ParseJson` for JSON-body action dispatch (curl/agent ergonomics alongside multipart). *NuGet.*
- **0.3.8** — `ModalNode.Size` (`narrow`/`medium`/`wide`/`fullscreen`) + table horizontal-scroll on overflow. *Both.*
- **0.3.7** — Fix: table clipping inside `ModalNode` (`flex-shrink:0` on modal-body children). *npm.*
- **0.3.6** — Polling + push: `pollInterval`, `ShellResponse.NextPollIn`, `shell.push()`. *Both.*
- **0.3.5** — Client side-effects: `set-local-storage` / `set-session-storage` via `ShellSideEffect`. *Both.*
- **0.3.4** — Server-initiated redirect: `ShellResponse.RedirectTo(url)` + `onRedirect` hook. *Both.*

### Consumer action
- All additive/backward-compatible. Bump to latest to access; no migration required.

## 0.3.1–0.3.3 — Early iteration

Initial dual-package publish, packaging/styling stabilization. No consumer action.

---

*For the capability-seam architectural change (0.3.13), see [`MIGRATION.md`](./MIGRATION.md). For cross-backend wire-format guarantees, see `AGENTS.md`.*
