using ViewModelShell;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers(options =>
    {
        options.Filters.Add<ViewModelShell.ShellExceptionFilter>();
    })
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
        // Match the natural TS wire — optional fields OMITTED, never null
        // (AGENTS.md gotcha #8). LOAD-BEARING: this drops null keys on app
        // state records, which the intrinsic attributes on ViewNode types
        // don't cover.
        o.JsonSerializerOptions.DefaultIgnoreCondition =
            System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

var app = builder.Build();

app.UseDefaultFiles();
app.UseVmsShellStaticFiles();

app.MapControllers();

app.MapVmsShellFallbackToFile("index.html");

app.Run();
