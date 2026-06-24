// Soft-validation rejection — `rejected: { violations: [{path?, message, code?}] }`
// on an ok:true render. The action was refused but vm/state are still returned,
// so a wire-driving agent can distinguish a rejected write from a successful one
// without the framework forcing it onto the ok:false / errors[] failure channel.
//
// Two layers:
//   - SERVER (createAction / shellRejection): the field is emitted on ok:true
//     when set, and ABSENT when not (null-omission); errors[] is never touched.
//   - SHELL (ViewModelShell): an ok:true response carrying `rejected` is processed
//     as a normal render — onError does NOT fire, vm renders. The shell ignores
//     the field harmlessly (it is wire metadata for agents).

import { describe, it, expect, vi, afterEach } from "vitest";
import { createAction, shellRejection, type ErrorEntry } from "../src/server.js";
import { ViewModelShell, type ShellResponse, type ViewNode, type Adapter } from "../src/index.js";

const vm: ViewNode = { type: "text", value: "form" };

function jsonPost(name: string, state: unknown): Request {
  return new Request("http://test/api/x/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, state }),
  });
}

afterEach(() => vi.restoreAllMocks());

// ─── server side: createAction + shellRejection ──────────────────────────────

describe("shellRejection / createAction — emission", () => {
  it("emits rejected.violations on ok:true when the handler rejects", async () => {
    const handler = createAction<Record<string, unknown>>(async (p) => ({
      vm,
      state: p.state,
      ...shellRejection([{ path: "targets.protein", message: "must be non-negative" }]),
    }));

    const res = await handler(jsonPost("save", { x: 1 }));
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.ok).toBe(true);          // a rejection is still an ok:true render…
    expect(body.vm).toEqual(vm);          // …with the view preserved
    expect(body.state).toEqual({ x: 1 }); // …and the user's input intact
    expect(body.rejected).toEqual({
      violations: [{ path: "targets.protein", message: "must be non-negative" }],
    });
    expect(body.errors).toBeUndefined();  // never the ok:false channel
  });

  it("omits rejected entirely on a normal (non-rejecting) response", async () => {
    const handler = createAction<Record<string, unknown>>(async (p) => ({ vm, state: p.state }));
    const body = await (await handler(jsonPost("ok", { x: 1 }))).json();
    expect(body.ok).toBe(true);
    expect("rejected" in body).toBe(false); // absent, not null
  });

  it("supports a form-level violation with no path (omits path)", async () => {
    const violations: ErrorEntry[] = [{ message: "can't remove the only person" }];
    const handler = createAction<Record<string, unknown>>(async (p) => ({
      vm,
      state: p.state,
      ...shellRejection(violations),
    }));
    const body = await (await handler(jsonPost("remove", {}))).json();
    expect(body.rejected.violations).toHaveLength(1);
    expect(body.rejected.violations[0]).toEqual({ message: "can't remove the only person" });
    expect("path" in body.rejected.violations[0]).toBe(false); // path omitted, not null
  });
});

// ─── shell side: ok:true + rejected is a normal render, not an error ──────────

describe("ViewModelShell — tolerates rejected on ok:true", () => {
  it("renders normally and does NOT fire onError on an ok:true response carrying rejected", async () => {
    const renders: ViewNode[] = [];
    const adapter: Adapter = { render: (v) => { renders.push(v); } };
    const onError = vi.fn();
    const shell = new ViewModelShell({ endpoint: "/api/x", actionEndpoint: "/api/x/action", adapter, onError });

    // initial load
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ vm, state: { x: 0 } }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await shell.load();

    // dispatch returns ok:true WITH a rejected field
    const rejectedBody = {
      ok: true,
      vm: { type: "text", value: "still-here" } as ViewNode,
      state: { x: 0 },
      rejected: { violations: [{ path: "draftTitle", message: "Title is required." }] },
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(rejectedBody), { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    await shell.dispatch({ name: "create-ticket" });

    expect(onError).not.toHaveBeenCalled();                 // NOT treated as a failure
    expect(renders[renders.length - 1]).toEqual(rejectedBody.vm); // re-rendered the returned view
    expect(shell.getCurrentState()).toEqual({ x: 0 });       // state preserved
  });
});
