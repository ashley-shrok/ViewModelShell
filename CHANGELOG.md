# Changelog

All notable changes to ViewModel Shell. Format follows [Keep a Changelog](https://keepachangelog.com/).

This repo ships two version-aligned packages: **npm** `@ashley-shrok/viewmodel-shell` and **NuGet** `AshleyShrok.ViewModelShell`. They share major.minor; npm may take patch-only bumps for client-only changes (NuGet unchanged in those cases). Each entry notes which package(s) moved and **what, if anything, consumers must do**.

---

## 0.7.0 — `PageNode.width` override seam + page-max docs (npm + NuGet)

**npm:** `0.7.0` (MINOR — wire-format addition) · **NuGet:** `0.7.0` (MINOR — wire-format addition)

Both packages move together. The shared wire gains one optional `PageNode` field — no breaking change; existing consumers untouched. Closes [#13](https://github.com/ashley-shrok/ViewModelShell/issues/13).

### Added

- **`PageNode.width?: "wide" | "full"`.** Opt-in per-page max-width override. Omitted = framework default cap (`--vms-page-max`, 1080px). `"wide"` emits `.vms-page--wide` which expands to `var(--vms-page-max-wide)` (default 1440px). `"full"` emits `.vms-page--full` which removes the cap entirely. Sibling of the existing `density` and `layout` closed-union appearance modifiers; same wire shape (null-omitted on the wire, no modifier class when absent). `TuiAdapter` ignores the field — width caps are a browser concern; the terminal naturally fills.

  C#:
  ```csharp
  return new PageNode(
      Title: "Invoices",
      Layout: "stack",
      Width: "wide",       // wider page for the data-heavy table
      Children: [...]);
  ```

  TypeScript backend:
  ```typescript
  return {
    type: "page",
    title: "Invoices",
    layout: "stack",
    width: "wide",
    children: [...],
  };
  ```

- **`--vms-page-max` formally annotated as an additive override seam** in `styles/default.css` (matching the existing `--vms-card-min` treatment). Hosts can globally retune via a single `:root { --vms-page-max: 1280px }` after the theme import — already documented in `AGENTS.md`, now sanctioned in the inline CSS comment too. Companion token `--vms-page-max-wide` (default `1440px`) backs the `.vms-page--wide` modifier and is independently host-retunable.

### Fixed

- **`server.ts` multipart-file narrowing.** A latent build break in `parseFormDataAction` surfaced when `@types/node@22.19+` started shipping its own `File` interface alongside DOM's: `value instanceof File` ambiguates the narrow on `FormDataEntryValue`. Switched to `typeof value !== "string"`, which narrows the union to `File` unambiguously and is identical at runtime. Behavior unchanged; latent fix.

### Consumers

- **None required — additive.** Existing `PageNode` consumers untouched (new `width`/`Width` field is optional and null-omitted on the wire). Wire is forward-compatible. Cross-backend parity unchanged. The shipped `demo/ContactManager` now uses `width: "wide"` as a worked example of the new field.

---

## 0.6.0 — Terminal substrate rewrite (OpenTUI, Bun runtime) + interaction polish

**npm:** `0.6.0` (MINOR — client adapter rewrite, optional-dep set changes) · **NuGet:** `0.6.0` (MINOR — version-aligned no-op; no functional changes)

The terminal/TUI front-end is rewritten from scratch on a new substrate. **No wire change** — `ViewNode` types, `ShellSideEffect`, `ShellResponse`, every backend, and `parity/` are all untouched. NuGet bumps to `0.6.0` purely to keep shared major.minor with npm (the existing alignment rule); the package contents are identical to `0.5.0`. Browser and server consumers are unaffected.

### Changed

- **`@ashley-shrok/viewmodel-shell/tui` rewritten on [OpenTUI](https://github.com/anomalyco/opentui).** The Ink-based adapter (4 of its arc versions: 0.4.5–0.4.9) had two structural limitations end-users reported on real apps: no mouse support at all, and no scrollable-view primitive (overflow clipped silently). The Node TUI ecosystem in 2026 doesn't have an active library that delivers both with React-style ergonomics — `blessed` and `neo-blessed` are abandoned (2015 / 2018), `terminal-kit` is active but imperative, and OpenTUI is the only library that ships a React reconciler (`@opentui/react`) alongside `ScrollBox`, native mouse handling, focus management, and prebuilt platform binaries (`@opentui/core-{linux,darwin,win32}-{x64,arm64}` via `optionalDependencies`). OpenTUI is **currently Bun-only** (their docs: "Node and Deno support in-progress"), so the `/tui` subpath + `vms-tui` CLI now require Bun runtime. **Browser/server consumers are unaffected** — `.`, `./browser`, `./server` are pure JS with no native binaries and run on Node/Deno/Bun/Workers as before.
- **Mouse support throughout.** Click any button, checkbox (with action), link, copy-button, table header (sortable columns), or table row (with action) and the appropriate event dispatches. Wheel scrolls the focused pane's `<scrollbox>`. Cmd/Ctrl-click on external links opens them in the system browser via OSC-8 (already supported by every modern terminal).
- **Per-pane scrolling + Tab focus cycle (lazygit-style).** Each `section`/top-level `list`/top-level `table` is its own scrollable pane with a focus border. Tab/Shift-Tab cycles focus across panes; ↑↓ PgUp/PgDn scroll inside the focused pane.
- **Keyboard activation.** Enter on the focused pane activates its primary actionable (first button → dispatch action; first link → navigate; first copy-button → OSC-52 copy). Space toggles the focused pane's first checkbox-with-action. Both are no-ops when the focused pane has a field input (FieldView's `<input onSubmit>` owns Enter; Space is a printable character there).
- **Pane-aware status bar.** A persistent status line at the bottom of the viewport shows the current keybinds: always `Tab next pane | Shift-Tab prev | ↑↓ PgUp/PgDn scroll | Ctrl-C quit`, plus a context-aware slot — `Enter <button-label>` when a button is the primary actionable, `Enter submit` when the pane has fields, `Space toggle` when a checkbox is the primary, etc. The focused pane's section heading shows on the right so you always know where you are.
- **Modal overlay + focus trap (carried from B4).** Modals portal to the app-root z-level and trap Tab inside their interior — outer panes still render but aren't part of the cycle. Click `[ Close ]` or wire any `dismissAction` button to exit.
- **Draft preservation, copy-button OSC-52 + 1500ms revert, alt-screen + Ctrl-C teardown** (carried from earlier OpenTUI arc phases B1–B4) all unchanged.

### Removed

- **Ink, react@18, ink-text-input, ink-select-input** from `optionalDependencies`. Replaced with `@opentui/core` + `@opentui/react` + `react@19`. Existing consumers using `import { TuiAdapter } from "@ashley-shrok/viewmodel-shell/tui"` must update their install (and switch from `node`/`npx` to `bun`/`bunx` for the TUI subpath — see MIGRATION.md).

### Consumers

- **Browser / server consumers:** nothing to do. `.`, `./browser`, `./server` runtime-agnostic; NuGet contents are byte-identical to `0.5.0` (alignment-only version bump).
- **TUI consumers** (`vms-tui` CLI or programmatic `TuiAdapter`): one-time `curl -fsSL https://bun.sh/install | bash`, then `bunx vms-tui …` or `bun install`. See `MIGRATION.md` for the full step-by-step including the optionalDependency swap.
- **No wire change.** `parity/` 14-backend suite green; `conformance.tui.test.ts` (information parity vs. `BrowserAdapter`) green throughout the rewrite.

---

## 0.5.0 — Authenticated downloads (npm + NuGet)

**npm:** `0.5.0` (MINOR — wire-format addition) · **NuGet:** `0.5.0` (MINOR — wire-format addition)

Both packages move together. The shared wire gains one additive `ShellSideEffect` type — no breaking change; existing consumers untouched.

### Added

- **`ShellSideEffect "download"` — first-class authenticated file downloads.** Closes [#10](https://github.com/ashley-shrok/ViewModelShell/issues/10). Header-auth consumers (the `Authorization: Bearer <jwt>` pattern via `getRequestHeaders()`) previously had no way to offer auth-gated downloads: a `LinkNode` with `external: true` is a top-level browser navigation that carries no shell headers, so every auth-gated download endpoint returned 401. The new side-effect rides along with any action response — server authorizes inline (in the action handler, with the real Bearer-authenticated request context), then emits `ShellSideEffect.Download(url, filename?)`; the shell fetches the URL with `getRequestHeaders()` merged, parses `Content-Disposition` (RFC 5987 `filename*` wins over plain `filename`) + `Content-Type`, and saves via the new optional `Adapter.saveFile` capability. **No signed URL machinery required** — the existing header seam is reused. Wire shape: `{ "type": "download", "url": "...", "filename": "..." }` (filename optional).

  C#:
  ```csharp
  return new ShellResponse<MyState>(BuildVm(state), state)
      .WithEffect(ShellSideEffect.Download("/api/invoices/42/pdf", "invoice-42.pdf"));
  ```
  TypeScript backend:
  ```typescript
  return {
    vm: buildVm(state), state,
    sideEffects: [shellSideEffect.download("/api/invoices/42/pdf", "invoice-42.pdf")],
  };
  ```

- **`Adapter.saveFile?(data, filename, contentType)` — new optional capability verb.** Sibling of `navigate?` / `storage?` / `transport?`. `BrowserAdapter` implements it via `URL.createObjectURL` + a transient `<a download>` (revoked on the next tick). `TuiAdapter` writes to `$XDG_DOWNLOAD_DIR` → `~/Downloads` → CWD (filename sanitized — path separators stripped to prevent traversal — and prints the saved path to stderr). Missing the capability on an adapter that receives a `"download"` side-effect **fails loud** via `onError`, never a silent no-op (extends the existing fail-loud rule — a swallowed authenticated download is the same class of correctness/security bug as a swallowed auth-token write).

### Consumers

- **None required — additive.** Existing `ShellSideEffect` consumers untouched (new `Url`/`Filename` fields are optional and null-omitted on the wire). Existing custom `Adapter` implementations untouched — `saveFile?` is optional; adapters that want to support downloads implement the verb. Wire is forward-compatible (unknown side-effect types remain silently ignored). Cross-backend parity passes — the harness already diffs `sideEffects` arrays; the new `download-default` / `download-custom` fixture steps verify .NET and Bun emit byte-identical downloads.

---

## 0.4.9 — Terminal sidebar rail is proportional (npm only)

**npm:** `0.4.9` (PATCH — client-only) · **NuGet:** unchanged at `0.4.2`

No wire, type, or API change; NuGet untouched; major.minor stays `0.4`.

### Changed

- **`layout:"sidebar"`'s rail is now proportional, not a hardcoded 24 cols.** The rail was pinned to ~24 columns regardless of terminal width — ~16% of a 146-col terminal, too narrow for the idiomatic master/detail rail (a view-switcher + list), which hard-wrapped to vertical confetti; the only alternative, `split`, is a fixed 50/50 (too wide a master). On the fill path the rail is now `clamp(round(cols/3), 24, 56)` — ~⅓ on wide terminals (146 → ~49 ≈ 33%), never narrower than the legacy 24 on small terminals, capped so ultra-wide keeps the detail pane dominant — and the detail pane fills the remainder. This is adapter medium-adaptation (the terminal analog of the browser's CSS sidebar proportion); **deliberately not a wire field** — rail proportion is appearance, not layout arrangement, so it carries zero NuGet/parity blast radius. Tunable via `new TuiAdapter({ sidebarFraction: 0.3 })` (0.15–0.6; default ⅓). `split` stays 50/50 by definition; the proportional path is gated to a real interactive TTY so static/non-interactive output is byte-identical.

### Consumers

- **None required.** Client-only; no wire/type/NuGet change; static (`renderTree`) and non-interactive output byte-identical. Terminal master/detail apps now get a usable rail on wide terminals (tune via `{ sidebarFraction }`). Viewport fill / alt-screen / Ctrl-C·SIGINT·SIGTERM teardown re-verified.

---

## 0.4.8 — Terminal link OSC 8 fix (npm only)

**npm:** `0.4.8` (PATCH — client-only bug fix) · **NuGet:** unchanged at `0.4.2`

Long-latent terminal `link` rendering bug. No wire, type, or API change; NuGet untouched; major.minor stays `0.4`.

### Fixed

- **`link` nodes now emit a real OSC 8 hyperlink.** The terminal `link` renderer built its escape string with the ESC introducer and ST terminator missing — `]8;;<href><label>]8;;` instead of `ESC ]8;; <href> BEL <label> ESC ]8;; BEL` — so every `link` rendered as raw `]8;;…` garbage text (then truncated) in every terminal, in and out of tmux. Latent since the node was introduced; orthogonal to the 0.4.5–0.4.7 viewport work (the `link` case was untouched by it; `osc52()` was always correct, `link` simply lacked the escapes). Now emits a correct clickable OSC 8 hyperlink (BEL-terminated, matching `osc52()`'s proven `\x1b`/`\x07` style); terminals without OSC 8 ignore the escape and show just the label — graceful, vs. the old visible garbage. Empty/blank `href` still degrades to plain underlined text (no OSC wrapper) — unchanged.
- **Test gap closed.** The prior assertion only checked for the `]8;;` substring, which is present even in the broken (ESC-less) form, so it never caught this. The test now asserts the full byte form (ESC introducer + URI + BEL ST + closer) — a missing-ESC regression fails loudly.

### Consumers

- **None required.** Client-only bug fix — no wire/type/behavior change for browser/server consumers, no NuGet change. Terminal users with `link` nodes: `0.4.8` is required to get working hyperlinks (`0.4.7` and earlier render them as garbage). Static/non-interactive output now carries a proper escape instead of literal `]8;;` text; alt-screen + Ctrl-C/SIGINT/SIGTERM teardown re-verified.

---

## 0.4.7 — Terminal fill reaches section-wrapped content (npm only)

**npm:** `0.4.7` (PATCH — client-only fix) · **NuGet:** unchanged at `0.4.2`

Completes the `0.4.5`/`0.4.6` viewport-fill work. No wire, type, or API change; NuGet untouched; major.minor stays `0.4`.

### Fixed

- **Section-wrapped content now scales with the terminal.** `0.4.6` propagated fill through the `page`/`layoutContainer` boxes but not into `section` — the idiomatic content container (e.g. the shipped Tasks shape: `page(sidebar)` › `section(card)` rail + `section` detail) — so `sidebar`-laid content still rendered at a fixed intrinsic width while the surrounding surface filled. Root cause: the `width:"100%"` strategy resolved fragilely against an uncertain parent and content-fell-back on the flexShrink rail, and `flexGrow` did not distribute past it. Reworked to **explicit numeric-width threading**: the page container and the page's top layout container take a real numeric width derived from the terminal; the sidebar splits into a fixed numeric rail + an exact-remainder main pane (a single numeric-width column directly holding the sections); everything below fills via Yoga align-stretch from those numeric anchors. `sidebar`, `split`, `stack`, and nested sections now scale and re-flow with terminal size (verified end-to-end against the real adapter at multiple widths). `cards` is intentionally still a uniform small-tile grid.

### Consumers

- **None required.** Client-only; gated on the same real-TTY/alt-screen condition, so static (`renderTree`) and non-interactive (pipe/CI/agent/`</dev/null`) output is byte-identical (verified: core dist + the 143 existing + conformance tests unchanged). Opt-out unchanged: `new TuiAdapter({ viewport: "content" })`. Alt-screen + Ctrl-C/SIGINT/SIGTERM/crash restore re-verified.

---

## 0.4.6 — Terminal viewport fill now reaches the content (npm only)

**npm:** `0.4.6` (PATCH — client-only fix) · **NuGet:** unchanged at `0.4.2`

Completes `0.4.5`. No wire, type, or API change; NuGet untouched; major.minor stays `0.4`.

### Fixed

- **Content now scales with terminal size, not just the (invisible) root.** `0.4.5` made the root surface terminal-sized + alt-screen, but the layout spine didn't propagate that width: `page` → `layoutContainer` panes stayed intrinsic-width, so `layout:"sidebar"`/`"split"`/`"stack"` content rendered at a fixed width at any terminal size (probed: identical at cols=100 and cols=160). Root cause: Ink/Yoga `align-stretch` does **not** reliably fill a nested content column here — an explicit `width:"100%"` on the spine wrappers does. The fix propagates fill (gated on the same real-TTY/alt-screen condition as `0.4.5`) through the `page` container and the sidebar/split/stack layout containers so panes occupy the terminal and re-flow with it. `cards` is intentionally left as a uniform small-tile grid (filling it would defeat the preset).

### Consumers

- **None required.** Client-only; no wire/type/NuGet change; static (`renderTree`) and non-interactive (pipe/CI/agent/`</dev/null`) output is byte-identical (the fill gate is off there). Opt-out unchanged: `new TuiAdapter({ viewport: "content" })`. Alt-screen + Ctrl-C/SIGINT/SIGTERM/crash restore re-verified; width now scales with terminal size (PTY: cols 100 vs 160).

---

## 0.4.5 — Terminal full-viewport + alternate screen (npm only)

**npm:** `0.4.5` (PATCH — additive, client-only) · **NuGet:** unchanged at `0.4.2`

Client-only terminal-adapter enhancement; per the versioning model an npm patch bump while NuGet is untouched (major.minor stays `0.4`). No wire, type, or API change; no backend change.

### Added / Changed

- **The terminal adapter now fills the viewport.** On an interactive TTY `TuiAdapter` occupies the whole terminal via the alternate-screen buffer (vim/htop-style takeover; prior scrollback restored verbatim on exit) and re-flows on `resize`, so `layout: "sidebar"` and any `flexGrow` content expand instead of rendering a small box in a corner — the terminal analog of `BrowserAdapter` filling the browser viewport. Root cause of the old behavior: Ink does not size its root to the terminal, so `flexGrow` had no terminal-sized ancestor to expand into. **This changes the default look on an interactive terminal** (previously intrinsic content size).
- **Opt-out:** `new TuiAdapter({ viewport: "content" })` keeps the prior content-size behavior with no screen takeover.
- **Non-interactive runs are unaffected.** Pipe / CI / agent / `</dev/null` keep the `0.4.4` behavior exactly: one static frame, exit, **no alternate-screen escape emitted**. The fill/alt-screen gate keys off the real `process.stdout`/`process.stdin` TTYs; alternate-screen restore is funnelled through the same idempotent teardown as the cursor restore (re-verified Ctrl-C/SIGINT/SIGTERM/crash).

### Consumers

- **None required for browser/server consumers** — client-only, no wire/type/NuGet change. **Terminal consumers:** the default is now full-screen on an interactive TTY; pass `new TuiAdapter({ viewport: "content" })` if you need the old intrinsic size. Non-TTY/CI behavior is unchanged.

---

## 0.4.4 — Terminal non-TTY crash fix (npm only)

**npm:** `0.4.4` (PATCH — client-only bug fix) · **NuGet:** unchanged at `0.4.2`

Patches a `0.4.3` regression in the new terminal adapter. No wire, type, or API change; NuGet untouched; major.minor stays `0.4`.

### Fixed

- **`vms-tui` no longer crashes on non-TTY stdin.** Run with a non-interactive stdin (pipe, `</dev/null`, CI/cron, an agent shell), the adapter dumped a React/Ink "Raw mode is not supported" error frame instead of degrading to the intended one-shot static render. Root cause: Ink reports `isRawModeSupported` as `undefined` (not `false`) on a non-TTY stdin, and Ink's `useInput` skips raw mode only when `isActive === false` *strictly* — so the gate passed `undefined` and Ink still enabled raw mode. The adapter now coerces the gate to a strict boolean; the CLI additionally treats a non-TTY *stdin* (not only stdout) as non-interactive, preventing a hang when stdout is a TTY but stdin is piped. Interactive terminals are unchanged (Ctrl-C / SIGINT → 130, SIGTERM → 143, cursor restored — re-verified).
- **Missing-optional-deps hint corrected.** `vms-tui`'s hint listed only `ink react`; the adapter also imports `ink-text-input` and `ink-select-input`. The hint now lists all four, and the README documents that programmatic / `bun install` consumers must add them explicitly (optional deps are not pulled transitively).

### Consumers

- **None required.** Client-only bug fix — no wire/type/behavior change for browser or server consumers, no NuGet change. Terminal users in non-interactive shells must take `0.4.4` (`0.4.3` errors there); `npx vms-tui@latest` picks it up automatically.

---

## 0.4.3 — Terminal (TUI) front-end (npm only)

**npm:** `0.4.3` (PATCH — additive, client-only) · **NuGet:** unchanged at `0.4.2`

The packages stay aligned at major.minor `0.4`: this is a client-only npm change, so per the versioning model it takes an npm patch bump while NuGet is untouched — the same independent-patch model used at `0.4.1`. **No wire, type, or API change in either package; no backend change of any kind.**

### Added

- **`@ashley-shrok/viewmodel-shell/tui` adapter + the `vms-tui` CLI.** Drive any ViewModel Shell backend from a terminal — `npx vms-tui <endpoint-url>`, or `new TuiAdapter()` programmatically, wired exactly like `BrowserAdapter`. Same wire, same `(state, action) → { vm, state }` contract, zero backend change: a backend that serves a browser serves a terminal unchanged. Built on [Ink](https://github.com/vadimdemedes/ink) as an **optional** dependency — installed automatically for CLI/`npx` use, never imported by the `.`/`./browser`/`./server` entrypoints, so web and server consumers are byte-unaffected (the compiled core `dist` is byte-identical, machine-verified). A cross-adapter conformance suite asserts the terminal and DOM adapters surface the same information for the same view tree.

### Consumers

- **None required.** Additive and client-only — no wire, type, behavior, or NuGet change; existing browser/server apps are unaffected and need not upgrade. Cross-backend parity is unchanged (the TUI is a client; it cannot affect the wire). Optional: `npx vms-tui <your-endpoint>` to drive an existing app from a terminal.

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
