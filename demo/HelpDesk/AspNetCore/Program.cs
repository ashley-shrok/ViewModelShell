using HelpDesk;
using ViewModelShell;

var builder = WebApplication.CreateBuilder(args);

// 3.8.0 — version-skew: register the current-deployed client-build id. As of
// 3.11.1 AddVmsShellVersioning self-registers ShellVersionResultFilter (the
// serverBuild stamp); the guard is enforced by Parse(Request, id) in each action
// controller.
builder.Services.AddVmsShellVersioning(HelpDeskBuild.Id);

builder.Services.AddControllers(options =>
    {
        options.Filters.Add<ViewModelShell.ShellExceptionFilter>();
    })
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// HELPDESK_DB env var lets the parity harness point at a temp/fresh DB without polluting the demo's file.
var dbPath = Environment.GetEnvironmentVariable("HELPDESK_DB")
             ?? Path.Combine(builder.Environment.ContentRootPath, "helpdesk.db");
builder.Services.AddSingleton(_ => new HelpDeskDb($"Data Source={dbPath}"));

var app = builder.Build();

app.UseDefaultFiles();
app.UseVmsShellStaticFiles();

app.MapControllers();

// Canonical agent skill (1.5.0): serves a markdown operating manual for the VMS wire
// protocol at /.well-known/vms-skill.md, with a HelpDesk-specific preamble prepended.
// Advertised to agents via the `skill` field on the <meta name="viewmodel-shell"> tag
// in agent.html and requester.html. Mounted BEFORE MapFallbackToFile so the explicit
// route claims the path before the SPA fallback runs.
app.MapVmsAgentSkill(appPreamble: @"This is a help-desk ticketing app. Two roles share one SQLite DB: requesters create tickets at `/api/requester`; agents act on them at `/api/agent`. State holds the current view (queue / detail), the active filter, and per-row selection — see each controller's bind paths in the rendered tree.");

app.MapFallbackToFile("index.html");

app.Run();
