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
//
// Phase 6 (WIRE-07): tests pre-populate state with whatever the action will
// read (DraftForm for create/edit; SearchQuery for search) and dispatch by
// action name only — per-row identity is encoded in the name itself.
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

    private static ActionResult<ShellResponse<ContactsState>> Act(
        ContactsController ctrl, ContactsState state, string name)
    {
        var actionJson = JsonSerializer.Serialize(new { name });
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

    private static PageNode Page(ViewNode? vm) => Assert.IsType<PageNode>(vm);

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
        Assert.NotNull(resp.State);
        Assert.Equal(12, resp.State!.Contacts.Count);
        Assert.Equal("list", resp.State.CurrentView);
        Assert.Null(resp.State.SelectedId);
        Assert.Equal("", resp.State.SearchQuery);
        Assert.Equal("", resp.State.DraftForm.Name);
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
    public void Get_Master_HasBoundSearchField()
    {
        var field = Field(SearchForm(Page(CreateController().Get().Vm)), "query");
        Assert.NotNull(field.Action);
        Assert.Equal("search", field.Action!.Name);
        Assert.Equal("searchQuery", field.Bind);
        Assert.Equal("Search by name or email…", field.Placeholder);
        Assert.False(field.Required);
    }

    [Fact]
    public void Get_Master_SearchForm_SubmitsSearch()
    {
        var form = SearchForm(Page(CreateController().Get().Vm));
        Assert.NotNull(form.SubmitAction);
        Assert.Equal("search", form.SubmitAction!.Name);
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
    public void Get_Master_EachItem_HasNameEmailAndUniqueOpenAction()
    {
        var list = ContactList(Page(CreateController().Get().Vm));
        foreach (var item in list.Children.Cast<ListItemNode>())
        {
            Assert.Equal(2, item.Children.OfType<TextNode>().Count());
            var openBtn = item.Children.OfType<ButtonNode>().Single();
            Assert.Equal("Open", openBtn.Label);
            // Phase 6 — per-row "Open" action name encodes the contact id.
            Assert.Equal($"navigate-to-detail-{item.Id}", openBtn.Action.Name);
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

    // ── action: navigate-to-detail-{id} ──────────────────────────────────────────

    [Fact]
    public void Action_NavigateToDetail_KeepsPageTitleContacts()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail-c1"));
        Assert.Equal("Contacts", Page(resp.Vm).Title);
    }

    [Fact]
    public void Action_NavigateToDetail_DetailCardHeadingIsContactName()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail-c1"));
        var detail = Detail(Page(resp.Vm));
        Assert.Equal("Alice Johnson", detail.Heading);
        Assert.Equal("card", detail.Variant);
    }

    [Fact]
    public void Action_NavigateToDetail_SeedsDraftFormWithContactValues()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail-c1"));
        Assert.NotNull(resp.State);
        Assert.Equal("Alice Johnson", resp.State!.DraftForm.Name);
        Assert.Equal("alice@example.com", resp.State.DraftForm.Email);
        Assert.True(Field(DetailForm(Page(resp.Vm)), "name").Required);
    }

    [Fact]
    public void Action_NavigateToDetail_DetailFormSubmitsUniqueSaveAction()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail-c1"));
        var form = DetailForm(Page(resp.Vm));
        Assert.NotNull(form.SubmitAction);
        Assert.Equal("save-contact-edit-c1", form.SubmitAction!.Name);
        Assert.Equal("Save", form.SubmitLabel);
    }

    [Fact]
    public void Action_NavigateToDetail_DetailFieldsBindToDraftForm()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail-c1"));
        var form = DetailForm(Page(resp.Vm));
        Assert.Equal("draftForm.name",  Field(form, "name").Bind);
        Assert.Equal("draftForm.email", Field(form, "email").Bind);
        Assert.Equal("draftForm.phone", Field(form, "phone").Bind);
        Assert.Equal("draftForm.notes", Field(form, "notes").Bind);
    }

    [Fact]
    public void Action_NavigateToDetail_SelectedRowHasActiveVariant()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail-c1"));
        var list = ContactList(Page(resp.Vm));
        var active = list.Children.Cast<ListItemNode>().Where(i => i.Variant == "active").ToList();
        Assert.Single(active);
        Assert.Equal("c1", active[0].Id);
        Assert.All(list.Children.Cast<ListItemNode>().Where(i => i.Id != "c1"),
            i => Assert.Null(i.Variant));
    }

    [Fact]
    public void Action_NavigateToDetail_HasUniqueDeleteButtonInDetail()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail-c1"));
        var del = Detail(Page(resp.Vm)).Children.OfType<ButtonNode>()
            .Single(b => b.Variant == "danger");
        Assert.Equal("Delete", del.Label);
        Assert.Equal("delete-contact-c1", del.Action.Name);
    }

    [Fact]
    public void Action_NavigateToDetail_UnknownId_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var result = Act(ctrl, ContactsState.Initial(), "navigate-to-detail-zzz");
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
        Assert.NotNull(form.SubmitAction);
        Assert.Equal("save-contact-new", form.SubmitAction!.Name);
        Assert.Equal("Create Contact", form.SubmitLabel);
    }

    [Fact]
    public void Action_NavigateToAdd_DraftFormCleared()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-add"));
        Assert.NotNull(resp.State);
        Assert.Equal("", resp.State!.DraftForm.Name);
        var form = DetailForm(Page(resp.Vm));
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
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail-c1"));
        Assert.NotNull(step1.State);
        var step2 = Ok(Act(ctrl, step1.State!, "navigate-to-list"));
        Assert.Equal("Contacts", Page(step2.Vm).Title);
        Assert.Equal(12, ContactList(Page(step2.Vm)).Children.Count);
        Assert.Equal("Details", Detail(Page(step2.Vm)).Heading);
        Assert.NotNull(step2.State);
        Assert.Null(step2.State!.SelectedId);
    }

    // ── action: save-contact-new ─────────────────────────────────────────────────

    [Fact]
    public void Action_SaveNew_AddsContactAndSelectsIt()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-add"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with
        {
            DraftForm = new DraftForm("Dave Wilson", "dave@example.com", "555-0199", ""),
        };
        var step2 = Ok(Act(ctrl, staged, "save-contact-new"));
        Assert.NotNull(step2.State);
        Assert.Equal("Contacts", Page(step2.Vm).Title);
        Assert.Equal(13, ContactList(Page(step2.Vm)).Children.Count);
        Assert.Equal("detail", step2.State!.CurrentView);
        Assert.Equal("Dave Wilson", Detail(Page(step2.Vm)).Heading);
        Assert.NotNull(step2.State.SelectedId);
    }

    [Fact]
    public void Action_SaveNew_NewContactAppearsInList()
    {
        var ctrl = CreateController();
        var state = ContactsState.Initial() with
        {
            CurrentView = "add",
            DraftForm   = new DraftForm("Dave Wilson", "dave@example.com", "", ""),
        };
        var resp = Ok(Act(ctrl, state, "save-contact-new"));
        var texts = ContactList(Page(resp.Vm)).Children
            .Cast<ListItemNode>()
            .SelectMany(i => i.Children.OfType<TextNode>())
            .Select(t => t.Value);
        Assert.Contains("Dave Wilson", texts);
    }

    [Fact]
    public void Action_SaveNew_EmptyName_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var state = ContactsState.Initial() with
        {
            CurrentView = "add",
            DraftForm   = new DraftForm("", "x@example.com", "", ""),
        };
        var result = Act(ctrl, state, "save-contact-new");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── action: save-contact-edit-{id} ───────────────────────────────────────────

    [Fact]
    public void Action_SaveEdit_StaysInDetailWithUpdatedValues()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail-c1"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with
        {
            DraftForm = new DraftForm("Alice Updated", "alice_new@example.com", "555-9999", "Updated"),
        };
        var step2 = Ok(Act(ctrl, staged, "save-contact-edit-c1"));
        Assert.NotNull(step2.State);
        Assert.Equal("Contacts", Page(step2.Vm).Title);
        Assert.Equal("Alice Updated", Detail(Page(step2.Vm)).Heading);
        Assert.Equal("detail", step2.State!.CurrentView);
        Assert.Equal("c1", step2.State.SelectedId);
    }

    [Fact]
    public void Action_SaveEdit_UpdatedNameShowsInMasterList()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail-c1"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with
        {
            DraftForm = new DraftForm("Alice Updated", "alice_new@example.com", "555-9999", "Updated"),
        };
        var step2 = Ok(Act(ctrl, staged, "save-contact-edit-c1"));
        var texts = ContactList(Page(step2.Vm)).Children
            .Cast<ListItemNode>()
            .SelectMany(i => i.Children.OfType<TextNode>())
            .Select(t => t.Value);
        Assert.Contains("Alice Updated", texts);
        Assert.DoesNotContain("Alice Johnson", texts);
    }

    [Fact]
    public void Action_SaveEdit_EmptyName_ReturnsBadRequest()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail-c1"));
        Assert.NotNull(step1.State);
        var staged = step1.State! with
        {
            DraftForm = new DraftForm("", "", "", ""),
        };
        var result = Act(ctrl, staged, "save-contact-edit-c1");
        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    // ── action: delete-contact-{id} ──────────────────────────────────────────────

    [Fact]
    public void Action_DeleteContact_RemovesContactAndClearsSelection()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial(), "navigate-to-detail-c1"));
        Assert.NotNull(step1.State);
        var step2 = Ok(Act(ctrl, step1.State!, "delete-contact-c1"));
        Assert.NotNull(step2.State);
        Assert.Equal("Contacts", Page(step2.Vm).Title);
        Assert.Equal(11, ContactList(Page(step2.Vm)).Children.Count);
        Assert.Equal("Details", Detail(Page(step2.Vm)).Heading);
        Assert.Null(step2.State!.SelectedId);
        Assert.Equal("list", step2.State.CurrentView);
    }

    [Fact]
    public void Action_DeleteContact_RemovedContactNotInList()
    {
        var ctrl = CreateController();
        var resp = Ok(Act(ctrl, ContactsState.Initial(), "delete-contact-c1"));
        var texts = ContactList(Page(resp.Vm)).Children
            .Cast<ListItemNode>()
            .SelectMany(i => i.Children.OfType<TextNode>())
            .Select(t => t.Value);
        Assert.DoesNotContain("Alice Johnson", texts);
    }

    // ── action: search ───────────────────────────────────────────────────────────
    // The query lives in state.SearchQuery (bound to the field). The action
    // handler is essentially a re-render driven by the new query.

    [Fact]
    public void Action_Search_FiltersByName()
    {
        var ctrl = CreateController();
        var state = ContactsState.Initial() with { SearchQuery = "alice" };
        var resp = Ok(Act(ctrl, state, "search"));
        Assert.Single(ContactList(Page(resp.Vm)).Children);
    }

    [Fact]
    public void Action_Search_FiltersByEmail()
    {
        var ctrl = CreateController();
        var state = ContactsState.Initial() with { SearchQuery = "bob@" };
        var resp = Ok(Act(ctrl, state, "search"));
        Assert.Single(ContactList(Page(resp.Vm)).Children);
    }

    [Fact]
    public void Action_Search_UpdatesMasterHeadingCount()
    {
        var ctrl = CreateController();
        var state = ContactsState.Initial() with { SearchQuery = "alice" };
        var resp = Ok(Act(ctrl, state, "search"));
        Assert.Equal("All Contacts (1 of 12)", Master(Page(resp.Vm)).Heading);
    }

    [Fact]
    public void Action_Search_EmptyQuery_ShowsAll()
    {
        var ctrl = CreateController();
        var step1 = Ok(Act(ctrl, ContactsState.Initial() with { SearchQuery = "alice" }, "search"));
        Assert.NotNull(step1.State);
        var step2 = Ok(Act(ctrl, step1.State! with { SearchQuery = "" }, "search"));
        Assert.Equal(12, ContactList(Page(step2.Vm)).Children.Count);
        Assert.Equal("All Contacts (12)", Master(Page(step2.Vm)).Heading);
    }

    [Fact]
    public void Action_Search_NoMatches_ShowsEmptyList()
    {
        var ctrl = CreateController();
        var state = ContactsState.Initial() with { SearchQuery = "zzzzz-no-match" };
        var resp = Ok(Act(ctrl, state, "search"));
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
