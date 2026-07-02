// 3.8.0 — client/server version-skew detection (Phase 1) + fail-closed stale-
// client guard (Phase 2).
//
// Phase 1: when a SUCCESS response's serverBuild differs from the configured
//   clientBuildId, the shell renders normally FIRST, then fires a catchable
//   VmsVersionSkewError via onError. It does NOT fire when the ids match, when
//   clientBuildId is unset, or when serverBuild is absent.
// Phase 2: dispatch attaches the X-VMS-Client-Build header when configured; a
//   stale_client ok:false response calls adapter.reload() AND surfaces via
//   onError as a VmsActionError.

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  ViewModelShell,
  VmsVersionSkewError,
  VmsActionError,
  type Adapter,
  type ActionEvent,
  type ShellResponse,
} from "../src/index.js";

afterEach(() => { vi.restoreAllMocks(); });

interface SpyAdapter {
  adapter: Adapter;
  renders: number;
  reloads: number;
}

function makeAdapter(withReload = true): SpyAdapter {
  const spy: SpyAdapter = { adapter: null as never, renders: 0, reloads: 0 };
  spy.adapter = {
    render: () => { spy.renders++; },
    ...(withReload ? { reload: () => { spy.reloads++; } } : {}),
  };
  return spy;
}

function stubFetch(queue: Array<{ body: ShellResponse; status?: number }>): ReturnType<typeof vi.fn> {
  const responses = queue.slice();
  return vi.fn(async () => {
    const next = responses.shift()!;
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as ReturnType<typeof vi.fn>;
}

const emptyVm = { type: "text", value: "" } as never;

describe("3.8.0 — version-skew DETECTION (Phase 1)", () => {
  it("fires VmsVersionSkewError via onError when serverBuild != clientBuildId (after rendering)", async () => {
    const errors: Error[] = [];
    vi.stubGlobal("fetch", stubFetch([
      { body: { vm: emptyVm, state: {}, serverBuild: "build-2" } }, // load
    ]));
    const spy = makeAdapter();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, clientBuildId: "build-1",
      onError: (e) => errors.push(e),
    });
    await shell.load();

    // Render happened FIRST (never swallowed), THEN the skew fired.
    expect(spy.renders).toBe(1);
    expect(errors.length).toBe(1);
    const err = errors[0];
    expect(err).toBeInstanceOf(VmsVersionSkewError);
    const skew = err as VmsVersionSkewError;
    expect(skew.serverBuild).toBe("build-2");
    expect(skew.clientBuild).toBe("build-1");
    expect(skew.code).toBe("version_skew");
  });

  it("fires on a dispatch (processResponse path) too", async () => {
    const errors: Error[] = [];
    vi.stubGlobal("fetch", stubFetch([
      { body: { vm: emptyVm, state: {}, serverBuild: "build-1" } }, // load — matches, no skew
      { body: { vm: emptyVm, state: {}, serverBuild: "build-2" } }, // dispatch — mismatch
    ]));
    const spy = makeAdapter();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, clientBuildId: "build-1",
      onError: (e) => errors.push(e),
    });
    await shell.load();
    expect(errors.length).toBe(0); // ids matched on load
    await shell.dispatch({ name: "go" } as ActionEvent);
    expect(errors.length).toBe(1);
    expect(errors[0]).toBeInstanceOf(VmsVersionSkewError);
  });

  it("does NOT fire when ids match", async () => {
    const errors: Error[] = [];
    vi.stubGlobal("fetch", stubFetch([
      { body: { vm: emptyVm, state: {}, serverBuild: "build-1" } },
    ]));
    const spy = makeAdapter();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, clientBuildId: "build-1",
      onError: (e) => errors.push(e),
    });
    await shell.load();
    expect(errors.length).toBe(0);
  });

  it("does NOT fire when clientBuildId is unset", async () => {
    const errors: Error[] = [];
    vi.stubGlobal("fetch", stubFetch([
      { body: { vm: emptyVm, state: {}, serverBuild: "build-2" } },
    ]));
    const spy = makeAdapter();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, // no clientBuildId
      onError: (e) => errors.push(e),
    });
    await shell.load();
    expect(errors.length).toBe(0);
  });

  it("does NOT fire when serverBuild is absent", async () => {
    const errors: Error[] = [];
    vi.stubGlobal("fetch", stubFetch([
      { body: { vm: emptyVm, state: {} } }, // no serverBuild
    ]));
    const spy = makeAdapter();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, clientBuildId: "build-1",
      onError: (e) => errors.push(e),
    });
    await shell.load();
    expect(errors.length).toBe(0);
  });

  it("still renders the skewed response (detection is additive)", async () => {
    vi.stubGlobal("fetch", stubFetch([
      { body: { vm: emptyVm, state: {}, serverBuild: "build-2" } },
    ]));
    const spy = makeAdapter();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, clientBuildId: "build-1",
      onError: () => {},
    });
    await shell.load();
    expect(spy.renders).toBe(1);
    expect(shell.getCurrentVm()).not.toBeNull();
  });
});

describe("3.8.0 — X-VMS-Client-Build header (Phase 2)", () => {
  it("attaches the header on dispatch when clientBuildId is configured", async () => {
    const fetchSpy = stubFetch([
      { body: { vm: emptyVm, state: {} } }, // load
      { body: { vm: emptyVm, state: {} } }, // dispatch
    ]);
    vi.stubGlobal("fetch", fetchSpy);
    const spy = makeAdapter();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, clientBuildId: "build-7",
    });
    await shell.load();
    await shell.dispatch({ name: "go" } as ActionEvent);

    // The dispatch call is the 2nd fetch. Inspect its headers.
    const [, init] = fetchSpy.mock.calls[1] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-VMS-Client-Build"]).toBe("build-7");
  });

  it("does NOT attach the header when clientBuildId is unset", async () => {
    const fetchSpy = stubFetch([
      { body: { vm: emptyVm, state: {} } },
      { body: { vm: emptyVm, state: {} } },
    ]);
    vi.stubGlobal("fetch", fetchSpy);
    const spy = makeAdapter();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter,
    });
    await shell.load();
    await shell.dispatch({ name: "go" } as ActionEvent);

    const [, init] = fetchSpy.mock.calls[1] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-VMS-Client-Build"]).toBeUndefined();
  });
});

describe("3.8.0 — stale_client fail-closed recovery (Phase 2)", () => {
  it("calls adapter.reload() AND surfaces via onError on a stale_client ok:false response", async () => {
    const errors: Error[] = [];
    vi.stubGlobal("fetch", stubFetch([
      { body: { vm: emptyVm, state: {} } }, // load OK
      { body: { ok: false, errors: [{ message: "stale", code: "stale_client" }] } as unknown as ShellResponse, status: 400 },
    ]));
    const spy = makeAdapter(true);
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, clientBuildId: "build-1",
      onError: (e) => errors.push(e),
    });
    await shell.load();
    await shell.dispatch({ name: "mutate" } as ActionEvent);

    // Surfaced via onError as a VmsActionError with the stale_client code…
    expect(errors.length).toBe(1);
    expect(errors[0]).toBeInstanceOf(VmsActionError);
    expect((errors[0] as VmsActionError).code).toBe("stale_client");
    // …and reload() was called.
    expect(spy.reloads).toBe(1);
  });

  it("does not throw when the adapter has no reload (fail-quiet by absence)", async () => {
    const errors: Error[] = [];
    vi.stubGlobal("fetch", stubFetch([
      { body: { vm: emptyVm, state: {} } },
      { body: { ok: false, errors: [{ message: "stale", code: "stale_client" }] } as unknown as ShellResponse, status: 400 },
    ]));
    const spy = makeAdapter(false); // no reload verb
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, clientBuildId: "build-1",
      onError: (e) => errors.push(e),
    });
    await shell.load();
    await shell.dispatch({ name: "mutate" } as ActionEvent);

    expect(errors.length).toBe(1);
    expect((errors[0] as VmsActionError).code).toBe("stale_client");
    expect(spy.reloads).toBe(0);
  });
});
