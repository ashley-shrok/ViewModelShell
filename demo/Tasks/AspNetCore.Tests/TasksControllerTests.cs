namespace ViewModelShell.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ViewModelShell.Controllers;
using ViewModelShell.Services;
using ViewModelShell.ViewModels;

public class TasksControllerTests
{
    // Wires up a real controller with a real store, no HTTP stack needed.
    private static TasksController CreateController(string tab = "test")
    {
        var controller = new TasksController(new TaskStoreRegistry());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                Request = { QueryString = new QueryString($"?tab={tab}") }
            }
        };
        return controller;
    }

    // Builds an ActionPayload context dict from an anonymous object.
    private static Dictionary<string, JsonElement> Ctx(object obj)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(obj));
        return doc.RootElement.EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.Clone());
    }

    private static PageNode Page(ActionResult<ViewNode> result) =>
        Assert.IsType<PageNode>(result.Value);

    private static ListNode TaskList(PageNode page) =>
        page.Children.OfType<ListNode>().Single();

    private static TabsNode Tabs(PageNode page) =>
        page.Children.OfType<TabsNode>().Single();

    private static StatBarNode StatBar(PageNode page) =>
        page.Children.OfType<StatBarNode>().Single();

    private static ProgressNode Progress(PageNode page) =>
        page.Children.OfType<ProgressNode>().Single();

    // ── GET /api/tasks ──────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsPageNode()
    {
        var controller = CreateController();
        var page = Page(controller.Get());
        Assert.Equal("Tasks", page.Title);
    }

    [Fact]
    public void Get_InitiallyHasThreeListItems()
    {
        var controller = CreateController();
        var list = TaskList(Page(controller.Get()));
        Assert.Equal(3, list.Children.Count);
    }

    [Fact]
    public void Get_InitialStatBar_ShowsOneOfThree()
    {
        var controller = CreateController();
        var stat = StatBar(Page(controller.Get())).Stats.Single();
        Assert.Equal("1 of 3", stat.Value);
    }

    [Fact]
    public void Get_InitialProgress_Is33Percent()
    {
        var controller = CreateController();
        Assert.Equal(33, Progress(Page(controller.Get())).Value);
    }

    [Fact]
    public void Get_TabsDefaultToAll()
    {
        var controller = CreateController();
        Assert.Equal("all", Tabs(Page(controller.Get())).Selected);
    }

    [Fact]
    public void Get_EachListItem_HasCheckboxTextAndDeleteButton()
    {
        var controller = CreateController();
        var list = TaskList(Page(controller.Get()));
        foreach (var node in list.Children.Cast<ListItemNode>())
        {
            Assert.Contains(node.Children, c => c is CheckboxNode);
            Assert.Contains(node.Children, c => c is TextNode);
            Assert.Contains(node.Children, c => c is ButtonNode b && b.Variant == "danger");
        }
    }

    // ── action: add ─────────────────────────────────────────────────────────────

    [Fact]
    public void Action_Add_IncreasesListCount()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("add", Ctx(new { title = "Buy milk" }))));
        Assert.Equal(4, TaskList(page).Children.Count);
    }

    [Fact]
    public void Action_Add_NewTaskAppearsInList()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("add", Ctx(new { title = "Buy milk" }))));
        var texts = TaskList(page).Children
            .Cast<ListItemNode>()
            .SelectMany(i => i.Children.OfType<TextNode>())
            .Select(t => t.Value);
        Assert.Contains("Buy milk", texts);
    }

    [Fact]
    public void Action_Add_EmptyTitle_ReturnsBadRequest()
    {
        var controller = CreateController();
        var result = controller.Action(new ActionPayload("add", Ctx(new { title = "" })));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_Add_WhitespaceTitle_ReturnsBadRequest()
    {
        var controller = CreateController();
        var result = controller.Action(new ActionPayload("add", Ctx(new { title = "   " })));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── action: toggle ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_Toggle_MarksActiveTaskDone()
    {
        var controller = CreateController();
        var initialList = TaskList(Page(controller.Get()));
        var activeItem = initialList.Children
            .Cast<ListItemNode>()
            .First(i => i.Variant == null);

        var page = Page(controller.Action(new ActionPayload("toggle",
            Ctx(new { id = activeItem.Id, @checked = true }))));

        var doneCount = TaskList(page).Children
            .Cast<ListItemNode>()
            .Count(i => i.Variant == "done");
        Assert.Equal(2, doneCount); // started with 1, now 2
    }

    [Fact]
    public void Action_Toggle_UncompletesDoneTask()
    {
        var controller = CreateController();
        var doneItem = TaskList(Page(controller.Get())).Children
            .Cast<ListItemNode>()
            .First(i => i.Variant == "done");

        var page = Page(controller.Action(new ActionPayload("toggle",
            Ctx(new { id = doneItem.Id, @checked = false }))));

        var doneCount = TaskList(page).Children
            .Cast<ListItemNode>()
            .Count(i => i.Variant == "done");
        Assert.Equal(0, doneCount);
    }

    [Fact]
    public void Action_Toggle_UpdatesProgressBar()
    {
        var controller = CreateController();
        var activeItem = TaskList(Page(controller.Get())).Children
            .Cast<ListItemNode>()
            .First(i => i.Variant == null);

        var page = Page(controller.Action(new ActionPayload("toggle",
            Ctx(new { id = activeItem.Id, @checked = true }))));

        Assert.Equal(67, Progress(page).Value); // 2 of 3 = 67%
    }

    // ── action: delete ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_Delete_RemovesTask()
    {
        var controller = CreateController();
        var item = TaskList(Page(controller.Get())).Children
            .Cast<ListItemNode>()
            .First();

        var page = Page(controller.Action(new ActionPayload("delete",
            Ctx(new { id = item.Id }))));

        Assert.Equal(2, TaskList(page).Children.Count);
    }

    [Fact]
    public void Action_Delete_RemovedTaskNotInList()
    {
        var controller = CreateController();
        var item = TaskList(Page(controller.Get())).Children
            .Cast<ListItemNode>()
            .First();

        var page = Page(controller.Action(new ActionPayload("delete",
            Ctx(new { id = item.Id }))));

        Assert.DoesNotContain(TaskList(page).Children.Cast<ListItemNode>(),
            i => i.Id == item.Id);
    }

    // ── action: filter ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_Filter_Active_UpdatesSelectedTab()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("filter", Ctx(new { value = "active" }))));
        Assert.Equal("active", Tabs(page).Selected);
    }

    [Fact]
    public void Action_Filter_Active_ExcludesCompletedTasks()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("filter", Ctx(new { value = "active" }))));
        var items = TaskList(page).Children.Cast<ListItemNode>().ToList();
        Assert.Equal(2, items.Count);
        Assert.All(items, i => Assert.Null(i.Variant));
    }

    [Fact]
    public void Action_Filter_Completed_ShowsOnlyDoneTasks()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("filter", Ctx(new { value = "completed" }))));
        var items = TaskList(page).Children.Cast<ListItemNode>().ToList();
        Assert.Single(items);
        Assert.Equal("done", items[0].Variant);
    }

    [Fact]
    public void Action_Filter_All_ShowsAllTasks()
    {
        var controller = CreateController();
        controller.Action(new ActionPayload("filter", Ctx(new { value = "active" })));
        var page = Page(controller.Action(new ActionPayload("filter", Ctx(new { value = "all" }))));
        Assert.Equal(3, TaskList(page).Children.Count);
    }

    [Fact]
    public void Action_UnknownName_ReturnsBadRequest()
    {
        var controller = CreateController();
        var result = controller.Action(new ActionPayload("fly-to-moon", null));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
