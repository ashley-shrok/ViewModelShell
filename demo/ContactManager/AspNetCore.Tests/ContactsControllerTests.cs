namespace ContactManager.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using ContactManager.Controllers;
using ContactManager.State;
using ViewModelShell.ViewModels;

public class ContactsControllerTests
{
    private static ContactsController CreateController()
    {
        var controller = new ContactsController();
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

    private static ActionResult<ShellResponse<ContactsState>> Act(
        ContactsController ctrl, ContactsState state, string name,
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

    private static ShellResponse<ContactsState> Ok(ActionResult<ShellResponse<ContactsState>> result) =>
        result.Value ?? throw new Xunit.Sdk.XunitException("Expected a value, got " + result.Result?.GetType().Name);

    private static PageNode Page(ViewNode vm) => Assert.IsType<PageNode>(vm);
    private static ListNode ContactList(PageNode page) => page.Children.OfType<ListNode>().Single();
    private static StatBarNode StatBar(PageNode page) => page.Children.OfType<StatBarNode>().Single();
    private static FormNode GetForm(PageNode page) => page.Children.OfType<FormNode>().Single();

    // ── GET /api/contacts ────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsPageNodeWithTitle()
    {
        var page = Page(CreateController().Get().Vm);
        Assert.Equal("Contacts", page.Title);
    }

    [Fact]
    public void Get_ListView_HasTwelveContacts()
    {
        Assert.Equal(12, ContactList(Page(CreateController().Get().Vm)).Children.Count);
    }

    [Fact]
    public void Get_ReturnsInitialState()
    {
        var resp = CreateController().Get();
        Assert.Equal(12, resp.State.Contacts.Count);
        Assert.Equal("list", resp.State.CurrentView);
    }

    [Fact]
    public void Get_ListView_StatBarShowsTotal()
    {
        var stat = StatBar(Page(CreateController().Get().Vm)).Stats.Single();
        Assert.Equal("12", stat.Value);
        Assert.Equal("contacts", stat.Label);
    }

    [Fact]
    public void Get_ListView_HasAddContactButton()
    {
        var addBtn = Page(CreateController().Get().Vm).Children
            .OfType<ButtonNode>()
            .Single(b => b.Label == "Add Contact");
        Assert.Equal("navigate-to-add", addBtn.Action.Name);
    }

    [Fact]
    public void Get_ListView_HasSearchField()
    {
        var form = GetForm(Page(CreateController().Get().Vm));
        Assert.Contains(form.Children, c => c is FieldNode f && f.Name == "query");
    }

    [Fact]
    public void Get_ListView_SearchField_HasInputAction()
    {
        var form = GetForm(Page(CreateController().Get().Vm));
        var field = form.Children.OfType<FieldNode>().Single(f => f.Name == "query");
        Assert.NotNull(field.Action);
        Assert.Equal("search", field.Action.Name);
    }

    [Fact]
    public void Get_ListView_EachItem_HasNameAndViewButton()
    {
        var list = ContactList(Page(CreateController().Get().Vm));
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
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        Assert.Equal("Alice Johnson", Page(resp.Vm).Title);
    }

    [Fact]
    public void Action_NavigateToDetail_FormPrefilledWithContactValues()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var nameField = GetForm(Page(resp.Vm)).Children.OfType<FieldNode>().Single(f => f.Name == "name");
        Assert.Equal("Alice Johnson", nameField.Value);
    }

    [Fact]
    public void Action_NavigateToDetail_HasBackButton()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        Assert.Contains(Page(resp.Vm).Children, c => c is ButtonNode b && b.Action.Name == "navigate-to-list");
    }

    [Fact]
    public void Action_NavigateToDetail_HasDeleteButton()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        Assert.Contains(Page(resp.Vm).Children, c => c is ButtonNode b && b.Variant == "danger");
    }

    [Fact]
    public void Action_NavigateToDetail_MissingId_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var result = Act(ctrl, ContactsState.Initial(), "navigate-to-detail");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── action: navigate-to-add ──────────────────────────────────────────────────

    [Fact]
    public void Action_NavigateToAdd_ShowsNewContactTitle()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-add"));
        Assert.Equal("New Contact", Page(resp.Vm).Title);
    }

    [Fact]
    public void Action_NavigateToAdd_FormFieldsAreEmpty()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-add"));
        Assert.All(GetForm(Page(resp.Vm)).Children.OfType<FieldNode>(), f => Assert.Null(f.Value));
    }

    [Fact]
    public void Action_NavigateToAdd_HasCancelButton()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-add"));
        Assert.Contains(Page(resp.Vm).Children, c => c is ButtonNode b && b.Action.Name == "navigate-to-list");
    }

    // ── action: navigate-to-list ─────────────────────────────────────────────────

    [Fact]
    public void Action_NavigateToList_ReturnsToListView()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var step2 = Ok(Act(ctrl, step1.State, "navigate-to-list"));
        Assert.Equal("Contacts", Page(step2.Vm).Title);
        Assert.Equal(12, ContactList(Page(step2.Vm)).Children.Count);
    }

    // ── action: save-contact (add) ───────────────────────────────────────────────

    [Fact]
    public void Action_SaveContact_Add_NavigatesToListAndShowsThirteenContacts()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-add"));
        var step2 = Ok(Act(ctrl, step1.State, "save-contact",
            Ctx(new { name = "Dave Wilson", email = "dave@example.com", phone = "555-0199", notes = "" })));
        Assert.Equal("Contacts", Page(step2.Vm).Title);
        Assert.Equal(13, ContactList(Page(step2.Vm)).Children.Count);
    }

    [Fact]
    public void Action_SaveContact_Add_NewContactAppearsInList()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-add"));
        var step2 = Ok(Act(ctrl, step1.State, "save-contact",
            Ctx(new { name = "Dave Wilson", email = "dave@example.com", phone = "", notes = "" })));
        var texts = ContactList(Page(step2.Vm)).Children
            .Cast<ListItemNode>()
            .SelectMany(i => i.Children.OfType<TextNode>())
            .Select(t => t.Value);
        Assert.Contains("Dave Wilson", texts);
    }

    [Fact]
    public void Action_SaveContact_Add_EmptyName_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var result = Act(ctrl, ContactsState.Initial(), "save-contact",
            Ctx(new { name = "", email = "x@example.com", phone = "", notes = "" }));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── action: save-contact (edit) ──────────────────────────────────────────────

    [Fact]
    public void Action_SaveContact_Edit_ReturnsToDetailWithUpdatedValues()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var step2 = Ok(Act(ctrl, step1.State, "save-contact",
            Ctx(new { id = "c1", name = "Alice Updated", email = "alice_new@example.com", phone = "555-9999", notes = "Updated" })));
        Assert.Equal("Alice Updated", Page(step2.Vm).Title);
        var nameField = GetForm(Page(step2.Vm)).Children.OfType<FieldNode>().Single(f => f.Name == "name");
        Assert.Equal("Alice Updated", nameField.Value);
    }

    [Fact]
    public void Action_SaveContact_Edit_EmptyName_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var result = Act(ctrl, step1.State, "save-contact",
            Ctx(new { id = "c1", name = "", email = "", phone = "", notes = "" }));
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── action: delete-contact ───────────────────────────────────────────────────

    [Fact]
    public void Action_DeleteContact_RemovesContactAndNavigatesToList()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var step2 = Ok(Act(ctrl, step1.State, "delete-contact", Ctx(new { id = "c1" })));
        Assert.Equal("Contacts", Page(step2.Vm).Title);
        Assert.Equal(11, ContactList(Page(step2.Vm)).Children.Count);
    }

    [Fact]
    public void Action_DeleteContact_RemovedContactNotInList()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "delete-contact", Ctx(new { id = "c1" })));
        var texts = ContactList(Page(resp.Vm)).Children
            .Cast<ListItemNode>()
            .SelectMany(i => i.Children.OfType<TextNode>())
            .Select(t => t.Value);
        Assert.DoesNotContain("Alice Johnson", texts);
    }

    // ── action: search ───────────────────────────────────────────────────────────

    [Fact]
    public void Action_Search_FiltersByName()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "search", Ctx(new { query = "alice" })));
        Assert.Single(ContactList(Page(resp.Vm)).Children);
    }

    [Fact]
    public void Action_Search_FiltersByEmail()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "search", Ctx(new { query = "bob@" })));
        Assert.Single(ContactList(Page(resp.Vm)).Children);
    }

    [Fact]
    public void Action_Search_UpdatesStatBar()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "search", Ctx(new { query = "alice" })));
        Assert.Equal("1 of 12", StatBar(Page(resp.Vm)).Stats.Single().Value);
    }

    [Fact]
    public void Action_Search_EmptyQuery_ShowsAll()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "search", Ctx(new { query = "alice" })));
        var step2 = Ok(Act(ctrl, step1.State, "search", Ctx(new { query = "" })));
        Assert.Equal(12, ContactList(Page(step2.Vm)).Children.Count);
        Assert.Equal("12", StatBar(Page(step2.Vm)).Stats.Single().Value);
    }

    [Fact]
    public void Action_UnknownAction_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var result = Act(ctrl, ContactsState.Initial(), "teleport");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
