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
//
// Phase 6 wire-shape migration (0.17.0 / WIRE-07): inputs declare `bind` paths
// into state slots (filterCategory, addCategory, draftAmount, draftNote);
// each filter tab and category tab carries its own unique action name
// (filter-{id} / select-category-{id}); the action handler reads from state
// rather than a context payload.

import {
  UnknownActionError,
  createAction,
  validateActionNames,
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
  // Phase 6 — bind slots for the add-transaction form. Reset on add/close.
  draftAmount: string;
  draftNote: string;
  // modal-swap-to-success: when set, the add modal STAYS OPEN (adding=true) and
  // swaps its body from the form to a success card. Set by a successful add;
  // cleared by show-add / hide-add ([Done]). Optional => absent from the wire
  // when unset, matching the .NET twin's [JsonIgnore(WhenWritingNull)].
  addSuccessMessage?: string;
  // gotcha #4: inline validation rides state (response stays ok:true), NOT a
  // BadRequest — rendered as a danger TextNode in the form when set.
  validationError?: string;
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
    draftAmount: "",
    draftNote: "",
  };
}

const f2 = (n: number) => n.toFixed(2);

// Mirror of C# DateTimeOffset.LocalDateTime.ToString("MMM d, h:mm tt").
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
      style: over ? undefined : "muted",
      tone: over ? "danger" : undefined,
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
    { value: "all", label: "All", action: { name: "filter-all" } },
    ...state.categories.map(c => ({
      value: c.id,
      label: c.name,
      action: { name: `filter-${c.id}` },
    })),
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
    // Heading omitted — the header-bar row above now carries the "Transactions"
    // title, so repeating it on the ledger section would double up.
    children: [
      {
        type: "tabs",
        selected: state.filterCategory,
        bind: "filterCategory",
        tabs: filterTabs,
      },
      {
        type: "table",
        columns: [
          { key: "date",     label: "Date" },
          { key: "category", label: "Category" },
          { key: "note",     label: "Note" },
          { key: "amount",   label: "Amount" },
        ],
        rows,
      },
    ],
  };

  // 1.11.0/1.12.0 — the canonical header bar: a `layout:"row"` cluster with
  // `arrange:"space-between"` pushing the page title hard-left and the primary
  // action hard-right (a heading TextNode as the FIRST child + the action). No
  // app CSS; the row wraps intrinsically on narrow viewports. This replaces the
  // bare left-aligned "+ Add" button with a proper titled toolbar.
  const header: ViewNode = {
    type: "section",
    layout: "row",
    arrange: "space-between",
    align: "center",
    children: [
      { type: "text", value: "Transactions", style: "heading" },
      {
        type: "button",
        label: "+ Add Transaction",
        action: { name: "show-add" },
        emphasis: "primary",
      },
    ],
  };

  const mainChildren: ViewNode[] = [
    header,
    ledger,
  ];
  if (state.adding) {
    // modal-swap-to-success: the SAME modal stays open across renders; only its
    // title + children change. After a successful add the body is a success card
    // + [Done]; otherwise the entry form (with an inline validation error when the
    // last submit failed). See AGENTS.md "In-modal success feedback" — the durable
    // outcome-in-view answer that (unlike a toast) survives the operator stepping
    // away. Mirrors demo/ExpenseTracker/AspNetCore byte-for-byte (parity-gated).
    let modalChildren: ViewNode[];
    if (state.addSuccessMessage != null) {
      modalChildren = [
        { type: "text", value: state.addSuccessMessage, tone: "success" },
        {
          type: "button",
          label: "Done",
          action: { name: "hide-add" },
          emphasis: "primary",
          width: "full",
        },
      ];
    } else {
      modalChildren = [
        {
          type: "tabs",
          selected: state.addCategory,
          bind: "addCategory",
          tabs: state.categories.map(c => ({
            value: c.id,
            label: c.name,
            action: { name: `select-category-${c.id}` },
          })),
        },
      ];
      if (state.validationError != null)
        modalChildren.push({ type: "text", value: state.validationError, tone: "danger" });
      modalChildren.push({
        type: "form",
        submitAction: { name: "add" },
        submitLabel: "Add",
        children: [
          {
            type: "field",
            name: "amount",
            inputType: "number",
            bind: "draftAmount",
            label: "Amount ($)",
            placeholder: "0.00",
            required: true,
          },
          {
            type: "field",
            name: "note",
            inputType: "text",
            bind: "draftNote",
            label: "Note",
            placeholder: "Coffee, lunch…",
          },
        ],
      });
    }
    mainChildren.push({
      type: "modal",
      title: state.addSuccessMessage != null ? "Transaction added" : "Add Transaction",
      children: modalChildren,
      // On the success branch [Done] IS the dismiss (it carries hide-add), so the
      // modal omits its own X — a second hide-add in the same tree is a duplicate-
      // action-name validator failure. On the form branch the X is the cancel.
      ...(state.addSuccessMessage != null ? {} : { dismissAction: { name: "hide-add" } }),
      size: "narrow",
    });
  }
  const main: ViewNode = { type: "section", children: mainChildren };

  return {
    type: "page",
    title: "Expenses",
    children: [rail, main],
    layout: "sidebar",
  };
}

const actionHandler = createAction<ExpensesState>(async payload => {
  let state = payload.state;
  const name = payload.name;

  if (name === "add") {
    const amount = state.draftAmount ? parseFloat(state.draftAmount) : NaN;
    const note = state.draftNote ?? "";
    if (!isFinite(amount) || amount <= 0) {
      // gotcha #4 — routine inline validation the user CAN see rides the state
      // record (response stays ok:true); it is NOT a BadRequest. The modal stays
      // open on the form branch with the error shown.
      state = { ...state, validationError: "Amount must be a positive number." };
    } else {
      const catName =
        state.categories.find(c => c.id === state.addCategory)?.name ??
        state.addCategory;
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
        // modal-swap-to-success: keep the modal OPEN and swap its body to a
        // success card. [Done]/dismiss (hide-add) closes + clears.
        adding: true,
        draftAmount: "",
        draftNote: "",
        validationError: undefined,
        addSuccessMessage: `Added $${f2(amount)} to ${catName}.`,
      };
    }
  } else if (name.startsWith("filter-")) {
    // filterCategory is already in state via the bind path; the server just
    // acknowledges by re-rendering against the new value.
  } else if (name.startsWith("select-category-")) {
    // addCategory is already in state via the bind path; same pattern.
  } else if (name === "show-add") {
    state = { ...state, adding: true, addSuccessMessage: undefined, validationError: undefined };
  } else if (name === "hide-add") {
    // Also the [Done] action on the success card — clears the swap state.
    state = {
      ...state,
      adding: false,
      draftAmount: "",
      draftNote: "",
      addSuccessMessage: undefined,
      validationError: undefined,
    };
  } else {
    throw new UnknownActionError(name);
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
      const vm = buildVm(state);
      validateActionNames(vm);
      return Response.json({ ok: true, vm, state });
    }
    if (url.pathname === "/api/expenses/action" && request.method === "POST") {
      return actionHandler(request);
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`ExpenseTracker Bun backend listening on http://localhost:${port}`);
