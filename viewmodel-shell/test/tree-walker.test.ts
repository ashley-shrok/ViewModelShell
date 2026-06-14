// 260614-bmd — validateSectionAction extended for SectionNode.link rules (issue #21).
//
// Companion test file to section-action.test.ts (which carries the 1.4.0
// action+collapsible / nested-action cases at the renderer + validator boundary).
// This file pins the four NEW rejections added in 1.5.0:
//   - link + action on the same section
//   - link + collapsible:true on the same section
//   - link-in-link nesting (HTML5 <a>-in-<a> prohibition)
//   - link-in-action AND action-in-link (mixed click-ownership)
// Plus regression coverage for the existing 1.4.0 rules (so the
// outerClickable → outerInteractive rename doesn't silently break them) and
// the styling-only-inner-card positive baselines.

import { describe, it, expect } from "vitest";
import type { ViewNode } from "../src/index.js";
import { validateSectionAction } from "../src/server.js";

function page(...children: ViewNode[]): ViewNode {
  return { type: "page", children };
}

describe("validateSectionAction — SectionNode.link rules (260614-bmd / issue #21)", () => {
  it("plain linked card (no nesting, no collapsible) passes", () => {
    const tree = page({
      type: "section",
      heading: "Read the docs",
      variant: "card",
      link: { url: "https://example.com/docs", external: true },
      children: [{ type: "text", value: "Architecture, gotchas, demos." }],
    });
    expect(() => validateSectionAction(tree)).not.toThrow();
  });

  it("link + action on the same section throws (pick one)", () => {
    const tree = page({
      type: "section",
      heading: "Conflict",
      link: { url: "https://example.com" },
      action: { name: "dispatch-conflict" },
      children: [],
    });
    expect(() => validateSectionAction(tree)).toThrow(
      /either a dispatcher \(action\) or a navigator \(link\)/i,
    );
    expect(() => validateSectionAction(tree)).toThrow(/Conflict/);
  });

  it("link + collapsible:true on the same section throws", () => {
    const tree = page({
      type: "section",
      heading: "BadCollapsible",
      link: { url: "https://example.com" },
      collapsible: true,
      children: [],
    });
    expect(() => validateSectionAction(tree)).toThrow(/Link and Collapsible: true/i);
    expect(() => validateSectionAction(tree)).toThrow(/BadCollapsible/);
  });

  it("link nested inside another link throws (HTML5 <a>-in-<a>)", () => {
    const tree = page({
      type: "section",
      heading: "OuterLink",
      link: { url: "https://example.com/outer" },
      children: [
        {
          type: "section",
          heading: "InnerLink",
          link: { url: "https://example.com/inner" },
          children: [],
        },
      ],
    });
    expect(() => validateSectionAction(tree)).toThrow(/HTML5 prohibits nested/);
    expect(() => validateSectionAction(tree)).toThrow(/OuterLink/);
    expect(() => validateSectionAction(tree)).toThrow(/InnerLink/);
  });

  it("link nested inside action throws (click-ownership ambiguous)", () => {
    const tree = page({
      type: "section",
      heading: "OuterAction",
      action: { name: "outer-action" },
      children: [
        {
          type: "section",
          heading: "InnerLink",
          link: { url: "https://example.com/inner" },
          children: [],
        },
      ],
    });
    expect(() => validateSectionAction(tree)).toThrow(/Click-ownership/i);
    expect(() => validateSectionAction(tree)).toThrow(/OuterAction/);
    expect(() => validateSectionAction(tree)).toThrow(/InnerLink/);
  });

  it("action nested inside link throws (click-ownership ambiguous)", () => {
    const tree = page({
      type: "section",
      heading: "OuterLink",
      link: { url: "https://example.com/outer" },
      children: [
        {
          type: "section",
          heading: "InnerAction",
          action: { name: "inner-action" },
          children: [],
        },
      ],
    });
    expect(() => validateSectionAction(tree)).toThrow(/Click-ownership/i);
    expect(() => validateSectionAction(tree)).toThrow(/OuterLink/);
    expect(() => validateSectionAction(tree)).toThrow(/InnerAction/);
  });

  it("styling-only inner card (no link, no action) inside a linked card passes", () => {
    const tree = page({
      type: "section",
      heading: "OuterLinked",
      link: { url: "https://example.com" },
      children: [
        {
          type: "section",
          variant: "card",
          children: [
            { type: "button", label: "Close", action: { name: "close-outer" } },
          ],
        },
      ],
    });
    expect(() => validateSectionAction(tree)).not.toThrow();
  });

  it("styling-only inner card inside an action card still passes (regression for outerClickable → outerInteractive rename)", () => {
    const tree = page({
      type: "section",
      heading: "OuterClickable",
      action: { name: "select-outer" },
      children: [
        {
          type: "section",
          variant: "card",
          children: [
            { type: "button", label: "Close", action: { name: "close-outer" } },
          ],
        },
      ],
    });
    expect(() => validateSectionAction(tree)).not.toThrow();
  });
});
