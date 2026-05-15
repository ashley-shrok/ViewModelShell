// UPLOAD-01 behavioral verification (D-14 a–e).
//
// Plan 02-01 shipped the implementation:
//   - core: additive `ShellOptions.onUploadProgress` + the `dispatch()` routing
//     branch `if (action.files && this.options.onUploadProgress && adapter.transport)`,
//   - browser: the `BrowserAdapter.transport` XHR `upload.onprogress` binding.
// Parity only observes the WIRE response — it can NOT prove the byte-level XHR
// progress binding (browser-runtime only, STATE.md architectural notes). This
// net-new framework-level jsdom/vitest harness closes that gap by driving the
// *real shipped* `BrowserAdapter.transport` + `ViewModelShell.dispatch()` with a
// controllable mock `XMLHttpRequest` (anti-mock-masking T-02-05: cases a/d/e run
// production code, NOT a re-implementation of the rule under test).
//
// Imports use the local source via `.js` specifiers (NodeNext convention — the
// same way src/browser.ts imports src/index.ts), NOT the published package —
// mirroring the established Phase-1 D-12.2 harness (test/adapter-seam.test.ts).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ViewModelShell, type ShellResponse, type ViewNode, type Adapter } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

const vm: ViewNode = { type: "text", value: "x" };
const state = {};
const endpoint = "/api/x";
const actionEndpoint = "/api/x/action";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

// A single scripted progress step the mock XHR replays on send().
interface ProgressStep {
  lengthComputable: boolean;
  loaded: number;
  total: number;
}

// Controllable mock XMLHttpRequest. jsdom has no real network; this lets each
// test deterministically drive `upload.onprogress` then `onload` against the
// SHIPPED BrowserAdapter.transport branch. `script` is set per-test before the
// dispatch so send() knows which progress sequence to emit.
function makeMockXHR() {
  let script: { steps: ProgressStep[]; responseBody: string; status: number } = {
    steps: [],
    responseBody: JSON.stringify({ vm, state }),
    status: 200,
  };
  const openCalls: Array<{ method: string; url: string }> = [];

  class MockXHR {
    upload: { onprogress: ((e: ProgressStep) => void) | null } = { onprogress: null };
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ontimeout: (() => void) | null = null;
    onabort: (() => void) | null = null;
    status = 0;
    statusText = "";
    responseText = "";

    open(method: string, url: string): void {
      openCalls.push({ method, url });
    }
    setRequestHeader(): void {
      /* no-op: header fidelity is exercised by parity, not this binding test */
    }
    send(_body?: unknown): void {
      // Defer to a microtask so the Promise inside transport() is wired before
      // we resolve it — exactly how a real XHR delivers events asynchronously.
      queueMicrotask(() => {
        for (const step of script.steps) {
          this.upload.onprogress?.({
            lengthComputable: step.lengthComputable,
            loaded: step.loaded,
            total: step.total,
          });
        }
        this.status = script.status;
        this.statusText = "OK";
        this.responseText = script.responseBody;
        this.onload?.();
      });
    }
  }

  return {
    MockXHR,
    openCalls,
    setScript(s: Partial<typeof script>) {
      script = { ...script, ...s };
    },
  };
}

// dispatch() refuses to run before currentState !== null. shell.push() seeds
// it (and renders) without any network — the same precondition technique the
// Phase-1 adapter-seam harness relies on.
function seedState(shell: ViewModelShell) {
  shell.push({ vm, state });
}

// Drains the queueMicrotask the mock schedules in send() plus any setTimeout.
async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UPLOAD-01 / D-14 (a) — onUploadProgress FIRES with (sent,total) on files + option set", () => {
  it("drives the shipped BrowserAdapter.transport XHR branch: in-flight (50,100) then terminal (100,100)", async () => {
    const { MockXHR, setScript, openCalls } = makeMockXHR();
    vi.stubGlobal("XMLHttpRequest", MockXHR);
    setScript({
      steps: [{ lengthComputable: true, loaded: 50, total: 100 }],
      responseBody: JSON.stringify({ vm, state }),
    });

    const calls: Array<[number, number]> = [];
    const onUploadProgress = (s: number, t: number) => calls.push([s, t]);

    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(freshContainer()),
      endpoint,
      actionEndpoint,
      onUploadProgress,
    });
    seedState(shell);

    await shell.dispatch({
      name: "upload",
      context: {},
      files: { file: new File(["data"], "f.txt") },
    });
    await flush();

    // Proves the real `xhr.upload.onprogress` binding fired (in-flight, D-05
    // computable) AND the real `xhr.onload` terminal emission (knownTotal>0).
    expect(calls).toContainEqual([50, 100]);
    expect(calls.at(-1)).toEqual([100, 100]);
    // Proves the routing branch actually selected the transport path (the mock
    // XHR's open() ran against the real action endpoint).
    expect(openCalls).toEqual([{ method: "POST", url: actionEndpoint }]);
  });
});

describe("UPLOAD-01 / D-14 (b) — onUploadProgress NEVER fires without files OR without the option", () => {
  it("(b1) files absent but option set → fetch path taken, callback never called", async () => {
    const { MockXHR } = makeMockXHR();
    vi.stubGlobal("XMLHttpRequest", MockXHR);
    // No files → the routing condition is false → core fetch runs, never XHR.
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ vm, state }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const calls: Array<[number, number]> = [];
    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(freshContainer()),
      endpoint,
      actionEndpoint,
      onUploadProgress: (s, t) => calls.push([s, t]),
    });
    seedState(shell);

    await shell.dispatch({ name: "noop", context: {} });
    await flush();

    expect(calls).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledWith(actionEndpoint, expect.objectContaining({ method: "POST" }));
  });

  it("(b2) files present but option unset → callback never called", async () => {
    const { MockXHR } = makeMockXHR();
    vi.stubGlobal("XMLHttpRequest", MockXHR);
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ vm, state }), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const calls: Array<[number, number]> = [];
    // No onUploadProgress option → routing condition false → core fetch runs.
    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(freshContainer()),
      endpoint,
      actionEndpoint,
    });
    seedState(shell);

    await shell.dispatch({
      name: "upload",
      context: {},
      files: { file: new File(["data"], "f.txt") },
    });
    await flush();

    expect(calls).toHaveLength(0);
    expect(fetchSpy).toHaveBeenCalledWith(actionEndpoint, expect.objectContaining({ method: "POST" }));
  });
});

describe("UPLOAD-01 / D-14 (c) — missing adapter.transport → fetch fallback succeeds, NO progress, NO error (D-02)", () => {
  it("render-only adapter + onUploadProgress set + files present: dispatch resolves silently, callback never fires, onError never called", async () => {
    const onError = vi.fn();
    const calls: Array<[number, number]> = [];
    // Render-only adapter has NO transport → D-02 SILENT fetch fallback
    // (intentionally NOT fail-loud, unlike navigate/storage).
    const renderOnlyAdapter: Adapter = { render() {} };
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ vm: { type: "text", value: "x" }, state: {} }), {
          status: 200,
        }),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const shell = new ViewModelShell({
      adapter: renderOnlyAdapter,
      endpoint,
      actionEndpoint,
      onUploadProgress: (s, t) => calls.push([s, t]),
      onError,
    });
    seedState(shell);

    await shell.dispatch({
      name: "upload",
      context: {},
      files: { file: new File(["data"], "f.txt") },
    });
    await flush();

    expect(calls).toHaveLength(0); // no progress on the fetch fallback path
    expect(onError).not.toHaveBeenCalled(); // D-02: silent, not fail-loud
    expect(fetchSpy).toHaveBeenCalledWith(actionEndpoint, expect.objectContaining({ method: "POST" }));
  });
});

describe("UPLOAD-01 / D-14 (d) — response still flows through the shared processResponse() (D-08)", () => {
  it("a files-bearing dispatch via the mock XHR resolves a real Response whose vm round-trips through processResponse()", async () => {
    const { MockXHR, setScript } = makeMockXHR();
    vi.stubGlobal("XMLHttpRequest", MockXHR);
    // The reconstructed Response (new Response(xhr.responseText,…)) MUST traverse
    // the unchanged processResponse() exactly like fetch — proven by getCurrentVm().
    setScript({
      steps: [{ lengthComputable: true, loaded: 10, total: 10 }],
      responseBody: JSON.stringify({ vm: { type: "text", value: "updated" }, state: {} }),
    });

    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(freshContainer()),
      endpoint,
      actionEndpoint,
      onUploadProgress: () => {},
    });
    seedState(shell);
    // Sanity: before the dispatch, getCurrentVm() is the seeded vm, not "updated".
    expect(shell.getCurrentVm()).toEqual({ type: "text", value: "x" });

    await shell.dispatch({
      name: "upload",
      context: {},
      files: { file: new File(["data"], "f.txt") },
    });
    await flush();

    // Proves D-08: the XHR branch's reconstructed Response went through the
    // SAME processResponse() that set currentVm — observable via getCurrentVm().
    expect(shell.getCurrentVm()).toEqual({ type: "text", value: "updated" });
  });
});

describe("UPLOAD-01 / D-14 (e) — indeterminate completion is (finalLoaded,finalLoaded), NEVER (0,0) (D-05)", () => {
  it("lengthComputable:false, loaded:73 → terminal emission is exactly (73,73) and is NOT (0,0)", async () => {
    const { MockXHR, setScript } = makeMockXHR();
    vi.stubGlobal("XMLHttpRequest", MockXHR);
    // Not computable: the shipped binding emits (loaded,0) in-flight and the
    // terminal emission must mirror (lastLoaded,lastLoaded) — explicitly never
    // (0,0), which would tell the app "0 of 0" at success (D-05 / D-05a hazard).
    setScript({
      steps: [{ lengthComputable: false, loaded: 73, total: 0 }],
      responseBody: JSON.stringify({ vm, state }),
    });

    const calls: Array<[number, number]> = [];
    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(freshContainer()),
      endpoint,
      actionEndpoint,
      onUploadProgress: (s, t) => calls.push([s, t]),
    });
    seedState(shell);

    await shell.dispatch({
      name: "upload",
      context: {},
      files: { file: new File(["data"], "f.txt") },
    });
    await flush();

    // In-flight indeterminate sentinel (loaded, 0) was emitted…
    expect(calls).toContainEqual([73, 0]);
    // …and the terminal emission is (finalLoaded, finalLoaded), NEVER (0,0).
    expect(calls.at(-1)).toEqual([73, 73]);
    expect(calls.at(-1)).not.toEqual([0, 0]);
  });
});
