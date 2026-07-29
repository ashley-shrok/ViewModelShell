// v8.0.0 (COMP-11a) — TimelineNode wire-shape parity + tree-invariant.
//
// Proves the .NET TimelineNode record + [JsonDerivedType] discriminator
// serialize BYTE-ALIGNED with the TS twin:
//   • The bare `new TimelineNode(Children: [])` serializes as
//     `{"type":"timeline","children":[]}` — required field present, no
//     optional bloat (AGENTS.md gotcha #8 class-2 findNulls defect).
//   • Children serialize polymorphically with `"type":"timeline-entry"` per
//     entry (proves the IReadOnlyList<ViewNode> posture keeps the
//     discriminator).
//   • Tree-invariant: passing a non-TimelineEntryNode into
//     ViewTreeValidation.ValidateActionNames throws InvalidOperationException
//     with the BYTE-IDENTICAL error message the TS twin throws:
//     `"TimelineNode.children must all be TimelineEntryNodes (found: <type>)"`.
//     This is the defense-in-depth guard for hostile deserialization paths.
//
// Mirrors DetailListNodeSerializationTests.cs — the direct byte-aligned
// template for a container composite with a tree invariant + widened
// IReadOnlyList<ViewNode> for polymorphic-discriminator preservation.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class TimelineNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void Type_SerializesAsTimeline()
    {
        var node = new TimelineNode(Children: Array.Empty<ViewNode>());
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"timeline\"", json);
    }

    // ─── Class-2 findNulls defect protection ────────────────────────────────

    [Fact]
    public void Children_EmptyList_SerializesAsEmptyArray()
    {
        // Empty children array is a legal (if unusual) state — proves the
        // required Children field is always emitted and nothing else bloats
        // the wire.
        var node = new TimelineNode(Children: Array.Empty<ViewNode>());
        var json = Serialize<ViewNode>(node);
        Assert.Equal("{\"type\":\"timeline\",\"children\":[]}", json);
    }

    [Fact]
    public void Children_WithTimelineEntries_SerializesPolymorphically()
    {
        // Each TimelineEntryNode child JSON carries `"type":"timeline-entry"`
        // — proves the polymorphic discriminator lands through the
        // IReadOnlyList<ViewNode> serialization path (widened from the
        // narrow TimelineEntryNode-only type per the FormNode.Buttons banked
        // posture).
        var node = new TimelineNode(Children: new ViewNode[]
        {
            new TimelineEntryNode(
                Time: "9:00 AM",
                Description: new TextNode("Started")),
            new TimelineEntryNode(
                Time: "9:15 AM",
                Description: new TextNode("Completed"),
                Tone: Tone.Success),
        });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"children\":[", json);
        // Two timeline-entry entries → two occurrences of the discriminator.
        var discCount = 0;
        var i = 0;
        while ((i = json.IndexOf("\"type\":\"timeline-entry\"", i, StringComparison.Ordinal)) >= 0)
        {
            discCount++;
            i += 1;
        }
        Assert.Equal(2, discCount);
        Assert.Contains("\"time\":\"9:00 AM\"", json);
        Assert.Contains("\"time\":\"9:15 AM\"", json);
        Assert.Contains("\"tone\":\"success\"", json);
    }

    // ─── Tree invariant — non-TimelineEntryNode child rejected with byte-identical error ─

    [Fact]
    public void TreeInvariant_TimelineWithNonTimelineEntryChild_ThrowsInvalidTree()
    {
        // TimelineNode.Children is typed IReadOnlyList<ViewNode> on the .NET
        // record (deliberately widened from TimelineEntryNode-only, for
        // polymorphic-discriminator preservation — see the record's XML doc).
        // The tree invariant is therefore enforced ENTIRELY at runtime by
        // ViewTreeValidation.Collect: any non-TimelineEntryNode child throws
        // InvalidOperationException with the BYTE-IDENTICAL error message the
        // TS twin throws at the same point in server.ts collectActions.
        //
        // This test is the direct .NET twin of the TS runtime probe in
        // test/timeline.test.ts:
        //   validateActionNames({type:"timeline", children:[{type:"text",…}]})
        // → both backends throw
        //   "TimelineNode.children must all be TimelineEntryNodes (found: text)".
        var badNode = new TimelineNode(Children: new ViewNode[]
        {
            new TextNode("not a timeline-entry"),
        });

        var ex = Assert.Throws<InvalidOperationException>(() =>
            ViewTreeValidation.ValidateActionNames(badNode));
        Assert.Equal(
            "TimelineNode.children must all be TimelineEntryNodes (found: text)",
            ex.Message);
    }

    [Fact]
    public void TreeInvariant_TimelineWithTimelineEntryChildren_Passes()
    {
        // Positive control — a legitimate TimelineNode passes the validator.
        // Confirms the invariant does not false-positive.
        var goodNode = new TimelineNode(Children: new ViewNode[]
        {
            new TimelineEntryNode(Time: "A", Description: new TextNode("1")),
            new TimelineEntryNode(
                Time: "B",
                Description: new TextNode("2"),
                Tone: Tone.Danger),
        });
        // Should NOT throw.
        ViewTreeValidation.ValidateActionNames(goodNode);
    }
}
