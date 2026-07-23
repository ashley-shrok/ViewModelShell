# Framework Capability-Gap Survey — the Basics We Haven't Named Yet

**Status:** Research synthesis for triage. No implementation yet.
**Date:** 2026-07-23
**Question being answered:** VMS's one framework survey of record (`layout-system-research.md`, 2026-06-28) was scoped **entirely to layout primitives**. Rich text was never in frame. When Poppy needed inline-formatted content for PBMInvoices and the gap surfaced in the fabric of a live consumer request, Ashley banked the reasonable follow-on: *"revisit existing frameworks besides this one for things that we might have gaps on."* This doc closes the meta-hole. Not one primitive — the audit. What OTHER basic capabilities are we missing that we won't see until a consumer trips over them, because we've never surveyed by **capability category**?

This is the survey the layout research was NOT. Ten mature UI frameworks were audited in two populations: **four component libraries** for the boring-completeness inventory (Bootstrap, MUI, Ant Design, Chakra) and **six server-driven / wire-format frameworks** for the shape-fit study (Phoenix LiveView, Rails Hotwire + ViewComponent, Laravel Livewire + Filament, Blazor Server, Streamlit, HTMX + DaisyUI). Sources cited at the bottom.

---

## The headline (and the surprise)

**VMS is much more category-complete than a naive glance would predict — and the real gaps cluster in a specific, narrow place.** The audit turned up ~40 candidate primitives across nine categories; 26 of them are already covered by an existing VMS node, an axis on one, a side-effect verb, a response-envelope field, or a compose-from-primitives pattern documented in `AGENTS.md`. What's genuinely missing is not a category — it's **two clusters that share a shape reason**:

1. **Basic form-input diversity.** Four inputs Bootstrap-and-up ship as universal are missing from `FieldNode.inputType`: `radio`, `range` (slider), `rating`, `color`. Two more (`rich-text`, `pin/otp`) are shipped by 3-of-4 comp libs and Filament. This is the layout-survey lesson replayed in a different aisle: our closed input-type union grew by need, and needs never surfaced these because our early demos were workflow apps (queues, tickets, tables), not the survey/rating/creative-tool shape where these inputs live.

2. **Anchored overlays.** VMS ships one overlay primitive (`ModalNode`, centered-only). All four component libraries and three of six server-driven peers ship at least three: **popover** (anchored, click/hover-triggered content), **tooltip** (anchored, hover-only, info-only), and **drawer / side-panel** (edge-anchored modal variant). These aren't compose-able from primitives — anchored positioning is DOM-level, not tree-level — so they can't quietly appear from an app doing something clever. They're a genuine framework gap.

**The other findings are less flashy but confirm the method.** The recent v3.5.0 "feedback primitives" release (toast/empty-state/badge) was already an audit-driven ship — it closed the feedback category cleanly, so nothing there is missing today. v6.11.0 (this session's ship — prose typography) closed the exact rich-text-output gap that triggered this survey. The `lookup` inputType (Phase 21) closed the autocomplete/combobox/tags category. `SectionNode.variant:"card"` covers Card. `StatBarNode` covers Statistic/Metric. `SectionNode.collapsible` covers Accordion. `TabsNode` covers Tabs. `TableNode` covers Table (with sort/filter/pagination/selection/rowAction/empty). **VMS's targeted, need-driven growth has been effective** — the surprises are almost all "already shipped, forgot to check."

The one place the method itself changes: **surveys by capability category run PROACTIVELY, not reactively.** The layout survey was reactive (a request came in; we researched the space to answer it). This survey is proactive (there was no ask; we ran it to *find* asks before they fired). That method-shift is what needs to fold into `AGENTS.md` — the primitives it surfaces are follow-on decisions.

---

## The two principles this survey validates (candidates for `AGENTS.md`)

Every future capability-category survey should pass these two tests — same shape as the P1/P2 layout gates:

1. **Survey by CAPABILITY CATEGORY, not by need.** The category axis is fixed regardless of what a consumer is asking for; the layout research answered a real question and did it well, but the axis it chose (layout primitives) meant text/content was never in scope, so a text/content gap could not surface. Category-first means a survey run on any Monday would find the same gaps regardless of what week's request happened to arrive first.

2. **Survey the RIGHT population for the question being asked.** The banked lookup-field lesson — *"a survey's unanimity is only evidence if you know what constraint produced it"* — applies category-by-category. For an INVENTORY completeness check ("does everyone ship this thing?") the right witnesses are the four flagship component libraries (Bootstrap, MUI, Ant, Chakra) — they compete on breadth, so their union is the ceiling. For SHAPE-FIT decisions ("how should we express this on the wire?") the right witnesses are the server-driven peers that share our constraints (LiveView, Livewire+Filament, Blazor, Streamlit, Hotwire, HTMX+DaisyUI) — a client-only editor's answer is often an artifact of them not having a server to ask, not an actual design decision.

Both witness populations run per category. Neither alone is enough.

---

## The capability categories (the axis)

Cross-referenced against the four flagship component libraries' own top-level component groupings — MUI's sidebar, Ant Design's overview, Chakra's categories, Bootstrap's Components/Layout/Content/Forms split. Nine categories cover ~98% of what ships in any of them, with two crosscutting concerns (icons, utility primitives) that don't get category rows.

1. **Layout** — arrangement primitives, page/section containers, grids, stacks, dividers.
2. **Typography & Content** — headings, body text, links, blockquotes, code blocks, inline emphasis, prose scope.
3. **Data display** — tables, lists, cards, statistics, charts, timelines, badges (as info), tags.
4. **Data entry / Forms** — form scaffolding, every input type, buttons, form validation display.
5. **Navigation** — tabs, breadcrumbs, menus/dropdowns, steppers, pagination-as-nav.
6. **Feedback / Status** — progress bars/spinners, alerts, notifications/toasts, skeletons, empty states, badges (as counters).
7. **Overlay** — modals/dialogs, popovers, tooltips, drawers/sheets.
8. **Media** — images, avatars, video, icons, carousels.
9. **Disclosure** — collapsibles, accordions, trees.

---

## What VMS already has — per category (the honest baseline)

The completeness of this table is why the "surprise" above lands. Every entry maps to an existing node/axis/side-effect/envelope field in `viewmodel-shell/src/index.ts`.

| Category | VMS today |
|---|---|
| **Layout** | `PageNode` (density × 6 layouts: stack/split/cards/sidebar/row/switcher + arrange/align/threshold/limit/minItem/fill/width), `SectionNode` (variant:"card"|"prose", tone, fill, collapsible), `FitsNode` (responsive selection), `DividerNode`. Passes the P1/P2 layout gate. |
| **Typography & Content** | `TextNode` (styles × tone × alignment + level 1..6 + inline `InlineRun[]` for bold/italic/mono/link), `LinkNode`, `BlockquoteNode`, `CodeBlockNode`, `SectionNode variant:"prose"` (v6.11.0 — Tailwind-typography rule set), companion `AshleyShrok.ViewModelShell.Markdown` for markdown→ViewNode. |
| **Data display** | `TableNode` (columns/rows/pagination/selection/sortable/filterable/rowAction/empty), `ListNode` + `ListItemNode` (state axis), `StatBarNode`, `ChartNode`, `TrackerNode`, `DiffNode`, `StepsNode` (progress display), `BadgeNode`, `EmptyStateNode`, `ImageNode` (shape:"circle" covers avatar-in-context). |
| **Data entry / Forms** | `FormNode`, `FieldNode` × **16 inputTypes** (text/email/password/number/date/time/datetime-local/textarea/hidden/file/select/select-multiple/checkbox/lookup/lookup-multiple/code), `CheckboxNode`, `ButtonNode` (tone × emphasis × size × width + confirm + pendingLabel), `CopyButtonNode`. Structured validation via response-level `rejected: { violations: [{path, message}] }` + per-field `error`. |
| **Navigation** | `TabsNode`, `BreadcrumbNode`, `LinkNode`, `TableNode.pagination` (nav-within-table), `PageNode.layout:"sidebar"` (app-shell nav). |
| **Feedback / Status** | `ProgressNode`, `BadgeNode`, `EmptyStateNode`, `TextNode` with tone (inline alerts), response-level `busy` (drops user dispatches + `.vms-busy`), response-level `preventUnload` (leave-guard), response-level `rejected` (soft validation), response-level `errors[]` (hard failures), **toast** as ShellSideEffect + optional `Adapter.toast?()` (v3.5.0), `FieldNode.error` (per-field). |
| **Overlay** | `ModalNode` (centered; width medium/wide/narrow; title/children/footer/dismissAction). |
| **Media** | `ImageNode` (shape:"circle" for avatars, caption for figures). |
| **Disclosure** | `SectionNode.collapsible: true` (native `<details>`; state DOM-local, keyed by id/heading). |

**Response envelope + side-effect verbs** (crosscutting):
- `redirect`, `sideEffects[]` (`set-local-storage`, `set-session-storage`, `download`, `toast`), `pollInterval` / `nextPollIn` (server-controlled polling + `shell.push()` external push), `preventUnload`, `busy`, `ok`, `rejected` (soft), `errors[]` (hard).

---

## Candidate gaps — per category, with the easy-yes verdict

The easy-yes test on each candidate: (a) **composition** — is it already expressible in primitives with acceptable ceremony? (b) **containment** — does it fit VMS's shape (stateless server, closed vocabulary, intrinsic responsiveness, agent-legible, describe-not-decorate)? (c) **precedent depth** — how many of the ten surveyed frameworks ship it? (d) **real consumer signal** — any known request?

### Layout — no gaps

Every candidate surfaced (Ratio/AspectRatio, Bleed, Float, Absolute-Center, Group) is either bespoke-taste (1-of-4 comp libs) or expressible via the shipped set. The layout survey's own conclusion holds. `PageNode.fill` + `SectionNode.fill` (v3.6.0) closed the block-axis / full-height app-shell gap.

### Typography & Content — no gaps as of v6.11.0

`SectionNode.variant:"prose"` this session closed the last content-side gap. Everything else surveyed (Highlight, Mark, Em, Kbd, Prose primitive) is either an inline `<InlineRun>` role, a scoped-prose behavior, or narrow Chakra-only taste. Rich-text INPUT is a separate category (Data entry) — kept there.

### Data display — one narrow candidate

**Timeline** (3/4 comp libs + DaisyUI ship a first-class Timeline; no server-driven peer does) — a vertical list with a rail + markers, useful for audit logs / activity feeds / project history. **Compose-able** today with `ListNode` + tone axis + a marker column, at some ceremony. **LOW priority** — no consumer signal, composable, and no server-driven peer bothers.

### Data entry / Forms — the biggest cluster of real gaps

The audit's densest hit-rate. Six candidates, ranked:

| Candidate | Precedent | Compose today? | Verdict |
|---|---|---|---|
| **`radio` inputType** | 4/4 comp libs, universal server-driven | **No** — closest is `select` which is UX-wrong for ≤5 options | **HIGH** — basic, purely additive to the `inputType` union, cheap ship |
| **`range` / slider inputType** | 4/4 comp libs, 2/6 server-driven | **No** — no equivalent primitive | **HIGH** — basic, additive to `inputType`, cheap ship. Deferrable but there's no reason to |
| **`rich-text` / `markdown` inputType** | Filament (2 flavors) + Chakra ship first-class | **No** — closest is `textarea` (plain) or `code` (monospaced) | **MEDIUM** — mirrors the `code` "attach-a-library" pattern (declare inputType, app attaches Tiptap/Prosemirror/etc.); framework ships the input, not the editor |
| **`rating` inputType** | 3/4 comp libs, DaisyUI | Weak — could compose a row of `CopyButtonNode` w/ tone, tedious | **LOW-MEDIUM** — narrow but universal; ~1-2 hours to ship |
| **`color` inputType** | 3/4 comp libs (Ant/Chakra), 2/6 server-driven | Weak — could compose a select of named colors | **LOW** — real gap but narrow use |
| **`pin` / OTP inputType** | 3/4 comp libs, DaisyUI | Weak — could compose N `text` inputs w/ maxLength=1 | **LOW** — narrow (auth flows only), composable |
| **File-upload progress + drag-drop enhancements** | 4/6 server-driven treat per-file progress + drag-drop as first-class | Partially — VMS has `file` inputType + `uploadOn` routing; per-file progress absent | **MEDIUM** — additive on top of existing `file` inputType; XHR-progress hook already exists (`Adapter.transport.hooks.onUploadProgress`); missing tree-side is a per-file entry with `progressAction?` |
| **Repeater / dynamic sub-form** | Filament (Repeater + Builder), LiveView (`inputs_for` w/ dynamic), Streamlit (`data_editor`), Blazor (EditForm foreach) — **4/6 server-driven** | Yes, with real ceremony — `ListNode` of grouped fields + add-row action + per-row remove action + `SelectedIds` map + reconciliation | **MEDIUM** — no primitive miss (composes), but ceremony cost is genuine; a dedicated helper node would remove the reconciliation footgun the current pattern requires |

### Navigation — one composable ceremony gap + one shape-clarify

| Candidate | Precedent | Compose today? | Verdict |
|---|---|---|---|
| **Anchored menu / dropdown** (a button that reveals a menu of links/actions anchored to itself) | 4/4 comp libs universal | No — anchored positioning is DOM-level | **MEDIUM** — same anchored-overlay shape as popover; often ships together |
| **Wizard container** (multi-step form with per-step validation, back/next, progress) | Filament `Wizard` + DaisyUI `Steps` + MUI `Stepper` — **4/6 comp libs, 3/6 server-driven** | Yes, ceremonially — server holds current step in state, renders per-step form, `StepsNode` renders progress; multiple form nodes on multiple actions | **LOW-MEDIUM** — `StepsNode` today is display-only; a `WizardNode` would fuse it with the multi-step form container. Composition works if slightly clunky. Consider the ergonomics after 2-3 real consumer wizards land |
| **Anchor / Scrollspy** | Ant `Anchor`, Bootstrap `Scrollspy` — 2/4 | Yes | **LOW** — narrow use (documentation pages), composable |

### Feedback / Status — no gaps after v3.5.0

The 3.5.0 audit-driven cluster (toast + empty-state + badge) explicitly closed this category. Skeleton (per-region loading placeholder) is the one remaining candidate — 4/4 comp libs ship it — but the response-level `busy` covers the aggregate need and no consumer has surfaced a per-region case. **LOW**, deferred.

### Overlay — the second biggest cluster of real gaps

All three anchored overlays are missing, and none compose from `ModalNode`. **All three ship together in every mature framework** for a reason: they share DOM-level anchor-positioning code, so one adapter change gives you all three. Ranked together:

| Candidate | Precedent | Compose today? | Verdict |
|---|---|---|---|
| **`PopoverNode`** — anchored content panel (click-triggered, dismissible, can contain arbitrary tree) | 4/4 comp libs, DaisyUI, Filament | No — anchored positioning is DOM-level | **MEDIUM-HIGH** — universally shipped; genuine missing category. Ships with tooltip + drawer as one cluster or separately |
| **`TooltipNode`** OR **`ButtonNode.tooltip?`** / `LinkNode.tooltip?` — hover-only info | 4/4 comp libs | No — anchored positioning | **MEDIUM** — often a prop on other nodes, not its own node. Design question: prop-on-existing-nodes (native `title=`) or first-class node with rich content? |
| **`ModalNode.position?`** (drawer) — `"center" \| "left" \| "right" \| "top" \| "bottom"` | 4/4 comp libs (all named different — Drawer/Offcanvas/Sheet) | No — a drawer is a modal-position variant | **MEDIUM** — additive to the existing `ModalNode`; cheapest of the three to ship since it's just a new closed-union field |

Recommendation: design the three together as an **"anchored overlay" epic** — one design doc, one implementation cluster; the `Adapter` gains one anchored-positioning capability that all three ride. This is how the four component libs actually ship them (a shared floating-ui / popper.js dependency underlies all three across every lib).

### Media — no gaps for our shape

**Carousel** (4/4 comp libs) and **Video** (0/4 comp libs — media type gaps in EVERY lib) are LOW: workflow/enterprise apps don't reach for them, and the ImageNode + a real video player library (native `<video>` tag through a custom node) can serve when needed.

### Disclosure — no gaps

`SectionNode.collapsible` covers the accordion pattern (stacked collapsibles = accordion). **Tree view** (2/4 comp libs, Filament) is missing but LOW: nested-collapsible from `SectionNode` composes at reasonable ceremony, and consumer signal is null.

---

## The ranked shortlist — this is Ashley's triage input

Ordered by (real-consumer-signal × precedent-depth × ease-of-yes ÷ ceremony-to-work-around):

### 🔴 HIGH — basics that Bootstrap-and-up ship, VMS doesn't, cheap to close

1. **`FieldNode.inputType: "radio"`** — 4/4 comp libs. No workaround (`select` is UX-wrong for ≤5 options). Purely additive to the `inputType` closed union + `options[]` reuse. **Estimated cost: ~2-3 hours + docs + tests.**
2. **`FieldNode.inputType: "range"`** (slider) — 4/4 comp libs. No workaround. Purely additive; reuses `min`/`max`/`step`. Same shape as `number` in wire. **Estimated cost: ~2-3 hours + docs + tests.**

Both are one small parity fixture each, no version-breaking concerns. If Ashley says go, these ship in one batch.

### 🟠 MEDIUM — real gaps with a shape decision worth making up-front

3. **Anchored overlays cluster** (Popover + Tooltip + Drawer-as-Modal-variant). One design doc, one impl cluster. **This is the biggest single missing surface.** Recommend planning as one dedicated `/gsd:plan-phase`. All three ship in every comp lib.
4. **`FieldNode.inputType: "rich"` / `"markdown"`** (mirroring the `code` "attach-a-library" pattern) — Filament ships two flavors; consumers routinely need WYSIWYG or markdown editing. Cheap ship (declaration only; the app attaches Tiptap/Prosemirror/EasyMDE etc.), and the pattern is already precedent-set by our own `code` inputType.
5. **File-upload progress + drag-drop** — 4/6 server-driven peers ship per-file progress + drag-drop as first-class. Additive on top of the existing `file` inputType; the `Adapter.transport.hooks.onUploadProgress` XHR hook is already the seam. Missing: a tree-side per-file entry with `progressAction?` so the server can render progress.
6. **Repeater / dynamic sub-form primitive** — 4/6 server-driven peers ship this. Not a primitive miss (compose today) but the reconciliation ceremony is real. Worth considering if 2-3 consumers actually need it before shipping.

### 🟡 LOW — narrow / composable / deferrable

7. **`FieldNode.inputType: "rating"`** — 3/4 comp libs, narrow.
8. **`FieldNode.inputType: "color"`** — 3/4 comp libs, narrow.
9. **`FieldNode.inputType: "pin"` / OTP** — 3/4 comp libs, auth flows only.
10. **Wizard container node** — composable; consider after 2-3 real consumer wizards.
11. **Timeline node** — composable; no server-driven peer bothers.
12. **Tree view** — composable via nested collapsibles; no consumer signal.
13. **Skeleton loader** — `busy` covers the aggregate; no per-region need surfaced.

### ⚪ Existing bounties this survey confirms (not new work — evidence for their standing)

- **`tablenode-virtualization`** (Poppy, low) — Blazor `Virtualize`, LiveView `stream/3`, HTMX `revealed` all ship this. Precedent depth confirms the standing bounty.
- **`empty-state-on-collections`** (medium, on_deck) — this survey validates it: 3/4 comp libs express empty-state as a *property of the collection component*, not a sibling primitive. The direction of that bounty (devolve onto Table/List) is the right shape.
- **`framework-gap-survey`** (this bounty — HIGH, in_progress) — closes on this doc.

---

## What VMS explicitly REJECTS from the audit — with reasoning

Naming the rejections so future audits don't re-litigate:

| Pattern | Present in | Why VMS doesn't (and won't) ship it |
|---|---|---|
| **Per-binding debounce/throttle DSL** (`hx-trigger`, `phx-debounce`, `wire:model.debounce`) | LiveView, HTMX, Livewire | Phase 21's design settled this: `blocking: false` is always the app's opt-in choice; the framework never sets or upgrades a lane. The Enter-cadence blocking search that came out of that phase is the doctrine, and it's a correctness property (the dispatch guard serializes; no stale response can clobber a newer action). A debounce DSL would tempt apps into the exact stale-response race that phase eliminated structurally. |
| **Client-side hook (`phx-hook`, Stimulus controller, `wire:model.lazy`)** | LiveView, Hotwire, Livewire, Blazor JS interop | The `Adapter` capability seam is the intentional analogue — a *renderer-wide* capability opt-in, not a per-node DOM escape hatch. A per-node hook would leak app-specific DOM behavior into the wire, breaking the "apps describe, never decorate" principle and the "core stays platform-agnostic" invariant. |
| **Named-slot / portal / section-outlet** (Blazor `SectionContent`/`SectionOutlet`, LiveView `portal/1`) | Blazor, LiveView | A fully-tree world puts content where it renders. The named-slot pattern is a workaround for JSX/Razor's syntactic locality; when the tree is data, you just put the node where you want it. |
| **Out-of-band / partial-region push** (`hx-swap-oob`, Turbo Streams) | HTMX, Hotwire, LiveView | VMS replaces the whole tree per response; `pollInterval` / `shell.push()` cover server-initiated updates. Partial-region push is a performance optimization for the HTML-fragment world where re-rendering the whole page is genuinely expensive. Our JSON tree is small; the pathological cases haven't materialized. Revisit if a real consumer surfaces per-region push as a bottleneck. |
| **Watermark, Marquee, Tour** | Ant (Watermark, Tour), Chakra (Marquee) | Zero real consumer signal + narrow use + doesn't compose from anything meaningful. Rejected as taste. |
| **Custom-styled date picker** (MUI DatePicker, Ant DatePicker, Filament DateTimePicker) | 3/4 comp libs, Filament | Native `date`/`time`/`datetime-local` inputs work agent-legibly, describe-not-decorate, and are byte-accurate on the wire. A custom picker would ship a client-heavy widget and lose the native mobile keyboard. |
| **Speed Dial, Bottom Navigation, Menubar** (MUI unique) | MUI only | 1-of-4 signal; MUI's Material Design bespoke UI. |

---

## Sources

**The layout-scoped predecessor:** `.planning/design/layout-system-research.md` (2026-06-28) — the survey this one supersedes in scope, and whose methodology (P1/P2 gates, principles-first) this one adopts and extends.

**Component library inventory** (four flagship libs):
- Bootstrap 5.3 — https://getbootstrap.com/docs/5.3/getting-started/introduction/ · Components/Layout/Content/Forms/Helpers/Utilities
- MUI Material UI — https://mui.com/material-ui/all-components/
- Ant Design v5 — https://ant.design/components/overview/
- Chakra UI v3 — https://www.chakra-ui.com/docs/components/concepts/overview · plus v2 for reference

**Server-driven peer study** (six frameworks that share VMS's constraints):
- Phoenix LiveView — https://phoenix-live-view.hexdocs.pm/welcome.html + `Phoenix.Component` + bindings + uploads
- Rails Hotwire (Turbo + Stimulus + ViewComponent) — https://turbo.hotwired.dev/handbook/introduction + https://viewcomponent.org/
- Laravel Livewire + Filament — https://livewire.laravel.com/docs/hydration + https://filamentphp.com/docs/3.x/forms/fields/getting-started + tables
- Blazor Server — https://learn.microsoft.com/en-us/aspnet/core/blazor/ + components/built-in-components
- Streamlit — https://docs.streamlit.io/develop/api-reference + concepts/architecture/session-state
- HTMX + DaisyUI — https://htmx.org/docs/ + https://daisyui.com/components/

**VMS type source (the concern→source authority per `AGENTS.md`):**
- `viewmodel-shell/src/index.ts` (2456 lines) — the ViewNode union + per-node interfaces + response envelope
- `viewmodel-shell-dotnet/ViewModels.cs` — byte-aligned .NET twin
- `viewmodel-shell/CHANGELOG.md` — traced audit-driven releases: v3.5.0 (feedback cluster), v6.11.0 (prose typography), Phase 21 (lookup/tags)
