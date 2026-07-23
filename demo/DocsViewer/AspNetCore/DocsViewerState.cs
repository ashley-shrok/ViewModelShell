namespace ViewModelShell.State;

/// <summary>A single doc in the browseable corpus. Held on the state
/// record as pure identity — the actual markdown content is loaded fresh
/// from disk each render (the corpus files sit next to the compiled
/// binary via CopyToOutputDirectory). Keeping content off the state record
/// keeps the wire small on the "back to list" path.</summary>
public record DocEntry(string Id, string Title);

/// <summary>Doc-viewer UI state. Just the current selection — the
/// available docs and their content are server-side (files on disk).
/// This is the transient UI shape the wire round-trips.</summary>
public record DocsViewerState(string? SelectedId)
{
    public static DocsViewerState Initial() => new(SelectedId: null);
}
