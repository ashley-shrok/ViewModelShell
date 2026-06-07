namespace ExpenseTracker.State;

public record Category(string Id, string Name, decimal Budget);
public record Transaction(string Id, string CategoryId, decimal Amount, string Note, DateTimeOffset CreatedAt);

public record ExpensesState(
    IReadOnlyList<Category> Categories,
    IReadOnlyList<Transaction> Transactions,
    string FilterCategory,    // "all" or a category id
    string AddCategory,       // category for new transactions
    bool Adding,              // is the add-transaction modal open
    // Phase 6 (WIRE-07) — typed values of the add-transaction modal form.
    // The renderer reads/writes these via bind paths on FieldNodes; the
    // "add" handler reads them and resets to "" after a successful add.
    string DraftAmount,
    string DraftNote
)
{
    public static ExpensesState Initial() => new(
        Categories:
        [
            new("food",          "Food",          500m),
            new("transport",     "Transport",     150m),
            new("entertainment", "Entertainment", 200m),
            new("bills",         "Bills",         800m),
        ],
        Transactions:
        [
            new("1", "food",          12.50m,  "Lunch",            DateTimeOffset.UtcNow.AddHours(-5)),
            new("2", "transport",     45.00m,  "Monthly pass",     DateTimeOffset.UtcNow.AddHours(-4)),
            new("3", "bills",        850.00m,  "Rent",             DateTimeOffset.UtcNow.AddHours(-3)),
            new("4", "entertainment", 15.99m,  "Streaming",        DateTimeOffset.UtcNow.AddHours(-2)),
            new("5", "food",           8.75m,  "Coffee and snack", DateTimeOffset.UtcNow.AddHours(-1)),
        ],
        FilterCategory: "all",
        AddCategory:    "food",
        Adding:         false,
        DraftAmount:    "",
        DraftNote:      ""
    );
}
