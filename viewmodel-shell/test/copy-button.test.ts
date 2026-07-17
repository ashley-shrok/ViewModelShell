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

// ─── Rich copy (dual-representation clipboard write) ───
//
// Shared fake: navigator.clipboard.write + a fake ClipboardItem that keeps the
// Blob map so a test can read back what each representation carried.

class FakeClipboardItem {
  constructor(public items: Record<string, Blob>) {}
}

// jsdom's Blob doesn't implement the async `.text()` reader, so record the source
// parts on construction via a transparent subclass and read them synchronously.
// SpyBlob is a real Blob (extends the global), so the adapter behaves identically.
const RealBlob = globalThis.Blob;
class SpyBlob extends RealBlob {
  _parts: BlobPart[];
  constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
    super(parts, opts);
    this._parts = parts;
  }
}

function installRichClipboard() {
  const write = vi.fn().mockResolvedValue(undefined);
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { write, writeText },
    writable: true,
    configurable: true,
  });
  (globalThis as unknown as { ClipboardItem: unknown }).ClipboardItem = FakeClipboardItem;
  (globalThis as unknown as { Blob: unknown }).Blob = SpyBlob;
  return { write, writeText };
}

function writtenItem(write: ReturnType<typeof vi.fn>): FakeClipboardItem {
  return write.mock.calls[0][0][0] as FakeClipboardItem;
}

function blobSource(b: Blob): string {
  return (b as unknown as { _parts: BlobPart[] })._parts.map(String).join("");
}

// ─── Case D: server-provided `html` → text/html + text/plain both written ───

describe("CopyButtonNode — Case D: server-provided html writes both representations", () => {
  it("writes text/html=html and text/plain=text via ClipboardItem, not writeText", async () => {
    const { write, writeText } = installRichClipboard();

    const container = freshContainer();
    const shell = makeShell(container);
    const vm: ViewNode = {
      type: "copy-button",
      text: "plain fallback",
      html: "<strong>rich</strong>",
      label: "Copy",
      copiedLabel: "Copied!",
    };
    shell.push({ vm, state: {} });

    const btn = container.querySelector("button") as HTMLButtonElement;
    btn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
    const item = writtenItem(write);
    expect(blobSource(item.items["text/html"])).toBe("<strong>rich</strong>");
    expect(blobSource(item.items["text/plain"])).toBe("plain fallback");
    expect(btn.textContent).toBe("Copied!");

    vi.advanceTimersByTime(1500);
    expect(btn.textContent).toBe("Copy");
  });
});

// ─── Case E: harvest via copyTargetId → lifts outerHTML + textContent off the region ───

describe("CopyButtonNode — Case E: copyTargetId harvests the rendered region", () => {
  it("writes the target's outerHTML as text/html and its textContent as text/plain", async () => {
    const { write, writeText } = installRichClipboard();

    const container = freshContainer();
    const shell = makeShell(container);
    const vm: ViewNode = {
      type: "page",
      children: [
        {
          type: "section",
          id: "report-card-e",
          variant: "card",
          children: [{ type: "text", value: "Quarterly numbers", style: "heading" }],
        },
        { type: "copy-button", text: "unused fallback", copyTargetId: "report-card-e", label: "Copy" },
      ],
    };
    shell.push({ vm, state: {} });

    const btn = container.querySelector("button") as HTMLButtonElement;
    btn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(write).toHaveBeenCalledTimes(1);
    expect(writeText).not.toHaveBeenCalled();
    const item = writtenItem(write);
    const html = blobSource(item.items["text/html"]);
    // The harvested markup is the target's outerHTML — the section element itself,
    // its heading structure, and its text — NOT the plain fallback string.
    expect(html).toContain("Quarterly numbers");
    expect(html).toContain("vms-section");
    expect(html).not.toContain("unused fallback");
    expect(blobSource(item.items["text/plain"])).toContain("Quarterly numbers");
  });
});

// ─── Case F: copyTargetId matches nothing → fail LOUD + plain fallback (never a dead button) ───

describe("CopyButtonNode — Case F: dangling copyTargetId fails loud, falls back to plain", () => {
  it("logs a console error and writes the plain text, without a rich write", async () => {
    const { write, writeText } = installRichClipboard();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const container = freshContainer();
    const shell = makeShell(container);
    const vm: ViewNode = {
      type: "copy-button",
      text: "plain fallback",
      copyTargetId: "does-not-exist-f",
      label: "Copy",
      copiedLabel: "Copied!",
    };
    shell.push({ vm, state: {} });

    const btn = container.querySelector("button") as HTMLButtonElement;
    btn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0][0])).toContain("does-not-exist-f");
    expect(write).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith("plain fallback");
    expect(btn.textContent).toBe("Copied!");

    errorSpy.mockRestore();
  });
});
