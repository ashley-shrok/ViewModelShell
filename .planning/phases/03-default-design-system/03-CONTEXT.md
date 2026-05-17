# Phase 3: Default Design System - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade the **already-shipped** `viewmodel-shell/styles/default.css` (458 lines) plus the minimal model/renderer surface so that importing the stylesheet alone yields a serviceable page:

- **THEME-01** — `.vms-page` becomes a centered, max-width, responsively-padded shell with zero app CSS.
- **THEME-02** — one coherent spacing scale + type scale across all node types, no per-app tuning.
- **THEME-03** — a `comfortable | compact` density control on the page.
- **THEME-04** — `section` accepts `variant: "card"` (grouped surface: bg/border/padding/radius).
- **THEME-05** — the existing `:root` CSS-variable / 11-file theme-override seam still fully reskins the UI with **zero override-seam behavior change** (regression guard).

**Out of this phase:** the layout-preset enum (Phase 4, LAYOUT-*); switching Showcase/demos onto the shipped stylesheet and the Bootstrap-benchmarked canonical set (Phase 5, EXAMPLES-*); the default-palette re-baseline (deferred — see Deferred Ideas); 0.4.0 version bump + dedicated parity fixture closeout (Phases 4–5, RELEASE-*).

</domain>

<decisions>
## Implementation Decisions

### Density & card — model surface (THEME-03, THEME-04)

- **D-01:** Both controls are **additive optional wire/model fields**, not host-set CSS: `PageNode.density?: "comfortable" | "compact"` and `SectionNode.variant?: "card"`. Field omitted ⇒ output byte-identical to today (non-breaking). Rationale: the blind app-building agent must be able to choose density/grouping from the model ("server emits intent" — PROJECT.md Core Value); host-only CSS would require human intervention, defeating the milestone.
- **D-02:** This **reframes STATE.md's loose "Phase 3 = no wire change."** The 0.4.0-*forcing* wire change is still Phase 4's layout enum; these are two small additive THEME fields that ride into the same already-accepted 0.4.0 wire bump. No separate version decision is opened here (RELEASE-01 stays Phase 5).
- **D-03:** Both fields are **closed unions** (`density?: "comfortable" | "compact"`, `variant?: "card"`), mirroring `ButtonNode.variant` / `ModalNode.size` — an enumerable contract the blind agent and AGENTS.md docs can rely on. Extend the unions deliberately later; do **not** use the open-string `ListItemNode.variant?: string` style here.
- **D-04:** Renderer emits BEM modifiers following the established pattern: `.vms-page--compact` (only when `density === "compact"`; `comfortable`/omitted emits no modifier and is byte-identical to current `.vms-page`), and `.vms-section--card` (only when `variant === "card"`). Class emission, not data-attributes.
- **D-05:** Cross-backend scope **for Phase 3 itself**: add the fields to `viewmodel-shell/src/index.ts` (types), `viewmodel-shell/src/browser.ts` (class emission), **and** `viewmodel-shell-dotnet/ViewModels.cs` (.NET records — `PageNode`/`SectionNode` gain the optional members) so the backends stay structurally aligned. A **dedicated parity fixture** exercising density/card across .NET/Bun/Node is **deferred to Phase 4 (LAYOUT-05) / Phase 5 (RELEASE-02)**. Phase 3's parity obligation is regression-only: the existing 7 fixtures stay 100% green (THEME-05).

### Spacing + type scale (THEME-02, THEME-05)

- **D-06:** Introduce new `--vms-space-*` and `--vms-text-*` CSS variables in `:root`; refactor the literal spacing/font-size values throughout `default.css` to reference them. This is **additive** to the override seam — existing `--vms-bg`/`--vms-accent`/`--vms-radius`/`--vms-font-*` overrides keep working byte-identically (THEME-05 satisfied) and the seam now also reskins rhythm.
- **D-07:** Token model = a **small named step set on a modular ratio** (≈5 spacing steps + ≈5 type steps; exact step count/names = Claude's discretion). Every current literal maps to the nearest step. Coherent and enumerable for AGENTS.md docs (Phase 5 EXAMPLES-03).
- **D-08:** **Normalization is accepted.** Snapping today's ad-hoc values (`1.5/0.75/0.375/0.3/0.4rem`, mixed-unit font sizes) to the nearest scale step *will* shift some pixels — that consolidation **is** the coherence THEME-02 requires. Showcase/demos still hand-roll `<style>` until Phase 5, so re-baselining there is expected, not a regression.
- **D-09:** Type scale is **all `rem` on a modular ratio** (unify the current `rem`+`px` mix). Respects user/browser font size and accessibility zoom; consistent with the page title already being `rem`.
- **D-10:** Density (D-04) is implemented by **remapping a few scale variables under `.vms-page--compact`** (e.g. tighter `--vms-space-*`), not by per-rule overrides. D-06's variable architecture is the prerequisite that makes this clean.

### Page shell (THEME-01)

- **D-11:** The centered container is the **existing `.vms-page` rule itself** — add `max-width`, `margin-inline:auto`, and responsive padding to it. **No DOM node, no `browser.ts` change, no new emitted class** (no AGENTS.md CSS-table churn). Shell coexists with the flex-column `gap` rhythm already on that element.
- **D-12:** Default max content width ≈ **1080px**, exposed as a `--vms-page-max` variable (per D-06's variable discipline) so themes/apps can retune.
- **D-13:** Responsive horizontal padding via **`clamp()`, zero media queries** (e.g. `padding-inline: clamp(...)` with bounds tied to `--vms-space-*` steps). The codebase has zero media queries today; this preserves that and matches the framework ethos (LAYOUT-02/03 forbid app-specified breakpoints).
- **D-14:** `.vms-page` **stays transparent**; `body` keeps carrying `--vms-bg`/color/font exactly as today. Shell = pure layout (width/center/pad). Color behavior stays byte-identical (THEME-05-safe) and avoids double-surface nesting against `.vms-section--card` (THEME-04).

### Default visual identity (THEME-01/02 quality bar)

- **D-15:** The default **palette is frozen in Phase 3** — structural work only (shell + scale + density + card). Default color values stay byte-identical, with the single exception in D-17.
- **D-16:** **Directional intent (deferred to Phase 5, not acted on here):** re-baseline the shipped default to a neutral light palette, demoting today's dark-purple to a theme file (the seam already supports 5 dark / 6 light theme files). The call is made in Phase 5 (EXAMPLES-01) with the Showcase visible against Bootstrap. Captured in Deferred Ideas.
- **D-17:** "Serviceable" gets a concrete, testable floor: the shipped default **must meet WCAG AA text contrast** for body and muted text. Today `--vms-text-muted #6b6b80` on `--vms-surface #18181c` is borderline. **Reconciliation with D-15:** tightening *that specific default variable value* to pass AA is in-scope this phase and is **NOT** an override-seam behavior change — the variable still exists, themes still override it; only the shipped default value tightens. "Frozen palette" means no wholesale re-skin (D-16 stays deferred), not "ship a default that fails AA."

### Claude's Discretion

- Exact step count, names, and modular ratio for `--vms-space-*` / `--vms-text-*` (D-07).
- Exact `--vms-page-max` value within "≈1080px app width" and the exact `clamp()` bounds (D-12, D-13).
- Exact card surface treatment for `.vms-section--card` — bg/border/padding/radius values, whether `.vms-section__heading` restyles inside a card, nesting behavior — provided it reads as a grouped surface and stays AA-contrast (D-04, D-17).
- Exact compact-mode variable deltas (D-10).
- Exact AA-passing value for the tightened muted-text default (D-17).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & locked decisions
- `.planning/REQUIREMENTS.md` — THEME-01..05 acceptance criteria (Theme section); the "no override-seam behavior change" wording of THEME-05
- `.planning/ROADMAP.md` §"Phase 3: Default Design System" — the 5 success criteria; the "Depends on Phase 2 (0.3.13 baseline)" note
- `.planning/PROJECT.md` — Core Value (platform-agnostic, blind-agent rationale), Key Decisions ("appearance is 100% CSS / override seam untouched"; "layout intent in model, not CSS-only"), Constraints (no wire/API break; parity gate), Out of Scope ("global `*` reset rejected — stylesheet is opt-in")
- `.planning/STATE.md` — §Architectural Notes (the "Phase 3 = no wire change" framing that D-02 explicitly reframes; "parity is the highest-signal gate")

### Implementation targets
- `viewmodel-shell/styles/default.css` — the 458-line stylesheet refactored: `:root` gains `--vms-space-*`/`--vms-text-*`/`--vms-page-max`; `.vms-page` gains shell rules; `.vms-page--compact` + `.vms-section--card` added; literals → scale variables
- `viewmodel-shell/styles/themes/*.css` — the 11 theme override files (`:root` color overrides only); THEME-05 regression surface — these must keep reskinning byte-identically (do NOT add per-theme spacing unless intentional)
- `viewmodel-shell/src/index.ts` — `PageNode` (line 59) gains `density?`; `SectionNode` (line 65) gains `variant?`; closed-union typing per D-03
- `viewmodel-shell/src/browser.ts` — page render (~line 196) emits `vms-page--compact`; section render (~line 209) emits `vms-section--card`; follow the existing ``${n.variant ? ` vms-x--${n.variant}` : ""}`` idiom (see list-item line 230, button 459, modal 536)
- `viewmodel-shell-dotnet/ViewModels.cs` — `PageNode` (~line 99) / `SectionNode` (~line 104) records gain the matching optional members (.NET structural alignment per D-05; existing records already carry `string? Variant` precedents at lines 116/150/192)

### Verification & docs
- `parity/run.ts` + `parity/normalize.ts` — the 7-fixture cross-backend harness; Phase 3 obligation is regression-only (stays green). NOTE: parity diffs the **wire JSON**, not computed CSS — D-08's rhythm normalization has **no parity surface**. The new `density`/`variant` wire fields, when omitted, must serialize byte-identically to today.
- `viewmodel-shell/test/adapter-seam.test.ts`, `viewmodel-shell/vitest.config.ts` — existing jsdom/vitest harness (~97 frontend tests). RESEARCH ITEM: confirm no existing test asserts computed pixel values that D-08 normalization would break; new jsdom tests for density/card-variant class emission belong here (no browser runtime).
- `AGENTS.md` — §"Node types" table (lines ~101–111) and §"CSS classes emitted by BrowserAdapter" table (lines ~137–155): `page`/`section` rows need the new `density`/`variant` + `.vms-page--compact`/`.vms-section--card`. Full doc polish is Phase 5 EXAMPLES-03; Phase 3 keeps these tables accurate for the fields it ships.
- `viewmodel-shell-dotnet/ViewModels.cs` §`JsonDerivedType` registrations (lines ~81–82) — confirm serialization shape parity for the new optional members.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Established variant/modifier pattern** — `ListItemNode.variant?` → `vms-list-item--{x}`, `ButtonNode.variant?: "primary"|...` (closed), `ModalNode.size?` → `vms-modal--{size}`, `TableNode` row `variant`. Density (D-04) and card (D-04) slot directly into this idiom; no new plumbing concept.
- **CSS-variable theme architecture** — `:root` already drives color/radius/font; the 11 theme files override only those. D-06's `--vms-space-*`/`--vms-text-*` extend the *same* mechanism (additive, THEME-05-safe).
- **Scoped box-sizing subtree** — the existing `.vms-page, .vms-page *` scoped reset (default.css:62–71) already establishes `.vms-page` as the framework's owned root, which is exactly why the shell lives there (D-11) and not on `body`.
- **.NET record `string? Variant` precedent** — `viewmodel-shell-dotnet/ViewModels.cs` already has `string? Variant` on multiple records (lines 116/150/192); the new `PageNode`/`SectionNode` members follow it.

### Established Patterns
- **Optional field, default = byte-identical** — every prior additive node field defaulted to the prior behavior; D-01/D-04 follow this (omitted density/variant emits no modifier).
- **Verification = parity (wire) + jsdom/vitest (DOM)** — the "no real browser for tests" promise (Phase 1/2 discipline). New behavior gets jsdom unit tests, not browser tests.
- **Discipline: don't "improve" adjacent surfaces** — Phase 1/2 repeatedly locked "preserve the exact signature/rule while you're in there." Applies here to the override seam: existing `:root` variable names/semantics stay byte-identical; only *add* `--vms-space-*`/`--vms-text-*`/`--vms-page-max`.

### Integration Points
- `default.css` `:root` block (lines 17–42) — where new scale/page-max variables are added.
- `default.css` `.vms-page` (line 74) — where shell rules (D-11/D-12/D-13) and the `.vms-page--compact` remap (D-10) attach.
- `default.css` `.vms-section` (line 85) — where `.vms-section--card` (D-04) attaches.
- `browser.ts` page/section render functions — the only renderer changes (two modifier-emission lines).
- `index.ts` + `ViewModels.cs` `PageNode`/`SectionNode` — the only type/model changes (two optional members each, both backends).

</code_context>

<specifics>
## Specific Ideas

- **Bootstrap is a visual *benchmark*, never a CSS dependency** (PROJECT.md / REQUIREMENTS Out of Scope) — the `.vms-*` semantic-class contract makes external frameworks a poor fit. Any "looks like Bootstrap" intent (D-16) means *quality parity on the Showcase*, not adopting Bootstrap classes/CSS.
- **"Serviceable" must be falsifiable for a blind pipeline** — hence the explicit WCAG AA contrast floor (D-17). The whole milestone exists because the only entity that could eyeball ugliness (the app-building agent) cannot see; subjective quality bars don't survive that, testable ones do.
- **The density mechanism is downstream of the scale-as-variables decision** — D-10 only works because of D-06. A planner must sequence: scale variables first, then density as a variable remap.

</specifics>

<deferred>
## Deferred Ideas

- **Default-palette re-baseline to neutral light (dark-purple → theme file)** — directional intent recorded (D-16); decided and executed in **Phase 5 (EXAMPLES-01)** with the Showcase benchmarkable against Bootstrap. Not acted on in Phase 3 (palette frozen, D-15).
- **Dedicated cross-backend parity fixture for `density`/`variant`** — rides with **Phase 4 LAYOUT-05 / Phase 5 RELEASE-02** (D-05). Phase 3 only keeps the existing 7 fixtures green.
- **Inner `.vms-page__content` wrapper element** (for future full-bleed sections) — rejected for Phase 3 (D-11 keeps the shell on `.vms-page`, no DOM/renderer change). Revisit only if a real full-bleed need emerges, likely alongside Phase 4 layout work.
- **AGENTS.md full doc polish for presets/density/card** — Phase 5 EXAMPLES-03. Phase 3 keeps the node/CSS tables merely *accurate* for the fields it ships.
- **0.4.0 npm+NuGet version bump** — Phase 5 RELEASE-01. Phase 3 adds the wire fields but does not bump versions.

### Reviewed Todos (not folded)
None — `todo match-phase 3` returned 0 matches.

</deferred>

---

*Phase: 03-default-design-system*
*Context gathered: 2026-05-17*
