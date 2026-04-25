namespace ExpenseTracker.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ExpenseTracker.Services;
using ViewModelShell.ViewModels;

[ApiController]
[Route("api/expenses")]
public class ExpensesController(ExpenseStoreRegistry registry) : ControllerBase
{
    private ExpenseStore Store => registry.GetOrCreate(
        Request.Query.TryGetValue("tab", out var t) ? t.ToString() : "default"
    );

    [HttpGet]
    public ActionResult<ViewNode> Get() => BuildViewModel();

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ViewNode> Action()
    {
        var payload = ActionPayload.Parse(Request.Form["_action"].ToString());

        string? Str(string key) =>
            payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.String
                ? v.GetString() : null;

        switch (payload.Name)
        {
            case "add":
                var amountStr = Str("amount");
                var note      = Str("note") ?? "";
                if (!decimal.TryParse(amountStr, out var amount) || amount <= 0)
                    return BadRequest("amount must be a positive number");
                Store.AddTransaction(amount, Store.GetAddCategory(), note);
                break;

            case "delete":
                var deleteId = Str("id");
                if (deleteId != null) Store.DeleteTransaction(deleteId);
                break;

            case "filter":
                var filterValue = Str("value");
                if (filterValue != null) Store.SetFilter(filterValue);
                break;

            case "select-category":
                var catValue = Str("value");
                if (catValue != null) Store.SetAddCategory(catValue);
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return BuildViewModel();
    }

    private ViewNode BuildViewModel()
    {
        var categories  = Store.GetCategories();
        var allTx       = Store.GetAll();
        var filter      = Store.GetFilter();
        var addCategory = Store.GetAddCategory();

        var totalBudget = categories.Sum(c => c.Budget);
        var totalSpent  = categories.Sum(c => allTx.Where(t => t.CategoryId == c.Id).Sum(t => t.Amount));

        var filteredTx = filter == "all"
            ? allTx.AsEnumerable()
            : allTx.Where(t => t.CategoryId == filter);

        var categoryItems = categories.Select(c =>
        {
            var spent = allTx.Where(t => t.CategoryId == c.Id).Sum(t => t.Amount);
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
                var cat   = categories.FirstOrDefault(c => c.Id == t.CategoryId);
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
        filterTabs.AddRange(categories.Select(c => new TabItem(c.Id, c.Name)));

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
                            Selected: addCategory,
                            Action:   new ActionDescriptor("select-category"),
                            Tabs:     categories.Select(c => new TabItem(c.Id, c.Name)).ToList()
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
                            Selected: filter,
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
