namespace RetroBoard.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using RetroBoard.State;
using ViewModelShell;

[ApiController]
[Route("api/retro")]
public class RetroBoardController : ControllerBase
{
    [HttpGet]
    public ShellResponse<RetroState> Get()
    {
        var state = RetroState.Initial();
        return new(BuildVm(state), state);
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<RetroState>> Action()
    {
        var payload = ActionPayload<RetroState>.Parse(
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
            case "add-card":
                var section = Str("section");
                var text    = Str("text");
                if (string.IsNullOrWhiteSpace(text)) return BadRequest("text required");
                if (section != null)
                {
                    var card = new RetroCard(
                        Id:        Guid.NewGuid().ToString("N")[..8],
                        Text:      text.Trim(),
                        Votes:     0,
                        Resolved:  false,
                        CreatedAt: DateTimeOffset.UtcNow);
                    state = AddCard(state, section, card);
                }
                break;

            case "delete-card":
                var deleteId = Str("id");
                if (deleteId != null) state = DeleteCard(state, deleteId);
                break;

            case "upvote-card":
                var upvoteId = Str("id");
                if (upvoteId != null) state = UpvoteCard(state, upvoteId);
                break;

            case "resolve-card":
                var resolveId  = Str("id");
                var isResolved = Bool("checked");
                if (resolveId != null && isResolved.HasValue)
                    state = ResolveCard(state, resolveId, isResolved.Value);
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return new ShellResponse<RetroState>(BuildVm(state), state);
    }

    private static RetroState AddCard(RetroState s, string section, RetroCard card) => section switch
    {
        "went-well"     => s with { WentWell    = [.. s.WentWell, card] },
        "didnt-go-well" => s with { DidntGoWell = [.. s.DidntGoWell, card] },
        "action-items"  => s with { ActionItems = [.. s.ActionItems, card] },
        _ => s
    };

    private static RetroState DeleteCard(RetroState s, string id) => s with
    {
        WentWell    = [.. s.WentWell.Where(c => c.Id != id)],
        DidntGoWell = [.. s.DidntGoWell.Where(c => c.Id != id)],
        ActionItems = [.. s.ActionItems.Where(c => c.Id != id)],
    };

    private static RetroState UpvoteCard(RetroState s, string id) => s with
    {
        WentWell    = [.. s.WentWell.Select(c => c.Id == id ? c with { Votes = c.Votes + 1 } : c)],
        DidntGoWell = [.. s.DidntGoWell.Select(c => c.Id == id ? c with { Votes = c.Votes + 1 } : c)],
        ActionItems = [.. s.ActionItems.Select(c => c.Id == id ? c with { Votes = c.Votes + 1 } : c)],
    };

    private static RetroState ResolveCard(RetroState s, string id, bool resolved) => s with
    {
        ActionItems = [.. s.ActionItems.Select(c => c.Id == id ? c with { Resolved = resolved } : c)]
    };

    private static ViewNode BuildVm(RetroState state)
    {
        var totalCards  = state.WentWell.Count + state.DidntGoWell.Count + state.ActionItems.Count;
        var totalVotes  = state.WentWell.Sum(c => c.Votes) + state.DidntGoWell.Sum(c => c.Votes) + state.ActionItems.Sum(c => c.Votes);
        var openActions = state.ActionItems.Count(c => !c.Resolved);
        var doneActions = state.ActionItems.Count(c => c.Resolved);

        return new PageNode(
            Title: "Retro Board",
            Children:
            [
                new StatBarNode(
                [
                    new StatItem("cards",    totalCards.ToString()),
                    new StatItem("votes",    totalVotes.ToString()),
                    new StatItem("open",     openActions.ToString()),
                    new StatItem("resolved", doneActions.ToString()),
                ]),

                BuildSectionNode("Went Well",      "went-well",     state.WentWell,    isActionItems: false),
                BuildSectionNode("Didn't Go Well", "didnt-go-well", state.DidntGoWell, isActionItems: false),
                BuildSectionNode("Action Items",   "action-items",  state.ActionItems, isActionItems: true),
            ]
        );
    }

    private static SectionNode BuildSectionNode(
        string label, string sectionId, IReadOnlyList<RetroCard> cards, bool isActionItems)
    {
        return new SectionNode(
            Heading: $"{label} ({cards.Count})",
            Children:
            [
                new FormNode(
                    SubmitAction: new ActionDescriptor("add-card", new() { ["section"] = sectionId }),
                    SubmitLabel:  "Add",
                    Children:
                    [
                        new FieldNode("text", "text", null, $"Add to {label}…", null)
                    ]
                ),

                new ListNode(
                    Children: cards
                        .OrderBy(c => c.CreatedAt)
                        .Select(c => (ViewNode)BuildCardItem(c, isActionItems))
                        .ToList()
                ),
            ]
        );
    }

    private static ListItemNode BuildCardItem(RetroCard card, bool isActionItems)
    {
        var children = new List<ViewNode>();

        if (isActionItems)
        {
            children.Add(new CheckboxNode(
                Name:    "resolved",
                Checked: card.Resolved,
                Label:   null,
                Action:  new ActionDescriptor("resolve-card", new() { ["id"] = card.Id })
            ));
        }

        children.Add(new TextNode(card.Text, card.Resolved ? "strikethrough" : null));
        children.Add(new ButtonNode(
            Label:   $"▲ {card.Votes}",
            Action:  new ActionDescriptor("upvote-card", new() { ["id"] = card.Id }),
            Variant: null
        ));
        children.Add(new ButtonNode(
            Label:   "Delete",
            Action:  new ActionDescriptor("delete-card", new() { ["id"] = card.Id }),
            Variant: "danger"
        ));

        return new ListItemNode(
            Id:       card.Id,
            Variant:  card.Resolved ? "done" : null,
            Children: children
        );
    }
}
