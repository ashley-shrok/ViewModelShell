// ExpenseTracker demo — TypeScript backend mirror of demo/ExpenseTracker/AspNetCore/.
// Faithful port. Amount/Budget stored as numbers; JSON.parse normalizes
// trailing zeros, so 12.50 (C# decimal) and 12.5 (JS number) compare equal
// after the harness parses both.

import {
  createAction,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

interface Category {
  id: string;
  name: string;
  budget: number;
}
interface Transaction {
  id: string;
  categoryId: string;
  amount: number;
  note: string;
  createdAt: string;
}

interface ExpensesState {
  categories: Category[];
  transactions: Transaction[];
  filterCategory: string;
  addCategory: string;
}

function initialState(): ExpensesState {
  const now = Date.now();
  const h = (n: number) => new Date(now - n * 3_600_000).toISOString();
  return {
    categories: [
      { id: "food",          name: "Food",          budget: 500 },
      { id: "transport",     name: "Transport",     budget: 150 },
      { id: "entertainment", name: "Entertainment", budget: 200 },
      { id: "bills",         name: "Bills",         budget: 800 },
    ],
    transactions: [
      { id: "1", categoryId: "food",          amount: 12.5,  note: "Lunch",            createdAt: h(5) },
      { id: "2", categoryId: "transport",     amount: 45,    note: "Monthly pass",     createdAt: h(4) },
      { id: "3", categoryId: "bills",         amount: 850,   note: "Rent",             createdAt: h(3) },
      { id: "4", categoryId: "entertainment", amount: 15.99, note: "Streaming",        createdAt: h(2) },
      { id: "5", categoryId: "food",          amount: 8.75,  note: "Coffee and snack", createdAt: h(1) },
    ],
    filterCategory: "all",
    addCategory: "food",
  };
}

const f2 = (n: number) => n.toFixed(2);

function buildVm(state: ExpensesState): ViewNode {
  const totalBudget = state.categories.reduce((s, c) => s + c.budget, 0);
  const totalSpent = state.categories.reduce((s, c) =>
    s + state.transactions.filter(t => t.categoryId === c.id).reduce((ss, t) => ss + t.amount, 0), 0);

  const filteredTx = state.filterCategory === "all"
    ? state.transactions
    : state.transactions.filter(t => t.categoryId === state.filterCategory);

  const categoryItems: ViewNode[] = state.categories.map<ViewNode>(c => {
    const spent = state.transactions.filter(t => t.categoryId === c.id).reduce((s, t) => s + t.amount, 0);
    const pct = c.budget === 0 ? 0 : Math.min(100, Math.round(100 * spent / c.budget));
    const over = spent > c.budget;
    return {
      type: "list-item",
      id: c.id,
      variant: over ? "warning" : undefined,
      children: [
        { type: "text", value: c.name, style: "subheading" },
        { type: "text", value: `$${f2(spent)} / $${f2(c.budget)}`, style: over ? "muted" : undefined },
        { type: "progress", value: pct },
      ],
    };
  });

  const txItems: ViewNode[] = filteredTx
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)) // descending
    .map<ViewNode>(t => {
      const cat = state.categories.find(c => c.id === t.categoryId);
      const label = !t.note || !t.note.trim() ? (cat?.name ?? t.categoryId) : t.note;
      return {
        type: "list-item",
        id: t.id,
        children: [
          { type: "text", value: `$${f2(t.amount)}`, style: "subheading" },
          { type: "text", value: label },
          { type: "text", value: cat?.name ?? t.categoryId, style: "muted" },
          {
            type: "button",
            label: "Delete",
            action: { name: "delete", context: { id: t.id } },
            variant: "danger",
          },
        ],
      };
    });

  const filterTabs = [
    { value: "all", label: "All" },
    ...state.categories.map(c => ({ value: c.id, label: c.name })),
  ];

  return {
    type: "page",
    title: "Expenses",
    children: [
      {
        type: "stat-bar",
        stats: [
          { label: "spent this month", value: `$${f2(totalSpent)}` },
          { label: "monthly budget",   value: `$${f2(totalBudget)}` },
          { label: "remaining",        value: `$${f2(totalBudget - totalSpent)}` },
        ],
      },
      {
        type: "section",
        heading: "Categories",
        children: [{ type: "list", children: categoryItems }],
      },
      {
        type: "section",
        heading: "Add Transaction",
        children: [
          {
            type: "tabs",
            selected: state.addCategory,
            action: { name: "select-category" },
            tabs: state.categories.map(c => ({ value: c.id, label: c.name })),
          },
          {
            type: "form",
            submitAction: { name: "add" },
            submitLabel: "Add",
            children: [
              { type: "field", name: "amount", inputType: "number", label: "Amount ($)", placeholder: "0.00", required: true },
              { type: "field", name: "note",   inputType: "text",   label: "Note",       placeholder: "Coffee, lunch…", required: false },
            ],
          },
        ],
      },
      {
        type: "section",
        heading: "Transactions",
        children: [
          {
            type: "tabs",
            selected: state.filterCategory,
            action: { name: "filter" },
            tabs: filterTabs,
          },
          { type: "list", children: txItems },
        ],
      },
    ],
  };
}

const actionHandler = createAction<ExpensesState>(async (payload) => {
  const ctx = payload.context ?? {};
  const str = (k: string): string | null => (typeof ctx[k] === "string" ? (ctx[k] as string) : null);

  let state = payload.state;

  switch (payload.name) {
    case "add": {
      const amountStr = str("amount");
      const note = str("note") ?? "";
      const amount = amountStr ? parseFloat(amountStr) : NaN;
      if (!isFinite(amount) || amount <= 0) throw new Error("amount must be a positive number");
      const added: Transaction = {
        id: Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
        categoryId: state.addCategory,
        amount,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      };
      state = { ...state, transactions: [...state.transactions, added] };
      break;
    }
    case "delete": {
      const id = str("id");
      if (id) state = { ...state, transactions: state.transactions.filter(t => t.id !== id) };
      break;
    }
    case "filter": {
      const value = str("value");
      if (value !== null) state = { ...state, filterCategory: value };
      break;
    }
    case "select-category": {
      const value = str("value");
      if (value !== null) state = { ...state, addCategory: value };
      break;
    }
    default:
      throw new Error(`Unknown action: ${payload.name}`);
  }

  return { vm: buildVm(state), state };
});

const port = Number(process.env.PORT ?? "3004");

Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/expenses" && request.method === "GET") {
      const state = initialState();
      return Response.json({ vm: buildVm(state), state });
    }
    if (url.pathname === "/api/expenses/action" && request.method === "POST") {
      return actionHandler(request);
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`ExpenseTracker Bun backend listening on http://localhost:${port}`);
