// 3.9.0 — FieldNode.bind is optional (file inputs).
//
// A file FieldNode's binary rides the multipart side channel (fileRegistry keyed
// on `name`), so it does not need a bind — omitting bind avoids writing a
// {filename,size} placeholder object into a string/string-map state slot (which
// breaks the _state round-trip). This suite covers:
//   1. a bind-less file field renders, registers the picked file (multipart side
//      channel), writes NOTHING to state, and does not crash;
//   2. a value-bearing (non-file) field with no bind emits [vms:no-bind] once and
//      does not persist;
//   3. a file field bound to a scalar-string slot emits [vms:type-mismatch] once;
//   4. a file field bound to a null/empty or object slot does NOT warn;
//   5. existing bound value inputs still read/write and emit NO warnings.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { StateAccess, ViewNode, ActionEvent } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

interface TestSetup {
  container: HTMLElement;
  adapter: BrowserAdapter;
  state: Record<string, unknown>;
  dispatched: ActionEvent[];
  render: (vm: ViewNode) => void;
}

// In-memory StateAccess backed by a mutable object (mirrors the real shell seam).
function setup(initial: Record<string, unknown> = {}): TestSetup {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const adapter = new BrowserAdapter(container);
  const state = initial as Record<string, unknown>;
  const sa: StateAccess = {
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
  const dispatched: ActionEvent[] = [];
  const render = (vm: ViewNode): void =>
    adapter.render(vm, (a) => { dispatched.push(a); }, sa);
  return { container, adapter, state, dispatched, render };
}

// jsdom ships no DataTransfer — define the FileList directly (same trick as
// adapter.test.ts).
function attachFile(inp: HTMLInputElement, file: File): void {
  Object.defineProperty(inp, "files", {
    value: { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null) } as unknown as FileList,
    configurable: true,
  });
  inp.dispatchEvent(new Event("change"));
}

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("3.9.0 — bind-less file FieldNode", () => {
  it("renders, registers the file on the multipart side channel, and writes NOTHING to state", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, state, dispatched, render } = setup({});
    render({
      type: "form",
      submitAction: { name: "upload" },
      submitLabel: "Upload",
      children: [
        // No `bind` — a file input needs none.
        { type: "field", name: "attachment", inputType: "file", label: "Attachment" },
      ],
    });
    const inp = container.querySelector("input[type=file]") as HTMLInputElement;
    expect(inp).not.toBeNull();

    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    attachFile(inp, file);

    // No placeholder object was written into state.
    expect(state).toEqual({});
    // But the file still travels: submit fires with it on the multipart channel.
    (container.querySelector("button[type=submit]") as HTMLButtonElement).click();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.files!.attachment).toBe(file);
    // A bind-less FILE field is legitimate — no [vms:no-bind], no [vms:type-mismatch].
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("3.9.0 — [vms:no-bind] diagnostic", () => {
  it("a value-bearing input with no bind warns exactly once and does not persist", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, state, render } = setup({});
    // Two renders to prove the dedup (warn fires once, not per render).
    const tree: ViewNode = { type: "field", name: "title", inputType: "text", label: "Title" };
    render(tree);
    render(tree);

    const inp = container.querySelector("input.vms-field__input") as HTMLInputElement;
    inp.value = "typed";
    inp.dispatchEvent(new Event("input"));

    expect(state).toEqual({}); // nowhere to write → nothing persisted, no crash
    const noBind = warn.mock.calls.filter(c => String(c[0]).includes("[vms:no-bind]"));
    expect(noBind).toHaveLength(1);
    expect(String(noBind[0]![0])).toContain("FieldNode 'title'");
    expect(String(noBind[0]![0])).toContain("inputType=text");
  });

  it("does NOT warn for a bind-less hidden field (server-authoritative)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { render } = setup({});
    render({ type: "field", name: "csrf", inputType: "hidden" });
    expect(warn.mock.calls.filter(c => String(c[0]).includes("[vms:no-bind]"))).toHaveLength(0);
  });
});

describe("3.9.0 — [vms:type-mismatch] diagnostic (observable subset)", () => {
  it("warns once when a file field writes over a scalar string slot", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, render } = setup({ files: "already-a-string" });
    render({ type: "field", name: "doc", inputType: "file", bind: "files" });
    const inp = container.querySelector("input[type=file]") as HTMLInputElement;
    attachFile(inp, new File(["x"], "x.pdf"));
    const mismatch = warn.mock.calls.filter(c => String(c[0]).includes("[vms:type-mismatch]"));
    expect(mismatch).toHaveLength(1);
    expect(String(mismatch[0]![0])).toContain("file FieldNode 'doc'");
    expect(String(mismatch[0]![0])).toContain("bind 'files'");
    expect(String(mismatch[0]![0])).toContain("is a string");
  });

  it("does NOT warn when the slot is null/empty", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, render } = setup({ files: null });
    render({ type: "field", name: "doc", inputType: "file", bind: "files" });
    attachFile(container.querySelector("input[type=file]") as HTMLInputElement, new File(["x"], "x.pdf"));
    expect(warn.mock.calls.filter(c => String(c[0]).includes("[vms:type-mismatch]"))).toHaveLength(0);
  });

  it("does NOT warn when the slot already holds an object", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, render } = setup({ files: { filename: "old.pdf", size: 3 } });
    render({ type: "field", name: "doc", inputType: "file", bind: "files" });
    attachFile(container.querySelector("input[type=file]") as HTMLInputElement, new File(["x"], "x.pdf"));
    expect(warn.mock.calls.filter(c => String(c[0]).includes("[vms:type-mismatch]"))).toHaveLength(0);
  });
});

describe("3.9.0 — bound value inputs still work, warn-free", () => {
  it("reads and writes a bound text field and emits NO diagnostics", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, state, render } = setup({ fields: { title: "hello" } });
    render({ type: "field", name: "title", inputType: "text", bind: "fields.title" });
    const inp = container.querySelector("input.vms-field__input") as HTMLInputElement;
    expect(inp.value).toBe("hello");
    inp.value = "world";
    inp.dispatchEvent(new Event("input"));
    expect(state).toEqual({ fields: { title: "world" } });
    expect(warn).not.toHaveBeenCalled();
  });
});
