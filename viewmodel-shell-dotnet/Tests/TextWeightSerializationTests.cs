// v8.0.0 (COMP-02) — TextWeight enum + TextNode.Weight serialization parity
// with the TS twin.
//
// Proves the .NET closed-enum addition serializes byte-aligned with the
// TypeScript union `weight?: "regular" | "medium" | "bold"` at
// src/index.ts:1020 (Option A, orthogonal to Style and Tone):
//   • TextWeight is a closed .NET enum with three members Regular/Medium/Bold
//     (closed-union-must-be-enum discipline — banked from the 6.0.0 migration).
//   • KebabEnum<TextWeight> emits "regular"/"medium"/"bold" on the wire (all
//     single-word members — no per-member [EnumMember] attribute needed).
//   • TextNode with Weight: TextWeight.Medium serializes as "weight":"medium"
//     in the polymorphic-typed JSON stream.
//   • Weight = null (or Weight defaulted) produces JSON with NO "weight" key
//     at all — the class-2 defect parity's null-scrubbing normalize can't see.
//     Direct assertion of `Assert.DoesNotContain("\"weight\"", json)` guards
//     the WhenWritingNull posture per gotcha #8.
//   • Round-trip (write → parse) preserves the enum value.
//
// Mirrors TextCaptionSerializationTests / IconNodeSerializationTests — uses
// JsonSerializerOptions with camelCase only (no host DefaultIgnoreCondition),
// so the intrinsic [JsonIgnore] attributes carry the null-omission contract.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class TextWeightSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── The enum itself exists with exactly the three members ───────────

    [Fact]
    public void TextWeight_HasExactlyThreeMembers_Regular_Medium_Bold()
    {
        Assert.True(Enum.IsDefined(typeof(TextWeight), TextWeight.Regular));
        Assert.True(Enum.IsDefined(typeof(TextWeight), TextWeight.Medium));
        Assert.True(Enum.IsDefined(typeof(TextWeight), TextWeight.Bold));
        // Closed union — exactly three members, no more.
        Assert.Equal(3, Enum.GetValues<TextWeight>().Length);
    }

    // ─── Wire shape — each enum value emits its kebab-lowercase literal ──

    [Fact]
    public void TextNode_Weight_Regular_SerializesAsKebabCase()
    {
        var node = new TextNode("Row primary", Weight: TextWeight.Regular);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"text\"", json);
        Assert.Contains("\"value\":\"Row primary\"", json);
        Assert.Contains("\"weight\":\"regular\"", json);
    }

    [Fact]
    public void TextNode_Weight_Medium_SerializesAsKebabCase()
    {
        var node = new TextNode("Row primary", Weight: TextWeight.Medium);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"weight\":\"medium\"", json);
    }

    [Fact]
    public void TextNode_Weight_Bold_SerializesAsKebabCase()
    {
        var node = new TextNode("Row primary", Weight: TextWeight.Bold);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"weight\":\"bold\"", json);
    }

    // ─── WhenWritingNull posture (gotcha #8) — direct-asserted ───────────

    [Fact]
    public void TextNode_WeightAbsent_OmitsField()
    {
        // The whole point of the WhenWritingNull discipline: an unset Weight
        // MUST be ABSENT on the wire, NEVER "weight":null. This is the
        // class-2 defect the parity normalize scrubs away — direct assertion
        // is the only gate that catches it (per AGENTS.md gotcha #8).
        var node = new TextNode("Row primary");
        var json = Serialize<ViewNode>(node);
        // Neither the key nor a null-value form of the key must appear.
        Assert.DoesNotContain("\"weight\"", json);
        Assert.DoesNotContain("weight", json);
    }

    [Fact]
    public void TextNode_WeightSetToNull_OmitsField()
    {
        // Same posture, but written explicitly `Weight: null` at the call
        // site — the WhenWritingNull attribute must still drop it.
        var node = new TextNode("Row primary", Weight: null);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"weight\"", json);
    }

    // ─── Composability — weight axis is orthogonal to style + tone ───────

    [Fact]
    public void TextNode_Weight_ComposesWithStyleAndTone()
    {
        // The Option-A rationale: a body-styled, danger-toned TextNode can
        // ALSO be Weight:Medium — three orthogonal axes on the wire.
        var node = new TextNode(
            "Row primary",
            Style: TextStyle.Body,
            Tone: Tone.Danger,
            Weight: TextWeight.Medium);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"style\":\"body\"", json);
        Assert.Contains("\"tone\":\"danger\"", json);
        Assert.Contains("\"weight\":\"medium\"", json);
    }

    // ─── Round-trip — the KebabEnum converter reads kebab-lowercase back ──

    [Fact]
    public void TextWeight_KebabEnum_RoundTrips()
    {
        // Serialize each enum value, deserialize back, and verify the enum
        // member is preserved. Guards against a converter regression that
        // silently emits the right string but fails to parse it.
        foreach (var value in Enum.GetValues<TextWeight>())
        {
            var node = new TextNode("x", Weight: value);
            var json = Serialize<ViewNode>(node);
            var back = JsonSerializer.Deserialize<ViewNode>(json, _opts);
            var textBack = Assert.IsType<TextNode>(back);
            Assert.Equal(value, textBack.Weight);
        }
    }
}
