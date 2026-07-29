# Phase 24: v8.0 Primary composites — Context

**Gathered:** 2026-07-29
**Status:** Ready for planning
**Source:** v8.0.0 Composite-Nodes Layer milestone (Phase 24 of 4). Direct continuation of Phase 23 Foundations, which landed and was Ashley-signed-off on 2026-07-29.

> ⚠️ **PLANNER: READ THE DESIGN OF RECORD FIRST.** The design doc for this whole milestone lives at `/home/thenasty/ViewModelShell/.planning/design/composite-nodes-layer.md` (written in Phase 23 plan 23-05). Every composite's slot schema is inventoried there, alongside the governance rule, typed-slots pattern, and the "shipped recipe inventory" table that grows as this phase lands. **The tasting page** at `~/.claude/identities/vicky/bounties/composite-nodes-layer/tasting-page/index.html` (previously served at http://100.113.23.63:8182/) is the visual source of truth for what each composite should look like — the exact hand-mocked "after" HTML for each composite is the visual target the browser renderer must match. Do NOT re-derive schemas from scratch; the tasting-page mockups + design doc lock every decision.

<domain>
## Phase Boundary

Land the **4 primary Route B composite recipes** — the shapes that the tasting approved with the strongest evidence + live consumer pressure (Metis incidents queue for ListRowNode, `/ai` chat for MessageNode, Moxie's banner ask for AlertNode, every collection-with-nothing-to-show for EmptyStateNode). Each composite:

- Consumes Phase 23 foundations (`TextNode.style: "caption"` for tertiary meta lines, `TextNode.weight` for row primaries, `AvatarNode` for user identity slots)
- Follows the typed-slots pattern (semantic-name slots + unconstrained ViewNode content in each slot + closed-enum variance axes)
- Ships byte-identical TS/.NET
- Ships with parity extension (`expectBodyContains` tripwires per composite branch)
- Ships with AA-contrast hand-check for new fg/bg pairs
- Ships with vitest + .NET serialization tests
- Ships with Showcase adoption in the "Composites" tab (extending the Foundations section from Phase 23)

Phase 24 does NOT release. CHANGELOG accumulates under "Unreleased" heading (created in Phase 23 plan 23-08). v8.0.0 publishes at Phase 26 closeout.

**In scope:**
- `ListRowNode` (COMP-05) + `ListNode.variant: "rows"` extension (COMP-05a)
- `MessageNode` (COMP-06) + `MessageListNode` with `followTail` semantics (COMP-06a)
- `AlertNode` (COMP-07) with tone→icon default mapping
- `EmptyStateNode` (COMP-08)
- Parity FeatureProbe `buildVm` extended in all 3 backends per composite (v5.1 pattern — EXTEND, not new fixture; append to `$comment` clause)
- AA-contrast hand-check for every new fg/bg pair each composite introduces
- Vitest per composite + .NET serialization tests
- Showcase demo Composites tab (or extension of the Foundations section into a "Primary Composites" section)
- `.planning/design/composite-nodes-layer.md` "shipped recipe inventory" table grows with these 4 (Phase 23 landed the frame with empty inventory)
- AGENTS.md "Route B composite-nodes layer" governance section grows: add the 4 primaries to the shipped inventory
- CHANGELOG.md "Unreleased — v8.0.0 (in progress)" accumulates 4 more entries

**Out of scope (deferred to Phase 25):**
- `UserRowNode`, `DetailRowNode`, `TimelineEntryNode`, `SettingRowNode`, `ChipListNode` + `ChipNode` (secondary composites)
- v8.0.0 release ship (Phase 26)
- Comprehensive tailnet verification page across all 10 composites (Phase 26)

**Explicitly NOT out of scope (do here):**
- **`empty-state-on-collections` bounty resolution.** The open bounty proposed devolving empty-state onto TableNode/ListNode as a property. The tasting approval resolved the design question: **`EmptyStateNode` standalone composite wins**. The composite is drop-in composable into the existing TableNode/ListNode empty-cell slots (which the collection nodes already ship — an empty ListNode renders `<p>No items</p>` today; consumers who want a richer empty state just pass an `EmptyStateNode` as an empty-slot child if the collection supports slotting, OR just render an EmptyStateNode standalone when the collection is empty at the app level). The bounty resolves as-planned by shipping the composite; no collection-property extension needed. Close the bounty as `resolved-by-COMP-08` when Phase 24 lands.
</domain>

<decisions>
## Locked Decisions

Schemas locked at tasting approval 2026-07-29. Slot names + variance axes + typography tier assignments are LOCKED. Do NOT re-litigate the shape; only the implementation details are the planner's judgment call.

### 1. `ListRowNode` — LOCKED

**Wire shape** (both backends byte-identical):
```typescript
export interface ListRowNode {
  type: "list-row";
  leading?: ViewNode;                              // icon / badge / avatar / checkbox
  primary: string | ViewNode;                       // trained: text-md, weight:"medium"
  secondary?: string | ViewNode;                    // trained: text-sm, muted
  meta?: (string | ViewNode)[];                     // trained: text-xs (caption tier), muted
  trailing?: ViewNode;                              // right-aligned
  tone?: "danger" | "warning" | "success" | "info"; // left-accent border
  state?: string;                                    // freeform — active/done/disabled/high (matches ListItem)
  action?: ActionEvent;                              // whole-row click
}
```

**Renderer rules:**
- `primary` string → wrap in `TextNode { style: "body", weight: "medium" }` (consumes COMP-02).
- `primary` ViewNode → render as-is (consumers who need custom shapes still can).
- `secondary` string → wrap in `TextNode { style: "muted" }`.
- `meta[]` string → wrap each in `TextNode { style: "caption" }` (consumes COMP-01).
- `action` present → `role="button" tabindex=0`; clickable via Enter + Space (Space preventDefaults page scroll); accessible via `aria-label` derived from primary + meta text. Interactive descendants (buttons, checkboxes, links in cells) `stopPropagation` — same shape as TableRow.action per PATTERNS.md analog.
- `tone` → `.vms-list-row--{tone}` class → left-accent border via existing tone tokens.
- `state` → `.vms-list-row--{state}` freeform class; framework ships styling for `active`/`done`/`disabled`/`high` (mirrors ListItem.state).

**DOM structure** (matches the tasting mockup exactly):
```
<li class="vms-list-row [vms-list-row--{tone}] [vms-list-row--{state}]">
  <div class="vms-list-row__leading">{leading}</div>
  <div class="vms-list-row__content">
    <div class="vms-list-row__primary">{primary}</div>
    <div class="vms-list-row__secondary">{secondary}</div>
    <div class="vms-list-row__meta">{meta[0]}</div>
    <div class="vms-list-row__meta">{meta[1]}</div>
    ...
  </div>
  <div class="vms-list-row__trailing">{trailing}</div>
</li>
```

CSS grid: `[leading | content | trailing]` — leading = auto, content = 1fr min-width:0 (so long strings truncate cleanly), trailing = auto. `align-items: start` so a multi-line meta stack doesn't vertically center against a small leading badge.

**Standalone vs in-list rendering:**
- **Standalone `<li>`** is invalid HTML — a `<list-row>` outside a `<ul>` needs to be a `<div>` or the renderer wraps in a `<ul>` on the fly. Simplest: emit `<li>` if the parent is a `list` / `list-rows` container; emit `<div class="vms-list-row-standalone">` if not (framework detects via renderer context — same pattern the checkbox renderer uses for standalone vs form-scoped emit).
- **In a `ListNode(variant:"rows")` container** → the container emits `<ul class="vms-list-row-list">` with per-row dividers (via `border-top` on `.vms-list-row + .vms-list-row`).

### 2. `ListNode.variant: "rows"` — LOCKED (COMP-05a)

Extend the shipped `ListNode` with an optional variant field:

```typescript
export interface ListNode {
  type: "list";
  variant?: "items" | "rows";        // NEW — omitted/"items" = today (byte-identical), "rows" = ListRowNode-only container
  ordered?: boolean;                  // shipped
  children: ViewNode[];               // shipped
}
```

**Renderer rules:**
- Omitted / `"items"` → today's `<ul class="vms-list">` with ListItem children. Byte-identical to current behavior.
- `"rows"` → `<ul class="vms-list vms-list--rows">` with ListRowNode-only children. Tree-validator rejects mixed children (a ListRowNode inside a `variant:"items"` list, or a ListItem inside a `variant:"rows"` list, fails `invalid_tree` at buildVm/action-response). Renders as a single bordered surface via `.vms-list--rows { background: var(--vms-surface); border: 1px solid var(--vms-border); border-radius: var(--vms-radius); overflow: hidden; }` — matches the tasting mockup exactly.

Old renderers (pre-Phase-24) gracefully degrade on unknown variant — no `.vms-list--rows` class rule ⇒ falls back to today's `.vms-list` styling.

### 3. `MessageNode` — LOCKED (COMP-06)

**Wire shape:**
```typescript
export interface MessageNode {
  type: "message";
  avatar?: ViewNode;                                  // typically AvatarNode (COMP-04) — slot accepts any ViewNode
  author: string;                                     // trained: text-sm, weight:600
  timestamp?: string;                                 // trained: caption tier (COMP-01)
  content: string | ViewNode;                         // wrapped in padded surface
  role?: "user" | "assistant" | "system";             // closed union — controls surface tone
  actions?: ButtonNode[];                             // right-aligned action bar (always-visible)
}
```

**Renderer rules:**
- `avatar` slot: rendered as a leading column (grid col 1); slot accepts any ViewNode but typical is `AvatarNode`.
- `author` header: `<span class="vms-message__author">` with trained `TextNode text-sm weight:600` typography.
- `timestamp` header: `<span class="vms-message__timestamp">` with trained caption-tier typography.
- `content` slot: string → `TextNode { style: "body" }` wrapped; ViewNode → render as-is. Container is a padded surface (`.vms-message__content`) with role-based background.
- `role: "assistant"` → tinted-info surface via `color-mix(in srgb, var(--vms-info) 6%, var(--vms-surface))`.
- `role: "user"` / `"system"` / omitted → neutral surface (`var(--vms-surface)`).
- `actions[]`: rendered as a trailing button row inside the message, right-aligned. **Always visible — no hover-reveal.** Banked lesson: hover-reveal has a11y + touch failure modes; the shipped design of record (`composite-nodes-layer.md`) explicitly excludes hover-reveal.

**DOM structure:**
```
<div class="vms-message vms-message--{role}">
  <div class="vms-message__avatar">{avatar}</div>
  <div class="vms-message__body">
    <div class="vms-message__header">
      <span class="vms-message__author">{author}</span>
      <span class="vms-message__timestamp">{timestamp}</span>
    </div>
    <div class="vms-message__content">{content}</div>
    <div class="vms-message__actions">{actions}</div>
  </div>
</div>
```

Grid: `[avatar | body]` — avatar = auto (matches AvatarNode's size), body = 1fr.

### 4. `MessageListNode` — LOCKED (COMP-06a)

**Wire shape:**
```typescript
export interface MessageListNode {
  type: "message-list";
  children: MessageNode[];              // tree-validator rejects non-MessageNode entries
  followTail?: boolean;                 // WhenWritingDefault; inherits SectionNode.followTail semantics
}
```

**Renderer rules:**
- Renders as `<div class="vms-message-list">` (or `<ol>` if we want semantic ordering — planner picks; `<div>` is simpler + matches other list containers).
- `children` must all be MessageNodes; tree-validator rejects a mixed tree (e.g., a MessageNode next to a TextNode in the same MessageList) with `invalid_tree`.
- `followTail: true` → `data-follow-tail="true"` attribute; the browser adapter's existing follow-tail logic (per SectionNode.followTail) reads this attribute and applies at-bottom-detection + pin-to-new-bottom. No new adapter code — reuses the shipped mechanism.
- `followTail: false` / omitted → normal preserve-my-place scroll restoration (banked mechanism from #7).

**Reusing SectionNode.followTail's implementation is CRITICAL** — the plan-checker C-4 warning applies here: don't build a parallel mechanism. Grep the browser.ts implementation of `SectionNode.followTail` and reuse the same code path for MessageListNode's follow-tail. If refactoring is needed to share, do it as a small preparatory task before wiring MessageListNode.

### 5. `AlertNode` — LOCKED (COMP-07)

**Wire shape:**
```typescript
export interface AlertNode {
  type: "alert";
  tone: "danger" | "warning" | "success" | "info";    // REQUIRED — the point of the node
  title?: string;                                     // trained: text-md, weight:600
  message: string | ViewNode;                         // trained: text-sm, muted
  icon?: IconName;                                    // overrides tone→icon default
  actions?: ButtonNode[];                             // right-aligned size:"sm"
  dismissible?: boolean;                              // WhenWritingDefault
}
```

**Tone → icon default mapping** (baked into the browser renderer; overridable via `icon?`):
- `danger` → `x-circle`
- `warning` → `alert-triangle`
- `success` → `check-circle`
- `info` → `info`

All four default names are LUCIDE icons already in the curated set shipped in Phase 22 (v7.0 icons).

**Renderer rules:**
- Tone selects the color palette: `.vms-alert--{tone}` sets tinted-surface background + colored border + colored icon.
- Icon: if `icon?` is present, use it; else use the tone default. Rendered via `renderIconSvg(iconName, "md")` — reuses the Phase 22 icon SVG renderer.
- `title` string → `TextNode { style: "body", weight: "medium" }` wrapped (mirrors Alert §1 in the tasting mockup — note: not text-md heading, just weight-elevated body).
- `message` string → `TextNode { style: "muted" }`.
- `actions[]`: right-aligned, size="sm" default per composite convention.
- `dismissible: true` → close-X button in the top-right; dispatches an action named `dismiss` (or `alert-dismiss` — planner picks; use `dismiss` for simplicity + banked convention). App catches the action name via its normal switch. No `dismissAction: ActionEvent` slot — that would be redundant; the composite emits `{name: "dismiss"}`.

**DOM structure:**
```
<div class="vms-alert vms-alert--{tone}">
  <div class="vms-alert__icon">{iconSvg}</div>
  <div class="vms-alert__body">
    <div class="vms-alert__title">{title}</div>
    <div class="vms-alert__message">{message}</div>
  </div>
  <div class="vms-alert__actions">
    {actions}
    [dismissible ? <button class="vms-alert__dismiss" ...>×</button> : null]
  </div>
</div>
```

Grid: `[icon | body | actions]`.

### 6. `EmptyStateNode` — LOCKED (COMP-08)

**Wire shape:**
```typescript
export interface EmptyStateNode {
  type: "empty-state";
  icon?: IconName;                     // trained: 3rem circle, 1.5rem icon inside
  title: string;                       // trained: text-lg, weight:600
  description?: string;                // trained: text-sm, muted, max-width for readable line length
  action?: ButtonNode;                 // centered below (single action)
}
```

**Renderer rules:**
- `icon` in a tinted-circle background (uses `--vms-accent` tinted at 12%); rendered via `renderIconSvg(iconName, "lg")` or larger.
- `title` string → `TextNode { style: "subheading" }` wrapped (or the Phase 22 heading tier — planner picks; `subheading` is the shipped closest; consider promoting to a new `title` style value if the visual differs).
- `description` → `TextNode { style: "muted" }` with `max-width` styling on the container.
- `action` (single ButtonNode) → centered below, typically `emphasis: "secondary"` size:"md".
- Container: centered stack (`display: flex; flex-direction: column; align-items: center; text-align: center;`) with generous vertical padding.

**DOM structure:**
```
<div class="vms-empty-state">
  <div class="vms-empty-state__icon">{iconSvg}</div>
  <div class="vms-empty-state__title">{title}</div>
  <div class="vms-empty-state__description">{description}</div>
  <div class="vms-empty-state__action">{action}</div>
</div>
```

**Bounty resolution:** the open bounty `empty-state-on-collections` (which proposed devolving empty-state onto TableNode/ListNode as a property) is RESOLVED by shipping this composite. The tasting-approval discussion decided: **standalone composite wins vs. devolve-to-collection-property.** Consumers who want a richer empty state in a Table/List either (a) render an EmptyStateNode standalone at the app level when the collection is empty, or (b) if the collection ships an empty-cell slot, pass an EmptyStateNode as the child. No new collection field needed. Close the bounty as `resolved-by-COMP-08` when Phase 24 lands.

### 7. Tree-validator descent (LOCKED, both backends)

Every composite has ViewNode-typed slots (leading, primary/heading, secondary/description, meta[], trailing, content, actions[], action). Both tree-validators (TS + .NET) MUST descend into these slots:

- `ListRowNode`: descend into `leading`, `primary` (if ViewNode), `secondary` (if ViewNode), each `meta[i]` (if ViewNode), `trailing`, `action` (action-name collection). Slots that accept `string | ViewNode` need type-branching in the walker.
- `MessageNode`: descend into `avatar`, `content` (if ViewNode), each `actions[i]` (ButtonNode).
- `MessageListNode`: descend into each child (which must be a MessageNode — validator rejects otherwise).
- `AlertNode`: descend into `message` (if ViewNode), each `actions[i]`.
- `EmptyStateNode`: descend into `action` (single ButtonNode).

**Action-name uniqueness invariant** (banked from Nelly's TODO discovery, 2026-07-16): duplicate action names anywhere in one tree are `invalid_tree`. Composites don't relax this — a ListRowNode with `action: {name: "back"}` inside a page that also has a ButtonNode with `action: {name: "back"}` fails validation.

### 8. Parity extension pattern (LOCKED, PATTERNS.md analog)

Per the v5.1 shipped pattern (PATTERNS.md §11) — EXTEND FeatureProbe `buildVm` in all 3 backends (bun, node, dotnet — but bun and node share the `demo/FeatureProbe-bun/handler.ts` cwd). Append the v8.0.0 primary-composites clause to `parity/fixtures/feature-probe.json` `$comment`. Minimum ONE `expectBodyContains` tripwire per composite that ONLY its branch emits. Suggested tripwires (planner adjusts as needed):

- `"type":"list-row"` (COMP-05)
- `"variant":"rows"` (COMP-05a)
- `"type":"message"` (COMP-06)
- `"role":"assistant"` (COMP-06 role variant)
- `"type":"message-list"` (COMP-06a)
- `"followTail":true` (COMP-06a — but note: WhenWritingDefault means followTail:false is ABSENT; a followTail:true case emits this)
- `"type":"alert"` (COMP-07)
- `"tone":"warning"` (COMP-07 tone required — pick a distinct one so it's unique to alert; may need a more specific tripwire like `"type":"alert"` combined with a specific `title` value)
- `"dismissible":true` (COMP-07 dismissible variant — WhenWritingDefault)
- `"type":"empty-state"` (COMP-08)

Every tripwire is a substring only ITS branch emits. Mutation-testable per plan-checker C-3.

### 9. AA-contrast hand-check (LOCKED)

The fixed 13-pair `check:aa-contrast` gate does NOT auto-cover new pairs. Every new fg/bg pair each composite introduces:

- **AlertNode** — for each `tone`, the tinted-surface background × title text × message text × icon × action button. 4 tones × default + 12 themes × 4 elements = 208 pair-checks. Where any fails AA-normal 4.5:1 (title, message) or WCAG UI-state 3:1 (icon glyph, action button), deepen via `color-mix` or use KNOCKOUT per v5.1 pattern.
- **MessageNode assistant surface** — tinted-info content surface × body text. Check WCAG AA on all themes.
- **ListRowNode hover-tint** — the row hover state uses a subtle accent tint; must not lower text contrast below AA.
- **EmptyStateNode tinted-circle icon backdrop** — icon inside 12%-accent-tinted circle; check AA on the icon glyph.

Document every pair × theme × ratio in the per-test-file AA hand-check header (banked pattern from Phase 23 plans).

### 10. Fleet-adoption discipline (LOCKED)

Per the `UseVmsShellStaticFiles` 6.7.0 banked lesson — helpers ship WITH demo adoption in same batch. Phase 24 lands the 4 composites AND their Showcase adoption together. Consider: extend the Foundations section (added in Phase 23 plan 23-07) with a "Primary Composites" sub-section, OR add a new "Composites" tab that houses both Foundations and Primary sections. Planner picks; the constraint is that adoption ships in the same batch as the composites themselves.

### 11. Batch-then-ship (LOCKED per milestone)

Phase 24 does NOT release. `package.json` stays 7.1.0; `.csproj` stays 7.0.0. CHANGELOG accumulates 4 more entries under the "Unreleased — v8.0.0 (in progress)" heading (created in Phase 23 plan 23-08). MIGRATION.md gets 4 more additive notes ("Alert/ListRow/Message/EmptyState are new node types; no consumer changes required").

### 12. Design doc + AGENTS.md updates

- `.planning/design/composite-nodes-layer.md` — Phase 23 landed the frame with an "empty inventory" table. Phase 24 fills in the 4 primary composites (name, slot summary, phase-shipped-in, evidence).
- `AGENTS.md` "Route B composite-nodes layer" governance section — Phase 23 landed the initial frame. Phase 24 adds a "Currently shipped recipes" mini-inventory listing the 4 primaries + their Phase 23 foundation consumption.

Both files touched in a dedicated plan (or two — planner picks scope).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design of record (MANDATORY)
- `/home/thenasty/ViewModelShell/.planning/design/composite-nodes-layer.md` — landed 2026-07-29 (Phase 23 plan 23-05). Full inventory + governance + typed-slots pattern. Every schema decision cross-references here.
- `/home/thenasty/.claude/identities/vicky/bounties/composite-nodes-layer/tasting-page/index.html` — the visual approval source; hand-mocked "after" HTML for each composite is the visual target.

### Framework conventions (this repo)
- `/home/thenasty/ViewModelShell/AGENTS.md` — every gotcha applies. **Especially**:
  - Gotcha #8: `WhenWritingNull` on nullables; `WhenWritingDefault` on optional non-nullable bools like `dismissible` and `followTail`.
  - Working agreement — green-tree gate before commit; NO PUBLISH/PUSH/TAG in this phase.
  - Fleet-adoption discipline — composites ship WITH demo adoption in same batch.
  - Parity `expectBodyContains` — a diff can only prove things about code it actually RUNS.
  - Closed-union-must-be-enum on .NET.
  - Action-name uniqueness across the tree (Nelly's TODO discovery, 2026-07-16).

### Phase 23 landed artifacts we consume
- `TextNode.style: "caption"` — for MessageNode.timestamp, ListRowNode.meta[], TimelineEntry (P25).
- `TextNode.weight` — for author names, row primaries, alert titles, empty-state titles.
- `AvatarNode` — the standalone primitive; MessageNode.avatar and UserRowNode.avatar (P25) both consume.
- Phase 22 shipped `IconName` closed union + `renderIconSvg` helper — AlertNode + EmptyStateNode icon slots reuse.

### Existing framework analog patterns
- **ListRowNode analog**: `TableRow.action` for whole-row click + `stopPropagation` on interactive descendants. `ListItem` for the `.vms-list-item--{state}` freeform-state pattern.
- **MessageListNode.followTail analog**: `SectionNode.followTail` shipped mechanism (browser.ts) — REUSE, don't re-build.
- **AlertNode analog**: `SectionNode.tone` is close but semantically different (a section IS a container; an alert IS a status message). Tinted-surface pattern from `.vms-section--{tone}` is the closest CSS analog.
- **EmptyStateNode analog**: `.vms-page` with `layout: "stack"` + `align: "center"` is what consumers hand-compose today. The composite bakes in the trained typography + spacing that hand-composition gets wrong.
- **Overall renderer pattern**: Phase 22 IconNode is the freshest byte-aligned template — a leaf ViewNode with closed-enum axes + minimal wire footprint. AvatarNode landed following that template in Phase 23. ListRowNode / MessageNode / AlertNode / EmptyStateNode follow the same shape but with typed slots (ViewNode-typed) instead of primitive-only fields.

### Parity + adoption references
- `parity/backends.json` — 3 FeatureProbe backends: bun, node (shares handler.ts with bun), dotnet.
- `demo/Showcase/frontend/src/main.ts` — Showcase demo; the Foundations section landed by 23-07 is the anchor for the "Primary Composites" section this phase adds.
- `viewmodel-shell/styles/themes/` — 12 theme files; AA hand-check spans default + these 12.
</canonical_refs>

<specifics>
## Specific Ideas

### Suggested plan decomposition

Given 4 composites × ~4 layers (wire types, renderer + CSS, tests + parity, demo adoption), a natural decomposition is ~10 plans across 4-5 waves:

- **24-01**: `ListRowNode` end-to-end (wire type + renderer + CSS + .NET twin + walker descent + vitest + .NET tests + AA hand-check). Includes `ListNode.variant:"rows"` extension (COMP-05a) since they ship together.
- **24-02**: `MessageNode` + `MessageListNode` end-to-end (both COMP-06 + COMP-06a; wire types + renderer + CSS + .NET twin + follow-tail reuse + walker + tests). Investigate whether follow-tail refactor needs a preparatory task.
- **24-03**: `AlertNode` end-to-end (wire type + renderer + CSS + .NET twin + tone→icon default mapping + walker + tests + AA hand-check for the 4-tone × 4-element × 13-theme matrix).
- **24-04**: `EmptyStateNode` end-to-end (wire type + renderer + CSS + .NET twin + walker + tests).
- **24-05**: `.planning/design/composite-nodes-layer.md` — fill in the 4 primaries in the "Shipped recipe inventory" table + add per-composite slot summaries.
- **24-06**: `AGENTS.md` "Route B composite-nodes layer" section — add the 4 primaries to the shipped-recipes inventory.
- **24-07**: Showcase demo Primary Composites section — adopt all 4 in situ.
- **24-08**: FeatureProbe parity extension — extend `buildVm` in all 3 backends per composite; append `$comment` clause; add tripwires to `parity/run.ts`.
- **24-09**: CHANGELOG + MIGRATION accumulate 4 more entries under "Unreleased".
- **24-10**: Full green-tree gate + AA-contrast hand-check re-verify + Showcase visual sign-off (Ashley checkpoint).

Waves:
- **Wave 1**: 24-01 + 24-05 (design doc — file-disjoint)
- **Wave 2**: 24-02 + 24-06 (AGENTS.md — file-disjoint)
- **Wave 3**: 24-03
- **Wave 4**: 24-04
- **Wave 5**: 24-07 + 24-08 + 24-09 (Showcase + parity + CHANGELOG — file-disjoint)
- **Wave 6**: 24-10 (checkpoint — Ashley sign-off)

Planner adjusts as judgment dictates; the constraint is that every COMP-XX (05, 05a, 06, 06a, 07, 08) lands cleanly with all layers (wire + renderer + tests + parity + demo + docs).

### Reuse pattern (banked)

Phase 22 icons landed in ~5 waves for a similar-sized surface. Phase 23 foundations landed in 6 waves for 4 additions. Phase 24's 4 composites are similar-scaled; expect 6-8 waves.

### Testing depth

Each composite:
- **Rendering tests** (vitest): assert exact DOM structure emitted per slot combination (leading present/absent, all tones, all states, action present/absent, etc.). Mutation-testable — mutating the slot-handling arm should break the test.
- **Wire tests** (vitest + .NET): assert wire round-trip byte-identical; `WhenWritingNull` absent on omitted nullables; `WhenWritingDefault` absent on optional non-nullable bools set to false.
- **Tree-validator tests** (vitest + .NET): assert invalid trees (mixed children in `ListNode(variant:"rows")`; non-MessageNode in MessageListNode; ListRowNode with duplicate `action.name` in the same tree) fail with `invalid_tree`.
- **AA hand-check** (documented in test-file headers, NOT automated in vitest): every new fg/bg pair × default + 12 themes × ratio computed and recorded.

### jsdom CSS-computed-style caveat (banked from Phase 23)

Same as Phase 23. If tests assert `getComputedStyle(el).getPropertyValue("...")` on class-driven properties, verify the test setup loads the stylesheet OR drop to class-name assertions.

### dotnet PATH

`export PATH="$HOME/.dotnet:$PATH"` before running any .NET tests (or the parity harness — banked from Phase 23's parity gotcha rediscovery).
</specifics>

<deferred>
## Deferred Ideas

- Phase 25 composites (UserRow, DetailRow, TimelineEntry, SettingRow, Chip+ChipList) — separate phase.
- v8.0.0 release ship — Phase 26.
- Comprehensive tailnet verification page across all 10 composites — Phase 26.
- `EmptyStateNode` as a first-class TableNode/ListNode empty-cell slot property — RESOLVED to standalone composite; consumer composes at app level.
- Hover-reveal action bars on MessageNode — REJECTED per Phase 23 governance section + banked doctrine (a11y + touch failure modes; always-visible action rows are the doctrine-safe pattern).
- Multiple avatar shapes on MessageNode (square, rounded-square) — deferred; only circular AvatarNode available.
</deferred>

---

*Phase: 24-v8-0-primary-composites-listrow-message-alert-emptystate*
*Context gathered: 2026-07-29 direct from Phase 23 landing + approved tasting.*
