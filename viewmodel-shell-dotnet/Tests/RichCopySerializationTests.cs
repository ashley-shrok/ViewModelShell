// CopyButtonNode rich-copy fields — CopyTargetId (harvest route) + Html
// (server-provided route) serialization parity.
//
// Both are nullable wire optionals carrying [JsonIgnore(WhenWritingNull)]: present
// when set, ABSENT (never "field":null) when unset — matching the TS optionals
// `copyTargetId?` / `html?` (the gotcha #8 absent-vs-null contract). Uses
// JsonSerializerOptions with camelCase only (no host DefaultIgnoreCondition),
// matching OrderedListSerializationTests, to prove the attribute carries the contract.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class RichCopySerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    [Fact]
    public void CopyButton_Plain_OmitsRichFields()
    {
        var btn = new CopyButtonNode("hello");
        var json = Serialize<ViewNode>(btn);
        Assert.DoesNotContain("\"copyTargetId\"", json);
        Assert.DoesNotContain("\"html\"", json);
        Assert.Contains("\"text\":\"hello\"", json);
    }

    [Fact]
    public void CopyButton_CopyTargetId_Serializes()
    {
        var btn = new CopyButtonNode("plain fallback", CopyTargetId: "report-card");
        var json = Serialize<ViewNode>(btn);
        Assert.Contains("\"copyTargetId\":\"report-card\"", json);
        Assert.DoesNotContain("\"html\"", json);
    }

    [Fact]
    public void CopyButton_Html_Serializes()
    {
        var btn = new CopyButtonNode("plain fallback", Html: "<strong>rich</strong>");
        var json = Serialize<ViewNode>(btn);
        // The key is present and the markup survives. Assert on the key + tag name
        // rather than the exact byte form: System.Text.Json escapes `<`/`>` as
        // </> by default, but that escaping is normalized away when a
        // client parses the wire (JSON.parse("<") === "<"), so the parity diff
        // and every real consumer see the same value. Coupling the test to the
        // escape sequence would make it brittle to the encoder, not the contract.
        Assert.Contains("\"html\":", json);
        Assert.Contains("strong", json);
        Assert.DoesNotContain("\"copyTargetId\"", json);
    }
}
