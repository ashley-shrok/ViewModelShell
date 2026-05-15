// copy-button.test.ts — jsdom adapter tests for CopyButtonNode (3 cases).
// Follows the import/harness pattern from test/adapter-seam.test.ts:
//   - local source via .js specifiers (NodeNext convention)
//   - describe/it/expect/vi/beforeEach/afterEach from vitest
//   - BrowserAdapter from ../src/browser.js
//   - ViewModelShell from ../src/index.js
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ViewModelShell, type ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

const endpoint = "/api/x";
const actionEndpoint = "/api/x/action";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

function makeShell(container: HTMLElement) {
  return new ViewModelShell({
    endpoint,
    actionEndpoint,
    adapter: new BrowserAdapter(container),
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ─── Case A: clipboard.writeText fires with node.text; ephemeral label swap + revert ───

describe("CopyButtonNode — Case A: clipboard write fires with node.text", () => {
  it("calls writeText with node.text, swaps to copiedLabel, then reverts after 1500ms", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const container = freshContainer();
    const shell = makeShell(container);

    const vm: ViewNode = {
      type: "copy-button",
      text: "hello",
      label: "Copy",
      copiedLabel: "Copied!",
    };
    shell.push({ vm, state: {} });

    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe("Copy");

    btn.click();
    // Flush the Promise microtask queue so .then() fires
    await Promise.resolve();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(btn.textContent).toBe("Copied!");

    // Advance fake timers by 1500ms — label should revert
    vi.advanceTimersByTime(1500);
    expect(btn.textContent).toBe("Copy");
  });
});

// ─── Case B: ephemeral copiedLabel swap-then-revert using adapter defaults ───

describe("CopyButtonNode — Case B: ephemeral label swap using adapter defaults", () => {
  it("uses 'Copied!' and 'Copy' defaults when label/copiedLabel are omitted", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const container = freshContainer();
    const shell = makeShell(container);

    // No label / copiedLabel — adapter must apply defaults
    const vm: ViewNode = { type: "copy-button", text: "npx some-tool" };
    shell.push({ vm, state: {} });

    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.textContent).toBe("Copy"); // adapter default

    btn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(btn.textContent).toBe("Copied!"); // adapter default

    vi.advanceTimersByTime(1500);
    expect(btn.textContent).toBe("Copy"); // reverts to adapter default
  });
});

// ─── Case C: graceful no-confirmation when clipboard rejects AND execCommand unavailable ───

describe("CopyButtonNode — Case C: silent failure when both clipboard paths fail", () => {
  it("shows no feedback and throws no error when clipboard rejects and execCommand returns false", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("NotAllowed"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    // jsdom doesn't implement execCommand — define it so legacyCopy can call it
    if (!document.execCommand) {
      Object.defineProperty(document, "execCommand", {
        value: () => false,
        writable: true,
        configurable: true,
      });
    }
    const execCommandSpy = vi.spyOn(document, "execCommand").mockReturnValue(false);

    const container = freshContainer();
    const onError = vi.fn();
    const shell = new ViewModelShell({
      endpoint,
      actionEndpoint,
      adapter: new BrowserAdapter(container),
      onError,
    });

    const vm: ViewNode = { type: "copy-button", text: "secret", label: "Copy" };
    shell.push({ vm, state: {} });

    const btn = container.querySelector("button") as HTMLButtonElement;
    expect(btn.textContent).toBe("Copy");

    btn.click();
    // Flush microtasks so the rejection .catch() branch runs
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    // Silent: label unchanged, no error surfaced
    expect(btn.textContent).toBe("Copy");
    expect(onError).not.toHaveBeenCalled();

    execCommandSpy.mockRestore();
  });
});
