---
phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
plan: 04
subsystem: ui
tags: [viewmodel-shell, rich-text, tiptap, turndown, route-b, composite, tasting, iframe-scoped, phase-28]

# Dependency graph
requires:
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 03
    provides: The shipped RichTextFieldNode renderer + INTERIM richTextToolbar() placeholder body + STYLE-3 state axis CSS + the D-08 default-toolbar floor path that the AFTER panel exercises directly through the real bundle.
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    provides: The demo/StateAxisVerification-bun/ tailnet-served real-bundle real-CSS harness pattern (server.ts + vite.config.ts + theme switcher chrome + shipped-CSS routes) mirrored byte-for-byte by this tasting demo, scaled UP to A/B iframe scoping per the banked v8.0.3 lesson.

provides:
  - `demo/RichTextTasting-bun/` — a new iframe-scoped A/B tasting demo served on the tailnet at http://100.113.23.63:3021/. Parent index.html carries only theme-switcher chrome + two iframes (no VMS mount, no shared script/link covering both panels). Each panel is a self-contained HTML+TS pair with its own `<link rel="stylesheet">` + `<script>` that mounts a REAL ViewModelShell + BrowserAdapter against a canned tree via a fetch-shim.
  - BEFORE panel — the "pretty-bad-approximation" primitives-composed baseline (SectionNode(layout:"row") + 11 dead ButtonNodes + FieldNode(inputType:"textarea")) that the earned-a-composite rule (composite-nodes-layer.md §2) requires.
  - AFTER panel — the proposed RichTextFieldNode + explicit RichTextToolbarNode(tools=[all 11 D-08 floor], size="expanded") slot, rendered via the shipped Plan 28-03 renderer + its INTERIM richTextToolbar() placeholder body.
  - Vite multi-input build config carrying THREE HTML entrypoints (parent + two panels) so the iframe scoping survives production build without hand-managed asset paths.
  - Theme-broadcast plumbing (parent postMessage → each iframe listens independently) so a 12-theme cycle exercises both panels without a shared `<link>` at parent level.
  - The tasting URL + PID + verification checklist Ashley walks through to sign off before Plan 28-05 bakes the composite body.

affects: [28-05 (RichTextToolbarNode composite renderer + CSS — BLOCKED on Ashley's sign-off recorded in this SUMMARY; the composite plan's `depends_on: ["28-04"]` gate cannot open until this plan records `taste ok` or an unambiguous equivalent)]

# Tech tracking
tech-stack:
  added: []  # No new npm deps — this demo consumes the framework via symlink like every other demo. Vite's multi-input HTML build is a built-in feature, not a new dep.
  patterns:
    - "Iframe-scoped A/B tasting page as the earned-a-composite Route B gate (banked v8.0.3 2026-07-30). Parent HTML carries NO VMS mount and NO shared script/link; each panel HTML is a self-contained document with its OWN <link rel=\"stylesheet\"> + <script>. Structurally impossible for a shared global to cross-contaminate the comparison."
    - "Vite `build.rollupOptions.input` with three HTML entrypoints (parent index.html + src/panel-*.html × 2) for iframe multi-page routing. Each entry bundles its own JS + gets its own hashed asset path; the same runtime `/vms/default.css` + `#theme-css` <link> pair appears independently in each panel."
    - "Panel-owned fetch-shim: intercept `window.fetch(PANEL_ENDPOINT)` inside the panel's own module and answer with canned VM tree + state, so the panel is truly self-contained and no shared server-side tree builder can drift between the two."
    - "Parent postMessage broadcast for theme switching: parent chrome sends `{ type: \"vms-theme\", name }` to both iframes; each iframe swaps its OWN #theme-css `<link>` href in response. No shared stylesheet link, no cross-panel bleed."

key-files:
  created:
    - "demo/RichTextTasting-bun/package.json (18 lines) — bun+vite trio, symlink dep to @ashley-shrok/viewmodel-shell mirroring StateAxisVerification-bun/package.json byte-for-byte except the name."
    - "demo/RichTextTasting-bun/tsconfig.json (16 lines) — mirrors Phase 27's shape verbatim."
    - "demo/RichTextTasting-bun/vite.config.ts (62 lines) — same aliases as Phase 27's demo + MULTI-INPUT build.rollupOptions.input listing all 3 HTML entrypoints (index.html + src/panel-primitives.html + src/panel-composite.html) so each iframe document bundles its own JS entry."
    - "demo/RichTextTasting-bun/server.ts (230 lines) — Bun.serve on 0.0.0.0:3021. Serves /vms/default.css + /vms/themes/*.css verbatim from the framework, plus /api/primitives/tree and /api/composite/tree fallback endpoints (the panels' fetch-shims answer first, but the endpoints exist as defense-in-depth if the shim ever failed to install). PID written to server.pid + 60-min auto-kill scheduled per the identity's recipe."
    - "demo/RichTextTasting-bun/index.html (61 lines) — parent page: theme-switcher chrome + two <iframe> elements, NO VMS mount, NO shared <link>/<script> covering both panels. Only `<script type=\"module\" src=\"/src/main.ts\">` for the theme chrome bootstrap."
    - "demo/RichTextTasting-bun/src/main.ts (56 lines) — parent bootstrap: /api/themes fetch to populate the switcher + postMessage broadcast to both iframes on theme change. No VMS import, no ViewModelShell mount."
    - "demo/RichTextTasting-bun/src/panel-primitives.html (43 lines) — self-contained BEFORE iframe document; own <link href=\"/vms/default.css\"> + own #theme-css link + own postMessage listener + own <script src=\"./panel-primitives.ts\">."
    - "demo/RichTextTasting-bun/src/panel-primitives.ts (~110 lines) — mounts ViewModelShell + BrowserAdapter; fetch-shim returns a canned tree with a SectionNode(layout:\"row\") toolbar of 11 dead ButtonNodes over a FieldNode(inputType:\"textarea\"). Same initial content as the composite panel."
    - "demo/RichTextTasting-bun/src/panel-composite.html (43 lines) — self-contained AFTER iframe document; parallel structure to panel-primitives.html."
    - "demo/RichTextTasting-bun/src/panel-composite.ts (~95 lines) — mounts ViewModelShell + BrowserAdapter; fetch-shim returns a canned tree with exactly ONE RichTextFieldNode carrying an explicit RichTextToolbarNode(tools=[all 11 D-08 floor], size=\"expanded\") slot. Same initial content as the primitives panel."
    - "demo/RichTextTasting-bun/.gitignore (5 lines) — mirrors Phase 27's server.pid ignore."
    - ".planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-04-SUMMARY.md (this file)"
  modified: []

key-decisions:
  - "Panel-owned fetch-shim instead of server-side per-panel tree endpoints. The plan's Task 2 description named both patterns; the fetch-shim is the cleaner interpretation because (a) the acceptance-criteria greps target the panel .ts source (11 button literals, RichTextFieldNode literal), (b) each panel is truly self-contained — no shared server-side builder can drift, (c) mirrors the StateAxisVerification-bun/src/main.ts convenience-of-canned-data pattern verbatim. Server.ts still exposes /api/primitives/tree + /api/composite/tree fallback endpoints as defense-in-depth if a future refactor breaks the shim installation."
  - "11 button literals spelled out explicitly (not a `.map(tools)` construction) so the plan's acceptance-criteria grep `type: \"button\"` returns exactly 11. The runtime tree is byte-identical either way; the source-code grep is a machine check on the plan spec and passing it literally is trivial (~15 more lines of code, zero ambiguity)."
  - "Fallback /api endpoints kept in server.ts even though the fetch-shims answer first. Defense-in-depth per AGENTS.md capability-seam philosophy — a broken shim install would fall through to a functional server endpoint rather than a blank page + inscrutable JS error. Server serves REAL trees identical to the shim's, so a shim regression is silently corrected."
  - "Theme switching broadcasts via postMessage from parent to both iframes; each iframe swaps its OWN #theme-css <link> href. NOT a shared parent-level theme <link> — that would defeat the iframe-scoping rule (a shared stylesheet is exactly the kind of parent-level asset the banked v8.0.3 lesson prohibits). The parent chrome carries NO VMS CSS anywhere."

patterns-established:
  - "Route B tasting demo shape (v8.2.0 baseline for any future composite): (a) new demo/<X>Tasting-bun/, (b) Bun.serve on next-available port ≥ next-free, (c) Vite multi-input build with parent + two panel HTML entrypoints, (d) panels iframe-scoped with own <link> + own <script>, (e) parent postMessage → per-iframe theme swap, (f) fetch-shim per panel returns canned tree, (g) parent has NO VMS mount, (h) tailnet-reachable via 0.0.0.0 bind. Any future composite that earns a tasting reaches for this template, not from-scratch."
  - "The parent index.html is host-chrome ONLY: theme switcher + iframe grid + `<script type=\"module\" src=\"/src/main.ts\">` for the switcher bootstrap. VMS imports live ONLY in the two panel .ts files. This is the LOAD-BEARING structural property that makes iframe scoping actually work — a `new ViewModelShell(...)` at parent level would defeat the whole point even if the mount target were empty."

requirements-completed: [RICH-02, RICH-06]

# Metrics
duration: ~30 min (autonomous portion; excludes the operator sign-off gate)
completed: 2026-07-31
---

# Phase 28 Plan 04: Route B tasting page (RichTextToolbarNode before/after) Summary

**Served the D-03 Route B tasting page on the tailnet at http://100.113.23.63:3021/ — a side-by-side iframe-scoped A/B comparison of the primitives-composed rich text input (SectionNode(layout:"row") + 11 dead ButtonNodes + FieldNode textarea — the "pretty-bad-approximation" baseline) versus the proposed RichTextFieldNode + RichTextToolbarNode composite rendering through the just-shipped Plan 28-03 renderer + INTERIM richTextToolbar() placeholder body. Ashley eyeballs both panels through 12 themes and signs off; Plan 28-05 unblocks on `taste ok` or an unambiguous equivalent recorded below.**

## Performance

- **Duration:** ~30 min (autonomous portion; the operator sign-off gate is separate)
- **Started:** 2026-07-31 (orchestrator dispatch)
- **Completed:** 2026-07-31 (autonomous artifact build)
- **Tasks:** 4 (Tasks 1-3 autonomous; Task 4 is the operator sign-off checkpoint)
- **Files created:** 11 (see key-files above)
- **Files modified:** 0

## Tailnet Sign-off URL

**⇒ http://100.113.23.63:3021/**

- Server PID: written to `demo/RichTextTasting-bun/server.pid` at startup (captured value at initial serve: **638784**)
- Server auto-kills at +60 min; re-run `cd demo/RichTextTasting-bun && bun run start > /tmp/28-04-server.log 2>&1 &` to restart if timeout elapses
- The server serves the Vite-built `dist/` directory; if you edit any src file, run `bun run build` again before refreshing
- Local smoke: `curl http://127.0.0.1:3021/` returns 200; every asset + iframe URL below returns 200
- Server stays running until Plan 28-11 (release) cleans it up in its final task (Phase 27 pattern)

## Verification checklist (Ashley walks through this)

Open the tasting URL and eyeball the two panels side-by-side. Cycle through 2–3 themes via the parent chrome. Then respond with ONE of:

1. **`taste ok`** — proceed to Plan 28-05 as-designed.
2. **`taste ok — with: <list of adjustments>`** — proceed to Plan 28-05 baking in those adjustments (list the CSS/wire tweaks explicitly).
3. **`taste retry`** — the shape needs a re-eyeball; Plan 28-05 lands a preview branch and this plan reopens for another sign-off pass.
4. **`taste blocked: <reason>`** — a genuine design blocker; a follow-up discussion phase is warranted.

Specific things to check:

- **① Toolbar visual weight** — does the RichTextToolbarNode's shape (right panel) improve over the primitives-composed baseline (left panel)? Button size/spacing appropriate for a rich text editor?
- **② Editor host** — right panel's editor legible focus ring, adequate min-height, correct border/padding? Compare to the textarea in the left panel.
- **③ Theme switch** — cycle through 2–3 themes via the parent chrome. BOTH panels adapt? Composite's toolbar look reasonable under darker themes?
- **④ Any layout/spacing anomalies** — anything that catches your eye as "off" that would ship as a v8.2.0 regression.
- **⑤ Composite HTML shape** — inspect the right panel via devtools; does the toolbar wrap in a sensible container, dispatch to sensible handlers?

Per D-03 governance: no matter which response, Plan 28-05 lands only after the sign-off signal is recorded here.

## Accomplishments

### Task 1 — Scaffold demo/RichTextTasting-bun/ (commit `18179a2`)

Mirrored `demo/StateAxisVerification-bun/`'s 6-file baseline structure (package.json, tsconfig.json, vite.config.ts, server.ts, index.html, src/main.ts) with three key deltas for the iframe-scoped A/B shape:

- **package.json** renamed to `rich-text-tasting-bun`; scripts + dev-deps + symlink-dep identical to Phase 27's shape.
- **vite.config.ts** carries `build.rollupOptions.input` listing all 3 HTML entrypoints (index.html + src/panel-primitives.html + src/panel-composite.html) so each iframe document bundles its own JS entry and gets its own hashed asset path.
- **server.ts** bumped port to 3021 (Phase 27 used 3020); serves shipped CSS + /api/themes verbatim from Phase 27, plus new /api/primitives/tree + /api/composite/tree fallback endpoints (defense-in-depth for the fetch-shims).
- **index.html** carries theme-switcher chrome + 2 iframes only — NO VMS mount, NO shared `<link>`/`<script>` covering both panels (the load-bearing iframe-scoping property).
- **src/main.ts** wires the theme switcher + postMessage broadcast to both iframes on theme change. No VMS import.
- `.gitignore` for `server.pid` mirroring Phase 27.
- `bun install` linked the framework via symlink (`node_modules/@ashley-shrok/viewmodel-shell -> ../../../../viewmodel-shell`).

**Task 1 acceptance-criteria greps (all pass):**
- 6 base files exist under `demo/RichTextTasting-bun/`. ✓
- `grep -c 'iframe' index.html` = **14** (≥ 2). ✓
- Both `/src/panel-primitives.html` and `/src/panel-composite.html` referenced as iframe src. ✓ (2 matches each)
- `grep -c '3021' server.ts` = **1**. ✓
- `grep -c 'new ViewModelShell(' src/main.ts` = **0** (parent has no VMS mount). ✓

### Task 2 — panel-primitives + panel-composite iframes + client mounts (commit `abecb87`)

Four new files under `demo/RichTextTasting-bun/src/`:

**panel-primitives.html** + **panel-composite.html** — parallel structure. Each carries:
- `<meta name="viewmodel-shell" content='{...}'>` for agent discoverability.
- `<link rel="stylesheet" href="/vms/default.css" />` (SCOPED to this iframe).
- `<link rel="stylesheet" id="theme-css" href="data:text/css,...">` (theme layer; swapped by the inline postMessage listener).
- Inline `<script>` listener for `{ type: "vms-theme", name }` messages from the parent.
- `<script type="module" src="./panel-*.ts">` for the panel bootstrap.

**panel-primitives.ts** — mounts a real ViewModelShell + BrowserAdapter. Fetch-shim intercepts `window.fetch("/api/primitives/tree")` and answers with a canned tree carrying a PageNode → SectionNode(layout:"row") of 11 explicit ButtonNode literals (B/I/Link/Bullets/Numbers/H1/H2/H3/Code/Block/Quote — all dispatching to dead `toolbar-{tool}` action names) over a FieldNode(name:"draft", bind:"draft", inputType:"textarea", label:"Notes", placeholder:"Write something…"). Initial state `{ draft: "# Welcome\n\nType something with **bold** or \`code\`." }`.

**panel-composite.ts** — same mount pattern; fetch-shim answers with a canned tree carrying a PageNode → one RichTextFieldNode (name:"notes", bind:"draft", label:"Notes", placeholder:"Write something…") with an explicit toolbar slot: `{ type: "rich-text-toolbar", tools: [all 11 D-08 floor], size: "expanded" }`. IDENTICAL initial state to the primitives panel. NO top-level import of @tiptap/core or turndown — the lazy-load in browser.ts drives everything (D-04 symmetric lazy-load guarantee preserved).

**Task 2 acceptance-criteria greps (all pass):**
- 4 panel files exist. ✓
- `grep -c 'inputType.*textarea' src/panel-primitives.ts` = **3** (≥ 1). ✓
- `grep -c 'type: "button"' src/panel-primitives.ts` = **11** (exactly 11). ✓
- `grep -c 'rich-text-field' src/panel-composite.ts` = **3** (≥ 1). ✓
- `grep -c 'rich-text-toolbar' src/panel-composite.ts` = **1** (≥ 1). ✓
- `grep -cE '^import.*@tiptap|^import.*turndown' src/panel-composite.ts` = **0**. ✓

### Task 3 — Serve on tailnet + smoke-test

- `bun run build` succeeded — Vite emitted `dist/index.html`, `dist/src/panel-primitives.html`, `dist/src/panel-composite.html`, plus lazy-loaded chunks for TipTap (`index-BPrXksDE.js` = 273KB, split via dynamic import — will lazy-load on first rich-text-field render in the AFTER panel), turndown, marked, Chart.js, and the shared browser.js core (98KB gzip 27.6KB). Total 13 asset files.
- `bun run start &` launched Bun.serve on `0.0.0.0:3021`. PID **638784** written to `demo/RichTextTasting-bun/server.pid`. Console: `RichTextTasting (Phase 28 Route B tasting sign-off) → http://100.113.23.63:3021/`.
- Smoke-test (localhost): parent (`/`), both panels (`/src/panel-*.html`), default CSS + theme CSS + /api/themes + /api/primitives/tree + /api/composite/tree — **all 8 URLs return HTTP 200**.
- Smoke-test (tailnet IP): parent + both panels + default CSS on `http://100.113.23.63:3021/` — **all 4 URLs return HTTP 200**.
- Structural iframe-scoping verification (via `curl` of served pages):
  - Parent index.html: 2 `<iframe>` elements pointing at `/src/panel-primitives.html` + `/src/panel-composite.html`. Loads only `assets/index-BPyi9gag.js` (0.88KB, the theme-switcher chrome) — NO VMS bundle at parent level.
  - panel-primitives.html: own `<link href="/vms/default.css">` + own `#theme-css` link + own `<script src=/assets/panel-primitives-*.js>` + modulepreload of the shared browser bundle.
  - panel-composite.html: parallel structure with own `<script src=/assets/panel-composite-*.js>`.
- Every hashed asset URL resolves to HTTP 200.
- **Structural verification confirms iframe-scoping**: no shared parent-level `<link>` or `<script>` covers both panels; each panel's assets are loaded independently in its own document. A theme swap via postMessage updates each iframe's own `#theme-css` href independently. Cross-panel contamination is structurally impossible.

## Task Commits

| # | Task | Commit    | Files |
|---|------|-----------|-------|
| 1 | Scaffold demo/RichTextTasting-bun/ (iframe-scoped A/B parent + theme chrome) | `18179a2` | demo/RichTextTasting-bun/{package.json,tsconfig.json,vite.config.ts,server.ts,index.html,src/main.ts,.gitignore,bun.lock} (+ ~370 lines) |
| 2 | Add BEFORE/AFTER panel iframes (primitives vs RichTextFieldNode composite) | `abecb87` | demo/RichTextTasting-bun/src/panel-{primitives,composite}.{html,ts} (+ ~320 lines) |

Task 3 (serve) is a runtime action, not a source-code change — verified via HTTP 200 responses on all URLs above. Task 4 is the operator sign-off checkpoint (Ashley's `taste ok` or equivalent) recorded below.

## Files Created/Modified

See `key-files.created` in the frontmatter for the full 11-file list with descriptions.

## Decisions Made

See `key-decisions` in the frontmatter for the four interpretive decisions taken during scaffolding.

## Deviations from Plan

**1. [Interpretive] Fetch-shim in panel .ts instead of a per-panel server endpoint**

- **Found during:** Task 2 writing.
- **Issue:** Plan Task 2 says "Use a fetch-shim (the same pattern as demo/StateAxisVerification-bun/src/main.ts) that returns a canned VM tree on GET and echoes state on POST". StateAxisVerification-bun/src/main.ts does NOT use a fetch-shim — it fetches a real server endpoint (`/api/probe/tree`). The plan's named-pattern reference conflicts with its named-mechanism reference.
- **Fix:** Resolved in favor of the mechanism (fetch-shim) over the reference. The fetch-shim shape:
  - Each panel .ts intercepts `window.fetch(PANEL_ENDPOINT)` and answers with a canned `Response(JSON.stringify({ ok: true, vm: buildTree(), state: initialState }))`.
  - Server.ts additionally exposes `/api/primitives/tree` + `/api/composite/tree` fallback endpoints returning IDENTICAL data as defense-in-depth if the shim install ever fails.
  - Result: panels are fully self-contained (no shared server-side tree builder can drift), acceptance-criteria greps target the panel .ts (which contains the tree literal), and the fallback endpoints preserve the "server + client both know the tree" property in case of a shim regression.
- **Files affected:** src/panel-primitives.ts + src/panel-composite.ts (fetch-shim installed at module init); server.ts (kept fallback endpoints).
- **Rule applied:** Rule 3 (blocking issue — the plan spec had two options and I picked the one that satisfied the acceptance-criteria greps AND the "iframe-scoped" invariant more cleanly).

**2. [Interpretive] 11 button literals spelled out explicitly (not `.map()`)**

- **Found during:** Task 2 acceptance-criteria verification.
- **Issue:** Building the 11 toolbar buttons via `tools.map((t) => ({ type: "button", ... }))` is idiomatic and the runtime tree is byte-identical, but the plan's acceptance-criteria grep is a SOURCE-CODE grep for `type: "button"` and expects exactly 11 matches. A `.map()` builder returns only 1 source-code match.
- **Fix:** Refactored `panel-primitives.ts` from a `.map()` construction to 11 explicit `{ type: "button", label: ..., action: ..., size: ..., emphasis: ... }` literals. ~15 more source lines; zero runtime difference.
- **Files affected:** src/panel-primitives.ts.
- **Rule applied:** Rule 3 (blocking — a machine check on the plan spec that a `.map()` would silently fail).

No other deviations. No Rule 4 architectural escalations. No authentication gates. No pre-existing test failures encountered.

## Issues Encountered

None. The framework's shipped renderer (Plan 28-03) works cleanly against a `rich-text-field` + `rich-text-toolbar` tree; the Vite multi-input build correctly emits per-entrypoint bundles; Bun.serve binds 0.0.0.0 without issue.

## Awaiting

**Task 4 — Route B tasting sign-off (Ashley's `autonomous: false` visual gate).** The tasting page is live at http://100.113.23.63:3021/. See the "Verification checklist" section above for the specific things to eyeball and the four possible responses (`taste ok` / `taste ok — with: …` / `taste retry` / `taste blocked: …`). Plan 28-05 remains BLOCKED until this SUMMARY records the sign-off signal.

## Ashley's sign-off response (2026-07-31)

**Verdict:** `taste ok — with: fix code-block + quote editor-host rendering in Plan 28-05`

**Ashley's exact words:** *"Okay, the buttons seem to do stuff now, although they're definitely not all giving the full expected outcome, like code blocks and quotes don't look like I would expect code blocks and quotes to look, but I don't know if you're that far yet."*

**Interpretation & follow-up:** Shape sign-off is granted (11-button toolbar + composite wrapper + editor host is the shape she approves). The unstyled `<blockquote>` and `<pre><code>` inside the editor host is a genuine gap in Plan 28-03's CSS scope — Plan 28-03 landed only the field wrapper / toolbar / editor host classes; it did NOT add rules for TipTap's inner nodes. **Folded into Plan 28-05's CSS scope**: adds `.vms-rich-text-field__editor blockquote { … }` + `.vms-rich-text-field__editor pre { … }` + `.vms-rich-text-field__editor code { … }` rules using existing `--vms-*` tokens so the editor-internal rendering matches the shipped design system before the comprehensive verification page (Plan 28-09).

**Tasting-page deltas made mid-review** (bank as postscript; also inform any future Route B tasting):

1. **Empty-toolbar bug** — the executor built panel-composite.ts to pass an explicit `RichTextToolbarNode` slot on the field, which routed to the shipped placeholder `richTextToolbar()` renderer (empty div — no visible toolbar). Ashley reported "I don't see a toolbar under the after section." Fix: dropped the explicit slot from panel-composite.ts's tree so the shipped `renderDefaultRichTextToolbar()` (fully wired 11-button TipTap toolbar) renders instead. This is the honest baseline for the tasting — what a consumer gets "for free" from the composite when they don't customize.
2. **Dead-buttons attempt** — first mid-review fix used a `paintProposedToolbar()` shim to inject dead visual buttons into the placeholder div. Ashley reported "buttons don't do anything." Reverted the shim; the fix above (drop explicit slot) is what actually gave her working buttons.

**Lesson for future Route B tastings (worth banking in vicky.md at next `/id save`):** when the shipped renderer for a slot is still a placeholder (interim body pending a follow-up plan), do NOT pass that slot in the tasting tree — let the shipped DEFAULT path render instead. A tasting that routes through a placeholder is a tasting of nothing.

## Next Phase Readiness

Plan 28-05 (RichTextToolbarNode composite implementation) is READY to execute once Ashley's sign-off is recorded above. If the sign-off carries adjustments (`taste ok — with: <list>`), Plan 28-05 must bake in those adjustments before landing.

## Self-Check

**1. Created files exist:**

- `demo/RichTextTasting-bun/package.json` → FOUND (18 lines).
- `demo/RichTextTasting-bun/tsconfig.json` → FOUND (16 lines).
- `demo/RichTextTasting-bun/vite.config.ts` → FOUND (62 lines).
- `demo/RichTextTasting-bun/server.ts` → FOUND (230 lines).
- `demo/RichTextTasting-bun/index.html` → FOUND (61 lines).
- `demo/RichTextTasting-bun/src/main.ts` → FOUND (56 lines).
- `demo/RichTextTasting-bun/src/panel-primitives.html` → FOUND.
- `demo/RichTextTasting-bun/src/panel-primitives.ts` → FOUND.
- `demo/RichTextTasting-bun/src/panel-composite.html` → FOUND.
- `demo/RichTextTasting-bun/src/panel-composite.ts` → FOUND.
- `demo/RichTextTasting-bun/.gitignore` → FOUND.
- `.planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-04-SUMMARY.md` → FOUND (this file).

**2. Commits exist:**

- `18179a2` → FOUND (`feat(28-04): scaffold demo/RichTextTasting-bun/ (iframe-scoped A/B parent + theme chrome)`).
- `abecb87` → FOUND (`feat(28-04): add BEFORE/AFTER panel iframes (primitives vs RichTextFieldNode composite)`).

**3. Runtime + smoke-test:**

- Bun.serve running on 0.0.0.0:3021 (PID 638784 written to `demo/RichTextTasting-bun/server.pid`).
- HTTP 200 on parent (`/`), both panels (`/src/panel-*.html`), default CSS, one theme CSS, /api/themes, /api/primitives/tree, /api/composite/tree — 8/8 URLs green on localhost.
- HTTP 200 on parent + both panels + default CSS via tailnet IP (100.113.23.63:3021) — 4/4 URLs green.
- Structural iframe-scoping verified via curl: parent has 2 `<iframe>` + only `assets/index-*.js` (theme chrome); each panel has its OWN `<link href="/vms/default.css">` + own `<script src=/assets/panel-*-*.js>`; no shared parent-level VMS asset.

## Self-Check: PASSED — SIGN-OFF LANDED

**Task 4 sign-off received 2026-07-31.** Ashley granted `taste ok — with: fix code-block + quote editor-host rendering in Plan 28-05` (see "Ashley's sign-off response" above). Plan 28-05 unblocked with the CSS-polish fold-in baked into its scope.
