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
    string DownloadFilename,
    // 1.3.0 — SectionNode.Action click-anywhere card exercised by the parity
    // fixture: select-card increments this counter, BuildVm renders a clickable
    // SectionNode that dispatches "select-card".
    int CardClickCount
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
        DownloadFilename: "",
        CardClickCount: 0
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
        else if (name == "select-card")
        {
            // 1.3.0 — SectionNode.Action click. Increment counter; BuildVm reflects it.
            state = state with { CardClickCount = state.CardClickCount + 1 };
        }
        else if (name == "boom")
        {
            // Deliberate uncaught throw — exercises the generic-Exception path through
            // ShellExceptionFilter. Used by the Plan 04 parity fixture to verify that
            // ALL backends return byte-identical {ok:false, errors:[{message:"deliberate
            // test failure", code:"uncaught_exception"}]} envelopes. Dev/parity use only;
            // this demo is never deployed to production (T-07-09 accept disposition).
            throw new Exception("deliberate test failure");
        }
        else
        {
            throw new UnknownActionException(name);
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
        // 1.3.0 — clickable SectionNode (parity coverage for SectionNode.Action).
        var clickableCardSection = new SectionNode(
            Heading: "Clickable Card",
            Children: new ViewNode[]
            {
                new TextNode(
                    $"Clicked {state.CardClickCount} time{(state.CardClickCount == 1 ? "" : "s")}",
                    "muted"),
            },
            Variant: "card",
            Action: new ActionDescriptor("select-card"));
        // 1.4.0 — linked SectionNode (parity coverage for SectionNode.Link, issue #21).
        // Pure client-side navigation — no state change, no dispatch arm needed;
        // the wire shape itself is the parity gate.
        var linkedCardSection = new SectionNode(
            Heading: "Linked card",
            Children: new ViewNode[]
            {
                new TextNode("Renders as <a href> for native link affordances.", "muted"),
            },
            Variant: "card",
            Link: new SectionLink("https://example.com/probe", External: true));
        // 1.11.0 — row layout (parity coverage for layout:"row"). A left-aligned
        // wrapping row of links — the horizontal-row primitive a navbar composes from.
        var rowSection = new SectionNode(
            Heading: "Row layout",
            Children: new ViewNode[]
            {
                new LinkNode("Home", "/home"),
                new LinkNode("Docs", "/docs"),
                new LinkNode("About", "/about"),
            },
            Variant: "card",
            Layout: "row");
        // 1.12.0 — arrange/align alignment vocabulary (parity coverage for
        // ALIGN-01/02/03). Static view-shape captured by every GET step (mirrors the
        // 1.11.0 row precedent; no dedicated action arm). Byte-identical to the bun
        // twin: same headings, link labels/hrefs, order, and arrange/align values.
        //
        // (a) bare row — NEITHER Arrange nor Align => proves omitted = no class.
        var bareRowSection = new SectionNode(
            Heading: "Bare row",
            Children: new ViewNode[]
            {
                new LinkNode("One", "/one"),
                new LinkNode("Two", "/two"),
            },
            Layout: "row");
        // (b) canonical header-bar (ALIGN-04): row + Arrange:"space-between", first
        // child a heading TextNode, then a nested row section of nav links.
        var headerBarSection = new SectionNode(
            Heading: null,
            Children: new ViewNode[]
            {
                new TextNode("Header", "heading"),
                new SectionNode(
                    Heading: null,
                    Children: new ViewNode[]
                    {
                        // 2.1.0 — LinkNode.Active parity coverage: the current
                        // nav item ("you are here"). Byte-identical to the bun twin.
                        new LinkNode("Home", "/home", Active: true),
                        new LinkNode("Docs", "/docs"),
                    },
                    Layout: "row"),
            },
            Layout: "row",
            Arrange: "space-between");
        // (c) one row per remaining arrange value (space-between covered above).
        var arrangeValues = new[] { "start", "center", "end", "space-around", "space-evenly" };
        var arrangeSections = arrangeValues.Select(v => new SectionNode(
            Heading: $"arrange {v}",
            Children: new ViewNode[]
            {
                new LinkNode("A", "/a"),
                new LinkNode("B", "/b"),
            },
            Layout: "row",
            Arrange: v)).ToList();
        // (d) one row per align value.
        var alignValues = new[] { "start", "center", "end", "stretch", "baseline" };
        var alignSections = alignValues.Select(v => new SectionNode(
            Heading: $"align {v}",
            Children: new ViewNode[]
            {
                new LinkNode("A", "/a"),
                new LinkNode("B", "/b"),
            },
            Layout: "row",
            Align: v)).ToList();
        // 1.13.0 — switcher vocabulary (parity coverage for SWITCH-01/02/03).
        // Static view-shape captured by every GET step (mirrors the 1.12.0
        // arrange/align precedent; no dedicated action arm). Byte-identical to the
        // bun twin: same headings, link labels/hrefs, order, and threshold/limit
        // values — omitted threshold/limit ABSENT on the wire, set ones present.
        //
        // (a) bare switcher — NEITHER Threshold nor Limit => proves omitted = no class.
        var bareSwitcherSection = new SectionNode(
            Heading: "Bare switcher",
            Children: new ViewNode[]
            {
                new LinkNode("One", "/one"),
                new LinkNode("Two", "/two"),
                new LinkNode("Three", "/three"),
            },
            Layout: "switcher");
        // (b) one switcher per threshold value (sm/md/lg/xl).
        var thresholdValues = new[] { "sm", "md", "lg", "xl" };
        var switcherThresholdSections = thresholdValues.Select(v => new SectionNode(
            Heading: $"switcher {v}",
            Children: new ViewNode[]
            {
                new LinkNode("A", "/a"),
                new LinkNode("B", "/b"),
                new LinkNode("C", "/c"),
            },
            Layout: "switcher",
            Threshold: v)).ToList();
        // (c) one switcher with Limit:4 and >4 children (6) — exercises the count cap.
        var switcherLimitSection = new SectionNode(
            Heading: "switcher limit",
            Children: new ViewNode[]
            {
                new LinkNode("1", "/1"),
                new LinkNode("2", "/2"),
                new LinkNode("3", "/3"),
                new LinkNode("4", "/4"),
                new LinkNode("5", "/5"),
                new LinkNode("6", "/6"),
            },
            Layout: "switcher",
            Limit: 4);
        // 1.13.0 — cards minItem vocabulary (parity coverage for GRID-01/02).
        // Static view-shape captured by every GET step (same precedent; no
        // dedicated action arm). Byte-identical to the bun twin: same headings,
        // link labels/hrefs, order, and minItem values — omitted minItem ABSENT
        // on the wire, set ones present. A dedicated SECTION-level bare-cards
        // section proves omitted = absent at the section level (the page root is
        // already Layout:"cards").
        //
        // (a) bare cards section — NO MinItem => proves omitted = no class.
        var bareCardsSection = new SectionNode(
            Heading: "Bare cards",
            Children: new ViewNode[]
            {
                new LinkNode("One", "/c1"),
                new LinkNode("Two", "/c2"),
                new LinkNode("Three", "/c3"),
            },
            Layout: "cards");
        // (b) one cards section per minItem value (xs/sm/md/lg/xl).
        var minItemValues = new[] { "xs", "sm", "md", "lg", "xl" };
        var cardsMinItemSections = minItemValues.Select(v => new SectionNode(
            Heading: $"cards minItem {v}",
            Children: new ViewNode[]
            {
                new LinkNode("P", "/p"),
                new LinkNode("Q", "/q"),
                new LinkNode("R", "/r"),
                new LinkNode("S", "/s"),
            },
            Layout: "cards",
            MinItem: v)).ToList();
        // 1.x (Phase 10) — fits node vocabulary (parity coverage for FITS-03).
        // Static view-shape captured by every GET step (same precedent; no
        // dedicated action arm). Byte-identical to the bun twin: same headings,
        // candidate layouts, link labels/hrefs, order, and axis presence — the
        // WIRE is {type:"fits", axis?, children}: omitted Axis ABSENT on the wire,
        // Axis:"both" present as the JSON string "both". The CLIENT-SIDE
        // measure-and-pick selection is browser-only and NOT part of parity.
        // Candidates ordered preferred/widest FIRST → fallback LAST.
        //
        // (a) fits with Axis OMITTED — proves omitted = absent on the wire.
        var fitsAxisOmittedSection = new SectionNode(
            Heading: "fits (axis omitted)",
            Children: new ViewNode[]
            {
                new FitsNode(Children: new ViewNode[]
                {
                    new SectionNode(Heading: null, Children: new ViewNode[]
                    {
                        new LinkNode("Wide A", "/wa"),
                        new LinkNode("Wide B", "/wb"),
                        new LinkNode("Wide C", "/wc"),
                    }, Layout: "row"),
                    new SectionNode(Heading: null, Children: new ViewNode[]
                    {
                        new LinkNode("Wide A", "/wa"),
                        new LinkNode("Wide B", "/wb"),
                        new LinkNode("Wide C", "/wc"),
                    }, Layout: "stack"),
                }),
            });
        // (b) fits with Axis:"both" — proves the axis field present on the wire.
        var fitsAxisBothSection = new SectionNode(
            Heading: "fits axis:both",
            Children: new ViewNode[]
            {
                new FitsNode(Children: new ViewNode[]
                {
                    new SectionNode(Heading: null, Children: new ViewNode[]
                    {
                        new LinkNode("X", "/x"),
                        new LinkNode("Y", "/y"),
                    }, Layout: "row"),
                    new SectionNode(Heading: null, Children: new ViewNode[]
                    {
                        new LinkNode("X", "/x"),
                        new LinkNode("Y", "/y"),
                    }, Layout: "stack"),
                }, Axis: "both"),
            });
        var pageChildren = new List<ViewNode>
        {
            probeSection, clickableCardSection, linkedCardSection, rowSection,
            bareRowSection, headerBarSection,
        };
        pageChildren.AddRange(arrangeSections);
        pageChildren.AddRange(alignSections);
        pageChildren.Add(bareSwitcherSection);
        pageChildren.AddRange(switcherThresholdSections);
        pageChildren.Add(switcherLimitSection);
        pageChildren.Add(bareCardsSection);
        pageChildren.AddRange(cardsMinItemSections);
        pageChildren.Add(fitsAxisOmittedSection);
        pageChildren.Add(fitsAxisBothSection);
        pageChildren.Add(BuildTableSection(state));
        return new PageNode("Feature Probe", pageChildren,
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
