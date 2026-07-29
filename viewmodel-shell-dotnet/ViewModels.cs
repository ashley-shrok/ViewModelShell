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

/// <summary>Per-bucket status for a TrackerNode strip. A CLOSED set distinct from
/// Tone: it INCLUDES Muted (the "no data / no run" bucket) and EXCLUDES Info
/// (which would collide with Success=blue in the baked colorblind-safe palette).
/// See TrackerCell.State.</summary>
[JsonConverter(typeof(KebabEnum<TrackerState>))]
public enum TrackerState { Success, Danger, Warning, Muted }

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

/// <summary>Text typography role. v8.0.0 (COMP-01) adds Caption — the 3rd
/// typographic tier (text-xs muted with opacity), used by ListRowNode.Meta[],
/// MessageNode.Timestamp, TimelineEntryNode.Time in Phase 24-25. KebabEnum
/// naturally emits "caption" for the wire.</summary>
[JsonConverter(typeof(KebabEnum<TextStyle>))]
public enum TextStyle { Heading, Subheading, Body, Muted, Pre, Strikethrough, Caption }

/// <summary>Type-weight axis (v8.0.0, COMP-02) — orthogonal to TextStyle
/// and Tone. Values are the standard OpenType body-tier weights: Regular=400
/// (default when omitted), Medium=500 (the semi-bold anchor consumed by
/// composite row primaries in Phase 24-25), Bold=700. Closed enum;
/// kebab-lowercase wire values "regular"/"medium"/"bold". A body-styled
/// TextNode can be Weight:Medium without becoming a heading — Option A shape
/// (new orthogonal field) chosen over Option B (Style:"Strong") so the two
/// axes stay separable.</summary>
[JsonConverter(typeof(KebabEnum<TextWeight>))]
public enum TextWeight { Regular, Medium, Bold }

/// <summary>v8.0.0 (COMP-03) — CheckboxNode visual variant. Closed enum:
/// Checkbox (default, byte-identical to today's render) vs Switch (slider-
/// track + thumb, .vms-field--switch modifier). Wire and dispatch semantics
/// are UNCHANGED across the two values — value is still boolean, dispatch is
/// still bind/change on the underlying &lt;input type="checkbox"&gt;. Only the
/// className list + native ARIA role differ (role="switch" when Switch).
/// KebabEnum naturally emits "checkbox" / "switch" for the wire.</summary>
[JsonConverter(typeof(KebabEnum<CheckboxVariant>))]
public enum CheckboxVariant { Checkbox, Switch }

/// <summary>v8.0.0 (COMP-09) — UserRowNode.Status.Kind. Closed 4-value enum
/// driving the shipped status-dot palette via CSS class emission
/// (.vms-status-dot--online / --away / --offline / --busy). Wire values
/// (kebab-lowercase via KebabEnum): "online" / "away" / "offline" / "busy",
/// byte-identical to the TS closed union. Kind→color mapping baked in
/// default.css: online→--vms-success, away→--vms-warning, offline→muted
/// (60% of --vms-text-muted), busy→--vms-error.</summary>
[JsonConverter(typeof(KebabEnum<StatusKind>))]
public enum StatusKind { Online, Away, Offline, Busy }

/// <summary>v8.0.0 (COMP-10a) — DetailListNode label column width. Closed enum
/// mapping to fixed rem values (sm=8rem, md=10rem, lg=12rem). Omitted on the
/// wire = md (default; no modifier class emitted, byte-identical to md set
/// explicitly). The value is read as the `--vms-detail-label` CSS variable
/// on `.vms-detail-list`, which each `.vms-detail-row`'s grid consumes as
/// `grid-template-columns: var(--vms-detail-label) 1fr`. KebabEnum emits
/// "sm" / "md" / "lg" byte-identical to the TS closed union.</summary>
[JsonConverter(typeof(KebabEnum<DetailLabelWidth>))]
public enum DetailLabelWidth { Sm, Md, Lg }

/// <summary>
/// A section's structural surface kind. `Card` = grouped surface
/// (background/border/padding/radius, .vms-section--card). `Prose` = block-flow
/// prose-typography scope for markdown/rich-text content (.vms-section--prose,
/// the Tailwind Typography "prose" plugin ported into VMS tokens: block layout
/// with collapsing margins, asymmetric heading spacing, real &lt;ul&gt;/&lt;ol&gt; bullets
/// with hanging indent, prose blockquote/code-block/figure treatment). Wrap
/// markdown-converter output in a prose section:
/// `new SectionNode(Heading: null, Children: MarkdownConverter.ToViewNodes(md), Variant: SectionVariant.Prose)`.
/// App UI (dashboards, forms, tables) does NOT use prose — the default flex+gap
/// page layout is correct there.
/// </summary>
[JsonConverter(typeof(KebabEnum<SectionVariant>))]
public enum SectionVariant { Card, Prose }

/// <summary>v7.0.0 (ICON-01) — icon pixel size axis. The framework-owned
/// mapping is xs=12, sm=16, md=20 (default when omitted), lg=24, xl=32. Emits
/// .vms-icon--{size}. Byte-identical wire values as the TS union
/// `"xs" | "sm" | "md" | "lg" | "xl"`. Separate from ControlSize (buttons) and
/// MinItem (cards) — icons carry a distinct semantic axis with its own set of
/// 5 members. See `.planning/design/icons-primitive.md` §3.</summary>
[JsonConverter(typeof(KebabEnum<IconSize>))]
public enum IconSize { Xs, Sm, Md, Lg, Xl }

/// <summary>v8.0.0 (COMP-04) — AvatarNode circle diameter axis. Framework-owned
/// rem mapping: sm=1.5rem, md=2rem (default), lg=2.5rem, xl=3rem. Distinct
/// enum from IconSize (which is px-mapped, xs..xl) because avatar sizes are
/// container-sized (rem) and the value set differs (4 vs 5 members). Closed
/// union, kebab-lowercase wire values ("sm"/"md"/"lg"/"xl") — KebabEnum handles
/// the conversion naturally for these single-token members.</summary>
[JsonConverter(typeof(KebabEnum<AvatarSize>))]
public enum AvatarSize { Sm, Md, Lg, Xl }

/// <summary>v8.0.0 (COMP-05a) — ListNode layout variant. Closed enum.
/// Items (default when omitted, byte-identical to the pre-Phase-24 render) =
/// today's ListItem-only container. Rows = a single-bordered-surface container
/// that accepts ONLY ListRowNode children — tree-validator rejects a mixed
/// tree (a ListItem inside a Rows list or a ListRowNode inside an Items list
/// fails with invalid_tree). Old renderers gracefully degrade on an unknown
/// variant. KebabEnum emits "items" / "rows" for the wire.</summary>
[JsonConverter(typeof(KebabEnum<ListVariant>))]
public enum ListVariant { Items, Rows }

/// <summary>v8.0.0 (COMP-06) — MessageNode role. Closed enum controlling
/// surface tone on the message content surface. "assistant" tints info; every
/// other value (and the absent case) renders on the neutral surface. Closed
/// union enforced on both backends per the closed-union-must-be-enum
/// discipline. KebabEnum emits "user" / "assistant" / "system" for the wire.
/// </summary>
[JsonConverter(typeof(KebabEnum<MessageRole>))]
public enum MessageRole { User, Assistant, System }

/// <summary>v7.0.0 (ICON-01/02) — JSON converter for IconName that walks a
/// static dictionary mapping each enum member to its exact literal Lucide
/// name (kebab-case with digit-boundary awareness, e.g. Trash2 → "trash-2").
///
/// <para>NOT KebabEnum{T}: the framework's KebabCaseLower policy fails to
/// insert a hyphen between letters and digits, so Trash2 → "trash2" and
/// CheckCircle2 → "check-circle2" — a silent cross-backend drift with the TS
/// twin's `"trash-2"` / `"check-circle-2"` union literals. This converter
/// spells every member's wire value explicitly.</para>
///
/// <para>The dictionary is the single source of truth for the .NET wire
/// contract. Every new member must be added here in the same change that
/// adds the enum member; a build-time integrity check (below) throws on
/// missing entries so the requirement disappears structurally rather than
/// having to be remembered.</para></summary>
public sealed class IconNameConverter : JsonConverter<IconName>
{
    // Explicit member → wire-string mapping. Byte-identical to the TS
    // IconName union literals in viewmodel-shell/src/index.ts.
    private static readonly IReadOnlyDictionary<IconName, string> _toWire = new Dictionary<IconName, string>
    {
        // Actions (24)
        [IconName.Check] = "check", [IconName.X] = "x", [IconName.Plus] = "plus",
        [IconName.Minus] = "minus", [IconName.Edit] = "edit", [IconName.Edit3] = "edit-3",
        [IconName.Trash] = "trash", [IconName.Trash2] = "trash-2", [IconName.Save] = "save",
        [IconName.Download] = "download", [IconName.Upload] = "upload", [IconName.Copy] = "copy",
        [IconName.Clipboard] = "clipboard", [IconName.ClipboardCopy] = "clipboard-copy",
        [IconName.Share] = "share", [IconName.Share2] = "share-2",
        [IconName.RefreshCw] = "refresh-cw", [IconName.RotateCcw] = "rotate-ccw",
        [IconName.Search] = "search", [IconName.Filter] = "filter",
        [IconName.Send] = "send", [IconName.Printer] = "printer",
        [IconName.Pencil] = "pencil", [IconName.Eye] = "eye",
        // Status (10)
        [IconName.CheckCircle] = "check-circle", [IconName.CheckCircle2] = "check-circle-2",
        [IconName.XCircle] = "x-circle", [IconName.AlertCircle] = "alert-circle",
        [IconName.AlertTriangle] = "alert-triangle", [IconName.AlertOctagon] = "alert-octagon",
        [IconName.Info] = "info", [IconName.HelpCircle] = "help-circle",
        [IconName.Ban] = "ban", [IconName.Loader2] = "loader-2",
        // Navigation (14)
        [IconName.Home] = "home", [IconName.Menu] = "menu",
        [IconName.MoreHorizontal] = "more-horizontal", [IconName.MoreVertical] = "more-vertical",
        [IconName.ExternalLink] = "external-link",
        [IconName.ChevronLeft] = "chevron-left", [IconName.ChevronRight] = "chevron-right",
        [IconName.ChevronUp] = "chevron-up", [IconName.ChevronDown] = "chevron-down",
        [IconName.ArrowLeft] = "arrow-left", [IconName.ArrowRight] = "arrow-right",
        [IconName.ArrowUp] = "arrow-up", [IconName.ArrowDown] = "arrow-down",
        [IconName.ArrowUpRight] = "arrow-up-right",
        // Content (14)
        [IconName.BookOpen] = "book-open", [IconName.Receipt] = "receipt",
        [IconName.File] = "file", [IconName.FileText] = "file-text",
        [IconName.Folder] = "folder", [IconName.FolderOpen] = "folder-open",
        [IconName.Image] = "image", [IconName.Paperclip] = "paperclip",
        [IconName.Link] = "link", [IconName.Link2] = "link-2",
        [IconName.Calendar] = "calendar", [IconName.Clock] = "clock",
        [IconName.Bookmark] = "bookmark", [IconName.Mail] = "mail",
        // Communication (5)
        [IconName.MessageSquare] = "message-square", [IconName.MessageCircle] = "message-circle",
        [IconName.AtSign] = "at-sign", [IconName.Phone] = "phone", [IconName.Bell] = "bell",
        // People (5)
        [IconName.User] = "user", [IconName.UserPlus] = "user-plus",
        [IconName.UserCheck] = "user-check", [IconName.Users] = "users",
        [IconName.UserX] = "user-x",
        // Objects (10)
        [IconName.Wrench] = "wrench", [IconName.ShieldCheck] = "shield-check",
        [IconName.Shield] = "shield", [IconName.Lock] = "lock",
        [IconName.Unlock] = "unlock", [IconName.Key] = "key",
        [IconName.Star] = "star", [IconName.Heart] = "heart",
        [IconName.Tag] = "tag", [IconName.Flag] = "flag",
        // Data / system (16)
        [IconName.Activity] = "activity", [IconName.Workflow] = "workflow",
        [IconName.Route] = "route", [IconName.Database] = "database",
        [IconName.Server] = "server", [IconName.HardDrive] = "hard-drive",
        [IconName.Cloud] = "cloud", [IconName.Wifi] = "wifi",
        [IconName.BarChart] = "bar-chart", [IconName.LineChart] = "line-chart",
        [IconName.PieChart] = "pie-chart", [IconName.Gauge] = "gauge",
        [IconName.Layers] = "layers", [IconName.Settings] = "settings",
        [IconName.Cpu] = "cpu", [IconName.Terminal] = "terminal",
        // Magic / accents (4)
        [IconName.Sparkles] = "sparkles", [IconName.Zap] = "zap",
        [IconName.Wand2] = "wand-2", [IconName.Flame] = "flame",
    };

    private static readonly IReadOnlyDictionary<string, IconName> _fromWire
        = _toWire.ToDictionary(kv => kv.Value, kv => kv.Key);

    // Build-time integrity check — every enum value present in _toWire. Runs
    // on the type's static initialization; a missing entry throws at
    // JsonSerializer construction time, not silently at wire time.
    static IconNameConverter()
    {
        var missing = Enum.GetValues<IconName>()
            .Where(v => !_toWire.ContainsKey(v))
            .ToList();
        if (missing.Count > 0)
        {
            throw new InvalidOperationException(
                $"IconNameConverter: missing wire-value mapping for enum members: " +
                string.Join(", ", missing));
        }
    }

    public override IconName Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        var s = reader.GetString();
        if (s is null || !_fromWire.TryGetValue(s, out var name))
        {
            throw new JsonException($"Unknown IconName wire value: {s ?? "(null)"}");
        }
        return name;
    }

    public override void Write(Utf8JsonWriter writer, IconName value, JsonSerializerOptions options)
    {
        writer.WriteStringValue(_toWire[value]);
    }
}

/// <summary>v7.0.0 (ICON-01/02) — closed union of every icon name the framework
/// ships. The curated Lucide subset (~102 names) that inline-bundles into the
/// browser adapter as SVG path payloads. The wire carries ONLY the name; the
/// framework owns the SVG. Unknown names fail the tree validator (invalid_tree).
///
/// <para>Categories (see `.planning/design/icons-primitive.md` §6 for the
/// rationale): Actions (24), Status (10), Navigation (14), Content (14),
/// Communication (5), People (5), Objects (10), Data/system (16),
/// Magic/accents (4). All 8 Pixie/Hestia concept anchors — Sparkles, Wrench,
/// ShieldCheck, Route, BookOpen, Activity, Workflow, Receipt — are members by
/// literal name.</para>
///
/// <para>Grows by ADDITION only: consumers who need an icon not in this set
/// open a bounty; the framework adds the SVG + the enum member in a minor
/// release. Existing consumer code compiles untouched (per Ashley's 2026-07-16
/// additive-enum-member correction). This is a CLOSED UNION on the .NET twin
/// per AGENTS.md gotcha #8/#9 — a `string?` here would create a 38th open
/// union in the known live class-1 gap.</para>
///
/// <para>PascalCase member names ↔ kebab-case wire values via a static
/// dictionary walked by IconNameConverter (the single source of truth for the
/// wire contract). KebabEnum{T} is NOT used here because its
/// JsonNamingPolicy.KebabCaseLower does not split digits from letters — it
/// emits Trash2 → "trash2", not "trash-2", which would silently drift from
/// the TS union. The dictionary is one place to grep for the full member
/// list and is byte-identical to the TS twin (Plan 22-01's IconName union
/// literals).</para></summary>
[JsonConverter(typeof(IconNameConverter))]
public enum IconName
{
    // Actions (24)
    Check, X, Plus, Minus, Edit, Edit3, Trash, Trash2,
    Save, Download, Upload, Copy, Clipboard, ClipboardCopy,
    Share, Share2, RefreshCw, RotateCcw, Search, Filter,
    Send, Printer, Pencil, Eye,
    // Status (10)
    CheckCircle, CheckCircle2, XCircle, AlertCircle,
    AlertTriangle, AlertOctagon, Info, HelpCircle, Ban,
    Loader2,
    // Navigation (14)
    Home, Menu, MoreHorizontal, MoreVertical, ExternalLink,
    ChevronLeft, ChevronRight, ChevronUp, ChevronDown,
    ArrowLeft, ArrowRight, ArrowUp, ArrowDown, ArrowUpRight,
    // Content (14)
    BookOpen, Receipt, File, FileText, Folder, FolderOpen,
    Image, Paperclip, Link, Link2, Calendar, Clock,
    Bookmark, Mail,
    // Communication (5)
    MessageSquare, MessageCircle, AtSign, Phone, Bell,
    // People (5)
    User, UserPlus, UserCheck, Users, UserX,
    // Objects (10)
    Wrench, ShieldCheck, Shield, Lock, Unlock, Key,
    Star, Heart, Tag, Flag,
    // Data / system (16)
    Activity, Workflow, Route, Database, Server, HardDrive,
    Cloud, Wifi, BarChart, LineChart, PieChart, Gauge,
    Layers, Settings, Cpu, Terminal,
    // Magic / accents (4)
    Sparkles, Zap, Wand2, Flame
}

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
[JsonDerivedType(typeof(BlockquoteNode), "blockquote")]
[JsonDerivedType(typeof(CodeBlockNode),  "code-block")]
[JsonDerivedType(typeof(BreadcrumbNode), "breadcrumb")]
[JsonDerivedType(typeof(StepsNode),      "steps")]
[JsonDerivedType(typeof(TrackerNode),    "tracker")]
[JsonDerivedType(typeof(DiffNode),       "diff")]
[JsonDerivedType(typeof(IconNode),       "icon")]
[JsonDerivedType(typeof(AvatarNode),     "avatar")]
[JsonDerivedType(typeof(ListRowNode),    "list-row")]
[JsonDerivedType(typeof(MessageNode),     "message")]
[JsonDerivedType(typeof(MessageListNode), "message-list")]
[JsonDerivedType(typeof(AlertNode),       "alert")]
[JsonDerivedType(typeof(UserRowNode),     "user-row")]
[JsonDerivedType(typeof(DetailRowNode),   "detail-row")]
[JsonDerivedType(typeof(DetailListNode),  "detail-list")]
[JsonDerivedType(typeof(TimelineEntryNode), "timeline-entry")]
[JsonDerivedType(typeof(TimelineNode),      "timeline")]
[JsonDerivedType(typeof(SettingRowNode),    "setting-row")]
[JsonDerivedType(typeof(SettingListNode),   "setting-list")]
[JsonDerivedType(typeof(ChipNode),          "chip")]
[JsonDerivedType(typeof(ChipListNode),      "chip-list")]
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool FollowTail = false,
    // v7.0.0 (ICON-04) — leading icon by name from the curated Lucide subset.
    // Name-only, NOT an IconNode child — host owns appearance (rendered as a
    // prominent header icon at size xl; tone inherits from Section.Tone if
    // set, else currentColor), icon carries content. The Hestia launcher-card
    // use case (each of 8 Variant:Card sections carries a concept-anchor icon).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null
) : ViewNode;

public record ListNode(
    IReadOnlyList<ViewNode> Children,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Id = null,
    // Ordered (<ol>) vs unordered (<ul>). Semantic "unset" is false = the CLR
    // default, so WhenWritingDefault drops it from the wire (matching the TS
    // optional `ordered?: boolean`, absent when unset) — same posture as
    // PageNode/SectionNode.Fill, LinkNode.External, FieldNode.Required.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Ordered = false,
    // v8.0.0 (COMP-05a) — Layout variant. Omitted (null) or Items = today's
    // ListItem-only container (byte-identical to the pre-Phase-24 render).
    // Rows = a single-bordered-surface container accepting ONLY ListRowNode
    // children (tree-validator rejects mixed). Positional field appended at the
    // END (zero-retype construction sites — same convention as CheckboxNode.
    // Variant Phase 23). Nullable enum + WhenWritingNull per the file-header
    // rule; matches the TS `variant?: "items" | "rows"` closed union.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ListVariant? Variant = null
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

// A quoted block of content — the standard blockquote primitive. Holds arbitrary
// block-level Children (paragraphs, lists, nested blockquotes, any ViewNode).
// Renders as a real semantic <blockquote> HTML element (screen-reader landmark;
// agent-legible from the DOM tag). Maps to markdown's `> ...`. Chosen as a
// dedicated primitive (not a SectionNode variant) because section variants
// describe surface KIND, whereas blockquote is a semantic content KIND —
// mixing them on one axis blurs concepts. And chosen as a children-bearing
// node (not a TextNode style) because quotes hold block-level content, not
// just formatted text. Children is a dispatch-bearing descendant path: both
// walker arms (Collect + WalkForSectionAction) descend into it so any button/
// action inside a quoted callout participates in the action-name uniqueness
// check.
public record BlockquoteNode(
    IReadOnlyList<ViewNode> Children
) : ViewNode;

// A display-only code block — the standard fenced-code primitive (markdown
// ```language...```). Renders as a real semantic <pre><code> pair with an
// optional header row for Filename + Language badge + built-in copy button.
// Non-interactive (no bind, no action) — for an EDITABLE code input use
// FieldNode with InputType "code" instead.
//
// v1 ships with NO syntax highlighting — plain monospace + language/filename
// metadata (agent-legibility: an agent reading the wire sees "python"/"handler.ts",
// not just "a code block"). Deferring highlighting keeps the surface small and
// avoids the AA-contrast gate hole (the fixed-13-pair check:aa-contrast gate
// cannot cover new token/bg pairs; see the AGENTS.md "gate that checks shape
// not property" family of banked lessons).
//
// Copyable defaults to true (copy button shown). Set Copyable:false to hide it
// for a display-only excerpt. The copy button lives inside the header row and
// uses the framework's shared clipboard-write path (behavior parity with
// CopyButtonNode — the "provide-your-own-X embedded slots are divergence
// risks" lesson: share the render, don't parallel-implement).
public record CodeBlockNode(
    string Code,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Language = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Filename = null,
    // Nullable bool: absent = default (copy button shown), true = redundant but
    // valid, false = explicitly hidden. WhenWritingNull ⇒ omitted absent on the
    // wire; false is a MEANINGFUL value and MUST cross (matches the TS twin).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Copyable = null
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // Task-list marker (GFM `- [ ]` / `- [x]`). Non-interactive — the framework
    // draws a FIXED check glyph in front of the item content when set (filled
    // check when true, empty box when false, nothing when absent). Distinct
    // from a CheckboxNode child: this is a semantic checklist ITEM, not a form
    // input, so it has no bind and no action and is never clickable. For an
    // interactive check that dispatches on toggle, use a CheckboxNode child.
    // Wire posture: WhenWritingNull => omitted absent (nullable bool so `false`
    // is meaningful as "explicitly unchecked" and MUST cross the wire).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Completed = null,
    // v7.0.0 (ICON-04) — leading icon by name from the curated Lucide subset.
    // Name-only, NOT an IconNode child — host owns appearance (rendered leading
    // before the item content at size sm; tone inherits from ListItem.Tone if
    // set, else currentColor), icon carries content.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool AllowCustom = false,
    // 6.12.0 (TOOL-01) — hover-only info tooltip. String only (no interaction
    // shape possible on the wire). See FieldNode.tooltip in src/index.ts for
    // full semantics. WhenWritingNull ⇒ absent, matching the TS twin.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tooltip = null
) : ViewNode;

public record CheckboxNode(
    string Name,
    /// <summary>Path into state where this input reads its current value and writes user changes (e.g. "fields.acceptedTos").</summary>
    string Bind,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action,
    // 6.12.0 (TOOL-01) — hover-only info tooltip. See FieldNode.Tooltip.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tooltip = null,
    // v8.0.0 (COMP-03) — visual variant; "switch" restyles as a slider track+thumb.
    // Wire and dispatch semantics unchanged from the default. WhenWritingNull posture
    // per gotcha #8: absent = "checkbox" (today's default), NEVER emit as null.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] CheckboxVariant? Variant = null
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Confirm = null,
    // 6.12.0 (TOOL-01) — hover-only info tooltip. See FieldNode.Tooltip.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tooltip = null,
    // v7.0.0 (ICON-04) — leading icon by name from the curated Lucide subset.
    // Name-only, NOT an IconNode child — host owns appearance (rendered
    // leading before the label at size sm; tone inherits from Button.Tone),
    // icon carries content.
    //
    // Icon-only-button a11y rule (enforced by the tree validator on both
    // backends): Icon != null AND string.IsNullOrEmpty(Label) AND Tooltip ==
    // null throws invalid_tree with the byte-identical message
    // "icon-only ButtonNode requires tooltip (used as aria-label)". The
    // shipped Tooltip field double-duties as the button's aria-label on the
    // icon-only case (design-doc §5).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null
) : ViewNode;

/// <summary>One inline run — a contiguous piece of text inside a paragraph,
/// carrying intra-paragraph emphasis and/or a link target. The unit of VMS's
/// inline rich-text vocabulary (TextNode.Runs, DiffCell.Runs).
///
/// <para>WHY A FLAT RUN LIST, NOT A NESTED INLINE TREE: a nested model has
/// combinatorially many encodings of one visual result (strong(em(x)) vs
/// em(strong(x)); strong("a"),strong("b") vs strong("ab")). VMS keeps its two
/// backends honest by STRUCTURALLY DIFFING the JSON they produce, so a model
/// where both backends can be correct yet compare as different defeats the whole
/// gate. Flat runs have exactly ONE encoding per result. (A nested model would
/// also need a style-inheritance/merge rule implemented identically here and in
/// TypeScript — two cascades diverging silently is the failure class we cannot
/// detect.)</para>
///
/// <para>WHY FLAGS, NOT A MARKS ARRAY: not because an array has order (a sorted
/// array is equally canonical). Because Href/External are already PARAMETERIZED
/// marks in this same record, so the model is inherently a hybrid — valueless
/// marks as flags, parameterized marks as named fields. A marks array would have
/// to become an array of objects to carry a link target, i.e. a worse nested
/// model. EXTENSION POLICY: a new valueless mark becomes a new bool here; a new
/// parameterized mark becomes a named field, exactly as Href did. Another
/// string-valued field that later wants rich text gains a SIBLING Runs field (as
/// DiffCell did) — never a union type on the wire.</para>
///
/// <para>The four emphasis flags are non-nullable bool + WhenWritingDefault, so
/// false is ABSENT on the wire and there is exactly ONE encoding of "off" —
/// matching the TS twin, whose flags are typed literal `true` rather than
/// `boolean` for the same reason. A bool? here would admit an explicit false,
/// which normalize.ts does not drop and findNulls does not flag: a fresh
/// cross-backend drift class in gotcha #8's family.</para>
///
/// <para>⚠️ A RUN CARRIES NO ACTION — Href only, and that is STRUCTURAL. A type
/// needs an arm in ViewTreeValidation.Collect / WalkForSectionAction (and their
/// TS twins) iff it holds child nodes or an ActionDescriptor. InlineRun holds
/// NEITHER, so ZERO walker changes were needed — the requirement disappears
/// structurally instead of having to be remembered. That matters because a
/// missing walker arm fails SILENTLY on both backends and nothing gates walker
/// parity (see the tracker-net-walker-gap note in Collect below). IF THIS RECORD
/// EVER GAINS AN ACTION, BOTH WALKERS NEED AN ARM ON BOTH BACKENDS.</para></summary>
public record InlineRun(
    // The run's literal text. Always rendered via textContent — never as HTML.
    string Text,
    // Bold emphasis -> <strong class="vms-text__strong">.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Bold = false,
    // Italic emphasis -> <em class="vms-text__em">.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Italic = false,
    // Inline code -> <code class="vms-text__code">. A SEMANTIC run, not a font
    // knob: for a whole monospace block use TextStyle.Pre.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Code = false,
    // Struck text -> <s class="vms-text__strike">. Distinct from
    // TextStyle.Strikethrough, which strikes the WHOLE node AND recolors it to the
    // muted "done" tone; this is emphasis only and never recolors.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Strike = false,
    // Link target -> wraps the run in <a class="vms-text__link">. Presence alone
    // makes the run a link (shape carries the meaning; no kind discriminator).
    // ADJACENT runs with an IDENTICAL Href + External coalesce into exactly ONE
    // anchor, so "a link containing a bold word" is not two tab stops.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Href = null,
    // true = open outside the current app context. Only meaningful with Href.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool External = false
);

// TextNode with a Level (1–6) emits a real <h1>–<h6> tag on the browser side —
// the standard heading landmark screen readers announce with the right depth
// and agents read directly from the DOM tag. Composes with Runs, Tone, and
// Style; precedence rule: Level wins over Style.Pre when both are set (level
// names a semantic outline element; style is a typography role). Existing
// TextStyle.Heading / TextStyle.Subheading remain supported (backward compat)
// but are deprecated in favor of Level for new code — they render as styled
// <span>s with no landmark semantics.
public record TextNode(
    // The plain-text reading. REQUIRED and unchanged — it is simultaneously the
    // rendering when Runs is null, the FALLBACK for adapters that do not implement
    // runs (the TUI renders it verbatim and needed no change), and the
    // agent-legible form. When Runs is set, prefer TextNode.FromRuns(...) so this
    // is DERIVED rather than typed twice. Nothing enforces the match at runtime,
    // deliberately: enforcing it would criminalize the legitimate degradation
    // pattern (spelling a URL out here while Runs carries a proper link), and a
    // validator would give TextNode a walker arm on both backends — reintroducing
    // the asymmetric-walker risk the no-actions rule eliminates. The framework's
    // own reference usage is gated in CI (parity feature-probe fixture) instead.
    string Value,
    // Typography role only (NOT color) — emits .vms-text--{style}. Semantic color
    // moved to Tone (old "error"/"warning" style values are now Tone "danger"/"warning").
    // Orthogonal to Runs: Style is the NODE-level typography role, Runs is
    // intra-paragraph emphasis. With TextStyle.Pre the runs nest inside the <pre>.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] TextStyle? Style = null,
    // Semantic intent/severity color — universal tone axis, orthogonal to Style.
    // Emits .vms-text--{tone}; wins over a Style color via source order.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // ⚠️ Runs is positional slot 4 — appended LAST on purpose. TextNode has ~96
    // construction sites (max arity 3 in use), so a defaulted 4th parameter changes
    // ZERO of them, whereas inserting it earlier would silently retype every 2- and
    // 3-arg call. The TS twin declares `runs` before `style` for readability; JSON
    // key ORDER is not load-bearing (the parity diff compares key sets, not order),
    // which is what makes the two orderings safe. PASS IT BY NAME (Runs: [...]).
    // Omit (null) for a plain paragraph — never pass an empty list, which would
    // serialize as a present-but-empty [] and is a distinct wire state.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<InlineRun>? Runs = null,
    // Semantic outline level 1–6. When set, the renderer emits a real <h1>–<h6>
    // HTML tag (screen-reader landmark; agent-legible from DOM tag alone) instead
    // of the default <span>. Same last-slot rule as Runs — appended so no
    // existing 2-/3-/4-arg construction site is retyped. PASS BY NAME (Level: 2).
    // Valid range 1–6; the renderer clamps at runtime and falls back to <span>
    // for out-of-range values, so a wire value of 7 renders as a fallback span
    // rather than an invalid <h7>. Wire posture: WhenWritingNull => omitted
    // absent, matching the closed-union convention (TS twin: `level?: 1|2|3|4|5|6`).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Level = null,
    // 6.12.0 (TOOL-01) — hover-only info tooltip. See FieldNode.Tooltip.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tooltip = null,
    // v8.0.0 (COMP-02) — type-weight axis, orthogonal to Style and Tone.
    // Appended LAST (same "append-last for zero-retype construction sites" rule
    // as Runs / Level / Tooltip above — every existing 1-/2-/3-/4-/5-/6-arg
    // construction site is unaffected). PASS BY NAME (Weight: TextWeight.Medium).
    // Wire posture: WhenWritingNull => absent, NEVER "weight":null (gotcha #8).
    // Omitted = the framework default weight for the node's Style (400 for
    // body/muted/caption; the shipped style's own weight for heading/subheading).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] TextWeight? Weight = null
) : ViewNode
{
    /// <summary>Build a TextNode from inline runs, DERIVING Value as the
    /// concatenation of the run texts so the plain reading and the rich reading
    /// cannot disagree. Prefer this over writing Value by hand whenever Runs is
    /// set. (Use the primary constructor directly only for the deliberate
    /// divergence case — e.g. spelling a URL out in Value so link-less adapters
    /// still show the target.)</summary>
    public static TextNode FromRuns(IReadOnlyList<InlineRun> runs, TextStyle? style = null, Tone? tone = null)
        => new(string.Concat(runs.Select(r => r.Text)), style, tone, runs);
}

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

/// <summary>One bucket in a TrackerNode strip. State drives the cell color via the
/// framework's baked colorblind-safe palette (Success=blue, Danger=red,
/// Warning=amber, Muted=gray); only the color diverges from the global tones — the
/// state name stays semantic on the wire. Tooltip is the hover tooltip (rendered
/// via the shipped 6.12.1 body-appended <c>.vms-tooltip-host</c> singleton — same
/// infrastructure as ButtonNode.Tooltip / TableColumn.Tooltip) + aria-label
/// (carries meaning as TEXT, not color alone). Action is an optional per-bucket
/// click-through (per-bucket identity in the action name, like TableRow.Action).
///
/// <para>⚠️ RENAMED in v7.0.0 (ICON-06). The old <c>Label</c> parameter is now
/// <c>Tooltip</c>; consumers change <c>Label:</c> → <c>Tooltip:</c> in their
/// buildVm. Same type, same semantics; the render path was upgraded to the
/// styled tooltip infrastructure that already ships for 8 other nodes.</para></summary>
public record TrackerCell(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] TrackerState? State = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tooltip = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null
);

/// <summary>A status tracker / heat strip — a tight horizontal row of discrete
/// colored cells, one per time bucket (uptime-strip / sentinel-history primitive;
/// NOT a numeric value sparkline). The framework owns all appearance and a11y: the
/// hairline gap, the intrinsic shrink-then-scroll overflow, and the baked
/// colorblind-safe palette. Bucket count is simply Cells.Count.</summary>
public record TrackerNode(
    IReadOnlyList<TrackerCell> Cells,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Id = null
) : ViewNode;

/// <summary>Optional header row for a DiffNode showing file paths (or any labels)
/// for the old vs new side. In side-by-side mode the two labels appear above their
/// respective column-groups; in unified mode they join into a single header row
/// joined by " → ".</summary>
public record DiffHeader(string Old, string New);

/// <summary>One cell of a diff row (either the "old" side or the "new" side).
/// Carries the cell's text plus an optional line number for the gutter. Text may
/// be an empty string. The wire distinction "cell present but empty" vs "cell
/// absent" (the null case on the parent DiffRow) carries meaning — see DiffRow.</summary>
public record DiffCell(
    string Text,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? LineNumber = null,
    // OPTIONAL inline runs for WORD-LEVEL intra-line highlighting — the feature
    // DiffNode v1 deferred pending "the inline rich text architectural question",
    // now answered. Same contract as TextNode.Runs: when present the renderer draws
    // the runs instead of Text, and Text stays REQUIRED as the plain reading +
    // fallback + agent-legible form. Consumers still compute the word-level diff
    // themselves (server-computes / framework-renders) and express it as runs —
    // typically Strike for removed words on the old side, Bold for added on the new.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<InlineRun>? Runs = null
);

/// <summary>One row of a DiffNode. Row-KIND (add / remove / context) is derived
/// CLIENT-SIDE from the shape of the row itself — no separate `kind` wire field:
/// old != null &amp;&amp; new == null → REMOVE; old == null &amp;&amp; new != null → ADD;
/// old.Text == new.Text → CONTEXT; old.Text != new.Text → modified pair (both
/// cells side-by-side and tinted in side-by-side mode; splits into REMOVE + ADD
/// in unified mode). This "shape carries the meaning" pattern makes it impossible
/// for a kind label to disagree with the content and keeps the wire compact.
/// Line numbers are optional so diff sources that don't track them degrade to a
/// content-only column.</summary>
public record DiffRow(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DiffCell? Old = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DiffCell? New = null
);

/// <summary>DiffNode — aligned before/after primitive for review, audit, and
/// change-comparison apps. Consumers compute the diff server-side (LibGit2Sharp,
/// git diff --json, whatever they have) and hand VMS the structured rows — same
/// server-computes / framework-renders doctrine as the markdown → tree pattern.
/// The framework owns ALL appearance and a11y: the CSS-Grid alignment (4 tracks
/// in side-by-side, 3 in unified), the tint + left-stripe row coloring, the
/// long-line horizontal-scroll-per-cell that preserves row alignment, the
/// empty-cell styling, the tinted line numbers, and the unified-mode collapse of
/// the two linenum columns into a single left margin. Aligned side-by-side is a
/// genuinely uncomposable capability that no combination of existing nodes
/// produces — this is the CHARTS/TRACKER precedent applied to before/after
/// content. Explicitly out of scope for v1: syntax highlighting on cells (a
/// separate CodeBlockNode question), word-level intra-line highlighting (would
/// need inline rich text, an open architectural question), in-line review
/// comments, and collapse/expand of hunks (consumers who want that compute a
/// smaller Rows array server-side).</summary>
public record DiffNode(
    IReadOnlyList<DiffRow> Rows,
    // Layout mode. Free-form string mirroring the TS closed union
    // "unified"|"side-by-side". Omitted = "side-by-side" (the default — the whole
    // reason this primitive exists over composition of two `pre` blocks).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Mode = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DiffHeader? Header = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Id = null
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool LinkExternal = false,
    // 6.12.0 (TOOL-01) — hover-only info tooltip on the column HEADER. Useful
    // for annotating short header labels ("MTD", "Δ 7d") with a full
    // explanation. See FieldNode.Tooltip.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tooltip = null
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] TablePagination? Pagination = null,
    /// <summary>Visible-scoped bulk-action toolbar (opt-in). The adapter renders Selection.Buttons
    /// ABOVE the table; each button, on click, harvests the currently-CHECKED, currently-RENDERED row
    /// ids and writes them (a string[] of TableRow.Id) to Selection.HarvestBind — OVERWRITING — before
    /// dispatching its own action. The server reads that path to act, so a bulk action can only affect
    /// rows the user can currently see (a row filtered/paginated out of view is not harvested). An app
    /// wanting cross-page/persistent selection ignores this block and reads its own selectedIds map.
    /// Selectable rows must carry TableRow.Id. Null = no bulk toolbar.</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] TableSelection? Selection = null
) : ViewNode;

/// <summary>Visible-scoped bulk-action toolbar for a TableNode — see TableNode.Selection.
/// Buttons is typed IReadOnlyList&lt;ViewNode&gt; (not ButtonNode) so the polymorphic "type":"button"
/// discriminator emits (the 0.10.0/#15 maintainer rule).</summary>
public record TableSelection(
    IReadOnlyList<ViewNode> Buttons,
    string HarvestBind
);

public record LinkNode(
    string Label,
    string Href,
    // Dropped from the wire when false (WhenWritingDefault) → absent, matching
    // the TS optional `external?` (3.3.0, F2).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool External = false,
    /// <summary>true = current location ("you are here"): emits .vms-link--active
    /// + aria-current="page". Server-owned. Nullable + omitted-when-null so the wire
    /// matches the TS `active?: boolean` posture (absent = not active).</summary>
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] bool? Active = null,
    // 6.12.0 (TOOL-01) — hover-only info tooltip. See FieldNode.Tooltip.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tooltip = null,
    // v7.0.0 (ICON-04) — leading icon by name from the curated Lucide subset.
    // Name-only, NOT an IconNode child — host owns appearance (rendered
    // leading before the label at size sm; tone inherits from surrounding text
    // via currentColor), icon carries content.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null
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

// Image / media (issue #5). Src is required; Alt/Size/Shape/Caption/CaptionRuns
// are nullable wire optionals (the maintainer null-omission rule applies —
// absent, never null). Size ("small"/"medium"/"large"/"full") and Shape
// ("circle") are design-system hints → .vms-image--{size}/{shape}; non-browser
// adapters (TUI) degrade to Alt.
// Caption: optional caption text. When present, the image and caption render as
// a <figure><img><figcaption> unit (a single captioned figure landmark). When
// absent, rendering is byte-identical to the pre-caption output.
// CaptionRuns: optional inline rich-text runs for the caption (same contract as
// TextNode.Runs). When present, drawn INSTEAD of the plain Caption string;
// meaningless without Caption (used as fallback + agent-legible plain reading).
public record ImageNode(
    string Src,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Alt = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ImageSize? Size = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ImageShape? Shape = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Caption = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<InlineRun>? CaptionRuns = null
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ControlWidth? Width = null,
    // RICH COPY — harvest route (adapter-side, the default; no server authoring).
    // The DOM id of an already-rendered region to copy; the adapter reads its rendered
    // markup as text/html and its plain text as text/plain, writing BOTH. Target must
    // be a described region carrying an emitted DOM id (SectionNode.Id / ListNode.Id).
    // Missing element ⇒ fail loud + fall back to Text. Precedence: CopyTargetId > Html > Text.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? CopyTargetId = null,
    // RICH COPY — server-provided route (opt-in). A ready formatted representation
    // written as text/html alongside Text (text/plain). Use only when the content is
    // NOT already rendered on the page; otherwise prefer CopyTargetId. Write-only
    // clipboard export (never re-enters the view). Ignored when CopyTargetId is set.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Html = null
) : ViewNode;

// A first-class "nothing here" presentation (empty-state primitive). Title is
// required; Icon/Description/Action are nullable wire optionals (absent, never
// null, per the file-header rule). Action is a ButtonNode carrying a real
// action name — a dispatch-bearing descendant — so BOTH validation walks
// (ValidateActionNames / ValidateSectionAction) descend into it.
//
// 🚨 BREAKING WIRE RENAME in v8.0.0:
//   - Heading → Title (required, renamed)
//   - Message → Description (optional, renamed)
//   - NEW Icon?: IconName slot (tinted-circle backdrop; reuses Phase 22 icons)
//   - Tooltip REMOVED (was TS/.NET byte-drift — folded into this same wire break)
// The type discriminator "empty-state" is unchanged; only field NAMES rename.
// See MIGRATION.md for the consumer rewrite.
public record EmptyStateNode(
    string Title,
    // NEW in v8.0 — tinted-circle icon backdrop. Reuses IconName closed union
    // from Phase 22 (v7.0 icons).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,
    // RENAMED from Message in v8.0.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Description = null,
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
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Emphasis? Emphasis = null,
    // 6.12.0 (TOOL-01) — hover-only info tooltip. Useful for annotating short
    // badge labels ("!!!", "3", "Beta") with a full explanation. See
    // FieldNode.Tooltip.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Tooltip = null,
    // v7.0.0 (ICON-04) — leading icon by name from the curated Lucide subset.
    // Name-only, NOT an IconNode child — host owns appearance (rendered
    // leading inside the pill at size xs; tone inherits from Badge.Tone), icon
    // carries content. See `.planning/design/icons-primitive.md` §4.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null
) : ViewNode;

/// <summary>v7.0.0 (ICON-01) — a single icon glyph rendered from the framework's
/// curated Lucide subset. Leaf node. The wire carries ONLY the Name; the
/// framework owns the SVG payload (bundled inline in the browser adapter as
/// <c>ICONS[name]</c>), the size mapping (xs=12, sm=16, md=20, lg=24, xl=32),
/// and <c>stroke="currentColor"</c> — so Tone (or the parent's text color)
/// drives visual color.
///
/// <para>ACCESSIBILITY CONTRACT (LOAD-BEARING — do not remove this doc): the
/// framework dispatches on <c>Label</c> presence.
///  <br/>Label OMITTED = decorative. Emits <c>aria-hidden="true"</c> — the icon
/// is invisible to screen readers because meaning lives in adjacent text (a
/// Button [icon][label] pair, a ListItem with row title).
///  <br/>Label PRESENT = meaning-carrying. Emits <c>role="img"</c> +
/// <c>aria-label={Label}</c> — the icon announces as one thing. Used when the
/// icon stands alone (a status indicator with no adjacent text, an icon-only
/// navigation glyph). Label is NEVER rendered as visible text — the ARIA
/// channel only.</para>
///
/// <para>The icon-only ButtonNode rule (Icon != null AND string.IsNullOrEmpty(Label)
/// AND Tooltip == null throws invalid_tree) enforces the sibling case at the
/// tree validator — an icon-only button MUST carry Tooltip, which double-duties
/// as the button's aria-label there.</para>
///
/// <para>NOT ON THIS SHAPE (deliberate): no Emphasis axis (Lucide is
/// stroke-only, filled/outlined would force per-icon variant fan-out — design-doc
/// §12 out-of-scope); no SVG payload on the wire (framework owns the asset,
/// apps describe with the Name, same posture as TextNode.Style /
/// SectionNode.Tone).</para></summary>
public record IconNode(
    IconName Name,
    // Pixel size axis (framework-owned mapping xs=12, sm=16, md=20, lg=24,
    // xl=32). Omitted = "md" (20px), the default.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconSize? Size = null,
    // Semantic tint. When present, emits .vms-icon--{tone} which sets color,
    // which the SVG's stroke="currentColor" picks up. Omitted = inherits
    // currentColor from the surrounding text/element.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // Accessible name for screen readers when the icon carries meaning
    // INDEPENDENT of nearby text. Present → role="img" + aria-label={Label};
    // absent → aria-hidden="true" (decorative). Never rendered as visible text.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Label = null
) : ViewNode;

/// <summary>v8.0.0 (COMP-04) — AvatarNode circular slot with initials/image/
/// icon content-resolution priority (image &gt; initials &gt; icon &gt; empty).
/// Consumed by UserRowNode (Phase 25 leading slot), MessageNode (Phase 24
/// leading slot), ChipNode optional leading; standalone use in mention
/// pickers, assignee columns, comment threads, "who's viewing" indicators.
/// Circular only for v1 (other shapes deferred; see composite-nodes-layer
/// design doc).
///
/// <para>Leaf node: no children, no action. The tree-walker arm is a no-op
/// (same posture as IconNode). Every optional carries
/// <c>[JsonIgnore(WhenWritingNull)]</c> per AGENTS.md gotcha #8 — a bare
/// <c>new AvatarNode()</c> serializes as <c>{"type":"avatar"}</c> with NO
/// nulls on the wire (class-2 findNulls defect protection).</para>
///
/// <para>AvatarSize is a REAL enum (not <c>string?</c>) per the closed-union-
/// must-be-enum discipline — see PATTERNS.md §8c. Reuses the framework-wide
/// Tone enum and the v7.0.0 IconName closed union — no redeclaration.</para></summary>
public record AvatarNode(
    // Displayed when Image is absent. 1-2 characters typical (e.g. "AL" for
    // Ada Lovelace). Rendered as textContent by the browser (no HTML injection).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Initials = null,
    // Image URL — takes precedence over Initials when set (background hidden
    // by the <img> element). Server-authored; framework does not proxy or
    // sanitize (same posture as LinkNode.Href).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Image = null,
    // Fallback icon when neither Initials nor Image is set. Reuses the v7.0.0
    // IconName closed union (~102 members) — no redeclaration.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,
    // Circle diameter (sm/md/lg/xl → 1.5/2/2.5/3rem). Omitted = "md" (2rem).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] AvatarSize? Size = null,
    // Background palette (initials/icon modes ONLY — Image displaces the bg).
    // Reuses the framework-wide Tone enum.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // Accessible name for screen readers. Present ⇒ role="img" + aria-label.
    // Empty string is valid a11y for a decorative avatar.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Alt = null
) : ViewNode;

/// <summary>v8.0.0 (COMP-05) — ListRowNode. Dense list-row primitive with
/// typed semantic slots. The Route-B recipe — framework owns layout,
/// typography tiers, spacing, and a11y; the app hands it content via named
/// slots. Consumed by Metis incidents queue + every workflow-app
/// "row-per-item" list.
///
/// <para>Renders as &lt;li&gt; when the parent element carries .vms-list or
/// .vms-list--rows (in-container), else as
/// &lt;div class="vms-list-row-standalone"&gt;. Grid:
/// [leading | content | trailing] — leading=auto, content=1fr min-width:0,
/// trailing=auto. align-items:start so a multi-line meta stack doesn't
/// vertically center against a small leading badge.</para>
///
/// <para>SLOT-TYPING POLICY (PATTERNS.md §5 Analog C, LOCKED): every
/// ViewNode-typed slot is <c>ViewNode?</c> (not a narrow shape like
/// <c>ButtonNode?</c>) so System.Text.Json emits the polymorphic
/// <c>"type":...</c> discriminator. The TS twin's <c>string | ViewNode</c>
/// ergonomic convenience is TS-only — the .NET server wraps a string
/// explicitly (e.g. <c>Primary: new TextNode("Order 42", Style: TextStyle.Body,
/// Weight: TextWeight.Medium)</c>) — which is a small loss of ergonomics for
/// byte-alignment simplicity. Same posture as EmptyStateNode.Action /
/// FormNode.SubmitButton.</para>
///
/// <para>Every optional slot carries [JsonIgnore(WhenWritingNull)] so an
/// unset slot is ABSENT from the wire (never <c>"leading": null</c>) — the
/// class-2 findNulls defect protection AGENTS.md gotcha #8 exists for.</para>
///
/// <para>Whole-row Action mirrors TableRow.Action: role="button",
/// tabIndex=0, Enter/Space dispatch, aria-label from flattened text.
/// Interactive descendants (buttons, checkboxes, links, fields)
/// stopPropagation.</para>
/// </summary>
public record ListRowNode(
    // Primary is REQUIRED — the semantically-primary content per CONTEXT §1.
    // Typed ViewNode (not string) so the .NET record stays polymorphic; the
    // TS twin's string-convenience convention wraps the caller's string in
    // TextNode{style:"body", weight:"medium"} at render time. The .NET server
    // wraps explicitly (see the record's XML doc).
    ViewNode Primary,
    // Leading affordance — icon / badge / avatar / checkbox. ViewNode? per
    // Analog C (polymorphic emission).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Leading = null,
    // Second-line subordinate. String on the TS side wraps in TextNode{muted};
    // .NET server wraps explicitly.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Secondary = null,
    // Meta-line array — each entry is caption-tier text. TS string entries
    // wrap in TextNode{caption}; .NET server wraps explicitly per entry.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ViewNode>? Meta = null,
    // Right-aligned slot — timestamp, count, per-row actions, badge.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Trailing = null,
    // Semantic tone axis — left-accent border via .vms-list-row--{tone}.
    // Reuses the framework-wide Tone enum.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // Row lifecycle STATE (NOT severity — that's Tone). Freeform,
    // app-extensible token; framework ships styling for active/done/disabled/
    // high (mirrors ListItemNode.State). Orthogonal to Tone.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null,
    // Whole-row click. Same shape as TableRow.Action — dispatch-bearing
    // ActionDescriptor participating in name-uniqueness (Collect walker
    // records it via the ViewTreeValidation.Collect arm).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null
) : ViewNode;

/// <summary>v8.0.0 (COMP-06) — MessageNode. Chat/comment/thread message
/// primitive with typed semantic slots. Framework owns layout / typography /
/// spacing / a11y; app hands it content via named slots. Consumed by the /ai
/// chat, every comment/thread/message/activity-feed app.
///
/// <para>Grid: [avatar | body] — avatar column auto-sized (matches
/// AvatarNode's size), body is 1fr with min-width:0 so long content truncates
/// cleanly. Body is a stack: [header (author + timestamp) | content surface |
/// optional actions bar].</para>
///
/// <para>SLOT-TYPING POLICY (PATTERNS.md §5 Analog C, LOCKED, matches
/// ListRowNode): every ViewNode-typed slot is <c>ViewNode?</c> (Avatar) or
/// <c>ViewNode</c> (Content, required) — the TS twin's <c>string | ViewNode</c>
/// ergonomic convenience is TS-only. The .NET server wraps a string
/// explicitly (e.g. <c>Content: new TextNode("Hello", Style: TextStyle.Body)</c>).
/// Actions typed <c>IReadOnlyList&lt;ButtonNode&gt;</c> (narrow — the shape
/// always accepts only buttons; identical posture to the existing action-bar
/// slots).</para>
///
/// <para>Every optional slot carries [JsonIgnore(WhenWritingNull)] so an unset
/// slot is ABSENT from the wire — the class-2 findNulls defect protection
/// AGENTS.md gotcha #8 exists for.</para>
///
/// <para>ROLE controls surface tone via <c>.vms-message--{role}</c> on the
/// wrapper: "assistant" tints info, other roles + omitted = neutral. Actions
/// are ALWAYS VISIBLE — no hover-reveal (banked a11y doctrine).</para>
/// </summary>
public record MessageNode(
    // Author display name. REQUIRED. Text-sm, weight:600 (trained typography).
    // Rendered as textContent (no HTML injection).
    string Author,
    // Content body. REQUIRED. On the .NET side, this is a ViewNode (not
    // string) so the record stays polymorphic; the TS twin's
    // string-convenience wraps in TextNode{style:"body"} at render time.
    // The .NET server wraps explicitly.
    ViewNode Content,
    // Leading circular slot — typically an AvatarNode (COMP-04). ViewNode?
    // per Analog C (polymorphic emission).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Avatar = null,
    // Trained typography: caption tier (COMP-01). Rendered as textContent.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Timestamp = null,
    // Message role — controls surface tone. Real enum per closed-union-must-
    // be-enum discipline (KebabEnum wire values "user"/"assistant"/"system").
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] MessageRole? Role = null,
    // Right-aligned action bar. Typed IReadOnlyList<ViewNode>? (NOT
    // IReadOnlyList<ButtonNode>) so System.Text.Json emits the polymorphic
    // "type":"button" discriminator on each entry — a narrow ButtonNode-typed
    // list would silently drop the discriminator (banked posture from
    // FormNode.Buttons at :1155-1159; same rule applies here). Rendered
    // UNCONDITIONALLY when non-empty; no hover-reveal (banked a11y doctrine).
    // The renderer + walker cast entries to ButtonNode; a non-button entry
    // is currently unspec-behavior, matching the FormNode.Buttons contract.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ViewNode>? Actions = null
) : ViewNode;

/// <summary>v8.0.0 (COMP-06a) — MessageListNode. Container for MessageNode
/// children with optional follow-tail transcript semantics.
///
/// <para>TREE INVARIANT — children must ALL be MessageNode. The compile-time
/// type <c>IReadOnlyList&lt;MessageNode&gt;</c> is the primary enforcement on
/// the .NET side; the runtime validator in ViewTreeValidation.Collect is
/// defense-in-depth for a hostile deserialization path that smuggles in
/// non-MessageNode entries. Byte-identical error message across both
/// backends.</para>
///
/// <para>FOLLOW-TAIL — REUSES SectionNode.FollowTail's shipped
/// <c>data-follow-tail</c> scroll-pin mechanism verbatim (browser.ts:227-246
/// + :362-372). The BrowserAdapter's pre-render snapshot walks EVERY
/// [data-follow-tail] element in document order; the post-render restore pins
/// each to its new bottom (or preserves old scrollTop when scrolled up).
/// MessageListNode piggybacks by setting the SAME attribute — no parallel
/// snapshot/restore logic. Same <c>WhenWritingDefault</c> posture as
/// SectionNode.FollowTail — false is ABSENT on the wire (not
/// <c>"followTail": false</c>), matching the TS optional <c>followTail?</c>.
/// </para>
/// </summary>
public record MessageListNode(
    // Typed IReadOnlyList<ViewNode> (NOT IReadOnlyList<MessageNode>) so
    // System.Text.Json emits the polymorphic "type":"message" discriminator
    // on each child (a narrow MessageNode-typed list silently drops the
    // discriminator — same banked posture as FormNode.Buttons at :1155-1159).
    // The tree invariant is enforced by the runtime validator in
    // ViewTreeValidation.Collect (`invalid_tree` with byte-identical error
    // message to the TS twin) — every non-MessageNode child is rejected
    // there, so the wire-level list is effectively still MessageNode-only.
    IReadOnlyList<ViewNode> Children,
    // WhenWritingDefault posture on a non-nullable bool — matches
    // SectionNode.FollowTail at :999. false = ABSENT on the wire (byte-
    // identical to the TS optional `followTail?: boolean` which is
    // omitted when unset).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool FollowTail = false
) : ViewNode;

/// <summary>v8.0.0 (COMP-07) — AlertNode. Prominent status-message primitive.
///
/// <para>TYPED SLOTS + TONE-DRIVEN SEMANTICS: <c>Tone</c> is REQUIRED
/// (non-nullable) — it IS the point of the node. It simultaneously controls:
/// (1) surface palette via <c>.vms-alert--{tone}</c> (tinted background +
/// border via <c>color-mix</c>); (2) default icon (baked-in
/// <c>ALERT_TONE_ICON</c> map in browser.ts: danger→x-circle,
/// warning→alert-triangle, success→check-circle, info→info), overridable via
/// <c>Icon</c>; (3) icon glyph color.</para>
///
/// <para>REQUIRED SLOTS: <c>Tone</c> + <c>Message</c>. <c>Message</c> is
/// typed <c>ViewNode</c> (not <c>ViewNode?</c>) so it stays polymorphic
/// (System.Text.Json emits the <c>"type"</c> discriminator) — the TS twin's
/// <c>string | ViewNode</c> convenience wraps in TextNode{style:"muted"} at
/// render time; the .NET server wraps explicitly.</para>
///
/// <para>DISMISSIBLE — deliberate DEVIATION from <c>ModalNode.DismissAction</c>.
/// <c>Dismissible: true</c> renders a close-X that dispatches the RESERVED
/// fixed action name <c>"dismiss"</c> at click time (no
/// <c>DismissAction: ActionDescriptor</c> slot — the composite emits the
/// ActionEvent LOCALLY rather than accepting a caller-supplied slot). Apps
/// needing a more-specific name compose their own dismiss button in
/// <c>Actions</c> and set <c>Dismissible: false</c>. <c>WhenWritingDefault</c>
/// posture on the bool — <c>false</c> is ABSENT on the wire (byte-identical to
/// the TS optional <c>dismissible?: boolean</c>).</para>
///
/// <para>Every optional slot carries <c>[JsonIgnore(WhenWritingNull)]</c> so
/// an unset slot is ABSENT from the wire — the class-2 findNulls defect
/// protection AGENTS.md gotcha #8 exists for.</para>
/// </summary>
public record AlertNode(
    // Tone is REQUIRED (non-nullable) — the point of the node. Real enum per
    // closed-union-must-be-enum discipline (KebabEnum wire values
    // "danger"/"warning"/"success"/"info"). Reuses the shipped Tone enum at
    // :74-75, byte-identical to the TS closed union.
    Tone Tone,
    // Message is REQUIRED. Typed ViewNode (NOT ViewNode?) so System.Text.Json
    // emits the polymorphic "type" discriminator — a narrow shape would
    // silently drop it (banked posture from FormNode.Buttons at :1155-1159;
    // same rule applies to every ViewNode-typed slot on the composite records).
    ViewNode Message,
    // Optional title/headline. Rendered as textContent through a TextNode
    // wrap (style:"body", weight:"medium") — trained typography.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Title = null,
    // Optional icon override. When present, wins over the tone default from
    // ALERT_TONE_ICON. Reuses Phase 22 IconName closed enum.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,
    // Right-aligned action bar. Typed IReadOnlyList<ViewNode>? (NOT
    // IReadOnlyList<ButtonNode>) so System.Text.Json emits the polymorphic
    // "type":"button" discriminator on each entry — a narrow ButtonNode-typed
    // list would silently drop the discriminator (banked posture from
    // FormNode.Buttons at :1155-1159; same rule applies here). The renderer +
    // walker cast entries to ButtonNode; a non-button entry is currently
    // unspec-behavior, matching the FormNode.Buttons contract.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ViewNode>? Actions = null,
    // WhenWritingDefault posture on a non-nullable bool — matches
    // SectionNode.FollowTail at :999 + MessageListNode.FollowTail at :2234.
    // false = ABSENT on the wire (byte-identical to the TS optional
    // `dismissible?: boolean` which is omitted when unset).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Dismissible = false
) : ViewNode;

/// <summary>v8.0.0 (COMP-09) — UserRowNode.Status sub-record. NOT a ViewNode —
/// no [JsonDerivedType], no polymorphic "type" discriminator (same posture as
/// LookupItem / FieldOption). Serializes as a plain object shape
/// <c>{"label":"...","kind":"..."}</c> byte-identical to the TS twin's
/// inline object type <c>{ label: string; kind: StatusKind }</c>. Both fields
/// REQUIRED (non-nullable). Kind carries KebabEnum via the StatusKind enum's
/// [JsonConverter], so the wire kind string is byte-identical to the TS
/// closed union.</summary>
public record UserRowStatus(string Label, StatusKind Kind);

/// <summary>v8.0.0 (COMP-09) — UserRowNode. The person-entity display recipe
/// with typed semantic slots. Route-B recipe: framework owns grid layout,
/// typography tiers, spacing, status-dot palette, and a11y; the app hands it
/// content via named slots. Consumed by member pickers, user lists, contact
/// rows.
///
/// <para>Renders as &lt;li&gt; when the parent element carries .vms-user-row-list
/// (in-container, single-bordered-surface + per-row dividers), else as a
/// standalone &lt;div&gt;. Grid: [avatar | content | trailing? | status] —
/// avatar = auto, content = 1fr min-width:0, trailing = auto (when set),
/// status = auto.</para>
///
/// <para>SLOT-TYPING POLICY (PATTERNS.md §5 Analog C, LOCKED, matches
/// ListRowNode): every ViewNode-typed slot is <c>ViewNode?</c> (Avatar / Meta
/// / Trailing) or <c>ViewNode</c> (Name, required) — the TS twin's
/// <c>string | ViewNode</c> ergonomic convenience is TS-only. The .NET server
/// wraps a string explicitly (e.g. <c>Name: new TextNode("Alice",
/// Style: TextStyle.Body, Weight: TextWeight.Medium)</c>).</para>
///
/// <para>STATUS is a small typed sub-record (<c>UserRowStatus</c>) — NOT a
/// ViewNode slot. Leaf. NO walker descent. Kind is a closed 4-value enum
/// carrying KebabEnum for wire strings byte-identical to the TS closed
/// union.</para>
///
/// <para>Every optional slot carries [JsonIgnore(WhenWritingNull)] so an unset
/// slot is ABSENT from the wire (never <c>"avatar": null</c>) — the class-2
/// findNulls defect protection AGENTS.md gotcha #8 exists for.</para>
///
/// <para>Whole-row Action mirrors ListRowNode.Action: role="button",
/// tabIndex=0, Enter/Space dispatch, aria-label from flattened text.
/// Interactive descendants (buttons, checkboxes, links, fields)
/// stopPropagation.</para>
/// </summary>
public record UserRowNode(
    // Name is REQUIRED. Typed ViewNode (NOT ViewNode?) so System.Text.Json
    // emits the polymorphic "type" discriminator — a narrow shape would
    // silently drop it (banked posture from FormNode.Buttons at :1155-1159;
    // same rule applies to every ViewNode-typed slot on the composite records).
    ViewNode Name,
    // Leading circular slot — typically AvatarNode. ViewNode? per Analog C
    // (polymorphic emission).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Avatar = null,
    // Second-line meta. String on the TS side wraps in TextNode{muted};
    // .NET server wraps explicitly.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Meta = null,
    // Right-aligned status indicator — small typed sub-record (leaf, no
    // walker descent). WhenWritingNull so an unset status is ABSENT.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] UserRowStatus? Status = null,
    // Optional trailing slot — extra actions or badge. ViewNode? per Analog C.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Trailing = null,
    // Whole-row click (member-picker pattern). Same shape as ListRowNode.Action —
    // dispatch-bearing ActionDescriptor participating in name-uniqueness (Collect
    // walker records it via the ViewTreeValidation.Collect arm).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null
) : ViewNode;

/// <summary>v8.0.0 (COMP-10) — DetailRowNode. Aligned key-value display recipe
/// with typed semantic slots for attribute panels, order details, and metadata
/// sidebars. Route-B recipe: framework owns grid layout, label typography
/// (text-xs uppercase weight:500 muted, BAKED IN CSS not TextNode-wrapped),
/// value typography (TextNode body), and semantic HTML — the app hands it
/// content via named slots.
///
/// <para>Renders as
/// <c>&lt;div class="vms-detail-row [vms-detail-row--{tone}]"&gt;
/// &lt;dt class="vms-detail-row__label"&gt;{icon?}{label}&lt;/dt&gt;
/// &lt;dd class="vms-detail-row__value"&gt;{value}&lt;/dd&gt;&lt;/div&gt;</c>
/// — the <c>&lt;dt&gt;</c>/<c>&lt;dd&gt;</c> elements are the screen-reader
/// term/definition semantics; the wrapping <c>&lt;div&gt;</c> exists to carry
/// the grid layout (a bare <c>&lt;dt&gt;</c> + <c>&lt;dd&gt;</c> sibling pair
/// cannot be grid-columned as a unit).</para>
///
/// <para>SLOT-TYPING POLICY: <c>Label</c> is a REQUIRED PRIMITIVE
/// <c>string</c> (NOT ViewNode-typed) — the trained typography
/// (text-xs uppercase weight:500 muted) is BAKED into
/// <c>.vms-detail-row__label</c> CSS; the browser renderer appends a raw
/// text node to the <c>&lt;dt&gt;</c>. This is deliberate: the label
/// typography is a fixed, non-negotiable part of the composite recipe.
/// <c>Value</c> is REQUIRED as a <c>ViewNode</c> (NOT <c>ViewNode?</c>) so
/// System.Text.Json emits the polymorphic <c>"type"</c> discriminator —
/// the TS twin's <c>string | ViewNode</c> ergonomic convenience is
/// TS-only; the .NET server wraps a string explicitly
/// (<c>new TextNode("Open", Style: TextStyle.Body)</c>).</para>
///
/// <para>TONE: shifts the value text to the tone-accent color via
/// <c>.vms-detail-row--{tone} .vms-detail-row__value</c>. Reuses the shipped
/// <c>Tone</c> enum at :74-75 — byte-identical to the TS closed union.
/// WhenWritingNull discipline; absent = neutral text.</para>
///
/// <para>Every optional slot carries <c>[JsonIgnore(WhenWritingNull)]</c> so
/// an unset slot is ABSENT from the wire (never <c>"tone": null</c>) — the
/// class-2 findNulls defect protection AGENTS.md gotcha #8 exists for.</para>
/// </summary>
public record DetailRowNode(
    // Label is REQUIRED. Primitive string (NOT ViewNode) — the trained
    // typography is baked in .vms-detail-row__label CSS. The browser renderer
    // emits a raw text node inside the <dt>; no TextNode wrap.
    string Label,
    // Value is REQUIRED. Typed ViewNode (NOT ViewNode?, NOT string) so
    // System.Text.Json emits the polymorphic "type" discriminator on the
    // nested payload. TS twin's `string | ViewNode` convenience wraps in
    // TextNode{body} at render time; .NET server wraps explicitly.
    ViewNode Value,
    // Optional tone accent — controls the value text color via
    // .vms-detail-row--{tone}. Reuses shipped Tone enum (:74-75).
    // WhenWritingNull → absent when null (never `"tone":null`).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // Optional leading icon inside the <dt>, before the label text.
    // Reuses Phase 22 v7.0 IconName closed enum.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null
) : ViewNode;

/// <summary>v8.0.0 (COMP-10a) — DetailListNode. Container for DetailRowNode
/// children with closed-enum label column width and semantic <c>&lt;dl&gt;</c>
/// container.
///
/// <para>Renders as
/// <c>&lt;dl class="vms-detail-list [vms-detail-list--{labelWidth}]"&gt;</c> —
/// the <c>&lt;dl&gt;</c> (definition list) is the screen-reader semantic
/// anchor: each child <c>&lt;dt&gt;</c>/<c>&lt;dd&gt;</c> pair announces as a
/// term/definition inside a list of term-definition pairs. A <c>&lt;div&gt;</c>
/// container would drop that semantic, so the choice of <c>&lt;dl&gt;</c> is
/// LOAD-BEARING (mutation-testable — a <c>&lt;dl&gt;</c> → <c>&lt;div&gt;</c>
/// swap breaks the semantic-element test in test/detail-row.test.ts).</para>
///
/// <para>TREE INVARIANT — children MUST be DetailRowNode. Children is typed
/// <c>IReadOnlyList&lt;ViewNode&gt;</c> on the record (widening from
/// DetailRowNode-only is deliberate — a narrow shape drops the polymorphic
/// <c>"type":"detail-row"</c> discriminator per the FormNode.Buttons banked
/// posture at :1155-1159), so the tree-shape invariant IS enforced exclusively
/// at runtime by ViewTreeValidation.Collect — the compile-time type would
/// silently accept any ViewNode. Byte-identical error message across TS +
/// .NET: <c>"DetailListNode.children must all be DetailRowNodes (found:
/// &lt;type&gt;)"</c>.</para>
///
/// <para>LABELWIDTH CSS-var pattern: the container CSS sets
/// <c>--vms-detail-label: 10rem</c> (default, matches "md").
/// <c>.vms-detail-list--sm</c> overrides it to 8rem, <c>--md</c> re-sets
/// 10rem (a no-op that keeps the closed enum's three values symmetric),
/// <c>--lg</c> sets 12rem. Each row's grid reads it as
/// <c>grid-template-columns: var(--vms-detail-label) 1fr</c>. Omitting
/// <c>LabelWidth</c> on the wire emits no modifier class — the container
/// falls back to the default 10rem, byte-identical to
/// <c>LabelWidth: DetailLabelWidth.Md</c> set explicitly.</para>
///
/// <para>WhenWritingNull posture on LabelWidth — absent when null.</para>
/// </summary>
public record DetailListNode(
    // Typed IReadOnlyList<ViewNode> (NOT IReadOnlyList<DetailRowNode>) so
    // System.Text.Json emits the polymorphic "type":"detail-row" discriminator
    // on each child (a narrow DetailRowNode-typed list silently drops the
    // discriminator — banked posture from FormNode.Buttons at :1155-1159 +
    // MessageListNode.Children at :2250). The tree invariant is enforced
    // exclusively by the runtime validator in ViewTreeValidation.Collect
    // (invalid_tree with byte-identical error message to the TS twin) — every
    // non-DetailRowNode child is rejected there, so the wire-level list is
    // effectively still DetailRowNode-only.
    IReadOnlyList<ViewNode> Children,
    // Fixed label column width. Closed enum (Sm/Md/Lg), KebabEnum emits
    // "sm"/"md"/"lg". Omitted = no modifier class emitted; container falls
    // back to default 10rem (byte-identical to Md set explicitly).
    // WhenWritingNull → absent when null (never `"labelWidth":null`).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] DetailLabelWidth? LabelWidth = null
) : ViewNode;

/// <summary>v8.0.0 (COMP-11) — TimelineEntryNode. A single entry in an activity
/// feed / audit log / status trail. Route-B recipe: framework owns grid layout,
/// typography tiers, the rail-and-dot visual mechanism (baked in CSS
/// <c>::before</c> pseudo-elements on the container + entry), and a11y — the
/// app hands it content via named slots. Consumed by incident timelines,
/// order-status trails, deployment logs.
///
/// <para>Renders as
/// <c>&lt;li class="vms-timeline-entry [vms-timeline-entry--{tone}]"&gt;
/// &lt;div class="vms-timeline-entry__time"&gt;{time}&lt;/div&gt;
/// &lt;div class="vms-timeline-entry__description"&gt;{description}&lt;/div&gt;
/// &lt;/li&gt;</c>. The visual dot marker lives ENTIRELY in the
/// <c>.vms-timeline-entry::before</c> CSS rule; the renderer emits ONLY
/// semantic markup + class names.</para>
///
/// <para>SLOT-TYPING POLICY: <c>Time</c> is a REQUIRED PRIMITIVE
/// <c>string</c> (NOT ViewNode-typed) — the renderer wraps it in
/// <c>TextNode{Style: TextStyle.Caption}</c> to consume COMP-01 trained
/// typography. <c>Description</c> is REQUIRED as a <c>ViewNode</c> (NOT
/// <c>ViewNode?</c>) so System.Text.Json emits the polymorphic <c>"type"</c>
/// discriminator on the nested payload — the TS twin's
/// <c>string | ViewNode</c> ergonomic convenience is TS-only; the .NET server
/// wraps a string explicitly
/// (<c>new TextNode("Incident opened", Style: TextStyle.Body)</c>).</para>
///
/// <para>TONE: shifts the dot border color via
/// <c>.vms-timeline-entry--{tone}::before { border-color: var(--vms-{tone}); }</c>.
/// Reuses the shipped <c>Tone</c> enum at :74-75 — byte-identical to the TS
/// closed union. WhenWritingNull discipline; absent = default accent border.</para>
///
/// <para>Every optional slot carries <c>[JsonIgnore(WhenWritingNull)]</c> so
/// an unset slot is ABSENT from the wire (never <c>"tone": null</c>) — the
/// class-2 findNulls defect protection AGENTS.md gotcha #8 exists for.</para>
/// </summary>
public record TimelineEntryNode(
    // Time is REQUIRED. Primitive string (NOT ViewNode) — the browser renderer
    // wraps in TextNode{Style:Caption} at render time (COMP-01 trained
    // typography). String only; no ViewNode variant.
    string Time,
    // Description is REQUIRED. Typed ViewNode (NOT ViewNode?, NOT string) so
    // System.Text.Json emits the polymorphic "type" discriminator on the
    // nested payload. TS twin's `string | ViewNode` convenience wraps in
    // TextNode{body} at render time; .NET server wraps explicitly.
    ViewNode Description,
    // Optional tone accent — controls the dot border color via
    // .vms-timeline-entry--{tone}::before. Reuses shipped Tone enum (:74-75).
    // WhenWritingNull → absent when null (never `"tone":null`).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // Optional icon inside the dot slot (larger dot). Reuses Phase 22 v7.0
    // IconName closed enum.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null
) : ViewNode;

/// <summary>v8.0.0 (COMP-11a) — TimelineNode. Container for TimelineEntryNode
/// children with the framework-owned decorative rail.
///
/// <para>Renders as <c>&lt;ol class="vms-timeline"&gt;</c> — semantic ordered
/// list (chronological entries). The container CSS installs a decorative left
/// rail via <c>::before</c> (a 2px vertical line spanning top-to-bottom); each
/// child <c>TimelineEntryNode</c> installs a dot via its own <c>::before</c>.
/// The framework owns the rail + dot markers — apps CANNOT compose this from
/// primitives ("apps describe, never decorate" precludes app-CSS for a rail).
/// This composite exists SPECIFICALLY to bake this in — it is the ONE
/// genuinely new CSS mechanism in the Phase 25 secondary-composites set.</para>
///
/// <para>TREE INVARIANT — children MUST be TimelineEntryNode. Children is
/// typed <c>IReadOnlyList&lt;ViewNode&gt;</c> on the record (widening from
/// TimelineEntryNode-only is deliberate — a narrow shape drops the polymorphic
/// <c>"type":"timeline-entry"</c> discriminator per the FormNode.Buttons
/// banked posture at :1155-1159 + MessageListNode.Children at :2250 +
/// DetailListNode.Children at :2499), so the tree-shape invariant IS enforced
/// exclusively at runtime by ViewTreeValidation.Collect — the compile-time
/// type would silently accept any ViewNode. Byte-identical error message
/// across TS + .NET:
/// <c>"TimelineNode.children must all be TimelineEntryNodes (found: &lt;type&gt;)"</c>.</para>
/// </summary>
public record TimelineNode(
    // Typed IReadOnlyList<ViewNode> (NOT IReadOnlyList<TimelineEntryNode>) so
    // System.Text.Json emits the polymorphic "type":"timeline-entry"
    // discriminator on each child (a narrow TimelineEntryNode-typed list
    // silently drops the discriminator — banked posture from FormNode.Buttons
    // at :1155-1159 + MessageListNode.Children at :2250 +
    // DetailListNode.Children at :2499). The tree invariant is enforced
    // exclusively by the runtime validator in ViewTreeValidation.Collect
    // (invalid_tree with byte-identical error message to the TS twin) — every
    // non-TimelineEntryNode child is rejected there, so the wire-level list is
    // effectively still TimelineEntryNode-only.
    IReadOnlyList<ViewNode> Children
) : ViewNode;

/// <summary>v8.0.0 (COMP-12) — SettingRowNode. The settings-page primitive —
/// one row per toggleable / configurable setting, with a label, optional
/// description, and a trailing control slot. Consumed by feature-flag panels,
/// notification-preference screens, account-settings pages.
///
/// <para>Renders as <c>&lt;li class="vms-setting-row [vms-setting-row--clickable]"&gt;</c>
/// with a <c>[body | control]</c> grid (1fr auto, <c>align-items: center</c>).
/// The body column stacks <c>[label | description]</c>; the control column
/// vertically centers the trailing slot against the label+description stack.
/// String-lift trained typography lives at render time in the browser renderer
/// (label → <c>TextNode{style:body, weight:medium}</c>; description →
/// <c>TextNode{style:muted}</c> inside a <c>&lt;p&gt;</c> with
/// <c>max-width:42rem</c>).</para>
///
/// <para>NATURAL PAIRING: <c>Trailing</c> typically holds a
/// <c>CheckboxNode(Variant:"switch")</c> from COMP-03 (Phase 23) — the whole
/// recipe exists so an app hands the framework <c>{Label, Description,
/// Trailing: switch}</c> and gets the shipped settings-row layout for free.
/// Other common trailing controls: <c>ButtonNode</c>, <c>LinkNode</c>.</para>
///
/// <para>ACTION (optional) — whole-row click. Same shape as
/// <c>ListRowNode.Action</c>. The renderer wires <c>stopPropagation</c> on
/// interactive descendants (buttons, checkboxes/switches, links) so a click
/// on the trailing switch does NOT double-fire the row action.</para>
///
/// <para>Every optional slot carries <c>WhenWritingNull</c> — an unset slot
/// is ABSENT from the wire (never <c>"trailing": null</c>) per AGENTS.md
/// gotcha #8 (class-2 findNulls defect protection).</para>
/// </summary>
public record SettingRowNode(
    // Label is REQUIRED. Typed ViewNode (NOT ViewNode?, NOT string) so
    // System.Text.Json emits the polymorphic "type" discriminator on the
    // nested payload. TS twin's `string | ViewNode` convenience wraps in
    // TextNode{body, weight:medium} at render time; .NET server wraps
    // explicitly. Same posture as AlertNode.Message + DetailRowNode.Value +
    // TimelineEntryNode.Description.
    ViewNode Label,
    // Optional leading icon on the body column. Reuses Phase 22 v7.0
    // IconName closed enum. WhenWritingNull → absent when null.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,
    // Supporting description — typography subordinate to the label. Typed
    // ViewNode? so the .NET server always constructs a full subtree (a raw
    // string would drop the discriminator on the wire). Renderer wraps
    // caller strings in TextNode{muted} at render time on TS side; on .NET
    // side the caller wraps explicitly.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Description = null,
    // Trailing control slot — any ViewNode. Natural pairing:
    // CheckboxNode(Variant:"switch"). WhenWritingNull → absent when null.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Trailing = null,
    // Whole-row click (opt-in). Same shape as ListRowNode.Action.
    // WhenWritingNull → absent when null.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null
) : ViewNode;

/// <summary>v8.0.0 (COMP-12a) — SettingListNode. Container for
/// SettingRowNode children with an optional heading — the settings-group
/// primitive.
///
/// <para>Renders as <c>&lt;ul class="vms-setting-list"&gt;</c> with an
/// optional heading emitted as a SIBLING
/// <c>&lt;h3 class="vms-setting-list__heading"&gt;</c> BEFORE the
/// <c>&lt;ul&gt;</c> (NOT inside — same posture as Phase 24
/// <c>EmptyStateNode</c>'s "structural elements outside the semantic list"
/// approach, so the semantic list stays a clean <c>&lt;ul&gt;</c> of
/// <c>&lt;li&gt;</c> items). Single bordered surface with per-row dividers
/// (same pattern as <c>ListNode.Variant:"rows"</c> — Phase 24 shipped
/// convention).</para>
///
/// <para>TREE INVARIANT — children MUST be SettingRowNode. Children is
/// typed <c>IReadOnlyList&lt;ViewNode&gt;</c> on the record (widening from
/// SettingRowNode-only is deliberate — a narrow shape drops the polymorphic
/// <c>"type":"setting-row"</c> discriminator per the FormNode.Buttons banked
/// posture at :1155-1159 + MessageListNode.Children at :2250 +
/// DetailListNode.Children at :2499 + TimelineNode.Children at :2598), so
/// the tree-shape invariant IS enforced exclusively at runtime by
/// ViewTreeValidation.Collect — the compile-time type would silently accept
/// any ViewNode. Byte-identical error message across TS + .NET:
/// <c>"SettingListNode.children must all be SettingRowNodes (found: &lt;type&gt;)"</c>.</para>
/// </summary>
public record SettingListNode(
    // Typed IReadOnlyList<ViewNode> (NOT IReadOnlyList<SettingRowNode>) so
    // System.Text.Json emits the polymorphic "type":"setting-row"
    // discriminator on each child (a narrow SettingRowNode-typed list
    // silently drops the discriminator — banked posture from FormNode.Buttons
    // at :1155-1159 + MessageListNode.Children at :2250 +
    // DetailListNode.Children at :2499 + TimelineNode.Children at :2598).
    // The tree invariant is enforced exclusively by the runtime validator
    // in ViewTreeValidation.Collect (invalid_tree with byte-identical error
    // message to the TS twin) — every non-SettingRowNode child is rejected
    // there, so the wire-level list is effectively still
    // SettingRowNode-only.
    IReadOnlyList<ViewNode> Children,
    // Optional heading for the settings group — renders as
    // <h3 class="vms-setting-list__heading"> immediately BEFORE the <ul>
    // (sibling, NOT child). WhenWritingNull → absent when null.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Heading = null
) : ViewNode;

// v8.0.0 (COMP-13) — ChipNode. Tinted-pill primitive for filter chips,
// selected tags, category pills. Mirrors TS ChipNode byte-identical.
//
// 🚨 CRITICAL DIVERGENCE from AlertNode.Dismissible:
// ChipNode.DismissAction is a CALLER-SUPPLIED ActionDescriptor
// (identity-carrying: "remove-filter-42", "unselect-tag-foo"). AlertNode.Dismissible
// is a bool that emits a fixed local {name:"dismiss"} at click time. Chip needs
// identity-carrying dispatch — apps typically name per-identity actions.
// Mirrors ModalNode.DismissAction's shape (ActionDescriptor?), NOT
// AlertNode.Dismissible (bool). The walker records BOTH DismissAction and
// Action — both participate in action-name uniqueness.
public record ChipNode(
    // REQUIRED — pill text.
    string Label,
    // Tinted-pill palette. Neutral (accent-tinted) if omitted.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] Tone? Tone = null,
    // Optional leading icon.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IconName? Icon = null,
    // CALLER-SUPPLIED ActionDescriptor — mirrors ModalNode.DismissAction, NOT
    // AlertNode.Dismissible. Chip needs identity-carrying dispatch.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? DismissAction = null,
    // Whole-chip click (filter-chip toggle pattern). Same shape as ListRowNode.Action.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null
) : ViewNode;

// v8.0.0 (COMP-13a) — ChipListNode. Container for ChipNode children — the
// flex-wrap horizontal pill cluster. Tree-validator enforces child-type
// invariant with byte-identical error message across TS + .NET.
public record ChipListNode(
    // Typed IReadOnlyList<ViewNode> (NOT IReadOnlyList<ChipNode>) so
    // System.Text.Json emits the polymorphic "type":"chip" discriminator on
    // each child (a narrow ChipNode-typed list silently drops the
    // discriminator — banked posture from FormNode.Buttons +
    // MessageListNode.Children + DetailListNode.Children + TimelineNode.Children
    // + SettingListNode.Children). The tree invariant is enforced exclusively
    // by the runtime validator in ViewTreeValidation.Collect (invalid_tree
    // with byte-identical error message to the TS twin) — every non-ChipNode
    // child is rejected there, so the wire-level list is effectively still
    // ChipNode-only.
    IReadOnlyList<ViewNode> Children
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

            case ListRowNode listRow:
                // v8.0.0 (COMP-05) — ListRowNode slots can hold arbitrary
                // ViewNode subtrees (including SectionNodes with Action/Link),
                // so the nested-section-interaction rules must descend into
                // every ViewNode slot. Mirrors the TS twin `walkForSectionAction`
                // arm in server.ts.
                if (listRow.Leading is { } lrLead) WalkForSectionAction(lrLead, outerInteractive);
                WalkForSectionAction(listRow.Primary, outerInteractive);
                if (listRow.Secondary is { } lrSec) WalkForSectionAction(lrSec, outerInteractive);
                if (listRow.Meta is { } lrMeta)
                {
                    foreach (var m in lrMeta) WalkForSectionAction(m, outerInteractive);
                }
                if (listRow.Trailing is { } lrTrail) WalkForSectionAction(lrTrail, outerInteractive);
                break;

            case MessageNode message:
                // v8.0.0 (COMP-06) — MessageNode slots can hold arbitrary
                // ViewNode subtrees (Avatar, Content). Descend for consistency
                // with every other walk so a future shape can't slip an
                // interactive section past this validator. Mirrors the TS
                // twin `case "message"` arm in server.ts.
                if (message.Avatar is { } msgAvatar) WalkForSectionAction(msgAvatar, outerInteractive);
                WalkForSectionAction(message.Content, outerInteractive);
                break;

            case MessageListNode messageList:
                // v8.0.0 (COMP-06a) — MessageListNode.Children are
                // MessageNodes; descend into each to catch nested
                // interactive-section violations in a message's Avatar or
                // Content slot.
                foreach (var child in messageList.Children) WalkForSectionAction(child, outerInteractive);
                break;

            case AlertNode alert:
                // v8.0.0 (COMP-07) — AlertNode.Message can hold arbitrary
                // ViewNode subtrees (e.g. an app-composed rich body).
                // Actions[] are ButtonNodes (no SectionNode descendants) but
                // walked for defense-in-depth so a future shape can't slip
                // an interactive section past this validator. Mirrors the
                // TS twin `case "alert"` arm in server.ts.
                WalkForSectionAction(alert.Message, outerInteractive);
                if (alert.Actions is { } alertActions)
                {
                    foreach (var btn in alertActions) WalkForSectionAction(btn, outerInteractive);
                }
                break;

            case UserRowNode userRow:
                // v8.0.0 (COMP-09) — UserRowNode slots can hold arbitrary
                // ViewNode subtrees (Avatar / Name / Meta / Trailing). Descend
                // into every ViewNode slot for defense-in-depth so a future
                // shape can't slip an interactive section past this
                // validator. Status is a leaf sub-record (UserRowStatus) —
                // no ViewNode content, no descent. Mirrors the TS twin
                // `case "user-row"` arm in server.ts.
                if (userRow.Avatar is { } urAvatar) WalkForSectionAction(urAvatar, outerInteractive);
                WalkForSectionAction(userRow.Name, outerInteractive);
                if (userRow.Meta is { } urMeta) WalkForSectionAction(urMeta, outerInteractive);
                if (userRow.Trailing is { } urTrail) WalkForSectionAction(urTrail, outerInteractive);
                break;

            case DetailRowNode detailRow:
                // v8.0.0 (COMP-10) — DetailRowNode.Value can hold arbitrary
                // ViewNode subtrees. Descend for defense-in-depth so a future
                // shape can't slip an interactive section past this
                // validator. Label + Icon + Tone are primitives — no descent.
                // Mirrors the TS twin `case "detail-row"` arm in server.ts.
                WalkForSectionAction(detailRow.Value, outerInteractive);
                break;

            case DetailListNode detailList:
                // v8.0.0 (COMP-10a) — DetailListNode.Children are
                // DetailRowNodes; descend into each to catch any nested
                // interactive-section violations in a row's Value slot.
                // Mirrors the TS twin `case "detail-list"` arm.
                foreach (var child in detailList.Children) WalkForSectionAction(child, outerInteractive);
                break;

            case TimelineEntryNode timelineEntry:
                // v8.0.0 (COMP-11) — TimelineEntryNode.Description can hold
                // arbitrary ViewNode subtrees. Descend for defense-in-depth so
                // a future shape can't slip an interactive section past this
                // validator. Time + Icon + Tone are primitives — no descent.
                // Mirrors the TS twin `case "timeline-entry"` arm in server.ts.
                WalkForSectionAction(timelineEntry.Description, outerInteractive);
                break;

            case TimelineNode timeline:
                // v8.0.0 (COMP-11a) — TimelineNode.Children are
                // TimelineEntryNodes; descend into each to catch any nested
                // interactive-section violations in an entry's Description
                // slot. Mirrors the TS twin `case "timeline"` arm.
                foreach (var child in timeline.Children) WalkForSectionAction(child, outerInteractive);
                break;

            case SettingRowNode settingRow:
                // v8.0.0 (COMP-12) — SettingRowNode.Label / Description /
                // Trailing can hold arbitrary ViewNode subtrees. Descend for
                // defense-in-depth so a future shape can't slip an
                // interactive section past this validator. Icon is a
                // primitive (IconName) — no descent. Mirrors the TS twin
                // `case "setting-row"` arm in server.ts.
                WalkForSectionAction(settingRow.Label, outerInteractive);
                if (settingRow.Description is { } srDesc) WalkForSectionAction(srDesc, outerInteractive);
                if (settingRow.Trailing is { } srTrail) WalkForSectionAction(srTrail, outerInteractive);
                break;

            case SettingListNode settingList:
                // v8.0.0 (COMP-12a) — SettingListNode.Children are
                // SettingRowNodes; descend into each to catch any nested
                // interactive-section violations in a row's Label /
                // Description / Trailing slot. Mirrors the TS twin
                // `case "setting-list"` arm.
                foreach (var child in settingList.Children) WalkForSectionAction(child, outerInteractive);
                break;

            case ChipNode:
                // v8.0.0 (COMP-13) — ChipNode has no ViewNode-typed slots
                // (Label is a string primitive, Tone is a closed enum, Icon
                // is IconName, and both DismissAction/Action are
                // ActionDescriptors — not ViewNodes). No section can be
                // smuggled through — the arm exists for consistency with
                // every other walk so a future shape that promotes a slot
                // to ViewNode can't slip an interactive section past this
                // validator. Mirrors the TS twin `case "chip"` arm.
                break;

            case ChipListNode chipList:
                // v8.0.0 (COMP-13a) — ChipListNode.Children are ChipNodes;
                // descend into each for defense-in-depth (chips carry no
                // ViewNode slots today, but if a future slot is added the
                // descent is already correct). Mirrors the TS twin
                // `case "chip-list"` arm.
                foreach (var child in chipList.Children) WalkForSectionAction(child, outerInteractive);
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

            case BlockquoteNode blockquote:
                // A blockquote's children can hold interactive sections, so the
                // nested-section-interaction rules must descend into it.
                foreach (var child in blockquote.Children) WalkForSectionAction(child, outerInteractive);
                break;

            case EmptyStateNode emptyState:
                // EmptyStateNode.Action is a ButtonNode (no SectionNode
                // descendants), but descend for consistency with every other
                // walk so a future shape can't slip an interactive section past.
                if (emptyState.Action is { } esAction) WalkForSectionAction(esAction, outerInteractive);
                break;

            case IconNode:
                // v7.0.0 (ICON-01) — IconNode is a terminal leaf (no children,
                // no SectionNode descendants). Same terminal-leaf posture as
                // the leaf comment below.
                break;

            case AvatarNode:
                // v8.0.0 (COMP-04) — AvatarNode is a terminal leaf (no
                // children, no SectionNode descendants). Same terminal-leaf
                // posture as IconNode.
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
                // v8.0.0 (COMP-05a) — ListNode(variant:"rows") accepts ONLY
                // ListRowNode children; variant:"items" (or omitted) rejects
                // ListRowNode children. Both violations fail with invalid_tree
                // — byte-identical error messages across TS + .NET (see the
                // twin `case "list"` arm in viewmodel-shell/src/server.ts).
                if (list.Variant == ListVariant.Rows)
                {
                    foreach (var child in list.Children)
                    {
                        if (child is not ListRowNode)
                        {
                            var childType = ViewNodeWireName(child);
                            throw new InvalidOperationException(
                                $"ListNode(variant:\"rows\") accepts only ListRowNode children; " +
                                $"found a \"{childType}\" child. A rows-variant list is a single-" +
                                $"bordered-surface container of ListRowNodes — mix by wrapping " +
                                $"the other node in its own container, or move to variant:\"items\".");
                        }
                    }
                }
                else
                {
                    foreach (var child in list.Children)
                    {
                        if (child is ListRowNode)
                        {
                            throw new InvalidOperationException(
                                "ListNode(variant:\"items\") does not accept ListRowNode children; " +
                                "found a \"list-row\" child. ListRowNode belongs inside a " +
                                "ListNode(variant:\"rows\") container or rendered standalone. " +
                                "Either set variant:\"rows\" on this ListNode or move the " +
                                "list-row out of it.");
                        }
                    }
                }
                foreach (var child in list.Children) Collect(child, enclosingForm, sink);
                break;

            case ListItemNode item:
                foreach (var child in item.Children) Collect(child, enclosingForm, sink);
                break;

            case ListRowNode listRow:
                // v8.0.0 (COMP-05) — ListRowNode slots: Leading, Primary/
                // Secondary/Meta[]/Trailing (any ViewNode subtree), Action
                // (whole-row click). Every ViewNode-typed slot descended into;
                // Action recorded via Record (participates in name uniqueness
                // the same way TableRow.Action does). Mirrors the TS twin
                // `case "list-row"` arm in server.ts.
                if (listRow.Leading is { } lrLead) Collect(lrLead, enclosingForm, sink);
                Collect(listRow.Primary, enclosingForm, sink);
                if (listRow.Secondary is { } lrSec) Collect(lrSec, enclosingForm, sink);
                if (listRow.Meta is { } lrMeta)
                {
                    foreach (var m in lrMeta) Collect(m, enclosingForm, sink);
                }
                if (listRow.Trailing is { } lrTrail) Collect(lrTrail, enclosingForm, sink);
                if (listRow.Action is { } lrAction) Record(lrAction, enclosingForm, sink);
                break;

            case MessageNode message:
                // v8.0.0 (COMP-06) — MessageNode slots: Avatar (ViewNode?),
                // Content (ViewNode, required), Actions (IReadOnlyList<ViewNode>?
                // — typed wide for polymorphic discriminator emission per the
                // FormNode.Buttons posture at :1155-1159). Descend into every
                // ViewNode-typed slot; each ButtonNode child's Action
                // participates in name uniqueness — filter via OfType<
                // ButtonNode>() to match FormNode.Buttons handling at :2598
                // exactly. Mirrors the TS twin `case "message"` arm in server.ts.
                if (message.Avatar is { } msgAvatar) Collect(msgAvatar, enclosingForm, sink);
                Collect(message.Content, enclosingForm, sink);
                if (message.Actions is { } msgActions)
                {
                    foreach (var btn in msgActions) Collect(btn, enclosingForm, sink);
                }
                break;

            case MessageListNode messageList:
                // v8.0.0 (COMP-06a) — MessageListNode.Children MUST be
                // MessageNode. Children is typed IReadOnlyList<ViewNode> on
                // the record (widening from IReadOnlyList<MessageNode> is
                // deliberate — a narrow shape drops the polymorphic
                // "type":"message" discriminator per the FormNode.Buttons
                // banked posture), so the tree-shape invariant IS enforced
                // exclusively at runtime here — the compile-time type would
                // silently accept any ViewNode.
                //
                // Byte-identical error message across TS + .NET (see the TS
                // twin `case "message-list"` arm in server.ts).
                foreach (var child in messageList.Children)
                {
                    if (child is not MessageNode)
                    {
                        var childType = ViewNodeWireName(child);
                        throw new InvalidOperationException(
                            $"MessageListNode.children must all be MessageNodes (found: {childType})");
                    }
                }
                foreach (var child in messageList.Children) Collect(child, enclosingForm, sink);
                break;

            case AlertNode alert:
                // v8.0.0 (COMP-07) — AlertNode slots: Message (ViewNode,
                // required), Actions (IReadOnlyList<ViewNode>?  — typed wide
                // for polymorphic discriminator emission per the FormNode.
                // Buttons posture at :1155-1159). Icon/Title are primitives.
                // Descend into every ViewNode-typed slot; each ButtonNode
                // child's Action participates in name uniqueness.
                //
                // NOTE: Dismissible:true emits { name: "dismiss" } CLIENT-
                // SIDE at click time (browser.ts alert() renderer). The
                // server tree carries NO ActionDescriptor for it — deliberate
                // deviation from ModalNode.DismissAction per CONTEXT §5. So
                // the walker records NOTHING for the dismiss button; apps
                // needing the "dismiss" name to participate in uniqueness
                // compose their own dismiss button in Actions and set
                // Dismissible:false. Mirrors the TS twin `case "alert"` arm.
                Collect(alert.Message, enclosingForm, sink);
                if (alert.Actions is { } alertActions)
                {
                    foreach (var btn in alertActions) Collect(btn, enclosingForm, sink);
                }
                break;

            case UserRowNode userRow:
                // v8.0.0 (COMP-09) — UserRowNode slots: Avatar (ViewNode?),
                // Name (ViewNode, required), Meta (ViewNode?), Trailing
                // (ViewNode?), Action (whole-row click). Every ViewNode-typed
                // slot descended into; Action recorded via Record (participates
                // in name uniqueness the same way ListRowNode.Action does).
                // Status is a leaf sub-record (UserRowStatus with a closed
                // StatusKind enum) — NO walker descent. Mirrors the TS twin
                // `case "user-row"` arm in server.ts.
                if (userRow.Avatar is { } urAvatar) Collect(urAvatar, enclosingForm, sink);
                Collect(userRow.Name, enclosingForm, sink);
                if (userRow.Meta is { } urMeta) Collect(urMeta, enclosingForm, sink);
                if (userRow.Trailing is { } urTrail) Collect(urTrail, enclosingForm, sink);
                if (userRow.Action is { } urAction) Record(urAction, enclosingForm, sink);
                break;

            case DetailRowNode detailRow:
                // v8.0.0 (COMP-10) — DetailRowNode slots: Value (ViewNode,
                // required). Label + Icon + Tone are primitives (Label is a
                // raw string, Icon is IconName, Tone is a closed-union enum)
                // — no descent. Value is REQUIRED as ViewNode (not
                // ViewNode?) so the .NET server always has a subtree to walk
                // (the TS twin's `string | ViewNode` convenience wraps in
                // TextNode{body} at render time; the .NET server wraps
                // explicitly). NO Action slot on this node — DetailRowNode is
                // passive display. Mirrors the TS twin `case "detail-row"`
                // arm in server.ts.
                Collect(detailRow.Value, enclosingForm, sink);
                break;

            case DetailListNode detailList:
                // v8.0.0 (COMP-10a) — DetailListNode.Children MUST be
                // DetailRowNode. Children is typed IReadOnlyList<ViewNode>
                // on the record (widening from DetailRowNode-only is
                // deliberate — a narrow shape drops the polymorphic
                // "type":"detail-row" discriminator per the FormNode.Buttons
                // banked posture at :1155-1159), so the tree-shape invariant
                // IS enforced exclusively at runtime here — the compile-time
                // type would silently accept any ViewNode.
                //
                // Byte-identical error message across TS + .NET (see the TS
                // twin `case "detail-list"` arm in server.ts).
                foreach (var child in detailList.Children)
                {
                    if (child is not DetailRowNode)
                    {
                        var childType = ViewNodeWireName(child);
                        throw new InvalidOperationException(
                            $"DetailListNode.children must all be DetailRowNodes (found: {childType})");
                    }
                }
                foreach (var child in detailList.Children) Collect(child, enclosingForm, sink);
                break;

            case TimelineEntryNode timelineEntry:
                // v8.0.0 (COMP-11) — TimelineEntryNode slots: Description
                // (ViewNode, required). Time + Icon + Tone are primitives
                // (Time is a raw string, Icon is IconName, Tone is a
                // closed-union enum) — no descent. Description is REQUIRED as
                // ViewNode (not ViewNode?) so the .NET server always has a
                // subtree to walk (the TS twin's `string | ViewNode`
                // convenience wraps in TextNode{body} at render time; the
                // .NET server wraps explicitly). NO Action slot on this node
                // — TimelineEntryNode is passive display. Mirrors the TS
                // twin `case "timeline-entry"` arm in server.ts.
                Collect(timelineEntry.Description, enclosingForm, sink);
                break;

            case TimelineNode timeline:
                // v8.0.0 (COMP-11a) — TimelineNode.Children MUST be
                // TimelineEntryNode. Children is typed IReadOnlyList<ViewNode>
                // on the record (deliberately widened from
                // TimelineEntryNode-only, for polymorphic-discriminator
                // preservation — see the record's XML doc), so the tree-shape
                // invariant IS enforced exclusively at runtime here — the
                // compile-time type would silently accept any ViewNode.
                //
                // Byte-identical error message across TS + .NET (see the TS
                // twin `case "timeline"` arm in server.ts).
                foreach (var child in timeline.Children)
                {
                    if (child is not TimelineEntryNode)
                    {
                        var childType = ViewNodeWireName(child);
                        throw new InvalidOperationException(
                            $"TimelineNode.children must all be TimelineEntryNodes (found: {childType})");
                    }
                }
                foreach (var child in timeline.Children) Collect(child, enclosingForm, sink);
                break;

            case SettingRowNode settingRow:
                // v8.0.0 (COMP-12) — SettingRowNode slots: Label (ViewNode,
                // required), Description (ViewNode?), Trailing (ViewNode?),
                // Action (whole-row click). Every ViewNode-typed slot
                // descended into; Action recorded via Record (participates
                // in name uniqueness the same way ListRowNode.Action +
                // UserRowNode.Action do). Icon is a leaf primitive
                // (IconName closed enum) — NO walker descent. Mirrors the
                // TS twin `case "setting-row"` arm in server.ts.
                //
                // The natural pairing (Trailing = CheckboxNode(Variant:
                // "switch") with its own Action) participates via the
                // recursive Collect call on Trailing — the switch's action
                // and the row's Action both flow through the same
                // uniqueness check.
                Collect(settingRow.Label, enclosingForm, sink);
                if (settingRow.Description is { } srDesc) Collect(srDesc, enclosingForm, sink);
                if (settingRow.Trailing is { } srTrail) Collect(srTrail, enclosingForm, sink);
                if (settingRow.Action is { } srAction) Record(srAction, enclosingForm, sink);
                break;

            case SettingListNode settingList:
                // v8.0.0 (COMP-12a) — SettingListNode.Children MUST be
                // SettingRowNode. Children is typed IReadOnlyList<ViewNode>
                // on the record (deliberately widened from
                // SettingRowNode-only, for polymorphic-discriminator
                // preservation — see the record's XML doc), so the
                // tree-shape invariant IS enforced exclusively at runtime
                // here — the compile-time type would silently accept any
                // ViewNode.
                //
                // Byte-identical error message across TS + .NET (see the
                // TS twin `case "setting-list"` arm in server.ts).
                foreach (var child in settingList.Children)
                {
                    if (child is not SettingRowNode)
                    {
                        var childType = ViewNodeWireName(child);
                        throw new InvalidOperationException(
                            $"SettingListNode.children must all be SettingRowNodes (found: {childType})");
                    }
                }
                foreach (var child in settingList.Children) Collect(child, enclosingForm, sink);
                break;

            case ChipNode chip:
                // v8.0.0 (COMP-13) — ChipNode has TWO independent ActionEvent
                // slots: DismissAction (X click, caller-supplied identity-
                // carrying name like `remove-filter-42`) and Action (whole-chip
                // click, caller-supplied toggle name like `toggle-filter-42`).
                // BOTH participate in name uniqueness — a chip in a filter set
                // might carry BOTH as its two independent operations on the
                // same identity.
                //
                // 🚨 CRITICAL POSTURE: DismissAction is a CALLER-SUPPLIED
                // ActionDescriptor (mirrors ModalNode.DismissAction). Unlike
                // AlertNode.Dismissible (bool → fixed local `{name:"dismiss"}`
                // emitted client-side; walker records nothing), Chip's
                // DismissAction IS on the wire and MUST be recorded here for
                // uniqueness. See ChipNode XML doc + AGENTS.md.
                //
                // Mirrors the TS twin `case "chip"` arm in server.ts.
                if (chip.DismissAction is { } chipDismiss) Record(chipDismiss, enclosingForm, sink);
                if (chip.Action is { } chipAction) Record(chipAction, enclosingForm, sink);
                break;

            case ChipListNode chipList:
                // v8.0.0 (COMP-13a) — ChipListNode.Children MUST be ChipNode.
                // Children is typed IReadOnlyList<ViewNode> on the record
                // (deliberately widened from ChipNode-only, for polymorphic-
                // discriminator preservation — see the record's XML doc), so
                // the tree-shape invariant IS enforced exclusively at runtime
                // here — the compile-time type would silently accept any
                // ViewNode.
                //
                // Byte-identical error message across TS + .NET (see the TS
                // twin `case "chip-list"` arm in server.ts).
                foreach (var child in chipList.Children)
                {
                    if (child is not ChipNode)
                    {
                        var childType = ViewNodeWireName(child);
                        throw new InvalidOperationException(
                            $"ChipListNode.children must all be ChipNodes (found: {childType})");
                    }
                }
                foreach (var child in chipList.Children) Collect(child, enclosingForm, sink);
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
                // v7.0.0 (ICON-05) — icon-only ButtonNode a11y rule. An
                // icon-only button with no visible label AND no tooltip is a
                // screen-reader void: the tooltip double-duties as the button's
                // aria-label, so requiring tooltip closes the gap. Byte-identical
                // error message across TS + .NET (parity byte-diffs verify
                // agreement). See design-doc §5.
                if (button.Icon is not null
                    && string.IsNullOrEmpty(button.Label)
                    && button.Tooltip is null)
                {
                    throw new InvalidOperationException(
                        "icon-only ButtonNode requires tooltip (used as aria-label)");
                }
                Record(button.Action, enclosingForm, sink);
                break;

            case IconNode:
                // v7.0.0 (ICON-01) — IconNode is a leaf (no children, no
                // action). The arm exists so a future refactor that promotes it
                // to a container fails the C# exhaustive check here first.
                break;

            case AvatarNode:
                // v8.0.0 (COMP-04) — AvatarNode is a leaf (no children, no
                // action). Same terminal-leaf posture as IconNode.
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

            case BlockquoteNode blockquote:
                // BlockquoteNode.Children can hold interactive descendants
                // (buttons, forms). Missing this arm would silently exempt every
                // action inside a quote from the one-name-one-operation rule
                // (the missed-walk failure class). Same shape as the FitsNode /
                // SectionNode arms above.
                foreach (var child in blockquote.Children) Collect(child, enclosingForm, sink);
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
            //   CopyButtonNode, BadgeNode, ChartNode, StepsNode, DiffNode.
            // ChartNode (CHART-05), StepsNode (NAV-02), and DiffNode (DIFF-01)
            // are DELIBERATE childless/action-free data leaves — they fall
            // through here with no recursion (no fits-style blind spot).
            // BreadcrumbNode is handled above (its crumbs carry dispatch actions).
            // ⚠️ TrackerNode is a known gap: TrackerCell can carry an optional
            // per-bucket Action but this walker doesn't descend (the TS twin
            // does — a real parity mismatch). Filed as `tracker-net-walker-gap`.
        }
    }

    private static void Record(
        ActionDescriptor action,
        FormNode? enclosingForm,
        List<(string Name, FormNode? EnclosingForm)> sink)
    {
        sink.Add((action.Name, enclosingForm));
    }

    /// <summary>Best-effort wire discriminator for a ViewNode. Used only for
    /// diagnostic error messages (composite tree-invariant violations); the
    /// canonical serialization discriminator comes from the [JsonDerivedType]
    /// attributes on the base ViewNode. This helper falls back to the CLR
    /// type name if it doesn't know the mapping — good enough for a human-
    /// readable error message.</summary>
    private static string ViewNodeWireName(ViewNode node) => node switch
    {
        PageNode      => "page",
        SectionNode   => "section",
        ListNode      => "list",
        ListItemNode  => "list-item",
        ListRowNode   => "list-row",
        FormNode      => "form",
        FieldNode     => "field",
        CheckboxNode  => "checkbox",
        ButtonNode    => "button",
        TextNode      => "text",
        LinkNode      => "link",
        ImageNode     => "image",
        StatBarNode   => "stat-bar",
        TabsNode      => "tabs",
        ProgressNode  => "progress",
        ModalNode     => "modal",
        TableNode     => "table",
        CopyButtonNode => "copy-button",
        DividerNode   => "divider",
        FitsNode      => "fits",
        EmptyStateNode => "empty-state",
        BadgeNode     => "badge",
        ChartNode     => "chart",
        BlockquoteNode => "blockquote",
        CodeBlockNode => "code-block",
        BreadcrumbNode => "breadcrumb",
        StepsNode     => "steps",
        TrackerNode   => "tracker",
        DiffNode      => "diff",
        IconNode      => "icon",
        AvatarNode    => "avatar",
        MessageNode    => "message",
        MessageListNode => "message-list",
        AlertNode     => "alert",
        UserRowNode   => "user-row",
        DetailRowNode  => "detail-row",
        DetailListNode => "detail-list",
        TimelineEntryNode => "timeline-entry",
        TimelineNode      => "timeline",
        _             => node.GetType().Name,
    };
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
