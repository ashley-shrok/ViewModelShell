namespace ExpenseTracker.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ExpenseTracker.State;
using ViewModelShell.ViewModels;

[ApiController]
[Route("api/expenses")]
public class ExpensesController : ControllerBase
{
    [HttpGet]
    public ShellResponse<ExpensesState> Get()
    {
        var state = ExpensesState.Initial();
        return new(BuildVm(state), state);
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<ExpensesState>> Action()
    {
        var payload = ActionPayload<ExpensesState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        string? Str(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.String
                ? v.GetString() : null;

        var state = payload.State;

        switch (payload.Name)
        {
            case "add":
                var amountStr = Str("amount");
                var note      = Str("note") ?? "";
                if (!decimal.TryParse(amountStr, out var amount) || amount <= 0)
                    return BadRequest("amount must be a positive number");
                var added = new Transaction(
                    Id:         Guid.NewGuid().ToString("N")[..8],
                    CategoryId: state.AddCategory,
                    Amount:     amount,
                    Note:       note.Trim(),
                    CreatedAt:  DateTimeOffset.UtcNow);
                state = state with { Transactions = [.. state.Transactions, added] };
                break;

            case "delete":
                var deleteId = Str("id");
                if (deleteId != null)
                    state = state with { Transactions = [.. state.Transactions.Where(t => t.Id != deleteId)] };
                break;

            case "filter":
                var filterValue = Str("value");
                if (filterValue != null) state = state with { FilterCategory = filterValue };
                break;

            case "select-category":
                var catValue = Str("value");
                if (catValue != null) state = state with { AddCategory = catValue };
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return new ShellResponse<ExpensesState>(BuildVm(state), state);
    }

    private static ViewNode BuildVm(ExpensesState state)
    {
        var totalBudget = state.Categories.Sum(c => c.Budget);
        var totalSpent  = state.Categories.Sum(c => state.Transactions.Where(t => t.CategoryId == c.Id).Sum(t => t.Amount));

        var filteredTx = state.FilterCategory == "all"
            ? state.Transactions.AsEnumerable()
            : state.Transactions.Where(t => t.CategoryId == state.FilterCategory);

        var categoryItems = state.Categories.Select(c =>
        {
            var spent = state.Transactions.Where(t => t.CategoryId == c.Id).Sum(t => t.Amount);
            var pct   = c.Budget == 0 ? 0 : (int)Math.Min(100, Math.Round(100m * spent / c.Budget));
            var over  = spent > c.Budget;
            return (ViewNode)new ListItemNode(
                Id:      c.Id,
                Variant: over ? "warning" : null,
                Children:
                [
                    new TextNode(c.Name, "subheading"),
                    new TextNode($"${spent:F2} / ${c.Budget:F2}", over ? "muted" : null),
                    new ProgressNode(pct)
                ]
            );
        }).ToList();

        var txItems = filteredTx
            .OrderByDescending(t => t.CreatedAt)
            .Select(t =>
            {
                var cat   = state.Categories.FirstOrDefault(c => c.Id == t.CategoryId);
                var label = string.IsNullOrWhiteSpace(t.Note) ? cat?.Name ?? t.CategoryId : t.Note;
                return (ViewNode)new ListItemNode(
                    Id:      t.Id,
                    Variant: null,
                    Children:
                    [
                        new TextNode($"${t.Amount:F2}", "subheading"),
                        new TextNode(label,              null),
                        new TextNode(cat?.Name ?? t.CategoryId, "muted"),
                        new ButtonNode(
                            Label:   "Delete",
                            Action:  new ActionDescriptor("delete", new() { ["id"] = t.Id }),
                            Variant: "danger"
                        )
                    ]
                );
            })
            .ToList();

        var filterTabs = new List<TabItem> { new("all", "All") };
        filterTabs.AddRange(state.Categories.Select(c => new TabItem(c.Id, c.Name)));

        return new PageNode(
            Title: "Expenses",
            Children:
            [
                new StatBarNode(
                [
                    new StatItem("spent this month", $"${totalSpent:F2}"),
                    new StatItem("monthly budget",   $"${totalBudget:F2}"),
                    new StatItem("remaining",        $"${totalBudget - totalSpent:F2}")
                ]),

                new SectionNode(
                    Heading: "Categories",
                    Children: [new ListNode(categoryItems)]
                ),

                new SectionNode(
                    Heading: "Add Transaction",
                    Children:
                    [
                        new TabsNode(
                            Selected: state.AddCategory,
                            Action:   new ActionDescriptor("select-category"),
                            Tabs:     state.Categories.Select(c => new TabItem(c.Id, c.Name)).ToList()
                        ),
                        new FormNode(
                            SubmitAction: new ActionDescriptor("add"),
                            SubmitLabel:  "Add",
                            Children:
                            [
                                new FieldNode("amount", "number", "Amount ($)", "0.00", null, true),
                                new FieldNode("note",   "text",   "Note",       "Coffee, lunch…", null)
                            ]
                        )
                    ]
                ),

                new SectionNode(
                    Heading: "Transactions",
                    Children:
                    [
                        new TabsNode(
                            Selected: state.FilterCategory,
                            Action:   new ActionDescriptor("filter"),
                            Tabs:     filterTabs
                        ),
                        new ListNode(txItems)
                    ]
                )
            ]
        );
    }
}
