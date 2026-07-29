// v8.0.0 (COMP-05 + COMP-05a) — ListRowNode + ListNode.Variant wire-shape parity.
//
// Proves the .NET ListRowNode record + ListVariant enum + [JsonDerivedType]
// discriminator serialize BYTE-ALIGNED with the TS twin:
//   • ListVariant is a real .NET enum (not `string?`) with a KebabEnum<T>
//     converter → kebab-case wire strings. AGENTS.md closed-union-must-be-enum.
//   • Every optional (Leading, Secondary, Meta, Trailing, Tone, State, Action)
//     carries WhenWritingNull → ABSENT from JSON when unset (not
//     `"leading": null`), matching the TS absent-never-null contract (AGENTS.md
//     gotcha #8).
//   • The bare `new ListRowNode(Primary: ...)` serializes with ONLY type +
//     primary — the class-2 findNulls defect the parity gate cannot see, but
//     this test asserts DIRECTLY.
//   • ViewNode-typed slots (Leading, Secondary, Meta[], Trailing, Action)
//     emit the polymorphic "type":... discriminator — the SlotTypingPolicy
//     PATTERNS.md §5 Analog C recommends (ViewNode? not narrow shape).
//   • ListNode.Variant absent when null (bare ListNode wire is byte-identical
//     to today) — the COMP-05a additive extension does not drift the shipped
//     ListNode.
//   • Tree-invariant validation (Rows accepts only ListRowNode; Items rejects
//     ListRowNode) fires with byte-identical error message wording to the TS
//     twin.
//
// Mirrors AvatarNodeSerializationTests.cs — uses JsonSerializerOptions with
// camelCase only (no host DefaultIgnoreCondition), to prove the [JsonIgnore]
// attributes carry the contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class ListRowNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // A fixed non-null Primary — every ListRowNode requires one, and every
    // test uses this same TextNode so the primary bytes don't drift between
    // assertions.
    private static readonly TextNode FixedPrimary =
        new("Order 42", Style: TextStyle.Body, Weight: TextWeight.Medium);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void ListRowNode_SerializesTypeAsListRow()
    {
        var node = new ListRowNode(Primary: FixedPrimary);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"list-row\"", json);
    }

    // ─── Class-2 findNulls defect protection (gotcha #8) ────────────────────

    [Fact]
    public void ListRowNode_BareNode_MinimalShape_OnlyTypeAndPrimary()
    {
        // The CANONICAL WhenWritingNull posture test. A ListRowNode with only
        // Primary set MUST serialize with type + primary only — NO
        // `"leading": null`, `"secondary": null`, `"meta": null`, `"trailing":
        // null`, `"tone": null`, `"state": null`, `"action": null`. Every
        // optional is ABSENT (per gotcha #8's absent-never-null contract).
        var node = new ListRowNode(Primary: FixedPrimary);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"list-row\"", json);
        Assert.Contains("\"primary\":", json);
        Assert.DoesNotContain("\"leading\"", json);
        Assert.DoesNotContain("\"secondary\"", json);
        Assert.DoesNotContain("\"meta\"", json);
        Assert.DoesNotContain("\"trailing\"", json);
        Assert.DoesNotContain("\"tone\"", json);
        Assert.DoesNotContain("\"state\"", json);
        Assert.DoesNotContain("\"action\"", json);
    }

    [Fact]
    public void ListRowNode_Leading_OmittedIsAbsent()
    {
        var node = new ListRowNode(Primary: FixedPrimary);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"leading\"", json);
    }

    [Fact]
    public void ListRowNode_Secondary_OmittedIsAbsent()
    {
        var node = new ListRowNode(Primary: FixedPrimary);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"secondary\"", json);
    }

    [Fact]
    public void ListRowNode_Meta_OmittedIsAbsent()
    {
        var node = new ListRowNode(Primary: FixedPrimary);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"meta\"", json);
    }

    [Fact]
    public void ListRowNode_Trailing_OmittedIsAbsent()
    {
        var node = new ListRowNode(Primary: FixedPrimary);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"trailing\"", json);
    }

    [Fact]
    public void ListRowNode_Tone_OmittedIsAbsent()
    {
        var node = new ListRowNode(Primary: FixedPrimary);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"tone\"", json);
    }

    [Fact]
    public void ListRowNode_State_OmittedIsAbsent()
    {
        var node = new ListRowNode(Primary: FixedPrimary);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"state\"", json);
    }

    [Fact]
    public void ListRowNode_Action_OmittedIsAbsent()
    {
        var node = new ListRowNode(Primary: FixedPrimary);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"action\"", json);
    }

    // ─── ViewNode-typed slots emit polymorphic discriminator ───────────────

    [Fact]
    public void ListRowNode_Leading_EmitsPolymorphicDiscriminator()
    {
        // A ViewNode-typed slot MUST serialize with its own "type":... —
        // the PATTERNS.md §5 Analog C rule (typed ViewNode? forces STJ to
        // emit the polymorphic discriminator via [JsonDerivedType]).
        var node = new ListRowNode(
            Primary: FixedPrimary,
            Leading: new AvatarNode(Initials: "AL", Tone: Tone.Success));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"leading\":{", json);
        Assert.Contains("\"type\":\"avatar\"", json);
        Assert.Contains("\"initials\":\"AL\"", json);
    }

    [Fact]
    public void ListRowNode_Trailing_EmitsPolymorphicDiscriminator()
    {
        var node = new ListRowNode(
            Primary: FixedPrimary,
            Trailing: new BadgeNode(Label: "DONE", Tone: Tone.Success));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"trailing\":{", json);
        Assert.Contains("\"type\":\"badge\"", json);
    }

    [Fact]
    public void ListRowNode_Meta_SerializesAsPolymorphicArray()
    {
        // Meta is IReadOnlyList<ViewNode>? — each entry serializes with its
        // own type discriminator.
        var node = new ListRowNode(
            Primary: FixedPrimary,
            Meta: new ViewNode[]
            {
                new TextNode("2h ago", Style: TextStyle.Caption),
                new TextNode("channel: web", Style: TextStyle.Caption),
            });
        var json = Serialize<ViewNode>(node);
        // Two array entries — both text-typed.
        Assert.Contains("\"meta\":[", json);
        Assert.Contains("\"value\":\"2h ago\"", json);
        Assert.Contains("\"value\":\"channel: web\"", json);
        // Both entries emit type discriminators via polymorphism.
        var typeCount = json.Split("\"type\":\"text\"").Length - 1;
        Assert.True(typeCount >= 2, $"Expected >= 2 text type discriminators inside meta; got {typeCount}");
    }

    // ─── Tone enum kebab-case round-trip ────────────────────────────────────

    [Fact]
    public void ListRowNode_Tone_Danger_SerializesAsKebabDanger()
    {
        var node = new ListRowNode(Primary: FixedPrimary, Tone: Tone.Danger);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"danger\"", json);
    }

    [Fact]
    public void ListRowNode_Tone_EachMemberRoundTrips()
    {
        Assert.Contains("\"tone\":\"danger\"",  Serialize<ViewNode>(new ListRowNode(FixedPrimary, Tone: Tone.Danger)));
        Assert.Contains("\"tone\":\"warning\"", Serialize<ViewNode>(new ListRowNode(FixedPrimary, Tone: Tone.Warning)));
        Assert.Contains("\"tone\":\"success\"", Serialize<ViewNode>(new ListRowNode(FixedPrimary, Tone: Tone.Success)));
        Assert.Contains("\"tone\":\"info\"",    Serialize<ViewNode>(new ListRowNode(FixedPrimary, Tone: Tone.Info)));
    }

    // ─── State (freeform) round-trip ────────────────────────────────────────

    [Fact]
    public void ListRowNode_State_SerializesAsFreeformString()
    {
        var node = new ListRowNode(Primary: FixedPrimary, State: "high");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"state\":\"high\"", json);
    }

    // ─── Action (ActionDescriptor) ──────────────────────────────────────────

    [Fact]
    public void ListRowNode_Action_SerializesAsActionDescriptor()
    {
        var node = new ListRowNode(
            Primary: FixedPrimary,
            Action: new ActionDescriptor("row-open-42"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"action\":", json);
        Assert.Contains("\"name\":\"row-open-42\"", json);
    }

    // ─── Everything set ─────────────────────────────────────────────────────

    [Fact]
    public void ListRowNode_AllFieldsSet_AllPresent()
    {
        var node = new ListRowNode(
            Primary: FixedPrimary,
            Leading: new AvatarNode(Initials: "AL"),
            Secondary: new TextNode("Second line", Style: TextStyle.Muted),
            Meta: new ViewNode[]
            {
                new TextNode("2h ago", Style: TextStyle.Caption),
            },
            Trailing: new BadgeNode(Label: "OK"),
            Tone: Tone.Warning,
            State: "high",
            Action: new ActionDescriptor("open-42"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"list-row\"", json);
        Assert.Contains("\"leading\":", json);
        Assert.Contains("\"primary\":", json);
        Assert.Contains("\"secondary\":", json);
        Assert.Contains("\"meta\":", json);
        Assert.Contains("\"trailing\":", json);
        Assert.Contains("\"tone\":\"warning\"", json);
        Assert.Contains("\"state\":\"high\"", json);
        Assert.Contains("\"action\":", json);
        Assert.Contains("\"name\":\"open-42\"", json);
    }

    // ─── ListNode.Variant (COMP-05a) ────────────────────────────────────────

    [Fact]
    public void ListNode_Variant_Omitted_IsAbsent()
    {
        // A ListNode built without Variant serializes byte-identical to the
        // pre-Phase-24 shape — no "variant":... field on the wire. Proves the
        // additive extension does not drift the shipped ListNode.
        var node = new ListNode(Children: new List<ViewNode>());
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"list\"", json);
        Assert.DoesNotContain("\"variant\"", json);
    }

    [Fact]
    public void ListNode_Variant_Rows_SerializesAsKebab()
    {
        // Only the LIST is under test here — put a ListRowNode child so the
        // tree-invariant walker (below) would also accept this shape.
        var node = new ListNode(
            Children: new ViewNode[] { new ListRowNode(Primary: FixedPrimary) },
            Variant: ListVariant.Rows);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"variant\":\"rows\"", json);
    }

    [Fact]
    public void ListNode_Variant_Items_SerializesAsKebab()
    {
        var node = new ListNode(
            Children: new List<ViewNode>(),
            Variant: ListVariant.Items);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"variant\":\"items\"", json);
    }

    // ─── Tree-invariant validation (COMP-05a) ───────────────────────────────

    [Fact]
    public void TreeInvariant_ListRows_WithNonListRowChild_ThrowsInvalidTree()
    {
        // ListNode(Variant:Rows) accepts ONLY ListRowNode children. A
        // non-list-row child MUST throw an invalid_tree error — byte-identical
        // wording to the TS twin `case "list"` arm in server.ts.
        var tree = new ListNode(
            Children: new ViewNode[] { new TextNode("sneaky text") },
            Variant: ListVariant.Rows);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("ListNode(variant:\"rows\") accepts only ListRowNode children", ex.Message);
        Assert.Contains("found a \"text\" child", ex.Message);
    }

    [Fact]
    public void TreeInvariant_ListItems_WithListRowChild_ThrowsInvalidTree()
    {
        // The mirror case — ListNode(Variant:Items) or omitted rejects a
        // ListRowNode child (which belongs in a Rows-variant container or
        // standalone).
        var tree = new ListNode(
            Children: new ViewNode[] { new ListRowNode(Primary: FixedPrimary) },
            Variant: ListVariant.Items);
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("ListNode(variant:\"items\") does not accept ListRowNode children", ex.Message);
    }

    [Fact]
    public void TreeInvariant_ListRows_WithListRowChildren_Accepts()
    {
        var tree = new ListNode(
            Children: new ViewNode[]
            {
                new ListRowNode(Primary: FixedPrimary),
                new ListRowNode(Primary: new TextNode("B", Style: TextStyle.Body, Weight: TextWeight.Medium)),
            },
            Variant: ListVariant.Rows);
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Null(ex);
    }

    [Fact]
    public void TreeInvariant_WalkerDescendsIntoListRowSlots()
    {
        // Duplicate action name spread across a ListRowNode's trailing slot
        // AND row.Action — the walker MUST descend into trailing (missed
        // walks = the "silently exempt" bug class the walker arm exists to
        // prevent). Byte-identical to the TS twin test in list-row.test.ts.
        var tree = new PageNode(
            Title: null,
            Children: new ViewNode[]
            {
                new ListRowNode(
                    Primary: FixedPrimary,
                    Trailing: new ButtonNode(
                        Label: "Duplicate",
                        Action: new ActionDescriptor("dup")),
                    Action: new ActionDescriptor("dup")),
            });
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'dup'", ex.Message);
    }
}
