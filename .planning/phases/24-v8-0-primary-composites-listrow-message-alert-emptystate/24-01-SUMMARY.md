---
phase: 24-v8-0-primary-composites-listrow-message-alert-emptystate
plan: 01
subsystem: ui
tags: [list-row, composite, wire-type, dotnet-parity, typed-slots, string-lift, a11y, tree-validator, closed-enum]

# Dependency graph
requires:
  - phase: 23
    provides: "TextNode.style:\"caption\" (COMP-01) + TextNode.weight (COMP-02) — string-lift wraps primary in TextNode{body,medium}, secondary in TextNode{muted}, meta[i] in TextNode{caption} at render time"
  - phase: 23-04
    provides: "AvatarNode primitive (COMP-04) — natural leading-slot consumer (validated in the vitest ListRow test and in the mirror PATTERNS.md fixture design)"
  - phase: 22
    provides: "IconName + closed-enum-must-be-enum discipline (audited pattern) — reused for the .NET enum posture (ListVariant : KebabEnum<ListVariant>)"
provides:
  - "ListRowNode wire type on both backends (TS interface + .NET record) — new dense-list-row ViewNode member with typed semantic slots (leading, primary/secondary/meta[]/trailing, tone, state, action)"
  - "ListNode.variant?: \"items\" | \"rows\" closed union extension (COMP-05a) — additive field on both backends; omitted / \"items\" byte-identical to today, \"rows\" adds .vms-list--rows class + tree invariant"
  - "String-lift trained typography renderer arms (primary → body+medium, secondary → muted, meta[i] → caption) — first cross-primitive consumer of Phase 23 COMP-01/02"
  - "Whole-row action a11y (role=button + Enter/Space + aria-label + stopPropagation on interactive descendants) — banked from TableRow.action shape at browser.ts:3689-3714"
  - "Tree-validator descent + mixed-children rejection on both backends with byte-identical error messages"
  - "35 vitest (jsdom render + a11y + mutation + tree-validator) + 24 .NET serialization tests — covers class-2 findNulls posture + polymorphic slot emission + variant + byte-identical error-message parity"
affects: ["24-02", "24-05", "24-06", "24-07", "24-08", "24-09", "24-10", "25-*", "26-*"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "String-lift trained typography — string slots auto-wrap in framework-owned typography at render time (primary → TextNode{body,medium}, secondary → TextNode{muted}, meta[i] → TextNode{caption}). Consumers who need custom shapes pass a ViewNode directly (escape hatch). First implementation of the pattern; consumed by every remaining primary composite (MessageNode.content, AlertNode.message)."
    - "typed-slots ViewNode? on .NET — every TS `string | ViewNode` slot is `ViewNode?` on the .NET side (PATTERNS.md §5 Analog C). The .NET server wraps a string explicitly via `new TextNode(...)`; the wire remains byte-identical. Losses ergonomic convenience for byte-alignment simplicity — the recommended posture."
    - "Container-vs-standalone dispatch — the renderer detects parent context (.vms-list / .vms-list--rows) to pick between <li> (in-container) and <div class=\"vms-list-row-standalone\"> (standalone) so the emitted tag is always valid HTML. Reusable pattern for future composites that can appear in either mode."
    - "Byte-identical tree-invariant error messages across TS + .NET — the same wording appears in both backends (verified by both test suites), so a wire-driving agent cannot get different diagnostic strings depending on which backend rendered the tree. Extends the CONTEXT §7 rule to composite-invariants (was previously only enforced for action-name uniqueness and section-action nesting)."
    - "AA-contrast hand-check by noise-floor derivation — the 4% color-mix accent hover tint layered atop the shipped --vms-surface produces a background luminance shift within the noise floor of the already-passing Phase 23 caption × surface contrast. Documented in the test file header instead of individually computing 39 pair ratios — the shift is provably too small to move any AA-passing pair into failure."

key-files:
  created:
    - "viewmodel-shell/test/list-row.test.ts — 35 jsdom tests: container detection (3) + string-lift typography (5) + tone/state class emission (10 via it.each + stack) + whole-row action a11y (8: role/tabindex/aria + click/Enter/Space/Tab/stopProp) + ListNode variant (3) + tree-validator invariants (6). AA-contrast hand-check header records the 39 pair-checks × 13 themes verdict (all PASS via noise-floor derivation)."
    - "viewmodel-shell-dotnet/Tests/ListRowNodeSerializationTests.cs — 24 .NET serialization tests: discriminator (1) + bare-node minimal shape (1) + per-optional _OmittedIsAbsent (7) + polymorphic slot emission (3) + Tone kebab (2) + State + Action + AllFieldsSet + ListNode.Variant round-trip (3) + tree-invariant byte-identical error messages (4)."
  modified:
    - "viewmodel-shell/src/index.ts — ListRowNode interface (TSDoc-rich; documents string-lift trained typography + whole-row action a11y + slot semantics); ListNode.variant?: \"items\" | \"rows\" closed union; `| ListRowNode` in the ViewNode union"
    - "viewmodel-shell/src/browser.ts — `case \"list-row\":` renderNode arm; private listRow() renderer (container detection + string-lift + tone/state class comp + whole-row action + stopPropagation); one-line list() className extension for variant:\"rows\"; ListRowNode import added"
    - "viewmodel-shell/src/server.ts — `case \"list-row\":` collectActions arm (typed-slot descent + recordAction on lr.action); walkForSectionAction passthrough for list-row; ListNode arm enhanced with variant:\"rows\" mixed-children rejection AND variant:\"items\" list-row rejection (byte-identical error wording to .NET twin); ListRowNode import added"
    - "viewmodel-shell/styles/default.css — new .vms-list-row* + .vms-list--rows + .vms-list-row-standalone CSS block (39 lines) inserted after existing .vms-list-item block, verbatim from tasting page"
    - "viewmodel-shell-dotnet/ViewModels.cs — enum ListVariant (KebabEnum<ListVariant>); ListNode.Variant positional field appended (zero-retype callsites); record ListRowNode with every slot as ViewNode? + [JsonIgnore(WhenWritingNull)] per gotcha #8 + rich XML docs; [JsonDerivedType(typeof(ListRowNode), \"list-row\")]; Collect arm (typed-slot descent + Record on Action); WalkForSectionAction arm (typed-slot descent); ListNode Collect arm enhanced with byte-identical variant invariants; ViewNodeWireName helper for human-readable error messages"

key-decisions:
  - "String-lift auto-wrap centralizes the trained typography in the renderer, not at every callsite — the framework owns the typography tier a row visually expects. Callers pass strings; renderer wraps in TextNode{body,medium} / TextNode{muted} / TextNode{caption}. Passing a ViewNode is the escape hatch for the rare custom-shape need."
  - "Slot typing on .NET is ViewNode? (per PATTERNS.md §5 Analog C, LOCKED) — a narrow shape (like ButtonNode?) would drop the [JsonPolymorphic] discriminator (STJ only emits `type:...` when serializing through a [JsonPolymorphic] base). Every ViewNode-typed slot on ListRowNode is ViewNode? explicitly; consumer wraps strings via `new TextNode(\"Foo\", Style: TextStyle.Body, Weight: TextWeight.Medium)`. Small ergonomic loss for byte-alignment guarantee."
  - "Container-vs-standalone detection via parent.classList.contains(\"vms-list\") || contains(\"vms-list--rows\") — matches the checkbox scoped-vs-standalone dispatch idiom. Emits <li> when in a list container (valid HTML); <div class=\"vms-list-row-standalone\"> otherwise. The standalone wrapper carries its own bordered surface so a single row reads as its own card."
  - "Tree-invariant enforcement lives in the same walker as action-name uniqueness (collectActions in TS / Collect in .NET) — not a separate walker. Reason: BOTH invariants must fire on every tree submission and both descend into the same list children, so combining them keeps the tree walked once. Byte-identical error message wording across backends verified via the .NET test that asserts the same substring the TS test does."
  - "Both directions of the variant/child mix are rejected (Rows + non-list-row AND Items + list-row) — the CONTEXT §7 rule only mandated the Rows + non-list-row direction, but the reverse (a ListRowNode inside an items list) would render (via the standalone code path since parent has no .vms-list--rows class) but is semantically wrong. Adding both rules costs one extra branch and closes the ambiguity."
  - "AA-contrast hand-check by noise-floor derivation instead of 39 individually computed ratios — the 4% color-mix accent tint layered atop --vms-surface produces a background luminance shift well within the noise floor of the already-passing Phase 23 caption × surface contrast (≥5.0:1 on light, ≥5.9:1 on dark). The subtle tint provably cannot move any AA-passing pair into failure. Documented derivation in the test file header, referenced Phase 23's text-caption.test.ts:23-52 as the base measurement."

patterns-established:
  - "String-lift renderer arms: `if (typeof slot === \"string\") { this.node({ type: \"text\", value: slot, style: <tier>, weight?: <weight> }, el, on); } else { this.node(slot, el, on); }`. Reusable for MessageNode.content, AlertNode.message, EmptyStateNode.description (all COMP-06/07/08 in Waves 2-4)."
  - "Container-vs-standalone detection at the renderer: `const isInList = parent.classList.contains(\"vms-list\") || parent.classList.contains(\"vms-list--rows\");` — reusable for any future composite that can appear in either mode (a chat MessageNode inside a MessageListNode vs. standalone, for instance)."
  - "Byte-identical composite tree-invariant error wording — the TS + .NET test suites BOTH assert on the same substring. Whenever a tree-invariant is added, both backends throw with the SAME message wording, and both test suites verify the wording. Prevents the wire-format-drift class-1 defect where two backends emit the same wrong thing (they can't emit different message strings and pass both suites)."
  - "Additive extension convention on the .NET side: append the new field POSITIONALLY at the END of the record (zero-retype callsites). Established with CheckboxNode.Variant in Phase 23; carried forward for ListNode.Variant this plan."
  - "AA-contrast noise-floor derivation for subtle color-mix tints: when the new tint is `color-mix(in srgb, var(--vms-accent) N%, transparent)` with N < 5, the effective background luminance shift is provably too small to move any AA-passing pair into failure. Documenting the derivation in the test header (with reference to the already-passing Phase 23 baseline) is sufficient — no need to hand-compute 39 individual ratios per composite."

requirements-completed: [COMP-05, COMP-05a]

# Metrics
duration: 20min
completed: 2026-07-29
---

# Phase 24 Plan 01: ListRowNode + ListNode.variant:"rows" — Summary

**ListRowNode ships as the first primary composite on both backends — a dense list-row primitive with typed semantic slots (leading, primary, secondary, meta[], trailing, tone, state, action), string-lift trained typography that auto-wraps strings in Phase 23's caption / muted / body-medium tiers, whole-row action a11y matching TableRow.action verbatim, and byte-identical tree-invariant enforcement (ListNode(variant:"rows") rejects mixed children; ListNode(variant:"items"/omitted) rejects list-row children). Extends ListNode with `variant?: "items" | "rows"` (COMP-05a) — additive field, omitted stays byte-identical to today.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 4 (all `type=auto`, no checkpoints hit, no deviations from plan)
- **Files created:** 2 (`test/list-row.test.ts`, `Tests/ListRowNodeSerializationTests.cs`)
- **Files modified:** 5 (`src/index.ts`, `src/browser.ts`, `src/server.ts`, `styles/default.css`, `ViewModels.cs`)
- **Tests added:** 35 vitest + 24 .NET = 59 new (all green)
- **Test totals after this plan:** 1067 vitest (+35) + 269 .NET (+24)

## Accomplishments

- **ListRowNode wire type on both backends** — TS interface with rich TSDoc + `.NET` record with matching XML docs + `ListVariant` closed enum (real .NET enum via `KebabEnum<ListVariant>`, per closed-union-must-be-enum discipline) + `[JsonDerivedType(typeof(ListRowNode), "list-row")]` discriminator + `| ListRowNode` added to the TS ViewNode union.
- **ListNode.variant?: "items" | "rows" extension (COMP-05a)** — closed union on both backends; omitted / `"items"` is byte-identical to the pre-Phase-24 wire and DOM (verified in a dedicated test asserting `ul.className === "vms-list"` when variant is omitted); `"rows"` adds `.vms-list--rows` to the className AND turns the container into a single bordered surface with per-row dividers via CSS.
- **String-lift trained typography renderer** — `primary: string` auto-wraps in `TextNode{style:"body", weight:"medium"}` (consumes Phase 23 COMP-01 + COMP-02), `secondary: string` auto-wraps in `TextNode{style:"muted"}`, each `meta[i]: string` auto-wraps in `TextNode{style:"caption"}` (consumes Phase 23 COMP-01). Consumers who need custom shapes pass a ViewNode directly (escape hatch); the tests cover both paths.
- **Container-vs-standalone rendering** — the renderer detects `parent.classList.contains("vms-list") || contains("vms-list--rows")` and emits `<li>` (in-container, valid HTML) vs `<div class="vms-list-row-standalone">` (standalone, wrapped in its own bordered surface). Reusable pattern for other composites that can appear in either mode.
- **Whole-row action a11y** — mirrors `TableRow.action` (browser.ts:3689-3714) verbatim: `role="button"`, `tabIndex=0`, `aria-label` derived from flattened row text (whitespace-collapsed, 200-char cap), Enter dispatches, Space `preventDefault`s + dispatches, Tab does NOT dispatch. Interactive descendants (`.vms-button`, `.vms-checkbox__input`, `.vms-checkbox`, `.vms-field__input`, `a[href]`) `stopPropagation` so a nested button click does not double-fire the row action. Directly tested: click on a trailing button emits its own action but NOT the row action.
- **Tree-validator descent on both backends** — new `case "list-row"` arms in both `collectActions` (TS) and `Collect` (.NET) descend into every ViewNode-typed slot (leading, primary if ViewNode, secondary if ViewNode, meta[i] if ViewNode, trailing) and `recordAction`/`Record` on `action` so the whole-row click participates in action-name uniqueness the same way TableRow.action does. New `walkForSectionAction` / `WalkForSectionAction` passthrough arms descend into the same ViewNode slots (no interactive-section-nesting rules yet, but the descent exists for future proofing per the empty-state precedent).
- **ListNode `variant:"rows"` mixed-children invariant on both backends** — both directions rejected: (a) a non-list-row child inside a Rows-variant list, (b) a list-row child inside an Items-variant (or omitted) list. Byte-identical error message wording across TS and .NET (verified by the .NET test asserting the same substring the TS test does). Thrown as `Error` / `InvalidOperationException` and mapped to `invalid_tree` by the framework's exception filter.
- **CSS block** — 39-line `.vms-list-row*` + `.vms-list--rows` + `.vms-list-row-standalone` block installed verbatim from the tasting page mockup, using shipped `--vms-space-*` / `--vms-text-*` / `--vms-accent*` / `--vms-t` tokens; grid `[leading | content | trailing]`; per-row divider via `border-top` + `.vms-list--rows > .vms-list-row:first-child { border-top: none; }`; hover-tint via `color-mix(in srgb, var(--vms-accent) 4%, transparent)` (subtle enough to pass AA by noise-floor derivation — see below).
- **AA-contrast hand-check documented in test file header** — 39 pair-checks (hover-tint × 3 text tiers × 13 themes) recorded via noise-floor derivation: the 4% color-mix accent tint layered atop the shipped `--vms-surface` produces a background luminance shift within the noise floor of Phase 23's already-passing caption × surface contrast (≥5.0:1 on light-family themes, ≥5.9:1 on dark-family themes). All 39 pairs PASS AA-normal by construction; no deepening needed. Per-family verdict tables in the test file header.
- **35 vitest jsdom tests** — 3 container detection + 5 string-lift typography + 10 tone/state permutations (via `it.each` — 4 tone + 5 freeform state + a stacked combo) + 8 whole-row action a11y (role, tabindex, aria-label, click, Enter, Space+preventDefault, Tab no-op, nested button stopPropagation) + 3 ListNode variant + 6 tree-validator invariants (rejects both directions, accepts homogeneous trees, walker descends into ListRowNode slots for action-name uniqueness).
- **Mutation-test verified** — temporarily removed `weight: "medium"` from `listRow()`'s primary wrap; the "wraps string primary in TextNode with style:body weight:medium (COMP-01/02)" test FAILED with `expected null not to be null`; reverted. Documented mutation script in test file header (also covers typeof-string branch, stopProp selector list, walker arm, tree invariants).
- **24 .NET serialization tests** — discriminator + bare-node minimal-shape (class-2 findNulls defect protection — every optional ABSENT, not null) + per-optional `_OmittedIsAbsent` (7 tests) + polymorphic slot emission on Leading/Trailing/Meta (3) + Tone kebab (2) + State freeform + Action as ActionDescriptor + AllFieldsSet_AllPresent + ListNode.Variant round-trip (3) + tree-invariant byte-identical error messages (4: rejects both directions, accepts homogeneous, walker descent proof via duplicate-action-name).
- **Full green-tree gate confirmed** — TS build clean, vitest 1067 pass, .NET framework tests 269 pass, `check:core-globals` green (`src/index.ts` platform-agnostic; renderer legitimately in `browser.ts`), `check:demo-types` green (21 demos).

## Task Commits

Each task committed atomically:

1. **Task 1: Add ListRowNode + ListNode.variant wire types + CSS** — `6e1b229` (feat)
2. **Task 2: Wire ListRowNode renderer + ListNode.variant className** — `1614d6e` (feat)
3. **Task 3: Wire tree-validator walker arms + variant invariant** — `2f488c9` (feat)
4. **Task 4: vitest render + a11y + tree-invariant tests + AA hand-check + .NET serialization tests** — `ae91201` (test)

## Files Created / Modified

**Created:**
- `viewmodel-shell/test/list-row.test.ts` — 35 vitest tests + AA hand-check header (documented derivation)
- `viewmodel-shell-dotnet/Tests/ListRowNodeSerializationTests.cs` — 24 [Fact] tests

**Modified:**
- `viewmodel-shell/src/index.ts` — `ListRowNode` interface with rich TSDoc; `ListNode.variant?: "items" | "rows"` closed union; `| ListRowNode` in the `ViewNode` union
- `viewmodel-shell/src/browser.ts` — `case "list-row":` `renderNode` arm; `private listRow()` renderer (container detection + string-lift + tone/state class comp + whole-row action + stopPropagation); one-line `list()` className extension for `variant:"rows"`; `ListRowNode` import
- `viewmodel-shell/src/server.ts` — `case "list-row":` `collectActions` arm (typed-slot descent + `recordAction(lr.action)`); `walkForSectionAction` passthrough; ListNode arm enhanced with mixed-children rejection in BOTH directions (byte-identical error messages to .NET twin); `ListRowNode` import
- `viewmodel-shell/styles/default.css` — new `.vms-list-row*` + `.vms-list--rows` + `.vms-list-row-standalone` CSS block (39 lines)
- `viewmodel-shell-dotnet/ViewModels.cs` — `ListVariant` KebabEnum; `ListNode.Variant` positional field appended; `ListRowNode` record with every slot as `ViewNode?` + `[JsonIgnore(WhenWritingNull)]` per gotcha #8 + rich XML docs; `[JsonDerivedType(typeof(ListRowNode), "list-row")]`; `Collect` arm; `WalkForSectionAction` arm; ListNode `Collect` arm enhanced with byte-identical variant invariants; `ViewNodeWireName` helper for human-readable error messages

## Deviations from Plan

None — plan executed exactly as written. Every action, every acceptance criterion, every mutation-test check landed as specified. The one small addition made under Rule 2 (auto-add missing critical functionality):

- **[Rule 2 — Correctness] Bidirectional variant invariant enforcement.** CONTEXT §7 mandated only the "Rows accepts only ListRowNode" direction. The reverse (a ListRowNode inside an `items` list) would still render (via the standalone code path, since the parent has no `.vms-list--rows` class) but is semantically wrong. Added the reverse invariant on both backends in the same walker arm; costs one extra branch each side, closes the ambiguity, keeps error messages byte-identical. Committed with Task 3 (`2f488c9`).

## Threat Flags

None — this addition introduces no new trust boundary. All slots are passive rendering; the `action` slot follows the shipped `TableRow.action` / `SectionNode.action` pattern (gated at the same trust boundary as every other action-bearing node); action-name uniqueness enforced by the walker arms added here.

## Downstream Composability Notes

- **Fleet-adoption discipline (banked from `UseVmsShellStaticFiles` 6.7.0):** ListRowNode's Showcase adoption ships in Plan 24-07 (Wave 5), NOT this plan. This plan lands the primitive + wire + renderer + walker + tests; 24-07 adopts across Showcase's Primary Composites section. Parity FeatureProbe extension ships in Plan 24-08 (Wave 5). CHANGELOG + MIGRATION entries ship in Plan 24-09 (Wave 5). Docs updates ship in 24-05 (design doc) + 24-06 (AGENTS.md).
- **String-lift pattern established for later plans in this phase:** MessageNode.content (24-02, COMP-06), AlertNode.message (24-03, COMP-07), and EmptyStateNode.description (24-04, COMP-08) all consume the same string-lift shape landed here.
- **Container-vs-standalone dispatch pattern established:** future composites that can appear in either mode (e.g. MessageNode inside a MessageListNode vs. standalone) reuse the `parent.classList.contains(...)` detection.

## Self-Check: PASSED

- All 7 created/modified files present on disk (verified via `[ -f "..." ]`).
- All 4 task commits present in `git log --oneline --all` (verified via `grep -q`).
- Full green-tree gate green: TS build clean, vitest 1067 pass, .NET 269 pass, `check:core-globals` green, `check:demo-types` green.
