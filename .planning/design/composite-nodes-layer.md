# Composite-Nodes Layer — v8.0.0 Design of Record

**Designed** 2026-07-29 (approved via before/after tasting served on the tailnet at `http://100.113.23.63:8182/`; Ashley signed off after eyeballing every shape side-by-side, light + dark).
**Doc written** 2026-07-29.
**Status:** Approved — design of record for Phases 23-26 of the v8.0.0 Composite-Nodes Layer milestone.
**Supersedes:** the pre-doc tasting at `bounties/composite-nodes-layer/tasting-page/index.html`. That page was the working surface where the ten composites + three wire tweaks were sketched, mocked, and eyeballed; **once this doc is written, IT is the canonical design reference for Phases 24-26.** The tasting page stays as historical provenance.

**Milestone:** v8.0.0 — aligned npm + NuGet **major** release. Major bump is not forced by a breaking wire change; it is chosen for milestone-coherence (ten new composites + three wire tweaks + a new primitive ship as one aligned story to consumers). Everything additive; old renderers gracefully degrade on unknown closed-union values.

---

## 1. Thesis — Route A + Route B coexist

The framework has always run on **Route A**: a small vocabulary of primitive nodes (Text, Section, Button, ListItem, Checkbox, …) plus orthogonal appearance axes (tone / emphasis / size / state / layout / density) that compose to any shape an app needs. Route A is what VMS ships today; it is the layer that guarantees the framework never has to be edited to patch around an app's need — a consumer with an unforeseen shape drops to primitives and composes.

But Route A alone has a cost that the tasting made undeniable: **shapes with strong shared visual convention render badly from primitives.** A chat message. A dense list row with primary/secondary/meta typography. A callout banner with a tone-appropriate icon. An avatar (there is no avatar primitive today — every consumer fakes it with a BadgeNode or an IconNode). Compose these from Route A and the "after" is never quite right — no typographic rhythm between tiers, no baseline alignment between label and description, no circular slot that owns its own size axis, no `<dl>/<dt>/<dd>` semantics on a key-value list. Consumers ship the workaround; workarounds accumulate; the framework's own philosophy warns that when a shape can only be built by working *around* the primitives, that is the signal a piece is missing.

**Route B is the answer.** It adds **pre-made composite recipes with typed slots**. A recipe owns the shape — DOM layout, typography, spacing, semantic HTML, a11y wiring, the tone-to-icon default mapping, the divider between rows — and the app hands it CONTENT via named slots. A `MessageNode` owns the padded content surface, the author-then-timestamp typographic baseline, the circular avatar slot; the app hands it an `avatar`, an `author`, a `timestamp`, a `content`, and a `role`. The framework draws the message; the app describes it.

**Both routes coexist. Recipes never DEPRECATE primitives.** A consumer with a shape the framework didn't foresee still drops to primitives and composes; a consumer whose shape matches a recipe uses the recipe and gets typography-rhythm + a11y + reflow for free. This is the two-track structure every mature framework carries — MUI primitives (`Box`, `Typography`, `Stack`) *plus* recipes (`ListItemText`, `Card`); Ant primitives (`Row`, `Col`, `Typography`) *plus* recipes (`List.Item.Meta`, `Card.Meta`); Chakra primitives *plus* Card composites; Phoenix LiveView function components with slots; Blazor Razor typed content parameters. Every server-driven peer surveyed ships this layer.

The two-route split is the design-of-record thesis for the entire v8.0.0 milestone. Everything below follows from it.

---

## 2. The governance rule — earn a composite

Adopted verbatim from Ashley's canonicalization at the tasting (2026-07-29). This is the wording that Phase 23-06 mirrors into `AGENTS.md` under "Conventions for evolving the framework"; the two documents must stay copy-consistent:

> **A shape earns a composite node when the best-effort with today's primitives is a "pretty bad approximation" of the common shape. The bar is visual — the after has to look right; the before has to look wrong enough to justify the primitive earning a promotion. Judgment per shape; eyeballed against a served tasting before it earns the composite.**

Three properties of the rule that matter operationally:

- **The bar is visual, not theoretical.** A shape does not earn a composite because it *could* be a composite, or because a peer framework ships one. It earns it when the primitives-only render is bad and the recipe render is right, and Ashley can eyeball the two side-by-side and see the promotion is deserved. The tasting page is that eyeballing surface; **every composite in v8.0.0 was approved through it.** New composites Phase 24+ propose follow the same discipline: served tasting → visual sign-off → doc entry → plan.
- **Judgment per shape.** There is no rubric. Some shapes clear the bar dramatically (Timeline: primitives cannot draw the vertical rail without app CSS, breaking "apps don't decorate"). Some clear it modestly (DetailRow: primitives give two texts on a line, but no aligned label column and no `<dl>` semantics). Some sit outside the bar entirely (PageHeader: `Section(row, arrange:"space-between")` already produces a decent header — held pending signal). The governance is *judgment against the visual bar*, not a checklist.
- **Two failure modes to guard against explicitly.** Both were flagged at the tasting; both have mitigations baked into the milestone's shape:

  1. **Bloated grab-bag** — the recipe layer accumulates shapes that don't earn their weight, and the framework becomes a catalog of near-duplicates ("did you want ListRow, UserRow, or SettingRow?" for a shape that would be one row-primitive plus different content). **Mitigation:** high bar per recipe; every proposed recipe requires a served tasting before it enters the design doc; the rule is *earn*, not *propose*. The doc's own "not yet included" section (see §7) records shapes intentionally *not* promoted (PageHeader, MediaCard, PaginationBar, SectionHeader, NavRail/AppBar), so the ceiling is documented, not just the floor.
  2. **Too-rigid recipe** — a recipe boxes in the consumer by making its slots or its variance too narrow ("I want the avatar to be a Badge, or my ChipList to include a numeric counter, or my Timeline entry to have a secondary line"), and consumers escape into workarounds again. **Mitigation:** typed slots stay **unconstrained-content `ViewNode` subtrees**, and variance stays in **closed-enum axes**. See §3.

**The precedent for both the rule and the two-track split** — MUI `ListItemText` (typed `primary`/`secondary` slots), Ant `List.Item.Meta` (typed `avatar`/`title`/`description`), Chakra `Card` + `CardBody` + `CardFooter`, Phoenix LiveView function-component slots (`<:actions>`), Blazor Razor typed `ChildContent`. Every server-driven peer surveyed ships this layer; the closest analog for our shape-fit (server-authoritative, wire-driven) is Phoenix's slot pattern.

---

## 3. The typed-slots pattern

Every composite in v8.0.0 obeys **the same structural shape.** The vocabulary of slot names is deliberately small and semantically consistent, so a reader of any composite recognizes the shape immediately:

```
{
  leading?     : ViewNode              // an icon, avatar, badge, checkbox — the row's leading affordance
  primary /
  heading      : string | ViewNode     // the composite's semantically-primary content
  secondary /
  description? : string | ViewNode     // typographically-subordinate second line
  meta?        : (string | ViewNode)[] // trained: text-xs, muted, opacity 0.85
  trailing?    : ViewNode              // right-aligned: timestamp, count, actions
  tone?        : "danger"|"warning"|"success"|"info"
  state?       : string                // freeform lifecycle axis (active/done/disabled/high/…)
  action?      : ActionEvent           // whole-row click (same shape as TableRow.action)
}
```

**Three rules govern this pattern, and together they defeat the "too-rigid recipe" failure mode:**

1. **Slots are typed by SEMANTIC NAME, not by node type.** A slot called `leading` accepts *any* ViewNode subtree — an IconNode, an AvatarNode, a BadgeNode, a CheckboxNode, a Section with nested children. The recipe doesn't say "leading must be an IconNode"; it says "leading is what goes at the front of the row, and here's the layout / alignment / gap the framework guarantees around it." The consumer drops in whatever ViewNode the shape needs. This is the typed-slots pattern in one line: **the framework owns the recipe; the app owns the content.**

2. **Variance is expressed through CLOSED-ENUM AXES, never raw CSS or free-form fields.** The tone axis is `"danger" | "warning" | "success" | "info"`. The state axis is freeform lowercase strings (`"active" | "done" | "disabled" | ...`) — freeform because state vocabulary is app-lifecycle-specific, but still a single field, still one word per row. A consumer NEVER hands the recipe raw color, raw padding, or raw font size; they pick a tone value and the framework's design tokens do the rest. This closes the escape hatch that would let apps re-decorate through recipes.

3. **Every slot is optional except the one that names what the composite IS.** A ListRow without `primary` is not a list row; a Message without `content` is not a message; an Alert without `message` is not an alert. Exactly one slot per composite is required — the semantically-primary one — and every other slot is `?`. Consumers who don't need `meta` or `trailing` omit them; the recipe collapses cleanly. This is principle 7 ("an option not set is absent") applied at the composite level.

**What this bakes in that primitives can't:** the third typographic tier (text-xs meta), the semi-bold primary weight, the grid layout with proper leading/trailing alignment, the single-surface + dividers-between-rows pattern, the state-vs-tone axis distinction (state:disabled dims; tone:info accents), the tone→icon default mapping on Alert, the `<dl>/<dt>/<dd>` semantics on DetailList, the vertical rail + tone-encoded dot markers on Timeline, the circular slot with content-resolution priority (image > initials > icon > empty) on Avatar. Every one of these is doctrine-safe within the recipe layer and structurally impossible for a consumer to reach on Route A.

---

## 4. Milestone inventory — 10 composites + 3 wire tweaks + 1 new primitive

The full v8.0.0 set, exactly as approved via the tasting. Schemas are pulled verbatim from the tasting page (`bounties/composite-nodes-layer/tasting-page/index.html` §§1-10 + "Adjacent seams"); this doc summarizes and freezes them.

### Shipped recipe inventory

This inventory tracks recipes that have landed on `main` and shipped byte-identical across both backends. Rows for phases that haven't landed yet are marked TBD; they're populated as `/gsd:plan-phase 25` and `/gsd:plan-phase 26` land. **Docs do not race ahead of code** (per the AGENTS.md governance convention plugged in from Phase 23 plan 23-06); a row appears here only after its plan's SUMMARY lands on `main`.

| Composite | Slot summary | Phase | Wire type | .NET record | Consumes |
|---|---|---|---|---|---|
| `ListRowNode` | leading, primary, secondary, meta[], trailing, tone, state, action | 24 (COMP-05) | `"list-row"` | `ListRowNode` | TextNode caption + weight (COMP-01/02); TableRow.action a11y pattern (browser.ts:3689-3714, REUSED verbatim) |
| `ListNode.variant:"rows"` | (extension) rows container for ListRowNode-only children | 24 (COMP-05a) | `"list"` (existing) | `ListNode.Variant` (`ListVariant` KebabEnum) | Existing ListNode + new closed-union enum; bidirectional mixed-children tree invariant with byte-identical error wording across TS + .NET |
| `MessageNode` | avatar, author, timestamp, content, role, actions[] | 24 (COMP-06) | `"message"` | `MessageNode` | AvatarNode (COMP-04) for the avatar slot; TextNode caption (COMP-01) for the timestamp; TextNode weight (COMP-02) for the author; string-lift renderer arm shape established by ListRowNode (24-01) for `content` |
| `MessageListNode` | children (MessageNode[]), followTail | 24 (COMP-06a) | `"message-list"` | `MessageListNode` | **REUSES `SectionNode.followTail`'s shipped mechanism VERBATIM** — the pre-render snapshot / post-render restore at `browser.ts:227-246 + 362-372` walks EVERY `[data-follow-tail]` element, so the renderer arm is a one-line addition `el.dataset.followTail = ""`. Zero new adapter code. Same posture will apply to any future "growing feed" composite (activity feed, live log, notification stream) |
| `AlertNode` | tone (required), title, message, icon, actions[], dismissible | 24 (COMP-07) | `"alert"` | `AlertNode` | IconName + closed-enum discipline (v7.0); TextNode weight (COMP-02); tone→icon default map BAKED into `browser.ts:ALERT_TONE_ICON` (`danger`→`x-circle`, `warning`→`alert-triangle`, `success`→`check-circle`, `info`→`info`) overridable via `icon?`; `dismissible:true` dispatches RESERVED `{name:"dismiss"}` action name (apps needing a distinct name compose their own dismiss button in `actions[]`) |
| `EmptyStateNode` (v8.0 rename) | icon, title (was heading), description (was message), action | 24 (COMP-08) | `"empty-state"` (unchanged) | `EmptyStateNode` | IconName (v7.0). **BREAKING wire rename** from v7.x — field renames `heading`→`title`, `message`→`description`; new `icon?` slot. See `CHANGELOG.md` v8.0.0 + `MIGRATION.md`. NOT a new node — a pre-existing shipped node whose schema was tightened at the v8.0.0 milestone boundary to match the typed-slots pattern (§3) |
| `UserRowNode` | avatar, name, meta, status:{label,kind}, trailing, action | 25 (COMP-09) | `"user-row"` | `UserRowNode` | AvatarNode (COMP-04), TextNode caption/weight (COMP-01/02), status-dot palette (baked-in CSS); closed 4-value `StatusKind` enum (`online`→success, `away`→warning, `offline`→muted, `busy`→danger); whole-row `action?` follows `TableRow.action`/`ListRowNode.action` shape verbatim |
| `DetailRowNode` + `DetailListNode` | label, value, tone, icon; `labelWidth?` on list | 25 (COMP-10 + 10a) | `"detail-row"` / `"detail-list"` | `DetailRowNode` / `DetailListNode` | IconName (v7.0), TextNode body (COMP-01); `<dl>/<dt>/<dd>` semantic HTML with CSS grid on the list for aligned label column (proper screen-reader term/definition semantics); `labelWidth?: "sm"\|"md"\|"lg"` closed enum on the list (8/10/12rem) |
| `TimelineEntryNode` + `TimelineNode` | time, description, tone, icon | 25 (COMP-11 + 11a) | `"timeline-entry"` / `"timeline"` | `TimelineEntryNode` / `TimelineNode` | TextNode caption/body (COMP-01). **NEW baked-in CSS mechanism — the ONE genuinely new CSS pattern in Phase 25**: vertical rail via `::before` on the container + dot per entry via `::before` on the entry with tone-encoded border. **Apps CANNOT compose this from primitives** — the composite exists specifically to bake it in, per "apps describe, never decorate" (§3). Every other Phase 25 composite is grid/flex/color-mix over existing primitives; only Timeline earns a new CSS pattern |
| `SettingRowNode` + `SettingListNode` | icon, label, description, trailing, action; `heading?` on list | 25 (COMP-12 + 12a) | `"setting-row"` / `"setting-list"` | `SettingRowNode` / `SettingListNode` | TextNode weight (COMP-02); grid `[body \| control] = 1fr auto` with `align-items: center`; **natural pairing with `CheckboxNode(variant:"switch")` from COMP-03** in the trailing slot (also common: `ButtonNode`, `LinkNode`). Whole-row `action?` opts into row-activation |
| `ChipNode` + `ChipListNode` | label, tone, icon, dismissAction, action | 25 (COMP-13 + 13a) | `"chip"` / `"chip-list"` | `ChipNode` / `ChipListNode` | IconName (v7.0); auto-wrapping cluster at container width. **`dismissAction` is a caller-supplied `ActionEvent` SLOT (identity-carrying dispatch names like `remove-filter-42`), distinct from `AlertNode.dismissible` — NOT a fixed-name boolean.** Mirrors `ModalNode`'s per-instance action shape, NOT Alert's reserved-name shape. Chips need identity-carrying dispatch because they typically operate on specific identities; if BOTH `action` and `dismissAction` are set, the X's click does `stopPropagation` so it doesn't double-fire the whole-chip click |
| **Phase 26 release ritual** | (aligned v8.0.0 npm + NuGet publish; comprehensive tailnet verification page across all 10 composites + 3 wire tweaks + 1 new primitive) | 26 | — | — | TBD in Phase 26 |
| `RichTextToolbarNode` | tools[], size, tone, state | 28 (RICH-02) | `"rich-text-toolbar"` | `RichTextToolbarNode` | ButtonNode styling; framework-owned TipTap chain wiring via the enclosing RichTextFieldNode; framework-owned toolbar layout, keyboard shortcuts, focus management, a11y (aria-labels + shortcut hints); default 11-tool D-08 floor renders automatically when `RichTextFieldNode.toolbar` is OMITTED — explicit `RichTextToolbarNode` only needed to customize. Composite shape approved via before/after tasting at `http://100.113.23.63:3021/`; Ashley signed off 2026-07-31 |
| `ChatComposerNode` | bind, sendAction, attachAction, stopAction, status, dropScope, submitMode, disabled, headerSlot, inputSlot, leadingSlot, trailingSlot, footerSlot (+ attach config: attachBind, maxFiles, maxFileSize, accept, maxRows, placeholder) | 30 (CHAT-01..20) | `"chat-composer"` | `ChatComposerNode` | New `square` glyph in the shipped `icons-payload` (drives the `status:"streaming"` stop-icon). AI-elements send-button state machine (`status` closed enum: `idle`/`sending`/`streaming`); IME `isComposing` guard baked-in NON-OPTIONAL (CHAT-12 CJK correctness); three converged attach ingress paths (click / drag-drop with `dropScope` closed enum / paste-image); framework-owned attachment preview chip strip in `headerSlot` with per-item X-remove + blob-URL image thumbs + MIME-typed file icons; Backspace-on-empty removes last attachment (AI-elements precedent). Composite shape approved via before/after 3-panel tasting; Ashley taste-locked Panel 3 (`banging`) on 2026-08-02. Sixth composite to adopt the Phase 27 `state?: string` axis uniformity precedent — deferred as a v1 gap (`state?` NOT in Phase 30 wire; see §4e). Sixth composite in the shipped-inventory to demonstrate an ActionEvent-that-is-NOT-a-slot (`attachAction`): it is a first-class attach ingress trigger, not a place to plug arbitrary content — same pattern as `TableRow.action`, `AlertNode.actions[]` |

The free-form §§4a-4d below record design rationale + slot-schema justifications for the whole milestone set (what SHOULD ship); this table records what HAS shipped. The two views are complementary — the free-form sections tell the "why" and "what to build"; the table tells the "what's actually live". If a Phase 24-25 finding tightens a schema (e.g. the EmptyStateNode rename), the free-form section is updated to match reality and the table cell records the delta.

### 4a. Wire tweaks (Phase 23 foundations — this phase)

The composites need three additions to existing wire types before they can render the trained typography and control shapes they promise. Landing them first — as *foundations* — is the entire reason Phase 23 exists.

| # | Requirement | Addition | Purpose |
|---|---|---|---|
| 1 | **COMP-01** | `TextNode.style: "caption"` — extends the closed union `"heading" | "subheading" | "body" | "muted" | "strikethrough" | "pre"` with `"caption"`. Renders `.vms-text--caption` at `var(--vms-text-xs)` size, muted color, opacity ~0.85. | The 3rd typographic tier every meta-line composite consumes (`ListRowNode.meta[]`, `MessageNode.timestamp`, `TimelineEntryNode.time`, `DetailRowNode.label`). VMS has body-size and muted-body-size today; text-xs is the tier the tasting proved list rows need to read like modern rows. |
| 2 | **COMP-02** | `TextNode` weight axis — Option A (recommended): new orthogonal field `weight?: "regular" | "medium" | "bold"`. Emits `.vms-text--weight-{weight}`. Option B (alternative): extend the `style` union with `"strong"`. Planner picks with Ashley review; both are patterned in-repo. | Composites need body-styled text with semibold weight (`ListRowNode.primary`, `UserRowNode.name`, `SettingRowNode.label`). Today's `subheading` conflates weight with typographic level. Option A composes cleanly (`style:"body", weight:"medium"`) without style-overloading. |
| 3 | **COMP-03** | `CheckboxNode.variant: "switch"` — extends the closed union `variant?: "checkbox" | "switch"`. Wire semantics unchanged (still boolean, still `bind`/change dispatch on the underlying `<input type="checkbox">`). Renders `.vms-field--switch` — a 2.5rem × 1.5rem slider track + thumb, tone-accented in the on-state. a11y: renderer adds `role="switch"` so screen readers announce "switch on"/"switch off". | `SettingRowNode` needs a switch control; the switch-as-input-type is a common consumer ask; folding it into `CheckboxNode.variant` (instead of adding `SwitchNode`) reuses all existing bind + dispatch + form-harvest + draft-preservation infrastructure. |

### 4b. New primitive (Phase 23 foundations — this phase)

| # | Requirement | Addition |
|---|---|---|
| 4 | **COMP-04** | `AvatarNode` — a new standalone primitive. Circular slot; content-resolution priority `image > initials > icon > empty`; closed size axis (`sm` = 1.5rem, `md` = 2rem [default], `lg` = 2.5rem, `xl` = 3rem); closed tone axis for the background (initials/icon modes only — image mode's `<img>` displaces the background); a11y `alt?` slot. Circular only for v1; other shapes (square, rounded-square) deferred. |

Technically a new node in its own right, but sized here as a *foundation* the composites consume rather than a composite itself: UserRow's `avatar` slot, Message's `avatar` slot, and (optionally) Chip's `leading` slot all resolve to an AvatarNode. Every mature framework (MUI, Chakra, Ant, Bootstrap) ships an avatar primitive; VMS is currently the outlier — consumers fake it with a BadgeNode (rectangular, wrong padding) or an IconNode (no initials support).

### 4c. Composites (Phase 24 — primary)

The high-frequency shapes. Every one of these appears in almost every VMS consumer's tree today (or wants to and can't).

**`ListRowNode`** — dense list row with 3-tier typography (COMP-05).
```
ListRowNode {
  type: "list-row";
  leading?: ViewNode;                                   // icon, badge, avatar, checkbox
  primary: string | ViewNode;                           // trained: text-md, weight 500
  secondary?: string | ViewNode;                        // trained: text-sm, muted
  meta?: (string | ViewNode)[];                         // trained: text-xs, muted, opacity 0.85
  trailing?: ViewNode;                                  // right-aligned: timestamp, count, actions
  tone?: "danger"|"warning"|"success"|"info";           // left-border accent
  state?: string;                                       // freeform lifecycle axis
  action?: ActionEvent;                                 // whole-row click (TableRow.action shape)
}
```
Pairs with `ListNode.variant: "rows"` — a dense-list mode where every child is a ListRowNode; framework renders a single bordered surface with per-row dividers.

**`MessageNode`** — chat / comment / conversation message with an actor (COMP-06).
```
MessageNode {
  type: "message";
  avatar?: ViewNode;                                    // trained circular slot; consumer supplies content
  author: string;                                       // trained: text-sm, weight 600
  timestamp?: string;                                   // trained: text-xs, muted (caption tier)
  content: ViewNode | string;                           // padded surface; role controls background
  role?: "user" | "assistant" | "system";               // closed enum — surface tone
  actions?: ButtonNode[];                               // always-visible trailing bar (no hover-reveal — banked a11y lesson)
}
```
Pairs with `MessageListNode { type: "message-list"; children: MessageNode[]; followTail? }` (chat-transcript with follow-tail semantics, matching `SectionNode.followTail`).

**`AlertNode`** — prominent status message with tone-appropriate icon (COMP-07).
```
AlertNode {
  type: "alert";
  tone: "danger" | "warning" | "success" | "info";      // required — the whole point
  title?: string;                                       // trained: text-md, weight 600
  message: string | ViewNode;                           // trained: text-sm, muted
  icon?: IconName;                                      // override the tone default
  actions?: ButtonNode[];                               // right-aligned, sm size
  dismissible?: boolean;                                // optional close-X; dispatches a "dismiss" action name
}
```
Framework owns the tone→icon default mapping: `danger`→`x-circle`, `warning`→`alert-triangle`, `success`→`check-circle`, `info`→`info`. This closes Moxie's "banner" ask properly instead of pointing at `SectionNode.tone` as a discoverability answer.

**`EmptyStateNode`** — friendly "nothing here" state (COMP-08).
```
EmptyStateNode {
  type: "empty-state";
  icon?: IconName;                                      // trained: 48px, tinted circular background
  title: string;                                        // trained: text-lg, weight 600, heading font
  description?: string;                                 // trained: text-sm, muted, max-width ~28rem
  action?: ButtonNode;                                  // optional CTA, centered below
}
```
> **v8.0 BREAKING wire rename.** EmptyStateNode is not a new node in v8.0.0 — it was pre-existing. The v8.0.0 milestone tightens its schema to the typed-slots pattern (§3): field renames `heading`→`title`, `message`→`description`, new `icon?` slot. Old callers (v7.x) shipping `{ heading, message }` need to migrate to `{ title, description }`. This is the only BREAKING wire change in the v8.0.0 composite-nodes layer — every other composite is additive. Recorded in the shipped-recipe-inventory table above; full migration guidance in `MIGRATION.md`.
> **Alternative on the table:** there is an existing bounty (`empty-state-on-collections`) proposing empty-state as a *property* on collection nodes (`TableNode.empty?`, `ListNode.empty?`) instead of a standalone composite. Trade-off: property-on-collection is neat when empty-state is always contextual to a specific list; standalone composite is neat when consumers want a full-page empty-state (e.g. "no notifications" as an entire page). **Ashley picks between the two during Phase 24 planning.** If the standalone composite wins, the bounty closes; if the property-on-collection wins, EmptyStateNode drops from the milestone and this doc gets amended.

### 4d. Composites (Phase 25 — secondary)

Deeper cuts. Real signal, real consumers, but lower frequency than the primary set.

**`UserRowNode`** — person entity display (COMP-09).
```
UserRowNode {
  type: "user-row";
  avatar?: ViewNode | { initials: string; tone?: "danger"|"warning"|"success"|"info" };
                                                        // shortcut object OR full ViewNode subtree
  name: string;                                         // trained: text-md, weight 500
  meta?: string;                                        // trained: text-sm, muted (email · role, etc.)
  status?: { label: string; kind: "online" | "away" | "offline" | "busy" };
                                                        // trained: dot + label, right-aligned
  trailing?: ViewNode;                                  // optional slot for actions or extra badge
  action?: ActionEvent;                                 // whole-row click (member-picker pattern)
}
```

**`DetailRowNode`** — key-value pair with aligned label column (COMP-10).
```
DetailRowNode {
  type: "detail-row";
  label: string;                                        // trained: text-xs, uppercase, weight 500, muted
  value: string | ViewNode;                             // trained: text-md, regular
  tone?: "danger"|"warning"|"success"|"info";           // optional accent
  icon?: IconName;                                      // optional leading icon on the label
}
```
Pairs with `DetailListNode { type: "detail-list"; children: DetailRowNode[]; labelWidth?: "sm"|"md"|"lg" }` — renders as a single `<dl>` with a fixed label column (all labels align, values start at the same X) and per-row dividers; `labelWidth?` closed-enum tunes the column width across the whole list (8/10/12rem). Correct screen-reader semantics for term/definition pairs; impossible with row-wise `Section(arrange:"space-between")`.

**`TimelineEntryNode`** + **`TimelineNode`** — activity feed with vertical rail (COMP-11).
```
TimelineEntryNode {
  type: "timeline-entry";
  time: string;                                         // trained: text-xs, muted (caption tier)
  description: string | ViewNode;                       // trained: text-md; content can carry runs
  tone?: "danger"|"warning"|"success"|"info";           // dot color
  icon?: IconName;                                      // override dot with an icon (bigger slot)
}

TimelineNode {
  type: "timeline";
  children: TimelineEntryNode[];                        // vertical rail + dots owned by the composite
}
```
Framework owns the connecting rail (decorative `::before` line), the dot markers with tone-encoded borders, the negative-margin dot positioning against the rail. All of this is "app CSS" today — a consumer *literally cannot produce a timeline in VMS without breaking the "apps don't decorate" rule*.

**`SettingRowNode`** + **`SettingListNode`** — label + description + trailing control (COMP-12).
```
SettingRowNode {
  type: "setting-row";
  icon?: IconName;                                      // optional leading icon
  label: string;                                        // trained: text-md, weight 500
  description?: string;                                 // trained: text-sm, muted
  trailing?: ViewNode;                                  // typically Checkbox(variant:"switch"), Button, or Link
  action?: ActionEvent;                                 // whole-row click (opt into activation)
}

SettingListNode {
  type: "setting-list";
  heading?: string;
  children: SettingRowNode[];                           // single bordered surface + per-row dividers
}
```
Different enough from `UserRowNode` (no avatar; trailing is a control, not a status) that folding is wrong. Natural pair with `CheckboxNode.variant: "switch"` (COMP-03).

**`ChipNode`** + **`ChipListNode`** — cluster of interactive/dismissible pills (COMP-13).
```
ChipNode {
  type: "chip";
  label: string;
  tone?: "danger"|"warning"|"success"|"info";           // color palette
  icon?: IconName;                                      // leading icon
  dismissAction?: ActionEvent;                          // showing the X requires this — "no dead UI"
  action?: ActionEvent;                                 // whole-chip click (filter-chip toggle)
}

ChipListNode {
  type: "chip-list";
  children: ChipNode[];                                 // auto-wraps at container width
}
```
> **Chip is NOT a Badge with a dismiss field.** Badge is an *annotation* on another element (a "New" tag next to a title, a count on an icon). Chip is a *standalone interactive element* that participates in a group (filter set, tag input, selected items). Different semantic purpose, different affordances. Every mature framework splits them (MUI: Badge vs Chip; Ant: Badge vs Tag). Keeping them separate preserves clear intent.

### 4e. Composite (Phase 30 — chat composer, v9.1.0)

**`ChatComposerNode`** — chat-app compose bar with baked-in growable-center-fixed-ends layout, AI-elements send-button state machine, IME `isComposing` guard, and three converged attach ingress paths (CHAT-01..20).

**Shape earned via visual bar.** Approved via before/after 3-panel tasting served on the tailnet 2026-08-02. Panel 1 (`Section(layout:"row", variant:"card") + FieldNode(inputType:"textarea") + Button("Send")` — text-only, existing primitives) got "layout could be better, could pass as a composed box on a cheap-looking app." Panel 2 (primitives + a Route A `FieldNode(inputType:"file", variant:"icon-only")` addition) got "layout's just pretty bad — send button ends up underneath the attach button and text area." Panel 2 failed for a substantive reason worth banking: **with the icon-only file variant added, the composer STILL needs "growable center + fixed ends" layout logic that `Section(row)+heterogeneous-siblings` doesn't provide**; the send button wraps to a second line the moment attach is added, and there is no shipped path to a unified pill surface. To make Panel 2 look right would require MULTIPLE Route A additions (the file variant AND a growable-center Section variant AND a unified-pill surface primitive), not one. Panel 3 (Route B `ChatComposerNode` composite) got **`banging`** from Ashley — the composite owns the compose-bar shape end-to-end with baked-in layout, keyboard behavior, IME guard, and the state-machine send button. Panel 3 clearly wins the "after has to look right; before has to look wrong enough to justify" bar in §2.

```
ChatComposerNode {
  type: "chat-composer";
  bind: string;                                                   // REQUIRED — draft-text state path (round-trips)
  sendAction: ActionEvent;                                        // REQUIRED
  placeholder?: string;
  // Attach (CHAT-04..08)
  attachAction?: ActionEvent;                                     // renders leading `+`/paperclip icon button; NOT a slot
  attachBind?: string;                                            // multipart form-field name (default "attachments")
  maxFiles?: number;
  maxFileSize?: number;
  accept?: string[];                                              // MIME types
  dropScope?: "composer" | "global";                              // default "composer"; closed enum
  // Send-button state machine (CHAT-09..10, AI-elements shape)
  status?: "idle" | "sending" | "streaming";                      // default "idle"; closed enum
  stopAction?: ActionEvent;                                       // REQUIRED-when-status-can-reach-streaming
  // Keyboard (CHAT-11..12)
  submitMode?: "enter" | "ctrl-enter";                            // default "enter"; closed enum (wire is kebab)
  maxRows?: number;                                               // default 6
  disabled?: boolean;
  // Typed slots (Route B pattern — each accepts a ViewNode subtree)
  headerSlot?: ViewNode;                                          // composes WITH framework attachment-preview chip strip
  inputSlot?: ViewNode;                                           // opt-in rich text via RichTextFieldNode
  leadingSlot?: ViewNode;                                         // rare — prepend before + button
  trailingSlot?: ViewNode;                                        // voice, model select, emoji trigger, etc.
  footerSlot?: ViewNode;                                          // helper text, footer chips
}
```

**Typed slots + variance axes per §3.** Five slots (`headerSlot`, `inputSlot`, `leadingSlot`, `trailingSlot`, `footerSlot`) each accept an unconstrained `ViewNode` subtree — the framework owns the recipe (layout, gap, alignment); the app owns the content. Three closed-enum variance axes (`status`, `dropScope`, `submitMode`) plus `disabled: bool`; every closed union is a real .NET enum with `[JsonConverter(typeof(KebabEnum<T>))]` per the maintainer rule in §6 ("Closed-union-must-be-enum on .NET"). Required slot per §3-rule-3: `bind` + `sendAction` together — a chat composer without a draft-text path or a send action is not a chat composer. **`attachAction` is NOT a slot** — it's an `ActionEvent` field that renders the leading `+`/paperclip icon button when set. This is the same "ActionEvent-that-is-not-a-slot" pattern as `TableRow.action`, `ListRowNode.action`, and `ChipNode.dismissAction`; the attach button is a first-class attach ingress trigger, not a place to plug arbitrary content.

**Baked-in framework behaviors** (each one primitives cannot reach or which failure of would be a correctness bug):

- **Unified pill surface with growable-center-fixed-ends layout.** CSS grid `[leading | growable-center | trailing] = auto 1fr auto` on the composer wrapper; 34px circular icon buttons for leading (`attachAction`) and trailing (send/stop); intrinsic — no viewport breakpoints, no app CSS.
- **AI-elements send-button state machine.** `status` axis drives icon + click routing: `idle` → send-icon fires `sendAction`; `sending` → spinner-icon disabled (no dispatch); `streaming` → square/stop-icon fires `stopAction`. Non-AI consumers never set past `sending` and pay ZERO cost (they get send-with-spinner). Load-bearing invariant: `stopAction` is REQUIRED when `status` can reach `"streaming"` — both sides fail-loud (browser adapter emits `console.error` + disables the button; .NET tree validator rejects with `invalid_tree`).
- **IME `isComposing` guard baked-in NON-OPTIONAL.** Correctness requirement for CJK users, not a preference. `onCompositionStart`/`End` state var + `e.nativeEvent.isComposing` belt-and-braces (browsers commit the state event at different times). Enter during composition never fires `sendAction`. Regression gate: adversarial jsdom CJK IME test in Plan 30-06.
- **Three converged attach ingress paths** (universal mechanism across the surveyed frameworks per RESEARCH.md §Q1): (1) click-to-picker on `attachAction` button → OS file picker; (2) drag-drop on the composer element (default `dropScope:"composer"`) or on `document` (`dropScope:"global"` — Stream Chat `WithDragAndDropUpload` precedent), guarded by `dataTransfer.types.includes("Files")` so text drops don't fire; (3) paste-image via `clipboardData.items` iteration with `item.kind === "file"` extraction.
- **Framework-owned attachment preview chip strip.** Renders in the `headerSlot` position; consumer's own `headerSlot` content composes with it (both render — chip strip first, consumer content below). Per-item X-remove; blob-URL image thumbs + MIME-typed file icons. `URL.createObjectURL` on stage; `URL.revokeObjectURL` on remove + on successful send. Staged files live in a per-composer WeakMap-shaped registry keyed by bind path (Plan 30-05).
- **Multi-file attach + shipped multipart wire.** Attachments ride the SHIPPED multipart wire on `sendAction` dispatch under `attachBind` (default `"attachments"`). Server reads via `Request.Form.Files.GetFiles(attachBind)` (.NET) or `payload.files[attachBind]` (TS). **VMS's server-side wire is a net simplification** vs the client-only SDKs (Stream Chat, AI Elements) that must invent presigned-URL machinery + per-attachment progress + chunked upload paths — VMS gets multi-file for free because the multipart wire already carries binaries. `ActionEvent.files` widened from `Record<string, File>` to `Record<string, File | File[]>` for the multi-file case (backward-compatible; single-file callers unchanged; server-side reads via `getAll(name)`).
- **Backspace-on-empty removes last attachment.** ~5 adapter lines; universal UX polish; AI-elements precedent. When the textarea value is empty and Backspace fires, the last-staged attachment is removed (with its blob-URL revoked).
- **Auto-resize textarea capped at `maxRows`** (default 6). CSS `field-sizing: content` with JS fallback for browsers lacking support.
- **`submitMode` wire values are kebab** (`"enter"` | `"ctrl-enter"`) per the KebabEnum convention. This is the shipped contract — a Ctrl+Enter opt-in flip (persistent-chat pattern from Slack/Discord) that consumers advertise via the closed-union axis rather than a boolean flag.

**v1 explicit deferrals.** Each of the following is a separate primitive / conversation, NOT a v1 gap to close inline via `trailingSlot`/`headerSlot`. Each consumer that wants one composes it into a slot until the framework earns a dedicated primitive/composite for it: emoji picker, @mention autocomplete, /command autocomplete, voice message recording (MediaRecorder — heavy dep), voice input / dictation (SpeechRecognition — patchy browser support, fail-loud handling needed), screenshot capture (`getDisplayMedia` permissions), model / mode selector, typing indicator (outbound), reply-preview / edit-mode indicator as first-class fields (consumer composes in `headerSlot`).

**Deferred axes worth noting for future planners:**

- **`state?: string` axis.** Not included in the v1 wire. Per the Phase 27 addendum in §5, future row-shaped composites carry the axis as a matter of course; ChatComposerNode is not a row-shaped composite (it is a single-instance compose bar, not a list-of-composers), and the state axis's shipped meanings (`active`/`done`/`disabled`) map awkwardly onto the compose-bar shape — `disabled` is already a first-class boolean on the composite; `active` and `done` have no obvious compose-bar semantic. A future amendment could add the axis if a consumer surfaces a concrete need (e.g. `state:"error"` for post-send-failure surfaces).

**Design of record.** RESEARCH.md at `.planning/phases/30-chat-composer-primitive-chatcomposernode-route-b-composite/RESEARCH.md` (825-line landscape survey of 20+ frameworks, mechanism analysis, precedents worth borrowing, watch-outs); CONTEXT.md at the same path (Ashley 2026-08-02 taste-lock; v1 scope decisions; wire shape). See §5 Phase 30 addendum for the v9.1.0 release ritual reference.

---

## 5. Layered adoption order — Phase 23 → 26

The v8.0.0 milestone lands as **four phases**, structured so each phase's outputs are consumed by the next. The ordering is not aesthetic; it is the dependency graph.

### Phase 23 — Foundations (this phase; no release)

The four wire tweaks + new primitive from §4a-4b: `TextNode.style:"caption"`, `TextNode` weight axis, `CheckboxNode.variant:"switch"`, `AvatarNode`. Plus this design doc and the AGENTS.md "Route B composite-nodes layer" governance section.

**Why first:** every downstream composite consumes at least one of these. Timeline consumes caption; ListRow consumes weight + caption; SettingRow consumes switch; UserRow and Message consume AvatarNode; Alert consumes caption. Ship them as foundations so Phase 24-25 can *use* them, not *depend on hypothetical wire that hasn't landed*.

**Batch-then-ship (no release this phase):** CHANGELOG entries accumulate under an "Unreleased" heading; v8.0.0 does not publish here.

### Phase 24 — Primary composites (no release)

The four high-frequency shapes: `ListRowNode` + `ListNode.variant:"rows"`, `MessageNode` + `MessageListNode`, `AlertNode`, `EmptyStateNode` (pending EmptyState-vs-property call).

**Why second:** the highest-signal composites. These four cover ~80% of what tasting consumers keep asking for. Building them before the Phase 25 set means every subsequent consumer that spins up between now and release has the shapes they'd actually reach for first.

### Phase 25 — Secondary composites (no release)

The five lower-frequency shapes: `UserRowNode`, `DetailRowNode` + `DetailListNode`, `TimelineEntryNode` + `TimelineNode`, `SettingRowNode` + `SettingListNode`, `ChipNode` + `ChipListNode`.

**Why third:** real consumer signal, but each one covers a narrower need than the primary set — Timeline is for activity feeds specifically; DetailRow for entity property views; SettingRow for settings pages; Chip for filter/tag clusters; UserRow for people-pickers.

### Phase 26 — Adoption + release

Wider demo adoption (beyond the Showcase adoption already landing in Phases 23-25 per fleet-adoption discipline); a comprehensive tailnet verification page carrying every new composite + every wire tweak + every foundation across default + all 12 themes; aligned v8.0.0 **npm + NuGet** major release.

**Why last:** the verification page needs the full set in place. A page that verifies only a subset lets a class-of-defect that spans composites go undetected. And **batch-then-ship** (see §6) means the release ritual runs exactly once for the whole milestone.

### Phase 27 addendum (v8.1.0, state axis uniformity — landed 2026-07-30)

Adopted the `state?: string` axis uniformly across all row/composite types (6 composites gained it — `UserRowNode`, `MessageNode`, `DetailRowNode`, `TimelineEntryNode`, `SettingRowNode`, `ChipNode`); unified the shipped `--active` rendering to STYLE-3 (left-border accent + weight:600 on the composite's semantic primary text slot) across all 8 non-Chip composites carrying the axis. Consequence for the typed-slots governance rule (§3): future composites that earn the row/list shape MUST carry the `state?: string` axis — a matter of course rather than a per-composite design decision. The earned-a-composite bar itself remains eyeball-per-visual (unchanged). Field is freeform per Ashley-locked Q1=B at the Phase 27 tasting (2026-07-30); framework ships styling for `active` (STYLE-3), `done` (opacity 0.72), `disabled` (opacity 0.55) where applicable. Full CHANGELOG entry: `CHANGELOG.md` §8.1.0.

### Phase 28 addendum (v8.2.0, rich text WYSIWYG — landed 2026-08-02)

Adds a **new leaf-input primitive** (`RichTextFieldNode` — NOT a composite; leaf inputs don't earn Route B rows) and **one new Route B composite** (`RichTextToolbarNode` — see the §4 shipped-recipe inventory row added above for the wire discriminator + typed-slots summary + consumes note). The composite passed Route B governance via the D-03 before/after tasting served on the tailnet at `http://100.113.23.63:3021/`; Ashley signed off 2026-07-31 (`taste ok — with: fix code-block + quote editor-host rendering`, folded into Plan 28-05's CSS scope). The composite is the fifth to adopt the Phase 27 `state?: string` axis uniformity precedent — the axis came with the composite as a matter of course, per the Phase 27 addendum's rule.

Two structural properties of the Phase 28 additions worth noting for future composite plans (both are Route A/Route B fenceposts, not design questions to re-open):

1. **`RichTextFieldNode` is a LEAF-INPUT PRIMITIVE per D-01, NOT a Route B composite.** Rationale: anticipated customization surface (`allowedMarks`/`allowedNodes`, `mentionsProvider`, `plainTextValueBind`, `heightMin`/`heightMax`, `sanitizeConfig`) would ONLY apply to rich fields and would bloat a shared composite with a section every other consumer ignores. This is the same rule that keeps `FieldNode` from growing rich-text-specific fields — an input primitive with a class of anticipated per-input customization surface earns its own dedicated node. Leaf inputs don't earn Route B inventory rows; only `RichTextToolbarNode` (the toolbar customization seam) does.
2. **Framework-owned default toolbar (D-02 anticipated axis, shipped in v8.2.0).** When `RichTextFieldNode.toolbar` is OMITTED, the framework renders the DEFAULT toolbar (the full 11-tool D-08 floor — bold, italic, link, ordered/unordered lists, headings h1-h3, inline code, code block, blockquote) automatically. An explicit `RichTextToolbarNode` slot is only needed when the app wants to customize the tool set, size, or tone. This "sensible default via omission" pattern is the same shape as `SectionNode.layout` defaulting to `stack` when omitted — the composite is present as the CUSTOMIZATION SEAM (D-02: "the anticipated `visibleTools`, headings-dropdown, position variants, compact/expanded, overflow-to-kebab pressure motivated the composite decision"), not as mandatory boilerplate on every consumer's tree.

The v8.2.0 release also ships (per Plan 28-06) a **shipped-by-default WHITELIST URL-scheme sanitizer** on the display-side markdown → InlineRuns pipeline (both backends). Not a composite change; not in this doc's scope beyond the note that any Route B composite in the future that emits `InlineRun.href` inherits the sanitizer transparently on rebuild. Full contract documented at AGENTS.md gotcha #4a; full CHANGELOG entry at `CHANGELOG.md` §8.2.0.

### Phase 30 addendum (v9.1.0, chat composer — staged in CHANGELOG `## Unreleased`; landing at closeout)

Adds a **new Route B composite** (`ChatComposerNode` — see the §4 shipped-recipe inventory row + §4e for the shape-earned rationale + typed slots + variance axes) and one new shipped icon glyph (`square`, drives the `status:"streaming"` stop button). The composite passed Route B governance via the 3-panel tasting served on the tailnet 2026-08-02; Ashley taste-locked Panel 3 (`banging`); Panel 2 failed the visual bar for the substantive reason that even with a Route A `FieldNode(inputType:"file", variant:"icon-only")` addition, `Section(row)+heterogeneous-siblings` cannot produce the growable-center-fixed-ends layout the compose-bar needs (send button wraps under the attach button + textarea; no unified pill surface).

Two structural properties of the Phase 30 addition worth noting for future composite plans:

1. **`ChatComposerNode` earns its own composite despite not being row-shaped.** The composite-as-list-row precedent from Phase 24-25 (`ListRowNode`, `UserRowNode`, `SettingRowNode`, `DetailRowNode`, `TimelineEntryNode`, `MessageNode`) established a strong shape: leading + primary + secondary + trailing + meta, with the composite participating in a homogeneous list. `ChatComposerNode` is a **single-instance compose bar** (not a list; no `ChatComposerListNode`) with a fundamentally different shape (growable center + fixed ends within a unified pill). Both shapes are valid Route B composites — the earned-a-composite bar is per-shape-visual per §2, not per-shape-family.
2. **The wire-widened `ActionEvent.files` type** (from `Record<string, File>` to `Record<string, File | File[]>`) is BACKWARD-COMPATIBLE: single-file callers see zero change (still receive a bare `File`); multi-file callers receive `File[]` under the same key. Server-side, .NET `Request.Form.Files.GetFiles(name)` and TS `payload.files[name]` already handled multi-file semantics before Phase 30; only the client-adapter internal type widened. This is the pattern for future adapter-internal type widenings that fold multiple-value semantics into an existing single-value slot: **prefer the union type over a parallel field**, so consumers can migrate lazily.

The v9.1.0 release also introduces the `square` shipped icon glyph — used exclusively by ChatComposerNode's send button in the `status:"streaming"` state. Not a composite change; not in this doc's scope beyond the note that new shipped glyphs continue to land in `icons-payload.ts` and are available to any composite/primitive that renders an IconName. Full contract will land at `CHANGELOG.md` §9.1.0 at closeout; currently accumulating in `## Unreleased`.

---

## 6. Conventions the milestone follows

Every convention below is a banked lesson from a prior VMS release; documented here so Phase 24-26 planners inherit them without re-deriving.

### Fleet-adoption discipline

**Every composite ships WITH real demo adoption in the same batch as its primitive.** Banked from the `UseVmsShellStaticFiles` 6.7.0 fire — helpers that shipped without demo adoption sat unused, drifted from the mainline, and had to be retrofitted or removed. Phase 24-25 plans for each composite include a Showcase-demo adoption task in the same commit run; Phase 26's wider adoption is *additive*, not a "finally hook it up" late arrival.

### Parity `expectBodyContains` tripwires per branch

Every composite grows `buildVm` in **all** parity backends (bun, .NET, and every configured FeatureProbe variant per `parity/backends.json`) AND ships an `expectBodyContains` string that is *a substring only that branch emits*. Banked from the 6.0.0 seeded-helpdesk fix — the parity diff is only half the gate. **A diff can only prove things about code it actually RUNS**; a fixture step whose branch stops firing goes silently vacuous and prints "all backends agree" over a real drift. Every composite's parity coverage carries at least one `expectBodyContains` naming a substring the branch produces (e.g. `"\"type\":\"message\""`, `"\"role\":\"assistant\""`, `"\"kind\":\"online\""`), so a coverage regression fails loudly.

### AA-contrast hand-check per new fg/bg pair

The fixed 13-pair `check:aa-contrast` gate **does NOT auto-cover new pairs.** Banked from the 3.5.0 toast fix, again from v5.1 (breadcrumb/steps markers), again from v7.0 (icon-on-tone). Every composite's new pair — Message role-tinted content surface, Alert tinted border + icon-on-tinted-surface, Avatar initials-on-tone circle, Chip tinted pill, Timeline dot on tinted rail, SettingRow switch on-state — gets hand-checked across default + all 12 themes to WCAG target (≥4.5:1 for text, ≥3:1 for graphical UI state where state is also carried by an ARIA attribute).

### Closed-union-must-be-enum on .NET

Every closed union in the new composites (tone, role, kind, size, state, variant, orientation, `MessageNode.role`, `UserRow.status.kind`, `AvatarNode.size`, etc.) is a **real .NET enum** with a `KebabEnum<T>` converter — never `string?`. Banked from the 6.0.0 migration and reinforced by the ongoing v7.0 audit (37 of 37 shipped closed unions were `string?` on .NET at last count). The whole point of the closed union is that a bad value fails both backends' tree-validators; `string?` on .NET keeps the walker silent. Maintainer rule; non-negotiable.

### Null-omission + optional-bool absence

Gotcha #8, non-negotiable across every new field and every new record on both backends:
- Every nullable optional field on a `.NET` record carries `[JsonIgnore(Condition = WhenWritingNull)]`, so absent-vs-null stays byte-identical between the TS twin (which never emits `null`) and the .NET twin.
- Every optional non-nullable bool (`dismissible?: boolean` on AlertNode, potential `followTail?` on MessageListNode) carries `[JsonIgnore(Condition = WhenWritingDefault)]`, so `false` serializes as ABSENT — matching the TS optional-`false` posture.
- Every closed-enum optional carries `WhenWritingNull` too.

### Batch-then-ship

Phase 23-25 do NOT publish. CHANGELOG entries accumulate under an "Unreleased — v8.0.0 (in progress)" heading throughout. **The release ritual runs exactly once, at Phase 26 closeout**, with all 10 composites + 3 wire tweaks + 1 new primitive publishing as one aligned `viewmodel-shell@8.0.0` + `AshleyShrok.ViewModelShell 8.0.0` bump.

**Rationale:** milestone coherence to consumers. A consumer looking at v8.0.0 sees the composite-nodes layer as one thing they can adopt, not "some parts in 7.1.0, some in 7.2.0, some in 8.0.0". This is Ashley's default preference and the argument holds here: the composites teach each other through the Showcase and the verification page.

### Route A / Route B coexistence

Recipes **never DEPRECATE primitives.** No composite ever obsoletes a primitive; a consumer with a shape that doesn't match any recipe drops to primitives and composes. The AGENTS.md governance section (Phase 23-06) states this rule at the framework level.

### The `@experimental` TUI target

TUI drops the composites entirely for v1. Per the standing directive (TUI is `@experimental`, not-invested-in): rendering a Timeline rail or an Avatar circle in a terminal isn't a v1 problem worth solving. TUI renders composites as **either their content-only slots stacked (best-effort semantic degradation) or nothing** — Phase 24 planner decides per composite; the honest degradation is a semantic-content-only render that a screen reader could theoretically follow, but zero visual recipe.

### Green-tree gate

Every commit in every phase passes the full green-tree gate before landing: `npm run build && check:test-types && check:core-globals && check:aa-contrast && check:no-demo-style && check:demo-types && npx vitest run` + `dotnet test viewmodel-shell-dotnet/Tests` + every `demo/**/*.Tests.csproj` + `bun run parity/run.ts`. Non-negotiable. Any pre-existing failure surfaces to the operator before the phase advances (banked lesson from the `viewmodel-shell-dotnet/Tests` 3.0.0→3.3.0 uncompilable window).

---

## 7. Deferred / open questions

Recorded so they are **decisions, not implementation accidents.** Later planners resolve these; this section is the deferred-decisions ledger.

### Per-composite (Phase 24-25 planner decides at plan time)

- **Slot-name convention: `primary` vs `heading`?** ListRow uses `primary`; Alert uses `title`; EmptyState uses `title`; Message uses `author` + `content`. There is a case to converge on `heading` universally for the semantically-primary slot, and a case to keep the per-shape names because they read more naturally in context. Phase 24 decides.
- **`AlertNode.dismissible` a11y contract.** When the close-X is shown, does the composite manage its own dismissed state client-side, or does the server round-trip a `dismissed: true` field on the state and re-omit the alert on next render? The framework's "state lives server-side" doctrine points at server-authoritative; but a purely-client dismiss avoids a server round-trip for a UI hint. Phase 24.
- **`ChipListNode` role — `role="list"` vs `role="group"`?** Chips-as-list is more accurate when the chips are a homogeneous set (filter tags); chips-as-group is more accurate when they act more like a toolbar. Phase 25 picks (probably `role="list"` with `role="listitem"` per chip; each dismiss button gets `aria-label="Remove {label}"` per the banked GOV.UK failure lesson).
- **Whether `MessageListNode.followTail` reuses `SectionNode.followTail`.** Same wire shape, same semantics? Or is chat-transcript follow-tail different enough (auto-scroll on new message with user-scroll-up cancels) that it needs its own field? Phase 24.
- **Timeline entry — description as `string | ViewNode` vs. always `ViewNode`.** The wire is simpler as always-ViewNode with a `TextNode` wrapper when a string is enough; but `string | ViewNode` is more ergonomic. Phase 25.

### Cross-composite (any Phase 24-25 planner may raise)

- **Shared typed-slot utility record?** If every composite genuinely obeys the `{ leading, primary, secondary, meta[], trailing, tone, state }` shape (see §3), a single `TypedSlots` record factored on both backends removes duplication. But too-early factoring can lock in constraints that force later composites into awkward shapes. Phase 24 decides based on how much variance appears across the four primary composites; if the shape holds cleanly for all four, factor it in Phase 25. If it varies, keep the current per-composite slot declarations.
- **EmptyState composite vs. property-on-collection.** Named in §4c; Ashley picks during Phase 24 planning. If the property-on-collection path wins, EmptyStateNode drops from the milestone and this doc gets a "not shipped" note in this section.
- **Weight axis shape — Option A (new field) vs. Option B (style extension).** Named in §4a; Phase 23 planner picks under Ashley review. Both shapes are patterned in-repo; the tasting-recommended Option A composes cleanly with the caption tier. The choice affects the wire (Option A grows a field; Option B grows the style union) but not the recipe surface.

### Shapes intentionally NOT promoted (candidates held pending signal)

Named on the tasting page's "not yet included" list. Recorded here so a future planner doesn't re-propose one without new evidence:

- **`PageHeaderNode`** — page-level "title + subtitle + right-aligned actions" strip. Composable from `Section(row, arrange:"space-between")` today at a decent baseline. Would earn a composite if the "eyebrow / breadcrumbs / meta bar" variants come up as consumer asks.
- **`MediaCardNode`** — image/video thumbnail + title + description (media library, file browser, video app). Weaker signal in the current consumer set.
- **`PaginationBarNode`** — `TableNode` already ships pagination internally; a standalone bar for non-table lists would earn one if list-with-pagination becomes common.
- **`SectionHeaderNode`** — "title / description / right-aligned actions" strip within a section. Very close to `SectionNode` with a heading; may not earn its own type.
- **`NavRailNode` / `AppBarNode`** — app-shell scale, likely a different design pass; would be consumed by future app-shell work.

Consumers who reach for one of these open a bounty; the tasting-page + earn-a-composite discipline applies to any new promotion.

---

## 8. References

- **The pre-doc design source:** `bounties/composite-nodes-layer/tasting-page/index.html` — served on the tailnet at `http://100.113.23.63:8182/`, 2026-07-29. Ashley signed off after eyeballing before/after side-by-side, light + dark, in real `BrowserAdapter` on the left and hand-mocked hypothetical composites on the right, for every one of the ten shapes. **Once this doc is written it supersedes the tasting page as design of record for Phases 24-26** — but the tasting page stays as the provenance record of *what was eyeballed and by whom* on the design-approval date.
- **The framework capability gap survey template:** `.planning/design/framework-capability-gap-survey.md` (2026-07-23). The category-first audit method that surfaces gaps the request-first method cannot; run it periodically to keep the composite layer honest against what mature peers ship.
- **Similar-shape prior design docs (structural precedent for this file):** `.planning/design/icons-primitive.md` (v7.0.0 — leaf primitive + closed-union subset + cross-node composition), `.planning/design/nav-primitives.md` (v5.1 — two additive primitives shipped together in one release), `.planning/design/lookup-field.md` (v5.2 — D1..DN load-bearing decisions with survey-backed rationale), `.planning/design/chart-base-set.md` (multi-primitive milestone with cross-cutting rework).
- **AGENTS.md governance sections this doc plugs into:** the existing "Design system" section (Route A axes + node composition), "Conventions for evolving the framework" (Route B governance section added by Phase 23-06 mirrors §2 of this doc verbatim), "Working agreement" (green-tree gate + batch-then-ship + publish ritual — all inherited unchanged).
- **The banked-lesson entries referenced across §6:** `UseVmsShellStaticFiles` 6.7.0 (fleet-adoption discipline); 6.0.0 seeded-helpdesk fix (`expectBodyContains` tripwires); 3.5.0 toast fix + 5.1 markers + 7.0 icon-on-tone (AA-contrast hand-check); 6.0.0 migration + ongoing 7.x audit (closed-union-must-be-enum); Gotcha #8 (null omission); Working-agreement green-tree gate.

---

## 9. Change log for this doc

| Date | Change | Author |
|---|---|---|
| 2026-07-29 | Doc created; initial frame written as Phase 23 outputs. Section 1 (thesis) + Section 2 (governance rule, mirrored into AGENTS.md by plan 23-06) + Section 3 (typed-slots pattern) + Section 4 (10 composites + 3 wire tweaks + 1 primitive inventory) + Section 5 (Phase 23→26 adoption order) + Section 6 (conventions the milestone follows) + Section 7 (deferred / open questions) + Section 8 (references) + this change log. **Design of record until superseded by explicit amendment.** | Phase 23 planner. |
| 2026-08-02 | Phase 28 (v8.2.0) additions: `RichTextToolbarNode` row added to §4 shipped-recipe inventory table (wire type `"rich-text-toolbar"`); §5 gains Phase 27 addendum + Phase 28 addendum recording the rich-text WYSIWYG milestone. `RichTextFieldNode` (the leaf-input primitive) is NOT in the composite inventory per §3 (leaf inputs don't earn Route B rows) — only the toolbar customization seam does. `RichTextToolbarNode` is the fifth composite to adopt the Phase 27 `state?: string` axis uniformity precedent as a matter of course. Additive only; no §1-§3 amendment. | Phase 28 planner (Plan 28-11 executor). |
| 2026-08-02 | Phase 30 (v9.1.0, staged in CHANGELOG `## Unreleased`) additions: `ChatComposerNode` row added to §4 shipped-recipe inventory table (wire type `"chat-composer"`); new §4e subsection documenting the shape-earned rationale (Panel 2 failure → Panel 3 `banging` at 2026-08-02 3-panel tasting), typed slots (5), variance axes (`status`/`dropScope`/`submitMode` + `disabled`), required fields (`bind` + `sendAction`), the ActionEvent-that-is-NOT-a-slot pattern (`attachAction`), and all baked-in framework behaviors (unified pill layout, AI-elements send-button state machine, IME `isComposing` guard, three attach ingress paths, framework-owned chip strip with blob-URL cleanup, multipart wire ride, Backspace-on-empty). §5 gains Phase 30 addendum recording the `ChatComposerNode` earn-a-composite deviation from the row-shaped precedent + the `ActionEvent.files` type widening (backward-compatible). Deferred `state?: string` axis for the compose-bar shape (not row-shaped; `disabled` already first-class). Additive only; no §1-§3 amendment. | Phase 30 planner (Plan 30-08 executor). |

The doc grows as Phase 24-25 land per-composite sections (per-composite implementation notes, per-composite a11y verification results, per-composite AA-contrast hand-check outcomes) and Phase 26 wraps the release ritual (final composite inventory as shipped, MIGRATION.md summary, verification-page URL of record). Phase 23's version establishes the frame; subsequent phases *extend*, never *contradict* it. If a Phase 24-25 finding requires a §1-§6 amendment, the amendment lands as an explicit entry in this change log with a rationale — never a silent edit.
