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
import type {
  Adapter,
  ActionEvent,
  ViewNode,
  FormNode,
  FieldNode,
} from "./index.js";

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
}

const NO_CTX: RCtx = {
  focusedKey: null,
  copiedKey: null,
  focusKey: () => undefined,
};

/** A node the focus ring can land on, in tree (pre-order) order. */
interface Focusable {
  key: string;
  kind: "button" | "checkbox" | "tabs-tab" | "copy" | "link" | "field" | "form-submit";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any;
  form?: FormNode;
  tab?: { value: string; label: string };
}

/** OSC 52 clipboard write — the terminal-native analog of the clipboard API.
 *  Works over SSH (no local clipboard dependency). Exported for a direct,
 *  deterministic unit test of the byte format. */
export function osc52(text: string): string {
  return `\x1b]52;c;${Buffer.from(String(text), "utf8").toString("base64")}\x07`;
}

const isTruthyFormValue = (v?: string): boolean =>
  !!v && v !== "false" && v !== "0";

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
        if (
          it === "hidden" ||
          it === "textarea" ||
          it === "code" ||
          it === "select" ||
          it === "select-multiple" ||
          it === "file"
        )
          return; // invisible / deferred → not focusable in Phase 2
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
      case "page":
      case "section":
      case "list":
      case "list-item":
        for (const c of node.children ?? []) visit(c, form);
        return;
      default: // text, stat-bar, progress, modal, table → not focusable
        return;
    }
  };

  visit(vm);
  return { list, map };
}

/** Collect a form's static field values (Phase 2: fields aren't editable yet,
 *  so values are the server-provided ones). Mirrors BrowserAdapter semantics. */
function collectForm(form: FormNode): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (node: ViewNode): void => {
    if (node.type === "field") {
      const f = node as FieldNode;
      const it = f.inputType;
      if (it === "textarea" || it === "code" || it === "select" || it === "select-multiple" || it === "file") {
        return; // deferred input types — not collected in Phase 2
      }
      if (it === "checkbox") out[f.name] = isTruthyFormValue(f.value) ? "true" : "false";
      else out[f.name] = f.value ?? "";
      return;
    }
    const kids = (node as { children?: ViewNode[] }).children;
    if (kids) for (const c of kids) walk(c);
  };
  for (const c of form.children ?? []) walk(c);
  return out;
}

function submitOf(form: FormNode): ActionEvent {
  return {
    name: form.submitAction.name,
    context: { ...(form.submitAction.context ?? {}), ...collectForm(form) },
  };
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

/** The stateful root. Mounted ONCE; the shell's poll/dispatch re-renders
 *  reconcile the SAME component instance (React preserves its focus state) —
 *  this is why a stable root component, not a bare tree. */
function App(props: {
  vm: ViewNode;
  onAction: (a: ActionEvent) => void;
  requestExit: (code: number) => void;
  renderWith: (vm: ViewNode, rctx: RCtx) => ReactElement;
}): ReactElement {
  const { vm, renderWith } = props;
  const { isRawModeSupported } = useStdin();
  const { write } = useStdout();
  const interactive = isRawModeSupported;

  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { list, map } = collectFocusables(vm);
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
  const listRef = useRef(list);
  listRef.current = list;
  const effectiveRef = useRef(effective);
  effectiveRef.current = effective;
  const writeRef = useRef(write);
  writeRef.current = write;
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => {
    if (effective !== focusedKey) setFocusedKey(effective);
    prevRef.current = { keys, key: effective };
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

  const activate = (d: Focusable): void => {
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
      case "field":
        if (d.node.action)
          dispatch({
            name: d.node.action.name,
            context: {
              ...(d.node.action.context ?? {}),
              [d.node.name]: d.node.value ?? "",
            },
          });
        else if (d.form) dispatch(submitOf(d.form));
        break;
      case "form-submit":
        dispatch(submitOf(d.node as FormNode));
        break;
      case "copy":
        doCopy(d.key, d.node.text);
        break;
      case "link":
        doCopy(d.key, d.node.href);
        break;
    }
  };

  useInput(
    (input, key) => {
      if (key.ctrl && input === "c") {
        requestExitRef.current(130);
        return;
      }
      const ring = listRef.current;
      if (ring.length === 0) return;
      let idx = ring.findIndex((d) => d.key === effectiveRef.current);
      if (idx < 0) idx = 0;
      if ((key.tab && !key.shift) || key.downArrow || key.rightArrow) {
        setFocusedKey(ring[(idx + 1) % ring.length]!.key);
      } else if ((key.tab && key.shift) || key.upArrow || key.leftArrow) {
        setFocusedKey(ring[(idx - 1 + ring.length) % ring.length]!.key);
      } else if (key.return || input === " ") {
        activate(ring[idx]!);
      }
    },
    { isActive: interactive },
  );

  const rctx: RCtx = {
    focusedKey: effective,
    copiedKey,
    focusKey: (o: object) => map.get(o),
  };
  return renderWith(vm, rctx);
}

/**
 * Phase 2 terminal adapter — focus model + non-text interaction.
 *
 * Every phase-1 node renders as in Phase 1 when UNFOCUSED (byte-identical:
 * the pure `renderTree` path uses NO_CTX). On a TTY the shell's view becomes
 * interactive: a self-managed focus ring (Tab/Shift-Tab/arrows), Enter/Space
 * dispatch, focus continuity across re-renders; button / checkbox (immediate
 * `{checked}`) / tabs (`{value}`) / link / copy-button (OSC 52, no dispatch) /
 * form-submit (collects current static field values). The single-line field
 * editor, redirect/storage verbs, and the deferred tier arrive in later phases.
 * Deferred nodes (`modal`, `table`) and deferred field input types still
 * render a visible fail-loud placeholder — never blank, never silent.
 *
 * LEAF MODULE: never imported by src/index.ts / src/browser.ts /
 * src/server.ts, so `ink`/`react` never enter the web or server dependency
 * graph (a unit test asserts this).
 */
export class TuiAdapter implements Adapter {
  private instance: InkInstance | undefined;
  private disposed = false;
  /** Injected by tui-cli.ts: lets a keyboard Ctrl-C (which, under Ink's raw
   *  mode, is delivered as input 0x03 and never raises SIGINT) reach the
   *  CLI's single idempotent shutdown. A TUI-internal seam between our two
   *  leaf files — NOT part of the core Adapter interface. */
  private requestExit: (code: number) => void = () => {};

  setRequestExit(fn: (code: number) => void): void {
    this.requestExit = fn;
  }

  render(vm: ViewNode, onAction: (action: ActionEvent) => void): void {
    const app = this.createApp(vm, onAction);
    if (!this.instance) {
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
        renderWith={(v, rctx) =>
          this.renderNode(v, 0, "comfortable", undefined, rctx)
        }
      />
    );
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
        [unsupported: {label} — phase 2]
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
        if (it === "checkbox") {
          const fk = rctx.focusKey(node);
          const focused = fk != null && fk === rctx.focusedKey;
          const v = node.value;
          const truthy = !!v && v !== "false" && v !== "0";
          return this.focusWrap(
            <Box key={key} flexDirection="row" gap={1}>
              <Text>{truthy ? "[x]" : "[ ]"}</Text>
              {node.label ? <Text>{node.label}</Text> : null}
            </Box>,
            focused,
            key,
          );
        }
        if (
          it === "textarea" ||
          it === "code" ||
          it === "select" ||
          it === "select-multiple" ||
          it === "file"
        ) {
          return this.unsupported(`field(${it})`, key);
        }
        // single-line text family: text|email|password|number|date|time|
        // datetime-local (+ any other → treated as text). STATIC, no editing.
        const fk = rctx.focusKey(node);
        const focused = fk != null && fk === rctx.focusedKey;
        const val = node.value ?? "";
        const hasValue = val !== "";
        const display =
          it === "password"
            ? hasValue
              ? "•".repeat(val.length)
              : (node.placeholder ?? "")
            : hasValue
              ? val
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

      default:
        // Deferred node types (modal/table) + any unknown → fail-loud.
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
    this.instance?.unmount();
  }
}
