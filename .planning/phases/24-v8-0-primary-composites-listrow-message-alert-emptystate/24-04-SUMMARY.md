---
phase: 24-v8-0-primary-composites-listrow-message-alert-emptystate
plan: 04
subsystem: ui
tags: [viewmodel-shell, composite-nodes, empty-state, breaking-wire-rename, field-rename, byte-alignment-cleanup, tooltip-removal, tinted-circle-icon, whenwritingnull, polymorphic-discriminator, wcag-aa, bounty-resolution]

# Dependency graph
requires:
  - phase: 22
    provides: IconName closed union + renderIconSvg helper (Phase 22 v7.0 icons)
  - phase: 24-03
    provides: AlertNode landed; overlapping files (index.ts / browser.ts / server.ts / default.css / ViewModels.cs) already carry v8.0 composite additions
provides:
  - EmptyStateNode wire type ("empty-state") — RENAMED shape byte-identical TS + .NET
  - Renamed fields: heading→title (required), message→description (optional)
  - NEW icon?: IconName slot (tinted-circle 3rem backdrop, 12% accent tint)
  - .NET Tooltip field REMOVED (byte-alignment cleanup; folded into same wire break)
  - Bounty resolution: `empty-state-on-collections` RESOLVED (standalone composite wins)
affects: [24-07 (Showcase adoption), 24-08 (FeatureProbe parity extension), 24-09 (CHANGELOG + MIGRATION note for the ONLY breaking change in v8.0.0), any consumer using EmptyStateNode with old field names]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BREAKING WIRE RENAME (v8.0.0's ONLY): heading→title, message→description on EmptyStateNode. Field NAMES change; type discriminator `\"empty-state\"` UNCHANGED. Pre-v8 clients dispatched against the same arm but silently render nothing for the renamed slots — the intended breaking-comms signal for the v8.0 comms major (largest capability expansion since 3.0.0). Every other composite in v8.0 is additive."
    - "BYTE-ALIGNMENT CLEANUP FOLDED INTO SAME BREAK: The .NET-only `Tooltip` field on EmptyStateNode (never mirrored to TS) was a Class-1 defect per AGENTS.md (violation both backends could share silently). REMOVED in this plan alongside the rename so the wire break happens ONCE. A future re-add would need to hit both sides."
    - "PARITY-EXPECTED VIA NEGATIVE ASSERTION: Both test suites (vitest + .NET) carry explicit assertions that OLD field names (heading/message) and OLD class names (__heading/__message) are ABSENT from the output. Positive presence of new names + negative absence of old names = mutation-testable rename cascade."

key-files:
  created:
    - viewmodel-shell/test/empty-state.test.ts
    - viewmodel-shell-dotnet/Tests/EmptyStateNodeSerializationTests.cs
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/styles/default.css
    - viewmodel-shell-dotnet/ViewModels.cs
    - viewmodel-shell/test/feedback-primitives.test.ts
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - demo/FeatureProbe-bun/handler.ts

key-decisions:
  - "REQUIRED-ON-BOTH-SIDES: EmptyStateNode.title (renamed from heading) is REQUIRED on TS (`title: string`, no `?`) AND .NET (positional string Title, non-nullable). Enforced at construction, no runtime check needed. Same posture as heading was, but the name changed."
  - "OPTIONAL SIGNAL VIA WhenWritingNull: Description (renamed from Message), Icon (NEW), Action (unchanged) all optional with `[JsonIgnore(WhenWritingNull)]` on the .NET side. Byte-identical to the TS twin's `?:` optional posture."
  - "Tooltip REMOVED from .NET: A future `Tooltip` re-add MUST update BOTH backends together (Class-1 defect prevention). Regression protection ships as TooltipField_RemovedInV8 test."
  - "Icon slot uses renderIconSvg at size 'lg': Matches the tasting mockup (3rem tinted circle backdrop + 1.5rem glyph inside). Size chosen so the icon reads at empty-state scale — the tinted circle plays the visual role Alert's `--{tone}` colored icon plays."
  - "12% accent tint (color-mix): `background: color-mix(in srgb, var(--vms-accent) 12%, transparent)` for the icon backdrop — the same soft-tint pattern shipped by ListRowNode hover (4% accent), MessageNode assistant surface (6% info), AlertNode tinted surfaces (8-10% tone), but at empty-state's higher visual prominence (12%). AA UI-state hand-check verified 4.1..7.9:1 across all 13 themes."
  - "No FeatureProbe parity extension in THIS plan: Plan 24-08 handles adding the new composites (ListRow/Message/Alert) to FeatureProbe. But the EmptyStateNode RENAME broke the existing FeatureProbe demo's compile (`Message:` no longer a valid named parameter), so this plan updated the two FeatureProbe callers as a Rule 3 blocking fix (deviation)."
  - "Bounty `empty-state-on-collections` RESOLVED via standalone-composite (per CONTEXT §6 + tasting-approval decision): consumers who want a richer empty-state in a Table/List either render a standalone EmptyStateNode at the app level when the collection is empty, OR pass it as a child in an existing empty-cell slot. No new collection-property field needed."

patterns-established:
  - "Deliberate breaking wire rename during a MAJOR: When a comms-major (v8.0.0) is already a designed-for-comms release, folding a schema-tightening rename into it (heading→title, message→description) is the right time. Do it in the SAME milestone as byte-alignment cleanup (Tooltip removal). CHANGELOG documents both as a single breaking-change entry; MIGRATION.md gives the exact rewrite. Never introduce a rename mid-minor."
  - "Rename-cascade validation via NEGATIVE assertions: Every test suite ships tests that assert OLD field names + OLD class names are ABSENT from output. Positive-only assertions on new names are insufficient — an incomplete rename can pass positive-only tests if both old and new coexist. The negative assertion is the mutation-proof."

metrics:
  duration_minutes: 15
  completed: 2026-07-29
---

# Phase 24 Plan 04: EmptyStateNode BREAKING RENAME (COMP-08) Summary

Landed **EmptyStateNode with RENAMED wire shape** — v8.0.0's **only breaking wire change**. Field renames `heading→title` and `message→description`; NEW optional `icon?: IconName` slot; `.NET` `Tooltip` field REMOVED (byte-alignment cleanup folded into same break). Byte-identical TS + .NET. Type discriminator `"empty-state"` UNCHANGED — the rename affects field NAMES, not the wire type. Bounty `empty-state-on-collections` RESOLVED by shipping the standalone-composite direction per tasting approval.

## What shipped

### Wire type (byte-identical TS + .NET, RENAMED)

- **TS `EmptyStateNode` interface** at `viewmodel-shell/src/index.ts:1402-1424`:
  ```typescript
  export interface EmptyStateNode {
    type: "empty-state";
    icon?: IconName;         // NEW — tinted-circle backdrop
    title: string;           // RENAMED from heading (required)
    description?: string;    // RENAMED from message (optional)
    action?: ButtonNode;     // UNCHANGED
  }
  ```
- **.NET `EmptyStateNode` record** at `viewmodel-shell-dotnet/ViewModels.cs:1976-1991`:
  ```csharp
  public record EmptyStateNode(
      string Title,                                                                         // RENAMED
      [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,       // NEW
      [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Description = null,  // RENAMED
      [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Action = null     // UNCHANGED
  ) : ViewNode;
  ```
- `Tooltip` field REMOVED (was present in v7.x on .NET side ONLY — never mirrored to TS; Class-1 byte-drift).
- `[JsonDerivedType(typeof(EmptyStateNode), "empty-state")]` registration UNCHANGED — wire discriminator string stable.
- Positional ordering in .NET: `Title` first (required), then `Icon`/`Description`/`Action` (all optional named parameters).

### Renderer + CSS block

- **`private emptyState()` at `viewmodel-shell/src/browser.ts:4290-4331`** — full rewrite:
  - Icon slot (NEW): `<div class="vms-empty-state__icon">` wrapping an `<svg class="vms-icon vms-icon--lg">` via `this.renderIconSvg(n.icon, "lg", undefined, undefined)`. Only rendered when `n.icon` truthy.
  - Title: `<div class="vms-empty-state__title">` — class-name renamed from `__heading`.
  - Description: `<div class="vms-empty-state__description">` — class-name renamed from `__message`; only rendered when `n.description != null && n.description !== ""`.
  - Action: unchanged (`this.button(n.action, el, on)` — rendered via shared button helper).
- **`.vms-empty-state*` CSS block** at `viewmodel-shell/styles/default.css:2152-2192`:
  - REPLACES the shipped v7.x block (previously at :1975-1997 — actually landed at :2152-2176).
  - `.vms-empty-state` — centered flex column, `padding: 2.5rem 1.5rem`, `gap: .75rem`.
  - `.vms-empty-state__icon` — 3rem × 3rem circle (border-radius: 999px), `background: color-mix(in srgb, var(--vms-accent) 12%, transparent)`, `color: var(--vms-accent)`.
  - `.vms-empty-state__icon svg` — 1.5rem × 1.5rem.
  - `.vms-empty-state__title` — text-lg, weight 600, `var(--vms-text)`.
  - `.vms-empty-state__description` — text-sm muted, `max-width: 28rem`, line-height 1.55.
  - `.vms-empty-state .vms-button` — align-self: center, `margin-top: var(--vms-space-sm)`.
- Old class names `.vms-empty-state__heading` + `.vms-empty-state__message` DELETED entirely — no backward-compat aliasing.

### Walker arms (unchanged)

- `server.ts case "empty-state"` at `:391-399` (validateActionNames) — descends into `.action` (unchanged behavior; the walker was never accessing renamed fields).
- `server.ts case "empty-state"` at `:658-665` (walkForSectionAction) — same pattern.
- `.NET Collect` at `ViewModels.cs:2823-2830` — descends into `.Action` (unchanged).
- `.NET WalkForSectionAction` at `ViewModels.cs:2542-2547` — descends into `.Action` (unchanged).
- No comment updates needed — every comment referenced `.action` (the unchanged slot), not the renamed fields.

### Test coverage

**vitest (`viewmodel-shell/test/empty-state.test.ts`)** — 14 tests across 6 describe blocks:
- **DOM shape + renamed fields (4 tests)**: `.vms-empty-state` wrapper; `__title` positive; `__description` present when non-empty; `__description` hidden when omitted; `__description` hidden when empty string.
- **NEW icon slot (2 tests)**: `.vms-empty-state__icon > svg.vms-icon.vms-icon--lg` when present; `.vms-empty-state__icon` entirely absent when omitted.
- **Action slot (2 tests)**: `.vms-button` renders below content, dispatches on click; hidden when omitted.
- **Child order per CONTEXT §6 (2 tests)**: `icon → title → description → action` when all present; `title → description → action` when icon absent.
- **NEGATIVE assertions for OLD class names (2 tests)**: `.vms-empty-state__heading` returns null; `.vms-empty-state__message` returns null — the mutation-test proof that the rename cascaded.
- **Action-name uniqueness walker (2 tests)**: validator descends into `.action`; duplicate action names across two empty-states throw; single valid CTA passes.

**.NET (`viewmodel-shell-dotnet/Tests/EmptyStateNodeSerializationTests.cs`)** — 13 `[Fact]` methods:
- `Type_SerializesAsEmptyState`, `Title_Required_AlwaysPresent`.
- `RenamedFields_UseTitle_NotHeading` — positive + negative assertions.
- `RenamedFields_UseDescription_NotMessage` — positive + negative assertions.
- `MinimalShape_OmittedOptionalsAreAbsent`, `Description_OmittedIsAbsent`, `Icon_OmittedIsAbsent`, `Action_OmittedIsAbsent`.
- `Icon_SerializesAsKebab` (single-word), `Icon_MultiWordName_SerializesAsKebab` (multi-word via IconNameConverter).
- `Action_SetSerializesPolymorphically` — proves ViewNode? typing preserves "type":"button" discriminator.
- `AllFieldsSet_AllPresent` — byte-identity fixture with the TS twin.
- `TooltipField_RemovedInV8` — regression protection for the byte-alignment cleanup.

### AA-contrast hand-check

Documented in the test file header (`viewmodel-shell/test/empty-state.test.ts` header comment):
- 13 pair-checks (default + 12 themes) for the icon-glyph × 12%-accent-tinted-circle backdrop pair.
- Target: **3:1 (WCAG UI-state / non-text graphical)**.
- Verdict: **all 13 themes pass**, computed range 4.1..7.9:1. The accent × 12%-tint-over-surface backdrop is inherently high-contrast because accent colors are deliberately luminance-differentiated from their theme's surface.
- No CSS deepening required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] FeatureProbe demos updated to use RENAMED fields**
- **Found during:** Task 3 (framework-consumer hunt)
- **Issue:** The plan's Task 3 explicitly said "FeatureProbe demo backends and their tests are NOT in scope for this task. Plan 24-08 handles the parity FeatureProbe extension." BUT the wire rename broke the FeatureProbe demo's compile: `new EmptyStateNode(Message: ...)` no longer had a valid `Message` parameter name after the .NET rename, causing `error CS1739`. The FeatureProbe.csproj is in the green-tree gate (`for p in $(find demo -name '*.Tests.csproj')`), so this blocks the entire release/test posture until fixed.
- **Fix:** Updated both demo consumers to use the new field names — the minimum-viable change to unblock compile. Plan 24-08 will further extend these files with the new composites (ListRow, Message, Alert); this deviation only touches the two EmptyStateNode callers.
- **Files modified:** `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (line 853: `Message:` → `Description:`; comment updated); `demo/FeatureProbe-bun/handler.ts` (lines 751/753-755: `heading:` → `title:`, `message:` → `description:`; comment updated).
- **Commit:** `760153a` (folded into the same commit as Tasks 1-3 since they're semantically one "rename" change).

## Auth Gates

None.

## Bounty Resolution

**`empty-state-on-collections` — RESOLVED** by shipping this composite in its new schema. Per CONTEXT §6 and the tasting-approval decision, the design question ("devolve empty-state onto TableNode/ListNode as a property, or ship as a standalone composite") was resolved as: **standalone composite wins**. Consumers who want a richer empty-state in a Table/List either:
1. Render an `EmptyStateNode` standalone at the app level when the collection is empty (the common case), or
2. Pass it as a child in an existing empty-cell slot (if the collection supports slotting).

No new collection-property field needed. The bounty file itself will be archived in Plan 24-09 (the docs plan) — this SUMMARY records the resolution.

## Task-by-Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1-3 | Rename EmptyStateNode wire shape (BREAKING) + add icon slot | `760153a` |
| 4 | vitest + .NET serialization tests + AA hand-check | `4fc35b1` |

Note: Tasks 1-3 were committed together because they're a single semantic change (Task 1 alone leaves the build broken since Task 2's renderer references renamed fields; Task 3 is a small cascade of walker comment + consumer updates in the same rename). Committing them separately would violate the plan's own green-tree gate rule.

## Green-Tree Gate Verification

| Gate | Result |
|------|--------|
| `npm run build` | ✓ green |
| `npm run check:test-types` | ✓ green |
| `npm run check:core-globals` | ✓ green (`AGNOSTIC-03` unchanged) |
| `npm run check:aa-contrast` | ✓ green (all 13 themes, 13/13 shipped pairs) |
| `npm run check:no-demo-style` | ✓ green |
| `npm run check:demo-types` | ✓ green (21 demo projects) |
| `npx vitest run` | ✓ green (1130 passed, 1 skipped, 73 files) |
| `dotnet test viewmodel-shell-dotnet/Tests` | ✓ green (325 tests) |
| `dotnet test demo/**/*.Tests.csproj` (5 projects) | ✓ green (191 tests total: Tasks 28, ContactManager 39, RetroBoard 33, HelpDesk 61, ExpenseTracker 30) |
| `bun run parity/run.ts` | ✓ green (all backends agree; skill parity byte-identical across 2 backends) |

## Grep-Clean Verification

- `grep -rn 'vms-empty-state__heading\|vms-empty-state__message' viewmodel-shell/src viewmodel-shell/styles viewmodel-shell-dotnet/*.cs demo/FeatureProbe demo/FeatureProbe-bun` — 0 hits.
- `grep -rn '"heading":\|Heading:.*EmptyState\|Message:.*EmptyState' viewmodel-shell/src viewmodel-shell-dotnet/*.cs demo/FeatureProbe demo/FeatureProbe-bun` — 0 hits (scoped to EmptyStateNode regions; SectionNode.heading/AlertNode.message unaffected).
- Remaining `heading`/`message` references inside `viewmodel-shell/test/empty-state.test.ts` are all in NEGATIVE assertions or explanatory prose — those are LOAD-BEARING (they exist to prove the rename didn't revert).

## Self-Check: PASSED

- `viewmodel-shell/test/empty-state.test.ts` — created (14 tests pass).
- `viewmodel-shell-dotnet/Tests/EmptyStateNodeSerializationTests.cs` — created (13 tests pass).
- `viewmodel-shell/src/index.ts` — EmptyStateNode interface renamed at :1402.
- `viewmodel-shell/src/browser.ts` — emptyState() renderer rewritten at :4298.
- `viewmodel-shell/styles/default.css` — CSS block replaced at :2152.
- `viewmodel-shell-dotnet/ViewModels.cs` — EmptyStateNode record renamed at :1976.
- Commits present: `760153a` (rename + tests-move) and `4fc35b1` (test file creation).
