# Changelog

All notable changes to ViewModel Shell. Format follows [Keep a Changelog](https://keepachangelog.com/).

This repo ships two version-aligned packages: **npm** `@ashley-shrok/viewmodel-shell` and **NuGet** `AshleyShrok.ViewModelShell`. They share major.minor; npm may take patch-only bumps for client-only changes (NuGet unchanged in those cases). Each entry notes which package(s) moved and **what, if anything, consumers must do**.

---

## 0.4.2 — Documentation de-drift (npm + NuGet, docs only)

**npm:** `0.4.2` (PATCH — README only) · **NuGet:** `0.4.2` (PATCH — packaged README only)

**No code, type, wire, or API change in either package.** Both packages move together at `0.4.2` solely to ship corrected package READMEs; major.minor stays aligned at `0.4`.

### Fixed

- **NuGet packaged README no longer enumerates the `ViewNode` set.** The shipped `README.md` "What's in the package" section hand-listed the node types and had fallen behind the assembly — it omitted `CopyButtonNode`, which is present in the `0.4.0` and `0.4.1` DLLs (the type was added before `0.4.0` shipped). That stale list — *not* any missing type — is what [issue #9](https://github.com/ashley-shrok/ViewModelShell/issues/9) reported. The README now points to `ViewModels.cs` as the single source of truth instead of duplicating the list, so it cannot drift from the assembly again. The `0.4.0`/`0.4.1` assemblies were always correct (a .NET backend on either *can* emit `copy-button`); this release only refreshes the README rendered on nuget.org.
- **npm packaged README corrected.** It still claimed the base stylesheet "ships a dark-purple theme" and listed the theme files inline; the shipped default has been **light** since `0.4.0`. The default-theme text is now accurate and points to `styles/themes/` rather than an inline list that drifts as themes are added.

### Consumers

- **None required.** Doc-only — no behavior, wire, or type change. Upgrade only to read the corrected package pages; not needed for any functional reason. Cross-backend parity remains 7/7 byte-identical (verified).

---

## 0.4.1 — Table-row variants styled (npm) · null-omission made intrinsic (NuGet)

**npm:** `0.4.1` (PATCH — stylesheet only) · **NuGet:** `0.4.1` (PATCH — serialization hardening; **no contract/type change** — symmetric to how npm `0.4.1` was a NuGet-untouched CSS patch; the wire *contract* is unchanged, only non-conforming hosts are corrected toward it)

The two packages moved independently at `0.4.1` (the versioning model permits this for patch-level package-local changes; major.minor stays aligned at `0.4`). npm `0.4.1` shipped first (CSS only); NuGet `0.4.1` ships the serialization fix below.

### Fixed — npm (stylesheet)
- **`vms-table__row--<variant>` was a styled-only-for-some passthrough.** `browser.ts` emits `vms-table__row--${variant}` for *any* `TableRow.Variant`, but `default.css` shipped rules for only `clickable/done/warning/critical`. `disabled`, `success`, `danger`, and `running` were **emitted-but-unstyled** — forcing consuming apps to keep an app-local CSS shim to mute/tint those rows, which contradicts the "apps shouldn't roll their own CSS" goal. (The original report flagged only `--disabled`; full audit found `success`/`danger`/`running` equally unstyled — all four are now closed, so *every* such shim can be deleted, not just the disabled one.) Added, mirroring the `.vms-list-item--*` precedent:
  - `--disabled` — `opacity` + `var(--vms-text-muted)`; also neutralises the `--clickable` cursor/hover when a row is both.
  - `--success` / `--running` / `--danger` — subtle full-row status tints.
- **`--warning`/`--critical` re-based onto theme vars.** They previously hardcoded non-themeable `rgba()` literals that ignored a custom `:root`; now `color-mix(in srgb, var(--vms-…) 8–9%, transparent)` like the new variants, so all row tints recolor automatically under any theme (latent bug fixed). `--danger` is a `--critical` alias (shared `--vms-error` tint), matching `.vms-button--danger`/`.vms-list-item--critical`.

### Fixed — NuGet (serialization contract)
- **Null-omission is now intrinsic to the published wire types.** The contract has always been "an unset optional is *absent*, never `"field": null`" (npm `.d.ts` declares optionals as `T | undefined`; the parity normalizer treats `null` ≡ missing; the renderer tolerates both). But on the .NET side this was enforced *only* by host boilerplate — `DefaultIgnoreCondition = WhenWritingNull` in `Program.cs` (documented as footgun #6 in `AGENTS.md`). A host that skipped it (e.g. default ASP.NET web JSON options) emitted `"placeholder": null`, so consumers with strict TS wire-fidelity tests failed `tsc` against the correct published `.d.ts`. Every nullable (`T?`) member of every outbound wire record now carries `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`, which System.Text.Json honors **regardless of host `JsonSerializerOptions`**. The contract is now self-enforcing and cannot drift per app; footgun #6 is disarmed (the `Program.cs` line becomes redundant defense-in-depth). Non-nullable members (incl. `bool`/`int` with semantic defaults like `Required:false`) deliberately still serialize their value. *Rejected the alternative "widen npm types to `T | null`" — that would corrupt a correct published contract to legitimise a misconfigured host.*

### Consumer action
- **npm:** bump to `^0.4.1`. CSS-only — no wire/API/ViewNode change, existing apps render unchanged unless they used these variants. Delete any app-local `.vms-table__row--{disabled,success,danger,running}` shim. (`color-mix()` is Baseline-2023; the shipped default already requires modern CSS — `clamp()` etc.)
- **NuGet:** bump to `^0.4.1`. **Correctly-configured hosts (those following the documented `Program.cs`): zero wire change — byte-identical.** Misconfigured hosts: their wire is *corrected* (stray `"field": null` → field absent), matching the published `.d.ts` — delete any per-app `T | null` casts / wire-fidelity test workarounds. No `ViewNode`/type/contract change; cross-backend parity for the wire contract (the `feature-probe` fixture) stays green across dotnet/bun/node. The `Program.cs` `DefaultIgnoreCondition` line is now optional (kept in demos as harmless defense-in-depth).

---

## 0.4.0 — Design system: theme + layout + canonical examples

**npm:** `0.4.0` (MINOR) · **NuGet:** `0.4.0` (MINOR — wire-format change, aligned)

One consolidated milestone: a serviceable shipped default look, an additive layout-preset enum, and the canonical-example surface. The npm `0.3.14`→`0.4.0` / NuGet `0.3.10`→`0.4.0` jump is a **MINOR because the `layout` enum is a wire-format change** — by the [`AGENTS.md`](./AGENTS.md) `major.minor`-alignment rule both packages move together (this is the same rule that kept `0.3.13` a PATCH because it had *no* wire change — symmetric reasoning, opposite outcome).

### Realistic-demo stress-test (post-execution, D-26–D-29)

A human visual review rebuilt every demo to look like a real app of its type; it surfaced gaps closed as small **additive** semantic presets (no wire-breaking change — new fields optional, omitted = prior behavior byte-identical):

- **D-26** — fixed 5 dark themes (`dark-blue/green/rose/amber/teal`) the light re-base broke (accent-only partials that had inherited the old dark default); now self-sufficient full overrides. New CI guard `check:theme-function` asserts every theme yields its named scheme. *Consumers: none — corrected files; the `dark-purple` one-line restore is unchanged.*
- **D-27** — shipped `.vms-list-item--active` default (master-detail / nav selection highlight; themable via accent seam vars, no wire change). *Consumers: set `variant:"active"` on the selected row to use it.*
- **D-28** — new `layout:"sidebar"` value on `PageNode`/`SectionNode` (thin + wide app shell; wraps to stacked on narrow, zero `@media`). Additive enum value. *Consumers: opt-in.*
- **D-29** — new `FormNode.layout?: "stack" | "inline"` (`inline` = field row + submit on one line — add/search bar). Additive optional field. *Consumers: opt-in.*

Deferred (explicit, not silent): HelpDesk requester realistic redesign; FeatureProbe value-level parity for the new `sidebar`/`inline` values (the layout *field* is parity-covered; opaque string values can't drift between backends); `.vms-list-item` is a fixed horizontal row (cramps very narrow columns — a list-item layout option is the real fix); `LAYOUT-F1` fixed-N grid stays deferred (`cards` proven a credible board).

### Added
- **Shipped default design system** — `viewmodel-shell/styles.css` now delivers a centered `.vms-page` page shell (`--vms-page-max: 1080px`, `clamp()`-padded, zero `@media`), a coherent additive spacing scale (6 `--vms-space-*`) and type scale (7 all-`rem` `--vms-text-*`), so the look is handled with zero app CSS.
- **`PageNode.density?: "comfortable" | "compact"`** — additive optional closed-union wire field (both backends); `compact` remaps the rhythm tokens. Omitted/`comfortable` is byte-identical to prior behavior.
- **`SectionNode.variant?: "card"`** — additive optional closed-union wire field (both backends); grouped card surface built from existing seam vars, zero new color tokens.
- **`layout?: "stack" | "split" | "cards"`** on `PageNode`/`SectionNode` — additive optional closed-union layout-preset enum (both backends). `split` = capped-2-equal-column intrinsic grid collapsing to 1 narrow; `cards` = auto-fit grid from one additive `--vms-card-min: 16rem`. Pure CSS, no spans/tracks/areas on the wire.
- **`themes/dark-purple.css`** — a new shipped theme file that is a byte-exact capture of the prior (pre-0.4.0) dark default `:root`. Importable as `@ashley-shrok/viewmodel-shell/themes/dark-purple.css`.
- **Canonical reference set** — the Showcase gains navigable Dashboard / Form-heavy / List-detail archetypes (benchmarked against Bootstrap's Dashboard/Checkout/Album pages) alongside the kitchen-sink component gallery; every demo runs on the shipped stylesheet with zero per-demo `<style>` chrome.

### Changed
- **Shipped default palette re-based dark→light.** The unthemed `default.css` `:root` now uses the light `light-purple` value set (`--vms-bg #f7f7f9`, `--vms-surface #fff`, `--vms-accent #5a4ad7`, `--vms-color-scheme light`) instead of the prior dark default. This is an **intentional default-appearance change, NOT a wire/API/ViewNode break**. `themes/light-purple.css` is byte-unchanged (it becomes a harmless no-op override). The prior dark look is preserved byte-exact in the new `themes/dark-purple.css`.
- **One shipped-default value tightened for WCAG-AA.** The unthemed default's `--vms-warning` ships as `#a37510` (a slightly darker amber than `light-purple.css`'s `#c89610`) so the shipped default clears the WCAG-AA non-text contrast floor (≥3.0:1 on `--vms-bg`/`--vms-surface`/`--vms-surface-2`; was 2.51/2.68/2.36:1, now 3.84/4.11/3.62:1, CI-enforced). This is **only** the unthemed shipped default — consumers importing `themes/light-purple.css` explicitly still get `#c89610` (that theme file is byte-unchanged). Same one-value-tighten-to-pass-AA precedent as the `0.3` `--vms-text-muted` fix; it is not a seam behavior change (the variable still exists and themes still override it).
- **Demos de-chromed** onto the shipped stylesheet — per-demo hand-rolled `<style>` blocks removed; each demo statically pins a distinct shipped theme via its entrypoint import (the real-app pattern).

### Consumer action
- **None required for the wire contract.** The `layout`, `density`, and `variant` fields are all **additive optional closed unions** — omitted = byte-identical prior behavior; cross-backend parity stays 100% green. Existing apps render unchanged unless they opt in.
- **The shipped default look changed dark→light.** If you relied on the prior dark default and set **no** theme / no `:root`, restore the exact prior look with one line: `import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css";`. Existing apps that already set their own `:root` or import any theme are **unaffected** (the default never applied to them).
- The npm `0.3.14`→`0.4.0` / NuGet `0.3.10`→`0.4.0` jump is a MINOR because the `layout` enum is a wire-format change — by the `AGENTS.md` `major.minor` rule both packages move together (symmetric to the `0.3.13` "why PATCH" explanation: no wire change → PATCH; wire change → aligned MINOR).
- Full detail and the upgrade walkthrough: [`MIGRATION.md`](./MIGRATION.md).

---

## 0.3.14 — CopyButtonNode (copy text to clipboard)

**npm:** `0.3.14` (PATCH) · **NuGet:** `0.3.10` (PATCH — new ViewNode type on both sides)

### Added
- `CopyButtonNode` (`type: "copy-button"`) — inline copy-to-clipboard node. Set `text` (the string to copy), optionally `label` (button label, default "Copy") and `copiedLabel` (ephemeral feedback label, default "Copied!"). Pure adapter-side: no dispatch, no server round-trip. Browser adapter writes via `navigator.clipboard.writeText`; falls back to legacy `execCommand("copy")` on insecure contexts; silent on both failures.

### Consumer action
- **None required.** Additive; backward-compatible. Use `new CopyButtonNode(text)` (.NET) or `{ type: "copy-button", text: "..." }` (TypeScript) to include a copy button anywhere in the view tree.

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
