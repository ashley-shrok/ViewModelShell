// v8.0.0 (COMP-04) — AvatarNode wire-shape parity.
//
// Proves the .NET AvatarNode record + AvatarSize enum + [JsonDerivedType]
// discriminator serialize BYTE-ALIGNED with the TS twin:
//   • AvatarSize is a real .NET enum (not `string?`) with a KebabEnum<T>
//     converter → kebab-case wire strings. AGENTS.md closed-union-must-be-enum.
//   • Every optional (Initials, Image, Icon, Size, Tone, Alt) carries
//     WhenWritingNull → ABSENT from JSON when unset (not `"initials": null`),
//     matching the TS absent-never-null contract (AGENTS.md gotcha #8).
//   • The bare `new AvatarNode()` serializes as `{"type":"avatar"}` — the
//     class-2 findNulls defect the parity gate cannot see, but this test
//     asserts DIRECTLY.
//   • Reused enums (IconName, Tone) round-trip kebab-case correctly on this
//     node too.
//
// Mirrors IconNodeSerializationTests.cs — uses JsonSerializerOptions with
// camelCase only (no host DefaultIgnoreCondition), to prove the [JsonIgnore]
// attributes carry the contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class AvatarNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void AvatarNode_SerializesTypeAsAvatar()
    {
        var node = new AvatarNode(Initials: "AL");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"avatar\"", json);
    }

    // ─── Class-2 findNulls defect protection (gotcha #8) ────────────────────

    [Fact]
    public void AvatarNode_BareNode_SerializesOnlyType()
    {
        // The CANONICAL WhenWritingNull posture test. A `new AvatarNode()` with
        // every field absent MUST serialize as `{"type":"avatar"}` — NOT
        // `{"type":"avatar","initials":null,"image":null,...}`. Any
        // regression here is exactly the class-2 defect the parity gate's
        // `normalize.ts` silently strips before diffing (AGENTS.md gotcha #8).
        var node = new AvatarNode();
        var json = Serialize<ViewNode>(node);
        Assert.Equal("{\"type\":\"avatar\"}", json);
    }

    [Fact]
    public void AvatarNode_MinimalShape_OmittedOptionalsAreAbsent()
    {
        // Setting Initials only — Image, Icon, Size, Tone, Alt MUST all be
        // absent from the JSON (not serialized as null).
        var node = new AvatarNode(Initials: "AL");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"initials\":\"AL\"", json);
        Assert.DoesNotContain("\"image\"", json);
        Assert.DoesNotContain("\"icon\"", json);
        Assert.DoesNotContain("\"size\"", json);
        Assert.DoesNotContain("\"tone\"", json);
        Assert.DoesNotContain("\"alt\"", json);
    }

    // ─── AvatarSize enum kebab-case round-trip ──────────────────────────────

    [Fact]
    public void AvatarSize_KebabEnum_EachMemberRoundTrips()
    {
        // Every AvatarSize member serializes as its lowercase-kebab wire value.
        Assert.Contains("\"size\":\"sm\"", Serialize<ViewNode>(new AvatarNode(Size: AvatarSize.Sm)));
        Assert.Contains("\"size\":\"md\"", Serialize<ViewNode>(new AvatarNode(Size: AvatarSize.Md)));
        Assert.Contains("\"size\":\"lg\"", Serialize<ViewNode>(new AvatarNode(Size: AvatarSize.Lg)));
        Assert.Contains("\"size\":\"xl\"", Serialize<ViewNode>(new AvatarNode(Size: AvatarSize.Xl)));
    }

    [Fact]
    public void AvatarNode_SizeXl_SerializesAsKebab()
    {
        var node = new AvatarNode(Size: AvatarSize.Xl);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"size\":\"xl\"", json);
    }

    // ─── IconName reuse (kebab + multi-word) ────────────────────────────────

    [Fact]
    public void AvatarNode_Icon_SerializesAsKebab()
    {
        // Single-word icon name — proves the shipped IconName enum crosses
        // through AvatarNode's Icon slot without special handling.
        var node = new AvatarNode(Icon: IconName.User);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"user\"", json);
    }

    [Fact]
    public void AvatarNode_MultiWordIcon_SerializesAsKebab()
    {
        // Multi-word icon name — proves the IconNameConverter (Phase 22)
        // continues to handle multi-word / digit-boundary names correctly
        // when consumed via AvatarNode.Icon.
        var node = new AvatarNode(Icon: IconName.ShieldCheck);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"shield-check\"", json);
    }

    // ─── Tone reuse (kebab) ─────────────────────────────────────────────────

    [Fact]
    public void AvatarNode_Tone_SerializesAsKebab()
    {
        // Every Tone member kebab-cases via the shared KebabEnum<Tone>.
        Assert.Contains("\"tone\":\"danger\"",  Serialize<ViewNode>(new AvatarNode(Tone: Tone.Danger)));
        Assert.Contains("\"tone\":\"warning\"", Serialize<ViewNode>(new AvatarNode(Tone: Tone.Warning)));
        Assert.Contains("\"tone\":\"success\"", Serialize<ViewNode>(new AvatarNode(Tone: Tone.Success)));
        Assert.Contains("\"tone\":\"info\"",    Serialize<ViewNode>(new AvatarNode(Tone: Tone.Info)));
    }

    // ─── Field-presence coverage ────────────────────────────────────────────

    [Fact]
    public void AvatarNode_ImagePresent_WhenSet()
    {
        var node = new AvatarNode(Image: "https://example.com/ada.png");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"image\":\"https://example.com/ada.png\"", json);
    }

    [Fact]
    public void AvatarNode_AltPresent_WhenSet()
    {
        var node = new AvatarNode(Initials: "AL", Alt: "Ada Lovelace");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"alt\":\"Ada Lovelace\"", json);
    }

    [Fact]
    public void AvatarNode_AllFieldsSet_AllPresent()
    {
        // Every optional set — every one appears on the wire, correctly
        // kebab-cased where applicable.
        var node = new AvatarNode(
            Initials: "AL",
            Image: "https://example.com/ada.png",
            Icon: IconName.User,
            Size: AvatarSize.Xl,
            Tone: Tone.Success,
            Alt: "Ada Lovelace");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"avatar\"", json);
        Assert.Contains("\"initials\":\"AL\"", json);
        Assert.Contains("\"image\":\"https://example.com/ada.png\"", json);
        Assert.Contains("\"icon\":\"user\"", json);
        Assert.Contains("\"size\":\"xl\"", json);
        Assert.Contains("\"tone\":\"success\"", json);
        Assert.Contains("\"alt\":\"Ada Lovelace\"", json);
    }
}
