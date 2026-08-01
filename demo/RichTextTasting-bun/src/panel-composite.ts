// AFTER panel — the proposed RichTextFieldNode + RichTextToolbarNode
// composite as it will ship in v8.2.0. Renders one RichTextFieldNode with
// an explicit RichTextToolbarNode(tools=[all 11 D-08 floor], size="expanded")
// slot through the REAL shipped Plan 28-03 renderer (which owns the field
// wrapper, editor host, default-toolbar path, and STYLE-3 state axis CSS) +
// the INTERIM richTextToolbar() placeholder body that Plan 28-05 will
// finalize after this sign-off.
//
// TipTap + turndown are LAZY-loaded from browser.ts on first render of the
// rich-text-field arm (Chart.js precedent — see Plan 28-03 summary §Task 2
// item 11 for the load site). Consumers who never render one ship zero
// TipTap/turndown bytes; this panel DOES render one, so the initial fetch
// pulls TipTap + turndown + marked in parallel via the loader's Promise.all.
// Fail-loud posture: if any of the 3 modules fails to load, richTextFailLoud
// fires a hard Error via console.error and the editor host stays empty (no
// silent no-op, no falling back to a plain textarea — same fail-loud rule
// as Chart's precedent).
//
// The VM tree lives INLINE in this file (not in a server endpoint) so this
// panel is fully self-contained per the iframe-scoping discipline: no
// shared server-side tree builder can drift between the two panels.
//
// Static page: uses a ViewModelShell with a canned endpoint response so no
// dispatch round-trip fires. Toolbar buttons drive TipTap chain commands
// CLIENT-SIDE (bold/italic/link/etc.), NOT wire actions.
//
// NO top-level import of @tiptap/core or turndown — the lazy-load in
// browser.ts drives all of that, and a top-level import here would defeat
// the D-04 SYMMETRIC LAZY-LOAD guarantee.
import { ViewModelShell } from "@ashley-shrok/viewmodel-shell";
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";
import type { ViewNode } from "@ashley-shrok/viewmodel-shell";

interface PanelState {
  draft: string;
}

const initialState: PanelState = {
  draft: "# Welcome\n\nType something with **bold** or `code`.",
};

function buildTree(): ViewNode {
  return {
    type: "page",
    title: "Composite proposal",
    width: "full",
    density: "compact",
    children: [
      {
        type: "text",
        value: "AFTER — RichTextFieldNode + RichTextToolbarNode composite",
        style: "heading",
      },
      {
        type: "text",
        value:
          "One RichTextFieldNode with an explicit RichTextToolbarNode(tools=[all 11 D-08 floor], " +
          "size=\"expanded\") slot. Rendered via the shipped Plan 28-03 renderer + the INTERIM " +
          "richTextToolbar() placeholder body (Plan 28-05 bakes the finalized shape after this " +
          "sign-off). Same initial content as the BEFORE panel.",
        style: "muted",
      },
      {
        type: "rich-text-field",
        name: "notes",
        bind: "draft",
        label: "Notes",
        placeholder: "Write something…",
        toolbar: {
          type: "rich-text-toolbar",
          tools: [
            "bold",
            "italic",
            "link",
            "bullet-list",
            "ordered-list",
            "heading-1",
            "heading-2",
            "heading-3",
            "inline-code",
            "code-block",
            "blockquote",
          ],
          size: "expanded",
        },
      },
    ],
  };
}

// Fetch-shim: intercept the shell's own GET (load) + POST (dispatch) calls
// against the panel's endpoint URL and answer with canned data. Static-page
// pattern — no server round-trip. The rich-text-field renderer's writeBind
// on editor.on("update", ...) mutates the shell's client-held state but
// doesn't need a server to acknowledge; the fetch-shim would echo any POST
// as if the server did.
const PANEL_ENDPOINT = "/api/composite/tree";
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
    console.warn("[panel-composite] error:", err);
  },
});

shell.load().catch((err) => {
  container.textContent = "Error: " + (err && err.message ? err.message : String(err));
});
