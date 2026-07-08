// Phase 15 (NBA-05) — real-timer proof that `ShellOptions.pollInterval`'s
// auto-scheduled poll dispatch coexists with a blocking user action instead
// of contending for the same mutex, drives through the REAL
// `setTimeout`-backed `schedulePoll` path (not a manual
// `dispatch({name:"poll"}, true)` call), and keeps rescheduling itself
// afterward. See `.planning/design/non-blocking-actions.md` and
// `viewmodel-shell/src/index.ts` (`schedulePoll`, the `pollInterval` doc).
//
// Reuses the `makeControllableFetch`/`resolveDeferred`/`actionNameOf` helpers
// from `nonblocking-dispatch.test.ts` (copied here rather than imported —
// test files don't share exports in this codebase's convention). Unlike that
// file, dispatches here are triggered by the REAL poll timer firing on its
// own schedule, so tests use real `setTimeout` waits (matching
// `busy.test.ts`'s established real-timer poll-testing convention) — no
// `vi.useFakeTimers()`.

import { describe, it, expect, vi, afterEach } from "vitest";
import { ViewModelShell, type Adapter, type ActionEvent, type ViewNode } from "../src/index.js";

afterEach(() => { vi.restoreAllMocks(); });

function makeAdapter(): { adapter: Adapter } {
  const adapter: Adapter = { render: () => {}, setBusy: () => {} };
  return { adapter };
}

const emptyVm: ViewNode = { type: "text", value: "" };

type Deferred = { resolve: (r: Response) => void };

/**
 * A controllable fetch mock: the FIRST invocation (the shell.load() GET)
 * resolves immediately with a seed response. EVERY subsequent invocation —
 * whether it's the auto-scheduled poll's own dispatch or an ordinary
 * blocking dispatch — registers a deferred resolver and returns a promise
 * that only settles when the test explicitly resolves it. This gives full
 * control over response arrival order for both the auto-poll and any
 * blocking dispatch fired while it's in flight.
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

describe("Phase 15 (NBA-05) — a blocking user action fired while an auto-scheduled poll round trip is in flight is honored, not dropped", () => {
  it("coexistence: the blocking dispatch fires immediately, and a stale poll response arriving later never clobbers it", async () => {
    const { adapter } = makeAdapter();
    const { fetchMock, deferreds } = makeControllableFetch();
    vi.stubGlobal("fetch", fetchMock);
    const shell = new ViewModelShell({
      endpoint: "/api/x",
      actionEndpoint: "/api/x/action",
      adapter,
      pollInterval: 10,
    });

    await shell.load();
    expect(fetchMock.mock.calls.length).toBe(1);

    // Wait for the REAL setTimeout-driven poll timer to fire on its own —
    // no manual `dispatch({name:"poll"}, true)` call anywhere in this test.
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock.mock.calls.length).toBe(2);
    expect(actionNameOf(fetchMock.mock.calls[1]!)).toBe("poll");

    // While the poll's response is still deferred (not yet resolved), fire
    // an ordinary blocking user dispatch.
    const blockingPromise = shell.dispatch({ name: "save" } as ActionEvent);
    // Fired immediately — NOT dropped, NOT coalesced (different lane/mutex).
    expect(fetchMock.mock.calls.length).toBe(3);
    expect(actionNameOf(fetchMock.mock.calls[2]!)).toBe("save");

    // Resolve the blocking response; it must apply.
    resolveDeferred(deferreds[1]!, { tag: "blocking-applied" });
    await blockingPromise;
    expect(shell.getCurrentState()).toEqual({ tag: "blocking-applied" });

    // NOW resolve the stale, earlier-fired poll response — it must be
    // discarded (a strictly newer, blocking response already applied).
    resolveDeferred(deferreds[0]!, { tag: "poll-stale" });
    // Let the poll's dispatch() promise settle before asserting.
    await new Promise((r) => setTimeout(r, 0));
    expect(shell.getCurrentState()).toEqual({ tag: "blocking-applied" });

    // Cleanup: the blocking response's own processResponse rescheduled
    // another poll (schedulePoll runs on every applied response) — stop it
    // so it can't fire against a later test's fetch stub.
    shell.stopPolling();
  });
});

describe("Phase 15 (NBA-05) — the poll loop keeps looping after coexisting with a user action", () => {
  it("a new automatic poll fires again after the configured interval", async () => {
    const { adapter } = makeAdapter();
    const { fetchMock, deferreds } = makeControllableFetch();
    vi.stubGlobal("fetch", fetchMock);
    const shell = new ViewModelShell({
      endpoint: "/api/x",
      actionEndpoint: "/api/x/action",
      adapter,
      pollInterval: 10,
    });

    await shell.load();
    expect(fetchMock.mock.calls.length).toBe(1);

    // First auto-poll fires on its own schedule.
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock.mock.calls.length).toBe(2);
    expect(actionNameOf(fetchMock.mock.calls[1]!)).toBe("poll");

    // A blocking user action coexists with it, and applies — this is what
    // reschedules the poll timer (processResponse -> schedulePoll) from the
    // moment the blocking response is applied.
    const blockingPromise = shell.dispatch({ name: "save" } as ActionEvent);
    expect(fetchMock.mock.calls.length).toBe(3);
    resolveDeferred(deferreds[1]!, { tag: "blocking-applied" });
    await blockingPromise;
    expect(shell.getCurrentState()).toEqual({ tag: "blocking-applied" });

    // Resolve the now-stale first poll so it doesn't dangle (discarded, per
    // the coexistence test above — irrelevant to this test's assertion).
    resolveDeferred(deferreds[0]!, { tag: "poll-stale" });
    await new Promise((r) => setTimeout(r, 0));

    // Wait another full interval: a NEW automatic poll must fire, proving
    // schedulePoll was correctly rescheduled and the timer loop is still alive.
    const callsBeforeSecondWait = fetchMock.mock.calls.length;
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchMock.mock.calls.length).toBe(callsBeforeSecondWait + 1);
    expect(actionNameOf(fetchMock.mock.calls[callsBeforeSecondWait]!)).toBe("poll");

    // Cleanup: stop the loop so it can't leak a fetch call into a later test.
    shell.stopPolling();
  });
});
