// Phase 6 — cross-adapter conformance: the BrowserAdapter half.
//
// Default (jsdom) vitest environment — BrowserAdapter needs the global
// `document`/`window` (it uses them ~62× and does NOT take an injected doc),
// so this MUST be a jsdom-env file, distinct from the node-env Ink half
// (conformance.tui.test.ts). Same FIXTURES, same declared information; both
// halves must independently surface every token ⇒ cross-adapter info parity.
//
// Pattern mirrors test/theme-modifiers.test.ts (freshContainer + direct
// BrowserAdapter render). Imports use local `../src/*.js` (NodeNext), like
// every other suite — NOT the published package.
import { describe, it, expect } from "vitest";
import { BrowserAdapter } from "../src/browser.js";
import { FIXTURES } from "./conformance-fixtures.js";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

// The browser's "information" = visible text PLUS the values it carries on
// form controls (a field value lives in `input.value`, NOT textContent) and
// link targets — i.e. everything a user can read off the rendered DOM. Joined
// with a sentinel that can never appear in a (short, alpha) fixture token.
const SEP = "  ";
function browserInfo(c: HTMLElement): string {
  const parts: string[] = [c.textContent ?? ""];
  c.querySelectorAll("input, textarea").forEach((el) => {
    const f = el as HTMLInputElement | HTMLTextAreaElement;
    if (f.value) parts.push(f.value);
    const ph = el.getAttribute("placeholder");
    if (ph) parts.push(ph);
  });
  c.querySelectorAll("select").forEach((s) => {
    for (const o of Array.from((s as HTMLSelectElement).selectedOptions)) {
      parts.push(o.textContent ?? "");
    }
  });
  c.querySelectorAll("a[href]").forEach((a) => parts.push(a.getAttribute("href") ?? ""));
  return parts.join(SEP);
}

describe("Phase 6 — conformance: BrowserAdapter surfaces every fixture token", () => {
  for (const fx of FIXTURES) {
    it(fx.name, () => {
      const c = freshContainer();
      new BrowserAdapter(c).render(fx.vm, () => {});
      const info = browserInfo(c);

      for (const tok of fx.expect) {
        expect(info, `token "${tok}" missing from BrowserAdapter render`).toContain(tok);
      }

      if (fx.ordered) {
        let cursor = -1;
        for (const tok of fx.expect) {
          const at = info.indexOf(tok, cursor + 1);
          expect(at, `token "${tok}" out of order in BrowserAdapter render`).toBeGreaterThan(
            cursor,
          );
          cursor = at;
        }
      }
    });
  }
});
