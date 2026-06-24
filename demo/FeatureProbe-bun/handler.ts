// FeatureProbe — runtime-neutral request handler.
// Imported by server.ts (Bun) and server-node.ts (Node 22+) to prove the
// same TypeScript code runs unchanged on multiple Web Fetch runtimes.
//
// Phase 6 wire-shape migration (0.17.0 / WIRE-07): every input on the wire
// declares a `bind` path; per-tab/per-row identity moves into action names
// (no more `context: {column: "name", direction: "asc"}` payloads). For the
// parity fixtures that programmatically dispatch trigger-redirect /
// set-storage / trigger-download / table-page / etc., the parameters now
// live in dedicated state slots (redirectTo, localValue, downloadUrl, …)
// — parity sets them via state before dispatching.

import {
  BadRequestError,
  UnknownActionError,
  createAction,
  shellRedirect,
  shellSideEffect,
  validateActionNames,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

interface SortIntent {
  column: string | null;
  direction: string | null;
}

interface FeatureProbeState {
  pollCount: number;
  lastUploadName: string | null;
  lastUploadSize: number;
  lastSubmit?: string | null;
  // Table feature-matrix state — bind targets for sort/filter/pagination.
  sortIntent: SortIntent;
  tableFilters: { name: string };
  tablePage: number;
  longActionPolls: number;
  // Phase 6 bind slots:
  //   note: bound by the multi-action form's "Note" FieldNode.
  note: string;
  //   Parameters previously read from context by parity-driven actions.
  redirectTo: string;
  localValue: string;
  sessionValue: string;
  downloadUrl: string;
  downloadFilename: string;
  // 1.4.0 — SectionNode.action click-anywhere card exercised by the parity
  // fixture: select-card increments this counter, BuildVm renders a clickable
  // SectionNode that dispatches "select-card".
  cardClickCount: number;
}

function initialState(): FeatureProbeState {
  return {
    pollCount: 0,
    lastUploadName: null,
    lastUploadSize: 0,
    sortIntent: { column: null, direction: null },
    tableFilters: { name: "" },
    tablePage: 1,
    longActionPolls: 0,
    note: "",
    redirectTo: "",
    localValue: "",
    sessionValue: "",
    downloadUrl: "",
    downloadFilename: "",
    cardClickCount: 0,
  };
}

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

function tableWindow(s: FeatureProbeState): { page: TableItem[]; total: number; clampedPage: number } {
  let rows = ITEMS.slice();
  if (s.tableFilters.name) {
    const f = s.tableFilters.name.toLowerCase();
    rows = rows.filter((i) => i.name.toLowerCase().includes(f));
  }
  if (s.sortIntent.column) {
    const col = s.sortIntent.column;
    const dir = s.sortIntent.direction === "desc" ? -1 : 1;
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
  const nameCol: Record<string, unknown> = {
    key: "name", label: "Name", sortable: true, filterable: true, linkExternal: false,
  };
  if (state.tableFilters.name.length > 0) nameCol.filterValue = state.tableFilters.name;

  const table: Record<string, unknown> = {
    type: "table",
    columns: [
      nameCol,
      { key: "status", label: "Status", sortable: true, filterable: false, linkExternal: false },
    ],
    rows: page.map((i) => ({ cells: { name: i.name, status: i.status }, id: i.id })),
    sortBind: "sortIntent",
    filterBinds: { name: "tableFilters.name" },
    paginationBind: "tablePage",
    sortActions: {
      name:   { name: "table-sort-name" },
      status: { name: "table-sort-status" },
    },
    filterAction: { name: "table-filter" },
    pagination: {
      page: clampedPage,
      pageSize: PAGE_SIZE,
      totalRows: total,
      prevAction: { name: "table-page-prev" },
      nextAction: { name: "table-page-next" },
    },
  };
  return {
    type: "section",
    heading: "Table matrix",
    variant: "card",
    children: [table as unknown as ViewNode],
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
    { type: "copy-button", text: "npx @ashley-shrok/viewmodel-shell", label: "Copy install command", copiedLabel: "Copied!", variant: "secondary" } as ViewNode,
  );
  children.push({ type: "image", src: "/logo.png", alt: "ViewModel Shell logo", size: "small", shape: "circle" } as ViewNode);
  if (state.lastSubmit != null) {
    children.push({ type: "text", value: `Last submit: ${state.lastSubmit}`, style: "muted" });
  }
  children.push({ type: "button", label: "Start long action",
    action: { name: "start-long-action" }, variant: "primary" });
  if (state.longActionPolls > 0) {
    children.push({
      type: "text",
      value: `Long action in progress · ${state.longActionPolls} tick${state.longActionPolls === 1 ? "" : "s"} remaining`,
      style: "muted",
    });
  }
  // Multi-action form: shared "note" field bound to state.note; two buttons,
  // each dispatching a unique-named action (save-draft / publish).
  children.push({
    type: "form",
    children: [{ type: "field", name: "note", inputType: "text", bind: "note", label: "Note", placeholder: "Type a note…", required: false }],
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
  // 1.4.0 — clickable SectionNode (parity coverage for SectionNode.action).
  const clickableCardSection: ViewNode = {
    type: "section",
    heading: "Clickable Card",
    variant: "card",
    action: { name: "select-card" },
    children: [
      { type: "text", value: `Clicked ${state.cardClickCount} time${state.cardClickCount === 1 ? "" : "s"}`, style: "muted" },
    ],
  };
  // 1.5.0 — linked SectionNode (parity coverage for SectionNode.link, issue #21).
  // Pure client-side navigation — no state change, no dispatch arm; the wire
  // shape itself is the parity gate.
  const linkedCardSection: ViewNode = {
    type: "section",
    heading: "Linked card",
    variant: "card",
    link: { url: "https://example.com/probe", external: true },
    children: [
      { type: "text", value: "Renders as <a href> for native link affordances.", style: "muted" },
    ],
  };
  // 1.11.0 — row layout (parity coverage for layout:"row"). A left-aligned
  // wrapping row of links — the horizontal-row primitive a navbar composes from.
  // external:false is explicit to match the .NET LinkNode non-nullable default.
  const rowSection: ViewNode = {
    type: "section",
    heading: "Row layout",
    variant: "card",
    layout: "row",
    children: [
      { type: "link", label: "Home", href: "/home", external: false },
      { type: "link", label: "Docs", href: "/docs", external: false },
      { type: "link", label: "About", href: "/about", external: false },
    ],
  };
  // 1.11.0 — flyout overlay disclosure (parity coverage for SectionNode.flyout).
  // heading=trigger, children=panel; the wire shape itself is the parity gate.
  const flyoutSection: ViewNode = {
    type: "section",
    heading: "Menu",
    flyout: true,
    children: [
      { type: "link", label: "Settings", href: "/settings", external: false },
      { type: "link", label: "Profile", href: "/profile", external: false },
    ],
  };
  // 1.12.0 — arrange/align alignment vocabulary (parity coverage for ALIGN-01/02/03).
  // Static view-shape captured by every GET step (mirrors the 1.11.0 row precedent;
  // no dedicated action arm). external:false explicit on every LinkNode to match the
  // .NET non-nullable default. The .NET twins must serialize byte-identically.
  //
  // (a) bare row — NEITHER arrange nor align => proves omitted = no class on the wire.
  const bareRowSection: ViewNode = {
    type: "section",
    heading: "Bare row",
    layout: "row",
    children: [
      { type: "link", label: "One", href: "/one", external: false },
      { type: "link", label: "Two", href: "/two", external: false },
    ],
  };
  // (b) canonical header-bar (ALIGN-04): row + arrange:"space-between", first child a
  // heading TextNode, then a nested row section of nav links — title-left / nav-right.
  const headerBarSection: ViewNode = {
    type: "section",
    layout: "row",
    arrange: "space-between",
    children: [
      { type: "text", value: "Header", style: "heading" },
      {
        type: "section",
        layout: "row",
        children: [
          { type: "link", label: "Home", href: "/home", external: false },
          { type: "link", label: "Docs", href: "/docs", external: false },
        ],
      },
    ],
  };
  // (c) one row per remaining arrange value (space-between is covered by the header bar).
  const arrangeValues = ["start", "center", "end", "space-around", "space-evenly"] as const;
  const arrangeSections: ViewNode[] = arrangeValues.map((v) => ({
    type: "section",
    heading: `arrange ${v}`,
    layout: "row",
    arrange: v,
    children: [
      { type: "link", label: "A", href: "/a", external: false },
      { type: "link", label: "B", href: "/b", external: false },
    ],
  }));
  // (d) one row per align value.
  const alignValues = ["start", "center", "end", "stretch", "baseline"] as const;
  const alignSections: ViewNode[] = alignValues.map((v) => ({
    type: "section",
    heading: `align ${v}`,
    layout: "row",
    align: v,
    children: [
      { type: "link", label: "A", href: "/a", external: false },
      { type: "link", label: "B", href: "/b", external: false },
    ],
  }));
  // 1.13.0 — switcher vocabulary (parity coverage for SWITCH-01/02/03). Static
  // view-shape captured by every GET step (mirrors the 1.12.0 arrange/align
  // precedent; no dedicated action arm). external:false explicit on every
  // LinkNode to match the .NET non-nullable default. The .NET twins must
  // serialize byte-identically — omitted threshold/limit ABSENT on the wire,
  // set ones present.
  //
  // (a) bare switcher — NEITHER threshold nor limit => proves omitted = no class.
  const bareSwitcherSection: ViewNode = {
    type: "section",
    heading: "Bare switcher",
    layout: "switcher",
    children: [
      { type: "link", label: "One", href: "/one", external: false },
      { type: "link", label: "Two", href: "/two", external: false },
      { type: "link", label: "Three", href: "/three", external: false },
    ],
  };
  // (b) one switcher per threshold value (sm/md/lg/xl).
  const thresholdValues = ["sm", "md", "lg", "xl"] as const;
  const switcherThresholdSections: ViewNode[] = thresholdValues.map((v) => ({
    type: "section",
    heading: `switcher ${v}`,
    layout: "switcher",
    threshold: v,
    children: [
      { type: "link", label: "A", href: "/a", external: false },
      { type: "link", label: "B", href: "/b", external: false },
      { type: "link", label: "C", href: "/c", external: false },
    ],
  }));
  // (c) one switcher with limit:4 and >4 children (6) — exercises the count cap.
  const switcherLimitSection: ViewNode = {
    type: "section",
    heading: "switcher limit",
    layout: "switcher",
    limit: 4,
    children: [
      { type: "link", label: "1", href: "/1", external: false },
      { type: "link", label: "2", href: "/2", external: false },
      { type: "link", label: "3", href: "/3", external: false },
      { type: "link", label: "4", href: "/4", external: false },
      { type: "link", label: "5", href: "/5", external: false },
      { type: "link", label: "6", href: "/6", external: false },
    ],
  };

  // 1.13.0 — cards minItem vocabulary (parity coverage for GRID-01/02). Static
  // view-shape captured by every GET step (same precedent; no dedicated action
  // arm). The .NET twins must serialize byte-identically — omitted minItem
  // ABSENT on the wire, set ones present. NOTE: the page root is already
  // layout:"cards", but a dedicated SECTION-level bare-cards section proves
  // omitted = absent at the section level too.
  //
  // (a) bare cards section — NO minItem => proves omitted = no class.
  const bareCardsSection: ViewNode = {
    type: "section",
    heading: "Bare cards",
    layout: "cards",
    children: [
      { type: "link", label: "One", href: "/c1", external: false },
      { type: "link", label: "Two", href: "/c2", external: false },
      { type: "link", label: "Three", href: "/c3", external: false },
    ],
  };
  // (b) one cards section per minItem value (xs/sm/md/lg/xl).
  const minItemValues = ["xs", "sm", "md", "lg", "xl"] as const;
  const cardsMinItemSections: ViewNode[] = minItemValues.map((v) => ({
    type: "section",
    heading: `cards minItem ${v}`,
    layout: "cards",
    minItem: v,
    children: [
      { type: "link", label: "P", href: "/p", external: false },
      { type: "link", label: "Q", href: "/q", external: false },
      { type: "link", label: "R", href: "/r", external: false },
      { type: "link", label: "S", href: "/s", external: false },
    ],
  }));
  return {
    type: "page",
    title: "Feature Probe",
    density: "compact",
    layout: "cards",
    children: [
      probeSection, clickableCardSection, linkedCardSection, rowSection, flyoutSection,
      bareRowSection, headerBarSection, ...arrangeSections, ...alignSections,
      bareSwitcherSection, ...switcherThresholdSections, switcherLimitSection,
      bareCardsSection, ...cardsMinItemSections,
      buildTableSection(state),
    ],
  };
}

const actionHandler = createAction<FeatureProbeState>(async (payload) => {
  let state = payload.state;
  const name = payload.name;

  if (name === "trigger-redirect") {
    return shellRedirect<FeatureProbeState>(state.redirectTo || "/default-redirect");
  }

  if (name === "set-storage") {
    return {
      vm: buildVm(state),
      state,
      sideEffects: [
        shellSideEffect.setLocalStorage("probe-local",   state.localValue   || "default-local"),
        shellSideEffect.setSessionStorage("probe-session", state.sessionValue || "default-session"),
      ],
    };
  }

  if (name === "trigger-download") {
    return {
      vm: buildVm(state),
      state,
      sideEffects: [
        shellSideEffect.download(
          state.downloadUrl      || "/api/probe/file/hello.txt",
          state.downloadFilename || "hello.txt",
        ),
      ],
    };
  }

  if (name === "do-poll") {
    state = { ...state, pollCount: state.pollCount + 1 };
    const done = state.pollCount >= 3;
    return {
      vm: buildVm(state),
      state,
      ...(done ? {} : { nextPollIn: 100 }),
    };
  }

  if (name === "upload") {
    const file = payload.files["attachment"];
    if (file) {
      state = { ...state, lastUploadName: file.name, lastUploadSize: file.size };
    }
  } else if (name === "show-copy-button") {
    // state unchanged.
  } else if (name === "save-draft") {
    state = { ...state, lastSubmit: `draft: ${state.note ?? ""}` };
  } else if (name === "publish") {
    state = { ...state, lastSubmit: `published: ${state.note ?? ""}` };
  } else if (name === "reset") {
    state = initialState();
  } else if (name === "start-long-action") {
    state = { ...state, longActionPolls: 3 };
    return { vm: buildVm(state), state, preventUnload: true, busy: true, nextPollIn: 100 };
  } else if (name === "long-action-poll") {
    const remaining = Math.max(0, state.longActionPolls - 1);
    state = { ...state, longActionPolls: remaining };
    const workDone = remaining === 0;
    return {
      vm: buildVm(state),
      state,
      ...(workDone ? {} : { preventUnload: true, busy: true, nextPollIn: 100 }),
    };
  } else if (name === "table-sort-name" || name === "table-sort-status") {
    // sortIntent has been written to state by the renderer; reset to page 1.
    state = { ...state, tablePage: 1 };
  } else if (name === "table-filter") {
    // tableFilters.name has been written to state by the renderer; reset page.
    state = { ...state, tablePage: 1 };
  } else if (name === "table-page-prev") {
    // The renderer writes the target page to tablePage before dispatch.
    // (Server just re-renders the slice for the new page.)
  } else if (name === "table-page-next") {
    // Same as prev.
  } else if (name === "select-card") {
    // 1.4.0 — SectionNode.action click. Increment counter; BuildVm reflects it.
    state = { ...state, cardClickCount: state.cardClickCount + 1 };
  } else if (name === "boom") {
    // Deliberate uncaught throw — exercises the generic-Error path through
    // createAction's catch arm. Used by the Plan 04 parity fixture to verify
    // that ALL backends return byte-identical {ok:false, errors:[{message:
    // "deliberate test failure", code:"uncaught_exception"}]} envelopes.
    // Dev/parity use only; this demo is never deployed to production (T-07-09).
    throw new Error("deliberate test failure");
  } else {
    throw new UnknownActionError(name);
  }

  return { vm: buildVm(state), state };
});

export async function fetchHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/api/probe" && request.method === "GET") {
    const state = initialState();
    const vm = buildVm(state);
    validateActionNames(vm);
    return Response.json({ ok: true, vm, state });
  }
  if (url.pathname === "/api/probe/action" && request.method === "POST") {
    return actionHandler(request);
  }
  return new Response("Not Found", { status: 404 });
}
