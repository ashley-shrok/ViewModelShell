// v8.0.0 (COMP-08) — EmptyStateNode wire-shape parity (BREAKING RENAME).
//
// 🚨 v8.0.0 BREAKING WIRE RENAME:
//   - Heading → Title (required, renamed)
//   - Message → Description (optional, renamed)
//   - NEW Icon?: IconName slot (tinted-circle backdrop; reuses Phase 22 icons)
//   - Tooltip REMOVED (was TS/.NET byte-drift — folded into same wire break)
// The type discriminator "empty-state" is UNCHANGED; only field NAMES rename.
//
// Proves the .NET EmptyStateNode record + IconName reuse + [JsonDerivedType]
// discriminator serialize BYTE-ALIGNED with the RENAMED TS twin:
//   • The renamed fields (`title`, `description`) appear on the wire; the
//     OLD field names (`heading`, `message`) DO NOT appear (positive +
//     negative assertions).
//   • Every optional (Icon, Description, Action) carries WhenWritingNull →
//     ABSENT from JSON when unset (not `"description": null`), matching the
//     TS absent-never-null contract (AGENTS.md gotcha #8).
//   • The bare `new EmptyStateNode(Title: "X")` serializes minimally — the
//     class-2 findNulls defect the parity gate cannot see, asserted directly.
//   • Icon (NEW) round-trips kebab-case correctly.
//   • Action (UNCHANGED) serializes polymorphically with the "type":"button"
//     discriminator (proves it's typed ViewNode?, not concrete ButtonNode).
//   • Tooltip is REMOVED (regression protection for the byte-alignment
//     cleanup — asserts `"tooltip"` never appears on the wire).
//
// Mirrors AvatarNodeSerializationTests.cs — uses JsonSerializerOptions with
// camelCase only (no host DefaultIgnoreCondition), to prove the [JsonIgnore]
// attributes carry the contract intrinsically.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class EmptyStateNodeSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    // ─── Discriminator + type ────────────────────────────────────────────────

    [Fact]
    public void Type_SerializesAsEmptyState()
    {
        var node = new EmptyStateNode(Title: "X");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"empty-state\"", json);
    }

    // ─── Required Title field ────────────────────────────────────────────────

    [Fact]
    public void Title_Required_AlwaysPresent()
    {
        // Title is the first positional required parameter — the C# compiler
        // enforces its presence at construction time. Serialization must always
        // emit it, and it MUST use the renamed wire name "title".
        var node = new EmptyStateNode(Title: "No tickets yet");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"title\":\"No tickets yet\"", json);
    }

    // ─── RENAMED FIELDS — positive + negative assertions ────────────────────

    [Fact]
    public void RenamedFields_UseTitle_NotHeading()
    {
        // Proves the .NET record uses `Title`, serialized as "title" on the
        // wire — NOT the old "heading". A regression here indicates the
        // rename didn't cascade to the .NET side.
        var node = new EmptyStateNode(Title: "Renamed");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"title\":", json);
        Assert.DoesNotContain("\"heading\":", json);
    }

    [Fact]
    public void RenamedFields_UseDescription_NotMessage()
    {
        // Proves the .NET record uses `Description`, serialized as "description"
        // on the wire — NOT the old "message". A regression here indicates
        // the rename didn't cascade to the .NET side.
        var node = new EmptyStateNode(Title: "X", Description: "Y");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"description\":\"Y\"", json);
        Assert.DoesNotContain("\"message\":", json);
    }

    // ─── Class-2 findNulls defect protection (gotcha #8) ────────────────────

    [Fact]
    public void MinimalShape_OmittedOptionalsAreAbsent()
    {
        // Setting Title only — Icon, Description, Action MUST all be absent
        // from the JSON (not serialized as null). This is the class-2 defect
        // the parity gate's normalize.ts silently strips before diffing
        // (AGENTS.md gotcha #8).
        var node = new EmptyStateNode(Title: "No items");
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"title\":\"No items\"", json);
        Assert.DoesNotContain("\"icon\"", json);
        Assert.DoesNotContain("\"description\"", json);
        Assert.DoesNotContain("\"action\"", json);
        // Regression protection for the Tooltip removal (see below).
        Assert.DoesNotContain("\"tooltip\"", json);
    }

    [Fact]
    public void Description_OmittedIsAbsent()
    {
        var node = new EmptyStateNode(Title: "X");
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"description\"", json);
    }

    [Fact]
    public void Icon_OmittedIsAbsent()
    {
        var node = new EmptyStateNode(Title: "X");
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"icon\"", json);
    }

    [Fact]
    public void Action_OmittedIsAbsent()
    {
        var node = new EmptyStateNode(Title: "X");
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"action\"", json);
    }

    // ─── NEW Icon slot — KebabEnum round-trip ───────────────────────────────

    [Fact]
    public void Icon_SerializesAsKebab()
    {
        // Icon serializes as its lowercase-kebab wire value — proves the
        // shipped IconName enum crosses through EmptyStateNode's NEW Icon slot
        // without special handling. (FolderOpen is the chosen fixture per the
        // shipped IconName set; the vitest twin uses "folder-open".)
        var node = new EmptyStateNode(Title: "X", Icon: IconName.FolderOpen);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"folder-open\"", json);
    }

    [Fact]
    public void Icon_MultiWordName_SerializesAsKebab()
    {
        // Multi-word icon name — proves the IconNameConverter (Phase 22)
        // continues to handle multi-word / digit-boundary names correctly
        // when consumed via EmptyStateNode.Icon.
        var node = new EmptyStateNode(Title: "X", Icon: IconName.ShieldCheck);
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"icon\":\"shield-check\"", json);
    }

    // ─── Action (UNCHANGED) — polymorphic ButtonNode ────────────────────────

    [Fact]
    public void Action_SetSerializesPolymorphically()
    {
        // Action is typed ViewNode? (NOT concrete ButtonNode) so
        // System.Text.Json emits the polymorphic "type":"button" discriminator
        // — STJ only writes it when serializing through the [JsonPolymorphic]
        // base ViewNode. If Action were typed as concrete ButtonNode, the
        // discriminator would vanish and the wire would drift from the TS twin.
        var node = new EmptyStateNode(
            Title: "Nothing here",
            Action: new ButtonNode("Add item", new ActionDescriptor("add-item"), Emphasis: Emphasis.Primary));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"action\":", json);
        Assert.Contains("\"type\":\"button\"", json);
        Assert.Contains("\"label\":\"Add item\"", json);
        Assert.Contains("\"name\":\"add-item\"", json);
    }

    // ─── All fields set ─────────────────────────────────────────────────────

    [Fact]
    public void AllFieldsSet_AllPresent()
    {
        // Every field of the RENAMED shape set — every one appears on the wire,
        // correctly kebab-cased where applicable. This is the byte-identity
        // test with the TS twin.
        var node = new EmptyStateNode(
            Title: "No tickets yet",
            Icon: IconName.FolderOpen,
            Description: "Create your first ticket to get started.",
            Action: new ButtonNode("New ticket", new ActionDescriptor("create-ticket"), Emphasis: Emphasis.Primary));
        var json = Serialize<ViewNode>(node);
        Assert.Contains("\"type\":\"empty-state\"", json);
        Assert.Contains("\"title\":\"No tickets yet\"", json);
        Assert.Contains("\"icon\":\"folder-open\"", json);
        Assert.Contains("\"description\":\"Create your first ticket to get started.\"", json);
        Assert.Contains("\"action\":", json);
        Assert.Contains("\"type\":\"button\"", json);
        // Negative — the RENAMED shape MUST NOT re-emit the old field names.
        Assert.DoesNotContain("\"heading\":", json);
        Assert.DoesNotContain("\"message\":", json);
        Assert.DoesNotContain("\"tooltip\":", json);
    }

    // ─── Tooltip REMOVED (byte-alignment cleanup) ────────────────────────────

    [Fact]
    public void TooltipField_RemovedInV8()
    {
        // The .NET-only Tooltip field is REMOVED in v8.0 (folded into the
        // same wire break as the rename). Regression protection: assert
        // the wire never emits "tooltip" for EmptyStateNode.
        //
        // This test protects against a maintainer re-adding a Tooltip field
        // without also updating the TS twin (which would re-introduce the
        // Class-1 byte-drift defect this cleanup removes).
        var node = new EmptyStateNode(Title: "X");
        var json = Serialize<ViewNode>(node);
        Assert.DoesNotContain("\"tooltip\"", json);
    }
}
