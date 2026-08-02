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

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ViewModelShell,
  VmsVersionSkewError,
  VmsActionError,
  type Adapter,
  type ActionEvent,
  type ShellResponse,
} from "../src/index.js";
import { createVersionGuard } from "../src/server.js";

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

describe("9.0.0 — hard-lock modal on stale_client from initial load() (SKEW-04)", () => {
  // Post-verification fix (Ashley tasting 2026-08-02): the initial GET's catch
  // arm ALSO needs to fire lockSkew on a stale_client 400 — otherwise a
  // stale-bundle boot leaves an empty container with no shipped affordance and
  // the modal never fires (no vm rendered → nothing to dispatch → the
  // dispatch-side lockSkew arm never runs). Mirrors performRoundTrip's arm.
  it("calls adapter.showSkewLock on initial load()'s 400 stale_client response", async () => {
    const fetchSpy = stubFetch([
      // Initial GET → 400 stale_client (server global filter now enforces on GET too)
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
    expect(spy.skewLocks).toBe(1);
    expect(spy.reloads).toBe(0); // no auto-reload; user's button click will call it
    expect(onError).toHaveBeenCalledOnce();
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

describe("9.0.0 — createVersionGuard TS-server-subpath wrap (SKEW-01)", () => {
  it("mismatched header → 400 stale_client envelope BEFORE handler runs", async () => {
    let handlerRan = false;
    const handler = async (_req: Request) => {
      handlerRan = true;
      return new Response("handler-ran", { status: 200 });
    };
    const guarded = createVersionGuard({ currentBuild: "server-x" })(handler);
    const req = new Request("http://example.test/api/x", {
      headers: { "x-vms-client-build": "client-old" },
    });
    const res = await guarded(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errors[0].code).toBe("stale_client");
    expect(handlerRan).toBe(false); // guard short-circuited BEFORE handler
  });

  it("matching header → handler runs; response passes through", async () => {
    const handler = async (_req: Request) => new Response("ok", { status: 200 });
    const guarded = createVersionGuard({ currentBuild: "server-x" })(handler);
    const req = new Request("http://example.test/api/x", {
      headers: { "x-vms-client-build": "server-x" },
    });
    const res = await guarded(req);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("absent header → handler runs (agent-driven curl still works)", async () => {
    const handler = async (_req: Request) => new Response("ok", { status: 200 });
    const guarded = createVersionGuard({ currentBuild: "server-x" })(handler);
    const req = new Request("http://example.test/api/x");
    const res = await guarded(req);
    expect(res.status).toBe(200);
  });

  it("empty currentBuild → identity wrap (versioning off; behavior byte-identical)", async () => {
    const handler = async (_req: Request) => new Response("ok", { status: 200 });
    const guarded = createVersionGuard({ currentBuild: "" })(handler);
    expect(guarded).toBe(handler); // identity — same function reference
  });

  it("undefined currentBuild → identity wrap", async () => {
    const handler = async (_req: Request) => new Response("ok", { status: 200 });
    const guarded = createVersionGuard({})(handler);
    expect(guarded).toBe(handler);
  });
});

describe("9.0.0 — BrowserAdapter.showSkewLock DOM (SKEW-05)", () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Fresh document body for each test — remove any leftover .vms-skew-lock
    // from a previous test (idempotency test relies on knowing initial state).
    document.body.innerHTML = "";
    container = document.createElement("div");
    container.id = "test-container";
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Clean up modal + container.
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("mounts .vms-skew-lock backdrop + dialog with correct ARIA + sets container inert", async () => {
    const { BrowserAdapter } = await import("../src/browser.js");
    const adapter = new BrowserAdapter(container);
    adapter.showSkewLock();
    const backdrop = document.querySelector(".vms-skew-lock");
    expect(backdrop).not.toBeNull();
    const dialog = backdrop!.querySelector(".vms-skew-lock__dialog");
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("role")).toBe("dialog");
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBe("vms-skew-lock-title");
    expect(container.getAttribute("inert")).toBe("");
    // Title + body + button present with CONTEXT-locked copy.
    expect(dialog!.querySelector(".vms-skew-lock__title")?.textContent).toBe("This app is out of date");
    expect(dialog!.querySelector(".vms-skew-lock__body")?.textContent).toBe("Reload to continue. Any unsaved changes will be lost.");
    const btn = dialog!.querySelector<HTMLButtonElement>(".vms-skew-lock__reload-btn");
    expect(btn?.textContent).toBe("Reload");
  });

  it("clicking [Reload] button calls the adapter's reload() method", async () => {
    const { BrowserAdapter } = await import("../src/browser.js");
    const adapter = new BrowserAdapter(container);
    // Spy on the adapter's reload method directly — decoupled from jsdom's
    // fragile window.location.reload; matches the shipped indirection
    // (button calls this.reload(), which the shipped body forwards to
    // window.location.reload(); we assert the adapter-level call).
    const reloadSpy = vi.spyOn(adapter, "reload").mockImplementation(() => {});
    adapter.showSkewLock();
    const btn = document.querySelector<HTMLButtonElement>(".vms-skew-lock__reload-btn");
    expect(btn).not.toBeNull();
    btn!.click();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — second showSkewLock() call does NOT create a second backdrop", async () => {
    const { BrowserAdapter } = await import("../src/browser.js");
    const adapter = new BrowserAdapter(container);
    adapter.showSkewLock();
    adapter.showSkewLock();
    const all = document.querySelectorAll(".vms-skew-lock");
    expect(all.length).toBe(1);
  });

  it("does NOT dismiss on backdrop click", async () => {
    const { BrowserAdapter } = await import("../src/browser.js");
    const adapter = new BrowserAdapter(container);
    adapter.showSkewLock();
    const backdrop = document.querySelector<HTMLElement>(".vms-skew-lock");
    backdrop!.click(); // simulated backdrop click
    expect(document.querySelector(".vms-skew-lock")).not.toBeNull();
  });

  it("does NOT dismiss on Escape key", async () => {
    const { BrowserAdapter } = await import("../src/browser.js");
    const adapter = new BrowserAdapter(container);
    adapter.showSkewLock();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.querySelector(".vms-skew-lock")).not.toBeNull();
  });

  it("auto-focuses the [Reload] button for keyboard/SR accessibility", async () => {
    const { BrowserAdapter } = await import("../src/browser.js");
    const adapter = new BrowserAdapter(container);
    adapter.showSkewLock();
    const btn = document.querySelector<HTMLButtonElement>(".vms-skew-lock__reload-btn");
    expect(document.activeElement).toBe(btn);
  });
});
