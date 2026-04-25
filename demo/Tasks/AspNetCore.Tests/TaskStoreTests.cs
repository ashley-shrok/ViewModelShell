namespace ViewModelShell.Tests;

using ViewModelShell.Services;

public class TaskStoreTests
{
    [Fact]
    public void NewStore_HasThreeDefaultTasks()
    {
        var store = new TaskStore();
        Assert.Equal(3, store.GetAll().Count);
    }

    [Fact]
    public void Add_AppendsTask()
    {
        var store = new TaskStore();
        store.Add("Buy milk");
        Assert.Equal(4, store.GetAll().Count);
        Assert.Contains(store.GetAll(), t => t.Title == "Buy milk");
    }

    [Fact]
    public void Add_NewTask_IsNotCompleted()
    {
        var store = new TaskStore();
        store.Add("New task");
        var added = store.GetAll().Single(t => t.Title == "New task");
        Assert.False(added.Completed);
    }

    [Fact]
    public void SetCompleted_MarksTaskDone()
    {
        var store = new TaskStore();
        var id = store.GetAll().First(t => !t.Completed).Id;
        store.SetCompleted(id, true);
        Assert.True(store.GetAll().Single(t => t.Id == id).Completed);
    }

    [Fact]
    public void SetCompleted_CanUncompleteTask()
    {
        var store = new TaskStore();
        var id = store.GetAll().First(t => t.Completed).Id;
        store.SetCompleted(id, false);
        Assert.False(store.GetAll().Single(t => t.Id == id).Completed);
    }

    [Fact]
    public void Delete_RemovesTask()
    {
        var store = new TaskStore();
        var id = store.GetAll()[0].Id;
        store.Delete(id);
        Assert.Equal(2, store.GetAll().Count);
        Assert.DoesNotContain(store.GetAll(), t => t.Id == id);
    }

    [Fact]
    public void Delete_UnknownId_DoesNothing()
    {
        var store = new TaskStore();
        store.Delete("does-not-exist");
        Assert.Equal(3, store.GetAll().Count);
    }

    [Fact]
    public void GetFilter_DefaultsToAll()
    {
        var store = new TaskStore();
        Assert.Equal("all", store.GetFilter());
    }

    [Fact]
    public void SetFilter_ChangesFilter()
    {
        var store = new TaskStore();
        store.SetFilter("active");
        Assert.Equal("active", store.GetFilter());
    }
}
