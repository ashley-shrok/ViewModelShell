namespace HelpDesk;

public record AgentState(
    string View,                   // "queue" | "detail"
    long? SelectedTicketId,
    string Filter,                 // "all" | "open" | "in-progress" | "resolved"
    bool NotesSaved,
    string TitleFilter,            // 0.15.1: free-text title filter
    // Phase 6 (WIRE-07) — bind slots:
    //   SelectedIds: per-row CheckboxNodes bind to selectedIds.{id}; the
    //   bulk handlers read keys whose values are true.
    //   AgentNotes: bound by the ticket-page textarea form field; the
    //   "save-notes" handler reads it.
    Dictionary<string, bool> SelectedIds,
    string AgentNotes
)
{
    public static AgentState Initial() => new(
        View: "queue",
        SelectedTicketId: null,
        Filter: "all",
        NotesSaved: false,
        TitleFilter: "",
        SelectedIds: new Dictionary<string, bool>(),
        AgentNotes: ""
    );
}
