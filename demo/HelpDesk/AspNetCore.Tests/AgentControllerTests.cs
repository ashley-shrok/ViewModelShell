namespace HelpDesk.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Primitives;
using HelpDesk.Controllers;
using HelpDesk.ViewModels;

public class AgentControllerTests : IDisposable
{
    private readonly SqliteConnection _anchor;
    private readonly HelpDeskDb _db;
    private readonly string _connStr;

    public AgentControllerTests()
    {
        _connStr = $"Data Source={Guid.NewGuid():N};Mode=Memory;Cache=Shared";
        _anchor  = new SqliteConnection(_connStr);
        _anchor.Open();
        _db = new HelpDeskDb(_connStr);
    }

    public void Dispose() => _anchor.Dispose();

    private AgentController CreateAgent(string tab = "agent")
    {
        var controller = new AgentController(new AgentStateRegistry(), _db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                Request = { QueryString = new QueryString($"?tab={tab}") }
            }
        };
        return controller;
    }

    private static ActionResult<ViewNode> Act(
        AgentController ctrl, string name, Dictionary<string, JsonElement>? ctx = null)
    {
        var json = JsonSerializer.Serialize(new { name, context = ctx });
        ctrl.ControllerContext.HttpContext.Request.Form =
            new FormCollection(new Dictionary<string, StringValues> { ["_action"] = json });
        return ctrl.Action();
    }

    private static Dictionary<string, JsonElement> Ctx(object obj)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(obj));
        return doc.RootElement.EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.Clone());
    }

    private static PageNode Page(ActionResult<ViewNode> result) =>
        Assert.IsType<PageNode>(result.Value);

    private long SeedTicket(string title = "Test ticket", string priority = "medium", string type = "software")
        => _db.Create(title, type, priority, null, null, null, null, null, null);

    // ── GET ────────────────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsAgentQueuePage()
    {
        var page = Page(CreateAgent().Get());
        Assert.Equal("Agent Queue", page.Title);
    }

    [Fact]
    public void Get_HasFourStatItems()
    {
        var page = Page(CreateAgent().Get());
        var bar  = page.Children.OfType<StatBarNode>().Single();
        Assert.Equal(4, bar.Stats.Count);
    }

    [Fact]
    public void Get_SeededTicket_AppearsInQueue()
    {
        SeedTicket("Printer broken");
        var page  = Page(CreateAgent().Get());
        var items = page.Children.OfType<ListNode>().Single().Children.OfType<ListItemNode>().ToList();
        Assert.Single(items);
        Assert.Contains(items[0].Children.OfType<TextNode>(), t => t.Value == "Printer broken");
    }

    [Fact]
    public void OpenTicket_HasTakeAndViewButtons()
    {
        SeedTicket();
        var page = Page(CreateAgent().Get());
        var item = page.Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.Contains(item.Children.OfType<ButtonNode>(), b => b.Action.Name == "start-ticket");
        Assert.Contains(item.Children.OfType<ButtonNode>(), b => b.Action.Name == "select-ticket");
    }

    // ── start-ticket ──────────────────────────────────────────────────────────

    [Fact]
    public void StartTicket_MovesTicketToInProgress()
    {
        var id   = SeedTicket();
        var ctrl = CreateAgent();
        var page = Page(Act(ctrl, "start-ticket", Ctx(new { id = id.ToString() })));
        var item = page.Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.DoesNotContain(item.Children.OfType<ButtonNode>(), b => b.Action.Name == "start-ticket");
    }

    [Fact]
    public void StartTicket_UpdatesStatBar()
    {
        var id   = SeedTicket();
        var ctrl = CreateAgent();
        var page = Page(Act(ctrl, "start-ticket", Ctx(new { id = id.ToString() })));
        var bar  = page.Children.OfType<StatBarNode>().Single();
        Assert.Equal("0", bar.Stats.First(s => s.Label == "open").Value);
        Assert.Equal("1", bar.Stats.First(s => s.Label == "in progress").Value);
    }

    // ── select-ticket / detail view ───────────────────────────────────────────

    [Fact]
    public void SelectTicket_ShowsDetailView()
    {
        var id   = SeedTicket("Broken keyboard");
        var ctrl = CreateAgent();
        var page = Page(Act(ctrl, "select-ticket", Ctx(new { id = id.ToString() })));
        Assert.Equal("Broken keyboard", page.Title);
    }

    [Fact]
    public void DetailView_OpenTicket_HasMarkInProgressButton()
    {
        var id   = SeedTicket();
        var ctrl = CreateAgent();
        var page = Page(Act(ctrl, "select-ticket", Ctx(new { id = id.ToString() })));
        var actions = page.Children.OfType<SectionNode>()
            .First(s => s.Heading == "Actions").Children.OfType<ButtonNode>().ToList();
        Assert.Single(actions);
        Assert.Equal("start-ticket", actions[0].Action.Name);
    }

    [Fact]
    public void DetailView_InProgressTicket_HasMarkResolvedButton()
    {
        var id = SeedTicket();
        _db.UpdateStatus(id, "in-progress");
        var ctrl = CreateAgent();
        var page = Page(Act(ctrl, "select-ticket", Ctx(new { id = id.ToString() })));
        var actions = page.Children.OfType<SectionNode>()
            .First(s => s.Heading == "Actions").Children.OfType<ButtonNode>().ToList();
        Assert.Single(actions);
        Assert.Equal("resolve-ticket", actions[0].Action.Name);
    }

    [Fact]
    public void DetailView_ResolvedTicket_HasReopenButton()
    {
        var id = SeedTicket();
        _db.UpdateStatus(id, "resolved");
        var ctrl = CreateAgent();
        var page = Page(Act(ctrl, "select-ticket", Ctx(new { id = id.ToString() })));
        var actions = page.Children.OfType<SectionNode>()
            .First(s => s.Heading == "Actions").Children.OfType<ButtonNode>().ToList();
        Assert.Contains(actions, b => b.Action.Name == "reopen-ticket");
    }

    // ── resolve-ticket ────────────────────────────────────────────────────────

    [Fact]
    public void ResolveTicket_MovesToResolved()
    {
        var id = SeedTicket();
        _db.UpdateStatus(id, "in-progress");
        var ctrl = CreateAgent();
        Act(ctrl, "select-ticket", Ctx(new { id = id.ToString() }));
        var page = Page(Act(ctrl, "resolve-ticket", Ctx(new { id = id.ToString() })));
        var actions = page.Children.OfType<SectionNode>()
            .First(s => s.Heading == "Actions").Children.OfType<ButtonNode>();
        Assert.Contains(actions, b => b.Action.Name == "reopen-ticket");
    }

    [Fact]
    public void ResolveTicket_ResolvedVariantInQueue()
    {
        var id = SeedTicket();
        _db.UpdateStatus(id, "in-progress");
        var ctrl = CreateAgent();
        Act(ctrl, "resolve-ticket", Ctx(new { id = id.ToString() }));
        var page = Page(ctrl.Get());
        var item = page.Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.Equal("done", item.Variant);
    }

    // ── reopen-ticket ─────────────────────────────────────────────────────────

    [Fact]
    public void ReopenTicket_MovesBackToOpen()
    {
        var id = SeedTicket();
        _db.UpdateStatus(id, "resolved");
        var ctrl = CreateAgent();
        Act(ctrl, "select-ticket", Ctx(new { id = id.ToString() }));
        var page = Page(Act(ctrl, "reopen-ticket", Ctx(new { id = id.ToString() })));
        var actions = page.Children.OfType<SectionNode>()
            .First(s => s.Heading == "Actions").Children.OfType<ButtonNode>();
        Assert.Contains(actions, b => b.Action.Name == "start-ticket");
    }

    // ── save-notes ────────────────────────────────────────────────────────────

    [Fact]
    public void SaveNotes_PersistsAndShowsInDetailView()
    {
        var id   = SeedTicket();
        var ctrl = CreateAgent();
        Act(ctrl, "select-ticket", Ctx(new { id = id.ToString() }));
        var page = Page(Act(ctrl, "save-notes",
            Ctx(new { id = id.ToString(), agent_notes = "Checked hardware, needs replacement." })));
        var notesSection = page.Children.OfType<SectionNode>()
            .First(s => s.Heading == "Agent Notes");
        var form = notesSection.Children.OfType<FormNode>().Single();
        var field = form.Children.OfType<FieldNode>().Single();
        Assert.Equal("Checked hardware, needs replacement.", field.Value);
    }

    // ── filter ────────────────────────────────────────────────────────────────

    [Fact]
    public void Filter_InProgress_ShowsOnlyInProgressTickets()
    {
        SeedTicket("Open one");
        var id2 = SeedTicket("In-progress one");
        _db.UpdateStatus(id2, "in-progress");
        var ctrl = CreateAgent();
        var page = Page(Act(ctrl, "filter", Ctx(new { value = "in-progress" })));
        var items = page.Children.OfType<ListNode>().Single().Children.OfType<ListItemNode>().ToList();
        Assert.Single(items);
        Assert.Contains(items[0].Children.OfType<TextNode>(), t => t.Value == "In-progress one");
    }

    // ── shared state across tabs ──────────────────────────────────────────────

    [Fact]
    public void Tickets_SharedAcrossTabs()
    {
        SeedTicket("Shared ticket");

        var ctrl2 = CreateAgent("tab2");
        var page  = Page(ctrl2.Get());
        var items = page.Children.OfType<ListNode>().Single().Children.OfType<ListItemNode>().ToList();
        Assert.Single(items);
    }

    // ── back-to-queue ─────────────────────────────────────────────────────────

    [Fact]
    public void BackToQueue_ReturnsQueueView()
    {
        var id   = SeedTicket();
        var ctrl = CreateAgent();
        Act(ctrl, "select-ticket", Ctx(new { id = id.ToString() }));
        var page = Page(Act(ctrl, "back-to-queue"));
        Assert.Equal("Agent Queue", page.Title);
    }

    // ── unknown action ────────────────────────────────────────────────────────

    [Fact]
    public void UnknownAction_ReturnsBadRequest()
    {
        var ctrl = CreateAgent();
        var result = Act(ctrl, "do-the-thing");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
