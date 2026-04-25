namespace ContactManager.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ContactManager.Services;
using ViewModelShell.ViewModels;

[ApiController]
[Route("api/contacts")]
public class ContactsController(ContactStoreRegistry registry) : ControllerBase
{
    private ContactStore Store => registry.GetOrCreate(
        Request.Query.TryGetValue("tab", out var t) ? t.ToString() : "default"
    );

    [HttpGet]
    public ActionResult<ViewNode> Get() => BuildViewModel();

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ViewNode> Action()
    {
        var payload = ActionPayload.Parse(Request.Form["_action"].ToString());

        string? Str(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.String
                ? v.GetString() : null;

        switch (payload.Name)
        {
            case "navigate-to-detail":
                var detailId = Str("id");
                if (detailId == null) return BadRequest("id required");
                Store.SetSelectedId(detailId);
                Store.SetCurrentView(ContactView.Detail);
                break;

            case "navigate-to-add":
                Store.SetCurrentView(ContactView.Add);
                Store.SetSelectedId(null);
                break;

            case "navigate-to-list":
                Store.SetCurrentView(ContactView.List);
                Store.SetSelectedId(null);
                break;

            case "save-contact":
                var name = Str("name");
                if (string.IsNullOrWhiteSpace(name)) return BadRequest("name required");
                var email  = Str("email")  ?? "";
                var phone  = Str("phone")  ?? "";
                var notes  = Str("notes")  ?? "";
                var editId = Str("id");
                if (!string.IsNullOrEmpty(editId))
                {
                    Store.Update(editId, name.Trim(), email.Trim(), phone.Trim(), notes.Trim());
                    Store.SetSelectedId(editId);
                    Store.SetCurrentView(ContactView.Detail);
                }
                else
                {
                    Store.Add(name.Trim(), email.Trim(), phone.Trim(), notes.Trim());
                    Store.SetCurrentView(ContactView.List);
                }
                break;

            case "delete-contact":
                var deleteId = Str("id");
                if (deleteId != null) Store.Delete(deleteId);
                Store.SetCurrentView(ContactView.List);
                Store.SetSelectedId(null);
                break;

            case "search":
                Store.SetSearchQuery(Str("query") ?? "");
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return BuildViewModel();
    }

    private ViewNode BuildViewModel() => Store.GetCurrentView() switch
    {
        ContactView.Detail => BuildDetailView(),
        ContactView.Add    => BuildAddView(),
        _                  => BuildListView()
    };

    private ViewNode BuildListView()
    {
        var query    = Store.GetSearchQuery();
        var all      = Store.GetAll();
        var filtered = Store.GetFiltered(query);
        var statText = filtered.Count == all.Count
            ? $"{all.Count}"
            : $"{filtered.Count} of {all.Count}";

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
                        new FieldNode("query", "text", null, "Search by name or email…", query,
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

    private ViewNode BuildDetailView()
    {
        var id      = Store.GetSelectedId();
        var contact = id != null ? Store.GetById(id) : null;
        if (contact == null)
        {
            Store.SetCurrentView(ContactView.List);
            return BuildListView();
        }

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

    private ViewNode BuildAddView()
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
