// 0.5.0 — shell orchestration of the `"download"` ShellSideEffect.
//
// Mirrors the adapter-seam.test.ts pattern (jsdom env, shell.push, no real
// HTTP). Mocks globalThis.fetch so the test never hits a network; asserts:
//   • Authorization header from getRequestHeaders() merges into the download
//     fetch (the whole point of the primitive — no signed URL needed).
//   • Filename precedence: Content-Disposition > side-effect hint > URL basename > "download".
//   • Non-OK response → onError, saveFile never called.
//   • Missing saveFile capability → fail-loud onError, fetch never called.
//   • RFC 5987 filename* (UTF-8 percent-encoded) wins over plain filename.
//
// Download is fire-and-forget (`void this.download(...)`); the assertions use
// `vi.waitFor` to drain the microtask + I/O without depending on internal
// timing details.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ViewModelShell,
  type ShellResponse,
  type ViewNode,
  type Adapter,
} from "../src/index.js";

const vm: ViewNode = { type: "text", value: "x" };
const state = {};
const endpoint = "/api/x";
const actionEndpoint = "/api/x/action";

const realFetch = globalThis.fetch;

beforeEach(() => {
  // Each test installs its own fetch via fakeFetch() below.
});

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function fakeFetch(
  body: string,
  opts?: { headers?: Record<string, string>; status?: number; statusText?: string },
): ReturnType<typeof vi.fn> {
  const headers = new Headers(opts?.headers ?? {});
  const status = opts?.status ?? 200;
  const statusText = opts?.statusText ?? "OK";
  const spy = vi.fn().mockImplementation(
    // Return a fresh Response on every call (Response bodies are one-shot).
    async () => new Response(body, { status, statusText, headers }),
  );
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

function mkResponse(extra: Partial<ShellResponse>): ShellResponse {
  return { vm, state, ...extra };
}

describe("0.5.0 — download side-effect orchestration", () => {
  // ── A: getRequestHeaders() merge + Content-Disposition parse + saveFile call
  it("fetches with merged headers and hands the parsed filename/contentType to adapter.saveFile", async () => {
    const fetchSpy = fakeFetch("hello", {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": 'attachment; filename="hello.txt"',
      },
    });
    const saveFile = vi.fn();
    const adapter: Adapter = { render() {}, saveFile };
    const shell = new ViewModelShell({
      adapter,
      endpoint,
      actionEndpoint,
      getRequestHeaders: () => ({ Authorization: "Bearer tok" }),
    });

    shell.push(mkResponse({ sideEffects: [{ type: "download", url: "/file" }] }));

    await vi.waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    expect(fetchSpy).toHaveBeenCalledWith("/file", {
      headers: { Authorization: "Bearer tok" },
    });
    const [blob, filename, contentType] = saveFile.mock.calls[0]!;
    expect(filename).toBe("hello.txt");
    expect(contentType).toBe("text/plain; charset=utf-8");
    expect(blob).toBeInstanceOf(Blob);
    // Byte passthrough is verified by the TuiAdapter saveFile test in
    // test/tui.test.ts (Node env, real Blob.arrayBuffer + writeFileSync
    // round-trip). The jsdom Blob from Response.blob() in this env lacks
    // both .text() and .arrayBuffer(), so we can't assert bytes here —
    // and we don't need to: instanceof-Blob proves the orchestration
    // hands the right object to the adapter.
  });

  // ── B: side-effect filename hint, used when Content-Disposition is absent
  it("uses the side-effect filename hint when no Content-Disposition is present", async () => {
    fakeFetch("x", { headers: { "Content-Type": "application/octet-stream" } });
    const saveFile = vi.fn();
    const shell = new ViewModelShell({
      adapter: { render() {}, saveFile },
      endpoint,
      actionEndpoint,
    });

    shell.push(
      mkResponse({
        sideEffects: [{ type: "download", url: "/file", filename: "hint.bin" }],
      }),
    );

    await vi.waitFor(() => expect(saveFile).toHaveBeenCalled());
    expect(saveFile.mock.calls[0]![1]).toBe("hint.bin");
  });

  // ── C: URL basename fallback when neither header nor hint is present
  it("falls back to URL basename when neither Content-Disposition nor a hint is present", async () => {
    fakeFetch("x"); // no headers
    const saveFile = vi.fn();
    const shell = new ViewModelShell({
      adapter: { render() {}, saveFile },
      endpoint,
      actionEndpoint,
    });

    shell.push(mkResponse({ sideEffects: [{ type: "download", url: "/files/report.pdf" }] }));

    await vi.waitFor(() => expect(saveFile).toHaveBeenCalled());
    expect(saveFile.mock.calls[0]![1]).toBe("report.pdf");
  });

  // ── D: non-OK response surfaces onError and never calls saveFile
  it("non-OK response surfaces onError with the status and never calls saveFile", async () => {
    fakeFetch("nope", { status: 403, statusText: "Forbidden" });
    const saveFile = vi.fn();
    const onError = vi.fn();
    const shell = new ViewModelShell({
      adapter: { render() {}, saveFile },
      endpoint,
      actionEndpoint,
      onError,
    });

    shell.push(mkResponse({ sideEffects: [{ type: "download", url: "/secret" }] }));

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect((onError.mock.calls[0]![0] as Error).message).toContain("403");
    expect((onError.mock.calls[0]![0] as Error).message).toContain("Forbidden");
    expect(saveFile).not.toHaveBeenCalled();
  });

  // ── E: missing saveFile capability fails loud, no fetch is consumed
  it("missing saveFile capability fails loud via onError; fetch is not consumed", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const onError = vi.fn();
    const renderOnlyAdapter: Adapter = { render() {} };
    const shell = new ViewModelShell({
      adapter: renderOnlyAdapter,
      endpoint,
      actionEndpoint,
      onError,
    });

    shell.push(mkResponse({ sideEffects: [{ type: "download", url: "/file" }] }));

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    const err = onError.mock.calls[0]![0] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("saveFile");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // ── F: RFC 5987 filename* (UTF-8 percent-encoded) wins over plain filename
  it("parses RFC 5987 filename* (UTF-8 percent-encoded) in preference to plain filename", async () => {
    fakeFetch("x", {
      headers: {
        "Content-Type": "text/plain",
        // Plain "fallback.txt" present, but filename* should win.
        "Content-Disposition":
          'attachment; filename="fallback.txt"; filename*=UTF-8\'\'na%C3%AFve.txt',
      },
    });
    const saveFile = vi.fn();
    const shell = new ViewModelShell({
      adapter: { render() {}, saveFile },
      endpoint,
      actionEndpoint,
    });

    shell.push(mkResponse({ sideEffects: [{ type: "download", url: "/x" }] }));

    await vi.waitFor(() => expect(saveFile).toHaveBeenCalled());
    expect(saveFile.mock.calls[0]![1]).toBe("naïve.txt");
  });

  // ── Extra: downloads do NOT block the render or the redirect branch.
  //    The render path runs synchronously after the side-effects loop; the
  //    download Promise resolves in a microtask. Asserting this prevents a
  //    future regression where someone awaits the download in processResponse.
  it("re-render fires synchronously while the download is still in flight", async () => {
    fakeFetch("x");
    const saveFile = vi.fn();
    const render = vi.fn();
    const shell = new ViewModelShell({
      adapter: { render, saveFile },
      endpoint,
      actionEndpoint,
    });

    shell.push(mkResponse({ sideEffects: [{ type: "download", url: "/file" }] }));

    // render() ran in this turn of the event loop.
    expect(render).toHaveBeenCalledTimes(1);
    // saveFile has NOT been called yet (it awaits fetch → blob).
    expect(saveFile).not.toHaveBeenCalled();
    // …but it eventually does.
    await vi.waitFor(() => expect(saveFile).toHaveBeenCalled());
  });
});
