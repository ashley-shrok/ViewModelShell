import "@ashley-shrok/viewmodel-shell/styles.css";
// All theme files inlined here. Apps would normally pick one and import it
// statically; the showcase swaps at runtime via a single injected style tag.
import darkPurpleCss  from "@ashley-shrok/viewmodel-shell/themes/dark-purple.css?inline";
import darkBlueCss    from "@ashley-shrok/viewmodel-shell/themes/dark-blue.css?inline";
import darkGreenCss   from "@ashley-shrok/viewmodel-shell/themes/dark-green.css?inline";
import darkRoseCss    from "@ashley-shrok/viewmodel-shell/themes/dark-rose.css?inline";
import darkAmberCss   from "@ashley-shrok/viewmodel-shell/themes/dark-amber.css?inline";
import darkTealCss    from "@ashley-shrok/viewmodel-shell/themes/dark-teal.css?inline";
import lightPurpleCss from "@ashley-shrok/viewmodel-shell/themes/light-purple.css?inline";
import lightBlueCss   from "@ashley-shrok/viewmodel-shell/themes/light-blue.css?inline";
import lightGreenCss  from "@ashley-shrok/viewmodel-shell/themes/light-green.css?inline";
import lightRoseCss   from "@ashley-shrok/viewmodel-shell/themes/light-rose.css?inline";
import lightAmberCss  from "@ashley-shrok/viewmodel-shell/themes/light-amber.css?inline";
import lightTealCss   from "@ashley-shrok/viewmodel-shell/themes/light-teal.css?inline";
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";
import type { ViewNode, ActionEvent, StateAccess } from "@ashley-shrok/viewmodel-shell";

// Phase 6 (WIRE-07): the Showcase has no backend; it drives the BrowserAdapter
// directly without a ViewModelShell. To honor the new renderer contract
// (Adapter.render expects a third stateAccess arg), we supply a minimal
// readPath/writePath closure backed by the local `state` object and re-render
// on every write. Action handlers no longer read `action.context`; per-row
// identity (the catalog item id) is encoded in the action name itself.

// ── State ────────────────────────────────────────────────────────────────
type Mode = "dark" | "light";
type Accent = "purple" | "blue" | "green" | "rose" | "amber" | "teal";
type View = "components" | "layouts" | "dashboard" | "form" | "list-detail";

interface SortIntent {
  column: string;
  direction: "asc" | "desc";
}

interface State {
  view:          View;
  modalShown:    boolean;
  agreeChecked:  boolean;
  selectedTab:   string;
  sortIntent:    SortIntent;
  filters:       Record<string, string>;
  mode:          Mode;
  accent:        Accent;
  selectedItemId: string;
  // Phase 6 — bind slots for each input in the gallery's form sections.
  formInputs: Record<string, unknown>;
}

let state: State = {
  view:          "components",
  modalShown:    true,
  agreeChecked:  false,
  selectedTab:   "active",
  sortIntent:    { column: "name", direction: "asc" },
  filters:       { name: "", status: "" },
  mode:          "light",
  accent:        "purple",
  selectedItemId: "lp-01",
  formInputs: {
    text: "",
    email: "",
    password: "",
    number: "",
    date: "2026-04-28",
    time: "14:30",
    datetime: "2026-04-28T14:30",
    textarea: "",
    select: "b",
    multi: "a,c",
    subscribe: "true",
    file: null,
    query: "select id, title, status\nfrom tickets\nwhere priority in ('high', 'critical')\norder by created_at desc;",
    // Checkout (form view)
    fullName: "", email_co: "", phone: "",
    address1: "", address2: "", city: "", country: "us", zip: "",
    cardName: "", cardNumber: "", cardExpiry: "", cardCvv: "",
  },
};

// ── Bind-path walk (mirrors viewmodel-shell/src/index.ts; ~20 lines) ─────
function isUnsafeSegment(seg: string): boolean {
  return seg === "__proto__" || seg === "constructor" || seg === "prototype";
}
function readPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const segs = path.split(".");
  let cur: unknown = obj;
  for (const seg of segs) {
    if (isUnsafeSegment(seg)) return undefined;
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      if (!Number.isInteger(idx) || idx < 0) return undefined;
      cur = cur[idx];
    } else if (typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[seg];
    } else return undefined;
  }
  return cur;
}
function writePath(obj: unknown, path: string, value: unknown): unknown {
  if (!path) return value;
  const segs = path.split(".");
  for (const seg of segs) {
    if (isUnsafeSegment(seg)) return obj;
  }
  let root: unknown = obj ?? {};
  let cur: unknown = root;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!;
    const o = cur as Record<string, unknown>;
    let nxt = o[seg];
    if (nxt == null || typeof nxt !== "object") {
      nxt = {};
      o[seg] = nxt;
    }
    cur = nxt;
  }
  (cur as Record<string, unknown>)[segs[segs.length - 1]!] = value;
  return root;
}

// ── Theme switching (gallery view only — D-14) ───────────────────────────
const themeStyle = document.createElement("style");
themeStyle.id = "vms-showcase-theme";
document.head.appendChild(themeStyle);

const themeFiles: Record<string, string> = {
  "dark-purple":  darkPurpleCss,
  "dark-blue":    darkBlueCss,
  "dark-green":   darkGreenCss,
  "dark-rose":    darkRoseCss,
  "dark-amber":   darkAmberCss,
  "dark-teal":    darkTealCss,
  "light-purple": lightPurpleCss,
  "light-blue":   lightBlueCss,
  "light-green":  lightGreenCss,
  "light-rose":   lightRoseCss,
  "light-amber":  lightAmberCss,
  "light-teal":   lightTealCss,
};

function applyTheme() {
  const key = `${state.mode}-${state.accent}`;
  themeStyle.textContent = themeFiles[key] ?? "";
}

// ── Source data for the table (filtered/sorted on render) ────────────────
const allRows: Array<{
  id: string; name: string; status: string; url: string;
  state?: string; tone?: "danger" | "warning" | "success" | "info";
}> = [
  { id: "1", name: "Alpha",   status: "open",        url: "https://example.com/1" },
  { id: "2", name: "Bravo",   status: "in-progress", url: "https://example.com/2", tone: "warning" },
  { id: "3", name: "Charlie", status: "resolved",    url: "https://example.com/3", state: "done" },
  { id: "4", name: "Delta",   status: "blocked",     url: "https://example.com/4", tone: "danger" },
];

function visibleRows() {
  const f = state.filters;
  const filtered = allRows.filter(r =>
    (!f.name   || r.name.toLowerCase().includes(f.name.toLowerCase())) &&
    (!f.status || r.status.toLowerCase().includes(f.status.toLowerCase()))
  );
  const dir = state.sortIntent.direction === "asc" ? 1 : -1;
  return [...filtered].sort((a, b) => {
    const av = (a as any)[state.sortIntent.column] ?? "";
    const bv = (b as any)[state.sortIntent.column] ?? "";
    return av < bv ? -1 * dir : av > bv ? 1 * dir : 0;
  });
}

// ── Catalog data for the List/detail archetype ───────────────────────────
interface CatalogItem {
  id: string;
  title: string;
  artist: string;
  year: string;
  price: string;
  tracks: string;
  blurb: string;
}

const catalog: CatalogItem[] = [
  { id: "lp-01", title: "Midnight Architecture", artist: "Aria Voss",        year: "2024", price: "$18.00", tracks: "11 tracks · 47 min", blurb: "A slow-build ambient record recorded in a converted water tower; the title track loops a single piano figure for nine minutes." },
  { id: "lp-02", title: "Concrete Garden",       artist: "The Foundry",      year: "2023", price: "$16.50", tracks: "9 tracks · 38 min",  blurb: "Post-rock quartet's third album — heavier low end, fewer crescendos, more space between the notes." },
  { id: "lp-03", title: "Paper Satellites",      artist: "Lune et Or",       year: "2025", price: "$20.00", tracks: "12 tracks · 52 min", blurb: "Franco-synth duo's breakout; every track was tracked to tape then resampled through a broken cassette deck." },
  { id: "lp-04", title: "Lowtide Signals",       artist: "Harbor Theory",    year: "2022", price: "$14.00", tracks: "8 tracks · 33 min",  blurb: "Field recordings from three coastlines layered under a baritone guitar. Quiet, patient, tidal." },
  { id: "lp-05", title: "Glass Cartography",     artist: "Nilufar",          year: "2024", price: "$19.00", tracks: "10 tracks · 44 min", blurb: "Iranian-Canadian composer mapping santur against modular synthesis — the most-requested record in the catalog." },
  { id: "lp-06", title: "After the Carrier",     artist: "Slow Pulse Choir", year: "2021", price: "$15.50", tracks: "7 tracks · 29 min",  blurb: "A cappella reworkings of shortwave numbers stations. Stranger and warmer than it sounds." },
];

function selectedItem(): CatalogItem {
  return catalog.find(c => c.id === state.selectedItemId) ?? catalog[0]!;
}

// ── The runtime theme switcher section (D-06/D-14) ───────────────────────
function themeSwitcherSection(): ViewNode[] {
  if (state.view !== "components") return [];
  return [
    { type: "section", heading: "Theme", children: [
      { type: "tabs", selected: state.mode, bind: "mode", tabs: [
        { value: "dark",  label: "Dark",  action: { name: "theme:mode:dark"  } },
        { value: "light", label: "Light", action: { name: "theme:mode:light" } },
      ]},
      { type: "tabs", selected: state.accent, bind: "accent", tabs: [
        { value: "purple", label: "Purple", action: { name: "theme:accent:purple" } },
        { value: "blue",   label: "Blue",   action: { name: "theme:accent:blue"   } },
        { value: "green",  label: "Green",  action: { name: "theme:accent:green"  } },
        { value: "rose",   label: "Rose",   action: { name: "theme:accent:rose"   } },
        { value: "amber",  label: "Amber",  action: { name: "theme:accent:amber"  } },
        { value: "teal",   label: "Teal",   action: { name: "theme:accent:teal"   } },
      ]},
      { type: "text", value: "Mode × accent gives 12 themes. Apps pick one with a single import — the showcase combines them at runtime so you can sample them all. The switcher is scoped to this gallery; the archetype views render the fixed shipped light default.", style: "muted" },
    ]},
  ];
}

function componentsView(): ViewNode[] {
  return [
    ...themeSwitcherSection(),

    { type: "section", heading: "Text styles", children: [
      { type: "text", value: "Heading text",    style: "heading" },
      { type: "text", value: "Subheading text", style: "subheading" },
      { type: "text", value: "Body line one\nBody line two with longer prose to demonstrate line height.", style: "body" },
      { type: "text", value: "Muted secondary information",  style: "muted" },
      { type: "text", value: "Strikethrough completed item", style: "strikethrough" },
      { type: "text", value: "Error message text",           tone: "danger" },
      { type: "text", value: "Warning advisory text",         tone: "warning" },
      { type: "text", value: "$ vms render --verbose\n  ok page\n  ok section\n  ok list (3 items)\n  ok button x2", style: "pre" },
    ]},

    { type: "section", heading: "Stat bar", children: [
      { type: "stat-bar", stats: [
        { label: "active",    value: 12 },
        { label: "completed", value: 38 },
        { label: "remaining", value: "$420.50" },
      ]},
    ]},

    { type: "section", heading: "Image", layout: "split", children: [
      { type: "image", src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%237c5cff'/%3E%3C/svg%3E", alt: "Sample avatar", size: "small", shape: "circle" },
      { type: "image", src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90'%3E%3Crect width='160' height='90' fill='%2310b981'/%3E%3C/svg%3E", alt: "Sample banner", size: "large" },
    ]},

    { type: "section", heading: "Buttons — three orthogonal axes", children: [
      { type: "text", value: "emphasis (how loud) × tone (what it means) × size (geometry). They compose: a destructive primary CTA is emphasis:\"primary\" + tone:\"danger\". Crucially, tone and emphasis NEVER change size — only the size axis does, so a Default and a Danger button below are exactly the same size.", style: "muted" },
      { type: "text", value: "emphasis", style: "subheading" },
      { type: "section", layout: "row", children: [
        { type: "button", label: "Default",   action: { name: "noop-default"   } },
        { type: "button", label: "Primary",   action: { name: "noop-primary"   }, emphasis: "primary" },
        { type: "button", label: "Secondary", action: { name: "noop-secondary" }, emphasis: "secondary" },
      ]},
      { type: "text", value: "tone (neutral emphasis)", style: "subheading" },
      { type: "section", layout: "row", children: [
        { type: "button", label: "Danger",  action: { name: "noop-t-danger"  }, tone: "danger" },
        { type: "button", label: "Warning", action: { name: "noop-t-warning" }, tone: "warning" },
        { type: "button", label: "Success", action: { name: "noop-t-success" }, tone: "success" },
        { type: "button", label: "Info",    action: { name: "noop-t-info"    }, tone: "info" },
      ]},
      { type: "text", value: "emphasis × tone (filled / outlined in the tone color)", style: "subheading" },
      { type: "section", layout: "row", children: [
        { type: "button", label: "Primary · Danger",   action: { name: "noop-pd" }, emphasis: "primary",   tone: "danger" },
        { type: "button", label: "Secondary · Danger", action: { name: "noop-sd" }, emphasis: "secondary", tone: "danger" },
        { type: "button", label: "Primary · Success",  action: { name: "noop-ps" }, emphasis: "primary",   tone: "success" },
      ]},
      { type: "text", value: "size (sm / md=default / lg) — the ONLY axis that changes box metrics", style: "subheading" },
      { type: "section", layout: "row", children: [
        { type: "button", label: "Small",   action: { name: "noop-sm" }, emphasis: "primary", size: "sm" },
        { type: "button", label: "Medium",  action: { name: "noop-md" }, emphasis: "primary" },
        { type: "button", label: "Large",   action: { name: "noop-lg" }, emphasis: "primary", size: "lg" },
      ]},
    ]},

    { type: "section", heading: "Status surfaces (section tone)", children: [
      { type: "text", value: "A section's `tone` tints the whole surface (orthogonal to variant:\"card\") — for status dashboards where an unhealthy tile should read at a glance, not via one small line of text. Composes with the cards layout.", style: "muted" },
      { type: "section", layout: "cards", minItem: "sm", children: [
        { type: "section", variant: "card", children: [
          { type: "text", value: "Sentinel A", style: "subheading" },
          { type: "text", value: "all checks passing", style: "muted" },
        ]},
        { type: "section", variant: "card", tone: "success", children: [
          { type: "text", value: "Sentinel B", style: "subheading" },
          { type: "text", value: "healthy", style: "muted" },
        ]},
        { type: "section", variant: "card", tone: "warning", children: [
          { type: "text", value: "Sentinel C", style: "subheading" },
          { type: "text", value: "latency elevated", style: "muted" },
        ]},
        { type: "section", variant: "card", tone: "danger", children: [
          { type: "text", value: "Sentinel D", style: "subheading" },
          { type: "text", value: "DOWN — 3 failed probes", style: "muted" },
        ]},
      ]},
    ]},

    { type: "section", heading: "Copy button (clipboard, no dispatch)", children: [
      { type: "copy-button", text: "npx @ashley-shrok/viewmodel-shell", label: "Copy install command", copiedLabel: "Copied!" },
      { type: "copy-button", text: "console.log('hello from CopyButtonNode')" },
    ]},

    { type: "section", heading: "Links", children: [
      { type: "link", label: "Internal link to a doc", href: "#docs" },
      { type: "link", label: "External (opens new tab)", href: "https://example.com", external: true },
    ]},

    { type: "section", heading: "Tabs and progress", children: [
      { type: "tabs", selected: state.selectedTab, bind: "selectedTab", tabs: [
        { value: "all",       label: "All",       action: { name: "tab:set:all"       } },
        { value: "active",    label: "Active",    action: { name: "tab:set:active"    } },
        { value: "completed", label: "Completed", action: { name: "tab:set:completed" } },
      ]},
      { type: "progress", value: 67 },
    ]},

    { type: "section", heading: "Form inputs", children: [
      { type: "form",
        submitAction: { name: "submit-showcase" },
        submitLabel:  "Submit",
        children: [
          { type: "field", name: "text",     inputType: "text",            bind: "formInputs.text",     label: "Text",        placeholder: "Type something" },
          { type: "field", name: "email",    inputType: "email",           bind: "formInputs.email",    label: "Email",       placeholder: "you@example.com" },
          { type: "field", name: "password", inputType: "password",        bind: "formInputs.password", label: "Password",    placeholder: "••••••••" },
          { type: "field", name: "number",   inputType: "number",          bind: "formInputs.number",   label: "Number",      placeholder: "0" },
          { type: "field", name: "date",     inputType: "date",            bind: "formInputs.date",     label: "Date" },
          { type: "field", name: "time",     inputType: "time",            bind: "formInputs.time",     label: "Time" },
          { type: "field", name: "datetime", inputType: "datetime-local",  bind: "formInputs.datetime", label: "Date + Time" },
          { type: "field", name: "textarea", inputType: "textarea",        bind: "formInputs.textarea", label: "Textarea",    placeholder: "Multi-line input…" },
          { type: "field", name: "select",   inputType: "select",          bind: "formInputs.select",   label: "Select", options: [
              { value: "a", label: "Option A" },
              { value: "b", label: "Option B" },
              { value: "c", label: "Option C" },
          ]},
          { type: "field", name: "multi",    inputType: "select-multiple", bind: "formInputs.multi",    label: "Select multiple", options: [
              { value: "a", label: "Apple"  },
              { value: "b", label: "Banana" },
              { value: "c", label: "Cherry" },
          ]},
          { type: "field", name: "subscribe",inputType: "checkbox",        bind: "formInputs.subscribe", label: "Form-collected checkbox (FieldNode)" },
          { type: "field", name: "file",     inputType: "file",            bind: "formInputs.file",      label: "File upload" },
          { type: "field", name: "query",    inputType: "code",            bind: "formInputs.query",     label: "Code (SQL)", language: "sql" },
        ],
      },
    ]},

    { type: "section", heading: "Checkbox (immediate dispatch)", children: [
      { type: "checkbox", name: "agree", bind: "agreeChecked",
        label: "Agree to terms (CheckboxNode — fires action on toggle)",
        action: { name: "agree:toggle" } },
      { type: "text", value: "Click toggles via the action. The form-collected variant above lives inside the form and rides along with submit.", style: "muted" },
    ]},

    { type: "section", heading: "List with variants", children: [
      { type: "list", children: [
        { type: "list-item", children: [
          { type: "text", value: "Default item",       style: "subheading" },
          { type: "text", value: "no variant set",     style: "muted" },
          { type: "button", label: "Delete", action: { name: "noop-list-delete-default" }, tone: "danger" },
        ]},
        { type: "list-item", tone: "danger", children: [
          { type: "text", value: "Critical item",      style: "subheading" },
          { type: "text", value: "list-item--critical · red",    style: "muted" },
        ]},
        { type: "list-item", state: "high", children: [
          { type: "text", value: "High-priority item", style: "subheading" },
          { type: "text", value: "list-item--high · orange",     style: "muted" },
        ]},
        { type: "list-item", tone: "warning", children: [
          { type: "text", value: "Warning item",       style: "subheading" },
          { type: "text", value: "list-item--warning · yellow",  style: "muted" },
        ]},
        { type: "list-item", tone: "success", children: [
          { type: "text", value: "Success item",       style: "subheading" },
          { type: "text", value: "list-item--success · green",   style: "muted" },
        ]},
        { type: "list-item", tone: "info", children: [
          { type: "text", value: "Info item",          style: "subheading" },
          { type: "text", value: "list-item--info · blue",       style: "muted" },
        ]},
        { type: "list-item", state: "done", children: [
          { type: "text", value: "Completed item",     style: "subheading" },
          { type: "text", value: "list-item--done",    style: "muted" },
        ]},
      ]},
    ]},

    { type: "section", heading: "Table", children: [
      { type: "text", value: "Click sortable headers to sort. Type in a column filter and press Enter.", style: "muted" },
      { type: "table",
        columns: [
          { key: "id",     label: "ID",     sortable: true },
          { key: "name",   label: "Name",   sortable: true,  filterable: true, filterValue: state.filters.name },
          { key: "status", label: "Status", filterable: true, filterValue: state.filters.status },
          { key: "url",    label: "Link",   linkLabel: "open", linkExternal: true },
        ],
        rows: visibleRows().map(r => ({
          id: r.id,
          cells: { id: r.id, name: r.name, status: r.status, url: r.url },
          state: r.state,
          tone: r.tone,
        })),
        sortBind: "sortIntent",
        filterBinds: { name: "filters.name", status: "filters.status" },
        sortActions: {
          id:     { name: "table:sort:id" },
          name:   { name: "table:sort:name" },
          status: { name: "table:sort:status" },
        },
        filterAction: { name: "table:filter" },
      },
    ]},

    { type: "section", heading: "Modal", children: [
      { type: "text", value: "Cancel/Delete forever/the X all dismiss it. Use the button below to reopen.", style: "muted" },
      { type: "button", label: "Open modal", action: { name: "modal:open" }, emphasis: "primary" },
    ]},

    ...(state.modalShown ? [{
      type: "modal" as const,
      title: "Confirm action",
      dismissAction: { name: "modal:dismiss" },
      children: [
        { type: "text" as const, value: "Are you sure you want to delete this item? This cannot be undone.", style: "body" as const },
      ],
      footer: [
        { type: "button" as const, label: "Cancel",         action: { name: "modal:dismiss:cancel" } },
        { type: "button" as const, label: "Delete forever", action: { name: "modal:dismiss:confirm" }, tone: "danger" as const },
      ],
    }] : []),
  ];
}

// ── Layouts review surface (DEMO-01) ─────────────────────────────────────
// A dedicated, well-labeled review surface for EVERY layout primitive built
// this milestone (arrange/align, the header-bar, switcher, cards minItem,
// fits). Each primitive is on its own with a heading + a one-line muted
// caption saying what to look for. Built ONLY from ViewNodes — zero app CSS.
// The pre-existing presets (stack/split/cards/sidebar/row) are demonstrated in
// their archetype views (Dashboard / List-detail) and not duplicated here.
function layoutsView(): ViewNode[] {
  return [
    { type: "text", value: "Layout primitives", style: "heading" },
    { type: "text", value: "Every layout primitive built this milestone, each on its own and labeled. A few are responsive — resize the browser window to exercise the flip/selection (noted per item). Built only from ViewNodes — zero app CSS.", style: "muted" },

    // ── arrange (main-axis arrangement → justify-content) ────────────────
    { type: "section", heading: "Main-axis arrangement (arrange)", children: [
      { type: "text", value: "On a layout:\"row\", `arrange` distributes children along the main axis (maps to justify-content). One row per value below — watch where the three links pack.", style: "muted" },
      ...(["start", "center", "end", "space-between", "space-around", "space-evenly"] as const).flatMap(v => [
        { type: "text" as const, value: `arrange: "${v}"`, style: "muted" as const },
        { type: "section" as const, layout: "row" as const, arrange: v, children: [
          { type: "link" as const, label: "one",   href: "#" },
          { type: "link" as const, label: "two",   href: "#" },
          { type: "link" as const, label: "three", href: "#" },
        ]},
      ]),
    ]},

    // ── align (cross-axis alignment → align-items) ───────────────────────
    { type: "section", heading: "Cross-axis alignment (align)", children: [
      { type: "text", value: "On a layout:\"row\", `align` positions children across the CROSS axis (maps to align-items). Each row pairs a TALL card (heading + two body lines) with a SHORT card (one line) so the effect is obvious: start = short card pinned to the top, center = middle, end = bottom, stretch = short card grows to the tall card's height, baseline = the two headings' text baselines line up. The card borders make each position visible.", style: "muted" },
      ...(["start", "center", "end", "stretch", "baseline"] as const).flatMap(v => [
        { type: "text" as const, value: `align: "${v}"`, style: "muted" as const },
        { type: "section" as const, layout: "row" as const, align: v, children: [
          { type: "section" as const, variant: "card" as const, children: [
            { type: "text" as const, value: "Tall card", style: "heading" as const },
            { type: "text" as const, value: "A second line of body text", style: "body" as const },
            { type: "text" as const, value: "and a third line, making it tall", style: "body" as const },
          ]},
          { type: "section" as const, variant: "card" as const, children: [
            { type: "text" as const, value: "Short card", style: "heading" as const },
          ]},
        ]},
      ]),
    ]},

    // ── header-bar (the canonical ALIGN-04 composition) ──────────────────
    { type: "section", heading: "Header bar (row + arrange:\"space-between\")", children: [
      { type: "text", value: "The canonical app header: a layout:\"row\" with arrange:\"space-between\" whose FIRST child is a heading TextNode (NOT the section heading) and whose second child is a nested row nav cluster — title pinned left, nav pinned right, with zero app CSS. The current page is marked with link.active (\"you are here\"): a solid underline + heavier weight, plus aria-current=\"page\" for screen readers. active is SERVER-owned — the backend decides which item is current from its route/state, there is no client-side route matching.", style: "muted" },
      { type: "section", layout: "row", arrange: "space-between", align: "center", children: [
        { type: "text", value: "Acme Console", style: "heading" },
        { type: "section", layout: "row", children: [
          { type: "link", label: "Dashboard", href: "#dashboard", active: true },
          { type: "link", label: "Reports",   href: "#reports" },
          { type: "link", label: "Settings",  href: "#settings" },
        ]},
      ]},
    ]},

    // ── switcher (atomic row ↔ stack flip) ───────────────────────────────
    { type: "section", heading: "Switcher (atomic row ↔ stack flip)", children: [
      { type: "text", value: "RESIZE THE WINDOW past ~768px wide: these 4 equal cards sit in ONE row above the threshold and ALL stack below it — never a partial 2-then-1 intermediate state (that atomic flip is the distinction from `cards` auto-fit). This one uses threshold:\"xl\" (48rem ≈ 768px) so the flip happens at a comfortable desktop width — narrow the window past roughly half-screen to see it.", style: "muted" },
      { type: "section", layout: "switcher", threshold: "xl", children: [
        ...(["One", "Two", "Three", "Four"] as const).map(label => (
          { type: "section" as const, variant: "card" as const, children: [
            { type: "text" as const, value: label, style: "heading" as const },
          ]}
        )),
      ]},
      { type: "text", value: "threshold: \"lg\" (40rem ≈ 640px) — the SAME 4 cards, flipping at a narrower width, so they stay in a row a bit longer as you shrink. (Tokens: sm 20rem / md 30rem[default] / lg 40rem / xl 48rem.)", style: "muted" },
      { type: "section", layout: "switcher", threshold: "lg", children: [
        ...(["One", "Two", "Three", "Four"] as const).map(label => (
          { type: "section" as const, variant: "card" as const, children: [
            { type: "text" as const, value: label, style: "heading" as const },
          ]}
        )),
      ]},
      { type: "text", value: "limit: 3 — a count cap: with 5 children exceeding the limit, EVERY child goes full-width (all-stack) regardless of how wide the container is.", style: "muted" },
      { type: "section", layout: "switcher", limit: 3, children: [
        ...(["One", "Two", "Three", "Four", "Five"] as const).map(label => (
          { type: "section" as const, variant: "card" as const, children: [
            { type: "text" as const, value: label, style: "heading" as const },
          ]}
        )),
      ]},
    ]},

    // ── cards minItem (auto-fit min track width) ─────────────────────────
    { type: "section", heading: "Cards minItem (auto-fit min track width)", children: [
      { type: "text", value: "The SAME auto-fit cards grid at three minItem tokens side by side — smaller = more, narrower columns; larger = fewer, wider. RESIZE THE WINDOW: each grid passes through intermediate column counts and collapses to one column intrinsically as the container narrows (the auto-fit behavior switcher does NOT have).", style: "muted" },
      ...(["xs", "md", "xl"] as const).flatMap(v => [
        { type: "text" as const, value: `minItem: "${v}"`, style: "muted" as const },
        { type: "section" as const, layout: "cards" as const, minItem: v, children: [
          ...(["A", "B", "C", "D", "E", "F"] as const).map(label => (
            { type: "section" as const, variant: "card" as const, children: [
              { type: "text" as const, value: label, style: "heading" as const },
            ]}
          )),
        ]},
      ]),
    ]},

    // ── fits (SwiftUI ViewThatFits — measured client-side selection) ─────
    { type: "section", heading: "Fits (responsive selection)", children: [
      { type: "text", value: "RESIZE THE WINDOW: the renderer MEASURES the toolbar's intrinsic width and picks the FIRST candidate that fits, else the next, with the LAST as the guaranteed-fits fallback. When there's room the full single-row toolbar shows; once it would no longer fit on one line, the whole thing switches to the compact stacked menu — no @media, no app code (the ONE layout primitive that is not pure CSS — selection is measured client-side). The toolbar is deliberately wide, so the switch happens at a comfortable desktop width.", style: "muted" },
      { type: "fits", children: [
        // preferred / widest FIRST — a wide single-row toolbar (long enough
        // that its intrinsic width exceeds a partial-width window).
        { type: "section", layout: "row", children: [
          { type: "link", label: "New Document",   href: "#" },
          { type: "link", label: "Open Recent",    href: "#" },
          { type: "link", label: "Save As…",       href: "#" },
          { type: "link", label: "Export to PDF",  href: "#" },
          { type: "link", label: "Share a Link",   href: "#" },
          { type: "link", label: "Print Preview",  href: "#" },
          { type: "link", label: "Preferences",    href: "#" },
        ]},
        // safe-fallback / narrowest LAST — the same actions, stacked.
        { type: "section", layout: "stack", children: [
          { type: "link", label: "New Document",   href: "#" },
          { type: "link", label: "Open Recent",    href: "#" },
          { type: "link", label: "Save As…",       href: "#" },
          { type: "link", label: "Export to PDF",  href: "#" },
          { type: "link", label: "Share a Link",   href: "#" },
          { type: "link", label: "Print Preview",  href: "#" },
          { type: "link", label: "Preferences",    href: "#" },
        ]},
      ]},
    ]},

    // ── chart (bar) — VMS's first data-viz primitive ─────────────────────
    // A ChartNode is STRUCTURED data (labelled categories × numeric values)
    // drawn as a single-series bar chart by Chart.js — a PRIVATE, lazy, optional
    // dep of the browser adapter (apps NEVER touch Chart.js). The app ships only
    // the data: `points` + an optional `title` + a `tone` from the tone axis. No
    // chart library import, no CSS. Real bars/colors are the Phase-13 pixel review.
    { type: "section", heading: "Chart (bar)", children: [
      { type: "text", value: "A `chart` node is bounded declared data — labelled categories × numeric values — an agent reads directly. The browser adapter draws it as a single-series bar chart via Chart.js loaded LAZILY as a private optional dependency; the app ships only the data (`points`), a `title`, and a `tone` from the existing tone axis — no chart library and no CSS.", style: "muted" },
      { type: "chart", points: [
        { label: "Jan", value: 30 },
        { label: "Feb", value: 45 },
        { label: "Mar", value: 28 },
        { label: "Apr", value: 52 },
      ], title: "Signups", tone: "success" },
    ]},

    // ── child-side modifiers (alignSelf + maxWidth) — the chat-bubble case ─
    { type: "section", heading: "Child-side modifiers (alignSelf + maxWidth)", children: [
      { type: "text", value: "Two per-child modifiers on a section: `alignSelf` (start/center/end — the per-child counterpart to `align`) and `maxWidth` (half/two-thirds/three-quarters/prose — a bounded cap). Together they compose a chat transcript with ZERO app CSS: a vertical stack of card bubbles, each pinned to one side and capped so the opposite gutter stays open. Resize the window — the fractional caps scale with it.", style: "muted" },
      // the headline composition: a chat transcript (no ChatBubble node — just sections)
      { type: "section", variant: "card", children: [
        { type: "section", variant: "card", alignSelf: "start", maxWidth: "three-quarters", children: [
          { type: "text", value: "Hey! Did the new layout primitives land?" },
        ]},
        { type: "section", variant: "card", alignSelf: "end", maxWidth: "three-quarters", tone: "info", children: [
          { type: "text", value: "Yep — alignSelf + maxWidth, no ChatBubble node needed." },
        ]},
        { type: "section", variant: "card", alignSelf: "start", maxWidth: "three-quarters", children: [
          { type: "text", value: "So the whole transcript is zero app CSS?" },
        ]},
        { type: "section", variant: "card", alignSelf: "end", maxWidth: "three-quarters", tone: "info", children: [
          { type: "text", value: "Every bubble — section + variant:card + alignSelf + maxWidth + tone." },
        ]},
      ]},
      // alignSelf in isolation — a capped card pinned to each side / center
      { type: "text", value: "alignSelf in isolation — a half-width card pinned to each position:", style: "muted" },
      ...(["start", "center", "end"] as const).map(v => (
        { type: "section" as const, variant: "card" as const, alignSelf: v, maxWidth: "half" as const, children: [
          { type: "text" as const, value: `alignSelf: "${v}" (maxWidth: half)` },
        ]}
      )),
      // maxWidth: prose — the readable measure cap
      { type: "text", value: "maxWidth: \"prose\" — caps a text column at the readable measure (~65ch) so long body copy doesn't sprawl edge to edge:", style: "muted" },
      { type: "section", variant: "card", maxWidth: "prose", children: [
        { type: "text", value: "This paragraph is capped at the prose measure. Comfortable line length is roughly 45–75 characters; the prose token pins the column near 65ch — min(65ch, 100%), so it never overflows a narrow container — the same cap Tailwind exposes as max-w-prose and Every-Layout calls the measure. Resize the window: it stops growing at the measure even when there's more room." },
      ]},
    ]},
  ];
}

function dashboardView(): ViewNode[] {
  return [
    // DEMO-02 — header-bar composition: a layout:"row" with
    // arrange:"space-between" pins the title left and a nav cluster right,
    // proving the new arrange/align enums compose in a real app chrome.
    { type: "section", layout: "row", arrange: "space-between", align: "center", children: [
      { type: "text", value: "Operations dashboard", style: "heading" },
      { type: "section", layout: "row", children: [
        { type: "link", label: "Overview", href: "#overview", active: true },
        { type: "link", label: "Reports",  href: "#reports" },
        { type: "link", label: "Settings", href: "#settings" },
      ]},
    ]},
    { type: "text", value: "Last 30 days · benchmarked against the Bootstrap \"Dashboard\" example. Header-bar uses arrange:\"space-between\"; the stat grid is the cards preset with an explicit minItem:\"sm\" (denser auto-fit) over section variant:\"card\" tiles.", style: "muted" },
    // DEMO-02 — stat grid: cards preset with an explicit minItem token so the
    // auto-fit tracks are denser than the inherited 16rem default.
    { type: "section", layout: "cards", minItem: "sm", children: [
      // 1.4.0 — the four stat tiles use SectionNode.action as click-anywhere
      // clickable cards (drill-down affordance). Per-tile identity is encoded
      // in the action name (`dashboard:focus-revenue`, etc.) — no context.
      { type: "section", variant: "card", action: { name: "dashboard:focus-revenue" }, children: [
        { type: "text", value: "Revenue", style: "subheading" },
        { type: "text", value: "$128,400", style: "heading" },
        { type: "text", value: "+12.4% vs prior 30 days", style: "muted" },
      ]},
      { type: "section", variant: "card", action: { name: "dashboard:focus-users" }, children: [
        { type: "text", value: "Active users", style: "subheading" },
        { type: "text", value: "8,932", style: "heading" },
        { type: "text", value: "+318 this week", style: "muted" },
      ]},
      { type: "section", variant: "card", action: { name: "dashboard:focus-conversion" }, children: [
        { type: "text", value: "Conversion", style: "subheading" },
        { type: "text", value: "3.7%", style: "heading" },
        { type: "text", value: "-0.2 pts vs prior 30 days", style: "muted" },
      ]},
      { type: "section", variant: "card", action: { name: "dashboard:focus-issues" }, children: [
        { type: "text", value: "Open issues", style: "subheading" },
        { type: "text", value: "14", style: "heading" },
        { type: "text", value: "3 high priority", style: "muted" },
      ]},
    ]},
    { type: "section", heading: "This month", children: [
      { type: "stat-bar", stats: [
        { label: "orders",       value: 1842 },
        { label: "refunds",      value: 37 },
        { label: "avg. order",   value: "$69.70" },
        { label: "net revenue",  value: "$126,510" },
      ]},
    ]},
    { type: "section", heading: "Recent activity", children: [
      { type: "table",
        columns: [
          { key: "when",   label: "When" },
          { key: "event",  label: "Event" },
          { key: "actor",  label: "Actor" },
          { key: "amount", label: "Amount" },
        ],
        rows: [
          { id: "a1", cells: { when: "2 min ago",  event: "Order placed",   actor: "j.okafor@example.com",  amount: "$248.00" } },
          { id: "a2", cells: { when: "18 min ago", event: "Refund issued",  actor: "support",                amount: "-$32.00" }, tone: "warning" },
          { id: "a3", cells: { when: "41 min ago", event: "Order placed",   actor: "m.haddad@example.com",   amount: "$94.50"  } },
          { id: "a4", cells: { when: "1 hr ago",   event: "Subscription",   actor: "r.tanaka@example.com",   amount: "$19.00"  } },
          { id: "a5", cells: { when: "2 hr ago",   event: "Chargeback",     actor: "risk",                   amount: "-$140.00" }, tone: "danger" },
        ],
      },
    ]},
    // 1.5.0 — SectionNode.link demo: clickable cards that navigate via <a href>,
    // preserving every native browser link behavior (middle-click new tab,
    // Ctrl/Cmd-click, right-click context menu, drag-to-bookmarks, status-bar
    // URL preview). Issue #21.
    { type: "section", heading: "Resources", layout: "cards", children: [
      { type: "section", variant: "card", link: { url: "https://github.com/ashley-shrok/ViewModelShell#readme", external: true }, children: [
        { type: "text", value: "Read the docs", style: "subheading" },
        { type: "text", value: "Architecture, gotchas, and runnable demos.", style: "muted" },
      ]},
      { type: "section", variant: "card", link: { url: "https://github.com/ashley-shrok/ViewModelShell", external: true }, children: [
        { type: "text", value: "View on GitHub", style: "subheading" },
        { type: "text", value: "Source for both the npm + NuGet packages.", style: "muted" },
      ]},
      { type: "section", variant: "card", link: { url: "https://github.com/ashley-shrok/ViewModelShell/issues", external: true }, children: [
        { type: "text", value: "Report an issue", style: "subheading" },
        { type: "text", value: "File a bug or request a primitive.", style: "muted" },
      ]},
    ]},
    { type: "section", children: [
      { type: "button", label: "New report", action: { name: "dashboard:new-report" }, emphasis: "primary" },
    ]},
  ];
}

function formView(): ViewNode[] {
  return [
    { type: "text", value: "Checkout", style: "heading" },
    { type: "text", value: "Benchmarked against the Bootstrap \"Checkout\" example. A realistic multi-section form on the default stack flow — no layout preset, no app breakpoints.", style: "muted" },

    { type: "section", heading: "Contact", children: [
      { type: "form",
        submitAction: { name: "form:contact" },
        submitLabel:  "Save contact",
        children: [
          { type: "field", name: "fullName", inputType: "text",  bind: "formInputs.fullName", label: "Full name",     placeholder: "Jordan Okafor", required: true },
          { type: "field", name: "email",    inputType: "email", bind: "formInputs.email_co", label: "Email address", placeholder: "you@example.com", required: true },
          { type: "field", name: "phone",    inputType: "text",  bind: "formInputs.phone",    label: "Phone",         placeholder: "+1 555 0100" },
        ],
      },
    ]},

    { type: "section", heading: "Shipping address", children: [
      { type: "form",
        submitAction: { name: "form:shipping" },
        submitLabel:  "Save address",
        children: [
          { type: "field", name: "address1", inputType: "text", bind: "formInputs.address1", label: "Address",  placeholder: "1 Market Street", required: true },
          { type: "field", name: "address2", inputType: "text", bind: "formInputs.address2", label: "Address 2 (optional)", placeholder: "Apartment, suite, etc." },
          { type: "field", name: "city",     inputType: "text", bind: "formInputs.city",     label: "City",     placeholder: "San Francisco", required: true },
          { type: "field", name: "country",  inputType: "select", bind: "formInputs.country", label: "Country", required: true, options: [
            { value: "us", label: "United States" },
            { value: "ca", label: "Canada" },
            { value: "gb", label: "United Kingdom" },
            { value: "de", label: "Germany" },
          ]},
          { type: "field", name: "zip",      inputType: "text", bind: "formInputs.zip", label: "ZIP / Postal code", placeholder: "94105", required: true },
        ],
      },
    ]},

    { type: "section", heading: "Payment", children: [
      { type: "form",
        submitAction: { name: "form:place-order" },
        submitLabel:  "Place order",
        children: [
          { type: "field", name: "cardName",   inputType: "text",   bind: "formInputs.cardName",   label: "Name on card", placeholder: "Jordan Okafor", required: true },
          { type: "field", name: "cardNumber", inputType: "text",   bind: "formInputs.cardNumber", label: "Card number",  placeholder: "1234 5678 9012 3456", required: true },
          { type: "field", name: "cardExpiry", inputType: "text",   bind: "formInputs.cardExpiry", label: "Expiration",   placeholder: "MM/YY", required: true },
          { type: "field", name: "cardCvv",    inputType: "number", bind: "formInputs.cardCvv",    label: "CVV",          placeholder: "123", required: true },
        ],
      },
    ]},
  ];
}

function listDetailView(): ViewNode[] {
  const sel = selectedItem();

  // The two panes, factored out so the wide (side-by-side) and narrow
  // (stacked) candidates of the `fits` node share identical content.
  const listPane: ViewNode = {
    type: "section", heading: "Catalog", children: [
      { type: "list", children: catalog.map(item => ({
        type: "list-item" as const,
        id: item.id,
        state: item.id === state.selectedItemId ? "active" : undefined,
        children: [
          { type: "text" as const, value: item.title, style: "subheading" as const },
          { type: "text" as const, value: `${item.artist} · ${item.year} · ${item.price}`, style: "muted" as const },
          // Per-row select — unique action name per item.
          { type: "button" as const, label: "View details", action: { name: `list-detail:select-${item.id}` } },
        ],
      })) },
    ],
  };

  const detailPane: ViewNode = {
    type: "section", variant: "card", heading: "Details", children: [
      { type: "text", value: sel.title, style: "heading" },
      { type: "text", value: `${sel.artist} · ${sel.year}`, style: "subheading" },
      { type: "stat-bar", stats: [
        { label: "price",  value: sel.price },
        { label: "format", value: "Vinyl LP" },
        { label: "length", value: sel.tracks },
      ]},
      { type: "text", value: sel.blurb, style: "body" },
      { type: "button", label: "Add to cart", action: { name: `list-detail:add-${sel.id}` }, emphasis: "primary" },
    ],
  };

  return [
    { type: "text", value: "Record catalog", style: "heading" },
    { type: "text", value: "Benchmarked against the Bootstrap \"Album\" example for the list half; the detail pane is our own composition. DEMO-02: a `split` lays the catalog + detail side-by-side and collapses to a single stacked column ON ITS OWN as the width narrows (intrinsic, zero @media) — the right tool for a text-heavy two-pane layout. RESIZE THE WINDOW narrow (past ~512px) to watch the two panes stack. (`fits` is reserved for selecting between layouts with bounded intrinsic widths — e.g. the toolbar↔menu on the Layouts tab — not for text-heavy multi-column panes, whose max-content width is unbounded.)", style: "muted" },

    // DEMO-02 — a `split` two-pane shell that collapses to a single stacked
    // column intrinsically as it narrows (its own auto-fit behavior; no fits
    // needed — text panes have unbounded max-content width, which is exactly
    // the case fits' intrinsic-width measurement is NOT suited to).
    { type: "section", layout: "split", children: [listPane, detailPane] },
  ];
}

// ── ViewModel construction ───────────────────────────────────────────────
function viewChildren(): ViewNode[] {
  switch (state.view) {
    case "layouts":     return layoutsView();
    case "dashboard":   return dashboardView();
    case "form":        return formView();
    case "list-detail": return listDetailView();
    case "components":
    default:            return componentsView();
  }
}

function buildVm(): ViewNode {
  return {
    type: "page",
    title: "ViewModel Shell — Canonical reference set",
    children: [
      { type: "tabs", selected: state.view, bind: "view", tabs: [
        { value: "components",  label: "Components",    action: { name: "view:set:components"  } },
        { value: "layouts",     label: "Layouts",       action: { name: "view:set:layouts"     } },
        { value: "dashboard",   label: "Dashboard",     action: { name: "view:set:dashboard"   } },
        { value: "form",        label: "Form",          action: { name: "view:set:form"        } },
        { value: "list-detail", label: "List / detail", action: { name: "view:set:list-detail" } },
      ]},
      ...viewChildren(),
    ],
  };
}

// ── Action handler ───────────────────────────────────────────────────────
const adapter = new BrowserAdapter(document.getElementById("app")!);

// stateAccess seam used by the renderer: the bound input values flow
// through state at the bind path; reads return what's there, writes mutate
// state and queue a re-render (the existing pattern this demo already used
// for action-driven mutations).
const stateAccess: StateAccess = {
  read:  (path) => readPath(state, path),
  write: (path, value) => {
    state = writePath(state, path, value) as State;
    // Theme writes need the stylesheet to update immediately.
    if (path === "mode" || path === "accent") applyTheme();
    rerender();
  },
};

function handle(action: ActionEvent): void {
  // Phase 6: action.name carries every parameter that used to live in context.
  // Most Showcase actions are pure state writes (already handled by the bind
  // seam above); a few need post-write side-effects:
  if (action.name === "modal:open") {
    state.modalShown = true; rerender(); return;
  }
  if (action.name.startsWith("modal:dismiss")) {
    state.modalShown = false; rerender(); return;
  }
  if (action.name.startsWith("list-detail:select-")) {
    state.selectedItemId = action.name.slice("list-detail:select-".length);
    rerender(); return;
  }
  // Everything else is either a no-op or already handled by stateAccess.write
  // (the bind seam wrote the new value into state and triggered a rerender).
  console.log("[showcase] action:", action.name);
}

function rerender() {
  adapter.render(buildVm(), handle, stateAccess);
}

rerender();
