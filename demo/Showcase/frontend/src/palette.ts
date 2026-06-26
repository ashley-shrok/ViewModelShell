// Exhaustive appearance palette — every combination of the 3.0.0 axes, rendered
// in one dense page so visual issues (a leaked size, a low-contrast tone, a
// missing class) jump out at a glance. Throwaway diagnostic; not a parity fixture.
// Drives the BrowserAdapter directly (no backend), exactly like main.ts.
import "@ashley-shrok/viewmodel-shell/styles.css";
import darkPurpleCss from "@ashley-shrok/viewmodel-shell/themes/dark-purple.css?inline";
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";
import type { ViewNode, ActionEvent, StateAccess } from "@ashley-shrok/viewmodel-shell";

type Emphasis = "primary" | "secondary";
type Tone = "danger" | "warning" | "success" | "info";
type Size = "sm" | "lg";

const EMPHASIS: (Emphasis | undefined)[] = [undefined, "primary", "secondary"];
const TONE: (Tone | undefined)[] = [undefined, "danger", "warning", "success", "info"];
const SIZE: (Size | undefined)[] = [undefined, "sm", "lg"]; // undefined = md default
const STYLE = ["heading", "subheading", "body", "muted", "strikethrough", "pre"] as const;
const LI_STATE = [undefined, "active", "done", "disabled", "high", "running", "moving"];
const ROW_STATE = [undefined, "done", "disabled", "running"];

let n = 0;
const act = (): ActionEvent => ({ name: `palette-${n++}` });
const o = <T>(k: string, v: T | undefined) => (v ? { [k]: v } : {});

// ── Buttons: per size, a labeled row per emphasis × every tone ──────────────
const buttonSizeSections: ViewNode[] = SIZE.map((size) => ({
  type: "section",
  variant: "card",
  heading: `size: ${size ?? "md (default)"}`,
  children: EMPHASIS.map(
    (emphasis): ViewNode => ({
      type: "section",
      layout: "row",
      align: "center",
      children: [
        { type: "text", value: emphasis ?? "(no emphasis)", style: "muted" },
        ...TONE.map(
          (tone): ViewNode => ({
            type: "button",
            label: tone ?? "neutral",
            action: act(),
            ...o("emphasis", emphasis),
            ...o("tone", tone),
            ...o("size", size),
          }),
        ),
      ],
    }),
  ),
}));

// ── Copy buttons (share button CSS) — one tone row at each size ─────────────
const copyButtonSection: ViewNode = {
  type: "section",
  variant: "card",
  heading: "Copy buttons (share .vms-button styling)",
  children: SIZE.map(
    (size): ViewNode => ({
      type: "section",
      layout: "row",
      align: "center",
      children: [
        { type: "text", value: `size: ${size ?? "md"}`, style: "muted" },
        ...TONE.map(
          (tone): ViewNode => ({
            type: "copy-button",
            text: `copy-${tone ?? "neutral"}`,
            label: tone ?? "neutral",
            emphasis: "secondary",
            ...o("tone", tone),
            ...o("size", size),
          }),
        ),
      ],
    }),
  ),
};

// ── Section tone: card vs bare, every tone ──────────────────────────────────
const sectionToneCard = (bare: boolean): ViewNode => ({
  type: "section",
  layout: "cards",
  minItem: "sm",
  children: TONE.map(
    (tone): ViewNode => ({
      type: "section",
      ...(bare ? {} : { variant: "card" }),
      ...o("tone", tone),
      children: [
        { type: "text", value: tone ?? "neutral", style: "subheading" },
        { type: "text", value: bare ? "bare section" : "card surface", style: "muted" },
      ],
    }),
  ),
});

const sectionToneSection: ViewNode = {
  type: "section",
  heading: "Section tone (orthogonal to variant:card)",
  children: [
    { type: "text", value: "variant:\"card\" + tone", style: "subheading" },
    sectionToneCard(false),
    { type: "text", value: "bare section + tone", style: "subheading" },
    sectionToneCard(true),
  ],
};

// ── Text: every style × every tone (tone color wins over a style color) ─────
const textSection: ViewNode = {
  type: "section",
  variant: "card",
  heading: "Text — style (typography) × tone (color)",
  children: STYLE.flatMap((style): ViewNode[] => [
    { type: "text", value: `style: ${style}`, style: "muted" },
    {
      type: "section",
      layout: "row",
      align: "baseline",
      children: TONE.map(
        (tone): ViewNode => ({
          type: "text",
          value: tone ?? "neutral",
          style,
          ...o("tone", tone),
        }),
      ),
    },
  ]),
};

// ── List items: every state, every tone, a few combos ───────────────────────
const listSection: ViewNode = {
  type: "section",
  heading: "List items",
  children: [
    { type: "text", value: "state (lifecycle)", style: "subheading" },
    {
      type: "section",
      variant: "card",
      children: [
        {
          type: "list",
          children: LI_STATE.map(
            (st): ViewNode => ({
              type: "list-item",
              ...o("state", st),
              children: [{ type: "text", value: `state: ${st ?? "neutral"}` }],
            }),
          ),
        },
      ],
    },
    { type: "text", value: "tone (severity)", style: "subheading" },
    {
      type: "section",
      variant: "card",
      children: [
        {
          type: "list",
          children: TONE.map(
            (tone): ViewNode => ({
              type: "list-item",
              ...o("tone", tone),
              children: [{ type: "text", value: `tone: ${tone ?? "neutral"}` }],
            }),
          ),
        },
      ],
    },
    { type: "text", value: "state + tone (compose)", style: "subheading" },
    {
      type: "section",
      variant: "card",
      children: [
        {
          type: "list",
          children: [
            { type: "list-item", state: "active", tone: "danger", children: [{ type: "text", value: "active + danger" }] },
            { type: "list-item", state: "done", tone: "success", children: [{ type: "text", value: "done + success" }] },
            { type: "list-item", state: "high", tone: "warning", children: [{ type: "text", value: "high + warning" }] },
            { type: "list-item", state: "running", tone: "info", children: [{ type: "text", value: "running + info" }] },
          ],
        },
      ],
    },
  ],
};

// ── Table rows: every state, every tone, a couple combos ────────────────────
const tableSection: ViewNode = {
  type: "section",
  variant: "card",
  heading: "Table rows — state & tone",
  children: [
    {
      type: "table",
      columns: [{ key: "k", label: "combination" }, { key: "kind", label: "axis" }],
      rows: [
        ...ROW_STATE.map((st) => ({ cells: { k: st ?? "neutral", kind: "state" }, ...o("state", st) })),
        ...TONE.map((tone) => ({ cells: { k: tone ?? "neutral", kind: "tone" }, ...o("tone", tone) })),
        { cells: { k: "done + warning", kind: "state+tone" }, state: "done", tone: "warning" },
        { cells: { k: "running + danger", kind: "state+tone" }, state: "running", tone: "danger" },
      ],
    },
  ],
};

function buildVm(theme: "light" | "dark"): ViewNode {
  return {
    type: "page",
    title: "Appearance Palette — every axis combination (3.0.0)",
    width: "wide",
    children: [
      {
        type: "section",
        layout: "row",
        arrange: "space-between",
        align: "center",
        children: [
          { type: "text", value: "Every emphasis × tone × size, every section/text/list/row tone & state. Tone reuses the AA-cleared tokens; size is the ONLY axis that changes box metrics.", style: "muted" },
          {
            type: "section",
            layout: "row",
            children: [
              { type: "button", label: "Light", action: { name: "theme:light" }, ...(theme === "light" ? { emphasis: "primary" } : {}) },
              { type: "button", label: "Dark", action: { name: "theme:dark" }, ...(theme === "dark" ? { emphasis: "primary" } : {}) },
            ],
          },
        ],
      },
      { type: "section", heading: "Buttons — emphasis × tone × size", children: buttonSizeSections },
      copyButtonSection,
      sectionToneSection,
      textSection,
      listSection,
      tableSection,
    ],
  };
}

// ── Mount (static; the only interactivity is the theme toggle) ──────────────
const themeStyle = document.createElement("style");
document.head.appendChild(themeStyle);
let theme: "light" | "dark" = "light";
function applyTheme() {
  themeStyle.textContent = theme === "dark" ? darkPurpleCss : "";
}

const adapter = new BrowserAdapter(document.getElementById("app")!);
const noopState: StateAccess = { read: () => undefined, write: () => {} };
function handle(action: ActionEvent): void {
  if (action.name === "theme:light") { theme = "light"; applyTheme(); rerender(); return; }
  if (action.name === "theme:dark") { theme = "dark"; applyTheme(); rerender(); return; }
}
function rerender() {
  adapter.render(buildVm(theme), handle, noopState);
}
applyTheme();
rerender();
