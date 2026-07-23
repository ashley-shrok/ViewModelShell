// Markdown converter tests. Structural assertions on the emitted ViewNode
// tree, mirroring the TS twin's src/markdown.test.ts. One test per token
// family, plus the shared corpus fixtures at the bottom (linked from
// viewmodel-shell/test/markdown-corpus/) so both backends are validated
// against IDENTICAL input.
using System.IO;
using System.Linq;

namespace ViewModelShell.Markdown.Tests;

public class MarkdownConverterTests
{
    // ── Block-level: headings ──────────────────────────────────────────

    [Fact]
    public void Headings_Emit_TextNode_Level_1_Through_6()
    {
        var md = "# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six";
        var nodes = MarkdownConverter.ToViewNodes(md);
        Assert.Equal(6, nodes.Count);
        for (int i = 0; i < 6; i++)
        {
            var text = Assert.IsType<TextNode>(nodes[i]);
            Assert.Equal(i + 1, text.Level);
        }
        Assert.Equal("One", ((TextNode)nodes[0]).Value);
        Assert.Equal("Six", ((TextNode)nodes[5]).Value);
    }

    [Fact]
    public void Heading_Preserves_Inline_Runs()
    {
        var md = "# The **bold** one";
        var h = Assert.IsType<TextNode>(MarkdownConverter.ToViewNodes(md).Single());
        Assert.Equal(1, h.Level);
        Assert.Equal("The bold one", h.Value);
        Assert.NotNull(h.Runs);
        Assert.Equal(3, h.Runs!.Count);
        Assert.Equal("The ", h.Runs[0].Text); Assert.False(h.Runs[0].Bold);
        Assert.Equal("bold", h.Runs[1].Text); Assert.True(h.Runs[1].Bold);
        Assert.Equal(" one", h.Runs[2].Text); Assert.False(h.Runs[2].Bold);
    }

    // ── Block-level: paragraphs + inline emphasis ──────────────────────

    [Fact]
    public void Plain_Paragraph_Collapses_Runs()
    {
        var p = Assert.IsType<TextNode>(MarkdownConverter.ToViewNodes("Hello world.").Single());
        Assert.Equal("Hello world.", p.Value);
        Assert.Null(p.Runs);
        Assert.Null(p.Level);
    }

    [Fact]
    public void Inline_Bold_Italic_Strike_Code_Compose_As_Runs()
    {
        var md = "A **bold** and *em* and ~~gone~~ and `inline`.";
        var p = Assert.IsType<TextNode>(MarkdownConverter.ToViewNodes(md).Single());
        Assert.Equal("A bold and em and gone and inline.", p.Value);
        Assert.NotNull(p.Runs);
        var runs = p.Runs!;
        // Assert on the SPECIFIC runs carrying each flag.
        Assert.Contains(runs, r => r.Text == "bold" && r.Bold);
        Assert.Contains(runs, r => r.Text == "em" && r.Italic);
        Assert.Contains(runs, r => r.Text == "gone" && r.Strike);
        Assert.Contains(runs, r => r.Text == "inline" && r.Code);
    }

    [Fact]
    public void Nested_Emphasis_Unions_Flags()
    {
        var md = "**bold with *italic* inside**";
        var p = Assert.IsType<TextNode>(MarkdownConverter.ToViewNodes(md).Single());
        Assert.NotNull(p.Runs);
        // The middle run carries BOTH bold + italic.
        Assert.Contains(p.Runs!, r => r.Text == "italic" && r.Bold && r.Italic);
    }

    // ── Inline links ────────────────────────────────────────────────────

    [Fact]
    public void Link_Wraps_Runs_With_Href()
    {
        var md = "See [the docs](https://example.com) here.";
        var p = Assert.IsType<TextNode>(MarkdownConverter.ToViewNodes(md).Single());
        Assert.NotNull(p.Runs);
        Assert.Contains(p.Runs!, r => r.Text == "the docs" && r.Href == "https://example.com");
    }

    [Fact]
    public void Bold_Inside_Link_Preserved_As_Run_With_Both()
    {
        var md = "Read [Docs **Home**](https://example.com) now.";
        var p = Assert.IsType<TextNode>(MarkdownConverter.ToViewNodes(md).Single());
        Assert.NotNull(p.Runs);
        Assert.Contains(p.Runs!, r =>
            r.Text == "Home" && r.Bold && r.Href == "https://example.com");
    }

    [Fact]
    public void External_Flag_Applies_When_Option_Set()
    {
        var md = "See [docs](https://example.com).";
        var p = Assert.IsType<TextNode>(
            MarkdownConverter.ToViewNodes(md, new MarkdownOptions { External = true }).Single());
        Assert.Contains(p.Runs!, r => r.Href == "https://example.com" && r.External);
    }

    [Fact]
    public void External_Absent_When_Option_Unset()
    {
        var md = "See [docs](https://example.com).";
        var p = Assert.IsType<TextNode>(MarkdownConverter.ToViewNodes(md).Single());
        var link = p.Runs!.First(r => r.Href == "https://example.com");
        Assert.False(link.External);
    }

    // ── Lists (unordered / ordered / nested / task) ────────────────────

    [Fact]
    public void Unordered_List_No_Ordered_Flag()
    {
        var list = Assert.IsType<ListNode>(MarkdownConverter.ToViewNodes("- one\n- two").Single());
        Assert.False(list.Ordered);
        Assert.Equal(2, list.Children.Count);
        var first = Assert.IsType<ListItemNode>(list.Children[0]);
        var text = Assert.IsType<TextNode>(first.Children[0]);
        Assert.Equal("one", text.Value);
    }

    [Fact]
    public void Ordered_List_Sets_Ordered_True()
    {
        var list = Assert.IsType<ListNode>(MarkdownConverter.ToViewNodes("1. one\n2. two").Single());
        Assert.True(list.Ordered);
    }

    [Fact]
    public void Task_List_Items_Set_Completed()
    {
        var md = "- [x] done\n- [ ] todo\n- plain";
        var list = Assert.IsType<ListNode>(MarkdownConverter.ToViewNodes(md).Single());
        var done = Assert.IsType<ListItemNode>(list.Children[0]);
        var todo = Assert.IsType<ListItemNode>(list.Children[1]);
        var plain = Assert.IsType<ListItemNode>(list.Children[2]);
        Assert.True(done.Completed);
        Assert.False(todo.Completed);
        Assert.Null(plain.Completed);
    }

    [Fact]
    public void Nested_List_Lives_Under_ListItem_As_Child_ListNode()
    {
        var md = "- Outer\n  - Inner one\n  - Inner two";
        var list = Assert.IsType<ListNode>(MarkdownConverter.ToViewNodes(md).Single());
        var outer = Assert.IsType<ListItemNode>(list.Children[0]);
        Assert.Equal(2, outer.Children.Count);
        var outerText = Assert.IsType<TextNode>(outer.Children[0]);
        Assert.Equal("Outer", outerText.Value);
        var nested = Assert.IsType<ListNode>(outer.Children[1]);
        Assert.Equal(2, nested.Children.Count);
        var innerFirst = Assert.IsType<ListItemNode>(nested.Children[0]);
        Assert.Equal("Inner one", Assert.IsType<TextNode>(innerFirst.Children[0]).Value);
    }

    [Fact]
    public void ListItem_Preserves_Inline_Formatting()
    {
        var md = "- item **bold**";
        var list = Assert.IsType<ListNode>(MarkdownConverter.ToViewNodes(md).Single());
        var item = Assert.IsType<ListItemNode>(list.Children[0]);
        var text = Assert.IsType<TextNode>(item.Children[0]);
        Assert.NotNull(text.Runs);
        Assert.Contains(text.Runs!, r => r.Text == "bold" && r.Bold);
    }

    // ── Blockquotes ────────────────────────────────────────────────────

    [Fact]
    public void Blockquote_Holds_Block_Level_Children()
    {
        var q = Assert.IsType<BlockquoteNode>(
            MarkdownConverter.ToViewNodes("> A quote line\n> continues here").Single());
        Assert.Single(q.Children);
        var p = Assert.IsType<TextNode>(q.Children[0]);
        Assert.Contains("A quote line", p.Value);
    }

    [Fact]
    public void Blockquote_Preserves_Nested_List()
    {
        var md = "> intro\n>\n> - a\n> - b";
        var q = Assert.IsType<BlockquoteNode>(MarkdownConverter.ToViewNodes(md).Single());
        Assert.Equal(2, q.Children.Count);
        Assert.IsType<TextNode>(q.Children[0]);
        var list = Assert.IsType<ListNode>(q.Children[1]);
        Assert.Equal(2, list.Children.Count);
    }

    // ── Code blocks ────────────────────────────────────────────────────

    [Fact]
    public void Fenced_Code_Captures_Language()
    {
        var md = "```python\nprint('hi')\n```";
        var cb = Assert.IsType<CodeBlockNode>(MarkdownConverter.ToViewNodes(md).Single());
        Assert.Contains("print('hi')", cb.Code);
        Assert.Equal("python", cb.Language);
    }

    [Fact]
    public void Fence_Without_Language_Omits_It()
    {
        var cb = Assert.IsType<CodeBlockNode>(
            MarkdownConverter.ToViewNodes("```\nplain\n```").Single());
        Assert.Null(cb.Language);
    }

    // ── Images ─────────────────────────────────────────────────────────

    [Fact]
    public void Image_Only_Paragraph_Unwraps_To_ImageNode()
    {
        var img = Assert.IsType<ImageNode>(
            MarkdownConverter.ToViewNodes("![alt text](img.png \"a caption\")").Single());
        Assert.Equal("img.png", img.Src);
        Assert.Equal("alt text", img.Alt);
        Assert.Equal("a caption", img.Caption);
    }

    [Fact]
    public void Image_Without_Alt_Or_Caption_Omits_Them()
    {
        var img = Assert.IsType<ImageNode>(
            MarkdownConverter.ToViewNodes("![](img.png)").Single());
        Assert.Equal("img.png", img.Src);
        Assert.Null(img.Alt);
        Assert.Null(img.Caption);
    }

    // ── Horizontal rule ────────────────────────────────────────────────

    [Fact]
    public void HorizontalRule_Emits_Divider()
    {
        var d = Assert.IsType<DividerNode>(MarkdownConverter.ToViewNodes("---").Single());
        Assert.Null(d.Orientation);
    }

    // ── Deferred features skip silently ─────────────────────────────────

    [Fact]
    public void Raw_HTML_Blocks_Are_Skipped()
    {
        var md = "para\n\n<div>raw</div>\n\nmore";
        var nodes = MarkdownConverter.ToViewNodes(md);
        var texts = nodes.OfType<TextNode>().Select(t => t.Value).ToArray();
        Assert.Contains("para", texts);
        Assert.Contains("more", texts);
    }

    [Fact]
    public void Tables_Are_Skipped()
    {
        var md = "para\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nafter";
        var nodes = MarkdownConverter.ToViewNodes(md);
        var texts = nodes.OfType<TextNode>().Select(t => t.Value).ToArray();
        Assert.Contains("para", texts);
        Assert.Contains("after", texts);
    }

    // ── Derived-value safety property (matches TS richText() discipline) ──

    [Fact]
    public void FromRuns_Derives_Value_From_Runs()
    {
        var md = "**a**b**c**";
        var p = Assert.IsType<TextNode>(MarkdownConverter.ToViewNodes(md).Single());
        Assert.NotNull(p.Runs);
        Assert.Equal(string.Concat(p.Runs!.Select(r => r.Text)), p.Value);
    }

    // ── Corpus fixtures — SHARED with TS twin ──────────────────────────

    [Theory]
    [InlineData("readme.md")]
    [InlineData("technical-doc.md")]
    [InlineData("github-issue.md")]
    public void Corpus_Parses_Into_Structurally_Valid_Tree(string filename)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "markdown-corpus", filename);
        Assert.True(File.Exists(path), $"corpus fixture missing: {path}");
        var md = File.ReadAllText(path);
        var nodes = MarkdownConverter.ToViewNodes(md);
        Assert.NotEmpty(nodes);
        // Assertions parallel the TS twin's per-fixture structural checks.
        switch (filename)
        {
            case "readme.md":
            {
                var kinds = nodes.Select(n => n.GetType().Name).ToHashSet();
                Assert.Contains("TextNode", kinds);
                Assert.Contains("CodeBlockNode", kinds);
                Assert.Contains("ListNode", kinds);
                var first = Assert.IsType<TextNode>(nodes[0]);
                Assert.Equal(1, first.Level);
                break;
            }
            case "technical-doc.md":
            {
                var kinds = nodes.Select(n => n.GetType().Name).ToHashSet();
                Assert.Contains("BlockquoteNode", kinds);
                Assert.Contains("CodeBlockNode", kinds);
                Assert.Contains("ListNode", kinds);
                var hasTaskItem = nodes.OfType<ListNode>()
                    .SelectMany(l => l.Children.OfType<ListItemNode>())
                    .Any(i => i.Completed.HasValue);
                Assert.True(hasTaskItem);
                break;
            }
            case "github-issue.md":
            {
                var textNodes = new System.Collections.Generic.List<TextNode>();
                void Collect(ViewNode n)
                {
                    if (n is TextNode t) textNodes.Add(t);
                    switch (n)
                    {
                        case ListNode l: foreach (var c in l.Children) Collect(c); break;
                        case ListItemNode li: foreach (var c in li.Children) Collect(c); break;
                        case BlockquoteNode b: foreach (var c in b.Children) Collect(c); break;
                        case SectionNode s: foreach (var c in s.Children) Collect(c); break;
                    }
                }
                foreach (var n in nodes) Collect(n);
                Assert.Contains(textNodes, t => t.Runs?.Any(r => r.Code) ?? false);
                Assert.Contains(textNodes, t => t.Runs?.Any(r => r.Href is not null) ?? false);
                Assert.Contains(nodes, n => n is CodeBlockNode);
                break;
            }
        }
    }
}
