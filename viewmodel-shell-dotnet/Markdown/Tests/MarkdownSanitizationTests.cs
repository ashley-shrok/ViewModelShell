// D-Q4 sanitization audit adversarial + baseline tests for the shipped
// markdown -> InlineRun.Href whitelist sanitizer added in Plan 28-06.
//
// Byte-parallel with the TS twin
// (viewmodel-shell/test/markdown-sanitization.test.ts). Same input, same
// safety contract: no InlineRun.Href in the emitted tree may carry a
// scheme outside the framework's whitelist (http, https, mailto, tel,
// ftp; relative allowed). A dangerous scheme is either absent from the
// tree (collapsed to a bare TextNode.Value on the plain-collapse path)
// or emitted as an explicit empty string — both wire forms are safe,
// and ExpectHrefIsSafe encodes the property that spans them.
//
// If the audit had found the pipeline CLEAN, the "Blocks X" tests would
// STILL be here as regression coverage — the shipped default's contract
// is "any scheme not in the whitelist is rejected", and that contract
// must be provably enforced by tests, not documented and forgotten.

using System.Linq;

namespace ViewModelShell.Markdown.Tests;

public class MarkdownSanitizationTests
{
    // ── Helpers ──────────────────────────────────────────────────────────

    private static InlineRun? FirstLinkRun(IReadOnlyList<ViewNode> nodes)
    {
        foreach (var n in nodes)
        {
            if (n is TextNode t && t.Runs is not null)
            {
                foreach (var r in t.Runs)
                {
                    if (r.Href is not null) return r;
                }
            }
        }
        return null;
    }

    private static string? FirstHref(IReadOnlyList<ViewNode> nodes)
        => FirstLinkRun(nodes)?.Href;

    /// <summary>
    /// The safety contract in a sentence: "the emitted tree contains no
    /// InlineRun.Href that names a scheme outside the whitelist". Whether
    /// the sanitizer causes the whole run to disappear (plain-collapse
    /// path, matching gotcha #8's "absent" wire posture) OR the run
    /// survives with an explicit empty Href, the property that matters —
    /// no dangerous scheme reaches downstream consumers — is the same.
    /// </summary>
    private static readonly string[] AllowedSchemes = new[] { "http", "https", "mailto", "tel", "ftp" };
    private static readonly System.Text.RegularExpressions.Regex SchemeRegex =
        new(@"^([a-zA-Z][a-zA-Z0-9+.\-]*):");
    private static void ExpectHrefIsSafe(IReadOnlyList<ViewNode> nodes)
    {
        var run = FirstLinkRun(nodes);
        if (run is null) return; // no href at all → safe (dropped).
        Assert.Equal("", run.Href);
        var raw = (run.Href ?? "").Trim();
        var m = SchemeRegex.Match(raw);
        if (m.Success)
        {
            Assert.Contains(m.Groups[1].Value.ToLowerInvariant(), AllowedSchemes);
        }
    }

    // ── Disallowed schemes: emit safe href regardless of consumer config ──

    [Fact]
    public void Blocks_Javascript_On_Regular_Link()
        => ExpectHrefIsSafe(MarkdownConverter.ToViewNodes("[click](javascript:alert(1))"));

    [Fact]
    public void Blocks_Javascript_On_Autolink()
    {
        // Autolinks flow through a slightly different converter branch —
        // the sanitizer must catch them too; a fix that missed autolinks
        // would leave the same XSS gap open under a different syntax.
        ExpectHrefIsSafe(MarkdownConverter.ToViewNodes("<javascript:alert(1)>"));
    }

    [Fact]
    public void Blocks_Data_Scheme()
        => ExpectHrefIsSafe(MarkdownConverter.ToViewNodes("[click](data:text/html,<script>alert(1)</script>)"));

    [Fact]
    public void Blocks_Vbscript()
        => ExpectHrefIsSafe(MarkdownConverter.ToViewNodes("[click](vbscript:msgbox)"));

    [Fact]
    public void Blocks_File_Scheme()
        => ExpectHrefIsSafe(MarkdownConverter.ToViewNodes("[click](file:///etc/passwd)"));

    [Fact]
    public void Blocks_Unknown_Schemes_By_Default()
    {
        // Whitelist over blocklist: a scheme this framework has never
        // heard of is refused, not passed through. Future-proofs against
        // new attack vectors we haven't catalogued.
        ExpectHrefIsSafe(MarkdownConverter.ToViewNodes("[click](wyciwyg:evil)"));
    }

    [Fact]
    public void Case_Insensitive_JAVASCRIPT_Is_Blocked()
    {
        // Scheme-case mixing is a common bypass technique.
        ExpectHrefIsSafe(MarkdownConverter.ToViewNodes("[click](JAVASCRIPT:alert(1))"));
    }

    [Fact]
    public void Leading_Whitespace_Bypass_Is_Blocked()
    {
        // Browsers strip leading whitespace before scheme resolution;
        // our sanitizer .Trim()s first so the whitelist sees the same
        // normalized form.
        ExpectHrefIsSafe(MarkdownConverter.ToViewNodes("[click](  javascript:alert(1))"));
    }

    // ── Allowed schemes + relative: preserved untouched ──────────────────

    [Fact]
    public void Preserves_Https()
    {
        // Baseline positive: the sanitizer isn't over-eager.
        var href = FirstHref(MarkdownConverter.ToViewNodes("[click](https://example.com/safe)"));
        Assert.Equal("https://example.com/safe", href);
    }

    [Fact]
    public void Preserves_Http()
    {
        var href = FirstHref(MarkdownConverter.ToViewNodes("[click](http://example.com/plain)"));
        Assert.Equal("http://example.com/plain", href);
    }

    [Fact]
    public void Preserves_Relative_Path()
    {
        var href = FirstHref(MarkdownConverter.ToViewNodes("[click](/relative-safe)"));
        Assert.Equal("/relative-safe", href);
    }

    [Fact]
    public void Preserves_Fragment()
    {
        var href = FirstHref(MarkdownConverter.ToViewNodes("[click](#section-2)"));
        Assert.Equal("#section-2", href);
    }

    [Fact]
    public void Preserves_Mailto()
    {
        var href = FirstHref(MarkdownConverter.ToViewNodes("[click](mailto:foo@bar.com)"));
        Assert.Equal("mailto:foo@bar.com", href);
    }

    [Fact]
    public void Preserves_Tel()
    {
        var href = FirstHref(MarkdownConverter.ToViewNodes("[click](tel:+15551234)"));
        Assert.Equal("tel:+15551234", href);
    }

    [Fact]
    public void Preserves_Ftp()
    {
        var href = FirstHref(MarkdownConverter.ToViewNodes("[click](ftp://files.example.com/x)"));
        Assert.Equal("ftp://files.example.com/x", href);
    }

    [Fact]
    public void Preserves_Https_Autolink()
    {
        // The autolink branch must ALSO pass the allowed-scheme case
        // through untouched — a fix that only handles the block case
        // could accidentally strip legitimate autolinks.
        var href = FirstHref(MarkdownConverter.ToViewNodes("<https://example.com/foo>"));
        Assert.Equal("https://example.com/foo", href);
    }

    // ── Hook composition: sanitizer runs BEFORE LinkHrefRewrite ──────────

    [Fact]
    public void LinkHrefRewrite_Sees_Sanitized_Href_Not_Raw_Scheme()
    {
        // Contract: the consumer hook sees an already-sanitized href.
        // For disallowed schemes the hook input is "" — so a consumer
        // hook that naively passes its input through cannot accidentally
        // re-introduce the dangerous scheme.
        var seen = new List<string>();
        var nodes = MarkdownConverter.ToViewNodes(
            "[click](javascript:alert(1))",
            new MarkdownOptions
            {
                LinkHrefRewrite = h => { seen.Add(h); return h; },
            });
        Assert.Single(seen);
        Assert.Equal("", seen[0]); // stripped BEFORE hook saw it.
        ExpectHrefIsSafe(nodes);
    }

    [Fact]
    public void LinkHrefRewrite_Still_Transforms_Allowed_Schemes_Normally()
    {
        // Regression guard: the sanitizer must not break the existing
        // hook use-case (relative wiki links → app-routed URLs).
        var href = FirstHref(MarkdownConverter.ToViewNodes(
            "[click](/wiki/page)",
            new MarkdownOptions
            {
                LinkHrefRewrite = h => $"https://app.example{h}",
            }));
        Assert.Equal("https://app.example/wiki/page", href);
    }

    [Fact]
    public void Autolink_With_Disallowed_Scheme_Keeps_Raw_Label_As_Text()
    {
        // Contract: even though Href is sanitized to "" (which collapses
        // the run's Href entirely under the plain-collapse path), the
        // visible text shows what the user wrote rather than a silent
        // empty span. Honest failure > silent swallow. The label ends
        // up in TextNode.Value on collapse.
        var nodes = MarkdownConverter.ToViewNodes("<javascript:alert(1)>");
        // No dangerous href in the tree.
        ExpectHrefIsSafe(nodes);
        // The label is preserved — either as TextNode.Value on collapse
        // or as a surviving run's Text.
        var t = Assert.IsType<TextNode>(nodes.Single());
        var visible = t.Value ?? (t.Runs is not null
            ? string.Concat(t.Runs.Select(r => r.Text))
            : "");
        Assert.Equal("javascript:alert(1)", visible);
    }
}
