using HelpDesk;

var builder = WebApplication.CreateBuilder(args);

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
app.UseStaticFiles();

app.MapControllers();

app.MapFallbackToFile("index.html");

app.Run();
