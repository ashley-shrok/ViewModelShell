// @vitest-environment node
//
// Phase 6 — cross-adapter conformance: the TuiAdapter half.
//
// Node env (Ink + ink-testing-library need Node stream semantics, not jsdom —
// same per-file docblock as test/tui.test.ts). The static `renderTree` path
// (no interaction, deterministic) is exactly what conformance needs. Same
// FIXTURES, same declared information as the BrowserAdapter half
// (conformance.browser.test.ts) — both must independently surface every token.
import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import { TuiAdapter } from "../src/tui.js";
import { FIXTURES } from "./conformance-fixtures.js";

// chalk is disabled under ink-testing-library (no TTY) so SGR is largely
// absent, but OSC 8 hyperlink wrappers are written verbatim by our `link`
// renderer (Phase-1 fact: Ink does not sanitize OSC; lastFrame() keeps the
// raw bytes). Strip both — the opener `ESC ] 8 ; ; <uri> BEL` and the empty
// closer `ESC ] 8 ; ; BEL` — so token presence/order is measured on the
// visible text only; the label/value text between them is kept verbatim.
// ESC () is optional (ink-testing-library may drop it; the `]8;;` /
// `[…m` bytes are what survive — Phase-1/3 notes). OSC 8 is bounded at
// BEL () so it can never swallow the frame.
const SGR = /?\[[0-9;]*m/g;
const OSC8 = /?\]8;;[^]*/g;

function tuiInfo(vm: (typeof FIXTURES)[number]["vm"]): string {
  const frame = String(render(new TuiAdapter().renderTree(vm)).lastFrame() ?? "");
  return frame.replace(SGR, "").replace(OSC8, "");
}

describe("Phase 6 — conformance: TuiAdapter surfaces every fixture token", () => {
  for (const fx of FIXTURES) {
    it(fx.name, () => {
      const info = tuiInfo(fx.vm);

      for (const tok of fx.expect) {
        expect(info, `token "${tok}" missing from TuiAdapter renderTree`).toContain(tok);
      }

      if (fx.ordered) {
        let cursor = -1;
        for (const tok of fx.expect) {
          const at = info.indexOf(tok, cursor + 1);
          expect(at, `token "${tok}" out of order in TuiAdapter renderTree`).toBeGreaterThan(
            cursor,
          );
          cursor = at;
        }
      }
    });
  }
});
