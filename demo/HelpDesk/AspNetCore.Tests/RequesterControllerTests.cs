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

    private RequesterController CreateController(string tab = "test")
    {
        var controller = new RequesterController(new RequesterStateRegistry(), _db);
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
        RequesterController ctrl, string name, Dictionary<string, JsonElement>? ctx = null)
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

    // ── GET ────────────────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsHelpDeskPage()
    {
        var page = Page(CreateController().Get());
        Assert.Equal("Help Desk", page.Title);
    }

    [Fact]
    public void Get_EmptyDb_ListIsEmpty()
    {
        var page = Page(CreateController().Get());
        var list = page.Children.OfType<ListNode>().Single();
        Assert.DoesNotContain(list.Children, c => c is ListItemNode);
    }

    [Fact]
    public void Get_HasStatBar_AllZero()
    {
        var page = Page(CreateController().Get());
        var bar  = page.Children.OfType<StatBarNode>().Single();
        Assert.Equal(3, bar.Stats.Count);
        Assert.All(bar.Stats, s => Assert.Equal("0", s.Value));
    }

    [Fact]
    public void Get_HasFilterTabsDefaultingToAll()
    {
        var page = Page(CreateController().Get());
        var tabs = page.Children.OfType<TabsNode>().Single();
        Assert.Equal("all", tabs.Selected);
    }

    // ── start-create / create-ticket ──────────────────────────────────────────

    [Fact]
    public void StartCreate_SwitchesToCreateView()
    {
        var ctrl = CreateController();
        var page = Page(Act(ctrl, "start-create"));
        Assert.Equal("New Ticket", page.Title);
    }

    [Fact]
    public void CreateView_HasTypeTabs_DefaultHardware()
    {
        var ctrl = CreateController();
        Act(ctrl, "start-create");
        var page = Page(Act(ctrl, "start-create"));
        var typeTabs = page.Children.OfType<TabsNode>().First();
        Assert.Equal("hardware", typeTabs.Selected);
    }

    [Fact]
    public void SetType_Software_ChangesFormFields()
    {
        var ctrl = CreateController();
        Act(ctrl, "start-create");
        var page = Page(Act(ctrl, "set-type", Ctx(new { value = "software" })));
        var form = page.Children.OfType<FormNode>().Single();
        Assert.Contains(form.Children, c => c is FieldNode f && f.Name == "application");
        Assert.DoesNotContain(form.Children, c => c is FieldNode f && f.Name == "device_model");
    }

    [Fact]
    public void SetType_Access_ShowsAccessLevelTabs()
    {
        var ctrl = CreateController();
        Act(ctrl, "start-create");
        var page = Page(Act(ctrl, "set-type", Ctx(new { value = "access" })));
        var allTabs = page.Children.OfType<TabsNode>().ToList();
        Assert.True(allTabs.Count >= 2);
        Assert.Contains(allTabs, t => t.Tabs.Any(tab => tab.Value == "read"));
    }

    [Fact]
    public void CreateTicket_EmptyTitle_ShowsValidationError()
    {
        var ctrl = CreateController();
        Act(ctrl, "start-create");
        var page = Page(Act(ctrl, "create-ticket",
            Ctx(new { title = "", type = "hardware", priority = "medium" })));
        Assert.Equal("New Ticket", page.Title);
        var form = page.Children.OfType<FormNode>().Single();
        var error = form.Children.OfType<TextNode>().FirstOrDefault(t => t.Style == "error");
        Assert.NotNull(error);
    }

    [Fact]
    public void CreateTicket_Valid_ReturnsToListAndShowsTicket()
    {
        var ctrl = CreateController();
        Act(ctrl, "start-create");
        var page = Page(Act(ctrl, "create-ticket",
            Ctx(new { title = "Laptop won't boot", type = "hardware",
                      priority = "high", device_model = "ThinkPad X1" })));
        Assert.Equal("Help Desk", page.Title);
        var list = page.Children.OfType<ListNode>().Single();
        var items = list.Children.OfType<ListItemNode>().ToList();
        Assert.Single(items);
        Assert.Contains(items[0].Children.OfType<TextNode>(),
            t => t.Value == "Laptop won't boot");
    }

    [Fact]
    public void CreateTicket_WithDueDate_StoredAndVisible()
    {
        var ctrl = CreateController();
        Act(ctrl, "start-create");
        Act(ctrl, "create-ticket",
            Ctx(new { title = "Needs VPN access", type = "access",
                      priority = "low", system_name = "VPN",
                      access_level = "read", due_date = "2026-06-01" }));

        var listPage = Page(ctrl.Get());
        var item = listPage.Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();

        var detailPage = Page(Act(ctrl, "select-ticket", Ctx(new { id = item.Id })));
        Assert.Contains(detailPage.Children.OfType<SectionNode>().Single().Children.OfType<TextNode>(),
            t => t.Value.Contains("2026-06-01"));
    }

    // ── priority variant ──────────────────────────────────────────────────────

    [Fact]
    public void CriticalTicket_HasCriticalVariant()
    {
        var ctrl = CreateController();
        Act(ctrl, "start-create");
        Act(ctrl, "create-ticket",
            Ctx(new { title = "Server down", type = "hardware", priority = "critical" }));
        var page = Page(ctrl.Get());
        var item = page.Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.Equal("critical", item.Variant);
    }

    [Fact]
    public void HighTicket_HasHighVariant()
    {
        var ctrl = CreateController();
        Act(ctrl, "start-create");
        Act(ctrl, "create-ticket",
            Ctx(new { title = "Email down", type = "software", priority = "high" }));
        var item = Page(ctrl.Get()).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Assert.Equal("high", item.Variant);
    }

    // ── filter ────────────────────────────────────────────────────────────────

    [Fact]
    public void Filter_Open_ShowsOnlyOpenTickets()
    {
        var ctrl = CreateController();
        Act(ctrl, "start-create");
        Act(ctrl, "create-ticket",
            Ctx(new { title = "T1", type = "hardware", priority = "low" }));
        var page = Page(Act(ctrl, "filter", Ctx(new { value = "open" })));
        Assert.Equal("open", page.Children.OfType<TabsNode>().Single().Selected);
        Assert.Single(page.Children.OfType<ListNode>().Single().Children.OfType<ListItemNode>());
    }

    // ── detail view ───────────────────────────────────────────────────────────

    [Fact]
    public void SelectTicket_ShowsDetailView()
    {
        var ctrl = CreateController();
        Act(ctrl, "start-create");
        Act(ctrl, "create-ticket",
            Ctx(new { title = "My ticket", type = "software", priority = "medium" }));
        var listPage = Page(ctrl.Get());
        var item = listPage.Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();

        var detailPage = Page(Act(ctrl, "select-ticket", Ctx(new { id = item.Id })));
        Assert.Equal("My ticket", detailPage.Title);
    }

    [Fact]
    public void DetailView_HasNoActionButtons()
    {
        var ctrl = CreateController();
        Act(ctrl, "start-create");
        Act(ctrl, "create-ticket",
            Ctx(new { title = "Ticket", type = "hardware", priority = "low" }));
        var item = Page(ctrl.Get()).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        var detailPage = Page(Act(ctrl, "select-ticket", Ctx(new { id = item.Id })));

        var allButtons = detailPage.Children
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
        Act(ctrl, "start-create");
        Act(ctrl, "create-ticket",
            Ctx(new { title = "T", type = "hardware", priority = "low" }));
        var item = Page(ctrl.Get()).Children.OfType<ListNode>().Single()
            .Children.OfType<ListItemNode>().Single();
        Act(ctrl, "select-ticket", Ctx(new { id = item.Id }));

        var page = Page(Act(ctrl, "back-to-list"));
        Assert.Equal("Help Desk", page.Title);
    }

    // ── stat bar ──────────────────────────────────────────────────────────────

    [Fact]
    public void StatBar_ReflectsTicketCounts()
    {
        var ctrl = CreateController();
        Act(ctrl, "start-create");
        Act(ctrl, "create-ticket",
            Ctx(new { title = "T1", type = "hardware", priority = "low" }));
        Act(ctrl, "start-create");
        Act(ctrl, "create-ticket",
            Ctx(new { title = "T2", type = "software", priority = "medium" }));
        var page = Page(ctrl.Get());
        var bar  = page.Children.OfType<StatBarNode>().Single();
        Assert.Equal("2", bar.Stats.First(s => s.Label == "open").Value);
    }

    // ── unknown action ────────────────────────────────────────────────────────

    [Fact]
    public void UnknownAction_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var result = Act(ctrl, "fly-to-moon");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
