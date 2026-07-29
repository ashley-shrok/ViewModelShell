// v8.0.0 (COMP-10) — DetailRowNode wire-shape parity.
//
// Proves the .NET DetailRowNode record + [JsonDerivedType] discriminator
// serialize BYTE-ALIGNED with the TS twin:
//   • Label is REQUIRED (non-nullable string primitive) — trained typography
//     (text-xs uppercase weight:500 muted) is BAKED in default.css
//     .vms-detail-row__label; the browser renderer emits a raw text node.
//     Round-trips through the wire unchanged.
//   • Value is REQUIRED (non-nullable ViewNode) — polymorphic emission
//     verified via nested "type":"…" discriminator on Value payload. TS
//     twin's `string | ViewNode` convenience wraps in TextNode{body} at
//     render time; .NET server wraps explicitly.
//   • Every optional (Tone, Icon) carries WhenWritingNull → ABSENT from JSON
//     when unset (AGENTS.md gotcha #8).
//   • Bare `new DetailRowNode("Label", new TextNode(…))` serializes without
//     any "null" fields — the class-2 findNulls defect parity cannot see.
//   • Tone reuses the shipped Tone enum — 4 kebab-case values round-trip.
//   • IconName override round-trips kebab-case correctly.
//
// Mirrors AlertNodeSerializationTests.cs / MessageNodeSerializationTests.cs
// — uses JsonSerializerOptions with camelCase only (no host
// DefaultIgnoreCondition), to prove the [JsonIgnore] attributes carry the
// contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class DetailRowNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void Type_SerializesAsDetailRow()
    {
        var node = new DetailRowNode(Label: "Status", Value: new TextNode("Open"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"detail-row\"", json);
    }

    // ─── Class-2 findNulls defect protection (gotcha #8) ────────────────────

    [Fact]
    public void BareNode_MinimalShape_LabelAndValueOnly()
    {
        // Bare node — Label + Value required; Tone + Icon must be ABSENT.
        // Proves the WhenWritingNull posture on every optional slot. Any
        // regression here is exactly the class-2 defect parity's normalize.ts
        // silently strips before diffing.
        var node = new DetailRowNode(Label: "Status", Value: new TextNode("Open"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"detail-row\"", json);
        Assert.Contains("\"label\":\"Status\"", json);
        Assert.Contains("\"value\":{", json);
        Assert.DoesNotContain("\"tone\"", json);
        Assert.DoesNotContain("\"icon\"", json);
        // Belt-and-braces: no `null` anywhere.
        Assert.DoesNotContain("null", json);
    }

    // ─── Label — required, round-trips as primitive string ──────────────────

    [Fact]
    public void Label_Required_RoundTripsAsString()
    {
        // Label is a PRIMITIVE (not ViewNode-typed) — trained typography lives
        // in CSS. Round-trip must preserve the exact string.
        var node = new DetailRowNode(Label: "PRIORITY", Value: new TextNode("high"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"label\":\"PRIORITY\"", json);
    }

    // ─── Value — REQUIRED, polymorphic emission ─────────────────────────────

    [Fact]
    public void Value_Required_SerializesPolymorphically()
    {
        // Value is typed ViewNode (not ViewNode?, not string) so
        // System.Text.Json emits the polymorphic "type" discriminator on the
        // nested payload. Proves the load-bearing "type-as-ViewNode-not-narrow"
        // rule on DetailRowNode.Value.
        var node = new DetailRowNode(Label: "Status", Value: new TextNode("Open"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"value\":{", json);
        Assert.Contains("\"type\":\"text\"", json);
        Assert.Contains("\"value\":\"Open\"", json);
    }

    [Fact]
    public void Value_CustomViewNode_KeepsCallerStyle()
    {
        // A custom TextNode with style:"muted" passes through as-is (no forced
        // string-lift on the wire — the client-side render's string→TextNode
        // body-lift is purely a browser.ts renderer convenience for TS
        // callers). The .NET side always constructs an explicit ViewNode.
        var node = new DetailRowNode(
            Label: "Status",
            Value: new TextNode("Custom", Style: TextStyle.Muted));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"style\":\"muted\"", json);
    }

    // ─── Tone — WhenWritingNull + KebabEnum × 4 tones ───────────────────────

    [Fact]
    public void Tone_OmittedIsAbsent()
    {
        var node = new DetailRowNode(Label: "Status", Value: new TextNode("Open"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"tone\"", json);
    }

    [Fact]
    public void Tone_Danger_SerializesAsKebab()
    {
        var node = new DetailRowNode(
            Label: "Status",
            Value: new TextNode("Deleted"),
            Tone: Tone.Danger);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"danger\"", json);
    }

    [Fact]
    public void Tone_Warning_SerializesAsKebab()
    {
        var node = new DetailRowNode(
            Label: "Status",
            Value: new TextNode("Pending"),
            Tone: Tone.Warning);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"warning\"", json);
    }

    [Fact]
    public void Tone_Success_SerializesAsKebab()
    {
        var node = new DetailRowNode(
            Label: "Balance",
            Value: new TextNode("Paid"),
            Tone: Tone.Success);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"success\"", json);
    }

    [Fact]
    public void Tone_Info_SerializesAsKebab()
    {
        var node = new DetailRowNode(
            Label: "Region",
            Value: new TextNode("EU-West"),
            Tone: Tone.Info);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"info\"", json);
    }

    // ─── Icon — WhenWritingNull + IconName kebab round-trip ─────────────────

    [Fact]
    public void Icon_OmittedIsAbsent()
    {
        var node = new DetailRowNode(Label: "Status", Value: new TextNode("Open"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"icon\"", json);
    }

    [Fact]
    public void Icon_Info_SerializesAsKebab()
    {
        var node = new DetailRowNode(
            Label: "Note",
            Value: new TextNode("Read the docs"),
            Icon: IconName.Info);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"info\"", json);
    }

    [Fact]
    public void Icon_AlertTriangle_SerializesAsKebabMultiWord()
    {
        // Multi-word IconName kebab round-trip on this node.
        var node = new DetailRowNode(
            Label: "Warning",
            Value: new TextNode("Disk low"),
            Icon: IconName.AlertTriangle);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"alert-triangle\"", json);
    }

    // ─── AllFieldsSet — every optional present + required round-trip ────────

    [Fact]
    public void AllFieldsSet_AllPresent()
    {
        var node = new DetailRowNode(
            Label: "Balance",
            Value: new TextNode("Overdue"),
            Tone: Tone.Danger,
            Icon: IconName.AlertTriangle);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"detail-row\"", json);
        Assert.Contains("\"label\":\"Balance\"", json);
        Assert.Contains("\"value\":{", json);
        Assert.Contains("\"tone\":\"danger\"", json);
        Assert.Contains("\"icon\":\"alert-triangle\"", json);
    }
}
