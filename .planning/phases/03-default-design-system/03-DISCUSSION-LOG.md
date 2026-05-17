# Phase 3: Default Design System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 3-default-design-system
**Areas discussed:** Density & card: wire or CSS; Spacing/type scale: vars vs literals; Page shell mechanism; Default visual identity

---

## Density & card: wire or CSS

| Option | Description | Selected |
|--------|-------------|----------|
| Additive wire fields | PageNode.density + SectionNode.variant; omitted = byte-identical; bundles into 0.4.0 wire bump | ✓ |
| Host-set CSS only | No model field; host sets data-attr/class/var | |
| Split: card=wire, density=CSS | Card is per-section intent; density global host CSS | |

**User's choice:** Additive wire fields.

| Option | Description | Selected |
|--------|-------------|----------|
| TS + .NET fields now, parity fixture in Phase 4/5 | Structural alignment now; dedicated fixture defers; 7 fixtures stay green | ✓ |
| Full .NET sync + new parity fixture in Phase 3 | Heaviest; proves round-trip immediately | |
| TS only, .NET untouched until Phase 4 | Lightest; deliberate .NET/TS drift | |

**User's choice:** TS + .NET fields now, dedicated parity fixture deferred to Phase 4/5.

| Option | Description | Selected |
|--------|-------------|----------|
| Closed union: "card" | Like ButtonNode; enumerable contract | ✓ |
| Open string | Like ListItemNode; flexible, no contract | |

**User's choice:** Closed union `variant?: "card"`.

| Option | Description | Selected |
|--------|-------------|----------|
| PageNode.density union + modifier class | density?: "comfortable"\|"compact" → vms-page--compact | ✓ |
| PageNode.density + data attribute | data-vms-density on .vms-page | |
| Open string density | density?: string → vms-page--{density} | |

**User's choice:** `PageNode.density?: "comfortable" | "compact"` + `vms-page--compact` modifier class.

**Notes:** Reframes STATE.md's loose "Phase 3 = no wire change" — the layout enum remains Phase 4's forcing change; these are small additive THEME fields on the same accepted 0.4.0 wire bump.

---

## Spacing/type scale: vars vs literals

| Option | Description | Selected |
|--------|-------------|----------|
| New --vms-space-* / --vms-text-* variables | Additive to override seam; density = var remap | ✓ |
| Fixed internal scale, no new variables | Minimal seam surface; verbose density | |

**User's choice:** New `--vms-space-*` / `--vms-text-*` variables.

| Option | Description | Selected |
|--------|-------------|----------|
| Small named step set | ~5 spacing + ~5 type steps, modular ratio | ✓ |
| Single base unit + calc() | One base, derive via calc() | |
| Tokenize current values 1:1 | Named, not changed | |

**User's choice:** Small named step set on a modular ratio.

| Option | Description | Selected |
|--------|-------------|----------|
| Normalize — visible rhythm change OK | Snap ad-hoc values to scale; coherence = THEME-02 | ✓ |
| Pixel-preserving | Steps resolve to today's exact numbers | |

**User's choice:** Normalize; visible rhythm change accepted (re-baselined in Phase 5).

| Option | Description | Selected |
|--------|-------------|----------|
| All rem on a modular ratio | Accessibility-friendly single type scale | ✓ |
| rem headings, px controls | Two parallel systems | |
| All px | Breaks rem accessibility scaling | |

**User's choice:** All rem on a modular ratio.

---

## Page shell mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| On .vms-page itself | max-width/center/pad on existing rule; no DOM/renderer change | ✓ |
| Inner content wrapper element | New .vms-page__content + renderer change | |
| Body-level shell | On body — rejected (opt-in stylesheet, host owns body) | |

**User's choice:** Shell on `.vms-page` itself.

| Option | Description | Selected |
|--------|-------------|----------|
| ~1080px app width | Between Bootstrap lg/xl; --vms-page-max var | ✓ |
| ~1280px wide | Dashboard-roomy | |
| ~760px narrow | Reading/form-centric | |

**User's choice:** ≈1080px (as `--vms-page-max`).

| Option | Description | Selected |
|--------|-------------|----------|
| clamp() fluid padding, zero breakpoints | Preserves zero-media-query codebase; framework ethos | ✓ |
| Media-query breakpoints | First media query in codebase | |

**User's choice:** `clamp()` fluid padding, zero breakpoints.

| Option | Description | Selected |
|--------|-------------|----------|
| Body-themed, .vms-page transparent | Color byte-identical; shell = pure layout | ✓ |
| .vms-page gets a surface/panel background | Big default-look change; competes with card | |
| Claude's discretion (tune in Phase 5) | Defer surface question | |

**User's choice:** Body-themed; `.vms-page` stays transparent.

---

## Default visual identity

| Option | Description | Selected |
|--------|-------------|----------|
| Frozen this phase — structural only | Palette byte-identical; tight scope; parity-safe | ✓ |
| Palette re-baseline is in Phase 3 | Bigger blast radius, no Showcase to judge against | |

**User's choice:** Palette frozen in Phase 3 (structural only).

| Option | Description | Selected |
|--------|-------------|----------|
| Re-baseline to neutral light default; dark-purple → theme file | Conventional serviceable baseline; Phase 5 intent | ✓ |
| Keep dark-purple — it's the brand | Dark identity stays default | |
| Decide in Phase 5 with Showcase in hand | No pre-commit | |

**User's choice:** Directional intent — re-baseline to neutral light default in Phase 5 (deferred, not acted on now).

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit WCAG AA text-contrast floor | Testable "serviceable" floor for blind pipeline | ✓ |
| Claude's discretion | Subjective, unverifiable | |

**User's choice:** Explicit WCAG AA text-contrast floor (tightening today's borderline muted-text default value is in-scope and is not an override-seam behavior change).

## Claude's Discretion

- Scale step count/names/ratio; exact `--vms-page-max` value & `clamp()` bounds; card surface treatment & heading/nesting behavior; compact-mode variable deltas; the AA-passing muted-text value.

## Deferred Ideas

- Default-palette re-baseline to neutral light (Phase 5 EXAMPLES-01).
- Dedicated cross-backend parity fixture for density/variant (Phase 4 LAYOUT-05 / Phase 5 RELEASE-02).
- Inner `.vms-page__content` wrapper element (rejected for Phase 3).
- AGENTS.md full doc polish (Phase 5 EXAMPLES-03).
- 0.4.0 npm+NuGet version bump (Phase 5 RELEASE-01).
