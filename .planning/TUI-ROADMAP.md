# TUI Front-End — Roadmap & Spec (durable; survives every conversation rewind)

This file is the single source of truth for the ViewModel Shell terminal/TUI
front-end effort. It is self-contained: a memoryless agent reconstructs full
context from this file + `.planning/TUI-NOTES.md` + git history. No SHAs are
hardcoded — completed phases are read from git:
`git log --oneline --grep='feat(tui): Phase'`.

## STATUS

- Phase 0 — COMPLETE (committed; `git log --grep='feat(tui): Phase 0'`).
- Phase 1 — COMPLETE (committed; `git log --grep='feat(tui): Phase 1'`).
- Phase 2 — COMPLETE (committed; `git log --grep='feat(tui): Phase 2'`).
- Phase 3 — COMPLETE (committed; `git log --grep='feat(tui): Phase 3'`).
- Phase 4 — COMPLETE (committed; `git log --grep='feat(tui): Phase 4'`).
- Phase 5a — COMPLETE (committed; `git log --grep='feat(tui): Phase 5a'`).
- Phase 5b — COMPLETE (committed; `git log --grep='feat(tui): Phase 5b'`).
- Phase 5c — COMPLETE (committed; `git log --grep='feat(tui): Phase 5c'`).
- Phase 5d — COMPLETE (committed; `git log --grep='feat(tui): Phase 5d'`).
- NEXT — Phase 6 (Docs, conformance, packaging — FINAL, OPTIONAL). ALL
  deferred NODE types have graduated (`table` was the last). The ONLY
  still-deferred type is the `file` field — intentionally permanently out
  of scope (file upload is browser/XHR territory; the Phase-2 transport
  seam, not a TUI node phase). No further node phases exist. Phase 6, if
  run, adds NO node behavior, must NOT bump the fail-loud string (stays
  `phase 5`), and must keep every standing invariant green.

(Each finishing phase updates this line in its own commit.)

## Context / why

ViewModel Shell's core is a CI-proven platform-agnostic `(state,action)→{vm,
state}` transformer; a front end is *one* `Adapter` (`render` required;
`navigate`/`storage`/`transport` optional). AGENTS.md's capability seam
explicitly names "terminal" as an intended target. We are adding a terminal
front end **built on Ink (React-for-CLIs)** as a pure addon that cannot
disturb the rest. Rationale (settled): terminal UI is one of the most
edge-case-laden domains in software; reinventing it would break the
framework's promise that the seam is solved — so we lean on a mature
foundation (Ink + maintained input/select components) and own only the thin
`ViewNode → Ink` mapping.

## Standing invariants (every phase; non-negotiable)

1. Pure addon, zero blast radius: no edit to `src/index.ts`/`browser.ts`/
   `server.ts`, no wire/backend/`parity/`/NuGet change. `src/tui.tsx` is a
   leaf — never imported by core/browser/server (a unit test asserts this).
2. `npm run check:core-globals` stays green (guard scans only `src/index.ts`;
   `process`/`tty` in `tui.*` is out of scope).
3. Tests are non-negotiable and pure unit tests (Ink test renderer, no real
   terminal). Add tests for new behavior each phase.
4. Fail loud, never silent: unsupported nodes render
   `[unsupported: <type> — phase N]`; errors are readable + nonzero exit; the
   terminal is always restored.
5. Build isolation must hold: core emit byte-identical (hard gate — see NOTES).
6. Recurring proof: the running `demo/Tasks-fullstack-bun` (browser :3000
   unaffected; `vms-tui http://localhost:3000/api/tasks`).
7. One commit per phase: `feat(tui): Phase N — <title>`; that same commit
   updates STATUS here and appends new gotchas to `.planning/TUI-NOTES.md`.
   Commit to `main` (repo owner workflow); do not push unless asked. Then stop.

## Locked decisions (do not relitigate)

- **Toolkit:** Ink 5 (+ maintained `ink-text-input`/`ink-select-input` for
  the input gaps). React 18 + @types/react 18, `react-jsx`.
- **Packaging:** `optionalDependencies(ink,react)` so `npx vms-tui` works yet
  web/server consumers are unaffected; ink/react also in devDependencies for
  build/test. `exports["./tui"]`, `bin: vms-tui → ./dist/tui-cli.js`.
- **Build isolation:** TS project references. `tsconfig.tui.json` references
  the unchanged base `tsconfig.json` (base only got `composite` + `exclude`
  of the two tui files). `build` = `tsc -b tsconfig.tui.json`.
- **Redirect policy** (Phase 4): uses the existing `onRedirect` seam, no new
  wire. Different-origin/absolute → open via `$BROWSER`→`xdg-open`/`open`/
  `start`; failure/none → full-screen loud interstitial, process stays alive.
  Same-origin path → re-`load()` against `<endpoint-origin><path>`; invalid
  payload → loud interstitial. App-specific routing is the app's `onRedirect`.
- **Node scope split:** Phase-1 set = page (all 4 presets + density), section
  (+card), list/list-item (+variants), text (all styles), link (+OSC 8),
  stat-bar, progress, button, checkbox, tabs, copy-button (OSC 52), form
  (stack+inline), single-line `field` family. Deferred tier = `textarea`/
  `code`, `select`/`select-multiple`, `modal`, `table`.
- **Focus identity:** ring in tree order; preserve by explicit `id`/`name`/
  `action.name` where present, else positional index — same heuristic class
  `BrowserAdapter` already uses. No new wire.

## Phases

Per-phase detailed execution plans are written fresh in plan mode each phase
(ephemeral). This roadmap is the spec they derive from.

- **Phase 0 — Scaffold + seam proof.** Package plumbing, `TuiAdapter`
  rendering only `page` title + `text` (else fail-loud placeholder), `vms-tui`
  bin with deterministic teardown, isolation, one test. Exit: byte-identity
  gate, vitest, core-globals, live E2E, real-PTY teardown all green.
  *(DONE.)*
- **Phase 1 — Read-only render of the full phase-1 node set.** Correct visual
  mapping (Yoga layout) of every phase-1 node in its unfocused state: all 4
  page presets + density + section card, list variants, text styles, OSC 8
  links, stat-bar, progress; form/field painted as static boxes; deferred
  nodes show fail-loud placeholders. Re-paints on poll/`shell.push`. No
  keyboard. Exit: `vms-tui` vs live Tasks shows an information-honest screen;
  per-node snapshot tests; invariants 1–6 green.
- **Phase 2 — Focus model + non-text interaction.** Focus ring (Tab/Shift-Tab
  /arrows), Enter/Space → `shell.dispatch`, focus continuity across
  re-renders; button, checkbox (immediate `{checked}`), tabs (immediate
  `{value}`), copy-button (OSC 52, no dispatch), clickable list-item/row
  `action`, link activation, form submit button (collects current field
  values; fields still static). Exit: against live Tasks, filter/toggle/
  delete work end-to-end; key-simulation tests assert dispatched payloads.
- **Phase 3 — Single-line field editor.** Robust single-line editor for the
  whole single-line family (text/email/number/date/time/datetime-local/
  password-masked/hidden/form-checkbox): grapheme cursor, word motions,
  horizontal scroll, bracketed paste, readline-isms; caret preserved across
  re-renders; Enter-in-field + form collection. Lean on `ink-text-input`.
  Exit: add a task via the inline form against live Tasks — Tasks operates
  100% in the terminal, zero backend changes. Typing/caret/paste tests.
- **Phase 4 — Redirect/navigate + storage verbs.** Implement the locked
  redirect policy as `vms-tui`'s default `onRedirect` + `TuiAdapter.navigate`
  fallback; `TuiAdapter.storage` (write-only: local→XDG state file, session→
  in-memory) with the fail-loud rule strictly enforced. Exit: unit-test-driven
  (all redirect branches; missing-storage fails loud).
- **Phase 5 — Deferred node tier (independent sub-milestones; rewind between
  each).** 5a `textarea`/`code` multi-line editor; 5b `select`/
  `select-multiple` picker (`ink-select-input`); 5c `modal` (compositing/
  z-layer + focus trap + dismiss per AGENTS.md modal rules); 5d `table`
  (Unicode-width column solver, sortable headers, per-column filter row,
  clickable rows, link cells). Each verified vs a demo that uses it + tests;
  remove its fail-loud placeholder only when fully shipped. Use commit
  messages `feat(tui): Phase 5a — …` etc.
- **Phase 6 — Docs, conformance, packaging (final, optional).** `TuiAdapter`
  README (`npx vms-tui <url>`); discoverability via package exports + own
  README (no stale catalog); a rendering-conformance fixture set (same
  ViewNode fixtures → browser-adapter and tui-adapter render the same
  *information*, not bytes); version-align bump + CHANGELOG if publishing.
  Re-confirm parity/core-globals/existing tests untouched and green.
