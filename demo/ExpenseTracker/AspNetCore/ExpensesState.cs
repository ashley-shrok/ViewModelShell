namespace ExpenseTracker.State;

using System.Text.Json.Serialization;

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
    string DraftNote,
    // modal-swap-to-success pattern: when non-null, the add modal STAYS OPEN
    // (Adding=true) and swaps its body from the form to a success card. Set by a
    // successful "add"; cleared by show-add / hide-add ([Done]). This is the
    // durable "outcome-in-view" confirmation — unlike a toast it survives the
    // operator stepping away and coming back (it's state, round-tripped).
    // gotcha #8: attributed WhenWritingNull so a null omits from the wire,
    // matching the bun twin's optional `addSuccessMessage?` (absent when unset).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    string? AddSuccessMessage = null,
    // gotcha #4: inline validation rides state (response stays ok:true), NOT
    // BadRequest — rendered as a danger TextNode in the form when non-null.
    // Cleared on a successful add and on show-add / hide-add.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    string? ValidationError = null
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
