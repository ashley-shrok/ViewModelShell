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
