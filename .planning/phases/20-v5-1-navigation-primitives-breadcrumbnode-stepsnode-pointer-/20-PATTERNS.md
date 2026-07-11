# Phase 20: v5.1 Navigation Primitives — Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 13 (2 new node types × both backends × renderer/CSS/validators/parity/demo, + the pointer-cursor CSS)
**Analogs found:** 13 / 13 (every touch point has an exact in-repo precedent — this is a pure "add-a-node twice, byte-aligned" phase)

> ⚠️ **CRITICAL up-front finding (pointer-cursor):** the fix this phase names may already be shipped. `styles/default.css:934` already contains `.vms-table__row--clickable { cursor: pointer; }`, and `browser.ts:1725` already emits that class when `row.action` is set (`if (row.action) rowClass += " vms-table__row--clickable";`). The CONTEXT + design both mandate "GREP first, don't assert from memory" — this map does the grep: **the clickable-row pointer cursor is PRESENT.** The executor must confirm what (if anything) is actually missing before editing default.css. See file #4 / #12 below.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `viewmodel-shell/src/index.ts` | wire-type (TS) | transform (declare) | `LinkNode` (crumb) + `ChartNode`/`ChartSeries` (steps: node + sub-record list + closed enum) + `DividerNode`/`BadgeNode` (leaf add template) | exact |
| `viewmodel-shell-dotnet/ViewModels.cs` | wire-type (.NET) | transform (declare) | `LinkNode` record + `ChartSeries`/`ChartNode` records + `DividerNode` + `[JsonDerivedType]` block | exact |
| `viewmodel-shell/src/browser.ts` | renderer | transform (emit DOM/classes) | `link()` (aria-current + active class) + `badge()`/`statBar()`/`emptyState()` (multi-part `__part` naming) + `divider()` (orientation branch) | exact |
| `viewmodel-shell/styles/default.css` | stylesheet | — | `.vms-link--active`, `.vms-list-item--{state}` (state-derivation), `.vms-badge` token pattern; **pointer-cursor target = `.vms-table__row--clickable` (line 934, already present)** | exact |
| `viewmodel-shell/src/server.ts` (validators) | validator (TS) | tree-walk | `collectActions` tabs arm (breadcrumb if crumbs carry `action`) + the "action-free leaf" fall-through (steps) | exact |
| `viewmodel-shell-dotnet/ViewModels.cs` (validators) | validator (.NET) | tree-walk | `Collect` TabsNode arm + `WalkForSectionAction` leaf comment | exact |
| `viewmodel-shell/src/tui.tsx` | renderer (TUI) | transform | `renderNode` `case "divider"` (inline degrade) + `case "fits"` (deliberate degrade) | exact |
| `demo/FeatureProbe-bun/handler.ts` | parity fixture backend (TS) | transform | `feedbackSection` / `chartSection` (static view-shape section) | exact |
| `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` | parity fixture backend (.NET) | transform | `feedbackSection` (.NET byte-identical twin) | exact |
| `parity/fixtures/feature-probe.json` | parity fixture spec | data | the `$comment` running-doc convention (no new POST step — static view-shape rides existing GET steps) | exact |
| `demo/Showcase/frontend/src/main.ts` | demo (frontend) | — | gallery `{ type: "section", heading, children }` entries | exact (discretionary host) |
| `CHANGELOG.md` + `MIGRATION.md` | docs | — | prior additive-node entries | exact |
| `viewmodel-shell/package.json` + `AshleyShrok.ViewModelShell.csproj` | config (version) | — | current `5.0.1` (npm) / `5.0.0` (.NET) → both `5.1.0` | exact |

> ⚠️ **Version skew observed:** npm `package.json` is at `5.0.1` but `.csproj <Version>` is `5.0.0` (npm shipped a `5.0.1` patch the .NET side skipped — a legal asymmetric bump). Both go to `5.1.0` this release; CHANGELOG entry must name both moving packages.

---

## Pattern Assignments

### 1. `viewmodel-shell/src/index.ts` (wire-type, TS)

Add two interfaces + two union entries. Three analogs cover the two nodes' distinct shapes.

**Union registration** (`index.ts:132-154`) — add `| BreadcrumbNode` and `| StepsNode`:
```typescript
export type ViewNode =
  | PageNode
  ...
  | BadgeNode
  | ChartNode;   // ← append the two new entries here
```

**BreadcrumbNode — analog is `LinkNode`** (`index.ts:465-476`). LinkNode is the settled model for "nav vs dispatch" the design's open point references:
```typescript
export interface LinkNode {
  type: "link";
  label: string;
  href: string;
  /** true = open outside current app context (browser: new tab + noopener) */
  external?: boolean;
  /** true = this link points at the current location (nav "you are here")... */
  active?: boolean;
}
```
**Adaptation:** breadcrumb is `{ type: "breadcrumb", items: BreadcrumbItem[] }` where the item sub-record mirrors LinkNode's nav fields. Per CONTEXT decision (LOCKED shape `{label, href?}`) + the open design point (settle in plan), the recommended crumb shape is `{ label: string; href?: string; external?: boolean; action?: ActionEvent }` — `href` = browser nav (external ⇒ new tab, exactly LinkNode), `action` = dispatch (the `ActionEvent` type at `index.ts:3`). NO per-item "current" flag — the LAST item is auto-current (position is the signal). If you include `action`, the item is a **dispatch-bearing descendant** → the action-name walk MUST descend into it (see file #5). Document the separator as framework-owned (off the wire) in the TSDoc, matching how `DividerNode` documents its framework-drawn separator.

**StepsNode — analog is `ChartNode` + `ChartSeries`** (`index.ts:734-763`) — the precedent for "a node carrying an ordered list of small sub-records + a closed-enum string field with an OMITTED-means-default rule":
```typescript
export interface ChartSeries {
  name: string;
  data: number[];
  tone?: "danger" | "warning" | "success" | "info";
}
export interface ChartNode {
  type: "chart";
  /** CLOSED union; OMITTED = "bar". The renderer treats an absent `kind` as "bar". */
  kind?: "bar" | "line" | "area" | "pie" | "donut";
  labels: string[];
  series: ChartSeries[];
  ...
}
```
**Adaptation:** `{ type: "steps", steps: StepItem[]; current: number; orientation?: "horizontal" | "vertical" }` with `StepItem = { label: string; description?: string }`. `orientation` is the closed enum whose OMITTED = `"horizontal"` (document "the renderer treats an absent `orientation` as `horizontal`", exactly ChartNode's `kind` phrasing). `current` is a 0-based number (per-step done/current/upcoming DERIVES from it — no per-step status field). TSDoc must state the framework owns markers/connectors/reflow/a11y (never on the wire), mirroring ChartNode's "the wire carries only data" note. **Layout-policy note (P1/P2):** orientation is a closed-enum INTENT, not a raw directive; the horizontal→vertical collapse is intrinsic (zero viewport breakpoints) — the same discipline as the `switcher`/`cards` fields already in this file.

---

### 2. `viewmodel-shell-dotnet/ViewModels.cs` (wire-type, .NET — byte-identical twin)

Three things: the `[JsonDerivedType]` discriminator registrations, the node records, and the item sub-records. **The optional-field attribute choice is the whole game** (gotcha #8) — match the TS optional posture exactly.

**Discriminator block** (`ViewModels.cs:376-397`) — append two lines:
```csharp
[JsonDerivedType(typeof(BadgeNode),      "badge")]
[JsonDerivedType(typeof(ChartNode),      "chart")]
// ← add: [JsonDerivedType(typeof(BreadcrumbNode), "breadcrumb")]
//        [JsonDerivedType(typeof(StepsNode),       "steps")]
```

**BreadcrumbNode — analog is `LinkNode` record** (`ViewModels.cs:921-931`) — shows the exact optional-bool vs optional-string attribute split:
```csharp
public record LinkNode(
    string Label,
    string Href,
    // Dropped from the wire when false (WhenWritingDefault) → absent, matching TS `external?`.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool External = false,
    // Nullable + omitted-when-null → matches TS `active?: boolean` (absent = not active).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Active = null
) : ViewNode;
```
**Adaptation:** the crumb sub-record is a plain `public record BreadcrumbItem(string Label, [property: JsonIgnore(...WhenWritingNull)] string? Href = null, [property: JsonIgnore(...WhenWritingDefault)] bool External = false, [property: JsonIgnore(...WhenWritingNull)] ActionDescriptor? Action = null);` (note `ActionDescriptor` is the .NET twin of `ActionEvent` — see how `TabItem`/`TableRow.Action` use it at lines 828, 886). `BreadcrumbNode(IReadOnlyList<BreadcrumbItem> Items) : ViewNode;`. **String-attribute-ish → prefer `string`** (CONTEXT rule): `Href` is `string?` (not a union). If `Action` is included, both validators must record it (file #6).

**StepsNode — analog is `ChartSeries`/`ChartNode` records** (`ViewModels.cs:814-826`) — the "required+leading list, then trailing nullable closed-enum string" template:
```csharp
public record ChartSeries(
    string Name,
    IReadOnlyList<double> Data,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tone = null
);
public record ChartNode(
    IReadOnlyList<string> Labels,
    IReadOnlyList<ChartSeries> Series,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Kind = null,
    ...
) : ViewNode;
```
**Adaptation:** `public record StepItem(string Label, [property: JsonIgnore(...WhenWritingNull)] string? Description = null);` then `public record StepsNode(IReadOnlyList<StepItem> Steps, int Current, [property: JsonIgnore(...WhenWritingNull)] string? Orientation = null) : ViewNode;`. `Orientation` is `string?` (free-form mirroring the TS CLOSED union — the closed set is enforced TS-side + validated by parity, exactly the ChartNode `Kind`/`Tone` comment at lines 802-804). `Current` is a plain required `int` (like `ProgressNode(int Value)` at line 836 — NOT nullable, NOT WhenWritingDefault, because `0` is a meaningful value that must always serialize). **Maintainer rule reminder (file header, lines 8-54):** a new nullable wire field carries `WhenWritingNull`; an optional non-nullable bool whose `false` means absent carries `WhenWritingDefault`.

---

### 3. `viewmodel-shell/src/browser.ts` (renderer — DOM + `.vms-*` class emission)

**Import list** (`browser.ts:14-20`) — add `BreadcrumbNode, StepsNode` to the `import type { ... }` block.

**Dispatch switch** (`browser.ts:375-398`) — add two cases:
```typescript
case "badge":        return this.badge(n, parent);
case "chart":        return this.chart(n, parent);
// ← add: case "breadcrumb": return this.breadcrumb(n, parent, on);
//        case "steps":      return this.steps(n, parent);
```
(breadcrumb takes `on` only if crumbs dispatch actions; steps is non-interactive so no `on`.)

**BreadcrumbNode renderer — analog is `link()`** (`browser.ts:1449-1460`) for the `aria-current` + active + external pattern:
```typescript
private link(n: LinkNode, parent: HTMLElement): void {
  const a = document.createElement("a");
  a.className = n.active ? "vms-link vms-link--active" : "vms-link";
  a.href = n.href;
  a.textContent = n.label;
  if (n.active) a.setAttribute("aria-current", "page");
  if (n.external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
  parent.appendChild(a);
}
```
**Adaptation:** build a `<nav aria-label="breadcrumb">` landmark → `<ol class="vms-breadcrumb">` → one `<li class="vms-breadcrumb__item">` per item. Non-last items with `href` render an `<a>` (reuse the external `target`/`rel` two lines verbatim); non-last with `action` render a `<button>`/clickable that calls `on({ name: item.action.name })` (see how `emptyState`→`button` dispatches, and the row-action click wiring at `browser.ts:1730`). The LAST item renders as plain text (a `<span>`) with `aria-current="page"` set on its `<li>` (the LinkNode `aria-current` line is the exact precedent). The framework draws the separator between items (a `::before` on `__item` or a `<span class="vms-breadcrumb__separator" aria-hidden="true">` — CSS-owned, off the wire).

**Class-naming convention** — grep-confirmed from `statBar()` (`browser.ts:1477-1494`) and `emptyState()` (`browser.ts:1934-1953`): the block class is `.vms-<node>` and inner parts are `.vms-<node>__<part>` (e.g. `vms-stat-bar__item` / `vms-stat-bar__value` / `vms-empty-state__heading` / `vms-empty-state__message`). Follow it exactly: `vms-breadcrumb` / `vms-breadcrumb__item` / `vms-breadcrumb__separator`; `vms-steps` / `vms-steps__step` / `vms-steps__marker` / `vms-steps__label` / `vms-steps__description` / `vms-steps__connector`.

**State-modifier convention — analog is `listItem()`** (`browser.ts:935-942`) + `badge()` (`browser.ts:1957-1962`), the BEM `--{state}` idiom:
```typescript
li.className = `vms-list-item${n.state ? ` vms-list-item--${n.state}` : ""}${
  n.tone ? ` vms-list-item--${n.tone}` : ""}`;
```
**Adaptation (StepsNode renderer):** derive each step's state from `current` in the renderer (`index < current` → `"done"`, `=== current` → `"current"`, `> current` → `"upcoming"`) and emit `vms-steps__step vms-steps__step--{derived}`. Orientation → an orientation modifier on the root (`vms-steps vms-steps--vertical` when `orientation === "vertical"`; omit for horizontal, matching how modifier classes are only appended when non-default — see `divider()` at `browser.ts:1462-1475`). a11y (per LOCKED decision): the group carries an accessible name; the current step's element gets `aria-current="step"`; each marker conveys complete/current/upcoming via `aria-label` (never color alone); the stepper is NOT focusable and NOT `role="progressbar"`. Numbered markers with a check glyph for done.

---

### 4. `viewmodel-shell/styles/default.css` (stylesheet)

**Pointer-cursor fix — GREP RESULT: ALREADY PRESENT.**
```css
/* default.css:932-946 (current state) */
.vms-table__row { transition: background var(--vms-t); }
.vms-table__row--clickable { cursor: pointer; }              /* ← already here */
.vms-table__row--clickable:hover { background: var(--vms-surface); }
.vms-table__row--clickable:focus-visible { outline: 2px solid var(--vms-accent); outline-offset: -2px; }
...
.vms-table__row--disabled.vms-table__row--clickable { cursor: default; }   /* disabled overrides */
```
The renderer emits it (`browser.ts:1725`: `if (row.action) rowClass += " vms-table__row--clickable";`). **The executor must reconcile the design's "pointer cursor is missing" claim against this reality before touching CSS** — either (a) the fix is a no-op (confirm + note in the plan, ship nothing here), or (b) the real gap is narrower than "clickable rows have no pointer" and must be re-scoped. The sibling `.vms-section--clickable { cursor: pointer; }` (line 422) confirms the framework's established "clickable → pointer" idiom is already applied at both the row and section level.

**New-component styling — analog is the `.vms-link` / `.vms-link--active` block** (`default.css:795-813`) for breadcrumb link/current states:
```css
.vms-link { color: var(--vms-accent); text-decoration: none; border-bottom: 1px solid transparent; ... }
.vms-link:hover { border-bottom-color: var(--vms-accent); }
.vms-link--active { border-bottom-color: var(--vms-accent); font-weight: 600; }
```
**Adaptation (breadcrumb):** links = `--vms-accent`; the current (last) item = `--vms-text` + `font-weight: 600` (bold, per SPECIFIC ideas); separator = `--vms-text-muted`. Use the spacing/radius tokens (`--vms-space-xs`, `--vms-space-sm`) — never literals.

**Multi-state token pattern — analog is `.vms-list-item--{state}`** (`default.css:752-778`) and the `.vms-badge` local-var pattern (`default.css:1129-1164`):
```css
.vms-badge { --_badge-tone: var(--vms-text-muted); ... background: color-mix(in srgb, var(--_badge-tone) 16%, var(--vms-surface)); }
.vms-badge--primary { background: var(--_badge-tone); border-color: var(--_badge-tone); color: #fff; }
```
**Adaptation (steps):** done/current markers + connectors = `--vms-accent`; upcoming = `--vms-text-muted`; current marker ring = `--vms-accent-glow` (per SPECIFIC ideas, all existing tokens at `default.css:22-26`). The connector line is drawn marker-center to marker-center behind the markers (a `::before` on the step/marker with opaque marker circles on top) — the sketch CSS is a proven starting point but must be re-classed to the `browser.ts`-emitted class names. Horizontal reflow to vertical must be intrinsic (container query or flex-wrap — ZERO viewport `@media`, per P1). **⚠️ aa-contrast HAND-CHECK:** the check script (`scripts/check-aa-contrast.mjs`) `PAIRS` list (lines 90-123) uses `--vms-*` variables and does NOT cover literal `#fff`-on-accent (note `.vms-badge--primary`'s white-on-accent is NOT in PAIRS). If a step marker fills accent with white text/number, that white-on-`--vms-accent` pair is NOT auto-checked — hand-verify it clears WCAG-AA in default + all 12 themes (the CONTEXT green-tree gate calls this out explicitly).

---

### 5. `viewmodel-shell/src/server.ts` — BOTH tree-validators (TS)

Two walks must be taught the new nodes. Both are `switch (node.type)` recursions with a `default: return`.

**`collectActions` (action-name uniqueness)** — analog is the `tabs` arm (`server.ts:175-178`) which records each sub-item's action:
```typescript
case "tabs": {
  const tabs = node as TabsNode;
  for (const tab of tabs.tabs) recordAction(tab.action, enclosingForm, out);
  return;
}
```
**Adaptation:** **IF breadcrumb crumbs carry an optional `action`** (the settled open-point shape), add a `case "breadcrumb"` that iterates `items` and, for each item with an `action`, calls `recordAction(item.action, enclosingForm, out)` — exactly the tabs pattern with an optional guard. This is REQUIRED if crumbs dispatch: the design's whole rationale (VMS apps nav by dispatch) means crumb action names must be uniqueness-checked, or you reintroduce the "silently exempt dispatch-bearing descendant" bug the `empty-state` arm (`server.ts:240-247`) exists to prevent. **StepsNode carries NO actions** → it falls through `default: return` as an action-free leaf (like `text`/`badge`/`chart`, documented at `server.ts:249-253`) — but ADD it to that leaf comment list so the "no fits-style blind spot" intent stays explicit.

**`walkForSectionAction` (invalid_tree / nested section-interaction)** — this walk only needs to descend into nodes that can *contain SectionNode children*. Neither breadcrumb items nor steps hold `ViewNode` children (they hold plain `{label,...}` objects), so **both are leaves here** and fall through with no new arm — BUT follow the `ChartNode` precedent (`server.ts:433-434` comment and the .NET twin at `ViewModels.cs:1171-1176`) and add breadcrumb/steps to the "leaf-like nodes carry no SectionNode descendants — no recursion needed" comment so a future reviewer knows the omission is deliberate, not a missed walk.

---

### 6. `viewmodel-shell-dotnet/ViewModels.cs` — BOTH tree-validators (.NET, byte-identical)

Same two walks, in the `ViewTreeValidation` class. Mirror the TS changes exactly.

**`Collect`** — analog is the `TabsNode` arm (`ViewModels.cs:1227-1229`):
```csharp
case TabsNode tabs:
    foreach (var tab in tabs.Tabs) Record(tab.Action, enclosingForm, sink);
    break;
```
**Adaptation:** if crumbs carry `Action`, add `case BreadcrumbNode bc: foreach (var item in bc.Items) if (item.Action is { } a) Record(a, enclosingForm, sink); break;`. StepsNode → falls through (no `case`), add to the leaf comment at `ViewModels.cs:1283-1287`.

**`WalkForSectionAction`** — StepsNode + BreadcrumbNode are leaf-like (no SectionNode descendants); no new `case`, extend the leaf comment at `ViewModels.cs:1171-1176`.

---

### 7. `viewmodel-shell/src/tui.tsx` (TUI renderer — deliberate degradation)

**`renderNode` switch** (`tui.tsx:948-981`) — analog is the inline `divider` case and the deliberate `fits` degrade:
```typescript
case "divider": return <text key={key} fg="#555555">{node.orientation === "vertical" ? "│" : "─".repeat(40)}</text>;
case "fits": { /* render the guaranteed-fits LAST candidate ... */ }
default: return <UnsupportedView key={key} type={...} />;
```
**Adaptation:** add `case "breadcrumb"` (render items joined by a text separator, e.g. `Home › Products › Widget`) and `case "steps"` (render each step as a text line with a state marker, e.g. `✓ Cart / ▸ Shipping / Payment`). The TUI is `@experimental` — the bar is only "doesn't break + degrades sensibly" (the `fits` comment at `tui.tsx:970-978` states this contract). Without these cases they hit `UnsupportedView` — acceptable but ugly; add sensible text degradation.

---

### 8-10. Parity fixtures — FeatureProbe (both backends) + fixture spec

**`demo/FeatureProbe-bun/handler.ts`** — analog is `feedbackSection` (`handler.ts:609-625`), a static view-shape section appended to `buildVm`'s page children (`handler.ts:682-704`):
```typescript
const feedbackSection: ViewNode = {
  type: "section",
  heading: "Feedback primitives",
  variant: "card",
  children: [
    { type: "badge", label: "New" },                              // bare → tone/emphasis absent
    { type: "badge", label: "3", tone: "danger" },                // tone-only
    { type: "badge", label: "Beta", tone: "info", emphasis: "secondary" },  // tone+emphasis
    { type: "empty-state", heading: "No items yet" },             // bare → message/action absent
    { type: "empty-state", heading: "Nothing here", message: "...",
      action: { type: "button", label: "Add item", action: { name: "feedback-cta" }, emphasis: "primary" } },
  ],
};
// ... then in the return page.children array: feedbackSection,
```
**Adaptation:** add a `navSection` (or two) exercising the FULL wire matrix for parity's omitted-vs-present byte-diff: a breadcrumb with an href-only crumb + (if included) an action crumb + the auto-current last item; a `steps` with `orientation` OMITTED (proves absent = default horizontal), one with `orientation: "vertical"` (proves the literal string crosses), and a step with `description` omitted vs present. `current` set to a mid index. Append the section(s) to the `return { ... children: [...] }` array (`handler.ts:687-703`). Give any crumb action a UNIQUE name (like `feedback-cta`) so the action-name walk descent (file #5) is exercised. Add a code comment "byte-identical to the .NET twin" (the standing convention on every section).

**`demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`** — analog is the `.NET feedbackSection` twin (`FeatureProbeController.cs:675-688`):
```csharp
pageChildren.Add(new SectionNode(
    Heading: "Feedback primitives",
    Variant: "card",
    Children: new ViewNode[]
    {
        new BadgeNode("New"),
        new BadgeNode("3", Tone: "danger"),
        new BadgeNode("Beta", Tone: "info", Emphasis: "secondary"),
        new EmptyStateNode("No items yet"),
        new EmptyStateNode("Nothing here", Message: "Add the first item.",
            Action: new ButtonNode("Add item", new ActionDescriptor("feedback-cta"), Emphasis: "primary")),
    }));
```
**Adaptation:** construct the SAME nav section(s) with `new BreadcrumbNode(...)`/`new StepsNode(...)` — the field values, ordering, and omitted-vs-present choices must be **byte-identical** to the bun twin (same crumb labels/hrefs, same step labels, same `orientation` omit/set choices, same `current`). This is what `bun run parity/run.ts` diffs.

**`parity/fixtures/feature-probe.json`** — analog is the running `$comment` doc convention (`feature-probe.json:3`). The new nodes are **static view-shape captured by the existing GET steps** (`initial`/`fresh-*`), so NO new POST step is needed (same as `feedbackSection`, `chartSection`, the badge/divider additions). Append a sentence to `$comment` describing what the new section proves (omitted `orientation`/`description`/`href` absent, set ones present, crumb action-name uniqueness). Only add a POST step if a crumb `action` needs its own dispatch coverage — but per the `axes-noop-*`/`nba-*` precedent, static wire-shape proof rides GET steps with no dispatch.

---

### 11. `demo/Showcase/frontend/src/main.ts` (demo — discretionary host)

Analog is the gallery's per-primitive sections (`main.ts:224`, `235`, `248`): `{ type: "section", heading: "...", children: [ ...nodes... ] }`. **Adaptation:** add a "Breadcrumb" and a "Steps" gallery section showing both nodes (steps in both orientations). Which demo hosts them is Claude's discretion per CONTEXT — Showcase is the natural gallery home. This is the visual reference Ashley's tailnet verification page draws from.

---

## Shared Patterns

### Optional-field wire attributes (.NET) — apply to every new nullable field
**Source:** `ViewModels.cs:8-54` (file header) + `LinkNode` (lines 921-931).
- nullable ref/`bool?`/`int?` optional → `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] T? Field = null`
- optional non-nullable `bool` whose `false` means "absent" → `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Field = false`
- required value that must ALWAYS serialize (e.g. `StepsNode.Current` = 0-based int, `0` is meaningful) → plain `int Current`, NO ignore condition (precedent: `ProgressNode(int Value)` at `ViewModels.cs:836`).
**Apply to:** every new field on `BreadcrumbNode`/`StepsNode`/`BreadcrumbItem`/`StepItem`.

### Prefer `string` over union/number for string-attribute-ish fields
**Source:** CONTEXT LOCKED rule + `ChartNode.Kind`/`.Tone` (`ViewModels.cs:802-804`, "free-form `string?` mirroring the TS CLOSED union — the closed set is enforced TS-side + validated by parity").
**Apply to:** `StepsNode.Orientation` (`string?`, not an enum), `BreadcrumbItem.Href` (`string?`).

### `.vms-<node>__<part>` class naming
**Source:** `browser.ts` `statBar()` (`vms-stat-bar__item`/`__value`/`__label`) + `emptyState()` (`vms-empty-state__heading`/`__message`).
**Apply to:** all breadcrumb/steps inner-element classes.

### Both validators descend into every dispatch-bearing descendant
**Source:** `server.ts` `collectActions` `empty-state` arm (240-247) + `.NET` `Collect` (1274-1281). The "missed-walk failure class" comment is the rationale.
**Apply to:** breadcrumb crumb `action` (if included) in BOTH `collectActions`/`Collect`. Steps + breadcrumb as documented action-free/section-free leaves in the leaf comments of all four walks (2 TS + 2 .NET).

### Byte-identical FeatureProbe twins are the parity contract
**Source:** every section in `handler.ts` carries a "byte-identical to the .NET twin" comment; `parity/run.ts` diffs the serialized responses step-for-step.
**Apply to:** the new nav section must be constructed identically in `handler.ts` and `FeatureProbeController.cs`.

---

## No Analog Found

None. Every touch point has an exact in-repo precedent. The two "newest leaf/structural node" additions (BadgeNode 3.0.0, DividerNode 3.1.0, ChartNode 4.1/reshaped 18) are recent, faithful templates for the entire add-a-node-twice workflow, and the pointer-cursor idiom already exists at both the row and section level.

---

## Metadata

**Analog search scope:** `viewmodel-shell/src/{index,browser,server,tui.tsx}.ts`, `viewmodel-shell/styles/default.css`, `viewmodel-shell/scripts/`, `viewmodel-shell-dotnet/ViewModels.cs`, `parity/{backends.json,fixtures/}`, `demo/FeatureProbe*/`, `demo/Showcase/frontend/src/`.
**Files scanned:** ~12 (targeted reads on the analog ranges — no full-file reloads).
**Pattern extraction date:** 2026-07-11
