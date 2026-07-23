// Markdown -> ViewNode subtree converter (.NET twin of
// @ashley-shrok/viewmodel-shell/markdown). Public API:
//
//   IReadOnlyList<ViewNode> MarkdownConverter.ToViewNodes(md, opts?)
//
// Wire-parallel to the TS side: same markdown input produces the same
// ViewNode subtree shape, so the two backends of a hybrid app both render
// documentation the same way. The parity is enforced by feeding both
// converters the SAME fixture markdown in tests (viewmodel-shell/test/
// markdown-corpus/*.md) and asserting on the same structural properties.
//
// Doctrine (AGENTS.md): markdown -> tree is a SERVER-SIDE transform an app
// does with any parser and describes in framework vocabulary. This package
// ships the reference implementation against Markdig for the .NET side;
// nothing about the wire changes — it stays a pure ViewNode tree.
//
// Coverage: see README.md. Every optional field on emitted nodes is truly
// OMITTED (never null / never false) so the wire matches gotcha #8 —
// enforced by the null-omission attributes on the ViewNode records
// themselves (nothing to remember here beyond "don't pass an empty list").

using Markdig;
using Markdig.Extensions.TaskLists;
using Markdig.Syntax;
using Markdig.Syntax.Inlines;

namespace ViewModelShell.Markdown;

public sealed class MarkdownOptions
{
    /// <summary>When true, every parsed link is marked External (opens
    /// outside the current app context — new tab + noopener in the
    /// browser). Default false: markdown is agnostic about link targets,
    /// and the app usually knows more than the source text does. Set true
    /// on a page rendering documentation whose links point at unrelated
    /// third parties.</summary>
    public bool External { get; init; }
}

public static class MarkdownConverter
{
    // Cached pipelines — pipeline construction is not free, and the two
    // shapes (GFM on, GFM off) are the only ones the public API produces.
    private static readonly MarkdownPipeline PipelineGfm = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()
        .Build();

    /// <summary>Parse <paramref name="md"/> into a flat block-level
    /// <see cref="ViewNode"/> list. Compose into any children slot —
    /// <c>new PageNode(Children: MarkdownConverter.ToViewNodes(md))</c>,
    /// a section, a modal body, a list-item's block content, etc.
    /// Coverage detail lives in the package README; deferred v1 features
    /// (raw HTML blocks, tables, footnotes, definition lists) are silently
    /// skipped rather than throwing so the page still renders the parts
    /// we do understand.</summary>
    public static IReadOnlyList<ViewNode> ToViewNodes(string md, MarkdownOptions? opts = null)
    {
        opts ??= new MarkdownOptions();
        // We always parse with the advanced extensions on — the pipeline
        // includes GFM task lists + strikethrough + tables. Tables are
        // silently skipped downstream (deferred v1); running the extension
        // means the parser recognizes and eats the table syntax rather
        // than leaking it back as broken inline text.
        var doc = Markdig.Markdown.Parse(md, PipelineGfm);
        return ConvertBlocks(doc, opts);
    }

    // ── Block-level walk ────────────────────────────────────────────────

    private static List<ViewNode> ConvertBlocks(ContainerBlock container, MarkdownOptions opts)
    {
        var result = new List<ViewNode>();
        foreach (var block in container)
        {
            var nodes = ConvertBlock(block, opts);
            if (nodes is not null) result.AddRange(nodes);
        }
        return result;
    }

    private static IReadOnlyList<ViewNode>? ConvertBlock(Block block, MarkdownOptions opts)
    {
        switch (block)
        {
            case HeadingBlock h:
            {
                var runs = ConvertInline(h.Inline, opts, new InlineCtx());
                var level = ClampLevel(h.Level);
                return new[] { BuildTextFromRuns(runs, level: level) };
            }
            case ParagraphBlock p:
            {
                // Paragraph containing ONLY an image -> standalone ImageNode
                // (the conventional markdown pattern for a captioned figure).
                if (IsImageOnlyParagraph(p.Inline, out var imgInline))
                {
                    return new[] { ConvertImage(imgInline) };
                }
                var runs = ConvertInline(p.Inline, opts, new InlineCtx());
                return new[] { BuildTextFromRuns(runs) };
            }
            case ListBlock list:
                return new[] { ConvertList(list, opts) };
            case QuoteBlock quote:
            {
                var children = ConvertBlocks(quote, opts);
                return new[] { new BlockquoteNode(children) };
            }
            case FencedCodeBlock fenced:
            {
                var code = fenced.Lines.ToString();
                var lang = string.IsNullOrEmpty(fenced.Info) ? null : fenced.Info;
                return new ViewNode[] { new CodeBlockNode(code, Language: lang) };
            }
            case CodeBlock codeBlock:
            {
                // Indented code block (no fence, no language).
                var code = codeBlock.Lines.ToString();
                return new ViewNode[] { new CodeBlockNode(code) };
            }
            case ThematicBreakBlock:
                return new ViewNode[] { new DividerNode() };
            // Deferred v1: HtmlBlock, tables, footnotes, definition lists.
            // Return null so they are silently skipped rather than hard-failing.
            default:
                return null;
        }
    }

    private static ListNode ConvertList(ListBlock list, MarkdownOptions opts)
    {
        var items = new List<ListItemNode>(list.Count);
        foreach (var child in list)
        {
            if (child is ListItemBlock item) items.Add(ConvertListItem(item, opts));
        }
        return new ListNode(items, Ordered: list.IsOrdered);
    }

    private static ListItemNode ConvertListItem(ListItemBlock item, MarkdownOptions opts)
    {
        // Markdig models a task-list marker as a TaskList INLINE inside the
        // first ParagraphBlock of the ListItem. Extract it if present and
        // strip it from the inline walk so we don't emit the "[ ]" glyph
        // as literal text inside the item.
        bool? completed = null;
        var children = new List<ViewNode>();
        foreach (var block in item)
        {
            if (block is ParagraphBlock p)
            {
                // Find + remove any TaskList inline (there's at most one at
                // the start of the first paragraph).
                if (completed is null)
                {
                    var task = FindTaskListInline(p.Inline);
                    if (task is not null)
                    {
                        completed = task.Checked;
                        task.Remove();
                    }
                }
                var runs = ConvertInline(p.Inline, opts, new InlineCtx());
                if (runs.Count > 0) children.Add(BuildTextFromRuns(runs));
            }
            else
            {
                var nodes = ConvertBlock(block, opts);
                if (nodes is not null) children.AddRange(nodes);
            }
        }
        return new ListItemNode(Id: null, State: null, Children: children, Completed: completed);
    }

    private static TaskList? FindTaskListInline(ContainerInline? container)
    {
        if (container is null) return null;
        foreach (var inline in container)
        {
            if (inline is TaskList tl) return tl;
        }
        return null;
    }

    private static bool IsImageOnlyParagraph(ContainerInline? container, out LinkInline image)
    {
        image = null!;
        if (container is null) return false;
        LinkInline? found = null;
        int count = 0;
        foreach (var inline in container)
        {
            count++;
            if (count > 1) return false;
            if (inline is LinkInline l && l.IsImage) found = l;
            else return false;
        }
        if (found is null) return false;
        image = found;
        return true;
    }

    private static ImageNode ConvertImage(LinkInline img)
    {
        var src = img.Url ?? "";
        // Alt text is the concatenation of the image's inline children as
        // literal text (markdown allows nested inlines inside alt but the
        // wire is a plain string). Preserves "![some *emphasis*](x.png)"
        // as "some emphasis".
        var alt = FlattenPlainText(img);
        var caption = string.IsNullOrEmpty(img.Title) ? null : img.Title;
        return new ImageNode(
            src,
            Alt: string.IsNullOrEmpty(alt) ? null : alt,
            Caption: caption
        );
    }

    // ── Inline walk ──────────────────────────────────────────────────────

    private readonly struct InlineCtx
    {
        public bool Bold { get; init; }
        public bool Italic { get; init; }
        public bool Strike { get; init; }
        public string? Href { get; init; }
        public bool External { get; init; }
    }

    private static List<InlineRun> ConvertInline(ContainerInline? container, MarkdownOptions opts, InlineCtx ctx)
    {
        var runs = new List<InlineRun>();
        if (container is null) return runs;
        foreach (var inline in container) ConvertInlineOne(inline, opts, ctx, runs);
        return runs;
    }

    private static void ConvertInlineOne(Inline inline, MarkdownOptions opts, InlineCtx ctx, List<InlineRun> runs)
    {
        switch (inline)
        {
            case LiteralInline lit:
            {
                var text = lit.Content.ToString();
                if (text.Length > 0) runs.Add(MakeRun(text, ctx));
                break;
            }
            case EmphasisInline em:
            {
                var next = ctx;
                switch (em.DelimiterChar)
                {
                    case '~':
                        next = next with { Strike = true };
                        break;
                    case '*':
                    case '_':
                        if (em.DelimiterCount >= 2) next = next with { Bold = true };
                        else next = next with { Italic = true };
                        break;
                }
                runs.AddRange(ConvertInline(em, opts, next));
                break;
            }
            case CodeInline code:
            {
                var run = new InlineRun(
                    code.Content,
                    Bold: ctx.Bold,
                    Italic: ctx.Italic,
                    Code: true,
                    Strike: ctx.Strike,
                    Href: ctx.Href,
                    External: ctx.External
                );
                runs.Add(run);
                break;
            }
            case LinkInline link when !link.IsImage:
            {
                var href = link.Url ?? "";
                var next = ctx with { Href = href, External = opts.External };
                var inner = ConvertInline(link, opts, next);
                if (inner.Count == 0)
                {
                    // Empty label -> emit the URL as the run text so agents/TUI
                    // adapters still see something readable.
                    runs.Add(MakeRun(href, next));
                }
                else
                {
                    runs.AddRange(inner);
                }
                break;
            }
            case LineBreakInline:
                runs.Add(MakeRun("\n", ctx));
                break;
            case LinkInline link when link.IsImage:
            case TaskList:
            case HtmlInline:
                // Inline images inside prose: rare, deferred. TaskList: handled
                // in ConvertListItem before we walk. Raw inline HTML: deferred.
                break;
            case AutolinkInline auto:
            {
                var url = auto.Url ?? "";
                var next = ctx with { Href = url, External = opts.External };
                runs.Add(MakeRun(url, next));
                break;
            }
            case ContainerInline container:
                // Unknown container inline -> walk children with the current context.
                runs.AddRange(ConvertInline(container, opts, ctx));
                break;
            default:
            {
                // Fail-open on unknown leaves: preserve their text if any so a
                // new inline construct never silently swallows content.
                var text = inline.ToString();
                if (!string.IsNullOrEmpty(text)) runs.Add(MakeRun(text!, ctx));
                break;
            }
        }
    }

    private static InlineRun MakeRun(string text, InlineCtx ctx)
        => new(
            text,
            Bold: ctx.Bold,
            Italic: ctx.Italic,
            Code: false,
            Strike: ctx.Strike,
            Href: ctx.Href,
            External: ctx.External
        );

    private static string FlattenPlainText(ContainerInline container)
    {
        var sb = new System.Text.StringBuilder();
        FlattenInto(container, sb);
        return sb.ToString();
    }

    private static void FlattenInto(ContainerInline container, System.Text.StringBuilder sb)
    {
        foreach (var inline in container)
        {
            switch (inline)
            {
                case LiteralInline lit:
                    sb.Append(lit.Content.ToString());
                    break;
                case CodeInline code:
                    sb.Append(code.Content);
                    break;
                case ContainerInline c:
                    FlattenInto(c, sb);
                    break;
                default:
                {
                    var text = inline.ToString();
                    if (!string.IsNullOrEmpty(text)) sb.Append(text);
                    break;
                }
            }
        }
    }

    // ── TextNode assembly ────────────────────────────────────────────────

    private static TextNode BuildTextFromRuns(IReadOnlyList<InlineRun> runs, int? level = null)
    {
        if (runs.Count == 0)
        {
            return new TextNode("", Level: level);
        }
        // Collapse to plain when NO run carries formatting or a link — the
        // BrowserAdapter's rich-runs path is bypassed, keeping the wire minimal
        // and byte-identical to the TS twin's "all plain" collapse.
        bool anyRich = false;
        foreach (var r in runs)
        {
            if (r.Bold || r.Italic || r.Strike || r.Code || r.Href is not null) { anyRich = true; break; }
        }
        if (!anyRich)
        {
            var sb = new System.Text.StringBuilder();
            foreach (var r in runs) sb.Append(r.Text);
            return new TextNode(sb.ToString(), Level: level);
        }
        // Use FromRuns so Value is DERIVED from runs — never hand-write both
        // (the same safety-property discipline as the TS twin's richText()).
        var t = TextNode.FromRuns(runs);
        return t with { Level = level };
    }

    private static int? ClampLevel(int n)
    {
        if (n >= 1 && n <= 6) return n;
        return null;
    }
}
