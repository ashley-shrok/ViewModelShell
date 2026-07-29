---
phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip
plan: 04
subsystem: ui
tags: [composite-nodes, setting-row, setting-list, natural-pairing, checkbox-switch, view-node, dotnet, typescript, wire-parity]

requires:
  - phase: 25-03-timeline
    provides: shipped v8.0 secondary-composite pattern (typed slots + tree-invariant + byte-identical error-message discipline), 4th consecutive composite in Wave 4 sequence
  - phase: 24-v8-0-primary-composites
    provides: ListRowNode.action whole-row click semantics + stopPropagation selector-list template, MessageListNode IReadOnlyList<ViewNode> polymorphic-discriminator posture, EmptyStateNode "structural elements outside the semantic list" heading posture
  - phase: 23-typography-caption-weight-avatar
    provides: TextNode.style="body" + weight="medium" (COMP-01 body tier + COMP-02 weight axis for label string-lift), TextNode.style="muted" (for description string-lift), CheckboxNode.variant="switch" (COMP-03 — the natural pairing target)
  - phase: 22-icons
    provides: IconName closed union + renderIconSvg helper (for optional leading icon slot on the body column)
provides:
  - SettingRowNode wire type shipped both backends (TypeScript + .NET), byte-identical, with typed slots [icon?, label, description?, trailing?, action?]
  - SettingListNode wire type shipped both backends, byte-identical, with optional heading emitted as SIBLING <h3> BEFORE the semantic <ul> (Phase 24 EmptyStateNode posture)
  - Natural pairing with CheckboxNode(variant:"switch") from COMP-03 exercised explicitly in vitest (the whole recipe exists so an app hands { label, description, trailing: switch } and gets the shipped layout for free)
  - Whole-row action's stopPropagation selector list EXTENDED to include .vms-field--switch so a click on the trailing switch does NOT double-fire the row action (mitigation for threat T-25-04-02)
  - Byte-identical tree-invariant rejection: "SettingListNode.children must all be SettingRowNodes (found: <type>)"
  - vitest coverage (25 tests) + .NET serialization tests (13 + 7 = 20 [Fact])
  - AA-contrast reuse documented: NO NEW pair-checks — label reuses Phase 24 body-tier text pairs, description reuses Phase 23 muted text pairs, trailing switch reuses Phase 23 COMP-03 checkbox-switch AA hand-check
affects: [25-05-chip, 25-07-showcase, 25-08-parity-extension, 25-09-changelog, 25-10-final-gate]

tech-stack:
  added: []
  patterns:
    - "Natural-pairing composite recipe — a composite whose trailing/leading slot is expected to hold a specific shipped node type (SettingRowNode.trailing = CheckboxNode(variant:'switch'), UserRowNode.avatar = AvatarNode). The recipe exists SPECIFICALLY to make that combination one-line so an app writes { label, description, trailing: switch } and gets the shipped layout for free. Downstream composites: mirror this posture when a slot has an idiomatic type — document the pairing in TSDoc + exercise it in tests + showcase demo."
    - "Extended-stopPropagation selector list for nested-interactive-descendant containment — when a whole-row/whole-chip/whole-card action pairs with a shipped interactive descendant (button, checkbox, switch, link), the stopPropagation query-selector list MUST include every class the descendant emits (label wrapper + input) so the click does NOT double-fire. The extended list for SettingRow includes .vms-field--switch beyond the ListRowNode baseline; downstream composites with a whole-row action + a specific expected interactive descendant should extend similarly. Belt-and-braces: even redundant selectors are load-bearing under future refactors."
    - "Heading-as-sibling posture (banked from Phase 24 EmptyStateNode) — when a composite container needs a heading label above its semantic list, emit the heading as a SIBLING element BEFORE the list container, NOT as a child of the list. Preserves the semantic list's cleanness (only list-items inside <ul>/<ol>) and prevents a11y-validator false-positives. Downstream containers (ChipListNode? future ListListNode?) should apply."

key-files:
  created:
    - viewmodel-shell/test/setting-row.test.ts (25 vitest — <ul>/<li> semantic HTML + heading-sibling posture + heading-absent guard + <li> + clickable modifier + label string-lift with weight-medium mutation-guard + label ViewNode escape hatch + description string-lift muted + description <p> tag + description-absent guard + icon rendering + trailing slot + trailing-absent + **natural-pairing CheckboxNode(switch) test** + **stopPropagation-from-switch mitigation test** + belt-and-braces .vms-field--switch selector-list assertion + click/Enter/Space/Tab keyboard coverage + tree-invariant byte-identical error message + positive tree control)
    - viewmodel-shell-dotnet/Tests/SettingRowNodeSerializationTests.cs (13 [Fact] — discriminator + BareNode minimal null-omission + Label polymorphic + Icon absent/set kebab + Description absent/set polymorphic + Trailing absent + Trailing CheckboxNode(switch) natural-pairing + Trailing Button alternative + Action absent/set + AllFieldsSet)
    - viewmodel-shell-dotnet/Tests/SettingListNodeSerializationTests.cs (7 [Fact] — discriminator + Children empty-array byte-exact minimal wire shape + Children polymorphic with 2 setting-row discriminators + Heading absent/present + TreeInvariant byte-identical error message + TreeInvariant positive control with natural-pairing subtree)
    - .planning/phases/25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip/25-04-SUMMARY.md
  modified:
    - viewmodel-shell/src/index.ts (+ SettingRowNode + SettingListNode interfaces, + ViewNode union entries, + TSDoc documenting the natural-pairing property + Phase 24 EmptyStateNode heading-sibling posture)
    - viewmodel-shell/src/browser.ts (+ private settingRow() + private settingList() renderers, + case arms, + type imports; extended stopPropagation selector list with .vms-field--switch for T-25-04-02 mitigation)
    - viewmodel-shell/src/server.ts (+ collectActions arms with tree-invariant, + walkForSectionAction arms, + type imports; descends into trailing so nested switch actions participate in name uniqueness alongside the row action)
    - viewmodel-shell/styles/default.css (+ .vms-setting-list*/.vms-setting-row* blocks — single bordered surface + optional heading rule + grid [1fr auto] with align-items:center + max-width:42rem readable-line-length cap on description + clickable hover/focus states)
    - viewmodel-shell-dotnet/ViewModels.cs (+ SettingRowNode record + SettingListNode record + [JsonDerivedType] × 2 + Collect arms with tree-invariant + WalkForSectionAction arms; Children typed IReadOnlyList<ViewNode> per banked polymorphic-discriminator posture)

key-decisions:
  - "SettingListNode.Children typed IReadOnlyList<ViewNode> on the .NET side (not IReadOnlyList<SettingRowNode>). Reason: polymorphic discriminator emission requires the widened base type per the FormNode.Buttons banked posture at ViewModels.cs:1155-1159 — a narrow list drops `\"type\":\"setting-row\"`. The invariant is enforced entirely at runtime in ViewTreeValidation.Collect, mirroring MessageListNode/DetailListNode/TimelineNode."
  - "Heading emitted as a SIBLING <h3> BEFORE the <ul>, NOT a child. Reason: matches Phase 24 EmptyStateNode's 'structural elements outside the semantic list' posture — a non-list-item child inside a <ul> is semantic garbage and would trip a11y validators. Keeps the <ul> a clean list of <li> items. The heading-sibling-posture test in vitest is mutation-guarded (moving the heading INSIDE the <ul> breaks compareDocumentPosition assertion)."
  - "Whole-row action's stopPropagation selector list EXTENDED to include .vms-field--switch beyond the ListRowNode baseline (`.vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, .vms-field--switch, a[href]`). Reason: the natural pairing (Trailing = CheckboxNode(variant:'switch')) MUST NOT double-fire the row action — a click on the switch pill OR the switch input OR the switch label body must be contained. The extended selector list is the exact mitigation for threat T-25-04-02, verified in the vitest stopPropagation-from-switch test AND asserted by a belt-and-braces selector-list-presence test that fails if `.vms-field--switch` is removed from the list."
  - "Description slot uses `<p>` tag (not `<div>`) inside .vms-setting-row__body — the max-width:42rem readable-line-length cap is applied by class in default.css, but the <p> is the semantic 'block of prose' signal. Reason: mutation-testable — a `<div>` swap breaks the tagName assertion in vitest, and the semantic-HTML choice is load-bearing for screen readers (prose is announced differently from a generic container)."
  - "Description slot is `string | ViewNode` (unlike SettingRowNode.icon which is a primitive IconName only). Reason: description holds prose that legitimately benefits from rich content — an app might pass a TextNode with `weight: 'medium'` (COMP-02) inline with a LinkNode to link to a docs page for 'What does this setting do?'. The escape hatch to a ViewNode is the composite recipe pattern; icon has no such need (icons are closed-enum tokens)."
  - "Byte-identical tree-invariant error text across TS + .NET: `\"SettingListNode.children must all be SettingRowNodes (found: <type>)\"`. Reason: matches the shipped MessageListNode + DetailListNode + TimelineNode invariant patterns verbatim. Cross-backend parity gate (Plan 25-08) will diff this string; any drift fails the run."
  - "AA-contrast reuses Phase 23 checkbox-switch + Phase 24 primary composite text pairs — NO new pair-checks required. Reason: SettingRow introduces zero new fg/bg pairs — the label uses body-tier text (Phase 24 covered), the description uses muted text (Phase 23 caption-tier verification via text-muted × surface), and the trailing switch uses COMP-03's shipped OFF/ON track vs thumb pairs across 13 themes. Documented in the test-file header per banked pattern. Verify no regression at Plan 25-10 Ashley checkpoint (live-theme walk)."

patterns-established:
  - "Natural-pairing composite recipe: a composite whose slot is EXPECTED to hold a specific shipped node type (SettingRowNode.trailing = CheckboxNode(switch), UserRowNode.avatar = AvatarNode). Document the pairing in TSDoc + exercise it explicitly in tests + Showcase demo. The recipe exists to make that combination one-line."
  - "Extended-stopPropagation selector list for nested-interactive containment: when a composite's whole-row action pairs with a shipped interactive descendant class, the stopPropagation query-selector list MUST include every class that descendant emits. Belt-and-braces even when a single selector suffices — future refactors that remove one class must not silently reopen the double-fire bug."
  - "Heading-as-sibling posture (banked reuse from Phase 24 EmptyStateNode): heading labels above semantic lists emit as SIBLING elements BEFORE the list, NEVER as children. Preserves semantic list cleanness + prevents a11y-validator false-positives."

requirements-completed: [COMP-12, COMP-12a]

# Metrics
duration: 25min
completed: 2026-07-29
---

# Phase 25 Plan 04: SettingRowNode + SettingListNode (COMP-12 + 12a) Summary

**SettingRowNode + SettingListNode shipped byte-identical across TypeScript + .NET as the settings-page primitive, with the natural pairing with `CheckboxNode(variant:"switch")` from COMP-03 exercised explicitly in tests — the whole recipe exists so an app writes `{ label, description, trailing: switch }` and gets the shipped settings-row layout for free. Whole-row action's stopPropagation selector list is extended to include `.vms-field--switch` so a click on the trailing switch does NOT double-fire the row action (mitigation for threat T-25-04-02).**

## Performance

- **Duration:** ~25 min
- **Tasks:** 4/4 complete
- **Files modified:** 5 (index.ts, browser.ts, server.ts, ViewModels.cs, default.css)
- **Files created:** 3 (setting-row.test.ts, SettingRowNodeSerializationTests.cs, SettingListNodeSerializationTests.cs)
- **Commits:** 4 (one per task)

## Accomplishments

### Wire types + CSS (Task 1) — commit `9fd6745`

- **TypeScript interfaces (`viewmodel-shell/src/index.ts`)**: added `SettingRowNode` (`type: "setting-row"`, `icon?`, `label: string | ViewNode`, `description?: string | ViewNode`, `trailing?: ViewNode`, `action?`) and `SettingListNode` (`type: "setting-list"`, `children: SettingRowNode[]`, `heading?: string`). Both added to the `ViewNode` discriminated union. TSDoc on SettingRowNode loudly documents the natural pairing with `CheckboxNode(variant:"switch")` from COMP-03 — the recipe's raison d'être. TSDoc on SettingListNode documents the Phase 24 EmptyStateNode heading-sibling posture.
- **.NET records (`viewmodel-shell-dotnet/ViewModels.cs`)**: added `SettingRowNode` record (Label non-nullable ViewNode for polymorphic discriminator emission; Icon?/Description?/Trailing?/Action? nullable with `WhenWritingNull`) and `SettingListNode` record (Children typed `IReadOnlyList<ViewNode>` per the FormNode.Buttons banked posture at :1155-1159 for polymorphic discriminator preservation; Heading? nullable string with `WhenWritingNull`). Both registered with `[JsonDerivedType]` on the polymorphic base.
- **CSS (`viewmodel-shell/styles/default.css`)**: appended the full `.vms-setting-list*` + `.vms-setting-row*` blocks after the Timeline block. Single-bordered-surface container (matches shipped `.vms-list--rows` / `.vms-message-list` / `.vms-user-row-list` / `.vms-detail-list` convention). Grid `[1fr auto]` with `align-items: center` — control column vertically centers against the label+description stack. Description gets `max-width: 42rem` for readable line-length (framework-owned typography cap). Clickable hover + focus states via `--clickable` modifier. Docstring explicitly cites the natural pairing + heading-sibling posture.
- Both TS + .NET builds green. Verified via grep: 1 SettingRowNode interface + 1 SettingListNode interface + 2 .NET records + 2 [JsonDerivedType] registrations + 11 `.vms-setting-*` class rules + `max-width: 42rem` rule present.

### Renderer wiring (Task 2) — commit `b69812f`

- **`browser.ts` switch arms**: added `case "setting-list"` → `this.settingList(...)` and `case "setting-row"` → `this.settingRow(...)`.
- **`private settingList(n, parent, on)`**: emits an optional `<h3 class="vms-setting-list__heading">{heading}</h3>` FIRST (sibling of the `<ul>`, NOT child — Phase 24 EmptyStateNode posture — a non-list-item child inside a `<ul>` would be a11y garbage), then `<ul class="vms-setting-list">`. Children walked through `this.kids()` standard dispatch.
- **`private settingRow(n, parent, on)`**: emits `<li class="vms-setting-row [vms-setting-row--clickable]">` with `[body | control]` grid. Body (`<div class="vms-setting-row__body">`) stacks: optional icon (via `renderIconSvg`), label div (string → `TextNode { style: "body", weight: "medium" }` — COMP-01/02; ViewNode → as-is), optional description `<p class="vms-setting-row__description">` (string → `TextNode { style: "muted" }`; ViewNode → as-is). Control (`<div class="vms-setting-row__control">`) holds trailing ViewNode — the natural pairing target for CheckboxNode(variant:"switch"). Whole-row action mirrors `listRow()` at browser.ts:1220-1250 with an EXTENDED stopPropagation selector list (`.vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, .vms-field--switch, a[href]`) — the addition of `.vms-field--switch` beyond the ListRowNode baseline is the T-25-04-02 mitigation.
- Core-globals guard green (`npm run check:core-globals`) — no new platform references introduced.

### Tree-validator walker wiring (Task 3) — commit `01238a5`

- **`server.ts` `collectActions`**: `case "setting-row"` descends into `label` (when non-string; string is a leaf auto-wrapped by the renderer), `description` (when non-null AND non-string), `trailing` (always when present — the natural pairing's switch action participates in name uniqueness via this recursive dispatch), and records `action` (whole-row click participates in name uniqueness the same way ListRowNode.action + UserRowNode.action do). `case "setting-list"` enforces the tree invariant — throws `"SettingListNode.children must all be SettingRowNodes (found: ${c.type})"` on any non-`setting-row` child, then descends into each child.
- **`server.ts` `walkForSectionAction`**: passthrough arms for both nodes — SettingRow descends into label/description/trailing (when ViewNode) for defense-in-depth against nested interactive-section violations; SettingList descends into each child.
- **`ViewModels.cs` `Collect`**: SettingRowNode arm descends into `Label` (required ViewNode), `Description` (nullable ViewNode), `Trailing` (nullable ViewNode), and records `Action`; SettingListNode arm enforces the same tree invariant with byte-identical error text `"SettingListNode.children must all be SettingRowNodes (found: {childType})"` where `childType` comes from `ViewNodeWireName`.
- **`ViewModels.cs` `WalkForSectionAction`**: SettingRowNode + SettingListNode passthrough arms mirroring the TS twin exactly.
- Both TS + .NET builds green.

### Tests (Task 4) — commit `3636189`

- **vitest (`viewmodel-shell/test/setting-row.test.ts`, 25 tests)**: comprehensive coverage —
  - Container semantic HTML: `<ul class="vms-setting-list">` via `tagName` assertion.
  - Heading-sibling posture: `<h3>` emitted BEFORE the `<ul>` (not inside — assertion checks `ul.contains(h3) === false` AND `compareDocumentPosition` following-order). Absent-heading omits the `<h3>` entirely.
  - Row semantic HTML: `<li class="vms-setting-row">` via `tagName`. `--clickable` modifier present when action set, absent otherwise.
  - Label string-lift trained typography: wraps in `.vms-text.vms-text--body.vms-text--weight-medium` — **mutation-guarded** (the weight assertion looks for `.vms-text--weight-medium`; a swap of `weight: "medium"` → `weight: "bold"` in browser.ts breaks this assertion; verified by applying the mutation and observing the test fail).
  - Label ViewNode escape hatch: passes through preserving caller style.
  - Description string-lift trained typography: wraps in `.vms-text--muted` inside a `<p class="vms-setting-row__description">` — the `<p>` tag choice is mutation-testable (swap to `<div>` breaks the tagName assertion).
  - Description absent: no description element rendered.
  - Icon slot: renders SVG inside body when present, no SVG when absent.
  - Trailing slot: renders inside `.vms-setting-row__control`; absent when omitted.
  - **🚨 Natural pairing (CONTEXT §9)**: `CheckboxNode(variant:"switch")` in trailing slot renders with all 4 shipped COMP-03 DOM classes (`.vms-checkbox` on label + `.vms-field--switch` modifier + `.vms-checkbox__input` on input + `role="switch"`) AND the switch reads its `bind` correctly at render time.
  - **🚨 stopPropagation-from-switch mitigation (T-25-04-02)**: clicking the trailing switch input dispatches ONLY the switch's own action (`toggle-email`), NOT the whole-row action (`open-email-settings`). This is the direct proof of the mitigation for threat T-25-04-02.
  - **🚨 Belt-and-braces `.vms-field--switch` selector-list presence**: asserts that the shipped stopPropagation selector list in settingRow (`.vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, .vms-field--switch, a[href]`) matches the switch's `<label>.vms-field--switch` element. If a future contributor removes `.vms-field--switch` from the list, this assertion fails.
  - Whole-row action: `role="button"` + `tabindex=0` + click dispatch + Enter dispatch + Space dispatch WITH preventDefault + Tab does NOT dispatch.
  - Tree-validator: rejects a TextNode-as-child with byte-identical error message `"SettingListNode.children must all be SettingRowNodes (found: text)"`; positive control with two well-formed entries (using natural-pairing switches) passes.
  - Header explicitly states AA reuses Phase 23 checkbox-switch + Phase 24 primary composite text pairs; no new pair-checks required.
- **.NET (`SettingRowNodeSerializationTests.cs`, 13 [Fact])**: discriminator emission (`"type":"setting-row"`); BareNode minimal shape (Label present; Icon + Description + Trailing + Action all absent; NO `null` anywhere — class-2 findNulls defect protection per gotcha #8); Label required + polymorphic emission with nested `"type":"text"` discriminator; Icon absent/set kebab; Description absent/set polymorphic; Trailing absent + **Trailing CheckboxNode(switch) natural-pairing proof** (nested `"type":"checkbox"` + `"variant":"switch"` + `bind` + `name`) + Trailing Button alternative; Action absent + Action ActionDescriptor round-trip; AllFieldsSet full-fat coverage matching the Plan 25-07 Showcase configuration.
- **.NET (`SettingListNodeSerializationTests.cs`, 7 [Fact])**: discriminator emission (`"type":"setting-list"`); Children empty-array byte-exact minimal wire shape (`{"type":"setting-list","children":[]}` — the class-2 defect protection); Children polymorphic with 2 setting-row discriminators (proves the IReadOnlyList<ViewNode> posture preserves the discriminator); Heading absent + Heading present round-trip; TreeInvariant with byte-identical error message `"SettingListNode.children must all be SettingRowNodes (found: text)"`; TreeInvariant positive control using the natural-pairing subtree (two SettingRowNodes each with CheckboxNode(switch) in Trailing) — proves the walker descends through the pairing without spurious rejection.
- **Mutation-verified** (revert-and-run):
  - Swap `weight: "medium"` → `weight: "bold"` on label string-lift → vitest label-typography test FAILS. Reverted.
- Full framework vitest suite green: **77 files / 1222 tests passing**.
- Full .NET framework test suite green: **405 tests passing**.

## Natural-Pairing Evidence

The whole recipe exists so an app hands the framework `{ label, description, trailing: switch }` and gets the shipped settings-row layout for free. Evidence:

1. **Wire shape** (`viewmodel-shell/src/index.ts`): `SettingRowNode.trailing?: ViewNode` slot with TSDoc documenting the natural pairing (`typically CheckboxNode(variant:"switch") from COMP-03`).
2. **.NET record** (`viewmodel-shell-dotnet/ViewModels.cs`): `Trailing? = null` with XML doc documenting the natural pairing.
3. **vitest test** (`test/setting-row.test.ts` L~310): `CheckboxNode(variant:"switch") renders correctly inside trailing slot` — asserts the shipped COMP-03 DOM (label.vms-checkbox.vms-field--switch + input.vms-checkbox__input + role=switch) renders inside `.vms-setting-row__control`.
4. **.NET test** (`SettingRowNodeSerializationTests.cs` L~140): `Trailing_CheckboxSwitch_SerializesAsNaturalPairing` — asserts polymorphic emission of the CheckboxNode with all key fields.
5. **.NET tree-invariant positive control** (`SettingListNodeSerializationTests.cs`): builds a full SettingListNode with 2 rows each containing a switch in trailing — proves the tree walker descends through the pairing without spurious rejection.

## stopPropagation-from-Switch Mutation-Test Evidence

The extended stopPropagation selector list (`.vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, .vms-field--switch, a[href]`) is the mitigation for threat T-25-04-02. Two layers of evidence:

1. **Behavioral test** (`test/setting-row.test.ts` L~365): renders a SettingRow with `action: { name: "open-email-settings" }` AND a trailing switch with `action: { name: "toggle-email" }`. Clicks the switch input. Asserts `dispatched` contains ONLY `"toggle-email"` (the switch's own action), NOT `"open-email-settings"` (the row's action). If the stopPropagation selector list is stripped, the click bubbles to the row and BOTH names appear in the spy list.
2. **Selector-presence test** (`test/setting-row.test.ts` L~410): asserts that the shipped selector list (byte-identical to the string in browser.ts settingRow()) matches the `<label>.vms-field--switch` element. Belt-and-braces — if a future contributor removes `.vms-field--switch` from the list, this assertion fails even if the behavioral test happens to pass (because either `.vms-checkbox` or `.vms-checkbox__input` alone might catch the specific click event tested).

## Byte-Identical Tree-Invariant Error Message Verification

Both backends throw the identical error text `"SettingListNode.children must all be SettingRowNodes (found: <type>)"`:

- **TS** (`server.ts` collectActions "setting-list" arm): `throw new Error(\`SettingListNode.children must all be SettingRowNodes (found: ${c.type})\`)`.
- **.NET** (`ViewModels.cs` Collect SettingListNode arm): `throw new InvalidOperationException($"SettingListNode.children must all be SettingRowNodes (found: {childType})")` where `childType = ViewNodeWireName(child)`.

Both verified by unit tests:
- vitest: `expect(() => validateActionNames(bad)).toThrow("SettingListNode.children must all be SettingRowNodes (found: text)")`.
- .NET: `Assert.Equal("SettingListNode.children must all be SettingRowNodes (found: text)", ex.Message)`.

Cross-backend parity gate (Plan 25-08) will diff these on the wire; any drift fails the run.

## AA-Contrast Hand-Check Reuse

**NO NEW pair-checks required.** SettingRowNode introduces zero new fg/bg pairs — every color/text pairing is inherited from prior phases:

- **Label** — body-tier text on surface. Covered by Phase 24 ListRowNode.primary + MessageNode.body + AlertNode.title text pairs (verified in `alert.test.ts` + `message.test.ts` + `list-row.test.ts` headers). No regression possible unless the body-tier `--vms-text` token moves (which would trigger the full multi-composite body-tier suite).
- **Description** — muted text on surface. Covered by Phase 23 COMP-01 caption-tier verification via `--vms-text-muted × --vms-surface` (verified in `text-caption.test.ts:23-52` hand-check + `detail-row.test.ts:65-85` hand-check). Same palette; no regression possible unless `--vms-text-muted` moves.
- **Trailing switch** — thumb vs track OFF/ON states across 13 themes. Covered by Phase 23 COMP-03 verification in `checkbox-switch.test.ts:23-45` hand-check header (13 themes × 2 states = 26 pair-checks, all documented with WCAG 1.4.11 non-color-carrier justification).

Documented in the test-file header per banked pattern. Verify no regression at Plan 25-10 Ashley checkpoint (live-theme walk across default + 12 themes).

## Deviations from Plan

None — plan executed exactly as written. Every task and acceptance criterion honored. All 4 tasks completed in order with per-task commits.

Two small additions beyond the plan's minimum:
1. **Added a 25th vitest test**: belt-and-braces `.vms-field--switch` selector-presence assertion, so the plan's explicit requirement that `.vms-field--switch` appears in the settingRow stopPropagation selector list is enforced by a dedicated test (not only by the behavioral stopPropagation-from-switch test, which could pass via `.vms-checkbox__input` alone on the specific input-click event). This closes an observed mutation-test gap where removing `.vms-field--switch` from the selector list still passed the behavioral test.
2. **Added mutation-test verification in the commit narrative**: applied the weight `medium → bold` mutation, observed the test fail, reverted. Documented in the commit body for Task 4.

## Threat Model Verification

Threat register (from PLAN.md `<threat_model>`) confirmed:

- T-25-04-01 (no trust boundary): SettingRowNode + SettingListNode are passive rendering nodes with an optional whole-row `action` slot following the shipped ListRowNode.action pattern. Trailing slot dispatches through the standard this.node() walker at same trust level. Accept: no mitigation needed.
- T-25-04-02 (Tampering: switch double-fires row action): **Mitigate applied** — the extended stopPropagation selector list in browser.ts settingRow() includes `.vms-field--switch`. Two vitest tests prove the mitigation (behavioral stopPropagation-from-switch test + belt-and-braces selector-presence test). If a future contributor removes `.vms-field--switch` from the list, the selector-presence test fails.
- T-25-04-03 (recursion DoS): Same recursion depth ceiling as every other typed-slot composite; existing tree walker guards depth. Accept.
- T-25-04-04 (Elevation: smuggled non-SettingRow child): **Mitigate applied** — tree-validator in both `server.ts collectActions` and `ViewModels.cs Collect` throws `invalid_tree` with byte-identical error message. Mutation-tested in both vitest + .NET test suites.

## Self-Check: PASSED

- viewmodel-shell/src/index.ts: SettingRowNode + SettingListNode interfaces present + ViewNode union entries (`grep -c 'export interface Setting'` = 2) ✓
- viewmodel-shell-dotnet/ViewModels.cs: SettingRowNode + SettingListNode records + JsonDerivedType × 2 present (`grep -c 'public record Setting'` = 2 + `grep -c 'JsonDerivedType(typeof(Setting'` = 2) ✓
- viewmodel-shell/styles/default.css: 11 `.vms-setting-*` class rules + `max-width: 42rem` present ✓
- viewmodel-shell/src/browser.ts: `case "setting-row"` + `case "setting-list"` switch arms + `private settingRow()` + `private settingList()` renderers present + `.vms-field--switch` in stopPropagation selector list ✓
- viewmodel-shell/src/server.ts: `case "setting-row"` + `case "setting-list"` walker arms in both `collectActions` + `walkForSectionAction`; tree-invariant error text byte-identical to .NET ✓
- viewmodel-shell/test/setting-row.test.ts: 25 tests passing (mutation-verified) ✓
- viewmodel-shell-dotnet/Tests/SettingRowNodeSerializationTests.cs: 13 [Fact] passing ✓
- viewmodel-shell-dotnet/Tests/SettingListNodeSerializationTests.cs: 7 [Fact] passing ✓
- Full framework vitest suite: 77 files / 1222 tests passing ✓
- Full .NET framework test suite: 405 tests passing ✓
- Core-globals guard: green ✓
- Commits present in git log: 9fd6745, b69812f, 01238a5, 3636189 ✓

## Handoff to Downstream Plans

- **25-05 (ChipNode + ChipListNode)**: reuses established patterns — typed slots + tree-invariant + tone axis + byte-identical error messages + extended stopPropagation selector list (chip needs `.vms-chip__dismiss` when both `action` + `dismissAction` are set). Different pattern posture for dismiss (ActionEvent slot vs AlertNode's fixed local name).
- **25-07 (Showcase)**: MUST render a SettingListNode in the Secondary Composites section with the natural pairing exercised explicitly — at least 3-4 setting rows with `CheckboxNode(variant:"switch")` in trailing, and at least one row with a `ButtonNode` trailing to prove the trailing slot's generality. Add a heading to exercise the sibling-posture. Visual verification of the settings-row layout happens here.
- **25-08 (Parity extension)**: append SettingRow + SettingList tripwires to `parity/fixtures/feature-probe.json` `$comment` — recommended `expectBodyContains`: `"type":"setting-row"`, `"type":"setting-list"`. Both fired from all 3 backends (bun/node/dotnet). Also consider a `"variant":"switch"` tripwire on the nested trailing switch — proves the natural pairing survives the wire.
- **25-09 (CHANGELOG)**: add "SettingRowNode + SettingListNode — the settings-page primitive. Natural pairing with CheckboxNode(variant:'switch') from COMP-03 documented + tested. Whole-row action stopPropagation extended for the switch pairing (T-25-04-02 mitigation)." to the Unreleased/v8.0.0 Added section.
- **25-10 (Final gate)**: Ashley checkpoint should verify (a) the SettingList renders as a single bordered surface with per-row dividers + optional heading as a sibling above; (b) the natural pairing with CheckboxNode(switch) visually looks correct (switch vertically centered against the label+description stack); (c) clicking the switch does NOT trigger the whole-row action (behavioral verification of T-25-04-02 in live browser).

## Notes for Future Maintainers

- **The natural pairing (SettingRowNode.trailing = CheckboxNode(variant:"switch")) is the recipe's raison d'être.** If a downstream app or agent asks "how do I build a settings page with toggle switches?", the answer is `SettingRowNode` with a switch in `trailing` — not `ListRowNode` with a trailing CheckboxNode (which lacks the label + description + max-width readable-line-length + `[body | control]` grid), and not `FormNode` with per-field switches (which serialize the form on submit; settings pages typically dispatch per-toggle).
- **The extended stopPropagation selector list is load-bearing under future refactors.** The `.vms-field--switch` addition to the selector list beyond the ListRowNode baseline is BELT-AND-BRACES — a click on the switch's `<input>` element alone is caught by `.vms-checkbox__input`, but a click on the switch's `<label>` wrapper body (near the track but not on the input pixel) is caught by `.vms-checkbox` OR `.vms-field--switch`. If a future refactor drops `.vms-checkbox` from the CheckboxNode DOM (unlikely but possible), `.vms-field--switch` catches it; if a future refactor drops `.vms-field--switch` (e.g. flattens the switch modifier into `.vms-checkbox--switch` instead), `.vms-checkbox` catches it. The redundancy is the load-bearing property.
- **Heading-as-sibling is a11y-critical.** A non-list-item child inside a `<ul>` trips accessibility validators. The heading MUST live outside the `<ul>` — a sibling `<h3>` immediately before. The vitest heading-sibling posture test is mutation-guarded (moving the heading INSIDE the `<ul>` fails `compareDocumentPosition` + `ul.contains(h3) === false` assertions).
- **The description's `<p>` tag choice is load-bearing.** A `<div>` swap would preserve the visual rendering (the `.vms-setting-row__description` class does all the styling), but screen readers announce `<p>` prose differently from a generic `<div>` container. The tagName assertion in vitest catches the mutation.
- **No new AA-contrast pairs.** SettingRowNode inherits from Phase 23 (checkbox-switch + caption tier) + Phase 24 (primary composite text pairs). If any of those shift, this composite's hand-check inherits the regression — the multi-composite pair suite is the blast radius, not this file alone.
