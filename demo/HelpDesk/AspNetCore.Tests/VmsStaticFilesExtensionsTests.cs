namespace HelpDesk.Tests;

using Microsoft.AspNetCore.Builder;             // ApplicationBuilder, StaticFileOptions
using Microsoft.AspNetCore.Http;                // DefaultHttpContext, IHeaderDictionary
using Microsoft.AspNetCore.StaticFiles;         // StaticFileResponseContext
using Microsoft.Extensions.DependencyInjection; // ServiceCollection, BuildServiceProvider
using Microsoft.Extensions.FileProviders;       // IFileInfo
using Microsoft.Extensions.Primitives;          // StringValues
using ViewModelShell;                           // VmsStaticFilesExtensions

// Unit tests for app.UseVmsShellStaticFiles(): no-cache on the SPA shell, default
// caching on hashed assets, prior OnPrepareResponse preserved, configurable suffixes.
// UseStaticFiles only REGISTERS middleware (constructed at app.Build()), so the
// extension installs OnPrepareResponse without needing a host or web root — we read
// that delegate back off the options and invoke it against a constructed context.
public class VmsStaticFilesExtensionsTests
{
    private sealed class FakeFile(string name) : IFileInfo
    {
        public bool Exists => true;
        public long Length => 0;
        public string? PhysicalPath => null;
        public string Name { get; } = name;
        public DateTimeOffset LastModified => default;
        public bool IsDirectory => false;
        public Stream CreateReadStream() => Stream.Null;
    }

    private static Action<StaticFileResponseContext> Install(
        StaticFileOptions options, IReadOnlyCollection<string>? suffixes = null)
    {
        var app = new ApplicationBuilder(new ServiceCollection().BuildServiceProvider());
        app.UseVmsShellStaticFiles(options, suffixes);
        return options.OnPrepareResponse!;
    }

    private static IHeaderDictionary HeadersFor(Action<StaticFileResponseContext> onPrepare, string fileName)
    {
        var http = new DefaultHttpContext();
        onPrepare(new StaticFileResponseContext(http, new FakeFile(fileName)));
        return http.Response.Headers;
    }

    // 6.7.0 — the emitted Cache-Control is `no-cache, must-revalidate` (was
    // just `no-cache` in 1.8.0). Kept as a constant so every assertion below
    // fails LOUDLY if the header value regresses — mutation-proof: change the
    // constant and the whole suite goes red.
    private const string ExpectedNoCache = "no-cache, must-revalidate";

    [Fact]
    public void ShellHtml_GetsNoCache()
    {
        var headers = HeadersFor(Install(new StaticFileOptions()), "index.html");
        Assert.Equal(ExpectedNoCache, headers.CacheControl.ToString());
    }

    // 6.7.0 broadens defaults: manifest.json, sw.js, robots.txt now covered.
    // Each test intentionally SEPARATE (not a Theory) so a regression on one
    // file type reads as a specific failure, not a parameter-tuple.

    [Fact]
    public void ManifestJson_GetsNoCache_ByDefault()
    {
        // The precise bite from the 20 Jul 2026 PBMInvoices prod bug: Chrome
        // heuristic-cached the manifest across a deploy and pinned yesterday's
        // hashed asset URLs. Default coverage of manifest.json is what closes
        // it — an adopter with default suffixes should NOT need to remember.
        var headers = HeadersFor(Install(new StaticFileOptions()), "manifest.json");
        Assert.Equal(ExpectedNoCache, headers.CacheControl.ToString());
    }

    [Fact]
    public void ServiceWorker_GetsNoCache_ByDefault()
    {
        var headers = HeadersFor(Install(new StaticFileOptions()), "sw.js");
        Assert.Equal(ExpectedNoCache, headers.CacheControl.ToString());
    }

    [Fact]
    public void RobotsTxt_GetsNoCache_ByDefault()
    {
        var headers = HeadersFor(Install(new StaticFileOptions()), "robots.txt");
        Assert.Equal(ExpectedNoCache, headers.CacheControl.ToString());
    }

    [Fact]
    public void HashedAsset_KeepsDefaultCaching()
    {
        var headers = HeadersFor(Install(new StaticFileOptions()), "main-DPvfhwRF.js");
        Assert.True(StringValues.IsNullOrEmpty(headers.CacheControl));
    }

    [Fact]
    public void PriorOnPrepareResponse_RunsAndIsAugmented()
    {
        var priorRan = false;
        var options = new StaticFileOptions { OnPrepareResponse = _ => priorRan = true };
        var headers = HeadersFor(Install(options), "chat.html");
        Assert.True(priorRan);                                        // caller's hook still fires
        Assert.Equal(ExpectedNoCache, headers.CacheControl.ToString()); // and our rule applied on top
    }

    [Fact]
    public void CustomSuffixes_OverrideTheDefault()
    {
        var onPrepare = Install(new StaticFileOptions(), new[] { "sw.js", "config.json" });
        Assert.Equal(ExpectedNoCache, HeadersFor(onPrepare, "sw.js").CacheControl.ToString());
        Assert.Equal(ExpectedNoCache, HeadersFor(onPrepare, "config.json").CacheControl.ToString());
        // .html is not in the custom list, so it no longer gets no-cache
        Assert.True(StringValues.IsNullOrEmpty(HeadersFor(onPrepare, "index.html").CacheControl));
        // Neither is manifest.json — an explicit custom list REPLACES the default set.
        Assert.True(StringValues.IsNullOrEmpty(HeadersFor(onPrepare, "manifest.json").CacheControl));
    }

    [Fact]
    public void UnknownStableFile_GetsDefaultCaching()
    {
        // A file not in the default suffix set (e.g. .txt that's not robots.txt)
        // stays on default caching. Documents the boundary of what the helper
        // covers vs what a consumer must add to a custom suffix list.
        var headers = HeadersFor(Install(new StaticFileOptions()), "notes.txt");
        Assert.True(StringValues.IsNullOrEmpty(headers.CacheControl));
    }
}

// ─── Integration tests — the exact prod reproduction (6.7.1) ─────────────────
//
// The unit tests above match on FILE NAME through StaticFilesMiddleware's
// OnPrepareResponse hook. That's sufficient for direct-URL requests like
// GET /index.html — but MISSES the default-document case: a bare GET / that
// MapFallbackToFile serves through its own file-sending pipeline, bypassing
// StaticFilesMiddleware entirely. This is exactly what bit Poppy/PBMInvoices
// in prod (20 Jul 2026): Ashley loaded the site root, MapFallbackToFile served
// index.html with no Cache-Control header, and Chrome heuristic-cached it
// across a deploy, silently pinning yesterday's hashed asset URLs.
//
// These tests spin up a REAL Kestrel host on a random port, curl / and
// /index.html, and assert the header treatment. The test that catches the
// bug — MapVmsShellFallbackToFile_SetsCacheControlOnRootRequest — mutation-
// proved: reverting the demo to raw MapFallbackToFile makes it fail LOUD.
public class VmsStaticFilesFallbackIntegrationTests : IAsyncLifetime
{
    private string _rootDir = string.Empty;
    private WebApplication? _app;
    private HttpClient? _client;

    public async Task InitializeAsync()
    {
        // Temp wwwroot with an index.html + a placeholder hashed asset so we can
        // also verify hashed assets still get default caching (no header).
        _rootDir = Path.Combine(Path.GetTempPath(), $"vms-fallback-test-{Guid.NewGuid():N}");
        Directory.CreateDirectory(_rootDir);
        var wwwroot = Path.Combine(_rootDir, "wwwroot");
        Directory.CreateDirectory(wwwroot);
        File.WriteAllText(Path.Combine(wwwroot, "index.html"),
            "<!doctype html><html><head><title>Test</title></head><body>Test shell</body></html>");
        File.WriteAllText(Path.Combine(wwwroot, "hashed-asset-abc123.js"), "// hashed asset");

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            ContentRootPath = _rootDir,
            WebRootPath = wwwroot,
        });
        // Random port — grab it after Start() so we can point HttpClient at it.
        builder.Configuration["urls"] = "http://127.0.0.1:0";
        _app = builder.Build();
        _app.UseDefaultFiles();
        _app.UseVmsShellStaticFiles();
        _app.MapVmsShellFallbackToFile("index.html");
        await _app.StartAsync();

        // Discover the actual port Kestrel bound to.
        var server = _app.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.Server.IServer>();
        var addresses = server.Features.Get<Microsoft.AspNetCore.Hosting.Server.Features.IServerAddressesFeature>();
        var url = addresses!.Addresses.First();
        _client = new HttpClient { BaseAddress = new Uri(url) };
    }

    public async Task DisposeAsync()
    {
        _client?.Dispose();
        if (_app is not null)
        {
            await _app.StopAsync();
            await _app.DisposeAsync();
        }
        if (Directory.Exists(_rootDir)) Directory.Delete(_rootDir, recursive: true);
    }

    // 🚨 THE prod-reproduction test. Missing from 6.7.0's gate. This is the
    // request Ashley makes when she loads the site: bare / with no filename.
    [Fact]
    public async Task RootRequest_GetsCacheControlNoCacheMustRevalidate()
    {
        var resp = await _client!.GetAsync("/");
        Assert.Equal(System.Net.HttpStatusCode.OK, resp.StatusCode);
        var cc = resp.Headers.CacheControl?.ToString() ?? string.Empty;
        Assert.Contains("no-cache", cc);
        Assert.Contains("must-revalidate", cc);
    }

    // The direct-URL path — already covered by the unit tests above via
    // OnPrepareResponse hook invocation, but re-verified end-to-end against
    // real Kestrel to prove the two paths (fallback + StaticFiles) emit the
    // SAME header value.
    [Fact]
    public async Task IndexHtmlRequest_GetsCacheControlNoCacheMustRevalidate()
    {
        var resp = await _client!.GetAsync("/index.html");
        Assert.Equal(System.Net.HttpStatusCode.OK, resp.StatusCode);
        var cc = resp.Headers.CacheControl?.ToString() ?? string.Empty;
        Assert.Contains("no-cache", cc);
        Assert.Contains("must-revalidate", cc);
    }

    // SPA client-route requests (a bookmarked /foo/bar path) also hit the
    // fallback. Same header treatment expected — this is why SPA users don't
    // get pinned to a stale bundle after a deploy.
    [Fact]
    public async Task SpaRouteRequest_GetsCacheControlNoCacheMustRevalidate()
    {
        var resp = await _client!.GetAsync("/some/spa/route");
        Assert.Equal(System.Net.HttpStatusCode.OK, resp.StatusCode);
        var cc = resp.Headers.CacheControl?.ToString() ?? string.Empty;
        Assert.Contains("no-cache", cc);
        Assert.Contains("must-revalidate", cc);
    }

    // Boundary: a hashed asset served through StaticFilesMiddleware (not the
    // fallback) stays on default caching. Proves the helper doesn't leak the
    // no-cache treatment to hashed assets — hashed assets self-invalidate via
    // filename hash, so stale-cache is harmless and long caching is correct.
    [Fact]
    public async Task HashedAssetRequest_KeepsDefaultCaching()
    {
        var resp = await _client!.GetAsync("/hashed-asset-abc123.js");
        Assert.Equal(System.Net.HttpStatusCode.OK, resp.StatusCode);
        // Default StaticFiles emits no explicit Cache-Control on hashed assets.
        Assert.Null(resp.Headers.CacheControl);
    }
}
