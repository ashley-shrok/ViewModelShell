# Phase 28: Rich text WYSIWYG input primitive — Pattern Map

**Mapped:** 2026-07-31
**Files analyzed:** 15 files to be created/modified (see File Classification)
**Analogs found:** 15 / 15 — every add-site has a strong precedent in-repo.

Phase 28 ships a new leaf-ish input primitive (`RichTextFieldNode`) + a new Route B composite (`RichTextToolbarNode`) + a bundled-but-lazy third-party library (TipTap 2.x + turndown). Every one of the three has a load-bearing precedent already in the codebase:

- **Wire type + validator arms** — MessageNode (Phase 24) is the strongest analog (composite with typed slots + closed-enum role + state axis + optional slots), backed by AvatarNode (Phase 23) for the leaf-node validator shape.
- **Lazy dynamic-import from `browser.ts`** — ChartNode's `import("chart.js")` at `viewmodel-shell/src/browser.ts:898` is the EXACT precedent D-04 cites. Copy it verbatim (both the load site and the fail-loud handler).
- **FeatureProbe fixture extension + `expectBodyContains` tripwires** — Phase 27 (`feature-probe.json:112-118`) is the most recent extension pattern.
- **Iframe-scoped A/B tasting page** — StateAxisVerification-bun (Phase 27) is the tailnet-served real-bundle harness pattern; the D-03 before/after tasting scales it up to A-vs-B with per-panel iframes.
- **Release ritual** — Phase 27-11's operator-gated commit + publish + tag + advance-main is the byte-aligned template.

---

## File Classification

Every file the planner is expected to touch, classified by role and data flow so the planner can slot the work into dependency-ordered plans.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `viewmodel-shell/src/index.ts` (add 2 interfaces + union arms) | wire type | (leaf) | `AvatarNode` at :1554-1586 (leaf primitive); `MessageNode` at :1687-1723 (composite with typed slots + `state?`) | exact |
| `viewmodel-shell-dotnet/ViewModels.cs` (add 2 records + 2 `[JsonDerivedType]` + validator arms) | wire type | (leaf) | `AvatarNode` at :2111-2130; `MessageNode` at :2222-2252 | exact |
| `viewmodel-shell/src/browser.ts` (add 2 renderer methods, 2 dispatch arms, lazy TipTap+turndown import) | renderer / DOM binding | file-I/O-ish (dynamic import) + request-response (bind writes) | `chart()` at :741-884; `loadChart()` + `chartFailLoud()` at :895-939 | exact |
| `viewmodel-shell/styles/default.css` (add `.vms-rich-text-field` + `.vms-rich-text-toolbar` + variance classes) | design system CSS | (static) | `.vms-chart` (from Phase 12); the shipped `.vms-avatar--{size}` + `.vms-message--{role}` variance rules | role-match |
| `viewmodel-shell/src/server.ts` (add 2 validator arms) | tree validator | walk | `case "message"` at :219-231; `case "avatar"` at :500-506 | exact |
| `viewmodel-shell/src/markdown.ts` (audit; only touched if the D-Q4 sanitization audit surfaces a gap) | display pipeline | transform | existing `linkHrefRewrite` hook at :53-67 is the sanitization seam | role-match |
| `viewmodel-shell/package.json` (add `@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `turndown` to `dependencies`) | build metadata | (static) | `chart.js` in `devDependencies` + optional `peerDependency` (see below for D-04 divergence) | role-match |
| `viewmodel-shell/test/rich-text.test.ts` (NEW — adapter + lazy-import assertions) | test | (unit) | `viewmodel-shell/test/chart.test.ts` (Chart's `vi.mock("chart.js")` pattern for lazy adoption) | exact |
| `viewmodel-shell/agent-skill.md` (add a section on the rich text node) | agent-facing doc | (static) | existing sections of the file (parity-gated to the .NET twin) | role-match |
| `viewmodel-shell-dotnet/AgentSkill.md` (byte-identical re-copy) | agent-facing doc | (static) | same as above | exact |
| `.planning/design/composite-nodes-layer.md` (add `RichTextToolbarNode` row to §4 shipped-recipe inventory) | design doc | (append) | Phase 27's addendum at §5 end (state axis uniformity note) | role-match |
| `parity/fixtures/feature-probe.json` (add fixture emission + `expectBodyContains` tripwires) | parity fixture | wire assertion | Phase 27's state-probe additions at :112-118 | exact |
| `demo/FeatureProbe-bun/handler.ts` (add `RichTextFieldNode` + toolbar emissions to `buildVm`) | parity backend | wire emission | Phase 24's composite adoption at :1141-1230 (Primary Composites section) | exact |
| `demo/FeatureProbe/AspNetCore/ProbeController.cs` (mirror TS emissions) | parity backend | wire emission | Phase 24's Primary Composites section .NET twin (same file) | exact |
| `demo/RichTextTasting-bun/` (NEW — the D-03 before/after tasting page; served on the tailnet BEFORE the composite lands) | verification page | (static) | `demo/StateAxisVerification-bun/` (Phase 27's server + `index.html` shape) | exact |
| `demo/RichTextVerification-bun/` (NEW — post-implementation multi-theme verification page for the release closeout) | verification page | (static) | `demo/StateAxisVerification-bun/` again | exact |
| `CHANGELOG.md` + `MIGRATION.md` (v8.2.0 entry) | docs | (append) | Phase 27's v8.1.0 entry (CHANGELOG.md:9-28; MIGRATION.md:9-60) | exact |

**Two files that will NOT change** (guardrail — the planner should NOT touch them):
- `viewmodel-shell/src/index.ts` — the core adapter interface (no new `Adapter` verb; TipTap is a private renderer dependency, NOT a capability seam). Do NOT add a `richText?` verb.
- `viewmodel-shell/scripts/check-core-platform-globals.mjs` — the guard denylist. The lazy `import("@tiptap/core")` in `browser.ts` is not in `index.ts`, so the guard is unaffected. Do NOT touch the denylist.

---

## Pattern Assignments

### Analog A — Chart.js lazy-import (D-04 load-bearing precedent)

**New emission site:** `viewmodel-shell/src/browser.ts` — the `richTextField()` renderer method's TipTap+turndown lazy load.

**Analog:** `viewmodel-shell/src/browser.ts:741-939` — the entire `chart()` + `loadChart()` + `chartFailLoud()` block.

**The lazy-import call (browser.ts:895-928)** — copy the shape verbatim:

```typescript
private async loadChart(key: string, config: any): Promise<void> {
  let mod: any;
  try {
    mod = await import("chart.js");
  } catch {
    this.chartFailLoud(
      "ChartNode present but the optional peer dependency 'chart.js' is not " +
      "installed. Run: npm install chart.js"
    );
    return;
  }
  const {
    Chart,
    BarController, BarElement,
    /* ... */
  } = mod;
  Chart.register(/* base-set registration */);
  const entry = this.chartInstances.get(key);
  if (!entry) return;  // a later render mark-swept this key before import resolved
  entry.chart = new Chart(entry.canvas, entry.latest ?? config);
  entry.latest = null;
}
```

**The fail-loud handler (browser.ts:937-939):**

```typescript
private chartFailLoud(msg: string): void {
  console.error("[ViewModelShell]", new Error(msg));
}
```

**The synchronous render() entry-point that KICKS the loader without awaiting (browser.ts:878-884)** — same shape TipTap needs:

```typescript
// First render of this key: create a fresh canvas + kick the lazy loader
// (do NOT await inside the synchronous render()).
const canvas = document.createElement("canvas");
wrapper.appendChild(canvas);
this.chartInstances.set(key, { canvas, chart: null, latest: config });
void this.loadChart(key, config);
```

**The persistence + mark-sweep across renders (browser.ts:91-99, 199-206, 329-338)** — same problem for the TipTap editor. A TipTap `Editor` instance must survive the `render()`'s `innerHTML` wipe (destroying + recreating it on every render would lose the caret, selection, and undo history). Copy the `chartInstances` mark-sweep pattern verbatim:

```typescript
// Chart precedent (browser.ts:99):
private chartInstances = new Map<string, { canvas: HTMLCanvasElement; chart: any | null; latest: any | null }>();

// Per-render bookkeeping (browser.ts:198-206):
private chartKeyCounter = new Map<string, number>();  // per-render disambiguator
private chartKeysSeen = new Set<string>();             // per-render "still alive" set

// The mark-sweep in render() (browser.ts:333-338):
for (const [key, entry] of this.chartInstances) {
  if (!this.chartKeysSeen.has(key)) {
    entry.chart?.destroy();
    this.chartInstances.delete(key);
  }
}
```

**Notes:**
- Fail-loud rule (AGENTS.md §"The capability seam"): if TipTap fails to import, the loader must emit a hard `Error` via `console.error`. No silent no-op. No falling back to a plain textarea automatically — that would be a soft-degrade the AGENTS.md fail-loud rule explicitly forbids for capabilities with no safe default. Plan-phase should confirm this reading with Ashley (D-Q4 doesn't cover it explicitly; the CONTEXT.md ref to AGENTS.md §"The capability seam" hints toward fail-loud).
- The Chart precedent's `entry.canvas` is a **DOM element that survives `innerHTML` wipe by being reused across renders** — TipTap's editor DOM has the same property (rip out the editor's `<div>` wrapper, re-append it on the next render, call `editor.setContent(md)` only if the incoming `bind` value differs from `editor.getHTML() → turndown`). This is load-bearing for draft-value preservation (see AGENTS.md §"Non-obvious framework behaviors" → "Draft value preservation": every input reads its value from its `bind` path; the framework preserves drafts across re-renders as long as the tree keeps the same field).
- `import("turndown")` happens in the SAME `try`/`catch` block as `import("@tiptap/core")` and `import("@tiptap/starter-kit")` — one failure fails the whole load-loud (D-04 symmetric requirement). Consider `Promise.all([import("@tiptap/core"), import("@tiptap/starter-kit"), import("turndown")])` for parallel load.

---

### Analog B — MessageNode wire type (Phase 24 composite with typed slots + `state?`)

**New emission sites:**
1. `viewmodel-shell/src/index.ts` — `RichTextFieldNode` interface + union arm (leaf-input primitive).
2. `viewmodel-shell/src/index.ts` — `RichTextToolbarNode` interface + union arm (Route B composite with typed slots).

**Analog for the composite (with typed slots + closed-enum variance + `state?`):** `viewmodel-shell/src/index.ts:1687-1723` — MessageNode.

**MessageNode wire type (excerpt, :1687-1723) — the exact shape a Route B composite MUST take:**

```typescript
export interface MessageNode {
  type: "message";
  /** Leading circular slot — typically an AvatarNode (COMP-04). Slot accepts
   *  any ViewNode. Omitted = no avatar column content [...] */
  avatar?: ViewNode;
  /** Author display name. Trained typography: `text-sm, weight:600`. REQUIRED.
   *  Rendered as textContent (no HTML injection). */
  author: string;
  /** Timestamp. Trained typography: COMP-01 caption tier. Absent hides the
   *  `.vms-message__timestamp` element entirely (not rendered as an empty
   *  span — verifiable in the test suite). */
  timestamp?: string;
  /** Content body. `string` → `TextNode { style: "body" }`; `ViewNode` →
   *  rendered as-is [...] REQUIRED. */
  content: string | ViewNode;
  /** Message role — controls surface tone. Closed union.
   *  `"assistant"` tints info; others neutral. */
  role?: "user" | "assistant" | "system";
  /** Right-aligned action bar rendered as `<div class="vms-message__actions">`.
   *  Actions are ALWAYS VISIBLE when present (no hover-reveal — banked
   *  a11y doctrine). Omitted or empty array hides the bar entirely. */
  actions?: ButtonNode[];
  /** Message lifecycle STATE (NOT severity — no `tone` axis on Message;
   *  `role` drives surface tint, `state` drives lifecycle). Freeform,
   *  app-extensible token [...] */
  state?: string;
}
```

**Union arm (:212):**
```typescript
  | MessageNode
```

**Analog for the leaf-input primitive:** `viewmodel-shell/src/index.ts:1554-1586` — AvatarNode. The FIELDish node (RichTextFieldNode) is closer in role to AvatarNode than to FieldNode because D-01 makes it a distinct node with its own renderer path (not a FieldNode branch). BUT — it participates in **the bind/dispatch/form-harvest infrastructure that FieldNode owns** (write-back on input/change, `bind` path, form submission via `_state`).

**Shape the planner should synthesize:**

```typescript
/**
 * v8.2.0 (RICH-01) — RichTextFieldNode. First-class WYSIWYG rich text input
 * primitive. Wire value is a MARKDOWN STRING on `bind`; the browser renders a
 * TipTap editor + framework-owned toolbar + turndown HTML→markdown on
 * input/change [...]. Bundled TipTap 2.x + turndown, lazy-imported from
 * browser.ts (Chart.js precedent) — consumers who never render one ship zero
 * bytes. Display-side rendering flows through the existing markdown.ts →
 * InlineRuns pipeline (no new render code).
 *
 * Feature-surface floor (D-08): bold, italic, link, ordered list,
 * unordered list, heading h1-h3, inline code, code block, blockquote.
 * Everything else deferred.
 *
 * D-Q4 sanitization: the wire is a markdown STRING — zero XSS surface on the
 * wire (no HTML crosses). Display-side sanitization is audit-and-confirmed
 * against the existing markdown.ts `linkHrefRewrite` seam.
 *
 * ANTICIPATED CUSTOMIZATION SURFACE (deferred per CONTEXT §Deferred; slot
 * shape MUST not preclude): allowedMarks/allowedNodes, mentionsProvider,
 * plainTextValueBind, heightMin/heightMax, sanitizeConfig, imageUpload,
 * comment-only mode. All future-additive.
 */
export interface RichTextFieldNode {
  type: "rich-text-field";
  /** Field identifier — same role as FieldNode.name (used for form-harvest,
   *  aria-labelledby wiring, and the internal keying that survives render()'s
   *  innerHTML wipe — see the Chart.chartInstances precedent). REQUIRED. */
  name: string;
  /** Bind path — the JSONPath-ish key into `state` this field reads from and
   *  writes back to. On input/change the browser converts editor HTML →
   *  markdown (turndown) and writes the markdown string to `bind`. Same
   *  contract as FieldNode.bind. REQUIRED. */
  bind: string;
  /** Optional user-facing label; renders as <label htmlFor=...>. Same shape
   *  as FieldNode.label. */
  label?: string;
  /** Optional placeholder shown when the editor is empty. Rendered via TipTap
   *  Placeholder extension. */
  placeholder?: string;
  /** Optional toolbar. Typed slot — accepts a RichTextToolbarNode. Omitted =
   *  the framework's DEFAULT toolbar (the Slack/GitHub floor). Passing an
   *  explicit toolbar overrides. */
  toolbar?: RichTextToolbarNode;
  /** Form field required flag; when true, HTML5 `required`. */
  required?: boolean;
  /** When true, the editor is read-only (no toolbar clicks, no keystrokes).
   *  Same shape as FieldNode.disabled. */
  disabled?: boolean;
  /** Lifecycle state — same freeform axis as other row/composite state?:
   *  string per Phase 27's uniformity. Framework ships `active`/`done`/
   *  `disabled`. */
  state?: string;
}

/**
 * v8.2.0 (RICH-02) — RichTextToolbarNode. Route B composite (typed slots +
 * closed-enum variance) for the rich text toolbar. Framework owns layout,
 * button styling, tone tokens, keyboard shortcuts, focus management, a11y
 * (aria-labels + shortcut hints); the app declares WHICH tools appear.
 *
 * Route B tasting (D-03): the earned-a-composite rule (AGENTS.md +
 * .planning/design/composite-nodes-layer.md §2) requires a served before/
 * after tasting page + Ashley visual sign-off BEFORE this composite lands
 * in code. The tasting is the FIRST plan-task; the composite plan is
 * BLOCKED on it.
 *
 * Typed-slots pattern (design doc §3):
 *   - Slots are typed by SEMANTIC NAME, not by node type.
 *   - Variance is expressed through CLOSED-ENUM AXES.
 *   - Every slot is optional except the one that names what the composite IS.
 *
 * ANTICIPATED CUSTOMIZATION (D-02 rationale; NOT built this phase — the
 * composite is the ABSTRACTION SEAM): visibleTools, headings-dropdown,
 * position variants (top/bottom/floating), compact/expanded variants,
 * overflow-to-kebab. Future-additive; the shape below must not preclude.
 */
export interface RichTextToolbarNode {
  type: "rich-text-toolbar";
  /** The list of tools to render. Closed union of the floor's tool names
   *  (D-08). REQUIRED (a toolbar with no tools is not a toolbar). */
  tools: RichTextTool[];
  /** Compact vs expanded — a closed enum (D-02 anticipated axis). Omitted =
   *  "expanded". */
  size?: "compact" | "expanded";
  /** Semantic tone — the framework-wide tone axis (mirrors ButtonNode.tone).
   *  Omitted = neutral. */
  tone?: "danger" | "warning" | "success" | "info";
  /** Lifecycle state (same freeform axis as other Phase 27 composites). */
  state?: string;
}

export type RichTextTool =
  | "bold"
  | "italic"
  | "link"
  | "bullet-list"
  | "ordered-list"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "inline-code"
  | "code-block"
  | "blockquote";
```

**Union arms (add both):**
```typescript
  | RichTextFieldNode
  | RichTextToolbarNode
```

**Notes:**
- Every optional TS field uses `?:` — the TS twin never emits `null` (this is the intrinsic side of gotcha #8; drift protection is only load-bearing on the .NET twin — see Analog C below).
- `RichTextTool` is a closed union (D-08 floor). Widening it later is additive; consumers/agents key off the string, never assume a fixed set (same posture as `ChartNode.kind` in index.ts:2462-2465).
- Do NOT add a `richTextValueBind` or `plainTextValueBind` in this phase — CONTEXT.md §Deferred defers them explicitly. The shape above accommodates their future addition (both would slot in as additional `?` fields on `RichTextFieldNode`).

---

### Analog C — MessageNode .NET twin (`[JsonDerivedType]` + `[JsonIgnore(WhenWritingNull)]` gotcha #8)

**New emission site:** `viewmodel-shell-dotnet/ViewModels.cs` — `RichTextFieldNode` record + `RichTextToolbarNode` record + 2 `[JsonDerivedType]` discriminators.

**Analog:** `viewmodel-shell-dotnet/ViewModels.cs:2222-2252` — MessageNode record.

**MessageNode .NET record (:2222-2252) — the exact shape that MUST be mirrored:**

```csharp
public record MessageNode(
    // Author display name. REQUIRED. Text-sm, weight:600 (trained typography).
    // Rendered as textContent (no HTML injection).
    string Author,
    // Content body. REQUIRED. On the .NET side, this is a ViewNode (not
    // string) so the record stays polymorphic; the TS twin's
    // string-convenience wraps in TextNode{style:"body"} at render time.
    // The .NET server wraps explicitly.
    ViewNode Content,
    // Leading circular slot — typically an AvatarNode (COMP-04). ViewNode?
    // per Analog C (polymorphic emission).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Avatar = null,
    // Trained typography: caption tier (COMP-01). Rendered as textContent.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Timestamp = null,
    // Message role — controls surface tone. Real enum per closed-union-must-
    // be-enum discipline (KebabEnum wire values "user"/"assistant"/"system").
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] MessageRole? Role = null,
    // Right-aligned action bar. Typed IReadOnlyList<ViewNode>? (NOT
    // IReadOnlyList<ButtonNode>) so System.Text.Json emits the polymorphic
    // "type":"button" discriminator on each entry — a narrow ButtonNode-typed
    // list would silently drop the discriminator (banked posture from
    // FormNode.Buttons at :1155-1159; same rule applies here).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ViewNode>? Actions = null,
    // Message lifecycle STATE (NOT role — that's Role for surface tint).
    // Framework ships active/done/disabled; composes multiplicatively with Role.
    // Emits .vms-message--{state}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null
) : ViewNode;
```

**`[JsonDerivedType]` discriminator (:822):**
```csharp
[JsonDerivedType(typeof(MessageNode),     "message")]
```

**Shape the planner should synthesize for the two new records:**

```csharp
// Two new [JsonDerivedType] discriminators, added to the block at ViewModels.cs:791-833:
[JsonDerivedType(typeof(RichTextFieldNode),   "rich-text-field")]
[JsonDerivedType(typeof(RichTextToolbarNode), "rich-text-toolbar")]

// The closed-union `RichTextTool` MUST be a real enum (per AGENTS.md
// closed-union-must-be-enum discipline; see design doc §6):
public enum RichTextTool { Bold, Italic, Link, BulletList, OrderedList,
                            Heading1, Heading2, Heading3, InlineCode,
                            CodeBlock, Blockquote }
public enum RichTextToolbarSize { Compact, Expanded }

public record RichTextFieldNode(
    string Name,
    string Bind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Placeholder = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] RichTextToolbarNode? Toolbar = null,
    // Optional non-nullable bool: WhenWritingDefault so false is ABSENT
    // (matching TS optional `required?`). Same posture as FieldNode.Required.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Required = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Disabled = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null
) : ViewNode;

public record RichTextToolbarNode(
    IReadOnlyList<RichTextTool> Tools,  // REQUIRED, no ignore
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] RichTextToolbarSize? Size = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null
) : ViewNode;
```

**Notes (all non-negotiable per AGENTS.md gotcha #8):**
- Every nullable `T?` property MUST carry `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`. Missing it silently re-introduces null/false-vs-absent drift from the TS twin — the exact class-2 defect gotcha #8 exists to prevent (the 2026-07-16 audit found ~130 violations elsewhere; do not add to that count).
- Every optional non-nullable bool (`Required`, `Disabled`) MUST carry `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]` so `false` is ABSENT (matching TS optional `required?`/`disabled?` posture). Same rule bit Phase 24 (`AlertNode.Dismissible`) and Phase 23 (`CheckboxNode.Required`).
- `RichTextTool` is a REAL C# enum (with `KebabEnum<RichTextTool>` converter — grep for `KebabEnum` under `viewmodel-shell-dotnet/` for the shipped converter; the ChartKind / MessageRole enums are the precedent). NOT `string?`. Per the closed-union-must-be-enum discipline in the composite-nodes-layer.md §6 — the whole point of the closed union is that a bad value fails both backends' tree-validators, and `string?` on .NET keeps the walker silent.
- `RichTextFieldNode.Toolbar` typed narrowly as `RichTextToolbarNode?` (not `ViewNode?`) is safe here BECAUSE the toolbar composite is a concrete leaf-ish record, not a polymorphic slot — a consumer would never legitimately pass a random ViewNode as a toolbar. (Contrast with MessageNode.Actions typed `IReadOnlyList<ViewNode>?` to keep the polymorphic discriminator on each button — the narrowing rule fires only when polymorphism matters.)

---

### Analog D — Tree validator arms (both TS + .NET, exhaustive-switch discipline)

**New emission sites:**
1. `viewmodel-shell/src/server.ts` — two arms in `collectActions` + two arms in `walkForSectionAction`.
2. `viewmodel-shell-dotnet/ViewModels.cs` — two arms in `Collect` + two arms in `WalkForSectionAction`.

**Analog for leaf-input primitive:** the `case "avatar":` no-op arm on both backends.

**TS twin (server.ts:500-506):**
```typescript
case "avatar": {
  // v8.0.0 (COMP-04) — AvatarNode is a leaf (no children, no action). Same
  // terminal-leaf posture as IconNode. The arm exists so a future refactor
  // that promotes it to a container fails the TypeScript exhaustiveness
  // check here first.
  return;
}
```

**.NET twin (ViewModels.cs:3499-3502):**
```csharp
case AvatarNode:
    // v8.0.0 (COMP-04) — AvatarNode is a leaf (no children, no
    // action). Same terminal-leaf posture as IconNode.
    break;
```

**Analog for the composite:** `case "message":` in both backends.

**TS twin (server.ts:219-231) — descend into typed slots, record dispatch-bearing actions:**
```typescript
case "message": {
  // v8.0.0 (COMP-06) — MessageNode slots: avatar (ViewNode), content
  // (string | ViewNode), actions (ButtonNode[]). Descend into every
  // ViewNode-typed slot; guard content on typeof so a string leaf isn't
  // fed to the walker. Author + timestamp are primitive strings (no
  // descent). Actions are dispatch-bearing → each button's action name
  // participates in name uniqueness.
  const m = node as MessageNode;
  if (m.avatar) collectActions(m.avatar, enclosingForm, out);
  if (typeof m.content !== "string") collectActions(m.content, enclosingForm, out);
  for (const btn of m.actions ?? []) collectActions(btn, enclosingForm, out);
  return;
}
```

**.NET twin (ViewModels.cs:3206-3221):**
```csharp
case MessageNode message:
    // v8.0.0 (COMP-06) — MessageNode slots: [...]. Descend into every
    // ViewNode-typed slot; each ButtonNode child's Action participates
    // in name uniqueness. Mirrors the TS twin `case "message"` arm.
    if (message.Avatar is { } msgAvatar) Collect(msgAvatar, enclosingForm, sink);
    Collect(message.Content, enclosingForm, sink);
    if (message.Actions is { } msgActions)
    {
        foreach (var btn in msgActions) Collect(btn, enclosingForm, sink);
    }
    break;
```

**Shape for the two new arms:**

`RichTextFieldNode` — treat as a leaf (like AvatarNode). It has a `bind` (which participates in state round-trip, NOT in action-name uniqueness) and NO action-bearing descendants; its only slot is `toolbar?: RichTextToolbarNode`, which itself carries no dispatch-bearing descendants either.

`RichTextToolbarNode` — also treat as a leaf for action-name uniqueness (its `tools[]` are enum values naming built-in TipTap commands, NOT `ActionEvent` dispatches — clicks on toolbar buttons are handled CLIENT-SIDE by the TipTap chain; they do NOT round-trip a form-scoped action-name that could collide with another action).

**BOTH arms exist for defense-in-depth** — the exhaustive-switch discipline. Adding both keeps the TS switch exhaustive against `ViewNode` at compile time and prevents a future refactor that gives either node a dispatch-bearing descendant from silently skipping the walk (the missed-walk failure class documented at AGENTS.md gotcha #9 + Chart's leaf-comment list in browser.ts).

**Notes:**
- BOTH TS and .NET walkers descend. Missing an arm on either side hides duplicate-action-name bugs — banked lesson 2026-07-16 (Nelly finding: `TrackerNode` is a currently-known gap on the .NET side; do NOT add to the list).
- Do NOT add an arm to any of the OTHER validators (`ValidateSectionAction`, etc.) — those exist for SectionNode-specific rules; the new nodes have no SectionNode descendants, so a `case RichTextFieldNode:` / `case RichTextToolbarNode:` no-op arm is enough (mirror `case AvatarNode:` in the WalkForSectionAction switch at ViewModels.cs:3112-3116).

---

### Analog E — browser.ts renderer method (draft-preservation across renders)

**New emission site:** `viewmodel-shell/src/browser.ts` — `richTextField()` method + `richTextToolbar()` method + two arms in the `node()` dispatch switch at :540-585.

**Analog for the dispatch arms:** `browser.ts:571-584` — the composite arms already added in Phase 23-25.

**Add two lines to the switch (browser.ts:540-585):**
```typescript
case "rich-text-field":   return this.richTextField(n, parent, on);
case "rich-text-toolbar": return this.richTextToolbar(n, parent, on);
```

**Analog for the renderer method** — TWO analogs to compose:

1. **The FieldNode textarea path (browser.ts:3739-3748)** — for the write-back-on-input pattern (`writeBind` on each input event):
```typescript
} else if (n.inputType === "textarea") {
  const ta = document.createElement("textarea");
  ta.className = "vms-field__input";
  ta.id = `vms-${n.name}`;
  ta.name = n.name;
  if (n.placeholder) ta.placeholder = n.placeholder;
  ta.value = stateValue == null ? "" : String(stateValue);
  if (n.required) ta.required = true;
  ta.addEventListener("input", () => { this.writeBind(n.bind, ta.value); });
  wrapper.appendChild(ta);
}
```

2. **The ChartNode persistence + lazy-init pattern (browser.ts:741-884)** — for the editor-instance-survives-render() pattern. See Analog A above for the full lazy-load excerpt.

**Shape the planner should synthesize:**

```typescript
private editorInstances = new Map<string, {
  wrapper: HTMLElement;
  editor: any | null;  // TipTap Editor — `any` because the module is lazy-loaded
  turndown: any | null; // TurndownService — same reason
  latestBindValue: string;
}>();
private editorKeyCounter = new Map<string, number>();
private editorKeysSeen = new Set<string>();

private richTextField(
  n: RichTextFieldNode,
  parent: HTMLElement,
  on: (a: ActionEvent) => void
): void {
  // Same keying discipline as chartInstances — the RichTextFieldNode's `name`
  // is unique-ish per field; disambiguate via ordinal to survive duplicate
  // names in the same tree.
  const baseKey = n.name;
  const ordinal = this.editorKeyCounter.get(baseKey) ?? 0;
  this.editorKeyCounter.set(baseKey, ordinal + 1);
  const key = `${baseKey}#${ordinal}`;
  this.editorKeysSeen.add(key);

  const wrapper = this.decorateField(n, parent);  // reuse existing FieldNode label/aria helpers
  wrapper.classList.add("vms-rich-text-field");
  // ... state-axis class emission ...
  parent.appendChild(wrapper);

  const stateValue = this.readBind(n.bind);
  const md = stateValue == null ? "" : String(stateValue);

  const existing = this.editorInstances.get(key);
  if (existing) {
    // Reuse editor across renders (survives innerHTML wipe by being re-parented).
    wrapper.appendChild(existing.wrapper);
    if (existing.editor && md !== existing.latestBindValue) {
      // Only setContent if the server changed the value — otherwise we'd wipe
      // the user's caret + selection + undo history on every re-render.
      // ... marked(md) → html → editor.commands.setContent(html) ...
      existing.latestBindValue = md;
    }
    return;
  }

  // First render of this key: create the wrapper + kick the lazy loader
  // (do NOT await inside the synchronous render()).
  const editorHost = document.createElement("div");
  wrapper.appendChild(editorHost);
  this.editorInstances.set(key, {
    wrapper: editorHost, editor: null, turndown: null, latestBindValue: md,
  });
  void this.loadRichText(key, n, editorHost);
}

private async loadRichText(
  key: string,
  n: RichTextFieldNode,
  host: HTMLElement
): Promise<void> {
  let tiptap: any, starterKit: any, turndownMod: any;
  try {
    [tiptap, starterKit, turndownMod] = await Promise.all([
      import("@tiptap/core"),
      import("@tiptap/starter-kit"),
      import("turndown"),
    ]);
  } catch {
    this.richTextFailLoud(
      "RichTextFieldNode present but TipTap or turndown failed to load. " +
      "Run: npm install @tiptap/core @tiptap/starter-kit turndown"
    );
    return;
  }
  const entry = this.editorInstances.get(key);
  if (!entry) return;  // mark-swept by a later render

  const turndownSvc = new turndownMod.default({
    headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-",
  });

  // Convert initial markdown → HTML via the existing `marked` dep for setContent.
  // (marked is already in the framework's deps for the display-side pipeline.)
  const marked = await import("marked");
  const initialHtml = marked.marked.parse(entry.latestBindValue);

  const editor = new tiptap.Editor({
    element: host,
    extensions: [starterKit.default],
    content: initialHtml,
  });
  editor.on("update", () => {
    const html = editor.getHTML();
    const md = turndownSvc.turndown(html);
    entry.latestBindValue = md;
    this.writeBind(n.bind, md);
  });

  entry.editor = editor;
  entry.turndown = turndownSvc;
}

private richTextFailLoud(msg: string): void {
  console.error("[ViewModelShell]", new Error(msg));
}
```

**Mark-sweep in `render()`** — copy the chart mark-sweep pattern verbatim (browser.ts:333-338), adding an editor loop:
```typescript
for (const [key, entry] of this.editorInstances) {
  if (!this.editorKeysSeen.has(key)) {
    entry.editor?.destroy();
    this.editorInstances.delete(key);
  }
}
```

**Notes:**
- The `writeBind` + `readBind` calls are the exact framework-owned bind-path plumbing FieldNode uses (see :2236-2748 for the FieldNode renderer). No new state plumbing — RichTextFieldNode participates in the same round-trip infrastructure as every other input node (AGENTS.md §"Non-obvious framework behaviors" → "Automatic state round-tripping").
- The reason the editor instance must persist across renders is EXACTLY the same reason `chartInstances` persists (browser.ts:99 comment): "the live canvas + Chart instance are reused across the render()'s innerHTML wipe". Same problem, same solution.
- `richTextToolbar()` (the composite renderer) is the standalone case (an app that renders a bare RichTextToolbarNode for design tastings). In the normal case, the toolbar is a NESTED slot on RichTextFieldNode and gets rendered by the field renderer directly. The Route B design pattern is: the composite has its own renderer arm AND can be rendered by a consumer as a standalone (see MessageListNode's renderer for the two-mode precedent).

---

### Analog F — FeatureProbe fixture + `expectBodyContains` tripwires

**New emission sites:**
1. `parity/fixtures/feature-probe.json` — add tripwire strings.
2. `demo/FeatureProbe-bun/handler.ts` — emit RichTextFieldNode + RichTextToolbarNode in `buildVm`.
3. `demo/FeatureProbe/AspNetCore/ProbeController.cs` — mirror the emissions on the .NET side.

**Analog:** Phase 27's state-probe additions at `parity/fixtures/feature-probe.json:112-118` + Phase 24's composite emissions at `demo/FeatureProbe-bun/handler.ts:1141-1230`.

**Fixture tripwire additions (feature-probe.json:75-118 — the existing `expectBodyContains` block on the initial GET step):**
```json
"expectBodyContains": [
  /* existing entries ... */
  "\"type\":\"rich-text-field\"",
  "\"type\":\"rich-text-toolbar\"",
  "\"bind\":\"draftMarkdown\"",
  "\"tools\":[\"bold\",\"italic\",\"link\",",
  "\"size\":\"expanded\"",
  "\"placeholder\":\"Write something…\"",
  /* State axis probe (mirrors Phase 27 pattern): */
  "rich-text-state-probe"
]
```

**Emission in FeatureProbe-bun/handler.ts (analog: :1197-1218):**
```typescript
// ── RICH-01 RichTextFieldNode + RICH-02 RichTextToolbarNode ────
// Same byte-alignment rule as MessageNode above — the .NET twin cannot use
// TS convenience unions; explicit shape here.
{
  type: "rich-text-field",
  name: "rich-text-state-probe",
  bind: "draftMarkdown",
  label: "Description",
  placeholder: "Write something…",
  toolbar: {
    type: "rich-text-toolbar",
    tools: ["bold", "italic", "link", "bullet-list", "ordered-list",
            "heading-1", "heading-2", "heading-3", "inline-code",
            "code-block", "blockquote"],
    size: "expanded",
  },
  state: "active",  // state-axis probe for Phase 27's uniformity gate
}
```

**Notes:**
- `expectBodyContains` is the CLASS-3 defect protection AGENTS.md gotcha #9 exists for — a fixture whose branch quietly stops firing is indistinguishable from one that passes. Every rich-text branch the fixture exercises MUST have a substring tripwire naming a unique-to-that-branch marker. The `rich-text-state-probe` name is intentionally unique so a future refactor that stops emitting it fails LOUDLY.
- Emit in BOTH backends (bun + .NET). Missing one is not a parity mismatch (the diff would catch that); missing BOTH is the class-1 defect (both agree on the wrong thing). The tripwire catches BOTH classes.
- Add a `FeatureProbeState.DraftMarkdown = ""` field so the round-trip has a bind to write into (mirror the Phase 24 additions that added `SelectedIds`/etc. state slots).

---

### Analog G — Iframe-scoped A/B tasting page (D-03 + banked v8.0.3 lesson)

**New demo:** `demo/RichTextTasting-bun/` — the D-03 before/after tasting page served BEFORE the composite lands. Ashley visually signs off; composite plan is BLOCKED on the sign-off.

**Analog:** `demo/StateAxisVerification-bun/` — the Phase 27 real-bundle real-CSS tailnet-served verification harness.

**Structure (`demo/RichTextTasting-bun/`):**
- `index.html` — the parent page with iframe scaffolding + theme switcher.
- `server.ts` — Bun.serve process (mirrors StateAxisVerification-bun/server.ts:1-80 structure).
- `src/main.ts` — the client-side bootstrap.
- `src/panel-primitives.html` + `src/panel-composite.html` — the two per-panel iframes (see below for the iframe-scoping rule).
- `package.json`, `vite.config.ts`, `tsconfig.json` — standard Bun/Vite trio.

**index.html shape (analog: StateAxisVerification-bun/index.html:1-78):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta name="viewmodel-shell" content='{"protocol":"viewmodel-shell/1.0","endpoint":"/api/probe/tree","actionEndpoint":"/api/probe/tree"}'>
  <meta name="page" content="rich-text-tasting">
  <title>Phase 28 rich text tasting — before/after</title>
  <link rel="stylesheet" href="/vms/default.css" />
  <link rel="stylesheet" id="theme-css" href="data:text/css,%2F*%20themeless%20default%20*%2F" />
</head>
<body>
  <!-- Theme switcher (host chrome, NOT part of the view tree) -->
  <div id="app">
    <h1>Rich text — before/after tasting</h1>
    <!-- IFRAME-SCOPED per banked v8.0.3 lesson (2026-07-30): different
         asset versions in each panel; a shared <script>/<link> at parent
         level would cross-contaminate and defeat the comparison. -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
      <iframe src="/panel-primitives.html" style="width:100%;height:600px;border:1px solid #8884;"></iframe>
      <iframe src="/panel-composite.html" style="width:100%;height:600px;border:1px solid #8884;"></iframe>
    </div>
  </div>
</body>
</html>
```

**The BEFORE panel (`panel-primitives.html`)** — renders a hand-composed rich text input using existing primitives (SectionNode(row) + ButtonNode toolbar + a FieldNode(textarea)). This is the "pretty bad approximation" the earned-a-composite rule requires for the visual bar.

**The AFTER panel (`panel-composite.html`)** — renders the proposed RichTextFieldNode + RichTextToolbarNode (WORKING against a mock renderer branch, or the actual renderer if the composite plan is intercalated). Ashley eyeballs the two side-by-side.

**Notes:**
- The iframe-scoping rule is LOAD-BEARING per the banked v8.0.3 lesson (2026-07-30): "A/B panels that hinge on different asset versions MUST be scoped via iframes. A shared `<script>`/`<link>` at the parent-page level defeats the comparison." Copy the iframe scaffolding exactly; do NOT try to render both panels in the same document.
- The tasting IS the composite plan's blocker — the composite plan MUST have `depends_on: ["28-XX"]` where XX is the tasting plan. Ashley's visual sign-off (recorded in the tasting plan's SUMMARY as an operator checkpoint) is what unblocks the composite.
- Per CONTEXT.md §Decisions D-03 + AGENTS.md "The visual-tasting checkpoint (D-03) IS a legitimate `autonomous: false` — it's Ashley's visual sign-off on a Route B composite" — the tasting plan carries `autonomous: false`. Do NOT strip it (contrast with the theatrical "confirm the green-tree gate is green" checkpoints Ashley banked as REMOVE).
- The verification page (`demo/RichTextVerification-bun/`) is a SEPARATE demo, served POST-implementation for the release closeout (mirrors Phase 27's `StateAxisVerification-bun/` — served against the shipped bundle across all 12 themes as the last plan before the release ritual).

---

### Analog H — `package.json` dependency declaration (D-04 divergence from Chart.js)

**New emission site:** `viewmodel-shell/package.json` — add TipTap + turndown.

**Analog:** the shipped Chart.js declaration (package.json:49, 58-77):
```json
"devDependencies": {
  ...
  "chart.js": "^4",
  ...
},
"peerDependencies": {
  "chart.js": "^4",
  ...
},
"peerDependenciesMeta": {
  "chart.js": { "optional": true },
  ...
}
```

**D-04 DIVERGENCE — TipTap goes in `dependencies`, NOT `peerDependencies`:**

Chart.js is an OPTIONAL peer (the consumer opts in by installing it; the framework declares only that IF you install it, you get the right version). D-04 explicitly locks the OPPOSITE posture for TipTap: **bundled** in the main package. So TipTap goes in `dependencies` (a real, non-optional dep that npm installs automatically), and consumers don't need to install anything extra.

**Shape:**
```json
"dependencies": {
  "@tiptap/core": "^2.11.0",
  "@tiptap/starter-kit": "^2.11.0",
  "turndown": "^7.2.0"
}
```

**Notes:**
- The `dependencies` block does NOT currently exist in `viewmodel-shell/package.json` (grep confirms — there's `devDependencies`, `peerDependencies`, `optionalDependencies`, but no `dependencies`). Adding it is the natural place; npm treats it as the "always install" bucket.
- Do NOT add TipTap/turndown to `peerDependencies` or `peerDependenciesMeta` — that would revert to the Chart.js optional-peer posture and require consumer opt-in, which D-04 explicitly rejects.
- Do NOT add a `/rich-text` subpath to `exports` — D-04 rejects subpath adoption. The rich text node ships from the main `.` and `./browser` entry points; the lazy-import from `browser.ts` is what keeps consumers who never render one at zero bytes.
- Include `@types/turndown` in `devDependencies` if TS type resolution needs it (turndown has DefinitelyTyped types).
- **Symmetric adapter test** (D-04 requirement): the plan MUST add a test that renders NO RichTextFieldNode and asserts TipTap/turndown are NOT in the initial bundle graph. Analog: `viewmodel-shell/test/chart.test.ts` (grep for `vi.mock("chart.js")` — but the assertion this phase needs is subtly different: not that Chart.js is mocked, but that TipTap is UNRESOLVED after the render). Options for the assertion:
  1. Static: post-build, grep `dist/browser.js` for `@tiptap/core` — the string should appear ONLY inside the lazy `import()` call, not as a top-level import (`import ... from "@tiptap/core"`).
  2. Runtime: instrument `import("@tiptap/core")` with a Vitest spy; render a tree WITHOUT RichTextFieldNode; assert the spy was NEVER called.
  Option 2 is closer to the ChartNode test pattern; recommend it.

---

### Analog I — agent-skill.md addition + .NET byte-identical copy

**New emission sites:**
1. `viewmodel-shell/agent-skill.md` — add a section describing `RichTextFieldNode` + `RichTextToolbarNode` on the wire.
2. `viewmodel-shell-dotnet/AgentSkill.md` — byte-identical re-copy.

**Analog:** The existing sections of `viewmodel-shell/agent-skill.md`. See AGENTS.md §"Agent discoverability" for the maintainer rule: any change to wire shape / response envelope / etc. MUST update the skill in the same change.

**Notes:**
- Parity gate (`parity/check-skill.ts`) diffs both source files AND the served HTTP bodies on the HelpDesk twins. A .NET copy that's not byte-identical fails the build.
- Update `viewmodel-shell/agent-skill.md` FIRST, then re-copy to `viewmodel-shell-dotnet/AgentSkill.md` (the source-of-truth flow AGENTS.md documents).
- The skill entry should describe:
  - The wire type `"rich-text-field"` with its fields (name, bind, label?, placeholder?, toolbar?, required?, disabled?, state?).
  - The wire VALUE format: a markdown string on the `bind` path.
  - The reciprocal: the `RichTextToolbarNode` shape (tools[], size?, tone?, state?) and the closed `RichTextTool` union.
  - What an agent driving the wire cold sees when submitting: the markdown string round-trips in `_state`.

---

### Analog J — `.planning/design/composite-nodes-layer.md` shipped-recipe inventory addition

**New emission site:** `.planning/design/composite-nodes-layer.md` §4 shipped-recipe inventory table.

**Analog:** the existing rows for Phase 24-25 composites (§4 table beginning at design doc:83).

**Row shape:**
```markdown
| `RichTextToolbarNode` | tools[], size, tone, state | 28 (RICH-02) | `"rich-text-toolbar"` | `RichTextToolbarNode` | ButtonNode styling; framework-owned TipTap chain wiring via the enclosing RichTextFieldNode |
```

**Notes:**
- Per the composite-nodes-layer.md convention: "Docs do not race ahead of code" — the row lands in the inventory table ONLY after the composite plan's SUMMARY lands on `main`. So this doc edit is one of the LAST plan tasks, after the composite plan, before the release plan.
- Also add a §5 or Phase 27-style addendum to the design doc noting the v8.2.0 addition (mirror the Phase 27 addendum inserted in `AGENTS.md` §"Route B composite-nodes layer" for the state axis uniformity).
- The `RichTextFieldNode` is NOT a Route B composite (it's a leaf input primitive with its own renderer, like FieldNode). Only `RichTextToolbarNode` earns a row in the composite inventory. This matches CONTEXT.md D-01: RichTextField is a DEDICATED NEW NODE (leaf-input), not a Route B composite.

---

### Analog K — CHANGELOG.md + MIGRATION.md v8.2.0 entry

**New emission sites:** `CHANGELOG.md` + `MIGRATION.md`.

**Analog:** Phase 27's v8.1.0 entry (`CHANGELOG.md:9-28` + `MIGRATION.md:9-60`).

**CHANGELOG entry template:**
```markdown
## 8.2.0 — <YYYY-MM-DD> (npm + NuGet aligned)

Milestone: **rich text WYSIWYG input primitive**. New `RichTextFieldNode` leaf-input primitive with a markdown-string wire value (via TipTap + turndown, bundled + lazy-imported per Chart.js precedent); new `RichTextToolbarNode` Route B composite for the toolbar (typed slots + closed-enum variance axes per composite-nodes-layer.md §3). See `.planning/design/composite-nodes-layer.md` §4 for the RichTextToolbarNode row; Phase 28 in `.planning/ROADMAP.md`.

### Added

- **`RichTextFieldNode` wire type (both backends)** — leaf-input primitive with `name`, `bind`, and 6 optional fields (label, placeholder, toolbar, required, disabled, state). Wire value is a markdown string on the bind path (via turndown at write time; via existing `marked` at initial-content pre-load). Consumes existing state round-trip infra (`_state` form field); zero new plumbing.
- **`RichTextToolbarNode` Route B composite (both backends)** — typed slots (`tools`) + closed-enum variance axes (`size`, `tone`, `state`). Slot design approved via before/after tasting served on the tailnet (Phase 28 §D-03; Ashley signed off on <date>).
- **TipTap 2.x + turndown bundled into main `@ashley-shrok/viewmodel-shell` package** — lazy-imported from `browser.ts` (Chart.js precedent). Consumers who never render a `RichTextFieldNode` ship ZERO TipTap/turndown bytes. Verified by adapter test asserting TipTap is not in the initial bundle graph.

### Note

- **Wire protocol token stays `viewmodel-shell/1.0`** — all wire additions are additive optional fields.
- **MINOR bump** — no wire break; no consumer required to change code. Consumers who don't render `RichTextFieldNode` see zero effect.
```

**MIGRATION note template (MIGRATION.md analog: :9-60):**
```markdown
## Upgrading to v8.2.0

**NO CODE CHANGE required.** v8.2.0 is additive wire fields + bundled TipTap. Consumers who don't render a `RichTextFieldNode` see zero bytes shipped and zero behavior change.

Bump both packages to align: [npm + dotnet commands ...]

### New capability: RichTextFieldNode + RichTextToolbarNode

[Describe wire shape + minimal usage example]

### Note on bundling

TipTap is now a `dependencies` (not `peerDependencies`) — you do not need to install anything extra. The library is lazy-imported from `browser.ts` when a `RichTextFieldNode` first renders, so consumers who don't use the node ship zero TipTap bytes. If TipTap fails to load at runtime (e.g. offline / network-restricted CDN environment), the framework surfaces a hard `Error` via `console.error` — same fail-loud contract as the Chart.js path.
```

---

### Analog L — Phase 27-11 release ritual (operator-gated commit + publish + tag + advance-main)

**New plan:** the FINAL plan in Phase 28.

**Analog:** `.planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-11-PLAN.md` — byte-aligned template.

**Key structural elements to mirror:**
- `autonomous: false` — operator-gated per AGENTS.md publishing runbook.
- Files modified: `viewmodel-shell/package.json`, `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj`, `CHANGELOG.md`, `MIGRATION.md`.
- Required truths (verbatim from 27-11):
  - Version bump: npm 8.1.x → 8.2.0; NuGet 8.1.0 → 8.2.0.
  - Auth precheck BEFORE bump-commit (`npm whoami` succeeds; `$NUGET_API_KEY` exported).
  - `npm publish` (operator command); registry-latest verified via `curl` (NOT `npm view`).
  - `dotnet pack` + `dotnet nuget push`; registry-latest verified via `curl`.
  - Annotated tag `v8.2.0` at release commit + pushed.
  - Main-advance verified: `git merge-base --is-ancestor v8.2.0 main` exits 0.
  - Announce on `#vms-changelog` (`!E211RrsKCygK7Ev6uacpswousKy9JZiGEVLquJpC3cU`) OR `#vms-announcements` — **VERIFY THE ROOM ID against `/joined_rooms` BEFORE baking into the plan** (banked Ashley directive; Phase 27 confirmed `#vms-announcements` = `!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net` where vicky is OWNER).
  - Angel DM if the phase's outputs unblock her (rich text could be the compose area for chat-composer — check with Angel post-ship, do NOT fold into this phase).
- SUMMARY records: bump-commit SHA, `npm whoami` output, `$NUGET_API_KEY` presence check (no key leaked), npm publish output, NuGet push output, both curl-registry-latest verifications, tag creation output, main-ancestor verification output, announce message ref.

**Notes:**
- Per AGENTS.md working-agreement rule "STRIP GSD-generated `checkpoint:human-action` auth-precheck tasks (banked 2026-07-30). Ashley does not do them; agent executes the mechanical precheck inline." — the plan MUST NOT insert a theatrical human checkpoint asking Ashley to confirm auth. The agent runs `npm whoami` + checks `$NUGET_API_KEY` presence inline and reports failure to halt.
- Per AGENTS.md "Companion NuGet compat" — MINOR bump does NOT require companion (Markdown) republish. Include the companion compile-check gate but not a republish task.
- Version numbering: npm is currently at 8.1.0; NuGet at 8.1.0. Both bump to 8.2.0 aligned. (Confirm current versions with a `curl` to both registries before drafting the plan — Phase 27's 27-11 template does exactly this.)

---

## Shared Patterns (applied across multiple plans)

### Null-omission + optional-bool absence (AGENTS.md gotcha #8)
**Source:** the entire `viewmodel-shell-dotnet/ViewModels.cs` file header + every existing record.
**Apply to:** ALL new .NET records + ALL new fields on existing records.

- Every nullable `T?` MUST carry `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`.
- Every optional non-nullable bool whose `false` means "absent/unset" MUST carry `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]`.
- Every closed union MUST be a real C# enum, NOT `string?` (composite-nodes-layer.md §6 closed-union-must-be-enum discipline).

### Tree-validator descent on BOTH backends
**Source:** `viewmodel-shell/src/server.ts` (`collectActions` + `walkForSectionAction`) + `viewmodel-shell-dotnet/ViewModels.cs` (`Collect` + `WalkForSectionAction`).
**Apply to:** BOTH new nodes on BOTH backends. Leaf arms are also required (per exhaustive-switch discipline).

Missing an arm on either side hides duplicate-action-name bugs — banked Nelly finding 2026-07-16.

### Parity `expectBodyContains` tripwires per branch
**Source:** `parity/fixtures/feature-probe.json:75-118` (the shipped composite tripwires from Phase 24-27).
**Apply to:** every per-response branch a fixture step exists to cover.

Per AGENTS.md gotcha #9 corollary: a fixture whose branch quietly stops firing is indistinguishable from one that passes. Every new rich-text emission needs a unique-string tripwire so a config change that stops firing the branch fails LOUDLY.

### Iframe-scoped A/B verification pages (banked v8.0.3, 2026-07-30)
**Source:** the D-03 requirement in CONTEXT.md + `demo/StateAxisVerification-bun/` shape.
**Apply to:** the D-03 tasting page + any before/after verification.

Different asset versions per panel MUST be scoped via iframes. A shared `<script>`/`<link>` at parent level defeats the comparison.

### Lazy-import symmetry test (D-04 requirement)
**Source:** the D-04 CONTEXT decision + the ChartNode adapter test pattern.
**Apply to:** the rich text adapter test suite.

Add a test that renders NO RichTextFieldNode and asserts TipTap/turndown are NOT in the initial bundle graph (recommend Vitest spy on `import()`; see Analog H above for two options).

### Route B tasting BEFORE the composite (D-03 requirement)
**Source:** `.planning/design/composite-nodes-layer.md` §2 + AGENTS.md §"Route B composite-nodes layer".
**Apply to:** the RichTextToolbarNode composite plan.

The composite plan MUST have `depends_on: ["28-XX-tasting"]` where XX-tasting is the plan that served the before/after page on the tailnet. Ashley's visual sign-off (operator checkpoint in the tasting plan's SUMMARY) is what unblocks the composite plan. Do NOT strip the `autonomous: false` on the tasting plan (per Ashley's banked directive on legitimate design-taste checkpoints).

### Green-tree gate before publish (AGENTS.md working-agreement rule)
**Source:** AGENTS.md §"Working agreement for agents" → "🚨 NEVER PUBLISH OR PUSH ANYTHING BROKEN".
**Apply to:** the release-preparation plan (immediately before Analog L's operator-gated release plan).

Full framework tests + parity + core-globals guard + demo type-check + framework .NET tests + every `demo/**/*.Tests.csproj` + Markdown companion compile — all green before the bump-commit.

---

## No Analog Found

None. Every file this phase touches has a strong precedent already in the codebase.

The closest thing to a novel add is the RichTextField renderer's TipTap `Editor` instance persistence across renders — but that itself is architecturally identical to `chart.chartInstances` mark-sweep (Analog E). There is no genuinely new pattern being introduced.

---

## Metadata

**Analog search scope:** `viewmodel-shell/src/`, `viewmodel-shell/test/`, `viewmodel-shell-dotnet/`, `demo/FeatureProbe*`, `demo/StateAxisVerification-bun/`, `parity/`, `.planning/phases/{12,23,24,25,27}-*/`, `~/.claude/identities/vicky/bounties/rich-text-input/`.
**Files scanned:** ~35.
**Pattern extraction date:** 2026-07-31.
