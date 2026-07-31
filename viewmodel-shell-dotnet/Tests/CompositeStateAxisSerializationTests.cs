// v8.1.0 (Phase 27) — Composite State-axis serialization uniformity.
//
// Proves the 6 new `State` params added by Plan 27-02 (MessageNode,
// UserRowNode, DetailRowNode, TimelineEntryNode, SettingRowNode, ChipNode)
// serialize BYTE-ALIGNED with the TS twin's `state?: string` posture:
//
//   • When State is null (default), the field is ABSENT from the wire — not
//     `"state": null`. This is the AGENTS.md gotcha #8 discipline: the
//     WhenWritingNull attribute must carry the contract even though the
//     shipped JsonSerializerOptions here uses ONLY camelCase (no host-side
//     DefaultIgnoreCondition), which proves the [JsonIgnore] attribute IS
//     load-bearing rather than defense-in-depth-only.
//   • When State is "active" (or any freeform string), the field emits
//     verbatim: `"state":"active"`. Freeform round-trips (Q1=B locked
//     decision: `state?: string`, not a closed enum).
//   • The class-2 findNulls cross-composite defense: constructing ALL 6
//     minimal composites at once and asserting NONE emits `"state":` proves
//     the whole batch is aligned. A future refactor that silently strips the
//     attribute from ONE composite fails this Fact with a message naming the
//     offending composite (see AllSixCompositesOmitStateWhenNull below).
//   • The ChipNode round-trip (Fact 14) proves the wire preserves freeform
//     values that the framework itself does NOT recognize — Chip is the
//     right vehicle because it ships NO --active CSS rule per the phase's
//     "field exists for wire uniformity" deferral, so the JSON round-trip
//     is the only correctness path.
//
// Mirrors ListRowNodeSerializationTests.cs — uses JsonSerializerOptions with
// camelCase only (no host DefaultIgnoreCondition), to prove the [JsonIgnore]
// attributes carry the contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class CompositeStateAxisSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // Minimum-shape factories — construct each composite with ONLY required
    // params so State defaults to null. Each is used by both the
    // `State_OmittedIsAbsent_*` Facts and the cross-composite Fact below.
    // Constructor shapes verified against ViewModels.cs post-Plan 27-02.

    private static MessageNode MinimalMessage() =>
        new(Author: "Alice", Content: new TextNode("Hi"));

    private static UserRowNode MinimalUserRow() =>
        new(Name: new TextNode("Alice"));

    private static DetailRowNode MinimalDetailRow() =>
        new(Label: "Status", Value: new TextNode("Open"));

    private static TimelineEntryNode MinimalTimelineEntry() =>
        new(Time: "10:00", Description: new TextNode("Deployed"));

    private static SettingRowNode MinimalSettingRow() =>
        new(Label: new TextNode("Notifications"));

    private static ChipNode MinimalChip() =>
        new(Label: "filter-1");

    // ─── State omitted → ABSENT from wire (gotcha #8 per-composite) ─────────
    //
    // Every one of the 6 Facts below constructs the minimal-shape composite
    // (State defaulted to null) and asserts:
    //   1. "state" substring is completely absent from the JSON body (per
    //      WhenWritingNull attribute — proves the field is dropped, not
    //      emitted-as-null).
    //   2. "state":null is separately asserted absent (belt-and-suspenders:
    //      if the attribute were silently stripped, STJ would emit the null
    //      literal and assertion #1 would already catch it — but this second
    //      check makes the failure message unambiguous).
    //   3. The discriminator "type" IS present — proves polymorphism intact
    //      (a broken narrow-typing on the enclosing slot could drop it).

    [Fact]
    public void State_OmittedIsAbsent_Message()
    {
        var json = Serialize<ViewNode>(MinimalMessage());
        Assert.Contains("\"type\":\"message\"", json);
        Assert.DoesNotContain("\"state\":", json);
        Assert.DoesNotContain("\"state\":null", json);
    }

    [Fact]
    public void State_OmittedIsAbsent_UserRow()
    {
        var json = Serialize<ViewNode>(MinimalUserRow());
        Assert.Contains("\"type\":\"user-row\"", json);
        Assert.DoesNotContain("\"state\":", json);
        Assert.DoesNotContain("\"state\":null", json);
    }

    [Fact]
    public void State_OmittedIsAbsent_DetailRow()
    {
        var json = Serialize<ViewNode>(MinimalDetailRow());
        Assert.Contains("\"type\":\"detail-row\"", json);
        Assert.DoesNotContain("\"state\":", json);
        Assert.DoesNotContain("\"state\":null", json);
    }

    [Fact]
    public void State_OmittedIsAbsent_TimelineEntry()
    {
        var json = Serialize<ViewNode>(MinimalTimelineEntry());
        Assert.Contains("\"type\":\"timeline-entry\"", json);
        Assert.DoesNotContain("\"state\":", json);
        Assert.DoesNotContain("\"state\":null", json);
    }

    [Fact]
    public void State_OmittedIsAbsent_SettingRow()
    {
        var json = Serialize<ViewNode>(MinimalSettingRow());
        Assert.Contains("\"type\":\"setting-row\"", json);
        Assert.DoesNotContain("\"state\":", json);
        Assert.DoesNotContain("\"state\":null", json);
    }

    [Fact]
    public void State_OmittedIsAbsent_Chip()
    {
        var json = Serialize<ViewNode>(MinimalChip());
        Assert.Contains("\"type\":\"chip\"", json);
        Assert.DoesNotContain("\"state\":", json);
        Assert.DoesNotContain("\"state\":null", json);
    }

    // ─── State:"active" → verbatim on wire (per-composite) ──────────────────
    //
    // Each Fact constructs the minimum-shape composite with State:"active"
    // and asserts the wire contains `"state":"active"` verbatim. This proves
    // the trailing-append param is wired into the emit path and camelCase
    // property naming policy renders `State` → `state` correctly.

    [Fact]
    public void State_SetSerializes_Message()
    {
        var node = new MessageNode(
            Author: "Alice",
            Content: new TextNode("Hi"),
            State: "active");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"state\":\"active\"", json);
    }

    [Fact]
    public void State_SetSerializes_UserRow()
    {
        var node = new UserRowNode(
            Name: new TextNode("Alice"),
            State: "active");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"state\":\"active\"", json);
    }

    [Fact]
    public void State_SetSerializes_DetailRow()
    {
        var node = new DetailRowNode(
            Label: "Status",
            Value: new TextNode("Open"),
            State: "active");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"state\":\"active\"", json);
    }

    [Fact]
    public void State_SetSerializes_TimelineEntry()
    {
        var node = new TimelineEntryNode(
            Time: "10:00",
            Description: new TextNode("Deployed"),
            State: "active");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"state\":\"active\"", json);
    }

    [Fact]
    public void State_SetSerializes_SettingRow()
    {
        var node = new SettingRowNode(
            Label: new TextNode("Notifications"),
            State: "active");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"state\":\"active\"", json);
    }

    [Fact]
    public void State_SetSerializes_Chip()
    {
        var node = new ChipNode(
            Label: "filter-1",
            State: "active");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"state\":\"active\"", json);
    }

    // ─── Cross-composite findNulls defense (class-2 per AGENTS.md #8) ───────
    //
    // Constructs ALL 6 minimal composites at once, serializes each, asserts
    // NONE emits `"state":` in its body. This is the class-2 findNulls
    // defense: if a future refactor silently strips the WhenWritingNull
    // attribute from ONE composite (a plausible drift path per AGENTS.md's
    // "know what a diff can and cannot prove" — a solo-composite regression
    // is invisible to cross-backend parity because BOTH twins would agree if
    // the attribute stripped on the .NET side matched a TS-side regression),
    // this Fact fails with a message naming the offending composite.

    [Fact]
    public void AllSixCompositesOmitStateWhenNull()
    {
        var composites = new (string Name, ViewNode Node)[]
        {
            ("MessageNode",       MinimalMessage()),
            ("UserRowNode",       MinimalUserRow()),
            ("DetailRowNode",     MinimalDetailRow()),
            ("TimelineEntryNode", MinimalTimelineEntry()),
            ("SettingRowNode",    MinimalSettingRow()),
            ("ChipNode",          MinimalChip()),
        };

        foreach (var (name, node) in composites)
        {
            var json = Serialize<ViewNode>(node);
            Assert.False(
                json.Contains("\"state\":"),
                $"{name} emitted \"state\":... on the wire when State was null " +
                $"(WhenWritingNull attribute silently stripped?). JSON: {json}");
            Assert.False(
                json.Contains("\"state\":null"),
                $"{name} emitted \"state\":null on the wire when State was null " +
                $"(WhenWritingNull attribute silently stripped?). JSON: {json}");
        }
    }

    // ─── Freeform round-trip (Chip picked deliberately) ─────────────────────
    //
    // Chip is the right vehicle because it ships NO --active CSS rule per
    // the phase's "field exists for wire uniformity" deferral (see the
    // ChipNode.State inline comment at ViewModels.cs:2754-2757). So the
    // JSON round-trip is the ONLY correctness path for Chip's State field
    // — no browser render smoke-tests it end-to-end.
    //
    // Serialize a ChipNode with an UNRECOGNIZED state value ("foobar") that
    // is NOT in the framework-shipped vocabulary (active/done/disabled),
    // deserialize it back through the polymorphic ViewNode discriminator,
    // cast to ChipNode, and assert the freeform value survived the trip.

    [Fact]
    public void RoundTripPreservesArbitraryStateValue_ChipNode()
    {
        var original = new ChipNode(Label: "filter-1", State: "foobar");
        var json = Serialize<ViewNode>(original);
        Assert.Contains("\"state\":\"foobar\"", json);

        var deserialized = JsonSerializer.Deserialize<ViewNode>(json, _opts);
        var chip = Assert.IsType<ChipNode>(deserialized);
        Assert.Equal("foobar", chip.State);
        Assert.Equal("filter-1", chip.Label);
    }
}
