// ─── TuiAdapter — OpenTUI substrate (B1 foundation) ─────────────────────────
//
// This is the OpenTUI rewrite of the TUI adapter. It replaces the Ink-based
// implementation. The substrate change closes the lazygit-style UX gap
// (no mouse, no scroll) the Ink adapter was unable to address — OpenTUI
// ships ScrollBox, native mouse parsing (4 tracking modes), and a React
// reconciler. Smoke-confirmed working on Linux x64; see the roadmap
// (.planning/TUI-OPENTUI-ROADMAP.md) for substrate decision history.
//
// Phase scope (B1):
//   page, section, text, link  ✓ rendered
//   every other ViewNode       → "B2+ placeholder" so unported backends
//                                fail visibly, not silently
//
// Invariants this file upholds (read .planning/TUI-OPENTUI-ROADMAP.md):
//   - No wire change. ViewNode union, ShellSideEffect, ShellResponse untouched.
//   - Public TuiAdapter API surface preserved (constructor sig, render method,
//     navigate/storage/saveFile verbs).
//   - Cross-adapter conformance (test/conformance.tui.test.ts) green.
//   - Bun runtime requirement scoped to this subpath; browser/server unaffected.

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
  /** Sidebar rail fraction (0.15–0.6; default 1/3). Reserved for B2's
   *  sidebar-layout pane proportioning; carried forward from the Ink adapter
   *  so the public TuiAdapter API surface stays byte-stable across the
   *  rewrite. Honored when B2 lands. */
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
    this.root.render(<App vm={vm} onAction={onAction} />);
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

// ─── React tree ──────────────────────────────────────────────────────────────

interface RCtx {
  onAction: (a: ActionEvent) => void;
}

function App({ vm, onAction }: { vm: ViewNode; onAction: (a: ActionEvent) => void }) {
  const ctx: RCtx = { onAction };
  return renderNode(vm, ctx);
}

function renderNode(node: ViewNode, ctx: RCtx, key?: string | number): React.ReactNode {
  switch (node.type) {
    case "page":         return <PageView         key={key} node={node} ctx={ctx} />;
    case "section":      return <SectionView      key={key} node={node} ctx={ctx} />;
    case "text":         return <TextView         key={key} node={node} />;
    case "link":         return <LinkView         key={key} node={node} ctx={ctx} />;
    // ── Minimum-viable text surface (interactivity layered in B2–B5) ───
    case "list":         return <ListView         key={key} node={node} ctx={ctx} />;
    case "list-item":    return <ListItemView     key={key} node={node} ctx={ctx} />;
    case "button":       return <ButtonView       key={key} node={node} />;
    case "checkbox":     return <CheckboxView     key={key} node={node} />;
    case "tabs":         return <TabsView         key={key} node={node} />;
    case "progress":     return <ProgressView     key={key} node={node} />;
    case "stat-bar":     return <StatBarView      key={key} node={node} />;
    case "table":        return <TableView        key={key} node={node} />;
    case "modal":        return <ModalView        key={key} node={node} ctx={ctx} />;
    case "copy-button":  return <CopyButtonView   key={key} node={node} />;
    case "form":         return <FormView         key={key} node={node} ctx={ctx} />;
    case "field":        return <FieldView        key={key} node={node} />;
    default:
      return <UnsupportedView key={key} type={(node as { type: string }).type} />;
  }
}

// ── page ──────────────────────────────────────────────────────────────────
// Top-level wrapper. Title rendered as an unbordered header when present;
// children flow vertically. The renderer itself owns the alt-screen/viewport
// behavior — `viewport: "content"` mode is a B5 polish item.

function PageView({ node, ctx }: { node: PageNode; ctx: RCtx }) {
  const gap = node.density === "compact" ? 0 : 1;
  return (
    <box flexDirection="column" gap={gap}>
      {node.title ? <text attributes={1 /* TextAttributes.BOLD */}>{node.title}</text> : null}
      {node.children.map((child, i) => renderNode(child, ctx, i))}
    </box>
  );
}

// ── section ───────────────────────────────────────────────────────────────
// variant:"card" → bordered box with optional title. Plain → unbordered.
// Layout presets (stack/split/cards/sidebar) are mapped in B2; B1 renders
// all sections as vertical stack.

function SectionView({ node, ctx }: { node: SectionNode; ctx: RCtx }) {
  const gap = 1;
  const border = node.variant === "card";
  return (
    <box
      flexDirection="column"
      gap={gap}
      border={border}
      title={border ? node.heading : undefined}
      padding={border ? 1 : 0}
    >
      {!border && node.heading ? (
        <text attributes={1 /* BOLD */}>{node.heading}</text>
      ) : null}
      {node.children.map((child, i) => renderNode(child, ctx, i))}
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

// ── minimum-viable text surface for the rest of the node set ───────────────
// B1 surfaces every node's user-visible TEXT (label, value, headers, cells)
// so cross-adapter conformance stays green. Interactivity, layout, and
// proper widget integration come in B2–B5. Each renderer here is a small
// box-of-text — it satisfies the information-parity contract without
// pretending to be the final widget.

function ListView({ node, ctx }: { node: ListNode; ctx: RCtx }) {
  return (
    <box flexDirection="column">
      {node.children.map((child, i) => renderNode(child, ctx, i))}
    </box>
  );
}

function ListItemView({ node, ctx }: { node: ListItemNode; ctx: RCtx }) {
  // variants ("done", "active", …) are visual hints reserved for B2 widgets.
  return (
    <box flexDirection="column">
      {node.children.map((child, i) => renderNode(child, ctx, i))}
    </box>
  );
}

function ButtonView({ node }: { node: ButtonNode }) {
  // Click activation wires up in B5's interaction polish.
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
  // Inline percent text; visual bar comes in B4.
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

function TableView({ node }: { node: TableNode }) {
  // Plain table: header row + data rows. Sort/filter/click wire up in B2.
  return (
    <box flexDirection="column">
      <box flexDirection="row" gap={2}>
        {node.columns.map((c) => (
          <text key={c.key} attributes={1 /* BOLD */}>{c.label}</text>
        ))}
      </box>
      {node.rows.map((row, ri) => (
        <box key={ri} flexDirection="row" gap={2}>
          {node.columns.map((c) => (
            <text key={c.key}>{row.cells[c.key] ?? ""}</text>
          ))}
        </box>
      ))}
    </box>
  );
}

function ModalView({ node, ctx }: { node: ModalNode; ctx: RCtx }) {
  // True overlay (z-index + focus trap) is B4. B1 renders inline so the
  // modal's title/body/footer text is surfaced to conformance.
  return (
    <box flexDirection="column" border padding={1} title={node.title}>
      {node.children.map((child, i) => renderNode(child, ctx, i))}
      {node.footer && node.footer.length > 0 ? (
        <box flexDirection="row" gap={2}>
          {node.footer.map((child, i) => renderNode(child, ctx, `f${i}`))}
        </box>
      ) : null}
    </box>
  );
}

function CopyButtonView({ node }: { node: CopyButtonNode }) {
  // OSC 52 clipboard write activates on click in B5.
  return <text>[ {node.label ?? "Copy"} ]</text>;
}

function FormView({ node, ctx }: { node: FormNode; ctx: RCtx }) {
  return (
    <box flexDirection="column" gap={1}>
      {node.children.map((child, i) => renderNode(child, ctx, i))}
      <text attributes={1 /* BOLD */}>[ {node.submitLabel ?? "Submit"} ]</text>
    </box>
  );
}

function FieldView({ node }: { node: FieldNode }) {
  // Text surface only: "<label>: <value>". Real input + draft preservation
  // come in B3. Hidden fields render nothing (matches the wire's intent).
  if (node.inputType === "hidden") return null;
  const label = node.label ?? node.name;
  const val = node.value ?? "";
  return <text>{label}: {val}</text>;
}

function UnsupportedView({ type }: { type: string }) {
  // Reserved for genuinely unknown ViewNode types (forward compat). All
  // currently-shipped types have a B1 text renderer above.
  return <text fg="#ff5555">[unknown node type: {type}]</text>;
}

// ─── Conformance support ─────────────────────────────────────────────────────
// renderTree returns a React element for the static / non-mounting path
// used by the cross-adapter conformance suite. It does NOT mount a renderer;
// the test layer (OpenTUI's @opentui/core/testing) wraps it.

export function renderTree(vm: ViewNode): React.ReactNode {
  return <App vm={vm} onAction={() => { /* conformance is read-only */ }} />;
}
