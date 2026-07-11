# Design of record — v5.1 Navigation Primitives (Breadcrumb + Steps) + pointer-cursor fix

**Status:** LOCKED 2026-07-11 (survey-confirmed + Ashley eyeballed a tailnet sketch and decided the one open call). Ready for `/gsd:plan-phase`.

**Milestone:** v5.1 — aligned npm + NuGet minor. Additive; wire token stays `viewmodel-shell/1.0`. Batched into ONE release (one verification page, one publish/tag/announce).

## Why these, why now

Two orientation/navigation primitives the framework lacks, plus a one-line affordance finish. Both nodes were **surveyed against the mature frameworks we use to guide VMS** (the standing design method: borrow before inventing) and confirmed to be **standard, converged primitives expressible as pure structured data** — MUI, Ant, Chakra, Bootstrap, and the formal WAI-ARIA APG all model them the same way, with zero appearance required on the wire. That is the gate Ashley set ("if it's standard by referencing the usual frameworks, I'd consider it"); both cleared it.

Philosophy fit: both are structural nodes — an app describes an ordered list of labelled positions; the framework draws the trail/strip, the separators/connectors, the responsive reflow, and all the accessibility wiring. No CSS surface, no viewport breakpoints, every wire field a closed enum / bounded scalar / string.

---

## 1. BreadcrumbNode

**Wire shape (candidate):**
```
{ type: "breadcrumb", items: [ { label: string, href?: string /* + see open point */ } ] }
```
- Ordered list. The **last item is the current page and is auto-rendered non-clickable** — position is the signal; there is NO per-item "current" flag (unanimous across all five references).
- Earlier items are links (or actions — see open point).

**Framework owns (never on the wire):**
- A `<nav>` landmark with an `aria-label` (default `"breadcrumb"`; optionally an app-supplied accessible-name string — that's a11y text, not appearance).
- An `<ol>` of items.
- `aria-current="page"` on the last item.
- A **FIXED separator**, drawn by the framework. ⚠️ The separator is the ONE appearance knob these frameworks expose (Bootstrap's is literally a CSS variable; MUI/Ant/Chakra take an arbitrary glyph/icon) — it stays OFF the wire. VMS draws one fixed separator.

**Open design point for planning — action vs href crumbs.** The web-framework survey models crumbs as `href` (URL navigation). But VMS apps frequently navigate by **dispatching an action** (server-driven state nav), not by URL. So a crumb should likely support an optional `action` alongside/instead of `href`, aligned with how `LinkNode` already models navigation (`href` + `external`) and how buttons dispatch actions. Settle the exact shape during plan-phase: probably `{ label, href?, external?, action? }` where href = browser nav (external ⇒ new tab) and action = dispatch. Keep it minimal.

**Deferred (do NOT ship v1; add only if a consumer asks):** custom separator (off the wire forever), `maxItems` overflow-collapse (a legitimate bounded scalar, defer), per-item icons, per-item dropdown menus.

---

## 2. StepsNode

**Wire shape (candidate):**
```
{ type: "steps", steps: [ { label: string, description?: string } ], current: number /* 0-based */, orientation?: "horizontal" | "vertical" }
```
- Ordered list of stages, each a `label` plus an optional one-line `description`.
- A single **0-based `current` index**. Per-step status **DERIVES** from it: `index < current` = done, `index == current` = current/active, `index > current` = upcoming. No per-step status field for the normal case (unanimous across MUI/Ant/Chakra: the current index drives everything).

**Orientation — A + C (Ashley's decision, 2026-07-11).** The one field in tension with our rules; resolved as a **closed-enum INTENT the framework reflows itself**, never a raw layout directive:
- **Default / `"horizontal"`** = the responsive horizontal strip that **auto-stacks to vertical intrinsically when the container is narrow** (no breakpoint, framework owns the reflow — the VMS-native behavior). This is "Option A."
- **`"vertical"`** = a **deliberate vertical wizard** layout (markers down the left, connector line running down, per-step descriptions beside each). This is "Option C" — an app requests it on purpose (detailed wizards), not something width should trigger.

Ashley eyeballed all three renderings (horizontal / narrow-auto-collapse / deliberate-vertical) in light + dark on a tailnet sketch and chose **A + C from the start** (ship both) — she expects apps will want the deliberate vertical wizard, so it's in v1 rather than deferred. Name the field/values at planning time (`orientation: horizontal|vertical` is the natural choice); keep it an intent, framework owns the actual layout + the intrinsic collapse.

**Framework owns (never on the wire):**
- Markers (numbered / check for done), connector lines (drawn marker-center to marker-center, behind the markers), all layout + the intrinsic horizontal→vertical collapse.
- Accessibility: `aria-current="step"` on the current step; an accessible name on the group; marker STATE conveyed via `aria-label` (complete / current / upcoming — never color alone); a non-interactive stepper is **not** focusable / not in the tab order. It is NOT `role="progressbar"` (that's continuous %); use the discrete `aria-current="step"` pattern.

**Deferred (do NOT ship v1; add only if a consumer asks):** per-step icons, dot-vs-numbered marker styles (appearance — off the wire forever), clickable-to-navigate steps (interaction — fits the action-dispatch model if wanted later), per-step `size`/`variant` (off the wire), `maxCount` collapse, per-step explicit error/warning status (a closed enum, safe to add later).

---

## 3. Pointer-cursor on clickable table rows (the finish)

`TableRow.action` already makes a whole row clickable/keyboard-activatable, but the row doesn't show `cursor: pointer` on hover — the universal "this is clickable" signal is missing. Fix: when a row is genuinely clickable (has a `row.action`), the framework shows the pointer cursor on hover, the way links/buttons already do. **CSS-only** (`styles/default.css`), no wire/type change, no app-facing choice. (Grep the renderer/CSS first to confirm the current state before editing — don't assert from memory.)

---

## Release

- Aligned **npm + NuGet v5.1.0** minor (both backends gain the two nodes; the pointer-cursor CSS is npm-side but rides the same release).
- Green-tree gate throughout (vitest, core-globals, aa-contrast — hand-check any NEW fg/bg pair the markers introduce, e.g. white-on-accent marker fill, theme-byte-identity, parity incl. new FeatureProbe fixtures for both nodes, .NET Tests, all demo Tests).
- `agent-skill.md`: these are new NODE types, not new wire-protocol verbs — the skill enumerates the protocol, not the node catalog, so **no agent-skill.md change** unless a node introduces a new response/side-effect shape (it doesn't). (Contrast the side-effect verb table, which DID require a skill update for toasts.)
- One combined **tailnet verification page** driving the real bundle (breadcrumb + steps in both orientations + a clickable-row cursor check), light + dark, for Ashley's sign-off — then publish/tag/advance-main/announce `#vms-changelog`.
- CHANGELOG + MIGRATION entries (MIGRATION only needs the "new optional nodes, no action required" note).
