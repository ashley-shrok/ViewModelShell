// ChartNode / ChartSeries (CHARTBASE-01) — wire-shape serialization parity.
//
// Verifies the reshaped multi-series ChartNode's optional-field rules:
// Kind/Title/ChartSeries.Tone are nullable + WhenWritingNull (absent when
// unset), Stacked is bool default false + WhenWritingDefault (absent when
// false — the F2 false-vs-absent rule, matching the TS optional `stacked?`).
// Labels/Series/Name/Data are required and always present. Whole-number
// Data values must serialize as integers (12, not 12.0), byte-identical to
// JSON.stringify. Uses JsonSerializerOptions with camelCase only (no host
// DefaultIgnoreCondition), matching FillSerializationTests/EnvelopeTests, to
// prove the attributes carry the contract intrinsically.
//
// Wire-shape only — no rendering is tested here.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class ChartNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── type / labels / series always present ─────────────────────────────

    [Fact]
    public void ChartNode_SerializesTypeAsChart()
    {
        var chart = new ChartNode(
            Labels: new[] { "Mon", "Tue" },
            Series: new[] { new ChartSeries("Sales", new double[] { 1, 2 }) });
        var json = Serialize<ViewNode>(chart);
        Assert.Contains("\"type\":\"chart\"", json);
    }

    [Fact]
    public void ChartNode_LabelsAndSeries_AlwaysPresent()
    {
        var chart = new ChartNode(
            Labels: new[] { "Mon", "Tue" },
            Series: new[] { new ChartSeries("Sales", new double[] { 1, 2 }) });
        var json = Serialize<ViewNode>(chart);
        Assert.Contains("\"labels\":[\"Mon\",\"Tue\"]", json);
        Assert.Contains("\"series\":[", json);
        Assert.Contains("\"name\":\"Sales\"", json);
        Assert.Contains("\"data\":[1,2]", json);
    }

    // ─── default-omission: kind/title/stacked absent when unset ────────────

    [Fact]
    public void ChartNode_DefaultBar_OmitsKindTitleStacked()
    {
        var chart = new ChartNode(
            Labels: new[] { "A" },
            Series: new[] { new ChartSeries("S1", new double[] { 5 }) });
        var json = Serialize<ViewNode>(chart);
        Assert.DoesNotContain("\"kind\"", json);
        Assert.DoesNotContain("\"title\"", json);
        Assert.DoesNotContain("\"stacked\"", json);
    }

    // ─── explicit non-default values all emit ───────────────────────────────

    [Fact]
    public void ChartNode_AreaStackedTitle_EmitsAllThreeKeys()
    {
        var chart = new ChartNode(
            Labels: new[] { "A" },
            Series: new[] { new ChartSeries("S1", new double[] { 5 }) },
            Kind: ChartKind.Area,
            Stacked: true,
            Title: "T");
        var json = Serialize<ViewNode>(chart);
        Assert.Contains("\"kind\":\"area\"", json);
        Assert.Contains("\"stacked\":true", json);
        Assert.Contains("\"title\":\"T\"", json);
    }

    // ─── ChartSeries.Tone omission ──────────────────────────────────────────

    [Fact]
    public void ChartSeries_Tone_DefaultNull_IsAbsent()
    {
        var chart = new ChartNode(
            Labels: new[] { "A" },
            Series: new[] { new ChartSeries("S1", new double[] { 5 }) });
        var json = Serialize<ViewNode>(chart);
        Assert.DoesNotContain("\"tone\"", json);
    }

    [Fact]
    public void ChartSeries_Tone_Danger_SerializesToneDanger()
    {
        var chart = new ChartNode(
            Labels: new[] { "A" },
            Series: new[] { new ChartSeries("S1", new double[] { 5 }, Tone: Tone.Danger) });
        var json = Serialize<ViewNode>(chart);
        Assert.Contains("\"tone\":\"danger\"", json);
    }

    // ─── whole-number data serializes as integer, not decimal ───────────────

    [Fact]
    public void ChartSeries_WholeNumberData_SerializesAsInteger_NotDecimal()
    {
        var chart = new ChartNode(
            Labels: new[] { "A" },
            Series: new[] { new ChartSeries("S1", new double[] { 12 }) });
        var json = Serialize<ViewNode>(chart);
        Assert.Contains("\"data\":[12]", json);
        Assert.DoesNotContain("12.0", json);
    }
}
