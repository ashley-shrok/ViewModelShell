// ─── ViewModel Shell — SPA shell static-files helper (1.8.0 / broadened 6.7.0) ──
//
// Host-side helper (alongside MapVmsAgentSkill in AgentSkill.cs): a drop-in
// replacement for app.UseStaticFiles() that stamps `Cache-Control: no-cache,
// must-revalidate` on the SPA *shell* files (HTML + manifest + service worker +
// robots), so a deploy is never masked by a browser-cached shell pointing at an
// old (content-hashed) asset bundle. Vite gives assets hash-in-filename URLs,
// so a stale cached *asset* is harmless (the new build references a new
// filename) — but the shell files keep their URLs across deploys, so a cached
// shell silently pins the old bundle. This closes that gap once for every
// consuming app instead of each Program.cs re-deriving the rule.
//
// 6.7.0 — broadened the default suffix list from `[".html"]` to also cover
// `manifest.json`, `sw.js`, and `robots.txt`. A prod PBMInvoices bug (Ashley
// loaded a stale bundle even though HTML was covered, because Chrome had
// heuristic-cached the manifest referencing yesterday's hashed assets) proved
// that `.html`-only coverage isn't enough — every stable-URL non-hashed SPA
// shell file needs revalidation for the primitive to actually deliver on its
// "solved permanently" promise. Also added `must-revalidate` alongside
// `no-cache` for defense-in-depth against old proxies.
//
// `no-cache` (NOT `no-store`): the browser still caches the shell but
// revalidates every load against the ETag UseStaticFiles already emits — a
// cheap 304 when unchanged, a full 200 right after a deploy. `no-store` would
// discard that 304 and force a full re-download every time for no benefit. (We
// deliberately do NOT add Pragma/Expires — HTTP/1.0 cruft modern browsers
// ignore — and do NOT try to mark hashed assets `immutable`: detecting a hash
// in a filename is fragile, and assets on default caching are already correct.
// The stale-shell class is what bit adopters; hashed-asset caching didn't.)

namespace ViewModelShell;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.StaticFiles;

public static class VmsStaticFilesExtensions
{
    /// <summary>The default set of shell-file suffixes that receive
    /// <c>Cache-Control: no-cache, must-revalidate</c>. Every entry is a
    /// stable-URL non-hashed file that a browser can safely refetch cheaply
    /// (ETag 304 when unchanged) and that would silently pin an old bundle if
    /// heuristic-cached across a deploy. Broadened 6.7.0 from
    /// <c>[".html"]</c> after the prod stale-manifest bug.</summary>
    private static readonly string[] DefaultNoCacheSuffixes =
    {
        ".html",         // The SPA shell HTML — Vite's index.html and any others.
        "manifest.json", // PWA manifest referencing icons + start URL — heuristic-caches easily.
        "sw.js",         // Service worker — its own update semantics require fresh fetch.
        "robots.txt",    // Small, non-hashed, indexed by crawlers who want fresh.
    };

    /// <summary>The Cache-Control value applied to matched shell files. `no-cache`
    /// (revalidate every load against the ETag) + `must-revalidate` (belt-and-
    /// suspenders for old proxies that may not honor `no-cache` alone).</summary>
    private const string NoCacheValue = "no-cache, must-revalidate";

    /// <summary>
    /// Drop-in replacement for <c>app.UseStaticFiles()</c> that adds
    /// <c>Cache-Control: no-cache, must-revalidate</c> to any served file whose name
    /// ends in one of <paramref name="noCacheSuffixes"/> (default: <c>.html</c>,
    /// <c>manifest.json</c>, <c>sw.js</c>, <c>robots.txt</c>), so a Vite-built SPA shell
    /// is always revalidated and a deploy is never masked by a stale cached shell file.
    /// Hashed asset bundles keep default caching. Composable: a caller-supplied
    /// <see cref="StaticFileOptions.OnPrepareResponse"/> runs first, then the no-cache rule.
    /// </summary>
    /// <param name="app">The application builder (typically <c>app</c> in Program.cs).</param>
    /// <param name="options">
    /// Optional <see cref="StaticFileOptions"/> to forward to <c>UseStaticFiles</c>. Its
    /// existing <c>OnPrepareResponse</c> is preserved and invoked before the no-cache rule.
    /// </param>
    /// <param name="noCacheSuffixes">
    /// Filename suffixes that get <c>no-cache, must-revalidate</c>. Null or empty →
    /// the default set (<c>.html</c>, <c>manifest.json</c>, <c>sw.js</c>,
    /// <c>robots.txt</c>). Pass a custom list to override the default entirely — e.g.
    /// <c>[".html", "config.json"]</c> for an app whose non-hashed stable-URL set differs.
    /// </param>
    /// <returns>The same application builder for fluent chaining.</returns>
    public static IApplicationBuilder UseVmsShellStaticFiles(
        this IApplicationBuilder app,
        StaticFileOptions? options = null,
        IReadOnlyCollection<string>? noCacheSuffixes = null)
    {
        string[] suffixes = noCacheSuffixes is { Count: > 0 }
            ? noCacheSuffixes.ToArray()
            : DefaultNoCacheSuffixes;

        options ??= new StaticFileOptions();
        var prior = options.OnPrepareResponse;
        options.OnPrepareResponse = ctx =>
        {
            prior?.Invoke(ctx);
            string name = ctx.File.Name;
            foreach (string suffix in suffixes)
            {
                if (name.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
                {
                    ctx.Context.Response.Headers.CacheControl = NoCacheValue;
                    return;
                }
            }
        };
        return app.UseStaticFiles(options);
    }
}
