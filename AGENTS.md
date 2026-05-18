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

4. **Inline validation goes in the state record, not `BadRequest`.** Add a `ValidationError` field to your state record, set it on failure, clear on success, and include `new TextNode(state.ValidationError, "error")` in the view when non-null. The validation message round-trips with the state. See `demo/HelpDesk/AspNetCore/RequesterController.cs`. Use `BadRequest` only for malformed/programmatic input the user can't see (missing required action fields, unknown action names).

5. **Tests need `global using Xunit;` in `GlobalUsings.cs`** (not auto-imported even with `ImplicitUsings`) and `<FrameworkReference Include="Microsoft.AspNetCore.App" />` to access `DefaultHttpContext`.

6. **Configure ASP.NET Core JSON to strip null fields:** `DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull` in `Program.cs`. Without it, every nullable field on every node serializes as `"field": null`, which (a) bloats the wire, (b) drifts from non-.NET backends (TypeScript naturally omits undefined fields), and (c) the frontend adapter handles both anyway. See any demo's `Program.cs` for the canonical config. Non-nullable booleans (e.g. `CheckboxNode.Checked`) keep serializing as `false`/`true` since they have semantic value.

7. **Cross-backend parity testing lives in `parity/`.** Any new official backend must implement the fixtures listed in `parity/backends.json` and pass `bun run parity/run.ts`. The harness spins up every backend in parallel, runs the same action sequences against each, and diffs normalized responses step-for-step. Any wire-format drift fails the run.

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
| `_action` | JSON: `{ "name": "...", "context": { ... } }` |
| `_state` | JSON: the current state record |
| any file-input `name` | the `File` object (when forms have file fields) |

Response is the same `{ "vm", "state" }` shape as GET. The shell stores `state` internally and sends it with the next dispatch automatically — apps don't manage state plumbing.

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

**Optional-methods shape & non-breaking guarantee.** All three verbs are optional, so any existing custom `Adapter` that implements only `render` still compiles unchanged. Conversely, a new front-end target (mobile, terminal, …) becomes a *complete* target by implementing exactly one interface — that is the property this seam exists to create.

**Redirect resolution order.** When a response carries `redirect`, the shell resolves in this order:

1. `ShellOptions.onRedirect` if set — its signature is **unchanged** (`(url: string) => void`). Any consumer that sets `onRedirect` sees byte-identical behavior to before the refactor.
2. else `adapter.navigate(url)` — consumers relying on the old in-core default now get it from `BrowserAdapter.navigate` instead of core (still byte-identical, since every real consumer uses `BrowserAdapter`).
3. else a **loud error** (see fail-loud rule).

**Fail-loud rule.** Unlike `onError`/`onLoading`, `navigate` and `storage` have **no safe core default** — there is no sane no-op. If a redirect or storage side-effect arrives and the capability is absent (no `onRedirect` and no `adapter.navigate`; or no `adapter.storage`), the shell **fails loudly** — it surfaces an `Error` via `ShellOptions.onError` (or `console.error` if unset), **never a silent no-op**. This is a correctness/security requirement: a `set-local-storage` of an auth JWT (e.g. `hecate_jwt`) silently swallowed, or a post-login redirect silently no-op'd, is a security failure, not a soft degradation. An adapter author who omits `storage`/`navigate` gets a hard, debuggable failure — not a swallowed auth token.

**Enforcement.** The "core references zero platform globals" invariant is enforced by a grep-based CI guard, scoped to **core `src/index.ts` only** (`viewmodel-shell/src/browser.ts` legitimately owns all DOM bindings and is *excluded*; `server.ts` is out of this guard's scope). The guard (`viewmodel-shell/scripts/check-core-platform-globals.mjs`, run locally via `npm run check:core-globals`) fails the build if `src/index.ts` references any of `window`, `document`, `localStorage`, `sessionStorage`, or `XMLHttpRequest`. It runs as a gating step in `.github/workflows/parity.yml` (the `Enforce core platform-agnosticism (AGNOSTIC-03)` step), alongside a framework-level jsdom adapter test that proves the relocated bindings actually fire. Universals deliberately kept in core (`fetch`, `FormData`, `setTimeout`, `URLSearchParams`, `console`) are not on the denylist. The guard scans **code only**: it strips line/block comments and string/template literals before the denylist match, so a clarifying doc comment or string in `index.ts` that *names* one of the five tokens (e.g. JSDoc explaining why `window` is intentionally absent) is allowed and will not false-fail CI — only a real code reference fails the build.

---

## Node types

| Type | Notes |
|---|---|
| `page` | Root container with optional title; optional `density`: `"comfortable"` \| `"compact"` (compact emits `.vms-page--compact`; omitted/comfortable = no modifier, byte-identical); optional `layout`: `"stack"` \| `"split"` \| `"cards"` \| `"sidebar"` (`split`=equal 2-up, `cards`=uniform auto-fit grid, `sidebar`=thin+wide app shell that wraps to stacked on narrow; each emits `.vms-page--{value}`; omitted/`stack` = no modifier, byte-identical vertical flow) |
| `section` | Grouped content with optional heading; optional `variant`: `"card"` → `.vms-section--card` (grouped surface; omitted = no modifier, byte-identical); optional `layout`: `"stack"` \| `"split"` \| `"cards"` \| `"sidebar"` (same presets as `page`; each emits `.vms-section--{value}`; omitted/`stack` = no modifier, byte-identical) |
| `list`, `list-item` | Containers; `variant` on item becomes `vms-list-item--{variant}`. Shipped variant defaults: status hints `done`/`critical`/`high`/`warning`/`success`/`info`, and `active` (master-detail / nav selection highlight, themable via accent seam vars — D-27) |
| `form` | Form with submit action; collects all input/textarea/select/file values on submit. Optional `layout`: `"stack"` (default, fields stacked) \| `"inline"` (field row + submit on one line — add/search bar; emits `.vms-form--inline`, wraps on narrow — D-29) |
| `field` | `inputType`: `text`, `email`, `password`, `number`, `date`, `time`, `datetime-local`, `textarea`, `hidden`, `file`, `select`, `select-multiple`, `checkbox`, `code`. Selects use `options: [{ value, label }]`. Multi-select submits comma-joined. Field-checkboxes are form-collected: `value: "true"`/`"false"` round-trips with the form submission as a boolean (use `Bool(name)` server-side). For per-toggle dispatch, use `CheckboxNode` instead. `code` renders a monospaced, tab-aware textarea — pass an optional `language` ("sql", "javascript", etc.) which becomes a `.vms-field--code-{language}` class for apps to attach a syntax-highlighter library to. The framework only ships the editable monospaced surface; coloring is the app's choice. |
| `checkbox` | (`CheckboxNode`) Dispatches immediately on change with `{ checked: bool }` merged into context. For checkboxes that should be submitted with a form, use `FieldNode(inputType: "checkbox")` instead. |
| `button` | `variant`: `primary`, `secondary`, `danger` |
| `text` | `style`: `heading`, `subheading`, `body`, `muted`, `strikethrough`, `error`, `pre` (renders as `<pre>` for monospace/whitespace-preserving output) |
| `link` | `<a class="vms-link">`; `external: true` adds `target="_blank" rel="noopener noreferrer"` |
| `stat-bar` | Row of label/value items |
| `tabs` | Dispatches immediately on click with `{ value: tab.value }` merged into context |
| `progress` | 0–100 |
| `modal` | Optional title + body children + optional `footer` (action-button row) + `dismissAction`. No backdrop-click dismissal, no focus management — these are intentional design choices. A modal with no `dismissAction` and no footer is non-dismissible by client-side interaction; the dev must include an in-body or in-footer action to close it. |
| `table` | `columns`, `rows`, optional `sortColumn`/`sortDirection`/`sortAction`. Per-column filter via `filterable: true` + `filterValue` + `filterAction` on table. Per-row `action` makes the row clickable. Column `linkLabel` + `linkExternal` renders the cell value as an anchor. |
| `copy-button` | `text` (required): string to copy. `label` (default: "Copy") / `copiedLabel` (default: "Copied!"): button labels. Pure adapter-side — no dispatch, no server round-trip. Clipboard write via `navigator.clipboard.writeText`; falls back to `execCommand("copy")` on insecure context; silent on both failures. |

### Action payload shapes

Every dispatch is `multipart/form-data`. The action JSON travels in `_action`; the current state in `_state`; uploaded files travel as additional form entries keyed by field name.

| User action | `_action` payload |
|---|---|
| Submit form | `{ name, context: { field1: "val", …, …baked-context } }` |
| Click button | `{ name, context: { …button's baked-in context } }` |
| Check/uncheck checkbox | `{ name, context: { …checkbox context, checked: true/false } }` |
| Click tab | `{ name, context: { …action context, value: "tab-value" } }` |
| Press Enter in field with `action` | `{ name, context: { …field context, [fieldName]: currentValue } }` |
| Click sortable header | `{ name: sortAction.name, context: { column, direction: "asc"/"desc" } }` |
| Press Enter in column filter | `{ name: filterAction.name, context: { column, value, filters: { col1: "...", col2: "..." } } }` |
| Click table row with `action` | the row's `action` verbatim |
| Click modal close | the modal's `dismissAction` verbatim |

### CSS classes emitted by BrowserAdapter

| Node | Classes |
|---|---|
| page | `.vms-page`, `.vms-page__title`, `.vms-page--compact`, `.vms-page--split`, `.vms-page--cards`, `.vms-page--sidebar` |
| section | `.vms-section`, `.vms-section__heading`, `.vms-section--card`, `.vms-section--split`, `.vms-section--cards`, `.vms-section--sidebar` |
| list | `.vms-list` |
| list-item | `.vms-list-item`, `.vms-list-item--{variant}` (shipped defaults incl. `.vms-list-item--active` selection highlight) |
| form | `.vms-form`, `.vms-form--inline` |
| field | `.vms-field`, `.vms-field__label`, `.vms-field__input` (hidden fields render bare) |
| checkbox | `.vms-checkbox`, `.vms-checkbox__input`, `.vms-checkbox__mark`, `.vms-checkbox__label` |
| button | `.vms-button`, `.vms-button--{variant}` |
| text | `.vms-text`, `.vms-text--{style}` |
| link | `.vms-link` |
| stat-bar | `.vms-stat-bar`, `.vms-stat-bar__item`, `.vms-stat-bar__value`, `.vms-stat-bar__label` |
| tabs | `.vms-tabs`, `.vms-tabs__tab`, `.vms-tabs__tab--active` |
| progress | `.vms-progress`, `.vms-progress__bar` |
| modal | `.vms-modal-backdrop`, `.vms-modal`, `.vms-modal__header`, `.vms-modal__title`, `.vms-modal__close`, `.vms-modal__body`, `.vms-modal__footer` |
| table | `.vms-table-wrapper`, `.vms-table`, `.vms-table__th`, `.vms-table__th--sortable`, `.vms-table__th--asc`, `.vms-table__th--desc`, `.vms-table__filter-row`, `.vms-table__filter-input`, `.vms-table__row`, `.vms-table__row--{variant}`, `.vms-table__row--clickable`, `.vms-table__td`, `.vms-table__link` |
| copy-button | `.vms-button` |

The framework emits class names; the shipped `viewmodel-shell/styles/default.css` styles them. Apps import `styles.css` (+ optionally one theme) and author zero page CSS — see *Design system* below for how, when to reach for each layout preset, and the only sanctioned override seam.

---

## Design system

The framework ships a serviceable look. The app does **not** hand-roll page CSS — it imports the stylesheet, optionally pins a theme, and (rarely) overrides a token. The live `demo/Showcase/` is the single source of truth for this section; every demo under `demo/` is a worked example of the real-app pattern below.

### Serviceable by default

Import the shipped stylesheet plus, optionally, one theme. The `.vms-page` shell + the `default.css` body rule own reset, centering, `--vms-page-max` width, background, and font — no app CSS, no `<style>` block, zero `@media`:

```typescript
import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css"; // optional — pick one
```

12 shipped themes (one import each): `dark-blue`, `dark-green`, `dark-rose`, `dark-amber`, `dark-teal`, `dark-purple`, `light-purple`, `light-blue`, `light-green`, `light-rose`, `light-amber`, `light-teal`. The shipped **default** (no theme import) is the `light-purple` value set. The prior dark default is exactly one import away — `import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css";` reproduces it byte-for-byte. A theme is one static import in your entrypoint (see `demo/ContactManager/frontend/src/main.ts`); multi-role apps import a distinct theme per role through the same seam (see `demo/HelpDesk/frontend/src/agent.ts` vs `requester.ts`).

### The `--vms-*` override seam — override the token, don't hand-roll

The **only** sanctioned per-app deviation: a tiny per-app stylesheet with a single `:root{}` setting `--vms-*` tokens, imported in your entrypoint **after** the theme — **never** an HTML `<style>` block. Use it for a width retune (`--vms-page-max`), branded fonts (`--vms-font-body` / `--vms-font-head` / `--vms-font-mono`), or any `--vms-*` color var for a full reskin. The 12 theme files are the reskin reference; this seam is additive — never remove or rename a `--vms-*` var.

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
- **`getRequestHeaders` hook.** `ShellOptions.getRequestHeaders?: () => Record<string, string> | Promise<Record<string, string>>` is called before every `load()` and `dispatch()` request and merged into the headers. Use this for auth tokens, ASP.NET anti-forgery tokens (`RequestVerificationToken` header), or any other custom headers.

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
        // Read context with helpers, switch on payload.Name, produce new state via `with`:
        switch (payload.Name)
        {
            case "your-action":
                state = state with { /* changes */ };
                break;
            default: return BadRequest($"Unknown action: {payload.Name}");
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

Unknown `type` values are silently ignored by the shell — forward-compatible if new effect types are added later.

Wire format:
```json
{
  "sideEffects": [{ "type": "set-local-storage", "key": "hecate_jwt", "value": "eyJ..." }],
  "redirect": "/app"
}
```

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
{ "name": "add", "context": { "title": "X" }, "state": { ... } }
```

`curl --json '{"name":"poll","state":{...}}' /api/your/action` just works. File-bearing actions still need multipart — JSON support is an opt-in convenience, not a replacement.

### ShellResponse&lt;TState&gt; reference

Every field except `Vm` and `State` is optional. The combination determines what the shell does on receipt:

| Field | Type | Effect |
|---|---|---|
| `Vm` | `ViewNode?` | The view tree to render. Omit (null) when redirecting. |
| `State` | `TState?` | The new client state. Omit (null) when redirecting. |
| `Redirect` | `string?` | When set, the shell navigates to this URL instead of re-rendering. `Vm` and `State` are ignored. |
| `SideEffects` | `IReadOnlyList<ShellSideEffect>?` | Applied in order before redirect/render. Built-in types: `"set-local-storage"`, `"set-session-storage"`. Unknown types are silently ignored (forward-compatible). |
| `NextPollIn` | `int?` (ms) | Schedules the next poll at this delay. Falls back to `ShellOptions.pollInterval` if omitted. **Omit on a response with no `pollInterval` set to stop polling.** See the polling section for the fast-completion footgun. |

Factory methods on `ShellResponse<TState>`:
- `ShellResponse<T>.RedirectTo(url)` — redirect response with `Vm`/`State` null.
- `response.WithEffect(ShellSideEffect.SetLocalStorage(key, value))` — fluent side-effect append.

`ShellSideEffect` factories: `SetLocalStorage(key, value)`, `SetSessionStorage(key, value)`.

### TypeScript backend pattern

For Node/Bun/Deno/Cloudflare Workers backends, the `@ashley-shrok/viewmodel-shell/server` subpath mirrors the C# NuGet package — same wire format, same shapes, written in TypeScript. Use this when your team is end-to-end TypeScript and prefers a single language over the .NET reference backend.

```typescript
import {
  createAction,
  shellRedirect,
  shellSideEffect,
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
        sideEffects: [shellSideEffect.setLocalStorage("jwt", payload.context?.token as string)],
      };
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
    YourController ctrl, YourState state, string name,
    Dictionary<string, JsonElement>? ctx = null)
{
    var actionJson = JsonSerializer.Serialize(new { name, context = ctx });
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

## Demo apps (read these before writing new code)

All under `demo/`. Patterns are consistent across them.

| Demo | What it demonstrates |
|---|---|
| `Tasks/` | Simplest full example: list, form, tabs, checkbox, progress, stat-bar |
| `ContactManager/` | Multi-view navigation, search-on-Enter field action, email + textarea fields |
| `ExpenseTracker/` | Multiple tab groups on one page, section grouping, number field, per-category progress bars |
| `RetroBoard/` | Multiple forms and lists on one page, conditional checkboxes, dynamic button labels |
| `HelpDesk/` | Two-role app (requester + agent), SQLite persistence, conditional form shape based on tab selection, `error` text style for inline validation, `secondary` button variant, persistent data + UI state separation, multi-page Vite config |

---

## Conventions for evolving the framework

- **Don't add features the framework doesn't have a clean place for.** When a request would require a workaround, that's usually a signal that the framework needs a new primitive — ask before patching around it.
- **All demo `ViewModels.cs` copies must stay in sync.** When adding a new node type or changing the wire format, update all five copies (Tasks, HelpDesk, ExpenseTracker, ContactManager, RetroBoard).
- **Test suites are non-negotiable.** Every framework change keeps the existing tests green and adds tests for new behavior.
- **The core stays platform-agnostic — and it is enforced, not trusted.** `viewmodel-shell/src/index.ts` must reference zero platform globals. A new platform side-effect goes behind a capability verb on the `Adapter` interface (and into `BrowserAdapter`), never into core. `npm run check:core-globals` (the `viewmodel-shell/scripts/check-core-platform-globals.mjs` guard, a gating step in `.github/workflows/parity.yml`) fails the build on any `window`/`document`/`localStorage`/`sessionStorage`/`XMLHttpRequest` reference in core — run it before you push. A capability that has no safe core default (like `navigate`/`storage`) must fail loudly when its adapter method is absent, never silently no-op. See *The capability seam* under Architecture.
