namespace ContactManager.Tests;

using ContactManager.Services;

public class ContactStoreTests
{
    [Fact]
    public void NewStore_HasTwelveDefaultContacts()
    {
        var store = new ContactStore();
        Assert.Equal(12, store.GetAll().Count);
    }

    [Fact]
    public void Add_AppendsContact()
    {
        var store = new ContactStore();
        store.Add("Dave Wilson", "dave@example.com", "555-0104", "Notes");
        Assert.Equal(13, store.GetAll().Count);
        Assert.Contains(store.GetAll(), c => c.Name == "Dave Wilson");
    }

    [Fact]
    public void GetById_ReturnsCorrectContact()
    {
        var store = new ContactStore();
        var contact = store.GetById("c1");
        Assert.NotNull(contact);
        Assert.Equal("Alice Johnson", contact.Name);
    }

    [Fact]
    public void GetById_UnknownId_ReturnsNull()
    {
        var store = new ContactStore();
        Assert.Null(store.GetById("does-not-exist"));
    }

    [Fact]
    public void Update_ChangesContactFields()
    {
        var store = new ContactStore();
        store.Update("c1", "Alice Updated", "new@example.com", "555-9999", "New notes");
        var contact = store.GetById("c1");
        Assert.Equal("Alice Updated", contact!.Name);
        Assert.Equal("new@example.com", contact.Email);
    }

    [Fact]
    public void Update_UnknownId_DoesNothing()
    {
        var store = new ContactStore();
        store.Update("does-not-exist", "X", "x@example.com", "", "");
        Assert.Equal(12, store.GetAll().Count);
    }

    [Fact]
    public void Delete_RemovesContact()
    {
        var store = new ContactStore();
        store.Delete("c1");
        Assert.Equal(11, store.GetAll().Count);
        Assert.DoesNotContain(store.GetAll(), c => c.Id == "c1");
    }

    [Fact]
    public void Delete_UnknownId_DoesNothing()
    {
        var store = new ContactStore();
        store.Delete("does-not-exist");
        Assert.Equal(12, store.GetAll().Count);
    }

    [Fact]
    public void GetFiltered_EmptyQuery_ReturnsAll()
    {
        var store = new ContactStore();
        Assert.Equal(12, store.GetFiltered("").Count);
    }

    [Fact]
    public void GetFiltered_ByName_ReturnsMatches()
    {
        var store = new ContactStore();
        var result = store.GetFiltered("alice");
        Assert.Single(result);
        Assert.Equal("Alice Johnson", result[0].Name);
    }

    [Fact]
    public void GetFiltered_ByEmail_ReturnsMatches()
    {
        var store = new ContactStore();
        var result = store.GetFiltered("bob@");
        Assert.Single(result);
        Assert.Equal("Bob Smith", result[0].Name);
    }

    [Fact]
    public void GetFiltered_CaseInsensitive()
    {
        var store = new ContactStore();
        Assert.Single(store.GetFiltered("ALICE"));
    }

    [Fact]
    public void GetCurrentView_DefaultsToList()
    {
        var store = new ContactStore();
        Assert.Equal(ContactView.List, store.GetCurrentView());
    }

    [Fact]
    public void SetCurrentView_ChangesView()
    {
        var store = new ContactStore();
        store.SetCurrentView(ContactView.Detail);
        Assert.Equal(ContactView.Detail, store.GetCurrentView());
    }

    [Fact]
    public void GetSelectedId_DefaultsToNull()
    {
        var store = new ContactStore();
        Assert.Null(store.GetSelectedId());
    }

    [Fact]
    public void SetSelectedId_ChangesId()
    {
        var store = new ContactStore();
        store.SetSelectedId("c1");
        Assert.Equal("c1", store.GetSelectedId());
    }

    [Fact]
    public void GetSearchQuery_DefaultsToEmpty()
    {
        var store = new ContactStore();
        Assert.Equal("", store.GetSearchQuery());
    }

    [Fact]
    public void SetSearchQuery_ChangesQuery()
    {
        var store = new ContactStore();
        store.SetSearchQuery("alice");
        Assert.Equal("alice", store.GetSearchQuery());
    }
}
