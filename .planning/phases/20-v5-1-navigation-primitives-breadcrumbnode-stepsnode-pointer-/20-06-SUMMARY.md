---
phase: 20-v5-1-navigation-primitives-breadcrumbnode-stepsnode-pointer-
plan: 06
subsystem: verification
tags: [green-tree-gate, verification-page, tailnet, breadcrumb, steps, real-bundle, viewmodel-shell]

# Dependency graph
requires:
  - phase: 20-01
    provides: BreadcrumbNode + StepsNode TS wire types (rendered by the verification page)
  - phase: 20-03
    provides: browser.ts renderers + default.css for both nodes (the shipped bundle/CSS the page loads)
  - phase: 20-05
    provides: parity fixtures (green-tree gate) + Showcase gallery content reused by the page
provides:
  - "demo/NavVerification-bun/ — real-bundle tailnet sign-off page (breadcrumb + steps ×3 + clickable-row table + light/dark toggle + checklist)"
  - "Full green-tree gate result (all suites recorded below)"
affects: [20-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A visual-node sign-off page = a demo/<Name>-bun frontend (Vite-aliased to viewmodel-shell/src for the REAL renderer) that serves the shipped default.css + themes VERBATIM via runtime <link> tags (not a CSS import, not hand-mocked) so the human sign-off is against the shipped renderer AND shipped CSS, with a runtime light↔dark theme swap"
    - "Force the intrinsic steps narrow→vertical collapse WITHOUT a resize by placing the same horizontal StepsNode in a sidebar-layout first-child slot (capped at 24rem < the 30rem container-query threshold)"

key-files:
  created:
    - demo/NavVerification-bun/server.ts
    - demo/NavVerification-bun/index.html
    - demo/NavVerification-bun/src/main.ts
    - demo/NavVerification-bun/vite.config.ts
    - demo/NavVerification-bun/tsconfig.json
    - demo/NavVerification-bun/package.json
    - demo/NavVerification-bun/bun.lock
  modified: []

key-decisions:
  - "Green-tree gate led with `npm run build` to refresh the stale dist (the 20-05 deferred item) so downstream serve/tsc are current; the rebuilt dist/browser.js (Jul 11) carries the new breadcrumb/steps renderers"
  - "CSS is loaded via runtime <link> tags served from viewmodel-shell/styles (default.css baseline + a swappable theme), NOT a Vite CSS import — the shipped CSS is served verbatim and the light↔dark toggle needs no rebuild"
  - "Narrow-collapse shown two ways: a full-width horizontal steps (narrow the window) AND the same node in a ≤24rem sidebar slot (pre-collapsed, no resize) — proving the collapse is container-intrinsic"
  - "Task 3 (Ashley's pre-publish sign-off) is a blocking human-verify checkpoint owned by the orchestrator — NOT performed here; no persistent server left running"

requirements-completed: [NAV-04]

# Metrics
duration: 20min
completed: 2026-07-11
---

# Phase 20 Plan 06: Full Green-Tree Gate + Tailnet Verification Page Summary

**The full green-tree gate passes across both backends and all demos, and a real-bundle `demo/NavVerification-bun/` tailnet page renders BreadcrumbNode + StepsNode (both orientations, incl. an intrinsic pre-collapsed narrow copy) + a clickable-row table against the shipped renderer and shipped default.css/themes with a light↔dark toggle — ready for Ashley's pre-publish sign-off (Task 3, orchestrator-owned).**

## Performance
- **Duration:** ~20 min
- **Completed:** 2026-07-11
- **Tasks:** 2 of 3 (Task 3 = human sign-off, left to the orchestrator)
- **Files created:** 7 · **Files modified:** 0

## Accomplishments

### Task 1 — Full green-tree gate (ALL green)
Ran the complete AGENTS.md gate, in order, with the dist rebuilt first (fixes the 20-05 stale-`dist/*.d.ts` deferred item):

| Suite | Command | Result |
|---|---|---|
| dist rebuild | `viewmodel-shell$ npm run build` (`tsc -b tsconfig.tui.json`) | **exit 0** — `dist/browser.js` refreshed (Jul 11), carries breadcrumb/steps renderers |
| vitest | `viewmodel-shell$ npx vitest run` | **exit 0** — 50 files, 581 passed / 1 skipped |
| core-globals | `npm run check:core-globals` | **exit 0** — AGNOSTIC-03: zero platform globals in src/index.ts |
| aa-contrast | `node scripts/check-aa-contrast.mjs` | **exit 0** — D-07: 13/13 pairs WCAG-AA on default + all 12 themes |
| theme-byte-identity | `node scripts/check-theme-byte-identity.mjs` | **exit 0** — D-03/D-26: all 11 theme files match baseline |
| parity | `parity$ bun run run.ts` | **exit 0** — ✓ all backends agree; skill twins byte-identical |
| framework .NET Tests | `dotnet test viewmodel-shell-dotnet/Tests/Tests.csproj` | **exit 0** — 121 passed / 0 failed |
| ContactManager.Tests | `dotnet test …ContactManager.Tests.csproj` | **exit 0** — 39 passed |
| ExpenseTracker.Tests | `dotnet test …ExpenseTracker/AspNetCore.Tests` | **exit 0** — 29 passed |
| HelpDesk.Tests | `dotnet test …HelpDesk.Tests.csproj` | **exit 0** — 52 passed |
| RetroBoard.Tests | `dotnet test …RetroBoard.Tests.csproj` | **exit 0** — 33 passed |
| Tasks.Tests | `dotnet test …Tasks/AspNetCore.Tests` | **exit 0** — 28 passed |

No red suites; no waivers needed. (Task 1 produced no tracked file changes — `viewmodel-shell/dist/` is gitignored — so it has no commit; the gate result is recorded here per the plan.)

### Task 2 — `demo/NavVerification-bun/` real-bundle tailnet verification page
- **Structure mirrors `demo/NonBlockingStaleness-bun`** (a `*-bun` frontend demo): `package.json` (`link:@ashley-shrok/viewmodel-shell`), `vite.config.ts` (regex aliases → `../../viewmodel-shell/src/{index,browser}.ts` for the REAL renderer), `tsconfig.json`, `index.html`, `src/main.ts` (shell wiring), `server.ts` (Bun.serve: the `/api/nav` wire + shipped CSS + the Vite-built client).
- **Real shipped CSS, served verbatim:** `server.ts` serves `viewmodel-shell/styles/default.css` at `/vms/default.css` and `styles/themes/<name>.css` at `/vms/themes/<name>.css`; `index.html` loads `default.css` (light baseline) + a swappable `#vms-theme` `<link>`. A tiny host-chrome toggle (the only hand-written markup, outside the view tree) swaps light-purple ↔ dark-purple — the real theme files, not hand-mocked.
- **The view tree (all shipped renderer, zero app CSS):** a **BreadcrumbNode** (Home/Reports href crumbs + a `Regenerate` action crumb + Analytics href + a current last item `Q3 Summary`); a **full-width horizontal StepsNode** (`current:1`, Cart→Confirm) with instructions to narrow the window; **the same horizontal StepsNode in a `layout:"sidebar"` first-child slot** (≤24rem < the 30rem container-query threshold) so it renders **already collapsed** — the intrinsic reflow at a glance with no resize; a deliberate **`orientation:"vertical"` StepsNode** (`current:2`, per-step descriptions); and a **TableNode** whose rows carry `TableRow.action` (`pick-row-*`) to re-confirm the shipped `cursor:pointer` — clicking updates a "Last picked" line. An on-page **"What to check" card** (tone:info) enumerates all six checks.
- **Vite build passed** (the `/vms/*.css` root-absolute links correctly pass through as runtime-resolved); the bundled `dist/assets/index-*.js` is the real renderer.

## Task Commits
1. **Task 1: full green-tree gate** — no commit (verification-only; `dist/` gitignored). Results recorded in the table above.
2. **Task 2: NavVerification-bun tailnet sign-off page** — `dc390c1` (feat)

## Files Created/Modified
- `demo/NavVerification-bun/server.ts` — the verification app: `buildVm` (breadcrumb + 3 steps + table), `/api/nav` GET/POST wire, verbatim shipped-CSS serving, Vite-`dist/` static serving, agent-skill handler.
- `demo/NavVerification-bun/index.html` — VMS discoverability meta, runtime `<link>` tags for the shipped default.css + swappable theme, the light/dark toggle (host-chrome), `#app`, the bundled client script.
- `demo/NavVerification-bun/src/main.ts` — shell wiring against `/api/nav` (no CSS import; CSS comes from the runtime links).
- `demo/NavVerification-bun/{vite.config.ts,tsconfig.json,package.json,bun.lock}` — the `*-bun` demo scaffold (Vite aliases to framework src; package link).

## Deviations from Plan
**None functionally.** Built exactly per the plan. Two implementation choices worth noting (both within the plan's discretion):
- Loaded the shipped CSS via runtime `<link>` tags (served verbatim by `server.ts`) instead of a Vite CSS import, so the theme is runtime-swappable and the CSS is unambiguously the shipped file. The `vite.config.ts` therefore omits the styles/theme aliases (only the `index`/`browser` source aliases remain).
- Used a `layout:"sidebar"` ≤24rem slot to show the pre-collapsed horizontal steps (the plan said "a deliberately narrow container"; the sidebar first-child cap is the zero-custom-CSS way to force one).

### Auto-fixed Issues
None.

## Verification Results
- **Task 1:** every gate suite exits 0 (table above); the automated `<verify>` chain equivalents all passed individually.
- **Task 2:** `bunx vite build` — exit 0 (root-absolute `/vms/*.css` links passed through as runtime-resolved). Smoke test (server started, checked, then STOPPED — no persistent server left): `GET /` → **HTTP 200** `text/html`; `GET /vms/default.css` → **200** `text/css`; `GET /vms/themes/dark-purple.css` → **200** `text/css`; `GET /api/nav` contains `"type":"breadcrumb"` ×1, `"type":"steps"` ×3, `"orientation":"vertical"` ×1, `pick-row-alpha` action ×1; `POST /api/nav/action {pick-row-bravo}` → `"bravo (row action fired)"`. `dist/index.html` references `/vms/default.css` + `#vms-theme` + `/vms/themes/light-purple.css` + the bundled `assets/index-*.js`.

## Known Stubs
None. (The `regenerate-crumb` action is a deliberate no-op re-render — it proves the breadcrumb action dispatches; there is nothing to mutate.)

## Deferred Issues
- **Task 3 (Ashley's pre-publish sign-off) is NOT performed here — it is the orchestrator's.** It is a blocking human-verify checkpoint: the orchestrator serves `demo/NavVerification-bun` persistently over the tailnet (`http://thenasty:<port>/`) and gets Ashley's "approved" before Plan 20-07 (the publish) proceeds. No persistent server was left running by this executor.
- The 20-05 stale-`dist/*.d.ts` deferred item is **resolved** by this plan's Task 1 `npm run build` (dist now reflects current src).

## How to serve the page (for the orchestrator)
```
cd /home/thenasty/ViewModelShell/demo/NavVerification-bun
# (bundle already built into dist/; rebuild with `bunx vite build` if src changes)
PORT=3011 bun run server.ts          # binds 0.0.0.0 → reachable at http://thenasty:3011/ on the tailnet
```
Entrypoint: `server.ts` (Bun). Default port 3011 (`PORT` env overrides). The client is the pre-built `dist/`; the shipped CSS is served from `viewmodel-shell/styles` at `/vms/*`.

## Self-Check: PASSED
- `demo/NavVerification-bun/server.ts` — FOUND (`buildVm`, `type:"breadcrumb"`, 3× `type:"steps"`, `TableRow.action`)
- `demo/NavVerification-bun/index.html` — FOUND (`/vms/default.css`, `#vms-theme`, bundled script)
- `demo/NavVerification-bun/{src/main.ts,vite.config.ts,tsconfig.json,package.json,bun.lock}` — FOUND
- Commit `dc390c1` — present in `git log`.
