namespace RetroBoard.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using RetroBoard.Controllers;
using RetroBoard.State;
using ViewModelShell;

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

    private static ActionResult<ShellResponse<RetroState>> Act(
        RetroBoardController ctrl, RetroState state, string name)
    {
        var actionJson = JsonSerializer.Serialize(new { name });
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

    // ── Tree navigation helpers (redesign 0.4.0) ─────────────────────────────────
    private static PageNode Page(ViewNode? vm) => Assert.IsType<PageNode>(vm);
    private static IReadOnlyList<SectionNode> Sections(PageNode page) => page.Children.OfType<SectionNode>().ToList();
    private static ListNode CardList(SectionNode section) => section.Children.OfType<ListNode>().Single();
    private static IReadOnlyList<ListItemNode> Cards(SectionNode section) =>
        CardList(section).Children.Cast<ListItemNode>().ToList();

    private static ButtonNode UpvoteButton(ListItemNode card) =>
        card.Children.OfType<ButtonNode>().Single(b => b.Action.Name.StartsWith("upvote-card-"));

    private static int TotalCards(PageNode page) =>
        Sections(page).Sum(s => Cards(s).Count);

    private static int TotalVotes(PageNode page) =>
        Sections(page)
            .SelectMany(Cards)
            .Select(c => int.Parse(UpvoteButton(c).Label.Replace("▲", "").Trim()))
            .Sum();

    private static int OpenActionItems(PageNode page) =>
        Cards(Sections(page)[2]).Count(c => c.Variant != "done");

    private static int ResolvedActionItems(PageNode page) =>
        Cards(Sections(page)[2]).Count(c => c.Variant == "done");

    // ── GET ─────────────────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsPageNode()
    {
        var page = Page(CreateController().Get().Vm);
        Assert.Equal("Retro Board", page.Title);
    }

    [Fact]
    public void Get_PageUsesCardsLayout()
    {
        var page = Page(CreateController().Get().Vm);
        Assert.Equal("cards", page.Layout);
    }

    [Fact]
    public void Get_HasNoStatBar()
    {
        var page = Page(CreateController().Get().Vm);
        Assert.DoesNotContain(page.Children, c => c is StatBarNode);
    }

    [Fact]
    public void Get_ReturnsInitialState()
    {
        var resp = CreateController().Get();
        Assert.NotNull(resp.State);
        Assert.Single(resp.State!.WentWell);
        Assert.Single(resp.State.DidntGoWell);
        Assert.Single(resp.State.ActionItems);
        Assert.Equal("", resp.State.Drafts.WentWell);
    }

    [Fact]
    public void Get_HasThreeSections()
    {
        Assert.Equal(3, Sections(Page(CreateController().Get().Vm)).Count);
    }

    [Fact]
    public void Get_SectionsAreCardVariantLanes()
    {
        foreach (var section in Sections(Page(CreateController().Get().Vm)))
            Assert.Equal("card", section.Variant);
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
    public void Get_EachSection_HasFormAndList_WithUniqueAddActionAndBoundField()
    {
        var sections = Sections(Page(CreateController().Get().Vm));
        var expectedAdds = new[] { "add-card-went-well", "add-card-didnt-go-well", "add-card-action-items" };
        var expectedBinds = new[] { "drafts.wentWell", "drafts.didntGoWell", "drafts.actionItems" };
        for (var i = 0; i < 3; i++)
        {
            var form = sections[i].Children.OfType<FormNode>().Single();
            Assert.NotNull(form.SubmitAction);
            Assert.Equal(expectedAdds[i], form.SubmitAction!.Name);
            var field = form.Children.OfType<FieldNode>().Single();
            Assert.Equal(expectedBinds[i], field.Bind);
            Assert.Contains(sections[i].Children, c => c is ListNode);
        }
    }

    [Fact]
    public void Get_TotalCards_IsThree()
    {
        Assert.Equal(3, TotalCards(Page(CreateController().Get().Vm)));
    }

    [Fact]
    public void Get_TotalVotes_IsZero()
    {
        Assert.Equal(0, TotalVotes(Page(CreateController().Get().Vm)));
    }

    [Fact]
    public void Get_OneOpenActionItem()
    {
        Assert.Equal(1, OpenActionItems(Page(CreateController().Get().Vm)));
    }

    [Fact]
    public void Get_ZeroResolvedActionItems()
    {
        Assert.Equal(0, ResolvedActionItems(Page(CreateController().Get().Vm)));
    }

    [Fact]
    public void Get_ActionItems_CardHasCheckboxBoundByIndex()
    {
        var sections = Sections(Page(CreateController().Get().Vm));
        var card = Assert.IsType<ListItemNode>(CardList(sections[2]).Children.Single());
        var cb = card.Children.OfType<CheckboxNode>().Single();
        Assert.Equal("actionItems.0.resolved", cb.Bind);
        Assert.NotNull(cb.Action);
        Assert.StartsWith("resolve-card-", cb.Action!.Name);
    }

    [Fact]
    public void Get_WentWell_CardHasNoCheckbox()
    {
        var sections = Sections(Page(CreateController().Get().Vm));
        var card = Assert.IsType<ListItemNode>(CardList(sections[0]).Children.Single());
        Assert.DoesNotContain(card.Children, c => c is CheckboxNode);
    }

    [Fact]
    public void Get_EachCard_HasTextUniqueUpvoteAndUniqueDeleteAction()
    {
        foreach (var section in Sections(Page(CreateController().Get().Vm)))
        {
            foreach (var node in Cards(section))
            {
                Assert.Contains(node.Children, c => c is TextNode);
                Assert.Contains(node.Children, c => c is ButtonNode b && b.Action.Name == $"upvote-card-{node.Id}");
                Assert.Contains(node.Children, c => c is ButtonNode b && b.Action.Name == $"delete-card-{node.Id}");
            }
        }
    }

    [Fact]
    public void Get_DeleteButton_UsesCrossLabelAndDangerVariant()
    {
        foreach (var section in Sections(Page(CreateController().Get().Vm)))
        {
            foreach (var node in Cards(section))
            {
                var deleteBtn = node.Children.OfType<ButtonNode>()
                    .Single(b => b.Action.Name.StartsWith("delete-card-"));
                Assert.Equal("✕", deleteBtn.Label);
                Assert.Equal("danger", deleteBtn.Variant);
            }
        }
    }

    [Fact]
    public void Get_UpvoteButton_HasNoVariant()
    {
        var card = Cards(Sections(Page(CreateController().Get().Vm))[0]).First();
        Assert.Null(UpvoteButton(card).Variant);
    }

    [Fact]
    public void Get_UpvoteButton_LabelShowsZeroCount()
    {
        var card = Cards(Sections(Page(CreateController().Get().Vm))[0]).First();
        Assert.Equal("▲ 0", UpvoteButton(card).Label);
    }

    [Fact]
    public void Get_SeedCard_HasNoDoneVariantAndNoStrikethrough()
    {
        var card = Cards(Sections(Page(CreateController().Get().Vm))[2]).First();
        Assert.Null(card.Variant);
        Assert.DoesNotContain(card.Children.OfType<TextNode>(), t => t.Style == "strikethrough");
    }

    // ── add-card-{section} ──────────────────────────────────────────────────────

    [Fact]
    public void Action_AddCard_AppendsToCorrectSection()
    {
        var ctrl = CreateController();
        var staged = RetroState.Initial() with
        {
            Drafts = RetroState.Initial().Drafts with { WentWell = "Great sprint velocity" }
        };
        var resp = Ok(Act(ctrl, staged, "add-card-went-well"));
        Assert.NotNull(resp.State);
        Assert.Equal(2, Cards(Sections(Page(resp.Vm))[0]).Count);
        Assert.Equal(2, resp.State!.WentWell.Count);
        Assert.Equal("", resp.State.Drafts.WentWell); // draft cleared
    }

    [Fact]
    public void Action_AddCard_DoesNotAffectOtherSections()
    {
        var ctrl = CreateController();
        var staged = RetroState.Initial() with
        {
            Drafts = RetroState.Initial().Drafts with { WentWell = "Great sprint velocity" }
        };
        var resp = Ok(Act(ctrl, staged, "add-card-went-well"));
        Assert.Equal(1, Cards(Sections(Page(resp.Vm))[1]).Count);
        Assert.Equal(1, Cards(Sections(Page(resp.Vm))[2]).Count);
    }

    [Fact]
    public void Action_AddCard_UpdatesTotalCardCount()
    {
        var ctrl = CreateController();
        var staged = RetroState.Initial() with
        {
            Drafts = RetroState.Initial().Drafts with { WentWell = "New card" }
        };
        var resp = Ok(Act(ctrl, staged, "add-card-went-well"));
        Assert.Equal(4, TotalCards(Page(resp.Vm)));
    }

    [Fact]
    public void Action_AddCard_EmptyText_ReturnsBadRequest()
    {
        var state = RetroState.Initial() with
        {
            Drafts = RetroState.Initial().Drafts with { WentWell = "" }
        };
        var result = Act(CreateController(), state, "add-card-went-well");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_AddCard_WhitespaceText_ReturnsBadRequest()
    {
        var state = RetroState.Initial() with
        {
            Drafts = RetroState.Initial().Drafts with { WentWell = "   " }
        };
        var result = Act(CreateController(), state, "add-card-went-well");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── delete-card-{id} ────────────────────────────────────────────────────────

    [Fact]
    public void Action_DeleteCard_RemovesCard()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var cardId = initial.WentWell.First().Id;
        var resp = Ok(Act(ctrl, initial, $"delete-card-{cardId}"));
        Assert.Equal(0, Cards(Sections(Page(resp.Vm))[0]).Count);
    }

    [Fact]
    public void Action_DeleteCard_UpdatesTotalCardCount()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var cardId = initial.WentWell.First().Id;
        var resp = Ok(Act(ctrl, initial, $"delete-card-{cardId}"));
        Assert.Equal(2, TotalCards(Page(resp.Vm)));
    }

    // ── upvote-card-{id} ────────────────────────────────────────────────────────

    [Fact]
    public void Action_UpvoteCard_IncrementsTotalVotes()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var cardId = initial.WentWell.First().Id;
        var resp = Ok(Act(ctrl, initial, $"upvote-card-{cardId}"));
        Assert.Equal(1, TotalVotes(Page(resp.Vm)));
    }

    [Fact]
    public void Action_UpvoteCard_ShowsCountInButtonLabel()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var cardId = initial.WentWell.First().Id;
        var resp = Ok(Act(ctrl, initial, $"upvote-card-{cardId}"));
        var upvoteBtn = UpvoteButton(Cards(Sections(Page(resp.Vm))[0]).First());
        Assert.Equal("▲ 1", upvoteBtn.Label);
    }

    // ── resolve-card-{id} ───────────────────────────────────────────────────────
    // Phase 6: the checkbox bind has already written the new boolean to
    // state.ActionItems[i].Resolved before the action fires. Tests pre-populate
    // that slot to model the renderer's write.

    [Fact]
    public void Action_ResolveCard_MarksItemWithDoneVariant()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var actionId = initial.ActionItems.First().Id;
        var staged = initial with
        {
            ActionItems = [.. initial.ActionItems.Select(c =>
                c.Id == actionId ? c with { Resolved = true } : c)]
        };
        var resp = Ok(Act(ctrl, staged, $"resolve-card-{actionId}"));
        var item = Cards(Sections(Page(resp.Vm))[2]).First();
        Assert.Equal("done", item.Variant);
    }

    [Fact]
    public void Action_ResolveCard_AppliesStrikethroughToText()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var actionId = initial.ActionItems.First().Id;
        var staged = initial with
        {
            ActionItems = [.. initial.ActionItems.Select(c =>
                c.Id == actionId ? c with { Resolved = true } : c)]
        };
        var resp = Ok(Act(ctrl, staged, $"resolve-card-{actionId}"));
        var item = Cards(Sections(Page(resp.Vm))[2]).First();
        Assert.Contains(item.Children.OfType<TextNode>(), t => t.Style == "strikethrough");
    }

    [Fact]
    public void Action_ResolveCard_UpdatesOpenAndResolvedCounts()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var actionId = initial.ActionItems.First().Id;
        var staged = initial with
        {
            ActionItems = [.. initial.ActionItems.Select(c =>
                c.Id == actionId ? c with { Resolved = true } : c)]
        };
        var resp = Ok(Act(ctrl, staged, $"resolve-card-{actionId}"));
        var page = Page(resp.Vm);
        Assert.Equal(0, OpenActionItems(page));
        Assert.Equal(1, ResolvedActionItems(page));
    }

    [Fact]
    public void Action_ResolveCard_CanUnresolve()
    {
        var ctrl = CreateController();
        var initial = RetroState.Initial();
        var actionId = initial.ActionItems.First().Id;
        var resolved = initial with
        {
            ActionItems = [.. initial.ActionItems.Select(c =>
                c.Id == actionId ? c with { Resolved = true } : c)]
        };
        var unresolved = resolved with
        {
            ActionItems = [.. resolved.ActionItems.Select(c =>
                c.Id == actionId ? c with { Resolved = false } : c)]
        };
        var resp = Ok(Act(ctrl, unresolved, $"resolve-card-{actionId}"));
        var item = Cards(Sections(Page(resp.Vm))[2]).First();
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
