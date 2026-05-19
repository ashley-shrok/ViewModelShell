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

The TUI is built on [Ink](https://github.com/vadimdemedes/ink), declared as an **optional** dependency: CLI/`npx` use installs it automatically, while web and server consumers are unaffected — it is never imported by the browser, server, or core entrypoints. See [AGENTS.md](https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md) for what the terminal renders.

## Themes

The base stylesheet ships a **light** default (purple accent). To use a different look — including the prior dark-purple default — import a theme file on top:

```ts
import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/dark-blue.css";
```

The prior (pre-0.4.0) dark default is preserved byte-exact as `themes/dark-purple.css`. The current, authoritative theme set is the files under [`styles/themes/`](https://github.com/ashley-shrok/ViewModelShell/tree/main/viewmodel-shell/styles/themes) — not listed here, so this README can't go stale as themes are added or renamed.

## Docs

Full framework docs, architecture details, demo apps, and the C# backend pattern are in the [GitHub repository's AGENTS.md](https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md).
