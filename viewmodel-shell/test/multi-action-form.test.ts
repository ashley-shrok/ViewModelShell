// Phase 6 — multi-action forms (FormNode.buttons[]) under the new wire shape.
//
// The old form-harvest behavior is gone: each button now dispatches its
// declared action by name only. Field values live in state at each input's
// bind path; the server reads them from `state` on the multipart body.
//
// BrowserAdapter coverage retained:
//   - each buttons[] entry dispatches its own action name (the motivating
//     fetch-meta vs add-item case — payload is in state, not on the wire);
//   - a buttons[]-only form (no submitAction) renders no default submit;
//   - submitAction + buttons[] coexist (both render, both dispatch by name);
//   - buttons[] entries support variant + pendingLabel (ButtonNode reuse).

import { describe, it, expect, vi, afterEach } from "vitest";
import type { StateAccess, ViewNode, ActionEvent } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

// Minimal StateAccess over a single mutable object — mirrors the shell's
// stateRead/stateWrite seam.
function mkSA(state: Record<string, unknown>): StateAccess {
  return {
    read(path: string): unknown {
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
        if (typeof cur[seg] !== "object" || cur[seg] == null) cur[seg] = {};
        cur = cur[seg] as Record<string, unknown>;
      }
      cur[segs[segs.length - 1]!] = value;
    },
  };
}

const urlForm = (extra: Partial<Record<string, unknown>> = {}): ViewNode => ({
  type: "form",
  // no submitAction — buttons[]-only (the motivating modal shape)
  children: [
    { type: "field", name: "url", inputType: "text", label: "URL", bind: "url" },
  ],
  buttons: [
    { type: "button", label: "✨ Fetch & fill", action: { name: "fetch-meta" }, pendingLabel: "Fetching…" },
    { type: "button", label: "Save", action: { name: "add-item" }, variant: "primary" },
  ],
  ...extra,
}) as ViewNode;

describe("Phase 6 — FormNode.buttons[] dispatch (name-only; state holds values)", () => {
  it("each button dispatches its own action by name; the URL lives in state", () => {
    const dispatched: ActionEvent[] = [];
    const container = freshContainer();
    const state: Record<string, unknown> = {};
    new BrowserAdapter(container).render(urlForm(), (a) => dispatched.push(a), mkSA(state));

    // Type a URL into the shared field — writes to state at "url".
    const input = container.querySelector("input") as HTMLInputElement;
    input.value = "https://example.com/item/42";
    input.dispatchEvent(new Event("input"));
    expect(state).toEqual({ url: "https://example.com/item/42" });

    const btns = Array.from(container.querySelectorAll("button")) as HTMLButtonElement[];
    const fetchBtn = btns.find(b => b.textContent === "✨ Fetch & fill")!;
    const saveBtn = btns.find(b => b.textContent === "Save")!;

    fetchBtn.click();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("fetch-meta");
    expect(Object.keys(dispatched[0]!).filter(k => k !== "files")).toEqual(["name"]);

    saveBtn.click();
    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]!.name).toBe("add-item");
    expect(Object.keys(dispatched[1]!).filter(k => k !== "files")).toEqual(["name"]);
  });

  it("a buttons[]-only form (no submitAction) renders NO default submit button", () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(urlForm(), () => {}, mkSA({}));
    const labels = Array.from(container.querySelectorAll("button")).map(b => b.textContent);
    expect(labels).toEqual(["✨ Fetch & fill", "Save"]);
    expect(labels).not.toContain("Submit");
    expect(container.querySelector("button[type=submit]")).toBeNull();
  });

  it("submitAction + buttons[] coexist: both render and dispatch by name", () => {
    const dispatched: ActionEvent[] = [];
    const vm: ViewNode = {
      type: "form",
      submitAction: { name: "save-default" },
      submitLabel: "Save",
      children: [
        { type: "field", name: "title", inputType: "text", label: "Title", bind: "title" },
      ],
      buttons: [
        { type: "button", label: "Preview", action: { name: "preview" } },
      ],
    };
    const container = freshContainer();
    const state: Record<string, unknown> = {};
    new BrowserAdapter(container).render(vm, (a) => dispatched.push(a), mkSA(state));

    const input = container.querySelector("input") as HTMLInputElement;
    input.value = "Draft";
    input.dispatchEvent(new Event("input"));
    expect(state).toEqual({ title: "Draft" });

    const submit = container.querySelector("button[type=submit]") as HTMLButtonElement;
    expect(submit.textContent).toBe("Save");
    submit.click();
    expect(dispatched[0]!.name).toBe("save-default");
    expect(Object.keys(dispatched[0]!).filter(k => k !== "files")).toEqual(["name"]);

    const preview = Array.from(container.querySelectorAll("button"))
      .find(b => b.textContent === "Preview") as HTMLButtonElement;
    preview.click();
    expect(dispatched[1]!.name).toBe("preview");
    expect(Object.keys(dispatched[1]!).filter(k => k !== "files")).toEqual(["name"]);
  });

  it("buttons[] entries carry ButtonNode features: variant class + pendingLabel swap", () => {
    const container = freshContainer();
    new BrowserAdapter(container).render(urlForm(), () => {}, mkSA({}));
    const save = Array.from(container.querySelectorAll("button"))
      .find(b => b.textContent === "Save") as HTMLButtonElement;
    expect(save.classList.contains("vms-button--primary")).toBe(true);

    const fetchBtn = Array.from(container.querySelectorAll("button"))
      .find(b => b.textContent === "✨ Fetch & fill") as HTMLButtonElement;
    fetchBtn.click();
    expect(fetchBtn.textContent).toBe("Fetching…");
    expect(fetchBtn.classList.contains("vms-button--pending")).toBe(true);
  });
});
