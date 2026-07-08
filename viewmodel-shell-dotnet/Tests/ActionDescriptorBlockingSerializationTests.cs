// ActionDescriptor.Blocking serialization parity (NBA-04).
//
// Verifies the WhenWritingNull omission: Blocking:false serializes
// "blocking":false, Blocking:true serializes "blocking":true, and the
// default Blocking (omitted/null) is ABSENT from the wire — matching the TS
// optional `ActionEvent.blocking?: boolean` being absent when unset. Uses
// JsonSerializerOptions with camelCase only (no host DefaultIgnoreCondition),
// matching FillSerializationTests, to prove the attribute carries the
// contract intrinsically rather than depending on host serializer config.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class ActionDescriptorBlockingSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // Wrap ActionDescriptor in a SectionNode (an existing ActionDescriptor-bearing
    // node) and serialize through the polymorphic ViewNode base, mirroring how
    // FillSerializationTests serializes through ViewNode rather than the bare record.

    [Fact]
    public void ActionDescriptor_Blocking_False_SerializesBlockingFalse()
    {
        var section = new SectionNode(
            "S",
            new ViewNode[] { new TextNode("x", null) },
            Action: new ActionDescriptor("x", Blocking: false));
        var json = Serialize<ViewNode>(section);
        Assert.Contains("\"blocking\":false", json);
    }

    [Fact]
    public void ActionDescriptor_Blocking_DefaultNull_IsAbsent()
    {
        var section = new SectionNode(
            "S",
            new ViewNode[] { new TextNode("x", null) },
            Action: new ActionDescriptor("x"));
        var json = Serialize<ViewNode>(section);
        Assert.DoesNotContain("\"blocking\"", json);
    }

    [Fact]
    public void ActionDescriptor_Blocking_ExplicitTrue_SerializesBlockingTrue()
    {
        var section = new SectionNode(
            "S",
            new ViewNode[] { new TextNode("x", null) },
            Action: new ActionDescriptor("x", Blocking: true));
        var json = Serialize<ViewNode>(section);
        Assert.Contains("\"blocking\":true", json);
    }
}
