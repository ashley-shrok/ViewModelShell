namespace ContactManager.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using ContactManager.Controllers;
using ContactManager.Services;
using ViewModelShell.ViewModels;

public class ContactsControllerTests
{
    private static ContactsController CreateController(string tab = "test")
    {
        var controller = new ContactsController(new ContactStoreRegistry());
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

    private static ListNode ContactList(PageNode page) =>
        page.Children.OfType<ListNode>().Single();

    private static StatBarNode StatBar(PageNode page) =>
        page.Children.OfType<StatBarNode>().Single();

    private static FormNode GetForm(PageNode page) =>
        page.Children.OfType<FormNode>().Single();

    // ── GET /api/contacts ────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsPageNodeWithTitle()
    {
        var controller = CreateController();
        var page = Page(controller.Get());
        Assert.Equal("Contacts", page.Title);
    }

    [Fact]
    public void Get_ListView_HasTwelveContacts()
    {
        var controller = CreateController();
        Assert.Equal(12, ContactList(Page(controller.Get())).Children.Count);
    }

    [Fact]
    public void Get_ListView_StatBarShowsTotal()
    {
        var controller = CreateController();
        var stat = StatBar(Page(controller.Get())).Stats.Single();
        Assert.Equal("12", stat.Value);
        Assert.Equal("contacts", stat.Label);
    }

    [Fact]
    public void Get_ListView_HasAddContactButton()
    {
        var controller = CreateController();
        var addBtn = Page(controller.Get()).Children
            .OfType<ButtonNode>()
            .Single(b => b.Label == "Add Contact");
        Assert.Equal("navigate-to-add", addBtn.Action.Name);
    }

    [Fact]
    public void Get_ListView_HasSearchField()
    {
        var controller = CreateController();
        var form = GetForm(Page(controller.Get()));
        Assert.Contains(form.Children, c => c is FieldNode f && f.Name == "query");
    }

    [Fact]
    public void Get_ListView_SearchField_HasInputAction()
    {
        var controller = CreateController();
        var form = GetForm(Page(controller.Get()));
        var field = form.Children.OfType<FieldNode>().Single(f => f.Name == "query");
        Assert.NotNull(field.Action);
        Assert.Equal("search", field.Action.Name);
    }

    [Fact]
    public void Get_ListView_EachItem_HasNameAndViewButton()
    {
        var controller = CreateController();
        var list = ContactList(Page(controller.Get()));
        foreach (var item in list.Children.Cast<ListItemNode>())
        {
            Assert.Contains(item.Children, c => c is TextNode);
            Assert.Contains(item.Children, c => c is ButtonNode b && b.Label == "View");
        }
    }

    // ── action: navigate-to-detail ───────────────────────────────────────────────

    [Fact]
    public void Action_NavigateToDetail_ShowsContactName()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("navigate-to-detail", Ctx(new { id = "c1" }))));
        Assert.Equal("Alice Johnson", page.Title);
    }

    [Fact]
    public void Action_NavigateToDetail_FormPrefilledWithContactValues()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("navigate-to-detail", Ctx(new { id = "c1" }))));
        var nameField = GetForm(page).Children.OfType<FieldNode>().Single(f => f.Name == "name");
        Assert.Equal("Alice Johnson", nameField.Value);
    }

    [Fact]
    public void Action_NavigateToDetail_HasBackButton()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("navigate-to-detail", Ctx(new { id = "c1" }))));
        Assert.Contains(page.Children, c => c is ButtonNode b && b.Action.Name == "navigate-to-list");
    }

    [Fact]
    public void Action_NavigateToDetail_HasDeleteButton()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("navigate-to-detail", Ctx(new { id = "c1" }))));
        Assert.Contains(page.Children, c => c is ButtonNode b && b.Variant == "danger");
    }

    [Fact]
    public void Action_NavigateToDetail_MissingId_ReturnsBadRequest()
    {
        var controller = CreateController();
        var result = controller.Action(new ActionPayload("navigate-to-detail", null));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── action: navigate-to-add ──────────────────────────────────────────────────

    [Fact]
    public void Action_NavigateToAdd_ShowsNewContactTitle()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("navigate-to-add", null)));
        Assert.Equal("New Contact", page.Title);
    }

    [Fact]
    public void Action_NavigateToAdd_FormFieldsAreEmpty()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("navigate-to-add", null)));
        Assert.All(GetForm(page).Children.OfType<FieldNode>(), f => Assert.Null(f.Value));
    }

    [Fact]
    public void Action_NavigateToAdd_HasCancelButton()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("navigate-to-add", null)));
        Assert.Contains(page.Children, c => c is ButtonNode b && b.Action.Name == "navigate-to-list");
    }

    // ── action: navigate-to-list ─────────────────────────────────────────────────

    [Fact]
    public void Action_NavigateToList_ReturnsToListView()
    {
        var controller = CreateController();
        controller.Action(new ActionPayload("navigate-to-detail", Ctx(new { id = "c1" })));
        var page = Page(controller.Action(new ActionPayload("navigate-to-list", null)));
        Assert.Equal("Contacts", page.Title);
        Assert.Equal(12, ContactList(page).Children.Count);
    }

    // ── action: save-contact (add) ───────────────────────────────────────────────

    [Fact]
    public void Action_SaveContact_Add_NavigatesToListAndShowsThirteenContacts()
    {
        var controller = CreateController();
        controller.Action(new ActionPayload("navigate-to-add", null));
        var page = Page(controller.Action(new ActionPayload("save-contact",
            Ctx(new { name = "Dave Wilson", email = "dave@example.com", phone = "555-0199", notes = "" }))));
        Assert.Equal("Contacts", page.Title);
        Assert.Equal(13, ContactList(page).Children.Count);
    }

    [Fact]
    public void Action_SaveContact_Add_NewContactAppearsInList()
    {
        var controller = CreateController();
        controller.Action(new ActionPayload("navigate-to-add", null));
        var page = Page(controller.Action(new ActionPayload("save-contact",
            Ctx(new { name = "Dave Wilson", email = "dave@example.com", phone = "", notes = "" }))));
        var texts = ContactList(page).Children
            .Cast<ListItemNode>()
            .SelectMany(i => i.Children.OfType<TextNode>())
            .Select(t => t.Value);
        Assert.Contains("Dave Wilson", texts);
    }

    [Fact]
    public void Action_SaveContact_Add_EmptyName_ReturnsBadRequest()
    {
        var controller = CreateController();
        var result = controller.Action(new ActionPayload("save-contact",
            Ctx(new { name = "", email = "x@example.com", phone = "", notes = "" })));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── action: save-contact (edit) ──────────────────────────────────────────────

    [Fact]
    public void Action_SaveContact_Edit_ReturnsToDetailWithUpdatedValues()
    {
        var controller = CreateController();
        controller.Action(new ActionPayload("navigate-to-detail", Ctx(new { id = "c1" })));
        var page = Page(controller.Action(new ActionPayload("save-contact",
            Ctx(new { id = "c1", name = "Alice Updated", email = "alice_new@example.com", phone = "555-9999", notes = "Updated" }))));
        Assert.Equal("Alice Updated", page.Title);
        var nameField = GetForm(page).Children.OfType<FieldNode>().Single(f => f.Name == "name");
        Assert.Equal("Alice Updated", nameField.Value);
    }

    [Fact]
    public void Action_SaveContact_Edit_EmptyName_ReturnsBadRequest()
    {
        var controller = CreateController();
        controller.Action(new ActionPayload("navigate-to-detail", Ctx(new { id = "c1" })));
        var result = controller.Action(new ActionPayload("save-contact",
            Ctx(new { id = "c1", name = "", email = "", phone = "", notes = "" })));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── action: delete-contact ───────────────────────────────────────────────────

    [Fact]
    public void Action_DeleteContact_RemovesContactAndNavigatesToList()
    {
        var controller = CreateController();
        controller.Action(new ActionPayload("navigate-to-detail", Ctx(new { id = "c1" })));
        var page = Page(controller.Action(new ActionPayload("delete-contact", Ctx(new { id = "c1" }))));
        Assert.Equal("Contacts", page.Title);
        Assert.Equal(11, ContactList(page).Children.Count);
    }

    [Fact]
    public void Action_DeleteContact_RemovedContactNotInList()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("delete-contact", Ctx(new { id = "c1" }))));
        var texts = ContactList(page).Children
            .Cast<ListItemNode>()
            .SelectMany(i => i.Children.OfType<TextNode>())
            .Select(t => t.Value);
        Assert.DoesNotContain("Alice Johnson", texts);
    }

    // ── action: search ───────────────────────────────────────────────────────────

    [Fact]
    public void Action_Search_FiltersByName()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("search", Ctx(new { query = "alice" }))));
        Assert.Single(ContactList(page).Children);
    }

    [Fact]
    public void Action_Search_FiltersByEmail()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("search", Ctx(new { query = "bob@" }))));
        Assert.Single(ContactList(page).Children);
    }

    [Fact]
    public void Action_Search_UpdatesStatBar()
    {
        var controller = CreateController();
        var page = Page(controller.Action(new ActionPayload("search", Ctx(new { query = "alice" }))));
        Assert.Equal("1 of 12", StatBar(page).Stats.Single().Value);
    }

    [Fact]
    public void Action_Search_EmptyQuery_ShowsAll()
    {
        var controller = CreateController();
        controller.Action(new ActionPayload("search", Ctx(new { query = "alice" })));
        var page = Page(controller.Action(new ActionPayload("search", Ctx(new { query = "" }))));
        Assert.Equal(12, ContactList(page).Children.Count);
        Assert.Equal("12", StatBar(page).Stats.Single().Value);
    }

    [Fact]
    public void Action_UnknownAction_ReturnsBadRequest()
    {
        var controller = CreateController();
        var result = controller.Action(new ActionPayload("teleport", null));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
