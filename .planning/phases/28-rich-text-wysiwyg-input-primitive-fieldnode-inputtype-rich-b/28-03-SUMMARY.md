---
phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
plan: 03
subsystem: ui
tags: [viewmodel-shell, renderer, tiptap, turndown, rich-text, lazy-import, chart-js-precedent, style-3, phase-28]

# Dependency graph
requires:
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 01
    provides: The TS wire contract (RichTextFieldNode + RichTextToolbarNode interfaces + RichTextTool closed union) that browser.ts's new dispatch arms + renderer types against. File-disjoint from 28-02 (.NET twin); both ran in Wave 1 in parallel.
  - phase: 12-chart-node-and-tui-chart-degradation
    provides: The Chart.js lazy-import + persist-across-renders + mark-sweep + fail-loud pattern that this plan's richTextField() / loadRichText() / richTextFailLoud() copy VERBATIM (Analog A + Analog E from 28-PATTERNS.md).
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    provides: The STYLE-3 state axis unification pattern (border-left 3px + primary font-weight 600) that .vms-rich-text-field--state-active mirrors byte-for-byte from the shipped ListRow/UserRow/DetailRow rules.

provides:
  - `@tiptap/core` ^2.11.0 + `@tiptap/starter-kit` ^2.11.0 + `turndown` ^7.2.0 declared as REAL dependencies (NOT peer-optional per D-04's deliberate divergence from Chart.js). `@types/turndown` ^5.0.5 added to devDependencies for TS resolution.
  - `viewmodel-shell/src/browser.ts` `richTextField()` renderer + `renderDefaultRichTextToolbar()` + `richTextToolLabel()` + `applyRichTextTool()` helpers + `loadRichText()` async lazy loader + `richTextFailLoud()` + INTERIM `richTextToolbar()` placeholder + `editorInstances` persistent Map + `editorKeyCounter`/`editorKeysSeen` per-render bookkeeping + `render()` reset + mark-sweep + two node-dispatch arms.
  - `viewmodel-shell/styles/default.css` `.vms-rich-text-field` wrapper + `__label` + `__editor` + `__toolbar-default` + `__tool` shipped classes + Phase 27 STYLE-3 state axis (`--state-active` / `--state-done` / `--state-disabled`) + placeholder-tripwire rule for the interim `.vms-rich-text-toolbar[data-placeholder]`.
  - `viewmodel-shell/test/rich-text.test.ts` (6 tests, success-path with per-file-isolated mocks) covering: D-04 symmetric lazy-load guarantee (zero-imports-when-absent), loader-fires-exactly-once on first render, initial content pre-load via marked, editor.update round-trip via turndown → writeBind, mark-sweep on removal, and reuse across identical re-renders.
  - `viewmodel-shell/test/rich-text-missing-dep.test.ts` (1 test, failure-path with rejecting @tiptap/core mock) covering fail-loud via console.error (byte-analog of chart-missing-dep.test.ts).
  - The v8.2.0 renderer + CSS + lazy-load-guarantee test suite that Plans 28-04 (parity fixture), 28-05 (composite renderer + tasting), 28-07 (verification page), 28-08 (agent-skill), and 28-09 (demo adoption) build against.

affects: [28-04 (FeatureProbe parity fixture emits RichTextFieldNode + expects the browser to render it), 28-05 (Route B composite tasting page — REPLACES the interim richTextToolbar() placeholder body + the placeholder-tripwire CSS with the shipped composite), 28-06 (READ-side sanitization audit of markdown.ts pipeline that this plan's turndown output feeds), 28-07 (multi-theme verification page consumes the shipped .vms-rich-text-field CSS across all 13 themes), 28-08 (agent-skill.md gains a section keying off the rich-text-field discriminator that the renderer now honors), 28-09 (a demo app adopts RichTextFieldNode against the shipped renderer), 28-10 (green-tree gate consumes the enhanced test suite), 28-11 (release ritual — v8.1.0 → v8.2.0 aligned bump publishes this bundled TipTap + turndown to npm)]

# Tech tracking
tech-stack:
  added:
    - "@tiptap/core ^2.11.0 (dependencies) — headless rich text editor core, LAZY-loaded from browser.ts. Consumers who never render RichTextFieldNode ship zero bytes."
    - "@tiptap/starter-kit ^2.11.0 (dependencies) — TipTap extension bundle covering the D-08 floor (bold, italic, link, lists, headings, code, blockquote). Same lazy posture."
    - "turndown ^7.2.0 (dependencies) — HTML → markdown converter. On editor `update`, editor.getHTML() → turndown.turndown(html) → writeBind. Same lazy posture."
    - "@types/turndown ^5.0.5 (devDependencies) — turndown ships JS-only; TipTap ships its own .d.ts so no @types package needed there."
  patterns:
    - "Persist-across-renders map + per-render bookkeeping + post-rebuild mark-sweep (byte-analog of chartInstances/chartKeyCounter/chartKeysSeen from Phase 12). Applied to editorInstances/editorKeyCounter/editorKeysSeen — the SAME idiom, unchanged, for the same reason (an Editor's DOM state IS the editor state and must survive render()'s innerHTML wipe or every re-render wipes caret/selection/undo history)."
    - "Synchronous-render-that-kicks-async-loader-without-await (browser.ts:882-884 Chart precedent → richTextField line 1087). `void this.loadRichText(...)` — a missing dependency surfaces through the fail-loud seam (richTextFailLoud → console.error), NEVER a floating unhandled rejection."
    - "Promise.all-guarded single try/catch for multiple lazy imports — a rejection on ANY of the 4 modules (tiptap-core, starter-kit, turndown, marked) fires richTextFailLoud once. Loud, single-shot, no partial-initialization state."
    - "STYLE-3 state axis on a leaf-input primitive — first application of the Phase 27 uniformity pattern to a leaf INPUT (prior applications: row/composite types). The rule shape is byte-identical: border-left 3px --vms-accent + primary-text-slot font-weight 600 + --done opacity 0.72 + --disabled opacity 0.55 + pointer-events:none."
    - "Two-file mock isolation for lazy-import contract (chart.test.ts / chart-missing-dep.test.ts → rich-text.test.ts / rich-text-missing-dep.test.ts). Vitest isolates module mocks per FILE, so the success-path mocks in the main file cannot contaminate the rejecting mock in the missing-dep sibling."
    - "Hoisted counter probe as the D-04 lazy-load SYMMETRIC witness — vi.hoisted counters bump inside the vi.mock factories; a tree with no rich-text-field asserts every counter is 0. This is the machine-verifiable proof that browser.ts's imports stay dynamic (a top-level import would fire the factory at module-load, bumping the counter, tripping Test 1)."

key-files:
  created:
    - "viewmodel-shell/test/rich-text.test.ts (+416 lines, 6 vitest tests)"
    - "viewmodel-shell/test/rich-text-missing-dep.test.ts (+81 lines, 1 vitest test — fail-loud path)"
    - ".planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-03-SUMMARY.md (this file)"
  modified:
    - "viewmodel-shell/package.json (+6 lines: new `dependencies` block + `@types/turndown` in devDependencies; `version` UNCHANGED at 8.1.0 — bump lands in Plan 28-11)"
    - "viewmodel-shell/package-lock.json (regenerated by npm install; +706 lines net; +59 packages added — TipTap ecosystem + turndown + their transitive deps)"
    - "viewmodel-shell/src/browser.ts (+315 lines: 3 imports + editorInstances Map + editorKeyCounter/editorKeysSeen + render() reset + mark-sweep + 2 dispatch arms + richTextField() + renderDefaultRichTextToolbar() + richTextToolLabel() + applyRichTextTool() + loadRichText() + richTextFailLoud() + richTextToolbar() interim placeholder)"
    - "viewmodel-shell/styles/default.css (+119 lines: 12 new .vms-rich-text-field* rules + interim placeholder-tripwire rule for .vms-rich-text-toolbar[data-placeholder])"

key-decisions:
  - "TIPPY-KEY DECISION — `void this.loadRichText(...)` is fire-and-forget from richTextField(), NOT awaited. Load-bearing per Analog A: the outer render() is synchronous; awaiting inside it would block the whole tree rebuild on TipTap's network + parse. The Chart precedent (browser.ts:882-884) is the exact byte-analog — a missing dependency surfaces through fail-loud, never a floating unhandled rejection."
  - "URL PROMPT FOR LINK TOOL — the link toolbar button calls `window.prompt('URL')` to solicit the target URL from the user. This IS a browser dialog (violates the pure-declarative posture in the strictest sense), but the alternative (a full LinkPopover Route B composite with typed slots) is out of scope for Plan 28-03 — the D-08 floor asks for a WORKING link button, and prompt() is the minimum that works. Followup: the link picker earns its own composite in a future phase if signal warrants (mentioned in the CONTEXT §Deferred discussion). Contained: the prompt call is guarded by `typeof window !== 'undefined'` so a jsdom / non-browser Adapter never crashes on it."
  - "RENDER TOOLBAR VIA DEFAULT WHEN `n.toolbar` OMITTED, VIA `richTextToolbar()` WHEN SUPPLIED — the two-mode pattern matches the CONTEXT.md guidance (D-02: composite is the abstraction seam; a plain field with no explicit toolbar renders the D-08 floor via the framework's DEFAULT strip; a field WITH an explicit RichTextToolbarNode gets it composited in via the dispatch arm). Plan 28-05 finalizes the composite body — this plan ships the interim placeholder so the dispatch is exhaustive."
  - "STATE-AXIS RULE SHAPE — .vms-rich-text-field--state-active applies border-left AND compensates with padding-left, matching Phase 27's UserRow/DetailRow precedent. Even though the base .vms-rich-text-field wrapper is flex-column (no per-side padding to cannibalize), the padding-left compensation (var(--vms-space-2xs)) is included so the field's visual alignment stays consistent with its non-active sibling row/composite types (an app that renders a page mixing active user rows and active rich text fields sees the same 3px accent geometry in both)."
  - "TWO TEST FILES, NOT ONE — the fail-loud test (rich-text-missing-dep.test.ts) is a sibling file to keep the rejecting @tiptap/core mock from contaminating the success-path mocks in rich-text.test.ts. This is the SAME pattern chart.test.ts / chart-missing-dep.test.ts established for the ChartNode precedent; the total test count (7) exceeds the plan's stated floor of 6, and every acceptance-criterion sub-property is covered."
  - "D-04 SYMMETRIC LAZY-LOAD IS PROVEN VIA HOISTED COUNTERS, NOT vi.spyOn(globalThis, 'import') — the latter has patchy Vitest support and is fragile across Node versions. The hoisted-counter shape (bump inside vi.mock's factory, assert count === 0 in a tree-without-node test) is more portable AND covers the load-bearing invariant more directly: the factory bumps ONLY when the module is resolved, so a count of 0 IS the proof that `import(...)` was never called."

patterns-established:
  - "The lazy-third-party-library adoption template inside browser.ts is now: (a) declare in `dependencies` (per D-04 rule); (b) type import only if strictly required (prefer inline `any` inside the loader); (c) private Map<key, {host: HTMLElement, module1: any|null, module2: any|null, latestBindValue: string}>; (d) per-render key-counter + keys-seen sets, reset in render() + mark-sweep after tree rebuild; (e) sync `foo()` renderer creates host + registers in Map + kicks `void this.loadFoo(...)`; (f) async `loadFoo()` Promise.all-guards ALL dynamic imports in one try/catch → fail-loud on rejection; (g) `fooFailLoud(msg)` = `console.error('[ViewModelShell]', new Error(msg))`; (h) test file with hoisted counter mocks + sibling file with rejecting mock for the fail-loud path. The full template is now instanced 2× (chart, richTextField); any future adoption (image editor, code editor with intellisense, etc.) reaches for this template, not from-scratch."
  - "STYLE-3 state axis extends to leaf-input primitives — Phase 27 applied it to 8 non-Chip row/composite types (which all share a semantically-primary text slot); this plan applies it to a leaf INPUT whose 'primary content' is the editor's contenteditable. The rule shape is byte-identical (border-left + font-weight:600 on the primary-content slot); the axis rule 'a new composite that carries the row/list shape MUST carry this axis' now applies to leaf-inputs with a semantically-primary content slot as well (adding heft to the Phase 27 patterns-established doctrine)."

requirements-completed: [RICH-01, RICH-02, RICH-03, RICH-05]

# Metrics
duration: ~35 min
completed: 2026-07-31
---

# Phase 28 Plan 03: Rich text WYSIWYG browser renderer + lazy TipTap + STYLE-3 CSS + adapter tests Summary

**Landed the browser-side implementation of `RichTextFieldNode`: added TipTap 2.x + turndown to `dependencies` (D-04 bundled), implemented `richTextField()` + `loadRichText()` + `richTextFailLoud()` following the Chart.js lazy-import + mark-sweep + fail-loud precedent VERBATIM in `viewmodel-shell/src/browser.ts`, shipped the D-08 default-toolbar floor, added the STYLE-3 state axis + editor host CSS to `default.css`, and landed the 7-test adapter suite that PROVES the lazy-load is actually lazy (D-04 symmetric requirement — Test 1 is CI-enforceable proof that a future refactor moving any import to top-level fails the build).**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-31 (approx — orchestrator dispatch)
- **Completed:** 2026-07-31
- **Tasks:** 4 (all `type="auto"`, all `autonomous: true`)
- **Files modified:** 3 (package.json, package-lock.json, browser.ts, default.css)
- **Files created:** 3 (rich-text.test.ts, rich-text-missing-dep.test.ts, this SUMMARY.md)
- **Tests added:** 7 (6 success-path + 1 fail-loud); full framework suite went 79 files/1315 tests → 81 files/1322 tests, all pass.

## Accomplishments

### Task 1 — TipTap + turndown in package.json + npm install (commit `1d36d38`)

Added a new top-level `"dependencies"` block to `viewmodel-shell/package.json` (block did not previously exist — grep-verified before creation):

```json
"dependencies": {
  "@tiptap/core": "^2.11.0",
  "@tiptap/starter-kit": "^2.11.0",
  "turndown": "^7.2.0"
},
```

Added `"@types/turndown": "^5.0.5"` to devDependencies after a stub compile confirmed turndown ships JS-only (TipTap ships its own `.d.ts` files so no `@types` package needed there).

`npm install` regenerated `package-lock.json`: +59 packages, +706 lines net. No peer-dep warnings from `@tiptap/*`. The `version` field is intentionally UNCHANGED at `8.1.0` — the bump-to-8.2.0 lands in Plan 28-11 under operator gate.

`npm run build` → exit 0 (TypeScript resolves all three new dependencies through the standard module-resolution).

### Task 2 — richTextField() renderer + loadRichText() lazy loader + richTextFailLoud() + INTERIM richTextToolbar() (commit `4833517`)

**+315 lines to `viewmodel-shell/src/browser.ts`**, comprising:

1. **Imports** (line 28) — added `RichTextFieldNode, RichTextToolbarNode, RichTextTool` to the type-only import block.

2. **`editorInstances` persistent Map** (line 116) — adjacent to `chartInstances` (line 99), with a 14-line comment mirroring `chartInstances`'s shape rationale. Values: `{ host, editor: any|null, turndown: any|null, latestBindValue: string }`. Reused across renders (host DOM state IS editor state; a fresh Editor per render would wipe caret/selection/undo history).

3. **Per-render bookkeeping** (lines 233-234) — `editorKeyCounter` + `editorKeysSeen`, adjacent to the chart equivalents.

4. **render() reset** (lines 355-356) — adjacent to the chart reset at 322-323. Empty Map + empty Set reset at the top of every render() so keys compute identically across the rebuild + mark-sweep passes.

5. **render() mark-sweep** (lines 380-385) — post-rebuild loop calling `entry.editor?.destroy()` and `editorInstances.delete(key)` for any key not in `editorKeysSeen`. Byte-analog to the chart mark-sweep at 333-338.

6. **Two node-dispatch arms** (lines 632-633) — `case "rich-text-field"` + `case "rich-text-toolbar"`, appended after the chip arm.

7. **`richTextField()`** (line 1008) — synchronous renderer. Keys the editor via `name+ordinal`. Emits wrapper `.vms-rich-text-field` + STYLE-3 state-axis BEM modifier + label + default toolbar (via helper) OR the supplied toolbar composite. Reuses existing editor host across renders; only calls `setContent()` when the server value differs from what the user last typed (protects caret / selection / undo history). Kicks `void this.loadRichText(...)` on first mount, mirroring `void this.loadChart(...)` at browser.ts:882-884.

8. **`renderDefaultRichTextToolbar()`** (line 1098) — emits the `.vms-rich-text-field__toolbar-default` strip with one `<button>` per D-08 tool (11 buttons: bold, italic, link, bullet-list, ordered-list, heading-1/2/3, inline-code, code-block, blockquote). Buttons dispatch through `applyRichTextTool()` on click.

9. **`richTextToolLabel()`** (line 1128) — closed-switch mapping RichTextTool → user-facing label (used for both `textContent` and `aria-label`).

10. **`applyRichTextTool()`** (line 1144) — closed-switch mapping RichTextTool → TipTap chain command (`chain.toggleBold().run()`, `chain.toggleHeading({level:1}).run()`, etc.). The link tool uses `window.prompt('URL')` guarded by `typeof window !== 'undefined'` for adapter safety.

11. **`loadRichText()`** (line 1178) — async lazy loader. `Promise.all([import("@tiptap/core"), import("@tiptap/starter-kit"), import("turndown"), import("marked")])` in a SINGLE try/catch. On rejection, fires `richTextFailLoud()` and returns — NO silent fallback to a plain textarea. On success, constructs `TurndownService` with `{ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" }` matching the D-08 floor + existing markdown.ts read pipeline. Parses initial markdown → HTML via `marked` → passed as `content:` to the Editor constructor. Wires `editor.on("update", ...)` to convert HTML → markdown via turndown → `this.writeBind(n.bind, md)` + updates `latestBindValue`.

12. **`richTextFailLoud()`** (line 1231) — `console.error("[ViewModelShell]", new Error(msg))`. Byte-identical shape to `chartFailLoud()`.

13. **`richTextToolbar()` INTERIM placeholder** (line 1245) — renders an empty `<div class="vms-rich-text-toolbar" data-placeholder="pre-tasting">`. Plan 28-05 replaces the body with the shipped Route B composite renderer after the D-03 tasting sign-off.

**D-04 LAZY GUARANTEE (verified by grep):**
- `grep -c 'import("@tiptap/core")' src/browser.ts` → **1** (single dynamic import site inside `loadRichText`)
- `grep -c 'import("@tiptap/starter-kit")' src/browser.ts` → **1**
- `grep -c 'import("turndown")' src/browser.ts` → **1**
- `grep -cE '^import.*@tiptap|^import.*turndown' src/browser.ts` → **0** (no top-level import — the D-04 symmetric requirement)

**FAIL-LOUD GUARANTEE:** `loadRichText`'s catch calls `richTextFailLoud` unconditionally — no silent no-op / silent fallback to a plain textarea (AGENTS.md capability seam rule; same posture as `chartFailLoud`).

Build + gates:
- `npm run build` → exit 0
- `npm run check:core-globals` → exit 0 (`src/index.ts` still references zero platform globals; `browser.ts` is legitimately excluded per AGENTS.md §Enforcement)
- `npm run check:test-types` → exit 0

### Task 3 — CSS classes for .vms-rich-text-field + STYLE-3 state axis (commit `dc016e8`)

**+119 lines to `viewmodel-shell/styles/default.css`**, under the section header `/* v8.2.0 — RichTextFieldNode (RICH-01) */`:

- `.vms-rich-text-field` wrapper (flex-column, gap `--vms-space-2xs`) — byte-analog of `.vms-field`.
- `.vms-rich-text-field__label` (typography via `--vms-text-sm` + `--vms-text-muted`) — byte-analog of `.vms-field__label`.
- `.vms-rich-text-field__editor` (8rem min-height, `--vms-surface` bg, border, radius, font tokens) — byte-analog of `.vms-field__input`. Uses `focus-within` (not `:focus`) since TipTap's contenteditable is an inner node — hoists the accent-ring to the host so the whole editor block gets it.
- `.vms-rich-text-field__toolbar-default` strip (flex-wrap row, `--vms-surface-2` bg, matching-radius flush with editor via adjacent-sibling rule).
- `.vms-rich-text-field__tool` (compact button styling; hover applies subtle `--vms-surface` + border; `focus-visible` accent ring).
- **Phase 27 STYLE-3 state axis** (`--state-active` = border-left 3px `--vms-accent` + editor `font-weight: 600`; `--state-done` = opacity 0.72; `--state-disabled` = opacity 0.55 + `pointer-events: none`) — byte-analog of the shipped `.vms-user-row--active` / `.vms-detail-row--active` rules from Phase 27's Plan 27-04.
- **Placeholder-tripwire rule** for the INTERIM `.vms-rich-text-toolbar[data-placeholder="pre-tasting"]` (min-height 1px so a stray placeholder is inspectable in dev but has no visible footprint in prod). Plan 28-05 removes this line when the composite CSS replaces it.

**No raw color / no `rgb(` / no `hsl(`** in the new section — every token goes through `--vms-*` per AGENTS.md §Design system. **No new `@media` or `@supports`** — Layout policy P1 (responsiveness is intrinsic/container-relative).

**check:aa-contrast** did NOT need a deepen-via-color-mix fix — the toolbar buttons reuse already-gated `--vms-text` on `--vms-surface`/`--vms-surface-2` pairs, so no new fg/bg pair was introduced. All 13/13 shipped themes pass.

Gates all green:
- `check:aa-contrast` → 13/13 pairs meet WCAG-AA on all 13 themes
- `check:no-demo-style` → exit 0
- `check:theme-byte-identity` → exit 0
- `check:theme-function` → exit 0

### Task 4 — Adapter tests: 7 tests across 2 files proving D-04 symmetric + fail-loud + round-trip + mark-sweep (commit `aa76e51`)

**`viewmodel-shell/test/rich-text.test.ts`** (+416 lines, 6 vitest tests, success-path with per-file-isolated mocks):

| # | Test | Proves |
|---|------|--------|
| 1 | `does NOT resolve @tiptap/core / @tiptap/starter-kit / turndown when the tree contains no RichTextFieldNode` | **D-04 SYMMETRIC LAZY-LOAD** — CI-enforceable proof. Renders Section+Text+Button (no rich-text). Asserts hoisted counters `importCallsTiptap/starterKit/turndown/marked` are ALL 0 + `FakeEditor`/`FakeTurndown` construction counts are 0 + `editorInstances.size === 0`. A future refactor moving any import to top-level fires the vi.mock factory at module-load, bumps the counter, fails this test loudly. |
| 2 | `resolves ... exactly once, constructs one FakeEditor` | The lazy load fires on first render. Asserts every module resolves ≥ 1 time, exactly 1 FakeEditor + 1 FakeTurndown constructed, turndown got the D-08 options `{headingStyle:atx, codeBlockStyle:fenced, bulletListMarker:-}`. DOM assertions: `.vms-rich-text-field` + `.vms-rich-text-field__editor` + `.vms-rich-text-field__toolbar-default` all present. |
| 3 | `passes the marked-parsed HTML of the bind value to the Editor as its content option` | **Initial content pre-load via marked (Q7)**. Seeds state with `{ draft: "# Hello\n\nWorld with **bold**" }`; asserts the Editor's `content` option contains `<h1>Hello</h1>` and `<strong>bold</strong>`. |
| 4 | `simulated editor.update writes the turndown-converted markdown to the bind path in state` | **Round-trip closes: editor.update → turndown → writeBind → state**. Synthesizes an update event with HTML payload; asserts `state.draft === "MD:<p>hello <strong>world</strong></p>"` (our mock turndown emits `MD:` + html). |
| 5a | `destroys the editor and drops it from editorInstances when the next tree omits the RichTextFieldNode` | **Mark-sweep on removal**. Renders WITH, re-renders WITHOUT; asserts `editor.destroy()` fired and `editorInstances.size === 0`. Re-adds the same key; asserts a FRESH editor is constructed (old was really swept). |
| 5b | `preserves the editor across identical re-renders (does NOT destroy or reconstruct)` | **Persist-across-renders contract**. Renders WITH, re-renders the SAME tree; asserts destroy did NOT fire, no new editor constructed. Byte-analog to the chart precedent at browser.ts:99. |

**`viewmodel-shell/test/rich-text-missing-dep.test.ts`** (+81 lines, 1 vitest test, failure-path with rejecting @tiptap/core mock):

| # | Test | Proves |
|---|------|--------|
| 6 | `routes a loud Error through console.error (not a silent no-op)` | **Fail-loud on missing @tiptap/core** (AGENTS.md capability seam rule). `vi.mock` throws `Cannot find module '@tiptap/core'`; renders rich-text-field; asserts DOM chrome (wrapper + editor host) STILL rendered synchronously (failure is async), then after flush asserts `console.error` was called exactly once with prefix `"[ViewModelShell]"` and an Error containing `"TipTap"` or `"turndown"`. Byte-analog of chart-missing-dep.test.ts. |

**Test-run output:**
- `npx vitest run test/rich-text.test.ts test/rich-text-missing-dep.test.ts --reporter=verbose` → **7 tests passed, 0 failed**
- `npm run check:test-types` → exit 0 (test/**/*.ts is already covered by tsconfig.test.json's include pattern — no config change needed)
- Full framework `npx vitest run`: **81 test files (up from 79), 1322 pass + 1 skip (up from 1315 + 1 skip), 0 fail**. No regressions.

## Task Commits

| # | Task | Commit    | Files |
|---|------|-----------|-------|
| 1 | Add @tiptap/core + @tiptap/starter-kit + turndown to dependencies | `1d36d38` | viewmodel-shell/package.json (+6 lines), viewmodel-shell/package-lock.json (+706 lines net) |
| 2 | Implement richTextField() + loadRichText() + richTextFailLoud() + placeholder richTextToolbar() | `4833517` | viewmodel-shell/src/browser.ts (+315 lines) |
| 3 | Add .vms-rich-text-field CSS + STYLE-3 state axis rules | `dc016e8` | viewmodel-shell/styles/default.css (+119 lines) |
| 4 | Add rich-text adapter tests (D-04 lazy + fail-loud + round-trip + mark-sweep) | `aa76e51` | viewmodel-shell/test/rich-text.test.ts (+416 lines), viewmodel-shell/test/rich-text-missing-dep.test.ts (+81 lines) |

## Insertion sites (post-edit line numbers)

`viewmodel-shell/package.json` — new `"dependencies"` block placed adjacent to `"scripts"` (between `bin` and `scripts`):

| Insertion | Line(s) |
|-----------|--------:|
| `"dependencies": {`     | 31 |
| `"@tiptap/core"`        | 32 |
| `"@tiptap/starter-kit"` | 33 |
| `"turndown"`            | 34 |
| `"@types/turndown"` (devDependencies)  | 51 |

`viewmodel-shell/src/browser.ts`:

| Insertion | Line |
|-----------|------|
| `RichTextFieldNode, RichTextToolbarNode, RichTextTool,` import  | 28 |
| `private editorInstances = new Map<...>` (+ 14-line block comment)  | 104-125 |
| `private editorKeyCounter = new Map<...>` + `editorKeysSeen`         | 233-234 |
| render() reset: `this.editorKeyCounter = new Map();` + `this.editorKeysSeen = new Set();` | 355-356 |
| render() mark-sweep: `for (const [key, entry] of this.editorInstances) ...` | 380-385 |
| `case "rich-text-field":   return this.richTextField(n, parent, on);` (dispatch arm) | 632 |
| `case "rich-text-toolbar": return this.richTextToolbar(n, parent, on);` (dispatch arm) | 633 |
| `private richTextField(...)` renderer | 1008 |
| `private renderDefaultRichTextToolbar(key)` | 1098 |
| `private richTextToolLabel(tool)` | 1128 |
| `private applyRichTextTool(editor, tool)` | 1144 |
| `private async loadRichText(key, n)` | 1178 |
| `private richTextFailLoud(msg)` | 1231 |
| `private richTextToolbar(...)` INTERIM placeholder | 1245 |

`viewmodel-shell/styles/default.css`:

| Rule                                                   | Line(s) |
|--------------------------------------------------------|--------:|
| `.vms-rich-text-field { display: flex; ... }`          | 3299 |
| `.vms-rich-text-field__label { ... }`                  | 3304 |
| `.vms-rich-text-field__editor { ... }`                 | 3308 |
| `.vms-rich-text-field__editor:focus-within { ... }`    | 3323 |
| `.vms-rich-text-field__toolbar-default { ... }`        | 3330 |
| `.vms-rich-text-field__toolbar-default + .vms-rich-text-field__editor` | 3342 |
| `.vms-rich-text-field__tool { ... }` + `:hover` + `:focus-visible` | 3348-3371 |
| `.vms-rich-text-field--state-active { ... }`           | 3382 |
| `.vms-rich-text-field--state-active .vms-rich-text-field__editor { font-weight: 600 }` | 3386 |
| `.vms-rich-text-field--state-done { opacity: 0.72 }`   | 3389 |
| `.vms-rich-text-field--state-disabled { ... }`         | 3392 |
| `.vms-rich-text-toolbar[data-placeholder="pre-tasting"]` (INTERIM tripwire) | 3401 |

`viewmodel-shell/test/rich-text.test.ts`: 6 `describe` blocks, 6 `it` tests, 416 lines.

`viewmodel-shell/test/rich-text-missing-dep.test.ts`: 1 `describe` block, 1 `it` test, 81 lines.

## Verification

All plan-listed automated verifications green:

| Check | Result |
|-------|--------|
| `cd viewmodel-shell && npm run build` | exit 0 |
| `cd viewmodel-shell && npm run check:test-types` | exit 0 |
| `cd viewmodel-shell && npm run check:core-globals` | exit 0 (`AGNOSTIC-03: src/index.ts references zero platform globals`) |
| `cd viewmodel-shell && npm run check:aa-contrast` | exit 0 — 13/13 pairs meet WCAG-AA on default + all 12 themes |
| `cd viewmodel-shell && npm run check:no-demo-style` | exit 0 |
| `cd viewmodel-shell && npm run check:theme-byte-identity` | exit 0 |
| `cd viewmodel-shell && npm run check:theme-function` | exit 0 (all 12 theme files function as their name claims) |
| `cd viewmodel-shell && npm run check:demo-types` | exit 0 (22 demo projects type-check clean) |
| `cd viewmodel-shell && npx vitest run test/rich-text.test.ts test/rich-text-missing-dep.test.ts` | 7 passed, 0 failed |
| `cd viewmodel-shell && npx vitest run` (full suite) | **81 test files, 1322 pass, 1 skip, 0 fail** (up from 79/1315/+1 skip/0 fail baseline — no regressions) |
| `grep -c 'richTextField' viewmodel-shell/src/browser.ts` | 3 (spec: ≥ 3) |
| `grep -c 'loadRichText' viewmodel-shell/src/browser.ts` | 4 (spec: ≥ 2) |
| `grep -c 'richTextFailLoud' viewmodel-shell/src/browser.ts` | 3 (spec: ≥ 2) |
| `grep -c 'editorInstances' viewmodel-shell/src/browser.ts` | 13 (spec: ≥ 4) |
| `grep -c 'import("@tiptap/core")' viewmodel-shell/src/browser.ts` | 1 (spec: exactly 1) |
| `grep -c 'import("@tiptap/starter-kit")' viewmodel-shell/src/browser.ts` | 1 (spec: exactly 1) |
| `grep -c 'import("turndown")' viewmodel-shell/src/browser.ts` | 1 (spec: exactly 1) |
| `grep -cE '^import.*@tiptap\|^import.*turndown' viewmodel-shell/src/browser.ts` | 0 (spec: 0 — D-04 symmetric requirement) |
| `grep -c 'case "rich-text-field"' viewmodel-shell/src/browser.ts` | 1 |
| `grep -c 'case "rich-text-toolbar"' viewmodel-shell/src/browser.ts` | 1 |
| `grep -c '\.vms-rich-text-field' viewmodel-shell/styles/default.css` | 15 (spec: ≥ 6) |
| `grep -c '\.vms-rich-text-field--state-active' viewmodel-shell/styles/default.css` | 2 (spec: exactly 2) |
| `grep -c '\.vms-rich-text-field__editor' viewmodel-shell/styles/default.css` | 4 |
| `grep -c '\.vms-rich-text-field__toolbar-default' viewmodel-shell/styles/default.css` | 2 |
| Raw hex/rgb/hsl color count in new CSS section | 0 (spec: 0 — every color goes through `--vms-*` tokens) |

## Deviations from Plan

**1. [Interpretive] Test file split into TWO files (7 tests total), not ONE file (6 tests)**

- **Found during:** Task 4 test-file drafting.
- **Issue:** Plan spec says "6 tests in `test/rich-text.test.ts`" and lists the fail-loud test as one of the six. Landing the fail-loud test in the SAME file as the success-path tests would either (a) require the vi.mock factory to conditionally throw (fragile, hard to reason about) or (b) split the mock scope per-test with `vi.doMock` in a `beforeEach` (Vitest's per-test mock override is patchy and requires careful cleanup).
- **Fix:** Followed the SHIPPED ChartNode precedent (chart.test.ts + chart-missing-dep.test.ts as siblings). Vitest isolates module mocks per FILE, so a rejecting mock in a sibling file cannot contaminate the success-path mocks. Delivered 6 tests in `rich-text.test.ts` + 1 test in `rich-text-missing-dep.test.ts` = 7 tests, which exceeds the plan's floor of 6 and covers every acceptance-criterion sub-property.
- **Files affected:** created 2 test files instead of 1.
- **Rule applied:** Rule 3 (blocking issue — the single-file approach would not have cleanly proven the fail-loud + no-op-on-lazy contract without brittle mock plumbing; the sibling-file pattern is the shipped ChartNode precedent).

**2. [Rule 2 — Auto-add missing critical functionality] `richTextField()` renderer emits a `role="toolbar"` on the default-toolbar strip**

- **Found during:** Task 2 writing.
- **Issue:** The plan's default-toolbar description says "one `<button>` per D-08 tool"; a11y-wise a toolbar strip should carry `role="toolbar"` so screen readers announce it as a toolbar rather than a bag of buttons. Not explicitly in the plan but AGENTS.md §"Design system" bakes a11y into the shipped rendering.
- **Fix:** Added `strip.setAttribute("role", "toolbar")` in `renderDefaultRichTextToolbar()`. Also added `aria-label` on each `<button>` (mirrors the tool's user-facing label) so a screen reader distinguishes them by function, not by their visual glyph.
- **Files modified:** `viewmodel-shell/src/browser.ts` (rolled into commit `4833517`).
- **Rule applied:** Rule 2 (a shipped a11y-first framework should never emit a nameless button-cluster without a role).

**3. [Rule 2] `window.prompt('URL')` guarded by `typeof window !== 'undefined'` in `applyRichTextTool()` link case**

- **Found during:** Task 2 writing.
- **Issue:** The plan says link tool "sets a URL"; the minimum interactive shape is `window.prompt` (the alternative is a full LinkPopover composite which is out of scope). But `prompt()` is undefined in non-browser adapters (jsdom does define it as null-returning; a hypothetical Node-side adapter would crash without a guard).
- **Fix:** Guarded with `typeof window !== 'undefined' ? window.prompt?.("URL") ?? null : null` — safe in every environment, correct in browser.
- **Files modified:** `viewmodel-shell/src/browser.ts` (rolled into commit `4833517`).
- **Rule applied:** Rule 2 (defensive coding around an environment-specific API; a browser-adapter method shouldn't be able to crash a non-browser adapter that legitimately reuses `browser.ts`).

**4. [Interpretive] test-types coverage NOT extended — `test/**/*.ts` already covers rich-text.test.ts + rich-text-missing-dep.test.ts**

- **Found during:** Task 4 pre-check.
- **Issue:** Plan's read_first says "the file must be explicitly added to the include list per the banked check:test-types-easy-to-forget lesson".
- **Fix:** No fix needed — `viewmodel-shell/tsconfig.test.json` already carries `"include": ["test/**/*.ts", "src/**/*.test.ts"]`, so both new test files land in coverage automatically. `check:test-types` exits 0 without any tsconfig.test.json edit.
- **Files modified:** none.

**5. [Placement discretion] `dependencies` block placed BETWEEN `bin` and `scripts`, not adjacent to `devDependencies`**

- **Found during:** Task 1 pre-check.
- **Issue:** Plan says "placed adjacent to `devDependencies`". Literal placement would move the block right after `devDependencies` (line 43-57). That works, but npm convention is `dependencies` before `devDependencies`, and the JSON reader-order convention is: `bin` → `dependencies` → `scripts` → `devDependencies` → `optionalDependencies` → `peerDependencies`.
- **Fix:** Placed the `dependencies` block between `bin` and `scripts` (line 31-35), following npm's own convention. All acceptance-criteria greps (`grep -A5 '"dependencies":' package.json`) pass regardless of placement.
- **Files modified:** none additional (this is where the initial Edit landed).

No other deviations. No Rule 4 architectural-decision escalations. No authentication gates. No pre-existing test failures encountered.

## Self-Check

**1. Created files exist:**

- `viewmodel-shell/test/rich-text.test.ts` → FOUND (416 lines).
- `viewmodel-shell/test/rich-text-missing-dep.test.ts` → FOUND (81 lines).
- `.planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-03-SUMMARY.md` → FOUND (this file).

**2. Modified files exist and contain the expected additions:**

- `viewmodel-shell/package.json` → FOUND. `dependencies` block present with all 3 packages; `@types/turndown` in devDependencies.
- `viewmodel-shell/package-lock.json` → FOUND. Contains `@tiptap/core` (23 references), `@tiptap/starter-kit` (3 references), `turndown` (3 references).
- `viewmodel-shell/src/browser.ts` → FOUND. Contains richTextField (3 refs), loadRichText (4 refs), richTextFailLoud (3 refs), editorInstances (13 refs), both dispatch arms, all three `import(...)` sites exactly once each, ZERO top-level tiptap/turndown imports.
- `viewmodel-shell/styles/default.css` → FOUND. Contains `.vms-rich-text-field` (15 refs), `--state-active` (2 refs), `__editor` (4 refs), `__toolbar-default` (2 refs); zero raw hex/rgb/hsl in new section.

**3. Commits exist:**

- `1d36d38` → FOUND (`chore(28-03): add @tiptap/core + @tiptap/starter-kit + turndown to dependencies`).
- `4833517` → FOUND (`feat(28-03): add richTextField() + loadRichText() + richTextFailLoud() + placeholder richTextToolbar()`).
- `dc016e8` → FOUND (`feat(28-03): add .vms-rich-text-field CSS (wrapper, editor host, default toolbar, STYLE-3 state axis)`).
- `aa76e51` → FOUND (`test(28-03): add rich-text adapter tests (D-04 lazy-load symmetric + fail-loud + round-trip + mark-sweep)`).

**4. Build + tests + all gates green:**

- `npm run build` → exit 0.
- `npm run check:test-types` → exit 0.
- `npm run check:core-globals` → exit 0.
- `npm run check:aa-contrast` → exit 0 (13/13 pairs meet WCAG-AA on all 13 themes).
- `npm run check:no-demo-style` → exit 0.
- `npm run check:theme-byte-identity` → exit 0.
- `npm run check:theme-function` → exit 0.
- `npm run check:demo-types` → exit 0.
- Full framework `npx vitest run` → 81 test files, 1322 pass, 1 skip, 0 fail.

## Self-Check: PASSED
