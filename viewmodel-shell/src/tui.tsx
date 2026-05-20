// ─── TuiAdapter — OpenTUI substrate ─────────────────────────────────────────
//
// This is the OpenTUI rewrite of the TUI adapter. It replaces the Ink-based
// implementation. The substrate change closes the lazygit-style UX gap
// (no mouse, no scroll) the Ink adapter was unable to address — OpenTUI
// ships ScrollBox, native mouse parsing (4 tracking modes), and a React
// reconciler. Smoke-confirmed working on Linux x64; see the roadmap
// (.planning/TUI-OPENTUI-ROADMAP.md) for substrate decision history.
//
// Phase scope (B2 — additive over B1):
//   page                — layout presets stack|split|cards|sidebar
//   section             — focus pane (scrollbox) in non-stack layouts; plain box otherwise
//   list / list-item    — scrollbox host (overflow recoverable; wheel/keyboard scroll)
//   table               — scrollbox host + sortable headers + per-column filter +
//                         clickable rows + linkLabel cells
//   focus model         — Tab/Shift-Tab cycles panes; focused border highlights;
//                         status bar at bottom with keybind hints
//   text / link         — unchanged from B1
//   button/checkbox/tabs/progress/stat-bar/copy-button/modal/form/field
//                       — still minimum-viable text surface; full widgets in B3/B4
//
// Invariants this file upholds (read .planning/TUI-OPENTUI-ROADMAP.md):
//   - No wire change. ViewNode union, ShellSideEffect, ShellResponse untouched.
//   - Public TuiAdapter API surface preserved (constructor sig, render method,
//     navigate/storage/saveFile verbs).
//   - Cross-adapter conformance (test/conformance.tui.test.ts) green.
//   - Bun runtime requirement scoped to this subpath; browser/server unaffected.
//   - No React hooks inside the renderable component tree. Focus state is
//     owned by the TuiAdapter class and passed in as a prop on every render;
//     this is what keeps the static conformance walker (which calls function
//     components directly without a reconciler) working without setup.

// OpenTUI runtime imports are deferred — see TuiAdapter.init(). The two
// packages pull in `bun-ffi-structs`, which requires Bun (or Node 24+ with
// --experimental-ffi --allow-ffi). Tests and any module-load-time consumer
// that only walks the static React tree returned by `renderTree` must NOT
// trigger that FFI load. The JSX runtime itself is a thin re-export of
// `react/jsx-runtime` (verified in @opentui/react/jsx-runtime.js — one
// line: `export { Fragment, jsx, jsxs } from "react/jsx-runtime"`), so
// JSX compilation does not transitively load @opentui/core. As long as
// the value imports of createCliRenderer / createRoot stay behind a
// dynamic import, this module is loadable under Node.
type CliRenderer = import("@opentui/core").CliRenderer;
type ReactRoot = ReturnType<typeof import("@opentui/react").createRoot>;

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type {
  Adapter,
  ActionEvent,
  ViewNode,
  PageNode,
  SectionNode,
  TextNode as TextNodeType,
  LinkNode as LinkNodeType,
  ListNode,
  ListItemNode,
  ButtonNode,
  CheckboxNode,
  TabsNode,
  ProgressNode,
  StatBarNode,
  TableNode,
  ModalNode,
  CopyButtonNode,
  FormNode,
  FieldNode,
} from "./index.js";

// ─── Lifecycle ───────────────────────────────────────────────────────────────

interface TuiOpts {
  /** "fill" (default) takes the full terminal via alternate-screen buffer;
   *  "content" renders intrinsic content size in the inline scrollback. */
  viewport?: "fill" | "content";
  /** Sidebar rail fraction (0.15–0.6; default 1/3). When `page.layout === "sidebar"`
   *  (and the same on `section.layout`), the FIRST child occupies this fraction
   *  of the available width; the remainder fills with the rest of the children. */
  sidebarFraction?: number;
}

export class TuiAdapter implements Adapter {
  private renderer: CliRenderer | null = null;
  private root: ReactRoot | null = null;
  private pending: { vm: ViewNode; onAction: (a: ActionEvent) => void } | null = null;
  private initPromise: Promise<void> | null = null;
  private disposed = false;
  private readonly viewport: "fill" | "content";
  private readonly sidebarFraction: number;
  private readonly sessionStore = new Map<string, string>();
  // Focus model owned by the adapter (not by React hooks) so the static
  // conformance walker can invoke components without a reconciler.
  private focusedPaneIndex = 0;
  private lastPaneCount = 0;

  constructor(opts?: TuiOpts) {
    this.viewport = opts?.viewport ?? "fill";
    const f = opts?.sidebarFraction ?? 1 / 3;
    this.sidebarFraction = Math.min(0.6, Math.max(0.15, f));
  }

  // ── Adapter.render ────────────────────────────────────────────────────────
  // The shell calls this synchronously and does NOT await. OpenTUI's
  // createCliRenderer is async, so we init lazily: the first render() kicks
  // off initialization; subsequent renders are sync. Late renders that
  // arrive before init resolves are coalesced into `pending` (last-write-wins).
  render(vm: ViewNode, onAction: (action: ActionEvent) => void): void {
    if (this.disposed) return;
    this.pending = { vm, onAction };
    if (this.renderer == null) {
      if (this.initPromise == null) this.initPromise = this.init();
      return;
    }
    this.flushPending();
  }

  private async init(): Promise<void> {
    try {
      // Dynamic value imports — keeping these out of the module-level
      // import graph means this file is loadable under Node (vitest, type
      // checking, conformance walks), while the actual render path still
      // requires Bun. See the top-of-file comment for the rationale.
      const { createCliRenderer } = await import("@opentui/core");
      const { createRoot } = await import("@opentui/react");
      this.renderer = await createCliRenderer();
      this.root = createRoot(this.renderer);

      // Subscribe to keyboard events on the renderer for Tab focus cycling.
      // OpenTUI's CliRenderer emits "key" events; we intercept Tab/Shift-Tab
      // here (the focused pane's ScrollBox still receives every other key
      // for its own scroll handling — arrows, PageUp/Down, Home/End).
      const r = this.renderer as unknown as {
        on(ev: string, h: (e: KeyEventLike) => void): void;
      };
      r.on("key", (e: KeyEventLike) => {
        if (this.disposed) return;
        if (e.name === "tab") {
          this.cycleFocus(!e.shift);
        }
      });

      this.flushPending();
    } catch (err) {
      // No safe no-op here — surface to stderr so the user sees what broke
      // (e.g. non-TTY environment, missing native binary, or Node-only
      // invocation that slipped past the CLI's Bun guard).
      const msg = err instanceof Error ? err.message : String(err);
      try { process.stderr.write(`vms-tui: renderer init failed: ${msg}\n`); } catch { /* nothing */ }
    }
  }

  private flushPending(): void {
    if (!this.pending || !this.root || this.disposed) return;
    const { vm, onAction } = this.pending;
    // Count panes on the current VM so Tab knows the cycle modulus + so we
    // can clamp focusedPaneIndex if the tree shrank.
    const paneCount = countPanes(vm);
    if (paneCount === 0) {
      this.focusedPaneIndex = 0;
    } else if (this.focusedPaneIndex >= paneCount) {
      this.focusedPaneIndex = 0;
    }
    this.lastPaneCount = paneCount;
    this.root.render(
      <App
        vm={vm}
        onAction={onAction}
        focusedPaneIndex={this.focusedPaneIndex}
        sidebarFraction={this.sidebarFraction}
      />,
    );
  }

  private cycleFocus(forward: boolean): void {
    if (this.lastPaneCount === 0) return;
    this.focusedPaneIndex = forward
      ? (this.focusedPaneIndex + 1) % this.lastPaneCount
      : (this.focusedPaneIndex + this.lastPaneCount - 1) % this.lastPaneCount;
    this.flushPending();
  }

  /** Teardown — restore terminal cleanly. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    try { this.root?.unmount(); } catch { /* nothing */ }
    try { this.renderer?.destroy?.(); } catch { /* nothing */ }
    this.root = null;
    this.renderer = null;
  }

  // ── Capability verbs (navigate / storage / saveFile) ──────────────────────
  // These are side-channel; no library-specific concerns. Implementations
  // carried forward from the Ink adapter unchanged in behavior.

  navigate(url: string): void {
    if (this.disposed) return;
    if (!openExternal(url)) {
      try {
        process.stderr.write(
          `vms-tui: could not open URL automatically. Visit:\n  ${url}\n`,
        );
      } catch { /* nothing */ }
    }
  }

  storage(scope: "local" | "session", key: string, value: string): void {
    if (scope === "session") {
      this.sessionStore.set(key, value);
      return;
    }
    // local → XDG state file (synchronous; the shell applies storage effects
    // BEFORE the redirect branch, so the write must land before navigation).
    const xdg = process.env.XDG_STATE_HOME;
    const base = xdg && xdg.trim() ? xdg : join(homedir(), ".local", "state");
    const dir = join(base, "vms-tui");
    const file = join(dir, "storage.json");
    try {
      mkdirSync(dir, { recursive: true });
      let existing: string | undefined;
      try { existing = readFileSync(file, "utf8"); } catch { existing = undefined; }
      const obj: Record<string, string> = existing !== undefined
        ? (JSON.parse(existing) as Record<string, string>)
        : {};
      obj[key] = value;
      writeFileSync(file, JSON.stringify(obj));
    } catch (err) {
      const m = (err as Error).message;
      try { process.stderr.write(`vms-tui: storage write failed (local "${key}"): ${m}\n`); } catch { /* nothing */ }
    }
  }

  async saveFile(data: Blob, filename: string, _contentType: string): Promise<void> {
    // XDG_DOWNLOAD_DIR → ~/Downloads → CWD; filename sanitized against traversal.
    const xdg = process.env.XDG_DOWNLOAD_DIR;
    const home = homedir();
    const dir = xdg && xdg.trim()
      ? xdg
      : existsSync(join(home, "Downloads")) ? join(home, "Downloads") : process.cwd();
    mkdirSync(dir, { recursive: true });
    const sanitized = filename
      .split(/[/\\]/).pop()!
      .replace(/^\.+/, "")
      .trim();
    const safeName = sanitized.length > 0 ? sanitized : "download";
    const out = join(dir, safeName);
    const buf = Buffer.from(await data.arrayBuffer());
    writeFileSync(out, buf);
    try { process.stderr.write(`vms-tui: saved ${out}\n`); } catch { /* nothing */ }
  }

  /** Test-only: read back a session value. The wire contract has no
   *  storage read; this exists solely so unit tests can prove the write
   *  landed (parity with the Ink adapter's _peekSession). */
  _peekSession(key: string): string | undefined {
    return this.sessionStore.get(key);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Best-effort: hand a URL to the platform's browser. Returns true if a
 *  child process was spawned, false if no opener was available. */
function openExternal(url: string): boolean {
  const opener =
    process.platform === "darwin" ? "open" :
    process.platform === "win32"  ? "start" :
                                     "xdg-open";
  try {
    const child = spawn(opener, [url], { detached: true, stdio: "ignore" });
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** Minimal shape of OpenTUI's KeyEvent we care about. */
interface KeyEventLike {
  name?: string;
  shift?: boolean;
  ctrl?: boolean;
  meta?: boolean;
}

// ─── Pane counting ──────────────────────────────────────────────────────────
// A "pane" is a Tab-cyclable focus region with its own scroll. The rules:
//   - `section` is a pane (whether or not variant:"card");
//   - top-level `list` (page.children) is a pane;
//   - top-level `table` is a pane (tables benefit from independent scroll);
//   - non-section nodes inside a section share that section's scroll.
// We count panes in the same depth-first order the renderer visits them,
// which makes the index assigned by the renderer's counter match the index
// `cycleFocus` is mutating. Pure walker — no rendering side effects.

function isPaneNode(node: ViewNode, isTopLevel: boolean): boolean {
  if (node.type === "section") return true;
  if (isTopLevel && (node.type === "list" || node.type === "table")) return true;
  return false;
}

function countPanes(vm: ViewNode): number {
  let count = 0;
  const visit = (node: ViewNode, isTopLevel: boolean): void => {
    if (isPaneNode(node, isTopLevel)) count++;
    // Recurse only through known container shapes — we don't introspect
    // arbitrary ViewNode payloads (like table rows / form values) because
    // they don't contain pane-eligible children today.
    if (node.type === "page") {
      for (const c of node.children) visit(c, true);
    } else if (node.type === "section") {
      // Inside a section, children DON'T become independent panes (the
      // section is the pane); recurse with isTopLevel=false.
      for (const c of node.children) visit(c, false);
    } else if (node.type === "list") {
      for (const c of node.children) visit(c, false);
    } else if (node.type === "list-item") {
      for (const c of node.children) visit(c, false);
    } else if (node.type === "modal") {
      for (const c of node.children) visit(c, false);
      if (node.footer) for (const c of node.footer) visit(c, false);
    } else if (node.type === "form") {
      for (const c of node.children) visit(c, false);
    }
  };
  visit(vm, true);
  return count;
}

// ─── React tree ──────────────────────────────────────────────────────────────

interface RCtx {
  onAction: (a: ActionEvent) => void;
  /** Active pane index (matches the order in which renderer encounters panes). */
  focusedPaneIndex: number;
  /** Mutated during render to assign each pane its index. Reset per App invocation. */
  paneCounter: { current: number };
  /** Pulled out of TuiOpts so layout-aware renderers don't depend on the adapter instance. */
  sidebarFraction: number;
  /** True at the top level (direct child of page); false once we descend into a section/list. */
  isTopLevel: boolean;
}

interface AppProps {
  vm: ViewNode;
  onAction: (a: ActionEvent) => void;
  /** Provided by TuiAdapter on each render. Optional with default 0 so the
   *  static `renderTree` entrypoint (used by the conformance walker) works
   *  without the adapter. */
  focusedPaneIndex?: number;
  /** Optional with sane default for the same reason. */
  sidebarFraction?: number;
}

function App({ vm, onAction, focusedPaneIndex = 0, sidebarFraction = 1 / 3 }: AppProps) {
  const ctx: RCtx = {
    onAction,
    focusedPaneIndex,
    paneCounter: { current: 0 },
    sidebarFraction,
    isTopLevel: true,
  };
  // App shell: content fills, status bar pinned at the bottom. height="100%"
  // means it consumes the renderer's viewport (alt-screen size).
  return (
    <box flexDirection="column" height="100%">
      <box flexGrow={1} flexShrink={1} flexDirection="column">
        {renderNode(vm, ctx)}
      </box>
      <StatusBar />
    </box>
  );
}

function StatusBar() {
  // B2 status line: shows the keybinds always available across panes. In B5
  // this becomes context-aware (current pane name + pane-specific keybinds).
  return (
    <box flexDirection="row" gap={2} paddingLeft={1} paddingRight={1}>
      <text fg="#888888">Tab</text><text fg="#aaaaaa">next pane</text>
      <text fg="#888888">Shift-Tab</text><text fg="#aaaaaa">prev pane</text>
      <text fg="#888888">↑↓ PgUp/PgDn</text><text fg="#aaaaaa">scroll</text>
      <text fg="#888888">Ctrl-C</text><text fg="#aaaaaa">quit</text>
    </box>
  );
}

function renderNode(node: ViewNode, ctx: RCtx, key?: string | number): React.ReactNode {
  switch (node.type) {
    case "page":         return <PageView         key={key} node={node} ctx={ctx} />;
    case "section":      return <SectionView      key={key} node={node} ctx={ctx} />;
    case "text":         return <TextView         key={key} node={node} />;
    case "link":         return <LinkView         key={key} node={node} ctx={ctx} />;
    case "list":         return <ListView         key={key} node={node} ctx={ctx} />;
    case "list-item":    return <ListItemView     key={key} node={node} ctx={ctx} />;
    case "table":        return <TableView        key={key} node={node} ctx={ctx} />;
    // ── Minimum-viable text surface (full widgets in B3/B4) ──────────────
    case "button":       return <ButtonView       key={key} node={node} />;
    case "checkbox":     return <CheckboxView     key={key} node={node} />;
    case "tabs":         return <TabsView         key={key} node={node} />;
    case "progress":     return <ProgressView     key={key} node={node} />;
    case "stat-bar":     return <StatBarView      key={key} node={node} />;
    case "modal":        return <ModalView        key={key} node={node} ctx={ctx} />;
    case "copy-button":  return <CopyButtonView   key={key} node={node} />;
    case "form":         return <FormView         key={key} node={node} ctx={ctx} />;
    case "field":        return <FieldView        key={key} node={node} />;
    default:
      return <UnsupportedView key={key} type={(node as { type: string }).type} />;
  }
}

// ── page ──────────────────────────────────────────────────────────────────
// Title rendered as an unbordered header when present; children flow per
// the layout preset. `density: "compact"` tightens the gap.

function PageView({ node, ctx }: { node: PageNode; ctx: RCtx }) {
  const gap = node.density === "compact" ? 0 : 1;
  // Layout dispatch — see layoutProps() for the Yoga mapping.
  const layout = layoutProps(node.layout, ctx.sidebarFraction);
  const childCtx: RCtx = { ...ctx, isTopLevel: true };
  return (
    <box flexDirection="column" gap={gap}>
      {node.title ? <text attributes={1 /* TextAttributes.BOLD */}>{node.title}</text> : null}
      <box {...layout} flexShrink={1}>
        {node.children.map((child, i) => renderChildWithLayout(child, childCtx, i, node.layout, ctx.sidebarFraction))}
      </box>
    </box>
  );
}

// Sized container around a layout child. For "sidebar" the FIRST child gets
// sidebarFraction width; the rest split evenly. For "cards", each child is
// flex-basis ~33%. For "split" each child is flex 1.
function renderChildWithLayout(
  child: ViewNode,
  ctx: RCtx,
  i: number,
  layout: PageNode["layout"] | SectionNode["layout"],
  sidebarFraction: number,
): React.ReactNode {
  switch (layout) {
    case "split":
      return (
        <box key={i} flexGrow={1} flexShrink={1} flexBasis={0} flexDirection="column">
          {renderNode(child, ctx, "c")}
        </box>
      );
    case "cards":
      return (
        <box key={i} width={`${Math.round(100 / 3)}%`} flexShrink={1} flexDirection="column">
          {renderNode(child, ctx, "c")}
        </box>
      );
    case "sidebar":
      if (i === 0) {
        return (
          <box key={i} width={`${Math.round(sidebarFraction * 100)}%`} flexShrink={0} flexDirection="column">
            {renderNode(child, ctx, "c")}
          </box>
        );
      }
      return (
        <box key={i} flexGrow={1} flexShrink={1} flexBasis={0} flexDirection="column">
          {renderNode(child, ctx, "c")}
        </box>
      );
    case "stack":
    case undefined:
    default:
      return renderNode(child, ctx, i);
  }
}

// Map layout preset → Yoga props applied to the children container.
// Note: OpenTUI's flexWrap accepts "no-wrap" | "wrap" | "wrap-reverse"
// (kebab-case), distinct from CSS's "nowrap". Return type let TS infer to
// stay aligned with whatever OpenTUI's BoxOptions says.
function layoutProps(
  layout: PageNode["layout"] | SectionNode["layout"],
  _sidebarFraction: number,
) {
  switch (layout) {
    case "split":
      return { flexDirection: "row" as const, gap: 1, flexGrow: 1, flexShrink: 1 };
    case "cards":
      return { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 1 };
    case "sidebar":
      return { flexDirection: "row" as const, gap: 1, flexGrow: 1, flexShrink: 1 };
    case "stack":
    case undefined:
    default:
      return { flexDirection: "column" as const, gap: 1 };
  }
}

// ── section ───────────────────────────────────────────────────────────────
// Every section is a focus pane (Tab-cyclable, scrollable). variant:"card"
// gets a border + heading title. Plain sections get the heading rendered
// as an inline bold line above an unbordered scrollbox so overflow is still
// recoverable.
//
// Layout presets on a section apply to its children the same way page-level
// layouts do.

function SectionView({ node, ctx }: { node: SectionNode; ctx: RCtx }) {
  const paneIndex = ctx.paneCounter.current++;
  const focused = paneIndex === ctx.focusedPaneIndex;
  const border = node.variant === "card";
  const childCtx: RCtx = { ...ctx, isTopLevel: false };
  const layout = layoutProps(node.layout, ctx.sidebarFraction);
  return (
    <box flexDirection="column" gap={1} flexGrow={1} flexShrink={1}>
      {!border && node.heading ? (
        <text attributes={1 /* BOLD */}>{node.heading}</text>
      ) : null}
      <scrollbox
        focused={focused}
        focusable
        border={border}
        title={border ? node.heading : undefined}
        padding={border ? 1 : 0}
        borderColor={focused ? "#88aaff" : "#555555"}
        focusedBorderColor="#88aaff"
        flexGrow={1}
        flexShrink={1}
      >
        <box {...layout}>
          {node.children.map((child, i) => renderChildWithLayout(child, childCtx, i, node.layout, ctx.sidebarFraction))}
        </box>
      </scrollbox>
    </box>
  );
}

// ── text ──────────────────────────────────────────────────────────────────
// Maps the wire `style` field to OpenTUI text attributes + foreground color.
// pre uses no wrapping; other styles wrap naturally.

const STYLE_ATTRS: Record<NonNullable<TextNodeType["style"]>, { attributes?: number; fg?: string }> = {
  heading:       { attributes: 1 /* BOLD */ },
  subheading:    { attributes: 1 /* BOLD */, fg: "#888888" },
  body:          {},
  muted:         { fg: "#888888" },
  strikethrough: { attributes: 16 /* STRIKETHROUGH */, fg: "#888888" },
  error:         { fg: "#ff5555" },
  pre:           { fg: "#cccccc" },
};

function TextView({ node }: { node: TextNodeType }) {
  const style = node.style ?? "body";
  const attrs = STYLE_ATTRS[style];
  return (
    <text {...(attrs.attributes != null ? { attributes: attrs.attributes } : {})}
          {...(attrs.fg != null ? { fg: attrs.fg } : {})}>
      {node.value}
    </text>
  );
}

// ── link ──────────────────────────────────────────────────────────────────
// External links emit a real OSC 8 hyperlink (\x1b]8;;url\x07label\x1b]8;;\x07);
// terminals that understand it make it clickable, terminals that don't
// degrade to the label. Empty href degrades to plain underlined text.
// Click activation (mouse + Enter) is wired in B5's interaction polish.

function LinkView({ node }: { node: LinkNodeType; ctx: RCtx }) {
  const ESC = String.fromCharCode(27);
  const BEL = String.fromCharCode(7);
  const href = node.href.trim();
  const inner = href.length > 0 && node.external
    ? `${ESC}]8;;${href}${BEL}${node.label}${ESC}]8;;${BEL}`
    : node.label;
  return (
    <text attributes={4 /* UNDERLINE */} fg="#6688cc">
      {inner}
    </text>
  );
}

// ── list / list-item ──────────────────────────────────────────────────────
// A top-level `list` (direct child of page) is a pane on its own; nested
// lists scroll as part of their containing section. list-item variants
// ("done", "active", …) are mapped to text colors.

const LIST_ITEM_FG: Record<string, string> = {
  done:   "#88cc88",
  active: "#88aaff",
  error:  "#ff5555",
  muted:  "#888888",
};

function ListView({ node, ctx }: { node: ListNode; ctx: RCtx }) {
  const isPane = ctx.isTopLevel;
  const childCtx: RCtx = { ...ctx, isTopLevel: false };
  const inner = (
    <box flexDirection="column" gap={0}>
      {node.children.map((child, i) => renderNode(child, childCtx, i))}
    </box>
  );
  if (!isPane) return inner;
  // Top-level list → its own focus pane.
  const paneIndex = ctx.paneCounter.current++;
  const focused = paneIndex === ctx.focusedPaneIndex;
  return (
    <scrollbox
      focused={focused}
      focusable
      borderColor={focused ? "#88aaff" : "#555555"}
      focusedBorderColor="#88aaff"
      flexGrow={1}
      flexShrink={1}
    >
      {inner}
    </scrollbox>
  );
}

function ListItemView({ node, ctx }: { node: ListItemNode; ctx: RCtx }) {
  const fg = node.variant ? LIST_ITEM_FG[node.variant] : undefined;
  const childCtx: RCtx = { ...ctx, isTopLevel: false };
  // The variant tint applies to text children inside this item via inherited
  // color (OpenTUI <text fg> wins per-element, so this only affects items
  // whose children don't override). For B2 we just thread the children
  // through unchanged; full per-variant styling lands in B3 (with the focus +
  // selection model).
  if (!fg) {
    return (
      <box flexDirection="column" gap={0}>
        {node.children.map((child, i) => renderNode(child, childCtx, i))}
      </box>
    );
  }
  return (
    <box flexDirection="column" gap={0}>
      {node.children.map((child, i) => {
        // If the child is a plain text node, recolor it; otherwise pass through.
        if (typeof child === "object" && child !== null && (child as { type?: string }).type === "text") {
          const t = child as TextNodeType;
          return (
            <text key={i} fg={fg}>
              {t.value}
            </text>
          );
        }
        return renderNode(child, childCtx, i);
      })}
    </box>
  );
}

// ── table ─────────────────────────────────────────────────────────────────
// Always a focus pane. Header row + body rows in a scrollbox. Sortable
// headers render a small caret indicator on the currently-sorted column.
// Filter inputs are rendered as static text rows for B2 — real input wiring
// lands in B3. Clickable rows render a subtle "·" prefix; click activation
// lands in B5.

function TableView({ node, ctx }: { node: TableNode; ctx: RCtx }) {
  const paneIndex = ctx.paneCounter.current++;
  const focused = paneIndex === ctx.focusedPaneIndex;
  return (
    <scrollbox
      focused={focused}
      focusable
      borderColor={focused ? "#88aaff" : "#555555"}
      focusedBorderColor="#88aaff"
      flexGrow={1}
      flexShrink={1}
    >
      <box flexDirection="column">
        {/* Header row */}
        <box flexDirection="row" gap={2}>
          {node.columns.map((c) => {
            const isSorted = node.sortColumn === c.key;
            const caret = isSorted ? (node.sortDirection === "desc" ? " ↓" : " ↑") : "";
            return (
              <text key={c.key} attributes={1 /* BOLD */}>
                {c.label}{caret}
              </text>
            );
          })}
        </box>
        {/* Filter row (read-only for B2; inputs in B3) */}
        {node.columns.some((c) => c.filterable) ? (
          <box flexDirection="row" gap={2}>
            {node.columns.map((c) => (
              <text key={c.key} fg="#888888">
                {c.filterable ? (c.filterValue ? `[${c.filterValue}]` : "[filter]") : ""}
              </text>
            ))}
          </box>
        ) : null}
        {/* Data rows */}
        {node.rows.map((row, ri) => (
          <box key={row.id ?? ri} flexDirection="row" gap={2}>
            {node.columns.map((c) => {
              const cell = row.cells[c.key] ?? "";
              if (c.linkLabel != null && cell.length > 0) {
                // Cell is a link — emit OSC-8 for external links, plain
                // underlined text otherwise. Clickability comes with B5.
                const ESC = String.fromCharCode(27);
                const BEL = String.fromCharCode(7);
                const inner = c.linkExternal
                  ? `${ESC}]8;;${cell}${BEL}${c.linkLabel}${ESC}]8;;${BEL}`
                  : c.linkLabel;
                return <text key={c.key} attributes={4 /* UNDERLINE */} fg="#6688cc">{inner}</text>;
              }
              return <text key={c.key}>{cell}</text>;
            })}
          </box>
        ))}
      </box>
    </scrollbox>
  );
}

// ── minimum-viable text surface for the rest of the node set ───────────────
// Same as B1 — text only, no interactivity. Full widgets land in B3/B4.

function ButtonView({ node }: { node: ButtonNode }) {
  const fg = node.variant === "danger" ? "#ff5555"
           : node.variant === "primary" ? "#88aaff"
           : undefined;
  return (
    <text {...(fg != null ? { fg } : {})}>[ {node.label} ]</text>
  );
}

function CheckboxView({ node }: { node: CheckboxNode }) {
  const glyph = node.checked ? "[x]" : "[ ]";
  return <text>{glyph} {node.label ?? ""}</text>;
}

function TabsView({ node }: { node: TabsNode }) {
  return (
    <box flexDirection="row" gap={1}>
      {node.tabs.map((t) => (
        <text key={t.value}
              attributes={t.value === node.selected ? 1 /* BOLD */ : 0}
              {...(t.value === node.selected ? {} : { fg: "#888888" })}>
          {t.label}
        </text>
      ))}
    </box>
  );
}

function ProgressView({ node }: { node: ProgressNode }) {
  const pct = Math.max(0, Math.min(100, Math.round(node.value)));
  return <text>{pct}%</text>;
}

function StatBarView({ node }: { node: StatBarNode }) {
  return (
    <box flexDirection="row" gap={2}>
      {node.stats.map((s, i) => (
        <text key={i}>
          {s.label} {String(s.value)}
        </text>
      ))}
    </box>
  );
}

function ModalView({ node, ctx }: { node: ModalNode; ctx: RCtx }) {
  // True overlay (z-index + focus trap) is B4. B1/B2 render inline so the
  // modal's title/body/footer text is surfaced to conformance.
  const childCtx: RCtx = { ...ctx, isTopLevel: false };
  return (
    <box flexDirection="column" border padding={1} title={node.title}>
      {node.children.map((child, i) => renderNode(child, childCtx, i))}
      {node.footer && node.footer.length > 0 ? (
        <box flexDirection="row" gap={2}>
          {node.footer.map((child, i) => renderNode(child, childCtx, `f${i}`))}
        </box>
      ) : null}
    </box>
  );
}

function CopyButtonView({ node }: { node: CopyButtonNode }) {
  return <text>[ {node.label ?? "Copy"} ]</text>;
}

function FormView({ node, ctx }: { node: FormNode; ctx: RCtx }) {
  const childCtx: RCtx = { ...ctx, isTopLevel: false };
  return (
    <box flexDirection="column" gap={1}>
      {node.children.map((child, i) => renderNode(child, childCtx, i))}
      <text attributes={1 /* BOLD */}>[ {node.submitLabel ?? "Submit"} ]</text>
    </box>
  );
}

function FieldView({ node }: { node: FieldNode }) {
  if (node.inputType === "hidden") return null;
  const label = node.label ?? node.name;
  const val = node.value ?? "";
  return <text>{label}: {val}</text>;
}

function UnsupportedView({ type }: { type: string }) {
  return <text fg="#ff5555">[unknown node type: {type}]</text>;
}

// ─── Conformance support ─────────────────────────────────────────────────────
// renderTree returns a React element for the static / non-mounting path
// used by the cross-adapter conformance suite. It does NOT mount a renderer;
// the test layer (a manual function-component walker; see
// test/conformance.tui.test.ts) invokes the components directly. Note that
// the App component is hooks-free — focus state is passed via props with a
// safe default — so the walker works without a React reconciler.

export function renderTree(vm: ViewNode): React.ReactNode {
  return <App vm={vm} onAction={() => { /* conformance is read-only */ }} />;
}
