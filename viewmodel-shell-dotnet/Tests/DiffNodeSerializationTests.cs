// DiffNode (DIFF-01) — wire-shape serialization parity.
//
// Proves the .NET DiffNode / DiffRow / DiffCell / DiffHeader records serialize
// BYTE-ALIGNED with the TS optional posture (gotcha #8):
//   • DiffNode.Mode / Header / Id — nullable + WhenWritingNull → absent when
//     unset, present when set.
//   • DiffRow.Old / New — nullable + WhenWritingNull → the SHAPE-carries-meaning
//     contract (missing side = pure add/remove) round-trips correctly.
//   • DiffCell.LineNumber — nullable int + WhenWritingNull → absent when unset,
//     present when set (the docs-diff case with no line numbers).
//   • DiffCell.Text is a plain required string with NO ignore condition → it
//     ALWAYS serializes, even when empty ("").
//
// Uses JsonSerializerOptions with camelCase only (no host DefaultIgnoreCondition),
// matching NavNodeSerializationTests / ChartNodeSerializationTests, to prove the
// attributes carry the contract intrinsically. Wire-shape only — no rendering
// is tested here (the browser renderer is jsdom-tested TS-side).

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class DiffNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── discriminator ──────────────────────────────────────────────────────

    [Fact]
    public void DiffNode_SerializesTypeAsDiff()
    {
        var node = new DiffNode(new[]
        {
            new DiffRow(Old: new DiffCell("x"), New: new DiffCell("x")),
        });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"diff\"", json);
    }

    // ─── omitted optional fields absent (gotcha #8) ─────────────────────────

    [Fact]
    public void DiffNode_MinimalShape_OmittedFieldsAreAbsent()
    {
        // A single context row. No mode, no header, no id, no line numbers.
        var node = new DiffNode(new[]
        {
            new DiffRow(Old: new DiffCell("foo"), New: new DiffCell("foo")),
        });
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"mode\"", json);
        Assert.DoesNotContain("\"header\"", json);
        Assert.DoesNotContain("\"id\"", json);
        Assert.DoesNotContain("\"lineNumber\"", json);
    }

    [Fact]
    public void DiffNode_ModePresent_WhenSet()
    {
        var node = new DiffNode(
            new[] { new DiffRow(Old: new DiffCell("x"), New: new DiffCell("x")) },
            Mode: "unified");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"mode\":\"unified\"", json);
    }

    [Fact]
    public void DiffNode_HeaderPresent_WhenSet()
    {
        var node = new DiffNode(
            new[] { new DiffRow(Old: new DiffCell("x"), New: new DiffCell("x")) },
            Header: new DiffHeader(Old: "before.txt", New: "after.txt"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"header\":{\"old\":\"before.txt\",\"new\":\"after.txt\"}", json);
    }

    [Fact]
    public void DiffNode_IdPresent_WhenSet()
    {
        var node = new DiffNode(
            new[] { new DiffRow(Old: new DiffCell("x"), New: new DiffCell("x")) },
            Id: "d42");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"id\":\"d42\"", json);
    }

    // ─── DiffRow shape-carries-meaning contract ─────────────────────────────

    [Fact]
    public void DiffRow_PureRemove_NewSideIsAbsent()
    {
        // A pure-remove row: old side has content, new side is null (absent).
        var node = new DiffNode(new[]
        {
            new DiffRow(Old: new DiffCell("removed line"), New: null),
        });
        var json = Serialize<ViewNode>(node);
        // The `new` field must be ABSENT (not `"new":null`), preserving the
        // shape-carries-meaning contract on the wire.
        Assert.Contains("\"old\":{\"text\":\"removed line\"}", json);
        Assert.DoesNotContain("\"new\"", json);
    }

    [Fact]
    public void DiffRow_PureAdd_OldSideIsAbsent()
    {
        var node = new DiffNode(new[]
        {
            new DiffRow(Old: null, New: new DiffCell("added line")),
        });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"new\":{\"text\":\"added line\"}", json);
        Assert.DoesNotContain("\"old\"", json);
    }

    [Fact]
    public void DiffRow_BothSidesPresent_ContextRoundTrips()
    {
        var node = new DiffNode(new[]
        {
            new DiffRow(
                Old: new DiffCell("foo", LineNumber: 3),
                New: new DiffCell("foo", LineNumber: 3)),
        });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"old\":{\"text\":\"foo\",\"lineNumber\":3}", json);
        Assert.Contains("\"new\":{\"text\":\"foo\",\"lineNumber\":3}", json);
    }

    [Fact]
    public void DiffCell_EmptyText_AlwaysSerializes()
    {
        // An empty-string cell text is DIFFERENT from an absent cell — the
        // required string must always emit, even when "".
        var node = new DiffNode(new[]
        {
            new DiffRow(Old: new DiffCell(""), New: new DiffCell("")),
        });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"old\":{\"text\":\"\"}", json);
        Assert.Contains("\"new\":{\"text\":\"\"}", json);
    }

    [Fact]
    public void DiffCell_LineNumberOmitted_WhenUnset()
    {
        var node = new DiffNode(new[]
        {
            new DiffRow(
                Old: new DiffCell("prose diff - no line numbers"),
                New: new DiffCell("prose diff - no line numbers here either")),
        });
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"lineNumber\"", json);
    }

    // ─── validation: DiffNode is action-free (leaf) ─────────────────────────

    [Fact]
    public void DiffNode_IsActionFree_ValidatorFallsThrough()
    {
        // DiffNode carries no dispatch-bearing children — it falls through the
        // Collect() default arm the same way ChartNode / StepsNode do. This
        // test proves a DiffNode wrapped in a page doesn't trip the validator.
        var page = new PageNode(
            Title: null,
            Children: new ViewNode[]
            {
                new DiffNode(new[]
                {
                    new DiffRow(Old: new DiffCell("a"), New: new DiffCell("b")),
                }),
            });
        // Should not throw.
        ViewTreeValidation.ValidateActionNames(page);
    }
}
