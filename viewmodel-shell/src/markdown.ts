/**
 * Convert markdown source text into a `ViewNode[]` subtree consumers drop
 * into a container (`{ type: "page", children: markdownToViewNodes(md) }`).
 *
 * COMPANION, NOT CORE. `marked` is declared as an OPTIONAL peer dep of
 * `@ashley-shrok/viewmodel-shell` and imported from THIS subpath only, so a
 * consumer that never imports `@ashley-shrok/viewmodel-shell/markdown` never
 * loads it — the core stays zero-runtime-deps. Fail-loud on missing peer:
 * the static `import { marked }` below throws `ERR_MODULE_NOT_FOUND` at load
 * time rather than degrading silently.
 *
 * DOCTRINE. `AGENTS.md` frames markdown → tree as a SERVER-SIDE transform an
 * app does with any parser and describes in framework vocabulary — not a
 * client-side MarkdownNode. This subpath ships the reference implementation
 * against `marked`; the byte-parallel .NET twin lives in
 * `AshleyShrok.ViewModelShell.Markdown` using Markdig.
 */
import { marked, type Token, type Tokens } from "marked";
import type {
  ViewNode,
  TextNode,
  ListNode,
  ListItemNode,
  ImageNode,
  BlockquoteNode,
  CodeBlockNode,
  DividerNode,
  InlineRun,
} from "./index.js";
import { richText } from "./index.js";

export interface MarkdownOptions {
  /** When true, every parsed `LinkNode`/`InlineRun` link is marked `external`
   *  (opens outside the current app context — new tab + noopener in the
   *  browser). Default false: markdown is agnostic about link targets, and
   *  the app usually knows more than the source text does. Set true on a
   *  page rendering documentation whose links point at unrelated third
   *  parties. */
  external?: boolean;
  /** GFM extensions (task-list markers, strikethrough) enabled by default.
   *  Set false for strict CommonMark. */
  gfm?: boolean;
}

/** Parse `md` into a flat block-level `ViewNode[]`. Compose into any
 *  children slot: `{ type: "section", children: markdownToViewNodes(md) }`,
 *  `PageNode.children`, a modal body, a list-item's block content, etc.
 *
 *  Coverage v1: headings 1–6 (emitted as `TextNode.level` → real `<h1>–<h6>`),
 *  paragraphs (`TextNode` + inline `runs` when formatting is present),
 *  ordered/unordered/nested lists (`ListNode`/`ListItemNode`), GFM task-list
 *  markers (`ListItemNode.completed`), blockquotes (`BlockquoteNode`, block
 *  children preserved), fenced code blocks (`CodeBlockNode` with `language`),
 *  images (`ImageNode` — a paragraph containing only an image unwraps to a
 *  standalone image; the markdown title becomes the caption), horizontal
 *  rules (`DividerNode`), and inline emphasis / strikethrough / inline code /
 *  links (`InlineRun` flags + `href`). Deferred (silently skipped v1): raw
 *  HTML blocks, tables (rich table cells are a separate design pass — see
 *  the bounty), footnotes, definition lists. */
export function markdownToViewNodes(
  md: string,
  opts: MarkdownOptions = {},
): ViewNode[] {
  const external = opts.external ?? false;
  const tokens = marked.lexer(md, { gfm: opts.gfm ?? true });
  return convertBlocks(tokens as Token[], external);
}

// ── Block-level walk ────────────────────────────────────────────────────────

function convertBlocks(tokens: Token[], external: boolean): ViewNode[] {
  const out: ViewNode[] = [];
  for (const t of tokens) {
    const nodes = convertBlock(t, external);
    if (nodes) out.push(...nodes);
  }
  return out;
}

function convertBlock(t: Token, external: boolean): ViewNode[] | null {
  switch (t.type) {
    case "space":
      return null;
    case "heading": {
      const h = t as Tokens.Heading;
      const runs = convertInline(h.tokens ?? [], external);
      const level = clampLevel(h.depth);
      return [buildTextFromRuns(runs, level ? { level } : {})];
    }
    case "paragraph": {
      const p = t as Tokens.Paragraph;
      // Paragraph containing ONLY an image → standalone ImageNode (the
      // conventional markdown pattern for a captioned figure).
      if (p.tokens?.length === 1 && p.tokens[0]?.type === "image") {
        return [convertImage(p.tokens[0] as Tokens.Image)];
      }
      const runs = convertInline(p.tokens ?? [], external);
      return [buildTextFromRuns(runs)];
    }
    case "list":
      return [convertList(t as Tokens.List, external)];
    case "blockquote": {
      const bq = t as Tokens.Blockquote;
      const node: BlockquoteNode = {
        type: "blockquote",
        children: convertBlocks(bq.tokens ?? [], external),
      };
      return [node];
    }
    case "code": {
      const c = t as Tokens.Code;
      const node: CodeBlockNode = { type: "code-block", code: c.text };
      if (c.lang) node.language = c.lang;
      return [node];
    }
    case "hr": {
      const node: DividerNode = { type: "divider" };
      return [node];
    }
    // Deferred (documented in the top comment): raw HTML, tables, footnotes,
    // definition lists. Silently skipped rather than a hard failure — the
    // page still renders the parts we do understand.
    case "html":
    case "table":
    default:
      return null;
  }
}

function convertList(list: Tokens.List, external: boolean): ListNode {
  const items: ListItemNode[] = list.items.map((item) =>
    convertListItem(item, external),
  );
  const node: ListNode = { type: "list", children: items };
  if (list.ordered) node.ordered = true;
  return node;
}

function convertListItem(
  item: Tokens.ListItem,
  external: boolean,
): ListItemNode {
  // A list_item's tokens[] MIX inline "text" (whose OWN nested `.tokens[]`
  // holds the real inline runs) with block-level nodes (nested list,
  // paragraph, blockquote, code, …). Walk once, buffering inline pieces and
  // flushing them as a TextNode whenever a block interrupts.
  const children: ViewNode[] = [];
  let inlineBuffer: Token[] = [];
  const flushInline = () => {
    if (inlineBuffer.length === 0) return;
    const runs = convertInline(inlineBuffer, external);
    if (runs.length > 0 || inlineBuffer.some((t) => t.type === "text")) {
      children.push(buildTextFromRuns(runs));
    }
    inlineBuffer = [];
  };
  for (const t of item.tokens ?? []) {
    if (t.type === "text") {
      // The outer text token here is a WRAPPER — its nested `.tokens` are the
      // real inline runs (bold/em/link/…). Unwrap one level; fall through to
      // treating it as a plain text run if unwrapping is absent.
      const nested = (t as Tokens.Text & { tokens?: Token[] }).tokens;
      if (nested) inlineBuffer.push(...nested);
      else inlineBuffer.push(t);
    } else if (isBlockLevel(t)) {
      flushInline();
      const block = convertBlock(t, external);
      if (block) children.push(...block);
    } else {
      // An inline token appearing directly (rare — marked usually wraps in
      // text): treat as inline.
      inlineBuffer.push(t);
    }
  }
  flushInline();

  const node: ListItemNode = { type: "list-item", children };
  if (item.task) node.completed = !!item.checked;
  return node;
}

function isBlockLevel(t: Token): boolean {
  switch (t.type) {
    case "list":
    case "blockquote":
    case "code":
    case "heading":
    case "paragraph":
    case "hr":
    case "html":
    case "table":
    case "space":
      return true;
    default:
      return false;
  }
}

function convertImage(img: Tokens.Image): ImageNode {
  const node: ImageNode = { type: "image", src: img.href };
  if (img.text) node.alt = img.text;
  if (img.title) node.caption = img.title;
  return node;
}

// ── Inline walk ─────────────────────────────────────────────────────────────

interface InlineCtx {
  bold?: true;
  italic?: true;
  strike?: true;
  href?: string;
  extern?: true;
}

function convertInline(
  tokens: Token[],
  external: boolean,
  ctx: InlineCtx = {},
): InlineRun[] {
  const out: InlineRun[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "text":
      case "escape": {
        const txt = (t as Tokens.Text | Tokens.Escape).text;
        if (txt) out.push(mkRun(txt, ctx));
        break;
      }
      case "strong":
        out.push(
          ...convertInline((t as Tokens.Strong).tokens ?? [], external, {
            ...ctx,
            bold: true,
          }),
        );
        break;
      case "em":
        out.push(
          ...convertInline((t as Tokens.Em).tokens ?? [], external, {
            ...ctx,
            italic: true,
          }),
        );
        break;
      case "del":
        out.push(
          ...convertInline((t as Tokens.Del).tokens ?? [], external, {
            ...ctx,
            strike: true,
          }),
        );
        break;
      case "codespan": {
        const run: InlineRun = { text: (t as Tokens.Codespan).text, code: true };
        if (ctx.bold) run.bold = true;
        if (ctx.italic) run.italic = true;
        if (ctx.strike) run.strike = true;
        if (ctx.href) run.href = ctx.href;
        if (ctx.extern) run.external = true;
        out.push(run);
        break;
      }
      case "link": {
        const l = t as Tokens.Link;
        const inner = l.tokens && l.tokens.length > 0
          ? l.tokens
          : ([{ type: "text", raw: l.text, text: l.text, escaped: false }] as Token[]);
        out.push(
          ...convertInline(inner, external, {
            ...ctx,
            href: l.href,
            ...(external ? { extern: true as const } : {}),
          }),
        );
        break;
      }
      case "br":
        out.push(mkRun("\n", ctx));
        break;
      case "image":
      case "checkbox":
        // Inline images: rare inside prose; deferred (block-level images are
        // handled). Checkbox: consumed at the list_item level via `task`/
        // `checked`; ignored if it slips through.
        break;
      default: {
        // Fail-open on unknown inline tokens: preserve their raw text if any,
        // so a new inline construct never silently swallows content.
        const raw = (t as { text?: string; raw?: string }).text ?? (t as { raw?: string }).raw;
        if (typeof raw === "string" && raw.length > 0) out.push(mkRun(raw, ctx));
      }
    }
  }
  return out;
}

function mkRun(text: string, ctx: InlineCtx): InlineRun {
  const r: InlineRun = { text };
  if (ctx.bold) r.bold = true;
  if (ctx.italic) r.italic = true;
  if (ctx.strike) r.strike = true;
  if (ctx.href) r.href = ctx.href;
  if (ctx.extern) r.external = true;
  return r;
}

// ── TextNode assembly ───────────────────────────────────────────────────────

function buildTextFromRuns(
  runs: InlineRun[],
  opts: { level?: 1 | 2 | 3 | 4 | 5 | 6 } = {},
): TextNode {
  if (runs.length === 0) {
    const t: TextNode = { type: "text", value: "" };
    if (opts.level) t.level = opts.level;
    return t;
  }
  // Collapse to plain when NO run carries formatting or a link: the
  // BrowserAdapter's rich-runs path is bypassed, keeping the wire minimal.
  const allPlain = runs.every(
    (r) => !r.bold && !r.italic && !r.strike && !r.code && !r.href,
  );
  if (allPlain) {
    const t: TextNode = { type: "text", value: runs.map((r) => r.text).join("") };
    if (opts.level) t.level = opts.level;
    return t;
  }
  // Use richText() so `value` is DERIVED from runs. Never hand-write both —
  // that's the one way this feature can lie (documented in `richText()`).
  const t = richText(runs);
  if (opts.level) t.level = opts.level;
  return t;
}

function clampLevel(n: number): 1 | 2 | 3 | 4 | 5 | 6 | null {
  if (n >= 1 && n <= 6 && Number.isInteger(n)) return n as 1 | 2 | 3 | 4 | 5 | 6;
  return null;
}
