# Phase 23: v8.0 Foundations — Context

**Gathered:** 2026-07-29
**Status:** Ready for planning
**Source:** Direct from operator conversation + before/after tasting served on tailnet + approved as the first phase of the v8.0.0 Composite-Nodes Layer milestone.

> ⚠️ **PLANNER: READ THE APPROVED TASTING FIRST.** The tasting page at `bounties/composite-nodes-layer/tasting-page/index.html` (served during the design conversation at `http://100.113.23.63:8182/`) is the design of record for the ENTIRE milestone. Sections 8 (`AvatarNode`) and the "Adjacent seams" bottom block are the direct source for Phase 23's foundations. Every design decision below is grounded there with a working mockup. Do not re-derive; do not re-litigate; do not "improve" a decision that was eyeballed and approved. Also read `AGENTS.md` "Working agreement" — every publish gate applies; but note that **Phase 23 does NOT ship a release** (batch-then-ship with the rest of the milestone at Phase 26).

<domain>
## Phase Boundary

Land the **4 foundation additions** every downstream composite in the v8.0.0 milestone depends on. This is the "dependencies-first" wave — TextNode grows a third typographic tier + a weight axis; CheckboxNode grows a visual switch variant; a new standalone `AvatarNode` primitive lands. Phase 24-26 build the actual composite recipes on top of these; without them the composites can't render the trained typography + control shapes they promise.

Everything additive — no wire breaks; old renderers gracefully degrade on unknown closed-union values (a `.vms-text--caption` class with no CSS falls back to unstyled `.vms-text`, a `.vms-field--switch` falls back to the standard checkbox render). Backend-newer-than-frontend is the risky direction (banked lesson) but ADDITIVE fields are safe.

**In scope:**
- `TextNode.style: "caption"` — closed-union extension. Renders `.vms-text--caption` at `var(--vms-text-xs)` size, muted color, ~0.85 opacity. The 3rd typographic tier the composite row shapes need.
- `TextNode` weight axis — semi-bold body-size weight variant. Shape TBD in planning (see design questions below).
- `CheckboxNode.variant: "switch"` — visual-only render mode. Emits `.vms-field--switch`; wire and semantics unchanged (still boolean, still `bind`/change dispatch).
- `AvatarNode` — standalone primitive. Circular slot; content-resolution priority image > initials > icon > empty; closed size + tone axes; a11y `alt?` slot.
- Both TS + .NET wire types byte-identical, both tree-validators descend (AvatarNode has no children so tree-descent is a no-op; the other three are on existing nodes).
- Parity FeatureProbe `buildVm` extended in all 3 backends (v5.1 pattern — EXTEND, not new fixture; `$comment` clause appended). `expectBodyContains` coverage tripwires per addition (banked lesson: a diff can only prove things about code it actually RUNS).
- AA-contrast hand-check for the new fg/bg pairs each addition introduces (banked lesson: fixed 13-pair `check:aa-contrast` gate does NOT auto-cover new pairs).
- Vitest + .NET tests for each addition (rendering, tree-validation, wire round-trip).
- Showcase demo adoption (per fleet-adoption discipline; `UseVmsShellStaticFiles` lesson — helpers don't ship without demo adoption).
- `.planning/design/composite-nodes-layer.md` — the DESIGN OF RECORD doc for the whole v8.0.0 milestone (written in this phase; referenced by 24-26).
- Initial AGENTS.md "Route B composite-nodes layer" governance section — the earn-a-composite rule + the typed-slots pattern. Grows in Phase 24-26.

**Out of scope (deferred — do NOT build in Phase 23):**
- **All 10 composites** (ListRow, Message, Alert, EmptyState, UserRow, DetailRow, Timeline, Setting, Chip+ChipList) — Phase 24-25.
- **Release ship** — v8.0.0 publishes at Phase 26 closeout, NOT here. CHANGELOG entries accumulate under an "Unreleased" section during Phase 23-25.
- **Multiple avatar shapes** (square, rounded-square). Circular only for v1; other shapes require an axis and evidence.
- **Avatar image loading states** (skeleton, error fallback). Ship the image path as `<img src="..." alt="...">`; browser handles load. If image fails, no fallback — that's a downstream concern.
- **Switch variant on other input types** (radio-as-switch, etc.). Only checkbox for v1.
- **TUI degradation** for the new additions. TUI drops caption+switch+avatar entirely for v1 (@experimental scope, not-invested-in per standing directive).
</domain>

<decisions>
## Locked Decisions

All approved via the tasting served on 2026-07-29 (Ashley signed off after eyeballing before/after side-by-side).

### 1. `TextNode.style: "caption"` — closed-union extension (LOCKED)

- Extend the existing closed union: `"heading" | "subheading" | "body" | "muted" | "strikethrough" | "pre"` → adds `"caption"`.
- CSS: `.vms-text--caption { font-size: var(--vms-text-xs); color: var(--vms-text-muted); opacity: 0.85; line-height: 1.4; }`
- Byte-identical across TS/.NET; .NET enum gets the new value; STJ converter handles round-trip.
- Rationale: the mockup at `bounties/composite-nodes-layer/tasting-page/index.html` (Option 1+ column) proved via scoped host CSS that adding a text-xs tier makes list rows read like modern web list rows. Every composite that stacks meta lines consumes this (`ListRowNode.meta[]`, `MessageNode.timestamp`, `TimelineEntryNode.time`).
- **NOT rendering as anything other than a `<span>`** — same DOM shape as other TextNode styles; only the class modifier + CSS differ.

### 2. `TextNode` weight axis — DESIGN QUESTION for planner (semi-locked)

Two candidate shapes; planner picks under Ashley review:

**Option A: `weight?: "regular" | "medium" | "bold"` — new axis.**
- Pros: orthogonal to `style`; a `body`-styled TextNode can be `weight: "medium"` without becoming a heading. Composable.
- Cons: adds a new field to the wire; more surface.
- Recommended: closed enum on .NET per closed-union-must-be-enum maintainer rule.

**Option B: `style: "strong"` — closed-union extension (like `caption`).**
- Pros: no new field; smaller wire footprint; mirrors the `caption` pattern above.
- Cons: `style` conflates weight with typographic role — `strong` is more about weight than about being a specific typographic level.
- Renders `.vms-text--strong { font-weight: 500 }` (or 600 — TBD in planning).

**Recommendation from tasting-time context:** Option A. The compositing needs are clearer — a `ListRowNode.primary` slot wants body-sized-medium-weight, which composes cleanly as `TextNode { style: "body", weight: "medium" }`. Option B forces the same result but through style-value overloading. But planner has authority to pick either after weighing surface-cost.

- CSS keyed off whichever shape ships; `.vms-text--strong` OR `.vms-text--medium` / `.vms-text--bold` per outcome.

### 3. `CheckboxNode.variant: "switch"` — closed-enum on the checkbox variant field (LOCKED)

- Wire: `variant?: "checkbox" | "switch"` (omitted / `"checkbox"` = today's render, byte-identical).
- Semantics unchanged: value is still boolean, dispatch is still `bind`/change on the underlying `<input type="checkbox">`.
- Visual: renders the same `<input>` but with `.vms-field--switch` modifier that CSS-styles it as a slider track + thumb.
- A11y: still a real `<input type="checkbox">` — screen readers announce "switch" via `role="switch"` (added by renderer when `variant:"switch"`), keyboard toggles via Space (native), Tab traversal unchanged.
- Fallback: older adapter renders as normal checkbox on unknown variant — graceful degradation.
- CSS: the switch look-and-feel comes from the mockup in the tasting page under COMPOSITE #9 (`SettingRowNode`). Same visual approach: 2.5rem × 1.5rem track, thumb translates on toggle, tone-accented in on-state.

### 4. `AvatarNode` — standalone primitive (LOCKED)

**Wire shape:**
```typescript
export interface AvatarNode {
  type: "avatar";
  initials?: string;                                  // shown when no image
  image?: string;                                     // URL; takes precedence over initials
  icon?: IconName;                                    // fallback when neither initials nor image
  size?: "sm" | "md" | "lg" | "xl";                   // closed enum — 1.5/2/2.5/3rem
  tone?: "danger" | "warning" | "success" | "info";   // background palette (initials/icon mode only)
  alt?: string;                                       // a11y — screen-reader announcement
}
```

**Rendering priority:**
1. If `image` set → `<img src="..." alt="{alt}" class="vms-avatar vms-avatar--{size}">` (background hidden by the image).
2. Else if `initials` set → `<div class="vms-avatar vms-avatar--{size} vms-avatar--{tone}" role="img" aria-label="{alt || initials}">{initials}</div>`.
3. Else if `icon` set → `<div class="vms-avatar vms-avatar--{size} vms-avatar--{tone} vms-avatar--icon" role="img" aria-label="{alt}">{iconSvg}</div>` (uses Phase 22 icon rendering).
4. Else → empty circle (no visual content) with `role="img"` + `aria-label={alt || ""}`.

**Size mapping** (design-doc §to-write):
- `sm`: 1.5rem (24px) — inline in dense lists, small mention picker
- `md`: 2rem (32px) — DEFAULT; comment threads, user rows, chat messages
- `lg`: 2.5rem (40px) — larger message headers, expanded user cards
- `xl`: 3rem (48px) — profile displays, empty-state or hero contexts

**Tone**: applies to `initials`/`icon` modes only; sets the circle background via `--vms-*` tone tokens. Consistent with the tasting mockup's approach.

**Font sizing for initials**: proportional to avatar size — sm=0.6875rem, md=0.8125rem, lg=0.9375rem, xl=1.0625rem (from the tasting CSS).

**Font weight**: 600 (semibold) — trained for legibility at all sizes.

**Border-radius**: 999px (fully round) — no square/rounded-square variants for v1.

**Both TS/.NET carry `[JsonIgnore(WhenWritingNull)]`** on every optional nullable per gotcha #8.

Consumed by:
- `UserRowNode` (Phase 25) — leading slot
- `MessageNode` (Phase 24) — leading slot
- `ChipNode` (Phase 25) — optional leading if a user chip
- Standalone use in mention pickers, assignee columns, comment threads, "who's viewing" indicators.

### 5. Milestone-level: batch-then-ship (LOCKED)

Phase 23 does NOT release. CHANGELOG entries accumulate under an "Unreleased" section during Phases 23-25. v8.0.0 publishes at Phase 26 closeout with all 10 composites + 3 wire tweaks in one aligned release. Per Ashley's "batch features ship once" default + the milestone's coherence argument.

### 6. `.planning/design/composite-nodes-layer.md` — write in this phase (LOCKED)

The design-of-record doc for the whole v8.0.0 milestone. Consumed by Phase 24-26 planners. Should contain:
- The Route A / Route B thesis
- The governance rule (earn-a-composite bar is visual)
- The typed-slots pattern that unifies every composite's schema
- The 10 composites at a glance (names + slot summaries — the schemas already in the tasting page)
- The 3 wire tweaks
- Layered adoption order (foundations → primary → secondary → adoption)
- Fleet-adoption discipline reference
- AA-contrast + parity + testing conventions the milestone follows

Write it early in Phase 23 so it's canonical for the entire milestone.

### 7. AGENTS.md "Route B composite-nodes layer" governance section (LOCKED)

Add to `AGENTS.md` under "Conventions for evolving the framework" — after the existing "Don't add features the framework doesn't have a clean place for" clause. Contents:

- **The Route A / Route B split** — Route A = primitive axes + open composition; Route B = pre-made composite recipes with typed slots.
- **The governance rule** — earn a composite when primitives-alone give a "pretty bad approximation." Bar is visual — the after has to look right; the before has to look wrong. Judgment per shape, eyeballed against a served tasting.
- **The typed-slots pattern** — every composite is `{ leading?, primary/heading, secondary/description?, meta?, trailing?, tone?, state? }`-shaped. Each slot accepts a full ViewNode subtree; the recipe owns layout/typography/spacing.
- **Two failure modes to guard against** — bloated grab-bag (high bar for new recipes); too-rigid recipe (typed slots stay unconstrained-content, axes stay closed enums).
- **The precedent** — MUI `ListItemText`, Ant `List.Item.Meta`, Chakra `Card` composites, Phoenix LiveView slots, Blazor Razor typed content. Every server-driven peer surveyed ships this layer.
- **Recipes coexist with primitives** — consumers with a shape the framework didn't foresee still drop to primitives and compose. Recipes never DEPRECATE primitives.

Grow the section as Phases 24-26 land — the "current recipe inventory" table stays live.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design of record
- `bounties/composite-nodes-layer/tasting-page/index.html` — the approved before/after tasting (served 2026-07-29). Sections #8 (AvatarNode), #9 (SettingRowNode — informs switch variant), and the bottom "Adjacent seams" block are the direct source for Phase 23's foundations. **READ IN FULL** before planning.
- `.planning/design/composite-nodes-layer.md` — to be written in this phase. Once written, it supersedes the tasting page as the design of record for Phase 24-26.

### Framework conventions (this repo)
- `AGENTS.md` — every gotcha applies. **Especially:**
  - Gotcha #8 (null omission — `WhenWritingNull` on every nullable, and `WhenWritingDefault` on optional non-nullable bools like `variant`).
  - Working agreement — green-tree gate (`npm run build && check:test-types && check:core-globals && check:aa-contrast && check:no-demo-style && check:demo-types && npx vitest run` + `.NET tests + parity + every demo `*.Tests.csproj`) before push. Phase 23 does NOT publish, so no publish ritual, but every gate must be green before commit lands.
  - Fleet-adoption discipline — helpers ship WITH demo adoption in the same batch (banked from `UseVmsShellStaticFiles` 6.7.0 fire).
  - Parity fixture discipline — `parity/run.ts` is the wire diff + `expectBodyContains` invariants; a diff can only prove things about code it actually RUNS.
  - Closed-union-must-be-enum on .NET (banked from 6.0.0 migration).

### Existing framework patterns Phase 23 extends
- `viewmodel-shell/src/index.ts:934-970` (approx) — TextNode current shape; the extension point for `style: "caption"` and the weight axis.
- `viewmodel-shell/src/index.ts` — CheckboxNode / FieldNode `inputType:"checkbox"` current shape; the extension point for `variant: "switch"`.
- `viewmodel-shell/src/browser.ts` — TextNode + FieldNode renderers; the swap points.
- `viewmodel-shell/styles/default.css:1123-1130` — `.vms-text--*` current CSS; where `.vms-text--caption` + weight variants land.
- `viewmodel-shell-dotnet/ViewModels.cs` — .NET twin for TextNode, CheckboxNode/FieldNode. AvatarNode adds a new record.
- `parity/backends/*/buildVm.ts` (and .NET equivalents) — the 3 FeatureProbe backends that need extension per addition.
- `demo/Showcase/frontend/src/main.ts` — where the Foundations demo tab lands.

### Phase 22 (upstream — v7.0 icons) shipped artifacts we consume
- `IconName` closed union in `viewmodel-shell/src/index.ts` — AvatarNode's `icon?: IconName` slot uses this.
- Icon renderer in `viewmodel-shell/src/browser.ts` — AvatarNode's icon-mode calls into this to draw the fallback icon.
- Icon-only ButtonNode a11y rule pattern — AvatarNode follows the same pattern: `role="img"` + `aria-label`; if content is decorative-only, `aria-hidden`.
</canonical_refs>

<specifics>
## Specific Ideas

### Testing depth per addition

Each addition needs FAIL-before/PASS-after mutation-tested tests, not just green assertions. Banked lesson: "verify by mutation, not by assertion" (from the 6.0.0 enum migration + the icon-only-button validator).

**COMP-01 caption:** vitest asserts `.vms-text--caption` class emission + CSS-computed `font-size` at text-xs; mutation-test by breaking the class emission (revert the switch arm, watch test fail).

**COMP-02 weight:** whichever shape ships, vitest asserts class emission + CSS-computed `font-weight`; mutation-test the same way.

**COMP-03 switch variant:** vitest asserts `.vms-field--switch` class emission + `role="switch"` attribute on the input; mutation-test each.

**COMP-04 AvatarNode:** vitest asserts the priority resolution (image > initials > icon > empty), the size class emission, the tone class emission (for initials/icon modes only, not image mode), and the a11y attribute set (`role="img"` + `aria-label` on non-image modes). Tree-validator test: `AvatarNode` with invalid `size` value → `invalid_tree`.

### AA-contrast hand-check checklist

The fixed 13-pair `check:aa-contrast` gate does NOT auto-cover new pairs (banked lesson). Hand-check for Phase 23:

- **Caption text:** text-xs muted-color + 0.85 opacity against `--vms-bg` and `--vms-surface` on default + all 12 themes. Target: ≥4.5:1 (AA-normal for text-xs / body text).
- **Switch on-state:** thumb color against on-state track color (accent-tinted). Target: ≥3:1 (graphical UI state indicator per WCAG 1.4.11 — but ONLY because state is ALSO carried by aria-checked, per the TrackerNode precedent).
- **Switch off-state:** thumb color against off-state track color (muted-tinted). Same target.
- **Avatar initials text:** white (or `--vms-surface` per the KNOCKOUT pattern from v5.1 steps marker) against every tone background (`--vms-danger`, `--vms-warning`, `--vms-success`, `--vms-info`) on default + all 12 themes. Target: ≥4.5:1 (AA-normal for readable text at avatar sizes). Sm size (0.6875rem = ~11px) is smaller than AA-normal 14px — check separately; may need weight-boost or tone deepening.
- **Avatar icon-mode:** same as initials but for the icon foreground (`currentColor` inside the tone-tinted circle).

Any failing pair → deepen the failing tone via `color-mix(in srgb, var(--vms-X) N%, #000)` per the shipped v3.5.0 pattern. If tone-deepening breaks tone recognizability, use the KNOCKOUT pattern (draw text/icon in `--vms-surface` for polarity-adaptive contrast — banked from the v5.1 steps marker).

### Parity FeatureProbe extension

Per the shipped v5.1 pattern: EXTEND `buildVm` in ALL 3 backends (dotnet, bun, dotnet-companion or whatever the 3 are — planner will confirm from `parity/backends.json`). NOT a new fixture file; NOT a `backends.json` change.

The `$comment` clause at the top of the relevant fixture describes what buildVm exercises — appended per addition:
- `"COMP-01 caption": tests TextNode style:"caption" rendering + class emission`
- `"COMP-02 weight": tests TextNode weight variance rendering + class emission (shape TBD)`
- `"COMP-03 switch": tests CheckboxNode variant:"switch" rendering + role attribute`
- `"COMP-04 avatar": tests AvatarNode at all 4 sizes × 3 content modes (initials/image/icon) × tones for the initials/icon paths`

Every buildVm case emits a substring that ONLY that branch produces (`expectBodyContains` tripwires) so a fixture step that stops exercising its branch fails LOUDLY, not vacuously (banked lesson from the 6.0.0 seeded-helpdesk fix).

### Demo adoption locations

- **Showcase demo (`demo/Showcase/frontend/src/main.ts`):** add a tab called "Foundations" (or a section under a future "Composites" tab) showing:
  - Caption tier: a real TextNode with `style: "caption"` next to a `body` and a `muted` for visual comparison.
  - Weight: a heading demonstrating the semi-bold body-size weight (whichever wire shape ships).
  - Switch: 3 CheckboxNodes with `variant: "switch"` in various on/off states within a mini SettingsRow-like layout.
  - Avatar: a grid of AvatarNodes at every size × content-mode × tone permutation.
- **Other demos:** none required for Phase 23 (foundations are inert without composites). Phase 24-26 will bring wider demo adoption.

### CHANGELOG entry (accumulate under "Unreleased")

The `CHANGELOG.md` at repo root has an "Unreleased" heading; Phase 23's additions go under it. Format:

```md
## Unreleased — v8.0.0 (in progress)

### Added
- `TextNode.style: "caption"` — the 3rd typographic tier (text-xs, muted, opacity). (COMP-01)
- `TextNode` [weight axis TBD] — semi-bold body-size weight variant. (COMP-02)
- `CheckboxNode.variant: "switch"` — visual switch-slider render mode; wire and semantics unchanged. (COMP-03)
- `AvatarNode` — new standalone primitive; circular slot with initials/image/icon content-resolution priority, closed size + tone. (COMP-04)
```

MIGRATION.md gets an entry too but the note is trivial ("all additions are additive; no changes required for existing consumers").
</specifics>

<deferred>
## Deferred Ideas

- **Multiple avatar shapes** (square, rounded-square). Circular only for v1; add an axis if a real signal arrives.
- **Avatar image loading skeleton / error fallback.** Ship `<img src alt>` and let the browser handle it; failing image = broken image icon (default browser behavior). If evidence surfaces later, adjust.
- **Switch variant on other input types** (radio-as-toggle, etc.). Only checkbox for v1.
- **TUI degradation for caption / weight / switch / avatar.** TUI drops these entirely for v1 (@experimental, not-invested-in per standing directive).
- **AGENTS.md "current recipe inventory table"** — will land in Phase 24 when the first primary composites ship. Phase 23 lands the governance section without the inventory.
- **Composite-node design doc's per-composite sections** — Phase 24-26 will fill these in as each composite is planned. Phase 23 writes the shared frame (thesis, rule, typed-slots pattern, adoption order).
</deferred>

---

*Phase: 23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode*
*Context gathered: 2026-07-29 direct from operator conversation + approved tasting.*
