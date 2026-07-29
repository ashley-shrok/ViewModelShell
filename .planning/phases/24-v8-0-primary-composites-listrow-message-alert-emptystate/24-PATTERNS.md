# Phase 24: v8.0 Primary Composites — Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 6 requirement IDs (COMP-05, 05a, 06, 06a, 07, 08) × ~7 target layers each
**Analogs found:** 100% — every mechanism this phase needs is already shipped

> **Headline for the planner.**
>
> 1. **Every recipe has an in-repo analog.** ListRowNode ≈ `ListItemNode` + `TableRow.action` (whole-row click) + `SectionNode.action` (aria-label + Space/Enter). MessageNode ≈ `SectionNode` (typed slots + tone-tinted surface). AlertNode ≈ `SectionNode` `variant:"card"` + tone (color-mix tinted surface) + `ModalNode.dismissAction` (close-X pattern). EmptyStateNode ≈ **the ALREADY-SHIPPED `EmptyStateNode` at `index.ts:1380-1388`** — this phase's design EXPANDS it (adds `icon`, RENAMES `heading→title`, `message→description`).
>
> 2. **🚨 EmptyStateNode is a BREAKING CHANGE, not a new node.** The wire type `"empty-state"` already exists with `{heading, message, action}`. CONTEXT §6 renames to `{icon, title, description, action}`. Two shipped consumers use it (index.ts:200 in ViewNode union, browser.ts:558/3969, server.ts:283, ViewModels.cs:1938, plus feature-probe fixture uses `feedback-cta`). Migration path lives in Plan 24-04 — bump migration notes, retype .NET record + TS interface, update the renderer's slot names, add the tinted-circle icon, keep `feedback-cta` action alive. Consider this the highest-risk plan in the phase.
>
> 3. **The single most important reuse — `MessageListNode.followTail` REUSES the shipped `data-follow-tail` mechanism at `browser.ts:53-58 + 227-246 + 362-372 + 1062`.** Plan-checker C-4 warning: **do NOT build a parallel scroll-pin mechanism.** MessageListNode's renderer just sets `el.dataset.followTail = ""` (verbatim from browser.ts:1062); the pre-render snapshot + post-render restore code already walks every `[data-follow-tail]` in document order. Zero new adapter code. This is the exact-address extraction the CONTEXT §4 planner note demands.
>
> 4. **`AlertNode.dismissible` DEVIATES from `ModalNode.dismissAction`.** Modal takes an `ActionEvent` slot (caller supplies name); Alert emits a fixed `{name: "dismiss"}` on the wire per CONTEXT §5. This is a **small, intentional deviation** — the shape is `dismissible?: boolean` (not `dismissAction?: ActionEvent`), with `[JsonIgnore(WhenWritingDefault)]` on the .NET side (bool posture, not nullable posture). The renderer builds the ActionEvent locally.
>
> 5. **The `EmptyStateNode` rename cascades to CHANGELOG + MIGRATION** because it's a wire break. Every existing consumer (feature-probe demos + tests) has to update to the new field names in the same commit run.

## File Classification

| File to create/modify | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `viewmodel-shell/src/index.ts` (4 new ViewNode types + `ListNode.variant` extension + EmptyStateNode rename) | model/wire-type | request-response | `IconNode` (leaf), `SectionNode` (typed slots), `ListNode` (variant grow), existing `EmptyStateNode` (rename) | exact |
| `viewmodel-shell/src/browser.ts` (4 new renderer arms + `list()` variant branch + `emptyState()` rename) | component/renderer | request-response | `avatar()` (4178), `listItem()` (1124), `section()` (1044+ tinted surface), `emptyState()` (3969 — RENAME), `modal()` (3471 dismissAction) | exact |
| `viewmodel-shell/src/server.ts` (walker arms for 4 new types + validator arms for new tree rules) | model/validator | request-response | `case "empty-state"` at `server.ts:283-291` + `case "avatar"` at `server.ts:201-207` (leaf) | exact |
| `viewmodel-shell/styles/default.css` (`.vms-list-row*`, `.vms-list--rows`, `.vms-message*`, `.vms-alert*`, `.vms-empty-state*` UPDATE) | config/styling | — | Tasting page CSS verbatim (`tasting-page/index.html:135-345`) + `.vms-section--{tone}` at `default.css:443-446` | exact |
| `viewmodel-shell-dotnet/ViewModels.cs` (4 records + enums + `[JsonDerivedType]` + walker arms + EmptyStateNode rename) | model/wire-type | request-response | `AvatarNode` (2030-2049), `SectionNode` (typed slots), `ModalNode` DismissAction pattern (1400+), existing `EmptyStateNode` (1938-1949) | exact |
| `demo/FeatureProbe-bun/handler.ts` (extend `buildVm` with primary-composites section) | test/fixture | request-response | v8.0.0 `foundationsSection` at `handler.ts:1066-1104` (Phase 23 template) | exact |
| `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (.NET twin extension) | test/fixture | request-response | `pageChildren.Add(new SectionNode(Heading: "v8.0.0 Foundations"...))` at `FeatureProbeController.cs:1163-1203` | exact |
| `parity/fixtures/feature-probe.json` (`$comment` clause append + step tripwires) | test/fixture | — | v8.0.0 clause at line 5 (tail of `$comment`) + tripwire list at lines 74-83 | exact |
| `viewmodel-shell/test/list-row.test.ts` | test | — | `test/avatar-render.test.ts` (DOM/a11y/mutation) + `test/text-caption.test.ts` (stylesheet-load + computed-style AA-header) | exact |
| `viewmodel-shell/test/message.test.ts` + `message-followtail.test.ts` | test | — | `test/follow-tail.test.ts` (jsdom scrollHeight/clientHeight stubs + at-bottom/scrolled-up geometry) | exact |
| `viewmodel-shell/test/alert.test.ts` | test | — | `test/avatar-render.test.ts` structure (tone × mode matrix + AA hand-check header) | exact |
| `viewmodel-shell/test/empty-state.test.ts` (new; rename existing) | test | — | Existing feature-probe tests + `test/avatar-render.test.ts` centered-stack DOM assertions | exact |
| `viewmodel-shell-dotnet/Tests/ListRowNodeSerializationTests.cs`, `MessageNodeSerializationTests.cs`, `AlertNodeSerializationTests.cs`, `EmptyStateNodeSerializationTests.cs` | test | — | `Tests/AvatarNodeSerializationTests.cs` (byte-aligned WhenWritingNull + KebabEnum + discriminator asserts) | exact |
| `demo/Showcase/frontend/src/main.ts` (add "Primary Composites" section after Foundations) | demo | request-response | v8.0.0 Foundations section at `main.ts:254-320` | exact |
| `.planning/design/composite-nodes-layer.md` (grow "Shipped recipe inventory" table under §4c) | doc | — | Existing §4c "Composites (Phase 24 — primary)" free-form section — table replaces/augments the descriptions | partial |
| `AGENTS.md` (populate "Currently shipped recipes" inventory at line 744) | doc | — | Placeholder note at `AGENTS.md:744` (*"To be populated as Phases 24-26 land composite recipes"*) | placeholder — first-fill |
| `CHANGELOG.md` (append 4 entries under "Unreleased — v8.0.0") | doc | — | Existing block at `CHANGELOG.md:9-15` (Phase 23 additions) | exact |
| `MIGRATION.md` (add EmptyStateNode rename note + 3 additive notes) | doc | — | Prior MIGRATION.md entries for wire-changing releases | exact |

---

## 1. `viewmodel-shell/src/index.ts` — 4 new ViewNode types + `ListNode.variant` + EmptyStateNode rename

**Analog A — leaf-node + typed-slots template:** `AvatarNode` at `index.ts:1515-1583` (shipped Phase 23, freshest byte-aligned template). `IconNode` at `index.ts:1462-1514` for a purer leaf shape.

**Analog B — typed-slots with `string | ViewNode` fields:** No shipped node uses `string | ViewNode` slots yet; the closest is `ImageNode.caption` + `captionRuns` (two parallel fields), which is NOT the shape Phase 24 needs. **This phase INTRODUCES the `string | ViewNode` slot pattern** — the walker MUST branch on `typeof` in TS (`node.type` on ViewNode; string is a primitive). See §3 below for validator descent.

**Analog C — extending an existing node with a closed-union `variant?` field:** `ListNode.ordered?: boolean` at `index.ts:353-365` (the freshest additive to `ListNode`) + `CheckboxNode.variant?: "checkbox" | "switch"` shipped Phase 23 (COMP-03). Both are "grow the interface by appending an optional field with `[JsonIgnore(WhenWritingNull)]` on the .NET side."

**Analog D — ViewNode union entries:** `index.ts:180-210` (30 entries currently, alphabetical-ish grouping).

### Existing ListNode (index.ts:353-365) — the extension point for COMP-05a:

```typescript
export interface ListNode {
  type: "list";
  id?: string;
  /** When true, this is an ORDERED list — renders `<ol>` (numbered) instead of
   *  `<ul>`. ... */
  ordered?: boolean;
  children: ViewNode[];
}
```

### Existing EmptyStateNode (index.ts:1380-1388) — RENAMED by COMP-08:

```typescript
export interface EmptyStateNode {
  type: "empty-state";
  /** The primary line — what's missing / what to do. Required. */
  heading: string;                                  // ← RENAME to `title`
  /** Optional supporting line below the heading. */
  message?: string;                                 // ← RENAME to `description`
  /** Optional call-to-action button (e.g. "Add the first item"). */
  action?: ButtonNode;                              // ← STAYS
                                                    // ← ADD `icon?: IconName` + design allows description as `string` only
}
```

**What to copy for `ListRowNode` (COMP-05):**

```typescript
export interface ListRowNode {
  type: "list-row";
  /** Leading affordance — icon / badge / avatar / checkbox. Any ViewNode. */
  leading?: ViewNode;
  /** The semantically-primary content. Required. String is auto-wrapped in
   *  TextNode{style:"body", weight:"medium"} at render time (consumes COMP-02);
   *  a ViewNode is rendered as-is. */
  primary: string | ViewNode;
  /** Second-line typographically-subordinate. String → TextNode{style:"muted"}. */
  secondary?: string | ViewNode;
  /** Meta-line array — each entry is text-xs muted (caption tier).
   *  String entries auto-wrap in TextNode{style:"caption"} (consumes COMP-01). */
  meta?: (string | ViewNode)[];
  /** Right-aligned slot — timestamp, count, per-row actions. */
  trailing?: ViewNode;
  /** Semantic tone axis — left-accent border via `.vms-list-row--{tone}`. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Row lifecycle state axis (freeform; framework ships styling for
   *  active/done/disabled/high — mirrors ListItemNode.state). */
  state?: string;
  /** Whole-row click. Same shape as TableRow.action / SectionNode.action —
   *  role="button", tabIndex=0, Enter/Space dispatch, aria-label from
   *  primary+meta text. Interactive descendants stopPropagation. */
  action?: ActionEvent;
}
```

**What to copy for `MessageNode` + `MessageListNode` (COMP-06 + 06a):**

```typescript
export interface MessageNode {
  type: "message";
  /** Leading circular slot — typically an AvatarNode (COMP-04). */
  avatar?: ViewNode;
  /** Author display name. Trained: text-sm, weight 600. Required. */
  author: string;
  /** Timestamp. Trained: caption tier (COMP-01). */
  timestamp?: string;
  /** Content body. String → TextNode{style:"body"}; ViewNode rendered as-is.
   *  Wrapped in a padded surface with role-based background. Required. */
  content: string | ViewNode;
  /** Message role — controls surface tone. "assistant" tints info; others neutral. */
  role?: "user" | "assistant" | "system";
  /** Always-visible action bar (no hover-reveal — banked a11y). */
  actions?: ButtonNode[];
}

export interface MessageListNode {
  type: "message-list";
  /** MessageNode-only children; tree-validator rejects mixed. */
  children: MessageNode[];
  /** Reuses SectionNode.followTail's mechanism verbatim (browser.ts:227-372).
   *  data-follow-tail attribute drives the shipped at-bottom snapshot/restore.
   *  Absent/false = normal preserve-my-place scroll. */
  followTail?: boolean;
}
```

**What to copy for `AlertNode` (COMP-07):**

```typescript
export interface AlertNode {
  type: "alert";
  /** REQUIRED — the point of the node. Drives surface tint + border color +
   *  default icon (see §5 below). Closed union. */
  tone: "danger" | "warning" | "success" | "info";
  /** Trained: text-md, weight 600 (COMP-02 weight axis). */
  title?: string;
  /** Trained: text-sm muted. String → TextNode{style:"muted"}; ViewNode as-is. */
  message: string | ViewNode;
  /** Overrides the tone default (danger→x-circle, warning→alert-triangle,
   *  success→check-circle, info→info). Reuses v7.0.0 IconName. */
  icon?: IconName;
  /** Right-aligned action bar; default size="sm" per composite convention. */
  actions?: ButtonNode[];
  /** WhenWritingDefault posture on .NET side (bool). Renderer builds
   *  {name: "dismiss"} locally — deviates from ModalNode.dismissAction. */
  dismissible?: boolean;
}
```

**What to copy for `EmptyStateNode` RENAME (COMP-08):**

```typescript
export interface EmptyStateNode {
  type: "empty-state";
  /** Optional leading icon in a tinted-accent circle. New in v8.0. */
  icon?: IconName;
  /** Primary heading — the "nothing here" message. RENAMED from `heading` in v8.0. */
  title: string;
  /** Optional supporting line. RENAMED from `message` in v8.0. */
  description?: string;
  /** Optional call-to-action button. UNCHANGED from v7.x. */
  action?: ButtonNode;
}
```

**Also copy — extend `ListNode.variant`:**

```typescript
export interface ListNode {
  type: "list";
  id?: string;
  ordered?: boolean;
  /** Layout variant — omitted/"items" = today (byte-identical), "rows" =
   *  single-bordered-surface container that accepts ONLY ListRowNode children.
   *  Tree-validator rejects mixed children. Closed union. */
  variant?: "items" | "rows";
  children: ViewNode[];
}
```

**ViewNode union grows by 3** (list-row, message, message-list, alert) — EmptyStateNode already in the union at `index.ts:200`, no add needed there:

```typescript
export type ViewNode =
  | PageNode
  | SectionNode
  | ListNode
  | ListItemNode
  | ListRowNode                 // NEW (COMP-05)
  | MessageNode                 // NEW (COMP-06)
  | MessageListNode             // NEW (COMP-06a)
  | AlertNode                   // NEW (COMP-07)
  ...
  | EmptyStateNode              // EXISTING (COMP-08 renames fields, not the type)
  ...
```

---

## 2. `viewmodel-shell/src/browser.ts` — 4 new renderer arms + variant branch + emptyState rename

**Analog A — leaf renderer + slot rendering:** `private avatar()` at `browser.ts:4178-4221` (COMP-04, Phase 23 shipped) — the priority-branch pattern.

**Analog B — whole-row click + aria-label + Space/Enter dispatch:** `TableRow.action` block at `browser.ts:3689-3714` + `SectionNode.action` block at `browser.ts:1074-1111`.

**Analog C — stopPropagation on interactive descendants:** `SectionNode.action` sub-block at `browser.ts:1103-1111` (post-kids selector walk). Same shape as `TableRow.action` at `browser.ts:3725-3765`.

**Analog D — tinted-surface + tone-driven color palette (Alert):** `SectionNode` renderer at `browser.ts:1044-1057` + CSS at `default.css:443-446` (the `color-mix(in srgb, var(--vms-X) 14%, var(--vms-surface))` pattern).

**Analog E — the dismiss X button:** `ModalNode.dismissAction` at `browser.ts:3471-3479`.

**Analog F — leading-icon slot rendering (Alert + EmptyState):** every host node's icon slot — `button()` at `browser.ts:3208`, `link()` at `browser.ts:3329`, `section()` at `browser.ts:1066`. Each calls `this.renderIconSvg(name, size, tone, undefined)`.

**Analog G — string-or-ViewNode content branching:** NEW pattern. The renderer arm branches on `typeof primary === "string"`; if string, wrap in `TextNode` and re-dispatch through `this.node()`; if ViewNode, `this.node(primary, contentEl, on)` directly.

### 2a. `renderNode` switch arms — add 4 cases (browser.ts:535-580)

**Current switch, quoted** (browser.ts:565-566 + surrounding pattern):

```typescript
      case "icon":         return this.icon(n, parent);
      case "avatar":       return this.avatar(n, parent);
      ...
```

**What to copy:**

```typescript
      case "list-row":     return this.listRow(n, parent, on);
      case "message":      return this.message(n, parent, on);
      case "message-list": return this.messageList(n, parent, on);
      case "alert":        return this.alert(n, parent, on);
      // "empty-state" case is already present at browser.ts:558 — the arm's
      // BODY changes (field renames + icon addition) but the dispatch does not.
```

### 2b. `private listRow(n, parent, on)` — COMP-05 renderer

**Analog:** `listItem()` at `browser.ts:1124-1149` (state/tone class-name composition + icon slot) + `TableRow.action` at `browser.ts:3689-3714` (whole-row click + aria-label + stopPropagation).

**Current `listItem`, quoted:**

```typescript
  private listItem(n: ListItemNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const li = document.createElement("li");
    li.className = `vms-list-item${n.state ? ` vms-list-item--${n.state}` : ""}${
      n.tone ? ` vms-list-item--${n.tone}` : ""}${
      n.completed === true ? " vms-list-item--task-done" :
      n.completed === false ? " vms-list-item--task-todo" : ""}`;
    if (n.id) li.dataset.id = n.id;
    ...
    this.kids(n.children, li, on);
    parent.appendChild(li);
  }
```

**Current `TableRow.action` block, quoted (browser.ts:3689-3714):**

```typescript
      if (row.action) rowClass += " vms-table__row--clickable";
      tr.className = rowClass;
      if (row.id) tr.dataset.id = row.id;
      // row.action — click-anywhere + keyboard + ARIA.
      if (row.action) {
        const rowAction = row.action;
        tr.tabIndex = 0;
        tr.setAttribute("role", "button");
        const labelParts = Object.values(row.cells)
          .filter(v => v && v.trim())
          .map(v => v.trim());
        const ariaLabel = labelParts.length > 0
          ? labelParts.join(" · ")
          : (row.id ? `Row ${row.id}` : "");
        if (ariaLabel) tr.setAttribute("aria-label", ariaLabel);
        tr.addEventListener("click", () => { on(rowAction); });
        tr.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            on(rowAction);
          } else if (e.key === " " || e.key === "Spacebar") {
            e.preventDefault(); // suppress page scroll
            on(rowAction);
          }
        });
      }
```

**What to copy — new `listRow()`:**

```typescript
  private listRow(n: ListRowNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    // Emit <li> when parent is a list container; else <div> for standalone.
    // Detection: parent.classList.contains("vms-list") (checkbox() uses same
    // scoped-vs-standalone dispatch idiom — see field() vs standalone checkbox).
    const isInList = parent.classList.contains("vms-list") || parent.classList.contains("vms-list--rows");
    const el = document.createElement(isInList ? "li" : "div");
    const cls = ["vms-list-row"];
    if (!isInList) cls.push("vms-list-row-standalone");
    if (n.tone) cls.push(`vms-list-row--${n.tone}`);
    if (n.state) cls.push(`vms-list-row--${n.state}`);
    if (n.action) cls.push("vms-list-row--clickable");
    el.className = cls.join(" ");

    // Leading slot
    if (n.leading) {
      const lead = document.createElement("div");
      lead.className = "vms-list-row__leading";
      this.node(n.leading, lead, on);
      el.appendChild(lead);
    }

    // Content stack
    const content = document.createElement("div");
    content.className = "vms-list-row__content";

    // primary (string → TextNode; ViewNode → as-is)
    const primaryEl = document.createElement("div");
    primaryEl.className = "vms-list-row__primary";
    if (typeof n.primary === "string") {
      this.node({ type: "text", value: n.primary, style: "body", weight: "medium" }, primaryEl, on);
    } else {
      this.node(n.primary, primaryEl, on);
    }
    content.appendChild(primaryEl);

    // secondary (optional; string → TextNode)
    if (n.secondary != null) {
      const secEl = document.createElement("div");
      secEl.className = "vms-list-row__secondary";
      if (typeof n.secondary === "string") {
        this.node({ type: "text", value: n.secondary, style: "muted" }, secEl, on);
      } else {
        this.node(n.secondary, secEl, on);
      }
      content.appendChild(secEl);
    }

    // meta[] (each → caption; each in its own div per DOM shape in CONTEXT §1)
    for (const m of n.meta ?? []) {
      const metaEl = document.createElement("div");
      metaEl.className = "vms-list-row__meta";
      if (typeof m === "string") {
        this.node({ type: "text", value: m, style: "caption" }, metaEl, on);
      } else {
        this.node(m, metaEl, on);
      }
      content.appendChild(metaEl);
    }

    el.appendChild(content);

    // Trailing slot
    if (n.trailing) {
      const trail = document.createElement("div");
      trail.className = "vms-list-row__trailing";
      this.node(n.trailing, trail, on);
      el.appendChild(trail);
    }

    // Whole-row action — same shape as TableRow.action (browser.ts:3694-3714)
    if (n.action) {
      const action = n.action;
      el.tabIndex = 0;
      el.setAttribute("role", "button");
      // aria-label from flattened primary+meta text (banked from TableRow pattern)
      const ariaText = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
      if (ariaText) el.setAttribute("aria-label", ariaText);
      el.addEventListener("click", () => { on(action); });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") on(action);
        else if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); on(action); }
      });
      // stopPropagation on interactive descendants (same selectors as
      // SectionNode.action at browser.ts:1107-1110)
      el.querySelectorAll<HTMLElement>(
        ".vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, a[href]"
      ).forEach(ctrl => {
        ctrl.addEventListener("click", (e) => { e.stopPropagation(); });
      });
    }

    parent.appendChild(el);
  }
```

### 2c. `private list(n, parent, on)` — extend for `variant:"rows"` (browser.ts:1116-1122)

**Current, quoted:**

```typescript
  private list(n: ListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const ul = document.createElement(n.ordered ? "ol" : "ul");
    ul.className = `vms-list${n.ordered ? " vms-list--ordered" : ""}`;
    if (n.id) ul.id = n.id;
    this.kids(n.children, ul, on);
    parent.appendChild(ul);
  }
```

**What to copy:**

```typescript
  private list(n: ListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const ul = document.createElement(n.ordered ? "ol" : "ul");
    ul.className = `vms-list${n.ordered ? " vms-list--ordered" : ""}${n.variant === "rows" ? " vms-list--rows" : ""}`;
    if (n.id) ul.id = n.id;
    this.kids(n.children, ul, on);
    parent.appendChild(ul);
  }
```

Zero DOM structure change; a single className addition. Children still render through the existing `kids` walk — but `list-row` children detect they're in a `.vms-list--rows` parent via `isInList` in §2b (they emit `<li>`).

### 2d. `private message()` — COMP-06 renderer

**Analog:** `SectionNode` renderer at `browser.ts:1044-1113` (tinted-surface + heading + slot walk).

**What to copy:**

```typescript
  private message(n: MessageNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const wrap = document.createElement("div");
    const cls = ["vms-message"];
    if (n.role) cls.push(`vms-message--${n.role}`);
    wrap.className = cls.join(" ");

    // Avatar column
    const avatarEl = document.createElement("div");
    avatarEl.className = "vms-message__avatar";
    if (n.avatar) this.node(n.avatar, avatarEl, on);
    wrap.appendChild(avatarEl);

    // Body column
    const body = document.createElement("div");
    body.className = "vms-message__body";

    // Header row (author + timestamp)
    const header = document.createElement("div");
    header.className = "vms-message__header";
    const author = document.createElement("span");
    author.className = "vms-message__author";
    author.textContent = n.author;
    header.appendChild(author);
    if (n.timestamp) {
      const ts = document.createElement("span");
      ts.className = "vms-message__timestamp";
      ts.textContent = n.timestamp;
      header.appendChild(ts);
    }
    body.appendChild(header);

    // Content surface (string → TextNode{style:"body"}; ViewNode as-is)
    const content = document.createElement("div");
    content.className = "vms-message__content";
    if (typeof n.content === "string") {
      this.node({ type: "text", value: n.content, style: "body" }, content, on);
    } else {
      this.node(n.content, content, on);
    }
    body.appendChild(content);

    // Actions row (always-visible, right-aligned)
    if (n.actions && n.actions.length > 0) {
      const actions = document.createElement("div");
      actions.className = "vms-message__actions";
      for (const btn of n.actions) this.button(btn, actions, on);
      body.appendChild(actions);
    }

    wrap.appendChild(body);
    parent.appendChild(wrap);
  }
```

### 2e. `private messageList()` — COMP-06a renderer (🚨 REUSES SectionNode.followTail)

**🚨 CRITICAL — reuse the shipped `data-follow-tail` mechanism.** No new adapter code.

**The mechanism lives in three shipped spots in browser.ts:**

1. **Pre-render snapshot** (browser.ts:239-246, quoted):

```typescript
    // SectionNode.followTail — snapshot, in document order, whether each
    // append-only feed was scrolled near its bottom (and its prior scrollTop
    // for the scrolled-up case). Ordinal-matched to the post-render walk below.
    const followTail: Array<{ nearBottom: boolean; top: number }> = [];
    this.container.querySelectorAll<HTMLElement>("[data-follow-tail]").forEach(el => {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      followTail.push({
        nearBottom: distanceFromBottom <= FOLLOW_TAIL_STICK_THRESHOLD_PX,
        top: el.scrollTop,
      });
    });
```

2. **Skip generic scroll-map** (browser.ts:227-231):

```typescript
      // follow-tail elements own their own restore (see below) — the generic
      // preserve-the-prior-scrollTop contract is exactly what they must NOT do.
      if (el.hasAttribute("data-follow-tail")) return;
```

3. **Post-render restore** (browser.ts:362-372):

```typescript
    // SectionNode.followTail restore — runs AFTER the generic scrollMap restore
    // so it wins on any element carrying both an id and data-follow-tail. Walk
    // the rebuilt feeds in document order and match them to the pre-render
    // snapshot by ordinal: a feed that WAS near the bottom (or is brand new, no
    // snapshot at its ordinal) is pinned to the NEW bottom so freshly appended
    // content is visible; a feed the user had scrolled up in keeps its place.
    this.container.querySelectorAll<HTMLElement>("[data-follow-tail]").forEach((el, i) => {
      const snap = followTail[i];
      if (!snap || snap.nearBottom) el.scrollTop = el.scrollHeight;
      else el.scrollTop = snap.top;
    });
```

4. **Attribute emission** (browser.ts:1058-1062, the ONE line the renderer changes):

```typescript
    // SectionNode.followTail — mark this as an append-only feed so render()'s
    // snapshot/restore keeps its newest content in view (see render() + the
    // FOLLOW_TAIL_STICK_THRESHOLD_PX constant). No CSS/class — the scroll comes
    // from the element already being an overflow region (pair with fill).
    if (n.followTail === true) el.dataset.followTail = "";
```

**What to copy — `messageList()` sets the same attribute; zero new snapshot/restore code:**

```typescript
  private messageList(n: MessageListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const div = document.createElement("div");
    div.className = "vms-message-list";
    // MessageListNode.followTail — reuses SectionNode's shipped mechanism.
    // The pre-render snapshot at browser.ts:239-246 walks EVERY
    // [data-follow-tail] element in document order; the post-render restore at
    // browser.ts:362-372 pins each to its new bottom (or old scrollTop). NO
    // new adapter code — this line is the only change.
    if (n.followTail === true) div.dataset.followTail = "";
    // Tree-validator rejects non-MessageNode children server-side; the renderer
    // just walks children through the standard node() dispatch (which will
    // render each as message()). Trust the walker; belt-and-braces filter here
    // would be redundant.
    this.kids(n.children as unknown as ViewNode[], div, on);
    parent.appendChild(div);
  }
```

**Refactor DECISION:** the shipped follow-tail comments say "SectionNode.followTail" — the mechanism is really a generic "any element with `data-follow-tail`" scroll axis, and MessageListNode piggybacks. **Consider updating the comments at browser.ts:53-58, 234-238, 362-368, 1058-1062 to say `data-follow-tail` (not "SectionNode.followTail")** since Phase 24 makes it a shared mechanism. This is a small preparatory-comment task; the CODE stays identical.

### 2f. `private alert()` — COMP-07 renderer (tone→icon default + dismissible)

**Analog:** `SectionNode` tinted-surface pattern + `ModalNode.dismissAction` close-X at `browser.ts:3471-3479` (quoted below).

**Modal close-X, quoted (browser.ts:3471-3479):**

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

**What to copy — new `alert()`:**

```typescript
  // Tone → default icon (baked into browser; overridable via n.icon).
  // Frozen table matches CONTEXT §5.
  private static readonly ALERT_TONE_ICON: Record<
    "danger"|"warning"|"success"|"info", IconName
  > = {
    danger: "x-circle",
    warning: "alert-triangle",
    success: "check-circle",
    info: "info",
  };

  private alert(n: AlertNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const wrap = document.createElement("div");
    wrap.className = `vms-alert vms-alert--${n.tone}`;

    // Icon slot — n.icon overrides; else tone default.
    const iconName = n.icon ?? BrowserAdapter.ALERT_TONE_ICON[n.tone];
    const iconWrap = document.createElement("div");
    iconWrap.className = "vms-alert__icon";
    iconWrap.appendChild(this.renderIconSvg(iconName, "md", undefined, undefined));
    wrap.appendChild(iconWrap);

    // Body — title + message
    const body = document.createElement("div");
    body.className = "vms-alert__body";
    if (n.title) {
      const title = document.createElement("div");
      title.className = "vms-alert__title";
      // Trained: body-weight-medium at md size (per CONTEXT §5).
      this.node({ type: "text", value: n.title, style: "body", weight: "medium" }, title, on);
      body.appendChild(title);
    }
    const message = document.createElement("div");
    message.className = "vms-alert__message";
    if (typeof n.message === "string") {
      this.node({ type: "text", value: n.message, style: "muted" }, message, on);
    } else {
      this.node(n.message, message, on);
    }
    body.appendChild(message);
    wrap.appendChild(body);

    // Actions column — right-aligned buttons + optional dismiss X
    if ((n.actions && n.actions.length > 0) || n.dismissible === true) {
      const actionsEl = document.createElement("div");
      actionsEl.className = "vms-alert__actions";
      for (const btn of n.actions ?? []) this.button(btn, actionsEl, on);
      if (n.dismissible === true) {
        // Emit fixed action name "dismiss" (CONTEXT §5 deviation from
        // ModalNode.dismissAction — Alert emits the name locally rather than
        // accepting a caller-supplied ActionEvent slot).
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "vms-alert__dismiss";
        closeBtn.setAttribute("aria-label", "Dismiss");
        closeBtn.textContent = "✕";
        closeBtn.addEventListener("click", () => on({ name: "dismiss" }));
        actionsEl.appendChild(closeBtn);
      }
      wrap.appendChild(actionsEl);
    }

    parent.appendChild(wrap);
  }
```

### 2g. `private emptyState()` — RENAME + icon addition (browser.ts:3969-3988)

**Current, quoted:**

```typescript
  private emptyState(n: EmptyStateNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const el = document.createElement("div");
    el.className = "vms-empty-state";

    const heading = document.createElement("div");
    heading.className = "vms-empty-state__heading";
    heading.textContent = n.heading;
    el.appendChild(heading);

    if (n.message != null && n.message !== "") {
      const msg = document.createElement("div");
      msg.className = "vms-empty-state__message";
      msg.textContent = n.message;
      el.appendChild(msg);
    }

    if (n.action) this.button(n.action, el, on);

    parent.appendChild(el);
  }
```

**What to copy — the field-rename + icon addition (matches tasting page verbatim):**

```typescript
  private emptyState(n: EmptyStateNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const el = document.createElement("div");
    el.className = "vms-empty-state";

    // NEW in v8.0 — tinted-circle icon backdrop. Renders <div class="vms-empty-state__icon">
    // wrapping an <svg class="vms-icon vms-icon--lg">. CSS ships the 3rem × 3rem
    // circle + accent-tinted background per the tasting mockup.
    if (n.icon) {
      const iconWrap = document.createElement("div");
      iconWrap.className = "vms-empty-state__icon";
      iconWrap.appendChild(this.renderIconSvg(n.icon, "lg", undefined, undefined));
      el.appendChild(iconWrap);
    }

    // RENAMED: `heading` → `title`
    const title = document.createElement("div");
    title.className = "vms-empty-state__title";
    title.textContent = n.title;
    el.appendChild(title);

    // RENAMED: `message` → `description`
    if (n.description != null && n.description !== "") {
      const desc = document.createElement("div");
      desc.className = "vms-empty-state__description";
      desc.textContent = n.description;
      el.appendChild(desc);
    }

    if (n.action) this.button(n.action, el, on);

    parent.appendChild(el);
  }
```

---

## 3. `viewmodel-shell/src/server.ts` — walker arms + validator arms

**Analog A — leaf-node walker arm (AvatarNode / IconNode):** `case "avatar"` at `server.ts:201-207` (leaf, no descent). Not applicable to Phase 24 — every composite has ViewNode-typed slots.

**Analog B — walker with typed slot descent:** `case "empty-state"` at `server.ts:283-291` (descends into `.action`) is the closest but the simplest — only one slot. `case "modal"` at `server.ts:213-221` is the richer template (multiple typed slots: children + footer + dismissAction).

**Modal walker arm, quoted (server.ts:213-221):**

```typescript
    case "modal": {
      const modal = node as ModalNode;
      if (modal.dismissAction) recordAction(modal.dismissAction, enclosingForm, out);
      for (const child of modal.children) collectActions(child, enclosingForm, out);
      if (modal.footer) {
        for (const child of modal.footer) collectActions(child, enclosingForm, out);
      }
      return;
    }
```

**Empty-state walker arm, quoted (server.ts:283-291):**

```typescript
    case "empty-state": {
      // EmptyStateNode.action is an optional ButtonNode carrying a real action
      // name. It is a dispatch-bearing descendant, so the uniqueness collector
      // MUST descend into it — otherwise the CTA is silently exempt from the
      // one-name-one-operation rule (the 3.3.0 missed-walk failure class).
      const es = node as EmptyStateNode;
      if (es.action) collectActions(es.action, enclosingForm, out);
      return;
    }
```

**What to copy — new arms:**

```typescript
    case "list-row": {
      // ListRowNode slots: leading, primary/secondary/meta[]/trailing (any
      // ViewNode subtree), action (whole-row click).
      // string | ViewNode slots: only descend when the value is a ViewNode —
      // guard with `typeof x !== "string"` (mirrors the "avatar is a leaf"
      // guard pattern of one-value-two-shapes).
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
      // Whole-row action — same shape as TableRow.action recording (participates
      // in name uniqueness).
      if (lr.action) recordAction(lr.action, enclosingForm, out);
      return;
    }
    case "message": {
      const m = node as MessageNode;
      if (m.avatar) collectActions(m.avatar, enclosingForm, out);
      if (typeof m.content !== "string") collectActions(m.content, enclosingForm, out);
      for (const btn of m.actions ?? []) collectActions(btn, enclosingForm, out);
      return;
    }
    case "message-list": {
      // MessageListNode.children are MessageNode[] — the validator (below) will
      // reject non-Message entries. Descend into every one.
      const ml = node as MessageListNode;
      for (const child of ml.children) collectActions(child, enclosingForm, out);
      return;
    }
    case "alert": {
      const a = node as AlertNode;
      if (typeof a.message !== "string") collectActions(a.message, enclosingForm, out);
      for (const btn of a.actions ?? []) collectActions(btn, enclosingForm, out);
      // dismissible: true emits {name:"dismiss"} client-side — the server tree
      // does NOT carry an ActionEvent, so nothing to record here. This is why
      // the wire shape is `dismissible?: boolean` (§5 deviation from Modal).
      return;
    }
    // "empty-state" case at server.ts:283-291 gets a light UPDATE: no descent
    // change needed (it still descends into `action`), but the comment above
    // mentions the field rename for future readers.
```

**Also — the `walkForSectionAction` (interactive-section nesting) validator at `server.ts:380-521`:**
Every new composite arm is a passthrough (no SectionNode descendants); mirror the `case "empty-state"` at `server.ts:502-509` shape — descend into the action / avatar / content ViewNode slots so a future shape can't slip an interactive section in. Same passthrough posture as IconNode / AvatarNode leaves at server.ts:195-207.

**Tree-shape validators (NEW — enforce composite invariants):**

Per CONTEXT §7, three new tree-invariant rules go into the framework's validation path:
1. `ListNode(variant:"rows")` rejects mixed children (must all be `list-row`).
2. `MessageListNode` rejects non-MessageNode children.
3. AlertNode requires `tone` (already enforced at the type level — the field is required in the interface).

Consider adding these to `walkForSectionAction` (or a new `walkForCompositeInvariants` walker — planner picks). The existing `IconOnlyButtonValidatorTests.cs` at `Tests/IconOnlyButtonValidatorTests.cs` is the .NET-side template (a walker predicate that throws `invalid_tree` with a byte-identical error message across both backends).

**.NET twin walker arms:** mirror the above in `ViewModels.cs:2267-2415` `Collect` + `2149-2264` `WalkForSectionAction`. Every new arm uses the `is not null` C# pattern-match idiom already established (see AvatarNode arm at 2249-2253, EmptyStateNode at 2236-2241, 2400-2406).

---

## 4. `viewmodel-shell/styles/default.css` — 4 new class blocks + emptyState field rename

**Analog A — the tasting page CSS is the visual target verbatim.** Every mockup rule at `bounties/composite-nodes-layer/tasting-page/index.html:135-345` (extracted §COMPOSITE-1..4) is the shipped mock; the framework CSS is byte-for-byte the same except for `.mockup ` prefix removal.

**Analog B — tinted surface via color-mix (Alert):** `default.css:443-446`:

```css
.vms-section--danger  { background: color-mix(in srgb, var(--vms-error) 14%, var(--vms-surface));   border: 1px solid var(--vms-error); }
.vms-section--warning { background: color-mix(in srgb, var(--vms-warning) 14%, var(--vms-surface)); border: 1px solid var(--vms-warning); }
.vms-section--success { background: color-mix(in srgb, var(--vms-success) 14%, var(--vms-surface)); border: 1px solid var(--vms-success); }
.vms-section--info    { background: color-mix(in srgb, var(--vms-info) 14%, var(--vms-surface));    border: 1px solid var(--vms-info); }
```

**Analog C — existing empty-state block (default.css:1975-1997) is REPLACED verbatim** (per CONTEXT §6 the composite absorbs the shipped block, growing icon + renaming to `__title`/`__description`).

**What to copy — full CSS block for Phase 24 (verbatim from tasting page, prefix-stripped):**

```css
/* ── ListRowNode (COMP-05, v8.0.0) ─────────────────────────────────────────
   A dense, single-surface list. Grid: [leading | content | trailing].
   Content stack is 3-tier typography (primary/secondary/meta). Left border
   encodes tone. Per-row dividers inside a single card via +sibling border-top. */
.vms-list--rows {
  list-style: none;
  gap: 0;
  padding: 0;
  margin: 0;
  background: var(--vms-surface);
  border: 1px solid var(--vms-border);
  border-radius: var(--vms-radius);
  overflow: hidden;
}
.vms-list-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--vms-space-sm);
  align-items: start;
  padding: var(--vms-space-sm) var(--vms-space-md);
  border-top: 1px solid var(--vms-border);
  border-left: 3px solid transparent;
  transition: background var(--vms-t);
}
.vms-list--rows > .vms-list-row:first-child { border-top: none; }
.vms-list-row--clickable { cursor: pointer; }
.vms-list-row--clickable:hover { background: color-mix(in srgb, var(--vms-accent) 4%, transparent); }
.vms-list-row--clickable:focus-visible { outline: 2px solid var(--vms-accent); outline-offset: -2px; }
.vms-list-row--danger  { border-left-color: var(--vms-error); }
.vms-list-row--warning { border-left-color: var(--vms-warning); }
.vms-list-row--success { border-left-color: var(--vms-success); }
.vms-list-row--info    { border-left-color: var(--vms-info); }
.vms-list-row--done { opacity: .72; }
.vms-list-row--disabled { opacity: .55; }
.vms-list-row--active { background: var(--vms-accent-glow); }

.vms-list-row__leading { display: flex; align-items: center; padding-top: 1px; }
.vms-list-row__content { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.vms-list-row__primary   { font-size: var(--vms-text-md); font-weight: 500; color: var(--vms-text); line-height: 1.35; overflow-wrap: anywhere; }
.vms-list-row__secondary { font-size: var(--vms-text-sm); color: var(--vms-text-muted); line-height: 1.4; }
.vms-list-row__meta      { font-size: var(--vms-text-xs); color: var(--vms-text-muted); opacity: .85; line-height: 1.4; }
.vms-list-row__trailing  { font-size: var(--vms-text-sm); color: var(--vms-text-muted); padding-top: 2px; white-space: nowrap; }
.vms-list-row-standalone { display: grid; grid-template-columns: auto 1fr auto; /* ... */ }

/* ── MessageNode + MessageListNode (COMP-06, COMP-06a, v8.0.0) ────────────
   Chat/comment. Grid: [avatar | body]. Body = header row (author + timestamp)
   + padded content surface + optional action bar. role controls surface tone. */
.vms-message-list { display: flex; flex-direction: column; gap: var(--vms-space-md); }
.vms-message {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--vms-space-sm);
  align-items: start;
}
.vms-message__avatar { flex-shrink: 0; }
.vms-message__body   { min-width: 0; }
.vms-message__header { display: flex; align-items: baseline; gap: .5rem; margin-bottom: .25rem; }
.vms-message__author { font-size: var(--vms-text-sm); font-weight: 600; color: var(--vms-text); }
.vms-message__timestamp { font-size: var(--vms-text-xs); color: var(--vms-text-muted); opacity: .85; }
.vms-message__content {
  font-size: var(--vms-text-md);
  line-height: 1.55;
  color: var(--vms-text);
  background: var(--vms-surface);
  border: 1px solid var(--vms-border);
  border-radius: var(--vms-radius);
  padding: var(--vms-space-sm) var(--vms-space-md);
}
.vms-message--assistant .vms-message__content {
  background: color-mix(in srgb, var(--vms-info) 6%, var(--vms-surface));
  border-color: color-mix(in srgb, var(--vms-info) 25%, var(--vms-border));
}
.vms-message__actions { display: flex; gap: var(--vms-space-xs); justify-content: flex-end; margin-top: var(--vms-space-xs); }

/* ── AlertNode (COMP-07, v8.0.0) ──────────────────────────────────────────
   Prominent status message. Grid: [icon | body | actions]. Title semi-bold,
   message muted. Tone controls color palette + default icon (baked in
   browser.ts:ALERT_TONE_ICON). */
.vms-alert {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--vms-space-md);
  align-items: start;
  padding: var(--vms-space-sm) var(--vms-space-md);
  border-radius: var(--vms-radius);
  border: 1px solid transparent;
}
.vms-alert--danger  { background: color-mix(in srgb, var(--vms-error) 8%, var(--vms-surface));   border-color: color-mix(in srgb, var(--vms-error) 30%, var(--vms-border)); }
.vms-alert--warning { background: color-mix(in srgb, var(--vms-warning) 10%, var(--vms-surface)); border-color: color-mix(in srgb, var(--vms-warning) 30%, var(--vms-border)); }
.vms-alert--success { background: color-mix(in srgb, var(--vms-success) 8%, var(--vms-surface)); border-color: color-mix(in srgb, var(--vms-success) 30%, var(--vms-border)); }
.vms-alert--info    { background: color-mix(in srgb, var(--vms-info) 8%, var(--vms-surface));    border-color: color-mix(in srgb, var(--vms-info) 30%, var(--vms-border)); }
.vms-alert__icon { flex-shrink: 0; padding-top: 2px; display: flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; }
.vms-alert--danger  .vms-alert__icon { color: var(--vms-error); }
.vms-alert--warning .vms-alert__icon { color: var(--vms-warning); }
.vms-alert--success .vms-alert__icon { color: var(--vms-success); }
.vms-alert--info    .vms-alert__icon { color: var(--vms-info); }
.vms-alert__body { min-width: 0; }
.vms-alert__title   { font-size: var(--vms-text-md); font-weight: 600; color: var(--vms-text); line-height: 1.35; margin: 0 0 2px; }
.vms-alert__message { font-size: var(--vms-text-sm); color: var(--vms-text-muted); line-height: 1.5; }
.vms-alert__actions { display: flex; gap: .375rem; align-items: center; padding-top: 1px; }
.vms-alert__dismiss { background: transparent; border: none; color: inherit; cursor: pointer; padding: 4px; font-size: 1rem; line-height: 1; }
.vms-alert__dismiss:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }

/* ── EmptyStateNode (COMP-08, v8.0.0) — REPLACES the shipped block at :1975-1997
   with an icon-bearing, tinted-circle rendition per the tasting mockup. Field
   names change: __heading → __title, __message → __description. */
.vms-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 2.5rem 1.5rem;
  gap: .75rem;
  color: var(--vms-text-muted);
}
.vms-empty-state__icon {
  width: 3rem; height: 3rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--vms-accent) 12%, transparent);
  color: var(--vms-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: .25rem;
}
.vms-empty-state__icon svg { width: 1.5rem; height: 1.5rem; }
.vms-empty-state__title {
  font-family: var(--vms-font-head);
  font-size: var(--vms-text-lg);
  font-weight: 600;
  color: var(--vms-text);
  margin: 0;
}
.vms-empty-state__description {
  font-size: var(--vms-text-sm);
  color: var(--vms-text-muted);
  line-height: 1.55;
  max-width: 28rem;
  margin: 0;
}
.vms-empty-state .vms-button { align-self: center; margin-top: var(--vms-space-sm); }
```

**AA-contrast hand-check checklist** (banked from Phase 23 + CONTEXT §9):

- **AlertNode:** for each `tone` (4) × default + 12 themes × { title text, message text, icon glyph, action button } = 4 × 13 × 4 = **208 pair-checks.** WCAG AA-normal 4.5:1 for text; 3:1 for icon glyph (WCAG UI-state). Where the tinted surface drops below AA, deepen via `color-mix` toward `var(--vms-text)` (the shipped v3.5.0 pattern; the .vms-text--caption Phase 23 test file at test/text-caption.test.ts:29-52 is the format template).
- **MessageNode:** `--vms-info 6%` tinted-info content surface × body text × 13 themes = 13 pair-checks. Same target.
- **ListRowNode:** `.vms-list-row--clickable:hover` (color-mix accent 4%) × row primary/secondary/meta text × 13 themes = 39 pair-checks.
- **EmptyStateNode:** `.vms-empty-state__icon` (accent 12% tinted circle) × icon glyph color (accent) × 13 themes = 13 pair-checks (glyph is graphical → 3:1).

Document per-composite in each test file's AA hand-check header (mirror Phase 23 `test/text-caption.test.ts:23-52` and `test/avatar-render.test.ts:12-65`).

---

## 5. `viewmodel-shell-dotnet/ViewModels.cs` — .NET twins + walker arms

**Analog A — freshest record + enum + JsonDerivedType template:** `AvatarNode` at `ViewModels.cs:2030-2049` (Phase 23 shipped) + `AvatarSize` enum implicitly reused. The `[JsonDerivedType]` registration is at `ViewModels.cs:781`.

**Analog B — nullable-typed slots with polymorphic emission:** `EmptyStateNode.Action` at `ViewModels.cs:1946` — uses `ViewNode?` (NOT concrete `ButtonNode`) so `System.Text.Json` emits the polymorphic `"type":"button"` discriminator. **CRITICAL RULE — carry forward.** Every ViewNode-typed slot on the new composites (`ListRowNode.Leading/Primary/Secondary/Meta/Trailing`, `MessageNode.Avatar/Content`, `AlertNode.Message`, `EmptyStateNode.Action`) MUST be typed `ViewNode?` (not the narrow shape) or the discriminator vanishes.

**Analog C — `string | ViewNode` on the .NET side:** No prior shipped example. **Options:**
- **(a) Type as `ViewNode?`** and require the .NET server to explicitly wrap a string as `new TextNode(...)`. Loses the ergonomic convenience of `Primary: "Hello"` but keeps the .NET type simple.
- **(b) Type as `object?`** + a custom converter that emits string-as-string / ViewNode-as-discriminated-json. Higher machinery.
- **CONTEXT does NOT force this decision** — planner picks. Recommendation: **(a) `ViewNode?`** for byte-alignment ease. The TS twin's `string | ViewNode` is a convenience; the .NET twin's `ViewNode?` forces the consumer to write `new TextNode("Hello", Style: TextStyle.Body, Weight: TextWeight.Medium)` — LOSS OF ERGONOMICS on that side, but the wire is byte-identical. The bun/node backends can still take `string` via the TS interface. Document the asymmetry.

**Analog D — closed union + `[JsonIgnore(WhenWritingDefault)]` on optional non-nullable bool:** `SectionNode.FollowTail` on the .NET side (found `ViewModels.cs:999` per the search). This is the exact posture `AlertNode.Dismissible` and `MessageListNode.FollowTail` need.

**Current EmptyStateNode, quoted (ViewModels.cs:1938-1949) — RENAMED:**

```csharp
public record EmptyStateNode(
    string Heading,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Message = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Action = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tooltip = null
) : ViewNode;
```

**Current AvatarNode, quoted (ViewModels.cs:2030-2049) — the leaf-record template:**

```csharp
public record AvatarNode(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Initials = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Image = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] AvatarSize? Size = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Alt = null
) : ViewNode;
```

**What to copy — new records:**

```csharp
// ── COMP-05 ListRowNode ──
public record ListRowNode(
    // Primary is REQUIRED — the semantically-primary content per §3 of the
    // design doc. Typed ViewNode? (see PATTERNS.md §5 Analog C — a string
    // convenience is TS-only; the .NET server wraps with `new TextNode(...)`.
    ViewNode Primary,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Leading = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Secondary = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ViewNode>? Meta = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Trailing = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null
) : ViewNode;

// ── COMP-06 MessageNode ──
[JsonConverter(typeof(KebabEnum<MessageRole>))]
public enum MessageRole { User, Assistant, System }

public record MessageNode(
    string Author,                              // required per §3
    ViewNode Content,                            // required
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Avatar = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Timestamp = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] MessageRole? Role = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ButtonNode>? Actions = null
) : ViewNode;

// ── COMP-06a MessageListNode ──
public record MessageListNode(
    IReadOnlyList<MessageNode> Children,
    // WhenWritingDefault posture on a non-nullable bool — matches SectionNode.FollowTail
    // at ViewModels.cs:999. `false` = ABSENT on the wire.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool FollowTail = false
) : ViewNode;

// ── COMP-07 AlertNode ──
public record AlertNode(
    // Tone is REQUIRED (not nullable) — the point of the node per §3.
    Tone Tone,
    ViewNode Message,                            // required
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Title = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ButtonNode>? Actions = null,
    // WhenWritingDefault — matches SectionNode.FollowTail posture.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Dismissible = false
) : ViewNode;

// ── COMP-08 EmptyStateNode RENAME ──
public record EmptyStateNode(
    string Title,                                // RENAMED from Heading
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,   // NEW
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Description = null, // RENAMED from Message
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Action = null   // UNCHANGED
) : ViewNode;
```

**Also — register discriminators at ViewModels.cs:751-782 (append 3 rows):**

```csharp
[JsonDerivedType(typeof(ListRowNode),     "list-row")]
[JsonDerivedType(typeof(MessageNode),     "message")]
[JsonDerivedType(typeof(MessageListNode), "message-list")]
[JsonDerivedType(typeof(AlertNode),       "alert")]
```

**Extend ListNode with `Variant`** (currently at `ViewModels.cs` around the ListNode record — search for it):

```csharp
[JsonConverter(typeof(KebabEnum<ListVariant>))]
public enum ListVariant { Items, Rows }

// APPEND `Variant` field to the ListNode record (positional, at the end for
// zero-retype construction sites — same convention as CheckboxNode.Variant
// Phase 23).
public record ListNode(
    ...existing fields...,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ListVariant? Variant = null
) : ViewNode;
```

**Walker arm additions (ViewModels.cs:2267-2415 `Collect` + 2149-2264 `WalkForSectionAction`)** — mirror the TS shape in §3 above. Every ViewNode-typed slot descended into; `Action`/`Actions` recorded for name uniqueness. Modal.DismissAction walker arm at `ViewModels.cs:2348-2355` is the closest template.

---

## 6. `demo/FeatureProbe-bun/handler.ts` — `primaryCompositesSection` extension

**Analog:** `foundationsSection` at `handler.ts:1066-1104` (Phase 23 shipped; the direct template).

**Fixture-adds pattern, quoted (handler.ts:1043-1104):**

The v8.0.0 Foundations block above is the template. What to copy — add a `primaryCompositesSection` right after `foundationsSection`, appended into `pageChildren` at handler.ts:1255-1257.

**What to emit — minimum branch coverage per CONTEXT §8:**

```typescript
  const primaryCompositesSection: ViewNode = {
    type: "section",
    heading: "v8.0.0 Primary Composites",
    variant: "card",
    children: [
      // ── COMP-05 ListRowNode (standalone + in ListNode(variant:"rows")) ────
      {
        type: "list-row",
        primary: "Order #42 · Ada Lovelace",
        secondary: "Awaiting fulfillment · flagged high priority",
        meta: ["Placed 2h ago", "priority: high", "channel: web"],
        tone: "warning",
        state: "high",
        action: { name: "list-row-open-42" },   // unique action name for name-uniqueness walker
      },
      {
        type: "list",
        variant: "rows",
        children: [
          {
            type: "list-row",
            leading: { type: "avatar", initials: "AL", tone: "success" },
            primary: "Refunded successfully",
            secondary: "Refund ID rf_39a2 · $124.00",
            meta: ["7m ago"],
            tone: "success",
            state: "done",
            trailing: { type: "badge", label: "COMPLETE", tone: "success" },
          },
          {
            type: "list-row",
            primary: "Payment declined",
            meta: ["issuer decline", "card ending 4321"],
            tone: "danger",
          },
        ],
      },
      // ── COMP-06 MessageNode + COMP-06a MessageListNode (followTail:true) ──
      {
        type: "message-list",
        followTail: true,   // WhenWritingDefault → present as literal `true` on the wire
        children: [
          {
            type: "message",
            author: "Ada Lovelace",
            timestamp: "2:14 PM",
            content: "Can we ship v8 this week?",
            avatar: { type: "avatar", initials: "AL", tone: "success" },
            role: "user",
          },
          {
            type: "message",
            author: "VMS Assistant",
            timestamp: "2:15 PM",
            content: "The Phase 24 branch is green; publishing to npm + NuGet is a maintainer step.",
            avatar: { type: "avatar", icon: "sparkles", tone: "info" },
            role: "assistant",
            actions: [
              { type: "button", label: "OK", action: { name: "message-noop-1" } },
            ],
          },
        ],
      },
      // ── COMP-07 AlertNode (per tone + dismissible) ──
      { type: "alert", tone: "warning", title: "Storage almost full", message: "You've used 92% of your quota.", dismissible: true },
      { type: "alert", tone: "danger",  title: "Payment declined",    message: "Your card was refused." },
      { type: "alert", tone: "success", title: "Refund processed",    message: "Refund of $124 issued." },
      { type: "alert", tone: "info",    title: "New version",         message: "v8.0.0 is available." },
      // ── COMP-08 EmptyStateNode (icon + renamed title/description) ──
      {
        type: "empty-state",
        icon: "inbox",
        title: "No orders yet",
        description: "Once customers place orders they'll show up here.",
        action: { type: "button", label: "Learn more", action: { name: "empty-state-cta-probe" } },
      },
    ],
  };
```

**Wire-in step:** insert `primaryCompositesSection` into the `pageChildren` array at `handler.ts:1255-1257`, after `foundationsSection`.

**Same shape mirrored in .NET twin `FeatureProbeController.cs`** (append after the `v8.0.0 Foundations` section at line 1163+):

```csharp
        pageChildren.Add(new SectionNode(
            Heading: "v8.0.0 Primary Composites",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                // COMP-05 ListRowNode
                new ListRowNode(
                    Primary: new TextNode("Order #42 · Ada Lovelace", Style: TextStyle.Body, Weight: TextWeight.Medium),
                    Secondary: new TextNode("Awaiting fulfillment · flagged high priority", Style: TextStyle.Muted),
                    Meta: new ViewNode[] {
                        new TextNode("Placed 2h ago", Style: TextStyle.Caption),
                        new TextNode("priority: high", Style: TextStyle.Caption),
                    },
                    Tone: Tone.Warning,
                    State: "high",
                    Action: new ActionDescriptor("list-row-open-42")),
                // ...remaining composites mirrored 1:1 with bun...
            }));
```

---

## 7. `parity/fixtures/feature-probe.json` — `$comment` clause append + tripwires

**Analog:** the v8.0.0 (COMP-01..COMP-04) clause at the tail of the giant `$comment` string at line 5, plus the existing tripwires at lines 74-83 (`"style":"caption"`, `"variant":"switch"`, `"type":"avatar"`, `"size":"xl"`, `"initials":"AL"`, `"tone":"success"`, `"image":"..."`, `"icon":"user"`).

**Pattern for the append:** the last sentence of the v8.0.0 Foundations clause is `NOTE: the CLIENT-SIDE rendering ... is browser-only and NOT part of parity...` — the composite clause follows the same tail structure.

**What to append — a Primary-Composites clause to the `$comment` (at the end, before the trailing `"`):**

```
v8.0.0 (COMP-05..COMP-08, primary composites): buildVm renders a 'Primary Composites' section covering the four primaries. LIST-ROW: one standalone ListRowNode with all slots populated (leading avatar + primary/secondary/meta[]/trailing badge + tone:"warning" + state:"high" + action name list-row-open-42 for name-uniqueness walker descent proof), plus a ListNode(variant:"rows") wrapper containing two ListRowNodes (proves variant:"rows" and the container-vs-standalone dispatch). MESSAGE + MESSAGE-LIST: a MessageListNode with followTail:true (proves the WhenWritingDefault posture emits the literal boolean true on the wire — false is absent), containing two MessageNodes with different roles (user + assistant, proves the role closed union crosses) and full avatar + timestamp + content + actions slots. ALERT: one AlertNode per tone (danger/warning/success/info) with title + message + one dismissible:true variant (proves the WhenWritingDefault posture on the .NET side, matching the TS optional boolean posture; dismiss button emits {name:"dismiss"} at click time which parity does not exercise — proof is the wire-shape byte-diff). EMPTY-STATE: one EmptyStateNode with the RENAMED fields (title/description replace the old heading/message) + the NEW icon slot ("inbox") + action button with UNIQUE name empty-state-cta-probe (proves the action-name walk descends through the renamed shape). Captured by the existing GET steps; the initial step's expectBodyContains asserts "type":"list-row", "type":"message", "type":"message-list", "type":"alert", "type":"empty-state", "role":"assistant", "followTail":true, "dismissible":true, "variant":"rows", "title":"No orders yet", "description":"Once customers place orders they'll show up here." cross (coverage tripwires so each branch can't go vacuous — banked lesson: a diff can only prove things about code it actually RUNS). NOTE: the CLIENT-SIDE rendering (grid layout, follow-tail scroll pinning via data-follow-tail reuse, dismiss button click emission, icon SVG payload via renderIconSvg, tinted-surface color-mix palettes) is browser-only and NOT part of parity — parity proves only that the fields serialize identically across backends.
```

**What to append — tripwires to the `initial` step's `expectBodyContains` array (currently ends at line 84):**

```json
"\"type\":\"list-row\"",
"\"type\":\"message\"",
"\"type\":\"message-list\"",
"\"type\":\"alert\"",
"\"type\":\"empty-state\"",
"\"role\":\"assistant\"",
"\"followTail\":true",
"\"dismissible\":true",
"\"variant\":\"rows\"",
"\"title\":\"No orders yet\"",
"\"description\":\"Once customers place orders they'll show up here.\"",
"\"tone\":\"warning\"",
"\"state\":\"high\"",
"list-row-open-42",
"empty-state-cta-probe"
```

**Each tripwire is a substring only ITS branch emits** (mutation-testable — if the backend serializes a field as null, drops the field, or fails to descend, the step FAILS LOUDLY per `parity/run.ts:318-329`).

**Note on false-positive risk:** `"tone":"warning"` and `"state":"high"` already exist elsewhere in the tree (from other sections). The list-row-open-42 / empty-state-cta-probe unique names guarantee the ListRow / EmptyState branches actually ran; `"title":"No orders yet"` / `"description":"Once customers..."` are the EmptyState-branch-specific tripwires.

**`parity/run.ts` needs NO change** — tripwires live in the fixture, not the runner.

---

## 8. Vitest tests — 4 new files + refactor existing empty-state test

**Analog A — DOM/a11y assertion + AA hand-check header:** `test/avatar-render.test.ts` (has ~65 lines of AA-contrast hand-check computed for default + 12 themes, then jsdom assertions). This is the template for `list-row.test.ts` / `message.test.ts` / `alert.test.ts` / `empty-state.test.ts`.

**Analog B — follow-tail scroll-pin mechanics with jsdom stubs:** `test/follow-tail.test.ts` (the direct template for `message-followtail.test.ts` — Phase 24 REUSES the same `data-follow-tail` mechanism, so the test asserts the same at-bottom/scrolled-up behavior on a `<div class="vms-message-list" data-follow-tail>` element instead of `<section>`).

**test/follow-tail.test.ts jsdom pattern, quoted (lines 15-48):**

```typescript
const SCROLL_HEIGHT = 2000;
const CLIENT_HEIGHT = 300;
const BOTTOM = SCROLL_HEIGHT - CLIENT_HEIGHT; // 1700 — scrollTop when at the bottom

let origScrollHeight: PropertyDescriptor | undefined;
let origClientHeight: PropertyDescriptor | undefined;

beforeEach(() => {
  origScrollHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
  origClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() { return SCROLL_HEIGHT; },
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() { return CLIENT_HEIGHT; },
  });
  ...
});
```

**Analog C — stylesheet-load pattern for CSS-computed-style tests:** `test/text-caption.test.ts:64-76`:

```typescript
const cssText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../styles/default.css"),
  "utf8",
);

beforeAll(() => {
  if (!document.head.querySelector('style[data-vms-default]')) {
    const style = document.createElement("style");
    style.setAttribute("data-vms-default", "true");
    style.textContent = cssText;
    document.head.appendChild(style);
  }
});
```

**What to copy — per-composite test files:**

- **`test/list-row.test.ts`:** every slot combination (bare `{primary: "Foo"}`, all-slots-set, tone × 4, state × freeform, action present/absent, string-vs-ViewNode primary/secondary/meta[]); assert DOM class-name emission per §4 CSS block, `role="button"` when action, Enter/Space keydown dispatch, `stopPropagation` on nested `.vms-button` clicks. Mutation-test: swap the `typeof x === "string"` branch → wrap-primary-with-caption fails.

- **`test/message.test.ts`:** all role variants (user/assistant/system + omitted); `avatar` slot with an AvatarNode child; `content` string-vs-ViewNode; `actions[]` presence emits `.vms-message__actions` right-aligned bar; `timestamp` absence hides `.vms-message__timestamp`.

- **`test/message-followtail.test.ts`:** the followTail:true case — assert `data-follow-tail` attribute on `.vms-message-list`, and mutation-test the shipped snapshot/restore mechanism (feed at bottom → new content appended → scrollTop pinned to new scrollHeight; feed scrolled up → scrollTop preserved).

- **`test/alert.test.ts`:** every tone × { title/no-title, string message, dismissible/no-dismiss, custom icon/tone-default icon } permutation; assert `.vms-alert--{tone}` class, dismiss button emits `{name: "dismiss"}` action (via the on() spy pattern from `avatar-render.test.ts`).

- **`test/empty-state.test.ts`:** RENAMED test file (or renames of existing tests) — assert the new DOM shape (`.vms-empty-state__title`, `.vms-empty-state__description`, optional `.vms-empty-state__icon` wrapping a `.vms-icon`), and check that the CTA button dispatches. **Update every consumer test that used `heading`/`message` (grep for `n.heading` / `heading:` in the tests directory).**

**Per-file AA hand-check header** — mirror the `text-caption.test.ts:23-52` block, computing the WCAG-AA-normal ratio for each new fg/bg pair × 13 themes; document the deepen-via-color-mix response where needed.

---

## 9. .NET serialization tests — 4 new files

**Analog:** `Tests/AvatarNodeSerializationTests.cs` (lines 1-169, quoted in full above) — the byte-aligned template. Every new record test file follows this shape.

**Pattern to replicate per composite:**

1. **`Type_SerializesAsX`** — proves discriminator emission.
2. **`BareNode_SerializesOnlyType`** — the class-2 findNulls defect protection (bare `new XNode(required-args-only)` → `{"type":"x","required":"..."}` with all optionals ABSENT, not null).
3. **`MinimalShape_OmittedOptionalsAreAbsent`** — asserts each optional absent from JSON when null.
4. **`Enum_KebabEnum_EachMemberRoundTrips`** — closed-union enum kebab check.
5. **Field-presence tests** for each optional.
6. **`AllFieldsSet_AllPresent`** — full-serialize proof.

**AlertNode needs additionally:** `Dismissible_False_SerializedAsAbsent` (WhenWritingDefault posture), `Dismissible_True_SerializedAsTrue`, `Tone_Required_AlwaysPresent`.

**MessageListNode needs additionally:** `FollowTail_False_SerializedAsAbsent`, `FollowTail_True_SerializedAsTrue`.

**EmptyStateNode needs additionally:** `Renamed_Fields_UseTitle_NotHeading`, `Renamed_Fields_UseDescription_NotMessage`, `Icon_SerializesAsKebab` — the migration-verification suite.

Every test file mirrors `AvatarNodeSerializationTests.cs` structure line-for-line — the exact `JsonSerializerOptions` at lines 27-30, the `Serialize<T>` helper at 32-33, the `Assert.Contains("\"type\":\"...\"", json)` idiom.

---

## 10. `demo/Showcase/frontend/src/main.ts` — Primary Composites section

**Analog:** the v8.0.0 Foundations section at `main.ts:248-320` (Phase 23 shipped — the direct-neighbor template).

**Foundations section, quoted (main.ts:254-260):**

```typescript
    { type: "section", heading: "v8.0.0 Foundations", children: [
      { type: "text", value: "Four additive primitives that the composite-nodes layer builds on. ...", style: "muted" },

      // ── COMP-01 caption tier ─────────────────────────────
      { type: "text", value: "Typographic tiers — body, muted, caption (v8.0.0)", style: "subheading" },
      { type: "text", value: "Caption is the third tier — smaller than muted, meant for the timestamp/status crumbs that anchor list rows and message meta.", style: "muted" },
      { type: "section", layout: "row", align: "baseline", children: [
        ...
```

**What to copy — add a "v8.0.0 Primary Composites" section AFTER the Foundations section (`main.ts:320` insertion point):**

```typescript
    // ── v8.0.0 Primary Composites (COMP-05..COMP-08) ──────────────────────
    // The four high-frequency composites that consume the Phase 23
    // foundations. Fleet-adoption discipline: composites ship WITH demo
    // adoption in the same batch as their primitive (banked from
    // UseVmsShellStaticFiles 6.7.0).
    { type: "section", heading: "v8.0.0 Primary Composites", children: [
      { type: "text", value: "Four high-frequency composites — the shapes VMS consumers reach for first. Each ships as a typed-slot recipe: the framework owns layout / typography / spacing / a11y, the app hands it content via named slots.", style: "muted" },

      // ── COMP-05 ListRowNode + ListNode(variant:"rows") ───
      { type: "text", value: "ListRowNode — dense list row with 3-tier typography", style: "subheading" },
      { type: "list", variant: "rows", children: [
        { type: "list-row",
          leading: { type: "avatar", initials: "AL", tone: "success" },
          primary: "Ada Lovelace",
          secondary: "ada@analytical.example",
          meta: ["Last active 2h ago", "role: admin"],
          trailing: { type: "badge", label: "ACTIVE", tone: "success" },
          tone: "success",
          action: { name: "showcase-open-user-ada" },
        },
        // ... more rows ...
      ]},

      // ── COMP-06 MessageNode + MessageListNode ───────────
      { type: "text", value: "MessageNode — chat / comment thread", style: "subheading" },
      { type: "message-list", followTail: true, children: [
        { type: "message", author: "Ada Lovelace", timestamp: "2:14 PM",
          content: "Can we ship v8 this week?",
          avatar: { type: "avatar", initials: "AL", tone: "success" },
          role: "user",
        },
        { type: "message", author: "VMS", timestamp: "2:15 PM",
          content: "Green tree. Ready to publish.",
          avatar: { type: "avatar", icon: "sparkles", tone: "info" },
          role: "assistant",
          actions: [{ type: "button", label: "OK", action: { name: "showcase-message-ok" } }],
        },
      ]},

      // ── COMP-07 AlertNode ───────────────────────────────
      { type: "text", value: "AlertNode — every tone, with the default tone→icon mapping", style: "subheading" },
      { type: "alert", tone: "danger",  title: "Payment declined", message: "Your card was refused." },
      { type: "alert", tone: "warning", title: "Storage almost full", message: "You've used 92% of your quota.", dismissible: true },
      { type: "alert", tone: "success", title: "Refund processed", message: "Refund of $124 issued." },
      { type: "alert", tone: "info",    title: "New version",     message: "v8.0.0 is available." },

      // ── COMP-08 EmptyStateNode ──────────────────────────
      { type: "text", value: "EmptyStateNode — the friendly \"nothing here\" recipe", style: "subheading" },
      { type: "empty-state",
        icon: "inbox",
        title: "No orders yet",
        description: "Once customers place orders they'll show up here.",
        action: { type: "button", label: "Learn more", action: { name: "showcase-empty-state-cta" } },
      },
    ]},
```

**Fleet-adoption discipline:** the composites and their Showcase adoption ship in the SAME batch (banked from `UseVmsShellStaticFiles` 6.7.0). Do not defer to Phase 26.

---

## 11. `.planning/design/composite-nodes-layer.md` — "Shipped recipe inventory" table

**Analog:** the "Milestone inventory — 10 composites + 3 wire tweaks + 1 new primitive" section at `.planning/design/composite-nodes-layer.md:76-243` — currently free-form Markdown per composite. Phase 24 grows a **tabular "Shipped recipe inventory" table** capturing what has landed (per CONTEXT §12).

**What to add** (planner picks placement — recommend near §4c, "Composites (Phase 24 — primary)"):

```markdown
## Shipped recipe inventory

*Updated as each phase lands. Phase 24 (2026-07-30) fills in the 4 primaries.*

| Composite | Slot summary | Phase | Wire type | .NET record | Consumes |
|---|---|---|---|---|---|
| `ListRowNode` | leading, primary, secondary, meta[], trailing, tone, state, action | 24 (COMP-05) | `"list-row"` | `ListRowNode` | TextNode caption/weight (COMP-01/02) |
| `MessageNode` + `MessageListNode` | avatar, author, timestamp, content, role, actions[]; followTail on list | 24 (COMP-06 + 06a) | `"message"` / `"message-list"` | `MessageNode` / `MessageListNode` | AvatarNode (COMP-04), TextNode caption (COMP-01), SectionNode.followTail mechanism (browser.ts:227-372, REUSED not re-built) |
| `AlertNode` | tone (required), title, message, icon, actions[], dismissible | 24 (COMP-07) | `"alert"` | `AlertNode` | IconName (v7.0), TextNode weight (COMP-02); tone→icon default map baked into browser.ts:ALERT_TONE_ICON |
| `EmptyStateNode` (v8.0 rename) | icon, title (was heading), description (was message), action | 24 (COMP-08) | `"empty-state"` | `EmptyStateNode` | IconName (v7.0); BREAKING wire rename from v7.x heading/message |
| `UserRowNode` | ... | 25 (COMP-09) | ... | ... | ... |
| ... | | | | | |
```

Rows for Phase 25 composites stay TBD until they land.

---

## 12. `AGENTS.md` — "Currently shipped recipes" inventory

**Analog:** the placeholder at `AGENTS.md:744`:

```markdown
**Current recipe inventory.** *[To be populated as Phases 24-26 land composite recipes. The initial version omits the inventory table by design so it doesn't drift ahead of what actually ships; grows as composites land.]*
```

**What to copy — replace with the shipped list (mirror the design-doc §"Shipped recipe inventory" table exactly, or narrow it to the essentials):**

```markdown
**Currently shipped recipes.** *(Updated as Phase 24-26 land.)*

Phase 24 (v8.0.0, primary composites):
- `ListRowNode` (COMP-05) + `ListNode.variant:"rows"` (COMP-05a) — dense list row with 3-tier typography; single-surface container.
- `MessageNode` (COMP-06) + `MessageListNode` (COMP-06a) — chat/comment message with follow-tail transcript. **MessageListNode.followTail REUSES SectionNode.followTail's shipped mechanism** — the pre-render snapshot / post-render restore at `browser.ts:227-246 + 362-372` walks EVERY `[data-follow-tail]` element, so a new consumer just sets `el.dataset.followTail = ""` (no new adapter code, ever). Same posture will apply to any future "growing feed" composite (activity feed, live log).
- `AlertNode` (COMP-07) — prominent status message with tone-appropriate icon (default map baked in browser: danger→x-circle, warning→alert-triangle, success→check-circle, info→info; overridable via `icon?`).
- `EmptyStateNode` (COMP-08) — friendly "nothing here" recipe. **v8.0 WIRE BREAKING:** field rename `heading→title`, `message→description`; new `icon?` slot. See `MIGRATION.md`.

Phase 25 composites (UserRow, DetailRow, Timeline, SettingRow, Chip+ChipList): TBD.
Phase 26 release ritual: TBD (aligned v8.0.0 npm + NuGet publish; see `.planning/design/composite-nodes-layer.md` §5).
```

---

## 13. `CHANGELOG.md` — append 4 entries under "Unreleased — v8.0.0"

**Analog:** the existing block at `CHANGELOG.md:9-15` (Phase 23 additions).

**Current, quoted:**

```markdown
## Unreleased — v8.0.0 (in progress)

> **Batch-then-ship:** v8.0.0 publishes at Phase 26 closeout with all 10 composites + 3 wire tweaks + 4 foundations in one aligned release. Do NOT publish Phase 23 as its own release. See `.planning/design/composite-nodes-layer.md` for the milestone design of record.

### Added

- `TextNode.style: "caption"` — the 3rd typographic tier ...(COMP-01)
- `TextNode.weight?: "regular" | "medium" | "bold"` — ... (COMP-02)
- `CheckboxNode.variant?: "checkbox" | "switch"` — ... (COMP-03)
- `AvatarNode` — ... (COMP-04)
```

**What to copy — append 4 entries + 1 breaking-rename note:**

```markdown
- `ListRowNode` (`"list-row"`) — dense list row with 3-tier typography. Wire shape: `{ type, leading?, primary, secondary?, meta?[], trailing?, tone?, state?, action? }`. Slots `primary/secondary/meta[]` accept `string | ViewNode`; strings auto-wrap in trained `TextNode` (`body`+`weight:"medium"` for primary; `muted` for secondary; `caption` for meta). Whole-row `action?` follows the `TableRow.action` shape (role="button", Enter/Space dispatch, aria-label from flattened text). Pairs with `ListNode.variant: "rows"` — a single-bordered-surface container that accepts only `ListRowNode` children (tree-validator rejects mixed). (COMP-05 + 05a)
- `MessageNode` (`"message"`) — chat/comment message. Wire shape: `{ type, avatar?, author, timestamp?, content, role?, actions? }`. `content` is `string | ViewNode` (string auto-wraps in `TextNode{style:"body"}`). `role: "user"|"assistant"|"system"` controls surface tone (`"assistant"` tints info; others neutral). Actions are always-visible (no hover-reveal — banked a11y). Pairs with `MessageListNode` (`"message-list"`) with `followTail?: boolean` — **reuses SectionNode's shipped `data-follow-tail` scroll-pin mechanism verbatim; no new adapter code.** Tree-validator rejects non-MessageNode children. (COMP-06 + 06a)
- `AlertNode` (`"alert"`) — prominent status message with tone-appropriate icon. Wire shape: `{ type, tone (required), title?, message, icon?, actions?, dismissible? }`. Framework owns the tone→icon default mapping (`danger`→`x-circle`, `warning`→`alert-triangle`, `success`→`check-circle`, `info`→`info`); `icon?` overrides. `dismissible: true` emits a close-X that dispatches `{name: "dismiss"}` client-side (fixed action name, distinct from ModalNode.dismissAction which takes a caller-supplied ActionEvent). (COMP-07)

### Changed (BREAKING)

- **`EmptyStateNode` field rename + new icon slot (COMP-08).** Old shape `{ heading, message?, action? }` → new shape `{ icon?, title, description?, action? }`. Consumers must rename `heading→title` and `message→description` in their `buildVm` code; existing action slot unchanged. Consider this the primary v8.0 wire break — every other v8.0 addition is additive. See `MIGRATION.md` for the exact rewrite.
```

---

## 14. `MIGRATION.md` — 4 additive notes + 1 breaking-rename note

**Pattern:** every prior breaking-wire release ships a MIGRATION.md note explaining the rewrite. The EmptyStateNode rename is the one Phase 24 requires.

**What to copy:**

```markdown
## v8.0.0 (in progress)

### EmptyStateNode field rename (COMP-08, BREAKING)

Old (`v7.x`):
```typescript
{ type: "empty-state", heading: "No orders yet", message: "..." , action: {...} }
```

New (`v8.0`):
```typescript
{ type: "empty-state", icon: "inbox", title: "No orders yet", description: "...", action: {...} }
```

Field mapping: `heading → title`, `message → description`. New optional `icon?: IconName` slot; the renderer wraps it in a tinted-accent circle backdrop.

**.NET record rename** — `EmptyStateNode(Heading, Message?, Action?)` → `EmptyStateNode(Title, Icon?, Description?, Action?)`.

**Automated rewrite:** find-and-replace at the callsite. Every VMS consumer already using `EmptyStateNode` needs a one-line edit per instance. The framework's own demo apps (feature-probe) and tests are updated in the same commit run.

### ListRowNode, MessageNode, MessageListNode, AlertNode (COMP-05, 06, 06a, 07) — new node types

**Additive; no consumer changes required.** New node types with `[JsonDerivedType]` discriminators; older adapters silently emit nothing for unknown types (existing behavior for forward compatibility).
```

---

## Summary — analogs at a glance

| Requirement | Primary analog | New machinery needed? |
|---|---|---|
| COMP-05 (ListRowNode) | `ListItemNode` (state/tone class-name comp) + `TableRow.action` (whole-row click at browser.ts:3689-3714) + `SectionNode.action` (stopPropagation post-kids selector walk at :1103-1111) | No — combinations of shipped patterns |
| COMP-05a (`ListNode.variant:"rows"`) | `ListNode.ordered?` addition (Phase 6.1.0) — same "grow the interface + add one className" pattern | No — one-line className extension |
| COMP-06 (MessageNode) | `SectionNode` (typed slots + role-tinted surface via CSS `.vms-message--assistant .vms-message__content` color-mix at 6%) | No |
| COMP-06a (MessageListNode.followTail) | **`SectionNode.followTail` at browser.ts:53-58 + 227-246 + 362-372 + 1062 — reuse verbatim, ONE line of new code (`el.dataset.followTail = ""`)** | No — reuse enforcement is the key rule |
| COMP-07 (AlertNode) | `SectionNode` tinted surface (default.css:443-446 color-mix) + tone→icon default map baked in `ALERT_TONE_ICON` static + `ModalNode.dismissAction` close-X at browser.ts:3471-3479 (with the deviation of emitting a fixed action name, not a caller-supplied ActionEvent) | No |
| COMP-08 (EmptyStateNode rename + icon) | Existing shipped `EmptyStateNode` at index.ts:1380 / browser.ts:3969 / ViewModels.cs:1938 — RENAMED fields + NEW icon slot | Minimal — rename cascade through fixture + tests + demos |
| Tree-validator descent | `case "modal"` at server.ts:213-221 (typed slots + Actions[] walk) + `case "empty-state"` at server.ts:283-291 (single-slot descent) | No — new walker arms follow the same shape |
| Parity FeatureProbe extension | `foundationsSection` at handler.ts:1066-1104 + .NET twin at FeatureProbeController.cs:1163-1203 + tripwires at feature-probe.json:74-83 | No — EXTEND, don't add a new fixture |
| Test coverage (vitest + .NET) | `test/avatar-render.test.ts` (DOM + a11y + mutation) + `test/text-caption.test.ts` (stylesheet-load + computed-style + AA header) + `test/follow-tail.test.ts` (jsdom scroll geometry stubs) + `Tests/AvatarNodeSerializationTests.cs` (byte-aligned WhenWritingNull + KebabEnum + discriminator) | No — line-for-line templates exist |
| Showcase demo adoption | v8.0.0 Foundations section at main.ts:248-320 (Phase 23 shipped) | No — direct-neighbor template |
| Design doc + AGENTS.md inventory | Placeholder at AGENTS.md:744; free-form §4c in composite-nodes-layer.md | Yes — first-fill of tables that Phase 23 stubbed |
| CHANGELOG + MIGRATION | v8.0.0 Unreleased block at CHANGELOG.md:9-15; MIGRATION.md pattern from prior wire-breaking releases | No — append-only |
| Release | N/A — CONTEXT §11 defers to Phase 26 | Zero this phase |

**Verdict:** no new machinery. Every pattern this phase needs is already shipped and in-repo. The executor's job is to follow the analogs (especially the fresh Phase 23 AvatarNode / FeatureProbe / Showcase templates and the mandatory `data-follow-tail` mechanism reuse for MessageListNode) verbatim, not to invent.

**The three highest-risk items** (per plan-checker C-3/C-4 conventions):
1. **EmptyStateNode rename cascade** — every downstream consumer (feature-probe, tests, demos) needs the field-rename edit in the same commit run; missing any is a green-tree gate failure.
2. **MessageListNode.followTail reuse discipline** — do NOT let an executor write a parallel snapshot/restore mechanism; the ONE line of new code is `el.dataset.followTail = ""`.
3. **`.NET` `string | ViewNode` policy** — Analog C above documents the recommended `ViewNode?` posture; executor should NOT invent an `object?` + custom converter unless the planner explicitly greenlights it (higher machinery for marginal ergonomic gain).

---

## PATTERN MAPPING COMPLETE
