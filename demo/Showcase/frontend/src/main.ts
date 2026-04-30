import "viewmodel-shell/styles.css";
import { BrowserAdapter } from "viewmodel-shell/browser";
import type { ViewNode } from "viewmodel-shell";

// Renders every framework-emitted node type in a single page so the
// default stylesheet can be visually verified end-to-end. No backend,
// no state — actions just log to console.

const vm: ViewNode = {
  type: "page",
  title: "Component Showcase",
  children: [
    // ── Text styles ─────────────────────────────────────────────────
    { type: "section", heading: "Text styles", children: [
      { type: "text", value: "Heading text",       style: "heading" },
      { type: "text", value: "Subheading text",    style: "subheading" },
      { type: "text", value: "Body line one\nBody line two with longer prose to demonstrate line height.", style: "body" },
      { type: "text", value: "Muted secondary information",         style: "muted" },
      { type: "text", value: "Strikethrough completed item",        style: "strikethrough" },
      { type: "text", value: "Error message text",                  style: "error" },
      { type: "text", value: "$ vms render --verbose\n  ok page\n  ok section\n  ok list (3 items)\n  ok button x2", style: "pre" },
    ]},

    // ── Stat bar ────────────────────────────────────────────────────
    { type: "section", heading: "Stat bar", children: [
      { type: "stat-bar", stats: [
        { label: "active",    value: 12 },
        { label: "completed", value: 38 },
        { label: "remaining", value: "$420.50" },
      ]},
    ]},

    // ── Button variants ─────────────────────────────────────────────
    { type: "section", heading: "Buttons", children: [
      { type: "button", label: "Default",   action: { name: "noop" } },
      { type: "button", label: "Primary",   action: { name: "noop" }, variant: "primary" },
      { type: "button", label: "Secondary", action: { name: "noop" }, variant: "secondary" },
      { type: "button", label: "Danger",    action: { name: "noop" }, variant: "danger" },
    ]},

    // ── Link ────────────────────────────────────────────────────────
    { type: "section", heading: "Link", children: [
      { type: "text", value: "Inline link to ", style: "muted" },
      { type: "link", label: "the documentation", href: "https://example.com", external: true },
    ]},

    // ── Tabs + progress ─────────────────────────────────────────────
    { type: "section", heading: "Tabs and progress", children: [
      { type: "tabs", selected: "active", action: { name: "noop" }, tabs: [
        { value: "all",       label: "All" },
        { value: "active",    label: "Active" },
        { value: "completed", label: "Completed" },
      ]},
      { type: "progress", value: 67 },
    ]},

    // ── Forms: every input type ─────────────────────────────────────
    { type: "section", heading: "Form inputs", children: [
      { type: "form",
        submitAction: { name: "submit-showcase" },
        submitLabel: "Submit",
        children: [
          { type: "field", name: "text",        inputType: "text",           label: "Text",        placeholder: "Type something" },
          { type: "field", name: "email",       inputType: "email",          label: "Email",       placeholder: "you@example.com" },
          { type: "field", name: "password",    inputType: "password",       label: "Password",    placeholder: "••••••••" },
          { type: "field", name: "number",      inputType: "number",         label: "Number",      placeholder: "0" },
          { type: "field", name: "date",        inputType: "date",           label: "Date",        value: "2026-04-28" },
          { type: "field", name: "time",        inputType: "time",           label: "Time",        value: "14:30" },
          { type: "field", name: "datetime",    inputType: "datetime-local", label: "Date + Time", value: "2026-04-28T14:30" },
          { type: "field", name: "textarea",    inputType: "textarea",       label: "Textarea",    placeholder: "Multi-line input…" },
          { type: "field", name: "select",      inputType: "select",         label: "Select", value: "b", options: [
              { value: "a", label: "Option A" },
              { value: "b", label: "Option B" },
              { value: "c", label: "Option C" },
          ]},
          { type: "field", name: "multi",       inputType: "select-multiple", label: "Select multiple", value: "a,c", options: [
              { value: "a", label: "Apple" },
              { value: "b", label: "Banana" },
              { value: "c", label: "Cherry" },
          ]},
          { type: "field", name: "subscribe",   inputType: "checkbox", label: "Form-collected checkbox (FieldNode)", value: "true" },
          { type: "field", name: "file",        inputType: "file",     label: "File upload" },
        ],
      },
    ]},

    // ── Standalone CheckboxNode ─────────────────────────────────────
    { type: "section", heading: "Checkbox (immediate dispatch)", children: [
      { type: "checkbox", name: "agree", checked: false, label: "Agree to terms (CheckboxNode — fires action on toggle)", action: { name: "toggle-agree" } },
      { type: "checkbox", name: "notif", checked: true,  label: "Email notifications enabled" },
    ]},

    // ── List + variants ─────────────────────────────────────────────
    { type: "section", heading: "List with variants", children: [
      { type: "list", children: [
        { type: "list-item", children: [
          { type: "text", value: "Default item",        style: "subheading" },
          { type: "text", value: "no variant set",      style: "muted" },
          { type: "button", label: "Delete", action: { name: "noop" }, variant: "danger" },
        ]},
        { type: "list-item", variant: "done", children: [
          { type: "text", value: "Completed item",                style: "subheading" },
          { type: "text", value: "list-item--done",               style: "muted" },
        ]},
        { type: "list-item", variant: "warning", children: [
          { type: "text", value: "Warning item",                  style: "subheading" },
          { type: "text", value: "list-item--warning",            style: "muted" },
        ]},
        { type: "list-item", variant: "high", children: [
          { type: "text", value: "High-priority item",            style: "subheading" },
          { type: "text", value: "list-item--high",               style: "muted" },
        ]},
        { type: "list-item", variant: "critical", children: [
          { type: "text", value: "Critical item",                 style: "subheading" },
          { type: "text", value: "list-item--critical",           style: "muted" },
        ]},
      ]},
    ]},

    // ── Table with sort, filter, link cell ──────────────────────────
    { type: "section", heading: "Table", children: [
      { type: "table",
        columns: [
          { key: "id",     label: "ID",     sortable: true },
          { key: "name",   label: "Name",   sortable: true,  filterable: true, filterValue: "" },
          { key: "status", label: "Status", filterable: true, filterValue: "open" },
          { key: "url",    label: "Link",   linkLabel: "open", linkExternal: true },
        ],
        rows: [
          { id: "1", cells: { id: "1", name: "Alpha",   status: "open",        url: "https://example.com/1" } },
          { id: "2", cells: { id: "2", name: "Bravo",   status: "in-progress", url: "https://example.com/2" }, variant: "warning" },
          { id: "3", cells: { id: "3", name: "Charlie", status: "resolved",    url: "https://example.com/3" }, variant: "done" },
          { id: "4", cells: { id: "4", name: "Delta",   status: "blocked",     url: "https://example.com/4" }, variant: "critical",
            action: { name: "noop", context: { id: "4" } } },
        ],
        sortColumn: "name",
        sortDirection: "asc",
        sortAction:   { name: "noop" },
        filterAction: { name: "noop" },
      },
    ]},

    // ── Modal ───────────────────────────────────────────────────────
    { type: "section", heading: "Modal", children: [
      { type: "text", value: "Modal renders below as if always-open. In real apps, conditionally include it from state.", style: "muted" },
      { type: "modal",
        title: "Confirm action",
        dismissAction: { name: "noop" },
        children: [
          { type: "text", value: "Are you sure you want to delete this item? This cannot be undone.", style: "body" },
          { type: "button", label: "Cancel",         action: { name: "noop" } },
          { type: "button", label: "Delete forever", action: { name: "noop" }, variant: "danger" },
        ],
      },
    ]},
  ],
};

const adapter = new BrowserAdapter(document.getElementById("app")!);
adapter.render(vm, action => console.log("[showcase] action dispatched:", action));
