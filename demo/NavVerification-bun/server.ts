// NavVerification — the v5.1 Navigation Primitives tailnet sign-off page (NAV-04).
//
// A real-bundle, real-CSS human-verification harness for the two new nodes
// shipped in Phase 20 — BreadcrumbNode + StepsNode — plus a re-confirmation of
// the already-shipped clickable-row `cursor:pointer`. It drives the REAL shipped
// viewmodel-shell browser bundle (Vite-aliased to ../../viewmodel-shell/src) and
// the REAL shipped default.css + themes (served verbatim below), so Ashley's
// visual sign-off is meaningful — nothing here is hand-mocked.
//
// What the page renders (all via the shipped renderer, zero app CSS in the view
// tree — the one bit of host-chrome is the light/dark toggle in index.html):
//   1. A BreadcrumbNode  — href crumbs + an action crumb + a current last item.
//   2. A horizontal StepsNode (full width) — narrow the window to watch it
//      intrinsically stack to vertical (container query, zero viewport breakpoints).
//   3. The SAME horizontal StepsNode inside a ≤24rem sidebar slot — a deliberately
//      narrow container, so it renders ALREADY collapsed (the intrinsic reflow
//      visible at a glance with no resize).
//   4. A deliberate orientation:"vertical" StepsNode — a wizard with per-step
//      descriptions.
//   5. A small TableNode whose rows carry `TableRow.action` — hover shows the
//      pointer cursor; clicking dispatches and updates "Last picked".
//
// Single Bun.serve process: the Vite-built client, the shipped CSS files, and
// the /api/nav wire — following the NonBlockingStaleness-bun full-stack pattern.

import {
  UnknownActionError,
  createAction,
  createAgentSkillHandler,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

// ─── Domain model ────────────────────────────────────────────────────────────

interface NavState {
  lastPicked: string;
}

function initialState(): NavState {
  return { lastPicked: "(none yet — click a row below)" };
}

// ─── View (pure function of state) ─────────────────────────────────────────────

function buildVm(state: NavState): ViewNode {
  return {
    type: "page",
    title: "Navigation Primitives — Tailnet Verification",
    width: "wide",
    children: [
      {
        type: "text",
        value: "v5.1 Navigation Primitives — Verification",
        style: "heading",
      },
      {
        type: "text",
        value:
          "Rendered by the real shipped viewmodel-shell bundle + default.css + a " +
          "real theme (swap light/dark with the toggle at the top of the page). " +
          "Work down the checklist below.",
        style: "muted",
      },

      // ── What to check ──────────────────────────────────────────────────────
      {
        type: "section",
        heading: "What to check",
        variant: "card",
        tone: "info",
        children: [
          {
            type: "text",
            value:
              "① Breadcrumb: the last crumb is the current page (bold, non-clickable, aria-current); earlier crumbs are links, plus one action crumb; separators are framework-drawn.",
          },
          {
            type: "text",
            value:
              "② Horizontal steps: numbered markers, a check glyph on done steps, the current step ringed, connectors running bubble-edge to bubble-edge.",
          },
          {
            type: "text",
            value:
              "③ Narrow-collapse: narrow the browser window and watch the full-width horizontal strip auto-stack to vertical with NO awkward mid-break. The ≤24rem sidebar copy shows it collapsed already — no resize needed.",
          },
          {
            type: "text",
            value:
              "④ Vertical wizard: markers down the left, a connector running down, a description beside each step.",
          },
          {
            type: "text",
            value:
              "⑤ Light + dark: toggle the theme (top bar) and confirm marker / connector / text contrast is legible in both.",
          },
          {
            type: "text",
            value:
              "⑥ Clickable rows: hover a table row → the cursor becomes a pointer; click one → it dispatches and 'Last picked' updates.",
          },
        ],
      },

      { type: "divider" },

      // ── ① Breadcrumb ───────────────────────────────────────────────────────
      {
        type: "section",
        heading: "① Breadcrumb",
        variant: "card",
        children: [
          {
            type: "text",
            value:
              "An ordered root→current trail. The last crumb (Q3 Summary) is auto-rendered as the current page — non-clickable, aria-current. Earlier crumbs navigate via href; the 'Regenerate' crumb fires a server action instead of a URL. The separator is framework-drawn (no appearance on the wire).",
            style: "muted",
          },
          {
            type: "breadcrumb",
            items: [
              { label: "Home", href: "#home" },
              { label: "Reports", href: "#reports" },
              { label: "Regenerate", action: { name: "regenerate-crumb" } },
              { label: "Analytics", href: "#analytics" },
              { label: "Q3 Summary" },
            ],
          },
        ],
      },

      { type: "divider" },

      // ── ② Horizontal steps (full width) ────────────────────────────────────
      {
        type: "section",
        heading: "② Horizontal steps (full width — narrow the window to see it collapse)",
        variant: "card",
        children: [
          {
            type: "text",
            value:
              "Default (omitted) orientation = horizontal. Step 0 (Cart) is done (check glyph), step 1 (Shipping) is current (ringed), the rest are upcoming. Drag the window narrower and the strip stacks to vertical INTRINSICALLY — no viewport breakpoint.",
            style: "muted",
          },
          {
            type: "steps",
            current: 1,
            steps: [
              { label: "Cart" },
              { label: "Shipping" },
              { label: "Payment" },
              { label: "Confirm" },
            ],
          },
        ],
      },

      // ── ③ Horizontal steps in a ≤24rem narrow slot (pre-collapsed) ─────────
      {
        type: "section",
        heading: "③ The SAME horizontal steps in a ≤24rem slot (pre-collapsed)",
        variant: "card",
        layout: "sidebar",
        children: [
          {
            // First child of a sidebar = the thin aside, capped at 24rem (< the
            // 30rem steps container-query threshold), so the identical horizontal
            // steps node renders already stacked — the intrinsic reflow at a glance.
            type: "section",
            variant: "card",
            children: [
              { type: "text", value: "≤24rem sidebar slot", style: "subheading" },
              {
                type: "steps",
                current: 1,
                steps: [
                  { label: "Cart" },
                  { label: "Shipping" },
                  { label: "Payment" },
                  { label: "Confirm" },
                ],
              },
            ],
          },
          {
            type: "text",
            value:
              "This is the very same horizontal steps node as ②, just placed in a ≤24rem container. Because the reflow is driven by the steps' OWN width (a container query, not the viewport), it collapses to vertical here with no resize — proving the collapse is intrinsic.",
            style: "muted",
          },
        ],
      },

      { type: "divider" },

      // ── ④ Vertical wizard ──────────────────────────────────────────────────
      {
        type: "section",
        heading: "④ Vertical wizard (orientation: \"vertical\", with descriptions)",
        variant: "card",
        children: [
          {
            type: "text",
            value:
              "A deliberate vertical stepper — markers down the left, a connector running down, a description beside each step. Steps 0–1 done, step 2 (Verify) current, step 3 upcoming.",
            style: "muted",
          },
          {
            type: "steps",
            current: 2,
            orientation: "vertical",
            steps: [
              { label: "Account", description: "Create your login" },
              { label: "Profile", description: "Add your details" },
              { label: "Verify", description: "Confirm your email" },
              { label: "Done", description: "You're all set" },
            ],
          },
        ],
      },

      { type: "divider" },

      // ── ⑤ Clickable rows ───────────────────────────────────────────────────
      {
        type: "section",
        heading: "⑤ Clickable rows (cursor:pointer)",
        variant: "card",
        children: [
          {
            type: "text",
            value:
              "Each row carries TableRow.action. Hover a row — the cursor should become a pointer. Click one — it dispatches and the line below updates.",
            style: "muted",
          },
          { type: "text", value: `Last picked: ${state.lastPicked}`, style: "subheading" },
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
                cells: { order: "#1001 — Cart", status: "Paid", total: "$42.00" },
                action: { name: "pick-row-alpha" },
              },
              {
                id: "bravo",
                cells: { order: "#1002 — Shipping", status: "Pending", total: "$18.50" },
                action: { name: "pick-row-bravo" },
              },
              {
                id: "charlie",
                cells: { order: "#1003 — Payment", status: "Refunded", total: "$7.25" },
                action: { name: "pick-row-charlie" },
              },
              {
                id: "delta",
                cells: { order: "#1004 — Confirm", status: "Paid", total: "$99.99" },
                action: { name: "pick-row-delta" },
              },
            ],
          },
        ],
      },
    ],
  };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

const actionHandler = createAction<NavState>(async (payload) => {
  const state = payload.state;

  if (payload.name === "regenerate-crumb") {
    // The action crumb — a no-op re-render (proves the breadcrumb action
    // dispatches; nothing to change in state).
    return { vm: buildVm(state), state };
  }

  if (payload.name.startsWith("pick-row-")) {
    const which = payload.name.slice("pick-row-".length);
    const next: NavState = { lastPicked: `${which} (row action fired)` };
    return { vm: buildVm(next), state: next };
  }

  throw new UnknownActionError(payload.name);
});

// ─── Shipped CSS (served verbatim — NOT hand-mocked) ───────────────────────────

const stylesDir = new URL("../../viewmodel-shell/styles/", import.meta.url);

async function serveShippedCss(pathname: string): Promise<Response | null> {
  // /vms/default.css → styles/default.css ; /vms/themes/<name>.css → styles/themes/<name>.css
  const m = pathname.match(/^\/vms\/(default\.css|themes\/[a-z-]+\.css)$/);
  if (!m) return null;
  const file = Bun.file(new URL(m[1], stylesDir));
  if (await file.exists()) {
    return new Response(file, { headers: { "Content-Type": "text/css; charset=utf-8" } });
  }
  return new Response("Not Found", { status: 404 });
}

// ─── Vite-built client (dist/) ─────────────────────────────────────────────────

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

const skillHandler = createAgentSkillHandler({
  appPreamble:
    "This is the v5.1 Navigation Primitives verification page. GET /api/nav " +
    "returns a page with a BreadcrumbNode (href crumbs + an action crumb + a " +
    "current last item), a horizontal StepsNode (default orientation, intrinsic " +
    "narrow→vertical collapse), the same steps in a ≤24rem sidebar slot " +
    "(pre-collapsed), a vertical StepsNode with per-step descriptions, and a " +
    "TableNode whose rows carry TableRow.action. The `regenerate-crumb` and " +
    "`pick-row-*` actions drive it; pick-row-* updates 'Last picked'.",
});

// ─── HTTP server ───────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? "3011");

Bun.serve({
  // Bind all interfaces (0.0.0.0) so the page is reachable at http://thenasty:PORT/
  // on the tailnet (100.113.23.63) AND at 127.0.0.1 for a local smoke check.
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // --- API ---
    if (url.pathname === "/api/nav" && request.method === "GET") {
      const state = initialState();
      return Response.json({ vm: buildVm(state), state });
    }
    if (url.pathname === "/api/nav/action" && request.method === "POST") {
      return actionHandler(request);
    }
    if (url.pathname === "/.well-known/vms-skill.md" && request.method === "GET") {
      return skillHandler(request);
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
  `NavVerification (nav primitives sign-off) → http://localhost:${port}  ` +
    `(tailnet: http://thenasty:${port}/) — open it in a browser`,
);
