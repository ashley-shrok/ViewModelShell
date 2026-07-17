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

    // Phase 6 (WIRE-07) — dispatch envelope is {name, state} only. No context.
    // Tests pre-populate state with whatever the action will read, then dispatch
    // by action name (per-row identity is encoded in the name).
    private static ActionResult<ShellResponse<TasksState>> Act(
        TasksController ctrl, TasksState state, string name)
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

    private static ShellResponse<TasksState> Ok(ActionResult<ShellResponse<TasksState>> result) =>
        result.Value ?? throw new Xunit.Sdk.XunitException("Expected a value, got " + result.Result?.GetType().Name);

    // ── Tree navigation helpers (the 0.4.0 "sidebar" redesign) ──────────────────
    // PageNode("Tasks",[rail,main],Layout:"sidebar")
    //   rail = SectionNode("Views",[ListNode(navItems)],Variant:"card")
    //   main = SectionNode(null,[TextNode muted, ProgressNode, FormNode inline, ListNode])

    private static PageNode Page(ViewNode? vm) => Assert.IsType<PageNode>(vm);

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
        Assert.Equal(Layout.Sidebar, page.Layout);

        var sections = page.Children.OfType<SectionNode>().ToList();
        Assert.Equal(2, sections.Count);

        var rail = Rail(page);
        Assert.Equal("Views", rail.Heading);
        Assert.Equal(SectionVariant.Card, rail.Variant);

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
    public void Get_NavItemButtons_DispatchUniqueFilterActionPerTab()
    {
        var page = Page(CreateController().Get().Vm);
        // Phase 6 — each nav button carries a unique action name (`filter-all`,
        // `filter-active`, `filter-completed`); the framework's action-name
        // uniqueness check would fire if these collided.
        var btn = Assert.IsType<ButtonNode>(NavItem(page, "active").Children.Single());
        Assert.Equal("filter-active", btn.Action.Name);
        Assert.Null(btn.Emphasis);
        Assert.Equal("filter-all",
            Assert.IsType<ButtonNode>(NavItem(page, "all").Children.Single()).Action.Name);
        Assert.Equal("filter-completed",
            Assert.IsType<ButtonNode>(NavItem(page, "completed").Children.Single()).Action.Name);
    }

    [Fact]
    public void Get_ActiveNavItem_MarkedWithActiveVariant()
    {
        var page = Page(CreateController().Get().Vm);
        // Default filter = "all" → only the "all" nav item is active.
        Assert.Equal("active", NavItem(page, "all").State);
        Assert.Null(NavItem(page, "active").State);
        Assert.Null(NavItem(page, "completed").State);
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
        Assert.NotNull(resp.State);
        Assert.Equal(3, resp.State!.Items.Count);
        Assert.Equal("all", resp.State.Filter);
        Assert.Equal("", resp.State.DraftTitle);
    }

    [Fact]
    public void Get_InitialSummaryText_ShowsOneOfThreeComplete()
    {
        var text = SummaryText(Page(CreateController().Get().Vm));
        Assert.Equal("1 of 3 complete", text.Value);
        Assert.Equal(TextStyle.Muted, text.Style);
    }

    [Fact]
    public void Get_InitialProgress_Is33Percent()
    {
        Assert.Equal(33, Progress(Page(CreateController().Get().Vm)).Value);
    }

    [Fact]
    public void Get_MainHasInlineAddForm_WithBoundTitleField()
    {
        var form = AddForm(Page(CreateController().Get().Vm));
        Assert.NotNull(form.SubmitAction);
        Assert.Equal("add", form.SubmitAction!.Name);
        Assert.Equal("Add", form.SubmitLabel);
        Assert.Equal(FormLayout.Inline, form.Layout);

        var field = Assert.IsType<FieldNode>(form.Children.Single());
        Assert.Equal("title", field.Name);
        Assert.Equal("text", field.InputType);
        Assert.Equal("draftTitle", field.Bind);
        Assert.Equal("Add a task…", field.Placeholder);
        Assert.False(field.Required);
    }

    [Fact]
    public void Get_EachTaskRow_HasBoundCheckboxTextAndUniqueDeleteAction()
    {
        var page = Page(CreateController().Get().Vm);
        var resp = CreateController().Get();
        Assert.NotNull(resp.State);
        var idsByOrder = resp.State!.Items.OrderBy(t => t.CreatedAt).Select(t => t.Id).ToList();

        var rows = TaskRows(page);
        Assert.Equal(3, rows.Count);
        for (var k = 0; k < rows.Count; k++)
        {
            var row = rows[k];
            var checkbox = Assert.Single(row.Children.OfType<CheckboxNode>());
            Assert.Equal("completed", checkbox.Name);
            // Bind path points into state.items[i].completed where i is the
            // task's index in source state.Items[] — not the display index.
            var sourceIdx = resp.State.Items.Select((t, idx) => (t, idx))
                .Single(p => p.t.Id == row.Id).idx;
            Assert.Equal($"items.{sourceIdx}.completed", checkbox.Bind);
            Assert.NotNull(checkbox.Action);
            Assert.Equal($"toggle-row-{row.Id}", checkbox.Action!.Name);

            Assert.Contains(row.Children, c => c is TextNode);

            var del = Assert.Single(row.Children.OfType<ButtonNode>());
            Assert.Equal("✕", del.Label);
            Assert.Equal(Tone.Danger, del.Tone);
            Assert.Equal($"delete-row-{row.Id}", del.Action.Name);
        }
    }

    // ── action: add ─────────────────────────────────────────────────────────────

    [Fact]
    public void Action_Add_IncreasesTaskRowCount()
    {
        var ctrl = CreateController();
        var state = TasksState.Initial() with { DraftTitle = "Buy milk" };
        var resp = Ok(Act(ctrl, state, "add"));
        Assert.NotNull(resp.State);
        Assert.Equal(4, TaskRows(Page(resp.Vm)).Count);
        Assert.Equal(4, resp.State!.Items.Count);
    }

    [Fact]
    public void Action_Add_NewTaskAppearsInList()
    {
        var ctrl = CreateController();
        var state = TasksState.Initial() with { DraftTitle = "Buy milk" };
        var resp = Ok(Act(ctrl, state, "add"));
        var texts = TaskRows(Page(resp.Vm))
            .SelectMany(i => i.Children.OfType<TextNode>())
            .Select(t => t.Value);
        Assert.Contains("Buy milk", texts);
    }

    [Fact]
    public void Action_Add_ResetsDraftTitleAfterSubmit()
    {
        var ctrl = CreateController();
        var state = TasksState.Initial() with { DraftTitle = "Buy milk" };
        var resp = Ok(Act(ctrl, state, "add"));
        Assert.NotNull(resp.State);
        Assert.Equal("", resp.State!.DraftTitle);
    }

    [Fact]
    public void Action_Add_EmptyDraftTitle_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var state = TasksState.Initial() with { DraftTitle = "" };
        var result = Act(ctrl, state, "add");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_Add_WhitespaceDraftTitle_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var state = TasksState.Initial() with { DraftTitle = "   " };
        var result = Act(ctrl, state, "add");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── action: toggle-row-{id} ─────────────────────────────────────────────────
    // Phase 6 model: the renderer has already written the new boolean to
    // state.Items[i].Completed at the bind path before the action fires.
    // Tests model that by pre-populating state with the desired Completed flag.

    [Fact]
    public void Action_ToggleRow_MarksActiveTaskDone()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var idx = initial.Items.Select((t, i) => (t, i)).First(p => !p.t.Completed).i;
        var activeId = initial.Items[idx].Id;
        var nextItems = initial.Items.Select((t, i) =>
            i == idx ? t with { Completed = true } : t).ToList();
        var state = initial with { Items = nextItems };

        var resp = Ok(Act(ctrl, state, $"toggle-row-{activeId}"));

        var doneCount = TaskRows(Page(resp.Vm)).Count(i => i.State == "done");
        Assert.Equal(2, doneCount);
    }

    [Fact]
    public void Action_ToggleRow_DoneRow_HasStrikethroughText()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var idx = initial.Items.Select((t, i) => (t, i)).First(p => !p.t.Completed).i;
        var activeId = initial.Items[idx].Id;
        var nextItems = initial.Items.Select((t, i) =>
            i == idx ? t with { Completed = true } : t).ToList();
        var state = initial with { Items = nextItems };

        var resp = Ok(Act(ctrl, state, $"toggle-row-{activeId}"));

        var row = TaskRows(Page(resp.Vm)).Single(i => i.Id == activeId);
        Assert.Equal("done", row.State);
        Assert.Equal(TextStyle.Strikethrough, row.Children.OfType<TextNode>().Single().Style);
    }

    [Fact]
    public void Action_ToggleRow_UncompletesDoneTask()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var idx = initial.Items.Select((t, i) => (t, i)).First(p => p.t.Completed).i;
        var doneId = initial.Items[idx].Id;
        var nextItems = initial.Items.Select((t, i) =>
            i == idx ? t with { Completed = false } : t).ToList();
        var state = initial with { Items = nextItems };

        var resp = Ok(Act(ctrl, state, $"toggle-row-{doneId}"));

        var doneCount = TaskRows(Page(resp.Vm)).Count(i => i.State == "done");
        Assert.Equal(0, doneCount);
    }

    [Fact]
    public void Action_ToggleRow_UpdatesProgressBar()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var idx = initial.Items.Select((t, i) => (t, i)).First(p => !p.t.Completed).i;
        var activeId = initial.Items[idx].Id;
        var nextItems = initial.Items.Select((t, i) =>
            i == idx ? t with { Completed = true } : t).ToList();
        var state = initial with { Items = nextItems };

        var resp = Ok(Act(ctrl, state, $"toggle-row-{activeId}"));

        Assert.Equal(67, Progress(Page(resp.Vm)).Value);
    }

    // ── action: delete-row-{id} ─────────────────────────────────────────────────

    [Fact]
    public void Action_DeleteRow_RemovesTask()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var firstId = initial.Items[0].Id;

        var resp = Ok(Act(ctrl, initial, $"delete-row-{firstId}"));

        Assert.NotNull(resp.State);
        Assert.Equal(2, TaskRows(Page(resp.Vm)).Count);
        Assert.Equal(2, resp.State!.Items.Count);
    }

    [Fact]
    public void Action_DeleteRow_RemovedTaskNotInList()
    {
        var ctrl = CreateController();
        var initial = TasksState.Initial();
        var firstId = initial.Items[0].Id;

        var resp = Ok(Act(ctrl, initial, $"delete-row-{firstId}"));

        Assert.DoesNotContain(TaskRows(Page(resp.Vm)), i => i.Id == firstId);
    }

    [Fact]
    public void Action_DeleteRow_AllTasks_ShowsEmptyStateText()
    {
        var ctrl = CreateController();
        var state = TasksState.Initial();
        foreach (var id in state.Items.Select(i => i.Id).ToList())
        {
            var next = Ok(Act(ctrl, state, $"delete-row-{id}")).State;
            Assert.NotNull(next);
            state = next!;
        }

        var resp = Ok(Act(ctrl, state, "filter-all"));
        var page = Page(resp.Vm);
        Assert.Empty(TaskRows(page));
        var empty = TaskList(page).Children.OfType<TextNode>().Single();
        Assert.Equal("Nothing here.", empty.Value);
        Assert.Equal(TextStyle.Muted, empty.Style);
    }

    // ── action: filter-{value} ──────────────────────────────────────────────────

    [Fact]
    public void Action_Filter_Active_MarksActiveNavItem()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "filter-active"));
        Assert.NotNull(resp.State);
        var page = Page(resp.Vm);
        Assert.Equal("active", NavItem(page, "active").State);
        Assert.Null(NavItem(page, "all").State);
        Assert.Equal("active", resp.State!.Filter);
    }

    [Fact]
    public void Action_Filter_Active_ExcludesCompletedTasks()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "filter-active"));
        var rows = TaskRows(Page(resp.Vm));
        Assert.Equal(2, rows.Count);
        Assert.All(rows, i => Assert.Null(i.State));
    }

    [Fact]
    public void Action_Filter_Completed_ShowsOnlyDoneTasks()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, TasksState.Initial(), "filter-completed"));
        var rows = TaskRows(Page(resp.Vm));
        Assert.Single(rows);
        Assert.Equal("done", rows[0].State);
    }

    [Fact]
    public void Action_Filter_All_ShowsAllTasks()
    {
        var ctrl = CreateController();
        // Two-step: first set filter to active, then back to all (state carries through).
        var step1 = Ok(Act(ctrl, TasksState.Initial(), "filter-active"));
        Assert.NotNull(step1.State);
        var step2 = Ok(Act(ctrl, step1.State!, "filter-all"));
        Assert.Equal(3, TaskRows(Page(step2.Vm)).Count);
    }

    [Fact]
    public void Action_UnknownName_Throws()
    {
        var ctrl = CreateController();
        Assert.Throws<UnknownActionException>(() => Act(ctrl, TasksState.Initial(), "fly-to-moon"));
    }
}
