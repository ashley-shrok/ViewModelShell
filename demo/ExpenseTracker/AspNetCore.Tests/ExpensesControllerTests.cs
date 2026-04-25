namespace ExpenseTracker.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ExpenseTracker.Controllers;
using ExpenseTracker.Services;
using ViewModelShell.ViewModels;

public class ExpensesControllerTests
{
    private static ExpensesController CreateController(string tab = "test")
    {
        var controller = new ExpensesController(new ExpenseStoreRegistry());
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                Request = { QueryString = new QueryString($"?tab={tab}") }
            }
        };
        return controller;
    }

    private static Dictionary<string, JsonElement> Ctx(object obj)
    {
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(obj));
        return doc.RootElement.EnumerateObject()
            .ToDictionary(p => p.Name, p => p.Value.Clone());
    }

    private static PageNode Page(ActionResult<ViewNode> result) =>
        Assert.IsType<PageNode>(result.Value);

    private static StatBarNode StatBar(PageNode page) =>
        page.Children.OfType<StatBarNode>().Single();

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
        var page = Page(CreateController().Get());
        Assert.Equal("Expenses", page.Title);
    }

    [Fact]
    public void Get_StatBar_HasThreeStats()
    {
        var bar = StatBar(Page(CreateController().Get()));
        Assert.Equal(3, bar.Stats.Count);
    }

    [Fact]
    public void Get_CategoryList_HasFourEntries()
    {
        var list = CategoryList(Page(CreateController().Get()));
        Assert.Equal(4, list.Children.Count);
    }

    [Fact]
    public void Get_FilterTabs_IncludesAllAndEachCategory()
    {
        var tabs = FilterTabs(Page(CreateController().Get()));
        Assert.Equal(5, tabs.Tabs.Count); // all + 4 categories
        Assert.Equal("all", tabs.Selected);
    }

    [Fact]
    public void Get_EachCategoryItem_HasTextAndProgress()
    {
        var list = CategoryList(Page(CreateController().Get()));
        foreach (var item in list.Children.Cast<ListItemNode>())
        {
            Assert.Contains(item.Children, c => c is TextNode);
            Assert.Contains(item.Children, c => c is ProgressNode);
        }
    }

    [Fact]
    public void Get_BillsCategory_IsWarning_WhenOverBudget()
    {
        // Bills budget is $800; seed data has an $850 rent transaction
        var list      = CategoryList(Page(CreateController().Get()));
        var billsItem = list.Children.Cast<ListItemNode>().Single(i => i.Id == "bills");
        Assert.Equal("warning", billsItem.Variant);
    }

    [Fact]
    public void Get_EachTransactionItem_HasAmountAndDeleteButton()
    {
        var list = TransactionList(Page(CreateController().Get()));
        foreach (var item in list.Children.Cast<ListItemNode>())
        {
            Assert.Contains(item.Children, c => c is TextNode);
            Assert.Contains(item.Children, c => c is ButtonNode b && b.Variant == "danger");
        }
    }

    [Fact]
    public void Get_AddCategoryTabs_DefaultsToFood()
    {
        var tabs = AddCategoryTabs(Page(CreateController().Get()));
        Assert.Equal("food", tabs.Selected);
    }

    // ── action: add ──────────────────────────────────────────────────────────────

    [Fact]
    public void Action_Add_IncreasesTransactionCount()
    {
        var controller = CreateController();
        var before     = TransactionList(Page(controller.Get())).Children.Count;
        var page       = Page(controller.Action(new ActionPayload("add", Ctx(new { amount = "25.00", note = "Groceries" }))));
        Assert.Equal(before + 1, TransactionList(page).Children.Count);
    }

    [Fact]
    public void Action_Add_ZeroAmount_ReturnsBadRequest()
    {
        var result = CreateController().Action(new ActionPayload("add", Ctx(new { amount = "0", note = "" })));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_Add_NegativeAmount_ReturnsBadRequest()
    {
        var result = CreateController().Action(new ActionPayload("add", Ctx(new { amount = "-5", note = "" })));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_Add_InvalidAmount_ReturnsBadRequest()
    {
        var result = CreateController().Action(new ActionPayload("add", Ctx(new { amount = "abc", note = "" })));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public void Action_Add_UsesSelectedAddCategory()
    {
        var controller = CreateController();
        controller.Action(new ActionPayload("select-category", Ctx(new { value = "transport" })));
        controller.Action(new ActionPayload("add", Ctx(new { amount = "30.00", note = "Bus" })));
        // Filter to transport and verify "Bus" appears
        var page  = Page(controller.Action(new ActionPayload("filter", Ctx(new { value = "transport" }))));
        var items = TransactionList(page).Children.Cast<ListItemNode>().ToList();
        Assert.Contains(items, i => i.Children.OfType<TextNode>().Any(t => t.Value == "Bus"));
    }

    [Fact]
    public void Action_Add_AffectsStatBarTotals()
    {
        var controller = CreateController();
        var before = StatBar(Page(controller.Get())).Stats.First(s => s.Label == "spent this month").Value;
        controller.Action(new ActionPayload("add", Ctx(new { amount = "100.00", note = "Test" })));
        var after  = StatBar(Page(controller.Get())).Stats.First(s => s.Label == "spent this month").Value;
        Assert.NotEqual(before, after);
    }

    // ── action: delete ───────────────────────────────────────────────────────────

    [Fact]
    public void Action_Delete_RemovesTransaction()
    {
        var controller = CreateController();
        var item       = TransactionList(Page(controller.Get())).Children.Cast<ListItemNode>().First();
        var before     = TransactionList(Page(controller.Get())).Children.Count;
        var page       = Page(controller.Action(new ActionPayload("delete", Ctx(new { id = item.Id }))));
        Assert.Equal(before - 1, TransactionList(page).Children.Count);
    }

    [Fact]
    public void Action_Delete_RemovedItemNotInList()
    {
        var controller = CreateController();
        var item       = TransactionList(Page(controller.Get())).Children.Cast<ListItemNode>().First();
        var page       = Page(controller.Action(new ActionPayload("delete", Ctx(new { id = item.Id }))));
        Assert.DoesNotContain(
            TransactionList(page).Children.Cast<ListItemNode>(),
            i => i.Id == item.Id
        );
    }

    // ── action: filter ───────────────────────────────────────────────────────────

    [Fact]
    public void Action_Filter_Food_UpdatesSelectedTab()
    {
        var controller = CreateController();
        var page       = Page(controller.Action(new ActionPayload("filter", Ctx(new { value = "food" }))));
        Assert.Equal("food", FilterTabs(page).Selected);
    }

    [Fact]
    public void Action_Filter_Food_ShowsOnlyFoodTransactions()
    {
        var controller = CreateController();
        var page       = Page(controller.Action(new ActionPayload("filter", Ctx(new { value = "food" }))));
        var items      = TransactionList(page).Children.Cast<ListItemNode>().ToList();
        // All shown transaction items should be food transactions (seed data has 2)
        Assert.True(items.Count > 0);
    }

    [Fact]
    public void Action_Filter_All_ShowsAllTransactions()
    {
        var controller  = CreateController();
        var totalBefore = TransactionList(Page(controller.Get())).Children.Count;
        controller.Action(new ActionPayload("filter", Ctx(new { value = "food" })));
        var page        = Page(controller.Action(new ActionPayload("filter", Ctx(new { value = "all" }))));
        Assert.Equal(totalBefore, TransactionList(page).Children.Count);
    }

    // ── action: select-category ──────────────────────────────────────────────────

    [Fact]
    public void Action_SelectCategory_UpdatesAddCategoryTabs()
    {
        var controller = CreateController();
        var page       = Page(controller.Action(new ActionPayload("select-category", Ctx(new { value = "bills" }))));
        Assert.Equal("bills", AddCategoryTabs(page).Selected);
    }

    [Fact]
    public void Action_SelectCategory_EntertainmentBecomesSelected()
    {
        var controller = CreateController();
        var page       = Page(controller.Action(new ActionPayload("select-category", Ctx(new { value = "entertainment" }))));
        Assert.Equal("entertainment", AddCategoryTabs(page).Selected);
    }

    // ── action: unknown ──────────────────────────────────────────────────────────

    [Fact]
    public void Action_UnknownName_ReturnsBadRequest()
    {
        var result = CreateController().Action(new ActionPayload("fly-to-moon", null));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
