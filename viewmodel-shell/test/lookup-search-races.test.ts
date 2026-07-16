// Phase 21 (LOOK-02) — THE FOUR ADVERSARIAL INTERLEAVINGS.
//
// 🚨 WHY THIS FILE EXISTS. `test/lookup-search-dispatch.test.ts` proves the
// CADENCE (debounce, forcing, empty query). `test/nonblocking-dispatch.test.ts`
// proves the LANE (coalesce, epoch, discard). Neither proves the COMPOSITION,
// and the composition is where this phase can break:
//
//     keystroke → 300ms debounce → renderer-forced blocking:false → lane → popup
//
// Every link in that chain is new; only the last one was previously proven. The
// banked lesson (`.planning/design/lookup-field.md` D4) is blunt: the v4.2 lane
// build shipped THREE ship-blocking defects that were found ONLY by tracing
// specific two-round-trip interleavings — never by reading the code, never by a
// passing suite. **A green suite that does not SCRIPT the interleaving proves
// NOTHING about the race.**
//
// 🚨 THE RULE THIS FILE OBEYS: NO TEST HERE MAY CALL THE SHELL'S DISPATCH
// METHOD DIRECTLY. A test that dispatches directly re-tests Phase 14 and says
// nothing about Phase 21. Every search in this file is produced by TYPING into
// the rendered input and advancing the real debounce timer; every user action is
// produced by CLICKING the rendered button. That is the whole point.
// (Deliberately not spelled `shell` + `.` + `dispatch(` anywhere in this file —
// the plan's acceptance gate greps for that literal, and a doc comment naming it
// would false-fail a guard that exists to catch a real call.)
//
// 🚨 THE TECHNIQUE IS NEW IN THIS REPO: fake timers (to drive the 300ms
// debounce deterministically) COMBINED with a deferred fetch (to control the
// arrival ORDER of responses). `nonblocking-dispatch.test.ts` uses deferred
// fetch with REAL timers; every other suite uses fake timers with no deferred
// fetch. No existing test does both. See `flushSearch`/`resolveSearch` below —
// the flush seam is load-bearing and is commented where it lives.

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { ViewModelShell, type ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

// 🚨 CAPTURED AT MODULE LOAD, BEFORE `vi.useFakeTimers()` EVER RUNS (it runs in
// beforeEach; module top-level runs first). This is the ONLY real timer left in
// the file, and `realTick()` below is the reason the whole harness works. Do not
// move this into a hook — a captured fake would deadlock every test.
const realSetTimeout = globalThis.setTimeout;

/** Must match browser.ts's `SEARCH_DEBOUNCE_MS`. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * 🚨 A REAL macrotask turn. THIS IS NOT AN "UNNECESSARY AWAIT" — DO NOT DELETE.
 *
 * Fake timers make `setTimeout` synchronous under `advanceTimersByTime`, but the
 * dispatch the debounce fires is ASYNC: it awaits `fetch`, then `res.json()`
 * (which drains a ReadableStream through several microtask hops), then applies
 * the response and re-renders. None of that has run when `advanceTimersByTime`
 * returns. Awaiting a single `Promise.resolve()` is NOT enough — it drains one
 * microtask, not the stream.
 *
 * Yielding to a REAL macrotask lets the entire microtask backlog drain, so by
 * the time this resolves the DOM actually reflects the response.
 *
 * Delete this and all four races below become no-ops that STILL PASS — they
 * would assert on a popup that never had a chance to update. That is precisely
 * the "green decoration on the code that most needs a red light" failure this
 * file exists to prevent (T-21-18).
 */
function realTick(): Promise<void> {
  return new Promise<void>((resolve) => { realSetTimeout(resolve, 0); });
}

type Deferred = { resolve: (r: Response) => void };
type Candidate = { value: string; label?: string };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

/**
 * Copied wholesale from `test/nonblocking-dispatch.test.ts` (:36-53) — its
 * header explains why the mock defers: unlike busy.test.ts's `stubFetch` (which
 * auto-resolves in FIFO order), scripting an interleaving needs MANUAL,
 * OUT-OF-ORDER control over exactly when each response arrives.
 *
 * The FIRST call (the `shell.load()` GET) resolves immediately with the seed
 * page. EVERY subsequent call parks a deferred resolver the test settles by
 * hand — which is what makes "resolve deferreds[1] BEFORE deferreds[0]" a thing
 * a test can say.
 */
function makeControllableFetch(seed: unknown): {
  fetchMock: ReturnType<typeof vi.fn>;
  deferreds: Deferred[];
} {
  const deferreds: Deferred[] = [];
  let callCount = 0;
  const fetchMock = vi.fn(() => {
    callCount++;
    if (callCount === 1) return Promise.resolve(jsonResponse(seed));
    return new Promise<Response>((resolve) => { deferreds.push({ resolve }); });
  });
  return { fetchMock, deferreds };
}

/** The lookup page: the combobox under test + a plain BLOCKING button next to it. */
function lookupPage(over: {
  candidates?: Candidate[];
  selected?: Candidate[];
} = {}): ViewNode {
  return {
    type: "page",
    children: [
      {
        type: "field",
        name: "owner",
        label: "Owner",
        inputType: "lookup",
        bind: "ownerId",
        searchBind: "ownerQuery",
        searchAction: { name: "search-owner" },
        candidates: over.candidates ?? [],
        ...(over.selected ? { selected: over.selected } : {}),
      },
      // An ORDINARY user action. It declares no `blocking` field, so it takes
      // the BLOCKING lane — exactly as any real ButtonNode does.
      { type: "button", label: "Save", action: { name: "save" } },
    ],
  } as unknown as ViewNode;
}

/** The `_state` body of a captured fetch call — what the request actually sent. */
function stateOf(call: unknown[]): Record<string, unknown> {
  const init = call[1] as { body: FormData };
  return JSON.parse(init.body.get("_state") as string) as Record<string, unknown>;
}

/** The `_action` name of a captured fetch call. */
function actionNameOf(call: unknown[]): string {
  const init = call[1] as { body: FormData };
  return (JSON.parse(init.body.get("_action") as string) as { name: string }).name;
}

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const adapter = new BrowserAdapter(container);
  const seedState = { ownerId: "", ownerQuery: "" };
  const { fetchMock, deferreds } = makeControllableFetch({
    vm: lookupPage(), state: seedState, ok: true,
  });
  vi.stubGlobal("fetch", fetchMock);
  const onError = vi.fn();
  const shell = new ViewModelShell({
    endpoint: "/api/x", actionEndpoint: "/api/x/action", adapter, onError,
  });

  const input = () => container.querySelector<HTMLInputElement>("input.vms-field__input")!;
  const popup = () => container.querySelector<HTMLElement>(".vms-field__popup")!;

  return {
    container, shell, fetchMock, deferreds, onError,

    /** The GET. After this the lookup is rendered and interactive. */
    async load(): Promise<void> {
      await shell.load();
      await realTick();
    },

    /** Type the way a user does: set the value, fire `input`. NOT a dispatch. */
    type(value: string): void {
      const inp = input();
      inp.value = value;
      inp.dispatchEvent(new Event("input", { bubbles: true }));
    },

    /**
     * Advance the 300ms query debounce so the search actually fires, then drain
     * (see `realTick`). After this the search's fetch call is observable.
     */
    async flushSearch(): Promise<void> {
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      await realTick();
    },

    /** Click Save — an ordinary BLOCKING user action, driven through the DOM. */
    async clickSave(): Promise<void> {
      const btn = Array.from(container.querySelectorAll("button"))
        .find((b) => b.textContent === "Save")!;
      btn.click();
      await realTick();
    },

    /**
     * Settle deferred `i` with a search result, then drain so the applied render
     * is observable in the DOM (see `realTick` — the drain is load-bearing).
     */
    async resolveSearch(i: number, query: string, candidates: Candidate[]): Promise<void> {
      this.deferreds[i]!.resolve(jsonResponse({
        vm: lookupPage({ candidates }),
        state: { ownerId: "", ownerQuery: query },
        ok: true,
      }));
      await realTick();
    },

    /** Settle deferred `i` with "the user's pick was saved" — the blocking answer. */
    async resolveSave(i: number, picked: Candidate): Promise<void> {
      this.deferreds[i]!.resolve(jsonResponse({
        // `ownerQuery` is ABSENT, so the input renders `selected`'s label (D1:
        // the label is VIEW, read only from `selected`) — i.e. the box shows the
        // person the user picked. That is the user-visible fact these races are
        // about.
        vm: lookupPage({ selected: [picked], candidates: [] }),
        state: { ownerId: picked.value },
        ok: true,
      }));
      await realTick();
    },

    input, popup,
    /** What the user SEES in the popup. The assertions are about this — never
     *  about `appliedSeq` or any other shell internal, which would just re-test
     *  the lane instead of the composition. */
    optionLabels: (): string[] =>
      Array.from(container.querySelectorAll<HTMLElement>(".vms-field__option"))
        .map((el) => el.textContent ?? ""),
  };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// THE HARNESS ITSELF — proven able to drive a real search before any race
// leans on it.
// ─────────────────────────────────────────────────────────────────────────────

describe("harness — the fake-timers + deferred-fetch seam actually drives field()'s search path", () => {
  it("typing + advancing the debounce produces exactly one fetch beyond the initial load", async () => {
    const t = setup();
    await t.load();
    expect(t.fetchMock.mock.calls.length).toBe(1); // the GET only

    t.type("sa");
    // Not yet — the debounce has not elapsed.
    expect(t.fetchMock.mock.calls.length).toBe(1);

    await t.flushSearch();
    expect(t.fetchMock.mock.calls.length).toBe(2);
    expect(actionNameOf(t.fetchMock.mock.calls[1]!)).toBe("search-owner");
    // The query round-trips via searchBind — the server can see what was typed.
    expect(stateOf(t.fetchMock.mock.calls[1]!).ownerQuery).toBe("sa");
  });

  it("a resolved search response reaches the POPUP the user sees", async () => {
    const t = setup();
    await t.load();
    t.type("sa");
    await t.flushSearch();

    // Nothing is in the popup until the response actually lands.
    expect(t.optionLabels()).toEqual([]);

    await t.resolveSearch(0, "sa", [{ value: "1", label: "Sara Vance" }]);
    expect(t.optionLabels()).toEqual(["Sara Vance"]);
    // ...and the popup is OPEN, so the results are not delivered invisibly.
    expect(t.popup().hidden).toBe(false);
  });
});
