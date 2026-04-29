namespace RetroBoard.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using RetroBoard.Controllers;
using RetroBoard.State;
using ViewModelShell.ViewModels;

public class RetroBoardControllerTests
{
    private static RetroBoardController CreateController()
    {
        var controller = new RetroBoardController();
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    private static Dictionary<string, JsonElement> Ctx(object obj)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(obj));
        return doc.RootElement.EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.Clone());
    }

    private static ActionResult<ShellResponse<RetroState>> Act(
        RetroBoardController ctrl, RetroState state, string name,
        Dictionary<string, JsonElement>? ctx = null)
    {
        var actionJson = JsonSerializer.Serialize(new { name, context = ctx });
        var stateJson  = JsonSerializer.Serialize(state);
        ctrl.ControllerContext.HttpContext.Request.Form = new FormCollection(
            new Dictionary<string, StringValues>
            {
                ["_action"] = actionJson,
                ["_state"]  = stateJson,
            });
        return ctrl.Action();
    }

    private static ShellResponse<RetroState> Ok(ActionResult<ShellResponse<RetroState>> result) =>
        result.Value ?? throw new Xunit.Sdk.XunitException("Expected a value, got " + result.Result?.GetType().Name);

    private static PageNode Page(ViewNode vm) => Assert.IsType<PageNode>(vm);
    private static StatBarNode StatBar(PageNode page) => page.Children.OfType<StatBarNode>().Single();
    private static IReadOnlyList<SectionNode> Sections(PageNode page) => page.Children.OfType<SectionNode>().ToList();
    private static ListNode CardList(SectionNode section) => section.Children.OfType<ListNode>().Single();

    // ── GET ─────────────────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsPageNode()
    {
        var page = Page(CreateController().Get().Vm);
        Assert.Equal("Retro Board", page.Title);
    }

    [Fact]
    public void Get_ReturnsInitialState()
    {
        var resp = CreateController().Get();
        Assert.Single(resp.State.WentWell);
        Assert.Single(resp.State.DidntGoWell);
        Assert.Single(resp.State.ActionItems);
    }

    [Fact]
    public void Get_HasThreeSections()
    {
        Assert.Equal(3, Sections(Page(CreateController().Get().Vm)).Count);
    }

    [Fact]
    public void Get_SectionHeadings_ContainCardCount()
    {
        var sections = Sections(Page(CreateController().Get().Vm));
        Assert.Contains("(1)", sections[0].Heading);
        Assert.Contains("(1)", sections[1].Heading);
        Assert.Contains("(1)", sections[2].Heading);
    }

    [Fact]
    public void Get_EachSection_HasFormAndList()
    {
        foreach (var section in Sections(Page(CreateController().Get().Vm)))
        {
            Assert.Contains(section.Children, c => c is FormNode);
            Assert.Contains(section.Children, c => c is ListNode);
        }
    }

    [Fact]
    public void Get_StatBar_ShowsThreeCards()
    {
        var stat = StatBar(Page(CreateController().Get().Vm)).Stats.Single(s => s.Label == "cards");
        Assert.Equal("3", stat.Value);
    }

    [Fact]
    public void Get_StatBar_ShowsZeroVotes()
    {
        var stat = StatBar(Page(CreateController().Get().Vm)).Stats.Single(s => s.Label == "votes");
        Assert.Equal("0", stat.Value);
    }

    [Fact]
    public void Get_StatBar_ShowsOneOpenAction()
    {
        var stat = StatBar(Page(CreateController().Get().Vm)).Stats.Single(s => s.Label == "open");
        Assert.Equal("1", stat.Value);
    }

    [Fact]
    public void Get_StatBar_ShowsZeroResolved()
    {
        var stat = StatBar(Page(CreateController().Get().Vm)).Stats.Single(s => s.Label == "resolved");
        Assert.Equal("0", stat.Value);
    }

    [Fact]
    public void Get_ActionItems_CardHasCheckbox()
    {
        var sections = Sections(Page(CreateController().Get().Vm));
        var card = Assert.IsType<ListItemNode>(CardList(sections[2]).Children.Single());
        Assert.Contains(card.Children, c => c is CheckboxNode);
    }

    [Fact]
    public void Get_WentWell_CardHasNoCheckbox()
    {
        var sections = Sections(Page(CreateController().Get().Vm));
        var card = Assert.IsType<ListItemNode>(CardList(sections[0]).Children.Single());
        Assert.DoesNotContain(card.Children, c => c is CheckboxNode);
    }

    [Fact]
    public void Get_EachCard_HasTextUpvoteButtonAndDeleteButton()
    {
        foreach (var section in Sections(Page(CreateController().Get().Vm)))
        {
            foreach (var node in CardList(section).Children.Cast<ListItemNode>())
            {
                Assert.Contains(node.Children, c => c is TextNode);
                Assert.Contains(node.Children, c => c is ButtonNode b && b.Action.Name == "upvote-card");
                Assert.Contains(node.Children, c => c is ButtonNode b && b.Variant == "danger");
            }
        }
    }

    // ── add-card ────────────────────────────────────────────────────────────────

    [Fact]
    public void Action_AddCard_AppendsToCorrectSection()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, RetroState.Initial(), "add-card",
            Ctx(new { section = "went-well", text = "Great sprint velocity" })));
        Assert.Equal(2, CardList(Sections(Page(resp.Vm))[0]).Children.Count);
        Assert.Equal(2, resp.State.WentWell.Count);
    }

    [Fact]
    public void Action_AddCard_DoesNotAffectOtherSections()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, RetroState.Initial(), "add-card",
            Ctx(new { section = "went-well", text = "Great sprint velocity" })));
        Assert.Equal(1, CardList(Sections(Page(resp.Vm))[1]).Children.Count);
        Assert.Equal(1, CardList(Sections(Page(resp.Vm))[2]).Children.Count);
    }

    [Fact]
    public void Action_AddCard_UpdatesStatBarCardCount()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, RetroState.Initial(), "add-card",
            Ctx(new { section = "went-well", text = "New card" })));
        Assert.Equal("4", StatBar(Page(resp.Vm)).Stats.Single(s => s.Label == "cards").Value);
    }

    [Fact]
    public void Action_AddCard_EmptyText_ReturnsBadRequest()
    {
        var result = Act(CreateController(), RetroState.Initial(), "add-card",
            Ctx(new { section = "went-well", text = "" }));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_AddCard_WhitespaceText_ReturnsBadRequest()
    {
        var result = Act(CreateController(), RetroState.Initial(), "add-card",
            Ctx(new { section = "went-well", text = "   " }));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── delete-card ─────────────────────────────────────────────────────────────

    [Fact]
    public void Action_DeleteCard_RemovesCard()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var cardId = initial.WentWell.First().Id;
        var resp = Ok(Act(ctrl, initial, "delete-card", Ctx(new { id = cardId })));
        Assert.Equal(0, CardList(Sections(Page(resp.Vm))[0]).Children.Count);
    }

    [Fact]
    public void Action_DeleteCard_UpdatesStatBarCardCount()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var cardId = initial.WentWell.First().Id;
        var resp = Ok(Act(ctrl, initial, "delete-card", Ctx(new { id = cardId })));
        Assert.Equal("2", StatBar(Page(resp.Vm)).Stats.Single(s => s.Label == "cards").Value);
    }

    // ── upvote-card ─────────────────────────────────────────────────────────────

    [Fact]
    public void Action_UpvoteCard_IncrementsVoteStatTotal()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var cardId = initial.WentWell.First().Id;
        var resp = Ok(Act(ctrl, initial, "upvote-card", Ctx(new { id = cardId })));
        Assert.Equal("1", StatBar(Page(resp.Vm)).Stats.Single(s => s.Label == "votes").Value);
    }

    [Fact]
    public void Action_UpvoteCard_ShowsCountInButtonLabel()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var cardId = initial.WentWell.First().Id;
        var resp = Ok(Act(ctrl, initial, "upvote-card", Ctx(new { id = cardId })));
        var upvoteBtn = CardList(Sections(Page(resp.Vm))[0]).Children
            .Cast<ListItemNode>().First()
            .Children.OfType<ButtonNode>()
            .Single(b => b.Action.Name == "upvote-card");
        Assert.Equal("▲ 1", upvoteBtn.Label);
    }

    // ── resolve-card ────────────────────────────────────────────────────────────

    [Fact]
    public void Action_ResolveCard_MarksItemWithDoneVariant()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var actionId = initial.ActionItems.First().Id;
        var resp = Ok(Act(ctrl, initial, "resolve-card", Ctx(new { id = actionId, @checked = true })));
        var item = CardList(Sections(Page(resp.Vm))[2]).Children.Cast<ListItemNode>().First();
        Assert.Equal("done", item.Variant);
    }

    [Fact]
    public void Action_ResolveCard_AppliesStrikethroughToText()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var actionId = initial.ActionItems.First().Id;
        var resp = Ok(Act(ctrl, initial, "resolve-card", Ctx(new { id = actionId, @checked = true })));
        var item = CardList(Sections(Page(resp.Vm))[2]).Children.Cast<ListItemNode>().First();
        Assert.Contains(item.Children.OfType<TextNode>(), t => t.Style == "strikethrough");
    }

    [Fact]
    public void Action_ResolveCard_UpdatesOpenAndResolvedStats()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var actionId = initial.ActionItems.First().Id;
        var resp = Ok(Act(ctrl, initial, "resolve-card", Ctx(new { id = actionId, @checked = true })));
        var stats = StatBar(Page(resp.Vm)).Stats;
        Assert.Equal("0", stats.Single(s => s.Label == "open").Value);
        Assert.Equal("1", stats.Single(s => s.Label == "resolved").Value);
    }

    [Fact]
    public void Action_ResolveCard_CanUnresolve()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var actionId = initial.ActionItems.First().Id;
        var step1 = Ok(Act(ctrl, initial, "resolve-card", Ctx(new { id = actionId, @checked = true })));
        var step2 = Ok(Act(ctrl, step1.State, "resolve-card", Ctx(new { id = actionId, @checked = false })));
        var item = CardList(Sections(Page(step2.Vm))[2]).Children.Cast<ListItemNode>().First();
        Assert.Null(item.Variant);
    }

    // ── unknown action ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_UnknownName_ReturnsBadRequest()
    {
        var result = Act(CreateController(), RetroState.Initial(), "blast-off");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
