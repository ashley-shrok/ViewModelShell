// v8.2.0 (RICH-01/RICH-02) — RichTextFieldNode + RichTextToolbarNode wire-
// shape parity.
//
// Proves the two new .NET records + two new enums + one new JsonConverter +
// two new [JsonDerivedType] discriminators serialize BYTE-ALIGNED with the TS
// twin (viewmodel-shell/src/index.ts, Plan 28-01):
//   • RichTextTool is a real .NET enum (not `string?`) with a dedicated
//     RichTextToolConverter → digit-boundary-aware kebab-case wire strings
//     ("heading-1", "bullet-list", "inline-code"). AGENTS.md closed-union-
//     must-be-enum + gotcha #9 class-1 defense.
//   • RichTextToolbarSize is a real .NET enum with KebabEnum<T>. Only
//     single-token members (Compact/Expanded) — no digit-boundary hazard.
//   • Every nullable on both records (Label, Placeholder, Toolbar, State on
//     the field; Size, Tone, State on the toolbar) carries
//     WhenWritingNull → ABSENT from JSON when unset (not `"label": null`).
//     AGENTS.md gotcha #8 class-2 defense.
//   • Both optional non-nullable bools on RichTextFieldNode (Required,
//     Disabled) carry WhenWritingDefault → ABSENT when false (matches the TS
//     optional `required?` / `disabled?` posture; same shape as FieldNode).
//   • The [JsonDerivedType] discriminator strings "rich-text-field" and
//     "rich-text-toolbar" emit correctly when serialized AS a ViewNode base
//     — the load-bearing gotcha #1 protection (Ok() drops DeclaredType).
//   • A findNulls scan across an all-permutations shape grid proves ZERO
//     literal `null` values on the wire in ANY shape — the direct assertion
//     the parity gate's normalize.ts cannot make (drops nulls BEFORE diffing).
//
// Mirrors MessageNodeSerializationTests.cs — uses JsonSerializerOptions with
// camelCase only (no host DefaultIgnoreCondition), to prove the [JsonIgnore]
// attributes carry the contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class RichTextSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─────────────────────────────────────────────────────────────────────
    // Test 1 — Minimum-shape RichTextFieldNode emits exactly type + name +
    // bind. Zero null keys. Zero absent-when-default `required`/`disabled`
    // keys. The canonical gotcha #8 class-2 protection.
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public void RichTextFieldNode_MinimumShape_EmitsExactly_TypeNameBind()
    {
        var node = new RichTextFieldNode(Name: "note", Bind: "draft");
        var json = Serialize<ViewNode>(node);

        // Parse to a JsonDocument and enumerate top-level property names to
        // make the assertion order-independent (a future property re-ordering
        // by the serializer should not fail this test).
        using var doc = JsonDocument.Parse(json);
        var props = doc.RootElement.EnumerateObject().Select(p => p.Name).ToList();

        Assert.Equal(3, props.Count);
        Assert.Contains("type", props);
        Assert.Contains("name", props);
        Assert.Contains("bind", props);
        Assert.Equal("rich-text-field", doc.RootElement.GetProperty("type").GetString());
        Assert.Equal("note", doc.RootElement.GetProperty("name").GetString());
        Assert.Equal("draft", doc.RootElement.GetProperty("bind").GetString());

        // Direct null-omission belt-and-braces (guards against a future
        // regression where a nullable is serialized as literal `null`).
        Assert.DoesNotContain("\":null", json);
        Assert.DoesNotContain("\": null", json);
        Assert.DoesNotContain("\"label\"", json);
        Assert.DoesNotContain("\"placeholder\"", json);
        Assert.DoesNotContain("\"toolbar\"", json);
        Assert.DoesNotContain("\"required\"", json);
        Assert.DoesNotContain("\"disabled\"", json);
        Assert.DoesNotContain("\"state\"", json);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 2 — Full-shape RichTextFieldNode with every field set emits all
    // set fields; no field emitted as `null`; the nested Toolbar carries the
    // polymorphic discriminator + its own set fields.
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public void RichTextFieldNode_FullShape_EmitsAllSetFields_OmitsUnset()
    {
        var node = new RichTextFieldNode(
            Name: "description",
            Bind: "task.description",
            Label: "Description",
            Placeholder: "Write something…",
            Toolbar: new RichTextToolbarNode(
                Tools: new[] { RichTextTool.Bold, RichTextTool.Italic },
                Size: RichTextToolbarSize.Expanded,
                Tone: Tone.Info,
                State: "active"),
            Required: true,
            Disabled: false,       // false — MUST be absent (WhenWritingDefault)
            State: "active");
        var json = Serialize<ViewNode>(node);

        // Discriminator + all required/set fields present.
        Assert.Contains("\"type\":\"rich-text-field\"", json);
        Assert.Contains("\"name\":\"description\"", json);
        Assert.Contains("\"bind\":\"task.description\"", json);
        Assert.Contains("\"label\":\"Description\"", json);
        Assert.Contains("\"placeholder\":\"Write something\\u2026\"", json);
        Assert.Contains("\"toolbar\":{", json);
        // Nested toolbar's SET fields land inside the "toolbar" object.
        // NOTE: the nested toolbar does NOT carry the polymorphic
        // "type":"rich-text-toolbar" discriminator here, because
        // RichTextFieldNode.Toolbar is typed as the CONCRETE
        // RichTextToolbarNode? on the .NET record (NOT ViewNode?) —
        // Analog C's narrow-typing decision (a random ViewNode as toolbar
        // is meaningless; polymorphism does not matter for this slot). The
        // discriminator emits only when serialized AS a ViewNode base — see
        // RichTextToolbarNode_UsesPolymorphicDiscriminator_ThroughViewNode.
        Assert.Contains("\"tools\":[\"bold\",\"italic\"]", json);
        Assert.Contains("\"size\":\"expanded\"", json);
        Assert.Contains("\"tone\":\"info\"", json);
        Assert.Contains("\"required\":true", json);
        Assert.Contains("\"state\":\"active\"", json);

        // Disabled = false was set explicitly — MUST still be absent
        // (WhenWritingDefault contract).
        Assert.DoesNotContain("\"disabled\"", json);

        // findNulls-style scan: no literal null values in the full-shape
        // output. Class-2 defect protection (gotcha #8).
        Assert.DoesNotContain("\":null", json);
        Assert.DoesNotContain("\": null", json);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 3 — WhenWritingDefault gate on Required / Disabled: false is
    // ABSENT; true is PRESENT. Matches TS optional `required?` / `disabled?`.
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public void RichTextFieldNode_Required_False_IsAbsent()
    {
        var falseNode = new RichTextFieldNode(Name: "n", Bind: "b", Required: false);
        var falseJson = Serialize<ViewNode>(falseNode);
        Assert.DoesNotContain("\"required\"", falseJson);

        var trueNode = new RichTextFieldNode(Name: "n", Bind: "b", Required: true);
        var trueJson = Serialize<ViewNode>(trueNode);
        Assert.Contains("\"required\":true", trueJson);
    }

    [Fact]
    public void RichTextFieldNode_Disabled_False_IsAbsent()
    {
        var falseNode = new RichTextFieldNode(Name: "n", Bind: "b", Disabled: false);
        var falseJson = Serialize<ViewNode>(falseNode);
        Assert.DoesNotContain("\"disabled\"", falseJson);

        var trueNode = new RichTextFieldNode(Name: "n", Bind: "b", Disabled: true);
        var trueJson = Serialize<ViewNode>(trueNode);
        Assert.Contains("\"disabled\":true", trueJson);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 4 — RichTextToolbarNode.Tools emits each RichTextTool member as
    // its kebab-case wire value, including digit-boundary members that
    // KebabEnum<T> would silently drop the hyphen from (Heading1..3,
    // BulletList, OrderedList, InlineCode, CodeBlock). Proves the dedicated
    // RichTextToolConverter is wired correctly.
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public void RichTextToolbarNode_Tools_EmitAsKebabCase()
    {
        var node = new RichTextToolbarNode(Tools: new[]
        {
            RichTextTool.Bold,
            RichTextTool.BulletList,
            RichTextTool.Heading1,
            RichTextTool.InlineCode,
            RichTextTool.CodeBlock,
            RichTextTool.Blockquote,
            RichTextTool.Link,
            RichTextTool.OrderedList,
            RichTextTool.Heading2,
            RichTextTool.Heading3,
            RichTextTool.Italic,
        });
        var json = Serialize<ViewNode>(node);

        // Every wire literal present. Includes the four digit-boundary members
        // that KebabEnum<T> would silently emit without a hyphen ("heading1",
        // "heading2", "heading3" — a drift from the TS union "heading-1" etc.).
        Assert.Contains("\"bold\"", json);
        Assert.Contains("\"bullet-list\"", json);
        Assert.Contains("\"heading-1\"", json);
        Assert.Contains("\"inline-code\"", json);
        Assert.Contains("\"code-block\"", json);
        Assert.Contains("\"blockquote\"", json);
        Assert.Contains("\"link\"", json);
        Assert.Contains("\"ordered-list\"", json);
        Assert.Contains("\"heading-2\"", json);
        Assert.Contains("\"heading-3\"", json);
        Assert.Contains("\"italic\"", json);

        // Explicit anti-drift assertion: none of the without-hyphen digit
        // forms KebabEnum<T> would silently emit are present.
        Assert.DoesNotContain("\"heading1\"", json);
        Assert.DoesNotContain("\"heading2\"", json);
        Assert.DoesNotContain("\"heading3\"", json);
        Assert.DoesNotContain("\"inlinecode\"", json);
        Assert.DoesNotContain("\"codeblock\"", json);
        Assert.DoesNotContain("\"bulletlist\"", json);
        Assert.DoesNotContain("\"orderedlist\"", json);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 5 — RichTextToolbarNode.Size emits as its kebab-case wire value
    // via KebabEnum<RichTextToolbarSize>. Both members (Compact/Expanded)
    // are single-token so KebabEnum handles them naturally.
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public void RichTextToolbarNode_Size_EmitAsKebabCase()
    {
        var compact = new RichTextToolbarNode(
            Tools: new[] { RichTextTool.Bold },
            Size: RichTextToolbarSize.Compact);
        Assert.Contains("\"size\":\"compact\"", Serialize<ViewNode>(compact));

        var expanded = new RichTextToolbarNode(
            Tools: new[] { RichTextTool.Bold },
            Size: RichTextToolbarSize.Expanded);
        Assert.Contains("\"size\":\"expanded\"", Serialize<ViewNode>(expanded));
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 6 — Polymorphic discriminator emission through ViewNode base type.
    // The load-bearing protection against gotcha #1 ("Ok() drops
    // DeclaredType"): serializing AS ViewNode (not the concrete record type)
    // MUST still emit the "type" property from the [JsonDerivedType]
    // discriminator.
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public void RichTextFieldNode_UsesPolymorphicDiscriminator_ThroughViewNode()
    {
        ViewNode node = new RichTextFieldNode(Name: "note", Bind: "draft");
        var json = JsonSerializer.Serialize<ViewNode>(node, _opts);
        Assert.Contains("\"type\":\"rich-text-field\"", json);
    }

    [Fact]
    public void RichTextToolbarNode_UsesPolymorphicDiscriminator_ThroughViewNode()
    {
        ViewNode node = new RichTextToolbarNode(Tools: new[] { RichTextTool.Bold });
        var json = JsonSerializer.Serialize<ViewNode>(node, _opts);
        Assert.Contains("\"type\":\"rich-text-toolbar\"", json);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Test 7 — findNulls defense scan. Enumerate a broad shape-permutation
    // grid (every optional field either set or absent, every optional bool
    // either true or false) for both records, serialize each shape, and
    // assert ZERO literal `null` values across the aggregate output. This
    // is the direct in-code invariant the parity gate's normalize.ts
    // cannot make (it drops nulls BEFORE diffing, so a `"field": null` slips
    // through undetected). AGENTS.md gotcha #8 class-2 defense.
    // ─────────────────────────────────────────────────────────────────────

    [Fact]
    public void RichTextFieldNode_FindNulls_ScanAllShapes()
    {
        // Build every combination of optional-set-or-absent + bool
        // true-or-false for RichTextFieldNode.
        var toolbars = new RichTextToolbarNode?[]
        {
            null,
            new RichTextToolbarNode(Tools: new[] { RichTextTool.Bold }),
            new RichTextToolbarNode(
                Tools: new[] { RichTextTool.Heading1, RichTextTool.CodeBlock },
                Size: RichTextToolbarSize.Compact,
                Tone: Tone.Warning,
                State: "done"),
        };
        var labels = new string?[] { null, "Label" };
        var placeholders = new string?[] { null, "Placeholder" };
        var states = new string?[] { null, "active" };
        var bools = new[] { false, true };

        var combined = new System.Text.StringBuilder();
        int shapeCount = 0;

        foreach (var toolbar in toolbars)
        foreach (var label in labels)
        foreach (var placeholder in placeholders)
        foreach (var required in bools)
        foreach (var disabled in bools)
        foreach (var state in states)
        {
            var node = new RichTextFieldNode(
                Name: "n",
                Bind: "b",
                Label: label,
                Placeholder: placeholder,
                Toolbar: toolbar,
                Required: required,
                Disabled: disabled,
                State: state);
            combined.Append(Serialize<ViewNode>(node));
            shapeCount++;
        }

        // Also cover every toolbar shape independently as a top-level node.
        var toolbarShapes = new RichTextToolbarNode[]
        {
            new(Tools: new[] { RichTextTool.Bold }),
            new(Tools: new[] { RichTextTool.Bold }, Size: RichTextToolbarSize.Compact),
            new(Tools: new[] { RichTextTool.Bold }, Tone: Tone.Danger),
            new(Tools: new[] { RichTextTool.Bold }, State: "active"),
            new(
                Tools: new[]
                {
                    RichTextTool.Bold, RichTextTool.Italic, RichTextTool.Heading1,
                    RichTextTool.Heading2, RichTextTool.Heading3, RichTextTool.BulletList,
                    RichTextTool.OrderedList, RichTextTool.InlineCode,
                    RichTextTool.CodeBlock, RichTextTool.Blockquote, RichTextTool.Link,
                },
                Size: RichTextToolbarSize.Expanded,
                Tone: Tone.Success,
                State: "done"),
        };
        foreach (var t in toolbarShapes)
        {
            combined.Append(Serialize<ViewNode>(t));
            shapeCount++;
        }

        var aggregate = combined.ToString();

        // Belt-and-braces: neither the compact null form ("":null) nor the
        // whitespace-padded form ("": null) may appear.
        Assert.DoesNotContain("\":null", aggregate);
        Assert.DoesNotContain("\": null", aggregate);

        // Sanity check that the grid actually ran (guards against a future
        // refactor that accidentally elides the loops).
        Assert.True(shapeCount > 100,
            $"Expected the shape-permutation grid to produce >100 outputs; got {shapeCount}.");
    }
}
