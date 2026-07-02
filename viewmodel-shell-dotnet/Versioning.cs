// ─── ViewModel Shell — client/server version-skew (3.8.0) ─────────────────────
//
// The STAMP half of the version-skew feature (the GUARD half is app-driven via
// ActionPayload<T>.Parse(HttpRequest, currentBuild); see ViewModels.cs). A global
// result filter reads the configured current-build id and stamps `serverBuild`
// onto every controller-returned ShellResponse<T> — GET and POST alike — without
// each controller touching its return path.
//
// Registration — in the app's Program.cs (3.11.1+): AddVmsShellVersioning
// self-registers ShellVersionResultFilter, so one call wires the whole stamp:
//   builder.Services.AddVmsShellVersioning();          // or AddVmsShellVersioning("<build-id>")
//   builder.Services.AddControllers(o => o.Filters.Add<ShellExceptionFilter>());
//
// Additive & opt-in: an app that never calls AddVmsShellVersioning is
// byte-identical to before (no VmsVersioningOptions in DI, no filter, no stamp).
// Mirrors the TS `createAction(handler, { currentBuild })` stamp.

namespace ViewModelShell;

using System.Linq;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.DependencyInjection;

/// <summary>
/// 3.8.0 — carries the server's current-deployed client-build id for the
/// version-skew feature. Registered as a singleton via
/// <see cref="VmsVersioningExtensions.AddVmsShellVersioning"/> and consumed by
/// <see cref="ShellVersionResultFilter"/> (the stamp) — the guard half is
/// app-driven through <c>ActionPayload&lt;T&gt;.Parse(HttpRequest, currentBuild)</c>.
/// </summary>
public sealed class VmsVersioningOptions
{
    /// <summary>
    /// The build id of the client bundle this server currently deploys. Stamped onto
    /// every <see cref="IShellResponse"/> result. Null/empty = versioning off (no stamp).
    /// </summary>
    public string? CurrentBuild { get; init; }
}

/// <summary>
/// 3.8.0 — global result filter that stamps <see cref="ShellResponse{TState}.ServerBuild"/>
/// onto every controller-returned shell response when a current build is configured, so a
/// long-lived (never-reloaded) client can detect that the server has rolled forward. Reads
/// <see cref="VmsVersioningOptions"/> via constructor DI. As of 3.11.1 this filter is
/// self-registered by <see cref="VmsVersioningExtensions.AddVmsShellVersioning"/> (which
/// also puts the options in DI), so an app does not add it by hand.
/// </summary>
public sealed class ShellVersionResultFilter : IResultFilter
{
    private readonly VmsVersioningOptions _options;

    public ShellVersionResultFilter(VmsVersioningOptions options)
    {
        _options = options;
    }

    public void OnResultExecuting(ResultExecutingContext context)
    {
        var build = _options.CurrentBuild;
        if (string.IsNullOrEmpty(build)) return;

        // A controller returning ShellResponse<T> (from a GET, or via
        // ActionResult<ShellResponse<T>> on a POST) is wrapped in an ObjectResult
        // before result filters run. Error envelopes (from ShellExceptionFilter)
        // are ContentResults, not ObjectResults, so they never get stamped.
        if (context.Result is ObjectResult obj && obj.Value is IShellResponse sr)
        {
            obj.Value = sr.WithServerBuild(build);
        }
    }

    public void OnResultExecuted(ResultExecutedContext context) { }
}

/// <summary>
/// 3.11.0 — computes the client build id by hashing the built Vite
/// <c>manifest.json</c>, the .NET twin of the npm <c>vmsHashManifestBytes</c>
/// (<c>@ashley-shrok/viewmodel-shell/vite</c>). The LOCKED cross-backend
/// contract: <b>SHA-256 of the raw <c>manifest.json</c> file bytes on disk → the
/// first 12 hex chars, LOWERCASE</b>. No re-serialize, no normalization, no BOM.
/// A missing manifest yields the sentinel <c>"dev-none"</c> (guard inert in dev).
/// </summary>
internal static class VmsManifestBuildId
{
    /// <summary>
    /// Hash <c>{webRootPath}/manifest.json</c> into a 12-hex-lowercase build id,
    /// or return <c>"dev-none"</c> when the manifest is absent.
    /// </summary>
    public static string Compute(string webRootPath)
    {
        var path = Path.Combine(webRootPath ?? "", "manifest.json");
        return File.Exists(path)
            // Convert.ToHexString yields UPPERCASE — .ToLowerInvariant() is
            // REQUIRED to match node's lowercase hex digest.
            ? Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(path)))[..12].ToLowerInvariant()
            : "dev-none";
    }
}

/// <summary>
/// 3.8.0 — registers <see cref="VmsVersioningOptions"/> so
/// <see cref="ShellVersionResultFilter"/> can stamp the current build id.
/// </summary>
public static class VmsVersioningExtensions
{
    /// <summary>
    /// Register the server's current-deployed client-build id for the version-skew feature.
    /// As of 3.11.1 this ALSO self-registers <see cref="ShellVersionResultFilter"/> on
    /// <see cref="MvcOptions"/> (the Phase-1 <c>serverBuild</c> stamp) — you no longer add it
    /// by hand; just add <c>ActionPayload&lt;T&gt;.Parse(Request, currentBuild)</c> in each
    /// action controller for the fail-closed guard. Additive: omit this call and behavior is
    /// byte-identical to before (no options, no filter, no stamp).
    /// </summary>
    /// <param name="services">The service collection (typically <c>builder.Services</c>).</param>
    /// <param name="currentBuild">The build id of the client bundle this server currently deploys.</param>
    /// <returns>The same service collection for fluent chaining.</returns>
    public static IServiceCollection AddVmsShellVersioning(
        this IServiceCollection services,
        string currentBuild)
    {
        services.AddSingleton(new VmsVersioningOptions { CurrentBuild = currentBuild });
        AddVersionResultFilter(services);
        return services;
    }

    /// <summary>
    /// 3.11.0 — no-arg overload that self-hashes the build id from the built
    /// <c>wwwroot/manifest.json</c> (see <see cref="VmsManifestBuildId"/>), so an
    /// adopter no longer hand-rolls the C# hash snippet. Adoption drops to one
    /// line: <c>services.AddVmsShellVersioning();</c>. Because the value depends
    /// on <see cref="IWebHostEnvironment.WebRootPath"/> (unavailable at
    /// ConfigureServices time), this registers via a <b>lazy factory</b> — the
    /// hash is computed once, on first resolution of
    /// <see cref="VmsVersioningOptions"/> (i.e. the first
    /// <see cref="ShellVersionResultFilter"/> construction). Like the string
    /// overload it also self-registers that filter (3.11.1) — the only thing an
    /// adopter adds beyond this one line is
    /// <c>ActionPayload&lt;T&gt;.Parse(Request, opts.CurrentBuild)</c> in each
    /// action controller for the fail-closed guard.
    /// <para>
    /// Fleet constraint: do NOT modify <c>manifest.json</c> post-build (a
    /// deploy-pipeline minifier/prettifier between Vite emit and .NET startup
    /// changes the raw bytes and diverges the client/server hashes).
    /// </para>
    /// </summary>
    /// <param name="services">The service collection (typically <c>builder.Services</c>).</param>
    /// <returns>The same service collection for fluent chaining.</returns>
    public static IServiceCollection AddVmsShellVersioning(this IServiceCollection services)
    {
        services.AddSingleton(sp =>
        {
            var env = sp.GetRequiredService<IWebHostEnvironment>();
            return new VmsVersioningOptions { CurrentBuild = VmsManifestBuildId.Compute(env.WebRootPath) };
        });
        AddVersionResultFilter(services);
        return services;
    }

    /// <summary>
    /// 3.11.1 — self-register <see cref="ShellVersionResultFilter"/> on
    /// <see cref="MvcOptions"/> so the Phase-1 <c>serverBuild</c> stamp is part of
    /// "registering versioning" (previously the app had to add it by hand, and if
    /// forgotten Phase-1 skew detection silently no-op'd). Dedup-guarded so a
    /// legacy caller that still adds it manually doesn't register it twice; a
    /// double-registration would be harmless anyway (the stamp is idempotent), but
    /// this keeps exactly one filter in the pipeline.
    /// </summary>
    private static void AddVersionResultFilter(IServiceCollection services)
    {
        services.Configure<MvcOptions>(o =>
        {
            bool already = o.Filters.OfType<TypeFilterAttribute>()
                .Any(f => f.ImplementationType == typeof(ShellVersionResultFilter));
            if (!already) o.Filters.Add<ShellVersionResultFilter>();
        });
    }
}
