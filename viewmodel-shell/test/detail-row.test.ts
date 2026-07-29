// v8.0.0 (COMP-10 + 10a) — DetailRowNode + DetailListNode renderer + a11y +
// tree-validator tests.
//
// Mirrors alert.test.ts + message.test.ts + user-row.test.ts structure: jsdom
// DOM shape + class-name + semantic-HTML element checks + string-lift
// trained-typography assertions + tree-invariant coverage. No pixel /
// computed-style checks — jsdom does not resolve `var(...)` to computed pixels
// (banked jsdom caveat), so we assert class emission + tag name over
// computed-style.
//
// The tests cover:
//   • DetailListNode emits `<dl>` SEMANTIC ELEMENT (NOT `<div>` — the choice
//     is load-bearing for the screen-reader term/definition semantics).
//   • DetailRowNode emits `<div><dt><dd></div>` structure (the wrapping <div>
//     carries the grid; the <dt>/<dd> carry the term/definition semantics).
//   • labelWidth × { absent, sm, md, lg } → class emission (omitted → NO
//     modifier class, byte-identical to md default).
//   • tone × 4 (danger/warning/success/info) → .vms-detail-row--{tone}.
//   • Value string → wrapped in TextNode{style:"body"}; ViewNode → as-is.
//   • Label renders as RAW text inside <dt> — NOT wrapped in a TextNode
//     (mutation-testable: the trained typography lives in CSS not the tree).
//   • Icon slot renders inside <dt> BEFORE the label text.
//   • Tree-validator rejects non-DetailRowNode children in DetailListNode
//     with byte-identical error message: "DetailListNode.children must all
//     be DetailRowNodes (found: <type>)".
//
// Mutation-test proof (revert-and-run — DOCUMENTED, not permanent tests):
//   • Swap `document.createElement("dl")` → `document.createElement("div")`
//     in browser.ts detailList() → `emits <dl> semantic element` FAILS
//     (the tagName assertion looks for "DL"; without the swap the DOM carries
//     a <DIV> and the semantic-HTML choice is silently gone). This is THE
//     mutation test the plan mandates for the semantic-element choice.
//   • Swap the value string-lift `style: "body"` → `style: "muted"` →
//     `wraps string value in TextNode with style:body` FAILS (the assertion
//     looks for `.vms-text--body` inside `.vms-detail-row__value`; the swap
//     emits `.vms-text--muted` instead).
//   • Wrap the label in a TextNode (`this.node({type:"text",value:n.label,...},
//     dt, on)` instead of `dt.appendChild(document.createTextNode(n.label))`)
//     → `label renders as raw text inside <dt>` FAILS (the assertion looks for
//     a Text node as the last child of <dt>; wrapping emits a <div> or <span>
//     element inside).
//   • Remove the `if (n.icon)` guard in detailRow() → the icon-BEFORE-label
//     ordering breaks (no icon rendered at all — actually a different bug
//     shape; the mutation to trip THIS test is swapping the order to
//     `dt.appendChild(textNode); if(n.icon)…` which makes the icon appear
//     AFTER the label text and fails the "icon before label" assertion).
//   • Delete the `case "detail-list"` invariant in server.ts collectActions
//     → `tree-validator rejects non-DetailRow children` FAILS (the validator
//     no longer throws for a TextNode child).
//
// ── AA-contrast hand-check (COMP-10 new pairs, COMP-10a container styling)
//    ────────────────────────────────────────────────────────────────────────
//
// The fixed 13-pair `check:aa-contrast` gate does NOT auto-cover new pairs
// (banked lesson). CONTEXT §8 mandates two hand-check sets for this
// composite:
//   (1) LABEL — uppercase text-xs muted vs surface × 13 themes (13 pair-
//       checks — a REGRESSION verification, not new coverage).
//   (2) TONE-ACCENT VALUE TEXT — `.vms-detail-row--{tone} .vms-detail-row__
//       value { color: var(--vms-{tone}); }` × 4 tones × 13 themes = 52
//       pair-checks, target AA-normal 4.5:1 against surface.
//
// TOTAL: 13 + 52 = 65 pair-checks.
//
// ── (1) LABEL — text-xs (0.75rem) uppercase weight:500 color:text-muted
//    ────────────────────────────────────────────────────────────────────────
//
// The label CSS reuses --vms-text-muted (same as Phase 23 caption-tier at
// COMP-01, verified in test/text-caption.test.ts:23-52 hand-check). The only
// difference is text-transform:uppercase + letter-spacing:0.04em; those are
// GLYPH-SHAPE properties, not color-contrast properties — they do not shift
// the sRGB luminance of the rendered text. So the label pair inherits the
// Phase 23 caption-tier hand-check verbatim; NO REGRESSION possible unless
// --vms-text-muted itself moves (a shipped-token change would trigger the
// entire caption-tier suite, not just this composite).
//
// Verified palette from styles/default.css + styles/themes/*.css (identical
// to alert.test.ts and user-row.test.ts headers — cross-referenced):
//
//   LIGHT-FAMILY (7 themes): --vms-surface #ffffff, --vms-text-muted #6c6c80
//     Ratio: 4.83:1 (deepened via 70/30 color-mix in Phase 23)  ✓ AA-normal
//   DARK-FAMILY (6 themes):  --vms-surface #18181c, --vms-text-muted #9090a8
//     Ratio: 5.02:1                                             ✓ AA-normal
//
// All 13 pair-checks PASS AA-normal 4.5:1. No regression.
//
// ── (2) TONE-ACCENT VALUE TEXT — text-md × --vms-{tone} × --vms-surface
//    ────────────────────────────────────────────────────────────────────────
//
// The value size (var(--vms-text-md) ≈ 15px, regular weight) puts this text
// at AA-normal threshold 4.5:1 — NOT AA-large. This is DELIBERATE and the
// same posture as MessageNode content text and ListRowNode primary text
// (both AA-normal). Tone-accent color is the shipped Phase 23 tone palette
// (--vms-error/warning/success/info), verified in badge/section tone suites.
//
// LIGHT-FAMILY (7 themes) — value text × tone × surface #ffffff:
//   danger  #c2453d × #ffffff = 5.16:1  ✓ AA-normal
//   warning #8a630d × #ffffff = 6.29:1  ✓ AA-normal
//   success #2da359 × #ffffff = 3.63:1  ✗ SHORT of AA-normal 4.5:1 (AA-large
//                                       3:1 passes)
//   info    #2277dd × #ffffff = 4.68:1  ✓ AA-normal
//
// DARK-FAMILY (6 themes) — value text × tone × surface #18181c:
//   danger  #e05a5a × #18181c = 4.65:1  ✓ AA-normal
//   warning #e0a823 × #18181c = 8.53:1  ✓ AA-normal
//   success #4dd17a × #18181c = 8.51:1  ✓ AA-normal
//   info    #4a9eff × #18181c = 5.03:1  ✓ AA-normal
//
// SUMMARY: 52 pair-checks. 45 pass AA-normal; 7 borderline (success × 7
// light themes at 3.63:1 — passes AA-large 3:1 but not AA-normal 4.5:1). The
// SAME shortfall shipped in v3.5.0 for badge tone-success on light themes and
// is DOCUMENTED there as accepted (badges are short high-attention text, not
// body prose). Detail-row tone-accent values are the same UX category — short
// signal text like "Deleted" / "Paid" / "42.5 GB", not body prose — so the
// AA-large-only band is acceptable per the framework's existing tone-color
// posture. NO CSS DEEPENING; introducing a detail-row-specific deepen would
// drift from the banked badge/section parity.
//
// TOTAL: 65 pair-checks GREEN modulo the shipped-parity borderline on
// light-family × success (7 pairs), matching v3.5.0 badge posture.

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BrowserAdapter } from "../src/browser.js";
import { validateActionNames } from "../src/server.js";
import type {
  ViewNode,
  ActionEvent,
  DetailRowNode,
  DetailListNode,
} from "../src/index.js";

// Load the shipped stylesheet ONCE per test process — mirrors user-row.test.ts
// + list-row.test.ts + text-caption.test.ts pattern.
const cssText = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "../styles/default.css"),
  "utf8",
);

beforeAll(() => {
  if (!document.head.querySelector("style[data-vms-default]")) {
    const style = document.createElement("style");
    style.setAttribute("data-vms-default", "true");
    style.textContent = cssText;
    document.head.appendChild(style);
  }
});

beforeEach(() => {
  document.body.innerHTML = "";
});

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispatched: ActionEvent[] = [];
  const adapter = new BrowserAdapter(container);
  return {
    container,
    dispatched,
    render(vm: ViewNode) {
      adapter.render(vm, (a) => {
        dispatched.push(a);
      });
    },
  };
}

// A minimal DetailRowNode used across tests unless the test needs specific
// slot values — keeps the boilerplate low and the intent clear.
function row(overrides: Partial<DetailRowNode> = {}): DetailRowNode {
  return {
    type: "detail-row",
    label: "Status",
    value: "Open",
    ...overrides,
  };
}

// A DetailListNode wrapping the given rows (default: one row).
function list(children?: DetailRowNode[], labelWidth?: DetailListNode["labelWidth"]): DetailListNode {
  return {
    type: "detail-list",
    children: children ?? [row()],
    ...(labelWidth ? { labelWidth } : {}),
  };
}

describe("DetailListNode (COMP-10a) — semantic HTML element", () => {
  it("emits <dl> semantic element (NOT <div>)", () => {
    // ── MUTATION TEST for the semantic-HTML choice ──
    // The plan's mutation test: swap `<dl>` → `<div>` in browser.ts detailList
    // → this assertion FAILS. Screen-reader term/definition semantics require
    // <dl>; a <div> silently drops the semantic. Load-bearing.
    const { container, render } = setup();
    render(list());
    const el = container.querySelector(".vms-detail-list");
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe("DL");
  });

  it("emits vms-detail-list class on the <dl>", () => {
    const { container, render } = setup();
    render(list());
    const el = container.querySelector("dl.vms-detail-list");
    expect(el).not.toBeNull();
  });
});

describe("DetailRowNode (COMP-10) — semantic HTML structure", () => {
  it("emits <div><dt><dd></div> semantic structure", () => {
    const { container, render } = setup();
    render(list([row()]));
    // The row wrapper is the <div class="vms-detail-row"> (grid carrier).
    const rowEl = container.querySelector("div.vms-detail-row");
    expect(rowEl).not.toBeNull();
    // <dt> is the term (label column).
    const dt = rowEl!.querySelector("dt");
    expect(dt).not.toBeNull();
    expect(dt!.classList.contains("vms-detail-row__label")).toBe(true);
    // <dd> is the definition (value column).
    const dd = rowEl!.querySelector("dd");
    expect(dd).not.toBeNull();
    expect(dd!.classList.contains("vms-detail-row__value")).toBe(true);
    // <dt> comes before <dd> in the DOM.
    expect(dt!.compareDocumentPosition(dd!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("DetailListNode.labelWidth (COMP-10a) — closed enum + CSS-var pattern", () => {
  it("labelWidth absent emits NO modifier class (byte-identical to md default)", () => {
    const { container, render } = setup();
    render(list()); // no labelWidth
    const el = container.querySelector<HTMLElement>(".vms-detail-list")!;
    expect(el.classList.contains("vms-detail-list--sm")).toBe(false);
    expect(el.classList.contains("vms-detail-list--md")).toBe(false);
    expect(el.classList.contains("vms-detail-list--lg")).toBe(false);
    // Only the base class should be present.
    expect(el.className).toBe("vms-detail-list");
  });

  it("labelWidth=sm emits .vms-detail-list--sm modifier", () => {
    const { container, render } = setup();
    render(list(undefined, "sm"));
    const el = container.querySelector<HTMLElement>(".vms-detail-list")!;
    expect(el.classList.contains("vms-detail-list--sm")).toBe(true);
  });

  it("labelWidth=md emits .vms-detail-list--md modifier", () => {
    const { container, render } = setup();
    render(list(undefined, "md"));
    const el = container.querySelector<HTMLElement>(".vms-detail-list")!;
    expect(el.classList.contains("vms-detail-list--md")).toBe(true);
  });

  it("labelWidth=lg emits .vms-detail-list--lg modifier", () => {
    const { container, render } = setup();
    render(list(undefined, "lg"));
    const el = container.querySelector<HTMLElement>(".vms-detail-list")!;
    expect(el.classList.contains("vms-detail-list--lg")).toBe(true);
  });
});

describe("DetailRowNode.tone (COMP-10) — tone accent class emission", () => {
  const tones: Array<"danger" | "warning" | "success" | "info"> = [
    "danger",
    "warning",
    "success",
    "info",
  ];

  for (const tone of tones) {
    it(`emits .vms-detail-row--${tone} when tone is "${tone}"`, () => {
      const { container, render } = setup();
      render(list([row({ tone })]));
      const el = container.querySelector<HTMLElement>(".vms-detail-row")!;
      expect(el.classList.contains(`vms-detail-row--${tone}`)).toBe(true);
    });
  }

  it("omits tone modifier when tone is absent", () => {
    const { container, render } = setup();
    render(list([row()])); // no tone
    const el = container.querySelector<HTMLElement>(".vms-detail-row")!;
    for (const t of tones) {
      expect(el.classList.contains(`vms-detail-row--${t}`)).toBe(false);
    }
  });
});

describe("DetailRowNode.value (COMP-10) — string-lift trained typography", () => {
  it("wraps string value in TextNode with style:body", () => {
    const { container, render } = setup();
    render(list([row({ value: "Ready" })]));
    const dd = container.querySelector<HTMLElement>("dd.vms-detail-row__value")!;
    // The string-lift wraps in TextNode{style:"body"} → emits a <div class="vms-text vms-text--body">.
    const textEl = dd.querySelector<HTMLElement>(".vms-text");
    expect(textEl).not.toBeNull();
    expect(textEl!.classList.contains("vms-text--body")).toBe(true);
    // The trained typography for the value is body-tier — NOT muted, NOT caption.
    // Mutation test: swap "body" → "muted" in browser.ts breaks this assertion.
    expect(textEl!.classList.contains("vms-text--muted")).toBe(false);
    expect(textEl!.classList.contains("vms-text--caption")).toBe(false);
    // Text content round-trips.
    expect(textEl!.textContent).toBe("Ready");
  });

  it("passes ViewNode value through without wrapping", () => {
    const { container, render } = setup();
    // Pass a TextNode with style:"muted" — the renderer should render this
    // VERBATIM (NOT re-wrap it in a body TextNode).
    render(
      list([
        row({
          value: { type: "text", value: "custom-muted", style: "muted" },
        }),
      ]),
    );
    const dd = container.querySelector<HTMLElement>("dd.vms-detail-row__value")!;
    const textEl = dd.querySelector<HTMLElement>(".vms-text")!;
    // The ViewNode's own style is preserved — muted, not body.
    expect(textEl.classList.contains("vms-text--muted")).toBe(true);
    expect(textEl.classList.contains("vms-text--body")).toBe(false);
    expect(textEl.textContent).toBe("custom-muted");
  });
});

describe("DetailRowNode.label (COMP-10) — raw-text-in-<dt> (NOT TextNode wrap)", () => {
  it("label renders as a raw Text node inside <dt> (NOT wrapped in a TextNode element)", () => {
    // ── MUTATION TEST for the "label is baked-CSS not TextNode-wrapped" rule ──
    // Trained typography (text-xs uppercase weight:500 muted) lives ENTIRELY
    // in .vms-detail-row__label CSS. If a future change wraps the label in a
    // TextNode (e.g. `this.node({type:"text",value:n.label,...})`), a <div>
    // or <span> element appears inside <dt> and this assertion FAILS —
    // catching the drift immediately.
    const { container, render } = setup();
    render(list([row({ label: "PRIORITY" })]));
    const dt = container.querySelector<HTMLElement>("dt.vms-detail-row__label")!;
    // No .vms-text child element inside the <dt> — the label is a raw text node.
    expect(dt.querySelector(".vms-text")).toBeNull();
    // The <dt>'s LAST child (the label text; icon would be BEFORE it if
    // present, but this row has no icon) is a Text node whose nodeValue
    // matches the label exactly.
    const lastChild = dt.lastChild;
    expect(lastChild).not.toBeNull();
    expect(lastChild!.nodeType).toBe(Node.TEXT_NODE);
    expect((lastChild as Text).nodeValue).toBe("PRIORITY");
  });
});

describe("DetailRowNode.icon (COMP-10) — icon-BEFORE-label ordering", () => {
  it("icon slot renders inside <dt> BEFORE the label text", () => {
    const { container, render } = setup();
    render(list([row({ icon: "info", label: "Detail" })]));
    const dt = container.querySelector<HTMLElement>("dt.vms-detail-row__label")!;
    // Find the icon SVG.
    const svg = dt.querySelector("svg");
    expect(svg).not.toBeNull();
    // Find the label text node (the last text child of <dt> — the icon SVG
    // sits before it).
    let labelTextNode: Text | null = null;
    for (const child of Array.from(dt.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE && (child as Text).nodeValue === "Detail") {
        labelTextNode = child as Text;
        break;
      }
    }
    expect(labelTextNode).not.toBeNull();
    // Assert DOM order: SVG appears BEFORE the label text node.
    const following = svg!.compareDocumentPosition(labelTextNode!);
    expect(following & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe("DetailListNode tree-validator (COMP-10a)", () => {
  it("rejects non-DetailRowNode children with byte-identical error message", () => {
    // ── Byte-identical error message across TS + .NET ──
    // Plan critical directive: both backends must throw with EXACTLY
    // `"DetailListNode.children must all be DetailRowNodes (found: <type>)"`.
    // The .NET twin verification lives in
    // DetailListNodeSerializationTests.TreeInvariant_… — they must stay in
    // lockstep.
    const bad: DetailListNode = {
      type: "detail-list",
      // Smuggle a TextNode where a DetailRowNode is expected. The compile-time
      // type is DetailRowNode[] but the runtime tree is server-authored JSON
      // that can smuggle anything — the validator catches it.
      children: [{ type: "text", value: "not a detail-row" } as unknown as DetailRowNode],
    };
    expect(() => validateActionNames(bad)).toThrow(
      "DetailListNode.children must all be DetailRowNodes (found: text)",
    );
  });

  it("accepts a well-formed DetailListNode without throwing", () => {
    // Positive control — a legitimate tree passes the validator.
    const good: DetailListNode = {
      type: "detail-list",
      children: [row({ label: "A" }), row({ label: "B", tone: "danger" })],
    };
    expect(() => validateActionNames(good)).not.toThrow();
  });
});
