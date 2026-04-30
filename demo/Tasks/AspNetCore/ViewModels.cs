using System.Text.Json;
using System.Text.Json.Serialization;

namespace ViewModelShell.ViewModels;

// ─── Action types ─────────────────────────────────────────────────────────────

public record ActionDescriptor(
    string Name,
    Dictionary<string, object>? Context = null
);

public record ActionPayload<TState>(
    string Name,
    Dictionary<string, JsonElement>? Context,
    TState State
)
{
    private static readonly JsonSerializerOptions _parseOpts =
        new() { PropertyNameCaseInsensitive = true };

    public static ActionPayload<TState> Parse(string actionJson, string stateJson)
    {
        var actionDoc = JsonSerializer.Deserialize<JsonElement>(actionJson, _parseOpts);
        var name = actionDoc.GetProperty("name").GetString()!;
        var context = actionDoc.TryGetProperty("context", out var ctxEl)
                      && ctxEl.ValueKind == JsonValueKind.Object
            ? ctxEl.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone())
            : null;
        var state = JsonSerializer.Deserialize<TState>(stateJson, _parseOpts)!;
        return new ActionPayload<TState>(name, context, state);
    }
}

public record ShellResponse<TState>(ViewNode Vm, TState State);

// ─── ViewNode hierarchy ───────────────────────────────────────────────────────

[JsonPolymorphic(TypeDiscriminatorPropertyName = "type")]
[JsonDerivedType(typeof(PageNode),     "page")]
[JsonDerivedType(typeof(SectionNode),  "section")]
[JsonDerivedType(typeof(ListNode),     "list")]
[JsonDerivedType(typeof(ListItemNode), "list-item")]
[JsonDerivedType(typeof(FormNode),     "form")]
[JsonDerivedType(typeof(FieldNode),    "field")]
[JsonDerivedType(typeof(CheckboxNode), "checkbox")]
[JsonDerivedType(typeof(ButtonNode),   "button")]
[JsonDerivedType(typeof(TextNode),     "text")]
[JsonDerivedType(typeof(StatBarNode),  "stat-bar")]
[JsonDerivedType(typeof(TabsNode),     "tabs")]
[JsonDerivedType(typeof(ProgressNode), "progress")]
[JsonDerivedType(typeof(ModalNode),    "modal")]
[JsonDerivedType(typeof(TableNode),    "table")]
[JsonDerivedType(typeof(LinkNode),     "link")]
public abstract record ViewNode;

public record PageNode(
    string? Title,
    IReadOnlyList<ViewNode> Children
) : ViewNode;

public record SectionNode(
    string? Heading,
    IReadOnlyList<ViewNode> Children
) : ViewNode;

public record ListNode(
    IReadOnlyList<ViewNode> Children,
    string? Id = null
) : ViewNode;

public record ListItemNode(
    string? Id,
    string? Variant,
    IReadOnlyList<ViewNode> Children
) : ViewNode;

public record FormNode(
    ActionDescriptor SubmitAction,
    string? SubmitLabel,
    IReadOnlyList<ViewNode> Children
) : ViewNode;

public record FieldOption(string Value, string Label);

public record FieldNode(
    string Name,
    string InputType,
    string? Label,
    string? Placeholder,
    string? Value,
    bool Required = false,
    ActionDescriptor? Action = null,
    IReadOnlyList<FieldOption>? Options = null
) : ViewNode;

public record CheckboxNode(
    string Name,
    bool Checked,
    string? Label,
    ActionDescriptor? Action
) : ViewNode;

public record ButtonNode(
    string Label,
    ActionDescriptor Action,
    string? Variant
) : ViewNode;

public record TextNode(
    string Value,
    string? Style
) : ViewNode;

public record StatItem(string Label, string Value);
public record StatBarNode(IReadOnlyList<StatItem> Stats) : ViewNode;

public record TabItem(string Value, string Label);
public record TabsNode(
    string Selected,
    ActionDescriptor Action,
    IReadOnlyList<TabItem> Tabs
) : ViewNode;

public record ProgressNode(int Value) : ViewNode;

public record ModalNode(
    string? Title,
    IReadOnlyList<ViewNode> Children,
    IReadOnlyList<ViewNode>? Footer = null,
    ActionDescriptor? DismissAction = null
) : ViewNode;

public record TableColumn(string Key, string Label, bool Sortable = false, bool Filterable = false, string? FilterValue = null, string? LinkLabel = null, bool LinkExternal = false);

public record TableRow(
    Dictionary<string, string> Cells,
    string? Id = null,
    ActionDescriptor? Action = null,
    string? Variant = null
);

public record TableNode(
    IReadOnlyList<TableColumn> Columns,
    IReadOnlyList<TableRow> Rows,
    string? SortColumn = null,
    string? SortDirection = null,
    ActionDescriptor? SortAction = null,
    ActionDescriptor? FilterAction = null
) : ViewNode;

public record LinkNode(
    string Label,
    string Href,
    bool External = false
) : ViewNode;
