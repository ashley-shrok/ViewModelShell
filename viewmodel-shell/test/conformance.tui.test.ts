// @vitest-environment node
//
// Cross-adapter conformance: TuiAdapter half.
//
// The TuiAdapter is now backed by OpenTUI (formerly Ink). To extract text
// from the JSX tree without spinning up the full OpenTUI CliRenderer (which
// would need a TTY + the platform binary), this file walks the React tree
// returned by `renderTree` directly. The walker only needs to recognize
// `<text>` (string children become information tokens) and `<box>` (whose
// `title` / `bottomTitle` props also carry information). Everything else
// either contains children we recurse into or doesn't carry text.
//
// Same FIXTURES + same declared information as the BrowserAdapter half
// (conformance.browser.test.ts). Both must independently surface every
// token. Information parity, not byte parity.

import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { renderTree } from "../src/tui.js";
import { FIXTURES } from "./conformance-fixtures.js";

// Walk a React tree and collect user-visible text in document order. The
// tree is a mix of:
//   - intrinsic elements (`<box>`, `<text>` — string `type`) whose
//     children + title carry text;
//   - our function components (`PageView`, `SectionView`, …) which haven't
//     been expanded yet — React only expands these inside a reconciler.
//     For the static conformance path we manually invoke them: a function
//     component is just `(props) => ReactNode`, and our renderers are
//     pure of side effects, so calling them directly is safe.
function collectText(node: ReactNode, out: string[]): void {
  if (node == null || node === false || node === true) return;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) collectText(child, out);
    return;
  }
  if (typeof node === "object" && "type" in node && "props" in node) {
    const el = node as { type: unknown; props?: Record<string, unknown> };
    const props = el.props ?? {};
    if (typeof el.type === "function") {
      // Function component — invoke it with its props to get the JSX it
      // returns, then continue walking. Cast through unknown because
      // React's official types don't model function-component invocation
      // cleanly outside a reconciler.
      const result = (el.type as (p: Record<string, unknown>) => ReactNode)(props);
      collectText(result, out);
      return;
    }
    // Intrinsic element (string type): title appears before children in
    // the rendered surface; bottomTitle after.
    if (typeof props.title === "string" && props.title.length > 0) out.push(props.title);
    // B3 — input/textarea expose user-visible content through prop, not
    // children. <input value="…"> shows that string in the terminal; the
    // walker has to read it to maintain information parity with the
    // BrowserAdapter (which renders <input value="…"> as a DOM node whose
    // .textContent / .value carries the same string).
    if (el.type === "input" && typeof props.value === "string" && props.value.length > 0) {
      out.push(props.value);
    }
    if (
      el.type === "textarea" &&
      typeof props.initialValue === "string" &&
      props.initialValue.length > 0
    ) {
      out.push(props.initialValue);
    }
    collectText(props.children as ReactNode, out);
    if (typeof props.bottomTitle === "string" && props.bottomTitle.length > 0) {
      out.push(props.bottomTitle);
    }
    return;
  }
  // Anything we don't recognize is invisible — keeps the walker total.
}

function tuiInfo(vm: (typeof FIXTURES)[number]["vm"]): string {
  const tokens: string[] = [];
  collectText(renderTree(vm), tokens);
  // Join with spaces so substring matches don't accidentally bridge tokens.
  return tokens.join(" ");
}

describe("conformance: TuiAdapter surfaces every fixture token", () => {
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
