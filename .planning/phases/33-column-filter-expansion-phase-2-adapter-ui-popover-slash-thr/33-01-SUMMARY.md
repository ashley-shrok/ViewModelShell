---
phase: 33-column-filter-expansion-phase-2-adapter-ui-popover-slash-thr
plan: "01"
subsystem: browser-adapter / filter-ui
tags: [filter, popover, portal, icon-grammar, keyboard, css, wcag]
dependency_graph:
  requires:
    - "32-01 — FilterDescriptor/FilterRule/FilterSpec/ValueKind wire types in index.ts + ViewModels.cs"
    - "32-02 — TableColumn.filter? + TableNode.filterDescriptorBinds? wire fields"
  provides:
    - "filter-slash SVG glyph in ICONS map + IconName union + .NET enum"
    - "BrowserAdapter Round 2 hybrid filter row: always-visible inline input + filter-icon button per filterable column"
    - "Escalation popover mounted in popoverPortal div (sibling of table wrapper, escaping overflow-x clip)"
    - "Three-state icon grammar: filter-slash (empty), filter (simple), filter+dot (escalated)"
    - "Viewport-clamped popover positioning via getBoundingClientRect + position:fixed"
    - "Keyboard support: Escape discards, Enter in inline commits, Tab within popover, focus restore on close"
    - "Inline read-only summary for nontrivial descriptors (>1 rule or non-contains operator)"
    - "All filter UI CSS in default.css"
  affects:
    - "viewmodel-shell/src/browser.ts — BrowserAdapter"
    - "viewmodel-shell/src/icons-payload.ts — ICONS map"
    - "viewmodel-shell/src/index.ts — IconName union"
    - "viewmodel-shell-dotnet/ViewModels.cs — IconName enum + converter"
    - "viewmodel-shell/styles/default.css — filter UI rules"
tech_stack:
  added: []
  patterns:
    - "Private Map persistent cross-render state (filterDrafts, after editorInstances/chartInstances/composerRegistry precedent)"
    - "Portal-based popover: popoverPortal div appended to container, sibling of table wrapper"
    - "position:fixed + getBoundingClientRect + viewport edge clamping (right-clamp then bottom-flip-above fallback)"
    - "render() preamble cleanup: popover close + handler removal before replaceChildren"
    - "State-only filter commit (write via sa.write, no named action dispatch)"
    - "else-if Wave 2 bridge: legacy filterAction path survives until Plan 02"
key_files:
  created: []
  modified:
    - viewmodel-shell/src/icons-payload.ts
    - viewmodel-shell/src/index.ts
    - viewmodel-shell-dotnet/ViewModels.cs
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/styles/default.css
decisions:
  - "Inline Enter and Apply commit filter state via sa.write only — no named action dispatch. Server picks up the updated descriptor on the next regular action. This departs from the legacy filterAction dispatch pattern; documented below."
  - "popover z-index set to 1050 (not 1200 as plan suggested) to sit between modal-backdrop (1000) and toast (1100) and avoid conflicting with skew-lock (1200)"
  - "Pre-existing .NET parity gap for Square (Phase 30 CHAT-14) fixed in same commit as FilterSlash addition — both were missing from .NET IconName enum"
  - "popoverScrollResizeCleanup single closure owns all document listener cleanup (outside-click, Escape, resize, scroll) to prevent accumulation"
metrics:
  duration: ~90 minutes
  completed: 2026-08-18T21:41:53Z
  tasks_completed: 2
  files_changed: 5
---

# Phase 33 Plan 01: Adapter Filter-Row Rebuild — Popover + Portal + Icon-State Grammar + CSS Summary

**One-liner:** Round 2 hybrid filter UI with always-visible inline input + three-state icon button + escalation popover mounted in a portal div escaping table overflow clip.

## What Was Built

### Task 1: filter-slash glyph (commit 53be255)

Added the `filter-slash` SVG glyph to the icon inventory:

- `icons-payload.ts`: new `"filter-slash"` entry immediately after `"filter"` — reuses the same funnel path as `filter` plus a `<line x1="3" y1="3" x2="21" y2="21" />` diagonal slash.
- `index.ts`: `"filter-slash"` added to the `IconName` union adjacent to `"filter"` on the Actions group line.
- `ViewModels.cs`: `FilterSlash` added to the `IconName` enum and `[IconName.FilterSlash] = "filter-slash"` to the converter mapping.

**Also fixed (pre-existing parity gap, Rule 1 auto-fix):** `Square` (shipped in Phase 30 for `ChatComposerNode`'s stop-icon) was present in TS `IconName` and `icons-payload.ts` but absent from the .NET `IconName` enum and `_toWire` converter. Added `Square` to the .NET enum and mapping in the same commit. Without this fix the build-time converter integrity check would have failed after adding `FilterSlash`.

### Task 2: Adapter filter-row rebuild (commit 91669a8)

`browser.ts` — 708 net insertions, `default.css` — 190 net insertions.

**New BrowserAdapter private fields:**
- `filterDrafts: Map<string, FilterDescriptor>` — keyed by bind path; persistent across renders, seeded on popover open
- `popoverPortal: HTMLDivElement` — created in constructor, appended to container as sibling of table wrapper
- `activePopover: { bindPath, colKey, button, popoverEl } | null`
- `popoverOutsideHandler` and `popoverScrollResizeCleanup` — document listener refs for cleanup

**Constructor changed to block form** to create and append `popoverPortal`.

**render() preamble** closes any open popover before `container.replaceChildren(...)`:
- removes outside-click/Escape/resize/scroll listeners
- removes popover DOM from portal
- nulls `activePopover`

**Filter row gate logic** (the replaced block):
```
const hasNewFilters = !!n.filterDescriptorBinds && n.columns.some(c => c.filter != null);
const hasLegacyFilters = n.columns.some(c => c.filterable) && !!n.filterAction;
if (hasNewFilters) { /* Phase 33 new path */ }
else if (hasLegacyFilters) { /* Wave 2 bridge — survives until Plan 02 removes old wire fields */ }
```

**Per-column filter header cell** (new path):
- Reads current `FilterDescriptor` from `sa.read(bindPath)`
- `computeFilterState()` → `"empty" | "simple" | "escalated"`
- `"empty"` or `"simple"`: editable `<input type="text">`, value = current contains value
- `"escalated"`: `<span class="vms-filter-inline-summary">` with compact text (max 40 chars, truncated with "…")
- Filter button with icon: `filter-slash` (empty), `filter` (simple), `filter` + `.vms-filter-dot` (escalated)
- `aria-expanded="false"` initially; `"true"` when popover open

**Private helper methods added:**
- `computeFilterState(descriptor, spec)` — empty/simple/escalated
- `buildFilterSummary(descriptor)` — compact human-readable expression, 40-char max
- `defaultOpForKind(kind)` — "contains" or "is-true" for yes-no
- `operatorsForKind(kind)` — Array<{value, label}> for 5 value kinds
- `isNoValueOperator(op)` — boolean for is-empty/is-not-empty/is-true/is-false
- `isRangeOperator(op)` — boolean for between/in-range
- `openFilterPopover(bindPath, col, spec, button, on)` — seeds draft, builds DOM, appends to portal, positions, registers cleanup
- `renderFilterPopoverContent(popoverEl, bindPath, col, spec, on)` — renders operator selects, typed value inputs, joiner toggle, footer
- `buildFilterValueInput(spec, rule)` — returns typed input or select for fixed-set
- `positionPopover(button, popoverEl)` — position:fixed + getBoundingClientRect + right-clamp + bottom-flip-above fallback + clamp to top:gap
- `closeFilterPopover(discard)` — removes popover from portal, restores aria-expanded, restores focus, calls cleanup

**CSS added to `default.css`:**
`.vms-popover-portal`, `.vms-filter-popover`, `.vms-filter-button` (+ hover/focus/aria-expanded variants), `.vms-filter-dot`, `.vms-filter-inline-summary`, `.vms-filter-op-select`, `.vms-filter-value-input`, `.vms-filter-joiner` (+ button.active), `.vms-filter-footer`, `.vms-filter-add-rule`, `.vms-filter-clear`, `.vms-filter-apply`, `.vms-filter-remove-rule`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing .NET parity gap: Square missing from IconName enum**
- **Found during:** Task 1 — adding FilterSlash triggered the .NET IconName converter's build-time integrity check
- **Issue:** `IconName.Square` (Phase 30, CHAT-14) was present in TS `IconName` union and `icons-payload.ts` but absent from the .NET `IconName` enum and `_toWire` Dictionary. The converter check iterates all enum values and verifies each has a mapping; a new enum entry (FilterSlash) would have triggered the check, surfacing the pre-existing Square gap.
- **Fix:** Added `Square` to the .NET enum + `[IconName.Square] = "square"` to `_toWire` in the same commit as `FilterSlash`.
- **Files modified:** `viewmodel-shell-dotnet/ViewModels.cs`
- **Commit:** 53be255

### Behavioral Decisions Documented

**Inline Enter + Apply = state-write only, no named action dispatch**

The plan's `must_haves.truths[2]` says "dispatches an action that writes a single `{operator:'contains', value:'...'}` FilterDescriptor." The action dispatch mechanism used by the legacy `filterAction` path was a named `on({ name: filterAction.name })` call. The new `filterDescriptorBinds` shape provides no equivalent named action for filter commits.

Decision: `sa.write(bindPath, descriptor)` is the commit. The server reads the updated descriptor on the next regular action (any button click, form submit, poll). No named action is dispatched from the inline Enter or the popover Apply button. This matches the Phase 32 design intent ("state-only path") and was the planned resolution documented in the plan's own `<action>` note ("inline Enter ONLY writes the state; no action dispatch").

**Clear button** similarly writes `{ rules: [], joiner: "all-of" }` to state via `sa.write` and closes the popover — no named clear action dispatched.

**z-index set to 1050 (plan suggested 1200)**

The plan's CSS snippet used `z-index: 1200` for `.vms-popover-portal`. The existing z-index hierarchy: modal-backdrop = 1000, toast = 1100, skew-lock = 1200. Placing the filter popover at 1200 would conflict with the skew-lock overlay. Set to 1050 instead — above modal-backdrop (so a filter popover opened from within a modal is visible), below toast (notifications still appear above popovers), well below skew-lock (hard UI lock always wins).

## WCAG AA Hand-Check

New color pairings introduced by the filter UI CSS:

| Pairing | Foreground | Background | Ratio | Pass 4.5:1? |
|---------|-----------|------------|-------|-------------|
| `.vms-filter-joiner button.active` text | `#fff` | `var(--vms-accent)` = `#5a4ad7` (default) | ~5.63:1 | Yes |
| `.vms-filter-apply` text | `#fff` | `var(--vms-accent)` = `#5a4ad7` (default) | ~5.63:1 | Yes |
| `.vms-filter-inline-summary` text | `var(--vms-text-muted)` | `var(--vms-surface)` | ≥ 4.5:1 (framework invariant, pre-existing) | Yes |

**Note on theme variance:** Some themes (light-amber, dark-amber) use an amber accent (`#d97706` or similar) where white text contrast may fall below 4.5:1 for body-sized text. This is a known framework-wide posture — the same applies to `.vms-button--primary` and `.vms-chat-composer__send--ready`. A future `--vms-on-accent` token (providing a theme-appropriate foreground for accent fills) would close this properly. Not introduced by this plan; documented for tracking.

## Self-Check

All implementation gates confirmed passing before committing:

- `npx vitest run`: 87 test files, 1561 passed, 1 skipped — no regressions
- `npm run check:test-types`: exit 0
- `npm run check:core-globals`: exit 0
- `npm run check:demo-types`: exit 0
- `npm run check:no-demo-style`: exit 0

Artifact existence verified:
- `grep -c '"filter-slash"' viewmodel-shell/src/icons-payload.ts` → 1
- `grep -c 'filter-slash' viewmodel-shell/src/index.ts` → 1
- `grep -c 'vms-filter-popover' viewmodel-shell/styles/default.css` → 1
- `grep -c 'filterDrafts\|popoverPortal' viewmodel-shell/src/browser.ts` → 13
- `grep -c 'filterDescriptorBinds' viewmodel-shell/src/browser.ts` → 5
- `wc -l viewmodel-shell/src/browser.ts` → 7270 (above 5800 min_lines threshold)

## Self-Check: PASSED

All artifacts present. All commits verified:
- `git log --oneline | grep 53be255` — FOUND
- `git log --oneline | grep 91669a8` — FOUND

## Commits

| Task | Commit | Message | Files |
|------|--------|---------|-------|
| 1 | 53be255 | feat(33-01): add filter-slash glyph to icon inventory + .NET enum | icons-payload.ts, index.ts, ViewModels.cs |
| 2 | 91669a8 | feat(33-01): adapter filter-row rebuild — popover + portal + icon state grammar + CSS | browser.ts, default.css |
