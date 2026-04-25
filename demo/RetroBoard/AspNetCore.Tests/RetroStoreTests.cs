namespace RetroBoard.Tests;

using RetroBoard.Services;

public class RetroStoreTests
{
    [Fact]
    public void NewStore_HasOneCardPerSection()
    {
        var store = new RetroStore();
        Assert.Equal(1, store.GetCards("went-well").Count);
        Assert.Equal(1, store.GetCards("didnt-go-well").Count);
        Assert.Equal(1, store.GetCards("action-items").Count);
    }

    [Fact]
    public void AddCard_AppendsToCorrectSection()
    {
        var store = new RetroStore();
        store.AddCard("went-well", "Fast deploys");
        Assert.Equal(2, store.GetCards("went-well").Count);
        Assert.Contains(store.GetCards("went-well"), c => c.Text == "Fast deploys");
    }

    [Fact]
    public void AddCard_DoesNotAffectOtherSections()
    {
        var store = new RetroStore();
        store.AddCard("went-well", "Fast deploys");
        Assert.Equal(1, store.GetCards("didnt-go-well").Count);
        Assert.Equal(1, store.GetCards("action-items").Count);
    }

    [Fact]
    public void AddCard_UnknownSection_DoesNothing()
    {
        var store = new RetroStore();
        store.AddCard("unknown-section", "Test");
        Assert.Equal(1, store.GetCards("went-well").Count);
        Assert.Equal(1, store.GetCards("didnt-go-well").Count);
        Assert.Equal(1, store.GetCards("action-items").Count);
    }

    [Fact]
    public void AddCard_NewCard_HasZeroVotes()
    {
        var store = new RetroStore();
        store.AddCard("went-well", "Test card");
        var card = store.GetCards("went-well").Single(c => c.Text == "Test card");
        Assert.Equal(0, card.Votes);
    }

    [Fact]
    public void AddCard_NewCard_IsNotResolved()
    {
        var store = new RetroStore();
        store.AddCard("action-items", "New action");
        var card = store.GetCards("action-items").Single(c => c.Text == "New action");
        Assert.False(card.Resolved);
    }

    [Fact]
    public void DeleteCard_RemovesCard()
    {
        var store = new RetroStore();
        var id = store.GetCards("went-well")[0].Id;
        store.DeleteCard(id);
        Assert.Equal(0, store.GetCards("went-well").Count);
        Assert.DoesNotContain(store.GetCards("went-well"), c => c.Id == id);
    }

    [Fact]
    public void DeleteCard_UnknownId_DoesNothing()
    {
        var store = new RetroStore();
        store.DeleteCard("does-not-exist");
        Assert.Equal(1, store.GetCards("went-well").Count);
    }

    [Fact]
    public void UpvoteCard_IncrementsVoteCount()
    {
        var store = new RetroStore();
        var id = store.GetCards("went-well")[0].Id;
        store.UpvoteCard(id);
        Assert.Equal(1, store.GetCards("went-well")[0].Votes);
    }

    [Fact]
    public void UpvoteCard_CanBeCalledMultipleTimes()
    {
        var store = new RetroStore();
        var id = store.GetCards("went-well")[0].Id;
        store.UpvoteCard(id);
        store.UpvoteCard(id);
        store.UpvoteCard(id);
        Assert.Equal(3, store.GetCards("went-well")[0].Votes);
    }

    [Fact]
    public void ResolveCard_MarksCardResolved()
    {
        var store = new RetroStore();
        var id = store.GetCards("action-items")[0].Id;
        store.ResolveCard(id, true);
        Assert.True(store.GetCards("action-items")[0].Resolved);
    }

    [Fact]
    public void ResolveCard_CanUnresolveCard()
    {
        var store = new RetroStore();
        var id = store.GetCards("action-items")[0].Id;
        store.ResolveCard(id, true);
        store.ResolveCard(id, false);
        Assert.False(store.GetCards("action-items")[0].Resolved);
    }

    [Fact]
    public void ResolveCard_OnlyAffectsActionItems()
    {
        var store = new RetroStore();
        var wentWellId = store.GetCards("went-well")[0].Id;
        store.ResolveCard(wentWellId, true); // silently does nothing
        Assert.False(store.GetCards("went-well")[0].Resolved);
    }
}
