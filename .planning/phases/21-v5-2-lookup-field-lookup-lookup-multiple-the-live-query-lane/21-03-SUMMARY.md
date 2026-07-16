---
phase: 21-v5-2-lookup-field-lookup-lookup-multiple-the-live-query-lane
plan: 03
subsystem: renderer
tags: [lookup, combobox, a11y, keyboard, browser]
requires:
  - "21-01 (FieldNode.selected/candidates/searchBind/searchAction/allowCustom + LookupItem)"
provides:
  - "the lookup / lookup-multiple arm of field() in browser.ts"
  - "the D1 display path: the label is read from n.selected and ONLY from n.selected"
  - "the order-preserving popup (D12): no sort, no dedupe, no truncate"
  - "the ARIA 1.2 combobox structure (§7 items 1-7)"
  - "the §7 items 14-22 keyboard contract"
  - ".vms-field--lookup / __popup / __option styling"
  - "the lookup-multiple COMMIT (state half) — the chips render is 21-05's seam"
affects:
  - "21-04 (hangs the debounced searchAction dispatch + live region off this arm's input listener)"
  - "21-05 (fills the chips seam marked in commit())"
  - "21-08 (the verification page drives this renderer)"
tech-stack:
  added: []
  patterns:
    - "aria-activedescendant (not roving tabindex) — DOM focus stays in the input"
    - "the popup is rendered ALWAYS and hidden when closed (aria-controls must stay valid)"
key-files:
  created:
    - viewmodel-shell/test/lookup-render.test.ts
    - viewmodel-shell/test/lookup-keyboard.test.ts
  modified:
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/styles/default.css
decisions:
  - "OPEN-2 SETTLED: Tab CLOSES the popup and does NOT select. APG is silent; the failure modes are asymmetric and an accidental commit is unannounced data corruption."
  - "OPEN-5 SETTLED: REUSE FieldNode.error for search failures; the aria-invalid overload is a recorded wart, not a hidden one."
  - "NEW (the design's 'optionally clear'): Escape stage two — popup already closed — CLEARS on single-select. It is the ONLY keyboard path to un-set a lookup, because deleting the text cannot clear the id."
  - "The input's value is the query when searchBind state is non-null (INCLUDING empty string), else the selected label. undefined != \"\"."
metrics:
  duration: ~35 min
  tasks: 2
  commits: 2
  files: 4
  tests_added: 73
  completed: 2026-07-16
---

# Phase 21 Plan 03: The single-select lookup renderer Summary

The `lookup` picker renders its label from the node, presents the server's candidate ranking
untouched, and carries the full ARIA 1.2 combobox structure and keyboard contract. **The headline
proof holds: a form that loads with a reference already set renders "Sally Omer" with `candidates`
absent and no search having occurred.**

## What landed

| Task | Commit | What |
|---|---|---|
| 1 | `8163643` | The `lookup`/`lookup-multiple` arm of `field()`: the D1 display path, the D12 order-preserving popup, §7 items 1-7 ARIA, the no-seed-write rule, `[vms:lookup-no-searchbind]`, and `.vms-field--lookup/__popup/__option` CSS |
| 2 | `4bed4f1` | `test/lookup-keyboard.test.ts` — §7 items 14-22 asserted item by item |

**Tests:** 597 baseline → **670 passing, 1 skipped** (73 added: 41 render + 32 keyboard).

## Verification

- `npx tsc --noEmit` — clean.
- `npx vitest run` — **670 passed | 1 skipped**, 53 files.
- `npm run check:core-globals` — passes (all DOM work is in `browser.ts`; core untouched).

## The mandated manual review

**Zero reads of `candidates` in the selected-display path — CONFIRMED.** `n.candidates` has exactly
two code sites in `browser.ts`, both on the popup path:

| Line | Site | Verdict |
|---|---|---|
| 1319 | the popup `forEach` | the popup listbox — correct |
| 1372 | `commit()`'s pick-by-index | the user activated an option IN the popup — correct |

The display path (:1252-1277) reads `n.selected` and nothing else. **No sort/dedupe/truncate of
`candidates` anywhere in the arm** — grepping the arm for `.sort(` / `.slice(` / `.filter(` /
`new Set` returns only the *comments* explaining why they are absent.

## Decision records

### OPEN-2 — does `Tab` select the active option or abandon it? ⇒ **Tab CLOSES the popup and does NOT select**

⚠️ **APG is SILENT here** — its table only specifies where Tab *goes*, never what it does to the
active option — so this is our call, recorded rather than defaulted into.

Tab is a **navigation** key, and a navigation key must never silently commit a value. **The failure
modes are asymmetric.** Tab-abandons costs a user who wanted IDE/URL-bar accept semantics one extra
keystroke (Enter, then Tab) — and they **see** that nothing was selected. Tab-accepts silently writes
a wrong reference into a record when someone tabs past a field mid-typing, and **an accidental commit
is unannounced data corruption** — invisible to sighted users and doubly invisible to AT users. It
also matches Escape's keep-the-value semantics, so the two "get me out of here" keys behave
consistently rather than one committing and one not.

**This will generate complaints. That is accepted.** The reasoning is written at the handler
(`browser.ts`, the `Tab` arm) because the next person *will* be asked "why doesn't Tab accept like my
IDE?" and the answer must be findable at the code, not only here.

### OPEN-5 — search error state ⇒ **REUSE `FieldNode.error` for v1**

The differentiator is free and the principle is not negotiable: **react-select actively swallows
fetch errors** (`loader.then(callback, () => callback())`), making a dead backend indistinguishable
from "no results". No surveyed library has a first-class search-error state. That violates principle 8
(nothing important fails quietly), and reuse closes it at **zero wire cost** — `decorateField` already
gives a `role="alert"` region + `aria-describedby` wiring for free, and §7 item 9 reserves
`assertive` for errors, so a genuine search *failure* is a correct fit for that channel.

**The wart, recorded not hidden:** `aria-invalid="true"` lands on the combobox, which is semantically
wrong for "the server is down" (the user's input is not invalid), and it collides with a real
validation error on the same field — one `error` slot, two meanings, last writer wins. Accepted for
v1: the app owns which message it puts there, the collision needs an app to have a live search failure
*and* a pending validation error on the same field simultaneously, and **a distinct slot is purely
additive later.** Verified in this plan's tests: a lookup with `error` gets `.vms-field--error` +
`aria-invalid="true"` + `role="alert"` for free, proving the arm stayed in the `decorateField` chain.

⚠️ **Not yet wired at the type:** the plan asked for the wart to be noted in the `error` TSDoc's
lookup note. `FieldNode.error` lives in `src/index.ts` (21-01's file) and this plan's `files_modified`
does not include it. **Left for 21-04** (which touches the search lane and owns the search-error
story end to end) rather than reaching outside this plan's file scope — flagged rather than silently
skipped.

### NEW — Escape stage two: what "optionally clear" resolves to ⇒ **it clears (single-select)**

Design §7 item 18 leaves stage two explicitly *optional*, so it needed an answer rather than an
accident. **We clear, and only with the popup already closed**, where the intent is unambiguous.
Reason: **this is the only keyboard path to un-set a single-select lookup.** Deleting the input text
does *not* clear the selection — the text is the **label**, a view of the id in `bind` (D1) — so
without stage two a keyboard user who picked the wrong person could never undo it. Multi's selection
lives in chips with their own remove buttons (21-05), so there Escape clears only the query text.

### NEW — the input's value: query vs. label

`inp.value` = the `searchBind` query when that state is **non-null**, else the selected label.
Deliberately `!= null`, not truthiness: **`undefined` (no query yet) and `""` (the user cleared the
box) are different facts**, and conflating them is the same mistake OPEN-6 warns about at the dispatch
site. Both cases are asserted.

## Deviations from Plan

**1. [Process] The keyboard handler was front-loaded into Task 1's commit, so Task 2 had no RED phase.**
- **Found during:** Task 2.
- **Issue:** The plan splits structure (Task 1) from keyboard (Task 2), each `tdd="true"`. I wrote the
  `keydown` handler while building the arm, so all 32 keyboard tests passed on first run — no RED gate.
- **Remedy:** Rather than claim a TDD cycle that didn't happen, I verified the tests are load-bearing
  by **mutation**: wiring Home/End to first/last option (the "helpful fix"), clearing on
  Escape-while-open, and making Tab commit each fail **2, 3, and 2** of these tests respectively.
  `src/browser.ts` was restored byte-identical after each (`git diff --stat` empty). The commit message
  records this honestly.
- **Files:** `viewmodel-shell/test/lookup-keyboard.test.ts`.

**2. [Rule 2 - missing critical functionality] Mouse commit (click-to-pick) added.**
- **Found during:** Task 1. Not in the plan's behavior list, but a picker whose options cannot be
  clicked is broken for every mouse user. Implemented as `mousedown` + `preventDefault` (not `click`)
  so the press never blurs the input — the same reason the active option uses `aria-activedescendant`.

**3. [Rule 2] `Enter` with no active option falls through to the field's own `action`.**
- The plan's `<interfaces>` states `action` and `searchAction` are independent and a lookup may carry
  both. Without this, a lookup's `action` would be **silently dead**. Enter that *accepts* an option
  does not also fire `action` (asserted both ways).

**4. [Rule 2] The `lookup-multiple` COMMIT (state half) is implemented; the chips RENDER is the seam.**
- The plan says "leave a clearly-marked seam for the chips layer — do not half-build chips." A
  `lookup-multiple` whose Enter did nothing would be dead on arrival, so the accumulated-selection
  **state write** landed (with D12-scope commit-dedupe, commented at the site per the decision's
  instruction, plus §7 item 30's don't-close-on-select). The **chips rendering** — `role=list`/
  `listitem`, per-item "Remove {item}" buttons, roving tabindex, the focus-after-removal rule, the
  two-step Backspace — is untouched and marked `── SEAM (Plan 21-05) ──` at `commit()`.

**5. [Rule 3 - blocking] `--vms-shadow` does not exist.**
- My first popup CSS used a `--vms-shadow` token by assumption. Grep says it exists in zero themes.
  Fixed to a literal `rgba(0,0,0,0.24)`, matching the toast overlay's shadow (the house precedent for
  a floating surface) rather than inventing a token that would mean touching all 12 themes.

## 🚩 Flags for the phase — where the plan/design turned out underspecified

**1. 🚨 THE POPUP CLOSES ON EVERY RE-RENDER. 21-04 must solve this or the picker is unusable.**
This is the sharpest finding and it is **not in any plan**. Popup-open/active-option state is
DOM-local closure state, destroyed by `render()`'s `innerHTML` wipe. Today that is invisible: nothing
re-renders a lookup mid-interaction. **The moment 21-04 lands the debounced search, every keystroke
triggers a re-render ~300ms later — and the popup the user is typing into snaps shut, every time.**
The plan anticipated exactly this class of bug for focus/caret (hence the mandatory stable id, which
is in place) but **not for popup-open state**, which has no preservation pass. The `<details>`-open
snapshot (`browser.ts:146-157` + `:222-235`) is the shape-analog; `chartInstances` is the analog 21-04
already needs for the live region. **Deliberately not built here** — the cadence that makes it
necessary is 21-04's, and a preservation pass is a design decision that belongs with it, not a silent
add-on to this plan.

**2. §7 item 14's "don't auto-highlight when results arrive" is currently free — and 21-04 could
silently break it.** `activeIndex` resets to `-1` on every render, so the rule is structural rather
than remembered. But if 21-04 adds popup-open preservation (flag 1), the natural implementation would
restore the active index too — resurrecting exactly the NVDA failure item 14 exists to prevent.
Preserve *open*, not *active*.

**3. The OPEN-5 wart is not yet in the `error` TSDoc** — see the decision record above. `index.ts` is
outside this plan's file scope; 21-04 should carry it.

**4. Minor, pre-existing (not a Phase 21 regression):** 21-PATTERNS §6a already flagged that a field
carrying both `action: {name:"x"}` and `searchAction: {name:"x"}` inside one form is *accepted* by the
uniqueness rule. This plan's Enter handling makes those two genuinely distinct operations, so the
collision is now reachable in practice. Still a property of the rule, not of this arm.

## Threat Flags

None. No new network surface, auth path, file access, or schema change — the arm is a pure renderer
over server-supplied data. Server-supplied labels are set via `textContent`, never `innerHTML`
(T-21-11 mitigated); T-21-09/T-21-10/T-21-12 are each covered by named tests.

## Known Stubs

**`lookup-multiple` renders no chips** (deliberate — 21-05's plan, marked `── SEAM (Plan 21-05) ──` at
`commit()`). The state layer is correct and tested; the selection is simply not yet *visible* as chips.
Single-select — this plan's stated scope — is complete end to end.

## Self-Check: PASSED

- `viewmodel-shell/src/browser.ts` — FOUND (lookup arm at :1180-1573)
- `viewmodel-shell/styles/default.css` — FOUND (`.vms-field__popup` present)
- `viewmodel-shell/test/lookup-render.test.ts` — FOUND ("Sally Omer" present)
- `viewmodel-shell/test/lookup-keyboard.test.ts` — FOUND
- commit `8163643` — FOUND
- commit `4bed4f1` — FOUND
