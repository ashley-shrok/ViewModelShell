# Changelog

All notable changes to ViewModel Shell. Format follows [Keep a Changelog](https://keepachangelog.com/).

This repo ships two version-aligned packages: **npm** `@ashley-shrok/viewmodel-shell` and **NuGet** `AshleyShrok.ViewModelShell`. They share major.minor; npm may take patch-only bumps for client-only changes (NuGet unchanged in those cases). Each entry notes which package(s) moved and **what, if anything, consumers must do**.

---

## 0.3.13 — Capability seam + upload progress

**npm:** `0.3.13` (PATCH) · **NuGet:** `0.3.9` (unchanged — no .NET/wire change)

**Architecture:** The core (`src/index.ts`) is now a strict wire-protocol transformer that references **zero platform globals** — a CI-enforced, checkable invariant, not an aspiration. `window.location`/`localStorage`/`sessionStorage` relocated out of core into `BrowserAdapter` behind a capability seam (`navigate?`/`storage?`/`transport?` optional `Adapter` methods).

### Added
- `ShellOptions.onUploadProgress?: (sent: number, total: number) => void` — real upload progress for file-bearing dispatches, built through the new `transport` seam (XHR binding lives in `BrowserAdapter`, never core).

### Consumer action
- **None required.** Fully backward-compatible. `transport?` is optional; `fetch` remains the universal default. Existing custom `Adapter` implementations keep working. Wire format, redirect, side-effects, polling, all ViewNode types unchanged.
- Opt into upload progress by setting `onUploadProgress`. Note two documented behaviors: it only fires if the active adapter implements `transport` (`BrowserAdapter` does); and `total` may be `0` meaning indeterminate — guard against divide-by-zero in percentage math.
- Full detail and upgrade steps: [`MIGRATION.md`](./MIGRATION.md).

## 0.3.12 — Scoped box-sizing reset

**npm:** `0.3.12` (PATCH) · **NuGet:** unchanged

### Fixed
- `.vms-field__input` and `.vms-table__filter-input` overflowed padded containers (missing `box-sizing`). Fixed with `box-sizing: border-box` scoped to `.vms-page`/`.vms-modal-backdrop` subtrees — not a global `*` reset (the opt-in stylesheet must not stomp host-app elements).

### Consumer action
- Bump npm to `^0.3.12`. CSS-only; remove any local `box-sizing` override you added to work around this.

## 0.3.11 — Compiled output (works in plain Node)

**npm:** `0.3.11` (PATCH) · **NuGet:** unchanged

### Changed
- Package now ships compiled `.js` + `.d.ts` (was raw `.ts`). Previously failed in vanilla Node with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`; worked only under Bun/Deno/bundlers.

### Consumer action
- Use `^0.3.11`. Transparent to bundler/Bun consumers; **unblocks plain-Node consumers** (no loaders/flags needed). Same imports, resolves to compiled output.

## 0.3.10 — TypeScript backend subpath

**npm:** `0.3.10` · **NuGet:** unchanged

### Added
- `@ashley-shrok/viewmodel-shell/server` subpath — backend types + `createAction`, `parseFormDataAction`, `parseJsonAction`, `shellRedirect`, `shellSideEffect`. Web Fetch–native (Hono/Bun/Deno/Workers). Mirrors the NuGet backend; same npm package so types can't drift.

### Consumer action
- None for existing consumers. New: TypeScript backends can drop .NET. (Prefer `^0.3.11` — see above; 0.3.10 raw-TS fails in plain Node.)

## 0.3.4–0.3.9 — Feature run

Shipped as patch bumps (project convention: features are patches; minor reserved for ViewNode/wire-format changes that move both packages):

- **0.3.9** — `ActionPayload<TState>.ParseJson` for JSON-body action dispatch (curl/agent ergonomics alongside multipart). *NuGet.*
- **0.3.8** — `ModalNode.Size` (`narrow`/`medium`/`wide`/`fullscreen`) + table horizontal-scroll on overflow. *Both.*
- **0.3.7** — Fix: table clipping inside `ModalNode` (`flex-shrink:0` on modal-body children). *npm.*
- **0.3.6** — Polling + push: `pollInterval`, `ShellResponse.NextPollIn`, `shell.push()`. *Both.*
- **0.3.5** — Client side-effects: `set-local-storage` / `set-session-storage` via `ShellSideEffect`. *Both.*
- **0.3.4** — Server-initiated redirect: `ShellResponse.RedirectTo(url)` + `onRedirect` hook. *Both.*

### Consumer action
- All additive/backward-compatible. Bump to latest to access; no migration required.

## 0.3.1–0.3.3 — Early iteration

Initial dual-package publish, packaging/styling stabilization. No consumer action.

---

*For the capability-seam architectural change (0.3.13), see [`MIGRATION.md`](./MIGRATION.md). For cross-backend wire-format guarantees, see `AGENTS.md`.*
