import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Regression guard (review-surfaced, 2026-06-24): the base `.vms-page` /
// `.vms-section` are `flex-direction: column`. Every horizontal-flow layout
// preset MUST explicitly override `flex-direction: row`, or its children stack
// vertically forever — the `switcher` preset shipped without it and looked
// permanently stacked at every width (jsdom + parity can't catch a CSS layout
// bug; only a human resizing a real browser did). This asserts each flex-row
// preset declares the override, in BOTH its page and section forms.
// vitest runs from the package root (viewmodel-shell/), so resolve from cwd.
const css = readFileSync(resolve(process.cwd(), "styles/default.css"), "utf8");

/** Extract the declaration block immediately following a selector token. */
function blockFor(selector: string): string {
  const idx = css.indexOf(selector);
  if (idx === -1) return "";
  const open = css.indexOf("{", idx);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

describe("horizontal-flow layout presets declare flex-direction: row", () => {
  // Presets whose mechanism requires a HORIZONTAL main axis. (`stack`/`split`/
  // `cards` are intentionally NOT here — stack is the column default, split/
  // cards are grids, none rely on flex row direction.)
  for (const preset of ["row", "sidebar", "switcher"]) {
    it(`.vms-page--${preset} sets flex-direction: row`, () => {
      // page and section share one selector-list + block, so the page selector
      // block carries the override for both forms.
      expect(blockFor(`.vms-page--${preset}`)).toMatch(/flex-direction:\s*row/);
    });
  }
});
