namespace ViewModelShell.Controllers;

using Microsoft.AspNetCore.Mvc;
using ViewModelShell.State;
using ViewModelShell;
using ViewModelShell.Markdown;

[ApiController]
[Route("api/docs-viewer")]
public class DocsViewerController : ControllerBase
{
    // The browseable corpus. Held server-side because it's the app's
    // reference data — the state record only carries the current selection.
    // File paths resolve at request time so a doc file edit is reflected
    // immediately in dev.
    private static readonly IReadOnlyList<DocEntry> Corpus =
    [
        new("readme",        "ExampleLib README"),
        new("technical-doc", "Architecture Notes"),
        new("github-issue",  "Bug: cache returns stale entries"),
    ];

    [HttpGet]
    public ShellResponse<DocsViewerState> Get()
    {
        var state = DocsViewerState.Initial();
        return new ShellResponse<DocsViewerState>(BuildVm(state), state).Validate();
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<DocsViewerState>> Action()
    {
        var payload = ActionPayload<DocsViewerState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        var state = payload.State;
        var name = payload.Name;

        if (name.StartsWith("open-doc-"))
        {
            var id = name["open-doc-".Length..];
            state = state with { SelectedId = id };
        }
        else if (name == "back-to-list")
        {
            state = state with { SelectedId = null };
        }
        else
        {
            throw new UnknownActionException(name);
        }

        return new ShellResponse<DocsViewerState>(BuildVm(state), state).Validate();
    }

    private static ViewNode BuildVm(DocsViewerState state)
    {
        // Two views on the same shell: the picker (no doc selected) and the
        // reader (a doc selected). The reader loads the doc's markdown from
        // disk and hands it to MarkdownConverter — the entire rendered body
        // is a converter product, spread into PageNode.Children.
        return state.SelectedId is null
            ? BuildPicker()
            : BuildReader(state.SelectedId);
    }

    private static ViewNode BuildPicker()
    {
        // A list of docs; each item is a clickable ListItem whose action name
        // encodes the doc id (per the Phase-6 wire — no context).
        var items = Corpus
            .Select<DocEntry, ViewNode>(d => new ListItemNode(
                Id: $"doc-{d.Id}",
                State: null,
                Children:
                [
                    new SectionNode(
                        Heading: d.Title,
                        Children:
                        [
                            new ButtonNode(
                                Label: "Read",
                                Action: new ActionDescriptor($"open-doc-{d.Id}"))
                        ],
                        Action: new ActionDescriptor($"open-doc-{d.Id}"))
                ]))
            .ToArray();

        return new PageNode(
            Title: "Docs Viewer",
            Children:
            [
                new TextNode(
                    "Pick a doc — each is rendered end-to-end through the Markdown converter.",
                    Style: TextStyle.Muted),
                new ListNode(items),
            ]
        );
    }

    private static ViewNode BuildReader(string id)
    {
        var entry = Corpus.FirstOrDefault(d => d.Id == id);
        if (entry is null)
        {
            return new PageNode(
                Title: "Not found",
                Children:
                [
                    new TextNode($"Doc '{id}' is not in the corpus.", Tone: Tone.Danger),
                    new ButtonNode(
                        Label: "Back to list",
                        Action: new ActionDescriptor("back-to-list")),
                ]);
        }

        var md = ReadDoc(entry.Id);
        // Markdown -> ViewNode subtree, spread into the page's children.
        var body = MarkdownConverter.ToViewNodes(md);

        var children = new List<ViewNode>
        {
            new ButtonNode(
                Label: "← Back",
                Action: new ActionDescriptor("back-to-list")),
            new DividerNode(),
        };
        children.AddRange(body);

        return new PageNode(
            Title: entry.Title,
            Width: PageWidth.Wide,
            Children: children
        );
    }

    private static string ReadDoc(string id)
    {
        // Docs live next to the compiled binary via CopyToOutputDirectory in
        // the csproj. AppContext.BaseDirectory is the deployed location; this
        // works uniformly in dev, tests, and prod.
        var path = Path.Combine(AppContext.BaseDirectory, "docs", $"{id}.md");
        // Fully-qualified — inside a ControllerBase, bare `File` resolves to
        // ControllerBase.File(...), not System.IO.File.
        if (!System.IO.File.Exists(path)) return $"# Missing doc\n\nExpected `{path}` — not found.";
        return System.IO.File.ReadAllText(path);
    }
}
