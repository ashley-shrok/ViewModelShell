// StateAxisVerification — Phase 27 v8.1.0 state-axis uniformity tailnet
// sign-off page (plan 27-08). page-marker: state-axis-verification
//
// A real-bundle, real-CSS human-verification harness for the STYLE-3
// unification: every composite that carries `state?: string` should render
// its `state:"active"` cell with the same shipped `--active` rule set
// (border-left + weight:600 on the semantic primary text slot), and the
// framework's newly-added state axis on the 6 v8 composites should compose
// multiplicatively with existing axes (tone / role / status).
//
// What the page renders — a 9-composite × [no state, state:"active"] grid
// driven by the REAL shipped viewmodel-shell renderer (Vite-aliased to
// ../../viewmodel-shell/src) + the REAL shipped default.css + a runtime
// 13-theme switcher (default + 12 themes in viewmodel-shell/styles/themes/),
// served verbatim below. Nothing here is hand-mocked; the assertion is
// literally what npm 8.1.0 will ship.
//
// Composite rows (in order):
//   1. ListItemNode      — REPLACED shipped --active (border-all+bg → STYLE-3)
//   2. TableRow          — net-new shipped --active rule (STYLE-3, border-left only; no weight)
//   3. ListRowNode       — REPLACED shipped --active (bg-only → STYLE-3)
//   4. UserRowNode       — NEW `state?` field + shipped STYLE-3 rule
//   5. MessageNode       — NEW `state?` field + shipped STYLE-3 rule
//                          THREE cells: {no state, user}, {active, user},
//                          {active, assistant} — the 3rd cell proves
//                          multiplicative role×state composition per
//                          CONTEXT §specifics MessageNode note.
//   6. DetailRowNode     — NEW `state?` field + shipped STYLE-3 rule
//   7. TimelineEntryNode — NEW `state?` field + shipped STYLE-3 rule
//                          Rendered INSIDE a TimelineNode so the ::before rail
//                          + per-entry dot mechanism is present, so the pixel-
//                          geometry decision from Plan 27-04 is visually
//                          verifiable alongside the STYLE-3 border-left.
//   8. SettingRowNode    — NEW `state?` field + shipped STYLE-3 rule
//   9. ChipNode          — NEW `state?` field, NO shipped rule (deferred).
//                          The active-cell must show NO visual change vs
//                          the no-state cell — CONTEXT §Out-of-scope.
//
// Single Bun.serve process: serves the Vite-built client (dist/), the shipped
// CSS files (default.css + themes/*.css), and the /api/probe/tree GET wire
// (no POST endpoint — this page is purely static rendering).

import { readdirSync } from "node:fs";
import type { ViewNode } from "@ashley-shrok/viewmodel-shell/server";

// ─── The 9-composite verification tree ───────────────────────────────────────

function buildVerificationTree(): ViewNode {
  return {
    type: "page",
    title: "Phase 27 state axis verification",
    width: "wide",
    children: [
      {
        type: "text",
        value:
          "Phase 27 state axis verification — 9 composites × [no state, state:\"active\"] × 13 themes",
        style: "heading",
      },
      {
        type: "text",
        value:
          "Rendered by the real shipped viewmodel-shell bundle + shipped default.css " +
          "+ a runtime 13-theme switcher (top of page). No custom CSS. Every cell is a " +
          "REAL composite node emitted by the REAL renderer against the REAL shipped " +
          "CSS. Each composite row shows [no state] then [state:\"active\"] side-by-side; " +
          "the difference is what npm 8.1.0's CSS rule adds.",
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
              "① Every composite's [state:\"active\"] cell shows STYLE-3: a 3px left border in the accent color + font-weight:600 on the semantic primary text slot (except TableRow — border only, no weight).",
          },
          {
            type: "text",
            value:
              "② The 3 REPLACED composites (ListItem + ListRow) look right in the new STYLE-3 rendering — no residual accent-glow background from the old rule.",
          },
          {
            type: "text",
            value:
              "③ MessageNode row 3rd cell (role:\"assistant\" + state:\"active\") composes MULTIPLICATIVELY: the tinted-info content surface AND the STYLE-3 left border both present, no cascade collision.",
          },
          {
            type: "text",
            value:
              "④ TimelineEntry row: the ::before rail + per-entry dots STILL render correctly alongside the STYLE-3 border-left — no visible geometry collision on the active entry.",
          },
          {
            type: "text",
            value:
              "⑤ ChipNode row: the [state:\"active\"] cell shows NO visual change from the no-state cell (STYLE-3 is deferred for Chip — CONTEXT §Out-of-scope).",
          },
          {
            type: "text",
            value:
              "⑥ Cycle through all 13 themes via the top-of-page switcher; every composite's --active rendering should read cleanly in every theme (no palette clashes, no contrast issues).",
          },
        ],
      },
      { type: "divider" },

      // ── 1. ListItemNode ───────────────────────────────────────────────────
      buildRow(
        "1. ListItemNode",
        "REPLACED shipped --active: was border-all + accent-glow bg; now STYLE-3 (border-left + weight:600 on .vms-list-item__title).",
        [
          {
            type: "list",
            variant: "items",
            children: [
              {
                type: "list-item",
                children: [
                  { type: "text", value: "Regular item (no state)" },
                  { type: "text", value: "Subordinate line", style: "muted" },
                ],
              },
            ],
          },
          {
            type: "list",
            variant: "items",
            children: [
              {
                type: "list-item",
                state: "active",
                children: [
                  { type: "text", value: "Active item — border-left + bold" },
                  { type: "text", value: "Subordinate line", style: "muted" },
                ],
              },
            ],
          },
        ],
      ),

      // ── 2. TableRow ───────────────────────────────────────────────────────
      buildRow(
        "2. TableRow",
        "Net-new shipped --active rule (STYLE-3 border-left ONLY; no weight:600 — TableRow has no semantic primary text slot).",
        [
          {
            type: "table",
            columns: [
              { key: "order", label: "Order" },
              { key: "status", label: "Status" },
              { key: "total", label: "Total" },
            ],
            rows: [
              {
                id: "alpha",
                cells: {
                  order: "#1001",
                  status: "Paid",
                  total: "$42.00",
                },
              },
            ],
          },
          {
            type: "table",
            columns: [
              { key: "order", label: "Order" },
              { key: "status", label: "Status" },
              { key: "total", label: "Total" },
            ],
            rows: [
              {
                id: "alpha-active",
                cells: {
                  order: "#1001",
                  status: "Paid",
                  total: "$42.00",
                },
                state: "active",
              },
            ],
          },
        ],
      ),

      // ── 3. ListRowNode ────────────────────────────────────────────────────
      buildRow(
        "3. ListRowNode",
        "REPLACED shipped --active: was accent-glow bg-only; now STYLE-3 (border-left + weight:600 on .vms-list-row__primary).",
        [
          {
            type: "list",
            variant: "rows",
            children: [
              {
                type: "list-row",
                primary: "Regular row (no state)",
                secondary: "A subordinate detail line",
                meta: ["meta-1", "meta-2"],
              },
            ],
          },
          {
            type: "list",
            variant: "rows",
            children: [
              {
                type: "list-row",
                state: "active",
                primary: "Active row — border-left + bold primary",
                secondary: "A subordinate detail line",
                meta: ["meta-1", "meta-2"],
              },
            ],
          },
        ],
      ),

      // ── 4. UserRowNode ────────────────────────────────────────────────────
      buildRow(
        "4. UserRowNode",
        "NEW state? field + shipped STYLE-3 rule (border-left + weight:600 on .vms-user-row__name).",
        [
          {
            type: "list",
            variant: "rows",
            children: [
              {
                type: "user-row",
                name: "Angel Reyes",
                meta: "angel@example.com · Engineer",
                status: { label: "Online", kind: "online" },
              },
            ],
          },
          {
            type: "list",
            variant: "rows",
            children: [
              {
                type: "user-row", // cell: state:"active"
                state: "active",
                name: "Angel Reyes (active)",
                meta: "angel@example.com · Engineer",
                status: { label: "Online", kind: "online" },
              },
            ],
          },
        ],
      ),

      // ── 5. MessageNode (THREE cells: 3rd proves role × state) ────────────
      buildRow(
        "5. MessageNode",
        "NEW state? field + shipped STYLE-3 rule (border-left + weight:600 on .vms-message__author). Third cell shows role:\"assistant\" + state:\"active\" — multiplicative composition per CONTEXT §specifics.",
        [
          {
            type: "message",
            author: "Angel",
            timestamp: "10:14",
            content: "Regular message (no state, role:user).",
            role: "user",
          },
          {
            type: "message", // cell: state:"active"
            author: "Angel",
            timestamp: "10:14",
            content: "Active user message — border-left + bold author.",
            role: "user",
            state: "active",
          },
          {
            type: "message", // cell: role:"assistant" + state:"active" — multiplicative composition
            author: "Vicky (assistant)",
            timestamp: "10:15",
            content:
              "Active assistant message — tinted-info surface AND STYLE-3 border-left BOTH present (multiplicative role × state).",
            role: "assistant",
            state: "active",
          },
        ],
      ),

      // ── 6. DetailRowNode ──────────────────────────────────────────────────
      buildRow(
        "6. DetailRowNode",
        "NEW state? field + shipped STYLE-3 rule (border-left + weight:600 on .vms-detail-row__value).",
        [
          {
            type: "detail-list",
            children: [
              {
                type: "detail-row",
                label: "Account",
                value: "premium-plan-a",
              },
            ],
          },
          {
            type: "detail-list",
            children: [
              {
                type: "detail-row", // cell: state:"active"
                label: "Account",
                value: "premium-plan-a (active)",
                state: "active",
              },
            ],
          },
        ],
      ),

      // ── 7. TimelineEntryNode (inside TimelineNode for rail + dots) ───────
      buildRow(
        "7. TimelineEntryNode",
        "NEW state? field + shipped STYLE-3 rule. Rendered INSIDE a TimelineNode so the ::before rail + per-entry dots are visible; verify no geometry collision on the active entry.",
        [
          {
            type: "timeline",
            children: [
              {
                type: "timeline-entry",
                time: "10:14",
                description: "Regular entry (no state).",
              },
              {
                type: "timeline-entry",
                time: "10:15",
                description: "Another regular entry.",
              },
            ],
          },
          {
            type: "timeline",
            children: [
              {
                type: "timeline-entry",
                time: "10:14",
                description: "Entry before active.",
              },
              {
                type: "timeline-entry", // cell: state:"active" — verify no rail-dot collision
                time: "10:15",
                description: "Active entry — border-left + bold description, alongside the rail-dot.",
                state: "active",
              },
              {
                type: "timeline-entry",
                time: "10:16",
                description: "Entry after active.",
              },
            ],
          },
        ],
      ),

      // ── 8. SettingRowNode ─────────────────────────────────────────────────
      buildRow(
        "8. SettingRowNode",
        "NEW state? field + shipped STYLE-3 rule (border-left + weight:600 on .vms-setting-row__label).",
        [
          {
            type: "setting-list",
            children: [
              {
                type: "setting-row",
                label: "Email notifications",
                description: "Send me a digest each morning.",
                trailing: {
                  type: "checkbox",
                  variant: "switch",
                  name: "email-notifications",
                  bind: "settings.email",
                },
              },
            ],
          },
          {
            type: "setting-list",
            children: [
              {
                type: "setting-row", // cell: state:"active"
                state: "active",
                label: "Email notifications (active)",
                description: "Send me a digest each morning.",
                trailing: {
                  type: "checkbox",
                  variant: "switch",
                  name: "email-notifications-active",
                  bind: "settings.email-active",
                },
              },
            ],
          },
        ],
      ),

      // ── 9. ChipNode (state:"active" must show NO visual change) ──────────
      buildRow(
        "9. ChipNode — DEFERRED (no shipped --active rule; CONTEXT §Out-of-scope)",
        "The state:\"active\" cell must show NO visual change vs the no-state cell — the class emits (.vms-chip--active) but the framework ships no rule for it. Deferred per CONTEXT.",
        [
          {
            type: "chip-list",
            children: [{ type: "chip", label: "regular-chip" }],
          },
          {
            type: "chip-list",
            children: [{ type: "chip", label: "active-chip", state: "active" }],
          },
        ],
      ),
    ],
  };
}

// ── Helper: one composite row (label + N side-by-side cells) ────────────────

function buildRow(
  heading: string,
  description: string,
  cells: ViewNode[],
): ViewNode {
  const cellLabels = ["state: (none)", 'state: "active"', 'state:"active" + role:"assistant"'];
  return {
    type: "section",
    heading,
    variant: "card",
    children: [
      { type: "text", value: description, style: "muted" },
      {
        type: "section",
        layout: "cards",
        minItem: "lg",
        children: cells.map((cell, i) => ({
          type: "section",
          variant: "card",
          children: [
            {
              type: "text",
              value: cellLabels[i] ?? `cell ${i + 1}`,
              style: "caption",
            },
            cell,
          ],
        })),
      },
    ],
  };
}

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

const port = Number(process.env.PORT ?? "3020");

// Write our PID for cleanup + schedule a 60-min auto-kill per the identity
// file's "how to show the user a visual change" recipe.
await Bun.write(new URL("./server.pid", import.meta.url), String(process.pid));
setTimeout(() => { console.log("StateAxisVerification: 60-min auto-kill fired; exiting."); process.exit(0); }, 3600000);

Bun.serve({
  // hostname 0.0.0.0 so the page is reachable at 100.113.23.63:PORT on the
  // tailnet (host machine's tailscale IP) AND at 127.0.0.1 for local smoke.
  hostname: "0.0.0.0",
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // --- API: the 9-composite verification tree ---
    if (url.pathname === "/api/probe/tree" && request.method === "GET") {
      return Response.json({ vm: buildVerificationTree(), state: {} });
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
  `StateAxisVerification (Phase 27 state axis sign-off) → ` +
    `http://100.113.23.63:${port}/  (PID ${process.pid}, auto-kill in 60 min)`,
);
