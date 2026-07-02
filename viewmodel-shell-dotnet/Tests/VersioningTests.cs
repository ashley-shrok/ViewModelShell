// 3.8.0 — client/server version-skew (.NET side) unit tests.
//
//   • ActionPayload<T>.Parse(HttpRequest, currentBuild) throws StaleClientException
//     on a header mismatch and does NOT deserialize _state.
//   • Matching (or absent) header passes through and parses normally.
//   • ShellExceptionFilter maps StaleClientException → 400 + stale_client.
//   • ShellVersionResultFilter stamps ServerBuild on an ObjectResult whose value
//     is an IShellResponse; skips when no build configured / non-shell results.
//
// Each test constructs its context manually — no running ASP.NET host.

namespace ViewModelShell.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging.Abstractions;
using MvcActionDescriptor = Microsoft.AspNetCore.Mvc.Abstractions.ActionDescriptor;

public class VersioningTests
{
    private sealed record DemoState(string Value);

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    /// <summary>Build an HttpRequest with a multipart-ish form + optional client-build header.</summary>
    private static HttpRequest MakeRequest(string? clientBuild, string actionJson, string stateJson)
    {
        var ctx = new DefaultHttpContext();
        var req = ctx.Request;
        if (clientBuild != null) req.Headers["X-VMS-Client-Build"] = clientBuild;
        req.Form = new FormCollection(new Dictionary<string, Microsoft.Extensions.Primitives.StringValues>
        {
            ["_action"] = actionJson,
            ["_state"] = stateJson,
        });
        return req;
    }

    private static ActionContext MakeActionContext() =>
        new(new DefaultHttpContext(), new RouteData(), new MvcActionDescriptor());

    // ─── Parse(HttpRequest, currentBuild) guard ──────────────────────────────

    [Fact]
    public void Parse_HeaderMismatch_ThrowsStaleClient_AndDoesNotDeserializeState()
    {
        // _state is deliberately GARBAGE. If the guard didn't fire first, the
        // DemoState deserialize would run; we assert it never does.
        var req = MakeRequest("old-build", "{\"name\":\"go\"}", "this is not valid json for DemoState");

        var ex = Assert.Throws<StaleClientException>(() =>
            ActionPayload<DemoState>.Parse(req, "new-build"));

        Assert.Equal("old-build", ex.ClientBuild);
        Assert.Equal("new-build", ex.CurrentBuild);
    }

    [Fact]
    public void Parse_HeaderMatches_ParsesNormally()
    {
        var req = MakeRequest("v1", "{\"name\":\"go\"}", "{\"value\":\"hello\"}");

        var payload = ActionPayload<DemoState>.Parse(req, "v1");

        Assert.Equal("go", payload.Name);
        Assert.Equal("hello", payload.State.Value);
    }

    [Fact]
    public void Parse_NoHeader_PassesThrough()
    {
        // Absent header → fail-closed guard does NOT fire (only a mismatching
        // client that DID advertise a build is rejected).
        var req = MakeRequest(null, "{\"name\":\"go\"}", "{\"value\":\"hello\"}");

        var payload = ActionPayload<DemoState>.Parse(req, "v1");

        Assert.Equal("hello", payload.State.Value);
    }

    [Fact]
    public void Parse_EmptyCurrentBuild_SkipsGuardEntirely()
    {
        // Even a mismatching header is ignored when currentBuild is empty.
        var req = MakeRequest("whatever", "{\"name\":\"go\"}", "{\"value\":\"hello\"}");

        var payload = ActionPayload<DemoState>.Parse(req, "");

        Assert.Equal("hello", payload.State.Value);
    }

    // ─── ShellExceptionFilter maps StaleClientException → 400 stale_client ────

    [Fact]
    public async Task ShellExceptionFilter_StaleClient_Returns400WithStaleClientCode()
    {
        var filter = new ShellExceptionFilter(NullLogger<ShellExceptionFilter>.Instance);
        var ctx = new ExceptionContext(MakeActionContext(), [])
        {
            Exception = new StaleClientException("old", "new"),
        };

        await filter.OnExceptionAsync(ctx);

        Assert.True(ctx.ExceptionHandled);
        var content = Assert.IsType<ContentResult>(ctx.Result);
        Assert.Equal(400, content.StatusCode);

        var body = JsonSerializer.Deserialize<JsonElement>(content.Content!, _opts);
        Assert.False(body.GetProperty("ok").GetBoolean());
        Assert.Equal(ErrorCodes.StaleClient, body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    // ─── ShellVersionResultFilter stamps ServerBuild ─────────────────────────

    private static ResultExecutingContext MakeResultContext(IActionResult result) =>
        new(MakeActionContext(), [], result, controller: new object());

    [Fact]
    public void VersionResultFilter_StampsServerBuild_OnShellResponseObjectResult()
    {
        var filter = new ShellVersionResultFilter(new VmsVersioningOptions { CurrentBuild = "build-9" });
        var response = new ShellResponse<DemoState>(new TextNode("hi"), new DemoState("x"));
        var objResult = new ObjectResult(response);
        var ctx = MakeResultContext(objResult);

        filter.OnResultExecuting(ctx);

        var stamped = Assert.IsType<ShellResponse<DemoState>>(objResult.Value);
        Assert.Equal("build-9", stamped.ServerBuild);
    }

    [Fact]
    public void VersionResultFilter_NoBuildConfigured_DoesNothing()
    {
        var filter = new ShellVersionResultFilter(new VmsVersioningOptions { CurrentBuild = null });
        var response = new ShellResponse<DemoState>(new TextNode("hi"), new DemoState("x"));
        var objResult = new ObjectResult(response);
        var ctx = MakeResultContext(objResult);

        filter.OnResultExecuting(ctx);

        var untouched = Assert.IsType<ShellResponse<DemoState>>(objResult.Value);
        Assert.Null(untouched.ServerBuild);
    }

    [Fact]
    public void VersionResultFilter_NonShellResult_IsIgnored()
    {
        var filter = new ShellVersionResultFilter(new VmsVersioningOptions { CurrentBuild = "build-9" });
        // A ContentResult (e.g. the error-envelope path) is not an IShellResponse ObjectResult.
        var content = new ContentResult { Content = "{}", StatusCode = 400 };
        var ctx = MakeResultContext(content);

        filter.OnResultExecuting(ctx); // must not throw

        Assert.Same(content, ctx.Result);
    }

    [Fact]
    public void WithServerBuild_ReturnsCopyWithServerBuildSet()
    {
        IShellResponse response = new ShellResponse<DemoState>(new TextNode("hi"), new DemoState("x"));
        var stamped = Assert.IsType<ShellResponse<DemoState>>(response.WithServerBuild("abc"));
        Assert.Equal("abc", stamped.ServerBuild);
    }

    [Fact]
    public void ServerBuild_AbsentFromWire_WhenNull()
    {
        var response = new ShellResponse<DemoState>(new TextNode("hi"), new DemoState("x"));
        var json = JsonSerializer.Serialize(response, _opts);
        Assert.DoesNotContain("serverBuild", json);
    }

    [Fact]
    public void ServerBuild_PresentOnWire_WhenSet()
    {
        var response = new ShellResponse<DemoState>(new TextNode("hi"), new DemoState("x")) with { ServerBuild = "b1" };
        var json = JsonSerializer.Serialize(response, _opts);
        Assert.Contains("\"serverBuild\":\"b1\"", json);
    }
}
