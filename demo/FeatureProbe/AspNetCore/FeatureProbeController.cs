namespace FeatureProbe.Controllers;

using Microsoft.AspNetCore.Mvc;
using ViewModelShell;

// Phase 6 (WIRE-07): per-row identity moves into action names; every input
// value flows through state at a bind path. Parity-driven action parameters
// (redirect-to, storage values, download URL/filename) live in dedicated
// state slots; the renderer's bind seam keeps them populated.

public record SortIntent(
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] string? Column,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)] string? Direction
);

public record TableFilters(string Name);

public record FeatureProbeState(
    int PollCount,
    string? LastUploadName,
    long LastUploadSize,
    string? LastSubmit,
    // Table feature-matrix state — bind targets for sort/filter/pagination.
    SortIntent SortIntent,
    TableFilters TableFilters,
    int TablePage,
    int LongActionPolls,
    // Phase 6 bind slots:
    string Note,
    // Parameters previously read from context by parity-driven actions.
    string RedirectTo,
    string LocalValue,
    string SessionValue,
    string DownloadUrl,
    string DownloadFilename
)
{
    public static FeatureProbeState Initial() => new(
        PollCount: 0,
        LastUploadName: null,
        LastUploadSize: 0,
        LastSubmit: null,
        SortIntent: new SortIntent(null, null),
        TableFilters: new TableFilters(""),
        TablePage: 1,
        LongActionPolls: 0,
        Note: "",
        RedirectTo: "",
        LocalValue: "",
        SessionValue: "",
        DownloadUrl: "",
        DownloadFilename: ""
    );
}

public record TableItem(string Id, string Name, string Status);

[ApiController]
[Route("api/probe")]
public class FeatureProbeController : ControllerBase
{
    private const int PageSize = 3;

    private static readonly TableItem[] Items =
    [
        new("1", "Apple",      "active"),
        new("2", "Banana",     "active"),
        new("3", "Cherry",     "done"),
        new("4", "Date",       "active"),
        new("5", "Elderberry", "done"),
        new("6", "Fig",        "active"),
        new("7", "Grape",      "done"),
    ];

    [HttpGet]
    public ShellResponse<FeatureProbeState> Get()
    {
        var state = FeatureProbeState.Initial();
        return new ShellResponse<FeatureProbeState>(BuildVm(state), state).Validate();
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<FeatureProbeState>> Action()
    {
        var payload = ActionPayload<FeatureProbeState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        var state = payload.State;
        var name = payload.Name;

        if (name == "trigger-redirect")
        {
            return ShellResponse<FeatureProbeState>.RedirectTo(
                string.IsNullOrEmpty(state.RedirectTo) ? "/default-redirect" : state.RedirectTo);
        }

        if (name == "set-storage")
        {
            return new ShellResponse<FeatureProbeState>(BuildVm(state), state)
                .WithEffect(ShellSideEffect.SetLocalStorage(
                    "probe-local",
                    string.IsNullOrEmpty(state.LocalValue) ? "default-local" : state.LocalValue))
                .WithEffect(ShellSideEffect.SetSessionStorage(
                    "probe-session",
                    string.IsNullOrEmpty(state.SessionValue) ? "default-session" : state.SessionValue))
                .Validate();
        }

        if (name == "trigger-download")
        {
            return new ShellResponse<FeatureProbeState>(BuildVm(state), state)
                .WithEffect(ShellSideEffect.Download(
                    string.IsNullOrEmpty(state.DownloadUrl) ? "/api/probe/file/hello.txt" : state.DownloadUrl,
                    string.IsNullOrEmpty(state.DownloadFilename) ? "hello.txt" : state.DownloadFilename))
                .Validate();
        }

        if (name == "do-poll")
        {
            state = state with { PollCount = state.PollCount + 1 };
            var done = state.PollCount >= 3;
            return new ShellResponse<FeatureProbeState>(BuildVm(state), state)
            {
                NextPollIn = done ? null : 100
            }.Validate();
        }

        if (name == "upload")
        {
            var file = Request.Form.Files.GetFile("attachment");
            if (file != null)
            {
                state = state with
                {
                    LastUploadName = file.FileName,
                    LastUploadSize = file.Length
                };
            }
        }
        else if (name == "show-copy-button") { /* unchanged */ }
        else if (name == "save-draft")
        {
            state = state with { LastSubmit = $"draft: {state.Note ?? ""}" };
        }
        else if (name == "publish")
        {
            state = state with { LastSubmit = $"published: {state.Note ?? ""}" };
        }
        else if (name == "reset")
        {
            state = FeatureProbeState.Initial();
        }
        else if (name == "start-long-action")
        {
            state = state with { LongActionPolls = 3 };
            return new ShellResponse<FeatureProbeState>(BuildVm(state), state)
            {
                PreventUnload = true,
                Busy = true,
                NextPollIn = 100,
            }.Validate();
        }
        else if (name == "long-action-poll")
        {
            var remaining = Math.Max(0, state.LongActionPolls - 1);
            state = state with { LongActionPolls = remaining };
            var workDone = remaining == 0;
            return new ShellResponse<FeatureProbeState>(BuildVm(state), state)
            {
                PreventUnload = !workDone,
                Busy = !workDone,
                NextPollIn = workDone ? null : 100,
            }.Validate();
        }
        else if (name == "table-sort-name" || name == "table-sort-status")
        {
            // SortIntent has been written to state by the renderer; reset page.
            state = state with { TablePage = 1 };
        }
        else if (name == "table-filter")
        {
            // TableFilters.Name has been written to state by the renderer; reset page.
            state = state with { TablePage = 1 };
        }
        else if (name == "table-page-prev" || name == "table-page-next")
        {
            // Renderer wrote target page to state.TablePage before dispatch.
        }
        else
        {
            return BadRequest($"Unknown action: {name}");
        }

        return new ShellResponse<FeatureProbeState>(BuildVm(state), state).Validate();
    }

    private static ViewNode BuildVm(FeatureProbeState state)
    {
        var children = new List<ViewNode>
        {
            new TextNode($"Poll count: {state.PollCount}", "muted"),
        };
        if (state.LastUploadName != null)
            children.Add(new TextNode($"Last upload: {state.LastUploadName} ({state.LastUploadSize} bytes)", "muted"));

        children.Add(new CopyButtonNode(
            "npx @ashley-shrok/viewmodel-shell",
            "Copy install command",
            "Copied!",
            Variant: "secondary"));

        children.Add(new ImageNode("/logo.png", Alt: "ViewModel Shell logo", Size: "small", Shape: "circle"));

        if (state.LastSubmit != null)
            children.Add(new TextNode($"Last submit: {state.LastSubmit}", "muted"));

        children.Add(new ButtonNode("Start long action",
            new ActionDescriptor("start-long-action"), "primary"));
        if (state.LongActionPolls > 0)
            children.Add(new TextNode(
                $"Long action in progress · {state.LongActionPolls} tick{(state.LongActionPolls == 1 ? "" : "s")} remaining",
                "muted"));

        // Multi-action form: shared "note" field bound to state.Note; two
        // buttons, each dispatching a unique-named action.
        children.Add(new FormNode(
            SubmitAction: null,
            SubmitLabel: null,
            Children: [new FieldNode("note", "text", "note", "Note", "Type a note…")],
            Buttons:
            [
                new ButtonNode("Save Draft", new ActionDescriptor("save-draft"), "secondary"),
                new ButtonNode("Publish",    new ActionDescriptor("publish"),    "primary")
            ]));

        var probeSection = new SectionNode("Probe", children, Variant: "card", Layout: "split");
        return new PageNode("Feature Probe",
            new List<ViewNode> { probeSection, BuildTableSection(state) },
            Density: "compact", Layout: "cards");
    }

    private static (List<TableItem> Page, int Total, int ClampedPage) Window(FeatureProbeState s)
    {
        IEnumerable<TableItem> q = Items;
        if (!string.IsNullOrEmpty(s.TableFilters.Name))
            q = q.Where(i => i.Name.Contains(s.TableFilters.Name, StringComparison.OrdinalIgnoreCase));
        var rows = q.ToList();

        if (s.SortIntent.Column is { } col)
        {
            var dir = s.SortIntent.Direction == "desc" ? -1 : 1;
            rows.Sort((a, b) =>
            {
                var c = col switch
                {
                    "name"   => string.CompareOrdinal(a.Name, b.Name),
                    "status" => string.CompareOrdinal(a.Status, b.Status),
                    _        => 0
                };
                if (c == 0) c = string.CompareOrdinal(a.Id, b.Id);
                return c * dir;
            });
        }

        var total = rows.Count;
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)PageSize));
        var page = Math.Clamp(s.TablePage, 1, totalPages);
        var pageRows = rows.Skip((page - 1) * PageSize).Take(PageSize).ToList();
        return (pageRows, total, page);
    }

    private static SectionNode BuildTableSection(FeatureProbeState state)
    {
        var (pageRows, total, clampedPage) = Window(state);

        var rows = pageRows.Select(i => new TableRow(
            Cells: new Dictionary<string, string> { ["name"] = i.Name, ["status"] = i.Status },
            Id: i.Id)).ToList();

        var table = new TableNode(
            Columns:
            [
                new TableColumn("name", "Name", Sortable: true, Filterable: true,
                    FilterValue: state.TableFilters.Name.Length > 0 ? state.TableFilters.Name : null),
                new TableColumn("status", "Status", Sortable: true)
            ],
            Rows: rows,
            SortBind: "sortIntent",
            FilterBinds: new Dictionary<string, string> { ["name"] = "tableFilters.name" },
            PaginationBind: "tablePage",
            SortActions: new Dictionary<string, ActionDescriptor>
            {
                ["name"]   = new ActionDescriptor("table-sort-name"),
                ["status"] = new ActionDescriptor("table-sort-status"),
            },
            FilterAction: new ActionDescriptor("table-filter"),
            Pagination: new TablePagination(
                clampedPage, PageSize, total,
                PrevAction: new ActionDescriptor("table-page-prev"),
                NextAction: new ActionDescriptor("table-page-next")));

        return new SectionNode("Table matrix",
            new List<ViewNode> { table },
            Variant: "card");
    }
}
