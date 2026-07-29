// v8.0.0 (COMP-12) — SettingRowNode wire-shape parity.
//
// Proves the .NET SettingRowNode record + [JsonDerivedType] discriminator
// serialize BYTE-ALIGNED with the TS twin:
//   • Label is REQUIRED (non-nullable ViewNode) — polymorphic emission verified
//     via nested "type":"…" discriminator on the Label payload. TS twin's
//     `string | ViewNode` convenience wraps in TextNode{style:body,
//     weight:medium} at render time; .NET server wraps explicitly.
//   • Every optional (Icon, Description, Trailing, Action) carries
//     WhenWritingNull → ABSENT from JSON when unset (AGENTS.md gotcha #8
//     class-2 findNulls defect protection).
//   • Bare `new SettingRowNode(new TextNode("Push"))` serializes without
//     any "null" fields — the class-2 findNulls defect parity cannot see.
//   • Trailing serializes polymorphically as a nested ViewNode with its
//     "type" discriminator (the natural pairing is CheckboxNode(Variant:
//     "switch") from COMP-03 — verified explicitly below).
//   • IconName kebab round-trip.
//   • Action serializes as an ActionDescriptor { name, ... }.
//
// Mirrors DetailRowNodeSerializationTests.cs / TimelineEntryNodeSerialization
// Tests.cs — the direct byte-aligned template for a Route-B leaf composite
// with typed slots + optional Icon + optional Action.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class SettingRowNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void Type_SerializesAsSettingRow()
    {
        var node = new SettingRowNode(Label: new TextNode("Push notifications"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"setting-row\"", json);
    }

    // ─── Class-2 findNulls defect protection (gotcha #8) ────────────────────

    [Fact]
    public void BareNode_MinimalShape_LabelOnly()
    {
        // Bare node — Label required; Icon + Description + Trailing + Action
        // must be ABSENT. Proves the WhenWritingNull posture on every
        // optional slot. Any regression here is exactly the class-2 defect
        // parity's normalize.ts silently strips before diffing.
        var node = new SettingRowNode(Label: new TextNode("Push notifications"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"setting-row\"", json);
        Assert.Contains("\"label\":{", json);
        Assert.DoesNotContain("\"icon\"", json);
        Assert.DoesNotContain("\"description\"", json);
        Assert.DoesNotContain("\"trailing\"", json);
        Assert.DoesNotContain("\"action\"", json);
        // Belt-and-braces: no `null` anywhere.
        Assert.DoesNotContain("null", json);
    }

    // ─── Label — REQUIRED, polymorphic emission ─────────────────────────────

    [Fact]
    public void Label_Required_SerializesPolymorphically()
    {
        // Label is typed ViewNode (not ViewNode?, not string) so
        // System.Text.Json emits the polymorphic "type" discriminator on the
        // nested payload. Proves the load-bearing "type-as-ViewNode-not-narrow"
        // rule on SettingRowNode.Label.
        var node = new SettingRowNode(Label: new TextNode("Two-factor auth"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"label\":{", json);
        Assert.Contains("\"type\":\"text\"", json);
        Assert.Contains("\"value\":\"Two-factor auth\"", json);
    }

    // ─── Icon — WhenWritingNull + IconName kebab round-trip ─────────────────

    [Fact]
    public void Icon_OmittedIsAbsent()
    {
        var node = new SettingRowNode(Label: new TextNode("Push notifications"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"icon\"", json);
    }

    [Fact]
    public void Icon_Bell_SerializesAsKebab()
    {
        var node = new SettingRowNode(
            Label: new TextNode("Push notifications"),
            Icon: IconName.Bell);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"bell\"", json);
    }

    // ─── Description — WhenWritingNull + polymorphic emission ───────────────

    [Fact]
    public void Description_OmittedIsAbsent()
    {
        var node = new SettingRowNode(Label: new TextNode("Push notifications"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"description\"", json);
    }

    [Fact]
    public void Description_SetSerializesPolymorphically()
    {
        // Description is typed ViewNode? — when set it serializes with its
        // "type" discriminator. TS twin's `string | ViewNode` convenience
        // wraps in TextNode{style:muted}; .NET side wraps explicitly.
        var node = new SettingRowNode(
            Label: new TextNode("Push notifications"),
            Description: new TextNode(
                "You'll get emails for mentions and DMs.",
                Style: TextStyle.Muted));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"description\":{", json);
        Assert.Contains("\"style\":\"muted\"", json);
    }

    // ─── Trailing — WhenWritingNull + natural pairing with CheckboxNode(switch) ─

    [Fact]
    public void Trailing_OmittedIsAbsent()
    {
        var node = new SettingRowNode(Label: new TextNode("Push notifications"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"trailing\"", json);
    }

    [Fact]
    public void Trailing_CheckboxSwitch_SerializesAsNaturalPairing()
    {
        // The NATURAL PAIRING per CONTEXT §9 — a CheckboxNode with
        // Variant:"switch" from COMP-03 in the trailing slot. Proves the
        // polymorphic "type":"checkbox" discriminator lands through the
        // ViewNode? Trailing slot, AND that the switch variant + bind path
        // + name survive the round trip byte-identical to the TS twin.
        var node = new SettingRowNode(
            Label: new TextNode("Email notifications"),
            Trailing: new CheckboxNode(
                Name: "email",
                Bind: "settings.email",
                Label: "",
                Action: null,
                Variant: CheckboxVariant.Switch));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"trailing\":{", json);
        Assert.Contains("\"type\":\"checkbox\"", json);
        Assert.Contains("\"variant\":\"switch\"", json);
        Assert.Contains("\"bind\":\"settings.email\"", json);
        Assert.Contains("\"name\":\"email\"", json);
    }

    [Fact]
    public void Trailing_Button_SerializesAsButton()
    {
        // Also common: a ButtonNode in the trailing slot (drill-down or
        // destructive action per row). Proves any ViewNode is accepted.
        var node = new SettingRowNode(
            Label: new TextNode("Delete account"),
            Trailing: new ButtonNode(
                Label: "Delete",
                Action: new ActionDescriptor("delete-account")));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"trailing\":{", json);
        Assert.Contains("\"type\":\"button\"", json);
        Assert.Contains("\"label\":\"Delete\"", json);
    }

    // ─── Action — WhenWritingNull + ActionDescriptor round-trip ─────────────

    [Fact]
    public void Action_OmittedIsAbsent()
    {
        var node = new SettingRowNode(Label: new TextNode("Push notifications"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"action\"", json);
    }

    [Fact]
    public void Action_SetSerializesAsActionDescriptor()
    {
        var node = new SettingRowNode(
            Label: new TextNode("Push notifications"),
            Action: new ActionDescriptor("open-push-settings"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"action\":{", json);
        Assert.Contains("\"name\":\"open-push-settings\"", json);
    }

    // ─── AllFieldsSet — every optional present + required round-trip ────────

    [Fact]
    public void AllFieldsSet_AllPresent()
    {
        // Full-fat SettingRowNode with every slot set — the natural-pairing
        // configuration Plan 25-07 Showcase will exercise. Every optional
        // present + polymorphic on the wire.
        var node = new SettingRowNode(
            Label: new TextNode("Email notifications"),
            Icon: IconName.Bell,
            Description: new TextNode(
                "You'll get emails for mentions and DMs.",
                Style: TextStyle.Muted),
            Trailing: new CheckboxNode(
                Name: "email",
                Bind: "settings.email",
                Label: "",
                Action: null,
                Variant: CheckboxVariant.Switch),
            Action: new ActionDescriptor("open-email-settings"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"setting-row\"", json);
        Assert.Contains("\"icon\":\"bell\"", json);
        Assert.Contains("\"label\":{", json);
        Assert.Contains("\"description\":{", json);
        Assert.Contains("\"trailing\":{", json);
        Assert.Contains("\"variant\":\"switch\"", json);
        Assert.Contains("\"action\":{", json);
        Assert.Contains("\"name\":\"open-email-settings\"", json);
    }
}
