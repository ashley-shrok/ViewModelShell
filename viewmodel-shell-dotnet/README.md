# AshleyShrok.ViewModelShell

Server-driven UI framework — backend types for [@ashley-shrok/viewmodel-shell](https://www.npmjs.com/package/@ashley-shrok/viewmodel-shell).

The npm package ships a thin TypeScript adapter that renders a JSON tree of typed nodes to DOM. This NuGet package ships the matching .NET type hierarchy so an ASP.NET Core (or any .NET) app can produce the JSON contract without re-implementing it. Wire-format-aligned with the npm package — same major.minor version means same set of `ViewNode` discriminator keys.

## Install

```bash
dotnet add package AshleyShrok.ViewModelShell
```

## Use

```csharp
using ViewModelShell;

[ApiController]
[Route("api/tasks")]
public class TasksController : ControllerBase
{
    [HttpGet]
    public ShellResponse<TasksState> Get()
    {
        var state = TasksState.Initial();
        return new(BuildVm(state), state);
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<TasksState>> Action()
    {
        var payload = ActionPayload<TasksState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        var state = payload.State;
        switch (payload.Name)
        {
            case "add": state = state with { /* ... */ }; break;
            default:    return BadRequest($"Unknown action: {payload.Name}");
        }
        return new ShellResponse<TasksState>(BuildVm(state), state);
    }

    private static ViewNode BuildVm(TasksState state) =>
        new PageNode("Tasks", new ViewNode[]
        {
            new TextNode("Hello", "heading"),
            // ...
        });
}
```

## What's in the package

- The full `ViewNode` hierarchy with `[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]` + `[JsonDerivedType(...)]`: `PageNode`, `SectionNode`, `ListNode`, `ListItemNode`, `FormNode`, `FieldNode`, `CheckboxNode`, `ButtonNode`, `TextNode`, `StatBarNode`, `TabsNode`, `ProgressNode`, `ModalNode`, `TableNode`, `LinkNode`.
- Action/state primitives: `ActionDescriptor`, `ActionPayload<TState>` (with the `Parse(actionJson, stateJson)` helper), `ShellResponse<TState>`.
- Supporting records: `FieldOption`, `StatItem`, `TabItem`, `TableColumn`, `TableRow`.

All under the neutral `ViewModelShell` namespace.

## Versioning

This package's major.minor matches the npm package. A new `ViewNode` type or wire-format change bumps both sides; mismatched majors mean the discriminator keys can disagree.

## Docs

Full framework docs and the wire format reference: https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md
