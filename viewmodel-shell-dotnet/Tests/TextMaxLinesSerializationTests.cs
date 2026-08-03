// v9.2.0 (Phase 31 / MAXLINES-NET-TEST) — TextNode.MaxLines int? init-only-
// property serialization parity with the TS twin.
//
// Proves the .NET nullable-int axis addition serializes byte-aligned with
// the TypeScript union `maxLines?: 1 | 2 | 3` on src/index.ts's TextNode
// interface:
//   • MaxLines is int? (nullable primitive — NOT an enum) per the
//     'closed unions enforced on ONE side only' documented invariant
//     (AGENTS.md — audit 2026-07-16 confirmed 37/37 TS-closed unions
//     are open on the .NET side; zero exploited). Range {1, 2, 3} per
//     the TS-side closed union at src/index.ts; the .NET side does NOT
//     emit a validation enum for the range.
//   • MaxLines is placed as an INIT-ONLY PROPERTY OUTSIDE the primary
//     ctor (not appended as an 8th positional param) so the primary
//     ctor arity stays at 7 — Markdown 0.2.x's packed IL, which contains
//     `newobj TextNode(string, Level: int?)` opcodes bound to the 7-param
//     ctor, continues to resolve at JIT-time. This is why v9.2.0 remains
//     a truly additive MINOR bump; appending an 8th positional param
//     would fail parity/check-companion-binary-compat.sh at load-time.
//     Consumers construct via object-initializer: `new TextNode("Title")
//     { MaxLines = 1 }` or `existingNode with { MaxLines = 1 }` — NOT
//     positional `new TextNode(..., MaxLines: 1)` (it isn't a ctor param).
//   • TextNode with MaxLines set to N serializes as "maxLines":N in the
//     polymorphic-typed JSON stream for N∈{1,2,3}.
//   • MaxLines = null (or MaxLines defaulted) produces JSON with NO
//     "maxLines" key at all — the class-2 defect parity's null-scrubbing
//     normalize can't see. Direct assertion of
//     `Assert.DoesNotContain("\"maxLines\"", json)` guards the
//     WhenWritingNull posture per gotcha #8.
//   • Round-trip (write → parse) preserves the int? value.
//
// Mirrors TextWeightSerializationTests / TextCaptionSerializationTests /
// IconNodeSerializationTests — uses JsonSerializerOptions with camelCase
// only (no host DefaultIgnoreCondition), so the intrinsic [JsonIgnore]
// attribute on the MaxLines property carries the null-omission contract
// regardless of host options (gotcha #8).

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class TextMaxLinesSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Wire shape — each supported value emits its integer literal ──────

    [Fact]
    public void TextNode_MaxLines_1_SerializesAsInteger()
    {
        var node = new TextNode("Title") { MaxLines = 1 };
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"text\"", json);
        Assert.Contains("\"value\":\"Title\"", json);
        Assert.Contains("\"maxLines\":1", json);
    }

    [Fact]
    public void TextNode_MaxLines_2_SerializesAsInteger()
    {
        var node = new TextNode("Title") { MaxLines = 2 };
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"maxLines\":2", json);
    }

    [Fact]
    public void TextNode_MaxLines_3_SerializesAsInteger()
    {
        var node = new TextNode("Title") { MaxLines = 3 };
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"maxLines\":3", json);
    }

    // ─── WhenWritingNull posture (gotcha #8) — direct-asserted ────────────

    [Fact]
    public void TextNode_MaxLinesAbsent_OmitsField()
    {
        // The whole point of the WhenWritingNull discipline: an unset
        // MaxLines MUST be ABSENT on the wire, NEVER "maxLines":null.
        // This is the class-2 defect the parity normalize scrubs away —
        // direct assertion is the only gate that catches it (per
        // AGENTS.md gotcha #8 / gotcha #9 class-2 lesson).
        var node = new TextNode("Title");
        var json = Serialize<ViewNode>(node);
        // Neither the key nor a null-value form of the key must appear.
        Assert.DoesNotContain("\"maxLines\"", json);
        Assert.DoesNotContain("maxLines", json);
    }

    [Fact]
    public void TextNode_MaxLinesSetToNull_OmitsField()
    {
        // Same posture, but written explicitly `MaxLines = null` at the
        // call site — the WhenWritingNull attribute must still drop it.
        // Proves the attribute fires regardless of whether the null came
        // from the property default or an explicit write at the init site.
        var node = new TextNode("Title") { MaxLines = null };
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"maxLines\"", json);
    }

    // ─── Composability — MaxLines is orthogonal to Style / Tone / Weight ──

    [Fact]
    public void TextNode_MaxLines_ComposesWithStyleAndToneAndWeight()
    {
        // A body-styled, danger-toned, medium-weight TextNode can ALSO
        // carry MaxLines:2 — four orthogonal axes on the wire. Uses
        // named-arg positional syntax for the primary-ctor axes AND
        // object-initializer syntax for MaxLines (the init-only property
        // outside the primary ctor); both compose in a single expression.
        var node = new TextNode(
            "Row primary",
            Style: TextStyle.Body,
            Tone: Tone.Danger,
            Weight: TextWeight.Medium) { MaxLines = 2 };
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"style\":\"body\"", json);
        Assert.Contains("\"tone\":\"danger\"", json);
        Assert.Contains("\"weight\":\"medium\"", json);
        Assert.Contains("\"maxLines\":2", json);
    }

    // ─── Round-trip — the built-in int? converter reads the value back ────

    [Fact]
    public void TextNode_MaxLines_RoundTrips()
    {
        // Serialize each in-range value, deserialize back, and verify the
        // int? value is preserved. Guards against a converter regression
        // that silently emits the right integer but fails to parse it.
        foreach (var value in new[] { 1, 2, 3 })
        {
            var node = new TextNode("x") { MaxLines = value };
            var json = Serialize<ViewNode>(node);
            var back = JsonSerializer.Deserialize<ViewNode>(json, _opts);
            var textBack = Assert.IsType<TextNode>(back);
            Assert.Equal(value, textBack.MaxLines);
        }
    }
}
