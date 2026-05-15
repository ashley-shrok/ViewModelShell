namespace Reorder.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ViewModelShell;

public record ReorderItem(string Id, string Label);

// MovingId null = idle; set = an item is "picked up" and the list shows
// placement affordances. This is the entire reorder mechanism — no drag,
// no new framework primitives, just state + actions + ButtonNode.
public record ReorderState(
    IReadOnlyList<ReorderItem> Items,
    string? MovingId
)
{
    public static ReorderState Initial() => new(
        Items:
        [
            new("a", "Alpha"),
            new("b", "Bravo"),
            new("c", "Charlie"),
            new("d", "Delta"),
            new("e", "Echo"),
        ],
        MovingId: null
    );
}

[ApiController]
[Route("api/reorder")]
public class ReorderController : ControllerBase
{
    [HttpGet]
    public ShellResponse<ReorderState> Get()
    {
        var state = ReorderState.Initial();
        return new(BuildVm(state), state);
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<ReorderState>> Action()
    {
        var payload = ActionPayload<ReorderState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        string? Str(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.String
                ? v.GetString() : null;

        var state = payload.State;

        switch (payload.Name)
        {
            case "move-start":
                var startId = Str("id");
                if (startId != null) state = state with { MovingId = startId };
                break;

            case "move-cancel":
                state = state with { MovingId = null };
                break;

            case "move-before":
                var beforeId = Str("id");
                if (state.MovingId != null && beforeId != null && beforeId != state.MovingId)
                {
                    var moving = state.Items.First(i => i.Id == state.MovingId);
                    var rest   = state.Items.Where(i => i.Id != state.MovingId).ToList();
                    var idx    = rest.FindIndex(i => i.Id == beforeId);
                    rest.Insert(idx, moving);
                    state = state with { Items = rest, MovingId = null };
                }
                else
                {
                    state = state with { MovingId = null };
                }
                break;

            case "move-to-end":
                if (state.MovingId != null)
                {
                    var moving = state.Items.First(i => i.Id == state.MovingId);
                    var rest   = state.Items.Where(i => i.Id != state.MovingId).ToList();
                    rest.Add(moving);
                    state = state with { Items = rest, MovingId = null };
                }
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return new ShellResponse<ReorderState>(BuildVm(state), state);
    }

    private static ViewNode BuildVm(ReorderState state)
    {
        var moving = state.MovingId != null
            ? state.Items.FirstOrDefault(i => i.Id == state.MovingId)
            : null;

        var children = new List<ViewNode>
        {
            new TextNode(
                moving != null
                    ? $"Moving “{moving.Label}” — choose where to place it"
                    : "Click Move on an item, then Place to reorder.",
                moving != null ? "subheading" : "muted"),
        };

        var listItems = new List<ViewNode>();
        foreach (var item in state.Items)
        {
            if (item.Id == state.MovingId)
            {
                listItems.Add(new ListItemNode(item.Id, "moving",
                [
                    new TextNode(item.Label, "subheading"),
                    new ButtonNode("Cancel", new ActionDescriptor("move-cancel"), "secondary"),
                ]));
            }
            else if (state.MovingId != null)
            {
                listItems.Add(new ListItemNode(item.Id, null,
                [
                    new TextNode(item.Label, null),
                    new ButtonNode("Place here",
                        new ActionDescriptor("move-before", new() { ["id"] = item.Id }),
                        "primary"),
                ]));
            }
            else
            {
                listItems.Add(new ListItemNode(item.Id, null,
                [
                    new TextNode(item.Label, null),
                    new ButtonNode("Move",
                        new ActionDescriptor("move-start", new() { ["id"] = item.Id }),
                        "secondary"),
                ]));
            }
        }

        children.Add(new ListNode(listItems));

        if (state.MovingId != null)
            children.Add(new ButtonNode("Place at end",
                new ActionDescriptor("move-to-end"), "primary"));

        return new PageNode("Reorder", children);
    }
}
