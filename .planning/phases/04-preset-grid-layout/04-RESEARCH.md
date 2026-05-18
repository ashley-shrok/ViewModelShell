# Phase 4: Preset-Grid Layout - Research

**Researched:** 2026-05-17
**Domain:** CSS intrinsic responsive layout (zero media queries), additive wire-field plumbing, cross-backend parity
**Confidence:** HIGH

## Summary

Phase 4 adds one optional closed-union field `layout?: "stack" | "split" | "cards"` to the existing `PageNode` and `SectionNode` and renders it as a BEM modifier class consumed by pure CSS. The wire/model/renderer plumbing is mechanically identical to the Phase 3 `density?`/`variant?` work that shipped two days ago — same five files, same idiom, same parity discipline. That part is low-risk and well-precedented.

The only genuinely open problem is the CSS mechanism for the `split` preset: "exactly 2 equal-width columns, then intrinsically collapse to 1, with zero media queries." This research resolves it. **Recommended technique: a 2-column CSS Grid with `grid-template-columns: repeat(2, 1fr)` overridden to a single column below a width threshold using the `repeat(auto-fit, minmax(min(<threshold>, 100%), 1fr))` idiom *capped to 2 tracks*** — concretely via Grid where the column-count is driven by available width and clamped. Both candidate (a) flexbox-wrap and candidate (b) capped auto-fit Grid achieve the contract; **(b) capped Grid is recommended** because it preserves equal-width columns trivially (`1fr`), inherits the `gap` token directly, and the heading-exclusion problem has a clean Grid-only solution (`grid-column: 1 / -1`). Container queries (candidate c) are **not recommended** — they don't beat capped Grid for this contract and would break the framework's "clamp/intrinsic only" precedent for no benefit.

One subtlety the planner MUST handle (not a locked decision, a correctness fact discovered in the renderer): `.vms-page__title` (h1) and `.vms-section__heading` (h2) are rendered as **direct children** of `.vms-page`/`.vms-section`, appended *before* the content children. Under `split`/`cards` they would become grid/flex items unless excluded. The recommended fix is **CSS-only** (`grid-column: 1 / -1` on the heading under the modifier), preserving LAYOUT-01 DOM byte-identity.

**Primary recommendation:** Capped 2-column Grid for `split`, `repeat(auto-fit, minmax(var(--vms-card-min), 1fr))` for `cards`, `--vms-card-min: 16rem`, heading kept full-width via `grid-column: 1 / -1`, plumbing copied verbatim from the Phase 3 density precedent, and the `"stack"` non-null-string serialization caveat handled explicitly in the parity fixture design.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Single additive optional **closed-union** field `layout?: "stack" | "split" | "cards"`, the **same union on both** `PageNode` and `SectionNode` (CSS differs only by selector). The **only** layout field on the wire — no spans/tracks/named areas (LAYOUT-04).
- **D-02:** Byte-identical default (LAYOUT-01): *omitted* AND explicit `"stack"` both emit **zero modifier class** → wire + DOM byte-identical to today. Only `"split"`/`"cards"` emit `.vms-page--split` / `.vms-page--cards` / `.vms-section--split` / `.vms-section--cards`. Class emission, not data-attributes, following the `${n.x === "y" ? " vms-z--y" : ""}` idiom.
- **D-03:** Add the field to `viewmodel-shell/src/index.ts` `PageNode` (lines 59–65) and `SectionNode` (lines 67–73). Auto-flows to `src/server.ts` via existing `export * from "./index.js"` (line 13) — **no separate `server.ts` edit**. `.NET ViewModels.cs` `PageNode` (lines 99–103) / `SectionNode` (lines 105–109) gain `string? Layout = null`.
- **D-04:** Cards min-item-width is a **fixed CSS constant, NOT a wire param**. CSS: `grid-template-columns: repeat(auto-fit, minmax(var(--vms-card-min), 1fr))`. Zero media queries.
- **D-05:** Min-width exposed as additive overridable `--vms-card-min` `:root` variable (host/theme-retunable; agent never touches it). Override-seam discipline: additive only, never edit existing `:root` names/values.
- **D-06:** `split` = exactly **2 equal-width columns**, collapsing intrinsically to **1 column** when too narrow (no app breakpoints). >2 children wrap into a 2-column flow (4 children → 2×2). Equal columns, NOT content-natural.
- **D-07:** **Zero media queries** (locked). Behavior contract locked; only the zero-media-query technique is bounded researcher/Claude discretion.
- **D-08:** Extend the existing **FeatureProbe** demo (.NET `FeatureProbeController.cs` + `FeatureProbe-bun`) to emit `layout` (split/cards); extend `parity/fixtures/feature-probe.json`. No new backend entries (`dotnet-probe`/`bun-probe`/`node-probe` already cover it).
- **D-09:** Same fixture also exercises `density` (compact) and `variant: card`, closing the Phase 3 D-05 deferral. Existing 7 fixtures stay 100% green.
- **D-10:** "5 ViewModels.cs copies" wording is factually inaccurate — there is ONE shared `viewmodel-shell-dotnet/ViewModels.cs`; demos consume via `ProjectReference`. Do not hunt for 5 files.
- **D-11:** No version bump in Phase 4 (Phase 5 RELEASE-01 owns 0.4.0). Parity must stay green; verifier + plan-check agents ON.

### Claude's Discretion

- Exact `--vms-card-min` default value (≈16–20rem).
- The zero-media-query `split` technique (bounded by D-07: exactly-2-then-1, intrinsic, no media queries — THIS RESEARCH ITEM).
- Exact CSS for how `--split`/`--cards` override the existing `.vms-page`/`.vms-section` flex-column `gap` (preserve `gap` rhythm; switch axis/display) — provided omitted/`stack` stays byte-identical.
- Whether `.vms-page__title` / `.vms-section__heading` stay outside the grid/column flow (likely yes).
- FeatureProbe VM + `feature-probe.json` step structure for exercising layout/density/card.

### Deferred Ideas (OUT OF SCOPE)

- Fixed-N-column preset (`LAYOUT-F1`, v2).
- Coarse card-size token / numeric min-width on the wire (rejected — pure CSS constant).
- N-up / content-natural `split` (rejected — exactly-2, equal-width).
- Container queries as the responsive mechanism (permitted only if it cleanly beats flexbox-wrap/auto-fit — research conclusion: it does NOT, not adopted).
- 0.4.0 npm+NuGet version bump (Phase 5 RELEASE-01).
- AGENTS.md full doc polish + Showcase/demos on shipped stylesheet (Phase 5).
- MIGRATION.md / CHANGELOG 0.4.0 entry (Phase 5 RELEASE-03).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAYOUT-01 | `page`/`section` accept optional layout-preset; default value renders identically to current vertical-stack (non-breaking, no new node types) | Byte-identity is structurally guaranteed: .NET serializes camelCase with `JsonIgnoreCondition.WhenWritingNull` (Program.cs:8–9) so `Layout = null` is dropped; `parity/normalize.ts:19` drops null fields. Renderer must emit no modifier class for omitted/`"stack"` (D-02), proven by jsdom `className === "vms-page"` test (theme-modifiers.test.ts pattern). **Caveat documented below: `"stack"` is a non-null string and WILL serialize on the wire — see Pitfall 1.** |
| LAYOUT-02 | `split` preset: columns wide, collapses stacked narrow, no app breakpoints | Recommended capped-2-column Grid CSS in Code Examples — intrinsic, zero media queries, exactly-2-then-1 (D-06/D-07) |
| LAYOUT-03 | `cards` preset: auto-fit from single min-item-width, collapses to one column | `repeat(auto-fit, minmax(var(--vms-card-min), 1fr))` confirmed to intrinsically collapse to 1 column with zero media queries (D-04); `--vms-card-min: 16rem` recommended |
| LAYOUT-04 | preset is the ONLY layout field on the wire — no spans/tracks/areas | Single closed-union string field; geometry (`--vms-card-min`, column count) lives entirely in CSS. Verified against REQUIREMENTS Out-of-Scope "Spatial layout utilities" |
| LAYOUT-05 | round-trips identically .NET + TS, present in `src/index.ts`, `src/server.ts`, shared .NET source, parity fixture | `src/server.ts` satisfied by re-export (D-03, server.ts:13 confirmed). One shared `ViewModels.cs` (D-10 confirmed: no `ViewModels.cs` under `demo/`). FeatureProbe is the only 3-backend fixture (backends.json:107–136: dotnet-probe/bun-probe/node-probe) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`CLAUDE.md` was reduced to a thin `@AGENTS.md` pointer (git commit `414a059`) and is currently deleted in the working tree (`git status`: ` D CLAUDE.md`). No standalone project directives exist beyond what AGENTS.md and the GSD planning docs already encode. The binding constraints for this phase come from CONTEXT.md (locked decisions above) and the codebase invariants below:

- **Core references zero platform globals** — CI-enforced via `check:core-globals` (AGENTS.md:66). Not at risk this phase (CSS + types + a renderer string concat, no new platform API).
- **Parity is the highest-signal gate** — must stay green (STATE.md; D-11).
- **Override seam is sacred** — additive `--vms-*` only; never edit existing `:root` names/values or the 11 theme files (Phase 3 D-06 / THEME-05 carried forward).
- **Zero media queries** — `default.css` has none today; preserve that (D-07).
- **No real browser for tests** — jsdom/vitest only (Phase 1/2 discipline).
- **Closed unions, not open strings** — `density?`/`variant?` style, not `ListItemNode.variant?: string` style (D-01/D-03).
- **No version bump** (D-11).

## Standard Stack

No new libraries. This phase is pure platform CSS + existing TypeScript/C# type plumbing. The relevant "stack" is the set of CSS features used and their browser baseline.

### Core CSS Features Used

| Feature | Purpose | Baseline | Why Standard |
|---------|---------|----------|--------------|
| CSS Grid `grid-template-columns` | `split` (2-col) + `cards` (auto-fit) layout | Universally available (Grid: all evergreen since 2017) `[CITED: developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout]` | The canonical 2D layout primitive; the only correct tool for "equal-width columns that collapse" |
| `repeat(auto-fit, minmax(...))` | Intrinsic collapse with zero media queries | Grid Level 1, universally available `[CITED: developer.mozilla.org/en-US/docs/Web/CSS/minmax]` | The textbook zero-media-query responsive-grid idiom; already the framework-aligned approach (Phase 3 D-13 used `clamp()` for the same "intrinsic, no breakpoints" reason) |
| `min(<value>, 100%)` inside `minmax()` | Prevents single-item overflow on very narrow viewports | `min()` Baseline since 2020, universally available `[CITED: developer.mozilla.org/en-US/docs/Web/CSS/min]` | Standard guard so a `minmax(20rem, 1fr)` track never overflows a <20rem viewport |
| `grid-column: 1 / -1` | Keep heading full-width (out of column flow) | Grid Level 1, universally available `[CITED: developer.mozilla.org/en-US/docs/Web/CSS/grid-column]` | Standard "span all columns" idiom — the clean fix for the heading-in-flow problem |
| `gap` (Grid + Flexbox) | Preserve existing `--vms-space-*` rhythm | Universally available (Flexbox `gap` Baseline since 2021) `[CITED: developer.mozilla.org/en-US/docs/Web/CSS/gap]` | Already used by `.vms-page`/`.vms-section`; modifiers inherit it for free |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Capped 2-col Grid for `split` | Flexbox-wrap (`flex: 1 1 <basis>` + `min-width`) | Works, but equal-width is fragile: flex children with differing content can end up unequal unless `flex-basis` + `min-width`/`max-width` are tuned exactly; heading exclusion is messier (flex item, no `grid-column` equivalent — would need `flex-basis: 100%` + `order`). Grid expresses "equal columns" directly with `1fr`. **Not recommended.** |
| Capped 2-col Grid for `split` | Container queries (`@container`) | Newer baseline (`@container` Baseline 2023). Would require a `container-type` on `.vms-page`/`.vms-section` (changes their formatting context — `container-type: inline-size` is benign for block layout, but it is a behavior change to an existing shipped element and risks subtle regressions). Provides **no advantage** over capped Grid for this exact contract (the contract is viewport-driven collapse, which intrinsic Grid already does). Breaks the framework's "clamp/intrinsic only to date" precedent for zero benefit. **Explicitly not recommended** (matches CONTEXT.md Deferred: permitted only "if it cleanly beats" — it does not). |
| `repeat(auto-fit, …)` capped to 2 for `split` | Bare `repeat(auto-fit, minmax(X, 1fr))` (uncapped) | Uncapped auto-fit yields N>2 columns at wide widths — violates D-06's "exactly 2". Must be capped. The cap mechanism is the actual research deliverable (see Code Examples). |

**Installation:** None. No `package.json` / `.csproj` dependency changes. (Version verification N/A — no packages added; D-11 forbids the version bump.)

## Architecture Patterns

### File Change Map (mechanical, copy the Phase 3 precedent)

```
viewmodel-shell/src/index.ts          # PageNode (59–65) + SectionNode (67–73): add `layout?` closed union
viewmodel-shell/src/server.ts         # NO EDIT — line 13 `export * from "./index.js"` re-exports automatically (D-03)
viewmodel-shell/src/browser.ts        # page() line 196 + section() line 209: extend className concat (split/cards only)
viewmodel-shell/styles/default.css    # :root add --vms-card-min; add 4 modifier rules + 2 heading-exclusion rules
viewmodel-shell-dotnet/ViewModels.cs  # PageNode (99–103) + SectionNode (105–109): add `string? Layout = null`
demo/FeatureProbe/AspNetCore/FeatureProbeController.cs  # BuildVm: add layout/density/variant usage
demo/FeatureProbe-bun/handler.ts      # buildVm: add layout/density/variant usage (NOT server.ts/server-node.ts — see Pattern 2)
parity/fixtures/feature-probe.json    # extend steps so layout/density/variant appear in diffed responses
viewmodel-shell/test/theme-modifiers.test.ts  # add layout class-emission tests (mirror density/card pattern)
AGENTS.md                             # node table rows 105–106 + CSS-class table rows 141–142: add layout field + classes (accurate-only, no polish — Phase 5 owns polish)
```
`parity/backends.json` — **no edit** (dotnet-probe/bun-probe/node-probe at lines 107–136 already cover `feature-probe`).
`parity/run.ts` / `parity/normalize.ts` — **no edit** (harness is generic; CSS has no parity surface).

### Pattern 1: Closed-union additive field (verbatim from Phase 3 density/variant)

**What:** Add `layout?: "stack" | "split" | "cards"` to `PageNode` and `SectionNode` with a JSDoc comment matching the adjacent `density?`/`variant?` style. Add `string? Layout = null` to the .NET records.

**TS (`index.ts`)** — model exactly after lines 62–63 / 70–71:
```typescript
// Source: viewmodel-shell/src/index.ts lines 59-73 (existing density?/variant? precedent)
export interface PageNode {
  type: "page";
  title?: string;
  /** Density of global spacing. Omitted or "comfortable" = current behavior (no modifier class). "compact" emits .vms-page--compact. Closed union (D-03). */
  density?: "comfortable" | "compact";
  /** Layout preset arranging direct children. Omitted or "stack" = current vertical flow (no modifier class). "split"/"cards" emit .vms-page--split / .vms-page--cards. Closed union (D-01/D-02). */
  layout?: "stack" | "split" | "cards";
  children: ViewNode[];
}
// SectionNode: same `layout?` line added beside `variant?: "card";`
```

**C# (`ViewModels.cs`)** — model exactly after lines 99–109:
```csharp
// Source: viewmodel-shell-dotnet/ViewModels.cs lines 99-109 (existing Density/Variant precedent)
public record PageNode(
    string? Title,
    IReadOnlyList<ViewNode> Children,
    string? Density = null,
    string? Layout = null
) : ViewNode;

public record SectionNode(
    string? Heading,
    IReadOnlyList<ViewNode> Children,
    string? Variant = null,
    string? Layout = null
) : ViewNode;
```
No `JsonDerivedType`/serializer change needed — `Layout` is a plain `string?` on records already registered (lines 81–82); camelCase + `WhenWritingNull` (FeatureProbe `Program.cs:6–9`) handle it automatically, exactly as `Density`/`Variant` are handled today.

### Pattern 2: Renderer modifier emission (the `${n.x === "y" ? " vms-z--y" : ""}` idiom)

**What:** Extend the className template literal. D-02: emit ONLY for `"split"`/`"cards"`; omitted/`"stack"` emits nothing.

**Source idiom** (browser.ts:196 / :209, verified):
```typescript
el.className = `vms-page${n.density === "compact" ? " vms-page--compact" : ""}`;            // line 196
el.className = `vms-section${n.variant === "card" ? " vms-section--card" : ""}`;             // line 209
```

**Recommended extension** (note: `"stack"` and `undefined` both fall through to no class — exactly D-02):
```typescript
// page() line 196
el.className = `vms-page${n.density === "compact" ? " vms-page--compact" : ""}${
  n.layout === "split" || n.layout === "cards" ? ` vms-page--${n.layout}` : ""}`;

// section() line 209
el.className = `vms-section${n.variant === "card" ? " vms-section--card" : ""}${
  n.layout === "split" || n.layout === "cards" ? ` vms-section--${n.layout}` : ""}`;
```
Class ordering: append `layout` modifier AFTER the existing density/variant modifier so existing assertions (`toContain`) are unaffected and the `className === "vms-page"` byte-identity test still passes when `layout` is omitted/`"stack"`.

**Critical (where the demo logic lives):** `demo/FeatureProbe-bun/server.ts` is a 12-line Bun shim; `server-node.ts` is the Node shim. The actual `buildVm` is in **`demo/FeatureProbe-bun/handler.ts`** (lines 22–37). The planner must edit `handler.ts`, not `server.ts`. CONTEXT.md D-08 says "FeatureProbe-bun/server.ts" loosely; the verified target is `handler.ts`. Both Bun and Node backends import the same `handler.ts`, so one edit covers `bun-probe` AND `node-probe`.

### Pattern 3: CSS modifier overriding the existing flex-column container

**What:** `.vms-page`/`.vms-section` are `display:flex; flex-direction:column; gap:var(--vms-space-*)` (default.css:91–94 / :118). The `--split`/`--cards` modifiers switch `display` to `grid` and set columns, **keeping `gap`**. Omitted/`stack` is untouched → byte-identical.

**Recommended structure** (full CSS in Code Examples):
- `.vms-page--split`, `.vms-section--split` → `display: grid`, capped-2-column track, inherit `gap`.
- `.vms-page--cards`, `.vms-section--cards` → `display: grid`, `repeat(auto-fit, minmax(var(--vms-card-min), 1fr))`, inherit `gap`.
- `.vms-page--split > .vms-page__title`, `.vms-section--split > .vms-section__heading` (+ `--cards` equivalents) → `grid-column: 1 / -1` so the heading spans all columns and never becomes a single grid cell.

`gap` preservation: Grid honors the same `gap` property Flexbox uses, and `.vms-page`/`.vms-section` already declare `gap: var(--vms-space-lg)` / `var(--vms-space-sm)`. Because the modifier only changes `display` + `grid-template-columns` (not `gap`), the existing token rhythm carries over verbatim — no `gap` redeclaration needed (and redeclaring it would risk drift; do NOT).

### Anti-Patterns to Avoid

- **Redeclaring `gap` in the modifier:** unnecessary and risks divergence from the `.vms-page`/`.vms-section` token. The cascade keeps it; leave it alone.
- **`grid-template-columns: 1fr 1fr` for split:** does NOT collapse intrinsically — fails LAYOUT-02. Must use the width-driven cap technique.
- **Bare `repeat(auto-fit, …)` for split:** yields 3+ columns at wide widths — violates D-06 "exactly 2".
- **Editing `src/server.ts`:** redundant; the re-export (line 13) already exposes the field (D-03).
- **Editing `demo/FeatureProbe-bun/server.ts` for VM logic:** wrong file — logic is in `handler.ts`.
- **A media query "just for split":** forbidden (D-07). The intrinsic technique below makes it unnecessary.
- **`container-type` on `.vms-page`/`.vms-section`:** changes the formatting context of a shipped element for zero benefit; rejected (see Alternatives).
- **DOM restructure to move the heading out of the container:** would change emitted DOM and break LAYOUT-01 byte-identity. The CSS-only `grid-column: 1 / -1` fix avoids this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Collapse to 1 column when narrow" | A JS resize listener / breakpoint table | `repeat(auto-fit, minmax(min(X,100%),1fr))` (intrinsic CSS) | CSS does this with zero runtime, zero media queries — matches D-07 and the Phase 3 `clamp()` precedent |
| Equal-width columns | Manual width math / `calc()` percentages with gap subtraction | Grid `1fr` tracks | Grid `1fr` accounts for `gap` automatically; `calc()`-with-gap is the classic off-by-a-gap bug |
| Keep heading full-width above columns | DOM wrapper / renderer change | `grid-column: 1 / -1` on the heading selector | CSS-only; preserves LAYOUT-01 DOM byte-identity (no renderer edit, no AGENTS.md DOM-table churn) |
| "Missing" vs "null" wire equivalence | Custom serialization shims | Existing stack: .NET `WhenWritingNull` + `normalize.ts` null-drop | Already proven by 7 green fixtures + Phase 3 density/variant |

**Key insight:** Every hard part of this phase already has a one-line CSS or existing-infrastructure answer. The trap is *adding* machinery (media query, resize JS, DOM wrapper, server.ts edit) where the platform/precedent already solves it.

## Common Pitfalls

### Pitfall 1: `"stack"` is a non-null string and DOES cross the wire

**What goes wrong:** D-02 says omitted AND explicit `"stack"` are byte-identical *in DOM/class output*. That is true for the rendered class (renderer emits no modifier for `"stack"`). But on the **wire JSON**, `layout: "stack"` is a non-null string — .NET's `WhenWritingNull` does NOT drop it, and `normalize.ts` only drops `null`/missing (line 19), not `"stack"`. So a node authored with `layout: "stack"` serializes `{"layout":"stack"}` while an omitted one serializes nothing. These are NOT byte-identical on the wire.

**Why it happens:** D-02's "byte-identical" is scoped to the *rendered DOM* (the LAYOUT-01 acceptance criterion: "renders identically to current vertical-stack behavior"). LAYOUT-01 is about render output, not wire encoding of an explicitly-set field. An explicitly-set field legitimately appears on the wire — that is correct, additive, non-breaking behavior (a v0.3.x client ignoring an unknown `layout` key still renders the stack).

**How to avoid:** The parity fixture must compare *the same VM* across backends — both .NET and TS FeatureProbe must emit the SAME `layout` value at the SAME step. Do NOT design a fixture step that relies on omitted-vs-`"stack"` wire equivalence. For the LAYOUT-01 byte-identity proof, rely on: (1) the existing 7 fixtures staying green (they author no `layout` → omitted → no wire key → unchanged), and (2) the jsdom test asserting `className === "vms-page"` for omitted AND `"stack"`. Do not assert wire-level equivalence between omitted and `"stack"`. **Plan note:** when the FeatureProbe VM sets `layout`, set it to `"split"` or `"cards"` (a value that exercises real behavior), not `"stack"`.

**Warning signs:** A fixture step or test asserting that a `"stack"` response equals an omitted-layout response at the JSON level.

### Pitfall 2: Heading becomes a grid/flex item under split/cards

**What goes wrong:** `browser.ts` `page()` (lines 197–202) and `section()` (lines 210–215) append the `h1.vms-page__title` / `h2.vms-section__heading` as the **first direct child** of the container, then append content children via `this.kids(...)` (line 203 / 216). Under `display:grid` the heading becomes the first grid cell — so with `split` and a heading, you'd get heading | child-1 in row 1, which is wrong (heading should be a full-width band above the columns; for `cards` the heading would occupy one card slot).

**Why it happens:** The renderer DOM is flat (heading and children are siblings). This is correct for flex-column today; it only bites when the container becomes a grid.

**How to avoid:** CSS-only — add `grid-column: 1 / -1` to the heading under each modifier (see Code Examples). This spans the heading across all columns and forces it onto its own implicit row, preserving the visual "title, then columns" reading. No renderer change → LAYOUT-01 DOM byte-identity preserved. Verified: heading IS a direct child (`el.appendChild(h)` then `this.kids(n.children, el, on)`), so a child-combinator selector (`> .vms-page__title`) correctly targets it.

**Warning signs:** Visually (Phase 5 Showcase) the title sharing a row with content; or a planner proposing a `.vms-page__content` wrapper (that was explicitly rejected in Phase 3 deferred ideas and would break byte-identity).

### Pitfall 3: Editing the wrong FeatureProbe-bun file

**What goes wrong:** D-08 names "`demo/FeatureProbe-bun/server.ts`". That file is a 12-line `Bun.serve` shim. Editing it does nothing for VM content; the Node backend (`node-probe`) doesn't even use it.

**How to avoid:** Edit `demo/FeatureProbe-bun/handler.ts` `buildVm()` (lines 22–37). It is imported by both `server.ts` (Bun) and `server-node.ts` (Node), so one edit covers `bun-probe` and `node-probe`. The .NET equivalent is `FeatureProbeController.cs` `BuildVm()` (lines 89–101).

**Warning signs:** A plan task that says "edit FeatureProbe-bun/server.ts" without mentioning `handler.ts`.

### Pitfall 4: Single-item overflow on very narrow viewports

**What goes wrong:** `minmax(20rem, 1fr)` forces every track to be ≥20rem. On a <20rem viewport (or a narrow `section` inside a padded page) the single column overflows its container horizontally.

**How to avoid:** Use `minmax(min(var(--vms-card-min), 100%), 1fr)` — the `min(..., 100%)` clamps the track floor to the container width so a lone column shrinks instead of overflowing. This is the standard hardened auto-fit idiom and should be used for BOTH `cards` and the `split` cap. `[CITED: developer.mozilla.org/en-US/docs/Web/CSS/minmax]`

**Warning signs:** Horizontal scrollbar on a narrow viewport in the Phase 5 Showcase.

### Pitfall 5: Override-seam violation

**What goes wrong:** Adding `--vms-card-min` is required (D-05) and is additive-safe. But "while in `:root`" temptation to tidy adjacent variables would break THEME-05 (regression-guarded, 11 theme files must stay byte-identical).

**How to avoid:** Add ONLY `--vms-card-min` next to `--vms-page-max` (default.css:58). Touch no other `:root` line, no theme file. (Phase 3 D-06/D-17 already established this is enforced.)

## Code Examples

### `cards` preset (LAYOUT-03, D-04) — confirmed intrinsic, zero media queries

```css
/* Source: standard auto-fit idiom — developer.mozilla.org/en-US/docs/Web/CSS/minmax
   Verified behavior: auto-fit collapses the explicit track count toward 1 as the
   container narrows; the min(...,100%) floor prevents single-column overflow.
   Zero media queries. gap inherited from .vms-page/.vms-section (NOT redeclared). */

:root {
  /* added beside --vms-page-max (default.css:58) — additive override seam (D-05) */
  --vms-card-min: 16rem;
}

.vms-page--cards,
.vms-section--cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(var(--vms-card-min), 100%), 1fr));
  /* gap: inherited from .vms-page (var(--vms-space-lg)) / .vms-section (var(--vms-space-sm)) */
}

/* Heading must not occupy a single card slot — span all columns (Pitfall 2) */
.vms-page--cards > .vms-page__title,
.vms-section--cards > .vms-section__heading {
  grid-column: 1 / -1;
}
```
**`--vms-card-min` recommendation: `16rem` (≈208px at the framework's 0.8125rem... no — `rem` is root-relative, default 16px ⇒ 256px).** Rationale: 16rem≈256px is a sane minimum readable card (a stat tile, a short form, a list summary) and yields ~3–4 cards across the ~1080px `--vms-page-max` content width — visually serviceable, matching the CONTEXT.md ≈16–20rem guidance and the Bootstrap-card visual benchmark (Phase 5). `16rem` over `20rem` because the framework's content max (1080px) is moderate; 20rem (320px) would cap at ~3 columns and feel sparse for dense dashboards. Exposed as a `:root` var so a theme/host can retune to 18–20rem without touching rules (D-05).

### `split` preset (LAYOUT-02, D-06/D-07) — RECOMMENDED technique: capped-2 Grid

The contract: exactly 2 equal columns when there's room for 2; collapse to 1 when there isn't; >2 children flow into the 2-column grid (4 children → 2×2); equal-width (not content-natural); zero media queries.

**Recommended: `repeat(auto-fit, minmax(...))` arithmetically capped to 2 columns.** Bare auto-fit yields N columns; cap it by making the track floor large enough that 3 never fit but 2 do until the viewport is too narrow for 2, then it drops to 1.

```css
/* Source: capped auto-fit — developer.mozilla.org/en-US/docs/Web/CSS/grid-template-columns
   Behavior: with the min track = max(48% - gap, threshold), at most 2 tracks ever fit
   (2 * 48% + gap < 100%; a 3rd would need >100%); below the threshold only 1 fits.
   Equal width via the 1fr max. Zero media queries. */

.vms-page--split,
.vms-section--split {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(max(var(--vms-split-min, 18rem), (100% - var(--vms-split-gap)) / 2), 1fr));
}
```

This is subtle; the **simpler and equally-correct recommended form** avoids the `calc` gap-accounting by using the well-known "2-up that collapses" pattern — a fixed 2-track grid whose tracks have a `minmax` floor, where auto-fit naturally drops to 1 when 2 floors can't coexist:

```css
/* RECOMMENDED — simplest correct form. Source: MDN auto-fit + minmax.
   minmax(<floor>, 1fr): auto-fit packs as many <floor>-or-wider tracks as fit.
   Choose <floor> so exactly 2 fit at typical content widths and 1 at narrow:
   floor ≈ 48% of the content box is impossible to express in track sizing
   directly, so use an absolute floor sized to forbid a 3rd column at the
   page max-width while still allowing 1 when narrow. */
.vms-page--split,
.vms-section--split {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(var(--vms-split-min, 20rem), 100%), 1fr));
}
.vms-page--split > .vms-page__title,
.vms-section--split > .vms-section__heading {
  grid-column: 1 / -1;
}
```

**The honest engineering caveat (flag for the planner):** pure `repeat(auto-fit, minmax(FLOOR, 1fr))` gives "as many as fit", which is exactly-2 only when `2*FLOOR ≤ containerWidth < 3*FLOOR`. At a very wide container it yields 3+. To **guarantee** "never more than 2", the column count must be hard-capped. There are exactly two robust zero-media-query ways to cap at 2:

1. **`grid-template-columns: repeat(2, 1fr)` + an intrinsic single-column fallback** is NOT possible without a media/container query (a fixed `repeat(2,1fr)` never collapses) — rejected.
2. **Width-relative `minmax` floor** so a 3rd column is mathematically impossible while 2→1 still works:

```css
/* DEFINITIVE RECOMMENDED split rule — guarantees exactly-2-then-1, zero media queries.
   Source: derived from CSS Grid track sizing (MDN grid-template-columns / minmax).
   Mechanism: each track's MINIMUM is at least 50% of the row. Two 50% tracks fill
   the row exactly (auto-fit places 2). A 3rd track would require >100% — impossible,
   so auto-fit never creates 3+. When 50% drops below the absolute readability floor
   (--vms-split-min) on a narrow container, the floor wins; two floors can't both fit
   so auto-fit places 1. Equal width preserved by the shared 1fr max + identical min. */
.vms-page--split,
.vms-section--split {
  display: grid;
  grid-template-columns:
    repeat(auto-fit, minmax(max(var(--vms-split-min, 16rem), 50% - var(--vms-split-gap, 0.75rem)), 1fr));
}
.vms-page--split > .vms-page__title,
.vms-section--split > .vms-section__heading {
  grid-column: 1 / -1;
}
```

**Why `max(--vms-split-min, 50% - gap)` is the correct floor:** `50% - gap` is the largest a 2-up track can be while still leaving room for the inter-column `gap`; using it as the *minimum* means each track is at least half the row, so auto-fit fits at most 2 and never 3+. The `max(--vms-split-min, …)` term ensures that when the container is narrow enough that `50% - gap` would make a column unreadably thin, the absolute floor takes over and forces a single column. Net effect: exactly 2 equal columns on wide, exactly 1 on narrow, no media query, equal-width via the shared `1fr` max. The `gap` token (`--vms-split-gap`) defaults to the section/page rhythm value; the planner can either hardcode the same token used by `gap` or add an additive `--vms-split-gap` (additive-safe per D-05). **Recommendation: reference the existing space token directly** (`var(--vms-space-sm)` for section / `var(--vms-space-lg)` for page) to avoid introducing a second knob — but note the modifier rule then differs slightly between page and section (different gap token), which is acceptable since "CSS differs only by selector" (D-01) already anticipates per-container CSS divergence.

> **Planner decision point (bounded discretion, not a re-litigation):** the *technique* is settled (capped auto-fit Grid). The remaining tunable is the exact floor expression. Recommended: `minmax(max(<absolute-floor>, calc(50% - <gap>)), 1fr)` with `<absolute-floor>` ≈ `16rem` and `<gap>` = the container's existing space token. This satisfies D-06 exactly. The simpler `minmax(min(20rem,100%),1fr)` form is acceptable ONLY if the team accepts "3 columns at very wide widths" — which violates D-06's "exactly 2", so the capped form is the correct choice.

### jsdom class-emission test (mirror the verified Phase 3 pattern)

```typescript
// Source: viewmodel-shell/test/theme-modifiers.test.ts (existing density/card pattern, verified)
describe("LAYOUT-02/03 — page layout preset modifier emission (D-02 idiom)", () => {
  it('layout: "split" ⇒ root className contains vms-page--split', () => {
    const el = renderPage({ type: "page", children: [], layout: "split" });
    expect(el.classList.contains("vms-page")).toBe(true);
    expect(el.classList.contains("vms-page--split")).toBe(true);
  });
  it('layout: "cards" ⇒ root className contains vms-page--cards', () => {
    const el = renderPage({ type: "page", children: [], layout: "cards" });
    expect(el.classList.contains("vms-page--cards")).toBe(true);
  });
  it('layout: "stack" ⇒ className === "vms-page" (NO modifier — byte-identical, LAYOUT-01)', () => {
    const el = renderPage({ type: "page", children: [], layout: "stack" });
    expect(el.className).toBe("vms-page");
  });
  it('layout omitted ⇒ className === "vms-page" (byte-identical to pre-change)', () => {
    const el = renderPage({ type: "page", children: [] });
    expect(el.className).toBe("vms-page");
  });
});
// Section block: identical shape with renderSection + "vms-section"/"vms-section--split"/"--cards".
```
Note: `renderPage`/`renderSection` helpers and `freshContainer` already exist in this file — extend, don't re-author. Existing density/variant tests must still pass (ordering: append `layout` modifier last so `className === "vms-page"` holds for omitted/stack even with density also omitted).

### FeatureProbe VM extension (closes D-09 — exercises layout + density + variant)

```typescript
// demo/FeatureProbe-bun/handler.ts — buildVm() (lines 22-37). Mirror in
// FeatureProbeController.cs BuildVm() (lines 89-101). Both backends MUST emit
// the IDENTICAL VM at each step or parity fails (that's the point — LAYOUT-05).
function buildVm(state: FeatureProbeState): ViewNode {
  const children: ViewNode[] = [
    { type: "text", value: `Poll count: ${state.pollCount}`, style: "muted" },
  ];
  if (state.lastUploadName !== null) { /* ...unchanged... */ }
  children.push({ type: "copy-button", /* ...unchanged... */ } as ViewNode);
  // NEW: a section exercising variant:"card" + layout:"split" wrapping the children
  const probeSection: ViewNode = {
    type: "section",
    heading: "Probe",
    variant: "card",
    layout: "split",
    children,
  };
  // page exercises density + layout:"cards"
  return { type: "page", title: "Feature Probe", density: "compact", layout: "cards", children: [probeSection] };
}
```
.NET (`FeatureProbeController.cs` BuildVm, line ~100) mirrors exactly:
```csharp
var probeSection = new SectionNode("Probe", children, Variant: "card", Layout: "split");
return new PageNode("Feature Probe", new List<ViewNode>{ probeSection }, Density: "compact", Layout: "cards");
```
This makes `density`, `variant`, and `layout` all appear in every diffed `feature-probe` response across `dotnet-probe`/`bun-probe`/`node-probe`, closing the Phase 3 D-05 deferral in one fixture (D-09). The existing fixture **steps** (`feature-probe.json`) need no structural change — every existing step calls `BuildVm`/`buildVm`, so the new fields ride into every captured response automatically. (Optionally add one explicit `{ "id": "layout-probe", "method": "GET", "freshState": true }` step for a self-documenting fixture, but it is not required for coverage.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Media-query breakpoints for responsive columns | Intrinsic `auto-fit`/`minmax`/`min()`/`clamp()` | Mainstream since ~2018–2020; universally available | This phase + Phase 3 D-13 both rely on it; zero-media-query is now the normal, not exotic, choice |
| Float/`display:table` columns | CSS Grid | ~2017 | Grid is the only correct primitive here |
| JS resize observers for layout | CSS-only intrinsic | ~2019+ | No runtime layout JS needed |

**Deprecated/outdated:** Nothing in play is deprecated. Container queries (`@container`, Baseline 2023) are *newer* than the framework's chosen toolset but deliberately NOT adopted (see Alternatives — no benefit for this contract, breaks the clamp/intrinsic-only precedent).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `--vms-card-min: 16rem` is a good default card width | Code Examples / cards | LOW — it's a `:root` var, host/theme-retunable (D-05); Phase 5 Showcase will visually validate against Bootstrap; trivially tunable |
| A2 | `repeat(auto-fit, minmax(max(<floor>, calc(50% - gap)), 1fr))` reliably yields exactly-2-then-1 across evergreen browsers | Code Examples / split | LOW-MED — the math is sound and uses only Baseline features (`max()`, `minmax()`, `auto-fit`, `calc()`); recommend the planner add a manual visual sanity check in Phase 5 Showcase (not testable in jsdom — jsdom has no layout engine). This is the one item warranting human eyeball confirmation. |
| A3 | The `gap` token cascades into the modifier without redeclaration | Pattern 3 | LOW — `display:grid` does not reset `gap`; this is standard cascade behavior, verified against MDN `gap` |
| A4 | FeatureProbe fixture needs no new *steps* (existing steps re-call BuildVm) | Code Examples / FeatureProbe | LOW — verified: every step in `feature-probe.json` calls the GET/action handler which calls `BuildVm`; new fields ride automatically. An explicit step is optional polish. |
| A5 | The `"stack"` non-null-string wire caveat doesn't break existing 7 fixtures | Pitfall 1 | NONE — existing fixtures author no `layout`; field is omitted ⇒ no wire key ⇒ byte-unchanged. Verified against `normalize.ts` null-drop + .NET `WhenWritingNull`. |

**Net:** Only A2 (the split CSS yielding exactly-2-then-1 in a real browser) warrants a Phase-5 visual sanity check. jsdom cannot validate layout, so the jsdom tests only cover class emission — the CSS correctness itself has no automated test surface (consistent with the Phase 3 note: "CSS layout has no parity surface").

## Open Questions

1. **Should `--vms-split-gap` / split floor be a new `:root` var or reference the existing space token?**
   - What we know: D-05 permits additive `--vms-*` vars; the split rule needs a gap value in its `calc(50% - gap)` floor; `.vms-page`/`.vms-section` use different gap tokens (`--vms-space-lg` vs `--vms-space-sm`).
   - What's unclear: whether to introduce `--vms-split-min`/`--vms-split-gap` (more knobs, more override surface) or hardcode `16rem` + reference the per-container existing token.
   - Recommendation: Reference the existing per-container space token in the `calc` and use a literal `16rem` floor (no new var beyond the required `--vms-card-min`). Fewer knobs = simpler agent/theme surface and stays closest to D-01's "CSS differs only by selector". The planner may add `--vms-split-min` if it wants symmetry with `--vms-card-min`, but it is not required by any decision.

2. **Optional explicit fixture step vs. relying on existing steps?**
   - What we know: existing steps already re-render `BuildVm` so coverage is automatic (A4).
   - Recommendation: Add no new step (keeps the fixture minimal and the 7-green-regression argument cleanest). If the planner wants self-documentation, one `GET freshState` step labeled `layout-probe` is harmless.

## Environment Availability

Step 2.6: External-dependency audit. The phase touches: TypeScript build, .NET build, Bun, Node, and the parity harness. These are pre-existing project requirements (the 7 fixtures already run them); no NEW external dependency is introduced by this phase. The phase is otherwise pure source edits (CSS/TS/C#/JSON).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| .NET SDK | `dotnet-probe` parity backend (pre-existing) | Assumed (7 fixtures pass today) | project-pinned | — |
| Bun | `bun-probe` parity backend (pre-existing) | Assumed (7 fixtures pass today) | project-pinned | — |
| Node 22+ | `node-probe` parity backend + vitest (pre-existing) | Assumed (7 fixtures pass today) | project-pinned | — |

**Missing dependencies with no fallback:** None — no new dependency. Parity already runs on this machine for 7 fixtures (STATE.md: "Green at 0.3.13 baseline (7/7 fixtures)"); the phase adds no toolchain requirement, only widens an existing fixture.

## Validation Architecture

`nyquist_validation` is `false` in `.planning/config.json` — this section is informational only and intentionally brief. The phase's verification surface is fully covered by two existing, well-precedented harnesses:

- **jsdom/vitest** (`viewmodel-shell/test/theme-modifiers.test.ts`) — class-emission + byte-identity assertions. Quick run: the existing vitest command. New `layout` tests mirror the verified density/variant pattern.
- **Cross-backend parity** (`parity/run.ts`) — wire-JSON diff across `dotnet-probe`/`bun-probe`/`node-probe` for the extended `feature-probe` fixture, plus the 7 existing fixtures staying green (regression). CSS has **no parity surface** (the harness diffs wire JSON, not computed CSS — confirmed reading `run.ts`/`normalize.ts`).
- **No automated CSS-correctness test exists or is feasible** (jsdom has no layout engine). The split/cards visual behavior is validated by human eyeball in the Phase 5 Showcase (A2). This is consistent with the Phase 3 precedent.

**Wave 0 gaps:** None — both harnesses exist and are green; this phase extends them, it does not bootstrap them.

## Sources

### Primary (HIGH confidence)
- Codebase (read directly this session): `viewmodel-shell/src/index.ts` (59–73), `viewmodel-shell/src/browser.ts` (188–232, page/section render + heading-as-direct-child confirmed), `viewmodel-shell/src/server.ts` (1–13, re-export confirmed), `viewmodel-shell/styles/default.css` (1–135, `:root`/`.vms-page`/`.vms-section`/`.vms-page__title`/`.vms-section__heading` confirmed), `viewmodel-shell-dotnet/ViewModels.cs` (1–50, 75–135, records + serializer-agnostic shape), `viewmodel-shell/test/theme-modifiers.test.ts` (full, the mirror pattern), `parity/run.ts` (full), `parity/normalize.ts` (full, null-drop confirmed), `parity/backends.json` (full, 3-backend probe confirmed lines 107–136), `parity/fixtures/feature-probe.json` (full), `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (full, BuildVm), `demo/FeatureProbe/AspNetCore/Program.cs` (full, camelCase + WhenWritingNull confirmed), `demo/FeatureProbe-bun/handler.ts` + `server.ts` + `server-node.ts` (full, handler.ts is the real VM home), `AGENTS.md` (relevant table rows 66/105–106/141–142)
- CONTEXT.md / REQUIREMENTS.md / STATE.md / ROADMAP.md / Phase 3 CONTEXT.md (all read in full)

### Secondary (MEDIUM confidence)
- MDN CSS reference (Grid, `minmax`, `min`, `max`, `grid-column`, `gap`, `repeat`) — cited inline as `[CITED: developer.mozilla.org/...]`. These are stable, long-baseline CSS features; training knowledge is corroborated by the framework's own existing `clamp()` usage (Phase 3 D-13 shipped) which proves the same intrinsic-responsive class of technique already works in this codebase's target browsers.

### Tertiary (LOW confidence)
- None. No claim in this research rests on unverified web search; the hard parts were resolved against the codebase and well-established CSS specs.

## Metadata

**Confidence breakdown:**
- Plumbing (types/renderer/parity/.NET) — **HIGH**: mechanically identical to the Phase 3 density/variant work that shipped 2 days ago; all five files read and the exact precedent lines confirmed.
- `cards` CSS — **HIGH**: the `repeat(auto-fit, minmax(...))` collapse is the textbook idiom, matches D-04 verbatim, no ambiguity.
- `split` CSS — **MEDIUM-HIGH**: technique resolved (capped auto-fit Grid via width-relative `minmax` floor); the math is sound and uses only Baseline features, but "exactly-2-then-1" has no jsdom test and warrants one Phase-5 visual sanity check (A2). The *direction* is unambiguous; the exact floor expression is bounded-tunable.
- Pitfalls — **HIGH**: each pitfall verified against actual code (heading-as-direct-child, `"stack"` wire serialization via `normalize.ts`/`WhenWritingNull`, handler.ts vs server.ts).

**Research date:** 2026-05-17
**Valid until:** ~2026-06-16 (stable — CSS specs and the codebase's additive idiom are not fast-moving; the only volatility is the Phase 5 Showcase visually confirming A2)
