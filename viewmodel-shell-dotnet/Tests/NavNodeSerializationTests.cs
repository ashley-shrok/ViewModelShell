// BreadcrumbNode / StepsNode (NAV-01 / NAV-02) — wire-shape serialization parity.
//
// Proves the two .NET nav records serialize BYTE-ALIGNED with the TS optional
// posture (the whole point — gotcha #8):
//   • BreadcrumbItem.Href/Action nullable + WhenWritingNull, External bool +
//     WhenWritingDefault → all three absent when unset; present when set.
//   • StepsNode.Current is a plain required int with NO ignore condition → it
//     ALWAYS serializes, even when 0 (the ProgressNode required-int rule).
//   • StepsNode.Orientation + StepItem.Description nullable + WhenWritingNull →
//     absent when unset, present when set.
// Plus a validation assertion proving the Collect breadcrumb arm is wired:
// two crumbs sharing an action name are rejected (invalid_tree).
//
// Uses JsonSerializerOptions with camelCase only (no host DefaultIgnoreCondition),
// matching ChartNodeSerializationTests, to prove the attributes carry the
// contract intrinsically. Wire-shape only — no rendering is tested here.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class NavNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── discriminators ─────────────────────────────────────────────────────

    [Fact]
    public void BreadcrumbNode_SerializesTypeAsBreadcrumb()
    {
        var node = new BreadcrumbNode(new[] { new BreadcrumbItem("Home") });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"breadcrumb\"", json);
    }

    [Fact]
    public void StepsNode_SerializesTypeAsSteps()
    {
        var node = new StepsNode(new[] { new StepItem("One") }, Current: 0);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"steps\"", json);
    }

    // ─── crumb: omitted optional fields absent ──────────────────────────────

    [Fact]
    public void BreadcrumbItem_OmittedFields_AreAbsent()
    {
        // A current (last) crumb: no href, no external, no action.
        var node = new BreadcrumbNode(new[] { new BreadcrumbItem("Current Page") });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"label\":\"Current Page\"", json);
        Assert.DoesNotContain("\"href\"", json);
        Assert.DoesNotContain("\"external\"", json);
        Assert.DoesNotContain("\"action\"", json);
    }

    // ─── crumb: present optional fields all emit ────────────────────────────

    [Fact]
    public void BreadcrumbItem_AllFieldsSet_EmitsHrefExternalAction()
    {
        var node = new BreadcrumbNode(new[]
        {
            new BreadcrumbItem(
                "Docs",
                Href: "/docs",
                External: true,
                Action: new ActionDescriptor("go-docs")),
        });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"href\":\"/docs\"", json);
        Assert.Contains("\"external\":true", json);
        Assert.Contains("\"action\":{", json);
        Assert.Contains("\"name\":\"go-docs\"", json);
    }

    // ─── steps: Current ALWAYS serializes, even at 0 ────────────────────────

    [Fact]
    public void StepsNode_CurrentZero_StillSerializes()
    {
        var node = new StepsNode(
            new[] { new StepItem("First"), new StepItem("Second") },
            Current: 0);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"current\":0", json);
    }

    [Fact]
    public void StepsNode_CurrentNonZero_Serializes()
    {
        var node = new StepsNode(
            new[] { new StepItem("First"), new StepItem("Second") },
            Current: 1);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"current\":1", json);
    }

    // ─── steps: orientation omitted-vs-present ──────────────────────────────

    [Fact]
    public void StepsNode_Orientation_DefaultNull_IsAbsent()
    {
        var node = new StepsNode(new[] { new StepItem("A") }, Current: 0);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"orientation\"", json);
    }

    [Fact]
    public void StepsNode_Orientation_Vertical_Serializes()
    {
        var node = new StepsNode(
            new[] { new StepItem("A") },
            Current: 0,
            Orientation: Orientation.Vertical);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"orientation\":\"vertical\"", json);
    }

    // ─── step: description omitted-vs-present ────────────────────────────────

    [Fact]
    public void StepItem_Description_DefaultNull_IsAbsent()
    {
        var node = new StepsNode(new[] { new StepItem("Ship") }, Current: 0);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"description\"", json);
    }

    [Fact]
    public void StepItem_Description_Set_Serializes()
    {
        var node = new StepsNode(
            new[] { new StepItem("Ship", Description: "final stage") },
            Current: 0);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"description\":\"final stage\"", json);
    }

    // ─── step: tone omitted-vs-present (6.0.0) ──────────────────────────────

    [Fact]
    public void StepItem_Tone_DefaultNull_IsAbsent()
    {
        var node = new StepsNode(new[] { new StepItem("Deploy") }, Current: 0);
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"tone\"", json);
    }

    [Fact]
    public void StepItem_Tone_Set_SerializesKebab()
    {
        var node = new StepsNode(
            new[] { new StepItem("Deploy", Tone: Tone.Danger) },
            Current: 0);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"danger\"", json);
    }

    // ─── stat bar: value is a STRING, tone omitted-vs-present (6.0.0) ────────

    [Fact]
    public void StatBarNode_SerializesTypeAsStatBar()
    {
        var node = new StatBarNode(new[] { new StatItem("active", "12") });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"stat-bar\"", json);
    }

    [Fact]
    public void StatItem_Value_SerializesAsJsonString_NotBareNumber()
    {
        // The narrowing that motivated 6.0.0: value crosses as "12", never 12,
        // so the TS twin (string) and this record emit byte-identical wire.
        var node = new StatBarNode(new[] { new StatItem("active", "12") });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"value\":\"12\"", json);
        Assert.DoesNotContain("\"value\":12", json);
    }

    [Fact]
    public void StatItem_Tone_DefaultNull_IsAbsent()
    {
        var node = new StatBarNode(new[] { new StatItem("active", "12") });
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"tone\"", json);
    }

    [Fact]
    public void StatItem_Tone_Set_SerializesKebab()
    {
        var node = new StatBarNode(new[] { new StatItem("failing", "3", Tone: Tone.Danger) });
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"tone\":\"danger\"", json);
    }

    // ─── Collect descends into crumb actions (uniqueness enforced) ──────────

    [Fact]
    public void Breadcrumb_DuplicateCrumbActionNames_Throws()
    {
        var node = new BreadcrumbNode(new[]
        {
            new BreadcrumbItem("A", Action: new ActionDescriptor("nav")),
            new BreadcrumbItem("B", Action: new ActionDescriptor("nav")),
        });
        var tree = new PageNode(Title: null, Children: new ViewNode[] { node });
        var ex = Assert.Throws<InvalidOperationException>(
            () => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Contains("Duplicate action name 'nav'", ex.Message);
    }

    [Fact]
    public void Breadcrumb_HrefOnlyCrumbs_RecordNoActions_Passes()
    {
        var node = new BreadcrumbNode(new[]
        {
            new BreadcrumbItem("Home", Href: "/"),
            new BreadcrumbItem("Docs", Href: "/docs"),
            new BreadcrumbItem("Current"),
        });
        var tree = new PageNode(Title: null, Children: new ViewNode[] { node });
        var ex = Record.Exception(() => ViewTreeValidation.ValidateActionNames(tree));
        Assert.Null(ex);
    }
}
