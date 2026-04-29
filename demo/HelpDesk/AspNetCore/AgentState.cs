namespace HelpDesk;

public record AgentState(
    string View,                  // "queue" | "detail"
    long? SelectedTicketId,
    string Filter,                // "all" | "open" | "in-progress" | "resolved"
    bool NotesSaved
)
{
    public static AgentState Initial() => new(
        View: "queue",
        SelectedTicketId: null,
        Filter: "all",
        NotesSaved: false
    );
}
