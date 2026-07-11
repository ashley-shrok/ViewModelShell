---
phase: 20-v5-1-navigation-primitives-breadcrumbnode-stepsnode-pointer-
plan: 02
subsystem: ui
tags: [viewnode, breadcrumb, steps, wire-types, dotnet, nuget, tree-validator, serialization]

# Dependency graph
requires:
  - phase: 20-v5-1
    plan: 01
    provides: "TS BreadcrumbNode/BreadcrumbItem + StepsNode/StepItem wire shapes (the locked source of truth this .NET twin mirrors byte-for-byte)"
provides:
  - "BreadcrumbNode + BreadcrumbItem .NET records (JsonDerivedType 'breadcrumb') with byte-identical optional-field posture"
  - "StepsNode + StepItem .NET records (JsonDerivedType 'steps'); Current required int always serializes, Orientation/Description omitted-when-null"
  - ".NET Collect walk descends into crumb Actions (uniqueness-checked); both nodes documented action-free/section-free leaves in both .NET walks"
  - "NavNodeSerializationTests proving absent-when-unset wire + Current-always-present + crumb-action Collect descent"
affects: [20-03 (browser renderer), 20-05 (FeatureProbe parity fixtures — diffs this .NET wire against the TS twin)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional-field attribute posture is the byte-identical contract: nullable → WhenWritingNull, optional-false bool → WhenWritingDefault, meaningful-0 int → NO ignore condition (gotcha #8)"
    - "Href/Orientation are string? (NOT C# enums) — the closed set is enforced TS-side + validated by parity, per the ChartNode.Kind rule"

key-files:
  created:
    - "viewmodel-shell-dotnet/Tests/NavNodeSerializationTests.cs — 12 wire-shape + validator assertions"
  modified:
    - "viewmodel-shell-dotnet/ViewModels.cs — BreadcrumbItem/BreadcrumbNode + StepItem/StepsNode records, 2 discriminators, Collect breadcrumb arm, leaf comments in both walks"

key-decisions:
  - "BreadcrumbItem: Href/Action nullable+WhenWritingNull, External bool+WhenWritingDefault (drops false→absent, exactly LinkNode.External) — matches TS { label, href?, external?, action? }."
  - "StepsNode.Current is a plain required int with NO JsonIgnore condition (0 is meaningful — first step current — so it always crosses the wire; precedent ProgressNode.Value)."
  - "Orientation + Description are string?/WhenWritingNull; NOT modelled as C# enums (parity + TS own the closed set)."
  - "No WalkForSectionAction arm for either node — neither holds ViewNode children — only extended leaf comments so the omission is provably deliberate (matches the TS twin's decision)."

patterns-established:
  - "New dispatch site (crumb Action) closes the missed-walk failure class the same way tabs/empty-state arms do: Collect descends and Records each action so duplicate names fail as invalid_tree."

# Metrics
duration: 6min
completed: 2026-07-11
---

# Phase 20 Plan 02: .NET BreadcrumbNode + StepsNode Twin + Serialization Test Summary

**Declared the .NET (NuGet) byte-identical twin of BreadcrumbNode + StepsNode — the `[JsonDerivedType]` discriminators, the records + sub-records with the exact optional-field attribute posture, the Collect breadcrumb action-descent arm, and a 12-case serialization test proving the wire matches the TS twin byte-for-byte (absent-when-unset; Current always present; crumb-action uniqueness enforced).**

## Performance

- **Duration:** ~6 min
- **Tasks:** 2 completed
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- `BreadcrumbItem`/`BreadcrumbNode` and `StepItem`/`StepsNode` exist as .NET records registered in the `ViewNode` polymorphic base with `"breadcrumb"` / `"steps"` discriminators — the NuGet side of the wire the TS twin (20-01) locked.
- The optional-field attribute posture is exactly the byte-identical contract (gotcha #8): `Href`/`Action`/`Description`/`Orientation` → `WhenWritingNull`; `External` → `WhenWritingDefault` (drops `false` → absent); `Current` → plain `int`, NO ignore condition (0 always serializes, ProgressNode precedent).
- The .NET `Collect` walk descends into each crumb's optional `Action`, so crumb dispatch names are subject to the one-name-one-operation uniqueness rule — no silently-exempt dispatch-bearing descendant. Both nodes are named in the fall-through leaf comments of both .NET walks (`Collect` + `WalkForSectionAction`).
- `NavNodeSerializationTests` (12 `[Fact]`s) proves it directly against `System.Text.Json` with camelCase-only options (no host `DefaultIgnoreCondition`), so the attributes carry the contract intrinsically.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare the .NET records + discriminators + validator arms** — `a016a72` (feat)
2. **Task 2: Serialization test proving byte-alignment + Current-always-serializes + crumb-action descent** — `1c5eadb` (test)

## Files Created/Modified
- `viewmodel-shell-dotnet/ViewModels.cs` — Added `BreadcrumbItem(Label, Href?, External=false, Action?)` + `BreadcrumbNode(Items)` near LinkNode; `StepItem(Label, Description?)` + `StepsNode(Steps, Current, Orientation?)` near ChartNode; appended the `breadcrumb` + `steps` `[JsonDerivedType]` lines; added the `case BreadcrumbNode bc` arm in `Collect` (mirrors the TabsNode arm, iterating `Items` and `Record`-ing each set `Action`); extended the fall-through leaf comments in both `Collect` and `WalkForSectionAction` to name both nodes (no `WalkForSectionAction` arm — no ViewNode children).
- `viewmodel-shell-dotnet/Tests/NavNodeSerializationTests.cs` — 12 assertions: discriminator strings; omitted crumb href/external/action absent; all-set crumb emits all three + the action object; `Current:0` and `Current:1` both serialize; `orientation` omitted-vs-`"vertical"`; `description` omitted-vs-present; duplicate crumb action names throw `Duplicate action name 'nav'`; href-only crumbs record no actions (passes).

## Per-Task Verification

| Task | Verification | Result |
|------|--------------|--------|
| 1 | `dotnet build --nologo -v minimal`; grep records/discriminators/`case BreadcrumbNode` each == 1 | Build succeeded (0 warn, 0 err); all 7 greps == 1 |
| 2 | `dotnet test Tests/Tests.csproj --nologo -v minimal` | **Passed! Failed: 0, Passed: 121, Skipped: 0** (12 new NavNodeSerializationTests included) |

## Deviations from Plan

None — plan executed exactly as written. The two extra convenience `[Fact]`s beyond the plan's enumerated set (discriminator-string assertions + `Current:1` non-zero case) are additive coverage within the same file/scope, not a deviation.

## Known Stubs

None. This is the .NET type + validator + serialization-proof layer only; the browser renderer (20-03), TUI degradation (20-04), and parity fixtures (20-05) are explicitly separate downstream plans.

## Threat Surface Scan

No new security-relevant surface. Per the plan's threat register: **T-20-03** (Tampering — optional-field attributes) is MITIGATED — each nullable field carries `WhenWritingNull`, the optional bool `WhenWritingDefault`, `Current` no ignore condition, and `NavNodeSerializationTests` asserts each directly so silent null/false-vs-absent drift is impossible. **T-20-04** (Information Disclosure — Collect breadcrumb arm) is MITIGATED — crumb action names are collected so duplicate/ambiguous dispatch names fail the tree validator (`invalid_tree`) rather than resolving to the wrong action, proven by the duplicate-crumb-action test. No package installs.

## Self-Check: PASSED
- `viewmodel-shell-dotnet/ViewModels.cs` — FOUND (contains `record BreadcrumbNode`, `record StepsNode`, both discriminators, `case BreadcrumbNode`)
- `viewmodel-shell-dotnet/Tests/NavNodeSerializationTests.cs` — FOUND
- Commit `a016a72` — FOUND
- Commit `1c5eadb` — FOUND
