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
  skewLocks: number; // 9.0.0 (SKEW-04/05) — count showSkewLock verb calls
}

function makeAdapter(withReload = true, withSkewLock = true): SpyAdapter {
  const spy: SpyAdapter = { adapter: null as never, renders: 0, reloads: 0, skewLocks: 0 };
  spy.adapter = {
    render: () => { spy.renders++; },
    ...(withReload ? { reload: () => { spy.reloads++; } } : {}),
    ...(withSkewLock ? { showSkewLock: () => { spy.skewLocks++; } } : {}),
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
  it("surfaces via onError AND hard-locks (via showSkewLock) on a stale_client ok:false response", async () => {
    // 9.0.0 (Plan 29-03) — behavior change: auto-reload retired in favor of
    // showSkewLock. Pre-9.0.0 asserted `spy.reloads === 1`; now the modal
    // fires (spy.skewLocks === 1) and its [Reload] button (Plan 29-06) calls
    // adapter.reload() on user consent — the shell no longer auto-reloads.
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
    // …and the shell hard-locked via showSkewLock (NOT auto-reload).
    expect(spy.reloads).toBe(0);
    expect(spy.skewLocks).toBe(1);
  });

  it("does not throw when the adapter has no reload or showSkewLock (fail-quiet by absence)", async () => {
    const errors: Error[] = [];
    vi.stubGlobal("fetch", stubFetch([
      { body: { vm: emptyVm, state: {} } },
      { body: { ok: false, errors: [{ message: "stale", code: "stale_client" }] } as unknown as ShellResponse, status: 400 },
    ]));
    const spy = makeAdapter(false, false); // no reload verb, no showSkewLock verb
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
    expect(spy.skewLocks).toBe(0);
  });
});

describe("9.0.0 — X-VMS-Client-Build header on GET (SKEW-03)", () => {
  it("attaches the header on load() when clientBuildId is configured", async () => {
    const fetchSpy = stubFetch([{ body: { vm: emptyVm, state: {} } }]);
    vi.stubGlobal("fetch", fetchSpy);
    const spy = makeAdapter();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, clientBuildId: "build-7",
    });
    await shell.load();
    // The load() call is the 1st (only) fetch. Inspect its headers.
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-VMS-Client-Build"]).toBe("build-7");
  });

  it("omits the header on load() when clientBuildId is not configured", async () => {
    const fetchSpy = stubFetch([{ body: { vm: emptyVm, state: {} } }]);
    vi.stubGlobal("fetch", fetchSpy);
    const spy = makeAdapter();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter,
      // no clientBuildId
    });
    await shell.load();
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = (init.headers as Record<string, string>) ?? {};
    expect(headers["X-VMS-Client-Build"]).toBeUndefined();
  });
});

describe("9.0.0 — hard-lock modal on VmsVersionSkewError (SKEW-04)", () => {
  it("calls adapter.showSkewLock on detection + drops subsequent dispatches + does not auto-reload", async () => {
    const fetchSpy = stubFetch([
      // Load response: server advertises build-2 while client is build-1 → skew
      { body: { vm: emptyVm, state: {}, serverBuild: "build-2" } },
      // No further responses queued — if a dispatch actually fires fetch, this test throws
    ]);
    vi.stubGlobal("fetch", fetchSpy);
    const spy = makeAdapter();
    const onError = vi.fn();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, clientBuildId: "build-1",
      onError,
    });
    await shell.load(); // → skew detected → lockSkew called
    expect(spy.skewLocks).toBe(1);
    expect(onError).toHaveBeenCalledOnce(); // signal preserved
    // Subsequent dispatch drops (skewLocked guard in dispatch())
    await shell.dispatch({ name: "go" } as ActionEvent);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // no 2nd fetch — dispatch dropped
    // adapter.reload() is NOT auto-called; the button in the DOM calls it
    expect(spy.reloads).toBe(0);
  });
});

describe("9.0.0 — hard-lock modal on stale_client VmsActionError (SKEW-04)", () => {
  it("calls adapter.showSkewLock INSTEAD of auto-reload (button now consents to reload)", async () => {
    const fetchSpy = stubFetch([
      // Load succeeds
      { body: { vm: emptyVm, state: {} } },
      // Dispatch → 400 stale_client from server global filter
      {
        body: { ok: false, errors: [{ message: "stale", code: "stale_client" }] } as unknown as ShellResponse,
        status: 400,
      },
    ]);
    vi.stubGlobal("fetch", fetchSpy);
    const spy = makeAdapter();
    const onError = vi.fn();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, clientBuildId: "build-1",
      onError,
    });
    await shell.load();
    await shell.dispatch({ name: "go" } as ActionEvent);
    expect(spy.skewLocks).toBe(1);
    expect(spy.reloads).toBe(0); // no auto-reload; user's button click will call it
    expect(onError).toHaveBeenCalledOnce(); // VmsActionError surfaced
  });
});

describe("9.0.0 — onVersionSkew:'custom' opt-out (SKEW-06)", () => {
  it("preserves v3.8.0 behavior: no lock, no showSkewLock, dispatches still succeed, onError still fires", async () => {
    const fetchSpy = stubFetch([
      { body: { vm: emptyVm, state: {}, serverBuild: "build-2" } }, // skew
      { body: { vm: emptyVm, state: {} } }, // subsequent dispatch succeeds
    ]);
    vi.stubGlobal("fetch", fetchSpy);
    const spy = makeAdapter();
    const onError = vi.fn();
    const shell = new ViewModelShell({
      endpoint: "/api/x", actionEndpoint: "/api/x/action",
      adapter: spy.adapter, clientBuildId: "build-1",
      onError,
      onVersionSkew: "custom",
    });
    await shell.load(); // → skew, but opt-out gate
    expect(spy.skewLocks).toBe(0); // modal did NOT fire
    expect(onError).toHaveBeenCalledOnce(); // but signal still surfaced (v3.8.0 preserved)
    // Dispatch still succeeds (not locked)
    await shell.dispatch({ name: "go" } as ActionEvent);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
