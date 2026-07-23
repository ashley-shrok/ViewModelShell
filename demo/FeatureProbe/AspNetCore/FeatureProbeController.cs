namespace FeatureProbe.Controllers;

using System.Text.Json;
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
    int CardClickCount,
    // 5.2.0 (LOOK-06) — lookup bind slots. `lookup` binds ONE id (a string);
    // `lookup-multiple` binds a string[] of ids. LookupQuery is the SearchBind
    // slot (the typed query, round-tripped so the view stays a pure function of
    // state). Seeded byte-identically to the bun/node twin — a divergent seed
    // fails the diff for a reason that has nothing to do with the wire.
    string LookupOwner,
    string LookupTag,
    IReadOnlyList<string> LookupWatchers,
    string LookupQuery
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
        CardClickCount: 0,
        LookupOwner: "u-1",
        LookupTag: "urgent",
        LookupWatchers: ["u-2", "t-7"],
        LookupQuery: ""
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

        if (name == "trigger-toast")
        {
            // Two toast side-effects: a BARE toast (message only => Tone/DurationMs
            // omitted = absent on the wire) and a FULL one (Tone + DurationMs).
            // Byte-identical to the bun twin so parity diffs both shapes.
            return new ShellResponse<FeatureProbeState>(BuildVm(state), state)
                .WithEffect(ShellSideEffect.Toast("Saved"))
                .WithEffect(ShellSideEffect.Toast("Heads up", tone: "warning", durationMs: 5000))
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
        else if (name == "table-page-jump")
        {
            // Renderer wrote the clamped target page to state.TablePage before dispatch.
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
        else if (name == "make-invalid-tree")
        {
            // 3.3.0 (F4) — return a tree with a DUPLICATE action name (two
            // top-level buttons, NOT in a form) so .Validate() (ValidateActionNames)
            // throws → {ok:false, errors:[{message, code:"invalid_tree"}]} at 500.
            // Parity-covers the invalid_tree wire shape across all backends.
            var invalidTree = new PageNode(
                Title: null,
                Children: new ViewNode[]
                {
                    new ButtonNode("A", new ActionDescriptor("dup")),
                    new ButtonNode("B", new ActionDescriptor("dup")),
                });
            return new ShellResponse<FeatureProbeState>(invalidTree, state).Validate();
        }
        else
        {
            throw new UnknownActionException(name);
        }

        return new ShellResponse<FeatureProbeState>(BuildVm(state), state).Validate();
    }

    /// <summary>
    /// The wire spelling of an enum value, derived from the SAME naming policy
    /// KebabEnum&lt;T&gt; serializes with — so a probe heading can never drift from
    /// the value it labels (the bun twin interpolates the raw wire string, and
    /// parity diffs the heading byte-for-byte).
    /// </summary>
    private static string WireName(Enum v) =>
        JsonNamingPolicy.KebabCaseLower.ConvertName(v.ToString());

    private static ViewNode BuildVm(FeatureProbeState state)
    {
        var children = new List<ViewNode>
        {
            new TextNode($"Poll count: {state.PollCount}", TextStyle.Muted),
        };
        if (state.LastUploadName != null)
            children.Add(new TextNode($"Last upload: {state.LastUploadName} ({state.LastUploadSize} bytes)", TextStyle.Muted));

        children.Add(new CopyButtonNode(
            "npx @ashley-shrok/viewmodel-shell",
            "Copy install command",
            "Copied!",
            Emphasis: Emphasis.Secondary,
            // Rich copy — server-provided route: a formatted representation written
            // as text/html alongside the plain Text. Parity coverage for Html.
            Html: "<code>npx @ashley-shrok/viewmodel-shell</code>"));

        children.Add(new ImageNode("/logo.png", Alt: "ViewModel Shell logo", Size: ImageSize.Small, Shape: ImageShape.Circle));
        // 6.10.0 — ImageNode.Caption + CaptionRuns parity coverage. Static view-
        // shape captured by every GET step, so the byte-diff covers the two new
        // optional fields (WhenWritingNull ⇒ omitted absent on the wire) across
        // all backends. First: plain caption (proves the string crosses). Second:
        // captionRuns present (proves the InlineRun[] alongside caption crosses).
        children.Add(new ImageNode(
            "/logo.png",
            Alt: "ViewModel Shell logo",
            Size: ImageSize.Medium,
            Caption: "Figure 1: the framework logo"));
        children.Add(new ImageNode(
            "/logo.png",
            Alt: "ViewModel Shell logo",
            Size: ImageSize.Medium,
            Caption: "See the docs",
            CaptionRuns: new List<InlineRun>
            {
                new InlineRun("See "),
                new InlineRun("the docs", Href: "https://example.com/docs", External: true),
            }));

        // 6.10.0 — TextNode.Level parity coverage. Static view-shape captured
        // by every GET step: one TextNode per level 1..6 (proves the integer
        // serializes as a JSON number 1..6 on both backends), plus a level-2
        // combined with tone (proves Level composes with Tone). Level is
        // positional slot 5 (after Runs) — pass by NAME per the record's
        // "Runs is slot 4, appended last" convention.
        children.Add(new TextNode("H1 level", Level: 1));
        children.Add(new TextNode("H2 level", Level: 2));
        children.Add(new TextNode("H3 level", Level: 3));
        children.Add(new TextNode("H4 level", Level: 4));
        children.Add(new TextNode("H5 level", Level: 5));
        children.Add(new TextNode("H6 level", Level: 6));
        children.Add(new TextNode("H2 danger heading", Tone: Tone.Danger, Level: 2));

        if (state.LastSubmit != null)
            children.Add(new TextNode($"Last submit: {state.LastSubmit}", TextStyle.Muted));

        children.Add(new ButtonNode("Start long action",
            new ActionDescriptor("start-long-action"), Emphasis: Emphasis.Primary));
        if (state.LongActionPolls > 0)
            children.Add(new TextNode(
                $"Long action in progress · {state.LongActionPolls} tick{(state.LongActionPolls == 1 ? "" : "s")} remaining",
                TextStyle.Muted));

        // Multi-action form: shared "note" field bound to state.Note; two
        // buttons, each dispatching a unique-named action.
        children.Add(new FormNode(
            SubmitAction: null,
            SubmitLabel: null,
            Children: [new FieldNode("note", "text", "note", "Note", "Type a note…")],
            Buttons:
            [
                new ButtonNode("Save Draft", new ActionDescriptor("save-draft"), Emphasis: Emphasis.Secondary),
                new ButtonNode("Publish",    new ActionDescriptor("publish"),    Emphasis.Primary)
            ]));

        var probeSection = new SectionNode("Probe", children, Variant: SectionVariant.Card, Layout: Layout.Split);
        // 1.3.0 — clickable SectionNode (parity coverage for SectionNode.Action).
        var clickableCardSection = new SectionNode(
            Heading: "Clickable Card",
            Children: new ViewNode[]
            {
                new TextNode(
                    $"Clicked {state.CardClickCount} time{(state.CardClickCount == 1 ? "" : "s")}",
                    TextStyle.Muted),
            },
            Variant: SectionVariant.Card,
            Action: new ActionDescriptor("select-card"));
        // 1.4.0 — linked SectionNode (parity coverage for SectionNode.Link, issue #21).
        // Pure client-side navigation — no state change, no dispatch arm needed;
        // the wire shape itself is the parity gate.
        var linkedCardSection = new SectionNode(
            Heading: "Linked card",
            Children: new ViewNode[]
            {
                new TextNode("Renders as <a href> for native link affordances.", TextStyle.Muted),
            },
            Variant: SectionVariant.Card,
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
            Variant: SectionVariant.Card,
            Layout: Layout.Row);
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
            Layout: Layout.Row);
        // (b) canonical header-bar (ALIGN-04): row + Arrange:"space-between", first
        // child a heading TextNode, then a nested row section of nav links.
        var headerBarSection = new SectionNode(
            Heading: null,
            Children: new ViewNode[]
            {
                new TextNode("Header", TextStyle.Heading),
                new SectionNode(
                    Heading: null,
                    Children: new ViewNode[]
                    {
                        // 2.1.0 — LinkNode.Active parity coverage: the current
                        // nav item ("you are here"). Byte-identical to the bun twin.
                        new LinkNode("Home", "/home", Active: true),
                        new LinkNode("Docs", "/docs"),
                    },
                    Layout: Layout.Row),
            },
            Layout: Layout.Row,
            Arrange: Arrange.SpaceBetween);
        // (c) one row per remaining arrange value (space-between covered above).
        var arrangeValues = new[] { Arrange.Start, Arrange.Center, Arrange.End, Arrange.SpaceAround, Arrange.SpaceEvenly };
        var arrangeSections = arrangeValues.Select(v => new SectionNode(
            Heading: $"arrange {WireName(v)}",
            Children: new ViewNode[]
            {
                new LinkNode("A", "/a"),
                new LinkNode("B", "/b"),
            },
            Layout: Layout.Row,
            Arrange: v)).ToList();
        // (d) one row per align value.
        var alignValues = new[] { Align.Start, Align.Center, Align.End, Align.Stretch, Align.Baseline };
        var alignSections = alignValues.Select(v => new SectionNode(
            Heading: $"align {WireName(v)}",
            Children: new ViewNode[]
            {
                new LinkNode("A", "/a"),
                new LinkNode("B", "/b"),
            },
            Layout: Layout.Row,
            Align: v)).ToList();
        // npm 1.12.0 — switcher vocabulary (parity coverage for SWITCH-01/02/03).
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
            Layout: Layout.Switcher);
        // (b) one switcher per threshold value (sm/md/lg/xl).
        var thresholdValues = new[] { Threshold.Sm, Threshold.Md, Threshold.Lg, Threshold.Xl };
        var switcherThresholdSections = thresholdValues.Select(v => new SectionNode(
            Heading: $"switcher {WireName(v)}",
            Children: new ViewNode[]
            {
                new LinkNode("A", "/a"),
                new LinkNode("B", "/b"),
                new LinkNode("C", "/c"),
            },
            Layout: Layout.Switcher,
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
            Layout: Layout.Switcher,
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
            Layout: Layout.Cards);
        // (b) one cards section per minItem value (xs/sm/md/lg/xl).
        var minItemValues = new[] { MinItem.Xs, MinItem.Sm, MinItem.Md, MinItem.Lg, MinItem.Xl };
        var cardsMinItemSections = minItemValues.Select(v => new SectionNode(
            Heading: $"cards minItem {WireName(v)}",
            Children: new ViewNode[]
            {
                new LinkNode("P", "/p"),
                new LinkNode("Q", "/q"),
                new LinkNode("R", "/r"),
                new LinkNode("S", "/s"),
            },
            Layout: Layout.Cards,
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
                    }, Layout: Layout.Row),
                    new SectionNode(Heading: null, Children: new ViewNode[]
                    {
                        new LinkNode("Wide A", "/wa"),
                        new LinkNode("Wide B", "/wb"),
                        new LinkNode("Wide C", "/wc"),
                    }, Layout: Layout.Stack),
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
                    }, Layout: Layout.Row),
                    new SectionNode(Heading: null, Children: new ViewNode[]
                    {
                        new LinkNode("X", "/x"),
                        new LinkNode("Y", "/y"),
                    }, Layout: Layout.Stack),
                }, Axis: Axis.Both),
            });
        // 12.x (Phase 12) — chart node vocabulary (parity coverage for CHART-05).
        // Reshaped Phase 18 (CHARTBASE-04) — multi-series + tone + stacked, over
        // WHOLE-NUMBER data so double/number serialize byte-identically (12 not
        // 12.0). First ChartNode: `kind` OMITTED (proves omitted = absent, default
        // "bar"); two series sharing `labels` — "Visits" carries no tone
        // (framework-assigned palette slot), "Errors" carries tone:"danger"
        // (semantic override); stacked:true. Second ChartNode: `kind:"line"` set
        // explicitly (proves the literal string crosses the wire), single series,
        // kind/stacked/title all otherwise omitted. Client-side Chart.js pixels are
        // NOT parity-tested; parity proves only identical serialization.
        // Byte-identical to the bun twin (handler.ts).
        var chartSection = new SectionNode(
            Heading: "chart (bar)",
            Children: new ViewNode[]
            {
                new ChartNode(
                    Labels: new[] { "Mon", "Tue", "Wed" },
                    Series: new[]
                    {
                        new ChartSeries("Visits", new double[] { 12, 19, 7 }),
                        new ChartSeries("Errors", new double[] { 1, 3, 2 }, Tone: Tone.Danger),
                    },
                    Stacked: true,
                    Title: "Weekly visits"),
                new ChartNode(
                    Labels: new[] { "Mon", "Tue", "Wed" },
                    Series: new[]
                    {
                        new ChartSeries("Trend", new double[] { 5, 10, 15 }),
                    },
                    Kind: ChartKind.Line),
            });
        // 3.0.0 — appearance axes (parity coverage for the unified vocabulary:
        // button emphasis × tone × size, section tone, text tone, list-item/row
        // state + tone). Static view-shape captured by the existing GET steps;
        // byte-identical to the bun twin (demo/FeatureProbe-bun/handler.ts).
        var axesSection = new SectionNode(
            Heading: "Appearance axes",
            Children: new ViewNode[]
            {
                new ButtonNode("E-primary",   new ActionDescriptor("axes-noop-1"), Emphasis: Emphasis.Primary),
                new ButtonNode("E-secondary", new ActionDescriptor("axes-noop-2"), Emphasis: Emphasis.Secondary),
                new ButtonNode("T-danger",    new ActionDescriptor("axes-noop-3"), Tone: Tone.Danger),
                new ButtonNode("T-warning",   new ActionDescriptor("axes-noop-4"), Tone: Tone.Warning),
                new ButtonNode("T-success",   new ActionDescriptor("axes-noop-5"), Tone: Tone.Success),
                new ButtonNode("T-info",      new ActionDescriptor("axes-noop-6"), Tone: Tone.Info),
                new ButtonNode("S-sm",        new ActionDescriptor("axes-noop-7"), Size: ControlSize.Sm),
                new ButtonNode("S-lg",        new ActionDescriptor("axes-noop-8"), Size: ControlSize.Lg),
                new ButtonNode("combo",       new ActionDescriptor("axes-noop-9"), Emphasis: Emphasis.Primary, Tone: Tone.Danger, Size: ControlSize.Lg),
                // Destructive-action guard: Confirm carries a native-confirm question.
                new ButtonNode("confirm-guard", new ActionDescriptor("axes-noop-confirm"), Tone: Tone.Danger, Confirm: "Delete this? This cannot be undone."),
                // Rich copy — harvest route: copies the rendered "Warning card" region
                // below (which carries the matching DOM id). Parity coverage for CopyTargetId.
                new CopyButtonNode("axes-clip", Label: "Copy", Emphasis: Emphasis.Secondary, Tone: Tone.Info, Size: ControlSize.Sm, CopyTargetId: "axes-warning-card"),
                new TextNode("tone text", Tone: Tone.Warning),
                new TextNode("heading + tone", TextStyle.Heading, Tone.Danger),
                new SectionNode("Warning card", new ViewNode[] { new TextNode("tinted card surface", null) }, Variant: SectionVariant.Card, Tone: Tone.Warning, Id: "axes-warning-card"),
                new SectionNode("Danger band", new ViewNode[] { new TextNode("bare tinted section", null) }, Tone: Tone.Danger),
                new ListNode(new ViewNode[]
                {
                    new ListItemNode("axes-li-1", "active", new ViewNode[] { new TextNode("active state", null) }),
                    new ListItemNode("axes-li-2", null,     new ViewNode[] { new TextNode("danger tone", null) }, Tone: Tone.Danger),
                    new ListItemNode("axes-li-3", "done",   new ViewNode[] { new TextNode("done + success", null) }, Tone: Tone.Success),
                }),
                // ListNode.ordered — an <ol> probe (Ordered:true crosses the wire);
                // the unordered list above OMITS ordered (proving absent = <ul>).
                new ListNode(new ViewNode[]
                {
                    new ListItemNode("axes-oli-1", null, new ViewNode[] { new TextNode("ordered one", null) }),
                    new ListItemNode("axes-oli-2", null, new ViewNode[] { new TextNode("ordered two", null) }),
                }, Ordered: true),
                new TableNode(
                    new TableColumn[] { new TableColumn("k", "K") },
                    new TableRow[]
                    {
                        new TableRow(new Dictionary<string, string> { ["k"] = "running" }, State: "running"),
                        new TableRow(new Dictionary<string, string> { ["k"] = "danger" }, Tone: Tone.Danger),
                        new TableRow(new Dictionary<string, string> { ["k"] = "done+warn" }, State: "done", Tone: Tone.Warning),
                    }),
            },
            Variant: SectionVariant.Card);
        // 3.1.0 (#22) — button width, divider, form submitButton. Static view-shape
        // captured by the GET steps; byte-identical to the bun twin.
        var admin22Section = new SectionNode(
            Heading: "Admin primitives (#22)",
            Children: new ViewNode[]
            {
                new ButtonNode("Full width", new ActionDescriptor("axes-noop-10"), Emphasis: Emphasis.Primary, Width: ControlWidth.Full),
                new DividerNode(),
                new DividerNode(Orientation: Orientation.Vertical),
                new FormNode(
                    SubmitAction: null,
                    SubmitLabel: null,
                    Children: new ViewNode[]
                    {
                        new FieldNode("q", "text", "axesQuery", "Query", null),
                    },
                    SubmitButton: new ButtonNode("Search", new ActionDescriptor("axes-search"), Emphasis: Emphasis.Primary, Width: ControlWidth.Full)),
            },
            Variant: SectionVariant.Card);
        // 3.2.0 — child-side modifiers alignSelf + maxWidth on SectionNode (parity
        // for CHILD-01/02/03). Byte-identical to the bun/node twin (handler.ts
        // childModifiersSection). Omitted alignSelf/maxWidth ABSENT on the wire, set
        // ones present; the last two children are the chat-bubble composition.
        var childModifiersSection = new SectionNode(
            Heading: "Child modifiers (alignSelf + maxWidth)",
            Children: new ViewNode[]
            {
                new SectionNode(Heading: null, Children: new ViewNode[] { new TextNode("bare (omitted)", null) }, Variant: SectionVariant.Card),
                new SectionNode(Heading: null, Children: new ViewNode[] { new TextNode("alignSelf start", null) },  Variant: SectionVariant.Card, AlignSelf: AlignSelf.Start),
                new SectionNode(Heading: null, Children: new ViewNode[] { new TextNode("alignSelf center", null) }, Variant: SectionVariant.Card, AlignSelf: AlignSelf.Center),
                new SectionNode(Heading: null, Children: new ViewNode[] { new TextNode("alignSelf end", null) },    Variant: SectionVariant.Card, AlignSelf: AlignSelf.End),
                new SectionNode(Heading: null, Children: new ViewNode[] { new TextNode("maxWidth half", null) },           Variant: SectionVariant.Card, MaxWidth: MaxWidth.Half),
                new SectionNode(Heading: null, Children: new ViewNode[] { new TextNode("maxWidth two-thirds", null) },     Variant: SectionVariant.Card, MaxWidth: MaxWidth.TwoThirds),
                new SectionNode(Heading: null, Children: new ViewNode[] { new TextNode("maxWidth three-quarters", null) }, Variant: SectionVariant.Card, MaxWidth: MaxWidth.ThreeQuarters),
                new SectionNode(Heading: null, Children: new ViewNode[] { new TextNode("maxWidth prose", null) },          Variant: SectionVariant.Card, MaxWidth: MaxWidth.Prose),
                new SectionNode(Heading: null, Children: new ViewNode[] { new TextNode("Hi there!", null) },          Variant: SectionVariant.Card, AlignSelf: AlignSelf.Start, MaxWidth: MaxWidth.ThreeQuarters),
                new SectionNode(Heading: null, Children: new ViewNode[] { new TextNode("Doing great, thanks!", null) }, Variant: SectionVariant.Card, AlignSelf: AlignSelf.End, MaxWidth: MaxWidth.ThreeQuarters, Tone: Tone.Info),
            });
        var pageChildren = new List<ViewNode>
        {
            probeSection, clickableCardSection, linkedCardSection, rowSection,
            bareRowSection, headerBarSection, axesSection, admin22Section,
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
        pageChildren.Add(chartSection);
        pageChildren.Add(childModifiersSection);
        pageChildren.Add(BuildTableSection(state));
        // 3.4.0 — forms-completeness parity coverage: FieldNode error/help/
        // disabled/readonly/min/max/step/maxLength + ButtonNode.disabled. Static
        // so every GET byte-diffs the new wire fields across all backends.
        pageChildren.Add(new SectionNode(
            Heading: "Forms completeness",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                new FieldNode("fc-email", "email", "note", "Email", null,
                    Required: true, Help: "We never share it.", Error: "That email is already taken."),
                new FieldNode("fc-qty", "number", "note", "Quantity", null,
                    Min: "0", Max: "10", Step: "0.5"),
                new FieldNode("fc-code", "text", "note", "Code", "max 8 chars",
                    MaxLength: 8),
                new FieldNode("fc-locked", "text", "note", "Account ID", null,
                    Readonly: true),
                new FieldNode("fc-region", "text", "note", "Region", null,
                    Disabled: true),
                new ButtonNode("Submit (disabled)", new ActionDescriptor("fc-submit"),
                    Emphasis: Emphasis.Primary, Disabled: true),
            }));
        // 3.9.0 — FieldNode.Bind optional (file inputs). A file field with
        // Bind: null: its binary rides the multipart side channel (fileRegistry
        // keyed on Name), so bind is absent (WhenWritingNull). Static view-shape
        // so every GET byte-diffs the NO-`bind`-key wire against the bun twin.
        pageChildren.Add(new SectionNode(
            Heading: "File field (optional bind)",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                new FieldNode("upload-nobind", "file", null, "Attachment (no bind)", null),
                // File field declaring UploadOn — the binary rides only the named
                // action. Byte-diffs the uploadOn wire array against the bun twin.
                new FieldNode("upload-routed", "file", null, "Attachment (routed)", null, UploadOn: new[] { "probe-submit" }),
            }));
        // 3.3.0 (F3) — a STATIC ModalNode on every GET so the parity suite
        // byte-diffs the full modal wire shape (Title/Children/Footer/
        // DismissAction/Size) across all backends. Previously ModalNode appeared
        // only in ExpenseTracker gated behind state.Adding, which no fixture
        // opened, so the modal wire shape had zero cross-backend coverage.
        // Feedback primitives — BadgeNode + EmptyStateNode (static view-shape;
        // byte-identical to the bun twin feedbackSection). A bare badge (NEITHER
        // Tone nor Emphasis => omitted = absent on the wire), a tone-only badge, a
        // tone+emphasis badge; a bare empty-state (no Message/Action => omitted =
        // absent), and an empty-state with Message + a CTA ButtonNode (proves the
        // action serializes with the "type":"button" discriminator AND the
        // action-name walk descends into EmptyStateNode.Action — unique name
        // feedback-cta).
        pageChildren.Add(new SectionNode(
            Heading: "Feedback primitives",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                new BadgeNode("New"),
                new BadgeNode("3", Tone: Tone.Danger),
                new BadgeNode("Beta", Tone: Tone.Info, Emphasis: Emphasis.Secondary),
                new EmptyStateNode("No items yet"),
                new EmptyStateNode(
                    "Nothing here",
                    Message: "Add the first item.",
                    Action: new ButtonNode("Add item", new ActionDescriptor("feedback-cta"), Emphasis: Emphasis.Primary)),
            }));
        // Fill axis (SectionNode.Fill) — one representative section carrying
        // Fill:true so the parity diff covers the new SectionNode wire field.
        // Byte-identical to the bun twin (handler.ts fillSection). NOTE the probe
        // root page deliberately does NOT set Fill (it must stay a natural-scroll
        // inventory page); PageNode.Fill is covered by the serialization tests
        // instead.
        pageChildren.Add(new SectionNode(
            Heading: "Fill section",
            Variant: SectionVariant.Card,
            Fill: true,
            Children: new ViewNode[]
            {
                new TextNode("This section claims leftover height and scrolls internally inside a fill page.", null),
                new TextNode("Outside a fill page the modifier class is an inert no-op.", null),
            }));
        // Follow-tail axis (SectionNode.FollowTail) — one representative section
        // carrying FollowTail:true so the parity diff covers the new SectionNode
        // wire field. Byte-identical to the bun twin (handler.ts followTailSection).
        // Append-only feed scroll behavior is client-side (BrowserAdapter); on
        // the wire it's just the boolean, and false stays ABSENT (F2).
        pageChildren.Add(new SectionNode(
            Heading: "Follow-tail feed",
            Variant: SectionVariant.Card,
            Fill: true,
            FollowTail: true,
            Children: new ViewNode[]
            {
                new TextNode("An append-only feed (chat transcript, log tail, activity stream) that keeps its newest content in view unless the user scrolls up.", null),
            }));
        // Phase 14 (NBA-04) — non-blocking dispatch, the Blocking field on
        // ActionDescriptor. Static view-shape captured by the existing GET
        // step, no new POST step: a button whose action OMITS Blocking
        // (proves the default stays absent on the wire) and a button whose
        // action sets Blocking:false (proves it serializes as the literal
        // JSON boolean false). Neither "nba-blocking-default" nor
        // "nba-non-blocking" is ever POSTed by any fixture step — same
        // convention as the "axes-noop-*" buttons elsewhere in this file,
        // which exist purely as static wire-shape proof. The CLIENT-SIDE
        // coalescing (NBA-02) / out-of-order-discard (NBA-03) behavior this
        // field enables is NOT parity-tested (pure client-only mechanics —
        // no wire epoch, no server-side reconciliation state, per
        // .planning/design/non-blocking-actions.md); that is covered instead
        // by viewmodel-shell/test/nonblocking-dispatch.test.ts and
        // blocking-propagation.test.ts (Plan 14-01). Byte-identical to the
        // bun twin (handler.ts blockingSection).
        var blockingSection = new SectionNode(
            Heading: "Non-blocking actions (blocking field)",
            Children: new ViewNode[]
            {
                new ButtonNode("Blocking (default)", new ActionDescriptor("nba-blocking-default")),
                new ButtonNode("Non-blocking", new ActionDescriptor("nba-non-blocking", Blocking: false)),
            });
        pageChildren.Add(blockingSection);
        // Navigation primitives (NAV-01/NAV-02) — BreadcrumbNode + StepsNode as
        // static view-shape captured by every GET step; byte-identical to the bun
        // twin navSection. The breadcrumb exercises the full omitted-vs-present
        // crumb matrix: an Href-only crumb (External OMITTED => absent on the
        // wire via WhenWritingDefault), an External:true crumb (present as the
        // literal boolean), an action crumb whose UNIQUE name nav-crumb-probe
        // proves the Collect action-name uniqueness walk DESCENDS into breadcrumb
        // items (never POSTed by any step — pure static wire-shape proof, same
        // convention as the axes-noop-* / nba-* buttons), and a final label-only
        // crumb (no Href/Action) that the framework auto-renders as the current
        // page. The steps exercise both orientations: the first OMITS Orientation
        // (proves absent = default horizontal) and mixes a description-bearing
        // step with two bare ones (Description omitted => absent); the second sets
        // Orientation:"vertical" (proves the literal string crosses). Both carry a
        // mid Current:1 (0 is meaningful, so Current always crosses). The
        // CLIENT-SIDE appearance/a11y is browser-only and NOT part of parity.
        pageChildren.Add(new SectionNode(
            Heading: "Navigation primitives",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                new BreadcrumbNode(new BreadcrumbItem[]
                {
                    new BreadcrumbItem("Home", Href: "/"),
                    new BreadcrumbItem("Docs", Href: "https://example.com/docs", External: true),
                    new BreadcrumbItem("Reports", Action: new ActionDescriptor("nav-crumb-probe")),
                    new BreadcrumbItem("Q3 Summary"),
                }),
                new StepsNode(new StepItem[]
                {
                    new StepItem("Cart", Description: "Review items"),
                    new StepItem("Shipping"),
                    new StepItem("Payment"),
                }, Current: 1),
                new StepsNode(new StepItem[]
                {
                    new StepItem("Draft", Description: "Compose the post"),
                    // Per-step tone (StepItem.tone) — overlays status on the derived state.
                    new StepItem("Review", Tone: Tone.Danger),
                    new StepItem("Publish", Tone: Tone.Warning),
                }, Current: 1, Orientation: Orientation.Vertical),
                // Stat bar (STAT-01) — Value is a STRING on both backends (a bare
                // number would drift: JSON `12` in TS vs `"12"` here). Includes a
                // toned tile so StatItem.Tone rides the parity diff.
                new StatBarNode(new StatItem[]
                {
                    new StatItem("active", "12"),
                    new StatItem("failing", "3", Tone: Tone.Danger),
                }),
            }));
        // Lookup field (LOOK-01/LOOK-06) — the two lookup inputTypes as static
        // view-shape captured by every GET step; byte-identical to the bun twin
        // lookupSection. Covers the full omitted-vs-present matrix:
        //   lookup-owner  — 🚨 THE HEADLINE: Selected PRESENT while Candidates is
        //                   ABSENT. This is the preselected-value/cold-start case
        //                   that kills naive designs — the label renders because
        //                   it came from the NODE, never resolved out of an
        //                   (empty) candidate list. AllowCustom is OMITTED, so
        //                   WhenWritingDefault drops it and the wire carries NO
        //                   "allowCustom" key (absent, not false — matching the
        //                   TS optional bool). Its selected entry carries both
        //                   Label and Type (the polymorphic-ref tag crosses).
        //   lookup-tag    — AllowCustom:true (proves the literal JSON boolean
        //                   crosses) with Candidates present, and a selected
        //                   entry whose Label is OMITTED because it equals Value
        //                   — the free-form-tag case, and Type omitted for a
        //                   monomorphic ref.
        //   lookup-watchers — lookup-multiple with TWO selected entries and a
        //                   Bind pointing at a string[] in state; carries
        //                   SearchBind plus a SearchAction whose UNIQUE name
        //                   lookup-search-probe proves the Collect action-name
        //                   uniqueness walk DESCENDS into FieldNode.SearchAction
        //                   (never POSTed by any step — pure static wire-shape
        //                   proof, same convention as the axes-noop-* / nba-* /
        //                   nav-crumb-probe names).
        // The CLIENT-SIDE debounce, popup/listbox, chips, live-region
        // announcements, and the non-blocking lane's coalescing/epoch behavior
        // are browser-only and NOT part of parity — parity proves only that the
        // lookup wire serializes identically across backends.
        // Tracker (TrackerNode) — status/heat strip as static view-shape, byte-identical
        // to the bun twin trackerSection. Omitted-vs-present matrix: a cell with State
        // OMITTED (absent = muted default on the wire), one cell per state, a labeled
        // cell, and a cell whose Action name tracker-cell-probe is UNIQUE — proving the
        // Collect action-name walk DESCENDS into TrackerCell.Action (never POSTed). The
        // client-side appearance/palette/a11y is browser-only and NOT part of parity.
        pageChildren.Add(new SectionNode(
            Heading: "Status tracker",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                new TrackerNode(new TrackerCell[]
                {
                    new TrackerCell(),                                  // State omitted => muted default
                    new TrackerCell(TrackerState.Success),
                    new TrackerCell(TrackerState.Danger),
                    new TrackerCell(TrackerState.Warning),
                    new TrackerCell(TrackerState.Muted),
                    new TrackerCell(TrackerState.Success, Label: "2026-07-15 14:02 UTC · Success"),
                    new TrackerCell(TrackerState.Danger, Label: "Failed",
                        Action: new ActionDescriptor("tracker-cell-probe")),
                }, Id: "probe-tracker"),
            }));
        // Diff (DiffNode) — aligned before/after primitive as static view-shape,
        // byte-identical to the bun twin diffSection. Covers the omitted-vs-present
        // wire matrix: Mode OMITTED (absent = side-by-side default), Header OMITTED,
        // Id OMITTED on the bare diff; a second diff sets Mode:"unified" and Header
        // present + Id:"probe-diff-unified" so both fields cross the wire. Rows cover
        // every kind the SHAPE-carries-meaning contract expresses: context (both
        // sides present, identical text with lineNumber), pure remove (New:null =>
        // ABSENT on the wire, NOT null — the whole point of gotcha #8), pure add
        // (Old:null => absent), modified pair (both non-null with different text),
        // and a prose row with NO LineNumber (LineNumber:null => absent on the wire).
        // DiffNode is action-free (Collect falls through the same way as ChartNode /
        // StepsNode); nothing to prove for uniqueness descent. The client-side
        // appearance (Grid alignment, tint+stripe, unified linenum-collapse) is
        // browser-only and NOT part of parity.
        pageChildren.Add(new SectionNode(
            Heading: "Diff",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                // Bare diff — mode/header/id ALL omitted.
                new DiffNode(new DiffRow[]
                {
                    new DiffRow(Old: new DiffCell("context line", LineNumber: 1),
                                New: new DiffCell("context line", LineNumber: 1)),
                    new DiffRow(Old: new DiffCell("removed", LineNumber: 2), New: null),
                    new DiffRow(Old: null, New: new DiffCell("added", LineNumber: 2)),
                    new DiffRow(Old: new DiffCell("before", LineNumber: 3),
                                New: new DiffCell("after", LineNumber: 3)),
                    // Prose row — no line numbers on either side (LineNumber omitted).
                    new DiffRow(Old: new DiffCell("Prose paragraph, version A."),
                                New: new DiffCell("Prose paragraph, version B.")),
                }),
                // Unified with header — mode + header + id ALL present.
                new DiffNode(
                    Rows: new DiffRow[]
                    {
                        new DiffRow(Old: new DiffCell("same", LineNumber: 1),
                                    New: new DiffCell("same", LineNumber: 1)),
                        new DiffRow(Old: new DiffCell("gone", LineNumber: 2), New: null),
                    },
                    Mode: "unified",
                    Header: new DiffHeader(Old: "before.txt", New: "after.txt"),
                    Id: "probe-diff-unified"),
                // Word-level intra-line highlighting via DiffCell.Runs — the feature
                // DiffNode v1 deferred pending the inline-rich-text question. OLD side
                // strikes the removed word, NEW side bolds the added one. Text stays
                // required on both (plain reading + fallback + agent-legible form).
                new DiffNode(
                    Rows: new DiffRow[]
                    {
                        new DiffRow(
                            Old: new DiffCell("the quick brown fox", LineNumber: 1, Runs: new[]
                            {
                                new InlineRun("the "),
                                new InlineRun("quick", Strike: true),
                                new InlineRun(" brown fox"),
                            }),
                            New: new DiffCell("the slow brown fox", LineNumber: 1, Runs: new[]
                            {
                                new InlineRun("the "),
                                new InlineRun("slow", Bold: true),
                                new InlineRun(" brown fox"),
                            })),
                    },
                    Id: "probe-diff-wordlevel"),
            }));
        // Inline rich text (TextNode.Runs) — byte-identical to the bun twin
        // richTextSection. Covers the absent-vs-present matrix for every optional on
        // InlineRun, plus the two contract cases that are DECISIONS rather than
        // mechanics: (a) Runs OMITTED entirely, proving absent-never-null and that
        // the pre-runs shape is byte-identical; (b) the DELIBERATE DIVERGENCE case,
        // where Value spells the URL out while Runs carries a proper link so
        // link-less adapters still show the target — which is exactly why value/runs
        // equality is a documented SHOULD and not a runtime check. Shipping it here
        // makes that decision visible in code rather than only in a comment.
        // Nothing here is action-bearing: an InlineRun CANNOT carry an action, which
        // is why neither backend's walker needed a new arm. That is the point.
        pageChildren.Add(new SectionNode(
            Heading: "Inline rich text",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                // Runs OMITTED — absent on the wire, not null.
                new TextNode("Plain paragraph — runs omitted entirely."),
                // The full matrix, in order: bare run (all optionals absent), bold,
                // italic, code, strike, all-four-combined, href WITHOUT external,
                // href WITH external. FromRuns derives Value from the run texts.
                TextNode.FromRuns(new[]
                {
                    new InlineRun("plain "),
                    new InlineRun("bold", Bold: true),
                    new InlineRun(" "),
                    new InlineRun("italic", Italic: true),
                    new InlineRun(" "),
                    new InlineRun("code", Code: true),
                    new InlineRun(" "),
                    new InlineRun("struck", Strike: true),
                    new InlineRun(" "),
                    new InlineRun("everything", Bold: true, Italic: true, Code: true, Strike: true),
                    new InlineRun(" "),
                    new InlineRun("link", Href: "https://example.com/docs"),
                    new InlineRun(" "),
                    new InlineRun("external", Href: "https://example.com/out", External: true),
                }),
                // Adjacent runs sharing an identical Href — the renderer coalesces
                // these into exactly ONE anchor (one tab stop, one SR announcement).
                TextNode.FromRuns(new[]
                {
                    new InlineRun("see ", Href: "https://example.com/docs"),
                    new InlineRun("the docs", Href: "https://example.com/docs", Bold: true),
                    new InlineRun(" now", Href: "https://example.com/docs"),
                }),
                // DELIBERATE DIVERGENCE — Value spells the URL out; Runs carry the
                // link. Built via the primary constructor, NOT FromRuns, precisely
                // because the two readings are intended to differ here.
                new TextNode("Docs: https://example.com/docs", Runs: new[]
                {
                    new InlineRun("Docs: "),
                    new InlineRun("the docs", Href: "https://example.com/docs"),
                }),
            }));
        pageChildren.Add(new SectionNode(
            Heading: "Lookup field",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                new FieldNode("lookup-owner", "lookup", Bind: "lookupOwner", Label: "Owner",
                    Placeholder: null,
                    Selected: new LookupItem[]
                    {
                        new LookupItem("u-1", Label: "Ada Lovelace", Type: "user"),
                    }),
                new FieldNode("lookup-tag", "lookup", Bind: "lookupTag", Label: "Tag",
                    Placeholder: null,
                    Selected: new LookupItem[] { new LookupItem("urgent") },
                    Candidates: new LookupItem[]
                    {
                        new LookupItem("urgent"),
                        new LookupItem("blocked"),
                    },
                    AllowCustom: true),
                new FieldNode("lookup-watchers", "lookup-multiple", Bind: "lookupWatchers",
                    Label: "Watchers",
                    Placeholder: null,
                    Selected: new LookupItem[]
                    {
                        new LookupItem("u-2", Label: "Grace Hopper", Type: "user"),
                        new LookupItem("t-7", Label: "Platform", Type: "team"),
                    },
                    SearchBind: "lookupQuery",
                    SearchAction: new ActionDescriptor("lookup-search-probe")),
            }));
        pageChildren.Add(new ModalNode(
            Title: "Probe modal",
            Children: new ViewNode[] { new TextNode("Modal body for parity coverage.", null) },
            Footer: new ViewNode[] { new ButtonNode("OK", new ActionDescriptor("modal-ok")) },
            DismissAction: new ActionDescriptor("modal-dismiss"),
            Size: ModalSize.Narrow));
        return new PageNode("Feature Probe", pageChildren,
            Density: Density.Compact, Layout: Layout.Cards);
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
                NextAction: new ActionDescriptor("table-page-next"),
                JumpAction: new ActionDescriptor("table-page-jump")));

        return new SectionNode("Table matrix",
            new List<ViewNode> { table },
            Variant: SectionVariant.Card);
    }
}
