// ExpenseTracker demo — TypeScript backend mirror of demo/ExpenseTracker/AspNetCore/.
// Faithful port of ExpensesController.cs + ExpensesState.cs (0.4.0 realistic-demo
// redesign): a finance app shell with a sidebar layout — a thin left "Overview"
// rail (headline numbers + per-category budget progress) next to a wide main
// area (an "+ Add" button, the transactions ledger as a read-only TableNode, and
// an add-transaction modal shown only when state.adding is true).
//
// Amount/Budget stored as numbers; JSON.parse normalizes trailing zeros, so
// 12.50 (C# decimal) and 12.5 (JS number) compare equal after the harness
// parses both. Money/percent formatting mirrors the controller exactly.

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
  filterCategory: string; // "all" or a category id
  addCategory: string; // category for new transactions
  adding: boolean; // is the add-transaction modal open
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
    adding: false,
  };
}

const f2 = (n: number) => n.toFixed(2);

// Mirror of C# DateTimeOffset.LocalDateTime.ToString("MMM d, h:mm tt").
// NOTE: like the controller this derives a display string from a volatile
// timestamp; cross-backend it varies by host TZ/culture (parity risk noted).
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
function fmtDate(iso: string): string {
  const d = new Date(iso);
  const mon = MONTHS[d.getMonth()];
  const day = d.getDate();
  let h = d.getHours();
  const ampm = h < 12 ? "AM" : "PM";
  h = h % 12;
  if (h === 0) h = 12;
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${mon} ${day}, ${h}:${min} ${ampm}`;
}

// Realistic YNAB/Mint finance app as a real app shell
// (page.layout:"sidebar"): a thin left "Overview" rail (headline
// numbers + per-category budget progress) next to a wide main area
// (add transaction + the transactions ledger).
function buildVm(state: ExpensesState): ViewNode {
  const totalBudget = state.categories.reduce((s, c) => s + c.budget, 0);
  const totalSpent = state.categories.reduce(
    (s, c) =>
      s +
      state.transactions
        .filter(t => t.categoryId === c.id)
        .reduce((ss, t) => ss + t.amount, 0),
    0,
  );
  const remaining = totalBudget - totalSpent;
  const pctUsed =
    totalBudget === 0 ? 0 : Math.round((100 * totalSpent) / totalBudget);

  // LEFT RAIL — at-a-glance summary + per-category budgets.
  const railChildren: ViewNode[] = [
    { type: "text", value: `$${f2(remaining)}`, style: "heading" },
    { type: "text", value: "remaining this month", style: "muted" },
    {
      type: "text",
      value: `Spent $${f2(totalSpent)} of $${f2(totalBudget)} · ${pctUsed}% used`,
      style: "muted",
    },
  ];
  for (const c of state.categories) {
    const spent = state.transactions
      .filter(t => t.categoryId === c.id)
      .reduce((s, t) => s + t.amount, 0);
    const pct =
      c.budget === 0 ? 0 : Math.min(100, Math.round((100 * spent) / c.budget));
    const over = spent > c.budget;
    railChildren.push({ type: "text", value: c.name, style: "subheading" });
    railChildren.push({
      type: "text",
      value: `$${f2(spent)} / $${f2(c.budget)}`,
      style: over ? "error" : "muted",
    });
    railChildren.push({ type: "progress", value: pct });
  }
  const rail: ViewNode = {
    type: "section",
    heading: "Overview",
    children: railChildren,
    variant: "card",
  };

  // MAIN — "+ Add" opens a modal; the main area is the ledger.

  const filterTabs = [
    { value: "all", label: "All" },
    ...state.categories.map(c => ({ value: c.id, label: c.name })),
  ];

  const filteredTx = (
    state.filterCategory === "all"
      ? state.transactions.slice()
      : state.transactions.filter(t => t.categoryId === state.filterCategory)
  ).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  ); // descending by createdAt

  const rows = filteredTx.map(t => {
    const cat = state.categories.find(c => c.id === t.categoryId);
    return {
      cells: {
        date: fmtDate(t.createdAt),
        category: cat?.name ?? t.categoryId,
        note: !t.note || !t.note.trim() ? "—" : t.note,
        amount: `$${f2(t.amount)}`,
      },
      id: t.id,
    };
  });

  const ledger: ViewNode = {
    type: "section",
    heading: "Transactions",
    children: [
      {
        type: "tabs",
        selected: state.filterCategory,
        action: { name: "filter" },
        tabs: filterTabs,
      },
      {
        type: "table",
        columns: [
          { key: "date",     label: "Date",     sortable: false, filterable: false, linkExternal: false },
          { key: "category", label: "Category", sortable: false, filterable: false, linkExternal: false },
          { key: "note",     label: "Note",     sortable: false, filterable: false, linkExternal: false },
          { key: "amount",   label: "Amount",   sortable: false, filterable: false, linkExternal: false },
        ],
        rows,
      },
    ],
  };

  const mainChildren: ViewNode[] = [
    {
      type: "button",
      label: "+ Add Transaction",
      action: { name: "show-add" },
      variant: "primary",
    },
    ledger,
  ];
  if (state.adding) {
    mainChildren.push({
      type: "modal",
      title: "Add Transaction",
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
            {
              type: "field",
              name: "amount",
              inputType: "number",
              label: "Amount ($)",
              placeholder: "0.00",
              required: true,
            },
            {
              type: "field",
              name: "note",
              inputType: "text",
              label: "Note",
              placeholder: "Coffee, lunch…",
              required: false,
            },
          ],
        },
      ],
      dismissAction: { name: "hide-add" },
      size: "narrow",
    });
  }
  const main: ViewNode = { type: "section", children: mainChildren };

  return {
    type: "page",
    title: "Expenses",
    children: [rail, main],
    layout: "sidebar",
  } as ViewNode;
}

const actionHandler = createAction<ExpensesState>(async payload => {
  const ctx = payload.context ?? {};
  const str = (k: string): string | null =>
    typeof ctx[k] === "string" ? (ctx[k] as string) : null;

  let state = payload.state;

  switch (payload.name) {
    case "add": {
      const amountStr = str("amount");
      const note = str("note") ?? "";
      const amount = amountStr ? parseFloat(amountStr) : NaN;
      if (!isFinite(amount) || amount <= 0)
        throw new Error("amount must be a positive number");
      const added: Transaction = {
        id: Array.from({ length: 8 }, () =>
          Math.floor(Math.random() * 16).toString(16),
        ).join(""),
        categoryId: state.addCategory,
        amount,
        note: note.trim(),
        createdAt: new Date().toISOString(),
      };
      state = {
        ...state,
        transactions: [...state.transactions, added],
        adding: false,
      };
      break;
    }
    case "delete": {
      // Retained as a valid action; not surfaced in the realistic
      // read-only ledger table (option A — TableNode cells are
      // text-only; no per-row action buttons. Logged limitation).
      const id = str("id");
      if (id !== null)
        state = {
          ...state,
          transactions: state.transactions.filter(t => t.id !== id),
        };
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
    case "show-add": {
      state = { ...state, adding: true };
      break;
    }
    case "hide-add": {
      state = { ...state, adding: false };
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
