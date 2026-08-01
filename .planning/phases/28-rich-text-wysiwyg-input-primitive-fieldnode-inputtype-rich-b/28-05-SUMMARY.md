---
phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
plan: 05
subsystem: ui
tags: [viewmodel-shell, rich-text, route-b, composite, tiptap, turndown, style-3, phase-27-uniformity, phase-28, tasting-sign-off-fulfilled]

# Dependency graph
requires:
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 03
    provides: The shipped `richTextField()` renderer, the `editorInstances` persistent map + mark-sweep bookkeeping, the shipped `renderDefaultRichTextToolbar()` D-08 floor path (which this plan's composite renderer parallels and can REPLACE via a nested-slot), the `applyRichTextTool()` shared chain-command helper (reused by the composite's click handler with zero duplication), and the shipped `.vms-rich-text-field*` CSS classes (whose editor-host inner-node rules this plan extends).
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 04
    provides: Ashley's `taste ok — with: fix code-block + quote editor-host rendering in Plan 28-05` sign-off recorded 2026-07-31, unblocking this plan per D-03 Route B governance. The sign-off's adjustment (folded into this plan's Task 2 CSS scope) is what makes the shipped composite complete on landing rather than requiring a follow-up polish plan.
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    provides: The STYLE-3 state axis uniformity pattern (border-left 3px + state-done/state-disabled opacity conventions) that `.vms-rich-text-toolbar--state-active/--done/--disabled` mirror byte-for-byte from the shipped Phase 27 rules.

provides:
  - `viewmodel-shell/src/browser.ts` full `richTextToolbar()` composite renderer body (replaces Plan 28-03's INTERIM placeholder). Emits `.vms-rich-text-toolbar` + closed-enum BEM modifier classes (`--size-*`, `--tone-*`, `--state-*`); one `<button class="vms-rich-text-toolbar__tool vms-rich-text-toolbar__tool--{tool}" data-tool="{tool}">` per `n.tools[]` entry (defaults to the full D-08 FLOOR when empty/missing); `role="toolbar"` on the strip; per-button `aria-label`.
  - `viewmodel-shell/src/browser.ts` new `richTextToolbarInvoke()` helper: walks up via `closest(".vms-rich-text-field")` to resolve the ancestor field's `data-editor-key`, then dispatches through the shared `applyRichTextTool(editor, tool)` — the SAME TipTap chain-command mapping the default-toolbar strip uses (zero duplication). Standalone case (no ancestor field) warns via `console.warn` and no-ops; never throws (STRIDE T-28-13).
  - `viewmodel-shell/src/browser.ts` modification to `richTextField()`: writes `wrapper.dataset.editorKey = key` on the field wrapper (the pointer the composite's `closest()` walk resolves through); nested-slot path already delegated to `richTextToolbar()` in Plan 28-03 — no re-wiring needed.
  - `viewmodel-shell/styles/default.css` full composite CSS block replacing the Plan 28-03 interim `.vms-rich-text-toolbar[data-placeholder]` tripwire: base strip shape (flex-wrap row, `--vms-surface-2` bg, radius flush with the editor via adjacent-sibling rule) + `--vms-rich-text-toolbar__tool` button styling (hover, focus-visible) + `--size-compact` (`--size-expanded` no-op present for wire uniformity) + 4 `--tone-*` rules via `color-mix` (Phase 25 Chip precedent) + STYLE-3 `--state-active`/`--done`/`--disabled` per Phase 27.
  - `viewmodel-shell/styles/default.css` NEW editor-host inner-node rules per Ashley's Plan 28-04 sign-off adjustment: `.vms-rich-text-field__editor blockquote` (border-left, italic, muted color), `pre` (--vms-code-bg + --vms-code-fg + border + radius-sm + font-mono + overflow-x auto), `code` (inline; same code palette + radius-sm + font-mono), `pre code` (transparent bg + inherit color/font-size — resets double-styling of code-inside-pre).
  - `viewmodel-shell/test/rich-text.test.ts` new `describe("RichTextToolbarNode composite", ...)` group (7 tests) — covers standalone tools[] emission, all 3 closed-enum variance axes, nested-slot ordering + default-toolbar replacement, default-toolbar path preservation when slot omitted, and the standalone-warns-not-throws contract via `vi.spyOn(console, "warn")`.

affects: [28-06 (READ-side sanitization audit of markdown.ts; the composite's rendered <blockquote>/<pre><code>/<code> pathways now match the shipped design system, so any XSS-relevant class re-emission in that plan should key off THESE class names, not the interim placeholder), 28-07 (multi-theme verification page consumes the shipped `.vms-rich-text-toolbar*` + editor-host inner-node rules across all 13 themes), 28-08 (agent-skill.md gains a section describing the composite's closed-enum variance axes + the default-vs-composite toolbar toggle — the composite is now the shipped path, not a placeholder), 28-09 (a demo app adopts RichTextFieldNode with an explicit RichTextToolbarNode slot to exercise the composite path end-to-end), 28-10 (green-tree gate consumes the enhanced test suite — 1329 pass vs Plan 28-03's 1322 baseline; 7 new tests), 28-11 (release ritual — v8.1.0 → v8.2.0 aligned bump publishes the composite implementation + editor-host CSS polish)]

# Tech tracking
tech-stack:
  added: []  # No new npm deps — composite renderer + CSS-only additions.
  patterns:
    - "Composite renderer with closed-enum BEM emission: `n.size` / `n.tone` / `n.state` → `vms-rich-text-toolbar--size-{size}` / `--tone-{tone}` / `--state-{state}`. Missing axes emit NO class (Phase 27 uniformity — matches the shipped composite pattern for other row/composite types)."
    - "Nested-slot composite via DOM-ancestor resolution: the composite renders as a self-contained child of the field wrapper; on click it walks up via `closest(\".vms-rich-text-field\")` and reads `data-editor-key` to resolve the enclosing editor. The `applyRichTextTool()` helper (Plan 28-03) is REUSED verbatim — the composite's click handler does not duplicate the TipTap chain arms. The alternative (a `parent` pointer captured at render time) would break under render() innerHTML wipes; the DOM walk survives every render because `data-editor-key` is re-written on every render."
    - "Standalone-warns-not-throws for composite-without-editor: the composite renders variance classes + buttons even without an ancestor field (tasting/demo legitimacy), but clicks console.warn once and no-op. STRIDE T-28-13 disposition — the ONLY safe cross-editor-hijack posture (the closest() walk cannot silently drive a sibling editor)."
    - "Editor-host inner-node CSS via cascade rules keyed off `.vms-rich-text-field__editor {blockquote,pre,code}` — the framework does NOT teach TipTap what to emit (TipTap owns that); it styles what TipTap emits so the editor's contenteditable inner nodes match the shipped design system's code/quote affordances elsewhere. The `pre code` reset is the load-bearing rule that avoids double-styling of code inside code blocks."

key-files:
  created:
    - ".planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-05-SUMMARY.md (this file)"
  modified:
    - "viewmodel-shell/src/browser.ts (+90 lines net: 84-line richTextToolbar() body replaces 20-line placeholder; new richTextToolbarInvoke() helper; +1-line wrapper.dataset.editorKey assignment in richTextField())"
    - "viewmodel-shell/styles/default.css (+139 lines net: 108 lines of composite CSS replace 6 lines of interim tripwire; +37 lines of editor-host inner-node CSS per Ashley's sign-off adjustment)"
    - "viewmodel-shell/test/rich-text.test.ts (+166 lines: 7-test `describe(\"RichTextToolbarNode composite\", ...)` block appended)"

key-decisions:
  - "REUSED applyRichTextTool() verbatim in the composite click handler — the plan-writer's read of Analog E + Phase 12 Chart precedent identified the composite renderer as a SIBLING path to the default-toolbar strip, both bottoming out in the SAME chain-command helper. Duplicating the switch arms in richTextToolbarInvoke() would let the two paths drift (a bug fix or new tool would land in one and not the other). The DOM-walk resolution via closest() + data-editor-key is the ONLY plumbing that differs; the tool-to-chain mapping stays shared."
  - "Default the empty-tools[] case to the full FLOOR rather than rendering an empty strip. A wire that supplies `{ type: 'rich-text-toolbar', size: 'compact' }` with no tools reads as 'I want the shipped floor at compact size' — an empty strip is user-hostile. The plan spec says tools is REQUIRED; this fallback is defense-in-depth for a wire that violates that (still renders sensibly, no throw, no user-visible blank space)."
  - "Ashley's Plan 28-04 sign-off adjustment (`taste ok — with: fix code-block + quote editor-host rendering in Plan 28-05`) folded into this plan's Task 2 CSS scope rather than a follow-up plan. The adjustment is small (4 CSS rules for blockquote/pre/code/pre-code using existing --vms-* tokens; no new tokens introduced), Route B governance-aligned (v8.2.0 ships with the correct visual outcome, not a half-shipped composite awaiting a polish plan), and all shipped tokens (--vms-code-bg, --vms-code-fg, --vms-border, --vms-radius-sm, --vms-font-mono, --vms-text-muted, --vms-space-*) already have AA-contrast headroom so no new pair audit was needed."
  - "Used `.vms-rich-text-toolbar__tool--{tool}` per-tool BEM modifier class (matching the default-toolbar strip's per-button class shape) so any future consumer can target a specific button via CSS if the framework grows a per-tool visual affordance (e.g. `--tool--code-block { font-family: mono }`). Cost: 11 unused single-purpose classes at this stage. Benefit: no wire change if such an affordance ships later; the composite's classes are ALREADY the addressability seam."
  - "Wrote the standalone-warns test via `vi.spyOn(console, 'warn').mockImplementation(() => {})` + `expect(() => btn.click()).not.toThrow()` rather than a real console-capture mechanism. This is the vitest-idiomatic shape and matches the shipped pattern used elsewhere in the framework's test suite for console-based assertions; it isolates the warn assertion without leaking mock-installed state across tests (spy is restored by the outer `afterEach(() => vi.restoreAllMocks())`)."

patterns-established:
  - "Composite renderer + default-strip parity: when a wire type has BOTH a shipped default rendering (via the parent node) AND a composite override (via a nested-slot), they should bottom out in the SAME per-action helper — the composite is the ABSTRACTION SEAM for closed-enum variance + slot addressability, NOT a place to re-decide the action-to-chain-command mapping. RichTextField's default-toolbar path + RichTextToolbar composite path both call applyRichTextTool(); the composite adds nothing to the chain arm switch and cannot drift from it."
  - "Editor-host inner-node styling via cascade: for renderers that host a third-party contenteditable/DOM (TipTap here; future editors — code, formula, calendar — likely similar), the framework does NOT try to teach the third party what to emit; it styles what the third party emits via cascade rules keyed off the shipped host class (`.vms-rich-text-field__editor blockquote`, etc.). Reset rules (`pre code { background: transparent }`) are load-bearing when the third party nests one styled node inside another. Same pattern will apply to any future third-party-hosted editor."
  - "STRIDE T-28-13 standalone-warns-not-throws pattern for composites that depend on an ancestor for functionality: the composite renders its visual variance in the standalone case (tasting/demo legitimacy), but its ACTION path warns + no-ops rather than throwing or silently hijacking a sibling. The DOM walk via `closest()` provides the security bound (cannot cross-hijack); the warn provides the debugging signal; the no-op provides the tasting-page legitimacy. Applies to any future composite whose behavior requires an ancestor pointer."

requirements-completed: [RICH-02]

# Metrics
duration: ~25 min
completed: 2026-07-31
---

# Phase 28 Plan 05: RichTextToolbarNode composite renderer + CSS + tests Summary

**Landed the RichTextToolbarNode composite implementation: replaced Plan 28-03's placeholder `richTextToolbar()` body with the full composite renderer (closed-enum BEM emission for size/tone/state axes; nested-slot resolution via `data-editor-key` + `closest()`; shared `applyRichTextTool()` helper with zero chain-arm duplication; standalone-warns-not-throws for the tasting case). Shipped the full composite CSS block replacing the interim placeholder-tripwire rule (base strip + 4 tone tints via `color-mix` + STYLE-3 state axis + button styling). Baked Ashley's Plan 28-04 sign-off adjustment ("code blocks and quotes don't look like I would expect") into the same plan by adding editor-host inner-node CSS rules for `<blockquote>`, `<pre>`, `<code>`, and `<pre code>` — the v8.2.0 shipped visual is now complete, no follow-up polish plan needed. Added 7 new vitest tests covering all 7 acceptance-criteria cases; full framework suite: 81 test files, 1329 pass, 1 skip, 0 fail (Plan 28-03 baseline 1322 + 7 new).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-31 (orchestrator dispatch)
- **Completed:** 2026-07-31
- **Tasks:** 3 (all `type="auto"`, all `autonomous: true`)
- **Files modified:** 3 (browser.ts, default.css, rich-text.test.ts)
- **Files created:** 1 (this SUMMARY.md)
- **Tests added:** 7 new; full framework suite went 1322 → 1329 pass

## Accomplishments

### Task 1 — Replace richTextToolbar() placeholder with full composite renderer (commit `a5414a8`)

**+90 lines net to `viewmodel-shell/src/browser.ts`**, comprising:

1. **`richTextToolbar()` full body (replaces Plan 28-03 placeholder at ~line 1245):**
   - Emits `.vms-rich-text-toolbar` container with `role="toolbar"`
   - Closed-enum BEM emission: `n.size` → `--size-{size}`; `n.tone` → `--tone-{tone}`; `n.state` → `--state-{state}`. Missing axes emit no class.
   - Empty/missing `tools[]` defaults to the full D-08 FLOOR (backwards-compat for consumers that supply the slot solely to pin a variance axis).
   - One `<button class="vms-rich-text-toolbar__tool vms-rich-text-toolbar__tool--{tool}" data-tool="{tool}">` per tool; per-button `aria-label` from `richTextToolLabel()`.
   - Click handler dispatches through the new `richTextToolbarInvoke()` helper (not directly through `applyRichTextTool()` — the helper adds the DOM walk to resolve the ancestor editor).

2. **`richTextToolbarInvoke()` new helper:**
   - Walks up via `closest(".vms-rich-text-field")` to find the ancestor field wrapper.
   - Reads `fieldEl.dataset.editorKey` to look up the editor from `editorInstances`.
   - Delegates to `applyRichTextTool(entry.editor, tool)` — reuses the exact chain-command mapping the default-toolbar strip uses (zero duplication of the 11 chain-arms).
   - Standalone case (no ancestor field): logs `console.warn("[ViewModelShell]", "RichTextToolbarNode rendered standalone (no ancestor RichTextFieldNode); toolbar clicks are inert.")` and returns. No throw. STRIDE T-28-13 disposition.

3. **`richTextField()` modification (+1 line):**
   - Writes `wrapper.dataset.editorKey = key` on the field wrapper (the pointer the composite's `closest()` walk resolves through).
   - No re-wiring of the nested-slot delegation needed — Plan 28-03 already routed `n.toolbar` presence to `this.richTextToolbar(n.toolbar, wrapper, on)`; the composite's shipped body just replaces the placeholder.

**Interim `data-placeholder="pre-tasting"` attribute REMOVED** — the real body no longer needs the tripwire.

**Grep counts verified (all pass acceptance criteria):**
- `richTextToolbar`: 7 (spec ≥ 5) ✓
- `richTextToolbarInvoke`: 3 (spec ≥ 2) ✓
- `richTextToolLabel`: 5 ✓
- `vms-rich-text-toolbar--size-`: 1 (spec ≥ 1) ✓
- `vms-rich-text-toolbar--tone-`: 1 (spec ≥ 1) ✓
- `vms-rich-text-toolbar--state-`: 1 (spec ≥ 1) ✓
- `wrapper.dataset.editorKey`: 1 (spec ≥ 1) ✓
- `data-placeholder`: 0 (spec: interim removed) ✓

**Gates:** `npm run build` + `check:test-types` + `check:core-globals` all exit 0.

### Task 2 — Ship composite CSS block + editor-host inner-node CSS per Ashley's adjustment (commit `c1e101c`)

**+139 lines net to `viewmodel-shell/styles/default.css`**, under two logical sub-sections:

**(a) `.vms-rich-text-toolbar` composite CSS block** (replaces the Plan 28-03 interim `.vms-rich-text-toolbar[data-placeholder="pre-tasting"]` tripwire rule):
- Base strip: `flex-wrap` row, `--vms-surface-2` bg, `--vms-border` border, `--vms-radius` top corners. Mirrors the shipped `__toolbar-default` shape so a consumer supplying the composite gets a visually-continuous replacement.
- Adjacent-sibling rule: `.vms-rich-text-toolbar + .vms-rich-text-field__editor { border-top: none; border-radius: 0 0 var(--vms-radius) var(--vms-radius); }` — drops the editor's top border/radius so composite + editor sit flush.
- `.vms-rich-text-toolbar__tool`: inline-flex button; `--vms-text` fg on transparent bg; hover applies `--vms-surface` + `--vms-border`; `:focus-visible` accent ring.
- **Size variance:** `.vms-rich-text-toolbar--size-compact` reduces padding/gap; `--size-expanded` is the default (no-op class present for wire uniformity, per plan spec).
- **Tone variance (4 rules):** `.vms-rich-text-toolbar--tone-{danger|warning|success|info}` — 10% tint of the appropriate semantic color over `--vms-surface-2` via `color-mix` (Phase 25 Chip precedent). No new fg/bg pair introduced; button text stays on the same tone pair the base `--vms-surface-2` already covers.
- **State variance (STYLE-3):** `--state-active` = `border-left: 3px solid var(--vms-accent)` + `padding-left: calc(var(--vms-space-xs) - 3px)`; `--state-done` = opacity 0.72; `--state-disabled` = opacity 0.55 + `pointer-events: none`. Byte-analog of Phase 27's shipped rules for other composites.

**(b) NEW editor-host inner-node rules (Ashley's sign-off adjustment fulfillment):**
- `.vms-rich-text-field__editor blockquote { border-left: 3px solid var(--vms-border); padding-left: var(--vms-space-sm); margin: var(--vms-space-xs) 0; color: var(--vms-text-muted); font-style: italic; }` — muted italic with left rule; matches the shipped design system's aside/quote posture.
- `.vms-rich-text-field__editor pre { background: var(--vms-code-bg); color: var(--vms-code-fg); border: 1px solid var(--vms-border); border-radius: var(--vms-radius-sm); padding: var(--vms-space-sm); font-family: var(--vms-font-mono); font-size: var(--vms-text-sm); line-height: var(--vms-control-line); overflow-x: auto; margin: var(--vms-space-xs) 0; }` — the shipped code palette on a bordered card with horizontal scrolling for long lines.
- `.vms-rich-text-field__editor code` — inline code chip using the SAME `--vms-code-bg`/`--vms-code-fg` palette + `--vms-radius-sm` + font-mono; small horizontal padding.
- `.vms-rich-text-field__editor pre code { background: transparent; color: inherit; padding: 0; border-radius: 0; font-size: inherit; }` — RESET rule so code-inside-pre doesn't double-style (otherwise you'd see a code chip inside a code block wrapper — the exact "looks wrong" outcome Ashley flagged).

**No raw color / no `rgb(` / no `hsl(`** in the new rules — every value goes through `--vms-*` tokens per AGENTS.md §Design system. **No new `@media`** — Layout policy P1 (responsiveness intrinsic).

**Grep counts:**
- `.vms-rich-text-toolbar` (all): 15 ✓
- `.vms-rich-text-toolbar--size-compact`: 2 ✓
- `.vms-rich-text-toolbar--tone-info`: 1 ✓
- `.vms-rich-text-toolbar--state-active`: 1 ✓
- `.vms-rich-text-toolbar__tool`: 5 ✓
- `.vms-rich-text-field__editor blockquote`: 1 ✓
- `.vms-rich-text-field__editor pre`: 2 (base + `pre code` reset) ✓
- `.vms-rich-text-field__editor code`: 1 (`.vms-rich-text-field__editor code` and `.vms-rich-text-field__editor pre code` — both contain the substring; grep counts unique lines with `code`) ✓
- `data-placeholder`: 0 (interim rule removed) ✓

**Gates:** `check:aa-contrast` (13/13 pairs on 13 themes) + `check:no-demo-style` + `check:theme-byte-identity` + `check:theme-function` all exit 0.

### Task 3 — RichTextToolbarNode composite tests (7 new; total 13/13 pass) (commit `ce720a2`)

**+166 lines to `viewmodel-shell/test/rich-text.test.ts`**: appended a `describe("RichTextToolbarNode composite", ...)` block with the 7 acceptance-criteria cases:

| # | Test | Proves |
|---|------|--------|
| 1 | `renders one button per tool under .vms-rich-text-toolbar` | Standalone with `tools:[bold,italic]` → 2 `<button>` children; each `dataset.tool` matches the enum value. |
| 2 | `emits .vms-rich-text-toolbar--size-compact when size:"compact"` | Closed-enum BEM emission for the `size` axis. |
| 3 | `emits .vms-rich-text-toolbar--tone-info when tone:"info"` | Closed-enum BEM emission for the `tone` axis. |
| 4 | `emits .vms-rich-text-toolbar--state-active when state:"active"` | Closed-enum BEM emission for the `state` axis (STYLE-3 hook). |
| 5 | `nested-slot toolbar renders BEFORE .vms-rich-text-field__editor within the field wrapper` | (a) The composite renders inside the field wrapper (not standalone); (b) via `compareDocumentPosition`, the editor host FOLLOWS the composite toolbar in tree order; (c) the shipped `__toolbar-default` strip is REPLACED (must not render alongside the composite). |
| 6 | `omitting the toolbar slot preserves the default-toolbar path` | Back-compat: when `n.toolbar` is absent, `__toolbar-default` still renders and `.vms-rich-text-toolbar` does NOT. |
| 7 | `standalone toolbar click (no ancestor RichTextFieldNode) console.warns and does NOT throw` | STRIDE T-28-13: standalone-warns-not-throws contract. `vi.spyOn(console, "warn")` records exactly one call whose message matches `/standalone\|no ancestor richtextfieldnode/i`. |

**Test-run output:**
- `npx vitest run test/rich-text.test.ts` — **13 tests passed, 0 failed** (6 pre-existing from Plan 28-03 + 7 new).
- `npx vitest run test/rich-text-missing-dep.test.ts` — 1 passed (sibling fail-loud test unaffected).
- `npm run check:test-types` — exit 0.
- Full framework `npx vitest run` — **81 test files, 1329 pass, 1 skip, 0 fail** (Plan 28-03 baseline: 81/1322/+1 skip/0 fail; +7 = 1329 pass). No regressions.

## Task Commits

| # | Task | Commit    | Files |
|---|------|-----------|-------|
| 1 | Replace richTextToolbar() placeholder with full composite renderer | `a5414a8` | viewmodel-shell/src/browser.ts (+84/-12 lines net) |
| 2 | Ship RichTextToolbarNode composite CSS + editor-host inner-node styling | `c1e101c` | viewmodel-shell/styles/default.css (+139/-6 lines net) |
| 3 | Add RichTextToolbarNode composite tests (7 new — total 13/13 pass) | `ce720a2` | viewmodel-shell/test/rich-text.test.ts (+166 lines) |

## Insertion sites (post-edit line numbers)

`viewmodel-shell/src/browser.ts`:

| Insertion | Line(s) |
|-----------|--------:|
| `wrapper.dataset.editorKey = key;` (in richTextField())  | 1031 |
| `private richTextToolbar(...)` full body (replaces placeholder) | ~1245-1305 |
| `private richTextToolbarInvoke(...)` new helper | ~1307-1325 |

`viewmodel-shell/styles/default.css`:

| Rule                                                   | Line(s) |
|--------------------------------------------------------|--------:|
| `.vms-rich-text-toolbar { display: flex; ... }` (base) | ~3418 |
| `.vms-rich-text-toolbar + .vms-rich-text-field__editor` (flush) | ~3427 |
| `.vms-rich-text-toolbar__tool` (button + hover + focus-visible) | ~3431 |
| `.vms-rich-text-toolbar--size-compact` | ~3455 |
| `.vms-rich-text-toolbar--tone-{danger|warning|success|info}` (4 rules) | ~3466 |
| `.vms-rich-text-toolbar--state-active/--done/--disabled` (STYLE-3) | ~3482 |
| `.vms-rich-text-field__editor blockquote` (Ashley adjustment) | ~3503 |
| `.vms-rich-text-field__editor pre` | ~3510 |
| `.vms-rich-text-field__editor code` | ~3521 |
| `.vms-rich-text-field__editor pre code` (reset) | ~3529 |

`viewmodel-shell/test/rich-text.test.ts`: 1 new `describe` block ("RichTextToolbarNode composite"), 7 `it` tests, +166 lines.

## Baked-in adjustments per Ashley 2026-07-31

Ashley's Plan 28-04 sign-off carried ONE adjustment: `taste ok — with: fix code-block + quote editor-host rendering in Plan 28-05`. Verbatim: *"Okay, the buttons seem to do stuff now, although they're definitely not all giving the full expected outcome, like code blocks and quotes don't look like I would expect code blocks and quotes to look, but I don't know if you're that far yet."*

**How it was implemented in this plan's Task 2 (see the "(b) NEW editor-host inner-node rules" subsection above):**

| Before (Plan 28-03 shipped) | After (Plan 28-05 shipped) | Diff pointer |
|---|---|---|
| `<blockquote>` rendered with browser default (no left rule, no italic, no muted color) | `.vms-rich-text-field__editor blockquote { border-left: 3px solid var(--vms-border); padding-left: var(--vms-space-sm); margin: var(--vms-space-xs) 0; color: var(--vms-text-muted); font-style: italic; }` — muted italic aside with left rule | default.css commit `c1e101c` |
| `<pre>` rendered with browser default (small monospace, no chrome, no palette) | `.vms-rich-text-field__editor pre { background: var(--vms-code-bg); color: var(--vms-code-fg); border: 1px solid var(--vms-border); border-radius: var(--vms-radius-sm); padding: var(--vms-space-sm); font-family: var(--vms-font-mono); font-size: var(--vms-text-sm); line-height: var(--vms-control-line); overflow-x: auto; margin: var(--vms-space-xs) 0; }` — the shipped code palette on a bordered card | default.css commit `c1e101c` |
| `<code>` (inline) rendered with browser default | `.vms-rich-text-field__editor code { background: var(--vms-code-bg); color: var(--vms-code-fg); padding: 0 var(--vms-space-2xs); border-radius: var(--vms-radius-sm); font-family: var(--vms-font-mono); font-size: var(--vms-text-sm); }` — inline code chip | default.css commit `c1e101c` |
| N/A | `.vms-rich-text-field__editor pre code { background: transparent; color: inherit; padding: 0; border-radius: 0; font-size: inherit; }` — RESET rule so code-inside-pre doesn't double-style (the specific "looks wrong" outcome for a real fenced code block) | default.css commit `c1e101c` |

**Not-explicitly-in-scope but eyeball-verified via mental model:** TipTap emits `<ul>`/`<ol>`/`<li>` for lists (browser default is close-enough — bullets/numbers already visible; nothing needed) and `<h1>`/`<h2>`/`<h3>` for headings (browser default renders bold and larger — visually distinct enough; no additional rules added). If a follow-up eyeballing surfaces "the headings look off," a separate follow-up plan can add them; the Ashley-flagged blocker is closed.

**Verification path (executor-driven programmatic, per orchestrator prompt):** the framework green-tree gate (check:aa-contrast 13/13 pairs on 13 themes; check:no-demo-style; check:theme-byte-identity; check:theme-function; check:test-types; check:core-globals; check:demo-types; full vitest suite 81 files/1329 pass/1 skip/0 fail) confirms all rules use existing tokens with AA-contrast headroom, no theme drift, no demo-side style leakage. A visual re-eyeball against a rendered rich-text-field with all 11 D-08 tools' content is a Plan 28-07 concern (the shipped multi-theme verification page); this plan closes the CSS gap Ashley named.

## Files Created/Modified

See `key-files` in the frontmatter for the full 4-file breakdown with per-file line counts.

## Decisions Made

See `key-decisions` in the frontmatter for the five interpretive decisions taken during implementation.

## Deviations from Plan

**None.** The plan spec + orchestrator prompt aligned cleanly:

- Plan spec: "custom `richTextToolbar()` body should mirror `renderDefaultRichTextToolbar()`'s shape but drive its button set from `n.tools[]`"; orchestrator prompt: "should reuse the SAME button-emission logic keyed by the slot's `tools[]` array instead of the hardcoded FLOOR." Implemented as one shared `applyRichTextTool()` helper (Plan 28-03 shipped) with the composite adding only the DOM-walk resolution (`closest()` + `data-editor-key` lookup) via the new `richTextToolbarInvoke()` helper. No chain-arm duplication.
- Plan spec + orchestrator both name the editor-host inner-node CSS (blockquote / pre / code / pre code) as this plan's scope per Ashley's sign-off adjustment. Folded into Task 2 with existing `--vms-*` tokens; no new tokens introduced; AA-contrast headroom inherited.
- Plan spec says "custom composite reuses `renderDefaultRichTextToolbar`'s button labels + `applyRichTextTool` logic (no duplication)." Verified: the composite calls `this.richTextToolLabel(tool)` for both `textContent` and `aria-label`, and `this.applyRichTextTool(entry.editor, tool)` for the chain command. Zero duplication.
- Plan spec says success-criteria bullet #4: "New vitest tests in `viewmodel-shell/test/rich-text.test.ts` (or plan-specified name)." Extended the existing file per plan Task 3's instruction "Reuse the mock setup from the Plan 28-03 tests" — appending the composite tests to the same file uses the same mocks + hoisted counter setup without any per-test override.

No Rule 4 architectural escalations. No authentication gates. No pre-existing test failures encountered. No package-manager installs (Rule 3 excluded case does not apply).

## Issues Encountered

**None.** The framework's shipped Plan 28-03 infrastructure (editorInstances, applyRichTextTool, richTextToolLabel, the field's wrapper + editor host dispatch) supported the composite implementation directly; the additions were purely additive (new method + one attribute + one CSS block + one describe group). No refactor needed. All check gates + tests + full framework suite green on first pass; no iteration required.

## Next Phase Readiness

Plan 28-06 (READ-side sanitization audit of `markdown.ts`) is READY. The composite renderer + editor-host inner-node CSS are now the shipped visual; the sanitization audit should key its analysis off the SHIPPED class names (`.vms-rich-text-toolbar*`, `.vms-rich-text-field__editor`, and the inner-node cascade rules) rather than the interim placeholder. Nothing else in Plans 28-06 through 28-11 is blocked by this plan's outputs.

## Self-Check

**1. Created files exist:**

- `.planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-05-SUMMARY.md` → FOUND (this file).

**2. Modified files exist and contain the expected additions:**

- `viewmodel-shell/src/browser.ts` → FOUND. Contains richTextToolbar (7 refs), richTextToolbarInvoke (3 refs), richTextToolLabel (5 refs), all 3 BEM emission calls, wrapper.dataset.editorKey assignment (1 ref), zero data-placeholder references.
- `viewmodel-shell/styles/default.css` → FOUND. Contains .vms-rich-text-toolbar (15 refs), --size-compact (2 refs), --tone-info (1 ref), --state-active (1 ref), __tool (5 refs), editor blockquote (1 rule), editor pre (2 rules including pre code reset), editor code (rules), zero data-placeholder references.
- `viewmodel-shell/test/rich-text.test.ts` → FOUND. Contains describe("RichTextToolbarNode composite", …) block (7 tests).

**3. Commits exist:**

- `a5414a8` → FOUND (`feat(28-05): replace richTextToolbar() placeholder with full composite renderer`).
- `c1e101c` → FOUND (`feat(28-05): ship RichTextToolbarNode composite CSS + editor-host inner-node styling`).
- `ce720a2` → FOUND (`test(28-05): add RichTextToolbarNode composite tests (7 new — total 13/13 pass)`).

**4. Build + tests + all gates green:**

- `npm run build` → exit 0.
- `npm run check:core-globals` → exit 0.
- `npm run check:test-types` → exit 0.
- `npm run check:aa-contrast` → exit 0 (13/13 pairs meet WCAG-AA on all 13 themes).
- `npm run check:no-demo-style` → exit 0.
- `npm run check:theme-byte-identity` → exit 0.
- `npm run check:theme-function` → exit 0.
- `npm run check:demo-types` → exit 0.
- `npx vitest run test/rich-text.test.ts` → 13 pass (6 pre-existing + 7 new).
- Full framework `npx vitest run` → 81 test files, 1329 pass, 1 skip, 0 fail.

## Self-Check: PASSED
