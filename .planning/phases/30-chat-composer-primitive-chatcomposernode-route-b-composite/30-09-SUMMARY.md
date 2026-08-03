---
phase: 30-chat-composer-primitive-chatcomposernode-route-b-composite
plan: 09
subsystem: ui
tags: [chat-composer, verification-page, tailnet-sign-off, iframe-scoped-panels, vite, bun-serve, route-b-composite]

# Dependency graph
requires:
  - phase: 30-*
    provides: "Plans 30-01..30-06 shipped ChatComposerNode primitive + parity + adapter tests; Plan 30-05 shipped composer registry + attachment chip strip that Panel 12 exercises."
  - phase: 28-*
    provides: "RichTextFieldNode (v8.2.0) — Panel 10 drops one into inputSlot to prove the composer's opt-in rich-text path."
provides:
  - "demo/ChatComposerVerification-bun/ — tailnet-served comprehensive verification page for ChatComposerNode (12 iframe-scoped panels × 13 shipped themes)."
  - "Live URL for Ashley's visual sign-off, gating Plans 30-10 (Angel adopter) and 30-11 (green-tree + release ritual)."
  - "Iframe-scoped panel pattern for future composite verification demos (each iframe carries own default.css + own #theme-css link + own VMS mount + own validated tree fetch)."
affects: ["30-10 (Angel adopter)", "30-11 (green-tree + release ritual)", "future Route B composite verification demos"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Iframe-scoped verification panels (Vicky's tasting-artifact pattern) — each panel loads own shipped CSS + own theme link + own VMS mount; parent postMessage broadcasts theme changes; each iframe subscribes with event.origin guard."
    - "Server-side validated per-panel tree: /api/panel/{N}/tree runs the constructed VM through the REAL shipped validators (validateActionNames + validateSectionAction) BEFORE returning; a validator throw produces an inline danger-tone banner so a rejected tree fails VISIBLY at load (banked lesson from Phase 21/24 real-validator shim)."
    - "Vite multi-entry build: rollupOptions.input maps 13 entrypoints (index + 12 panels) so per-panel HTMLs share the single main.ts bundle."

key-files:
  created:
    - "demo/ChatComposerVerification-bun/package.json"
    - "demo/ChatComposerVerification-bun/tsconfig.json"
    - "demo/ChatComposerVerification-bun/vite.config.ts"
    - "demo/ChatComposerVerification-bun/server.ts"
    - "demo/ChatComposerVerification-bun/index.html"
    - "demo/ChatComposerVerification-bun/src/main.ts"
    - "demo/ChatComposerVerification-bun/panels/panel-{1..12}.html"
    - "demo/ChatComposerVerification-bun/.gitignore"
  modified: []

key-decisions:
  - "Server-side validation (not client-side shim). Original draft imported viewmodel-shell/server validators into the browser bundle; Vite rejected the transitive node:fs/url/path imports in the shipped server.ts. Refactored to build + validate the panel VM SERVER-SIDE in server.ts (per-panel /api/panel/{N}/tree endpoint) and let each iframe's client bundle just fetch. Cleaner AND preserves the banked-lesson invariant (a permissive shim would hide validator bugs) — the shim IS the server, and it enforces the real contract."
  - "Iframe-scoped panels (NOT single-canvas like Phase 28). Adopted from Vicky's tasting artifact per plan §truths. Each of the 12 panels is a separate iframe with own shipped CSS + own theme link + own VMS mount. Parent postMessage broadcasts theme changes; each iframe's inline <script> subscribes and swaps its own #theme-css href. Prevents CSS/JS cross-contamination between panels demonstrating different variants side-by-side (which matters for e.g. panel 6 disabled vs. panel 4 streaming appearing on-screen together)."
  - "Autonomous: false — Ashley's visual sign-off is a legitimate autonomous:false gate per her 2026-07-31 correction (banked in Vicky's identity). The plan HALTS after server-up; Vicky relays the URL to Ashley."

patterns-established:
  - "Iframe-scoped verification demo: 13-entry Vite build (parent + N panels), each panel HTML carries own /vms/default.css + own #theme-css link + own inline theme-swap subscriber, parent broadcasts via postMessage(same-origin), each panel fetches its VM from /api/panel/{N}/tree which invokes REAL shipped validators before returning."
  - "Zero-<style> HTML discipline: even comment mentions of literal '<style' HTML substring trip check:no-demo-style (case-insensitive substring match). Verification demo HTMLs use inline style='' attrs exclusively (the sanctioned exception, per RichTextVerification-bun + StateAxisVerification-bun precedent)."

requirements-completed: [CHAT-17, CHAT-18]

# Metrics
duration: ~30min
completed: 2026-08-02
---

# Phase 30 Plan 09: ChatComposerNode tailnet verification page — 12 iframe-scoped panels × 13 themes for Ashley sign-off Summary

**Comprehensive verification demo shipping 12 iframe-scoped panels covering every ChatComposerNode wire field × slot combo × state variant, served on tailnet against the real shipped bundle + real shipped CSS + real tree validator, gating Ashley's visual sign-off for CHAT-17/CHAT-18 before Plans 30-10 (Angel adopter) and 30-11 (green-tree + release ritual).**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-08-03T02:24Z
- **Completed:** 2026-08-03T02:55Z
- **Tasks:** 3 of 4 executor tasks complete (Task 4 = Ashley's visual sign-off, awaiting)
- **Files created:** 19

## Server details (for Vicky to relay to Ashley)

- **Live URL:** `http://100.113.23.63:3023/`
- **Local URL:** `http://localhost:3023/`
- **PID file:** `demo/ChatComposerVerification-bun/server.pid` — current PID `3069896`
- **Auto-kill:** 60 min from spawn (spawn 2026-08-03T02:55Z; expires ~2026-08-03T03:55Z)
- **Cleanup command:** `kill $(cat demo/ChatComposerVerification-bun/server.pid)`

## Smoke tests (all pass, pre-handoff)

| Endpoint | Status |
|---|---|
| `GET /` (parent index) | 200 |
| `GET /vms/default.css` | 200 |
| `GET /api/themes` | 200 (12 themes enumerated: dark-{amber,blue,green,purple,rose,teal}, light-{amber,blue,green,purple,rose,teal}) |
| `GET /panels/panel-{1..12}.html` | 200 × 12 |
| `GET /api/panel/{1..12}/tree` | 200 × 12, `_validator: passed` × 12 |
| Tailnet reach test (`GET http://100.113.23.63:3023/`) | 200 |

All 27 smoke tests pass. All 12 per-panel trees are validated by the REAL shipped validators server-side before being returned.

## The 12 panels

Every panel exercises a distinct wire-field / slot / state variant of ChatComposerNode. Full source: `demo/ChatComposerVerification-bun/server.ts` (`PANELS: Record<number, PanelSpec>` catalog).

1. **DEFAULT** — bare `bind:"draft" + sendAction:{name:"send"}`; correct pill shape, correct 34px send button, textarea grows on typing.
2. **WITH ATTACH** — `attachAction` set; leading paperclip visible + clickable + opens file-picker.
3. **ALL SLOTS FILLED** — `headerSlot: TextNode(tone:"info")`, `leadingSlot: IconNode("sparkles")`, `trailingSlot: TextNode("GPT-4")`, `footerSlot: TextNode(tone:"info", "AI can make mistakes…")`.
4. **STREAMING** — `status:"streaming" + stopAction:{name:"stop"}`; send button swaps to square stop icon; click fires stopAction.
5. **SENDING** — `status:"sending"`; spinner icon; button disabled.
6. **DISABLED** — `disabled:true`; whole composer muted; all inputs blocked.
7. **submitMode ctrl-enter** — `submitMode:"ctrl-enter"`; plain Enter → newline; Ctrl+Enter → dispatch. Draft seeded so behavior is testable immediately.
8. **dropScope global** — `dropScope:"global"`; drag file outside composer element but inside panel body → dashed border affordance fires + drop lands.
9. **MAX-FILE VALIDATION** — `maxFiles:2, maxFileSize:1024, accept:["image/*"]`; attach 3 files → 3rd rejected; >1KB file → size error; PDF → type error. Framework's inline validation banner surfaces the message.
10. **INPUT SLOT — RichTextFieldNode** — `inputSlot: RichTextFieldNode` (v8.2.0); TipTap editor replaces default textarea; composer's send + attach still work. Seeded with markdown so Ashley immediately sees the shipped editor rendering.
11. **maxRows=3** — `maxRows:3`; textarea auto-grows up to 3 lines then scrolls internally. Draft seeded with 5 lines so the cap is visible immediately.
12. **HEADER SLOT COMPOSITION WITH ATTACHED FILES** — `headerSlot: TextNode("Editing message #42", tone:"warning")`; a client-side `afterMount` hook triggers a fake `ClipboardEvent("paste")` with two mock files 250ms after load, so the framework's chip strip renders ABOVE the consumer's headerSlot content (both visible together — the composition contract).

## Theme switcher

Parent chrome carries the `<select>` populated from `/api/themes` (enumerated from `viewmodel-shell/styles/themes/` at server startup). On change, the parent posts `{type:"theme", href:"…"}` to every iframe via `postMessage(same-origin)`; each iframe's inline `<script>` subscribes and swaps its own `#theme-css` `<link>` href. All 12 shipped themes + the light default are reachable via the dropdown.

## Task Commits

1. **Tasks 1-3 (scaffold + panel VMs + serve on tailnet):** committed together — the demo is a single unified surface, and Vite's multi-entry build binds the parent + 12 panel HTMLs + shared main.ts as one shippable artifact. See commit body for the full file list.
2. **Task 4 (Ashley visual sign-off):** AWAITING (this plan is `autonomous:false`; execution HALTS here per the plan-checker M-2 clarification).

## Files Created

- `demo/ChatComposerVerification-bun/package.json` — 19 lines. `demo-chat-composer-verification-bun`, links to `@ashley-shrok/viewmodel-shell` local src.
- `demo/ChatComposerVerification-bun/tsconfig.json` — 15 lines. Strict TS; discovered + type-checked by `check:demo-types` automatically.
- `demo/ChatComposerVerification-bun/vite.config.ts` — 71 lines. 13 rollupOptions.input entries; regex aliases per gotcha #3.
- `demo/ChatComposerVerification-bun/server.ts` — 583 lines. Bun.serve on 0.0.0.0:3023 (first-free ≥ 3023); serves shipped CSS + Vite-built client + `/api/themes` + `/api/panel/{N}/tree` with REAL shipped validator invoked per-panel; writes PID + 60-min auto-kill.
- `demo/ChatComposerVerification-bun/index.html` — 259 lines. Parent chrome with theme switcher + 12-iframe grid (inline `style=""` attrs only, zero literal style-blocks per `check:no-demo-style`).
- `demo/ChatComposerVerification-bun/src/main.ts` — 141 lines. Per-iframe VMS mount reading `window.__PANEL_INDEX__`; fetches from `/api/panel/{N}/tree`; runs afterMount hook (panel 12 fake-paste).
- `demo/ChatComposerVerification-bun/panels/panel-{1..12}.html` — 32 lines each. Each carries own `<link rel="stylesheet" href="/vms/default.css">` + own `<link id="theme-css">` + own inline theme-swap subscriber (per plan-checker M-2 iframe-CSS-wiring requirement) + sets `window.__PANEL_INDEX__` before loading main.ts.
- `demo/ChatComposerVerification-bun/.gitignore` — gitignores `server.pid`, `dist/`, `node_modules/`.

## Decisions Made

See `key-decisions` in frontmatter. In short: **(1)** server-side validation instead of client-side shim (Vite can't bundle `viewmodel-shell/server`'s node:fs imports for the browser); **(2)** iframe-scoped panels (adopted from Vicky's tasting artifact per plan §truths); **(3)** `autonomous:false` HALT after server-up (Ashley's visual sign-off is the legitimate gate).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Refactored real-validator invocation from browser bundle to server**
- **Found during:** Task 1 (initial `bun run build`)
- **Issue:** Plan §interfaces + §tasks called for the fetch shim to invoke `validateActionNames + validateSectionAction` from `viewmodel-shell/src/server` inside each iframe's browser bundle. Vite rejected this: `server.ts` imports `node:fs`, `node:url`, and `node:path` for the `AGENT_SKILL_MARKDOWN` embed, and Rollup's browser-external stubbing produces `"dirname" is not exported by "__vite-browser-external"` at build time.
- **Fix:** Moved the panel VM catalog + validator invocation to `server.ts` (Bun runtime, where node imports resolve correctly). Client `src/main.ts` fetches from `/api/panel/{N}/tree`; the server invokes both validators BEFORE returning any tree; a validator throw produces an inline `variant:"card" + tone:"danger"` error tree so the failure surfaces VISIBLY at load. The banked-lesson invariant is preserved: the shim IS the server, and it enforces the real contract. A permissive shim would still hide validator bugs — this one doesn't.
- **Files modified:** `demo/ChatComposerVerification-bun/server.ts` (grew from ~150 to 583 lines with the PANELS catalog + `buildValidatedTree`), `demo/ChatComposerVerification-bun/src/main.ts` (simplified from ~380 to 141 lines — no client-side shim).
- **Verification:** All 12 `/api/panel/{N}/tree` responses report `"_validator": "passed"`; the danger-tree fallback is verified by construction (unreachable in this catalog but structurally tested against the same code path validators exercise everywhere).

**2. [Rule 3 - Blocking] Removed literal '<style' substring from index.html comment**
- **Found during:** Post-build gate check (`node scripts/check-no-demo-style.mjs`)
- **Issue:** `check:no-demo-style` uses case-insensitive `/<style/i` substring match with no word boundary. A code-comment mention of "Zero `<style>` block" in the parent index.html tripped the guard even though no literal style-block existed.
- **Fix:** Rewrote the comment to say "Zero literal style-blocks anywhere in this file" — same meaning, no `<style` substring.
- **Files modified:** `demo/ChatComposerVerification-bun/index.html` (one comment line).
- **Verification:** `node viewmodel-shell/scripts/check-no-demo-style.mjs` now passes; 36 hand-edited frontend HTML files are zero-`<style>`.

---

**Total deviations:** 2 auto-fixed (both Rule 3 — Blocking; both surfaced by structural gates the plan didn't anticipate)
**Impact on plan:** Both fixes preserved the plan's intent exactly — the real-validator invariant is enforced, just server-side instead of client-side; the comment rewrite is byte-neutral for meaning. No scope creep; the demo delivers the 12 panels + iframe scoping + real bundle + real CSS + real validator as specified.

## Ashley's verbatim sign-off

**AWAITING** — Vicky to relay `http://100.113.23.63:3023/` to Ashley; Ashley cycles through the 12 panels × 13 themes and responds with one of:

- `verify ok — proceed to Angel adopter + green-tree` (Plans 30-10 + 30-11 unblock)
- `verify ok — with: <list>` (proceed; follow-ups banked)
- `verify blocked: <what>` (HALT; follow-up plan closes the blocker)

**This section is deliberately left empty for Vicky to fill after Ashley responds.**

## Per-theme follow-up notes

*(To be filled in after Ashley's sign-off — Ashley may flag e.g. "light-amber contrast on tone:info footer is weak" as a follow-up item that Plan 30-10/30-11 close.)*

## Issues Encountered

- **Vite browser-bundling of `viewmodel-shell/server`** — the shipped server.ts imports `node:fs`/`node:url`/`node:path` at module top-level to read `AGENT_SKILL_MARKDOWN`. Rollup's browser-external plugin stubbed those imports and the build failed. Root cause: the plan's fetch-shim design assumed the validator functions could be tree-shaken independent of the module's side-effect imports. Solution documented as deviation #1.
- **`check:no-demo-style` substring bite** — the guard's case-insensitive `/<style/i` regex has no word boundary; even comment mentions of "`<style>`" trip it. RichTextVerification-bun avoided this by never mentioning the substring in comments; my initial draft mentioned it once in the parent index.html and had to rewrite. Deviation #2 above; noted here so future verification-page authors know.

## Self-Check

- `demo/ChatComposerVerification-bun/package.json`: FOUND
- `demo/ChatComposerVerification-bun/tsconfig.json`: FOUND
- `demo/ChatComposerVerification-bun/vite.config.ts`: FOUND
- `demo/ChatComposerVerification-bun/server.ts`: FOUND
- `demo/ChatComposerVerification-bun/index.html`: FOUND
- `demo/ChatComposerVerification-bun/src/main.ts`: FOUND
- `demo/ChatComposerVerification-bun/panels/panel-{1..12}.html`: FOUND (12 files)
- Server process (PID 3069896): RUNNING
- Tailnet URL `http://100.113.23.63:3023/`: 200
- `/api/panel/{1..12}/tree`: 200 × 12, validator `passed` × 12

## Self-Check: PASSED

## Next Phase Readiness

- **Plan 30-10 (Angel adopter):** BLOCKED until Ashley's `verify ok`. Once unblocked, Angel migrates his `/ai` chat compose surface from hand-rolled 40/40/10 primitives to a single `ChatComposerNode`.
- **Plan 30-11 (green-tree + release ritual):** BLOCKED until Ashley's `verify ok` AND Plan 30-10 lands. Once unblocked, the phase closes with the standing green-tree gate (full framework tests + parity + core-globals + `check:demo-types` + `check:no-demo-style` + `check:aa-contrast` + framework .NET Tests + every demo *.Tests.csproj) then the v9.1.0 dual publish + tagging.
- **Verification server:** stays UP until Ashley responds OR the 60-min auto-kill fires. If Ashley responds after auto-kill, Vicky re-runs `cd demo/ChatComposerVerification-bun && bun run dev` and passes the new URL.

---
*Phase: 30-chat-composer-primitive-chatcomposernode-route-b-composite*
*Completed: 2026-08-02 (Task 4 awaiting)*
