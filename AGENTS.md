# ViewModel Shell

A server-driven UI framework where the wire format is structured enough that agents can build full-stack apps without ever opening a browser and all UI tests are pure unit tests with no browser runtime. The server is a stateless transformer: it takes the client's current UI state plus an action and returns the next state plus a fresh view tree. The client (a thin TypeScript adapter) renders that tree to DOM with no app-specific code, holds the state opaquely, and round-trips it on every dispatch. Persistent/shared data (databases, files) lives server-side; transient UI state lives client-side.

The framework ships as two version-aligned packages:

| Package | Source | Use |
|---|---|---|
| [`@ashley-shrok/viewmodel-shell`](https://www.npmjs.com/package/@ashley-shrok/viewmodel-shell) (npm) | `viewmodel-shell/src/{index,browser}.ts` + `styles/` | Frontend renderer + themes |
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

---

## Node types

| Type | Notes |
|---|---|
| `page` | Root container with optional title |
| `section` | Grouped content with optional heading |
| `list`, `list-item` | Containers; `variant` on item becomes `vms-list-item--{variant}` |
| `form` | Form with submit action; collects all input/textarea/select/file values on submit |
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
| page | `.vms-page`, `.vms-page__title` |
| section | `.vms-section`, `.vms-section__heading` |
| list | `.vms-list` |
| list-item | `.vms-list-item`, `.vms-list-item--{variant}` |
| form | `.vms-form` |
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

The framework emits class names; the app owns the CSS. Reference dark-theme stylesheets: `demo/Tasks/frontend/index.html` and `demo/HelpDesk/frontend/requester.html`.

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

### Frontend wiring

```typescript
import { ViewModelShell } from "viewmodel-shell";
import { BrowserAdapter } from "viewmodel-shell/browser";

const container = document.getElementById("app")!;
const shell = new ViewModelShell({
  endpoint: `/api/your-feature`,
  actionEndpoint: `/api/your-feature/action`,
  adapter: new BrowserAdapter(container),
  onLoading: (loading) => document.body.classList.toggle("is-loading", loading),
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
