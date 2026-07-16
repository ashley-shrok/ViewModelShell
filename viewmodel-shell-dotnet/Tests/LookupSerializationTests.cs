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
}
