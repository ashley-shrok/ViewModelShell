# ViewModel Shell — Implementation Guide for Agents

You are being asked to wire an existing ASP.NET Core app into the ViewModel Shell framework.
ViewModel Shell is a server-driven UI framework: the server returns a JSON tree of typed nodes
describing both data and structure; a thin TypeScript client renders that tree to DOM with no
app-specific code. Every user interaction dispatches `{ name, context }` to a single POST
endpoint; the server handles it and returns a fresh tree. The browser never owns state.

**The framework is still in active development.** If you need a node type, field type, text
style, or behaviour that does not exist yet, stop and ask rather than working around it. New
elements can be added quickly.

---

## Files to copy into the new app

### TypeScript (entire frontend framework — 2 files)

| File | Copy to |
|---|---|
| `C:\requests\mvc-agent-framework\viewmodel-shell\src\index.ts` | `<your-frontend>/src/viewmodel-shell/index.ts` or alias target |
| `C:\requests\mvc-agent-framework\viewmodel-shell\src\browser.ts` | `<your-frontend>/src/viewmodel-shell/browser.ts` or alias target |

### C# (entire backend framework — 1 file)

| File | Copy to |
|---|---|
| `C:\requests\mvc-agent-framework\demo\Tasks\AspNetCore\ViewModels.cs` | `<your-backend>/ViewModels.cs` |

Update the `namespace` declaration at the top to match your project.

---

## What the framework currently supports

### Node types

| Type | Purpose |
|---|---|
| `page` | Root container with optional title |
| `section` | Grouped content with optional heading |
| `list` | Unordered list container |
| `list-item` | Individual list item; `variant` is appended as a BEM modifier (`vms-list-item--{variant}`) |
| `form` | Form with a submit action and submit label; collects all input/textarea/select/file values on submit |
| `field` | Input field; `inputType`: `text`, `email`, `password`, `number`, `date`, `time`, `datetime-local`, `textarea`, `hidden`, `file`, `select`, `select-multiple`. Selects use `options: [{ value, label }]`. Multi-select submits as comma-separated string. |
| `checkbox` | Checkbox; dispatches immediately on change with `{ checked: bool }` merged into context |
| `button` | Button; `variant`: `primary`, `secondary`, `danger` |
| `text` | Static text; `style`: `heading`, `subheading`, `body`, `muted`, `strikethrough`, `error` |
| `stat-bar` | Row of label/value stat items |
| `tabs` | Tab strip; dispatches immediately on click with `{ value: tab.value }` merged into context |
| `progress` | Progress bar, value 0–100 |
| `modal` | Overlay dialog with optional title, body children, and `dismissAction` (close button rendered only when set) |
| `table` | Server-driven table with `columns`, `rows`, optional `sortColumn`/`sortDirection`/`sortAction`, optional `filterValue`/`filterAction`. Sortable headers click-to-sort; filter input dispatches on Enter. |

### How interactions reach the server

Every dispatch is sent as `multipart/form-data`. The action JSON travels in a `_action` form
field; uploaded files travel as additional form entries keyed by field name.

| User action | `_action` payload |
|---|---|
| Submit form | `{ name: "action", context: { field1: "val", …, …baked-context } }` (selects, hidden, time, datetime-local all collected; files travel as separate form entries) |
| Click button | `{ name: "action", context: { …button's baked-in context } }` |
| Check/uncheck checkbox | `{ name: "action", context: { …checkbox context, checked: true/false } }` |
| Click tab | `{ name: "action", context: { value: "tab-value" } }` |
| Press Enter in field with `action` | `{ name: "action", context: { …field context, [fieldName]: currentValue } }` |
| Click sortable table header | `{ name: "sortAction", context: { column, direction: "asc"/"desc" } }` |
| Press Enter in table filter input | `{ name: "filterAction", context: { value: filterText } }` |
| Click table row with `action` | the row's `action` verbatim |
| Click modal close button | the modal's `dismissAction` verbatim |

### Framework behaviours (already implemented)

- **Draft value preservation** — text-like field values typed by the user survive server re-renders
  as long as the server does not explicitly send a new value for that field. Values disappear only
  if the field itself disappears from the new tree. Hidden and file fields are excluded from the
  snapshot (server-authoritative for hidden; browser-restored via `DataTransfer` for file).
- **File-input persistence** — when the user picks a file, the `File` object is stored in the
  adapter and re-applied to the input on every subsequent re-render via the `DataTransfer` API,
  so files survive intermediate dispatches and travel with the eventual form submission.
- **Dispatch guard** — a second action cannot be dispatched while a round trip is in flight.
  Concurrent clicks are silently dropped. The `onLoading` callback is fired around every dispatch.
- **Focus/scroll preservation** — the focused element and its caret position, plus any scrolled
  containers, are restored after each re-render.

---

## Reference demos (read these before writing new code)

All demos are at `C:\requests\mvc-agent-framework\demo\`. Read any that are relevant before
writing new code — patterns are consistent across them.

| Demo | What it demonstrates |
|---|---|
| `Tasks\` | Simplest full example: list, form, tabs, checkbox, progress, stat-bar |
| `ContactManager\` | Multi-view navigation, search-on-Enter field action, email + textarea fields |
| `ExpenseTracker\` | Multiple tab groups on one page, section grouping, number field, per-category progress bars |
| `RetroBoard\` | Multiple forms and lists on one page, conditional checkboxes, dynamic button labels |
| `HelpDesk\` | Two-role app (requester + agent), SQLite persistence, conditional form shape based on tab selection, date field, `error` text style for inline validation, `secondary` button variant, per-tab UI state separated from shared data state |

---

## Backend wiring

### Program.cs

```csharp
builder.Services.AddControllers()
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

// register your state registries and any services here

app.UseDefaultFiles();
app.UseStaticFiles();
app.MapControllers();
app.MapFallbackToFile("index.html");
```

Full example: `C:\requests\mvc-agent-framework\demo\Tasks\AspNetCore\Program.cs`

### Controller pattern

Actions are submitted as `multipart/form-data`. The action JSON travels in a form field
named `_action`; uploaded files travel as additional form entries keyed by field name.
Read the payload with `ActionPayload.Parse`:

```csharp
[ApiController]
[Route("api/your-feature")]
public class YourController(YourStateRegistry registry) : ControllerBase
{
    private YourState State => registry.GetOrCreate(
        Request.Query.TryGetValue("tab", out var t) ? t.ToString() : "default"
    );

    [HttpGet]
    public ActionResult<ViewNode> Get() => BuildViewModel();

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ViewNode> Action()
    {
        var payload = ActionPayload.Parse(Request.Form["_action"].ToString());
        IFormFileCollection files = Request.Form.Files; // present only when form has file fields

        string? Str(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.String
                ? v.GetString() : null;

        bool? Bool(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true
                ? v.ValueKind switch {
                    JsonValueKind.True  => true,
                    JsonValueKind.False => false,
                    _ => (bool?)null
                } : null;

        switch (payload.Name)
        {
            case "your-action": /* mutate State */ break;
            default: return BadRequest($"Unknown action: {payload.Name}");
        }

        return BuildViewModel();    // NEVER Ok(BuildViewModel())
    }

    private ViewNode BuildViewModel() { ... }
}
```

### CRITICAL rules

1. **Always `return BuildViewModel()` directly — never `return Ok(BuildViewModel())`.**
   `Ok()` leaves `DeclaredType = null`; the serialiser uses the runtime type instead of
   `ViewNode`, skips `[JsonPolymorphic]`, omits `"type"` from the root node, and the page
   renders blank with no error.

2. **Never name a local variable `checked`** — it is a reserved C# keyword. Use `isChecked`.

3. **Inline validation should return the ViewModel with an error TextNode**, not `BadRequest`.
   Store a `ValidationError` string in your per-tab state, set it when validation fails, clear
   it on success, and include `new TextNode(state.ValidationError, "error")` in the form when
   it is non-null. See `HelpDesk\AspNetCore\RequesterController.cs` for the full pattern.

### Per-tab state isolation

Each browser tab sends `?tab=<random-id>` on every request. Use a
`ConcurrentDictionary<string, TState>` registry to isolate UI state per tab.

```csharp
public class YourStateRegistry
{
    private readonly ConcurrentDictionary<string, YourState> _states = new();
    public YourState GetOrCreate(string tabId) =>
        _states.GetOrAdd(tabId, _ => new YourState());
}
```

Full example: `C:\requests\mvc-agent-framework\demo\Tasks\AspNetCore\TaskStoreRegistry.cs`

If the app has **shared data** (e.g. a database), keep that in a singleton service and only
use per-tab state for UI concerns (current view, selected item, filter, validation error).
See `C:\requests\mvc-agent-framework\demo\HelpDesk\AspNetCore\` for how SQLite shared state
and per-tab UI state coexist.

### MSBuild target (.csproj)

```xml
<Target Name="NpmInstall" BeforeTargets="BuildFrontend"
        Condition="!Exists('$(MSBuildProjectDirectory)/../frontend/node_modules')">
  <Exec Command="npm install" WorkingDirectory="$(MSBuildProjectDirectory)/../frontend" />
</Target>

<Target Name="BuildFrontend" BeforeTargets="Build">
  <Exec Command="npm run build" WorkingDirectory="$(MSBuildProjectDirectory)/../frontend" />
</Target>
```

Full example: `C:\requests\mvc-agent-framework\demo\Tasks\AspNetCore\ViewModelShell.csproj`

---

## Frontend setup

### vite.config.ts

Use **regex aliases** (not string keys) for both entries:

```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^viewmodel-shell\/browser$/, replacement: resolve(__dirname, "<path>/browser.ts") },
      { find: /^viewmodel-shell$/,          replacement: resolve(__dirname, "<path>/index.ts") },
    ],
  },
  build: { outDir: "<path-to-wwwroot>", emptyOutDir: true },
  test:  { environment: "jsdom" },
});
```

A string key `"viewmodel-shell"` prefix-matches `"viewmodel-shell/browser"` and breaks the
subpath import. Always use regex.

For **multi-page apps** (multiple HTML entry points), add `rollupOptions.input`:

```typescript
build: {
  rollupOptions: {
    input: {
      main:  resolve(__dirname, "index.html"),
      other: resolve(__dirname, "other.html"),
    },
  },
},
```

Full examples:
- Single-page: `C:\requests\mvc-agent-framework\demo\Tasks\frontend\vite.config.ts`
- Multi-page:  `C:\requests\mvc-agent-framework\demo\HelpDesk\frontend\vite.config.ts`

### tsconfig.json

```json
{
  "compilerOptions": {
    "paths": {
      "viewmodel-shell":         ["<path>/index.ts"],
      "viewmodel-shell/browser": ["<path>/browser.ts"]
    }
  }
}
```

Full example: `C:\requests\mvc-agent-framework\demo\Tasks\frontend\tsconfig.json`

### main.ts

```typescript
import { ViewModelShell } from "viewmodel-shell";
import { BrowserAdapter } from "viewmodel-shell/browser";

const tabId    = Math.random().toString(36).slice(2, 10);
const container = document.getElementById("app")!;

const shell = new ViewModelShell({
  endpoint:       `/api/your-feature?tab=${tabId}`,
  actionEndpoint: `/api/your-feature/action?tab=${tabId}`,
  adapter: new BrowserAdapter(container),
  onLoading: (loading) => document.body.classList.toggle("is-loading", loading),
  onError:   (err) => { /* show error banner */ },
});

shell.load();
```

Full example: `C:\requests\mvc-agent-framework\demo\Tasks\frontend\src\main.ts`

### CSS class names emitted by BrowserAdapter

| Node | Classes |
|---|---|
| page | `.vms-page`, `.vms-page__title` |
| section | `.vms-section`, `.vms-section__heading` |
| list | `.vms-list` |
| list-item | `.vms-list-item`, `.vms-list-item--{variant}` |
| form | `.vms-form` |
| field | `.vms-field`, `.vms-field__label`, `.vms-field__input` (hidden fields render bare with no wrapper) |
| checkbox | `.vms-checkbox`, `.vms-checkbox__input`, `.vms-checkbox__mark`, `.vms-checkbox__label` |
| button | `.vms-button`, `.vms-button--{variant}` |
| text | `.vms-text`, `.vms-text--{style}` |
| stat-bar | `.vms-stat-bar`, `.vms-stat-bar__item`, `.vms-stat-bar__value`, `.vms-stat-bar__label` |
| tabs | `.vms-tabs`, `.vms-tabs__tab`, `.vms-tabs__tab--active` |
| progress | `.vms-progress`, `.vms-progress__bar` |
| modal | `.vms-modal-backdrop`, `.vms-modal`, `.vms-modal__header`, `.vms-modal__title`, `.vms-modal__close`, `.vms-modal__body` |
| table | `.vms-table-wrapper`, `.vms-table__filter`, `.vms-table`, `.vms-table__th`, `.vms-table__th--sortable`, `.vms-table__th--asc`, `.vms-table__th--desc`, `.vms-table__row`, `.vms-table__row--{variant}`, `.vms-table__row--clickable`, `.vms-table__td` |

Style them however you like. Reference CSS (dark theme):
- `C:\requests\mvc-agent-framework\demo\Tasks\frontend\index.html`
- `C:\requests\mvc-agent-framework\demo\HelpDesk\frontend\requester.html` (includes `error`, `secondary`, `high`, `critical` variants)

---

## Testing

### Frontend adapter tests

Tests use `BrowserAdapter` directly with jsdom — no HTTP, no server, no browser.

```typescript
import { describe, it, expect, vi } from "vitest";
import { BrowserAdapter } from "viewmodel-shell/browser";
import type { ViewNode, ActionEvent } from "viewmodel-shell";

function render(vm: ViewNode) {
  const container = document.createElement("div");
  const adapter   = new BrowserAdapter(container);
  const onAction  = vi.fn<[ActionEvent], void>();
  adapter.render(vm, onAction);
  return { container, onAction };
}
```

Run with: `cd <frontend-dir> && npx vitest run`

Full examples:
- `C:\requests\mvc-agent-framework\demo\Tasks\frontend\src\adapter.test.ts`
- `C:\requests\mvc-agent-framework\demo\HelpDesk\frontend\src\adapter.test.ts`

### Backend controller tests

Tests call controller methods directly with a real `DefaultHttpContext` — no HTTP stack.
Because the action endpoint reads from `Request.Form`, tests serialise the payload into a
form field via the `Act` helper rather than passing `ActionPayload` as a parameter.

Test project setup:
- Add `global using Xunit;` to `GlobalUsings.cs`
- Use `<FrameworkReference Include="Microsoft.AspNetCore.App" />` to access `DefaultHttpContext`

```csharp
using Microsoft.Extensions.Primitives;

private static YourController CreateController(string tab = "test")
{
    var controller = new YourController(new YourStateRegistry());
    controller.ControllerContext = new ControllerContext {
        HttpContext = new DefaultHttpContext {
            Request = { QueryString = new QueryString($"?tab={tab}") }
        }
    };
    return controller;
}

private static ActionResult<ViewNode> Act(
    YourController ctrl, string name, Dictionary<string, JsonElement>? ctx = null)
{
    var json = JsonSerializer.Serialize(new { name, context = ctx });
    ctrl.ControllerContext.HttpContext.Request.Form =
        new FormCollection(new Dictionary<string, StringValues> { ["_action"] = json });
    return ctrl.Action();
}

private static Dictionary<string, JsonElement> Ctx(object obj)
{
    using var doc = JsonDocument.Parse(JsonSerializer.Serialize(obj));
    return doc.RootElement.EnumerateObject()
        .ToDictionary(p => p.Name, p => p.Value.Clone());
}
```

Use `Act(ctrl, "your-action", Ctx(new { id = "42" }))` in test bodies.

For apps with a database, use a named in-memory SQLite connection shared across test methods:

```csharp
public class YourControllerTests : IDisposable
{
    private readonly SqliteConnection _anchor;
    private readonly string _connStr;

    public YourControllerTests()
    {
        _connStr = $"Data Source={Guid.NewGuid():N};Mode=Memory;Cache=Shared";
        _anchor  = new SqliteConnection(_connStr);
        _anchor.Open(); // keeps the in-memory DB alive for the test class lifetime
    }

    public void Dispose() => _anchor.Dispose();
}
```

Run with: `cd <test-project-dir> && dotnet test`

Full examples:
- `C:\requests\mvc-agent-framework\demo\Tasks\AspNetCore.Tests\TasksControllerTests.cs`
- `C:\requests\mvc-agent-framework\demo\HelpDesk\AspNetCore.Tests\RequesterControllerTests.cs`
- `C:\requests\mvc-agent-framework\demo\HelpDesk\AspNetCore.Tests\AgentControllerTests.cs`

---

## Asking for framework changes

The framework is actively developed. If your app needs something that does not exist — a new
node type, a new field input type, a new text style, a new interaction pattern — **ask rather
than working around it**. Workarounds accumulate technical debt and often indicate a gap worth
closing properly.

Examples of things to ask about:
- A new input type (e.g. `radio`, `color`, `range`)
- A new node type (e.g. `badge`, `accordion`, `tooltip`)
- A new text style
- A new button variant
- A different rendering behaviour (e.g. optimistic updates, partial re-render)
