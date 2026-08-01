// D-Q4 sanitization audit adversarial + baseline tests for the shipped
// markdown → InlineRun.href whitelist sanitizer added in Plan 28-06.
//
// Structure mirrors the .NET twin
// (viewmodel-shell-dotnet/Markdown/Tests/MarkdownSanitizationTests.cs):
// 4 disallowed schemes (javascript, data, vbscript, file) × two syntaxes
// (regular link, autolink), 4 allowed schemes/paths (https, /relative,
// mailto, tel), plus a hook-composition test verifying the sanitizer
// runs BEFORE the consumer's opt-in linkHrefRewrite hook (so a consumer
// hook is guaranteed never to see a raw dangerous scheme).
//
// If the audit had found the pipeline CLEAN, the "blocks X" tests would
// STILL be here as regression coverage — the shipped default's contract
// is "any scheme not in the whitelist is rejected", and that contract
// must be provably enforced by tests, not documented and forgotten.
import { describe, it, expect } from "vitest";
import { markdownToViewNodes } from "../src/markdown.js";
import type { ViewNode, TextNode, InlineRun } from "../src/index.js";

/** Walk the emitted tree, return the first InlineRun that carries an
 *  href (regardless of value). Undefined if none found — which is the
 *  expected outcome for a fully-sanitized dangerous scheme, since the
 *  builder collapses "plain" (no formatting, no href) runs into a
 *  bare TextNode.value with no runs[] at all (gotcha #8: absent). */
function firstLinkRun(nodes: ViewNode[]): InlineRun | undefined {
  for (const n of nodes) {
    if (n.type === "text") {
      const t = n as TextNode;
      if (t.runs) {
        for (const r of t.runs) if (r.href !== undefined) return r;
      }
    }
    // BlockquoteNode etc. — recurse via `children` for safety, though
    // the fixtures below are all single-paragraph.
    const children = (n as { children?: ViewNode[] }).children;
    if (Array.isArray(children)) {
      const r = firstLinkRun(children);
      if (r) return r;
    }
  }
  return undefined;
}

/** Same but returns just the href (or undefined). */
function firstHref(nodes: ViewNode[]): string | undefined {
  return firstLinkRun(nodes)?.href;
}

/** The safety contract in a sentence: "the emitted tree contains no
 *  InlineRun.href that STARTS WITH a dangerous scheme". Whether the
 *  sanitizer emits `""` (which then collapses the run and drops the
 *  href entirely per gotcha #8) OR emits an explicit empty string,
 *  the property that matters — no dangerous scheme reaches the DOM —
 *  is the same. This helper encodes that property. */
function expectHrefIsSafe(nodes: ViewNode[]): void {
  const run = firstLinkRun(nodes);
  if (run === undefined) return; // No href at all → safe (dropped).
  expect(run.href).toBe(""); // If a run remains, its href must be "".
  // Extra defense: the string, if present, is not a dangerous scheme.
  const raw = run.href ?? "";
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.\-]*):/.exec(raw.trim());
  if (scheme) {
    expect(["http", "https", "mailto", "tel", "ftp"]).toContain(
      scheme[1].toLowerCase(),
    );
  }
}

describe("markdown link scheme sanitization (D-Q4)", () => {
  // ── Disallowed schemes: emit empty href regardless of consumer config ──

  it("blocks javascript: on regular link", () => {
    expectHrefIsSafe(markdownToViewNodes("[click](javascript:alert(1))"));
  });

  it("blocks javascript: on autolink <javascript:...>", () => {
    // Autolinks flow through a slightly different converter branch — the
    // sanitizer must catch them too; a fix that missed autolinks would
    // leave the same XSS gap open under a different syntax.
    expectHrefIsSafe(markdownToViewNodes("<javascript:alert(1)>"));
  });

  it("blocks data: (used for stored-XSS via inline HTML data URIs)", () => {
    expectHrefIsSafe(
      markdownToViewNodes("[click](data:text/html,<script>alert(1)</script>)"),
    );
  });

  it("blocks vbscript: (legacy IE XSS vector)", () => {
    expectHrefIsSafe(markdownToViewNodes("[click](vbscript:msgbox)"));
  });

  it("blocks file: (local filesystem exfiltration attack)", () => {
    expectHrefIsSafe(markdownToViewNodes("[click](file:///etc/passwd)"));
  });

  it("blocks unknown schemes by default (whitelist over blocklist)", () => {
    // The point of whitelisting: a scheme this framework has never
    // heard of is refused, not passed through. Future-proofs against
    // new attack vectors we haven't catalogued.
    expectHrefIsSafe(markdownToViewNodes("[click](wyciwyg:evil)"));
  });

  it("case-insensitive: JAVASCRIPT: is still blocked", () => {
    // A common bypass technique is scheme-case mixing (some parsers
    // treat schemes case-sensitively). Our regex lowercases before
    // whitelist lookup.
    expectHrefIsSafe(markdownToViewNodes("[click](JAVASCRIPT:alert(1))"));
  });

  it("leading-whitespace bypass is blocked (raw is trimmed)", () => {
    // Another parser-vs-sanitizer mismatch: a browser resolves
    // "  javascript:..." as javascript: after stripping leading
    // whitespace. We .trim() before scheme extraction so the
    // whitelist sees the same normalized form the browser would.
    expectHrefIsSafe(markdownToViewNodes("[click](  javascript:alert(1))"));
  });

  // ── Allowed schemes + relative: preserved untouched ────────────────────

  it("preserves https:// (baseline positive — sanitizer isn't over-eager)", () => {
    const href = firstHref(markdownToViewNodes("[click](https://example.com/safe)"));
    expect(href).toBe("https://example.com/safe");
  });

  it("preserves http:// (allowed alongside https)", () => {
    const href = firstHref(markdownToViewNodes("[click](http://example.com/plain)"));
    expect(href).toBe("http://example.com/plain");
  });

  it("preserves relative /path (no-scheme URLs are always allowed)", () => {
    const href = firstHref(markdownToViewNodes("[click](/relative-safe)"));
    expect(href).toBe("/relative-safe");
  });

  it("preserves fragment #anchor", () => {
    const href = firstHref(markdownToViewNodes("[click](#section-2)"));
    expect(href).toBe("#section-2");
  });

  it("preserves mailto:", () => {
    const href = firstHref(markdownToViewNodes("[click](mailto:foo@bar.com)"));
    expect(href).toBe("mailto:foo@bar.com");
  });

  it("preserves tel:", () => {
    const href = firstHref(markdownToViewNodes("[click](tel:+15551234)"));
    expect(href).toBe("tel:+15551234");
  });

  it("preserves ftp:", () => {
    const href = firstHref(markdownToViewNodes("[click](ftp://files.example.com/x)"));
    expect(href).toBe("ftp://files.example.com/x");
  });

  it("preserves https autolink <https://...>", () => {
    // The autolink branch must ALSO pass the allowed-scheme case
    // through untouched — a fix that only handles the block case
    // could accidentally strip legitimate autolinks.
    const href = firstHref(markdownToViewNodes("<https://example.com/foo>"));
    expect(href).toBe("https://example.com/foo");
  });

  // ── Hook composition: sanitizer runs BEFORE linkHrefRewrite ────────────

  it("linkHrefRewrite hook fires on the SANITIZED href (not the raw scheme)", () => {
    // Contract: the consumer hook sees an already-sanitized href.
    // For disallowed schemes the hook input is "", so a consumer hook
    // that naively passes its input through cannot accidentally re-
    // introduce the dangerous scheme.
    const seen: string[] = [];
    const nodes = markdownToViewNodes("[click](javascript:alert(1))", {
      linkHrefRewrite: (h) => {
        seen.push(h);
        return h;
      },
    });
    expect(seen).toEqual([""]); // sanitizer stripped BEFORE hook saw it
    expectHrefIsSafe(nodes);
  });

  it("linkHrefRewrite hook can still transform allowed schemes normally", () => {
    // Regression guard: the sanitizer must not break the existing
    // hook use-case (relative wiki links → app-routed URLs).
    const href = firstHref(
      markdownToViewNodes("[click](/wiki/page)", {
        linkHrefRewrite: (h) => `https://app.example${h}`,
      }),
    );
    expect(href).toBe("https://app.example/wiki/page");
  });

  it("autolink with disallowed scheme keeps the raw label as visible text (dead href, honest failure)", () => {
    // Contract: even though href is sanitized to "" (which collapses
    // the run's href entirely), the visible text shows what the user
    // wrote rather than a silent empty span. Honest failure > silent
    // swallow. The text ends up in TextNode.value (the sanitized run
    // has no href, no formatting → plain-collapse to bare value).
    const nodes = markdownToViewNodes("<javascript:alert(1)>");
    // No dangerous href in the tree.
    expectHrefIsSafe(nodes);
    // The label is preserved (either as TextNode.value on plain-collapse,
    // or as run.text if the run survived).
    const t = nodes[0] as TextNode;
    const visible = t.value ?? (t.runs?.map((r) => r.text).join("") ?? "");
    expect(visible).toBe("javascript:alert(1)");
  });
});
