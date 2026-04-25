namespace ContactManager.Services;

public enum ContactView { List, Detail, Add }

public record ContactRecord(
    string Id,
    string Name,
    string Email,
    string Phone,
    string Notes,
    DateTimeOffset CreatedAt
);

public class ContactStore
{
    private readonly List<ContactRecord> _contacts =
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
    ];
    private ContactView _currentView = ContactView.List;
    private string?     _selectedId;
    private string      _searchQuery = "";
    private readonly object _lock = new();

    public IReadOnlyList<ContactRecord> GetAll()
    {
        lock (_lock) return _contacts.ToList();
    }

    public IReadOnlyList<ContactRecord> GetFiltered(string query)
    {
        lock (_lock)
        {
            if (string.IsNullOrWhiteSpace(query)) return _contacts.ToList();
            return _contacts
                .Where(c =>
                    c.Name.Contains(query,  StringComparison.OrdinalIgnoreCase) ||
                    c.Email.Contains(query, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
    }

    public ContactRecord? GetById(string id)
    {
        lock (_lock) return _contacts.FirstOrDefault(c => c.Id == id);
    }

    public ContactView GetCurrentView() { lock (_lock) return _currentView; }
    public void SetCurrentView(ContactView view) { lock (_lock) _currentView = view; }

    public string? GetSelectedId() { lock (_lock) return _selectedId; }
    public void SetSelectedId(string? id) { lock (_lock) _selectedId = id; }

    public string GetSearchQuery() { lock (_lock) return _searchQuery; }
    public void SetSearchQuery(string query) { lock (_lock) _searchQuery = query ?? ""; }

    public void Add(string name, string email, string phone, string notes)
    {
        lock (_lock)
        {
            _contacts.Add(new ContactRecord(
                Id:        Guid.NewGuid().ToString("N")[..8],
                Name:      name,
                Email:     email,
                Phone:     phone,
                Notes:     notes,
                CreatedAt: DateTimeOffset.UtcNow
            ));
        }
    }

    public void Update(string id, string name, string email, string phone, string notes)
    {
        lock (_lock)
        {
            var idx = _contacts.FindIndex(c => c.Id == id);
            if (idx >= 0)
                _contacts[idx] = _contacts[idx] with { Name = name, Email = email, Phone = phone, Notes = notes };
        }
    }

    public void Delete(string id)
    {
        lock (_lock) _contacts.RemoveAll(c => c.Id == id);
    }
}
