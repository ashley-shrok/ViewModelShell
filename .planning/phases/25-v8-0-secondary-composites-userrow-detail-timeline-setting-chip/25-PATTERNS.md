# Phase 25: v8.0 Secondary Composites — Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 5 composite pairs (COMP-09 UserRow, COMP-10+10a Detail, COMP-11+11a Timeline, COMP-12+12a Setting, COMP-13+13a Chip) × ~7 target layers each
**Analogs found:** 100% — every mechanism is either (a) Phase 24 primaries shipped 6 days ago, or (b) a small extension of an existing pattern. **Two exceptions call out below.**

> **Headline for the planner.**
>
> 1. **Every plan mirrors a Phase 24 plan byte-for-byte.** 25-01 (UserRow) ≈ 24-01 (ListRow); 25-02/03/04 (Detail/Timeline/Setting pairs) ≈ 24-02 (MessageNode+MessageListNode pair); 25-05 (ChipNode+ChipListNode) ≈ 24-02 with an ActionEvent-slot twist. The plan-shape, threat_model, must_haves, and mutation-test discipline are already established — do not re-derive.
>
> 2. **🚨 Two genuinely new CSS mechanisms in this phase.** Timeline rail-and-dots via `::before` on container + entries, and status-dot palette on UserRow. Both are BAKED-IN-BROWSER-CSS by construction ("apps describe, never decorate" precludes app-CSS for a rail; the composite exists specifically to bake it in). Every other CSS block is a stack-plus-borders variation on the Phase 24 `.vms-list--rows` / `.vms-message-list` container pattern.
>
> 3. **🚨 ChipNode.dismissAction is an ActionEvent SLOT — do NOT mirror AlertNode.dismissible.** AlertNode's `dismissible: true` emits a fixed `{name: "dismiss"}` locally in the renderer. Chip needs identity-carrying dispatch (`remove-filter-42`, `unselect-tag-foo`), so `dismissAction?: ActionEvent` is a caller-supplied slot — mirrors ModalNode.dismissAction, NOT AlertNode.dismissible. The walker MUST `recordAction` on the dismissAction (participates in name uniqueness); AlertNode's arm did NOT record anything for its dismiss because the ActionEvent isn't on the wire. Different postures, different tests.
>
> 4. **UserRowNode.status is a NEW small object shape (not a ViewNode slot).** `status?: { label: string; kind: "online"|"away"|"offline"|"busy" }` — closed enum for kind, no walker descent needed (leaf sub-record). Same posture as `ImageNode.captionRuns[]` (small typed sub-record on the wire) — analog at `index.ts` ImageNode caption + the .NET `LookupItem` shape.
>
> 5. **`.NET string | ViewNode` policy carries forward unchanged from Phase 24.** Every ViewNode-typed slot (UserRow.name, DetailRow.value, TimelineEntry.description, SettingRow.label/description) is `ViewNode?` on the .NET side (NOT `object?` + custom converter). TS `string | ViewNode` convenience is TS-only; .NET server wraps a string explicitly as `new TextNode(...)`. Byte-alignment simplicity beats ergonomic parity. **Same posture as Phase 24 §5 Analog C — locked, do not re-litigate.**
>
> 6. **DetailRowNode uses a NEW DOM shape (`<dl>/<dt>/<dd>`)** but the mechanism is already established: the framework already emits semantic HTML (`<h1>` for PageNode.title level=1, `<blockquote>` for BlockquoteNode, `<ol>` for ordered lists). Picking `<dl>` for a key-value list is the correct semantic choice; the machinery is `document.createElement("dl")` — same as every other semantic-element emission.
>
> 7. **SettingRowNode + CheckboxNode(variant:"switch") is the target combo** — Showcase adoption should exercise this pairing explicitly (per CONTEXT §9). SettingRowNode's `trailing?: ViewNode` slot accepts any ViewNode; the natural pairing with COMP-03's checkbox switch is the reason SettingRow exists.

## File Classification

| File to create/modify | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `viewmodel-shell/src/index.ts` (5 pairs of new ViewNode types + union entries) | model/wire-type | request-response | Phase 24 `ListRowNode` (index.ts:1580-1649), `MessageNode` (:1652-1704), `MessageListNode` (:1706-1734), `AlertNode` (:1738-1798) | exact |
| `viewmodel-shell/src/browser.ts` (10 new renderer methods + 10 case arms) | component/renderer | request-response | Phase 24 `listRow()` (browser.ts:1145-1253), `message()` (:1262-1320), `messageList()` (:1336-1353), `alert()` (:1382-...), `emptyState()` (:4298-4329) | exact |
| `viewmodel-shell/src/server.ts` (10 walker arms + 10 walkForSectionAction arms) | model/validator | request-response | Phase 24 `case "list-row"` (server.ts:189-209), `case "message"` (:210-222), `case "message-list"` (:223-244), `case "alert"` (:245-261) | exact |
| `viewmodel-shell/styles/default.css` (`.vms-user-row*`, `.vms-status-dot*`, `.vms-detail-*`, `.vms-timeline*`, `.vms-setting-*`, `.vms-chip*`) | config/styling | — | Tasting-page CSS at `tasting-page/index.html:349-620` verbatim (prefix-stripped) + Phase 24 `.vms-list--rows` (default.css:1170-1207) | exact |
| `viewmodel-shell-dotnet/ViewModels.cs` (10 records + 3 new enums + 10 `[JsonDerivedType]` + 20 walker arms) | model/wire-type | request-response | Phase 24 `ListRowNode` (ViewModels.cs:2123-2152), `MessageNode` (:2181-2207), `MessageListNode` (:2230-2245), `AlertNode` (:2277-2307), + discriminators at :801-804 | exact |
| `demo/FeatureProbe-bun/handler.ts` (extend buildVm — `secondaryCompositesSection`) | test/fixture | request-response | Phase 24 `primaryCompositesSection` at `handler.ts:1109-1244` (direct-neighbor template) | exact |
| `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (.NET twin extension) | test/fixture | request-response | Phase 24 Primary Composites SectionNode at `FeatureProbeController.cs:1207-1310` | exact |
| `parity/fixtures/feature-probe.json` (`$comment` clause append + ~12 tripwires) | test/fixture | — | Phase 24 clause at tail of `$comment` (line 5) + tripwires at lines 84-96 | exact |
| `parity/run.ts` | test | — | No changes (tripwires live in the fixture, not the runner) | n/a |
| `viewmodel-shell/test/user-row.test.ts` | test | — | `test/alert.test.ts` (Phase 24 template) + `test/avatar-render.test.ts` (Phase 23 AA hand-check header) | exact |
| `viewmodel-shell/test/detail-row.test.ts` | test | — | `test/alert.test.ts` structure + `test/message.test.ts` for the container-with-typed-children shape | exact |
| `viewmodel-shell/test/timeline.test.ts` | test | — | `test/alert.test.ts` (tone × mode matrix + AA header) — plus a jsdom class-emission test for the `::before` rail/dot (skip computed-style; assert class presence only per Phase 24 jsdom-caveat) | exact-with-caveat |
| `viewmodel-shell/test/setting-row.test.ts` | test | — | `test/alert.test.ts` structure + one test asserting the CheckboxNode(variant:"switch") pairing renders inside the trailing slot | exact |
| `viewmodel-shell/test/chip.test.ts` | test | — | `test/alert.test.ts` + `test/checkbox-switch.test.ts` — dismissAction click emits caller-supplied name (NOT fixed "dismiss"); + stopPropagation test when BOTH action and dismissAction are set | exact-with-twist |
| `viewmodel-shell-dotnet/Tests/UserRowNodeSerializationTests.cs`, `DetailRowNodeSerializationTests.cs`, `DetailListNodeSerializationTests.cs`, `TimelineEntryNodeSerializationTests.cs`, `TimelineNodeSerializationTests.cs`, `SettingRowNodeSerializationTests.cs`, `SettingListNodeSerializationTests.cs`, `ChipNodeSerializationTests.cs`, `ChipListNodeSerializationTests.cs` | test | — | `Tests/AlertNodeSerializationTests.cs` (byte-aligned WhenWritingNull + KebabEnum + discriminator template) + `Tests/MessageListNodeSerializationTests.cs` (container-with-typed-children template) | exact |
| `demo/Showcase/frontend/src/main.ts` (Secondary Composites section) | demo | request-response | Phase 24 Primary Composites section at `main.ts:322-439` (direct-neighbor template) | exact |
| `.planning/design/composite-nodes-layer.md` (recipe-inventory table grows 5 rows) | doc | — | Existing "Shipped recipe inventory" table (already populated by Phase 24 with 4 rows at line 80) | exact |
| `AGENTS.md` (Route B "Currently shipped recipes" grows to 9) | doc | — | Phase 24 fill at `AGENTS.md:744-752` | exact |
| `CHANGELOG.md`, `MIGRATION.md` (Unreleased entries — 5 additive, 0 breaking) | doc | — | Phase 24 additions at `CHANGELOG.md:9-25`; `MIGRATION.md:24-65` | exact |

---

## 1. `viewmodel-shell/src/index.ts` — 5 new type pairs + union entries

**Analog:** Phase 24's four composite types at `index.ts:1580-1798` are the byte-aligned template. Same TSDoc-heavy comment style, same discriminator convention, same `string | ViewNode` ergonomic-slot pattern, same closed-tone-union axis.

### Existing ListRowNode (index.ts:1617-1649) — the direct template for UserRowNode and SettingRowNode:

```typescript
export interface ListRowNode {
  type: "list-row";
  /** Leading affordance — icon / badge / avatar / checkbox. Any ViewNode. */
  leading?: ViewNode;
  /** The semantically-primary content. REQUIRED. String is auto-wrapped in
   *  `TextNode { style: "body", weight: "medium" }` at render time (consumes
   *  Phase 23 COMP-01 + COMP-02); a ViewNode is rendered as-is. */
  primary: string | ViewNode;
  /** Second-line typographically-subordinate. String → `TextNode { style: "muted" }`;
   *  ViewNode as-is. Omitted = no second line. */
  secondary?: string | ViewNode;
  /** Meta-line array — each entry is text-xs muted (caption tier).
   *  String entries auto-wrap in `TextNode { style: "caption" }`. */
  meta?: (string | ViewNode)[];
  /** Right-aligned slot — timestamp, count, per-row actions, badge. */
  trailing?: ViewNode;
  /** Semantic tone axis — left-accent border via `.vms-list-row--{tone}`. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Row lifecycle STATE (NOT severity — that's `tone`). Freeform,
   *  app-extensible token; the framework ships styling for `active`,
   *  `done`, `disabled`, `high`. Orthogonal to `tone`. */
  state?: string;
  /** Whole-row click. Same shape as TableRow.action / SectionNode.action —
   *  `role="button"`, `tabIndex=0`, Enter/Space dispatch, aria-label from
   *  flattened primary+meta text. Interactive descendants `stopPropagation`. */
  action?: ActionEvent;
}
```

### Existing MessageListNode (index.ts:1720-1734) — the direct container template for DetailListNode / TimelineNode / SettingListNode / ChipListNode:

```typescript
export interface MessageListNode {
  type: "message-list";
  /** MessageNode-only children. The tree-validator rejects mixed / non-Message
   *  children with `invalid_tree` and a byte-identical error message across TS
   *  + .NET (see server.ts + ViewModels.cs). */
  children: MessageNode[];
  /** Reuses SectionNode.followTail's mechanism verbatim (browser.ts:227-372). */
  followTail?: boolean;
}
```

### What to add — new interfaces (schemas locked in CONTEXT §1-5):

**COMP-09 UserRowNode:**

```typescript
export interface UserRowNode {
  type: "user-row";
  /** Leading circular slot — typically AvatarNode (COMP-04, Phase 23). Any ViewNode. */
  avatar?: ViewNode;
  /** Person display name. REQUIRED. Trained typography: TextNode body + weight:"medium"
   *  (consumes COMP-02 weight axis). String → wrapped; ViewNode → as-is. */
  name: string | ViewNode;
  /** Second-line meta — trained: TextNode muted (e.g. "email · role").
   *  String → wrapped; ViewNode → as-is. */
  meta?: string | ViewNode;
  /** Right-aligned status indicator — small object (NOT a ViewNode slot).
   *  Renders as `<span class="vms-user-row__status"><span
   *  class="vms-status-dot vms-status-dot--{kind}"></span>{label}</span>`.
   *  Colors: online→success, away→warning, offline→muted, busy→danger. */
  status?: { label: string; kind: "online" | "away" | "offline" | "busy" };
  /** Optional trailing slot — actions or extra badge. Any ViewNode. */
  trailing?: ViewNode;
  /** Whole-row click (member-picker pattern). Same shape as ListRowNode.action —
   *  role="button", tabIndex=0, Enter/Space dispatch, aria-label from name+meta. */
  action?: ActionEvent;
}
```

**COMP-10 + 10a DetailRowNode + DetailListNode:**

```typescript
export interface DetailRowNode {
  type: "detail-row";
  /** Trained typography: text-xs uppercase weight:500 muted (baked in CSS,
   *  not TextNode-wrapped). REQUIRED. */
  label: string;
  /** Trained: TextNode body. String → wrapped; ViewNode → as-is. REQUIRED. */
  value: string | ViewNode;
  /** Optional accent (e.g. red for "Deleted"). Emits .vms-detail-row--{tone}. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Optional leading icon on the label. Reuses v7.0 IconName. */
  icon?: IconName;
}

export interface DetailListNode {
  type: "detail-list";
  /** DetailRowNode-only children. Tree-validator rejects mixed children. */
  children: DetailRowNode[];
  /** Fixed label column width — closed enum. sm=8rem, md=10rem (default), lg=12rem.
   *  Omitted = no modifier class (byte-identical to md). Emits
   *  `.vms-detail-list--{labelWidth}` which sets `--vms-detail-label`. */
  labelWidth?: "sm" | "md" | "lg";
}
```

**COMP-11 + 11a TimelineEntryNode + TimelineNode:**

```typescript
export interface TimelineEntryNode {
  type: "timeline-entry";
  /** Trained: TextNode caption tier (COMP-01). REQUIRED. String only (not ViewNode). */
  time: string;
  /** Trained: TextNode body. String → wrapped; ViewNode → as-is. REQUIRED. */
  description: string | ViewNode;
  /** Dot border color (default = accent). Emits .vms-timeline-entry--{tone}. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Overrides dot with an icon (larger dot slot). Reuses v7.0 IconName. */
  icon?: IconName;
}

export interface TimelineNode {
  type: "timeline";
  /** TimelineEntryNode-only children. Tree-validator rejects mixed children.
   *  The container `<ol class="vms-timeline">` grows a decorative vertical rail
   *  via CSS ::before; each entry grows a dot via ::before. NO app-CSS —
   *  the composite exists specifically to bake this in (the "apps describe,
   *  never decorate" rule precludes app-authored rail/dot CSS). */
  children: TimelineEntryNode[];
}
```

**COMP-12 + 12a SettingRowNode + SettingListNode:**

```typescript
export interface SettingRowNode {
  type: "setting-row";
  /** Optional leading icon. Reuses v7.0 IconName. */
  icon?: IconName;
  /** Setting label. REQUIRED. Trained: TextNode body + weight:"medium". */
  label: string | ViewNode;
  /** Supporting description. Trained: TextNode muted with max-width:42rem. */
  description?: string | ViewNode;
  /** Trailing control slot — typically CheckboxNode(variant:"switch") from COMP-03.
   *  Also common: ButtonNode, LinkNode. Any ViewNode. */
  trailing?: ViewNode;
  /** Whole-row click (opt-in). Same shape as ListRowNode.action. */
  action?: ActionEvent;
}

export interface SettingListNode {
  type: "setting-list";
  /** SettingRowNode-only children. Tree-validator rejects mixed children. */
  children: SettingRowNode[];
  /** Optional heading for the settings group — renders as
   *  `<h3 class="vms-setting-list__heading">` above the list. */
  heading?: string;
}
```

**COMP-13 + 13a ChipNode + ChipListNode:**

```typescript
export interface ChipNode {
  type: "chip";
  /** Chip pill text. REQUIRED. */
  label: string;
  /** Tinted-pill color palette. Neutral if omitted. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Optional leading icon. Reuses v7.0 IconName. */
  icon?: IconName;
  /** Dismiss X button — CALLER-SUPPLIED ActionEvent (identity-carrying:
   *  `remove-filter-42`, `unselect-tag-foo`). DEVIATES from AlertNode.dismissible
   *  which emits a fixed `{name:"dismiss"}` locally — Chip needs the app to name
   *  the action because chips typically operate on specific identities.
   *  Absent = no X rendered (respects "no dead UI"). */
  dismissAction?: ActionEvent;
  /** Whole-chip click (filter-chip toggle pattern). Same shape as ListRowNode.action. */
  action?: ActionEvent;
}

export interface ChipListNode {
  type: "chip-list";
  /** ChipNode-only children. Tree-validator rejects mixed children. */
  children: ChipNode[];
}
```

### ViewNode union grows by 10 (index.ts:180-214):

**Current union, quoted:**

```typescript
export type ViewNode =
  | PageNode
  | SectionNode
  ...
  | AvatarNode
  | ListRowNode
  | MessageNode
  | MessageListNode
  | AlertNode;
```

**Append 10 new entries** (order — group by pair):

```typescript
  | UserRowNode
  | DetailRowNode
  | DetailListNode
  | TimelineEntryNode
  | TimelineNode
  | SettingRowNode
  | SettingListNode
  | ChipNode
  | ChipListNode;
```

---

## 2. `viewmodel-shell/src/browser.ts` — 10 renderer methods + 10 case arms

**Analog A — leading + content + trailing grid + string-lift trained typography (UserRow, SettingRow):** `listRow()` at `browser.ts:1145-1253` (Phase 24 direct template).

**Analog B — container with typed-only children (DetailList, TimelineNode, SettingList, ChipList):** `messageList()` at `browser.ts:1336-1353` — tiny wrapper that trusts the tree-validator + delegates to `this.kids()`.

**Analog C — tone-driven CSS class emission + optional icon slot:** `alert()` at `browser.ts:1382-...` (tone class + icon override + string-lift for message).

**Analog D — dismiss button with caller-supplied ActionEvent (ChipNode.dismissAction):** `ModalNode.dismissAction` at `browser.ts:3471-3479` (NOT AlertNode.dismissible — Alert emits a fixed name locally; Chip needs the caller's ActionEvent).

**Analog E — string-or-ViewNode content branching:** `listRow()` at `browser.ts:1175-1207` — the `typeof n.primary === "string"` → wrap-in-TextNode branch, else `this.node(n.primary, ...)`.

### 2a. `renderNode` switch arms — append 10 cases (browser.ts:568-571 tail)

**Current tail, quoted (browser.ts:568-571):**

```typescript
      case "list-row":     return this.listRow(n, parent, on);
      case "message":      return this.message(n, parent, on);
      case "message-list": return this.messageList(n, parent, on);
      case "alert":        return this.alert(n, parent, on);
```

**What to append (10 cases, mirror the grouping):**

```typescript
      case "user-row":       return this.userRow(n, parent, on);
      case "detail-row":     return this.detailRow(n, parent, on);
      case "detail-list":    return this.detailList(n, parent, on);
      case "timeline-entry": return this.timelineEntry(n, parent, on);
      case "timeline":       return this.timeline(n, parent, on);
      case "setting-row":    return this.settingRow(n, parent, on);
      case "setting-list":   return this.settingList(n, parent, on);
      case "chip":           return this.chip(n, parent, on);
      case "chip-list":      return this.chipList(n, parent, on);
```

### 2b. `private userRow()` — COMP-09 renderer

**Analog:** `listRow()` at `browser.ts:1145-1253` (whole-row click + aria-label + stopPropagation + string-lift + leading/content/trailing grid). New machinery: the status-dot rendering (small typed sub-record, not a ViewNode slot).

**Direct excerpt from `listRow()` — the pattern userRow() replicates (browser.ts:1160-1210):**

```typescript
    const el: HTMLElement = document.createElement(isInList ? "li" : "div");
    const cls = ["vms-list-row"];
    if (!isInList) cls.push("vms-list-row-standalone");
    if (n.tone) cls.push(`vms-list-row--${n.tone}`);
    if (n.state) cls.push(`vms-list-row--${n.state}`);
    if (n.action) cls.push("vms-list-row--clickable");
    el.className = cls.join(" ");

    // Leading slot — any ViewNode.
    if (n.leading) {
      const lead = document.createElement("div");
      lead.className = "vms-list-row__leading";
      this.node(n.leading, lead, on);
      el.appendChild(lead);
    }

    // Content stack — primary/secondary/meta[]. String slots auto-wrap in
    // trained TextNode per the string-lift rule.
    const content = document.createElement("div");
    content.className = "vms-list-row__content";

    const primaryEl = document.createElement("div");
    primaryEl.className = "vms-list-row__primary";
    if (typeof n.primary === "string") {
      this.node({ type: "text", value: n.primary, style: "body", weight: "medium" }, primaryEl, on);
    } else {
      this.node(n.primary, primaryEl, on);
    }
    content.appendChild(primaryEl);
```

**New machinery for userRow — status-dot rendering** (based on tasting-page HTML at `tasting-page/index.html:942`):

```typescript
    // Status slot — small typed sub-record (NOT a ViewNode slot). Renders a
    // colored dot + label right-aligned. kind → CSS class mapping is closed:
    //   online → --success, away → --warning, offline → --text-muted, busy → --error
    // The CSS ships in default.css (§4b below).
    if (n.status) {
      const statusEl = document.createElement("span");
      statusEl.className = "vms-user-row__status";
      const dot = document.createElement("span");
      dot.className = `vms-status-dot vms-status-dot--${n.status.kind}`;
      statusEl.appendChild(dot);
      statusEl.appendChild(document.createTextNode(n.status.label));
      el.appendChild(statusEl);
    }
```

Container detection (`<li>` vs `<div>`): mirrors `listRow()` at `browser.ts:1149` — parent's `.vms-user-row-list` class triggers `<li>`, else standalone `<div>`.

### 2c. `private detailRow()` + `detailList()` — COMP-10 + 10a renderers

**Analog for container:** `messageList()` at `browser.ts:1336-1353` — 5-line wrapper + kids() delegation.

**Current messageList(), quoted (browser.ts:1336-1353):**

```typescript
  private messageList(n: MessageListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const div = document.createElement("div");
    div.className = "vms-message-list";
    if (n.followTail === true) div.dataset.followTail = "";
    this.kids(n.children as unknown as ViewNode[], div, on);
    parent.appendChild(div);
  }
```

**What to copy — detailList emits `<dl>` instead of `<div>` (semantic HTML for key-value):**

```typescript
  private detailList(n: DetailListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const dl = document.createElement("dl");
    const cls = ["vms-detail-list"];
    if (n.labelWidth) cls.push(`vms-detail-list--${n.labelWidth}`);
    dl.className = cls.join(" ");
    this.kids(n.children as unknown as ViewNode[], dl, on);
    parent.appendChild(dl);
  }
```

**detailRow emits `<div><dt><dd></div>`** — the tasting page shape at `tasting-page/index.html:1011-1036`:

```typescript
  private detailRow(n: DetailRowNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const row = document.createElement("div");
    const cls = ["vms-detail-row"];
    if (n.tone) cls.push(`vms-detail-row--${n.tone}`);
    row.className = cls.join(" ");

    const dt = document.createElement("dt");
    dt.className = "vms-detail-row__label";
    if (n.icon) dt.appendChild(this.renderIconSvg(n.icon, "sm", undefined, undefined));
    dt.appendChild(document.createTextNode(n.label));
    row.appendChild(dt);

    const dd = document.createElement("dd");
    dd.className = "vms-detail-row__value";
    if (typeof n.value === "string") {
      this.node({ type: "text", value: n.value, style: "body" }, dd, on);
    } else {
      this.node(n.value, dd, on);
    }
    row.appendChild(dd);

    parent.appendChild(row);
  }
```

### 2d. `private timeline()` + `timelineEntry()` — COMP-11 + 11a renderers

**🚨 GENUINELY NEW CSS MECHANISM — the rail-and-dot via `::before`.** This is the ONE place in the phase where the framework has to invent new CSS (per CONTEXT §3): apps CANNOT compose this from primitives ("apps describe, never decorate" precludes app-CSS for a rail). The composite exists specifically to bake it in.

**Rendering itself is trivial** — the CSS does all the work. The renderer just emits `<ol>` + `<li>` with the tone class:

```typescript
  private timeline(n: TimelineNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const ol = document.createElement("ol");
    ol.className = "vms-timeline";
    this.kids(n.children as unknown as ViewNode[], ol, on);
    parent.appendChild(ol);
  }

  private timelineEntry(n: TimelineEntryNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const li = document.createElement("li");
    const cls = ["vms-timeline-entry"];
    if (n.tone) cls.push(`vms-timeline-entry--${n.tone}`);
    li.className = cls.join(" ");

    // time — always string, always caption-tier trained typography
    const time = document.createElement("div");
    time.className = "vms-timeline-entry__time";
    this.node({ type: "text", value: n.time, style: "caption" }, time, on);
    li.appendChild(time);

    // description — string → body-tier; ViewNode → as-is (rich content OK)
    const desc = document.createElement("div");
    desc.className = "vms-timeline-entry__description";
    if (typeof n.description === "string") {
      this.node({ type: "text", value: n.description, style: "body" }, desc, on);
    } else {
      this.node(n.description, desc, on);
    }
    li.appendChild(desc);

    // Optional icon override — the ::before dot is replaced. CONTEXT §3 notes
    // this is a "larger dot slot"; render the icon inside a wrapper the CSS
    // targets (planner picks the exact hook — likely a data-attribute or
    // an extra classname like .vms-timeline-entry--has-icon).
    if (n.icon) {
      const iconWrap = document.createElement("span");
      iconWrap.className = "vms-timeline-entry__icon";
      iconWrap.appendChild(this.renderIconSvg(n.icon, "sm", undefined, undefined));
      li.appendChild(iconWrap);
    }

    parent.appendChild(li);
  }
```

**Direct comparison — the `alert()` pattern for tone class emission** (analog for the class-emission part):

```typescript
    wrap.className = `vms-alert vms-alert--${n.tone}`;  // browser.ts:1384
```

### 2e. `private settingRow()` + `settingList()` — COMP-12 + 12a renderers

**Analog:** `listRow()` + `messageList()` combined. Grid: `[body | control]` = `1fr auto`, `align-items: center`. `body` stacks `[label | description]`.

**settingList wrapper** (5 lines, mirrors `messageList()`):

```typescript
  private settingList(n: SettingListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    // Optional heading rendered as sibling <h3> BEFORE the <ul> (not inside).
    // Same posture as EmptyState's "structural elements outside the semantic list"
    // approach — the heading is not a list-item.
    if (n.heading) {
      const h = document.createElement("h3");
      h.className = "vms-setting-list__heading";
      h.textContent = n.heading;
      parent.appendChild(h);
    }
    const ul = document.createElement("ul");
    ul.className = "vms-setting-list";
    this.kids(n.children as unknown as ViewNode[], ul, on);
    parent.appendChild(ul);
  }
```

**settingRow — grid `[body | control]`, body stacks label+description**:

```typescript
  private settingRow(n: SettingRowNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const li = document.createElement("li");
    const cls = ["vms-setting-row"];
    if (n.action) cls.push("vms-setting-row--clickable");
    li.className = cls.join(" ");

    // Body column
    const body = document.createElement("div");
    body.className = "vms-setting-row__body";
    // (Icon lands inside body OR leading — pick the placement per tasting mockup.)
    if (n.icon) body.appendChild(this.renderIconSvg(n.icon, "sm", undefined, undefined));

    const label = document.createElement("div");
    label.className = "vms-setting-row__label";
    if (typeof n.label === "string") {
      this.node({ type: "text", value: n.label, style: "body", weight: "medium" }, label, on);
    } else {
      this.node(n.label, label, on);
    }
    body.appendChild(label);

    if (n.description != null) {
      const desc = document.createElement("p");
      desc.className = "vms-setting-row__description";
      if (typeof n.description === "string") {
        this.node({ type: "text", value: n.description, style: "muted" }, desc, on);
      } else {
        this.node(n.description, desc, on);
      }
      body.appendChild(desc);
    }
    li.appendChild(body);

    // Trailing control — any ViewNode (typically CheckboxNode variant:"switch").
    if (n.trailing) {
      const ctrl = document.createElement("div");
      ctrl.className = "vms-setting-row__control";
      this.node(n.trailing, ctrl, on);
      li.appendChild(ctrl);
    }

    // Whole-row action — SAME pattern as listRow() at browser.ts:1220-1250.
    // stopPropagation on interactive descendants (must include
    // .vms-checkbox__input and .vms-field--switch so the trailing switch
    // doesn't double-fire the row action).
    if (n.action) { /* ... byte-for-byte from listRow() ... */ }

    parent.appendChild(li);
  }
```

### 2f. `private chip()` + `chipList()` — COMP-13 + 13a renderers

**🚨 THE DIVERGENCE FROM ALERTNODE:** ChipNode.dismissAction is an ActionEvent slot (caller-supplied name); AlertNode.dismissible emits a fixed local name. **Analog for the ActionEvent-carrying dismiss is `ModalNode.dismissAction` at browser.ts:3471-3479, NOT `alert()` at browser.ts:1382+.**

**ModalNode dismissAction, quoted (browser.ts:3471-3479):**

```typescript
    if (n.dismissAction) {
      const action = n.dismissAction;
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "vms-modal__close";
      closeBtn.textContent = "✕";
      closeBtn.addEventListener("click", () => on(action));
      header.appendChild(closeBtn);
    }
```

**chipList — flex-wrap cluster** (based on tasting-page CSS at `tasting-page/index.html:520-527`):

```typescript
  private chipList(n: ChipListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const div = document.createElement("div");
    div.className = "vms-chip-list";
    div.setAttribute("role", "list");
    this.kids(n.children as unknown as ViewNode[], div, on);
    parent.appendChild(div);
  }
```

**chip — pill with optional icon + optional dismiss X + optional whole-chip click:**

```typescript
  private chip(n: ChipNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const span = document.createElement("span");
    const cls = ["vms-chip"];
    if (n.tone) cls.push(`vms-chip--${n.tone}`);
    if (n.action) cls.push("vms-chip--clickable");
    span.className = cls.join(" ");
    span.setAttribute("role", "listitem");

    if (n.icon) span.appendChild(this.renderIconSvg(n.icon, "xs", undefined, undefined));
    span.appendChild(document.createTextNode(n.label));

    // Dismiss X — CALLER-SUPPLIED ActionEvent (mirrors ModalNode.dismissAction
    // shape, NOT AlertNode.dismissible's fixed-name shape). Absent = no X
    // rendered (respects "no dead UI"; CONTEXT §5 explicitly notes this).
    if (n.dismissAction) {
      const dismissAction = n.dismissAction;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "vms-chip__dismiss";
      btn.setAttribute("aria-label", `Remove ${n.label}`);
      btn.textContent = "✕";
      btn.addEventListener("click", (e) => {
        // When BOTH n.action and n.dismissAction are set, the X must not
        // double-fire the whole-chip click.
        if (n.action) e.stopPropagation();
        on(dismissAction);
      });
      span.appendChild(btn);
    }

    // Whole-chip click (filter-chip toggle pattern) — same shape as
    // listRow()'s action wiring at browser.ts:1220-1250 (role/tabIndex/keydown).
    if (n.action) {
      const action = n.action;
      span.tabIndex = 0;
      span.setAttribute("role", "button");
      span.addEventListener("click", () => { on(action); });
      span.addEventListener("keydown", (e) => {
        if (e.key === "Enter") on(action);
        else if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); on(action); }
      });
    }

    parent.appendChild(span);
  }
```

---

## 3. `viewmodel-shell/src/server.ts` — 10 walker arms + 10 walkForSectionAction arms

**Analog A — leaf-container pair with tree-invariant + descent:** Phase 24 `case "message-list"` at `server.ts:223-244` (the direct template):

```typescript
    case "message-list": {
      // v8.0.0 (COMP-06a) — MessageListNode.children MUST be MessageNode[].
      // Tree-invariant rejection: any non-MessageNode child throws
      // invalid_tree. Byte-identical error message across TS + .NET.
      const ml = node as MessageListNode;
      for (const child of ml.children) {
        const c = child as unknown as { type: string };
        if (c.type !== "message") {
          throw new Error(
            `MessageListNode.children must all be MessageNodes (found: ${c.type})`
          );
        }
      }
      for (const child of ml.children) collectActions(child, enclosingForm, out);
      return;
    }
```

**Analog B — string-or-ViewNode slot guard:** Phase 24 `case "list-row"` at `server.ts:189-209`:

```typescript
    case "list-row": {
      const lr = node as ListRowNode;
      if (lr.leading) collectActions(lr.leading, enclosingForm, out);
      if (typeof lr.primary !== "string") collectActions(lr.primary, enclosingForm, out);
      if (lr.secondary != null && typeof lr.secondary !== "string") {
        collectActions(lr.secondary, enclosingForm, out);
      }
      for (const m of lr.meta ?? []) {
        if (typeof m !== "string") collectActions(m, enclosingForm, out);
      }
      if (lr.trailing) collectActions(lr.trailing, enclosingForm, out);
      if (lr.action) recordAction(lr.action, enclosingForm, out);
      return;
    }
```

### What to add — 10 walker arms (append after `case "alert"` at server.ts:261):

```typescript
    case "user-row": {
      // COMP-09 — UserRow slots: avatar (ViewNode), name (string | ViewNode),
      // meta (string | ViewNode), trailing (ViewNode), action (whole-row click).
      // status is a small typed sub-record — NO descent (leaf; no ViewNode content).
      const ur = node as UserRowNode;
      if (ur.avatar) collectActions(ur.avatar, enclosingForm, out);
      if (typeof ur.name !== "string") collectActions(ur.name, enclosingForm, out);
      if (ur.meta != null && typeof ur.meta !== "string") {
        collectActions(ur.meta, enclosingForm, out);
      }
      if (ur.trailing) collectActions(ur.trailing, enclosingForm, out);
      if (ur.action) recordAction(ur.action, enclosingForm, out);
      return;
    }
    case "detail-row": {
      // COMP-10 — DetailRow slots: value (string | ViewNode). label + icon are
      // primitives; tone is a string closed-union enum.
      const dr = node as DetailRowNode;
      if (typeof dr.value !== "string") collectActions(dr.value, enclosingForm, out);
      return;
    }
    case "detail-list": {
      // COMP-10a — DetailList.children MUST be DetailRowNode[]. Byte-identical
      // error message across TS + .NET.
      const dl = node as DetailListNode;
      for (const child of dl.children) {
        const c = child as unknown as { type: string };
        if (c.type !== "detail-row") {
          throw new Error(
            `DetailListNode.children must all be DetailRowNodes (found: ${c.type})`
          );
        }
      }
      for (const child of dl.children) collectActions(child, enclosingForm, out);
      return;
    }
    case "timeline-entry": {
      // COMP-11 — TimelineEntry slots: description (string | ViewNode).
      // time is always string; icon + tone are primitives.
      const te = node as TimelineEntryNode;
      if (typeof te.description !== "string") collectActions(te.description, enclosingForm, out);
      return;
    }
    case "timeline": {
      // COMP-11a — Timeline.children MUST be TimelineEntryNode[]. Byte-identical
      // error message across TS + .NET.
      const tl = node as TimelineNode;
      for (const child of tl.children) {
        const c = child as unknown as { type: string };
        if (c.type !== "timeline-entry") {
          throw new Error(
            `TimelineNode.children must all be TimelineEntryNodes (found: ${c.type})`
          );
        }
      }
      for (const child of tl.children) collectActions(child, enclosingForm, out);
      return;
    }
    case "setting-row": {
      // COMP-12 — SettingRow slots: label (string | ViewNode), description
      // (string | ViewNode), trailing (ViewNode), action (whole-row click).
      // icon is a primitive (IconName).
      const sr = node as SettingRowNode;
      if (typeof sr.label !== "string") collectActions(sr.label, enclosingForm, out);
      if (sr.description != null && typeof sr.description !== "string") {
        collectActions(sr.description, enclosingForm, out);
      }
      if (sr.trailing) collectActions(sr.trailing, enclosingForm, out);
      if (sr.action) recordAction(sr.action, enclosingForm, out);
      return;
    }
    case "setting-list": {
      // COMP-12a — SettingList.children MUST be SettingRowNode[]. Byte-identical
      // error message across TS + .NET.
      const sl = node as SettingListNode;
      for (const child of sl.children) {
        const c = child as unknown as { type: string };
        if (c.type !== "setting-row") {
          throw new Error(
            `SettingListNode.children must all be SettingRowNodes (found: ${c.type})`
          );
        }
      }
      for (const child of sl.children) collectActions(child, enclosingForm, out);
      return;
    }
    case "chip": {
      // COMP-13 — Chip slots: dismissAction (ActionEvent, caller-supplied),
      // action (whole-chip click). label + icon + tone are primitives.
      // BOTH dispatch-bearing actions participate in name uniqueness — a chip
      // in a filter set might have `remove-filter-42` AND `toggle-filter-42`
      // as its two independent operations. UNIQUE per chip.
      const ch = node as ChipNode;
      if (ch.dismissAction) recordAction(ch.dismissAction, enclosingForm, out);
      if (ch.action) recordAction(ch.action, enclosingForm, out);
      return;
    }
    case "chip-list": {
      // COMP-13a — ChipList.children MUST be ChipNode[]. Byte-identical error
      // message across TS + .NET.
      const cl = node as ChipListNode;
      for (const child of cl.children) {
        const c = child as unknown as { type: string };
        if (c.type !== "chip") {
          throw new Error(
            `ChipListNode.children must all be ChipNodes (found: ${c.type})`
          );
        }
      }
      for (const child of cl.children) collectActions(child, enclosingForm, out);
      return;
    }
```

### Also — 10 `walkForSectionAction` arms (append after `case "alert"` at server.ts:629):

**Direct passthrough shape** — mirrors Phase 24 arms at server.ts:582-628 (each slot descended for defense-in-depth so a future consumer can't slip an interactive SectionNode inside a composite slot):

```typescript
    case "user-row": {
      const ur = node as UserRowNode;
      if (ur.avatar) walkForSectionAction(ur.avatar, outerInteractive);
      if (typeof ur.name !== "string") walkForSectionAction(ur.name, outerInteractive);
      if (ur.meta != null && typeof ur.meta !== "string") {
        walkForSectionAction(ur.meta, outerInteractive);
      }
      if (ur.trailing) walkForSectionAction(ur.trailing, outerInteractive);
      return;
    }
    case "detail-row": {
      const dr = node as DetailRowNode;
      if (typeof dr.value !== "string") walkForSectionAction(dr.value, outerInteractive);
      return;
    }
    case "detail-list": {
      const dl = node as DetailListNode;
      for (const child of dl.children) walkForSectionAction(child, outerInteractive);
      return;
    }
    case "timeline-entry": {
      const te = node as TimelineEntryNode;
      if (typeof te.description !== "string") walkForSectionAction(te.description, outerInteractive);
      return;
    }
    case "timeline": {
      const tl = node as TimelineNode;
      for (const child of tl.children) walkForSectionAction(child, outerInteractive);
      return;
    }
    case "setting-row": {
      const sr = node as SettingRowNode;
      if (typeof sr.label !== "string") walkForSectionAction(sr.label, outerInteractive);
      if (sr.description != null && typeof sr.description !== "string") {
        walkForSectionAction(sr.description, outerInteractive);
      }
      if (sr.trailing) walkForSectionAction(sr.trailing, outerInteractive);
      return;
    }
    case "setting-list": {
      const sl = node as SettingListNode;
      for (const child of sl.children) walkForSectionAction(child, outerInteractive);
      return;
    }
    // ChipNode + ChipListNode: no ViewNode-typed slots → no arms needed. Fall
    // through the default. (Chips carry only strings, icons, and ActionEvents.)
```

---

## 4. `viewmodel-shell/styles/default.css` — 6 new class blocks

**Analog for MOST blocks:** the tasting page CSS at `~/.claude/identities/vicky/bounties/composite-nodes-layer/tasting-page/index.html:349-620` — verbatim, prefix-stripped (drop `.mockup ` scope). Every rule that touched a `--vms-*` token is already correct.

**Analog for container pattern:** Phase 24 `.vms-list--rows` block at `default.css:1170-1207` — single-bordered-surface + per-row dividers via `+ .vms-list-row` `border-top: 1px solid var(--vms-border)`.

### 4a. UserRowNode + status-dot (COMP-09)

**Verbatim from `tasting-page/index.html:352-398`** (drop `.mockup ` prefix):

```css
.vms-user-row-list {
  list-style: none;
  padding: 0; margin: 0;
  background: var(--vms-surface);
  border: 1px solid var(--vms-border);
  border-radius: var(--vms-radius);
  overflow: hidden;
}
.vms-user-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--vms-space-sm);
  align-items: center;
  padding: var(--vms-space-sm) var(--vms-space-md);
  border-top: 1px solid var(--vms-border);
}
.vms-user-row:first-child { border-top: none; }
.vms-user-row:hover { background: color-mix(in srgb, var(--vms-accent) 4%, transparent); }
.vms-user-row__content { min-width: 0; }
.vms-user-row__name {
  font-size: var(--vms-text-md);
  font-weight: 500;
  color: var(--vms-text);
  line-height: 1.35;
}
.vms-user-row__meta {
  font-size: var(--vms-text-sm);
  color: var(--vms-text-muted);
  line-height: 1.4;
}
.vms-user-row__status {
  font-size: .75rem;
  color: var(--vms-text-muted);
  display: flex;
  align-items: center;
  gap: .375rem;
  white-space: nowrap;
}

/* Status-dot palette — closed 4-value StatusKind enum. Note: `busy` was NOT
   in the tasting mockup (it only covered online/away/offline) — CONTEXT §1
   adds it mapped to danger. */
.vms-status-dot {
  width: .5rem; height: .5rem;
  border-radius: 999px;
  background: var(--vms-text-muted);   /* fallback + offline default */
  flex-shrink: 0;
}
.vms-status-dot--online  { background: var(--vms-success); }
.vms-status-dot--away    { background: var(--vms-warning); }
.vms-status-dot--offline { background: color-mix(in srgb, var(--vms-text-muted) 60%, transparent); }
.vms-status-dot--busy    { background: var(--vms-error); }
```

### 4b. DetailRow + DetailList (COMP-10 + 10a)

**Verbatim from `tasting-page/index.html:404-435`** (drop `.mockup ` prefix + add labelWidth modifier):

```css
.vms-detail-list {
  margin: 0;
  padding: 0;
  background: var(--vms-surface);
  border: 1px solid var(--vms-border);
  border-radius: var(--vms-radius);
  overflow: hidden;
  --vms-detail-label: 10rem;   /* default = "md" */
}
.vms-detail-list--sm { --vms-detail-label:  8rem; }
.vms-detail-list--md { --vms-detail-label: 10rem; }   /* no-op; matches default */
.vms-detail-list--lg { --vms-detail-label: 12rem; }

.vms-detail-row {
  display: grid;
  grid-template-columns: var(--vms-detail-label) 1fr;
  gap: var(--vms-space-md);
  padding: var(--vms-space-sm) var(--vms-space-md);
  border-top: 1px solid var(--vms-border);
  align-items: baseline;
}
.vms-detail-row:first-child { border-top: none; }
.vms-detail-row__label {
  font-size: .75rem;
  font-weight: 500;
  letter-spacing: .04em;
  text-transform: uppercase;
  color: var(--vms-text-muted);
  margin: 0;
}
.vms-detail-row__value {
  font-size: var(--vms-text-md);
  color: var(--vms-text);
  line-height: 1.5;
  margin: 0;
  overflow-wrap: anywhere;
}

/* Optional tone accent — planner picks the exact treatment; suggested:
   left-border-accent per ListRowNode's tone pattern. */
.vms-detail-row--danger  .vms-detail-row__value { color: var(--vms-error); }
.vms-detail-row--warning .vms-detail-row__value { color: var(--vms-warning); }
.vms-detail-row--success .vms-detail-row__value { color: var(--vms-success); }
.vms-detail-row--info    .vms-detail-row__value { color: var(--vms-info); }
```

### 4c. Timeline + TimelineEntry (COMP-11 + 11a) — 🚨 GENUINELY NEW CSS MECHANISM

**Verbatim from `tasting-page/index.html:571-620`** (drop `.mockup ` prefix):

```css
/* THE RAIL — decorative vertical line via ::before. Apps CANNOT compose this
   from primitives; the composite exists SPECIFICALLY to bake this in per
   "apps describe, never decorate". */
.vms-timeline {
  position: relative;
  padding: 0 0 0 1.5rem;
  margin: 0;
  list-style: none;
}
.vms-timeline::before {
  content: "";
  position: absolute;
  left: .375rem;
  top: .375rem;
  bottom: .375rem;
  width: 2px;
  background: var(--vms-border);
  border-radius: 1px;
}

/* THE DOT — one per entry via ::before, positioned negative-left against the rail. */
.vms-timeline-entry {
  position: relative;
  padding-bottom: var(--vms-space-md);
}
.vms-timeline-entry:last-child { padding-bottom: 0; }
.vms-timeline-entry::before {
  content: "";
  position: absolute;
  left: -1.5rem;
  top: .375rem;
  width: .875rem;
  height: .875rem;
  border-radius: 999px;
  background: var(--vms-surface);
  border: 2px solid var(--vms-accent);     /* default = accent */
  transform: translateX(3px);
}
.vms-timeline-entry--success::before { border-color: var(--vms-success); }
.vms-timeline-entry--danger::before  { border-color: var(--vms-error); }
.vms-timeline-entry--warning::before { border-color: var(--vms-warning); }
.vms-timeline-entry--info::before    { border-color: var(--vms-info); }

.vms-timeline-entry__time {
  font-size: .75rem;
  color: var(--vms-text-muted);
  opacity: .85;
  line-height: 1.4;
  margin: 0 0 2px;
}
.vms-timeline-entry__description {
  font-size: var(--vms-text-md);
  color: var(--vms-text);
  line-height: 1.45;
  margin: 0;
}
```

### 4d. SettingRow + SettingList (COMP-12 + 12a)

**Verbatim from `tasting-page/index.html:454-490`** (drop `.mockup ` prefix):

```css
.vms-setting-list {
  list-style: none;
  padding: 0; margin: 0;
  background: var(--vms-surface);
  border: 1px solid var(--vms-border);
  border-radius: var(--vms-radius);
  overflow: hidden;
}
.vms-setting-list__heading {
  font-size: var(--vms-text-md);
  font-weight: 600;
  color: var(--vms-text);
  margin: 0 0 var(--vms-space-sm);
}
.vms-setting-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--vms-space-lg);
  align-items: center;
  padding: var(--vms-space-md);
  border-top: 1px solid var(--vms-border);
}
.vms-setting-row:first-child { border-top: none; }
.vms-setting-row__body { min-width: 0; }
.vms-setting-row__label {
  font-size: var(--vms-text-md);
  font-weight: 500;
  color: var(--vms-text);
  line-height: 1.3;
  margin: 0 0 2px;
}
.vms-setting-row__description {
  font-size: var(--vms-text-sm);
  color: var(--vms-text-muted);
  line-height: 1.5;
  margin: 0;
  max-width: 42rem;    /* readable line-length cap */
}
.vms-setting-row__control {
  display: flex;
  align-items: center;
  gap: var(--vms-space-xs);
}
```

### 4e. Chip + ChipList (COMP-13 + 13a)

**Verbatim from `tasting-page/index.html:520-565`** (drop `.mockup ` prefix):

```css
.vms-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--vms-space-xs);
  padding: 0;
  margin: 0;
  list-style: none;
}
.vms-chip {
  display: inline-flex;
  align-items: center;
  gap: .375rem;
  padding: .25rem .625rem .25rem .75rem;
  font-size: .8125rem;
  font-weight: 500;
  line-height: 1.3;
  background: color-mix(in srgb, var(--vms-accent) 12%, transparent);
  color: var(--vms-text);
  border: 1px solid color-mix(in srgb, var(--vms-accent) 25%, transparent);
  border-radius: 999px;
}
.vms-chip--danger  { background: color-mix(in srgb, var(--vms-error) 10%, transparent);   border-color: color-mix(in srgb, var(--vms-error) 30%, transparent);   color: var(--vms-error); }
.vms-chip--warning { background: color-mix(in srgb, var(--vms-warning) 15%, transparent); border-color: color-mix(in srgb, var(--vms-warning) 35%, transparent); color: color-mix(in srgb, var(--vms-warning) 80%, var(--vms-text)); }
.vms-chip--success { background: color-mix(in srgb, var(--vms-success) 10%, transparent); border-color: color-mix(in srgb, var(--vms-success) 30%, transparent); color: color-mix(in srgb, var(--vms-success) 85%, var(--vms-text)); }
.vms-chip--info    { background: color-mix(in srgb, var(--vms-info) 10%, transparent);    border-color: color-mix(in srgb, var(--vms-info) 30%, transparent);    color: var(--vms-info); }

.vms-chip--clickable { cursor: pointer; }
.vms-chip--clickable:focus-visible { outline: 2px solid var(--vms-accent); outline-offset: 2px; }

.vms-chip__dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem; height: 1rem;
  border-radius: 999px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
  opacity: .55;
  transition: opacity var(--vms-t), background var(--vms-t);
  padding: 0;
  margin-right: -.125rem;
}
.vms-chip__dismiss:hover { opacity: 1; background: color-mix(in srgb, currentColor 15%, transparent); }
.vms-chip__dismiss:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; opacity: 1; }
```

### AA-contrast hand-check checklist (per CONTEXT §8)

- **UserRow status-dots** × 4 kinds × 13 themes = **52 pair-checks**. Kind→color mapping (success/warning/muted/error) is fully covered by Phase 23's shipped tone palette; verify no regression.
- **DetailRow label** — uppercase text-xs muted vs surface. Covered by Phase 23 caption-tier; verify no regression.
- **Timeline dot-border tones** × 4 tones × 13 themes = **52 pair-checks** (decorative dots against surface; already-passing framework pairs).
- **SettingRow** — reuses Phase 23 checkbox-switch AA + Phase 24 primary composite text pairs; verify no regression.
- **Chip tinted-pill** × 4 tones × 13 themes = **52 pair-checks** — the highest risk. AA-normal 4.5:1 for label text on ~10-15% tinted-tone background. Where a pair drops below AA, deepen via `color-mix` toward `var(--vms-text)` (banked pattern from Phase 24 AlertNode + v3.5.0 palette work).

Document per-composite in each test file's AA hand-check header (mirror Phase 24 `test/alert.test.ts` header at lines 31-65).

---

## 5. `viewmodel-shell-dotnet/ViewModels.cs` — 10 records + 3 new enums + 10 discriminators + 20 walker arms

**Analog A — record with typed slots + WhenWritingNull:** Phase 24 `ListRowNode` at `ViewModels.cs:2123-2152` (direct template).

**Analog B — container with `IReadOnlyList<ViewNode> Children`:** Phase 24 `MessageListNode` at `ViewModels.cs:2230-2245`.

**Analog C — required non-nullable enum:** Phase 24 `AlertNode.Tone` at `ViewModels.cs:2282` (`Tone Tone,` — required, non-nullable; the compiler enforces it).

**Analog D — closed-union enum with KebabEnum:** `MessageRole` at `ViewModels.cs:238-239`, `ListVariant` at `:229-230` (2-liners).

### 3 new enums to add:

```csharp
/// <summary>v8.0.0 (COMP-09) — UserRowNode status kind. Closed enum controlling
/// the status-dot color. KebabEnum emits "online"/"away"/"offline"/"busy".</summary>
[JsonConverter(typeof(KebabEnum<StatusKind>))]
public enum StatusKind { Online, Away, Offline, Busy }

/// <summary>v8.0.0 (COMP-10a) — DetailListNode label column width. Closed enum
/// mapping to fixed rem values (sm=8, md=10, lg=12). Omitted = md (default;
/// no modifier class, byte-identical to md set explicitly). KebabEnum emits
/// "sm"/"md"/"lg".</summary>
[JsonConverter(typeof(KebabEnum<DetailLabelWidth>))]
public enum DetailLabelWidth { Sm, Md, Lg }

// (Reuses Tone enum for all 5 composites' `tone?` fields — no new enum needed.)
```

### Existing AlertNode (ViewModels.cs:2277-2307) — the direct template for typed-slot composites:

```csharp
public record AlertNode(
    Tone Tone,                                    // REQUIRED — non-nullable enum
    ViewNode Message,                              // REQUIRED — typed ViewNode
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Title = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ViewNode>? Actions = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Dismissible = false
) : ViewNode;
```

### What to add — 10 new records (schemas match CONTEXT §1-5):

```csharp
// ── COMP-09 UserRowNode ──
public record UserRowNode(
    ViewNode Name,                                              // REQUIRED
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Avatar = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Meta = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] UserRowStatus? Status = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Trailing = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null
) : ViewNode;

// Small typed sub-record — NOT a ViewNode, so no [JsonDerivedType]. Same posture
// as LookupItem / FieldOption. WhenWritingNull discipline still applies.
public record UserRowStatus(
    string Label,                                                // REQUIRED
    StatusKind Kind                                              // REQUIRED enum
);

// ── COMP-10 + 10a DetailRowNode + DetailListNode ──
public record DetailRowNode(
    string Label,                                                // REQUIRED (primitive; NOT ViewNode)
    ViewNode Value,                                              // REQUIRED
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null
) : ViewNode;

public record DetailListNode(
    // Typed IReadOnlyList<ViewNode> per Phase 24 MessageListNode posture at :2231-2239
    // (polymorphic discriminator emission). Runtime validator in
    // ViewTreeValidation.Collect enforces DetailRowNode-only children.
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DetailLabelWidth? LabelWidth = null
) : ViewNode;

// ── COMP-11 + 11a TimelineEntryNode + TimelineNode ──
public record TimelineEntryNode(
    string Time,                                                 // REQUIRED (primitive; NOT ViewNode)
    ViewNode Description,                                        // REQUIRED
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null
) : ViewNode;

public record TimelineNode(
    IReadOnlyList<ViewNode> Children
) : ViewNode;

// ── COMP-12 + 12a SettingRowNode + SettingListNode ──
public record SettingRowNode(
    ViewNode Label,                                              // REQUIRED
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Description = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Trailing = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null
) : ViewNode;

public record SettingListNode(
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Heading = null
) : ViewNode;

// ── COMP-13 + 13a ChipNode + ChipListNode ──
public record ChipNode(
    string Label,                                                // REQUIRED
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,
    // CALLER-SUPPLIED ActionDescriptor — mirrors ModalNode.DismissAction shape,
    // NOT AlertNode.Dismissible's bool posture. Chip needs identity-carrying
    // dispatch (e.g. "remove-filter-42"); the composite emits no local fixed name.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? DismissAction = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null
) : ViewNode;

public record ChipListNode(
    IReadOnlyList<ViewNode> Children
) : ViewNode;
```

### Append 10 `[JsonDerivedType]` rows at ViewModels.cs:804 tail:

```csharp
[JsonDerivedType(typeof(UserRowNode),       "user-row")]
[JsonDerivedType(typeof(DetailRowNode),     "detail-row")]
[JsonDerivedType(typeof(DetailListNode),    "detail-list")]
[JsonDerivedType(typeof(TimelineEntryNode), "timeline-entry")]
[JsonDerivedType(typeof(TimelineNode),      "timeline")]
[JsonDerivedType(typeof(SettingRowNode),    "setting-row")]
[JsonDerivedType(typeof(SettingListNode),   "setting-list")]
[JsonDerivedType(typeof(ChipNode),          "chip")]
[JsonDerivedType(typeof(ChipListNode),      "chip-list")]
```

### 20 walker arms (10 `Collect` + 10 `WalkForSectionAction`) at `ViewModels.cs:2469-2547` — mirror the TS shape in §3 above using the shipped C# pattern-match idiom:

```csharp
// Collect arm example (mirrors TS server.ts arm above):
case DetailListNode detailList:
    foreach (var child in detailList.Children)
    {
        if (child is not DetailRowNode)
            throw new InvalidOperationException(
                $"DetailListNode.children must all be DetailRowNodes (found: {child.GetType().Name})");
    }
    foreach (var child in detailList.Children) Collect(child, enclosingForm, sink);
    break;

// WalkForSectionAction arm example (mirrors Phase 24 MessageListNode at :2495-2501):
case DetailListNode detailList:
    foreach (var child in detailList.Children) WalkForSectionAction(child, outerInteractive);
    break;
```

**⚠️ Error message discipline** — Phase 24's MessageListNode arm uses byte-identical error text on both backends (`"MessageListNode.children must all be MessageNodes (found: X)"`). Same rule applies to every new tree-invariant here — the .NET error strings MUST match the TS `throw new Error(...)` messages byte-for-byte, since parity byte-diffs the invalid_tree response body.

---

## 6. `demo/FeatureProbe-bun/handler.ts` — `secondaryCompositesSection` extension

**Analog:** `primaryCompositesSection` at `handler.ts:1109-1244` (Phase 24 direct-neighbor template).

**Direct excerpt — the Phase 24 section start (handler.ts:1141-1170):**

```typescript
  const primaryCompositesSection: ViewNode = {
    type: "section",
    heading: "v8.0.0 Primary Composites",
    variant: "card",
    children: [
      // ── COMP-05 ListRowNode (standalone) ────
      {
        type: "list-row",
        primary: { type: "text", value: "Order #42 · Ada Lovelace", style: "body", weight: "medium" },
        secondary: { type: "text", value: "Awaiting fulfillment · flagged high priority", style: "muted" },
        meta: [
          { type: "text", value: "Placed 2h ago",  style: "caption" },
          { type: "text", value: "priority: high", style: "caption" },
          { type: "text", value: "channel: web",   style: "caption" },
        ],
        tone: "warning",
        state: "high",
        action: { name: "list-row-open-42" },
      },
```

**What to append — new `secondaryCompositesSection` immediately after `primaryCompositesSection` (before the `pageChildren.push()` at handler.ts:1396):**

```typescript
  const secondaryCompositesSection: ViewNode = {
    type: "section",
    heading: "v8.0.0 Secondary Composites",
    variant: "card",
    children: [
      // ── COMP-09 UserRowNode (standalone + in .vms-user-row-list container) ──
      // Wrap TextNodes explicitly on the wire so bun matches .NET (which cannot
      // use the `string | ViewNode` TS convenience — same convention as Phase 24
      // primary composites).
      {
        type: "user-row",
        avatar: { type: "avatar", initials: "JD", tone: "info" },
        name: { type: "text", value: "Jane Dougherty", style: "body", weight: "medium" },
        meta: { type: "text", value: "jane.d · SRE Lead", style: "muted" },
        status: { label: "Online", kind: "online" },
        action: { name: "user-row-open-jd" },
      },
      // ── COMP-10 + 10a DetailListNode with DetailRowNode children + labelWidth ──
      {
        type: "detail-list",
        labelWidth: "lg",   // proves the closed enum crosses (not just default/absent)
        children: [
          { type: "detail-row", label: "Status",     value: { type: "text", value: "Open", style: "body" } },
          { type: "detail-row", label: "Assignee",   value: { type: "text", value: "Jane Dougherty", style: "body" } },
          { type: "detail-row", label: "Deleted",    value: { type: "text", value: "purged 2h ago", style: "body" }, tone: "danger" },
        ],
      },
      // ── COMP-11 + 11a TimelineNode with TimelineEntryNodes covering tones ──
      {
        type: "timeline",
        children: [
          { type: "timeline-entry", time: "2:47 PM", description: { type: "text", value: "Incident opened", style: "body" }, tone: "danger" },
          { type: "timeline-entry", time: "2:49 PM", description: { type: "text", value: "Acknowledged by Jane", style: "body" }, tone: "warning" },
          { type: "timeline-entry", time: "2:58 PM", description: { type: "text", value: "Rollback verified", style: "body" }, tone: "success" },
        ],
      },
      // ── COMP-12 + 12a SettingListNode with SettingRowNode children ──
      // Exercises the CheckboxNode(variant:"switch") pairing per CONTEXT §9.
      {
        type: "setting-list",
        heading: "Notification preferences",
        children: [
          {
            type: "setting-row",
            label: { type: "text", value: "Email notifications", style: "body", weight: "medium" },
            description: { type: "text", value: "Receive an email for every incident update.", style: "muted" },
            trailing: { type: "checkbox", label: "", variant: "switch", checked: true, bind: "settings.email" },
          },
          {
            type: "setting-row",
            label: { type: "text", value: "Weekly digest", style: "body", weight: "medium" },
            description: { type: "text", value: "A Monday-morning summary of the past week.", style: "muted" },
            trailing: { type: "button", label: "Configure", action: { name: "setting-row-configure-digest" } },
          },
        ],
      },
      // ── COMP-13 + 13a ChipListNode with ChipNodes covering all axes ──
      // Proves BOTH dismissAction slot (caller-supplied name, distinct from
      // AlertNode.dismissible's fixed name) AND action slot.
      {
        type: "chip-list",
        children: [
          { type: "chip", label: "active",   tone: "success", dismissAction: { name: "chip-remove-filter-active" } },
          { type: "chip", label: "warning",  tone: "warning" },
          { type: "chip", label: "clickme",  action: { name: "chip-toggle-tag-clickme" } },
          { type: "chip", label: "both",     tone: "info", action: { name: "chip-toggle-tag-both" }, dismissAction: { name: "chip-remove-tag-both" } },
        ],
      },
    ],
  };
```

**Wire-in step:** insert `secondaryCompositesSection` immediately after `primaryCompositesSection` at the `pageChildren.push()` block near handler.ts:1396.

---

## 7. `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — .NET twin extension

**Analog:** Phase 24 Primary Composites SectionNode at `FeatureProbeController.cs:1207-1310`.

**Direct excerpt from Phase 24 (FeatureProbeController.cs:1249-1259):**

```csharp
            Heading: "v8.0.0 Primary Composites",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                // COMP-05 ListRowNode (standalone)
                new ListRowNode(
                    Primary: new TextNode("Order #42 · Ada Lovelace", Style: TextStyle.Body, Weight: TextWeight.Medium),
                    Secondary: new TextNode("Awaiting fulfillment · flagged high priority", Style: TextStyle.Muted),
                    Meta: new ViewNode[] { new TextNode("Placed 2h ago", Style: TextStyle.Caption), /* ... */ },
                    Tone: Tone.Warning,
                    State: "high",
                    Action: new ActionDescriptor("list-row-open-42")),
```

**What to add — append a Secondary Composites SectionNode with byte-identical structure to the bun handler.ts secondaryCompositesSection above.** Same convention: every action name is UNIQUE and prefixed to avoid clashes (`user-row-open-jd`, `chip-remove-filter-active`, etc.). The .NET server wraps every `string | ViewNode` slot as an explicit `new TextNode(...)` — matching the Phase 24 pattern.

---

## 8. `parity/fixtures/feature-probe.json` — `$comment` append + tripwires

**Analog:** the v8.0.0 primary-composites clause at the tail of the giant `$comment` string at line 5, plus the existing tripwires at lines 84-96 (already covering `"type":"list-row"`, `"type":"message-list"`, `"type":"empty-state"`, `list-row-open-42`, `empty-state-cta-probe`).

### `$comment` clause to APPEND (before the trailing `"`):

```
v8.0.0 (COMP-09..COMP-13, secondary composites): buildVm renders a 'Secondary Composites' section covering the five secondaries. USER-ROW: one UserRowNode with all slots populated (avatar + name + meta + status:{label:'Online', kind:'online'} + action name user-row-open-jd for name-uniqueness walker descent proof). DETAIL-LIST: one DetailListNode with labelWidth:'lg' (proves the closed DetailLabelWidth enum crosses; omitted case implicitly proves absent=default per WhenWritingNull) containing three DetailRowNodes — two neutral + one with tone:'danger' (proves the tone closed union crosses on the row-level). TIMELINE: one TimelineNode containing three TimelineEntryNodes (one per tone: danger/warning/success — proves the tone-driven dot-border palette crosses). SETTING-LIST: one SettingListNode with heading + two SettingRowNodes, one with a CheckboxNode(variant:'switch') trailing control (exercises the COMP-03 pairing per CONTEXT §9), one with a ButtonNode trailing carrying UNIQUE action name setting-row-configure-digest (proves the action-name walk descends through SettingRowNode.trailing). CHIP-LIST: one ChipListNode containing four ChipNodes covering the full slot matrix — dismissAction-only (name chip-remove-filter-active), tone-only, action-only (name chip-toggle-tag-clickme), and BOTH action+dismissAction (proves the two ActionEvent slots coexist and each participates in name uniqueness — UNIQUE names chip-toggle-tag-both + chip-remove-tag-both). Captured by the initial GET step; expectBodyContains asserts 'type':'user-row', 'kind':'online' (status-kind enum tripwire — narrow enough to bind), 'type':'detail-row', 'type':'detail-list', 'labelWidth':'lg', 'type':'timeline-entry', 'type':'timeline', 'type':'setting-row', 'type':'setting-list', 'type':'chip', 'type':'chip-list', 'dismissAction':{, user-row-open-jd, chip-remove-filter-active, setting-row-configure-digest cross (coverage tripwires so each branch can't go vacuous — banked lesson: a diff can only prove things about code it actually RUNS; a tripwire per branch is the class-3 defect protection AGENTS.md's plan-checker rule exists for). NOTE: the CLIENT-SIDE rendering (timeline rail-and-dot ::before mechanism, status-dot palette, chip tinted-pill color-mix palettes, DetailList grid label column, SettingRow trailing-slot vertical centering) is browser-only and NOT part of parity — parity proves only that the fields serialize identically across backends.
```

### Tripwires to APPEND to the `initial` step's `expectBodyContains` array (currently ends at line 96):

```json
"\"type\":\"user-row\"",
"\"kind\":\"online\"",
"\"type\":\"detail-row\"",
"\"type\":\"detail-list\"",
"\"labelWidth\":\"lg\"",
"\"type\":\"timeline-entry\"",
"\"type\":\"timeline\"",
"\"type\":\"setting-row\"",
"\"type\":\"setting-list\"",
"\"type\":\"chip\"",
"\"type\":\"chip-list\"",
"\"dismissAction\":{",
"user-row-open-jd",
"chip-remove-filter-active",
"setting-row-configure-digest"
```

**Note on false-positive risk:** `"kind":"online"` needs care — verify no other section emits `kind` at all before Phase 25 (it's a new field on the wire). If any pre-existing node ever adds a `kind` field, promote the tripwire to a longer substring like `"kind":"online"` + `"label":"Online"` combined. As of Phase 24 landing, `kind` is not on any wire — the tripwire is safe.

**`dismissAction:{` tripwire** — proves the ActionEvent-slot dismiss serializes as a JSON OBJECT (not a bare string, not omitted). The `{` character binds it to the ActionEvent shape specifically. Distinct from AlertNode's `"dismissible":true` boolean tripwire from Phase 24.

**`parity/run.ts` needs NO change** — tripwires live in the fixture, not the runner.

---

## 9. Vitest tests — 5 new files (one per composite pair)

**Analog A — mutation-testable DOM/a11y + AA hand-check header:** `test/alert.test.ts` at `viewmodel-shell/test/alert.test.ts:1-65+` (Phase 24 shipped, direct byte-aligned template).

**Analog B — container-with-typed-children (tree validator + DOM shape):** `test/message.test.ts` + `test/message-followtail.test.ts` (Phase 24).

**Analog C — CheckboxNode(variant:"switch") composition inside a slot:** `test/checkbox-switch.test.ts` (Phase 23 shipped) — for SettingRowNode.trailing pairing.

### Per-file coverage requirements (mirror Phase 24 discipline):

- **`test/user-row.test.ts`:** every slot combination (bare `{name:...}`, all-slots-set, status × 4 kinds, action present/absent, string-vs-ViewNode name/meta); assert `.vms-user-row__status` + `.vms-status-dot--{kind}` class emission per §4a; assert `role="button"` + Enter/Space when action set; assert status label + dot are ordered dot-then-label. Mutation-test: swap `--online` → `--away` in browser.ts → the kind=online test fails.

- **`test/detail-row.test.ts`:** DetailListNode emits `<dl>`; DetailRowNode emits `<div><dt><dd></div>` (semantic HTML); labelWidth × { absent, sm, md, lg } → class emission; tone × 4 → color modifier; icon slot renders inside `<dt>` before label text. Mutation-test: swap `<dl>` → `<div>` → the semantic-element test fails.

- **`test/timeline.test.ts`:** TimelineNode emits `<ol class="vms-timeline">`; each TimelineEntryNode emits `<li>` with tone class; time is caption-tier (`.vms-text--caption` on the time text); description is body-tier (default) or ViewNode as-is; icon slot renders. **Skip computed-style tests for the rail/dot** (per Phase 24 jsdom caveat — jsdom doesn't compute `::before` pseudo-element geometry). Assert class presence only; the AA hand-check header documents the visual rail per-theme separately.

- **`test/setting-row.test.ts`:** SettingListNode emits `<ul>` + optional `<h3>` heading; SettingRowNode emits `<li>` with `[body | control]` grid; label wraps as body+weight:medium string-lift, description wraps as muted, both accept ViewNode as-is; **one test asserts CheckboxNode(variant:"switch") renders inside `.vms-setting-row__control`** — the natural pairing per CONTEXT §9. Mutation-test: swap `weight:"medium"` → `weight:"bold"` on the label wrap → the label typography test fails.

- **`test/chip.test.ts`:** every tone × { bare, action-only, dismissAction-only, both, icon } permutation; assert `.vms-chip--{tone}` class; assert dismissAction click emits **THE CALLER-SUPPLIED NAME** (via on() spy) — NOT the fixed `"dismiss"` string (this is THE key mutation test that ChipNode is NOT AlertNode: revert `on(dismissAction)` → `on({ name: "dismiss" })` and this test fails); assert stopPropagation on the X when BOTH action and dismissAction are set (a chip click on the X does NOT double-fire the whole-chip action).

### AA hand-check header per file (mirror `test/alert.test.ts:29-65+`):

- **UserRow:** status-dots × 4 × 13 themes = 52 pair-checks. Compute per-theme against surface; document deepen-via-color-mix where needed.
- **DetailRow:** label uppercase muted (already covered) + tone accent text on surface (4 tones × 13 themes = 52).
- **Timeline:** dot-border tones vs surface (4 × 13 = 52; graphical → 3:1 UI-state threshold).
- **SettingRow:** reuses Phase 23 + 24 pairs — no new pairs. Document as "reuses prior coverage; no new checks."
- **Chip:** tinted-pill text on tinted-background (4 × 13 = 52; TEXT threshold 4.5:1) — the highest risk, matches AlertNode structure.

Same "collapse the matrix to light-family + dark-family = 2 unique computed matrices" trick from `test/alert.test.ts:36-48+` applies verbatim.

---

## 10. .NET serialization tests — 9 new files

**Analog:** `Tests/AlertNodeSerializationTests.cs` (Phase 24 shipped, byte-aligned template).

**Direct excerpt — the shape every new file mirrors (AlertNodeSerializationTests.cs:24-40):**

```csharp
public class AlertNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void AlertNode_SerializesTypeAsAlert()
    {
        var node = new AlertNode(Tone: Tone.Danger, Message: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"alert\"", json);
    }
```

### Pattern to replicate per composite (9 files):

`UserRowNodeSerializationTests.cs`, `DetailRowNodeSerializationTests.cs`, `DetailListNodeSerializationTests.cs`, `TimelineEntryNodeSerializationTests.cs`, `TimelineNodeSerializationTests.cs`, `SettingRowNodeSerializationTests.cs`, `SettingListNodeSerializationTests.cs`, `ChipNodeSerializationTests.cs`, `ChipListNodeSerializationTests.cs`.

Every file gets the six-test template:
1. **`Type_SerializesAsX`** — discriminator emission.
2. **`BareNode_SerializesOnlyRequiredFields`** — class-2 findNulls defect protection (bare `new XNode(required-args)` → no null-emitting optionals).
3. **`OmittedOptionals_AreAbsent`** — each optional absent from JSON when null.
4. **`Enum_KebabCases_EachMemberRoundTrips`** — closed-union enum kebab check (StatusKind × 4 for UserRow; DetailLabelWidth × 3 for DetailList).
5. **Field-presence tests** for each optional.
6. **`AllFieldsSet_AllPresent`** — full-serialize proof.

**Container tests (DetailListNode, TimelineNode, SettingListNode, ChipListNode) additionally get:** `Children_ReplaceMixed_Throws` — proves the tree-invariant walker rejects a non-typed child with a byte-identical error message to the TS twin.

**ChipNode additionally gets:** `DismissAction_SerializesAsActionDescriptor` (proves it's an object, not a bool) + `Action_AndDismissAction_BothPresent` (proves both slots coexist on the wire).

**UserRowNode additionally gets:** `Status_SerializesAsSubRecord` (proves the small typed sub-record shape emits `{"label":"...", "kind":"..."}` byte-identically to bun).

---

## 11. `demo/Showcase/frontend/src/main.ts` — Secondary Composites section

**Analog:** Phase 24 "Primary Composites" section at `main.ts:322-439` (direct-neighbor template).

**Direct excerpt — the Phase 24 section start (main.ts:322-336):**

```typescript
    // ── v8.0.0 Primary Composites (COMP-05..COMP-08) ─────────────────────
    // Four high-frequency composites — the shapes VMS consumers reach for
    // first. Each ships as a typed-slot recipe: the framework owns layout /
    // typography / spacing / a11y, the app hands it content via named slots.
    // Fleet-adoption discipline (banked from UseVmsShellStaticFiles 6.7.0):
    // composites ship WITH demo adoption in the same batch — the Showcase
    // is the reference app, and consumers reading it must see the primaries
    // used in situ, not just documented.
    { type: "section", heading: "v8.0.0 Primary Composites", children: [
      { type: "text", value: "Four high-frequency composites — the shapes VMS consumers reach for first. Each ships as a typed-slot recipe: the framework owns layout / typography / spacing / a11y, the app hands it content via named slots.", style: "muted" },

      // ── COMP-05 ListRowNode + ListNode(variant:"rows") ─────────────────
      { type: "text", value: "ListRowNode — dense list row with 3-tier typography", style: "subheading" },
      { type: "text", value: "A single-surface list-row primitive with typed slots (leading / primary / secondary / meta[] / trailing). String slots auto-wrap in the trained typography tier — primary=body+medium, secondary=muted, meta=caption. Wrapped in ListNode variant:\"rows\" for the bordered container + per-row dividers.", style: "muted" },
      { type: "list", variant: "rows", children: [
        { type: "list-row",
          leading: { type: "avatar", initials: "AL", tone: "success" },
          primary: "Ada Lovelace",
          ...
```

**What to add — a "v8.0.0 Secondary Composites" section AFTER the Primary Composites section at `main.ts:439` insertion point.** Same shape: opening subheading + muted intro TextNode, then one subheading + one exercised example per composite pair. Use the TS `string | ViewNode` ergonomic convenience here (unlike FeatureProbe which wraps for byte-alignment) — the Showcase is a bun-only demo and the string shorthand reads better.

Example structure (planner picks content — this is the shape):

```typescript
    // ── v8.0.0 Secondary Composites (COMP-09..COMP-13) ────────────────────
    { type: "section", heading: "v8.0.0 Secondary Composites", children: [
      { type: "text", value: "Five secondary composites completing the v8.0.0 shipped set: person entities, key-value details, activity timelines, settings rows with switches, and dismissible chip clusters.", style: "muted" },

      // ── COMP-09 UserRowNode (member picker pattern) ─────────────────
      { type: "text", value: "UserRowNode — person entity display with avatar + status dot", style: "subheading" },
      // 4 rows: one per status kind
      { type: "user-row", avatar: {...}, name: "Jane Dougherty", meta: "jane.d · SRE", status: { label: "Online", kind: "online" }, action: {...} },
      // ... online / away / offline / busy — one per status kind for visual coverage ...

      // ── COMP-10 + 10a DetailListNode with all three labelWidth values ─
      { type: "text", value: "DetailRowNode + DetailListNode — key-value with aligned label column, proper <dl> semantics", style: "subheading" },
      { type: "detail-list", labelWidth: "md", children: [
        { type: "detail-row", label: "Status", value: "Open" },
        { type: "detail-row", label: "Assignee", value: "Jane Dougherty" },
        { type: "detail-row", label: "Deleted", value: "purged 2h ago", tone: "danger" },
      ]},

      // ── COMP-11 + 11a TimelineNode (incident activity feed) ────────
      { type: "text", value: "TimelineEntryNode + TimelineNode — activity feed with rail + dot markers", style: "subheading" },
      { type: "timeline", children: [
        { type: "timeline-entry", time: "2:47 PM", description: "Incident opened", tone: "danger" },
        // ... at least one per tone: danger/warning/success/info + one bare (accent default) ...
      ]},

      // ── COMP-12 + 12a SettingListNode with CheckboxNode(variant:"switch") ──
      // Exercises the natural pairing per CONTEXT §9.
      { type: "text", value: "SettingRowNode + SettingListNode — label + description + trailing control", style: "subheading" },
      { type: "setting-list", heading: "Notifications", children: [
        {
          type: "setting-row",
          label: "Email notifications",
          description: "Receive an email for every incident update.",
          trailing: { type: "checkbox", label: "", variant: "switch", checked: true, bind: "..." },
        },
        // ... 3-4 rows, at least one with a Button trailing instead ...
      ]},

      // ── COMP-13 + 13a ChipListNode (filter set with dismiss + toggle) ──
      { type: "text", value: "ChipNode + ChipListNode — dismissible pill cluster (filter set / selected tags / labels)", style: "subheading" },
      { type: "chip-list", children: [
        { type: "chip", label: "active",   tone: "success", dismissAction: { name: "showcase-chip-remove-active" } },
        { type: "chip", label: "clickme",  action: { name: "showcase-chip-toggle-clickme" } },
        // ... exercise all 4 tones + both slots + one with both ...
      ]},
    ]},
```

**Fleet-adoption discipline:** the composites and their Showcase adoption ship in the SAME batch (banked from UseVmsShellStaticFiles 6.7.0; documented in AGENTS.md Route B). Do not defer to Phase 26.

---

## 12. `.planning/design/composite-nodes-layer.md` — recipe-inventory table grows 5 rows

**Analog:** the existing "Shipped recipe inventory" table at line 80 (Phase 24 populated the first 4 rows).

**Current table structure (already in place):**

```markdown
## Shipped recipe inventory

*Updated as each phase lands. Phase 24 (2026-07-29) fills in the 4 primaries.*

| Composite | Slot summary | Phase | Wire type | .NET record | Consumes |
|---|---|---|---|---|---|
| `ListRowNode` + `ListNode.variant:"rows"` | leading, primary, secondary, meta[], trailing, tone, state, action | 24 (COMP-05 + 05a) | `"list-row"` / `"list"` | `ListRowNode` / `ListNode` | ... |
| ... | ... | 24 (COMP-06 + 06a / 07 / 08) | ... | ... | ... |
```

**What to append — 5 rows for the secondaries** (matching CONTEXT §11):

```markdown
| `UserRowNode` | avatar, name, meta, status:{label,kind}, trailing, action | 25 (COMP-09) | `"user-row"` | `UserRowNode` | AvatarNode (COMP-04), TextNode caption/weight (COMP-01/02), status-dot palette (baked-in CSS) |
| `DetailRowNode` + `DetailListNode` | label, value, tone, icon; labelWidth on list | 25 (COMP-10 + 10a) | `"detail-row"` / `"detail-list"` | `DetailRowNode` / `DetailListNode` | IconName (v7.0), TextNode body (COMP-01); `<dl>/<dt>/<dd>` semantic HTML |
| `TimelineEntryNode` + `TimelineNode` | time, description, tone, icon | 25 (COMP-11 + 11a) | `"timeline-entry"` / `"timeline"` | `TimelineEntryNode` / `TimelineNode` | TextNode caption/body (COMP-01); **NEW baked-in CSS mechanism: rail via `::before` on container, dot via `::before` on entry — apps CANNOT compose this from primitives** |
| `SettingRowNode` + `SettingListNode` | icon, label, description, trailing, action; heading on list | 25 (COMP-12 + 12a) | `"setting-row"` / `"setting-list"` | `SettingRowNode` / `SettingListNode` | TextNode weight (COMP-02), CheckboxNode(variant:"switch") (COMP-03) as natural trailing pairing |
| `ChipNode` + `ChipListNode` | label, tone, icon, dismissAction, action | 25 (COMP-13 + 13a) | `"chip"` / `"chip-list"` | `ChipNode` / `ChipListNode` | IconName (v7.0); **`dismissAction` is an ActionEvent SLOT (caller-supplied identity-carrying name), NOT a fixed-name bool like AlertNode.dismissible** — chips typically dispatch identity-carrying actions like `remove-filter-42` |
```

**Also update §4d** — the "Composites (Phase 25 — secondary)" free-form section — to note the schemas landed as designed (planner picks the exact edits based on what §4d currently promises vs. what ships).

---

## 13. `AGENTS.md` — "Currently shipped recipes" inventory grows to 9

**Analog:** Phase 24 fill at `AGENTS.md:744-752` (the 4 primaries now live there).

**Current, quoted (AGENTS.md:744-752):**

```markdown
**Currently shipped recipes.** *(Updated as Phase 24-26 land. Docs describe SHIPPED recipes only — an entry appears here only after its plan's SUMMARY lands on `main`.)*

Phase 24 (v8.0.0, primary composites):
- `ListRowNode` + `ListNode.variant:"rows"` (COMP-05 + 05a) — ...
- `MessageNode` + `MessageListNode` (COMP-06 + 06a) — ...
- `AlertNode` (COMP-07) — ...
- `EmptyStateNode` (COMP-08) — ... (v8.0 WIRE BREAKING)

Phase 25 composites (`UserRowNode`, `DetailRowNode` + `DetailListNode`, `TimelineEntryNode` + `TimelineNode`, `SettingRowNode` + `SettingListNode`, `ChipNode` + `ChipListNode`): TBD in `/gsd:plan-phase 25`.
```

**What to add — replace the "Phase 25 ... TBD" line with the 5 shipped entries:**

```markdown
Phase 25 (v8.0.0, secondary composites):
- `UserRowNode` (COMP-09) — person entity display: avatar + name + meta + right-aligned status dot. `status?: {label, kind}` uses a closed 4-value StatusKind enum (`online`→success, `away`→warning, `offline`→muted, `busy`→danger). Whole-row `action?` for member-picker pattern.
- `DetailRowNode` + `DetailListNode` (COMP-10 + 10a) — key-value with aligned label column via CSS grid on `<dl>/<dt>/<dd>` (proper screen-reader term/definition semantics). `labelWidth?: "sm"|"md"|"lg"` closed enum on the list (8/10/12rem). Trained typography: label = text-xs uppercase weight:500 muted; value = body.
- `TimelineEntryNode` + `TimelineNode` (COMP-11 + 11a) — activity feed with baked-in rail-and-dot CSS mechanism. **`::before` rail on the container + `::before` dot per entry with tone-encoded border** — apps CANNOT compose this from primitives (the composite exists specifically to bake it in, per "apps describe, never decorate"). Trained typography: time = caption; description = body (string or ViewNode).
- `SettingRowNode` + `SettingListNode` (COMP-12 + 12a) — label + description + trailing control. Grid: `[body | control]` = `1fr auto`, `align-items: center`. **Natural pairing with `CheckboxNode(variant:"switch")` from COMP-03** in the trailing slot; also common: ButtonNode, LinkNode. Optional list `heading?: string`.
- `ChipNode` + `ChipListNode` (COMP-13 + 13a) — tinted-pill cluster (filter chips, selected tags, categories). **`dismissAction?: ActionEvent` DEVIATES from AlertNode.dismissible** — it's a caller-supplied ActionEvent slot (identity-carrying: `remove-filter-42`), not a fixed-name boolean. Chip needs the app to name the action because chips typically operate on specific identities. If BOTH `action` and `dismissAction` are set, the X's click does `stopPropagation` so it doesn't double-fire the whole-chip click.

Phase 26 release ritual: TBD (aligned v8.0.0 npm + NuGet publish; see `.planning/design/composite-nodes-layer.md` §5).
```

**Also grow the "genuine composites we shipped" narrative** if any prose elsewhere in the Route B section references it — the inventory expands from 4 to 9 recipes total (10 with EmptyStateNode; 11 with the AvatarNode primitive it consumed).

---

## 14. `CHANGELOG.md` — append 5 entries under "Unreleased — v8.0.0"

**Analog:** the existing block at `CHANGELOG.md:9-27` (Phase 24 additions).

**Current, quoted (CHANGELOG.md:19-22):**

```markdown
- `ListRowNode` (`"list-row"`) — dense list row with 3-tier typography. Wire shape: `{ type, leading?, primary, secondary?, meta?[], trailing?, tone?, state?, action? }`. Slots `primary/secondary/meta[]` accept `string | ViewNode`; strings auto-wrap in trained `TextNode` (`body`+`weight:"medium"` for primary; `muted` for secondary; `caption` for meta — consumes v8.0 COMP-01/02). Whole-row `action?` follows `TableRow.action` shape (role="button", Enter/Space dispatch, aria-label from flattened text, stopPropagation on interactive descendants). Pairs with `ListNode.variant: "rows"` — single-bordered-surface container accepting ONLY `ListRowNode` children (tree-validator rejects mixed; older adapters gracefully degrade on unknown variant). (COMP-05 + 05a)
```

**What to append — 5 entries in the same tone/depth**:

```markdown
- `UserRowNode` (`"user-row"`) — person entity display with avatar + name + meta + right-aligned status dot. Wire shape: `{ type, avatar?, name, meta?, status?, trailing?, action? }`. `name` and `meta` are `string | ViewNode` (TS ergonomic convenience; `.NET` wraps explicitly). `status: {label, kind}` uses a closed `StatusKind` enum (`"online"|"away"|"offline"|"busy"`) mapped to shipped tone colors. Whole-row `action?` follows `ListRowNode.action` shape. (COMP-09)
- `DetailRowNode` (`"detail-row"`) + `DetailListNode` (`"detail-list"`) — key-value display with aligned label column via `<dl>/<dt>/<dd>` semantic HTML. Wire shapes: `{ type, label, value, tone?, icon? }` and `{ type, children[], labelWidth?: "sm"|"md"|"lg" }`. `labelWidth` sets a fixed CSS grid label column (8/10/12rem); omitted = md default. Tree-validator rejects non-DetailRowNode children with byte-identical error across TS + .NET. Trained typography: label = text-xs uppercase weight:500 muted (baked in CSS); value = body. (COMP-10 + 10a)
- `TimelineEntryNode` (`"timeline-entry"`) + `TimelineNode` (`"timeline"`) — activity feed with baked-in CSS rail-and-dot mechanism. Wire shapes: `{ type, time, description, tone?, icon? }` and `{ type, children[] }`. Rail via `::before` on the container; dot per entry via `::before` with tone-encoded border. **This composite exists specifically to bake this in — apps CANNOT compose this from primitives per "apps describe, never decorate."** Trained typography: time = caption; description = body (string or ViewNode). (COMP-11 + 11a)
- `SettingRowNode` (`"setting-row"`) + `SettingListNode` (`"setting-list"`) — label + description + trailing control (settings pages, feature-flag toggles, notification preferences). Wire shapes: `{ type, icon?, label, description?, trailing?, action? }` and `{ type, children[], heading? }`. Grid: `[body | control]` = `1fr auto`, `align-items: center`. Trailing slot commonly pairs with `CheckboxNode(variant:"switch")` from COMP-03; also common: ButtonNode, LinkNode. Tree-validator rejects non-SettingRowNode children. (COMP-12 + 12a)
- `ChipNode` (`"chip"`) + `ChipListNode` (`"chip-list"`) — tinted-pill cluster for filter chips, selected tags, categories. Wire shapes: `{ type, label, tone?, icon?, dismissAction?, action? }` and `{ type, children[] }`. **`dismissAction?: ActionEvent` is a CALLER-SUPPLIED slot** (identity-carrying: `remove-filter-42`), distinct from `AlertNode.dismissible` which emits a fixed local name. Both `action` and `dismissAction` may coexist; the X's click `stopPropagation`s so it doesn't double-fire the whole-chip action. Absent `dismissAction` = no X rendered (respects "no dead UI"). Tree-validator rejects non-ChipNode children in ChipListNode. (COMP-13 + 13a)
```

**No BREAKING entries this phase** — every addition is additive (no wire rename cascade like Phase 24's EmptyStateNode).

---

## 15. `MIGRATION.md` — 5 additive notes (no breaking changes)

**Analog:** the Phase 24 additive-only note at `MIGRATION.md:57-65`.

**Current, quoted (MIGRATION.md:57-65):**

```markdown
### ListRowNode, MessageNode, MessageListNode, AlertNode (COMP-05, 06, 06a, 07) — new node types

**Additive; no consumer changes required.** New node types with `[JsonDerivedType]` discriminators; older adapters silently emit nothing for unknown types (existing behavior for forward compatibility).

See the `Unreleased — v8.0.0 (in progress)` section of `CHANGELOG.md` for the full wire-level detail.
```

**What to append — one paragraph covering all 5 secondaries** (mirror the Phase 24 additive shape):

```markdown
### UserRowNode, DetailRowNode + DetailListNode, TimelineEntryNode + TimelineNode, SettingRowNode + SettingListNode, ChipNode + ChipListNode (COMP-09..COMP-13) — new node types

**Additive; no consumer changes required.** Five secondary composite pairs with `[JsonDerivedType]` discriminators; older adapters silently emit nothing for unknown types (existing behavior for forward compatibility). No wire renames, no field removals — every existing v7.x + Phase 24 consumer keeps working untouched.

See the `Unreleased — v8.0.0 (in progress)` section of `CHANGELOG.md` for the full wire-level detail per composite.

**One deliberate deviation to know about:** `ChipNode.dismissAction` is a CALLER-SUPPLIED `ActionEvent` slot (identity-carrying name like `remove-filter-42`), distinct from `AlertNode.dismissible` (Phase 24) which emits a fixed-name `{name: "dismiss"}` locally. Consumers building filter-chip UIs should model each chip's dismiss dispatch with a unique per-chip name in state — the framework does not auto-name.
```

---

## Summary — analogs at a glance

| Requirement | Primary analog | New machinery needed? |
|---|---|---|
| COMP-09 (UserRowNode) | Phase 24 `ListRowNode` (grid + string-lift + action + stopPropagation) + NEW status-dot CSS palette | Small — status-dot CSS palette (4 kinds); no new adapter code beyond an 8-line status renderer |
| COMP-10 (DetailRow) | Phase 24 `ListRowNode` (typed slots + tone) + NEW `<dl>/<dt>/<dd>` DOM shape | Small — semantic-HTML choice; same machinery as any other `createElement("dl")` |
| COMP-10a (DetailList) | Phase 24 `MessageListNode` (container + tree-validator) + NEW `labelWidth` CSS-var pattern | Small — CSS custom property (`--vms-detail-label`); one enum in ViewModels.cs |
| COMP-11 (TimelineEntry) | Phase 24 `ListRowNode` (typed slots + tone) — trivial renderer | No |
| COMP-11a (Timeline) | Phase 24 `MessageListNode` (container + tree-validator) + **🚨 NEW baked-in CSS mechanism (::before rail + dots)** | **YES — the ONE genuinely new CSS mechanism in this phase. Documented in §4c above.** |
| COMP-12 (SettingRow) | Phase 24 `ListRowNode` (grid + string-lift + action + stopPropagation, WITH stopPropagation extended to `.vms-checkbox__input` for switch pairing) | No — pattern extension only |
| COMP-12a (SettingList) | Phase 24 `MessageListNode` (container + tree-validator) + optional heading emission before the list | Small — extra optional `<h3>` sibling emission |
| COMP-13 (Chip) | Phase 24 `AlertNode` (tone + icon + optional dismiss) + **🚨 ModalNode.dismissAction shape (NOT AlertNode.dismissible) — caller-supplied ActionEvent slot** | **YES — the divergence-from-Phase-24 to watch. Documented in §2f above.** |
| COMP-13a (ChipList) | Phase 24 `MessageListNode` + role="list" + flex-wrap cluster CSS | No |
| Tree-validator descent | Phase 24 `case "list-row"` (typed-slot descent + action recording) + `case "message-list"` (typed-child invariant + byte-identical error message) | No — 10 new walker arms follow the same shape |
| Parity FeatureProbe extension | Phase 24 `primaryCompositesSection` at handler.ts:1109-1244 + .NET twin at FeatureProbeController.cs:1207-1310 + tripwires at feature-probe.json:84-96 | No — EXTEND, don't add a new fixture. ~12 new tripwires. |
| Test coverage (vitest + .NET) | Phase 24 `test/alert.test.ts` + `test/message.test.ts` + `Tests/AlertNodeSerializationTests.cs` | No — line-for-line templates exist |
| Showcase demo adoption | Phase 24 Primary Composites section at main.ts:322-439 (direct-neighbor template) | No |
| Design doc + AGENTS.md inventory | Phase 24 populated the first 4 rows of `## Shipped recipe inventory` table at composite-nodes-layer.md:80 + AGENTS.md:744-752 | No — first-fill of the Phase 25 rows |
| CHANGELOG + MIGRATION | Phase 24 additions at CHANGELOG.md:9-27; MIGRATION.md:57-65 | No — append-only, additive |
| Release | N/A — CONTEXT §10 defers to Phase 26 | Zero this phase |

**Verdict:** ~95% pattern reuse. The two genuinely new mechanisms — Timeline's `::before` rail+dot CSS and ChipNode's `dismissAction` ActionEvent slot — are documented above at their exact code-shape excerpts. Every other layer is a byte-aligned copy of a Phase-24-6-days-ago template.

**The three highest-risk items** (per plan-checker C-3/C-4 conventions):

1. **ChipNode.dismissAction posture (mirrors ModalNode, NOT AlertNode).** Do NOT let an executor copy AlertNode's `dismissible: boolean` shape into ChipNode. The wire is `dismissAction?: ActionEvent`; the renderer calls `on(dismissAction)` with the caller's ActionEvent; the walker `recordAction`s it (participates in name uniqueness — AlertNode's dismiss does NOT). Distinct test discipline (§9 `test/chip.test.ts`).

2. **TimelineNode CSS rail+dot mechanism is baked in — do NOT ship "app CSS documentation" instead.** The composite exists specifically because apps CANNOT compose the rail from primitives. The 40-line CSS block in §4c must ship in `default.css`, not in a demo's app-tokens.css or a Showcase inline `<style>` block. **This is exactly the "apps don't decorate" rule the framework enforces — Timeline is the recipe that closes the gap.**

3. **`.NET string | ViewNode` policy carries forward — every slot is `ViewNode?` (not `object?` + custom converter).** Same posture as Phase 24 §5 Analog C — LOCKED. If a Phase 25 executor proposes an `object?` converter to "restore the ergonomic parity," redirect to the Phase 24 doctrine: byte-alignment simplicity beats ergonomic parity; the .NET server writes `Primary: new TextNode("Foo", Style: TextStyle.Body, Weight: TextWeight.Medium)` explicitly.

---

## PATTERN MAPPING COMPLETE
