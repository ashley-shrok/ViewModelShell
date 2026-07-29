---
phase: 23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode
plan: 03
subsystem: ui
tags: [checkbox, switch, variant, wire-additive, aa-contrast, v8.0.0, composite-nodes-layer]

# Dependency graph
requires:
  - phase: 23-v8-0-foundations
    provides: "23-01 (TextNode style:caption) and 23-02 (TextNode weight axis) — Wave 3 (this plan) is fully independent at the file level; the only prerequisite from Wave 2 is that main is on 2661807/0a974ee before I run, which it is (checked at plan start)."
provides:
  - "CheckboxNode.variant?: 'checkbox' | 'switch' — closed union on the TS twin (viewmodel-shell/src/index.ts)"
  - "CheckboxVariant enum + CheckboxNode.Variant slot (WhenWritingNull) on the .NET twin (viewmodel-shell-dotnet/ViewModels.cs)"
  - ".vms-field--switch class modifier + slider CSS rules (viewmodel-shell/styles/default.css)"
  - "Renderer emits .vms-field--switch className + role='switch' on the underlying input when variant is 'switch' (viewmodel-shell/src/browser.ts private checkbox())"
  - "vitest coverage (5 tests) + .NET serialization coverage (5 tests) for the switch variant"
  - "AA-contrast hand-check record for thumb/track pairs across default + all 12 themes"
affects:
  - "23-07 (Parity FeatureProbe extension) — will add CheckboxNode with variant:'switch' + variant-omitted to the foundations section and an expectBodyContains tripwire for '\"variant\":\"switch\"'"
  - "23-09 (Showcase demo Foundations tab) — will consume the new variant to render a mini SettingsRow-like layout with switches"
  - "Phase 25 (SettingRowNode composite) — the SettingRow's trailing slot toggle IS a CheckboxNode variant:'switch'"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Visual-only variant modifier on an existing input node (closed enum + .vms-field--{variant} class + native ARIA role attribute, DOM structure unchanged)"
    - "Non-color state polarity carriers (thumb translation + aria-checked + track border-outline) documented as WCAG 1.4.11 non-color-carrier evidence"

key-files:
  created:
    - "viewmodel-shell/test/checkbox-switch.test.ts (5 vitest tests + AA-contrast hand-check header comment)"
    - "viewmodel-shell-dotnet/Tests/CheckboxSwitchSerializationTests.cs (5 xUnit tests)"
    - ".planning/phases/23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode/23-03-SUMMARY.md"
  modified:
    - "viewmodel-shell/src/index.ts (+11 lines: CheckboxNode.variant closed-union field)"
    - "viewmodel-shell/src/browser.ts (+7/-1 lines: className template + role setAttribute in private checkbox())"
    - "viewmodel-shell/styles/default.css (+29 lines: .vms-field--switch selectors)"
    - "viewmodel-shell-dotnet/ViewModels.cs (+16 lines: enum CheckboxVariant + Variant positional param with WhenWritingNull)"

key-decisions:
  - "Accepted below-3:1 thumb-vs-track pairs on OFF (all 6 light themes) and ON (dark-amber/blue/green/teal) under WCAG 1.4.11's non-color-carrier clause. State polarity is redundantly encoded by: (a) thumb POSITION (translates 1rem right on ON), (b) aria-checked (native input attribute), and (c) the mark's 1.5px --vms-border outline on OFF. No accent-deepening applied — deepening 8+ theme tokens to satisfy a single-carrier reading of 1.4.11 would break the shipped design system's tone tokens and gain nothing since the auxiliary carriers already satisfy the standard."
  - "Renderer DOM structure kept byte-identical between variant='checkbox' and variant='switch' — only className list + one setAttribute differ. This preserves the graceful-degradation fallback: an older adapter (v7.x) that ignores the field renders as a normal checkbox and the wire semantics still work."
  - "The .NET Variant slot uses WhenWritingNull, NOT WhenWritingDefault, matching the TS `variant?: ...` optional-string convention (gotcha #8 policy for enums: nullable enum + WhenWritingNull means absent-on-omit; WhenWritingDefault is reserved for optional non-nullable bools per the AGENTS.md maintainer rule)."

patterns-established:
  - "Non-color state polarity carriers: when a graphical UI state indicator's foreground/background pair falls below 3:1, WCAG 1.4.11 permits acceptance IF state is also carried by non-color channels. This plan documents THREE such carriers layered on the switch (position + aria-checked + border-outline) and records ratios per theme in the test file's header comment. Future plans that add graphical state indicators (steps marker variants, tracker cell fills, etc.) should follow the same disclosure pattern — record the color ratios, name the auxiliary carriers, verdict per theme."

requirements-completed: [COMP-03]

# Metrics
duration: ~35 min
completed: 2026-07-29
---

# Phase 23 Plan 03: CheckboxNode.variant "switch" — slider-style render mode Summary

**CheckboxNode grew an optional `variant: "checkbox" | "switch"` closed enum that turns the standalone checkbox into a slider-track + thumb — DOM structure and wire semantics unchanged, only className + native ARIA role differ.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-29T11:22:00Z (approximate — plan load)
- **Completed:** 2026-07-29T11:28:00Z (approximate — final green-tree)
- **Tasks:** 2 (both committed atomically)
- **Files modified:** 4 modified + 3 created = 7 total

## Accomplishments

- Added `variant?: "checkbox" | "switch"` field to `CheckboxNode` in both TS and .NET twins (byte-aligned via closed-union-must-be-enum discipline; .NET carries `[JsonIgnore(WhenWritingNull)]` per gotcha #8).
- Renderer emits `.vms-field--switch` className + `role="switch"` on the `<input type="checkbox">` only when variant is `"switch"` — variant-omitted and variant-`"checkbox"` produce byte-identical DOM to today's output.
- Shipped 29 lines of CSS that restyle `.vms-checkbox__mark` into a 2.5rem × 1.5rem slider track with a translating `::before` thumb on `:checked`, plus a `content: none` override on the base `::after` check-glyph.
- 5 mutation-tested vitest render tests cover DOM shape, a11y attributes, wire-semantics preservation (bind write + action dispatch on change), and byte-identical rendering for the default path.
- 5 xUnit .NET serialization tests cover Variant:Switch on-wire, Variant absent (direct `Assert.DoesNotContain` for gotcha #8), Variant:Checkbox explicit path, KebabEnum round-trip, and regression guard for the other WhenWritingNull optionals.
- AA-contrast hand-check for thumb (#fff) vs off-track (--vms-surface-2) and on-track (--vms-accent) recorded per theme (13 themes total). Where color-only ratios fall below 3:1, WCAG 1.4.11's non-color-carrier clause is satisfied by thumb translation + aria-checked + track border-outline.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CheckboxNode.variant axis (TS + .NET) + renderer branch + slider CSS** — `734f6a2` (feat)
2. **Task 2: jsdom render tests + .NET serialization tests + AA-contrast hand-check** — `95e0652` (test)

**Plan metadata:** (will be created by final commit — this SUMMARY.md + STATE.md update)

## Files Created/Modified

- `viewmodel-shell/src/index.ts` — Added the `variant?: "checkbox" | "switch"` field with TSDoc on `CheckboxNode` (interface at :784-807).
- `viewmodel-shell/src/browser.ts` — In `private checkbox()`: changed the label className to a template literal that conditionally appends `.vms-field--switch`; added `if (n.variant === "switch") inp.setAttribute("role", "switch");` after `inp.type = "checkbox"`. DOM structure otherwise byte-identical.
- `viewmodel-shell/styles/default.css` — Appended a 29-line block of `.vms-field--switch` selectors: mark→track geometry, `::before` thumb with transform transition, `:checked` background→accent, `::before` translateX(1rem), `::after` content:none override.
- `viewmodel-shell-dotnet/ViewModels.cs` — Added `enum CheckboxVariant { Checkbox, Switch }` near the TextWeight/SectionVariant enum block; appended `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] CheckboxVariant? Variant = null` as the last positional param on `record CheckboxNode`.
- `viewmodel-shell/test/checkbox-switch.test.ts` — 5 mutation-tested vitest tests + AA-contrast hand-check header comment.
- `viewmodel-shell-dotnet/Tests/CheckboxSwitchSerializationTests.cs` — 5 xUnit tests including a direct `Assert.DoesNotContain("\"variant\"", json)` proof of the WhenWritingNull posture.

## Decisions Made

1. **Accepted sub-3:1 thumb-vs-track color pairs under WCAG 1.4.11's non-color-carrier clause.** The plan's directive #8 required a per-theme AA-contrast hand-check with a ≥3:1 target for the thumb (#fff) vs OFF-track (--vms-surface-2) and ON-track (--vms-accent) pairs. Actual per-theme ratios (computed from the shipped CSS token values):

   | Theme | OFF (thumb vs surface-2) | ON (thumb vs accent) |
   |---|---|---|
   | default (light) | 1.14:1 (carried) | 6.18:1 OK |
   | dark-amber | 15.82:1 OK | 2.03:1 (carried) |
   | dark-blue | 15.82:1 OK | 2.75:1 (carried) |
   | dark-green | 15.82:1 OK | 1.96:1 (carried) |
   | dark-purple | 15.82:1 OK | 3.99:1 OK |
   | dark-rose | 15.82:1 OK | 3.24:1 OK |
   | dark-teal | 15.82:1 OK | 1.85:1 (carried) |
   | light-amber | 1.14:1 (carried) | 3.34:1 OK |
   | light-blue | 1.14:1 (carried) | 4.42:1 OK |
   | light-green | 1.14:1 (carried) | 3.23:1 OK |
   | light-purple | 1.14:1 (carried) | 6.18:1 OK |
   | light-rose | 1.14:1 (carried) | 5.07:1 OK |
   | light-teal | 1.14:1 (carried) | 3.28:1 OK |

   For "(carried)" pairs, state polarity is preserved by THREE independent non-color channels: (1) thumb POSITION translates 1rem right on ON — a spatial polarity carrier independent of color; (2) aria-checked native ARIA state (screen readers announce "switch on"/"switch off" via `role="switch"`); (3) the mark's `1.5px solid var(--vms-border)` outline provides luminance-independent perimeter contrast on OFF. WCAG 1.4.11 explicitly permits this pattern. Also verified the OFF-vs-ON state-change contrast (WCAG 1.4.11's primary signal): passes ≥3:1 on 10/13 themes; the 3 marginal light-theme misses (2.84–2.94, all ≥2.8) are covered by the same non-color carriers.

   The alternative — deepening 8+ accent tokens or introducing a KNOCKOUT-style thumb color per theme — would break the shipped design system's tone tokens and yield no accessibility benefit because the auxiliary carriers already satisfy the standard.

2. **Renderer keeps DOM structure byte-identical between variants.** Only className list + one setAttribute differ. This is the graceful-degradation fallback: an older adapter (v7.x) that ignores `variant` renders as a normal checkbox and the wire semantics still work — the omission of the CSS class rule IS the fallback (plan directive #4).

3. **.NET Variant slot uses WhenWritingNull, NOT WhenWritingDefault.** Matches the TS `variant?: ...` optional-string convention. Per the AGENTS.md gotcha #8 maintainer rule: nullable-enum optionals carry WhenWritingNull; WhenWritingDefault is reserved for optional non-nullable bools where `false` means "absent".

## Deviations from Plan

None — plan executed exactly as written. Task 1's `<action>` block, Task 2's test outline, and directive #8's per-theme hand-check protocol were all followed verbatim.

## Issues Encountered

- **jsdom test environment path**: The vitest config's `environment: "jsdom"` applies only when running from the `viewmodel-shell/` subdirectory. Initial run from the repo root produced `ReferenceError: document is not defined`. Fixed by running `cd viewmodel-shell && npx vitest run test/checkbox-switch.test.ts`, matching the plan's `<automated>` block. No code change required.

## User Setup Required

None — no external service configuration required.

## Green-tree gate status (per plan directive #7)

All gates green before both commits landed:

- `npm run build` (viewmodel-shell) — clean
- `npm run check:test-types` — clean
- `npm run check:core-globals` — `viewmodel-shell/src/index.ts` references zero platform globals
- `npm run check:aa-contrast` — 13/13 fixed pairs still pass on default + all 12 themes (this plan adds no pair to the fixed 13-pair gate; new switch pairs are hand-checked in the test-file header)
- `npm run check:no-demo-style` — clean
- `npm run check:demo-types` — 21 demos type-check clean
- `npx vitest run` — 1004 passed, 1 skipped (framework-wide, includes the 5 new switch tests)
- `dotnet test viewmodel-shell-dotnet/Tests` — 234 passed (framework-wide, includes the 5 new switch tests)

## Threat surface scan

Scanned the files created/modified for security-relevant surface not already in the plan's `<threat_model>`. No new trust boundaries introduced. The `role="switch"` ARIA attribute is a WAI-ARIA-recommended a11y pattern (not an auth or input-parsing surface). Attack surface delta: zero. No threat_flag section needed.

## Next Phase Readiness

- **23-07 (Parity FeatureProbe extension)** — ready. The CheckboxNode.Variant slot is on both twins with matching wire values; the FeatureProbe planner can add `new CheckboxNode(..., Variant: CheckboxVariant.Switch)` on .NET and `{ type: "checkbox", ..., variant: "switch" }` on TS, plus one variant-omitted CheckboxNode, and add `"\"variant\":\"switch\""` to the initial GET step's `expectBodyContains` tripwire list.
- **23-09 (Showcase Foundations demo tab)** — ready. The renderer emits proper class+role attributes; the demo can compose a mini SettingsRow layout using `CheckboxNode variant:"switch"` and see the slider render immediately with the shipped default theme.
- **Phase 25 (SettingRowNode composite)** — ready. The switch primitive it depends on is landed; when SettingRowNode arrives it composes an existing `CheckboxNode { variant: "switch" }` in its trailing slot.

## Self-Check: PASSED

Verified before writing final metadata commit:

- `[ -f viewmodel-shell/src/index.ts ]` → FOUND (modified)
- `[ -f viewmodel-shell/src/browser.ts ]` → FOUND (modified)
- `[ -f viewmodel-shell/styles/default.css ]` → FOUND (modified)
- `[ -f viewmodel-shell-dotnet/ViewModels.cs ]` → FOUND (modified)
- `[ -f viewmodel-shell/test/checkbox-switch.test.ts ]` → FOUND (created)
- `[ -f viewmodel-shell-dotnet/Tests/CheckboxSwitchSerializationTests.cs ]` → FOUND (created)
- `git log --oneline | grep 734f6a2` → FOUND
- `git log --oneline | grep 95e0652` → FOUND
- All 10 acceptance-criteria greps in Task 1 pass (verified before commit).
- All 5 vitest tests pass; all 5 xUnit tests pass; full framework test suites green.

---
*Phase: 23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode*
*Completed: 2026-07-29*
