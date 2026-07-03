// 4.0.0 — file uploads route by the file input's declared `uploadOn`, not by
// button position.
//
// A file FieldNode declares `uploadOn: string[]` — the action name(s) whose
// dispatch carries its binary over the multipart wire. A file rides an action
// iff that action's name is in its uploadOn, regardless of WHERE the triggering
// button/submit/Enter lives (children, footer buttons[], or the submit slot).
// This replaces the old positional rule where only submit + buttons[] swept
// files and a byte-identical button in `children` silently carried none.
//
// Covered here:
//   1. a button in `children` carries the file when its action is in uploadOn
//      (the case the positional rule got wrong);
//   2. a dispatch whose action is NOT in uploadOn carries no file;
//   3. the submit path respects uploadOn (matching carries; non-matching doesn't);
//   4. a footer buttons[] trigger carries per uploadOn too;
//   5. a file listing multiple actions rides any of them;
//   6. a picked file with absent/empty uploadOn warns [vms:orphan-file] and
//      rides nothing.

import { describe, it, expect, vi, afterEach } from "vitest";
import type { StateAccess, ViewNode, ActionEvent } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

interface TestSetup {
  container: HTMLElement;
  state: Record<string, unknown>;
  dispatched: ActionEvent[];
  render: (vm: ViewNode) => void;
}

function setup(initial: Record<string, unknown> = {}): TestSetup {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const adapter = new BrowserAdapter(container);
  const state = initial as Record<string, unknown>;
  const sa: StateAccess = {
    read(path: string): unknown {
      if (path === "") return state;
      let cur: unknown = state;
      for (const seg of path.split(".")) {
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
  return { container, state, dispatched, render };
}

// jsdom ships no DataTransfer — define the FileList directly and fire change.
function attachFile(inp: HTMLInputElement, file: File): void {
  Object.defineProperty(inp, "files", {
    value: { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null) } as unknown as FileList,
    configurable: true,
  });
  inp.dispatchEvent(new Event("change"));
}

function clickButton(container: HTMLElement, label: string): void {
  const btn = Array.from(container.querySelectorAll("button")).find(
    b => b.textContent?.trim() === label,
  );
  if (!btn) throw new Error(`no button labelled "${label}"`);
  (btn as HTMLButtonElement).click();
}

afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("4.0.0 — file uploads route by uploadOn, not position", () => {
  it("(1) a button in children carries the file when its action is in uploadOn", () => {
    const { container, dispatched, render } = setup({});
    render({
      type: "form",
      submitAction: { name: "submit-form" },
      submitLabel: "Submit",
      children: [
        { type: "field", name: "doc", inputType: "file", uploadOn: ["save-doc"] },
        // A ButtonNode nested in children — the case the OLD positional rule dropped.
        { type: "button", label: "Save", action: { name: "save-doc" } },
      ],
    });
    const file = new File(["hi"], "hi.txt");
    attachFile(container.querySelector("input[type=file]") as HTMLInputElement, file);

    clickButton(container, "Save");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("save-doc");
    expect(dispatched[0]!.files!.doc).toBe(file);
  });

  it("(2) a dispatch whose action is NOT in uploadOn carries no file", () => {
    const { container, dispatched, render } = setup({});
    render({
      type: "form",
      children: [
        { type: "field", name: "doc", inputType: "file", uploadOn: ["save-doc"] },
        { type: "button", label: "Cancel", action: { name: "cancel" } },
      ],
    });
    attachFile(container.querySelector("input[type=file]") as HTMLInputElement, new File(["x"], "x.txt"));

    clickButton(container, "Cancel");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("cancel");
    expect(dispatched[0]!.files).toBeUndefined();
  });

  it("(3a) the submit path carries the file when uploadOn names the submit action", () => {
    const { container, dispatched, render } = setup({});
    render({
      type: "form",
      submitAction: { name: "upload" },
      submitLabel: "Upload",
      children: [{ type: "field", name: "doc", inputType: "file", uploadOn: ["upload"] }],
    });
    const file = new File(["x"], "x.txt");
    attachFile(container.querySelector("input[type=file]") as HTMLInputElement, file);

    (container.querySelector("button[type=submit]") as HTMLButtonElement).click();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("upload");
    expect(dispatched[0]!.files!.doc).toBe(file);
  });

  it("(3b) the submit path carries NO file when uploadOn does not name the submit action", () => {
    const { container, dispatched, render } = setup({});
    render({
      type: "form",
      submitAction: { name: "upload" },
      submitLabel: "Upload",
      children: [{ type: "field", name: "doc", inputType: "file", uploadOn: ["some-other-action"] }],
    });
    attachFile(container.querySelector("input[type=file]") as HTMLInputElement, new File(["x"], "x.txt"));

    (container.querySelector("button[type=submit]") as HTMLButtonElement).click();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.files).toBeUndefined();
  });

  it("(4) a footer buttons[] trigger carries per uploadOn too", () => {
    const { container, dispatched, render } = setup({});
    render({
      type: "form",
      buttons: [{ type: "button", label: "Send", action: { name: "send" } }],
      children: [{ type: "field", name: "doc", inputType: "file", uploadOn: ["send"] }],
    });
    const file = new File(["x"], "x.txt");
    attachFile(container.querySelector("input[type=file]") as HTMLInputElement, file);

    clickButton(container, "Send");
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("send");
    expect(dispatched[0]!.files!.doc).toBe(file);
  });

  it("(5) a file listing multiple actions rides any of them", () => {
    const { container, dispatched, render } = setup({});
    render({
      type: "form",
      children: [
        { type: "field", name: "doc", inputType: "file", uploadOn: ["draft", "publish"] },
        { type: "button", label: "Publish", action: { name: "publish" } },
      ],
    });
    const file = new File(["x"], "x.txt");
    attachFile(container.querySelector("input[type=file]") as HTMLInputElement, file);

    clickButton(container, "Publish");
    expect(dispatched[0]!.name).toBe("publish");
    expect(dispatched[0]!.files!.doc).toBe(file);
  });

  it("(6) a picked file with no uploadOn warns [vms:orphan-file] and rides nothing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, dispatched, render } = setup({});
    render({
      type: "form",
      submitAction: { name: "upload" },
      submitLabel: "Upload",
      children: [{ type: "field", name: "doc", inputType: "file" }], // no uploadOn
    });
    attachFile(container.querySelector("input[type=file]") as HTMLInputElement, new File(["x"], "x.txt"));

    const orphan = warn.mock.calls.filter(c => String(c[0]).includes("[vms:orphan-file]"));
    expect(orphan).toHaveLength(1);
    expect(String(orphan[0]![0])).toContain("file field 'doc'");

    (container.querySelector("button[type=submit]") as HTMLButtonElement).click();
    expect(dispatched[0]!.files).toBeUndefined();
  });
});
