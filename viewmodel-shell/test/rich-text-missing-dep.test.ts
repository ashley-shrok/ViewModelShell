// Phase 28 (RICH-01) — RichTextFieldNode FAIL-LOUD on a missing TipTap.
//
// The capability-seam rule (AGENTS.md): a capability with no safe default
// that is invoked without its means FAILS LOUD, never a silent no-op. For
// RichTextFieldNode that means: a rich-text-field rendered while
// @tiptap/core is absent must surface an Error through the sanctioned seam
// (the adapter holds no onError reference, so the AGENTS.md-sanctioned
// fallback is console.error), NOT a swallowed blank textarea and NOT a
// floating unhandled rejection.
//
// This lives in its own file because it needs `import("@tiptap/core")` to
// REJECT — simulated by a vi.mock factory that throws. vitest isolates
// module mocks per FILE, so mocking @tiptap/core as "missing" here cannot
// affect rich-text.test.ts (where the mock resolves to a working fake).
// Direct byte-analog of chart-missing-dep.test.ts.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { StateAccess, ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

// Simulate @tiptap/core NOT installed: the dynamic import rejects. The
// Promise.all inside loadRichText fails on the first rejection; the
// try/catch calls richTextFailLoud → console.error.
vi.mock("@tiptap/core", () => {
  throw new Error("Cannot find module '@tiptap/core'");
});

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function mkSA(state: Record<string, unknown>): StateAccess {
  return {
    read(path: string): unknown {
      if (path === "") return state;
      return (state as Record<string, unknown>)[path];
    },
    write(path: string, value: unknown): void {
      (state as Record<string, unknown>)[path] = value;
    },
  };
}

beforeEach(() => {
  window.scrollTo = () => {};
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RichTextFieldNode — fail-loud on missing @tiptap/core", () => {
  it("routes a loud Error through console.error (not a silent no-op)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);

    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "rich-text-field", name: "note", bind: "draft" },
      ],
    };
    new BrowserAdapter(container).render(tree, () => {}, mkSA({ draft: "" }));

    // The wrapper + editor host + default toolbar strip still render
    // synchronously — the FAILURE is the async lazy load, which must
    // surface loudly rather than leave a blank editor silently.
    expect(container.querySelector(".vms-rich-text-field")).not.toBeNull();
    expect(container.querySelector(".vms-rich-text-field__editor")).not.toBeNull();

    await flush();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [prefix, err] = errorSpy.mock.calls[0];
    expect(prefix).toBe("[ViewModelShell]");
    expect(err).toBeInstanceOf(Error);
    // The richTextFailLoud message names TipTap or turndown; the load
    // failure came from @tiptap/core rejecting.
    expect((err as Error).message).toMatch(/TipTap|turndown/);
  });
});
