using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http;

namespace ViewModelShell;

// ─────────────────────────────────────────────────────────────────────────────
// WIRE CONTRACT — null omission is INTRINSIC to these types.
//
// Every nullable (T?) member of an outbound wire record carries
//   [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
// so the contract — "an unset optional is ABSENT, never \"field\": null" —
// holds even under default ASP.NET JsonSerializerOptions with NO
// DefaultIgnoreCondition configured, FOR THE TYPES IN THIS FILE.
//
// ⚠️ SCOPE — do not overstate this (the comment here previously did, and
// AGENTS.md gotcha #8 had to be corrected on 2026-07-16 for the same reason):
// the intrinsic attributes cover the framework's OWN wire types only. A
// consumer's app STATE record is THEIR type and carries no attributes unless
// they add them, so host-side DefaultIgnoreCondition = WhenWritingNull in
// Program.cs remains LOAD-BEARING for `state` and must NOT be called
// redundant or safe to omit.
//
// Maintainer rule: a NEW nullable field WITHOUT this attribute silently
// re-introduces the cross-backend null-vs-absent drift this exists to kill.
// Non-nullable members (incl. bool/int with semantic defaults) deliberately
// keep serializing their value. JsonIgnoreAttribute is sealed — it cannot be
// wrapped in a shorter alias; the attribute is spelled out in full on purpose.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Closed wire vocabularies ────────────────────────────────────────────────
//
// Every closed union in the TypeScript twin (viewmodel-shell/src/index.ts) is
// an ENUM here, not `string?`. Before 6.0.0 these were all open `string?`: the
// TS union was the only definition of validity and it did not bind this
// backend, so a .NET app could emit any string for a closed-list field, the
// renderer would silently ignore it, and parity could not catch it (two
// backends emitting the same wrong value agree, and a diff passes). Audited
// 2026-07-16: 39 of 39 were open. Enums make the invalid value a COMPILE
// error, which is the same protection the TS side has always had.
//
// 🚨 MAINTAINER RULE — the converter MUST be intrinsic, via KebabEnum<T>.
// System.Text.Json serializes a bare enum as a NUMBER ({"tone":0}) and the
// stock JsonStringEnumConverter attribute (which takes no naming policy)
// emits PascalCase ({"tone":"SpaceBetween"}). BOTH are silently wrong on the
// wire and BOTH compile fine. Relying on the host to register a converter in
// Program.cs re-creates exactly the per-app-forgettable footgun the null
// contract above exists to avoid — and it fails SILENTLY, so no consumer can
// "just remember" it. KebabEnum<T> bakes JsonNamingPolicy.KebabCaseLower into
// a parameterless ctor so it can be named by an attribute, making correct
// serialization intrinsic under default ASP.NET options with ZERO host setup.
// Verified: SpaceBetween → "space-between", ThreeQuarters → "three-quarters",
// Danger → "danger", byte-identical to the TS union strings.
//
// A NEW closed-union field MUST be an enum carrying [JsonConverter(
// typeof(KebabEnum<TEnum>))]; a new VALUE is a plain additive enum member
// (non-breaking for consumers). Deliberately NOT enums: freeform,
// app-extensible fields — `state` on ListItemNode/TableRow — which are
// `string` in the TS twin too, by design.
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Serializes an enum as its kebab-case-lower name, matching the TypeScript
/// union strings exactly. Baked into a parameterless ctor so it can be applied
/// via [JsonConverter] — which makes it intrinsic to the type and independent
/// of host JsonSerializerOptions. See the maintainer rule above.
/// </summary>
public sealed class KebabEnum<T> : JsonStringEnumConverter<T> where T : struct, Enum
{
    public KebabEnum() : base(JsonNamingPolicy.KebabCaseLower) { }
}

/// <summary>Semantic intent / severity — the universal status colour axis.</summary>
[JsonConverter(typeof(KebabEnum<Tone>))]
public enum Tone { Success, Warning, Danger, Info }

/// <summary>Visual weight — filled vs outline. Orthogonal to Tone and Size.</summary>
[JsonConverter(typeof(KebabEnum<Emphasis>))]
public enum Emphasis { Primary, Secondary }

/// <summary>Box geometry for buttons — the ONLY axis that changes metrics.</summary>
[JsonConverter(typeof(KebabEnum<ControlSize>))]
public enum ControlSize { Sm, Lg }

/// <summary>Button/CopyButton width: "full" stretches to fill the container.</summary>
[JsonConverter(typeof(KebabEnum<ControlWidth>))]
public enum ControlWidth { Auto, Full }

/// <summary>Design-system sizing hint for images.</summary>
[JsonConverter(typeof(KebabEnum<ImageSize>))]
public enum ImageSize { Small, Medium, Large, Full }

/// <summary>Image mask shape.</summary>
[JsonConverter(typeof(KebabEnum<ImageShape>))]
public enum ImageShape { Circle }

/// <summary>Modal width preset.</summary>
[JsonConverter(typeof(KebabEnum<ModalSize>))]
public enum ModalSize { Narrow, Medium, Wide, Fullscreen }

/// <summary>Chart rendering kind.</summary>
[JsonConverter(typeof(KebabEnum<ChartKind>))]
public enum ChartKind { Line, Bar, Area, Pie, Donut }

/// <summary>Form field arrangement.</summary>
[JsonConverter(typeof(KebabEnum<FormLayout>))]
public enum FormLayout { Stack, Inline }

/// <summary>Page/Section layout preset. Responsiveness is intrinsic — see the
/// layout policy in AGENTS.md (zero viewport breakpoints).</summary>
[JsonConverter(typeof(KebabEnum<Layout>))]
public enum Layout { Stack, Split, Cards, Sidebar, Switcher, Row }

/// <summary>Page width cap opt-in.</summary>
[JsonConverter(typeof(KebabEnum<PageWidth>))]
public enum PageWidth { Wide, Full }

/// <summary>Spacing rhythm.</summary>
[JsonConverter(typeof(KebabEnum<Density>))]
public enum Density { Comfortable, Compact }

/// <summary>Main-axis distribution (justify-content).</summary>
[JsonConverter(typeof(KebabEnum<Arrange>))]
public enum Arrange { Start, Center, End, SpaceBetween, SpaceAround, SpaceEvenly }

/// <summary>Cross-axis alignment (align-items).</summary>
[JsonConverter(typeof(KebabEnum<Align>))]
public enum Align { Start, Center, End, Baseline, Stretch }

/// <summary>Per-item cross-axis override (align-self).</summary>
[JsonConverter(typeof(KebabEnum<AlignSelf>))]
public enum AlignSelf { Start, Center, End }

/// <summary>Switcher row/stack flip threshold (content width).</summary>
[JsonConverter(typeof(KebabEnum<Threshold>))]
public enum Threshold { Sm, Md, Lg, Xl }

/// <summary>Cards auto-fit minimum track size.</summary>
[JsonConverter(typeof(KebabEnum<MinItem>))]
public enum MinItem { Xs, Sm, Md, Lg, Xl }

/// <summary>Section measure cap.</summary>
[JsonConverter(typeof(KebabEnum<MaxWidth>))]
public enum MaxWidth { Prose, Half, TwoThirds, ThreeQuarters }

/// <summary>Divider/Steps orientation.</summary>
[JsonConverter(typeof(KebabEnum<Orientation>))]
public enum Orientation { Horizontal, Vertical }

/// <summary>FitsNode measurement axis.</summary>
[JsonConverter(typeof(KebabEnum<Axis>))]
public enum Axis { Horizontal, Vertical, Both }

/// <summary>Text typography role.</summary>
[JsonConverter(typeof(KebabEnum<TextStyle>))]
public enum TextStyle { Heading, Subheading, Body, Muted, Pre, Strikethrough }

/// <summary>A section's structural surface kind.</summary>
[JsonConverter(typeof(KebabEnum<SectionVariant>))]
public enum SectionVariant { Card }

// ─── Action types ─────────────────────────────────────────────────────────────

public record ActionDescriptor(
    string Name,
    // Phase 14 (NBA-01/NBA-04, non-blocking dispatch — see
    // .planning/design/non-blocking-actions.md). Optional; semantic default
    // is TRUE (blocking) — the framework's pre-Phase-14 behavior, where a
    // dispatch holds the client's dispatch mutex until it resolves. Omitted
    // = byte-identical to every existing app. `false` opts this specific
    // action into the non-blocking round trip, which coexists with a
    // blocking dispatch on the client instead of contending for its
    // dispatch mutex.
    //
    // DELIBERATELY `bool?` + `WhenWritingNull`, NOT `bool` + `WhenWritingDefault`
    // like PageNode/SectionNode `Fill`, `LinkNode`/`SectionLink` `External`, or
    // `TableColumn` `FollowTail` (see those fields' comments elsewhere in this
    // file). Those fields' semantic "unset" value (`false`) happens to equal
    // the CLR `default(bool)`, so `WhenWritingDefault` (which always compares
    // against `default(bool)` = `false`) drops them correctly. `Blocking`'s
    // semantic "unset" value is `true` — the OPPOSITE of the CLR default — so
    // `WhenWritingDefault` would invert the polarity here: it would drop
    // explicit `false` writes (the one value that matters on the wire) and
    // always emit `true`. `bool?` + `WhenWritingNull` is therefore the only
    // correct mechanism, exactly as already used for `SectionNode.Collapsible`
    // (also nullable+`WhenWritingNull`, for the identical
    // true-is-incompatible-with-WhenWritingDefault reason — even though
    // Collapsible's OWN semantic default happens to be false; the point is
    // the mechanism is unconditionally correct for ANY optional bool
    // regardless of which value is "unset", not that polarity must match).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Blocking = null
);

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
    /// 3.8.0 — version-aware overload of <see cref="Parse(string, string)"/>. Reads
    /// the <c>X-VMS-Client-Build</c> request header and, when <paramref name="currentBuild"/>
    /// is non-empty AND the header is present AND it does NOT match, throws
    /// <see cref="StaleClientException"/> <em>before</em> touching the form / deserializing
    /// <c>_state</c> — so a stale client's typed state is never parsed. The exception is
    /// mapped to a 400 <c>stale_client</c> envelope by <see cref="ShellExceptionFilter"/>.
    /// When <paramref name="currentBuild"/> is null/empty the guard is skipped entirely
    /// (behavior identical to the string overload). An absent header always passes through
    /// (the fail-closed guard fires only for a mismatching client that DID advertise a build).
    /// </summary>
    public static ActionPayload<TState> Parse(HttpRequest request, string currentBuild)
    {
        if (!string.IsNullOrEmpty(currentBuild))
        {
            var clientBuild = request.Headers["X-VMS-Client-Build"].ToString();
            if (!string.IsNullOrEmpty(clientBuild) && clientBuild != currentBuild)
            {
                throw new StaleClientException(clientBuild, currentBuild);
            }
        }
        return Parse(request.Form["_action"].ToString(), request.Form["_state"].ToString());
    }

    /// <summary>
    /// Parses a flat JSON body shaped { "name": "...", "state": {...} }.
    /// Use this when a controller accepts application/json alongside multipart/form-data —
    /// removes the two-layer escaping that multipart requires and makes curl/agent callers ergonomic.
    /// </summary>
    public static ActionPayload<TState> ParseJson(string jsonBody)
    {
        var root = JsonSerializer.Deserialize<JsonElement>(jsonBody, _parseOpts);
        // Throw JsonException for any malformed payload so the framework's
        // exception filter classifies it as parse_error (400), matching the TS
        // twin. Without these guards a missing 'name' threw KeyNotFoundException
        // and a missing 'state' deserialized to null — both crashing later as a
        // 500 uncaught_exception (the wrong, un-actionable error class for the
        // caller). (C4, 3.3.0.)
        if (root.ValueKind != JsonValueKind.Object
            || !root.TryGetProperty("name", out var nameEl)
            || nameEl.ValueKind != JsonValueKind.String
            || string.IsNullOrEmpty(nameEl.GetString()))
        {
            throw new JsonException("Missing required 'name' field in action payload.");
        }
        // Require 'state'. An empty object {} is a valid state and passes; only
        // an absent or null state is rejected.
        if (!root.TryGetProperty("state", out var stateEl) || stateEl.ValueKind == JsonValueKind.Null)
        {
            throw new JsonException(
                "Missing required 'state' field in action payload. The action wire is " +
                "{name, state} — echo back the state from the GET response (or the prior " +
                "action response); send {} only if the app's state really is empty.");
        }
        var name = nameEl.GetString()!;
        var state = JsonSerializer.Deserialize<TState>(stateEl.GetRawText(), _parseOpts)!;
        return new ActionPayload<TState>(name, state);
    }
}

public record ShellSideEffect(
    string Type,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Key = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Value = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Url = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Filename = null,
    // Toast effect fields. Message is required-for-toast (the shell guards
    // message != null before routing); Tone/DurationMs are optional. All
    // nullable + WhenWritingNull so they stay ABSENT on non-toast effects,
    // matching the TS twin's conditional-spread wire.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Message = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tone = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? DurationMs = null
)
{
    public static ShellSideEffect SetLocalStorage(string key, string value) =>
        new("set-local-storage", key, value);

    public static ShellSideEffect SetSessionStorage(string key, string value) =>
        new("set-session-storage", key, value);

    /// <summary>
    /// Transient confirmation toast (a UX nicety — fail-quiet by absence; see
    /// Adapter.toast in the TS package). <paramref name="message"/> is required;
    /// <paramref name="tone"/> ("danger"|"warning"|"success"|"info") and
    /// <paramref name="durationMs"/> (auto-dismiss delay, adapter default ~4000)
    /// are optional and stay absent from the wire when null (WhenWritingNull).
    /// </summary>
    public static ShellSideEffect Toast(string message, string? tone = null, int? durationMs = null) =>
        new("toast", Message: message, Tone: tone, DurationMs: durationMs);

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
    /// <summary>
    /// 3.8.0 — request's <c>X-VMS-Client-Build</c> header ≠ the server's current-deployed
    /// build id (a stale, never-reloaded tab attempting a mutation). Rejected BEFORE
    /// <c>_state</c> is deserialized. HTTP 400.
    /// </summary>
    public const string StaleClient = "stale_client";
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

    /// <summary>
    /// 3.8.0 — request came from a stale client (its <c>X-VMS-Client-Build</c> header did
    /// not match the current deployed build). HTTP 400. Mirrors the TS
    /// <c>ERR_CODES.STALE_CLIENT</c> envelope.
    /// </summary>
    public static ShellErrorResponse OfStaleClient(string message) =>
        new([new ErrorEntry(message, Code: ErrorCodes.StaleClient)]);
}

/// <summary>
/// 3.8.0 — marker interface implemented by <see cref="ShellResponse{TState}"/> so the
/// non-generic <see cref="ShellVersionResultFilter"/> can stamp the current build id onto
/// any controller-returned shell response without knowing its <c>TState</c>.
/// </summary>
public interface IShellResponse
{
    /// <summary>Return a copy of this response carrying <paramref name="build"/> as its <c>serverBuild</c>.</summary>
    IShellResponse WithServerBuild(string build);
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ShellRejection? Rejected = null,
    // 3.8.0 — the server's current-deployed client-build id. Normally stamped by
    // ShellVersionResultFilter (when AddVmsShellVersioning configured a build);
    // also settable directly. Nullable + WhenWritingNull so the wire stays absent
    // when versioning is off. Trailing so existing positional call sites are
    // unaffected.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? ServerBuild = null
) : IShellResponse
{
    public static ShellResponse<TState> RedirectTo(string url) =>
        new(null, default, url);

    /// <summary>
    /// 3.8.0 — return a copy stamped with <paramref name="build"/> as <see cref="ServerBuild"/>.
    /// Used by <see cref="ShellVersionResultFilter"/> to auto-stamp every controller-returned
    /// response; apps may also call it directly.
    /// </summary>
    public IShellResponse WithServerBuild(string build) =>
        this with { ServerBuild = build };

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
[JsonDerivedType(typeof(DividerNode),    "divider")]
[JsonDerivedType(typeof(FitsNode),       "fits")]
[JsonDerivedType(typeof(EmptyStateNode), "empty-state")]
[JsonDerivedType(typeof(BadgeNode),      "badge")]
[JsonDerivedType(typeof(ChartNode),      "chart")]
[JsonDerivedType(typeof(BreadcrumbNode), "breadcrumb")]
[JsonDerivedType(typeof(StepsNode),      "steps")]
public abstract record ViewNode;

public record PageNode(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Title,
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Density? Density = null,
    // Layout preset arranging direct children — free-form string mirroring the
    // TS closed union "stack"|"split"|"cards"|"sidebar"|"row"|"switcher" (1.13.0
    // added "switcher": N equal items flipping all-row ↔ all-stack atomically
    // at a content-width threshold — the negative-flex-basis primitive a grid
    // cannot express). Omitted or "stack" = vertical flow (no modifier class);
    // any other value emits .vms-page--{value}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Layout? Layout = null,
    // Fill / full-height app-shell axis. When true the page fills the viewport
    // height (height:100dvh) so a SectionNode.Fill child can claim the leftover
    // column height and scroll internally — the pinned footer/header + internally-
    // scrolling body shell (Flutter Column+Expanded). Meant to pair with a
    // SectionNode.Fill child. Orthogonal to Layout. Non-nullable bool defaulting to
    // false, dropped from the wire when false (WhenWritingDefault) so it's ABSENT
    // rather than "fill": false — matching the TS optional `fill?` (F2; same posture
    // as LinkNode.External). false/omitted = normal document flow, byte-identical.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Fill = false,
    // Page-shell max-width override (issue #13). null = default cap (--vms-page-max,
    // 1080px). "wide" = --vms-page-max-wide (1440px default). "full" = uncapped.
    // TUI ignores this — width caps are a browser concern.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] PageWidth? Width = null,
    // 1.12.0 — main-axis arrangement for layout:"row" (the cluster primitive) —
    // maps to justify-content. Free-form string mirroring the TS closed union
    // "start"|"center"|"end"|"space-between"|"space-around"|"space-evenly"
    // (Jetpack Compose Arrangement ∩ Flutter MainAxisAlignment; ALIGN-01). The
    // closed union is enforced on the TS side and validated by parity, matching
    // the Layout field's pattern. Omitted = no class → row default (flex-start,
    // left-pack) holds = byte-identical to today; any value emits
    // .vms-arrange--{value}. JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Arrange? Arrange = null,
    // 1.12.0 — cross-axis alignment for layout:"row" — maps to align-items.
    // Free-form string mirroring the TS closed union
    // "start"|"center"|"end"|"stretch"|"baseline" (Flutter CrossAxisAlignment;
    // ALIGN-02). Omitted = no class → row default (center) holds = byte-identical
    // to today; any value emits .vms-align--{value}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Align? Align = null,
    // 1.13.0 — switcher flip width for layout:"switcher". Free-form string
    // mirroring the TS closed union "sm"|"md"|"lg"|"xl" (closed union enforced
    // on the TS side + validated by parity, matching the Layout field's
    // pattern). The locked size scale → CSS rem (sm→20rem, md→30rem, lg→40rem,
    // xl→48rem). Omitted = no class → the var(--vms-switch-threshold, 30rem) CSS
    // default (30rem) holds; any value emits .vms-switch--{value} which sets
    // --vms-switch-threshold. JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Threshold? Threshold = null,
    // 1.13.0 — switcher max-per-row count cap for layout:"switcher". int?
    // mirroring the TS bounded numeric union 2..8 (bounded scalar, not raw CSS,
    // per P2; the bound is enforced on the TS side + validated by parity). Once
    // the child count exceeds Limit every child goes full-width regardless of
    // container width. Omitted = no class → no count cap; any value emits
    // .vms-switch-limit--{n}. JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Limit = null,
    // 1.13.0 — cards auto-fit min track width for layout:"cards". Free-form
    // string mirroring the TS closed union "xs"|"sm"|"md"|"lg"|"xl" (closed
    // union enforced on the TS side + validated by parity, matching the Layout
    // field's pattern). The locked size scale → CSS rem (xs→10rem, sm→13rem,
    // md→16rem [= today's default], lg→20rem, xl→24rem) overrides the fixed
    // --vms-card-min the auto-fit cards rule reads. Omitted = no class → the
    // inherited 16rem default holds = byte-identical to today; any value emits
    // .vms-cards-min--{value} which sets --vms-card-min. JsonIgnore-on-null per
    // the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] MinItem? MinItem = null
) : ViewNode;

// 1.4.0 — SectionNode.Link URL-wrapper variant of the clickable-card primitive
// (issue #21). Nested record (`{ Url, External }`) matches the TS shape exactly
// — `link?: { url, external? }`. External is non-nullable bool defaulting to
// false, dropped from the wire when false (WhenWritingDefault) so it's ABSENT
// rather than "external": false — matching the TS optional `external?` (3.3.0,
// F2; same posture as LinkNode.External). Url is required, non-nullable, must
// be non-empty (the renderer trusts it as `<a href={Url}>`); validation is the
// caller's responsibility because empty URLs render as anchors-without-href which
// browsers treat as styling-only — semantically wrong, but not a tree-shape bug.
public record SectionLink(
    string Url,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool External = false);

public record SectionNode(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Heading,
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] SectionVariant? Variant = null,
    // Layout preset arranging direct children — free-form string mirroring the
    // TS closed union "stack"|"split"|"cards"|"sidebar"|"row"|"switcher" (1.11.0
    // added "row": a left-aligned wrapping horizontal row, items hug content;
    // 1.13.0 added "switcher": N equal items flipping all-row ↔ all-stack
    // atomically at a content-width threshold — the negative-flex-basis primitive
    // a grid cannot express). Omitted or "stack" = vertical flow (no modifier
    // class); any other value emits .vms-section--{value}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Layout? Layout = null,
    // Fill / full-height app-shell axis. When true (and inside a Fill page) this
    // section takes the remaining column height and scrolls internally
    // (flex:1 1 auto; min-height:0; overflow-y:auto) — the body region of a
    // full-height app shell (e.g. a chat transcript above a pinned composer).
    // Orthogonal to Layout — a fill section still arranges its own children via
    // Layout. Outside a Fill page it's a harmless no-op. Non-nullable bool
    // defaulting to false, dropped from the wire when false (WhenWritingDefault)
    // so it's ABSENT rather than "fill": false — matching the TS optional `fill?`
    // (F2; same posture as LinkNode.External). false/omitted = byte-identical.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Fill = false,
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
    // 1.12.0 — main-axis arrangement for layout:"row" (the cluster primitive) —
    // maps to justify-content. Free-form string mirroring the TS closed union
    // "start"|"center"|"end"|"space-between"|"space-around"|"space-evenly"
    // (Jetpack Compose Arrangement ∩ Flutter MainAxisAlignment; ALIGN-01). The
    // closed union is enforced on the TS side and validated by parity, matching
    // the Layout field's pattern. Omitted = no class → row default (flex-start,
    // left-pack) holds = byte-identical to today; any value emits
    // .vms-arrange--{value}. JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Arrange? Arrange = null,
    // 1.12.0 — cross-axis alignment for layout:"row" — maps to align-items.
    // Free-form string mirroring the TS closed union
    // "start"|"center"|"end"|"stretch"|"baseline" (Flutter CrossAxisAlignment;
    // ALIGN-02). Omitted = no class → row default (center) holds = byte-identical
    // to today; any value emits .vms-align--{value}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Align? Align = null,
    // 1.13.0 — switcher flip width for layout:"switcher". Free-form string
    // mirroring the TS closed union "sm"|"md"|"lg"|"xl" (closed union enforced
    // on the TS side + validated by parity, matching the Layout field's
    // pattern). The locked size scale → CSS rem (sm→20rem, md→30rem, lg→40rem,
    // xl→48rem). Omitted = no class → the var(--vms-switch-threshold, 30rem) CSS
    // default (30rem) holds; any value emits .vms-switch--{value} which sets
    // --vms-switch-threshold. JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Threshold? Threshold = null,
    // 1.13.0 — switcher max-per-row count cap for layout:"switcher". int?
    // mirroring the TS bounded numeric union 2..8 (bounded scalar, not raw CSS,
    // per P2; the bound is enforced on the TS side + validated by parity). Once
    // the child count exceeds Limit every child goes full-width regardless of
    // container width. Omitted = no class → no count cap; any value emits
    // .vms-switch-limit--{n}. JsonIgnore-on-null per the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Limit = null,
    // 1.13.0 — cards auto-fit min track width for layout:"cards". Free-form
    // string mirroring the TS closed union "xs"|"sm"|"md"|"lg"|"xl" (closed
    // union enforced on the TS side + validated by parity, matching the Layout
    // field's pattern). The locked size scale → CSS rem (xs→10rem, sm→13rem,
    // md→16rem [= today's default], lg→20rem, xl→24rem) overrides the fixed
    // --vms-card-min the auto-fit cards rule reads. Omitted = no class → the
    // inherited 16rem default holds = byte-identical to today; any value emits
    // .vms-cards-min--{value} which sets --vms-card-min. JsonIgnore-on-null per
    // the file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] MinItem? MinItem = null,
    // Semantic intent/severity tone — the universal status color axis, orthogonal
    // to Variant (a section can be a card AND tone:"warning"). Emits .vms-section--{tone}
    // (tinted surface + colored border). "danger"|"warning"|"success"|"info".
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // 3.2.0 — per-child cross-axis self-alignment (CHILD-01). Free-form string
    // mirroring the TS closed union "start"|"center"|"end" (closed union enforced
    // TS-side + validated by parity, matching the Layout/Arrange field pattern).
    // Maps to CSS align-self — the per-child counterpart to Align; in the default
    // flex column the cross axis is horizontal (start/center/end = left/center/
    // right), overriding the parent's alignment for this one section (the chat-
    // bubble case). Omitted = no class → inherits parent alignment = byte-identical
    // to today; any value emits .vms-self--{value}. JsonIgnore-on-null per the
    // file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] AlignSelf? AlignSelf = null,
    // 3.2.0 — bounded content-width cap (CHILD-02). Free-form string mirroring the
    // TS closed union "half"|"two-thirds"|"three-quarters"|"prose" (closed set, not
    // raw CSS, per P2; enforced TS-side + validated by parity). Maps to
    // max-inline-size: fractional → proportional (50% / 66.6667% / 75%), prose →
    // the readable measure min(65ch,100%). The section still shrinks to content
    // below the cap. Omitted = no class → no cap (full-width) = byte-identical to
    // today; any value emits .vms-maxw--{value}. JsonIgnore-on-null per the
    // file-header rule.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] MaxWidth? MaxWidth = null,
    // Follow-the-tail append-only scroll axis. When true this section is a
    // growing feed (chat transcript, live log tail, activity/audit stream,
    // streamed job output) whose NEWEST content stays in view across
    // re-renders unless the user has scrolled up. Pure client-side render
    // behavior (scroll position never rides the wire — the server stays
    // stateless): the BrowserAdapter pins a near-bottom feed to the new bottom
    // after each re-render and leaves a scrolled-up one where the user parked
    // it, inverting the default 0.7.1 preserve-scrollTop restore that would
    // otherwise push new content off-screen. Meant to pair with Fill (which
    // provides the internal overflow-y:auto); inert on a non-scrolling
    // element. Non-nullable bool defaulting to false, dropped from the wire
    // when false (WhenWritingDefault) so it's ABSENT rather than
    // "followTail": false — matching the TS optional `followTail?` (F2; same
    // posture as Fill). false/omitted = byte-identical.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool FollowTail = false
) : ViewNode;

public record ListNode(
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Id = null,
    // Ordered (<ol>) vs unordered (<ul>). Semantic "unset" is false = the CLR
    // default, so WhenWritingDefault drops it from the wire (matching the TS
    // optional `ordered?: boolean`, absent when unset) — same posture as
    // PageNode/SectionNode.Fill, LinkNode.External, FieldNode.Required.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Ordered = false
) : ViewNode;

// The SwiftUI `ViewThatFits` port (FITS-01/03). Children are ordered
// preferred/widest FIRST → safe-fallback/narrowest LAST. `Axis` is free-form
// `string?` mirroring the TS closed union `"horizontal"|"vertical"|"both"`
// (closed union enforced TS-side + validated by parity, matching the
// Layout/Arrange field pattern); omitted = absent on the wire → the renderer
// treats it as `"horizontal"`. The SELECTION is client-only (real layout
// measurement in BrowserAdapter) and NOT part of the wire — the wire only
// carries the node shape. `JsonIgnore`-on-null per the file-header rule.
// Thematic break / separator (#22). Horizontal (default) → <hr role="separator">;
// vertical → a role="separator" div for row layouts. No content.
public record DividerNode(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Orientation? Orientation = null
) : ViewNode;

public record FitsNode(
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Axis? Axis = null
) : ViewNode;

public record ListItemNode(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Id,
    // Row lifecycle/selection STATE (NOT severity — that's Tone). Freeform,
    // app-extensible; framework-styled list-item set: active/done/disabled/high.
    // An unrecognized state emits an unstyled .vms-list-item--{state} class.
    // Orthogonal to Tone. (TableRow additionally ships a `running` style.)
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State,
    IReadOnlyList<ViewNode> Children,
    // Semantic intent/severity — universal tone axis ("danger"|"warning"|"success"|"info").
    // Emits .vms-list-item--{tone} (colored accent border). JsonIgnore-on-null per the file header.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null
) : ViewNode;

public record FormNode(
    // OPTIONAL since 0.10.0 (#15): omit for a form whose only triggers are
    // Buttons[]. Kept positional-but-nullable so existing positional call
    // sites (new FormNode(action, label, children)) compile unchanged.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? SubmitAction,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SubmitLabel,
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] FormLayout? Layout = null,
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? SubmitOnEnter = null,
    // Full control of the submit button (#22). When set, the form renders THIS
    // button (its label + emphasis/tone/size/width/pendingLabel) as the submit,
    // and fires its action on click + native/textarea Enter — instead of
    // synthesizing one from SubmitLabel. Takes precedence over SubmitLabel/
    // SubmitAction. Typed ViewNode? (not ButtonNode) so STJ emits the
    // "type":"button" discriminator on the wire, matching the TS backend.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? SubmitButton = null
) : ViewNode;

public record FieldOption(string Value, string Label);

// 5.2.0 (LOOK-01/LOOK-06) — mirrors the TS `LookupItem` in src/index.ts. The
// homogeneous shape a lookup deals in: an invented value is a LookupItem too,
// NEVER a bare string, so no `LookupItem | string` union can arise (MUI's
// `multiple + freeSolo` yields exactly that heterogeneous union and their own
// docs warn it "may cause type mismatch").
//
// ⚠️ `Type` here is the REFERENCE-KIND tag, NOT the [JsonPolymorphic]
// discriminator. There is no collision: LookupItem is a plain sub-record (like
// FieldOption), NOT a ViewNode, so it carries no [JsonDerivedType] and STJ
// writes no discriminator into it. Stated explicitly because "a record with a
// `type` property inside a polymorphic tree" is exactly the thing a reviewer
// should stop on. It serializes as "type" via the host camelCase naming policy
// (matching the TS `type?: string`); no [JsonPropertyName] is needed.
//
// Label/Type are nullable + WhenWritingNull (the maintainer rule at the top of
// this file): Label is omitted when it EQUALS Value (D5 — Principle 7 applied
// to a pair; exactly the free-form-tag case, where a tag is a value whose label
// is itself), and Type is omitted for monomorphic references (D6 — a
// polymorphic reference needs it because, per Microsoft verbatim, "this value
// doesn't tell you whether the owner of the record is a user or a team").
public record LookupItem(
    string Value,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Type = null);

public record FieldNode(
    string Name,
    string InputType,
    /// <summary>Path into state where this input reads its current value and writes user
    /// changes (e.g. "fields.title"). REQUIRED for value-bearing inputs
    /// (text/email/password/number/date/time/datetime-local/textarea/select/
    /// select-multiple/checkbox/lookup/lookup-multiple/code) and OPTIONAL for
    /// <c>file</c> inputs — a file
    /// input's binary rides the multipart side channel (fileRegistry keyed on
    /// <c>Name</c>), so pass <c>Bind: null</c> on a file input to avoid writing a
    /// {filename,size} placeholder object into state (which breaks a string/string-map
    /// state slot on round-trip). Kept in its positional slot; a null bind is absent on the wire.
    ///
    /// For the lookup inputTypes this path holds the ID AND NOTHING ELSE: <c>lookup</c>
    /// binds a string (one id), <c>lookup-multiple</c> binds a string[] (the ids). The
    /// human-readable label never lives here — it travels on <c>Selected</c>,
    /// server→client only. The id is state; the label is view.</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Bind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Placeholder,
    // Dropped from the wire when false (WhenWritingDefault) → absent, matching
    // the TS optional `required?` (3.3.0, F2).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Required = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<FieldOption>? Options = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Language = null,
    // Forms-completeness (3.4.0). Disabled/Readonly drop their false default like
    // Required (WhenWritingDefault); Error/Help are nullable strings (WhenWritingNull).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Disabled = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Readonly = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Error = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Help = null,
    // min/max/step are native input-attribute strings (numeric bound, date
    // bound, or "any" for step) — strings keep the wire byte-identical across
    // backends. MaxLength is the native maxlength (integer). All omitted-when-null.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Min = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Max = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Step = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? MaxLength = null,
    // FILE INPUTS ONLY. The action name(s) whose dispatch carries this file's
    // binary over the multipart wire — a file rides an action iff its name is
    // listed here. Declared on the file, so which trigger sends it does NOT
    // depend on button position (buttons[]/children/submit/Enter all honor it
    // equally). Absent/empty = the file rides nothing (no positional fallback);
    // the browser warns [vms:orphan-file]. Omitted-when-null on the wire.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<string>? UploadOn = null,
    // ─── 5.2.0 (LOOK-01/02/04/06) — the lookup surface ──────────────────────
    // Mirrors the TS twin's selected?/candidates?/searchBind?/searchAction?/
    // allowCustom? on FieldNode (src/index.ts). Two new InputType STRING tokens
    // ride the existing InputType member: "lookup" (binds one id) and
    // "lookup-multiple" (binds a string[] of ids) — separate inputTypes, not a
    // flag, mirroring our existing select/select-multiple cardinality split
    // (D2). `select-multiple` REMAINS the control for enumerable sets; a lookup
    // is for sets that CANNOT be enumerated into the tree (a 5,000-person
    // directory), and it must never try to swallow select-multiple.
    //
    // Selected/Candidates follow the Options shape (WhenWritingNull);
    // SearchBind follows the Bind shape; SearchAction follows the Action shape;
    // AllowCustom drops its false default like Required (WhenWritingDefault) so
    // `false` is ABSENT from the wire, matching the TS optional bool. A new
    // nullable without WhenWritingNull, or an optional bool without
    // WhenWritingDefault, silently re-introduces the null/false-vs-absent drift
    // from the TS twin that the header rule exists to kill.

    /// <summary>LOOKUP INPUTS ONLY. What is currently selected, WITH display labels.
    ///
    /// 🚨 DIRECTION IS THE ENTIRE SAFETY ARGUMENT: this is server→client ONLY. It is
    /// recomputed every render, is never authoritative, and is NEVER trusted coming back
    /// from the client — a client cannot forge a label into a handler because a client
    /// never sends one (the POST carries only the action NAME plus state). <c>Bind</c>
    /// holds the id and is the only authoritative thing. The id persists and round-trips
    /// (state); the label is derived, server-owned, recomputed every render (view).
    /// Putting the label in the bind is putting view into state.
    ///
    /// 🚨 Selected and Candidates are SEPARATE MEMBERS ON PURPOSE, and the selected label
    /// is NEVER resolved from Candidates. Fusing them is the original sin: with an
    /// id-valued field, "filter the candidate list" and "forget what's selected" are the
    /// SAME operation — so a picker resolving its label out of the candidate list renders
    /// a raw database id the moment a form loads with a value already set and no search
    /// has occurred (the cold-start case, which is the case that matters most).
    ///
    /// ALWAYS AN ARRAY, including for single <c>lookup</c>, where it holds 0 or 1 entries.
    /// Deliberate: a T | T[] union does not serialize byte-identically under both
    /// System.Text.Json and JSON.stringify, and the banked parity lesson is to prefer the
    /// shape that cannot drift over the shape that reads nicer. Omitted = nothing selected.</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<LookupItem>? Selected = null,

    /// <summary>LOOKUP INPUTS ONLY. The current search results — what the popup listbox
    /// offers. Feeds the popup and NOTHING else. NEVER the source of a selected label
    /// (see <c>Selected</c>).
    ///
    /// 🚨 ORDER IS MEANINGFUL APP DATA. The renderer presents candidates AS GIVEN — it
    /// sorts nothing, dedupes nothing, and truncates nothing. Relevance ordering is the
    /// SERVER's judgment, never the widget's (Salesforce's picker searchType defaults to
    /// Recent; Dynamics shows 5 most-recently-used plus 5 favourites, explicitly NOT
    /// filtered by the search term). For a .NET app author specifically: this is the
    /// guarantee that an ORDER BY in your provider handler SURVIVES TO THE SCREEN. A
    /// renderer that "helpfully" alphabetized for tidiness would silently destroy a
    /// server-side ranking with no way for the app to stop it. (Scope: this governs the
    /// PRESENTATION of Candidates; it is not a ban on the renderer having logic —
    /// deduping Bind on commit in lookup-multiple is a state write about the user's own
    /// accumulated selection, and is correct.)
    ///
    /// 🚨 Any cap MUST be VISIBLE in the tree. Nothing truncates silently. There is no
    /// wire field for a cap: the app renders a TextNode saying so — "Refine your filter —
    /// N matches, max is X", the canonical table-workflow pattern. The anti-pattern is
    /// ServiceNow's 15-result cap applied post-ACL behind a hard 250-row SQL ceiling,
    /// where an exact-match record can be SILENTLY INVISIBLE. A cap the user cannot see is
    /// a correctness bug wearing a performance knob's clothes.
    ///
    /// 🚨 The picker's filter is UX, NEVER authorization. Narrowing what is OFFERED is not
    /// a security boundary, and a filter that looks like one is precisely what gets
    /// trusted by mistake. ServiceNow says it outright: "To restrict what data specific
    /// users can access, use ACLs not reference qualifiers." The server authorizes IN THE
    /// ACTION HANDLER, with the real auth context, exactly as every other VMS action does
    /// — omitting a record from Candidates hides it from the dropdown and from nothing
    /// else, since a client that already knows an id can still put it in Bind.
    /// Omitted = no results to offer.</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<LookupItem>? Candidates = null,

    /// <summary>LOOKUP INPUTS ONLY. Path into state where the typed query lives, so the
    /// server can see it and the view stays a pure function of state. Separate from
    /// <c>Bind</c>, which holds the id — the query and the selection are different facts
    /// and never share a slot. Required for a working search: with a SearchAction but
    /// no SearchBind the query is dispatched but the server can never read what was typed
    /// — a silently dead search that renders perfectly and returns nothing forever.
    ///
    /// Keystrokes write here immediately (the query is state); ENTER dispatches
    /// SearchAction — the same cadence TableColumn filtering uses.
    ///
    /// 🚨 The query is what the user TYPED. It is NOT the display text: an input showing
    /// the selected label (a form loaded with a reference already set) holds a label, not a
    /// query, and the renderer does not flush it here. Clearing the box clears the query and
    /// reveals the label again — clearing the SEARCH TEXT is not clearing the SELECTION
    /// (only Bind holds that).
    /// Omitted = the query is not round-tripped.</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? SearchBind = null,

    /// <summary>LOOKUP INPUTS ONLY. Dispatched ON ENTER, as an ORDINARY action — the same
    /// cadence TableColumn filtering uses, and the same one <c>Action</c> uses. Keystrokes
    /// write SearchBind and dispatch nothing; there is NO debounce and NO live-query lane.
    ///
    /// 🚨 <c>ActionDescriptor.Blocking</c> means exactly what it means everywhere else, and
    /// the framework NEVER sets it. Your descriptor is dispatched as you declared it — omit
    /// Blocking (the default, blocking/serialized lane) unless you have a specific reason
    /// not to.
    ///
    /// Leaving it blocking is the recommended default, and it is a correctness property,
    /// not a preference: a blocking action is serialized by the shell's dispatch guard (a
    /// second action cannot dispatch while a round trip is in flight), so a stale search
    /// response can never land after — and clobber — a newer action. Opting into
    /// Blocking:false means "this response may be discarded, may arrive out of order, and
    /// may coexist with another in flight"; that is yours to choose, and yours to handle.
    ///
    /// 🚨 Do NOT combine with AllowCustom — it is UNSUPPORTED in v1 and warns
    /// [vms:lookup-ambiguous-enter] in the browser. One Enter cannot both invent a value and
    /// run a search. The two supported shapes are: SearchAction WITHOUT AllowCustom (a
    /// directory/reference picker — Enter searches, arrow+Enter accepts a candidate), or
    /// AllowCustom WITHOUT SearchAction (a free-form tags field — Enter invents). Declaring
    /// both ignores AllowCustom in favour of the search, loudly.
    ///
    /// ⚠️ SearchAction OCCUPIES Enter, so Action is unreachable on a lookup that declares
    /// one. Deliberate limitation, not a bug: Enter is this control's only dispatch key and
    /// the search owns it. On a searching lookup, put the submit on a ButtonNode.
    ///
    /// There is NO minimum-character gate, deliberately. An EMPTY query is a legitimate
    /// query and IS dispatched, so an app may answer it with most-recently-used candidates
    /// rather than nothing (Salesforce's picker searchType defaults to Recent).
    /// Omitted = no search; the field is a plain id input.</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? SearchAction = null,

    /// <summary>LOOKUP INPUTS ONLY. The DECLARED custom-entry axis: may the user commit a
    /// value that isn't one of the offered candidates? NEVER inferred from behavior —
    /// choosing somebody to mention is very different from inventing a new tag (different
    /// ACTS sharing one widget), so the control DECLARES which it is doing.
    ///
    /// An invented value stays a homogeneous LookupItem, never a bare string, so no
    /// union ever arises. AllowCustom:true + no Candidates + labels omitted IS a free-form
    /// tags input, with NO special case in the renderer.
    ///
    /// 🚨 Do NOT combine with SearchAction — UNSUPPORTED in v1, warns
    /// [vms:lookup-ambiguous-enter]. Type "urgent", press Enter: invent the tag, or search
    /// for it? No precedence serves both (invent-first starves the search; search-first
    /// starves invention forever), and that there is no good ordering is the tell that the
    /// shape is wrong — so v1 does not guess. Suggestions on a tags field are deferred.
    ///
    /// Whether a value was picked or invented is SERVER-DECIDABLE (the server produced
    /// every candidate it ever offered, so it tests the id against its own id space).
    /// There is deliberately no wire marker for provenance — any such marker would be
    /// client-supplied and therefore untrusted, i.e. a field that LOOKS authoritative and
    /// isn't.
    ///
    /// Dropped from the wire when false (WhenWritingDefault) → ABSENT, matching the TS
    /// optional `allowCustom?: boolean`. Omitted = false (custom entries rejected; only
    /// offered candidates commit).</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool AllowCustom = false
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
    // Visual emphasis (how loud): "primary" (filled) | "secondary" (outline).
    // Orthogonal to Tone and Size. Emits .vms-button--{emphasis}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Emphasis? Emphasis = null,
    // Semantic intent/severity ("danger"|"warning"|"success"|"info") — the
    // universal status color axis, orthogonal to Emphasis. A destructive primary
    // button is Emphasis:"primary" + Tone:"danger". Emits .vms-button--{tone}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // Box geometry ("sm"|"lg"; omit = md) — orthogonal to color/emphasis.
    // Emits .vms-button--{size}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ControlSize? Size = null,
    // Width axis ("full" = stretch to fill the container's cross axis — the
    // standard full-width/block button). Emits .vms-button--full. Omit/"auto" = hug.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ControlWidth? Width = null,
    // Forms-completeness (3.4.0). Disabled greys the button + the renderer
    // refuses to dispatch its action; drops false (WhenWritingDefault).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Disabled = false,
    // Transient label shown from click until dispatch resolves (issue #11).
    // Adapter additionally adds `.vms-button--pending` while pending so the
    // button visibly disables. Null = instant-click behavior (pre-0.8.0).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? PendingLabel = null,
    // Optional confirmation question for a destructive/irreversible action. When
    // set, the BrowserAdapter shows a NATIVE browser confirm() with this message
    // on click; the action dispatches only on accept, Cancel suppresses it (no
    // dispatch, no pendingLabel swap). Deliberately native (zero app/framework
    // state — no modal node, nothing to round-trip) + client-only: an agent
    // dispatches the action directly and is never gated. TUI dispatches as normal.
    // Null = instant dispatch.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Confirm = null
) : ViewNode;

public record TextNode(
    string Value,
    // Typography role only (NOT color) — emits .vms-text--{style}. Semantic color
    // moved to Tone (old "error"/"warning" style values are now Tone "danger"/"warning").
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] TextStyle? Style = null,
    // Semantic intent/severity color — universal tone axis, orthogonal to Style.
    // Emits .vms-text--{tone}; wins over a Style color via source order.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null
) : ViewNode;

// StatItem.Value is `string` on BOTH backends by design — the TS twin narrowed
// its `string | number` union to `string` in 6.0.0 so the two emit byte-identical
// wire (a bare number is JSON `12` in TS but this record can only emit `"12"`).
// Format numbers server-side ($"{n:F2}", n.ToString()). Tone is the optional
// universal status axis (nullable → absent when unset, per the file-header rule).
public record StatItem(
    string Label,
    string Value,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null);
public record StatBarNode(IReadOnlyList<StatItem> Stats) : ViewNode;

// ChartNode (CHARTBASE-01..06) — VMS's multi-series-native data-visualization
// primitive, drawn by the BrowserAdapter via Chart.js (a private, lazy,
// optional adapter dependency — the wire carries only data). Reshaped from the
// 4.1 single-series `{Points}` shape (the old per-point label/value record is
// fully retired for category charts) to a shared category axis (`Labels`) +
// one-or-more `Series`, each series'
// `Data[i]` aligned by index to `Labels[i]` — the honest encoding of "these
// series share one x-axis," and the shape every charting library uses.
// `Data` is `IReadOnlyList<double>` to mirror TS `number[]` (ProgressNode uses
// `int` only because it's a 0–100 integer; chart values are real magnitudes) —
// whole-number fixtures keep the wire byte-identical across TS/.NET
// (System.Text.Json emits a whole double as `12`, JSON.stringify emits `12`).
// Kind/Tone are free-form `string?` mirroring the TS CLOSED unions
// ("bar"|"line"|"area"|"pie"|"donut"; "danger"|"warning"|"success"|"info") —
// the closed set is enforced TS-side + validated by parity. Labels/Series are
// required + leading (no ignore); Kind/Title are trailing nullable +
// WhenWritingNull (absent when unset); Stacked is a `bool` default `false` +
// WhenWritingDefault so `false` (= grouped, the TS optional `stacked?` omit
// default) is ABSENT from the wire per the file-header rule — this is the
// "optional non-nullable bool whose false means absent/unset" case, not the
// "must always serialize" case. ChartNode/ChartSeries are childless/action-free
// LEAVES — both validators (WalkForSectionAction / Collect) fall through them
// with no recursion (no fits-style blind spot); the reshape adds no children,
// so neither validator gained a chart arm.
public record ChartSeries(
    string Name,
    IReadOnlyList<double> Data,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null
);

public record ChartNode(
    IReadOnlyList<string> Labels,
    IReadOnlyList<ChartSeries> Series,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ChartKind? Kind = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Stacked = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Title = null
) : ViewNode;

// Steps / stepper (NAV-02) — .NET byte-identical twin of the TS StepItem/
// StepsNode. StepItem carries only display data; per-step status (done/current/
// upcoming) is NEVER on the item — it DERIVES from the node's Current index.
// Current is a plain required int with NO ignore condition (0 is a meaningful
// value — the first step is current — so it ALWAYS crosses the wire; precedent
// ProgressNode.Value). Orientation is a string? closed-enum INTENT (NOT a C#
// enum — the closed set is enforced TS-side + validated by parity, per the
// ChartNode.Kind rule); WhenWritingNull → omitted = horizontal. StepsNode is a
// childless/action-free LEAF — both validators fall through it with no recursion.
// Tone is the optional universal status axis, ORTHOGONAL to the done/current/
// upcoming state StepsNode derives from Current — it overlays a semantic color
// onto the marker (a failed stage as Danger, one needing attention as Warning)
// regardless of position. App-authored status reinforced by the step label, so
// not color-only (mirrors Section tone). Nullable → absent when unset.
public record StepItem(
    string Label,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Description = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null
);

public record StepsNode(
    IReadOnlyList<StepItem> Steps,
    int Current,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Orientation? Orientation = null
) : ViewNode;

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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ModalSize? Size = null
) : ViewNode;

public record TableColumn(
    string Key,
    string Label,
    // Sortable/Filterable/LinkExternal are dropped from the wire when false
    // (WhenWritingDefault) → absent, matching the TS optionals (3.3.0, F2).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Sortable = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Filterable = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? FilterValue = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? LinkLabel = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool LinkExternal = false
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
    // Row lifecycle STATE (NOT severity — that's Tone). Freeform, app-extensible;
    // framework-styled set: done/disabled/running. Emits .vms-table__row--{state}.
    // APPEARANCE ONLY — State dims/tints the row and NEVER affects clickability or
    // the cursor. Clickability is governed solely by Action: a State:"disabled" row
    // that ALSO sets Action is dimmed AND still clickable (pointer + hover +
    // role=button), e.g. an already-paid invoice line shown muted but still openable.
    // To make a row literally non-clickable, omit Action (optionally still dim via State).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null,
    // Semantic intent/severity — universal tone axis ("danger"|"warning"|"success"|"info").
    // Emits .vms-table__row--{tone} (subtle tinted row background).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? NextAction = null,
    /// <summary>Dispatched when the user submits a typed target page via the jump-to-page
    /// control's Go button or Enter key. The renderer clamps the typed value into
    /// [1, totalPages] before writing it to TableNode.PaginationBind and dispatching —
    /// same mechanism as PrevAction/NextAction. Null = no jump control renders.</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? JumpAction = null
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
    // Dropped from the wire when false (WhenWritingDefault) → absent, matching
    // the TS optional `external?` (3.3.0, F2).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool External = false,
    /// <summary>true = current location ("you are here"): emits .vms-link--active
    /// + aria-current="page". Server-owned. Nullable + omitted-when-null so the wire
    /// matches the TS `active?: boolean` posture (absent = not active).</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Active = null
) : ViewNode;

// Breadcrumb (NAV-01) — .NET byte-identical twin of the TS BreadcrumbItem/
// BreadcrumbNode. One crumb mirrors LinkNode's nav model: Href = browser
// navigation (External ⇒ new tab + noopener, exactly like LinkNode.External,
// so it carries WhenWritingDefault to drop false → absent); Action = a server
// dispatch instead of a URL (the VMS navigate-by-state path, nullable +
// WhenWritingNull → absent when unset). There is NO per-item current flag —
// position is the signal (the LAST item is auto-rendered as the current page).
// A crumb that carries Action is a dispatch-bearing descendant, so the Collect
// action-name walk descends into it (see the BreadcrumbNode arm in Collect).
public record BreadcrumbItem(
    string Label,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Href = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool External = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null
);

public record BreadcrumbNode(IReadOnlyList<BreadcrumbItem> Items) : ViewNode;

// Image / media (issue #5). Src is required; Alt/Size/Shape are nullable wire
// optionals (the maintainer null-omission rule applies — absent, never null).
// Size ("small"/"medium"/"large"/"full") and Shape ("circle") are design-system
// hints → .vms-image--{size}/{shape}; non-browser adapters (TUI) degrade to Alt.
public record ImageNode(
    string Src,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Alt = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ImageSize? Size = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ImageShape? Shape = null
) : ViewNode;

public record CopyButtonNode(
    string Text,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CopiedLabel = null,
    // Visual emphasis — mirrors ButtonNode.Emphasis ("primary"|"secondary").
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Emphasis? Emphasis = null,
    // Semantic intent/severity — mirrors ButtonNode.Tone. Emits .vms-button--{tone}.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // Box geometry — mirrors ButtonNode.Size ("sm"|"lg"; omit = md).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ControlSize? Size = null,
    // Width axis — mirrors ButtonNode.Width ("full" = stretch). Emits .vms-button--full.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ControlWidth? Width = null
) : ViewNode;

// A first-class "nothing here" presentation (empty-state primitive). Heading is
// required; Message/Action are nullable wire optionals (absent, never null, per
// the file-header rule). Action is a ButtonNode carrying a real action name — a
// dispatch-bearing descendant — so BOTH validation walks (ValidateActionNames /
// ValidateSectionAction) descend into it (no icon field — the framework ships no
// icon set).
public record EmptyStateNode(
    string Heading,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Message = null,
    // Typed ViewNode? (NOT concrete ButtonNode) so System.Text.Json emits the
    // polymorphic "type":"button" discriminator — STJ only writes it when
    // serializing through the [JsonPolymorphic] base ViewNode. The same
    // maintainer rule as FormNode.SubmitButton / FormNode.Buttons; without it the
    // wire drifts from the TS twin (which always includes type:"button").
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Action = null
) : ViewNode;

// A compact status pill / count (badge primitive). Leaf node — Label required,
// Tone/Emphasis nullable wire optionals. Tone is the universal status axis
// ("danger"|"warning"|"success"|"info"); Emphasis mirrors ButtonNode
// ("primary" filled | "secondary" outline). Emits .vms-badge--{tone}/{emphasis}.
public record BadgeNode(
    string Label,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Emphasis? Emphasis = null
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

            case FitsNode fits:
                // A fits candidate can itself be a section with Action/Link (or
                // contain one), so the nested-section-interaction rules must
                // descend here too.
                foreach (var child in fits.Children) WalkForSectionAction(child, outerInteractive);
                break;

            case EmptyStateNode emptyState:
                // EmptyStateNode.Action is a ButtonNode (no SectionNode
                // descendants), but descend for consistency with every other
                // walk so a future shape can't slip an interactive section past.
                if (emptyState.Action is { } esAction) WalkForSectionAction(esAction, outerInteractive);
                break;

            // Leaf-like nodes (FieldNode, CheckboxNode, ButtonNode, TextNode,
            // LinkNode, ImageNode, StatBarNode, TabsNode, ProgressNode,
            // TableNode, CopyButtonNode, BadgeNode, ChartNode, BreadcrumbNode,
            // StepsNode) carry no SectionNode descendants. No recursion needed —
            // TableNode rows hold strings + per-row controls, not sections, so a
            // section can never sit inside a table row; ChartNode (CHART-05) is a
            // childless/action-free data leaf; BreadcrumbNode/StepsNode (NAV-01/
            // NAV-02) hold only crumb/step sub-records (no ViewNode children), so
            // neither node gained a WalkForSectionAction arm.
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
                // 5.2.0 (LOOK-06) — the lookup's live-query action participates in
                // name uniqueness exactly like every other action. Mirrors the TS
                // collectActions `case "field"` arm; both walkers must agree or a
                // duplicate name is a hard failure on one backend and a silent pass
                // on the other.
                if (field.SearchAction is { } fieldSearchAction) Record(fieldSearchAction, enclosingForm, sink);
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
                if (table.Pagination?.JumpAction is { } jump) Record(jump, enclosingForm, sink);
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

            case FitsNode fits:
                // FitsNode.Children are full ViewNode[] (can hold forms,
                // buttons, sections with action/link) — the renderer picks ONE
                // at runtime but every candidate ships on the wire, so all must
                // be validated for action-name uniqueness.
                foreach (var child in fits.Children) Collect(child, enclosingForm, sink);
                break;

            case EmptyStateNode emptyState:
                // EmptyStateNode.Action is an optional ButtonNode carrying a real
                // action name. It is a dispatch-bearing descendant, so the
                // uniqueness collector MUST descend into it — otherwise the CTA is
                // silently exempt from the one-name-one-operation rule (the
                // missed-walk failure class). Recurse so the ButtonNode arm records it.
                if (emptyState.Action is { } esAction) Collect(esAction, enclosingForm, sink);
                break;

            case BreadcrumbNode bc:
                // A crumb's optional Action is a dispatch-bearing descendant
                // (navigate-by-state), so the uniqueness collector MUST descend
                // into it — otherwise crumb dispatch names are silently exempt
                // from the one-name-one-operation rule (the missed-walk failure
                // class). Href-only crumbs record nothing. Mirrors the TabsNode arm.
                foreach (var item in bc.Items)
                    if (item.Action is { } a) Record(a, enclosingForm, sink);
                break;

            // No dispatch-bearing actions of their own:
            //   TextNode, LinkNode, ImageNode, StatBarNode, ProgressNode,
            //   CopyButtonNode, BadgeNode, ChartNode, StepsNode.
            // ChartNode (CHART-05) and StepsNode (NAV-02) are DELIBERATE
            // childless/action-free data/nav leaves — they fall through here with
            // no recursion (no fits-style blind spot). BreadcrumbNode is handled
            // above (its crumbs carry dispatch actions).
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

/// <summary>
/// 3.8.0 — thrown by <see cref="ActionPayload{TState}.Parse(HttpRequest, string)"/> when a
/// request's <c>X-VMS-Client-Build</c> header does not match the server's current-deployed
/// build id (a stale, never-reloaded tab attempting a mutation). The framework catches this
/// in <see cref="ShellExceptionFilter"/> and returns a 400 with <c>code: "stale_client"</c>,
/// so the client can reload to the fresh bundle. Thrown BEFORE <c>_state</c> is deserialized,
/// so the app's typed handler never runs on a stale client's payload. Mirrors the TS
/// <c>ERR_CODES.STALE_CLIENT</c> path.
/// </summary>
public class StaleClientException : Exception
{
    /// <summary>The build id the client advertised in the <c>X-VMS-Client-Build</c> header.</summary>
    public string ClientBuild { get; }
    /// <summary>The server's current-deployed build id the client failed to match.</summary>
    public string CurrentBuild { get; }

    public StaleClientException(string clientBuild, string currentBuild)
        : base($"Stale client: request build \"{clientBuild}\" does not match the current " +
               $"deployed build \"{currentBuild}\". Reload to continue.")
    {
        ClientBuild = clientBuild;
        CurrentBuild = currentBuild;
    }
}
