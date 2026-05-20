namespace HelpDesk.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ViewModelShell;

[ApiController]
[Route("api/agent")]
public class AgentController(HelpDeskDb db) : ControllerBase
{
    [HttpGet]
    public ShellResponse<AgentState> Get()
    {
        var state = AgentState.Initial();
        return new(BuildVm(state), state);
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<AgentState>> Action()
    {
        var payload = ActionPayload<AgentState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        string? Str(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.String
                ? v.GetString() : null;

        var state = payload.State with { NotesSaved = false };

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

            case "back-to-queue":
                state = state with { View = "queue", SelectedTicketId = null };
                break;

            case "start-ticket":
                var startId = Str("id");
                if (startId != null && long.TryParse(startId, out var stid))
                {
                    db.UpdateStatus(stid, "in-progress");
                    if (state.View == "detail")
                        state = state with { SelectedTicketId = stid };
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
                    state = state with { NotesSaved = true };
                }
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return new ShellResponse<AgentState>(BuildVm(state), state);
    }

    // Realistic ticket system: a full-width filterable ticket queue
    // (table; whole-row click opens the ticket) → a dedicated full
    // ticket page. The navigate pattern real ticketing actually uses.
    private ViewNode BuildVm(AgentState state)
    {
        if (state.View == "detail" && state.SelectedTicketId.HasValue)
        {
            var sel = db.GetById(state.SelectedTicketId.Value);
            if (sel != null) return BuildTicketPage(sel, state);
        }
        return BuildQueuePage(state);
    }

    private ViewNode BuildQueuePage(AgentState state)
    {
        var (open, inProgress, resolved) = db.GetCounts();
        var tickets = db.GetAll(state.Filter == "all" ? null : state.Filter);

        var rows = tickets.Select(t => new TableRow(
            Cells: new Dictionary<string, string>
            {
                ["title"]    = t.Title,
                ["type"]     = TypeLabel(t.Type),
                ["priority"] = PriorityLabel(t.Priority),
                ["status"]   = StatusLabel(t.Status),
                ["due"]      = string.IsNullOrEmpty(t.DueDate) ? "—" : t.DueDate!,
            },
            Id:      t.Id.ToString(),
            Action:  new ActionDescriptor("select-ticket", new() { ["id"] = t.Id.ToString() }),
            Variant: TicketVariant(t))).ToList();

        return new PageNode("Help Desk — Agent",
        [
            new TextNode($"{open} open · {inProgress} in progress · {resolved} resolved", "muted"),
            new TabsNode(
                Selected: state.Filter,
                Action:   new ActionDescriptor("filter"),
                Tabs:
                [
                    new TabItem("all",         "All"),
                    new TabItem("open",        "Open"),
                    new TabItem("in-progress", "In Progress"),
                    new TabItem("resolved",    "Resolved"),
                ]),
            rows.Count == 0
                ? new TextNode("No tickets in queue.", "muted")
                : new TableNode(
                    Columns:
                    [
                        new TableColumn("title",    "Title"),
                        new TableColumn("type",     "Type"),
                        new TableColumn("priority", "Priority"),
                        new TableColumn("status",   "Status"),
                        new TableColumn("due",      "Due"),
                    ],
                    Rows: rows),
        ]);
    }

    private ViewNode BuildTicketPage(Ticket ticket, AgentState state)
    {
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

        var actionChildren = new List<ViewNode>();
        switch (ticket.Status)
        {
            case "open":
                actionChildren.Add(new ButtonNode("Mark In Progress",
                    new ActionDescriptor("start-ticket",   new() { ["id"] = ticket.Id.ToString() }),
                    "primary",
                    PendingLabel: "Marking…"));
                break;
            case "in-progress":
                actionChildren.Add(new ButtonNode("Mark Resolved",
                    new ActionDescriptor("resolve-ticket", new() { ["id"] = ticket.Id.ToString() }),
                    "primary",
                    PendingLabel: "Resolving…"));
                break;
            case "resolved":
                actionChildren.Add(new ButtonNode("Reopen",
                    new ActionDescriptor("reopen-ticket",  new() { ["id"] = ticket.Id.ToString() }),
                    "secondary",
                    PendingLabel: "Reopening…"));
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
