namespace ContactManager.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using ContactManager.Controllers;
using ContactManager.State;
using ViewModelShell;

// 0.4.0 redesign: ONE persistent page with a split master/detail layout.
//   PageNode(Title:"Contacts", Density:"compact", Layout:"split",
//            Children:[ master SectionNode, detail SectionNode ])
//   master  = SectionNode(Heading:"All Contacts (N[ of M])",
//                          Children:[ search FormNode, "+ Add Contact" ButtonNode,
//                                     "contact-list" ListNode ])
//             selected row's ListItemNode has Variant "active".
//   detail  = SectionNode(Variant:"card"):
//                add view      → Heading "New Contact"  + create FormNode + Cancel
//                no selection  → Heading "Details"      + muted hint TextNode
//                selection     → Heading <contact.Name> + save FormNode + Delete
// The page title stays "Contacts" on every view (no per-contact navigation).
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

    // ── tree navigation helpers (master/detail split) ────────────────────────────

    private static PageNode Page(ViewNode vm) => Assert.IsType<PageNode>(vm);

    /// The two top-level sections: [0] master (list), [1] detail (card panel).
    private static SectionNode Master(PageNode page) =>
        Assert.IsType<SectionNode>(page.Children[0]);

    private static SectionNode Detail(PageNode page) =>
        Assert.IsType<SectionNode>(page.Children[1]);

    private static ListNode ContactList(PageNode page) =>
        Master(page).Children.OfType<ListNode>().Single();

    private static FormNode SearchForm(PageNode page) =>
        Master(page).Children.OfType<FormNode>().Single();

    private static ButtonNode AddButton(PageNode page) =>
        Master(page).Children.OfType<ButtonNode>().Single();

    private static FormNode DetailForm(PageNode page) =>
        Detail(page).Children.OfType<FormNode>().Single();

    private static FieldNode Field(FormNode form, string name) =>
        form.Children.OfType<FieldNode>().Single(f => f.Name == name);

    // ── GET /api/contacts ────────────────────────────────────────────────────────

    [Fact]
    public void Get_ReturnsSplitPageWithTitleDensityLayout()
    {
        var page = Page(CreateController().Get().Vm);
        Assert.Equal("Contacts", page.Title);
        Assert.Equal("compact", page.Density);
        Assert.Equal("split", page.Layout);
        Assert.Equal(2, page.Children.Count);
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
        Assert.Null(resp.State.SelectedId);
        Assert.Equal("", resp.State.SearchQuery);
    }

    [Fact]
    public void Get_Master_HeadingShowsTotalCount()
    {
        Assert.Equal("All Contacts (12)", Master(Page(CreateController().Get().Vm)).Heading);
    }

    [Fact]
    public void Get_Master_ContactListHasStableId()
    {
        Assert.Equal("contact-list", ContactList(Page(CreateController().Get().Vm)).Id);
    }

    [Fact]
    public void Get_Master_HasAddContactButton()
    {
        var addBtn = AddButton(Page(CreateController().Get().Vm));
        Assert.Equal("+ Add Contact", addBtn.Label);
        Assert.Equal("navigate-to-add", addBtn.Action.Name);
        Assert.Equal("primary", addBtn.Variant);
    }

    [Fact]
    public void Get_Master_HasSearchField()
    {
        Assert.Contains(SearchForm(Page(CreateController().Get().Vm)).Children,
            c => c is FieldNode f && f.Name == "query");
    }

    [Fact]
    public void Get_Master_SearchField_HasInputActionAndPlaceholder()
    {
        var field = Field(SearchForm(Page(CreateController().Get().Vm)), "query");
        Assert.NotNull(field.Action);
        Assert.Equal("search", field.Action!.Name);
        Assert.Equal("Search by name or email…", field.Placeholder);
        Assert.False(field.Required);
    }

    [Fact]
    public void Get_Master_SearchForm_SubmitsSearch()
    {
        var form = SearchForm(Page(CreateController().Get().Vm));
        Assert.Equal("search", form.SubmitAction.Name);
        Assert.Equal("Search", form.SubmitLabel);
    }

    [Fact]
    public void Get_Master_ContactsSortedByName()
    {
        var list = ContactList(Page(CreateController().Get().Vm));
        var names = list.Children.Cast<ListItemNode>()
            .Select(i => i.Children.OfType<TextNode>().First().Value)
            .ToList();
        Assert.Equal(names.OrderBy(n => n, StringComparer.Ordinal), names);
    }

    [Fact]
    public void Get_Master_EachItem_HasNameEmailAndOpenButton()
    {
        var list = ContactList(Page(CreateController().Get().Vm));
        foreach (var item in list.Children.Cast<ListItemNode>())
        {
            Assert.Equal(2, item.Children.OfType<TextNode>().Count());
            Assert.Contains(item.Children, c => c is ButtonNode b && b.Label == "Open");
            var openBtn = item.Children.OfType<ButtonNode>().Single();
            Assert.Equal("navigate-to-detail", openBtn.Action.Name);
        }
    }

    [Fact]
    public void Get_Master_NoRowHasActiveVariant_WhenNoSelection()
    {
        var list = ContactList(Page(CreateController().Get().Vm));
        Assert.All(list.Children.Cast<ListItemNode>(), i => Assert.Null(i.Variant));
    }

    [Fact]
    public void Get_Detail_ShowsEmptyState()
    {
        var detail = Detail(Page(CreateController().Get().Vm));
        Assert.Equal("Details", detail.Heading);
        Assert.Equal("card", detail.Variant);
        var hint = Assert.IsType<TextNode>(detail.Children.Single());
        Assert.Equal("Select a contact to view details, or add a new one.", hint.Value);
        Assert.Equal("muted", hint.Style);
    }

    // ── action: navigate-to-detail ───────────────────────────────────────────────

    [Fact]
    public void Action_NavigateToDetail_KeepsPageTitleContacts()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        Assert.Equal("Contacts", Page(resp.Vm).Title);
    }

    [Fact]
    public void Action_NavigateToDetail_DetailCardHeadingIsContactName()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var detail = Detail(Page(resp.Vm));
        Assert.Equal("Alice Johnson", detail.Heading);
        Assert.Equal("card", detail.Variant);
    }

    [Fact]
    public void Action_NavigateToDetail_FormPrefilledWithContactValues()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        Assert.Equal("Alice Johnson", Field(DetailForm(Page(resp.Vm)), "name").Value);
        Assert.Equal("alice@example.com", Field(DetailForm(Page(resp.Vm)), "email").Value);
        Assert.True(Field(DetailForm(Page(resp.Vm)), "name").Required);
    }

    [Fact]
    public void Action_NavigateToDetail_DetailFormSubmitsSaveWithId()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var form = DetailForm(Page(resp.Vm));
        Assert.Equal("save-contact", form.SubmitAction.Name);
        Assert.Equal("Save", form.SubmitLabel);
        Assert.NotNull(form.SubmitAction.Context);
        Assert.Equal("c1", form.SubmitAction.Context!["id"]);
    }

    [Fact]
    public void Action_NavigateToDetail_SelectedRowHasActiveVariant()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var list = ContactList(Page(resp.Vm));
        var active = list.Children.Cast<ListItemNode>().Where(i => i.Variant == "active").ToList();
        Assert.Single(active);
        Assert.Equal("c1", active[0].Id);
        Assert.All(list.Children.Cast<ListItemNode>().Where(i => i.Id != "c1"),
            i => Assert.Null(i.Variant));
    }

    [Fact]
    public void Action_NavigateToDetail_HasDeleteButtonInDetail()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var del = Detail(Page(resp.Vm)).Children.OfType<ButtonNode>()
            .Single(b => b.Variant == "danger");
        Assert.Equal("Delete", del.Label);
        Assert.Equal("delete-contact", del.Action.Name);
        Assert.Equal("c1", del.Action.Context!["id"]);
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
    public void Action_NavigateToAdd_DetailCardShowsNewContactForm()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-add"));
        Assert.Equal("Contacts", Page(resp.Vm).Title);
        var detail = Detail(Page(resp.Vm));
        Assert.Equal("New Contact", detail.Heading);
        Assert.Equal("card", detail.Variant);
        var form = DetailForm(Page(resp.Vm));
        Assert.Equal("save-contact", form.SubmitAction.Name);
        Assert.Null(form.SubmitAction.Context);
        Assert.Equal("Create Contact", form.SubmitLabel);
    }

    [Fact]
    public void Action_NavigateToAdd_FormFieldsAreEmptyWithPlaceholders()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-add"));
        var form = DetailForm(Page(resp.Vm));
        Assert.All(form.Children.OfType<FieldNode>(), f => Assert.Null(f.Value));
        Assert.Equal("Full name", Field(form, "name").Placeholder);
        Assert.True(Field(form, "name").Required);
        Assert.False(Field(form, "email").Required);
    }

    [Fact]
    public void Action_NavigateToAdd_HasCancelButton()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-add"));
        var cancel = Detail(Page(resp.Vm)).Children.OfType<ButtonNode>().Single();
        Assert.Equal("Cancel", cancel.Label);
        Assert.Equal("navigate-to-list", cancel.Action.Name);
        Assert.Null(cancel.Variant);
    }

    [Fact]
    public void Action_NavigateToAdd_MasterListStillPresent()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-add"));
        Assert.Equal(12, ContactList(Page(resp.Vm)).Children.Count);
    }

    // ── action: navigate-to-list ─────────────────────────────────────────────────

    [Fact]
    public void Action_NavigateToList_ReturnsToEmptyDetailState()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var step2 = Ok(Act(ctrl, step1.State, "navigate-to-list"));
        Assert.Equal("Contacts", Page(step2.Vm).Title);
        Assert.Equal(12, ContactList(Page(step2.Vm)).Children.Count);
        Assert.Equal("Details", Detail(Page(step2.Vm)).Heading);
        Assert.Null(step2.State.SelectedId);
    }

    // ── action: save-contact (add) ───────────────────────────────────────────────

    [Fact]
    public void Action_SaveContact_Add_SelectsNewContactInDetail()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-add"));
        var step2 = Ok(Act(ctrl, step1.State, "save-contact",
            Ctx(new { name = "Dave Wilson", email = "dave@example.com", phone = "555-0199", notes = "" })));
        Assert.Equal("Contacts", Page(step2.Vm).Title);
        Assert.Equal(13, ContactList(Page(step2.Vm)).Children.Count);
        Assert.Equal("detail", step2.State.CurrentView);
        Assert.Equal("Dave Wilson", Detail(Page(step2.Vm)).Heading);
        Assert.NotNull(step2.State.SelectedId);
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
    public void Action_SaveContact_Edit_StaysInDetailWithUpdatedValues()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var step2 = Ok(Act(ctrl, step1.State, "save-contact",
            Ctx(new { id = "c1", name = "Alice Updated", email = "alice_new@example.com", phone = "555-9999", notes = "Updated" })));
        Assert.Equal("Contacts", Page(step2.Vm).Title);
        Assert.Equal("Alice Updated", Detail(Page(step2.Vm)).Heading);
        Assert.Equal("Alice Updated", Field(DetailForm(Page(step2.Vm)), "name").Value);
        Assert.Equal("detail", step2.State.CurrentView);
        Assert.Equal("c1", step2.State.SelectedId);
    }

    [Fact]
    public void Action_SaveContact_Edit_UpdatedNameShowsInMasterList()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var step2 = Ok(Act(ctrl, step1.State, "save-contact",
            Ctx(new { id = "c1", name = "Alice Updated", email = "alice_new@example.com", phone = "555-9999", notes = "Updated" })));
        var texts = ContactList(Page(step2.Vm)).Children
            .Cast<ListItemNode>()
            .SelectMany(i => i.Children.OfType<TextNode>())
            .Select(t => t.Value);
        Assert.Contains("Alice Updated", texts);
        Assert.DoesNotContain("Alice Johnson", texts);
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
    public void Action_DeleteContact_RemovesContactAndClearsSelection()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail", Ctx(new { id = "c1" })));
        var step2 = Ok(Act(ctrl, step1.State, "delete-contact", Ctx(new { id = "c1" })));
        Assert.Equal("Contacts", Page(step2.Vm).Title);
        Assert.Equal(11, ContactList(Page(step2.Vm)).Children.Count);
        Assert.Equal("Details", Detail(Page(step2.Vm)).Heading);
        Assert.Null(step2.State.SelectedId);
        Assert.Equal("list", step2.State.CurrentView);
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
    public void Action_Search_UpdatesMasterHeadingCount()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "search", Ctx(new { query = "alice" })));
        Assert.Equal("All Contacts (1 of 12)", Master(Page(resp.Vm)).Heading);
    }

    [Fact]
    public void Action_Search_PreservesQueryInSearchField()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "search", Ctx(new { query = "alice" })));
        Assert.Equal("alice", Field(SearchForm(Page(resp.Vm)), "query").Value);
    }

    [Fact]
    public void Action_Search_EmptyQuery_ShowsAll()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "search", Ctx(new { query = "alice" })));
        var step2 = Ok(Act(ctrl, step1.State, "search", Ctx(new { query = "" })));
        Assert.Equal(12, ContactList(Page(step2.Vm)).Children.Count);
        Assert.Equal("All Contacts (12)", Master(Page(step2.Vm)).Heading);
    }

    [Fact]
    public void Action_Search_NoMatches_ShowsEmptyList()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "search", Ctx(new { query = "zzzzz-no-match" })));
        Assert.Empty(ContactList(Page(resp.Vm)).Children);
        Assert.Equal("All Contacts (0 of 12)", Master(Page(resp.Vm)).Heading);
    }

    [Fact]
    public void Action_UnknownAction_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var result = Act(ctrl, ContactsState.Initial(), "teleport");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }
}
