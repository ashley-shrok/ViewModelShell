# Phase 20: v5.1 Navigation Primitives — Context

**Gathered:** 2026-07-11
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/design/nav-primitives.md) — design of record LOCKED (framework survey + Ashley's tailnet-sketch sign-off). Run as `--skip-ui` because the design doc IS the design contract for these framework-drawn primitives.

<domain>
## Phase Boundary

Add the two orientation/navigation primitives VMS lacks — **BreadcrumbNode** and **StepsNode** — across BOTH backends (npm TS `src/index.ts` + `src/browser.ts` renderer + `styles/default.css`; .NET `viewmodel-shell-dotnet/ViewModels.cs`), plus a CSS-only **pointer-cursor on clickable table rows** fix. Ship as an aligned **npm + NuGet `5.1.0`** minor, additive (wire token stays `viewmodel-shell/1.0`), batched into ONE tailnet verification page + ONE publish. Both nodes were surveyed against MUI/Ant/Chakra/Bootstrap/WAI-ARIA and confirmed standard + pure structured data — the framework owns ALL appearance (separators, connectors, intrinsic reflow) + ALL accessibility; ZERO appearance crosses the wire.

**In scope:** the two nodes' wire types (both backends), the browser renderer + default.css styling, both tree-validators descending into the new nodes, TUI degradation, new parity/FeatureProbe fixtures for each, a Showcase/demo entry, the pointer-cursor CSS, the combined tailnet verification page, and the aligned 5.1.0 release closeout.

**Out of scope (deferred — do NOT build):** custom separators, per-item icons, breadcrumb overflow-collapse (`maxItems`), breadcrumb item dropdowns, steps dot-vs-numbered marker styles, clickable-to-navigate steps, per-step explicit error status, steps `maxCount` collapse. All are appearance knobs (off the wire forever) or interaction/variants to add only if a real consumer asks.
</domain>

<decisions>
## Implementation Decisions

### BreadcrumbNode — wire shape (LOCKED)
- `{ type: "breadcrumb", items: [ { label: string, href?: string } ] }` — ordered list; the LAST item is the current page, auto-rendered non-clickable. Position is the signal — NO per-item "current" flag.
- Framework draws (never on wire): a `<nav>` landmark + `aria-label` (default "breadcrumb"), an `<ol>`, `aria-current="page"` on the last item, and a FIXED separator. ⚠️ The separator stays OFF the wire — it's the one appearance knob the surveyed frameworks expose; VMS draws one fixed separator.

### BreadcrumbNode — open point to settle in planning
- VMS apps often navigate by DISPATCHING AN ACTION, not a URL. So a crumb should likely support an optional `action` alongside `href`, aligned with LinkNode's model (`href` + `external` + action-dispatch). Candidate: `{ label, href?, external?, action? }` where href = browser nav (external ⇒ new tab) and action = dispatch. Settle the exact shape in the plan; keep it minimal and consistent with how LinkNode/ButtonNode already model nav vs dispatch.

### StepsNode — wire shape (LOCKED)
- `{ type: "steps", steps: [ { label: string, description?: string } ], current: number /* 0-based */, orientation?: "horizontal" | "vertical" }`.
- Per-step status DERIVES from `current`: index < current = done, == current = current/active, > current = upcoming. NO per-step status field for the normal case.

### StepsNode — orientation = A+C (LOCKED by Ashley 2026-07-11)
- A closed-enum INTENT field, framework owns the actual layout + reflow (never a raw layout directive; no viewport breakpoints):
  - default / `"horizontal"` = responsive horizontal strip that auto-stacks to vertical INTRINSICALLY when the container is narrow.
  - `"vertical"` = a deliberate vertical wizard (markers down the left, connector running down, per-step descriptions beside each).
- Ashley eyeballed all three renderings (horizontal / narrow-auto-collapse / deliberate-vertical) in light + dark on a tailnet sketch and chose A+C — ship BOTH from the start.

### StepsNode — rendering + a11y (framework-drawn, LOCKED)
- Markers: numbered, check for done; connector line drawn marker-CENTER to marker-CENTER behind the markers (opaque marker circles sit on top so it reads bubble-edge to bubble-edge). Horizontal = centered marker-over-centered-label columns. (These exact rendering fixes were validated on the sketch — see nav-primitives.md.)
- `aria-current="step"` on the current step; an accessible name on the group; marker STATE conveyed via `aria-label` (complete/current/upcoming — never color alone); a non-interactive stepper is NOT focusable / not in the tab order; it is NOT `role="progressbar"` (that's continuous %) — use the discrete `aria-current="step"` pattern.

### Pointer-cursor on clickable table rows — ALREADY SHIPPED (OUT OF SCOPE)
- ⚠️ VERIFIED 2026-07-11 (grep, not memory): this is ALREADY done — `.vms-table__row--clickable { cursor: pointer; }` at `styles/default.css:934` (+ hover/focus-visible/disabled handling), emitted on `row.action` at `browser.ts:1725`, shipped in the 1.1.0 row-click work. The `table-row-pointer-cursor` memo was stale. **NO task needed — do NOT plan one.** Phase 20 scope is the two nodes only.

### Cross-backend / release rules (LOCKED — from AGENTS.md)
- Byte-identical wire across TS + .NET; optional-field rules honored (nullable → `WhenWritingNull`; optional bool → `WhenWritingDefault`). Prefer `string` over number/union for any string-attribute-ish field (parity-drift avoidance).
- BOTH tree-validators must descend into the new nodes; new FeatureProbe parity fixtures for each; `bun run parity/run.ts` green.
- Green-tree gate: vitest, `check:core-globals`, `check:aa-contrast` (HAND-CHECK any NEW fg/bg pair the markers introduce, e.g. white-on-accent marker fill, in default + all themes), `check-theme-byte-identity`, parity, the framework's OWN `viewmodel-shell-dotnet/Tests`, AND every `demo/**/*.Tests.csproj`.
- `agent-skill.md`: NO change — these are new node TYPES, not new wire-protocol verbs / side-effects (the skill enumerates the protocol, not the node catalog). Contrast the side-effect verb table which DID require a skill update for toasts.
- Release closeout is IN-QUEUE but gated: a combined tailnet verification page (both nodes, both step orientations, a clickable-row cursor check, light + dark) for Ashley's sign-off BEFORE any publish (visual change = in-question path). Then aligned npm+NuGet `5.1.0`, tag `v5.1.0`, advance `main` (`git merge-base --is-ancestor v5.1.0 main`), CI green, announce `#vms-changelog`. CHANGELOG + MIGRATION ("new optional nodes, no action required").

### Claude's Discretion
- Exact CSS class names (follow the `.vms-<node>__<part>` convention grep'd from `browser.ts`), plan/wave decomposition, how the orientation reflow is implemented (container query vs flex-wrap intrinsic — must be zero viewport breakpoints), the FeatureProbe fixture composition, and which demo hosts the nodes.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design of record (authoritative spec — read FIRST)
- `.planning/design/nav-primitives.md` — the LOCKED design: both wire shapes, the A+C orientation decision, framework-owned rendering + a11y, the separator-off-wire rule, deferred variants, the release plan. Everything else here is a summary of it.

### Framework conventions (MUST honor)
- `AGENTS.md` — the VMS philosophy + the critical gotchas (#8 optional-field wire rules, the green-tree gate, the publishing ritual), the layout policy (P1 intrinsic/zero-breakpoint, P2 closed-enum/bounded-scalar), the "ask before working around a gap" rule, and the concern→source table (node types live in `src/index.ts` mirrored 1:1 in `ViewModels.cs`; classes in `browser.ts` + `default.css`).

### Closest existing analogs (pattern sources — the pattern-mapper will expand)
- `viewmodel-shell/src/index.ts` + `viewmodel-shell-dotnet/ViewModels.cs` — `LinkNode` (href + external + active + `aria-current`; the breadcrumb crumb + action-vs-href question), `BadgeNode` / `DividerNode` (recent leaf-node additions = the add-a-node template), `TableRow.action` (the pointer-cursor target).
- `viewmodel-shell/src/browser.ts` + `styles/default.css` — how leaf nodes emit classes + how `.vms-link--active` / list-item states are styled (the state-derivation analog for steps done/current/upcoming).
- `parity/` + the FeatureProbe fixtures — how a new node gets a parity fixture (both backends).

</canonical_refs>

<specifics>
## Specific Ideas

- The sketch that Ashley signed off (candidate CSS for both nodes, all three step modes, light + dark) lives at the tailnet scratch page used this session; its component CSS (centered marker-over-label columns; connector as a `::before` drawn center-to-center behind the markers; vertical stem+body row) is a proven-correct STARTING POINT for the real `browser.ts` + `default.css` work — but the real work must class it the way `browser.ts` emits + drive the real renderer, not copy the mockup wholesale.
- Steps state colors map onto existing tokens: `--vms-accent` for done/current markers + connectors, `--vms-text-muted` for upcoming, `--vms-accent-glow` ring on current. Breadcrumb links = `--vms-accent`, current = `--vms-text` bold, separator = `--vms-text-muted`.
</specifics>

<deferred>
## Deferred Ideas

- Steps: per-step icons, dot-vs-numbered marker styles, clickable-to-navigate steps, per-step error/warning status, `maxCount` overflow-collapse.
- Breadcrumb: custom separator, per-item icons, item dropdown menus, `maxItems` overflow-collapse.
- All are additive-later; none ship in v5.1. Add only on a concrete consumer request.

</deferred>

---

*Phase: 20-v5-1-navigation-primitives-breadcrumbnode-stepsnode-pointer-*
*Context gathered: 2026-07-11 via PRD Express Path (design/nav-primitives.md), --skip-ui (design doc is the contract)*
