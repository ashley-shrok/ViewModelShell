# Phase 23: v8.0 Foundations — Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 8 target files across 4 additions (COMP-01..COMP-04)
**Analogs found:** 8 exact / 0 partial — **0 with no analog**

> **Headline for the planner:** every mechanism this phase needs is a direct copy of Phase 22 (v7.0 IconNode) or the earlier `.vms-text--*` / `.vms-checkbox` shipments. IconNode is the fresh, byte-aligned template for **AvatarNode** (leaf ViewNode with closed-enum size + tone). The two `TextNode` extensions are the same shape as the shipped `TextNode.style` closed union + `TextNode.tone`. `CheckboxNode.variant:"switch"` is a new closed-enum field on an existing input node — a variant enum is the same shape as `FieldNode.inputType` dispatch. Parity FeatureProbe extension mirrors ICON-09 verbatim. Vitest + .NET tests mirror `icon-render.test.ts` / `icon-wire.test.ts` / `IconNodeSerializationTests.cs` line-for-line.
>
> **Two design questions the planner still owns** (from CONTEXT.md §Decisions 2):
> 1. Weight axis shape — Option A (`weight?: "regular"|"medium"|"bold"` — new field) vs Option B (`style: "strong"` — closed-union extension). CONTEXT recommends A; planner has authority. **Both shapes have the same analog set** (closed union + kebab enum + CSS class), so this table is neutral on the choice.
> 2. Whether the `avatar` icon-mode reuses `renderIconSvg` inside the circle (design says yes; Plan should mirror `button()`'s `btn.appendChild(this.renderIconSvg(...))` call).

## File Classification

| File to create/modify | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `viewmodel-shell/src/index.ts` (TextNode `style: "caption"` + optional weight axis) | model/wire-type | request-response | Existing `TextNode.style` union (`index.ts:997`) + `TextNode.tone` (`:1001`) | exact |
| `viewmodel-shell/src/index.ts` (CheckboxNode `variant?: "checkbox"\|"switch"`) | model/wire-type | request-response | `BadgeNode.emphasis` closed union pattern; `ButtonNode.emphasis` (`:802`) | exact |
| `viewmodel-shell/src/index.ts` (AvatarNode new leaf type + `\| AvatarNode` in ViewNode union) | model/wire-type | request-response | `IconNode` (`:1433-1455`) + `\| IconNode` at `:209` | exact |
| `viewmodel-shell/src/browser.ts` (text render arm: emit `.vms-text--caption` + weight class) | component/renderer | request-response | `private text()` at `browser.ts:3208-3251` | exact |
| `viewmodel-shell/src/browser.ts` (checkbox render arm: `.vms-field--switch` + `role="switch"`) | component/renderer | request-response | `private checkbox()` at `browser.ts:3108-3137` | exact |
| `viewmodel-shell/src/browser.ts` (new `private avatar()` + `renderNode` case) | component/renderer | request-response | `private icon()` at `browser.ts:4143-4146` + `renderIconSvg()` at `:4095-4141` | exact |
| `viewmodel-shell/styles/default.css` (`.vms-text--caption`, weight class) | config/styling | — | `.vms-text--muted` at `default.css:1127`; `.vms-text--strikethrough` at `:1128` | exact |
| `viewmodel-shell/styles/default.css` (`.vms-field--switch`) | config/styling | — | `.vms-field--checkbox` at `default.css:885-894`; `.vms-checkbox__mark` slider pattern at `:899-928` | exact |
| `viewmodel-shell/styles/default.css` (`.vms-avatar[--{size}\|--{tone}\|--icon]`) | config/styling | — | `.vms-icon` size/tone scaffold at `default.css:1959-1975`; `.vms-badge` tone-tinted-surface via `color-mix` at `:1980-2012` | exact |
| `viewmodel-shell-dotnet/ViewModels.cs` (TextStyle enum extension + optional TextWeight enum) | model/wire-type | request-response | `enum TextStyle` at `ViewModels.cs:163`; `enum IconSize` at `:187`; KebabEnum converter | exact |
| `viewmodel-shell-dotnet/ViewModels.cs` (CheckboxNode `Variant?` + `enum CheckboxVariant`) | model/wire-type | request-response | `record CheckboxNode` at `:1340-1348`; `enum Emphasis` KebabEnum pattern | exact |
| `viewmodel-shell-dotnet/ViewModels.cs` (`record AvatarNode` + `AvatarSize` enum + `[JsonDerivedType]`) | model/wire-type | request-response | `record IconNode` at `:1952-1965` + `[JsonDerivedType(typeof(IconNode), "icon")]` at `:747` + `enum IconSize` at `:187` | exact |
| `parity/backends/*/buildVm.{ts,cs}` (EXTEND FeatureProbe with foundations section) | test/fixture | request-response | ICON-09 pattern — `demo/FeatureProbe-bun/handler.ts:1007-1041` + `.NET twin at FeatureProbeController.cs:1091-1139` | exact |
| `parity/fixtures/feature-probe.json` (append v8.0.0 clause + `expectBodyContains` tripwires) | test/fixture | request-response | v7.0.0 ICON-09 clause (existing `$comment` tail) + tripwires like `"type":"icon"`, `"name":"trash-2"` | exact |
| `viewmodel-shell/test/*.test.ts` (caption/weight/switch/avatar render + wire) | test | request-response | `test/icon-render.test.ts` (DOM/a11y assertions) + `test/icon-wire.test.ts` (compile-time type + validator FAIL/PASS mutation) | exact |
| `viewmodel-shell-dotnet/Tests/*.cs` (parallel .NET serialization + enum coverage) | test | — | `Tests/IconNodeSerializationTests.cs` (wire shape + enum kebab-case + WhenWritingNull posture) | exact |
| `demo/Showcase/frontend/src/main.ts` (Foundations demo tab) | demo | request-response | Icons gallery section at `main.ts:806-857` (Phase 22 shipped adoption) | exact |

---

## 1. `viewmodel-shell/src/index.ts` — `TextNode.style: "caption"` (COMP-01) + weight axis (COMP-02)

**Analog:** existing `TextNode` at `index.ts:934-1005`. Both extensions are additive to a node the framework already ships.

**Current shape, quoted** (index.ts:997-1001):

```typescript
  /** Typography role only (NOT color) — emits .vms-text--{style}. Semantic color moved to `tone` (the old `error`/`warning` style values are now `tone:"danger"`/`tone:"warning"`). Closed union.
   *  Orthogonal to `runs`: `style` is the NODE-level typography role, `runs` is
   *  intra-paragraph emphasis. Uniform emphasis over a whole paragraph should use
   *  `style` and omit `runs` entirely. With `style:"pre"` the runs nest inside the
   *  `<pre>` and its `white-space: pre` still applies.
   *
   *  @deprecated `"heading"` and `"subheading"` remain SUPPORTED for backward
   *  compatibility but new code should use the `level` axis above instead. */
  style?: "heading" | "subheading" | "body" | "muted" | "strikethrough" | "pre";
  /** Semantic intent/severity color — the universal status tone axis... */
  tone?: "danger" | "warning" | "success" | "info";
```

**What to copy for `"caption"` (COMP-01):**

- Add `| "caption"` to the closed union at `index.ts:997`. Alphabetical or grouped-near-`muted` — placement doesn't matter (JSON key order isn't load-bearing).
- Add a TSDoc phrase explaining the tier — "the text-xs muted-opacity tier used by `ListRowNode.meta[]`, `MessageNode.timestamp`, `TimelineEntryNode.time` (Phase 24-25)".
- Renders as `<span class="vms-text vms-text--caption">` — same DOM shape as every other TextNode style (CONTEXT §1).

**What to copy for weight axis (COMP-02) — Option A (new field, CONTEXT-recommended):**

Mirror the exact shape of `TextNode.tone` (index.ts:1001) as another orthogonal axis:

```typescript
  /** Type-weight axis (orthogonal to `style` and `tone`) — semi-bold body-size
   *  weight for the `body`-styled TextNodes that anchor rows and cards. Emits
   *  `.vms-text--weight-{weight}`. Omitted = the framework default weight for
   *  the node's `style` (400 for body/muted/caption; the shipped style's own
   *  weight for heading/subheading). Closed union. */
  weight?: "regular" | "medium" | "bold";
```

**What to copy for weight axis (COMP-02) — Option B (style extension):**

Add `| "strong"` to the same `style` union above. TSDoc note: "the semi-bold body-size weight variant — reach for this on a `body`-tier `TextNode` that anchors a row's primary label."

Either shape is a closed union — the closed-union-must-be-enum discipline (AGENTS.md §closed-union) is triggered on both.

---

## 2. `viewmodel-shell/src/index.ts` — `CheckboxNode.variant: "checkbox" | "switch"` (COMP-03)

**Analog:** `CheckboxNode` (index.ts:784-795) + closed-enum variant fields on `ButtonNode.emphasis` (index.ts:802) / `SectionNode.variant` (index.ts:239) / `BadgeNode.emphasis` — the framework-wide pattern of a `variant?` field with a bare closed union.

**Current CheckboxNode, quoted** (index.ts:784-795):

```typescript
export interface CheckboxNode {
  type: "checkbox";
  name: string;
  /** Path into state where this input reads its current value and writes user changes (e.g. `fields.title`). */
  bind: string;
  label?: string;
  /** Dispatched immediately on change. Carries an action name only — the new
   *  checked value is already in state at the bind path. */
  action?: ActionEvent;
  /** Hover-only info tooltip (6.12.0, TOOL-01). See FieldNode.tooltip. */
  tooltip?: string;
}
```

**What to copy:**

- Add a single optional field at the end (per the existing "post-existing fields to keep diffs clean" convention):

```typescript
  /** Visual variant — `"checkbox"` (omitted / today's render) vs `"switch"`
   *  (slider-track + thumb, styled as .vms-field--switch). Wire semantics are
   *  UNCHANGED: value is still a boolean, dispatch is still `bind`/change on
   *  the underlying `<input type="checkbox">`, keyboard toggle is still Space.
   *  a11y: with `"switch"` the renderer adds `role="switch"` to the input so
   *  screen readers announce "switch on"/"switch off" instead of
   *  "checked"/"unchecked". Fallback: older adapters ignore the field and
   *  render as a normal checkbox (graceful degradation). Closed union. */
  variant?: "checkbox" | "switch";
```

- Wire posture: WhenWritingNull ⇒ absent on the .NET twin (AGENTS.md gotcha #8). `"checkbox"` and unset are byte-identical in rendering — do NOT set `"checkbox"` explicitly in demos or fixtures, mirror the `emphasis` / `style` convention where absent = default.

---

## 3. `viewmodel-shell/src/index.ts` — `AvatarNode` new leaf type (COMP-04) + `| AvatarNode` in ViewNode union

**Analog:** `IconNode` at `index.ts:1433-1455` (v7.0.0 ICON-01). Fresh, in-repo, byte-aligned across TS/.NET, tree-validator descended-through-if-needed — the FRESHEST directly-applicable template in the codebase. The Phase 22 PATTERNS.md itself sets this precedent for AvatarNode (it explicitly calls out the "leaf-node + closed-enum size + tone" shape as a well-worn pattern).

**Current IconNode, quoted** (index.ts:1433-1455):

```typescript
export interface IconNode {
  type: "icon";
  /** The icon name from the curated Lucide subset. Closed union of ~102
   *  literal names (see IconName). Unknown names fail the tree validator. */
  name: IconName;
  /** Pixel size axis (framework-owned mapping: xs=12, sm=16, md=20, lg=24,
   *  xl=32). Omitted = "md" (20px), the default. */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Semantic intent/severity — the universal status tone axis. Emits
   *  `.vms-icon--{tone}` which sets `color`, which the SVG's
   *  `stroke="currentColor"` picks up. Omitted = inherits currentColor from
   *  the surrounding text/element (the default — keeps icons visually
   *  consistent with adjacent text without duplicating the tone axis at every
   *  callsite). Closed union, mirrors the other appearance-axis tones
   *  framework-wide. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Accessible name for screen readers when the icon carries meaning
   *  INDEPENDENT of nearby text. When present, emits `role="img"` +
   *  `aria-label={label}`. When absent, emits `aria-hidden="true"` (decorative;
   *  meaning lives in adjacent text). NEVER rendered as visible text — this is
   *  the ARIA channel only. Omitted = decorative (`aria-hidden="true"`). */
  label?: string;
}
```

**Also copy — `\| IconNode` in the ViewNode union** (index.ts:180-209):

```typescript
export type ViewNode =
  | PageNode
  ...
  | DiffNode
  | IconNode;
```

**What to copy for AvatarNode** (matches CONTEXT §4 wire shape exactly):

```typescript
export interface AvatarNode {
  type: "avatar";
  /** Displayed when no image. 1-2 characters typical. */
  initials?: string;
  /** Image URL — takes precedence over initials when set (background hidden
   *  by the img element). */
  image?: string;
  /** Fallback icon when neither initials nor image is set (uses the shipped
   *  Lucide subset from IconName). */
  icon?: IconName;
  /** Circle diameter axis — sm=1.5rem (24px, inline in dense lists),
   *  md=2rem (32px, DEFAULT — comment threads / user rows / chat messages),
   *  lg=2.5rem (40px, expanded headers), xl=3rem (48px, hero/profile).
   *  Closed union. Omitted = "md" (2rem). */
  size?: "sm" | "md" | "lg" | "xl";
  /** Background palette for the circle in initials/icon modes ONLY — image
   *  mode's img element hides the background. Same 4-tone closed union used
   *  framework-wide. Omitted = the framework default neutral fill. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Accessible name for screen readers. Present ⇒ `role="img"` +
   *  `aria-label={alt}`. Omitted on non-image modes ⇒ `aria-label={initials}`
   *  (initials mode) or `aria-label=""` (icon/empty modes — decorative).
   *  On image mode passes through as `<img alt={alt}>` (empty string is
   *  legal a11y for a decorative image). */
  alt?: string;
}
```

- Add `| AvatarNode` to the ViewNode union — one entry, alphabetical or grouped near IconNode (`index.ts:180-209`).
- Add `type: "avatar"` discriminator — same shape as every other node.
- Reuse `IconName` from the existing `index.ts:148-178` union (already shipped, ~102 members). **Do NOT redeclare it.**
- Every optional nullable ⇒ `[JsonIgnore(WhenWritingNull)]` on the .NET twin (AGENTS.md gotcha #8 — non-negotiable).

**What to do differently:**

- AvatarNode is a **leaf node** — no `children`, no `action`, no `bind`. Same posture as IconNode; server.ts `collectActions` / .NET `Collect` walker arms are no-ops (no descent needed).
- The size mapping differs from IconNode's px scheme (rem units, since avatars are container-sized, not inline-with-text): `sm=1.5rem / md=2rem / lg=2.5rem / xl=3rem`. Document this in TSDoc — the framework owns the mapping.
- No `emphasis` axis — avatars are always circular filled circles or images (CONTEXT §Deferred: multiple avatar shapes are out of scope for v1).

---

## 4. `viewmodel-shell/src/browser.ts` — TextNode render (caption + weight)

**Analog:** `private text()` at `browser.ts:3208-3251`. The exact renderer arm to extend.

**Current pattern, quoted** (browser.ts:3208-3251, condensed):

```typescript
  private text(n: TextNode, parent: HTMLElement): void {
    const tag = (typeof n.level === "number" && n.level >= 1 && n.level <= 6)
      ? `h${n.level}`
      : (n.style === "pre" ? "pre" : "span");
    const el = document.createElement(tag);
    el.className = `vms-text${n.style ? ` vms-text--${n.style}` : ""}${n.tone ? ` vms-text--${n.tone}` : ""}`;
    if (n.runs && n.runs.length > 0) {
      this.inlineRuns(n.runs, el);
      this.applyTooltip(el, n.tooltip);
    } else if (n.tooltip != null && n.tooltip !== "") {
      const inner = document.createElement("span");
      inner.className = "vms-text__anchor";
      inner.textContent = n.value;
      this.applyTooltip(inner, n.tooltip);
      el.appendChild(inner);
    } else {
      el.textContent = n.value;
    }
    parent.appendChild(el);
  }
```

**What to copy:**

- Zero DOM structure change — `"caption"` inherits the existing `vms-text--${n.style}` class emission for free the moment the closed union grows.
- For weight (Option A — `weight?: "regular"|"medium"|"bold"`): extend the className builder:

```typescript
    el.className = `vms-text${n.style ? ` vms-text--${n.style}` : ""}${n.tone ? ` vms-text--${n.tone}` : ""}${n.weight ? ` vms-text--weight-${n.weight}` : ""}`;
```

- For weight (Option B — `style: "strong"`): no browser.ts change — the existing `.vms-text--${n.style}` emission covers it.
- **The `runs` / `tooltip` / `value` branches STAY UNCHANGED.** Only the className string grows.

---

## 5. `viewmodel-shell/src/browser.ts` — CheckboxNode render (switch variant)

**Analog:** `private checkbox()` at `browser.ts:3108-3137`. The exact renderer arm to extend.

**Current pattern, quoted** (browser.ts:3108-3137, condensed):

```typescript
  private checkbox(n: CheckboxNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const lbl = document.createElement("label");
    lbl.className = "vms-checkbox";
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.className = "vms-checkbox__input";
    inp.name = n.name;
    inp.id = `vms-checkbox-${n.name}`;
    inp.checked = Boolean(this.sa.read(n.bind));
    const mark = document.createElement("span");
    mark.className = "vms-checkbox__mark";
    lbl.appendChild(inp);
    lbl.appendChild(mark);
    if (n.label) {
      const span = document.createElement("span");
      span.className = "vms-checkbox__label";
      span.textContent = n.label;
      lbl.appendChild(span);
    }
    inp.addEventListener("change", () => {
      this.sa.write(n.bind, inp.checked);
      if (n.action) on(n.action);
    });
    this.applyTooltip(lbl, n.tooltip);
    parent.appendChild(lbl);
  }
```

**What to copy — minimal delta for the switch variant** (matches CONTEXT §3):

```typescript
    const lbl = document.createElement("label");
    // v8.0.0 (COMP-03) — switch variant is a visual-only .vms-field--switch
    // modifier on the same label wrapper. Wire and dispatch semantics
    // unchanged; the CSS restyles the checkbox+mark into a slider.
    lbl.className = `vms-checkbox${n.variant === "switch" ? " vms-field--switch" : ""}`;
    ...
    inp.type = "checkbox";
    // v8.0.0 (COMP-03) — role="switch" so screen readers announce
    // "switch on"/"switch off" instead of "checked"/"unchecked". Native
    // Space still toggles; keyboard traversal unchanged.
    if (n.variant === "switch") inp.setAttribute("role", "switch");
```

- **DO NOT** branch on `n.variant` for the DOM structure — it's a visual-only variant. `<input type="checkbox">` + the `<span class="vms-checkbox__mark">` mark stay identical. CSS turns them into a slider track + thumb (see §7 below for `.vms-field--switch` CSS).

---

## 6. `viewmodel-shell/src/browser.ts` — AvatarNode render (new leaf renderer)

**Analog:** `private icon()` at `browser.ts:4143-4146` (the arm-level dispatch) + `private renderIconSvg()` at `browser.ts:4095-4141` (the shared icon-SVG builder that AvatarNode's icon-mode reuses).

**IconNode arm, quoted** (browser.ts:4143-4146):

```typescript
  private icon(n: IconNode, parent: HTMLElement): void {
    const size = n.size ?? "md";
    parent.appendChild(this.renderIconSvg(n.name, size, n.tone, n.label));
  }
```

**And the renderNode dispatch, quoted** (browser.ts:535-580, condensed):

```typescript
  private node(n: ViewNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    switch (n.type) {
      case "page":      return this.page(n, parent, on);
      ...
      case "diff":         return this.diff(n, parent);
      case "icon":         return this.icon(n, parent);
      default: {
        // Fail loud, not silent (AGENTS.md: "Nothing important fails quietly").
        const unknownType = (n as { type?: unknown }).type;
        console.warn(
          `[viewmodel-shell] Unknown node type ${JSON.stringify(unknownType)} — ` +
          `rendering nothing for it. The client may be older than the server's tree.`,
        );
      }
    }
  }
```

**What to copy:**

1. Add `case "avatar": return this.avatar(n, parent);` to the `renderNode` switch at `browser.ts:565` (right after `case "icon"`).

2. Add a new `private avatar()` method that implements CONTEXT §4 content-resolution priority (image > initials > icon > empty):

```typescript
  private avatar(n: AvatarNode, parent: HTMLElement): void {
    const size = n.size ?? "md";

    // Image mode — <img> element. img displaces the background; alt="" is legal.
    if (n.image != null && n.image !== "") {
      const img = document.createElement("img");
      img.className = `vms-avatar vms-avatar--${size}`;
      img.src = n.image;
      img.alt = n.alt ?? "";
      parent.appendChild(img);
      return;
    }

    // Non-image modes render as <div role="img"> with a computed aria-label
    // per the CONTEXT §4 priority table.
    const el = document.createElement("div");
    const classes = ["vms-avatar", `vms-avatar--${size}`];
    if (n.tone) classes.push(`vms-avatar--${n.tone}`);

    if (n.initials != null && n.initials !== "") {
      el.className = classes.join(" ");
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", n.alt ?? n.initials);
      el.textContent = n.initials;
    } else if (n.icon != null) {
      classes.push("vms-avatar--icon");
      el.className = classes.join(" ");
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", n.alt ?? "");
      // v7.0.0 icon renderer reused — same SVG shape as standalone IconNode,
      // sized to fit the avatar circle via .vms-avatar--icon CSS overrides.
      // Pass tone=undefined (the circle background carries the tone, not the
      // icon stroke) and label=undefined (aria-label is on the outer div).
      el.appendChild(this.renderIconSvg(n.icon, size === "sm" ? "sm" : "md", undefined, undefined));
    } else {
      // Empty circle — no visual content, still role="img" for a11y consistency.
      el.className = classes.join(" ");
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", n.alt ?? "");
    }

    parent.appendChild(el);
  }
```

- **Reuse `renderIconSvg` verbatim** for the icon-mode circle — do not duplicate SVG payload machinery. This is exactly the Phase 22 shared-helper pattern (button/link/section/badge/listitem all call `renderIconSvg`).
- **Image mode's `img.alt`** — CONTEXT §4 explicitly allows the empty string as valid a11y for decorative images (a decorative avatar is fine; a meaningful one gets `alt` set).

---

## 7. `viewmodel-shell/styles/default.css` — three additions

### 7a. `.vms-text--caption` + optional `.vms-text--weight-{regular|medium|bold}` (COMP-01/02)

**Analog:** `.vms-text--muted` at `default.css:1127`; `.vms-text--strikethrough` at `:1128` — the atomic style modifier pattern.

**Current pattern, quoted** (default.css:1123-1135):

```css
/* ── Text ── */
.vms-text { flex: 1; line-height: 1.4; word-break: break-word; }
.vms-text--heading       { font-family: var(--vms-font-head); font-size: var(--vms-text-xl); }
.vms-text--subheading    { font-size: var(--vms-text-lg); font-weight: 600; }
.vms-text--body          { line-height: 1.6; }
.vms-text--muted         { color: var(--vms-text-muted); font-size: var(--vms-text-sm); }
.vms-text--strikethrough { color: var(--vms-done-text); text-decoration: line-through; }
.vms-text--pre           { font-family: var(--vms-font-mono); white-space: pre; }
/* tone — semantic color axis (was the old style:"error"/"warning"). Placed after
   the typography classes so a tone color wins over a style color (e.g. muted). */
.vms-text--danger        { color: var(--vms-error); }
```

**What to copy** (matches CONTEXT §1):

```css
.vms-text--caption       { color: var(--vms-text-muted); font-size: var(--vms-text-xs); opacity: 0.85; line-height: 1.4; }
```

**For weight axis (COMP-02) — Option A:**

```css
/* Weight axis (COMP-02, v8.0.0) — orthogonal to style; a body-styled TextNode
   can be weight:"medium" without becoming a heading. */
.vms-text--weight-regular { font-weight: 400; }
.vms-text--weight-medium  { font-weight: 500; }
.vms-text--weight-bold    { font-weight: 700; }
```

**Or Option B (style extension):**

```css
.vms-text--strong        { font-weight: 500; } /* or 600 per planner call */
```

### 7b. `.vms-field--switch` (COMP-03)

**Analog:** `.vms-checkbox` scaffold at `default.css:897-928` (the current standalone checkbox), + `.vms-field--checkbox` at `:885-894` (the ambient variant-modifier pattern on the same input node).

**Current checkbox mark pattern, quoted** (default.css:899-928, condensed):

```css
.vms-checkbox { position: relative; display: inline-flex; align-items: center; flex-shrink: 0; cursor: pointer; }
.vms-checkbox__input { opacity: 0; position: absolute; width: 18px; height: 18px; cursor: pointer; margin: 0; }
.vms-checkbox__mark {
  display: block;
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--vms-border);
  border-radius: 5px;
  background: var(--vms-surface-2);
  transition: background var(--vms-t), border-color var(--vms-t);
  position: relative;
  flex-shrink: 0;
}
.vms-checkbox__input:checked + .vms-checkbox__mark { background: var(--vms-accent); border-color: var(--vms-accent); }
.vms-checkbox__input:checked + .vms-checkbox__mark::after {
  content: '';
  position: absolute;
  left: 4px; top: 1px;
  width: 5px; height: 9px;
  border: 2px solid #fff;
  border-top: none;
  border-left: none;
  transform: rotate(40deg);
}
```

**What to copy — the switch is a `.vms-field--switch` modifier that overrides the mark's geometry** into a 2.5rem × 1.5rem track with a translating thumb (CONTEXT §3 references the mockup at `bounties/composite-nodes-layer/tasting-page/index.html` SettingRowNode). Precedent: the exact same technique the current `:checked + .vms-checkbox__mark::after` uses (a `::after` pseudo-element drawing the check-glyph gets repurposed as the thumb):

```css
/* Switch variant (COMP-03, v8.0.0) — visual restyle of the standalone
   checkbox as a slider track + thumb. Wire, dispatch, and DOM structure
   unchanged from .vms-checkbox; only the mark's geometry differs. */
.vms-field--switch .vms-checkbox__mark {
  width: 2.5rem;
  height: 1.5rem;
  border-radius: 999px;
  background: var(--vms-surface-2);
}
.vms-field--switch .vms-checkbox__mark::before {
  content: '';
  position: absolute;
  left: 2px; top: 2px;
  width: calc(1.5rem - 4px);
  height: calc(1.5rem - 4px);
  border-radius: 50%;
  background: #fff;
  transition: transform var(--vms-t);
}
.vms-field--switch .vms-checkbox__input:checked + .vms-checkbox__mark {
  background: var(--vms-accent);
  border-color: var(--vms-accent);
}
.vms-field--switch .vms-checkbox__input:checked + .vms-checkbox__mark::before {
  transform: translateX(1rem);
}
/* Override the base .vms-checkbox__input:checked + .vms-checkbox__mark::after
   that draws the check-glyph — the switch has no glyph; the thumb IS the state. */
.vms-field--switch .vms-checkbox__input:checked + .vms-checkbox__mark::after {
  content: none;
}
```

### 7c. `.vms-avatar` + `.vms-avatar--{size}` + `.vms-avatar--{tone}` + `.vms-avatar--icon` (COMP-04)

**Analogs:**
- Size + tone scaffold: `.vms-icon` at `default.css:1959-1975` (the atomic size + tone class-modifier pattern with token-driven colors).
- Tone-tinted-surface with `color-mix`: `.vms-badge` at `default.css:1980-2012` (the `color-mix(in srgb, var(--_tone) 16%, var(--vms-surface))` background pattern).

**Icon scaffold, quoted** (default.css:1959-1975):

```css
.vms-icon {
  display: inline-block;
  vertical-align: -0.125em;
  flex-shrink: 0;
}
.vms-icon--xs { width: 12px; height: 12px; }
.vms-icon--sm { width: 16px; height: 16px; }
.vms-icon--md { width: 20px; height: 20px; }
.vms-icon--lg { width: 24px; height: 24px; }
.vms-icon--xl { width: 32px; height: 32px; }
.vms-icon--info    { color: var(--vms-info); }
.vms-icon--success { color: var(--vms-success); }
.vms-icon--warning { color: var(--vms-warning); }
.vms-icon--danger  { color: var(--vms-error); }
```

**Badge tinted-surface pattern, quoted** (default.css:1980-2012, condensed):

```css
.vms-badge {
  --_badge-tone: var(--vms-text-muted);
  ...
  background: color-mix(in srgb, var(--_badge-tone) 16%, var(--vms-surface));
  color: var(--_badge-tone);
}
.vms-badge--danger  { --_badge-tone: var(--vms-error); }
.vms-badge--warning { --_badge-tone: var(--vms-warning); }
.vms-badge--success { --_badge-tone: var(--vms-success); }
.vms-badge--info    { --_badge-tone: var(--vms-info); }
/* .vms-badge--primary emphasis fills solid; secondary outlines. */
.vms-badge--primary {
  background: var(--_badge-tone);
  border-color: var(--_badge-tone);
  color: #fff;
}
```

**What to copy — merge both patterns for the avatar circle** (matches CONTEXT §4 rem sizing + font sizing + tone as circle background per the tasting mockup):

```css
/* ── AvatarNode (COMP-04, v8.0.0) ──
   Circular slot with initials / image / icon content-resolution priority
   handled by the renderer. Fully round; other shapes deferred (see CONTEXT
   §Deferred). Tone applies to non-image modes only. */
.vms-avatar {
  --_avatar-tone: var(--vms-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 999px;
  font-weight: 600;
  overflow: hidden; /* clips <img> to the circle */
  /* neutral default fill (initials/icon modes) — tinted surface per the badge pattern */
  background: var(--_avatar-tone);
  color: #fff;
}
/* Size axis — 24 / 32 / 40 / 48 px per CONTEXT §4 */
.vms-avatar--sm { width: 1.5rem; height: 1.5rem; font-size: 0.6875rem; }
.vms-avatar--md { width: 2rem;   height: 2rem;   font-size: 0.8125rem; }
.vms-avatar--lg { width: 2.5rem; height: 2.5rem; font-size: 0.9375rem; }
.vms-avatar--xl { width: 3rem;   height: 3rem;   font-size: 1.0625rem; }
/* Tone axis — sets the circle background (initials/icon modes only; image mode's <img> covers it) */
.vms-avatar--danger  { --_avatar-tone: var(--vms-error); }
.vms-avatar--warning { --_avatar-tone: var(--vms-warning); }
.vms-avatar--success { --_avatar-tone: var(--vms-success); }
.vms-avatar--info    { --_avatar-tone: var(--vms-info); }
/* Icon mode — hide the initials font sizing and center the reused .vms-icon SVG */
.vms-avatar--icon { font-size: 0; }
.vms-avatar--icon .vms-icon { color: #fff; }
/* Image mode inherits the <img>'s src; the img already fills the circle via width/height=100% is
   satisfied by the .vms-avatar--{size} width/height + the img inheriting via display:block. */
.vms-avatar img,
img.vms-avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

**AA-contrast hand-check checklist** (banked lesson — fixed 13-pair `check:aa-contrast` gate does NOT auto-cover new pairs; CONTEXT §Specific ideas AA):

- `.vms-text--caption` (text-xs muted @ 0.85 opacity) against `--vms-bg` AND `--vms-surface` on default + all 12 themes. Target ≥4.5:1 (AA-normal).
- `.vms-field--switch` on-state and off-state thumb (`#fff`) against track color (accent + surface-2). Target ≥3:1 (WCAG 1.4.11 graphical UI state; state is ALSO on aria-checked so the polarity carries).
- `.vms-avatar` initials text (`#fff`) against every tone circle (`--vms-error`, `--vms-warning`, `--vms-success`, `--vms-info`) on default + all 12 themes. Target ≥4.5:1 (AA-normal). The `sm` size (11px) is smaller than AA-normal 14px — verify separately (may need weight-boost or tone deepening via the shipped v3.5.0 `color-mix(in srgb, var(--vms-X) N%, #000)` pattern).
- `.vms-avatar--icon` — icon stroke (`#fff`, from `.vms-avatar--icon .vms-icon { color: #fff }`) against every tone circle background.

---

## 8. `viewmodel-shell-dotnet/ViewModels.cs` — .NET twins

### 8a. TextStyle enum extension (COMP-01) + optional TextWeight enum (COMP-02, Option A)

**Analog:** `enum TextStyle` at `ViewModels.cs:163`; `enum IconSize` at `:187` (KebabEnum kebab-case convention).

**Current, quoted** (ViewModels.cs:161-163):

```csharp
/// <summary>Text typography role.</summary>
[JsonConverter(typeof(KebabEnum<TextStyle>))]
public enum TextStyle { Heading, Subheading, Body, Muted, Pre, Strikethrough }
```

**What to copy — COMP-01:**

```csharp
[JsonConverter(typeof(KebabEnum<TextStyle>))]
public enum TextStyle { Heading, Subheading, Body, Muted, Pre, Strikethrough, Caption }
```

Add `Caption` at the END so ordinal reads (any existing serialized enum-ordinal roundtrip if it existed) don't shift. `KebabEnum<T>` naturally emits `"caption"` — no per-member `[EnumMember]` needed for single-word members (only multi-word/digit-bearing members need the `IconNameConverter`-style dedicated converter, per Phase 22 gotcha).

**What to copy — COMP-02 Option A (new field):**

```csharp
/// <summary>Type-weight axis (v8.0.0, COMP-02) — orthogonal to TextStyle.</summary>
[JsonConverter(typeof(KebabEnum<TextWeight>))]
public enum TextWeight { Regular, Medium, Bold }
```

And on the TextNode record (ViewModels.cs:1467), append a new positional slot (SAME "append-last" rule as `Runs` / `Level` at slots 4-5, quoted at `:1487-1504`):

```csharp
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] TextWeight? Weight = null
```

### 8b. CheckboxNode.Variant + CheckboxVariant enum (COMP-03)

**Analog:** `record CheckboxNode` at `ViewModels.cs:1340-1348` + KebabEnum pattern for closed unions.

**Current, quoted** (ViewModels.cs:1340-1348):

```csharp
public record CheckboxNode(
    string Name,
    /// <summary>Path into state where this input reads its current value and writes user changes (e.g. "fields.acceptedTos").</summary>
    string Bind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action,
    // 6.12.0 (TOOL-01) — hover-only info tooltip. See FieldNode.Tooltip.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tooltip = null
) : ViewNode;
```

**What to copy — append `Variant` last (same "append-last for zero-retype construction sites" rule as TextNode.Runs/Level):**

```csharp
/// <summary>v8.0.0 (COMP-03) — CheckboxNode visual variant.</summary>
[JsonConverter(typeof(KebabEnum<CheckboxVariant>))]
public enum CheckboxVariant { Checkbox, Switch }

public record CheckboxNode(
    string Name,
    string Bind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tooltip = null,
    // v8.0.0 (COMP-03) — visual variant; "switch" restyles as a slider track+thumb.
    // Wire and dispatch semantics unchanged from the default. WhenWritingNull posture
    // per gotcha #8: absent = "checkbox" (today's default), NEVER emit as null.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] CheckboxVariant? Variant = null
) : ViewNode;
```

### 8c. AvatarNode record + AvatarSize enum + `[JsonDerivedType]` (COMP-04)

**Analog:** `record IconNode` at `ViewModels.cs:1952-1965` + `enum IconSize` at `:187` + `[JsonDerivedType(typeof(IconNode), "icon")]` at `:747`.

**Current IconNode, quoted** (ViewModels.cs:1952-1965):

```csharp
public record IconNode(
    IconName Name,
    // Pixel size axis (framework-owned mapping xs=12, sm=16, md=20, lg=24,
    // xl=32). Omitted = "md" (20px), the default.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconSize? Size = null,
    // Semantic tint. When present, emits .vms-icon--{tone} which sets color,
    // which the SVG's stroke="currentColor" picks up. Omitted = inherits
    // currentColor from the surrounding text/element.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // Accessible name for screen readers when the icon carries meaning
    // INDEPENDENT of nearby text. Present → role="img" + aria-label={Label};
    // absent → aria-hidden="true" (decorative). Never rendered as visible text.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label = null
) : ViewNode;
```

**And `[JsonDerivedType]` registry** (ViewModels.cs:747):

```csharp
[JsonDerivedType(typeof(IconNode),       "icon")]
```

**What to copy for AvatarNode:**

```csharp
/// <summary>v8.0.0 (COMP-04) — AvatarNode circle diameter axis. Framework-owned
/// rem mapping: sm=1.5rem, md=2rem (default), lg=2.5rem, xl=3rem. Distinct
/// enum from IconSize (which is px-mapped, xs..xl) because avatar sizes are
/// container-sized (rem) and the value set differs (4 vs 5 members). Closed
/// union, kebab-lowercase wire values ("sm"/"md"/"lg"/"xl").</summary>
[JsonConverter(typeof(KebabEnum<AvatarSize>))]
public enum AvatarSize { Sm, Md, Lg, Xl }

/// <summary>v8.0.0 (COMP-04) — AvatarNode circular slot with initials/image/
/// icon content-resolution priority (image > initials > icon > empty).
/// Consumed by UserRowNode (Phase 25 leading slot), MessageNode (Phase 24
/// leading slot), ChipNode optional leading; standalone use in mention
/// pickers, assignee columns, comment threads, "who's viewing" indicators.
/// Circular only for v1 (other shapes deferred; see design-doc §composite).</summary>
public record AvatarNode(
    // Displayed when Image is absent. 1-2 characters typical.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Initials = null,
    // URL — takes precedence over Initials when set (background hidden by <img>).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Image = null,
    // Fallback icon when neither Initials nor Image is set. Reuses the
    // v7.0.0 IconName closed union (~102 members).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,
    // Circle diameter (sm/md/lg/xl → 1.5/2/2.5/3rem). Omitted = "md".
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] AvatarSize? Size = null,
    // Background palette (initials/icon modes ONLY — Image displaces the bg).
    // Reuses the framework-wide Tone enum.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // Accessible name for screen readers. Empty string is valid (decorative
    // avatar); null = renderer computes from Initials or "".
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Alt = null
) : ViewNode;
```

**And register the discriminator** (ViewModels.cs:719-747 block — append one row):

```csharp
[JsonDerivedType(typeof(AvatarNode),     "avatar")]
```

**What to do differently — the closed-union-must-be-enum discipline (AGENTS.md gotcha #8):**

- `AvatarSize` MUST be a .NET enum, not `string?`. Same posture as `IconSize` / `TextStyle` / `Tone` — Phase 22 PATTERNS.md explicitly calls this out as a **live gap** the framework audit finds on 37 of 37 unions; do not add a 38th. The whole point of the closed union is that a bad `size` fails BOTH backends' tree-validators; `string?` on .NET keeps the walker silent.
- Every optional nullable ⇒ `[JsonIgnore(WhenWritingNull)]` (gotcha #8). Non-negotiable.

---

## 9. Parity FeatureProbe extension (COMP-01..COMP-04)

**Analog:** Phase 22 ICON-09 pattern. The bun handler at `demo/FeatureProbe-bun/handler.ts:985-1041` and the .NET twin at `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs:1076-1139`. Fixture at `parity/fixtures/feature-probe.json` — append a v8.0.0 clause to the file-top `$comment` string AND add `expectBodyContains` tripwires.

**The bun buildVm extension, quoted** (handler.ts:1007-1041):

```typescript
  const iconsSection: ViewNode = {
    type: "section",
    heading: "Icons",
    variant: "card",
    children: [
      // Standalone IconNode — bare (size/tone/label ALL omitted, absent on the wire).
      { type: "icon", name: "sparkles" },
      // One per size (5 total) — exercises the IconSize enum end-to-end.
      { type: "icon", name: "activity", size: "xs" },
      ...
      // Cross-node host props — all 5 hosts, each with a distinct icon.
      { type: "button", label: "Sparkle", action: { name: "icon-button-noop" }, icon: "sparkles" },
      { type: "link", label: "Docs", href: "https://vms.example/docs", external: true, icon: "external-link" },
      ...
      // The VALID icon-only ButtonNode — label empty + tooltip set, walker allows.
      { type: "button", label: "", action: { name: "icon-only-noop" }, icon: "wrench", tooltip: "Settings" },
    ],
  };
```

**And the .NET twin, quoted** (FeatureProbeController.cs:1091-1139, condensed):

```csharp
        pageChildren.Add(new SectionNode(
            Heading: "Icons",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                // Standalone IconNode — bare (all optionals absent).
                new IconNode(IconName.Sparkles),
                // One per size (5 total).
                new IconNode(IconName.Activity, Size: IconSize.Xs),
                ...
                new ButtonNode(Label: "Sparkle", Action: new ActionDescriptor("icon-button-noop"), Icon: IconName.Sparkles),
                new LinkNode(Label: "Docs", Href: "https://vms.example/docs", External: true, Icon: IconName.ExternalLink),
                ...
            }));
```

**What to copy for Phase 23 — extend BOTH twins in lockstep**:

Add a `foundationsSection` (bun) / equivalent .NET section right after the icons section. Emit:

**COMP-01 (caption):**
- One TextNode per style value INCLUDING `caption` — so `"style":"caption"` appears on the wire (tripwire below asserts it).

**COMP-02 (weight — depending on Option A or B):**
- Option A: three TextNodes with `weight:"regular"`, `weight:"medium"`, `weight:"bold"` — tripwire asserts `"weight":"medium"`.
- Option B: one TextNode with `style:"strong"` — tripwire asserts `"style":"strong"`.

**COMP-03 (switch variant):**
- One CheckboxNode with `variant:"switch"` — tripwire asserts `"variant":"switch"`.
- One CheckboxNode with `variant` OMITTED — proves omitted = default (WhenWritingNull posture; not `"variant":null`).

**COMP-04 (AvatarNode):**
- A bare AvatarNode (all fields omitted — proves absent-never-null on the wire; the CLASS-2 defect `findNulls` catches).
- One AvatarNode per size (`sm`/`md`/`lg`/`xl`) — proves the closed `AvatarSize` enum crosses on both backends.
- One AvatarNode per tone × mode (initials + tone; icon + tone; image — the priority table).
- Meaning-carrying (alt set) — proves the a11y string crosses.

**Fixture `$comment` clause to append** (matches the ICON-09 clause tail style):

```
v8.0.0 (COMP-01..COMP-04, foundations for the composite-nodes layer): buildVm renders a 'Foundations' section covering the four additions. TEXT-CAPTION: one TextNode per style value including "caption" (proves the closed-union grew to 7 members; expectBodyContains asserts "style":"caption" crosses). TEXT-WEIGHT: [ shape-dependent — Option A: three TextNodes weight:"regular"/"medium"/"bold", expectBodyContains asserts "weight":"medium"; Option B: one TextNode style:"strong", expectBodyContains asserts "style":"strong" ]. CHECKBOX-SWITCH: two CheckboxNodes — one with variant:"switch" (asserts "variant":"switch"), one with variant OMITTED (proves absent-never-null per WhenWritingNull gotcha #8). AVATAR: a bare AvatarNode (Initials/Image/Icon/Size/Tone/Alt ALL absent — proves gotcha #8 posture, the class-2 defect findNulls catches), one per size sm/md/lg/xl (proves the closed AvatarSize enum crosses on both backends), one per content mode (initials+tone, icon+tone, image-only), and a meaning-carrying one (alt:"Ada Lovelace"). Captured by the existing GET steps; the initial step's expectBodyContains asserts "type":"avatar", "size":"xl", "initials":"AL", "tone":"success", "image":"https://vms.example/avatar-ada.png", "icon":"user" cross (coverage tripwires so the branch can't go vacuous — banked lesson: a diff can only prove things about code it actually RUNS). NOTE: the CLIENT-SIDE rendering (font sizing per size, .vms-avatar--icon SVG reuse via renderIconSvg, .vms-field--switch slider styling, .vms-text--caption text-xs muted-opacity emission) is browser-only and NOT part of parity — parity proves only that the fields serialize identically across backends.
```

**`expectBodyContains` tripwires to add to the initial GET step** (matches the pattern at `feature-probe.json:11-25`):

```json
"\"style\":\"caption\"",
"\"variant\":\"switch\"",
"\"type\":\"avatar\"",
"\"size\":\"xl\"",
"\"initials\":\"AL\"",
"\"tone\":\"success\"",
"\"image\":\"https://vms.example/avatar-ada.png\"",
"\"icon\":\"user\""
```

Plus for weight (whichever shape ships): `"\"weight\":\"medium\""` (Option A) or `"\"style\":\"strong\""` (Option B).

**Why the tripwires matter — banked lesson from AGENTS.md:** every `expectBodyContains` string is a substring only its branch emits. If a backend silently normalizes an enum-vs-string difference, drops the field entirely, or the fixture's own configuration stops exercising the branch (as happened with `HELPDESK_SEED=0`), the diff prints "all backends agree" over a real drift. The tripwire makes vacuous coverage fail loudly.

---

## 10. Test files — jsdom + .NET, FAIL-before/PASS-after by mutation

**Analog for jsdom tests:** `viewmodel-shell/test/icon-render.test.ts` (DOM shape + class-name + a11y attribute checks) + `viewmodel-shell/test/icon-wire.test.ts` (compile-time type coverage + walker-rule FAIL/PASS mutation).

**Icon render test pattern, quoted** (icon-render.test.ts:31-50):

```typescript
describe("Standalone IconNode (ICON-03)", () => {
  it("bare — default size md, decorative aria-hidden", () => {
    const { container, render } = setup();
    render({ type: "icon", name: "sparkles" });
    const svg = container.querySelector("svg.vms-icon") as SVGElement;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("class")).toBe("vms-icon vms-icon--md");
    expect(svg.getAttribute("width")).toBe("20");
    expect(svg.getAttribute("height")).toBe("20");
    ...
    // Decorative branch: aria-hidden, no role, no aria-label.
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
    ...
  });
```

**Icon wire test pattern, quoted** (icon-wire.test.ts:19-37):

```typescript
describe("IconNode wire shape (ICON-01)", () => {
  it("compiles with only the required name field", () => {
    const icon: IconNode = { type: "icon", name: "sparkles" };
    expect(icon.type).toBe("icon");
    expect(icon.name).toBe("sparkles");
  });

  it("compiles with all optional fields set", () => {
    const icon: IconNode = {
      type: "icon",
      name: "trash-2",
      size: "sm",
      tone: "danger",
      label: "Delete",
    };
    ...
  });
```

**.NET serialization pattern, quoted** (IconNodeSerializationTests.cs:22-58):

```csharp
public class IconNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };
    ...
    [Fact]
    public void IconNode_SerializesTypeAsIcon()
    {
        var node = new IconNode(IconName.Sparkles);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"icon\"", json);
    }

    [Fact]
    public void IconNode_MultiWordName_SerializesAsKebabCase()
    {
        var node = new IconNode(IconName.ShieldCheck);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"name\":\"shield-check\"", json);
    }
```

**What to copy — Phase 23 test files:**

- **jsdom `test/text-caption.test.ts`:** TextNode with `style:"caption"` renders `<span class="vms-text vms-text--caption">`; asserts computed `font-size` equals `var(--vms-text-xs)` (via `getComputedStyle` — icon-render.test.ts:35-40 pattern). Mutation-test by reverting the switch-arm class emission and watching the test fail.

- **jsdom `test/text-weight.test.ts`:** TextNode with `weight:"medium"` renders `<span class="vms-text vms-text--weight-medium">` (Option A) OR TextNode with `style:"strong"` renders `<span class="vms-text vms-text--strong">` (Option B); asserts computed `font-weight`.

- **jsdom `test/checkbox-switch.test.ts`:** CheckboxNode with `variant:"switch"` renders `<label class="vms-checkbox vms-field--switch"><input type="checkbox" role="switch">...`; asserts (a) the `.vms-field--switch` class is present, (b) `input.getAttribute("role") === "switch"`, (c) `input.type === "checkbox"` (wire semantics unchanged), (d) toggling still writes to the bind + dispatches the action (test the change-listener path). Mutation-test each assertion.

- **jsdom `test/avatar-render.test.ts`:** All four content modes (image, initials, icon, empty) — asserts DOM tag (`<img>` vs `<div>`), class list, `role="img"` (non-image), computed `aria-label` (per CONTEXT §4 priority table), and that icon-mode contains a nested `.vms-icon` from `renderIconSvg`. Mutation-test the priority resolution (swap `image` and `initials` conditions to prove image wins).

- **`test/foundations-wire.test.ts`:** Static compile-time TypeScript assertions — `AvatarNode` with only `type`; `AvatarNode` with all fields set; `AvatarSize` accepts sm/md/lg/xl only (spot-check pattern from icon-wire.test.ts:39-51); `CheckboxNode.variant` accepts checkbox/switch only.

- **.NET `Tests/FoundationsSerializationTests.cs`** (or one file per addition — `TextCaptionSerializationTests.cs`, `TextWeightSerializationTests.cs`, `CheckboxSwitchSerializationTests.cs`, `AvatarNodeSerializationTests.cs`):
  - `new AvatarNode(Initials: "AL")` serializes as `{"type":"avatar","initials":"AL"}` — proves discriminator + type.
  - `new AvatarNode(Size: AvatarSize.Xl)` serializes as `"size":"xl"` — proves KebabEnum kebab conversion.
  - `new AvatarNode()` (all optionals null) serializes as `{"type":"avatar"}` — proves WhenWritingNull (the class-2 defect `findNulls` catches).
  - `new TextNode(Value: "Caption text", Style: TextStyle.Caption)` serializes as `"style":"caption"`.
  - `new CheckboxNode(Name: "notify", Bind: "notify", Label: null, Action: null, Variant: CheckboxVariant.Switch)` serializes as `"variant":"switch"`.

**AGENTS.md test-suite rules apply — every test must ship green as part of the phase (`viewmodel-shell-dotnet/Tests` was uncompilable 3.0.0 → 3.3.0 because it was not run in the green-tree gate; now it is).**

---

## 11. `demo/Showcase/frontend/src/main.ts` — Foundations demo tab

**Analog:** Icons gallery section at `main.ts:806-857` — the Phase 22 shipped adoption pattern (a new section-under-a-tab covering sizes × tones × the complete curated inventory).

**Icons gallery, quoted** (main.ts:806-826):

```typescript
    // ── icons (v7.0.0 — the framework's first icon primitive) ────────────
    { type: "section", heading: "Icons — IconNode (v7.0.0)", children: [
      { type: "text", value: "The framework's first icon primitive. Wire carries only a NAME from the curated Lucide subset (~102 icons); the framework owns the SVG payload, the size mapping (xs=12 / sm=16 / md=20 / lg=24 / xl=32 px), and stroke=currentColor so tone (or the parent text's color) drives the tint. Apps describe with a name; framework renders.", style: "muted" },

      { type: "text", value: "Sizes — the same icon at all 5 sizes", style: "subheading" },
      { type: "section", layout: "row", align: "center", children: [
        { type: "icon", name: "sparkles", size: "xs" },
        { type: "icon", name: "sparkles", size: "sm" },
        { type: "icon", name: "sparkles", size: "md" },
        { type: "icon", name: "sparkles", size: "lg" },
        { type: "icon", name: "sparkles", size: "xl" },
      ]},

      { type: "text", value: "Tones — a small representative row across all 4 semantic tones (plus a currentColor default)", style: "subheading" },
      { type: "section", layout: "row", align: "center", children: [
        { type: "icon", name: "check-circle", tone: "success" },
        ...
```

**What to copy — Phase 23 Foundations tab** (matches CONTEXT §Specific ideas → Demo adoption locations):

Add a new tab or section to the components view at `main.ts:228-407` (a new "Foundations" tab, or a section inside the existing "Text styles" area — planner's call). The section should demonstrate:

- **Caption tier:** Three TextNodes side-by-side — `body`, `muted`, `caption` — for visual comparison of the three tiers.
- **Weight:** Three TextNodes with `weight:"regular"/"medium"/"bold"` (Option A) or the `strong` style value alongside `body`/`muted` (Option B), all at `style:"body"` so weight is orthogonal.
- **Switch:** Three CheckboxNodes with `variant:"switch"` in a mini-Settings-row layout (one on, one off, one with a tooltip) alongside one classic `variant`-omitted checkbox for contrast.
- **Avatar:** A grid of AvatarNodes at every `size × content-mode × tone` permutation. Follow the Phase 22 icons-gallery `layout:"row"` shape for the size row, then a second grid for the tone × mode matrix. Include one `image` mode (with a placeholder svg-data URL, matching the `demo/Showcase` image-section pattern at `main.ts:260-261`).

**Fleet-adoption discipline** (AGENTS.md — "helpers ship WITH demo adoption in the same batch"): the Showcase adoption lands in the SAME phase as the primitives it demonstrates. Do not defer to Phase 24-26.

---

## 12. Release ritual — NONE this phase

**Analog:** every prior aligned release (v7.0.0 ICON-11) — BUT explicitly OUT-OF-SCOPE per CONTEXT §5 (locked decision: batch-then-ship).

- Phase 23 does NOT publish. No `npm publish`. No `dotnet nuget push`. No version bump on `viewmodel-shell/package.json` or `AshleyShrok.ViewModelShell.csproj`.
- CHANGELOG entries accumulate under an "Unreleased — v8.0.0 (in progress)" heading. Format matches CONTEXT §Specific ideas:

  ```md
  ## Unreleased — v8.0.0 (in progress)

  ### Added
  - `TextNode.style: "caption"` — the 3rd typographic tier (text-xs, muted, opacity). (COMP-01)
  - `TextNode` [weight axis TBD] — semi-bold body-size weight variant. (COMP-02)
  - `CheckboxNode.variant: "switch"` — visual switch-slider render mode; wire and semantics unchanged. (COMP-03)
  - `AvatarNode` — new standalone primitive; circular slot with initials/image/icon content-resolution priority, closed size + tone. (COMP-04)
  ```

- Green-tree gate STILL applies before every commit (`npx vitest run` + all 5 `check:*` + `bun run parity/run.ts` + `viewmodel-shell-dotnet/Tests` + every `demo/**/*.Tests.csproj`). Non-negotiable.
- **Release ritual will run at Phase 26 closeout** — v8.0.0 publishes with all 10 composites + 3 wire tweaks + 4 foundations in one aligned release. Planner references AGENTS.md "Working agreement" verbatim for that; NOT this phase.

---

## Summary — analogs at a glance

| Requirement | Primary analog | New machinery needed? |
|---|---|---|
| COMP-01 (TextNode `style:"caption"`) | `TextNode.style` closed union at `index.ts:997` + `.vms-text--muted` CSS at `default.css:1127` | No — closed-union grow + one CSS rule |
| COMP-02 (TextNode weight axis) | Option A: `TextNode.tone` orthogonal-axis pattern at `index.ts:1001`. Option B: `TextNode.style` closed union grow. Both fully patterned. | No — either shape has an in-repo analog |
| COMP-03 (CheckboxNode `variant:"switch"`) | `BadgeNode.emphasis` / `ButtonNode.emphasis` closed union pattern; `.vms-checkbox__mark` ::after slider technique in default.css:911 | No — closed-enum on existing node + CSS restyle of an existing selector |
| COMP-04 (AvatarNode) | `IconNode` at `index.ts:1433-1455` (fresh Phase 22 shipment) — leaf-node + closed-enum size + tone + a11y label. Renderer reuses `renderIconSvg`. | No — every mechanism was landed in Phase 22 |
| Parity FeatureProbe extension | ICON-09 pattern: `handler.ts:1007-1041` + `.NET FeatureProbeController.cs:1091-1139` + append `$comment` clause + `expectBodyContains` tripwires | No — EXTEND, don't add a new fixture |
| Test coverage (vitest + .NET) | `icon-render.test.ts` + `icon-wire.test.ts` + `IconNodeSerializationTests.cs` | No — mutation-tested render + wire + validator suite mirror line-for-line |
| Showcase demo adoption | Icons gallery at `main.ts:806-857` | No — new section following the exact same shape |
| Release | N/A — CONTEXT §5 defers to Phase 26 | Zero this phase; every gate green before commit |

**Verdict:** no new machinery. Every pattern this phase needs is already shipped and in-repo. The executor's job is to follow the analogs (especially the fresh Phase 22 IconNode / ICON-09 template for AvatarNode) verbatim, not to invent. The two design questions (weight axis shape; avatar icon-mode `renderIconSvg` reuse) are decided at planning time; both branches have the same analog set, so this map is neutral on the choice.

---

## PATTERN MAPPING COMPLETE
