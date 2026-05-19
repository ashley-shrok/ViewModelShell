import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import {
  render as inkRender,
  Box,
  Text,
  useInput,
  useStdin,
  useStdout,
} from "ink";
import TextInput from "ink-text-input";
import SelectInput from "ink-select-input";
import type {
  Adapter,
  ActionEvent,
  ViewNode,
  FormNode,
  FieldNode,
  ModalNode,
  TableNode,
  TableColumn,
  TableRow,
} from "./index.js";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type InkInstance = ReturnType<typeof inkRender>;

type Density = "comfortable" | "compact";

/**
 * Style tint inherited down the tree (e.g. a `list-item` variant tinting its
 * child `text`/`button`/`link`). Purely a render concern — no wire change.
 */
type Inherited = { color?: string; dim?: boolean; bold?: boolean } | undefined;

/**
 * Render context for interaction state. Threaded (not a wire field) so the
 * pure static path (`renderTree` → NO_CTX) stays byte-identical to Phase 1:
 * with no focused/copied key and a focusKey that always returns undefined,
 * every node renders exactly as it did before interaction existed.
 */
interface RCtx {
  focusedKey: string | null;
  copiedKey: string | null;
  /** object-identity → focus key, for the focused node within THIS render. */
  focusKey: (o: object) => string | undefined;
  /** Live editor: true only on a TTY (raw mode). The pure static path
   *  (`renderTree` → NO_CTX) is false, so no `<TextInput>` is ever mounted
   *  and the field render stays byte-identical to Phase 1/2. */
  interactive: boolean;
  /** Effective draft for a focus key — the user-typed value when it should
   *  win, else undefined (caller falls back to the server `value`). Mirrors
   *  BrowserAdapter's draft-preservation rule (see App). */
  draft: (key: string) => string | undefined;
  /** Editable-field wiring (only invoked on the interactive path; App
   *  supplies real closures, NO_CTX leaves them undefined). */
  onFieldChange?: (key: string, value: string) => void;
  onFieldSubmit?: (field: FieldNode) => void;
  /** Phase 5d — a table per-column filter's Enter (its focused <TextInput>'s
   *  onSubmit). App builds the {column,value,filters} payload (browser parity)
   *  and dispatches `filterAction`. Undefined on the static/NO_CTX path. */
  onTableFilter?: (table: TableNode, col: TableColumn) => void;
}

const NO_CTX: RCtx = {
  focusedKey: null,
  copiedKey: null,
  focusKey: () => undefined,
  interactive: false,
  draft: () => undefined,
};

/** A node the focus ring can land on, in tree (pre-order) order. */
interface Focusable {
  key: string;
  kind:
    | "button"
    | "checkbox"
    | "tabs-tab"
    | "copy"
    | "link"
    | "field"
    | "form-submit"
    | "table-sort"
    | "table-filter"
    | "table-row";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any;
  form?: FormNode;
  tab?: { value: string; label: string };
  /** Phase 5d table sub-focusables. */
  col?: TableColumn;
  row?: TableRow;
}

/** OSC 52 clipboard write — the terminal-native analog of the clipboard API.
 *  Works over SSH (no local clipboard dependency). Exported for a direct,
 *  deterministic unit test of the byte format. */
export function osc52(text: string): string {
  return `\x1b]52;c;${Buffer.from(String(text), "utf8").toString("base64")}\x07`;
}

/** Hand a URL to a real browser — the terminal analog of a redirect. Zero-dep
 *  (node:child_process). Opener order: $BROWSER → platform default. Detached +
 *  unref so a launched browser can never hold or block the Node event loop
 *  (teardown discipline). Returns false only if spawn threw *synchronously*
 *  (no opener attempted); an async spawn failure (e.g. ENOENT — no xdg-open)
 *  invokes `onSpawnError`. Callers map BOTH false and onSpawnError to the loud
 *  interstitial, so a redirect is never silently lost. Exported so a unit test
 *  can drive it with a stubbed node:child_process. */
export function openExternal(url: string, onSpawnError?: () => void): boolean {
  const br = process.env.BROWSER;
  const [cmd, args]: [string, string[]] =
    br && br.trim()
      ? [br, [url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : process.platform === "win32"
          ? ["cmd", ["/c", "start", "", url]]
          : ["xdg-open", [url]];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.once("error", () => onSpawnError?.());
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** How the vms-tui CLI's default onRedirect classifies a server redirect.
 *  No new wire — pure URL/origin analysis against the current endpoint. A
 *  relative path resolves against the endpoint ⇒ same-origin by construction;
 *  an absolute URL is same-origin iff its `origin` matches (origin compare,
 *  never a string prefix — `http://evil/?x=http://good` must NOT pass). */
export type RedirectKind =
  | { kind: "same-origin"; endpoint: string }
  | { kind: "different-origin"; url: string }
  | { kind: "invalid"; url: string };

export function classify(url: string, fromEndpoint: string): RedirectKind {
  const u = (url ?? "").trim();
  if (!u) return { kind: "invalid", url };
  let abs: URL;
  try {
    abs = new URL(u); // absolute?
  } catch {
    try {
      // relative → resolve against the current endpoint ⇒ same-origin.
      return { kind: "same-origin", endpoint: new URL(u, fromEndpoint).toString() };
    } catch {
      return { kind: "invalid", url };
    }
  }
  try {
    return abs.origin === new URL(fromEndpoint).origin
      ? { kind: "same-origin", endpoint: abs.toString() }
      : { kind: "different-origin", url: abs.toString() };
  } catch {
    return { kind: "invalid", url };
  }
}

const isTruthyFormValue = (v?: string): boolean =>
  !!v && v !== "false" && v !== "0";

/** A per-column-filter identity. A `TableColumn` object is reused for the
 *  sortable header's focus mapping, so its filter input needs a DISTINCT,
 *  stable-within-a-render identity for `map`/`rctx.focusKey`. WeakMap keyed by
 *  the column object → the same sentinel in collectFocusables and the renderer
 *  of one render pass; a fresh column object each server re-render makes a new
 *  sentinel (focus continuity is by key string + reconcile(), never object
 *  identity — same as every other focusable). */
const _filterIdent = new WeakMap<object, object>();
function filterIdent(col: object): object {
  let o = _filterIdent.get(col);
  if (!o) {
    o = {};
    _filterIdent.set(col, o);
  }
  return o;
}

/** Terminal display width, Unicode-aware enough for table column alignment.
 *  Strips CSI/OSC escapes (incl. OSC 8) so a measured cell never includes
 *  hyperlink bytes — the Phase-1 string-width over-count, here avoided by not
 *  depending on string-width at all (zero new deps). Cells are width-bounded
 *  Boxes, so a misestimate of an exotic glyph is at worst cosmetic, never the
 *  Phase-1/5a layout corruption. */
function dispWidth(s: string): number {
  const clean = s
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-9;]*m/g, "");
  let w = 0;
  for (const ch of clean) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0) continue;
    if (
      (cp >= 0x300 && cp <= 0x36f) ||
      cp === 0x200d ||
      (cp >= 0xfe00 && cp <= 0xfe0f)
    )
      continue; // combining / ZWJ / variation selectors → width 0
    if (
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6) ||
      (cp >= 0x1f300 && cp <= 0x1faff) ||
      (cp >= 0x20000 && cp <= 0x3fffd)
    )
      w += 2; // wide (CJK / fullwidth / emoji)
    else w += 1;
  }
  return w;
}

/** Pure pre-pass: every focusable in tree order + an object→key map used by
 *  the renderer to highlight the focused node. Same identity heuristic the
 *  roadmap locks (id / name / action.name, else positional), made unique
 *  deterministically so the ring is unambiguous and stable across renders. */
function collectFocusables(vm: ViewNode): {
  list: Focusable[];
  map: Map<object, string>;
} {
  const list: Focusable[] = [];
  const map = new Map<object, string>();
  const counts = new Map<string, number>();
  const uniq = (base: string): string => {
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    return n === 0 ? base : `${base}#${n}`;
  };

  const visit = (node: ViewNode, form?: FormNode): void => {
    switch (node.type) {
      case "button": {
        const k = uniq(node.action?.name ?? node.label ?? "button");
        map.set(node, k);
        list.push({ key: k, kind: "button", node, form });
        return;
      }
      case "checkbox": {
        if (!node.action) return; // not actionable → not in the ring
        const k = uniq(node.name ?? node.action.name ?? "checkbox");
        map.set(node, k);
        list.push({ key: k, kind: "checkbox", node, form });
        return;
      }
      case "tabs": {
        for (const t of node.tabs ?? []) {
          const k = uniq(`${node.action?.name ?? "tabs"}:${t.value}`);
          map.set(t, k);
          list.push({ key: k, kind: "tabs-tab", node, form, tab: t });
        }
        return;
      }
      case "copy-button": {
        const k = uniq(node.label ?? "copy");
        map.set(node, k);
        list.push({ key: k, kind: "copy", node, form });
        return;
      }
      case "link": {
        if (!(node.href ?? "").trim()) return; // blank href → plain text (P1)
        const k = uniq(node.href ?? node.label ?? "link");
        map.set(node, k);
        list.push({ key: k, kind: "link", node, form });
        return;
      }
      case "field": {
        const it = node.inputType;
        if (it === "hidden" || it === "file") return;
        // invisible (hidden) / deferred (file) → not focusable. textarea/code
        // focusable since Phase 5a (multi-line editor); select/select-multiple
        // focusable since Phase 5b (pickers).
        const k = uniq(node.name ?? "field");
        map.set(node, k);
        list.push({ key: k, kind: "field", node, form });
        return;
      }
      case "form": {
        for (const c of node.children ?? []) visit(c, node);
        const k = uniq(node.submitAction?.name ?? "submit");
        map.set(node, k); // the form node carries its synthetic submit's key
        list.push({ key: k, kind: "form-submit", node, form: node });
        return;
      }
      case "modal":
        // Walk body + footer so a modal-rooted call (the focus trap) yields
        // the modal's own focusables. Harmless on a whole-tree walk with no
        // modal present (there are none); the App roots this at the modal
        // when one is open so base focusables are excluded.
        for (const c of node.children ?? []) visit(c, form);
        for (const c of node.footer ?? []) visit(c, form);
        return;
      case "table": {
        // Phase 5d. Visual/tab order mirrors the browser DOM: sortable
        // headers L→R, then filterable filter inputs L→R, then action rows
        // T→B. Header maps off the `col` object; the filter input maps off a
        // DISTINCT per-column sentinel (filterIdent) so a sortable+filterable
        // column has two unambiguous focus targets. Keys via uniq() keep
        // global uniqueness across multiple tables (the established pattern).
        const t = node as TableNode;
        const cols = t.columns ?? [];
        if (t.sortAction)
          for (const col of cols)
            if (col.sortable) {
              const k = uniq(`tbl-sort:${col.key}`);
              map.set(col, k);
              list.push({ key: k, kind: "table-sort", node: t, col, form });
            }
        if (t.filterAction)
          for (const col of cols)
            if (col.filterable) {
              const k = uniq(`tbl-filter:${col.key}`);
              map.set(filterIdent(col), k);
              list.push({ key: k, kind: "table-filter", node: t, col, form });
            }
        (t.rows ?? []).forEach((row, ri) => {
          if (row.action) {
            const k = uniq(`tbl-row:${row.id ?? ri}`);
            map.set(row, k);
            list.push({ key: k, kind: "table-row", node: t, row, form });
          }
        });
        return;
      }
      case "page":
      case "section":
      case "list":
      case "list-item":
        for (const c of node.children ?? []) visit(c, form);
        return;
      default: // text, stat-bar, progress → not focusable
        return;
    }
  };

  visit(vm);
  return { list, map };
}

/** Depth-first first `modal` in the tree. Single-modal is the framework's
 *  implied contract; nested/multiple → first wins (documented). Render-only:
 *  no wire change. */
function findModal(node: ViewNode): ModalNode | undefined {
  if (node.type === "modal") return node;
  const kids = (node as { children?: ViewNode[] }).children;
  if (kids) for (const c of kids) {
    const m = findModal(c);
    if (m) return m;
  }
  const footer = (node as { footer?: ViewNode[] }).footer;
  if (footer) for (const c of footer) {
    const m = findModal(c);
    if (m) return m;
  }
  return undefined;
}

/** Resolves a field's *current* value — Phase 3: the user-typed draft when
 *  present, else the server value. The default (server value) makes any
 *  caller without drafts behave exactly as Phase 2 did. */
type FieldValue = (field: FieldNode) => string;
const serverValue: FieldValue = (f) => f.value ?? "";

/** Collect a form's field values for submission. Mirrors BrowserAdapter:
 *  deferred input types skipped, form-checkbox → "true"/"false", hidden
 *  included. Values come from `resolve` (draft-aware on the interactive
 *  path; server value otherwise — so untyped == Phase 2). */
function collectForm(
  form: FormNode,
  resolve: FieldValue = serverValue,
): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (node: ViewNode): void => {
    if (node.type === "field") {
      const f = node as FieldNode;
      const it = f.inputType;
      if (it === "file") {
        return; // deferred input type — not collected
      }
      // select → chosen value; select-multiple → comma-joined values
      // (AGENTS.md "Multi-select submits comma-joined"); both round-trip the
      // draft-aware `resolve` (Phase 5b), exactly like the text family.
      if (it === "checkbox") out[f.name] = isTruthyFormValue(resolve(f)) ? "true" : "false";
      else out[f.name] = resolve(f);
      return;
    }
    const kids = (node as { children?: ViewNode[] }).children;
    if (kids) for (const c of kids) walk(c);
  };
  for (const c of form.children ?? []) walk(c);
  return out;
}

function submitOf(form: FormNode, resolve: FieldValue = serverValue): ActionEvent {
  return {
    name: form.submitAction.name,
    context: { ...(form.submitAction.context ?? {}), ...collectForm(form, resolve) },
  };
}

/** The single-line `field` input types that become an editable `<TextInput>`
 *  when focused on a TTY. NOT: hidden (invisible), checkbox (toggle),
 *  textarea/code (multi-line — handled by isEditableMultiLine + the
 *  MultilineEditor), or the still-deferred tier (select/select-multiple/file).
 *  Unknown types fall through to text — same fail-soft as the renderer. */
function isEditableSingleLine(it: string | undefined): boolean {
  return (
    it !== "hidden" &&
    it !== "checkbox" &&
    it !== "textarea" &&
    it !== "code" &&
    it !== "select" &&
    it !== "select-multiple" &&
    it !== "file"
  );
}

/** Phase 5a: the multi-line `field` input types that become an editable
 *  `<MultilineEditor>` when focused on a TTY. `code` is rendered identically
 *  to `textarea` plus a dim language-hint label; literal-tab insertion is
 *  intentionally deferred (Tab always traverses the focus ring — the locked
 *  input-arbitration invariant). */
function isEditableMultiLine(it: string | undefined): boolean {
  return it === "textarea" || it === "code";
}

/** Phase 5b: the `field` input types that become an interactive picker when
 *  focused on a TTY — `select` (single, via `ink-select-input`) and
 *  `select-multiple` (multi, via the contained `MultiSelectInput`). Not a text
 *  editor (so deliberately NOT in isEditableSingleLine); it joins the editing
 *  gate so the focused picker owns Up/Down/Enter/Space while App keeps Tab/
 *  Shift-Tab (ring) + Ctrl-C (teardown). */
function isSelect(it: string | undefined): boolean {
  return it === "select" || it === "select-multiple";
}

/** Reconcile the focused key against a (possibly new) focusable list — the
 *  roadmap's continuity rule: keep it if still present; else clamp to the
 *  prior index position; else first; else none. */
function reconcile(
  keys: string[],
  focusedKey: string | null,
  prev: { keys: string[]; key: string | null } | undefined,
): string | null {
  if (keys.length === 0) return null;
  if (focusedKey && keys.includes(focusedKey)) return focusedKey;
  if (prev && prev.key) {
    const pi = prev.keys.indexOf(prev.key);
    if (pi >= 0) return keys[Math.min(pi, keys.length - 1)] ?? keys[0]!;
  }
  return keys[0]!;
}

/** Full-screen loud notice (failed/external/invalid redirect, storage I/O
 *  failure). Pure render — NO useInput of its own: it is shown by swapping
 *  App's rendered subtree, App's existing sole useInput stays mounted, so the
 *  unconditional Ctrl-C → requestExit branch still quits and the Phase 0–3
 *  teardown topology is unchanged (no new input hook). */
function Interstitial({ msg }: { msg: string }): ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      <Text bold color="yellow">
        ⚠  Action required
      </Text>
      <Box marginTop={1}>
        <Text>{msg}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Ctrl-C to quit.</Text>
      </Box>
    </Box>
  );
}

/**
 * Phase 5a contained multi-line editor for `textarea`/`code`. Built ONLY on
 * Ink's already-vetted primitives (useInput key-decode, Box, Text) — there is
 * no mature Ink-5/React-18-compatible multi-line lib (every option is pre-1.0
 * and either abandoned or forces a forbidden Ink 6/7 + React 19 bump), so a
 * contained editor is the only path respecting the locked toolkit + the
 * zero-blast-radius invariant. Zero new dependencies.
 *
 * Controlled (value/onChange — the App draft map is the single source of
 * truth, exactly like the single-line `<TextInput>`). Internal {row,col}
 * caret in useState, held in the stable component instance (key="input" under
 * the stable App root) so it survives the shell's instance.rerender() — the
 * Phase-3 caret-continuity mechanism, one level down.
 *
 * Input contract MIRRORS ink-text-input so the two-handler arbitration with
 * App's root useInput stays collision-free: this editor EARLY-RETURNS Ctrl-C
 * (App owns teardown → requestExit(130)) and Tab/Shift-Tab (App owns ring
 * traversal — the locked invariant; `code` is therefore NOT literal-tab
 * aware, by design), and owns char insert / Enter→newline / Backspace+Delete
 * / Left/Right (wrapping across lines) / Up/Down (clamped). A multi-char paste
 * burst is inserted verbatim; embedded CR/LF split lines (Phase-3 paste rule).
 * Form submission stays the focus ring's submit button (the user Tabs out) —
 * Enter never submits a multi-line field; field `action`/Enter-dispatch is
 * N/A for multi-line.
 */
function MultilineEditor(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  focus: boolean;
}): ReactElement {
  const split = (s: string): string[] => (s.length === 0 ? [""] : s.split("\n"));
  // Caret starts at the END of the initial value (focusing a pre-filled field
  // puts the caret after the text — mirrors ink-text-input's UX). Lazy
  // initializer runs ONCE at mount, never on the shell's rerenders, so caret
  // continuity holds (the Phase-3 mechanism, one level down).
  const [cursor, setCursor] = useState<{ row: number; col: number }>(() => {
    const ls = split(props.value);
    return { row: ls.length - 1, col: (ls[ls.length - 1] ?? "").length };
  });
  const lines = split(props.value);
  // Clamp for render (value may have shrunk via server-wins before the effect
  // below re-syncs the stored cursor).

  // Re-clamp the stored caret when the controlled value shrinks (mirrors
  // ink-text-input's clamp effect). Guarded → no extra render when unchanged.
  useEffect(() => {
    const ls = split(props.value);
    setCursor((c) => {
      const r = Math.min(c.row, ls.length - 1);
      const col = Math.min(c.col, (ls[r] ?? "").length);
      return r === c.row && col === c.col ? c : { row: r, col };
    });
  }, [props.value]);

  useInput(
    (input, key) => {
      // App owns these — never consume them (Ink calls every useInput; no
      // bubbling, so a plain return cedes the key).
      if (key.ctrl && input === "c") return; // → App requestExit(130)
      if (key.tab) return; // Tab / Shift-Tab → App ring traversal (locked)

      const cur = split(props.value);
      const r = Math.min(cursor.row, cur.length - 1);
      const c = Math.min(cursor.col, (cur[r] ?? "").length);
      const commit = (next: string[], nr: number, nc: number): void => {
        props.onChange(next.join("\n"));
        setCursor({ row: nr, col: nc });
      };

      if (key.return) {
        const line = cur[r] ?? "";
        const next = [
          ...cur.slice(0, r),
          line.slice(0, c),
          line.slice(c),
          ...cur.slice(r + 1),
        ];
        commit(next, r + 1, 0);
        return;
      }
      if (key.leftArrow) {
        if (c > 0) setCursor({ row: r, col: c - 1 });
        else if (r > 0) setCursor({ row: r - 1, col: (cur[r - 1] ?? "").length });
        return;
      }
      if (key.rightArrow) {
        if (c < (cur[r] ?? "").length) setCursor({ row: r, col: c + 1 });
        else if (r < cur.length - 1) setCursor({ row: r + 1, col: 0 });
        return;
      }
      if (key.upArrow) {
        if (r > 0)
          setCursor({
            row: r - 1,
            col: Math.min(c, (cur[r - 1] ?? "").length),
          });
        return;
      }
      if (key.downArrow) {
        if (r < cur.length - 1)
          setCursor({
            row: r + 1,
            col: Math.min(c, (cur[r + 1] ?? "").length),
          });
        return;
      }
      if (key.backspace || key.delete) {
        // Backspace semantics (delete the char BEFORE the caret) for both —
        // matches ink-text-input, so single- and multi-line editing feel
        // identical. Forward-delete is intentionally deferred.
        if (c > 0) {
          const line = cur[r] ?? "";
          const next = [...cur];
          next[r] = line.slice(0, c - 1) + line.slice(c);
          commit(next, r, c - 1);
        } else if (r > 0) {
          const prev = cur[r - 1] ?? "";
          const next = [
            ...cur.slice(0, r - 1),
            prev + (cur[r] ?? ""),
            ...cur.slice(r + 1),
          ];
          commit(next, r - 1, prev.length);
        }
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        // Printable / paste burst. Normalize CR(LF) so a pasted multi-line
        // block splits cleanly.
        const text = input.replace(/\r\n?/g, "\n");
        const line = cur[r] ?? "";
        const parts = (line.slice(0, c) + text + line.slice(c)).split("\n");
        const next = [...cur.slice(0, r), ...parts, ...cur.slice(r + 1)];
        const last = parts[parts.length - 1]!;
        commit(
          next,
          r + parts.length - 1,
          parts.length === 1 ? c + text.length : last.length,
        );
      }
    },
    { isActive: props.focus },
  );

  const empty = props.value.length === 0;
  if (empty && !props.focus) {
    return (
      <Text dimColor>{props.placeholder ? props.placeholder : " "}</Text>
    );
  }
  return (
    <Box flexDirection="column">
      {lines.map((ln, i) => (
        // One flat <Text> per line. A nested in-text caret element corrupts
        // Ink/Yoga width measurement inside the live focusWrap + bordered-box
        // tree (the Phase-1 mixed-<Text> width lesson — verified: split caret
        // wraps "hello" into per-char lines; one flat <Text> renders clean).
        // Focus is signalled by focusWrap's leading ▸; the caret is tracked
        // internally for edit logic. Rendering a caret glyph is a documented
        // deferred polish (would also fragment the value-substring tests).
        <Text key={i}>{ln === "" ? " " : ln}</Text>
      ))}
    </Box>
  );
}

/**
 * Phase 5b contained multi-select picker for `select-multiple`. Built ONLY on
 * Ink's already-vetted primitives — `ink-select-input` (the locked, mature
 * Ink-5/React-18 lib used for single `select`) is single-select only, and no
 * mature Ink-5/React-18 multi-select lib documents the Tab/Shift-Tab/Ctrl-C
 * pass-through this codebase's input-arbitration depends on (`ink-multi-select`
 * is dead — ink^3/react^16; `@inkjs/ui` MultiSelect's key handling is
 * undocumented). Same precedent + rationale as Phase-5a's `MultilineEditor`:
 * contained component, zero new deps, exact known keyboard contract.
 *
 * CONTROLLED by `value` (comma-joined, the wire shape — AGENTS.md "Multi-select
 * submits comma-joined"; Showcase emits `value:"a,c"`). The selected SET is
 * derived from `value` every render, so it is server-authoritative by
 * construction: when App drops the select draft on a server re-render (selects
 * are excluded from draft preservation — AGENTS.md), `value` becomes the server
 * value and the rendered selection follows. Only the highlight index is
 * internal (a cursor, not a value — fine to persist across re-renders, like
 * MultilineEditor's caret).
 *
 * Input contract MIRRORS MultilineEditor/ink-text-input: EARLY-RETURNS Ctrl-C
 * (App owns teardown → requestExit(130)) and Tab/Shift-Tab (App owns ring
 * traversal — locked); owns Up/Down (move highlight) and Space (toggle the
 * highlighted option). Enter is inert here (App's editing branch also returns
 * on Enter) — submission stays the ring's submit button (the user Tabs out),
 * exactly like a browser multi-select element.
 */
function MultiSelectInput(props: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  focus: boolean;
}): ReactElement {
  const parse = (s: string): string[] =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);
  const opts = props.options;
  const [hi, setHi] = useState(0);
  const selected = new Set(parse(props.value));

  useInput(
    (input, key) => {
      // App owns these — never consume them (Ink calls every useInput; no
      // bubbling, so a plain return cedes the key).
      if (key.ctrl && input === "c") return; // → App requestExit(130)
      if (key.tab) return; // Tab / Shift-Tab → App ring traversal (locked)
      if (key.upArrow) {
        setHi((h) => (opts.length ? (h - 1 + opts.length) % opts.length : 0));
        return;
      }
      if (key.downArrow) {
        setHi((h) => (opts.length ? (h + 1) % opts.length : 0));
        return;
      }
      if (input === " ") {
        const o = opts[hi];
        if (!o) return;
        const next = new Set(parse(props.value));
        if (next.has(o.value)) next.delete(o.value);
        else next.add(o.value);
        // Preserve option order in the comma-joined wire value.
        const joined = opts
          .filter((x) => next.has(x.value))
          .map((x) => x.value)
          .join(",");
        props.onChange(joined);
        return;
      }
      // Enter / anything else: inert (App's editing branch also returns).
    },
    { isActive: props.focus },
  );

  if (opts.length === 0) return <Text dimColor> </Text>;
  return (
    <Box flexDirection="column">
      {opts.map((o, i) => {
        const on = selected.has(o.value);
        const cur = i === hi;
        // ONE flat <Text> per row — a nested styled span mid-string corrupts
        // Ink/Yoga width measurement inside the live focusWrap+border tree
        // (the Phase-1/5a mixed-<Text> width lesson).
        return (
          <Text key={o.value} color={cur ? "cyan" : undefined}>
            {(cur ? "▸ " : "  ") + (on ? "[x] " : "[ ] ") + o.label}
          </Text>
        );
      })}
    </Box>
  );
}

/**
 * Phase 5d — table per-column filter editor. A thin wrapper over
 * `ink-text-input` (already a dependency since Phase 3 — ZERO new deps),
 * mounted ONLY when its filter cell is focused on a TTY (the select/multiline
 * precedent). ink-text-input@6 early-returns Tab/Shift-Tab/Up/Down/Ctrl-C, so
 * App keeps ring traversal + teardown; it owns char/Backspace/Left/Right and
 * fires `onSubmit` on Enter → the filterAction dispatch (browser.ts parity).
 * A focused table-filter also joins App's `editing` gate (kind
 * "table-filter") so ring-mode arrow handling can't collide with the editor's
 * cursor — the two input handlers never fight.
 */
function TableFilterInput(props: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  focus: boolean;
}): ReactElement {
  return (
    <TextInput
      focus={props.focus}
      value={props.value}
      placeholder="filter…"
      onChange={props.onChange}
      onSubmit={props.onSubmit}
    />
  );
}

/** The stateful root. Mounted ONCE; the shell's poll/dispatch re-renders
 *  reconcile the SAME component instance (React preserves its focus state) —
 *  this is why a stable root component, not a bare tree. */
function App(props: {
  vm: ViewNode;
  onAction: (a: ActionEvent) => void;
  requestExit: (code: number) => void;
  interstitial?: string | null;
  viewport?: "fill" | "content";
  renderWith: (vm: ViewNode, rctx: RCtx) => ReactElement;
}): ReactElement {
  const { vm, renderWith } = props;
  const { isRawModeSupported } = useStdin();
  const { write, stdout } = useStdout();
  // `=== true` is LOAD-BEARING, not defensive. Ink's App.isRawModeSupported()
  // returns `this.props.stdin.isTTY`, which is `true` on a TTY but `undefined`
  // (never `false`) on a non-TTY stdin (pipe / </dev/null / agent / CI). Ink's
  // useInput skips raw mode ONLY when `options.isActive === false` (strict).
  // So passing the raw `undefined` as isActive does NOT skip → Ink calls
  // setRawMode → throws "Raw mode is not supported" and dumps a react error
  // frame on the non-TTY path. Coercing to a real boolean makes the gate
  // `{ isActive: false }`, which Ink honors → clean static render. (A TTY
  // gives `true`; ink-testing-library gives `true` → tests unchanged.)
  const interactive = isRawModeSupported === true;

  // Viewport fill (0.4.5). On a real interactive terminal, occupy the whole
  // window so layout presets — especially `sidebar`'s flexGrow main pane —
  // can expand: the terminal analog of BrowserAdapter filling the viewport
  // via CSS. Gated on the REAL process TTYs, NOT Ink's isRawModeSupported
  // (which ink-testing-library forces `true`): under vitest
  // `process.stdout.isTTY` is false ⇒ no wrap ⇒ every existing App and
  // conformance frame stays byte-identical by construction (and the pure
  // `renderTree` path never reaches here). Opt out with
  // `new TuiAdapter({ viewport: "content" })`.
  const realTTY =
    process.stdout.isTTY === true && process.stdin.isTTY === true;
  const fillViewport = realTTY && props.viewport !== "content";
  const [vp, setVp] = useState<{ cols?: number; rows?: number }>(() => ({
    cols: stdout?.columns,
    rows: stdout?.rows,
  }));
  useEffect(() => {
    if (!fillViewport || !stdout) return;
    const onResize = (): void =>
      setVp({ cols: stdout.columns, rows: stdout.rows });
    onResize(); // sync to the live size on (re)mount
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [fillViewport, stdout]);

  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // User-typed field drafts, keyed by focus key. Mirrors BrowserAdapter's
  // draft-preservation: a draft survives the shell's poll/dispatch
  // re-renders unless the field disappears or the SERVER changes that
  // field's authoritative value (then the server wins).
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Phase 5c: a modal traps focus. Detect it (interactive only — non-TTY/unit
  // renders the whole tree inline, preserving the Phase-1 non-TTY contract +
  // deterministic static tests) and root the focus ring at the modal subtree
  // so base focusables are excluded while it is open.
  const modal = interactive ? findModal(vm) : undefined;
  const { list, map } = collectFocusables(modal ?? vm);
  const keys = list.map((d) => d.key);
  const prevRef = useRef<{ keys: string[]; key: string | null } | undefined>(
    undefined,
  );
  const effective = interactive
    ? reconcile(keys, focusedKey, prevRef.current)
    : null;

  // Latest-value refs so the (single, stable) input handler never goes stale.
  const onActionRef = useRef(props.onAction);
  onActionRef.current = props.onAction;
  const requestExitRef = useRef(props.requestExit);
  requestExitRef.current = props.requestExit;
  // Same single useInput — NOT a new hook. While an interstitial is shown the
  // ring is inert (only Ctrl-C acts) so a stray key can't dispatch into the
  // shell behind a terminal notice. Mirrors the existing editingRef guard.
  const interstitialActiveRef = useRef<boolean>(props.interstitial != null);
  interstitialActiveRef.current = props.interstitial != null;
  // Phase 5c — same single useInput (NOT a new hook): a ref-gated Esc branch,
  // exactly mirroring interstitialActiveRef. tui-cli.ts stays unchanged ⇒
  // teardown topology identical to Phase 4 (safe by construction; PTY-verified).
  const modalActiveRef = useRef<boolean>(modal != null);
  modalActiveRef.current = modal != null;
  const dismissActionRef = useRef<ActionEvent | null>(
    modal?.dismissAction ?? null,
  );
  dismissActionRef.current = modal?.dismissAction ?? null;
  const listRef = useRef(list);
  listRef.current = list;
  const effectiveRef = useRef(effective);
  effectiveRef.current = effective;
  const writeRef = useRef(write);
  writeRef.current = write;
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // Per-render snapshot of every DRAFTABLE focusable's server value, vs the
  // previous render's snapshot — the change detector for "server wins".
  // Draftable = `field` (Phase 3/5a/5b) + Phase-5d `table-filter` inputs
  // (server value = the column's `filterValue`). The field path is
  // byte-identical to Phase 5b — table-filter rows are purely ADDITIVE, so
  // every existing field/draft test is unaffected.
  const draftableDescs = list.filter(
    (d) => d.kind === "field" || d.kind === "table-filter",
  );
  const serverValOf = (d: Focusable): string =>
    d.kind === "table-filter"
      ? ((d.col as TableColumn).filterValue ?? "")
      : ((d.node as FieldNode).value ?? "");
  const fieldKeysNow = new Set(draftableDescs.map((d) => d.key));
  const fieldServerNow: Record<string, string> = {};
  for (const d of draftableDescs) fieldServerNow[d.key] = serverValOf(d);
  const prevServerRef = useRef<Record<string, string>>({});
  // Phase 5b: focus keys of select/select-multiple fields. Selects are
  // EXCLUDED from draft preservation (AGENTS.md: can't distinguish
  // "server set this" from "user changed it") — so a select draft is
  // server-authoritative the moment a SERVER re-render arrives, even if that
  // field's value is unchanged (the inverse of the text draft-survival rule).
  const selectKeysNow = new Set(
    draftableDescs
      .filter(
        (d) =>
          d.kind === "field" && isSelect((d.node as FieldNode).inputType),
      )
      .map((d) => d.key),
  );
  // A server re-render is observable as a new `vm` object identity (the shell
  // passes a freshly-parsed vm each render(); a local setState re-render keeps
  // the SAME vm prop). First render: undefined → not a "server" render.
  const prevVmRef = useRef<ViewNode | undefined>(undefined);
  const isServerRender =
    prevVmRef.current !== undefined && prevVmRef.current !== vm;

  /** Effective draft for a focus key: the typed value when it should still
   *  win — i.e. there IS a draft, the field still exists, and the server
   *  hasn't changed that field's value since we last saw it. Otherwise
   *  undefined → caller falls back to the server value. */
  const draftFor = (k: string): string | undefined => {
    if (!(k in draft)) return undefined;
    if (!fieldKeysNow.has(k)) return undefined; // field / table-filter gone
    if (prevServerRef.current[k] !== fieldServerNow[k]) return undefined; // server changed → authoritative
    if (selectKeysNow.has(k) && isServerRender) return undefined; // selects: server-authoritative across ANY server re-render (AGENTS.md — excluded from draft preservation)
    return draft[k];
  };

  const resolve: FieldValue = (f: FieldNode) => {
    const k = map.get(f);
    const dv = k != null ? draftFor(k) : undefined;
    return dv ?? f.value ?? "";
  };

  const focusedDesc = list.find((d) => d.key === effective);
  const editing =
    interactive &&
    ((focusedDesc?.kind === "field" &&
      (isEditableSingleLine((focusedDesc.node as FieldNode).inputType) ||
        isEditableMultiLine((focusedDesc.node as FieldNode).inputType) ||
        isSelect((focusedDesc.node as FieldNode).inputType))) ||
      // Phase 5d: a focused table FILTER input is an editable <TextInput>; it
      // joins the editing gate so App cedes char/Left/Right/Enter to it and
      // keeps ONLY Tab/Shift-Tab (ring) + Ctrl-C (teardown). Without this,
      // ring-mode arrow handling would collide with the editor's cursor and
      // Down/Right would jump focus mid-type. The `field` disjunct above is
      // byte-identical → zero field/form behavior change. table-sort /
      // table-row stay ring-mode (Enter/Space → activate).
      focusedDesc?.kind === "table-filter");
  const editingRef = useRef(editing);
  editingRef.current = editing;

  useEffect(() => {
    if (effective !== focusedKey) setFocusedKey(effective);
    prevRef.current = { keys, key: effective };
  });
  // Prune stale drafts (field gone, or server changed its value) and record
  // this render's server snapshot for the next render's change detection.
  // Guarded so an unchanged draft map keeps its identity → no extra render.
  useEffect(() => {
    setDraft((prev) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const k of Object.keys(prev)) {
        const stale =
          !fieldKeysNow.has(k) ||
          prevServerRef.current[k] !== fieldServerNow[k] ||
          (selectKeysNow.has(k) && isServerRender); // selects never survive a server re-render
        if (stale) {
          changed = true;
          continue;
        }
        next[k] = prev[k]!;
      }
      return changed ? next : prev;
    });
    prevServerRef.current = fieldServerNow;
    prevVmRef.current = vm;
  });
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const doCopy = (key: string, text: string): void => {
    try {
      writeRef.current(osc52(text));
    } catch {
      /* OSC 52 unsupported terminals: silent, like the browser clipboard */
    }
    setCopiedKey(key);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedKey(null), 1500);
  };

  /** Field Enter (its own action → dispatch {[name]: current}; else submit
   *  the enclosing form). `current` is the draft-aware resolved value. */
  const submitField = (d: Focusable): void => {
    const dispatch = onActionRef.current;
    const node = d.node as FieldNode;
    if (node.action) {
      const cur = draftFor(d.key) ?? node.value ?? "";
      dispatch({
        name: node.action.name,
        context: { ...(node.action.context ?? {}), [node.name]: cur },
      });
    } else if (d.form) {
      dispatch(submitOf(d.form, resolve));
    }
  };

  /** Space on a form-`checkbox` field → flip its draft boolean. */
  const toggleCheckboxDraft = (d: Focusable): void => {
    const node = d.node as FieldNode;
    const cur = draftFor(d.key) ?? node.value ?? "";
    const nextVal = isTruthyFormValue(cur) ? "false" : "true";
    setDraft((s) => ({ ...s, [d.key]: nextVal }));
  };

  const onFieldSubmit = (field: FieldNode): void => {
    const k = map.get(field);
    const d = list.find((x) => x.key === k);
    if (d) submitField(d);
  };

  /** Phase 5d — a table per-column filter's Enter. Mirrors BrowserAdapter
   *  (browser.ts): dispatch `filterAction` merged with { column, value,
   *  filters }, where `filters` is EVERY filterable column's current text
   *  (draft else server `filterValue`) and `value` is this column's. */
  const tableFilter = (table: TableNode, col: TableColumn): void => {
    const fa = table.filterAction;
    if (!fa) return;
    const textOf = (c: TableColumn): string => {
      const fk = map.get(filterIdent(c));
      const dv = fk != null ? draftFor(fk) : undefined;
      return dv ?? c.filterValue ?? "";
    };
    const filters: Record<string, string> = {};
    for (const c of table.columns ?? [])
      if (c.filterable) filters[c.key] = textOf(c);
    onActionRef.current({
      name: fa.name,
      context: {
        ...(fa.context ?? {}),
        column: col.key,
        value: textOf(col),
        filters,
      },
    });
  };

  const activate = (d: Focusable, trigger: "enter" | "space"): void => {
    const dispatch = onActionRef.current;
    switch (d.kind) {
      case "button":
        dispatch({
          name: d.node.action.name,
          context: { ...(d.node.action.context ?? {}) },
        });
        break;
      case "checkbox":
        if (d.node.action)
          dispatch({
            name: d.node.action.name,
            context: { ...(d.node.action.context ?? {}), checked: !d.node.checked },
          });
        break;
      case "tabs-tab":
        dispatch({
          name: d.node.action.name,
          context: { ...(d.node.action.context ?? {}), value: d.tab!.value },
        });
        break;
      case "field": {
        const node = d.node as FieldNode;
        if (node.inputType === "checkbox") {
          if (trigger === "space") toggleCheckboxDraft(d);
          else submitField(d); // Enter on a form-checkbox → submit / its action
        } else {
          // Editable single-line fields are driven by ink-text-input's
          // onSubmit in editing mode and never reach here; this is a safety
          // net (e.g. a field somehow activated in ring mode) — treat as submit.
          submitField(d);
        }
        break;
      }
      case "form-submit":
        dispatch(submitOf(d.node as FormNode, resolve));
        break;
      case "copy":
        doCopy(d.key, d.node.text);
        break;
      case "link":
        doCopy(d.key, d.node.href);
        break;
      case "table-sort": {
        // browser.ts parity: toggle asc↔desc only when this column is the
        // current sortColumn AND was asc; otherwise default to asc.
        const t = d.node as TableNode;
        const col = d.col;
        const sa = t.sortAction;
        if (!col || !sa) break;
        const isSorted = t.sortColumn === col.key;
        const nextDir =
          isSorted && t.sortDirection === "asc" ? "desc" : "asc";
        dispatch({
          name: sa.name,
          context: {
            ...(sa.context ?? {}),
            column: col.key,
            direction: nextDir,
          },
        });
        break;
      }
      case "table-row":
        // Verbatim, no merge — mirrors BrowserAdapter `on(rowAction)`.
        if (d.row?.action) dispatch(d.row.action);
        break;
      case "table-filter":
        // Editable: the focused <TextInput>'s onSubmit (→ rctx.onTableFilter)
        // owns the dispatch. Unreachable while editing (App returns before the
        // ring-activate line); a defensive no-op for any edge path.
        break;
    }
  };

  useInput(
    (input, key) => {
      if (key.ctrl && input === "c") {
        requestExitRef.current(130);
        return;
      }
      if (interstitialActiveRef.current) return; // notice up: only Ctrl-C acts
      if (modalActiveRef.current && key.escape) {
        // Esc dismisses a modal IFF it carries a dismissAction (AGENTS.md:
        // no dismissAction & no footer ⇒ non-dismissible — never synthesize a
        // close). Placed before the ring-empty + editing branches so a
        // text-only dismissible modal still closes, and Esc cancels even from
        // within a body field (ink-text-input/MultilineEditor don't consume
        // Esc). Non-Esc keys fall through to the trapped ring below.
        if (dismissActionRef.current)
          onActionRef.current(dismissActionRef.current);
        return;
      }
      const ring = listRef.current;
      if (ring.length === 0) return;
      let idx = ring.findIndex((d) => d.key === effectiveRef.current);
      if (idx < 0) idx = 0;
      const goNext = (): void =>
        setFocusedKey(ring[(idx + 1) % ring.length]!.key);
      const goPrev = (): void =>
        setFocusedKey(ring[(idx - 1 + ring.length) % ring.length]!.key);
      if (editingRef.current) {
        // Editing a field: ink-text-input owns char insert / Backspace /
        // Delete / Left / Right and fires onSubmit on Enter. App keeps ONLY
        // ring traversal (Tab/Shift-Tab) + Ctrl-C (handled above). Everything
        // else is intentionally inert so the two input handlers don't collide.
        // (ink-text-input itself early-returns Tab/Shift-Tab/Up/Down/Ctrl-C,
        // so those reach this handler cleanly.)
        if (key.tab && !key.shift) goNext();
        else if (key.tab && key.shift) goPrev();
        return;
      }
      // Ring mode — exactly Phase-2 behavior.
      if ((key.tab && !key.shift) || key.downArrow || key.rightArrow) goNext();
      else if ((key.tab && key.shift) || key.upArrow || key.leftArrow) goPrev();
      else if (key.return || input === " ")
        activate(ring[idx]!, key.return ? "enter" : "space");
    },
    { isActive: interactive },
  );

  const rctx: RCtx = {
    focusedKey: effective,
    copiedKey,
    focusKey: (o: object) => map.get(o),
    interactive,
    draft: (k: string) => draftFor(k),
    onFieldChange: (k, v) => setDraft((s) => ({ ...s, [k]: v })),
    onFieldSubmit,
    onTableFilter: tableFilter,
  };
  const content: ReactElement =
    props.interstitial != null ? (
      <Interstitial msg={props.interstitial} />
    ) : modal ? (
      // Screen-ownership: render ONLY the modal, horizontally centered (the
      // honest terminal "z-layer" — Ink has no z-index; base tree suppressed).
      // Vertical centering deferred (no reliable terminal-height center in Ink;
      // cosmetic, not load-bearing).
      <Box flexDirection="column" alignItems="center">
        {renderWith(modal, rctx)}
      </Box>
    ) : (
      renderWith(vm, rctx)
    );
  // Fill the terminal so flexGrow children (the sidebar main pane) have a
  // terminal-sized parent to expand into. `width` is the load-bearing dim
  // (horizontal sidebar fill); `height` makes it a true full-screen surface
  // (paired with the adapter's alternate-screen). `cols` is always present on
  // a real TTY; if a host omits `rows`, height falls back to auto without
  // breaking width. When !fillViewport (every test; non-TTY; opt-out) this
  // returns `content` unchanged ⇒ byte-identical to pre-0.4.5.
  if (fillViewport && typeof vp.cols === "number" && vp.cols > 0) {
    return (
      <Box width={vp.cols} height={vp.rows} flexDirection="column">
        {content}
      </Box>
    );
  }
  return content;
}

/**
 * Phase 5b terminal adapter — single-line + multi-line editors + selects.
 *
 * Every node renders byte-identically to Phase 1/2 when UNFOCUSED and on the
 * pure `renderTree`/non-TTY path (NO_CTX → interactive:false → no editor). On
 * a TTY the shell's view is interactive: a self-managed focus ring
 * (Tab/Shift-Tab/arrows), Enter/Space dispatch, focus continuity; button /
 * checkbox (`{checked}`) / tabs (`{value}`) / link / copy-button (OSC 52) /
 * form-submit. The focused single-line `field` is an editable
 * `ink-text-input`; the focused `textarea`/`code` field is the contained
 * `MultilineEditor` (Enter→newline; submit via the ring's submit button;
 * `code` adds a dim language label, no literal-tab). The focused `select` is
 * an `ink-select-input` list; the focused `select-multiple` is the contained
 * `MultiSelectInput` (Space toggles; comma-joined wire value; submit via the
 * ring's submit button). Typed drafts survive poll/dispatch re-renders unless
 * the field disappears or the server changes its value — mirroring
 * BrowserAdapter; selects are additionally server-authoritative on ANY server
 * re-render (excluded from draft preservation); password is masked;
 * form-`checkbox` toggles on Space. The still-deferred tier (`file`/`modal`/
 * `table`) arrives in later phases and still renders a visible fail-loud
 * placeholder — never blank, never silent.
 *
 * LEAF MODULE: never imported by src/index.ts / src/browser.ts /
 * src/server.ts, so `ink`/`react` never enter the web or server dependency
 * graph (a unit test asserts this).
 */
export class TuiAdapter implements Adapter {
  private instance: InkInstance | undefined;
  private disposed = false;
  /** "fill" (default) = occupy the terminal + alternate-screen on a real
   *  interactive TTY; "content" = legacy intrinsic-content size, no
   *  alt-screen (the opt-out escape hatch — pre-0.4.5 behavior). */
  private readonly viewport: "fill" | "content";
  /** Set once ESC[?1049h was written, so dispose() emits the paired
   *  ESC[?1049l exactly once (idempotent restore — same discipline as the
   *  cursor restore Ink does on unmount). */
  private altEntered = false;

  constructor(opts?: { viewport?: "fill" | "content" }) {
    this.viewport = opts?.viewport ?? "fill";
  }
  /** Injected by tui-cli.ts: lets a keyboard Ctrl-C (which, under Ink's raw
   *  mode, is delivered as input 0x03 and never raises SIGINT) reach the
   *  CLI's single idempotent shutdown. A TUI-internal seam between our two
   *  leaf files — NOT part of the core Adapter interface. */
  private requestExit: (code: number) => void = () => {};
  /** session storage — in-memory, process lifetime (browser sessionStorage
   *  analog for a single-process CLI). Write-only per the wire contract. */
  private sessionStore = new Map<string, string>();
  /** When non-null, App renders the loud Interstitial instead of the vm. */
  private interstitial: string | null = null;
  /** Last rendered vm/onAction — so showInterstitial can rerender through the
   *  SAME single Ink instance (never a 2nd inkRender). */
  private lastVm: ViewNode | undefined;
  private lastOnAction: (a: ActionEvent) => void = () => {};

  setRequestExit(fn: (code: number) => void): void {
    this.requestExit = fn;
  }

  render(vm: ViewNode, onAction: (action: ActionEvent) => void): void {
    this.lastVm = vm;
    this.lastOnAction = onAction;
    this.interstitial = null; // a fresh view supersedes any prior notice
    const app = this.createApp(vm, onAction);
    if (!this.instance) {
      // Enter the alternate-screen buffer BEFORE the first mount so every
      // frame draws there and the user's prior scrollback is untouched
      // (restored verbatim by dispose()'s paired ESC[?1049l). Gated on the
      // REAL process TTYs — the exact complement of the CLI's `nonInteractive`
      // — so the 0.4.4 non-TTY static one-shot (pipe/CI/agent) emits NO
      // escape, and unit tests (process.stdout.isTTY false under vitest)
      // never enter it. "content" opts out entirely.
      if (
        this.viewport !== "content" &&
        process.stdout.isTTY === true &&
        process.stdin.isTTY === true &&
        !this.altEntered
      ) {
        try {
          process.stdout.write("\x1b[?1049h");
          this.altEntered = true;
        } catch {
          /* if the enter write fails, dispose() must not emit the leave */
        }
      }
      // exitOnCtrlC:false — the CLI is the single owner of teardown; Ink must
      // not race it. Ctrl-C is handled in App and routed via requestExit.
      this.instance = inkRender(app, { exitOnCtrlC: false });
    } else {
      // The shell re-invokes render() on every poll/dispatch; rerender keeps
      // one Ink instance (and one App instance → focus state survives).
      this.instance.rerender(app);
    }
  }

  /** The interactive element used by render() and by interaction unit tests. */
  createApp(
    vm: ViewNode,
    onAction: (a: ActionEvent) => void,
    opts?: { requestExit?: (code: number) => void },
  ): ReactElement {
    return (
      <App
        vm={vm}
        onAction={onAction}
        requestExit={opts?.requestExit ?? this.requestExit}
        interstitial={this.interstitial}
        viewport={this.viewport}
        renderWith={(v, rctx) =>
          this.renderNode(v, 0, "comfortable", undefined, rctx)
        }
      />
    );
  }

  /** Render a full-screen loud notice through the SINGLE existing Ink instance
   *  (never a 2nd inkRender, never a raw stdout write that would corrupt Ink's
   *  diff / the ESC[?25h restore). No-op once disposed — closes the
   *  redirect-during-teardown rerender-after-unmount race. Process stays
   *  alive; the CLI owns exit (Ctrl-C via App's existing useInput → shutdown).
   *  Mounts the instance if a notice somehow precedes the first render (that
   *  is still the FIRST inkRender, not a second). */
  showInterstitial(msg: string): void {
    if (this.disposed) return;
    this.interstitial = msg;
    const vm = this.lastVm ?? ({ type: "text", value: "" } as ViewNode);
    const app = this.createApp(vm, this.lastOnAction);
    if (this.instance) this.instance.rerender(app);
    else this.instance = inkRender(app, { exitOnCtrlC: false });
  }

  /** Standalone redirect fallback. Only reached when a consumer wires
   *  TuiAdapter WITHOUT ShellOptions.onRedirect — core precedence means the
   *  vms-tui CLI's onRedirect suppresses this (proven by adapter-seam C/F).
   *  Origin-blind (the adapter has no shell/endpoint ref): hand off to a
   *  browser, else the loud interstitial. Never silent, never throws into
   *  core. No-op once disposed. */
  navigate(url: string): void {
    if (this.disposed) return;
    const fallback = (): void =>
      this.showInterstitial(
        `Open this URL to continue:\n\n  ${url}\n\n(no browser could be launched — open it manually)`,
      );
    if (!openExternal(url, fallback)) fallback();
  }

  /** Write-only client storage. `session` → in-memory (process lifetime).
   *  `local` → a SYNCHRONOUS XDG state-file write — synchronous is mandatory:
   *  the core applies side-effects before the redirect branch (adapter-seam
   *  Case E), so the token must land before navigation. Fail-loud, never
   *  swallow, never re-throw into core (push() has no try/catch): an I/O error
   *  or an unparseable EXISTING store surfaces the loud interstitial + a
   *  stderr line and does NOT clobber a possibly-unrelated user file. */
  storage(scope: "local" | "session", key: string, value: string): void {
    if (scope === "session") {
      this.sessionStore.set(key, value);
      return;
    }
    const xdg = process.env.XDG_STATE_HOME;
    const base = xdg && xdg.trim() ? xdg : join(homedir(), ".local", "state");
    const dir = join(base, "vms-tui");
    const file = join(dir, "storage.json");
    try {
      mkdirSync(dir, { recursive: true });
      let existing: string | undefined;
      try {
        existing = readFileSync(file, "utf8");
      } catch {
        existing = undefined; // ENOENT → fresh store (not a failure)
      }
      const obj: Record<string, string> =
        existing !== undefined
          ? (JSON.parse(existing) as Record<string, string>) // throw → caught: no clobber
          : {};
      obj[key] = value;
      writeFileSync(file, JSON.stringify(obj));
    } catch (err) {
      const m = (err as Error).message;
      try {
        process.stderr.write(
          `vms-tui: storage write failed (local "${key}"): ${m}\n`,
        );
      } catch {
        /* stderr unavailable — the interstitial below is still loud */
      }
      this.showInterstitial(
        `Storage write FAILED — your data was NOT saved.\n\n  key:   ${key}\n  error: ${m}`,
      );
    }
  }

  /** Test-only: read back a session value. The wire contract has no storage
   *  read; this exists solely so a unit test can prove the write landed
   *  (same rationale as exporting osc52 for a deterministic test). */
  _peekSession(key: string): string | undefined {
    return this.sessionStore.get(key);
  }

  /** Pure ViewNode → Ink element, UNFOCUSED (NO_CTX). Used by static unit
   *  tests; byte-identical to Phase 1 output. */
  renderTree(vm: ViewNode): ReactElement {
    return this.renderNode(vm, 0, "comfortable", undefined, NO_CTX);
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  /** Spacing rhythm. compact collapses gaps/padding (mirrors .vms--compact). */
  private spacing(d: Density): { gap: number; pad: number } {
    return d === "compact" ? { gap: 0, pad: 0 } : { gap: 1, pad: 1 };
  }

  /**
   * React key: the roadmap's identity heuristic — explicit id/name where
   * present, else positional index. Render-only; never a wire field.
   */
  private keyOf(node: ViewNode, i: number): string {
    const n = node as { id?: string; name?: string };
    return n.id ?? n.name ?? `${node.type}-${i}`;
  }

  /** Fail-loud placeholder — single source of the phase string. */
  private unsupported(label: string, key: number | string): ReactElement {
    return (
      <Text key={key} color="yellow">
        [unsupported: {label} — phase 5]
      </Text>
    );
  }

  /** Focused-node affordance. Unfocused → returns the element unchanged, so
   *  the static path stays byte-identical to Phase 1. Focused → a leading
   *  cyan caret (deterministic + information-honest; ▸ U+25B8 is distinct
   *  from the list-item markers › / ·). */
  private focusWrap(
    el: ReactElement,
    focused: boolean,
    key: number | string,
  ): ReactElement {
    if (!focused) return el;
    // Children get fixed structural keys ("caret"/"el") that are unique within
    // THIS 2-element array and cannot collide with any node-derived key (the
    // wrapped element is the sole child of its own Box, so its own key is
    // irrelevant here). The wrapper carries `key` for its parent sibling list.
    return (
      <Box key={key} flexDirection="row">
        <Text key="caret" color="cyan" bold>
          {"▸ "}
        </Text>
        <Box key="el">{el}</Box>
      </Box>
    );
  }

  /** Shipped list-item variant → marker + child tint (fail-soft: unknown ok). */
  private listItemStyle(variant?: string): {
    marker: string;
    mc?: string;
    mb?: boolean;
    md?: boolean;
    child?: Inherited;
  } {
    switch (variant) {
      case "active":
        return { marker: "›", mc: "cyan", mb: true, child: { bold: true } };
      case "done":
        return { marker: "✓", mc: "green", md: true, child: { dim: true } };
      case "critical":
        return { marker: "●", mc: "red", mb: true, child: { color: "red" } };
      case "high":
        return { marker: "●", mc: "red", child: { color: "red" } };
      case "warning":
        return { marker: "▲", mc: "yellow", child: { color: "yellow" } };
      case "success":
        return { marker: "●", mc: "green", child: { color: "green" } };
      case "info":
        return { marker: "●", mc: "blue", child: { color: "blue" } };
      default:
        return { marker: "·", md: true };
    }
  }

  /** page & section share the 4 layout presets. Information-honest, not pixel. */
  private layoutContainer(
    layout: string | undefined,
    children: ViewNode[],
    density: Density,
    rctx: RCtx,
  ): ReactElement {
    const sp = this.spacing(density);
    const kids = (children ?? []).map((c, i) =>
      this.renderNode(c, this.keyOf(c, i), density, undefined, rctx),
    );

    switch (layout) {
      case "split":
        return (
          <Box flexDirection="row" gap={sp.gap || 1}>
            {kids.map((el, i) => (
              <Box key={i} flexGrow={1} flexShrink={1} flexBasis={0}>
                {el}
              </Box>
            ))}
          </Box>
        );

      case "cards":
        return (
          <Box flexDirection="row" flexWrap="wrap" gap={sp.gap || 1}>
            {kids.map((el, i) => (
              <Box
                key={i}
                flexGrow={0}
                flexShrink={1}
                flexBasis={28}
                minWidth={20}
              >
                {el}
              </Box>
            ))}
          </Box>
        );

      case "sidebar": {
        if (kids.length === 0) return <Box />;
        const [rail, ...rest] = kids;
        if (rest.length === 0) {
          return (
            <Box flexShrink={0} flexBasis={24} minWidth={18}>
              {rail}
            </Box>
          );
        }
        return (
          <Box flexDirection="row" gap={sp.gap || 1}>
            <Box flexShrink={0} flexBasis={24} minWidth={18}>
              {rail}
            </Box>
            <Box flexGrow={1} flexShrink={1} flexBasis={0}>
              <Box flexDirection="column" gap={sp.gap}>
                {rest}
              </Box>
            </Box>
          </Box>
        );
      }

      default: // "stack" / undefined
        return (
          <Box flexDirection="column" gap={sp.gap}>
            {kids}
          </Box>
        );
    }
  }

  // ── the node switch ──────────────────────────────────────────────────────

  private renderNode(
    node: ViewNode,
    key: number | string,
    density: Density = "comfortable",
    inherited?: Inherited,
    rctx: RCtx = NO_CTX,
  ): ReactElement {
    switch (node.type) {
      case "page": {
        const d: Density = node.density === "compact" ? "compact" : "comfortable";
        const sp = this.spacing(d);
        return (
          <Box key={key} flexDirection="column" gap={sp.gap}>
            {node.title ? (
              <Box>
                <Text bold underline>
                  {node.title}
                </Text>
              </Box>
            ) : null}
            {this.layoutContainer(node.layout, node.children ?? [], d, rctx)}
          </Box>
        );
      }

      case "section": {
        const sp = this.spacing(density);
        const card = node.variant === "card";
        return (
          <Box
            key={key}
            flexDirection="column"
            gap={sp.gap}
            borderStyle={card ? "round" : undefined}
            paddingX={card ? Math.max(1, sp.pad) : undefined}
            paddingY={card ? (sp.gap ? 1 : 0) : undefined}
          >
            {node.heading ? (
              <Box>
                <Text bold>{node.heading}</Text>
              </Box>
            ) : null}
            {this.layoutContainer(node.layout, node.children ?? [], density, rctx)}
          </Box>
        );
      }

      case "list":
        return (
          <Box key={key} flexDirection="column">
            {(node.children ?? []).map((c, i) =>
              this.renderNode(c, this.keyOf(c, i), density, inherited, rctx),
            )}
          </Box>
        );

      case "list-item": {
        const st = this.listItemStyle(node.variant);
        const childInherited: Inherited = st.child ?? inherited;
        return (
          <Box key={key} flexDirection="row" gap={1}>
            <Text color={st.mc} bold={st.mb} dimColor={st.md}>
              {st.marker}
            </Text>
            <Box flexDirection="row" gap={1}>
              {(node.children ?? []).map((c, i) =>
                this.renderNode(
                  c,
                  this.keyOf(c, i),
                  density,
                  childInherited,
                  rctx,
                ),
              )}
            </Box>
          </Box>
        );
      }

      case "text": {
        const s = node.style;
        return (
          <Text
            key={key}
            bold={s === "heading" || s === "subheading" || inherited?.bold === true}
            italic={s === "subheading"}
            dimColor={s === "muted" || inherited?.dim === true}
            color={s === "error" ? "red" : inherited?.color}
            strikethrough={s === "strikethrough"}
          >
            {node.value}
          </Text>
        );
      }

      case "link": {
        const fk = rctx.focusKey(node);
        const focused = fk != null && fk === rctx.focusedKey;
        const copied = fk != null && fk === rctx.copiedKey;
        const href = (node.href ?? "").trim();
        if (!href) {
          return (
            <Box key={key}>
              <Text
                underline
                color={inherited?.color}
                dimColor={inherited?.dim}
              >
                {node.label}
              </Text>
            </Box>
          );
        }
        // OSC 8 hyperlink. As the SOLE child of its own Box with no wrap, the
        // string-width over-count (string-width does not strip OSC 8) stays
        // contained to this line and cannot corrupt sibling layout.
        const osc = `]8;;${node.href}${node.label}]8;;${copied ? " ✓ copied" : ""}`;
        return this.focusWrap(
          <Box key={key}>
            <Text
              wrap="truncate-end"
              underline
              color={inherited?.color}
              dimColor={inherited?.dim}
            >
              {osc}
            </Text>
          </Box>,
          focused,
          key,
        );
      }

      case "stat-bar":
        return (
          <Box key={key} flexDirection="row" gap={2}>
            {(node.stats ?? []).map((st, i) => (
              <Box key={`${st.label}-${i}`} flexDirection="column">
                <Text bold>{String(st.value)}</Text>
                <Text dimColor>{st.label}</Text>
              </Box>
            ))}
          </Box>
        );

      case "progress": {
        const raw = Number(node.value);
        const v = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
        const width = 20;
        const filled = Math.round((v / 100) * width);
        const bar = "█".repeat(filled) + "░".repeat(width - filled);
        return (
          <Box key={key} flexDirection="row" gap={1}>
            <Text>{bar}</Text>
            <Text dimColor>{Math.round(v)}%</Text>
          </Box>
        );
      }

      case "button": {
        const fk = rctx.focusKey(node);
        const focused = fk != null && fk === rctx.focusedKey;
        const variant = node.variant;
        const color =
          variant === "primary"
            ? "cyan"
            : variant === "danger"
              ? "red"
              : inherited?.color;
        const bold =
          variant === "primary" || variant === "danger" || inherited?.bold === true;
        return this.focusWrap(
          <Box key={key} borderStyle="round" paddingX={1}>
            <Text bold={bold} color={color} dimColor={inherited?.dim}>
              {node.label}
            </Text>
          </Box>,
          focused,
          key,
        );
      }

      case "checkbox": {
        const fk = rctx.focusKey(node);
        const focused = fk != null && fk === rctx.focusedKey;
        return this.focusWrap(
          <Box key={key} flexDirection="row" gap={1}>
            <Text>{node.checked ? "[x]" : "[ ]"}</Text>
            {node.label ? (
              <Text
                bold={inherited?.bold === true}
                color={inherited?.color}
                dimColor={inherited?.dim}
              >
                {node.label}
              </Text>
            ) : null}
          </Box>,
          focused,
          key,
        );
      }

      case "tabs":
        return (
          <Box key={key} flexDirection="row" gap={1}>
            {(node.tabs ?? []).map((t, i) => {
              const on = t.value === node.selected;
              const fk = rctx.focusKey(t);
              const focused = fk != null && fk === rctx.focusedKey;
              const el = on ? (
                <Box key={t.value ?? i} borderStyle="round" paddingX={1}>
                  <Text bold color="cyan">
                    {t.label}
                  </Text>
                </Box>
              ) : (
                <Box key={t.value ?? i} paddingX={1}>
                  <Text dimColor>{t.label}</Text>
                </Box>
              );
              return this.focusWrap(el, focused, t.value ?? i);
            })}
          </Box>
        );

      case "copy-button": {
        const fk = rctx.focusKey(node);
        const focused = fk != null && fk === rctx.focusedKey;
        const copied = fk != null && fk === rctx.copiedKey;
        const label = copied
          ? (node.copiedLabel ?? "Copied!")
          : (node.label ?? "Copy");
        return this.focusWrap(
          <Box key={key} borderStyle="round" paddingX={1}>
            <Text>{label}</Text>
          </Box>,
          focused,
          key,
        );
      }

      case "form": {
        const inline = node.layout === "inline";
        const fk = rctx.focusKey(node);
        const focused = fk != null && fk === rctx.focusedKey;
        return (
          <Box
            key={key}
            flexDirection={inline ? "row" : "column"}
            gap={1}
            alignItems={inline ? "flex-start" : undefined}
          >
            {(node.children ?? []).map((c, i) =>
              this.renderNode(c, this.keyOf(c, i), density, undefined, rctx),
            )}
            {this.focusWrap(
              <Box borderStyle="round" paddingX={1}>
                <Text bold color="cyan">
                  {node.submitLabel ?? "Submit"}
                </Text>
              </Box>,
              focused,
              "submit",
            )}
          </Box>
        );
      }

      case "field": {
        const it = node.inputType;
        if (it === "hidden") return <Box key={key} />;
        const fk = rctx.focusKey(node);
        const focused = fk != null && fk === rctx.focusedKey;
        const dval = fk != null ? rctx.draft(fk) : undefined;

        if (it === "checkbox") {
          const cur = dval ?? node.value;
          const truthy = !!cur && cur !== "false" && cur !== "0";
          return this.focusWrap(
            <Box key={key} flexDirection="row" gap={1}>
              <Text>{truthy ? "[x]" : "[ ]"}</Text>
              {node.label ? <Text>{node.label}</Text> : null}
            </Box>,
            focused,
            key,
          );
        }
        if (it === "textarea" || it === "code") {
          // Phase 5a — multi-line editor. `code` == textarea + a dim language
          // hint label (no syntax coloring: the framework only ships the
          // editable monospaced surface; a terminal is already monospace).
          const current = dval ?? node.value ?? "";
          const labelText =
            (node.label ?? "") +
            (it === "code" && node.language ? ` [${node.language}]` : "");
          if (rctx.interactive && focused && fk != null) {
            return this.focusWrap(
              <Box key={key} flexDirection="column">
                {labelText ? <Text dimColor>{labelText}</Text> : null}
                <Box borderStyle="single" paddingX={1} minWidth={20}>
                  <MultilineEditor
                    key="input"
                    focus
                    value={current}
                    placeholder={node.placeholder ?? ""}
                    onChange={(v: string) => rctx.onFieldChange?.(fk, v)}
                  />
                </Box>
              </Box>,
              focused,
              key,
            );
          }
          const hasValue = current !== "";
          const display = hasValue ? current : (node.placeholder ?? "");
          return this.focusWrap(
            <Box key={key} flexDirection="column">
              {labelText ? <Text dimColor>{labelText}</Text> : null}
              <Box borderStyle="single" paddingX={1} minWidth={20}>
                <Text dimColor={!hasValue}>
                  {display === "" ? " " : display}
                </Text>
              </Box>
            </Box>,
            focused,
            key,
          );
        }
        if (it === "file") {
          return this.unsupported(`field(${it})`, key);
        }
        if (it === "select" || it === "select-multiple") {
          // Phase 5b — interactive picker. `select` → ink-select-input (its
          // useInput owns Up/Down/Enter/digits and does NOT consume Tab/
          // Shift-Tab/Ctrl-C — verified — so App keeps ring + teardown).
          // `select-multiple` → the contained MultiSelectInput (same keyboard
          // contract). Editor mounts ONLY when focused on a TTY; otherwise
          // (and on the pure NO_CTX/non-TTY path) a static label box,
          // byte-identical when no draft exists.
          const opts = node.options ?? [];
          const multi = it === "select-multiple";
          const current = dval ?? node.value ?? "";
          const labelText = node.label ?? "";
          if (rctx.interactive && focused && fk != null) {
            if (multi) {
              return this.focusWrap(
                <Box key={key} flexDirection="column">
                  {labelText ? <Text dimColor>{labelText}</Text> : null}
                  <Box borderStyle="single" paddingX={1} minWidth={20}>
                    <MultiSelectInput
                      key="input"
                      focus
                      options={opts}
                      value={current}
                      onChange={(v: string) => rctx.onFieldChange?.(fk, v)}
                    />
                  </Box>
                </Box>,
                focused,
                key,
              );
            }
            const items = opts.map((o) => ({ label: o.label, value: o.value }));
            const idx = items.findIndex((i) => i.value === current);
            return this.focusWrap(
              <Box key={key} flexDirection="column">
                {labelText ? <Text dimColor>{labelText}</Text> : null}
                <Box borderStyle="single" paddingX={1} minWidth={20}>
                  {/* Keyed by the resolved value: a fresh pick or a server
                      re-render (draft dropped → server-authoritative)
                      remounts the list at the correct index; pure navigation
                      (no value change until Enter) does NOT remount. */}
                  <SelectInput
                    key={`sel:${current}`}
                    isFocused
                    items={items}
                    initialIndex={idx < 0 ? 0 : idx}
                    onSelect={(i) => rctx.onFieldChange?.(fk, String(i.value))}
                  />
                </Box>
              </Box>,
              focused,
              key,
            );
          }
          // Static: selected label(s). ONE flat <Text> for the value line
          // (Phase-1/5a nested-<Text> width pitfall).
          const labelOf = (val: string): string =>
            opts.find((o) => o.value === val)?.label ?? val;
          const display = multi
            ? current
                .split(",")
                .map((s) => s.trim())
                .filter((s) => s.length > 0)
                .map(labelOf)
                .join(", ")
            : current
              ? labelOf(current)
              : "";
          const hasValue = display !== "";
          return this.focusWrap(
            <Box key={key} flexDirection="column">
              {labelText ? <Text dimColor>{labelText}</Text> : null}
              <Box borderStyle="single" paddingX={1} minWidth={20}>
                <Text dimColor={!hasValue}>
                  {hasValue ? display : (node.placeholder ?? " ")}
                </Text>
              </Box>
            </Box>,
            focused,
            key,
          );
        }

        // Single-line text family: text|email|password|number|date|time|
        // datetime-local (+ any unknown → text). Editable `<TextInput>` ONLY
        // when focused on a TTY; otherwise (and on the pure NO_CTX/non-TTY
        // path) the Phase-2 static box, byte-identical when no draft exists.
        const current = dval ?? node.value ?? "";
        if (rctx.interactive && focused && fk != null) {
          return this.focusWrap(
            <Box key={key} flexDirection="column">
              {node.label ? <Text dimColor>{node.label}</Text> : null}
              <Box borderStyle="single" paddingX={1} minWidth={20}>
                <TextInput
                  key="input"
                  focus
                  value={current}
                  placeholder={node.placeholder ?? ""}
                  mask={it === "password" ? "•" : undefined}
                  onChange={(v: string) => rctx.onFieldChange?.(fk, v)}
                  onSubmit={() => rctx.onFieldSubmit?.(node as FieldNode)}
                />
              </Box>
            </Box>,
            focused,
            key,
          );
        }
        const hasValue = current !== "";
        const display =
          it === "password"
            ? hasValue
              ? "•".repeat(current.length)
              : (node.placeholder ?? "")
            : hasValue
              ? current
              : (node.placeholder ?? "");
        return this.focusWrap(
          <Box key={key} flexDirection="column">
            {node.label ? <Text dimColor>{node.label}</Text> : null}
            <Box borderStyle="single" paddingX={1} minWidth={20}>
              <Text dimColor={!hasValue}>{display}</Text>
            </Box>
          </Box>,
          focused,
          key,
        );
      }

      case "modal": {
        const sp = this.spacing(density);
        // size → box width (cosmetic; fullscreen = full available width).
        const boxWidth: number | string =
          node.size === "narrow"
            ? 40
            : node.size === "wide"
              ? 90
              : node.size === "fullscreen"
                ? "100%"
                : 60; // medium (default)
        return (
          <Box
            key={key}
            flexDirection="column"
            borderStyle="round"
            paddingX={Math.max(1, sp.pad)}
            paddingY={sp.gap ? 1 : 0}
            gap={sp.gap}
            width={boxWidth}
          >
            {node.title ? (
              <Box>
                <Text bold>{node.title}</Text>
              </Box>
            ) : null}
            {node.dismissAction ? (
              <Box>
                <Text dimColor>{"✕  (Esc to close)"}</Text>
              </Box>
            ) : null}
            <Box flexDirection="column" gap={sp.gap}>
              {(node.children ?? []).map((c, i) =>
                this.renderNode(c, this.keyOf(c, i), density, inherited, rctx),
              )}
            </Box>
            {node.footer && node.footer.length > 0 ? (
              <Box flexDirection="row" gap={1}>
                {node.footer.map((c, i) =>
                  this.renderNode(
                    c,
                    this.keyOf(c, i),
                    density,
                    inherited,
                    rctx,
                  ),
                )}
              </Box>
            ) : null}
          </Box>
        );
      }

      case "table": {
        // Phase 5d. Serves BOTH the static (renderTree/non-TTY/unit) and
        // interactive paths — interactive only adds the focus tint + mounts
        // the focused filter <TextInput>. DISCIPLINE: a flex-row of
        // independent fixed-width <Box> cells (the standard Ink table) is
        // SAFE — distinct from the Phase-5a bug (a styled <Text> nested INSIDE
        // one <Text>). Every cell is ONE flat <Text>; a link cell is OSC 8 as
        // the SOLE child of its own width-bounded Box (the Phase-1
        // string-width over-count, contained to that cell). Focus is a
        // whole-cell colour (cyan) — NOT focusWrap (its external "▸ " caret
        // would break fixed-column alignment); same approach as
        // MultiSelectInput's highlight.
        const t = node as TableNode;
        const cols = t.columns ?? [];
        const rows = t.rows ?? [];
        const canSort = !!t.sortAction;
        const canFilter = !!t.filterAction;
        const anyFilter = canFilter && cols.some((c) => c.filterable);
        const MINW = 3,
          MAXW = 40,
          MINFILTER = 8,
          IND = 2;
        const cellText = (c: TableColumn, r: TableRow): string => {
          const v = r.cells?.[c.key] ?? "";
          // Measure the LABEL, never the OSC/href (Phase-1 over-count).
          return c.linkLabel && v ? c.linkLabel : v;
        };
        const widths = new Map<string, number>();
        for (const c of cols) {
          let w =
            dispWidth(c.label) +
            ((canSort && c.sortable) || t.sortColumn === c.key ? IND : 0);
          for (const r of rows) w = Math.max(w, dispWidth(cellText(c, r)));
          if (canFilter && c.filterable) w = Math.max(w, MINFILTER);
          widths.set(c.key, Math.max(MINW, Math.min(MAXW, w)));
        }
        const w = (c: TableColumn): number => widths.get(c.key) ?? MINW;

        return (
          <Box key={key} flexDirection="column">
            <Box flexDirection="row" gap={1}>
              {cols.map((c, ci) => {
                const sortable = canSort && !!c.sortable;
                const ind =
                  t.sortColumn === c.key
                    ? t.sortDirection === "desc"
                      ? " ▼"
                      : " ▲"
                    : "";
                const hk = sortable ? rctx.focusKey(c) : undefined;
                const hfoc = hk != null && hk === rctx.focusedKey;
                return (
                  <Box key={c.key ?? ci} width={w(c)}>
                    <Text
                      bold
                      color={hfoc ? "cyan" : undefined}
                      wrap="truncate-end"
                    >
                      {c.label + ind}
                    </Text>
                  </Box>
                );
              })}
            </Box>
            {anyFilter ? (
              <Box flexDirection="row" gap={1}>
                {cols.map((c, ci) => {
                  if (!c.filterable)
                    return (
                      <Box key={c.key ?? ci} width={w(c)}>
                        <Text> </Text>
                      </Box>
                    );
                  const fk = rctx.focusKey(filterIdent(c));
                  const ffoc = fk != null && fk === rctx.focusedKey;
                  const cur =
                    (fk != null ? rctx.draft(fk) : undefined) ??
                    c.filterValue ??
                    "";
                  return (
                    <Box
                      key={c.key ?? ci}
                      width={w(c)}
                      borderStyle="single"
                    >
                      {rctx.interactive && ffoc && fk != null ? (
                        <TableFilterInput
                          key="input"
                          focus
                          value={cur}
                          onChange={(v: string) =>
                            rctx.onFieldChange?.(fk, v)
                          }
                          onSubmit={() => rctx.onTableFilter?.(t, c)}
                        />
                      ) : (
                        <Text dimColor={cur === ""}>
                          {cur === "" ? "filter…" : cur}
                        </Text>
                      )}
                    </Box>
                  );
                })}
              </Box>
            ) : null}
            {rows.map((r, ri) => {
              const tint = this.listItemStyle(r.variant).child;
              const rk = r.action ? rctx.focusKey(r) : undefined;
              const rfoc = rk != null && rk === rctx.focusedKey;
              return (
                <Box key={r.id ?? ri} flexDirection="row" gap={1}>
                  {cols.map((c, ci) => {
                    const v = r.cells?.[c.key] ?? "";
                    if (c.linkLabel && v) {
                      // Link cell. A standalone `link` node emits OSC 8, but a
                      // table cell is WIDTH-BOUNDED for column alignment, and
                      // OSC 8 here would be truncate-mangled — string-width
                      // over-counts the escape, so `wrap:"truncate-end"` at a
                      // fixed column width corrupts it (the Phase-1/5a width
                      // landmine is fundamentally incompatible with a fixed
                      // column width). So show the linkLabel as underlined
                      // text — information-honest and aligned; standalone
                      // `link` nodes keep full OSC 8. (TUI-NOTES Phase 5d.)
                      return (
                        <Box key={c.key ?? ci} width={w(c)}>
                          <Text
                            wrap="truncate-end"
                            underline
                            color={rfoc ? "cyan" : tint?.color}
                          >
                            {c.linkLabel}
                          </Text>
                        </Box>
                      );
                    }
                    return (
                      <Box key={c.key ?? ci} width={w(c)}>
                        <Text
                          wrap="truncate-end"
                          color={rfoc ? "cyan" : tint?.color}
                          bold={tint?.bold}
                          dimColor={tint?.dim}
                        >
                          {v === "" ? " " : v}
                        </Text>
                      </Box>
                    );
                  })}
                </Box>
              );
            })}
            {rows.length === 0 ? <Text dimColor>(no rows)</Text> : null}
          </Box>
        );
      }

      default:
        // field(file) is handled in the field case; any unknown node type
        // (or a still-deferred one) → fail-loud, never blank.
        return this.unsupported((node as ViewNode).type, key);
    }
  }

  /** Resolves when the Ink app unmounts; immediate if nothing was rendered. */
  async waitUntilExit(): Promise<void> {
    if (!this.instance) return;
    try {
      await this.instance.waitUntilExit();
    } catch {
      // Ink rejects waitUntilExit on some exit paths; treat as exited.
    }
  }

  /** Idempotent terminal restore — unmount restores cursor/raw mode. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.instance?.unmount(); // Ink restores cursor/raw mode on the alt screen
    if (this.altEntered) {
      // THEN leave the alternate-screen buffer → the user's prior terminal
      // (scrollback, cursor) is restored verbatim. Reached on EVERY exit
      // path: the CLI funnels shutdown / SIGINT / SIGTERM / uncaught /
      // unhandledRejection / process 'exit' all through dispose(), so a
      // crash or kill cannot strand the user on the alt screen. Idempotent
      // (disposed guard + altEntered cleared).
      this.altEntered = false;
      try {
        process.stdout.write("\x1b[?1049l");
      } catch {
        /* stdout gone during teardown — nothing more we can do */
      }
    }
  }
}
