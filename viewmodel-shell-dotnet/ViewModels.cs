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

public record ActionDescriptor(string Name);

public record ActionPayload<TState>(
    string Name,
    TState State
)
{
    private static readonly JsonSerializerOptions _parseOpts =
        new() { PropertyNameCaseInsensitive = true };

    public static ActionPayload<TState> Parse(string actionJson, string stateJson)
    {
        var actionDoc = JsonSerializer.Deserialize<JsonElement>(actionJson, _parseOpts);
        var name = actionDoc.GetProperty("name").GetString()!;
        var state = JsonSerializer.Deserialize<TState>(stateJson, _parseOpts)!;
        return new ActionPayload<TState>(name, state);
    }

    /// <summary>
    /// Parses a flat JSON body shaped { "name": "...", "state": {...} }.
    /// Use this when a controller accepts application/json alongside multipart/form-data —
    /// removes the two-layer escaping that multipart requires and makes curl/agent callers ergonomic.
    /// </summary>
    public static ActionPayload<TState> ParseJson(string jsonBody)
    {
        var root = JsonSerializer.Deserialize<JsonElement>(jsonBody, _parseOpts);
        var name = root.GetProperty("name").GetString()!;
        var state = root.TryGetProperty("state", out var stateEl)
            ? JsonSerializer.Deserialize<TState>(stateEl.GetRawText(), _parseOpts)!
            : default!;
        return new ActionPayload<TState>(name, state);
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

/// <summary>
/// The entry shape inside the <c>errors[]</c> array of an <c>ok: false</c>
/// response envelope. <c>Path</c> and <c>Code</c> are optional — absent (not null)
/// when not applicable, per the WhenWritingNull null-omission contract.
/// </summary>
public record ErrorEntry(
    string Message,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Path = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Code = null
);

/// <summary>
/// A SOFT (domain/validation) rejection that rides on an <c>ok:true</c> render
/// (see <see cref="ShellResponse{TState}.Rejected"/>). Distinct from the
/// <c>ok:false</c> + <c>errors[]</c> failure channel, which carries NO view:
/// <c>ok:false</c> = "no view for you"; <c>ok:true</c> + <c>rejected</c> =
/// "here's your view back, but the action did not take." Each violation reuses
/// the <see cref="ErrorEntry"/> shape; <c>Path</c> is optional — a violation
/// with no path is a form/action-level rejection (vs field-bound when set).
/// </summary>
public record ShellRejection(
    IReadOnlyList<ErrorEntry> Violations
);

/// <summary>
/// Stable, framework-only error code vocabulary. Apps MUST NOT set these —
/// the framework sets <c>code</c> on framework-detected failures only.
/// D-03 lock: "small, stable, framework-only set." Mirrors the TS twin's
/// <c>ERR_CODES</c> so both backends are byte-aligned on the wire.
/// </summary>
public static class ErrorCodes
{
    /// <summary>Malformed / unparseable request body. HTTP 400.</summary>
    public const string Parse = "parse_error";
    /// <summary>App threw <see cref="UnknownActionException"/> (action name not recognised). HTTP 400.</summary>
    public const string UnknownAction = "unknown_action";
    /// <summary>Built view tree violates the action-name uniqueness rule. HTTP 500.</summary>
    public const string InvalidTree = "invalid_tree";
    /// <summary>App handler threw an unrecognised exception. HTTP 500.</summary>
    public const string Uncaught = "uncaught_exception";
}

/// <summary>
/// Framework-owned error response envelope. The <c>ok</c> property is
/// <c>false</c> by default so construction sites are self-documenting.
/// Apps do NOT supply this record — the framework constructs it from caught
/// exceptions at the response edge (D-06).
/// </summary>
public record ShellErrorResponse(
    IReadOnlyList<ErrorEntry> Errors,
    bool Ok = false
)
{
    /// <summary>Malformed / unparseable request body. HTTP 400.</summary>
    public static ShellErrorResponse OfParseError(string message) =>
        new([new ErrorEntry(message, Code: ErrorCodes.Parse)]);

    /// <summary>
    /// Structurally invalid request the user can't see. HTTP 400.
    /// No <c>code</c> per D-08 (reserved for framework-classified failures).
    /// </summary>
    public static ShellErrorResponse OfBadRequest(string message) =>
        new([new ErrorEntry(message)]);

    /// <summary>App threw <see cref="UnknownActionException"/>. HTTP 400.</summary>
    public static ShellErrorResponse OfUnknownAction(string actionName) =>
        new([new ErrorEntry($"Unknown action: {actionName}", Code: ErrorCodes.UnknownAction)]);

    /// <summary>Built view tree violates the action-name uniqueness rule. HTTP 500.</summary>
    public static ShellErrorResponse OfInvalidTree(string message) =>
        new([new ErrorEntry(message, Code: ErrorCodes.InvalidTree)]);

    /// <summary>
    /// App handler threw an unrecognised exception. HTTP 500.
    /// T1 info-disclosure mitigation: reads ONLY <see cref="Exception.Message"/> —
    /// never <see cref="Exception.ToString()"/>, <see cref="Exception.StackTrace"/>,
    /// or <see cref="Exception.GetType()"/>.<see cref="Type.FullName"/>. Stack traces and
    /// internal type names never reach the wire.
    /// </summary>
    public static ShellErrorResponse OfUncaught(Exception ex) =>
        new([new ErrorEntry(ex.Message, Code: ErrorCodes.Uncaught)]);
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Busy = false,
    // Phase 07 / ERROR-01 — every successful response carries ok:true on the
    // wire. Set by the framework at the response edge — controllers / app handlers
    // do NOT set this. Non-nullable with default true; deliberately does NOT carry
    // WhenWritingDefault so it serializes on EVERY response (per D-04: "uniform on
    // every response, no per-shape conditionals").
    bool Ok = true,
    // A soft (domain/validation) rejection that rides on an ok:true render — the
    // action was refused but Vm/State are still returned so the form keeps the
    // user's input. Distinct from the ok:false + errors[] channel (no view).
    // App-driven (controllers set it via WithRejection); nullable so the wire
    // stays absent when there's no rejection.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ShellRejection? Rejected = null
)
{
    public static ShellResponse<TState> RedirectTo(string url) =>
        new(null, default, url);

    public ShellResponse<TState> WithEffect(ShellSideEffect effect) =>
        this with { SideEffects = [.. (SideEffects ?? []), effect] };

    /// <summary>
    /// Attach a soft-validation rejection to this re-render. Unlike a redirect,
    /// a rejection KEEPS Vm/State so the form retains the user's input. Mirrors
    /// the TS `shellRejection(...)` helper.
    /// </summary>
    public ShellResponse<TState> WithRejection(IReadOnlyList<ErrorEntry> violations) =>
        this with { Rejected = new ShellRejection(violations) };

    /// <summary>
    /// Phase 06 / WIRE-05 — assert the response's ViewNode tree satisfies the
    /// action-name uniqueness rule ("one action name = one operation") before
    /// the response leaves the controller. Fluent: returns the same instance
    /// so it can chain (`return new ShellResponse&lt;T&gt;(...).Validate();`).
    /// </summary>
    /// <remarks>
    /// Plan 06-04 wires this into every demo controller's return path. Until
    /// then, controllers MUST call <c>.Validate()</c> on responses they build,
    /// or the uniqueness check is skipped on the .NET backend. (The TS server
    /// subpath runs the equivalent check automatically in <c>createAction</c>.)
    ///
    /// Skipped silently when <see cref="Vm"/> is null (redirect responses have
    /// no tree to walk).
    /// </remarks>
    /// <exception cref="InvalidOperationException">
    /// Thrown by <see cref="ViewTreeValidation.ValidateActionNames"/> when a
    /// duplicate action name is found.
    /// </exception>
    public ShellResponse<TState> Validate()
    {
        if (Vm is not null)
        {
            ViewTreeValidation.ValidateActionNames(Vm);
            // 1.3.0 — SectionNode.Action shape checks (rejects action+collapsible
            // on the same section and nested action-in-action). Mirrors the
            // ValidateActionNames seam — InvalidOperationException → invalid_tree.
            ViewTreeValidation.ValidateSectionAction(Vm);
        }
        return this;
    }
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
    // Layout preset arranging direct children — free-form string mirroring the
    // TS closed union "stack"|"split"|"cards"|"sidebar"|"row"|"switcher" (1.13.0
    // added "switcher": N equal items flipping all-row ↔ all-stack atomically
    // at a content-width threshold — the negative-flex-basis primitive a grid
    // cannot express). Omitted or "stack" = vertical flow (no modifier class);
    // any other value emits .vms-page--{value}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Layout = null,
    // Page-shell max-width override (issue #13). null = default cap (--vms-page-max,
    // 1080px). "wide" = --vms-page-max-wide (1440px default). "full" = uncapped.
    // TUI ignores this — width caps are a browser concern.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Width = null,
    // 1.12.0 — main-axis arrangement for layout:"row" (the cluster primitive) —
    // maps to justify-content. Free-form string mirroring the TS closed union
    // "start"|"center"|"end"|"space-between"|"space-around"|"space-evenly"
    // (Jetpack Compose Arrangement ∩ Flutter MainAxisAlignment; ALIGN-01). The
    // closed union is enforced on the TS side and validated by parity, matching
    // the Layout field's pattern. Omitted = no class → row default (flex-start,
    // left-pack) holds = byte-identical to today; any value emits
    // .vms-arrange--{value}. JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Arrange = null,
    // 1.12.0 — cross-axis alignment for layout:"row" — maps to align-items.
    // Free-form string mirroring the TS closed union
    // "start"|"center"|"end"|"stretch"|"baseline" (Flutter CrossAxisAlignment;
    // ALIGN-02). Omitted = no class → row default (center) holds = byte-identical
    // to today; any value emits .vms-align--{value}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Align = null,
    // 1.13.0 — switcher flip width for layout:"switcher". Free-form string
    // mirroring the TS closed union "sm"|"md"|"lg"|"xl" (closed union enforced
    // on the TS side + validated by parity, matching the Layout field's
    // pattern). The locked size scale → CSS rem (sm→20rem, md→30rem, lg→40rem,
    // xl→48rem). Omitted = no class → the var(--vms-switch-threshold, 30rem) CSS
    // default (30rem) holds; any value emits .vms-switch--{value} which sets
    // --vms-switch-threshold. JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Threshold = null,
    // 1.13.0 — switcher max-per-row count cap for layout:"switcher". int?
    // mirroring the TS bounded numeric union 2..8 (bounded scalar, not raw CSS,
    // per P2; the bound is enforced on the TS side + validated by parity). Once
    // the child count exceeds Limit every child goes full-width regardless of
    // container width. Omitted = no class → no count cap; any value emits
    // .vms-switch-limit--{n}. JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Limit = null
) : ViewNode;

// 1.4.0 — SectionNode.Link URL-wrapper variant of the clickable-card primitive
// (issue #21). Nested record (`{ Url, External }`) matches the TS shape exactly
// — `link?: { url, external? }`. External is non-nullable bool defaulting to
// false; same wire posture as LinkNode.External (serializes as "external":
// false when defaulted). Url is required, non-nullable, must be non-empty
// (the renderer trusts it as `<a href={Url}>`); validation is the caller's
// responsibility because empty URLs render as anchors-without-href which
// browsers treat as styling-only — semantically wrong, but not a tree-shape bug.
public record SectionLink(string Url, bool External = false);

public record SectionNode(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Heading,
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Variant = null,
    // Layout preset arranging direct children — free-form string mirroring the
    // TS closed union "stack"|"split"|"cards"|"sidebar"|"row"|"switcher" (1.11.0
    // added "row": a left-aligned wrapping horizontal row, items hug content;
    // 1.13.0 added "switcher": N equal items flipping all-row ↔ all-stack
    // atomically at a content-width threshold — the negative-flex-basis primitive
    // a grid cannot express). Omitted or "stack" = vertical flow (no modifier
    // class); any other value emits .vms-section--{value}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Layout = null,
    // 1.2.0 — client-side disclosure widget. true = renderer emits
    // <details>/<summary> (closed by default; open state DOM-local and
    // preserved across re-renders by the browser adapter). Omitted/false =
    // today's <section> rendering, byte-identical. Server does NOT
    // round-trip the open state — same posture as draft form text.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Collapsible = null,
    // 1.2.0 — optional stable preservation key for the renderer's open-state
    // snapshot when Collapsible:true. Provide when Heading isn't unique
    // within a page or is absent; otherwise the renderer falls back to
    // Heading ?? "vms-section-anon" disambiguated by per-render ordinal.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Id = null,
    // 1.3.0 — click-anywhere clickable-card primitive. Mirrors TableRow.Action
    // (1.1.0) at the section level. When set, the BrowserAdapter makes the
    // whole section clickable (click + keyboard Enter/Space + role="button" +
    // tabindex=0 + aria-label) and stops propagation on nested interactive
    // controls (Button/Checkbox/Link) so they don't double-fire. Tree
    // validation (ViewTreeValidation.ValidateSectionAction, invoked by
    // ShellResponse<TState>.Validate()) rejects four invalid combos with
    // invalid_tree (extended in 1.4.0 with SectionNode.Link rules):
    //   (a) Action + Collapsible:true on the same section.
    //   (b) Action + Link on the same section (issue #21 — dispatcher OR navigator, never both).
    //   (c) Link + Collapsible:true on the same section.
    //   (d) Action / Link nested inside another section with Action / Link
    //       (HTML5 nested-<a> prohibition + click-ownership ambiguity).
    // A styling-only Variant:"card" section (no Action and no Link) inside
    // a clickable or linked card is valid. JsonIgnore-on-null per the
    // file-header maintainer rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null,
    // 1.4.0 — URL-wrapper navigator variant of the clickable-card primitive
    // (issue #21). When set, the BrowserAdapter emits a wrapping <a href={Url}>
    // element so every native browser link affordance works for free
    // (middle-click, Ctrl/Cmd-click, right-click context menu, drag-to-bookmarks,
    // status-bar URL preview, accessible link semantics). External:true adds
    // target="_blank" + rel="noopener noreferrer". Clicks on nested
    // Button/Checkbox/Field/Link controls stop propagation so they don't
    // navigate the wrapper. Tree validation rejects Action+Link, Link+Collapsible,
    // link-in-link, and mixed link/action nesting (see the Action TSDoc above for
    // the full set of rejections). JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] SectionLink? Link = null,
    // 1.11.0 — overlay disclosure ("flyout"), the hover/focus sibling of
    // Collapsible's inline <details> reveal. true = the BrowserAdapter emits a
    // <div class="vms-section--flyout"> whose Heading becomes a focusable
    // <button class="vms-section__trigger"> and whose Children are wrapped in an
    // absolutely-positioned <div class="vms-section__panel"> revealed on
    // :hover/:focus-within (pure CSS — no JS, no round-tripped open state).
    // Headingless flyout uses the trigger label "Menu". Mutually exclusive with
    // the other section modes; the renderer resolves a fixed precedence and never
    // combines them: Collapsible > Flyout > Link > Action. Omitted/false =
    // today's <section> rendering, byte-identical. JsonIgnore-on-null per the
    // file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Flyout = null,
    // 1.12.0 — main-axis arrangement for layout:"row" (the cluster primitive) —
    // maps to justify-content. Free-form string mirroring the TS closed union
    // "start"|"center"|"end"|"space-between"|"space-around"|"space-evenly"
    // (Jetpack Compose Arrangement ∩ Flutter MainAxisAlignment; ALIGN-01). The
    // closed union is enforced on the TS side and validated by parity, matching
    // the Layout field's pattern. Omitted = no class → row default (flex-start,
    // left-pack) holds = byte-identical to today; any value emits
    // .vms-arrange--{value}. JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Arrange = null,
    // 1.12.0 — cross-axis alignment for layout:"row" — maps to align-items.
    // Free-form string mirroring the TS closed union
    // "start"|"center"|"end"|"stretch"|"baseline" (Flutter CrossAxisAlignment;
    // ALIGN-02). Omitted = no class → row default (center) holds = byte-identical
    // to today; any value emits .vms-align--{value}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Align = null,
    // 1.13.0 — switcher flip width for layout:"switcher". Free-form string
    // mirroring the TS closed union "sm"|"md"|"lg"|"xl" (closed union enforced
    // on the TS side + validated by parity, matching the Layout field's
    // pattern). The locked size scale → CSS rem (sm→20rem, md→30rem, lg→40rem,
    // xl→48rem). Omitted = no class → the var(--vms-switch-threshold, 30rem) CSS
    // default (30rem) holds; any value emits .vms-switch--{value} which sets
    // --vms-switch-threshold. JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Threshold = null,
    // 1.13.0 — switcher max-per-row count cap for layout:"switcher". int?
    // mirroring the TS bounded numeric union 2..8 (bounded scalar, not raw CSS,
    // per P2; the bound is enforced on the TS side + validated by parity). Once
    // the child count exceeds Limit every child goes full-width regardless of
    // container width. Omitted = no class → no count cap; any value emits
    // .vms-switch-limit--{n}. JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Limit = null
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
    // dispatches its declared action by name on activation. Field values
    // live in state at each input's bind path and travel with the dispatch's
    // _state payload; the action carries no harvested context. Mirrors
    // HTML's multiple submit buttons / formaction. A plain ButtonNode placed
    // in Children has identical dispatch semantics; the Buttons[] slot is a
    // layout hint. variant + pendingLabel apply.
    // Typed as IReadOnlyList<ViewNode> (not ButtonNode) so System.Text.Json
    // emits the polymorphic "type":"button" discriminator (it's only written
    // when serializing through the ViewNode base) — without it the wire would
    // drift from the TS backend, which always includes type.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ViewNode>? Buttons = null,
    // Opt-in: bare Enter inside a descendant textarea dispatches SubmitAction
    // (chat-composer "Enter sends, Shift/Ctrl/Meta/Alt+Enter = newline"). No-op
    // when SubmitAction is null or during IME composition. Renderer-handled on
    // the client; the action envelope is unchanged. Nullable so the wire stays
    // absent when unset.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? SubmitOnEnter = null
) : ViewNode;

public record FieldOption(string Value, string Label);

public record FieldNode(
    string Name,
    string InputType,
    /// <summary>Path into state where this input reads its current value and writes user changes (e.g. "fields.title").</summary>
    string Bind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Placeholder,
    bool Required = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<FieldOption>? Options = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Language = null
) : ViewNode;

public record CheckboxNode(
    string Name,
    /// <summary>Path into state where this input reads its current value and writes user changes (e.g. "fields.acceptedTos").</summary>
    string Bind,
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

public record TabItem(string Value, string Label, ActionDescriptor Action);
public record TabsNode(
    string Selected,
    /// <summary>Path into state where this input reads its current value and writes user changes (e.g. "filter").</summary>
    string Bind,
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
    // Per-row interactive controls. Each entry is either a ButtonNode (with its
    // own unique action name, e.g. delete-row-42) or a CheckboxNode (with its
    // own per-row bind path).
    // Typed as IReadOnlyList<ViewNode> (not the closed TS union) so
    // System.Text.Json emits the polymorphic "type":"button"|"checkbox"
    // discriminator on the wire — the same maintainer rule as FormNode.Buttons.
    // The renderer partitions by entry.type: CheckboxNodes render in a dedicated
    // LEADING column (left — the data-grid selection convention), ButtonNodes in
    // the TRAILING actions cell (right).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ViewNode>? Actions = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Variant = null,
    // Click-anywhere row dispatch primitive. When set, the renderer makes the
    // entire row clickable AND keyboard-activatable (Enter / Space — Space
    // preventDefaults page scroll) AND exposes accessibility (role="button",
    // tabindex=0, aria-label derived from cell text). Per-row identity is
    // encoded in the action name (e.g. select-ticket-42). Coexists with
    // Actions: clicking a per-row button, checkbox, or cell linkLabel anchor
    // does NOT also fire Action (the renderer stops propagation on those
    // targets). Nullable wire field — carries the JsonIgnore-when-null
    // maintainer rule from the file header.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null
);

// Server-driven pagination metadata for TableNode. The server slices Rows to the
// current page; the adapter only renders the "X–Y of N" range + prev/next from
// these numbers. PrevAction/NextAction are unique-named — the renderer writes
// the target page number to TableNode.PaginationBind in state before dispatch.
public record TablePagination(
    int Page,
    int PageSize,
    int TotalRows,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? PrevAction = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? NextAction = null
);

public record TableNode(
    IReadOnlyList<TableColumn> Columns,
    IReadOnlyList<TableRow> Rows,
    /// <summary>Path into state where the current sort intent ({column, direction}) is read/written.</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SortBind = null,
    /// <summary>Per-column filter input bind paths — the renderer reads/writes filter values at these paths.</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Dictionary<string, string>? FilterBinds = null,
    /// <summary>Path into state where the renderer writes the target page number before firing Pagination.PrevAction / NextAction.</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? PaginationBind = null,
    /// <summary>Per-column sort header click actions, keyed by column key. Each carries a unique action name.</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Dictionary<string, ActionDescriptor>? SortActions = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? FilterAction = null,
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

// ─── Action-name uniqueness check (Phase 06 / WIRE-05) ───────────────────────
//
// Mirrors viewmodel-shell/src/server.ts `validateActionNames` byte-for-byte:
// walks a built ViewNode tree, collects every dispatch-bearing action with its
// enclosing FormNode reference, and throws when two occurrences of the same
// action name don't share the same non-null enclosing form.
//
// The strict heuristic outside forms is intentional: the most common bug class
// this exists to catch is per-row buttons that forgot to encode the row ID in
// the action name (`delete-row` repeated instead of `delete-row-42`). A looser
// "same name = same operation" heuristic would let that bug slip past.
//
// Invocation: controllers call ShellResponse<TState>.Validate() before
// returning. Plan 06-04 wires this into every demo controller's return path.
public static class ViewTreeValidation
{
    /// <summary>
    /// Walk a ViewNode tree and assert that every dispatch-bearing action name
    /// names exactly one operation. Two occurrences are considered the same
    /// operation iff they share the same enclosing FormNode reference; any
    /// other duplicate is a violation.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// Thrown when a duplicate action name is found. The message names the
    /// colliding action and suggests the two fixes (rename one node, or move
    /// both into the same enclosing form).
    /// </exception>
    public static void ValidateActionNames(ViewNode root)
    {
        var occurrences = new List<(string Name, FormNode? EnclosingForm)>();
        Collect(root, null, occurrences);

        var groups = occurrences
            .GroupBy(o => o.Name)
            .Where(g => g.Count() >= 2);

        foreach (var group in groups)
        {
            var first = group.First().EnclosingForm;
            // Allowed iff every occurrence is inside the SAME non-null form
            // (reference equality).
            var allInSameForm = first is not null
                && group.All(o => ReferenceEquals(o.EnclosingForm, first));
            if (!allInSameForm)
            {
                throw new InvalidOperationException(
                    $"Duplicate action name '{group.Key}' dispatched from semantically distinct nodes. " +
                    "Each action name must name exactly one operation. Either rename one of the " +
                    $"nodes (e.g. '{group.Key}-X' / '{group.Key}-Y') or move them into the same surrounding " +
                    "form if they are intended to fire the same operation.");
            }
        }
    }

    /// <summary>
    /// Walk a ViewNode tree and reject five invalid SectionNode.Action / .Link
    /// combos (issue #20 + issue #21):
    ///   (a) Action + Collapsible:true on the same section.
    ///   (b) Action + Link on the same section — dispatcher OR navigator, never both.
    ///   (c) Link + Collapsible:true on the same section.
    ///   (d) Action nested inside another section with Action OR Link.
    ///   (e) Link nested inside another section with Link OR Action.
    /// A styling-only Variant:"card" section (no Action and no Link) inside a
    /// clickable or linked card is valid.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// Thrown when any invalid combo is found. The framework's exception
    /// filter maps this to a 500 with code "invalid_tree", same path as
    /// <see cref="ValidateActionNames"/>.
    /// </exception>
    public static void ValidateSectionAction(ViewNode root)
    {
        WalkForSectionAction(root, outerInteractive: null);
    }

    private static void WalkForSectionAction(ViewNode node, SectionNode? outerInteractive)
    {
        switch (node)
        {
            case PageNode page:
                foreach (var child in page.Children) WalkForSectionAction(child, outerInteractive);
                break;

            case SectionNode section:
                var hdr = string.IsNullOrEmpty(section.Heading) ? "(headingless)" : section.Heading;
                // (b) Action + Link on the same section — invalid. Checked FIRST
                // so the most actionable error wins if the consumer sets both.
                if (section.Action is not null && section.Link is not null)
                {
                    throw new InvalidOperationException(
                        $"SectionNode '{hdr}' has both Action and Link set. " +
                        "A SectionNode is either a dispatcher (Action) or a navigator (Link) — " +
                        "they create different user expectations of what a click means. Pick one.");
                }
                // (c) Link + Collapsible:true on the same section — invalid.
                if (section.Link is not null && section.Collapsible == true)
                {
                    throw new InvalidOperationException(
                        $"SectionNode '{hdr}' has both Link and Collapsible: true set. " +
                        "A collapsible section's summary IS the click target; a linked card " +
                        "makes the whole section the click target. Pick one.");
                }
                // (a) Action + Collapsible:true on the same section — invalid (existing, unchanged).
                if (section.Action is not null && section.Collapsible == true)
                {
                    throw new InvalidOperationException(
                        $"SectionNode '{hdr}' has both Action and Collapsible: true set. " +
                        "A collapsible section's summary IS the click target; a clickable card " +
                        "makes the whole section the click target. Pick one.");
                }
                // (e) Nested link-in-link / link-in-action — invalid.
                if (section.Link is not null && outerInteractive is not null)
                {
                    var outerHdr = string.IsNullOrEmpty(outerInteractive.Heading) ? "(headingless)" : outerInteractive.Heading;
                    if (outerInteractive.Link is not null)
                    {
                        throw new InvalidOperationException(
                            $"Nested SectionNode.Link: inner section '{hdr}' is inside linked outer " +
                            $"section '{outerHdr}'. HTML5 prohibits nested <a> elements.");
                    }
                    else
                    {
                        throw new InvalidOperationException(
                            $"SectionNode.Link inner section '{hdr}' is inside clickable outer " +
                            $"SectionNode.Action '{outerHdr}'. Click-ownership in the overlap is ambiguous — " +
                            "a linked card inside a dispatcher card creates two competing primary interactions.");
                    }
                }
                // (d) Nested action-in-action / action-in-link — invalid.
                if (section.Action is not null && outerInteractive is not null)
                {
                    var outerHdr = string.IsNullOrEmpty(outerInteractive.Heading) ? "(headingless)" : outerInteractive.Heading;
                    if (outerInteractive.Action is not null)
                    {
                        throw new InvalidOperationException(
                            $"Nested SectionNode.Action: inner section '{hdr}' is inside clickable outer " +
                            $"section '{outerHdr}'. Nested role='button' elements are an accessibility violation, " +
                            "and click-ownership in the overlap is ambiguous. Use a styling-only inner section " +
                            "(variant: 'card', no Action) with internal buttons instead.");
                    }
                    else
                    {
                        throw new InvalidOperationException(
                            $"SectionNode.Action inner section '{hdr}' is inside linked outer " +
                            $"SectionNode.Link '{outerHdr}'. Click-ownership in the overlap is ambiguous — " +
                            "a dispatcher card inside a linked card creates two competing primary interactions.");
                    }
                }
                var nextOuter = (section.Action is not null || section.Link is not null) ? section : outerInteractive;
                foreach (var child in section.Children) WalkForSectionAction(child, nextOuter);
                break;

            case ListNode list:
                foreach (var child in list.Children) WalkForSectionAction(child, outerInteractive);
                break;

            case ListItemNode item:
                foreach (var child in item.Children) WalkForSectionAction(child, outerInteractive);
                break;

            case FormNode form:
                foreach (var child in form.Children) WalkForSectionAction(child, outerInteractive);
                break;

            case ModalNode modal:
                foreach (var child in modal.Children) WalkForSectionAction(child, outerInteractive);
                if (modal.Footer is { } footer)
                {
                    foreach (var f in footer) WalkForSectionAction(f, outerInteractive);
                }
                break;

            // Leaf-like nodes (FieldNode, CheckboxNode, ButtonNode, TextNode,
            // LinkNode, ImageNode, StatBarNode, TabsNode, ProgressNode,
            // TableNode, CopyButtonNode) carry no SectionNode descendants. No
            // recursion needed — TableNode rows hold strings + per-row controls,
            // not sections, so a section can never sit inside a table row.
        }
    }

    private static void Collect(
        ViewNode node,
        FormNode? enclosingForm,
        List<(string Name, FormNode? EnclosingForm)> sink)
    {
        switch (node)
        {
            case PageNode page:
                foreach (var child in page.Children) Collect(child, enclosingForm, sink);
                break;

            case SectionNode section:
                foreach (var child in section.Children) Collect(child, enclosingForm, sink);
                break;

            case ListNode list:
                foreach (var child in list.Children) Collect(child, enclosingForm, sink);
                break;

            case ListItemNode item:
                foreach (var child in item.Children) Collect(child, enclosingForm, sink);
                break;

            case FormNode form:
                if (form.SubmitAction is { } submit) Record(submit, form, sink);
                if (form.Buttons is { } buttons)
                {
                    foreach (var b in buttons.OfType<ButtonNode>())
                    {
                        Record(b.Action, form, sink);
                    }
                }
                foreach (var child in form.Children) Collect(child, form, sink);
                break;

            case FieldNode field:
                if (field.Action is { } fieldAction) Record(fieldAction, enclosingForm, sink);
                break;

            case CheckboxNode checkbox:
                if (checkbox.Action is { } cbAction) Record(cbAction, enclosingForm, sink);
                break;

            case ButtonNode button:
                Record(button.Action, enclosingForm, sink);
                break;

            case TabsNode tabs:
                foreach (var tab in tabs.Tabs) Record(tab.Action, enclosingForm, sink);
                break;

            case ModalNode modal:
                if (modal.DismissAction is { } dismiss) Record(dismiss, enclosingForm, sink);
                foreach (var child in modal.Children) Collect(child, enclosingForm, sink);
                if (modal.Footer is { } footer)
                {
                    foreach (var f in footer) Collect(f, enclosingForm, sink);
                }
                break;

            case TableNode table:
                if (table.SortActions is { } sortActions)
                {
                    foreach (var action in sortActions.Values)
                    {
                        Record(action, enclosingForm, sink);
                    }
                }
                if (table.FilterAction is { } filter) Record(filter, enclosingForm, sink);
                if (table.Pagination?.PrevAction is { } prev) Record(prev, enclosingForm, sink);
                if (table.Pagination?.NextAction is { } next) Record(next, enclosingForm, sink);
                foreach (var row in table.Rows)
                {
                    if (row.Actions is { } rowActions)
                    {
                        foreach (var rowAction in rowActions)
                        {
                            if (rowAction is ButtonNode b) Record(b.Action, enclosingForm, sink);
                            else if (rowAction is CheckboxNode cb && cb.Action is { } cbAct)
                                Record(cbAct, enclosingForm, sink);
                        }
                    }
                }
                break;

            // No dispatch-bearing actions of their own:
            //   TextNode, LinkNode, ImageNode, StatBarNode, ProgressNode,
            //   CopyButtonNode.
        }
    }

    private static void Record(
        ActionDescriptor action,
        FormNode? enclosingForm,
        List<(string Name, FormNode? EnclosingForm)> sink)
    {
        sink.Add((action.Name, enclosingForm));
    }
}

/// <summary>
/// Thrown by an action handler to signal that the dispatched action name is
/// not recognised by the dispatch switch. The framework catches this and
/// returns a 400 with <c>code: "unknown_action"</c> in the error envelope,
/// allowing agents to distinguish "I sent a name your tree doesn't expose"
/// from "your handler crashed."
/// <para>
/// Usage — add a <c>default:</c> case to your dispatch switch:<br/>
/// <c>default: throw new UnknownActionException(payload.Name);</c>
/// </para>
/// Mirrors the TS <c>UnknownActionError</c> class — both backends use the same
/// wire code (<see cref="ErrorCodes.UnknownAction"/>).
/// </summary>
public class UnknownActionException : Exception
{
    /// <summary>The offending action name sent by the client.</summary>
    public string ActionName { get; }

    public UnknownActionException(string actionName)
        : base($"Unknown action: {actionName}")
    {
        ActionName = actionName;
    }
}
