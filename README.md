## viewmodel-shell

A server-driven UI framework where the wire format is structured enough that agents can build full-stack apps without ever opening a browser and all UI tests are pure unit tests with no browser runtime.

The server returns a JSON tree of typed nodes; a thin TypeScript adapter renders it to DOM. The browser never owns application state — every interaction dispatches a semantic action to a single POST endpoint and the server returns the next state plus a fresh view.

The frontend is backend-agnostic: it speaks a small JSON contract over a single POST endpoint that takes `multipart/form-data` (with `_action` and `_state` fields). A .NET reference backend ships in the repo, but any language can produce the same contract.

### Capability seam (platform-agnostic core)

The core (`src/index.ts`) references **zero platform globals** — no `window`, `document`, `localStorage`, `sessionStorage`, or `XMLHttpRequest`. This is **CI-enforced**: a guard fails the build if any of those leak into core, so the invariant can't quietly rot. The core is a pure wire-protocol transformer; all browser bindings live in `BrowserAdapter`.

Platform side-effects are delegated to the `Adapter` interface through optional verbs, exactly the way rendering already is:

- `navigate?(url)` — redirect navigation (browser: sets the page location)
- `storage?(scope, key, value)` — `localStorage`/`sessionStorage` writes (write-only)
- `saveFile?(blob, filename, contentType)` — authenticated-download handoff (browser: triggers Save-As)
- `transport?(...)` — optional request-transport override (the core's `fetch` is the default)
- `setPreventUnload?(active)` / `setBusy?(active)` — UX guards for long-running server actions (warn-before-leave; lock the UI)

Implementing this one interface is all a new front-end target (mobile, terminal, a different framework) needs to become a complete target — and the repo already ships a terminal one: `@ashley-shrok/viewmodel-shell/tui`, with the `vms-tui` CLI driving any backend from a terminal (experimental; see the [package README](./viewmodel-shell/README.md)).

**This is non-breaking for existing consumers.** The wire format, all node types, side-effect behavior, and `ShellOptions.onRedirect` (still `(url: string) => void`) are unchanged. `BrowserAdapter` — which every consumer uses — implements every verb, so default behavior is byte-identical to before; the only change is *where* the browser bindings execute (adapter, not core). If you set `onRedirect`, it still takes precedence over the adapter's navigation, exactly as documented in [AGENTS.md](https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md).

Upgrading? [CHANGELOG.md](./CHANGELOG.md) is the running per-version log of what changed and what (if anything) consumers must do. [MIGRATION.md](./MIGRATION.md) is the per-version migration guide, with deep-dives for the changes that need consumer action.

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

If your backend is .NET: install the `AshleyShrok.ViewModelShell` NuGet package — it ships the full backend record set (`ViewNode`, `PageNode`, `FormNode`, `ShellResponse<TState>`, `ActionPayload<TState>`, `UnknownActionException`, `ShellExceptionFilter`, etc.). Register `ShellExceptionFilter` in `Program.cs`: `builder.Services.AddControllers(o => o.Filters.Add<ShellExceptionFilter>())`.

For other backends, implement the same JSON shape: a `GET` returning `{ ok: true, vm, state }`, and a `POST` that takes `multipart/form-data` with `_action` (JSON `{"name":"..."}`) and `_state` form fields and returns the next `{ ok: true, vm, state }`. See [AGENTS.md](https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md) for the full wire format.

## Agents

Two complementary signals let an agent drive your app from the HTML alone — no DOM scraping, no guessing the protocol.

**1. The discoverability tag — *"this is a VMS app, and here are its endpoints."*** Add one line to your page's `<head>`; it's visible to JS-less crawlers (`curl`, `WebFetch`):

```html
<!-- Agent discoverability — this is a ViewModel Shell app: agents can drive it via the JSON wire
     (GET endpoint → {vm, state}; POST actionEndpoint multipart {_action, _state}). Docs: https://github.com/ashley-shrok/ViewModelShell -->
<meta name="viewmodel-shell" content='{"protocol":"viewmodel-shell/1.0","endpoint":"/api/tasks","actionEndpoint":"/api/tasks/action","skill":"/.well-known/vms-skill.md"}'>
```

**2. The agent skill — *"here's how to drive the wire."*** The optional `skill` field points at a served markdown operating manual for the VMS wire protocol (action dispatch shape, state round-trip, response envelope vocabulary, side-effect verbs, polling, errors, file uploads). An agent that has never seen VMS can `GET` that URL and learn the whole protocol cold. Both backends ship a one-liner that serves the canonical manual at any URL you pick (recommended: `/.well-known/vms-skill.md`), with an optional app-specific preamble prepended under a `## App-specific notes` heading:

```csharp
// .NET — Program.cs
app.MapVmsAgentSkill(appPreamble: "This is the Tasks app. Auth: Bearer JWT in Authorization.");
```

```ts
// TypeScript (Bun / Deno / Hono / Workers / Node) — mount the (Request) => Response handler on your router
import { createAgentSkillHandler } from "@ashley-shrok/viewmodel-shell/server";
const skillHandler = createAgentSkillHandler({ appPreamble: "This is the Tasks app. Auth: Bearer JWT in Authorization." });
// e.g.  if (url.pathname === "/.well-known/vms-skill.md") return skillHandler(req);
```

Both fields are backward-compatible: agents that don't know the `skill` field ignore it, and apps without it keep working. All shipped demos include the meta tag, and the HelpDesk demo also mounts the skill endpoint — the recommended convention for any VMS-driven page that mounts a shell. The canonical skill source (`viewmodel-shell/agent-skill.md`) and the parity gate that keeps the two backends byte-identical are documented in [AGENTS.md](https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md).

## Themes

The base stylesheet ships a **light** default (purple accent). To use a different look — including the prior dark-purple default — import a theme file on top:

```ts
import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/dark-blue.css";
```

The prior (pre-0.4.0) dark default is preserved byte-exact as `themes/dark-purple.css` — one import away (`import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css";`).

The current, authoritative theme set is the files under [`viewmodel-shell/styles/themes/`](https://github.com/ashley-shrok/ViewModelShell/tree/main/viewmodel-shell/styles/themes) — not listed here, so this README can't go stale as themes are added or renamed.

## Docs

Full framework docs, architecture details, demo apps, and the C# backend pattern are in the [AGENTS.md](https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md).
