// ─── TuiAdapter — OpenTUI substrate ─────────────────────────────────────────
//
// This is the OpenTUI rewrite of the TUI adapter. It replaces the Ink-based
// implementation. The substrate change closes the lazygit-style UX gap
// (no mouse, no scroll) the Ink adapter was unable to address — OpenTUI
// ships ScrollBox, native mouse parsing (4 tracking modes), and a React
// reconciler. Smoke-confirmed working on Linux x64; see the roadmap
// (.planning/TUI-OPENTUI-ROADMAP.md) for substrate decision history.
//
// Phase scope (B3 — additive over B2):
//   field               — real OpenTUI <input>/<textarea>/<select> for every
//                         inputType (text/email/password/number/date/time/
//                         datetime-local single-line, textarea/code multiline,
//                         select/select-multiple, checkbox glyph, hidden→null,
//                         file→placeholder until B4 misc). Wired to an
//                         adapter-owned fieldValues map.
//   form                — collects child field values on submit; Enter on any
//                         child input triggers the form's submitAction with
//                         { [name]: value } merged into context.
//   draft preservation  — adapter tracks fieldValues + last-seen wire values
//                         per name; user edits survive re-renders unless the
//                         server explicitly sets a new value (the framework
//                         contract documented in AGENTS.md).
//   first-input focus   — the FIRST input in the focused pane receives
//                         focused=true so the user can type into the pane
//                         they Tab'd to. Sub-pane focus traversal (Tab between
//                         multiple inputs in a pane, button activation,
//                         checkbox Space-toggle) is B5 polish.
// Phase scope (B2 — preserved):
//   page                — layout presets stack|split|cards|sidebar
//   section             — focus pane (scrollbox) in non-stack layouts; plain box otherwise.
//                         section.link → focused-pane Enter dispatches navigate(url) (1.5.0)
//   list / list-item    — scrollbox host (overflow recoverable; wheel/keyboard scroll)
//   table               — scrollbox host + sortable headers + per-column filter +
//                         clickable rows + linkLabel cells
//   focus model         — Tab/Shift-Tab cycles panes; focused border highlights;
//                         status bar at bottom with keybind hints
//   text / link         — unchanged from B1
//   button/checkbox/tabs/progress/stat-bar/copy-button/modal
//                       — still minimum-viable text surface; full widgets in B4/B5
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
  StateAccess,
  TextNode as TextNodeType,
  LinkNode as LinkNodeType,
  ImageNode,
  ListNode,
  ListItemNode,
  ButtonNode,
  CheckboxNode,
  TabsNode,
  ProgressNode,
  StatBarNode,
  ChartNode,
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

// ─── Experimental notice ───────────────────────────────────────────────────
// The terminal adapter is EXPERIMENTAL (see the @experimental tag on
// TuiAdapter). We emit a one-time stderr heads-up the first time a TuiAdapter
// is constructed in a process — covering both `vms-tui` (which constructs one)
// and programmatic consumers. Fires once per process; silence with
// VMS_TUI_SILENCE_EXPERIMENTAL=1 for deliberate users who don't want the nag.
let experimentalNoticeShown = false;
function warnExperimental(): void {
  if (experimentalNoticeShown) return;
  experimentalNoticeShown = true;
  if (process.env.VMS_TUI_SILENCE_EXPERIMENTAL) return;
  process.stderr.write(
    "[vms-tui] ⚠ The terminal adapter (TuiAdapter) is EXPERIMENTAL: incomplete, " +
      "under-tested, and subject to breaking change or removal without a major-version " +
      "bump. Not recommended for production. The browser/server/core packages are " +
      "stable and unaffected. Silence this notice with VMS_TUI_SILENCE_EXPERIMENTAL=1.\n",
  );
}

/**
 * Renders a ViewModel Shell view tree to a terminal via OpenTUI (Bun runtime).
 *
 * @experimental The terminal adapter is incomplete and under active design —
 * scrolling, keyboard/focus ergonomics, and layout coverage all need more
 * work. Its API and behavior may change or be removed without a major-version
 * bump. Constructing one prints a one-time stderr notice (silence with
 * `VMS_TUI_SILENCE_EXPERIMENTAL=1`). The browser/server/core packages are
 * stable; only `@ashley-shrok/viewmodel-shell/tui` + `vms-tui` are experimental.
 */
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
  // B3 — field state owned by the adapter. fieldValues is the live edit
  // state (mutated by <input> onInput callbacks); fieldWireValues tracks
  // the last-seen wire value per field so we can detect server intent
  // changes (the AGENTS.md draft-preservation contract: user edits survive
  // re-renders UNLESS the server explicitly sets a new value).
  private readonly fieldValues = new Map<string, string>();
  private readonly fieldWireValues = new Map<string, string>();
  // B4 — copy-button feedback state. `copiedKey` is set to the node.text
  // string of the most recently activated copy-button; reverts to null
  // after 1500ms. CopyButtonView checks ctx.copiedKey === node.text to
  // decide whether to render the copiedLabel. Two buttons with the same
  // copy text share this state (both flash "Copied!" together) — that's
  // fine UX-wise and avoids needing per-button unique keys.
  private copiedKey: string | null = null;
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;
  // 0.8.0 (#11) — pending-button state. ButtonView reads ctx.pendingButtonKey
  // and renders pendingLabel when matched. Set from ButtonView onMouseDown
  // and from activatePane's button branch. Cleared on every external render()
  // call (so server-driven re-render — success OR error — naturally clears
  // pending state, no per-button cleanup wiring needed).
  private pendingButtonKey: string | null = null;

  constructor(opts?: TuiOpts) {
    warnExperimental();
    this.viewport = opts?.viewport ?? "fill";
    const f = opts?.sidebarFraction ?? 1 / 3;
    this.sidebarFraction = Math.min(0.6, Math.max(0.15, f));
  }

  // ── Field state plumbing (B3) ─────────────────────────────────────────────
  // These are exposed on RCtx via the App's prop wiring so renderers can
  // read/write field state without holding a reference to the adapter.
  // setFieldValue is invoked from <input>/<textarea>/<select> change callbacks
  // — it MUST NOT trigger a re-render (each keystroke would flicker). The map
  // is only read on submit and on the next external re-render (server push).

  private setFieldValue = (name: string, value: string): void => {
    this.fieldValues.set(name, value);
  };

  /** Resolve a field's display value at render time. The draft-preservation
   *  contract (AGENTS.md) is "user edits survive re-renders UNLESS the server
   *  explicitly sets a new value for that field." Three states:
   *    1. First time we see this field name — initialize the wire baseline
   *       WITHOUT clobbering any pre-existing edit value (matters when a test
   *       primes fieldValues via setFieldValue before the first render).
   *    2. Wire value unchanged since last render — preserve the edit value.
   *    3. Wire value differs from the prior wire baseline — server intent
   *       change → reset the edit value to match. */
  // ── Copy-button state plumbing (B4) ───────────────────────────────────────
  // copy() writes the text to the system clipboard via OSC-52 (escape
  // sequence the terminal forwards to the OS), sets copiedKey, re-renders
  // so the button label swaps to copiedLabel, and schedules a 1500ms timer
  // that clears copiedKey + re-renders again. The clipboard write happens
  // even in conformance/test paths where the renderer isn't initialized
  // (Bun-free environments) — the write goes to process.stdout, which is
  // always available, and the re-render flush is a no-op if the renderer
  // isn't up.
  //
  // OSC-52 byte form is the SAME as the 0.4.8 link OSC-8 fix used:
  // ESC ] 52 ; c ; <base64> BEL. ESC = \x1b, BEL = \x07. Terminals without
  // OSC-52 support ignore the escape (no clipboard write, but the visual
  // "Copied!" feedback still fires, which is honest behavior).
  // Returns a stable key for ButtonNode identity within a render. Uses
  // action name + visible label — duplicates are rare and merely cause
  // two buttons to flash together (acceptable, matches "same action
  // is in-flight" intuition).
  private buttonKey(action: string, label: string): string {
    return `${action}::${label}`;
  }

  // Set the pending-button key + flush the React tree so ButtonView re-renders
  // with the swapped label. Called from ButtonView.onMouseDown and from
  // activatePane's button branch.
  private setPendingButton = (action: string, label: string): void => {
    this.pendingButtonKey = this.buttonKey(action, label);
    this.flushPending();
  };

  private copy = (text: string): void => {
    const b64 = Buffer.from(text, "utf8").toString("base64");
    const seq = `\x1b]52;c;${b64}\x07`;
    try { process.stdout.write(seq); } catch { /* stdout closed — nothing to do */ }
    this.copiedKey = text;
    if (this.copiedTimer != null) clearTimeout(this.copiedTimer);
    this.copiedTimer = setTimeout(() => {
      this.copiedKey = null;
      this.copiedTimer = null;
      this.flushPending();
    }, 1500);
    this.flushPending();
  };

  private resolveFieldValue = (name: string, wireValue: string): string => {
    if (!this.fieldWireValues.has(name)) {
      this.fieldWireValues.set(name, wireValue);
      if (!this.fieldValues.has(name)) {
        this.fieldValues.set(name, wireValue);
      }
      return this.fieldValues.get(name) ?? wireValue;
    }
    const lastWire = this.fieldWireValues.get(name)!;
    if (lastWire !== wireValue) {
      this.fieldValues.set(name, wireValue);
      this.fieldWireValues.set(name, wireValue);
    }
    return this.fieldValues.get(name) ?? wireValue;
  };

  // ── Adapter.render ────────────────────────────────────────────────────────
  // The shell calls this synchronously and does NOT await. OpenTUI's
  // createCliRenderer is async, so we init lazily: the first render() kicks
  // off initialization; subsequent renders are sync. Late renders that
  // arrive before init resolves are coalesced into `pending` (last-write-wins).
  //
  // 0.8.0 (#11) — every external render clears the pending-button state
  // (label swap) so server-driven re-renders (success path AND the dispatch-
  // error re-render path) naturally revert any in-flight UI without per-
  // button cleanup wiring.
  render(
    vm: ViewNode,
    onAction: (action: ActionEvent) => void,
    // TODO Phase 7: implement bindable input flow for terminal — currently inputs are read-only display
    _stateAccess?: StateAccess,
  ): void {
    if (this.disposed) return;
    this.pendingButtonKey = null;
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
        } else if (e.name === "return" || e.name === "enter") {
          // B5 — Enter activates the focused pane's primary actionable
          // (first button/link/copy-button). Skipped when the focused pane
          // has any FieldNode — input widgets own Enter for form submit
          // (FieldView's `<input onSubmit>` already handles that).
          this.activatePane("enter");
        } else if (e.name === "space") {
          // B5 — Space toggles the focused pane's first checkbox (the one
          // with an action). Skipped when the pane has inputs (Space is a
          // legitimate text character there).
          this.activatePane("space");
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
        setFieldValue={this.setFieldValue}
        resolveFieldValue={this.resolveFieldValue}
        copiedKey={this.copiedKey}
        copy={this.copy}
        navigate={this.navigateForLinks}
        pendingButtonKey={this.pendingButtonKey}
        setPendingButton={this.setPendingButton}
      />,
    );
  }

  // B5 — bound reference to navigate(), used as the App prop. We bind once
  // (in the property initializer below) so React sees a stable function
  // identity across renders (avoids spurious child re-renders on click).
  private navigateForLinks = (url: string): void => this.navigate(url);

  /** Test-only: read the current edit value for a named field (for asserting
   *  draft preservation across server re-renders). */
  _peekFieldValue(name: string): string | undefined {
    return this.fieldValues.get(name);
  }

  /** Test-only: read the current "copied" key for asserting that activation
   *  set the feedback state. Returns null when no button is currently flashing. */
  _peekCopiedKey(): string | null {
    return this.copiedKey;
  }

  private cycleFocus(forward: boolean): void {
    if (this.lastPaneCount === 0) return;
    this.focusedPaneIndex = forward
      ? (this.focusedPaneIndex + 1) % this.lastPaneCount
      : (this.focusedPaneIndex + this.lastPaneCount - 1) % this.lastPaneCount;
    this.flushPending();
  }

  /** B5 — keyboard activation of the focused pane's primary actionable.
   *
   *  Mode mapping:
   *    "enter" → dispatch the first button.action / link → navigate /
   *              copy-button → copy(). No-op if the pane has inputs
   *              (FieldView's <input onSubmit> handles Enter for forms).
   *    "space" → toggle the first checkbox (dispatch action with
   *              {checked: !node.checked}). No-op if the pane has inputs
   *              (Space is a printable character in text fields).
   *
   *  Always reads pane state from the CURRENT vm (this.pending), so a key
   *  pressed mid-render still acts on the structure the user can see.
   */
  private activatePane(mode: "enter" | "space"): void {
    if (!this.pending) return;
    const summary = focusedPaneSummary(this.pending.vm, this.focusedPaneIndex);
    if (summary == null || summary.hasInputs) return;
    if (mode === "enter") {
      const a = summary.primaryActionable;
      if (a == null) return;
      if (a.type === "button") {
        // 0.8.0 (#11) — mirror ButtonView.onMouseDown's pending-state set.
        // Enter activation is structurally identical to a mouse click here.
        if (a.pendingLabel != null) this.setPendingButton(a.action.name, a.label);
        this.pending.onAction(a.action);
      } else if (a.type === "link") {
        this.navigate(a.href);
      } else if (a.type === "section-link") {
        // 1.5.0 — SectionNode.link parity for the TUI: focused pane Enter
        // navigates to the section's URL via the same `navigate` verb that
        // LinkNode uses. Mirrors the BrowserAdapter's <a href> wrapper.
        this.navigate(a.url);
      } else if (a.type === "copy-button") {
        this.copy(a.text);
      }
    } else {
      const c = summary.primaryCheckbox;
      if (c == null || c.action == null) return;
      // Phase 6: action name only — the checked value lives in state at the
      // checkbox's bind path. TUI bindable input flow is TODO for Phase 7;
      // until then this dispatches the action without flipping local state.
      this.pending.onAction({ name: c.action.name });
    }
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

/** B4 — find the first ModalNode anywhere in the tree (depth-first, child
 *  order). Returns null when there is no modal active.
 *
 *  Used by App to (a) decide whether to render the modal overlay portal at
 *  app-root z-level, and (b) tell countPanes to restrict the focus cycle to
 *  the modal's interior. The wire allows at most one visible modal at a time
 *  in practice — if a future use-case wires two, the first wins; the second
 *  is rendered inline (returning null today) and so just isn't visible. We
 *  can promote this to a stack if the need arises.
 */
function findModal(node: ViewNode): ModalNode | null {
  if (node.type === "modal") return node;
  const children = (node as { children?: ViewNode[] }).children;
  if (children) for (const c of children) {
    const m = findModal(c);
    if (m) return m;
  }
  const footer = (node as { footer?: ViewNode[] }).footer;
  if (footer) for (const c of footer) {
    const m = findModal(c);
    if (m) return m;
  }
  return null;
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
    } else if (node.type === "fits") {
      // FITS-02 — the TUI renders only a fits node's LAST child, so treat it
      // as a transparent wrapper around that child for pane counting (recurse
      // into the last child only, isTopLevel=false like section).
      const last = node.children[node.children.length - 1];
      if (last) visit(last, false);
    }
  };
  // B4 focus trap: when a modal is in the tree, only count panes within the
  // modal's subtree. Outer panes still RENDER, but they're not part of the
  // Tab cycle and have no focus border — the user is operationally locked
  // to the modal until it's dismissed.
  const modal = findModal(vm);
  if (modal != null) {
    for (const c of modal.children) visit(c, false);
    if (modal.footer) for (const c of modal.footer) visit(c, false);
    return count;
  }
  visit(vm, true);
  return count;
}

/** B5 — locate the focused pane and summarize its interactive contents.
 *
 *  Walks the VM in the same DFS order as `countPanes` (modal-aware),
 *  identifies the pane at `index`, then scans that pane's subtree for:
 *    - heading text (for the status bar's pane label),
 *    - whether any FieldNode lives in it (input-focused mode),
 *    - the first activatable node (button / link / copy-button) in DOM
 *      order (Enter activates this when no input is being typed),
 *    - the first checkbox with an action (Space toggles this).
 *
 *  Returns null when `index` is out of range (e.g. zero panes). The summary
 *  is used by App for the status bar + by TuiAdapter for Enter/Space keybind
 *  activation. Walker has no side effects — safe to call any time.
 */
/** Synthetic actionable surfaced by a focused pane whose section has `link.url`
 *  set (1.5.0 — SectionNode.link). The TUI treats this as link-actionable so
 *  Enter dispatches `navigate(url)` — mirrors LinkNode handling at the pane
 *  level. No equivalent in the BrowserAdapter (which gets native anchor
 *  semantics for free); the TUI needs to synthesize this because its focus
 *  model is pane-based, not element-based. */
interface SectionLinkActionable {
  readonly type: "section-link";
  readonly url: string;
}

interface PaneSummary {
  heading: string | null;
  hasInputs: boolean;
  primaryActionable: ButtonNode | LinkNodeType | CopyButtonNode | SectionLinkActionable | null;
  primaryCheckbox: CheckboxNode | null;
}

function focusedPaneSummary(vm: ViewNode, index: number): PaneSummary | null {
  // Step 1: find the pane node at `index`, mirroring countPanes' traversal.
  let cursor = -1;
  let target: ViewNode | null = null;
  const visit = (node: ViewNode, isTopLevel: boolean): boolean => {
    // Returns true when target found (early-exit propagation).
    if (isPaneNode(node, isTopLevel)) {
      cursor++;
      if (cursor === index) {
        target = node;
        return true;
      }
    }
    if (node.type === "page") {
      for (const c of node.children) if (visit(c, true)) return true;
    } else if (node.type === "section") {
      for (const c of node.children) if (visit(c, false)) return true;
    } else if (node.type === "list") {
      for (const c of node.children) if (visit(c, false)) return true;
    } else if (node.type === "list-item") {
      for (const c of node.children) if (visit(c, false)) return true;
    } else if (node.type === "modal") {
      for (const c of node.children) if (visit(c, false)) return true;
      if (node.footer) for (const c of node.footer) if (visit(c, false)) return true;
    } else if (node.type === "form") {
      for (const c of node.children) if (visit(c, false)) return true;
    } else if (node.type === "fits") {
      // FITS-02 — only the LAST child renders in the TUI; mirror that here so
      // focus targeting matches the rendered tree (recurse into last child only).
      const last = node.children[node.children.length - 1];
      if (last && visit(last, false)) return true;
    }
    return false;
  };
  const modal = findModal(vm);
  if (modal != null) {
    for (const c of modal.children) if (visit(c, false)) break;
    if (target == null && modal.footer) for (const c of modal.footer) if (visit(c, false)) break;
  } else {
    visit(vm, true);
  }
  if (target == null) return null;

  // Step 2: scan the target pane's subtree for interactives.
  // TypeScript narrows let-mutated-through-a-closure conservatively (the
  // `target = node` assignment is invisible to flow analysis here), so the
  // post-check narrowing collapses `ViewNode | null` to `never`. The cast
  // restores the type without changing runtime behavior.
  const pane = target as ViewNode;
  const heading: string | null = pane.type === "section" ? (pane.heading ?? null) : null;
  let hasInputs = false;
  let primaryActionable: ButtonNode | LinkNodeType | CopyButtonNode | SectionLinkActionable | null = null;
  let primaryCheckbox: CheckboxNode | null = null;
  // 1.5.0 — when the pane IS a section with `link.url` set, surface it as a
  // synthetic link-actionable BEFORE scanning descendants so Enter on the
  // focused pane navigates via the wrapper anchor's URL (mirrors how the
  // BrowserAdapter gives a `<a href>` wrapper native link semantics for free).
  // Descendant LinkNode/Button/etc. can still win if no section-level link
  // is set; the section-link only seeds primaryActionable when present.
  if (pane.type === "section" && pane.link && pane.link.url.trim().length > 0) {
    primaryActionable = { type: "section-link", url: pane.link.url };
  }
  const scan = (node: ViewNode): void => {
    if (node.type === "field") hasInputs = true;
    if (primaryActionable == null) {
      if (node.type === "button") primaryActionable = node;
      else if (node.type === "link" && node.href.trim().length > 0) primaryActionable = node;
      else if (node.type === "copy-button") primaryActionable = node;
    }
    if (primaryCheckbox == null && node.type === "checkbox" && node.action != null) {
      primaryCheckbox = node;
    }
    const children = (node as { children?: ViewNode[] }).children;
    if (children) for (const c of children) scan(c);
  };
  // Scan only the pane's children — not the pane itself (which is the
  // section/list/table wrapper). For a top-level list/table pane, the
  // node IS the container and its children are rows / list-items.
  const paneChildren = (pane as { children?: ViewNode[] }).children;
  if (paneChildren) for (const c of paneChildren) scan(c);
  return { heading, hasInputs, primaryActionable, primaryCheckbox };
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
  /** True when the renderer is currently walking inside the focused pane.
   *  Toggled by SectionView / ListView / TableView when they become the focused
   *  pane. Read by FieldView to decide whether to auto-focus the first input. */
  inFocusedPane: boolean;
  /** Mutated by FieldView (and the conformance walker tolerates this side
   *  effect, same as paneCounter): used to grant focused=true to only the FIRST
   *  focusable input encountered inside the focused pane this render. Reset
   *  whenever a new focused pane is entered. */
  paneInputCounter: { current: number };
  /** Inside a form, this submits it (collecting child field values and
   *  dispatching the form's submitAction). FieldView wires onSubmit through
   *  this when its parent is a form. Null when not inside a form. */
  submitForm: (() => void) | null;
  /** Field state plumbing — wired by App from TuiAdapter. Default no-ops keep
   *  the static renderTree (conformance walker) path working without the
   *  adapter. */
  setFieldValue: (name: string, value: string) => void;
  resolveFieldValue: (name: string, wireValue: string) => string;
  /** Copy-button feedback state (B4). When a copy-button's `text` matches
   *  `copiedKey`, the view renders `copiedLabel` instead of `label`. Default
   *  null keeps the conformance walker path working without the adapter. */
  copiedKey: string | null;
  /** Triggered by CopyButtonView onMouseDown. The adapter writes OSC-52 to
   *  stdout + flips copiedKey + schedules the revert. Default no-op for
   *  conformance walker. */
  copy: (text: string) => void;
  /** B5 — link / clickable-cell click target. Maps to TuiAdapter.navigate
   *  on the mounted path; no-op for the static conformance walker. */
  navigate: (url: string) => void;
  /** 0.8.0 (#11) — button pending state. ButtonView compares this against
   *  its own action+label key to decide whether to render `pendingLabel`
   *  instead of `label`. Null = no button is currently pending. Cleared
   *  on every external render() so server-driven re-renders revert. */
  pendingButtonKey: string | null;
  /** 0.8.0 (#11) — invoked from ButtonView.onMouseDown (and from
   *  activatePane's button branch in TuiAdapter) BEFORE dispatching the
   *  action. Sets pendingButtonKey + re-renders so the swapped label is
   *  visible immediately. Default no-op for the conformance walker. */
  setPendingButton: (action: string, label: string) => void;
  /** B4 — true when a modal is somewhere in the tree. When true, panes
   *  OUTSIDE the modal subtree do NOT increment paneCounter and render
   *  without a focus border (operational focus trap). */
  modalActive: boolean;
  /** B4 — true when the current render position is inside the modal subtree.
   *  Together with modalActive, gates pane counting:
   *    isPaneFocusable = !modalActive || insideModal
   *  Sections/lists/tables only increment paneCounter when isPaneFocusable. */
  insideModal: boolean;
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
  /** Field state — provided by TuiAdapter. Optional so renderTree works. */
  setFieldValue?: (name: string, value: string) => void;
  resolveFieldValue?: (name: string, wireValue: string) => string;
  /** Copy-button feedback state — provided by TuiAdapter. Optional so renderTree works. */
  copiedKey?: string | null;
  copy?: (text: string) => void;
  /** B5 — link click invokes this to hand the URL off to the platform.
   *  Maps to TuiAdapter.navigate (the existing capability verb). Optional
   *  for the conformance walker; defaults to no-op. */
  navigate?: (url: string) => void;
  /** 0.8.0 (#11) — button pending state. See RCtx.pendingButtonKey. */
  pendingButtonKey?: string | null;
  setPendingButton?: (action: string, label: string) => void;
}

function App({
  vm,
  onAction,
  focusedPaneIndex = 0,
  sidebarFraction = 1 / 3,
  setFieldValue,
  resolveFieldValue,
  copiedKey = null,
  copy,
  navigate,
  pendingButtonKey = null,
  setPendingButton,
}: AppProps) {
  // B4 — detect modal at the top of every render so the focus-trap + overlay
  // wiring is consistent end-to-end. When a modal exists in the tree, the
  // inline ModalView returns null (so it doesn't render in-place); we render
  // the modal at app-root via ModalOverlay so its z-order is above all
  // outer content and its position context is the viewport, not whatever
  // section the modal happened to be nested under.
  const modal = findModal(vm);
  const ctx: RCtx = {
    onAction,
    focusedPaneIndex,
    paneCounter: { current: 0 },
    sidebarFraction,
    isTopLevel: true,
    inFocusedPane: false,
    paneInputCounter: { current: 0 },
    submitForm: null,
    setFieldValue: setFieldValue ?? (() => { /* no-op for conformance walker */ }),
    // Default resolver: just return the wire value — no preservation outside
    // the mounted adapter path (the conformance walker doesn't persist state).
    resolveFieldValue: resolveFieldValue ?? ((_name, wireValue) => wireValue),
    copiedKey,
    copy: copy ?? (() => { /* no-op for conformance walker */ }),
    // B5: link click target. Default no-op for the conformance walker (which
    // doesn't have an adapter to call). Real renders thread TuiAdapter.navigate.
    navigate: navigate ?? (() => { /* no-op */ }),
    // 0.8.0 (#11): pending-button plumbing. Defaults make renderTree (the
    // static conformance walker) safe to invoke without an adapter.
    pendingButtonKey,
    setPendingButton: setPendingButton ?? (() => { /* no-op for walker */ }),
    modalActive: modal != null,
    insideModal: false,
  };
  // B5 — pane summary for the StatusBar's hotkey hints. Computed at render
  // time from the same focusedPaneIndex used by everyone else; consistent
  // with what the user sees as the focused pane.
  const paneSummary = focusedPaneSummary(vm, focusedPaneIndex);
  // App shell: content fills, status bar pinned at the bottom. height="100%"
  // means it consumes the renderer's viewport (alt-screen size). The
  // inner content box is position="relative" so the modal overlay's
  // absolute positioning resolves to the content area (not the status bar).
  return (
    <box flexDirection="column" height="100%">
      <box flexGrow={1} flexShrink={1} flexDirection="column" position="relative">
        {renderNode(vm, ctx)}
        {modal != null ? (
          <ModalOverlay
            node={modal}
            ctx={{ ...ctx, isTopLevel: true, insideModal: true, paneCounter: ctx.paneCounter }}
          />
        ) : null}
      </box>
      <StatusBar summary={paneSummary} />
    </box>
  );
}

/** B5 — pane-aware keybind hints.
 *
 *  Tab/Shift-Tab and Ctrl-C are universal; ↑↓ PgUp/PgDn is universal because
 *  scrolling happens inside OpenTUI's <scrollbox> regardless of pane type.
 *  The variable slot in the middle is determined by `summary`:
 *    - pane has fields → "Enter submit" (FieldView's <input onSubmit>)
 *    - pane has primary actionable → "Enter <label>" (truncated to ~16ch)
 *    - pane has checkbox with action → "Space toggle"
 *    - none of the above → no extra hint
 *
 *  Heading (when present) shows on the right side so the user sees which
 *  pane they're focused in — important when multiple sections look similar.
 */
function StatusBar({ summary }: { summary: PaneSummary | null }) {
  const hint = paneActivationHint(summary);
  const heading = summary?.heading ?? null;
  return (
    <box flexDirection="row" gap={2} paddingLeft={1} paddingRight={1}>
      <text fg="#888888">Tab</text><text fg="#aaaaaa">next pane</text>
      <text fg="#888888">Shift-Tab</text><text fg="#aaaaaa">prev</text>
      <text fg="#888888">↑↓ PgUp/PgDn</text><text fg="#aaaaaa">scroll</text>
      {hint != null ? (
        <>
          <text fg="#88aaff">{hint.key}</text>
          <text fg="#aaaaaa">{hint.label}</text>
        </>
      ) : null}
      <text fg="#888888">Ctrl-C</text><text fg="#aaaaaa">quit</text>
      {heading != null ? (
        <box flexGrow={1} flexShrink={1} justifyContent="flex-end" flexDirection="row">
          <text fg="#88aaff">{heading}</text>
        </box>
      ) : null}
    </box>
  );
}

function paneActivationHint(summary: PaneSummary | null): { key: string; label: string } | null {
  if (summary == null) return null;
  if (summary.hasInputs) return { key: "Enter", label: "submit" };
  const a = summary.primaryActionable;
  if (a != null) {
    let label: string;
    if (a.type === "button") label = a.label;
    else if (a.type === "link") label = a.label;
    else if (a.type === "section-link") {
      // 1.5.0 — synthetic actionable from SectionNode.link. No `label` field;
      // the section's heading is shown separately by StatusBar, so use the
      // pane's heading when available (else generic "open").
      label = summary.heading ?? "open";
    }
    else label = a.label ?? "copy"; // copy-button
    // Truncate long labels so the status bar fits a single line cleanly.
    const truncated = label.length > 16 ? label.slice(0, 13) + "..." : label;
    return { key: "Enter", label: truncated };
  }
  if (summary.primaryCheckbox != null) return { key: "Space", label: "toggle" };
  return null;
}

function renderNode(node: ViewNode, ctx: RCtx, key?: string | number): React.ReactNode {
  switch (node.type) {
    case "page":         return <PageView         key={key} node={node} ctx={ctx} />;
    case "section":      return <SectionView      key={key} node={node} ctx={ctx} />;
    case "text":         return <TextView         key={key} node={node} />;
    case "link":         return <LinkView         key={key} node={node} ctx={ctx} />;
    case "image":        return <ImageView        key={key} node={node} />;
    case "list":         return <ListView         key={key} node={node} ctx={ctx} />;
    case "list-item":    return <ListItemView     key={key} node={node} ctx={ctx} />;
    case "table":        return <TableView        key={key} node={node} ctx={ctx} />;
    case "button":       return <ButtonView       key={key} node={node} ctx={ctx} />;
    case "checkbox":     return <CheckboxView     key={key} node={node} ctx={ctx} />;
    case "tabs":         return <TabsView         key={key} node={node} ctx={ctx} />;
    case "progress":     return <ProgressView     key={key} node={node} />;
    case "stat-bar":     return <StatBarView      key={key} node={node} />;
    case "chart":        return <ChartView        key={key} node={node} />;
    case "modal":        return <ModalView        key={key} node={node} ctx={ctx} />;
    case "copy-button":  return <CopyButtonView   key={key} node={node} ctx={ctx} />;
    case "divider":      return <text key={key} fg="#555555">{node.orientation === "vertical" ? "│" : "─".repeat(40)}</text>;
    case "breadcrumb":
      // NAV-03 — @experimental TUI degrade. A terminal has no breadcrumb chrome,
      // so we render the trail inline as labels joined by a separator glyph (the
      // LAST item is the current page — rendered plainly, no interactivity). The
      // framework-owned separator becomes a text " › ". Bar is "doesn't break +
      // degrades sensibly" (see the `fits` case). No DOM.
      return <text key={key} fg="#888888">{node.items.map((i) => i.label).join(" › ")}</text>;
    case "steps": {
      // NAV-03 — @experimental TUI degrade. No stepper chrome in a terminal, so
      // each step renders on its own line with a state marker DERIVED from
      // `current` (index < current = done ✓, === current = ▸, > current = ·),
      // mirroring the browser renderer's derive-from-current rule. `description`
      // is appended when present. No DOM.
      return (
        <box key={key} flexDirection="column">
          {node.steps.map((step, i) => {
            const marker = i < node.current ? "✓" : i === node.current ? "▸" : "·";
            const fg = i === node.current ? "#88aaff" : i < node.current ? "#aaaaaa" : "#666666";
            const line = step.description ? `${marker} ${step.label} — ${step.description}` : `${marker} ${step.label}`;
            return <text key={i} fg={fg}>{line}</text>;
          })}
        </box>
      );
    }
    case "form":         return <FormView         key={key} node={node} ctx={ctx} />;
    case "field":        return <FieldView        key={key} node={node} ctx={ctx} />;
    case "fits": {
      // FITS-02 — deliberate TUI degradation. A terminal has no pixel layout
      // engine, so the `fits` node's measure-and-pick selection is meaningless
      // here; we render its guaranteed-fits LAST candidate (the documented
      // fallback — children are ordered preferred/widest FIRST → safe/narrowest
      // LAST). The TUI is @experimental; the requirement is only that `fits`
      // doesn't break it and degrades sensibly. Empty children → render nothing.
      const last = node.children[node.children.length - 1];
      return last ? renderNode(last, ctx, key) : null;
    }
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
    case "row":
      // 1.11.0 — left-aligned wrapping horizontal row; items hug content.
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
  // B4 focus-trap gate: when a modal is active and this section is OUTSIDE
  // the modal subtree, the section is not part of the Tab cycle. It still
  // renders its content (so the user sees the dimmed background), but
  // without a focus border and without claiming a paneCounter slot.
  const isPaneFocusable = !ctx.modalActive || ctx.insideModal;
  const paneIndex = isPaneFocusable ? ctx.paneCounter.current++ : -1;
  const focused = isPaneFocusable && paneIndex === ctx.focusedPaneIndex;
  const border = node.variant === "card";
  const childCtx: RCtx = {
    ...ctx,
    isTopLevel: false,
    // Becoming a focused pane: descendant FieldViews use this to decide
    // whether to grant focused=true to the first input encountered. The
    // counter is per-pane so nested forms don't double up.
    inFocusedPane: focused || ctx.inFocusedPane,
    paneInputCounter: focused ? { current: 0 } : ctx.paneInputCounter,
  };
  const layout = layoutProps(node.layout, ctx.sidebarFraction);
  return (
    <box flexDirection="column" gap={1} flexGrow={1} flexShrink={1}>
      {!border && node.heading ? (
        <text attributes={1 /* BOLD */}>{node.heading}</text>
      ) : null}
      <scrollbox
        focused={focused}
        focusable={isPaneFocusable}
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
  pre:           { fg: "#cccccc" },
};

// Universal semantic-tone → foreground color, shared by text / buttons / list items.
const TONE_FG: Record<"danger" | "warning" | "success" | "info", string> = {
  danger:  "#ff5555",
  warning: "#e0a823",
  success: "#5fd75f",
  info:    "#5fafff",
};

function TextView({ node }: { node: TextNodeType }) {
  const style = node.style ?? "body";
  const attrs = STYLE_ATTRS[style];
  // tone color wins over the style's fg (mirrors the browser source-order rule).
  const fg = node.tone ? TONE_FG[node.tone] : attrs.fg;
  return (
    <text {...(attrs.attributes != null ? { attributes: attrs.attributes } : {})}
          {...(fg != null ? { fg } : {})}>
      {node.value}
    </text>
  );
}

// ── link ──────────────────────────────────────────────────────────────────
// External links emit a real OSC 8 hyperlink (\x1b]8;;url\x07label\x1b]8;;\x07);
// terminals that understand it make it clickable, terminals that don't
// degrade to the label. Empty href degrades to plain underlined text.
// Click activation (mouse + Enter) is wired in B5's interaction polish.

function LinkView({ node, ctx }: { node: LinkNodeType; ctx: RCtx }) {
  const ESC = String.fromCharCode(27);
  const BEL = String.fromCharCode(7);
  const href = node.href.trim();
  const inner = href.length > 0 && node.external
    ? `${ESC}]8;;${href}${BEL}${node.label}${ESC}]8;;${BEL}`
    : node.label;
  // B5 — mouse click hands the URL to the navigate capability (which opens
  // it externally on the TUI). External links ALSO render as a real OSC-8
  // hyperlink so modern terminals make Cmd/Ctrl-click work natively; the
  // onMouseDown handler is the fallback for terminals without OSC-8 + the
  // primary path for internal (external:false) links. Empty href → no-op.
  const onMouseDown = href.length > 0
    ? (): void => ctx.navigate(href)
    : undefined;
  return (
    <text
      attributes={4 /* UNDERLINE */}
      fg="#6688cc"
      {...(onMouseDown ? { onMouseDown } : {})}
    >
      {inner}
    </text>
  );
}

// ── image ─────────────────────────────────────────────────────────────────
// Terminals can't render raster images, so the TUI degrades to the alt text
// (the wire's accessibility intent) — the multi-target-safe contract from the
// ImageNode design. size/shape are browser-only layout hints and are ignored.
function ImageView({ node }: { node: ImageNode }) {
  const alt = node.alt && node.alt.trim().length > 0 ? node.alt : "image";
  return <text fg="#888888">[image: {alt}]</text>;
}

// ── list / list-item ──────────────────────────────────────────────────────
// A top-level `list` (direct child of page) is a pane on its own; nested
// lists scroll as part of their containing section. list-item `state`
// ("done", "active", …) maps to a text color; semantic `tone` (danger/…)
// uses the shared TONE_FG and wins over state.

const LIST_ITEM_FG: Record<string, string> = {
  done:     "#88cc88",
  active:   "#88aaff",
  running:  "#88aaff",
  moving:   "#88aaff",
  disabled: "#888888",
  high:     "#d76410",
};

function ListView({ node, ctx }: { node: ListNode; ctx: RCtx }) {
  const isPane = ctx.isTopLevel;
  if (!isPane) {
    // Inline list: stays inside whatever pane wraps it; inherits inFocusedPane.
    const childCtx: RCtx = { ...ctx, isTopLevel: false };
    return (
      <box flexDirection="column" gap={0}>
        {node.children.map((child, i) => renderNode(child, childCtx, i))}
      </box>
    );
  }
  // Top-level list → its own focus pane (subject to the B4 modal focus-trap).
  const isPaneFocusable = !ctx.modalActive || ctx.insideModal;
  const paneIndex = isPaneFocusable ? ctx.paneCounter.current++ : -1;
  const focused = isPaneFocusable && paneIndex === ctx.focusedPaneIndex;
  const childCtx: RCtx = {
    ...ctx,
    isTopLevel: false,
    inFocusedPane: focused || ctx.inFocusedPane,
    paneInputCounter: focused ? { current: 0 } : ctx.paneInputCounter,
  };
  return (
    <scrollbox
      focused={focused}
      focusable={isPaneFocusable}
      borderColor={focused ? "#88aaff" : "#555555"}
      focusedBorderColor="#88aaff"
      flexGrow={1}
      flexShrink={1}
    >
      <box flexDirection="column" gap={0}>
        {node.children.map((child, i) => renderNode(child, childCtx, i))}
      </box>
    </scrollbox>
  );
}

function ListItemView({ node, ctx }: { node: ListItemNode; ctx: RCtx }) {
  const fg = node.tone ? TONE_FG[node.tone] : node.state ? LIST_ITEM_FG[node.state] : undefined;
  const childCtx: RCtx = { ...ctx, isTopLevel: false };
  // The tint applies to text children inside this item via inherited
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
  const isPaneFocusable = !ctx.modalActive || ctx.insideModal;
  const paneIndex = isPaneFocusable ? ctx.paneCounter.current++ : -1;
  const focused = isPaneFocusable && paneIndex === ctx.focusedPaneIndex;
  // Phase 6 wire-shape: per-column sortActions keyed by column key. TUI input
  // is stubbed until Phase 7; the click dispatches the per-column action by
  // name only — sort intent should be written to state at node.sortBind by a
  // future bindable TUI implementation.
  // TODO Phase 7: implement bindable sort/filter/pagination state writes via stateAccess.
  const onHeaderClick = (columnKey: string): void => {
    const a = node.sortActions?.[columnKey];
    if (!a) return;
    ctx.onAction({ name: a.name });
  };
  // Phase 6 removed TableSelection from the framework. Per-row selection now
  // expressed as bound CheckboxNode cells; bulk-action toolbars are plain
  // ButtonNodes. TUI render is reduced accordingly.
  const sel: undefined = undefined;
  const effectiveSet: Set<string> | null = null;
  const allOnPage = false;
  return (
    <scrollbox
      focused={focused}
      focusable={isPaneFocusable}
      borderColor={focused ? "#88aaff" : "#555555"}
      focusedBorderColor="#88aaff"
      flexGrow={1}
      flexShrink={1}
    >
      <box flexDirection="column">
        {/* Phase 6 — TableSelection removed; bulk buttons are now plain
            ButtonNodes the app places wherever. effectiveSet/allOnPage left
            in place to keep the conformance walker compiling against an
            empty result. */}
        {/* Header row */}
        <box flexDirection="row" gap={2}>
          {sel ? (
            <text attributes={1 /* BOLD */}>
              {allOnPage ? "[x]" : "[ ]"}
            </text>
          ) : null}
          {node.columns.map((c) => {
            // Phase 6 — sortBind holds {column, direction}. TUI display of the
            // sort caret is TODO Phase 7 (would read from stateAccess.read).
            const isSorted = false;
            const caret = isSorted ? " ↑" : "";
            const clickable = c.sortable && node.sortActions?.[c.key] != null;
            const onMouseDown = clickable ? (): void => onHeaderClick(c.key) : undefined;
            return (
              <text
                key={c.key}
                attributes={1 /* BOLD */}
                {...(onMouseDown ? { onMouseDown } : {})}
              >
                {c.label}{caret}
              </text>
            );
          })}
        </box>
        {/* Filter row (read-only for B2; inputs in B3) */}
        {node.columns.some((c) => c.filterable) ? (
          <box flexDirection="row" gap={2}>
            {sel ? <text fg="#888888">{"   "}</text> : null}
            {node.columns.map((c) => (
              <text key={c.key} fg="#888888">
                {c.filterable ? (c.filterValue ? `[${c.filterValue}]` : "[filter]") : ""}
              </text>
            ))}
          </box>
        ) : null}
        {/* Data rows */}
        {node.rows.map((row, ri) => {
          // Phase 6 — TableRow.action → TableRow.actions[]. Per-row buttons
          // render as ButtonNodes; entire-row click is no longer a row-level
          // concept. Apps that want a clickable row composed via row.actions[].
          const onRowClick: (() => void) | undefined = undefined;
          return (
            <box
              key={row.id ?? ri}
              flexDirection="row"
              gap={2}
              {...(onRowClick ? { onMouseDown: onRowClick } : {})}
            >
              {sel ? (() => {
                const isSel = row.id != null && effectiveSet!.has(row.id);
                return (
                  <text fg={isSel ? "#88ff88" : "#888888"}>
                    {isSel ? "[x]" : "[ ]"}
                  </text>
                );
              })() : null}
              {node.columns.map((c) => {
                const cell = row.cells[c.key] ?? "";
                if (c.linkLabel != null && cell.length > 0) {
                  // Cell is a link — emit OSC-8 for external links, plain
                  // underlined text otherwise. External links are clickable
                  // natively via the terminal's OSC-8 support; internal cell
                  // links route through navigate (B5).
                  const ESC = String.fromCharCode(27);
                  const BEL = String.fromCharCode(7);
                  const inner = c.linkExternal
                    ? `${ESC}]8;;${cell}${BEL}${c.linkLabel}${ESC}]8;;${BEL}`
                    : c.linkLabel;
                  const cellClick = !c.linkExternal && cell.length > 0
                    ? (): void => ctx.navigate(cell)
                    : undefined;
                  return (
                    <text
                      key={c.key}
                      attributes={4 /* UNDERLINE */}
                      fg="#6688cc"
                      {...(cellClick ? { onMouseDown: cellClick } : {})}
                    >
                      {inner}
                    </text>
                  );
                }
                return <text key={c.key}>{cell}</text>;
              })}
            </box>
          );
        })}
        {/* Pagination footer — range label + prev/next. Phase 6: prev/next
            now carry their own unique action names; target page is written
            to state at TableNode.paginationBind by the bindable input layer
            (TODO Phase 7). Until then the TUI fires the action name only. */}
        {node.pagination ? (() => {
          const pg = node.pagination!;
          const totalPages = Math.max(1, Math.ceil(pg.totalRows / pg.pageSize));
          const from = pg.totalRows === 0 ? 0 : (pg.page - 1) * pg.pageSize + 1;
          const to = Math.min(pg.page * pg.pageSize, pg.totalRows);
          const goPrev = (): void => { if (pg.prevAction) ctx.onAction({ name: pg.prevAction.name }); };
          const goNext = (): void => { if (pg.nextAction) ctx.onAction({ name: pg.nextAction.name }); };
          const canPrev = pg.page > 1 && pg.prevAction != null;
          const canNext = pg.page < totalPages && pg.nextAction != null;
          return (
            <box flexDirection="row" gap={2}>
              <text fg="#888888">{`${from}–${to} of ${pg.totalRows}`}</text>
              <text fg={canPrev ? "#88aaff" : "#555555"} {...(canPrev ? { onMouseDown: goPrev } : {})}>
                {"‹ Prev"}
              </text>
              <text fg={canNext ? "#88aaff" : "#555555"} {...(canNext ? { onMouseDown: goNext } : {})}>
                {"Next ›"}
              </text>
            </box>
          );
        })() : null}
      </box>
    </scrollbox>
  );
}

// ── minimum-viable text surface for the rest of the node set ───────────────
// Same as B1 — text only, no interactivity. Full widgets land in B3/B4.

function ButtonView({ node, ctx }: { node: ButtonNode; ctx: RCtx }) {
  const fg = node.tone ? TONE_FG[node.tone]
           : node.emphasis === "primary" ? "#88aaff"
           : undefined;
  // 0.8.0 (#11) — pendingLabel: when set + this button's key matches the
  // adapter's pendingButtonKey, render the pending label instead of the
  // normal label. Cleared on the next external render() (success path =
  // server returns a new VM; error path = shell re-renders currentVm).
  const key = `${node.action.name}::${node.label}`;
  const isPending = node.pendingLabel != null && ctx.pendingButtonKey === key;
  const label = isPending ? node.pendingLabel : node.label;
  // B5 — mouse click dispatches the button's action. Keyboard activation
  // (Enter on the focused pane's primary actionable) is wired at the
  // renderer key handler, not here.
  const onMouseDown = (): void => {
    if (node.pendingLabel != null) ctx.setPendingButton(node.action.name, node.label);
    ctx.onAction(node.action);
  };
  return (
    <text
      {...(fg != null ? { fg } : {})}
      {...(isPending ? { dimColor: true } : {})}
      onMouseDown={onMouseDown}
    >
      [ {label} ]
    </text>
  );
}

function CheckboxView({ node, ctx }: { node: CheckboxNode; ctx: RCtx }) {
  // Phase 6 — checkbox.checked removed; value lives in state at node.bind.
  // TUI bindable read is TODO Phase 7; rendering as unchecked until then.
  const glyph = "[ ]";
  // Click dispatches the action name; bindable write-back is TODO Phase 7.
  const onMouseDown = (): void => {
    if (!node.action) return;
    ctx.onAction({ name: node.action.name });
  };
  return <text onMouseDown={onMouseDown}>{glyph} {node.label ?? ""}</text>;
}

// ── tabs ──────────────────────────────────────────────────────────────────
// Click a tab → dispatch `node.action` with `{ ...node.action.context,
// value: tab.value }` merged. Selected tab renders bold; unselected tabs
// render dim. Keyboard activation (Tab on focused tab-bar → cycle) is B5.

function TabsView({ node, ctx }: { node: TabsNode; ctx: RCtx }) {
  // Phase 6 — TabsNode.action removed; each tab carries its own unique
  // action name. The renderer writes tab.value to state at node.bind before
  // dispatching (TODO Phase 7 — bindable write here is a no-op for now).
  return (
    <box flexDirection="row" gap={1}>
      {node.tabs.map((t) => {
        const selected = t.value === node.selected;
        const onMouseDown = (): void => {
          ctx.onAction({ name: t.action.name });
        };
        return (
          <text
            key={t.value}
            onMouseDown={onMouseDown}
            attributes={selected ? 1 /* BOLD */ : 0}
            {...(selected ? {} : { fg: "#888888" })}
          >
            {t.label}
          </text>
        );
      })}
    </box>
  );
}

// ── progress ──────────────────────────────────────────────────────────────
// Visual bar: [████░░░░░░] N% using FULL BLOCK (U+2588) / LIGHT SHADE
// (U+2591). 20-cell bar width is a fixed convention — wide enough to be
// readable, narrow enough to fit inside list rows / cards. The trailing
// "N%" string is what keeps conformance happy (token "%" surfaces).
const PROGRESS_BAR_WIDTH = 20;

function ProgressView({ node }: { node: ProgressNode }) {
  const pct = Math.max(0, Math.min(100, Math.round(node.value)));
  const filled = Math.round((pct / 100) * PROGRESS_BAR_WIDTH);
  const bar = "█".repeat(filled) + "░".repeat(PROGRESS_BAR_WIDTH - filled);
  return <text>{bar} {pct}%</text>;
}

// ── stat-bar ──────────────────────────────────────────────────────────────
// Row of label+value pairs separated by │ (U+2502) for visual grouping.
// Labels render dim; values render normal — same scan pattern used in
// most status-bar UIs.

function StatBarView({ node }: { node: StatBarNode }) {
  return (
    <box flexDirection="row" gap={1}>
      {node.stats.map((s, i) => (
        <box key={i} flexDirection="row" gap={1}>
          {i > 0 ? <text fg="#555555">│</text> : null}
          <text fg="#888888">{s.label}</text>
          <text>{String(s.value)}</text>
        </box>
      ))}
    </box>
  );
}

// ── chart ─────────────────────────────────────────────────────────────────
// CHARTBASE-05 — DELIBERATE degradation for the reshaped multi-series
// ChartNode { kind?; labels: string[]; series: ChartSeries[]; stacked?;
// title? }. A terminal has no canvas, but a ChartNode is STRUCTURED data, so
// it prints legibly: the title (if any) on its own line, then GROUPED BY
// SERIES — each series' name as a sub-header, followed by one row per label
// `<label padded>  <value>  <bar>` where <bar> is a run of "█" scaled to
// value / the GLOBAL max across ALL series (so multi-series bars are
// comparable to each other, not just within their own series). pie/donut are
// single-series by design (CHARTBASE-03) — they degrade to printing
// series[0]'s label/value slices (no bars; a "share of whole" reads oddly as
// a bar anyway). Empty series / empty labels / an all-zero or non-positive
// max render names/labels/values with no bars — every division is guarded by
// `maxValue > 0`, and the resulting length is additionally clamped to >= 0
// before `.repeat()`, since an individual value can be negative even while
// the GLOBAL max (across all series) is positive (e.g. a "Net" series with
// mixed-sign entries) — never throws. ChartNode is a LEAF (no children) → no
// container-walk arm is needed (mirrors StatBarView / ProgressView).

const CHART_BAR_WIDTH = 20;

function ChartView({ node }: { node: ChartNode }) {
  const labels = node.labels ?? [];
  const series = node.series ?? [];
  const labelWidth = labels.reduce((w, l) => Math.max(w, l.length), 0);
  const isPie = node.kind === "pie" || node.kind === "donut";

  if (isPie) {
    // Single-series degrade: series[0]'s slices as label/value rows.
    const slice = series[0];
    const data = slice?.data ?? [];
    return (
      <box flexDirection="column">
        {node.title ? <text attributes={1 /* BOLD */}>{node.title}</text> : null}
        {slice ? <text attributes={1 /* BOLD */} fg="#888888">{slice.name}</text> : null}
        {labels.map((label, i) => (
          <box key={i} flexDirection="row" gap={1}>
            <text fg="#888888">{label.padEnd(labelWidth)}</text>
            <text>{String(data[i] ?? 0)}</text>
          </box>
        ))}
      </box>
    );
  }

  // bar/line/area: scale every series' bars against the GLOBAL max so
  // multiple series are visually comparable to one another.
  const allValues = series.flatMap((s) => s.data ?? []);
  const maxValue = allValues.length ? Math.max(0, ...allValues) : 0;

  return (
    <box flexDirection="column">
      {node.title ? <text attributes={1 /* BOLD */}>{node.title}</text> : null}
      {series.map((s, si) => (
        <box key={si} flexDirection="column">
          <text attributes={1 /* BOLD */}>{s.name}</text>
          {labels.map((label, li) => {
            const value = s.data?.[li] ?? 0;
            // Clamped to >= 0: `value` can be negative even while `maxValue`
            // (the global max across ALL series) is positive — an unclamped
            // negative length would throw on "█".repeat() below.
            const barLen = maxValue > 0 ? Math.max(0, Math.round((value / maxValue) * CHART_BAR_WIDTH)) : 0;
            return (
              <box key={li} flexDirection="row" gap={1}>
                <text fg="#888888">{label.padEnd(labelWidth)}</text>
                <text>{String(value).padStart(4)}</text>
                <text fg="#4a9eff">{"█".repeat(barLen)}</text>
              </box>
            );
          })}
        </box>
      ))}
    </box>
  );
}

// ── modal ─────────────────────────────────────────────────────────────────
// Modals are PORTALED to app-root by App (see findModal + ModalOverlay).
// The inline ModalView (invoked when renderNode hits a "modal" in the tree)
// returns null so the modal doesn't render twice — once in-tree, once at
// app-root. App's ModalOverlay handles the actual rendering with absolute
// positioning + focus-trap context.

function ModalView(_props: { node: ModalNode; ctx: RCtx }) {
  return null;
}

// Modal size → fixed pixel widths + minimum heights. fullscreen takes
// most of the viewport. Numbers chosen to match the BrowserAdapter modal
// CSS ratios documented in styles/default.css. The template-literal type
// (`${number}%`) is what OpenTUI's box width/height props accept; plain
// `string` would widen and break the JSX prop type.
type ModalSize = { width: number | `${number}%`; height?: number | `${number}%` };
const MODAL_SIZE: Record<NonNullable<ModalNode["size"]>, ModalSize> = {
  narrow:     { width: 36, height: 14 },
  medium:     { width: 60, height: 18 },
  wide:       { width: 88, height: 24 },
  fullscreen: { width: "90%", height: "90%" },
};

function ModalOverlay({ node, ctx }: { node: ModalNode; ctx: RCtx }) {
  const size = MODAL_SIZE[node.size ?? "medium"];
  const childCtx: RCtx = {
    ...ctx,
    isTopLevel: false,
    insideModal: true,
    paneInputCounter: { current: 0 },
  };
  return (
    <box
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      justifyContent="center"
      alignItems="center"
      backgroundColor="#000000"
      zIndex={100}
    >
      <box
        flexDirection="column"
        border
        padding={1}
        title={node.title}
        backgroundColor="#1a1a1a"
        borderColor="#88aaff"
        width={size.width}
        {...(size.height != null ? { height: size.height } : {})}
      >
        <box flexDirection="column" flexGrow={1} flexShrink={1}>
          {node.children.map((child, i) => renderNode(child, childCtx, i))}
        </box>
        {(node.footer && node.footer.length > 0) || node.dismissAction ? (
          <box flexDirection="row" gap={2} justifyContent="flex-end">
            {node.footer ? node.footer.map((child, i) => renderNode(child, childCtx, `f${i}`)) : null}
            {node.dismissAction ? (
              <text onMouseDown={() => ctx.onAction(node.dismissAction!)}>
                [ Close ]
              </text>
            ) : null}
          </box>
        ) : null}
      </box>
    </box>
  );
}

// ── copy-button ───────────────────────────────────────────────────────────
// Click → OSC-52 write to the clipboard + ephemeral "Copied!" label.
// Adapter holds the `copiedKey` state; the view checks ctx.copiedKey
// against node.text to decide which label to render. The static
// conformance walker sees only the label text (which token sequence
// remains stable: just `node.label ?? "Copy"`).

function CopyButtonView({ node, ctx }: { node: CopyButtonNode; ctx: RCtx }) {
  const isCopied = ctx.copiedKey === node.text;
  const label = isCopied
    ? (node.copiedLabel ?? "Copied!")
    : (node.label ?? "Copy");
  // 0.9.0 (#14): variant coloring — mirrors ButtonView's fg derivation
  // verbatim. Adapter-medium-adaptation parity: the browser uses CSS
  // classes; the TUI uses ANSI fg colors. Same semantic mapping.
  const fg = node.tone ? TONE_FG[node.tone]
           : node.emphasis === "primary" ? "#88aaff"
           : undefined;
  return (
    <text {...(fg != null ? { fg } : {})} onMouseDown={() => ctx.copy(node.text)}>
      [ {label} ]
    </text>
  );
}

// ── form ──────────────────────────────────────────────────────────────────
// Renders children + the submit button (decorative for B3 — Enter on any
// child input triggers form submit via FieldView's onSubmit handler).
// On submit: walks this form's children recursively to collect field names,
// reads each from the adapter's fieldValues map (falling back to wire), and
// dispatches submitAction with `{ [name]: value, ... }` merged into context.

function FormView({ node, ctx }: { node: FormNode; ctx: RCtx }) {
  // Phase 6 — context-assembly removed. Field values live in state at their
  // bind paths; the server reads them from `state`. The form dispatches just
  // the action name. TUI form-harvest behavior under the new wire is TODO
  // Phase 7 (would write each field value to state via stateAccess.write).
  const submitFormWith = (base: ActionEvent): void => {
    ctx.onAction({ name: base.name });
  };
  // Enter-in-a-field submits the default action — only wired when present.
  const submitAction = node.submitButton ? node.submitButton.action : node.submitAction;
  const childCtx: RCtx = {
    ...ctx,
    isTopLevel: false,
    submitForm: submitAction ? (): void => submitFormWith(submitAction) : null,
  };
  // buttons[] (#15) render through ButtonView so variant + pendingLabel work;
  // their onAction is wrapped to harvest the form first. pendingButtonKey
  // plumbing (0.8.0) flows through ctx unchanged.
  const buttonCtx: RCtx = { ...childCtx, onAction: submitFormWith };
  // Layout preset on form: "stack" (default — fields stacked) or "inline"
  // (field row + submit on one line, the add-bar/search-bar pattern).
  const isInline = node.layout === "inline";
  return (
    <box flexDirection={isInline ? "row" : "column"} gap={1}>
      {node.children.map((child, i) => renderNode(child, childCtx, i))}
      {submitAction != null ? (
        <text attributes={1 /* BOLD */}>[ {node.submitButton ? node.submitButton.label : (node.submitLabel ?? "Submit")} ]</text>
      ) : null}
      {node.buttons && node.buttons.length > 0 ? (
        <box flexDirection="row" gap={2}>
          {node.buttons.map((btn, i) => (
            <ButtonView key={`b${i}`} node={btn} ctx={buttonCtx} />
          ))}
        </box>
      ) : null}
    </box>
  );
}

// ── field ─────────────────────────────────────────────────────────────────
// Real OpenTUI input/textarea/select wired to the adapter's field state.
// Layout per inputType:
//   hidden                    → null (still REGISTERS the wire value so form
//                                submit picks it up).
//   text/email/password/      → <text label> + <input value=wire ...>.
//     number/date/time/        Single-line; onInput tracks edits;
//     datetime-local           onSubmit→form submit or field action.
//   textarea / code           → <text label> + <textarea initialValue=wire>.
//                                Multiline; B3 doesn't ship syntax highlighting
//                                (code-as-textarea is a deliberate B3 simplification —
//                                OpenTUI <code> is read-only render, not editor).
//   select / select-multiple  → <text label> + <select options=[...] >.
//                                B3 ships single-select; select-multiple semantics
//                                are deferred (no native OpenTUI multi-select
//                                widget; would need a custom focusable list — B5).
//   checkbox                  → <text "[x] label" or "[ ] label"> — decorative
//                                for B3 (toggle interactivity in B5).
//   file                      → <text "{label}: [file: …]"> placeholder —
//                                upload via OpenTUI input is impractical without
//                                native file-picker UX; targeted at B4 misc.
//
// Draft preservation:
//   resolveFieldValue() is the source of truth. It checks "did the server
//   change the wire value since last render" — if so, snap the user's edit
//   back to the new server value. Otherwise, the user's edit survives. This
//   matches the BrowserAdapter contract in AGENTS.md.
//
// Conformance:
//   The label is always rendered as a sibling <text>, so the static walker
//   sees it. The wire value is surfaced via <input value=…> / <textarea
//   initialValue=…> — the conformance walker is extended in this phase to
//   read those props as user-visible information.

function FieldView({ node, ctx }: { node: FieldNode; ctx: RCtx }) {
  // Phase 6 — FieldNode.value removed; current value lives in state at
  // node.bind. Until TUI bindable input flow ships (Phase 7), the wire value
  // is treated as empty and the local field-values map remains the source of
  // displayed text. The `bind` field is recorded so the field can be wired
  // when stateAccess plumbing arrives.
  const wireValue = "";
  void node.bind;
  // Resolve through the adapter so draft preservation runs as a side effect
  // even for hidden fields (the form needs their wire value at submit time).
  const currentValue = ctx.resolveFieldValue(node.name, wireValue);

  if (node.inputType === "hidden") return null;

  const label = node.label ?? node.name;
  // First focusable input inside the focused pane wins auto-focus. Sub-pane
  // traversal (Tab between multiple inputs) is B5 — for B3 the user gets
  // exactly one focused field per pane, which is enough to type into a form.
  const inputIndex = ctx.paneInputCounter.current++;
  const focused = ctx.inFocusedPane && inputIndex === 0;

  // Submit handler — common to text/textarea/select. Wired to the parent
  // form (if any), else dispatches the field's own action (immediate-dispatch).
  // Phase 6 — action carries name only; bindable write of latestValue to
  // state at node.bind is TODO Phase 7.
  const handleSubmit = (latestValue?: string): void => {
    if (latestValue !== undefined) ctx.setFieldValue(node.name, latestValue);
    if (ctx.submitForm) {
      ctx.submitForm();
      return;
    }
    if (node.action) {
      ctx.onAction({ name: node.action.name });
    }
  };

  // ── textarea / code: multi-line editor ─────────────────────────────────
  if (node.inputType === "textarea" || node.inputType === "code") {
    return (
      <box flexDirection="column" gap={0}>
        <text fg="#888888">{label}</text>
        <textarea
          // Re-mount on wire change so initialValue takes effect — uncontrolled,
          // user edits owned by the widget; we sync to adapter via onSubmit.
          key={`${node.name}::wire::${wireValue}`}
          initialValue={currentValue}
          placeholder={node.placeholder ?? null}
          focused={focused}
          onSubmit={() => handleSubmit()}
        />
      </box>
    );
  }

  // ── select / select-multiple: dropdown picker ──────────────────────────
  if (node.inputType === "select" || node.inputType === "select-multiple") {
    const options = (node.options ?? []).map((o) => ({
      name: o.label,
      description: "",
      value: o.value,
    }));
    let selectedIndex = options.findIndex((o) => String(o.value) === currentValue);
    if (selectedIndex < 0) selectedIndex = 0;
    return (
      <box flexDirection="column" gap={0}>
        <text fg="#888888">{label}</text>
        <select
          key={`${node.name}::wire::${wireValue}`}
          options={options}
          selectedIndex={selectedIndex}
          focused={focused}
          onChange={(_idx, opt) => {
            if (opt) ctx.setFieldValue(node.name, String(opt.value ?? opt.name));
          }}
          onSelect={(_idx, opt) => {
            const next = opt ? String(opt.value ?? opt.name) : currentValue;
            handleSubmit(next);
          }}
        />
      </box>
    );
  }

  // ── checkbox: decorative glyph for B3 (toggle wiring is B5) ───────────
  if (node.inputType === "checkbox") {
    // Wire contract: checkbox-typed field's value is "true" | "false".
    const checked = currentValue === "true";
    const glyph = checked ? "[x]" : "[ ]";
    return (
      <text fg={focused ? "#88aaff" : undefined}>{glyph} {label}</text>
    );
  }

  // ── file: B4 placeholder (no native file picker in terminal) ───────────
  if (node.inputType === "file") {
    return (
      <box flexDirection="column" gap={0}>
        <text fg="#888888">{label}</text>
        <text fg="#888888">[file upload — coming in B4 misc]</text>
      </box>
    );
  }

  // ── Default: single-line input (text/email/password/number/date/time/datetime-local) ──
  // OpenTUI's <input> doesn't model these subtypes; they all map to a
  // single-line text editor. Password masking would require either a custom
  // renderer or post-processing — deferred to B5 polish (the framework wire
  // exposes inputType so the server knows it's a password; the visual
  // affordance can come later). For date/time/datetime-local: the wire is
  // already a string, and a freeform text field is the lowest-common-denominator
  // terminal UX (a graphical date picker doesn't fit the medium anyway).
  return (
    <box flexDirection="column" gap={0}>
      <text fg="#888888">{label}</text>
      <input
        key={`${node.name}::wire::${wireValue}`}
        value={currentValue}
        placeholder={node.placeholder ?? ""}
        focused={focused}
        onInput={(v) => ctx.setFieldValue(node.name, v)}
        // OpenTUI types onSubmit as an intersection of (value:string)=>void
        // and (event:SubmitEvent)=>void, so the param at use-site is the
        // union — narrow it before dispatch. The wire layer's SubmitEvent
        // is an empty interface (no payload), so the string form is the only
        // one carrying the user's edit; ignore the event form.
        onSubmit={(v: string | object) => {
          handleSubmit(typeof v === "string" ? v : undefined);
        }}
      />
    </box>
  );
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

/**
 * @experimental Part of the experimental terminal target (see {@link TuiAdapter}).
 * A static, non-mounting render path used by the cross-adapter conformance suite.
 */
export function renderTree(vm: ViewNode): React.ReactNode {
  return <App vm={vm} onAction={() => { /* conformance is read-only */ }} />;
}
