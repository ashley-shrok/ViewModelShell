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
    string LookupQuery,
    // 8.2.0 (RICH-01) — rich text field bind slot. Round-tripped as a markdown
    // string per D-06 (the wire contract carries markdown, NOT HTML — zero XSS
    // on the wire; sanitization is a display-side concern). Seeded
    // byte-identically to the bun/node twin — a divergent seed fails the
    // parity diff for a reason unrelated to the wire, banked lesson from
    // CONTEXT §7. Trailing-append per gotcha #8 companion-safe rule
    // (FeatureProbe uses ProjectReference, so source-rebuild — safe; the
    // discipline is kept regardless).
    string DraftMarkdown,
    // 9.1.0 (CHAT-15) — ChatComposerNode state slots for the parity fixture
    // `chat-composer` (Plan 30-07). Each field drives ONE of the 5 wire branches
    // exercised by the fixture; the buildVm arm below reads them to render a
    // ChatComposerNode whose emission carries a UNIQUE substring for the
    // corresponding branch, per AGENTS.md gotcha #9 class-3 lesson (branches
    // the fixture never runs are invisible to a diff — every documented branch
    // MUST have a distinctive expectBodyContains substring). All non-nullable
    // string/bool with empty/false defaults so no JsonIgnore needed on the
    // state record itself per gotcha #8 (the state record isn't covered by the
    // intrinsic JsonIgnore on ViewNode types; explicit attributes would be
    // needed only if a field could be null). Byte-parallel with bun/node twin.
    string ChatComposerDraft,        // draft-text bind slot (send/attach dispatch would round-trip via this)
    string ChatComposerStatus,       // "" (default → idle absent on wire) | "sending" | "streaming"
    bool ChatComposerHasStopAction,  // true when status can reach "streaming" so stopAction is set (validator hint)
    bool ChatComposerAttached,       // true renders a HeaderSlot tripwire TextNode (attach-clicked branch)
    string ChatComposerDropScope,    // "" (default → composer absent) | "global"
    string ChatComposerSubmitMode,   // "" (default → enter absent) | "ctrl-enter"
    // v9.2.0 (Phase 31 / MAXLINES-PARITY) — "" (unset) | "1" | "2" | "3",
    // drives BuildVm's TextNode.MaxLines emission. Non-nullable string with ""
    // default (matches ChatComposerStatus/DropScope/SubmitMode posture per
    // gotcha #8 — state record is app-owned so nullables would need explicit
    // JsonIgnore; empty-string default sidesteps that entirely). Each fixture
    // step (unset / 1 / 2 / 3) mutates this slot to its target string; the
    // BuildVm arm maps to TextNode.MaxLines int? and to a marker text string
    // giving each branch a UNIQUE positive tripwire per AGENTS.md gotcha #9
    // class-3 lesson. Byte-parallel with bun/node twin (textNodeMaxLinesProbe).
    string TextNodeMaxLinesProbe,
    // Phase 32 (column-filter parity) — wire-shape probe slot. "" (unset) |
    // "one-rule-with-value" | "one-rule-no-value" | "two-rules-any-of" |
    // "three-rules-all-of". Drives BuildVm's filter wire-shape probe section
    // that renders a TableNode column with Filter=FilterSpec + a
    // FilterDescriptor at a filterDescriptorBinds path. Non-nullable string
    // with "" default per gotcha #8 state-record posture. Byte-parallel with
    // bun/node twin (filterWireShapeProbe).
    string FilterWireShapeProbe,
    // Phase 32 (column-filter parity) — helper probe input. JSON-encoded
    // probe payload string: {"kind":"text","operator":"contains","rawValue":
    // "hello","displayString":"hello world","ruleValue":"world"}. The action
    // arm filter-helper-probe deserializes this, calls FilterHelper.MatchesFilter,
    // and writes the result to FilterHelperProbeResult. Non-nullable string
    // with "" default. Byte-parallel with bun/node twin (filterHelperProbe).
    string FilterHelperProbe,
    // Phase 32 (column-filter parity) — helper probe result. "true" or "false"
    // after filter-helper-probe action runs. The BuildVm section renders a
    // TextNode("FilterHelperProbeResult={result}") that the fixture asserts on.
    // Non-nullable string with "" default. Byte-parallel with bun/node twin
    // (filterHelperProbeResult).
    string FilterHelperProbeResult
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
        LookupQuery: "",
        DraftMarkdown: "# Rich text probe\n\n**bold** _italic_ `code`",
        // 9.1.0 (CHAT-15) — ChatComposerNode probe state defaults. All-empty +
        // false-boolean initial state so a fresh GET renders the IDLE branch
        // (status absent → default idle; no stopAction; no attach chip; no
        // dropScope set → default composer absent; no submitMode set →
        // default enter absent). Byte-parallel with bun/node twin.
        ChatComposerDraft: "",
        ChatComposerStatus: "",
        ChatComposerHasStopAction: false,
        ChatComposerAttached: false,
        ChatComposerDropScope: "",
        ChatComposerSubmitMode: "",
        // v9.2.0 (Phase 31) — initial UNSET branch. buildVm renders
        // "TextNodeMaxLinesProbe=unset" marker with MaxLines ABSENT on the wire.
        TextNodeMaxLinesProbe: "",
        // Phase 32 (column-filter parity) — initial unset/empty defaults.
        // FilterWireShapeProbe="" → BuildVm renders the base (no probe section
        // active). FilterHelperProbe="" → no probe input yet. FilterHelperProbeResult=""
        // → BuildVm renders "FilterHelperProbeResult=" marker (empty before first run).
        // Byte-parallel with bun/node twin initialState().
        FilterWireShapeProbe: "",
        FilterHelperProbe: "",
        FilterHelperProbeResult: ""
    );
}

public record TableItem(string Id, string Name, string Status);

/// <summary>
/// Deserialization target for the filter-helper-probe state payload.
/// Each fixture step sets state.FilterHelperProbe to a JSON-encoded instance
/// of this type; the action arm deserializes it and calls FilterHelper.MatchesFilter.
/// Byte-parallel with the TS interface in handler.ts.
/// </summary>
public record FilterHelperProbeInput(
    string Kind,
    string Operator,
    object? RawValue,
    string? DisplayString,
    object? RuleValue,
    string? Joiner,
    [property: System.Text.Json.Serialization.JsonIgnore(Condition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull)]
    IReadOnlyList<string>? MatchingHints
);

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
        else if (name == "icon-only-invalid")
        {
            // v7.0.0 (ICON-05 / ICON-09) — return a tree containing an icon-only
            // ButtonNode WITHOUT tooltip so .Validate() throws the byte-identical
            // error → {ok:false, errors:[{message:"icon-only ButtonNode requires
            // tooltip (used as aria-label)", code:"invalid_tree"}]} at 500.
            // Parity's byte-diff on the error message across both backends is the
            // proof the two hand-mirrored walker predicates agree.
            var iconOnlyInvalidTree = new PageNode(
                Title: null,
                Children: new ViewNode[]
                {
                    new ButtonNode(
                        Label: "",
                        Action: new ActionDescriptor("noop-icon-invalid"),
                        Icon: IconName.Trash2),
                });
            return new ShellResponse<FeatureProbeState>(iconOnlyInvalidTree, state).Validate();
        }
        // 9.1.0 (CHAT-15) — ChatComposerNode fixture branches (Plan 30-07).
        // Each of these actions mutates ONE state slot the buildVm arm reads to
        // render the ChatComposerNode with the target branch's tripwire on the
        // wire. Byte-parallel with bun/node twin.
        else if (name == "chat-composer-set-streaming")
        {
            // Branch (b) STREAMING: emit "status":"streaming" + "stopAction" on the wire.
            state = state with { ChatComposerStatus = "streaming", ChatComposerHasStopAction = true };
        }
        else if (name == "chat-composer-toggle-attached")
        {
            // Branch (c) ATTACH-CLICKED: emit the HeaderSlot tripwire TextNode.
            state = state with { ChatComposerAttached = !state.ChatComposerAttached };
        }
        else if (name == "chat-composer-set-dropscope-global")
        {
            // Branch (d) DROPSCOPE-GLOBAL: emit "dropScope":"global" on the wire.
            state = state with { ChatComposerDropScope = "global" };
        }
        else if (name == "chat-composer-set-submitmode-ctrlenter")
        {
            // Branch (e) SUBMITMODE-CTRLENTER: emit "submitMode":"ctrl-enter" on the wire.
            state = state with { ChatComposerSubmitMode = "ctrl-enter" };
        }
        // No-op passthroughs for the 3 ChatComposerNode ActionEvent slots. They
        // exist so the action-name uniqueness walker + potential future adopter
        // dispatch don't hit UnknownActionException; the fixture does NOT
        // exercise them (state passthrough, buildVm re-renders).
        else if (name == "chat-composer-send" || name == "chat-composer-stop" || name == "chat-composer-attach")
        {
            // state unchanged.
        }
        // v9.2.0 (Phase 31 / MAXLINES-PARITY) — TextNode.maxLines axis fixture
        // branches (Plan 31-03). Each of these actions mutates the state slot
        // the buildVm arm reads to render the probe TextNode with the target
        // branch's tripwire on the wire. Byte-parallel with bun/node twin.
        else if (name == "textnode-maxlines-unset") { state = state with { TextNodeMaxLinesProbe = "" }; }
        else if (name == "textnode-maxlines-1")     { state = state with { TextNodeMaxLinesProbe = "1" }; }
        else if (name == "textnode-maxlines-2")     { state = state with { TextNodeMaxLinesProbe = "2" }; }
        else if (name == "textnode-maxlines-3")     { state = state with { TextNodeMaxLinesProbe = "3" }; }
        // Phase 32 (column-filter parity) — wire-shape probe action arms.
        // Each flips FilterWireShapeProbe to the target branch; BuildVm renders
        // the corresponding FilterDescriptor in the filter wire-shape probe section.
        // Byte-parallel with bun/node twin.
        else if (name == "filter-wire-shape-one-rule-with-value")
            { state = state with { FilterWireShapeProbe = "one-rule-with-value" }; }
        else if (name == "filter-wire-shape-one-rule-no-value")
            { state = state with { FilterWireShapeProbe = "one-rule-no-value" }; }
        else if (name == "filter-wire-shape-two-rules-any-of")
            { state = state with { FilterWireShapeProbe = "two-rules-any-of" }; }
        else if (name == "filter-wire-shape-three-rules-all-of")
            { state = state with { FilterWireShapeProbe = "three-rules-all-of" }; }
        // Phase 32 (column-filter parity) — helper probe action arm.
        // Deserializes state.FilterHelperProbe JSON, calls FilterHelper.MatchesFilter,
        // writes "true"/"false" to state.FilterHelperProbeResult. Byte-parallel
        // with bun/node twin's matchesFilter call.
        else if (name == "filter-helper-probe")
        {
            if (!string.IsNullOrEmpty(state.FilterHelperProbe))
            {
                var probe = System.Text.Json.JsonSerializer.Deserialize<FilterHelperProbeInput>(
                    state.FilterHelperProbe,
                    new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                if (probe != null)
                {
                    var descriptor = new FilterDescriptor(
                        new List<FilterRule>
                        {
                            new FilterRule(
                                Operator: probe.Operator,
                                Value: probe.RuleValue)
                        },
                        Joiner: probe.Joiner ?? "all-of");
                    var result = FilterHelper.MatchesFilter(
                        descriptor,
                        probe.RawValue,
                        probe.DisplayString ?? "",
                        probe.Kind,
                        probe.MatchingHints);
                    state = state with { FilterHelperProbeResult = result ? "true" : "false" };
                }
            }
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

        // 6.10.0 — BlockquoteNode parity coverage. Static view-shape captured
        // by every GET step: a bare blockquote + a NESTED blockquote whose
        // inner children include a ButtonNode with the UNIQUE action name
        // `blockquote-action-probe`, proving the action-name uniqueness walk
        // descends into BlockquoteNode.Children on the .NET side too.
        children.Add(new BlockquoteNode(new List<ViewNode>
        {
            new TextNode("A quoted paragraph inside a blockquote."),
        }));
        children.Add(new BlockquoteNode(new List<ViewNode>
        {
            new TextNode("Outer quote — nested one below plus an action inside."),
            new BlockquoteNode(new List<ViewNode>
            {
                new TextNode("Nested inner quote."),
                new ButtonNode("Probe", new ActionDescriptor("blockquote-action-probe")),
            }),
        }));

        // 6.10.0 — CodeBlockNode parity coverage. Static view-shape captured
        // by every GET step: bare (Language/Filename/Copyable omitted, proves
        // WhenWritingNull posture), full (all three set), copyable:false
        // (proves the JSON false literal crosses). Twins pin the same three
        // shapes with identical field values so the byte-diff verifies.
        children.Add(new CodeBlockNode("print('hello world')"));
        children.Add(new CodeBlockNode(
            "def add(a, b):\n    return a + b",
            Language: "python",
            Filename: "add.py"));
        children.Add(new CodeBlockNode(
            "// static excerpt — no copy button",
            Language: "typescript",
            Copyable: false));

        // 6.10.0 — ListItemNode.Completed parity coverage. Static view-shape
        // captured by every GET step: one item with Completed:true, one with
        // Completed:false, one with Completed OMITTED. Proves JSON true /
        // JSON false literals cross the wire AND that omitted = absent
        // (WhenWritingNull ⇒ absent, not null) on the .NET side too.
        children.Add(new ListNode(Children: new List<ViewNode>
        {
            new ListItemNode(Id: null, State: null,
                Children: new List<ViewNode> { new TextNode("Task done") },
                Completed: true),
            new ListItemNode(Id: null, State: null,
                Children: new List<ViewNode> { new TextNode("Task todo") },
                Completed: false),
            new ListItemNode(Id: null, State: null,
                Children: new List<ViewNode> { new TextNode("Plain item (no marker)") }),
        }));

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
                    Disabled: true,
                    // 6.12.0 (TOOL-01) — a FIELD carrying a tooltip. Static
                    // view-shape so every GET byte-diffs the tooltip on a
                    // FieldNode across .NET/bun/node.
                    Tooltip: "The region code from the customer's billing address."),
                // 6.12.0 (RADIO-01) — the radio inputType exercised as static
                // view-shape. Options carry {value,label} so parity byte-diffs
                // the {type:"field", inputType:"radio", options:[…]} wire across
                // .NET/bun/node. The initial step's expectBodyContains asserts
                // "inputType":"radio" + one option value string, so if a backend
                // dropped options or emitted a different inputType casing the
                // step fails LOUDLY instead of going vacuous.
                new FieldNode("fc-radio", "radio", "note", "Priority", null,
                    Options: new FieldOption[]
                    {
                        new FieldOption("low", "Low"),
                        new FieldOption("med", "Medium"),
                        new FieldOption("high", "High"),
                    }),
                // 6.12.0 (RANGE-01) — the range inputType exercised as static
                // view-shape reusing the existing min/max/step string fields.
                // The default renderer branch handles it via inp.type = "range"
                // + decorateField applying min/max/step; no new renderer arm.
                new FieldNode("fc-range", "range", "note", "Level", null,
                    Min: "0", Max: "100", Step: "5"),
                new ButtonNode("Submit (disabled)", new ActionDescriptor("fc-submit"),
                    Emphasis: Emphasis.Primary, Disabled: true,
                    // 6.12.0 (TOOL-01) — a BUTTON carrying a tooltip. Static
                    // view-shape so every GET byte-diffs the tooltip on a
                    // ButtonNode across .NET/bun/node.
                    Tooltip: "Currently disabled — complete required fields first."),
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
        // tone+emphasis badge; a bare empty-state (no Description/Action => omitted =
        // absent), and an empty-state with Description + a CTA ButtonNode (proves the
        // action serializes with the "type":"button" discriminator AND the
        // action-name walk descends into EmptyStateNode.Action — unique name
        // feedback-cta).
        //
        // v8.0.0 BREAKING RENAME (24-04): EmptyStateNode field names
        // Heading→Title, Message→Description; NEW Icon slot.
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
                    Description: "Add the first item.",
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
                    new TrackerCell(TrackerState.Success, Tooltip: "2026-07-15 14:02 UTC · Success"),
                    new TrackerCell(TrackerState.Danger, Tooltip: "Failed",
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
        // Icons (v7.0.0 — ICON-01/02/04/05/06/09) — byte-identical to the bun
        // twin iconsSection. Full omitted-vs-present matrix for the icons
        // primitive: bare IconNode (Size/Tone/Label absent), one per size (5),
        // one per tone (4 — matches the closed union), a meaning-carrying one
        // with Label set, a multi-word (shield-check) + a number-suffixed
        // (trash-2) name that exercise the IconNameConverter's digit-aware
        // kebab conversion (the specific defect the plain KebabEnum<T> would
        // silently drift on), cross-node icon? prop on all 5 hosts, and the
        // VALID icon-only ButtonNode (label empty + tooltip set). The INVALID
        // icon-only form is exercised via the dedicated icon-only-invalid POST
        // action (see the envelope fixture). The renamed TrackerCell.Tooltip
        // field is already covered above.
        // The CLIENT-SIDE SVG rendering + the .vms-tooltip-host styled bubble
        // is browser-only and NOT part of parity.
        pageChildren.Add(new SectionNode(
            Heading: "Icons",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                // Standalone IconNode — bare (all optionals absent).
                new IconNode(IconName.Sparkles),
                // One per size (5 total).
                new IconNode(IconName.Activity, Size: IconSize.Xs),
                new IconNode(IconName.Activity, Size: IconSize.Sm),
                new IconNode(IconName.Activity, Size: IconSize.Md),
                new IconNode(IconName.Activity, Size: IconSize.Lg),
                new IconNode(IconName.Activity, Size: IconSize.Xl),
                // One per tone (4 total, matching the closed union).
                new IconNode(IconName.CheckCircle, Tone: Tone.Info),
                new IconNode(IconName.CheckCircle, Tone: Tone.Success),
                new IconNode(IconName.CheckCircle, Tone: Tone.Warning),
                new IconNode(IconName.CheckCircle, Tone: Tone.Danger),
                // Meaning-carrying (Label set). Multi-word name proves
                // ShieldCheck serializes as "shield-check".
                new IconNode(IconName.ShieldCheck, Label: "Verified"),
                // Number-suffixed name — Trash2 → "trash-2" (the specific
                // IconNameConverter test case).
                new IconNode(IconName.Trash2, Size: IconSize.Lg, Tone: Tone.Danger, Label: "Delete permanently"),
                // Cross-node host props — all 5 hosts.
                new ButtonNode(Label: "Sparkle", Action: new ActionDescriptor("icon-button-noop"), Icon: IconName.Sparkles),
                new LinkNode(Label: "Docs", Href: "https://vms.example/docs", External: true, Icon: IconName.ExternalLink),
                new SectionNode(
                    Heading: "Angels",
                    Variant: SectionVariant.Card,
                    Icon: IconName.Activity,
                    Children: new ViewNode[] { new TextNode("Card body.") }),
                new BadgeNode(Label: "Verified", Tone: Tone.Success, Icon: IconName.CheckCircle),
                new ListNode(new ViewNode[]
                {
                    new ListItemNode(
                        Id: null,
                        State: null,
                        Children: new ViewNode[] { new TextNode("Files") },
                        Icon: IconName.Folder),
                }),
                // VALID icon-only ButtonNode — label empty + tooltip set,
                // walker allows.
                new ButtonNode(
                    Label: "",
                    Action: new ActionDescriptor("icon-only-noop"),
                    Icon: IconName.Wrench,
                    Tooltip: "Settings"),
            }));
        // v8.0.0 Foundations (COMP-01..COMP-04) — byte-identical to the bun
        // twin foundationsSection. Every branch introduced by plans 23-01..04
        // gets at least one emission here + an expectBodyContains tripwire on
        // the initial GET step, per banked lesson: a diff can only prove
        // things about code it actually RUNS. Fleet-adoption discipline
        // (banked from UseVmsShellStaticFiles 6.7.0) is honored — the
        // primitives ship with parity coverage in the same batch.
        //   • COMP-01 (caption): TextNode with Style:Caption — proves the
        //     closed union grew to 7 members and "style":"caption" crosses.
        //   • COMP-02 (weight, Option A): three TextNodes Weight:Regular/
        //     Medium/Bold — proves the new orthogonal axis crosses the wire.
        //   • COMP-03 (switch variant): CheckboxNode Variant:Switch + one
        //     with Variant OMITTED — proves the enum crosses AND
        //     WhenWritingNull posture on the .NET side.
        //   • COMP-04 (AvatarNode): a bare AvatarNode (all optionals absent
        //     — proves gotcha #8 posture, the class-2 defect findNulls
        //     catches on both backends), one per size sm/md/lg/xl (proves
        //     the closed AvatarSize enum crosses), one per content mode
        //     (initials/tone, icon/tone, image-only), and a meaning-
        //     carrying one (Alt set).
        // NOTE: the CLIENT-SIDE rendering is browser-only and NOT part of
        // parity — parity proves only that the fields serialize identically
        // across backends.
        pageChildren.Add(new SectionNode(
            Heading: "v8.0.0 Foundations",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                // COMP-01 caption tier
                new TextNode("Row primary (body)",       Style: TextStyle.Body),
                new TextNode("Row secondary (muted)",    Style: TextStyle.Muted),
                new TextNode("2h ago · READ · Ada L.",   Style: TextStyle.Caption),

                // COMP-02 weight axis (Option A)
                new TextNode("Regular weight", Style: TextStyle.Body, Weight: TextWeight.Regular),
                new TextNode("Medium weight",  Style: TextStyle.Body, Weight: TextWeight.Medium),
                new TextNode("Bold weight",    Style: TextStyle.Body, Weight: TextWeight.Bold),

                // COMP-03 switch variant
                new CheckboxNode(
                    Name: "notifications",
                    Bind: "notifications",
                    Label: "Notifications",
                    Action: null,
                    Tooltip: null,
                    Variant: CheckboxVariant.Switch),
                // Variant OMITTED — proves absent = default (WhenWritingNull),
                // NOT "variant":"checkbox" fill-in and NOT "variant":null.
                new CheckboxNode(
                    Name: "beta",
                    Bind: "beta",
                    Label: "Beta features (variant omitted)",
                    Action: null),

                // COMP-04 AvatarNode — bare + sizes + modes.
                new AvatarNode(),
                new AvatarNode(Size: AvatarSize.Sm, Initials: "S"),
                new AvatarNode(Size: AvatarSize.Md, Initials: "M"),
                new AvatarNode(Size: AvatarSize.Lg, Initials: "L"),
                new AvatarNode(Size: AvatarSize.Xl, Initials: "AL", Tone: Tone.Success, Alt: "Ada Lovelace"),
                new AvatarNode(Initials: "GH", Tone: Tone.Info, Alt: "Grace Hopper"),
                new AvatarNode(Icon: IconName.User, Tone: Tone.Warning, Size: AvatarSize.Lg, Alt: "Anonymous user"),
                new AvatarNode(Image: "https://vms.example/avatar-ada.png", Alt: "Ada Lovelace"),
            }));
        // v8.0.0 Primary Composites (COMP-05..COMP-08) — byte-identical to the
        // bun twin primaryCompositesSection. Every branch introduced by plans
        // 24-01..04 gets at least one emission here + an expectBodyContains
        // tripwire on the initial GET step, per banked lesson: a diff can only
        // prove things about code it actually RUNS. Fleet-adoption discipline
        // is honored — the composites ship with parity coverage in the same
        // batch (per v5.1 EXTEND pattern; single fixture, appended section).
        //   • COMP-05 (ListRowNode): one standalone ListRowNode (all slots
        //     populated: Primary/Secondary/Meta[]/Tone/State/Action) + a
        //     ListNode(Variant:Rows) wrapper containing two ListRowNodes —
        //     proves standalone-vs-container dispatch AND the ListVariant.Rows
        //     enum crosses the wire.
        //   • COMP-06 + 06a (MessageNode + MessageListNode): a MessageListNode
        //     with FollowTail:true (proves the WhenWritingDefault posture emits
        //     the literal boolean true on the wire — false is ABSENT) containing
        //     two MessageNodes with different Roles (User + Assistant, proves
        //     the closed MessageRole enum crosses) + full Avatar + Timestamp +
        //     Content + Actions slots.
        //   • COMP-07 (AlertNode): one per Tone (Danger/Warning/Success/Info) +
        //     one Dismissible:true variant (proves the WhenWritingDefault
        //     posture on the .NET side matches the TS optional bool). Dismiss
        //     button emits {name:"dismiss"} client-side — the wire carries only
        //     the boolean posture; parity byte-diffs that.
        //   • COMP-08 (EmptyStateNode): one with RENAMED Title/Description +
        //     NEW Icon slot + Action button with UNIQUE name
        //     empty-state-cta-probe — proves the rename cascade reached the
        //     demo backends AND the action-name walk descends through the
        //     renamed shape.
        // NOTE: Icon:Receipt used (not Inbox per PATTERNS suggestion) — the
        // shipped IconName enum does not include Inbox; Receipt fits the
        // "orders" narrative and matches the Showcase (24-06). The icon choice
        // is subordinate to the tripwires — Title/Description strings are the
        // load-bearing proof of the rename cascade.
        // NOTE: the CLIENT-SIDE rendering is browser-only and NOT part of
        // parity — parity proves only that the fields serialize identically
        // across backends.
        pageChildren.Add(new SectionNode(
            Heading: "v8.0.0 Primary Composites",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                // COMP-05 ListRowNode (standalone)
                new ListRowNode(
                    Primary: new TextNode("Order #42 · Ada Lovelace", Style: TextStyle.Body, Weight: TextWeight.Medium),
                    Secondary: new TextNode("Awaiting fulfillment · flagged high priority", Style: TextStyle.Muted),
                    Meta: new ViewNode[] {
                        new TextNode("Placed 2h ago",  Style: TextStyle.Caption),
                        new TextNode("priority: high", Style: TextStyle.Caption),
                        new TextNode("channel: web",   Style: TextStyle.Caption),
                    },
                    Tone: Tone.Warning,
                    State: "high",
                    Action: new ActionDescriptor("list-row-open-42")),
                // COMP-05a ListNode(Variant:Rows) with ListRow children
                new ListNode(
                    Children: new ViewNode[] {
                        new ListRowNode(
                            Primary: new TextNode("Refunded successfully", Style: TextStyle.Body, Weight: TextWeight.Medium),
                            Leading: new AvatarNode(Initials: "AL", Tone: Tone.Success),
                            Secondary: new TextNode("Refund ID rf_39a2 · $124.00", Style: TextStyle.Muted),
                            Meta: new ViewNode[] { new TextNode("7m ago", Style: TextStyle.Caption) },
                            Tone: Tone.Success,
                            State: "done"),
                        new ListRowNode(
                            Primary: new TextNode("Payment declined", Style: TextStyle.Body, Weight: TextWeight.Medium),
                            Meta: new ViewNode[] {
                                new TextNode("issuer decline",    Style: TextStyle.Caption),
                                new TextNode("card ending 4321",  Style: TextStyle.Caption),
                            },
                            Tone: Tone.Danger),
                    },
                    Variant: ListVariant.Rows),
                // COMP-06 + 06a MessageListNode with FollowTail:true
                new MessageListNode(
                    Children: new MessageNode[] {
                        new MessageNode(
                            Author: "Ada Lovelace",
                            Content: new TextNode("Can we ship v8 this week?", Style: TextStyle.Body),
                            Timestamp: "2:14 PM",
                            Avatar: new AvatarNode(Initials: "AL", Tone: Tone.Success),
                            Role: MessageRole.User),
                        new MessageNode(
                            Author: "VMS Assistant",
                            Content: new TextNode("The Phase 24 branch is green; publishing is a maintainer step.", Style: TextStyle.Body),
                            Timestamp: "2:15 PM",
                            Avatar: new AvatarNode(Icon: IconName.Sparkles, Tone: Tone.Info),
                            Role: MessageRole.Assistant,
                            Actions: new ViewNode[] {
                                new ButtonNode(Label: "OK", Action: new ActionDescriptor("message-noop-1")),
                            }),
                        // Phase 27-07: State:"active" state-probe message. Unique Author
                        // string anchors the per-composite tripwire (message-state-probe).
                        // Composes multiplicatively with Role:Assistant per Plan 27-01
                        // TSDoc annotation (no cascade collision: .vms-message--assistant
                        // tints surface, .vms-message--active paints left-accent border).
                        new MessageNode(
                            Author: "message-state-probe",
                            Content: new TextNode("Probing state:\"active\" on MessageNode.", Style: TextStyle.Body),
                            Timestamp: "2:16 PM",
                            Avatar: new AvatarNode(Initials: "SP", Tone: Tone.Info),
                            Role: MessageRole.Assistant,
                            State: "active"),
                    },
                    FollowTail: true),
                // COMP-07 AlertNode per tone + Dismissible:true
                new AlertNode(Tone: Tone.Warning, Message: new TextNode("You've used 92% of your quota.", Style: TextStyle.Muted), Title: "Storage almost full", Dismissible: true),
                new AlertNode(Tone: Tone.Danger,  Message: new TextNode("Your card was refused.",       Style: TextStyle.Muted), Title: "Payment declined"),
                new AlertNode(Tone: Tone.Success, Message: new TextNode("Refund of $124 issued.",       Style: TextStyle.Muted), Title: "Refund processed"),
                new AlertNode(Tone: Tone.Info,    Message: new TextNode("v8.0.0 is available.",         Style: TextStyle.Muted), Title: "New version"),
                // COMP-08 EmptyStateNode with RENAMED Title/Description + NEW Icon slot
                new EmptyStateNode(
                    Title: "No orders yet",
                    Icon: IconName.Receipt,
                    Description: "Once customers place orders they'll show up here.",
                    Action: new ButtonNode(Label: "Learn more", Action: new ActionDescriptor("empty-state-cta-probe"))),
            }));
        // v8.0.0 Secondary Composites (COMP-09..COMP-13) — byte-identical to the
        // bun twin secondaryCompositesSection. Every branch introduced by plans
        // 25-01..05 gets at least one emission here + an expectBodyContains
        // tripwire on the initial GET step, per banked lesson: a diff can only
        // prove things about code it actually RUNS. Fleet-adoption discipline
        // is honored — the composites ship with parity coverage in the same
        // batch (per v5.1 EXTEND pattern; single fixture, appended section).
        //   • COMP-09 (UserRowNode): one with all slots populated
        //     (Avatar + Name + Meta + Status:{Label:"Online", Kind:Online} +
        //     Action name user-row-open-jd) — proves the StatusKind closed
        //     enum crosses AND the action-name walk descends through
        //     UserRowNode.Action.
        //   • COMP-10 + 10a (DetailRowNode + DetailListNode): one
        //     DetailListNode with LabelWidth:Lg (proves DetailLabelWidth
        //     closed enum crosses) containing three DetailRowNodes — two
        //     neutral + one Tone:Danger (proves the tone closed union
        //     crosses on the row-level).
        //   • COMP-11 + 11a (TimelineEntryNode + TimelineNode): one
        //     TimelineNode containing three TimelineEntryNodes covering
        //     Danger/Warning/Success tones.
        //   • COMP-12 + 12a (SettingRowNode + SettingListNode): one
        //     SettingListNode with Heading + two SettingRowNodes — one
        //     exercises the CheckboxNode(Variant:Switch) pairing per
        //     CONTEXT §9 as Trailing; one exercises a ButtonNode Trailing
        //     with UNIQUE action name setting-row-configure-digest.
        //   • COMP-13 + 13a (ChipNode + ChipListNode): one ChipListNode
        //     containing four ChipNodes covering the full slot matrix —
        //     dismissAction-only (chip-remove-filter-active), tone-only,
        //     action-only (chip-toggle-tag-clickme), and BOTH action +
        //     dismissAction (UNIQUE names chip-toggle-tag-both +
        //     chip-remove-tag-both).
        // NOTE: the CLIENT-SIDE rendering is browser-only and NOT part of
        // parity — parity proves only that the fields serialize identically
        // across backends.
        pageChildren.Add(new SectionNode(
            Heading: "v8.0.0 Secondary Composites",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                // COMP-09 UserRowNode
                new UserRowNode(
                    Name: new TextNode("Jane Dougherty", Style: TextStyle.Body, Weight: TextWeight.Medium),
                    Avatar: new AvatarNode(Initials: "JD", Tone: Tone.Info),
                    Meta: new TextNode("jane.d · SRE Lead", Style: TextStyle.Muted),
                    Status: new UserRowStatus("Online", StatusKind.Online),
                    Action: new ActionDescriptor("user-row-open-jd")),
                // Phase 27-07: State:"active" state-probe UserRow. Unique
                // Action name anchors the per-composite tripwire
                // (user-row-state-probe).
                new UserRowNode(
                    Name: new TextNode("State Probe", Style: TextStyle.Body, Weight: TextWeight.Medium),
                    Action: new ActionDescriptor("user-row-state-probe"),
                    State: "active"),
                // COMP-10 + 10a DetailListNode with LabelWidth:Lg
                new DetailListNode(
                    Children: new ViewNode[] {
                        new DetailRowNode(Label: "Status",   Value: new TextNode("Open", Style: TextStyle.Body)),
                        new DetailRowNode(Label: "Assignee", Value: new TextNode("Jane Dougherty", Style: TextStyle.Body)),
                        new DetailRowNode(Label: "Deleted",  Value: new TextNode("purged 2h ago", Style: TextStyle.Body), Tone: Tone.Danger),
                        // Phase 27-07: State:"active" state-probe row. Unique
                        // Label anchors the per-composite tripwire
                        // (detail-row-state-probe).
                        new DetailRowNode(Label: "detail-row-state-probe", Value: new TextNode("on", Style: TextStyle.Body), State: "active"),
                    },
                    LabelWidth: DetailLabelWidth.Lg),
                // COMP-11 + 11a TimelineNode with 3 TimelineEntryNodes covering tones
                new TimelineNode(Children: new ViewNode[] {
                    new TimelineEntryNode(Time: "2:47 PM", Description: new TextNode("Incident opened",       Style: TextStyle.Body), Tone: Tone.Danger),
                    new TimelineEntryNode(Time: "2:49 PM", Description: new TextNode("Acknowledged by Jane",  Style: TextStyle.Body), Tone: Tone.Warning),
                    new TimelineEntryNode(Time: "2:58 PM", Description: new TextNode("Rollback verified",     Style: TextStyle.Body), Tone: Tone.Success),
                    // Phase 27-07: State:"active" state-probe entry. Unique
                    // Description text anchors the per-composite tripwire
                    // (timeline-entry-state-probe).
                    new TimelineEntryNode(Time: "3:00 PM", Description: new TextNode("timeline-entry-state-probe", Style: TextStyle.Body), State: "active"),
                }),
                // COMP-12 + 12a SettingListNode with SettingRowNodes (CheckboxNode Variant:Switch pairing)
                new SettingListNode(
                    Children: new ViewNode[] {
                        new SettingRowNode(
                            Label: new TextNode("Email notifications", Style: TextStyle.Body, Weight: TextWeight.Medium),
                            Description: new TextNode("Receive an email for every incident update.", Style: TextStyle.Muted),
                            Trailing: new CheckboxNode(Name: "setting-email", Bind: "settings.email", Label: "", Action: null, Variant: CheckboxVariant.Switch)),
                        new SettingRowNode(
                            Label: new TextNode("Weekly digest", Style: TextStyle.Body, Weight: TextWeight.Medium),
                            Description: new TextNode("A Monday-morning summary of the past week.", Style: TextStyle.Muted),
                            Trailing: new ButtonNode(Label: "Configure", Action: new ActionDescriptor("setting-row-configure-digest"))),
                        // Phase 27-07: State:"active" state-probe row. Unique
                        // Action name anchors the per-composite tripwire
                        // (setting-row-state-probe).
                        new SettingRowNode(
                            Label: new TextNode("State probe setting", Style: TextStyle.Body, Weight: TextWeight.Medium),
                            Trailing: new ButtonNode(Label: "Probe", Action: new ActionDescriptor("setting-row-state-probe")),
                            State: "active"),
                    },
                    Heading: "Notification preferences"),
                // COMP-13 + 13a ChipListNode with ChipNodes
                new ChipListNode(Children: new ViewNode[] {
                    new ChipNode(Label: "active",   Tone: Tone.Success, DismissAction: new ActionDescriptor("chip-remove-filter-active")),
                    new ChipNode(Label: "warning",  Tone: Tone.Warning),
                    new ChipNode(Label: "clickme",  Action: new ActionDescriptor("chip-toggle-tag-clickme")),
                    new ChipNode(Label: "both",     Tone: Tone.Info, Action: new ActionDescriptor("chip-toggle-tag-both"), DismissAction: new ActionDescriptor("chip-remove-tag-both")),
                    // Phase 27-07: State:"active" state-probe chip. Unique
                    // Label anchors the per-composite tripwire
                    // (chip-state-probe). NOTE: framework ships NO --active
                    // rule for Chip (deferred per Phase 27 CONTEXT
                    // §Out-of-scope); the field crosses the wire for
                    // uniformity per the typed-slots pattern.
                    new ChipNode(Label: "chip-state-probe", State: "active"),
                }),
            }));
        // ── v8.2.0 Rich text probes (RICH-01 + RICH-02) ─────────────
        // Byte-identical to the bun/node twin richTextProbesSection.
        // Static-shape probes for the Phase 28 rich-text primitives.
        // Every branch introduced by Plans 28-01..05 gets at least one
        // emission here + an expectBodyContains tripwire on the initial
        // GET step, per banked lesson AGENTS.md gotcha #9 corollary: a
        // diff can only prove things about code it actually RUNS. A
        // per-branch tripwire binds each backend's emission independently.
        //   • RICH-01 (RichTextFieldNode) instance #1 — carries an
        //     EXPLICIT nested RichTextToolbarNode slot with the full D-08
        //     tools list + Size:Expanded + Tone:Info + State:"active" +
        //     field-level State:"active" + Label + Placeholder. UNIQUE
        //     Name "rich-text-state-probe" anchors the per-branch tripwire
        //     so a future refactor dropping THIS specific emission fails
        //     LOUDLY.
        //   • RICH-01 (RichTextFieldNode) instance #2 — WITHOUT the
        //     toolbar slot, exercising the framework-default toolbar path
        //     (Plan 28-03). Proves the Toolbar? optional field is
        //     absent-on-wire, not null (WhenWritingNull posture).
        //   • RICH-02 (RichTextToolbarNode) standalone — top-level
        //     toolbar without a parent RichTextFieldNode, exercising
        //     Plan 28-05's standalone rendering path. Tools narrowed to
        //     [Bold, Italic] so the "tools":["bold","italic" substring
        //     is a stable tripwire.
        // Analog C's narrow-typing rule: RichTextFieldNode.Toolbar is
        // typed narrowly (RichTextToolbarNode?, NOT ViewNode?) so the
        // NESTED toolbar does NOT carry a polymorphic "type" discriminator
        // when nested inside RichTextFieldNode (STJ emits only the
        // declared-type's own properties). The STANDALONE emission below
        // IS a top-level ViewNode, so its discriminator ("type":
        // "rich-text-toolbar") DOES emit — that's what the fixture
        // tripwire `"type":"rich-text-toolbar"` binds.
        // NOTE: the CLIENT-SIDE TipTap ProseMirror editor is browser-only
        // and NOT part of parity — parity proves only that the rich-text
        // node shapes serialize identically across backends. The wire
        // footprint does NOT change with TipTap adoption (Plan 28-03's
        // D-04 lazy-import posture) — TipTap is a client-side dep only;
        // the wire is still the markdown-string field bind.
        pageChildren.Add(new SectionNode(
            Heading: "v8.2.0 Rich text probes",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                new RichTextFieldNode(
                    Name: "rich-text-state-probe",
                    Bind: "draftMarkdown",
                    Label: "Rich probe",
                    Placeholder: "Type something",
                    Toolbar: new RichTextToolbarNode(
                        Tools: new[] {
                            RichTextTool.Bold, RichTextTool.Italic, RichTextTool.Link,
                            RichTextTool.BulletList, RichTextTool.OrderedList,
                            RichTextTool.Heading1, RichTextTool.Heading2, RichTextTool.Heading3,
                            RichTextTool.InlineCode, RichTextTool.CodeBlock, RichTextTool.Blockquote
                        },
                        Size: RichTextToolbarSize.Expanded,
                        Tone: Tone.Info,
                        State: "active"),
                    State: "active"),
                new RichTextFieldNode(
                    Name: "rich-text-no-toolbar-probe",
                    Bind: "draftMarkdown",
                    Label: "Default toolbar probe"),
                new RichTextToolbarNode(
                    Tools: new[] { RichTextTool.Bold, RichTextTool.Italic }),
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
        // ── v9.1.0 ChatComposerNode probe (CHAT-15) ─────────────────────
        // Byte-identical to the bun/node twin chatComposerProbeSection.
        // State-driven emission of the Route B ChatComposerNode with each of
        // the 5 wire branches exercised by parity/fixtures/chat-composer.json
        // (Plan 30-07). Each branch is state-driven so a fixture step's
        // stateMutation-free POST (the handler mutates state) reaches EXACTLY
        // one branch. Per AGENTS.md gotcha #9 class-3 lesson: branches the
        // fixture never runs are invisible to a diff — the fixture asserts a
        // UNIQUE expectBodyContains substring per branch to prove it fired.
        //
        // Slots read from state:
        //   - ChatComposerDraft         → wire "bind":"chatComposerDraft" (always emitted)
        //   - ChatComposerStatus        → "streaming" → wire "status":"streaming"
        //   - ChatComposerHasStopAction → true → wire "stopAction":{"name":"chat-composer-stop"}
        //   - ChatComposerAttached      → true → HeaderSlot TextNode carrying tripwire text
        //   - ChatComposerDropScope     → "global" → wire "dropScope":"global"
        //   - ChatComposerSubmitMode    → "ctrl-enter" → wire "submitMode":"ctrl-enter"
        //
        // Design of record: .planning/phases/30-*/CONTEXT.md §Wire shape;
        // Plan 30-07 tasks 1-4. The CLIENT-SIDE render (unified pill container,
        // send-button state machine icon swap, IME guard, auto-resize
        // textarea, drag/drop/paste-image handlers) is browser-only and NOT
        // part of parity — parity proves only that the ChatComposerNode wire
        // serializes identically across backends.
        pageChildren.Add(new SectionNode(
            Heading: "v9.1.0 ChatComposer probe",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                new ChatComposerNode(
                    Bind: "chatComposerDraft",
                    SendAction: new ActionDescriptor("chat-composer-send"),
                    Placeholder: "Ask anything…",
                    // AttachAction ALWAYS present so branch (c)'s attach-related
                    // fields are emitted regardless of the fixture's toggle
                    // action — the toggle affects HeaderSlot, not AttachAction.
                    AttachAction: new ActionDescriptor("chat-composer-attach"),
                    DropScope: state.ChatComposerDropScope switch
                    {
                        "global" => ChatComposerDropScope.Global,
                        _ => null, // absent → composer default
                    },
                    Status: state.ChatComposerStatus switch
                    {
                        "sending" => ChatComposerStatus.Sending,
                        "streaming" => ChatComposerStatus.Streaming,
                        _ => null, // absent → idle default
                    },
                    StopAction: state.ChatComposerHasStopAction
                        ? new ActionDescriptor("chat-composer-stop")
                        : null,
                    SubmitMode: state.ChatComposerSubmitMode switch
                    {
                        "ctrl-enter" => ChatComposerSubmitMode.CtrlEnter,
                        _ => null, // absent → enter default
                    },
                    // HeaderSlot carries the branch (c) tripwire when the toggle
                    // action has flipped ChatComposerAttached true. The wire's
                    // attachment-preview chip strip is a CLIENT-SIDE render from
                    // the local File registry (not part of state), so the
                    // fixture's tripwire is a server-emitted TextNode carrying a
                    // UNIQUE substring that no other branch can produce. See
                    // AGENTS.md gotcha #9 class-3: "when a fixture step exists
                    // to cover a specific branch, name a substring only that
                    // branch emits."
                    HeaderSlot: state.ChatComposerAttached
                        ? new TextNode("ChatComposerAttached=true tripwire")
                        : null),
            }));

        // ── v9.2.0 TextNode.maxLines probe (Phase 31 / MAXLINES-PARITY) ───
        // Renders a single TextNode whose Value carries a UNIQUE marker text
        // per state slot value (unset/1/2/3) AND whose MaxLines emits the
        // exact wire literal ("maxLines":N when N∈{1,2,3}, ABSENT when unset).
        // The marker text gives the fixture's expectBodyContains a POSITIVE
        // branch-ran assertion; the "maxLines":N wire literal gives it a
        // second axis-value assertion. Both together defeat gotcha #9 class-3
        // ("branches the fixture never runs are invisible to the diff") AND
        // ride on the always-on findNulls invariant (parity/run.ts) that
        // catches gotcha #8 class-2 defects ("maxLines":null drift the diff's
        // normalize scrubs before comparing).
        //
        // MaxLines is an INIT-ONLY property OUTSIDE the primary ctor (see
        // Plan 31-02 rationale: preserves binary compat with pre-9.2.0
        // companion NuGets like Markdown 0.2.x whose packed IL references
        // the 7-param TextNode ctor). Construction MUST use
        // object-initializer syntax `{ MaxLines = ... }` — NOT the named-arg
        // syntax `new TextNode(..., MaxLines: N)`, which does not compile.
        //
        // Byte-parallel with the bun/node twin textNodeMaxLinesProbeSection.
        pageChildren.Add(new SectionNode(
            Heading: "Phase 31 TextNode.maxLines probe",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                new TextNode(
                    Value: $"TextNodeMaxLinesProbe={(string.IsNullOrEmpty(state.TextNodeMaxLinesProbe) ? "unset" : state.TextNodeMaxLinesProbe)}")
                {
                    MaxLines = state.TextNodeMaxLinesProbe switch
                    {
                        "1" => 1,
                        "2" => 2,
                        "3" => 3,
                        _ => null,
                    },
                },
            }));

        // ── Phase 32 filter wire-shape probe (column-filter parity) ───────────
        // Byte-parallel with bun/node twin filterWireShapeProbeSection.
        // State-driven emission of a TableNode whose first column carries
        // Filter=FilterSpec and FilterDescriptorBinds set to a probe path.
        // The section also carries a TextNode marker "FilterWireShapeProbe={value}"
        // so each fixture step's expectBodyContains can uniquely identify the branch.
        // Per AGENTS.md gotcha #9 class-3: branches the fixture never runs are
        // invisible to the byte-diff — the marker text provides a POSITIVE tripwire
        // per branch. The always-on findNulls invariant catches any null leakage
        // (class-2 gotcha #8 defect) — the is-empty rule's value field must be
        // ABSENT, not null, per SPEC Req 3 + null-omission contract.
        FilterDescriptor? wireShapeDescriptor = state.FilterWireShapeProbe switch
        {
            "one-rule-with-value" => new FilterDescriptor(
                Rules: new List<FilterRule> { new FilterRule("contains", Value: "hello") },
                Joiner: "all-of"),
            "one-rule-no-value" => new FilterDescriptor(
                Rules: new List<FilterRule> { new FilterRule("is-empty") },
                Joiner: "all-of"),
            "two-rules-any-of" => new FilterDescriptor(
                Rules: new List<FilterRule>
                {
                    new FilterRule("contains", Value: "error"),
                    new FilterRule("contains", Value: "warn"),
                },
                Joiner: "any-of"),
            "three-rules-all-of" => new FilterDescriptor(
                Rules: new List<FilterRule>
                {
                    new FilterRule("contains", Value: "open"),
                    new FilterRule("is-not-empty"),
                    new FilterRule("starts-with", Value: "ticket"),
                },
                Joiner: "all-of"),
            _ => null, // unset / base — no descriptor
        };

        var filterWireShapeProbeChildren = new List<ViewNode>
        {
            new TextNode($"FilterWireShapeProbe={(string.IsNullOrEmpty(state.FilterWireShapeProbe) ? "" : state.FilterWireShapeProbe)}"),
        };
        if (wireShapeDescriptor != null)
        {
            var wireShapeTable = new TableNode(
                Columns: new TableColumn[]
                {
                    new TableColumn("title", "Title",
                        Filter: new FilterSpec(Kind: "text")),
                },
                Rows: new TableRow[]
                {
                    new TableRow(new Dictionary<string, string> { ["title"] = "example row" }),
                },
                FilterDescriptorBinds: new Dictionary<string, string>
                {
                    ["title"] = "wireShapeDescriptor",
                });
            filterWireShapeProbeChildren.Add(wireShapeTable);
            // Render the descriptor as a hidden TextNode with the raw JSON so the
            // parity fixture can assert on the wire shape structure. Both backends
            // emit the descriptor via the standard JSON serializer through the
            // ShellResponse<T> → System.Text.Json path, so the emitted wire bytes
            // are byte-identical by construction when the field values match.
            // The fixture's expectBodyContains asserts substrings like "\"operator\":\"contains\""
            // directly against the raw response body — no need to navigate the tree.
        }
        pageChildren.Add(new SectionNode(
            Heading: "Phase 32 filter wire-shape probe",
            Variant: SectionVariant.Card,
            Children: filterWireShapeProbeChildren));

        // ── Phase 32 filter helper probe (column-filter parity) ───────────────
        // Byte-parallel with bun/node twin filterHelperProbeSection.
        // Renders a TextNode("FilterHelperProbeResult={result}") so the fixture
        // step's expectBodyContains can assert "FilterHelperProbeResult=true" or
        // "FilterHelperProbeResult=false". The result is populated by the
        // filter-helper-probe action arm (which calls FilterHelper.MatchesFilter).
        pageChildren.Add(new SectionNode(
            Heading: "Phase 32 filter helper probe",
            Variant: SectionVariant.Card,
            Children: new ViewNode[]
            {
                new TextNode($"FilterHelperProbeResult={state.FilterHelperProbeResult}"),
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
