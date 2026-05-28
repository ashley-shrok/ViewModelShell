namespace FeatureProbe.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ViewModelShell;

public record FeatureProbeState(
    int PollCount,
    string? LastUploadName,
    long LastUploadSize,
    string? LastSubmit = null,   // 0.10.0/#15: "{action}: {note}" from the multi-action form
    // 0.12.0/#16: table feature-matrix state — exercises selection × pagination
    // × sort × filter all at once. Defaults are chosen so the initial wire is
    // byte-identical to the bun twin: "" and [] serialize the same on both, and
    // the null sort fields drop out under parity normalization (null == absent).
    string? TableSortCol = null,
    string? TableSortDir = null,
    string TableFilter = "",
    int TablePage = 1,
    IReadOnlyList<string>? TableSelected = null
)
{
    public static FeatureProbeState Initial() => new(
        PollCount: 0,
        LastUploadName: null,
        LastUploadSize: 0,
        TableSelected: []   // explicit so the wire shows [] (not null) on first load
    );
}

// Synthetic rows for the table feature-matrix. Fixed + ASCII so the sort order
// is identical (ordinal) across the C# and TS backends.
public record TableItem(string Id, string Name, string Status);

[ApiController]
[Route("api/probe")]
public class FeatureProbeController : ControllerBase
{
    private const int PageSize = 3;

    // Seed in a fixed order. Selection is always materialized back into this
    // order (below), so the `tableSelected` array round-trips deterministically.
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
        return new(BuildVm(state), state);
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<FeatureProbeState>> Action()
    {
        var payload = ActionPayload<FeatureProbeState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        string? Str(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.String
                ? v.GetString() : null;
        bool Bool(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.True;
        int Int(string key, int dflt) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.Number
                ? v.GetInt32() : dflt;

        var state = payload.State;

        switch (payload.Name)
        {
            case "trigger-redirect":
                return ShellResponse<FeatureProbeState>.RedirectTo(Str("to") ?? "/default-redirect");

            case "set-storage":
                return new ShellResponse<FeatureProbeState>(BuildVm(state), state)
                    .WithEffect(ShellSideEffect.SetLocalStorage("probe-local", Str("local-value") ?? "default-local"))
                    .WithEffect(ShellSideEffect.SetSessionStorage("probe-session", Str("session-value") ?? "default-session"));

            case "trigger-download":
                return new ShellResponse<FeatureProbeState>(BuildVm(state), state)
                    .WithEffect(ShellSideEffect.Download(
                        Str("url")      ?? "/api/probe/file/hello.txt",
                        Str("filename") ?? "hello.txt"));

            case "do-poll":
                state = state with { PollCount = state.PollCount + 1 };
                var done = state.PollCount >= 3;
                return new ShellResponse<FeatureProbeState>(BuildVm(state), state)
                {
                    NextPollIn = done ? null : 100
                };

            case "upload":
                var file = Request.Form.Files.GetFile("attachment");
                if (file != null)
                {
                    state = state with
                    {
                        LastUploadName = file.FileName,
                        LastUploadSize = file.Length
                    };
                }
                break;

            case "show-copy-button":
                break;  // state unchanged; BuildVm always includes the copy-button node

            // 0.10.0/#15: two buttons[] on ONE form, sharing the "note" field.
            // Each harvests the live field value into its own action — proving
            // the input reaches the server via whichever button fires.
            case "save-draft":
                state = state with { LastSubmit = $"draft: {Str("note") ?? ""}" };
                break;
            case "publish":
                state = state with { LastSubmit = $"published: {Str("note") ?? ""}" };
                break;

            case "reset":
                state = FeatureProbeState.Initial();
                break;

            // ── table feature-matrix (0.12.0/#16) ──────────────────────────
            // sort/filter reset the page to 1 (the documented convention — the
            // row window shifts underneath the cursor otherwise).
            case "table-sort":
                state = state with { TableSortCol = Str("column"), TableSortDir = Str("direction"), TablePage = 1 };
                break;

            case "table-filter":
                state = state with { TableFilter = Str("value") ?? "", TablePage = 1 };
                break;

            case "table-page":
                state = state with { TablePage = Int("page", state.TablePage) };
                break;

            case "table-select":
            {
                var set = new HashSet<string>(state.TableSelected ?? []);
                if (Bool("all"))
                {
                    // Select-all spans the CURRENT PAGE only (the visible rows).
                    var pageIds = Window(state).Page.Select(i => i.Id);
                    if (Bool("checked")) foreach (var id in pageIds) set.Add(id);
                    else                 foreach (var id in pageIds) set.Remove(id);
                }
                else
                {
                    var id = Str("id");
                    if (id != null) { if (Bool("checked")) set.Add(id); else set.Remove(id); }
                }
                // Re-materialize in seed order so the array round-trips identically.
                state = state with { TableSelected = Items.Where(i => set.Contains(i.Id)).Select(i => i.Id).ToList() };
                break;
            }

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return new ShellResponse<FeatureProbeState>(BuildVm(state), state);
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
            Variant: "secondary"));   // 0.9.0/#14: read distinctly from neighboring default buttons

        // 0.11.0/#5: ImageNode — exercises src/alt/size/shape on the parity wire.
        children.Add(new ImageNode("/logo.png", Alt: "ViewModel Shell logo", Size: "small", Shape: "circle"));

        if (state.LastSubmit != null)
            children.Add(new TextNode($"Last submit: {state.LastSubmit}", "muted"));

        // 0.10.0/#15: one form, shared "note" field, two buttons each
        // dispatching a DIFFERENT action carrying the field's current value.
        children.Add(new FormNode(
            SubmitAction: null,   // buttons[]-only form — no default submit
            SubmitLabel: null,
            Children: [new FieldNode("note", "text", "Note", "Type a note…", null)],
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

    // Filter → sort → paginate. The SERVER slices; the adapter only renders the
    // page controls. Sort is ordinal with an id tiebreak (a total order, so no
    // sort-stability dependence) — that's what lets C# and TS agree row-for-row.
    private static (List<TableItem> Page, int Total, int ClampedPage) Window(FeatureProbeState s)
    {
        IEnumerable<TableItem> q = Items;
        if (!string.IsNullOrEmpty(s.TableFilter))
            q = q.Where(i => i.Name.Contains(s.TableFilter, StringComparison.OrdinalIgnoreCase));
        var rows = q.ToList();

        if (s.TableSortCol is { } col)
        {
            var dir = s.TableSortDir == "desc" ? -1 : 1;
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
        var selected = state.TableSelected ?? [];

        var rows = pageRows.Select(i => new TableRow(
            Cells: new Dictionary<string, string> { ["name"] = i.Name, ["status"] = i.Status },
            Id: i.Id)).ToList();

        var table = new TableNode(
            Columns:
            [
                new TableColumn("name", "Name", Sortable: true, Filterable: true,
                    FilterValue: state.TableFilter.Length > 0 ? state.TableFilter : null),
                new TableColumn("status", "Status", Sortable: true)
            ],
            Rows: rows,
            SortColumn: state.TableSortCol,
            SortDirection: state.TableSortDir,
            SortAction: new ActionDescriptor("table-sort"),
            FilterAction: new ActionDescriptor("table-filter"),
            Selection: new TableSelection(selected, new ActionDescriptor("table-select")),
            Pagination: new TablePagination(clampedPage, PageSize, total, new ActionDescriptor("table-page")));

        return new SectionNode("Table matrix",
            new List<ViewNode>
            {
                new TextNode($"{selected.Count} selected", "muted"),
                table
            },
            Variant: "card");
    }
}
