namespace HelpDesk.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Primitives;
using HelpDesk.Controllers;
using ViewModelShell;

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

    private AgentController CreateAgent()
    {
        var controller = new AgentController(_db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    private static ActionResult<ShellResponse<AgentState>> Act(
        AgentController ctrl, AgentState state, string name,
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

    private static ShellResponse<AgentState> Ok(ActionResult<ShellResponse<AgentState>> result) =>
        result.Value ?? throw new Xunit.Sdk.XunitException("Expected a value, got " + result.Result?.GetType().Name);

    private static Dictionary<string, JsonElement> Ctx(object obj)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(obj));
        return doc.RootElement.EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.Clone());
    }

    private static PageNode Page(ViewNode vm) => Assert.IsType<PageNode>(vm);

    private long SeedTicket(string title = "Test ticket", string priority = "medium", string type = "software")
        => _db.Create(title, type, priority, null, null, null, null, null, null);

    // ── GET ────────────────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsAgentQueuePage()
    {
        var page = Page(CreateAgent().Get().Vm);
        Assert.Equal("Agent Queue", page.Title);
    }

    [Fact]
    public void Get_HasFourStatItems()
    {
        var page = Page(CreateAgent().Get().Vm);
        var bar  = page.Children.OfType<StatBarNode>().Single();
        Assert.Equal(4, bar.Stats.Count);
    }

    [Fact]
    public void Get_SeededTicket_AppearsInQueue()
    {
        SeedTicket("Printer broken");
        var page  = Page(CreateAgent().Get().Vm);
        var items = page.Children.OfType<ListNode>().Single().Children.OfType<ListItemNode>().ToList();
        Assert.Single(items);
        Assert.Contains(items[0].Children.OfType<TextNode>(), t => t.Value == "Printer broken");
    }

    [Fact]
    public void OpenTicket_HasTakeAndViewButtons()
    {
        SeedTicket();
        var page = Page(CreateAgent().Get().Vm);
        var item = page.Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.Contains(item.Children.OfType<ButtonNode>(), b => b.Action.Name == "start-ticket");
        Assert.Contains(item.Children.OfType<ButtonNode>(), b => b.Action.Name == "select-ticket");
    }

    // ── start-ticket ──────────────────────────────────────────────────────────

    [Fact]
    public void StartTicket_MovesTicketToInProgress()
    {
        var id = SeedTicket();
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "start-ticket", Ctx(new { id = id.ToString() })));
        var item = Page(resp.Vm).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.DoesNotContain(item.Children.OfType<ButtonNode>(), b => b.Action.Name == "start-ticket");
    }

    [Fact]
    public void StartTicket_UpdatesStatBar()
    {
        var id = SeedTicket();
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "start-ticket", Ctx(new { id = id.ToString() })));
        var bar = Page(resp.Vm).Children.OfType<StatBarNode>().Single();
        Assert.Equal("0", bar.Stats.First(s => s.Label == "open").Value);
        Assert.Equal("1", bar.Stats.First(s => s.Label == "in progress").Value);
    }

    // ── select-ticket / detail view ───────────────────────────────────────────

    [Fact]
    public void SelectTicket_ShowsDetailView()
    {
        var id = SeedTicket("Broken keyboard");
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        Assert.Equal("Broken keyboard", Page(resp.Vm).Title);
    }

    [Fact]
    public void DetailView_OpenTicket_HasMarkInProgressButton()
    {
        var id = SeedTicket();
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        var actions = Page(resp.Vm).Children.OfType<SectionNode>()
            .First(s => s.Heading == "Actions").Children.OfType<ButtonNode>().ToList();
        Assert.Single(actions);
        Assert.Equal("start-ticket", actions[0].Action.Name);
    }

    [Fact]
    public void DetailView_InProgressTicket_HasMarkResolvedButton()
    {
        var id = SeedTicket();
        _db.UpdateStatus(id, "in-progress");
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        var actions = Page(resp.Vm).Children.OfType<SectionNode>()
            .First(s => s.Heading == "Actions").Children.OfType<ButtonNode>().ToList();
        Assert.Single(actions);
        Assert.Equal("resolve-ticket", actions[0].Action.Name);
    }

    [Fact]
    public void DetailView_ResolvedTicket_HasReopenButton()
    {
        var id = SeedTicket();
        _db.UpdateStatus(id, "resolved");
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        var actions = Page(resp.Vm).Children.OfType<SectionNode>()
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
        var step1 = Ok(Act(ctrl, AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        var step2 = Ok(Act(ctrl, step1.State, "resolve-ticket", Ctx(new { id = id.ToString() })));
        var actions = Page(step2.Vm).Children.OfType<SectionNode>()
            .First(s => s.Heading == "Actions").Children.OfType<ButtonNode>();
        Assert.Contains(actions, b => b.Action.Name == "reopen-ticket");
    }

    [Fact]
    public void ResolveTicket_ResolvedVariantInQueue()
    {
        var id = SeedTicket();
        _db.UpdateStatus(id, "in-progress");
        var ctrl = CreateAgent();
        var step1 = Ok(Act(ctrl, AgentState.Initial(), "resolve-ticket", Ctx(new { id = id.ToString() })));
        var page = Page(ctrl.Get().Vm);
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
        var step1 = Ok(Act(ctrl, AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        var step2 = Ok(Act(ctrl, step1.State, "reopen-ticket", Ctx(new { id = id.ToString() })));
        var actions = Page(step2.Vm).Children.OfType<SectionNode>()
            .First(s => s.Heading == "Actions").Children.OfType<ButtonNode>();
        Assert.Contains(actions, b => b.Action.Name == "start-ticket");
    }

    // ── save-notes ────────────────────────────────────────────────────────────

    [Fact]
    public void SaveNotes_PersistsAndShowsInDetailView()
    {
        var id = SeedTicket();
        var ctrl = CreateAgent();
        var step1 = Ok(Act(ctrl, AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        var step2 = Ok(Act(ctrl, step1.State, "save-notes",
            Ctx(new { id = id.ToString(), agent_notes = "Checked hardware, needs replacement." })));
        var notesSection = Page(step2.Vm).Children.OfType<SectionNode>()
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
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "filter", Ctx(new { value = "in-progress" })));
        var items = Page(resp.Vm).Children.OfType<ListNode>().Single().Children.OfType<ListItemNode>().ToList();
        Assert.Single(items);
        Assert.Contains(items[0].Children.OfType<TextNode>(), t => t.Value == "In-progress one");
    }

    // ── shared DB across clients ──────────────────────────────────────────────

    [Fact]
    public void Tickets_SharedAcrossClients()
    {
        SeedTicket("Shared ticket");

        // A second "client" with its own initial state should still see DB tickets.
        var ctrl2 = CreateAgent();
        var page = Page(ctrl2.Get().Vm);
        var items = page.Children.OfType<ListNode>().Single().Children.OfType<ListItemNode>().ToList();
        Assert.Single(items);
    }

    // ── back-to-queue ─────────────────────────────────────────────────────────

    [Fact]
    public void BackToQueue_ReturnsQueueView()
    {
        var id = SeedTicket();
        var ctrl = CreateAgent();
        var step1 = Ok(Act(ctrl, AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        var step2 = Ok(Act(ctrl, step1.State, "back-to-queue"));
        Assert.Equal("Agent Queue", Page(step2.Vm).Title);
    }

    // ── unknown action ────────────────────────────────────────────────────────

    [Fact]
    public void UnknownAction_ReturnsBadRequest()
    {
        var result = Act(CreateAgent(), AgentState.Initial(), "do-the-thing");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
