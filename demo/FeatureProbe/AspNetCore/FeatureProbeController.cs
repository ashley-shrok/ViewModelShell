namespace FeatureProbe.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ViewModelShell;

public record FeatureProbeState(
    int PollCount,
    string? LastUploadName,
    long LastUploadSize
)
{
    public static FeatureProbeState Initial() => new(
        PollCount: 0,
        LastUploadName: null,
        LastUploadSize: 0
    );
}

[ApiController]
[Route("api/probe")]
public class FeatureProbeController : ControllerBase
{
    [HttpGet]
    public ShellResponse<FeatureProbeState> Get()
    {
        var state = FeatureProbeState.Initial();
        return new(BuildVm(state), state);
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<FeatureProbeState>> Action()
    {
        var payload = ActionPayload<FeatureProbeState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        string? Str(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.String
                ? v.GetString() : null;

        var state = payload.State;

        switch (payload.Name)
        {
            case "trigger-redirect":
                return ShellResponse<FeatureProbeState>.RedirectTo(Str("to") ?? "/default-redirect");

            case "set-storage":
                return new ShellResponse<FeatureProbeState>(BuildVm(state), state)
                    .WithEffect(ShellSideEffect.SetLocalStorage("probe-local", Str("local-value") ?? "default-local"))
                    .WithEffect(ShellSideEffect.SetSessionStorage("probe-session", Str("session-value") ?? "default-session"));

            case "trigger-download":
                return new ShellResponse<FeatureProbeState>(BuildVm(state), state)
                    .WithEffect(ShellSideEffect.Download(
                        Str("url")      ?? "/api/probe/file/hello.txt",
                        Str("filename") ?? "hello.txt"));

            case "do-poll":
                state = state with { PollCount = state.PollCount + 1 };
                var done = state.PollCount >= 3;
                return new ShellResponse<FeatureProbeState>(BuildVm(state), state)
                {
                    NextPollIn = done ? null : 100
                };

            case "upload":
                var file = Request.Form.Files.GetFile("attachment");
                if (file != null)
                {
                    state = state with
                    {
                        LastUploadName = file.FileName,
                        LastUploadSize = file.Length
                    };
                }
                break;

            case "show-copy-button":
                break;  // state unchanged; BuildVm always includes the copy-button node

            case "reset":
                state = FeatureProbeState.Initial();
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return new ShellResponse<FeatureProbeState>(BuildVm(state), state);
    }

    private static ViewNode BuildVm(FeatureProbeState state)
    {
        var children = new List<ViewNode>
        {
            new TextNode($"Poll count: {state.PollCount}", "muted"),
        };
        if (state.LastUploadName != null)
            children.Add(new TextNode($"Last upload: {state.LastUploadName} ({state.LastUploadSize} bytes)", "muted"));

        children.Add(new CopyButtonNode(
            "npx @ashley-shrok/viewmodel-shell",
            "Copy install command",
            "Copied!",
            Variant: "secondary"));   // 0.9.0/#14: read distinctly from neighboring default buttons

        var probeSection = new SectionNode("Probe", children, Variant: "card", Layout: "split");
        return new PageNode("Feature Probe", new List<ViewNode> { probeSection }, Density: "compact", Layout: "cards");
    }
}
