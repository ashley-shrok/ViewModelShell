namespace HelpDesk.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using HelpDesk.ViewModels;

[ApiController]
[Route("api/requester")]
public class RequesterController(HelpDeskDb db) : ControllerBase
{
    [HttpGet]
    public ShellResponse<RequesterState> Get()
    {
        var state = RequesterState.Initial();
        return new(BuildVm(state), state);
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<RequesterState>> Action()
    {
        var payload = ActionPayload<RequesterState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        string? Str(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.String
                ? v.GetString() : null;

        var state = payload.State;

        switch (payload.Name)
        {
            case "filter":
                state = state with { Filter = Str("value") ?? "all" };
                break;

            case "select-ticket":
                var selId = Str("id");
                if (selId != null && long.TryParse(selId, out var sid))
                    state = state with { SelectedTicketId = sid, View = "detail" };
                break;

            case "back-to-list":
                state = state with { View = "list", SelectedTicketId = null, ValidationError = null };
                break;

            case "start-create":
                state = state with
                {
                    View = "create",
                    CreateType = "hardware",
                    CreatePriority = "medium",
                    CreateAccessLevel = "read",
                    ValidationError = null
                };
                break;

            case "cancel-create":
                state = state with { View = "list", ValidationError = null };
                break;

            case "set-type":
                state = state with { CreateType = Str("value") ?? "hardware", ValidationError = null };
                break;

            case "set-priority":
                state = state with { CreatePriority = Str("value") ?? "medium" };
                break;

            case "set-access-level":
                state = state with { CreateAccessLevel = Str("value") ?? "read" };
                break;

            case "create-ticket":
                var title = Str("title");
                if (string.IsNullOrWhiteSpace(title))
                {
                    state = state with { ValidationError = "Title is required." };
                    break;
                }
                db.Create(
                    title:       title.Trim(),
                    type:        Str("type")         ?? "hardware",
                    priority:    Str("priority")     ?? "medium",
                    description: Str("description"),
                    dueDate:     Str("due_date"),
                    deviceModel: Str("device_model"),
                    application: Str("application"),
                    systemName:  Str("system_name"),
                    accessLevel: Str("access_level")
                );
                state = state with { ValidationError = null, View = "list" };
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return new ShellResponse<RequesterState>(BuildVm(state), state);
    }

    private ViewNode BuildVm(RequesterState state) => state.View switch
    {
        "create" => BuildCreateView(state),
        "detail" => BuildDetailView(state),
        _        => BuildListView(state),
    };

    private ViewNode BuildListView(RequesterState state)
    {
        var (open, inProgress, resolved) = db.GetCounts();
        var tickets = db.GetAll(state.Filter == "all" ? null : state.Filter);

        var items = tickets.Select(t => (ViewNode)new ListItemNode(
            Id:       t.Id.ToString(),
            Variant:  TicketVariant(t),
            Children:
            [
                new TextNode(t.Title, "subheading"),
                new TextNode($"{TypeLabel(t.Type)} · {PriorityLabel(t.Priority)}", "muted"),
                new TextNode(StatusLabel(t.Status), "muted"),
                new ButtonNode("View",
                    new ActionDescriptor("select-ticket", new() { ["id"] = t.Id.ToString() }),
                    "secondary"),
            ]
        )).ToList();

        if (items.Count == 0)
            items.Add(new TextNode("No tickets found.", "muted"));

        return new PageNode("Help Desk",
        [
            new StatBarNode(
            [
                new StatItem("open",        open.ToString()),
                new StatItem("in progress", inProgress.ToString()),
                new StatItem("resolved",    resolved.ToString()),
            ]),
            new TabsNode(
                Selected: state.Filter,
                Action:   new ActionDescriptor("filter"),
                Tabs:
                [
                    new TabItem("all",         "All"),
                    new TabItem("open",        "Open"),
                    new TabItem("in-progress", "In Progress"),
                    new TabItem("resolved",    "Resolved"),
                ]
            ),
            new ListNode(items),
            new ButtonNode("New Ticket", new ActionDescriptor("start-create"), "primary"),
        ]);
    }

    private static ViewNode BuildCreateView(RequesterState state)
    {
        var formChildren = new List<ViewNode>();

        if (state.ValidationError != null)
            formChildren.Add(new TextNode(state.ValidationError, "error"));

        formChildren.Add(new FieldNode("title", "text", "Title",
            "Brief description of the issue", null, Required: true));

        switch (state.CreateType)
        {
            case "hardware":
                formChildren.Add(new FieldNode("device_model", "text", "Device / Model",
                    "e.g. Dell XPS 15, iPhone 15", null));
                break;
            case "software":
                formChildren.Add(new FieldNode("application", "text", "Application",
                    "e.g. Microsoft Excel, Slack", null));
                break;
            case "access":
                formChildren.Add(new FieldNode("system_name", "text", "System / Resource",
                    "e.g. VPN, GitHub, Salesforce", null));
                break;
        }

        formChildren.Add(new FieldNode("description", "textarea", "Description",
            "Provide additional details…", null));
        formChildren.Add(new FieldNode("due_date", "date", "Due By", null, null));

        var baked = new Dictionary<string, object>
        {
            ["type"]     = state.CreateType,
            ["priority"] = state.CreatePriority,
        };
        if (state.CreateType == "access")
            baked["access_level"] = state.CreateAccessLevel;

        var pageChildren = new List<ViewNode>
        {
            new TabsNode(
                Selected: state.CreateType,
                Action:   new ActionDescriptor("set-type"),
                Tabs:
                [
                    new TabItem("hardware", "Hardware"),
                    new TabItem("software", "Software"),
                    new TabItem("access",   "Access Request"),
                ]
            ),
        };

        if (state.CreateType == "access")
        {
            pageChildren.Add(new TabsNode(
                Selected: state.CreateAccessLevel,
                Action:   new ActionDescriptor("set-access-level"),
                Tabs:
                [
                    new TabItem("read",  "Read"),
                    new TabItem("write", "Write"),
                    new TabItem("admin", "Admin"),
                ]
            ));
        }

        pageChildren.Add(new TabsNode(
            Selected: state.CreatePriority,
            Action:   new ActionDescriptor("set-priority"),
            Tabs:
            [
                new TabItem("low",      "Low"),
                new TabItem("medium",   "Medium"),
                new TabItem("high",     "High"),
                new TabItem("critical", "Critical"),
            ]
        ));

        pageChildren.Add(new FormNode(
            SubmitAction: new ActionDescriptor("create-ticket", baked),
            SubmitLabel:  "Submit Ticket",
            Children:     formChildren
        ));

        pageChildren.Add(new ButtonNode("Cancel", new ActionDescriptor("cancel-create"), null));

        return new PageNode("New Ticket", pageChildren);
    }

    private ViewNode BuildDetailView(RequesterState state)
    {
        var ticket = db.GetById(state.SelectedTicketId!.Value);
        if (ticket == null)
            return BuildListView(state with { View = "list", SelectedTicketId = null });

        var info = new List<ViewNode>
        {
            new TextNode($"Status: {StatusLabel(ticket.Status)}",     "muted"),
            new TextNode($"Type: {TypeLabel(ticket.Type)}",           "muted"),
            new TextNode($"Priority: {PriorityLabel(ticket.Priority)}", "muted"),
            new TextNode($"Submitted: {FormatDate(ticket.CreatedAt)}", "muted"),
        };

        switch (ticket.Type)
        {
            case "hardware" when !string.IsNullOrEmpty(ticket.DeviceModel):
                info.Add(new TextNode($"Device: {ticket.DeviceModel}", "muted"));
                break;
            case "software" when !string.IsNullOrEmpty(ticket.Application):
                info.Add(new TextNode($"Application: {ticket.Application}", "muted"));
                break;
            case "access":
                var accessInfo = ticket.SystemName ?? "";
                if (!string.IsNullOrEmpty(ticket.AccessLevel))
                    accessInfo += $" ({ticket.AccessLevel} access)";
                if (!string.IsNullOrEmpty(accessInfo))
                    info.Add(new TextNode($"System: {accessInfo}", "muted"));
                break;
        }

        if (!string.IsNullOrEmpty(ticket.DueDate))
            info.Add(new TextNode($"Due: {ticket.DueDate}", "muted"));

        if (!string.IsNullOrEmpty(ticket.Description))
            info.Add(new TextNode(ticket.Description, "body"));

        if (!string.IsNullOrEmpty(ticket.AgentNotes))
            info.Add(new TextNode($"Agent notes: {ticket.AgentNotes}", "muted"));

        return new PageNode(ticket.Title,
        [
            new ButtonNode("← Back", new ActionDescriptor("back-to-list"), null),
            new SectionNode("Ticket Details", info),
        ]);
    }

    private static string? TicketVariant(Ticket t) => t.Status switch
    {
        "resolved" => "done",
        _ => t.Priority switch
        {
            "critical" => "critical",
            "high"     => "high",
            _          => null,
        }
    };

    private static string TypeLabel(string type) => type switch
    {
        "hardware" => "Hardware",
        "software" => "Software",
        "access"   => "Access Request",
        _          => type,
    };

    private static string PriorityLabel(string priority) => priority switch
    {
        "low"      => "Low",
        "medium"   => "Medium",
        "high"     => "High",
        "critical" => "Critical",
        _          => priority,
    };

    private static string StatusLabel(string status) => status switch
    {
        "open"        => "Open",
        "in-progress" => "In Progress",
        "resolved"    => "Resolved",
        _             => status,
    };

    private static string FormatDate(string iso)
    {
        return DateTime.TryParse(iso, out var dt)
            ? dt.ToLocalTime().ToString("MMM d, yyyy")
            : iso;
    }
}
