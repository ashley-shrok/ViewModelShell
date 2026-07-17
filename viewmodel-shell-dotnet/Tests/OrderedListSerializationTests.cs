// ListNode.Ordered axis — <ol> vs <ul> serialization parity.
//
// Verifies the WhenWritingDefault drop: Ordered=true serializes "ordered":true,
// and the default Ordered=false is ABSENT from the wire (matching the TS optional
// `ordered?` being absent when unset — the F2 false-vs-absent rule). Uses
// JsonSerializerOptions with camelCase only (no host DefaultIgnoreCondition),
// matching FillSerializationTests, to prove the attribute carries the contract.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class OrderedListSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    [Fact]
    public void ListNode_Ordered_True_SerializesOrderedTrue()
    {
        var list = new ListNode(
            new ViewNode[] { new ListItemNode(null, null, new ViewNode[] { new TextNode("x", null) }) },
            Ordered: true);
        var json = Serialize<ViewNode>(list);
        Assert.Contains("\"ordered\":true", json);
    }

    [Fact]
    public void ListNode_Ordered_DefaultFalse_IsAbsent()
    {
        var list = new ListNode(
            new ViewNode[] { new ListItemNode(null, null, new ViewNode[] { new TextNode("x", null) }) });
        var json = Serialize<ViewNode>(list);
        Assert.DoesNotContain("\"ordered\"", json);
    }
}
