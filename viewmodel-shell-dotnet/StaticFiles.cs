// ─── ViewModel Shell — SPA shell static-files helper (1.8.0) ──────────────────
//
// Host-side helper (alongside MapVmsAgentSkill in AgentSkill.cs): a drop-in
// replacement for app.UseStaticFiles() that stamps `Cache-Control: no-cache` on
// the SPA *shell* HTML, so a deploy is never masked by a browser-cached shell
// pointing at an old (content-hashed) asset bundle. Vite gives assets
// hash-in-filename URLs, so a stale cached *asset* is harmless (the new build
// references a new filename) — but the shell HTML keeps its URL across deploys,
// so a cached shell silently pins the old bundle. This closes that gap once for
// every consuming app instead of each Program.cs re-deriving the rule.
//
// `no-cache` (NOT `no-store`): the browser still caches the shell but
// revalidates every load against the ETag UseStaticFiles already emits — a
// cheap 304 when unchanged, a full 200 right after a deploy. `no-store` would
// discard that 304 and force a full re-download every time for no benefit. (We
// deliberately do NOT add Pragma/Expires — HTTP/1.0 cruft modern browsers
// ignore — and do NOT try to mark hashed assets `immutable`: detecting a hash
// in a filename is fragile, and assets on default caching are already correct.)

namespace ViewModelShell;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.StaticFiles;

public static class VmsStaticFilesExtensions
{
    private static readonly string[] DefaultNoCacheSuffixes = { ".html" };

    /// <summary>
    /// Drop-in replacement for <c>app.UseStaticFiles()</c> that adds
    /// <c>Cache-Control: no-cache</c> to any served file whose name ends in one of
    /// <paramref name="noCacheSuffixes"/> (default: <c>.html</c>), so a Vite-built SPA
    /// shell is always revalidated and a deploy is never masked by a stale cached shell.
    /// Hashed asset bundles keep default caching. Composable: a caller-supplied
    /// <see cref="StaticFileOptions.OnPrepareResponse"/> runs first, then the no-cache rule.
    /// </summary>
    /// <param name="app">The application builder (typically <c>app</c> in Program.cs).</param>
    /// <param name="options">
    /// Optional <see cref="StaticFileOptions"/> to forward to <c>UseStaticFiles</c>. Its
    /// existing <c>OnPrepareResponse</c> is preserved and invoked before the no-cache rule.
    /// </param>
    /// <param name="noCacheSuffixes">
    /// Filename suffixes that get <c>no-cache</c>. Null or empty → <c>[".html"]</c>. Pass e.g.
    /// <c>[".html", "sw.js", "config.json"]</c> for other non-hashed, stable-URL files.
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
                    ctx.Context.Response.Headers.CacheControl = "no-cache";
                    return;
                }
            }
        };
        return app.UseStaticFiles(options);
    }
}
