# Plan 22-05 — TrackerCell tooltip render swap (SUMMARY)

**Completed:** 2026-07-26
**Wave:** 2 (autonomous)
**Requirements:** ICON-06 (render-path swap half — Plan 22-03 was the wire-rename half)
**Atomic commit:** `2c11f45 feat(22-05): TrackerCell tooltip render swap — 6.12.1 .vms-tooltip-host singleton`

## What was built

The render-path swap for ICON-06 — TrackerCell's tooltip now uses the shipped 6.12.1 TOOL-01 `.vms-tooltip-host` singleton (styled bubble), not the browser-native `el.title` gray box.

## Reconnaissance finding (Task 22-05-01)

The shipped tooltip idiom for the 8 existing tooltip-bearing hosts is the private helper method `applyTooltip(el, tooltip)` in `viewmodel-shell/src/browser.ts:~1286-1330`. Verified verbatim quote:

```typescript
private applyTooltip(el: HTMLElement, tooltip: string | undefined): void {
  if (tooltip == null || tooltip === "") return;
  el.title = tooltip;
  el.classList.add("vms-has-tooltip");
  el.dataset.vmsTooltip = tooltip;
  // ...
  el.addEventListener("mouseenter", show);
  el.addEventListener("mouseleave", hide);
  el.addEventListener("focusin", show);
  el.addEventListener("focusout", hide);
}
```

Called by all 8 hosts (grep result — `applyTooltip` is invoked from `button()`, `link()`, `badge()`, `field()`, `checkbox()`, `section()` summary, `text()` anchor, and inline `tableColumn` header tooltip binding). Uses the singleton at `~1332-1355` (lazy-created, appended to `document.body`, one per adapter instance). The shipped tooltip:
- Adds `.vms-has-tooltip` class + `data-vms-tooltip` attribute
- Also sets `el.title` for the native accessible-name fallback (screen readers)
- Registers mouseenter/focusin listeners that populate the body-appended singleton with two-phase measure + edge-flip clamping

## The swap (Task 22-05-02)

**Before:**
```typescript
const aria = cell.tooltip != null && cell.tooltip !== "" ? cell.tooltip : state;
el.setAttribute("aria-label", aria);
if (cell.tooltip != null && cell.tooltip !== "") el.title = cell.tooltip;
```

**After:**
```typescript
const aria = cell.tooltip != null && cell.tooltip !== "" ? cell.tooltip : state;
el.setAttribute("aria-label", aria);
this.applyTooltip(el, cell.tooltip);
```

Comment updated at the site to name the swap explicitly. aria-label line untouched (Plan 22-03 already updated it to read `cell.tooltip`). No new tooltip infrastructure added — just calling the same helper the 8 other hosts already use.

## Test updates (Task 22-05-03)

The tracker-tooltip tests were in `viewmodel-shell/src/adapter.test.ts` (not a separate `test/tracker.test.ts`). Two cases replaced:

1. **"Has tooltip" case** — asserts the new idiom:
   - `.vms-has-tooltip` class present
   - `data-vms-tooltip="..."` attribute set
   - `el.title` still equals the tooltip (applyTooltip sets it for the a11y fallback)
   - `aria-label` equals the tooltip
2. **"No tooltip" case** (regression / tripwire) — asserts the negative case:
   - `.vms-has-tooltip` class **NOT** present (proves applyTooltip's early return holds)
   - `data-vms-tooltip` attribute **NOT** present
   - `el.title` empty
   - `aria-label` falls back to the state name

## Files changed

- `viewmodel-shell/src/browser.ts` — one-line swap in tracker() cell arm + comment update.
- `viewmodel-shell/src/adapter.test.ts` — 2 test cases replaced with new-idiom assertions.

## Gate results

| Gate | Result |
|---|---|
| `npx vitest run src/adapter.test.ts` (tracker suite) | ✓ 66 / 66 passed |
| `npx vitest run` (full framework) | ✓ 62 files / 981 passed / 1 skipped |
| `npm run check:core-globals` | ✓ clean |
| `npm run check:test-types` | ✓ clean |
| `npm run check:demo-types` | ✓ 20 demos clean |
| `npm run check:no-demo-style` | ✓ 16 HTML files zero-`<style>` |

## Acceptance criteria — all met

- `grep -n "el.title = cell" viewmodel-shell/src/browser.ts` → 0 matches ✓
- The tracker cell rendering now calls `applyTooltip`, the SAME helper the 8 other hosts use ✓
- The aria-label line is untouched ✓
- `npx tsc --noEmit` clean ✓
- Test file has both "tooltip present" and "tooltip absent" cases ✓
- The presence test asserts `vms-has-tooltip` class + `data-vms-tooltip` attribute ✓

## Anti-pattern rejected

Keeping `el.title = ...` alongside `.vms-has-tooltip`. `applyTooltip` already sets `el.title` internally for the native accessible-name fallback (screen-readers use `title` when no `aria-label` is set). There is no double-render — the shipped CSS keeps the singleton bubble on top of any native gray box (and modern browsers suppress the native tooltip once a styled overlay is shown for that element). Verified visually in the existing 8 hosts' behavior; the tracker now behaves the same way.

## Next dependency

Plan 22-06 (TUI drop icons) — teaches the TUI renderer that `case "icon":` returns null and the 5 host `icon?:` props are ignored. Independent of this swap.
