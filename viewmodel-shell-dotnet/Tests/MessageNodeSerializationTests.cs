// v8.0.0 (COMP-06) — MessageNode wire-shape parity.
//
// Proves the .NET MessageNode record + MessageRole enum + [JsonDerivedType]
// discriminator serialize BYTE-ALIGNED with the TS twin:
//   • MessageRole is a real .NET enum (not `string?`) with a KebabEnum<T>
//     converter → kebab-case wire strings. AGENTS.md closed-union-must-be-enum.
//   • Every optional (Avatar, Timestamp, Role, Actions) carries
//     WhenWritingNull → ABSENT from JSON when unset (not `"avatar": null`),
//     matching the TS absent-never-null contract (AGENTS.md gotcha #8).
//   • The bare `new MessageNode(Author, Content)` serializes as
//     `{"type":"message","author":"…","content":{…}}` — the class-2 findNulls
//     defect the parity gate cannot see, asserted DIRECTLY here.
//   • Nested Avatar (typed ViewNode?) emits the polymorphic `"type":"avatar"`
//     discriminator — the load-bearing "type-as-ViewNode-not-narrow" rule.
//   • Actions[] each carry `"type":"button"` discriminators.
//
// Mirrors AvatarNodeSerializationTests.cs — uses JsonSerializerOptions with
// camelCase only (no host DefaultIgnoreCondition), to prove the [JsonIgnore]
// attributes carry the contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class MessageNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void MessageNode_SerializesTypeAsMessage()
    {
        var node = new MessageNode(Author: "Ada", Content: new TextNode("Hi"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"message\"", json);
    }

    // ─── Class-2 findNulls defect protection (gotcha #8) ────────────────────

    [Fact]
    public void MessageNode_BareRequiredOnly_OnlyRequiredFieldsPresent()
    {
        // Author + Content are REQUIRED; every optional MUST be absent from
        // JSON (not serialized as null). Any regression here is exactly the
        // class-2 defect the parity gate's `normalize.ts` silently strips
        // before diffing (AGENTS.md gotcha #8).
        var node = new MessageNode(Author: "Ada", Content: new TextNode("Hi"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"message\"", json);
        Assert.Contains("\"author\":\"Ada\"", json);
        Assert.Contains("\"content\":{", json);
        Assert.DoesNotContain("\"avatar\"", json);
        Assert.DoesNotContain("\"timestamp\"", json);
        Assert.DoesNotContain("\"role\"", json);
        Assert.DoesNotContain("\"actions\"", json);
    }

    // ─── MessageRole enum kebab-case round-trip ─────────────────────────────

    [Fact]
    public void MessageRole_User_SerializesAsKebabUser()
    {
        var node = new MessageNode(Author: "A", Content: new TextNode("hi"), Role: MessageRole.User);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"role\":\"user\"", json);
    }

    [Fact]
    public void MessageRole_Assistant_SerializesAsKebabAssistant()
    {
        var node = new MessageNode(Author: "A", Content: new TextNode("hi"), Role: MessageRole.Assistant);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"role\":\"assistant\"", json);
    }

    [Fact]
    public void MessageRole_System_SerializesAsKebabSystem()
    {
        var node = new MessageNode(Author: "A", Content: new TextNode("hi"), Role: MessageRole.System);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"role\":\"system\"", json);
    }

    [Fact]
    public void MessageRole_Omitted_IsAbsent()
    {
        var node = new MessageNode(Author: "A", Content: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"role\"", json);
    }

    // ─── Polymorphic slot emission (Avatar, Content, Actions[]) ─────────────

    [Fact]
    public void Avatar_Set_SerializesPolymorphically()
    {
        // Avatar is typed ViewNode? on the record — proves the discriminator
        // still lands. If someone accidentally narrowed to AvatarNode?, the
        // .NET compiler would still accept it but the "type":"avatar"
        // discriminator would vanish (the AGENTS.md polymorphic-slot rule).
        var node = new MessageNode(
            Author: "A",
            Content: new TextNode("hi"),
            Avatar: new AvatarNode(Initials: "AL"));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"avatar\":{", json);
        Assert.Contains("\"type\":\"avatar\"", json);
        Assert.Contains("\"initials\":\"AL\"", json);
    }

    [Fact]
    public void Content_ViewNode_SerializesPolymorphically()
    {
        // Content is REQUIRED ViewNode — the string-lift convenience is TS-only;
        // the .NET server wraps in a real TextNode. The discriminator is
        // "type":"text".
        var node = new MessageNode(
            Author: "A",
            Content: new TextNode("Hello", Style: TextStyle.Body));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"content\":{", json);
        Assert.Contains("\"type\":\"text\"", json);
        Assert.Contains("\"value\":\"Hello\"", json);
    }

    [Fact]
    public void Actions_SerializesAsPolymorphicArray()
    {
        var node = new MessageNode(
            Author: "A",
            Content: new TextNode("hi"),
            Actions: new[]
            {
                new ButtonNode(Label: "OK", Action: new ActionDescriptor("msg-ok")),
                new ButtonNode(Label: "Dismiss", Action: new ActionDescriptor("msg-dismiss")),
            });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"actions\":[", json);
        Assert.Contains("\"type\":\"button\"", json);
        Assert.Contains("\"label\":\"OK\"", json);
        Assert.Contains("\"label\":\"Dismiss\"", json);
    }

    // ─── Field-presence coverage — each optional individually ───────────────

    [Fact]
    public void Timestamp_Present_WhenSet()
    {
        var node = new MessageNode(Author: "A", Content: new TextNode("hi"), Timestamp: "2:14 PM");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"timestamp\":\"2:14 PM\"", json);
    }

    [Fact]
    public void Timestamp_Omitted_IsAbsent()
    {
        var node = new MessageNode(Author: "A", Content: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"timestamp\"", json);
    }

    [Fact]
    public void Avatar_Omitted_IsAbsent()
    {
        var node = new MessageNode(Author: "A", Content: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"avatar\"", json);
    }

    [Fact]
    public void Actions_Omitted_IsAbsent()
    {
        var node = new MessageNode(Author: "A", Content: new TextNode("hi"));
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"actions\"", json);
    }

    // ─── Full-serialize proof ────────────────────────────────────────────────

    [Fact]
    public void MessageNode_AllFieldsSet_AllPresent()
    {
        var node = new MessageNode(
            Author: "Ada Lovelace",
            Content: new TextNode("Can we ship v8 this week?", Style: TextStyle.Body),
            Avatar: new AvatarNode(Initials: "AL", Tone: Tone.Success),
            Timestamp: "2:14 PM",
            Role: MessageRole.User,
            Actions: new[]
            {
                new ButtonNode(Label: "Reply", Action: new ActionDescriptor("msg-reply-42")),
            });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"message\"", json);
        Assert.Contains("\"author\":\"Ada Lovelace\"", json);
        Assert.Contains("\"content\":{", json);
        Assert.Contains("\"type\":\"text\"", json);
        Assert.Contains("\"avatar\":{", json);
        Assert.Contains("\"type\":\"avatar\"", json);
        Assert.Contains("\"timestamp\":\"2:14 PM\"", json);
        Assert.Contains("\"role\":\"user\"", json);
        Assert.Contains("\"actions\":[", json);
        Assert.Contains("\"label\":\"Reply\"", json);
    }
}
