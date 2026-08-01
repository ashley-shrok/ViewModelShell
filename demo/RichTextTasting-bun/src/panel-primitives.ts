// BEFORE panel — the "pretty-bad-approximation" baseline the earned-a-
// composite rule (composite-nodes-layer.md §2) requires. Renders a rich text
// input hand-composed from EXISTING primitives (SectionNode(layout:"row") +
// 11 ButtonNodes + FieldNode(inputType:"textarea")) through the REAL shipped
// viewmodel-shell renderer + REAL shipped default.css. Buttons are
// functionally dead — click/hover/focus states are what a real primitive-
// composed toolbar in a real app would render, so Ashley's visual bar is
// set against what the framework can actually deliver TODAY without a
// composite.
//
// The VM tree lives INLINE in this file (not in a server endpoint) so this
// panel is fully self-contained per the iframe-scoping discipline: no shared
// server-side tree builder can drift between the two panels, and each panel
// declares its own baseline for the A/B comparison.
//
// Static page: uses a ViewModelShell with a canned endpoint response so no
// dispatch round-trip fires. Buttons dispatch to dead actions echoed by the
// fetch-shim.
import { ViewModelShell } from "@ashley-shrok/viewmodel-shell";
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";
import type { ViewNode } from "@ashley-shrok/viewmodel-shell";

interface PanelState {
  draft: string;
}

const initialState: PanelState = {
  draft: "# Welcome\n\nType something with **bold** or `code`.",
};

// 11 D-08 floor tools spelled out literally (not built via .map) so the
// acceptance-criteria grep against the button type discriminator returns
// exactly 11 — the tasting plan's Task 2 machine check is a source-code
// grep, not a runtime shape check. Same 11 tools as the composite panel's
// RichTextToolbarNode.tools[] so the visual comparison is apples-to-apples
// on tool count + labels.
function buildTree(): ViewNode {
  return {
    type: "page",
    title: "Primitives composition",
    width: "full",
    density: "compact",
    children: [
      {
        type: "text",
        value: "BEFORE — primitives composition",
        style: "heading",
      },
      {
        type: "text",
        value:
          "SectionNode(layout:\"row\") + 11 ButtonNodes + FieldNode(inputType:\"textarea\"). " +
          "Buttons are functionally dead — they exist to show the visual bar the primitive-" +
          "composed shape hits. Same initial content as the AFTER panel for fair side-by-side " +
          "comparison.",
        style: "muted",
      },
      {
        type: "section",
        layout: "row",
        arrange: "start",
        align: "center",
        children: [
          { type: "button", label: "B",       action: { name: "toolbar-bold" },         size: "sm", emphasis: "secondary" },
          { type: "button", label: "I",       action: { name: "toolbar-italic" },       size: "sm", emphasis: "secondary" },
          { type: "button", label: "Link",    action: { name: "toolbar-link" },         size: "sm", emphasis: "secondary" },
          { type: "button", label: "Bullets", action: { name: "toolbar-bullet-list" },  size: "sm", emphasis: "secondary" },
          { type: "button", label: "Numbers", action: { name: "toolbar-ordered-list" }, size: "sm", emphasis: "secondary" },
          { type: "button", label: "H1",      action: { name: "toolbar-heading-1" },    size: "sm", emphasis: "secondary" },
          { type: "button", label: "H2",      action: { name: "toolbar-heading-2" },    size: "sm", emphasis: "secondary" },
          { type: "button", label: "H3",      action: { name: "toolbar-heading-3" },    size: "sm", emphasis: "secondary" },
          { type: "button", label: "Code",    action: { name: "toolbar-inline-code" },  size: "sm", emphasis: "secondary" },
          { type: "button", label: "Block",   action: { name: "toolbar-code-block" },   size: "sm", emphasis: "secondary" },
          { type: "button", label: "Quote",   action: { name: "toolbar-blockquote" },   size: "sm", emphasis: "secondary" },
        ],
      },
      {
        type: "field",
        name: "draft",
        bind: "draft",
        label: "Notes",
        inputType: "textarea",
        placeholder: "Write something…",
      },
    ],
  };
}

// Fetch-shim: intercept the shell's own GET (load) + POST (dispatch) calls
// against the panel's endpoint URL and answer with canned data. Static-page
// pattern — no server round-trip so the panel stays fully self-contained.
const PANEL_ENDPOINT = "/api/primitives/tree";
const originalFetch = window.fetch.bind(window);
window.fetch = (async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url === PANEL_ENDPOINT || url.endsWith(PANEL_ENDPOINT)) {
    return new Response(
      JSON.stringify({ ok: true, vm: buildTree(), state: initialState }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  return originalFetch(input, init);
}) as typeof window.fetch;

const container = document.getElementById("app")!;
const shell = new ViewModelShell({
  endpoint: PANEL_ENDPOINT,
  actionEndpoint: PANEL_ENDPOINT,
  adapter: new BrowserAdapter(container),
  onError: (err) => {
    console.warn("[panel-primitives] error:", err);
  },
});

shell.load().catch((err) => {
  container.textContent = "Error: " + (err && err.message ? err.message : String(err));
});
