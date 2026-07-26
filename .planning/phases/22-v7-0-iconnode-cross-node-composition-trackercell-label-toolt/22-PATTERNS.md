# Phase 22: v7.0 IconNode + cross-node composition — Pattern Map

**Mapped:** 2026-07-26
**Files analyzed:** 13 files to be created/modified
**Analogs found:** 12 exact / 1 partial — **0 with no analog**

> **Headline for the planner:** every mechanism this phase needs already exists in the codebase.
> IconNode's wire shape mirrors CopyButtonNode/BadgeNode (leaf node with a closed-union field + optional tone/size).
> The 5 cross-node `icon?:` props mirror the `tooltip?: string` field pattern shipped in 6.12.0 across the same host set.
> Icon-only-button validation mirrors `ValidateSectionAction`'s walker; the `.NET` closed-union `IconName` mirrors `Tone`/`Emphasis` enum-with-converter.
> Parity extension mirrors the v5.1 nav-primitives / v5.2 lookup pattern (EXTEND FeatureProbe `buildVm` + append `$comment` clause; NOT a new fixture).
> TrackerCell rename + tooltip render swap re-uses the already-shipped 6.12.1 `.vms-tooltip-host` singleton infrastructure verbatim.

## File Classification

| File to modify | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `viewmodel-shell/src/index.ts` (IconNode + IconName) | model/wire-type | request-response | `BadgeNode` — index.ts:1281-1332; `Tone` union — index.ts:39 | exact |
| `viewmodel-shell/src/index.ts` (cross-node `icon?:`) | model/wire-type | request-response | `tooltip?:` on 8 nodes — index.ts:707,716,728,770,922,964,1247,1292 | exact |
| `viewmodel-shell/src/index.ts` (`type: "icon"` in `ViewNode` union) | model/wire-type | request-response | Existing `type: "badge"`/`"tracker"`/`"diff"` — index.ts:157-160 | exact |
| `viewmodel-shell/src/index.ts` (TrackerCell rename) | model/wire-type | request-response | Field rename — no prior in this repo; conceptually inverse of add | partial |
| `viewmodel-shell/src/browser.ts` (`icon()` renderer) | component/renderer | request-response | `badge()` renderer + `chart` inline SVG; `divider()` at browser.ts (self-closing DOM emit) | exact |
| `viewmodel-shell/src/browser.ts` (`ICONS` map — Lucide payload) | asset/config | one-time bundle | `default.css` bundled asset pattern; framework-owned asset with name references on wire | exact |
| `viewmodel-shell/src/browser.ts` (cross-node icon render) | component/renderer | request-response | `button()` — existing leading-content emit for `label`; `link()`, `badge()`, `listItem()`, `section()` (header) | exact |
| `viewmodel-shell/src/browser.ts` (tracker cell tooltip swap) | component/renderer | request-response | Existing `.vms-has-tooltip` + `data-vms-tooltip=` pattern on Button.tooltip / TableColumn.tooltip (TOOL-01, 6.12.0/6.12.1) | exact |
| `viewmodel-shell/src/browser.ts` (renderNode dispatch arm) | component/renderer | request-response | `case "badge":` etc. — browser.ts:534-562 | exact |
| `viewmodel-shell/src/server.ts` (Collect / walker descent) | utility (validator) | transform | `collectActions` `case "field"` — server.ts:161-165; badge/tracker are leaves so no descent | exact for host props |
| `viewmodel-shell/src/server.ts` (icon-only-button rule) | utility (validator) | transform | `ValidateSectionAction` (analog: predicate over a single node type) — cross-backend on both `.NET` and TS | exact |
| `viewmodel-shell-dotnet/ViewModels.cs` (IconNode record + IconName enum) | model/wire-type | request-response | `record BadgeNode` — ViewModels.cs:1685-…; `record TrackerNode`+`TrackerState` enum — ViewModels.cs:1399 + :77-80 | exact |
| `viewmodel-shell-dotnet/ViewModels.cs` (`[JsonDerivedType]` row) | model/wire-type | request-response | Existing `[JsonDerivedType(typeof(TrackerNode), "tracker")]` etc. — ViewModels.cs:531-558 | exact |
| `viewmodel-shell-dotnet/ViewModels.cs` (host `Icon` props + validators) | model/wire-type | request-response | `Tooltip?` on Button/Link/Section/Badge/ListItem etc.; existing `ValidateSectionAction` walker | exact |
| `parity/fixtures/feature-probe.json` + FeatureProbe backends | test/fixture | request-response | v5.1 nav primitives (`$comment` clause appended in-place) + `expectBodyContains` tripwires per branch | exact |
| `viewmodel-shell/styles/default.css` (`.vms-icon*` classes) | config/styling | — | `.vms-badge`; `.vms-tracker__cell--*`; token-driven size scale | exact |
| `viewmodel-shell/src/tui.tsx` (drop icons) | component/renderer | request-response | Existing `default: return null` or empty-emit branches (no-op nodes in TUI) | exact |
| `viewmodel-shell/test/*.test.ts` (icon + validator + tracker) | test | request-response | `tracker.test.ts` (leaf-node DOM/a11y assertions); existing `invalid-tree.test.ts` FAIL/PASS mutation pairs | exact |
| `viewmodel-shell-dotnet/Tests/` (icon + validator + tracker) | test | — | `TrackerCellSerializationTests.cs`, `ValidateSectionActionTests.cs` (FAIL-before/PASS-after via mutation) | exact |

---

## 1. `viewmodel-shell/src/index.ts` — `IconNode` wire type + `IconName` closed union

**Analog:** `viewmodel-shell/src/index.ts:1281-1332` (`BadgeNode`) — a leaf ViewNode with `tone?: Tone` and a small enum of appearance axes.

**The pattern, quoted** (BadgeNode, index.ts:1281-1298):

```typescript
export interface BadgeNode {
  type: "badge";
  label: string;
  /** Semantic tint … */
  tone?: Tone;
  /** Filled vs outlined … */
  emphasis?: Emphasis;
  /** Hover-only info tooltip (6.12.0, TOOL-01). See FieldNode.tooltip. */
  tooltip?: string;
}
```

**What to copy:**

- Leaf-node shape: no `children`, no `action` — same as BadgeNode.
- TSDoc "closes with `Omitted = <default>`" convention (house style).
- Add `IconNode` to the `ViewNode` union at index.ts:157-160 in the SAME alphabetical/grouped block where BadgeNode/TrackerNode/DiffNode already live.
- `type: "icon"` discriminator — same shape as every other node.

**What to do differently:**

- `name: IconName` is a **closed union of ~102 string literals** — TS union declared as `export type IconName = "activity" | "alert-circle" | ... | "zap"` at file top. This mirrors `Tone` at index.ts:39.
- `size?: "xs" | "sm" | "md" | "lg" | "xl"` — same size axis Button/CopyButton already ship; **do NOT** create a new size union. Reference the existing `ControlSize` if present or inline the same 5-value union.
- `label?: string` — semantics-carrying override; TSDoc must say "Omitted = decorative (`aria-hidden`); present = `role='img'` + `aria-label`" per design-doc §8. **This is the a11y discipline lock — TSDoc must state it or the next implementer breaks it.**
- No `emphasis?` axis — icons don't have a filled/outlined axis in Lucide (design-doc §12: out of scope).

**Tone precedent for `size` (index.ts:39 area):**

```typescript
export type Tone = "info" | "success" | "warning" | "danger" | "muted" | "brand";
```

Mirror that shape for the IconName union — a bare `export type X = "..." | "..." | ...` declaration lives at the top of the file. Design-doc §6 enumerates the ~102 members; that list is the wire contract.

---

## 2. `viewmodel-shell/src/index.ts` — cross-node `icon?: IconName` on 5 hosts

**Analog:** `tooltip?: string` field pattern shipped in 6.12.0 across 8 nodes (index.ts:707,716,728,770,922,964,1247,1292). The SAME set of hosts overlaps with icon's — 5 of the 8 hosts (Button/Link/Badge — plus Section, ListItem which don't yet have tooltip but have same structural fitness).

**The pattern, quoted** (ButtonNode.tooltip, index.ts:770-771):

```typescript
  /** Hover-only info tooltip (6.12.0, TOOL-01). See FieldNode.tooltip. */
  tooltip?: string;
```

**What to copy:**

- Optional, kebab-shaped, added at the END of the interface (post-existing fields to keep diffs clean).
- One-line JSDoc pointing at the design doc's §4 table for host-appropriate rendering rules (size + tone inheritance).
- Every optional nullable ⇒ `[JsonIgnore(WhenWritingNull)]` on the .NET twin (per AGENTS.md gotcha #8 — non-negotiable).

**What to do differently:**

- `icon?: IconName` — name-only, NOT `IconNode`. TSDoc must state the "two-ways-to-say-the-same-thing" rationale (per design-doc §4) or a well-meaning future PR will "upgrade" it to accept a nested IconNode.
- 5 host set: `ButtonNode`, `LinkNode`, `SectionNode`, `Badge`, `ListItem`. Skip Field/Tab/Column/Item/CopyButton — not in scope.

---

## 3. `viewmodel-shell/src/index.ts` — Add `IconNode` to `ViewNode` discriminated union

**Analog:** existing union at index.ts:118-160 lists every node type. `IconNode` gets one entry inserted alphabetically (or grouped near "chart"/"diff" as visual-primitive).

**The pattern, quoted** (index.ts:150-160):

```typescript
  | ChartNode
  | BlockquoteNode
  | CodeBlockNode
  | BreadcrumbNode
  | StepsNode
  | TrackerNode
  | DiffNode;
```

**What to copy:** insert `| IconNode` alongside the others. Zero ceremony — the exhaustive-switch in `browser.ts:node()` and `server.ts:collectActions`/`WalkForSectionAction` will now show TypeScript compile errors on missing arms, which is the intended safety net.

---

## 4. `viewmodel-shell/src/browser.ts` — `icon()` renderer + `ICONS` payload map

**Analog:** `badge()` (leaf node, DOM emit + class-list); `divider()` (self-closing DOM emit); `chart()` (inline SVG-like DOM emission).

**Structural pattern** (browser.ts renderNode arms, :534-562):

```typescript
case "badge":        return this.badge(n, parent);
```

Each arm is a one-liner; each renderer method reads the node, emits DOM under `parent`, sets class names + a11y attrs from node fields.

**What to copy:**
- Add `case "icon": return this.icon(n, parent);` to the switch at browser.ts:534-562.
- Add `private icon(n: IconNode, parent: HTMLElement): void { ... }` method.
- Emit `<svg class="vms-icon vms-icon--{size} vms-icon--{tone}" role="img"|omit aria-label={label}|aria-hidden="true" ...>{ICONS[n.name]}</svg>` per design-doc §3.
- `stroke="currentColor"` inline attribute — icons inherit color from CSS `.vms-icon--{tone}` OR parent's `currentColor` if no tone.
- Size mapping (xs=12, sm=16, md=20 default, lg=24, xl=32) as `width={px} height={px}` inline attrs.

**`ICONS: Record<IconName, string>` payload:**

- Single `const ICONS: Record<IconName, string> = { "activity": "<path d='...'/>", ... }` map alongside the `icon()` method. The path payload is the `<path>` element(s) from the Lucide SVG — NOT the whole `<svg>` wrapper (the framework owns the wrapper attributes).
- Source: `lucide-static/icons/*.svg` — extract the inner `<path>...</path>` (or `<line>`, `<circle>` for a few glyphs — Lucide is stroke-only so paths dominate).
- Bundle at build time (inline strings in `browser.ts`); NEVER dynamic fetches. Same posture as CSS: framework-owned asset, name reference on the wire.

**Cross-node icon rendering (host-side):**

- `button()`, `link()`, `badge()`, `listItem()`, `section()` all get a `if (n.icon) { … emit leading <svg> using ICONS[n.icon] with host-appropriate size class … }` insertion at the head of their content emission.
- Size inference per design-doc §4 table — hard-coded in each host's renderer (framework owns; not on the wire).

---

## 5. `viewmodel-shell/src/browser.ts` — TrackerCell tooltip swap (line ~4159)

**Analog:** `browser.ts:4159` (current state) — the `el.title = cell.label` line to replace.

**Current pattern, quoted:**
```typescript
if (cell.label != null && cell.label !== "") el.title = cell.label;
```

**Target pattern:** the shipped 6.12.1 TOOL-01 infrastructure — a body-appended `.vms-tooltip-host` singleton + JS positioning + edge-flip. See browser.ts:1266-1345 for the shipped mechanism (already used by Button.tooltip / TableColumn.tooltip / other 8 hosts).

**What to copy:**
- `if (cell.tooltip != null && cell.tooltip !== "") { el.classList.add("vms-has-tooltip"); el.dataset.vmsTooltip = cell.tooltip; }` — the exact wiring the other 8 hosts use.
- Remove the `el.title = ...` line entirely.
- Keep the a11y line `const aria = cell.tooltip != null && cell.tooltip !== "" ? cell.tooltip : state;` (renamed from `cell.label`).

**Why the shipped singleton, not `el.title`:** the shipped TOOL-01 infrastructure delivers styled tooltip bubbles across 8 nodes; native `el.title` was the pre-6.12.0 legacy. Design-doc §7: this is the one-line render-path swap that brings TrackerCell into parity with the other 8 hosts.

---

## 6. `viewmodel-shell-dotnet/ViewModels.cs` — .NET IconNode record + IconName enum

**Analog:** `record TrackerNode` (ViewModels.cs:1399) — a leaf ViewNode; `TrackerState` enum + converter (ViewModels.cs:77-80).

**The pattern, quoted** (TrackerNode + TrackerState):

```csharp
[JsonDerivedType(typeof(TrackerNode), "tracker")]
public record TrackerNode(
    IReadOnlyList<TrackerCell> Cells,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Id = null
) : ViewNode;
```

**And enum with converter** (TrackerState, ViewModels.cs:77 area):

```csharp
[JsonConverter(typeof(JsonStringEnumConverter<TrackerState>))]
public enum TrackerState { Success, Danger, Warning, Muted }
```

(Followed by a naming-policy converter or explicit `JsonPropertyName` per member if the wire uses kebab-case values.)

**What to copy:**

- `[JsonDerivedType(typeof(IconNode), "icon")]` in the registry (ViewModels.cs:531-558).
- `public record IconNode(...) : ViewNode` — positional record; every optional field carries `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`.
- `public enum IconName { Activity, AlertCircle, ..., Zap }` — ~102 members mirroring the TS union; converter emits kebab-case wire values.
- Same posture as `TrackerState` enum — bare enum + a `JsonConverter<IconName>` that emits kebab-case (`activity`, `alert-circle`, ...). Do NOT use `[EnumMember]` per-value; write a converter that walks a static `Dictionary<IconName, string>` for correctness + speed.
- Cross-node `Icon?` properties on `ButtonNode`, `LinkNode`, `SectionNode`, `BadgeNode`, `ListItemNode` records — `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null`.

**What to do differently — the closed-union-must-be-enum discipline (AGENTS.md #8):**

- `IconName` MUST be a .NET **enum**, not `string?`. The `Tone`/`Emphasis`/`TrackerState` enums are the precedent. This is the specifically-documented .NET open-vs-closed gap AGENTS.md calls out as still live on 37 of 37 unions — **do not add a 38th**. The whole point of ICON-01's byte-identical contract is that a bad `name` fails BOTH backends' tree-validators; a `string?` on .NET keeps the walker silent.

---

## 7. `viewmodel-shell/src/server.ts` (+ `.NET` walker) — icon-only-button validator

**Analog:** `ValidateSectionAction` — a walker predicate over one node type; `.NET` twin at `WalkForSectionAction` in ViewModels.cs:1770. Both throw `invalid_tree` at buildVm time (mapped to a 500 response by `ShellExceptionFilter`).

**The pattern, quoted** (server.ts, sketched):

```typescript
// server.ts collectActions/walker — when it hits a "button" node:
if (button.icon != null && (button.label == null || button.label === "") && button.tooltip == null) {
  throw new InvalidTreeError("icon-only ButtonNode requires tooltip (used as aria-label)");
}
```

.NET twin analog:

```csharp
// ViewModels.cs WalkForSectionAction (or a new WalkForIconOnlyButton) — button arm:
if (button.Icon != null && string.IsNullOrEmpty(button.Label) && button.Tooltip == null)
    throw new InvalidTreeException("icon-only ButtonNode requires tooltip (used as aria-label)");
```

**What to copy:**

- Walker structure: existing walkers (Collect / WalkForSectionAction / ValidateActionNames) all descend the tree per-node-type and throw on a rule violation — the icon-only-button rule slots in the exact same shape.
- Error message text — **byte-identical across TS/.NET** so parity's byte-diff verifies the .NET-throws-in-one-place-and-TS-in-the-other agreement. Match the message string exactly.
- Test posture: FAIL-before/PASS-after **by mutation** per banked lesson (test asserts fixture WITHOUT icon-only-button passes; mutate to remove tooltip; assert throws). Verify by mutation, not by static assertion.

**What to do differently:**

- No node descent needed — the rule is a single predicate over one node type in an existing walker. Don't build a new walker.

---

## 8. `parity/fixtures/feature-probe.json` — extend `$comment` clause; `expectBodyContains` tripwires

**Analog:** every prior wave's parity extension (v5.1 nav primitives, v5.2 lookup, v6.x tracker/diff/codeblock/blockquote/imageCaption/textLevel) — all EXTEND FeatureProbe `buildVm` and append a clause to the file-top `$comment`. **NOT a new fixture file. NOT a `backends.json` change.**

**The pattern, quoted** (feature-probe.json $comment, the trailing clause from v6.x DIFF):

```
DIFF (npm 6.x / NuGet 6.x, DiffNode): buildVm renders a 'Diff' section with TWO DiffNodes covering
the full omitted-vs-present matrix. The first is a bare diff with mode/header/id ALL omitted (proves
side-by-side default is absent, header absent, id absent — three separate WhenWritingNull posture
checks). … Captured by the existing GET steps; the initial step's expectBodyContains asserts …
```

**What to copy:**

- Add ONE clause at the end of the `$comment` string starting with `v7.0.0 (ICON-01..ICON-09, IconNode + cross-node icon composition + TrackerCell.label→tooltip rename): buildVm renders an 'Icons' section with …`.
- Each backend's `buildVm` (both `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` and `demo/FeatureProbe-bun/handler.ts`) grows an `iconsSection` that emits:
  - A standalone bare `IconNode` (size + tone + label ALL omitted, proves defaults as absent on the wire).
  - One `IconNode` per size (`xs`/`sm`/`md`/`lg`/`xl`) — proves the closed size enum crosses.
  - One `IconNode` per tone (`info`/`success`/`warning`/`danger`/`muted`/`brand`) — proves tone crosses on icons the same shape as on any other node.
  - One `IconNode` with `label:"Delete"` — proves the a11y string crosses.
  - Host examples: one ButtonNode with `icon:"sparkles"` + label:"Sparkle" (proves the cross-node prop crosses); one icon-only Button with `icon:"trash-2"` + `tooltip:"Delete"` (proves the valid form of the a11y rule); one LinkNode with `icon:"external-link"`; one SectionNode with `icon:"activity"` (variant:"card" — the Hestia card use case); one BadgeNode with `icon:"check-circle"`; one ListItemNode with `icon:"folder"`.
  - A TrackerCell with `tooltip:` set (the rename verification — proves the wire field is `tooltip`, not `label`, and that `WhenWritingNull` still applies).
- **`expectBodyContains` tripwires** on `seeded-initial` / other GET steps for at LEAST: `"type":"icon"`, `"name":"sparkles"`, `"name":"trash-2"`, `"size":"xl"`, `"size":"xs"`, `"tone":"danger"`, `"label":"Delete"`, `"icon":"sparkles"` (host prop), `"icon":"external-link"`, `"tooltip":"Delete"` (the icon-only button), `"tooltip":` on the tracker cell + `"label":` ABSENT from the tracker cell (via a second step or via omission from expectBodyContains — verify via read).

**Why the tripwires matter — banked lesson:** a diff only sees what a fixture step actually renders. If a backend silently omits an icon section or normalizes away the enum-vs-string difference, the byte-diff can print "all agree" over a real drift. Each `expectBodyContains` string is a substring only its branch emits — the tripwire that makes vacuous coverage fail loudly.

---

## 9. `viewmodel-shell/styles/default.css` — `.vms-icon*` CSS classes

**Analog:** `.vms-badge` / `.vms-tracker__cell--*` — atomic size + tone modifiers on a base class; token-driven colors.

**The pattern, quoted** (`.vms-badge` — default.css:1141-1185 area):

```css
.vms-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 12px; }
.vms-badge--info    { background: var(--vms-info-bg);    color: var(--vms-info-fg); }
.vms-badge--danger  { background: var(--vms-danger-bg);  color: var(--vms-danger-fg); }
/* etc */
```

**What to copy:**

- Base `.vms-icon { display: inline-block; vertical-align: -0.125em; }` — inline flow-friendly.
- `.vms-icon--xs`/`--sm`/`--md`/`--lg`/`--xl` with `width` + `height` from the size mapping (12/16/20/24/32px).
- `.vms-icon--info`/`--success`/`--warning`/`--danger`/`--muted`/`--brand` each setting `color: var(--vms-{tone}-fg)` — inherited by the SVG's `stroke="currentColor"`.
- The default (no tone class) — inherits `currentColor` from the surrounding context per design-doc §3.

**AA-contrast hand-check (ICON-08):** the new fg/bg pairs to hand-check are the icon-on-tinted-surface cases:
- `.vms-icon--danger` on `.vms-badge--danger` background (icon-inside-badge with matching tone).
- `.vms-icon--warning` on `.vms-section--card` with `.vms-section--warning` tint (icon-on-card).
- Repeat for each of the 6 tones × the 2 tinted surface types.
- Across default + all 12 themes (`themes/*.css`).
- **The fixed 13-pair `check:aa-contrast` gate does NOT auto-cover new pairs** — hand-check + deepen only the failing tones via `color-mix` per the shipped v3.5.0 pattern (banked lesson).

---

## 10. `viewmodel-shell/src/tui.tsx` — drop icons

**Analog:** TUI renderer has existing no-op branches for nodes that don't render textually (or that fall through as null/omitted).

**What to copy:**

- Add `case "icon": return null;` (or `return "";`) to the TUI `node()` switch. Zero DOM, zero unicode fallback.
- In host renderers (button/link/badge/section/listitem), the TUI simply ignores `n.icon` — no code needed if the renderer only reads label/other fields.

**Why nothing more:** design-doc §9, per standing directive (TUI is `@experimental`, not-invested-in). No unicode-fallback map. Zero maintenance cost.

---

## 11. Test files — jsdom + .NET, FAIL-before/PASS-after by mutation

**Analog for jsdom tests:** `viewmodel-shell/test/tracker.test.ts` — leaf-node DOM shape + a11y attribute assertions.

**Analog for validator tests:** existing invalid-tree tests that mutate a fixture to exercise the FAIL branch (search for `throws.*invalid_tree` in `viewmodel-shell/test/`).

**Analog for .NET tests:** `viewmodel-shell-dotnet/Tests/TrackerCellSerializationTests.cs` (wire-shape) + `ValidateSectionActionTests.cs` (walker rules).

**What to copy:**

- jsdom test file `viewmodel-shell/test/icon.test.ts`:
  - Standalone `IconNode` renders `<svg class="vms-icon vms-icon--md">`. Verify size, tone, aria-label / aria-hidden.
  - Cross-node icon: `ButtonNode` with `icon:"sparkles"` renders a leading `<svg>` sized `sm`.
  - Icon-only button with `tooltip` renders (a11y: tooltip → aria-label — verify the button's `aria-label` attr matches).
  - Icon-only button without `tooltip` throws `InvalidTreeError` (FAIL-before/PASS-after by mutation).
- .NET test file `viewmodel-shell-dotnet/Tests/IconNodeSerializationTests.cs`:
  - `IconNode(Name: IconName.Sparkles)` serializes as `{"type":"icon","name":"sparkles"}` — proves enum → kebab.
  - Optional fields omitted ⇒ absent on wire (WhenWritingNull posture — the class-2 defect `findNulls` catches).
- .NET test file `viewmodel-shell-dotnet/Tests/IconOnlyButtonValidatorTests.cs`:
  - `Validate()` throws `InvalidTreeException` for `ButtonNode { Icon = ..., Label = null, Tooltip = null }`.
  - Same case with `Tooltip = "Delete"` passes.
- .NET test `viewmodel-shell-dotnet/Tests/TrackerCellRenameTests.cs`:
  - `TrackerCell(Tooltip: "text")` serializes as `{"tooltip":"text"}` (proves rename landed both wire + type).
  - Old `Label` field must NOT exist on the record (compile-time proof).

**AGENTS.md test-suite rules apply — every test must ship green as part of the plan; `viewmodel-shell-dotnet/Tests` is the framework test project (easy to forget — was uncompilable 3.0.0 → 3.3.0 exactly because it was not run in this same gate).**

---

## 12. Demo / verification page (ICON-10)

**Analog:** `demo/Showcase/` (the shipped visual gallery) + prior tailnet verification pages Ashley signed off on for chart / lookup / nav.

**Design-doc §10 + §11 discipline (banked lessons):**

- **Drive the REAL bundle** — `import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser"` (the shipped bundle, not a local mock).
- **Real shipped CSS** — `import "@ashley-shrok/viewmodel-shell/styles.css"` + theme(s).
- **REAL tree-validator in the fetch-shim** — the shim MUST run `buildVm` output through `ViewTreeValidation.ValidateActionNames` + `ValidateSectionAction` (or the equivalent TS validators) before returning it to the shell, so it fails the same way the real server would. Otherwise the shim silently accepts trees the real server rejects (banked lesson from the pre-6.12.0 verification page).
- **One-hover-test any documented limitation** — the "known v1 TUI-icons-dropped" limitation must NOT quietly fire on the verification page's happy path (the TUI is a separate target; not on this page). But: any icon-on-tone pair Ashley might notice as low-contrast must be tested BEFORE ship — a "known v1 limitation" that fires on FIRST USE is a defect (banked lesson from v6.12.0 tooltip ship).

**Page contents (per ROADMAP success criterion 8 + design-doc §11):**

- Hestia-style card grid — 8 SectionNodes, `variant:"card"`, each with `icon:"sparkles"`/etc. covering all 8 Pixie concept anchors.
- Icon-in-Button / Badge / ListItem / Link examples (one of each with `icon:"..." + label:"..."` — content-carrying).
- All 5 sizes shown side-by-side on a standalone IconNode.
- Full tone matrix — one row per tone × one column per icon (a few representative icons).
- Live TrackerCell strip with `tooltip:` fields, rendered via the new TOOL-01 body-appended `.vms-tooltip-host` singleton (the exact 6.12.1 infrastructure) — proves the rename + render-path swap end-to-end.
- Light + dark theme toggle.
- Served over the tailnet for Ashley pre-publish sign-off.

---

## 13. Release ritual (ICON-11)

**Analog:** every prior aligned release — v3.0.0 (unified appearance axes), v5.0.0 (ButtonNode.confirm), v6.0.0 (feedback primitives). AGENTS.md "Working agreement" governs.

- **Green-tree gate** before ANY publish (full `npx vitest run` + all 5 `check:*` + `bun run parity/run.ts` 17+ backends + `viewmodel-shell-dotnet/Tests` + EVERY `demo/**/*.Tests.csproj`). No exceptions.
- **Credential precheck** (`.env` at repo root, gitignored; `NPM_TOKEN` GAT + `NUGET_API_KEY`) — never `npm login`; if auth is broken, STOP and tell Ashley BEFORE bumping (banked lesson: stranded versions).
- **Bump BOTH** `viewmodel-shell/package.json` version + `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>` to `7.0.0`.
- **CHANGELOG.md** entry — icons additive summary + TrackerCell breaking rename (the ONE break).
- **MIGRATION.md** — the one-line rename note (`TrackerCell.label` → `TrackerCell.tooltip`; consumers change `label:` to `tooltip:` in buildVm).
- **Molly DM'd** on the relay (agent-relay) BEFORE publish with the rename + MIGRATION excerpt.
- **Publish** (operator-gated per AGENTS.md ritual; agent stops after bumping): `npm publish` from `viewmodel-shell/`; `dotnet pack -c Release && dotnet nuget push …` from `viewmodel-shell-dotnet/`.
- **Tag** `v7.0.0` at the release commit.
- **Advance `main`** — `git merge-base --is-ancestor v7.0.0 main` must be true (banked lesson: v1.5.0/v1.6.0 stranded main at v1.4.0 for two days).
- **`#vms-changelog`** release line via agent-relay.

---

## Summary — analogs at a glance

| Requirement | Primary analog | New machinery needed? |
|---|---|---|
| ICON-01 (wire type) | `BadgeNode` + `Tone` union | No — leaf-node + closed-union pattern is well-worn |
| ICON-02 (Lucide payload) | `default.css` bundled-asset posture | Bundled inline strings — new one-time asset |
| ICON-03 (browser renderer) | `badge()` + `divider()` DOM emit | New method following existing shape |
| ICON-04 (5 host props) | `tooltip?:` on 8 hosts (6.12.0) | No — just add `icon?: IconName` following the same shape |
| ICON-05 (icon-only-button rule) | `ValidateSectionAction` walker | No — one new predicate in existing walkers |
| ICON-06 (TrackerCell rename + tooltip infra) | Existing `.vms-tooltip-host` singleton | No — reuses shipped 6.12.1 infra verbatim |
| ICON-07 (TUI drop) | Existing no-op node arms | No — one `return null` |
| ICON-08 (AA-contrast hand-check) | v3.5.0 `color-mix` deepen-failing-tones pattern | No — same manual process |
| ICON-09 (parity FeatureProbe extension) | v5.1 nav + v5.2 lookup patterns | No — extend + append `$comment` + tripwires |
| ICON-10 (demo + verification page) | Prior tailnet verification pages | Standard build; discipline is the load-bearing part |
| ICON-11 (aligned v7.0.0 release) | Every prior aligned release | Standard AGENTS.md publish ritual |

**Verdict:** no new machinery. Every pattern this phase needs is already shipped and in-repo; the executor's job is to follow the analogs, not to invent.
