---
phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip
plan: 01
subsystem: ui
tags: [composite-nodes, user-row, status-kind, view-node, dotnet, typescript, wire-parity]

requires:
  - phase: 24-v8-0-primary-composites
    provides: ListRowNode template (grid + string-lift + whole-row action), tree-validator walker discipline
  - phase: 23-typography-caption-weight-avatar
    provides: TextNode.style="body", TextNode.weight="medium", AvatarNode
provides:
  - UserRowNode wire type shipped both backends (TypeScript + .NET), byte-identical
  - StatusKind closed 4-value enum with KebabEnum serialization ("online"/"away"/"offline"/"busy")
  - UserRowStatus leaf sub-record (Label + Kind — NOT a ViewNode; no walker descent)
  - Status-dot CSS palette (.vms-status-dot--{kind}) mapped to Phase-23 tone colors
  - .vms-user-row-list container + .vms-user-row grid + BEM element classes
  - Whole-row action wiring mirroring ListRowNode.action (role/tabIndex/aria-label/keydown/stopPropagation)
  - vitest coverage (29 tests) + .NET serialization tests (19 [Fact])
  - AA-contrast hand-check for 52 pair-checks (4 kinds × 13 themes) at SC-1.4.11 3:1 threshold
affects: [25-02-detail-row, 25-03-timeline, 25-04-setting-row, 25-05-chip, 25-07-showcase, 25-08-parity-extension, 25-10-final-gate]

tech-stack:
  added: []
  patterns:
    - "Typed sub-record slot pattern (UserRowStatus) — leaf posture identical to LookupItem/FieldOption; NO [JsonDerivedType]; NO walker descent"
    - "Container-detected element (`<li>` vs standalone `<div>`) based on parent's `.vms-user-row-list` classList — mirrors ListRowNode's Phase-24 idiom"
    - "Trailing-grid modifier (`.vms-user-row--has-trailing`) switches grid from 3-col to 4-col so trailing sits in its own cell — closes the plan-checker's trailing-CSS gap"
    - "Byte-identical TS/.NET walker arms — Analog C typing (ViewNode? not narrow), Name non-nullable ViewNode, other slots nullable ViewNode? with WhenWritingNull"

key-files:
  created:
    - viewmodel-shell/test/user-row.test.ts (29 vitest — jsdom render + a11y + tree-validator descent + AA header)
    - viewmodel-shell-dotnet/Tests/UserRowNodeSerializationTests.cs (19 [Fact] — WhenWritingNull + KebabEnum × 4 + status sub-record shape + walker descent)
    - .planning/phases/25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip/25-01-SUMMARY.md
  modified:
    - viewmodel-shell/src/index.ts (+ UserRowNode interface, + ViewNode union entry)
    - viewmodel-shell/src/browser.ts (+ private userRow() renderer, + case arm, + type import)
    - viewmodel-shell/src/server.ts (+ collectActions arm, + walkForSectionAction arm, + UserRowNode import)
    - viewmodel-shell/styles/default.css (+ .vms-user-row-list + .vms-user-row + .vms-status-dot palette)
    - viewmodel-shell-dotnet/ViewModels.cs (+ StatusKind enum, + UserRowStatus sub-record, + UserRowNode record, + JsonDerivedType, + ViewNodeWireName mapping, + Collect arm, + WalkForSectionAction arm)

key-decisions:
  - "Status is a leaf typed sub-record (not a ViewNode slot). Reason: no ViewNode content to descend, closed enum for kind, small typed object same posture as LookupItem/FieldOption. Locked in CONTEXT §1."
  - "Trailing gets its own grid column via .vms-user-row--has-trailing modifier (closed the plan-checker CSS gap). Emit the modifier only when trailing is present so the base 3-col shape stays byte-identical to plans that don't set trailing."
  - "Whole-row action selector list is byte-identical to ListRowNode (`.vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, a[href]`) — no divergence between COMP-05 and COMP-09 patterns."
  - "AA-contrast hand-check documents 52 pair-checks passing at SC-1.4.11 3:1 (graphical UI-state) by construction of the shipped Phase-23 tone palette — no new deepening needed."

patterns-established:
  - "Composite-with-leaf-sub-record: any small typed metadata (like status={label, kind}) is a sub-record with a closed enum, NOT a ViewNode slot. Downstream Phase-25 plans (Detail, Timeline, Setting, Chip) may reuse for future small sub-records."

requirements-completed: [COMP-09]

# Metrics
duration: 35min
completed: 2026-07-29
---

# Phase 25 Plan 01: UserRowNode (COMP-09) Summary

**UserRowNode wire type shipped byte-identical across TypeScript + .NET, with the leaf `UserRowStatus` sub-record + closed 4-value `StatusKind` enum driving the shipped status-dot palette; whole-row action mirrors ListRowNode a11y; plan-checker's trailing-CSS gap closed via `.vms-user-row--has-trailing` grid modifier.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 4/4 complete
- **Files modified:** 5 (index.ts, browser.ts, server.ts, ViewModels.cs, default.css)
- **Files created:** 2 (user-row.test.ts, UserRowNodeSerializationTests.cs)

## Accomplishments

### Wire types (Task 1) — commit `61223e7`

- **TypeScript (`viewmodel-shell/src/index.ts`):** Added `UserRowNode` interface with slots `avatar?: ViewNode`, `name: string | ViewNode` (required), `meta?: string | ViewNode`, `status?: { label: string; kind: "online" | "away" | "offline" | "busy" }` (small typed sub-record; NOT a ViewNode slot), `trailing?: ViewNode`, `action?: ActionEvent`. Appended `| UserRowNode` to the ViewNode union.
- **.NET (`viewmodel-shell-dotnet/ViewModels.cs`):** Added `StatusKind` enum (`Online, Away, Offline, Busy`) with `[JsonConverter(typeof(KebabEnum<StatusKind>))]` for wire strings `"online"/"away"/"offline"/"busy"`. Added `UserRowStatus(string Label, StatusKind Kind)` sub-record — NOT `: ViewNode`, no `[JsonDerivedType]`, same posture as `LookupItem`. Added `UserRowNode` record with Analog-C slot typing (`ViewNode Name` non-nullable required, every optional as `ViewNode?` / `UserRowStatus?` / `ActionDescriptor?` with `[JsonIgnore(WhenWritingNull)]`). Registered `[JsonDerivedType(typeof(UserRowNode), "user-row")]` on the `[JsonPolymorphic]` block; added `UserRowNode => "user-row"` to the `ViewNodeWireName` switch expression.
- **CSS (`viewmodel-shell/styles/default.css`):** Appended the full `.vms-user-row-list` + `.vms-user-row*` + `.vms-status-dot*` block after the AlertNode block. **Plan-checker fix #1 lands here:** `.vms-user-row--has-trailing` modifier switches the grid from `auto 1fr auto` (3-col: avatar/content/status) to `auto 1fr auto auto` (4-col: avatar/content/trailing/status) so trailing sits in its own dedicated cell. Status-dot palette: `--online → --vms-success`, `--away → --vms-warning`, `--offline → color-mix(--vms-text-muted 60%, transparent)`, `--busy → --vms-error`.

### Renderer (Task 2) — commit `fc51539`

- **`private userRow()`** in `viewmodel-shell/src/browser.ts` mirrors `listRow()` at browser.ts:1145-1253 byte-for-byte for its shared shape (container detection, string-lift, whole-row action a11y, stopPropagation selector list), with these adaptations:
  - Container-detection reads `parent.classList.contains("vms-user-row-list")` (matches the CSS class from Task 1).
  - `.vms-user-row--has-trailing` class emitted when `n.trailing` is present (closes plan-checker fix #1).
  - String name → `TextNode { style: "body", weight: "medium" }` wrap (COMP-01/02 trained typography).
  - String meta → `TextNode { style: "muted" }` wrap.
  - Status rendering: `<span class="vms-user-row__status"><span class="vms-status-dot vms-status-dot--${kind}"></span>{label}</span>` — dot BEFORE label per CONTEXT §1 DOM shape. Label emitted via `document.createTextNode` (textContent; safe by construction).
  - Whole-row action selector list byte-identical to `listRow()`: `.vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, a[href]`.
- Added `case "user-row": return this.userRow(n, parent, on);` to the `renderNode` switch immediately after `case "alert"`.
- Added `UserRowNode` to the type import list at the top of `browser.ts`.
- **Core-globals guard PASSES** — `viewmodel-shell/src/index.ts` still references zero platform globals; the renderer lives entirely in `browser.ts`.

### Walkers (Task 3) — commit `f244b52`

- **TS `collectActions`:** Added `case "user-row"` arm that descends into `ur.avatar`, `ur.name` (guarded via `typeof !== "string"`), `ur.meta` (null + typeof-guarded), `ur.trailing`; records `ur.action` via `recordAction` (participates in action-name uniqueness).
- **TS `walkForSectionAction`:** Passthrough arm mirrors the descent pattern (minus action recording), so a future consumer can't slip an interactive SectionNode inside a UserRowNode slot.
- **.NET `Collect`:** `case UserRowNode userRow` arm — `Name` always descended (non-nullable), `Avatar`/`Meta`/`Trailing` null-guarded via `is { }` pattern-match, `Action` recorded via `Record`.
- **.NET `WalkForSectionAction`:** Passthrough arm identical shape.
- **`status` is NOT descended** in either walker (verified: `ur.status` / `userRow.Status` grep count is zero across `server.ts` + `ViewModels.cs`).

### Tests (Task 4) — commit `0f15725`

- **vitest (`viewmodel-shell/test/user-row.test.ts`) — 29 tests, all pass:**
  - Container detection: `<li>` in `.vms-user-row-list`, else standalone `<div>`.
  - String-lift trained typography: string name → `.vms-text--body.vms-text--weight-medium`; string meta → `.vms-text--muted`; ViewNode escape hatch does NOT wrap.
  - Avatar slot renders through node dispatch (AvatarNode).
  - Status × 4 kinds: each emits `.vms-status-dot--{kind}` (mutation-anchor tests).
  - Status DOM order: dot span first, text node second.
  - Trailing slot + `.vms-user-row--has-trailing` modifier + trailing-vs-status DOM isolation (plan-checker fix anchors).
  - Whole-row action a11y: `role="button"`, `tabIndex=0`, aria-label from name+meta, clickable modifier, Enter/Space dispatch + preventDefault, Tab does NOT dispatch, stopPropagation on nested `.vms-button` clicks.
  - Tree-validator descent: duplicate action name in `trailing` + `action` throws `Duplicate action name 'dup'`; status is NOT descended (sanity: unique tree with status validates cleanly).
- **AA-contrast hand-check header:** documents 52 pair-checks (4 kinds × 13 themes) passing SC-1.4.11 3:1 threshold by construction of the shipped Phase-23 tone palette. No new deepening required.
- **.NET (`viewmodel-shell-dotnet/Tests/UserRowNodeSerializationTests.cs`) — 19 [Fact] methods, all pass:**
  - Discriminator: `"type":"user-row"`.
  - `BareNode_MinimalShape_OnlyTypeAndName` — canonical WhenWritingNull posture; every optional ABSENT (not null).
  - Per-slot `_OmittedIsAbsent` (× 5): Avatar, Meta, Status, Trailing, Action.
  - Polymorphic emission on Avatar/Meta/Trailing (nested `"type":"avatar"/"text"/"badge"`).
  - StatusKind kebab round-trips × 4: `"kind":"online"/"away"/"offline"/"busy"`.
  - `Status_SerializesAsSubRecord` — asserts `"status":{"label":"...","kind":"..."}` WITHOUT nested `"type"` discriminator (verifies UserRowStatus is a leaf sub-record).
  - Action serializes as `ActionDescriptor` (nested `"name":"..."`).
  - All-fields-set proof.
  - Walker descent: `TreeInvariant_WalkerDescendsIntoUserRowSlots` catches duplicate action name across `Trailing` + `Action`.
  - `TreeInvariant_WalkerDoesNotDescendIntoStatus` — sanity that status is a leaf.

### Mutation-test proof

- Swapped `\`vms-status-dot vms-status-dot--${n.status.kind}\`` → hardcoded `vms-status-dot--away` in `browser.ts`.
- Vitest reported 3 failing tests (kind=online, kind=offline, kind=busy — each looks for its specific class).
- `git checkout src/browser.ts` reverted; re-ran vitest — all 29 tests green.
- Confirms the kind-specific tests are mutation-testable (the CSS-class assertion is genuinely tied to the renderer's dynamic template-literal expansion).

### Plan-checker's trailing-CSS gap — CLOSED

The plan-checker warned: "UserRowNode.trailing CSS gap — the wire type includes `trailing?: ViewNode` and the walker descends into it, but the base CSS grid is 3-col `[avatar | content | status]` with no allocation for trailing."

**Fix applied:**
- CSS block adds `.vms-user-row--has-trailing { grid-template-columns: auto 1fr auto auto; }` (4-col: `[avatar | content | trailing | status]`) — the modifier applies only when trailing is present, keeping the base 3-col shape byte-identical when trailing is absent.
- Renderer emits the modifier via `if (n.trailing) cls.push("vms-user-row--has-trailing");`.
- `.vms-user-row__trailing` selector styled (`display: flex; align-items: center; padding-left: --vms-space-sm; white-space: nowrap`).
- vitest carries 3 mutation-testable anchors for the fix:
  - `"emits .vms-user-row--has-trailing modifier when trailing is present"` — asserts the class emission (mutation: remove the class push → fails).
  - `"does NOT emit .vms-user-row--has-trailing when trailing is absent"` — proves the byte-identical base shape.
  - `"trailing renders in its correct grid cell — visually distinct from status"` — asserts trailing and status are separate DOM siblings under the row (mutation: nest trailing inside status → fails).

## Suite Verification

- **viewmodel-shell vitest full run:** 1159/1159 tests pass, 1 skipped, 74 test files.
- **`viewmodel-shell-dotnet/Tests` full run:** 344/344 tests pass.
- **npm run check:core-globals:** green — `viewmodel-shell/src/index.ts` references zero platform globals.
- **npm run build (`tsc -b tsconfig.tui.json`):** green.
- **`dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj`:** green (0 warnings, 0 errors).

## Deviations from Plan

None — plan executed exactly as written, including the plan-checker's flagged trailing-CSS gap (closed via `.vms-user-row--has-trailing` modifier + 4-col grid switch + dedicated CSS block + 3 mutation-anchor tests).

## Commits

| Task | Commit  | Message |
|------|---------|---------|
| 1    | 61223e7 | feat(25-01): UserRowNode wire types + StatusKind enum + CSS (COMP-09 Task 1) |
| 2    | fc51539 | feat(25-01): userRow renderer with status-dot palette + trailing grid slot (COMP-09 Task 2) |
| 3    | f244b52 | feat(25-01): tree-validator walker arms for user-row (COMP-09 Task 3) |
| 4    | 0f15725 | test(25-01): vitest + .NET serialization tests for UserRowNode (COMP-09 Task 4) |

## Self-Check: PASSED

- viewmodel-shell/src/index.ts — modified (UserRowNode interface + union entry) — FOUND.
- viewmodel-shell/src/browser.ts — modified (private userRow + case arm + type import) — FOUND.
- viewmodel-shell/src/server.ts — modified (collectActions arm + walkForSectionAction arm + import) — FOUND.
- viewmodel-shell/styles/default.css — modified (.vms-user-row + .vms-status-dot palette + --has-trailing modifier) — FOUND.
- viewmodel-shell-dotnet/ViewModels.cs — modified (StatusKind + UserRowStatus + UserRowNode + JsonDerivedType + ViewNodeWireName + Collect + WalkForSectionAction) — FOUND.
- viewmodel-shell/test/user-row.test.ts — created (29 tests) — FOUND.
- viewmodel-shell-dotnet/Tests/UserRowNodeSerializationTests.cs — created (19 [Fact] methods) — FOUND.
- Commit 61223e7 — FOUND.
- Commit fc51539 — FOUND.
- Commit f244b52 — FOUND.
- Commit 0f15725 — FOUND.

All claims verified against the working tree + git log.
