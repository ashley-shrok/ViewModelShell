namespace HelpDesk;

/// <summary>
/// 3.8.0 version-skew demo — the single source of truth for this app's
/// current-deployed client-build id. Referenced by Program.cs
/// (AddVmsShellVersioning) and both action controllers
/// (ActionPayload&lt;T&gt;.Parse(Request, HelpDeskBuild.Id)) so the stamp and the
/// guard always agree. Kept byte-equal to the bun twin's CURRENT_BUILD so the
/// parity gate diffs identical serverBuild values.
/// </summary>
public static class HelpDeskBuild
{
    public const string Id = "helpdesk-build-1";
}
