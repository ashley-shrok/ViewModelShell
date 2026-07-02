using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Logging;

namespace ViewModelShell;

// ─────────────────────────────────────────────────────────────────────────────
// ShellExceptionFilter — framework-edge exception filter (D-06).
//
// Implements BOTH IAsyncExceptionFilter AND IAsyncResultFilter so that:
//   • Thrown exceptions (UnknownActionException, JsonException, generic Exception,
//     and InvalidOperationException from ValidateActionNames) are intercepted at
//     the exception-filter stage and converted to structured ShellErrorResponse
//     envelopes — without any per-controller try/catch boilerplate.
//   • Controller-returned BadRequestObjectResult / BadRequestResult (the
//     structured-input-validation channel per D-08) are rewritten to the same
//     envelope shape on the way out, keeping the wire uniform.
//
// Registration — in every .NET demo Program.cs:
//   builder.Services.AddControllers(options =>
//   {
//       options.Filters.Add<ShellExceptionFilter>();
//   });
//
// JsonSerializer config: camelCase to match the TS twin and the demo wire
// convention (PropertyNamingPolicy = JsonNamingPolicy.CamelCase). This matches
// the demos' AddJsonOptions configuration. Using explicit options here (not
// relying on the host's options injection) keeps the filter self-contained and
// testable without a running ASP.NET DI container.
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// Framework-edge exception filter. Converts controller exceptions and
/// BadRequest returns to the uniform <see cref="ShellErrorResponse"/> envelope
/// so demos don't need per-controller try/catch or BadRequest-rewriting code.
/// Register via <c>options.Filters.Add&lt;ShellExceptionFilter&gt;()</c> in
/// your <c>AddControllers</c> call.
/// </summary>
public class ShellExceptionFilter : IAsyncExceptionFilter, IAsyncResultFilter
{
    private static readonly JsonSerializerOptions _jsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly ILogger<ShellExceptionFilter> _logger;

    public ShellExceptionFilter(ILogger<ShellExceptionFilter> logger)
    {
        _logger = logger;
    }

    // ─── IAsyncExceptionFilter ────────────────────────────────────────────────

    /// <summary>
    /// Intercepts all controller exceptions and converts them to structured
    /// <see cref="ShellErrorResponse"/> envelopes.
    /// </summary>
    public Task OnExceptionAsync(ExceptionContext context)
    {
        var ex = context.Exception;

        // Priority order matters: more-specific catches before the generic fallback.

        // 1. App signalled "I don't recognise this action name" → 400 + unknown_action code.
        if (ex is UnknownActionException unknownEx)
        {
            context.Result = MakeJsonResult(
                400,
                ShellErrorResponse.OfUnknownAction(unknownEx.ActionName));
            context.ExceptionHandled = true;
            return Task.CompletedTask;
        }

        // 1b. Stale client (3.8.0) — the request's X-VMS-Client-Build header did not match
        //     the server's current-deployed build → 400 + stale_client. Checked before the
        //     generic paths so a stale mutation is rejected with an actionable code (the
        //     client reloads to the fresh bundle) rather than a generic 500.
        if (ex is StaleClientException staleEx)
        {
            context.Result = MakeJsonResult(
                400,
                ShellErrorResponse.OfStaleClient(staleEx.Message));
            context.ExceptionHandled = true;
            return Task.CompletedTask;
        }

        // 2. JSON body parse failure from ActionPayload<T>.Parse / ParseJson → 400 + parse_error.
        if (ex is JsonException jsonEx)
        {
            context.Result = MakeJsonResult(
                400,
                ShellErrorResponse.OfParseError(jsonEx.Message));
            context.ExceptionHandled = true;
            return Task.CompletedTask;
        }

        // 3. ViewTreeValidation.ValidateActionNames violation → 500 + invalid_tree.
        //    The safe heuristic is: InvalidOperationException whose stack trace mentions
        //    ValidateActionNames (from ViewModels.cs). A dedicated ShellTreeValidationException
        //    would be cleaner — D-06 note: acceptable for v1.0.0, can be promoted later.
        if (ex is InvalidOperationException invEx
            && invEx.StackTrace?.Contains("ValidateActionNames") == true)
        {
            // Log as error — this is a developer/framework bug, not a client error.
            _logger.LogError(invEx, "[ViewModelShell] Invalid tree: {Message}", invEx.Message);
            context.Result = MakeJsonResult(
                500,
                ShellErrorResponse.OfInvalidTree(invEx.Message));
            context.ExceptionHandled = true;
            return Task.CompletedTask;
        }

        // 4. Generic uncaught exception → 500 + uncaught_exception.
        //    T1 info-disclosure mitigation: log full ex (including stack) server-side via
        //    ILogger; the wire body contains ONLY ex.Message (via OfUncaught which reads
        //    only ex.Message — never ex.ToString(), StackTrace, or GetType().FullName).
        _logger.LogError(ex, "[ViewModelShell] Uncaught exception in controller: {Message}", ex.Message);
        context.Result = MakeJsonResult(
            500,
            ShellErrorResponse.OfUncaught(ex));
        context.ExceptionHandled = true;
        return Task.CompletedTask;
    }

    // ─── IAsyncResultFilter ───────────────────────────────────────────────────

    /// <summary>
    /// Rewrites <see cref="BadRequestObjectResult"/> and <see cref="BadRequestResult"/>
    /// to the <see cref="ShellErrorResponse"/> envelope shape (per D-08: input-validation
    /// <c>return BadRequest("title required")</c> calls stay in controllers; the filter
    /// wraps them here on the way out so the wire is uniform).
    /// </summary>
    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        // BadRequestObjectResult — controller returned BadRequest("some message")
        if (context.Result is BadRequestObjectResult bro)
        {
            var message = bro.Value as string ?? "Bad request";
            context.Result = MakeJsonResult(400, ShellErrorResponse.OfBadRequest(message));
            await next();
            return;
        }

        // BadRequestResult — controller returned BadRequest() with no body
        if (context.Result is BadRequestResult)
        {
            context.Result = MakeJsonResult(400, ShellErrorResponse.OfBadRequest("Bad request"));
            await next();
            return;
        }

        await next();
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private static ContentResult MakeJsonResult(int statusCode, ShellErrorResponse envelope) =>
        new()
        {
            StatusCode = statusCode,
            ContentType = "application/json",
            Content = JsonSerializer.Serialize(envelope, _jsonOpts),
        };
}
