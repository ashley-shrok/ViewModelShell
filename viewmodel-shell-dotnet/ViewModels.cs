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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Value = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Url = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Filename = null
)
{
    public static ShellSideEffect SetLocalStorage(string key, string value) =>
        new("set-local-storage", key, value);

    public static ShellSideEffect SetSessionStorage(string key, string value) =>
        new("set-session-storage", key, value);

    /// <summary>
    /// Server-decided authenticated file download. The shell fetches <paramref name="url"/>
    /// with ShellOptions.getRequestHeaders() merged (Bearer/anti-forgery/etc.), parses
    /// Content-Disposition + Content-Type, and saves via Adapter.saveFile. If the response
    /// has no Content-Disposition, <paramref name="filename"/> is used; otherwise the URL
    /// basename. A missing saveFile capability fails loud (no silent swallow).
    /// </summary>
    public static ShellSideEffect Download(string url, string? filename = null) =>
        new("download", Url: url, Filename: filename);
}

public record ShellResponse<TState>(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Vm,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] TState? State,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Redirect = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ShellSideEffect>? SideEffects = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? NextPollIn = null,
    // 0.14.0 — install / clear the browser's "warn before unload" guard. False
    // is the default and is dropped from the wire via WhenWritingDefault, so the
    // wire stays clean (the field only appears on responses where it matters).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool PreventUnload = false,
    // 0.16.0 — lock the UI (shell drops user dispatches; BrowserAdapter applies
    // .vms-busy → cursor:wait + pointer-events:none on interactive descendants).
    // Polls bypass so the server can clear the state. WhenWritingDefault drops
    // false from the wire.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Busy = false
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
[JsonDerivedType(typeof(ImageNode),      "image")]
[JsonDerivedType(typeof(CopyButtonNode), "copy-button")]
public abstract record ViewNode;

public record PageNode(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Title,
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Density = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Layout = null,
    // Page-shell max-width override (issue #13). null = default cap (--vms-page-max,
    // 1080px). "wide" = --vms-page-max-wide (1440px default). "full" = uncapped.
    // TUI ignores this — width caps are a browser concern.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Width = null
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
    // OPTIONAL since 0.10.0 (#15): omit for a form whose only triggers are
    // Buttons[]. Kept positional-but-nullable so existing positional call
    // sites (new FormNode(action, label, children)) compile unchanged.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? SubmitAction,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SubmitLabel,
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Layout = null,
    // Multi-action submit buttons (#15). Populate with ButtonNodes — each
    // harvests this form's fields into its action context, then dispatches.
    // Typed as IReadOnlyList<ViewNode> (not ButtonNode) so System.Text.Json
    // emits the polymorphic "type":"button" discriminator (it's only written
    // when serializing through the ViewNode base) — without it the wire would
    // drift from the TS backend, which always includes type. variant +
    // pendingLabel apply.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ViewNode>? Buttons = null
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Variant,
    // Transient label shown from click until dispatch resolves (issue #11).
    // Adapter additionally adds `.vms-button--pending` while pending so the
    // button visibly disables. Null = instant-click behavior (pre-0.8.0).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? PendingLabel = null
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

// Per-row multi-select metadata for TableNode. SelectedIds drives initial /
// pre-selected rows. Selection is LOCAL ONLY (0.15.0+): the adapter toggles
// the DOM + .vms-table__row--selected purely client-side; the server learns
// the selection only when a Buttons[] entry is clicked (the adapter harvests
// the checked rows and merges { selectedIds: [...] } into the button's action
// context). The earlier server-truth "Action" mode was removed because rapid
// clicks were silently dropped under the dispatch guard and the in-flight
// re-render wiped the visually-toggled checkbox — a latent foot-gun no app
// depended on.
// IReadOnlyList<ViewNode> for Buttons (NOT ButtonNode) so the polymorphic
// "type":"button" discriminator emits — the maintainer rule from 0.10.0/#15.
public record TableSelection(
    IReadOnlyList<string> SelectedIds,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ViewNode>? Buttons = null
);

// Server-driven pagination metadata for TableNode. The server slices Rows to the
// current page; the adapter only renders the "X–Y of N" range + prev/next from
// these numbers. Action is dispatched with merged { page } (target 1-based page).
public record TablePagination(
    int Page,
    int PageSize,
    int TotalRows,
    ActionDescriptor Action
);

public record TableNode(
    IReadOnlyList<TableColumn> Columns,
    IReadOnlyList<TableRow> Rows,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SortColumn = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SortDirection = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? SortAction = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? FilterAction = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] TableSelection? Selection = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] TablePagination? Pagination = null
) : ViewNode;

public record LinkNode(
    string Label,
    string Href,
    bool External = false
) : ViewNode;

// Image / media (issue #5). Src is required; Alt/Size/Shape are nullable wire
// optionals (the maintainer null-omission rule applies — absent, never null).
// Size ("small"/"medium"/"large"/"full") and Shape ("circle") are design-system
// hints → .vms-image--{size}/{shape}; non-browser adapters (TUI) degrade to Alt.
public record ImageNode(
    string Src,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Alt = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Size = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Shape = null
) : ViewNode;

public record CopyButtonNode(
    string Text,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CopiedLabel = null,
    // Visual variant (issue #14) — mirrors ButtonNode.Variant. Null = current
    // no-modifier behavior; "primary"/"secondary"/"danger" emit the same
    // .vms-button--{variant} class ButtonNode does.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Variant = null
) : ViewNode;
