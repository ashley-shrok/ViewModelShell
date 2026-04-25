namespace RetroBoard.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using RetroBoard.Services;
using ViewModelShell.ViewModels;

[ApiController]
[Route("api/retro")]
public class RetroBoardController(RetroRegistry registry) : ControllerBase
{
    private RetroStore Store => registry.GetOrCreate(
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
            case "add-card":
                var section = Str("section");
                var text    = Str("text");
                if (string.IsNullOrWhiteSpace(text)) return BadRequest("text required");
                if (section != null) Store.AddCard(section, text.Trim());
                break;

            case "delete-card":
                var deleteId = Str("id");
                if (deleteId != null) Store.DeleteCard(deleteId);
                break;

            case "upvote-card":
                var upvoteId = Str("id");
                if (upvoteId != null) Store.UpvoteCard(upvoteId);
                break;

            case "resolve-card":
                var resolveId  = Str("id");
                var isResolved = Bool("checked");
                if (resolveId != null && isResolved.HasValue)
                    Store.ResolveCard(resolveId, isResolved.Value);
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return BuildViewModel();
    }

    private ViewNode BuildViewModel()
    {
        var wentWell    = Store.GetCards("went-well");
        var didntGoWell = Store.GetCards("didnt-go-well");
        var actionItems = Store.GetCards("action-items");

        var totalCards  = wentWell.Count + didntGoWell.Count + actionItems.Count;
        var totalVotes  = wentWell.Sum(c => c.Votes) + didntGoWell.Sum(c => c.Votes) + actionItems.Sum(c => c.Votes);
        var openActions = actionItems.Count(c => !c.Resolved);
        var doneActions = actionItems.Count(c => c.Resolved);

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

                BuildSectionNode("Went Well",      "went-well",     wentWell,    isActionItems: false),
                BuildSectionNode("Didn't Go Well", "didnt-go-well", didntGoWell, isActionItems: false),
                BuildSectionNode("Action Items",   "action-items",  actionItems, isActionItems: true),
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
