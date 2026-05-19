import type { ReactElement } from "react";
import { render as inkRender, Box, Text } from "ink";
import type { Adapter, ActionEvent, ViewNode } from "./index.js";

type InkInstance = ReturnType<typeof inkRender>;

/**
 * Phase 0 terminal adapter (the "seam proof").
 *
 * Renders only `page` (title) + `text`; every other ViewNode renders a
 * visible fail-loud placeholder — never blank, never silent. Interaction,
 * layout fidelity, the single-line field editor, and the remaining nodes
 * arrive in later phases.
 *
 * LEAF MODULE: this file is never imported by src/index.ts / src/browser.ts /
 * src/server.ts, so `ink`/`react` never enter the web or server dependency
 * graph. (A unit test asserts this invariant.)
 *
 * Phase 0 deliberately does NOT implement `navigate`/`storage`/`transport`.
 * Their absence is the core's intended fail-loud behaviour; a `page`+`text`
 * GET with no redirect never triggers it. They land in Phase 4.
 */
export class TuiAdapter implements Adapter {
  private instance: InkInstance | undefined;
  private onAction: ((action: ActionEvent) => void) | undefined;
  private disposed = false;

  render(vm: ViewNode, onAction: (action: ActionEvent) => void): void {
    // Stored for later phases; Phase 0 has no interactive node so it is
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
    return this.renderNode(vm, 0);
  }

  private renderNode(node: ViewNode, key: number): ReactElement {
    switch (node.type) {
      case "page":
        return (
          <Box key={key} flexDirection="column">
            {node.title ? <Text bold>{node.title}</Text> : null}
            {(node.children ?? []).map((child, i) =>
              this.renderNode(child, i),
            )}
          </Box>
        );

      case "text": {
        const style = node.style;
        return (
          <Text
            key={key}
            bold={style === "heading" || style === "subheading"}
            color={style === "error" ? "red" : undefined}
            dimColor={style === "muted"}
            strikethrough={style === "strikethrough"}
          >
            {node.value}
          </Text>
        );
      }

      default:
        // Fail-loud: any node Phase 0 doesn't render yet is shown explicitly,
        // never dropped to a blank screen.
        return (
          <Text key={key} color="yellow">
            [unsupported: {node.type} — phase 0]
          </Text>
        );
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
