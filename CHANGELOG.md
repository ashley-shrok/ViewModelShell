# Changelog

All notable changes to ViewModel Shell. Format follows [Keep a Changelog](https://keepachangelog.com/).

This repo ships two version-aligned packages: **npm** `@ashley-shrok/viewmodel-shell` and **NuGet** `AshleyShrok.ViewModelShell`. They share major.minor; npm may take patch-only bumps for client-only changes (NuGet unchanged in those cases). Each entry notes which package(s) moved and **what, if anything, consumers must do**.

---

## 1.0.0 — Truly Self-Describing Wire (npm + NuGet)

**npm:** `1.0.0` (MAJOR — breaking wire-format change: context payload removed, bind paths added, error envelope, ok flag) · **NuGet:** `1.0.0` (MAJOR — same wire contract, aligned per the major.minor rule)

Before: the wire was self-describing only when paired with the browser renderer — agents driving the API had to mentally simulate the renderer to know what `context` payload to send. After: an agent reading only `{vm, state}` from a GET and walking the tree can dispatch any action identically to the browser. The `context` field is gone; every input binds to a state path; action names are unique per operation; the renderer is a thin interpreter. Paired with a framework-owned `ok` flag + `{ok: false, errors: [...]}` envelope so failures are uniformly legible across every VMS app.

### Why

The original framework pitch — "agents drive what the browser drives" — had an asterisk: the browser renderer assembled a `context` payload using scope rules absent from the wire. v1.0.0 removes the asterisk. Agents now have one stable failure-check (`body.ok`) and one stable dispatch shape (`{action: {name}, state, files?}`).

### Added (wire-shape and protocol)

- Every input node declares a `bind` path (`bind: "fields.title"`); the renderer reads/writes through it.
- Dispatch wire is `{action: {name}, state, files?}` — no `context` field.
- Action-name uniqueness enforced at tree-build time (`ValidateActionNames`).
- Top-level `ok: true | false` on every response.
- `{ok: false, errors: [{path?, message, code?}]}` envelope on framework failures.
- Stable framework-only `code` vocabulary: `parse_error`, `unknown_action`, `invalid_tree`, `uncaught_exception`.
- New exception classes: `UnknownActionError` (TS, `@ashley-shrok/viewmodel-shell/server`) / `UnknownActionException` (.NET, `ViewModelShell` namespace).
- New client error class: `VmsActionError extends Error` exported from `@ashley-shrok/viewmodel-shell` — surfaced via the existing `onError` callback with `errors`, `status`, and `code` shortcut.
- .NET: `ShellExceptionFilter` registered in `Program.cs` translates thrown exceptions to envelope responses (no per-controller boilerplate).

### Demo + parity

- All 14 demo backends (.NET + bun, plus FeatureProbe-node) migrated to the new shape — `default:` arms throw the new exception classes, FeatureProbe gains a `boom` action exercising the uncaught-throw path.
- Cross-backend parity: 8 fixtures (the existing 7 + new `feature-probe-envelope`) across all 15 backends byte-identical. The new fixture covers all three envelope cases (parse / unknown-action / uncaught) with strict status-code assertions per case.
- `vitest run`: full TS suite green; new tests cover the envelope wrap on the server side and the parse-then-branch on the shell side.
- `dotnet test`: full .NET suite green; new tests cover the envelope types, exception filter, and round-trip through every demo controller.

### Consumers

Breaking change — aligned npm + NuGet major bump. No compatibility shims. Upgrade path is one consolidated section in MIGRATION.md (single 0.4.x → 1.0.0 recipe; you don't read it in two chunks). The migration is mechanical: add bind paths on inputs, make action names unique, swap `default:` arms to throw the new exception, register the .NET filter, and optionally branch on `VmsActionError` in `onError`.

---

## 0.16.0 — `ShellResponse.busy` (UI lockout) + generic per-round-trip lock (npm + NuGet)

**npm:** `0.16.0` (MINOR — new optional wire field + new optional `Adapter` capability verb + default CSS rule) · **NuGet:** `0.16.0` (MINOR — `ShellResponse.Busy` property)

Both packages move together (wire-format addition). Purely additive — every existing response renders byte-identically.

### Why

Two interaction-honesty problems we kept brushing against:

1. **Rapid clicks during a single round-trip silently mislead** — the dispatch guard drops them (correct behavior), but the DOM-default checkbox flip / button depression *happens visually* before the dispatch is dropped. The user sees a state that the framework never accepted. This is what made `TableSelection.action` un-shippable in 0.15.0.
2. **Long-running server actions have no client-side lockout** — the server can render a "Working…" view, but between polls the user can still keyboard-activate elements behind the modal, race the first response, etc. The server-side gate catches it after the dispatch reaches the server, which is too late.

Both reduce to one principle: **when a user dispatch is going to be dropped, the UI must not appear responsive**. 0.16.0 wires that principle into the framework.

### Added

- **`ShellResponse.busy?: bool`** (TS) / **`ShellResponse<TState>.Busy: bool`** (C#, `WhenWritingDefault` → wire omits `false`). When `true`, the shell drops user-initiated dispatches client-side; polls (`silent: true`) bypass so the server can clear the state. Same idempotent on-every-response shape as `PreventUnload`; the two pair naturally for long-running server actions.
- **`Adapter.setBusy?(active: boolean)`** — new optional capability verb. Shell calls it on every transition with `serverBusy || userDispatching`. Fail-quiet by absence (TUI has no equivalent).
- **`BrowserAdapter.setBusy`** — toggles `.vms-busy` on the container. Idempotent.
- **Default CSS:** `.vms-busy { cursor: wait }` + `pointer-events: none` on interactive descendants. The lock is **honest**: clicks never reach the input, so checkboxes can't visually flip during a round-trip; buttons can't depress.
- **Generic per-round-trip lock** (the lesson from `TableSelection.action`): the shell *also* applies `.vms-busy` for the duration of every user-initiated dispatch automatically — no server flag required. Polls (silent dispatches) don't toggle the class, so a long action with `busy: true` + polling stays continuously locked without flicker.

### Demo + parity

FeatureProbe's "Start long action" handler now returns both `PreventUnload = true` AND `Busy = true` (and clears both on completion). Existing fixture steps validate the pairing across all 7 backend groups (dotnet-probe / bun-probe / node-probe).

### Consumers

Nothing to do — additive. To opt into the explicit long-action lockout, return `Busy = true` from every render handler while server-side work is pending; clear it (omit or set `false`) when the work completes. The implicit per-round-trip lock applies to every existing app automatically; the dispatch guard's UX is now visually honest by default.

---

## 0.15.0 — Remove `TableSelection.action` (server-truth toggle mode) (npm + NuGet)

**npm:** `0.15.0` (MINOR — breaking removal in pre-1.0, but no app in our orbit was using it) · **NuGet:** `0.15.0` (MINOR — same)

Both packages move together. Intentional pruning, not a deprecation.

### Removed (breaking)

- **`TableSelection.action`** — the per-toggle round-trip "server-truth" mode. It had a known UX foot-gun (rapid checkbox clicks were silently dropped by the dispatch guard while a round-trip was in flight, and the in-flight response then re-rendered the table with stale `selectedIds` that wiped the visually-flipped checkbox). The 0.13.0 release made it optional and added `selection.buttons[]` as the recommended path; this release deletes the mode entirely so the latent bug can't bite anyone who happens to wire it up later. The way back, if it ever turns out we need it, is a redesigned wire shape (dispatch queueing + optimistic DOM preservation), not the original `action` field.
- **`TableSelection.Action`** parameter (C#) removed from the record. Now only `(IReadOnlyList<string> SelectedIds, IReadOnlyList<ViewNode>? Buttons = null)`.

### Adapters simplified

- **`BrowserAdapter`** — header select-all and per-row checkbox handlers are now single-path: toggle DOM + `.vms-table__row--selected` class. No more dispatch branch.
- **`TuiAdapter`** — checkbox column is render-only (was already inert in local mode); the `onToggleAll`/`onToggleRow` callbacks are gone since they had no purpose left.
- **CSS** unchanged. **`selection.buttons[]` unchanged.**

### Migration

If you happened to wire `selection.action` somewhere, the 60-second swap is documented in `MIGRATION.md` — drop the field, move bulk handlers from "read state.SelectedIds" to "read context selectedIds harvested by `selection.buttons[]`" (the pattern HelpDesk-Agent uses since 0.13.0). For everyone else: nothing to do.

### Demo + parity

`FeatureProbe`'s table-matrix demo had selection wired through the removed `action` path. Selection is now stripped from that matrix — sort / filter / pagination coverage stays. Selection.buttons[] parity coverage lives in HelpDesk-Agent (unchanged). The feature-probe fixture loses 6 `tbl-select-*` steps; helpdesk still validates the bulk-action-with-`selectedIds`-in-context flow end-to-end.

### Why now

The framework's first-app shipping caught the bug in the wild. With direct visibility that no other consumer was using the mode, removing it is cheaper than carrying a known-buggy code path "for completeness." This is the same principle as the AGENTS.md "if your app needs a workaround, that's a signal the framework needs a new primitive" — the inverse: if a primitive is known-buggy and no one needs it, remove it.

---

## 0.14.0 — `ShellResponse.preventUnload` (warn-before-leave guard) (npm + NuGet)

**npm:** `0.14.0` (MINOR — new optional wire field + new optional `Adapter` capability verb) · **NuGet:** `0.14.0` (MINOR — `ShellResponse.PreventUnload` property)

Both packages move together (wire-format addition). Closes [#18](https://github.com/ashley-shrok/ViewModelShell/issues/18). Purely additive — every existing response renders byte-identically.

### Added

- **`ShellResponse.preventUnload?: bool`** (TS) / **`ShellResponse<TState>.PreventUnload: bool`** (C#, `WhenWritingDefault` → wire omits `false`). When `true`, the shell asks the adapter to install a "warn before navigating away" guard until the next response that clears it. The natural pattern is "set it on every response while server-side work is pending, omit it (or set false) once the work completes" — exactly the same shape `NextPollIn` uses for polling cadence, drives the same lock-and-release lifecycle.
- **`Adapter.setPreventUnload?(active: boolean)`** — new optional capability verb. Called by the shell on every response (load + dispatch + push) with `body.preventUnload ?? false`. **Fail-quiet by absence** (unlike `navigate` / `storage` / `saveFile`): this is a UX safety net, not a security guarantee, and non-browser targets (TUI) have no terminal equivalent.
- **`BrowserAdapter.setPreventUnload`** — installs / removes a `beforeunload` listener that calls `preventDefault()` + sets `returnValue` (the two-signal pattern modern browsers accept). Idempotent: install when already installed is a no-op; remove when not installed is a no-op. **Modern browsers control the dialog text** ("Leave site? Changes you made may not be saved") and do not allow custom messages — the API only signals *whether* to warn.

### Demo

`FeatureProbe` gains a "Start long action" button. The handler sets `LongActionPolls = 3` and returns `PreventUnload = true` + `NextPollIn = 100`; each subsequent `long-action-poll` tick decrements until 0, then clears both. Parity coverage: `feature-probe.json` adds a 5-step long-action block (`fresh-long` + `long-start` + 3 polls). `dotnet-probe` / `bun-probe` / `node-probe` agree byte-for-byte; the conditional spread on the bun side mirrors C#'s `WhenWritingDefault` (drops `preventUnload` from the wire when `false`).

### Consumers

Nothing to do — additive. To opt in, set `PreventUnload = state.IsWorkPending` from every render handler that has long-running server-side work; clear it (omit or set `false`) when the work completes. See `MIGRATION.md` for the pattern + `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` for a worked example.

---

## 0.13.0 — `TableNode` local-mode selection + bulk-action toolbar (npm + NuGet)

**npm:** `0.13.0` (MINOR — `selection.action` relaxed to optional + new `selection.buttons[]` + adapter changes) · **NuGet:** `0.13.0` (MINOR — `TableSelection.Action` becomes nullable + new `TableSelection.Buttons`)

Both packages move together. Closes [#17](https://github.com/ashley-shrok/ViewModelShell/issues/17). Purely additive — every existing table that sets `selection.action` keeps the same behavior. The new shape is opt-in.

### Why

0.12.0's `selection.action` mode is server-truth: every checkbox click dispatches a round-trip toggle action, so the server can render "N selected" indicators, conditional toolbars, cross-page persistence, etc. It pays a real cost — when a user clicks checkboxes in quick succession, the dispatch guard (AGENTS.md non-obvious behavior #4) **silently drops** the second click while the first round-trip is in flight, *and* the in-flight response re-renders the table with server-truth `selectedIds` that wipes the second checkbox's DOM state. From the user's seat: "I clicked that box, why's it unchecked?" Reported in the field after the first 0.12.0 app shipped — and it's the framework's biggest UX limitation against rapid bulk-selection workflows.

### Added

- **`TableSelection.action` is now optional.** When omitted, the table enters **local mode**: the adapter toggles the DOM checkbox + the `.vms-table__row--selected` class purely client-side, no dispatch. No round-trip per click → the dispatch guard can't drop anything → no silently-wiped checkboxes. Selection still surfaces visually via the design-system class (no app CSS). `selectedIds` continues to drive *initial* / pre-selected rows; subsequent toggles live in the DOM. **Trade-off:** local-mode selection doesn't persist across server re-renders (paginating, filtering, polling rebuilds the table → DOM state resets). For server-truth selection that survives those transitions, keep using `action` mode.
- **`TableSelection.buttons?: ButtonNode[]`** — bulk-action toolbar rendered ABOVE the table by the adapter (new CSS hook `.vms-table__bulk-actions`). On click, each button harvests the currently-checked row ids from the DOM and merges them as `selectedIds` into the action's context, then dispatches. Designed primarily to pair with local mode (it's how the server learns the selection at action time without a per-toggle round-trip), but works in server-truth mode too — the DOM mirrors `selectedIds` after each render, so the harvest matches state.
- **CSS:** `.vms-table__bulk-actions` — flex row above the table with the standard spacing rhythm. Reuses `.vms-button` classes; no new color/size tokens.

### TUI

The TUI is **experimental** (per its 0.11.0 marking) and treats local mode as render-only: checkboxes show the server's `selectedIds`, clicks are inert, `buttons[]` toolbar renders and dispatches with whatever the server pre-selected. Interactive local-mode selection lives in the browser. The wire format and the cross-backend parity contract are unchanged.

### Migrated

`demo/HelpDesk/AspNetCore/AgentController.cs` (and its bun twin) switch from server-truth to local mode — drop `AgentState.SelectedIds`, drop the `toggle-select` action, move bulk buttons into `selection.buttons[]`. The helpdesk parity fixture replaces six toggle/page steps with four `bulk-*` steps that pass `selectedIds` in context. `dotnet-helpdesk` and `bun-helpdesk` agree byte-for-byte.

### Consumers

**If your app today uses `selection.action` with bulk-action buttons** — you should probably switch. The rapid-click bug is real; local mode kills it. See `MIGRATION.md` for the step-by-step.

**If your app uses cross-page selection** (sweep-selecting across paginated rows) — stay in server-truth mode; that's its home turf. We may layer in a dispatch-queueing fix for that case in a future release.

---

## 0.12.0 — `TableNode` selection + pagination (npm + NuGet)

**npm:** `0.12.0` (MINOR — two new optional `TableNode` fields + renderer/CSS) · **NuGet:** `0.12.0` (MINOR — `TableSelection` + `TablePagination` records, two new `TableNode` members)

Both packages move together (AGENTS.md: a `ViewNode` wire change bumps both sides). Closes [#16](https://github.com/ashley-shrok/ViewModelShell/issues/16). Purely additive — every existing `TableNode` renders byte-identically.

### Added

- **`TableNode.selection`** (`{ selectedIds: string[]; action }`) — first-class bulk row selection. The adapter renders a leading checkbox column + a header select-all checkbox, tints selected rows with `.vms-table__row--selected`, and dispatches the action with merged `{ id, checked }` per row or `{ all: true, checked }` for select-all (where "all" = the rows currently rendered, i.e. the current page). `selectedIds` is **server-truth** and round-trips in state, so selection survives sort/filter/pagination independent of which rows are in view. Crucially, **`TableRow.action` stays free** — selection is its own seam, so a row can still be click-to-open *and* selectable. Buttons that act on the selection live outside the table as ordinary `ButtonNode`s reading `selectedIds` from state. The "select all N matching" (not just the page) affordance is the app's own node composed above the table — the framework ships the primitive, not the policy.
- **`TableNode.pagination`** (`{ page; pageSize; totalRows; action }`) — server-driven pagination. The adapter renders an "X–Y of N" range + prev/next controls below the table (disabling the edges), and dispatches `{ page }`. **The server slices `rows` to the current page** — the adapter never paginates client-side (that would break for DB-backed tables, which are most of them). By convention `sortAction`/`filterAction` reset `page` to 1 server-side (documented at the type).
- **CSS:** `.vms-table__row--selected` (accent tint via `color-mix`, recolors with the active theme — no literals), `.vms-table__th--select`/`.vms-table__td--select` (checkbox column), `.vms-table__select` (`accent-color` from `--vms-accent`), and `.vms-table__pagination*` (range + reused `.vms-button` controls). No new app CSS surface.

### Cross-backend + tested

- TS (`index.ts` + `browser.ts` + `tui.tsx`) and C# (`TableSelection`/`TablePagination` records, both carrying the null-omission attribute on the `TableNode` members) — kept byte-aligned by the parity suite. The `feature-probe` fixture grew a 14-step **selection × pagination × sort × filter** matrix proven identical across `dotnet`/`bun`/`node` backends; the `helpdesk` fixture grew a 6-step agent **bulk-action over SQLite** block (select-all, page, bulk reopen/start) proven identical across `dotnet`/`bun`.
- 9 new BrowserAdapter unit tests (checkbox state, dispatch payloads, selected-row class, stopPropagation vs. row click, disabled-edge pagination) + a cross-adapter conformance fixture (browser + TUI both surface the controls).

### Demos

- **HelpDesk-Agent** ticket queue is now a real bulk-action workflow: selectable rows + SQL `LIMIT/OFFSET` pagination + "Mark In Progress / Mark Resolved / Reopen" buttons outside the table that act on the selection.
- **FeatureProbe** gained a table feature-matrix section exercising every `TableNode` knob at once.

### Consumers

Nothing to do — additive. Existing tables are unaffected; opt into a feature by setting `selection` and/or `pagination` on a `TableNode`. See `MIGRATION.md`.

---

## 0.11.0 — `ImageNode` + `TextNode` "warning" style + WCAG-AA hardening; TUI experimental (npm + NuGet)

**npm:** `0.11.0` (MINOR — new `ImageNode`, `TextNode` style widened) · **NuGet:** `0.11.0` (MINOR — new `ImageNode` record + discriminator)

Both packages move together (AGENTS.md: a `ViewNode` type change bumps both sides). Closes [#5](https://github.com/ashley-shrok/ViewModelShell/issues/5) and [#8](https://github.com/ashley-shrok/ViewModelShell/issues/8). Purely additive.

### Added

- **`ImageNode`** (`{ type: "image"; src; alt?; size?; shape? }`) — renders pictures/media: product catalogs, avatars, logos, thumbnails. Browser emits `<img class="vms-image" src alt>` with design-system sizing/shape modifier classes (`size: "small" | "medium" | "large" | "full"` → widths from `--vms-image-*` tokens; `shape: "circle"` → square-cropped circular avatar via `border-radius:50% + aspect-ratio:1 + object-fit:cover`). No free-form CSS — sizing is the closed enum. Multi-target safe: the TUI degrades to `[image: <alt>]`, so the wire's accessibility intent carries to non-browser adapters. Cross-backend (TS `index.ts`/`server.ts` + C# `ImageNode` record with the `"image"` discriminator), parity-checked, jsdom + conformance tested.
- **`TextNode.style: "warning"`** — an inline warning text affordance, symmetric with the existing `"error"`. A one-line advisory ("Conversation truncated at 500 rows.") is now one `TextNode`, not a `ListNode` + `ListItemNode{variant:"warning"}` wrapper. Emits `.vms-text--warning` (browser) / amber foreground (TUI). The C# side needs no change — `TextNode.Style` has always been a free `string?`, so `new TextNode("…", "warning")` already compiled; 0.11.0 just makes the renderer style it.

### Changed (accessibility — the non-obvious part)

- **`--vms-warning` darkened `#a37510` → `#8a630d`** in the shipped default, and **`#c89610` → `#8a630d`** across all six `light-*` themes. Reason: `warning` was only ever a **non-text border accent** (list-item left-border, table-row tint), tuned to the WCAG 3.0:1 *non-text* bar. Promoting it to a **text** color means it must clear the **4.5:1** bar (SC 1.4.3); the old values were ~4.1:1 (default) / ~2.7:1 (light themes) as text — sub-AA. The new value clears 4.5:1 on both surface and bg. Dark themes were already compliant (light amber on dark ≈ 8:1) and are untouched, including the byte-frozen `dark-purple.css`. This is a cosmetic deepening of existing warning borders/tints — no API or wire change.
- **`check:aa-contrast` extended** from default-only to **default + all 12 themes** (each merged over the default `:root`, the real consumer cascade), and `error` + `warning` are now checked at the **text** threshold (4.5:1, on surface *and* bg) rather than the non-text 3.0:1 — closing a latent gap where `error` (a text style since 0.4.1) was only ever guarded at the non-text bar. The six `light-*` theme SHAs in `check:theme-byte-identity` were deliberately re-baselined (recorded in the guard, per the D-26 precedent).

### Consumers

Nothing to do — additive. Code that previously passed `Style: "warning"` and silently rendered unstyled now renders as styled warning text. No migration step.

### Also: terminal adapter (TUI) marked **experimental** (npm only)

The terminal target (`@ashley-shrok/viewmodel-shell/tui` + the `vms-tui` CLI) is now explicitly flagged experimental — it's incomplete (scrolling, keyboard/focus ergonomics, and layout coverage need more work) and not under active development for now. Non-breaking, layered signal:

- **`@experimental` TSDoc** on `TuiAdapter` + `renderTree` (surfaces in editors / API tooling).
- **One-time runtime notice** to stderr the first time a `TuiAdapter` is constructed (covers both the CLI and programmatic use). Silence with `VMS_TUI_SILENCE_EXPERIMENTAL=1`.
- **Docs callouts** in the README "Terminal (TUI)" section and AGENTS.md.

No rename, no API removal — existing `import { TuiAdapter }` and `bunx vms-tui` keep working unchanged. **The browser, server, and core packages are stable and unaffected.** NuGet has no TUI surface, so this is npm-only.

---

## 0.10.0 — Multi-action forms: `FormNode.buttons[]` (npm + NuGet)

**npm:** `0.10.0` (MINOR — wire-format addition) · **NuGet:** `0.10.0` (MINOR — wire-format addition)

Both packages move together. Closes [#15](https://github.com/ashley-shrok/ViewModelShell/issues/15). Additive field + a back-compat relaxation of `submitAction`.

### Added

- **`FormNode.buttons?: ButtonNode[]`** — multiple submit buttons on one form, each harvesting the form's *current* field values into its own action's context and dispatching. Mirrors HTML's multiple submit buttons / `formaction`. Closes the "one form, shared fields, multiple actions" gap (fetch-then-save, save-vs-save-and-close, apply-vs-preview) that previously forced a two-form workaround which silently dropped input. Each entry is a **full `ButtonNode`**, so `variant` and `pendingLabel` apply — the slow "Fetch & fill" button gets instant pending feedback for free:

  C#:
  ```csharp
  new FormNode(SubmitAction: null, SubmitLabel: null,
      Children: [ new FieldNode("url", "text", "URL", null, null) ],
      Buttons: [
          new ButtonNode("Fetch & fill", new ActionDescriptor("fetch-meta"), null, PendingLabel: "Fetching…"),
          new ButtonNode("Save",         new ActionDescriptor("add-item"),   "primary"),
      ])
  ```

  TypeScript backend:
  ```typescript
  { type: "form",
    children: [{ type: "field", name: "url", inputType: "text", label: "URL" }],
    buttons: [
      { type: "button", label: "Fetch & fill", action: { name: "fetch-meta" }, pendingLabel: "Fetching…" },
      { type: "button", label: "Save", action: { name: "add-item" }, variant: "primary" },
    ] }
  ```

  A plain `ButtonNode` placed in `children` keeps its no-harvest behavior — only buttons in the `buttons[]` slot harvest. Browser renders them in a `.vms-form__buttons` row; TUI renders them as activatable buttons (mouse + Enter) sharing the form's harvest closure.

### Changed

- **`FormNode.submitAction` relaxed from required to optional.** A `buttons[]`-only form omits it and renders no default submit button (and Enter doesn't submit at the form level — a `FieldNode.action` still fires per-field). Existing forms with `submitAction` are byte-identical. (C#: `SubmitAction` kept positional-but-nullable so existing positional call sites compile unchanged; serialized with `WhenWritingNull`.)

### Consumers

- **None required — additive.** Existing single-submit forms unchanged. Cross-backend parity unchanged. Demo: `demo/FeatureProbe` (and Bun twin) now has a one-form / two-button (`Save Draft` + `Publish`) example sharing a `note` field.

---

## 0.9.0 — `CopyButtonNode.variant`: visual differentiation from default buttons (npm + NuGet)

**npm:** `0.9.0` (MINOR — wire-format addition) · **NuGet:** `0.9.0` (MINOR — wire-format addition)

Both packages move together. Closes [#14](https://github.com/ashley-shrok/ViewModelShell/issues/14). One additive `CopyButtonNode` field; no breaking change.

### Added

- **`CopyButtonNode.variant?: "primary" | "secondary" | "danger"`.** Mirrors `ButtonNode.variant` exactly. Previously, copy-buttons rendered with class `vms-button` (no modifier), visually indistinguishable from default `ButtonNode`s in the same layout — so a copy-button sitting alongside a column of bare action buttons just looked like another row, even though it does something semantically different (clipboard write vs. server action). With `variant`, the same `.vms-button--primary` / `--secondary` / `--danger` CSS rules that already exist for `ButtonNode` now apply to `CopyButtonNode` too.

  C#:
  ```csharp
  new CopyButtonNode("npx @ashley-shrok/viewmodel-shell",
      "Copy install command",
      "Copied!",
      Variant: "secondary")
  ```

  TypeScript backend:
  ```typescript
  { type: "copy-button", text: "npx …", label: "Copy install command",
    copiedLabel: "Copied!", variant: "secondary" }
  ```

  **No new CSS rules ship** — the existing `.vms-button--{variant}` selectors already match `.vms-button.vms-button--{variant}` regardless of whether the underlying `<button>` came from a `ButtonNode` or a `CopyButtonNode`. The TUI adapter applies the same `fg` color rules its `ButtonView` uses (`#ff5555` for danger, `#88aaff` for primary, undefined for secondary/omitted). Omitted variant = byte-identical to pre-0.9.0 behavior.

### Consumers

- **None required — additive.** Existing `CopyButtonNode` consumers untouched. Cross-backend parity unchanged.
- **Demo worked example:** `demo/FeatureProbe` (and Bun twin) now sets `variant: "secondary"` on its "Copy install command" copy-button.

---

## 0.8.0 — `ButtonNode.pendingLabel`: instant click feedback for slow actions (npm + NuGet)

**npm:** `0.8.0` (MINOR — wire-format addition) · **NuGet:** `0.8.0` (MINOR — wire-format addition)

Both packages move together. Closes [#11](https://github.com/ashley-shrok/ViewModelShell/issues/11). One additive `ButtonNode` field; no breaking change.

### Added

- **`ButtonNode.pendingLabel?: string`.** Transient label shown from click until the dispatch resolves. Adapter additionally adds `.vms-button--pending` (browser) or visually dims the button (TUI) while pending so the affordance visibly disables — preventing re-clicks both via the shell's existing dispatch-guard AND via the new visual signal. Mirrors `CopyButtonNode.copiedLabel`'s lifecycle pattern at a different beat (DURING the round-trip, rather than AFTER it):

  C#:
  ```csharp
  new ButtonNode("Load Plugin",
      new ActionDescriptor("load-plugin"),
      "primary",
      PendingLabel: "Loading…")
  ```

  TypeScript backend:
  ```typescript
  { type: "button", label: "Load Plugin", action: { name: "load-plugin" },
    variant: "primary", pendingLabel: "Loading…" }
  ```

  Omitted = no pending feedback (existing instant-click behavior, byte-identical). Pure-client ephemeral state — never round-trips through the wire. The shell's dispatch-error path (see *Changed* below) reverts pending UI without per-button cleanup wiring.

### Changed

- **Shell re-renders `currentVm` on dispatch error.** Previously, a failed dispatch (non-OK response, fetch throw) surfaced `onError` but did NOT trigger a re-render — any client-side ephemeral UI applied in the click handler (e.g. the new `pendingLabel` swap, but applicable to any future similar pattern) would be left visually stuck. Now the shell calls `adapter.render(currentVm, …)` from `dispatch()`'s catch block when `currentVm` is non-null. This snaps client-side state back to the authoritative server tree automatically. Existing apps that previously depended on "no re-render after error" should be unaffected (the re-render uses the *same* VM that was last rendered; idempotent for any adapter that doesn't mutate the DOM in ways the snapshot/restore doesn't already cover).

### Consumers

- **None required — additive.** Existing `ButtonNode` consumers untouched (new `pendingLabel`/`PendingLabel` field is optional, null-omitted on the wire). Existing dispatch-error behavior is now "re-render currentVm + fire onError" rather than just "fire onError"; this is strictly more correct for adapters that mutate the DOM on click. Cross-backend parity unchanged.
- **Demo worked example:** `demo/HelpDesk` (and its Bun twin) now sets `pendingLabel` on the ticket-status-change buttons (`"Marking…"`, `"Resolving…"`, `"Reopening…"`) — exercise it in the agent view of a HelpDesk ticket.

---

## 0.7.1 — Browser scroll preservation across re-render (npm only)

**npm:** `0.7.1` (PATCH — client-only bug fix) · **NuGet:** unchanged at `0.7.0`

Closes [#7](https://github.com/ashley-shrok/ViewModelShell/issues/7). No wire, type, or API change; NuGet untouched; major.minor stays `0.7`.

### Fixed

- **`BrowserAdapter.render()` now preserves the window scroll position across action-driven re-renders.** Previously, the snapshot/restore block preserved element-level `scrollTop`/`scrollLeft` for nodes with an `id` and restored focus + caret, but it did NOT snapshot `window.scrollX`/`window.scrollY`. Combined with `el.focus()` being called without `{ preventScroll: true }`, the re-render would yank the viewport to the focused element (or to the top), making long-page apps jump on every action. Fix: snapshot `window.scrollX`/`Y` alongside the existing snapshot, pass `preventScroll: true` to the focus restore call, and `window.scrollTo(x, y)` after all DOM restoration so the position is the last thing written. **Behavior change is "scroll stays where the user left it"**, which is what every other framework does in the same situation — apps that previously relied on the implicit scroll-to-top can still navigate explicitly via `ShellResponse.redirect`.

### Consumers

- **None required.** Client-only fix; no wire/type/API change. Static/non-interactive rendering unaffected. Server consumers (.NET / TS server subpath) untouched — NuGet stays at `0.7.0`. Apps that depended on the scroll-to-top behavior of action-driven re-renders should switch to explicit `ShellResponse.redirect` for that intent (the existing wire affordance for app-driven navigation).

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
