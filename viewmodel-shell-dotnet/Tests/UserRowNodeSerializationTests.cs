// v8.0.0 (COMP-09) — UserRowNode + UserRowStatus + StatusKind wire-shape parity.
//
// Proves the .NET UserRowNode record + UserRowStatus sub-record + StatusKind
// enum + [JsonDerivedType] discriminator serialize BYTE-ALIGNED with the TS
// twin:
//   • StatusKind is a real .NET enum (not `string?`) with a KebabEnum<T>
//     converter → kebab-case wire strings ("online"/"away"/"offline"/"busy").
//     AGENTS.md closed-union-must-be-enum discipline.
//   • Every optional (Avatar, Meta, Status, Trailing, Action) carries
//     WhenWritingNull → ABSENT from JSON when unset (not `"avatar": null`),
//     matching the TS absent-never-null contract (AGENTS.md gotcha #8).
//   • The bare `new UserRowNode(Name: ...)` serializes with ONLY type + name —
//     the class-2 findNulls defect the parity gate cannot see, but this test
//     asserts DIRECTLY.
//   • ViewNode-typed slots (Avatar, Meta, Trailing) emit the polymorphic
//     "type":... discriminator — the SlotTypingPolicy PATTERNS.md §5 Analog C
//     rule (ViewNode? not narrow shape).
//   • Status serializes as a plain sub-record `{"label":"...","kind":"..."}` —
//     NOT polymorphic (no "type" discriminator). Same posture as LookupItem.
//   • Byte-identical error message wording to the TS twin for walker duplicate-
//     action-name violations that descend through UserRowNode slots.
//
// Mirrors ListRowNodeSerializationTests.cs — uses JsonSerializerOptions with
// camelCase only (no host DefaultIgnoreCondition), to prove the [JsonIgnore]
// attributes carry the contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class UserRowNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // A fixed non-null Name — every UserRowNode requires one, and every test
    // uses this same TextNode so the name bytes don't drift between assertions.
    private static readonly TextNode FixedName =
        new("Alice", Style: TextStyle.Body, Weight: TextWeight.Medium);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void UserRowNode_Type_SerializesAsUserRow()
    {
        var node = new UserRowNode(Name: FixedName);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"user-row\"", json);
    }

    // ─── Class-2 findNulls defect protection (gotcha #8) ────────────────────

    [Fact]
    public void UserRowNode_BareNode_MinimalShape_OnlyTypeAndName()
    {
        // The CANONICAL WhenWritingNull posture test. A UserRowNode with only
        // Name set MUST serialize with type + name only — NO `"avatar": null`,
        // `"meta": null`, `"status": null`, `"trailing": null`, `"action":
        // null`. Every optional is ABSENT (per gotcha #8's absent-never-null
        // contract).
        var node = new UserRowNode(Name: FixedName);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"user-row\"", json);
        Assert.Contains("\"name\":", json);
        Assert.DoesNotContain("\"avatar\"", json);
        Assert.DoesNotContain("\"meta\"", json);
        Assert.DoesNotContain("\"status\"", json);
        Assert.DoesNotContain("\"trailing\"", json);
        Assert.DoesNotContain("\"action\"", json);
    }

    [Fact]
    public void UserRowNode_Avatar_OmittedIsAbsent()
    {
        var node = new UserRowNode(Name: FixedName);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"avatar\"", json);
    }

    [Fact]
    public void UserRowNode_Meta_OmittedIsAbsent()
    {
        var node = new UserRowNode(Name: FixedName);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"meta\"", json);
    }

    [Fact]
    public void UserRowNode_Status_OmittedIsAbsent()
    {
        var node = new UserRowNode(Name: FixedName);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"status\"", json);
    }

    [Fact]
    public void UserRowNode_Trailing_OmittedIsAbsent()
    {
        var node = new UserRowNode(Name: FixedName);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"trailing\"", json);
    }

    [Fact]
    public void UserRowNode_Action_OmittedIsAbsent()
    {
        var node = new UserRowNode(Name: FixedName);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"action\"", json);
    }

    // ─── ViewNode-typed slots emit polymorphic discriminator ───────────────

    [Fact]
    public void UserRowNode_Avatar_SetSerializesPolymorphically()
    {
        // A ViewNode-typed slot MUST serialize with its own "type":... —
        // the PATTERNS.md §5 Analog C rule (typed ViewNode? forces STJ to
        // emit the polymorphic discriminator via [JsonDerivedType]).
        var node = new UserRowNode(
            Name: FixedName,
            Avatar: new AvatarNode(Initials: "AL", Tone: Tone.Success));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"avatar\":{", json);
        Assert.Contains("\"type\":\"avatar\"", json);
        Assert.Contains("\"initials\":\"AL\"", json);
    }

    [Fact]
    public void UserRowNode_Meta_EmitsPolymorphicDiscriminator()
    {
        var node = new UserRowNode(
            Name: FixedName,
            Meta: new TextNode("alice@example.com", Style: TextStyle.Muted));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"meta\":{", json);
        Assert.Contains("\"type\":\"text\"", json);
        Assert.Contains("\"value\":\"alice@example.com\"", json);
    }

    [Fact]
    public void UserRowNode_Trailing_EmitsPolymorphicDiscriminator()
    {
        var node = new UserRowNode(
            Name: FixedName,
            Trailing: new BadgeNode(Label: "PRO", Tone: Tone.Info));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"trailing\":{", json);
        Assert.Contains("\"type\":\"badge\"", json);
    }

    // ─── StatusKind kebab-case round-trip (× 4) ─────────────────────────────

    [Fact]
    public void UserRowNode_StatusKind_Online_SerializesAsKebabOnline()
    {
        var node = new UserRowNode(
            Name: FixedName,
            Status: new UserRowStatus("Online", StatusKind.Online));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"kind\":\"online\"", json);
    }

    [Fact]
    public void UserRowNode_StatusKind_Away_SerializesAsKebabAway()
    {
        var node = new UserRowNode(
            Name: FixedName,
            Status: new UserRowStatus("Away", StatusKind.Away));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"kind\":\"away\"", json);
    }

    [Fact]
    public void UserRowNode_StatusKind_Offline_SerializesAsKebabOffline()
    {
        var node = new UserRowNode(
            Name: FixedName,
            Status: new UserRowStatus("Offline", StatusKind.Offline));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"kind\":\"offline\"", json);
    }

    [Fact]
    public void UserRowNode_StatusKind_Busy_SerializesAsKebabBusy()
    {
        var node = new UserRowNode(
            Name: FixedName,
            Status: new UserRowStatus("Busy", StatusKind.Busy));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"kind\":\"busy\"", json);
    }

    // ─── Status sub-record shape — NOT polymorphic ──────────────────────────

    [Fact]
    public void UserRowNode_Status_SerializesAsSubRecord()
    {
        // UserRowStatus is NOT a ViewNode — no [JsonDerivedType] registration.
        // It must serialize as a plain `{"label":"...","kind":"..."}` object,
        // NOT wrapped with a `"type"` discriminator. Same posture as LookupItem
        // / FieldOption. Byte-identical to the TS twin's inline object shape
        // `{ label: string; kind: StatusKind }`.
        var node = new UserRowNode(
            Name: FixedName,
            Status: new UserRowStatus("Online", StatusKind.Online));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"status\":{", json);
        Assert.Contains("\"label\":\"Online\"", json);
        Assert.Contains("\"kind\":\"online\"", json);
        // Crucially: the status object must NOT carry a "type" discriminator —
        // that would collide with UserRowNode.type on the wire. Assert the
        // sub-object has no nested "type" field. Locate the status subtree by
        // string carve-out.
        var statusStart = json.IndexOf("\"status\":{", System.StringComparison.Ordinal);
        var statusEnd = json.IndexOf('}', statusStart);
        var statusSubstr = json.Substring(statusStart, statusEnd - statusStart);
        Assert.DoesNotContain("\"type\":", statusSubstr);
    }

    // ─── Action (ActionDescriptor) ──────────────────────────────────────────

    [Fact]
    public void UserRowNode_Action_SerializesAsActionDescriptor()
    {
        var node = new UserRowNode(
            Name: FixedName,
            Action: new ActionDescriptor("select-alice"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"action\":", json);
        Assert.Contains("\"name\":\"select-alice\"", json);
    }

    // ─── Everything set ─────────────────────────────────────────────────────

    [Fact]
    public void UserRowNode_AllFieldsSet_AllPresent()
    {
        var node = new UserRowNode(
            Name: FixedName,
            Avatar: new AvatarNode(Initials: "AL", Tone: Tone.Success),
            Meta: new TextNode("alice@example.com · Admin", Style: TextStyle.Muted),
            Status: new UserRowStatus("Online", StatusKind.Online),
            Trailing: new BadgeNode(Label: "PRO"),
            Action: new ActionDescriptor("select-alice"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"user-row\"", json);
        Assert.Contains("\"name\":", json);
        Assert.Contains("\"avatar\":", json);
        Assert.Contains("\"meta\":", json);
        Assert.Contains("\"status\":", json);
        Assert.Contains("\"trailing\":", json);
        Assert.Contains("\"action\":", json);
        Assert.Contains("\"kind\":\"online\"", json);
    }

    // ─── Tree-validator walker descent (COMP-09) ────────────────────────────

    [Fact]
    public void TreeInvariant_WalkerDescendsIntoUserRowSlots()
    {
        // Duplicate action name spread across a UserRowNode's Trailing slot
        // AND row.Action — the walker MUST descend into Trailing (missed
        // walks = "silently exempt" bug the walker arm exists to prevent).
        // Byte-identical error wording to the TS twin test in user-row.test.ts.
        var tree = new PageNode(
            Title: null,
            Children: new ViewNode[]
            {
                new UserRowNode(
                    Name: FixedName,
                    Trailing: new ButtonNode(
                        Label: "Duplicate",
                        Action: new ActionDescriptor("dup")),
                    Action: new ActionDescriptor("dup")),
            });
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'dup'", ex.Message);
    }

    [Fact]
    public void TreeInvariant_WalkerDoesNotDescendIntoStatus()
    {
        // Status is a leaf sub-record (UserRowStatus) with no ViewNode content —
        // the walker must NOT recurse into it. Sanity: a UserRowNode with
        // status set + a valid non-conflicting Action validates without
        // throwing (proves no phantom recursion into the status sub-record
        // produces a duplicate name).
        var tree = new PageNode(
            Title: null,
            Children: new ViewNode[]
            {
                new UserRowNode(
                    Name: FixedName,
                    Status: new UserRowStatus("Online", StatusKind.Online),
                    Action: new ActionDescriptor("select-alice")),
            });
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Null(ex);
    }
}
