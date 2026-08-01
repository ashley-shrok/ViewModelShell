// RichTextTasting — Phase 28 v8.2.0 Route B tasting sign-off page (plan 28-04).
// page-marker: rich-text-tasting
//
// A real-bundle, real-CSS side-by-side A/B harness for the D-03 earned-a-
// composite gate: Ashley eyeballs the primitives-composed rich text input
// (SectionNode(layout:row) header + ButtonNode toolbar + FieldNode textarea —
// the "pretty-bad-approximation" baseline) alongside the proposed
// RichTextFieldNode + RichTextToolbarNode composite (rendered via the just-
// shipped Plan 28-03 renderer + its INTERIM richTextToolbar() placeholder)
// and signs off (or redirects) before Plan 28-05 bakes the composite body.
//
// IFRAME-SCOPED per banked v8.0.3 lesson (2026-07-30): parent index.html
// carries the theme-switcher chrome + two iframes; each panel is a SELF-
// CONTAINED page (src/panel-*.html) with its OWN <link rel="stylesheet"> +
// <script src="./panel-*.ts">. A shared parent-level asset would cross-
// contaminate the comparison. Structural verification: parent index.html
// carries NO VMS mount and NO shared <script>/<link> covering both panels.
//
// Single Bun.serve process: serves the Vite-built client (dist/) + the
// shipped CSS files (default.css + themes/*.css) + the two /api/*/tree GET
// wires used by the panels (each panel calls its own endpoint so the two
// mounts stay independent). PID written to server.pid for cleanup.

import { readdirSync } from "node:fs";
import type { ViewNode } from "@ashley-shrok/viewmodel-shell/server";

// ─── The BEFORE panel tree — primitives composition ─────────────────────────

/**
 * "Pretty-bad-approximation" baseline the earned-a-composite rule
 * (composite-nodes-layer.md §2) requires: a SectionNode(layout:row) toolbar of
 * ButtonNodes over a FieldNode(inputType:"textarea"). Buttons dispatch to a
 * dead action so they're functionally inert but visually complete — click/
 * hover/focus states render exactly the same as the framework would render a
 * primitive-composed toolbar in a real app.
 */
function buildPrimitivesTree(): ViewNode {
  const tools = [
    { label: "B", tool: "bold" },
    { label: "I", tool: "italic" },
    { label: "Link", tool: "link" },
    { label: "Bullets", tool: "bullet-list" },
    { label: "Numbers", tool: "ordered-list" },
    { label: "H1", tool: "heading-1" },
    { label: "H2", tool: "heading-2" },
    { label: "H3", tool: "heading-3" },
    { label: "Code", tool: "inline-code" },
    { label: "Block", tool: "code-block" },
    { label: "Quote", tool: "blockquote" },
  ];
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
          "Buttons are functionally dead — they exist to show the visual bar the primitive-composed " +
          "shape hits. Same initial content as the AFTER panel for fair side-by-side comparison.",
        style: "muted",
      },
      {
        type: "section",
        layout: "row",
        arrange: "start",
        align: "center",
        children: tools.map((t) => ({
          type: "button" as const,
          label: t.label,
          action: { name: `toolbar-${t.tool}` },
          size: "sm" as const,
          emphasis: "secondary" as const,
        })),
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

// ─── The AFTER panel tree — composite via shipped renderer ──────────────────

/**
 * The proposed RichTextFieldNode + RichTextToolbarNode composite as it will
 * ship in v8.2.0. Plan 28-03 landed the renderer, the D-08 default-toolbar
 * floor CSS, and the INTERIM richTextToolbar() placeholder body. Passing an
 * explicit `toolbar?` slot (a full RichTextToolbarNode carrying all 11 D-08
 * tools + `size:"expanded"`) exercises both the shipped rich-text-field path
 * AND the composite dispatch arm, so Ashley eyeballs (a) the composite's
 * toolbar strip CSS when composed alongside the editor, (b) the semantic
 * HTML the composite emits, and (c) how the whole shape reads relative to
 * the primitive-composed baseline. Feedback drives Plan 28-05's finalization.
 *
 * Same initial content as the BEFORE panel — the ONLY variable across panels
 * is the toolbar shape (primitives vs composite).
 */
function buildCompositeTree(): ViewNode {
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

// Initial state — IDENTICAL across both panels so the ONLY variable is the
// toolbar shape (primitives vs composite). The "# Welcome / **bold** / `code`"
// content exercises headings + bold + inline-code so Ashley can see all three
// tool categories rendered.
const initialState = {
  draft: "# Welcome\n\nType something with **bold** or `code`.",
};

// ─── Shipped CSS discovery (theme enumeration at startup) ────────────────────

const stylesDir = new URL("../../viewmodel-shell/styles/", import.meta.url);
const themesDir = new URL("../../viewmodel-shell/styles/themes/", import.meta.url);

// Enumerate themes at server start so the switcher's option list matches
// what's actually on disk — mirrors AGENTS.md "the shipped themes ARE the
// directory contents" rule (concern→source; the dir CAN'T go stale).
const themeFiles = readdirSync(themesDir)
  .filter((n) => n.endsWith(".css"))
  .map((n) => n.replace(/\.css$/, ""))
  .sort();

async function serveShippedCss(pathname: string): Promise<Response | null> {
  // /vms/default.css → styles/default.css
  // /vms/themes/<name>.css → styles/themes/<name>.css
  const m = pathname.match(/^\/vms\/(default\.css|themes\/[a-z-]+\.css)$/);
  if (!m) return null;
  const file = Bun.file(new URL(m[1], stylesDir));
  if (await file.exists()) {
    return new Response(file, { headers: { "Content-Type": "text/css; charset=utf-8" } });
  }
  return new Response("Not Found", { status: 404 });
}

// ─── Vite-built client (dist/) ───────────────────────────────────────────────

const distDir = new URL("./dist/", import.meta.url);

async function serveStatic(pathname: string): Promise<Response> {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (rel.split("/").some((seg) => seg === "..")) {
    return new Response("Forbidden", { status: 403 });
  }
  const file = Bun.file(new URL(rel, distDir));
  if (await file.exists()) return new Response(file);
  // SPA-style fallback for extension-less client routes.
  if (!rel.includes(".")) {
    const index = Bun.file(new URL("index.html", distDir));
    if (await index.exists()) return new Response(index);
  }
  return new Response("Not Found", { status: 404 });
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? "3021");

// Write our PID for cleanup + schedule a 60-min auto-kill per the identity
// file's "how to show the user a visual change" recipe.
await Bun.write(new URL("./server.pid", import.meta.url), String(process.pid));
setTimeout(() => { console.log("RichTextTasting: 60-min auto-kill fired; exiting."); process.exit(0); }, 3600000);

Bun.serve({
  // hostname 0.0.0.0 so the page is reachable at 100.113.23.63:PORT on the
  // tailnet (host machine's tailscale IP) AND at 127.0.0.1 for local smoke.
  hostname: "0.0.0.0",
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // --- API: the two panel trees ---
    // Two separate endpoints per panel so the two BrowserAdapter mounts stay
    // fully independent (each panel's fetch-shim wouldn't be able to
    // demultiplex a shared endpoint). GET-only — the tasting page has no
    // action loop.
    if (url.pathname === "/api/primitives/tree" && request.method === "GET") {
      return Response.json({ vm: buildPrimitivesTree(), state: initialState });
    }
    if (url.pathname === "/api/composite/tree" && request.method === "GET") {
      return Response.json({ vm: buildCompositeTree(), state: initialState });
    }
    // --- API: the theme name list, enumerated at startup ---
    if (url.pathname === "/api/themes" && request.method === "GET") {
      return Response.json({ themes: themeFiles });
    }

    // --- Shipped CSS ---
    if (request.method === "GET") {
      const css = await serveShippedCss(url.pathname);
      if (css) return css;
    }

    // --- Everything else: the bundled shell client ---
    if (request.method === "GET") {
      return serveStatic(url.pathname);
    }
    return new Response("Method Not Allowed", { status: 405 });
  },
});

console.log(
  `RichTextTasting (Phase 28 Route B tasting sign-off) → ` +
    `http://100.113.23.63:${port}/  (PID ${process.pid}, auto-kill in 60 min)`,
);
