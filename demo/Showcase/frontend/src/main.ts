import "viewmodel-shell/styles.css";
import darkBlueCss from "viewmodel-shell/themes/dark-blue.css?inline";
import lightCss    from "viewmodel-shell/themes/light.css?inline";
import { BrowserAdapter } from "viewmodel-shell/browser";
import type { ViewNode, ActionEvent } from "viewmodel-shell";

// Renders every framework-emitted node type in a single page so the
// default stylesheet can be visually verified end-to-end. Frontend-only
// — no backend, just enough local state to make the interactive bits feel
// real (table sort/filter, tabs, modal, agree checkbox, theme switcher).

// ── State ────────────────────────────────────────────────────────────────
type Theme = "default" | "dark-blue" | "light";

interface State {
  modalShown:    boolean;
  agreeChecked:  boolean;
  selectedTab:   string;
  sortColumn:    string;
  sortDirection: "asc" | "desc";
  filters:       Record<string, string>;
  theme:         Theme;
}

let state: State = {
  modalShown:    true,
  agreeChecked:  false,
  selectedTab:   "active",
  sortColumn:    "name",
  sortDirection: "asc",
  filters:       { name: "", status: "" },
  theme:         "default",
};

// ── Theme switching ──────────────────────────────────────────────────────
// Apps usually pick one theme at build time (a single static import). The
// showcase swaps at runtime by toggling a single <style> element so you can
// see how the variables drive the look.
const themeStyle = document.createElement("style");
themeStyle.id = "vms-showcase-theme";
document.head.appendChild(themeStyle);

function applyTheme(theme: Theme) {
  state.theme = theme;
  themeStyle.textContent =
    theme === "dark-blue" ? darkBlueCss :
    theme === "light"     ? lightCss :
    /* default */           "";
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

// ── ViewModel construction ───────────────────────────────────────────────
function buildVm(): ViewNode {
  return {
    type: "page",
    title: "Component Showcase",
    children: [
      // ── Theme switcher ────────────────────────────────────────────
      { type: "section", heading: "Theme", children: [
        { type: "tabs", selected: state.theme, action: { name: "theme:set" }, tabs: [
          { value: "default",   label: "Default (purple)" },
          { value: "dark-blue", label: "Dark blue" },
          { value: "light",     label: "Light" },
        ]},
        { type: "text", value: "Same default.css rules — only the CSS-variable values change. Apps import a theme on top of styles.css.", style: "muted" },
      ]},

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

      // ── Links ─────────────────────────────────────────────────────
      // Each link is a separate flex item — the framework doesn't model
      // inline prose with embedded links.
      { type: "section", heading: "Links", children: [
        { type: "link", label: "Internal link to a doc", href: "#docs" },
        { type: "link", label: "External (opens new tab)", href: "https://example.com", external: true },
      ]},

      // ── Tabs + progress ───────────────────────────────────────────
      { type: "section", heading: "Tabs and progress", children: [
        { type: "tabs", selected: state.selectedTab, action: { name: "tab:set" }, tabs: [
          { value: "all",       label: "All" },
          { value: "active",    label: "Active" },
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

      // ── List + variants ───────────────────────────────────────────
      { type: "section", heading: "List with variants", children: [
        { type: "list", children: [
          { type: "list-item", children: [
            { type: "text", value: "Default item",           style: "subheading" },
            { type: "text", value: "no variant set",         style: "muted" },
            { type: "button", label: "Delete", action: { name: "noop" }, variant: "danger" },
          ]},
          { type: "list-item", variant: "done", children: [
            { type: "text", value: "Completed item",         style: "subheading" },
            { type: "text", value: "list-item--done",        style: "muted" },
          ]},
          { type: "list-item", variant: "warning", children: [
            { type: "text", value: "Warning item",           style: "subheading" },
            { type: "text", value: "list-item--warning · amber", style: "muted" },
          ]},
          { type: "list-item", variant: "high", children: [
            { type: "text", value: "High-priority item",     style: "subheading" },
            { type: "text", value: "list-item--high · orange", style: "muted" },
          ]},
          { type: "list-item", variant: "critical", children: [
            { type: "text", value: "Critical item",          style: "subheading" },
            { type: "text", value: "list-item--critical · red", style: "muted" },
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

      // The modal lives at page level so the backdrop covers the viewport.
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
    ],
  };
}

// ── Action handler ───────────────────────────────────────────────────────
const adapter = new BrowserAdapter(document.getElementById("app")!);

function handle(action: ActionEvent): void {
  const ctx = action.context ?? {};
  let stateChanged = false;

  switch (action.name) {
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
    case "theme:set":
      applyTheme(ctx.value as Theme);
      stateChanged = true; break;
    default:
      // Other actions (noop, form submit, etc.) just log without re-rendering
      // so native form/checkbox interaction isn't disrupted.
      console.log("[showcase] action (no-op):", action);
      return;
  }

  if (stateChanged) adapter.render(buildVm(), handle);
}

adapter.render(buildVm(), handle);
