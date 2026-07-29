// v8.0.0 (COMP-03) — CheckboxNode.Variant wire-shape parity.
//
// Proves the .NET CheckboxNode.Variant + CheckboxVariant enum serialize
// BYTE-ALIGNED with the TS twin (Plan 23-03):
//   • CheckboxVariant is a real .NET enum (closed-union-must-be-enum
//     discipline; AGENTS.md gotcha #8) with a KebabEnum<T> converter →
//     kebab-case wire strings.
//   • Variant on CheckboxNode carries [JsonIgnore(WhenWritingNull)] →
//     ABSENT from JSON when unset (not "variant": null), matching the TS
//     absent-never-null contract (gotcha #8).
//   • The other CheckboxNode optionals (Label, Action, Tooltip) keep their
//     WhenWritingNull posture — regression guard.
//
// Mirrors IconNodeSerializationTests / DiffNodeSerializationTests — uses
// JsonSerializerOptions with camelCase only (no host DefaultIgnoreCondition)
// to prove the [JsonIgnore] attributes carry the contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class CheckboxSwitchSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── (a) Variant:Switch serializes as "switch" ───────────────────────────

    [Fact]
    public void CheckboxNode_VariantSwitch_SerializesAsSwitch()
    {
        var node = new CheckboxNode(
            Name: "notify",
            Bind: "notify",
            Label: null,
            Action: null,
            Tooltip: null,
            Variant: CheckboxVariant.Switch);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"variant\":\"switch\"", json);
        // Discriminator still emits.
        Assert.Contains("\"type\":\"checkbox\"", json);
    }

    // ─── (b) Variant absent = ABSENT on wire (gotcha #8 direct assertion) ─────

    [Fact]
    public void CheckboxNode_VariantAbsent_OmitsField()
    {
        // No Variant passed — the field MUST NOT appear in the JSON.
        // Regression guard for the WhenWritingNull posture (gotcha #8):
        // an unset optional is ABSENT, never "variant": null.
        var node = new CheckboxNode(
            Name: "notify",
            Bind: "notify",
            Label: null,
            Action: null);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"variant\"", json);
        // Sanity: the record still serializes correctly.
        Assert.Contains("\"type\":\"checkbox\"", json);
        Assert.Contains("\"name\":\"notify\"", json);
    }

    // ─── (c) Variant:Checkbox serializes explicit-non-null path (symmetry) ────

    [Fact]
    public void CheckboxNode_VariantCheckbox_SerializesAsCheckbox()
    {
        // When the app EXPLICITLY passes CheckboxVariant.Checkbox (e.g. to
        // force the default render), the wire value serializes as "checkbox"
        // via the KebabEnum converter. Conceptually byte-identical to
        // "variant" absent, but proves the explicit path works.
        var node = new CheckboxNode(
            Name: "opt",
            Bind: "opt",
            Label: null,
            Action: null,
            Tooltip: null,
            Variant: CheckboxVariant.Checkbox);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"variant\":\"checkbox\"", json);
    }

    // ─── (d) KebabEnum round-trip proves the string ↔ enum wiring ─────────────

    [Fact]
    public void CheckboxVariant_KebabEnum_RoundTrips()
    {
        // Deserialize "switch" back into CheckboxVariant.Switch.
        var switchJson = "\"switch\"";
        var switchVal = JsonSerializer.Deserialize<CheckboxVariant>(switchJson, _opts);
        Assert.Equal(CheckboxVariant.Switch, switchVal);

        // Deserialize "checkbox" back into CheckboxVariant.Checkbox.
        var checkboxJson = "\"checkbox\"";
        var checkboxVal = JsonSerializer.Deserialize<CheckboxVariant>(checkboxJson, _opts);
        Assert.Equal(CheckboxVariant.Checkbox, checkboxVal);
    }

    // ─── Bonus: existing WhenWritingNull posture on Label/Action/Tooltip ──────

    [Fact]
    public void CheckboxNode_MinimalShape_AllOptionalsAbsent()
    {
        // Regression guard for gotcha #8 posture on the pre-existing optionals.
        // The Variant addition MUST NOT have changed the emission of Label,
        // Action, or Tooltip.
        var node = new CheckboxNode(
            Name: "agree",
            Bind: "agree",
            Label: null,
            Action: null);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"label\"", json);
        Assert.DoesNotContain("\"action\"", json);
        Assert.DoesNotContain("\"tooltip\"", json);
        Assert.DoesNotContain("\"variant\"", json);
    }
}
