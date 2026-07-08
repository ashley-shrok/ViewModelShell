// Phase 15 (NBA-06) — adapter/jsdom-level proof that a rapid double-toggle of
// the SAME checkbox never permanently reverts the rendered DOM. This is the
// "Success Criterion #2" of the Phase 15 ROADMAP entry proven at the rendered
// level, complementing nonblocking-dispatch.test.ts's internal-state-only
// proof of the same coalesce-pending discard fix
// (`this.pendingNonBlockingRefire === null` added to the non-blocking apply
// gate in `performRoundTrip`). See `.planning/design/non-blocking-actions.md`
// — "Coalescing".
//
// Uses the exact `ViewModelShell` + `BrowserAdapter` + jsdom + mocked-fetch
// pattern established in `pending-label.test.ts`, and the controllable/
// deferred-fetch pattern from `nonblocking-dispatch.test.ts` adapted so the
// test controls exact response arrival order for BOTH the checkbox's own
// dispatches.

import { describe, it, expect, vi, afterEach } from "vitest";
import { ViewModelShell, type ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

const endpoint = "/api/x";
const actionEndpoint = "/api/x/action";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

/** A page with one checkbox bound to "selected", firing a non-blocking action. */
function checkboxVm(): ViewNode {
  return {
    type: "page",
    children: [
      {
        type: "checkbox",
        name: "sel",
        bind: "selected",
        action: { name: "toggle", blocking: false },
      },
    ],
  };
}

type Deferred = { resolve: (r: Response) => void };

/**
 * The FIRST fetch call (shell.load()'s GET) resolves immediately with the
 * seed load response. Every subsequent call (a dispatch()-originated POST)
 * registers a deferred resolver so the test controls exactly when — and
 * with what body — each response arrives.
 */
function makeControllableFetch(loadBody: unknown): { fetchMock: ReturnType<typeof vi.fn>; deferreds: Deferred[] } {
  const deferreds: Deferred[] = [];
  let callCount = 0;
  const fetchMock = vi.fn(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(
        new Response(JSON.stringify(loadBody), { headers: { "content-type": "application/json" } }),
      );
    }
    return new Promise<Response>((resolve) => {
      deferreds.push({ resolve });
    });
  });
  return { fetchMock, deferreds };
}

function resolveDeferred(d: Deferred, body: unknown): void {
  d.resolve(new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }));
}

/** Reads the `_state` field of a captured fetch call's FormData body. */
function stateOf(call: unknown[]): unknown {
  const init = call[1] as { body: FormData };
  const raw = init.body.get("_state") as string;
  return JSON.parse(raw);
}

describe("Phase 15 (NBA-06) — a rapid checkbox double-toggle never permanently reverts the rendered DOM", () => {
  it("ends the interaction with .checked matching the user's last click, never the earlier stale echo", async () => {
    const { fetchMock, deferreds } = makeControllableFetch({
      vm: checkboxVm(),
      state: { selected: false },
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const container = freshContainer();
    const shell = new ViewModelShell({
      endpoint,
      actionEndpoint,
      adapter: new BrowserAdapter(container),
    });

    // 1. Initial load: seed state { selected: false }, unchecked checkbox.
    await shell.load();
    let inp = container.querySelector(".vms-checkbox__input") as HTMLInputElement;
    expect(inp).toBeTruthy();
    expect(inp.checked).toBe(false);
    expect(fetchMock.mock.calls.length).toBe(1);

    // 2. Simulate a click that CHECKS it — request A fires.
    inp.checked = true;
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    expect(fetchMock.mock.calls.length).toBe(2);

    // 3. Immediately simulate a click that UNCHECKS it — coalesces into
    // pendingNonBlockingRefire, no new fetch call.
    inp.checked = false;
    inp.dispatchEvent(new Event("change", { bubbles: true }));
    expect(fetchMock.mock.calls.length).toBe(2);

    // 4. Resolve request A's response — an echo of `selected: true`, A's own
    // stale, submitted-at-check-time value — with a fresh vm re-rendering
    // the checkbox from that state. Without the NBA-06 fix this would apply
    // and revert the DOM to checked.
    resolveDeferred(deferreds[0]!, { vm: checkboxVm(), state: { selected: true }, ok: true });
    await new Promise((r) => setTimeout(r, 0));

    // Query fresh — re-render (if any) replaces the DOM node.
    inp = container.querySelector(".vms-checkbox__input") as HTMLInputElement;
    expect(inp.checked).toBe(false);

    // 5. A 3rd fetch call has now fired — the coalesced refire, request B,
    // carrying the CORRECT/latest selected:false (the local optimistic write
    // from step 3, never clobbered because A's response was discarded).
    expect(fetchMock.mock.calls.length).toBe(3);
    expect(stateOf(fetchMock.mock.calls[2]!)).toEqual({ selected: false });

    // 6. Resolve request B's response echoing selected: false + a fresh vm.
    resolveDeferred(deferreds[1]!, { vm: checkboxVm(), state: { selected: false }, ok: true });
    await new Promise((r) => setTimeout(r, 0));

    // Query fresh once more — final state matches the user's LAST click.
    inp = container.querySelector(".vms-checkbox__input") as HTMLInputElement;
    expect(inp.checked).toBe(false);
  });
});
