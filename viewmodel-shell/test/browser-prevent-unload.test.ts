// 0.14.0 (#18) — TableNode-independent feature: ShellResponse.preventUnload
// installs / clears the browser's `beforeunload` guard via a new optional
// Adapter capability verb. Drives long-running-action UX (the user clicks
// "go," server starts the work, returns `preventUnload: true` on every
// response while the work is pending, clears it when done).
//
// Coverage:
//   - BrowserAdapter.setPreventUnload(true) installs a `beforeunload` listener;
//     setPreventUnload(false) removes it; idempotent both ways.
//   - The shell wires it on the load response and on every dispatch response.
//   - A beforeunload event fired while active calls preventDefault (modern
//     browsers honor this to surface the "Leave site?" dialog).

import { describe, it, expect, vi, afterEach } from "vitest";
import { BrowserAdapter } from "../src/browser.js";
import { ViewModelShell, type Adapter, type ActionEvent, type ShellResponse } from "../src/index.js";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

describe("0.14.0 — BrowserAdapter.setPreventUnload", () => {
  it("install + remove via the adapter verb", () => {
    const adapter = new BrowserAdapter(freshContainer());
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");

    adapter.setPreventUnload(true);
    expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function));
    add.mockClear();

    adapter.setPreventUnload(false);
    expect(remove).toHaveBeenCalledWith("beforeunload", expect.any(Function));
  });

  it("idempotent — calling true twice installs only once", () => {
    const adapter = new BrowserAdapter(freshContainer());
    const add = vi.spyOn(window, "addEventListener");
    adapter.setPreventUnload(true);
    adapter.setPreventUnload(true);
    const beforeUnloadCalls = add.mock.calls.filter((c) => c[0] === "beforeunload");
    expect(beforeUnloadCalls).toHaveLength(1);
  });

  it("idempotent — calling false on a clean adapter is a no-op", () => {
    const adapter = new BrowserAdapter(freshContainer());
    const remove = vi.spyOn(window, "removeEventListener");
    adapter.setPreventUnload(false);
    const beforeUnloadRemoves = remove.mock.calls.filter((c) => c[0] === "beforeunload");
    expect(beforeUnloadRemoves).toHaveLength(0);
  });

  it("the installed listener calls preventDefault on a real beforeunload event", () => {
    const adapter = new BrowserAdapter(freshContainer());
    adapter.setPreventUnload(true);

    const evt = new Event("beforeunload", { cancelable: true });
    const prevented = !window.dispatchEvent(evt);
    expect(prevented).toBe(true);  // listener canceled the unload
  });
});

describe("0.14.0 — shell wires preventUnload from every response", () => {
  function makeShell(initialResponse: ShellResponse, calls: Array<boolean>): { shell: ViewModelShell; container: HTMLElement } {
    const container = freshContainer();
    const adapter: Adapter = {
      render: () => {},
      setPreventUnload: (active: boolean) => { calls.push(active); },
    };
    const shell = new ViewModelShell({
      endpoint: "/api/x",
      actionEndpoint: "/api/x/action",
      adapter,
    });
    // Mock fetch — first call is the GET load, subsequent are POST dispatches.
    const responses: ShellResponse[] = [initialResponse];
    const responseQueue = responses.slice();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: { method?: string }) => {
        const isPost = init?.method === "POST";
        const body = isPost ? responseQueue.shift() ?? responseQueue[0] : initialResponse;
        return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
      }) as unknown as typeof fetch,
    );
    return { shell, container };
  }

  it("load() calls setPreventUnload with response.preventUnload (true case)", async () => {
    const calls: boolean[] = [];
    const { shell } = makeShell(
      { vm: { type: "text", value: "" } as never, state: {}, preventUnload: true },
      calls,
    );
    await shell.load();
    expect(calls).toEqual([true]);
  });

  it("load() calls setPreventUnload(false) when the response omits the field", async () => {
    const calls: boolean[] = [];
    const { shell } = makeShell(
      { vm: { type: "text", value: "" } as never, state: {} },  // preventUnload absent
      calls,
    );
    await shell.load();
    expect(calls).toEqual([false]);
  });

  it("dispatch() applies the new preventUnload value from each response", async () => {
    const calls: boolean[] = [];
    const container = freshContainer();
    const adapter: Adapter = {
      render: () => {},
      setPreventUnload: (active: boolean) => { calls.push(active); },
    };
    const shell = new ViewModelShell({
      endpoint: "/api/x",
      actionEndpoint: "/api/x/action",
      adapter,
    });
    // First the GET (preventUnload=false), then a dispatch returning true, then a dispatch returning false.
    const queue: ShellResponse[] = [
      { vm: { type: "text", value: "" } as never, state: {} },
      { vm: { type: "text", value: "" } as never, state: {}, preventUnload: true },
      { vm: { type: "text", value: "" } as never, state: {}, preventUnload: false },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(queue.shift()), {
        headers: { "content-type": "application/json" },
      })) as unknown as typeof fetch,
    );

    await shell.load();
    expect(calls).toEqual([false]);

    await shell.dispatch({ name: "start-work" } as ActionEvent);
    expect(calls).toEqual([false, true]);

    await shell.dispatch({ name: "finish-work" } as ActionEvent);
    expect(calls).toEqual([false, true, false]);
    void container;
  });
});
