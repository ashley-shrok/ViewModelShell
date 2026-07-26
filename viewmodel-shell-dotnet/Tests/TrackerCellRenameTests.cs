// v7.0.0 (ICON-06) — TrackerCell.Label → TrackerCell.Tooltip wire-shape parity.
//
// Proves the ONE breaking wire change for v7.0.0 landed:
//   • new TrackerCell(Tooltip: "x") serializes to "tooltip":"x", NOT "label":"x"
//     (proves the field name changed on the wire, not just in code).
//   • new TrackerCell() serializes to {} (WhenWritingNull posture preserved —
//     the class-2 defect gotcha #8 guards against).
//   • The old positional parameter name Label is compile-time GONE. This test
//     file's commented-out sentinel line names the removal explicitly so a
//     future reviewer can see the intent at a glance.
//
// Mirrors DiffNodeSerializationTests / IconNodeSerializationTests style — uses
// JsonSerializerOptions with camelCase only (no host DefaultIgnoreCondition),
// to prove the [JsonIgnore] attributes carry the contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class TrackerCellRenameTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // NOTE: the old parameter name `Label:` was renamed to `Tooltip:` in
    // v7.0.0 (ICON-06). The line below MUST NOT be uncommented; it exists as
    // a discoverability signal so any future reviewer sees the intent. If C#
    // were to somehow accept it, this test file would fail to compile — the
    // best kind of "test".
    // var illegal = new TrackerCell(Label: "will not compile");

    // ─── The rename: field on the wire is `tooltip`, not `label` ──────────────

    [Fact]
    public void TrackerCell_TooltipPresent_SerializesAsTooltipField()
    {
        // Plain ASCII string keeps the assertion resistant to System.Text.Json's
        // non-ASCII escape policy (it emits · for the middle-dot by
        // default, which is fine on the wire — parity's diff sees the same
        // escaped bytes on both backends — but would make a naive
        // Contains() flaky).
        var cell = new TrackerCell(Tooltip: "run 4021 Success");
        var json = Serialize(cell);
        // The new field name crosses.
        Assert.Contains("\"tooltip\":\"run 4021 Success\"", json);
        // The OLD field name MUST NOT appear anywhere in the JSON (proves the
        // rename actually landed on the wire, not just in the type source).
        Assert.DoesNotContain("\"label\"", json);
    }

    [Fact]
    public void TrackerCell_TooltipAndStateAndAction_AllPresent()
    {
        var cell = new TrackerCell(
            State: TrackerState.Success,
            Tooltip: "x",
            Action: new ActionDescriptor("y"));
        var json = Serialize(cell);
        Assert.Contains("\"state\":\"success\"", json);
        Assert.Contains("\"tooltip\":\"x\"", json);
        Assert.Contains("\"name\":\"y\"", json);
        Assert.DoesNotContain("\"label\"", json);
    }

    // ─── WhenWritingNull posture preserved (gotcha #8) ───────────────────────

    [Fact]
    public void TrackerCell_AllDefault_SerializesToEmptyObject()
    {
        // Every parameter is optional-with-default + [JsonIgnore(WhenWritingNull)];
        // a bare `new TrackerCell()` MUST emit `{}` with no null fields.
        var cell = new TrackerCell();
        var json = Serialize(cell);
        Assert.Equal("{}", json);
    }

    [Fact]
    public void TrackerCell_TooltipAbsent_OmittedFromWire()
    {
        // Tooltip explicitly absent (null); state present. The `"tooltip"`
        // field MUST NOT appear anywhere in the emitted JSON — verifies the
        // WhenWritingNull attribute on the renamed slot still holds.
        var cell = new TrackerCell(State: TrackerState.Danger);
        var json = Serialize(cell);
        Assert.Contains("\"state\":\"danger\"", json);
        Assert.DoesNotContain("\"tooltip\"", json);
        // And the old name — belt and suspenders.
        Assert.DoesNotContain("\"label\"", json);
    }

    // ─── Nested in a TrackerNode (the shape as it appears on the wire) ───────

    [Fact]
    public void TrackerNode_WithTooltipBearingCell_SerializesCorrectly()
    {
        var node = new TrackerNode(
            Cells: new[]
            {
                new TrackerCell(),
                new TrackerCell(TrackerState.Success, Tooltip: "OK at 14:22"),
                new TrackerCell(
                    TrackerState.Danger,
                    Tooltip: "Failed",
                    Action: new ActionDescriptor("open-run-4021")),
            });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"tracker\"", json);
        Assert.Contains("\"tooltip\":\"OK at 14:22\"", json);
        Assert.Contains("\"tooltip\":\"Failed\"", json);
        Assert.Contains("\"name\":\"open-run-4021\"", json);
        // The old field name MUST NOT appear anywhere in the entire nested
        // structure — proves the rename is real, not a code alias.
        Assert.DoesNotContain("\"label\"", json);
    }
}
