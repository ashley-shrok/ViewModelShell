namespace HelpDesk.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Primitives;
using HelpDesk.Controllers;
using ViewModelShell;

// Phase 6 (WIRE-07): per-row identity is encoded in action names
// (select-ticket-{id}); bulk actions read truthy entries from
// state.SelectedIds (the canonical workflow's "selection across the visible
// chunk" is now expressed as per-row CheckboxNodes bound to that map).
// Tests dispatch by action name; selection is modeled by populating
// state.SelectedIds before dispatch.
public class AgentControllerTests : IDisposable
{
    private readonly SqliteConnection _anchor;
    private readonly HelpDeskDb _db;
    private readonly string _connStr;

    public AgentControllerTests()
    {
        // Disable demo seeding so tests run against a clean schema.
        Environment.SetEnvironmentVariable("HELPDESK_SEED", "0");
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
        AgentController ctrl, AgentState state, string name)
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

    private static ShellResponse<AgentState> Ok(ActionResult<ShellResponse<AgentState>> result) =>
        result.Value ?? throw new Xunit.Sdk.XunitException("Expected a value, got " + result.Result?.GetType().Name);

    private static PageNode Page(ViewNode? vm) => Assert.IsType<PageNode>(vm);

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
    public void Get_HasCountsLineAndFilterTabsWithUniqueActions()
    {
        var page = Page(CreateAgent().Get().Vm);
        Assert.DoesNotContain(page.Children, c => c is StatBarNode);
        Assert.Equal("0 open · 0 in progress · 0 resolved", CountsLine(page).Value);
        var tabs = page.Children.OfType<TabsNode>().Single();
        Assert.Equal("all", tabs.Selected);
        Assert.Equal("filter", tabs.Bind);
        Assert.Equal(new[] { "filter-all", "filter-open", "filter-in-progress", "filter-resolved" },
            tabs.Tabs.Select(t => t.Action.Name).ToArray());
    }

    [Fact]
    public void Get_EmptyQueue_ShowsEmptyMessageNoTable()
    {
        var page = Page(CreateAgent().Get().Vm);
        Assert.DoesNotContain(page.Children, c => c is TableNode);
        Assert.Contains(page.Children.OfType<TextNode>(), t => t.Value == "No tickets in queue.");
    }

    [Fact]
    public void Get_FilterMatchesZeroAgainstNonEmptyDb_ShowsNoMatchMessageAndKeepsTable()
    {
        // DB has tickets, but the title filter narrows the result to zero.
        // The user needs a distinct signal vs. an empty DB AND vs. broken
        // render — and the TableNode must still render so the filter input
        // stays reachable to edit/clear.
        SeedTicket("Printer broken");
        var ctrl  = CreateAgent();
        var state = AgentState.Initial() with { TitleFilter = "xyzzy" };
        var page  = Page(Ok(Act(ctrl, state, "filter-text")).Vm);

        Assert.Contains(page.Children.OfType<TextNode>(), t => t.Value == "No tickets match your filter.");
        Assert.DoesNotContain(page.Children.OfType<TextNode>(), t => t.Value == "No tickets in queue.");
        var table = QueueTable(page);
        Assert.Empty(table.Rows);
        Assert.Equal("xyzzy", table.Columns.Single(c => c.Key == "title").FilterValue);
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
    public void QueueRow_HasBoundSelectionCheckboxAndClickAnywhereRowAction()
    {
        var id = SeedTicket();
        var table = QueueTable(Page(CreateAgent().Get().Vm));
        var row = table.Rows.Single();
        Assert.Equal(id.ToString(), row.Id);
        Assert.NotNull(row.Actions);

        // Selection checkbox bound to selectedIds.{id} is still present.
        var checkbox = row.Actions!.OfType<CheckboxNode>().Single();
        Assert.Equal($"selectedIds.{id}", checkbox.Bind);

        // The per-row "Open" ButtonNode is GONE — replaced by row.Action so
        // the entire row is click-anywhere navigation (260613-qmh / 1.1.0).
        Assert.Empty(row.Actions!.OfType<ButtonNode>());

        // Row-level click-anywhere action carries the navigation intent.
        Assert.NotNull(row.Action);
        Assert.Equal($"select-ticket-{id}", row.Action!.Name);
    }

    [Fact]
    public void QueueRow_FormatsLabelsAndDueDash()
    {
        SeedTicket(priority: "high", type: "hardware");
        var row = QueueTable(Page(CreateAgent().Get().Vm)).Rows.Single();
        Assert.Equal("Hardware", row.Cells["type"]);
        Assert.Equal("High",     row.Cells["priority"]);
        Assert.Equal("Open",     row.Cells["status"]);
        Assert.Equal("—",        row.Cells["due"]);
    }

    // ── select-ticket / ticket page ───────────────────────────────────────────

    [Fact]
    public void SelectTicket_ShowsTicketPage()
    {
        var id = SeedTicket("Broken keyboard");
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), $"select-ticket-{id}"));
        var page = Page(resp.Vm);
        Assert.Equal("Broken keyboard", page.Title);
        Assert.Contains(page.Children.OfType<ButtonNode>(), b => b.Action.Name == "back-to-queue");
        Assert.Contains(page.Children.OfType<SectionNode>(), s => s.Heading == "Ticket Info");
        Assert.Contains(page.Children.OfType<SectionNode>(), s => s.Heading == "Agent Notes");
        Assert.Contains(page.Children.OfType<SectionNode>(), s => s.Heading == "Actions");
    }

    [Fact]
    public void TicketPage_OpenTicket_HasMarkInProgressButton()
    {
        var id = SeedTicket();
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), $"select-ticket-{id}"));
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
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), $"select-ticket-{id}"));
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
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), $"select-ticket-{id}"));
        var actions = Page(resp.Vm).Children.OfType<SectionNode>()
            .First(s => s.Heading == "Actions").Children.OfType<ButtonNode>().ToList();
        Assert.Contains(actions, b => b.Action.Name == "reopen-ticket");
    }

    [Fact]
    public void TicketPage_HasBoundNotesFormWithTextarea()
    {
        var id = SeedTicket();
        var resp = Ok(Act(CreateAgent(), AgentState.Initial(), $"select-ticket-{id}"));
        var form = Page(resp.Vm).Children.OfType<SectionNode>()
            .First(s => s.Heading == "Agent Notes").Children.OfType<FormNode>().Single();
        Assert.NotNull(form.SubmitAction);
        Assert.Equal("save-notes", form.SubmitAction!.Name);
        Assert.Equal("Save Notes", form.SubmitLabel);
        var field = form.Children.OfType<FieldNode>().Single();
        Assert.Equal("agent_notes", field.Name);
        Assert.Equal("textarea", field.InputType);
        Assert.Equal("agentNotes", field.Bind);
    }

    // ── resolve-ticket ────────────────────────────────────────────────────────

    [Fact]
    public void ResolveTicket_DetailThenResolve_ShowsReopen()
    {
        var id = SeedTicket();
        _db.UpdateStatus(id, "in-progress");
        var ctrl = CreateAgent();
        var step1 = Ok(Act(ctrl, AgentState.Initial(), $"select-ticket-{id}"));
        Assert.NotNull(step1.State);
        var step2 = Ok(Act(ctrl, step1.State!, "resolve-ticket"));
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
        var detail = Ok(Act(ctrl, AgentState.Initial(), $"select-ticket-{id}"));
        Assert.NotNull(detail.State);
        Ok(Act(ctrl, detail.State!, "resolve-ticket"));
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
        var step1 = Ok(Act(ctrl, AgentState.Initial(), $"select-ticket-{id}"));
        Assert.NotNull(step1.State);
        var step2 = Ok(Act(ctrl, step1.State!, "reopen-ticket"));
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
        var step1 = Ok(Act(ctrl, AgentState.Initial(), $"select-ticket-{id}"));
        Assert.NotNull(step1.State);
        // The textarea bind has already written the typed value to AgentNotes
        // before the form's "save-notes" submit fires. Model that here.
        var staged = step1.State! with { AgentNotes = "Checked hardware, needs replacement." };
        var step2 = Ok(Act(ctrl, staged, "save-notes"));
        var notesSection = Page(step2.Vm).Children.OfType<SectionNode>()
            .First(s => s.Heading == "Agent Notes");
        var form = notesSection.Children.OfType<FormNode>().Single();
        // "Notes saved." confirmation surfaces after a save.
        Assert.Contains(form.Children.OfType<TextNode>(), t => t.Value == "Notes saved.");
        // The state's AgentNotes survived (it's the wire's source of truth now).
        Assert.NotNull(step2.State);
        Assert.Equal("Checked hardware, needs replacement.", step2.State!.AgentNotes);
    }

    // ── filter ────────────────────────────────────────────────────────────────

    [Fact]
    public void Filter_InProgress_ShowsOnlyInProgressRows()
    {
        SeedTicket("Open one");
        var id2 = SeedTicket("In-progress one");
        _db.UpdateStatus(id2, "in-progress");
        // The TabsNode bind has already written Filter; the action just
        // triggers the re-render.
        var staged = AgentState.Initial() with { Filter = "in-progress" };
        var resp = Ok(Act(CreateAgent(), staged, "filter-in-progress"));
        var page = Page(resp.Vm);
        Assert.Equal("in-progress", page.Children.OfType<TabsNode>().Single().Selected);
        var table = QueueTable(page);
        Assert.Single(table.Rows);
        Assert.Equal("In-progress one", table.Rows[0].Cells["title"]);
    }

    // ── bulk actions (canonical workflow pattern) ──────────────────────────────
    // Selection lives in state.SelectedIds keyed by ticket id; the per-row
    // checkbox bind writes true to it. Bulk actions read truthy keys.

    [Fact]
    public void BulkResolve_AppliesToSelectedIds()
    {
        var id1 = SeedTicket("T1");
        var id2 = SeedTicket("T2");
        var id3 = SeedTicket("T3");
        _ = id3; // unselected; should remain open

        var staged = AgentState.Initial() with
        {
            SelectedIds = new Dictionary<string, bool>
            {
                [id1.ToString()] = true,
                [id2.ToString()] = true,
                [id3.ToString()] = false,
            },
        };
        var resp = Ok(Act(CreateAgent(), staged, "bulk-resolve"));
        Assert.NotNull(resp.State);
        // The handler clears selection after acting.
        Assert.Empty(resp.State!.SelectedIds);

        var rows = QueueTable(Page(resp.Vm)).Rows;
        Assert.Equal("Resolved", rows.First(r => r.Id == id1.ToString()).Cells["status"]);
        Assert.Equal("Resolved", rows.First(r => r.Id == id2.ToString()).Cells["status"]);
        Assert.Equal("Open",     rows.First(r => r.Id == id3.ToString()).Cells["status"]);
    }

    [Fact]
    public void BulkStart_AppliesToSelectedIds()
    {
        var id1 = SeedTicket();
        var staged = AgentState.Initial() with
        {
            SelectedIds = new Dictionary<string, bool> { [id1.ToString()] = true },
        };
        var resp = Ok(Act(CreateAgent(), staged, "bulk-start"));
        var row = QueueTable(Page(resp.Vm)).Rows.Single();
        Assert.Equal("In Progress", row.Cells["status"]);
    }

    [Fact]
    public void BulkActionToolbar_Visible_WhenTicketsExist()
    {
        SeedTicket("T1");
        var page = Page(CreateAgent().Get().Vm);
        // Bulk-action ButtonNodes live in a section above the table.
        var bulkSection = page.Children.OfType<SectionNode>()
            .First(s => s.Heading == null);
        Assert.Contains(bulkSection.Children, c => c is ButtonNode b && b.Action.Name == "bulk-start");
        Assert.Contains(bulkSection.Children, c => c is ButtonNode b && b.Action.Name == "bulk-resolve");
        Assert.Contains(bulkSection.Children, c => c is ButtonNode b && b.Action.Name == "bulk-reopen");
    }

    // ── shared DB across clients ──────────────────────────────────────────────

    [Fact]
    public void Tickets_SharedAcrossClients()
    {
        SeedTicket("Shared ticket");
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
        var step1 = Ok(Act(ctrl, AgentState.Initial(), $"select-ticket-{id}"));
        Assert.NotNull(step1.State);
        var step2 = Ok(Act(ctrl, step1.State!, "back-to-queue"));
        var page = Page(step2.Vm);
        Assert.Equal("Help Desk — Agent", page.Title);
        Assert.Contains(page.Children, c => c is TableNode);
    }

    // ── unknown action ────────────────────────────────────────────────────────

    [Fact]
    public void UnknownAction_Throws()
    {
        Assert.Throws<UnknownActionException>(() => Act(CreateAgent(), AgentState.Initial(), "do-the-thing"));
    }
}
