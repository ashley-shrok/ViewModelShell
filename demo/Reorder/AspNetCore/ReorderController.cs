namespace Reorder.Controllers;

using Microsoft.AspNetCore.Mvc;
using ViewModelShell;

// Reorder demo — the CANONICAL, framework-blessed way to reorder a list.
//
// TWO patterns, BOTH built from primitives that already exist (buttons + a
// modal + named actions) — ZERO new framework capability:
//
//   1. Up / Down buttons per row = fine-grained reorder WITHIN a group. The
//      first row's Up and the last row's Down are `disabled`.
//   2. A "Move…" button opens a MODAL that lists the other groups; picking one
//      RELOCATES the item to that group. This is the "move into a folder"
//      case that drag-and-drop would otherwise do.
//
// Pointer drag-and-drop is deliberately REJECTED: it is mouse-only, so an
// agent cannot drive it and keyboard users can't use it. Every reorder here is
// a discrete NAMED action, so it works identically for a human clicking, a
// keyboard user tabbing, and an agent dispatching over the wire. (If drag were
// ever added, it could only be sugar that fires these SAME actions.)
//
// Per-row identity is encoded in the action name (Phase 6 / WIRE-07): there are
// no input fields, only buttons.

public record ReorderItem(string Id, string Label, string Folder);

// Folder = which group an item lives in. Order within a group is the order of
// that group's items in the flat Items list. MoveOpenId != null = the "Move to
// another group" modal is open for that item.
public record ReorderState(
    IReadOnlyList<ReorderItem> Items,
    string? MoveOpenId
)
{
    // (key, display label), rendered top-to-bottom in this order.
    public static readonly (string Key, string Label)[] Folders =
    [
        ("backlog", "Backlog"),
        ("active",  "Active"),
        ("archive", "Archive"),
    ];

    public static ReorderState Initial() => new(
        Items:
        [
            new("a", "Alpha",   "backlog"),
            new("b", "Bravo",   "backlog"),
            new("c", "Charlie", "backlog"),
            new("d", "Delta",   "active"),
            new("e", "Echo",    "active"),
            // "archive" starts empty (shows the empty-group rendering).
        ],
        MoveOpenId: null
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
        var name  = payload.Name;
        var items = state.Items.ToList();

        if (name.StartsWith("move-up-"))
        {
            var id = name["move-up-".Length..];
            Swap(items, id, -1);
            state = state with { Items = items };
        }
        else if (name.StartsWith("move-down-"))
        {
            var id = name["move-down-".Length..];
            Swap(items, id, +1);
            state = state with { Items = items };
        }
        else if (name.StartsWith("move-open-"))
        {
            var id = name["move-open-".Length..];
            state = state with { MoveOpenId = id };
        }
        else if (name == "move-close")
        {
            state = state with { MoveOpenId = null };
        }
        else if (name.StartsWith("move-to-"))
        {
            // move-to-<folderKey>-<id> — folderKey has no hyphen, so split on
            // the first '-'.
            var rest = name["move-to-".Length..];
            var dash = rest.IndexOf('-');
            if (dash > 0)
            {
                var folderKey = rest[..dash];
                var id        = rest[(dash + 1)..];
                var idx       = items.FindIndex(i => i.Id == id);
                var valid     = ReorderState.Folders.Any(f => f.Key == folderKey);
                if (idx >= 0 && valid)
                {
                    var moving = items[idx] with { Folder = folderKey };
                    items.RemoveAt(idx);
                    items.Add(moving); // append → becomes last in its new group
                    state = state with { Items = items };
                }
            }
            state = state with { MoveOpenId = null };
        }
        else
        {
            throw new UnknownActionException(name);
        }

        return new ShellResponse<ReorderState>(BuildVm(state), state).Validate();
    }

    // Swap the item with its nearest same-folder neighbour in `dir` (-1 up, +1
    // down). No-op (clamp) if there is no neighbour in that direction.
    private static void Swap(List<ReorderItem> items, string id, int dir)
    {
        var i = items.FindIndex(x => x.Id == id);
        if (i < 0) return;
        var folder = items[i].Folder;
        for (var j = i + dir; j >= 0 && j < items.Count; j += dir)
        {
            if (items[j].Folder == folder)
            {
                (items[i], items[j]) = (items[j], items[i]);
                return;
            }
        }
    }

    private static ViewNode BuildVm(ReorderState state)
    {
        var children = new List<ViewNode>
        {
            new TextNode(
                "Reorder within a group with Up / Down. Use Move… to relocate an " +
                "item to another group. No drag-and-drop — every reorder is a named " +
                "action, so it works for keyboard users and agents too.",
                "muted"),
        };

        foreach (var (key, label) in ReorderState.Folders)
        {
            var group = state.Items.Where(i => i.Folder == key).ToList();
            ViewNode body;
            if (group.Count == 0)
            {
                body = new TextNode("(empty)", "muted");
            }
            else
            {
                var rows = new List<ViewNode>();
                for (var k = 0; k < group.Count; k++)
                {
                    var item = group[k];
                    rows.Add(new ListItemNode(item.Id, null,
                    [
                        new TextNode(item.Label, null),
                        new ButtonNode("Up",   new ActionDescriptor($"move-up-{item.Id}"),
                            Emphasis: "secondary", Size: "sm", Disabled: k == 0),
                        new ButtonNode("Down", new ActionDescriptor($"move-down-{item.Id}"),
                            Emphasis: "secondary", Size: "sm", Disabled: k == group.Count - 1),
                        new ButtonNode("Move…", new ActionDescriptor($"move-open-{item.Id}"),
                            Emphasis: "secondary", Size: "sm"),
                    ]));
                }
                body = new ListNode(rows);
            }
            children.Add(new SectionNode(label, [body], Variant: "card"));
        }

        // "Move to another group" modal (relocation). Lists every OTHER group.
        if (state.MoveOpenId != null)
        {
            var moving = state.Items.FirstOrDefault(i => i.Id == state.MoveOpenId);
            if (moving is not null)
            {
                var dests = new List<ViewNode>();
                foreach (var (key, label) in ReorderState.Folders)
                {
                    if (key == moving.Folder) continue;
                    dests.Add(new ButtonNode(label,
                        new ActionDescriptor($"move-to-{key}-{moving.Id}"),
                        Emphasis: "primary", Width: "full"));
                }
                children.Add(new ModalNode(
                    Title: $"Move “{moving.Label}” to…",
                    Children: dests,
                    // Cancel = the modal's close (X). No same-named footer button
                    // (a modal must not carry both dismissAction and a same-named
                    // footer Close — AGENTS.md gotcha).
                    DismissAction: new ActionDescriptor("move-close")));
            }
        }

        return new PageNode("Reorder", children);
    }
}
