// v8.0.0 (COMP-06a) — MessageListNode wire-shape parity + tree-invariant.
//
// Proves the .NET MessageListNode record + [JsonDerivedType] discriminator
// serialize BYTE-ALIGNED with the TS twin:
//   • The bare `new MessageListNode(Children: [])` serializes as
//     `{"type":"message-list","children":[]}` — required field present, every
//     optional ABSENT (AGENTS.md gotcha #8 class-2 findNulls defect).
//   • Children serialize polymorphically with `"type":"message"` per entry.
//   • FollowTail uses WhenWritingDefault posture (matches SectionNode.
//     FollowTail at :999): `false` is ABSENT on the wire; `true` is present.
//     This is the critical "optional non-nullable bool" contract that Section.
//     FollowTail established and MessageListNode carries forward.
//   • Tree-invariant: passing a non-MessageNode into the .NET twin's
//     ViewTreeValidation.Collect (via ShellResponse.Validate) throws
//     InvalidOperationException with the BYTE-IDENTICAL error message the TS
//     twin throws. This is the defense-in-depth guard for hostile
//     deserialization paths — the compile-time IReadOnlyList<MessageNode>
//     already covers the honest-caller path.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class MessageListNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void MessageListNode_SerializesTypeAsMessageList()
    {
        var node = new MessageListNode(Children: Array.Empty<MessageNode>());
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"message-list\"", json);
    }

    // ─── Class-2 findNulls defect protection ─────────────────────────────────

    [Fact]
    public void Children_EmptyList_SerializesAsEmptyArray()
    {
        // Empty children array is a legal (if unusual) state — proves the
        // required Children field is always emitted and every optional
        // (FollowTail, by default false) is ABSENT.
        var node = new MessageListNode(Children: Array.Empty<MessageNode>());
        var json = Serialize<ViewNode>(node);
        Assert.Equal("{\"type\":\"message-list\",\"children\":[]}", json);
    }

    [Fact]
    public void Children_WithMessages_SerializesPolymorphically()
    {
        // Each MessageNode child JSON carries `"type":"message"` — proves the
        // polymorphic discriminator lands through the IReadOnlyList<MessageNode>
        // serialization path.
        var node = new MessageListNode(Children: new[]
        {
            new MessageNode(Author: "Ada", Content: new TextNode("Hi")),
            new MessageNode(Author: "VMS", Content: new TextNode("Ack")),
        });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"children\":[", json);
        // Two message entries → two occurrences of the discriminator.
        var discCount = 0;
        var i = 0;
        while ((i = json.IndexOf("\"type\":\"message\"", i, StringComparison.Ordinal)) >= 0)
        {
            discCount++;
            i += 1;
        }
        Assert.Equal(2, discCount);
        Assert.Contains("\"author\":\"Ada\"", json);
        Assert.Contains("\"author\":\"VMS\"", json);
    }

    // ─── FollowTail: WhenWritingDefault posture (banked from Section.FollowTail) ──

    [Fact]
    public void FollowTail_False_SerializedAsAbsent()
    {
        // The critical WhenWritingDefault verification. `false` is the CLR
        // default for the non-nullable bool, so it MUST NOT appear on the
        // wire — byte-identical to the TS optional `followTail?: boolean`
        // which is `undefined` (absent) when unset. Same posture as
        // SectionNode.FollowTail at ViewModels.cs:999-1012.
        var node = new MessageListNode(Children: Array.Empty<MessageNode>(), FollowTail: false);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"followTail\"", json);
    }

    [Fact]
    public void FollowTail_True_SerializedAsTrue()
    {
        var node = new MessageListNode(Children: Array.Empty<MessageNode>(), FollowTail: true);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"followTail\":true", json);
    }

    [Fact]
    public void FollowTail_Omitted_SameAsFalse()
    {
        // The two-argument constructor uses the record's default `FollowTail =
        // false`, which under WhenWritingDefault is absent — proves omitting
        // the parameter behaves the same as passing `false`.
        var node = new MessageListNode(Children: Array.Empty<MessageNode>());
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"followTail\"", json);
    }

    // ─── Tree invariant — non-MessageNode child rejected with byte-identical error ─

    [Fact]
    public void TreeInvariant_MessageListWithNonMessageChild_ThrowsInvalidTree()
    {
        // MessageListNode.Children is typed IReadOnlyList<ViewNode> on the .NET
        // record (deliberately widened from MessageNode-only, for polymorphic-
        // discriminator preservation — see the record's XML doc). The tree
        // invariant is therefore enforced ENTIRELY at runtime by
        // ViewTreeValidation.Collect: any non-MessageNode child throws
        // InvalidOperationException with the BYTE-IDENTICAL error message the
        // TS twin throws at the same point in server.ts collectActions.
        //
        // This test is the direct .NET twin of the TS runtime probe:
        //   validateActionNames({ type:"message-list", children:[{type:"text",...}] })
        // → both backends throw
        //   "MessageListNode.children must all be MessageNodes (found: text)".
        var badNode = new MessageListNode(Children: new ViewNode[]
        {
            new TextNode("not a message"),
        });

        var ex = Assert.Throws<InvalidOperationException>(() =>
            ViewTreeValidation.ValidateActionNames(badNode));
        Assert.Equal(
            "MessageListNode.children must all be MessageNodes (found: text)",
            ex.Message);
    }

    [Fact]
    public void TreeInvariant_MessageListWithMessageChildren_Passes()
    {
        // Positive control — a legitimate MessageListNode passes the validator.
        var goodNode = new MessageListNode(Children: new ViewNode[]
        {
            new MessageNode(Author: "Ada", Content: new TextNode("Hi")),
            new MessageNode(Author: "VMS", Content: new TextNode("Ack")),
        });
        // Should NOT throw.
        ViewTreeValidation.ValidateActionNames(goodNode);
    }
}
