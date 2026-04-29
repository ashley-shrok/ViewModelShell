namespace ViewModelShell.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ViewModelShell.State;
using ViewModelShell.ViewModels;

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

        string? Str(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.String
                ? v.GetString() : null;

        bool? Bool(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true
                ? v.ValueKind switch
                {
                    JsonValueKind.True  => true,
                    JsonValueKind.False => false,
                    _ => (bool?)null
                }
                : null;

        var state = payload.State;

        switch (payload.Name)
        {
            case "add":
                var title = Str("title");
                if (string.IsNullOrWhiteSpace(title)) return BadRequest("title required");
                var newTask = new TaskRecord(
                    Id: Guid.NewGuid().ToString("N")[..8],
                    Title: title.Trim(),
                    Completed: false,
                    CreatedAt: DateTimeOffset.UtcNow);
                state = state with { Items = [.. state.Items, newTask] };
                break;

            case "toggle":
                var toggleId  = Str("id");
                var isChecked = Bool("checked");
                if (toggleId != null && isChecked.HasValue)
                {
                    state = state with
                    {
                        Items = [.. state.Items.Select(t =>
                            t.Id == toggleId ? t with { Completed = isChecked.Value } : t)]
                    };
                }
                break;

            case "delete":
                var deleteId = Str("id");
                if (deleteId != null)
                    state = state with { Items = [.. state.Items.Where(t => t.Id != deleteId)] };
                break;

            case "filter":
                var value = Str("value");
                if (value != null) state = state with { Filter = value };
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return new ShellResponse<TasksState>(BuildVm(state), state);
    }

    private static ViewNode BuildVm(TasksState state)
    {
        var filtered = state.Filter switch
        {
            "active"    => state.Items.Where(t => !t.Completed),
            "completed" => state.Items.Where(t => t.Completed),
            _           => state.Items.AsEnumerable()
        };

        var total     = state.Items.Count;
        var completed = state.Items.Count(t => t.Completed);
        var pct       = total == 0 ? 0 : (int)Math.Round(100.0 * completed / total);

        return new PageNode(
            Title: "Tasks",
            Children:
            [
                new StatBarNode(
                [
                    new StatItem("complete", $"{completed} of {total}")
                ]),

                new FormNode(
                    SubmitAction: new ActionDescriptor("add"),
                    SubmitLabel:  "Add",
                    Children:
                    [
                        new FieldNode("title", "text", null, "Add a task…", null)
                    ]
                ),

                new TabsNode(
                    Selected: state.Filter,
                    Action:   new ActionDescriptor("filter"),
                    Tabs:
                    [
                        new TabItem("all",       "All"),
                        new TabItem("active",    "Active"),
                        new TabItem("completed", "Completed")
                    ]
                ),

                new ListNode(
                    Children: filtered
                        .OrderBy(t => t.CreatedAt)
                        .Select(t => (ViewNode)new ListItemNode(
                            Id:       t.Id,
                            Variant:  t.Completed ? "done" : null,
                            Children:
                            [
                                new CheckboxNode(
                                    Name:    "completed",
                                    Checked: t.Completed,
                                    Label:   null,
                                    Action:  new ActionDescriptor("toggle", new() { ["id"] = t.Id })
                                ),
                                new TextNode(t.Title, t.Completed ? "strikethrough" : null),
                                new ButtonNode(
                                    Label:   "Delete",
                                    Action:  new ActionDescriptor("delete", new() { ["id"] = t.Id }),
                                    Variant: "danger"
                                )
                            ]
                        ))
                        .ToList()
                ),

                new ProgressNode(pct)
            ]
        );
    }
}
