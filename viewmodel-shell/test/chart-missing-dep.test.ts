// Phase 18 (CHARTBASE-03) — ChartNode FAIL-LOUD on a missing optional chart.js.
//
// The capability-seam rule (AGENTS.md): a capability with no safe default that
// is invoked without its means FAILS LOUD, never a silent no-op. For ChartNode
// that means: a ChartNode rendered while `chart.js` is absent must surface an
// Error through the sanctioned seam (the adapter holds no onError, so the
// AGENTS.md-sanctioned fallback is console.error), NOT a swallowed blank and NOT
// a floating unhandled rejection.
//
// This lives in its own file because it needs `import("chart.js")` to REJECT —
// simulated by a vi.mock factory that throws. vitest isolates module mocks per
// FILE, so mocking chart.js as "missing" here cannot affect chart.test.ts (where
// it resolves to a working fake). The assertion is DETERMINISTIC: spy the seam
// (console.error) and assert it fired with a chart.js message after a flush — no
// reliance on catching a flaky floating unhandled rejection.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BrowserAdapter } from "../src/browser.js";

// Simulate chart.js NOT installed: the dynamic import rejects.
vi.mock("chart.js", () => {
  throw new Error("Cannot find module 'chart.js'");
});

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

beforeEach(() => {
  window.scrollTo = () => {};
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChartNode — fail-loud on missing chart.js", () => {
  it("routes a loud Error through console.error (not a silent no-op)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const container = document.createElement("div");
    document.body.appendChild(container);

    new BrowserAdapter(container).render(
      { type: "chart", labels: ["A"], series: [{ name: "S", data: [3] }] },
      () => {},
    );
    // The wrapper + canvas still render synchronously; the FAILURE is the async
    // load, which must surface loudly rather than leave a blank chart silently.
    expect(container.querySelector(".vms-chart")).not.toBeNull();

    await flush();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [prefix, err] = errorSpy.mock.calls[0];
    expect(prefix).toBe("[ViewModelShell]");
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/chart\.js/);
  });
});
