using HelpDesk;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
    });

var dbPath = Path.Combine(builder.Environment.ContentRootPath, "helpdesk.db");
builder.Services.AddSingleton(_ => new HelpDeskDb($"Data Source={dbPath}"));

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

app.MapFallbackToFile("index.html");

app.Run();
