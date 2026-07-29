// v8.0.0 (COMP-11) — TimelineEntryNode wire-shape parity.
//
// Proves the .NET TimelineEntryNode record + [JsonDerivedType] discriminator
// serialize BYTE-ALIGNED with the TS twin:
//   • Time is REQUIRED (non-nullable string primitive) — the browser renderer
//     wraps it in TextNode{style:"caption"} at render time (COMP-01 caption
//     tier). Round-trips through the wire unchanged.
//   • Description is REQUIRED (non-nullable ViewNode) — polymorphic emission
//     verified via nested "type":"…" discriminator on the Description
//     payload. TS twin's `string | ViewNode` convenience wraps in
//     TextNode{body} at render time; .NET server wraps explicitly.
//   • Every optional (Tone, Icon) carries WhenWritingNull → ABSENT from JSON
//     when unset (AGENTS.md gotcha #8).
//   • Bare `new TimelineEntryNode("Time", new TextNode(…))` serializes
//     without any "null" fields — the class-2 findNulls defect parity
//     cannot see.
//   • Tone reuses the shipped Tone enum — 4 kebab-case values round-trip.
//   • IconName round-trips kebab-case correctly.
//
// Mirrors DetailRowNodeSerializationTests.cs — the direct byte-aligned
// template for a Route-B leaf composite with a primitive + ViewNode-typed
// slot pair and optional Tone + Icon.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class TimelineEntryNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void Type_SerializesAsTimelineEntry()
    {
        var node = new TimelineEntryNode(
            Time: "2:47 PM",
            Description: new TextNode("Incident opened"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"timeline-entry\"", json);
    }

    // ─── Class-2 findNulls defect protection (gotcha #8) ────────────────────

    [Fact]
    public void BareNode_MinimalShape_TimeAndDescription()
    {
        // Bare node — Time + Description required; Tone + Icon must be
        // ABSENT. Proves the WhenWritingNull posture on every optional slot.
        // Any regression here is exactly the class-2 defect parity's
        // normalize.ts silently strips before diffing.
        var node = new TimelineEntryNode(
            Time: "2:47 PM",
            Description: new TextNode("Incident opened"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"timeline-entry\"", json);
        Assert.Contains("\"time\":\"2:47 PM\"", json);
        Assert.Contains("\"description\":{", json);
        Assert.DoesNotContain("\"tone\"", json);
        Assert.DoesNotContain("\"icon\"", json);
        // Belt-and-braces: no `null` anywhere.
        Assert.DoesNotContain("null", json);
    }

    // ─── Time — required, round-trips as primitive string ───────────────────

    [Fact]
    public void Time_Required_RoundTripsAsString()
    {
        // Time is a PRIMITIVE (not ViewNode-typed) — trained typography
        // (caption tier) lives at render time in the browser renderer.
        // Round-trip must preserve the exact string.
        var node = new TimelineEntryNode(
            Time: "Yesterday at 10:12 AM",
            Description: new TextNode("Deployment queued"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"time\":\"Yesterday at 10:12 AM\"", json);
    }

    // ─── Description — REQUIRED, polymorphic emission ───────────────────────

    [Fact]
    public void Description_Required_SerializesPolymorphically()
    {
        // Description is typed ViewNode (not ViewNode?, not string) so
        // System.Text.Json emits the polymorphic "type" discriminator on the
        // nested payload. Proves the load-bearing "type-as-ViewNode-not-narrow"
        // rule on TimelineEntryNode.Description.
        var node = new TimelineEntryNode(
            Time: "3:15 PM",
            Description: new TextNode("Rollback complete"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"description\":{", json);
        Assert.Contains("\"type\":\"text\"", json);
        Assert.Contains("\"value\":\"Rollback complete\"", json);
    }

    [Fact]
    public void Description_CustomViewNode_KeepsCallerStyle()
    {
        // A custom TextNode with style:"muted" passes through as-is (no forced
        // string-lift on the wire — the client-side render's string→TextNode
        // body-lift is purely a browser.ts renderer convenience for TS
        // callers). The .NET side always constructs an explicit ViewNode.
        var node = new TimelineEntryNode(
            Time: "12:00 PM",
            Description: new TextNode("Custom note", Style: TextStyle.Muted));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"style\":\"muted\"", json);
    }

    // ─── Tone — WhenWritingNull + KebabEnum × 4 tones ───────────────────────

    [Fact]
    public void Tone_OmittedIsAbsent()
    {
        var node = new TimelineEntryNode(
            Time: "9:00 AM",
            Description: new TextNode("Started"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"tone\"", json);
    }

    [Fact]
    public void Tone_Danger_SerializesAsKebab()
    {
        var node = new TimelineEntryNode(
            Time: "3:00 PM",
            Description: new TextNode("Incident escalated"),
            Tone: Tone.Danger);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"danger\"", json);
    }

    [Fact]
    public void Tone_Warning_SerializesAsKebab()
    {
        var node = new TimelineEntryNode(
            Time: "2:30 PM",
            Description: new TextNode("Latency elevated"),
            Tone: Tone.Warning);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"warning\"", json);
    }

    [Fact]
    public void Tone_Success_SerializesAsKebab()
    {
        var node = new TimelineEntryNode(
            Time: "4:00 PM",
            Description: new TextNode("Recovery complete"),
            Tone: Tone.Success);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"success\"", json);
    }

    [Fact]
    public void Tone_Info_SerializesAsKebab()
    {
        var node = new TimelineEntryNode(
            Time: "2:00 PM",
            Description: new TextNode("Metrics ingested"),
            Tone: Tone.Info);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"info\"", json);
    }

    // ─── Icon — WhenWritingNull + IconName kebab round-trip ─────────────────

    [Fact]
    public void Icon_OmittedIsAbsent()
    {
        var node = new TimelineEntryNode(
            Time: "9:00 AM",
            Description: new TextNode("Started"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"icon\"", json);
    }

    [Fact]
    public void Icon_CheckCircle_SerializesAsKebabMultiWord()
    {
        // Multi-word IconName kebab round-trip on this node.
        var node = new TimelineEntryNode(
            Time: "4:15 PM",
            Description: new TextNode("Complete"),
            Icon: IconName.CheckCircle);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"check-circle\"", json);
    }

    // ─── AllFieldsSet — every optional present + required round-trip ────────

    [Fact]
    public void AllFieldsSet_AllPresent()
    {
        var node = new TimelineEntryNode(
            Time: "3:00 PM",
            Description: new TextNode("Incident escalated"),
            Tone: Tone.Danger,
            Icon: IconName.AlertTriangle);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"timeline-entry\"", json);
        Assert.Contains("\"time\":\"3:00 PM\"", json);
        Assert.Contains("\"description\":{", json);
        Assert.Contains("\"tone\":\"danger\"", json);
        Assert.Contains("\"icon\":\"alert-triangle\"", json);
    }
}
