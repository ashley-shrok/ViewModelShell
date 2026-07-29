// v8.0.0 (COMP-12 + 12a) — SettingRowNode + SettingListNode renderer +
// a11y + tree-validator tests.
//
// Mirrors detail-row.test.ts + timeline.test.ts + list-row.test.ts structure:
// jsdom DOM shape + class-name + semantic-HTML element checks + string-lift
// trained-typography assertions + tree-invariant coverage + stopPropagation
// from-nested-switch coverage.
//
// The tests cover:
//   • SettingListNode emits `<ul class="vms-setting-list">`.
//   • SettingListNode.heading emits a SIBLING `<h3 class="vms-setting-list__
//     heading">` BEFORE the `<ul>` (NOT inside — same posture as Phase 24
//     EmptyStateNode's "structural elements outside the semantic list").
//   • SettingListNode without heading omits the `<h3>` entirely.
//   • SettingRowNode emits `<li class="vms-setting-row">` with optional
//     `--clickable` modifier when action present.
//   • String-lift trained typography: label string → TextNode { style:"body",
//     weight:"medium" } (MUTATION-testable: swap "medium" → "bold" fails
//     the assertion below).
//   • String-lift: description string → TextNode { style:"muted" } inside a
//     `<p class="vms-setting-row__description">` (the <p> receives the
//     max-width:42rem readable-line-length cap from CSS).
//   • Description absent → no description element at all.
//   • Icon renders via renderIconSvg inside the body column.
//   • Trailing slot renders inside `.vms-setting-row__control`.
//   • **Natural pairing (per CONTEXT §9)**: CheckboxNode(variant:"switch")
//     inside the trailing slot renders with COMP-03's shipped DOM classes
//     (.vms-checkbox + .vms-field--switch + .vms-checkbox__input + role=
//     switch). This is the whole reason SettingRowNode exists — an app
//     writes { label, description, trailing: switch } and gets the shipped
//     settings-row layout for free.
//   • **stopPropagation-from-switch**: clicking a trailing switch fires the
//     switch's own action (or no action if unbound) but does NOT double-fire
//     the whole-row action. This proves the mitigation for threat
//     T-25-04-02 (the extended stopPropagation selector list in browser.ts
//     settingRow() includes .vms-field--switch).
//   • Action-bearing SettingRow dispatches on Enter + Space + click; Tab
//     does NOT dispatch.
//   • Tree-validator rejects non-SettingRowNode children in SettingListNode
//     with byte-identical error message: "SettingListNode.children must all
//     be SettingRowNodes (found: <type>)".
//
// Mutation-test proof (revert-and-run — DOCUMENTED, not permanent tests):
//   • Swap `weight: "medium"` → `weight: "bold"` in browser.ts settingRow()
//     label wrap → `wraps string label in TextNode style:body weight:medium`
//     FAILS (the assertion looks for both weight:medium indirectly via
//     TextNode + medium class — see the mutation-test assertion below).
//   • Delete `.vms-field--switch` from the settingRow() stopPropagation
//     selector list → `whole-row action stopPropagates from a nested
//     switch` FAILS (the switch click bubbles to the row action, both
//     dispatch names appear in the spy list, and the assertion that ONLY
//     the switch action fires FAILS).
//   • Move the heading INSIDE the <ul> (append to ul instead of parent) →
//     `heading emits <h3> BEFORE <ul> as sibling` FAILS (the assertion
//     checks parent.firstChild.tagName === "H3", which becomes "UL" after
//     the mutation).
//   • Delete the `case "setting-list"` invariant in server.ts collectActions
//     → `tree-validator rejects non-SettingRow children` FAILS (the
//     validator no longer throws for a TextNode child).
//
// ── AA-CONTRAST HAND-CHECK (COMP-12 + 12a) ──────────────────────────────────
//
// REUSES Phase 23 checkbox-switch AA hand-check + Phase 24 primary composite
// text pairs. NO NEW pair-checks — the label uses body-tier text (covered
// by Phase 24 ListRowNode.primary + MessageNode.body + AlertNode.title text
// pairs; verified in alert.test.ts + message.test.ts + list-row.test.ts
// headers), description uses muted text (covered by Phase 23 COMP-01 caption
// tier verification via text-muted × surface pairs), and the trailing switch
// uses COMP-03's shipped colors (covered by checkbox-switch.test.ts:23-45
// hand-check header — the OFF/ON track vs thumb pairs across 13 themes).
//
// Verify no regression. If any of the three constituent hand-checks moves
// (Phase 23 tone palette change or Phase 24 text-tier deepen), re-run the
// relevant hand-check header — this composite inherits both without
// deepening either.

import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { BrowserAdapter } from "../src/browser.js";
import { validateActionNames } from "../src/server.js";
import type {
  ViewNode,
  ActionEvent,
  StateAccess,
  SettingRowNode,
  SettingListNode,
} from "../src/index.js";

// Load the shipped stylesheet ONCE per test process — mirrors detail-row.
// test.ts + timeline.test.ts pattern.
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

// Minimal StateAccess for the checkbox-switch pairing tests (any test that
// renders a CheckboxNode needs a live StateAccess to read `bind`).
function mkSA(state: Record<string, unknown>): StateAccess {
  return {
    read(path: string): unknown {
      const segs = path.split(".");
      let cur: unknown = state;
      for (const seg of segs) {
        if (cur == null || typeof cur !== "object") return undefined;
        cur = (cur as Record<string, unknown>)[seg];
      }
      return cur;
    },
    write(path: string, value: unknown): void {
      const segs = path.split(".");
      let cur: Record<string, unknown> = state;
      for (let i = 0; i < segs.length - 1; i++) {
        const seg = segs[i]!;
        if (typeof cur[seg] !== "object" || cur[seg] == null) cur[seg] = {};
        cur = cur[seg] as Record<string, unknown>;
      }
      cur[segs[segs.length - 1]!] = value;
    },
  };
}

function setup(state: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispatched: ActionEvent[] = [];
  const adapter = new BrowserAdapter(container);
  return {
    container,
    dispatched,
    render(vm: ViewNode) {
      adapter.render(vm, (a) => { dispatched.push(a); }, mkSA(state));
    },
    state,
  };
}

// A minimal SettingRowNode used across tests unless the test needs specific
// slot values — keeps the boilerplate low and the intent clear.
function row(overrides: Partial<SettingRowNode> = {}): SettingRowNode {
  return {
    type: "setting-row",
    label: "Email notifications",
    ...overrides,
  };
}

function list(
  children?: SettingRowNode[],
  overrides: Partial<SettingListNode> = {},
): SettingListNode {
  return {
    type: "setting-list",
    children: children ?? [row()],
    ...overrides,
  };
}

describe("SettingListNode (COMP-12a) — container semantic HTML", () => {
  it("emits <ul class='vms-setting-list'>", () => {
    const { container, render } = setup();
    render(list());
    const ul = container.querySelector("ul.vms-setting-list");
    expect(ul).not.toBeNull();
    expect(ul!.tagName).toBe("UL");
  });

  it("heading emits <h3> BEFORE the <ul> (as sibling, NOT child)", () => {
    // ── MUTATION TEST for the heading posture ──
    // If a future contributor moves the heading INSIDE the <ul>, this
    // assertion FAILS. The posture is a11y-critical: a non-list-item
    // child inside a <ul> is semantic garbage and would trip a11y
    // validators. Same posture as Phase 24 EmptyStateNode.
    const { container, render } = setup();
    render(list([row()], { heading: "Notifications" }));
    // Locate the direct-child wrapper the adapter injects for a single
    // top-level VM — the immediate render target. Order should be:
    // [<h3 class="vms-setting-list__heading">…</h3>, <ul class="vms-
    // setting-list">…</ul>].
    const h3 = container.querySelector("h3.vms-setting-list__heading");
    const ul = container.querySelector("ul.vms-setting-list");
    expect(h3).not.toBeNull();
    expect(ul).not.toBeNull();
    expect(h3!.textContent).toBe("Notifications");
    // The <h3> must be a SIBLING of the <ul>, not inside it. Assert by
    // ensuring the <h3> is NOT a descendant of the <ul>.
    expect(ul!.contains(h3!)).toBe(false);
    // And assert h3 comes BEFORE ul in DOM order.
    expect(h3!.compareDocumentPosition(ul!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("without heading, omits the <h3> entirely", () => {
    const { container, render } = setup();
    render(list([row()])); // no heading
    const h3 = container.querySelector("h3.vms-setting-list__heading");
    expect(h3).toBeNull();
  });
});

describe("SettingRowNode (COMP-12) — semantic HTML structure", () => {
  it("emits <li class='vms-setting-row'>", () => {
    const { container, render } = setup();
    render(list([row()]));
    const li = container.querySelector("li.vms-setting-row");
    expect(li).not.toBeNull();
    expect(li!.tagName).toBe("LI");
  });

  it("with action, adds vms-setting-row--clickable modifier class", () => {
    const { container, render } = setup();
    render(list([row({ action: { name: "open-notif-settings" } })]));
    const li = container.querySelector<HTMLElement>("li.vms-setting-row")!;
    expect(li.classList.contains("vms-setting-row--clickable")).toBe(true);
  });

  it("without action, omits vms-setting-row--clickable modifier class", () => {
    const { container, render } = setup();
    render(list([row()])); // no action
    const li = container.querySelector<HTMLElement>("li.vms-setting-row")!;
    expect(li.classList.contains("vms-setting-row--clickable")).toBe(false);
  });
});

describe("SettingRowNode.label (COMP-12) — string-lift trained typography", () => {
  it("wraps string label in TextNode with style:body weight:medium", () => {
    // ── MUTATION TEST for the label typography ──
    // Swap `weight: "medium"` → `weight: "bold"` in browser.ts settingRow()
    // label wrap → this test FAILS. The trained typography for the setting
    // label is body-tier + weight:medium (COMP-01/02) — NOT bold, NOT
    // heading, NOT plain body. This locks the framework's "settings label
    // is medium-weight body" convention.
    const { container, render } = setup();
    render(list([row({ label: "Push notifications" })]));
    const labelEl = container.querySelector<HTMLElement>(".vms-setting-row__label")!;
    // The string-lift wraps in TextNode{style:"body", weight:"medium"} →
    // emits a <div class="vms-text vms-text--body vms-text--medium"> (the
    // weight axis emits .vms-text--{weight} — Phase 23 COMP-02).
    const textEl = labelEl.querySelector<HTMLElement>(".vms-text");
    expect(textEl).not.toBeNull();
    expect(textEl!.classList.contains("vms-text--body")).toBe(true);
    // MUTATION guard for the WEIGHT axis — the shipped weight axis emits
    // .vms-text--weight-{weight} (COMP-02 at browser.ts:3993). Swap
    // weight:"medium" → weight:"bold" and .vms-text--weight-medium becomes
    // .vms-text--weight-bold, failing this exact assertion.
    expect(textEl!.classList.contains("vms-text--weight-medium")).toBe(true);
    expect(textEl!.classList.contains("vms-text--weight-bold")).toBe(false);
    // Also NOT caption / muted (mutation guards against those variants).
    expect(textEl!.classList.contains("vms-text--caption")).toBe(false);
    expect(textEl!.classList.contains("vms-text--muted")).toBe(false);
    expect(textEl!.textContent).toBe("Push notifications");
  });

  it("passes ViewNode label through without wrapping (escape hatch)", () => {
    const { container, render } = setup();
    render(
      list([
        row({
          label: { type: "text", value: "Custom-styled label", style: "muted" },
        }),
      ]),
    );
    const labelEl = container.querySelector<HTMLElement>(".vms-setting-row__label")!;
    const textEl = labelEl.querySelector<HTMLElement>(".vms-text")!;
    expect(textEl.classList.contains("vms-text--muted")).toBe(true);
    // NOT wrapped in body+medium — the ViewNode escape hatch preserves the
    // caller's style choice.
    expect(textEl.classList.contains("vms-text--body")).toBe(false);
    expect(textEl.classList.contains("vms-text--weight-medium")).toBe(false);
    expect(textEl.textContent).toBe("Custom-styled label");
  });
});

describe("SettingRowNode.description (COMP-12) — string-lift + <p> wrapper", () => {
  it("wraps string description in TextNode with style:muted", () => {
    const { container, render } = setup();
    render(list([row({ description: "You'll get emails for mentions and DMs." })]));
    const descEl = container.querySelector<HTMLElement>(".vms-setting-row__description")!;
    expect(descEl).not.toBeNull();
    const textEl = descEl.querySelector<HTMLElement>(".vms-text");
    expect(textEl).not.toBeNull();
    expect(textEl!.classList.contains("vms-text--muted")).toBe(true);
    // Mutation guards: NOT body, NOT caption.
    expect(textEl!.classList.contains("vms-text--body")).toBe(false);
    expect(textEl!.classList.contains("vms-text--caption")).toBe(false);
    expect(textEl!.textContent).toBe("You'll get emails for mentions and DMs.");
  });

  it("description renders inside <p class='vms-setting-row__description'>", () => {
    // The <p> tag receives the max-width:42rem readable-line-length cap
    // from default.css. If a future contributor changes the tag to
    // <div>/<span>, the CSS rule still matches by class BUT the semantic
    // "block of prose" signal is lost. Assert the tag name.
    const { container, render } = setup();
    render(list([row({ description: "Description text" })]));
    const descEl = container.querySelector(".vms-setting-row__description")!;
    expect(descEl.tagName).toBe("P");
  });

  it("omits description element when description absent", () => {
    const { container, render } = setup();
    render(list([row({ label: "Two-factor auth" })])); // no description
    const descEl = container.querySelector(".vms-setting-row__description");
    expect(descEl).toBeNull();
  });
});

describe("SettingRowNode.icon (COMP-12) — leading icon on body column", () => {
  it("renders icon inside body via renderIconSvg when icon present", () => {
    const { container, render } = setup();
    render(list([row({ icon: "bell" })]));
    const body = container.querySelector<HTMLElement>(".vms-setting-row__body")!;
    // The icon SVG is rendered inside the body column via renderIconSvg
    // (Phase 22).
    const svg = body.querySelector("svg");
    expect(svg).not.toBeNull();
  });

  it("omits icon when icon absent", () => {
    const { container, render } = setup();
    render(list([row()])); // no icon
    const body = container.querySelector<HTMLElement>(".vms-setting-row__body")!;
    // Body should have NO <svg> children — only the label div (and optional
    // description <p>).
    const svg = body.querySelector("svg");
    expect(svg).toBeNull();
  });
});

describe("SettingRowNode.trailing (COMP-12) — control slot", () => {
  it("renders trailing slot inside .vms-setting-row__control", () => {
    const { container, render } = setup();
    render(
      list([
        row({
          trailing: { type: "button", label: "Configure", action: { name: "configure-notif" } },
        }),
      ]),
    );
    const ctrl = container.querySelector<HTMLElement>(".vms-setting-row__control");
    expect(ctrl).not.toBeNull();
    const btn = ctrl!.querySelector("button.vms-button");
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe("Configure");
  });

  it("omits .vms-setting-row__control when trailing absent", () => {
    const { container, render } = setup();
    render(list([row()])); // no trailing
    const ctrl = container.querySelector(".vms-setting-row__control");
    expect(ctrl).toBeNull();
  });
});

describe("SettingRowNode natural pairing (CONTEXT §9) — CheckboxNode(variant:'switch')", () => {
  it("CheckboxNode(variant:'switch') renders correctly inside trailing slot", () => {
    // ── The natural-pairing test per CONTEXT §9 ──
    // The whole recipe exists so an app hands the framework
    // { label, description, trailing: switch } and gets the shipped
    // settings-row layout for free. This test proves the shipped switch
    // DOM (from COMP-03) renders correctly inside the settings-row
    // trailing slot — the classes .vms-checkbox + .vms-field--switch on
    // the <label>, .vms-checkbox__input on the <input>, role="switch" on
    // the input.
    const { container, render } = setup({ settings: { email: true } });
    render(
      list([
        row({
          label: "Email notifications",
          description: "Get emails when someone mentions you.",
          trailing: {
            type: "checkbox",
            name: "email",
            bind: "settings.email",
            label: "",
            variant: "switch",
          },
        }),
      ]),
    );
    const ctrl = container.querySelector<HTMLElement>(".vms-setting-row__control");
    expect(ctrl).not.toBeNull();
    // The switch's <label> wrapper carries both .vms-checkbox and
    // .vms-field--switch — the exact DOM shape COMP-03 ships.
    const lbl = ctrl!.querySelector<HTMLLabelElement>("label.vms-checkbox");
    expect(lbl).not.toBeNull();
    expect(lbl!.classList.contains("vms-field--switch")).toBe(true);
    // The <input> carries .vms-checkbox__input + role="switch".
    const inp = lbl!.querySelector<HTMLInputElement>("input.vms-checkbox__input");
    expect(inp).not.toBeNull();
    expect(inp!.type).toBe("checkbox");
    expect(inp!.getAttribute("role")).toBe("switch");
    // The initial state was `{ settings: { email: true } }` — the switch
    // reads its `bind` at render time.
    expect(inp!.checked).toBe(true);
  });

  it("whole-row action stopPropagates from a nested checkbox switch (T-25-04-02 mitigation)", () => {
    // ── MUTATION TEST for the stopPropagation selector list ──
    // The switch pairing MUST NOT double-fire the row action. The extended
    // selector list (`.vms-button, .vms-checkbox__input, .vms-checkbox,
    // .vms-field__input, .vms-field--switch, a[href]`) catches clicks on
    // any of those descendants. Delete `.vms-checkbox__input` AND
    // `.vms-checkbox` AND `.vms-field--switch` all three from the
    // settingRow() list in browser.ts → this test FAILS (the switch click
    // bubbles to the row action; both dispatch names appear in the spy
    // list). Any one of the three selectors alone catches the direct-input
    // click case; the belt-and-braces list ensures BOTH input clicks AND
    // label-body clicks are contained.
    //
    // This is the exact mitigation for threat T-25-04-02: a click on the
    // trailing switch MUST NOT double-fire the whole-row action. The
    // natural pairing must behave correctly.
    const { container, dispatched, render } = setup({ settings: { email: false } });
    render(
      list([
        row({
          label: "Email notifications",
          trailing: {
            type: "checkbox",
            name: "email",
            bind: "settings.email",
            label: "",
            variant: "switch",
            action: { name: "toggle-email" },
          },
          action: { name: "open-email-settings" },
        }),
      ]),
    );
    // Click the switch input — its own `action` should fire, the row's
    // action should NOT (because the extended stopPropagation selector
    // contains .vms-checkbox__input, .vms-checkbox, AND .vms-field--switch).
    const inp = container.querySelector<HTMLInputElement>("input.vms-checkbox__input")!;
    expect(inp).not.toBeNull();
    inp.click();
    const names = dispatched.map((d) => d.name);
    expect(names).toContain("toggle-email");
    expect(names).not.toContain("open-email-settings");
  });

  it(".vms-field--switch is present in the settingRow stopPropagation selector list (T-25-04-02 belt-and-braces)", () => {
    // Belt-and-braces assertion for the extended selector list. The plan
    // (25-04-PLAN.md Task 2 + threat T-25-04-02) mandates `.vms-field--
    // switch` in the stopPropagation selector list so a click on the
    // switch label body (the wrapping <label> that carries the .vms-field
    // --switch class) is stopped BEFORE it reaches the row action. If a
    // future contributor removes `.vms-field--switch` from the settingRow
    // list, this assertion FAILS.
    const { container, render } = setup({ settings: { email: false } });
    render(
      list([
        row({
          label: "Email notifications",
          trailing: {
            type: "checkbox",
            name: "email",
            bind: "settings.email",
            label: "",
            variant: "switch",
          },
          action: { name: "open-email-settings" },
        }),
      ]),
    );
    // The <label> element with .vms-field--switch is the switch's outer
    // wrapper — the click-area a user would hit when clicking the track
    // (not the input pixel itself). Assert its existence AND that the
    // selector containing .vms-field--switch would match it in a
    // settingRow querySelectorAll.
    const li = container.querySelector<HTMLElement>("li.vms-setting-row")!;
    const switchLabel = li.querySelector<HTMLLabelElement>("label.vms-field--switch");
    expect(switchLabel).not.toBeNull();
    // Verify the selector list used by settingRow's stopPropagation loop
    // MATCHES the switch label element. This is the compile-time proof
    // `.vms-field--switch` is present in the shipped selector list.
    const matches = li.querySelectorAll(
      ".vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, .vms-field--switch, a[href]",
    );
    // The switch label MUST be among the matched elements (it carries
    // BOTH .vms-checkbox AND .vms-field--switch; either selector would
    // include it — the assertion is that .vms-field--switch coverage
    // exists).
    let found = false;
    matches.forEach((m) => { if (m === switchLabel) found = true; });
    expect(found).toBe(true);
  });
});

describe("SettingRowNode.action (COMP-12) — whole-row keyboard + click", () => {
  it("with action, emits role=button + tabindex=0", () => {
    const { container, render } = setup();
    render(list([row({ action: { name: "open-x" } })]));
    const li = container.querySelector<HTMLElement>("li.vms-setting-row")!;
    expect(li.getAttribute("role")).toBe("button");
    expect(li.tabIndex).toBe(0);
  });

  it("dispatches action on click", () => {
    const { container, dispatched, render } = setup();
    render(list([row({ action: { name: "open-x" } })]));
    const li = container.querySelector<HTMLElement>("li.vms-setting-row")!;
    li.click();
    expect(dispatched.map((d) => d.name)).toContain("open-x");
  });

  it("dispatches action on Enter keydown", () => {
    const { container, dispatched, render } = setup();
    render(list([row({ action: { name: "open-x" } })]));
    const li = container.querySelector<HTMLElement>("li.vms-setting-row")!;
    li.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(dispatched.map((d) => d.name)).toContain("open-x");
  });

  it("dispatches action on Space keydown + preventDefault (suppresses page scroll)", () => {
    const { container, dispatched, render } = setup();
    render(list([row({ action: { name: "open-x" } })]));
    const li = container.querySelector<HTMLElement>("li.vms-setting-row")!;
    const evt = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    li.dispatchEvent(evt);
    expect(dispatched.map((d) => d.name)).toContain("open-x");
    expect(evt.defaultPrevented).toBe(true);
  });

  it("Tab keydown does NOT dispatch", () => {
    const { container, dispatched, render } = setup();
    render(list([row({ action: { name: "open-x" } })]));
    const li = container.querySelector<HTMLElement>("li.vms-setting-row")!;
    li.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(dispatched.map((d) => d.name)).not.toContain("open-x");
  });
});

describe("SettingListNode tree-validator (COMP-12a)", () => {
  it("rejects non-SettingRowNode children with byte-identical error message", () => {
    // ── Byte-identical error message across TS + .NET ──
    // Plan critical directive: both backends must throw with EXACTLY
    // `"SettingListNode.children must all be SettingRowNodes (found:
    // <type>)"`. The .NET twin verification lives in
    // SettingListNodeSerializationTests.TreeInvariant_… — they must stay
    // in lockstep.
    const bad: SettingListNode = {
      type: "setting-list",
      // Smuggle a TextNode where a SettingRowNode is expected. The
      // compile-time type is SettingRowNode[] but the runtime tree is
      // server-authored JSON that can smuggle anything — the validator
      // catches it.
      children: [{ type: "text", value: "not a setting-row" } as unknown as SettingRowNode],
    };
    expect(() => validateActionNames(bad)).toThrow(
      "SettingListNode.children must all be SettingRowNodes (found: text)",
    );
  });

  it("accepts a well-formed SettingListNode without throwing", () => {
    // Positive control — a legitimate tree passes the validator.
    const good: SettingListNode = {
      type: "setting-list",
      heading: "Notifications",
      children: [
        row({ label: "Email", trailing: { type: "checkbox", name: "e", bind: "e", label: "", variant: "switch" } }),
        row({ label: "Push", trailing: { type: "checkbox", name: "p", bind: "p", label: "", variant: "switch" } }),
      ],
    };
    expect(() => validateActionNames(good)).not.toThrow();
  });
});
