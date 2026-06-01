// HelpDesk demo — TypeScript backend mirror of demo/HelpDesk/AspNetCore/.
// Two controllers (Agent + Requester) sharing a SQLite DB. Faithful port of
// the wire format, action semantics, label formatting, and SQL schema.

import {
  createAction,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";
import { Database } from "bun:sqlite";

// ─── Ticket / state types ────────────────────────────────────────────────────

interface Ticket {
  id: number;
  title: string;
  type: string;
  priority: string;
  status: string;
  description: string | null;
  dueDate: string | null;
  deviceModel: string | null;
  application: string | null;
  systemName: string | null;
  accessLevel: string | null;
  createdAt: string;
  resolvedAt: string | null;
  agentNotes: string | null;
}

interface AgentState {
  view: string;
  selectedTicketId: number | null;
  filter: string;
  notesSaved: boolean;
  // 0.15.1 — canonical workflow pattern: filter narrows under the cap, no
  // pagination. titleFilter is the free-text Title column input. (page was
  // removed; selectedIds was removed in 0.13.0.)
  titleFilter: string;
}
function agentInitial(): AgentState {
  return { view: "queue", selectedTicketId: null, filter: "all", notesSaved: false, titleFilter: "" };
}

interface RequesterState {
  view: string;
  selectedTicketId: number | null;
  filter: string;
  createType: string;
  createPriority: string;
  createAccessLevel: string;
  validationError: string | null;
}
function requesterInitial(): RequesterState {
  return {
    view: "list",
    selectedTicketId: null,
    filter: "all",
    createType: "hardware",
    createPriority: "medium",
    createAccessLevel: "read",
    validationError: null,
  };
}

// ─── SQLite ──────────────────────────────────────────────────────────────────

const dbPath = process.env.HELPDESK_DB ?? "./helpdesk.db";
const db = new Database(dbPath);
// 0.15.1 — seed flag mirrors the C# twin. Default seeds on first init for the
// canonical workflow demo; HELPDESK_SEED=0 disables (parity sets this so IDs
// stay stable for the fixture).
const SEED_ENABLED = process.env.HELPDESK_SEED !== "0";
db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT NOT NULL,
    type         TEXT NOT NULL,
    priority     TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'open',
    description  TEXT,
    due_date     TEXT,
    device_model TEXT,
    application  TEXT,
    system_name  TEXT,
    access_level TEXT,
    created_at   TEXT NOT NULL,
    resolved_at  TEXT,
    agent_notes  TEXT
  )
`);

interface TicketRow {
  id: number;
  title: string;
  type: string;
  priority: string;
  status: string;
  description: string | null;
  due_date: string | null;
  device_model: string | null;
  application: string | null;
  system_name: string | null;
  access_level: string | null;
  created_at: string;
  resolved_at: string | null;
  agent_notes: string | null;
}

function mapTicket(r: TicketRow): Ticket {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    priority: r.priority,
    status: r.status,
    description: r.description,
    dueDate: r.due_date,
    deviceModel: r.device_model,
    application: r.application,
    systemName: r.system_name,
    accessLevel: r.access_level,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
    agentNotes: r.agent_notes,
  };
}

function dbGetAll(status: string | null): Ticket[] {
  const rows = status
    ? db.query<TicketRow, [string]>(
        "SELECT * FROM tickets WHERE status = ? ORDER BY created_at DESC"
      ).all(status)
    : db.query<TicketRow, []>(
        "SELECT * FROM tickets ORDER BY created_at DESC"
      ).all();
  return rows.map(mapTicket);
}

// 0.12.0/#16: server-side pagination for the agent queue. Ordered created_at
// DESC then id DESC (total order → deterministic page boundaries matching C#).
function dbGetPage(status: string | null, limit: number, offset: number): Ticket[] {
  const rows = status
    ? db.query<TicketRow, [string, number, number]>(
        "SELECT * FROM tickets WHERE status = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?"
      ).all(status, limit, offset)
    : db.query<TicketRow, [number, number]>(
        "SELECT * FROM tickets ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?"
      ).all(limit, offset);
  return rows.map(mapTicket);
}

function dbCount(status: string | null): number {
  const row = status
    ? db.query<{ n: number }, [string]>("SELECT COUNT(*) AS n FROM tickets WHERE status = ?").get(status)
    : db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM tickets").get();
  return row?.n ?? 0;
}

// 0.15.1 — canonical workflow pattern: combined status + title-text filter.
function dbCountMatching(status: string | null, titleFilter: string): number {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (status) { clauses.push("status = ?"); params.push(status); }
  if (titleFilter) { clauses.push("title LIKE ?"); params.push(`%${titleFilter}%`); }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const row = db.query<{ n: number }, (string | number)[]>(`SELECT COUNT(*) AS n FROM tickets${where}`).all(...params)[0];
  return row?.n ?? 0;
}

function dbGetMatching(status: string | null, titleFilter: string, limit: number): Ticket[] {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (status) { clauses.push("status = ?"); params.push(status); }
  if (titleFilter) { clauses.push("title LIKE ?"); params.push(`%${titleFilter}%`); }
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  params.push(limit);
  const rows = db.query<TicketRow, (string | number)[]>(
    `SELECT * FROM tickets${where} ORDER BY created_at DESC, id DESC LIMIT ?`
  ).all(...params);
  return rows.map(mapTicket);
}

// 0.15.1 — seed demo data so the canonical pattern is visible locally.
// Idempotent (skips if table has rows). HELPDESK_SEED=0 disables (parity).
function seedDemoDataIfNeeded(): void {
  if (!SEED_ENABLED) return;
  if (dbCount(null) > 0) return;
  const titles = [
    "Laptop won't boot",          "VPN client crashes on login",  "Email rules not applying",
    "Outlook search index corrupt", "Slow file server response",  "Printer driver missing",
    "Monitor displays artifacts", "Keyboard keys stuck",          "Webcam not detected",
    "Headset audio cutting out",  "Excel macros disabled",        "Teams meetings drop randomly",
    "OneDrive sync stuck",        "Browser bookmarks lost",       "Disk space low warning",
    "New laptop request",         "Add user to billing group",    "Reset password — Salesforce",
    "Increase file share quota",  "Mobile device enrollment",     "Two-factor enrollment failing",
    "Software install — Figma",   "License renewal — Adobe CC",   "Software update fails — Office",
    "Hardware refresh — desktop", "Phone hand-off issue",         "Bluetooth pairing fails",
  ];
  const types = ["hardware", "software", "access"];
  const priorities = ["low", "medium", "medium", "high", "critical"];
  const distribution: [number, string][] = [[35, "open"], [22, "in-progress"], [23, "resolved"]];

  const insert = db.query(
    "INSERT INTO tickets (title, type, priority, status, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  const now = Date.now();
  db.exec("BEGIN");
  let idx = 0;
  for (const [count, status] of distribution) {
    for (let i = 0; i < count; i++) {
      const base = titles[idx % titles.length];
      const title = idx < titles.length ? base : `${base} (#${idx - titles.length + 2})`;
      insert.run(
        title,
        types[idx % types.length],
        priorities[idx % priorities.length],
        status,
        new Date(now - idx * 3600_000).toISOString(),
      );
      idx++;
    }
  }
  db.exec("COMMIT");
}
seedDemoDataIfNeeded();

function dbGetById(id: number): Ticket | null {
  const row = db.query<TicketRow, [number]>(
    "SELECT * FROM tickets WHERE id = ?"
  ).get(id);
  return row ? mapTicket(row) : null;
}

interface CreateInput {
  title: string;
  type: string;
  priority: string;
  description: string | null;
  dueDate: string | null;
  deviceModel: string | null;
  application: string | null;
  systemName: string | null;
  accessLevel: string | null;
}
function dbCreate(input: CreateInput): number {
  const now = new Date().toISOString();
  const stmt = db.query<{ id: number }, any[]>(`
    INSERT INTO tickets
      (title, type, priority, status, description, due_date,
       device_model, application, system_name, access_level, created_at)
    VALUES
      (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `);
  const row = stmt.get(
    input.title, input.type, input.priority,
    input.description, input.dueDate, input.deviceModel,
    input.application, input.systemName, input.accessLevel, now
  );
  return row!.id;
}

function dbUpdateStatus(id: number, status: string): void {
  if (status === "resolved") {
    db.query("UPDATE tickets SET status = ?, resolved_at = ? WHERE id = ?")
      .run(status, new Date().toISOString(), id);
  } else {
    db.query("UPDATE tickets SET status = ?, resolved_at = NULL WHERE id = ?")
      .run(status, id);
  }
}

function dbUpdateAgentNotes(id: number, notes: string | null): void {
  db.query("UPDATE tickets SET agent_notes = ? WHERE id = ?").run(notes, id);
}

interface Counts { open: number; inProgress: number; resolved: number; }
function dbGetCounts(): Counts {
  const row = db.query<{ open: number; inProgress: number; resolved: number }, []>(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'open'        THEN 1 ELSE 0 END), 0) AS open,
      COALESCE(SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END), 0) AS inProgress,
      COALESCE(SUM(CASE WHEN status = 'resolved'    THEN 1 ELSE 0 END), 0) AS resolved
    FROM tickets
  `).get();
  return row ?? { open: 0, inProgress: 0, resolved: 0 };
}

// ─── Label helpers ──────────────────────────────────────────────────────────

const typeLabel = (t: string) =>
  t === "hardware" ? "Hardware" :
  t === "software" ? "Software" :
  t === "access"   ? "Access Request" : t;

const priorityLabel = (p: string) =>
  p === "low"      ? "Low"      :
  p === "medium"   ? "Medium"   :
  p === "high"     ? "High"     :
  p === "critical" ? "Critical" : p;

const statusLabel = (s: string) =>
  s === "open"        ? "Open"        :
  s === "in-progress" ? "In Progress" :
  s === "resolved"    ? "Resolved"    : s;

const ticketVariant = (t: Ticket): string | undefined =>
  t.status === "resolved" ? "done" :
  t.priority === "critical" ? "critical" :
  t.priority === "high"     ? "high"     : undefined;

function formatDate(iso: string): string {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  // Match C#'s "MMM d, yyyy" with ToLocalTime()
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Agent controller ───────────────────────────────────────────────────────
// Mirrors AgentController.cs: a full-width filterable ticket queue
// (TableNode; whole-row click opens the ticket) → a dedicated full
// ticket PageNode. The navigate pattern real ticketing actually uses.

// 0.15.1 — canonical workflow pattern (see AGENTS.md "Tables in VMS"):
// filter narrows under the cap → show ALL matches with selection.buttons[];
// over cap → "narrow further" notice + empty table (filter input stays
// accessible). Pick AGENT_CAP to fit row weight + working memory.
const AGENT_CAP = 25;

function agentBuildQueuePage(state: AgentState): ViewNode {
  const counts = dbGetCounts();
  const status = state.filter === "all" ? null : state.filter;
  const matching = dbCountMatching(status, state.titleFilter);
  const withinCap = matching <= AGENT_CAP;
  const tickets = withinCap ? dbGetMatching(status, state.titleFilter, AGENT_CAP) : [];

  const rows = tickets.map(t => {
    const variant = ticketVariant(t);
    const row: {
      cells: Record<string, string>;
      id?: string;
      action?: { name: string; context?: Record<string, unknown> };
      variant?: string;
    } = {
      cells: {
        title:    t.title,
        type:     typeLabel(t.type),
        priority: priorityLabel(t.priority),
        status:   statusLabel(t.status),
        due:      !t.dueDate ? "—" : t.dueDate,
      },
      id: String(t.id),
      action: { name: "select-ticket", context: { id: String(t.id) } },
    };
    if (variant !== undefined) row.variant = variant;
    return row;
  });

  const children: ViewNode[] = [
    {
      type: "text",
      value: `${counts.open} open · ${counts.inProgress} in progress · ${counts.resolved} resolved`,
      style: "muted",
    },
    {
      type: "tabs",
      selected: state.filter,
      action: { name: "filter" },
      tabs: [
        { value: "all",         label: "All" },
        { value: "open",        label: "Open" },
        { value: "in-progress", label: "In Progress" },
        { value: "resolved",    label: "Resolved" },
      ],
    },
  ];

  // Over-cap notice rendered ABOVE the table so the filter input (in the
  // table header) stays accessible.
  if (!withinCap) {
    children.push({
      type: "text",
      value: `${matching} tickets match — refine the filter (max ${AGENT_CAP} shown).`,
      style: "warning",
    });
  }

  // Title column is filterable; FilterAction dispatches with { column, value, filters }.
  // selection.buttons[] only present when within-cap and rows exist.
  const titleCol: Record<string, unknown> = {
    key: "title", label: "Title", sortable: false, filterable: true, linkExternal: false,
  };
  if (state.titleFilter.length > 0) titleCol.filterValue = state.titleFilter;

  const table: Record<string, unknown> = {
    type: "table",
    columns: [
      titleCol,
      { key: "type",     label: "Type",     sortable: false, filterable: false, linkExternal: false },
      { key: "priority", label: "Priority", sortable: false, filterable: false, linkExternal: false },
      { key: "status",   label: "Status",   sortable: false, filterable: false, linkExternal: false },
      { key: "due",      label: "Due",      sortable: false, filterable: false, linkExternal: false },
    ],
    rows,
    filterAction: { name: "filter-text" },
  };
  if (withinCap && rows.length > 0) {
    table.selection = {
      selectedIds: [],
      buttons: [
        { type: "button", label: "Mark In Progress", action: { name: "bulk-start" },   variant: "secondary" },
        { type: "button", label: "Mark Resolved",    action: { name: "bulk-resolve" }, variant: "primary" },
        { type: "button", label: "Reopen",           action: { name: "bulk-reopen" },  variant: "secondary" },
      ],
    };
  }
  children.push(table as unknown as ViewNode);

  return { type: "page", title: "Help Desk — Agent", children };
}

function agentBuildTicketPage(ticket: Ticket, state: AgentState): ViewNode {
  const info: ViewNode[] = [
    { type: "text", value: `Status: ${statusLabel(ticket.status)}`,      style: "muted" },
    { type: "text", value: `Type: ${typeLabel(ticket.type)}`,            style: "muted" },
    { type: "text", value: `Priority: ${priorityLabel(ticket.priority)}`, style: "muted" },
    { type: "text", value: `Submitted: ${formatDate(ticket.createdAt)}`,  style: "muted" },
  ];

  if (ticket.type === "hardware" && ticket.deviceModel) {
    info.push({ type: "text", value: `Device: ${ticket.deviceModel}`, style: "muted" });
  } else if (ticket.type === "software" && ticket.application) {
    info.push({ type: "text", value: `Application: ${ticket.application}`, style: "muted" });
  } else if (ticket.type === "access") {
    let sys = ticket.systemName ?? "";
    if (ticket.accessLevel) sys += ` (${ticket.accessLevel} access)`;
    if (sys) info.push({ type: "text", value: `System: ${sys}`, style: "muted" });
  }
  if (ticket.dueDate) info.push({ type: "text", value: `Due: ${ticket.dueDate}`, style: "muted" });
  if (ticket.description) info.push({ type: "text", value: ticket.description, style: "body" });

  const actionChildren: ViewNode[] = [];
  switch (ticket.status) {
    case "open":
      actionChildren.push({
        type: "button", label: "Mark In Progress",
        action: { name: "start-ticket", context: { id: String(ticket.id) } },
        variant: "primary",
        pendingLabel: "Marking…",
      });
      break;
    case "in-progress":
      actionChildren.push({
        type: "button", label: "Mark Resolved",
        action: { name: "resolve-ticket", context: { id: String(ticket.id) } },
        variant: "primary",
        pendingLabel: "Resolving…",
      });
      break;
    case "resolved":
      actionChildren.push({
        type: "button", label: "Reopen",
        action: { name: "reopen-ticket", context: { id: String(ticket.id) } },
        variant: "secondary",
        pendingLabel: "Reopening…",
      });
      if (ticket.resolvedAt) {
        actionChildren.push({
          type: "text", value: `Resolved ${formatDate(ticket.resolvedAt)}`, style: "muted",
        });
      }
      break;
  }

  const notesField: ViewNode = {
    type: "field", name: "agent_notes", inputType: "textarea",
    placeholder: "Add notes…", required: false,
  };
  if (ticket.agentNotes != null) (notesField as { value?: string }).value = ticket.agentNotes;
  const notesChildren: ViewNode[] = [notesField];
  if (state.notesSaved) {
    notesChildren.push({ type: "text", value: "Notes saved.", style: "muted" });
  }

  return {
    type: "page",
    title: ticket.title,
    children: [
      { type: "button", label: "← Back to Queue", action: { name: "back-to-queue" } },
      { type: "section", heading: "Ticket Info", children: info },
      {
        type: "section",
        heading: "Agent Notes",
        children: [
          {
            type: "form",
            submitAction: { name: "save-notes", context: { id: String(ticket.id) } },
            submitLabel: "Save Notes",
            children: notesChildren,
          },
        ],
      },
      { type: "section", heading: "Actions", children: actionChildren },
    ],
  };
}

function agentBuildVm(state: AgentState): ViewNode {
  if (state.view === "detail" && state.selectedTicketId != null) {
    const sel = dbGetById(state.selectedTicketId);
    if (sel) return agentBuildTicketPage(sel, state);
  }
  return agentBuildQueuePage(state);
}

const agentHandler = createAction<AgentState>(async (payload) => {
  const ctx = payload.context ?? {};
  const str = (k: string): string | null => (typeof ctx[k] === "string" ? (ctx[k] as string) : null);
  // 0.13.0: bulk-action handlers read the harvested selection from context.
  const strList = (k: string): string[] =>
    Array.isArray(ctx[k]) ? ((ctx[k] as unknown[]).filter((x) => typeof x === "string") as string[]) : [];
  let state: AgentState = { ...payload.state, notesSaved: false };

  switch (payload.name) {
    case "filter":
      state = { ...state, filter: str("value") ?? "all" };
      break;

    // 0.15.1 — free-text title filter from the Title column's Filterable input.
    case "filter-text":
      state = { ...state, titleFilter: str("value") ?? "" };
      break;

    // 0.13.0 — toggle-select action removed (local-mode selection lives in DOM).
    case "bulk-start":
    case "bulk-resolve":
    case "bulk-reopen": {
      const bulkStatus = payload.name === "bulk-start" ? "in-progress"
                       : payload.name === "bulk-resolve" ? "resolved" : "open";
      // selectedIds arrived in context, harvested by the adapter from the bulk
      // button's TableNode.selection.buttons[] click.
      for (const id of strList("selectedIds").map(Number)) dbUpdateStatus(id, bulkStatus);
      break;
    }
    case "select-ticket": {
      const id = str("id");
      const sid = id ? parseInt(id, 10) : NaN;
      if (id && !isNaN(sid)) state = { ...state, selectedTicketId: sid, view: "detail" };
      break;
    }
    case "back-to-queue":
      state = { ...state, view: "queue", selectedTicketId: null };
      break;
    case "start-ticket": {
      const id = str("id");
      const sid = id ? parseInt(id, 10) : NaN;
      if (id && !isNaN(sid)) {
        dbUpdateStatus(sid, "in-progress");
        if (state.view === "detail") state = { ...state, selectedTicketId: sid };
      }
      break;
    }
    case "resolve-ticket": {
      const id = str("id");
      const sid = id ? parseInt(id, 10) : NaN;
      if (id && !isNaN(sid)) dbUpdateStatus(sid, "resolved");
      break;
    }
    case "reopen-ticket": {
      const id = str("id");
      const sid = id ? parseInt(id, 10) : NaN;
      if (id && !isNaN(sid)) dbUpdateStatus(sid, "open");
      break;
    }
    case "save-notes": {
      const id = str("id");
      const notes = str("agent_notes");
      const sid = id ? parseInt(id, 10) : NaN;
      if (id && !isNaN(sid)) {
        dbUpdateAgentNotes(sid, notes);
        state = { ...state, notesSaved: true };
      }
      break;
    }
    default:
      throw new Error(`Unknown action: ${payload.name}`);
  }

  return { vm: agentBuildVm(state), state };
});

// ─── Requester controller ───────────────────────────────────────────────────

function requesterBuildListView(state: RequesterState): ViewNode {
  const counts = dbGetCounts();
  const tickets = dbGetAll(state.filter === "all" ? null : state.filter);

  const items: ViewNode[] = tickets.map<ViewNode>(t => ({
    type: "list-item",
    id: String(t.id),
    variant: ticketVariant(t),
    children: [
      { type: "text", value: t.title, style: "subheading" },
      { type: "text", value: `${typeLabel(t.type)} · ${priorityLabel(t.priority)}`, style: "muted" },
      { type: "text", value: statusLabel(t.status), style: "muted" },
      {
        type: "button", label: "View",
        action: { name: "select-ticket", context: { id: String(t.id) } },
        variant: "secondary",
      },
    ],
  }));

  if (items.length === 0) {
    items.push({ type: "text", value: "No tickets found.", style: "muted" });
  }

  return {
    type: "page",
    title: "Help Desk",
    children: [
      {
        type: "stat-bar",
        stats: [
          { label: "open",        value: String(counts.open) },
          { label: "in progress", value: String(counts.inProgress) },
          { label: "resolved",    value: String(counts.resolved) },
        ],
      },
      {
        type: "tabs",
        selected: state.filter,
        action: { name: "filter" },
        tabs: [
          { value: "all",         label: "All" },
          { value: "open",        label: "Open" },
          { value: "in-progress", label: "In Progress" },
          { value: "resolved",    label: "Resolved" },
        ],
      },
      { type: "list", children: items },
      { type: "button", label: "New Ticket", action: { name: "start-create" }, variant: "primary" },
    ],
  };
}

function requesterBuildCreateView(state: RequesterState): ViewNode {
  const formChildren: ViewNode[] = [];
  if (state.validationError) {
    formChildren.push({ type: "text", value: state.validationError, style: "error" });
  }
  formChildren.push({
    type: "field", name: "title", inputType: "text",
    label: "Title", placeholder: "Brief description of the issue", required: true,
  });
  if (state.createType === "hardware") {
    formChildren.push({
      type: "field", name: "device_model", inputType: "text",
      label: "Device / Model", placeholder: "e.g. Dell XPS 15, iPhone 15", required: false,
    });
  } else if (state.createType === "software") {
    formChildren.push({
      type: "field", name: "application", inputType: "text",
      label: "Application", placeholder: "e.g. Microsoft Excel, Slack", required: false,
    });
  } else if (state.createType === "access") {
    formChildren.push({
      type: "field", name: "system_name", inputType: "text",
      label: "System / Resource", placeholder: "e.g. VPN, GitHub, Salesforce", required: false,
    });
  }
  formChildren.push({
    type: "field", name: "description", inputType: "textarea",
    label: "Description", placeholder: "Provide additional details…", required: false,
  });
  formChildren.push({
    type: "field", name: "due_date", inputType: "date",
    label: "Due By", required: false,
  });

  const baked: Record<string, unknown> = {
    type: state.createType,
    priority: state.createPriority,
  };
  if (state.createType === "access") baked.access_level = state.createAccessLevel;

  const pageChildren: ViewNode[] = [
    {
      type: "tabs",
      selected: state.createType,
      action: { name: "set-type" },
      tabs: [
        { value: "hardware", label: "Hardware" },
        { value: "software", label: "Software" },
        { value: "access",   label: "Access Request" },
      ],
    },
  ];

  if (state.createType === "access") {
    pageChildren.push({
      type: "tabs",
      selected: state.createAccessLevel,
      action: { name: "set-access-level" },
      tabs: [
        { value: "read",  label: "Read" },
        { value: "write", label: "Write" },
        { value: "admin", label: "Admin" },
      ],
    });
  }

  pageChildren.push({
    type: "tabs",
    selected: state.createPriority,
    action: { name: "set-priority" },
    tabs: [
      { value: "low",      label: "Low" },
      { value: "medium",   label: "Medium" },
      { value: "high",     label: "High" },
      { value: "critical", label: "Critical" },
    ],
  });

  pageChildren.push({
    type: "form",
    submitAction: { name: "create-ticket", context: baked },
    submitLabel: "Submit Ticket",
    children: formChildren,
  });

  pageChildren.push({ type: "button", label: "Cancel", action: { name: "cancel-create" } });

  return { type: "page", title: "New Ticket", children: pageChildren };
}

function requesterBuildDetailView(state: RequesterState): ViewNode {
  const ticket = dbGetById(state.selectedTicketId!);
  if (!ticket) {
    return requesterBuildListView({ ...state, view: "list", selectedTicketId: null });
  }

  const info: ViewNode[] = [
    { type: "text", value: `Status: ${statusLabel(ticket.status)}`,     style: "muted" },
    { type: "text", value: `Type: ${typeLabel(ticket.type)}`,           style: "muted" },
    { type: "text", value: `Priority: ${priorityLabel(ticket.priority)}`, style: "muted" },
    { type: "text", value: `Submitted: ${formatDate(ticket.createdAt)}`,   style: "muted" },
  ];

  if (ticket.type === "hardware" && ticket.deviceModel) {
    info.push({ type: "text", value: `Device: ${ticket.deviceModel}`, style: "muted" });
  } else if (ticket.type === "software" && ticket.application) {
    info.push({ type: "text", value: `Application: ${ticket.application}`, style: "muted" });
  } else if (ticket.type === "access") {
    let accessInfo = ticket.systemName ?? "";
    if (ticket.accessLevel) accessInfo += ` (${ticket.accessLevel} access)`;
    if (accessInfo) info.push({ type: "text", value: `System: ${accessInfo}`, style: "muted" });
  }
  if (ticket.dueDate) info.push({ type: "text", value: `Due: ${ticket.dueDate}`, style: "muted" });
  if (ticket.description) info.push({ type: "text", value: ticket.description, style: "body" });
  if (ticket.agentNotes) info.push({ type: "text", value: `Agent notes: ${ticket.agentNotes}`, style: "muted" });

  return {
    type: "page",
    title: ticket.title,
    children: [
      { type: "button", label: "← Back", action: { name: "back-to-list" } },
      { type: "section", heading: "Ticket Details", children: info },
    ],
  };
}

function requesterBuildVm(state: RequesterState): ViewNode {
  switch (state.view) {
    case "create": return requesterBuildCreateView(state);
    case "detail": return requesterBuildDetailView(state);
    default:       return requesterBuildListView(state);
  }
}

const requesterHandler = createAction<RequesterState>(async (payload) => {
  const ctx = payload.context ?? {};
  const str = (k: string): string | null => (typeof ctx[k] === "string" ? (ctx[k] as string) : null);
  let state = payload.state;

  switch (payload.name) {
    case "filter":
      state = { ...state, filter: str("value") ?? "all" };
      break;
    case "select-ticket": {
      const id = str("id");
      const sid = id ? parseInt(id, 10) : NaN;
      if (id && !isNaN(sid)) state = { ...state, selectedTicketId: sid, view: "detail" };
      break;
    }
    case "back-to-list":
      state = { ...state, view: "list", selectedTicketId: null, validationError: null };
      break;
    case "start-create":
      state = {
        ...state,
        view: "create",
        createType: "hardware",
        createPriority: "medium",
        createAccessLevel: "read",
        validationError: null,
      };
      break;
    case "cancel-create":
      state = { ...state, view: "list", validationError: null };
      break;
    case "set-type":
      state = { ...state, createType: str("value") ?? "hardware", validationError: null };
      break;
    case "set-priority":
      state = { ...state, createPriority: str("value") ?? "medium" };
      break;
    case "set-access-level":
      state = { ...state, createAccessLevel: str("value") ?? "read" };
      break;
    case "create-ticket": {
      const title = str("title");
      if (!title || !title.trim()) {
        state = { ...state, validationError: "Title is required." };
        break;
      }
      dbCreate({
        title: title.trim(),
        type: str("type") ?? "hardware",
        priority: str("priority") ?? "medium",
        description: str("description"),
        dueDate: str("due_date"),
        deviceModel: str("device_model"),
        application: str("application"),
        systemName: str("system_name"),
        accessLevel: str("access_level"),
      });
      state = { ...state, validationError: null, view: "list" };
      break;
    }
    default:
      throw new Error(`Unknown action: ${payload.name}`);
  }

  return { vm: requesterBuildVm(state), state };
});

// ─── HTTP server ─────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? "3005");

Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/agent" && request.method === "GET") {
      const state = agentInitial();
      return Response.json({ vm: agentBuildVm(state), state });
    }
    if (url.pathname === "/api/agent/action" && request.method === "POST") {
      return agentHandler(request);
    }
    if (url.pathname === "/api/requester" && request.method === "GET") {
      const state = requesterInitial();
      return Response.json({ vm: requesterBuildVm(state), state });
    }
    if (url.pathname === "/api/requester/action" && request.method === "POST") {
      return requesterHandler(request);
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`HelpDesk Bun backend listening on http://localhost:${port}`);
