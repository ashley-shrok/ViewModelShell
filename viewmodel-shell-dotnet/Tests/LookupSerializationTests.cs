// 5.2.0 (LOOK-06) — the lookup wire surface, serialization + validator parity.
//
// Proves the lookup surface serializes BYTE-IDENTICALLY to the TS twin:
//   • AllowCustom's false default is ABSENT from the wire (WhenWritingDefault),
//     matching the TS optional `allowCustom?: boolean`;
//   • every new nullable (Selected/Candidates/SearchBind/SearchAction) is
//     ABSENT when null (WhenWritingNull);
//   • a LookupItem omits label/type when unset (D5 label==value — the free-form
//     tag case; D6 monomorphic references);
//   • Selected is ALWAYS a JSON ARRAY — including the single-select `lookup`
//     case, where it holds 0 or 1 entries.
// Plus a validation assertion proving the Collect FieldNode arm descends into
// SearchAction, so a duplicate search-action name is rejected on the .NET side
// exactly as it is on the TS side (the two walkers provably agree).
//
// 🚨 Serializes with DEFAULT web JSON options — camelCase naming ONLY, with NO
// DefaultIgnoreCondition configured. That is the WHOLE POINT of gotcha #8: the
// null/false omission is INTRINSIC to the attributes on the types and is
// honored regardless of host JsonSerializerOptions. A test that configured
// DefaultIgnoreCondition itself would prove NOTHING about a real host — it
// would pass even if every attribute were missing. Do NOT "helpfully" add it.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class LookupSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Collect descends into SearchAction (uniqueness enforced) ───────────

    [Fact]
    public void Field_DuplicateSearchActionName_Throws()
    {
        // The .NET twin of the TS walker test from Plan 21-01: a searchAction
        // name colliding with a button's name OUTSIDE any shared form is a hard
        // validator failure. A walker that changed on one backend only is
        // exactly how a duplicate action name sails through one side and 500s
        // on the real controller of the other.
        var field = new FieldNode(
            "owner",
            "lookup",
            Bind: "fields.ownerId",
            Label: "Owner",
            Placeholder: null,
            SearchAction: new ActionDescriptor("lookup-search"));
        var button = new ButtonNode("Go", new ActionDescriptor("lookup-search"));
        var tree = new PageNode(Title: null, Children: new ViewNode[] { field, button });

        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'lookup-search'", ex.Message);
    }

    [Fact]
    public void Field_ActionAndSearchAction_BothRecorded()
    {
        // Distinct names on the same field ⇒ both walked, no collision.
        var field = new FieldNode(
            "owner",
            "lookup",
            Bind: "fields.ownerId",
            Label: "Owner",
            Placeholder: null,
            Action: new ActionDescriptor("commit-owner"),
            SearchAction: new ActionDescriptor("search-owner"));
        var collide = new ButtonNode("Go", new ActionDescriptor("search-owner"));
        var tree = new PageNode(Title: null, Children: new ViewNode[] { field, collide });

        // Proves SearchAction is RECORDED (not merely tolerated): the collision
        // is with the SEARCH action's name, so this only throws if the walker
        // descended into SearchAction.
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'search-owner'", ex.Message);
    }

    [Fact]
    public void Field_UniqueSearchActionName_Passes()
    {
        var field = new FieldNode(
            "owner",
            "lookup",
            Bind: "fields.ownerId",
            Label: "Owner",
            Placeholder: null,
            Action: new ActionDescriptor("commit-owner"),
            SearchAction: new ActionDescriptor("search-owner"));
        var tree = new PageNode(Title: null, Children: new ViewNode[] { field });

        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Null(ex);
    }

    // ─── LookupItem — label/type absent when unset (D5 / D6) ────────────────

    // NOTE: these two serialize the BARE LookupItem, not a FieldNode. That is
    // deliberate and load-bearing for the `type` case: a FieldNode ALWAYS emits
    // the [JsonPolymorphic] discriminator "type":"field", so a
    // DoesNotContain("\"type\"") assertion against a serialized FieldNode could
    // never pass and would prove nothing about LookupItem.Type. The bare record
    // is the only place the item's own `type` absence is observable — and the
    // fact that it serializes with NO discriminator of its own is exactly the
    // "LookupItem is a plain sub-record, not a ViewNode" claim (T-21-07).
    // FieldNode-level non-collision is asserted separately below.

    [Fact]
    public void LookupItem_ValueOnly_OmitsLabelAndType()
    {
        // D5: the label is omitted when it equals the value (the free-form tag
        // case — a tag is a value whose label is itself). D6: type is omitted
        // for a monomorphic reference.
        var json = Serialize(new LookupItem("u-1"));
        Assert.Equal("{\"value\":\"u-1\"}", json);
        Assert.DoesNotContain("\"label\"", json);
        Assert.DoesNotContain("\"type\"", json);
    }

    [Fact]
    public void LookupItem_LabelAndType_Present()
    {
        var json = Serialize(new LookupItem("u-1", "Sally Omer", "user"));
        Assert.Contains("\"value\":\"u-1\"", json);
        Assert.Contains("\"label\":\"Sally Omer\"", json);
        Assert.Contains("\"type\":\"user\"", json);
    }

    [Fact]
    public void LookupItem_BareRecord_CarriesNoDiscriminator()
    {
        // T-21-07 stated as an executable claim: LookupItem is NOT a ViewNode,
        // so STJ writes no "type" discriminator into it and its own Type member
        // is free to be the reference-kind tag.
        var json = Serialize(new LookupItem("u-1", "Sally Omer"));
        Assert.DoesNotContain("\"type\"", json);
    }

    // ─── FieldNode — the four nullables are absent when null ────────────────

    private static FieldNode PlainLookup(
        IReadOnlyList<LookupItem>? selected = null,
        IReadOnlyList<LookupItem>? candidates = null,
        string? searchBind = null,
        ActionDescriptor? searchAction = null,
        bool allowCustom = false) =>
        new(
            "owner",
            "lookup",
            Bind: "fields.ownerId",
            Label: "Owner",
            Placeholder: null,
            Selected: selected,
            Candidates: candidates,
            SearchBind: searchBind,
            SearchAction: searchAction,
            AllowCustom: allowCustom);

    [Fact]
    public void Field_LookupNullables_AllAbsentWhenNull()
    {
        var json = Serialize<ViewNode>(PlainLookup());
        Assert.DoesNotContain("\"selected\"", json);
        Assert.DoesNotContain("\"candidates\"", json);
        Assert.DoesNotContain("\"searchBind\"", json);
        Assert.DoesNotContain("\"searchAction\"", json);
    }

    [Fact]
    public void Field_LookupNullables_PresentWhenSet()
    {
        var json = Serialize<ViewNode>(PlainLookup(
            selected: new[] { new LookupItem("u-1", "Sally Omer") },
            candidates: new[] { new LookupItem("u-2", "Ada Vance") },
            searchBind: "fields.ownerQuery",
            searchAction: new ActionDescriptor("search-owner")));
        Assert.Contains("\"selected\":[", json);
        Assert.Contains("\"candidates\":[", json);
        Assert.Contains("\"searchBind\":\"fields.ownerQuery\"", json);
        Assert.Contains("\"searchAction\":{\"name\":\"search-owner\"}", json);
    }

    [Fact]
    public void Field_LookupItemTypeNull_DoesNotCollideWithDiscriminator()
    {
        // The FieldNode-level half of T-21-07: with every LookupItem.Type null,
        // "type" appears EXACTLY ONCE in the whole tree — the node discriminator
        // — proving the item contributed none of its own.
        var json = Serialize<ViewNode>(PlainLookup(
            selected: new[] { new LookupItem("u-1", "Sally Omer") },
            candidates: new[] { new LookupItem("u-2", "Ada Vance") }));
        Assert.Contains("\"type\":\"field\"", json);
        Assert.Equal(1, System.Text.RegularExpressions.Regex.Matches(json, "\"type\":").Count);
    }

    // ─── AllowCustom — the WhenWritingDefault proof (gotcha #8) ─────────────

    [Fact]
    public void Field_AllowCustom_DefaultFalse_IsAbsent()
    {
        // THE assertion this whole plan exists for: an optional non-nullable
        // bool whose `false` means "absent/unset" must NOT serialize its
        // default, or it drifts from the TS optional `allowCustom?: boolean`
        // (which omits it) and fails strict consumers.
        var json = Serialize<ViewNode>(PlainLookup());
        Assert.DoesNotContain("\"allowCustom\"", json);
    }

    [Fact]
    public void Field_AllowCustom_True_SerializesTrue()
    {
        var json = Serialize<ViewNode>(PlainLookup(allowCustom: true));
        Assert.Contains("\"allowCustom\":true", json);
    }

    // ─── Selected is ALWAYS an array ───────────────────────────────────────

    [Fact]
    public void Field_SingleSelect_SelectedSerializesAsArray_NotObject()
    {
        // The deliberate always-array decision, asserted explicitly because it
        // is precisely what a future "simplification" would break: a single
        // `lookup` holds 0 or 1 entries in an ARRAY. A T | T[] union does not
        // serialize byte-identically under both System.Text.Json and
        // JSON.stringify — that is the banked parity-drift lesson.
        var json = Serialize<ViewNode>(PlainLookup(
            selected: new[] { new LookupItem("u-1", "Sally Omer") }));
        Assert.Contains("\"selected\":[", json);
        Assert.DoesNotContain("\"selected\":{", json);
        Assert.Contains("\"selected\":[{\"value\":\"u-1\",\"label\":\"Sally Omer\"}]", json);
    }

    [Fact]
    public void Field_SingleSelect_EmptySelected_SerializesAsEmptyArray()
    {
        // 0 entries is a legitimate, DISTINCT state from absent: "the app is
        // rendering a lookup and nothing is chosen" vs "no selection concept".
        var json = Serialize<ViewNode>(PlainLookup(selected: System.Array.Empty<LookupItem>()));
        Assert.Contains("\"selected\":[]", json);
    }

    [Fact]
    public void Field_LookupMultiple_SelectedHoldsMultipleEntries()
    {
        var node = new FieldNode(
            "tags",
            "lookup-multiple",
            Bind: "fields.tagIds",
            Label: "Tags",
            Placeholder: null,
            Selected: new[] { new LookupItem("t-1", "urgent"), new LookupItem("t-2") },
            AllowCustom: true);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"inputType\":\"lookup-multiple\"", json);
        Assert.Contains("\"selected\":[{\"value\":\"t-1\",\"label\":\"urgent\"},{\"value\":\"t-2\"}]", json);
        Assert.Contains("\"allowCustom\":true", json);
    }

    // ─── inputType tokens ride as plain strings ────────────────────────────

    [Fact]
    public void Field_LookupInputType_SerializesAsLiteralString()
    {
        var json = Serialize<ViewNode>(PlainLookup());
        Assert.Contains("\"inputType\":\"lookup\"", json);
    }
}
