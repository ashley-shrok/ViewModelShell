// v8.0.0 (COMP-12a) — SettingListNode wire-shape parity + tree-invariant.
//
// Proves the .NET SettingListNode record + [JsonDerivedType] discriminator
// serialize BYTE-ALIGNED with the TS twin:
//   • The bare `new SettingListNode(Children: [])` serializes as
//     `{"type":"setting-list","children":[]}` — required field present,
//     every optional ABSENT (AGENTS.md gotcha #8 class-2 findNulls defect).
//   • Children serialize polymorphically with `"type":"setting-row"` per
//     entry (proves the IReadOnlyList<ViewNode> posture keeps the
//     discriminator per FormNode.Buttons + MessageListNode.Children +
//     DetailListNode.Children + TimelineNode.Children banked posture).
//   • Heading carries WhenWritingNull → absent when null; string round-trips.
//   • Tree-invariant: passing a non-SettingRowNode into
//     ViewTreeValidation.ValidateActionNames throws InvalidOperationException
//     with the BYTE-IDENTICAL error message the TS twin throws:
//     `"SettingListNode.children must all be SettingRowNodes (found:
//     <type>)"`. This is the defense-in-depth guard for hostile
//     deserialization paths.
//
// Mirrors DetailListNodeSerializationTests.cs / TimelineNodeSerializationTests
// .cs / MessageListNodeSerializationTests.cs — the direct byte-aligned
// template for a container composite with a tree invariant.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class SettingListNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void Type_SerializesAsSettingList()
    {
        var node = new SettingListNode(Children: Array.Empty<ViewNode>());
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"setting-list\"", json);
    }

    // ─── Class-2 findNulls defect protection ────────────────────────────────

    [Fact]
    public void Children_EmptyList_SerializesAsEmptyArray()
    {
        // Empty children array is a legal (if unusual) state — proves the
        // required Children field is always emitted and every optional
        // (Heading) is ABSENT.
        var node = new SettingListNode(Children: Array.Empty<ViewNode>());
        var json = Serialize<ViewNode>(node);
        Assert.Equal("{\"type\":\"setting-list\",\"children\":[]}", json);
    }

    [Fact]
    public void Children_WithSettingRows_SerializesPolymorphically()
    {
        // Each SettingRowNode child JSON carries `"type":"setting-row"` —
        // proves the polymorphic discriminator lands through the
        // IReadOnlyList<ViewNode> serialization path (widened from the narrow
        // SettingRowNode-only type per the FormNode.Buttons banked posture).
        var node = new SettingListNode(Children: new ViewNode[]
        {
            new SettingRowNode(Label: new TextNode("Email notifications")),
            new SettingRowNode(Label: new TextNode("Push notifications")),
        });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"children\":[", json);
        // Two setting-row entries → two occurrences of the discriminator.
        var discCount = 0;
        var i = 0;
        while ((i = json.IndexOf("\"type\":\"setting-row\"", i, StringComparison.Ordinal)) >= 0)
        {
            discCount++;
            i += 1;
        }
        Assert.Equal(2, discCount);
        Assert.Contains("Email notifications", json);
        Assert.Contains("Push notifications", json);
    }

    // ─── Heading — WhenWritingNull + round-trip ─────────────────────────────

    [Fact]
    public void Heading_OmittedIsAbsent()
    {
        var node = new SettingListNode(Children: Array.Empty<ViewNode>());
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"heading\"", json);
    }

    [Fact]
    public void Heading_SetPresent()
    {
        var node = new SettingListNode(
            Children: Array.Empty<ViewNode>(),
            Heading: "Notifications");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"heading\":\"Notifications\"", json);
    }

    // ─── Tree invariant — non-SettingRowNode child rejected with byte-identical error ─

    [Fact]
    public void TreeInvariant_SettingListWithNonSettingRowChild_ThrowsInvalidTree()
    {
        // SettingListNode.Children is typed IReadOnlyList<ViewNode> on the
        // .NET record (deliberately widened from SettingRowNode-only, for
        // polymorphic-discriminator preservation — see the record's XML doc).
        // The tree invariant is therefore enforced ENTIRELY at runtime by
        // ViewTreeValidation.Collect: any non-SettingRowNode child throws
        // InvalidOperationException with the BYTE-IDENTICAL error message the
        // TS twin throws at the same point in server.ts collectActions.
        //
        // This test is the direct .NET twin of the TS runtime probe in
        // test/setting-row.test.ts:
        //   validateActionNames({type:"setting-list", children:[{type:"text",…}]})
        // → both backends throw
        //   "SettingListNode.children must all be SettingRowNodes (found:
        //   text)".
        var badNode = new SettingListNode(Children: new ViewNode[]
        {
            new TextNode("not a setting-row"),
        });

        var ex = Assert.Throws<InvalidOperationException>(() =>
            ViewTreeValidation.ValidateActionNames(badNode));
        Assert.Equal(
            "SettingListNode.children must all be SettingRowNodes (found: text)",
            ex.Message);
    }

    [Fact]
    public void TreeInvariant_SettingListWithSettingRowChildren_Passes()
    {
        // Positive control — a legitimate SettingListNode passes the
        // validator. Confirms the invariant does not false-positive.
        // Uses the natural pairing (CheckboxNode(Variant:"switch") in
        // Trailing) to prove the walker descends correctly through the
        // pairing without spurious rejection.
        var goodNode = new SettingListNode(
            Heading: "Notifications",
            Children: new ViewNode[]
            {
                new SettingRowNode(
                    Label: new TextNode("Email"),
                    Trailing: new CheckboxNode(
                        Name: "email",
                        Bind: "settings.email",
                        Label: "",
                        Action: null,
                        Variant: CheckboxVariant.Switch)),
                new SettingRowNode(
                    Label: new TextNode("Push"),
                    Trailing: new CheckboxNode(
                        Name: "push",
                        Bind: "settings.push",
                        Label: "",
                        Action: null,
                        Variant: CheckboxVariant.Switch)),
            });
        // Should NOT throw.
        ViewTreeValidation.ValidateActionNames(goodNode);
    }
}
