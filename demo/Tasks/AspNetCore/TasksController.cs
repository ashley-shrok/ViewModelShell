namespace ViewModelShell.Controllers;

using Microsoft.AspNetCore.Mvc;
using ViewModelShell.State;
using ViewModelShell;

[ApiController]
[Route("api/tasks")]
public class TasksController : ControllerBase
{
    [HttpGet]
    public ShellResponse<TasksState> Get()
    {
        var state = TasksState.Initial();
        return new ShellResponse<TasksState>(BuildVm(state), state).Validate();
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<TasksState>> Action()
    {
        var payload = ActionPayload<TasksState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        var state = payload.State;
        var name = payload.Name;

        // Phase 6 wire-shape break (WIRE-07): the dispatch envelope carries
        // `{name, state}` only — no `context` payload. Per-row identity moves
        // into the action name itself; values flow through `state` at the
        // input's bind path.
        if (name == "add")
        {
            var title = (state.DraftTitle ?? "").Trim();
            if (string.IsNullOrWhiteSpace(title)) return BadRequest("title required");
            var newTask = new TaskRecord(
                Id: Guid.NewGuid().ToString("N")[..8],
                Title: title,
                Completed: false,
                CreatedAt: DateTimeOffset.UtcNow);
            state = state with { Items = [.. state.Items, newTask], DraftTitle = "" };
        }
        else if (name.StartsWith("toggle-row-"))
        {
            // The renderer has already written the new `completed` boolean to
            // state at items.${i}.completed. State is the source of truth; the
            // server just acknowledges with a re-render.
        }
        else if (name.StartsWith("delete-row-"))
        {
            var id = name["delete-row-".Length..];
            state = state with { Items = [.. state.Items.Where(t => t.Id != id)] };
        }
        else if (name.StartsWith("filter-"))
        {
            var value = name["filter-".Length..];
            state = state with { Filter = value };
        }
        else
        {
            throw new UnknownActionException(name);
        }

        return new ShellResponse<TasksState>(BuildVm(state), state).Validate();
    }

    private static ViewNode BuildVm(TasksState state)
    {
        var total     = state.Items.Count;
        var completed = state.Items.Count(t => t.Completed);
        var active    = total - completed;
        var pct       = total == 0 ? 0 : (int)Math.Round(100.0 * completed / total);

        var filtered = state.Filter switch
        {
            "active"    => state.Items.Where(t => !t.Completed),
            "completed" => state.Items.Where(t => t.Completed),
            _           => state.Items.AsEnumerable()
        };

        // LEFT RAIL — Todoist-style view nav; current view = D-27 active.
        // Each nav button gets a unique action name (filter-all / filter-active
        // / filter-completed) — per-row identity-in-name, no context payload.
        ViewNode NavItem(string id, string label, int count) => new ListItemNode(
            id,
            state.Filter == id ? "active" : null,
            [new ButtonNode($"{label} ({count})", new ActionDescriptor($"filter-{id}"), null)]);

        var rail = new SectionNode("Views",
        [
            new ListNode(
            [
                NavItem("all",       "All",       total),
                NavItem("active",    "Active",    active),
                NavItem("completed", "Completed", completed),
            ])
        ], Variant: "card");

        // MAIN — progress, add, the task list.
        // Items render in CreatedAt order; the bind path uses each task's
        // index in the source state.Items[] array so the renderer writes the
        // new value into the right slot.
        var sourceItems = state.Items;
        var taskItems = filtered
            .OrderBy(t => t.CreatedAt)
            .Select(t =>
            {
                var i = -1;
                for (var k = 0; k < sourceItems.Count; k++)
                {
                    if (sourceItems[k].Id == t.Id) { i = k; break; }
                }
                if (i < 0) throw new InvalidOperationException(
                    $"Task id '{t.Id}' is in the filtered list but not in sourceItems. " +
                    "Bind paths require a valid array index.");
                return (ViewNode)new ListItemNode(
                    t.Id,
                    t.Completed ? "done" : null,
                    [
                        new CheckboxNode("completed", $"items.{i}.completed", null,
                            new ActionDescriptor($"toggle-row-{t.Id}")),
                        new TextNode(t.Title, t.Completed ? "strikethrough" : null),
                        new ButtonNode("✕",
                            new ActionDescriptor($"delete-row-{t.Id}"), Tone: "danger"),
                    ]);
            })
            .ToList();
        if (taskItems.Count == 0)
            taskItems.Add(new TextNode("Nothing here.", "muted"));

        var main = new SectionNode(null,
        [
            new TextNode($"{completed} of {total} complete", "muted"),
            new ProgressNode(pct),
            new FormNode(
                SubmitAction: new ActionDescriptor("add"),
                SubmitLabel:  "Add",
                Layout:       "inline",
                Children:
                [
                    new FieldNode("title", "text", "draftTitle", null, "Add a task…"),
                ]),
            new ListNode(taskItems),
        ]);

        return new PageNode("Tasks", [rail, main], Layout: "sidebar");
    }
}
