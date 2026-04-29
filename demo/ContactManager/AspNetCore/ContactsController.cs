namespace ContactManager.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ContactManager.State;
using ViewModelShell.ViewModels;

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
                        CurrentView = "list"
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

    private static ViewNode BuildVm(ContactsState state) => state.CurrentView switch
    {
        "detail" => BuildDetailView(state),
        "add"    => BuildAddView(),
        _        => BuildListView(state)
    };

    private static IReadOnlyList<ContactRecord> Filtered(ContactsState state)
    {
        if (string.IsNullOrWhiteSpace(state.SearchQuery)) return state.Contacts;
        return [.. state.Contacts.Where(c =>
            c.Name.Contains(state.SearchQuery,  StringComparison.OrdinalIgnoreCase) ||
            c.Email.Contains(state.SearchQuery, StringComparison.OrdinalIgnoreCase))];
    }

    private static ViewNode BuildListView(ContactsState state)
    {
        var filtered = Filtered(state);
        var statText = filtered.Count == state.Contacts.Count
            ? $"{state.Contacts.Count}"
            : $"{filtered.Count} of {state.Contacts.Count}";

        return new PageNode(
            Title: "Contacts",
            Children:
            [
                new StatBarNode(
                [
                    new StatItem("contacts", statText)
                ]),

                new FormNode(
                    SubmitAction: new ActionDescriptor("search"),
                    SubmitLabel:  "Search",
                    Children:
                    [
                        new FieldNode("query", "text", null, "Search by name or email…", state.SearchQuery,
                            Action: new ActionDescriptor("search"))
                    ]
                ),

                new ButtonNode(
                    Label:   "Add Contact",
                    Action:  new ActionDescriptor("navigate-to-add"),
                    Variant: "primary"
                ),

                new ListNode(
                    Id: "contact-list",
                    Children: filtered
                        .OrderBy(c => c.Name)
                        .Select(c => (ViewNode)new ListItemNode(
                            Id:      c.Id,
                            Variant: null,
                            Children:
                            [
                                new TextNode(c.Name,  null),
                                new TextNode(c.Email, "muted"),
                                new TextNode(c.Phone, "muted"),
                                new ButtonNode(
                                    Label:   "View",
                                    Action:  new ActionDescriptor("navigate-to-detail", new() { ["id"] = c.Id }),
                                    Variant: null
                                )
                            ]
                        ))
                        .ToList()
                )
            ]
        );
    }

    private static ViewNode BuildDetailView(ContactsState state)
    {
        var contact = state.SelectedId != null
            ? state.Contacts.FirstOrDefault(c => c.Id == state.SelectedId)
            : null;
        if (contact == null) return BuildListView(state with { CurrentView = "list", SelectedId = null });

        return new PageNode(
            Title: contact.Name,
            Children:
            [
                new ButtonNode(
                    Label:   "← Back",
                    Action:  new ActionDescriptor("navigate-to-list"),
                    Variant: null
                ),

                new FormNode(
                    SubmitAction: new ActionDescriptor("save-contact", new() { ["id"] = contact.Id }),
                    SubmitLabel:  "Save",
                    Children:
                    [
                        new FieldNode("name",  "text",     "Name",  null, contact.Name,  Required: true),
                        new FieldNode("email", "email",    "Email", null, contact.Email),
                        new FieldNode("phone", "text",     "Phone", null, contact.Phone),
                        new FieldNode("notes", "textarea", "Notes", null, contact.Notes)
                    ]
                ),

                new ButtonNode(
                    Label:   "Delete",
                    Action:  new ActionDescriptor("delete-contact", new() { ["id"] = contact.Id }),
                    Variant: "danger"
                )
            ]
        );
    }

    private static ViewNode BuildAddView()
    {
        return new PageNode(
            Title: "New Contact",
            Children:
            [
                new ButtonNode(
                    Label:   "← Cancel",
                    Action:  new ActionDescriptor("navigate-to-list"),
                    Variant: null
                ),

                new FormNode(
                    SubmitAction: new ActionDescriptor("save-contact"),
                    SubmitLabel:  "Create Contact",
                    Children:
                    [
                        new FieldNode("name",  "text",     "Name",  "Full name",         null, Required: true),
                        new FieldNode("email", "email",    "Email", "email@example.com",  null),
                        new FieldNode("phone", "text",     "Phone", "555-0100",           null),
                        new FieldNode("notes", "textarea", "Notes", "Any notes…",         null)
                    ]
                )
            ]
        );
    }
}
