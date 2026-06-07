// Phase 07 Plan 01 / ERROR-01..03 — .NET envelope + ok flag tests.
//
// Tests for ErrorEntry, UnknownActionException, ShellErrorResponse, ErrorCodes,
// and ShellResponse<TState>.Ok. Uses JsonSerializer.Serialize with default options
// (matching the "null omission is intrinsic" wire contract — WhenWritingNull
// attributes on the types guarantee wire cleanliness without host configuration).

namespace ViewModelShell.Tests;

using System.Text.Json;
using ViewModelShell;

public class EnvelopeTests
{
    // ─── Serializer options ───────────────────────────────────────────────────
    // Use JsonSerializerOptions.Default (no extra configuration) to verify the
    // "null omission is intrinsic" claim from ViewModels.cs:6-22. The attributes
    // on the types must work without any host DefaultIgnoreCondition setting.
    private static readonly JsonSerializerOptions _opts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private static string Serialize<T>(T value) =>
        JsonSerializer.Serialize(value, _opts);

    // ─── ShellResponse<TState>.Ok — always serializes ─────────────────────────

    [Fact]
    public void ShellResponse_Ok_DefaultsToTrue_AndSerializes()
    {
        // A default-constructed ShellResponse carries Ok = true on the wire.
        var response = new ShellResponse<string>(
            Vm: new TextNode("hello", null),
            State: "state");
        var json = Serialize(response);
        Assert.Contains("\"ok\":true", json);
    }

    [Fact]
    public void ShellResponse_RedirectTo_CarriesOkTrue()
    {
        var response = ShellResponse<string>.RedirectTo("/dashboard");
        var json = Serialize(response);
        Assert.Contains("\"ok\":true", json);
        Assert.Contains("\"redirect\":\"/dashboard\"", json);
    }

    [Fact]
    public void ShellResponse_Ok_PresentOnMinimalResponse()
    {
        // Even a response with only Vm set carries Ok = true.
        var response = new ShellResponse<string>(Vm: new TextNode("x", null), State: null);
        var json = Serialize(response);
        Assert.Contains("\"ok\":true", json);
    }

    // ─── ErrorEntry — null omission contract ─────────────────────────────────

    [Fact]
    public void ErrorEntry_MessageOnly_SerializesWithoutPathOrCode()
    {
        var entry = new ErrorEntry("Something went wrong");
        var json = Serialize(entry);
        Assert.Contains("\"message\":", json);
        Assert.DoesNotContain("\"path\"", json);
        Assert.DoesNotContain("\"code\"", json);
    }

    [Fact]
    public void ErrorEntry_WithCode_SerializesBothMessageAndCode()
    {
        var entry = new ErrorEntry("Unknown action: foo", Code: ErrorCodes.UnknownAction);
        var json = Serialize(entry);
        Assert.Contains("\"message\":", json);
        Assert.Contains("\"code\":\"unknown_action\"", json);
        Assert.DoesNotContain("\"path\"", json);
    }

    [Fact]
    public void ErrorEntry_WithPath_SerializesBothMessageAndPath()
    {
        var entry = new ErrorEntry("Field required", Path: "form.email");
        var json = Serialize(entry);
        Assert.Contains("\"message\":", json);
        Assert.Contains("\"path\":\"form.email\"", json);
        Assert.DoesNotContain("\"code\"", json);
    }

    [Fact]
    public void ErrorEntry_AllFields_SerializesAll()
    {
        var entry = new ErrorEntry("Bad value", Path: "fields.amount", Code: "range_error");
        var json = Serialize(entry);
        Assert.Contains("\"message\":", json);
        Assert.Contains("\"path\":", json);
        Assert.Contains("\"code\":", json);
    }

    [Fact]
    public void ErrorEntry_NullNotPresent_NeitherPathNorCodeAsNull()
    {
        var entry = new ErrorEntry("msg");
        var json = Serialize(entry);
        // The null-omission contract: absent, never "field": null
        Assert.DoesNotContain("null", json);
    }

    // ─── UnknownActionException ───────────────────────────────────────────────

    [Fact]
    public void UnknownActionException_ActionName_ExposesOffendingAction()
    {
        var ex = new UnknownActionException("delete-row");
        Assert.Equal("delete-row", ex.ActionName);
    }

    [Fact]
    public void UnknownActionException_Message_ContainsActionName()
    {
        var ex = new UnknownActionException("delete-row");
        Assert.Contains("delete-row", ex.Message);
    }

    [Fact]
    public void UnknownActionException_IsException()
    {
        var ex = new UnknownActionException("foo");
        Assert.IsAssignableFrom<Exception>(ex);
    }

    // ─── ErrorCodes vocabulary ────────────────────────────────────────────────

    [Fact]
    public void ErrorCodes_HasExpectedValues()
    {
        Assert.Equal("parse_error", ErrorCodes.Parse);
        Assert.Equal("unknown_action", ErrorCodes.UnknownAction);
        Assert.Equal("invalid_tree", ErrorCodes.InvalidTree);
        Assert.Equal("uncaught_exception", ErrorCodes.Uncaught);
    }

    // ─── ShellErrorResponse ───────────────────────────────────────────────────

    [Fact]
    public void ShellErrorResponse_DefaultOkIsFalse()
    {
        var resp = new ShellErrorResponse([new ErrorEntry("error")]);
        Assert.False(resp.Ok);
    }

    [Fact]
    public void ShellErrorResponse_Serializes_WithOkFalseAndErrors()
    {
        var resp = new ShellErrorResponse([new ErrorEntry("something failed")]);
        var json = Serialize(resp);
        Assert.Contains("\"ok\":false", json);
        Assert.Contains("\"errors\":", json);
        Assert.Contains("\"message\":", json);
    }

    [Fact]
    public void ShellErrorResponse_NoVmOrStateInBody()
    {
        // Error responses must not leak Vm or State — only ok:false + errors.
        var resp = new ShellErrorResponse([new ErrorEntry("msg")]);
        var json = Serialize(resp);
        Assert.DoesNotContain("\"vm\"", json);
        Assert.DoesNotContain("\"state\"", json);
        Assert.DoesNotContain("\"redirect\"", json);
    }

    // ─── ShellErrorResponse static factories ─────────────────────────────────

    [Fact]
    public void OfParseError_SetsCodeAndMessage()
    {
        var resp = ShellErrorResponse.OfParseError("invalid json");
        var json = Serialize(resp);
        Assert.Contains("\"ok\":false", json);
        Assert.Contains("\"code\":\"parse_error\"", json);
        Assert.Contains("\"message\":", json);
    }

    [Fact]
    public void OfBadRequest_HasNoCode_PerD08()
    {
        var resp = ShellErrorResponse.OfBadRequest("title required");
        var json = Serialize(resp);
        Assert.Contains("\"ok\":false", json);
        Assert.DoesNotContain("\"code\"", json);
        Assert.Contains("title required", json);
    }

    [Fact]
    public void OfUnknownAction_SetsUnknownActionCode()
    {
        var resp = ShellErrorResponse.OfUnknownAction("bogus-action");
        var json = Serialize(resp);
        Assert.Contains("\"ok\":false", json);
        Assert.Contains("\"code\":\"unknown_action\"", json);
        Assert.Contains("bogus-action", json);
    }

    [Fact]
    public void OfInvalidTree_SetsInvalidTreeCode()
    {
        var resp = ShellErrorResponse.OfInvalidTree("Duplicate action name 'delete'");
        var json = Serialize(resp);
        Assert.Contains("\"ok\":false", json);
        Assert.Contains("\"code\":\"invalid_tree\"", json);
    }

    [Fact]
    public void OfUncaught_SetsUncaughtCodeAndUsesExMessage()
    {
        var ex = new Exception("database connection failed");
        var resp = ShellErrorResponse.OfUncaught(ex);
        var json = Serialize(resp);
        Assert.Contains("\"ok\":false", json);
        Assert.Contains("\"code\":\"uncaught_exception\"", json);
        Assert.Contains("database connection failed", json);
    }

    [Fact]
    public void OfUncaught_T1_DoesNotLeakStackTrace()
    {
        Exception? exWithStack;
        try
        {
            throw new InvalidOperationException("inner error with stack");
        }
        catch (Exception caught)
        {
            exWithStack = caught;
        }

        var resp = ShellErrorResponse.OfUncaught(exWithStack!);
        var json = Serialize(resp);

        // T1 info-disclosure mitigation: no stack trace markers on the wire.
        Assert.DoesNotContain("   at ", json);          // stack trace lines
        Assert.DoesNotContain("System.", json);          // BCL type names
        Assert.DoesNotContain("Inner error with stack", json, StringComparison.OrdinalIgnoreCase);
        // Verify only the message is present (ex.Message, not ex.ToString())
        Assert.Contains("inner error with stack", json);
    }

    [Fact]
    public void OfUncaught_T1_MessageOnlyNotToString()
    {
        // ex.ToString() includes "ExceptionType: Message\r\n   at ...\r\n   at ..."
        // OfUncaught must use ONLY ex.Message.
        var ex = new ArgumentException("param cannot be null", "paramName");
        var resp = ShellErrorResponse.OfUncaught(ex);
        var json = Serialize(resp);

        // ex.Message = "param cannot be null (Parameter 'paramName')"
        // ex.ToString() would add "System.ArgumentException:" prefix and a stack trace
        Assert.DoesNotContain("System.ArgumentException", json);
        Assert.DoesNotContain("   at ", json);
        // The message itself should appear
        Assert.Contains("param cannot be null", json);
    }
}
