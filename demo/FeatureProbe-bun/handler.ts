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
  type TableColumn,
  type TableNode,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

interface SortIntent {
  column?: string;
  direction?: string;
}

interface FeatureProbeState {
  pollCount: number;
  lastUploadName?: string;
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
  // 5.2.0 (LOOK-06) — lookup bind slots. `lookup` binds ONE id (a string);
  // `lookup-multiple` binds a string[] of ids. lookupQuery is the searchBind
  // slot (the typed query, round-tripped so the view stays a pure function of
  // state). Seeded byte-identically to the .NET twin — a divergent seed fails
  // the diff for a reason that has nothing to do with the wire.
  lookupOwner: string;
  lookupTag: string;
  lookupWatchers: string[];
  lookupQuery: string;
}

function initialState(): FeatureProbeState {
  return {
    pollCount: 0,
    lastUploadName: undefined,
    lastUploadSize: 0,
    sortIntent: { column: undefined, direction: undefined },
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
    lookupOwner: "u-1",
    lookupTag: "urgent",
    lookupWatchers: ["u-2", "t-7"],
    lookupQuery: "",
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
  const nameCol: TableColumn = {
    key: "name", label: "Name", sortable: true, filterable: true,
    // Spread, not a post-hoc assignment: filterValue stays ABSENT when unset
    // (an unset optional is never `null` on the wire — AGENTS.md gotcha #8).
    ...(state.tableFilters.name.length > 0 ? { filterValue: state.tableFilters.name } : {}),
  };

  const table: TableNode = {
    type: "table",
    columns: [
      nameCol,
      { key: "status", label: "Status", sortable: true },
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
      jumpAction: { name: "table-page-jump" },
    },
  };
  return {
    type: "section",
    heading: "Table matrix",
    variant: "card",
    children: [table],
  };
}

function buildVm(state: FeatureProbeState): ViewNode {
  const children: ViewNode[] = [
    { type: "text", value: `Poll count: ${state.pollCount}`, style: "muted" },
  ];
  if (state.lastUploadName !== undefined) {
    children.push({
      type: "text",
      value: `Last upload: ${state.lastUploadName} (${state.lastUploadSize} bytes)`,
      style: "muted",
    });
  }
  children.push(
    // Rich copy — server-provided route: text/html alongside plain text (parity coverage for html).
    { type: "copy-button", text: "npx @ashley-shrok/viewmodel-shell", label: "Copy install command", copiedLabel: "Copied!", emphasis: "secondary", html: "<code>npx @ashley-shrok/viewmodel-shell</code>" },
  );
  children.push({ type: "image", src: "/logo.png", alt: "ViewModel Shell logo", size: "small", shape: "circle" });
  // 6.10.0 — ImageNode.caption + captionRuns parity coverage. Static view-shape
  // captured by every GET step, so the byte-diff covers the two new optional
  // fields (WhenWritingNull ⇒ omitted absent on the wire) across all backends.
  // First image: plain caption (proves the string field crosses). Second image:
  // captionRuns present (proves the InlineRun[] alongside caption crosses).
  children.push({
    type: "image",
    src: "/logo.png",
    alt: "ViewModel Shell logo",
    size: "medium",
    caption: "Figure 1: the framework logo",
  });
  children.push({
    type: "image",
    src: "/logo.png",
    alt: "ViewModel Shell logo",
    size: "medium",
    caption: "See the docs",
    captionRuns: [
      { text: "See " },
      { text: "the docs", href: "https://example.com/docs", external: true },
    ],
  });
  // 6.10.0 — TextNode.level parity coverage. Static view-shape captured by every
  // GET step: one TextNode per level 1..6 (proves the integer serializes as a
  // JSON number 1..6 on both backends), plus a level-2 combined with tone
  // (proves level composes with tone), plus a level absent (proves omitted =
  // absent, WhenWritingNull posture). The initial step's expectBodyContains
  // asserts "level":1 and "level":6 cross the wire as bare integers so the
  // branch can't go vacuous.
  children.push({ type: "text", value: "H1 level", level: 1 });
  children.push({ type: "text", value: "H2 level", level: 2 });
  children.push({ type: "text", value: "H3 level", level: 3 });
  children.push({ type: "text", value: "H4 level", level: 4 });
  children.push({ type: "text", value: "H5 level", level: 5 });
  children.push({ type: "text", value: "H6 level", level: 6 });
  children.push({ type: "text", value: "H2 danger heading", level: 2, tone: "danger" });
  // 6.10.0 — BlockquoteNode parity coverage. Static view-shape captured by
  // every GET step: one bare blockquote holding a paragraph (proves the new
  // {type:"blockquote", children[]} wire serializes byte-identically), and a
  // NESTED blockquote inside another (proves recursive children work). The
  // inner blockquote also carries a ButtonNode with the UNIQUE action name
  // `blockquote-action-probe`, proving the action-name uniqueness walk
  // DESCENDS into blockquote.children on BOTH backends (never POSTed — pure
  // static wire-shape proof, same convention as fits-* / nav-crumb-probe /
  // tracker-cell-probe).
  children.push({
    type: "blockquote",
    children: [{ type: "text", value: "A quoted paragraph inside a blockquote." }],
  });
  children.push({
    type: "blockquote",
    children: [
      { type: "text", value: "Outer quote — nested one below plus an action inside." },
      {
        type: "blockquote",
        children: [
          { type: "text", value: "Nested inner quote." },
          { type: "button", label: "Probe", action: { name: "blockquote-action-probe" } },
        ],
      },
    ],
  });
  // 6.10.0 — CodeBlockNode parity coverage. Static view-shape captured by every
  // GET step: a bare code-block (only Code set, proves language/filename/copyable
  // OMITTED cross as absent, WhenWritingNull posture), a code-block with all
  // three optional fields set (proves the strings/bool cross), and a code-block
  // with copyable:false (proves the JSON `false` boolean crosses on both
  // backends — the value is meaningful, not a default).
  children.push({ type: "code-block", code: "print('hello world')" });
  children.push({
    type: "code-block",
    code: "def add(a, b):\n    return a + b",
    language: "python",
    filename: "add.py",
  });
  children.push({
    type: "code-block",
    code: "// static excerpt — no copy button",
    language: "typescript",
    copyable: false,
  });
  // 6.10.0 — ListItemNode.completed parity coverage. Static view-shape captured
  // by every GET step: a small list with completed:true, completed:false, and
  // completed OMITTED — proving the wire carries the JSON `true` and JSON
  // `false` literals AND that omitted crosses as absent (WhenWritingNull ⇒
  // absent, not null). The initial step's expectBodyContains asserts
  // "completed":true and "completed":false cross as bare booleans so if a
  // backend serializes the field as a string, drops it, or emits `null` for
  // absent, the step fails LOUDLY.
  children.push({ type: "list", children: [
    { type: "list-item", completed: true,  children: [{ type: "text", value: "Task done" }] },
    { type: "list-item", completed: false, children: [{ type: "text", value: "Task todo" }] },
    { type: "list-item",                   children: [{ type: "text", value: "Plain item (no marker)" }] },
  ]});
  if (state.lastSubmit != null) {
    children.push({ type: "text", value: `Last submit: ${state.lastSubmit}`, style: "muted" });
  }
  children.push({ type: "button", label: "Start long action",
    action: { name: "start-long-action" }, emphasis: "primary" });
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
    children: [{ type: "field", name: "note", inputType: "text", bind: "note", label: "Note", placeholder: "Type a note…" }],
    buttons: [
      { type: "button", label: "Save Draft", action: { name: "save-draft" }, emphasis: "secondary" },
      { type: "button", label: "Publish", action: { name: "publish" }, emphasis: "primary" },
    ],
  });
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
  // LinkNode.external is omitted (absent) when false — both backends drop the
  // default since 3.3.0 (F2), so a non-external link carries no `external` key.
  const rowSection: ViewNode = {
    type: "section",
    heading: "Row layout",
    variant: "card",
    layout: "row",
    children: [
      { type: "link", label: "Home", href: "/home" },
      { type: "link", label: "Docs", href: "/docs" },
      { type: "link", label: "About", href: "/about" },
    ],
  };
  // 1.12.0 — arrange/align alignment vocabulary (parity coverage for ALIGN-01/02/03).
  // Static view-shape captured by every GET step (mirrors the 1.11.0 row precedent;
  // no dedicated action arm). LinkNode.external is absent when false (both backends
  // drop the default since 3.3.0, F2). The .NET twins must serialize byte-identically.
  //
  // (a) bare row — NEITHER arrange nor align => proves omitted = no class on the wire.
  const bareRowSection: ViewNode = {
    type: "section",
    heading: "Bare row",
    layout: "row",
    children: [
      { type: "link", label: "One", href: "/one" },
      { type: "link", label: "Two", href: "/two" },
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
          // 2.1.0 — LinkNode.active parity coverage: the current nav item
          // ("you are here"). Byte-identical to the .NET twin.
          { type: "link", label: "Home", href: "/home", active: true },
          { type: "link", label: "Docs", href: "/docs" },
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
      { type: "link", label: "A", href: "/a" },
      { type: "link", label: "B", href: "/b" },
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
      { type: "link", label: "A", href: "/a" },
      { type: "link", label: "B", href: "/b" },
    ],
  }));
  // npm 1.12.0 — switcher vocabulary (parity coverage for SWITCH-01/02/03). Static
  // view-shape captured by every GET step (mirrors the 1.12.0 arrange/align
  // precedent; no dedicated action arm). LinkNode.external is absent when false
  // (both backends drop the default since 3.3.0, F2). The .NET twins must
  // serialize byte-identically — omitted threshold/limit ABSENT on the wire,
  // set ones present.
  //
  // (a) bare switcher — NEITHER threshold nor limit => proves omitted = no class.
  const bareSwitcherSection: ViewNode = {
    type: "section",
    heading: "Bare switcher",
    layout: "switcher",
    children: [
      { type: "link", label: "One", href: "/one" },
      { type: "link", label: "Two", href: "/two" },
      { type: "link", label: "Three", href: "/three" },
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
      { type: "link", label: "A", href: "/a" },
      { type: "link", label: "B", href: "/b" },
      { type: "link", label: "C", href: "/c" },
    ],
  }));
  // (c) one switcher with limit:4 and >4 children (6) — exercises the count cap.
  const switcherLimitSection: ViewNode = {
    type: "section",
    heading: "switcher limit",
    layout: "switcher",
    limit: 4,
    children: [
      { type: "link", label: "1", href: "/1" },
      { type: "link", label: "2", href: "/2" },
      { type: "link", label: "3", href: "/3" },
      { type: "link", label: "4", href: "/4" },
      { type: "link", label: "5", href: "/5" },
      { type: "link", label: "6", href: "/6" },
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
      { type: "link", label: "One", href: "/c1" },
      { type: "link", label: "Two", href: "/c2" },
      { type: "link", label: "Three", href: "/c3" },
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
      { type: "link", label: "P", href: "/p" },
      { type: "link", label: "Q", href: "/q" },
      { type: "link", label: "R", href: "/r" },
      { type: "link", label: "S", href: "/s" },
    ],
  }));

  // 1.x (Phase 10) — fits node vocabulary (parity coverage for FITS-03). Static
  // view-shape captured by every GET step (same precedent; no dedicated action
  // arm). The .NET twins must serialize byte-identically — the WIRE shape is
  // {type:"fits", axis?, children}: omitted `axis` ABSENT on the wire, axis:"both"
  // present as the JSON string "both". The CLIENT-SIDE measure-and-pick selection
  // is browser-only and NOT part of parity; parity proves only identical
  // serialization. Candidates are ordered preferred/widest FIRST → fallback LAST.
  //
  // (a) fits with axis OMITTED — proves omitted = absent on the wire.
  const fitsAxisOmittedSection: ViewNode = {
    type: "section",
    heading: "fits (axis omitted)",
    children: [
      {
        type: "fits",
        children: [
          {
            type: "section",
            layout: "row",
            children: [
              { type: "link", label: "Wide A", href: "/wa" },
              { type: "link", label: "Wide B", href: "/wb" },
              { type: "link", label: "Wide C", href: "/wc" },
            ],
          },
          {
            type: "section",
            layout: "stack",
            children: [
              { type: "link", label: "Wide A", href: "/wa" },
              { type: "link", label: "Wide B", href: "/wb" },
              { type: "link", label: "Wide C", href: "/wc" },
            ],
          },
        ],
      },
    ],
  };
  // (b) fits with axis:"both" — proves the axis field present on the wire.
  const fitsAxisBothSection: ViewNode = {
    type: "section",
    heading: "fits axis:both",
    children: [
      {
        type: "fits",
        axis: "both",
        children: [
          {
            type: "section",
            layout: "row",
            children: [
              { type: "link", label: "X", href: "/x" },
              { type: "link", label: "Y", href: "/y" },
            ],
          },
          {
            type: "section",
            layout: "stack",
            children: [
              { type: "link", label: "X", href: "/x" },
              { type: "link", label: "Y", href: "/y" },
            ],
          },
        ],
      },
    ],
  };

  // 12.x (Phase 12) — chart node vocabulary (parity coverage for CHART-05).
  // Reshaped Phase 18 (CHARTBASE-04) — multi-series + tone + stacked, over
  // WHOLE-NUMBER data so double/number serialize byte-identically (12 not
  // 12.0). First chart: `kind` OMITTED (proves omitted = absent, default
  // "bar"); two series sharing `labels` — "Visits" carries no tone
  // (framework-assigned palette slot), "Errors" carries tone:"danger"
  // (semantic override); stacked:true. Second chart: `kind:"line"` set
  // explicitly (proves the literal string crosses the wire), single series,
  // stacked/title omitted. The client-side Chart.js pixels are NOT
  // parity-tested (browser-only); parity proves only identical serialization.
  // Byte-identical to the .NET twin (FeatureProbeController.cs chartSection).
  const chartSection: ViewNode = {
    type: "section",
    heading: "chart (bar)",
    children: [
      {
        type: "chart",
        labels: ["Mon", "Tue", "Wed"],
        series: [
          { name: "Visits", data: [12, 19, 7] },
          { name: "Errors", data: [1, 3, 2], tone: "danger" },
        ],
        stacked: true,
        title: "Weekly visits",
      },
      {
        type: "chart",
        labels: ["Mon", "Tue", "Wed"],
        series: [
          { name: "Trend", data: [5, 10, 15] },
        ],
        kind: "line",
      },
    ],
  };

  // 3.0.0 — appearance axes (parity coverage for the unified vocabulary).
  // Byte-identical to the .NET twin (FeatureProbeController.cs axesSection).
  const axesSection: ViewNode = {
    type: "section",
    heading: "Appearance axes",
    variant: "card",
    children: [
      { type: "button", label: "E-primary",   action: { name: "axes-noop-1" }, emphasis: "primary" },
      { type: "button", label: "E-secondary", action: { name: "axes-noop-2" }, emphasis: "secondary" },
      { type: "button", label: "T-danger",    action: { name: "axes-noop-3" }, tone: "danger" },
      { type: "button", label: "T-warning",   action: { name: "axes-noop-4" }, tone: "warning" },
      { type: "button", label: "T-success",   action: { name: "axes-noop-5" }, tone: "success" },
      { type: "button", label: "T-info",      action: { name: "axes-noop-6" }, tone: "info" },
      { type: "button", label: "S-sm",        action: { name: "axes-noop-7" }, size: "sm" },
      { type: "button", label: "S-lg",        action: { name: "axes-noop-8" }, size: "lg" },
      { type: "button", label: "combo",       action: { name: "axes-noop-9" }, emphasis: "primary", tone: "danger", size: "lg" },
      // Destructive-action guard: confirm carries a native-confirm question.
      { type: "button", label: "confirm-guard", action: { name: "axes-noop-confirm" }, tone: "danger", confirm: "Delete this? This cannot be undone." },
      // Rich copy — harvest route: copies the rendered "Warning card" region below (parity coverage for copyTargetId).
      { type: "copy-button", text: "axes-clip", label: "Copy", emphasis: "secondary", tone: "info", size: "sm", copyTargetId: "axes-warning-card" },
      { type: "text", value: "tone text", tone: "warning" },
      { type: "text", value: "heading + tone", style: "heading", tone: "danger" },
      { type: "section", id: "axes-warning-card", heading: "Warning card", variant: "card", tone: "warning", children: [{ type: "text", value: "tinted card surface" }] },
      { type: "section", heading: "Danger band", tone: "danger", children: [{ type: "text", value: "bare tinted section" }] },
      { type: "list", children: [
        { type: "list-item", id: "axes-li-1", state: "active", children: [{ type: "text", value: "active state" }] },
        { type: "list-item", id: "axes-li-2", tone: "danger", children: [{ type: "text", value: "danger tone" }] },
        { type: "list-item", id: "axes-li-3", state: "done", tone: "success", children: [{ type: "text", value: "done + success" }] },
      ]},
      // ListNode.ordered — an <ol> probe (ordered:true crosses the wire); the
      // unordered list above OMITS ordered (proving absent = <ul>).
      { type: "list", ordered: true, children: [
        { type: "list-item", id: "axes-oli-1", children: [{ type: "text", value: "ordered one" }] },
        { type: "list-item", id: "axes-oli-2", children: [{ type: "text", value: "ordered two" }] },
      ]},
      { type: "table",
        columns: [{ key: "k", label: "K" }],
        rows: [
          { cells: { k: "running" }, state: "running" },
          { cells: { k: "danger" }, tone: "danger" },
          { cells: { k: "done+warn" }, state: "done", tone: "warning" },
        ],
      },
    ],
  };

  // 3.1.0 (#22) — byte-identical to the .NET twin (FeatureProbeController.cs admin22Section).
  const admin22Section: ViewNode = {
    type: "section",
    heading: "Admin primitives (#22)",
    variant: "card",
    children: [
      { type: "button", label: "Full width", action: { name: "axes-noop-10" }, emphasis: "primary", width: "full" },
      { type: "divider" },
      { type: "divider", orientation: "vertical" },
      { type: "form", children: [
        { type: "field", name: "q", inputType: "text", bind: "axesQuery", label: "Query" },
      ], submitButton: { type: "button", label: "Search", action: { name: "axes-search" }, emphasis: "primary", width: "full" } },
    ],
  };

  // 3.2.0 — child-side modifiers alignSelf + maxWidth on SectionNode (parity for
  // CHILD-01/02/03). Static view-shape captured by every GET step; the .NET twin
  // (FeatureProbeController.cs childModifiersSection) must serialize byte-identically
  // — omitted alignSelf/maxWidth ABSENT on the wire, set ones present. The last two
  // children are the motivating chat-bubble composition (a card pinned to one side,
  // capped, tone by sender; zero app CSS).
  const childModifiersSection: ViewNode = {
    type: "section",
    heading: "Child modifiers (alignSelf + maxWidth)",
    children: [
      { type: "section", variant: "card", children: [{ type: "text", value: "bare (omitted)" }] },
      { type: "section", variant: "card", alignSelf: "start",  children: [{ type: "text", value: "alignSelf start" }] },
      { type: "section", variant: "card", alignSelf: "center", children: [{ type: "text", value: "alignSelf center" }] },
      { type: "section", variant: "card", alignSelf: "end",    children: [{ type: "text", value: "alignSelf end" }] },
      { type: "section", variant: "card", maxWidth: "half",           children: [{ type: "text", value: "maxWidth half" }] },
      { type: "section", variant: "card", maxWidth: "two-thirds",     children: [{ type: "text", value: "maxWidth two-thirds" }] },
      { type: "section", variant: "card", maxWidth: "three-quarters", children: [{ type: "text", value: "maxWidth three-quarters" }] },
      { type: "section", variant: "card", maxWidth: "prose",          children: [{ type: "text", value: "maxWidth prose" }] },
      { type: "section", variant: "card", alignSelf: "start", maxWidth: "three-quarters",               children: [{ type: "text", value: "Hi there!" }] },
      { type: "section", variant: "card", alignSelf: "end",   maxWidth: "three-quarters", tone: "info", children: [{ type: "text", value: "Doing great, thanks!" }] },
    ],
  };

  // 3.3.0 (F3) — a STATIC ModalNode rendered on every GET so the parity suite
  // byte-diffs the full modal wire shape (title/children/footer/dismissAction/
  // size) across all backends. Previously ModalNode appeared only in
  // ExpenseTracker gated behind state.adding, which no fixture ever opened, so
  // the modal wire shape had zero cross-backend coverage.
  const probeModal: ViewNode = {
    type: "modal",
    title: "Probe modal",
    size: "narrow",
    dismissAction: { name: "modal-dismiss" },
    children: [{ type: "text", value: "Modal body for parity coverage." }],
    footer: [{ type: "button", label: "OK", action: { name: "modal-ok" } }],
  };

  // 3.4.0 — forms-completeness parity coverage: FieldNode error/help/disabled/
  // readonly/min/max/step/maxLength + ButtonNode.disabled. Static so every GET
  // byte-diffs the new wire fields across all backends.
  const formsSection: ViewNode = {
    type: "section",
    heading: "Forms completeness",
    variant: "card",
    children: [
      { type: "field", name: "fc-email", inputType: "email", bind: "note", label: "Email",
        required: true, help: "We never share it.", error: "That email is already taken." },
      { type: "field", name: "fc-qty", inputType: "number", bind: "note", label: "Quantity",
        min: "0", max: "10", step: "0.5" },
      { type: "field", name: "fc-code", inputType: "text", bind: "note", label: "Code",
        maxLength: 8, placeholder: "max 8 chars" },
      { type: "field", name: "fc-locked", inputType: "text", bind: "note", label: "Account ID",
        readonly: true },
      { type: "field", name: "fc-region", inputType: "text", bind: "note", label: "Region",
        disabled: true,
        // 6.12.0 (TOOL-01) — twin of the .NET FieldNode.Tooltip, byte-identical.
        tooltip: "The region code from the customer's billing address." },
      // 6.12.0 (RADIO-01) — twin of the .NET fc-radio, byte-identical wire.
      { type: "field", name: "fc-radio", inputType: "radio", bind: "note", label: "Priority",
        options: [
          { value: "low", label: "Low" },
          { value: "med", label: "Medium" },
          { value: "high", label: "High" },
        ] },
      // 6.12.0 (RANGE-01) — twin of the .NET fc-range, byte-identical wire.
      { type: "field", name: "fc-range", inputType: "range", bind: "note", label: "Level",
        min: "0", max: "100", step: "5" },
      { type: "button", label: "Submit (disabled)", action: { name: "fc-submit" },
        emphasis: "primary", disabled: true,
        // 6.12.0 (TOOL-01) — twin of the .NET ButtonNode.Tooltip, byte-identical.
        tooltip: "Currently disabled — complete required fields first." },
    ],
  };

  // 3.9.0 — FieldNode.bind optional (file inputs). A file field with NO bind:
  // its binary rides the multipart side channel (fileRegistry keyed on `name`),
  // so `bind` is omitted here. Static view-shape captured by every GET step;
  // proves the node serializes with NO `bind` key identically across backends
  // (the .NET twin passes Bind: null → WhenWritingNull → absent).
  const fileNoBindSection: ViewNode = {
    type: "section",
    heading: "File field (optional bind)",
    variant: "card",
    children: [
      { type: "field", name: "upload-nobind", inputType: "file", label: "Attachment (no bind)" },
      // File field declaring uploadOn — the binary rides only the named action.
      // Byte-diffs the uploadOn wire array against the .NET twin.
      { type: "field", name: "upload-routed", inputType: "file", label: "Attachment (routed)", uploadOn: ["probe-submit"] },
    ],
  };

  // Feedback primitives — BadgeNode + EmptyStateNode (static view-shape captured
  // by every GET step; byte-identical to the .NET twin feedbackSection). A bare
  // badge (NEITHER tone nor emphasis => omitted = absent on the wire), a
  // tone-only badge, a tone+emphasis badge; a bare empty-state (no description/action
  // => omitted = absent), and an empty-state with description + a CTA ButtonNode
  // (proves the action serializes with type:"button" AND the action-name walk
  // descends into empty-state.action on both backends — unique name feedback-cta).
  //
  // v8.0.0 BREAKING RENAME (24-04): EmptyStateNode field names
  // heading→title, message→description; NEW icon slot.
  const feedbackSection: ViewNode = {
    type: "section",
    heading: "Feedback primitives",
    variant: "card",
    children: [
      { type: "badge", label: "New" },
      { type: "badge", label: "3", tone: "danger" },
      { type: "badge", label: "Beta", tone: "info", emphasis: "secondary" },
      { type: "empty-state", title: "No items yet" },
      {
        type: "empty-state",
        title: "Nothing here",
        description: "Add the first item.",
        action: { type: "button", label: "Add item", action: { name: "feedback-cta" }, emphasis: "primary" },
      },
    ],
  };

  // Fill axis (SectionNode.fill) — one representative section carrying fill:true
  // so the parity diff covers the new SectionNode wire field. Byte-identical to
  // the .NET twin (FeatureProbeController.cs fillSection). NOTE the probe root
  // page deliberately does NOT set fill (it must stay a natural-scroll inventory
  // page); PageNode.fill is covered by the serialization tests instead.
  const fillSection: ViewNode = {
    type: "section",
    heading: "Fill section",
    variant: "card",
    fill: true,
    children: [
      { type: "text", value: "This section claims leftover height and scrolls internally inside a fill page." },
      { type: "text", value: "Outside a fill page the modifier class is an inert no-op." },
    ],
  };

  // Follow-tail axis (SectionNode.followTail) — one representative section
  // carrying followTail:true so the parity diff covers the new SectionNode wire
  // field. Byte-identical to the .NET twin (FeatureProbeController.cs
  // followTailSection). Append-only feed scroll behavior is client-side
  // (BrowserAdapter); on the wire it's just the boolean, false stays absent (F2).
  const followTailSection: ViewNode = {
    type: "section",
    heading: "Follow-tail feed",
    variant: "card",
    fill: true,
    followTail: true,
    children: [
      { type: "text", value: "An append-only feed (chat transcript, log tail, activity stream) that keeps its newest content in view unless the user scrolls up." },
    ],
  };

  // Phase 14 (NBA-04) — non-blocking dispatch, the `blocking` field on
  // ActionEvent. Static view-shape captured by the existing GET step, no new
  // POST step: a button whose action OMITS `blocking` (proves the default
  // stays absent on the wire) and a button whose action sets `blocking:false`
  // (proves it serializes as the literal JSON boolean false). Neither
  // "nba-blocking-default" nor "nba-non-blocking" is ever POSTed by any
  // fixture step — same convention as the "axes-noop-*" buttons above, which
  // exist purely as static wire-shape proof. The CLIENT-SIDE coalescing
  // (NBA-02) / out-of-order-discard (NBA-03) behavior this field enables is
  // NOT parity-tested (pure client-only mechanics — no wire epoch, no
  // server-side reconciliation state, per .planning/design/non-blocking-actions.md);
  // that is covered instead by viewmodel-shell/test/nonblocking-dispatch.test.ts
  // and blocking-propagation.test.ts (Plan 14-01). Byte-identical to the .NET
  // twin (FeatureProbeController.cs blockingSection).
  const blockingSection: ViewNode = {
    type: "section",
    heading: "Non-blocking actions (blocking field)",
    children: [
      { type: "button", label: "Blocking (default)", action: { name: "nba-blocking-default" } },
      { type: "button", label: "Non-blocking", action: { name: "nba-non-blocking", blocking: false } },
    ],
  };

  // Navigation primitives (NAV-01/NAV-02) — BreadcrumbNode + StepsNode as static
  // view-shape captured by every GET step; byte-identical to the .NET twin
  // navSection. The breadcrumb exercises the full omitted-vs-present crumb matrix:
  // an href-only crumb (external OMITTED => absent on the wire), an external:true
  // crumb (present as the literal boolean), an action crumb whose UNIQUE name
  // nav-crumb-probe proves the action-name uniqueness walk DESCENDS into
  // breadcrumb items (never POSTed by any step — pure static wire-shape proof,
  // same convention as the axes-noop-* / nba-* buttons), and a final label-only
  // crumb (no href/action) that the framework auto-renders as the current page.
  // The steps exercise both orientations: the first OMITS orientation (proves
  // absent = default horizontal) and mixes a description-bearing step with two
  // bare ones (description omitted => absent); the second sets
  // orientation:"vertical" (proves the literal string crosses). Both carry a mid
  // current:1 (0 is meaningful, so current always crosses). The CLIENT-SIDE
  // appearance/a11y (separators, markers, connector lines, aria-current) is
  // browser-only and NOT part of parity — parity proves only the wire shape.
  const navSection: ViewNode = {
    type: "section",
    heading: "Navigation primitives",
    variant: "card",
    children: [
      {
        type: "breadcrumb",
        items: [
          { label: "Home", href: "/" },
          { label: "Docs", href: "https://example.com/docs", external: true },
          { label: "Reports", action: { name: "nav-crumb-probe" } },
          { label: "Q3 Summary" },
        ],
      },
      {
        type: "steps",
        steps: [
          { label: "Cart", description: "Review items" },
          { label: "Shipping" },
          { label: "Payment" },
        ],
        current: 1,
      },
      {
        type: "steps",
        steps: [
          { label: "Draft", description: "Compose the post" },
          // Per-step tone (StepItem.tone) — overlays status on the derived state.
          { label: "Review", tone: "danger" },
          { label: "Publish", tone: "warning" },
        ],
        current: 1,
        orientation: "vertical",
      },
      // Stat bar (STAT-01) — value is a STRING on both backends (a bare number
      // would drift: JSON `12` in TS vs `"12"` from the .NET twin). Includes a
      // toned tile so StatItem.tone rides the parity diff.
      {
        type: "stat-bar",
        stats: [
          { label: "active", value: "12" },
          { label: "failing", value: "3", tone: "danger" },
        ],
      },
    ],
  };

  // Tracker (TrackerNode) — a status/heat strip as static view-shape captured by
  // every GET step; byte-identical to the .NET twin trackerSection. Covers the
  // omitted-vs-present matrix: a cell with state OMITTED (proves absent = muted
  // default on the wire), one cell per state (success/danger/warning/muted), a
  // cell carrying a `tooltip` (proves the string crosses; v7.0.0 renamed from
  // `label`), and a cell carrying an `action` whose UNIQUE name
  // tracker-cell-probe proves the action-name uniqueness walk DESCENDS into
  // TrackerCell.action (never POSTed by any step — pure static wire-shape
  // proof, same convention as nav-crumb-probe / lookup-search-probe). The
  // CLIENT-SIDE appearance (hairline gap, baked colorblind-safe palette,
  // shrink-then-scroll overflow, hover/tooltip, keyboard activation) is
  // browser-only and NOT part of parity — parity proves only that the
  // {type:"tracker", id?, cells:[{state?, tooltip?, action?}]} wire serializes
  // identically across backends.
  const trackerSection: ViewNode = {
    type: "section",
    heading: "Status tracker",
    variant: "card",
    children: [
      {
        type: "tracker",
        id: "probe-tracker",
        cells: [
          {},                                                   // state OMITTED => muted default (absent on wire)
          { state: "success" },
          { state: "danger" },
          { state: "warning" },
          { state: "muted" },
          { state: "success", tooltip: "2026-07-15 14:02 UTC · Success" },
          { state: "danger", tooltip: "Failed", action: { name: "tracker-cell-probe" } },
        ],
      },
    ],
  };

  // Diff (DiffNode) — aligned before/after primitive as static view-shape,
  // byte-identical to the .NET twin diffSection. Covers the omitted-vs-present
  // wire matrix: mode OMITTED (absent = side-by-side default), header OMITTED,
  // id OMITTED on the bare diff; a second diff sets mode:"unified" and header
  // present + id:"probe-diff-unified" so both fields cross the wire. Rows cover
  // every kind the SHAPE-carries-meaning contract expresses: context (both
  // sides present, identical text with lineNumber), pure remove (new:null =>
  // ABSENT on the wire, NOT null — the whole point of gotcha #8), pure add
  // (old:null => absent), modified pair (both non-null with different text),
  // and a prose row with NO lineNumber (lineNumber omitted => absent on the
  // wire). DiffNode is action-free (collectActions falls through the same way
  // as ChartNode / StepsNode); nothing to prove for uniqueness descent. The
  // CLIENT-SIDE appearance (Grid alignment, tint+stripe, unified linenum-
  // collapse) is browser-only and NOT part of parity — parity proves only that
  // the {type:"diff", id?, rows:[{old?, new?}], mode?, header?} wire
  // serializes identically across backends.
  const diffSection: ViewNode = {
    type: "section",
    heading: "Diff",
    variant: "card",
    children: [
      // Bare diff — mode/header/id ALL omitted. Note: for pure-add / pure-remove
      // rows we OMIT the missing side entirely (per gotcha #8 — an unset optional
      // is ABSENT on the wire, never `"field": null`).
      {
        type: "diff",
        rows: [
          { old: { text: "context line", lineNumber: 1 }, new: { text: "context line", lineNumber: 1 } },
          { old: { text: "removed", lineNumber: 2 } },                         // pure remove — `new` omitted
          { new: { text: "added", lineNumber: 2 } },                           // pure add — `old` omitted
          { old: { text: "before", lineNumber: 3 }, new: { text: "after", lineNumber: 3 } },
          // Prose row — no line numbers on either side (lineNumber omitted).
          { old: { text: "Prose paragraph, version A." }, new: { text: "Prose paragraph, version B." } },
        ],
      },
      // Unified with header — mode + header + id ALL present.
      {
        type: "diff",
        id: "probe-diff-unified",
        mode: "unified",
        header: { old: "before.txt", new: "after.txt" },
        rows: [
          { old: { text: "same", lineNumber: 1 }, new: { text: "same", lineNumber: 1 } },
          { old: { text: "gone", lineNumber: 2 } },                            // pure remove — `new` omitted
        ],
      },
      // Word-level intra-line highlighting via DiffCell.runs — the feature
      // DiffNode v1 deferred pending the inline-rich-text question. The OLD side
      // strikes the removed word, the NEW side bolds the added one. `text` stays
      // required on both (plain reading + fallback + agent-legible form).
      {
        type: "diff",
        id: "probe-diff-wordlevel",
        rows: [
          {
            old: {
              text: "the quick brown fox",
              lineNumber: 1,
              runs: [{ text: "the " }, { text: "quick", strike: true }, { text: " brown fox" }],
            },
            new: {
              text: "the slow brown fox",
              lineNumber: 1,
              runs: [{ text: "the " }, { text: "slow", bold: true }, { text: " brown fox" }],
            },
          },
        ],
      },
    ],
  };

  // ── Icons (v7.0.0 — ICON-01/02/04/05/06/09) ──
  // Covers the full omitted-vs-present matrix for the icons primitive, byte-
  // identical to the .NET twin iconsSection. Every branch introduced by this
  // phase must have at least one emission here + an expectBodyContains
  // tripwire on the initial GET step, per banked lesson: a diff can only prove
  // things about code it actually RUNS.
  //   • Standalone IconNode: bare (all optionals absent), 5 sizes, 4 tones
  //     (matches the closed union — 4 not 6), one meaning-carrying (label set).
  //   • Multi-word + number-suffixed names (shield-check, trash-2) exercise
  //     the .NET IconNameConverter's digit-aware kebab conversion — the
  //     specific defect the plain KebabEnum<T> would silently drift on.
  //   • Cross-node icon? prop on all 5 hosts (Button/Link/Section/Badge/
  //     ListItem) — each with a distinct icon.
  //   • The VALID icon-only ButtonNode (label empty + tooltip set) — the
  //     positive form of the walker rule. The INVALID form is exercised via
  //     the dedicated icon-only-invalid POST action (see the envelope fixture).
  // The renamed TrackerCell.tooltip field is already covered by the pre-
  // existing trackerSection above (updated in Plan 22-03).
  // NOTE: the CLIENT-SIDE SVG rendering (viewBox / stroke / path elements)
  // and the .vms-tooltip-host styled bubble are browser-only and NOT part of
  // parity — parity proves only that the icon fields serialize identically
  // across backends.
  const iconsSection: ViewNode = {
    type: "section",
    heading: "Icons",
    variant: "card",
    children: [
      // Standalone IconNode — bare (size/tone/label ALL omitted, absent on the wire).
      { type: "icon", name: "sparkles" },
      // One per size (5 total) — exercises the IconSize enum end-to-end.
      { type: "icon", name: "activity", size: "xs" },
      { type: "icon", name: "activity", size: "sm" },
      { type: "icon", name: "activity", size: "md" },
      { type: "icon", name: "activity", size: "lg" },
      { type: "icon", name: "activity", size: "xl" },
      // One per tone (4 total, matching the closed union).
      { type: "icon", name: "check-circle", tone: "info" },
      { type: "icon", name: "check-circle", tone: "success" },
      { type: "icon", name: "check-circle", tone: "warning" },
      { type: "icon", name: "check-circle", tone: "danger" },
      // Meaning-carrying (label set) — a11y contract: role="img" + aria-label
      // (client-side, not parity). Multi-word name proves shield-check
      // serializes as "shield-check" (kebab-boundary case on .NET).
      { type: "icon", name: "shield-check", label: "Verified" },
      // Number-suffixed name — the specific IconNameConverter test case
      // (would drift on plain KebabEnum<T> to "trash2").
      { type: "icon", name: "trash-2", size: "lg", tone: "danger", label: "Delete permanently" },
      // Cross-node host props — all 5 hosts, each with a distinct icon.
      { type: "button", label: "Sparkle", action: { name: "icon-button-noop" }, icon: "sparkles" },
      { type: "link", label: "Docs", href: "https://vms.example/docs", external: true, icon: "external-link" },
      { type: "section", heading: "Angels", variant: "card", icon: "activity", children: [{ type: "text", value: "Card body." }] },
      { type: "badge", label: "Verified", tone: "success", icon: "check-circle" },
      { type: "list", children: [{ type: "list-item", icon: "folder", children: [{ type: "text", value: "Files" }] }] },
      // The VALID icon-only ButtonNode — label empty + tooltip set, walker allows.
      { type: "button", label: "", action: { name: "icon-only-noop" }, icon: "wrench", tooltip: "Settings" },
    ],
  };

  // ── v8.0.0 Foundations (COMP-01..COMP-04) ──
  // Byte-identical to the .NET twin's Foundations SectionNode. Every branch
  // introduced by plans 23-01..04 gets at least one emission here + an
  // expectBodyContains tripwire on the initial GET step, per banked lesson: a
  // diff can only prove things about code it actually RUNS. Fleet-adoption
  // discipline (banked from UseVmsShellStaticFiles 6.7.0) is honored — the
  // primitives ship with parity coverage in the same batch.
  //   • COMP-01 (caption): TextNode with style:"caption" — proves the closed
  //     union grew to 7 members and "style":"caption" crosses.
  //   • COMP-02 (weight, Option A): three TextNodes weight:"regular"/"medium"
  //     /"bold" — proves the new orthogonal axis crosses the wire.
  //   • COMP-03 (switch variant): CheckboxNode variant:"switch" + one with
  //     variant OMITTED — proves the enum crosses AND WhenWritingNull posture.
  //   • COMP-04 (AvatarNode): a bare AvatarNode (all optionals absent — proves
  //     gotcha #8 posture, the class-2 defect findNulls catches), one per
  //     size sm/md/lg/xl (proves the closed AvatarSize enum crosses), one
  //     per content mode (initials/tone, icon/tone, image-only), and a
  //     meaning-carrying one (alt set).
  // NOTE: the CLIENT-SIDE rendering (font sizing per size, .vms-avatar--icon
  // SVG reuse via renderIconSvg, .vms-field--switch slider styling, .vms-text
  // --caption text-xs muted-opacity emission) is browser-only and NOT part of
  // parity — parity proves only that the fields serialize identically across
  // backends.
  const foundationsSection: ViewNode = {
    type: "section",
    heading: "v8.0.0 Foundations",
    variant: "card",
    children: [
      // ── COMP-01 caption tier ─────────────────────────────
      { type: "text", value: "Row primary (body)", style: "body" },
      { type: "text", value: "Row secondary (muted)", style: "muted" },
      { type: "text", value: "2h ago · READ · Ada L.", style: "caption" },

      // ── COMP-02 weight axis (Option A — new orthogonal field) ────
      { type: "text", value: "Regular weight", style: "body", weight: "regular" },
      { type: "text", value: "Medium weight",  style: "body", weight: "medium" },
      { type: "text", value: "Bold weight",    style: "body", weight: "bold" },

      // ── COMP-03 switch variant ───────────────────────────
      { type: "checkbox", name: "notifications", bind: "notifications", label: "Notifications", variant: "switch" },
      // variant OMITTED — proves absent = default (WhenWritingNull posture),
      // NOT a "variant":"checkbox" fill-in and NOT a "variant":null null-leak.
      { type: "checkbox", name: "beta", bind: "beta", label: "Beta features (variant omitted)" },

      // ── COMP-04 AvatarNode ───────────────────────────────
      // Bare — all optionals absent on the wire (proves gotcha #8 posture).
      { type: "avatar" },
      // Every size — proves the closed AvatarSize enum crosses on both backends.
      { type: "avatar", size: "sm", initials: "S" },
      { type: "avatar", size: "md", initials: "M" },
      { type: "avatar", size: "lg", initials: "L" },
      // Meaning-carrying (initials + tone + alt) — the tripwire concentration
      // point: "size":"xl", "initials":"AL", "tone":"success", alt set.
      { type: "avatar", size: "xl", initials: "AL", tone: "success", alt: "Ada Lovelace" },
      // Content-mode coverage — initials + info tone.
      { type: "avatar", initials: "GH", tone: "info", alt: "Grace Hopper" },
      // Icon mode — "icon":"user" (a valid IconName), warning tone, larger size.
      { type: "avatar", icon: "user", tone: "warning", size: "lg", alt: "Anonymous user" },
      // Image mode — the exact URL is the tripwire; placeholder host, never fetched by parity.
      { type: "avatar", image: "https://vms.example/avatar-ada.png", alt: "Ada Lovelace" },
    ],
  };

  // ── v8.0.0 Primary Composites (COMP-05..COMP-08) ──
  // Byte-identical to the .NET twin's Primary Composites SectionNode. Every
  // branch introduced by plans 24-01..04 gets at least one emission here + an
  // expectBodyContains tripwire on the initial GET step, per banked lesson: a
  // diff can only prove things about code it actually RUNS. Fleet-adoption
  // discipline is honored — the composites ship with parity coverage in the
  // same batch (per v5.1 EXTEND pattern; single fixture, appended section).
  //   • COMP-05 (ListRowNode): one standalone ListRowNode (all slots
  //     populated: primary/secondary/meta[]/tone/state/action) + a
  //     ListNode(variant:"rows") wrapper containing two ListRowNodes —
  //     proves standalone-vs-container dispatch AND the variant:"rows"
  //     enum crosses the wire.
  //   • COMP-06 + 06a (MessageNode + MessageListNode): a MessageListNode
  //     with followTail:true (proves the WhenWritingDefault posture emits
  //     the literal boolean true on the wire — false is ABSENT) containing
  //     two MessageNodes with different roles (user + assistant, proves
  //     the closed role union crosses) + full avatar + timestamp + content
  //     + actions slots.
  //   • COMP-07 (AlertNode): one per tone (danger/warning/success/info) +
  //     one dismissible:true variant (proves the .NET WhenWritingDefault
  //     posture matches the TS optional bool). Dismiss button emits
  //     {name:"dismiss"} client-side — the wire carries only the boolean
  //     posture; parity byte-diffs that.
  //   • COMP-08 (EmptyStateNode): one with RENAMED title/description +
  //     NEW icon slot + action button with UNIQUE name empty-state-cta-probe
  //     — proves the rename cascade reached the demo backends AND the
  //     action-name walk descends through the renamed shape.
  // NOTE: the CLIENT-SIDE rendering (grid layout, follow-tail scroll pinning
  // via data-follow-tail reuse, dismiss button click emission, icon SVG
  // payload via renderIconSvg, tinted-surface color-mix palettes) is
  // browser-only and NOT part of parity — parity proves only that the fields
  // serialize identically across backends.
  const primaryCompositesSection: ViewNode = {
    type: "section",
    heading: "v8.0.0 Primary Composites",
    variant: "card",
    children: [
      // ── COMP-05 ListRowNode (standalone) ────
      // Explicit TextNode wrapping for primary/secondary/meta[] on the wire so
      // the bun output byte-matches the .NET twin (which cannot use the
      // `string | ViewNode` TS convenience — its ViewNode-only slot forces a
      // wrapped-TextNode wire shape). The BrowserAdapter renders both shapes
      // identically; the ONLY reason to prefer wrap-on-the-wire here is
      // parity byte-alignment. Same convention as the Showcase's Primary
      // Composites section (24-06) uses.
      {
        type: "list-row",
        primary: { type: "text", value: "Order #42 · Ada Lovelace", style: "body", weight: "medium" },
        secondary: { type: "text", value: "Awaiting fulfillment · flagged high priority", style: "muted" },
        meta: [
          { type: "text", value: "Placed 2h ago",  style: "caption" },
          { type: "text", value: "priority: high", style: "caption" },
          { type: "text", value: "channel: web",   style: "caption" },
        ],
        tone: "warning",
        state: "high",
        action: { name: "list-row-open-42" },
      },
      // ── COMP-05a ListNode(variant:"rows") with ListRowNode children ────
      {
        type: "list",
        variant: "rows",
        children: [
          {
            type: "list-row",
            leading: { type: "avatar", initials: "AL", tone: "success" },
            primary: { type: "text", value: "Refunded successfully", style: "body", weight: "medium" },
            secondary: { type: "text", value: "Refund ID rf_39a2 · $124.00", style: "muted" },
            meta: [
              { type: "text", value: "7m ago", style: "caption" },
            ],
            tone: "success",
            state: "done",
          },
          {
            type: "list-row",
            primary: { type: "text", value: "Payment declined", style: "body", weight: "medium" },
            meta: [
              { type: "text", value: "issuer decline",    style: "caption" },
              { type: "text", value: "card ending 4321",  style: "caption" },
            ],
            tone: "danger",
          },
        ],
      },
      // ── COMP-06 MessageNode + COMP-06a MessageListNode (followTail:true) ──
      // Same byte-alignment rule as ListRowNode above — MessageNode.content is
      // wrapped in an explicit TextNode on the wire so bun matches .NET.
      {
        type: "message-list",
        followTail: true,
        children: [
          {
            type: "message",
            author: "Ada Lovelace",
            timestamp: "2:14 PM",
            content: { type: "text", value: "Can we ship v8 this week?", style: "body" },
            avatar: { type: "avatar", initials: "AL", tone: "success" },
            role: "user",
          },
          {
            type: "message",
            author: "VMS Assistant",
            timestamp: "2:15 PM",
            content: { type: "text", value: "The Phase 24 branch is green; publishing is a maintainer step.", style: "body" },
            avatar: { type: "avatar", icon: "sparkles", tone: "info" },
            role: "assistant",
            actions: [
              { type: "button", label: "OK", action: { name: "message-noop-1" } },
            ],
          },
        ],
      },
      // ── COMP-07 AlertNode (per tone + dismissible) ────────
      // Same byte-alignment rule — AlertNode.message wrapped as TextNode.
      { type: "alert", tone: "warning", title: "Storage almost full", message: { type: "text", value: "You've used 92% of your quota.", style: "muted" }, dismissible: true },
      { type: "alert", tone: "danger",  title: "Payment declined",    message: { type: "text", value: "Your card was refused.",       style: "muted" } },
      { type: "alert", tone: "success", title: "Refund processed",    message: { type: "text", value: "Refund of $124 issued.",       style: "muted" } },
      { type: "alert", tone: "info",    title: "New version",         message: { type: "text", value: "v8.0.0 is available.",         style: "muted" } },
      // ── COMP-08 EmptyStateNode (RENAMED title/description + NEW icon slot) ──
      // NOTE: `receipt` used (not `inbox` per PATTERNS suggestion) — the
      // shipped IconName union at index.ts:148-178 does not include "inbox";
      // `receipt` fits the "orders" narrative and is the same icon the
      // Showcase (24-06) uses for its empty-state. The icon choice is
      // subordinate to the tripwires — title/description strings are the
      // load-bearing tripwires for the rename cascade.
      {
        type: "empty-state",
        icon: "receipt",
        title: "No orders yet",
        description: "Once customers place orders they'll show up here.",
        action: { type: "button", label: "Learn more", action: { name: "empty-state-cta-probe" } },
      },
    ],
  };

  // v8.0.0 Secondary Composites (COMP-09..COMP-13) — byte-identical to the
  // .NET twin secondaryCompositesSection. Every branch introduced by plans
  // 25-01..05 gets at least one emission here + an expectBodyContains
  // tripwire on the initial GET step, per banked lesson: a diff can only
  // prove things about code it actually RUNS. Fleet-adoption discipline is
  // honored — the composites ship with parity coverage in the same batch
  // (per v5.1 EXTEND pattern; single fixture, appended section).
  //   • COMP-09 (UserRowNode): one with all slots populated (avatar + name +
  //     meta + status:{label:'Online', kind:'online'} + action name
  //     user-row-open-jd) — proves the StatusKind closed enum crosses AND
  //     the action-name walk descends through UserRowNode.action.
  //   • COMP-10 + 10a (DetailRowNode + DetailListNode): one DetailListNode
  //     with labelWidth:'lg' (proves DetailLabelWidth closed enum crosses;
  //     absent case is implicitly proved by other backends) containing three
  //     DetailRowNodes — two neutral + one tone:'danger' (proves the tone
  //     closed union crosses on the row-level).
  //   • COMP-11 + 11a (TimelineEntryNode + TimelineNode): one TimelineNode
  //     containing three TimelineEntryNodes covering danger/warning/success
  //     tones (proves the tone-driven dot-border palette crosses).
  //   • COMP-12 + 12a (SettingRowNode + SettingListNode): one SettingListNode
  //     with heading + two SettingRowNodes — one exercises the
  //     CheckboxNode(variant:'switch') pairing per CONTEXT §9 as the trailing
  //     control; one exercises a ButtonNode trailing with UNIQUE action name
  //     setting-row-configure-digest (proves the action-name walk descends
  //     through SettingRowNode.trailing).
  //   • COMP-13 + 13a (ChipNode + ChipListNode): one ChipListNode containing
  //     four ChipNodes covering the full slot matrix — dismissAction-only
  //     (name chip-remove-filter-active), tone-only, action-only (name
  //     chip-toggle-tag-clickme), and BOTH action+dismissAction (proves the
  //     two ActionEvent slots coexist and each participates in name
  //     uniqueness — UNIQUE names chip-toggle-tag-both + chip-remove-tag-both).
  // NOTE: the CLIENT-SIDE rendering (timeline rail-and-dot ::before mechanism,
  // status-dot palette, chip tinted-pill color-mix palettes, DetailList grid
  // label column, SettingRow trailing-slot vertical centering) is browser-only
  // and NOT part of parity — parity proves only that the fields serialize
  // identically across backends.
  const secondaryCompositesSection: ViewNode = {
    type: "section",
    heading: "v8.0.0 Secondary Composites",
    variant: "card",
    children: [
      // ── COMP-09 UserRowNode (all slots populated) ─────────────────
      // Wrap TextNodes explicitly on the wire so bun matches .NET (which cannot
      // use the `string | ViewNode` TS convenience — same convention as Phase 24
      // primary composites).
      {
        type: "user-row",
        avatar: { type: "avatar", initials: "JD", tone: "info" },
        name: { type: "text", value: "Jane Dougherty", style: "body", weight: "medium" },
        meta: { type: "text", value: "jane.d · SRE Lead", style: "muted" },
        status: { label: "Online", kind: "online" },
        action: { name: "user-row-open-jd" },
      },
      // ── COMP-10 + 10a DetailListNode with DetailRowNodes + labelWidth ──
      {
        type: "detail-list",
        labelWidth: "lg",   // proves the closed enum crosses (not just default/absent)
        children: [
          { type: "detail-row", label: "Status",     value: { type: "text", value: "Open", style: "body" } },
          { type: "detail-row", label: "Assignee",   value: { type: "text", value: "Jane Dougherty", style: "body" } },
          { type: "detail-row", label: "Deleted",    value: { type: "text", value: "purged 2h ago", style: "body" }, tone: "danger" },
        ],
      },
      // ── COMP-11 + 11a TimelineNode with TimelineEntryNodes covering tones ──
      {
        type: "timeline",
        children: [
          { type: "timeline-entry", time: "2:47 PM", description: { type: "text", value: "Incident opened", style: "body" }, tone: "danger" },
          { type: "timeline-entry", time: "2:49 PM", description: { type: "text", value: "Acknowledged by Jane", style: "body" }, tone: "warning" },
          { type: "timeline-entry", time: "2:58 PM", description: { type: "text", value: "Rollback verified", style: "body" }, tone: "success" },
        ],
      },
      // ── COMP-12 + 12a SettingListNode with SettingRowNodes ─────────
      // Exercises the CheckboxNode(variant:"switch") pairing per CONTEXT §9.
      {
        type: "setting-list",
        heading: "Notification preferences",
        children: [
          {
            type: "setting-row",
            label: { type: "text", value: "Email notifications", style: "body", weight: "medium" },
            description: { type: "text", value: "Receive an email for every incident update.", style: "muted" },
            trailing: { type: "checkbox", name: "setting-email", label: "", variant: "switch", bind: "settings.email" },
          },
          {
            type: "setting-row",
            label: { type: "text", value: "Weekly digest", style: "body", weight: "medium" },
            description: { type: "text", value: "A Monday-morning summary of the past week.", style: "muted" },
            trailing: { type: "button", label: "Configure", action: { name: "setting-row-configure-digest" } },
          },
        ],
      },
      // ── COMP-13 + 13a ChipListNode with ChipNodes ─────────────────
      // Proves BOTH dismissAction slot (caller-supplied name, distinct from
      // AlertNode.dismissible's fixed name) AND action slot.
      {
        type: "chip-list",
        children: [
          { type: "chip", label: "active",   tone: "success", dismissAction: { name: "chip-remove-filter-active" } },
          { type: "chip", label: "warning",  tone: "warning" },
          { type: "chip", label: "clickme",  action: { name: "chip-toggle-tag-clickme" } },
          { type: "chip", label: "both",     tone: "info", action: { name: "chip-toggle-tag-both" }, dismissAction: { name: "chip-remove-tag-both" } },
        ],
      },
    ],
  };

  // ── Inline rich text (TextNode.runs) ──
  // Covers the absent-vs-present matrix for every optional on InlineRun, plus the
  // two contract cases that are decisions rather than mechanics:
  //   • runs OMITTED entirely  → proves absent-never-null and that the pre-runs
  //     shape is byte-identical.
  //   • the DELIBERATE DIVERGENCE case → `value` spells the URL out while `runs`
  //     carries a proper link, so link-less adapters still show the target. This
  //     is exactly why value/runs equality is a documented SHOULD and not a
  //     runtime check; shipping it in the reference app makes that decision
  //     visible in code rather than only in a comment.
  // Nothing here is action-bearing — an InlineRun CANNOT carry an action, which
  // is why neither backend's walker needed a new arm. That is the point.
  const richTextSection: ViewNode = {
    type: "section",
    heading: "Inline rich text",
    variant: "card",
    children: [
      // runs OMITTED — absent on the wire, not null.
      { type: "text", value: "Plain paragraph — runs omitted entirely." },
      // The full matrix, in order: bare run (all optionals absent), bold, italic,
      // code, strike, all-four-combined, href WITHOUT external, href WITH external.
      {
        type: "text",
        value: "plain bold italic code struck everything link external",
        runs: [
          { text: "plain " },
          { text: "bold", bold: true },
          { text: " " },
          { text: "italic", italic: true },
          { text: " " },
          { text: "code", code: true },
          { text: " " },
          { text: "struck", strike: true },
          { text: " " },
          { text: "everything", bold: true, italic: true, code: true, strike: true },
          { text: " " },
          { text: "link", href: "https://example.com/docs" },
          { text: " " },
          { text: "external", href: "https://example.com/out", external: true },
        ],
      },
      // Adjacent runs sharing an identical href — the renderer coalesces these
      // into exactly ONE anchor (one tab stop, one screen-reader announcement).
      {
        type: "text",
        value: "see the docs now",
        runs: [
          { text: "see ", href: "https://example.com/docs" },
          { text: "the docs", href: "https://example.com/docs", bold: true },
          { text: " now", href: "https://example.com/docs" },
        ],
      },
      // DELIBERATE DIVERGENCE — value spells the URL out; runs carry the link.
      {
        type: "text",
        value: "Docs: https://example.com/docs",
        runs: [{ text: "Docs: " }, { text: "the docs", href: "https://example.com/docs" }],
      },
    ],
  };

  // Lookup field (LOOK-01/LOOK-06) — the two lookup inputTypes as static
  // view-shape captured by every GET step; byte-identical to the .NET twin
  // lookupSection. Covers the full omitted-vs-present matrix:
  //   lookup-owner  — 🚨 THE HEADLINE: `selected` PRESENT while `candidates` is
  //                   ABSENT. This is the preselected-value/cold-start case that
  //                   kills naive designs — the label renders because it came
  //                   from the NODE, never resolved out of an (empty) candidate
  //                   list. allowCustom is OMITTED (proves the false default is
  //                   ABSENT on the wire, not `false` — the WhenWritingDefault
  //                   posture on the .NET side). Its selected entry carries both
  //                   label and type (the polymorphic-ref tag crosses).
  //   lookup-tag    — allowCustom:true (proves the literal JSON boolean crosses)
  //                   with candidates present, and a selected entry whose `label`
  //                   is OMITTED because it equals `value` — the free-form-tag
  //                   case, and `type` omitted for a monomorphic ref.
  //   lookup-watchers — lookup-multiple with TWO selected entries and a `bind`
  //                   pointing at a string[] in state; carries searchBind plus a
  //                   searchAction whose UNIQUE name lookup-search-probe proves
  //                   the action-name uniqueness walk DESCENDS into
  //                   FieldNode.searchAction (never POSTed by any step — pure
  //                   static wire-shape proof, same convention as the
  //                   axes-noop-* / nba-* / nav-crumb-probe names).
  // The CLIENT-SIDE debounce, popup/listbox, chips, live-region announcements,
  // and the non-blocking lane's coalescing/epoch behavior are browser-only and
  // NOT part of parity — parity proves only that the lookup wire serializes
  // identically across backends.
  const lookupSection: ViewNode = {
    type: "section",
    heading: "Lookup field",
    variant: "card",
    children: [
      {
        type: "field",
        name: "lookup-owner",
        inputType: "lookup",
        bind: "lookupOwner",
        label: "Owner",
        selected: [{ value: "u-1", label: "Ada Lovelace", type: "user" }],
      },
      {
        type: "field",
        name: "lookup-tag",
        inputType: "lookup",
        bind: "lookupTag",
        label: "Tag",
        selected: [{ value: "urgent" }],
        candidates: [{ value: "urgent" }, { value: "blocked" }],
        allowCustom: true,
      },
      {
        type: "field",
        name: "lookup-watchers",
        inputType: "lookup-multiple",
        bind: "lookupWatchers",
        label: "Watchers",
        selected: [
          { value: "u-2", label: "Grace Hopper", type: "user" },
          { value: "t-7", label: "Platform", type: "team" },
        ],
        searchBind: "lookupQuery",
        searchAction: { name: "lookup-search-probe" },
      },
    ],
  };

  return {
    type: "page",
    title: "Feature Probe",
    density: "compact",
    layout: "cards",
    children: [
      probeSection, clickableCardSection, linkedCardSection, rowSection,
      bareRowSection, headerBarSection, axesSection, admin22Section, ...arrangeSections, ...alignSections,
      bareSwitcherSection, ...switcherThresholdSections, switcherLimitSection,
      bareCardsSection, ...cardsMinItemSections,
      fitsAxisOmittedSection, fitsAxisBothSection,
      chartSection,
      childModifiersSection,
      buildTableSection(state),
      formsSection,
      fileNoBindSection,
      feedbackSection,
      fillSection,
      followTailSection,
      blockingSection,
      navSection,
      trackerSection,
      diffSection,
      iconsSection,
      foundationsSection,
      primaryCompositesSection,
      secondaryCompositesSection,
      richTextSection,
      lookupSection,
      probeModal,
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

  if (name === "trigger-toast") {
    // Two toast side-effects in one response: a BARE toast (message only =>
    // tone/durationMs omitted = absent on the wire) and a FULL one (tone +
    // durationMs present). Byte-identical to the .NET twin so parity diffs both.
    return {
      vm: buildVm(state),
      state,
      sideEffects: [
        shellSideEffect.toast("Saved"),
        shellSideEffect.toast("Heads up", { tone: "warning", durationMs: 5000 }),
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
  } else if (name === "table-page-jump") {
    // Renderer wrote the clamped page to tablePage; server re-renders the slice.
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
  } else if (name === "make-invalid-tree") {
    // 3.3.0 (F4) — return a tree with a DUPLICATE action name (two top-level
    // buttons, NOT in a form) so createAction's validateActionNames throws →
    // {ok:false, errors:[{message, code:"invalid_tree"}]} at 500. Parity-covers
    // the invalid_tree wire shape across all backends (previously only
    // parse_error/unknown_action/uncaught_exception were covered).
    return {
      vm: {
        type: "page",
        children: [
          { type: "button", label: "A", action: { name: "dup" } },
          { type: "button", label: "B", action: { name: "dup" } },
        ],
      },
      state,
    };
  } else if (name === "icon-only-invalid") {
    // v7.0.0 (ICON-05 / ICON-09) — return a tree containing an icon-only
    // ButtonNode WITHOUT tooltip so createAction's validateActionNames throws
    // the byte-identical error → {ok:false, errors:[{message:"icon-only
    // ButtonNode requires tooltip (used as aria-label)", code:"invalid_tree"}]}
    // at 500. Parity's byte-diff on the error message across both backends is
    // the proof the two hand-mirrored walker predicates agree — a drift like
    // "icon-only ButtonNode requires Tooltip" (capitalization difference) or a
    // wording tweak on one side would fail the diff loudly.
    return {
      vm: {
        type: "page",
        children: [
          { type: "button", label: "", action: { name: "noop-icon-invalid" }, icon: "trash-2" },
        ],
      },
      state,
    };
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
