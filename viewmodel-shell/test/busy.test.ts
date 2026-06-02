// 0.16.0 — ShellResponse.busy + Adapter.setBusy. Two cases the lockout covers:
//   (a) per-round-trip implicit busy — user-initiated dispatch in flight, the
//       shell flips setBusy(true) immediately so rapid clicks during the
//       round-trip don't reach interactive elements (the rapid-checkbox bug).
//   (b) server-driven explicit busy — response.busy=true holds the lockout on
//       across polls until a later response clears it. User-initiated
//       dispatches are dropped while busy; polls bypass.

import { describe, it, expect, vi, afterEach } from "vitest";
import { ViewModelShell, type Adapter, type ActionEvent, type ShellResponse } from "../src/index.js";

afterEach(() => { vi.restoreAllMocks(); });

function makeAdapter(): { adapter: Adapter; calls: boolean[] } {
  const calls: boolean[] = [];
  const adapter: Adapter = {
    render: () => {},
    setBusy: (active: boolean) => { calls.push(active); },
  };
  return { adapter, calls };
}

function stubFetch(queue: ShellResponse[]): ReturnType<typeof vi.fn> {
  const responses = queue.slice();
  return vi.fn(async () =>
    new Response(JSON.stringify(responses.shift()), {
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as ReturnType<typeof vi.fn>;
}

const emptyVm = { type: "text", value: "" } as never;

describe("0.16.0 — implicit per-round-trip busy", () => {
  it("user dispatch flips setBusy(true) at start and setBusy(false) at end", async () => {
    const { adapter, calls } = makeAdapter();
    vi.stubGlobal("fetch", stubFetch([
      { vm: emptyVm, state: {} },          // initial load
      { vm: emptyVm, state: {} },          // dispatch response
    ]));
    const shell = new ViewModelShell({ endpoint: "/api/x", actionEndpoint: "/api/x/action", adapter });
    await shell.load();
    expect(calls).toEqual([false]); // load response — server not busy

    await shell.dispatch({ name: "go" } as ActionEvent);
    // start: setBusy(true) (userDispatching); response: setBusy(false); finally: setBusy(false)
    // We don't care about each intermediate value, just that it ended false and
    // saw a `true` at some point.
    expect(calls.some((v) => v === true)).toBe(true);
    expect(calls[calls.length - 1]).toBe(false);
  });

  it("polls (silent dispatches) do NOT toggle setBusy", async () => {
    const { adapter, calls } = makeAdapter();
    vi.stubGlobal("fetch", stubFetch([
      { vm: emptyVm, state: {} },                       // initial load
      { vm: emptyVm, state: {}, busy: true, nextPollIn: 1 },   // start long action (user dispatch)
      { vm: emptyVm, state: {}, busy: true, nextPollIn: 1 },   // poll 1 — silent
      { vm: emptyVm, state: {} },                       // poll 2 — silent, work done
    ]));
    const shell = new ViewModelShell({ endpoint: "/api/x", actionEndpoint: "/api/x/action", adapter });
    await shell.load();
    await shell.dispatch({ name: "start-long" } as ActionEvent);

    // Wait for polls. Use a small delay since pollInterval is 1ms.
    await new Promise((r) => setTimeout(r, 50));

    // The class went on (busy=true) and eventually came off (final response busy=false).
    expect(calls.some((v) => v === true)).toBe(true);
    expect(calls[calls.length - 1]).toBe(false);
  });
});

describe("0.16.0 — explicit server-driven busy", () => {
  it("response.busy=true keeps the class on across polls; dispatches dropped", async () => {
    const { adapter, calls } = makeAdapter();
    const fetchSpy = stubFetch([
      { vm: emptyVm, state: {} },                       // load
      { vm: emptyVm, state: {}, busy: true },           // dispatch sets busy
    ]);
    vi.stubGlobal("fetch", fetchSpy);
    const shell = new ViewModelShell({ endpoint: "/api/x", actionEndpoint: "/api/x/action", adapter });
    await shell.load();
    await shell.dispatch({ name: "start-work" } as ActionEvent);

    // Shell is now server-busy. A user dispatch must be dropped (no fetch).
    const before = fetchSpy.mock.calls.length;
    await shell.dispatch({ name: "user-click" } as ActionEvent);
    expect(fetchSpy.mock.calls.length).toBe(before);

    // Busy is still on.
    expect(calls[calls.length - 1]).toBe(true);
  });

  it("the next non-busy response clears the lockout", async () => {
    const { adapter, calls } = makeAdapter();
    vi.stubGlobal("fetch", stubFetch([
      { vm: emptyVm, state: {} },
      { vm: emptyVm, state: {}, busy: true },
    ]));
    const shell = new ViewModelShell({ endpoint: "/api/x", actionEndpoint: "/api/x/action", adapter });
    await shell.load();
    await shell.dispatch({ name: "start-work" } as ActionEvent);
    expect(calls[calls.length - 1]).toBe(true);

    // Server pushes a non-busy response (e.g. via shell.push from SSE).
    shell.push({ vm: emptyVm, state: {} } as ShellResponse);
    expect(calls[calls.length - 1]).toBe(false);
  });
});
