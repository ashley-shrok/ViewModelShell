---
phase: 05-canonical-examples-0-4-0-release-closeout
plan: 03
subsystem: demos
tags: [demos, de-chrome, theme, css, scaffold, examples-02]

# Dependency graph
requires:
  - phase: 05-canonical-examples-0-4-0-release-closeout
    plan: 01
    provides: "12 importable theme files incl. themes/dark-purple.css (byte-exact prior dark default) + package.json ./themes/* exports; re-based light default.css :root"
  - phase: 05-canonical-examples-0-4-0-release-closeout
    plan: 02
    provides: "Wave-2 reference pattern — zero-<style> minimal scaffold + theme-import-via-TS-entrypoint (Showcase/frontend/index.html + src/main.ts)"
provides:
  - "7 non-bun demo frontend HTML files de-chromed to minimal zero-<style> scaffolds (D-15)"
  - "Each demo statically pins one distinct shipped theme via its TS entrypoint (D-08/D-18)"
  - "HelpDesk agent=dark-blue / requester=light-teal — two distinct shipped themes via the seam, no inline :root (D-08/D-18)"
  - "Tasks pins the demoted dark-purple — the 'still shipped, one import away' demonstration (D-18)"
  - "RetroBoard sanctioned --vms-page-max retune via src/app-tokens.css after the theme (D-17/D-19)"
  - "Dropped functional overrides logged deferred in deferred-items.md — explicitly NO new wire (D-16)"
affects: [05-06, demos, release-closeout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Demo = real-app exemplar: import styles.css + one distinct shipped theme via the TS entrypoint, author zero CSS (mirrors Wave-2 05-02 Showcase pattern)"
    - "Sanctioned single-token retune lives in a tiny per-app stylesheet (one :root with only --vms-* tokens) imported after the theme — never an HTML <style> (D-17/D-19)"
    - "Multi-role one-app theming via two distinct shipped-theme imports through the seam, replacing inline per-role :root (D-08)"

key-files:
  created:
    - demo/RetroBoard/frontend/src/app-tokens.css
  modified:
    - demo/Tasks/frontend/index.html
    - demo/Tasks/frontend/src/main.ts
    - demo/ContactManager/frontend/index.html
    - demo/ContactManager/frontend/src/main.ts
    - demo/ExpenseTracker/frontend/index.html
    - demo/ExpenseTracker/frontend/src/main.ts
    - demo/RetroBoard/frontend/index.html
    - demo/RetroBoard/frontend/src/main.ts
    - demo/HelpDesk/frontend/index.html
    - demo/HelpDesk/frontend/agent.html
    - demo/HelpDesk/frontend/requester.html
    - demo/HelpDesk/frontend/src/agent.ts
    - demo/HelpDesk/frontend/src/requester.ts

key-decisions:
  - "HelpDesk landing index.html: kept as a static HTML page (no JS ViewModelShell entrypoint introduced for a static 2-link picker — disproportionate per Task 2's own guidance); re-expressed using only shipped .vms-page/.vms-page__title/.vms-section/.vms-section__heading/.vms-link classes (all verified present in default.css) with a one-line inline module <script> importing styles.css + themes/light-teal.css; zero <style> block, zero custom non-vms vars"
  - "ContactManager/src/app-tokens.css NOT created — CM keeps no sanctioned --vms-page-max/--vms-font-* retune; the files_modified frontmatter slot is a permitted-surface declaration, not a mandate (per Task 1 NOTE)"
  - "onLoading() JS callback left intact in every main.ts (inert class-toggle on a now-unstyled class); only the deleted CSS body.is-loading rule drops the affordance (D-15)"
  - "HelpDesk landing theme = light-teal (matches the requester role it links to; neutral landing target)"

metrics:
  duration: 9min
  tasks: 2
  files: 14
  completed: 2026-05-18
---

# Phase 5 Plan 03: De-chrome Every Demo (EXAMPLES-02) Summary

All 7 non-bun demo frontend HTML files reduced to minimal zero-`<style>` scaffolds; each demo statically pins one distinct shipped theme via its TS entrypoint (the Wave-2 Showcase real-app pattern); HelpDesk's two roles import two distinct shipped themes through the seam, the demoted `dark-purple` lands on Tasks, RetroBoard's sole sanctioned width retune lives in a per-app token file, and every dropped functional override is logged deferred with no new wire.

## What Was Built

### Task 1 — Tasks / ContactManager / ExpenseTracker / RetroBoard (commit 3c0b476)

- Replaced all four `frontend/index.html` with the minimal scaffold: `<!doctype>`, `<head>` with charset/viewport/title (per-demo title text preserved), `<body><div id="app"></div><script type="module" src="/src/main.ts"></script></body>`. Deleted the entire `<style>` block **and** the Google-Fonts `<link rel="preconnect">` + family `<link>` (none of these 4 keep a `--vms-font-*` override, so the font links were removed per D-15/D-17).
- Added the static pinned-theme `import` on the line immediately after `import "@ashley-shrok/viewmodel-shell/styles.css";` in each `src/main.ts`:
  - Tasks → `themes/dark-purple.css` (the demoted file — D-18 "still shipped, one import away" demonstration)
  - ContactManager → `themes/light-blue.css`
  - ExpenseTracker → `themes/light-green.css`
  - RetroBoard → `themes/light-amber.css`
- Created `demo/RetroBoard/frontend/src/app-tokens.css` containing exactly one `:root{ --vms-page-max: 1280px; }` (no other token, no other rule) and imported it in `RetroBoard/src/main.ts` immediately **after** the pinned theme import (D-17/D-19 — the board-style wide layout's sole sanctioned retune).
- `ContactManager/src/app-tokens.css` deliberately **not** created (CM keeps no sanctioned retune; the frontmatter slot is a permitted-surface declaration only — per Task 1's explicit NOTE).
- `onLoading()` callbacks left unchanged in every `main.ts` (harmless inert class-toggle; only the deleted CSS `body.is-loading #app{opacity}` rule drops the dispatch-dim affordance).

### Task 2 — HelpDesk landing + agent + requester (commit d9d97f2)

- `agent.html`: deleted the entire `<style>` block (including the inline `:root` blue per-role theme) + the font `<link>`s → minimal scaffold (title `Help Desk — Agent`, `/src/agent.ts`). `agent.ts` pins `themes/dark-blue.css` on the line after `styles.css`.
- `requester.html`: deleted the `<style>` block + font `<link>`s → minimal scaffold (title `Help Desk — Requester`, `/src/requester.ts`). `requester.ts` pins `themes/light-teal.css` on the line after `styles.css`.
- Result: the two roles import **two distinct** shipped themes via the seam, replacing the old inline per-role `:root` block — role differentiation stays semantic, via the sanctioned seam (D-08/D-18).
- `index.html` (the role-picker landing): see "HelpDesk Landing-Page Approach" below.

### Final Per-Demo Theme Mapping

| Demo | Pinned shipped theme | Entrypoint |
|------|----------------------|------------|
| Tasks | `dark-purple` (the demoted file) | `src/main.ts` |
| ContactManager | `light-blue` | `src/main.ts` |
| ExpenseTracker | `light-green` | `src/main.ts` |
| RetroBoard | `light-amber` (+ `app-tokens.css` `--vms-page-max:1280px`) | `src/main.ts` |
| HelpDesk — agent | `dark-blue` | `src/agent.ts` |
| HelpDesk — requester | `light-teal` | `src/requester.ts` |
| HelpDesk — landing | `light-teal` (inline `<script type="module">` import only) | n/a (static page) |

Matches the UI-SPEC §Color recommended assignment exactly: deliberate spread, ≥1 dark incl. `dark-purple` on Tasks, HelpDesk roles distinct. Bun mirrors are pure `server.ts` (no frontend HTML) — confirmed out of scope, parity pair stays wire-only.

### RetroBoard token-file path

`demo/RetroBoard/frontend/src/app-tokens.css` — one `:root{}` with only `--vms-page-max: 1280px`, imported in `src/main.ts` on the line immediately after `import "@ashley-shrok/viewmodel-shell/themes/light-amber.css";`.

## HelpDesk Landing-Page Approach (recorded per Task 2(C))

The landing was raw-HTML chrome (`.landing`/`.role` anchors, custom non-`--vms-*` vars, no `#app`, no `ViewModelShell`). Task 2 offered two sanctioned approaches; the second was chosen: **kept as a static HTML page**, not converted to a JS `ViewModelShell` app — introducing a JS entrypoint for a static 2-link role picker is disproportionate (Task 2 explicitly sanctions skipping that). The page now:

- Has **zero `<style>` block** and **zero custom non-`--vms-*` CSS variables** (verified by repo-scan: no `:root`, no `--x:` non-vms tokens).
- Loads presentation entirely from the shipped stylesheet via a one-line inline `<script type="module">` importing `styles.css` + `themes/light-teal.css`.
- Re-expresses the role picker using **only shipped `.vms-*` classes** — `.vms-page`, `.vms-page__title`, `.vms-section`, `.vms-section__heading`, `.vms-link` (all five verified present in `viewmodel-shell/styles/default.css`). No invented class, no new CSS rule, no new wire field.

## Deviations from Plan

None — plan executed exactly as written. Both Task-2(C) sanctioned alternatives were available; the static-page alternative was selected within the plan's explicit discretion and recorded above (not a deviation).

## Deferred (logged, NOT built — D-15/D-16, explicitly no new wire)

Appended to `.planning/phases/05-canonical-examples-0-4-0-release-closeout/deferred-items.md` under `## 05-03`:

- **Dispatch-dim loading affordance** (`body.is-loading #app{opacity}`, all 5 demos) — no 0.4.0 framework expression; dropped, JS callback left inert. Deferred usage-driven framework idea.
- **Horizontal forms** — Tasks `.vms-form{flex-direction:row}`, ContactManager `.vms-form:not(:has(textarea))` horizontal search, ExpenseTracker `.vms-form{flex-direction:row;align-items:flex-end}`, RetroBoard `.vms-section .vms-form{flex-direction:row}` — no `form`/`field` layout-direction model field; dropped, renders shipped vertical default. Deferred candidate wire field (usage-driven only).
- **ContactManager custom contact-list scrollbar** (`#contact-list` max-height + `::-webkit-scrollbar*`) — no scroll-container affordance on `list`; dropped, renders default.
- **ExpenseTracker serif section-heading + number-spinner-strip + over-budget progress tint** — pure visual re-skins of shipped `.vms-*` classes; dropped, shipped design system owns this appearance (no sanctioned single-token expression). No deferral action beyond recording the drop.

Explicit: **no new wire field, CSS rule, token, node, or preset** was added to preserve any dropped affordance.

## Verification

- Plan-level repo-scan: all 7 non-bun demo HTML files (`ContactManager`, `ExpenseTracker`, `RetroBoard`, `Tasks`, `HelpDesk` index/agent/requester) report `zero-<style>`; all 6 theme pins present and distinct. `OVERALL OK`.
- Task 1 automated verify (plan-supplied node script): `OK` — zero `<style>`, Tasks=dark-purple / CM=light-blue / RB=light-amber pins, RB `app-tokens.css` `--vms-page-max:1280px`, imported after theme.
- Task 1 acceptance extras: no `<link>` remains in any of the 4 HTML files; ExpenseTracker=light-green confirmed; `ContactManager/src/app-tokens.css` confirmed absent.
- Task 2 automated verify (plan-supplied node script): `OK` — zero `<style>` in all 3 HelpDesk HTML; agent=dark-blue, requester=light-teal, distinct; landing has no `:root` and no non-`--vms-*` custom vars.
- All five shipped `.vms-*` classes used in the HelpDesk landing confirmed present in `viewmodel-shell/styles/default.css` (lines 81/93/103/155/156/382) — no invented class.
- Bun mirrors confirmed to have no frontend HTML (pure `server.ts`) — correctly out of scope.

Plan 06's static repo-scan guard will gate EXAMPLES-02 structurally; this plan satisfies it.

## Self-Check: PASSED

- Created files exist: `demo/RetroBoard/frontend/src/app-tokens.css`, `05-03-SUMMARY.md`, and all modified demo HTML/TS (spot-checked Tasks/index.html, HelpDesk agent.html, HelpDesk index.html) — all FOUND.
- Commits exist: `3c0b476` (Task 1), `d9d97f2` (Task 2) — both FOUND in git log.
