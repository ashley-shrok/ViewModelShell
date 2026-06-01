namespace HelpDesk;

public record AgentState(
    string View,                  // "queue" | "detail"
    long? SelectedTicketId,
    string Filter,                // "all" | "open" | "in-progress" | "resolved"
    bool NotesSaved,
    int Page                      // 1-based queue page; SQL-sliced server-side
    // 0.13.0: SelectedIds removed — local-mode selection lives in the DOM
    // (TableNode.selection without an `action`). Bulk-action buttons live in
    // TableNode.selection.buttons[]; the adapter harvests checked rows on
    // click and merges them as `selectedIds` into the action's context. No
    // per-toggle round-trip; no dropped clicks under the dispatch guard.
)
{
    public static AgentState Initial() => new(
        View: "queue",
        SelectedTicketId: null,
        Filter: "all",
        NotesSaved: false,
        Page: 1
    );
}
