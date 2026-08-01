// RichTextVerification — Phase 28 v8.2.0 rich text primitive tailnet sign-off
// page (plan 28-09). page-marker: rich-text-verification
//
// A real-bundle, real-CSS, real-tree-validator human-verification harness for
// the full rich text primitive shipped across Plans 28-01..28-08. Ashley
// cycles through the 12 shipped themes + eyeballs 8 render scenarios covering
// the whole surface (default toolbar / composite toolbar / size axis / tone
// axis / STYLE-3 state axis / standalone toolbar / empty placeholder / rich-
// content pre-load). Sign-off gates the green-tree run (Plan 28-10) and the
// v8.2.0 release ritual (Plan 28-11).
//
// Structural template: demo/StateAxisVerification-bun/server.ts (Phase 27's
// post-implementation verification demo). Same shape:
//   - Bun.serve on 0.0.0.0:3022 (tailnet-reachable).
//   - Serves /vms/default.css + /vms/themes/*.css verbatim from
//     ../../viewmodel-shell/styles/.
//   - Serves the Vite-built client (dist/).
//   - GET /api/probe/tree returns the 8-scenario verification VM +
//     initial state (single-canvas scrollable page — NOT iframe-scoped
//     because this is a full-primitive walkthrough on a single shipped
//     bundle, not an A/B comparison of different asset versions).
//   - GET /api/themes returns the theme name list enumerated at startup.
//   - POST /api/probe/tree echoes state back (verification page has no
//     server-side action logic — it's a rendering harness).
//   - PID written to server.pid at startup + 60-min auto-kill.
//
// The banked v8.0.3 iframe-scoping lesson (2026-07-30) applies to A/B panels
// hinging on different asset versions. All 8 scenarios here share the SAME
// shipped bundle + CSS — no iframe scoping needed (a shared page is exactly
// what makes theme cycling ergonomic: one theme swap re-styles all 8
// scenarios simultaneously). Iframe scoping would DEFEAT the purpose here.
//
// Banked lesson from Phase 21/24 real-validator shim: the tree built by
// buildVerificationTree() is run through the REAL shipped validators
// (validateActionNames + validateSectionAction from viewmodel-shell/src/server)
// BEFORE returning. If validation fails, the response emits an error tree
// instead of the intended tree — the page fails VISIBLY at load rather than
// silently rendering an invalid tree that the real server would reject.

import { readdirSync } from "node:fs";
import type { ViewNode } from "@ashley-shrok/viewmodel-shell";
import {
  validateActionNames,
  validateSectionAction,
} from "@ashley-shrok/viewmodel-shell/server";

// ─── The 8 verification scenarios ────────────────────────────────────────────

/**
 * Rich-content markdown seed for scenario (h): every D-08 feature the floor
 * supports (h1/h2/h3, bullet + ordered lists, blockquote, inline code, code
 * block with language). Proves marked pre-load + editor round-trip on the
 * shipped renderer + the Plan 28-05 editor-host inner-node CSS polish (the
 * blockquote / pre / code / pre-code rules Ashley signed off in 28-04).
 */
const RICH_CONTENT_SEED = `# Rich content pre-load probe

## Second-level heading

### Third-level heading

A paragraph with **bold**, *italic*, and \`inline code\` marks, and a
[safe link](https://example.com) inline. Below: every list + block form
the D-08 floor supports.

- Bullet list item one
- Bullet list item two
- Bullet list item three

1. Ordered list item one
2. Ordered list item two
3. Ordered list item three

> A blockquote — check that the shipped .vms-rich-text-field__editor blockquote
> rule (Plan 28-05 CSS polish) is honored: border-left, italic, muted color.

\`\`\`typescript
// A fenced code block. Check that .vms-rich-text-field__editor pre + pre code
// rules are honored (Plan 28-05): code-bg + code-fg + border + radius + mono
// font, with pre code resetting the double-styling.
function hello(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`
`;

/**
 * Adversarial markdown seed for scenario (g): a sanitization proof. The
 * Plan 28-06 sanitizer (`sanitizeUrlScheme` on both backends, running BEFORE
 * the opt-in linkHrefRewrite hook) whitelists http/https/mailto/tel/ftp +
 * relative and refuses everything else. The four dangerous schemes below
 * should render as text with NO clickable href in any later display context.
 *
 * (The initial-content pre-load path in browser.ts goes through TipTap's
 * setContent(marked(md)) — TipTap's HTML parser sanitizes href schemes
 * independently. So this scenario proves the read-side sanitizer holds via
 * the same shipped markdown → InlineRuns pipeline that display uses. On the
 * READ side the sanitizer runs; the user sees a rendered document with the
 * dangerous links neutralized.)
 */
const ADVERSARIAL_MARKDOWN_SEED = `## Sanitization proof (Plan 28-06)

Every dangerous scheme below MUST render as text — NO clickable href, NO
javascript execution, NO cross-scheme escape. Whitelist covers http/https/
mailto/tel/ftp + relative; everything else is stripped to the empty string
per viewmodel-shell/src/markdown.ts sanitizeUrlScheme.

- Regular link (SAFE, should be clickable): [example.com](https://example.com)
- javascript scheme (SHOULD BE NEUTRALIZED): [click](javascript:alert(1))
- data:text/html scheme (SHOULD BE NEUTRALIZED): [click](data:text/html,<script>alert(1)</script>)
- vbscript scheme (SHOULD BE NEUTRALIZED): [click](vbscript:msgbox)
- file:/// scheme (SHOULD BE NEUTRALIZED): [click](file:///etc/passwd)
`;

function buildVerificationTree(): ViewNode {
  return {
    type: "page",
    title: "Phase 28 rich text verification",
    width: "wide",
    children: [
      {
        type: "text",
        value: "Phase 28 rich text primitive verification — 8 scenarios × 12 themes",
        style: "heading",
      },
      {
        type: "text",
        value:
          "Rendered by the real shipped viewmodel-shell bundle (Plans 28-01..28-08) + shipped default.css + a runtime 13-option theme switcher (top of page — default + 12 themes). Every scenario is a REAL emission by the REAL renderer against the REAL shipped CSS + the REAL shipped tree validator on the server side. Cycle through EVERY theme and eyeball each scenario for readability, contrast, and layout integrity.",
        style: "muted",
      },
      {
        type: "section",
        heading: "What to check",
        variant: "card",
        tone: "info",
        children: [
          {
            type: "text",
            value:
              "① Default toolbar (scenario 1): visible 11-button toolbar strip below the label, buttons clickable, hover state legible.",
          },
          {
            type: "text",
            value:
              "② Explicit composite toolbar (scenario 2): identical shape to scenario 1's default, all 11 D-08 tools present in the closed-enum order.",
          },
          {
            type: "text",
            value:
              "③ size:compact (scenario 3): visibly denser than expanded — smaller button padding.",
          },
          {
            type: "text",
            value:
              "④ tone:info (scenario 4): tinted background legible + contrast readable across all 12 themes.",
          },
          {
            type: "text",
            value:
              "⑤ state axis (scenario 5): STYLE-3 border-left + weight:600 primary on state:active; opacity 0.72 on state:done; opacity 0.55 on state:disabled — matches every other Phase 27 composite.",
          },
          {
            type: "text",
            value:
              "⑥ Standalone toolbar (scenario 6): renders visually; clicking a button triggers console.warn (open devtools) — expected warn-not-throw contract from Plan 28-05.",
          },
          {
            type: "text",
            value:
              "⑦ Empty bind + placeholder (scenario 7): placeholder text visible when editor is empty; typing writes back to bind.",
          },
          {
            type: "text",
            value:
              "⑧ Rich pre-load (scenario 8): all D-08 features rendered from markdown seed — headings, both list types, blockquote (border-left italic muted), code block (monospace + border + code palette), inline code. Editor-host CSS from Plan 28-05 sign-off polish.",
          },
          {
            type: "text",
            value:
              "⑨ Sanitization proof (scenario g extra, in initial state): the 4 dangerous-scheme markdown links (javascript/data/vbscript/file) must NOT render as clickable hrefs when displayed — the Plan 28-06 whitelist sanitizer holds.",
          },
          {
            type: "text",
            value:
              "⑩ 12-theme cycle: use the theme switcher at the top of the page to cycle through every shipped theme. Every scenario should read cleanly in every theme (no palette clashes, no contrast issues, no layout collapse).",
          },
        ],
      },
      { type: "divider" },

      // ── Scenario 1: Default toolbar (no toolbar slot) ────────────────────
      buildScenario(
        "1. Default toolbar (no toolbar slot)",
        "The framework's shipped D-08 floor toolbar renders automatically when the RichTextFieldNode carries no toolbar slot. This is the DEFAULT path every consumer gets \"for free\" — 11 buttons wired to TipTap chain commands, standardized styling, keyboard accessibility, ARIA labels.",
        {
          type: "rich-text-field",
          name: "scenario-1-default",
          bind: "draft1",
          label: "Default toolbar field",
          placeholder: "Type here — try each of the 11 toolbar buttons…",
        },
      ),

      // ── Scenario 2: Explicit RichTextToolbarNode composite slot ──────────
      buildScenario(
        "2. Explicit RichTextToolbarNode composite (all 11 D-08 tools, size:expanded)",
        "Passing an explicit composite toolbar slot with tools=[all 11 D-08 floor tools] should render VISUALLY IDENTICALLY to scenario 1's default path. The composite is the ABSTRACTION SEAM (Plan 28-05) — same underlying applyRichTextTool() chain-command mapping; the composite adds closed-enum variance addressability, not new behavior.",
        {
          type: "rich-text-field",
          name: "scenario-2-composite",
          bind: "draft2",
          label: "Composite toolbar field (expanded)",
          placeholder: "Same shape as scenario 1 — composite slot with expanded size.",
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
      ),

      // ── Scenario 3: size:compact toolbar ─────────────────────────────────
      buildScenario(
        "3. size:compact composite toolbar",
        "Compact size — visibly denser button padding for space-constrained contexts. Same 11 tools, same behavior, tighter footprint. Rendered via .vms-rich-text-toolbar--size-compact BEM modifier (Plan 28-05 CSS).",
        {
          type: "rich-text-field",
          name: "scenario-3-compact",
          bind: "draft3",
          label: "Compact toolbar field",
          placeholder: "Denser toolbar — same 11 tools, tighter spacing.",
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
            size: "compact",
          },
        },
      ),

      // ── Scenario 4: tone:info toolbar ────────────────────────────────────
      buildScenario(
        "4. tone:info composite toolbar",
        "Semantic tone axis — the framework-wide tone token (mirrors ButtonNode.tone). Rendered via .vms-rich-text-toolbar--tone-info (color-mix on --vms-info) per Plan 28-05 CSS. Check contrast across all 12 themes: the info-tinted background must remain legible.",
        {
          type: "rich-text-field",
          name: "scenario-4-tone-info",
          bind: "draft4",
          label: "Info-toned toolbar field",
          placeholder: "Toolbar strip is tinted with the info tone token.",
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
            tone: "info",
          },
        },
      ),

      // ── Scenario 5: state axis (active / done / disabled) ────────────────
      {
        type: "section",
        heading: "5. state axis — STYLE-3 uniformity (active / done / disabled)",
        variant: "card",
        children: [
          {
            type: "text",
            value:
              "Phase 27 STYLE-3 uniformity applied to RichTextFieldNode per Phase 28. state:\"active\" → border-left 3px accent + weight:600 primary; state:\"done\" → opacity 0.72; state:\"disabled\" → opacity 0.55. Rendered via .vms-rich-text-field--state-{active,done,disabled} BEM modifiers (Plan 28-05 CSS).",
            style: "muted",
          },
          {
            type: "section",
            layout: "cards",
            minItem: "lg",
            children: [
              {
                type: "section",
                variant: "card",
                children: [
                  { type: "text", value: "state:\"active\"", style: "caption" },
                  {
                    type: "rich-text-field",
                    name: "scenario-5-active",
                    bind: "draft5a",
                    label: "Active field",
                    placeholder: "state:active — border-left + weight:600 primary",
                    state: "active",
                  },
                ],
              },
              {
                type: "section",
                variant: "card",
                children: [
                  { type: "text", value: "state:\"done\"", style: "caption" },
                  {
                    type: "rich-text-field",
                    name: "scenario-5-done",
                    bind: "draft5b",
                    label: "Done field",
                    placeholder: "state:done — opacity 0.72",
                    state: "done",
                  },
                ],
              },
              {
                type: "section",
                variant: "card",
                children: [
                  { type: "text", value: "state:\"disabled\"", style: "caption" },
                  {
                    type: "rich-text-field",
                    name: "scenario-5-disabled",
                    bind: "draft5c",
                    label: "Disabled field",
                    placeholder: "state:disabled — opacity 0.55",
                    state: "disabled",
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: "divider" },

      // ── Scenario 6: Standalone RichTextToolbarNode (warn-not-throw) ──────
      buildScenario(
        "6. Standalone RichTextToolbarNode (no ancestor field — warn-not-throw)",
        "The composite renders visually even without an ancestor RichTextFieldNode wrapper (tasting / design-demo legitimacy). Clicking a button triggers console.warn (open devtools to observe) and no-ops — never throws, never hijacks a sibling editor. STRIDE T-28-13 disposition from Plan 28-05: DOM `closest()` walk provides the security bound; warn provides the debugging signal; no-op provides the standalone-legitimacy.",
        {
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
      ),

      // ── Scenario 7: Empty bind + placeholder ─────────────────────────────
      buildScenario(
        "7. Empty bind + placeholder (mount pathway proof)",
        "Empty markdown bind (\"\") — placeholder text should show inside the editor host. Proves the initial-content pre-load pathway handles the empty case without a mount error, and that the TipTap Placeholder extension (or CSS-based placeholder fallback) is wired correctly.",
        {
          type: "rich-text-field",
          name: "scenario-7-empty",
          bind: "draft7",
          label: "Empty field with placeholder",
          placeholder: "This placeholder should be visible when the editor is empty.",
        },
      ),

      // ── Scenario 8: Rich bind (every D-08 feature) ───────────────────────
      buildScenario(
        "8. Rich bind — every D-08 feature pre-loaded (marked → setContent round-trip)",
        "The bind is seeded with markdown covering EVERY D-08 feature: h1/h2/h3, bullet list, ordered list, blockquote, inline code, fenced code block. The editor should render all of them from the initial markdown → HTML pre-load via marked + editor.setContent(). This is where Ashley's Plan 28-04 sign-off adjustment (blockquote + code-block styling polish) shows up — the editor-host CSS from Plan 28-05 makes these render design-system-consistent, NOT browser-default.",
        {
          type: "rich-text-field",
          name: "scenario-8-rich",
          bind: "draft8",
          label: "Rich content field",
          placeholder: "(pre-seeded with rich markdown; placeholder unused)",
        },
      ),
    ],
  };
}

/**
 * Helper — wraps a scenario in a labeled Section(card) with a description
 * paragraph + the demonstrated node + a divider. Keeps the 8 scenarios
 * visually distinct so Ashley can eyeball each one without confusion.
 */
function buildScenario(
  heading: string,
  description: string,
  node: ViewNode,
): ViewNode {
  return {
    type: "section",
    heading,
    variant: "card",
    children: [
      { type: "text", value: description, style: "muted" },
      node,
      { type: "divider" },
    ],
  } as ViewNode;
}

/**
 * Initial state seeded per-scenario. Distinct bind paths keep each field
 * independent (typing in scenario 1 does not affect scenario 2).
 *
 * Scenarios that need pre-loaded content: draft8 gets the RICH_CONTENT_SEED
 * (proves marked pre-load). Scenarios 1-4 get a light seed to give Ashley a
 * clickable starting point for each toolbar. Scenario 5 (state axis) gets
 * lightweight per-cell seeds. Scenario 7 gets an empty string (placeholder
 * pathway). The adversarial sanitization seed rides on draft1 alongside the
 * default-toolbar scenario so it's visible on load without a dedicated
 * scenario.
 */
const INITIAL_STATE: Record<string, string> = {
  draft1: `# Welcome — default toolbar scenario\n\nTry each of the 11 toolbar buttons. Also inline sanitization proof:\n\n${ADVERSARIAL_MARKDOWN_SEED}`,
  draft2: `# Composite toolbar scenario\n\nThis field's toolbar is an **explicit** RichTextToolbarNode slot with size:\`expanded\`.\nShould look identical to scenario 1.`,
  draft3: `# Compact composite\n\nSmaller button padding — same 11 D-08 tools.`,
  draft4: `# Info-toned toolbar\n\nThe strip is tinted with the info tone token — verify contrast in every theme.`,
  draft5a: `**Active** — border-left + weight:600 primary`,
  draft5b: `**Done** — opacity 0.72`,
  draft5c: `**Disabled** — opacity 0.55`,
  draft7: "",
  draft8: RICH_CONTENT_SEED,
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
    return new Response(file, {
      headers: { "Content-Type": "text/css; charset=utf-8" },
    });
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

/**
 * Banked-lesson wrapper: build the verification tree, then run it through the
 * REAL shipped validators (validateActionNames + validateSectionAction from
 * viewmodel-shell/src/server) BEFORE returning. If validation throws, log to
 * console.error AND return an error-message tree so the page fails VISIBLY
 * at load — a permissive shim accepting invalid trees would hide validator
 * bugs (banked lesson from Phase 21/24).
 */
function buildValidatedTree(): { vm: ViewNode; validated: boolean; errorMessage?: string } {
  const vm = buildVerificationTree();
  try {
    validateActionNames(vm);
    validateSectionAction(vm);
    return { vm, validated: true };
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);
    console.error(
      "[RichTextVerification] REAL tree validator REJECTED the constructed tree. " +
        "The shim's built VM would be rejected by the real server:",
      errorMessage,
    );
    // Return an error tree so the page fails VISIBLY rather than silently
    // rendering an invalid tree. See banked lesson §Phase 21/24.
    const errorTree: ViewNode = {
      type: "page",
      title: "Phase 28 verification — VALIDATOR REJECTED TREE",
      children: [
        {
          type: "text",
          value: "REAL tree validator REJECTED the constructed verification tree",
          style: "heading",
        },
        {
          type: "section",
          heading: "Validator error",
          variant: "card",
          tone: "danger",
          children: [
            { type: "text", value: errorMessage, style: "body" },
            {
              type: "text",
              value:
                "The verification page's fetch-shim invokes the REAL shipped validators " +
                "(validateActionNames + validateSectionAction from viewmodel-shell/src/server) " +
                "BEFORE returning any tree — a permissive shim accepting invalid trees would " +
                "hide validator bugs (banked lesson from Phase 21/24 real-validator shim).",
              style: "muted",
            },
          ],
        },
      ],
    };
    return { vm: errorTree, validated: false, errorMessage };
  }
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? "3022");

// Write our PID for cleanup + schedule a 60-min auto-kill per the identity
// file's "how to show the user a visual change" recipe. If the operator needs
// the page after the timeout, re-run `bun run start`.
await Bun.write(new URL("./server.pid", import.meta.url), String(process.pid));
setTimeout(() => {
  console.log("RichTextVerification: 60-min auto-kill fired; exiting.");
  process.exit(0);
}, 3600000);

Bun.serve({
  // hostname 0.0.0.0 so the page is reachable at 100.113.23.63:PORT on the
  // tailnet (host machine's tailscale IP) AND at 127.0.0.1 for local smoke.
  hostname: "0.0.0.0",
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // --- API: the 8-scenario verification tree (VALIDATED) ---
    if (url.pathname === "/api/probe/tree" && request.method === "GET") {
      const { vm, validated, errorMessage } = buildValidatedTree();
      return Response.json({
        ok: true,
        vm,
        state: INITIAL_STATE,
        _validator: validated ? "passed" : `FAILED: ${errorMessage}`,
      });
    }
    // --- API: POST echoes state back (verification page has no server-side
    // action logic; it's a rendering harness). Real-validator still runs on
    // the returned tree so a state-driven re-render can't smuggle in an
    // invalid VM. ---
    if (url.pathname === "/api/probe/tree" && request.method === "POST") {
      let echoedState: unknown = {};
      try {
        // multipart/form-data (BrowserAdapter default) — extract _state.
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("multipart/form-data")) {
          const form = await request.formData();
          const stateStr = form.get("_state");
          if (typeof stateStr === "string") echoedState = JSON.parse(stateStr);
        } else if (contentType.includes("application/json")) {
          const body = (await request.json()) as { state?: unknown };
          echoedState = body.state ?? {};
        }
      } catch (err) {
        console.error("[RichTextVerification] Failed to parse POST body:", err);
      }
      const { vm } = buildValidatedTree();
      return Response.json({ ok: true, vm, state: echoedState });
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
  `RichTextVerification (Phase 28 v8.2.0 rich text primitive sign-off) → ` +
    `http://100.113.23.63:${port}/  (PID ${process.pid}, auto-kill in 60 min)`,
);
console.log(`  Themes enumerated at startup: ${themeFiles.length} (${themeFiles.join(", ")})`);
