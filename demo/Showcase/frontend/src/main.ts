import "@ashley-shrok/viewmodel-shell/styles.css";
// All theme files inlined here. Apps would normally pick one and import it
// statically; the showcase swaps at runtime via a single injected style tag.
// The runtime theme switcher is scoped to the component-gallery view only
// (D-14); the three archetype views always render the fixed new shipped
// light-purple default — the stable benchmark target.
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
import type { ViewNode, ActionEvent } from "@ashley-shrok/viewmodel-shell";

// ── State ────────────────────────────────────────────────────────────────
type Mode = "dark" | "light";
type Accent = "purple" | "blue" | "green" | "rose" | "amber" | "teal";
type View = "components" | "dashboard" | "form" | "list-detail";

interface State {
  view:          View;
  modalShown:    boolean;
  agreeChecked:  boolean;
  selectedTab:   string;
  sortColumn:    string;
  sortDirection: "asc" | "desc";
  filters:       Record<string, string>;
  mode:          Mode;
  accent:        Accent;
  selectedItemId: string;
}

let state: State = {
  view:          "components",
  modalShown:    true,
  agreeChecked:  false,
  selectedTab:   "active",
  sortColumn:    "name",
  sortDirection: "asc",
  filters:       { name: "", status: "" },
  // The Showcase boots in the new shipped light default so the canonical set
  // benchmarks light-on-Bootstrap-light (D-06). default.css :root is already
  // light-purple (Plan 01), so applyTheme()'s light-purple override is a
  // harmless no-op equivalent on first render — intentionally not special-cased.
  mode:          "light",
  accent:        "purple",
  selectedItemId: "lp-01",
};

// ── Theme switching (gallery view only — D-14) ───────────────────────────
const themeStyle = document.createElement("style");
themeStyle.id = "vms-showcase-theme";
document.head.appendChild(themeStyle);

const themeFiles: Record<string, string> = {
  // The shipped default is now light-purple (Plan 01 D-01). dark-purple is no
  // longer the implicit empty-string default — it is a real entry pointing at
  // the new themes/dark-purple.css byte-exact capture of the prior dark default
  // (D-06).
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
const allRows = [
  { id: "1", name: "Alpha",   status: "open",        url: "https://example.com/1", variant: undefined as string | undefined },
  { id: "2", name: "Bravo",   status: "in-progress", url: "https://example.com/2", variant: "warning" },
  { id: "3", name: "Charlie", status: "resolved",    url: "https://example.com/3", variant: "done" },
  { id: "4", name: "Delta",   status: "blocked",     url: "https://example.com/4", variant: "critical" },
];

function visibleRows() {
  const f = state.filters;
  const filtered = allRows.filter(r =>
    (!f.name   || r.name.toLowerCase().includes(f.name.toLowerCase())) &&
    (!f.status || r.status.toLowerCase().includes(f.status.toLowerCase()))
  );
  const dir = state.sortDirection === "asc" ? 1 : -1;
  return [...filtered].sort((a, b) => {
    const av = (a as any)[state.sortColumn] ?? "";
    const bv = (b as any)[state.sortColumn] ?? "";
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
  return catalog.find(c => c.id === state.selectedItemId) ?? catalog[0];
}

// ── The runtime theme switcher section (D-06/D-14) ───────────────────────
// Scoped to the component-gallery view ONLY. The three archetype views render
// the fixed new shipped light-purple default with no switcher control — the
// stable benchmark target. The explicit `state.view === "components"` guard
// makes the D-14 scope structurally falsifiable (no switcher control leaks
// onto an archetype view).
function themeSwitcherSection(): ViewNode[] {
  if (state.view !== "components") return [];
  return [
    { type: "section", heading: "Theme", children: [
      { type: "tabs", selected: state.mode, action: { name: "theme:mode" }, tabs: [
        { value: "dark",  label: "Dark"  },
        { value: "light", label: "Light" },
      ]},
      { type: "tabs", selected: state.accent, action: { name: "theme:accent" }, tabs: [
        { value: "purple", label: "Purple" },
        { value: "blue",   label: "Blue"   },
        { value: "green",  label: "Green"  },
        { value: "rose",   label: "Rose"   },
        { value: "amber",  label: "Amber"  },
        { value: "teal",   label: "Teal"   },
      ]},
      { type: "text", value: "Mode × accent gives 12 themes. Apps pick one with a single import — the showcase combines them at runtime so you can sample them all. The switcher is scoped to this gallery; the archetype views render the fixed shipped light default.", style: "muted" },
    ]},
  ];
}

// ── Components / kitchen-sink gallery view (preserved verbatim, D-09/D-14) ─
// Every prior gallery section is preserved unchanged. The Theme switcher
// section stays ONLY here (gated to the components view via the
// `state.view === "components"` guard in themeSwitcherSection() — D-14).
function componentsView(): ViewNode[] {
  return [
    ...themeSwitcherSection(),

    // ── Text styles ───────────────────────────────────────────────
    { type: "section", heading: "Text styles", children: [
      { type: "text", value: "Heading text",    style: "heading" },
      { type: "text", value: "Subheading text", style: "subheading" },
      { type: "text", value: "Body line one\nBody line two with longer prose to demonstrate line height.", style: "body" },
      { type: "text", value: "Muted secondary information",  style: "muted" },
      { type: "text", value: "Strikethrough completed item", style: "strikethrough" },
      { type: "text", value: "Error message text",           style: "error" },
      { type: "text", value: "$ vms render --verbose\n  ok page\n  ok section\n  ok list (3 items)\n  ok button x2", style: "pre" },
    ]},

    // ── Stat bar ──────────────────────────────────────────────────
    { type: "section", heading: "Stat bar", children: [
      { type: "stat-bar", stats: [
        { label: "active",    value: 12 },
        { label: "completed", value: 38 },
        { label: "remaining", value: "$420.50" },
      ]},
    ]},

    // ── Button variants ───────────────────────────────────────────
    { type: "section", heading: "Buttons", children: [
      { type: "button", label: "Default",   action: { name: "noop" } },
      { type: "button", label: "Primary",   action: { name: "noop" }, variant: "primary" },
      { type: "button", label: "Secondary", action: { name: "noop" }, variant: "secondary" },
      { type: "button", label: "Danger",    action: { name: "noop" }, variant: "danger" },
    ]},

    // ── Copy button ───────────────────────────────────────────────
    { type: "section", heading: "Copy button (clipboard, no dispatch)", children: [
      { type: "copy-button", text: "npx @ashley-shrok/viewmodel-shell", label: "Copy install command", copiedLabel: "Copied!" },
      { type: "copy-button", text: "console.log('hello from CopyButtonNode')" },
    ]},

    // ── Links ─────────────────────────────────────────────────────
    { type: "section", heading: "Links", children: [
      { type: "link", label: "Internal link to a doc", href: "#docs" },
      { type: "link", label: "External (opens new tab)", href: "https://example.com", external: true },
    ]},

    // ── Tabs + progress ───────────────────────────────────────────
    { type: "section", heading: "Tabs and progress", children: [
      { type: "tabs", selected: state.selectedTab, action: { name: "tab:set" }, tabs: [
        { value: "all",       label: "All"       },
        { value: "active",    label: "Active"    },
        { value: "completed", label: "Completed" },
      ]},
      { type: "progress", value: 67 },
    ]},

    // ── Forms: every input type ───────────────────────────────────
    { type: "section", heading: "Form inputs", children: [
      { type: "form",
        submitAction: { name: "submit-showcase" },
        submitLabel:  "Submit",
        children: [
          { type: "field", name: "text",     inputType: "text",            label: "Text",        placeholder: "Type something" },
          { type: "field", name: "email",    inputType: "email",           label: "Email",       placeholder: "you@example.com" },
          { type: "field", name: "password", inputType: "password",        label: "Password",    placeholder: "••••••••" },
          { type: "field", name: "number",   inputType: "number",          label: "Number",      placeholder: "0" },
          { type: "field", name: "date",     inputType: "date",            label: "Date",        value: "2026-04-28" },
          { type: "field", name: "time",     inputType: "time",            label: "Time",        value: "14:30" },
          { type: "field", name: "datetime", inputType: "datetime-local",  label: "Date + Time", value: "2026-04-28T14:30" },
          { type: "field", name: "textarea", inputType: "textarea",        label: "Textarea",    placeholder: "Multi-line input…" },
          { type: "field", name: "select",   inputType: "select",          label: "Select", value: "b", options: [
              { value: "a", label: "Option A" },
              { value: "b", label: "Option B" },
              { value: "c", label: "Option C" },
          ]},
          { type: "field", name: "multi",    inputType: "select-multiple", label: "Select multiple", value: "a,c", options: [
              { value: "a", label: "Apple"  },
              { value: "b", label: "Banana" },
              { value: "c", label: "Cherry" },
          ]},
          { type: "field", name: "subscribe",inputType: "checkbox",        label: "Form-collected checkbox (FieldNode)", value: "true" },
          { type: "field", name: "file",     inputType: "file",            label: "File upload" },
          { type: "field", name: "query",    inputType: "code",            label: "Code (SQL)", language: "sql",
            value: "select id, title, status\nfrom tickets\nwhere priority in ('high', 'critical')\norder by created_at desc;" },
        ],
      },
    ]},

    // ── Standalone CheckboxNode ───────────────────────────────────
    { type: "section", heading: "Checkbox (immediate dispatch)", children: [
      { type: "checkbox", name: "agree", checked: state.agreeChecked,
        label: "Agree to terms (CheckboxNode — fires action on toggle)",
        action: { name: "agree:toggle" } },
      { type: "text", value: "Click toggles via the action. The form-collected variant above lives inside the form and rides along with submit.", style: "muted" },
    ]},

    // ── List + variants (full rainbow palette) ────────────────────
    { type: "section", heading: "List with variants", children: [
      { type: "list", children: [
        { type: "list-item", children: [
          { type: "text", value: "Default item",       style: "subheading" },
          { type: "text", value: "no variant set",     style: "muted" },
          { type: "button", label: "Delete", action: { name: "noop" }, variant: "danger" },
        ]},
        { type: "list-item", variant: "critical", children: [
          { type: "text", value: "Critical item",      style: "subheading" },
          { type: "text", value: "list-item--critical · red",    style: "muted" },
        ]},
        { type: "list-item", variant: "high", children: [
          { type: "text", value: "High-priority item", style: "subheading" },
          { type: "text", value: "list-item--high · orange",     style: "muted" },
        ]},
        { type: "list-item", variant: "warning", children: [
          { type: "text", value: "Warning item",       style: "subheading" },
          { type: "text", value: "list-item--warning · yellow",  style: "muted" },
        ]},
        { type: "list-item", variant: "success", children: [
          { type: "text", value: "Success item",       style: "subheading" },
          { type: "text", value: "list-item--success · green",   style: "muted" },
        ]},
        { type: "list-item", variant: "info", children: [
          { type: "text", value: "Info item",          style: "subheading" },
          { type: "text", value: "list-item--info · blue",       style: "muted" },
        ]},
        { type: "list-item", variant: "done", children: [
          { type: "text", value: "Completed item",     style: "subheading" },
          { type: "text", value: "list-item--done",    style: "muted" },
        ]},
      ]},
    ]},

    // ── Table with sort, filter, link cell ────────────────────────
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
          variant: r.variant,
          action: { name: "noop", context: { id: r.id } },
        })),
        sortColumn:    state.sortColumn,
        sortDirection: state.sortDirection,
        sortAction:    { name: "table:sort"   },
        filterAction:  { name: "table:filter" },
      },
    ]},

    // ── Modal ─────────────────────────────────────────────────────
    { type: "section", heading: "Modal", children: [
      { type: "text", value: "Cancel/Delete forever/the X all dismiss it. Use the button below to reopen.", style: "muted" },
      { type: "button", label: "Open modal", action: { name: "modal:open" }, variant: "primary" },
    ]},

    ...(state.modalShown ? [{
      type: "modal" as const,
      title: "Confirm action",
      dismissAction: { name: "modal:dismiss" },
      children: [
        { type: "text" as const, value: "Are you sure you want to delete this item? This cannot be undone.", style: "body" as const },
      ],
      footer: [
        { type: "button" as const, label: "Cancel",         action: { name: "modal:dismiss" } },
        { type: "button" as const, label: "Delete forever", action: { name: "modal:dismiss" }, variant: "danger" as const },
      ],
    }] : []),
  ];
}

// ── Dashboard archetype (LOCKED: `cards` preset, Bootstrap "Dashboard") ───
// Teaches WHEN to reach for `cards` + `section variant:"card"`: a stat/summary
// card grid that auto-fits from --vms-card-min, a stat-bar summary row, a small
// recent-activity table, and the primary CTA "New report". D-10/D-13.
function dashboardView(): ViewNode[] {
  return [
    { type: "text", value: "Operations dashboard", style: "heading" },
    { type: "text", value: "Last 30 days · benchmarked against the Bootstrap \"Dashboard\" example. Built from the cards preset + section variant:\"card\" tiles.", style: "muted" },

    // Stat tiles: a `cards`-layout section of `section variant:"card"` tiles.
    // The cards preset auto-fits the tiles from --vms-card-min — zero app
    // breakpoints, collapses to one column intrinsically.
    { type: "section", layout: "cards", children: [
      { type: "section", variant: "card", children: [
        { type: "text", value: "Revenue", style: "subheading" },
        { type: "text", value: "$128,400", style: "heading" },
        { type: "text", value: "+12.4% vs prior 30 days", style: "muted" },
      ]},
      { type: "section", variant: "card", children: [
        { type: "text", value: "Active users", style: "subheading" },
        { type: "text", value: "8,932", style: "heading" },
        { type: "text", value: "+318 this week", style: "muted" },
      ]},
      { type: "section", variant: "card", children: [
        { type: "text", value: "Conversion", style: "subheading" },
        { type: "text", value: "3.7%", style: "heading" },
        { type: "text", value: "-0.2 pts vs prior 30 days", style: "muted" },
      ]},
      { type: "section", variant: "card", children: [
        { type: "text", value: "Open issues", style: "subheading" },
        { type: "text", value: "14", style: "heading" },
        { type: "text", value: "3 high priority", style: "muted" },
      ]},
    ]},

    // Summary stat-bar row.
    { type: "section", heading: "This month", children: [
      { type: "stat-bar", stats: [
        { label: "orders",       value: 1842 },
        { label: "refunds",      value: 37 },
        { label: "avg. order",   value: "$69.70" },
        { label: "net revenue",  value: "$126,510" },
      ]},
    ]},

    // Recent-activity table.
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
          { id: "a2", cells: { when: "18 min ago", event: "Refund issued",  actor: "support",                amount: "-$32.00" }, variant: "warning" },
          { id: "a3", cells: { when: "41 min ago", event: "Order placed",   actor: "m.haddad@example.com",   amount: "$94.50"  } },
          { id: "a4", cells: { when: "1 hr ago",   event: "Subscription",   actor: "r.tanaka@example.com",   amount: "$19.00"  } },
          { id: "a5", cells: { when: "2 hr ago",   event: "Chargeback",     actor: "risk",                   amount: "-$140.00" }, variant: "critical" },
        ],
      },
    ]},

    // Primary CTA — exact copy per UI-SPEC §Copywriting Contract.
    { type: "section", children: [
      { type: "button", label: "New report", action: { name: "dashboard:new-report" }, variant: "primary" },
    ]},
  ];
}

// ── Form-heavy archetype (LOCKED: `stack` default, Bootstrap "Checkout") ──
// Defaulted to `stack` per UI-SPEC §Design Decisions Recorded — the safest
// few-shot exemplar of the default vertical flow; matches Bootstrap
// "Checkout"'s single-column form. Multi-section checkout grouped into
// Contact / Shipping / Payment sections, submit CTA "Place order". D-10/D-13.
function formView(): ViewNode[] {
  return [
    { type: "text", value: "Checkout", style: "heading" },
    { type: "text", value: "Benchmarked against the Bootstrap \"Checkout\" example. A realistic multi-section form on the default stack flow — no layout preset, no app breakpoints.", style: "muted" },

    { type: "section", heading: "Contact", children: [
      { type: "form",
        submitAction: { name: "form:contact" },
        submitLabel:  "Save contact",
        children: [
          { type: "field", name: "fullName", inputType: "text",  label: "Full name",     placeholder: "Jordan Okafor", required: true },
          { type: "field", name: "email",    inputType: "email", label: "Email address", placeholder: "you@example.com", required: true },
          { type: "field", name: "phone",    inputType: "text",  label: "Phone",         placeholder: "+1 555 0100" },
        ],
      },
    ]},

    { type: "section", heading: "Shipping address", children: [
      { type: "form",
        submitAction: { name: "form:shipping" },
        submitLabel:  "Save address",
        children: [
          { type: "field", name: "address1", inputType: "text", label: "Address",  placeholder: "1 Market Street", required: true },
          { type: "field", name: "address2", inputType: "text", label: "Address 2 (optional)", placeholder: "Apartment, suite, etc." },
          { type: "field", name: "city",     inputType: "text", label: "City",     placeholder: "San Francisco", required: true },
          { type: "field", name: "country",  inputType: "select", label: "Country", value: "us", required: true, options: [
            { value: "us", label: "United States" },
            { value: "ca", label: "Canada" },
            { value: "gb", label: "United Kingdom" },
            { value: "de", label: "Germany" },
          ]},
          { type: "field", name: "zip",      inputType: "text", label: "ZIP / Postal code", placeholder: "94105", required: true },
        ],
      },
    ]},

    { type: "section", heading: "Payment", children: [
      { type: "form",
        submitAction: { name: "form:place-order" },
        submitLabel:  "Place order",
        children: [
          { type: "field", name: "cardName",   inputType: "text",   label: "Name on card", placeholder: "Jordan Okafor", required: true },
          { type: "field", name: "cardNumber", inputType: "text",   label: "Card number",  placeholder: "1234 5678 9012 3456", required: true },
          { type: "field", name: "cardExpiry", inputType: "text",   label: "Expiration",   placeholder: "MM/YY", required: true },
          { type: "field", name: "cardCvv",    inputType: "number", label: "CVV",          placeholder: "123", required: true },
        ],
      },
    ]},
  ];
}

// ── List/detail archetype (LOCKED: `split` preset, Bootstrap "Album") ─────
// Teaches WHEN to reach for `split`: a list ↔ detail master-detail. The split
// preset collapses to stacked on narrow with ZERO app breakpoints. Left = a
// `list` of catalog rows (each with a "View details" button), right = a
// `section variant:"card"` detail pane with an "Add to cart" action. D-10/D-13.
function listDetailView(): ViewNode[] {
  const sel = selectedItem();
  return [
    { type: "text", value: "Record catalog", style: "heading" },
    { type: "text", value: "Benchmarked against the Bootstrap \"Album\" example for the list half; the detail pane is our own composition. The split preset collapses to one column on narrow with zero app breakpoints.", style: "muted" },

    { type: "section", layout: "split", children: [
      // LEFT: the list of catalog rows.
      { type: "section", heading: "Catalog", children: [
        { type: "list", children: catalog.map(item => ({
          type: "list-item" as const,
          id: item.id,
          variant: item.id === state.selectedItemId ? "info" : undefined,
          children: [
            { type: "text" as const, value: item.title, style: "subheading" as const },
            { type: "text" as const, value: `${item.artist} · ${item.year} · ${item.price}`, style: "muted" as const },
            { type: "button" as const, label: "View details", action: { name: "list-detail:select", context: { id: item.id } } },
          ],
        })) },
      ]},

      // RIGHT: the selected item's detail card.
      { type: "section", variant: "card", heading: "Details", children: [
        { type: "text", value: sel.title, style: "heading" },
        { type: "text", value: `${sel.artist} · ${sel.year}`, style: "subheading" },
        { type: "stat-bar", stats: [
          { label: "price",  value: sel.price },
          { label: "format", value: "Vinyl LP" },
          { label: "length", value: sel.tracks },
        ]},
        { type: "text", value: sel.blurb, style: "body" },
        { type: "button", label: "Add to cart", action: { name: "list-detail:add", context: { id: sel.id } }, variant: "primary" },
      ]},
    ]},
  ];
}

// ── ViewModel construction ───────────────────────────────────────────────
function viewChildren(): ViewNode[] {
  switch (state.view) {
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
      // Top-level archetype nav (D-09): always the first child of the page.
      { type: "tabs", selected: state.view, action: { name: "view:set" }, tabs: [
        { value: "components",  label: "Components"    },
        { value: "dashboard",   label: "Dashboard"     },
        { value: "form",        label: "Form"          },
        { value: "list-detail", label: "List / detail" },
      ]},
      ...viewChildren(),
    ],
  };
}

// ── Action handler ───────────────────────────────────────────────────────
const adapter = new BrowserAdapter(document.getElementById("app")!);

function handle(action: ActionEvent): void {
  const ctx = action.context ?? {};
  let stateChanged = false;

  switch (action.name) {
    case "view:set":
      state.view = String(ctx.value) as View; stateChanged = true; break;
    case "list-detail:select":
      state.selectedItemId = String(ctx.id); stateChanged = true; break;
    case "modal:dismiss":
      state.modalShown = false; stateChanged = true; break;
    case "modal:open":
      state.modalShown = true;  stateChanged = true; break;
    case "agree:toggle":
      state.agreeChecked = ctx.checked === true; stateChanged = true; break;
    case "tab:set":
      state.selectedTab = String(ctx.value); stateChanged = true; break;
    case "table:sort":
      state.sortColumn    = String(ctx.column);
      state.sortDirection = (ctx.direction === "desc") ? "desc" : "asc";
      stateChanged = true; break;
    case "table:filter":
      state.filters = { ...state.filters, ...(ctx.filters as Record<string, string>) };
      stateChanged = true; break;
    case "theme:mode":
      state.mode = ctx.value as Mode;
      applyTheme();
      stateChanged = true; break;
    case "theme:accent":
      state.accent = ctx.value as Accent;
      applyTheme();
      stateChanged = true; break;
    default:
      console.log("[showcase] action (no-op):", action);
      return;
  }

  if (stateChanged) adapter.render(buildVm(), handle);
}

adapter.render(buildVm(), handle);
