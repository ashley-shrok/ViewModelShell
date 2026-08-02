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
using Microsoft.Extensions.DependencyInjection;
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

    /// <summary>
    /// 9.0.0 (SKEW-01) — Twin of <see cref="MakeResultContext"/> that constructs an
    /// <see cref="ActionExecutingContext"/> for <see cref="ShellVersionGuardFilter"/>
    /// unit tests. Accepts an optional pre-built <see cref="HttpContext"/> so the
    /// caller can preload the <c>X-VMS-Client-Build</c> header before wrapping.
    /// </summary>
    private static ActionExecutingContext MakeActionExecutingContext(HttpContext? httpCtx = null)
    {
        var actionCtx = new ActionContext(
            httpCtx ?? new DefaultHttpContext(),
            new RouteData(),
            new MvcActionDescriptor());
        return new ActionExecutingContext(
            actionCtx,
            new List<IFilterMetadata>(),
            new Dictionary<string, object?>(),
            controller: new object());
    }

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

    // ─── 3.11.0 — manifest-hash build id (VmsManifestBuildId + no-arg overload) ──

    // The LOCKED cross-backend hash of Tests/fixtures/manifest.json:
    // sha256(rawBytes) → first 12 hex, lowercase. This fixture is BYTE-IDENTICAL
    // to viewmodel-shell/test/fixtures/manifest.json, and the npm suite
    // (test/vite-plugin.test.ts) asserts the SAME expected value. Touch one
    // fixture → touch both and re-derive this constant.
    private const string ExpectedFixtureHash = "2f64b9072074";

    private static string FixtureDir =>
        Path.Combine(AppContext.BaseDirectory, "fixtures");

    [Fact]
    public void VmsManifestBuildId_HashesFixtureToLockedContract()
    {
        Assert.Equal(ExpectedFixtureHash, VmsManifestBuildId.Compute(FixtureDir));
    }

    [Fact]
    public void VmsManifestBuildId_AbsentManifest_ReturnsDevNone()
    {
        var emptyDir = Path.Combine(Path.GetTempPath(), "vms-no-manifest-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(emptyDir);
        try
        {
            Assert.Equal("dev-none", VmsManifestBuildId.Compute(emptyDir));
        }
        finally
        {
            Directory.Delete(emptyDir, recursive: true);
        }
    }

    // Minimal IWebHostEnvironment whose WebRootPath points at the fixture dir;
    // the other members are unused by AddVmsShellVersioning().
    private sealed class FakeWebHostEnvironment : Microsoft.AspNetCore.Hosting.IWebHostEnvironment
    {
        public string WebRootPath { get; set; } = "";
        public Microsoft.Extensions.FileProviders.IFileProvider WebRootFileProvider { get; set; } = null!;
        public string ApplicationName { get; set; } = "Tests";
        public Microsoft.Extensions.FileProviders.IFileProvider ContentRootFileProvider { get; set; } = null!;
        public string ContentRootPath { get; set; } = "";
        public string EnvironmentName { get; set; } = "Development";
    }

    [Fact]
    public void AddVmsShellVersioning_NoArg_SelfHashesManifestFromWebRoot()
    {
        var services = new ServiceCollection();
        services.AddSingleton<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>(
            new FakeWebHostEnvironment { WebRootPath = FixtureDir });
        services.AddVmsShellVersioning(); // no-arg → lazy factory hashes wwwroot/manifest.json

        using var sp = services.BuildServiceProvider();
        var opts = sp.GetRequiredService<VmsVersioningOptions>();

        Assert.Equal(ExpectedFixtureHash, opts.CurrentBuild);
    }

    // ─── 3.11.1: AddVmsShellVersioning self-registers ShellVersionResultFilter ──
    // Regression for the Phase-1 gap Poppy caught in prod: before 3.11.1, the
    // overloads registered the options singleton but NOT the result filter, so the
    // serverBuild stamp silently no-op'd unless the app added the filter by hand.

    private static bool HasVersionFilter(IServiceProvider sp) =>
        sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<MvcOptions>>().Value.Filters
            .OfType<TypeFilterAttribute>()
            .Count(f => f.ImplementationType == typeof(ShellVersionResultFilter)) == 1;

    // 9.0.0 (SKEW-01) — twin of HasVersionFilter for the new global action-filter
    // guard shipped in Plan 29-02. Same shape: exactly ONE ShellVersionGuardFilter
    // in the MvcOptions.Filters pipeline. The `== 1` (rather than `>= 1`) is
    // load-bearing for the dedup test — a double-registered action filter would
    // throw twice on a mismatched request (400 stale_client on the first throw,
    // then a second uncaught throw the ShellExceptionFilter is no longer wired to
    // handle for that pipeline pass), so the count must be strictly one.
    private static bool HasVersionGuardFilter(IServiceProvider sp) =>
        sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<MvcOptions>>().Value.Filters
            .OfType<TypeFilterAttribute>()
            .Count(f => f.ImplementationType == typeof(ShellVersionGuardFilter)) == 1;

    [Fact]
    public void AddVmsShellVersioning_String_SelfRegistersResultFilter()
    {
        var services = new ServiceCollection();
        services.AddControllers();
        services.AddVmsShellVersioning("build-x");
        using var sp = services.BuildServiceProvider();
        Assert.True(HasVersionFilter(sp), "AddVmsShellVersioning(string) must self-register ShellVersionResultFilter");
    }

    [Fact]
    public void AddVmsShellVersioning_NoArg_SelfRegistersResultFilter()
    {
        var services = new ServiceCollection();
        services.AddSingleton<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>(
            new FakeWebHostEnvironment { WebRootPath = FixtureDir });
        services.AddControllers();
        services.AddVmsShellVersioning();
        using var sp = services.BuildServiceProvider();
        Assert.True(HasVersionFilter(sp), "no-arg AddVmsShellVersioning() must self-register ShellVersionResultFilter");
    }

    [Fact]
    public void AddVmsShellVersioning_ManualFilterFirst_NotDoubleRegistered()
    {
        // A legacy caller that still adds the filter manually must not get two.
        var services = new ServiceCollection();
        services.AddControllers(o => o.Filters.Add<ShellVersionResultFilter>());
        services.AddVmsShellVersioning("build-x");
        using var sp = services.BuildServiceProvider();
        Assert.True(HasVersionFilter(sp), "dedup guard must keep exactly one ShellVersionResultFilter");
    }

    // ─── 9.0.0 — ShellVersionGuardFilter behavior tests (Plan 29-05 for SKEW-01) ─
    // Coverage for the four documented short-circuit branches of the global action
    // filter shipped in Plan 29-02. Together with the parity fixture in Plan 29-07
    // (which exercises the filter over a real HTTP request) these constitute the
    // full unit + integration coverage of the guard.

    [Fact]
    public void VersionGuardFilter_HeaderMismatch_ThrowsStaleClient()
    {
        var http = new DefaultHttpContext();
        http.Request.Headers["X-VMS-Client-Build"] = "old-build";
        var ctx = MakeActionExecutingContext(http);
        var filter = new ShellVersionGuardFilter(new VmsVersioningOptions { CurrentBuild = "new-build" });

        var ex = Assert.Throws<StaleClientException>(() => filter.OnActionExecuting(ctx));

        Assert.Equal("old-build", ex.ClientBuild);
        Assert.Equal("new-build", ex.CurrentBuild);
    }

    [Fact]
    public void VersionGuardFilter_HeaderMatches_PassesThrough()
    {
        var http = new DefaultHttpContext();
        http.Request.Headers["X-VMS-Client-Build"] = "current-build";
        var ctx = MakeActionExecutingContext(http);
        var filter = new ShellVersionGuardFilter(new VmsVersioningOptions { CurrentBuild = "current-build" });

        filter.OnActionExecuting(ctx); // must not throw

        Assert.Null(ctx.Result); // did not short-circuit
    }

    [Fact]
    public void VersionGuardFilter_NoHeader_PassesThrough()
    {
        // Per CONTEXT: absent header → pass through (agent-driven curl still works).
        // Mirrors the shipped Parse_NoHeader_PassesThrough semantics.
        var ctx = MakeActionExecutingContext(); // no header set
        var filter = new ShellVersionGuardFilter(new VmsVersioningOptions { CurrentBuild = "any-build" });

        filter.OnActionExecuting(ctx); // must not throw

        Assert.Null(ctx.Result);
    }

    [Fact]
    public void VersionGuardFilter_EmptyCurrentBuild_SkipsGuard()
    {
        // Per CONTEXT additive-posture: empty CurrentBuild → inert (versioning off;
        // behavior byte-identical to versioning-off apps). Even a "mismatching"
        // header is ignored because there's no server-side build to mismatch AGAINST.
        var http = new DefaultHttpContext();
        http.Request.Headers["X-VMS-Client-Build"] = "some-build";
        var ctx = MakeActionExecutingContext(http);
        var filter = new ShellVersionGuardFilter(new VmsVersioningOptions { CurrentBuild = "" });

        filter.OnActionExecuting(ctx); // must not throw

        Assert.Null(ctx.Result);
    }

    // ─── 9.0.0 — ShellVersionGuardFilter self-registration tests (Plan 29-05 for SKEW-01) ─
    // Mirrors the existing AddVmsShellVersioning_*_SelfRegistersResultFilter block
    // above, asserting the extended AddVersionFilters helper (Plan 29-02) co-registers
    // the guard alongside the stamp from BOTH AddVmsShellVersioning overloads.

    [Fact]
    public void AddVmsShellVersioning_String_SelfRegistersGuardFilter()
    {
        var services = new ServiceCollection();
        services.AddControllers();
        services.AddVmsShellVersioning("build-x");
        using var sp = services.BuildServiceProvider();
        Assert.True(HasVersionGuardFilter(sp),
            "AddVmsShellVersioning(string) must self-register exactly ONE ShellVersionGuardFilter");
    }

    [Fact]
    public void AddVmsShellVersioning_NoArg_SelfRegistersGuardFilter()
    {
        var services = new ServiceCollection();
        services.AddSingleton<Microsoft.AspNetCore.Hosting.IWebHostEnvironment>(
            new FakeWebHostEnvironment { WebRootPath = FixtureDir });
        services.AddControllers();
        services.AddVmsShellVersioning();
        using var sp = services.BuildServiceProvider();
        Assert.True(HasVersionGuardFilter(sp),
            "no-arg AddVmsShellVersioning() must also self-register the guard");
    }

    [Fact]
    public void AddVmsShellVersioning_DoubleCall_DoesNotDoubleRegisterGuard()
    {
        // LOAD-BEARING: a double-registered action filter would throw twice on
        // mismatch, producing a 500 (the second throw is uncaught by the same
        // ShellExceptionFilter pass that mapped the first throw to 400 stale_client)
        // rather than the intended 400 stale_client envelope. The dedup guard in
        // AddVersionFilters (Plan 29-02) is what prevents this — this test is the
        // executable proof that a future refactor cannot silently remove it.
        var services = new ServiceCollection();
        services.AddControllers();
        services.AddVmsShellVersioning("build-x");
        services.AddVmsShellVersioning("build-x"); // idempotent
        using var sp = services.BuildServiceProvider();
        Assert.True(HasVersionGuardFilter(sp),
            "Double-call of AddVmsShellVersioning must still result in exactly ONE ShellVersionGuardFilter");
    }
}
