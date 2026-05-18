namespace ViewModelShell.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using ViewModelShell.Controllers;
using ViewModelShell.State;
using ViewModelShell;

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

    // ── Tree navigation helpers (the 0.4.0 "sidebar" redesign) ──────────────────
    // PageNode("Tasks",[rail,main],Layout:"sidebar")
    //   rail = SectionNode("Views",[ListNode(navItems)],Variant:"card")
    //   main = SectionNode(null,[TextNode muted, ProgressNode, FormNode inline, ListNode])

    private static PageNode Page(ViewNode vm) => Assert.IsType<PageNode>(vm);

    private static SectionNode Rail(PageNode page) =>
        page.Children.OfType<SectionNode>().First(s => s.Heading == "Views");

    private static SectionNode MainCol(PageNode page) =>
        page.Children.OfType<SectionNode>().First(s => s.Heading == null);

    /// The rail's nav list (filter buttons).
    private static ListNode NavList(PageNode page) =>
        Rail(page).Children.OfType<ListNode>().Single();

    /// The main column's task list (the last ListNode in main).
    private static ListNode TaskList(PageNode page) =>
        MainCol(page).Children.OfType<ListNode>().Single();

    private static ProgressNode Progress(PageNode page) =>
        MainCol(page).Children.OfType<ProgressNode>().Single();

    /// The "{c} of {t} complete" muted summary line in main.
    private static TextNode SummaryText(PageNode page) =>
        MainCol(page).Children.OfType<TextNode>().First();

    private static FormNode AddForm(PageNode page) =>
        MainCol(page).Children.OfType<FormNode>().Single();

    /// Resolve a single nav item by its filter id ("all"/"active"/"completed").
    private static ListItemNode NavItem(PageNode page, string id) =>
        NavList(page).Children.Cast<ListItemNode>().Single(i => i.Id == id);

    /// The actual task rows in the list, excluding the empty-state TextNode.
    private static List<ListItemNode> TaskRows(PageNode page) =>
        TaskList(page).Children.OfType<ListItemNode>().ToList();

    // ── GET /api/tasks ──────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsPageNode()
    {
        var page = Page(CreateController().Get().Vm);
        Assert.Equal("Tasks", page.Title);
    }

    [Fact]
    public void Get_UsesSidebarLayout_WithRailAndMainSections()
    {
        var page = Page(CreateController().Get().Vm);
        Assert.Equal("sidebar", page.Layout);

        var sections = page.Children.OfType<SectionNode>().ToList();
        Assert.Equal(2, sections.Count);

        var rail = Rail(page);
        Assert.Equal("Views", rail.Heading);
        Assert.Equal("card", rail.Variant);

        var main = MainCol(page);
        Assert.Null(main.Heading);
    }

    [Fact]
    public void Get_RailHasThreeNavItems_WithCountLabels()
    {
        var page = Page(CreateController().Get().Vm);
        var nav = NavList(page).Children.Cast<ListItemNode>().ToList();
        Assert.Equal(3, nav.Count);

        // Labels are "{label} ({count})"; seed = 1 done / 3 total.
        string Label(ListItemNode i) =>
            Assert.IsType<ButtonNode>(i.Children.Single()).Label;
        Assert.Equal("All (3)",       Label(NavItem(page, "all")));
        Assert.Equal("Active (2)",    Label(NavItem(page, "active")));
        Assert.Equal("Completed (1)", Label(NavItem(page, "completed")));
    }

    [Fact]
    public void Get_NavItemButtons_DispatchFilterAction()
    {
        var page = Page(CreateController().Get().Vm);
        var btn = Assert.IsType<ButtonNode>(NavItem(page, "active").Children.Single());
        Assert.Equal("filter", btn.Action.Name);
        Assert.Equal("active", btn.Action.Context!["value"]);
        Assert.Null(btn.Variant);
    }

    [Fact]
    public void Get_ActiveNavItem_MarkedWithActiveVariant()
    {
        var page = Page(CreateController().Get().Vm);
        // Default filter = "all" → only the "all" nav item is active.
        Assert.Equal("active", NavItem(page, "all").Variant);
        Assert.Null(NavItem(page, "active").Variant);
        Assert.Null(NavItem(page, "completed").Variant);
    }

    [Fact]
    public void Get_InitiallyHasThreeTaskRows()
    {
        var rows = TaskRows(Page(CreateController().Get().Vm));
        Assert.Equal(3, rows.Count);
    }

    [Fact]
    public void Get_ReturnsInitialState()
    {
        var resp = CreateController().Get();
        Assert.Equal(3, resp.State.Items.Count);
        Assert.Equal("all", resp.State.Filter);
    }

    [Fact]
    public void Get_InitialSummaryText_ShowsOneOfThreeComplete()
    {
        var text = SummaryText(Page(CreateController().Get().Vm));
        Assert.Equal("1 of 3 complete", text.Value);
        Assert.Equal("muted", text.Style);
    }

    [Fact]
    public void Get_InitialProgress_Is33Percent()
    {
        Assert.Equal(33, Progress(Page(CreateController().Get().Vm)).Value);
    }

    [Fact]
    public void Get_MainHasInlineAddForm_WithTitleField()
    {
        var form = AddForm(Page(CreateController().Get().Vm));
        Assert.Equal("add", form.SubmitAction.Name);
        Assert.Equal("Add", form.SubmitLabel);
        Assert.Equal("inline", form.Layout);

        var field = Assert.IsType<FieldNode>(form.Children.Single());
        Assert.Equal("title", field.Name);
        Assert.Equal("text", field.InputType);
        Assert.Equal("Add a task…", field.Placeholder);
        Assert.False(field.Required);
    }

    [Fact]
    public void Get_EachTaskRow_HasCheckboxTextAndDeleteButton()
    {
        var page = Page(CreateController().Get().Vm);
        foreach (var row in TaskRows(page))
        {
            var checkbox = Assert.Single(row.Children.OfType<CheckboxNode>());
            Assert.Equal("completed", checkbox.Name);
            Assert.Equal("toggle", checkbox.Action!.Name);

            Assert.Contains(row.Children, c => c is TextNode);

            var del = Assert.Single(row.Children.OfType<ButtonNode>());
            Assert.Equal("✕", del.Label);
            Assert.Equal("danger", del.Variant);
            Assert.Equal("delete", del.Action.Name);
        }
    }

    // ── action: add ─────────────────────────────────────────────────────────────

    [Fact]
    public void Action_Add_IncreasesTaskRowCount()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "add", Ctx(new { title = "Buy milk" })));
        Assert.Equal(4, TaskRows(Page(resp.Vm)).Count);
        Assert.Equal(4, resp.State.Items.Count);
    }

    [Fact]
    public void Action_Add_NewTaskAppearsInList()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "add", Ctx(new { title = "Buy milk" })));
        var texts = TaskRows(Page(resp.Vm))
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

        var doneCount = TaskRows(Page(resp.Vm)).Count(i => i.Variant == "done");
        Assert.Equal(2, doneCount);
    }

    [Fact]
    public void Action_Toggle_DoneRow_HasStrikethroughText()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var activeId = initial.Items.First(t => !t.Completed).Id;

        var resp = Ok(Act(ctrl, initial, "toggle", Ctx(new { id = activeId, @checked = true })));

        var row = TaskRows(Page(resp.Vm)).Single(i => i.Id == activeId);
        Assert.Equal("done", row.Variant);
        Assert.Equal("strikethrough", row.Children.OfType<TextNode>().Single().Style);
        Assert.True(row.Children.OfType<CheckboxNode>().Single().Checked);
    }

    [Fact]
    public void Action_Toggle_UncompletesDoneTask()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var doneId = initial.Items.First(t => t.Completed).Id;

        var resp = Ok(Act(ctrl, initial, "toggle", Ctx(new { id = doneId, @checked = false })));

        var doneCount = TaskRows(Page(resp.Vm)).Count(i => i.Variant == "done");
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

        Assert.Equal(2, TaskRows(Page(resp.Vm)).Count);
        Assert.Equal(2, resp.State.Items.Count);
    }

    [Fact]
    public void Action_Delete_RemovedTaskNotInList()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var firstId = initial.Items[0].Id;

        var resp = Ok(Act(ctrl, initial, "delete", Ctx(new { id = firstId })));

        Assert.DoesNotContain(TaskRows(Page(resp.Vm)), i => i.Id == firstId);
    }

    [Fact]
    public void Action_Delete_AllTasks_ShowsEmptyStateText()
    {
        var ctrl = CreateController();
        var state = TasksState.Initial();
        foreach (var id in state.Items.Select(i => i.Id).ToList())
            state = Ok(Act(ctrl, state, "delete", Ctx(new { id }))).State;

        var resp = Ok(Act(ctrl, state, "filter", Ctx(new { value = "all" })));
        var page = Page(resp.Vm);
        Assert.Empty(TaskRows(page));
        var empty = TaskList(page).Children.OfType<TextNode>().Single();
        Assert.Equal("Nothing here.", empty.Value);
        Assert.Equal("muted", empty.Style);
    }

    // ── action: filter ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_Filter_Active_MarksActiveNavItem()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "filter", Ctx(new { value = "active" })));
        var page = Page(resp.Vm);
        Assert.Equal("active", NavItem(page, "active").Variant);
        Assert.Null(NavItem(page, "all").Variant);
        Assert.Equal("active", resp.State.Filter);
    }

    [Fact]
    public void Action_Filter_Active_ExcludesCompletedTasks()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "filter", Ctx(new { value = "active" })));
        var rows = TaskRows(Page(resp.Vm));
        Assert.Equal(2, rows.Count);
        Assert.All(rows, i => Assert.Null(i.Variant));
    }

    [Fact]
    public void Action_Filter_Completed_ShowsOnlyDoneTasks()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "filter", Ctx(new { value = "completed" })));
        var rows = TaskRows(Page(resp.Vm));
        Assert.Single(rows);
        Assert.Equal("done", rows[0].Variant);
    }

    [Fact]
    public void Action_Filter_All_ShowsAllTasks()
    {
        var ctrl = CreateController();
        // Two-step: first set filter to active, then back to all (state carries through).
        var step1 = Ok(Act(ctrl, TasksState.Initial(), "filter", Ctx(new { value = "active" })));
        var step2 = Ok(Act(ctrl, step1.State, "filter", Ctx(new { value = "all" })));
        Assert.Equal(3, TaskRows(Page(step2.Vm)).Count);
    }

    [Fact]
    public void Action_UnknownName_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var result = Act(ctrl, TasksState.Initial(), "fly-to-moon");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
