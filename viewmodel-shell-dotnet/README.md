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

The complete .NET backend type set, all under the neutral `ViewModelShell` namespace:

- The full `ViewNode` hierarchy as `record` types with `[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]` + `[JsonDerivedType(...)]` discriminators.
- The action/state primitives needed to produce the wire contract — `ActionPayload<TState>` (with `Parse` / `ParseJson`), `ShellResponse<TState>` — plus the supporting records the nodes compose from.

The single file [`viewmodel-shell-dotnet/ViewModels.cs`](https://github.com/ashley-shrok/ViewModelShell/blob/main/viewmodel-shell-dotnet/ViewModels.cs) **is** the package: it's the authoritative, always-current list of every type and prop. This README intentionally does **not** enumerate the node set, so it cannot fall out of sync with the shipped assembly — that exact mismatch (a README node list disagreeing with the DLL) was [issue #9](https://github.com/ashley-shrok/ViewModelShell/issues/9). The npm package's `dist/index.d.ts` is the matching TypeScript view of the same contract; the two are kept aligned by the repo's cross-backend parity suite.

## Versioning

This package's major.minor matches the npm package. A new `ViewNode` type or wire-format change bumps both sides; mismatched majors mean the discriminator keys can disagree.

## Docs

Full framework docs and the wire format reference: https://github.com/ashley-shrok/ViewModelShell/blob/main/AGENTS.md
