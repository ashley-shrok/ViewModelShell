namespace Reorder.Controllers;

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
        return new ShellResponse<ReorderState>(BuildVm(state), state).Validate();
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<ReorderState>> Action()
    {
        var payload = ActionPayload<ReorderState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        var state = payload.State;
        var name = payload.Name;

        // Phase 6 (WIRE-07) — per-item identity is encoded in the action name.
        if (name.StartsWith("move-start-"))
        {
            var id = name["move-start-".Length..];
            state = state with { MovingId = id };
        }
        else if (name == "move-cancel")
        {
            state = state with { MovingId = null };
        }
        else if (name.StartsWith("move-before-"))
        {
            var beforeId = name["move-before-".Length..];
            if (state.MovingId != null && beforeId != state.MovingId)
            {
                var moving = state.Items.FirstOrDefault(i => i.Id == state.MovingId);
                if (moving is not null)
                {
                    var rest = state.Items.Where(i => i.Id != state.MovingId).ToList();
                    var idx  = rest.FindIndex(i => i.Id == beforeId);
                    rest.Insert(idx, moving);
                    state = state with { Items = rest, MovingId = null };
                }
                else
                {
                    state = state with { MovingId = null };
                }
            }
            else
            {
                state = state with { MovingId = null };
            }
        }
        else if (name == "move-to-end")
        {
            if (state.MovingId != null)
            {
                var moving = state.Items.FirstOrDefault(i => i.Id == state.MovingId);
                if (moving is not null)
                {
                    var rest = state.Items.Where(i => i.Id != state.MovingId).ToList();
                    rest.Add(moving);
                    state = state with { Items = rest, MovingId = null };
                }
            }
        }
        else
        {
            return BadRequest($"Unknown action: {name}");
        }

        return new ShellResponse<ReorderState>(BuildVm(state), state).Validate();
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
                        new ActionDescriptor($"move-before-{item.Id}"),
                        "primary"),
                ]));
            }
            else
            {
                listItems.Add(new ListItemNode(item.Id, null,
                [
                    new TextNode(item.Label, null),
                    new ButtonNode("Move",
                        new ActionDescriptor($"move-start-{item.Id}"),
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
