// v8.0.0 (COMP-13) — ChipNode wire-shape parity.
//
// Proves the .NET ChipNode record + [JsonDerivedType] discriminator serialize
// BYTE-ALIGNED with the TS twin:
//   • Label is REQUIRED (non-nullable string) — the pill's identity text.
//   • Every optional (Tone, Icon, DismissAction, Action) carries
//     WhenWritingNull → ABSENT from JSON when unset (AGENTS.md gotcha #8 —
//     class-2 findNulls parity blindspot).
//   • Bare `new ChipNode(Label: "active")` serializes without any "null"
//     fields or fields other than type + label.
//   • DismissAction is an ActionDescriptor OBJECT on the wire (identity-
//     carrying, mirrors ModalNode.DismissAction) — NOT a boolean like
//     AlertNode.Dismissible. This is the 🚨 CRITICAL DIVERGENCE test.
//   • Action + DismissAction coexist on the wire — a filter chip carrying
//     BOTH a toggle-me name AND a remove-me name is a first-class shape.
//
// Mirrors AlertNodeSerializationTests.cs — uses JsonSerializerOptions with
// camelCase only (no host DefaultIgnoreCondition), to prove the [JsonIgnore]
// attributes carry the contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class ChipNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void Type_SerializesAsChip()
    {
        var node = new ChipNode(Label: "active");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"chip\"", json);
    }

    // ─── Label REQUIRED ──────────────────────────────────────────────────────

    [Fact]
    public void Label_Required_SerializesAsValue()
    {
        var node = new ChipNode(Label: "active");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"label\":\"active\"", json);
    }

    // ─── Bare (label-only) → every optional ABSENT ───────────────────────────

    [Fact]
    public void BareNode_MinimalShape_LabelOnly()
    {
        // Class-2 findNulls defect protection (AGENTS.md gotcha #8): the
        // parity gate's normalize.ts strips nulls BEFORE diffing, so a
        // regression that emits "tone":null would silently pass the parity
        // gate. This asserts the invariant per-response directly.
        var node = new ChipNode(Label: "active");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"chip\"", json);
        Assert.Contains("\"label\":\"active\"", json);
        Assert.DoesNotContain("\"tone\"", json);
        Assert.DoesNotContain("\"icon\"", json);
        Assert.DoesNotContain("\"dismissAction\"", json);
        Assert.DoesNotContain("\"action\"", json);
        // Belt-and-braces — no `null` anywhere in the bare-node payload.
        Assert.DoesNotContain("null", json);
    }

    // ─── Tone (optional) — WhenWritingNull + kebab round-trip ────────────────

    [Fact]
    public void Tone_OmittedIsAbsent()
    {
        var node = new ChipNode(Label: "active");
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"tone\"", json);
    }

    [Fact]
    public void Tone_Danger_SerializesAsKebab()
    {
        var node = new ChipNode(Label: "err", Tone: Tone.Danger);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"danger\"", json);
    }

    [Fact]
    public void Tone_Warning_SerializesAsKebab()
    {
        var node = new ChipNode(Label: "warn", Tone: Tone.Warning);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"warning\"", json);
    }

    [Fact]
    public void Tone_Success_SerializesAsKebab()
    {
        var node = new ChipNode(Label: "ok", Tone: Tone.Success);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"success\"", json);
    }

    [Fact]
    public void Tone_Info_SerializesAsKebab()
    {
        var node = new ChipNode(Label: "note", Tone: Tone.Info);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"info\"", json);
    }

    // ─── Icon (optional) — WhenWritingNull + kebab round-trip ────────────────

    [Fact]
    public void Icon_OmittedIsAbsent()
    {
        var node = new ChipNode(Label: "no-icon");
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"icon\"", json);
    }

    [Fact]
    public void Icon_User_SerializesAsKebab()
    {
        var node = new ChipNode(Label: "u", Icon: IconName.User);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"user\"", json);
    }

    [Fact]
    public void Icon_XCircle_MultiWordKebab_RoundTrips()
    {
        // Multi-word IconName kebab round-trip on this node (parity with
        // AlertNode's icon test — different node, same enum).
        var node = new ChipNode(Label: "x", Icon: IconName.XCircle);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"x-circle\"", json);
    }

    // ─── DismissAction — WhenWritingNull + 🚨 CRITICAL POSTURE ──────────────

    [Fact]
    public void DismissAction_OmittedIsAbsent()
    {
        var node = new ChipNode(Label: "immutable");
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"dismissAction\"", json);
    }

    [Fact]
    public void DismissAction_SerializesAsActionDescriptor()
    {
        // 🚨 CRITICAL DIVERGENCE TEST — DismissAction serializes as an
        // ActionDescriptor OBJECT with a `name` field (mirrors
        // ModalNode.DismissAction), NOT as a boolean like
        // AlertNode.Dismissible. Chips need identity-carrying dispatch
        // (`remove-filter-42`, `unselect-tag-foo`), so the wire MUST carry
        // the caller's action name in an object shape.
        //
        // If a future refactor accidentally turns DismissAction into a
        // bool (matching AlertNode.Dismissible), this test fails: the wire
        // shape would be `"dismissAction":true` instead of
        // `"dismissAction":{"name":"..."}`.
        var node = new ChipNode(
            Label: "active",
            DismissAction: new ActionDescriptor("chip-remove-42"));
        var json = Serialize<ViewNode>(node);
        // Object shape (open brace after key) — NOT a bare literal.
        Assert.Contains("\"dismissAction\":{", json);
        // Caller-supplied name inside the object.
        Assert.Contains("\"name\":\"chip-remove-42\"", json);
        // Anti-assertion: NOT a boolean value on this key.
        Assert.DoesNotContain("\"dismissAction\":true", json);
        Assert.DoesNotContain("\"dismissAction\":false", json);
    }

    // ─── Action (optional) — WhenWritingNull ────────────────────────────────

    [Fact]
    public void Action_OmittedIsAbsent()
    {
        var node = new ChipNode(Label: "passive");
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"action\"", json);
    }

    [Fact]
    public void Action_SerializesAsActionDescriptor()
    {
        var node = new ChipNode(
            Label: "toggle",
            Action: new ActionDescriptor("chip-toggle-42"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"action\":{", json);
        Assert.Contains("\"name\":\"chip-toggle-42\"", json);
    }

    // ─── Action AND DismissAction coexist ───────────────────────────────────

    [Fact]
    public void Action_AndDismissAction_BothPresent()
    {
        // A filter chip carrying BOTH a whole-chip toggle action AND a
        // dismiss-X action is a first-class shape (the two independent
        // operations pattern per PATTERNS.md §Chip). Both must ride the
        // wire as separate ActionDescriptor objects.
        var node = new ChipNode(
            Label: "both",
            DismissAction: new ActionDescriptor("chip-remove-both"),
            Action: new ActionDescriptor("chip-toggle-both"));
        var json = Serialize<ViewNode>(node);
        // Both keys present as objects.
        Assert.Contains("\"dismissAction\":{", json);
        Assert.Contains("\"action\":{", json);
        // Both caller names ride the wire.
        Assert.Contains("\"name\":\"chip-remove-both\"", json);
        Assert.Contains("\"name\":\"chip-toggle-both\"", json);
    }

    // ─── All fields set — every one lands on the wire ───────────────────────

    [Fact]
    public void AllFieldsSet_AllPresent()
    {
        var node = new ChipNode(
            Label: "everything",
            Tone: Tone.Info,
            Icon: IconName.User,
            DismissAction: new ActionDescriptor("chip-remove-full"),
            Action: new ActionDescriptor("chip-toggle-full"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"chip\"", json);
        Assert.Contains("\"label\":\"everything\"", json);
        Assert.Contains("\"tone\":\"info\"", json);
        Assert.Contains("\"icon\":\"user\"", json);
        Assert.Contains("\"dismissAction\":{", json);
        Assert.Contains("\"action\":{", json);
        Assert.Contains("\"name\":\"chip-remove-full\"", json);
        Assert.Contains("\"name\":\"chip-toggle-full\"", json);
    }

    // ─── Tree-validator: BOTH action slots participate in name uniqueness ───

    [Fact]
    public void TreeValidator_RecordsBothActionAndDismissAction_ForUniqueness()
    {
        // The walker records BOTH DismissAction and Action for name-
        // uniqueness. A chip carrying identity-collision (both slots with
        // the same name outside a form) is rejected at validate-time.
        // This proves the .NET Collect arm descends into both slots.
        var chip = new ChipNode(
            Label: "collision",
            DismissAction: new ActionDescriptor("collide-me"),
            Action: new ActionDescriptor("collide-me"));
        var bad = new ChipListNode(Children: new ViewNode[] { chip });
        var ex = Assert.Throws<InvalidOperationException>(() =>
            ViewTreeValidation.ValidateActionNames(bad));
        Assert.Contains("collide-me", ex.Message);
    }
}
