namespace HelpDesk.Controllers;

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
        return new ShellResponse<AgentState>(BuildVm(state), state).Validate();
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<AgentState>> Action()
    {
        // 3.8.0 — version-aware parse: rejects a stale client (mismatched
        // X-VMS-Client-Build header) with a 400 stale_client BEFORE _state is
        // deserialized. The build id matches AddVmsShellVersioning in Program.cs.
        var payload = ActionPayload<AgentState>.Parse(Request, HelpDeskBuild.Id);

        var state = payload.State with { NotesSaved = false };
        var name = payload.Name;

        // Phase 6 (WIRE-07) — every input value flows through state at the
        // bound path; per-row identity is encoded in the action name itself.
        if (name.StartsWith("filter-") && name != "filter-text")
        {
            // Filter is already in state via the TabsNode bind.
        }
        else if (name == "filter-text")
        {
            // TitleFilter is already in state via the column filterBind.
        }
        else if (name == "bulk-start" || name == "bulk-resolve" || name == "bulk-reopen")
        {
            var bulkStatus = name switch
            {
                "bulk-start"   => "in-progress",
                "bulk-resolve" => "resolved",
                _              => "open",
            };
            // The per-row checkbox bind has already written true/false to
            // SelectedIds keyed by ticket id; read the truthy keys here.
            foreach (var kv in state.SelectedIds)
            {
                if (kv.Value && long.TryParse(kv.Key, out var id))
                    db.UpdateStatus(id, bulkStatus);
            }
            state = state with { SelectedIds = new Dictionary<string, bool>() };
        }
        else if (name.StartsWith("select-ticket-"))
        {
            if (long.TryParse(name["select-ticket-".Length..], out var sid))
            {
                var ticket = db.GetById(sid);
                state = state with
                {
                    SelectedTicketId = sid,
                    View = "detail",
                    AgentNotes = ticket?.AgentNotes ?? "",
                };
            }
        }
        else if (name == "back-to-queue")
        {
            state = state with { View = "queue", SelectedTicketId = null, AgentNotes = "" };
        }
        else if (name == "start-ticket")
        {
            if (state.SelectedTicketId.HasValue)
                db.UpdateStatus(state.SelectedTicketId.Value, "in-progress");
        }
        else if (name == "resolve-ticket")
        {
            if (state.SelectedTicketId.HasValue)
                db.UpdateStatus(state.SelectedTicketId.Value, "resolved");
        }
        else if (name == "reopen-ticket")
        {
            if (state.SelectedTicketId.HasValue)
                db.UpdateStatus(state.SelectedTicketId.Value, "open");
        }
        else if (name == "save-notes")
        {
            if (state.SelectedTicketId.HasValue)
            {
                db.UpdateAgentNotes(state.SelectedTicketId.Value, state.AgentNotes);
                state = state with { NotesSaved = true };
            }
        }
        else
        {
            throw new UnknownActionException(name);
        }

        return new ShellResponse<AgentState>(BuildVm(state), state).Validate();
    }

    private ViewNode BuildVm(AgentState state)
    {
        if (state.View == "detail" && state.SelectedTicketId.HasValue)
        {
            var sel = db.GetById(state.SelectedTicketId.Value);
            if (sel != null) return BuildTicketPage(sel, state);
        }
        return BuildQueuePage(state);
    }

    private const int Cap = 25;

    private ViewNode BuildQueuePage(AgentState state)
    {
        var (open, inProgress, resolved) = db.GetCounts();
        var status = state.Filter == "all" ? null : state.Filter;
        var matching = db.CountMatching(status, state.TitleFilter);
        var withinCap = matching <= Cap;

        var children = new List<ViewNode>
        {
            new TextNode($"{open} open · {inProgress} in progress · {resolved} resolved", TextStyle.Muted),
            new TabsNode(
                Selected: state.Filter,
                Bind:     "filter",
                Tabs:
                [
                    new TabItem("all",         "All",         new ActionDescriptor("filter-all")),
                    new TabItem("open",        "Open",        new ActionDescriptor("filter-open")),
                    new TabItem("in-progress", "In Progress", new ActionDescriptor("filter-in-progress")),
                    new TabItem("resolved",    "Resolved",    new ActionDescriptor("filter-resolved")),
                ]),
        };

        var tickets = withinCap ? db.GetMatching(status, state.TitleFilter, Cap) : new List<Ticket>();

        // Bulk action toolbar — visible when there are matches within the cap.
        // 1.13.0 — laid out with Layout:"switcher": three equal-weight actions
        // that flip all-row ↔ all-stack ATOMICALLY at a content-width threshold
        // (never passing through an awkward 2-up intermediate the way `cards`
        // auto-fit would). Limit:3 caps the row at the three buttons, and
        // Threshold:"md" (30rem) sets the flip width. The canonical
        // equal-action-toolbar exemplar — no app CSS, no @media. Mirrors
        // demo/HelpDesk-bun/server.ts byte-for-byte (parity-gated).
        if (withinCap && tickets.Count > 0)
        {
            children.Add(new SectionNode(null,
            [
                new ButtonNode("Mark In Progress", new ActionDescriptor("bulk-start"),   Emphasis.Secondary),
                new ButtonNode("Mark Resolved",    new ActionDescriptor("bulk-resolve"), Emphasis: Emphasis.Primary),
                new ButtonNode("Reopen",           new ActionDescriptor("bulk-reopen"),  Emphasis.Secondary),
            ],
            Layout: Layout.Switcher,
            Threshold: Threshold.Md,
            Limit:     3));
        }

        var dbEmpty = open + inProgress + resolved == 0;

        if (!withinCap)
        {
            children.Add(new TextNode(
                $"{matching} tickets match — refine the filter (max {Cap} shown).",
                Tone: Tone.Warning));
        }
        else if (tickets.Count == 0 && !dbEmpty)
        {
            // Filter narrowed to zero matches against a non-empty DB. The
            // TableNode still renders below so the title filter input + status
            // tabs stay accessible — without this message the empty body is
            // ambiguous with "broken render".
            children.Add(new TextNode("No tickets match your filter.", TextStyle.Muted));
        }

        // Empty-state fallback for an empty queue (only when the DB itself is
        // empty — the "filter matches nothing" case is handled above).
        if (withinCap && tickets.Count == 0 && dbEmpty)
        {
            children.Add(new TextNode("No tickets in queue.", TextStyle.Muted));
        }
        else
        {
            var rows = tickets.Select(t =>
            {
                var rowActions = new List<ViewNode>
                {
                    // Per-row selection checkbox — bind writes true/false
                    // directly to selectedIds.{id} (no action needed). Clicking
                    // the checkbox stops propagation so it doesn't also fire
                    // the click-anywhere row.Action below.
                    new CheckboxNode($"select-{t.Id}", $"selectedIds.{t.Id}", null, null),
                };
                return new TableRow(
                    Cells: new Dictionary<string, string>
                    {
                        ["title"]    = t.Title,
                        ["type"]     = TypeLabel(t.Type),
                        ["priority"] = PriorityLabel(t.Priority),
                        ["status"]   = StatusLabel(t.Status),
                        ["due"]      = string.IsNullOrEmpty(t.DueDate) ? "—" : t.DueDate!,
                    },
                    Id:      t.Id.ToString(),
                    Actions: rowActions,
                    State:   TicketState(t),
                    Tone:    TicketTone(t),
                    // Click-anywhere row navigation — same target as the old
                    // "Open" button, just on the whole row (keyboard + ARIA
                    // automatic via the renderer; see TableRow.Action XML doc).
                    Action:  new ActionDescriptor($"select-ticket-{t.Id}"));
            }).ToList();

            children.Add(new TableNode(
                Columns:
                [
                    new TableColumn("title",    "Title", Filterable: true,
                        FilterValue: state.TitleFilter.Length > 0 ? state.TitleFilter : null),
                    new TableColumn("type",     "Type"),
                    new TableColumn("priority", "Priority"),
                    new TableColumn("status",   "Status"),
                    new TableColumn("due",      "Due"),
                ],
                Rows: rows,
                FilterBinds: new Dictionary<string, string> { ["title"] = "titleFilter" },
                FilterAction: new ActionDescriptor("filter-text")));
        }

        return new PageNode("Help Desk — Agent", children);
    }

    private ViewNode BuildTicketPage(Ticket ticket, AgentState state)
    {
        var info = new List<ViewNode>
        {
            new TextNode($"Status: {StatusLabel(ticket.Status)}",      TextStyle.Muted),
            new TextNode($"Type: {TypeLabel(ticket.Type)}",            TextStyle.Muted),
            new TextNode($"Priority: {PriorityLabel(ticket.Priority)}", TextStyle.Muted),
            new TextNode($"Submitted: {FormatDate(ticket.CreatedAt)}",  TextStyle.Muted),
        };

        switch (ticket.Type)
        {
            case "hardware" when !string.IsNullOrEmpty(ticket.DeviceModel):
                info.Add(new TextNode($"Device: {ticket.DeviceModel}", TextStyle.Muted));
                break;
            case "software" when !string.IsNullOrEmpty(ticket.Application):
                info.Add(new TextNode($"Application: {ticket.Application}", TextStyle.Muted));
                break;
            case "access":
                var sys = ticket.SystemName ?? "";
                if (!string.IsNullOrEmpty(ticket.AccessLevel)) sys += $" ({ticket.AccessLevel} access)";
                if (!string.IsNullOrEmpty(sys)) info.Add(new TextNode($"System: {sys}", TextStyle.Muted));
                break;
        }

        if (!string.IsNullOrEmpty(ticket.DueDate))
            info.Add(new TextNode($"Due: {ticket.DueDate}", TextStyle.Muted));

        if (!string.IsNullOrEmpty(ticket.Description))
            info.Add(new TextNode(ticket.Description, TextStyle.Body));

        var actionChildren = new List<ViewNode>();
        switch (ticket.Status)
        {
            case "open":
                actionChildren.Add(new ButtonNode("Mark In Progress",
                    new ActionDescriptor("start-ticket"),
                    Emphasis.Primary,
                    PendingLabel: "Marking…"));
                break;
            case "in-progress":
                actionChildren.Add(new ButtonNode("Mark Resolved",
                    new ActionDescriptor("resolve-ticket"),
                    Emphasis.Primary,
                    PendingLabel: "Resolving…"));
                break;
            case "resolved":
                actionChildren.Add(new ButtonNode("Reopen",
                    new ActionDescriptor("reopen-ticket"),
                    Emphasis.Secondary,
                    PendingLabel: "Reopening…"));
                if (!string.IsNullOrEmpty(ticket.ResolvedAt))
                    actionChildren.Add(new TextNode($"Resolved {FormatDate(ticket.ResolvedAt)}", TextStyle.Muted));
                break;
        }

        return new PageNode(ticket.Title,
        [
            new ButtonNode("← Back to Queue", new ActionDescriptor("back-to-queue"), null),
            new SectionNode("Ticket Info", info),
            new SectionNode("Agent Notes",
            [
                new FormNode(
                    SubmitAction: new ActionDescriptor("save-notes"),
                    SubmitLabel:  "Save Notes",
                    Children:     NotesFormChildren(state.NotesSaved)
                )
            ], Collapsible: true),
            new SectionNode("Actions", actionChildren),
        ]);
    }

    private static IReadOnlyList<ViewNode> NotesFormChildren(bool saved)
    {
        var children = new List<ViewNode>
        {
            // Bound to state.AgentNotes; the renderer reads/writes from there.
            new FieldNode("agent_notes", "textarea", "agentNotes", null, "Add notes…"),
        };
        if (saved) children.Add(new TextNode("Notes saved.", TextStyle.Muted));
        return children;
    }

    // Status splits across the two orthogonal axes: State (lifecycle: done/high)
    // and Tone (severity: critical → danger).
    private static string? TicketState(Ticket t) => t.Status switch
    {
        "resolved" => "done",
        _          => t.Priority == "high" ? "high" : null,
    };

    private static Tone? TicketTone(Ticket t) =>
        t.Status != "resolved" && t.Priority == "critical" ? Tone.Danger : null;

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
