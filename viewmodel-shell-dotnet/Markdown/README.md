# AshleyShrok.ViewModelShell.Markdown

Markdown → `ViewNode` subtree converter for
[`AshleyShrok.ViewModelShell`](https://www.nuget.org/packages/AshleyShrok.ViewModelShell).
Byte-parallel to the TS twin
[`@ashley-shrok/viewmodel-shell/markdown`](https://www.npmjs.com/package/@ashley-shrok/viewmodel-shell) —
feed the same markdown string into either and get an equivalent `ViewNode`
subtree.

## Why a separate package

Core VMS has zero runtime dependencies. This package adds a
`PackageReference` to [Markdig](https://github.com/xoofx/markdig) and ships
as a **companion** so a consumer that never renders markdown never pulls
Markdig into their build graph — the same "opt-in via subpath" seam the
npm side uses for `marked`.

## Usage

```csharp
using ViewModelShell;
using ViewModelShell.Markdown;

string md = "# Hello\n\nA paragraph with **bold** and a [link](https://ex.com).";

IReadOnlyList<ViewNode> nodes = MarkdownConverter.ToViewNodes(md);

// Compose into any children slot:
var page = new PageNode(Title: "Docs", Children: nodes);
```

Set `MarkdownOptions.External = true` to mark every link in the parsed
markdown as opening outside the current app context (new tab + noopener
in the browser).

## Coverage

Everything the TS twin supports, on the same input, producing the same
subtree shape:

- Headings 1–6 → `TextNode` with `Level` (real `<h1>–<h6>`)
- Paragraphs → `TextNode`, with inline `Runs` only when formatting is
  present
- Ordered / unordered / nested lists → `ListNode` + `ListItemNode`
- GFM task-list markers → `ListItemNode.Completed`
- Blockquotes → `BlockquoteNode`
- Fenced code blocks → `CodeBlockNode` with `Language`
- Images → `ImageNode` (image-only paragraphs unwrap to standalone images;
  the markdown-title third argument becomes `Caption`)
- Horizontal rules → `DividerNode`
- Inline bold / italic / strikethrough / inline code / links → `InlineRun`
  flags + `Href`

Deferred v1 (silently skipped): raw HTML blocks, tables (rich table cells
are a separate design pass), footnotes, definition lists.

## License

MIT.
