// D-12.2 / D-13 adapter-level relocation proof.
//
// Parity only observes the {redirect}/{sideEffects} WIRE response (D-13) — it can
// NOT prove the core->adapter relocation from Wave 1 (Plan 01-01) actually fires.
// This net-new framework-level jsdom/vitest harness closes that gap: it feeds a
// pre-parsed response through ViewModelShell.push() -> processResponse() and asserts
// the relocated BrowserAdapter binding really executes.
//
// Imports use the local source via `.js` specifiers (NodeNext convention — the
// same way src/browser.ts imports src/index.ts), NOT the published package.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ViewModelShell, type ShellResponse, type ViewNode, type Adapter } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

const vm: ViewNode = { type: "text", value: "x" };
const state = {};
const endpoint = "/api/x";
const actionEndpoint = "/api/x/action";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("D-12.2 Case A — storage side-effects actually write to platform storage", () => {
  it("routes set-local-storage / set-session-storage through adapter.storage to real jsdom storage", () => {
    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(freshContainer()),
      endpoint,
      actionEndpoint,
    });

    const response: ShellResponse = {
      vm,
      state,
      sideEffects: [
        { type: "set-local-storage", key: "hecate_jwt", value: "tok" },
        { type: "set-session-storage", key: "draft_id", value: "d1" },
      ],
    };
    shell.push(response);

    // Proves processResponse -> adapter.storage -> real jsdom localStorage/sessionStorage.
    expect(localStorage.getItem("hecate_jwt")).toBe("tok");
    expect(sessionStorage.getItem("draft_id")).toBe("d1");
  });
});

describe("D-12.2 Case B — adapter.navigate default path (onRedirect unset)", () => {
  it("invokes BrowserAdapter.navigate with the redirect URL when no onRedirect is configured", () => {
    // jsdom does not perform a real navigation (window.location.href assignment
    // is a no-op / throws "Not implemented"), so we spy on the prototype method
    // the seam resolves to. Asserting the spy fired proves the onRedirect-absent
    // branch resolves to adapter.navigate (D-05 step 2).
    const navSpy = vi
      .spyOn(BrowserAdapter.prototype, "navigate")
      .mockImplementation(() => {});

    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(freshContainer()),
      endpoint,
      actionEndpoint,
    });

    shell.push({ vm, state, redirect: "/dashboard" });

    expect(navSpy).toHaveBeenCalledTimes(1);
    expect(navSpy).toHaveBeenCalledWith("/dashboard");
  });
});

describe("D-12.2 Case C — onRedirect precedence over adapter.navigate", () => {
  it("calls onRedirect (NOT adapter.navigate) when onRedirect is set — byte-identical to pre-refactor behavior", () => {
    const navSpy = vi
      .spyOn(BrowserAdapter.prototype, "navigate")
      .mockImplementation(() => {});
    const onRedirect = vi.fn();

    const shell = new ViewModelShell({
      adapter: new BrowserAdapter(freshContainer()),
      endpoint,
      actionEndpoint,
      onRedirect,
    });

    shell.push({ vm, state, redirect: "/login" });

    // D-04/D-05 precedence: onRedirect wins, adapter.navigate is NOT touched.
    expect(onRedirect).toHaveBeenCalledTimes(1);
    expect(onRedirect).toHaveBeenCalledWith("/login");
    expect(navSpy).not.toHaveBeenCalled();
  });
});

describe("D-12.2 Case D — fail-loud (D-06): missing capability surfaces an error, never a silent no-op", () => {
  it("surfaces a storage error via onError when the adapter omits storage", () => {
    const onError = vi.fn();
    const renderOnlyAdapter: Adapter = { render() {} };

    const shell = new ViewModelShell({
      adapter: renderOnlyAdapter,
      endpoint,
      actionEndpoint,
      onError,
    });

    shell.push({
      vm,
      state,
      sideEffects: [{ type: "set-local-storage", key: "k", value: "v" }],
    });

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("storage");
    // Regression guard for the silent-capability-failure threat (T-02-03):
    // nothing was written because the capability is absent.
    expect(localStorage.getItem("k")).toBeNull();
  });

  it("surfaces a navigate error via onError when the adapter omits navigate (and no onRedirect)", () => {
    const onError = vi.fn();
    const renderOnlyAdapter: Adapter = { render() {} };

    const shell = new ViewModelShell({
      adapter: renderOnlyAdapter,
      endpoint,
      actionEndpoint,
      onError,
    });

    shell.push({ vm, state, redirect: "/somewhere" });

    expect(onError).toHaveBeenCalledTimes(1);
    const err = onError.mock.calls[0][0] as Error;
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain("navigate");
  });
});
