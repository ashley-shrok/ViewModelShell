namespace RetroBoard.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using RetroBoard.Controllers;
using RetroBoard.Services;
using ViewModelShell.ViewModels;

public class RetroBoardControllerTests
{
    private static RetroBoardController CreateController(string tab = "test")
    {
        var controller = new RetroBoardController(new RetroRegistry());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                Request = { QueryString = new QueryString($"?tab={tab}") }
            }
        };
        return controller;
    }

    private static Dictionary<string, JsonElement> Ctx(object obj)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(obj));
        return doc.RootElement.EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.Clone());
    }

    private static PageNode Page(ActionResult<ViewNode> result) =>
        Assert.IsType<PageNode>(result.Value);

    private static StatBarNode StatBar(PageNode page) =>
        page.Children.OfType<StatBarNode>().Single();

    private static IReadOnlyList<SectionNode> Sections(PageNode page) =>
        page.Children.OfType<SectionNode>().ToList();

    private static ListNode CardList(SectionNode section) =>
        section.Children.OfType<ListNode>().Single();

    // ── GET ─────────────────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsPageNode()
    {
        var controller = CreateController();
        var page = Page(controller.Get());
        Assert.Equal("Retro Board", page.Title);
    }

    [Fact]
    public void Get_HasThreeSections()
    {
        var controller = CreateController();
        Assert.Equal(3, Sections(Page(controller.Get())).Count);
    }

    [Fact]
    public void Get_SectionHeadings_ContainCardCount()
    {
        var controller = CreateController();
        var sections = Sections(Page(controller.Get()));
        Assert.Contains("(1)", sections[0].Heading); // went-well: 1 seed card
        Assert.Contains("(1)", sections[1].Heading); // didnt-go-well: 1 seed card
        Assert.Contains("(1)", sections[2].Heading); // action-items: 1 seed card
    }

    [Fact]
    public void Get_EachSection_HasFormAndList()
    {
        var controller = CreateController();
        foreach (var section in Sections(Page(controller.Get())))
        {
            Assert.Contains(section.Children, c => c is FormNode);
            Assert.Contains(section.Children, c => c is ListNode);
        }
    }

    [Fact]
    public void Get_StatBar_ShowsThreeCards()
    {
        var controller = CreateController();
        var stat = StatBar(Page(controller.Get())).Stats.Single(s => s.Label == "cards");
        Assert.Equal("3", stat.Value);
    }

    [Fact]
    public void Get_StatBar_ShowsZeroVotes()
    {
        var controller = CreateController();
        var stat = StatBar(Page(controller.Get())).Stats.Single(s => s.Label == "votes");
        Assert.Equal("0", stat.Value);
    }

    [Fact]
    public void Get_StatBar_ShowsOneOpenAction()
    {
        var controller = CreateController();
        var stat = StatBar(Page(controller.Get())).Stats.Single(s => s.Label == "open");
        Assert.Equal("1", stat.Value);
    }

    [Fact]
    public void Get_StatBar_ShowsZeroResolved()
    {
        var controller = CreateController();
        var stat = StatBar(Page(controller.Get())).Stats.Single(s => s.Label == "resolved");
        Assert.Equal("0", stat.Value);
    }

    [Fact]
    public void Get_ActionItems_CardHasCheckbox()
    {
        var controller = CreateController();
        var sections = Sections(Page(controller.Get()));
        var card = Assert.IsType<ListItemNode>(CardList(sections[2]).Children.Single());
        Assert.Contains(card.Children, c => c is CheckboxNode);
    }

    [Fact]
    public void Get_WentWell_CardHasNoCheckbox()
    {
        var controller = CreateController();
        var sections = Sections(Page(controller.Get()));
        var card = Assert.IsType<ListItemNode>(CardList(sections[0]).Children.Single());
        Assert.DoesNotContain(card.Children, c => c is CheckboxNode);
    }

    [Fact]
    public void Get_EachCard_HasTextUpvoteButtonAndDeleteButton()
    {
        var controller = CreateController();
        foreach (var section in Sections(Page(controller.Get())))
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
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("add-card",
            Ctx(new { section = "went-well", text = "Great sprint velocity" }))));
        Assert.Equal(2, CardList(Sections(page)[0]).Children.Count);
    }

    [Fact]
    public void Action_AddCard_DoesNotAffectOtherSections()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("add-card",
            Ctx(new { section = "went-well", text = "Great sprint velocity" }))));
        Assert.Equal(1, CardList(Sections(page)[1]).Children.Count);
        Assert.Equal(1, CardList(Sections(page)[2]).Children.Count);
    }

    [Fact]
    public void Action_AddCard_UpdatesStatBarCardCount()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("add-card",
            Ctx(new { section = "went-well", text = "New card" }))));
        Assert.Equal("4", StatBar(page).Stats.Single(s => s.Label == "cards").Value);
    }

    [Fact]
    public void Action_AddCard_EmptyText_ReturnsBadRequest()
    {
        var controller = CreateController();
        var result = controller.Action(new ActionPayload("add-card",
            Ctx(new { section = "went-well", text = "" })));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_AddCard_WhitespaceText_ReturnsBadRequest()
    {
        var controller = CreateController();
        var result = controller.Action(new ActionPayload("add-card",
            Ctx(new { section = "went-well", text = "   " })));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── delete-card ─────────────────────────────────────────────────────────────

    [Fact]
    public void Action_DeleteCard_RemovesCard()
    {
        var controller = CreateController();
        var cardId = CardList(Sections(Page(controller.Get()))[0]).Children
            .Cast<ListItemNode>().First().Id;
        var page = Page(controller.Action(new ActionPayload("delete-card",
            Ctx(new { id = cardId }))));
        Assert.Equal(0, CardList(Sections(page)[0]).Children.Count);
    }

    [Fact]
    public void Action_DeleteCard_UpdatesStatBarCardCount()
    {
        var controller = CreateController();
        var cardId = CardList(Sections(Page(controller.Get()))[0]).Children
            .Cast<ListItemNode>().First().Id;
        var page = Page(controller.Action(new ActionPayload("delete-card",
            Ctx(new { id = cardId }))));
        Assert.Equal("2", StatBar(page).Stats.Single(s => s.Label == "cards").Value);
    }

    // ── upvote-card ─────────────────────────────────────────────────────────────

    [Fact]
    public void Action_UpvoteCard_IncrementsVoteStatTotal()
    {
        var controller = CreateController();
        var cardId = CardList(Sections(Page(controller.Get()))[0]).Children
            .Cast<ListItemNode>().First().Id;
        var page = Page(controller.Action(new ActionPayload("upvote-card",
            Ctx(new { id = cardId }))));
        Assert.Equal("1", StatBar(page).Stats.Single(s => s.Label == "votes").Value);
    }

    [Fact]
    public void Action_UpvoteCard_ShowsCountInButtonLabel()
    {
        var controller = CreateController();
        var sections = Sections(Page(controller.Get()));
        var cardId = CardList(sections[0]).Children.Cast<ListItemNode>().First().Id;
        var page = Page(controller.Action(new ActionPayload("upvote-card",
            Ctx(new { id = cardId }))));
        var upvoteBtn = CardList(Sections(page)[0]).Children
            .Cast<ListItemNode>().First()
            .Children.OfType<ButtonNode>()
            .Single(b => b.Action.Name == "upvote-card");
        Assert.Equal("▲ 1", upvoteBtn.Label);
    }

    // ── resolve-card ────────────────────────────────────────────────────────────

    [Fact]
    public void Action_ResolveCard_MarksItemWithDoneVariant()
    {
        var controller = CreateController();
        var actionId = CardList(Sections(Page(controller.Get()))[2]).Children
            .Cast<ListItemNode>().First().Id;
        var page = Page(controller.Action(new ActionPayload("resolve-card",
            Ctx(new { id = actionId, @checked = true }))));
        var item = CardList(Sections(page)[2]).Children.Cast<ListItemNode>().First();
        Assert.Equal("done", item.Variant);
    }

    [Fact]
    public void Action_ResolveCard_AppliesStrikethroughToText()
    {
        var controller = CreateController();
        var actionId = CardList(Sections(Page(controller.Get()))[2]).Children
            .Cast<ListItemNode>().First().Id;
        var page = Page(controller.Action(new ActionPayload("resolve-card",
            Ctx(new { id = actionId, @checked = true }))));
        var item = CardList(Sections(page)[2]).Children.Cast<ListItemNode>().First();
        Assert.Contains(item.Children.OfType<TextNode>(), t => t.Style == "strikethrough");
    }

    [Fact]
    public void Action_ResolveCard_UpdatesOpenAndResolvedStats()
    {
        var controller = CreateController();
        var actionId = CardList(Sections(Page(controller.Get()))[2]).Children
            .Cast<ListItemNode>().First().Id;
        var page = Page(controller.Action(new ActionPayload("resolve-card",
            Ctx(new { id = actionId, @checked = true }))));
        var stats = StatBar(page).Stats;
        Assert.Equal("0", stats.Single(s => s.Label == "open").Value);
        Assert.Equal("1", stats.Single(s => s.Label == "resolved").Value);
    }

    [Fact]
    public void Action_ResolveCard_CanUnresolve()
    {
        var controller = CreateController();
        var actionId = CardList(Sections(Page(controller.Get()))[2]).Children
            .Cast<ListItemNode>().First().Id;
        controller.Action(new ActionPayload("resolve-card", Ctx(new { id = actionId, @checked = true })));
        var page = Page(controller.Action(new ActionPayload("resolve-card",
            Ctx(new { id = actionId, @checked = false }))));
        var item = CardList(Sections(page)[2]).Children.Cast<ListItemNode>().First();
        Assert.Null(item.Variant);
    }

    // ── unknown action ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_UnknownName_ReturnsBadRequest()
    {
        var controller = CreateController();
        var result = controller.Action(new ActionPayload("blast-off", null));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
