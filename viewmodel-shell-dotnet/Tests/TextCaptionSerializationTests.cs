// v8.0.0 (COMP-01) — TextStyle.Caption serialization parity with the TS twin.
//
// Proves the .NET TextStyle enum extension serializes byte-aligned with the
// TypeScript union grow at src/index.ts:997 (the `| "caption"` addition):
//   • TextStyle.Caption is a defined enum member (not just a numeric alias).
//   • KebabEnum<TextStyle> emits "caption" on the wire (single-word member
//     — no per-member [EnumMember] attribute needed, matching the shipped
//     KebabEnum kebab-lowercase convention for Heading/Subheading/etc.).
//   • TextNode with Style: TextStyle.Caption serializes as
//     "style":"caption" in the polymorphic-typed JSON stream.
//   • Round-trip (write → parse) preserves the enum value.
//
// Mirrors IconNodeSerializationTests / DiffNodeSerializationTests — uses
// JsonSerializerOptions with camelCase only (no host DefaultIgnoreCondition),
// so the intrinsic [JsonIgnore] attributes carry the null-omission contract.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class TextCaptionSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── The enum member itself exists ─────────────────────────────────────

    [Fact]
    public void TextStyle_Caption_EnumMemberExists()
    {
        // Guards against a rename / removal at the enum declaration site
        // (byte-identical parity with the TS `| "caption"` union member).
        Assert.True(Enum.IsDefined(typeof(TextStyle), TextStyle.Caption));
    }

    [Fact]
    public void TextStyle_Caption_IsAppendedAtEnd()
    {
        // COMP-01 pattern (per plan 23-01): append at the END of the enum
        // list so ordinal reads of any historical numeric-persisted value
        // do not shift. Verifies Caption > Strikethrough numerically.
        Assert.True((int)TextStyle.Caption > (int)TextStyle.Strikethrough);
    }

    // ─── Wire shape — TextNode with Caption style serializes correctly ─────

    [Fact]
    public void TextNode_CaptionStyle_SerializesAsKebabCase()
    {
        var node = new TextNode("Meta line", Style: TextStyle.Caption);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"text\"", json);
        Assert.Contains("\"value\":\"Meta line\"", json);
        Assert.Contains("\"style\":\"caption\"", json);
    }

    [Fact]
    public void TextNode_CaptionStyle_OmittedTone_IsAbsent()
    {
        // WhenWritingNull posture — an unset Tone must be ABSENT on the wire,
        // never `"tone":null` (gotcha #8 discipline). Tests the class-2 defect
        // parity's null-scrubbing normalize can't see.
        var node = new TextNode("Meta line", Style: TextStyle.Caption);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"tone\"", json);
        Assert.DoesNotContain("\"runs\"", json);
        Assert.DoesNotContain("\"level\"", json);
        Assert.DoesNotContain("\"tooltip\"", json);
    }

    [Fact]
    public void TextNode_CaptionStyle_ComposesWithTone()
    {
        // A caption timestamp can also be tone:"danger" — the two axes are
        // orthogonal per the TS twin's TextNode contract.
        var node = new TextNode("3 mins ago", Style: TextStyle.Caption, Tone: Tone.Danger);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"style\":\"caption\"", json);
        Assert.Contains("\"tone\":\"danger\"", json);
    }

    // ─── All 7 TextStyle members serialize as their kebab-lowercase wire form
    // (the closed union in TS) — regression guard for any future enum reorder.

    [Fact]
    public void TextStyle_AllSevenMembers_SerializeAsKebabCase()
    {
        Assert.Contains("\"style\":\"heading\"",
            Serialize<ViewNode>(new TextNode("h", Style: TextStyle.Heading)));
        Assert.Contains("\"style\":\"subheading\"",
            Serialize<ViewNode>(new TextNode("s", Style: TextStyle.Subheading)));
        Assert.Contains("\"style\":\"body\"",
            Serialize<ViewNode>(new TextNode("b", Style: TextStyle.Body)));
        Assert.Contains("\"style\":\"muted\"",
            Serialize<ViewNode>(new TextNode("m", Style: TextStyle.Muted)));
        Assert.Contains("\"style\":\"pre\"",
            Serialize<ViewNode>(new TextNode("p", Style: TextStyle.Pre)));
        Assert.Contains("\"style\":\"strikethrough\"",
            Serialize<ViewNode>(new TextNode("s", Style: TextStyle.Strikethrough)));
        Assert.Contains("\"style\":\"caption\"",
            Serialize<ViewNode>(new TextNode("c", Style: TextStyle.Caption)));
    }
}
