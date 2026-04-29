namespace ViewModelShell.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using ViewModelShell.Controllers;
using ViewModelShell.State;
using ViewModelShell.ViewModels;

public class TasksControllerTests
{
    private static TasksController CreateController()
    {
        var controller = new TasksController();
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    private static Dictionary<string, JsonElement> Ctx(object obj)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(obj));
        return doc.RootElement.EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.Clone());
    }

    private static ActionResult<ShellResponse<TasksState>> Act(
        TasksController ctrl, TasksState state, string name,
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

    private static ShellResponse<TasksState> Ok(ActionResult<ShellResponse<TasksState>> result) =>
        result.Value ?? throw new Xunit.Sdk.XunitException("Expected a value, got " + result.Result?.GetType().Name);

    private static PageNode Page(ViewNode vm) => Assert.IsType<PageNode>(vm);
    private static ListNode TaskList(PageNode page) => page.Children.OfType<ListNode>().Single();
    private static TabsNode Tabs(PageNode page) => page.Children.OfType<TabsNode>().Single();
    private static StatBarNode StatBar(PageNode page) => page.Children.OfType<StatBarNode>().Single();
    private static ProgressNode Progress(PageNode page) => page.Children.OfType<ProgressNode>().Single();

    // ── GET /api/tasks ──────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsPageNode()
    {
        var page = Page(CreateController().Get().Vm);
        Assert.Equal("Tasks", page.Title);
    }

    [Fact]
    public void Get_InitiallyHasThreeListItems()
    {
        var list = TaskList(Page(CreateController().Get().Vm));
        Assert.Equal(3, list.Children.Count);
    }

    [Fact]
    public void Get_ReturnsInitialState()
    {
        var resp = CreateController().Get();
        Assert.Equal(3, resp.State.Items.Count);
        Assert.Equal("all", resp.State.Filter);
    }

    [Fact]
    public void Get_InitialStatBar_ShowsOneOfThree()
    {
        var stat = StatBar(Page(CreateController().Get().Vm)).Stats.Single();
        Assert.Equal("1 of 3", stat.Value);
    }

    [Fact]
    public void Get_InitialProgress_Is33Percent()
    {
        Assert.Equal(33, Progress(Page(CreateController().Get().Vm)).Value);
    }

    [Fact]
    public void Get_TabsDefaultToAll()
    {
        Assert.Equal("all", Tabs(Page(CreateController().Get().Vm)).Selected);
    }

    [Fact]
    public void Get_EachListItem_HasCheckboxTextAndDeleteButton()
    {
        var list = TaskList(Page(CreateController().Get().Vm));
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
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "add", Ctx(new { title = "Buy milk" })));
        Assert.Equal(4, TaskList(Page(resp.Vm)).Children.Count);
        Assert.Equal(4, resp.State.Items.Count);
    }

    [Fact]
    public void Action_Add_NewTaskAppearsInList()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "add", Ctx(new { title = "Buy milk" })));
        var texts = TaskList(Page(resp.Vm)).Children
            .Cast<ListItemNode>()
            .SelectMany(i => i.Children.OfType<TextNode>())
            .Select(t => t.Value);
        Assert.Contains("Buy milk", texts);
    }

    [Fact]
    public void Action_Add_EmptyTitle_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var result = Act(ctrl, TasksState.Initial(), "add", Ctx(new { title = "" }));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_Add_WhitespaceTitle_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var result = Act(ctrl, TasksState.Initial(), "add", Ctx(new { title = "   " }));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── action: toggle ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_Toggle_MarksActiveTaskDone()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var activeId = initial.Items.First(t => !t.Completed).Id;

        var resp = Ok(Act(ctrl, initial, "toggle", Ctx(new { id = activeId, @checked = true })));

        var doneCount = TaskList(Page(resp.Vm)).Children
            .Cast<ListItemNode>()
            .Count(i => i.Variant == "done");
        Assert.Equal(2, doneCount);
    }

    [Fact]
    public void Action_Toggle_UncompletesDoneTask()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var doneId = initial.Items.First(t => t.Completed).Id;

        var resp = Ok(Act(ctrl, initial, "toggle", Ctx(new { id = doneId, @checked = false })));

        var doneCount = TaskList(Page(resp.Vm)).Children
            .Cast<ListItemNode>()
            .Count(i => i.Variant == "done");
        Assert.Equal(0, doneCount);
    }

    [Fact]
    public void Action_Toggle_UpdatesProgressBar()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var activeId = initial.Items.First(t => !t.Completed).Id;

        var resp = Ok(Act(ctrl, initial, "toggle", Ctx(new { id = activeId, @checked = true })));

        Assert.Equal(67, Progress(Page(resp.Vm)).Value);
    }

    // ── action: delete ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_Delete_RemovesTask()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var firstId = initial.Items[0].Id;

        var resp = Ok(Act(ctrl, initial, "delete", Ctx(new { id = firstId })));

        Assert.Equal(2, TaskList(Page(resp.Vm)).Children.Count);
        Assert.Equal(2, resp.State.Items.Count);
    }

    [Fact]
    public void Action_Delete_RemovedTaskNotInList()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var firstId = initial.Items[0].Id;

        var resp = Ok(Act(ctrl, initial, "delete", Ctx(new { id = firstId })));

        Assert.DoesNotContain(TaskList(Page(resp.Vm)).Children.Cast<ListItemNode>(),
            i => i.Id == firstId);
    }

    // ── action: filter ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_Filter_Active_UpdatesSelectedTab()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "filter", Ctx(new { value = "active" })));
        Assert.Equal("active", Tabs(Page(resp.Vm)).Selected);
        Assert.Equal("active", resp.State.Filter);
    }

    [Fact]
    public void Action_Filter_Active_ExcludesCompletedTasks()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "filter", Ctx(new { value = "active" })));
        var items = TaskList(Page(resp.Vm)).Children.Cast<ListItemNode>().ToList();
        Assert.Equal(2, items.Count);
        Assert.All(items, i => Assert.Null(i.Variant));
    }

    [Fact]
    public void Action_Filter_Completed_ShowsOnlyDoneTasks()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "filter", Ctx(new { value = "completed" })));
        var items = TaskList(Page(resp.Vm)).Children.Cast<ListItemNode>().ToList();
        Assert.Single(items);
        Assert.Equal("done", items[0].Variant);
    }

    [Fact]
    public void Action_Filter_All_ShowsAllTasks()
    {
        var ctrl = CreateController();
        // Two-step: first set filter to active, then back to all (state carries through).
        var step1 = Ok(Act(ctrl, TasksState.Initial(), "filter", Ctx(new { value = "active" })));
        var step2 = Ok(Act(ctrl, step1.State, "filter", Ctx(new { value = "all" })));
        Assert.Equal(3, TaskList(Page(step2.Vm)).Children.Count);
    }

    [Fact]
    public void Action_UnknownName_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var result = Act(ctrl, TasksState.Initial(), "fly-to-moon");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
