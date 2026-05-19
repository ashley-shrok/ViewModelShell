// @vitest-environment node
//
// Ink + ink-testing-library need Node stream semantics, not jsdom. The
// per-file docblock overrides the global jsdom environment without touching
// the shared vitest.config.ts (the existing jsdom suites stay untouched).

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { render } from "ink-testing-library";
import { ViewModelShell, type ViewNode } from "../src/index.js";
import { TuiAdapter } from "../src/tui.js";

const frame = (el: ReturnType<TuiAdapter["renderTree"]>): string =>
  String(render(el).lastFrame() ?? "");

describe("Phase 0 — TuiAdapter seam proof", () => {
  // A — canonical: page title + text render to the frame.
  it("renders a page title and text nodes", () => {
    const adapter = new TuiAdapter();
    const vm: ViewNode = {
      type: "page",
      title: "Tasks",
      children: [
        { type: "text", value: "hello world" },
        { type: "text", value: "an error", style: "error" },
      ],
    };
    const out = frame(adapter.renderTree(vm));
    expect(out).toContain("Tasks");
    expect(out).toContain("hello world");
    expect(out).toContain("an error");
  });

  // B — fail-loud: any node Phase 0 doesn't render shows a visible
  // placeholder, never a blank screen.
  it("renders a fail-loud placeholder for unsupported nodes", () => {
    const adapter = new TuiAdapter();
    const vm = { type: "progress", value: 42 } as unknown as ViewNode;
    expect(frame(adapter.renderTree(vm))).toContain(
      "[unsupported: progress — phase 0]",
    );
  });

  // C — core→adapter render seam: pushing a response through the shell
  // invokes adapter.render with that exact vm (mirrors adapter-seam.test.ts,
  // without spinning a live Ink instance bound to process.stdout).
  it("the shell drives adapter.render via push()", () => {
    const adapter = new TuiAdapter();
    const seen: ViewNode[] = [];
    adapter.render = (vm: ViewNode) => {
      seen.push(vm);
    };

    const shell = new ViewModelShell({
      endpoint: "http://x/api",
      actionEndpoint: "http://x/api/action",
      adapter,
    });

    const vm: ViewNode = {
      type: "page",
      title: "Pushed",
      children: [{ type: "text", value: "via push" }],
    };
    shell.push({ vm, state: {} } as Parameters<typeof shell.push>[0]);

    expect(seen).toHaveLength(1);
    const out = frame(new TuiAdapter().renderTree(seen[0]!));
    expect(out).toContain("Pushed");
    expect(out).toContain("via push");
  });

  // D — leaf-rule guard: core/browser/server must never import the TUI, or
  // ink/react would leak into the web/server dependency graph.
  it("core/browser/server do not import ./tui", () => {
    for (const mod of ["index.ts", "browser.ts", "server.ts"]) {
      const src = readFileSync(
        fileURLToPath(new URL(`../src/${mod}`, import.meta.url)),
        "utf8",
      );
      expect(src).not.toMatch(/from\s+['"]\.\/tui/);
      expect(src).not.toMatch(/import\(['"]\.\/tui/);
    }
  });
});
