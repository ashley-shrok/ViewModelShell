// InlineRun / TextNode.Runs / DiffCell.Runs — wire-shape serialization parity.
//
// Proves the .NET inline rich-text records serialize BYTE-ALIGNED with the TS
// optional posture (gotcha #8):
//   • InlineRun.Bold/Italic/Code/Strike/External — non-nullable bool +
//     WhenWritingDefault → ABSENT when false, present when true. This is the
//     load-bearing one: the TS twin types these as literal `true` (not `boolean`)
//     so `false` is unrepresentable there, and a bool? here would admit an
//     explicit false that normalize.ts does NOT drop and findNulls does NOT flag
//     — i.e. two wire encodings of "not bold" and a fresh drift class.
//   • InlineRun.Href — nullable + WhenWritingNull → absent when unset.
//   • InlineRun.Text — plain required string, NO ignore condition → ALWAYS
//     serializes, including "".
//   • TextNode.Runs / DiffCell.Runs — nullable list + WhenWritingNull → absent
//     when unset, so a plain TextNode is byte-identical to its pre-runs shape.
//   • TextNode.Runs is POSITIONAL SLOT 4 — the compile-time guard below fails to
//     BUILD if anyone reorders the record parameters, which would silently retype
//     ~96 existing 2- and 3-arg construction sites.
//
// Uses JsonSerializerOptions with camelCase only (no host DefaultIgnoreCondition),
// matching DiffNodeSerializationTests, to prove the attributes carry the contract
// intrinsically. Wire-shape only — rendering is jsdom-tested TS-side.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class InlineRunSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── TextNode.Runs absent vs present ────────────────────────────────────

    [Fact]
    public void TextNode_WithoutRuns_OmitsRunsEntirely()
    {
        var json = Serialize<ViewNode>(new TextNode("hello"));
        Assert.DoesNotContain("runs", json);
        Assert.Contains("\"type\":\"text\"", json);
        Assert.Contains("\"value\":\"hello\"", json);
    }

    [Fact]
    public void TextNode_WithoutRuns_IsByteIdenticalToPreRunsShape()
    {
        // The non-breaking guarantee, asserted exactly.
        var json = Serialize<ViewNode>(new TextNode("hi", TextStyle.Muted, Tone.Danger));
        Assert.Equal("{\"type\":\"text\",\"value\":\"hi\",\"style\":\"muted\",\"tone\":\"danger\"}", json);
    }

    [Fact]
    public void TextNode_WithRuns_EmitsRunsArray()
    {
        var node = new TextNode("ab", Runs: new[] { new InlineRun("a"), new InlineRun("b", Bold: true) });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"runs\":[", json);
        Assert.Contains("\"text\":\"a\"", json);
        Assert.Contains("\"bold\":true", json);
    }

    [Fact]
    public void TextNode_WithEmptyRunsList_EmitsPresentButEmptyArray()
    {
        // Present-but-empty is a DISTINCT wire state from absent. Asserted so
        // nobody "helpfully" collapses it to absent later.
        var json = Serialize<ViewNode>(new TextNode("x", Runs: System.Array.Empty<InlineRun>()));
        Assert.Contains("\"runs\":[]", json);
    }

    // ─── the absent-vs-present matrix, one pair per optional ────────────────

    [Theory]
    [InlineData("bold")]
    [InlineData("italic")]
    [InlineData("code")]
    [InlineData("strike")]
    [InlineData("external")]
    public void InlineRun_BooleanFlags_AreAbsentWhenFalse(string flag)
    {
        var json = Serialize(new InlineRun("t"));
        Assert.DoesNotContain(flag, json);
    }

    [Fact]
    public void InlineRun_Bold_PresentWhenTrue() =>
        Assert.Contains("\"bold\":true", Serialize(new InlineRun("t", Bold: true)));

    [Fact]
    public void InlineRun_Italic_PresentWhenTrue() =>
        Assert.Contains("\"italic\":true", Serialize(new InlineRun("t", Italic: true)));

    [Fact]
    public void InlineRun_Code_PresentWhenTrue() =>
        Assert.Contains("\"code\":true", Serialize(new InlineRun("t", Code: true)));

    [Fact]
    public void InlineRun_Strike_PresentWhenTrue() =>
        Assert.Contains("\"strike\":true", Serialize(new InlineRun("t", Strike: true)));

    [Fact]
    public void InlineRun_External_PresentWhenTrue() =>
        Assert.Contains("\"external\":true", Serialize(new InlineRun("t", Href: "https://e.com", External: true)));

    [Fact]
    public void InlineRun_Href_AbsentWhenNull_PresentWhenSet()
    {
        Assert.DoesNotContain("href", Serialize(new InlineRun("t")));
        Assert.Contains("\"href\":\"https://e.com\"", Serialize(new InlineRun("t", Href: "https://e.com")));
    }

    [Fact]
    public void InlineRun_Text_AlwaysSerializes_EvenWhenEmpty() =>
        Assert.Contains("\"text\":\"\"", Serialize(new InlineRun("")));

    [Fact]
    public void InlineRun_AllFlagsSet_EmitsExactExpectedJson()
    {
        var json = Serialize(new InlineRun("x", Bold: true, Italic: true, Code: true, Strike: true,
                                           Href: "https://e.com", External: true));
        Assert.Equal(
            "{\"text\":\"x\",\"bold\":true,\"italic\":true,\"code\":true,\"strike\":true,"
          + "\"href\":\"https://e.com\",\"external\":true}",
            json);
    }

    // ─── the zero-null invariant (local twin of parity's findNulls) ──────────

    [Fact]
    public void TextNode_WithMixedRuns_EmitsNoNullsAnywhere()
    {
        var node = new TextNode("abc", Runs: new[]
        {
            new InlineRun("a"),
            new InlineRun("b", Bold: true),
            new InlineRun("c", Href: "https://e.com", External: true),
        });
        Assert.DoesNotContain(":null", Serialize<ViewNode>(node));
    }

    // ─── FromRuns derives Value ─────────────────────────────────────────────

    [Fact]
    public void FromRuns_DerivesValueAsConcatenationOfRunTexts()
    {
        var node = TextNode.FromRuns(new[]
        {
            new InlineRun("see "),
            new InlineRun("docs", Bold: true),
            new InlineRun(" now"),
        });
        Assert.Equal("see docs now", node.Value);
        Assert.NotNull(node.Runs);
        Assert.Equal(3, node.Runs!.Count);
    }

    [Fact]
    public void FromRuns_CarriesStyleAndTone()
    {
        var node = TextNode.FromRuns(new[] { new InlineRun("x") }, TextStyle.Heading, Tone.Warning);
        Assert.Equal(TextStyle.Heading, node.Style);
        Assert.Equal(Tone.Warning, node.Tone);
    }

    // ─── positional-compat COMPILE guard ────────────────────────────────────

    [Fact]
    public void TextNode_ExistingPositionalCallShapes_StillCompileAndOmitRuns()
    {
        // If anyone reorders the record parameters so Runs is not slot 4, THIS
        // TEST FAILS TO BUILD — which is the point. ~96 call sites depend on it.
        var oneArg = new TextNode("x");
        var twoArg = new TextNode("x", TextStyle.Muted);
        var threeArg = new TextNode("x", TextStyle.Heading, Tone.Danger);

        foreach (var n in new[] { oneArg, twoArg, threeArg })
            Assert.DoesNotContain("runs", Serialize<ViewNode>(n));
    }

    // ─── DiffCell.Runs ──────────────────────────────────────────────────────

    [Fact]
    public void DiffCell_WithoutRuns_OmitsRuns()
    {
        var json = Serialize(new DiffCell("x", 3));
        Assert.DoesNotContain("runs", json);
        Assert.Contains("\"lineNumber\":3", json);
    }

    [Fact]
    public void DiffCell_WithRuns_EmitsThem_AndTextStillSerializes()
    {
        var json = Serialize(new DiffCell("the quick fox", Runs: new[]
        {
            new InlineRun("the "),
            new InlineRun("quick", Strike: true),
            new InlineRun(" fox"),
        }));
        Assert.Contains("\"text\":\"the quick fox\"", json);
        Assert.Contains("\"runs\":[", json);
        Assert.Contains("\"strike\":true", json);
    }

    [Fact]
    public void DiffCell_ExistingPositionalCallShapes_StillCompile()
    {
        // Runs is slot 3 on DiffCell — same guard as TextNode above.
        var oneArg = new DiffCell("x");
        var twoArg = new DiffCell("x", 7);
        Assert.DoesNotContain("runs", Serialize(oneArg));
        Assert.DoesNotContain("runs", Serialize(twoArg));
    }
}
