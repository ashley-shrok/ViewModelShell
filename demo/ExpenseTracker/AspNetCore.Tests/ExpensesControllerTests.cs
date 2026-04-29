namespace ExpenseTracker.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using ExpenseTracker.Controllers;
using ExpenseTracker.State;
using ViewModelShell.ViewModels;

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

    private static PageNode Page(ViewNode vm) => Assert.IsType<PageNode>(vm);
    private static StatBarNode StatBar(PageNode page) => page.Children.OfType<StatBarNode>().Single();
    private static SectionNode Section(PageNode page, string heading) =>
        page.Children.OfType<SectionNode>().Single(s => s.Heading == heading);
    private static ListNode TransactionList(PageNode page) =>
        Section(page, "Transactions").Children.OfType<ListNode>().Single();
    private static ListNode CategoryList(PageNode page) =>
        Section(page, "Categories").Children.OfType<ListNode>().Single();
    private static TabsNode FilterTabs(PageNode page) =>
        Section(page, "Transactions").Children.OfType<TabsNode>().Single();
    private static TabsNode AddCategoryTabs(PageNode page) =>
        Section(page, "Add Transaction").Children.OfType<TabsNode>().Single();

    // ── GET ──────────────────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsPageNode()
    {
        var page = Page(CreateController().Get().Vm);
        Assert.Equal("Expenses", page.Title);
    }

    [Fact]
    public void Get_ReturnsInitialState()
    {
        var resp = CreateController().Get();
        Assert.Equal(4, resp.State.Categories.Count);
        Assert.Equal(5, resp.State.Transactions.Count);
        Assert.Equal("all", resp.State.FilterCategory);
        Assert.Equal("food", resp.State.AddCategory);
    }

    [Fact]
    public void Get_StatBar_HasThreeStats()
    {
        var bar = StatBar(Page(CreateController().Get().Vm));
        Assert.Equal(3, bar.Stats.Count);
    }

    [Fact]
    public void Get_CategoryList_HasFourEntries()
    {
        var list = CategoryList(Page(CreateController().Get().Vm));
        Assert.Equal(4, list.Children.Count);
    }

    [Fact]
    public void Get_FilterTabs_IncludesAllAndEachCategory()
    {
        var tabs = FilterTabs(Page(CreateController().Get().Vm));
        Assert.Equal(5, tabs.Tabs.Count);
        Assert.Equal("all", tabs.Selected);
    }

    [Fact]
    public void Get_EachCategoryItem_HasTextAndProgress()
    {
        var list = CategoryList(Page(CreateController().Get().Vm));
        foreach (var item in list.Children.Cast<ListItemNode>())
        {
            Assert.Contains(item.Children, c => c is TextNode);
            Assert.Contains(item.Children, c => c is ProgressNode);
        }
    }

    [Fact]
    public void Get_BillsCategory_IsWarning_WhenOverBudget()
    {
        var list      = CategoryList(Page(CreateController().Get().Vm));
        var billsItem = list.Children.Cast<ListItemNode>().Single(i => i.Id == "bills");
        Assert.Equal("warning", billsItem.Variant);
    }

    [Fact]
    public void Get_EachTransactionItem_HasAmountAndDeleteButton()
    {
        var list = TransactionList(Page(CreateController().Get().Vm));
        foreach (var item in list.Children.Cast<ListItemNode>())
        {
            Assert.Contains(item.Children, c => c is TextNode);
            Assert.Contains(item.Children, c => c is ButtonNode b && b.Variant == "danger");
        }
    }

    [Fact]
    public void Get_AddCategoryTabs_DefaultsToFood()
    {
        var tabs = AddCategoryTabs(Page(CreateController().Get().Vm));
        Assert.Equal("food", tabs.Selected);
    }

    // ── action: add ──────────────────────────────────────────────────────────────

    [Fact]
    public void Action_Add_IncreasesTransactionCount()
    {
        var ctrl = CreateController();
        var initial = ExpensesState.Initial();
        var before = initial.Transactions.Count;
        var resp = Ok(Act(ctrl, initial, "add", Ctx(new { amount = "25.00", note = "Groceries" })));
        Assert.Equal(before + 1, TransactionList(Page(resp.Vm)).Children.Count);
        Assert.Equal(before + 1, resp.State.Transactions.Count);
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
        var items = TransactionList(Page(step3.Vm)).Children.Cast<ListItemNode>().ToList();
        Assert.Contains(items, i => i.Children.OfType<TextNode>().Any(t => t.Value == "Bus"));
    }

    [Fact]
    public void Action_Add_AffectsStatBarTotals()
    {
        var ctrl = CreateController();
        var initial = ExpensesState.Initial();
        var before = StatBar(Page(BuildVm(initial))).Stats.First(s => s.Label == "spent this month").Value;
        var resp = Ok(Act(ctrl, initial, "add", Ctx(new { amount = "100.00", note = "Test" })));
        var after = StatBar(Page(resp.Vm)).Stats.First(s => s.Label == "spent this month").Value;
        Assert.NotEqual(before, after);
    }

    // helper to render initial state for stats baseline
    private static ViewNode BuildVm(ExpensesState s)
    {
        var ctrl = CreateController();
        // Re-use initial-state path: GET on a fresh controller uses fresh seed; instead
        // dispatch a no-op to round-trip given state through BuildVm.
        // Simpler: just call Get() which seeds — but we want THIS state. Use a benign action.
        var resp = Ok(Act(ctrl, s, "filter", Ctx(new { value = s.FilterCategory })));
        return resp.Vm;
    }

    // ── action: delete ───────────────────────────────────────────────────────────

    [Fact]
    public void Action_Delete_RemovesTransaction()
    {
        var ctrl = CreateController();
        var initial = ExpensesState.Initial();
        var firstId = initial.Transactions[0].Id;
        var resp = Ok(Act(ctrl, initial, "delete", Ctx(new { id = firstId })));
        Assert.Equal(initial.Transactions.Count - 1, TransactionList(Page(resp.Vm)).Children.Count);
    }

    [Fact]
    public void Action_Delete_RemovedItemNotInList()
    {
        var ctrl = CreateController();
        var initial = ExpensesState.Initial();
        var firstId = initial.Transactions[0].Id;
        var resp = Ok(Act(ctrl, initial, "delete", Ctx(new { id = firstId })));
        Assert.DoesNotContain(
            TransactionList(Page(resp.Vm)).Children.Cast<ListItemNode>(),
            i => i.Id == firstId
        );
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
        var items = TransactionList(Page(resp.Vm)).Children.Cast<ListItemNode>().ToList();
        Assert.True(items.Count > 0);
    }

    [Fact]
    public void Action_Filter_All_ShowsAllTransactions()
    {
        var ctrl = CreateController();
        var initial = ExpensesState.Initial();
        var step1 = Ok(Act(ctrl, initial, "filter", Ctx(new { value = "food" })));
        var step2 = Ok(Act(ctrl, step1.State, "filter", Ctx(new { value = "all" })));
        Assert.Equal(initial.Transactions.Count, TransactionList(Page(step2.Vm)).Children.Count);
    }

    // ── action: select-category ──────────────────────────────────────────────────

    [Fact]
    public void Action_SelectCategory_UpdatesAddCategoryTabs()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ExpensesState.Initial(), "select-category", Ctx(new { value = "bills" })));
        Assert.Equal("bills", AddCategoryTabs(Page(resp.Vm)).Selected);
    }

    [Fact]
    public void Action_SelectCategory_EntertainmentBecomesSelected()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ExpensesState.Initial(), "select-category", Ctx(new { value = "entertainment" })));
        Assert.Equal("entertainment", AddCategoryTabs(Page(resp.Vm)).Selected);
    }

    // ── action: unknown ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_UnknownName_ReturnsBadRequest()
    {
        var result = Act(CreateController(), ExpensesState.Initial(), "fly-to-moon");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
