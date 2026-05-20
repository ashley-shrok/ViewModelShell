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

The same backend renders in a terminal — same wire, no backend change. Point the CLI at any ViewModel Shell endpoint:

```bash
npx vms-tui https://your-app.example/api/tasks
```

The action endpoint is derived by convention (`<endpoint>/action`). Or wire it programmatically, exactly like `BrowserAdapter`:

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

On an interactive terminal the app **fills the screen** via the alternate-screen buffer — a vim/htop-style takeover that re-flows on resize and restores your prior terminal verbatim on exit (every exit path: quit, Ctrl-C, SIGTERM, crash). Opt out with `new TuiAdapter({ viewport: "content" })` for intrinsic content size and no screen takeover. Non-interactive runs (pipe / CI / agent / `</dev/null`) are unaffected — one static frame, no alternate screen.

The TUI is built on [Ink](https://github.com/vadimdemedes/ink) and friends, declared as **optional** dependencies (`ink`, `react`, `ink-text-input`, `ink-select-input`) so web and server consumers are unaffected — they are never imported by the browser, server, or core entrypoints. `npx vms-tui` installs them automatically. **Project consumers using `TuiAdapter` programmatically must add all four explicitly** — optional dependencies are *not* pulled transitively when another project depends on this package (notably with `bun install`):

```bash
npm i @ashley-shrok/viewmodel-shell ink react ink-text-input ink-select-input
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
