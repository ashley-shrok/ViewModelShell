namespace ContactManager.Controllers;

using Microsoft.AspNetCore.Mvc;
using ContactManager.State;
using ViewModelShell;

[ApiController]
[Route("api/contacts")]
public class ContactsController : ControllerBase
{
    [HttpGet]
    public ShellResponse<ContactsState> Get()
    {
        var state = ContactsState.Initial();
        return new ShellResponse<ContactsState>(BuildVm(state), state).Validate();
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<ContactsState>> Action()
    {
        var payload = ActionPayload<ContactsState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        var state = payload.State;
        var name = payload.Name;

        // Phase 6 (WIRE-07) — dispatch envelope is {name, state} only. Per-row
        // identity is encoded in the action name; values flow through state at
        // the input's bind path.
        if (name.StartsWith("navigate-to-detail-"))
        {
            var id = name["navigate-to-detail-".Length..];
            var c = state.Contacts.FirstOrDefault(x => x.Id == id);
            if (c is null) return BadRequest("id not found");
            state = state with
            {
                SelectedId = id,
                CurrentView = "detail",
                DraftForm = DraftForm.From(c),
            };
        }
        else if (name == "navigate-to-add")
        {
            state = state with { CurrentView = "add", SelectedId = null, DraftForm = DraftForm.Empty() };
        }
        else if (name == "navigate-to-list")
        {
            state = state with { CurrentView = "list", SelectedId = null, DraftForm = DraftForm.Empty() };
        }
        else if (name == "save-contact-new")
        {
            var draft = state.DraftForm;
            var trimmedName = (draft.Name ?? "").Trim();
            if (string.IsNullOrWhiteSpace(trimmedName)) return BadRequest("name required");
            var added = new ContactRecord(
                Id:        Guid.NewGuid().ToString("N")[..8],
                Name:      trimmedName,
                Email:     (draft.Email ?? "").Trim(),
                Phone:     (draft.Phone ?? "").Trim(),
                Notes:     (draft.Notes ?? "").Trim(),
                CreatedAt: DateTimeOffset.UtcNow);
            state = state with
            {
                Contacts    = [.. state.Contacts, added],
                SelectedId  = added.Id,
                CurrentView = "detail",
                DraftForm   = DraftForm.From(added),
            };
        }
        else if (name.StartsWith("save-contact-edit-"))
        {
            var editId = name["save-contact-edit-".Length..];
            var draft = state.DraftForm;
            var trimmedName = (draft.Name ?? "").Trim();
            if (string.IsNullOrWhiteSpace(trimmedName)) return BadRequest("name required");
            var email = (draft.Email ?? "").Trim();
            var phone = (draft.Phone ?? "").Trim();
            var notes = (draft.Notes ?? "").Trim();
            state = state with
            {
                Contacts = [.. state.Contacts.Select(c =>
                    c.Id == editId ? c with { Name = trimmedName, Email = email, Phone = phone, Notes = notes } : c)],
                SelectedId = editId,
                CurrentView = "detail",
                DraftForm = new DraftForm(trimmedName, email, phone, notes),
            };
        }
        else if (name.StartsWith("delete-contact-"))
        {
            var deleteId = name["delete-contact-".Length..];
            state = state with
            {
                Contacts    = [.. state.Contacts.Where(c => c.Id != deleteId)],
                CurrentView = "list",
                SelectedId  = null,
                DraftForm   = DraftForm.Empty(),
            };
        }
        else if (name == "search")
        {
            // SearchQuery is already in state via the field's bind path; the
            // server just acknowledges with a re-render driven by the new query.
        }
        else
        {
            throw new UnknownActionException(name);
        }

        return new ShellResponse<ContactsState>(BuildVm(state), state).Validate();
    }

    // Realistic CRM / Google-Contacts shape: ONE page, persistent
    // list-detail SPLIT. Left = searchable contact list (master); right =
    // a card panel that shows the selected contact / add form / empty
    // state (detail). Replaces the old 3-full-page-swap navigation.
    private static ViewNode BuildVm(ContactsState state) => new PageNode(
        Title: "Contacts",
        Density: "compact",      // a real contacts list is information-dense
        Layout: "split",         // 2-up master/detail; collapses to stacked on narrow
        Width: "wide",           // master+detail benefits from the 1440px cap — 0.7.0/#13
        Children:
        [
            BuildMaster(state),
            BuildDetail(state)
        ]);

    private static IReadOnlyList<ContactRecord> Filtered(ContactsState state)
    {
        if (string.IsNullOrWhiteSpace(state.SearchQuery)) return state.Contacts;
        return [.. state.Contacts.Where(c =>
            c.Name.Contains(state.SearchQuery,  StringComparison.OrdinalIgnoreCase) ||
            c.Email.Contains(state.SearchQuery, StringComparison.OrdinalIgnoreCase))];
    }

    // LEFT — searchable contact list.
    private static ViewNode BuildMaster(ContactsState state)
    {
        var filtered = Filtered(state);
        var count = filtered.Count == state.Contacts.Count
            ? $"{state.Contacts.Count}"
            : $"{filtered.Count} of {state.Contacts.Count}";

        return new SectionNode(
            Heading: $"All Contacts ({count})",
            Children:
            [
                new FormNode(
                    SubmitAction: new ActionDescriptor("search"),
                    SubmitLabel:  "Search",
                    Children:
                    [
                        new FieldNode("query", "text", "searchQuery", null, "Search by name or email…",
                            Action: new ActionDescriptor("search"))
                    ]),

                new ButtonNode(
                    Label:   "+ Add Contact",
                    Action:  new ActionDescriptor("navigate-to-add"),
                    Variant: "primary"),

                new ListNode(
                    Id: "contact-list",
                    Children: filtered
                        .OrderBy(c => c.Name)
                        .Select(c => (ViewNode)new ListItemNode(
                            Id:      c.Id,
                            // D-27: the shipped .vms-list-item--active default marks
                            // the current master-detail selection.
                            Variant: c.Id == state.SelectedId ? "active" : null,
                            Children:
                            [
                                new TextNode(c.Name,  null),
                                new TextNode(c.Email, "muted"),
                                // Per-row "Open" — unique action name per contact.
                                new ButtonNode(
                                    Label:   "Open",
                                    Action:  new ActionDescriptor($"navigate-to-detail-{c.Id}"),
                                    Variant: null)
                            ]))
                        .ToList())
            ]);
    }

    // RIGHT — detail card: selected contact / add form / empty state.
    private static ViewNode BuildDetail(ContactsState state)
    {
        if (state.CurrentView == "add")
        {
            return new SectionNode(
                Heading: "New Contact",
                Variant: "card",
                Children:
                [
                    new FormNode(
                        SubmitAction: new ActionDescriptor("save-contact-new"),
                        SubmitLabel:  "Create Contact",
                        Children:
                        [
                            new FieldNode("name",  "text",     "draftForm.name",  "Name",  "Full name",          Required: true),
                            new FieldNode("email", "email",    "draftForm.email", "Email", "email@example.com"),
                            new FieldNode("phone", "text",     "draftForm.phone", "Phone", "555-0100"),
                            new FieldNode("notes", "textarea", "draftForm.notes", "Notes", "Any notes…")
                        ]),
                    new ButtonNode("Cancel", new ActionDescriptor("navigate-to-list"), Variant: null)
                ]);
        }

        var contact = state.SelectedId != null
            ? state.Contacts.FirstOrDefault(c => c.Id == state.SelectedId)
            : null;

        if (contact == null)
        {
            return new SectionNode(
                Heading: "Details",
                Variant: "card",
                Children:
                [
                    new TextNode("Select a contact to view details, or add a new one.", "muted")
                ]);
        }

        return new SectionNode(
            Heading: contact.Name,
            Variant: "card",
            Children:
            [
                new FormNode(
                    SubmitAction: new ActionDescriptor($"save-contact-edit-{contact.Id}"),
                    SubmitLabel:  "Save",
                    Children:
                    [
                        new FieldNode("name",  "text",     "draftForm.name",  "Name",  null, Required: true),
                        new FieldNode("email", "email",    "draftForm.email", "Email", null),
                        new FieldNode("phone", "text",     "draftForm.phone", "Phone", null),
                        new FieldNode("notes", "textarea", "draftForm.notes", "Notes", null)
                    ]),
                new ButtonNode("Delete", new ActionDescriptor($"delete-contact-{contact.Id}"), Variant: "danger")
            ]);
    }
}
