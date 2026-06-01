namespace HelpDesk;

public record AgentState(
    string View,                   // "queue" | "detail"
    long? SelectedTicketId,
    string Filter,                 // "all" | "open" | "in-progress" | "resolved"
    bool NotesSaved,
    string TitleFilter = ""        // 0.15.1: free-text title filter (canonical workflow pattern)
    // 0.15.1: Page removed — canonical pattern is filter-narrows-under-cap, no
    // pagination. The 0.13.0 SelectedIds was already gone (local-mode selection
    // lives in the DOM; bulk actions harvest via selection.buttons[]).
)
{
    public static AgentState Initial() => new(
        View: "queue",
        SelectedTicketId: null,
        Filter: "all",
        NotesSaved: false
    );
}
