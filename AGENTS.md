# ViewModel Shell — Agent Briefing

## What this is

ViewModel Shell is a server-driven UI framework for ASP.NET Core. The server returns a JSON tree of typed nodes describing both data and structure. A thin TypeScript client renders that tree to DOM with no app-specific code. Every user interaction dispatches a semantic action (`{ name, context }`) to a single POST endpoint; the server handles it and returns a fresh tree. The browser never owns state.

The key property for agent workflows: both the C# logic (what goes in the ViewModel tree) and the TypeScript rendering (how nodes become DOM) are fully testable with normal unit tests — no browser, no Playwright, no running server needed.

## Repository layout

```
C:\requests\mvc-agent-framework\
  viewmodel-shell\src\
    index.ts          — core: ViewNode types, ActionEvent, Adapter interface, ViewModelShell class
    browser.ts        — BrowserAdapter: renders every node type to DOM
  demo\
    Tasks\
      AspNetCore\       — tasks-app backend (ASP.NET Core 9)
      AspNetCore.Tests\ — C# tests (xUnit)
      frontend\         — Vite + TypeScript frontend, adapter tests (Vitest + jsdom)
    ContactManager\
    ExpenseTracker\
    RetroBoard\
```

Read any file in this repo to understand patterns before writing new code.

## Files to copy into a new app

**Two TypeScript files (entire frontend framework):**
- `C:\requests\mvc-agent-framework\viewmodel-shell\src\index.ts`
- `C:\requests\mvc-agent-framework\viewmodel-shell\src\browser.ts`

**One C# file (entire backend framework):**
- `C:\requests\mvc-agent-framework\demo\Tasks\AspNetCore\ViewModels.cs`

No NuGet packages or npm packages required — only `System.Text.Json` on the C# side, and the two TS files on the frontend side.

## Backend wiring (Program.cs)

```csharp
builder.Services.AddControllers()
    .AddJsonOptions(o =>
        o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

builder.Services.AddSingleton<YourStateRegistry>();

app.UseDefaultFiles();
app.UseStaticFiles();
app.MapControllers();
app.MapFallbackToFile("index.html");
```

Full example: `C:\requests\mvc-agent-framework\demo\Tasks\AspNetCore\Program.cs`

## MSBuild target (.csproj)

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

Adjust `WorkingDirectory` to point at the frontend folder. Full example: `C:\requests\mvc-agent-framework\demo\Tasks\AspNetCore\ViewModelShell.csproj`

## Controller pattern

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
    public ActionResult<ViewNode> Get() => BuildViewModel();        // NOT Ok(BuildViewModel())

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

        return BuildViewModel();    // NOT Ok(BuildViewModel())
    }

    private ViewNode BuildViewModel() { ... }
}
```

Full example: `C:\requests\mvc-agent-framework\demo\Tasks\AspNetCore\TasksController.cs`

## CRITICAL: always return BuildViewModel() directly, never Ok(BuildViewModel())

`Ok()` routes through `ActionResult → ActionResult<T>` which leaves `DeclaredType = null`. The JSON serializer then uses the runtime type (`PageNode`) instead of the declared type (`ViewNode`), skipping `[JsonPolymorphic]` and omitting `"type"` from the root node. The TypeScript switch matches nothing and the page renders blank with no error.

## CRITICAL: never name a local variable `checked`

`checked` is a reserved C# keyword. Use `isChecked` instead.

## Per-tab state isolation

Each browser tab generates a random ID on load and sends it as `?tab=<id>` on every request. The server uses a `ConcurrentDictionary<string, TState>` registry to look up or create state per tab. The ID is a plain module-level `const` (not `sessionStorage`), so it resets on page refresh — ephemeral by default.

Pattern: `C:\requests\mvc-agent-framework\demo\Tasks\AspNetCore\TaskStoreRegistry.cs`

## Frontend setup

**vite.config.ts** — use regex aliases (not string keys) for both entries:

```typescript
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: [
      { find: /^viewmodel-shell\/browser$/, replacement: resolve(__dirname, "<path>/browser.ts") },
      { find: /^viewmodel-shell$/, replacement: resolve(__dirname, "<path>/index.ts") },
    ],
  },
  build: { outDir: "<path-to-wwwroot>", emptyOutDir: true },
  test: { environment: "jsdom" },
});
```

String key `"viewmodel-shell"` prefix-matches `"viewmodel-shell/browser"` and breaks the subpath import. Always use regex.

Full example: `C:\requests\mvc-agent-framework\demo\Tasks\frontend\vite.config.ts`

**tsconfig.json** — add matching `paths` entries so the language server resolves imports.

Full example: `C:\requests\mvc-agent-framework\demo\Tasks\frontend\tsconfig.json`

**main.ts:**

```typescript
import { ViewModelShell } from "viewmodel-shell";
import { BrowserAdapter } from "viewmodel-shell/browser";

const tabId = Math.random().toString(36).slice(2, 10);
const container = document.getElementById("app")!;

const shell = new ViewModelShell({
  endpoint: `/api/your-feature?tab=${tabId}`,
  actionEndpoint: `/api/your-feature/action?tab=${tabId}`,
  adapter: new BrowserAdapter(container),
  onLoading: (loading) => document.body.classList.toggle("is-loading", loading),
  onError: (err) => { /* show error banner */ },
});

shell.load();
```

Full example: `C:\requests\mvc-agent-framework\demo\Tasks\frontend\src\main.ts`

## CSS class names emitted by BrowserAdapter

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
| table | `.vms-table-wrapper`, `.vms-table`, `.vms-table__th`, `.vms-table__th--sortable`, `.vms-table__th--asc`, `.vms-table__th--desc`, `.vms-table__filter-row`, `.vms-table__filter-input`, `.vms-table__row`, `.vms-table__row--{variant}`, `.vms-table__row--clickable`, `.vms-table__td`, `.vms-table__link` |

Style them however you like. The demo's full CSS is in `C:\requests\mvc-agent-framework\demo\Tasks\frontend\index.html`.

## What the server sees for each interaction

Every dispatch is sent as `multipart/form-data` with a single `_action` field carrying the
JSON payload below. File-input values travel as additional form entries (keyed by field name).

| User action | `_action` payload |
|---|---|
| Submit form | `{ name: "action", context: { field1: "val", field2: "val", … } }` (selects, hidden, time, datetime-local all collected; files travel separately as form entries) |
| Click button | `{ name: "action", context: { ...button's baked-in context } }` |
| Check/uncheck checkbox | `{ name: "action", context: { ...checkbox context, checked: true/false } }` |
| Click tab | `{ name: "action", context: { value: "tab-value" } }` |
| Press Enter in field with `action` | `{ name: "action", context: { ...field context, [fieldName]: currentValue } }` |
| Click table column header (sortable) | `{ name: "sortAction", context: { column, direction: "asc"/"desc" } }` |
| Press Enter in column filter input | `{ name: "filterAction", context: { column: "key", value: "text", filters: { col1: "…", col2: "…" } } }` |
| Click table row with `action` | the row's `action` verbatim |
| Click modal close button | the modal's `dismissAction` verbatim |

## Testing

**Frontend:** `cd <frontend-dir> && npx vitest run`
Tests use `BrowserAdapter` directly with jsdom — no HTTP, no server, no browser.
Pattern: `C:\requests\mvc-agent-framework\demo\Tasks\frontend\src\adapter.test.ts`

**Backend:** `cd <test-project-dir> && dotnet test`
Tests call controller methods directly with a real `DefaultHttpContext` — no HTTP stack.

Test project setup:
- `C:\requests\mvc-agent-framework\demo\Tasks\AspNetCore.Tests\AspNetCore.Tests.csproj`
- Add `global using Xunit;` to `GlobalUsings.cs` (not auto-imported even with ImplicitUsings)
- Use `<FrameworkReference Include="Microsoft.AspNetCore.App" />` to access `DefaultHttpContext`

Controller test wiring (action endpoint reads from `Request.Form`, so tests serialise the
payload to a form field):
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
```

Use `Act(ctrl, "your-action", Ctx(new { id = "42" }))` instead of `ctrl.Action(new ActionPayload(...))`.

Full examples:
- `C:\requests\mvc-agent-framework\demo\HelpDesk\AspNetCore.Tests\RequesterControllerTests.cs`
- `C:\requests\mvc-agent-framework\demo\HelpDesk\AspNetCore.Tests\AgentControllerTests.cs`
