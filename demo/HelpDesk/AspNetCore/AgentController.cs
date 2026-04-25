namespace HelpDesk.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using HelpDesk.ViewModels;

[ApiController]
[Route("api/agent")]
public class AgentController(AgentStateRegistry registry, HelpDeskDb db) : ControllerBase
{
    private AgentState State => registry.GetOrCreate(
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

        var state = State;
        state.NotesSaved = false;

        switch (payload.Name)
        {
            case "filter":
                state.Filter = Str("value") ?? "all";
                break;

            case "select-ticket":
                var selId = Str("id");
                if (selId != null && long.TryParse(selId, out var sid))
                {
                    state.SelectedTicketId = sid;
                    state.View = "detail";
                }
                break;

            case "back-to-queue":
                state.View = "queue";
                state.SelectedTicketId = null;
                break;

            case "start-ticket":
                var startId = Str("id");
                if (startId != null && long.TryParse(startId, out var stid))
                {
                    db.UpdateStatus(stid, "in-progress");
                    // If we're in detail view, stay there to show updated status
                    if (state.View != "detail")
                        break;
                    state.SelectedTicketId = stid;
                }
                break;

            case "resolve-ticket":
                var resolveId = Str("id");
                if (resolveId != null && long.TryParse(resolveId, out var rid))
                    db.UpdateStatus(rid, "resolved");
                break;

            case "reopen-ticket":
                var reopenId = Str("id");
                if (reopenId != null && long.TryParse(reopenId, out var roid))
                    db.UpdateStatus(roid, "open");
                break;

            case "save-notes":
                var notesId = Str("id");
                var notes   = Str("agent_notes");
                if (notesId != null && long.TryParse(notesId, out var nid))
                {
                    db.UpdateAgentNotes(nid, notes);
                    state.NotesSaved = true;
                }
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return BuildViewModel();
    }

    private ViewNode BuildViewModel()
    {
        var state = State;
        return state.View switch
        {
            "detail" => BuildDetailView(state),
            _        => BuildQueueView(state),
        };
    }

    private ViewNode BuildQueueView(AgentState state)
    {
        var (open, inProgress, resolved) = db.GetCounts();
        var tickets = db.GetAll(state.Filter == "all" ? null : state.Filter);

        var items = tickets.Select(t =>
        {
            var children = new List<ViewNode>
            {
                new TextNode(t.Title, "subheading"),
                new TextNode($"{TypeLabel(t.Type)} · {PriorityLabel(t.Priority)}", "muted"),
                new TextNode(StatusLabel(t.Status), "muted"),
            };

            if (!string.IsNullOrEmpty(t.DueDate))
                children.Add(new TextNode($"Due {t.DueDate}", "muted"));

            if (t.Status == "open")
                children.Add(new ButtonNode("Take",
                    new ActionDescriptor("start-ticket", new() { ["id"] = t.Id.ToString() }),
                    "primary"));

            children.Add(new ButtonNode("View",
                new ActionDescriptor("select-ticket", new() { ["id"] = t.Id.ToString() }),
                "secondary"));

            return (ViewNode)new ListItemNode(t.Id.ToString(), TicketVariant(t), children);
        }).ToList();

        if (items.Count == 0)
            items.Add(new TextNode("No tickets in queue.", "muted"));

        return new PageNode("Agent Queue",
        [
            new StatBarNode(
            [
                new StatItem("open",        open.ToString()),
                new StatItem("in progress", inProgress.ToString()),
                new StatItem("resolved",    resolved.ToString()),
                new StatItem("total",       (open + inProgress + resolved).ToString()),
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
        ]);
    }

    private ViewNode BuildDetailView(AgentState state)
    {
        var ticket = db.GetById(state.SelectedTicketId!.Value);
        if (ticket == null)
        {
            state.View = "queue";
            state.SelectedTicketId = null;
            return BuildQueueView(state);
        }

        var info = new List<ViewNode>
        {
            new TextNode($"Status: {StatusLabel(ticket.Status)}",      "muted"),
            new TextNode($"Type: {TypeLabel(ticket.Type)}",            "muted"),
            new TextNode($"Priority: {PriorityLabel(ticket.Priority)}", "muted"),
            new TextNode($"Submitted: {FormatDate(ticket.CreatedAt)}",  "muted"),
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
                var sys = ticket.SystemName ?? "";
                if (!string.IsNullOrEmpty(ticket.AccessLevel)) sys += $" ({ticket.AccessLevel} access)";
                if (!string.IsNullOrEmpty(sys)) info.Add(new TextNode($"System: {sys}", "muted"));
                break;
        }

        if (!string.IsNullOrEmpty(ticket.DueDate))
            info.Add(new TextNode($"Due: {ticket.DueDate}", "muted"));

        if (!string.IsNullOrEmpty(ticket.Description))
            info.Add(new TextNode(ticket.Description, "body"));

        // Conditionally available actions based on status
        var actionChildren = new List<ViewNode>();
        switch (ticket.Status)
        {
            case "open":
                actionChildren.Add(new ButtonNode("Mark In Progress",
                    new ActionDescriptor("start-ticket",   new() { ["id"] = ticket.Id.ToString() }),
                    "primary"));
                break;
            case "in-progress":
                actionChildren.Add(new ButtonNode("Mark Resolved",
                    new ActionDescriptor("resolve-ticket", new() { ["id"] = ticket.Id.ToString() }),
                    "primary"));
                break;
            case "resolved":
                actionChildren.Add(new ButtonNode("Reopen",
                    new ActionDescriptor("reopen-ticket",  new() { ["id"] = ticket.Id.ToString() }),
                    "secondary"));
                if (!string.IsNullOrEmpty(ticket.ResolvedAt))
                    actionChildren.Add(new TextNode($"Resolved {FormatDate(ticket.ResolvedAt)}", "muted"));
                break;
        }

        return new PageNode(ticket.Title,
        [
            new ButtonNode("← Back to Queue", new ActionDescriptor("back-to-queue"), null),
            new SectionNode("Ticket Info", info),
            new SectionNode("Agent Notes",
            [
                new FormNode(
                    SubmitAction: new ActionDescriptor("save-notes", new() { ["id"] = ticket.Id.ToString() }),
                    SubmitLabel:  "Save Notes",
                    Children:     NotesFormChildren(ticket.AgentNotes, state.NotesSaved)
                )
            ]),
            new SectionNode("Actions", actionChildren),
        ]);
    }

    private static IReadOnlyList<ViewNode> NotesFormChildren(string? agentNotes, bool saved)
    {
        var children = new List<ViewNode>
        {
            new FieldNode("agent_notes", "textarea", null, "Add notes…", agentNotes)
        };
        if (saved) children.Add(new TextNode("Notes saved.", "muted"));
        return children;
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
