// Phase 07 Plan 03 — ShellExceptionFilter unit tests.
//
// Tests for all five exception paths (OnExceptionAsync) and both
// BadRequest-rewrite paths (OnResultExecutionAsync). Each [Fact] calls
// the filter directly with a manually-constructed context — no running
// ASP.NET host required (DefaultHttpContext + fake ActionContext).
//
// Key ASP.NET types (ExceptionContext, ResultExecutingContext, BadRequestObjectResult)
// come from <FrameworkReference Include="Microsoft.AspNetCore.App" /> in Tests.csproj.

namespace ViewModelShell.Tests;

using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using MvcActionDescriptor = Microsoft.AspNetCore.Mvc.Abstractions.ActionDescriptor;

public class ShellExceptionFilterTests
{
    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static ShellExceptionFilter CreateFilter() =>
        new ShellExceptionFilter(NullLogger<ShellExceptionFilter>.Instance);

    // Captures log entries so the 3.10.0 [vms:type-mismatch] diagnostic can be asserted.
    private sealed class CapturingLogger : ILogger<ShellExceptionFilter>
    {
        public readonly List<(LogLevel Level, string Message)> Entries = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
            Exception? exception, Func<TState, Exception?, string> formatter) =>
            Entries.Add((logLevel, formatter(state, exception)));
    }

    private static ActionContext MakeActionContext() =>
        new ActionContext(
            new DefaultHttpContext(),
            new RouteData(),
            new MvcActionDescriptor());

    private static ExceptionContext MakeExceptionContext(Exception ex)
    {
        var ctx = new ExceptionContext(MakeActionContext(), []);
        ctx.Exception = ex;
        return ctx;
    }

    private static string? GetContent(ExceptionContext ctx) =>
        (ctx.Result as ContentResult)?.Content;

    private static int? GetStatus(ExceptionContext ctx) =>
        (ctx.Result as ContentResult)?.StatusCode;

    private static JsonElement Parse(string? json)
    {
        ArgumentNullException.ThrowIfNull(json);
        return JsonSerializer.Deserialize<JsonElement>(json, _opts);
    }

    // ─── OnExceptionAsync: UnknownActionException → 400 + unknown_action ─────

    [Fact]
    public async Task OnExceptionAsync_UnknownAction_Returns400WithUnknownActionCode()
    {
        var filter = CreateFilter();
        var ex = new UnknownActionException("foo");
        var ctx = MakeExceptionContext(ex);

        await filter.OnExceptionAsync(ctx);

        Assert.True(ctx.ExceptionHandled, "ExceptionHandled must be set to true");
        Assert.Equal(400, GetStatus(ctx));

        var body = Parse(GetContent(ctx));
        Assert.False(body.GetProperty("ok").GetBoolean());
        var errors = body.GetProperty("errors");
        Assert.Equal(1, errors.GetArrayLength());
        var entry = errors[0];
        Assert.Contains("foo", entry.GetProperty("message").GetString());
        Assert.Equal(ErrorCodes.UnknownAction, entry.GetProperty("code").GetString());
    }

    // ─── OnExceptionAsync: JsonException → 400 + parse_error ─────────────────

    [Fact]
    public async Task OnExceptionAsync_JsonException_Returns400WithParseErrorCode()
    {
        var filter = CreateFilter();
        var ex = new JsonException("unexpected token at position 12");
        var ctx = MakeExceptionContext(ex);

        await filter.OnExceptionAsync(ctx);

        Assert.True(ctx.ExceptionHandled);
        Assert.Equal(400, GetStatus(ctx));

        var body = Parse(GetContent(ctx));
        Assert.False(body.GetProperty("ok").GetBoolean());
        var errors = body.GetProperty("errors");
        Assert.Equal(1, errors.GetArrayLength());
        var entry = errors[0];
        Assert.Equal(ErrorCodes.Parse, entry.GetProperty("code").GetString());
        Assert.Contains("unexpected token", entry.GetProperty("message").GetString());
    }

    // ─── OnExceptionAsync: type-mismatch JsonException → parse_error (unchanged) + [vms:type-mismatch] log (3.10.0) ─

    [Fact]
    public async Task OnExceptionAsync_TypeMismatchJsonException_LogsVmsTypeMismatch_AndStillReturnsParseError()
    {
        var logger = new CapturingLogger();
        var filter = new ShellExceptionFilter(logger);
        // A typed _state deserialize CONVERSION failure: STJ sets .Path and a
        // "could not be converted" message (e.g. a {filename,size} object landing
        // in a string-typed slot).
        var ex = new JsonException(
            "The JSON value could not be converted to System.String.",
            "$.bulkAddFormValues.invoiceFile", null, null);
        var ctx = MakeExceptionContext(ex);

        await filter.OnExceptionAsync(ctx);

        // Wire is UNCHANGED — still a 400 parse_error.
        Assert.True(ctx.ExceptionHandled);
        Assert.Equal(400, GetStatus(ctx));
        var entry = Parse(GetContent(ctx)).GetProperty("errors")[0];
        Assert.Equal(ErrorCodes.Parse, entry.GetProperty("code").GetString());

        // The certain server-side diagnostic fired: a Warning carrying the prefix + the JSON path.
        var warn = Assert.Single(logger.Entries.FindAll(e => e.Level == LogLevel.Warning));
        Assert.Contains("[vms:type-mismatch]", warn.Message);
        Assert.Contains("$.bulkAddFormValues.invoiceFile", warn.Message);
    }

    [Fact]
    public async Task OnExceptionAsync_SyntaxJsonException_DoesNotLogTypeMismatch()
    {
        var logger = new CapturingLogger();
        var filter = new ShellExceptionFilter(logger);
        // Structurally malformed JSON (no .Path, no "could not be converted") must
        // stay a plain parse_error with NO type-mismatch diagnostic.
        var ex = new JsonException("unexpected token at position 12");
        var ctx = MakeExceptionContext(ex);

        await filter.OnExceptionAsync(ctx);

        Assert.Equal(400, GetStatus(ctx));
        Assert.DoesNotContain(logger.Entries, e => e.Message.Contains("[vms:type-mismatch]"));
    }

    // ─── OnExceptionAsync: InvalidOperationException from ValidateActionNames → 500 + invalid_tree ─

    [Fact]
    public async Task OnExceptionAsync_InvalidOperationFromValidateActionNames_Returns500WithInvalidTreeCode()
    {
        var filter = CreateFilter();

        // Throw an InvalidOperationException from a method named ValidateActionNames so its
        // StackTrace contains the method name — matching the heuristic in ShellExceptionFilter.
        var capturedEx = ThrowFromValidateActionNames();
        Assert.NotNull(capturedEx);

        var ctx = MakeExceptionContext(capturedEx);

        await filter.OnExceptionAsync(ctx);

        Assert.True(ctx.ExceptionHandled);
        Assert.Equal(500, GetStatus(ctx));

        var body = Parse(GetContent(ctx));
        Assert.False(body.GetProperty("ok").GetBoolean());
        Assert.Equal(1, body.GetProperty("errors").GetArrayLength());
        Assert.Equal(ErrorCodes.InvalidTree, body.GetProperty("errors")[0].GetProperty("code").GetString());
    }

    // Helper: throws an InvalidOperationException from a method named ValidateActionNames
    // so its StackTrace contains the method name — simulating what the real validator throws.
    private static InvalidOperationException ThrowFromValidateActionNames()
    {
        try { ValidateActionNames(); }
        catch (InvalidOperationException ex) { return ex; }
        return new InvalidOperationException("unreachable");
    }
    private static void ValidateActionNames() =>
        throw new InvalidOperationException("Duplicate action name: 'duplicate'");

    // ─── OnExceptionAsync: generic Exception → 500 + uncaught_exception ──────

    [Fact]
    public async Task OnExceptionAsync_GenericException_Returns500WithUncaughtCode()
    {
        var filter = CreateFilter();
        var ex = new Exception("deliberate test failure");
        var ctx = MakeExceptionContext(ex);

        await filter.OnExceptionAsync(ctx);

        Assert.True(ctx.ExceptionHandled);
        Assert.Equal(500, GetStatus(ctx));

        var body = Parse(GetContent(ctx));
        Assert.False(body.GetProperty("ok").GetBoolean());
        Assert.Equal(ErrorCodes.Uncaught, body.GetProperty("errors")[0].GetProperty("code").GetString());
        Assert.Contains("deliberate test failure", body.GetProperty("errors")[0].GetProperty("message").GetString());
    }

    // ─── T1: generic uncaught path must not leak stack-trace markers ─────────

    [Fact]
    public async Task OnExceptionAsync_GenericException_T1_DoesNotLeakStackTrace()
    {
        var filter = CreateFilter();

        // Throw a real exception so it has a populated StackTrace.
        Exception? ex;
        try { throw new InvalidOperationException("outer message"); }
        catch (Exception caught) { ex = caught; }

        var ctx = MakeExceptionContext(ex!);
        await filter.OnExceptionAsync(ctx);

        var json = GetContent(ctx) ?? "";

        // T1 mitigation: stack trace markers must NOT appear in the wire body.
        Assert.DoesNotContain("   at ", json);
        Assert.DoesNotContain("System.InvalidOperationException", json);

        // The message itself SHOULD appear (OfUncaught uses ex.Message).
        Assert.Contains("outer message", json);
    }

    // ─── OnResultExecutionAsync: BadRequestObjectResult → envelope ───────────

    [Fact]
    public async Task OnResultExecutionAsync_BadRequestObjectResult_Rewrites()
    {
        var filter = CreateFilter();
        var actionCtx = MakeActionContext();
        var resultCtx = new ResultExecutingContext(actionCtx, [], new BadRequestObjectResult("title required"), null!);

        bool nextCalled = false;
        await filter.OnResultExecutionAsync(resultCtx, async () =>
        {
            nextCalled = true;
            return await Task.FromResult<ResultExecutedContext>(null!);
        });

        Assert.True(nextCalled, "next() delegate must be called");
        var content = Assert.IsType<ContentResult>(resultCtx.Result);
        Assert.Equal(400, content.StatusCode);

        var body = Parse(content.Content);
        Assert.False(body.GetProperty("ok").GetBoolean());
        Assert.Equal(1, body.GetProperty("errors").GetArrayLength());
        Assert.Equal("title required", body.GetProperty("errors")[0].GetProperty("message").GetString());
        // D-08: no code on BadRequest rewrites
        Assert.False(body.GetProperty("errors")[0].TryGetProperty("code", out _));
    }

    // ─── OnResultExecutionAsync: BadRequestResult (no body) → envelope ───────

    [Fact]
    public async Task OnResultExecutionAsync_BadRequestResult_Rewrites()
    {
        var filter = CreateFilter();
        var actionCtx = MakeActionContext();
        var resultCtx = new ResultExecutingContext(actionCtx, [], new BadRequestResult(), null!);

        bool nextCalled = false;
        await filter.OnResultExecutionAsync(resultCtx, async () =>
        {
            nextCalled = true;
            return await Task.FromResult<ResultExecutedContext>(null!);
        });

        Assert.True(nextCalled);
        var content = Assert.IsType<ContentResult>(resultCtx.Result);
        Assert.Equal(400, content.StatusCode);

        var body = Parse(content.Content);
        Assert.False(body.GetProperty("ok").GetBoolean());
        Assert.Equal("Bad request", body.GetProperty("errors")[0].GetProperty("message").GetString());
        Assert.False(body.GetProperty("errors")[0].TryGetProperty("code", out _));
    }
}
