---
phase: 03-default-design-system
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - viewmodel-shell/styles/default.css
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell-dotnet/ViewModels.cs
  - viewmodel-shell/test/theme-modifiers.test.ts
  - AGENTS.md
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Phase 3 (Default Design System) was reviewed against the phase-specific invariants:
the THEME-05 sacred override seam, the non-breaking optional-field guarantee, the
closed-union model design, and the platform-agnostic core promise. The work is
high quality and the core invariants hold:

- **THEME-05 seam intact.** Diffed `default.css` against `012d9a3^`. Every existing
  `:root` color/radius/font/transition/color-scheme variable NAME and value is
  byte-identical except the single sanctioned D-17 change
  `--vms-text-muted: #6b6b80 → #9090a8`. All new tokens (`--vms-space-*`,
  `--vms-text-*`, `--vms-page-max`) are purely additive new declarations. No
  existing variable was renamed, removed, or re-semanticized. Themes that override
  the old names continue to win the cascade unchanged.
- **Emission logic is correct and strict.** `browser.ts` emits `vms-page--compact`
  only on `n.density === "compact"` and `vms-section--card` only on
  `n.variant === "card"` (strict `===`, not truthiness). Omitted/`undefined` and
  the `"comfortable"` literal both produce byte-identical `class="vms-page"` /
  `class="vms-section"` output. No template-string edge case changes output when
  the field is absent.
- **Closed unions / .NET trailing param** — `density?: "comfortable" | "compact"`,
  `variant?: "card"`, and the C# `string? Density = null` / `string? Variant = null`
  appended as trailing defaulted positional params are the deliberate D-03/D-05
  locked decision, verified non-breaking against all demo call-sites (every
  `new PageNode(...)` / `new SectionNode(...)` uses ≤2 positional args), and are
  NOT flagged.
- **Core stays agnostic.** `src/index.ts` changes are type-only (two doc-commented
  optional interface fields). Zero platform globals introduced. DOM access stays
  in `browser.ts` where it is legitimate.

One Warning (a real per-rem cascade behavior change inside the sanctioned
refactor that the phase invariant frames as "byte-unchanged semantics") and four
Info items follow. No Critical issues.

## Warnings

### WR-01: Scale-token refactor changes computed pixel size of all `px`-declared text/spacing (cascade-relative regression, not byte-identical to pre-change render)

**File:** `viewmodel-shell/styles/default.css:50-56, 119-124, 138-143, 437-448`

**Issue:** The refactor swaps literal `px` font sizes for `rem` scale tokens. Several
of these are **not** size-preserving substitutions:

- `.vms-section__heading` / `.vms-stat-bar__label` / `.vms-table__th`: `font-size: 11px`
  → `var(--vms-text-xs)` = `0.6875rem`. At the UA default root (`16px`) that is
  `11px` — neutral. But these elements live inside `.vms-page`, and a host app that
  sets a non-16px root `font-size` (common in design systems) now gets a *different*
  computed size than the old hard `11px`. The old value was viewport/root-independent;
  the new one is root-relative.
- `.vms-table` / `.vms-text--error` / `.vms-checkbox__label` / `.vms-button`:
  `13px` → `--vms-text-base` `0.8125rem` (= `13px` only at 16px root).
- `.vms-field__label` / `.vms-text--muted` / tabs / filter-input: `12px` →
  `--vms-text-sm` `0.75rem` (= `12px` only at 16px root).

The phase invariant states the refactor must keep "byte-identical wire/className"
and that the override seam semantics are preserved — that holds for the *variable
contract*. But the *rendered output* of any consumer with a non-default root
font-size shifts. This is a real, intentional-looking behavioral change that is
worth recording explicitly: it is a design-system tradeoff (rem scalability) that
silently alters pixel output for non-16px-root hosts and is not covered by any
test (the jsdom tests deliberately assert classes only, not computed pixels —
see IN-04).

**Fix:** No code change required if the rem-relative behavior is the intended
THEME-01/D-09 design decision (it appears to be). To close the gap, either:
1. Document the root-font-size dependency in the `default.css` header comment so
   theme authors know computed sizes now track the host root, e.g.:
   ```css
   /* NOTE: type/space scale is rem-relative — computed px tracks the host
      root font-size (16px UA default). Set :root{font-size} to rescale. */
   ```
   or
2. Add one jsdom/computed-style assertion pinning a representative element's size
   at the 16px-root default so an accidental token-value edit (e.g. a future
   `--vms-text-xs` change) is caught as a regression rather than shipping silently.

## Info

### IN-01: Density token remap is intentionally partial — `--vms-space-2xs/xs/xl` not remapped under `.vms-page--compact`

**File:** `viewmodel-shell/styles/default.css:110-115`

**Issue:** `.vms-page--compact` remaps only `--vms-space-sm/md/lg`. `--vms-space-2xs`,
`--vms-space-xs`, and `--vms-space-xl` keep their comfortable values. This means
compact density tightens row/section/page rhythm but leaves field-internal gaps
(`--vms-space-2xs`) and the select caret padding (`--vms-space-xl`) unchanged.
This reads as a deliberate "rhythm tokens only" scope (the comment says so), and
because the remap is scoped to the `.vms-page--compact` subtree via CSS custom-
property inheritance it cannot leak to non-compact pages or to the `:root`
override seam. Recording only so the partial scope is a documented decision and
not mistaken later for an omission.

**Fix:** None required. Optionally extend the comment to state which tokens are
intentionally left at comfortable values and why (caret geometry / minimum tap
spacing should not compress).

### IN-02: Spacing-token substitutions are not always pixel-equivalent to the prior literals (rhythm drift within the sanctioned refactor)

**File:** `viewmodel-shell/styles/default.css:136, 147, 233, 242`

**Issue:** Some spacing swaps changed the actual gap, not just the unit:
- `.vms-stat-bar__item` gap `0.4rem` → `var(--vms-space-xs)` = `0.5rem`.
- `.vms-field` gap `0.3rem` → `var(--vms-space-2xs)` = `0.25rem`.
- `.vms-button` padding `0.55rem 0.9rem` → `var(--vms-space-sm) var(--vms-space-md)`
  = `0.75rem 1rem`.
- `.vms-button--primary` padding `0.65rem 1.25rem` →
  `var(--vms-space-sm) var(--vms-space-lg)` = `0.75rem 1.5rem`.

These are snap-to-scale adjustments (expected and desirable for a design system),
but they are visible layout changes, not 1:1 token aliasing. Consistent with the
THEME-01 scale-snap goal; flagged only so the "refactor" framing isn't read as
"zero visual delta." No seam impact (these are component rules, not `:root`).

**Fix:** None required — this is the intended scale normalization. Ensure the
phase summary / changelog calls it a visual-rhythm change so downstream demos
re-baseline any pixel snapshots.

### IN-03: `.vms-page` now constrains width + adds horizontal padding — verify nested `.vms-page` / full-bleed demos

**File:** `viewmodel-shell/styles/default.css:91-100`

**Issue:** `.vms-page` gained `max-width: var(--vms-page-max)`, `margin-inline: auto`,
and `padding-inline: clamp(1rem, 5vw, 2.25rem)`. The selector `.vms-page` is also
used inside the box-model reset and could in principle be nested (a `page` node is
the root, but modal bodies and demos render arbitrary trees). A `.vms-page`
rendered inside a width-constrained container (e.g. inside `.vms-modal__body`,
max 520px) now also gets centered + padded, which can double-pad. This is almost
certainly fine because `page` is a documented root container, but it is a new
constraint where there was none.

**Fix:** None required if `page` is contractually root-only. Optionally note in
AGENTS.md that `page` is a top-level container and should not be nested inside a
`modal`/`section` body, so the new `max-width`/`padding-inline` behaves as intended.

### IN-04: jsdom tests assert the omitted-byte-identical guarantee at the className level only — no computed-style / serialization coverage

**File:** `viewmodel-shell/test/theme-modifiers.test.ts:49-72`

**Issue:** The tests correctly and explicitly assert the load-bearing invariant:
`density: "comfortable"` and omitted both yield `className === "vms-page"`, and
omitted `variant` yields `className === "vms-section"` (exact-string `toBe`, not
`toContain`). That is the right assertion for the emission guarantee and it is
solid. Gaps worth noting (not defects in what is tested):
1. No assertion that an unknown/invalid `density` value (TypeScript prevents it at
   compile time, but the wire is untyped JSON from the server) does not emit a
   modifier — `n.density === "compact"` already handles this safely, but there is
   no regression test pinning it.
2. No computed-style assertion (intentionally — UI-SPEC item 5), which is why
   WR-01's pixel drift is uncaught by the suite.
3. No `.vms-page--compact` token-remap behavior test (that compact actually
   changes the resolved `--vms-space-lg`), only that the class is present.

**Fix:** Optionally add one test feeding an off-contract value
(`{ type: "page", children: [], density: "cozy" as any }`) and asserting
`className === "vms-page"`, to lock the strict-equality emission against future
refactors to truthiness. Current coverage is adequate for the stated phase
guarantee; this is hardening only.

---

_Reviewed: 2026-05-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
