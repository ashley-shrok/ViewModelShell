// Phase 14 (NBA-01/02/03) — the two-lane dispatch loop replacing the single
// `dispatching` mutex. See `.planning/design/non-blocking-actions.md` and
// `viewmodel-shell/src/index.ts` (blockingInFlight / nonBlockingInFlight /
// pendingNonBlockingRefire / dispatchSeq / appliedSeq).
//
// Unlike busy.test.ts's `stubFetch` (which auto-resolves in FIFO order),
// these tests need MANUAL, OUT-OF-ORDER control over exactly when each
// dispatch's response arrives — so the fetch mock here defers every
// post-load call until the test explicitly resolves it.

import { describe, it, expect, vi, afterEach } from "vitest";
import { ViewModelShell, type Adapter, type ActionEvent, type ViewNode } from "../src/index.js";

afterEach(() => { vi.restoreAllMocks(); });

function makeAdapter(): { adapter: Adapter; renders: unknown[] } {
  const renders: unknown[] = [];
  const adapter: Adapter = {
    render: (_vm, _onAction, _sa) => { renders.push(_vm); },
    setBusy: () => {},
  };
  return { adapter, renders };
}

const emptyVm: ViewNode = { type: "text", value: "" };

type Deferred = { resolve: (r: Response) => void };

/**
 * A controllable fetch mock: the FIRST invocation (the shell.load() GET)
 * resolves immediately with a seed response. EVERY subsequent invocation
 * (a dispatch()-originated POST) registers a deferred resolver and returns
 * a promise that only settles when the test calls `resolveDeferred`. This
 * lets a test fire several dispatches back-to-back and control the exact
 * order responses arrive in.
 */
function makeControllableFetch(): { fetchMock: ReturnType<typeof vi.fn>; deferreds: Deferred[] } {
  const deferreds: Deferred[] = [];
  let callCount = 0;
  const fetchMock = vi.fn(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(
        new Response(JSON.stringify({ vm: emptyVm, state: {}, ok: true }), {
          headers: { "content-type": "application/json" },
        }),
      );
    }
    return new Promise<Response>((resolve) => {
      deferreds.push({ resolve });
    });
  });
  return { fetchMock, deferreds };
}

function resolveDeferred(d: Deferred, state: unknown): void {
  d.resolve(
    new Response(JSON.stringify({ vm: emptyVm, state, ok: true }), {
      headers: { "content-type": "application/json" },
    }),
  );
}

/** Reads the `.name` of the action carried by a captured fetch call's FormData body. */
function actionNameOf(call: unknown[]): string {
  const init = call[1] as { body: FormData };
  const raw = init.body.get("_action") as string;
  return (JSON.parse(raw) as { name: string }).name;
}

describe("Phase 14 (NBA-01) — coexistence: blocking and non-blocking lanes don't drop each other", () => {
  it("direction A — a blocking dispatch fires while a non-blocking one is in flight (not dropped)", async () => {
    const { adapter } = makeAdapter();
    const { fetchMock, deferreds } = makeControllableFetch();
    vi.stubGlobal("fetch", fetchMock);
    const shell = new ViewModelShell({ endpoint: "/api/x", actionEndpoint: "/api/x/action", adapter });
    await shell.load();
    expect(fetchMock.mock.calls.length).toBe(1);

    // Fire a non-blocking dispatch WITHOUT awaiting — its fetch call fires
    // synchronously (no other await precedes it in the dispatch path).
    const p1 = shell.dispatch({ name: "refresh", blocking: false } as ActionEvent);
    expect(fetchMock.mock.calls.length).toBe(2);

    // While it is still in flight, fire an ordinary blocking dispatch.
    const p2 = shell.dispatch({ name: "save" } as ActionEvent);
    expect(fetchMock.mock.calls.length).toBe(3); // NOT dropped

    resolveDeferred(deferreds[0]!, { tag: "nb" });
    resolveDeferred(deferreds[1]!, { tag: "blocking" });
    await p1;
    await p2;
  });

  it("direction B — a non-blocking dispatch fires while a blocking one is in flight (not dropped)", async () => {
    const { adapter } = makeAdapter();
    const { fetchMock, deferreds } = makeControllableFetch();
    vi.stubGlobal("fetch", fetchMock);
    const shell = new ViewModelShell({ endpoint: "/api/x", actionEndpoint: "/api/x/action", adapter });
    await shell.load();
    expect(fetchMock.mock.calls.length).toBe(1);

    // Fire an ordinary blocking dispatch WITHOUT awaiting.
    const p1 = shell.dispatch({ name: "save" } as ActionEvent);
    expect(fetchMock.mock.calls.length).toBe(2);

    // While it is still in flight, fire a non-blocking dispatch.
    const p2 = shell.dispatch({ name: "refresh", blocking: false } as ActionEvent);
    expect(fetchMock.mock.calls.length).toBe(3); // NOT dropped

    resolveDeferred(deferreds[0]!, { tag: "blocking" });
    resolveDeferred(deferreds[1]!, { tag: "nb" });
    await p1;
    await p2;
  });

  it("no regression — a second blocking dispatch while one is already in flight is dropped", async () => {
    const { adapter } = makeAdapter();
    const { fetchMock, deferreds } = makeControllableFetch();
    vi.stubGlobal("fetch", fetchMock);
    const shell = new ViewModelShell({ endpoint: "/api/x", actionEndpoint: "/api/x/action", adapter });
    await shell.load();

    const p1 = shell.dispatch({ name: "save" } as ActionEvent);
    expect(fetchMock.mock.calls.length).toBe(2);

    // A second blocking dispatch while the first is in flight: no new fetch.
    const p2 = shell.dispatch({ name: "save-again" } as ActionEvent);
    expect(fetchMock.mock.calls.length).toBe(2);

    resolveDeferred(deferreds[0]!, { tag: "blocking" });
    await p1;
    await p2; // dropped early — resolves without ever touching fetch
  });
});

describe("Phase 14 (NBA-02) — coalescing: rapid non-blocking triggers collapse to one extra round trip, latest wins", () => {
  it("three rapid non-blocking triggers produce exactly one coalesced re-fire carrying the latest action", async () => {
    const { adapter } = makeAdapter();
    const { fetchMock, deferreds } = makeControllableFetch();
    vi.stubGlobal("fetch", fetchMock);
    const shell = new ViewModelShell({ endpoint: "/api/x", actionEndpoint: "/api/x/action", adapter });
    await shell.load();

    const p1 = shell.dispatch({ name: "refresh-1", blocking: false } as ActionEvent);
    expect(fetchMock.mock.calls.length).toBe(2); // load + refresh-1

    // While refresh-1 is in flight, fire two more rapid non-blocking triggers.
    const p2 = shell.dispatch({ name: "refresh-2", blocking: false } as ActionEvent);
    const p3 = shell.dispatch({ name: "refresh-3", blocking: false } as ActionEvent);
    // No new fetch for either — coalesced into pendingNonBlockingRefire, never queued.
    expect(fetchMock.mock.calls.length).toBe(2);

    // Resolve the in-flight one; this triggers the ONE coalesced re-fire.
    resolveDeferred(deferreds[0]!, { tag: "r1" });
    await p1;
    await p2;
    await p3;

    // Exactly one additional fetch call fired (never three).
    expect(fetchMock.mock.calls.length).toBe(3);
    // ...and it carries the LATEST trigger (refresh-3), never refresh-2.
    expect(actionNameOf(fetchMock.mock.calls[2]!)).toBe("refresh-3");

    // Resolve the coalesced re-fire so nothing is left dangling.
    resolveDeferred(deferreds[1]!, { tag: "r3" });
  });
});

describe("Phase 14 (NBA-03) — epoch: a stale/out-of-order response is discarded, not applied", () => {
  it("a late non-blocking response that resolves after a newer blocking one is discarded", async () => {
    const { adapter } = makeAdapter();
    const { fetchMock, deferreds } = makeControllableFetch();
    vi.stubGlobal("fetch", fetchMock);
    const shell = new ViewModelShell({ endpoint: "/api/x", actionEndpoint: "/api/x/action", adapter });
    await shell.load();

    // Fire the non-blocking one first (seq N) — still in flight.
    const p1 = shell.dispatch({ name: "refresh", blocking: false } as ActionEvent);
    expect(fetchMock.mock.calls.length).toBe(2);

    // Fire the blocking one second (seq N+1) — also in flight.
    const p2 = shell.dispatch({ name: "save" } as ActionEvent);
    expect(fetchMock.mock.calls.length).toBe(3);

    // Resolve the BLOCKING one (the newer dispatch) FIRST.
    resolveDeferred(deferreds[1]!, { tag: "blocking" });
    await p2;
    expect(shell.getCurrentState()).toEqual({ tag: "blocking" });

    // Resolve the earlier-fired non-blocking one SECOND — it is now stale
    // (its seq is lower than the highest already-applied seq).
    resolveDeferred(deferreds[0]!, { tag: "stale-nb" });
    await p1;

    // The stale response must NOT have overwritten the newer applied render.
    expect(shell.getCurrentState()).toEqual({ tag: "blocking" });
  });
});
