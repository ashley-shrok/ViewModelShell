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
        new(label ?? name, new ActionDescriptor(name), Variant: null);

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
                NextAction: new ActionDescriptor("page-next")));
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
}
