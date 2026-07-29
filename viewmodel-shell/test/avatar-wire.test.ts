// v8.0.0 (COMP-04) — AvatarNode wire-shape + tree-validator coverage.
//
// Static compile-time assertions pin the closed union shape (size, tone);
// runtime coverage proves the walker accepts AvatarNode as a leaf (no
// descent, no action recording). Mirrors icon-wire.test.ts line-for-line.

import { describe, it, expect } from "vitest";
import type {
  AvatarNode,
  IconName,
  ViewNode,
} from "../src/index.js";
import { validateActionNames } from "../src/server.js";

describe("AvatarNode wire shape (COMP-04)", () => {
  it("compiles with only the required type discriminator", () => {
    // Every field is optional — the bare `type: "avatar"` is a valid tree
    // node. This is the class-2-defect-protection base case: no field set,
    // no wire noise (verified on the .NET side via findNulls-style tests).
    const a: AvatarNode = { type: "avatar" };
    expect(a.type).toBe("avatar");
  });

  it("compiles with all six optional fields set", () => {
    const a: AvatarNode = {
      type: "avatar",
      initials: "AL",
      image: "https://example.com/ada.png",
      icon: "user",
      size: "xl",
      tone: "success",
      alt: "Ada Lovelace",
    };
    expect(a.initials).toBe("AL");
    expect(a.image).toBe("https://example.com/ada.png");
    expect(a.icon).toBe("user");
    expect(a.size).toBe("xl");
    expect(a.tone).toBe("success");
    expect(a.alt).toBe("Ada Lovelace");
  });

  it("AvatarSize accepts sm/md/lg/xl (spot-check the 4 members)", () => {
    // TypeScript strictness provides the negative-case coverage at compile
    // time — `size: "foo"` would fail `tsc`. Runtime spot-check confirms
    // each of the 4 valid values compiles cleanly.
    const sm: AvatarNode = { type: "avatar", size: "sm" };
    const md: AvatarNode = { type: "avatar", size: "md" };
    const lg: AvatarNode = { type: "avatar", size: "lg" };
    const xl: AvatarNode = { type: "avatar", size: "xl" };
    expect([sm.size, md.size, lg.size, xl.size]).toEqual(["sm", "md", "lg", "xl"]);
  });

  it("tone accepts danger/warning/success/info (framework-wide closed union)", () => {
    const t1: AvatarNode = { type: "avatar", initials: "AL", tone: "danger" };
    const t2: AvatarNode = { type: "avatar", initials: "AL", tone: "warning" };
    const t3: AvatarNode = { type: "avatar", initials: "AL", tone: "success" };
    const t4: AvatarNode = { type: "avatar", initials: "AL", tone: "info" };
    expect([t1.tone, t2.tone, t3.tone, t4.tone]).toEqual([
      "danger", "warning", "success", "info",
    ]);
  });

  it("icon field accepts an IconName (reuses the v7.0.0 curated Lucide subset)", () => {
    // Any of the ~102 IconName members is legal — the same closed union that
    // ButtonNode.icon / SectionNode.icon / etc. consume. Spot-check a few
    // that Phase 25 UserRowNode / MessageNode will realistically use.
    const names: IconName[] = ["user", "user-plus", "user-check", "bell"];
    for (const name of names) {
      const a: AvatarNode = { type: "avatar", icon: name };
      expect(a.icon).toBe(name);
    }
  });

  it("adds AvatarNode to the ViewNode discriminated union", () => {
    // Compile-time proof: assigning AvatarNode to a ViewNode-typed slot
    // compiles. If the `| AvatarNode` was reverted from the union at
    // src/index.ts, this test would fail `tsc`.
    const asView: ViewNode = { type: "avatar", initials: "AL" };
    expect(asView.type).toBe("avatar");
  });
});

describe("AvatarNode tree-walker (COMP-04) — leaf, no descent", () => {
  it("validateActionNames accepts a page containing an AvatarNode child", () => {
    // AvatarNode is a leaf: no children, no action. The walker MUST have a
    // no-op arm for `case "avatar":` — without it, the default-arm would
    // throw / warn, or an exhaustiveness-check refactor would break here.
    //
    // Mutation test: revert the `case "avatar":` arm in server.ts. This
    // test still passes today because validateActionNames does not throw on
    // unknown types — but the exhaustiveness comment guards the LOAD-BEARING
    // invariant (a future refactor that promotes the switch to an
    // `assertNever`-style default WILL fail at the type level).
    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "avatar", initials: "AL", tone: "success", alt: "Ada Lovelace" },
        { type: "avatar", image: "https://example.com/x.png", alt: "Photo" },
        { type: "avatar", icon: "user", size: "lg" },
        { type: "avatar" }, // bare — every optional absent
      ],
    };
    expect(() => validateActionNames(tree)).not.toThrow();
  });

  it("action-name uniqueness is unaffected by AvatarNodes in the tree", () => {
    // A tree with duplicate action names WITH an avatar sibling still throws
    // for the right reason — the avatar walker arm doesn't accidentally
    // suppress action collection somewhere else.
    const tree: ViewNode = {
      type: "page",
      children: [
        { type: "avatar", initials: "AL" },
        { type: "button", label: "A", action: { name: "dup" } },
        { type: "button", label: "B", action: { name: "dup" } },
      ],
    };
    expect(() => validateActionNames(tree)).toThrow(/dup/);
  });
});
