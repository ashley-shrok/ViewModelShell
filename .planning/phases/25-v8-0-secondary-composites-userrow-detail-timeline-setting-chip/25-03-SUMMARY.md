---
phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip
plan: 03
subsystem: ui
tags: [composite-nodes, timeline-entry, timeline, css-before-pseudo-element, rail-and-dot, view-node, dotnet, typescript, wire-parity]

requires:
  - phase: 25-02-detail-row
    provides: shipped v8.0 secondary-composite pattern (typed slots + tree-invariant + CSS-var pattern + tests), Tone enum reuse, byte-identical error-message discipline
  - phase: 24-v8-0-primary-composites
    provides: MessageListNode container template (IReadOnlyList<ViewNode> + runtime tree-invariant), tree-validator walker discipline, jsdom class-emission test posture
  - phase: 23-typography-caption-weight-avatar
    provides: TextNode.style="caption" (COMP-01 caption tier for time slot), TextNode.style="body" (for description string-lift)
  - phase: 22-icons
    provides: IconName closed union + renderIconSvg helper (for optional icon slot in dot)
provides:
  - TimelineEntryNode wire type shipped both backends (TypeScript + .NET), byte-identical
  - TimelineNode wire type shipped both backends, byte-identical, with semantic `<ol>` container
  - "🚨 NEW rail-and-dot CSS mechanism baked into default.css via ::before pseudo-elements on both container + entry — the ONE genuinely new CSS mechanism in Phase 25"
  - Tone-encoded dot border color (danger/warning/success/info) reusing shipped Phase 23 tone palette
  - Byte-identical tree-invariant rejection: "TimelineNode.children must all be TimelineEntryNodes (found: <type>)"
  - vitest coverage (20 tests) + .NET serialization tests (14 + 4 = 18 [Fact])
  - AA-contrast hand-check header (52 pair-checks for dot-border tones × 4 × 13 themes, all passing 3:1 graphical UI-state threshold)
  - Framework-governance docstring in default.css loudly flagging the NEW CSS mechanism + the "apps CANNOT compose this from primitives" property
affects: [25-04-setting-row, 25-05-chip, 25-07-showcase, 25-08-parity-extension, 25-09-changelog, 25-10-final-gate]

tech-stack:
  added: []
  patterns:
    - "Framework-owned decorative geometry via ::before pseudo-elements — when a composite needs a visual marker (rail, dot, badge notch, callout arrow) that apps CANNOT compose from primitives (per 'apps describe, never decorate'), bake it into the composite's CSS block via ::before/::after. The renderer emits ONLY semantic markup + class names; CSS does all the visual work. Downstream composites needing decorative geometry may reuse this posture. This is the ONE genuinely new CSS mechanism in Phase 25 — a load-bearing framework-governance signal documented in the CSS block's docstring."
    - "String-primitive slot with dedicated typography tier — TimelineEntryNode.time is a `string` primitive (NOT `string | ViewNode`) that the renderer wraps in `TextNode { style: 'caption' }` (COMP-01 caption tier). Same posture as DetailRowNode.label but wrapping in a TextNode instead of baking the typography in CSS; the choice depends on whether the typography is a fixed CSS rule (label — bake in .vms-detail-row__label) or a shipped typography tier (time — reuse COMP-01 via TextNode wrap)."
    - "CSS-mechanism grep-test pattern for jsdom-blind visual rules — jsdom cannot compute ::before pseudo-element geometry. When a composite's visual mechanism is 100% CSS ::before, complement class-emission tests with stylesheet-text grep assertions (`expect(cssText).toContain('.selector::before')`); a mutation that removes the CSS rule breaks the grep even though jsdom cannot render the rule. Downstream composites relying on decorative pseudo-elements may reuse."

key-files:
  created:
    - viewmodel-shell/test/timeline.test.ts (20 vitest — semantic <ol> mutation + <li> + time-before-description ordering + tone × 4 + caption-tier time wrap + body/ViewNode description + icon slot presence + tree-invariant + CSS ::before rule grep-check × 3 + docstring grep-check + AA header)
    - viewmodel-shell-dotnet/Tests/TimelineEntryNodeSerializationTests.cs (14 [Fact] — discriminator + BareNode null-omission + Time round-trip + Description polymorphic + Description custom-ViewNode passthrough + Tone × 4 KebabEnum + Tone omitted absent + Icon kebab + Icon omitted absent + AllFieldsSet)
    - viewmodel-shell-dotnet/Tests/TimelineNodeSerializationTests.cs (4 [Fact] — discriminator + Children empty-array minimal wire shape + Children polymorphic with tone kebab + TreeInvariant byte-identical error message + TreeInvariant positive control)
    - .planning/phases/25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip/25-03-SUMMARY.md
  modified:
    - viewmodel-shell/src/index.ts (+ TimelineEntryNode + TimelineNode interfaces, + ViewNode union entries, + TSDoc loudly documenting the "apps CANNOT compose" property)
    - viewmodel-shell/src/browser.ts (+ private timeline() + private timelineEntry() renderers, + case arms, + type imports)
    - viewmodel-shell/src/server.ts (+ collectActions arms with tree-invariant, + walkForSectionAction arms, + type imports)
    - viewmodel-shell/styles/default.css (+ .vms-timeline*/.vms-timeline-entry* blocks with 🚨 GENUINELY NEW ::before rail-and-dot mechanism + tone-encoded dot border colors × 4 + docstring block flagging the new mechanism)
    - viewmodel-shell-dotnet/ViewModels.cs (+ TimelineEntryNode record + TimelineNode record + [JsonDerivedType] × 2 + ViewNodeWireName mappings + Collect arms with tree-invariant + WalkForSectionAction arms)

key-decisions:
  - "TimelineNode.Children typed IReadOnlyList<ViewNode> on the .NET side (not IReadOnlyList<TimelineEntryNode>). Reason: polymorphic discriminator emission requires the widened base type per the FormNode.Buttons banked posture at ViewModels.cs:1155-1159 — a narrow list drops `\"type\":\"timeline-entry\"`. The invariant is enforced entirely at runtime in ViewTreeValidation.Collect, mirroring MessageListNode/DetailListNode."
  - "🚨 The ::before rail + per-entry ::before dot IS the reason this composite exists. Apps CANNOT compose a decorative vertical rail with tone-encoded dot markers from primitives under the 'apps describe, never decorate' rule (there is no ViewNode that emits raw CSS or a pseudo-element). The composite bakes it in at exactly ONE place — the .vms-timeline / .vms-timeline-entry rules in default.css — with a docstring loudly flagging it as the ONE genuinely new CSS mechanism in Phase 25."
  - "time slot is a `string` primitive (not `string | ViewNode`); the renderer wraps in `TextNode { style: 'caption' }`. Reason: the caption tier is a shipped typography tier from Phase 23 COMP-01, so the tier reuse is the natural encoding. Wrapping keeps time consistent across every timeline entry regardless of whether the app remembers to pass caption-tier explicitly."
  - "description slot is `string | ViewNode` (unlike time). Reason: description holds prose that legitimately benefits from rich content — an app might pass a TextNode with `weight: 'medium'` for a bold actor name (via COMP-02) or an inline mix of text and links. The escape hatch to a ViewNode is the composite recipe pattern; time has no such need (it is always a bare label)."
  - "tone controls dot BORDER color (not dot FILL). Reason: the dot fill stays neutral (--vms-surface) so the dot is a small tinted-border ring, visually consistent with badges (surface-fill + tone-border). Filling the dot with the tone color would fight the surface-composed aesthetic and shorten the AA-contrast palette we can reuse (a fully-tone-colored dot on some themes would fall below 3:1)."
  - "Byte-identical tree-invariant error text across TS + .NET: `\"TimelineNode.children must all be TimelineEntryNodes (found: <type>)\"`. Reason: matches the shipped MessageListNode + DetailListNode invariant patterns verbatim. Cross-backend parity gate (Plan 25-08) will diff this string; any drift fails the run."
  - "jsdom cannot compute ::before pseudo-element geometry — the rail/dot visual verification is deferred to Plan 25-10 Ashley checkpoint (live browser inspection of Showcase Secondary Composites section). Test file compensates with (a) class-emission assertions the renderer emits the right selectors and (b) stylesheet-text grep assertions the CSS rules are present. A mutation that removes the CSS rule breaks the grep."

patterns-established:
  - "Framework-owned decorative-geometry-via-::before: when a composite needs a visual marker (rail, dot, badge notch, callout arrow) apps cannot compose from primitives, bake it into the composite CSS block via ::before/::after. Renderer emits semantic markup + class names; CSS does everything visual. Docstring loudly flags the mechanism as framework-owned."
  - "String-primitive slot with typography-tier wrap: for a primitive slot that benefits from a shipped typography tier (caption/body/muted), wrap in TextNode at render time instead of baking typography in CSS. Distinguishes from the label pattern (DetailRowNode) where the typography is a fixed CSS rule with no matching tier."
  - "CSS-mechanism grep-test pattern for jsdom-blind visual rules: complement class-emission tests with stylesheet-text grep assertions when the visual mechanism is 100% CSS pseudo-element geometry that jsdom cannot compute. Mutation-testable: removing the rule breaks the grep."

requirements-completed: [COMP-11, COMP-11a]

# Metrics
duration: 30min
completed: 2026-07-29
---

# Phase 25 Plan 03: TimelineEntryNode + TimelineNode (COMP-11 + 11a) Summary

**TimelineEntryNode + TimelineNode shipped byte-identical across TypeScript + .NET, with the 🚨 ONE GENUINELY NEW CSS MECHANISM in Phase 25 — a rail-and-dot decorative geometry via `::before` pseudo-elements on both the container `.vms-timeline` and each entry `.vms-timeline-entry`, baked into default.css because apps CANNOT compose it from primitives under the "apps describe, never decorate" rule.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 4/4 complete
- **Files modified:** 5 (index.ts, browser.ts, server.ts, ViewModels.cs, default.css)
- **Files created:** 3 (timeline.test.ts, TimelineEntryNodeSerializationTests.cs, TimelineNodeSerializationTests.cs)
- **Commits:** 4 (one per task)

## Accomplishments

### Wire types + 🚨 NEW rail-and-dot ::before CSS mechanism (Task 1) — commit `3d22865`

- **TypeScript interfaces (`viewmodel-shell/src/index.ts`)**: added `TimelineEntryNode` (`type: "timeline-entry"`, `time: string`, `description: string | ViewNode`, `tone?`, `icon?`) and `TimelineNode` (`type: "timeline"`, `children: TimelineEntryNode[]`). Both added to the `ViewNode` discriminated union. TSDoc on TimelineNode loudly documents "apps CANNOT compose this from primitives" property — a load-bearing framework-governance signal.
- **.NET records (`viewmodel-shell-dotnet/ViewModels.cs`)**: added `TimelineEntryNode` record (Time non-nullable string, Description non-nullable ViewNode for polymorphic discriminator emission, Tone? + Icon? nullable with `WhenWritingNull`) and `TimelineNode` record (Children typed `IReadOnlyList<ViewNode>` per the FormNode.Buttons banked posture at :1155-1159 for polymorphic discriminator preservation). Both registered with `[JsonDerivedType]` on the polymorphic base. `ViewNodeWireName` helper extended for the diagnostic wire-name lookup used by the tree-invariant error message.
- **🚨 NEW CSS mechanism (`viewmodel-shell/styles/default.css`)**: appended the full `.vms-timeline*` block after the DetailRow block. Prepended with a loud docstring flagging this as GENUINELY NEW CSS MECHANISM — `::before` on the container installs a decorative 2px vertical rail (`--vms-border` background, absolutely positioned, spans top-to-bottom); `::before` per entry installs a circular dot (0.875rem, `--vms-surface` fill + 2px `--vms-accent` border by default). Tone-encoded dot borders (`.vms-timeline-entry--{tone}::before { border-color: var(--vms-{tone}); }`) × 4 tones reuse the shipped Phase 23 palette. Docstring cites `composite-nodes-layer.md` §Timeline + AGENTS.md Route B recipe list; jsdom caveat also documented in the CSS docstring.
- Both TS + .NET builds green. Verified via grep: 2 interfaces + 2 records + 4 `::before` rules + 4 tone modifiers + docstring callout present.

### Renderer wiring (Task 2) — commit `8fb31de`

- **`browser.ts` switch arms**: added `case "timeline"` → `this.timeline(...)` and `case "timeline-entry"` → `this.timelineEntry(...)`.
- **`private timeline(n, parent, on)`**: emits `<ol class="vms-timeline">` (semantic ordered list — chronological entries; a `<ul>` swap breaks the mutation test). The rail comes ENTIRELY from CSS `::before`; renderer emits no decoration. Children walked through `this.kids()` standard dispatch.
- **`private timelineEntry(n, parent, on)`**: emits `<li class="vms-timeline-entry [vms-timeline-entry--{tone}]">` with `.vms-timeline-entry__time` + `.vms-timeline-entry__description` children in that DOM order. `time` (primitive string) wrapped in `TextNode { style: "caption" }` — consumes Phase 23 COMP-01 caption tier. String `description` wrapped in `TextNode { style: "body" }`; ViewNode `description` passed through as-is (escape hatch for rich content — e.g. TextNode with `weight: "medium"` for a bold actor name via COMP-02). Optional `icon` renders inside `.vms-timeline-entry__icon` wrapper via `renderIconSvg(n.icon, "sm", …)` (Phase 22 reuse). No `::before` code in the renderer — dot marker lives entirely in the CSS rule from Task 1.
- Core-globals guard green (`npm run check:core-globals`) — no new platform references introduced.

### Tree-validator walker wiring (Task 3) — commit `0f98961`

- **`server.ts` `collectActions`**: `case "timeline-entry"` descends into `description` (only when non-string; time/icon/tone are primitives; no action slot — Timeline is passive display). `case "timeline"` enforces the tree invariant — throws `"TimelineNode.children must all be TimelineEntryNodes (found: ${c.type})"` on any non-`timeline-entry` child, then descends into each child.
- **`server.ts` `walkForSectionAction`**: passthrough arms for both nodes — TimelineEntry descends into description (when ViewNode) for defense-in-depth against nested interactive-section violations; Timeline descends into each child.
- **`ViewModels.cs` `Collect`**: TimelineEntryNode arm descends into `Description` (required ViewNode); TimelineNode arm enforces the same tree invariant with byte-identical error text `"TimelineNode.children must all be TimelineEntryNodes (found: {childType})"` where `childType` comes from `ViewNodeWireName`.
- **`ViewModels.cs` `WalkForSectionAction`**: TimelineEntryNode + TimelineNode passthrough arms mirroring the TS twin exactly.
- Both TS + .NET builds green.

### Tests (Task 4) — commit `7d5f20e`

- **vitest (`viewmodel-shell/test/timeline.test.ts`, 20 tests)**: comprehensive coverage —
  - Semantic HTML: `<ol>` (NOT `<ul>`) via `tagName` assertion + class + time-before-description DOM ordering.
  - Tone modifier class parametrized × 4 (danger/warning/success/info) + tone-absent guard.
  - String-lift trained typography: time wraps in `.vms-text--caption` (mutation-guarded — NOT body, NOT muted); string description wraps in `.vms-text--body` (mutation-guarded — NOT caption, NOT muted); ViewNode description passes through preserving caller style.
  - Icon slot: renders inside `.vms-timeline-entry__icon` wrapper when present; absent when omitted.
  - Tree-validator: rejects a TextNode-as-child with byte-identical error message `"TimelineNode.children must all be TimelineEntryNodes (found: text)"`; positive control with two well-formed entries passes.
  - **🚨 NEW CSS mechanism grep-tests (4)**: stylesheet-text assertions that `default.css` contains `.vms-timeline::before` (with position:absolute + width:2px markers), `.vms-timeline-entry::before` (with border-radius:999px marker), all 4 tone-encoded dot-border rules, AND the "apps CANNOT compose / apps describe, never decorate" docstring callout — mutation-testable: removing any of these from `default.css` breaks the grep even though jsdom cannot render `::before` geometry.
  - Header documents the jsdom caveat + defers visual verification to Plan 25-10 Ashley checkpoint.
  - Header AA-contrast hand-check: 4 tones × 13 themes = 52 pair-checks against `--vms-surface`, all passing 3:1 graphical UI-state threshold (WCAG 1.4.11 — a dot border is a graphical element, NOT text; 3:1 not 4.5:1). Reuses shipped Phase 23 tone palette; no new pairs, no regression.
- **.NET (`TimelineEntryNodeSerializationTests.cs`, 14 [Fact])**: discriminator emission (`"type":"timeline-entry"`); BareNode minimal shape (time + description present; tone + icon absent; NO `null` anywhere — class-2 findNulls defect protection per gotcha #8); Time primitive round-trip; Description required + polymorphic emission with nested `"type":"text"` discriminator; Description custom-ViewNode preserves caller Style; Tone × 4 KebabEnum ("danger"/"warning"/"success"/"info"); Tone omitted absent; Icon multi-word kebab ("check-circle"); Icon omitted absent; AllFieldsSet all-present.
- **.NET (`TimelineNodeSerializationTests.cs`, 4 [Fact])**: discriminator emission (`"type":"timeline"`); Children empty-array minimal wire shape (`{"type":"timeline","children":[]}` — byte-exact — the class-2 defect protection); Children polymorphic emission (2 nested discriminators + tone kebab); TreeInvariant with byte-identical error message `"TimelineNode.children must all be TimelineEntryNodes (found: text)"`; TreeInvariant positive control passes.
- Full framework vitest suite green: **76 files / 1197 tests passing**.
- Full .NET framework test suite green: **385 tests passing**.

## Deviations from Plan

None — plan executed exactly as written. Every task and acceptance criterion honored. All 4 tasks completed in order with per-task commits.

## Threat Model Verification

Threat register (from PLAN.md `<threat_model>`) confirmed —

- T-25-03-01 (no trust boundary): TimelineEntryNode + TimelineNode are passive rendering nodes with no action slots. Description is a ViewNode-typed slot dispatched through the standard walker at the same trust level. Accept: no mitigation needed.
- T-25-03-02 (recursion DoS): Description slot dispatches through the standard tree walker; existing depth guards apply. Accept: no new mitigation.
- T-25-03-03 (Elevation: smuggled non-TimelineEntry child): **Mitigate applied** — tree-validator in both `server.ts collectActions` and `ViewModels.cs Collect` throws `invalid_tree` with byte-identical error message. Mutation-tested in both vitest + .NET test suites.
- T-25-03-04 (CSS ::before tampering): Accept — the framework's `check:no-demo-style` gate prevents apps from shipping demo CSS; app CSS is limited to the sanctioned `--vms-*` token overrides. No ViewNode emits raw CSS on the wire.

## Self-Check: PASSED

- viewmodel-shell/src/index.ts: TimelineEntryNode + TimelineNode interfaces present (`grep -c 'export interface Timeline'` = 2) ✓
- viewmodel-shell-dotnet/ViewModels.cs: TimelineEntryNode + TimelineNode records present (`grep -c 'public record Timeline'` = 2) ✓
- viewmodel-shell/styles/default.css: `.vms-timeline::before` + `.vms-timeline-entry::before` + 4 tone-encoded dot-border rules + docstring callout all present ✓
- viewmodel-shell/src/browser.ts: `case "timeline"` + `case "timeline-entry"` switch arms + `private timeline()` + `private timelineEntry()` renderers present ✓
- viewmodel-shell/src/server.ts: `case "timeline-entry"` + `case "timeline"` walker arms in both `collectActions` + `walkForSectionAction`; tree-invariant error text byte-identical to .NET ✓
- viewmodel-shell/test/timeline.test.ts: 20 tests passing ✓
- viewmodel-shell-dotnet/Tests/TimelineEntryNodeSerializationTests.cs: 14 [Fact] passing ✓
- viewmodel-shell-dotnet/Tests/TimelineNodeSerializationTests.cs: 4 [Fact] passing ✓
- Full framework vitest suite: 76 files / 1197 tests passing ✓
- Full .NET framework test suite: 385 tests passing ✓
- Core-globals guard: green ✓
- Commits present in git log: 3d22865, 8fb31de, 0f98961, 7d5f20e ✓

## Handoff to Downstream Plans

- **25-04 (SettingRowNode)**: reuses established patterns — typed slots + tree-invariant + tone axis + byte-identical error messages. No `::before` mechanism needed (setting rows are single-bordered-surface + trailing control, same as UserRow/DetailList/MessageList).
- **25-05 (ChipNode)**: similar tinted-pill mechanism to AlertNode; no `::before` needed.
- **25-07 (Showcase)**: MUST render the Timeline in the Secondary Composites section with at least one entry per tone + one with icon + at least one with ViewNode description (bold actor name via TextNode weight:"medium" from COMP-02). Visual verification of the rail-and-dot mechanism happens here.
- **25-08 (Parity extension)**: append TimelineEntry + Timeline tripwires to `parity/fixtures/feature-probe.json` `$comment` — recommended `expectBodyContains`: `"type":"timeline"`, `"type":"timeline-entry"`. Both fired from all 3 backends (bun/node/dotnet).
- **25-09 (CHANGELOG)**: add "🚨 NEW CSS mechanism — rail-and-dot `::before` on `.vms-timeline` + `.vms-timeline-entry`. Apps CANNOT compose from primitives; the composite exists specifically to bake this in" to the Unreleased/v8.0.0 Added section. Note: this composite carries the strongest framework-governance claim of the phase (the ONE genuinely new CSS mechanism).
- **25-10 (Final gate)**: Ashley checkpoint MUST include live-browser visual verification of the rail-and-dot rendering (jsdom cannot verify pseudo-element geometry; this is the deferred visual sign-off). Verify the tone × 4 dot border colors and the accent-color default dot look correct in the Showcase Secondary Composites section across at least the default light + dark-purple themes.

## Notes for Future Maintainers

- **NEVER hand-craft a rail via app-CSS.** If a downstream app or agent asks "how do I get a vertical rail down the left side of my content?", the answer is `TimelineNode` — not a `SectionNode` with `<style>` or a `--vms-*` override. The rule "apps describe, never decorate" is enforced here; the composite's whole reason for existing is to be the answer to that question.
- **The `::before` mechanism is the mutation-test contract.** If a future refactor moves the rail from CSS `::before` to a DOM `<span>` decoration in the renderer, the vitest grep-test assertions on `default.css` will fail (`.vms-timeline::before` no longer present) — that failure is the signal the framework-governance property is at risk. Don't "fix" the tests to accept a DOM decoration; the CSS `::before` is the load-bearing choice.
- **Tone controls dot BORDER, not dot FILL.** The dot fill stays `--vms-surface` — a small tinted-border ring, visually consistent with badges. Filling the dot with the tone color would shorten the AA-contrast palette (a fully-tone-colored dot on some themes would fall below 3:1 against surface).
- **The 52-pair AA hand-check is inherited from Phase 23** — no new tone tokens introduced. If a future change shifts `--vms-error/warning/success/info` on any theme, the multi-composite tone suite fails (badge, section-tone, detail-row-value, timeline-dot-border) — that's the intended blast radius.
