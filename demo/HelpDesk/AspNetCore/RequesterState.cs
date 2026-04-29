namespace HelpDesk;

public record RequesterState(
    string View,                  // "list" | "create" | "detail"
    long? SelectedTicketId,
    string Filter,                // "all" | "open" | "in-progress" | "resolved"
    string CreateType,            // "hardware" | "software" | "access"
    string CreatePriority,        // "low" | "medium" | "high" | "critical"
    string CreateAccessLevel,     // "read" | "write" | "admin"
    string? ValidationError
)
{
    public static RequesterState Initial() => new(
        View: "list",
        SelectedTicketId: null,
        Filter: "all",
        CreateType: "hardware",
        CreatePriority: "medium",
        CreateAccessLevel: "read",
        ValidationError: null
    );
}
