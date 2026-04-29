# ViewModel Shell — Agent Briefing

## What this is

A server-driven UI framework. The server returns a JSON tree of typed nodes describing both data and structure; a thin TypeScript client renders it to DOM with no app-specific code. Every interaction dispatches `{ name, context }` as `multipart/form-data` to a single POST endpoint and the server returns a fresh tree. The browser never owns state.

The framework is small enough to copy by hand:

| File | Role |
|---|---|
| `viewmodel-shell/src/index.ts` | Core: ViewNode types, ActionEvent, Adapter interface, ViewModelShell class |
| `viewmodel-shell/src/browser.ts` | BrowserAdapter — renders every node type to DOM |
| `demo/Tasks/AspNetCore/ViewModels.cs` | Backend node records + ActionPayload |

No NuGet or npm packages required — just `System.Text.Json` on the C# side and the two TS files on the frontend side. Copy the C# file into the new project and update the namespace.

The framework is actively developed. **If your app needs a node type, input type, text style, or interaction that doesn't exist — ask rather than working around it.** Workarounds accumulate technical debt and usually indicate a gap worth closing properly.

---

## Critical gotchas (read first)

These are the bugs that take hours to find:

1. **Always `return BuildViewModel()` directly — never `return Ok(BuildViewModel())`.** `Ok()` leaves `DeclaredType = null` on the `ActionResult<T>`; the serializer falls back to the runtime type, skips `[JsonPolymorphic]`, omits `"type"` from the root node, and the page renders blank with no error.

2. **Never name a local variable `checked`** — it's a reserved C# keyword. Use `isChecked`.

3. **Use regex aliases, not string keys, in `vite.config.ts`.** A string key `"viewmodel-shell"` prefix-matches `"viewmodel-shell/browser"` and breaks the subpath import. Always use `/^viewmodel-shell$/` and `/^viewmodel-shell\/browser$/`.

4. **Inline validation should return the ViewModel with an error TextNode, not `BadRequest`.** Store a `ValidationError` string in per-tab state, set it on failure, clear on success, include `new TextNode(state.ValidationError, Style: "error")` in the form when non-null. See `demo/HelpDesk/AspNetCore/RequesterController.cs`.

5. **Tests need `global using Xunit;` in `GlobalUsings.cs`** (not auto-imported even with `ImplicitUsings`) and `<FrameworkReference Include="Microsoft.AspNetCore.App" />` to access `DefaultHttpContext`.

---

## Node types

| Type | Notes |
|---|---|
| `page` | Root container with optional title |
| `section` | Grouped content with optional heading |
| `list`, `list-item` | Containers; `variant` on item becomes `vms-list-item--{variant}` |
| `form` | Form with submit action; collects all input/textarea/select/file values on submit |
| `field` | `inputType`: `text`, `email`, `password`, `number`, `date`, `time`, `datetime-local`, `textarea`, `hidden`, `file`, `select`, `select-multiple`. Selects use `options: [{ value, label }]`. Multi-select submits comma-joined. |
| `checkbox` | Dispatches immediately on change with `{ checked: bool }` merged into context |
| `button` | `variant`: `primary`, `secondary`, `danger` |
| `text` | `style`: `heading`, `subheading`, `body`, `muted`, `strikethrough`, `error`, `pre` (renders as `<pre>` for monospace/whitespace-preserving output) |
| `link` | `<a class="vms-link">`; `external: true` adds `target="_blank" rel="noopener noreferrer"` |
| `stat-bar` | Row of label/value items |
| `tabs` | Dispatches immediately on click with `{ value: tab.value }` merged into context |
| `progress` | 0–100 |
| `modal` | Optional title + body children + `dismissAction`. No backdrop-click dismissal, no focus management — these are intentional design choices. A modal with no `dismissAction` is non-dismissible by client-side interaction; the dev must include an in-modal action to close it. |
| `table` | `columns`, `rows`, optional `sortColumn`/`sortDirection`/`sortAction`. Per-column filter via `filterable: true` + `filterValue` + `filterAction` on table. Per-row `action` makes the row clickable. Column `linkLabel` + `linkExternal` renders the cell value as an anchor. |

### Action payload shapes

Every dispatch is `multipart/form-data`. The action JSON travels in a `_action` form field; uploaded files travel as additional form entries keyed by field name.

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
| modal | `.vms-modal-backdrop`, `.vms-modal`, `.vms-modal__header`, `.vms-modal__title`, `.vms-modal__close`, `.vms-modal__body` |
| table | `.vms-table-wrapper`, `.vms-table`, `.vms-table__th`, `.vms-table__th--sortable`, `.vms-table__th--asc`, `.vms-table__th--desc`, `.vms-table__filter-row`, `.vms-table__filter-input`, `.vms-table__row`, `.vms-table__row--{variant}`, `.vms-table__row--clickable`, `.vms-table__td`, `.vms-table__link` |

The framework emits class names; the app owns the CSS. Reference dark-theme stylesheets: `demo/Tasks/frontend/index.html` and `demo/HelpDesk/frontend/requester.html`.

---

## Non-obvious framework behaviors

These are already implemented — you don't need to do anything to get them, but you should know they exist:

- **Draft value preservation.** Text-like field values typed by the user survive server re-renders as long as the server doesn't explicitly set a new value for that field. Values disappear only if the field disappears from the new tree. **Hidden fields are excluded** (server is always authoritative). **File fields are excluded** but separately preserved via `DataTransfer` (see below). **Selects are excluded** — the snapshot exists to preserve typed text, and we can't safely distinguish "server set this" from "user changed it" after rendering.
- **File-input persistence.** When the user picks a file, the `File` object is held in the adapter's `fileRegistry` and re-applied to newly rendered file inputs on each render. Files survive intermediate dispatches and travel with the eventual form submission.
- **Dispatch guard.** A second action can't be dispatched while a round trip is in flight. Concurrent clicks are silently dropped. `onLoading` fires around every dispatch.
- **Focus and scroll preservation.** Focused element + caret position + scrolled containers are restored after each re-render.
- **`getRequestHeaders` hook.** `ShellOptions.getRequestHeaders?: () => Record<string, string> | Promise<Record<string, string>>` is called before every `load()` and `dispatch()` request and merged into the headers. Use this for auth tokens, ASP.NET anti-forgery tokens (`RequestVerificationToken` header), or any other custom headers.

---

## Patterns

### Per-tab state isolation

Each browser tab generates a random ID on load (a module-level `const`, not `sessionStorage` — ephemeral, resets on refresh) and sends it as `?tab=<id>` on every request. The server uses a `ConcurrentDictionary<string, TState>` registry to look up or create state per tab.

```csharp
public class YourStateRegistry
{
    private readonly ConcurrentDictionary<string, YourState> _states = new();
    public YourState GetOrCreate(string tabId) =>
        _states.GetOrAdd(tabId, _ => new YourState());
}
```

For apps with **shared data** (e.g. a database), keep that in a singleton service and only use per-tab state for UI concerns (current view, selected item, filter, validation error). See `demo/HelpDesk/AspNetCore/` for shared SQLite + per-tab UI state coexisting.

Reference: `demo/Tasks/AspNetCore/TaskStoreRegistry.cs`.

### Controller pattern

```csharp
[HttpGet]
public ActionResult<ViewNode> Get() => BuildViewModel();

[HttpPost("action")]
[Consumes("multipart/form-data")]
public ActionResult<ViewNode> Action()
{
    var payload = ActionPayload.Parse(Request.Form["_action"].ToString());
    IFormFileCollection files = Request.Form.Files; // present only when form has file fields
    // ... switch on payload.Name, mutate state, return BuildViewModel();
}
```

Full example: `demo/Tasks/AspNetCore/TasksController.cs`.

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

**Backend:** `cd <test-project-dir> && dotnet test`. Tests call controller methods directly with a real `DefaultHttpContext` — no HTTP stack. Because the action endpoint reads from `Request.Form`, tests serialize the payload into a form field via an `Act` helper rather than passing `ActionPayload` as a parameter:

```csharp
private static ActionResult<ViewNode> Act(
    YourController ctrl, string name, Dictionary<string, JsonElement>? ctx = null)
{
    var json = JsonSerializer.Serialize(new { name, context = ctx });
    ctrl.ControllerContext.HttpContext.Request.Form =
        new FormCollection(new Dictionary<string, StringValues> { ["_action"] = json });
    return ctrl.Action();
}
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
| `HelpDesk/` | Two-role app (requester + agent), SQLite persistence, conditional form shape based on tab selection, `error` text style for inline validation, `secondary` button variant, per-tab UI state separated from shared data state, multi-page Vite config |

---

## Conventions for evolving the framework

- **Don't add features the framework doesn't have a clean place for.** When a request would require a workaround, that's usually a signal that the framework needs a new primitive — ask before patching around it.
- **All demo `ViewModels.cs` copies must stay in sync.** When adding a new node type or changing `ActionPayload`, update all five copies (Tasks, HelpDesk, ExpenseTracker, ContactManager, RetroBoard). Same for shared controller patterns — when changing the dispatch contract, all controllers update together.
- **Test suites are non-negotiable.** Every framework change keeps the existing tests green and adds tests for new behavior.
