# Phase 25: v8.0 Secondary composites — Context

**Gathered:** 2026-07-29
**Status:** Ready for planning
**Source:** v8.0.0 Composite-Nodes Layer milestone (Phase 25 of 4). Direct continuation of Phase 24 Primary composites, which landed and was Ashley-signed-off on 2026-07-29.

> ⚠️ **PLANNER: READ THE DESIGN OF RECORD + THE PHASE-24 PLANS FIRST.**
> - `/home/thenasty/ViewModelShell/.planning/design/composite-nodes-layer.md` — full milestone inventory + governance + typed-slots pattern. Grew in Phase 24 with the 4 primaries; this phase fills in the 5 secondaries.
> - `~/.claude/identities/vicky/bounties/composite-nodes-layer/tasting-page/index.html` — visual source of truth. Sections 5 (UserRowNode), 6 (DetailRowNode), 7 (TimelineEntryNode), 9 (SettingRowNode), 10 (ChipNode+ChipListNode) are the direct visual targets.
> - `.planning/phases/24-*/24-01-PLAN.md` through `24-09-PLAN.md` — freshest byte-aligned template for a v8.0.0 composite plan. **Every Phase 25 plan should mirror the Phase 24 shape** (frontmatter, threat_model, must_haves, task-structure, mutation-testable acceptance criteria).

<domain>
## Phase Boundary

Land the **5 remaining secondary Route B composite recipes** — completing the shipped composite inventory approved in the tasting. Each composite:

- Follows the typed-slots pattern (semantic-name slots + unconstrained ViewNode content in each slot + closed-enum variance axes)
- Consumes Phase 23 foundations where applicable (caption tier for meta lines, weight axis for row-primary titles, AvatarNode from COMP-04)
- Ships byte-identical TS/.NET with tree-validator descent + WhenWritingNull/WhenWritingDefault discipline
- Ships with parity extension (`expectBodyContains` tripwires per composite branch)
- Ships with AA-contrast hand-check for new fg/bg pairs
- Ships with vitest + .NET serialization tests
- Ships with Showcase adoption in a new "Secondary Composites" section (extending the Primary section from Phase 24)

Phase 25 does NOT release. CHANGELOG accumulates under "Unreleased" heading. v8.0.0 publishes at Phase 26 closeout.

**In scope:**
- `UserRowNode` (COMP-09) — person entity display
- `DetailRowNode` + `DetailListNode` (COMP-10 + 10a) — key-value with aligned label column, proper `<dl>` semantics
- `TimelineEntryNode` + `TimelineNode` (COMP-11 + 11a) — activity feed with rail + dot markers
- `SettingRowNode` + `SettingListNode` (COMP-12 + 12a) — label + description + trailing control
- `ChipNode` + `ChipListNode` (COMP-13 + 13a) — dismissible pill cluster
- Parity FeatureProbe extension (v5.1 pattern; append to existing v8.0 primary-composites section)
- AA-contrast hand-check per new fg/bg pair (Chip tinted-pills × 4 tones × 13 themes; status-dot palette; DetailRow label; TimelineEntry dot borders)
- Vitest per composite + .NET serialization tests
- Showcase demo Secondary Composites section (extends the Primary Composites section from Phase 24 plan 24-06)
- `.planning/design/composite-nodes-layer.md` recipe-inventory table grows with these 5 (Phase 24 filled in the 4 primaries; this phase completes the shipped set of 9 recipes + 1 primitive)
- AGENTS.md "Route B composite-nodes layer" section grows: add the 5 secondaries to the shipped inventory
- CHANGELOG.md "Unreleased — v8.0.0 (in progress)" accumulates 5 more Added entries

**Out of scope (deferred to Phase 26):**
- v8.0.0 release ship (Phase 26)
- Comprehensive tailnet verification page across all 10 composites (Phase 26)
- Aligned npm + NuGet v8.0.0 release + tag + CHANGELOG finalization + `#vms-changelog` announcement (Phase 26)
</domain>

<decisions>
## Locked Decisions

Schemas locked at tasting approval 2026-07-29. Slot names + variance axes + typography tier assignments are LOCKED. Do NOT re-litigate the shape.

### 1. `UserRowNode` — LOCKED (COMP-09)

**Wire shape:**
```typescript
export interface UserRowNode {
  type: "user-row";
  avatar?: ViewNode;                              // typically AvatarNode (COMP-04); slot accepts any ViewNode
  name: string | ViewNode;                        // trained: TextNode body + weight:"medium"
  meta?: string | ViewNode;                       // trained: TextNode muted (e.g. "email · role")
  status?: { label: string; kind: StatusKind };   // small dot + label right-aligned
  trailing?: ViewNode;                            // optional trailing slot (actions or extra badge)
  action?: ActionEvent;                           // whole-row click (member-picker pattern)
}

type StatusKind = "online" | "away" | "offline" | "busy";
```

**Renderer rules:**
- `avatar` slot: leading column (grid col 1); typical AvatarNode but any ViewNode acceptable.
- `name` string → wrap in `TextNode { style: "body", weight: "medium" }`.
- `meta` string → wrap in `TextNode { style: "muted" }`.
- `status`: renders `<span class="vms-user-row__status"><span class="vms-status-dot vms-status-dot--{kind}"></span>{label}</span>`. Dot colors: `online`→success, `away`→warning, `offline`→muted, `busy`→danger.
- `action` present → whole-row `role="button" tabindex=0`; same stopPropagation pattern as ListRowNode (Phase 24 COMP-05).
- Rendered inside a `.vms-user-row-list` container (implicit — same single-bordered-surface pattern as ListNode.variant:"rows"). Do NOT introduce a new `variant` field on ListNode for this; UserRowNode is a standalone row that renders in a `.vms-user-row-list` when nested in a list container OR as a standalone `<div>` otherwise.

**DOM structure** (matches the tasting mockup):
```
<li class="vms-user-row">
  <div class="vms-user-row__avatar">{avatar}</div>
  <div class="vms-user-row__content">
    <div class="vms-user-row__name">{name}</div>
    <div class="vms-user-row__meta">{meta}</div>
  </div>
  <div class="vms-user-row__status">{status dot + label}</div>
</li>
```
Grid: `[avatar | content | status]`.

### 2. `DetailRowNode` + `DetailListNode` — LOCKED (COMP-10 + 10a)

**Wire shape:**
```typescript
export interface DetailRowNode {
  type: "detail-row";
  label: string;                                       // trained: TextNode text-xs uppercase weight:500 muted
  value: string | ViewNode;                            // trained: TextNode body
  tone?: "danger" | "warning" | "success" | "info";    // optional accent (e.g. red for "Deleted")
  icon?: IconName;                                     // optional leading icon on the label
}

export interface DetailListNode {
  type: "detail-list";
  children: DetailRowNode[];                            // tree-validator rejects non-DetailRow
  labelWidth?: "sm" | "md" | "lg";                      // closed enum — 8rem / 10rem / 12rem
}
```

**Renderer rules:**
- DetailListNode → `<dl class="vms-detail-list vms-detail-list--{labelWidth}">`. Fixed label column via CSS grid on the row: `grid-template-columns: var(--vms-detail-label, 10rem) 1fr`.
- `labelWidth` sets `--vms-detail-label` on the container: `sm=8rem`, `md=10rem` (default), `lg=12rem`. Omitted = default (no modifier class, byte-identical).
- Each DetailRowNode → `<div class="vms-detail-row"><dt class="vms-detail-row__label">{label}</dt><dd class="vms-detail-row__value">{value}</dd></div>`.
- Trained typography: label = `.vms-detail-row__label { font-size: text-xs; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 500; color: text-muted; }`. Value = TextNode body.
- Single bordered surface with per-row dividers (matches tasting mockup).

**Tree-validator**: DetailListNode.children must all be DetailRowNodes; mixed tree → `invalid_tree`.

### 3. `TimelineEntryNode` + `TimelineNode` — LOCKED (COMP-11 + 11a)

**Wire shape:**
```typescript
export interface TimelineEntryNode {
  type: "timeline-entry";
  time: string;                                        // trained: caption tier (COMP-01)
  description: string | ViewNode;                      // trained: TextNode body (rich content OK)
  tone?: "danger" | "warning" | "success" | "info";    // dot border color (default = accent)
  icon?: IconName;                                     // overrides dot with an icon
}

export interface TimelineNode {
  type: "timeline";
  children: TimelineEntryNode[];                        // tree-validator rejects non-TimelineEntry
}
```

**Renderer rules:**
- TimelineNode → `<ol class="vms-timeline">`. Container gets a decorative left rail via `::before`:
  ```css
  .vms-timeline { position: relative; padding: 0 0 0 1.5rem; margin: 0; list-style: none; }
  .vms-timeline::before {
    content: ""; position: absolute; left: .375rem; top: .375rem; bottom: .375rem;
    width: 2px; background: var(--vms-border); border-radius: 1px;
  }
  ```
- Each TimelineEntryNode → `<li class="vms-timeline-entry [vms-timeline-entry--{tone}]">`. Container gets a dot via `::before`:
  ```css
  .vms-timeline-entry { position: relative; padding-bottom: var(--vms-space-md); }
  .vms-timeline-entry::before {
    content: ""; position: absolute; left: -1.5rem; top: .375rem;
    width: .875rem; height: .875rem; border-radius: 999px;
    background: var(--vms-surface); border: 2px solid var(--vms-accent);
    transform: translateX(3px);
  }
  .vms-timeline-entry--danger::before  { border-color: var(--vms-error); }
  .vms-timeline-entry--warning::before { border-color: var(--vms-warning); }
  .vms-timeline-entry--success::before { border-color: var(--vms-success); }
  .vms-timeline-entry--info::before    { border-color: var(--vms-info); }
  ```
- `time` (string only, not ViewNode-typed) → wrap in `TextNode { style: "caption" }` at render.
- `description` string → wrap in `TextNode { style: "body" }`; ViewNode → render as-is.
- `icon` (optional) — if present, renders inside the dot (larger dot slot; framework handles the sizing).

**CRITICAL**: this composite REQUIRES the `::before`/`::after` decorative rail + dot mechanism — apps CANNOT compose this from primitives ("apps describe, never decorate" precludes app-CSS for a rail; the composite exists specifically to bake it in).

### 4. `SettingRowNode` + `SettingListNode` — LOCKED (COMP-12 + 12a)

**Wire shape:**
```typescript
export interface SettingRowNode {
  type: "setting-row";
  icon?: IconName;                                    // optional leading icon
  label: string | ViewNode;                           // trained: TextNode body + weight:"medium"
  description?: string | ViewNode;                    // trained: TextNode muted with max-width
  trailing?: ViewNode;                                // typically CheckboxNode(variant:"switch") from COMP-03
  action?: ActionEvent;                               // whole-row click (opt-in)
}

export interface SettingListNode {
  type: "setting-list";
  children: SettingRowNode[];                          // tree-validator rejects non-SettingRow
  heading?: string;                                    // optional heading for the settings group
}
```

**Renderer rules:**
- SettingListNode → `<ul class="vms-setting-list">` with optional heading as `<h3 class="vms-setting-list__heading">` above. Single bordered surface with per-row dividers (same pattern as ListNode.variant:"rows").
- Each SettingRowNode → `<li class="vms-setting-row">`:
  ```
  <li class="vms-setting-row">
    <div class="vms-setting-row__body">
      <div class="vms-setting-row__label">{label}</div>
      <p class="vms-setting-row__description">{description}</p>
    </div>
    <div class="vms-setting-row__control">{trailing}</div>
  </li>
  ```
- Grid: `[body | control]` = `1fr auto`. `align-items: center` — the control vertically centers against the label+description stack.
- `label` string → TextNode body + weight:"medium"; ViewNode → render as-is.
- `description` string → TextNode muted with `.vms-setting-row__description { max-width: 42rem; }` for readable line length.
- Natural pairing with `CheckboxNode(variant:"switch")` from COMP-03 as the `trailing` slot — Showcase demo should exercise this combo.

**Tree-validator**: SettingListNode.children must all be SettingRowNodes.

### 5. `ChipNode` + `ChipListNode` — LOCKED (COMP-13 + 13a)

**Wire shape:**
```typescript
export interface ChipNode {
  type: "chip";
  label: string;
  tone?: "danger" | "warning" | "success" | "info";  // color palette (neutral if omitted)
  icon?: IconName;                                    // leading icon
  dismissAction?: ActionEvent;                        // showing the X requires this — no dismiss, no X (respects "no dead UI")
  action?: ActionEvent;                               // whole-chip click (filter-chip toggle pattern)
}

export interface ChipListNode {
  type: "chip-list";
  children: ChipNode[];                                // tree-validator rejects non-Chip
}
```

**Renderer rules:**
- ChipListNode → `<div class="vms-chip-list" role="list">` — flex-wrap horizontal cluster with tuned inline gap:
  ```css
  .vms-chip-list { display: flex; flex-wrap: wrap; gap: var(--vms-space-xs); padding: 0; margin: 0; list-style: none; }
  ```
- Each ChipNode → `<span class="vms-chip [vms-chip--{tone}]" role="listitem">`:
  ```
  <span class="vms-chip vms-chip--{tone}" role="listitem">
    {icon?}
    {label}
    {dismissAction ? <button class="vms-chip__dismiss" aria-label="Remove {label}">×</button> : null}
  </span>
  ```
- `action` present → whole-chip `role="button" tabindex=0`.
- `dismissAction` present → renders dismiss-X button; click dispatches the caller-supplied action (unlike AlertNode.dismissible which emits a fixed `dismiss` name — Chip takes an explicit ActionEvent because chips typically dispatch identity-carrying actions like `remove-filter-42` or `unselect-tag-foo`).
- If BOTH `action` and `dismissAction` are set: the chip is whole-chip-clickable AND the X does its own thing (stopPropagation on the X click).

**Distinct from BadgeNode**:
- Badge is an *annotation* on another element (small "New" tag next to a title, "3" count on an icon). Not dismissable. No group semantics.
- Chip is a *standalone interactive element* participating in a group (filter set, tag input, selected items). Dismissable. Groupable via ChipListNode.

**Tree-validator**: ChipListNode.children must all be ChipNodes.

### 6. Tree-validator descent (LOCKED, both backends)

Every composite has ViewNode-typed slots. Both tree-validators (TS + .NET) MUST descend into these slots per Phase 24's pattern:
- UserRowNode: descend into `avatar`, `name` (if ViewNode), `meta` (if ViewNode), `trailing`, `action` (action-name collection).
- DetailRowNode: descend into `value` (if ViewNode).
- DetailListNode: descend into each child (must be DetailRow).
- TimelineEntryNode: descend into `description` (if ViewNode).
- TimelineNode: descend into each child (must be TimelineEntry).
- SettingRowNode: descend into `label` (if ViewNode), `description` (if ViewNode), `trailing`, `action`.
- SettingListNode: descend into each child (must be SettingRow).
- ChipNode: descend into `dismissAction`, `action` (action-name collection).
- ChipListNode: descend into each child (must be Chip).

Action-name uniqueness invariant (banked from Nelly's TODO discovery) still applies — composites don't relax it.

### 7. Parity extension pattern (LOCKED, PATTERNS.md analog)

Per the v5.1 pattern shipped in Phase 23 + extended in Phase 24 — EXTEND FeatureProbe `buildVm` in all 3 backends (bun, node, dotnet). Append the v8.0.0 secondary-composites clause to `parity/fixtures/feature-probe.json` `$comment`. Minimum ONE `expectBodyContains` tripwire per composite branch that only its branch emits.

Suggested tripwires (planner adjusts):
- `"type":"user-row"` (COMP-09)
- `"kind":"online"` (COMP-09 status kind variant — pick a distinct one; may need to be a more specific tripwire if `online` appears elsewhere)
- `"type":"detail-row"` (COMP-10)
- `"type":"detail-list"` (COMP-10a)
- `"labelWidth":"lg"` (COMP-10a labelWidth variant)
- `"type":"timeline-entry"` (COMP-11)
- `"type":"timeline"` (COMP-11a)
- `"type":"setting-row"` (COMP-12)
- `"type":"setting-list"` (COMP-12a)
- `"type":"chip"` (COMP-13)
- `"type":"chip-list"` (COMP-13a)
- `"dismissAction":{` (COMP-13 dismissable variant — proves the dismissAction slot emits when present)

Total ~12 tripwires. Mutation-testable per Phase 24 discipline.

### 8. AA-contrast hand-check (LOCKED)

Every new fg/bg pair per composite:
- **UserRowNode status-dots** × 4 kinds × 13 themes = 52 pairs. Kind→color mapping (`success`/`warning`/`text-muted`/`error`) already lands in Phase 23's covered pairs — should pass by construction. Verify.
- **DetailRowNode label** — uppercase text-xs muted vs surface. Already covered by caption-tier from Phase 23; verify no regression.
- **TimelineEntry dot-border tones** — decorative dots against surface. 4 tones × 13 themes = 52 pairs. Colors are the shipped `--vms-error/warning/success/info` on `--vms-surface`; already-passing framework pairs.
- **SettingRowNode** — reuses Phase 23 checkbox-switch AA hand-check for the trailing control; label/description reuse Phase 24 primary composite text pairs.
- **ChipNode tinted-pill** × 4 tones × 13 themes = 52 pairs. Chip is a small tinted-surface with colored text — similar shape to AlertNode's title-on-tinted-surface (Phase 24 covered). Text needs to clear AA-normal 4.5:1 against the ~10-15% tinted-tone background.

Every pair × theme × ratio documented in per-test-file AA hand-check header (banked pattern).

### 9. Fleet-adoption discipline (LOCKED)

Phase 25 lands the 5 composites AND their Showcase adoption together. Add a new "Secondary Composites" section to `demo/Showcase/frontend/src/main.ts` immediately after the "Primary Composites" section added by Phase 24 plan 24-06. Every composite demonstrated in situ.

For SettingRowNode specifically: the Showcase demo should exercise the natural pairing with `CheckboxNode(variant:"switch")` from COMP-03 — 3-4 setting rows with switch trailing controls, at least one with a Button trailing instead.

### 10. Batch-then-ship (LOCKED per milestone)

Phase 25 does NOT release. `package.json` stays 7.1.0; `.csproj` stays 7.0.0. CHANGELOG accumulates 5 more entries under the "Unreleased — v8.0.0 (in progress)" heading. MIGRATION.md gets 5 more additive notes (no breaking changes in Phase 25).

### 11. Design doc + AGENTS.md updates

- `.planning/design/composite-nodes-layer.md` — Phase 24 filled in the 4 primaries; Phase 25 completes the shipped set with the 5 secondaries (9 composites + 1 primitive = full v8.0.0 inventory).
- `AGENTS.md` "Route B composite-nodes layer" section — Phase 24 grew the shipped-recipes inventory to 4; Phase 25 grows it to 9.

Both files touched in a dedicated plan.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design of record (MANDATORY)
- `/home/thenasty/ViewModelShell/.planning/design/composite-nodes-layer.md` — grown by 23-05 + 24-05; this phase grows further with the 5 secondaries.
- `/home/thenasty/.claude/identities/vicky/bounties/composite-nodes-layer/tasting-page/index.html` — sections 5 (UserRow), 6 (DetailRow), 7 (Timeline), 9 (SettingRow), 10 (Chip+ChipList) are visual targets.

### Phase 24 landed templates (the freshest byte-aligned patterns)
- `.planning/phases/24-*/24-01-PLAN.md` — ListRowNode + ListNode.variant end-to-end (framework code plan template)
- `.planning/phases/24-*/24-02-PLAN.md` — MessageNode + MessageListNode (composite-pair plan template — matches Detail/Timeline/Setting/Chip pair shape)
- `.planning/phases/24-*/24-03-PLAN.md` — AlertNode (single-composite plan template)
- `.planning/phases/24-*/24-06-PLAN.md` — Showcase adoption plan
- `.planning/phases/24-*/24-07-PLAN.md` — parity extension plan
- `.planning/phases/24-*/24-08-PLAN.md` — CHANGELOG + MIGRATION plan
- `.planning/phases/24-*/24-09-PLAN.md` — final gate + sign-off plan

### Phase 23 shipped foundations we consume
- `TextNode.style: "caption"` — for TimelineEntry.time, DetailRow.label (via uppercase muted style), UserRow.meta
- `TextNode.weight` — for row primaries (UserRow.name, SettingRow.label), DetailRow.label (weight:500)
- `AvatarNode` — for UserRowNode.avatar slot
- `CheckboxNode.variant: "switch"` — for SettingRowNode.trailing slot (natural pairing)

### Phase 24 shipped patterns we mirror
- `ListNode.variant: "rows"` — single bordered surface + dividers pattern; UserRowNode/DetailListNode/SettingListNode/TimelineNode all use variations of it
- `ListRowNode.action` — whole-row click semantics with stopPropagation; UserRowNode.action + SettingRowNode.action reuse
- `MessageListNode` tree-validator rejects non-MessageNode children — Detail/Timeline/Setting/Chip lists mirror this pattern
- `AlertNode.dismissible` → fixed `dismiss` action name — CONTRAST with ChipNode.dismissAction which takes a caller-supplied ActionEvent (Chip needs identity-carrying dispatch like `remove-filter-42`, hence explicit ActionEvent slot)

### Framework conventions (this repo)
- `/home/thenasty/ViewModelShell/AGENTS.md` — every gotcha applies. Especially #8 (WhenWritingNull + WhenWritingDefault), closed-union-must-be-enum on .NET, fleet-adoption discipline, parity `expectBodyContains` invariant.

### Parity + Showcase references
- `parity/backends.json` — 3 FeatureProbe backends: bun, node (shares handler.ts with bun), dotnet.
- `demo/Showcase/frontend/src/main.ts` — "Primary Composites" section landed by 24-06 is the anchor for the "Secondary Composites" section this phase adds.
- `viewmodel-shell/styles/themes/` — 12 theme files; AA hand-check spans default + these 12.
</canonical_refs>

<specifics>
## Specific Ideas

### Suggested plan decomposition

Given 5 composite pairs (mostly pairs of node + container) × ~4 layers, a natural decomposition follows Phase 24's shape (9-10 plans):

- **25-01**: UserRowNode end-to-end (COMP-09). Wave 1.
- **25-02**: DetailRowNode + DetailListNode end-to-end (COMP-10 + 10a). Wave 2.
- **25-03**: TimelineEntryNode + TimelineNode end-to-end (COMP-11 + 11a). Wave 3.
- **25-04**: SettingRowNode + SettingListNode end-to-end (COMP-12 + 12a). Wave 4.
- **25-05**: ChipNode + ChipListNode end-to-end (COMP-13 + 13a). Wave 5.
- **25-06**: design doc recipe-inventory + AGENTS.md governance section growth (both grow with the 5 secondaries). Wave 1 file-disjoint.
- **25-07**: Showcase Secondary Composites section (fleet-adoption). Wave 6.
- **25-08**: FeatureProbe parity extension + ~12 tripwires. Wave 6.
- **25-09**: CHANGELOG + MIGRATION accumulate 5 Added entries. Wave 6.
- **25-10**: Full green-tree gate + AA hand-check re-verify + Showcase visual sign-off (Ashley checkpoint). Wave 7.

Waves (Phase 24 pattern):
- W1: 25-01 + 25-06 (framework code + design doc — file-disjoint)
- W2: 25-02
- W3: 25-03
- W4: 25-04
- W5: 25-05
- W6: 25-07 + 25-08 + 25-09 (file-disjoint)
- W7: 25-10 (checkpoint)

Planner adjusts; the constraint is every COMP-XX ID lands cleanly across all layers.

### Testing depth per composite

Same as Phase 24 — mutation-testable rendering + wire round-trip + tree-validator descent + AA hand-check per new fg/bg pair. Every test file's header documents the AA per-theme × per-pair matrix.

### jsdom + dotnet PATH caveats

Same as Phase 23 + 24. jsdom class-emission assertions preferred over computed-style-from-external-CSS. `export PATH="$HOME/.dotnet:$PATH"` before parity + .NET tests.
</specifics>

<deferred>
## Deferred Ideas

- v8.0.0 release ship — Phase 26.
- Comprehensive tailnet verification page across all 10 composites — Phase 26.
- Any additional composite that surfaces during this phase (e.g. if a consumer asks for FormRowNode, PageHeaderNode, MediaCardNode) — defer to a future minor release; Phase 25's scope is FIXED at the 5 secondaries.
- Multiple avatar shapes on UserRowNode — deferred; only circular AvatarNode available (per Phase 23 CONTEXT §Deferred).
</deferred>

---

*Phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip*
*Context gathered: 2026-07-29 direct from Phase 24 landing + approved tasting.*
