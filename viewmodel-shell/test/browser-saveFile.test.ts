// 0.5.0 — BrowserAdapter.saveFile unit test (jsdom).
//
// Verifies the actual Save-As affordance: createObjectURL → transient anchor
// with [download] → click → remove → setTimeout-revokeObjectURL. Asserts the
// anchor lifecycle directly, with fake timers to flush the revoke.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BrowserAdapter } from "../src/browser.js";

// jsdom v25 doesn't ship URL.createObjectURL / revokeObjectURL by default.
// Install no-op stubs so spyOn has a property to wrap; the spies in each
// test then return the URL we want to track.
beforeEach(() => {
  document.body.innerHTML = "";
  if (typeof (URL as { createObjectURL?: unknown }).createObjectURL !== "function") {
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => "blob:noop";
  }
  if (typeof (URL as { revokeObjectURL?: unknown }).revokeObjectURL !== "function") {
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = () => {};
  }
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("0.5.0 — BrowserAdapter.saveFile", () => {
  it("creates a transient anchor with [download], clicks it, removes it, and revokes the object URL on the next tick", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const adapter = new BrowserAdapter(container);

    const fakeUrl = "blob:test-1";
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue(fakeUrl);
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});

    // Capture every <a> that the adapter creates so we can inspect it after
    // the click + remove (otherwise it is gone from the DOM).
    const anchors: HTMLAnchorElement[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tag: string, opts?: ElementCreationOptions) => {
        const el = realCreate(tag, opts) as HTMLElement;
        if (tag === "a") anchors.push(el as HTMLAnchorElement);
        return el as HTMLElement;
      },
    );

    vi.useFakeTimers();

    const blob = new Blob(["hello"], { type: "text/plain" });
    adapter.saveFile(blob, "greeting.txt", "text/plain");

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith(blob);
    expect(anchors).toHaveLength(1);
    const a = anchors[0]!;
    // href is the fake object URL; download is the requested filename.
    expect(a.href).toContain(fakeUrl);
    expect(a.download).toBe("greeting.txt");
    // The anchor was removed after click (no longer in the document).
    expect(a.isConnected).toBe(false);
    // Revoke is deferred to setTimeout(0); hasn't fired yet.
    expect(revokeSpy).not.toHaveBeenCalled();

    vi.runAllTimers();
    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith(fakeUrl);
  });

  it("revokes the object URL even if the click implementation throws", () => {
    // Ensures the `finally` schedules the revoke regardless of click failure —
    // otherwise a buggy/jsdom anchor click would leak the object URL.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const adapter = new BrowserAdapter(container);

    const fakeUrl = "blob:test-2";
    vi.spyOn(URL, "createObjectURL").mockReturnValue(fakeUrl);
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});

    // Force the next-created <a> to throw on click().
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tag: string, opts?: ElementCreationOptions) => {
        const el = realCreate(tag, opts);
        if (tag === "a") {
          (el as HTMLAnchorElement).click = () => {
            throw new Error("click failed");
          };
        }
        return el as HTMLElement;
      },
    );

    vi.useFakeTimers();

    expect(() =>
      adapter.saveFile(new Blob(["x"]), "x.txt", "text/plain"),
    ).toThrow("click failed");

    vi.runAllTimers();
    expect(revokeSpy).toHaveBeenCalledWith(fakeUrl);
  });
});
