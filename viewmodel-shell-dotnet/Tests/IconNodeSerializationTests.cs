// v7.0.0 (ICON-01/04) — IconNode + host Icon? prop wire-shape parity.
//
// Proves the .NET IconNode record + IconName enum + host Icon? properties
// serialize BYTE-ALIGNED with the TS twin (Plan 22-01):
//   • IconName is a real .NET enum (not `string?`) with a KebabEnum<T>
//     converter → kebab-case wire strings. AGENTS.md gotcha #8/#9 discipline.
//   • Optionals on IconNode (Size, Tone, Label) carry WhenWritingNull →
//     ABSENT from JSON when unset (not `"size": null`), matching the TS
//     absent-never-null contract.
//   • Cross-node Icon? on ButtonNode, LinkNode, SectionNode, BadgeNode,
//     ListItemNode carries the same WhenWritingNull posture.
//
// Mirrors DiffNodeSerializationTests / NavNodeSerializationTests / etc. — uses
// JsonSerializerOptions with camelCase only (no host DefaultIgnoreCondition),
// to prove the [JsonIgnore] attributes carry the contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class IconNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── IconNode discriminator + name kebab-case ────────────────────────────

    [Fact]
    public void IconNode_SerializesTypeAsIcon()
    {
        var node = new IconNode(IconName.Sparkles);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"icon\"", json);
    }

    [Fact]
    public void IconNode_SingleWordName_SerializesAsLowercase()
    {
        // Sparkles → "sparkles" (simple single-word case).
        var node = new IconNode(IconName.Sparkles);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"name\":\"sparkles\"", json);
    }

    [Fact]
    public void IconNode_MultiWordName_SerializesAsKebabCase()
    {
        // ShieldCheck → "shield-check" (multi-word kebab).
        var node = new IconNode(IconName.ShieldCheck);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"name\":\"shield-check\"", json);
    }

    [Fact]
    public void IconNode_NumberSuffixedName_SerializesAsKebabCase()
    {
        // Trash2 → "trash-2" (number-suffixed name, KebabCaseLower policy
        // treats digits as word boundaries).
        var node = new IconNode(IconName.Trash2);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"name\":\"trash-2\"", json);
    }

    [Fact]
    public void IconNode_AllEightHestiaAnchors_SerializeAsKebabCase()
    {
        // Spot-check every Pixie/Hestia concept anchor crosses as the exact
        // literal Lucide name — these are the load-bearing 8 for the Hestia
        // launcher card grid.
        Assert.Contains("\"name\":\"sparkles\"", Serialize<ViewNode>(new IconNode(IconName.Sparkles)));
        Assert.Contains("\"name\":\"wrench\"", Serialize<ViewNode>(new IconNode(IconName.Wrench)));
        Assert.Contains("\"name\":\"shield-check\"", Serialize<ViewNode>(new IconNode(IconName.ShieldCheck)));
        Assert.Contains("\"name\":\"route\"", Serialize<ViewNode>(new IconNode(IconName.Route)));
        Assert.Contains("\"name\":\"book-open\"", Serialize<ViewNode>(new IconNode(IconName.BookOpen)));
        Assert.Contains("\"name\":\"activity\"", Serialize<ViewNode>(new IconNode(IconName.Activity)));
        Assert.Contains("\"name\":\"workflow\"", Serialize<ViewNode>(new IconNode(IconName.Workflow)));
        Assert.Contains("\"name\":\"receipt\"", Serialize<ViewNode>(new IconNode(IconName.Receipt)));
    }

    // ─── WhenWritingNull posture on IconNode optionals (gotcha #8) ────────────

    [Fact]
    public void IconNode_MinimalShape_OmittedOptionalsAreAbsent()
    {
        // Only Name is required. Size, Tone, Label absent — MUST NOT appear
        // in the JSON.
        var node = new IconNode(IconName.Sparkles);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"size\"", json);
        Assert.DoesNotContain("\"tone\"", json);
        Assert.DoesNotContain("\"label\"", json);
    }

    [Fact]
    public void IconNode_SizePresent_WhenSet()
    {
        var node = new IconNode(IconName.Sparkles, Size: IconSize.Xl);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"size\":\"xl\"", json);
    }

    [Fact]
    public void IconNode_SizeXs_KebabCasesToXs()
    {
        // Every size member serializes as its kebab-lowercase wire value.
        Assert.Contains("\"size\":\"xs\"", Serialize<ViewNode>(new IconNode(IconName.Sparkles, Size: IconSize.Xs)));
        Assert.Contains("\"size\":\"sm\"", Serialize<ViewNode>(new IconNode(IconName.Sparkles, Size: IconSize.Sm)));
        Assert.Contains("\"size\":\"md\"", Serialize<ViewNode>(new IconNode(IconName.Sparkles, Size: IconSize.Md)));
        Assert.Contains("\"size\":\"lg\"", Serialize<ViewNode>(new IconNode(IconName.Sparkles, Size: IconSize.Lg)));
        Assert.Contains("\"size\":\"xl\"", Serialize<ViewNode>(new IconNode(IconName.Sparkles, Size: IconSize.Xl)));
    }

    [Fact]
    public void IconNode_TonePresent_WhenSet()
    {
        var node = new IconNode(IconName.Trash2, Tone: Tone.Danger);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"danger\"", json);
    }

    [Fact]
    public void IconNode_LabelPresent_WhenSet()
    {
        var node = new IconNode(IconName.Trash2, Label: "Delete");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"label\":\"Delete\"", json);
    }

    [Fact]
    public void IconNode_AllFieldsSet_AllPresent()
    {
        var node = new IconNode(
            Name: IconName.Sparkles,
            Size: IconSize.Xl,
            Tone: Tone.Danger,
            Label: "Delete");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"name\":\"sparkles\"", json);
        Assert.Contains("\"size\":\"xl\"", json);
        Assert.Contains("\"tone\":\"danger\"", json);
        Assert.Contains("\"label\":\"Delete\"", json);
    }

    // ─── Cross-node Icon? on 5 hosts (ICON-04) ──────────────────────────────

    [Fact]
    public void ButtonNode_IconPresent_SerializesAsKebab()
    {
        var btn = new ButtonNode(
            Label: "Sparkle",
            Action: new ActionDescriptor("sparkle"),
            Icon: IconName.Sparkles);
        var json = Serialize<ViewNode>(btn);
        Assert.Contains("\"icon\":\"sparkles\"", json);
    }

    [Fact]
    public void ButtonNode_IconAbsent_OmittedFromWire()
    {
        // Regression guard for WhenWritingNull on the cross-node Icon? prop.
        var btn = new ButtonNode("Save", new ActionDescriptor("save"));
        var json = Serialize<ViewNode>(btn);
        Assert.DoesNotContain("\"icon\"", json);
    }

    [Fact]
    public void LinkNode_IconPresent_SerializesAsKebab()
    {
        var link = new LinkNode(
            Label: "Open docs",
            Href: "/docs",
            Icon: IconName.ExternalLink);
        var json = Serialize<ViewNode>(link);
        Assert.Contains("\"icon\":\"external-link\"", json);
    }

    [Fact]
    public void LinkNode_IconAbsent_OmittedFromWire()
    {
        var link = new LinkNode(Label: "Home", Href: "/");
        var json = Serialize<ViewNode>(link);
        Assert.DoesNotContain("\"icon\"", json);
    }

    [Fact]
    public void SectionNode_IconPresent_SerializesAsKebab()
    {
        // The Hestia use case — Section with variant:card + concept-anchor icon.
        var section = new SectionNode(
            Heading: "Metis",
            Children: new List<ViewNode>(),
            Variant: SectionVariant.Card,
            Icon: IconName.Workflow);
        var json = Serialize<ViewNode>(section);
        Assert.Contains("\"icon\":\"workflow\"", json);
    }

    [Fact]
    public void SectionNode_IconAbsent_OmittedFromWire()
    {
        var section = new SectionNode(
            Heading: null,
            Children: new List<ViewNode>());
        var json = Serialize<ViewNode>(section);
        Assert.DoesNotContain("\"icon\"", json);
    }

    [Fact]
    public void BadgeNode_IconPresent_SerializesAsKebab()
    {
        var badge = new BadgeNode(
            Label: "OK",
            Tone: Tone.Success,
            Icon: IconName.CheckCircle);
        var json = Serialize<ViewNode>(badge);
        Assert.Contains("\"icon\":\"check-circle\"", json);
    }

    [Fact]
    public void BadgeNode_IconAbsent_OmittedFromWire()
    {
        var badge = new BadgeNode(Label: "New");
        var json = Serialize<ViewNode>(badge);
        Assert.DoesNotContain("\"icon\"", json);
    }

    [Fact]
    public void ListItemNode_IconPresent_SerializesAsKebab()
    {
        var item = new ListItemNode(
            Id: null,
            State: null,
            Children: new List<ViewNode>(),
            Icon: IconName.Folder);
        var json = Serialize<ViewNode>(item);
        Assert.Contains("\"icon\":\"folder\"", json);
    }

    [Fact]
    public void ListItemNode_IconAbsent_OmittedFromWire()
    {
        var item = new ListItemNode(
            Id: null,
            State: null,
            Children: new List<ViewNode>());
        var json = Serialize<ViewNode>(item);
        Assert.DoesNotContain("\"icon\"", json);
    }
}
