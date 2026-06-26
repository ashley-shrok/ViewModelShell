// Phase 6 — cross-adapter conformance fixtures (the SHARED half).
//
// Goal: prove BrowserAdapter and TuiAdapter render the same *information* for
// the same ViewNode tree — NOT the same bytes/layout. The browser adds DOM
// tags; the TUI adds box-drawing/padding; that difference is presentation, not
// information. So each fixture declares the short, user-visible text tokens
// BOTH adapters must surface; two env-appropriate test files
// (conformance.browser.test.ts in jsdom, conformance.tui.test.ts in node+Ink)
// each assert their adapter surfaces every token. Same fixtures + same
// declared information satisfied independently by both ⇒ information parity.
//
// RULES (load-bearing — heed or the suite false-fails):
//  • Tokens are SHORT single words (no spaces, ≤ ~8 chars). The TUI side uses
//    `renderTree` via ink-testing-library, which renders at Ink's default
//    80 cols where long phrases WRAP and split substring matches (the Phase-1
//    non-TTY width landmine). Single short words are wrap-proof.
//  • Tokens are DISTINCT (no token a substring of another) so presence/order
//    asserts are unambiguous.
//  • Only TEXTUAL information is compared. Visual-only signals are deliberately
//    OUT of scope here (they are presentation, and are covered elsewhere):
//      - progress bar fill, checkbox glyph state  → tui.test.ts
//      - layout/density/variant CSS classes        → theme-modifiers.test.ts
//      - link href / external target               → adapter-internal
//    A fixture therefore declares only what is genuinely shared text.
//  • `ordered: true` ⇒ the tokens must appear in this order in BOTH adapters
//    (list / table / sequential text). Default = presence only.

import type { ViewNode } from "../src/index.js";

export interface ConformanceFixture {
  name: string;
  vm: ViewNode;
  /** Short, distinct, user-visible text tokens both adapters must surface. */
  expect: string[];
  /** When true, `expect` order must be preserved in both renders. */
  ordered?: boolean;
}

export const FIXTURES: ConformanceFixture[] = [
  {
    name: "page title + section heading + every text style",
    ordered: true,
    vm: {
      type: "page",
      title: "Alfa",
      children: [
        {
          type: "section",
          heading: "Bravo",
          children: [
            { type: "text", value: "Charlie", style: "heading" },
            { type: "text", value: "Delta", style: "muted" },
            { type: "text", value: "Echo", tone: "danger" },
            { type: "text", value: "Whiskey", tone: "warning" },
            { type: "text", value: "Foxtrot", style: "strikethrough" },
            { type: "text", value: "Golf", style: "pre" },
          ],
        },
      ],
    },
    expect: ["Alfa", "Bravo", "Charlie", "Delta", "Echo", "Whiskey", "Foxtrot", "Golf"],
  },
  {
    // ImageNode (#5): both adapters must surface the alt text — the browser via
    // the <img alt> attribute, the TUI by degrading to it. src/size/shape are
    // layout/fetch concerns, not surfaced information, so they're not asserted.
    name: "image node — alt surfaces on both adapters",
    ordered: true,
    vm: {
      type: "page",
      title: "Mike",
      children: [
        {
          type: "section",
          heading: "November",
          children: [
            { type: "image", src: "/logo.png", alt: "Oscar", size: "medium" },
            { type: "image", src: "/avatar.png", alt: "Papa", size: "small", shape: "circle" },
          ],
        },
      ],
    },
    expect: ["Mike", "November", "Oscar", "Papa"],
  },
  {
    name: "list + list-item variants (order preserved)",
    ordered: true,
    vm: {
      type: "list",
      children: [
        { type: "list-item", children: [{ type: "text", value: "Hotel" }] },
        { type: "list-item", state: "done", children: [{ type: "text", value: "India" }] },
        { type: "list-item", state: "active", children: [{ type: "text", value: "Juliet" }] },
      ],
    },
    expect: ["Hotel", "India", "Juliet"],
  },
  {
    name: "button variants",
    vm: {
      type: "section",
      children: [
        { type: "button", label: "Kilo", action: { name: "a" } },
        { type: "button", label: "Lima", action: { name: "b" }, emphasis: "primary" },
        { type: "button", label: "Mike", action: { name: "c" }, tone: "danger" },
      ],
    },
    expect: ["Kilo", "Lima", "Mike"],
  },
  {
    name: "external link (label is the shared info; href is presentation)",
    vm: { type: "link", label: "Oscar", href: "https://example.com/papa", external: true },
    expect: ["Oscar"],
  },
  {
    name: "tabs (labels)",
    vm: {
      type: "tabs",
      selected: "r",
      bind: "tab",
      tabs: [
        { value: "r", label: "Romeo", action: { name: "select-tab-r" } },
        { value: "s", label: "Sierra", action: { name: "select-tab-s" } },
      ],
    },
    expect: ["Romeo", "Sierra"],
  },
  {
    name: "stat-bar (label + value, incl. numeric)",
    vm: {
      type: "stat-bar",
      stats: [
        { label: "Tango", value: "Uniform" },
        { label: "Victor", value: 7 },
      ],
    },
    expect: ["Tango", "Uniform", "Victor", "7"],
  },
  {
    name: "checkbox label (glyph/checked is presentation)",
    vm: { type: "checkbox", name: "x", bind: "x", label: "Whiskey", action: { name: "t" } },
    expect: ["Whiskey"],
  },
  {
    name: "copy-button label",
    vm: { type: "copy-button", text: "payload", label: "Yankee" },
    expect: ["Yankee"],
  },
  {
    name: "table (headers then cells, order preserved)",
    ordered: true,
    vm: {
      type: "table",
      columns: [
        { key: "a", label: "Xray" },
        { key: "b", label: "Zulu" },
      ],
      rows: [
        { cells: { a: "Alfa1", b: "Bravo1" } },
        { cells: { a: "Echo1", b: "Golf1" } },
      ],
    },
    expect: ["Xray", "Zulu", "Alfa1", "Bravo1", "Echo1", "Golf1"],
  },
  {
    // 0.12.0 (#16): selection + pagination. Selection glyph state is presentation
    // (out of scope here — see rules); what's SHARED text is the cells/headers
    // plus the pagination controls. "Prev"/"Next" are wrap-proof single words
    // both adapters surface (browser button textContent; TUI <text>).
    name: "table with pagination (controls surface on both)",
    ordered: true,
    vm: {
      type: "table",
      columns: [
        { key: "a", label: "Sierra3" },
        { key: "b", label: "Tango3" },
      ],
      rows: [
        { id: "r1", cells: { a: "Uniform3", b: "Victor3" } },
        { id: "r2", cells: { a: "Whiskey3", b: "Xray3" } },
      ],
      paginationBind: "page",
      pagination: {
        page: 1,
        pageSize: 2,
        totalRows: 6,
        prevAction: { name: "page-prev" },
        nextAction: { name: "page-next" },
      },
    },
    expect: ["Sierra3", "Tango3", "Uniform3", "Victor3", "Whiskey3", "Xray3", "Prev", "Next"],
  },
  {
    name: "modal (title + body + footer button)",
    vm: {
      type: "modal",
      title: "Quebec",
      children: [{ type: "text", value: "Romeo2" }],
      footer: [{ type: "button", label: "Sierra2", action: { name: "close" } }],
      dismissAction: { name: "x" },
    },
    expect: ["Quebec", "Romeo2", "Sierra2"],
  },
  {
    // Phase 6: input values now live in state at the bind path, not on the
    // node. The browser-side test passes the values via stateAccess on the
    // render call. TUI-side has no stateAccess yet (TODO Phase 7) — the
    // fixture's expected tokens are loosened to "labels only" to keep
    // information parity meaningful.
    name: "form + single-line fields (labels)",
    vm: {
      type: "form",
      submitAction: { name: "save" },
      submitLabel: "Tango2",
      children: [
        { type: "field", name: "f1", inputType: "text", label: "Uniform2", bind: "f1" },
        { type: "field", name: "f2", inputType: "text", label: "Whiskey2", bind: "f2" },
      ],
    },
    expect: ["Uniform2", "Whiskey2", "Tango2"],
  },
  {
    // 1.11.0 — layout:"row" section (the cluster primitive). Both adapters must
    // surface the row's heading + items. Layout is presentation; the INFORMATION
    // is shared, which is the conformance contract.
    name: "row layout section (heading + items surface on both)",
    vm: {
      type: "page",
      title: "Yankee2",
      children: [
        {
          type: "section",
          heading: "Zulu2",
          layout: "row",
          children: [
            { type: "link", label: "Alfa3", href: "/a", external: false },
            { type: "link", label: "Bravo3", href: "/b", external: false },
          ],
        },
      ],
    },
    expect: ["Yankee2", "Zulu2", "Alfa3", "Bravo3"],
  },
];
