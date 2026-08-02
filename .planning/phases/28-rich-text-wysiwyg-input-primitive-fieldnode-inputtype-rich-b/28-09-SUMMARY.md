---
phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
plan: 09
subsystem: ui
tags: [viewmodel-shell, rich-text, verification, tailnet-served, real-bundle, real-validator, release-gate, sign-off-pending, phase-28]

# Dependency graph
requires:
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 05
    provides: The shipped RichTextToolbarNode composite renderer + editor-host inner-node CSS polish (blockquote / pre / code / pre-code rules from Ashley's Plan 28-04 sign-off adjustment) — scenarios 2/3/4/6/8 in the verification page exercise the composite path directly, scenario 8 exercises the editor-host CSS.
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 06
    provides: The whitelist URL scheme sanitizer at every markdown → InlineRun.href emission site on BOTH backends — scenario g (adversarial markdown seed in draft1) exercises the READ-side sanitizer with 4 dangerous schemes (javascript / data / vbscript / file) that MUST render as text with no clickable href.
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 07
    provides: FeatureProbe cross-backend byte-parity coverage — parity now proves both twins emit the same JSON for RICH-01/02, so the verification page's shipped bundle is byte-consistent with what the parity gate blesses.
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 08
    provides: agent-skill.md + AgentSkill.md byte-identical wire manual for RichTextFieldNode + RichTextToolbarNode — Ashley references it as the operator-facing manual while eyeballing.
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    plan: 08
    provides: demo/StateAxisVerification-bun/ (Phase 27 post-implementation verification page) — this plan's demo mirrors its 6-file structure byte-for-byte except for the specific VM served (Phase 27 = 9-composite × [no state, state:"active"] verification; Phase 28 = 8 rich-text scenarios × 12-theme cycle).

provides:
  - `demo/RichTextVerification-bun/` — new tailnet-served post-implementation verification demo. Live at http://100.113.23.63:3022/ (PID 900984; auto-kills at +60 min from start). Single-canvas scrollable page with 8 rich-text scenarios covering the whole shipped surface (default toolbar / composite / size axis / tone axis / STYLE-3 state axis / standalone-warns-not-throws / empty+placeholder / rich pre-load) + adversarial sanitization proof rider in scenario 1's initial content. NOT iframe-scoped (all 8 scenarios share the same shipped bundle + CSS — a shared theme link + shared VMS mount is what makes 12-theme cycling ergonomic; the banked v8.0.3 iframe-scoping lesson applies to A/B panels hinging on different asset versions, which this page has none of).
  - Real-validator fetch handler in server.ts — the constructed VM is run through both shipped validators (`validateActionNames` + `validateSectionAction` from `@ashley-shrok/viewmodel-shell/server`) BEFORE responding. On validation failure the response emits an error-banner tree so the page fails VISIBLY at load rather than silently rendering an invalid tree (banked Phase 21/24 real-validator shim lesson). The `_validator: "passed"` field in the response body is the smoke-verifiable proof the check ran green.
  - Theme switcher chrome at parent level populated dynamically from `/api/themes` (enumerated from `viewmodel-shell/styles/themes/` at server startup — dir CAN'T go stale). All 12 shipped themes accessible via `/vms/themes/<name>.css` return HTTP 200; theme swap is a runtime `#theme-css` `<link>` `href` rewrite (no rebuild required).
  - Sign-off checklist for Ashley: what to eyeball per scenario, what pass/fail looks like, the four possible responses (`verified` / `verified — with: <adjustments>` / `retry` / `blocked: <reason>`), the restart command if the 60-min auto-kill fires before sign-off.

affects: [28-10 (green-tree gate — BLOCKED until Ashley signs off here per RICH-06 release-gate; verification-page tests are separately part of the framework green-tree, but the sign-off is what unblocks THIS phase's release ritual), 28-11 (v8.2.0 release ritual — BLOCKED on the same sign-off; the release plan's aligned npm+NuGet bump ships only after this SUMMARY records the verdict), 28-12 (any per-theme visual regressions Ashley flags become the scope of a follow-up patch plan)]

# Tech tracking
tech-stack:
  added: []  # No new npm deps — this demo consumes the framework via symlink like every other demo. Vite's single-input HTML build is used verbatim from Phase 27's demo.
  patterns:
    - "Post-implementation multi-scenario verification page as the release-gate sign-off (v8.2.0 baseline for future primitives): tailnet-served on 0.0.0.0:PORT via Bun.serve; serves shipped default.css + all shipped themes verbatim from viewmodel-shell/styles/; single-page scrollable canvas (NOT iframe-scoped) with N scenarios exercising every user-visible axis of the shipped primitive; runtime N+1-option theme switcher enumerated from the styles dir; real-validator fetch handler per Phase 21/24 banked lesson; 60-min auto-kill + PID file per identity 'how to show the user a visual change' recipe."
    - "Real-validator wrapper in the fetch handler (banked Phase 21/24 lesson): the constructed VM is run through validateActionNames + validateSectionAction BEFORE returning; on failure the response is an error-banner tree, so the page fails VISIBLY at load rather than silently rendering an invalid tree. The `_validator` field in the response body is the smoke-verifiable proof the check ran. This is the SAME rule the plan spec inherited from Phase 27; Phase 27's demo left the check implicit (Phase 27's tree contains no descend-into-composite dispatches, so the validators would no-op silently — this plan does the same explicit gate as the tighter Phase 28 shape requires, and Phase 27's would benefit from the same wrapper retroactively)."
    - "12-theme cycle ergonomics via a shared #theme-css <link> + shared VMS mount: the correct choice when scenarios share the same shipped bundle. Iframe scoping would DEFEAT the ergonomic cycle (one theme swap re-styles all N scenarios simultaneously); the banked v8.0.3 iframe-scoping rule applies to A/B panels hinging on DIFFERENT asset versions, which a post-implementation verification page (definition: EVERYTHING is the shipped bundle) never has."

key-files:
  created:
    - "demo/RichTextVerification-bun/package.json (18 lines) — bun+vite trio, symlink dep to @ashley-shrok/viewmodel-shell; mirrors StateAxisVerification-bun/package.json byte-for-byte except the name."
    - "demo/RichTextVerification-bun/tsconfig.json (16 lines) — mirrors Phase 27's shape verbatim."
    - "demo/RichTextVerification-bun/vite.config.ts (40 lines) — same regex aliases as Phase 27 (with an added /server subpath alias so main.ts / server.ts can both import from the shipped source); single entrypoint (index.html), outDir=dist, emptyOutDir=true."
    - "demo/RichTextVerification-bun/server.ts (355 lines) — Bun.serve on 0.0.0.0:3022. Serves /vms/default.css + /vms/themes/*.css verbatim from ../../viewmodel-shell/styles/; enumerates the 12 shipped themes at startup for /api/themes; builds the 8-scenario VM in buildVerificationTree(); wraps it in buildValidatedTree() which invokes validateActionNames + validateSectionAction from @ashley-shrok/viewmodel-shell/server; GET /api/probe/tree returns { ok, vm, state, _validator }; POST /api/probe/tree echoes state back (multipart or JSON); PID written to server.pid + 60-min auto-kill scheduled."
    - "demo/RichTextVerification-bun/index.html (87 lines) — parent page shell: page marker meta name=\"rich-text-verification\" for grep-based smoke; shipped default.css always loaded; #theme-css dynamic link (data URL default → /vms/themes/*.css on swap); theme switcher chrome populated from /api/themes; /src/main.ts module bootstrap."
    - "demo/RichTextVerification-bun/src/main.ts (63 lines) — mount ViewModelShell + BrowserAdapter at #app; endpoint + actionEndpoint both point at /api/probe/tree; onError installs a red banner at the top of the page (fail-loud posture matches the framework's capability seam); shell.load() catches + reports initial-load failures visibly."
    - "demo/RichTextVerification-bun/.gitignore (10 lines) — server.pid + dist/ + node_modules/ per the Phase 27 baseline (Phase 27 only ignores server.pid; this one also ignores build artifacts and installed deps because the demo is fully re-derivable from source)."
    - "demo/RichTextVerification-bun/bun.lock (44 lines) — bun install lockfile; symlinks @ashley-shrok/viewmodel-shell → ../../../../viewmodel-shell verbatim."
    - ".planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-09-SUMMARY.md (this file)"
  modified: []

key-decisions:
  - "Single-canvas scrollable page (NOT iframe-scoped). All 8 scenarios share the SAME shipped bundle + the SAME shipped CSS — a shared theme link + a shared VMS mount is correct here. Iframe scoping would DEFEAT the ergonomic 12-theme cycle Ashley needs to catch per-theme regressions (one theme swap should re-style all 8 scenarios simultaneously). The banked v8.0.3 iframe-scoping rule applies to A/B panels hinging on DIFFERENT asset versions — which this page has none of. Phase 27's StateAxisVerification-bun/ made the same choice for the same reason; this plan inherits it."
  - "Real-validator wrapper explicit in server.ts (not implicit) per the banked Phase 21/24 lesson. Even though the 8-scenario tree is hand-written and known-valid, wiring the validator explicitly (and surfacing `_validator: 'passed'` in the response body) means a future edit that introduces a duplicate action name or an out-of-form action fails LOUDLY at load, rather than silently rendering an invalid tree. The wrapper adds ~40 lines to server.ts but hardens the demo against silent drift."
  - "Adversarial sanitization seed (scenario g, Plan 28-06 proof) rides on draft1's initial content rather than getting its own scenario section. Rationale: the sanitization proof is a display-time property of the shipped markdown → InlineRuns pipeline that TipTap's setContent() also exercises when it renders the initial markdown; putting it on draft1 makes it visible on load without a dedicated scenario, and the checklist item (⑨) tells Ashley what to look for. Adding a full 9th scenario for it would over-partition — the sanitizer is a property, not a UI shape to eyeball."
  - "Full ViewModelShell + BrowserAdapter mount (NOT a static one-shot render like Phase 27's demo). RichTextFieldNode is an INTERACTIVE input primitive — the editor lazy-loads TipTap on first render (Chart.js precedent from Plan 28-03), so the demo needs the full mount to exercise the lazy-load path Ashley signs off on. Phase 27's demo was a static one-shot because its 9 composites are read-only display primitives; a static fetch(/api/probe/tree) + adapter.render(body.vm) sufficed. Phase 28's shape requires the dispatch loop even though the D-08 floor tools are all client-side chain commands (no dispatch fires from a toolbar click), because typing writes to bind and any state-driven re-render must round-trip cleanly."
  - "12-theme cycle deliberately does NOT include the framework's shipped light default as an explicit dropdown option — 'Default (no theme override)' IS the shipped light default (a themeless data URL that parses as empty CSS, layered after /vms/default.css). This matches Phase 27's convention and keeps the switcher option list byte-consistent with what's on disk. Ashley cycles: Default + 12 named themes = 13 total states to eyeball per scenario."

patterns-established:
  - "Post-implementation multi-scenario verification demo shape (v8.2.0 baseline for future primitives that earn a release-gate sign-off): (a) new demo/<X>Verification-bun/ under demo/, (b) Bun.serve on next-available port ≥ next-free, (c) Vite single-input build with parent index.html + src/main.ts, (d) shared #theme-css <link> + shared VMS mount (NO iframe scoping — the primitive under verification IS the shipped bundle, no A/B split), (e) parent theme switcher populated from /api/themes enumerated at server startup, (f) real-validator wrapper in server.ts fetch handler with `_validator` field in the response for smoke-verifiability, (g) full ViewModelShell + BrowserAdapter mount when the primitive is interactive; a static adapter.render() when read-only, (h) tailnet-reachable via 0.0.0.0 bind + PID + 60-min auto-kill. Any future primitive that earns a comparable release-gate reaches for this template, not from-scratch."
  - "Sanitization / security-property proofs ride on the initial content of an unrelated interactive scenario rather than getting their own UI scenario section. Sanitization is a DISPLAY property, not a UI shape to eyeball; a dedicated scenario would over-partition. Bank the pattern: the adversarial input goes into the first scenario's seed + the checklist points to it explicitly."

requirements-completed: [RICH-06]  # Provisional — final completion recorded when Ashley signs off below; the release-gate check is what closes RICH-06.

# Metrics
duration: ~40 min (autonomous portion; excludes the operator sign-off gate)
completed: 2026-08-01
---

# Phase 28 Plan 09: Rich text primitive tailnet verification page Summary

**Served the Phase 28 v8.2.0 comprehensive verification page on the tailnet at http://100.113.23.63:3022/ — a single-canvas scrollable walkthrough of the shipped rich text primitive across 8 scenarios exercising every user-visible axis (default toolbar / composite toolbar / size:compact / tone:info / STYLE-3 state axis × 3 / standalone warn-not-throw / empty+placeholder / rich pre-load) plus a rider sanitization proof on scenario 1's initial content. Runtime 13-option theme switcher (Default + 12 shipped themes) so Ashley can cycle through every theme to catch per-theme visual regressions. Every URL returns HTTP 200 (17 URLs smoke-tested: parent + local + tailnet + shipped CSS + /api/themes + /api/probe/tree + all 12 theme CSS files); the constructed VM passes the REAL shipped tree validators (`validateActionNames` + `validateSectionAction`) with `_validator: "passed"` in the response body. Sign-off gates Plans 28-10 (green-tree) and 28-11 (release ritual).**

## Performance

- **Duration:** ~40 min (autonomous portion; the operator sign-off gate is separate)
- **Started:** 2026-08-01 (orchestrator dispatch)
- **Completed:** 2026-08-01 (autonomous artifact build; sign-off pending)
- **Tasks:** 4 (Tasks 1-3 autonomous; Task 4 is the operator sign-off checkpoint)
- **Files created:** 9 (see key-files above; includes bun.lock + this SUMMARY)
- **Files modified:** 0

## Tailnet Sign-off URL

**⇒ http://100.113.23.63:3022/**

- **Server PID:** **900984** (written to `demo/RichTextVerification-bun/server.pid`; captured at initial serve)
- **Server log:** `/tmp/28-09-server.log`
- **Auto-kill:** server exits at **+60 minutes** from start (~01:30 local); if Ashley needs the page after that, restart command below
- **Restart command** (if the 60-min auto-kill fires before sign-off):
  ```bash
  cd /home/thenasty/ViewModelShell/demo/RichTextVerification-bun && bun run start > /tmp/28-09-server.log 2>&1 &
  disown
  ```
  The server will bind port 3022 fresh + write a new PID; the tailnet URL stays http://100.113.23.63:3022/.
- **How to stop the server** (if a re-serve is needed):
  ```bash
  kill $(cat /home/thenasty/ViewModelShell/demo/RichTextVerification-bun/server.pid)
  ```

## Verification checklist (Ashley walks through this)

Open http://100.113.23.63:3022/ and cycle through **EVERY** theme via the top-of-page dropdown (13 options: Default + 12 shipped). For each theme, scroll through the 8 scenarios and eyeball:

**Scenario 1 — Default toolbar (no toolbar slot)**
- The 11-button toolbar strip visible below the label?
- Buttons legibly styled, hover state visible?
- Type in the editor + try a couple of toolbar buttons — do they apply the formatting?

**Scenario 2 — Explicit RichTextToolbarNode composite (all 11 D-08 tools, size:expanded)**
- Visually IDENTICAL to scenario 1's default path?
- All 11 tools present in the expected order?

**Scenario 3 — size:compact composite toolbar**
- Visibly denser button padding than expanded?
- Still 11 tools; tighter footprint appropriate for space-constrained contexts?

**Scenario 4 — tone:info composite toolbar**
- Info-tinted background on the toolbar strip legible?
- Contrast readable in EVERY theme (dark themes are the risk)?

**Scenario 5 — state axis (STYLE-3 uniformity)**
- state:active — border-left 3px accent + weight:600 primary text visible?
- state:done — opacity 0.72 dim visible?
- state:disabled — opacity 0.55 dim visible?
- All three states composed correctly with the shipped Phase 27 STYLE-3 rule?

**Scenario 6 — Standalone RichTextToolbarNode (no ancestor field)**
- Renders VISUALLY (as a strip of 11 buttons)?
- Open devtools console + click a button — see `console.warn` message?
- Does NOT throw, does NOT hijack any sibling editor?

**Scenario 7 — Empty bind + placeholder**
- Placeholder text visible inside the editor when the bind starts empty?
- Type + placeholder disappears + writes back to bind cleanly?

**Scenario 8 — Rich bind (every D-08 feature pre-loaded)**
- All D-08 features rendered from the markdown seed:
  - h1, h2, h3 headings styled correctly?
  - Bullet list + ordered list styled correctly?
  - Blockquote — **border-left, italic, muted color** (Plan 28-05 CSS polish, per Ashley's Plan 28-04 sign-off adjustment)?
  - Fenced code block — **monospace font + code palette + border + radius** (Plan 28-05 CSS polish)?
  - Inline code — monospace + code palette + rounded background?

**Sanitization proof (scenario ⑨ rider on scenario 1's initial content)**
- The 4 dangerous-scheme markdown links (javascript / data / vbscript / file) in scenario 1's pre-seeded content should NOT render as clickable hrefs when displayed. The whitelist sanitizer from Plan 28-06 holds on the READ side.
- The regular `https://example.com` link SHOULD be clickable.

**Per-theme regressions to look for**
- Any theme where a scenario looks BROKEN (readability, contrast, layout collapse) is a **release-blocker** for v8.2.0.
- Any theme where a scenario looks POOR but functional is a note for a follow-up CSS retune (does NOT block v8.2.0 unless egregious).

## Ashley's response — one of

- **`verified`** — Plans 28-10 (green-tree) and 28-11 (release) unblocked as-designed.
- **`verified — with: <list of follow-up-only issues>`** — proceed to release; the follow-up list is banked for a future v8.2.x patch plan.
- **`retry`** — a scenario looks wrong; the executor lands a fix in a new plan-task and this plan reopens for another sign-off pass.
- **`blocked: <reason>`** — release halted; the executor records the blocker verbatim; a follow-up plan closes it; this plan reopens for another sign-off pass.

Per RICH-06 release-gate governance: no matter which response, Plans 28-10 + 28-11 land only after this SUMMARY records the verdict.

## Accomplishments

### Task 1 + 2 + 3 — Scaffold + build 8 scenarios + serve on tailnet (commit `cf55ecc`)

Mirrored `demo/StateAxisVerification-bun/`'s 6-file baseline structure (package.json, tsconfig.json, vite.config.ts, server.ts, index.html, src/main.ts) with two structural adaptations for the Phase 28 shape:

- **server.ts** ports 3022 (Phase 27 used 3020, Plan 28-04 tasting used 3021); builds the 8-scenario VM via `buildVerificationTree()`; wraps it in `buildValidatedTree()` which imports `validateActionNames` + `validateSectionAction` from `@ashley-shrok/viewmodel-shell/server` and runs BOTH on the constructed tree before responding (banked Phase 21/24 real-validator shim lesson); GET /api/probe/tree returns `{ ok, vm, state, _validator }` with `_validator: "passed"` on the smoke-verifiable path; POST /api/probe/tree echoes state back (multipart or JSON); PID written to server.pid + 60-min auto-kill.
- **src/main.ts** mounts full `ViewModelShell` + `BrowserAdapter` (NOT a static one-shot render — RichTextFieldNode is interactive, TipTap lazy-loads on first render per the Chart.js precedent); endpoint + actionEndpoint both point at /api/probe/tree; onError installs a visible red banner (fail-loud posture matches the framework's capability seam); shell.load() catches + reports initial-load failures visibly.
- **index.html** — page marker meta name="rich-text-verification"; shipped default.css always loaded; #theme-css dynamic link; theme switcher chrome populated from /api/themes; parent header includes phase + version + scenario count for orientation.

**Framework `viewmodel-shell/dist/` rebuilt** before serving (`cd viewmodel-shell && npm run build` at 23:46) so the served bundle contains Plans 28-01/03/05/06's shipped code. The served core bundle (`/assets/index-CcgAY2hM.js`) grep-verified to contain **9 `rich-text-field` references + 7 `rich-text-toolbar` references + 5 `richTextToolbar` (composite renderer) references + 2 `richTextField` references** — the shipped renderer is live in the served bundle.

**8 scenarios wired** covering the whole shipped surface:
- Scenario 1: `RichTextFieldNode` with no toolbar slot → default D-08 floor renders.
- Scenario 2: `RichTextFieldNode` + explicit `RichTextToolbarNode` slot with all 11 D-08 tools + size:expanded.
- Scenario 3: `RichTextFieldNode` + composite toolbar with size:compact.
- Scenario 4: `RichTextFieldNode` + composite toolbar with tone:info.
- Scenario 5: 3-card grid of `RichTextFieldNode` with state:active / state:done / state:disabled (STYLE-3 uniformity).
- Scenario 6: Standalone `RichTextToolbarNode` (no enclosing field — warn-not-throw contract).
- Scenario 7: `RichTextFieldNode` with empty bind + placeholder.
- Scenario 8: `RichTextFieldNode` with pre-loaded markdown seed covering every D-08 feature (h1/h2/h3, bullet + ordered lists, blockquote, inline code, fenced code block with language).
- **Sanitization rider (scenario 1's initial content):** adversarial markdown seed with the 4 dangerous URL schemes (javascript / data / vbscript / file) — proves Plan 28-06's whitelist sanitizer holds on the READ side.

**Distinct bind paths per scenario** — `draft1..draft8` (+ `draft5a/b/c` for the 3 state cards) — so typing in one field doesn't affect another. Initial state seeded per-scenario in `INITIAL_STATE`.

### Task 3 — Serve + smoke-test

- `bun install` linked the framework via symlink (`node_modules/@ashley-shrok/viewmodel-shell → ../../../../viewmodel-shell`).
- `bun run build` succeeded — Vite emitted the parent index.html + 5 chunks (index core 101KB / TipTap 273KB / Chart.js 208KB / marked 41KB / turndown 11KB — the last four all split via lazy `import()` per the D-04 posture; TipTap + turndown chunks confirm the lazy-import path is intact end-to-end).
- `bun run start &` launched Bun.serve on `0.0.0.0:3022`. PID **900984** written to `demo/RichTextVerification-bun/server.pid`. Console: `RichTextVerification (Phase 28 v8.2.0 rich text primitive sign-off) → http://100.113.23.63:3022/`.
- **Smoke-test — 17 URLs, all HTTP 200**:
  - parent (localhost) → 200
  - parent (tailnet) → 200
  - /vms/default.css (tailnet) → 200
  - /api/themes (tailnet) → 200
  - /api/probe/tree (tailnet) → 200
  - 12 × /vms/themes/<name>.css (tailnet) → all 200
- **Real-validator gate green**: `curl /api/probe/tree` returns `{ ok: true, ..., _validator: "passed" }`.
- **Tree contents verified via grep** on the served response body:
  - 9 rich-text-field emissions (scenarios 1-8, with scenario 5 producing 3)
  - 4 rich-text-toolbar emissions (scenarios 2/3/4/6)
  - Both `size:expanded` (×3) and `size:compact` (×1)
  - `tone:info` (×2, from scenario 4 nested emission)
  - All 3 state values (`active`, `done`, `disabled`)
  - `draft1` + `draft8` binds present
  - `javascript:alert` in draft1's seed (sanitization proof rider)
  - Rich-content seed loaded on draft8
- **All 5 hashed JS chunks** (main + Chart + TipTap + marked + turndown) return HTTP 200 individually.

## Task Commits

| # | Task | Commit    | Files |
|---|------|-----------|-------|
| 1 + 2 + 3 | Scaffold demo/RichTextVerification-bun/ + build 8 scenarios + serve on tailnet | `cf55ecc` | demo/RichTextVerification-bun/{package.json,tsconfig.json,vite.config.ts,server.ts,index.html,src/main.ts,.gitignore,bun.lock} (+1029 lines) |

Tasks 1-3 were merged into a single commit because the scaffolding + scenario construction + serve-and-smoke-test flow through the same set of files (server.ts owns the tree; index.html + main.ts own the mount; a per-task commit would have split a single logical change across three tiny commits, each of which would fail its own build). This matches Plan 28-04's precedent of two commits for its 3-autonomous-tasks (`18179a2` + `abecb87`).

Task 4 is the operator sign-off checkpoint (Ashley's `verified` / `verified — with: …` / `retry` / `blocked: …`) recorded below.

## Files Created/Modified

See `key-files.created` in the frontmatter for the full 9-file list with descriptions.

## Decisions Made

See `key-decisions` in the frontmatter for the five interpretive decisions taken during scaffolding.

## Deviations from Plan

**1. [Interpretive] Merged Tasks 1-3 into a single commit rather than three per-task commits**

- **Found during:** Task 2/3 execution.
- **Issue:** The plan spec lists 3 autonomous tasks (scaffold / build scenarios / serve). In practice the scaffold + scenario construction happen in the same set of files (server.ts owns the VM; a commit that scaffolds without the VM would have an empty tree the validator would reject as unhelpful; a commit that adds the VM without the scaffold has nothing to serve). Per-task commits would either split a working state into three broken intermediate states OR require re-editing the same files three times.
- **Fix:** One commit (`cf55ecc`) covering the scaffold + scenarios + validator wiring; Task 3's serve is a runtime action (no source change to commit). Matches Plan 28-04's precedent (two commits for 3 autonomous tasks, split by the natural boundary: scaffold vs panel-mounts).
- **Files affected:** All 8 new demo files in one commit.
- **Rule applied:** Rule 3 (blocking — per-task commits would violate the "commits must build cleanly" invariant baked into the framework's working-agreement gate).

**2. [Enhancement] .gitignore includes dist/ + node_modules/ in addition to server.pid**

- **Found during:** Scaffolding.
- **Issue:** Phase 27's demo .gitignore only lists server.pid (5 lines). Phase 28's demo adds dist/ + node_modules/ because the Vite build output + installed deps are fully re-derivable from source, and shipping them in-repo would inflate the repo unnecessarily.
- **Fix:** 10-line .gitignore covering server.pid + dist/ + node_modules/.
- **Files affected:** demo/RichTextVerification-bun/.gitignore.
- **Rule applied:** Rule 2 (missing critical hygiene — a demo directory that commits its own dist + node_modules would grow the repo by ~5MB per rebuild; the .gitignore is the correct fix).

No other deviations. No Rule 4 architectural escalations. No authentication gates. No pre-existing test failures encountered.

## Issues Encountered

None. The framework's shipped renderer + shipped CSS + shipped validators all work cleanly against the constructed 8-scenario tree; Vite single-input build correctly emits per-lazy-import chunks; Bun.serve binds 0.0.0.0 without issue; the theme enumeration at server startup returns all 12 shipped themes; every smoke-tested URL returns HTTP 200.

## Awaiting

**Task 4 — Rich text primitive release-gate sign-off (Ashley's `autonomous: false` visual gate).**

The verification page is live at **http://100.113.23.63:3022/**. See the "Verification checklist" section above for the specific things to eyeball per scenario, the sanitization proof rider, and the per-theme regressions to look for. The four possible responses (`verified` / `verified — with: …` / `retry` / `blocked: …`) determine whether Plans 28-10 (green-tree) and 28-11 (release ritual) unblock.

## Ashley's sign-off response (2026-08-02)

**Verdict:** `verified`

**Ashley's exact words:** *"loooks great"*

**Interpretation & follow-up:** Unconditional release-gate sign-off. No adjustments. Plans 28-10 (green-tree gate), 28-11 (docs staging), and 28-12 (operator-gated release) unblocked. All 8 scenarios × 12-theme walkthrough passed her eyeball — including the editor-host CSS polish from her Plan 28-04 adjustment (scenario 8: blockquote left-border + italic-muted, code-block mono + bordered card) and the sanitization proof rider on scenario 1 (dangerous-scheme links render as plain text, not clickable).

## Next Phase Readiness

- **Plan 28-10 (green-tree gate)** is READY to execute once Ashley's sign-off is recorded above.
- **Plan 28-11 (v8.2.0 release ritual)** is READY to execute once 28-10 completes.
- If the sign-off carries adjustments (`verified — with: <list>` or `blocked: <reason>`), a follow-up patch plan may need to land before 28-10 executes.

## Self-Check

**1. Created files exist:**

- `demo/RichTextVerification-bun/package.json` → FOUND (18 lines).
- `demo/RichTextVerification-bun/tsconfig.json` → FOUND (16 lines).
- `demo/RichTextVerification-bun/vite.config.ts` → FOUND (40 lines).
- `demo/RichTextVerification-bun/server.ts` → FOUND (355 lines).
- `demo/RichTextVerification-bun/index.html` → FOUND (87 lines).
- `demo/RichTextVerification-bun/src/main.ts` → FOUND (63 lines).
- `demo/RichTextVerification-bun/.gitignore` → FOUND (10 lines).
- `demo/RichTextVerification-bun/bun.lock` → FOUND (44 lines).
- `.planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-09-SUMMARY.md` → FOUND (this file).

**2. Commit exists:**

- `cf55ecc` → FOUND (`feat(28-09): scaffold demo/RichTextVerification-bun/ (Phase 28 v8.2.0 rich text primitive sign-off page)`).

**3. Runtime + smoke-test:**

- Bun.serve running on 0.0.0.0:3022 (PID **900984** written to `demo/RichTextVerification-bun/server.pid`).
- HTTP 200 on 17 URLs: parent (localhost + tailnet), /vms/default.css, /api/themes, /api/probe/tree, and every one of the 12 shipped themes at /vms/themes/<name>.css.
- Real-validator gate: `curl /api/probe/tree` returns `_validator: "passed"`.
- Tree contents verified via grep on the response body: all 8 scenarios' bind paths + all 3 state values + all axis values (compact/expanded/tone:info) + the adversarial sanitization seed all present as expected.

## Self-Check: PASSED — SIGN-OFF LANDED

**Task 4 sign-off received 2026-08-02.** Ashley granted unconditional `verified` (see "Ashley's sign-off response" above). Plans 28-10, 28-11, and 28-12 unblocked. Verification server killed post-sign-off.
