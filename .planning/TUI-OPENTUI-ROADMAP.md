# TUI rewrite on OpenTUI — Roadmap (durable spec)

**Status field deliberately absent — phase progress is tracked via `TaskList` + the git ledger (`git log --grep='feat(tui): B'`), not via edits to this doc. This file is the immutable spec; what's done is what's committed.**

---

## Mission

Replace the Ink-based `TuiAdapter` with an OpenTUI-based one to close the lazygit-style UX gap reported by the maintainer after using the existing TUI on a real app. Two concrete complaints made the substrate a forcing function:

1. **No scrolling.** Ink renders to fit; overflow clips. Apps with tables, long lists, or detail panes lose content off-screen with no way to recover.
2. **Keyboard-only interaction is too sparse.** Ink has no mouse support at all (`process.stdin` raw mode only parses keypresses). Apps feel painful next to peers like `lazygit`, `k9s`, `slack-term`.

OpenTUI ([`@opentui/core`](https://www.npmjs.com/package/@opentui/core) + [`@opentui/react`](https://www.npmjs.com/package/@opentui/react), [github.com/anomalyco/opentui](https://github.com/anomalyco/opentui)) ships `ScrollBox`, `ScrollBarRenderable`, native mouse parsing (4 mouse-tracking modes enabled by default), a React reconciler, focus management (`useFocus`, `useBlur`, `useKeyboard`, `useOnResize`), and ~150 renderables including `Box`, `Text`, `Input`, `Select`, `TabSelect`, `Code` (syntax-highlighted), `Markdown`, `Diff`. Smoke-confirmed working on Linux x64 via the prebuilt native binary (`@opentui/core-linux-x64`).

## Substrate decision: OpenTUI on Bun runtime

The Node TUI landscape in 2026 (verified empirically — see commit history of substrate research):

| Candidate | Verdict |
|---|---|
| Ink | active, but no mouse + no scroll (the gap we're closing) |
| blessed / neo-blessed | dead since 2015 / 2018 — *not* the active fork the community claims |
| terminal-kit | active, imperative API, partial scroll, single-maintainer bus factor |
| OpenTUI | ✓ mouse, scroll, React reconciler, fresh native binaries, aggressive release cadence — **but requires Bun runtime currently** (Node + Deno support "in-progress" per their docs, no announced timeline) |

The Bun runtime requirement is **scoped to the `/tui` subpath + the `vms-tui` CLI bin**, not the whole package:

- `@ashley-shrok/viewmodel-shell` (core), `/browser`, `/server` stay runtime-agnostic — web/server consumers are unaffected.
- `/tui` subpath + `vms-tui` bin require Bun ≥ 1.0. End-users: one-time `curl -fsSL https://bun.sh/install | bash`, then `bunx vms-tui …` or `bun install -g …`.
- Bun is already a required dev dependency for the cross-backend parity suite (`bun run parity/run.ts`), so internally this is consistent.

If OpenTUI ships Node support before B5, this constraint relaxes; the substrate choice doesn't.

## Invariants (hold across every phase)

1. **No wire change.** `ViewNode` types, `ShellSideEffect`, `ShellResponse`, the JSON contract — all untouched. This is purely an adapter-internal rewrite. **NuGet is not touched** through any phase of this work (stays at 0.5.0 until a wire change reopens it).
2. **Public `TuiAdapter` API surface is preserved.** Constructor signature (`new TuiAdapter({ viewport?, sidebarFraction? })`), `render(vm, onAction)` method, and the optional `Adapter` capability verbs (`navigate`, `storage`, `saveFile`) all keep the same shapes. Consumers using `TuiAdapter` programmatically don't change their integration code; what changes is what the TUI looks like + that the host process runs under Bun instead of Node.
3. **Cross-adapter conformance must stay green.** `viewmodel-shell/test/conformance.tui.test.ts` (information parity — same ViewNode renders the same user-visible tokens as `BrowserAdapter`) is the load-bearing regression gate. Every phase keeps it green. Re-implementations that break it are wrong by definition.
4. **Cross-backend parity (`parity/run.ts`) is unaffected by construction.** Parity is server-wire diffing; the TUI is one client. Touch nothing under `parity/`, NuGet, or any backend except as part of substrate-agnostic test infrastructure.
5. **Fail-loud rule applies unchanged.** `navigate?` / `storage?` / `saveFile?` capability absence → `failCapability` via `onError`. The verbs themselves are side-channel and have no library-specific concerns; the existing implementations carry over conceptually.
6. **No version bump until B5.** Phases B1–B4 land on `main` as commits with no `package.json`/`csproj` change. The atomic `0.6.0` move happens at B5 alongside docs/CHANGELOG/MIGRATION. This keeps `0.5.0` consumable from npm/NuGet throughout the rewrite (consumers of the published packages see a stable artifact while the rewrite is in flight; they get the new TUI only when 0.6.0 publishes).
7. **Operator-driven git + publish.** Per AGENTS.md tail: no auto-commits unless asked in-turn for that phase; no auto-push; no publish until explicit greenlight at B5. Per-phase rewinds end with one commit on `main`, then STOP.

## Phase scope

### B1 — Foundation: deps swap, bootstrap, page/section/text/link

**Deliverables:**
- `viewmodel-shell/package.json`: remove `ink`, `react@18`, `ink-text-input`, `ink-select-input`; add `@opentui/core`, `@opentui/react`, `react@19` to `optionalDependencies` + `devDependencies`. Adjust `engines`/exports hint for the `/tui` subpath to flag Bun.
- `viewmodel-shell/tsconfig.tui.json`: `jsxImportSource: "@opentui/react"`, `jsx: "react-jsx"`.
- `viewmodel-shell/src/tui.tsx`: rewrite. `TuiAdapter` keeps signature; internals use `createCliRenderer` (`@opentui/core`) + `createRoot` (`@opentui/react`). B1 implements: `page`, `section`, `text`, `link`. Other node types render a clearly-labelled "B2+ placeholder" so unported backends fail visibly, not silently.
- `viewmodel-shell/src/tui-cli.ts`: shebang for Bun bin; clean error message + install hint when invoked under non-Bun runtimes (Node-shebang fallback or runtime detection — TBD in implementation).
- `viewmodel-shell/test/tui.test.ts`: slim aggressively. Most Ink-byte assertions don't carry over. Keep what's library-agnostic; mark coverage debt in CHANGELOG.
- `viewmodel-shell/test/conformance.tui.test.ts`: **must stay green unchanged** for the four B1 node types.

**Verification gate:** build clean, vitest green on slimmed suite + conformance, `check:core-globals` green, parity unchanged. Manual smoke: render against a demo backend, confirm alt-screen + Ctrl-C teardown.

**Commit:** `feat(tui): B1 — OpenTUI substrate (page/section/text/link rendering, deps swap, Bun runtime)`. **No version bump.**

### B2 — Layouts & lists

`stack` / `split` / `cards` / `sidebar` layout presets mapped to OpenTUI positioning + per-pane scrollable containers (the lazygit-style structure). `list` + `list-item` (with variants). `table` (use `blessed.listtable` style approach via OpenTUI; sortable headers, per-column filter, clickable rows). Each `section` becomes its own scrollable focus pane; Tab/Shift-Tab cycles focus; click-on-pane changes focus; wheel/PageUp/Down scroll the active pane. Status line at the bottom shows current keybindings (lazygit pattern).

**Conformance:** all four list/table fixtures must stay green.

### B3 — Inputs & forms

`field` covering every `inputType` (text, email, password, number, date, time, datetime-local, textarea, hidden, file, select, select-multiple, checkbox, code). `checkbox` standalone. `button` (variants). `form` with submit action + validation field round-trip. Draft preservation through re-renders (the framework feature documented in AGENTS.md). File upload through OpenTUI's input integration if practical, else punt to B4 misc.

### B4 — Misc nodes

`tabs`, `progress`, `stat-bar`, `copy-button` (OSC-52 — same byte-form that's already correct in 0.4.8), `modal` (focus trap + dismiss action). `link` may grow OSC-8 hyperlink emission to match 0.4.8 if OpenTUI doesn't ship it natively.

### B5 — Interaction polish + release

Focus manager hardening, mouse routing across all interactive nodes, wheel scroll consistency, status line content, theme passthrough (the `--vms-*` token wire never reached the TUI; this phase decides whether to surface theme colors via OpenTUI's color API or leave it). Docs sweep: `README.md` (TUI section rewrite), `AGENTS.md` (no changes expected — the wire is unchanged), `CHANGELOG.md` (`0.6.0` entry), `MIGRATION.md` (`Upgrading to 0.6.0` — Bun runtime requirement is the key call-out). Version bumps: `package.json` 0.5.0 → 0.6.0. NuGet untouched at 0.5.0 (no wire change in this arc — but per AGENTS.md major.minor alignment, NuGet may also tick to 0.6.0 with no-op release notes to keep the shared major.minor; **decide at B5**, the question is "does NuGet 0.5.0 stay or move to 0.6.0 with 'no changes — version aligned with npm'?"). Atomic publish: npm 0.6.0 + (if chosen) NuGet 0.6.0 + close any related issue.

## ViewNode → OpenTUI component map (preliminary)

This is the working hypothesis. Adjust as implementation reveals constraints. Not a contract.

| ViewNode | OpenTUI primitive |
|---|---|
| `page` | top-level `<box>` (no border); `density:"compact"` tightens internal spacing via Yoga padding |
| `section` (`variant:"card"`) | `<scrollbox border focusable>` — each section is its own focus pane |
| `section` (plain) | `<box>` |
| `text` (every style) | `<text>` with style props |
| `link` (external) | `<text>` with OSC-8 emission + focus/click |
| `link` (internal) | `<text>` clickable, dispatches `link.action` |
| `button` | `<text>` styled as button, focusable + click → dispatch |
| `checkbox` | OpenTUI's checkbox if present; else `<text>` with manual toggle |
| `field` (text-like) | `<input>` from `@opentui/core` |
| `field` (textarea/code) | `<input multiline>` or `<editbuffer>` |
| `field` (select / select-multiple) | `<select>` |
| `form` | `<box>` + manual submit-on-enter wiring through `useKeyboard` |
| `list` + `list-item` | `<scrollbox>` + child `<box>` rows |
| `table` | `<scrollbox>` + manual row layout, or OpenTUI's table primitive if it ships one |
| `tabs` | `<tabselect>` |
| `progress` | `<text>` with computed bar character (cheap) or OpenTUI primitive |
| `stat-bar` | `<box flexDirection="row">` of stat items |
| `modal` | `<box>` overlaid via OpenTUI z-index/portal mechanism; focus trap via `useFocus` scope |
| `copy-button` | `<text>` clickable, OSC-52 on activation |

## Rewind protocol (per-phase)

At the start of a new phase's session, the agent reads:

1. **This file** (`.planning/TUI-OPENTUI-ROADMAP.md`) — the spec.
2. **`git log --grep='feat(tui): B' --oneline`** — what's already committed (which phases have landed). Most recent commit is the latest-completed phase.
3. **`TaskList`** — open tasks for the current phase (if pre-seeded) or none (if seeding the phase fresh).
4. **`viewmodel-shell/src/tui.tsx`** at HEAD — the current state of the rewrite.
5. **`viewmodel-shell/test/conformance.tui.test.ts`** at HEAD — the load-bearing gate.

That's all. The roadmap doesn't carry status; the spec is here, the status is in the world.

## Release shape (B5 only)

- One atomic commit: `feat(tui): B5 — OpenTUI rewrite complete; 0.6.0 release prep`.
- Version: `viewmodel-shell/package.json` `0.5.0` → `0.6.0`. NuGet decision deferred to B5 (see B5 scope).
- CHANGELOG `0.6.0` entry: substrate swap rationale, the Bun runtime requirement for `/tui` + `vms-tui`, the UX wins (mouse + scroll + per-pane focus + status line), the unchanged wire, lossy migration if any.
- MIGRATION `Upgrading to 0.6.0`: install-bun one-liner, swap `npx vms-tui` → `bunx vms-tui` in any existing scripts/docs, note that browser/server consumers are unaffected.
- Publish: operator-driven, in-turn greenlight. The flow used for 0.5.0 (temp gitignored `.npmrc` with `.env`-sourced `NPM_TOKEN` for npm; `dotnet nuget push` with `NUGET_API_KEY` for NuGet if NuGet also moves) applies unchanged.
