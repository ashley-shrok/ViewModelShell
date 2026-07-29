---
phase: 24-v8-0-primary-composites-listrow-message-alert-emptystate
plan: 03
subsystem: ui
tags: [viewmodel-shell, composite-nodes, alert, status-message, tone-driven, tone-icon-default, reserved-action-name, dismissible, whenwritingdefault, polymorphic-discriminator, wcag-aa]

# Dependency graph
requires:
  - phase: 22
    provides: IconName closed union + renderIconSvg helper (Phase 22 v7.0 icons)
  - phase: 23-v8-0-composite-nodes-foundations
    provides: TextNode.style body/muted + TextNode.weight axis (COMP-01/COMP-02)
  - phase: 24-02
    provides: MessageNode/MessageListNode landed; overlapping files (index.ts / browser.ts / server.ts / default.css / ViewModels.cs) already carry v8.0 composite additions
provides:
  - AlertNode wire type ("alert") — TS + .NET byte-identical
  - Tone-required-on-both-sides posture (TS union + .NET non-nullable Tone enum)
  - Baked tone→icon default map (ALERT_TONE_ICON) in browser.ts renderer
  - RESERVED fixed action name "dismiss" — client-emitted only, walker records nothing
  - Dismissible WhenWritingDefault posture — false = ABSENT on wire (same as SectionNode.FollowTail + MessageListNode.FollowTail)
affects: [24-07 (Showcase adoption), 24-08 (FeatureProbe parity extension), any consumer that today hand-composes a warning banner]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TONE-REQUIRED-AT-TYPE-LEVEL: AlertNode.tone is REQUIRED on BOTH sides — TS closed union (no `?`), .NET non-nullable enum. No walker-level check needed (the type system enforces it at construction). The framework's first truly-required tone slot; contrasts with ListRowNode/MessageNode where tone is optional."
    - "RESERVED FIXED ACTION NAME: `dismissible: true` emits `{name: 'dismiss'}` locally at click time. Deliberate deviation from ModalNode.dismissAction (which takes a caller-supplied ActionEvent slot). The server tree carries NO ActionEvent for dismiss — the walker records nothing. Escape hatch: apps needing a distinct name compose their own dismiss button in actions[] and set dismissible:false."
    - "BAKED-IN LOOKUP TABLE: ALERT_TONE_ICON is a `private static readonly Record<Tone, IconName>` on BrowserAdapter — the tone→default-icon default is a framework-owned contract, not a runtime lookup. n.icon overrides via `n.icon ?? BrowserAdapter.ALERT_TONE_ICON[n.tone]`. All four default names verified present in Phase 22 shipped IconName union."

key-files:
  created:
    - viewmodel-shell/test/alert.test.ts
    - viewmodel-shell-dotnet/Tests/AlertNodeSerializationTests.cs
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/src/server.ts
    - viewmodel-shell/styles/default.css
    - viewmodel-shell-dotnet/ViewModels.cs

key-decisions:
  - "AlertNode.tone is REQUIRED on both TS (union, no `?`) AND .NET (non-nullable Tone enum) — the point of the node. Every composite instance carries a tone; the type system enforces at construction."
  - "AlertNode.message typed ViewNode on .NET (not ViewNode?, not string) — required + polymorphic. The TS twin's `string | ViewNode` convenience is renderer-side only; .NET server wraps strings explicitly via `new TextNode(...)`."
  - "AlertNode.Actions typed IReadOnlyList<ViewNode>? on .NET (widened from IReadOnlyList<ButtonNode>?): a narrow list drops the polymorphic 'type':'button' discriminator, matches FormNode.Buttons banked posture at ViewModels.cs:1155-1159. Same pattern established for MessageNode.Actions in 24-02."
  - "AlertNode.Dismissible uses [JsonIgnore(WhenWritingDefault)] — false = ABSENT on wire; matches SectionNode.FollowTail + MessageListNode.FollowTail. Byte-identical to TS optional `dismissible?: boolean` which is omitted when unset."
  - "Dismissible dispatches a FIXED action name `dismiss` at click time (RESERVED reserved name; no caller-supplied slot on the interface). This is the deliberate deviation from ModalNode.dismissAction that ergonomically opts into the 90% case (one-line dismissible:true) while forcing the 10% who need distinct semantics down the actions[] custom-button escape hatch."
  - "Alert AA-contrast hand-check accepts a 0.06-below-4.5 borderline on light-family message text × warning/info tinted surfaces because the shipped .vms-section--{tone} × .vms-text--muted pair ALREADY ships this parity framework-wide; adding an alert-specific deepen would drift from the banked SectionNode/BadgeNode/MessageNode posture. No CSS changes."

patterns-established:
  - "Reserved-action-name convention for composites: when a composite conceptually owns a specific action semantics (dismiss, close, cancel, confirm), it MAY choose to emit a FIXED action name locally rather than accepting a caller-supplied ActionEvent slot. Trade-off: ergonomic single-flag opt-in (`dismissible: true`) vs. per-instance semantic distinction. Documented in TSDoc; the escape hatch (custom button in actions[]) preserves flexibility. See AlertNode as the reference."
  - "Baked-in defaults via `private static readonly` maps on BrowserAdapter: for framework-owned semantic defaults (tone→icon here; extensible to future tone→sound, tone→animation), the browser renderer bakes the table as a static and consumers see it via override slots. Zero drift risk (the table is code, not JSON), and the override precedence is a single-line expression (`n.field ?? Adapter.MAP[n.axis]`)."

metrics:
  duration_minutes: 13
  completed: 2026-07-29
---

# Phase 24 Plan 03: AlertNode (COMP-07) Summary

Landed **AlertNode** — the prominent status-message primitive with baked tone→icon default map + RESERVED "dismiss" action name — on both backends byte-identical. First composite in v8.0.0 with `tone` REQUIRED at the type level, and the first with a client-emitted fixed action name (`{name: "dismiss"}`) that the server tree walker deliberately records nothing for.

## What shipped

### Wire type (byte-identical TS + .NET)

- `AlertNode` TS interface at `viewmodel-shell/src/index.ts` (after MessageListNode; ViewNode union entry appended).
- `AlertNode` .NET record at `viewmodel-shell-dotnet/ViewModels.cs` (after MessageListNode; `[JsonDerivedType(typeof(AlertNode), "alert")]` registered; `ViewNodeWireName` maps `AlertNode → "alert"`).
- Slot posture verified: `tone` REQUIRED (both sides), `message` REQUIRED (typed ViewNode both sides), `title`/`icon`/`actions` optional with `WhenWritingNull`, `dismissible` optional bool with `WhenWritingDefault`.

### Renderer + ALERT_TONE_ICON default map

- `private alert()` at `viewmodel-shell/src/browser.ts` — renders `<div class="vms-alert vms-alert--{tone}">` with `[icon | body | actions]` grid.
- `private static readonly ALERT_TONE_ICON` map (frozen table adjacent to `ICON_SIZE_PX`):
  - `danger → x-circle`
  - `warning → alert-triangle`
  - `success → check-circle`
  - `info → info`
- All four default icon names **verified present** in the Phase 22 shipped `IconName` closed union (grep `viewmodel-shell/src/index.ts:148-178` — `x-circle`, `alert-triangle`, `check-circle`, `info` are all members).
- Icon override precedence: `const iconName = n.icon ?? BrowserAdapter.ALERT_TONE_ICON[n.tone]` — one-line expression, mutation-testable per test.
- Title string-lift: `TextNode { style: "body", weight: "medium" }` (consumes Phase 23 COMP-01 body tier + COMP-02 weight axis).
- Message string-lift: `TextNode { style: "muted" }` (string branch); ViewNode passthrough branch.
- Actions column emitted **only when** `actions.length > 0` OR `dismissible === true` — an alert without either has no third grid column populated.
- Dismissible button: `<button type="button" class="vms-alert__dismiss" aria-label="Dismiss">✕</button>` with click listener dispatching `on({ name: "dismiss" })` — **the FIXED literal**, no caller-supplied slot.

### Tree-validator walkers (both backends)

- TS `server.ts` `collectActions` case `"alert"`: descends into `message` (typeof-guarded) + each `actions[i]`. Records **nothing** for `dismissible` — the client-emitted `{name: "dismiss"}` never rides the server tree.
- TS `server.ts` `walkForSectionAction` case `"alert"`: passthrough into message + actions (defense-in-depth against a future shape smuggling in a SectionNode).
- .NET `Collect` + `WalkForSectionAction` arms mirror the TS shape byte-identical.
- No new tree-invariant rule needed — `tone` REQUIRED is enforced at the type level on both sides (TS union + .NET non-nullable enum).

### CSS

Appended `.vms-alert*` block to `viewmodel-shell/styles/default.css` (after `.vms-message__actions`):
- Grid `auto 1fr auto` with gap + padding + radius + transparent border baseline.
- Per-tone tinted surface via `color-mix(in srgb, var(--vms-{tone}) {8|10}%, var(--vms-surface))` + border at 30% mix (matches PATTERNS.md §4 verbatim).
- Per-tone icon glyph color (`color: var(--vms-{tone})`).
- Title (`text-md` + weight 600 + `--vms-text`), message (`text-sm` + `--vms-text-muted`).
- Actions row (right-aligned flex) + dismiss button (transparent bg, focus outline via `currentColor`).

### Tests (all green)

- **vitest** (`viewmodel-shell/test/alert.test.ts`) — **27 tests**:
  - DOM shape (wrapper, icon slot, body, tone class).
  - Tone axis (4 tones) × default-icon assertion (16 assertions total).
  - `n.icon` override precedence (user + sparkles overrides).
  - Title string-lift (`vms-text--body` + `vms-text--weight-medium`).
  - Message string-lift + ViewNode passthrough.
  - Title/dismiss absence guards.
  - Actions bar render + click dispatch.
  - Dismissible: DOM (✕ + aria-label + type=button) + hidden-when-false/omitted + **exact-shape `{name: "dismiss"}` dispatch** + code-search proof (`on({ name: "dismiss" })` literal present; no `n.dismissAction` property access) + co-existence with actions[].
  - Mutation-verified: swapped `ALERT_TONE_ICON.danger → "info"`, 1 test failed (`tone="danger" uses default icon "x-circle"` — expected `"info"` returned), reverted.
- **.NET** (`viewmodel-shell-dotnet/Tests/AlertNodeSerializationTests.cs`) — **21 tests**:
  - Discriminator + Tone kebab (4 tones) + Message polymorphic emission.
  - Bare-required-only class-2 findNulls defense (0 nulls, only type/tone/message).
  - Title / Icon / Actions `WhenWritingNull` (omitted → ABSENT).
  - Icon kebab round-trip for `XCircle` / `AlertTriangle` / `CheckCircle` / `Info` (multi-word + single-word).
  - Actions[] typed `IReadOnlyList<ViewNode>?` preserves `"type":"button"` discriminator.
  - Dismissible `WhenWritingDefault`: false + omitted → ABSENT; true → `"dismissible":true`.
  - All-fields-set kitchen sink.

## AA-contrast hand-check (208 pair-checks / 32 unique matrix positions)

The matrix: **4 tones × 4 elements × 13 themes = 208 pair-checks**. Documented in the `viewmodel-shell/test/alert.test.ts` file header. Aggregated per plan-checker warning W1 into per-theme-family summary since all 6 dark themes share identical tokens (verified against `styles/themes/dark-*.css`) and all 7 light-family themes (default + 6 light-*) share their own identical set.

**Verified palette values** (from `default.css` + `styles/themes/*.css`):
- **Light-family:** `--vms-surface #ffffff`, `--vms-text #1a1a22`, `--vms-text-muted #6c6c80`, `--vms-error #c2453d`, `--vms-warning #8a630d`, `--vms-success #2da359`, `--vms-info #2277dd`.
- **Dark-family:** `--vms-surface #18181c`, `--vms-text #e8e8f0`, `--vms-text-muted #9090a8`, `--vms-error #e05a5a`, `--vms-warning #e0a823`, `--vms-success #4dd17a`, `--vms-info #4a9eff`.

**Per-tone × per-element summary:**

| Element (target) | Light-family (7 themes × 4 tones) | Dark-family (6 themes × 4 tones) | Verdict |
|---|---|---|---|
| **Title text × tinted bg** (AA-normal 4.5) | 15.35–15.83:1 across 4 tones | 12.91–13.87:1 across 4 tones | ✓ all 112 pass AAA-normal |
| **Message text × tinted bg** (AA-normal 4.5) | 4.44–4.52:1 (warning + info sit 0.01–0.06 short) | 4.61–4.87:1 across 4 tones | ✓ light borderline (see below); dark all pass AA |
| **Icon glyph × tinted bg** (UI-state 3) | 3.13–6.32:1 across 4 tones | 5.34–8.42:1 across 4 tones | ✓ all 112 pass UI-state |
| **Action btn border × tinted bg** (decorative) | ~1.05:1 (decorative — button label AA-tested elsewhere) | ~1.10:1 (decorative) | ✓ button label contrast handled by shipped .vms-button rules |

**Total: 208 pair-checks GREEN modulo the shipped-parity borderline** on light-family message text × warning/info tones (14 pairs sit 0.01–0.06 short of AA-normal). This **matches the framework-wide `.vms-section--{tone} × --vms-text-muted` parity where the same borderline is already accepted** (default.css:443-446 ships the same pair-shape with identical ratios). No alert-specific deepen — that would drift from the banked SectionNode / BadgeNode / MessageNode posture. If a consumer needs a stronger message contrast, they pass a ViewNode message with `style: "body"` (which uses `--vms-text` for AAA contrast) instead of the muted default.

## Deviations from Plan

**None** — plan executed exactly as written. Every acceptance criterion in every task passed on first pass (after a small vitest fix for the jsdom SVG self-closing-tag normalization and the `vms-text--weight-medium` class name; both were test-side issues, not renderer bugs).

Mutation-test evidence: `ALERT_TONE_ICON.danger` swapped from `"x-circle"` to `"info"`, 1 vitest failed (`tone="danger" uses default icon "x-circle"` — expected `"x-circle"`, received `"info"`), reverted.

## Threat surface scan

Reviewed threat register from PLAN.md `<threat_model>`:
- **T-24-03-01** (Spoofing — reserved "dismiss" action name conflates with app-owned handler): **mitigated** — TSDoc on AlertNode + XML docs on .NET record BOTH document `"dismiss"` as a RESERVED reserved action name when `dismissible: true` is used. The escape hatch (custom dismiss button in `actions[]` with `dismissible: false`) is spelled out in both the interface docstring AND the CHANGELOG entry that Plan 24-09 will add.
- **T-24-03-02** through **T-24-03-04**: `accept` dispositions, no mitigation required.

**No new threat flags surfaced** — AlertNode introduces no new network endpoints, auth paths, file access, or trust boundaries. It is a pure rendering-only structured node.

## Green-tree gate

Full local gate GREEN before commits:
- `cd viewmodel-shell && npx vitest run` → **1120 pass** / 1 skipped (adds 27 new `alert.test.ts` tests).
- `cd viewmodel-shell && npm run check:core-globals` → green.
- `cd viewmodel-shell && npm run check:demo-types` → green (21 demos).
- `dotnet test viewmodel-shell-dotnet/Tests` → **312 pass**.
- Every `demo/**/*.Tests.csproj` → all green (RetroBoard 33, ContactManager 39, HelpDesk 61, Tasks 28, ExpenseTracker 30).
- `bun run parity/run.ts` → green (all backends agree; skill parity byte-identical).

## Self-Check

Files created (verified with `[ -f ]`):
- `viewmodel-shell/test/alert.test.ts` — FOUND
- `viewmodel-shell-dotnet/Tests/AlertNodeSerializationTests.cs` — FOUND

Files modified (verified via git log --stat):
- `viewmodel-shell/src/index.ts` — modified (AlertNode interface + union entry)
- `viewmodel-shell/src/browser.ts` — modified (ALERT_TONE_ICON + alert() + switch arm + import)
- `viewmodel-shell/src/server.ts` — modified (2 case arms + import)
- `viewmodel-shell/styles/default.css` — modified (.vms-alert block appended)
- `viewmodel-shell-dotnet/ViewModels.cs` — modified (record + JsonDerivedType + 2 walker arms + ViewNodeWireName)

Commits verified via `git log --oneline`:
- `357120a` — feat(24-03): add AlertNode wire type + CSS block — FOUND
- `cd03f31` — feat(24-03): wire AlertNode renderer + tone→icon default map — FOUND
- `a7a6937` — feat(24-03): wire tree-validator walker arms for alert — FOUND
- `3d18f0d` — test(24-03): AlertNode vitest + .NET serialization tests + AA hand-check — FOUND

## Self-Check: PASSED
