---
phase: 14-non-blocking-dispatch-core
plan: 02
subsystem: api
tags: [dotnet, system-text-json, wire-format, non-blocking-dispatch]

# Dependency graph
requires: []
provides:
  - "ActionDescriptor(string Name, bool? Blocking = null) in viewmodel-shell-dotnet/ViewModels.cs — the .NET half of the ActionEvent.blocking wire field"
  - "ActionDescriptorBlockingSerializationTests.cs proving absent/false/true wire behavior under default serializer options"
affects: [14-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "bool? + [JsonIgnore(Condition = WhenWritingNull)] for optional bools whose semantic 'unset' value is TRUE (opposite polarity of Fill/External/FollowTail, which use bool + WhenWritingDefault)"

key-files:
  created:
    - viewmodel-shell-dotnet/Tests/ActionDescriptorBlockingSerializationTests.cs
  modified:
    - viewmodel-shell-dotnet/ViewModels.cs

key-decisions:
  - "Used bool? + WhenWritingNull (matching SectionNode.Collapsible), not bool + WhenWritingDefault (matching Fill/External/FollowTail) — because Blocking's semantic default is true, the opposite polarity from those false-default fields; WhenWritingDefault always compares against CLR default(bool)=false and would invert which value gets dropped."

requirements-completed: [NBA-04]

# Metrics
duration: 12min
completed: 2026-07-08
---

# Phase 14 Plan 02: ActionDescriptor.Blocking (.NET wire field) Summary

**Added `bool? Blocking` to .NET `ActionDescriptor` using `WhenWritingNull` (not `WhenWritingDefault`) to correctly omit the true-default field from the wire, byte-aligned with the TS `ActionEvent.blocking?` field landed in Plan 14-01.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-08T09:28:00-04:00 (approx)
- **Completed:** 2026-07-08T09:40:34-04:00
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- `ActionDescriptor` now carries an optional `Blocking` property, positional-optional so every existing single-argument call site (114 across the framework + demos) still compiles unchanged
- Three serialization tests prove the wire contract: `Blocking:false` → `"blocking":false` present, `Blocking` omitted/null → `"blocking"` absent, `Blocking:true` → `"blocking":true` present — all under default `JsonSerializerOptions` (camelCase only, no host `DefaultIgnoreCondition`), proving the null-omission contract is intrinsic to the attribute
- Extensive doc comment on the property explains why `bool?` + `WhenWritingNull` is correct here and `bool` + `WhenWritingDefault` (used by `Fill`/`External`/`FollowTail`) would be wrong, citing the `SectionNode.Collapsible` precedent
- No validator changes needed — `ActionDescriptor` is an existing type already walked via `.Name` by `Collect`/`WalkForSectionAction`; the added property introduces no new node/field for them to discover

## Task Commits

Each task was committed atomically:

1. **Task 1: ActionDescriptor.Blocking (bool? + WhenWritingNull) + serialization tests** - `3c5bf71` (feat)

## Files Created/Modified
- `viewmodel-shell-dotnet/ViewModels.cs` - Added `bool? Blocking = null` to `ActionDescriptor` with `[JsonIgnore(Condition = WhenWritingNull)]` and a full doc comment on the mechanism choice
- `viewmodel-shell-dotnet/Tests/ActionDescriptorBlockingSerializationTests.cs` - Three `[Fact]` tests (false/omitted/true) mirroring `FillSerializationTests.cs`'s structure, wrapping `ActionDescriptor` in a `SectionNode.Action` and serializing through the polymorphic `ViewNode` base

## Decisions Made
- Followed the plan exactly: `bool?` + `WhenWritingNull`, not `bool` + `WhenWritingDefault`, because `Blocking`'s semantic default (true) has the opposite polarity from the CLR `default(bool)` (false) that `WhenWritingDefault` always compares against.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Framework project builds with zero errors/warnings; the framework's own `.NET` test project (`viewmodel-shell-dotnet/Tests`) passes 102/102 (99 pre-existing + 3 new).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Both halves of NBA-04 (`blocking` absent-when-default on both backends) are now landed: TS side in Plan 14-01, .NET side here. Plan 14-03 (wave 2, depends on both) can proceed to prove the resulting wire shape is byte-identical between backends via the cross-backend parity harness. No version bump or publish was performed in this plan, per the plan's explicit scope.

---
*Phase: 14-non-blocking-dispatch-core*
*Completed: 2026-07-08*
