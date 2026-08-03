// ChatComposerVerification — Phase 30 v9.1.0 ChatComposerNode Route B composite
// tailnet sign-off page (Plan 30-09). page-marker: chat-composer-verification
//
// A real-bundle, real-CSS, real-tree-validator human-verification harness for
// the full ChatComposerNode primitive shipped across Plans 30-01..30-06.
// Ashley cycles through the 13 shipped themes (default + 12) + eyeballs 12
// iframe-scoped render scenarios covering the whole surface:
//
//   1. DEFAULT — bare bind + sendAction
//   2. WITH ATTACH — attachAction set
//   3. ALL SLOTS FILLED — header + leading + trailing + footer
//   4. STREAMING STATE — status=streaming + stopAction
//   5. SENDING STATE — status=sending
//   6. DISABLED
//   7. SUBMITMODE ctrl-enter
//   8. DROPSCOPE global
//   9. MAX-FILE VALIDATION — maxFiles + maxFileSize + accept
//   10. INPUT SLOT — RichTextFieldNode
//   11. MAX ROWS OVERRIDE — maxRows=3
//   12. HEADER SLOT COMPOSITION WITH ATTACHED FILES (fake-paste driven)
//
// Ashley's sign-off gates Plans 30-10 (Angel adopter) + 30-11 (green-tree +
// release ritual).
//
// Structural template: demo/RichTextVerification-bun/server.ts (Phase 28-09).
// KEY DEPARTURE: this page is IFRAME-SCOPED per Vicky's tasting artifact
// (~/.claude/identities/vicky/bounties/chat-composer-primitive/tasting/). Each
// of the 12 panels is a separate iframe with its own shipped CSS + own theme
// link + own ViewModelShell mount + own /api/panel/{N}/tree fetch. Prevents
// CSS/JS cross-contamination between panels demonstrating different variants
// side-by-side.
//
// Theme switching: the parent chrome carries the switcher <select>. On change,
// the parent postMessage's the new theme href to every iframe; each iframe's
// inline <script> subscribes and swaps its own #theme-css <link> href.
// Same-origin postMessage guarded by event.origin on the iframe side.
//
// Real-validator (banked lesson from Phase 21/24): each panel's tree is built
// SERVER-SIDE in this file and run through the REAL shipped validators
// (validateActionNames + validateSectionAction from
// viewmodel-shell/src/server) BEFORE returning to the browser. If validation
// throws, the response VM contains an inline danger banner so the failure is
// VISIBLE at load rather than silently rendering an invalid tree. A
// permissive shim accepting invalid trees would hide validator bugs — this
// server IS the shim, and it enforces the real contract.
//
//   - Bun.serve on 0.0.0.0:3023 (tailnet-reachable, first-free ≥ 3023 if
//     3023 collides — StateAxis=3020, RichTextTasting=3021,
//     RichTextVerification=3022, so 3023 is the correct default).
//   - Serves /vms/default.css + /vms/themes/*.css verbatim from
//     ../../viewmodel-shell/styles/.
//   - Serves the Vite-built client (dist/) — 13 entry HTMLs (index +
//     panels/panel-{1..12}) + shared main.ts.
//   - GET /api/themes returns the theme name list enumerated at startup
//     (single source of truth = the themes/ directory contents).
//   - GET /api/panel/{N}/tree returns the validated VM + initial state for
//     panel N (1..12). POST echoes state (no server-side action logic;
//     rendering harness only).
//   - PID written to server.pid at startup + 60-min auto-kill discipline.

import { readdirSync } from "node:fs";
import type {
  ViewNode,
  PageNode,
  ChatComposerNode,
  TextNode,
  IconNode,
  RichTextFieldNode,
} from "@ashley-shrok/viewmodel-shell";
import {
  validateActionNames,
  validateSectionAction,
} from "@ashley-shrok/viewmodel-shell/server";

// ─── Per-panel VM catalog ────────────────────────────────────────────────────

interface PanelSpec {
  tree: PageNode;
  initialState: Record<string, unknown>;
}

function caption(value: string): TextNode {
  return { type: "text", value, style: "caption" };
}

function pageWith(children: ViewNode[]): PageNode {
  return {
    type: "page",
    children,
    // "full" — the iframe hosts are narrow; the default page cap can leave
    // the composer floating awkwardly. Each panel uses the whole iframe
    // width so the pill surface renders realistically at compose width.
    width: "full",
  };
}

const PANELS: Record<number, PanelSpec> = {
  // ── 1. DEFAULT ───────────────────────────────────────────────────────────
  1: {
    tree: pageWith([
      caption("Bare composer — bind + sendAction only"),
      {
        type: "chat-composer",
        bind: "draft",
        sendAction: { name: "send" },
        placeholder: "Type a message…",
      } satisfies ChatComposerNode,
    ]),
    initialState: { draft: "" },
  },

  // ── 2. WITH ATTACH ───────────────────────────────────────────────────────
  2: {
    tree: pageWith([
      caption("attachAction set — leading paperclip renders + is clickable"),
      {
        type: "chat-composer",
        bind: "draft",
        sendAction: { name: "send" },
        attachAction: { name: "attach" },
        attachBind: "attachments",
        placeholder: "Attach a file or type…",
      } satisfies ChatComposerNode,
    ]),
    initialState: { draft: "" },
  },

  // ── 3. ALL SLOTS FILLED ──────────────────────────────────────────────────
  3: {
    tree: pageWith([
      caption("Every typed slot filled: header + leading + trailing + footer"),
      {
        type: "chat-composer",
        bind: "draft",
        sendAction: { name: "send" },
        attachAction: { name: "attach" },
        placeholder: "Type your prompt…",
        headerSlot: {
          type: "text",
          value: "Reply to Ashley:",
          tone: "info",
          style: "caption",
        } satisfies TextNode,
        leadingSlot: {
          type: "icon",
          name: "sparkles",
          size: "sm",
          label: "AI prompt indicator",
        } satisfies IconNode,
        trailingSlot: {
          type: "text",
          value: "GPT-4",
          style: "caption",
        } satisfies TextNode,
        footerSlot: {
          type: "text",
          value: "AI can make mistakes — verify important info",
          style: "caption",
          tone: "info",
        } satisfies TextNode,
      } satisfies ChatComposerNode,
    ]),
    initialState: { draft: "" },
  },

  // ── 4. STREAMING STATE ───────────────────────────────────────────────────
  4: {
    tree: pageWith([
      caption(
        "status=streaming — send button swaps to square stop icon; click fires stopAction (check console)",
      ),
      {
        type: "chat-composer",
        bind: "draft",
        sendAction: { name: "send" },
        stopAction: { name: "stop" },
        status: "streaming",
        placeholder: "AI is responding — click stop to abort",
      } satisfies ChatComposerNode,
    ]),
    initialState: { draft: "Explain quantum computing" },
  },

  // ── 5. SENDING STATE ─────────────────────────────────────────────────────
  5: {
    tree: pageWith([
      caption("status=sending — spinner icon; button disabled"),
      {
        type: "chat-composer",
        bind: "draft",
        sendAction: { name: "send" },
        status: "sending",
        placeholder: "Sending…",
      } satisfies ChatComposerNode,
    ]),
    initialState: { draft: "This message is being sent" },
  },

  // ── 6. DISABLED ──────────────────────────────────────────────────────────
  6: {
    tree: pageWith([
      caption("disabled=true — whole composer muted; all inputs blocked"),
      {
        type: "chat-composer",
        bind: "draft",
        sendAction: { name: "send" },
        attachAction: { name: "attach" },
        disabled: true,
        placeholder: "Composer is disabled",
      } satisfies ChatComposerNode,
    ]),
    initialState: { draft: "" },
  },

  // ── 7. submitMode=ctrl-enter ─────────────────────────────────────────────
  7: {
    tree: pageWith([
      caption(
        "submitMode=ctrl-enter — plain Enter inserts newline; Ctrl+Enter dispatches send (check console)",
      ),
      {
        type: "chat-composer",
        bind: "draft",
        sendAction: { name: "send" },
        submitMode: "ctrl-enter",
        placeholder: "Type Ctrl+Enter to send",
      } satisfies ChatComposerNode,
    ]),
    initialState: { draft: "Type Ctrl+Enter to send" },
  },

  // ── 8. dropScope=global ──────────────────────────────────────────────────
  8: {
    tree: pageWith([
      caption(
        "dropScope=global — drag a file from your desktop into this iframe's body (outside the composer element) → dashed-border affordance fires + drop lands",
      ),
      {
        type: "chat-composer",
        bind: "draft",
        sendAction: { name: "send" },
        attachAction: { name: "attach" },
        attachBind: "attachments",
        dropScope: "global",
        placeholder: "Drop files anywhere in this panel…",
      } satisfies ChatComposerNode,
    ]),
    initialState: { draft: "" },
  },

  // ── 9. MAX-FILE VALIDATION ───────────────────────────────────────────────
  9: {
    tree: pageWith([
      caption(
        "maxFiles=2, maxFileSize=1024 bytes, accept=[image/*] — try 3 files; a >1KB file; a PDF. Inline banner surfaces rejection.",
      ),
      {
        type: "chat-composer",
        bind: "draft",
        sendAction: { name: "send" },
        attachAction: { name: "attach" },
        attachBind: "attachments",
        maxFiles: 2,
        maxFileSize: 1024,
        accept: ["image/*"],
        placeholder: "Attach up to 2 images ≤ 1KB each…",
      } satisfies ChatComposerNode,
    ]),
    initialState: { draft: "" },
  },

  // ── 10. INPUT SLOT — RichTextFieldNode ───────────────────────────────────
  10: {
    tree: pageWith([
      caption(
        "inputSlot=RichTextFieldNode — the framework textarea is replaced by the shipped rich-text editor; composer's send + attach still work",
      ),
      {
        type: "chat-composer",
        bind: "draft",
        sendAction: { name: "send" },
        attachAction: { name: "attach" },
        placeholder: "Type in the rich editor…",
        inputSlot: {
          type: "rich-text-field",
          name: "richDraft",
          bind: "richDraft",
          placeholder: "Format text here — bold, italic, lists, links…",
        } satisfies RichTextFieldNode,
      } satisfies ChatComposerNode,
    ]),
    initialState: {
      draft: "",
      richDraft:
        "**Rich text** works inside the composer.\n\n- Bullet one\n- Bullet two",
    },
  },

  // ── 11. maxRows=3 OVERRIDE ───────────────────────────────────────────────
  11: {
    tree: pageWith([
      caption(
        "maxRows=3 — textarea auto-grows up to 3 lines then scrolls internally",
      ),
      {
        type: "chat-composer",
        bind: "draft",
        sendAction: { name: "send" },
        maxRows: 3,
        placeholder: "Type many lines — should cap at 3 rows",
      } satisfies ChatComposerNode,
    ]),
    initialState: {
      draft:
        "Line one\nLine two\nLine three\nLine four (should scroll internally)\nLine five",
    },
  },

  // ── 12. HEADER SLOT COMPOSITION WITH ATTACHED FILES ──────────────────────
  12: {
    tree: pageWith([
      caption(
        "headerSlot composition — framework chip strip renders ABOVE consumer's 'Editing message #42' header (two files auto-pasted post-mount)",
      ),
      {
        type: "chat-composer",
        bind: "draft",
        sendAction: { name: "send" },
        attachAction: { name: "attach" },
        attachBind: "attachments",
        placeholder: "Edit your message…",
        headerSlot: {
          type: "text",
          value: "Editing message #42",
          tone: "warning",
          style: "caption",
        } satisfies TextNode,
      } satisfies ChatComposerNode,
    ]),
    initialState: { draft: "Original message content" },
  },
};

/**
 * Banked-lesson wrapper: build the panel's tree, then run it through the
 * REAL shipped validators (validateActionNames + validateSectionAction from
 * viewmodel-shell/src/server) BEFORE returning. If validation throws, log to
 * console.error AND return an error-message tree so the page fails VISIBLY
 * at load — a permissive shim accepting invalid trees would hide validator
 * bugs (banked lesson from Phase 21/24).
 */
function buildValidatedTree(idx: number): {
  vm: ViewNode;
  initialState: Record<string, unknown>;
  validated: boolean;
  errorMessage?: string;
} {
  const spec = PANELS[idx];
  if (!spec) {
    return {
      vm: {
        type: "page",
        children: [
          {
            type: "text",
            value: `ChatComposerVerification: unknown panel index ${idx} (valid range 1..12)`,
            style: "heading",
          },
        ],
      },
      initialState: {},
      validated: false,
      errorMessage: `unknown panel index ${idx}`,
    };
  }
  try {
    validateActionNames(spec.tree);
    validateSectionAction(spec.tree);
    return { vm: spec.tree, initialState: spec.initialState, validated: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(
      `[ChatComposerVerification] panel ${idx}: REAL tree validator REJECTED ` +
        "the constructed tree. The shim's built VM would be rejected by the " +
        "real server:",
      errorMessage,
    );
    return {
      vm: {
        type: "page",
        children: [
          {
            type: "text",
            value: `Panel ${idx}: VALIDATOR REJECTED TREE`,
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
                  "This server invokes the REAL shipped validators " +
                  "(validateActionNames + validateSectionAction from " +
                  "viewmodel-shell/src/server) BEFORE returning any tree — a " +
                  "permissive shim accepting invalid trees would hide " +
                  "validator bugs (banked lesson from Phase 21/24 real-" +
                  "validator shim).",
                style: "muted",
              },
            ],
          },
        ],
      },
      initialState: {},
      validated: false,
      errorMessage,
    };
  }
}

// ─── Shipped CSS discovery (theme enumeration at startup) ────────────────────

const stylesDir = new URL("../../viewmodel-shell/styles/", import.meta.url);
const themesDir = new URL("../../viewmodel-shell/styles/themes/", import.meta.url);

const themeFiles = readdirSync(themesDir)
  .filter((n) => n.endsWith(".css"))
  .map((n) => n.replace(/\.css$/, ""))
  .sort();

async function serveShippedCss(pathname: string): Promise<Response | null> {
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
  // Panel-route convenience: /panel/N → /panels/panel-N.html
  const panelMatch = pathname.match(/^\/panel\/(\d+)$/);
  if (panelMatch) {
    const idx = panelMatch[1];
    const panelFile = Bun.file(new URL(`panels/panel-${idx}.html`, distDir));
    if (await panelFile.exists()) return new Response(panelFile);
  }
  // Extension-less client-route fallback: serve index.html (SPA style).
  if (!rel.includes(".")) {
    const index = Bun.file(new URL("index.html", distDir));
    if (await index.exists()) return new Response(index);
  }
  return new Response("Not Found", { status: 404 });
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

async function firstFreePort(startPort: number): Promise<number> {
  for (let p = startPort; p < startPort + 20; p++) {
    try {
      const listener = Bun.listen({
        hostname: "0.0.0.0",
        port: p,
        socket: {
          data() {},
          open() {},
          close() {},
          drain() {},
          error() {},
        },
      });
      listener.stop();
      return p;
    } catch {
      // In use — try next.
    }
  }
  throw new Error(`No free port found in [${startPort}, ${startPort + 20})`);
}

const requestedPort = Number(process.env.PORT ?? "3023");
const port = await firstFreePort(requestedPort);

// Write our PID for cleanup + schedule a 60-min auto-kill per the shipped
// verification-demo discipline. If the operator needs the page after the
// timeout, re-run `bun run start`.
await Bun.write(new URL("./server.pid", import.meta.url), String(process.pid));
setTimeout(() => {
  console.log("ChatComposerVerification: 60-min auto-kill fired; exiting.");
  process.exit(0);
}, 3600000);

Bun.serve({
  hostname: "0.0.0.0",
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // --- API: per-panel VM (VALIDATED) ---
    const panelApi = url.pathname.match(/^\/api\/panel\/(\d+)\/tree$/);
    if (panelApi && request.method === "GET") {
      const idx = Number(panelApi[1]);
      const { vm, initialState, validated, errorMessage } = buildValidatedTree(idx);
      return Response.json({
        ok: true,
        vm,
        state: initialState,
        _validator: validated ? "passed" : `FAILED: ${errorMessage}`,
      });
    }
    if (panelApi && request.method === "POST") {
      // Echo state back (verification page has no server-side action logic;
      // it's a rendering harness). Real-validator still runs on the returned
      // tree so a state-driven re-render can't smuggle in an invalid VM.
      const idx = Number(panelApi[1]);
      let echoedState: unknown = {};
      try {
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
        console.error(
          `[ChatComposerVerification] panel ${idx}: failed to parse POST body:`,
          err,
        );
      }
      const { vm } = buildValidatedTree(idx);
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
  `ChatComposerVerification (Phase 30 v9.1.0 ChatComposerNode sign-off) → ` +
    `http://100.113.23.63:${port}/  (PID ${process.pid}, auto-kill in 60 min)`,
);
console.log(
  `  Themes enumerated at startup: ${themeFiles.length} (${themeFiles.join(", ")})`,
);
console.log(
  `  12 iframe-scoped panels: /panels/panel-{1..12}.html + /api/panel/{1..12}/tree`,
);
