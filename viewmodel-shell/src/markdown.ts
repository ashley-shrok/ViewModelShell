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
  /** Rewrite hook for image sources. Called per emitted `ImageNode` with
   *  the raw markdown src; the return value replaces `ImageNode.src`.
   *  Undefined (default) = no-op.
   *
   *  Use when relative image references in the source markdown must resolve
   *  to an app-served asset endpoint (git-backed docs / wikis / notes apps).
   *
   *  **Scope:** fires on markdown-syntax `![alt](src)` only. Inline HTML
   *  `<img>` bypasses the converter (currently deferred v1) and this hook. */
  imageSrcRewrite?: (src: string) => string;
  /** Rewrite hook for link hrefs. Called per emitted link URL (regular
   *  links and autolinks) with the raw markdown href; the return value
   *  replaces `InlineRun.href`. Undefined (default) = no-op.
   *
   *  Use when relative link references in the source markdown must resolve
   *  to app-routed URLs (git-backed docs cross-linking to each other, wiki
   *  page links, etc.).
   *
   *  **Scope:** fires on markdown-syntax `[label](href)` and autolinks
   *  `<https://...>` only. Inline HTML `<a>` bypasses the converter
   *  (currently deferred v1) and this hook.
   *
   *  **Order:** the hook runs before `external` is applied — external is a
   *  wire flag on the run, not a URL transform. */
  linkHrefRewrite?: (href: string) => string;
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
  const tokens = marked.lexer(md, { gfm: opts.gfm ?? true });
  return convertBlocks(tokens as Token[], opts);
}

// ── Block-level walk ────────────────────────────────────────────────────────

function convertBlocks(tokens: Token[], opts: MarkdownOptions): ViewNode[] {
  const out: ViewNode[] = [];
  for (const t of tokens) {
    const nodes = convertBlock(t, opts);
    if (nodes) out.push(...nodes);
  }
  return out;
}

function convertBlock(t: Token, opts: MarkdownOptions): ViewNode[] | null {
  switch (t.type) {
    case "space":
      return null;
    case "heading": {
      const h = t as Tokens.Heading;
      const runs = convertInline(h.tokens ?? [], opts);
      const level = clampLevel(h.depth);
      return [buildTextFromRuns(runs, level ? { level } : {})];
    }
    case "paragraph": {
      const p = t as Tokens.Paragraph;
      // Paragraph containing ONLY an image → standalone ImageNode (the
      // conventional markdown pattern for a captioned figure).
      if (p.tokens?.length === 1 && p.tokens[0]?.type === "image") {
        return [convertImage(p.tokens[0] as Tokens.Image, opts)];
      }
      const runs = convertInline(p.tokens ?? [], opts);
      return [buildTextFromRuns(runs)];
    }
    case "list":
      return [convertList(t as Tokens.List, opts)];
    case "blockquote": {
      const bq = t as Tokens.Blockquote;
      const node: BlockquoteNode = {
        type: "blockquote",
        children: convertBlocks(bq.tokens ?? [], opts),
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

function convertList(list: Tokens.List, opts: MarkdownOptions): ListNode {
  const items: ListItemNode[] = list.items.map((item) =>
    convertListItem(item, opts),
  );
  const node: ListNode = { type: "list", children: items };
  if (list.ordered) node.ordered = true;
  return node;
}

function convertListItem(
  item: Tokens.ListItem,
  opts: MarkdownOptions,
): ListItemNode {
  // A list_item's tokens[] MIX inline "text" (whose OWN nested `.tokens[]`
  // holds the real inline runs) with block-level nodes (nested list,
  // paragraph, blockquote, code, …). Walk once, buffering inline pieces and
  // flushing them as a TextNode whenever a block interrupts.
  const children: ViewNode[] = [];
  let inlineBuffer: Token[] = [];
  const flushInline = () => {
    if (inlineBuffer.length === 0) return;
    const runs = convertInline(inlineBuffer, opts);
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
      const block = convertBlock(t, opts);
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

function convertImage(img: Tokens.Image, opts: MarkdownOptions): ImageNode {
  const src = opts.imageSrcRewrite ? opts.imageSrcRewrite(img.href) : img.href;
  const node: ImageNode = { type: "image", src };
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
  opts: MarkdownOptions,
  ctx: InlineCtx = {},
): InlineRun[] {
  const external = opts.external ?? false;
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
          ...convertInline((t as Tokens.Strong).tokens ?? [], opts, {
            ...ctx,
            bold: true,
          }),
        );
        break;
      case "em":
        out.push(
          ...convertInline((t as Tokens.Em).tokens ?? [], opts, {
            ...ctx,
            italic: true,
          }),
        );
        break;
      case "del":
        out.push(
          ...convertInline((t as Tokens.Del).tokens ?? [], opts, {
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
        // Marked emits both `[label](href)` links and `<https://...>` autolinks
        // as "link" tokens; the autolink case is `l.text === l.href` with
        // `l.tokens` pre-populated to a single text token holding the URL.
        // For autolinks we substitute the rewritten href as the visible text
        // too — otherwise the label would lie about where the click goes.
        // For regular labeled links the author's label stays untouched.
        const href = opts.linkHrefRewrite ? opts.linkHrefRewrite(l.href) : l.href;
        const isAutolink = l.text === l.href;
        const inner = l.tokens && l.tokens.length > 0 && !isAutolink
          ? l.tokens
          : ([{ type: "text", raw: href, text: href, escaped: false }] as Token[]);
        out.push(
          ...convertInline(inner, opts, {
            ...ctx,
            href,
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
