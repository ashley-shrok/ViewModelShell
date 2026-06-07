namespace ExpenseTracker.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using ExpenseTracker.Controllers;
using ExpenseTracker.State;
using ViewModelShell;

// Asserts the 0.4.0 realistic-demo redesign tree under the Phase 6 wire shape:
//   PageNode(Layout:"sidebar") children:
//     [0] SectionNode("Overview", Variant:"card")  — left rail.
//     [1] SectionNode(null) — main:
//           ButtonNode("+ Add Transaction", show-add, "primary"),
//           SectionNode("Transactions") {
//             TabsNode(bind:"filterCategory", per-tab actions filter-{id}),
//             TableNode(read-only ledger) },
//           ModalNode("Add Transaction", …, hide-add, "narrow") — when state.Adding
//             { TabsNode(bind:"addCategory", per-tab select-category-{id}),
//               FormNode(submit "add", bind paths draftAmount + draftNote) }
public class ExpensesControllerTests
{
    private static ExpensesController CreateController()
    {
        var controller = new ExpensesController();
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        return controller;
    }

    private static ActionResult<ShellResponse<ExpensesState>> Act(
        ExpensesController ctrl, ExpensesState state, string name)
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

    private static ShellResponse<ExpensesState> Ok(ActionResult<ShellResponse<ExpensesState>> result) =>
        result.Value ?? throw new Xunit.Sdk.XunitException("Expected a value, got " + result.Result?.GetType().Name);

    // ── tree navigation helpers ──────────────────────────────────────────────────

    private static PageNode Page(ViewNode? vm) => Assert.IsType<PageNode>(vm);

    private static SectionNode Rail(PageNode page)
    {
        var rail = Assert.IsType<SectionNode>(page.Children[0]);
        Assert.Equal("Overview", rail.Heading);
        Assert.Equal("card", rail.Variant);
        return rail;
    }

    private static SectionNode Main(PageNode page)
    {
        var main = Assert.IsType<SectionNode>(page.Children[1]);
        Assert.Null(main.Heading);
        return main;
    }

    private static ButtonNode AddButton(PageNode page) =>
        Main(page).Children.OfType<ButtonNode>().Single();

    private static SectionNode Ledger(PageNode page) =>
        Main(page).Children.OfType<SectionNode>().Single(s => s.Heading == "Transactions");

    private static TableNode LedgerTable(PageNode page) =>
        Ledger(page).Children.OfType<TableNode>().Single();

    private static TabsNode FilterTabs(PageNode page) =>
        Ledger(page).Children.OfType<TabsNode>().Single();

    private static ModalNode? AddModal(PageNode page) =>
        Main(page).Children.OfType<ModalNode>().SingleOrDefault();

    private static TabsNode AddCategoryTabs(PageNode page)
    {
        var modal = AddModal(page) ?? throw new Xunit.Sdk.XunitException("Add modal not present");
        return modal.Children.OfType<TabsNode>().Single();
    }

    /// Round-trip an arbitrary state through BuildVm via a benign no-op action.
    private static ViewNode BuildVm(ExpensesState s) =>
        Ok(Act(CreateController(), s, $"filter-{s.FilterCategory}")).Vm!;

    // ── GET ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsSidebarPageNode()
    {
        var page = Page(CreateController().Get().Vm);
        Assert.Equal("Expenses", page.Title);
        Assert.Equal("sidebar", page.Layout);
        Assert.Equal(2, page.Children.Count); // rail + main
    }

    [Fact]
    public void Get_ReturnsInitialState_IncludingAdding()
    {
        var resp = CreateController().Get();
        Assert.NotNull(resp.State);
        Assert.Equal(4, resp.State!.Categories.Count);
        Assert.Equal(5, resp.State.Transactions.Count);
        Assert.Equal("all", resp.State.FilterCategory);
        Assert.Equal("food", resp.State.AddCategory);
        Assert.False(resp.State.Adding); // new field defaults closed
        Assert.Equal("", resp.State.DraftAmount);
        Assert.Equal("", resp.State.DraftNote);
    }

    [Fact]
    public void Get_Rail_IsOverviewCard()
    {
        var rail = Rail(Page(CreateController().Get().Vm));
        // headline trio (remaining heading + 2 muted) then 3 nodes per category
        Assert.Equal(3 + 3 * 4, rail.Children.Count);
    }

    [Fact]
    public void Get_Rail_StartsWithRemainingHeadline()
    {
        var rail = Rail(Page(CreateController().Get().Vm));
        var head = Assert.IsType<TextNode>(rail.Children[0]);
        Assert.Equal("heading", head.Style);
        Assert.StartsWith("$", head.Value);
        Assert.Equal("remaining this month", Assert.IsType<TextNode>(rail.Children[1]).Value);
        var summary = Assert.IsType<TextNode>(rail.Children[2]);
        Assert.Contains("% used", summary.Value);
    }

    [Fact]
    public void Get_Rail_HasProgressPerCategory()
    {
        var rail = Rail(Page(CreateController().Get().Vm));
        Assert.Equal(4, rail.Children.OfType<ProgressNode>().Count());
    }

    [Fact]
    public void Get_Rail_BillsRow_IsError_WhenOverBudget()
    {
        var rail = Rail(Page(CreateController().Get().Vm));
        var texts = rail.Children.OfType<TextNode>().ToList();
        var billsIdx = texts.FindIndex(t => t.Value == "Bills");
        Assert.True(billsIdx >= 0);
        // the amount line immediately follows the category name; Bills is over budget (850/800)
        Assert.Equal("error", texts[billsIdx + 1].Style);
    }

    [Fact]
    public void Get_Rail_FoodRow_IsMuted_WhenUnderBudget()
    {
        var rail = Rail(Page(CreateController().Get().Vm));
        var texts = rail.Children.OfType<TextNode>().ToList();
        var foodIdx = texts.FindIndex(t => t.Value == "Food");
        Assert.True(foodIdx >= 0);
        Assert.Equal("muted", texts[foodIdx + 1].Style);
    }

    [Fact]
    public void Get_Main_HasAddButton_TriggeringShowAdd()
    {
        var btn = AddButton(Page(CreateController().Get().Vm));
        Assert.Equal("+ Add Transaction", btn.Label);
        Assert.Equal("show-add", btn.Action.Name);
        Assert.Equal("primary", btn.Variant);
    }

    [Fact]
    public void Get_LedgerTable_HasFourColumns()
    {
        var table = LedgerTable(Page(CreateController().Get().Vm));
        Assert.Equal(
            new[] { "date", "category", "note", "amount" },
            table.Columns.Select(c => c.Key).ToArray());
        Assert.All(table.Columns, c =>
        {
            Assert.False(c.Sortable);
            Assert.False(c.Filterable);
            Assert.False(c.LinkExternal);
        });
    }

    [Fact]
    public void Get_LedgerTable_HasOneRowPerTransaction()
    {
        var table = LedgerTable(Page(CreateController().Get().Vm));
        Assert.Equal(5, table.Rows.Count);
        Assert.All(table.Rows, r =>
        {
            Assert.NotNull(r.Id);
            Assert.True(r.Cells.ContainsKey("amount"));
            Assert.StartsWith("$", r.Cells["amount"]);
            // Phase 6 read-only ledger — no per-row Actions array.
            Assert.Null(r.Actions);
        });
    }

    [Fact]
    public void Get_LedgerTable_RowsDescendingByCreatedAt()
    {
        var table = LedgerTable(Page(CreateController().Get().Vm));
        // seed ids are ordered 1..5 by ascending CreatedAt, so descending => 5,4,3,2,1
        Assert.Equal(new[] { "5", "4", "3", "2", "1" }, table.Rows.Select(r => r.Id).ToArray());
    }

    [Fact]
    public void Get_FilterTabs_IncludesAllAndEachCategory_WithUniqueActionNames()
    {
        var tabs = FilterTabs(Page(CreateController().Get().Vm));
        Assert.Equal(5, tabs.Tabs.Count);
        Assert.Equal("all", tabs.Selected);
        Assert.Equal("filterCategory", tabs.Bind);
        // Phase 6 — each tab carries a unique action name; the framework's
        // uniqueness check would otherwise fire on tree build.
        Assert.Equal("filter-all", tabs.Tabs[0].Action.Name);
        Assert.Equal(new[] { "filter-all", "filter-food", "filter-transport", "filter-entertainment", "filter-bills" },
            tabs.Tabs.Select(t => t.Action.Name).ToArray());
    }

    [Fact]
    public void Get_AddModal_NotPresent_WhenNotAdding()
    {
        Assert.Null(AddModal(Page(CreateController().Get().Vm)));
    }

    // ── action: show-add / hide-add (new) ────────────────────────────────────────

    [Fact]
    public void Action_ShowAdd_OpensModal_AndSetsAddingState()
    {
        var resp = Ok(Act(CreateController(), ExpensesState.Initial(), "show-add"));
        Assert.NotNull(resp.State);
        Assert.True(resp.State!.Adding);
        var modal = AddModal(Page(resp.Vm));
        Assert.NotNull(modal);
        Assert.Equal("Add Transaction", modal!.Title);
        Assert.Equal("narrow", modal.Size);
        Assert.Equal("hide-add", modal.DismissAction?.Name);
        Assert.Contains(modal.Children, c => c is FormNode);
    }

    [Fact]
    public void Action_HideAdd_ClosesModal_AndClearsAddingState()
    {
        var ctrl = CreateController();
        var opened = Ok(Act(ctrl, ExpensesState.Initial(), "show-add"));
        Assert.NotNull(opened.State);
        Assert.True(opened.State!.Adding);
        var closed = Ok(Act(ctrl, opened.State, "hide-add"));
        Assert.NotNull(closed.State);
        Assert.False(closed.State!.Adding);
        Assert.Null(AddModal(Page(closed.Vm)));
    }

    [Fact]
    public void Action_AddModal_FormSubmitsAddAction_WithBoundFields()
    {
        var resp = Ok(Act(CreateController(), ExpensesState.Initial(), "show-add"));
        var modal = AddModal(Page(resp.Vm))!;
        var form  = modal.Children.OfType<FormNode>().Single();
        Assert.NotNull(form.SubmitAction);
        Assert.Equal("add", form.SubmitAction!.Name);
        Assert.Equal("Add", form.SubmitLabel);
        var amount = form.Children.OfType<FieldNode>().Single(f => f.Name == "amount");
        Assert.True(amount.Required);
        Assert.Equal("draftAmount", amount.Bind);
        var note = form.Children.OfType<FieldNode>().Single(f => f.Name == "note");
        Assert.False(note.Required);
        Assert.Equal("draftNote", note.Bind);
    }

    // ── action: add ──────────────────────────────────────────────────────────────

    [Fact]
    public void Action_Add_IncreasesTransactionCount_AndClosesModal()
    {
        var ctrl = CreateController();
        var opened = Ok(Act(ctrl, ExpensesState.Initial(), "show-add"));
        Assert.NotNull(opened.State);
        var staged = opened.State! with { DraftAmount = "25.00", DraftNote = "Groceries" };
        var before = staged.Transactions.Count;
        var resp = Ok(Act(ctrl, staged, "add"));
        Assert.NotNull(resp.State);
        Assert.Equal(before + 1, resp.State!.Transactions.Count);
        Assert.Equal(before + 1, LedgerTable(Page(resp.Vm)).Rows.Count);
        Assert.False(resp.State.Adding); // add closes the modal
        Assert.Null(AddModal(Page(resp.Vm)));
        Assert.Equal("", resp.State.DraftAmount);
        Assert.Equal("", resp.State.DraftNote);
    }

    [Fact]
    public void Action_Add_ZeroAmount_ReturnsBadRequest()
    {
        var state = ExpensesState.Initial() with { DraftAmount = "0", DraftNote = "" };
        var result = Act(CreateController(), state, "add");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_Add_NegativeAmount_ReturnsBadRequest()
    {
        var state = ExpensesState.Initial() with { DraftAmount = "-5", DraftNote = "" };
        var result = Act(CreateController(), state, "add");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_Add_InvalidAmount_ReturnsBadRequest()
    {
        var state = ExpensesState.Initial() with { DraftAmount = "abc", DraftNote = "" };
        var result = Act(CreateController(), state, "add");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_Add_UsesSelectedAddCategory()
    {
        var ctrl = CreateController();
        // The bind has already written addCategory to state; we model that here.
        var staged = ExpensesState.Initial() with
        {
            AddCategory = "transport",
            DraftAmount = "30.00",
            DraftNote = "Bus",
        };
        var afterAdd = Ok(Act(ctrl, staged, "add"));
        Assert.NotNull(afterAdd.State);
        var filtered = afterAdd.State! with { FilterCategory = "transport" };
        var resp = Ok(Act(ctrl, filtered, "filter-transport"));
        var rows = LedgerTable(Page(resp.Vm)).Rows;
        Assert.Contains(rows, r => r.Cells.TryGetValue("note", out var n) && n == "Bus");
    }

    [Fact]
    public void Action_Add_AffectsOverviewRemaining()
    {
        var ctrl = CreateController();
        var initial = ExpensesState.Initial();
        var before = ((TextNode)Rail(Page(BuildVm(initial))).Children[0]).Value;
        var staged = initial with { DraftAmount = "100.00", DraftNote = "Test" };
        var resp = Ok(Act(ctrl, staged, "add"));
        var after = ((TextNode)Rail(Page(resp.Vm!)).Children[0]).Value;
        Assert.NotEqual(before, after);
    }

    [Fact]
    public void Action_Add_AppearsInLedgerWithFormattedAmount()
    {
        var ctrl = CreateController();
        var staged = ExpensesState.Initial() with { DraftAmount = "12.5", DraftNote = "Snack" };
        var resp = Ok(Act(ctrl, staged, "add"));
        var rows = LedgerTable(Page(resp.Vm!)).Rows;
        Assert.Contains(rows, r =>
            r.Cells.TryGetValue("note", out var n) && n == "Snack" &&
            r.Cells.TryGetValue("amount", out var a) && a == "$12.50");
    }

    // ── action: filter-{id} ──────────────────────────────────────────────────────
    // The TabsNode bind has already written FilterCategory; the action is just
    // an explicit dispatch by name. Tests pre-populate state to model this.

    [Fact]
    public void Action_Filter_Food_UpdatesSelectedTab()
    {
        var ctrl = CreateController();
        var staged = ExpensesState.Initial() with { FilterCategory = "food" };
        var resp = Ok(Act(ctrl, staged, "filter-food"));
        Assert.Equal("food", FilterTabs(Page(resp.Vm!)).Selected);
    }

    [Fact]
    public void Action_Filter_Food_ShowsOnlyFoodTransactions()
    {
        var ctrl = CreateController();
        var staged = ExpensesState.Initial() with { FilterCategory = "food" };
        var resp = Ok(Act(ctrl, staged, "filter-food"));
        var rows = LedgerTable(Page(resp.Vm!)).Rows;
        Assert.True(rows.Count > 0);
        Assert.All(rows, r => Assert.Equal("Food", r.Cells["category"]));
    }

    [Fact]
    public void Action_Filter_All_ShowsAllTransactions()
    {
        var ctrl = CreateController();
        var initial = ExpensesState.Initial();
        var step1 = Ok(Act(ctrl, initial with { FilterCategory = "food" }, "filter-food"));
        Assert.NotNull(step1.State);
        var step2 = Ok(Act(ctrl, step1.State! with { FilterCategory = "all" }, "filter-all"));
        Assert.Equal(initial.Transactions.Count, LedgerTable(Page(step2.Vm!)).Rows.Count);
    }

    // ── action: select-category-{id} ─────────────────────────────────────────────

    [Fact]
    public void Action_SelectCategory_UpdatesAddModalTabs()
    {
        var ctrl = CreateController();
        var opened = Ok(Act(ctrl, ExpensesState.Initial(), "show-add"));
        Assert.NotNull(opened.State);
        var staged = opened.State! with { AddCategory = "bills" };
        var resp = Ok(Act(ctrl, staged, "select-category-bills"));
        Assert.NotNull(resp.State);
        Assert.Equal("bills", resp.State!.AddCategory);
        Assert.Equal("bills", AddCategoryTabs(Page(resp.Vm!)).Selected);
    }

    [Fact]
    public void Action_SelectCategory_PersistsThroughAdd()
    {
        var ctrl = CreateController();
        // Open + select bills (bind+action writes to state).
        var opened = Ok(Act(ctrl, ExpensesState.Initial(), "show-add"));
        Assert.NotNull(opened.State);
        var staged = opened.State! with { AddCategory = "bills", DraftAmount = "10.00", DraftNote = "X" };
        var afterAdd = Ok(Act(ctrl, staged, "add"));
        Assert.NotNull(afterAdd.State);
        Assert.Equal("bills", afterAdd.State!.AddCategory); // selection survives the add
    }

    // ── action: unknown ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_UnknownName_Throws()
    {
        Assert.Throws<UnknownActionException>(() => Act(CreateController(), ExpensesState.Initial(), "fly-to-moon"));
    }
}
