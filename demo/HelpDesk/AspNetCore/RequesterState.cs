namespace HelpDesk;

public record RequesterState(
    string View,                  // "list" | "create" | "detail"
    long? SelectedTicketId,
    string Filter,                // "all" | "open" | "in-progress" | "resolved"
    string CreateType,            // "hardware" | "software" | "access"
    string CreatePriority,        // "low" | "medium" | "high" | "critical"
    string CreateAccessLevel,     // "read" | "write" | "admin"
    string? ValidationError,
    // Phase 6 (WIRE-07) — bind slots for the create-ticket form fields.
    string DraftTitle,
    string DraftDescription,
    string DraftDueDate,
    string DraftDeviceModel,
    string DraftApplication,
    string DraftSystemName
)
{
    public static RequesterState Initial() => new(
        View: "list",
        SelectedTicketId: null,
        Filter: "all",
        CreateType: "hardware",
        CreatePriority: "medium",
        CreateAccessLevel: "read",
        ValidationError: null,
        DraftTitle: "",
        DraftDescription: "",
        DraftDueDate: "",
        DraftDeviceModel: "",
        DraftApplication: "",
        DraftSystemName: ""
    );
}
