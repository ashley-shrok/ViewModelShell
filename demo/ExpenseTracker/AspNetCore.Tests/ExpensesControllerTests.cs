namespace ExpenseTracker.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using ExpenseTracker.Controllers;
using ExpenseTracker.State;
using ViewModelShell;

// Asserts the 0.4.0 realistic-demo redesign tree:
//   PageNode(Layout:"sidebar") children:
//     [0] SectionNode("Overview", Variant:"card")  — left rail:
//           TextNode($remaining,"heading"), TextNode("remaining this month","muted"),
//           TextNode("Spent … % used","muted"),
//           then per category: TextNode(name,"subheading"),
//                               TextNode("$spent / $budget", over?"error":"muted"),
//                               ProgressNode(pct)
//     [1] SectionNode(null) — main:
//           ButtonNode("+ Add Transaction", show-add, "primary"),
//           SectionNode("Transactions") { TabsNode(filter), TableNode(read-only ledger) },
//           ModalNode("Add Transaction", …, hide-add, "narrow")  — ONLY when state.Adding
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

    private static Dictionary<string, JsonElement> Ctx(object obj)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(obj));
        return doc.RootElement.EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.Clone());
    }

    private static ActionResult<ShellResponse<ExpensesState>> Act(
        ExpensesController ctrl, ExpensesState state, string name,
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

    private static ShellResponse<ExpensesState> Ok(ActionResult<ShellResponse<ExpensesState>> result) =>
        result.Value ?? throw new Xunit.Sdk.XunitException("Expected a value, got " + result.Result?.GetType().Name);

    // ── tree navigation helpers ──────────────────────────────────────────────────

    private static PageNode Page(ViewNode vm) => Assert.IsType<PageNode>(vm);

    /// Left "Overview" rail — the first child, a card section.
    private static SectionNode Rail(PageNode page)
    {
        var rail = Assert.IsType<SectionNode>(page.Children[0]);
        Assert.Equal("Overview", rail.Heading);
        Assert.Equal("card", rail.Variant);
        return rail;
    }

    /// Main area — the second (heading-less) child section.
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
        Ok(Act(CreateController(), s, "filter", Ctx(new { value = s.FilterCategory }))).Vm;

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
        Assert.Equal(4, resp.State.Categories.Count);
        Assert.Equal(5, resp.State.Transactions.Count);
        Assert.Equal("all", resp.State.FilterCategory);
        Assert.Equal("food", resp.State.AddCategory);
        Assert.False(resp.State.Adding); // new field defaults closed
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
        // read-only ledger — columns are not sortable/filterable
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
            // read-only ledger — no per-row action
            Assert.Null(r.Action);
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
    public void Get_FilterTabs_IncludesAllAndEachCategory()
    {
        var tabs = FilterTabs(Page(CreateController().Get().Vm));
        Assert.Equal(5, tabs.Tabs.Count);
        Assert.Equal("all", tabs.Selected);
        Assert.Equal("filter", tabs.Action.Name);
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
        Assert.True(resp.State.Adding);
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
        Assert.True(opened.State.Adding);
        var closed = Ok(Act(ctrl, opened.State, "hide-add"));
        Assert.False(closed.State.Adding);
        Assert.Null(AddModal(Page(closed.Vm)));
    }

    [Fact]
    public void Action_AddModal_FormSubmitsAddAction()
    {
        var resp = Ok(Act(CreateController(), ExpensesState.Initial(), "show-add"));
        var modal = AddModal(Page(resp.Vm))!;
        var form  = modal.Children.OfType<FormNode>().Single();
        Assert.Equal("add", form.SubmitAction.Name);
        Assert.Equal("Add", form.SubmitLabel);
        var amount = form.Children.OfType<FieldNode>().Single(f => f.Name == "amount");
        Assert.True(amount.Required);
        var note = form.Children.OfType<FieldNode>().Single(f => f.Name == "note");
        Assert.False(note.Required);
    }

    // ── action: add ──────────────────────────────────────────────────────────────

    [Fact]
    public void Action_Add_IncreasesTransactionCount_AndClosesModal()
    {
        var ctrl = CreateController();
        var opened = Ok(Act(ctrl, ExpensesState.Initial(), "show-add"));
        var before = opened.State.Transactions.Count;
        var resp = Ok(Act(ctrl, opened.State, "add", Ctx(new { amount = "25.00", note = "Groceries" })));
        Assert.Equal(before + 1, resp.State.Transactions.Count);
        Assert.Equal(before + 1, LedgerTable(Page(resp.Vm)).Rows.Count);
        Assert.False(resp.State.Adding); // add closes the modal
        Assert.Null(AddModal(Page(resp.Vm)));
    }

    [Fact]
    public void Action_Add_ZeroAmount_ReturnsBadRequest()
    {
        var result = Act(CreateController(), ExpensesState.Initial(), "add", Ctx(new { amount = "0", note = "" }));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_Add_NegativeAmount_ReturnsBadRequest()
    {
        var result = Act(CreateController(), ExpensesState.Initial(), "add", Ctx(new { amount = "-5", note = "" }));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_Add_InvalidAmount_ReturnsBadRequest()
    {
        var result = Act(CreateController(), ExpensesState.Initial(), "add", Ctx(new { amount = "abc", note = "" }));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_Add_UsesSelectedAddCategory()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ExpensesState.Initial(), "select-category", Ctx(new { value = "transport" })));
        var step2 = Ok(Act(ctrl, step1.State, "add", Ctx(new { amount = "30.00", note = "Bus" })));
        var step3 = Ok(Act(ctrl, step2.State, "filter", Ctx(new { value = "transport" })));
        var rows  = LedgerTable(Page(step3.Vm)).Rows;
        Assert.Contains(rows, r => r.Cells.TryGetValue("note", out var n) && n == "Bus");
    }

    [Fact]
    public void Action_Add_AffectsOverviewRemaining()
    {
        var ctrl = CreateController();
        var initial = ExpensesState.Initial();
        var before = ((TextNode)Rail(Page(BuildVm(initial))).Children[0]).Value;
        var resp = Ok(Act(ctrl, initial, "add", Ctx(new { amount = "100.00", note = "Test" })));
        var after = ((TextNode)Rail(Page(resp.Vm)).Children[0]).Value;
        Assert.NotEqual(before, after);
    }

    [Fact]
    public void Action_Add_AppearsInLedgerWithFormattedAmount()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ExpensesState.Initial(), "add", Ctx(new { amount = "12.5", note = "Snack" })));
        var rows = LedgerTable(Page(resp.Vm)).Rows;
        Assert.Contains(rows, r =>
            r.Cells.TryGetValue("note", out var n) && n == "Snack" &&
            r.Cells.TryGetValue("amount", out var a) && a == "$12.50");
    }

    // ── action: delete ───────────────────────────────────────────────────────────

    [Fact]
    public void Action_Delete_RemovesTransaction()
    {
        var ctrl = CreateController();
        var initial = ExpensesState.Initial();
        var firstId = initial.Transactions[0].Id;
        var resp = Ok(Act(ctrl, initial, "delete", Ctx(new { id = firstId })));
        Assert.Equal(initial.Transactions.Count - 1, LedgerTable(Page(resp.Vm)).Rows.Count);
        Assert.Equal(initial.Transactions.Count - 1, resp.State.Transactions.Count);
    }

    [Fact]
    public void Action_Delete_RemovedItemNotInLedger()
    {
        var ctrl = CreateController();
        var initial = ExpensesState.Initial();
        var firstId = initial.Transactions[0].Id;
        var resp = Ok(Act(ctrl, initial, "delete", Ctx(new { id = firstId })));
        Assert.DoesNotContain(LedgerTable(Page(resp.Vm)).Rows, r => r.Id == firstId);
    }

    [Fact]
    public void Action_Delete_PreservesAddingState()
    {
        var ctrl = CreateController();
        var opened = Ok(Act(ctrl, ExpensesState.Initial(), "show-add"));
        Assert.True(opened.State.Adding);
        var resp = Ok(Act(ctrl, opened.State, "delete", Ctx(new { id = "3" })));
        Assert.True(resp.State.Adding); // delete does not touch the modal
        Assert.NotNull(AddModal(Page(resp.Vm)));
    }

    // ── action: filter ───────────────────────────────────────────────────────────

    [Fact]
    public void Action_Filter_Food_UpdatesSelectedTab()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ExpensesState.Initial(), "filter", Ctx(new { value = "food" })));
        Assert.Equal("food", FilterTabs(Page(resp.Vm)).Selected);
    }

    [Fact]
    public void Action_Filter_Food_ShowsOnlyFoodTransactions()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ExpensesState.Initial(), "filter", Ctx(new { value = "food" })));
        var rows = LedgerTable(Page(resp.Vm)).Rows;
        Assert.True(rows.Count > 0);
        Assert.All(rows, r => Assert.Equal("Food", r.Cells["category"]));
    }

    [Fact]
    public void Action_Filter_All_ShowsAllTransactions()
    {
        var ctrl = CreateController();
        var initial = ExpensesState.Initial();
        var step1 = Ok(Act(ctrl, initial, "filter", Ctx(new { value = "food" })));
        var step2 = Ok(Act(ctrl, step1.State, "filter", Ctx(new { value = "all" })));
        Assert.Equal(initial.Transactions.Count, LedgerTable(Page(step2.Vm)).Rows.Count);
    }

    // ── action: select-category ──────────────────────────────────────────────────

    [Fact]
    public void Action_SelectCategory_UpdatesAddModalTabs()
    {
        var ctrl = CreateController();
        // selecting a category does not by itself open the modal; open it first
        var opened = Ok(Act(ctrl, ExpensesState.Initial(), "show-add"));
        var resp = Ok(Act(ctrl, opened.State, "select-category", Ctx(new { value = "bills" })));
        Assert.Equal("bills", resp.State.AddCategory);
        Assert.Equal("bills", AddCategoryTabs(Page(resp.Vm)).Selected);
    }

    [Fact]
    public void Action_SelectCategory_EntertainmentBecomesSelected()
    {
        var ctrl = CreateController();
        var opened = Ok(Act(ctrl, ExpensesState.Initial(), "show-add"));
        var resp = Ok(Act(ctrl, opened.State, "select-category", Ctx(new { value = "entertainment" })));
        Assert.Equal("entertainment", resp.State.AddCategory);
        Assert.Equal("entertainment", AddCategoryTabs(Page(resp.Vm)).Selected);
    }

    [Fact]
    public void Action_SelectCategory_PersistsThroughAdd()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ExpensesState.Initial(), "select-category", Ctx(new { value = "bills" })));
        Assert.Equal("bills", step1.State.AddCategory);
        var step2 = Ok(Act(ctrl, step1.State, "add", Ctx(new { amount = "10.00", note = "X" })));
        Assert.Equal("bills", step2.State.AddCategory); // selection survives the add
    }

    // ── action: unknown ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_UnknownName_ReturnsBadRequest()
    {
        var result = Act(CreateController(), ExpensesState.Initial(), "fly-to-moon");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
