// 0.7.1 (#7) — BrowserAdapter must preserve the window scroll position +
// the focus()-induced viewport scroll across an action-driven re-render.
//
// Pre-0.7.1 behavior:
//   - render() snapshots focus + element-level scroll + draft text, but NOT
//     window.scrollX/Y;
//   - el.focus() restores focus WITHOUT preventScroll, which scrolls the
//     focused element into view if it's outside the viewport.
// Together, the long-page experience reported in #7 was: scroll near the
// bottom, click any action → the re-render's focus restore yanks the page
// back to the focused element / the top.
//
// These tests stub window scrollX/Y at non-zero values, spy on
// window.scrollTo + HTMLElement.prototype.focus, drive a re-render via
// shell.push(), and assert the focus call used preventScroll and the
// scroll position was restored to the snapshot.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ViewModelShell,
  type ShellResponse,
  type ViewNode,
} from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

const endpoint = "/api/x";
const actionEndpoint = "/api/x/action";

// We don't care about the specific tree shape — the render path runs the
// same snapshot/restore regardless. Use a tree with one focusable field so
// focus() actually fires in the restore branch.
const vm: ViewNode = {
  type: "form",
  submitAction: { name: "save" },
  children: [
    {
      type: "field",
      name: "q",
      inputType: "text",
      label: "Search",
      bind: "q",
    },
  ],
};
const vm2: ViewNode = { ...vm }; // distinct identity for the re-render

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

let scrollToSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // jsdom doesn't simulate real scroll, so we stub the scroll positions
  // we want the adapter to see + spy on the scrollTo call we expect.
  Object.defineProperty(window, "scrollX", { configurable: true, value: 0, writable: true });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0, writable: true });
  scrollToSpy = vi.fn();
  // Override prototype-level scrollTo so the assertion is robust across the
  // (window: number, number) and (options: {top, left, behavior}) signatures.
  (window as unknown as { scrollTo: typeof window.scrollTo }).scrollTo =
    scrollToSpy as unknown as typeof window.scrollTo;
  // jsdom doesn't always ship CSS.escape; browser.ts uses it for focus-id
  // selector escaping. Polyfill with a passthrough — fine for the simple
  // ASCII ids the tests use.
  if (typeof (globalThis as { CSS?: { escape?: unknown } }).CSS === "undefined") {
    (globalThis as unknown as { CSS: { escape: (s: string) => string } }).CSS = {
      escape: (s: string) => s,
    };
  } else if (typeof (globalThis as { CSS: { escape?: unknown } }).CSS.escape !== "function") {
    (globalThis as unknown as { CSS: { escape: (s: string) => string } }).CSS.escape = (s) => s;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("0.7.1 (#7) — window scroll + focus restoration", () => {
  it("window scrollX/Y are restored verbatim via window.scrollTo after render()", () => {
    Object.defineProperty(window, "scrollX", { configurable: true, value: 42, writable: true });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 1337, writable: true });

    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const shell = new ViewModelShell({ adapter, endpoint, actionEndpoint });

    shell.push({ vm, state: {} } as ShellResponse);

    expect(scrollToSpy).toHaveBeenCalled();
    // Most recent call (the one after the restore branch) carries the snapshot.
    const lastCall = scrollToSpy.mock.calls[scrollToSpy.mock.calls.length - 1]!;
    expect(lastCall).toEqual([42, 1337]);
  });

  it("focus restoration calls el.focus with { preventScroll: true }", () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const shell = new ViewModelShell({ adapter, endpoint, actionEndpoint });

    // First render — wire the tree.
    shell.push({ vm, state: {} } as ShellResponse);

    // Locate the rendered input + simulate the user focusing it.
    const input = container.querySelector("input") as HTMLInputElement | null;
    expect(input, "rendered tree contains the field's input").not.toBeNull();
    // Give the input an id so the focus-snapshot branch fires on the next render.
    if (input && !input.id) input.id = "test-focus-target";

    // Force focus onto the element from the test environment.
    const focusSpy = vi.spyOn(HTMLInputElement.prototype, "focus");
    input!.focus();
    // The pre-render activeElement is the input — assert the test setup is
    // sound before driving the re-render that exercises the restore branch.
    expect(document.activeElement).toBe(input);

    // Trigger a re-render through the public push() entrypoint.
    shell.push({ vm: vm2, state: {} } as ShellResponse);

    // BrowserAdapter.render() must have called focus({ preventScroll: true })
    // when restoring focus to the input we set up above.
    const preventScrollCall = focusSpy.mock.calls.find(
      (args) => args[0] != null && (args[0] as { preventScroll?: boolean }).preventScroll === true,
    );
    expect(
      preventScrollCall,
      "el.focus was called with { preventScroll: true } during render restore",
    ).toBeDefined();
  });

  it("scroll preservation runs even when no element had focus pre-render", () => {
    // Regression guard: the window-scroll restore is unconditional — it
    // must NOT depend on the focus-restore branch firing.
    Object.defineProperty(window, "scrollY", { configurable: true, value: 500, writable: true });

    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const shell = new ViewModelShell({ adapter, endpoint, actionEndpoint });

    // Make sure nothing in jsdom is focused before push().
    if (document.activeElement && "blur" in document.activeElement) {
      (document.activeElement as HTMLElement).blur();
    }

    shell.push({ vm, state: {} } as ShellResponse);

    expect(scrollToSpy).toHaveBeenCalled();
    const lastCall = scrollToSpy.mock.calls[scrollToSpy.mock.calls.length - 1]!;
    expect(lastCall).toEqual([0, 500]);
  });
});
