// Phase 06 Plan 02 / WIRE-05 — .NET twin of viewmodel-shell/src/tree-walker.test.ts.
//
// Pure unit tests on ViewTreeValidation.ValidateActionNames: build minimal
// ViewNode trees, assert pass/fail with the same shape the TS suite uses.
// Mirrors the TS validator's coverage one-for-one (same 10 cases plus the
// same 3 bonus dispatch-site pins for FieldNode / CheckboxNode / ModalNode),
// and pins the ShellResponse<TState>.Validate() seam Plan 06-04 wires in.

namespace ViewModelShell.Tests;

using ViewModelShell;

public class ViewTreeValidationTests
{
    private static ButtonNode Btn(string name, string? label = null) =>
        new(label ?? name, new ActionDescriptor(name));

    private static PageNode Page(params ViewNode[] children) =>
        new(Title: null, Children: children);

    private static FormNode Form(string? submitName, params ViewNode[] children) =>
        new(
            SubmitAction: submitName is null ? null : new ActionDescriptor(submitName),
            SubmitLabel: null,
            Children: children);

    [Fact]
    public void Validate_UniqueActionNames_Passes()
    {
        var tree = Page(Btn("add"), Btn("clear"));
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Null(ex);
    }

    [Fact]
    public void Validate_SameName_SameForm_Passes()
    {
        // Canonical valid duplicate: top-of-form and bottom-of-form "Save" both
        // dispatching `save-ticket-42` against the same form instance.
        var saveTop = Btn("save-ticket-42", "Save top");
        var saveBottom = Btn("save-ticket-42", "Save bottom");
        var form = Form(submitName: null, saveTop, saveBottom);
        var tree = Page(form);
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Null(ex);
    }

    [Fact]
    public void Validate_SameName_DifferentForms_Throws()
    {
        var formA = Form("submit");
        var formB = Form("submit");
        var tree = Page(formA, formB);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'submit'", ex.Message);
    }

    [Fact]
    public void Validate_TopLevelAndFormInternal_SameName_Throws()
    {
        var topLevel = Btn("delete");
        var internalBtn = Btn("delete");
        var form = Form(submitName: null, internalBtn);
        var tree = Page(topLevel, form);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'delete'", ex.Message);
    }

    [Fact]
    public void Validate_PerTabUniqueNames_Passes()
    {
        var tabs = new TabsNode(
            Selected: "a",
            Bind: "filter",
            Tabs: new List<TabItem>
            {
                new("a", "A", new ActionDescriptor("select-tab-a")),
                new("b", "B", new ActionDescriptor("select-tab-b")),
                new("c", "C", new ActionDescriptor("select-tab-c")),
            });
        var tree = Page(tabs);
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Null(ex);
    }

    [Fact]
    public void Validate_PerTabDuplicateNames_Throws()
    {
        var tabs = new TabsNode(
            Selected: "a",
            Bind: "filter",
            Tabs: new List<TabItem>
            {
                new("a", "A", new ActionDescriptor("select-tab")),
                new("b", "B", new ActionDescriptor("select-tab")),
            });
        var tree = Page(tabs);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'select-tab'", ex.Message);
    }

    [Fact]
    public void Validate_PerRowActions_UniqueNames_Passes()
    {
        var table = new TableNode(
            Columns: new[] { new TableColumn("title", "Title") },
            Rows: new[]
            {
                new TableRow(
                    Cells: new Dictionary<string, string> { ["title"] = "Row 1" },
                    Id: "1",
                    Actions: new ViewNode[] { Btn("delete-row-1", "Delete") }),
                new TableRow(
                    Cells: new Dictionary<string, string> { ["title"] = "Row 2" },
                    Id: "2",
                    Actions: new ViewNode[] { Btn("delete-row-2", "Delete") }),
            });
        var tree = Page(table);
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Null(ex);
    }

    [Fact]
    public void Validate_PerRowActions_DuplicateNames_Throws()
    {
        // The canonical missing-row-id bug: per-row buttons all share the same
        // generic `delete-row` instead of `delete-row-{id}`. The strict
        // outside-form heuristic exists exactly to catch this.
        var table = new TableNode(
            Columns: new[] { new TableColumn("title", "Title") },
            Rows: new[]
            {
                new TableRow(
                    Cells: new Dictionary<string, string> { ["title"] = "Row 1" },
                    Id: "1",
                    Actions: new ViewNode[] { Btn("delete-row", "Delete") }),
                new TableRow(
                    Cells: new Dictionary<string, string> { ["title"] = "Row 2" },
                    Id: "2",
                    Actions: new ViewNode[] { Btn("delete-row", "Delete") }),
            });
        var tree = Page(table);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'delete-row'", ex.Message);
    }

    [Fact]
    public void Validate_FullTableWithSortFilterPagination_AllUnique_Passes()
    {
        var table = new TableNode(
            Columns: new[]
            {
                new TableColumn("title", "Title", Sortable: true),
                new TableColumn("date", "Date", Sortable: true),
            },
            Rows: Array.Empty<TableRow>(),
            SortBind: "sort",
            SortActions: new Dictionary<string, ActionDescriptor>
            {
                ["title"] = new("sort-by-title"),
                ["date"] = new("sort-by-date"),
            },
            FilterAction: new ActionDescriptor("apply-filter"),
            PaginationBind: "page",
            Pagination: new TablePagination(
                Page: 1,
                PageSize: 20,
                TotalRows: 100,
                PrevAction: new ActionDescriptor("page-prev"),
                NextAction: new ActionDescriptor("page-next"),
                JumpAction: new ActionDescriptor("page-jump")));
        var tree = Page(table);
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Null(ex);
    }

    [Fact]
    public void Validate_TwoTopLevelButtonsShareName_Throws()
    {
        // The strict-outside-form heuristic exists exactly to catch this — the
        // most common bug is per-row buttons that forgot to encode the row ID
        // in the action name. A looser heuristic would let it slip past.
        var tree = Page(Btn("delete"), Btn("delete"));
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'delete'", ex.Message);
    }

    // ─── Bonus dispatch-site pins (FieldNode / CheckboxNode / ModalNode) ─────
    // Same intent as the TS twin: a future refactor that drops one of these
    // walks should turn red here, not slip past the suite silently.

    [Fact]
    public void Validate_FieldNodeAction_CollidesWithTopLevelButton_Throws()
    {
        var field = new FieldNode(
            Name: "title",
            InputType: "text",
            Bind: "fields.title",
            Label: null,
            Placeholder: null,
            Action: new ActionDescriptor("commit"));
        var tree = Page(field, Btn("commit"));
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'commit'", ex.Message);
    }

    [Fact]
    public void Validate_CheckboxNodeAction_CollidesWithTopLevelButton_Throws()
    {
        var checkbox = new CheckboxNode(
            Name: "accept",
            Bind: "fields.accept",
            Label: null,
            Action: new ActionDescriptor("toggle"));
        var tree = Page(checkbox, Btn("toggle"));
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'toggle'", ex.Message);
    }

    [Fact]
    public void Validate_ModalDismissAction_CollidesWithTopLevelButton_Throws()
    {
        var modal = new ModalNode(
            Title: null,
            Children: Array.Empty<ViewNode>(),
            DismissAction: new ActionDescriptor("close"));
        var tree = Page(modal, Btn("close"));
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'close'", ex.Message);
    }

    [Fact]
    public void Validate_DuplicateActionName_AcrossFitsCandidates_Throws()
    {
        // FitsNode renders ONE candidate at runtime, but every candidate ships
        // on the wire — two candidates sharing an action name is the same
        // ambiguity rejected everywhere else. The walker must descend into fits.
        var fits = new FitsNode(new ViewNode[] { Btn("save"), Btn("save") });
        var tree = Page(fits);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'save'", ex.Message);
    }

    [Fact]
    public void Validate_ActionInsideFits_CollidesWithTopLevelButton_Throws()
    {
        var fits = new FitsNode(new ViewNode[] { Btn("delete") });
        var tree = Page(fits, Btn("delete"));
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'delete'", ex.Message);
    }

    // Direct verification that ShellResponse<TState>.Validate() invokes the
    // walker on the response's Vm — pins the controller-facing seam Plan 06-04
    // wires into every demo.
    private record TestState(string Filter);

    [Fact]
    public void ShellResponse_Validate_RunsTheWalker_OnDuplicate_Throws()
    {
        var tree = Page(Btn("delete"), Btn("delete"));
        var response = new ShellResponse<TestState>(tree, new TestState("all"));
        var ex = Assert.Throws<InvalidOperationException>(() => response.Validate());
        Assert.Contains("Duplicate action name 'delete'", ex.Message);
    }

    [Fact]
    public void ShellResponse_Validate_ReturnsSelf_OnValidTree()
    {
        var tree = Page(Btn("add"), Btn("clear"));
        var response = new ShellResponse<TestState>(tree, new TestState("all"));
        Assert.Same(response, response.Validate());
    }

    [Fact]
    public void ShellResponse_Validate_SkipsWalk_WhenVmIsNull()
    {
        // Redirect responses have no tree to walk; Validate() is a no-op.
        var response = ShellResponse<TestState>.RedirectTo("/dashboard");
        var ex = Record.Exception(() => response.Validate());
        Assert.Null(ex);
    }

    // ─── SectionNode.Action validation (issue #20 / 260614-9hq) ──────────────

    private static SectionNode Card(string? heading, ActionDescriptor? action, params ViewNode[] children) =>
        new(Heading: heading, Children: children, Action: action);

    [Fact]
    public void Validate_SectionAction_Plain_Passes()
    {
        var tree = Page(Card("Onboarding", new ActionDescriptor("select-card-1"),
            new TextNode("Welcome", null)));
        var ex = Record.Exception(() => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Null(ex);
    }

    [Fact]
    public void Validate_SectionAction_PlusCollapsible_Throws()
    {
        var section = new SectionNode(
            Heading: "Bad",
            Children: Array.Empty<ViewNode>(),
            Collapsible: true,
            Action: new ActionDescriptor("select-bad"));
        var tree = Page(section);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Contains("both Action and Collapsible: true", ex.Message);
        Assert.Contains("Bad", ex.Message);
    }

    [Fact]
    public void Validate_SectionAction_PlusCollapsible_HeadinglessLabel()
    {
        var section = new SectionNode(
            Heading: null,
            Children: Array.Empty<ViewNode>(),
            Collapsible: true,
            Action: new ActionDescriptor("select-bad"));
        var tree = Page(section);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Contains("(headingless)", ex.Message);
    }

    [Fact]
    public void Validate_SectionAction_Nested_Throws()
    {
        var inner = Card("Inner", new ActionDescriptor("select-inner"));
        var outer = Card("Outer", new ActionDescriptor("select-outer"), inner);
        var tree = Page(outer);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Contains("Nested SectionNode.Action", ex.Message);
        Assert.Contains("Outer", ex.Message);
        Assert.Contains("Inner", ex.Message);
    }

    [Fact]
    public void Validate_SectionAction_NestedThroughFits_Throws()
    {
        // Clickable inner card nested via a fits candidate inside a clickable
        // outer card — the walker must descend into fits children.
        var inner = Card("Inner", new ActionDescriptor("select-inner"));
        var fits = new FitsNode(new ViewNode[] { inner });
        var outer = Card("Outer", new ActionDescriptor("select-outer"), fits);
        var tree = Page(outer);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Contains("Nested SectionNode.Action", ex.Message);
    }

    [Fact]
    public void Validate_SectionAction_StylingOnlyInnerCard_Passes()
    {
        // Outer clickable card contains a styling-only Variant:"card" section
        // (no Action) with internal buttons. Locked decision: this is VALID.
        var innerStyling = new SectionNode(
            Heading: null,
            Children: new ViewNode[] { Btn("close-outer", "Close") },
            Variant: SectionVariant.Card);
        var outer = Card("Outer", new ActionDescriptor("select-outer"), innerStyling);
        var tree = Page(outer);
        var ex = Record.Exception(() => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Null(ex);
    }

    [Fact]
    public void ShellResponse_Validate_RunsSectionActionValidation()
    {
        // Confirm the ShellResponse<TState>.Validate() seam invokes
        // ValidateSectionAction on the response's Vm — same pattern as the
        // ValidateActionNames seam two facts above.
        var inner = Card("Inner", new ActionDescriptor("select-inner"));
        var outer = Card("Outer", new ActionDescriptor("select-outer"), inner);
        var tree = Page(outer);
        var response = new ShellResponse<TestState>(tree, new TestState("all"));
        var ex = Assert.Throws<InvalidOperationException>(() => response.Validate());
        Assert.Contains("Nested SectionNode.Action", ex.Message);
    }

    // ─── SectionNode.Link validation (issue #21 / 260614-bmd) ────────────────

    private static SectionNode LinkedCard(string? heading, SectionLink? link, params ViewNode[] children) =>
        new(Heading: heading, Children: children, Link: link);

    [Fact]
    public void Validate_SectionLink_Plain_Passes()
    {
        var tree = Page(LinkedCard("Read the docs", new SectionLink("https://example.com/docs", External: true),
            new TextNode("Architecture, gotchas, demos.", TextStyle.Muted)));
        var ex = Record.Exception(() => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Null(ex);
    }

    [Fact]
    public void Validate_SectionLink_PlusAction_Throws()
    {
        var section = new SectionNode(
            Heading: "Conflict",
            Children: Array.Empty<ViewNode>(),
            Action: new ActionDescriptor("dispatch-conflict"),
            Link: new SectionLink("https://example.com"));
        var tree = Page(section);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Contains("either a dispatcher (Action) or a navigator (Link)", ex.Message);
        Assert.Contains("Conflict", ex.Message);
    }

    [Fact]
    public void Validate_SectionLink_PlusCollapsible_Throws()
    {
        var section = new SectionNode(
            Heading: "BadCollapsible",
            Children: Array.Empty<ViewNode>(),
            Collapsible: true,
            Link: new SectionLink("https://example.com"));
        var tree = Page(section);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Contains("Link and Collapsible: true", ex.Message);
        Assert.Contains("BadCollapsible", ex.Message);
    }

    [Fact]
    public void Validate_SectionLink_NestedLinkInLink_Throws()
    {
        var inner = LinkedCard("Inner", new SectionLink("https://example.com/inner"));
        var outer = LinkedCard("Outer", new SectionLink("https://example.com/outer"), inner);
        var tree = Page(outer);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Contains("HTML5 prohibits nested", ex.Message);
        Assert.Contains("Outer", ex.Message);
        Assert.Contains("Inner", ex.Message);
    }

    [Fact]
    public void Validate_SectionLink_NestedLinkInAction_Throws()
    {
        var inner = LinkedCard("Inner", new SectionLink("https://example.com/inner"));
        var outer = Card("Outer", new ActionDescriptor("select-outer"), inner);
        var tree = Page(outer);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Contains("Click-ownership", ex.Message);
        Assert.Contains("Outer", ex.Message);
        Assert.Contains("Inner", ex.Message);
    }

    [Fact]
    public void Validate_SectionLink_NestedActionInLink_Throws()
    {
        var inner = Card("Inner", new ActionDescriptor("select-inner"));
        var outer = LinkedCard("Outer", new SectionLink("https://example.com/outer"), inner);
        var tree = Page(outer);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Contains("Click-ownership", ex.Message);
        Assert.Contains("Outer", ex.Message);
        Assert.Contains("Inner", ex.Message);
    }

    [Fact]
    public void Validate_SectionLink_StylingOnlyInnerCard_Passes()
    {
        // Linked outer card contains a styling-only Variant:"card" section
        // (no Action and no Link) with an internal button. Locked decision:
        // this is VALID.
        var innerStyling = new SectionNode(
            Heading: null,
            Children: new ViewNode[] { Btn("close-outer", "Close") },
            Variant: SectionVariant.Card);
        var outer = LinkedCard("Outer", new SectionLink("https://example.com"), innerStyling);
        var tree = Page(outer);
        var ex = Record.Exception(() => ViewTreeValidation.ValidateSectionAction(tree));
        Assert.Null(ex);
    }

    [Fact]
    public void Validate_SectionLink_ExternalDefaultsFalse()
    {
        // Record-shape pin: catches accidental default flips. Default ctor
        // sets External = false; explicit External: true sets true.
        Assert.False(new SectionLink("https://example.com").External);
        Assert.True(new SectionLink("https://example.com", External: true).External);
        Assert.Equal("https://example.com", new SectionLink("https://example.com").Url);
    }

    [Fact]
    public void ShellResponse_Validate_RunsSectionLinkValidation()
    {
        // Mirrors ShellResponse_Validate_RunsSectionActionValidation — confirms
        // the ShellResponse<TState>.Validate() seam runs the extended walk
        // (which catches the link-in-link case).
        var inner = LinkedCard("Inner", new SectionLink("https://example.com/inner"));
        var outer = LinkedCard("Outer", new SectionLink("https://example.com/outer"), inner);
        var tree = Page(outer);
        var response = new ShellResponse<TestState>(tree, new TestState("all"));
        var ex = Assert.Throws<InvalidOperationException>(() => response.Validate());
        Assert.Contains("HTML5 prohibits nested", ex.Message);
    }
}
