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
    key: "name", label: "Name", sortable: true, filterable: true,
  };
  if (state.tableFilters.name.length > 0) nameCol.filterValue = state.tableFilters.name;

  const table: Record<string, unknown> = {
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
    { type: "copy-button", text: "npx @ashley-shrok/viewmodel-shell", label: "Copy install command", copiedLabel: "Copied!", emphasis: "secondary" } as ViewNode,
  );
  children.push({ type: "image", src: "/logo.png", alt: "ViewModel Shell logo", size: "small", shape: "circle" } as ViewNode);
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
      { type: "copy-button", text: "axes-clip", label: "Copy", emphasis: "secondary", tone: "info", size: "sm" },
      { type: "text", value: "tone text", tone: "warning" },
      { type: "text", value: "heading + tone", style: "heading", tone: "danger" },
      { type: "section", heading: "Warning card", variant: "card", tone: "warning", children: [{ type: "text", value: "tinted card surface" }] },
      { type: "section", heading: "Danger band", tone: "danger", children: [{ type: "text", value: "bare tinted section" }] },
      { type: "list", children: [
        { type: "list-item", id: "axes-li-1", state: "active", children: [{ type: "text", value: "active state" }] },
        { type: "list-item", id: "axes-li-2", tone: "danger", children: [{ type: "text", value: "danger tone" }] },
        { type: "list-item", id: "axes-li-3", state: "done", tone: "success", children: [{ type: "text", value: "done + success" }] },
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
    size: "small",
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
        disabled: true },
      { type: "button", label: "Submit (disabled)", action: { name: "fc-submit" },
        emphasis: "primary", disabled: true },
    ],
  };

  // Feedback primitives — BadgeNode + EmptyStateNode (static view-shape captured
  // by every GET step; byte-identical to the .NET twin feedbackSection). A bare
  // badge (NEITHER tone nor emphasis => omitted = absent on the wire), a
  // tone-only badge, a tone+emphasis badge; a bare empty-state (no message/action
  // => omitted = absent), and an empty-state with message + a CTA ButtonNode
  // (proves the action serializes with type:"button" AND the action-name walk
  // descends into empty-state.action on both backends — unique name feedback-cta).
  const feedbackSection: ViewNode = {
    type: "section",
    heading: "Feedback primitives",
    variant: "card",
    children: [
      { type: "badge", label: "New" },
      { type: "badge", label: "3", tone: "danger" },
      { type: "badge", label: "Beta", tone: "info", emphasis: "secondary" },
      { type: "empty-state", heading: "No items yet" },
      {
        type: "empty-state",
        heading: "Nothing here",
        message: "Add the first item.",
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
      childModifiersSection,
      buildTableSection(state),
      formsSection,
      feedbackSection,
      fillSection,
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
