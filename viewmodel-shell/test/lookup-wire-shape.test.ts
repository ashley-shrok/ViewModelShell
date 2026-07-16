// Phase 21 (LOOK-01/LOOK-04/LOOK-06) — the lookup wire surface on FieldNode.
//
// This suite is TYPE-LEVEL first and runtime-level second. The wire shape is the
// contract every other Phase 21 plan builds against, and most of what can go
// wrong here is a type mistake, not a runtime one:
//   - `selected`/`candidates` accidentally typed `T | T[]` (drifts across backends);
//   - `label`/`type` accidentally required (breaks D5/D6's omit-when-redundant rule);
//   - `searchAction` accidentally typed as a bare string rather than an ActionEvent.
//
// ⚠️ The repo's `npx tsc --noEmit` covers `src/**` only — tsconfig.json's `include`
// is `src/**/*.ts` and it explicitly EXCLUDES `**/*.test.ts`, and vitest transpiles
// without type-checking. So the `@ts-expect-error` assertions below are NOT gated by
// either standard command. They are checked by an explicit tsc pass over this file:
//
//   npx tsc --noEmit --strict --target ES2022 --module NodeNext \
//     --moduleResolution NodeNext --lib ES2022,DOM test/lookup-wire-shape.test.ts
//
// That is deliberate rather than incidental: a `@ts-expect-error` that is never
// type-checked is worse than no assertion at all, because it LOOKS like a guard.

import { describe, it, expect } from "vitest";
import type { FieldNode, LookupItem, ViewNode } from "../src/index.js";

describe("FieldNode — lookup wire shape (Phase 21, LOOK-01)", () => {
  it("a single lookup with a bind type-checks and carries the inputType token", () => {
    const node: FieldNode = {
      type: "field",
      name: "owner",
      inputType: "lookup",
      bind: "fields.ownerId",
    };
    expect(node.inputType).toBe("lookup");
  });

  it("a lookup-multiple with a bind type-checks and carries the inputType token", () => {
    const node: FieldNode = {
      type: "field",
      name: "tags",
      inputType: "lookup-multiple",
      bind: "fields.tagIds",
    };
    expect(node.inputType).toBe("lookup-multiple");
  });

  it("LookupItem's label and type are BOTH optional (D5 / D6)", () => {
    // D5 — label omitted because it equals the value (the free-form-tag case).
    const bare: LookupItem = { value: "urgent" };
    // D6 — the polymorphic-reference tag, present.
    const tagged: LookupItem = { value: "00Q5f", label: "Sally Omer", type: "user" };
    expect(bare.label).toBeUndefined();
    expect(bare.type).toBeUndefined();
    expect(tagged.type).toBe("user");
  });

  it("selected is ALWAYS an array — including single lookup, where it holds 0 or 1 entries", () => {
    const node: FieldNode = {
      type: "field",
      name: "owner",
      inputType: "lookup",
      bind: "fields.ownerId",
      // The headline proof (success criterion 1): a form loads with a reference
      // already set and renders its label, because the label came from the NODE
      // and not from an (empty) candidate list. No search has occurred.
      selected: [{ value: "00Q5f", label: "Sally Omer" }],
    };
    expect(Array.isArray(node.selected)).toBe(true);
    expect(node.selected).toHaveLength(1);
  });

  it("a bare LookupItem (non-array) is a TYPE ERROR even on single-select lookup", () => {
    const node: FieldNode = {
      type: "field",
      name: "owner",
      inputType: "lookup",
      bind: "fields.ownerId",
      // @ts-expect-error — `selected` is deliberately NOT `LookupItem | LookupItem[]`.
      // A `T | T[]` union drifts across backends (the banked parity-type-safety
      // lesson); single-select holds a 0-or-1-length array instead.
      selected: { value: "00Q5f", label: "Sally Omer" },
    };
    expect(node.name).toBe("owner");
  });

  it("candidates is a separate always-array field from selected (D1 — never fused)", () => {
    const node: FieldNode = {
      type: "field",
      name: "owner",
      inputType: "lookup",
      bind: "fields.ownerId",
      selected: [{ value: "00Q5f", label: "Sally Omer" }],
      candidates: [
        { value: "00Q7a", label: "Sally Ann" },
        { value: "00Q9b", label: "Sal Ortega" },
      ],
    };
    // The selected label is NOT resolvable from candidates — the selected id is
    // deliberately absent from the candidate list here, which is the exact cold
    // -start/filtered state that breaks naive pickers. `selected` still carries it.
    expect(node.candidates?.map((c) => c.value)).not.toContain("00Q5f");
    expect(node.selected?.[0].label).toBe("Sally Omer");
  });

  it("searchBind / searchAction / allowCustom type-check with their declared types", () => {
    const node: FieldNode = {
      type: "field",
      name: "owner",
      inputType: "lookup",
      bind: "fields.ownerId",
      searchBind: "fields.ownerQuery",
      searchAction: { name: "lookup-owner-search" },
      allowCustom: true,
    };
    expect(node.searchBind).toBe("fields.ownerQuery");
    expect(node.searchAction?.name).toBe("lookup-owner-search");
    expect(node.allowCustom).toBe(true);
  });

  it("a field carrying BOTH action and searchAction type-checks (they are independent)", () => {
    const node: FieldNode = {
      type: "field",
      name: "owner",
      inputType: "lookup",
      bind: "fields.ownerId",
      action: { name: "owner-commit" },
      searchBind: "fields.ownerQuery",
      searchAction: { name: "owner-search" },
    };
    expect(node.action?.name).toBe("owner-commit");
    expect(node.searchAction?.name).toBe("owner-search");
  });

  it("a free-form tags input falls out with no special case (D3): allowCustom + no candidates + labels omitted", () => {
    const node: FieldNode = {
      type: "field",
      name: "tags",
      inputType: "lookup-multiple",
      bind: "fields.tagIds",
      allowCustom: true,
      // D5: every label omitted, because each equals its value.
      selected: [{ value: "urgent" }, { value: "billing" }],
    };
    expect(node.candidates).toBeUndefined();
    expect(node.selected?.every((s) => s.label === undefined)).toBe(true);
  });

  it("a lookup FieldNode is assignable to ViewNode (it is in the union, not a parallel node)", () => {
    const node: ViewNode = {
      type: "field",
      name: "owner",
      inputType: "lookup",
      bind: "fields.ownerId",
    };
    expect(node.type).toBe("field");
  });
});
