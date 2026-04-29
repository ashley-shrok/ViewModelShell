namespace ContactManager.State;

public record ContactRecord(
    string Id,
    string Name,
    string Email,
    string Phone,
    string Notes,
    DateTimeOffset CreatedAt
);

public record ContactsState(
    IReadOnlyList<ContactRecord> Contacts,
    string CurrentView,        // "list" | "detail" | "add"
    string? SelectedId,
    string SearchQuery
)
{
    public static ContactsState Initial() => new(
        Contacts:
        [
            new("c1",  "Alice Johnson",   "alice@example.com",   "555-0101", "Met at conference 2024",   DateTimeOffset.UtcNow.AddDays(-30)),
            new("c2",  "Bob Smith",       "bob@example.com",     "555-0102", "Former colleague",          DateTimeOffset.UtcNow.AddDays(-20)),
            new("c3",  "Carol Davis",     "carol@example.com",   "555-0103", "Client from Q1 project",    DateTimeOffset.UtcNow.AddDays(-10)),
            new("c4",  "David Lee",       "david@example.com",   "555-0104", "Referred by Alice",         DateTimeOffset.UtcNow.AddDays(-9)),
            new("c5",  "Eva Martinez",    "eva@example.com",     "555-0105", "Design lead at Acme",       DateTimeOffset.UtcNow.AddDays(-8)),
            new("c6",  "Frank Chen",      "frank@example.com",   "555-0106", "Met at hackathon",          DateTimeOffset.UtcNow.AddDays(-7)),
            new("c7",  "Grace Kim",       "grace@example.com",   "555-0107", "University contact",        DateTimeOffset.UtcNow.AddDays(-6)),
            new("c8",  "Henry Patel",     "henry@example.com",   "555-0108", "Potential partner",         DateTimeOffset.UtcNow.AddDays(-5)),
            new("c9",  "Isabel Nguyen",   "isabel@example.com",  "555-0109", "Freelance illustrator",     DateTimeOffset.UtcNow.AddDays(-4)),
            new("c10", "James O'Brien",   "james@example.com",   "555-0110", "Investor intro",            DateTimeOffset.UtcNow.AddDays(-3)),
            new("c11", "Karen Walsh",     "karen@example.com",   "555-0111", "Legal counsel",             DateTimeOffset.UtcNow.AddDays(-2)),
            new("c12", "Luis Romero",     "luis@example.com",    "555-0112", "Backend engineer",          DateTimeOffset.UtcNow.AddDays(-1)),
        ],
        CurrentView: "list",
        SelectedId: null,
        SearchQuery: ""
    );
}
