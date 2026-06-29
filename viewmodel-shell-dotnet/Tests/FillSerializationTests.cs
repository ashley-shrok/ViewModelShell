// Fill layout axis — PageNode.Fill + SectionNode.Fill serialization parity.
//
// Verifies the WhenWritingDefault drop: Fill=true serializes "fill":true, and
// the default Fill=false is ABSENT from the wire (matching the TS optional
// `fill?` being absent when unset — the F2 false-vs-absent rule). Uses
// JsonSerializerOptions with camelCase only (no host DefaultIgnoreCondition),
// matching EnvelopeTests, to prove the attribute carries the contract.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class FillSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── PageNode.Fill ────────────────────────────────────────────────────────

    [Fact]
    public void PageNode_Fill_True_SerializesFillTrue()
    {
        var page = new PageNode("P", new ViewNode[] { new TextNode("x", null) }, Fill: true);
        var json = Serialize<ViewNode>(page);
        Assert.Contains("\"fill\":true", json);
    }

    [Fact]
    public void PageNode_Fill_DefaultFalse_IsAbsent()
    {
        var page = new PageNode("P", new ViewNode[] { new TextNode("x", null) });
        var json = Serialize<ViewNode>(page);
        Assert.DoesNotContain("\"fill\"", json);
    }

    // ─── SectionNode.Fill ─────────────────────────────────────────────────────

    [Fact]
    public void SectionNode_Fill_True_SerializesFillTrue()
    {
        var section = new SectionNode("S", new ViewNode[] { new TextNode("x", null) }, Fill: true);
        var json = Serialize<ViewNode>(section);
        Assert.Contains("\"fill\":true", json);
    }

    [Fact]
    public void SectionNode_Fill_DefaultFalse_IsAbsent()
    {
        var section = new SectionNode("S", new ViewNode[] { new TextNode("x", null) });
        var json = Serialize<ViewNode>(section);
        Assert.DoesNotContain("\"fill\"", json);
    }
}
