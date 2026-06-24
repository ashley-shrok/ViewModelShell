# Phase 9: Switcher + Cards minItem - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning
**Source:** Authored by orchestrator from the locked design doc (`.planning/design/layout-system-research.md`) + the Phase 8 precedent. Decisions below are LOCKED.

<domain>
## Phase Boundary

Add the **`switcher`** layout primitive (atomic all-row ↔ all-stack flip via negative-`flex-basis`, the one completeness primitive a grid provably cannot express) and promote the CSS-only **`--vms-card-min`** to an explicit bounded **`minItem`** wire field on the `cards` layout. Both land byte-identically in TS + .NET with parity coverage and a minimal demo.

IN SCOPE: `switcher` layout value + its `threshold`/`limit` bounded params; `cards` `minItem` bounded token; CSS; renderer emission; parity fixture; minimal Showcase demos for both; AGENTS.md `switcher` becomes "shipped" (it was forward-referenced in the Phase 8 Layout policy).
OUT OF SCOPE: the `fits` node (Phase 10); the comprehensive demo spread + real-app compositions (Phase 11). **Release is DEFERRED** — this milestone batches the bump+publish at Phase 11; accumulate CHANGELOG under the existing `## Unreleased` heading, do NOT bump `package.json`/`.csproj` versions, do NOT publish.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### `switcher` layout (SWITCH-01/02)
- Extend the `layout` closed union on BOTH `PageNode` and `SectionNode` (TS `viewmodel-shell/src/index.ts`) from `"stack" | "split" | "cards" | "sidebar" | "row"` to also include **`"switcher"`**. .NET side is the free-form `string? Layout` (already accepts it; no change needed beyond the doc-comment mention).
- **Mechanism (Every-Layout Switcher, zero `@media`):** the element gets `display:flex; flex-wrap:wrap;` and its direct children get `flex-grow:1; flex-basis: calc((var(--vms-switch-threshold, 30rem) - 100%) * 999);`. Above the threshold the basis goes hugely negative → clamped to 0 → all children share one row; below it the basis goes hugely positive → each child takes a full line → all stack. Atomic, no partial-wrap state. Mirror the existing `.vms-page--sidebar`/`.vms-section--sidebar` CSS block idiom (default.css ~L197+) for structure + comment style. Title/heading keep their own full-width row (`flex: 0 0 100%`), same as the other presets.
- **`threshold` (bounded token, SWITCH-02):** a new optional field `threshold?` on `PageNode`/`SectionNode` — a CLOSED size scale (NOT raw CSS, per P2). Locked scale → CSS rem values, emitted as a modifier class `vms-switch--{token}` that sets `--vms-switch-threshold`:
  - `"sm"` → 20rem, `"md"` → 30rem, `"lg"` → 40rem, `"xl"` → 48rem.
  - Omitted `threshold` = no class = the `var(--vms-switch-threshold, 30rem)` fallback (30rem default). So omitted is well-defined.
- **`limit` (bounded int, SWITCH-02, optional):** a new optional field `limit?` typed as a closed numeric union — `2 | 3 | 4 | 5 | 6 | 7 | 8` (TS); `int? Limit` on .NET. Emits `vms-switch-limit--{n}`. CSS uses a quantity query per value: `.vms-switch-limit--{n} > :nth-last-child(n+{n+1}), .vms-switch-limit--{n} > :nth-last-child(n+{n+1}) ~ * { flex-basis: 100%; }` (forces vertical when the child count exceeds `n`, regardless of width). One static rule per allowed `n`. Omitted = no class = no count cap.

### `cards` `minItem` (GRID-01)
- Add an optional field **`minItem?`** on `PageNode`/`SectionNode` — a CLOSED size scale that overrides the auto-fit minimum track width (today the fixed `--vms-card-min: 16rem`, default.css L72 + the auto-fit rule L156). Emitted as a modifier class `vms-cards-min--{token}` that sets `--vms-card-min` on that element (the existing `repeat(auto-fit, minmax(min(var(--vms-card-min),100%),1fr))` rule reads it). Locked scale:
  - `"xs"` → 10rem, `"sm"` → 13rem, `"md"` → 16rem (= today's default), `"lg"` → 20rem, `"xl"` → 24rem.
  - Omitted `minItem` = no class = the inherited `--vms-card-min: 16rem` default (byte-identical to today). Intended for `layout:"cards"`; harmless elsewhere (it only sets a variable the cards rule reads).

### Fields summary (both PageNode + SectionNode, TS interfaces + .NET records)
- `threshold?: "sm" | "md" | "lg" | "xl"` (TS) / `string? Threshold = null` (.NET) — switcher flip width.
- `limit?: 2 | 3 | 4 | 5 | 6 | 7 | 8` (TS) / `int? Limit = null` (.NET) — switcher max-per-row.
- `minItem?: "xs" | "sm" | "md" | "lg" | "xl"` (TS) / `string? MinItem = null` (.NET) — cards min track.
- All nullable, all `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` on .NET, mirroring the Phase 8 `Arrange`/`Align` pattern exactly. Document each with the same doc-comment idiom as `arrange`/`align`/`density`, naming which layout it applies to + the byte-identical-when-omitted guarantee.

### Renderer (browser.ts)
- Emit `vms-switch--{threshold}`, `vms-switch-limit--{limit}`, and `vms-cards-min--{minItem}` modifier classes via the same presence-check chained-ternary idiom Phase 8 used for `vms-arrange--`/`vms-align--`, on the SAME element carrying the `vms-*--{layout}` class, in ALL page/section className builders (page, collapsible, flyout, link, base section). Omitted field → no class (byte-identical guarantee).

### Parity (SWITCH-03 / GRID-02)
- Widen the FeatureProbe fixture (both backends — `demo/FeatureProbe-bun/handler.ts` + `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`) with static view-shape sections (mirror the Phase 8 precedent — no new action arm needed): a `switcher` section (+ one with `threshold`, one with `limit`), and `cards` sections exercising each `minItem` value, plus a bare `cards`/`switcher` (no token) to prove omitted = absent on the wire. Update the fixture `$comment`. `bun run parity/run.ts` byte-identical green across .NET/Bun/Node.

### Demo (incremental — minimal; full spread is Phase 11)
- Add to `demo/Showcase/frontend/src/main.ts` (zero `<style>`): a `switcher` row of ~4 equal cards labeled so the reviewer can resize and see the atomic flip, and a `cards` block showing 2-3 `minItem` values side-by-side. Minimal — comprehensive review is Phase 11.

### Docs
- Update the AGENTS.md Layout policy `switcher` mention from "arrives in Phase 9 (forward reference)" to shipped (drop the forward-reference caveat). Keep the concern→source convention (don't enumerate the token scales in a drift-prone way — point at the type source).

### Release — DEFERRED (no per-phase publish)
- Accumulate notes under the existing `## Unreleased` CHANGELOG heading (add a `### Switcher + cards minItem — Phase 9` subsection). Do NOT bump `package.json`/`.csproj`. Do NOT publish/tag. The consolidated bump+publish is Phase 11.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design rationale
- `.planning/design/layout-system-research.md` — the Switcher mechanism (negative-flex-basis), the auto-fit `minItem` model, why these are intrinsic/zero-breakpoint.

### Code anchors
- `viewmodel-shell/src/index.ts` — PageNode (~L114-126) + SectionNode (~L126-140) now carry `arrange`/`align` (Phase 8); add the new fields after them, same idiom. The `layout` union is on both.
- `viewmodel-shell/styles/default.css` — `--vms-card-min` token (L72), `.vms-page--cards`/`.vms-section--cards` auto-fit rule (L153-159), the `.vms-page--sidebar`/`.vms-section--sidebar` flex-wrap block (~L197+) as the switcher structural analog, and the Phase 8 `.vms-arrange--*`/`.vms-align--*` rules as the modifier-class precedent.
- `viewmodel-shell/src/browser.ts` — the Phase 8 `vms-arrange--`/`vms-align--` emission (added this phase-pair) is the exact idiom to mirror for the new classes.
- `viewmodel-shell-dotnet/ViewModels.cs` — PageNode (~L266+) + SectionNode (~L287+) records now carry `Arrange`/`Align`; add `Threshold`/`Limit`/`MinItem` the same way (`int? Limit` for the numeric one).
- `viewmodel-shell/test/theme-modifiers.test.ts` — the Phase 8 arrange/align class-emission + byte-identical-when-omitted cases; add parallel cases for the new classes.
- `demo/FeatureProbe-bun/handler.ts` + `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` + `parity/fixtures/feature-probe.json` — the parity harness (widened in Phase 8; widen again).
- `AGENTS.md` (repo root) — the Layout policy section (Phase 8) to update; release rules.

### Prior-art precedent
- **Phase 8** (`.planning/phases/08-alignment-enums-layout-policy/`) is the immediate template: same change shape (closed-union/bounded wire fields + modifier-class CSS + both backends + widened FeatureProbe parity + theme-modifiers tests + minimal Showcase demo + Unreleased CHANGELOG). Read its SUMMARY files. The one difference: Phase 9 adds a NEW layout VALUE (`switcher`) with its own flex CSS block, not just alignment knobs.
</canonical_refs>

<specifics>
## Specific Ideas
- Switcher acceptance (SWITCH-01): a `switcher` with 3-4 equal children sits in one row on a wide container and ALL stack on a narrow one, with NO intermediate "2-then-1" state — the atomic flip is the whole point (distinguishes it from `cards` auto-fit, which DOES pass through intermediate counts).
- `limit` use: a `switcher` with `limit:4` and 6 children forces vertical (because 6 > 4) regardless of width.
- `minItem` use: `cards` + `minItem:"sm"` (13rem) fits more, smaller columns; `minItem:"xl"` (24rem) fewer, wider — both still collapse to 1 column intrinsically.
</specifics>

<deferred>
## Deferred Ideas
- `fits` node → Phase 10. Comprehensive demo spread + real-app compositions + the consolidated release → Phase 11.
</deferred>

---

*Phase: 09-switcher-cards-minitem*
*Context authored 2026-06-24 by orchestrator from locked design doc (no discuss-phase needed).*
