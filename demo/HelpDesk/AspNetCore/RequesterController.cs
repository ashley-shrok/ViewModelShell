namespace HelpDesk.Controllers;

using Microsoft.AspNetCore.Mvc;
using ViewModelShell;

[ApiController]
[Route("api/requester")]
public class RequesterController(HelpDeskDb db) : ControllerBase
{
    [HttpGet]
    public ShellResponse<RequesterState> Get()
    {
        var state = RequesterState.Initial();
        return new ShellResponse<RequesterState>(BuildVm(state), state).Validate();
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<RequesterState>> Action()
    {
        // 3.8.0 — version-aware parse: rejects a stale client (mismatched
        // X-VMS-Client-Build header) with a 400 stale_client BEFORE _state is
        // deserialized. The build id matches AddVmsShellVersioning in Program.cs.
        var payload = ActionPayload<RequesterState>.Parse(Request, HelpDeskBuild.Id);

        var state = payload.State;
        var name = payload.Name;

        // Soft-validation rejection (rides on the ok:true re-render). Set by the
        // create-ticket guard below; surfaced to wire-driving agents via
        // .WithRejection() at the single return. The human path still sees the
        // ValidationError TextNode — the two coexist by design.
        List<ErrorEntry>? violations = null;

        if (name.StartsWith("filter-"))
        {
            // Filter is already in state via the TabsNode bind.
        }
        else if (name.StartsWith("select-ticket-"))
        {
            if (long.TryParse(name["select-ticket-".Length..], out var sid))
                state = state with { SelectedTicketId = sid, View = "detail" };
        }
        else if (name == "back-to-list")
        {
            state = state with { View = "list", SelectedTicketId = null, ValidationError = null };
        }
        else if (name == "start-create")
        {
            state = state with
            {
                View = "create",
                CreateType = "hardware",
                CreatePriority = "medium",
                CreateAccessLevel = "read",
                ValidationError = null,
                DraftTitle = "",
                DraftDescription = "",
                DraftDueDate = "",
                DraftDeviceModel = "",
                DraftApplication = "",
                DraftSystemName = "",
            };
        }
        else if (name == "cancel-create")
        {
            state = state with { View = "list", ValidationError = null };
        }
        else if (name.StartsWith("set-type-"))
        {
            // CreateType is already in state via the TabsNode bind. Clear any
            // stale validation error so the form revalidates on next submit.
            state = state with { ValidationError = null };
        }
        else if (name.StartsWith("set-priority-"))
        {
            // CreatePriority is already in state via the TabsNode bind.
        }
        else if (name.StartsWith("set-access-level-"))
        {
            // CreateAccessLevel is already in state via the TabsNode bind.
        }
        else if (name == "create-ticket")
        {
            var title = (state.DraftTitle ?? "").Trim();
            if (string.IsNullOrWhiteSpace(title))
            {
                state = state with { ValidationError = "Title is required." };
                violations = [new ErrorEntry("Title is required.", Path: "draftTitle")];
            }
            else
            {
                db.Create(
                    title:       title,
                    type:        state.CreateType,
                    priority:    state.CreatePriority,
                    description: string.IsNullOrEmpty(state.DraftDescription) ? null : state.DraftDescription,
                    dueDate:     string.IsNullOrEmpty(state.DraftDueDate)     ? null : state.DraftDueDate,
                    deviceModel: state.CreateType == "hardware" && !string.IsNullOrEmpty(state.DraftDeviceModel) ? state.DraftDeviceModel : null,
                    application: state.CreateType == "software" && !string.IsNullOrEmpty(state.DraftApplication) ? state.DraftApplication : null,
                    systemName:  state.CreateType == "access"   && !string.IsNullOrEmpty(state.DraftSystemName)  ? state.DraftSystemName  : null,
                    accessLevel: state.CreateType == "access"   ? state.CreateAccessLevel : null
                );
                state = state with { ValidationError = null, View = "list" };
            }
        }
        else
        {
            throw new UnknownActionException(name);
        }

        var resp = new ShellResponse<RequesterState>(BuildVm(state), state);
        if (violations is not null) resp = resp.WithRejection(violations);
        return resp.Validate();
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
            State:    TicketState(t),
            Tone:     TicketTone(t),
            Children:
            [
                new TextNode(t.Title, TextStyle.Subheading),
                new TextNode($"{TypeLabel(t.Type)} · {PriorityLabel(t.Priority)}", TextStyle.Muted),
                new TextNode(StatusLabel(t.Status), TextStyle.Muted),
                // Per-row View — unique action name per ticket.
                new ButtonNode("View",
                    new ActionDescriptor($"select-ticket-{t.Id}"),
                    Emphasis.Secondary),
            ]
        )).ToList();

        if (items.Count == 0)
            items.Add(new TextNode("No tickets found.", TextStyle.Muted));

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
                Bind:     "filter",
                Tabs:
                [
                    new TabItem("all",         "All",         new ActionDescriptor("filter-all")),
                    new TabItem("open",        "Open",        new ActionDescriptor("filter-open")),
                    new TabItem("in-progress", "In Progress", new ActionDescriptor("filter-in-progress")),
                    new TabItem("resolved",    "Resolved",    new ActionDescriptor("filter-resolved")),
                ]
            ),
            new ListNode(items),
            new ButtonNode("New Ticket", new ActionDescriptor("start-create"), Emphasis: Emphasis.Primary),
        ]);
    }

    private static ViewNode BuildCreateView(RequesterState state)
    {
        var formChildren = new List<ViewNode>();

        if (state.ValidationError != null)
            formChildren.Add(new TextNode(state.ValidationError, Tone: Tone.Danger));

        formChildren.Add(new FieldNode("title", "text", "draftTitle", "Title",
            "Brief description of the issue", Required: true));

        switch (state.CreateType)
        {
            case "hardware":
                formChildren.Add(new FieldNode("device_model", "text", "draftDeviceModel", "Device / Model",
                    "e.g. Dell XPS 15, iPhone 15"));
                break;
            case "software":
                formChildren.Add(new FieldNode("application", "text", "draftApplication", "Application",
                    "e.g. Microsoft Excel, Slack"));
                break;
            case "access":
                formChildren.Add(new FieldNode("system_name", "text", "draftSystemName", "System / Resource",
                    "e.g. VPN, GitHub, Salesforce"));
                break;
        }

        formChildren.Add(new FieldNode("description", "textarea", "draftDescription", "Description",
            "Provide additional details…"));
        formChildren.Add(new FieldNode("due_date", "date", "draftDueDate", "Due By", null));

        var pageChildren = new List<ViewNode>
        {
            new TabsNode(
                Selected: state.CreateType,
                Bind:     "createType",
                Tabs:
                [
                    new TabItem("hardware", "Hardware",       new ActionDescriptor("set-type-hardware")),
                    new TabItem("software", "Software",       new ActionDescriptor("set-type-software")),
                    new TabItem("access",   "Access Request", new ActionDescriptor("set-type-access")),
                ]
            ),
        };

        if (state.CreateType == "access")
        {
            pageChildren.Add(new TabsNode(
                Selected: state.CreateAccessLevel,
                Bind:     "createAccessLevel",
                Tabs:
                [
                    new TabItem("read",  "Read",  new ActionDescriptor("set-access-level-read")),
                    new TabItem("write", "Write", new ActionDescriptor("set-access-level-write")),
                    new TabItem("admin", "Admin", new ActionDescriptor("set-access-level-admin")),
                ]
            ));
        }

        pageChildren.Add(new TabsNode(
            Selected: state.CreatePriority,
            Bind:     "createPriority",
            Tabs:
            [
                new TabItem("low",      "Low",      new ActionDescriptor("set-priority-low")),
                new TabItem("medium",   "Medium",   new ActionDescriptor("set-priority-medium")),
                new TabItem("high",     "High",     new ActionDescriptor("set-priority-high")),
                new TabItem("critical", "Critical", new ActionDescriptor("set-priority-critical")),
            ]
        ));

        pageChildren.Add(new FormNode(
            SubmitAction: new ActionDescriptor("create-ticket"),
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
            new TextNode($"Status: {StatusLabel(ticket.Status)}",     TextStyle.Muted),
            new TextNode($"Type: {TypeLabel(ticket.Type)}",           TextStyle.Muted),
            new TextNode($"Priority: {PriorityLabel(ticket.Priority)}", TextStyle.Muted),
            new TextNode($"Submitted: {FormatDate(ticket.CreatedAt)}", TextStyle.Muted),
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
                var accessInfo = ticket.SystemName ?? "";
                if (!string.IsNullOrEmpty(ticket.AccessLevel))
                    accessInfo += $" ({ticket.AccessLevel} access)";
                if (!string.IsNullOrEmpty(accessInfo))
                    info.Add(new TextNode($"System: {accessInfo}", TextStyle.Muted));
                break;
        }

        if (!string.IsNullOrEmpty(ticket.DueDate))
            info.Add(new TextNode($"Due: {ticket.DueDate}", TextStyle.Muted));

        if (!string.IsNullOrEmpty(ticket.Description))
            info.Add(new TextNode(ticket.Description, TextStyle.Body));

        if (!string.IsNullOrEmpty(ticket.AgentNotes))
            info.Add(new TextNode($"Agent notes: {ticket.AgentNotes}", TextStyle.Muted));

        return new PageNode(ticket.Title,
        [
            new ButtonNode("← Back", new ActionDescriptor("back-to-list"), null),
            new SectionNode("Ticket Details", info),
        ]);
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
