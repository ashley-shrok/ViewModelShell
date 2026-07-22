# Inline rich text — `TextNode.runs` / `DiffCell.runs`

Design of record. Shipped npm 6.9.0 / NuGet 6.9.0, 22 Jul 2026.

## Why

VMS kept text at the **block level**: `TextNode.value` is a plain string, `LinkNode` is a
top-level node. There was no way to express "this sentence contains a bold word", and **no
composition produced one** — so this was a genuine capability gap, not a polish request.

It blocked three consumers: an IT-docs viewer (Amelia/Athena), a chat app rendering LLM
markdown (Angel `/ai`), and DiffNode's own word-level intra-line highlighting (deferred in
this repo's own design doc and CHANGELOG). It also blocked a framework-shipped markdown
converter: bold, italic, inline code and inline links are markdown's most common
constructs, so a converter built against the old vocabulary would have had to **flatten
them**. One app shipping a lossy converter is that team's tradeoff; the framework shipping
one is the endorsed answer in every consuming app at once.

## Survey — and what it actually proved

Surveyed nine systems: Portable Text, ProseMirror, Slate, Lexical, Contentful, Notion,
Compose `AnnotatedString`, Foundation `AttributedString`, Flutter `TextSpan`, mdast.

All agree a paragraph is an ordered sequence of inline items. They disagree on exactly one
question: **can an inline item contain other inline items?**

**~6 of 9 use flat runs — but roughly half that consensus does NOT transfer.** The stated
rationales are *editing* rationales. ProseMirror, verbatim: flat lets it *"represent
positions in a paragraph using a character offset rather than a path in a tree"* and split
or restyle *"without performing awkward tree manipulation"*. Portable Text was designed for
*"real-time collaborative interfaces"* — its `markDefs` side-table exists to keep a link's
identity stable when an **edit splits a span**. Lexical's bitmask makes toggling one XOR.

VMS has no cursors, no transactions, no collaboration, no editing. Two of those mechanisms
are actively wrong here: a side-table indirection is pure cost in a render-only format (a
pointer-chase both backends must implement, a dangling-key failure mode, and a construct an
LLM reliably gets wrong), and a bitmask is hostile to agent-legibility.

**What does transfer — two constraints, both ours:**

1. **The real peer group is Contentful and Notion** — wire formats published to renderers
   they don't control. They are the only genuinely *closed* models surveyed (Contentful:
   *"Custom node types and marks are not allowed."*). Everything open is open because its
   consumer configures an editor schema. Contentful is already proven implementable
   identically across TypeScript **and .NET** — our exact problem.
2. **The parity-diff constraint decides it, and is unique to us.** A nested model has
   combinatorially many encodings of one visual result (`strong(em(x))` vs `em(strong(x))`;
   `strong("a"),strong("b")` vs `strong("ab")`). That defeats structural cross-backend
   diffing, which is the foundation of `parity/`. Flat runs have exactly one encoding. Every
   surveyed system has a **single implementation**, so none of them ever had to care.

Supporting: a nested model needs a style-inheritance/merge rule (Flutter's `TextStyle.merge`)
implemented identically in both languages — two cascades diverging silently is the failure
class we cannot detect. And **Flutter is a warning, not a model**: the purest render-only
nested tree has *no link concept at all*, just a blue underline plus a tap recognizer. A tree
built only for drawing loses the meaning; `href` stays semantic here.

## Shape

```typescript
interface InlineRun {
  text: string;
  bold?: true; italic?: true; code?: true; strike?: true;
  href?: string; external?: true;
}
interface TextNode { type: "text"; value: string; runs?: InlineRun[]; style?: …; tone?: …; }
interface DiffCell { text: string; lineNumber?: number; runs?: InlineRun[]; }
```

**Flags, not a `marks[]` array** — *not* because an array has order (a sorted array is
equally canonical; that argument is unsound). Because `href`/`external` are already
**parameterized marks in the same record**, making the model an inherent hybrid: valueless
marks as flags, parameterized marks as named fields. A marks array would have to become an
array of objects to carry a link target — a worse nested model.

**Extension policy:** a new *valueless* mark → a new flag. A new *parameterized* mark → a
named field, as `href` did. Another string-valued field wanting rich text → a **sibling
`runs` field** (as `DiffCell` got), never a wire union.

**Flags typed literal `true`** / .NET non-nullable `bool` + `WhenWritingDefault`, so `false`
is unrepresentable and **absent is the only encoding of "off"**. A plain optional boolean
would admit explicit `false`, which `normalize.ts` does not drop and `findNulls` does not
flag — two encodings of "not bold", a fresh gotcha-#8-family drift class.

**`value` stays required**, doing three jobs: the rendering when `runs` is absent, the
fallback for adapters that don't implement runs (the TUI needed **zero** changes), and the
agent-legible form. Modelled on Notion's `plain_text` denormalization — *with* the property
that makes it safe: Notion **generates** it, never lets an author write it. Hence the
`richText()` / `TextNode.FromRuns()` factories.

**No action on a run — `href` only, structurally.** A type needs a walker arm only if it
holds child nodes or an action; `InlineRun` holds neither ⇒ **zero walker changes**. Markdown
links are always plain addresses, so dispatch buys the driving case nothing, while a missing
walker arm fails *silently* on both backends with nothing gating walker parity (see the live
`tracker-net-walker-gap`). A dispatching inline element stays a separate, deliberate feature.

**Adjacent runs sharing an identical `href`+`external` coalesce to ONE anchor** — otherwise a
link containing a bold word is two anchors: two tab stops, two SR announcements.

## Deliberately NOT validated

`runs.join("") === value` is a documented **SHOULD**, not a runtime check. Enforcing it would
(a) criminalize the legitimate degradation pattern — spelling a URL out in `value` so
link-less adapters still show the target — and (b) give `TextNode` a **walker arm on both
backends**, reintroducing the asymmetric-walker risk the no-actions rule eliminates. A
mismatch is never *ambiguous* (the renderer's rule is unconditional), so nothing is
undecidable. The framework's own reference usage is gated in CI via the FeatureProbe twins
instead, and the divergence case is shipped there on purpose so the decision is visible in
code rather than only in a comment.

## Scope (v1)

**In:** `TextNode`, `DiffCell`, and everything holding `ViewNode[]` children (free, by
nesting a TextNode).
**Out, deliberately:** `TableRow.cells` — a flat `Record<string,string>`, so enriching cells
changes what a cell *is* rather than adding a field; likely a purpose-built content-table
primitive rather than overloading the data-grid `TableNode`. Leaf control labels (button /
badge / breadcrumb / tab) — markdown never produces emphasis inside a control label.

## Rendering

Semantic elements, built innermost→outermost in a **fixed order** (`code`, `strike`,
`italic`, `bold`, then link outermost) so the same input always yields byte-identical DOM.
A flag-free run appends a **bare text node** — no wrapper — so `runs:[{text:"hi"}]` renders
exactly like `value:"hi"`. All text via `textContent`/`createTextNode`; the renderer's zero
content-`innerHTML` discipline is unbroken.

Inline links emit **`.vms-text__link`, not `.vms-link`** — the latter is
`display:inline-block` + `align-self:flex-start`, correct for a standalone `LinkNode` that is
a flex child of a section, **wrong** inside flowing text where it breaks line wrapping.

## Contrast

The inline-code chip is a new fg/bg pair that `check:aa-contrast` **structurally cannot
cover** (fixed token-name list; the chip background is a composite). Hand-computed across the
default + 12 themes. The chip **self-tints from `currentColor` at 6%**, so its pair tracks the
already-gated text-on-surface pair instead of forming an independent 6×13 matrix.

Worst case, text on chip: body **12.68**, muted **4.75**, danger **4.58**, warning **5.02** —
all clear 4.5:1. 6% and no heavier: 8% drops danger to 4.46, an opaque-surface chip to 4.35.

⚠️ `--vms-success` (3.23) and `--vms-info` (4.42) already fail 4.5:1 as **text** colours on a
plain surface today — graded at the non-text 3.0 bar, the same misclassification the gate's
header says was fixed for `warning`. Pre-existing, tracked separately, **not** introduced here.

## Verification

Full green-tree gate (15/15) + parity across 17 backends. **Mutation-proved five ways**, each
watched go red then restored byte-identical: TS link coalescing; TS `textContent` (hostile
input); .NET flag ignore-condition (22/24 tests fail); parity twin-drift; parity coverage
tripwire (both twins wrong *together* — the class a diff structurally cannot see). Positional
compatibility proved by building all 13 .NET projects against 96 unchanged construction sites.
Human run-through served over the tailnet across all 13 themes; signed off 22 Jul 2026.

## Follow-ons

- **Markdown → nodes converter.** The capability this unblocks. Must ship as **companion
  packages** (a subpath with an optional peer dep on npm, mirroring the chart pattern; a
  separate NuGet package) — the npm package has *no* runtime dependencies and the .NET package
  has *zero* package references, and a markdown parser would be the latter's first-ever hard,
  unconditional dependency.
- Rich table cells (the content-table question), and link-scheme validation — the latter matters
  more once hrefs originate in model-generated markdown rather than developer-authored source.
