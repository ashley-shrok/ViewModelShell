# Migration Guide: Stateless Server Architecture

This guide is for apps already built on the previous per-tab server-state pattern. The framework was rearchitected so the server is a pure transformer: client carries its own UI state, server applies the action and returns the new state. The per-tab `ConcurrentDictionary` registry, the random tab ID, and the `?tab=` query parameter are all gone.

If you have an app on the old pattern, follow this guide to migrate.

---

## Why this changed

The old per-tab pattern leaked state into server memory unboundedly, lost everything on restart, and didn't scale across multiple server instances. The new architecture pushes UI state to the client and keeps only persistent/shared data (databases, files) on the server. The wire format is a small extension of what was already there.

**Boundary rule:** anything per-tab and transient (current view, filter, selected ID, validation error, in-progress form data) → client. Anything persistent or shared between users (database rows, files, anything multi-user) → server.

---

## Wire format changes

### GET (page load)
**Before:**
```
GET /api/foo?tab=<random-id> → ViewNode
```

**After:**
```
GET /api/foo → { vm: ViewNode, state: <app-defined state record> }
```

### POST (action dispatch)
**Before** (multipart form):
```
_action: { name, context }
<file fields>: <File>
```

**After** (multipart form):
```
_action: { name, context }
_state:  <current state record as JSON>
<file fields>: <File>
```

Response on both endpoints is now `{ vm, state }`. The frontend framework round-trips this automatically; apps don't manage state plumbing.

---

## Migration checklist

### 1. Update `ViewModels.cs`

Replace the non-generic `ActionPayload`:

**Before:**
```csharp
public record ActionPayload(
    string Name,
    Dictionary<string, JsonElement>? Context = null
)
{
    public static ActionPayload Parse(string json) => /* ... */;
}
```

**After:**
```csharp
public record ActionPayload<TState>(
    string Name,
    Dictionary<string, JsonElement>? Context,
    TState State
)
{
    private static readonly JsonSerializerOptions _parseOpts =
        new() { PropertyNameCaseInsensitive = true };

    public static ActionPayload<TState> Parse(string actionJson, string stateJson)
    {
        var actionDoc = JsonSerializer.Deserialize<JsonElement>(actionJson, _parseOpts);
        var name = actionDoc.GetProperty("name").GetString()!;
        var context = actionDoc.TryGetProperty("context", out var ctxEl)
                      && ctxEl.ValueKind == JsonValueKind.Object
            ? ctxEl.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone())
            : null;
        var state = JsonSerializer.Deserialize<TState>(stateJson, _parseOpts)!;
        return new ActionPayload<TState>(name, context, state);
    }
}

public record ShellResponse<TState>(ViewNode Vm, TState State);
```

### 2. Define a state record

Move every field that was on your per-tab state class onto a JSON-round-trippable record. Use `IReadOnlyList<T>` for collections so `with` expressions and collection-expression spreads compose naturally:

```csharp
public record YourState(
    IReadOnlyList<YourItem> Items,
    string CurrentView,
    string? SelectedId,
    string? ValidationError
)
{
    public static YourState Initial() => new(
        Items: [/* seed data */],
        CurrentView: "list",
        SelectedId: null,
        ValidationError: null
    );
}
```

For apps with persistent data (database, files), only put **UI state** in this record. Persistent data stays in singleton services.

### 3. Delete the registry class

Delete the `*StateRegistry` class entirely (the `ConcurrentDictionary<string, TState>` wrapper). It has no replacement — state isolation now comes from each client carrying its own state.

If you had a service class with mutation methods (`Add`, `Update`, `Delete`), you can either delete it and inline the logic into the controller as `state with { ... }` expressions, or keep it as static helpers that take state in and return new state. The demos delete it.

### 4. Rewrite the controller

The controller becomes a pure function of `(state, action) → (newState, view)`:

**Before:**
```csharp
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
        // ... mutate Store directly via methods
        return BuildViewModel();
    }
}
```

**After:**
```csharp
public class YourController : ControllerBase    // no registry injected
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
        switch (payload.Name)
        {
            case "your-action":
                state = state with { /* immutable update */ };
                break;
            default: return BadRequest($"Unknown action: {payload.Name}");
        }

        return new ShellResponse<YourState>(BuildVm(state), state);
    }

    private static ViewNode BuildVm(YourState state) => /* pure function */;
}
```

For apps with **persistent data**: keep the DB/file service injected; only the per-tab state goes away.

```csharp
public class YourController(YourDb db) : ControllerBase
{
    // ... reads/writes go through db; UI state still on the YourState record
}
```

### 5. Validation: state field, not BadRequest

Move user-facing validation into the state record:

**Before:**
```csharp
case "create":
    if (string.IsNullOrWhiteSpace(title)) return BadRequest("title required");
    /* ... */
```

**After:**
```csharp
case "create":
    if (string.IsNullOrWhiteSpace(title))
    {
        state = state with { ValidationError = "Title is required." };
        break;
    }
    state = state with { ValidationError = null /* and proceed */ };
```

Then `BuildVm` includes `new TextNode(state.ValidationError, "error")` when non-null. Reserve `BadRequest` for malformed/programmatic input the user can't see (missing required action fields, unknown action names).

### 6. Update `Program.cs`

Remove the registry registration. Persistent-data singletons stay.

```diff
- builder.Services.AddSingleton<YourStateRegistry>();
```

### 7. Update the frontend `main.ts`

Drop the tab ID and the query parameter:

```diff
- const tabId = Math.random().toString(36).slice(2, 10);
  const shell = new ViewModelShell({
-   endpoint: `/api/your-feature?tab=${tabId}`,
-   actionEndpoint: `/api/your-feature/action?tab=${tabId}`,
+   endpoint: `/api/your-feature`,
+   actionEndpoint: `/api/your-feature/action`,
    /* ... */
  });
```

The shell handles state internally — no app-level changes needed.

### 8. Update tests

Tests no longer instantiate registries or pass tab params. They construct controllers, build a state record, serialize state + action into form fields, call `Action()`, and assert on the returned `ShellResponse<TState>`:

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

private static ShellResponse<YourState> Ok(ActionResult<ShellResponse<YourState>> result) =>
    result.Value ?? throw new XunitException("Expected a value");
```

Multi-step test pattern — thread state through each step:

```csharp
var step1 = Ok(Act(ctrl, YourState.Initial(), "first-action"));
var step2 = Ok(Act(ctrl, step1.State, "second-action", Ctx(new { /* … */ })));
Assert.Equal(/* expected */, step2.State.SomeField);
```

Tests that previously verified state mutations by re-reading from the registry now assert directly on `result.Value!.State`.

For DB-backed apps, the in-memory SQLite anchor pattern is unchanged.

### 9. Update the framework files

If you embed the framework files directly (rather than as a copy), pull the latest:

- `viewmodel-shell/src/index.ts` — adds `currentState`, parses `{ vm, state }` from responses, sends `_state` form field on dispatch, exposes `getCurrentState()`
- `viewmodel-shell/src/browser.ts` — unchanged
- `demo/Tasks/AspNetCore/ViewModels.cs` — adds `ShellResponse<TState>`, replaces `ActionPayload` with `ActionPayload<TState>`

---

## Persistent-vs-UI-state checklist

For apps with both, draw the line carefully:

| Field | Where it lives |
|---|---|
| Current view, navigation breadcrumb | Client state |
| Filter, sort, pagination cursor | Client state |
| Selected/expanded item IDs | Client state |
| In-progress form values, "creating" flags | Client state |
| Validation error messages | Client state |
| Toast/flash flags ("saved", "deleted") | Client state |
| User-authored content (tickets, posts, comments) | Server (DB) |
| User identity, permissions, role | Server (auth context, re-checked every request) |
| File uploads after persistence | Server (file storage) |
| Anything multi-user or audit-relevant | Server |

A useful sanity check: if a malicious client tampered with this field, would it matter? If yes, server. If no (they can already see and change their own UI), client.

---

## Reference migrations

For complete before/after diffs, see the demos in this repository — all five were migrated together using this guide:

- `demo/Tasks/` — simplest case, no DB
- `demo/HelpDesk/` — full hybrid: SQLite singleton + per-controller UI state records
