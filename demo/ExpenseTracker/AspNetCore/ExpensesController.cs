namespace ExpenseTracker.Controllers;

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
        return new ShellResponse<ExpensesState>(BuildVm(state), state).Validate();
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<ExpensesState>> Action()
    {
        var payload = ActionPayload<ExpensesState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        var state = payload.State;
        var name = payload.Name;

        // Phase 6 (WIRE-07) — dispatch envelope is {name, state} only.
        // Per-tab actions encode the tab value in the name itself; the
        // bind path has already written the corresponding state slot.
        if (name == "add")
        {
            var amountStr = state.DraftAmount;
            if (!decimal.TryParse(amountStr, out var amount) || amount <= 0)
                return BadRequest("amount must be a positive number");
            var added = new Transaction(
                Id:         Guid.NewGuid().ToString("N")[..8],
                CategoryId: state.AddCategory,
                Amount:     amount,
                Note:       (state.DraftNote ?? "").Trim(),
                CreatedAt:  DateTimeOffset.UtcNow);
            state = state with
            {
                Transactions = [.. state.Transactions, added],
                Adding = false,
                DraftAmount = "",
                DraftNote = "",
            };
        }
        else if (name.StartsWith("filter-"))
        {
            // FilterCategory is already in state via the tab's bind path.
        }
        else if (name.StartsWith("select-category-"))
        {
            // AddCategory is already in state via the tab's bind path.
        }
        else if (name == "show-add")
        {
            state = state with { Adding = true };
        }
        else if (name == "hide-add")
        {
            state = state with { Adding = false, DraftAmount = "", DraftNote = "" };
        }
        else
        {
            throw new UnknownActionException(name);
        }

        return new ShellResponse<ExpensesState>(BuildVm(state), state).Validate();
    }

    private static ViewNode BuildVm(ExpensesState state)
    {
        var totalBudget = state.Categories.Sum(c => c.Budget);
        var totalSpent  = state.Categories.Sum(c => state.Transactions.Where(t => t.CategoryId == c.Id).Sum(t => t.Amount));
        var remaining   = totalBudget - totalSpent;
        var pctUsed     = totalBudget == 0 ? 0 : (int)Math.Round(100m * totalSpent / totalBudget);

        // LEFT RAIL — at-a-glance summary + per-category budgets.
        var railChildren = new List<ViewNode>
        {
            new TextNode($"${remaining:F2}", TextStyle.Heading),
            new TextNode("remaining this month", TextStyle.Muted),
            new TextNode($"Spent ${totalSpent:F2} of ${totalBudget:F2} · {pctUsed}% used", TextStyle.Muted)
        };
        foreach (var c in state.Categories)
        {
            var spent = state.Transactions.Where(t => t.CategoryId == c.Id).Sum(t => t.Amount);
            var pct   = c.Budget == 0 ? 0 : (int)Math.Min(100, Math.Round(100m * spent / c.Budget));
            var over  = spent > c.Budget;
            railChildren.Add(new TextNode(c.Name, TextStyle.Subheading));
            railChildren.Add(new TextNode($"${spent:F2} / ${c.Budget:F2}", over ? null : TextStyle.Muted, over ? Tone.Danger : null));
            railChildren.Add(new ProgressNode(pct));
        }
        var rail = new SectionNode("Overview", railChildren, Variant: SectionVariant.Card);

        // MAIN — "+ Add" opens a modal; the main area is the ledger.
        // Each filter tab carries a unique action name (filter-{id}).
        var filterTabs = new List<TabItem>
        {
            new("all", "All", new ActionDescriptor("filter-all"))
        };
        filterTabs.AddRange(state.Categories.Select(c =>
            new TabItem(c.Id, c.Name, new ActionDescriptor($"filter-{c.Id}"))));

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
            // Heading omitted — the header-bar row below now carries the
            // "Transactions" title, so repeating it here would double up.
            Heading: null,
            Children:
            [
                new TabsNode(
                    Selected: state.FilterCategory,
                    Bind:     "filterCategory",
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

        // 1.11.0/1.12.0 — the canonical header bar: a layout:"row" cluster with
        // Arrange:"space-between" pushing the page title hard-left and the primary
        // action hard-right (a heading TextNode as the FIRST child + the action).
        // No app CSS; the row wraps intrinsically on narrow viewports. Mirrors
        // demo/ExpenseTracker-bun/server.ts byte-for-byte (parity-gated).
        var header = new SectionNode(
            Heading: null,
            Children:
            [
                new TextNode("Transactions", TextStyle.Heading),
                new ButtonNode("+ Add Transaction", new ActionDescriptor("show-add"), Emphasis: Emphasis.Primary)
            ],
            Layout: Layout.Row,
            Arrange: Arrange.SpaceBetween,
            Align: Align.Center);

        var mainChildren = new List<ViewNode>
        {
            header,
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
                        Bind:     "addCategory",
                        Tabs:     state.Categories.Select(c =>
                            new TabItem(c.Id, c.Name, new ActionDescriptor($"select-category-{c.Id}"))).ToList()),
                    new FormNode(
                        SubmitAction: new ActionDescriptor("add"),
                        SubmitLabel:  "Add",
                        Children:
                        [
                            new FieldNode("amount", "number", "draftAmount", "Amount ($)", "0.00",          Required: true),
                            new FieldNode("note",   "text",   "draftNote",   "Note",       "Coffee, lunch…")
                        ])
                ],
                DismissAction: new ActionDescriptor("hide-add"),
                Size: ModalSize.Narrow));
        }
        var main = new SectionNode(null, mainChildren);

        return new PageNode(
            Title:    "Expenses",
            Children: [rail, main],
            Layout: Layout.Sidebar);
    }
}
