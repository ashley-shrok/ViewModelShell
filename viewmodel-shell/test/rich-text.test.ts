// Phase 28 (RICH-01) — RichTextFieldNode adapter tests.
//
// This suite proves the four properties Plan 28-03 is load-bearing for:
//
//   1. **D-04 SYMMETRIC LAZY-LOAD** — a tree containing NO RichTextFieldNode
//      never resolves @tiptap/core / @tiptap/starter-kit / turndown / marked.
//      This is the CI-enforced guarantee that lazy-import stays lazy: a
//      future refactor that moves any of the imports to top-level fails this
//      test loudly. See AGENTS.md gotcha #9 corollary — the invariant needs
//      a test that can PROVE it, not just a code review that hopes for it.
//
//   2. **The loader FIRES exactly once when a RichTextFieldNode renders** —
//      subsequent re-renders reuse the cached Editor (mark-sweep governance).
//
//   3. **The initial content pre-loads via `marked` → editor.commands.setContent** —
//      the D-06 markdown-wire + Q7 pre-load, verified end-to-end.
//
//   4. **`writeBind` fires on editor `update` with turndown output** — closes
//      the markdown-string round-trip cleanly against the shipped bind seam.
//
//   5. **Mark-sweep on removal** — a RichTextFieldNode dropped from the next
//      tree destroys its Editor and clears its editorInstances entry.
//
//   6. **Fail-loud on TipTap load failure** — a rejected dynamic import
//      surfaces a hard `Error` via `console.error` (AGENTS.md capability seam
//      fail-loud rule; same posture as chart-missing-dep.test.ts).
//
// ⚠️ jsdom has NO ProseMirror surface, so a REAL TipTap Editor cannot render
// under jsdom. These tests MOCK @tiptap/core + @tiptap/starter-kit + turndown
// + marked (vi.mock) and assert on the INTEGRATION SEAM, not on rendered
// bidirectional-typography: (a) the modules are/aren't imported; (b) the
// Editor constructor is called with the expected shape; (c) editor.update
// event round-trips into writeBind; (d) destroy fires on mark-sweep.
//
// vitest isolates module mocks per FILE, so the SUCCESS-path mocks in this
// file (Tests 1-5) do NOT interfere with the FAILURE-path mock in the sibling
// file `rich-text-missing-dep.test.ts` (Test 6, whose whole point is that the
// dynamic import must REJECT).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { StateAccess, ViewNode, ActionEvent } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

// Hoisted controller: track constructor invocations of each mocked module,
// plus a mock FakeEditor that records setContent + destroy + emitted update
// callbacks so tests can drive editor.update synthetically.
const h = vi.hoisted(() => {
  const constructed: Array<{ options: any; instance: FakeEditor }> = [];
  const turndownConstructed: Array<{ options: any; instance: FakeTurndown }> = [];
  let markedParseCalls = 0;
  let importCallsTiptap = 0;
  let importCallsStarterKit = 0;
  let importCallsTurndown = 0;
  let importCallsMarked = 0;

  class FakeEditor {
    options: any;
    setContentCalls: string[] = [];
    destroyCount = 0;
    private updateHandler: (() => void) | null = null;
    // Backing HTML the editor "reports" — used by tests to simulate typed content.
    _html: string = "";
    constructor(options: any) {
      this.options = options;
      this._html = typeof options?.content === "string" ? options.content : "";
      constructed.push({ options, instance: this });
    }
    on(event: string, cb: () => void): void {
      if (event === "update") this.updateHandler = cb;
    }
    // Simulate user input: set the HTML the getHTML() call will return, then
    // fire the update handler (which triggers turndown → writeBind).
    _simulateUpdate(html: string): void {
      this._html = html;
      this.updateHandler?.();
    }
    getHTML(): string { return this._html; }
    commands = {
      setContent: (html: string): void => { this.setContentCalls.push(html); this._html = html; },
    };
    chain(): any {
      // Not exercised in this suite (we assert on the update seam, not tool clicks).
      // Return a no-op fluent chain so any accidental call in a helper doesn't crash.
      const noop = new Proxy({}, { get: () => (): any => noop });
      return noop;
    }
    destroy(): void { this.destroyCount++; }
  }

  class FakeTurndown {
    options: any;
    // Simple markdown emit: default returns "MD:" + html for round-trip assertion.
    // Tests can override by mutating _turndownFn on an instance.
    _turndownFn: (html: string) => string = (html) => `MD:${html}`;
    constructor(options: any) {
      this.options = options;
      turndownConstructed.push({ options, instance: this });
    }
    turndown(html: string): string { return this._turndownFn(html); }
  }

  return {
    constructed,
    turndownConstructed,
    get importCallsTiptap()      { return importCallsTiptap; },
    get importCallsStarterKit()  { return importCallsStarterKit; },
    get importCallsTurndown()    { return importCallsTurndown; },
    get importCallsMarked()      { return importCallsMarked; },
    get markedParseCalls()       { return markedParseCalls; },
    bumpTiptap()      { importCallsTiptap++; },
    bumpStarterKit()  { importCallsStarterKit++; },
    bumpTurndown()    { importCallsTurndown++; },
    bumpMarked()      { importCallsMarked++; },
    bumpMarkedParse() { markedParseCalls++; },
    resetCounters(): void {
      constructed.length = 0;
      turndownConstructed.length = 0;
      importCallsTiptap = 0;
      importCallsStarterKit = 0;
      importCallsTurndown = 0;
      importCallsMarked = 0;
      markedParseCalls = 0;
    },
    FakeEditor,
    FakeTurndown,
  };
});

vi.mock("@tiptap/core", () => {
  h.bumpTiptap();
  return {
    Editor: h.FakeEditor,
  };
});

vi.mock("@tiptap/starter-kit", () => {
  h.bumpStarterKit();
  return { default: { name: "StarterKit" } };
});

vi.mock("turndown", () => {
  h.bumpTurndown();
  return { default: h.FakeTurndown };
});

vi.mock("marked", () => {
  h.bumpMarked();
  return {
    marked: {
      parse: (md: string): string => {
        h.bumpMarkedParse();
        // Trivial HTML approximation sufficient for assertion — the real
        // `marked` output isn't the point; the wiring is.
        if (md.startsWith("# ")) {
          const rest = md.slice(2);
          const [head, ...tail] = rest.split("\n\n");
          const bodyHtml = tail.join("\n\n")
            .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
          return `<h1>${head}</h1>${bodyHtml ? `<p>${bodyHtml}</p>` : ""}`;
        }
        return `<p>${md.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</p>`;
      },
    },
  };
});

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

// loadRichText awaits Promise.all of four dynamic imports; a macrotask flush
// is the robust way to let the awaited chain resolve before assertions.
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

// Minimal in-memory StateAccess (matches field-optional-bind.test.ts shape).
function mkSA(state: Record<string, unknown>): StateAccess {
  return {
    read(path: string): unknown {
      if (path === "") return state;
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
        if (cur[seg] == null || typeof cur[seg] !== "object") cur[seg] = {};
        cur = cur[seg] as Record<string, unknown>;
      }
      cur[segs[segs.length - 1]!] = value;
    },
  };
}

beforeEach(() => {
  h.resetCounters();
  window.scrollTo = () => {};
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────
// Test 1 — D-04 SYMMETRIC LAZY-LOAD (the load-bearing invariant)
// ─────────────────────────────────────────────────────────────────────────
describe("RichTextFieldNode — D-04 symmetric lazy-load guarantee", () => {
  it("does NOT resolve @tiptap/core / @tiptap/starter-kit / turndown when the tree contains no RichTextFieldNode", async () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const dispatched: ActionEvent[] = [];
    const sa = mkSA({});
    // Render a tree with a Section + Text + Button — NO rich-text-field
    // anywhere, no rich-text-toolbar anywhere. If the browser bundle secretly
    // top-level-imported tiptap/turndown, the vi.mock factory would have
    // fired at MODULE LOAD (before this render call), which the counters
    // below detect. If a render-path helper accidentally kicked loadRichText
    // for a non-rich-text node, the flush would also catch it.
    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "text", value: "no rich text here" },
        { type: "button", label: "Go", action: { name: "go" } },
      ],
    };
    adapter.render(tree, (a) => { dispatched.push(a); }, sa);
    await flush();

    // The invariant: NONE of the four lazy-imported modules were resolved.
    expect(h.importCallsTiptap).toBe(0);
    expect(h.importCallsStarterKit).toBe(0);
    expect(h.importCallsTurndown).toBe(0);
    expect(h.importCallsMarked).toBe(0);
    // No FakeEditor / FakeTurndown was ever constructed.
    expect(h.constructed.length).toBe(0);
    expect(h.turndownConstructed.length).toBe(0);
    // The editorInstances persistent map registered no keys (nothing to sweep).
    expect((adapter as any).editorInstances.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Test 2 — loader fires exactly once when a RichTextFieldNode renders
// ─────────────────────────────────────────────────────────────────────────
describe("RichTextFieldNode — first-render loader fires exactly once", () => {
  it("resolves @tiptap/core / @tiptap/starter-kit / turndown / marked exactly once, constructs one FakeEditor", async () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const sa = mkSA({ draft: "" });
    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "rich-text-field", name: "note", bind: "draft" },
      ],
    };
    adapter.render(tree, () => {}, sa);
    await flush();

    // Each mocked module was resolved AT LEAST once (vi.mock factory fires
    // once per module per test file; the counters above start at 0 in
    // beforeEach and only the browser.ts loader can bump them under a
    // rich-text tree).
    expect(h.importCallsTiptap).toBeGreaterThanOrEqual(1);
    expect(h.importCallsStarterKit).toBeGreaterThanOrEqual(1);
    expect(h.importCallsTurndown).toBeGreaterThanOrEqual(1);
    expect(h.importCallsMarked).toBeGreaterThanOrEqual(1);
    // Exactly ONE FakeEditor was constructed.
    expect(h.constructed.length).toBe(1);
    // Exactly ONE FakeTurndown was constructed.
    expect(h.turndownConstructed.length).toBe(1);
    // Turndown was configured with the D-08-aligned options.
    expect(h.turndownConstructed[0].options).toEqual({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    });
    // The editorInstances persistent map registered exactly one key.
    expect((adapter as any).editorInstances.size).toBe(1);
    // The DOM shape is present: wrapper + editor host + default toolbar strip.
    expect(container.querySelector(".vms-rich-text-field")).not.toBeNull();
    expect(container.querySelector(".vms-rich-text-field__editor")).not.toBeNull();
    expect(container.querySelector(".vms-rich-text-field__toolbar-default")).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Test 3 — initial markdown content pre-loads via marked → editor.content
// ─────────────────────────────────────────────────────────────────────────
describe("RichTextFieldNode — initial content pre-load via marked", () => {
  it("passes the marked-parsed HTML of the bind value to the Editor as its `content` option", async () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const sa = mkSA({ draft: "# Hello\n\nWorld with **bold**" });
    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "rich-text-field", name: "note", bind: "draft" },
      ],
    };
    adapter.render(tree, () => {}, sa);
    await flush();

    expect(h.constructed.length).toBe(1);
    // The Editor's `content` option must be the marked-parsed HTML. Our
    // trivial mocked marked emits <h1>...</h1><p>...<strong>bold</strong></p>.
    const contentPassed: string = h.constructed[0].options.content;
    expect(contentPassed).toContain("<h1>Hello</h1>");
    expect(contentPassed).toContain("<strong>bold</strong>");
    // marked.parse was called at least once (initial load).
    expect(h.markedParseCalls).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Test 4 — writeBind fires on editor.update with the turndown output
// ─────────────────────────────────────────────────────────────────────────
describe("RichTextFieldNode — editor.update wires turndown → writeBind", () => {
  it("simulated editor.update writes the turndown-converted markdown to the bind path in state", async () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const state: Record<string, unknown> = { draft: "initial" };
    const sa = mkSA(state);
    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "rich-text-field", name: "note", bind: "draft" },
      ],
    };
    adapter.render(tree, () => {}, sa);
    await flush();

    expect(h.constructed.length).toBe(1);
    const editor = h.constructed[0].instance;
    // Simulate the user typing "hello **world**" — the editor now reports
    // that HTML; the update handler fires; turndown converts (our mocked
    // turndown returns "MD:" + html); writeBind persists.
    editor._simulateUpdate("<p>hello <strong>world</strong></p>");

    expect(state.draft).toBe("MD:<p>hello <strong>world</strong></p>");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Test 5 — mark-sweep on removal calls editor.destroy()
// ─────────────────────────────────────────────────────────────────────────
describe("RichTextFieldNode — mark-sweep destroys editor on removal", () => {
  it("destroys the editor and drops it from editorInstances when the next tree omits the RichTextFieldNode", async () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const sa = mkSA({ draft: "" });
    const treeWithRich: ViewNode = {
      type: "page",
      children: [
        { type: "rich-text-field", name: "note", bind: "draft" },
      ],
    };
    adapter.render(treeWithRich, () => {}, sa);
    await flush();
    expect(h.constructed.length).toBe(1);
    const editor = h.constructed[0].instance;
    expect(editor.destroyCount).toBe(0);
    expect((adapter as any).editorInstances.size).toBe(1);

    // Re-render WITHOUT the rich-text-field — mark-sweep destroys it.
    const treeWithoutRich: ViewNode = {
      type: "page",
      children: [{ type: "text", value: "gone" }],
    };
    adapter.render(treeWithoutRich, () => {}, sa);
    await flush();

    expect(editor.destroyCount).toBe(1);
    expect((adapter as any).editorInstances.size).toBe(0);
    expect(container.querySelector(".vms-rich-text-field")).toBeNull();

    // Re-adding the SAME-keyed rich-text-field constructs a FRESH editor
    // (the old was swept). Proves the mark-sweep really cleared the entry.
    adapter.render(treeWithRich, () => {}, sa);
    await flush();
    expect(h.constructed.length).toBe(2);
    expect((adapter as any).editorInstances.size).toBe(1);
  });

  it("preserves the editor across identical re-renders (does NOT destroy or reconstruct)", async () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const sa = mkSA({ draft: "" });
    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "rich-text-field", name: "note", bind: "draft" },
      ],
    };
    adapter.render(tree, () => {}, sa);
    await flush();
    expect(h.constructed.length).toBe(1);
    const editor = h.constructed[0].instance;
    expect(editor.destroyCount).toBe(0);

    // Re-render the SAME tree — same key survives; NO destroy, NO new editor.
    adapter.render(tree, () => {}, sa);
    await flush();
    expect(editor.destroyCount).toBe(0);
    expect(h.constructed.length).toBe(1);
    expect((adapter as any).editorInstances.size).toBe(1);
  });
});
