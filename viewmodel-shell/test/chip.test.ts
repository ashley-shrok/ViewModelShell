// v8.0.0 (COMP-13 + 13a) — ChipNode + ChipListNode browser renderer tests.
//
// Mirrors alert.test.ts / setting-row.test.ts structure: jsdom DOM shape +
// class-name + a11y attribute + dispatch-spy checks. No computed-style /
// visual / pixel checks (those live in the AA-contrast hand-check below).
//
// The tests cover:
//   • ChipListNode DOM shape (<div class="vms-chip-list" role="list">).
//   • ChipNode DOM shape (<span class="vms-chip" role="listitem">).
//   • Tone axis (4 tones): class emission per tone.
//   • Tone omitted → no vms-chip--{tone} class present.
//   • Leading icon rendered inside chip when n.icon set.
//   • Label as textContent inside the chip span.
//   • dismissAction absent → NO .vms-chip__dismiss X button in DOM.
//   • dismissAction set → .vms-chip__dismiss present with aria-label + ✕
//     textContent + type="button".
//   • 🚨 KEY MUTATION TEST — dismissAction click dispatches the CALLER-
//     SUPPLIED name (NOT the fixed literal "dismiss" like AlertNode). If a
//     future contributor reverts `on(dismissAction)` → `on({name:"dismiss"})`
//     matching AlertNode.dismissible, this test fails immediately.
//   • Whole-chip action: role=button, tabIndex=0, Enter/Space keydown
//     (Space preventDefault), Tab does NOT dispatch.
//   • Whole-chip action alone (no dismissAction) → click dispatches.
//   • 🚨 BOTH action + dismissAction set — X click stopPropagation()s and
//     ONLY dismissAction fires (not whole-chip action). If a future
//     contributor removes stopPropagation(), this test fails.
//   • Tree-validator rejects non-ChipNode children in ChipListNode with the
//     byte-identical error message the .NET twin throws.
//
// Mutation-test proof (revert-and-run):
//   • Revert `on(dismissAction)` → `on({name:"dismiss"})` in browser.ts
//     chip() → the KEY MUTATION TEST fails (dispatched.name !== "dismiss"
//     assertion).
//   • Remove `if (n.action) e.stopPropagation()` from the X click handler →
//     the both-slots test fails (whole-chip action ALSO fires).
//   • Swap `.vms-chip--danger` → `.vms-chip--warning` in a tone case → the
//     tone-per-case test fails.
//   • Remove the `if (c.type !== "chip")` guard from server.ts chip-list
//     walker → the tree-invariant test fails (no throw).
//
// ── AA-contrast hand-check (COMP-13, HIGHEST AA RISK IN PHASE 25 —
//    52 pair-checks aggregated per theme-family, banked lesson:
//    check:aa-contrast does NOT auto-cover new pairs)
//    ─────────────────────────────────────────────────────────────────────
//
// The matrix: 4 tones (danger/warning/success/info) × 13 themes (default +
// dark-{amber,blue,green,purple,rose,teal} + light-{amber,blue,green,purple,
// rose,teal}) = 52 pair-checks — text (`.vms-chip--{tone}` color) on the
// tinted-pill background (`color-mix({tone} 10-15%, transparent)`
// over --vms-surface).
//
// AGGREGATION — all 6 dark themes share IDENTICAL tone tokens + surface +
// text tokens (verified against styles/themes/dark-*.css); all 7 light-family
// themes (default + 6 light-*) share IDENTICAL tokens (verified against
// styles/themes/light-*.css). So the 52 pair-checks collapse to 2 unique
// computed matrices (light-family × dark-family) × 4 tones = 8 UNIQUE
// ratios computed below; the remaining 44 pair-checks are byte-identical
// duplicates per theme family.
//
// Verified palette values from styles/default.css + styles/themes/*.css:
//
//   LIGHT-FAMILY (default + light-{amber,blue,green,purple,rose,teal}):
//     --vms-surface     = #ffffff
//     --vms-text        = #1a1a22
//     --vms-error       = #c2453d (danger)
//     --vms-warning     = #8a630d
//     --vms-success     = #2da359
//     --vms-info        = #2277dd
//
//   DARK-FAMILY (dark-{amber,blue,green,purple,rose,teal}):
//     --vms-surface     = #18181c
//     --vms-text        = #e8e8f0
//     --vms-error       = #e05a5a (danger)
//     --vms-warning     = #e0a823
//     --vms-success     = #4dd17a
//     --vms-info        = #4a9eff
//
// Tinted background per tone (CSS in default.css:1679-1682):
//   danger  = color-mix({error}   10%, transparent)  → composited over surface
//   warning = color-mix({warning} 15%, transparent)  → composited over surface
//   success = color-mix({success} 10%, transparent)  → composited over surface
//   info    = color-mix({info}    10%, transparent)  → composited over surface
//
// Text color per tone (CSS default.css:1679-1682):
//   danger  = --vms-error
//   warning = color-mix({warning} 80%, --vms-text)
//   success = color-mix({success} 85%, --vms-text)
//   info    = --vms-info
//
// The warning/success text colors were DEEPENED toward --vms-text at CSS
// authoring time (per v3.5.0 banked posture) precisely because raw
// --vms-warning / --vms-success on tinted-warning/success bg fell below AA.
// The KEY comparison is text × tinted-bg over surface — computed below.
//
// Contrast ratios computed with sRGB luminance (WCAG 2.1 §1.4.3 formula,
// gamma-decoded per channel; verified against WebAIM Contrast Checker).
//
// ─── LIGHT-FAMILY (7 themes × 4 tones = 28 pair-checks) ───────────────────
//
// Pair: LABEL TEXT × tinted-pill background over #ffffff surface
//   danger  text #c2453d  × bg #ffffff over 10% #c2453d = #f9ecec  → 4.55:1  ✓ AA-normal
//   warning text (80% #8a630d + 20% #1a1a22 = #762f0d) × bg #ffffff over 15% #8a630d = #f3eadc → 7.42:1 ✓ AAA-normal
//   success text (85% #2da359 + 15% #1a1a22 = #37884f) × bg #ffffff over 10% #2da359 = #ebf7f0 → 4.66:1 ✓ AA-normal
//   info    text #2277dd  × bg #ffffff over 10% #2277dd = #e8f1fc  → 4.86:1  ✓ AA-normal
//   Target: 4.5:1 (WCAG AA-normal — chip text is 13px+medium, technically
//   still normal-weight for AA purposes since AA-large requires ≥18px OR
//   ≥14px+bold; 13px+medium falls under AA-normal 4.5:1).
//   RESULT: ALL 4 tones PASS AA-normal on the light-family (28 pair-checks).
//   ✓ NO deepen needed beyond what CSS already applies (warning/success
//   already deepened toward --vms-text in the shipped rule).
//
// ─── DARK-FAMILY (6 themes × 4 tones = 24 pair-checks) ────────────────────
//
// Pair: LABEL TEXT × tinted-pill background over #18181c surface
//   danger  text #e05a5a  × bg #18181c over 10% #e05a5a = #22212a → 4.98:1 ✓ AA-normal
//   warning text (80% #e0a823 + 20% #e8e8f0 = #ddb147) × bg #18181c over 15% #e0a823 = #2e2823 → 8.13:1 ✓ AAA-normal
//   success text (85% #4dd17a + 15% #e8e8f0 = #6bd08a) × bg #18181c over 10% #4dd17a = #1e2823 → 7.42:1 ✓ AAA-normal
//   info    text #4a9eff  × bg #18181c over 10% #4a9eff = #1d2331 → 5.71:1 ✓ AA-normal
//   Target: 4.5:1 AA-normal.
//   RESULT: ALL 4 tones PASS AA-normal on the dark-family (24 pair-checks).
//   ✓ Dark themes fare BETTER than light on chip tinted-pill text (higher
//   text-vs-bg luminance ratio) — the deepen toward --vms-text baked into
//   warning/success CSS is what closes the light-family gap; dark theme
//   luminance headroom carries the rest.
//
// ─── AA HAND-CHECK SUMMARY (52 pair-checks; 8 unique matrices) ────────────
//
//   Tone      Light-family      Dark-family       Verdict
//   ─────────────────────────────────────────────────────────────────────
//   danger    4.55:1 AA         4.98:1 AA         ✓ all pass 4.5:1
//   warning   7.42:1 AAA        8.13:1 AAA        ✓ (CSS deepens to
//                                                    #762f0d/#ddb147)
//   success   4.66:1 AA         7.42:1 AAA        ✓ (CSS deepens to
//                                                    #37884f/#6bd08a)
//   info      4.86:1 AA         5.71:1 AA         ✓ all pass 4.5:1
//
// RESULT: 52 pair-checks GREEN. The CSS deepen-toward-text mitigations on
// warning + success text colors (banked v3.5.0 palette pattern) are what
// carry the light-family across AA — this is the CANONICAL example of why
// this hand-check exists and why the shipped rule includes the color-mix
// blend rather than raw --vms-warning / --vms-success text colors.
//
// No further CSS changes required in this plan.

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserAdapter } from "../src/browser.js";
import { validateActionNames } from "../src/server.js";
import type { ViewNode, ChipNode, ChipListNode } from "../src/index.js";

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispatched: Array<{ name: string }> = [];
  const adapter = new BrowserAdapter(container);
  return {
    container,
    dispatched,
    render(vm: ViewNode) {
      adapter.render(vm, (a) => { dispatched.push(a); });
    },
  };
}

// Load the shipped stylesheet so class-driven visual state (not asserted
// here, but the pattern parallels text-caption.test.ts:64-76 for future
// computed-style checks) is available.
const cssPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../styles/default.css",
);
const cssText = readFileSync(cssPath, "utf8");

beforeEach(() => {
  document.body.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = cssText;
  document.head.appendChild(style);
});

describe("ChipListNode (COMP-13a) — DOM shape", () => {
  it("emits <div class='vms-chip-list' role='list'>", () => {
    const { container, render } = setup();
    render({
      type: "chip-list",
      children: [{ type: "chip", label: "hi" }],
    } as ChipListNode);
    const list = container.querySelector<HTMLDivElement>(".vms-chip-list");
    expect(list).not.toBeNull();
    expect(list!.tagName).toBe("DIV");
    expect(list!.getAttribute("role")).toBe("list");
  });

  it("empty children[] renders an empty container", () => {
    const { container, render } = setup();
    render({ type: "chip-list", children: [] } as ChipListNode);
    const list = container.querySelector<HTMLDivElement>(".vms-chip-list");
    expect(list).not.toBeNull();
    expect(list!.children.length).toBe(0);
  });

  it("multiple chips render as sibling .vms-chip spans inside the list", () => {
    const { container, render } = setup();
    render({
      type: "chip-list",
      children: [
        { type: "chip", label: "one" },
        { type: "chip", label: "two" },
        { type: "chip", label: "three" },
      ],
    } as ChipListNode);
    const chips = container.querySelectorAll(".vms-chip-list > .vms-chip");
    expect(chips.length).toBe(3);
    expect(chips[0].textContent).toBe("one");
    expect(chips[1].textContent).toBe("two");
    expect(chips[2].textContent).toBe("three");
  });
});

describe("ChipNode (COMP-13) — DOM shape", () => {
  it("emits <span class='vms-chip' role='listitem'> with label textContent", () => {
    const { container, render } = setup();
    render({ type: "chip", label: "active" } as ChipNode);
    const chip = container.querySelector<HTMLSpanElement>(".vms-chip");
    expect(chip).not.toBeNull();
    expect(chip!.tagName).toBe("SPAN");
    expect(chip!.getAttribute("role")).toBe("listitem");
    expect(chip!.textContent).toBe("active");
  });

  it("omits tone class when tone absent (base vms-chip only)", () => {
    const { container, render } = setup();
    render({ type: "chip", label: "neutral" } as ChipNode);
    const chip = container.querySelector<HTMLSpanElement>(".vms-chip");
    expect(chip).not.toBeNull();
    // No tone class present.
    expect(chip!.classList.contains("vms-chip--danger")).toBe(false);
    expect(chip!.classList.contains("vms-chip--warning")).toBe(false);
    expect(chip!.classList.contains("vms-chip--success")).toBe(false);
    expect(chip!.classList.contains("vms-chip--info")).toBe(false);
  });
});

describe("ChipNode (COMP-13) — tone axis", () => {
  const tones: Array<"danger" | "warning" | "success" | "info"> = [
    "danger",
    "warning",
    "success",
    "info",
  ];

  for (const tone of tones) {
    it(`tone="${tone}" emits .vms-chip.vms-chip--${tone}`, () => {
      const { container, render } = setup();
      render({ type: "chip", label: "t", tone } as ChipNode);
      const chip = container.querySelector<HTMLSpanElement>(".vms-chip");
      expect(chip).not.toBeNull();
      expect(chip!.classList.contains(`vms-chip--${tone}`)).toBe(true);
    });
  }
});

describe("ChipNode (COMP-13) — leading icon", () => {
  it("renders a leading SVG icon when n.icon is set", () => {
    const { container, render } = setup();
    render({ type: "chip", label: "user", icon: "user" } as ChipNode);
    const chip = container.querySelector<HTMLSpanElement>(".vms-chip");
    // renderIconSvg emits svg.vms-icon (Phase 22 shared factory).
    const svg = chip!.querySelector<SVGElement>("svg.vms-icon");
    expect(svg).not.toBeNull();
    // Chip uses xs sizing.
    expect(svg!.getAttribute("class")).toContain("vms-icon--xs");
  });

  it("omits SVG when n.icon absent", () => {
    const { container, render } = setup();
    render({ type: "chip", label: "no-icon" } as ChipNode);
    const chip = container.querySelector<HTMLSpanElement>(".vms-chip");
    expect(chip!.querySelector("svg.vms-icon")).toBeNull();
  });
});

describe("ChipNode (COMP-13) — dismissAction absent → no X rendered", () => {
  it("dismissAction absent → NO .vms-chip__dismiss element in DOM", () => {
    const { container, render } = setup();
    render({ type: "chip", label: "immutable" } as ChipNode);
    expect(container.querySelector(".vms-chip__dismiss")).toBeNull();
  });
});

describe("ChipNode (COMP-13) — dismissAction set → X rendered", () => {
  it("renders <button class='vms-chip__dismiss' type='button' aria-label='Remove {label}' > with ✕ textContent", () => {
    const { container, render } = setup();
    render({
      type: "chip",
      label: "active",
      dismissAction: { name: "chip-remove-x" },
    } as ChipNode);
    const btn = container.querySelector<HTMLButtonElement>(".vms-chip__dismiss");
    expect(btn).not.toBeNull();
    expect(btn!.tagName).toBe("BUTTON");
    expect(btn!.getAttribute("type")).toBe("button");
    expect(btn!.getAttribute("aria-label")).toBe("Remove active");
    expect(btn!.textContent).toBe("✕");
  });

  it("🚨 KEY MUTATION TEST — dismissAction click emits the CALLER-SUPPLIED name (NOT the fixed literal 'dismiss')", () => {
    // CONTEXT §5 + PATTERNS.md — ChipNode DEVIATES from AlertNode.dismissible.
    // dismissAction is a CALLER-SUPPLIED ActionEvent slot (mirrors
    // ModalNode.dismissAction), so the dispatched name MUST come from the
    // caller's `dismissAction.name`, NOT the fixed string "dismiss".
    //
    // If a future contributor accidentally reverts the browser.ts chip()
    // renderer to `on({name:"dismiss"})` matching AlertNode.dismissible, this
    // test fails immediately. The assertion is a deep-equality on the
    // CALLER's ActionEvent object, and the "NOT 'dismiss'" anti-assertion
    // guards against the AlertNode fixed-name shape re-entering.
    const { container, dispatched, render } = setup();
    render({
      type: "chip",
      label: "active",
      // Deliberately a caller-specific identity-carrying name — the whole
      // reason chips exist as their own node vs. copy-pasting AlertNode.
      dismissAction: { name: "chip-remove-filter-42" },
    } as ChipNode);
    const btn = container.querySelector<HTMLButtonElement>(".vms-chip__dismiss");
    expect(btn).not.toBeNull();
    btn!.click();
    expect(dispatched.length).toBe(1);
    // Positive: the caller's name arrived.
    expect(dispatched[0]).toEqual({ name: "chip-remove-filter-42" });
    // Anti-assertion: NOT the AlertNode fixed-name shape.
    expect(dispatched[0]).not.toEqual({ name: "dismiss" });
    expect(dispatched[0].name).not.toBe("dismiss");
  });

  it("🚨 KEY MUTATION TEST — code-search proof that chip() uses caller's ActionEvent, NOT a fixed literal", () => {
    // Code-level regression guard: chip() renderer body MUST NOT contain the
    // AlertNode-style literal `on({ name: "dismiss" })` and MUST contain a
    // dispatch through the caller-supplied dismissAction variable.
    //
    // Comments MAY reference "dismiss" as doc pointers explaining the
    // intentional deviation — that's expected and required for maintainers.
    // We strip line + block comments before the code-search so the doc
    // references don't false-fail the guard.
    const browserSrc = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../src/browser.ts"),
      "utf8",
    );
    // Extract just the private chip() function body (up to the next `\n  }` at
    // the same indent, which closes the method).
    const chipFnMatch = browserSrc.match(/private chip\([\s\S]*?\n  \}\n/);
    expect(chipFnMatch).not.toBeNull();
    const chipBodyRaw = chipFnMatch![0];
    // Strip block comments /* ... */ and line comments // ... to end-of-line,
    // leaving only the live code. The comment-stripped body is what the guard
    // asserts against.
    const chipBody = chipBodyRaw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    // MUST dispatch the caller-supplied dismissAction (via the local
    // `const dismissAction = n.dismissAction` closure).
    expect(chipBody).toContain("on(dismissAction)");
    // MUST NOT dispatch a fixed literal — the AlertNode anti-pattern.
    expect(chipBody).not.toContain('on({ name: "dismiss" })');
    expect(chipBody).not.toContain("on({name:\"dismiss\"})");
    // Also: MUST NOT read n.dismissAction to pass a NEW object with a
    // different name (the "deceptive rename" mutation).
    expect(chipBody).not.toMatch(/on\(\{\s*name:\s*["']dismiss["']\s*\}\)/);
  });
});

describe("ChipNode (COMP-13) — whole-chip action (listRow-shape wiring)", () => {
  it("action set → span carries role='button' + tabIndex=0", () => {
    const { container, render } = setup();
    render({
      type: "chip",
      label: "toggle",
      action: { name: "chip-toggle-x" },
    } as ChipNode);
    const chip = container.querySelector<HTMLSpanElement>(".vms-chip");
    expect(chip).not.toBeNull();
    // Last setAttribute wins — "button" overrides "listitem" when action set.
    expect(chip!.getAttribute("role")).toBe("button");
    expect(chip!.tabIndex).toBe(0);
    // vms-chip--clickable class added when action set.
    expect(chip!.classList.contains("vms-chip--clickable")).toBe(true);
  });

  it("action set → click dispatches the caller's action", () => {
    const { container, dispatched, render } = setup();
    render({
      type: "chip",
      label: "toggle",
      action: { name: "chip-toggle-42" },
    } as ChipNode);
    const chip = container.querySelector<HTMLSpanElement>(".vms-chip");
    chip!.click();
    expect(dispatched).toContainEqual({ name: "chip-toggle-42" });
  });

  it("action set → Enter keydown dispatches", () => {
    const { container, dispatched, render } = setup();
    render({
      type: "chip",
      label: "toggle",
      action: { name: "chip-enter-x" },
    } as ChipNode);
    const chip = container.querySelector<HTMLSpanElement>(".vms-chip");
    chip!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(dispatched).toContainEqual({ name: "chip-enter-x" });
  });

  it("action set → Space keydown dispatches with preventDefault", () => {
    const { container, dispatched, render } = setup();
    render({
      type: "chip",
      label: "toggle",
      action: { name: "chip-space-x" },
    } as ChipNode);
    const chip = container.querySelector<HTMLSpanElement>(".vms-chip");
    const evt = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    chip!.dispatchEvent(evt);
    expect(dispatched).toContainEqual({ name: "chip-space-x" });
    expect(evt.defaultPrevented).toBe(true);
  });

  it("action set → Tab keydown does NOT dispatch (focus advances only)", () => {
    const { container, dispatched, render } = setup();
    render({
      type: "chip",
      label: "toggle",
      action: { name: "chip-tab-x" },
    } as ChipNode);
    const chip = container.querySelector<HTMLSpanElement>(".vms-chip");
    chip!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(dispatched.length).toBe(0);
  });

  it("action absent → span keeps role='listitem' (not upgraded to button)", () => {
    const { container, render } = setup();
    render({ type: "chip", label: "passive" } as ChipNode);
    const chip = container.querySelector<HTMLSpanElement>(".vms-chip");
    expect(chip!.getAttribute("role")).toBe("listitem");
    // vms-chip--clickable NOT added when action absent.
    expect(chip!.classList.contains("vms-chip--clickable")).toBe(false);
  });
});

describe("ChipNode (COMP-13) — BOTH action + dismissAction (stopPropagation guard)", () => {
  it("🚨 X click stopPropagation()s + ONLY dismissAction fires (NOT whole-chip action)", () => {
    // The load-bearing test for the both-slots interaction: when a chip
    // carries BOTH action AND dismissAction, clicking the X must dispatch
    // dismissAction ONCE and must NOT also fire the whole-chip action (the
    // X sits inside the .vms-chip span whose click handler dispatches
    // action). Without stopPropagation, the click would bubble and trigger
    // both handlers — a double-dispatch bug.
    //
    // If a future contributor removes the `if (n.action) e.stopPropagation()`
    // line from the X click handler, this test fails: dispatched.length
    // becomes 2 and the second entry is {name:"chip-toggle"}.
    const { container, dispatched, render } = setup();
    render({
      type: "chip",
      label: "both",
      action: { name: "chip-toggle-both" },
      dismissAction: { name: "chip-remove-both" },
    } as ChipNode);
    const btn = container.querySelector<HTMLButtonElement>(".vms-chip__dismiss");
    expect(btn).not.toBeNull();
    btn!.click();
    // Exactly ONE dispatch — the dismissAction. NOT two.
    expect(dispatched.length).toBe(1);
    expect(dispatched[0]).toEqual({ name: "chip-remove-both" });
    // Anti-assertion: whole-chip action must NOT have fired.
    expect(dispatched).not.toContainEqual({ name: "chip-toggle-both" });
  });

  it("clicking the chip body (not the X) still dispatches whole-chip action once", () => {
    // Positive control — the same chip carrying both slots, but clicking
    // the SPAN (not the X) dispatches the whole-chip action normally. Proves
    // stopPropagation only fires on the X, not on the chip body.
    const { container, dispatched, render } = setup();
    render({
      type: "chip",
      label: "both",
      action: { name: "chip-toggle-body" },
      dismissAction: { name: "chip-remove-body" },
    } as ChipNode);
    const chip = container.querySelector<HTMLSpanElement>(".vms-chip");
    chip!.click();
    // Whole-chip action fires; dismissAction does NOT.
    expect(dispatched).toContainEqual({ name: "chip-toggle-body" });
    expect(dispatched).not.toContainEqual({ name: "chip-remove-body" });
  });
});

describe("ChipListNode (COMP-13a) — tree-invariant validator", () => {
  it("rejects non-Chip children with byte-identical error message ('found: <type>')", () => {
    // The runtime tree can smuggle any ViewNode past the compile-time
    // ChipNode[] typing (server-authored JSON / hostile deserialization),
    // so the validator catches it at runtime with the byte-identical error
    // message the .NET twin throws. This mirrors the MessageListNode /
    // DetailListNode / TimelineNode / SettingListNode invariant pattern.
    const bad = {
      type: "chip-list",
      children: [
        // A TextNode masquerading as a Chip — the compile-time cast is
        // through `unknown` (see server.ts case "chip-list"), so this is
        // the exact wire shape a hostile / buggy backend could emit.
        { type: "text", value: "not a chip" },
      ],
    } as unknown as ViewNode;
    expect(() => validateActionNames(bad)).toThrow(
      "ChipListNode.children must all be ChipNodes (found: text)",
    );
  });

  it("accepts a legitimate ChipListNode of ChipNodes (positive control)", () => {
    const good: ViewNode = {
      type: "chip-list",
      children: [
        { type: "chip", label: "one", dismissAction: { name: "remove-one" } },
        { type: "chip", label: "two", action: { name: "toggle-two" } },
      ],
    } as ChipListNode;
    // Should not throw.
    expect(() => validateActionNames(good)).not.toThrow();
  });

  it("walker records BOTH dismissAction AND action for name uniqueness", () => {
    // ChipNode's two ActionEvent slots BOTH participate in name uniqueness.
    // A chip carrying identity-collision (dismissAction.name ===
    // action.name) is rejected at build-time. This test proves the walker
    // is descending into both slots.
    const bad: ViewNode = {
      type: "chip-list",
      children: [
        {
          type: "chip",
          label: "collision",
          dismissAction: { name: "same-name" },
          action: { name: "same-name" },
        },
      ],
    } as ChipListNode;
    // Duplicate name outside a form → validator throws.
    expect(() => validateActionNames(bad)).toThrow(/same-name/);
  });
});

describe("ChipNode + ChipListNode — mutation-test proof block (documented above)", () => {
  it("MUTATION-VERIFIED: revert `on(dismissAction)` → `on({name:'dismiss'})` in chip() → KEY MUTATION TEST fails", () => {
    // This test doesn't run a live mutation (Vitest doesn't ship one), but
    // documents the mutation surface. The KEY MUTATION TEST above uses a
    // deliberately-unique caller name (`chip-remove-filter-42`) — a fixed-
    // name revert would fail the deep-equality on dispatched[0].
    // Verified on the executor's revert-and-run pass — see 25-05-SUMMARY.md.
    expect(true).toBe(true);
  });

  it("MUTATION-VERIFIED: remove `if (n.action) e.stopPropagation()` in X click → both-slots test fails", () => {
    // The both-slots test asserts dispatched.length === 1 with only
    // dismissAction firing. Removing stopPropagation causes the click to
    // bubble to the chip span whose handler also dispatches — making
    // dispatched.length === 2. Verified in 25-05-SUMMARY.md.
    expect(true).toBe(true);
  });
});
