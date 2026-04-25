namespace ExpenseTracker.Tests;

using ExpenseTracker.Services;

public class ExpenseStoreTests
{
    [Fact]
    public void NewStore_HasFourCategories()
    {
        var store = new ExpenseStore();
        Assert.Equal(4, store.GetCategories().Count);
    }

    [Fact]
    public void NewStore_HasSeedTransactions()
    {
        var store = new ExpenseStore();
        Assert.True(store.GetAll().Count > 0);
    }

    [Fact]
    public void AddTransaction_IncreasesCount()
    {
        var store  = new ExpenseStore();
        var before = store.GetAll().Count;
        store.AddTransaction(25.00m, "food", "Groceries");
        Assert.Equal(before + 1, store.GetAll().Count);
    }

    [Fact]
    public void AddTransaction_AppearsInList()
    {
        var store = new ExpenseStore();
        store.AddTransaction(25.00m, "food", "Groceries");
        Assert.Contains(store.GetAll(), t => t.Note == "Groceries" && t.Amount == 25.00m);
    }

    [Fact]
    public void AddTransaction_TrimsNote()
    {
        var store = new ExpenseStore();
        store.AddTransaction(10m, "food", "  Lunch  ");
        Assert.Contains(store.GetAll(), t => t.Note == "Lunch");
    }

    [Fact]
    public void DeleteTransaction_RemovesIt()
    {
        var store = new ExpenseStore();
        var id    = store.GetAll()[0].Id;
        store.DeleteTransaction(id);
        Assert.DoesNotContain(store.GetAll(), t => t.Id == id);
    }

    [Fact]
    public void DeleteTransaction_UnknownId_DoesNothing()
    {
        var store  = new ExpenseStore();
        var before = store.GetAll().Count;
        store.DeleteTransaction("does-not-exist");
        Assert.Equal(before, store.GetAll().Count);
    }

    [Fact]
    public void GetFilter_DefaultsToAll()
    {
        var store = new ExpenseStore();
        Assert.Equal("all", store.GetFilter());
    }

    [Fact]
    public void SetFilter_ChangesFilter()
    {
        var store = new ExpenseStore();
        store.SetFilter("food");
        Assert.Equal("food", store.GetFilter());
    }

    [Fact]
    public void GetAddCategory_DefaultsToFood()
    {
        var store = new ExpenseStore();
        Assert.Equal("food", store.GetAddCategory());
    }

    [Fact]
    public void SetAddCategory_ChangesAddCategory()
    {
        var store = new ExpenseStore();
        store.SetAddCategory("transport");
        Assert.Equal("transport", store.GetAddCategory());
    }
}
