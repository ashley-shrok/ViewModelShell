namespace RetroBoard.Controllers;

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
        return new ShellResponse<RetroState>(BuildVm(state), state).Validate();
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<RetroState>> Action()
    {
        var payload = ActionPayload<RetroState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        var state = payload.State;
        var name = payload.Name;

        // Phase 6 (WIRE-07) — per-card/per-lane identity is encoded in the
        // action name; field values flow through state at their bind paths.
        if (name.StartsWith("add-card-"))
        {
            var section = name["add-card-".Length..];
            var text = ReadDraft(state, section).Trim();
            if (string.IsNullOrWhiteSpace(text)) return BadRequest("text required");
            var card = new RetroCard(
                Id:        Guid.NewGuid().ToString("N")[..8],
                Text:      text,
                Votes:     0,
                Resolved:  false,
                CreatedAt: DateTimeOffset.UtcNow);
            state = AddCard(state, section, card);
            state = ClearDraft(state, section);
        }
        else if (name.StartsWith("delete-card-"))
        {
            var id = name["delete-card-".Length..];
            state = DeleteCard(state, id);
        }
        else if (name.StartsWith("upvote-card-"))
        {
            var id = name["upvote-card-".Length..];
            state = UpvoteCard(state, id);
        }
        else if (name.StartsWith("resolve-card-"))
        {
            // The checkbox bind has already written the new boolean to
            // state.ActionItems[i].Resolved. Just acknowledge with a re-render.
        }
        else
        {
            return BadRequest($"Unknown action: {name}");
        }

        return new ShellResponse<RetroState>(BuildVm(state), state).Validate();
    }

    private static string ReadDraft(RetroState s, string section) => section switch
    {
        "went-well"     => s.Drafts.WentWell,
        "didnt-go-well" => s.Drafts.DidntGoWell,
        "action-items"  => s.Drafts.ActionItems,
        _               => ""
    };

    private static RetroState ClearDraft(RetroState s, string section) => section switch
    {
        "went-well"     => s with { Drafts = s.Drafts with { WentWell    = "" } },
        "didnt-go-well" => s with { Drafts = s.Drafts with { DidntGoWell = "" } },
        "action-items"  => s with { Drafts = s.Drafts with { ActionItems = "" } },
        _               => s
    };

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

    private static ViewNode BuildVm(RetroState state)
    {
        return new PageNode(
            Title:  "Retro Board",
            Layout: "cards",
            Children:
            [
                BuildSectionNode("Went Well",      "went-well",     "drafts.wentWell",    state.WentWell,    state.ActionItems, isActionItems: false),
                BuildSectionNode("Didn't Go Well", "didnt-go-well", "drafts.didntGoWell", state.DidntGoWell, state.ActionItems, isActionItems: false),
                BuildSectionNode("Action Items",   "action-items",  "drafts.actionItems", state.ActionItems, state.ActionItems, isActionItems: true),
            ]
        );
    }

    private static SectionNode BuildSectionNode(
        string label, string sectionId, string draftBind,
        IReadOnlyList<RetroCard> cards,
        IReadOnlyList<RetroCard> sourceActionItems,
        bool isActionItems)
    {
        return new SectionNode(
            Heading: $"{label} ({cards.Count})",
            Variant: "card",
            Children:
            [
                new FormNode(
                    SubmitAction: new ActionDescriptor($"add-card-{sectionId}"),
                    SubmitLabel:  "Add",
                    Children:
                    [
                        new FieldNode("text", "text", draftBind, null, $"Add to {label}…")
                    ]
                ),

                new ListNode(
                    Children: cards
                        .OrderBy(c => c.CreatedAt)
                        .Select(c => (ViewNode)BuildCardItem(c, isActionItems, sourceActionItems))
                        .ToList()
                ),
            ]
        );
    }

    private static ListItemNode BuildCardItem(
        RetroCard card, bool isActionItems, IReadOnlyList<RetroCard> sourceActionItems)
    {
        var children = new List<ViewNode>();

        if (isActionItems)
        {
            var idx = -1;
            for (var k = 0; k < sourceActionItems.Count; k++)
            {
                if (sourceActionItems[k].Id == card.Id) { idx = k; break; }
            }
            if (idx < 0) throw new InvalidOperationException(
                $"Action item id '{card.Id}' is in the filtered list but not in sourceActionItems. " +
                "Bind paths require a valid array index.");
            children.Add(new CheckboxNode(
                Name:   "resolved",
                Bind:   $"actionItems.{idx}.resolved",
                Label:  null,
                Action: new ActionDescriptor($"resolve-card-{card.Id}")
            ));
        }

        children.Add(new TextNode(card.Text, card.Resolved ? "strikethrough" : null));
        children.Add(new ButtonNode(
            Label:   $"▲ {card.Votes}",
            Action:  new ActionDescriptor($"upvote-card-{card.Id}"),
            Variant: null
        ));
        children.Add(new ButtonNode(
            Label:   "✕",
            Action:  new ActionDescriptor($"delete-card-{card.Id}"),
            Variant: "danger"
        ));

        return new ListItemNode(
            Id:       card.Id,
            Variant:  card.Resolved ? "done" : null,
            Children: children
        );
    }
}
