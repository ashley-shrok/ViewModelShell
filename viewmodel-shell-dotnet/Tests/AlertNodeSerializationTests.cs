// v8.0.0 (COMP-07) — AlertNode wire-shape parity.
//
// Proves the .NET AlertNode record + Tone-required + [JsonDerivedType]
// discriminator serialize BYTE-ALIGNED with the TS twin:
//   • Tone is REQUIRED (non-nullable) — it IS the point of the node. The C#
//     compiler enforces this at construction; the wire always carries a tone.
//   • Message is REQUIRED (non-nullable ViewNode) — polymorphic emission
//     verified via nested "type":"…" discriminator on Message payload.
//   • Every optional (Title, Icon, Actions) carries WhenWritingNull → ABSENT
//     from JSON when unset (AGENTS.md gotcha #8).
//   • Dismissible carries WhenWritingDefault → false is ABSENT (matches TS
//     optional `dismissible?: boolean` which omits the field when unset).
//   • Bare `new AlertNode(Tone.Danger, TextNode…)` serializes without any
//     "null" fields — the class-2 findNulls defect parity cannot see.
//   • Nested Actions[] each carry "type":"button" discriminator (typed
//     IReadOnlyList<ViewNode>? per FormNode.Buttons banked posture).
//   • IconName override round-trips kebab-case correctly on this node.
//
// Mirrors AvatarNodeSerializationTests.cs — uses JsonSerializerOptions with
// camelCase only (no host DefaultIgnoreCondition), to prove the [JsonIgnore]
// attributes carry the contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class AlertNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void AlertNode_SerializesTypeAsAlert()
    {
        var node = new AlertNode(Tone: Tone.Danger, Message: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"alert\"", json);
    }

    // ─── Tone REQUIRED — every tone kebab-cases correctly ────────────────────

    [Fact]
    public void AlertNode_Tone_Required_DangerSerializesAsKebab()
    {
        var node = new AlertNode(Tone: Tone.Danger, Message: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"danger\"", json);
    }

    [Fact]
    public void AlertNode_Tone_Required_WarningSerializesAsKebab()
    {
        var node = new AlertNode(Tone: Tone.Warning, Message: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"warning\"", json);
    }

    [Fact]
    public void AlertNode_Tone_Required_SuccessSerializesAsKebab()
    {
        var node = new AlertNode(Tone: Tone.Success, Message: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"success\"", json);
    }

    [Fact]
    public void AlertNode_Tone_Required_InfoSerializesAsKebab()
    {
        var node = new AlertNode(Tone: Tone.Info, Message: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"info\"", json);
    }

    // ─── Message REQUIRED — polymorphic emission ─────────────────────────────

    [Fact]
    public void AlertNode_Message_Required_SerializesPolymorphically()
    {
        // Message is typed ViewNode (not ViewNode?, not string) so
        // System.Text.Json emits the polymorphic "type" discriminator on the
        // nested payload. Proves the load-bearing "type-as-ViewNode-not-narrow"
        // rule on AlertNode.Message.
        var node = new AlertNode(Tone: Tone.Info, Message: new TextNode("The message"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"message\":{", json);
        Assert.Contains("\"type\":\"text\"", json);
        Assert.Contains("\"value\":\"The message\"", json);
    }

    [Fact]
    public void AlertNode_Message_ViewNodeBranch_KeepsCallerStyle()
    {
        // A custom TextNode with style:"heading" passes through as-is
        // (no forced string-lift on the wire — the client-side render's
        // string→TextNode{style:"muted"} lift is purely a browser.ts
        // renderer convenience for TS callers).
        var node = new AlertNode(
            Tone: Tone.Info,
            Message: new TextNode("Custom", Style: TextStyle.Heading));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"style\":\"heading\"", json);
    }

    // ─── Class-2 findNulls defect protection (gotcha #8) ────────────────────

    [Fact]
    public void AlertNode_BareRequiredOnly_OnlyRequiredFieldsPresent()
    {
        // Tone + Message are REQUIRED; every optional (Title, Icon, Actions,
        // Dismissible) MUST be absent from JSON. Any regression here is
        // exactly the class-2 defect the parity gate's `normalize.ts`
        // silently strips before diffing (AGENTS.md gotcha #8).
        var node = new AlertNode(Tone: Tone.Danger, Message: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"alert\"", json);
        Assert.Contains("\"tone\":\"danger\"", json);
        Assert.Contains("\"message\":{", json);
        Assert.DoesNotContain("\"title\"", json);
        Assert.DoesNotContain("\"icon\"", json);
        Assert.DoesNotContain("\"actions\"", json);
        Assert.DoesNotContain("\"dismissible\"", json);
        // Belt-and-braces: no `null` anywhere in the bare-node payload.
        Assert.DoesNotContain("null", json);
    }

    // ─── Title (optional) — WhenWritingNull posture ─────────────────────────

    [Fact]
    public void AlertNode_Title_OmittedIsAbsent()
    {
        var node = new AlertNode(Tone: Tone.Info, Message: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"title\"", json);
    }

    [Fact]
    public void AlertNode_Title_Present_WhenSet()
    {
        var node = new AlertNode(Tone: Tone.Info, Message: new TextNode("hi"), Title: "Storage full");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"title\":\"Storage full\"", json);
    }

    // ─── Icon (optional) — WhenWritingNull + IconName kebab round-trip ──────

    [Fact]
    public void AlertNode_Icon_OmittedIsAbsent()
    {
        var node = new AlertNode(Tone: Tone.Danger, Message: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"icon\"", json);
    }

    [Fact]
    public void AlertNode_Icon_XCircle_SerializesAsKebab()
    {
        // XCircle → "x-circle" (multi-word IconName kebab round-trip on this
        // node). Also validates that Icon overrides the tone default at the
        // wire level (the wire carries the icon; the renderer decides
        // precedence).
        var node = new AlertNode(
            Tone: Tone.Danger,
            Message: new TextNode("hi"),
            Icon: IconName.XCircle);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"x-circle\"", json);
    }

    [Fact]
    public void AlertNode_Icon_AlertTriangle_SerializesAsKebab()
    {
        var node = new AlertNode(
            Tone: Tone.Warning,
            Message: new TextNode("hi"),
            Icon: IconName.AlertTriangle);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"alert-triangle\"", json);
    }

    [Fact]
    public void AlertNode_Icon_CheckCircle_SerializesAsKebab()
    {
        var node = new AlertNode(
            Tone: Tone.Success,
            Message: new TextNode("hi"),
            Icon: IconName.CheckCircle);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"check-circle\"", json);
    }

    [Fact]
    public void AlertNode_Icon_Info_SerializesAsKebab()
    {
        // Single-word IconName still round-trips through the wire.
        var node = new AlertNode(
            Tone: Tone.Info,
            Message: new TextNode("hi"),
            Icon: IconName.Info);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"info\"", json);
    }

    // ─── Actions (optional) — WhenWritingNull + polymorphic emission ────────

    [Fact]
    public void AlertNode_Actions_OmittedIsAbsent()
    {
        var node = new AlertNode(Tone: Tone.Info, Message: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"actions\"", json);
    }

    [Fact]
    public void AlertNode_Actions_ButtonNodes_SerializesWithDiscriminator()
    {
        // Actions is typed IReadOnlyList<ViewNode>? (NOT
        // IReadOnlyList<ButtonNode>) so System.Text.Json emits the polymorphic
        // "type":"button" discriminator on each entry — the FormNode.Buttons
        // banked posture at ViewModels.cs:1155-1159.
        var node = new AlertNode(
            Tone: Tone.Danger,
            Message: new TextNode("Failed"),
            Actions: new ViewNode[]
            {
                new ButtonNode(Label: "Retry", Action: new ActionDescriptor("alert-retry")),
                new ButtonNode(Label: "Details", Action: new ActionDescriptor("alert-details")),
            });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"actions\":[", json);
        // Each button carries its discriminator (proves polymorphic emission
        // through the ViewNode-typed list).
        Assert.Contains("\"type\":\"button\"", json);
        Assert.Contains("\"label\":\"Retry\"", json);
        Assert.Contains("\"label\":\"Details\"", json);
    }

    // ─── Dismissible — WhenWritingDefault posture ───────────────────────────

    [Fact]
    public void AlertNode_Dismissible_False_SerializedAsAbsent()
    {
        // The CANONICAL WhenWritingDefault posture test. Dismissible: false
        // MUST be ABSENT from the wire (not "dismissible": false) — byte-
        // identical to the TS optional `dismissible?: boolean` which is
        // omitted when unset. Matches SectionNode.FollowTail +
        // MessageListNode.FollowTail posture.
        var node = new AlertNode(
            Tone: Tone.Info,
            Message: new TextNode("hi"),
            Dismissible: false);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"dismissible\"", json);
    }

    [Fact]
    public void AlertNode_Dismissible_True_SerializedAsTrue()
    {
        var node = new AlertNode(
            Tone: Tone.Warning,
            Message: new TextNode("hi"),
            Dismissible: true);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"dismissible\":true", json);
    }

    [Fact]
    public void AlertNode_Dismissible_Omitted_SerializedAsAbsent()
    {
        // Positional-default omission — no Dismissible arg supplied at all.
        // The C# default (false) triggers the WhenWritingDefault ignore.
        var node = new AlertNode(Tone: Tone.Info, Message: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"dismissible\"", json);
    }

    // ─── All fields set — every one lands on the wire ───────────────────────

    [Fact]
    public void AlertNode_AllFieldsSet_AllPresent()
    {
        var node = new AlertNode(
            Tone: Tone.Danger,
            Message: new TextNode("Payment declined"),
            Title: "Payment failed",
            Icon: IconName.XCircle,
            Actions: new ViewNode[]
            {
                new ButtonNode(Label: "Retry", Action: new ActionDescriptor("alert-full-retry")),
            },
            Dismissible: true);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"alert\"", json);
        Assert.Contains("\"tone\":\"danger\"", json);
        Assert.Contains("\"title\":\"Payment failed\"", json);
        Assert.Contains("\"icon\":\"x-circle\"", json);
        Assert.Contains("\"actions\":[", json);
        Assert.Contains("\"dismissible\":true", json);
        Assert.Contains("\"message\":{", json);
        Assert.Contains("\"type\":\"text\"", json);
        Assert.Contains("\"value\":\"Payment declined\"", json);
    }
}
