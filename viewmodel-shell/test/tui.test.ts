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

const frame = (vm: ViewNode): string =>
  String(render(new TuiAdapter().renderTree(vm)).lastFrame() ?? "");

describe("Phase 1 — TuiAdapter read-only render", () => {
  // ── scaffold/seam (carried from Phase 0) ───────────────────────────────

  // A — canonical: page title + text render to the frame.
  it("renders a page title and text nodes", () => {
    const vm: ViewNode = {
      type: "page",
      title: "Tasks",
      children: [
        { type: "text", value: "hello world" },
        { type: "text", value: "an error", style: "error" },
      ],
    };
    const out = frame(vm);
    expect(out).toContain("Tasks");
    expect(out).toContain("hello world");
    expect(out).toContain("an error");
  });

  // B — fail-loud: a still-deferred node shows a visible placeholder
  // (progress is now implemented, so B is retargeted to `table`).
  it("renders a fail-loud placeholder for deferred nodes", () => {
    const vm = { type: "table", columns: [], rows: [] } as unknown as ViewNode;
    expect(frame(vm)).toContain("[unsupported: table — phase 1]");
  });

  // C — core→adapter render seam: pushing a response through the shell
  // invokes adapter.render with that exact vm.
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
    const out = String(
      render(new TuiAdapter().renderTree(seen[0]!)).lastFrame() ?? "",
    );
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

  // ── per-node Phase-1 render (substring = information honesty) ───────────

  it("section variant:card shows its heading", () => {
    const out = frame({
      type: "section",
      heading: "Views",
      variant: "card",
      children: [{ type: "text", value: "inside" }],
    });
    expect(out).toContain("Views");
    expect(out).toContain("inside");
  });

  it("page sidebar puts the rail before main, both visible", () => {
    const out = frame({
      type: "page",
      layout: "sidebar",
      children: [
        { type: "section", heading: "RAIL", children: [] },
        { type: "text", value: "MAINPANE" },
      ],
    });
    expect(out).toContain("RAIL");
    expect(out).toContain("MAINPANE");
    expect(out.indexOf("RAIL")).toBeLessThan(out.indexOf("MAINPANE"));
  });

  it("page split and cards render all children", () => {
    for (const layout of ["split", "cards"] as const) {
      const out = frame({
        type: "page",
        layout,
        children: [
          { type: "text", value: "AAA" },
          { type: "text", value: "BBB" },
        ],
      });
      expect(out).toContain("AAA");
      expect(out).toContain("BBB");
    }
  });

  it("list-item shipped variants render markers + child text", () => {
    const cases: Array<[string, string]> = [
      ["active", "›"],
      ["done", "✓"],
      ["critical", "●"],
      ["high", "●"],
      ["warning", "▲"],
      ["success", "●"],
      ["info", "●"],
    ];
    for (const [variant, marker] of cases) {
      const out = frame({
        type: "list",
        children: [
          {
            type: "list-item",
            variant,
            children: [{ type: "text", value: `row-${variant}` }],
          },
        ],
      });
      expect(out).toContain(marker);
      expect(out).toContain(`row-${variant}`);
    }
  });

  it("list-item unknown variant still renders its child (fail-soft)", () => {
    const out = frame({
      type: "list",
      children: [
        {
          type: "list-item",
          variant: "totally-made-up",
          children: [{ type: "text", value: "still-here" }],
        },
      ],
    });
    expect(out).toContain("still-here");
  });

  it("text styles incl. multi-line pre preserve content", () => {
    for (const style of [
      "heading",
      "subheading",
      "body",
      "muted",
      "strikethrough",
      "error",
    ] as const) {
      expect(frame({ type: "text", value: `v-${style}`, style })).toContain(
        `v-${style}`,
      );
    }
    const out = frame({ type: "text", value: "lineA\n  lineB", style: "pre" });
    const lines = out.split("\n");
    expect(lines.some((l) => l.includes("lineA"))).toBe(true);
    expect(lines.some((l) => l.includes("lineB"))).toBe(true);
  });

  it("link emits OSC 8 for a real href, degrades for an empty one", () => {
    const withHref = frame({
      type: "link",
      label: "Docs",
      href: "https://example.com",
    });
    expect(withHref).toContain("Docs");
    expect(withHref).toContain("]8;;");

    const noHref = frame({ type: "link", label: "Bare", href: "" });
    expect(noHref).toContain("Bare");
    expect(noHref).not.toContain("]8;;");
  });

  it("stat-bar renders number + string values and labels", () => {
    const out = frame({
      type: "stat-bar",
      stats: [
        { label: "Open", value: 5 },
        { label: "Mode", value: "fast" },
      ],
    });
    expect(out).toContain("5");
    expect(out).toContain("Open");
    expect(out).toContain("fast");
    expect(out).toContain("Mode");
  });

  it("progress clamps and renders a bar + percent", () => {
    const expectPct: Array<[number, string]> = [
      [0, "0%"],
      [42, "42%"],
      [100, "100%"],
      [-10, "0%"],
      [150, "100%"],
      [NaN, "0%"],
    ];
    for (const [value, pct] of expectPct) {
      expect(frame({ type: "progress", value })).toContain(pct);
    }
    expect(frame({ type: "progress", value: 0 })).toContain("░".repeat(20));
    expect(frame({ type: "progress", value: 100 })).toContain("█".repeat(20));
  });

  it("button renders its label for every variant", () => {
    for (const variant of ["primary", "secondary", "danger"] as const) {
      expect(
        frame({
          type: "button",
          label: `btn-${variant}`,
          action: { name: "x" },
          variant,
        }),
      ).toContain(`btn-${variant}`);
    }
  });

  it("checkbox renders [x]/[ ] and its label", () => {
    const on = frame({
      type: "checkbox",
      name: "c",
      checked: true,
      label: "Agree",
    });
    expect(on).toContain("[x]");
    expect(on).toContain("Agree");
    expect(frame({ type: "checkbox", name: "c", checked: false })).toContain(
      "[ ]",
    );
  });

  it("tabs renders all tab labels", () => {
    const out = frame({
      type: "tabs",
      selected: "b",
      action: { name: "tab" },
      tabs: [
        { value: "a", label: "First" },
        { value: "b", label: "Second" },
      ],
    });
    expect(out).toContain("First");
    expect(out).toContain("Second");
  });

  it("copy-button uses default and custom labels", () => {
    expect(frame({ type: "copy-button", text: "x" })).toContain("Copy");
    expect(
      frame({ type: "copy-button", text: "x", label: "Grab it" }),
    ).toContain("Grab it");
  });

  it("form renders children + a static submit visual (stack & inline)", () => {
    for (const layout of ["stack", "inline"] as const) {
      const out = frame({
        type: "form",
        submitAction: { name: "save" },
        submitLabel: "Send",
        layout,
        children: [
          { type: "field", name: "q", inputType: "text", placeholder: "Query" },
        ],
      });
      expect(out).toContain("Query");
      expect(out).toContain("Send");
    }
    // submitLabel defaults to "Submit"
    expect(
      frame({ type: "form", submitAction: { name: "s" }, children: [] }),
    ).toContain("Submit");
  });

  it("field single-line family renders statically", () => {
    expect(
      frame({ type: "field", name: "n", inputType: "text", value: "typed" }),
    ).toContain("typed");
    expect(
      frame({
        type: "field",
        name: "n",
        inputType: "text",
        placeholder: "ph-only",
      }),
    ).toContain("ph-only");

    const pw = frame({
      type: "field",
      name: "p",
      inputType: "password",
      value: "secret",
    });
    expect(pw).toContain("•".repeat("secret".length));
    expect(pw).not.toContain("secret");

    expect(
      frame({ type: "field", name: "d", inputType: "date", value: "2026-01-02" }),
    ).toContain("2026-01-02");

    // hidden is invisible (like the browser's <input type=hidden>) — no crash.
    expect(
      frame({ type: "field", name: "h", inputType: "hidden", value: "zzz" }),
    ).not.toContain("zzz");

    // form-checkbox truthiness mirrors the browser.
    expect(
      frame({
        type: "field",
        name: "fc",
        inputType: "checkbox",
        value: "true",
        label: "Yes",
      }),
    ).toContain("[x]");
    expect(
      frame({
        type: "field",
        name: "fc",
        inputType: "checkbox",
        value: "false",
      }),
    ).toContain("[ ]");
  });

  it("deferred node types & field input types fail loud", () => {
    expect(
      frame({ type: "modal", children: [] } as unknown as ViewNode),
    ).toContain("[unsupported: modal — phase 1]");
    for (const it of [
      "textarea",
      "code",
      "select",
      "select-multiple",
      "file",
    ]) {
      expect(
        frame({ type: "field", name: "x", inputType: it } as unknown as ViewNode),
      ).toContain(`[unsupported: field(${it}) — phase 1]`);
    }
  });

  // ── live-shape: an information-honest mirror of the real Tasks screen ───
  it("renders an information-honest Tasks screen", () => {
    const vm: ViewNode = {
      type: "page",
      title: "Tasks",
      layout: "sidebar",
      children: [
        {
          type: "section",
          heading: "Views",
          variant: "card",
          children: [
            {
              type: "list",
              children: [
                {
                  type: "list-item",
                  id: "all",
                  variant: "active",
                  children: [
                    {
                      type: "button",
                      label: "All (3)",
                      action: { name: "filter", context: { value: "all" } },
                    },
                  ],
                },
                {
                  type: "list-item",
                  id: "active",
                  children: [
                    {
                      type: "button",
                      label: "Active (2)",
                      action: { name: "filter", context: { value: "active" } },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: "section",
          children: [
            { type: "text", value: "1 of 3 complete", style: "muted" },
            { type: "progress", value: 33 },
            {
              type: "form",
              submitAction: { name: "add" },
              submitLabel: "Add",
              layout: "inline",
              children: [
                {
                  type: "field",
                  name: "title",
                  inputType: "text",
                  placeholder: "Add a task…",
                },
              ],
            },
            {
              type: "list",
              children: [
                {
                  type: "list-item",
                  id: "1",
                  variant: "done",
                  children: [
                    {
                      type: "checkbox",
                      name: "completed",
                      checked: true,
                      action: { name: "toggle", context: { id: "1" } },
                    },
                    {
                      type: "text",
                      value: "Set up the project",
                      style: "strikethrough",
                    },
                    {
                      type: "button",
                      label: "✕",
                      action: { name: "delete", context: { id: "1" } },
                      variant: "danger",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const out = frame(vm);
    expect(out).toContain("Tasks");
    expect(out).toContain("Views");
    expect(out).toContain("All (3)");
    expect(out).toContain("Active (2)");
    expect(out).toContain("complete");
    expect(out).toContain("33%");
    expect(out).toContain("Add a task…");
    expect(out).toContain("Add");
    expect(out).toContain("Set up the project");
    expect(out).toContain("[x]");
    expect(out).toContain("✓"); // done-variant marker
  });
});
