// ─── ViewModel Shell — client/server version-skew (3.8.0) ─────────────────────
//
// The STAMP half of the version-skew feature (the GUARD half is app-driven via
// ActionPayload<T>.Parse(HttpRequest, currentBuild); see ViewModels.cs). A global
// result filter reads the configured current-build id and stamps `serverBuild`
// onto every controller-returned ShellResponse<T> — GET and POST alike — without
// each controller touching its return path.
//
// Registration — in the app's Program.cs:
//   builder.Services.AddVmsShellVersioning("<build-id>");
//   builder.Services.AddControllers(o =>
//   {
//       o.Filters.Add<ShellExceptionFilter>();
//       o.Filters.Add<ShellVersionResultFilter>();
//   });
//
// Additive & opt-in: an app that never calls AddVmsShellVersioning / never
// registers the filter is byte-identical to before (no VmsVersioningOptions in
// DI, no stamp). Mirrors the TS `createAction(handler, { currentBuild })` stamp.

namespace ViewModelShell;

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
/// <see cref="VmsVersioningOptions"/> via constructor DI. Register with
/// <c>options.Filters.Add&lt;ShellVersionResultFilter&gt;()</c> alongside
/// <see cref="ShellExceptionFilter"/>; the app must also call
/// <see cref="VmsVersioningExtensions.AddVmsShellVersioning"/> so the options are in DI.
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
/// 3.8.0 — registers <see cref="VmsVersioningOptions"/> so
/// <see cref="ShellVersionResultFilter"/> can stamp the current build id.
/// </summary>
public static class VmsVersioningExtensions
{
    /// <summary>
    /// Register the server's current-deployed client-build id for the version-skew feature.
    /// Pair with <c>options.Filters.Add&lt;ShellVersionResultFilter&gt;()</c> (the stamp) and
    /// <c>ActionPayload&lt;T&gt;.Parse(Request, currentBuild)</c> in each action controller
    /// (the fail-closed guard). Additive: omit it and behavior is byte-identical to before.
    /// </summary>
    /// <param name="services">The service collection (typically <c>builder.Services</c>).</param>
    /// <param name="currentBuild">The build id of the client bundle this server currently deploys.</param>
    /// <returns>The same service collection for fluent chaining.</returns>
    public static IServiceCollection AddVmsShellVersioning(
        this IServiceCollection services,
        string currentBuild)
    {
        services.AddSingleton(new VmsVersioningOptions { CurrentBuild = currentBuild });
        return services;
    }
}
