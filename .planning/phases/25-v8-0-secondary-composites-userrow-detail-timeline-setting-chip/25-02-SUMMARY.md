---
phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip
plan: 02
subsystem: ui
tags: [composite-nodes, detail-row, detail-list, semantic-html, dl-dt-dd, css-var-pattern, view-node, dotnet, typescript, wire-parity]

requires:
  - phase: 24-v8-0-primary-composites
    provides: MessageListNode container template (IReadOnlyList<ViewNode> + runtime tree-invariant), tree-validator walker discipline
  - phase: 25-01-userrow
    provides: shipped v8.0 secondary-composite pattern (typed slots + tree-invariant + CSS + tests), overlapping files landed
  - phase: 23-typography-caption-weight-avatar
    provides: TextNode.style="body", --vms-text-muted deepened palette (Phase 23 caption-tier hand-check inheritance)
provides:
  - DetailRowNode wire type shipped both backends (TypeScript + .NET), byte-identical
  - DetailListNode wire type shipped both backends, byte-identical, with semantic `<dl>` container
  - DetailLabelWidth closed 3-value enum with KebabEnum serialization ("sm"/"md"/"lg")
  - --vms-detail-label CSS-var pattern driving fixed label column width (sm=8rem, md=10rem default, lg=12rem)
  - Semantic HTML choice (`<dl>`/`<dt>`/`<dd>`) mutation-tested — screen-reader term/definition semantics
  - Baked label typography (.vms-detail-row__label CSS: text-xs uppercase weight:500 muted) — NOT TextNode-wrapped
  - Byte-identical tree-invariant rejection: "DetailListNode.children must all be DetailRowNodes (found: <type>)"
  - vitest coverage (18 tests) + .NET serialization tests (14 + 9 = 23 [Fact])
  - AA-contrast hand-check header (65 pair-checks: 13 label × themes + 52 tone-value × 4 × 13)
affects: [25-03-timeline, 25-04-setting-row, 25-05-chip, 25-07-showcase, 25-08-parity-extension, 25-10-final-gate]

tech-stack:
  added: []
  patterns:
    - "Semantic-HTML element choice as load-bearing renderer decision — `<dl>` vs `<div>` for definition-list container, `<dt>`/`<dd>` for term/definition. Mutation-testable: swap `<dl>` → `<div>` breaks the semantic-element test and silently drops screen-reader semantics. Downstream composites that carry list/definition semantics may reuse this posture."
    - "CSS-var pattern for closed-enum size axis — enum values (sm/md/lg) emit modifier classes (`.vms-detail-list--{value}`) that set a CSS custom property (`--vms-detail-label`) read by descendant grid tracks (`grid-template-columns: var(--vms-detail-label) 1fr`). Container default = md; omitted enum = no modifier class (byte-identical to md set explicitly)."
    - "Baked-in-CSS trained typography for primitive slots — DetailRowNode.label is a PRIMITIVE string (not a ViewNode-typed slot); its uppercase+text-xs+muted+weight:500 typography lives ENTIRELY in `.vms-detail-row__label` CSS. The renderer emits a raw `createTextNode` inside the `<dt>`, NOT a TextNode wrap. Mutation-testable: wrapping the label in a TextNode inserts a `.vms-text` element inside the `<dt>` and breaks the raw-text assertion."

key-files:
  created:
    - viewmodel-shell/test/detail-row.test.ts (18 vitest — semantic HTML mutation + labelWidth × 4 states + tone × 4 + string/ViewNode value + label-not-TextNode + icon-before-label + tree-invariant + AA header)
    - viewmodel-shell-dotnet/Tests/DetailRowNodeSerializationTests.cs (14 [Fact] — discriminator + null-omission + Value polymorphic + Tone × 4 KebabEnum + Icon kebab + all-fields-set)
    - viewmodel-shell-dotnet/Tests/DetailListNodeSerializationTests.cs (9 [Fact] — discriminator + empty children + polymorphic child discriminator + LabelWidth × 3 KebabEnum + tree-invariant byte-identical error)
    - .planning/phases/25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip/25-02-SUMMARY.md
  modified:
    - viewmodel-shell/src/index.ts (+ DetailRowNode + DetailListNode interfaces, + ViewNode union entries)
    - viewmodel-shell/src/browser.ts (+ private detailRow() + private detailList() renderers, + case arms, + type imports)
    - viewmodel-shell/src/server.ts (+ collectActions arms with tree-invariant, + walkForSectionAction arms, + type imports)
    - viewmodel-shell/styles/default.css (+ .vms-detail-list*/.vms-detail-row* blocks + --vms-detail-label CSS-var pattern + labelWidth modifiers + tone-accent value colors)
    - viewmodel-shell-dotnet/ViewModels.cs (+ DetailLabelWidth enum + DetailRowNode record + DetailListNode record + [JsonDerivedType] × 2 + ViewNodeWireName mappings + Collect arms + WalkForSectionAction arms)

key-decisions:
  - "Label is a PRIMITIVE string (not ViewNode-typed). Reason: the trained typography (text-xs uppercase weight:500 muted) is a fixed, non-negotiable part of the composite recipe; baking it in CSS keeps the recipe simple and makes deviation a mutation-testable regression (wrapping the label in a TextNode is the exact mutation that breaks the raw-text-in-<dt> test). Downstream composites with equivalent 'fixed micro-typography' slots may reuse this posture."
  - "DetailListNode.Children typed IReadOnlyList<ViewNode> on the .NET side (not IReadOnlyList<DetailRowNode>). Reason: polymorphic discriminator emission requires the widened base type per the FormNode.Buttons banked posture at ViewModels.cs:1155-1159 — a narrow list drops `\"type\":\"detail-row\"`. The invariant is enforced entirely at runtime in ViewTreeValidation.Collect."
  - "`<dl>` container is load-bearing. Reason: definition-list semantics tell screen readers each child is a term/definition PAIR inside a list of pairs. A `<div>` container would drop that meta-semantic — the `<dt>`/`<dd>` pairs would still announce individually, but the 'these belong to the same list' signal disappears. Mutation-tested (swap breaks 2 tests)."
  - "labelWidth omitted on the wire = NO modifier class (not `.vms-detail-list--md`). Reason: the container's own default `--vms-detail-label: 10rem` matches md exactly, so emitting `--md` explicitly would be a byte-identical no-op that adds surface area for typos. Omitted + md-explicit both render identically to 10rem."
  - "Byte-identical tree-invariant error text across TS + .NET: `\"DetailListNode.children must all be DetailRowNodes (found: <type>)\"`. Reason: matches the shipped MessageListNode invariant pattern verbatim. Cross-backend parity gate (Plan 25-08) will diff this string; any drift fails the run."
  - "AA-contrast borderline on light-family × success value text (3.63:1) accepted without a detail-row-specific deepening. Reason: matches the shipped v3.5.0 badge tone-success posture on light themes — introducing a detail-row-specific deepen would drift from the framework's tone-color parity across badges, sections, and detail-rows. Documented in the vitest AA-contrast header for future audit."

patterns-established:
  - "Semantic-HTML-choice-is-load-bearing: when a composite carries an inherent semantic (definition list, article, navigation, etc.), the renderer's `createElement(...)` choice becomes a mutation-testable contract — write the test that fails if the element is swapped for a `<div>`."
  - "CSS-var pattern for closed-enum size axes: enum values emit modifier classes that set a CSS custom property read by descendant tracks — the container owns the default value, modifiers override; omitted enum ≡ default. Downstream composites needing an aligned-column or sized-slot axis may reuse."
  - "Primitive-slot with baked-CSS typography: when a composite has a fixed micro-typography rule that's not app-negotiable, ship the slot as a `string` primitive (not `string | ViewNode`) and bake the typography in the composite's CSS block — the renderer emits `createTextNode` directly. Reduces surface, forces the composite's recipe to be the recipe."

requirements-completed: [COMP-10, COMP-10a]

# Metrics
duration: 42min
completed: 2026-07-29
---

# Phase 25 Plan 02: DetailRowNode + DetailListNode (COMP-10 + 10a) Summary

**DetailRowNode + DetailListNode shipped byte-identical across TypeScript + .NET, with `<dl>`/`<dt>`/`<dd>` semantic HTML (mutation-tested), the `--vms-detail-label` CSS-var pattern driving the closed sm/md/lg labelWidth enum, baked-in-CSS label typography (raw createTextNode inside `<dt>`, NOT TextNode-wrapped), and byte-identical tree-invariant rejection.**

## Performance

- **Duration:** ~42 min
- **Tasks:** 4/4 complete
- **Files modified:** 5 (index.ts, browser.ts, server.ts, ViewModels.cs, default.css)
- **Files created:** 3 (detail-row.test.ts, DetailRowNodeSerializationTests.cs, DetailListNodeSerializationTests.cs)
- **Commits:** 4 (one per task)

## Accomplishments

### Wire types + CSS (Task 1) — commit `c087b7a`

- **TypeScript (`viewmodel-shell/src/index.ts`):** Added `DetailRowNode` interface with slots `label: string` (PRIMITIVE — trained typography baked in CSS, not ViewNode-typed), `value: string | ViewNode` (required — TextNode body string-lift), `tone?: "danger" | "warning" | "success" | "info"` (closed union), `icon?: IconName`. Added `DetailListNode` interface with slots `children: DetailRowNode[]` (required — tree-validator rejects non-DetailRow), `labelWidth?: "sm" | "md" | "lg"` (closed enum, omitted = no modifier). Appended `| DetailRowNode | DetailListNode` to the ViewNode union.
- **.NET (`viewmodel-shell-dotnet/ViewModels.cs`):** Added `DetailLabelWidth` enum (`Sm, Md, Lg`) with `[JsonConverter(typeof(KebabEnum<DetailLabelWidth>))]` for wire strings `"sm"/"md"/"lg"`. Added `DetailRowNode` record with `Label` (non-nullable primitive), `Value` (non-nullable ViewNode — polymorphic discriminator emission), `Tone?` + `Icon?` with `[JsonIgnore(WhenWritingNull)]`. Added `DetailListNode` record with `Children` (typed `IReadOnlyList<ViewNode>` per Phase 24 MessageListNode posture), `LabelWidth?` with `WhenWritingNull`. Registered `[JsonDerivedType(typeof(DetailRowNode), "detail-row")]` and `[JsonDerivedType(typeof(DetailListNode), "detail-list")]` on the `[JsonPolymorphic]` block.
- **CSS (`viewmodel-shell/styles/default.css`):** Appended the full DetailRow + DetailList block after the UserRow status-dot section. **`--vms-detail-label` CSS-var pattern:** `.vms-detail-list` sets `--vms-detail-label: 10rem` (default = md); `.vms-detail-list--sm`/`--md`/`--lg` override to 8rem/10rem/12rem; `.vms-detail-row` reads it as `grid-template-columns: var(--vms-detail-label) 1fr`. Label typography (`text-xs`/`uppercase`/`letter-spacing:0.04em`/`weight:500`/`color:text-muted`) baked in `.vms-detail-row__label`. Tone-accent value colors: `.vms-detail-row--{tone} .vms-detail-row__value { color: var(--vms-{tone}); }` × 4.
- **Builds green.** grep-checked all acceptance criteria: 2 interface exports; 18 DetailRow/DetailList/DetailLabelWidth references in .NET; 12 CSS class references; 6 `--vms-detail-label` occurrences.

### Renderer (Task 2) — commit `e5670e7`

- **`private detailList()`** in `viewmodel-shell/src/browser.ts` mirrors `messageList()` byte-for-byte for the container shape, with THE key adaptation: `document.createElement("dl")` — the semantic HTML element for a definition list. Emits `[vms-detail-list--{labelWidth}]` modifier ONLY when labelWidth is set (omitted → no modifier, byte-identical to md default per the CSS-var pattern). Children walked through the standard `this.kids()` dispatch (the tree-validator gates non-DetailRow children server-side; no belt-and-braces filter here).
- **`private detailRow()`** emits `<div class="vms-detail-row [vms-detail-row--{tone}]"><dt><dd></div>`. The `<div>` wrapper is load-bearing (carries the grid — a bare `<dt>`+`<dd>` sibling pair cannot be grid-columned as a unit). The `<dt>` receives: optional icon SVG (via `renderIconSvg(n.icon, "sm", …)`) THEN a raw `document.createTextNode(n.label)` — the label ships as a RAW TEXT NODE, NOT wrapped in a TextNode. The `<dd>` receives the string-lifted value (`{ type: "text", value: n.value, style: "body" }` when string; the ViewNode as-is otherwise).
- Added `case "detail-row": return this.detailRow(n, parent, on);` and `case "detail-list": return this.detailList(n, parent, on);` to the `renderNode` switch immediately after `case "user-row"`.
- Added `DetailRowNode, DetailListNode` to the type import list at the top of `browser.ts`.
- **Core-globals guard PASSES** — `viewmodel-shell/src/index.ts` still references zero platform globals; the renderer lives entirely in `browser.ts`.

### Walkers (Task 3) — commit `cebd478`

- **TS `collectActions`:** Added `case "detail-row"` arm that descends into `dr.value` ONLY when `typeof dr.value !== "string"` (the string case is a leaf that the renderer auto-wraps). No action recording (DetailRowNode is passive display — no action slot). Added `case "detail-list"` arm that walks each child and throws with byte-identical error text `"DetailListNode.children must all be DetailRowNodes (found: ${c.type})"` when the child's `type` is not `"detail-row"`; then descends into each child for name-uniqueness collection.
- **TS `walkForSectionAction`:** Passthrough arms — DetailRowNode descends into Value (guarded), DetailListNode walks children — so a future consumer can't slip an interactive SectionNode inside a DetailRowNode slot.
- **.NET `Collect`:** `case DetailRowNode detailRow` arm — `Value` always descended (non-nullable). `case DetailListNode detailList` arm — validates each child `is DetailRowNode`, throws `InvalidOperationException` with byte-identical text `"DetailListNode.children must all be DetailRowNodes (found: {childType})"` (childType from `ViewNodeWireName` — added `DetailRowNode → "detail-row"`, `DetailListNode → "detail-list"` entries), then descends into each child.
- **.NET `WalkForSectionAction`:** Passthrough arms identical shape.
- **Byte-identical error text verified** (TS + .NET regex-matched to the exact string). Both builds green.

### Tests (Task 4) — commit `f3709a9`

- **vitest (`viewmodel-shell/test/detail-row.test.ts`) — 18 tests, all pass:**
  - **Semantic HTML choice (mutation-testable):** `emits <dl> semantic element (NOT <div>)` asserts `tagName === "DL"` on the container; `emits vms-detail-list class on the <dl>` also anchors the choice. Mutation-verified below.
  - **DetailRowNode structure:** `<div class="vms-detail-row"><dt><dd></div>` — `dt.classList.contains("vms-detail-row__label")`, `dd.classList.contains("vms-detail-row__value")`, `<dt>` before `<dd>` in DOM order.
  - **labelWidth × 4 states:** absent → NO modifier class (`element.className === "vms-detail-list"` exact match); sm/md/lg → `vms-detail-list--{value}` class present.
  - **Tone × 4:** each `vms-detail-row--{tone}` emitted when set, all 4 tone modifiers absent when tone omitted.
  - **String value → TextNode{style:"body"}:** `.vms-text.vms-text--body` inside the `<dd>`, NOT `--muted` or `--caption`. Mutation-testable (swap "body" → "muted" breaks it).
  - **ViewNode value passthrough:** a TextNode with `style:"muted"` passed as value renders VERBATIM (keeps `--muted`, does NOT re-wrap in a body TextNode).
  - **Label-NOT-TextNode-wrapped (mutation-testable):** asserts `<dt>` has NO `.vms-text` descendant, and its `lastChild` is a `Node.TEXT_NODE` whose `nodeValue` matches the label exactly. Mutation-testable (wrapping in a TextNode inserts a `<div>` element and breaks the assertion).
  - **Icon-before-label:** icon SVG appears BEFORE the label text node in the `<dt>` (via `compareDocumentPosition`).
  - **Tree-validator (byte-identical error):** passing a TextNode child to DetailListNode + calling `validateActionNames` throws exactly `"DetailListNode.children must all be DetailRowNodes (found: text)"`.
  - **Positive control:** a well-formed tree does NOT throw.
- **AA-contrast hand-check header:** 65 pair-checks recorded (13 label × themes = regression verification of Phase 23 caption-tier + 52 tone-accent value × 4 tones × 13 themes). All pass modulo the light-family × success borderline (3.63:1 — matches shipped v3.5.0 badge posture on light themes; documented as accepted, no detail-row-specific deepening).
- **.NET (`DetailRowNodeSerializationTests.cs`) — 14 [Fact], all pass:**
  - Discriminator: `"type":"detail-row"`.
  - `BareNode_MinimalShape_LabelAndValueOnly` — canonical WhenWritingNull posture; every optional (Tone, Icon) ABSENT (not null).
  - Label round-trips as a primitive string.
  - Value polymorphic emission (`"value":{"type":"text",…}`).
  - Value custom ViewNode keeps caller style (no forced string-lift on the wire).
  - Tone × 4: `Tone_{Danger,Warning,Success,Info}_SerializesAsKebab`.
  - Icon: OmittedIsAbsent + `Info` single-word + `AlertTriangle` multi-word kebab round-trip.
  - `AllFieldsSet_AllPresent` — every field present when set.
- **.NET (`DetailListNodeSerializationTests.cs`) — 9 [Fact], all pass:**
  - Discriminator: `"type":"detail-list"`.
  - `Children_EmptyList_SerializesAsEmptyArray` — bare shape `{"type":"detail-list","children":[]}` exactly.
  - Children polymorphic discriminator (`"type":"detail-row"` × 2 for two children).
  - LabelWidth × 3: `Sm`/`Md`/`Lg` KebabEnum round-trip + `OmittedIsAbsent`.
  - `TreeInvariant_DetailListWithNonDetailRowChild_ThrowsInvalidTree` — passing a TextNode child to `ValidateActionNames` throws exactly `"DetailListNode.children must all be DetailRowNodes (found: text)"` (byte-identical to the TS twin).
  - Positive control: a legitimate DetailListNode passes the validator.

## Mutation-test evidence (semantic-HTML choice)

The plan's critical mutation test: swap `document.createElement("dl")` → `document.createElement("div")` in `browser.ts`'s `detailList()` renderer, then run `npx vitest run test/detail-row.test.ts`.

**Result recorded:** 2 tests FAIL after the swap:
```
FAIL  test/detail-row.test.ts > DetailListNode (COMP-10a) — semantic HTML element > emits <dl> semantic element (NOT <div>)
FAIL  test/detail-row.test.ts > DetailListNode (COMP-10a) — semantic HTML element > emits vms-detail-list class on the <dl>
```

Revert restored green (18/18 pass). The semantic-element choice is a genuinely load-bearing renderer decision, not a decorative comment — a `<dl>` → `<div>` regression would break these tests immediately.

## Byte-identical tree-invariant error message

The plan mandates BOTH backends throw the SAME literal string:
```
DetailListNode.children must all be DetailRowNodes (found: <type>)
```

- **TS source (`viewmodel-shell/src/server.ts`):**
  ```typescript
  throw new Error(
    `DetailListNode.children must all be DetailRowNodes (found: ${c.type})`
  );
  ```
- **.NET source (`viewmodel-shell-dotnet/ViewModels.cs`):**
  ```csharp
  throw new InvalidOperationException(
      $"DetailListNode.children must all be DetailRowNodes (found: {childType})");
  ```
- **Runtime assertions in both test files** verify a TextNode child (wire type `"text"`) produces literally:
  - TS: `"DetailListNode.children must all be DetailRowNodes (found: text)"` (from vitest `.toThrow(...)`)
  - .NET: `"DetailListNode.children must all be DetailRowNodes (found: text)"` (from `Assert.Equal(...)`)

The two strings match byte-for-byte. Cross-backend parity gate (Plan 25-08) will hold this rigidly.

## CONTEXT §2 shipped exactly

Cross-referencing the LOCKED schema in CONTEXT §2 against what shipped:

| CONTEXT §2 requirement | Shipped |
|------------------------|---------|
| `DetailRowNode.type = "detail-row"` | ✓ TS + .NET |
| `label: string` primitive (trained CSS not TextNode-wrapped) | ✓ raw `createTextNode` inside `<dt>` (mutation-tested) |
| `value: string \| ViewNode` (trained TextNode body) | ✓ string → `TextNode{style:"body"}`, ViewNode → as-is |
| `tone?: 4-way closed union` | ✓ CSS emits `.vms-detail-row--{tone}` × 4 |
| `icon?: IconName` (leading, before label) | ✓ SVG inside `<dt>` before label text (DOM-order tested) |
| `DetailListNode.children: DetailRowNode[]` (validator-enforced) | ✓ byte-identical error TS + .NET |
| `labelWidth?: closed sm/md/lg` (8/10/12rem) | ✓ CSS-var pattern via `--vms-detail-label` |
| DetailListNode emits `<dl>` container | ✓ mutation-tested |
| Each DetailRowNode emits `<div><dt><dd></div>` | ✓ semantic-HTML structure tested |
| Grid `[label \| value]` via CSS var | ✓ `.vms-detail-row { grid-template-columns: var(--vms-detail-label) 1fr; }` |
| Label baked typography (text-xs uppercase weight:500 muted) | ✓ `.vms-detail-row__label` block |

**All CONTEXT §2 requirements shipped exactly as locked at tasting approval.**

## Deviations from Plan

None — plan executed exactly as written. Every task's `<action>` block landed byte-for-byte per its specification; every acceptance criterion verified.

## Green-tree gate status

- **`npm run build`** (viewmodel-shell): green
- **`npm run check:core-globals`**: green (no new platform-global references in core)
- **`npx vitest run`** (full framework suite): green — 75 test files, 1177 tests passed, 1 skipped
- **`dotnet build`** (viewmodel-shell-dotnet): green
- **`dotnet test viewmodel-shell-dotnet/Tests`** (full .NET suite): green — 367 tests passed, 0 failed

Per plan critical directive: NO release ship. CHANGELOG/MIGRATION untouched. Parity extension deferred to Plan 25-08 as directed.

## Commits (this plan)

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `c087b7a` | feat(25-02): add DetailRowNode + DetailListNode wire types + CSS (COMP-10/10a) |
| 2 | `e5670e7` | feat(25-02): wire DetailRowNode + DetailListNode renderers in browser.ts |
| 3 | `cebd478` | feat(25-02): wire tree-validator arms for DetailRow + DetailList (COMP-10/10a) |
| 4 | `f3709a9` | test(25-02): vitest + .NET serialization tests for DetailRow/DetailList (COMP-10/10a) |

## Self-Check: PASSED

- Files created:
  - `viewmodel-shell/test/detail-row.test.ts` — FOUND
  - `viewmodel-shell-dotnet/Tests/DetailRowNodeSerializationTests.cs` — FOUND
  - `viewmodel-shell-dotnet/Tests/DetailListNodeSerializationTests.cs` — FOUND
- Commits (verified via `git log`):
  - `c087b7a` — FOUND
  - `e5670e7` — FOUND
  - `cebd478` — FOUND
  - `f3709a9` — FOUND
- Test suites (verified green):
  - vitest full: 1177 passed
  - .NET full: 367 passed
- Mutation test (`<dl>` → `<div>`): 2 tests fail, revert restores green — evidence recorded above.
- Byte-identical tree-invariant error text: verified on both backends by test-level assertions.
