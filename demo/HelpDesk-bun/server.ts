// HelpDesk demo — TypeScript backend mirror of demo/HelpDesk/AspNetCore/.
// Two controllers (Agent + Requester) sharing a SQLite DB. Faithful port of
// the wire format, action semantics, label formatting, and SQL schema.
//
// Phase 6 wire-shape migration (0.17.0 / WIRE-07):
//
//   - State holds slots for every input value the renderer used to harvest
//     into a context payload: agentNotes textarea, the create-ticket form
//     fields (title / description / dueDate / deviceModel / application /
//     systemName), and per-row selection.
//   - selectedIds is a Record<string, true> keyed by ticket id; per-row
//     CheckboxNodes bind to `selectedIds.${id}` so the renderer writes
//     true/false directly to that slot on toggle. Bulk action handlers read
//     the keys of selectedIds whose values are truthy.
//   - Filter tabs / set-type tabs / etc. all carry unique action names
//     (filter-all, set-type-hardware, …). TabsNode.bind writes the value
//     to state so the server can render the next view from state alone.
//   - Per-row View button uses select-ticket-${id}; per-ticket-page action
//     buttons stay singular (start-ticket / resolve-ticket / reopen-ticket /
//     save-notes) — only one ticket is on the detail page at a time.

import {
  BadRequestError,
  UnknownActionError,
  createAction,
  createAgentSkillHandler,
  shellRejection,
  validateActionNames,
  type ErrorEntry,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";
import { Database } from "bun:sqlite";

// 3.8.0 — version-skew: this server's current-deployed client-build id. Passed to
// createAction (stamps serverBuild + fail-closed guard on the X-VMS-Client-Build
// header) and stamped manually onto GET responses. Kept byte-equal to the .NET
// twin's HelpDeskBuild.Id so the parity gate diffs identical serverBuild values.
const CURRENT_BUILD = "helpdesk-build-1";

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
  // pagination. titleFilter is the free-text Title column input.
  titleFilter: string;
  // Phase 6 — bind slots:
  //   selectedIds: keyed by ticket id, value true = selected (per-row
  //   CheckboxNode binds to `selectedIds.${id}`).
  //   agentNotes: bound by the textarea in the ticket page's notes form.
  selectedIds: Record<string, boolean>;
  agentNotes: string;
}
function agentInitial(): AgentState {
  return {
    view: "queue",
    selectedTicketId: null,
    filter: "all",
    notesSaved: false,
    titleFilter: "",
    selectedIds: {},
    agentNotes: "",
  };
}

interface RequesterState {
  view: string;
  selectedTicketId: number | null;
  filter: string;
  createType: string;
  createPriority: string;
  createAccessLevel: string;
  validationError: string | null;
  // Phase 6 — bind slots for the create-ticket form fields.
  draftTitle: string;
  draftDescription: string;
  draftDueDate: string;
  draftDeviceModel: string;
  draftApplication: string;
  draftSystemName: string;
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
    draftTitle: "",
    draftDescription: "",
    draftDueDate: "",
    draftDeviceModel: "",
    draftApplication: "",
    draftSystemName: "",
  };
}

// ─── SQLite ──────────────────────────────────────────────────────────────────

const dbPath = process.env.HELPDESK_DB ?? "./helpdesk.db";
const db = new Database(dbPath);
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

function dbCount(status: string | null): number {
  const row = status
    ? db.query<{ n: number }, [string]>("SELECT COUNT(*) AS n FROM tickets WHERE status = ?").get(status)
    : db.query<{ n: number }, []>("SELECT COUNT(*) AS n FROM tickets").get();
  return row?.n ?? 0;
}

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

// Status splits across the two orthogonal axes: `state` (lifecycle: done/high)
// and `tone` (severity: critical → danger).
const ticketStatus = (t: Ticket): { state?: string; tone?: "danger" | "warning" | "success" | "info" } =>
  t.status === "resolved" ? { state: "done" } :
  t.priority === "critical" ? { tone: "danger" } :
  t.priority === "high"     ? { state: "high" } : {};

function formatDate(iso: string): string {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Agent controller ───────────────────────────────────────────────────────

const AGENT_CAP = 25;

function agentBuildQueuePage(state: AgentState): ViewNode {
  const counts = dbGetCounts();
  const status = state.filter === "all" ? null : state.filter;
  const matching = dbCountMatching(status, state.titleFilter);
  const withinCap = matching <= AGENT_CAP;
  const tickets = withinCap ? dbGetMatching(status, state.titleFilter, AGENT_CAP) : [];

  const rows = tickets.map(t => {
    const status = ticketStatus(t);
    const rowActions: ViewNode[] = [
      // Per-row selection checkbox bound to `selectedIds.${id}` (renderer
      // writes true/false directly to that slot on click; no dispatch needed).
      // Clicking the checkbox stops propagation so it doesn't also fire the
      // click-anywhere row.action below.
      {
        type: "checkbox",
        name: `select-${t.id}`,
        bind: `selectedIds.${t.id}`,
      },
    ];
    const row: {
      cells: Record<string, string>;
      id?: string;
      actions?: ViewNode[];
      state?: string;
      tone?: "danger" | "warning" | "success" | "info";
      action?: { name: string };
    } = {
      cells: {
        title:    t.title,
        type:     typeLabel(t.type),
        priority: priorityLabel(t.priority),
        status:   statusLabel(t.status),
        due:      !t.dueDate ? "—" : t.dueDate,
      },
      id: String(t.id),
      actions: rowActions,
      // Click-anywhere row navigation — same target as the old "Open" button,
      // just on the whole row (keyboard + ARIA emitted by the renderer).
      action: { name: `select-ticket-${t.id}` },
    };
    if (status.state) row.state = status.state;
    if (status.tone) row.tone = status.tone;
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
      bind: "filter",
      tabs: [
        { value: "all",         label: "All",         action: { name: "filter-all" } },
        { value: "open",        label: "Open",        action: { name: "filter-open" } },
        { value: "in-progress", label: "In Progress", action: { name: "filter-in-progress" } },
        { value: "resolved",    label: "Resolved",    action: { name: "filter-resolved" } },
      ],
    },
  ];

  // Bulk action toolbar — visible when there are matches within the cap.
  // 1.13.0 — laid out with layout:"switcher": three equal-weight actions that
  // flip all-row ↔ all-stack ATOMICALLY at a content-width threshold (never
  // passing through an awkward 2-up intermediate the way `cards` auto-fit
  // would). `limit: 3` caps the row at the three buttons, and `threshold: "md"`
  // (30rem) sets the flip width. This is the canonical equal-action-toolbar
  // exemplar — no app CSS, no @media.
  if (withinCap && rows.length > 0) {
    children.push({
      type: "section",
      layout: "switcher",
      threshold: "md",
      limit: 3,
      children: [
        { type: "button", label: "Mark In Progress", action: { name: "bulk-start" },   emphasis: "secondary" },
        { type: "button", label: "Mark Resolved",    action: { name: "bulk-resolve" }, emphasis: "primary" },
        { type: "button", label: "Reopen",           action: { name: "bulk-reopen" },  emphasis: "secondary" },
      ],
    });
  }

  const dbEmpty = counts.open + counts.inProgress + counts.resolved === 0;

  // Over-cap notice rendered above the table so the filter input stays accessible.
  if (!withinCap) {
    children.push({
      type: "text",
      value: `${matching} tickets match — refine the filter (max ${AGENT_CAP} shown).`,
      tone: "warning",
    });
  } else if (rows.length === 0 && !dbEmpty) {
    // Filter narrowed to zero matches against a non-empty DB. The table still
    // renders below so the title filter input + status tabs stay accessible —
    // without this message the empty body is ambiguous with "broken render".
    children.push({ type: "text", value: "No tickets match your filter.", style: "muted" });
  }

  // Empty-state fallback for an empty queue (only when the DB itself is
  // empty — the "filter matches nothing" case is handled above).
  if (withinCap && rows.length === 0 && dbEmpty) {
    children.push({ type: "text", value: "No tickets in queue.", style: "muted" });
  } else {
    const titleCol: Record<string, unknown> = {
      key: "title", label: "Title", filterable: true,
    };
    if (state.titleFilter.length > 0) titleCol.filterValue = state.titleFilter;

    const table: Record<string, unknown> = {
      type: "table",
      columns: [
        titleCol,
        { key: "type",     label: "Type" },
        { key: "priority", label: "Priority" },
        { key: "status",   label: "Status" },
        { key: "due",      label: "Due" },
      ],
      rows,
      filterBinds: { title: "titleFilter" },
      filterAction: { name: "filter-text" },
    };
    children.push(table as unknown as ViewNode);
  }

  return { type: "page", title: "Help Desk — Agent", children };
}

function agentBuildTicketPage(ticket: Ticket, state: AgentState): ViewNode {
  const info: ViewNode[] = [
    { type: "text", value: `Status: ${statusLabel(ticket.status)}`,       style: "muted" },
    { type: "text", value: `Type: ${typeLabel(ticket.type)}`,             style: "muted" },
    { type: "text", value: `Priority: ${priorityLabel(ticket.priority)}`,  style: "muted" },
    { type: "text", value: `Submitted: ${formatDate(ticket.createdAt)}`,    style: "muted" },
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
        action: { name: "start-ticket" },
        emphasis: "primary",
        pendingLabel: "Marking…",
      });
      break;
    case "in-progress":
      actionChildren.push({
        type: "button", label: "Mark Resolved",
        action: { name: "resolve-ticket" },
        emphasis: "primary",
        pendingLabel: "Resolving…",
      });
      break;
    case "resolved":
      actionChildren.push({
        type: "button", label: "Reopen",
        action: { name: "reopen-ticket" },
        emphasis: "secondary",
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
    bind: "agentNotes",
    placeholder: "Add notes…",
  };
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
        collapsible: true,
        children: [
          {
            type: "form",
            submitAction: { name: "save-notes" },
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
  let state: AgentState = { ...payload.state, notesSaved: false };
  const name = payload.name;

  if (name.startsWith("filter-") && name !== "filter-text") {
    // filter is already in state via the TabsNode bind; no action needed.
  } else if (name === "filter-text") {
    // titleFilter is already in state via the column filterBind.
  } else if (name === "bulk-start" || name === "bulk-resolve" || name === "bulk-reopen") {
    const bulkStatus = name === "bulk-start" ? "in-progress"
                     : name === "bulk-resolve" ? "resolved" : "open";
    // Read selected ticket IDs from state.selectedIds (set true via per-row
    // checkbox binds). The bind path was `selectedIds.${id}`.
    const ids = Object.entries(state.selectedIds ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => Number(k))
      .filter(n => !isNaN(n));
    for (const id of ids) dbUpdateStatus(id, bulkStatus);
    // Clear selection after the bulk action.
    state = { ...state, selectedIds: {} };
  } else if (name.startsWith("select-ticket-")) {
    const sid = Number(name.slice("select-ticket-".length));
    if (!isNaN(sid)) {
      const ticket = dbGetById(sid);
      // Seed agentNotes from the DB so the textarea renders the existing notes.
      state = {
        ...state,
        selectedTicketId: sid,
        view: "detail",
        agentNotes: ticket?.agentNotes ?? "",
      };
    }
  } else if (name === "back-to-queue") {
    state = { ...state, view: "queue", selectedTicketId: null, agentNotes: "" };
  } else if (name === "start-ticket") {
    if (state.selectedTicketId != null) dbUpdateStatus(state.selectedTicketId, "in-progress");
  } else if (name === "resolve-ticket") {
    if (state.selectedTicketId != null) dbUpdateStatus(state.selectedTicketId, "resolved");
  } else if (name === "reopen-ticket") {
    if (state.selectedTicketId != null) dbUpdateStatus(state.selectedTicketId, "open");
  } else if (name === "save-notes") {
    if (state.selectedTicketId != null) {
      dbUpdateAgentNotes(state.selectedTicketId, state.agentNotes);
      state = { ...state, notesSaved: true };
    }
  } else {
    throw new UnknownActionError(name);
  }

  return { vm: agentBuildVm(state), state };
}, { currentBuild: CURRENT_BUILD });

// ─── Requester controller ───────────────────────────────────────────────────

function requesterBuildListView(state: RequesterState): ViewNode {
  const counts = dbGetCounts();
  const tickets = dbGetAll(state.filter === "all" ? null : state.filter);

  const items: ViewNode[] = tickets.map<ViewNode>(t => ({
    type: "list-item",
    id: String(t.id),
    ...ticketStatus(t),
    children: [
      { type: "text", value: t.title, style: "subheading" },
      { type: "text", value: `${typeLabel(t.type)} · ${priorityLabel(t.priority)}`, style: "muted" },
      { type: "text", value: statusLabel(t.status), style: "muted" },
      {
        type: "button", label: "View",
        action: { name: `select-ticket-${t.id}` },
        emphasis: "secondary",
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
        bind: "filter",
        tabs: [
          { value: "all",         label: "All",         action: { name: "filter-all" } },
          { value: "open",        label: "Open",        action: { name: "filter-open" } },
          { value: "in-progress", label: "In Progress", action: { name: "filter-in-progress" } },
          { value: "resolved",    label: "Resolved",    action: { name: "filter-resolved" } },
        ],
      },
      { type: "list", children: items },
      { type: "button", label: "New Ticket", action: { name: "start-create" }, emphasis: "primary" },
    ],
  };
}

function requesterBuildCreateView(state: RequesterState): ViewNode {
  const formChildren: ViewNode[] = [];
  if (state.validationError) {
    formChildren.push({ type: "text", value: state.validationError, tone: "danger" });
  }
  formChildren.push({
    type: "field", name: "title", inputType: "text",
    bind: "draftTitle",
    label: "Title", placeholder: "Brief description of the issue", required: true,
  });
  if (state.createType === "hardware") {
    formChildren.push({
      type: "field", name: "device_model", inputType: "text",
      bind: "draftDeviceModel",
      label: "Device / Model", placeholder: "e.g. Dell XPS 15, iPhone 15",
    });
  } else if (state.createType === "software") {
    formChildren.push({
      type: "field", name: "application", inputType: "text",
      bind: "draftApplication",
      label: "Application", placeholder: "e.g. Microsoft Excel, Slack",
    });
  } else if (state.createType === "access") {
    formChildren.push({
      type: "field", name: "system_name", inputType: "text",
      bind: "draftSystemName",
      label: "System / Resource", placeholder: "e.g. VPN, GitHub, Salesforce",
    });
  }
  formChildren.push({
    type: "field", name: "description", inputType: "textarea",
    bind: "draftDescription",
    label: "Description", placeholder: "Provide additional details…",
  });
  formChildren.push({
    type: "field", name: "due_date", inputType: "date",
    bind: "draftDueDate",
    label: "Due By",
  });

  const pageChildren: ViewNode[] = [
    {
      type: "tabs",
      selected: state.createType,
      bind: "createType",
      tabs: [
        { value: "hardware", label: "Hardware",       action: { name: "set-type-hardware" } },
        { value: "software", label: "Software",       action: { name: "set-type-software" } },
        { value: "access",   label: "Access Request", action: { name: "set-type-access" } },
      ],
    },
  ];

  if (state.createType === "access") {
    pageChildren.push({
      type: "tabs",
      selected: state.createAccessLevel,
      bind: "createAccessLevel",
      tabs: [
        { value: "read",  label: "Read",  action: { name: "set-access-level-read" } },
        { value: "write", label: "Write", action: { name: "set-access-level-write" } },
        { value: "admin", label: "Admin", action: { name: "set-access-level-admin" } },
      ],
    });
  }

  pageChildren.push({
    type: "tabs",
    selected: state.createPriority,
    bind: "createPriority",
    tabs: [
      { value: "low",      label: "Low",      action: { name: "set-priority-low" } },
      { value: "medium",   label: "Medium",   action: { name: "set-priority-medium" } },
      { value: "high",     label: "High",     action: { name: "set-priority-high" } },
      { value: "critical", label: "Critical", action: { name: "set-priority-critical" } },
    ],
  });

  pageChildren.push({
    type: "form",
    submitAction: { name: "create-ticket" },
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
  let state = payload.state;
  const name = payload.name;

  // Soft-validation rejection (rides on the ok:true re-render). Set by the
  // create-ticket guard; surfaced to wire-driving agents via shellRejection()
  // at the return. The human path still sees the validationError TextNode —
  // the two coexist by design.
  let violations: ErrorEntry[] | null = null;

  if (name.startsWith("filter-")) {
    // filter is already in state via the TabsNode bind.
  } else if (name.startsWith("select-ticket-")) {
    const sid = Number(name.slice("select-ticket-".length));
    if (!isNaN(sid)) state = { ...state, selectedTicketId: sid, view: "detail" };
  } else if (name === "back-to-list") {
    state = { ...state, view: "list", selectedTicketId: null, validationError: null };
  } else if (name === "start-create") {
    state = {
      ...state,
      view: "create",
      createType: "hardware",
      createPriority: "medium",
      createAccessLevel: "read",
      validationError: null,
      draftTitle: "",
      draftDescription: "",
      draftDueDate: "",
      draftDeviceModel: "",
      draftApplication: "",
      draftSystemName: "",
    };
  } else if (name === "cancel-create") {
    state = { ...state, view: "list", validationError: null };
  } else if (name.startsWith("set-type-")) {
    // createType is already in state via the TabsNode bind. Clear any stale
    // validation error so the form revalidates on next submit.
    state = { ...state, validationError: null };
  } else if (name.startsWith("set-priority-")) {
    // createPriority is already in state via the TabsNode bind.
  } else if (name.startsWith("set-access-level-")) {
    // createAccessLevel is already in state via the TabsNode bind.
  } else if (name === "create-ticket") {
    const title = (state.draftTitle ?? "").trim();
    if (!title) {
      state = { ...state, validationError: "Title is required." };
      violations = [{ path: "draftTitle", message: "Title is required." }];
    } else {
      dbCreate({
        title,
        type: state.createType,
        priority: state.createPriority,
        description: (state.draftDescription ?? "") || null,
        dueDate: (state.draftDueDate ?? "") || null,
        deviceModel: state.createType === "hardware" ? ((state.draftDeviceModel ?? "") || null) : null,
        application: state.createType === "software" ? ((state.draftApplication ?? "") || null) : null,
        systemName:  state.createType === "access"   ? ((state.draftSystemName  ?? "") || null) : null,
        accessLevel: state.createType === "access"   ? state.createAccessLevel : null,
      });
      state = { ...state, validationError: null, view: "list" };
    }
  } else {
    throw new UnknownActionError(name);
  }

  return { vm: requesterBuildVm(state), state, ...(violations ? shellRejection(violations) : {}) };
}, { currentBuild: CURRENT_BUILD });

// ─── HTTP server ─────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? "3005");

// Canonical agent skill (1.6.0): serves a markdown operating manual for the VMS wire
// protocol at /.well-known/vms-skill.md with a HelpDesk-specific preamble prepended.
// Preamble text is byte-equal to the .NET twin's mount in demo/HelpDesk/AspNetCore/Program.cs
// so the parity gate (parity/check-skill.ts) diffs identical bodies across both backends.
const skillHandler = createAgentSkillHandler({
  appPreamble: "This is a help-desk ticketing app. Two roles share one SQLite DB: requesters create tickets at `/api/requester`; agents act on them at `/api/agent`. State holds the current view (queue / detail), the active filter, and per-row selection — see each controller's bind paths in the rendered tree.",
});

Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/agent" && request.method === "GET") {
      const state = agentInitial();
      const vm = agentBuildVm(state);
      validateActionNames(vm);
      // 3.8.0 — stamp serverBuild on the GET too (the .NET twin's result filter
      // stamps every ShellResponse incl. GET; match it for parity).
      return Response.json({ ok: true, vm, state, serverBuild: CURRENT_BUILD });
    }
    if (url.pathname === "/api/agent/action" && request.method === "POST") {
      return agentHandler(request);
    }
    if (url.pathname === "/api/requester" && request.method === "GET") {
      const state = requesterInitial();
      const vm = requesterBuildVm(state);
      validateActionNames(vm);
      // 3.8.0 — stamp serverBuild on the GET too (parity with the .NET twin's
      // result filter, which stamps every ShellResponse incl. GET).
      return Response.json({ ok: true, vm, state, serverBuild: CURRENT_BUILD });
    }
    if (url.pathname === "/api/requester/action" && request.method === "POST") {
      return requesterHandler(request);
    }
    if (url.pathname === "/.well-known/vms-skill.md" && request.method === "GET") {
      return skillHandler(request);
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`HelpDesk Bun backend listening on http://localhost:${port}`);
