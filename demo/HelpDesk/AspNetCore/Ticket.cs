namespace HelpDesk;

public record Ticket(
    long Id,
    string Title,
    string Type,
    string Priority,
    string Status,
    string? Description,
    string? DueDate,
    string? DeviceModel,
    string? Application,
    string? SystemName,
    string? AccessLevel,
    string CreatedAt,
    string? ResolvedAt,
    string? AgentNotes
);
