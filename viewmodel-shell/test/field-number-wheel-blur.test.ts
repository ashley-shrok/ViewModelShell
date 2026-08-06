// 9.2.1 — Silent-data-corruption guard: on a focused `<input type="number">`,
// mouse wheel silently steps the value (Kara @ PBMInvoices, 2026-08-06,
// surfaced via Poppy). The BrowserAdapter attaches a `wheel` listener that
// calls `.blur()` on the input, so the browser's number-adjust default no
// longer applies (blur happens synchronously) while the wheel event still
// bubbles unimpeded and the page scrolls normally.
//
// jsdom cannot exercise the browser's actual number-adjust default (that's a
// real-browser behavior we don't emulate). What we CAN — and what we assert
// — is our own contract: dispatching a `wheel` on the focused input causes
// it to blur. That's the mechanism the fix relies on; mutation-proven by
// removing the two `.addEventListener("wheel", ...)` lines and watching all
// three tests fail.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function renderTree(vm: ViewNode): HTMLElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  new BrowserAdapter(container).render(vm, () => {});
  return container;
}

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("9.2.1 — wheel on a focused number input blurs (silent-value-change guard)", () => {
  it("FieldNode(inputType:'number'): dispatching wheel on the focused input blurs it", () => {
    const c = renderTree({
      type: "page",
      children: [{ type: "field", name: "charge", inputType: "number", bind: "charge" } as ViewNode],
    });
    const input = c.querySelector(".vms-field__input") as HTMLInputElement;
    expect(input.type).toBe("number");

    input.focus();
    expect(document.activeElement).toBe(input);

    input.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true }));
    expect(document.activeElement).not.toBe(input);
  });

  it("TableNode pagination-jump input: dispatching wheel on the focused input blurs it", () => {
    // 8 rows across 4 pages of 2 rows each — enough that the jump input renders.
    const rows = Array.from({ length: 8 }, (_, i) => ({
      id: String(i + 1),
      cells: { name: `Row ${i + 1}` },
    }));
    const c = renderTree({
      type: "page",
      children: [{
        type: "table",
        columns: [{ key: "name", label: "Name" }],
        rows,
        pagination: {
          page: 1,
          pageSize: 2,
          totalRows: 8,
          prevAction: { name: "prev" },
          nextAction: { name: "next" },
          jumpAction: { name: "jump" },
        },
      } as ViewNode],
    });
    const input = c.querySelector(".vms-table__pagination-jump-input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe("number");

    input.focus();
    expect(document.activeElement).toBe(input);

    input.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true }));
    expect(document.activeElement).not.toBe(input);
  });

  it("FieldNode(inputType:'text'): wheel does NOT blur — the guard is scoped to number inputs", () => {
    const c = renderTree({
      type: "page",
      children: [{ type: "field", name: "email", inputType: "text", bind: "email" } as ViewNode],
    });
    const input = c.querySelector(".vms-field__input") as HTMLInputElement;
    expect(input.type).toBe("text");

    input.focus();
    expect(document.activeElement).toBe(input);

    input.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(input);
  });
});
