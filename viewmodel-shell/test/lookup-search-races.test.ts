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

// ─────────────────────────────────────────────────────────────────────────────
// RACE 1 — user-action-races-background
// Lane-level analog: nonblocking-dispatch.test.ts:71-135 (NBA-01, both directions)
//
// USER-VISIBLE BUG THIS PREVENTS: you type a name, and while the search is still
// in flight you click Save — and NOTHING HAPPENS. The click is swallowed with no
// error, no spinner, no signal. Or the mirror image: you click Save and the
// lookup goes dead for the rest of the round trip, so the search you type never
// reaches the server. The two lanes must coexist; a background question must
// never eat the user's own action, and vice versa.
// ─────────────────────────────────────────────────────────────────────────────

describe("RACE 1 — a user action fires while a search is in flight (and vice versa)", () => {
  it("direction A — a search is in flight; the user clicks Save; the click is NOT dropped", async () => {
    const t = setup();
    await t.load();

    t.type("sa");
    await t.flushSearch();
    expect(t.fetchMock.mock.calls.length).toBe(2); // load + the in-flight search

    // The search response has NOT arrived. The user clicks Save anyway.
    await t.clickSave();

    // The click must have reached the network. If the search had (wrongly) taken
    // the BLOCKING lane, `blockingInFlight` would have swallowed this silently.
    expect(t.fetchMock.mock.calls.length).toBe(3);
    expect(actionNameOf(t.fetchMock.mock.calls[2]!)).toBe("save");

    // ...and the user's action actually applies.
    await t.resolveSave(1, { value: "7", label: "Sara Vance" });
    expect(t.input().value).toBe("Sara Vance");
  });

  it("direction B — a blocking Save is in flight; the user types; the search is NOT swallowed", async () => {
    const t = setup();
    await t.load();

    await t.clickSave();
    expect(t.fetchMock.mock.calls.length).toBe(2); // load + the in-flight Save

    // The Save is still in flight. The user keeps typing — which a real user
    // absolutely does: `.vms-busy` sets `pointer-events: none`, and that does
    // NOT stop a keyboard from typing into an already-focused input.
    t.type("sa");
    await t.flushSearch();

    // The search must still have gone out — the non-blocking lane does not
    // contend for the blocking mutex.
    expect(t.fetchMock.mock.calls.length).toBe(3);
    expect(actionNameOf(t.fetchMock.mock.calls[2]!)).toBe("search-owner");
    expect(stateOf(t.fetchMock.mock.calls[2]!).ownerQuery).toBe("sa");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RACE 2 — background-resolves-first
// Lane-level analog: nonblocking-dispatch.test.ts:258-292 (CR-02)
//
// USER-VISIBLE BUG THIS PREVENTS: 🚨 THE USER'S OWN CLICK SILENTLY VANISHES.
// You click Save; a background search that you triggered a moment earlier
// happens to come back FIRST; and your Save — slower, but authoritative — is
// discarded as "stale" because a later-fired request already advanced the epoch.
// No error, no signal. This is one of the THREE ship-blocking defects the v4.2
// lane build actually shipped, found only by tracing this exact interleaving.
// The fix was making the epoch LANE-AWARE: a blocking response always applies.
// ─────────────────────────────────────────────────────────────────────────────

describe("RACE 2 — a background search resolves BEFORE a slower blocking user action", () => {
  it("the user's pick is authoritative and is NOT clobbered by the earlier-resolving search", async () => {
    const t = setup();
    await t.load();

    // The user clicks Save FIRST — so it holds the LOWER seq. (This ordering is
    // the whole point: if the blocking dispatch were the newer one, a
    // seq-gated apply would let it through by accident and the test would pass
    // for the wrong reason.)
    await t.clickSave();
    expect(t.fetchMock.mock.calls.length).toBe(2); // deferreds[0] = save, seq N

    // ...then types, firing a search with a HIGHER seq while Save is still out.
    t.type("sa");
    await t.flushSearch();
    expect(t.fetchMock.mock.calls.length).toBe(3); // deferreds[1] = search, seq N+1

    // 🚨 SCRIPTED OUT-OF-ORDER ARRIVAL: the LATER-fired search comes back FIRST.
    await t.resolveSearch(1, "sa", [{ value: "1", label: "Sara Vance" }]);
    expect(t.optionLabels()).toEqual(["Sara Vance"]); // the search did apply

    // ...and the EARLIER-fired blocking Save lands second. It must still apply:
    // it is the user's own action, and at most one blocking dispatch is ever in
    // flight, so it can never be superseded by another blocking response.
    await t.resolveSave(0, { value: "7", label: "Priya Raman" });

    // The user's pick won. If the blocking arm were seq-gated like the
    // non-blocking one, this would still read "sa" — the click, vanished.
    expect(t.input().value).toBe("Priya Raman");
    // ...and a dropped user action must never be silent, so nothing should have
    // been reported as an error either.
    expect(t.onError).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RACE 3 — rapid-fire-supersede
// Lane-level analog: nonblocking-dispatch.test.ts:137-169 (NBA-02)
//
// USER-VISIBLE BUG THIS PREVENTS: a fast typist fires a request per word, and an
// implementation that QUEUES them (rather than overwriting) sends every
// abandoned query to the server and then replays their answers into the popup
// one by one — the list visibly churns through stale results before settling.
// It is also the T-21-17 DoS: N keystroke-bursts = N round trips against a
// 5,000-person directory. At most ONE extra round trip may fire, and it must
// carry the LATEST query.
// ─────────────────────────────────────────────────────────────────────────────

describe("RACE 3 — three rapid searches while the first is in flight", () => {
  it("produces exactly ONE coalesced re-fire carrying the LATEST query, never a queue of three", async () => {
    const t = setup();
    await t.load();

    // Search 1 fires and stays in flight.
    t.type("s");
    await t.flushSearch();
    expect(t.fetchMock.mock.calls.length).toBe(2);
    expect(stateOf(t.fetchMock.mock.calls[1]!).ownerQuery).toBe("s");

    // Two more searches, each separated by a FULL debounce window so each
    // genuinely reaches the lane. (If they were inside one debounce window this
    // would be testing the DEBOUNCE, not the coalesce — a different mechanism.)
    t.type("sa");
    await t.flushSearch();
    t.type("sar");
    await t.flushSearch();

    // 🚨 THE COALESCE: neither fired its own request. Overwrite, never append.
    expect(t.fetchMock.mock.calls.length).toBe(2);

    // Resolving the in-flight search triggers the ONE coalesced re-fire. Search
    // 1's own response is DISCARDED (a re-fire is queued), so "s"'s results
    // never flicker into the popup on their way past.
    await t.resolveSearch(0, "s", [{ value: "9", label: "STALE — query 's'" }]);
    expect(t.optionLabels()).not.toContain("STALE — query 's'");

    // Exactly ONE additional fetch — never three.
    expect(t.fetchMock.mock.calls.length).toBe(3);
    // ...and it carries the LATEST query. NOTE: for a lookup, "latest wins"
    // comes from `_state` being read FRESH at fire time — not from the action,
    // which is the identical `search-owner` on every keystroke. So the query is
    // the only thing that can prove it, and this is the assertion that does.
    expect(actionNameOf(t.fetchMock.mock.calls[2]!)).toBe("search-owner");
    expect(stateOf(t.fetchMock.mock.calls[2]!).ownerQuery).toBe("sar");

    // The popup ends up showing the LATEST query's candidates. (A POSITIVE
    // assertion on purpose — it pins the flush seam. A suite of only negative
    // "did not show" assertions would pass vacuously if the drain regressed.)
    await t.resolveSearch(1, "sar", [{ value: "3", label: "Sarah Connor" }]);
    expect(t.optionLabels()).toEqual(["Sarah Connor"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RACE 4 — stale-arrives-late
// Lane-level analog: nonblocking-dispatch.test.ts:170-200 (NBA-03)
//
// USER-VISIBLE BUG THIS PREVENTS: 🚨 "TYPE 'sar', SEE RESULTS FOR 'sa'."
// The single most user-visible race in any typeahead: a slow response for a
// query you have already abandoned lands after a newer one and overwrites the
// popup with wrong answers. react-select guards it (`if (request !==
// lastRequest.current) return;`); PrimeReact ships it. Two forms below.
// ─────────────────────────────────────────────────────────────────────────────

describe("RACE 4 — a superseded search response arrives late", () => {
  it("form A — a stale search response that lands AFTER a newer blocking response is discarded", async () => {
    const t = setup();
    await t.load();

    // The search fires FIRST (lower seq) and is slow.
    t.type("sa");
    await t.flushSearch();
    expect(t.fetchMock.mock.calls.length).toBe(2); // deferreds[0] = search, seq N

    // The user gives up waiting and picks/saves — a newer, blocking round trip.
    await t.clickSave();
    expect(t.fetchMock.mock.calls.length).toBe(3); // deferreds[1] = save, seq N+1

    // 🚨 SCRIPTED OUT-OF-ORDER ARRIVAL: the NEWER (blocking) response lands first.
    await t.resolveSave(1, { value: "7", label: "Priya Raman" });
    expect(t.input().value).toBe("Priya Raman");

    // ...and the older search's answer crawls in afterwards. It is stale: a
    // strictly newer dispatch already applied.
    await t.resolveSearch(0, "sa", [{ value: "1", label: "STALE — Sara Vance" }]);

    // It must NOT have clobbered the newer render. The user's pick stands and
    // no ghost candidates appear under it.
    expect(t.input().value).toBe("Priya Raman");
    expect(t.optionLabels()).not.toContain("STALE — Sara Vance");
    expect(t.optionLabels()).toEqual([]);
  });

  it("form B — 'type sar, see results for sa': the abandoned query's answer never reaches the popup", async () => {
    const t = setup();
    await t.load();

    // The user types "sa"; the search goes out and is slow.
    t.type("sa");
    await t.flushSearch();
    expect(t.fetchMock.mock.calls.length).toBe(2);

    // They keep typing — "sar". This coalesces behind the in-flight "sa".
    t.type("sar");
    await t.flushSearch();
    expect(t.fetchMock.mock.calls.length).toBe(2);

    // "sa"'s answer arrives. The user has ALREADY abandoned that query, and a
    // re-fire carrying "sar" is queued right behind it. Showing "sa"'s results
    // now is exactly the bug: the popup would fill with answers to a question
    // the user has visibly moved on from.
    await t.resolveSearch(0, "sa", [
      { value: "1", label: "Sara Vance" },
      { value: "2", label: "Samuel Ortiz" },
    ]);

    // 🚨 THE ASSERTION THIS RACE EXISTS FOR.
    expect(t.optionLabels()).not.toContain("Sara Vance");
    expect(t.optionLabels()).not.toContain("Samuel Ortiz");

    // The re-fire went out carrying "sar"...
    expect(t.fetchMock.mock.calls.length).toBe(3);
    expect(stateOf(t.fetchMock.mock.calls[2]!).ownerQuery).toBe("sar");

    // ...and ITS answer is what the user sees. (Positive assertion — see RACE 3.)
    await t.resolveSearch(1, "sar", [{ value: "3", label: "Sarah Connor" }]);
    expect(t.optionLabels()).toEqual(["Sarah Connor"]);
  });
});
