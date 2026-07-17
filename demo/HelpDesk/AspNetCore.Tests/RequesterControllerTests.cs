namespace HelpDesk.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Primitives;
using HelpDesk.Controllers;
using ViewModelShell;

// Phase 6 (WIRE-07): tests pre-populate state slots (DraftTitle, DraftDescription,
// CreateType, CreatePriority, etc.) before dispatching by action name. Per-row
// "View" buttons use unique select-ticket-{id} action names; per-tab actions use
// unique filter-{value} / set-type-{value} / set-priority-{value} action names.
public class RequesterControllerTests : IDisposable
{
    private readonly SqliteConnection _anchor;
    private readonly HelpDeskDb _db;
    private readonly string _connStr;

    public RequesterControllerTests()
    {
        // Disable demo seeding so tests run against a clean schema.
        Environment.SetEnvironmentVariable("HELPDESK_SEED", "0");
        _connStr = $"Data Source={Guid.NewGuid():N};Mode=Memory;Cache=Shared";
        _anchor  = new SqliteConnection(_connStr);
        _anchor.Open();
        _db = new HelpDeskDb(_connStr);
    }

    public void Dispose() => _anchor.Dispose();

    private RequesterController CreateController()
    {
        var controller = new RequesterController(_db);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    private static ActionResult<ShellResponse<RequesterState>> Act(
        RequesterController ctrl, RequesterState state, string name)
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

    private static ShellResponse<RequesterState> Ok(ActionResult<ShellResponse<RequesterState>> result) =>
        result.Value ?? throw new Xunit.Sdk.XunitException("Expected a value, got " + result.Result?.GetType().Name);

    private static PageNode Page(ViewNode? vm) => Assert.IsType<PageNode>(vm);

    // ── GET ────────────────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsHelpDeskPage()
    {
        var page = Page(CreateController().Get().Vm);
        Assert.Equal("Help Desk", page.Title);
    }

    [Fact]
    public void Get_EmptyDb_ListIsEmpty()
    {
        var page = Page(CreateController().Get().Vm);
        var list = page.Children.OfType<ListNode>().Single();
        Assert.DoesNotContain(list.Children, c => c is ListItemNode);
    }

    [Fact]
    public void Get_HasStatBar_AllZero()
    {
        var page = Page(CreateController().Get().Vm);
        var bar  = page.Children.OfType<StatBarNode>().Single();
        Assert.Equal(3, bar.Stats.Count);
        Assert.All(bar.Stats, s => Assert.Equal("0", s.Value));
    }

    [Fact]
    public void Get_HasFilterTabsDefaultingToAll_WithUniqueActions()
    {
        var page = Page(CreateController().Get().Vm);
        var tabs = page.Children.OfType<TabsNode>().Single();
        Assert.Equal("all", tabs.Selected);
        Assert.Equal("filter", tabs.Bind);
        Assert.Equal(new[] { "filter-all", "filter-open", "filter-in-progress", "filter-resolved" },
            tabs.Tabs.Select(t => t.Action.Name).ToArray());
    }

    // ── start-create / create-ticket ──────────────────────────────────────────

    [Fact]
    public void StartCreate_SwitchesToCreateView()
    {
        var resp = Ok(Act(CreateController(), RequesterState.Initial(), "start-create"));
        Assert.Equal("New Ticket", Page(resp.Vm).Title);
    }

    [Fact]
    public void CreateView_HasTypeTabs_DefaultHardware_WithUniqueActions()
    {
        var resp = Ok(Act(CreateController(), RequesterState.Initial(), "start-create"));
        var typeTabs = Page(resp.Vm).Children.OfType<TabsNode>().First();
        Assert.Equal("hardware", typeTabs.Selected);
        Assert.Equal("createType", typeTabs.Bind);
        Assert.Equal(new[] { "set-type-hardware", "set-type-software", "set-type-access" },
            typeTabs.Tabs.Select(t => t.Action.Name).ToArray());
    }

    [Fact]
    public void SetType_Software_ChangesFormFields()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with { CreateType = "software" };
        var step2 = Ok(Act(ctrl, staged, "set-type-software"));
        var form = Page(step2.Vm).Children.OfType<FormNode>().Single();
        Assert.Contains(form.Children, c => c is FieldNode f && f.Name == "application");
        Assert.DoesNotContain(form.Children, c => c is FieldNode f && f.Name == "device_model");
    }

    [Fact]
    public void SetType_Access_ShowsAccessLevelTabs()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with { CreateType = "access" };
        var step2 = Ok(Act(ctrl, staged, "set-type-access"));
        var allTabs = Page(step2.Vm).Children.OfType<TabsNode>().ToList();
        Assert.True(allTabs.Count >= 2);
        Assert.Contains(allTabs, t => t.Tabs.Any(tab => tab.Value == "read"));
    }

    [Fact]
    public void CreateTicket_EmptyTitle_ShowsValidationError()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with { DraftTitle = "" };
        var step2 = Ok(Act(ctrl, staged, "create-ticket"));
        Assert.Equal("New Ticket", Page(step2.Vm).Title);
        var form = Page(step2.Vm).Children.OfType<FormNode>().Single();
        var error = form.Children.OfType<TextNode>().FirstOrDefault(t => t.Tone == Tone.Danger);
        Assert.NotNull(error);
    }

    [Fact]
    public void CreateTicket_EmptyTitle_SetsSoftRejection()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        var staged = step1.State! with { DraftTitle = "" };
        var step2 = Ok(Act(ctrl, staged, "create-ticket"));

        // Soft rejection rides on the ok:true render (vm/state preserved).
        Assert.True(step2.Ok);
        Assert.NotNull(step2.Vm);
        Assert.NotNull(step2.Rejected);
        var violation = Assert.Single(step2.Rejected!.Violations);
        Assert.Equal("draftTitle", violation.Path);
        Assert.Equal("Title is required.", violation.Message);
    }

    [Fact]
    public void CreateTicket_ValidTitle_NoRejection()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        var staged = step1.State! with { DraftTitle = "A real title" };
        var step2 = Ok(Act(ctrl, staged, "create-ticket"));
        Assert.Null(step2.Rejected);
    }

    [Fact]
    public void Rejection_SerializesAsRejected_OmittedWhenNull()
    {
        var web = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));

        // Rejecting path → "rejected" present on the wire with the violation.
        var rejected = Ok(Act(ctrl, step1.State! with { DraftTitle = "" }, "create-ticket"));
        var rejectedJson = JsonSerializer.Serialize(rejected, web);
        Assert.Contains("\"rejected\"", rejectedJson);
        Assert.Contains("\"violations\"", rejectedJson);
        Assert.Contains("draftTitle", rejectedJson);

        // Success path → "rejected" omitted entirely (WhenWritingNull).
        var success = Ok(Act(ctrl, step1.State! with { DraftTitle = "Real" }, "create-ticket"));
        var successJson = JsonSerializer.Serialize(success, web);
        Assert.DoesNotContain("\"rejected\"", successJson);
    }

    [Fact]
    public void CreateTicket_Valid_ReturnsToListAndShowsTicket()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with
        {
            DraftTitle = "Laptop won't boot",
            CreateType = "hardware",
            CreatePriority = "high",
            DraftDeviceModel = "ThinkPad X1",
        };
        var step2 = Ok(Act(ctrl, staged, "create-ticket"));
        Assert.Equal("Help Desk", Page(step2.Vm).Title);
        var list = Page(step2.Vm).Children.OfType<ListNode>().Single();
        var items = list.Children.OfType<ListItemNode>().ToList();
        Assert.Single(items);
        Assert.Contains(items[0].Children.OfType<TextNode>(),
            t => t.Value == "Laptop won't boot");
    }

    [Fact]
    public void CreateTicket_WithDueDate_StoredAndVisible()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with
        {
            DraftTitle = "Needs VPN access",
            CreateType = "access",
            CreatePriority = "low",
            CreateAccessLevel = "read",
            DraftSystemName = "VPN",
            DraftDueDate = "2026-06-01",
        };
        var step2 = Ok(Act(ctrl, staged, "create-ticket"));

        var listPage = Page(step2.Vm);
        var item = listPage.Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();

        Assert.NotNull(step2.State);
        var step3 = Ok(Act(ctrl, step2.State!, $"select-ticket-{item.Id}"));
        Assert.Contains(Page(step3.Vm).Children.OfType<SectionNode>().Single().Children.OfType<TextNode>(),
            t => t.Value.Contains("2026-06-01"));
    }

    // ── priority variant ──────────────────────────────────────────────────────

    [Fact]
    public void CriticalTicket_HasCriticalVariant()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with
        {
            DraftTitle = "Server down",
            CreateType = "hardware",
            CreatePriority = "critical",
        };
        var step2 = Ok(Act(ctrl, staged, "create-ticket"));
        var item = Page(step2.Vm).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.Equal(Tone.Danger, item.Tone);
    }

    [Fact]
    public void HighTicket_HasHighVariant()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with
        {
            DraftTitle = "Email down",
            CreateType = "software",
            CreatePriority = "high",
        };
        var step2 = Ok(Act(ctrl, staged, "create-ticket"));
        var item = Page(step2.Vm).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.Equal("high", item.State);
    }

    // ── filter ────────────────────────────────────────────────────────────────

    [Fact]
    public void Filter_Open_ShowsOnlyOpenTickets()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with
        {
            DraftTitle = "T1",
            CreateType = "hardware",
            CreatePriority = "low",
        };
        var step2 = Ok(Act(ctrl, staged, "create-ticket"));
        Assert.NotNull(step2.State);
        var step3 = Ok(Act(ctrl, step2.State! with { Filter = "open" }, "filter-open"));
        Assert.Equal("open", Page(step3.Vm).Children.OfType<TabsNode>().Single().Selected);
        Assert.Single(Page(step3.Vm).Children.OfType<ListNode>().Single().Children.OfType<ListItemNode>());
    }

    // ── detail view ───────────────────────────────────────────────────────────

    [Fact]
    public void SelectTicket_ShowsDetailView()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with
        {
            DraftTitle = "My ticket",
            CreateType = "software",
            CreatePriority = "medium",
        };
        var step2 = Ok(Act(ctrl, staged, "create-ticket"));
        var item = Page(step2.Vm).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.NotNull(step2.State);
        var step3 = Ok(Act(ctrl, step2.State!, $"select-ticket-{item.Id}"));
        Assert.Equal("My ticket", Page(step3.Vm).Title);
    }

    [Fact]
    public void DetailView_HasNoActionButtons()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with
        {
            DraftTitle = "Ticket",
            CreateType = "hardware",
            CreatePriority = "low",
        };
        var step2 = Ok(Act(ctrl, staged, "create-ticket"));
        var item = Page(step2.Vm).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.NotNull(step2.State);
        var step3 = Ok(Act(ctrl, step2.State!, $"select-ticket-{item.Id}"));

        var allButtons = Page(step3.Vm).Children
            .SelectMany<ViewNode, ViewNode>(c => c is SectionNode s ? s.Children : new[] { c })
            .OfType<ButtonNode>()
            .Where(b => b.Action.Name != "back-to-list")
            .ToList();
        Assert.Empty(allButtons);
    }

    [Fact]
    public void BackToList_ReturnsListView()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with
        {
            DraftTitle = "T",
            CreateType = "hardware",
            CreatePriority = "low",
        };
        var step2 = Ok(Act(ctrl, staged, "create-ticket"));
        var item = Page(step2.Vm).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.NotNull(step2.State);
        var step3 = Ok(Act(ctrl, step2.State!, $"select-ticket-{item.Id}"));
        Assert.NotNull(step3.State);
        var step4 = Ok(Act(ctrl, step3.State!, "back-to-list"));
        Assert.Equal("Help Desk", Page(step4.Vm).Title);
    }

    // ── stat bar ──────────────────────────────────────────────────────────────

    [Fact]
    public void StatBar_ReflectsTicketCounts()
    {
        var ctrl = CreateController();
        var s1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        Assert.NotNull(s1.State);
        var s2 = Ok(Act(ctrl, s1.State! with
        {
            DraftTitle = "T1", CreateType = "hardware", CreatePriority = "low",
        }, "create-ticket"));
        Assert.NotNull(s2.State);
        var s3 = Ok(Act(ctrl, s2.State!, "start-create"));
        Assert.NotNull(s3.State);
        var s4 = Ok(Act(ctrl, s3.State! with
        {
            DraftTitle = "T2", CreateType = "software", CreatePriority = "medium",
        }, "create-ticket"));
        var bar = Page(s4.Vm).Children.OfType<StatBarNode>().Single();
        Assert.Equal("2", bar.Stats.First(s => s.Label == "open").Value);
    }

    // ── unknown action ────────────────────────────────────────────────────────

    [Fact]
    public void UnknownAction_Throws()
    {
        Assert.Throws<UnknownActionException>(() => Act(CreateController(), RequesterState.Initial(), "fly-to-moon"));
    }
}
