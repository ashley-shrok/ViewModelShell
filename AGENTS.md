# ViewModel Shell

A server-driven UI framework where the wire format is structured enough that agents can build full-stack apps without ever opening a browser and all UI tests are pure unit tests with no browser runtime. The server is a stateless transformer: it takes the client's current UI state plus an action and returns the next state plus a fresh view tree. The client (a thin TypeScript adapter) renders that tree to DOM with no app-specific code, holds the state opaquely, and round-trips it on every dispatch. Persistent/shared data (databases, files) lives server-side; transient UI state lives client-side.

The framework ships as two version-aligned packages:

| Package | Source | Use |
|---|---|---|
| [`@ashley-shrok/viewmodel-shell`](https://www.npmjs.com/package/@ashley-shrok/viewmodel-shell) (npm) | `viewmodel-shell/src/{index,browser}.ts` + `styles/` | Frontend renderer + themes |
| [`@ashley-shrok/viewmodel-shell/server`](https://www.npmjs.com/package/@ashley-shrok/viewmodel-shell) (npm subpath) | `viewmodel-shell/src/server.ts` | Backend types + helpers for TypeScript/Node/Bun/Deno/Workers backends |
| [`AshleyShrok.ViewModelShell`](https://www.nuget.org/packages/AshleyShrok.ViewModelShell) (NuGet) | `viewmodel-shell-dotnet/ViewModels.cs` | Backend `ViewNode` types under the `ViewModelShell` namespace |

The two packages share major.minor — bumping a `ViewNode` type or wire-format change bumps both sides. Source for both lives in this repo; demos here consume them via local `ProjectReference`/Vite alias to keep the dev loop tight.

The framework is actively developed. **If your app needs a node type, input type, text style, or interaction that doesn't exist — ask rather than working around it.** Workarounds accumulate technical debt and usually indicate a gap worth closing properly.

---

## Critical gotchas (read first)

These are the bugs that take hours to find:

1. **Always `return BuildVm(state)` (or a `ShellResponse<TState>` wrapping it) directly — never `return Ok(...)`.** `Ok()` leaves `DeclaredType = null` on the `ActionResult<T>`; the serializer falls back to the runtime type, skips `[JsonPolymorphic]`, omits `"type"` from the root node, and the page renders blank with no error.

2. **Never name a local variable `checked`** — it's a reserved C# keyword. Use `isChecked`.

3. **Use regex aliases, not string keys, in `vite.config.ts`.** A string key `"viewmodel-shell"` prefix-matches `"viewmodel-shell/browser"` and breaks the subpath import. Always use `/^viewmodel-shell$/` and `/^viewmodel-shell\/browser$/`.

4. **Inline validation goes in the state record, not `BadRequest`.** Add a `ValidationError` field to your state record, set it on failure, clear on success, and include `new TextNode(state.ValidationError, "error")` in the view when non-null. The validation message round-trips with the state — those responses are `ok: true` (state-based validation is NOT a framework failure). See `demo/HelpDesk/AspNetCore/RequesterController.cs`. `BadRequest`/`BadRequestError` IS correct for structurally-invalid requests the user can't see (missing required action field, action name missing from the form entirely) — the framework wraps those into `{ok: false, errors: [{message: ...}]}` (no `code`) at the framework edge. Never use it for routine app-level validation.

5. **`UnknownActionError` / `UnknownActionException` is the `default:` arm.** Don't `return BadRequest(...)` or `throw new BadRequestError(...)` from your `default:` switch arm — throw `new UnknownActionException(payload.Name)` (.NET) or `throw new UnknownActionError(name)` (TS). The framework catches it and emits `{ok: false, errors: [{message: "Unknown action: ...", code: "unknown_action"}]}` at 400. `BadRequest` / `BadRequestError` is reserved for the structurally-invalid path (gotcha #4 above).

6. **Check `body.ok` ONCE at the response edge — don't branch on HTTP status.** The framework sets `ok` on every response (normal render, redirect, poll, sideEffects, busy, preventUnload — all `ok: true`; every framework-detected failure — `ok: false`). The shell surfaces `ok: false` responses as `VmsActionError` via the existing `onError` callback. Apps check `if (err instanceof VmsActionError)` in `onError` — not HTTP status codes, which are framework-internal routing signals.

7. **Tests need `global using Xunit;` in `GlobalUsings.cs`** (not auto-imported even with `ImplicitUsings`) and `<FrameworkReference Include="Microsoft.AspNetCore.App" />` to access `DefaultHttpContext`.

8. **Null omission is now intrinsic — you no longer need to configure anything.** The wire contract ("an unset optional is *absent*, never `"field": null`") is baked into the published NuGet types: every nullable (`T?`) member carries `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`, which System.Text.Json honors **regardless of host `JsonSerializerOptions`** — so even default ASP.NET web JSON options emit the correct wire. The `DefaultIgnoreCondition = WhenWritingNull` line in every demo's `Program.cs` is now **redundant defense-in-depth, not load-bearing** (kept as the canonical pattern; safe to omit). This used to be a critical footgun (skip the config → `"field": null` everywhere → drift from TypeScript backends + strict-`tsc` consumer failures); it is no longer. Non-nullable members (incl. booleans like `CheckboxNode.Checked`) deliberately keep serializing `false`/`true` — they have semantic value. *Maintainer rule: a new nullable wire field MUST carry the attribute (see the header comment in `ViewModels.cs`) or it silently re-introduces null-vs-absent drift.*

9. **Cross-backend parity testing lives in `parity/`.** Any new official backend must implement the fixtures listed in `parity/backends.json` and pass `bun run parity/run.ts`. The harness spins up every backend in parallel, runs the same action sequences against each, and diffs normalized responses step-for-step. Any wire-format drift fails the run.

---

## Architecture

The server is a pure function `(state, action) → (newState, view)`. Every request carries the entire UI state; the server never holds per-client state in memory. This means:

- **No per-tab registries**, no `ConcurrentDictionary<string, TState>`, no tab-id query parameter
- **Server can be stateless and horizontally scaled** — restarts don't lose anything (UI state lives client-side until page refresh)
- **Two browser tabs of the same app are naturally independent** — each holds its own state blob
- **Persistent data still lives server-side** — anything multi-user, authorized, or stored (database rows, files) stays in singletons. Only transient UI state (current view, filter, selected ID, validation error) round-trips with each request.

### Wire format

**GET (page load)** — server returns initial state alongside the initial view:
```json
{ "vm": <ViewNode tree>, "state": <app-defined state record> }
```

**POST (action dispatch)** — `multipart/form-data` with three kinds of entries:
| Field | Purpose |
|---|---|
| `_action` | JSON: `{ "name": "..." }` — action name only; no `context` field |
| `_state` | JSON: the current state record (carries all input values via `bind` paths) |
| any file-input `name` | the `File` object (when forms have file fields) |

Response is the same `{ "ok": true, "vm", "state" }` shape as GET (plus `ok: true`). On framework-detected failures: `{ "ok": false, "errors": [{"message": "...", "code": "..."}] }`. The shell stores `state` internally and sends it with the next dispatch automatically — apps don't manage state plumbing.

### The capability seam

**The core never references `HTMLElement`, `document`, or any platform type.** It is a pure wire-protocol transformer: it speaks the JSON contract and delegates every platform side-effect to the `Adapter` — exactly the way `render()` is already delegated. This is no longer an aspiration: it is a **CI-enforced, checkable invariant** (see *Enforcement* below).

**The verbs.** Platform side-effects are optional methods on the existing `Adapter` interface (`viewmodel-shell/src/index.ts`). `render` is the only required method; the three capability verbs are optional — a target opts into the capabilities it can serve:

```typescript
export interface Adapter {
  render(vm: ViewNode, onAction: (action: ActionEvent) => void): void;     // required
  navigate?(url: string): void;                                            // redirect target
  storage?(scope: "local" | "session", key: string, value: string): void;  // write-only side-effect
  transport?(
    input: string,
    init: { method?: string; headers?: Record<string, string>; body?: FormData | string },
    hooks?: { onUploadProgress?: (sent: number, total: number) => void }
  ): Promise<Response>;                                                     // optional override; fetch is the default
}
```

- **`navigate?(url)`** — hand the platform off to a URL. `BrowserAdapter` implements it as `window.location.href = url` (relocated *verbatim* out of core — the binding moved where it executes, not what it does).
- **`storage?(scope, key, value)`** — write a client side-effect to platform storage. **Write-only**: the wire contract has no storage *read*. `BrowserAdapter` writes to `localStorage`/`sessionStorage` accordingly.
- **`transport?(input, init, hooks?)`** — optional transport override. **Asymmetric from the other two:** the core's own `fetch` is the universal default (browsers, Node 18+, Deno, Bun), so omitting `transport` is always safe — `load()`/`dispatch()` are *not* routed through a mandatory transport indirection. It exists as the extension point for the Phase 2 upload-progress XHR binding (`hooks.onUploadProgress`), which will be built *through* this seam with no further wire/API change.

**Optional-methods shape & non-breaking guarantee.** All three verbs are optional, so any existing custom `Adapter` that implements only `render` still compiles unchanged. Conversely, a new front-end target (mobile, terminal, …) becomes a *complete* target by implementing exactly one interface — that is the property this seam exists to create. The terminal target is no longer hypothetical: it ships in-repo as `@ashley-shrok/viewmodel-shell/tui` (drive any backend from a terminal with `npx vms-tui <url>`) — built solely on the `Adapter` interface, proof the seam delivered. **The terminal target is `@experimental`** (incomplete; scrolling, keyboard ergonomics, and layout coverage need more work) — it carries an `@experimental` TSDoc tag, emits a one-time runtime notice on `TuiAdapter` construction (silence: `VMS_TUI_SILENCE_EXPERIMENTAL=1`), and may change/be removed without a major bump. The seam itself and the browser/server/core packages are stable; only the TUI is provisional.

**Redirect resolution order.** When a response carries `redirect`, the shell resolves in this order:

1. `ShellOptions.onRedirect` if set — its signature is **unchanged** (`(url: string) => void`). Any consumer that sets `onRedirect` sees byte-identical behavior to before the refactor.
2. else `adapter.navigate(url)` — consumers relying on the old in-core default now get it from `BrowserAdapter.navigate` instead of core (still byte-identical, since every real consumer uses `BrowserAdapter`).
3. else a **loud error** (see fail-loud rule).

**Fail-loud rule.** Unlike `onError`/`onLoading`, `navigate`, `storage`, and `saveFile` have **no safe core default** — there is no sane no-op. If a redirect, storage side-effect, or download side-effect arrives and the capability is absent (no `onRedirect` and no `adapter.navigate`; or no `adapter.storage`; or no `adapter.saveFile`), the shell **fails loudly** — it surfaces an `Error` via `ShellOptions.onError` (or `console.error` if unset), **never a silent no-op**. This is a correctness/security requirement: a `set-local-storage` of an auth JWT (e.g. `hecate_jwt`) silently swallowed, a post-login redirect silently no-op'd, or an authenticated download silently dropped, is a security failure, not a soft degradation. An adapter author who omits `storage`/`navigate`/`saveFile` gets a hard, debuggable failure — not a swallowed auth token, a missed redirect, or a vanished download.

**Enforcement.** The "core references zero platform globals" invariant is enforced by a grep-based CI guard, scoped to **core `src/index.ts` only** (`viewmodel-shell/src/browser.ts` legitimately owns all DOM bindings and is *excluded*; `server.ts` is out of this guard's scope). The guard (`viewmodel-shell/scripts/check-core-platform-globals.mjs`, run locally via `npm run check:core-globals`) fails the build if `src/index.ts` references any of `window`, `document`, `localStorage`, `sessionStorage`, or `XMLHttpRequest`. It runs as a gating step in `.github/workflows/parity.yml` (the `Enforce core platform-agnosticism (AGNOSTIC-03)` step), alongside a framework-level jsdom adapter test that proves the relocated bindings actually fire. Universals deliberately kept in core (`fetch`, `FormData`, `setTimeout`, `URLSearchParams`, `console`) are not on the denylist. The guard scans **code only**: it strips line/block comments and string/template literals before the denylist match, so a clarifying doc comment or string in `index.ts` that *names* one of the five tokens (e.g. JSDoc explaining why `window` is intentionally absent) is allowed and will not false-fail CI — only a real code reference fails the build.

---

## Node types, action payloads & emitted CSS classes

The view tree is a discriminated union of typed nodes (a `type` string discriminator), shared by both backends. **This doc deliberately does not enumerate the node set, their props, the per-interaction action payloads, or the CSS classes each node emits.** A hand-copied catalog is exactly the drift that caused [issue #9](https://github.com/ashley-shrok/ViewModelShell/issues/9); the typed source is the single source of truth and cannot fall out of sync, because the build compiles it and CI parity-checks it:

| When you need… | Authoritative, always-current source |
|---|---|
| The node set + every prop / enum value | `viewmodel-shell/src/index.ts` (the `ViewNode` union + per-node interfaces), mirrored 1:1 in `viewmodel-shell-dotnet/ViewModels.cs` (.NET records + `[JsonDerivedType]` discriminators) |
| What `_action` / `_state` / file payload each interaction produces | the renderer in `viewmodel-shell/src/browser.ts`, exercised end-to-end by the fixtures under `parity/` |
| The exact CSS classes a node emits, and how they're styled | `viewmodel-shell/src/browser.ts` (emission) + `viewmodel-shell/styles/default.css` (the shipped styling of every class) |

This concern→source table is fixed: it does **not** grow when a node is added, so it cannot go stale. The two backend type sources are kept byte-aligned by the cross-backend parity suite (`parity/`, CI-gated) — a node or wire shape present in one backend and not the other fails the build. Behavior that isn't obvious from a node's type alone (immediate-dispatch vs. form-collected inputs; intentional omissions like the modal having no backdrop-dismissal) is documented at the type's definition in source and, where it cuts across nodes, in *Non-obvious framework behaviors* below. Runnable usage of every node lives in `demo/`. The wire stays multipart `_action` + `_state` + file entries (the stable contract in *Wire format* above); how to consume the emitted classes with zero app CSS is *Design system* below. **If your app needs a node / input type / text style / interaction you can't find in the source — ask; don't work around it.**

---

## Design system

The framework ships a serviceable look. The app does **not** hand-roll page CSS — it imports the stylesheet, optionally pins a theme, and (rarely) overrides a token. The live `demo/Showcase/` is the single source of truth for this section; every demo under `demo/` is a worked example of the real-app pattern below.

### Serviceable by default

Import the shipped stylesheet plus, optionally, one theme. The `.vms-page` shell + the `default.css` body rule own reset, centering, `--vms-page-max` width, background, and font — no app CSS, no `<style>` block, zero `@media`:

```typescript
import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css"; // optional — pick one
```

The shipped themes are the files under `viewmodel-shell/styles/themes/` — one file = one import; that directory **is** the current, authoritative set (this doc doesn't list them, so it can't go stale as themes are added). The shipped **default** (no theme import) is the light value set; the prior dark default is preserved byte-for-byte as `themes/dark-purple.css`, one import away (`import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css";`). A theme is one static import in your entrypoint (see `demo/ContactManager/frontend/src/main.ts`); multi-role apps import a distinct theme per role through the same seam (see `demo/HelpDesk/frontend/src/agent.ts` vs `requester.ts`).

### The `--vms-*` override seam — override the token, don't hand-roll

The **only** sanctioned per-app deviation: a tiny per-app stylesheet with a single `:root{}` setting `--vms-*` tokens, imported in your entrypoint **after** the theme — **never** an HTML `<style>` block. Use it for a width retune (`--vms-page-max` — *global* default; `--vms-page-max-wide` — what `.vms-page--wide` expands to), branded fonts (`--vms-font-body` / `--vms-font-head` / `--vms-font-mono`), or any `--vms-*` color var for a full reskin. **For per-page width opt-in, prefer the `PageNode.width: "wide" | "full"` wire field** (added in 0.7.0) over a `:root` retune — the wire field expresses page-level intent without changing the global default. The theme files under `viewmodel-shell/styles/themes/` are the reskin reference; this seam is additive — never remove or rename a `--vms-*` var.

```typescript
import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/light-amber.css";
import "./app-tokens.css"; // :root{ --vms-page-max: 1280px; } — after the theme, never <style>
```

Live example: `demo/RetroBoard/frontend/src/app-tokens.css` (a single `:root{ --vms-page-max }` retune, imported after the pinned theme in `main.ts`).

### When to use which layout preset / density / card

Layout *arrangement* is server intent on the existing `page`/`section` nodes (appearance is 100% CSS). Decide from the tree, not the browser:

- **`stack`** (default — omit the field): vertical flow. Forms, single-column content. Byte-identical to today's output.
- **`split`**: two equal columns on wide, collapses to stacked on narrow with **zero app breakpoints**. List ↔ detail, content + aside.
- **`cards`**: auto-fit grid from `--vms-card-min` (default 16rem), collapses to one column intrinsically. Dashboards, tile/summary grids.
- **`density: "compact"`** on `page`: tightens the spacing rhythm tokens globally — no app CSS.
- **`section variant:"card"`**: a grouped surface (background / border / padding / radius). Dashboard tiles, detail panes.
- **`page width: "wide"`** (0.7.0): widens the page cap from `--vms-page-max` (1080px) to `--vms-page-max-wide` (1440px) for data-heavy views (wide tables, dense list+detail). `width: "full"` removes the cap entirely. Omit for the framework default. TUI ignores it (terminals fill naturally).

### The canonical worked example (single source of truth)

The Showcase's three archetype views are the locked teaching mapping — point an agent at the live `demo/Showcase/frontend/src/main.ts`, do not re-invent snippets:

| Archetype | Layout preset | Bootstrap benchmark |
|---|---|---|
| Dashboard | `cards` (stat/summary tiles via `section variant:"card"`) | "Dashboard" |
| Form-heavy | `stack` (default vertical; multi-section form) | "Checkout" |
| List/detail | `split` (list ↔ detail pane, collapses on narrow) | "Album" |

These three views render the fixed shipped light default; the gallery view keeps the runtime 12-theme switcher. Docs and the Showcase reinforce each other — they cannot drift.

---

## Non-obvious framework behaviors

These are already implemented — you don't need to do anything to get them, but you should know they exist:

- **Automatic state round-tripping.** The shell holds the current state internally, sends it with every dispatch as the `_state` form field, and updates from the response. Apps never touch state plumbing — `getCurrentState()` exists if you need to inspect it.
- **Draft value preservation.** Text-like field values typed by the user survive server re-renders as long as the server doesn't explicitly set a new value for that field. Values disappear only if the field disappears from the new tree. **Hidden fields are excluded** (server is always authoritative). **File fields are excluded** but separately preserved via `DataTransfer` (see below). **Selects are excluded** — the snapshot exists to preserve typed text, and we can't safely distinguish "server set this" from "user changed it" after rendering.
- **File-input persistence.** When the user picks a file, the `File` object is held in the adapter's `fileRegistry` and re-applied to newly rendered file inputs on each render. Files survive intermediate dispatches and travel with the eventual form submission.
- **Dispatch guard.** A second action can't be dispatched while a round trip is in flight. Concurrent clicks are silently dropped. `onLoading` fires around every dispatch.
- **Focus and scroll preservation.** Focused element + caret position + scrolled containers are restored after each re-render.
- **Collapsible-section open state.** `SectionNode.collapsible: true` renders a native `<details>`/`<summary>` (closed by default; the heading is the summary label, or `"Show details"` if headingless). The open/closed state is DOM-local — the server does NOT round-trip it (same conceptual model as draft text two bullets above). The renderer snapshots `<details>.open` by a stable key (`SectionNode.id ?? heading ?? "vms-section-anon"`, disambiguated by per-render ordinal) before re-rendering and restores it after, the same pattern used for focus and scroll. **Rare-case escape hatch for server-driven expansion** (e.g. auto-expand the section containing a validation error): re-key the section by changing its heading, changing its `id`, or adding/removing a wrapping node — the renderer drops the preserved state and the section re-renders in its (closed) default. The framework ships no `forceExpand` / `defaultOpen` wire field by design.
- **`getRequestHeaders` hook.** `ShellOptions.getRequestHeaders?: () => Record<string, string> | Promise<Record<string, string>>` is called before every `load()` and `dispatch()` request and merged into the headers. Use this for auth tokens, ASP.NET anti-forgery tokens (`RequestVerificationToken` header), or any other custom headers.
- **Uniform `ok` flag.** Every framework-rendered response — normal render, redirect, sideEffects-only, poll, busy/preventUnload toggle — carries `ok: true`. Every framework-detected failure carries `ok: false` with structured `errors[]`. Apps don't set `ok`; the framework does.
- **`VmsActionError` on existing `onError`.** A 4xx/5xx response with a parseable `{ok: false, errors: [...]}` body surfaces as a `VmsActionError` via your existing `onError` callback (status, errors, code shortcut). Apps that wired `onError` for fetch failures keep working unchanged; apps that want structured branching add `if (err instanceof VmsActionError)`.
- **`UnknownActionError` / `UnknownActionException`.** Throw this from your dispatch `default:` arm; the framework's catch produces `{ok: false, errors: [{message: "Unknown action: ...", code: "unknown_action"}]}` at 400.

---

## Patterns

### State record

Define a JSON-round-trippable record per controller. Use `IReadOnlyList<T>` for collections so `with` expressions and collection-expression spreads compose naturally:

```csharp
public record TasksState(
    IReadOnlyList<TaskRecord> Items,
    string Filter
)
{
    public static TasksState Initial() => new(
        Items: [/* seed data */],
        Filter: "all"
    );
}
```

For apps with **persistent data** (e.g. SQLite, files), keep that in a singleton service injected into the controller — the state record holds only UI state (current view, filter, selected ID, validation error). See `demo/HelpDesk/AspNetCore/` for SQLite + UI state coexisting.

### Controller pattern

```csharp
[ApiController]
[Route("api/your-feature")]
public class YourController : ControllerBase
{
    [HttpGet]
    public ShellResponse<YourState> Get()
    {
        var state = YourState.Initial();
        return new(BuildVm(state), state);
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<YourState>> Action()
    {
        var payload = ActionPayload<YourState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        var state = payload.State;
        // Switch on payload.Name, produce new state via `with`:
        switch (payload.Name)
        {
            case "your-action":
                state = state with { /* changes */ };
                break;
            default: throw new UnknownActionException(payload.Name);
        }

        return new ShellResponse<YourState>(BuildVm(state), state);
    }

    private static ViewNode BuildVm(YourState state) => /* pure function of state */;
}
```

`BuildVm` is a pure function of state — no controller-level mutable fields, no registry lookup. Files travel as additional form entries; read them with `Request.Form.Files` and persist however the app needs.

Full examples: `demo/Tasks/AspNetCore/TasksController.cs`, `demo/HelpDesk/AspNetCore/AgentController.cs`.

### Server-initiated redirect

When an action needs to hand the browser off to a different URL (login completion, OAuth callback, post-onboarding routing), return `ShellResponse<TState>.RedirectTo(url)` instead of a normal render response. The shell will navigate the browser instead of re-rendering.

**C# (controller action):**
```csharp
case "login":
    var ok = _auth.Validate(Str("username"), Str("password"));
    if (!ok) { state = state with { Error = "Invalid credentials" }; break; }
    return ShellResponse<LoginState>.RedirectTo(returnUrl ?? "/app");
```

**TypeScript (optional override):** By default the shell does `window.location.href = url`. Override via `ShellOptions.onRedirect` when the default isn't right (e.g. SPA router, test environment):
```typescript
const shell = new ViewModelShell({
  // ...
  onRedirect: (url) => router.navigate(url),
});
```

Wire format — when the server returns a redirect, `vm` and `state` are omitted:
```json
{ "redirect": "/dashboard" }
```
Normal responses that don't include `redirect` are unaffected.

### Client side-effects

When a server action needs to reach past the render loop and touch something on the client environment — writing to storage, seeding a flag — return a `sideEffects` array. The shell applies effects in order before the redirect or re-render fires.

**C#:**
```csharp
// Redirect + write a JWT to localStorage (e.g. auth login)
return ShellResponse<LoginState>.RedirectTo(returnUrl ?? "/app")
    .WithEffect(ShellSideEffect.SetLocalStorage("hecate_jwt", token));

// Side effect without redirect (re-renders normally after applying effects)
return new ShellResponse<SomeState>(BuildVm(state), state)
    .WithEffect(ShellSideEffect.SetSessionStorage("draft_id", id));
```

Built-in effect types:

| Factory | `type` string | What it does |
|---|---|---|
| `ShellSideEffect.SetLocalStorage(key, value)` | `"set-local-storage"` | `localStorage.setItem(key, value)` |
| `ShellSideEffect.SetSessionStorage(key, value)` | `"set-session-storage"` | `sessionStorage.setItem(key, value)` |
| `ShellSideEffect.Download(url, filename?)` | `"download"` | Shell fetches `url` with `getRequestHeaders()` merged, parses `Content-Disposition` + `Content-Type`, hands the bytes to `Adapter.saveFile`. `BrowserAdapter` triggers a Save-As; `TuiAdapter` writes to `~/Downloads`. Filename precedence: `Content-Disposition` > side-effect `filename` > URL basename > `"download"`. Missing the `saveFile` capability fails loud (see fail-loud rule). |

Unknown `type` values are silently ignored by the shell — forward-compatible if new effect types are added later.

Wire format:
```json
{
  "sideEffects": [
    { "type": "set-local-storage", "key": "hecate_jwt", "value": "eyJ..." },
    { "type": "download", "url": "/api/invoices/42/pdf", "filename": "invoice-42.pdf" }
  ],
  "redirect": "/app"
}
```

**`"download"` design note.** Authenticated file downloads were the gap that motivated this side-effect type ([#10](https://github.com/ashley-shrok/ViewModelShell/issues/10)): `LinkNode { external: true }` is a top-level browser navigation that carries no shell headers, so every header-auth consumer (Bearer JWT via `getRequestHeaders()`) was forced into per-backend signed-URL machinery. The side-effect path reuses the existing header seam — the shell's own download fetch re-presents the merged headers to the file endpoint — and the server authorizes *in the action handler* with the real auth context. No new authorization lane; no per-backend token signing.

### Polling and push

Two mechanisms for server-initiated updates without user input:

**Built-in polling.** Set `pollInterval` on the TypeScript shell, and the framework dispatches a `"poll"` action on that cadence after every load/dispatch. The server handles `poll` like any other action — read current state, return updated state + view. Polls run silently (no `onLoading` fires).

```typescript
new ViewModelShell({ pollInterval: 1000, /* ... */ });
```

```csharp
case "poll":
    state = state with { Messages = _db.GetMessages() };
    break;
```

**Server-controlled cadence.** `NextPollIn` on the response overrides the next interval, or stops polling entirely:

```csharp
return new ShellResponse<JobState>(BuildVm(state), state) { NextPollIn = 2000 };
```

**External push (`shell.push(response)`).** Feed a pre-parsed response into the shell from outside the action loop — for SSE/WebSocket integrations:

```typescript
new EventSource("/api/chat/stream").onmessage = e => shell.push(JSON.parse(e.data));
```

**Critical pattern — drive stop/continue from a state field, not a server-side check.**

The natural-seeming approach for one-shot tasks is "return `NextPollIn` while the row's status is non-terminal, omit it when terminal." This works for slow-completing tasks but breaks silently for fast-completion paths: if the task finishes inside the request that started it, the first response carries the terminal state but no `NextPollIn` — so the client never starts polling, never re-renders, and the page freezes on the pre-completion view. Add a `PollingDone` (or similar) boolean to the state record, drive `NextPollIn` from that, and make sure the server emits `NextPollIn` at least once even when the task completes synchronously — the client needs that one tick to render the terminal state.

```csharp
state = state with { Job = job, PollingDone = job.Status is "complete" or "failed" };
return new ShellResponse<MyState>(BuildVm(state), state)
{
    NextPollIn = state.PollingDone ? 100 : 2000  // one final tick to render terminal state
};
```

Draft text, focus, caret position, and scroll positions are all preserved across poll/push re-renders — same as user-action re-renders.

### Tables in VMS — the canonical workflow pattern

`TableNode` is composable enough to express several UX shapes. The framework supports them all, but **for workflow apps — the dominant case VMS targets — there is one canonical shape, and demos / new code should follow it.** Naming the shapes explicitly so consumers (and agents helping them) know which to reach for:

| Mode | Shape on `TableNode` | When to use | Selection? |
|---|---|---|---|
| **A. Workflow (canonical)** — filter narrows to ≤ cap, show all matches, act on the chunk | `filterAction` set (status tabs + a free-text column filter via `TableColumn.filterable: true`); **no** `pagination`; `selection.buttons[]` set when matches are within the cap; the controller renders a `TextNode("Refine your filter — N matches, max is X")` when matches exceed the cap and emits an empty `rows: []` so the filter input stays accessible | Workflow / queue / admin tools where the user almost always knows what they're looking for. **This is the default to reach for.** | ✓ yes |
| **B. Browse + pagination** — page through everything, no selection | `pagination` set; `filterAction` optional; **no** `selection` | Pure browse without a selection step (a tickets list a user just reads through, an archived-records search results page) | ✗ no |
| **C. Browse + selection** (rare) | Not first-class. Apps compose `pagination` + `selection.buttons[]` and accept the cross-page-selection cost (paginating wipes the local selection set; document the limitation in the UI or work around it with an explicit "select all N matching" button — see below). | Gmail-style "select all 1,247 conversations" workflows. Rare in workflow apps. | partial, app-built |

**Why filter-narrow is canonical** — it sidesteps a whole class of UX bugs by construction. The old per-toggle round-trip `selection.action` (removed in 0.15.0) had the rapid-click + DOM-wipe bug specifically *because* selection had to survive across re-renders; with mode A there's no pagination, no re-renders that lose selection, no cross-page sweep. Users select within the visible chunk and act. If they need to act on rows they haven't narrowed to, their UX is probably wrong.

**The cap is the app's choice.** A claims-investigation tool might cap at 200; a quick-pick admin tool at 25; a tool with very lightweight rows might cap at 500. The framework doesn't have an opinion — pick what makes sense for your row weight and the user's working memory. The controller enforces it server-side (`if (matches > cap) renderTooBroadMessage()`).

**"Select all N matching" pattern** — when an app needs the Gmail affordance, **no framework primitive is needed.** Compose a regular `ButtonNode` (or `selection.buttons[]` entry) that dispatches a bulk action with **the current filter** in its context. The server runs the bulk against the filter query server-side, not against a row-id list. The framework already gives you everything: the filter is in state (round-tripped), the button is just a button, the action handler queries by filter and acts. No row-ids on the wire.

**Per-row navigation: `row.action` (the click-anywhere primitive, re-added in 1.1.0).** Set `TableRow.action` to an `ActionEvent` (TS) / `ActionDescriptor` (.NET) and the renderer makes the entire row clickable AND keyboard-activatable AND accessible — full keyboard support (`Enter` dispatches; `Space` `preventDefault`s page scroll then dispatches; `Tab` does NOT dispatch) and ARIA (`role="button"`, `tabindex=0`, `aria-label` derived from non-empty cell text joined by ` · `). Per-row identity is encoded in the action name (e.g. `select-ticket-42`), consistent with the Phase-6 wire — no `context` field. Pair it with `row.actions[]`, which now accepts a mix of `ButtonNode` and `CheckboxNode` (renderer dispatches by `entry.type`); clicks on those interactive descendants and on cell `linkLabel` anchors `stopPropagation` so they never double-fire `row.action`. **Reach for this over a per-row "Open" button** — the row is the affordance, the renderer adds keyboard + ARIA automatically, and it sidesteps the silently-broken empty-button rendering that the `actions[]` bug (also fixed in 1.1.0) used to cause.

**Worked example:** `demo/HelpDesk/AspNetCore/AgentController.cs` (+ bun twin at `demo/HelpDesk-bun/server.ts`) is the canonical reference. It seeds ~80 tickets so the cap actually fires; tabs narrow by status; the Title column has a free-text filter input; matches ≤ cap render with `selection.buttons[]` for bulk close/start/reopen; matches > cap render a "narrow further" message with the filter input still accessible. The three zero-row paths each carry a distinct, unambiguous signal so the user can never confuse one with a broken render: **over cap** → the "narrow further" warning above an empty table; **filter matches 0 against a non-empty DB** → muted `"No tickets match your filter."` above an empty table (filter input still reachable to edit/clear); **DB itself empty** → `"No tickets in queue."` with no table.

### Action payload — JSON body (curl/agent ergonomics)

The TypeScript shell always submits actions as `multipart/form-data` (because of file uploads). For human-driven or agent-driven callers using curl/PowerShell, multipart's two-layer escaping (JSON inside form field inside multipart) is friction. Controllers can opt into accepting `application/json` as a fallback content-type using `ActionPayload<TState>.ParseJson(jsonBody)`:

```csharp
[HttpPost("action")]
[Consumes("multipart/form-data", "application/json")]
public async Task<ActionResult<ShellResponse<MyState>>> Action()
{
    ActionPayload<MyState> payload;
    if (Request.HasJsonContentType())
    {
        using var reader = new StreamReader(Request.Body);
        payload = ActionPayload<MyState>.ParseJson(await reader.ReadToEndAsync());
    }
    else
    {
        payload = ActionPayload<MyState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());
    }
    // ... rest of action
}
```

JSON body shape — flat, no nested escaping:
```json
{ "name": "add", "state": { ... } }
```

No `context` field. All input values travel in `state` (via bind paths). `curl --json '{"name":"poll","state":{...}}' /api/your/action` just works. File-bearing actions still need multipart — JSON support is an opt-in convenience, not a replacement.

On failure, the response body is `{ok: false, errors: [{path?, message, code?}]}` at 4xx/5xx — the same shape regardless of whether the failure was a parse error (400), unknown action (400), invalid tree (500), or uncaught exception (500). Agents check `body.ok`; framework-classified failures carry a `code` from the stable vocabulary (`parse_error`, `unknown_action`, `invalid_tree`, `uncaught_exception`).

### ShellResponse&lt;TState&gt; reference

Every field except `Vm` and `State` is optional. The combination determines what the shell does on receipt:

| Field | Type | Effect |
|---|---|---|
| `Vm` | `ViewNode?` | The view tree to render. Omit (null) when redirecting. |
| `State` | `TState?` | The new client state. Omit (null) when redirecting. |
| `Redirect` | `string?` | When set, the shell navigates to this URL instead of re-rendering. `Vm` and `State` are ignored. |
| `SideEffects` | `IReadOnlyList<ShellSideEffect>?` | Applied in order before redirect/render. Built-in types: `"set-local-storage"`, `"set-session-storage"`, `"download"`. Unknown types are silently ignored (forward-compatible). |
| `NextPollIn` | `int?` (ms) | Schedules the next poll at this delay. Falls back to `ShellOptions.pollInterval` if omitted. **Omit on a response with no `pollInterval` set to stop polling.** See the polling section for the fast-completion footgun. |
| `PreventUnload` | `bool` (0.14.0) | When `true`, the shell asks the adapter to install a "warn before navigating away" guard (browser shows the native "Leave site?" dialog on tab-close / refresh / cross-origin nav). When `false` / omitted, the guard is cleared. **Idempotent on every response** — set it on each render while a long-running server action is pending; the next response that omits it (or sets it `false`) clears the guard. `BrowserAdapter` ships the implementation via `beforeunload`; the TUI is a no-op (terminals have no unload). Modern browsers control the dialog text; it is not customizable. |
| `Busy` | `bool` (0.16.0) | When `true`, the shell **drops user-initiated dispatches** (polls bypass — they're how the server clears the state) and the `BrowserAdapter` toggles `.vms-busy` on its container. Default CSS makes every interactive descendant non-clickable (`cursor: wait` + `pointer-events: none`) so a rapid click during an in-flight round-trip can't visually flip a checkbox or depress a button — the lock is honest. Same idempotent on-every-response shape as `PreventUnload`; the two are naturally paired for long-running server actions ("Working…" modal + Busy + PreventUnload). The framework **also** applies `.vms-busy` implicitly for the duration of any single user-initiated dispatch (using the existing dispatching flag), so the rapid-click-during-round-trip problem is solved generically without consumers having to set `Busy` for every action. |
| `Ok` | `bool` (defaults to `true`) | Framework-set on every response. Apps don't set this. Present in the wire as `"ok": true` on all normal responses (render, redirect, poll, sideEffects, busy, preventUnload). Framework-detected failures (parse error, unknown action, invalid tree, uncaught exception) emit `"ok": false` with structured `errors[]` instead of a normal response. Single check across every response shape; the shell surfaces `ok: false` responses as `VmsActionError` via the existing `onError` callback. |

Factory methods on `ShellResponse<TState>`:
- `ShellResponse<T>.RedirectTo(url)` — redirect response with `Vm`/`State` null.
- `response.WithEffect(ShellSideEffect.SetLocalStorage(key, value))` — fluent side-effect append.

`ShellSideEffect` factories: `SetLocalStorage(key, value)`, `SetSessionStorage(key, value)`, `Download(url, filename?)`.

### TypeScript backend pattern

For Node/Bun/Deno/Cloudflare Workers backends, the `@ashley-shrok/viewmodel-shell/server` subpath mirrors the C# NuGet package — same wire format, same shapes, written in TypeScript. Use this when your team is end-to-end TypeScript and prefers a single language over the .NET reference backend.

```typescript
import {
  createAction,
  shellRedirect,
  shellSideEffect,
  UnknownActionError,
  type ActionPayload,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

interface TasksState {
  items: Array<{ id: string; title: string; completed: boolean }>;
  filter: "all" | "active" | "done";
}

function buildVm(state: TasksState): ViewNode { /* pure function of state */ }

// Hono / Bun.serve / Deno.serve / Cloudflare Workers — anything Web Fetch native:
app.post("/api/tasks/action", createAction<TasksState>(async (payload) => {
  let state = payload.state;
  switch (payload.name) {
    case "add":
      state = { ...state, items: [...state.items, /* ... */] };
      break;
    case "login":
      return shellRedirect("/dashboard");
    case "save-jwt":
      return {
        vm: buildVm(state),
        state,
        sideEffects: [shellSideEffect.setLocalStorage("jwt", (payload.state as { token: string }).token)],
      };
    default:
      throw new UnknownActionError(payload.name);
  }
  return { vm: buildVm(state), state };
}));
```

`createAction` auto-detects content-type (JSON vs multipart) so shell-driven submissions and curl/agent callers both work without per-route code. Files in multipart submissions are surfaced on `payload.files` as `Record<string, File>`.

For Express, wrap with a small adapter that turns `(req, res)` into a `Request` and writes the `Response` back. The framework stays Web Fetch native to avoid maintaining a matrix of framework-specific adapters.

The subpath ships under the same npm package (no separate version to manage) and the types literally cannot drift because they're in the same source tree.

### Frontend wiring

```typescript
import { ViewModelShell } from "viewmodel-shell";
import { BrowserAdapter } from "viewmodel-shell/browser";

const container = document.getElementById("app")!;
const shell = new ViewModelShell({
  endpoint: `/api/your-feature`,
  actionEndpoint: `/api/your-feature/action`,
  adapter: new BrowserAdapter(container),
  onLoading: (loading) => { /* app-level hook — e.g. toggle a spinner. No shipped dim affordance. */ },
  onError: (err) => { /* show error banner */ },
});

shell.load();
```

No tab ID, no query parameters — multi-tab isolation comes from each tab carrying its own state.

### Agent discoverability

Every backend-bearing demo page in this repo carries a one-line HTML comment + a `<meta name="viewmodel-shell">` tag in `<head>` that announces "this is a VMS app — drive it via the JSON wire" and names the endpoint pair. Visible to any agent that reads the page's HTML, **including JS-less ones** (`curl`, `WebFetch`, basic crawlers) — which matters, because "agents can drive this without a browser" is the framework's pitch.

```html
<!-- Agent discoverability — this is a ViewModel Shell app: agents can drive it via the JSON wire
     (GET endpoint → {vm, state}; POST actionEndpoint multipart {_action, _state}). Docs: https://github.com/ashley-shrok/ViewModelShell -->
<meta name="viewmodel-shell" content='{"protocol":"viewmodel-shell/0.12","endpoint":"/api/<x>","actionEndpoint":"/api/<x>/action"}'>
```

The `protocol` token is `viewmodel-shell/<major.minor>` — bump only when the wire shape itself changes (additive wire changes within a minor, like `0.12.0`'s table selection/pagination, don't require a bump because old agents still work).

**Convention rule:** any new demo page that mounts a VMS shell MUST include this meta (`grep -L 'viewmodel-shell"' demo/**/*.html` should return nothing among backend-bearing pages). Chooser/landing pages with no shell mount (e.g. `demo/HelpDesk/frontend/index.html`) and the pure-frontend `demo/Showcase/` don't carry it — they have no endpoint to advertise. The parity suite doesn't check it (it's an out-of-band discoverability signal, not part of the wire); reviewers do.

### MSBuild target

Runs `npm run build` automatically before every `dotnet build` / Visual Studio F5:

```xml
<Target Name="NpmInstall" BeforeTargets="BuildFrontend"
        Condition="!Exists('$(MSBuildProjectDirectory)/../frontend/node_modules')">
  <Exec Command="npm install" WorkingDirectory="$(MSBuildProjectDirectory)/../frontend" />
</Target>
<Target Name="BuildFrontend" BeforeTargets="Build">
  <Exec Command="npm run build" WorkingDirectory="$(MSBuildProjectDirectory)/../frontend" />
</Target>
```

Full example: `demo/Tasks/AspNetCore/ViewModelShell.csproj`.

---

## Testing

Both layers are testable with normal unit tests — no browser, no Playwright, no running server.

**Frontend:** `cd <frontend-dir> && npx vitest run`. Tests use `BrowserAdapter` directly with jsdom. Pattern: `demo/Tasks/frontend/src/adapter.test.ts`.

**Backend:** `cd <test-project-dir> && dotnet test`. Tests call controller methods directly with a real `DefaultHttpContext` — no HTTP stack. The action endpoint reads from `Request.Form`, so the `Act` helper serializes both action and state into form fields:

```csharp
private static ActionResult<ShellResponse<YourState>> Act(
    YourController ctrl, YourState state, string name)
{
    var actionJson = JsonSerializer.Serialize(new { name });
    var stateJson  = JsonSerializer.Serialize(state);
    ctrl.ControllerContext.HttpContext.Request.Form = new FormCollection(
        new Dictionary<string, StringValues>
        {
            ["_action"] = actionJson,
            ["_state"]  = stateJson,
        });
    return ctrl.Action();
}
```

Multi-step tests thread state explicitly:
```csharp
var step1 = Ok(Act(ctrl, YourState.Initial(), "first-action"));
var step2 = Ok(Act(ctrl, step1.State, "second-action"));
```

For DB-backed apps, use a named in-memory SQLite connection shared across test methods (anchor connection kept open for the test class lifetime to keep the in-memory DB alive). See `demo/HelpDesk/AspNetCore.Tests/RequesterControllerTests.cs`.

---

## Demo apps

Worked, runnable examples live under `demo/` — read the ones nearest your app's shape before writing new code; the patterns are consistent across them, and each demo's source/entrypoint shows what it exercises. No catalog here on purpose: the demo set grows and a list would drift discover them yourself instead: `ls demo/` is the live set (`<Name>-bun/` is the TypeScript-backend twin of `<Name>/`), and `parity/backends.json` is the machine-checked registry of every backend — it *can't* go stale, because CI fails the moment it drifts from reality.

---

## Conventions for evolving the framework

- **Don't add features the framework doesn't have a clean place for.** When a request would require a workaround, that's usually a signal that the framework needs a new primitive — ask before patching around it.
- **The .NET `ViewNode` types live in ONE place — `viewmodel-shell-dotnet/ViewModels.cs`.** Every .NET demo consumes it via `<ProjectReference>` to `AshleyShrok.ViewModelShell.csproj` (there are **no** hand-copied `ViewModels.cs` files under `demo/` — verify with `find demo -name ViewModels.cs`, which returns nothing). So a node-type / wire-format change is a single edit there; it propagates to every demo on rebuild. The TypeScript twin is `viewmodel-shell/src/{index,server}.ts`. The two backends are kept byte-aligned by the cross-backend parity suite (`parity/`) — run it; it's what actually enforces no-drift.
- **`CHANGELOG.md` + `MIGRATION.md` are release-gated, not HEAD-synced.** They are append-only, version-specific history and are intentionally *not* kept in lockstep with `main` — they may lag between releases, and that's fine. The only rule: whenever you bump a package version / publish (npm or NuGet), add the matching `CHANGELOG.md` entry — and a `MIGRATION.md` note if consumers must do anything — in that same change. Never retro-edit old entries when a node is added.
- **🚨 A version bump is NOT a release — the registries are. Publishing is mandatory and manual.** Bumping `version` in `viewmodel-shell/package.json` or `Version` in `AshleyShrok.ViewModelShell.csproj` and pushing to git **does not release anything**. Consumers `npm install` / `dotnet add package` from the **registries**, not from this repo. Every version bump MUST be accompanied — in the same operator session — by the publish command(s) below. There is **no** CI publish workflow by design (npm auth-token expiry makes automated publishing more trouble than it's worth); the operator runs these by hand.
  - **npm** (if `viewmodel-shell/package.json` version changed):
    ```bash
    cd /home/ubuntu/ViewModelShell/viewmodel-shell
    npm publish  # prepublishOnly runs `npm run build` first; auth via ~/.npmrc on this box
    npm view @ashley-shrok/viewmodel-shell version  # confirm registry now matches
    ```
  - **NuGet** (if `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>` changed):
    ```bash
    cd /home/ubuntu/ViewModelShell/viewmodel-shell-dotnet
    dotnet pack -c Release  # emits bin/Release/AshleyShrok.ViewModelShell.<version>.nupkg
    dotnet nuget push bin/Release/AshleyShrok.ViewModelShell.<version>.nupkg \
      --api-key "$NUGET_API_KEY" --source https://api.nuget.org/v3/index.json
    curl -s https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json \
      | python3 -c "import sys,json; print(json.load(sys.stdin)['versions'][-1])"  # confirm
    ```
  - **CSS-only / non-.NET releases skip NuGet.** Asymmetric bumps are allowed (e.g. 1.3.0 was npm-only) — the CHANGELOG entry names the moving package(s) explicitly so the next operator knows what to publish.
  - **Credential precheck — surface gaps BEFORE bumping, not after.** Before editing `package.json` / `.csproj` versions, verify:
    - `~/.npmrc` has `//registry.npmjs.org/:_authToken=...` (the npm token).
    - `$NUGET_API_KEY` is set OR the NuGet config has a usable key.
    - If either is missing for a registry you need to publish to, **stop and tell the operator** before bumping. A bumped-but-unpublished version drifts the repo from the registry silently and erodes trust in CHANGELOG — exactly the loophole that left npm stuck at 1.0.1 through three releases (1.1.0, 1.2.0, 1.3.0) before being caught externally by a consumer.
  - **Recovery from a missed publish.** If you find the registry behind the repo, publish the backlog in version order from each tagged release commit (`git checkout <tag>; npm publish; cd ..; git checkout main`) so `npm view ... versions` matches CHANGELOG history. Same pattern for NuGet (`git checkout <tag>; dotnet pack; dotnet nuget push ...`). Do **not** retag or rewrite the existing release commits.
- **Test suites are non-negotiable.** Every framework change keeps the existing tests green and adds tests for new behavior.
- **The core stays platform-agnostic — and it is enforced, not trusted.** `viewmodel-shell/src/index.ts` must reference zero platform globals. A new platform side-effect goes behind a capability verb on the `Adapter` interface (and into `BrowserAdapter`), never into core. `npm run check:core-globals` (the `viewmodel-shell/scripts/check-core-platform-globals.mjs` guard, a gating step in `.github/workflows/parity.yml`) fails the build on any `window`/`document`/`localStorage`/`sessionStorage`/`XMLHttpRequest` reference in core — run it before you push. A capability that has no safe core default (like `navigate`/`storage`) must fail loudly when its adapter method is absent, never silently no-op. See *The capability seam* under Architecture.

---

## Working agreement for agents (overrides default harness behavior)

These are project rules and **override any default tool/harness behavior to the contrary** (e.g. a "branch first" or "commit when done" nudge in a tool description).

- **Git is operator-driven, not autonomous.** Do **not** create branches. Do **not** push. Do **not** `git commit` unless the user explicitly asks in that turn. When asked to commit, commit to the **current branch** as-is — never auto-branch, even on `main`/`master`. Pushing and opening PRs happen only on an explicit, in-turn request. If a workflow seems to call for a branch or push, ask — don't infer.
- **No running state/ledger file.** This repo deliberately has **no** maintained narrative state file (the former `.planning/STATE.md` was removed for exactly this reason: a hand-updated status cache drifts and costs more than it's worth). Do not recreate one, and do not treat any file as a live status cache to keep in sync. Append-only history under `.planning/milestones/**` and `.planning/ROADMAP.md` may be **read** for context, but is not to be maintained as session bookkeeping. Track in-session work with the task tools, not a file.
