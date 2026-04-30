// Showcase serves the static frontend (which renders a hardcoded ViewNode
// tree directly via BrowserAdapter). No controllers — the page is purely
// a visual reference for the framework's emitted classes.

var builder = WebApplication.CreateBuilder(args);
var app     = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapFallbackToFile("index.html");

app.Run();
