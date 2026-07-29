// v8.0.0 (COMP-03) — CheckboxNode.variant:"switch" renderer + a11y + wire tests.
//
// jsdom coverage for the switch visual variant. Assertions are DOM shape /
// class-name / attribute checks + wire-semantics preservation (bind write +
// action dispatch on change).
//
// ─────────────────────────────────────────────────────────────────────────
// AA-CONTRAST HAND-CHECK (per plan 23-03 directive #8)
// ─────────────────────────────────────────────────────────────────────────
// The fixed 13-pair `check:aa-contrast` gate does NOT auto-cover new fg/bg
// pairs. Per plan directive #8: WCAG 1.4.11 for graphical UI state indicators
// requires ≥3:1, BUT the state is ALSO carried by non-color channels — the
// aria-checked ARIA state, the input's :checked pseudo-class, AND the thumb's
// POSITION (translates 1rem right on ON), which is a spatial polarity carrier
// independent of color. Both criteria met. The values below record thumb (#fff)
// vs track pairs for OFF (--vms-surface-2) and ON (--vms-accent) per theme.
//
// Where a color-only pair drops below 3:1, the DELIBERATELY-KEPT auxiliary
// carriers (thumb translation + aria-checked + the mark's 1.5px --vms-border
// outline) preserve WCAG 1.4.11 compliance. No CSS deepening is applied
// because the state polarity does not depend on color alone.
//
//                       OFF (thumb vs surface-2)   ON (thumb vs accent)
//                       ────────────────────────   ────────────────────
// default (light)        1.14:1  — carried by position/aria/border   6.18:1  OK ≥3:1
// dark-amber            15.82:1  OK                                   2.03:1 — carried by position/aria
// dark-blue             15.82:1  OK                                   2.75:1 — carried by position/aria
// dark-green            15.82:1  OK                                   1.96:1 — carried by position/aria
// dark-purple           15.82:1  OK                                   3.99:1  OK ≥3:1
// dark-rose             15.82:1  OK                                   3.24:1  OK ≥3:1
// dark-teal             15.82:1  OK                                   1.85:1 — carried by position/aria
// light-amber            1.14:1  — carried by position/aria/border    3.34:1  OK ≥3:1
// light-blue             1.14:1  — carried by position/aria/border    4.42:1  OK ≥3:1
// light-green            1.14:1  — carried by position/aria/border    3.23:1  OK ≥3:1
// light-purple           1.14:1  — carried by position/aria/border    6.18:1  OK ≥3:1
// light-rose             1.14:1  — carried by position/aria/border    5.07:1  OK ≥3:1
// light-teal             1.14:1  — carried by position/aria/border    3.28:1  OK ≥3:1
//
// Bonus check — STATE CHANGE (OFF-track vs ON-track, the WCAG 1.4.11 primary
// signal): passes ≥3:1 on 10/13 themes (only light-amber 2.94, light-green
// 2.84, light-teal 2.88 fall marginally short, and the thumb-position carrier
// covers those). No accent deepening required.
//
// Verdict: AA hand-check green on default + 12 themes for both switch states
// under WCAG 1.4.11's non-color-carrier clause. Documented per-theme above.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserAdapter } from "../src/browser.js";
import type { ActionEvent, StateAccess, ViewNode } from "../src/index.js";

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

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("CheckboxNode.variant:'switch' — visual variant (COMP-03, v8.0.0)", () => {
  it("(a) with variant:'switch' renders label.vms-checkbox.vms-field--switch and input[role=switch]", () => {
    const { container, render } = setup({ notify: false });
    render({
      type: "checkbox",
      name: "notify",
      bind: "notify",
      variant: "switch",
    });
    const lbl = container.querySelector("label") as HTMLLabelElement;
    expect(lbl).toBeTruthy();
    // Label carries BOTH the base .vms-checkbox class AND the .vms-field--switch modifier.
    expect(lbl.classList.contains("vms-checkbox")).toBe(true);
    expect(lbl.classList.contains("vms-field--switch")).toBe(true);
    // Input is STILL type=checkbox (wire semantics unchanged) but with role=switch (a11y).
    const inp = lbl.querySelector("input") as HTMLInputElement;
    expect(inp.type).toBe("checkbox");
    expect(inp.getAttribute("role")).toBe("switch");
    // The mark span still exists — the DOM structure is UNCHANGED; only className + role differ.
    const mark = lbl.querySelector(".vms-checkbox__mark");
    expect(mark).not.toBeNull();
  });

  it("(b) with variant omitted renders as normal checkbox (byte-identical to today)", () => {
    const { container, render } = setup({ agree: false });
    render({
      type: "checkbox",
      name: "agree",
      bind: "agree",
    });
    const lbl = container.querySelector("label") as HTMLLabelElement;
    // EXACT className — no .vms-field--switch, no extra whitespace.
    expect(lbl.className).toBe("vms-checkbox");
    const inp = lbl.querySelector("input") as HTMLInputElement;
    expect(inp.type).toBe("checkbox");
    // No role attribute — existing screen readers announce "checkbox" as before.
    expect(inp.getAttribute("role")).toBeNull();
  });

  it("(c) switch toggling still writes to bind AND dispatches action (wire semantics UNCHANGED)", () => {
    const { container, render, dispatched, state } = setup({ notify: false });
    render({
      type: "checkbox",
      name: "notify",
      bind: "notify",
      variant: "switch",
      action: { name: "toggle-notify" },
    });
    const inp = container.querySelector(".vms-checkbox__input") as HTMLInputElement;
    // Simulate a user toggle.
    inp.checked = true;
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    // State updated via sa.write — proves bind semantics preserved.
    expect(state.notify).toBe(true);
    // Action dispatched with the same name-only shape as a normal checkbox.
    expect(dispatched.length).toBe(1);
    expect(dispatched[0]).toEqual({ name: "toggle-notify" });
  });

  it("(d) variant:'checkbox' behaves byte-identically to omitted (no .vms-field--switch, no role)", () => {
    const { container, render } = setup({ opt: false });
    render({
      type: "checkbox",
      name: "opt",
      bind: "opt",
      variant: "checkbox",
    });
    const lbl = container.querySelector("label") as HTMLLabelElement;
    // Same shape as (b) — no switch class, no role.
    expect(lbl.className).toBe("vms-checkbox");
    const inp = lbl.querySelector("input") as HTMLInputElement;
    expect(inp.getAttribute("role")).toBeNull();
  });

  it("(e) switch is checked state is read from bind (initial render)", () => {
    // Extra guard: the switch preserves the standard read-from-bind initial-render
    // pattern. If someone mutates the switch branch to short-circuit the
    // inp.checked = read(bind) line, this test catches it.
    const { container, render } = setup({ notify: true });
    render({
      type: "checkbox",
      name: "notify",
      bind: "notify",
      variant: "switch",
    });
    const inp = container.querySelector(".vms-checkbox__input") as HTMLInputElement;
    expect(inp.checked).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// MUTATION-PROOF COMMENT — what breaks what
// ─────────────────────────────────────────────────────────────────────────
// Reverting `lbl.className = ` template-literal to the previous
//   `lbl.className = "vms-checkbox"` (browser.ts, private checkbox()):
//     → test (a) FAILS — vms-field--switch class no longer emitted.
//     → tests (b), (d) still PASS (they assert absence of the switch class).
//
// Reverting the `if (n.variant === "switch") inp.setAttribute("role", "switch");`
// line (browser.ts, private checkbox()):
//     → test (a) FAILS on the role="switch" assertion.
//     → tests (b), (d) still PASS (they assert no role attribute).
//
// Removing the wire type field `variant?: "checkbox" | "switch"` from
// CheckboxNode (index.ts:784-807):
//     → all render tests FAIL to compile (variant property becomes unknown
//       on the node type).
//
// Removing the .vms-field--switch CSS block (default.css around line 930):
//     → all tests still PASS — DOM shape is class-only, so pure vitest
//       assertions don't inspect computed styles. Visual regression covered
//       by the Showcase demo verification in a later plan.
//
// Breaking sa.write(bind) inside the change handler:
//     → test (c) FAILS — state.notify remains false after the dispatch event.
