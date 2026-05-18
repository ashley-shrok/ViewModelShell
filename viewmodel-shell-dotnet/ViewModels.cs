using System.Text.Json;
using System.Text.Json.Serialization;

namespace ViewModelShell;

// ─────────────────────────────────────────────────────────────────────────────
// WIRE CONTRACT — null omission is INTRINSIC to these types.
//
// Every nullable (T?) member of an outbound wire record carries
//   [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
// so the contract — "an unset optional is ABSENT, never \"field\": null" —
// holds even under default ASP.NET JsonSerializerOptions with NO
// DefaultIgnoreCondition configured. The host-side
// DefaultIgnoreCondition = WhenWritingNull in Program.cs is now redundant
// defense-in-depth, not load-bearing (it cannot be forgotten per-app).
//
// Maintainer rule: a NEW nullable field WITHOUT this attribute silently
// re-introduces the cross-backend null-vs-absent drift this exists to kill.
// Non-nullable members (incl. bool/int with semantic defaults) deliberately
// keep serializing their value. JsonIgnoreAttribute is sealed — it cannot be
// wrapped in a shorter alias; the attribute is spelled out in full on purpose.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Action types ─────────────────────────────────────────────────────────────

public record ActionDescriptor(
    string Name,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Dictionary<string, object>? Context = null
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

public record ShellSideEffect(
    string Type,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Key = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Value = null
)
{
    public static ShellSideEffect SetLocalStorage(string key, string value) =>
        new("set-local-storage", key, value);

    public static ShellSideEffect SetSessionStorage(string key, string value) =>
        new("set-session-storage", key, value);
}

public record ShellResponse<TState>(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Vm,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] TState? State,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Redirect = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ShellSideEffect>? SideEffects = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? NextPollIn = null
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Title,
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Density = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Layout = null
) : ViewNode;

public record SectionNode(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Heading,
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Variant = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Layout = null
) : ViewNode;

public record ListNode(
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Id = null
) : ViewNode;

public record ListItemNode(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Id,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Variant,
    IReadOnlyList<ViewNode> Children
) : ViewNode;

public record FormNode(
    ActionDescriptor SubmitAction,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SubmitLabel,
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Layout = null
) : ViewNode;

public record FieldOption(string Value, string Label);

public record FieldNode(
    string Name,
    string InputType,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Placeholder,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Value,
    bool Required = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<FieldOption>? Options = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Language = null
) : ViewNode;

public record CheckboxNode(
    string Name,
    bool Checked,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action
) : ViewNode;

public record ButtonNode(
    string Label,
    ActionDescriptor Action,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Variant
) : ViewNode;

public record TextNode(
    string Value,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Style
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Title,
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ViewNode>? Footer = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? DismissAction = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Size = null
) : ViewNode;

public record TableColumn(
    string Key,
    string Label,
    bool Sortable = false,
    bool Filterable = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? FilterValue = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? LinkLabel = null,
    bool LinkExternal = false
);

public record TableRow(
    Dictionary<string, string> Cells,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Id = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Variant = null
);

public record TableNode(
    IReadOnlyList<TableColumn> Columns,
    IReadOnlyList<TableRow> Rows,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SortColumn = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SortDirection = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? SortAction = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? FilterAction = null
) : ViewNode;

public record LinkNode(
    string Label,
    string Href,
    bool External = false
) : ViewNode;

public record CopyButtonNode(
    string Text,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CopiedLabel = null
) : ViewNode;
