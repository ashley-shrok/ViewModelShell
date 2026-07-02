// 3.9.0 — FieldNode.Bind is now optional (string?), for file inputs.
//
// A file input's binary rides the multipart side channel (fileRegistry keyed on
// Name), so it needs no bind. Bind is nullable + WhenWritingNull, so a
// Bind: null field serializes with NO "bind" key (matching the TS twin, which
// omits `bind`), while a bound field still emits it. Uses camelCase-only options
// (no host DefaultIgnoreCondition) to prove the attribute carries the contract.

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class FieldBindSerializationTests
{
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize<T>(value, _opts);

    [Fact]
    public void FieldNode_NullBind_OmitsBindKey()
    {
        var field = new FieldNode("attachment", "file", null, "Attachment", null);
        var json = Serialize<ViewNode>(field);
        Assert.DoesNotContain("\"bind\"", json);
    }

    [Fact]
    public void FieldNode_WithBind_SerializesBind()
    {
        var field = new FieldNode("title", "text", "fields.title", "Title", null);
        var json = Serialize<ViewNode>(field);
        Assert.Contains("\"bind\":\"fields.title\"", json);
    }
}
