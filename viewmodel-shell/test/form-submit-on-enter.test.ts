// FormNode.submitOnEnter — opt-in "Enter sends, Shift/Ctrl/Meta/Alt+Enter =
// newline" affordance for chat-style composers.
//
// A <textarea> otherwise eats Enter as a newline and never submits, so this is
// the only way to express Enter-to-send in VMS. Behavior under test:
//   - bare Enter in a descendant textarea dispatches submitAction (same path
//     as the submit button — name-only wire);
//   - any modifier (Shift/Ctrl/Meta/Alt) + Enter is left alone (newline);
//   - an IME-composition Enter (candidate confirmation) must NOT submit;
//   - no-op when submitAction is absent;
//   - default (field unset) leaves Enter inert (byte-identical baseline).

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

// A chat composer: textarea + submitAction + submitOnEnter. `extra` overrides
// any FormNode field (e.g. drop submitAction, or unset submitOnEnter).
const composer = (extra: Partial<Record<string, unknown>> = {}): ViewNode => ({
  type: "form",
  submitAction: { name: "send" },
  submitLabel: "Send",
  submitOnEnter: true,
  children: [
    { type: "field", name: "msg", inputType: "textarea", label: "Message", bind: "msg" },
  ],
  ...extra,
}) as ViewNode;

function render(tree: ViewNode, state: Record<string, unknown>): { container: HTMLElement; dispatched: ActionEvent[] } {
  const dispatched: ActionEvent[] = [];
  const container = freshContainer();
  new BrowserAdapter(container).render(tree, (a) => dispatched.push(a), mkSA(state));
  return { container, dispatched };
}

function typeInto(container: HTMLElement, text: string): HTMLTextAreaElement {
  const ta = container.querySelector("textarea") as HTMLTextAreaElement;
  ta.value = text;
  ta.dispatchEvent(new Event("input"));
  return ta;
}

function enter(ta: HTMLTextAreaElement, init: KeyboardEventInit = {}): void {
  ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...init }));
}

describe("FormNode.submitOnEnter", () => {
  it("bare Enter dispatches submitAction with the typed value in state", () => {
    const state: Record<string, unknown> = {};
    const { container, dispatched } = render(composer(), state);
    const ta = typeInto(container, "hello world");
    expect(state).toEqual({ msg: "hello world" });

    enter(ta);
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("send");
    // name-only wire — no harvested context
    expect(Object.keys(dispatched[0]!).filter(k => k !== "files")).toEqual(["name"]);
    expect(state).toEqual({ msg: "hello world" });
  });

  it("Shift+Enter does not dispatch (newline)", () => {
    const { container, dispatched } = render(composer(), {});
    const ta = typeInto(container, "line one");
    enter(ta, { shiftKey: true });
    expect(dispatched).toHaveLength(0);
  });

  it("Ctrl+Enter and Meta+Enter do not dispatch (shortcut/newline)", () => {
    const { container, dispatched } = render(composer(), {});
    const ta = typeInto(container, "x");
    enter(ta, { ctrlKey: true });
    enter(ta, { metaKey: true });
    enter(ta, { altKey: true });
    expect(dispatched).toHaveLength(0);
  });

  it("an IME-composition Enter does not dispatch (candidate confirmation)", () => {
    const { container, dispatched } = render(composer(), {});
    const ta = typeInto(container, "にほんご");
    // jsdom doesn't honor isComposing via the KeyboardEvent init dict, so set
    // it on the event instance — the handler reads e.isComposing.
    const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    Object.defineProperty(ev, "isComposing", { value: true });
    ta.dispatchEvent(ev);
    expect(dispatched).toHaveLength(0);

    // and the keyCode===229 fallback path (some IMEs report only this)
    const ev229 = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    Object.defineProperty(ev229, "keyCode", { value: 229 });
    ta.dispatchEvent(ev229);
    expect(dispatched).toHaveLength(0);
  });

  it("is a no-op when submitAction is absent", () => {
    const { container, dispatched } = render(composer({ submitAction: undefined, submitLabel: undefined }), {});
    const ta = typeInto(container, "no submit here");
    enter(ta);
    expect(dispatched).toHaveLength(0);
  });

  it("default (submitOnEnter unset) leaves Enter inert", () => {
    const { container, dispatched } = render(composer({ submitOnEnter: undefined }), {});
    const ta = typeInto(container, "should not send");
    enter(ta);
    expect(dispatched).toHaveLength(0);
  });
});
