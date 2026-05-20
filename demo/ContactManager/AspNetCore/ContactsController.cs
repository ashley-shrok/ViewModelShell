namespace ContactManager.Controllers;

using System.Text.Json;
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
        return new(BuildVm(state), state);
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<ContactsState>> Action()
    {
        var payload = ActionPayload<ContactsState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        string? Str(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.String
                ? v.GetString() : null;

        var state = payload.State;

        switch (payload.Name)
        {
            case "navigate-to-detail":
                var detailId = Str("id");
                if (detailId == null) return BadRequest("id required");
                state = state with { SelectedId = detailId, CurrentView = "detail" };
                break;

            case "navigate-to-add":
                state = state with { CurrentView = "add", SelectedId = null };
                break;

            case "navigate-to-list":
                state = state with { CurrentView = "list", SelectedId = null };
                break;

            case "save-contact":
                var name = Str("name");
                if (string.IsNullOrWhiteSpace(name)) return BadRequest("name required");
                var email  = (Str("email")  ?? "").Trim();
                var phone  = (Str("phone")  ?? "").Trim();
                var notes  = (Str("notes")  ?? "").Trim();
                var trimmedName = name.Trim();
                var editId = Str("id");
                if (!string.IsNullOrEmpty(editId))
                {
                    state = state with
                    {
                        Contacts = [.. state.Contacts.Select(c =>
                            c.Id == editId ? c with { Name = trimmedName, Email = email, Phone = phone, Notes = notes } : c)],
                        SelectedId = editId,
                        CurrentView = "detail"
                    };
                }
                else
                {
                    var added = new ContactRecord(
                        Id:        Guid.NewGuid().ToString("N")[..8],
                        Name:      trimmedName,
                        Email:     email,
                        Phone:     phone,
                        Notes:     notes,
                        CreatedAt: DateTimeOffset.UtcNow);
                    state = state with
                    {
                        Contacts    = [.. state.Contacts, added],
                        SelectedId  = added.Id,
                        CurrentView = "detail"
                    };
                }
                break;

            case "delete-contact":
                var deleteId = Str("id");
                if (deleteId != null)
                    state = state with { Contacts = [.. state.Contacts.Where(c => c.Id != deleteId)] };
                state = state with { CurrentView = "list", SelectedId = null };
                break;

            case "search":
                state = state with { SearchQuery = Str("query") ?? "" };
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return new ShellResponse<ContactsState>(BuildVm(state), state);
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
                        new FieldNode("query", "text", null, "Search by name or email…", state.SearchQuery,
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
                                // Finding B (deferred): ListItemNode has no row
                                // Action — per-row button is the honest affordance.
                                new ButtonNode(
                                    Label:   "Open",
                                    Action:  new ActionDescriptor("navigate-to-detail", new() { ["id"] = c.Id }),
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
                        SubmitAction: new ActionDescriptor("save-contact"),
                        SubmitLabel:  "Create Contact",
                        Children:
                        [
                            new FieldNode("name",  "text",     "Name",  "Full name",        null, Required: true),
                            new FieldNode("email", "email",    "Email", "email@example.com", null),
                            new FieldNode("phone", "text",     "Phone", "555-0100",          null),
                            new FieldNode("notes", "textarea", "Notes", "Any notes…",        null)
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
                    SubmitAction: new ActionDescriptor("save-contact", new() { ["id"] = contact.Id }),
                    SubmitLabel:  "Save",
                    Children:
                    [
                        new FieldNode("name",  "text",     "Name",  null, contact.Name, Required: true),
                        new FieldNode("email", "email",    "Email", null, contact.Email),
                        new FieldNode("phone", "text",     "Phone", null, contact.Phone),
                        new FieldNode("notes", "textarea", "Notes", null, contact.Notes)
                    ]),
                new ButtonNode("Delete", new ActionDescriptor("delete-contact", new() { ["id"] = contact.Id }), Variant: "danger")
            ]);
    }
}
