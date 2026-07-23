// Markdown-converter tests. Structural assertions on the emitted ViewNode
// tree: given specific markdown input, the walker produces the specific
// node shape we contract on. Each test covers one token family so a
// regression fingerprints which walker arm broke, not just "markdown is off".
//
// The corpus tests at the bottom (`test/markdown-corpus/*.md`) additionally
// exercise realistic end-to-end fixtures — a README section, a technical
// doc, a GitHub-issue body — so a walker change that survives the unit
// suite but breaks realistic mixed content still fails.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { markdownToViewNodes } from "./markdown.js";
import type {
  ViewNode,
  TextNode,
  ListNode,
  ListItemNode,
  BlockquoteNode,
  CodeBlockNode,
  ImageNode,
} from "./index.js";

const HERE = dirname(fileURLToPath(import.meta.url));

// ── Block-level: headings ──────────────────────────────────────────────────

describe("markdownToViewNodes — headings", () => {
  it("emits TextNode.level 1..6 for #..######", () => {
    const md = "# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six";
    const nodes = markdownToViewNodes(md);
    expect(nodes).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      const n = nodes[i] as TextNode;
      expect(n.type).toBe("text");
      expect(n.level).toBe(i + 1);
    }
    expect((nodes[0] as TextNode).value).toBe("One");
    expect((nodes[5] as TextNode).value).toBe("Six");
  });

  it("emits inline runs inside a heading", () => {
    const md = "# The **bold** one";
    const [h] = markdownToViewNodes(md) as [TextNode];
    expect(h.level).toBe(1);
    expect(h.value).toBe("The bold one");
    expect(h.runs).toEqual([
      { text: "The " },
      { text: "bold", bold: true },
      { text: " one" },
    ]);
  });
});

// ── Block-level: paragraphs + inline emphasis ──────────────────────────────

describe("markdownToViewNodes — paragraphs + inline emphasis", () => {
  it("plain paragraph collapses runs and emits a bare value", () => {
    const [p] = markdownToViewNodes("Hello world.") as [TextNode];
    expect(p).toEqual({ type: "text", value: "Hello world." });
    expect(p.runs).toBeUndefined();
  });

  it("bold + italic + strikethrough + inline code compose as run flags", () => {
    const md = "A **bold** and *em* and ~~gone~~ and `inline`.";
    const [p] = markdownToViewNodes(md) as [TextNode];
    expect(p.value).toBe("A bold and em and gone and inline.");
    expect(p.runs).toEqual([
      { text: "A " },
      { text: "bold", bold: true },
      { text: " and " },
      { text: "em", italic: true },
      { text: " and " },
      { text: "gone", strike: true },
      { text: " and " },
      { text: "inline", code: true },
      { text: "." },
    ]);
  });

  it("nested emphasis unions the flags", () => {
    // "**bold with *italic* inside**" — inner runs carry BOTH bold + italic.
    const md = "**bold with *italic* inside**";
    const [p] = markdownToViewNodes(md) as [TextNode];
    expect(p.runs).toEqual([
      { text: "bold with ", bold: true },
      { text: "italic", bold: true, italic: true },
      { text: " inside", bold: true },
    ]);
  });
});

// ── Inline links ───────────────────────────────────────────────────────────

describe("markdownToViewNodes — inline links", () => {
  it("wraps a link's runs with href", () => {
    const md = "See [the docs](https://example.com) here.";
    const [p] = markdownToViewNodes(md) as [TextNode];
    expect(p.runs).toEqual([
      { text: "See " },
      { text: "the docs", href: "https://example.com" },
      { text: " here." },
    ]);
  });

  it("preserves bold inside a link (one run per formatting boundary)", () => {
    const md = "Read [Docs **Home**](https://example.com) now.";
    const [p] = markdownToViewNodes(md) as [TextNode];
    expect(p.runs).toEqual([
      { text: "Read " },
      { text: "Docs ", href: "https://example.com" },
      { text: "Home", bold: true, href: "https://example.com" },
      { text: " now." },
    ]);
  });

  it("marks all links external when opts.external is true", () => {
    const md = "See [docs](https://example.com).";
    const [p] = markdownToViewNodes(md, { external: true }) as [TextNode];
    expect(p.runs?.find((r) => r.href)).toEqual({
      text: "docs",
      href: "https://example.com",
      external: true,
    });
  });

  it("absent-vs-null: external omitted (not false) when opts.external is unset", () => {
    const md = "See [docs](https://example.com).";
    const [p] = markdownToViewNodes(md) as [TextNode];
    const linkRun = p.runs?.find((r) => r.href);
    expect(linkRun).toBeDefined();
    expect("external" in linkRun!).toBe(false);
  });
});

// ── Lists (unordered / ordered / nested / task) ────────────────────────────

describe("markdownToViewNodes — lists", () => {
  it("unordered list emits <ListNode> with no ordered flag", () => {
    const [list] = markdownToViewNodes("- one\n- two") as [ListNode];
    expect(list.type).toBe("list");
    expect(list.ordered).toBeUndefined();
    expect(list.children).toHaveLength(2);
    const item0 = list.children[0] as ListItemNode;
    expect(item0.type).toBe("list-item");
    expect((item0.children[0] as TextNode).value).toBe("one");
  });

  it("ordered list sets ordered:true", () => {
    const [list] = markdownToViewNodes("1. one\n2. two") as [ListNode];
    expect(list.ordered).toBe(true);
  });

  it("task-list items set ListItemNode.completed", () => {
    const md = "- [x] done\n- [ ] todo\n- plain";
    const [list] = markdownToViewNodes(md) as [ListNode];
    const [done, todo, plain] = list.children as ListItemNode[];
    expect(done.completed).toBe(true);
    expect(todo.completed).toBe(false);
    expect("completed" in plain).toBe(false);
  });

  it("nested lists live under a parent list-item as child <ListNode>", () => {
    const md = "- Outer\n  - Inner one\n  - Inner two";
    const [list] = markdownToViewNodes(md) as [ListNode];
    const outer = list.children[0] as ListItemNode;
    expect(outer.children).toHaveLength(2);
    expect((outer.children[0] as TextNode).value).toBe("Outer");
    const nested = outer.children[1] as ListNode;
    expect(nested.type).toBe("list");
    expect(nested.children).toHaveLength(2);
    expect(((nested.children[0] as ListItemNode).children[0] as TextNode).value)
      .toBe("Inner one");
  });

  it("list-item preserves inline formatting on its text", () => {
    const md = "- item **bold**";
    const [list] = markdownToViewNodes(md) as [ListNode];
    const item = list.children[0] as ListItemNode;
    const text = item.children[0] as TextNode;
    expect(text.runs).toEqual([
      { text: "item " },
      { text: "bold", bold: true },
    ]);
  });
});

// ── Blockquotes ────────────────────────────────────────────────────────────

describe("markdownToViewNodes — blockquotes", () => {
  it("emits a BlockquoteNode holding block-level children", () => {
    const [q] = markdownToViewNodes("> A quote line\n> continues here") as [BlockquoteNode];
    expect(q.type).toBe("blockquote");
    expect(q.children).toHaveLength(1);
    const p = q.children[0] as TextNode;
    expect(p.type).toBe("text");
    expect(p.value).toContain("A quote line");
  });

  it("preserves a nested list inside a blockquote", () => {
    const md = "> intro\n>\n> - a\n> - b";
    const [q] = markdownToViewNodes(md) as [BlockquoteNode];
    // First child is the paragraph, second is the list.
    expect(q.children[0].type).toBe("text");
    const list = q.children[1] as ListNode;
    expect(list.type).toBe("list");
    expect(list.children).toHaveLength(2);
  });
});

// ── Code blocks ────────────────────────────────────────────────────────────

describe("markdownToViewNodes — code blocks", () => {
  it("captures fenced code + language", () => {
    const md = "```python\nprint('hi')\n```";
    const [cb] = markdownToViewNodes(md) as [CodeBlockNode];
    expect(cb.type).toBe("code-block");
    expect(cb.code).toBe("print('hi')");
    expect(cb.language).toBe("python");
  });

  it("omits language when the fence has none", () => {
    const [cb] = markdownToViewNodes("```\nplain\n```") as [CodeBlockNode];
    expect(cb.language).toBeUndefined();
  });
});

// ── Images ─────────────────────────────────────────────────────────────────

describe("markdownToViewNodes — images", () => {
  it("image-only paragraph unwraps to a standalone ImageNode", () => {
    const md = "![alt text](img.png \"a caption\")";
    const [img] = markdownToViewNodes(md) as [ImageNode];
    expect(img.type).toBe("image");
    expect(img.src).toBe("img.png");
    expect(img.alt).toBe("alt text");
    expect(img.caption).toBe("a caption");
  });

  it("omits alt/caption when absent", () => {
    const [img] = markdownToViewNodes("![](img.png)") as [ImageNode];
    expect(img.type).toBe("image");
    expect(img.src).toBe("img.png");
    expect("alt" in img).toBe(false);
    expect("caption" in img).toBe(false);
  });
});

// ── Horizontal rule ────────────────────────────────────────────────────────

describe("markdownToViewNodes — horizontal rule", () => {
  it("emits DividerNode with default orientation absent", () => {
    const [d] = markdownToViewNodes("---");
    expect(d).toEqual({ type: "divider" });
  });
});

// ── Deferred (silently skipped, per doc) ───────────────────────────────────

describe("markdownToViewNodes — deferred features skip silently", () => {
  it("skips raw HTML blocks", () => {
    const md = "para\n\n<div>raw</div>\n\nmore";
    const nodes = markdownToViewNodes(md);
    // The two paragraphs survive; the html block is dropped.
    expect(nodes).toHaveLength(2);
    expect((nodes[0] as TextNode).value).toBe("para");
    expect((nodes[1] as TextNode).value).toBe("more");
  });

  it("skips markdown tables (a separate design pass for rich cells)", () => {
    const md = "para\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\nafter";
    const nodes = markdownToViewNodes(md);
    // Both paragraphs survive; the table is dropped.
    const texts = nodes.filter((n): n is TextNode => n.type === "text");
    expect(texts.map((t) => t.value)).toEqual(["para", "after"]);
  });
});

// ── Absent-vs-null wire contract (gotcha #8) ───────────────────────────────

describe("markdownToViewNodes — absent-vs-null wire discipline", () => {
  it("plain text never emits an undefined `runs` key", () => {
    const [p] = markdownToViewNodes("plain para.") as [TextNode];
    expect("runs" in p).toBe(false);
    expect("level" in p).toBe(false);
    expect("style" in p).toBe(false);
    expect("tone" in p).toBe(false);
  });

  it("unordered list never emits an undefined `ordered` key", () => {
    const [list] = markdownToViewNodes("- a") as [ListNode];
    expect("ordered" in list).toBe(false);
  });

  it("richText-built TextNode derives value from runs (safety property)", () => {
    // If we ever regressed to hand-writing `value` alongside `runs`, an
    // intentional divergence would silently ship; the derived-value rule
    // (richText helper) is what prevents that lie.
    const [p] = markdownToViewNodes("**a**b**c**") as [TextNode];
    expect(p.value).toBe(p.runs!.map((r) => r.text).join(""));
  });
});

// ── End-to-end fixtures (real-world corpus) ────────────────────────────────

describe("markdownToViewNodes — corpus fixtures", () => {
  const cases: Array<{ name: string; assertions: (nodes: ViewNode[]) => void }> = [
    {
      name: "readme.md",
      assertions: (nodes) => {
        // A README-style intro: h1 title, prose, a fenced code block, a
        // sub-heading, an unordered list, a link.
        const kinds = nodes.map((n) => n.type);
        expect(kinds).toContain("text");
        expect(kinds).toContain("code-block");
        expect(kinds).toContain("list");
        // First node is the H1 title.
        const first = nodes[0] as TextNode;
        expect(first.level).toBe(1);
      },
    },
    {
      name: "technical-doc.md",
      assertions: (nodes) => {
        // Nested lists + blockquotes + code blocks + task lists all coexist.
        const types = new Set(nodes.map((n) => n.type));
        expect(types.has("blockquote")).toBe(true);
        expect(types.has("code-block")).toBe(true);
        expect(types.has("list")).toBe(true);
        // At least one list carries task-list items.
        const lists = nodes.filter((n): n is ListNode => n.type === "list");
        const hasTaskItem = lists.some((l) =>
          l.children.some((i) => "completed" in (i as ListItemNode)),
        );
        expect(hasTaskItem).toBe(true);
      },
    },
    {
      name: "github-issue.md",
      assertions: (nodes) => {
        // GitHub-issue-style: fenced code + inline code + links inside
        // inline text (which live in list items as well as paragraphs).
        // Walk the whole tree for any TextNode carrying a run flag rather
        // than only inspecting top-level paragraphs — realistic markdown
        // buries formatted text inside lists and blockquotes.
        const textNodes: TextNode[] = [];
        const collect = (n: ViewNode): void => {
          if (n.type === "text") textNodes.push(n);
          if ("children" in n && Array.isArray(n.children)) {
            for (const c of n.children as ViewNode[]) collect(c);
          }
        };
        for (const n of nodes) collect(n);
        expect(textNodes.some((t) => t.runs?.some((r) => r.code))).toBe(true);
        expect(textNodes.some((t) => t.runs?.some((r) => r.href))).toBe(true);
        // At least one code-block at the top level.
        expect(nodes.some((n) => n.type === "code-block")).toBe(true);
      },
    },
  ];

  for (const c of cases) {
    it(`parses ${c.name} into a structurally valid tree`, () => {
      const md = readFileSync(
        join(HERE, "..", "test", "markdown-corpus", c.name),
        "utf8",
      );
      const nodes = markdownToViewNodes(md);
      expect(nodes.length).toBeGreaterThan(0);
      c.assertions(nodes);
    });
  }
});
