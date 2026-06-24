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

    [Fact]
    public void ShellHtml_GetsNoCache()
    {
        var headers = HeadersFor(Install(new StaticFileOptions()), "index.html");
        Assert.Equal("no-cache", headers.CacheControl.ToString());
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
        Assert.True(priorRan);                                       // caller's hook still fires
        Assert.Equal("no-cache", headers.CacheControl.ToString());   // and our rule applied on top
    }

    [Fact]
    public void CustomSuffixes_OverrideTheDefault()
    {
        var onPrepare = Install(new StaticFileOptions(), new[] { "sw.js", "config.json" });
        Assert.Equal("no-cache", HeadersFor(onPrepare, "sw.js").CacheControl.ToString());
        Assert.Equal("no-cache", HeadersFor(onPrepare, "config.json").CacheControl.ToString());
        // .html is not in the custom list, so it no longer gets no-cache
        Assert.True(StringValues.IsNullOrEmpty(HeadersFor(onPrepare, "index.html").CacheControl));
    }
}
