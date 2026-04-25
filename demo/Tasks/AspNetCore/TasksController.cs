namespace ViewModelShell.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ViewModelShell.Services;
using ViewModelShell.ViewModels;

[ApiController]
[Route("api/tasks")]
public class TasksController(TaskStoreRegistry registry) : ControllerBase
{
    private TaskStore Store => registry.GetOrCreate(
        Request.Query.TryGetValue("tab", out var t) ? t.ToString() : "default"
    );

    [HttpGet]
    public ActionResult<ViewNode> Get() => BuildViewModel();

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ViewNode> Action()
    {
        var payload = ActionPayload.Parse(Request.Form["_action"].ToString());

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

        switch (payload.Name)
        {
            case "add":
                var title = Str("title");
                if (string.IsNullOrWhiteSpace(title)) return BadRequest("title required");
                Store.Add(title.Trim());
                break;

            case "toggle":
                var toggleId  = Str("id");
                var isChecked = Bool("checked");
                if (toggleId != null && isChecked.HasValue) Store.SetCompleted(toggleId, isChecked.Value);
                break;

            case "delete":
                var deleteId = Str("id");
                if (deleteId != null) Store.Delete(deleteId);
                break;

            case "filter":
                var value = Str("value");
                if (value != null) Store.SetFilter(value);
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return BuildViewModel();
    }

    private ViewNode BuildViewModel()
    {
        var filter = Store.GetFilter();
        var all    = Store.GetAll();

        var filtered = filter switch
        {
            "active"    => all.Where(t => !t.Completed),
            "completed" => all.Where(t => t.Completed),
            _           => all.AsEnumerable()
        };

        var total     = all.Count;
        var completed = all.Count(t => t.Completed);
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
                    Selected: filter,
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
