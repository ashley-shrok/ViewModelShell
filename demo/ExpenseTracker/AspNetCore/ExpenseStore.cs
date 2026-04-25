namespace ExpenseTracker.Services;

public record Category(string Id, string Name, decimal Budget);
public record Transaction(string Id, string CategoryId, decimal Amount, string Note, DateTimeOffset CreatedAt);

public class ExpenseStore
{
    private readonly List<Category> _categories =
    [
        new("food",          "Food",          500m),
        new("transport",     "Transport",     150m),
        new("entertainment", "Entertainment", 200m),
        new("bills",         "Bills",         800m),
    ];

    private readonly List<Transaction> _transactions =
    [
        new("1", "food",          12.50m,  "Lunch",            DateTimeOffset.UtcNow.AddHours(-5)),
        new("2", "transport",     45.00m,  "Monthly pass",     DateTimeOffset.UtcNow.AddHours(-4)),
        new("3", "bills",        850.00m,  "Rent",             DateTimeOffset.UtcNow.AddHours(-3)),
        new("4", "entertainment", 15.99m,  "Streaming",        DateTimeOffset.UtcNow.AddHours(-2)),
        new("5", "food",           8.75m,  "Coffee and snack", DateTimeOffset.UtcNow.AddHours(-1)),
    ];

    private string _filterCategory = "all";
    private string _addCategory    = "food";
    private readonly object _lock  = new();

    public IReadOnlyList<Category>    GetCategories()   { lock (_lock) return _categories.ToList(); }
    public IReadOnlyList<Transaction> GetAll()          { lock (_lock) return _transactions.ToList(); }
    public string                     GetFilter()       { lock (_lock) return _filterCategory; }
    public string                     GetAddCategory()  { lock (_lock) return _addCategory; }

    public void SetFilter(string categoryId)      { lock (_lock) _filterCategory = categoryId; }
    public void SetAddCategory(string categoryId) { lock (_lock) _addCategory    = categoryId; }

    public void AddTransaction(decimal amount, string categoryId, string note)
    {
        lock (_lock)
        {
            _transactions.Add(new Transaction(
                Id:         Guid.NewGuid().ToString("N")[..8],
                CategoryId: categoryId,
                Amount:     amount,
                Note:       note.Trim(),
                CreatedAt:  DateTimeOffset.UtcNow
            ));
        }
    }

    public void DeleteTransaction(string id)
    {
        lock (_lock) _transactions.RemoveAll(t => t.Id == id);
    }
}
