# @ashley-shrok/viewmodel-shell

A server-driven UI framework where the wire format is structured enough that agents can build full-stack apps without ever opening a browser and all UI tests are pure unit tests with no browser runtime.

The server returns a JSON tree of typed nodes; a thin TypeScript adapter renders it to the DOM (or, with the same wire, a terminal). The browser never owns application state — every interaction dispatches a semantic action to a single POST endpoint and the server returns the next state plus a fresh view.

The frontend is backend-agnostic: it speaks a small JSON contract over a single POST endpoint that takes `multipart/form-data` (with `_action` and `_state` fields). A .NET reference backend ships in the repo, but any language can produce the same contract.

## Install

```bash
npm install @ashley-shrok/viewmodel-shell
```

## Use

```ts
import "@ashley-shrok/viewmodel-shell/styles.css";
import { ViewModelShell } from "@ashley-shrok/viewmodel-shell";
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";

const container = document.getElementById("app")!;
const shell = new ViewModelShell({
  endpoint:       "/api/tasks",
  actionEndpoint: "/api/tasks/action",
  adapter:        new BrowserAdapter(container),
});

shell.load();
```

If your backend is .NET: copy `demo/Tasks/AspNetCore/ViewModels.cs` from the [GitHub repo](https://github.com/ashley-shrok/ViewModelShell) into your project and update the namespace — that file is the full backend record set (`ViewNode`, `PageNode`, `FormNode`, `ShellResponse<TState>`, `ActionPayload<TState>`, etc.).

For other backends, implement the same JSON shape: a `GET` returning `{ vm, state }`, and a `POST` that takes `multipart/form-data` with `_action` and `_state` form fields and returns the next `{ vm, state }`. See [AGENTS.md](https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md) for the full wire format.

## Authenticated downloads

When a header-authenticated consumer (e.g. `Authorization: Bearer <jwt>` via `ShellOptions.getRequestHeaders()`) needs to offer a file download, return a `"download"` side-effect from your action handler — the shell fetches the URL with the same headers merged in, parses `Content-Disposition` + `Content-Type`, and triggers a browser "Save As":

```csharp
return new ShellResponse<MyState>(BuildVm(state), state)
    .WithEffect(ShellSideEffect.Download("/api/invoices/42/pdf", "invoice-42.pdf"));
```

```typescript
return { vm: buildVm(state), state,
  sideEffects: [shellSideEffect.download("/api/invoices/42/pdf", "invoice-42.pdf")] };
```

The download endpoint stays auth-gated and the server authorizes in the action handler — no signed-URL machinery. See [AGENTS.md](https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md#client-side-effects) for the wire format and pattern.

## Terminal (TUI)

> ⚠️ **Experimental.** The terminal adapter (`@ashley-shrok/viewmodel-shell/tui` + `vms-tui`) is incomplete and under active design — scrolling, keyboard/focus ergonomics, and layout coverage all need more work. Its API and behavior may change or be removed **without a major-version bump**; don't build production workflows on it yet. The browser/server/core packages are stable and unaffected. Constructing a `TuiAdapter` prints a one-time notice — silence it with `VMS_TUI_SILENCE_EXPERIMENTAL=1`.

The same backend renders in a terminal — same wire, no backend change, with a real lazygit-style UX: mouse clicks, wheel scroll, per-pane focus cycle, and a context-aware status bar. Point the CLI at any ViewModel Shell endpoint:

```bash
bunx vms-tui https://your-app.example/api/tasks
```

The action endpoint is derived by convention (`<endpoint>/action`). The TUI requires the [Bun](https://bun.sh) runtime — install once via `curl -fsSL https://bun.sh/install | bash` (or any installer on bun.sh). Browser and server consumers are unaffected; only `/tui` + `vms-tui` need Bun.

Wire it programmatically, exactly like `BrowserAdapter`:

```ts
import { ViewModelShell } from "@ashley-shrok/viewmodel-shell";
import { TuiAdapter } from "@ashley-shrok/viewmodel-shell/tui";

const shell = new ViewModelShell({
  endpoint:       "/api/tasks",
  actionEndpoint: "/api/tasks/action",
  adapter:        new TuiAdapter(),
});

shell.load();
```

**Interaction model.** Every `section`, top-level `list`, and top-level `table` is its own scrollable focus pane with a border. Tab/Shift-Tab cycles focus across panes; ↑↓ PgUp/PgDn scroll inside the focused pane; click any button, checkbox, link, copy-button, table header, or table row to act on it. Enter activates the focused pane's primary actionable (first button → dispatch, first link → navigate, first copy-button → OSC-52 copy). Space toggles the focused pane's first checkbox-with-action. When the pane has a text field, Enter submits the enclosing form (Field's `<input onSubmit>`) and Space is a normal character.

On an interactive terminal the app **fills the screen** via the alternate-screen buffer — a vim/htop-style takeover that re-flows on resize and restores your prior terminal verbatim on exit (every exit path: quit, Ctrl-C, SIGTERM, crash). Opt out with `new TuiAdapter({ viewport: "content" })` for intrinsic content size and no screen takeover. Non-interactive runs (pipe / CI / agent / `</dev/null`) are unaffected.

The TUI is built on [OpenTUI](https://github.com/anomalyco/opentui), declared as **optional** dependencies (`@opentui/core`, `@opentui/react`, `react@19`) so web and server consumers are unaffected — they are never imported by the browser, server, or core entrypoints. `bunx vms-tui` installs them automatically. **Project consumers using `TuiAdapter` programmatically must add all three explicitly** — optional dependencies are *not* pulled transitively:

```bash
bun add @ashley-shrok/viewmodel-shell @opentui/core @opentui/react react
```

See [AGENTS.md](https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md) for what the terminal renders.

## Themes

The base stylesheet ships a **light** default (purple accent). To use a different look — including the prior dark-purple default — import a theme file on top:

```ts
import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/dark-blue.css";
```

The prior (pre-0.4.0) dark default is preserved byte-exact as `themes/dark-purple.css`. The current, authoritative theme set is the files under [`styles/themes/`](https://github.com/ashley-shrok/ViewModelShell/tree/main/viewmodel-shell/styles/themes) — not listed here, so this README can't go stale as themes are added or renamed.

## Docs

Full framework docs, architecture details, demo apps, and the C# backend pattern are in the [GitHub repository's AGENTS.md](https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md).
