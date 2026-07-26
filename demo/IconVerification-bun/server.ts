// IconVerification — the v7.0.0 IconNode + cross-node icon composition +
// TrackerCell tooltip rename tailnet sign-off page (ICON-10, Plan 22-09).
//
// A real-bundle, real-CSS human-verification harness for every icon surface
// v7.0.0 adds — the standalone IconNode, the five cross-node `icon?:` props
// (Button / Link / Section / Badge / ListItem), the icon-only-ButtonNode
// tooltip-required a11y rule (ICON-05), and the renamed TrackerCell.tooltip
// field with its render-path swap from the browser-native `el.title` gray box
// to the shipped 6.12.1 styled tooltip bubble (ICON-06). It drives the REAL
// shipped viewmodel-shell browser bundle (Vite-aliased to
// ../../viewmodel-shell/src) and the REAL shipped default.css + all 12 themes
// (served verbatim below), so Ashley's visual + interactive sign-off is
// meaningful — nothing here is hand-mocked.
//
// 🚨 THE BANKED LESSON — WHY THIS IS A REAL BACKEND AND NOT A FETCH SHIM.
// An in-page reducer/fetch-shim that hands `buildVm` output straight to
// `adapter.render` BYPASSES SERVER-SIDE VALIDATION and therefore ACCEPTS TREES
// THE REAL SERVER REJECTS. That is not hypothetical: it happened on an earlier
// verification page — a tree with a duplicate action name (a HARD validator
// failure) sailed through a mock and then 500'd the moment it hit a real
// controller. This phase is squarely in that blast radius: it adds ICON-05's
// icon-only-Button walker rule, which fires on both TS and .NET backends.
// So this page uses the REAL `createAction` from
// `@ashley-shrok/viewmodel-shell/server`, which itself runs the shipped
// `validateActionNames` + `validateSectionAction` over every response tree —
// the real code path, not a lookalike. The GET path does not flow through
// `createAction`, so it calls the SAME shipped validators explicitly below
// (see `validated()`). Do NOT "simplify" either call away.
//
// The plan's TASK 22-09-03 originally called this a "fetch-shim" in a
// pure-frontend Vite app; that is the shape the plan was drafted against but
// is NOT the shape shipped by every prior tailnet verification page
// (LookupVerification-bun, NavVerification-bun). AGENTS.md's "convention rule"
// applies: use the shipped convention. A `-bun` sibling with a real Bun.serve
// backend gets the REAL validators for free (via createAction) — the shim
// path was a workaround for a hypothetical where a real backend wasn't
// available, which is not this repo.

import {
  UnknownActionError,
  createAction,
  createAgentSkillHandler,
  validateActionNames,
  validateSectionAction,
  type ViewNode,
  type IconName,
} from "@ashley-shrok/viewmodel-shell/server";

// ─── State ────────────────────────────────────────────────────────────────────
//
// The verification page is largely read-only: the icons render from a fixed
// tree. State exists so a couple of interactive proofs work:
//   - `lastAction` records the most recent icon-only-Button dispatch, so
//     Ashley can watch a click on the trash / edit / copy toolbar land.
//   - `invalidAttempted` records whether the "trigger the walker rejection"
//     button has been pressed. The action itself throws — Ashley sees the
//     error banner, and this counter proves the rejection is visible.

interface IconState {
  lastAction: string;
  invalidAttempted: number;
}

function initialState(): IconState {
  return { lastAction: "(none yet — click an icon-only button below)", invalidAttempted: 0 };
}

// ─── View (pure function of state) ────────────────────────────────────────────

// The eight Pixie/Hestia concept anchors — the design-doc §11 canonical grid.
const HESTIA: Array<{ icon: IconName; heading: string; blurb: string }> = [
  { icon: "sparkles",     heading: "Muse",       blurb: "Everyday spark — a nudge, a next step, an idea to try." },
  { icon: "wrench",       heading: "Fixit",      blurb: "Household maintenance ledger — what broke, what got fixed." },
  { icon: "shield-check", heading: "Ward",       blurb: "Guardrails and check-ins — quiet, opt-in safety." },
  { icon: "route",        heading: "Wayfinder",  blurb: "Trip planning + itineraries — the shape of a journey." },
  { icon: "book-open",    heading: "Chronicle",  blurb: "Journal + reading log — words to remember." },
  { icon: "activity",     heading: "Pulse",      blurb: "Vitals and rhythms — what your body is telling you." },
  { icon: "workflow",     heading: "Rituals",    blurb: "Recurring flows — the sequences you run every week." },
  { icon: "receipt",      heading: "Ledger",     blurb: "Household finances — bills, receipts, the money-in-motion." },
];

// The 6-tone × 6-icon matrix — one representative icon per family, one row
// per semantic tone (danger / warning / success / info) plus a currentColor
// default row so Ashley sees the "no tone" baseline right next to the tinted
// variants. The tone axis on IconNode maps 1:1 to the framework's
// `--vms-error/-warning/-success/-info` tokens, so this is also the AA
// hand-check surface for the design-doc §8 warning.
const TONE_ROW_ICONS: IconName[] = [
  "check-circle", "alert-triangle", "x-circle", "info", "sparkles", "activity",
];

// A tracker strip that alternates state values and carries a `tooltip:` on
// every cell — the whole point of ICON-06 is that hovering a cell shows the
// STYLED bubble (the 6.12.1 body-appended `.vms-tooltip-host` singleton), not
// the browser-native `el.title` gray box. If the gray box appears, Plan 05's
// swap failed and the page has caught it before publish.
function trackerCells() {
  const states = ["success", "success", "warning", "success", "danger", "success", "success", "muted", "success", "success", "warning", "success"] as const;
  return states.map((state, i) => ({
    state,
    tooltip: `Slot ${i + 1} · ${state} · 2026-07-2${i % 6}`,
  }));
}

function buildVm(state: IconState): ViewNode {
  return {
    type: "page",
    title: "Icons — v7.0.0 Tailnet Verification",
    width: "wide",
    children: [
      {
        type: "text",
        value: "v7.0.0 IconNode + cross-node icon composition + TrackerCell.tooltip rename — Verification",
        style: "heading",
      },
      {
        type: "text",
        value:
          "Rendered by the real shipped viewmodel-shell bundle + default.css + a " +
          "real theme (swap themes with the picker at the top of the page). Every " +
          "response tree below is run through the SHIPPED tree validators (both " +
          "validateActionNames and validateSectionAction) before it leaves the " +
          "server — the ICON-05 icon-only-Button walker rule fires here too.",
        style: "muted",
      },

      // ── What to check ─────────────────────────────────────────────────────
      {
        type: "section",
        heading: "What to check",
        variant: "card",
        tone: "info",
        children: [
          { type: "text", value: "① Hestia card grid — every card renders a prominent header icon at size xl matching the concept anchor (sparkles, wrench, shield-check, route, book-open, activity, workflow, receipt). Grid collapses intrinsically as the window narrows (zero @media)." },
          { type: "text", value: "② Icon-in-host examples — Button / Link / Badge / ListItem each render a leading icon at the host-appropriate size (§4 table). Tone inherits from the host." },
          { type: "text", value: "③ All 5 sizes — the same icon at xs / sm / md / lg / xl (12 / 16 / 20 / 24 / 32 px). Stroke width stays uniform (the Lucide 2px stroke)." },
          { type: "text", value: "④ Tone matrix — 6 representative icons × 4 semantic tones + 1 currentColor row. Every tinted icon must stay legible against the surrounding card surface across every theme." },
          { type: "text", value: "⑤ 🚨 LIVE TrackerCell tooltip — HOVER any cell in the tracker strip and confirm the STYLED bubble appears (rounded, tinted background, subtle shadow — the shipped 6.12.1 body-appended host). If a browser-native GRAY BOX with unstyled text appears, Plan 05's `el.title` → styled-tooltip swap did not land and the page has caught it before publish." },
          { type: "text", value: "⑥ Icon-only Button (valid) — the small toolbar renders three icon-only buttons; hover shows the styled tooltip, click dispatches (the last action name lands in the row above the toolbar)." },
          { type: "text", value: "⑦ Icon-only Button (INVALID — walker rejection) — the red button below the toolbar dispatches an action that constructs a tree with an icon-only Button that has NO tooltip. The shipped `validateActionNames` + walker fires on the response, `createAction` catches it, and the page shows an error banner. This proves ICON-05 works end-to-end on the real backend, not just in unit tests." },
          { type: "text", value: "⑧ Themes — use the picker at the top of the page. The primitive must be visually correct in the shipped light default AND at least one dark theme (per plan 22-09). All 13 are available; the AA-contrast pairs were hand-checked in Plan 22-08." },
        ],
      },

      // ── ① Hestia-style launcher card grid ─────────────────────────────────
      {
        type: "section",
        heading: "① Hestia-style launcher card grid (the motivating v7.0.0 use case)",
        variant: "card",
        children: [
          {
            type: "text",
            value:
              "The eight Pixie/Hestia concept anchors as SectionNode cards — each carries a " +
              "name-only `icon:` on the host (not an IconNode child); the framework renders " +
              "it at the section-appropriate size (xl), and tone inherits from the section's " +
              "tone if set. The card grid uses layout:\"cards\" so it collapses intrinsically " +
              "as the container narrows.",
            style: "muted",
          },
          {
            type: "section",
            layout: "cards",
            children: HESTIA.map((h) => ({
              type: "section",
              variant: "card",
              icon: h.icon,
              heading: h.heading,
              children: [{ type: "text", value: h.blurb, style: "muted" }],
            })),
          },
        ],
      },

      // ── ② Icon-in-host examples ──────────────────────────────────────────
      {
        type: "section",
        heading: "② Icon in Button / Link / Badge / ListItem / Section",
        variant: "card",
        children: [
          {
            type: "text",
            value:
              "One example per host: the wire carries a name-only `icon:` prop and the host owns " +
              "the appearance (size + tone inheritance per design-doc §4). No IconNode child; " +
              "no size on the wire — the host picks.",
            style: "muted",
          },
          {
            type: "text",
            value: "Button (leading icon at size sm, tone inherited from button emphasis/tone):",
            style: "subheading",
          },
          {
            type: "section",
            layout: "row",
            align: "center",
            children: [
              { type: "button", label: "Save",    icon: "save",       emphasis: "primary", action: { name: "labeled:save"    } },
              { type: "button", label: "Edit",    icon: "edit-3",                          action: { name: "labeled:edit"    } },
              { type: "button", label: "Delete",  icon: "trash-2",    tone: "danger",      action: { name: "labeled:delete"  } },
              { type: "button", label: "Refresh", icon: "refresh-cw",                      action: { name: "labeled:refresh" } },
            ],
          },
          {
            type: "text",
            value: "Link (leading icon at size sm, tone from surrounding text):",
            style: "subheading",
          },
          {
            type: "section",
            layout: "row",
            align: "center",
            children: [
              { type: "link", label: "Documentation", href: "https://github.com/ashley-shrok/viewmodel-shell", external: true, icon: "book-open" },
              { type: "link", label: "Report a bug",   href: "https://github.com/ashley-shrok/viewmodel-shell/issues", external: true, icon: "alert-circle" },
              { type: "link", label: "Home",           href: "#top", icon: "home" },
            ],
          },
          {
            type: "text",
            value: "Badge (leading icon at size xs inside the pill):",
            style: "subheading",
          },
          {
            type: "section",
            layout: "row",
            align: "center",
            children: [
              { type: "badge", label: "Verified",   tone: "success", icon: "check-circle" },
              { type: "badge", label: "Pending",    tone: "warning", icon: "clock" },
              { type: "badge", label: "Blocked",    tone: "danger",  icon: "ban" },
              { type: "badge", label: "Info",       tone: "info",    icon: "info" },
            ],
          },
          {
            type: "text",
            value: "ListItem (leading icon at size sm — per-row category glyph):",
            style: "subheading",
          },
          {
            type: "list",
            children: [
              { type: "list-item", icon: "mail",         children: [{ type: "text", value: "Inbox — 3 new messages" }] },
              { type: "list-item", icon: "calendar",     children: [{ type: "text", value: "Calendar — 2 meetings today" }] },
              { type: "list-item", icon: "file-text",    children: [{ type: "text", value: "Drafts — 5 documents in progress" }] },
              { type: "list-item", icon: "shield-check", children: [{ type: "text", value: "Security — quarterly review passed" }] },
            ],
          },
        ],
      },

      // ── ③ All 5 sizes side-by-side ────────────────────────────────────────
      {
        type: "section",
        heading: "③ All 5 sizes (xs / sm / md / lg / xl → 12 / 16 / 20 / 24 / 32 px)",
        variant: "card",
        children: [
          {
            type: "text",
            value:
              "The SAME IconNode name (`sparkles`) at every size. The stroke width stays " +
              "uniform (the Lucide 2px stroke); the pixel dimension is what changes. " +
              "Framework owns the mapping — the wire carries only the token name.",
            style: "muted",
          },
          {
            type: "section",
            layout: "row",
            align: "center",
            children: [
              { type: "icon", name: "sparkles", size: "xs" },
              { type: "icon", name: "sparkles", size: "sm" },
              { type: "icon", name: "sparkles", size: "md" },
              { type: "icon", name: "sparkles", size: "lg" },
              { type: "icon", name: "sparkles", size: "xl" },
            ],
          },
        ],
      },

      // ── ④ Tone matrix ─────────────────────────────────────────────────────
      {
        type: "section",
        heading: "④ Tone matrix (4 semantic tones + currentColor default)",
        variant: "card",
        children: [
          {
            type: "text",
            value:
              "Six representative icons × four semantic tones + one currentColor default row. " +
              "The tinted rows exercise the `--vms-error/-warning/-success/-info` tokens — the " +
              "same tokens used by SectionNode.tone, so any AA-contrast pair here that reads " +
              "unclearly is a token issue, not an icon issue.",
            style: "muted",
          },
          { type: "text", value: "Default (currentColor — inherits from surrounding text):", style: "subheading" },
          {
            type: "section",
            layout: "row",
            align: "center",
            children: TONE_ROW_ICONS.map((n) => ({ type: "icon" as const, name: n })),
          },
          { type: "text", value: "tone: \"success\"", style: "subheading" },
          {
            type: "section",
            layout: "row",
            align: "center",
            children: TONE_ROW_ICONS.map((n) => ({ type: "icon" as const, name: n, tone: "success" as const })),
          },
          { type: "text", value: "tone: \"warning\"", style: "subheading" },
          {
            type: "section",
            layout: "row",
            align: "center",
            children: TONE_ROW_ICONS.map((n) => ({ type: "icon" as const, name: n, tone: "warning" as const })),
          },
          { type: "text", value: "tone: \"danger\"", style: "subheading" },
          {
            type: "section",
            layout: "row",
            align: "center",
            children: TONE_ROW_ICONS.map((n) => ({ type: "icon" as const, name: n, tone: "danger" as const })),
          },
          { type: "text", value: "tone: \"info\"", style: "subheading" },
          {
            type: "section",
            layout: "row",
            align: "center",
            children: TONE_ROW_ICONS.map((n) => ({ type: "icon" as const, name: n, tone: "info" as const })),
          },
        ],
      },

      // ── ⑤ LIVE TrackerCell tooltip strip ──────────────────────────────────
      {
        type: "section",
        heading: "⑤ 🚨 LIVE TrackerCell tooltip strip (ICON-06 render-path proof)",
        variant: "card",
        children: [
          {
            type: "text",
            value:
              "HOVER any cell below. The STYLED bubble must appear (rounded, tinted background, " +
              "subtle shadow — the shipped 6.12.1 body-appended `.vms-tooltip-host` singleton). " +
              "If a browser-native GRAY BOX appears, the ICON-06 render-path swap (from " +
              "`el.title = ...` to the styled infrastructure that ships for 8 other nodes) " +
              "did not land, and the page has caught it before publish. HALT and reopen Plan 05.",
            style: "muted",
          },
          { type: "tracker", cells: trackerCells() },
        ],
      },

      // ── ⑥ Icon-only Button (VALID — with tooltip) ─────────────────────────
      {
        type: "section",
        heading: "⑥ Icon-only Button (VALID — icon + tooltip, no label)",
        variant: "card",
        children: [
          {
            type: "text",
            value:
              "Three icon-only buttons with `label:\"\"` + `icon:\"…\"` + `tooltip:\"…\"`. " +
              "Hover shows the styled tooltip; the tooltip text ALSO doubles as the " +
              "screen-reader aria-label (ICON-05 §5). Clicking dispatches and the last " +
              "action name lands in the muted line above the row.",
            style: "muted",
          },
          { type: "text", value: `Last icon-only action: ${state.lastAction}`, style: "muted" },
          {
            type: "section",
            layout: "row",
            align: "center",
            children: [
              { type: "button", label: "", icon: "trash-2", tooltip: "Delete",  action: { name: "icon-only:delete" } },
              { type: "button", label: "", icon: "edit-3",  tooltip: "Edit",    action: { name: "icon-only:edit"   } },
              { type: "button", label: "", icon: "copy",    tooltip: "Copy",    action: { name: "icon-only:copy"   } },
              { type: "button", label: "", icon: "save",    tooltip: "Save",    action: { name: "icon-only:save"   }, emphasis: "primary" },
            ],
          },
        ],
      },

      // ── ⑦ Icon-only Button (INVALID — walker rejection proof) ────────────
      {
        type: "section",
        heading: "⑦ Icon-only Button (INVALID — demonstrates ICON-05 walker rejection)",
        variant: "card",
        tone: "warning",
        children: [
          {
            type: "text",
            value:
              "The button below dispatches `icon-only:trigger-invalid`. The action handler " +
              "constructs a response tree containing an icon-only Button with NO `tooltip:`, " +
              "then hands it to `createAction`, which runs the shipped `validateActionNames` + " +
              "the ICON-05 walker rule and REJECTS the tree with `invalid_tree`. The framework " +
              "returns `{ok:false, errors:[{code:\"invalid_tree\",...}]}` at 500; the shell's " +
              "`onError` fires and the page renders an error banner. This proves the walker " +
              "fires end-to-end on the real backend, not just in unit tests.",
            style: "muted",
          },
          { type: "text", value: `Rejection attempts observed: ${state.invalidAttempted}`, style: "muted" },
          {
            type: "button",
            label: "Trigger the ICON-05 walker rejection",
            icon: "alert-triangle",
            tone: "danger",
            emphasis: "primary",
            action: { name: "icon-only:trigger-invalid" },
          },
        ],
      },

      // ── ⑧ Themes ──────────────────────────────────────────────────────────
      {
        type: "section",
        heading: "⑧ Themes",
        variant: "card",
        children: [
          {
            type: "text",
            value:
              "Use the picker at the very top of the page to switch across the shipped light " +
              "default and all 12 themes. The plan requires at-least-two-themes (default light " +
              "+ one dark); shipping all 13 matches the prior verification pages' pattern and " +
              "gives Ashley the full sweep in one place. AA-contrast pairs on tinted card + " +
              "on-fill icons were hand-checked in Plan 22-08.",
            style: "muted",
          },
        ],
      },
    ],
  };
}

// ─── The shipped validator, on the GET path too ───────────────────────────────
//
// `createAction` runs validateActionNames + validateSectionAction itself, so the
// POST path is covered by the real framework code. GET does not flow through it,
// so the SAME shipped validators run here. Throwing is the point: a tree the
// real server would reject must fail HERE, loudly, before Ashley ever sees the
// page — never render fine in a harness and 500 later in production.
function validated(vm: ViewNode): ViewNode {
  validateActionNames(vm);
  validateSectionAction(vm);
  return vm;
}

// Fail at STARTUP, not on first request: if the tree is invalid, this process
// must not come up at all.
validated(buildVm(initialState()));

// ─── Actions ──────────────────────────────────────────────────────────────────

const actionHandler = createAction<IconState>(async (payload) => {
  const state = payload.state;
  switch (payload.name) {
    case "icon-only:delete":
    case "icon-only:edit":
    case "icon-only:copy":
    case "icon-only:save":
    case "labeled:save":
    case "labeled:edit":
    case "labeled:delete":
    case "labeled:refresh":
      return { vm: buildVm({ ...state, lastAction: payload.name }), state: { ...state, lastAction: payload.name } };

    case "icon-only:trigger-invalid": {
      // Construct a deliberately-invalid response tree — an icon-only Button
      // with NO tooltip. `createAction` runs validateActionNames +
      // validateSectionAction over the tree before it returns; the ICON-05
      // walker rule fires and throws `invalid_tree`; the framework catches it
      // and emits `{ok:false, errors:[{code:"invalid_tree",...}]}` at 500 —
      // the shell's onError renders the banner. State updates so the counter
      // above the button increments AFTER a rejection was attempted, but the
      // returned VM below never lands (it's the framework's rejection tree).
      const bumped = { ...state, invalidAttempted: state.invalidAttempted + 1 };
      return {
        vm: {
          type: "page",
          title: "Icons — v7.0.0 Tailnet Verification",
          width: "wide",
          children: [
            // Icon-only Button with NO tooltip — the ICON-05 rejection surface.
            // The walker rejects this tree; the client never renders it. If
            // you SEE this tree in the browser, the walker failed to fire and
            // ICON-05 is broken end-to-end.
            {
              type: "button",
              label: "",
              icon: "trash-2",
              action: { name: "icon-only:noop-should-not-reach" },
            },
          ],
        },
        state: bumped,
      };
    }

    default:
      throw new UnknownActionError(payload.name);
  }
});

// ─── The REAL shipped CSS (default + all 12 themes), served verbatim ──────────

const stylesDir = new URL("../../viewmodel-shell/styles/", import.meta.url);

async function serveShippedCss(pathname: string): Promise<Response | null> {
  const m = pathname.match(/^\/vms\/(default\.css|themes\/[a-z-]+\.css)$/);
  if (!m) return null;
  const file = Bun.file(new URL(m[1], stylesDir));
  if (await file.exists()) {
    return new Response(file, { headers: { "Content-Type": "text/css; charset=utf-8" } });
  }
  return new Response("Not Found", { status: 404 });
}

// ─── Vite-built client (dist/) ────────────────────────────────────────────────

const distDir = new URL("./dist/", import.meta.url);

async function serveStatic(pathname: string): Promise<Response> {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (rel.split("/").some((seg) => seg === "..")) {
    return new Response("Forbidden", { status: 403 });
  }
  const file = Bun.file(new URL(rel, distDir));
  if (await file.exists()) return new Response(file);
  if (!rel.includes(".")) {
    const index = Bun.file(new URL("index.html", distDir));
    if (await index.exists()) return new Response(index);
  }
  return new Response("Not Found", { status: 404 });
}

const skillHandler = createAgentSkillHandler({
  appPreamble:
    "This is the v7.0.0 Icons verification page. GET /api/icons returns a page " +
    "exercising every icon surface v7.0.0 adds: the Hestia 8-tile card grid " +
    "(SectionNode.icon), icon-in-Button / Link / Badge / ListItem examples, " +
    "all 5 sizes of a standalone IconNode side-by-side, a 6-tone × 6-icon " +
    "tone matrix, a LIVE TrackerNode strip whose cells carry the renamed " +
    "TrackerCell.tooltip (ICON-06 — the browser hover shows the styled 6.12.1 " +
    "bubble, not the native gray box), an icon-only Button toolbar (ICON-05 " +
    "valid form), and a `Trigger the ICON-05 walker rejection` button that " +
    "constructs an invalid tree the shipped validators reject at 500.",
});

// ─── HTTP server ──────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? "3013");

Bun.serve({
  // Bind all interfaces (0.0.0.0) so the page is reachable over the tailnet at
  // http://100.113.23.63:PORT/ AND at 127.0.0.1 for a local smoke check.
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/icons" && request.method === "GET") {
      const state = initialState();
      // The shipped validator on the GET path — see `validated()`.
      return Response.json({ ok: true, vm: validated(buildVm(state)), state });
    }
    if (url.pathname === "/api/icons/action" && request.method === "POST") {
      return actionHandler(request);
    }
    if (url.pathname === "/.well-known/vms-skill.md" && request.method === "GET") {
      return skillHandler(request);
    }

    if (request.method === "GET") {
      const css = await serveShippedCss(url.pathname);
      if (css) return css;
      return serveStatic(url.pathname);
    }
    return new Response("Method Not Allowed", { status: 405 });
  },
});

console.log(
  `IconVerification (v7.0.0 icons sign-off) → http://localhost:${port}  ` +
    `(tailnet: http://100.113.23.63:${port}/) — open it in a browser`,
);
