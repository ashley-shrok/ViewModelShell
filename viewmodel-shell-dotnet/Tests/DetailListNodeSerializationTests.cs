// v8.0.0 (COMP-10a) — DetailListNode wire-shape parity + tree-invariant.
//
// Proves the .NET DetailListNode record + [JsonDerivedType] discriminator
// serialize BYTE-ALIGNED with the TS twin:
//   • The bare `new DetailListNode(Children: [])` serializes as
//     `{"type":"detail-list","children":[]}` — required field present, every
//     optional ABSENT (AGENTS.md gotcha #8 class-2 findNulls defect).
//   • Children serialize polymorphically with `"type":"detail-row"` per entry
//     (proves the IReadOnlyList<ViewNode> posture keeps the discriminator).
//   • LabelWidth carries WhenWritingNull → absent when null; KebabEnum emits
//     "sm"/"md"/"lg" byte-identical to the TS closed union.
//   • Tree-invariant: passing a non-DetailRowNode into
//     ViewTreeValidation.ValidateActionNames throws InvalidOperationException
//     with the BYTE-IDENTICAL error message the TS twin throws:
//     `"DetailListNode.children must all be DetailRowNodes (found: <type>)"`.
//     This is the defense-in-depth guard for hostile deserialization paths.
//
// Mirrors MessageListNodeSerializationTests.cs — the direct byte-aligned
// template for a container composite with a tree invariant.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class DetailListNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void Type_SerializesAsDetailList()
    {
        var node = new DetailListNode(Children: Array.Empty<ViewNode>());
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"detail-list\"", json);
    }

    // ─── Class-2 findNulls defect protection ────────────────────────────────

    [Fact]
    public void Children_EmptyList_SerializesAsEmptyArray()
    {
        // Empty children array is a legal (if unusual) state — proves the
        // required Children field is always emitted and every optional
        // (LabelWidth) is ABSENT.
        var node = new DetailListNode(Children: Array.Empty<ViewNode>());
        var json = Serialize<ViewNode>(node);
        Assert.Equal("{\"type\":\"detail-list\",\"children\":[]}", json);
    }

    [Fact]
    public void Children_WithDetailRows_SerializesPolymorphically()
    {
        // Each DetailRowNode child JSON carries `"type":"detail-row"` — proves
        // the polymorphic discriminator lands through the
        // IReadOnlyList<ViewNode> serialization path (widened from the narrow
        // DetailRowNode-only type per the FormNode.Buttons banked posture).
        var node = new DetailListNode(Children: new ViewNode[]
        {
            new DetailRowNode(Label: "Status", Value: new TextNode("Open")),
            new DetailRowNode(Label: "Priority", Value: new TextNode("High")),
        });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"children\":[", json);
        // Two detail-row entries → two occurrences of the discriminator.
        var discCount = 0;
        var i = 0;
        while ((i = json.IndexOf("\"type\":\"detail-row\"", i, StringComparison.Ordinal)) >= 0)
        {
            discCount++;
            i += 1;
        }
        Assert.Equal(2, discCount);
        Assert.Contains("\"label\":\"Status\"", json);
        Assert.Contains("\"label\":\"Priority\"", json);
    }

    // ─── LabelWidth — WhenWritingNull + KebabEnum × 3 values ────────────────

    [Fact]
    public void LabelWidth_OmittedIsAbsent()
    {
        var node = new DetailListNode(Children: Array.Empty<ViewNode>());
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"labelWidth\"", json);
    }

    [Fact]
    public void LabelWidth_Sm_SerializesAsKebabSm()
    {
        var node = new DetailListNode(
            Children: Array.Empty<ViewNode>(),
            LabelWidth: DetailLabelWidth.Sm);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"labelWidth\":\"sm\"", json);
    }

    [Fact]
    public void LabelWidth_Md_SerializesAsKebabMd()
    {
        // md set explicitly produces "md" on the wire — byte-identical
        // rendered result to omitted (which produces no key at all), because
        // the container's default --vms-detail-label is 10rem = md.
        var node = new DetailListNode(
            Children: Array.Empty<ViewNode>(),
            LabelWidth: DetailLabelWidth.Md);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"labelWidth\":\"md\"", json);
    }

    [Fact]
    public void LabelWidth_Lg_SerializesAsKebabLg()
    {
        var node = new DetailListNode(
            Children: Array.Empty<ViewNode>(),
            LabelWidth: DetailLabelWidth.Lg);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"labelWidth\":\"lg\"", json);
    }

    // ─── Tree invariant — non-DetailRowNode child rejected with byte-identical error ─

    [Fact]
    public void TreeInvariant_DetailListWithNonDetailRowChild_ThrowsInvalidTree()
    {
        // DetailListNode.Children is typed IReadOnlyList<ViewNode> on the .NET
        // record (deliberately widened from DetailRowNode-only, for
        // polymorphic-discriminator preservation — see the record's XML doc).
        // The tree invariant is therefore enforced ENTIRELY at runtime by
        // ViewTreeValidation.Collect: any non-DetailRowNode child throws
        // InvalidOperationException with the BYTE-IDENTICAL error message the
        // TS twin throws at the same point in server.ts collectActions.
        //
        // This test is the direct .NET twin of the TS runtime probe in
        // test/detail-row.test.ts:
        //   validateActionNames({type:"detail-list", children:[{type:"text",…}]})
        // → both backends throw
        //   "DetailListNode.children must all be DetailRowNodes (found: text)".
        var badNode = new DetailListNode(Children: new ViewNode[]
        {
            new TextNode("not a detail-row"),
        });

        var ex = Assert.Throws<InvalidOperationException>(() =>
            ViewTreeValidation.ValidateActionNames(badNode));
        Assert.Equal(
            "DetailListNode.children must all be DetailRowNodes (found: text)",
            ex.Message);
    }

    [Fact]
    public void TreeInvariant_DetailListWithDetailRowChildren_Passes()
    {
        // Positive control — a legitimate DetailListNode passes the
        // validator. Confirms the invariant does not false-positive.
        var goodNode = new DetailListNode(Children: new ViewNode[]
        {
            new DetailRowNode(Label: "A", Value: new TextNode("1")),
            new DetailRowNode(Label: "B", Value: new TextNode("2"), Tone: Tone.Danger),
        });
        // Should NOT throw.
        ViewTreeValidation.ValidateActionNames(goodNode);
    }
}
