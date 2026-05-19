import type { ReactElement } from "react";
import { render as inkRender, Box, Text } from "ink";
import type { Adapter, ActionEvent, ViewNode } from "./index.js";

type InkInstance = ReturnType<typeof inkRender>;

type Density = "comfortable" | "compact";

/**
 * Style tint inherited down the tree (e.g. a `list-item` variant tinting its
 * child `text`/`button`/`link`). Purely a render concern — no wire change.
 */
type Inherited = { color?: string; dim?: boolean; bold?: boolean } | undefined;

/**
 * Phase 1 terminal adapter — read-only render of the full phase-1 node set.
 *
 * Every phase-1 ViewNode renders in its UNFOCUSED / static state: no keyboard,
 * no interaction, `onAction` is never invoked. Deferred nodes (`modal`,
 * `table`) and deferred field input types (`textarea`/`code`/`select`/
 * `select-multiple`/`file`) render a visible fail-loud placeholder — never
 * blank, never silent. Interaction (focus ring, dispatch), the single-line
 * field editor, redirect/storage verbs, and the deferred tier arrive in later
 * phases.
 *
 * LEAF MODULE: never imported by src/index.ts / src/browser.ts /
 * src/server.ts, so `ink`/`react` never enter the web or server dependency
 * graph (a unit test asserts this). No Ink input hooks (`useInput`/`useFocus`)
 * are used — input-free phases must not hold Node's event loop (the CLI owns a
 * keep-alive); adding one would break Phase-0 teardown.
 *
 * Phase 1 deliberately does NOT implement `navigate`/`storage`/`transport`.
 * Their absence is the core's intended fail-loud behaviour; they land later.
 */
export class TuiAdapter implements Adapter {
  private instance: InkInstance | undefined;
  private onAction: ((action: ActionEvent) => void) | undefined;
  private disposed = false;

  render(vm: ViewNode, onAction: (action: ActionEvent) => void): void {
    // Stored for later phases; Phase 1 has no interactive node so it is
    // intentionally never invoked yet.
    this.onAction = onAction;

    const tree = this.renderTree(vm);
    if (!this.instance) {
      // exitOnCtrlC:false — the CLI is the single owner of SIGINT/teardown,
      // so Ink must not also race to unmount on Ctrl-C.
      this.instance = inkRender(tree, { exitOnCtrlC: false });
    } else {
      // The shell re-invokes render() on every poll/dispatch; rerender keeps
      // one Ink instance so the terminal is never corrupted by re-mounting.
      this.instance.rerender(tree);
    }
  }

  /** Pure ViewNode → Ink element. Used by render() and by unit tests. */
  renderTree(vm: ViewNode): ReactElement {
    return this.renderNode(vm, 0, "comfortable", undefined);
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
        [unsupported: {label} — phase 1]
      </Text>
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
  ): ReactElement {
    const sp = this.spacing(density);
    const kids = (children ?? []).map((c, i) =>
      this.renderNode(c, this.keyOf(c, i), density),
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
            {this.layoutContainer(node.layout, node.children ?? [], d)}
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
            {this.layoutContainer(node.layout, node.children ?? [], density)}
          </Box>
        );
      }

      case "list":
        return (
          <Box key={key} flexDirection="column">
            {(node.children ?? []).map((c, i) =>
              this.renderNode(c, this.keyOf(c, i), density, inherited),
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
                this.renderNode(c, this.keyOf(c, i), density, childInherited),
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
        const osc = `]8;;${node.href}${node.label}]8;;`;
        return (
          <Box key={key}>
            <Text
              wrap="truncate-end"
              underline
              color={inherited?.color}
              dimColor={inherited?.dim}
            >
              {osc}
            </Text>
          </Box>
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
        const variant = node.variant;
        const color =
          variant === "primary"
            ? "cyan"
            : variant === "danger"
              ? "red"
              : inherited?.color;
        const bold =
          variant === "primary" || variant === "danger" || inherited?.bold === true;
        return (
          <Box key={key} borderStyle="round" paddingX={1}>
            <Text bold={bold} color={color} dimColor={inherited?.dim}>
              {node.label}
            </Text>
          </Box>
        );
      }

      case "checkbox":
        return (
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
          </Box>
        );

      case "tabs":
        return (
          <Box key={key} flexDirection="row" gap={1}>
            {(node.tabs ?? []).map((t, i) => {
              const on = t.value === node.selected;
              return on ? (
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
            })}
          </Box>
        );

      case "copy-button":
        return (
          <Box key={key} borderStyle="round" paddingX={1}>
            <Text>{node.label ?? "Copy"}</Text>
          </Box>
        );

      case "form": {
        const inline = node.layout === "inline";
        return (
          <Box
            key={key}
            flexDirection={inline ? "row" : "column"}
            gap={1}
            alignItems={inline ? "flex-start" : undefined}
          >
            {(node.children ?? []).map((c, i) =>
              this.renderNode(c, this.keyOf(c, i), density),
            )}
            <Box borderStyle="round" paddingX={1}>
              <Text bold color="cyan">
                {node.submitLabel ?? "Submit"}
              </Text>
            </Box>
          </Box>
        );
      }

      case "field": {
        const it = node.inputType;
        if (it === "hidden") return <Box key={key} />;
        if (it === "checkbox") {
          const v = node.value;
          const truthy = !!v && v !== "false" && v !== "0";
          return (
            <Box key={key} flexDirection="row" gap={1}>
              <Text>{truthy ? "[x]" : "[ ]"}</Text>
              {node.label ? <Text>{node.label}</Text> : null}
            </Box>
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
        return (
          <Box key={key} flexDirection="column">
            {node.label ? <Text dimColor>{node.label}</Text> : null}
            <Box borderStyle="single" paddingX={1} minWidth={20}>
              <Text dimColor={!hasValue}>{display}</Text>
            </Box>
          </Box>
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
