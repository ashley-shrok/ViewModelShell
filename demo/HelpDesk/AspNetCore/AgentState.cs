namespace HelpDesk;

public record AgentState(
    string View,                  // "queue" | "detail"
    long? SelectedTicketId,
    string Filter,                // "all" | "open" | "in-progress" | "resolved"
    bool NotesSaved,
    // 0.12.0/#16: bulk-action queue. SelectedIds is server-truth (ticket ids as
    // strings, kept numerically sorted so the array round-trips identically to
    // the bun twin); Page is the 1-based queue page (server-sliced via SQL).
    IReadOnlyList<string> SelectedIds,
    int Page
)
{
    public static AgentState Initial() => new(
        View: "queue",
        SelectedTicketId: null,
        Filter: "all",
        NotesSaved: false,
        SelectedIds: [],
        Page: 1
    );
}
