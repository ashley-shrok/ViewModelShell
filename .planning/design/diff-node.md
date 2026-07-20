# DiffNode — aligned before/after primitive

**Design of record.** Read before proposing any change to the diff-node work.

## Why

VMS has no primitive for aligned before/after content comparison. Composition attempts fail:
`TextNode { style:"pre" }` in `SectionNode { layout:"split" }` gives two independently-flowing
walls of text with no line-by-line alignment across the columns — the reviewer has to eyeball
which added line corresponds to which removed line. Aligned side-by-side is a **genuinely
uncomposable capability**: no combination of existing nodes produces matching-line rows.

This matches the framework's own charts precedent (bar heights + axes + legends aren't
expressible as "a list of proportional widths"; aligned diff rows aren't expressible as "two
side-by-side pre blocks"). Diffs are a recurring pattern in review, audit, and
change-comparison apps.

Green-lit on the "easy yes" rule (Ashley, 2026-07-19):
- **Capability gap: STRONG** — genuinely uncomposable per above.
- **Containment: STRONG** — self-contained diff renderer, no combinatoric fan-out, doesn't
  interact with the rest of the surface.

Both criteria pass → easy yes even at one signal (Amelia / Athena review path). Signal count
is a tie-breaker; gap + containment is the primary gate.

## Doctrine — server computes, framework renders

Consumers own the diff algorithm (LibGit2Sharp on .NET, `diff` lib on TS, whatever they
have). They compute the diff server-side and hand VMS the structured result. Framework stays
small (no diff algorithm bundled, no algorithm choice locked in), consumers stay descriptive.

Same shape as the markdown→tree doctrine given to Angel (`/ai`) and Amelia (Athena) — VMS
does not bundle transforms; apps describe their content in the framework vocabulary.

Rejected: Amelia's `{ oldContent, newContent }` shape (framework computes diff). Would drag
a diff algorithm into the framework, force a choice of algorithm, own the edge cases.

## Wire

```typescript
export interface DiffNode {
  type: "diff";
  rows: DiffRow[];
  /** Layout mode. Default: "side-by-side". */
  mode?: "unified" | "side-by-side";
  /** Optional header row showing file paths for old/new. */
  header?: { old: string; new: string };
}

export interface DiffRow {
  /** Old (pre-change) cell. Null = this row is a pure addition (no left-side content). */
  old?: DiffCell | null;
  /** New (post-change) cell. Null = this row is a pure removal (no right-side content). */
  new?: DiffCell | null;
}

export interface DiffCell {
  text: string;
  lineNumber?: number;
}
```

**Row-kind derivation is client-side, from the shape of the row itself:**
- `old !== null && new === null` → REMOVE (only left side has content)
- `old === null && new !== null` → ADD (only right side has content)
- `old.text === new.text` → CONTEXT (unchanged; both sides identical)
- `old.text !== new.text` (both non-null, different text) → renders as REMOVE + ADD (two
  visual rows) in unified mode; both cells shown side-by-side and tinted in side-by-side mode

No `kind` wire field — the shape carries the meaning, which is more compact and impossible
to disagree with the content (a `kind:"add"` on a row with two non-null cells would be
ambiguous). Follows the same "shape over label" pattern the framework already uses.

**Line numbers are optional.** Diff sources that don't track line numbers (e.g. a doc
review of two prose versions) omit `lineNumber` and the framework degrades to just showing
the content column.

**Explicitly OUT of scope for this primitive:**
- **Syntax highlighting.** That's the `CodeBlockNode` question (currently on hold — bounty
  `codeblock-node`). If highlighting later ships, DiffNode can compose richer cell content
  additively without a wire break.
- **Word-level / intra-line diff highlighting.** Row-level only for v1. Rich cell content
  (spans / runs) is the deeper "inline rich text" architectural question (bounty
  `markdown-primitives-family`).
- **In-line comments / review widgets.** Out of scope. If ever needed, a separate primitive.
- **Collapsed/expandable hunks.** V1 shows all rows. Consumers who want collapse compute a
  smaller `rows` array server-side.

## Rendering

CSS Grid with column tracks — grid auto-flow across the tracks naturally handles vertical
alignment (each row's cells share a grid row).

**Side-by-side (4 tracks):**
```
[old-line#] [old-content] [new-line#] [new-content]
   auto       minmax(0,1fr)   auto      minmax(0,1fr)
```

**Unified (3 tracks):**
```
[line#-old] [line#-new] [content]
   auto        auto      minmax(0,1fr)
```

**Alignment guarantee — no wrapping.** Content cells use `white-space: pre` + `overflow-x:
auto`. Long lines scroll horizontally within their cell rather than wrapping — wrapping
would break the row-alignment guarantee (a wrapped long line takes N visual rows on one
side, misaligning everything below).

**Row-kind coloring (validated in spike):**
- Background tint: `color-mix(in srgb, var(--vms-success|error) 22%, transparent)` on
  ADD/REMOVE cells (both linenum + content — whole row-side reads as one connected band).
- Left stripe: `box-shadow: inset 3px 0 0 0 var(--vms-success|error)` on the LEFTMOST
  cell of each colored row-side (linenum cell in side-by-side; leftmost linenum in
  unified). Dual signal (tint + stripe) reads much stronger than tint alone at any
  reasonable alpha, without oversaturating the fill or dropping text contrast.
- Line-number text: tinted to the row's color (`color: var(--vms-success|error)`) on
  colored linenum cells so the marker glyph reads at a glance.

**Unified mode — collapse the two linenum columns visually:**
- Context rows: only the leftmost linenum keeps the muted base + border-right (one clean
  "line-number margin"); the second linenum blends into the content flow.
- Add/remove rows: the second linenum keeps its row-tint so the color band runs
  continuously across `[line#][line#][content]`, but drops the stripe (which belongs
  only on the leftmost cell of the row).

**Empty cells** (opposite side of a pure add or pure remove): subtle muted fill
(`color-mix(in srgb, var(--vms-text-muted) 6%, transparent)`), less prominent than the
active side.

**Header row** (optional file paths): spans the two column-groups in side-by-side, spans
all tracks in unified.

## Colorblindness

Diff is not a dense-color-only primitive in the TrackerNode sense — color is one of THREE
channels carrying meaning:
1. **Color** (green = add, red = remove) — industry-standard
2. **Column position** — left = old (removed), right = new (added) in side-by-side; row
   order = removed-then-added in unified
3. **Line-number presence** — removed rows have no new-side line#; added rows have no
   old-side line#

Add + `+`/`-` implied by column position → colorblind users have position + line-number
channels regardless of color perception. Safe to use `--vms-success` / `--vms-error` tokens
(the same green/red every diff tool in the industry uses — GitHub, GitLab, IDE diff panes;
familiarity is itself an a11y benefit).

⚠️ Still verify AA contrast for the NEW fg/bg pairs the tint introduces (per banked lesson:
`check:aa-contrast` covers a fixed 13-pair set — a new tint background isn't auto-covered).
Text on `color-mix(var(--vms-success) 22%, transparent)` layered over `--vms-surface`
across the default + all 12 themes needs a hand-check. Same for `--vms-error`.

## Accessibility

- Container: `<div role="table" aria-label="Diff">` (or no role — treat as generic
  structured content; row semantics don't perfectly map to HTML table semantics with this
  grid model — decide during implementation).
- Line-number cells: `aria-hidden="true"` (they're navigational aid for sighted users; the
  actual content is what a screen reader should announce).
- Row-kind: consider `aria-label` on add/remove content cells (e.g. `aria-label="Line
  added"` / `"Line removed"`) so screen readers announce the change kind, not just the
  text. Verify with real SR during implementation.

## TUI degradation

TUI renders unified mode always (columns don't fit in a terminal cleanly). `+`/`-` prefix
characters on the content, no color (or tone-based ANSI colors if the terminal supports).
Header prints as a preamble. Line numbers as left column.

## Requirement IDs

- **DIFF-01** — `DiffNode` wire type: `rows[]` + optional `mode` + optional `header`; both
  backends byte-aligned; both tree-validators descend; parity green with `expectBodyContains`
  coverage tripwires for side-by-side, unified, add, remove, context, and header cases.
- **DIFF-02** — Side-by-side renderer: 4-track CSS Grid, tint + stripe pattern, alignment
  preserved through long-line horizontal scroll; jsdom test verifies DOM shape + class
  emission per row-kind.
- **DIFF-03** — Unified renderer: 3-track CSS Grid, single left "line-number margin" for
  context rows, continuous color band for add/remove rows (stripe only on leftmost).
- **DIFF-04** — AA-contrast hand-check for new tint/text pairs across default + all 12
  themes (the fixed 13-pair gate does NOT auto-cover new fg/bg pairs — banked lesson).
- **DIFF-05** — TUI legible degradation (unified with `+`/`-` prefixes).
- **DIFF-06** — Demo usage + interactive verification page over tailnet; Ashley pre-publish
  sign-off.

## Out of the release scope

- No syntax highlighting on cell content — deferred to CodeBlockNode (bounty
  `codeblock-node`, currently on hold pending real "uncolored code hurts" signal).
- No word-level intra-line highlighting — deferred to the inline-rich-text architectural
  question (bounty `markdown-primitives-family`).

---

*Spike validation: served on the tailnet 2026-07-19; Ashley confirmed alignment approach
works, dialed in the color prominence (22% tint + 3px stripe pattern), and validated the
unified-mode single-margin collapse. Spike source under
`~/.claude/identities/vicky/bounties/diff-node/spike/` (identity-scoped scratch).*
