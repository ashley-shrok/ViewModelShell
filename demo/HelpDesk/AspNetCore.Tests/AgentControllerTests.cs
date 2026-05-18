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

    private static TableNode QueueTable(PageNode page) =>
        page.Children.OfType<TableNode>().Single();

    private static TextNode CountsLine(PageNode page) =>
        page.Children.OfType<TextNode>().First(t => t.Style == "muted");

    private long SeedTicket(string title = "Test ticket", string priority = "medium", string type = "software")
        => _db.Create(title, type, priority, null, null, null, null, null, null);

    // ── GET / queue page ───────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsAgentQueuePage()
    {
        var page = Page(CreateAgent().Get().Vm);
        Assert.Equal("Help Desk — Agent", page.Title);
    }

    [Fact]
    public void Get_HasCountsLineAndFilterTabs()
    {
        var page = Page(CreateAgent().Get().Vm);
        // Redesign replaced the StatBar with a single muted counts TextNode.
        Assert.DoesNotContain(page.Children, c => c is StatBarNode);
        Assert.Equal("0 open · 0 in progress · 0 resolved", CountsLine(page).Value);
        var tabs = page.Children.OfType<TabsNode>().Single();
        Assert.Equal("all", tabs.Selected);
        Assert.Equal(4, tabs.Tabs.Count);
    }

    [Fact]
    public void Get_EmptyQueue_ShowsEmptyMessageNoTable()
    {
        var page = Page(CreateAgent().Get().Vm);
        Assert.DoesNotContain(page.Children, c => c is TableNode);
        Assert.Contains(page.Children.OfType<TextNode>(), t => t.Value == "No tickets in queue.");
    }

    [Fact]
    public void Get_SeededTicket_AppearsAsTableRow()
    {
        SeedTicket("Printer broken");
        var page  = Page(CreateAgent().Get().Vm);
        var table = QueueTable(page);
        Assert.Single(table.Rows);
        Assert.Equal("Printer broken", table.Rows[0].Cells["title"]);
    }

    [Fact]
    public void QueueTable_HasFiveColumns()
    {
        SeedTicket();
        var table = QueueTable(Page(CreateAgent().Get().Vm));
        Assert.Equal(
            new[] { "title", "type", "priority", "status", "due" },
            table.Columns.Select(c => c.Key).ToArray());
        Assert.Equal(
            new[] { "Title", "Type", "Priority", "Status", "Due" },
            table.Columns.Select(c => c.Label).ToArray());
    }

    [Fact]
    public void QueueRow_WholeRowOpensTicket()
    {
        var id = SeedTicket();
        var table = QueueTable(Page(CreateAgent().Get().Vm));
        var row = table.Rows.Single();
        Assert.Equal(id.ToString(), row.Id);
        Assert.NotNull(row.Action);
        Assert.Equal("select-ticket", row.Action!.Name);
        Assert.Equal(id.ToString(), row.Action.Context!["id"]);
    }

    [Fact]
    public void QueueRow_FormatsLabelsAndDueDash()
    {
        SeedTicket(priority: "high", type: "hardware");
        var row = QueueTable(Page(CreateAgent().Get().Vm)).Rows.Single();
        Assert.Equal("Hardware", row.Cells["type"]);
        Assert.Equal("High",     row.Cells["priority"]);
        Assert.Equal("Open",     row.Cells["status"]);
        Assert.Equal("—",        row.Cells["due"]);   // no due date → em dash
    }

    // ── start-ticket ──────────────────────────────────────────────────────────

    [Fact]
    public void StartTicket_FromQueue_RowStatusBecomesInProgress()
    {
        var id = SeedTicket();
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "start-ticket", Ctx(new { id = id.ToString() })));
        var row = QueueTable(Page(resp.Vm)).Rows.Single();
        Assert.Equal("In Progress", row.Cells["status"]);
    }

    [Fact]
    public void StartTicket_UpdatesCountsLine()
    {
        var id = SeedTicket();
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "start-ticket", Ctx(new { id = id.ToString() })));
        Assert.Equal("0 open · 1 in progress · 0 resolved", CountsLine(Page(resp.Vm)).Value);
    }

    // ── select-ticket / ticket page ───────────────────────────────────────────

    [Fact]
    public void SelectTicket_ShowsTicketPage()
    {
        var id = SeedTicket("Broken keyboard");
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        var page = Page(resp.Vm);
        Assert.Equal("Broken keyboard", page.Title);
        // Full ticket page has a "← Back to Queue" button + Info/Notes/Actions sections.
        Assert.Contains(page.Children.OfType<ButtonNode>(), b => b.Action.Name == "back-to-queue");
        Assert.Contains(page.Children.OfType<SectionNode>(), s => s.Heading == "Ticket Info");
        Assert.Contains(page.Children.OfType<SectionNode>(), s => s.Heading == "Agent Notes");
        Assert.Contains(page.Children.OfType<SectionNode>(), s => s.Heading == "Actions");
    }

    [Fact]
    public void TicketPage_OpenTicket_HasMarkInProgressButton()
    {
        var id = SeedTicket();
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        var actions = Page(resp.Vm).Children.OfType<SectionNode>()
            .First(s => s.Heading == "Actions").Children.OfType<ButtonNode>().ToList();
        Assert.Single(actions);
        Assert.Equal("start-ticket", actions[0].Action.Name);
        Assert.Equal("Mark In Progress", actions[0].Label);
    }

    [Fact]
    public void TicketPage_InProgressTicket_HasMarkResolvedButton()
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
    public void TicketPage_ResolvedTicket_HasReopenButton()
    {
        var id = SeedTicket();
        _db.UpdateStatus(id, "resolved");
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        var actions = Page(resp.Vm).Children.OfType<SectionNode>()
            .First(s => s.Heading == "Actions").Children.OfType<ButtonNode>().ToList();
        Assert.Contains(actions, b => b.Action.Name == "reopen-ticket");
    }

    [Fact]
    public void TicketPage_HasNotesFormWithTextarea()
    {
        var id = SeedTicket();
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        var form = Page(resp.Vm).Children.OfType<SectionNode>()
            .First(s => s.Heading == "Agent Notes").Children.OfType<FormNode>().Single();
        Assert.Equal("save-notes", form.SubmitAction.Name);
        Assert.Equal("Save Notes", form.SubmitLabel);
        var field = form.Children.OfType<FieldNode>().Single();
        Assert.Equal("agent_notes", field.Name);
        Assert.Equal("textarea", field.InputType);
    }

    // ── resolve-ticket ────────────────────────────────────────────────────────

    [Fact]
    public void ResolveTicket_DetailThenResolve_ShowsReopen()
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
    public void ResolveTicket_ResolvedVariantInQueueRow()
    {
        var id = SeedTicket();
        _db.UpdateStatus(id, "in-progress");
        var ctrl = CreateAgent();
        Ok(Act(ctrl, AgentState.Initial(), "resolve-ticket", Ctx(new { id = id.ToString() })));
        var row = QueueTable(Page(ctrl.Get().Vm)).Rows.Single();
        Assert.Equal("done", row.Variant);
    }

    [Fact]
    public void HighPriorityOpenTicket_HasHighVariantInQueueRow()
    {
        SeedTicket(priority: "high");
        var row = QueueTable(Page(CreateAgent().Get().Vm)).Rows.Single();
        Assert.Equal("high", row.Variant);
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
    public void SaveNotes_PersistsAndShowsInTicketPage()
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
        // "Notes saved." confirmation surfaces after a save.
        Assert.Contains(form.Children.OfType<TextNode>(), t => t.Value == "Notes saved.");
    }

    // ── filter ────────────────────────────────────────────────────────────────

    [Fact]
    public void Filter_InProgress_ShowsOnlyInProgressRows()
    {
        SeedTicket("Open one");
        var id2 = SeedTicket("In-progress one");
        _db.UpdateStatus(id2, "in-progress");
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), "filter", Ctx(new { value = "in-progress" })));
        var page = Page(resp.Vm);
        Assert.Equal("in-progress", page.Children.OfType<TabsNode>().Single().Selected);
        var table = QueueTable(page);
        Assert.Single(table.Rows);
        Assert.Equal("In-progress one", table.Rows[0].Cells["title"]);
    }

    // ── shared DB across clients ──────────────────────────────────────────────

    [Fact]
    public void Tickets_SharedAcrossClients()
    {
        SeedTicket("Shared ticket");

        // A second "client" with its own initial state should still see DB tickets.
        var ctrl2 = CreateAgent();
        var table = QueueTable(Page(ctrl2.Get().Vm));
        Assert.Single(table.Rows);
    }

    // ── back-to-queue ─────────────────────────────────────────────────────────

    [Fact]
    public void BackToQueue_ReturnsQueueView()
    {
        var id = SeedTicket();
        var ctrl = CreateAgent();
        var step1 = Ok(Act(ctrl, AgentState.Initial(), "select-ticket", Ctx(new { id = id.ToString() })));
        var step2 = Ok(Act(ctrl, step1.State, "back-to-queue"));
        var page = Page(step2.Vm);
        Assert.Equal("Help Desk — Agent", page.Title);
        Assert.Contains(page.Children, c => c is TableNode);
    }

    // ── unknown action ────────────────────────────────────────────────────────

    [Fact]
    public void UnknownAction_ReturnsBadRequest()
    {
        var result = Act(CreateAgent(), AgentState.Initial(), "do-the-thing");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
