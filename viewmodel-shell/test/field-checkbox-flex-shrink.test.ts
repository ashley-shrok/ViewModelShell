import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Regression guard (Angel via /ai Builder Skills card, 2026-07-26): the
// FieldNode(inputType:"checkbox") form-collected variant renders inside a
// flex-row .vms-field--checkbox container next to its label. Without an
// explicit flex-shrink:0 the 18×18 input is a flex item and, in a tight
// container with a longer label, the browser shrinks the checkbox itself
// rather than wrapping the label. The standalone .vms-checkbox already
// carried the guard (default.css standalone-checkbox rule) — the form-
// collected variant was the drift. This test asserts BOTH sides of the
// pair carry it, so a future edit can't silently re-open the gap.
const css = readFileSync(resolve(process.cwd(), "styles/default.css"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "");

function blockFor(selector: string): string {
  let from = 0;
  for (;;) {
    const idx = css.indexOf(selector, from);
    if (idx === -1) return "";
    if (idx === 0 || css[idx - 1] === "\n") {
      const open = css.indexOf("{", idx);
      const close = css.indexOf("}", open);
      return css.slice(open + 1, close);
    }
    from = idx + 1;
  }
}

describe("checkbox inputs resist flex-shrink in tight rows", () => {
  it(".vms-field--checkbox .vms-field__input declares flex-shrink: 0", () => {
    expect(blockFor(".vms-field--checkbox .vms-field__input")).toMatch(/flex-shrink:\s*0/);
  });
  it(".vms-checkbox (standalone) declares flex-shrink: 0", () => {
    expect(blockFor(".vms-checkbox")).toMatch(/flex-shrink:\s*0/);
  });
});
