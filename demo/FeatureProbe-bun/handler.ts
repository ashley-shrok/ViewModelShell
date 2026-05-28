// FeatureProbe — runtime-neutral request handler.
// Imported by server.ts (Bun) and server-node.ts (Node 22+) to prove the
// same TypeScript code runs unchanged on multiple Web Fetch runtimes.

import {
  createAction,
  shellRedirect,
  shellSideEffect,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

interface FeatureProbeState {
  pollCount: number;
  lastUploadName: string | null;
  lastUploadSize: number;
  lastSubmit?: string | null;   // 0.10.0/#15: "{action}: {note}" from the multi-action form
  // 0.12.0/#16: table feature-matrix state — see the C# twin for the parity
  // rationale (defaults must match byte-for-byte: "" and [] over null/undefined).
  tableSortCol?: string | null;
  tableSortDir?: string | null;
  tableFilter: string;
  tablePage: number;
  tableSelected: string[];
}

function initialState(): FeatureProbeState {
  return {
    pollCount: 0, lastUploadName: null, lastUploadSize: 0,
    tableFilter: "", tablePage: 1, tableSelected: [],
  };
}

// Mirror of the C# seed — fixed order + ASCII so ordinal sort agrees.
const PAGE_SIZE = 3;
interface TableItem { id: string; name: string; status: string; }
const ITEMS: TableItem[] = [
  { id: "1", name: "Apple",      status: "active" },
  { id: "2", name: "Banana",     status: "active" },
  { id: "3", name: "Cherry",     status: "done" },
  { id: "4", name: "Date",       status: "active" },
  { id: "5", name: "Elderberry", status: "done" },
  { id: "6", name: "Fig",        status: "active" },
  { id: "7", name: "Grape",      status: "done" },
];

// Filter → sort → paginate. Server slices; the adapter only renders controls.
// Sort: ordinal (code-unit) compare with id tiebreak — a total order, matching
// the C# CompareOrdinal path so the two backends agree row-for-row.
function tableWindow(s: FeatureProbeState): { page: TableItem[]; total: number; clampedPage: number } {
  let rows = ITEMS.slice();
  if (s.tableFilter) {
    const f = s.tableFilter.toLowerCase();
    rows = rows.filter((i) => i.name.toLowerCase().includes(f));
  }
  if (s.tableSortCol) {
    const col = s.tableSortCol;
    const dir = s.tableSortDir === "desc" ? -1 : 1;
    rows.sort((a, b) => {
      const av = col === "name" ? a.name : col === "status" ? a.status : "";
      const bv = col === "name" ? b.name : col === "status" ? b.status : "";
      let c = av < bv ? -1 : av > bv ? 1 : 0;
      if (c === 0) c = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      return c * dir;
    });
  }
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const clampedPage = Math.min(Math.max(s.tablePage, 1), totalPages);
  const page = rows.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);
  return { page, total, clampedPage };
}

function buildTableSection(state: FeatureProbeState): ViewNode {
  const { page, total, clampedPage } = tableWindow(state);
  const selected = state.tableSelected;
  const table = {
    type: "table",
    columns: [
      {
        key: "name", label: "Name", sortable: true, filterable: true, linkExternal: false,
        ...(state.tableFilter.length > 0 ? { filterValue: state.tableFilter } : {}),
      },
      { key: "status", label: "Status", sortable: true, filterable: false, linkExternal: false },
    ],
    rows: page.map((i) => ({ cells: { name: i.name, status: i.status }, id: i.id })),
    ...(state.tableSortCol != null ? { sortColumn: state.tableSortCol } : {}),
    ...(state.tableSortDir != null ? { sortDirection: state.tableSortDir } : {}),
    sortAction: { name: "table-sort" },
    filterAction: { name: "table-filter" },
    selection: { selectedIds: selected, action: { name: "table-select" } },
    pagination: { page: clampedPage, pageSize: PAGE_SIZE, totalRows: total, action: { name: "table-page" } },
  } as ViewNode;
  return {
    type: "section",
    heading: "Table matrix",
    variant: "card",
    children: [
      { type: "text", value: `${selected.length} selected`, style: "muted" },
      table,
    ],
  };
}

function buildVm(state: FeatureProbeState): ViewNode {
  const children: ViewNode[] = [
    { type: "text", value: `Poll count: ${state.pollCount}`, style: "muted" },
  ];
  if (state.lastUploadName !== null) {
    children.push({
      type: "text",
      value: `Last upload: ${state.lastUploadName} (${state.lastUploadSize} bytes)`,
      style: "muted",
    });
  }
  children.push(
    { type: "copy-button", text: "npx @ashley-shrok/viewmodel-shell", label: "Copy install command", copiedLabel: "Copied!", variant: "secondary" } as ViewNode,   // 0.9.0/#14
  );
  // 0.11.0/#5: ImageNode — exercises src/alt/size/shape on the parity wire.
  children.push({ type: "image", src: "/logo.png", alt: "ViewModel Shell logo", size: "small", shape: "circle" } as ViewNode);
  if (state.lastSubmit != null) {
    children.push({ type: "text", value: `Last submit: ${state.lastSubmit}`, style: "muted" });
  }
  // 0.10.0/#15: one form, shared "note" field, two buttons each dispatching a
  // DIFFERENT action carrying the field's current value.
  children.push({
    type: "form",
    children: [{ type: "field", name: "note", inputType: "text", label: "Note", placeholder: "Type a note…", required: false }],
    buttons: [
      { type: "button", label: "Save Draft", action: { name: "save-draft" }, variant: "secondary" },
      { type: "button", label: "Publish", action: { name: "publish" }, variant: "primary" },
    ],
  } as ViewNode);
  const probeSection: ViewNode = {
    type: "section",
    heading: "Probe",
    variant: "card",
    layout: "split",
    children,
  };
  return {
    type: "page",
    title: "Feature Probe",
    density: "compact",
    layout: "cards",
    children: [probeSection, buildTableSection(state)],
  };
}

const actionHandler = createAction<FeatureProbeState>(async (payload) => {
  const ctx = payload.context ?? {};
  const str = (k: string): string | null => (typeof ctx[k] === "string" ? (ctx[k] as string) : null);
  const bool = (k: string): boolean => ctx[k] === true;
  const int = (k: string, dflt: number): number => (typeof ctx[k] === "number" ? (ctx[k] as number) : dflt);

  let state = payload.state;

  switch (payload.name) {
    case "trigger-redirect":
      return shellRedirect<FeatureProbeState>(str("to") ?? "/default-redirect");

    case "set-storage":
      return {
        vm: buildVm(state),
        state,
        sideEffects: [
          shellSideEffect.setLocalStorage("probe-local",   str("local-value")   ?? "default-local"),
          shellSideEffect.setSessionStorage("probe-session", str("session-value") ?? "default-session"),
        ],
      };

    case "trigger-download":
      return {
        vm: buildVm(state),
        state,
        sideEffects: [
          shellSideEffect.download(
            str("url")      ?? "/api/probe/file/hello.txt",
            str("filename") ?? "hello.txt",
          ),
        ],
      };

    case "do-poll": {
      state = { ...state, pollCount: state.pollCount + 1 };
      const done = state.pollCount >= 3;
      return {
        vm: buildVm(state),
        state,
        ...(done ? {} : { nextPollIn: 100 }),
      };
    }

    case "upload": {
      const file = payload.files["attachment"];
      if (file) {
        state = { ...state, lastUploadName: file.name, lastUploadSize: file.size };
      }
      break;
    }

    case "show-copy-button":
      break;  // state unchanged; buildVm always includes the copy-button node

    // 0.10.0/#15: two buttons[] on ONE form sharing the "note" field.
    case "save-draft":
      state = { ...state, lastSubmit: `draft: ${str("note") ?? ""}` };
      break;
    case "publish":
      state = { ...state, lastSubmit: `published: ${str("note") ?? ""}` };
      break;

    case "reset":
      state = initialState();
      break;

    // ── table feature-matrix (0.12.0/#16) ─ mirror of the C# twin ──────────
    case "table-sort":
      state = { ...state, tableSortCol: str("column"), tableSortDir: str("direction"), tablePage: 1 };
      break;

    case "table-filter":
      state = { ...state, tableFilter: str("value") ?? "", tablePage: 1 };
      break;

    case "table-page":
      state = { ...state, tablePage: int("page", state.tablePage) };
      break;

    case "table-select": {
      const set = new Set(state.tableSelected);
      if (bool("all")) {
        const pageIds = tableWindow(state).page.map((i) => i.id);
        if (bool("checked")) for (const id of pageIds) set.add(id);
        else                 for (const id of pageIds) set.delete(id);
      } else {
        const id = str("id");
        if (id != null) { if (bool("checked")) set.add(id); else set.delete(id); }
      }
      // Re-materialize in seed order so the array round-trips identically.
      state = { ...state, tableSelected: ITEMS.filter((i) => set.has(i.id)).map((i) => i.id) };
      break;
    }

    default:
      throw new Error(`Unknown action: ${payload.name}`);
  }

  return { vm: buildVm(state), state };
});

export async function fetchHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/probe" && request.method === "GET") {
    const state = initialState();
    return Response.json({ vm: buildVm(state), state });
  }
  if (url.pathname === "/api/probe/action" && request.method === "POST") {
    return actionHandler(request);
  }
  return new Response("Not Found", { status: 404 });
}
