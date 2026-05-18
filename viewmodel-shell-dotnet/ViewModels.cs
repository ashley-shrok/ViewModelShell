using System.Text.Json;
using System.Text.Json.Serialization;

namespace ViewModelShell;

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

    /// <summary>
    /// Parses a flat JSON body shaped { "name": "...", "context": {...}, "state": {...} }.
    /// Use this when a controller accepts application/json alongside multipart/form-data —
    /// removes the two-layer escaping that multipart requires and makes curl/agent callers ergonomic.
    /// </summary>
    public static ActionPayload<TState> ParseJson(string jsonBody)
    {
        var root = JsonSerializer.Deserialize<JsonElement>(jsonBody, _parseOpts);
        var name = root.GetProperty("name").GetString()!;
        var context = root.TryGetProperty("context", out var ctxEl)
                      && ctxEl.ValueKind == JsonValueKind.Object
            ? ctxEl.EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone())
            : null;
        var state = root.TryGetProperty("state", out var stateEl)
            ? JsonSerializer.Deserialize<TState>(stateEl.GetRawText(), _parseOpts)!
            : default!;
        return new ActionPayload<TState>(name, context, state);
    }
}

public record ShellSideEffect(string Type, string? Key = null, string? Value = null)
{
    public static ShellSideEffect SetLocalStorage(string key, string value) =>
        new("set-local-storage", key, value);

    public static ShellSideEffect SetSessionStorage(string key, string value) =>
        new("set-session-storage", key, value);
}

public record ShellResponse<TState>(
    ViewNode? Vm,
    TState? State,
    string? Redirect = null,
    IReadOnlyList<ShellSideEffect>? SideEffects = null,
    int? NextPollIn = null
)
{
    public static ShellResponse<TState> RedirectTo(string url) =>
        new(null, default, url);

    public ShellResponse<TState> WithEffect(ShellSideEffect effect) =>
        this with { SideEffects = [.. (SideEffects ?? []), effect] };
}

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
[JsonDerivedType(typeof(LinkNode),       "link")]
[JsonDerivedType(typeof(CopyButtonNode), "copy-button")]
public abstract record ViewNode;

public record PageNode(
    string? Title,
    IReadOnlyList<ViewNode> Children,
    string? Density = null,
    string? Layout = null
) : ViewNode;

public record SectionNode(
    string? Heading,
    IReadOnlyList<ViewNode> Children,
    string? Variant = null,
    string? Layout = null
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
    IReadOnlyList<ViewNode> Children,
    string? Layout = null
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
    IReadOnlyList<FieldOption>? Options = null,
    string? Language = null
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
    ActionDescriptor? DismissAction = null,
    string? Size = null
) : ViewNode;

public record TableColumn(
    string Key,
    string Label,
    bool Sortable = false,
    bool Filterable = false,
    string? FilterValue = null,
    string? LinkLabel = null,
    bool LinkExternal = false
);

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

public record CopyButtonNode(
    string Text,
    string? Label = null,
    string? CopiedLabel = null
) : ViewNode;
