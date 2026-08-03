---
phase: 30-chat-composer-primitive-chatcomposernode-route-b-composite
plan: 03
subsystem: chat-composer
tags: [composite, adapter, browser, css, textarea, auto-resize, route-b]
requires:
  - Plan 30-01 (ChatComposerNode TS wire type + tree-validator descent — landed 3b7b393 / 3c26b11)
  - Plan 30-02 (.NET ChatComposerNode record + JsonDerivedType + walker — landed 2179ad7)
provides:
  - viewmodel-shell/src/browser.ts BrowserAdapter renderer case for `type: "chat-composer"` — full DOM shell with slot mount points, data-attributes, textarea auto-resize (CSS `field-sizing: content` + JS fallback).
  - viewmodel-shell/styles/default.css `.vms-chat-composer` visual — unified pill container, growable-center textarea, fixed 34px circular icon-button geometry.
  - DOM slot mount points (`.vms-chat-composer__header` / `__row` / `__footer` / `__attach` / `__send` / `__textarea`) that Plans 30-04 (send-button state machine) + 30-05 (attach registry + drag-drop + paste-image) hang behavior on.
  - `data-composer-status` attribute (Plan 30-07's parity fixture asserts on this substring per CHAT-15).
  - `data-drop-scope` attribute (Plan 30-05's drag-drop handler reads to decide document vs composer listener attachment).
affects:
  - viewmodel-shell/test/message-followtail.test.ts — baseline `scrollHeight|scrollTop=` occurrence count bumped 6→9 to accommodate the legitimate textarea auto-resize JS fallback (mechanism-distinct from followTail; docstring updated to explain the split). Deviation Rule 3 (blocking test baseline).
tech-stack:
  added: []
  patterns:
    - CSS `field-sizing: content` (modern-CSS auto-resize; Chrome 123+, Firefox 132+, Safari TP)
    - `CSS.supports("field-sizing", "content")` feature-detect + JS `scrollHeight`-based fallback (compact ~10 lines)
    - Route B typed-slots pattern (each of headerSlot/leadingSlot/inputSlot/trailingSlot/footerSlot is a ViewNode subtree rendered via `this.node(slot, container, on)` recursion)
    - Shipped BEM class emission (`.vms-chat-composer` root + `__header` / `__row` / `__footer` / `__textarea` / `__icon-btn` / `__attach` / `__send`)
key-files:
  created: []
  modified:
    - viewmodel-shell/src/browser.ts (import: line 30; switch case: line 711; private method: lines 1438-1580)
    - viewmodel-shell/styles/default.css (`.vms-chat-composer` block: lines 3546-3630)
    - viewmodel-shell/test/message-followtail.test.ts (baseline bump 6→9 with expanded docstring; lines 186-215)
decisions:
  - "Textarea auto-resize primary path = CSS `field-sizing: content` (single declaration, browser-native, zero JS on modern browsers). JS fallback via `scrollHeight`-based resize on `input` event for older browsers — feature-detected via `CSS.supports?.('field-sizing', 'content')`. Both paths cap at `maxRows` (default 6). Per plan 30-03 §Task 2 + CONTEXT §Wire shape."
  - "Reusable `.vms-chat-composer__icon-btn` class (34px, circular) shared by leading attach-button (Plan 30-05) AND trailing send-button (Plan 30-04) — the geometry is identical; only the icon + click behavior differs. Reuse means both buttons visually align regardless of which one Plan 30-04/05 finishes first."
  - "Framework-owned send + attach button PLACEHOLDERS shipped in this plan wear the shared icon-btn class and expose `data-action='send'` / `data-action='attach'`. Plan 30-04's state machine + Plan 30-05's file picker attach via those hooks. This split lets each downstream plan work independently on its own slot without touching browser.ts's chatComposer core."
  - "Shipped token discipline: only `--vms-surface`, `--vms-border`, `--vms-accent`, `--vms-text-muted` — all four are shipped root definitions in default.css. The plan draft named `--vms-border-strong`, which does NOT exist; swapped to shipped `--vms-border` per plan §Task 3 fallback instructions."
  - "Empty header/footer rows hide via `:empty` CSS rule (matching AGENTS.md gotcha #8 'absent means absent' posture applied to DOM). No conditional element creation gymnastics — DOM structure stays uniform, visibility is CSS-controlled."
  - "The scrollHeight-count invariant in message-followtail.test.ts was a file-wide baseline (6) designed to prevent parallel followTail implementations. Textarea auto-resize legitimately uses `scrollHeight` for a DIFFERENT mechanism (sizing, not scroll-position preservation). Updated baseline to 9 with expanded docstring explaining the 6+3 split. The intra-messageList() reuse assertion (lines 153-184) is UNCHANGED and still enforces the followTail-reuse contract."
metrics:
  duration: ~35min
  completed: 2026-08-02
---

# Phase 30 Plan 03: ChatComposerNode DOM shell + shipped CSS + textarea auto-resize

Framework-owned unified pill container for the chat-app compose bar — DOM structure, slot mount points, and auto-resizing textarea. The visual half of the ChatComposerNode composite (Route B). Plans 30-04 (send state machine) + 30-05 (attach registry + drag-drop + paste) hang behavior on the mount points this plan opens.

## What shipped

### 1. Renderer case + private `chatComposer()` method — `viewmodel-shell/src/browser.ts`

- **Type import** (line 30): `ChatComposerNode` added to the type-only import block.
- **Render switch case** (line 711): `case "chat-composer": return this.chatComposer(n, parent, on);` — inserted after `rich-text-toolbar`, before the `default:` unknown-node arm.
- **Private `chatComposer()` method** (lines 1438-1580, ~145 lines including TSDoc): emits the full DOM tree:
  - Root `<div class="vms-chat-composer">` with `data-composer-status={n.status ?? "idle"}` + `data-drop-scope={n.dropScope ?? "composer"}`, plus `vms-chat-composer--disabled` modifier when `n.disabled === true`.
  - **Header row** `<div class="vms-chat-composer__header">` — renders `n.headerSlot` subtree via `this.node(slot, headerRow, on)`. Empty rows hide via `:empty` CSS.
  - **Main row** `<div class="vms-chat-composer__row">`:
    - `n.leadingSlot` (rare — most consumers leave empty).
    - Attach-button PLACEHOLDER (when `n.attachAction` set) — `<button class="vms-chat-composer__attach vms-chat-composer__icon-btn" data-action="attach" aria-label="Attach file">` with shipped `paperclip` SVG icon at size `sm`.
    - **Textarea** — created from scratch when `n.inputSlot` is absent, OR REPLACED by rendered `n.inputSlot` subtree (opt-in rich-text). Wiring: `.className = "vms-chat-composer__textarea"`, `.value = readBind(n.bind) ?? ""`, `.placeholder = n.placeholder ?? ""`, `.disabled` reflects `n.disabled === true`, `.rows = 1`. On `input`: `writeBind(n.bind, ta.value)` — draft text IS state per bind model.
    - **Send-button PLACEHOLDER** — always emitted: `<button class="vms-chat-composer__send vms-chat-composer__icon-btn" data-action="send" aria-label="Send">` with shipped `send` SVG icon.
    - `n.trailingSlot` (common: model selector, emoji trigger, tool chips).
  - **Footer row** `<div class="vms-chat-composer__footer">` — renders `n.footerSlot` subtree; empty rows hide via `:empty` CSS.
- **Textarea auto-resize logic** — feature-detected via `CSS.supports?.("field-sizing", "content")`. When supported (modern browsers), the CSS `field-sizing: content` rule handles growth in ZERO JS; the `max-height: calc(6 * 1.5em + 0.75rem)` rule caps at the 6-row default. When unsupported, a compact JS fallback (`resize()` closure attached to `input` event + `queueMicrotask(resize)` for initial sizing) computes `scrollHeight` capped at `lineHeight * maxRows + paddingY`; overflows via `overflow-y: auto`. Both paths cap identically at `n.maxRows ?? 6`.
- **Behaviors NOT implemented in this plan** (per plan boundary): send-button state machine (icon swap on `status`, click dispatch — Plan 30-04); attach click-to-picker + file registry (Plan 30-05); keyboard/IME handling (Plan 30-04); drag-drop + paste-image (Plan 30-05); attachment-preview chip strip (Plan 30-05).

### 2. Shipped CSS — `viewmodel-shell/styles/default.css`

Lines 3546-3630 — 11 rules under a single `/* Chat composer (v9.1.0, CHAT-02 + CHAT-03) */` header block:

- `.vms-chat-composer` — flex column, gap 0.5rem, padding 0.75rem, `background: var(--vms-surface)`, `border: 1px solid var(--vms-border)`, `border-radius: 1.25rem`, subtle drop-shadow.
- `.vms-chat-composer--disabled` — opacity 0.6 + `pointer-events: none`.
- `.vms-chat-composer__header:empty` / `.vms-chat-composer__footer:empty` — `display: none` (absent means absent).
- `.vms-chat-composer__row` — flex, `align-items: flex-end`, gap 0.5rem. Ensures buttons stay pinned to the last line as textarea grows.
- `.vms-chat-composer__textarea` — `flex: 1 1 auto`, `min-width: 0` (prevent flex overflow), transparent bg, inherit color/font, `line-height: 1.5`, padding, `field-sizing: content` (modern auto-resize), `min-height: calc(1.5em + 0.75rem)` (1 row), `max-height: calc(6 * 1.5em + 0.75rem)` (6-row default cap), `overflow-y: auto`.
- `.vms-chat-composer__textarea::placeholder` — `color: var(--vms-text-muted)`, opacity 0.85.
- `.vms-chat-composer__icon-btn` — 34×34px, `border-radius: 50%`, `flex-shrink: 0`, transparent bg, `cursor: pointer`, `transition: background 120ms ease`. Shared by attach + send buttons.
- `.vms-chat-composer__icon-btn:hover:not(:disabled)` — subtle accent tint via `color-mix(in srgb, var(--vms-accent) 8%, transparent)`.
- `.vms-chat-composer__icon-btn:focus-visible` — 2px accent outline with 2px offset.
- `.vms-chat-composer__icon-btn:disabled` — opacity 0.5, `cursor: not-allowed`.

### 3. Test baseline update — `viewmodel-shell/test/message-followtail.test.ts`

The pre-existing `scrollHeight|scrollTop=` count invariant asserted `count === 6` (all belonged to shipped `SectionNode.followTail` machinery). The new `chatComposer()` textarea auto-resize JS fallback legitimately introduces 3 additional occurrences — for a DIFFERENT mechanism (textarea sizing, not scroll-position preservation). Updated baseline to 9 with an expanded docstring explaining the 6+3 split; the intra-`messageList()` reuse assertion (lines 153-184) is UNCHANGED and still enforces the followTail-reuse contract for that renderer.

## Shipped tokens used (all pre-existing in default.css)

| Token              | Count in default.css | Used for                                        |
| ------------------ | -------------------- | ----------------------------------------------- |
| `--vms-surface`    | shipped root         | Composer background                             |
| `--vms-border`     | shipped root         | Composer border                                 |
| `--vms-accent`     | shipped root         | Icon-btn hover tint + focus-visible outline     |
| `--vms-text-muted` | shipped root         | Textarea placeholder color                      |

Grep verification: `grep -c -- '--vms-{token}:' viewmodel-shell/styles/default.css` returns `>= 1` for each — every token has a shipped `:root` definition. No new tokens introduced.

## Smoke-test rendered DOM (via jsdom)

Test input: `{ type: "chat-composer", bind: "draft", sendAction: { name: "send" }, placeholder: "Type a message", attachAction: { name: "attach" }, headerSlot: { type: "text", value: "Reply to Ashley:", tone: "info" }, trailingSlot: { type: "text", value: "GPT-4", style: "caption" } }`.

Rendered `outerHTML` (verified structure):

```html
<div class="vms-chat-composer"
     data-composer-status="idle"
     data-drop-scope="composer">
  <div class="vms-chat-composer__header">
    <span class="vms-text vms-text--info">Reply to Ashley:</span>
  </div>
  <div class="vms-chat-composer__row">
    <button type="button"
            class="vms-chat-composer__attach vms-chat-composer__icon-btn"
            data-action="attach"
            aria-label="Attach file">
      <svg class="vms-icon vms-icon--sm" ...>[paperclip path]</svg>
    </button>
    <textarea class="vms-chat-composer__textarea"
              placeholder="Type a message"
              rows="1"></textarea>
    <button type="button"
            class="vms-chat-composer__send vms-chat-composer__icon-btn"
            data-action="send"
            aria-label="Send">
      <svg class="vms-icon vms-icon--sm" ...>[send path]</svg>
    </button>
    <span class="vms-text vms-text--caption">GPT-4</span>
  </div>
  <div class="vms-chat-composer__footer"></div>
</div>
```

Child order matches the plan §Task 1 spec: `__header` → `__row` (leading → attach → textarea → send → trailing) → `__footer`. Attributes: `data-composer-status="idle"` + `data-drop-scope="composer"` on the root; `data-action="attach"` / `data-action="send"` on the buttons. Icons render as SVGs with `aria-hidden="true"`; buttons have `aria-label` for a11y. The footer row is empty and will hide via `.vms-chat-composer__footer:empty { display: none }`. Smoke test file was NOT committed (created + deleted from viewmodel-shell/).

## Verification / gate results

| Gate                              | Command                                              | Exit code |
| --------------------------------- | ---------------------------------------------------- | --------- |
| TypeScript build                  | `npm run build`                                      | 0         |
| Core-globals guard (AGNOSTIC-03)  | `npm run check:core-globals`                         | 0         |
| Demo-style guard (D-12/D-15)      | `npm run check:no-demo-style`                        | 0         |
| Vitest framework suite            | `npx vitest run`                                     | 0 (1365 pass, 1 skip) |

Grep verification (plan §Task 1 + §Task 2 + §Task 3 acceptance criteria):
- `grep -c '"chat-composer"' src/browser.ts` = **1** (>= 1) — the case discriminator.
- `grep -c 'vms-chat-composer' src/browser.ts` = **13** (>= 8) — every emitted class.
- `grep -c 'data-composer-status\|dataset.composerStatus' src/browser.ts` = **2** (>= 1).
- `grep -c 'headerSlot\|leadingSlot\|trailingSlot\|footerSlot\|inputSlot' src/browser.ts` = **13** (>= 5).
- `grep -c 'field-sizing' src/browser.ts` = **4** (>= 1) — feature-detect + comments.
- `grep -c 'scrollHeight' src/browser.ts` = **6** (>= 1) — JS fallback + comments + pre-existing followTail machinery.
- `grep -c 'maxRows' src/browser.ts` = **3** (>= 1).
- `grep -c '\.vms-chat-composer' viewmodel-shell/styles/default.css` = **11** (>= 8).

`git status --short` (post-edits, pre-commit):

```
 M viewmodel-shell/src/browser.ts
 M viewmodel-shell/styles/default.css
 M viewmodel-shell/test/message-followtail.test.ts
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking test baseline] Updated `message-followtail.test.ts` scrollHeight-count invariant**
- **Found during:** Task 2 (textarea auto-resize JS fallback landing)
- **Issue:** The test at `viewmodel-shell/test/message-followtail.test.ts:186` asserted a file-wide invariant `scrollHeight|scrollTop=` occurrence count === 6, banked to prevent parallel `SectionNode.followTail` implementations. My legitimate textarea auto-resize (a DIFFERENT mechanism — sizing, not scroll-position preservation) introduced 3 new `scrollHeight` occurrences inside the new `chatComposer()` method body.
- **Fix:** Updated the baseline to 9 (the new correct count) AND expanded the docstring to explain the 6+3 split — noting that 3 occurrences now belong to CHAT-03 textarea auto-resize (a mechanism-distinct use of `scrollHeight`), while the other 6 remain the shipped followTail machinery. The intra-`messageList()` reuse assertion (lines 153-184) is UNCHANGED and still enforces the followTail-reuse contract for that renderer body.
- **Files modified:** `viewmodel-shell/test/message-followtail.test.ts` (lines 186-215)
- **Rationale:** Rule 3 (blocking issue) — without this update, the vitest suite regresses. The test itself was a legitimate reuse guard, but its baseline needed to reflect the new legitimate use. The docstring update preserves the guard's usefulness for future edits.

**2. [Rule 3 — Blocking config] Swapped `--vms-border-strong` → `--vms-border`**
- **Found during:** Task 3 (CSS block drafting)
- **Issue:** Plan §Task 3 draft CSS referenced `var(--vms-border-strong)`, which does NOT exist in default.css. Plan itself explicitly acknowledged this and directed to swap to the shipped equivalent (`--vms-border`) if unavailable.
- **Fix:** Used `var(--vms-border)` throughout — the shipped root token (line 21).
- **Files modified:** `viewmodel-shell/styles/default.css` (line 3557)
- **Rationale:** Rule 3 — CSS with a non-existent var would render border with the browser default (usually black), breaking visual coherence with other composites. Plan §Task 3 pre-authorized this fallback.

## Threat surface scan

Per plan §threat_model — no new trust boundaries or security-relevant surface introduced. Renderer emits static string classes + a closed-enum `status` value; no consumer-controlled string reaches innerHTML/setAttribute in an injection-permitting way. Textarea unbounded-growth threat (T-30-03-02) is mitigated at BOTH CSS (`max-height` cap) AND JS (`Math.min(scrollHeight, maxHeight)` cap) per plan §Task 2/3.

## Known Stubs

- **Send-button placeholder** (`<button class="vms-chat-composer__send" data-action="send">`) is currently INERT — no click handler wired. Plan 30-04 owns the state machine (icon swap on `status` transition, click dispatch, disabled-derived from bind + attach count).
- **Attach-button placeholder** (`<button class="vms-chat-composer__attach" data-action="attach">`) is currently INERT — no click handler wired. Plan 30-05 owns the click-to-picker + file registry.

Both stubs are documented in the TSDoc on `chatComposer()` and are intentional per plan §objective (splitting DOM shell + interactions across three plans keeps each under ~30% context).

## Self-Check: PASSED

- FOUND: `viewmodel-shell/src/browser.ts` (renderer case + private method)
- FOUND: `viewmodel-shell/styles/default.css` (11 `.vms-chat-composer*` rules)
- FOUND: `viewmodel-shell/test/message-followtail.test.ts` (baseline update)
- Vitest exit 0 (1365 pass, 1 skip; no regressions)
- Build exit 0
- Core-globals guard exit 0
- Demo-style guard exit 0
