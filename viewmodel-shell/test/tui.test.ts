// @vitest-environment node
//
// Ink + ink-testing-library need Node stream semantics, not jsdom. The
// per-file docblock overrides the global jsdom environment without touching
// the shared vitest.config.ts (the existing jsdom suites stay untouched).

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "ink-testing-library";
import { ViewModelShell, type ViewNode, type ActionEvent } from "../src/index.js";
import { TuiAdapter, osc52, classify } from "../src/tui.js";

// Phase 4: openExternal() spawns the browser via node:child_process. Mock ONLY
// `spawn` (keep every other real export) so a redirect's navigate path is
// deterministic + side-effect-free in unit tests. Only the Phase-4 tests that
// trigger a redirect ever call spawn; Phase 1/2/3 never do.
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, spawn: spawnMock };
});

const frame = (vm: ViewNode): string =>
  String(render(new TuiAdapter().renderTree(vm)).lastFrame() ?? "");

// ink-testing-library timing (probed): Ink attaches its stdin `data` listener
// in a post-mount effect, so a write BEFORE that attaches is dropped (raw
// EventEmitter, no buffering). Warm up after render, settle after each key.
const tick = (ms = 20): Promise<void> =>
  new Promise((r) => setTimeout(r, ms));

// ink-text-input draws a fake cursor via chalk.inverse (\x1b[7m…\x1b[27m).
// Strip SGR so editor-content substring asserts aren't split by cursor codes.
const stripAnsi = (s: string): string => s.replace(/\[[0-9;]*m/g, "");

interface Driver {
  stdin: { write(s: string): void };
  frame(): string;
  rerender(el: unknown): void;
  press(seq: string): Promise<void>;
  unmount(): void;
}

const KEY = {
  tab: "\t",
  shiftTab: "\x1b[Z",
  down: "\x1b[B",
  up: "\x1b[A",
  enter: "\r",
  space: " ",
  ctrlC: "\x03",
};

async function drive(
  vm: ViewNode,
  onAction: (a: ActionEvent) => void,
  requestExit: (c: number) => void = () => {},
): Promise<Driver> {
  const adapter = new TuiAdapter();
  const r = render(adapter.createApp(vm, onAction, { requestExit }));
  await tick(30); // warmup so Ink's input listener is attached + focus settles
  return {
    stdin: r.stdin as { write(s: string): void },
    frame: () => String(r.lastFrame() ?? ""),
    rerender: (el: unknown) => r.rerender(el as never),
    async press(seq: string) {
      r.stdin.write(seq);
      await tick(20);
    },
    unmount: () => r.unmount(),
  };
}

describe("Phase 3 — TuiAdapter (Phase-1/2 render preserved; unfocused == Phase 1/2)", () => {
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
  // (`table` is still deferred; phase string bumped 4 → 5 in Phase 5a).
  it("renders a fail-loud placeholder for deferred nodes", () => {
    const vm = { type: "table", columns: [], rows: [] } as unknown as ViewNode;
    expect(frame(vm)).toContain("[unsupported: table — phase 5]");
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
    ).toContain("[unsupported: modal — phase 5]");
    // textarea/code graduated in Phase 5a; select/select-multiple in Phase 5b
    // — dropped from this list. `file` is the last still-deferred field type.
    for (const it of ["file"]) {
      expect(
        frame({ type: "field", name: "x", inputType: it } as unknown as ViewNode),
      ).toContain(`[unsupported: field(${it}) — phase 5]`);
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

describe("Phase 3 — focus ring + non-text interaction (carried from Phase 2)", () => {
  const threeButtons: ViewNode = {
    type: "page",
    children: [
      { type: "button", label: "B1", action: { name: "a1" } },
      { type: "button", label: "B2", action: { name: "a2" } },
      { type: "button", label: "B3", action: { name: "a3" } },
    ],
  };

  it("auto-focuses the first focusable (exactly one caret)", async () => {
    const d = await drive(threeButtons, vi.fn());
    const f = d.frame();
    expect(f).toContain("▸");
    expect(f.match(/▸/g)?.length).toBe(1);
  });

  it("Tab/Shift-Tab walk the ring (order + wrap), proven via dispatch", async () => {
    const onA = vi.fn();
    const d = await drive(threeButtons, onA);
    await d.press(KEY.enter); // focus starts at B1
    expect(onA).toHaveBeenLastCalledWith({ name: "a1", context: {} });
    await d.press(KEY.tab);
    await d.press(KEY.enter);
    expect(onA).toHaveBeenLastCalledWith({ name: "a2", context: {} });
    await d.press(KEY.tab); // B2 -> B3
    await d.press(KEY.tab); // B3 -> wrap -> B1
    await d.press(KEY.enter);
    expect(onA).toHaveBeenLastCalledWith({ name: "a1", context: {} });
    await d.press(KEY.shiftTab); // B1 -> wrap back -> B3
    await d.press(KEY.enter);
    expect(onA).toHaveBeenLastCalledWith({ name: "a3", context: {} });
  });

  it("arrow keys also navigate the ring", async () => {
    const onA = vi.fn();
    const d = await drive(threeButtons, onA);
    await d.press(KEY.down); // B1 -> B2
    await d.press(KEY.enter);
    expect(onA).toHaveBeenLastCalledWith({ name: "a2", context: {} });
    await d.press(KEY.up); // B2 -> B1
    await d.press(KEY.up); // B1 -> wrap -> B3
    await d.press(KEY.enter);
    expect(onA).toHaveBeenLastCalledWith({ name: "a3", context: {} });
  });

  it("checkbox dispatches the toggled value", async () => {
    const onA = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [
          {
            type: "checkbox",
            name: "c",
            checked: true,
            label: "Done",
            action: { name: "toggle", context: { id: "7" } },
          },
        ],
      },
      onA,
    );
    await d.press(KEY.space);
    expect(onA).toHaveBeenCalledWith({
      name: "toggle",
      context: { id: "7", checked: false },
    });
  });

  it("tabs dispatch the focused tab value", async () => {
    const onA = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [
          {
            type: "tabs",
            selected: "a",
            action: { name: "tab" },
            tabs: [
              { value: "a", label: "A" },
              { value: "b", label: "B" },
            ],
          },
        ],
      },
      onA,
    );
    await d.press(KEY.tab); // first tab -> second tab
    await d.press(KEY.enter);
    expect(onA).toHaveBeenCalledWith({ name: "tab", context: { value: "b" } });
  });

  it("form submit collects current (static) field values", async () => {
    const onA = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [
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
        ],
      },
      onA,
    );
    await d.press(KEY.tab); // field -> submit
    await d.press(KEY.enter);
    expect(onA).toHaveBeenCalledWith({ name: "add", context: { title: "" } });
  });

  it("Enter on a no-action field submits the enclosing form", async () => {
    const onA = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [
          {
            type: "form",
            submitAction: { name: "add" },
            children: [
              { type: "field", name: "title", inputType: "text", value: "Milk" },
            ],
          },
        ],
      },
      onA,
    );
    await d.press(KEY.enter); // focus is the field; no field.action -> submit form
    expect(onA).toHaveBeenCalledWith({
      name: "add",
      context: { title: "Milk" },
    });
  });

  it("field with its own action dispatches {[name]: value} on Enter", async () => {
    const onA = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [
          {
            type: "field",
            name: "q",
            inputType: "text",
            value: "hi",
            action: { name: "search" },
          },
        ],
      },
      onA,
    );
    await d.press(KEY.enter);
    expect(onA).toHaveBeenCalledWith({
      name: "search",
      context: { q: "hi" },
    });
  });

  it("copy-button writes OSC 52, no dispatch, shows transient label", async () => {
    const onA = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [
          {
            type: "copy-button",
            text: "clip",
            label: "Copy",
            copiedLabel: "Copied!",
          },
        ],
      },
      onA,
    );
    expect(d.frame()).toContain("Copy");
    await d.press(KEY.enter);
    expect(onA).not.toHaveBeenCalled();
    expect(d.frame()).toContain("Copied!");
    d.unmount(); // clear the ~1.5s transient-revert timer
  });

  it("link copies its href (OSC 52), no dispatch, shows copied marker", async () => {
    const onA = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [{ type: "link", label: "Docs", href: "https://example.com" }],
      },
      onA,
    );
    await d.press(KEY.enter);
    expect(onA).not.toHaveBeenCalled();
    expect(d.frame()).toContain("copied");
    d.unmount();
  });

  it("Ctrl-C routes to requestExit(130), not onAction", async () => {
    const onA = vi.fn();
    const exit = vi.fn();
    const d = await drive(threeButtons, onA, exit);
    await d.press(KEY.ctrlC);
    expect(exit).toHaveBeenCalledWith(130);
    expect(onA).not.toHaveBeenCalled();
  });

  it("focus continuity: removing the focused node clamps to the prior index", async () => {
    const onA = vi.fn();
    const adapter = new TuiAdapter();
    const r = render(
      adapter.createApp(threeButtons, onA, { requestExit: () => {} }),
    );
    await tick(30);
    r.stdin.write(KEY.tab); // B1 -> B2
    await tick(20);
    r.stdin.write(KEY.tab); // B2 -> B3 (focused = a3)
    await tick(20);
    // Remove B3: continuity clamps min(prevIndex 2, newLen-1 1) -> idx 1 -> B2.
    r.rerender(
      adapter.createApp(
        {
          type: "page",
          children: [
            { type: "button", label: "B1", action: { name: "a1" } },
            { type: "button", label: "B2", action: { name: "a2" } },
          ],
        } as ViewNode,
        onA,
        { requestExit: () => {} },
      ),
    );
    await tick(30);
    r.stdin.write(KEY.enter);
    await tick(20);
    expect(onA).toHaveBeenLastCalledWith({ name: "a2", context: {} });
    r.unmount();
  });

  it("static path (renderTree / non-TTY) has no focus caret — == Phase 1", () => {
    const out = String(
      render(new TuiAdapter().renderTree(threeButtons)).lastFrame() ?? "",
    );
    expect(out).not.toContain("▸");
    expect(out).toContain("B1");
    expect(out).toContain("B2");
    expect(out).toContain("B3");
  });

  it("osc52 emits the exact clipboard control sequence", () => {
    expect(osc52("hi")).toBe(
      `\x1b]52;c;${Buffer.from("hi", "utf8").toString("base64")}\x07`,
    );
  });
});

describe("Phase 3 — single-line field editor", () => {
  const formVm = (field: Record<string, unknown>): ViewNode => ({
    type: "page",
    children: [
      {
        type: "form",
        submitAction: { name: "add" },
        children: [{ type: "field", ...field } as ViewNode],
      },
    ],
  });

  it("typing into the focused field shows the value", async () => {
    const d = await drive(
      { type: "page", children: [{ type: "field", name: "q", inputType: "text" }] },
      vi.fn(),
    );
    await d.press("abc");
    expect(stripAnsi(d.frame())).toContain("abc");
    d.unmount();
  });

  it("Enter submits the typed value (form, no field action)", async () => {
    const onA = vi.fn();
    const d = await drive(formVm({ name: "title", inputType: "text" }), onA);
    await d.press("Milk");
    await d.press(KEY.enter);
    expect(onA).toHaveBeenCalledWith({ name: "add", context: { title: "Milk" } });
    d.unmount();
  });

  it("field with its own action dispatches {[name]: typed} on Enter", async () => {
    const onA = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [
          { type: "field", name: "q", inputType: "text", action: { name: "search" } },
        ],
      },
      onA,
    );
    await d.press("hi");
    await d.press(KEY.enter);
    expect(onA).toHaveBeenCalledWith({ name: "search", context: { q: "hi" } });
    d.unmount();
  });

  it("password is masked while editing (real value still submitted)", async () => {
    const onA = vi.fn();
    const d = await drive(formVm({ name: "p", inputType: "password" }), onA);
    await d.press("secret");
    const f = stripAnsi(d.frame());
    expect(f).toContain("•".repeat(6));
    expect(f).not.toContain("secret");
    await d.press(KEY.enter);
    expect(onA).toHaveBeenCalledWith({ name: "add", context: { p: "secret" } });
    d.unmount();
  });

  it("draft + caret survive a shell re-render when the server value is unchanged", async () => {
    const onA = vi.fn();
    const adapter = new TuiAdapter();
    const vm: ViewNode = {
      type: "page",
      children: [{ type: "field", name: "t", inputType: "text" }],
    };
    const r = render(adapter.createApp(vm, onA, { requestExit: () => {} }));
    await tick(30);
    r.stdin.write("Mlk");
    await tick(20);
    r.stdin.write("\x1b[D"); // Left
    await tick(20);
    r.stdin.write("\x1b[D"); // Left — caret now between "M" and "l"
    await tick(20);
    // Shell poll/dispatch re-render with the SAME (unchanged) vm:
    r.rerender(adapter.createApp(vm, onA, { requestExit: () => {} }));
    await tick(30);
    r.stdin.write("i"); // inserted AT the preserved caret → "Milk"
    await tick(20);
    expect(stripAnsi(String(r.lastFrame()))).toContain("Milk");
    r.unmount();
  });

  it("server changing the field value wins over the draft", async () => {
    const onA = vi.fn();
    const adapter = new TuiAdapter();
    const v1: ViewNode = {
      type: "page",
      children: [{ type: "field", name: "t", inputType: "text", value: "old" }],
    };
    const r = render(adapter.createApp(v1, onA, { requestExit: () => {} }));
    await tick(30);
    r.stdin.write("ZZ"); // draft = "oldZZ"
    await tick(20);
    expect(stripAnsi(String(r.lastFrame()))).toContain("oldZZ");
    const v2: ViewNode = {
      type: "page",
      children: [{ type: "field", name: "t", inputType: "text", value: "server" }],
    };
    r.rerender(adapter.createApp(v2, onA, { requestExit: () => {} }));
    await tick(30);
    const f = stripAnsi(String(r.lastFrame()));
    expect(f).toContain("server");
    expect(f).not.toContain("oldZZ");
    r.unmount();
  });

  it("Tab leaves the editor; the draft is retained on return", async () => {
    const d = await drive(
      {
        type: "page",
        children: [
          { type: "field", name: "a", inputType: "text" },
          { type: "button", label: "B", action: { name: "x" } },
        ],
      },
      vi.fn(),
    );
    await d.press("hello");
    await d.press(KEY.tab); // editing → ring next → button B
    await d.press(KEY.tab); // ring → wrap → field a (re-editable)
    expect(stripAnsi(d.frame())).toContain("hello");
    d.unmount();
  });

  it("form-checkbox toggles on Space and submits on Enter", async () => {
    const onA = vi.fn();
    const d = await drive(
      formVm({ name: "agree", inputType: "checkbox", value: "false", label: "Agree" }),
      onA,
    );
    expect(stripAnsi(d.frame())).toContain("[ ]");
    await d.press(KEY.space);
    expect(stripAnsi(d.frame())).toContain("[x]");
    await d.press(KEY.enter);
    expect(onA).toHaveBeenCalledWith({ name: "add", context: { agree: "true" } });
    d.unmount();
  });

  it("the editor exists ONLY on the interactive path (renderTree stays static)", async () => {
    const vm: ViewNode = {
      type: "page",
      children: [{ type: "field", name: "q", inputType: "text", value: "hello" }],
    };
    // Static (renderTree / non-TTY / NO_CTX): the server value, immutable —
    // there is no editor to type into (byte-identical to Phase 1/2).
    const staticOut = String(
      render(new TuiAdapter().renderTree(vm)).lastFrame() ?? "",
    );
    expect(staticOut).toContain("hello");
    // Interactive + focused: it is a LIVE editor — typing mutates the value.
    // (chalk is disabled under ink-testing-library, so the inverse fake cursor
    // emits no SGR; assert the editor's behavior, not an ANSI artifact.)
    const d = await drive(vm, vi.fn());
    expect(stripAnsi(d.frame())).toContain("hello");
    await d.press("X");
    expect(stripAnsi(d.frame())).toContain("helloX");
    d.unmount();
  });

  it("Ctrl-C while editing exits; not dispatched, not inserted", async () => {
    const onA = vi.fn();
    const exit = vi.fn();
    const d = await drive(
      { type: "page", children: [{ type: "field", name: "q", inputType: "text" }] },
      onA,
      exit,
    );
    await d.press(KEY.ctrlC);
    expect(exit).toHaveBeenCalledWith(130);
    expect(onA).not.toHaveBeenCalled();
    expect(stripAnsi(d.frame())).not.toContain("\x03");
    d.unmount();
  });

  it("a pasted multi-char burst is inserted verbatim, not submitted", async () => {
    const onA = vi.fn();
    const d = await drive(formVm({ name: "t", inputType: "text" }), onA);
    await d.press("two words");
    expect(stripAnsi(d.frame())).toContain("two words");
    expect(onA).not.toHaveBeenCalled();
    d.unmount();
  });
});

describe("Phase 4 — redirect/navigate + storage verbs", () => {
  type PushArg = Parameters<ViewModelShell["push"]>[0];
  type ShellOpts = ConstructorParameters<typeof ViewModelShell>[0];
  const PUSH = (extra: Record<string, unknown>): PushArg =>
    ({ vm: { type: "text", value: "" }, state: {}, ...extra }) as PushArg;
  const mkShell = (
    adapter: ShellOpts["adapter"],
    opts: Partial<ShellOpts> = {},
  ): ViewModelShell =>
    new ViewModelShell({
      endpoint: "http://localhost:3000/api/tasks",
      actionEndpoint: "http://localhost:3000/api/tasks/action",
      adapter,
      ...opts,
    });

  afterEach(() => {
    spawnMock.mockReset();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // ── redirect: precedence + browser fallback + fail-loud floor
  //    (mirrors adapter-seam.test.ts Cases C / B / D-F) ───────────────────────
  it("onRedirect set wins over adapter.navigate (no fail-loud)", () => {
    const adapter = new TuiAdapter();
    const navSpy = vi.spyOn(adapter, "navigate");
    const onRedirect = vi.fn();
    const onError = vi.fn();
    mkShell(adapter, { onRedirect, onError }).push(PUSH({ redirect: "/x" }));
    expect(onRedirect).toHaveBeenCalledWith("/x");
    expect(navSpy).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("no onRedirect → adapter.navigate hands the URL to a browser (spawn)", () => {
    spawnMock.mockReturnValue({ once: vi.fn(), unref: vi.fn() } as never);
    mkShell(new TuiAdapter()).push(
      PUSH({ redirect: "https://other.example/oauth" }),
    );
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const args = spawnMock.mock.calls[0]![1] as string[];
    expect(args).toContain("https://other.example/oauth");
  });

  it("neither onRedirect nor navigate → fail loud via onError", () => {
    const onError = vi.fn();
    mkShell({ render() {} }, { onError }).push(PUSH({ redirect: "/x" }));
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]![0] as Error).message).toContain("navigate");
  });

  // ── storage: local file / session memory / fail-loud
  //    (mirrors adapter-seam.test.ts Cases A / D) ─────────────────────────────
  it("storage local writes the XDG state file", () => {
    const tmp = mkdtempSync(join(tmpdir(), "vms-xdg-"));
    vi.stubEnv("XDG_STATE_HOME", tmp);
    try {
      const adapter = new TuiAdapter();
      // push() with no redirect falls through to adapter.render(); stub it so
      // the storage unit test never mounts a real Ink instance (pure unit —
      // storage runs in the side-effects loop, BEFORE render, regardless).
      vi.spyOn(adapter, "render").mockImplementation(() => {});
      mkShell(adapter).push(
        PUSH({
          sideEffects: [{ type: "set-local-storage", key: "k", value: "v" }],
        }),
      );
      const file = join(tmp, "vms-tui", "storage.json");
      expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ k: "v" });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("storage session is in-memory only — no file written", () => {
    const tmp = mkdtempSync(join(tmpdir(), "vms-xdg-"));
    vi.stubEnv("XDG_STATE_HOME", tmp);
    try {
      const adapter = new TuiAdapter();
      vi.spyOn(adapter, "render").mockImplementation(() => {}); // pure: no Ink
      mkShell(adapter).push(
        PUSH({
          sideEffects: [{ type: "set-session-storage", key: "s", value: "v" }],
        }),
      );
      expect(adapter._peekSession("s")).toBe("v");
      expect(existsSync(join(tmp, "vms-tui", "storage.json"))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("missing storage capability → fail loud via onError", () => {
    const onError = vi.fn();
    mkShell({ render() {} }, { onError }).push(
      PUSH({
        sideEffects: [{ type: "set-local-storage", key: "k", value: "v" }],
      }),
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]![0] as Error).message).toContain("storage");
  });

  it("storage I/O failure is loud (interstitial) and never thrown into core", () => {
    const tmp = mkdtempSync(join(tmpdir(), "vms-xdg-"));
    const asFile = join(tmp, "not-a-dir");
    writeFileSync(asFile, "x"); // XDG base is a FILE → mkdir under it = ENOTDIR
    vi.stubEnv("XDG_STATE_HOME", asFile);
    try {
      const adapter = new TuiAdapter();
      vi.spyOn(adapter, "render").mockImplementation(() => {}); // pure: no Ink
      const spy = vi
        .spyOn(adapter, "showInterstitial")
        .mockImplementation(() => {});
      expect(() =>
        mkShell(adapter).push(
          PUSH({
            sideEffects: [{ type: "set-local-storage", key: "k", value: "v" }],
          }),
        ),
      ).not.toThrow();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  // ── classify(): the same-origin reconnect decision (pure) ──────────────────
  it("classify resolves relative / abs-same / abs-diff / invalid", () => {
    const ep = "http://localhost:3000/api/tasks";
    expect(classify("/dash", ep)).toEqual({
      kind: "same-origin",
      endpoint: "http://localhost:3000/dash",
    });
    expect(classify("http://localhost:3000/x", ep).kind).toBe("same-origin");
    expect(classify("https://other.example/x", ep)).toEqual({
      kind: "different-origin",
      url: "https://other.example/x",
    });
    expect(classify("", ep).kind).toBe("invalid");
    expect(classify("   ", ep).kind).toBe("invalid");
  });

  // ── fail-loud string single-sourced, bumped 4 → 5 (B + deferred retargeted)
  it("fail-loud placeholder string is now phase 5", () => {
    expect(
      frame({ type: "table", columns: [], rows: [] } as unknown as ViewNode),
    ).toContain("[unsupported: table — phase 5]");
    expect(
      frame({ type: "modal", children: [] } as unknown as ViewNode),
    ).toContain("[unsupported: modal — phase 5]");
  });
});

describe("Phase 5a — textarea/code multi-line editor", () => {
  const LEFT = "\x1b[D"; // Ink decodes CSI-D as key.leftArrow (Phase-3 proven)

  // 1 — textarea static (unfocused/NO_CTX) preserves newlines + placeholder.
  it("textarea renders statically, preserving newlines", () => {
    const out = frame({
      type: "field",
      name: "n",
      inputType: "textarea",
      value: "line1\nline2",
    });
    expect(out).toContain("line1");
    expect(out).toContain("line2");
    expect(
      frame({
        type: "field",
        name: "n",
        inputType: "textarea",
        placeholder: "notes…",
      }),
    ).toContain("notes…");
  });

  // 2 — code static shows its value + a dim language-hint label.
  it("code renders statically with its language hint", () => {
    const out = frame({
      type: "field",
      name: "q",
      inputType: "code",
      language: "sql",
      value: "SELECT 1",
    } as unknown as ViewNode);
    expect(out).toContain("SELECT 1");
    expect(out).toContain("sql");
  });

  // 3 — typing into a focused textarea shows the value.
  it("typing into a focused textarea shows the value", async () => {
    const d = await drive(
      { type: "page", children: [{ type: "field", name: "q", inputType: "textarea" }] },
      vi.fn(),
    );
    await d.press("hello");
    expect(stripAnsi(d.frame())).toContain("hello");
    d.unmount();
  });

  // 4 — Enter inserts a newline (does NOT submit); the multi-line value is
  //     collected when the user Tabs out to the form's submit button.
  it("Enter inserts a newline; submit collects the multi-line value", async () => {
    const onA = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [
          {
            type: "form",
            submitAction: { name: "add" },
            children: [{ type: "field", name: "body", inputType: "textarea" }],
          },
        ],
      },
      onA,
    );
    await d.press("ab");
    await d.press(LEFT); // caret between a and b
    await d.press(KEY.enter); // split → "a\nb" (NOT a submit)
    expect(onA).not.toHaveBeenCalled();
    await d.press(KEY.tab); // editing → ring → form submit
    await d.press(KEY.enter); // activate submit
    expect(onA).toHaveBeenCalledWith({
      name: "add",
      context: { body: "a\nb" },
    });
    d.unmount();
  });

  // 5 — caret continuity: move then insert lands at the caret (not appended).
  it("arrows move the caret; insert lands at the caret", async () => {
    const d = await drive(
      { type: "page", children: [{ type: "field", name: "q", inputType: "textarea" }] },
      vi.fn(),
    );
    await d.press("abc");
    await d.press(LEFT);
    await d.press(LEFT); // caret between "a" and "b"
    await d.press("X");
    expect(stripAnsi(d.frame())).toContain("aXbc");
    d.unmount();
  });

  // 6 — draft + caret survive a shell re-render when server value unchanged.
  it("draft + caret survive a shell re-render (unchanged server value)", async () => {
    const onA = vi.fn();
    const adapter = new TuiAdapter();
    const vm: ViewNode = {
      type: "page",
      children: [{ type: "field", name: "t", inputType: "textarea" }],
    };
    const r = render(adapter.createApp(vm, onA, { requestExit: () => {} }));
    await tick(30);
    r.stdin.write("Mlk");
    await tick(20);
    r.stdin.write(LEFT);
    await tick(20);
    r.stdin.write(LEFT); // caret between "M" and "l"
    await tick(20);
    r.rerender(adapter.createApp(vm, onA, { requestExit: () => {} }));
    await tick(30);
    r.stdin.write("i"); // inserted AT the preserved caret → "Milk"
    await tick(20);
    expect(stripAnsi(String(r.lastFrame()))).toContain("Milk");
    r.unmount();
  });

  // 7 — server changing the value wins over the draft (BrowserAdapter rule).
  it("server value change wins over the textarea draft", async () => {
    const onA = vi.fn();
    const adapter = new TuiAdapter();
    const v1: ViewNode = {
      type: "page",
      children: [{ type: "field", name: "t", inputType: "textarea", value: "old" }],
    };
    const r = render(adapter.createApp(v1, onA, { requestExit: () => {} }));
    await tick(30);
    r.stdin.write("ZZ"); // caret starts at end → draft "oldZZ"
    await tick(20);
    expect(stripAnsi(String(r.lastFrame()))).toContain("oldZZ");
    const v2: ViewNode = {
      type: "page",
      children: [{ type: "field", name: "t", inputType: "textarea", value: "server" }],
    };
    r.rerender(adapter.createApp(v2, onA, { requestExit: () => {} }));
    await tick(30);
    const f = stripAnsi(String(r.lastFrame()));
    expect(f).toContain("server");
    expect(f).not.toContain("oldZZ");
    r.unmount();
  });

  // 8 — Ctrl-C while editing a textarea exits; not inserted, not dispatched.
  it("Ctrl-C while editing a textarea routes to requestExit(130)", async () => {
    const onA = vi.fn();
    const exit = vi.fn();
    const d = await drive(
      { type: "page", children: [{ type: "field", name: "q", inputType: "textarea" }] },
      onA,
      exit,
    );
    await d.press(KEY.ctrlC);
    expect(exit).toHaveBeenCalledWith(130);
    expect(onA).not.toHaveBeenCalled();
    expect(stripAnsi(d.frame())).not.toContain("\x03");
    d.unmount();
  });

  // 9 — the editor exists ONLY on the interactive path (renderTree static).
  it("textarea editor is interactive-only (renderTree stays static)", async () => {
    const vm: ViewNode = {
      type: "page",
      children: [
        { type: "field", name: "q", inputType: "textarea", value: "hello" },
      ],
    };
    expect(
      String(render(new TuiAdapter().renderTree(vm)).lastFrame() ?? ""),
    ).toContain("hello");
    const d = await drive(vm, vi.fn());
    expect(stripAnsi(d.frame())).toContain("hello");
    await d.press("X"); // caret starts at end → "helloX"
    expect(stripAnsi(d.frame())).toContain("helloX");
    d.unmount();
  });

  // 10 — locked Q2: Tab always traverses the ring, even from a `code` field
  //      (it does NOT insert a literal tab — code is not tab-aware here).
  it("code: Tab traverses the ring (does not insert)", async () => {
    const onA = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [
          { type: "field", name: "q", inputType: "code", language: "js" },
          { type: "button", label: "B", action: { name: "x" } },
        ],
      },
      onA,
    );
    await d.press(KEY.tab); // code editing → ring next → button
    await d.press(KEY.enter); // activate button (proves focus left the code field)
    expect(onA).toHaveBeenCalledWith({ name: "x", context: {} });
    d.unmount();
  });

  // 11 — graduation: textarea/code are no longer fail-loud; `file` (the last
  //      still-deferred field type) remains fail-loud at the phase string.
  it("textarea/code graduated; file remains fail-loud (phase 5)", () => {
    expect(
      frame({ type: "field", name: "t", inputType: "textarea", value: "hi" }),
    ).not.toContain("unsupported");
    expect(
      frame({
        type: "field",
        name: "c",
        inputType: "code",
        value: "SELECT",
      } as unknown as ViewNode),
    ).not.toContain("unsupported");
    expect(
      frame({ type: "field", name: "f", inputType: "file" } as unknown as ViewNode),
    ).toContain("[unsupported: field(file) — phase 5]");
  });
});

describe("Phase 5b — select/select-multiple picker", () => {
  const OPTS = [
    { value: "a", label: "Apple" },
    { value: "b", label: "Banana" },
    { value: "c", label: "Cherry" },
  ];

  // 1 — select static (unfocused/NO_CTX) shows the SELECTED option's LABEL
  //     (value→label), not the raw value; placeholder when unset.
  it("select renders statically as the selected option label", () => {
    const out = frame({
      type: "field",
      name: "s",
      inputType: "select",
      value: "b",
      options: OPTS,
    } as unknown as ViewNode);
    expect(out).toContain("Banana");
    expect(
      frame({
        type: "field",
        name: "s",
        inputType: "select",
        placeholder: "Pick one…",
        options: OPTS,
      } as unknown as ViewNode),
    ).toContain("Pick one…");
  });

  // 2 — select-multiple static shows comma-joined selected LABELS.
  it("select-multiple renders statically as comma-joined labels", () => {
    const out = frame({
      type: "field",
      name: "m",
      inputType: "select-multiple",
      value: "a,c",
      options: OPTS,
    } as unknown as ViewNode);
    expect(out).toContain("Apple, Cherry");
  });

  // 3 — focused select: Down then Enter picks; the chosen VALUE round-trips
  //     through the form submit (collectForm), proving onFieldChange + collect.
  it("picking a select option collects the chosen value on submit", async () => {
    const onA = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [
          {
            type: "form",
            submitAction: { name: "add" },
            children: [
              {
                type: "field",
                name: "pick",
                inputType: "select",
                value: "a",
                options: OPTS,
              },
            ],
          },
        ],
      } as unknown as ViewNode,
      onA,
    );
    await d.press(KEY.down); // a → b (ink-select-input owns Down)
    await d.press(KEY.enter); // onSelect(b) → draft "b"
    await d.press(KEY.tab); // editing → ring → form submit
    await d.press(KEY.enter); // activate submit → collectForm
    expect(onA).toHaveBeenCalledWith({ name: "add", context: { pick: "b" } });
    d.unmount();
  });

  // 4 — focused select-multiple: Space toggles; comma-joined in option order;
  //     collected on submit.
  it("select-multiple toggles with Space and collects comma-joined", async () => {
    const onA = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [
          {
            type: "form",
            submitAction: { name: "save" },
            children: [
              {
                type: "field",
                name: "tags",
                inputType: "select-multiple",
                options: OPTS,
              },
            ],
          },
        ],
      } as unknown as ViewNode,
      onA,
    );
    await d.press(KEY.space); // toggle a → "a"
    await d.press(KEY.down); // highlight → b
    await d.press(KEY.space); // toggle b → "a,b" (option order)
    await d.press(KEY.tab);
    await d.press(KEY.enter);
    expect(onA).toHaveBeenCalledWith({
      name: "save",
      context: { tags: "a,b" },
    });
    d.unmount();
  });

  // 5 — THE select contract (inverse of Phase-5a textarea #6): a select draft
  //     is server-authoritative — it does NOT survive a server re-render even
  //     when the server value is unchanged (AGENTS.md: selects excluded from
  //     draft preservation). Pick b, server re-renders (value still "a"),
  //     submit → the SERVER value "a" is collected, never the stale pick.
  it("select draft does NOT survive a server re-render (server-authoritative)", async () => {
    const onA = vi.fn();
    const adapter = new TuiAdapter();
    const mk = (): ViewNode =>
      ({
        type: "page",
        children: [
          {
            type: "form",
            submitAction: { name: "go" },
            children: [
              {
                type: "field",
                name: "pick",
                inputType: "select",
                value: "a",
                options: OPTS,
              },
            ],
          },
        ],
      }) as unknown as ViewNode;
    const r = render(adapter.createApp(mk(), onA, { requestExit: () => {} }));
    await tick(30);
    r.stdin.write(KEY.down);
    await tick(20);
    r.stdin.write(KEY.enter); // pick "b" → local draft
    await tick(20);
    // SERVER re-render: a NEW vm object, server value still "a" (unchanged).
    r.rerender(adapter.createApp(mk(), onA, { requestExit: () => {} }));
    await tick(30);
    r.stdin.write(KEY.tab); // → form submit
    await tick(20);
    r.stdin.write(KEY.enter); // collectForm
    await tick(20);
    expect(onA).toHaveBeenCalledWith({ name: "go", context: { pick: "a" } });
    r.unmount();
  });

  // 6 — Ctrl-C while a picker is focused → requestExit(130); not dispatched,
  //     not inserted (ink-select-input/MultiSelectInput cede Ctrl-C to App).
  it("Ctrl-C while a select is focused routes to requestExit(130)", async () => {
    const onA = vi.fn();
    const exit = vi.fn();
    const d = await drive(
      {
        type: "page",
        children: [
          { type: "field", name: "s", inputType: "select", options: OPTS },
        ],
      } as unknown as ViewNode,
      onA,
      exit,
    );
    await d.press(KEY.ctrlC);
    expect(exit).toHaveBeenCalledWith(130);
    expect(onA).not.toHaveBeenCalled();
    expect(stripAnsi(d.frame())).not.toContain("\x03");
    d.unmount();
  });

  // 7 — picker is interactive-only: renderTree (NO_CTX) stays the static label
  //     box (no useInput mounted); the live driver shows the option list.
  it("picker is interactive-only (renderTree stays static)", async () => {
    const vm = {
      type: "page",
      children: [
        {
          type: "field",
          name: "s",
          inputType: "select",
          value: "c",
          options: OPTS,
        },
      ],
    } as unknown as ViewNode;
    expect(
      String(render(new TuiAdapter().renderTree(vm)).lastFrame() ?? ""),
    ).toContain("Cherry");
    const d = await drive(vm, vi.fn());
    // Focused: ink-select-input renders the full option list.
    const f = stripAnsi(d.frame());
    expect(f).toContain("Apple");
    expect(f).toContain("Banana");
    d.unmount();
  });

  // 8 — graduation: select/select-multiple are no longer fail-loud (phase 5).
  it("select/select-multiple graduated (no fail-loud placeholder)", () => {
    expect(
      frame({
        type: "field",
        name: "s",
        inputType: "select",
        options: OPTS,
      } as unknown as ViewNode),
    ).not.toContain("unsupported");
    expect(
      frame({
        type: "field",
        name: "m",
        inputType: "select-multiple",
        options: OPTS,
      } as unknown as ViewNode),
    ).not.toContain("unsupported");
    // `file` is still deferred — the regression guard for the phase string.
    expect(
      frame({ type: "field", name: "f", inputType: "file" } as unknown as ViewNode),
    ).toContain("[unsupported: field(file) — phase 5]");
  });
});
