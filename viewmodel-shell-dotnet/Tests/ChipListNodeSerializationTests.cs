// v8.0.0 (COMP-13a) — ChipListNode wire-shape parity + tree invariant.
//
// Proves the .NET ChipListNode record + [JsonDerivedType] discriminator
// serialize BYTE-ALIGNED with the TS twin, AND that the runtime tree-shape
// invariant fires with the BYTE-IDENTICAL error message the TS twin throws.
//
//   • Type is "chip-list" on the wire.
//   • Children is typed IReadOnlyList<ViewNode> (NOT
//     IReadOnlyList<ChipNode>) so System.Text.Json emits the polymorphic
//     "type":"chip" discriminator on each child (banked posture from
//     FormNode.Buttons + MessageListNode.Children + DetailListNode.Children
//     + TimelineNode.Children + SettingListNode.Children).
//   • The tree-shape invariant IS enforced exclusively at runtime by
//     ViewTreeValidation.Collect: any non-ChipNode child throws
//     InvalidOperationException with byte-identical error text to the TS
//     twin.
//
// Mirrors SettingListNodeSerializationTests.cs / MessageListNodeSerializationTests.cs.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class ChipListNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void Type_SerializesAsChipList()
    {
        var node = new ChipListNode(Children: Array.Empty<ViewNode>());
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"chip-list\"", json);
    }

    // ─── Children (required) — polymorphic emission ─────────────────────────

    [Fact]
    public void Children_EmptyList_SerializesAsEmptyArray()
    {
        var node = new ChipListNode(Children: Array.Empty<ViewNode>());
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"children\":[]", json);
    }

    [Fact]
    public void Children_WithChips_SerializesPolymorphically()
    {
        // Children is typed IReadOnlyList<ViewNode>? (NOT
        // IReadOnlyList<ChipNode>) so System.Text.Json emits the polymorphic
        // "type":"chip" discriminator on each entry — banked posture from
        // FormNode.Buttons at ViewModels.cs. A ChipNode-narrow list would
        // silently drop the discriminator.
        var node = new ChipListNode(Children: new ViewNode[]
        {
            new ChipNode(Label: "one"),
            new ChipNode(Label: "two", Tone: Tone.Danger),
        });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"children\":[", json);
        // Each child carries its discriminator.
        Assert.Contains("\"type\":\"chip\"", json);
        Assert.Contains("\"label\":\"one\"", json);
        Assert.Contains("\"label\":\"two\"", json);
        Assert.Contains("\"tone\":\"danger\"", json);
    }

    // ─── Tree invariant — non-Chip child rejected with byte-identical error ─

    [Fact]
    public void TreeInvariant_ChipListWithNonChipChild_ThrowsInvalidTree()
    {
        // ChipListNode.Children is typed IReadOnlyList<ViewNode> on the .NET
        // record (deliberately widened from ChipNode-only, for polymorphic-
        // discriminator preservation — see the record's XML doc). The tree
        // invariant is therefore enforced ENTIRELY at runtime by
        // ViewTreeValidation.Collect: any non-ChipNode child throws
        // InvalidOperationException with the BYTE-IDENTICAL error message
        // the TS twin throws at the same point in server.ts collectActions.
        //
        // This test is the direct .NET twin of the TS runtime probe in
        // test/chip.test.ts:
        //   validateActionNames({type:"chip-list", children:[{type:"text",…}]})
        // → both backends throw
        //   "ChipListNode.children must all be ChipNodes (found: text)".
        var bad = new ChipListNode(Children: new ViewNode[]
        {
            new TextNode("not a chip"),
        });

        var ex = Assert.Throws<InvalidOperationException>(() =>
            ViewTreeValidation.ValidateActionNames(bad));
        Assert.Equal(
            "ChipListNode.children must all be ChipNodes (found: text)",
            ex.Message);
    }

    [Fact]
    public void TreeInvariant_ChipListWithChipChildren_Passes()
    {
        // Positive control — a legitimate ChipListNode passes the validator.
        // Confirms the invariant does not false-positive on the natural
        // filter-chip pattern (per-chip identity-carrying dismissAction with
        // unique names).
        var good = new ChipListNode(Children: new ViewNode[]
        {
            new ChipNode(
                Label: "one",
                DismissAction: new ActionDescriptor("remove-one")),
            new ChipNode(
                Label: "two",
                Action: new ActionDescriptor("toggle-two")),
            new ChipNode(
                Label: "three",
                DismissAction: new ActionDescriptor("remove-three"),
                Action: new ActionDescriptor("toggle-three")),
        });

        // Should not throw.
        ViewTreeValidation.ValidateActionNames(good);
    }
}
