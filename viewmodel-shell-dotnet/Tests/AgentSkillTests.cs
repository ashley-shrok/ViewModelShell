// 260614-hey — AgentSkillExtensions.MapVmsAgentSkill xUnit suite.
//
// Mirrors the TS createAgentSkillHandler vitest suite. Uses Microsoft.AspNetCore.TestHost's
// HostBuilder + UseTestServer pattern (the lightweight minimal-API testing path —
// no WebApplicationFactory, no project-level TEntryPoint).
//
// The LoadCanonical_RealAssembly fact relies on InternalsVisibleTo("Tests") in
// AshleyShrok.ViewModelShell.csproj — see that file's <ItemGroup>.

namespace ViewModelShell.Tests;

using System.Net;
using System.Reflection;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

public class AgentSkillTests
{
    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static async Task<(HttpClient client, IHost host)> StartHostAsync(
        Action<IEndpointRouteBuilder> configure)
    {
        var builder = new HostBuilder()
            .ConfigureWebHost(webHost =>
            {
                webHost.UseTestServer();
                webHost.ConfigureServices(services =>
                {
                    services.AddRouting();
                });
                webHost.Configure(app =>
                {
                    app.UseRouting();
                    app.UseEndpoints(configure);
                });
            });
        var host = await builder.StartAsync();
        return (host.GetTestClient(), host);
    }

    private static string ReadEmbeddedCanonical()
    {
        Assembly asm = typeof(AgentSkillExtensions).Assembly;
        using Stream? stream = asm.GetManifestResourceStream("AshleyShrok.ViewModelShell.AgentSkill.md");
        Assert.NotNull(stream);
        using StreamReader reader = new(stream!);
        return reader.ReadToEnd();
    }

    // ─── Facts ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task MapVmsAgentSkill_DefaultPath_Returns200WithCanonicalBody()
    {
        var (client, host) = await StartHostAsync(endpoints => endpoints.MapVmsAgentSkill());
        try
        {
            var res = await client.GetAsync("/.well-known/vms-skill.md");
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            string body = await res.Content.ReadAsStringAsync();
            Assert.Equal(ReadEmbeddedCanonical(), body);
        }
        finally
        {
            await host.StopAsync();
            host.Dispose();
        }
    }

    [Fact]
    public async Task MapVmsAgentSkill_CustomPath_Returns200()
    {
        var (client, host) = await StartHostAsync(endpoints => endpoints.MapVmsAgentSkill("/my-skill.md"));
        try
        {
            var custom = await client.GetAsync("/my-skill.md");
            Assert.Equal(HttpStatusCode.OK, custom.StatusCode);

            var defaultPath = await client.GetAsync("/.well-known/vms-skill.md");
            Assert.Equal(HttpStatusCode.NotFound, defaultPath.StatusCode);
        }
        finally
        {
            await host.StopAsync();
            host.Dispose();
        }
    }

    [Fact]
    public async Task MapVmsAgentSkill_WithPreamble_PrependsPreambleAndSeparator()
    {
        var (client, host) = await StartHostAsync(endpoints =>
            endpoints.MapVmsAgentSkill(appPreamble: "test preamble"));
        try
        {
            var res = await client.GetAsync("/.well-known/vms-skill.md");
            Assert.Equal(HttpStatusCode.OK, res.StatusCode);
            string body = await res.Content.ReadAsStringAsync();
            string expectedPrefix = "## App-specific notes\n\ntest preamble\n\n---\n\n";
            Assert.StartsWith(expectedPrefix, body);
            Assert.EndsWith(ReadEmbeddedCanonical(), body);
        }
        finally
        {
            await host.StopAsync();
            host.Dispose();
        }
    }

    [Fact]
    public async Task MapVmsAgentSkill_ContentTypeIsTextMarkdown()
    {
        var (client, host) = await StartHostAsync(endpoints => endpoints.MapVmsAgentSkill());
        try
        {
            var res = await client.GetAsync("/.well-known/vms-skill.md");
            Assert.Equal("text/markdown", res.Content.Headers.ContentType?.MediaType);
            Assert.Equal("utf-8", res.Content.Headers.ContentType?.CharSet);
        }
        finally
        {
            await host.StopAsync();
            host.Dispose();
        }
    }

    [Fact]
    public async Task MapVmsAgentSkill_EmptyPreamble_OmitsHeader()
    {
        var (client, host) = await StartHostAsync(endpoints =>
            endpoints.MapVmsAgentSkill(appPreamble: "   "));
        try
        {
            var res = await client.GetAsync("/.well-known/vms-skill.md");
            string body = await res.Content.ReadAsStringAsync();
            Assert.Equal(ReadEmbeddedCanonical(), body);
            Assert.DoesNotContain("## App-specific notes", body);
        }
        finally
        {
            await host.StopAsync();
            host.Dispose();
        }
    }

    [Fact]
    public void LoadCanonical_RealAssembly_ReturnsNonEmpty()
    {
        // InternalsVisibleTo("Tests") in the framework csproj makes LoadCanonical reachable.
        string canonical = AgentSkillExtensions.LoadCanonical();
        Assert.False(string.IsNullOrEmpty(canonical));
        // Pins that the embedded resource really is the canonical skill, not a placeholder.
        Assert.Contains("viewmodel-shell/1.0", canonical);
    }
}
