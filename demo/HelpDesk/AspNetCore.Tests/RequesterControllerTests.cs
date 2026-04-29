namespace HelpDesk.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Primitives;
using HelpDesk.Controllers;
using HelpDesk.ViewModels;

public class RequesterControllerTests : IDisposable
{
    private readonly SqliteConnection _anchor;
    private readonly HelpDeskDb _db;
    private readonly string _connStr;

    public RequesterControllerTests()
    {
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
        RequesterController ctrl, RequesterState state, string name,
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

    private static ShellResponse<RequesterState> Ok(ActionResult<ShellResponse<RequesterState>> result) =>
        result.Value ?? throw new Xunit.Sdk.XunitException("Expected a value, got " + result.Result?.GetType().Name);

    private static Dictionary<string, JsonElement> Ctx(object obj)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(obj));
        return doc.RootElement.EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.Clone());
    }

    private static PageNode Page(ViewNode vm) => Assert.IsType<PageNode>(vm);

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
    public void Get_HasFilterTabsDefaultingToAll()
    {
        var page = Page(CreateController().Get().Vm);
        var tabs = page.Children.OfType<TabsNode>().Single();
        Assert.Equal("all", tabs.Selected);
    }

    // ── start-create / create-ticket ──────────────────────────────────────────

    [Fact]
    public void StartCreate_SwitchesToCreateView()
    {
        var resp = Ok(Act(CreateController(), RequesterState.Initial(), "start-create"));
        Assert.Equal("New Ticket", Page(resp.Vm).Title);
    }

    [Fact]
    public void CreateView_HasTypeTabs_DefaultHardware()
    {
        var resp = Ok(Act(CreateController(), RequesterState.Initial(), "start-create"));
        var typeTabs = Page(resp.Vm).Children.OfType<TabsNode>().First();
        Assert.Equal("hardware", typeTabs.Selected);
    }

    [Fact]
    public void SetType_Software_ChangesFormFields()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        var step2 = Ok(Act(ctrl, step1.State, "set-type", Ctx(new { value = "software" })));
        var form = Page(step2.Vm).Children.OfType<FormNode>().Single();
        Assert.Contains(form.Children, c => c is FieldNode f && f.Name == "application");
        Assert.DoesNotContain(form.Children, c => c is FieldNode f && f.Name == "device_model");
    }

    [Fact]
    public void SetType_Access_ShowsAccessLevelTabs()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        var step2 = Ok(Act(ctrl, step1.State, "set-type", Ctx(new { value = "access" })));
        var allTabs = Page(step2.Vm).Children.OfType<TabsNode>().ToList();
        Assert.True(allTabs.Count >= 2);
        Assert.Contains(allTabs, t => t.Tabs.Any(tab => tab.Value == "read"));
    }

    [Fact]
    public void CreateTicket_EmptyTitle_ShowsValidationError()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        var step2 = Ok(Act(ctrl, step1.State, "create-ticket",
            Ctx(new { title = "", type = "hardware", priority = "medium" })));
        Assert.Equal("New Ticket", Page(step2.Vm).Title);
        var form = Page(step2.Vm).Children.OfType<FormNode>().Single();
        var error = form.Children.OfType<TextNode>().FirstOrDefault(t => t.Style == "error");
        Assert.NotNull(error);
    }

    [Fact]
    public void CreateTicket_Valid_ReturnsToListAndShowsTicket()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        var step2 = Ok(Act(ctrl, step1.State, "create-ticket",
            Ctx(new { title = "Laptop won't boot", type = "hardware",
                      priority = "high", device_model = "ThinkPad X1" })));
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
        var step2 = Ok(Act(ctrl, step1.State, "create-ticket",
            Ctx(new { title = "Needs VPN access", type = "access",
                      priority = "low", system_name = "VPN",
                      access_level = "read", due_date = "2026-06-01" })));

        var listPage = Page(step2.Vm);
        var item = listPage.Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();

        var step3 = Ok(Act(ctrl, step2.State, "select-ticket", Ctx(new { id = item.Id })));
        Assert.Contains(Page(step3.Vm).Children.OfType<SectionNode>().Single().Children.OfType<TextNode>(),
            t => t.Value.Contains("2026-06-01"));
    }

    // ── priority variant ──────────────────────────────────────────────────────

    [Fact]
    public void CriticalTicket_HasCriticalVariant()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        var step2 = Ok(Act(ctrl, step1.State, "create-ticket",
            Ctx(new { title = "Server down", type = "hardware", priority = "critical" })));
        var item = Page(step2.Vm).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.Equal("critical", item.Variant);
    }

    [Fact]
    public void HighTicket_HasHighVariant()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        var step2 = Ok(Act(ctrl, step1.State, "create-ticket",
            Ctx(new { title = "Email down", type = "software", priority = "high" })));
        var item = Page(step2.Vm).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.Equal("high", item.Variant);
    }

    // ── filter ────────────────────────────────────────────────────────────────

    [Fact]
    public void Filter_Open_ShowsOnlyOpenTickets()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        var step2 = Ok(Act(ctrl, step1.State, "create-ticket",
            Ctx(new { title = "T1", type = "hardware", priority = "low" })));
        var step3 = Ok(Act(ctrl, step2.State, "filter", Ctx(new { value = "open" })));
        Assert.Equal("open", Page(step3.Vm).Children.OfType<TabsNode>().Single().Selected);
        Assert.Single(Page(step3.Vm).Children.OfType<ListNode>().Single().Children.OfType<ListItemNode>());
    }

    // ── detail view ───────────────────────────────────────────────────────────

    [Fact]
    public void SelectTicket_ShowsDetailView()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        var step2 = Ok(Act(ctrl, step1.State, "create-ticket",
            Ctx(new { title = "My ticket", type = "software", priority = "medium" })));
        var item = Page(step2.Vm).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        var step3 = Ok(Act(ctrl, step2.State, "select-ticket", Ctx(new { id = item.Id })));
        Assert.Equal("My ticket", Page(step3.Vm).Title);
    }

    [Fact]
    public void DetailView_HasNoActionButtons()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        var step2 = Ok(Act(ctrl, step1.State, "create-ticket",
            Ctx(new { title = "Ticket", type = "hardware", priority = "low" })));
        var item = Page(step2.Vm).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        var step3 = Ok(Act(ctrl, step2.State, "select-ticket", Ctx(new { id = item.Id })));

        var allButtons = Page(step3.Vm).Children
            .SelectMany(c => c is SectionNode s ? s.Children : [c])
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
        var step2 = Ok(Act(ctrl, step1.State, "create-ticket",
            Ctx(new { title = "T", type = "hardware", priority = "low" })));
        var item = Page(step2.Vm).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        var step3 = Ok(Act(ctrl, step2.State, "select-ticket", Ctx(new { id = item.Id })));
        var step4 = Ok(Act(ctrl, step3.State, "back-to-list"));
        Assert.Equal("Help Desk", Page(step4.Vm).Title);
    }

    // ── stat bar ──────────────────────────────────────────────────────────────

    [Fact]
    public void StatBar_ReflectsTicketCounts()
    {
        var ctrl = CreateController();
        var s1 = Ok(Act(ctrl, RequesterState.Initial(), "start-create"));
        var s2 = Ok(Act(ctrl, s1.State, "create-ticket",
            Ctx(new { title = "T1", type = "hardware", priority = "low" })));
        var s3 = Ok(Act(ctrl, s2.State, "start-create"));
        var s4 = Ok(Act(ctrl, s3.State, "create-ticket",
            Ctx(new { title = "T2", type = "software", priority = "medium" })));
        var bar = Page(s4.Vm).Children.OfType<StatBarNode>().Single();
        Assert.Equal("2", bar.Stats.First(s => s.Label == "open").Value);
    }

    // ── unknown action ────────────────────────────────────────────────────────

    [Fact]
    public void UnknownAction_ReturnsBadRequest()
    {
        var result = Act(CreateController(), RequesterState.Initial(), "fly-to-moon");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
