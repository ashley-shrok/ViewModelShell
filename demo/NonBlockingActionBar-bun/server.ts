// NonBlockingActionBar — selection → live server-computed action bar.
//
// The first of three purpose-built human-verification demo apps for the v4.1
// Non-Blocking Actions milestone (NBA-08). This is the PBMInvoices shape: a
// table of invoice rows, each with a selection checkbox. An "Approve
// Selected" / "Reject Selected" action bar is recomputed SERVER-SIDE after
// every checkbox toggle via a `blocking:false` round trip — never computed
// client-side.
//
//   - Checking a box writes `selectedIds.<id>` locally (optimistic bind
//     write — checks instantly) AND fires a non-blocking `recompute-<id>`
//     dispatch. The handler for that action does nothing but sleep
//     RECOMPUTE_DELAY_MS then fall through to the normal re-render, so the
//     operator has a comfortable window to click Approve/Reject before the
//     action bar visually catches up to the new selection.
//   - Approve/Reject's `disabled` flag is computed fresh on every render from
//     `state.rows` + `state.selectedIds` — never trusted from anything the
//     client could fake.
//   - On dispatch, `approve-selected`/`reject-selected` RE-VALIDATE the
//     submitted selection against the server's own row statuses. A selection
//     that includes a non-pending row (or is empty) is rejected via
//     `shellRejection` — visible both on the wire (`rejected.violations`)
//     and inline (`state.actionError`) — never silently applied.
//
// Single Bun.serve process serving both the Vite-built client and the
// /api/actionbar wire, following the Tasks-fullstack-bun pattern.

import {
  UnknownActionError,
  createAction,
  createAgentSkillHandler,
  shellRejection,
  type ErrorEntry,
  type TableRow,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

// ─── Domain model ────────────────────────────────────────────────────────────

type InvoiceStatus = "pending" | "locked" | "approved" | "rejected";

interface InvoiceRow {
  id: string;
  vendor: string;
  amount: string;
  status: InvoiceStatus;
}

interface DemoState {
  rows: InvoiceRow[];
  selectedIds: Record<string, boolean>;
  actionError: string | null;
}

function seedRows(): InvoiceRow[] {
  return [
    { id: "1", vendor: "Acme Supply Co.",      amount: "$1,240.00", status: "pending"  },
    { id: "2", vendor: "Northwind Traders",     amount: "$3,890.50", status: "pending"  },
    { id: "3", vendor: "Contoso Logistics",     amount: "$540.00",   status: "pending"  },
    // "locked" = claimed by another process — the disqualifying row the
    // 16-04 race script selects to force a stale-action-bar rejection.
    { id: "4", vendor: "Fabrikam Freight",      amount: "$2,100.75", status: "locked"   },
    { id: "5", vendor: "Globex Distribution",   amount: "$980.20",   status: "approved" },
    { id: "6", vendor: "Initech Materials",     amount: "$1,675.00", status: "rejected" },
  ];
}

function initialState(): DemoState {
  return { rows: seedRows(), selectedIds: {}, actionError: null };
}

const statusLabel = (s: InvoiceStatus): string =>
  s === "pending"  ? "Pending"  :
  s === "locked"   ? "Locked"   :
  s === "approved" ? "Approved" :
  s === "rejected" ? "Rejected" : s;

function rowById(state: DemoState, id: string): InvoiceRow | undefined {
  return state.rows.find((r) => r.id === id);
}

function selectedRowIds(state: DemoState): string[] {
  return Object.entries(state.selectedIds ?? {})
    .filter(([, checked]) => checked === true)
    .map(([id]) => id);
}

// ─── View ────────────────────────────────────────────────────────────────────

function buildVm(state: DemoState): ViewNode {
  const ids = selectedRowIds(state);
  const selectedRows = ids.map((id) => rowById(state, id));
  const allPendingAndNonEmpty =
    selectedRows.length > 0 && selectedRows.every((row) => row?.status === "pending");
  const approveRejectDisabled = !allPendingAndNonEmpty;
  const clearDisabled = ids.length === 0;

  const table: ViewNode = {
    type: "table",
    columns: [
      { key: "vendor", label: "Vendor" },
      { key: "amount", label: "Amount" },
      { key: "status", label: "Status" },
    ],
    rows: state.rows.map((row): TableRow => {
      const tableRow: TableRow = {
        id: row.id,
        cells: {
          vendor: row.vendor,
          amount: row.amount,
          status: statusLabel(row.status),
        },
        // Per-row unique action name — a shared "recompute" name across rows
        // would throw at response-build time (validateActionNames requires
        // per-row identity when the checkboxes aren't inside a shared form).
        actions: [
          {
            type: "checkbox",
            name: `select-${row.id}`,
            bind: `selectedIds.${row.id}`,
            action: { name: `recompute-${row.id}`, blocking: false },
          },
        ],
      };
      if (row.status === "locked") tableRow.tone = "warning";
      if (row.status === "rejected") tableRow.tone = "danger";
      if (row.status === "approved") tableRow.state = "done";
      return tableRow;
    }),
  };

  const actionBar: ViewNode = {
    type: "section",
    layout: "row",
    children: [
      {
        type: "button",
        label: "Approve Selected",
        emphasis: "primary",
        action: { name: "approve-selected" },
        disabled: approveRejectDisabled,
      },
      {
        type: "button",
        label: "Reject Selected",
        tone: "danger",
        action: { name: "reject-selected" },
        disabled: approveRejectDisabled,
      },
      {
        type: "button",
        label: "Clear Selection",
        action: { name: "clear-selection" },
        disabled: clearDisabled,
      },
    ],
  };

  const children: ViewNode[] = [
    {
      type: "text",
      value: "Selection → Live Server-Computed Action Bar",
      style: "heading",
    },
    {
      type: "text",
      value:
        "Toggle invoice checkboxes below. Each toggle checks instantly and " +
        "fires a non-blocking round trip that recomputes the action bar's " +
        "enabled/disabled state from the server's own row data — never " +
        "computed client-side. The recompute is artificially delayed " +
        `(${RECOMPUTE_DELAY_MS}ms) so there's a comfortable window to click ` +
        "Approve/Reject before the bar visually catches up.",
      style: "muted",
    },
  ];

  if (state.actionError) {
    children.push({ type: "text", value: state.actionError, tone: "danger" });
  }

  children.push(table, actionBar, {
    type: "button",
    label: "Reset Demo",
    action: { name: "reset-demo" },
  });

  return { type: "page", title: "NBA Demo — Selection to Live Action Bar", children };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

// Artificial delay on every recompute round trip — gives the operator a
// comfortable window to click Approve/Reject before the action bar's
// disabled/enabled state visually catches up to the new selection.
const RECOMPUTE_DELAY_MS = 750;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const actionHandler = createAction<DemoState>(async (payload) => {
  let state = payload.state;
  const name = payload.name;
  let violations: ErrorEntry[] | null = null;

  if (name.startsWith("recompute-")) {
    // The recomputed selectedIds value already landed in state via the
    // checkbox's own bind write — this handler's only job is the artificial
    // delay, then fall through to the default re-render below.
    await sleep(RECOMPUTE_DELAY_MS);
  } else if (name === "approve-selected" || name === "reject-selected") {
    const ids = selectedRowIds(state);
    const newStatus: InvoiceStatus = name === "approve-selected" ? "approved" : "rejected";
    const offendingRow = ids
      .map((id) => rowById(state, id))
      .find((row): row is InvoiceRow => row !== undefined && row.status !== "pending");

    if (ids.length === 0) {
      const message = "Select at least one invoice before approving or rejecting.";
      state = { ...state, actionError: message };
      violations = [{ message }];
    } else if (offendingRow) {
      const verb = name === "approve-selected" ? "approving" : "rejecting";
      const message =
        `"${offendingRow.vendor}" is ${statusLabel(offendingRow.status)}, not Pending — ` +
        `deselect it before ${verb}.`;
      state = { ...state, actionError: message };
      violations = [{ message }];
    } else {
      const idSet = new Set(ids);
      state = {
        ...state,
        rows: state.rows.map((row) =>
          idSet.has(row.id) ? { ...row, status: newStatus } : row,
        ),
        selectedIds: {},
        actionError: null,
      };
    }
  } else if (name === "clear-selection") {
    state = { ...state, selectedIds: {} };
  } else if (name === "reset-demo") {
    state = initialState();
  } else {
    throw new UnknownActionError(name);
  }

  return { vm: buildVm(state), state, ...(violations ? shellRejection(violations) : {}) };
});

// ─── HTTP server ─────────────────────────────────────────────────────────────

const distDir = new URL("./dist/", import.meta.url);

async function serveStatic(pathname: string): Promise<Response> {
  // "/" → index.html; strip leading slashes so the rest resolves under dist/.
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");

  // A static server must never escape its root.
  if (rel.split("/").some((seg) => seg === "..")) {
    return new Response("Forbidden", { status: 403 });
  }

  const file = Bun.file(new URL(rel, distDir));
  if (await file.exists()) {
    // Bun infers Content-Type from the file extension.
    return new Response(file);
  }

  // SPA-style fallback: an extension-less path (a client route) gets
  // index.html so the shell can still boot and load(). A genuinely missing
  // asset (has a `.`) is a real 404.
  if (!rel.includes(".")) {
    const index = Bun.file(new URL("index.html", distDir));
    if (await index.exists()) return new Response(index);
  }
  return new Response("Not Found", { status: 404 });
}

const skillHandler = createAgentSkillHandler({
  appPreamble:
    "This is the selection-to-live-action-bar non-blocking-actions demo. A table " +
    "of invoice rows carries per-row selection checkboxes; each toggle fires a " +
    "non-blocking (`blocking:false`) `recompute-<id>` dispatch that recomputes the " +
    "Approve/Reject action bar's disabled state from the server's own row data. " +
    "`approve-selected`/`reject-selected` re-validate the submitted selection and " +
    "reject (via the `rejected` envelope) if it includes a non-pending row.",
});

const port = Number(process.env.PORT ?? "3008");

Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // --- API ---
    if (url.pathname === "/api/actionbar" && request.method === "GET") {
      const state = initialState();
      return Response.json({ vm: buildVm(state), state });
    }
    if (url.pathname === "/api/actionbar/action" && request.method === "POST") {
      return actionHandler(request);
    }
    if (url.pathname === "/.well-known/vms-skill.md" && request.method === "GET") {
      return skillHandler(request);
    }

    // --- Everything else: the bundled shell client ---
    if (request.method === "GET") {
      return serveStatic(url.pathname);
    }
    return new Response("Method Not Allowed", { status: 405 });
  },
});

console.log(
  `NonBlockingActionBar full-stack (client + API) → http://localhost:${port}  —  open it in a browser`,
);
