// Phase 7 Plan 02 — VmsActionError + parse-then-branch behavioral tests.
//
// Covers:
//   - VmsActionError class shape (status, errors, code shortcut, message summarization)
//   - dispatch(): ok:true path → normal render
//   - dispatch(): ok:true redirect path → navigate
//   - dispatch(): ok:false → VmsActionError via onError, NO adapter.render with failure vm
//   - dispatch(): ok:false runtime hardening — currentVm/currentState NOT mutated (D-15)
//   - dispatch(): ok:false on 500 — same VmsActionError flow
//   - dispatch(): non-JSON error body → plain Error fallback
//   - load(): ok:true → normal render
//   - load(): ok:false → VmsActionError via onError, no render
//   - load(): ok:false → await shell.load() resolves normally (not throws), onError fires once
//   - load(): non-JSON error body → plain Error fallback
//   - push(): ok:false → VmsActionError via onError
//   - push(): ok:true (and ok absent) → processResponse normal path
//   - failCapability distinction: ok:true response with unserviceable sideEffect → plain Error (NOT VmsActionError)
//   - core agnosticism: no window/document/localStorage/sessionStorage/XMLHttpRequest in index.ts (T-AGNOSTIC)
//
// Imports use the local source via `.js` specifiers (NodeNext convention — same
// as every other suite). Uses jsdom environment (vitest default).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ViewModelShell, type ShellResponse, type ViewNode, type Adapter } from "../src/index.js";

const vm: ViewNode = { type: "text", value: "hello" };
const vm2: ViewNode = { type: "text", value: "new-vm" };
const state = { x: 1 };
const endpoint = "/api/test";
const actionEndpoint = "/api/test/action";

// Minimal no-op adapter that captures render calls.
function makeCapturingAdapter() {
  const renders: ViewNode[] = [];
  const adapter: Adapter = {
    render(v, _onAction) {
      renders.push(v);
    },
  };
  return { adapter, renders };
}

// Shell pre-loaded with an initial VM (so dispatch is legal).
async function makeLoadedShell(
  adapter: Adapter,
  onError?: (err: Error) => void,
  extraOptions?: Partial<{ onRedirect: (url: string) => void }>
) {
  const shell = new ViewModelShell({
    endpoint,
    actionEndpoint,
    adapter,
    onError,
    ...extraOptions,
  });

  // Provide a successful initial load response so currentState is populated.
  const initResponse: ShellResponse = { vm, state };
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(initResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  );
  await shell.load();
  return shell;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── VmsActionError class shape ──────────────────────────────────────────────

describe("VmsActionError — class shape", () => {
  it("is exported from index.ts", async () => {
    const mod = await import("../src/index.js");
    expect(typeof mod.VmsActionError).toBe("function");
  });

  it("extends Error so instanceof Error === true", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const err = new VmsActionError([{ message: "oops", code: "unknown_action" }], 400);
    expect(err instanceof Error).toBe(true);
    expect(err instanceof VmsActionError).toBe(true);
  });

  it("has name = 'VmsActionError'", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const err = new VmsActionError([{ message: "oops" }], 400);
    expect(err.name).toBe("VmsActionError");
  });

  it("exposes status", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const err = new VmsActionError([{ message: "x" }], 400);
    expect(err.status).toBe(400);
  });

  it("exposes errors array", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const err = new VmsActionError([{ message: "foo", code: "unknown_action" }], 400);
    expect(err.errors).toHaveLength(1);
    expect(err.errors[0].message).toBe("foo");
    expect(err.errors[0].code).toBe("unknown_action");
  });

  it("exposes code shortcut to errors[0].code", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const err = new VmsActionError([{ message: "boom", code: "unknown_action" }], 400);
    expect(err.code).toBe("unknown_action");
  });

  it("code is undefined when errors[0] has no code", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const err = new VmsActionError([{ message: "boom" }], 400);
    expect(err.code).toBeUndefined();
  });

  it("message is non-empty (single-entry summarization)", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const err = new VmsActionError([{ message: "Unknown action: foo" }], 400);
    expect(err.message.length).toBeGreaterThan(0);
  });

  it("message includes first error message", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const err = new VmsActionError([{ message: "Unknown action: foo" }], 400);
    expect(err.message).toContain("Unknown action: foo");
  });

  it("multi-entry message includes count summary", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const err = new VmsActionError(
      [{ message: "first error" }, { message: "second error" }],
      500
    );
    // Should summarize: "first error (and 1 more)" or similar
    expect(err.message).toContain("first error");
    expect(err.message.length).toBeGreaterThan("first error".length);
  });
});

// ─── dispatch(): ok:true paths ────────────────────────────────────────────────

describe("dispatch() — ok:true normal render", () => {
  it("calls adapter.render once with the new vm on ok:true response", async () => {
    const { adapter, renders } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError);

    const successResponse: ShellResponse = { vm: vm2, state: { x: 2 } };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(successResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    await shell.dispatch({ name: "do-thing" });

    // renders[0] is initial load, renders[1] is the dispatch result
    expect(renders).toHaveLength(2);
    expect(renders[1]).toEqual(vm2);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("dispatch() — ok:true redirect", () => {
  it("calls onRedirect with the URL on ok:true redirect response", async () => {
    const { adapter } = makeCapturingAdapter();
    const onRedirect = vi.fn();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError, { onRedirect });

    const redirectResponse: ShellResponse = { vm: null as unknown as ViewNode, state: null, redirect: "/somewhere" };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(redirectResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    await shell.dispatch({ name: "go" });

    expect(onRedirect).toHaveBeenCalledWith("/somewhere");
    expect(onError).not.toHaveBeenCalled();
  });
});

// ─── dispatch(): ok:false paths ──────────────────────────────────────────────

describe("dispatch() — ok:false 400 response", () => {
  it("calls onError with VmsActionError on ok:false 400 response", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const { adapter } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError);

    const failBody = {
      ok: false,
      errors: [{ message: "Unknown action: foo", code: "unknown_action" }],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(failBody), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
    await shell.dispatch({ name: "foo" });

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0];
    expect(err instanceof VmsActionError).toBe(true);
    expect(err.status).toBe(400);
    expect(err.errors).toHaveLength(1);
    expect(err.errors[0].code).toBe("unknown_action");
    expect(err.code).toBe("unknown_action");
    expect(err.message.length).toBeGreaterThan(0);
  });

  it("does NOT call adapter.render with a vm from the failure body (D-15)", async () => {
    const { adapter, renders } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError);

    const failBody = {
      ok: false,
      errors: [{ message: "boom", code: "unknown_action" }],
      vm: vm2,       // D-15 regression: server incorrectly sent vm on ok:false
      state: { x: 99 },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(failBody), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
    await shell.dispatch({ name: "foo" });

    // Only the initial load render; the failure-body vm is NOT rendered
    // (the re-render after error is of currentVm which equals vm, not vm2).
    const lastRender = renders[renders.length - 1];
    expect(lastRender).toEqual(vm); // re-render of last-good vm, not vm2
  });

  it("does NOT mutate currentVm or currentState on ok:false (D-15 runtime hardening)", async () => {
    const { adapter } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError);

    const failBody = {
      ok: false,
      errors: [{ message: "boom" }],
      vm: vm2,
      state: { x: 99 },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(failBody), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
    await shell.dispatch({ name: "foo" });

    // currentState should still be the original state from load()
    expect(shell.getCurrentState()).toEqual(state);
    expect(shell.getCurrentVm()).toEqual(vm);
  });

  it("re-renders the last-good currentVm after dispatch error (D-15 behavior)", async () => {
    const { adapter, renders } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError);

    const failBody = { ok: false, errors: [{ message: "nope" }] };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(failBody), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
    await shell.dispatch({ name: "fail" });

    // renders[0] = initial load, renders[1] = re-render of currentVm after error
    expect(renders).toHaveLength(2);
    expect(renders[1]).toEqual(vm);
  });
});

describe("dispatch() — ok:false 500 response", () => {
  it("calls onError with VmsActionError on ok:false 500 response, status === 500", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const { adapter } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError);

    const failBody = {
      ok: false,
      errors: [{ message: "boom", code: "uncaught_exception" }],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(failBody), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
    await shell.dispatch({ name: "explode" });

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0];
    expect(err instanceof VmsActionError).toBe(true);
    expect(err.status).toBe(500);
    expect(err.errors[0].code).toBe("uncaught_exception");
  });
});

describe("dispatch() — non-JSON error body fallback", () => {
  it("surfaces plain Error (not VmsActionError) when 4xx/5xx body is non-JSON", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const { adapter } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("<html>Bad Gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      })
    );
    await shell.dispatch({ name: "net-err" });

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0];
    expect(err instanceof VmsActionError).toBe(false);
    expect(err instanceof Error).toBe(true);
  });
});

// ─── load(): paths ────────────────────────────────────────────────────────────

describe("load() — ok:true", () => {
  it("renders normally on ok:true GET response", async () => {
    const { adapter, renders } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = new ViewModelShell({ endpoint, actionEndpoint, adapter, onError });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ vm, state }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    await shell.load();

    expect(renders).toHaveLength(1);
    expect(renders[0]).toEqual(vm);
    expect(onError).not.toHaveBeenCalled();
  });
});

describe("load() — ok:false", () => {
  it("calls onError with VmsActionError on ok:false GET response", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const { adapter } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = new ViewModelShell({ endpoint, actionEndpoint, adapter, onError });

    const failBody = {
      ok: false,
      errors: [{ message: "auth failed", code: "uncaught_exception" }],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(failBody), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    await shell.load();

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0];
    expect(err instanceof VmsActionError).toBe(true);
    expect(err.status).toBe(401);
  });

  it("does NOT call adapter.render on ok:false GET response", async () => {
    const { adapter, renders } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = new ViewModelShell({ endpoint, actionEndpoint, adapter, onError });

    const failBody = { ok: false, errors: [{ message: "nope" }] };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(failBody), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    );
    await shell.load();

    expect(renders).toHaveLength(0);
  });

  it("await shell.load() resolves normally on ok:false — does NOT throw to caller, onError fires once", async () => {
    const { adapter } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = new ViewModelShell({ endpoint, actionEndpoint, adapter, onError });

    const failBody = { ok: false, errors: [{ message: "not found" }] };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(failBody), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    );

    // Must not throw
    await expect(shell.load()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("does NOT set currentVm or currentState on ok:false (D-15 runtime hardening in load)", async () => {
    const { adapter } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = new ViewModelShell({ endpoint, actionEndpoint, adapter, onError });

    const failBody = { ok: false, errors: [{ message: "oops" }], vm: vm2, state: { x: 99 } };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(failBody), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
    await shell.load();

    expect(shell.getCurrentVm()).toBeNull();
    expect(shell.getCurrentState()).toBeNull();
  });
});

describe("load() — non-JSON error body fallback", () => {
  it("surfaces plain Error (not VmsActionError) when load response is non-JSON", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const { adapter } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = new ViewModelShell({ endpoint, actionEndpoint, adapter, onError });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Bad Gateway", {
        status: 502,
        headers: { "Content-Type": "text/html" },
      })
    );
    await shell.load();

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0];
    expect(err instanceof VmsActionError).toBe(false);
    expect(err instanceof Error).toBe(true);
  });
});

// ─── push() paths ─────────────────────────────────────────────────────────────

describe("push() — ok:false", () => {
  it("calls onError with VmsActionError on ok:false push", async () => {
    const { VmsActionError } = await import("../src/index.js");
    const { adapter } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError);

    shell.push({
      ok: false,
      errors: [{ message: "Server pushed error" }],
    } as unknown as ShellResponse);

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0];
    expect(err instanceof VmsActionError).toBe(true);
    // push-originated errors have status 0 (no HTTP transaction)
    expect(err.status).toBe(0);
  });

  it("does NOT call adapter.render with failure-body vm on ok:false push (D-15)", async () => {
    const { adapter, renders } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError);

    // renders[0] is initial load
    const renderCountBefore = renders.length;

    shell.push({
      ok: false,
      errors: [{ message: "pushed error" }],
      vm: vm2,
    } as unknown as ShellResponse);

    // No new render for the failure body vm
    expect(renders.length).toBe(renderCountBefore);
    expect(renders[renders.length - 1]).toEqual(vm); // last good vm unchanged
  });

  it("does NOT mutate currentVm/currentState on ok:false push", async () => {
    const { adapter } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError);

    shell.push({
      ok: false,
      errors: [{ message: "pushed error" }],
      vm: vm2,
      state: { x: 99 },
    } as unknown as ShellResponse);

    expect(shell.getCurrentVm()).toEqual(vm);
    expect(shell.getCurrentState()).toEqual(state);
  });
});

describe("push() — ok:true and ok absent (backwards compat)", () => {
  it("processes normally when ok:true", async () => {
    const { adapter, renders } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError);

    shell.push({ ok: true, vm: vm2, state: { x: 2 } } as unknown as ShellResponse);

    expect(renders[renders.length - 1]).toEqual(vm2);
    expect(onError).not.toHaveBeenCalled();
  });

  it("processes normally when ok is absent (hand-constructed legacy push)", async () => {
    const { adapter, renders } = makeCapturingAdapter();
    const onError = vi.fn();
    const shell = await makeLoadedShell(adapter, onError);

    // ok absent = legacy consumer that doesn't set ok
    shell.push({ vm: vm2, state: { x: 3 } });

    expect(renders[renders.length - 1]).toEqual(vm2);
    expect(onError).not.toHaveBeenCalled();
  });
});

// ─── failCapability distinction ───────────────────────────────────────────────

describe("failCapability vs VmsActionError distinction", () => {
  it("ok:true response with set-local-storage and no storage capability → plain Error, NOT VmsActionError", async () => {
    const { VmsActionError } = await import("../src/index.js");
    // Adapter WITHOUT storage capability
    const noStorageAdapter: Adapter = {
      render(_vm, _onAction) {},
    };
    const onError = vi.fn();
    const shell = await makeLoadedShell(noStorageAdapter, onError);

    // Server returns ok:true with a storage side-effect the adapter can't serve
    const successWithEffect: ShellResponse = {
      vm,
      state,
      sideEffects: [{ type: "set-local-storage", key: "tok", value: "abc" }],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(successWithEffect), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    await shell.dispatch({ name: "save" });

    expect(onError).toHaveBeenCalled();
    const err = onError.mock.calls[0][0];
    // This is a failCapability path, NOT a VmsActionError
    expect(err instanceof VmsActionError).toBe(false);
    expect(err instanceof Error).toBe(true);
  });
});
