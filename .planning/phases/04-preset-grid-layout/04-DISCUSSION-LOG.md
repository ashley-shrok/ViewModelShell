# Phase 4: Preset-Grid Layout - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 4-preset-grid-layout
**Areas discussed:** Preset vocab & default, cards sizing tension, split behavior, parity fixture shape

---

## Preset vocab & default

| Option | Description | Selected |
|--------|-------------|----------|
| layout: stack\|split\|cards | `layout?` closed union `"stack"\|"split"\|"cards"`, same union on page & section; explicit "stack" default member (mirrors Phase 3 density) | ✓ |
| layout: split\|cards only | `layout?` closed union `"split"\|"cards"`, no explicit stack member (mirrors variant?:"card") | |
| Different field name | Same values, key other than `layout` | |

**User's choice:** `layout?: "stack" | "split" | "cards"` closed union, SAME union on both PageNode and SectionNode.

| Option | Description | Selected |
|--------|-------------|----------|
| Omitted + stack both = no class | Omitted AND explicit "stack" emit zero modifier class → byte-identical; only split/cards emit `.vms-{page\|section}--{value}` (mirrors Phase 3 density "comfortable") | ✓ |
| Only omitted = byte-identical | Omitted byte-identical; explicit "stack" emits `.vms-page--stack` (class with no rule) | |

**User's choice:** Omitted + explicit "stack" both emit no modifier class (strongest LAYOUT-01 guarantee).
**Notes:** Locked as D-01/D-02. Class emission, not data-attributes, following the established BEM idiom.

---

## cards sizing tension

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed CSS constant | min-width is a stylesheet constant, NOT on wire; `repeat(auto-fit, minmax(var(--vms-card-min),1fr))`; strictest LAYOUT-04 | ✓ |
| Coarse size token on wire | Small closed-union size rides alongside preset; enumerable but mild LAYOUT-04 tension | |
| Numeric min-width on wire | Scalar px/rem crosses wire; literal LAYOUT-03 but violates LAYOUT-04 | |

**User's choice:** Fixed CSS constant — `cards` is a pure semantic preset, zero wire geometry.

| Option | Description | Selected |
|--------|-------------|----------|
| Overridable --vms-card-min var | Additive `:root` variable, host/theme-retunable, agent never touches; Phase 3 D-06 discipline | ✓ |
| Hard-coded literal | Min-width baked into rule, no variable | |

**User's choice:** Additive overridable `--vms-card-min` `:root` variable.
**Notes:** Locked as D-04/D-05. LAYOUT-03's "single min-item-width value" = the CSS constant, not an agent input.

---

## split behavior

| Option | Description | Selected |
|--------|-------------|----------|
| 2-up fixed | Exactly two columns side-by-side, collapse to 1 narrow; >2 children wrap into 2-col flow | ✓ |
| N-up one-per-child | Every child = an equal column (N children = N columns) | |
| Auto-fit (cards-like) | Children flow into as many columns as fit by intrinsic min-width | |

**User's choice:** 2-up fixed — most predictable for a blind agent.

| Option | Description | Selected |
|--------|-------------|----------|
| Equal columns | Each column equal width (1fr each) | ✓ |
| Content-natural | Columns size to content | |

**User's choice:** Equal columns.
**Notes:** Locked as D-06. Zero-media-query technique to achieve "exactly 2 then 1" flagged as a RESEARCH ITEM (D-07) — behavior locked, mechanism open.

---

## parity fixture shape

| Option | Description | Selected |
|--------|-------------|----------|
| Extend FeatureProbe | Add layout/density/card to FeatureProbe demo + feature-probe.json; only 3-backend (.NET/Bun/Node) fixture; lowest friction | ✓ |
| New dedicated fixture | New layout-only fixture + new backend entries; more isolated, more setup, only 2 backends | |

**User's choice:** Extend FeatureProbe + feature-probe.json.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — layout + density + card | One fixture covers all three new page/section wire fields; closes Phase 3 D-05 deferral | ✓ |
| Layout only | Fixture covers only `layout`; density/card stays deferred to Phase 5 | |

**User's choice:** Yes — layout + density + card (closes the carried-forward Phase 3 D-05 deferral).
**Notes:** Locked as D-08/D-09. FeatureProbe's existing dotnet/bun/node coverage is exactly LAYOUT-05's "(.NET/Bun/Node byte-identical)" — no backends.json edit needed.

## Claude's Discretion

- Exact `--vms-card-min` default value (≈16–20rem).
- The zero-media-query `split` technique (bounded: exactly-2-then-1, intrinsic, no media queries).
- CSS for how `--split`/`--cards` override the existing `.vms-page`/`.vms-section` flex-column `gap`.
- Whether page title / section heading stay outside the column flow.
- FeatureProbe VM + fixture step structure.

## Deferred Ideas

- Fixed-N-column preset (LAYOUT-F1, v2/Out of Scope).
- Coarse card-size token / numeric min-width on the wire (rejected D-04).
- N-up / content-natural split (rejected D-06).
- Container queries as the responsive mechanism (only as bounded-discretion fallback for D-07).
- 0.4.0 version bump (Phase 5 RELEASE-01).
- AGENTS.md full doc polish + Showcase/demos on shipped stylesheet (Phase 5 EXAMPLES).
- MIGRATION/CHANGELOG 0.4.0 entry (Phase 5 RELEASE-03).
