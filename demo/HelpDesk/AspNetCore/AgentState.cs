namespace HelpDesk;

public record AgentState(
    string View,                   // "queue" | "detail"
    long? SelectedTicketId,
    string Filter,                 // "all" | "open" | "in-progress" | "resolved"
    bool NotesSaved,
    string TitleFilter,            // 0.15.1: free-text title filter
    // Phase 6 (WIRE-07) — bind slots:
    //   SelectedIds: per-row CheckboxNodes bind to selectedIds.{id} — this is
    //   just the checkbox CHECK STATE (draft-preserved across re-renders).
    //   BulkSelection: the VISIBLE-scoped harvest sink. TableNode.Selection's
    //   bulk buttons write the currently-checked, currently-RENDERED row ids
    //   here (overwriting) right before dispatching; the bulk handlers read
    //   THIS — never the SelectedIds map — so a bulk action can only touch
    //   rows the operator can currently see.
    //   AgentNotes: bound by the ticket-page textarea form field; the
    //   "save-notes" handler reads it.
    Dictionary<string, bool> SelectedIds,
    IReadOnlyList<string> BulkSelection,
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
        BulkSelection: [],
        AgentNotes: ""
    );
}
