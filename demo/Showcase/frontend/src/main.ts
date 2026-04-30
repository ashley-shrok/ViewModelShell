import "@ashley-shrok/viewmodel-shell/styles.css";
// All theme files inlined here. Apps would normally pick one and import it
// statically; the showcase swaps at runtime via a single <style> element.
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

interface State {
  modalShown:    boolean;
  agreeChecked:  boolean;
  selectedTab:   string;
  sortColumn:    string;
  sortDirection: "asc" | "desc";
  filters:       Record<string, string>;
  mode:          Mode;
  accent:        Accent;
}

let state: State = {
  modalShown:    true,
  agreeChecked:  false,
  selectedTab:   "active",
  sortColumn:    "name",
  sortDirection: "asc",
  filters:       { name: "", status: "" },
  mode:          "dark",
  accent:        "purple",
};

// ── Theme switching ──────────────────────────────────────────────────────
const themeStyle = document.createElement("style");
themeStyle.id = "vms-showcase-theme";
document.head.appendChild(themeStyle);

const themeFiles: Record<string, string> = {
  // dark-purple is the implicit default — no override needed (empty string).
  "dark-purple":  "",
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

// ── ViewModel construction ───────────────────────────────────────────────
function buildVm(): ViewNode {
  return {
    type: "page",
    title: "Component Showcase",
    children: [
      // ── Theme switcher: mode + accent ─────────────────────────────
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
        { type: "text", value: "Mode × accent gives 12 themes. Apps pick one with a single import — the showcase combines them at runtime so you can sample them all.", style: "muted" },
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
