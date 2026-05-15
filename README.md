## viewmodel-shell

A server-driven UI framework where the wire format is structured enough that agents can build full-stack apps without ever opening a browser and all UI tests are pure unit tests with no browser runtime.

The server returns a JSON tree of typed nodes; a thin TypeScript adapter renders it to DOM. The browser never owns application state — every interaction dispatches a semantic action to a single POST endpoint and the server returns the next state plus a fresh view.

The frontend is backend-agnostic: it speaks a small JSON contract over a single POST endpoint that takes `multipart/form-data` (with `_action` and `_state` fields). A .NET reference backend ships in the repo, but any language can produce the same contract.

### Capability seam (platform-agnostic core)

The core (`src/index.ts`) references **zero platform globals** — no `window`, `document`, `localStorage`, `sessionStorage`, or `XMLHttpRequest`. This is **CI-enforced**: a guard fails the build if any of those leak into core, so the invariant can't quietly rot. The core is a pure wire-protocol transformer; all browser bindings live in `BrowserAdapter`.

Platform side-effects are delegated to the `Adapter` interface through three optional verbs, exactly the way rendering already is:

- `navigate?(url)` — redirect navigation (browser: sets the page location)
- `storage?(scope, key, value)` — `localStorage`/`sessionStorage` writes (write-only)
- `transport?(...)` — optional request-transport override (the core's `fetch` is the default)

Implementing this one interface is all a new front-end target (mobile, terminal, a different framework) needs to become a complete target.

**This is non-breaking for existing consumers.** The wire format, all node types, side-effect behavior, and `ShellOptions.onRedirect` (still `(url: string) => void`) are unchanged. `BrowserAdapter` — which every consumer uses — implements all three verbs, so default behavior is byte-identical to before; the only change is *where* the browser bindings execute (adapter, not core). If you set `onRedirect`, it still takes precedence over the adapter's navigation, exactly as documented in [AGENTS.md](https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md).

Upgrading? [CHANGELOG.md](./CHANGELOG.md) is the running per-version log of what changed and what (if anything) consumers must do. [MIGRATION.md](./MIGRATION.md) is the deep-dive for the 0.3.13 capability-seam change specifically. Per-release notes are also published on [GitHub Releases](https://github.com/ashley-shrok/ViewModelShell/releases).

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

## Themes

The base stylesheet ships a dark-purple theme. To override, import a theme file on top:

```ts
import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/dark-blue.css";
```

Available themes: `dark-blue`, `dark-green`, `dark-rose`, `dark-amber`, `dark-teal`, `light-purple`, `light-blue`, `light-green`, `light-rose`, `light-amber`, `light-teal`.

## Docs

Full framework docs, architecture details, demo apps, and the C# backend pattern are in the [AGENTS.md](https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md).
