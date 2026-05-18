namespace ExpenseTracker.Controllers;

using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ExpenseTracker.State;
using ViewModelShell;

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
                state = state with { Transactions = [.. state.Transactions, added], Adding = false };
                break;

            case "delete":
                // Retained as a valid action; not surfaced in the realistic
                // read-only ledger table (option A — TableNode cells are
                // text-only; no per-row action buttons. Logged limitation).
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

            case "show-add":
                state = state with { Adding = true };
                break;

            case "hide-add":
                state = state with { Adding = false };
                break;

            default:
                return BadRequest($"Unknown action: {payload.Name}");
        }

        return new ShellResponse<ExpensesState>(BuildVm(state), state);
    }

    // Realistic YNAB/Mint finance app as a real app shell
    // (page.layout:"sidebar"): a thin left "Overview" rail (headline
    // numbers + per-category budget progress) next to a wide main area
    // (add transaction + the transactions ledger).
    private static ViewNode BuildVm(ExpensesState state)
    {
        var totalBudget = state.Categories.Sum(c => c.Budget);
        var totalSpent  = state.Categories.Sum(c => state.Transactions.Where(t => t.CategoryId == c.Id).Sum(t => t.Amount));
        var remaining   = totalBudget - totalSpent;
        var pctUsed     = totalBudget == 0 ? 0 : (int)Math.Round(100m * totalSpent / totalBudget);

        // LEFT RAIL — at-a-glance summary + per-category budgets.
        var railChildren = new List<ViewNode>
        {
            new TextNode($"${remaining:F2}", "heading"),
            new TextNode("remaining this month", "muted"),
            new TextNode($"Spent ${totalSpent:F2} of ${totalBudget:F2} · {pctUsed}% used", "muted")
        };
        foreach (var c in state.Categories)
        {
            var spent = state.Transactions.Where(t => t.CategoryId == c.Id).Sum(t => t.Amount);
            var pct   = c.Budget == 0 ? 0 : (int)Math.Min(100, Math.Round(100m * spent / c.Budget));
            var over  = spent > c.Budget;
            railChildren.Add(new TextNode(c.Name, "subheading"));
            railChildren.Add(new TextNode($"${spent:F2} / ${c.Budget:F2}", over ? "error" : "muted"));
            railChildren.Add(new ProgressNode(pct));
        }
        var rail = new SectionNode("Overview", railChildren, Variant: "card");

        // MAIN — "+ Add" opens a modal; the main area is the ledger.

        var filterTabs = new List<TabItem> { new("all", "All") };
        filterTabs.AddRange(state.Categories.Select(c => new TabItem(c.Id, c.Name)));

        var filteredTx = (state.FilterCategory == "all"
                ? state.Transactions.AsEnumerable()
                : state.Transactions.Where(t => t.CategoryId == state.FilterCategory))
            .OrderByDescending(t => t.CreatedAt);

        var rows = filteredTx.Select(t =>
        {
            var cat = state.Categories.FirstOrDefault(c => c.Id == t.CategoryId);
            return new TableRow(
                Cells: new Dictionary<string, string>
                {
                    ["date"]     = t.CreatedAt.LocalDateTime.ToString("MMM d, h:mm tt"),
                    ["category"] = cat?.Name ?? t.CategoryId,
                    ["note"]     = string.IsNullOrWhiteSpace(t.Note) ? "—" : t.Note,
                    ["amount"]   = $"${t.Amount:F2}"
                },
                Id: t.Id);
        }).ToList();

        var ledger = new SectionNode(
            Heading: "Transactions",
            Children:
            [
                new TabsNode(
                    Selected: state.FilterCategory,
                    Action:   new ActionDescriptor("filter"),
                    Tabs:     filterTabs),
                new TableNode(
                    Columns:
                    [
                        new TableColumn("date",     "Date"),
                        new TableColumn("category", "Category"),
                        new TableColumn("note",     "Note"),
                        new TableColumn("amount",   "Amount")
                    ],
                    Rows: rows)
            ]);

        var mainChildren = new List<ViewNode>
        {
            new ButtonNode("+ Add Transaction", new ActionDescriptor("show-add"), Variant: "primary"),
            ledger
        };
        if (state.Adding)
        {
            mainChildren.Add(new ModalNode(
                Title: "Add Transaction",
                Children:
                [
                    new TabsNode(
                        Selected: state.AddCategory,
                        Action:   new ActionDescriptor("select-category"),
                        Tabs:     state.Categories.Select(c => new TabItem(c.Id, c.Name)).ToList()),
                    new FormNode(
                        SubmitAction: new ActionDescriptor("add"),
                        SubmitLabel:  "Add",
                        Children:
                        [
                            new FieldNode("amount", "number", "Amount ($)", "0.00",          null, true),
                            new FieldNode("note",   "text",   "Note",       "Coffee, lunch…", null)
                        ])
                ],
                DismissAction: new ActionDescriptor("hide-add"),
                Size: "narrow"));
        }
        var main = new SectionNode(null, mainChildren);

        return new PageNode(
            Title:    "Expenses",
            Children: [rail, main],
            Layout:   "sidebar");
    }
}
