// ─── ViewModel Shell — canonical agent skill mount helper (1.5.0) ────────────
//
// HTTP-only helper: serves the canonical VMS agent skill markdown at a
// caller-supplied path (default /.well-known/vms-skill.md). Mirrors the
// TypeScript twin `createAgentSkillHandler` in viewmodel-shell/src/server.ts.
//
// The skill itself ships as the embedded resource
// `AshleyShrok.ViewModelShell.AgentSkill.md` (see the csproj's
// <EmbeddedResource Include="AgentSkill.md" LogicalName="..."/> block) and is
// kept byte-identical to viewmodel-shell/agent-skill.md by the source-tree
// diff in parity/check-skill.ts.

namespace ViewModelShell;

using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

public static class AgentSkillExtensions
{
    private const string EmbeddedResourceName = "AshleyShrok.ViewModelShell.AgentSkill.md";

    /// <summary>
    /// Mount the canonical VMS agent skill markdown at <paramref name="path"/>.
    /// The skill is a self-contained operating manual for the VMS wire protocol;
    /// advertise it to agents via the <c>skill</c> field on the
    /// <c>&lt;meta name="viewmodel-shell"&gt;</c> tag.
    /// </summary>
    /// <param name="endpoints">The endpoint route builder (typically <c>app</c> in Program.cs).</param>
    /// <param name="path">Well-known URL the skill is served at. Default <c>/.well-known/vms-skill.md</c>.</param>
    /// <param name="appPreamble">
    /// Optional app-specific context prepended above the canonical skill under a
    /// <c>## App-specific notes</c> heading with an <c>---</c> separator. Useful for
    /// naming the app's domain, auth requirements, or anything an agent should know
    /// before reading the canonical protocol manual.
    /// </param>
    /// <returns>The same endpoint builder for fluent chaining.</returns>
    /// <exception cref="InvalidOperationException">
    /// Thrown at mount time (not first request) if the embedded resource
    /// <c>AshleyShrok.ViewModelShell.AgentSkill.md</c> is absent from the assembly —
    /// typically a build-system misconfiguration. Fail-loud rule (AGENTS.md capability
    /// seam): a silently-404'd skill endpoint would defeat the purpose.
    /// </exception>
    public static IEndpointRouteBuilder MapVmsAgentSkill(
        this IEndpointRouteBuilder endpoints,
        string path = "/.well-known/vms-skill.md",
        string? appPreamble = null)
    {
        // Resolve canonical body ONCE at mount time. Per-request cost is just an
        // `await Response.WriteAsync(body)` — no fs / no reflection.
        string canonical = LoadCanonical();
        string preamble = appPreamble?.Trim() ?? "";
        string body = preamble.Length == 0
            ? canonical
            : $"## App-specific notes\n\n{preamble}\n\n---\n\n{canonical}";

        endpoints.MapGet(path, async (HttpContext ctx) =>
        {
            ctx.Response.ContentType = "text/markdown; charset=utf-8";
            await ctx.Response.WriteAsync(body);
        });
        return endpoints;
    }

    /// <summary>
    /// Load the canonical skill markdown from the embedded resource.
    /// Throws if the resource is absent (build-system misconfiguration).
    /// Internal so the Tests project can pin the resource is actually embedded;
    /// see InternalsVisibleTo in AshleyShrok.ViewModelShell.csproj.
    /// </summary>
    internal static string LoadCanonical()
    {
        Assembly asm = typeof(AgentSkillExtensions).Assembly;
        using Stream? stream = asm.GetManifestResourceStream(EmbeddedResourceName);
        if (stream is null)
        {
            throw new InvalidOperationException(
                $"Expected embedded resource '{EmbeddedResourceName}' in assembly '{asm.GetName().Name}'. " +
                "AgentSkill.md must be embedded as a logical resource by AshleyShrok.ViewModelShell.csproj. " +
                "This is a build-system misconfiguration; the published NuGet package always embeds it.");
        }
        using StreamReader reader = new(stream);
        return reader.ReadToEnd();
    }
}
