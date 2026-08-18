---
phase: 32
plan: "02"
subsystem: dotnet-filter
tags: [wire-types, filter, reference-truth, tdd, dotnet]
dependency-graph:
  requires: [32-01]
  provides: [FilterHelper.MatchesFilter, FilterSpec, FilterDescriptor, FilterRule, TableColumn.Filter, TableNode.FilterDescriptorBinds]
  affects: [viewmodel-shell-dotnet/ViewModels.cs, viewmodel-shell-dotnet/FilterHelper.cs, viewmodel-shell-dotnet/Tests/ColumnFilterTests.cs]
tech-stack:
  added: []
  patterns: [tdd-red-green, mutation-verify, nasa-test-suite]
key-files:
  created:
    - viewmodel-shell-dotnet/FilterHelper.cs
    - viewmodel-shell-dotnet/Tests/ColumnFilterTests.cs
  modified:
    - viewmodel-shell-dotnet/ViewModels.cs
decisions:
  - "JsonElement deserialization handled in all helpers (TryGetDouble, GetRuleString, ToBool, DeserializeDoubleArray, DeserializeStringArray) because FilterRule.Value is typed object? which arrives as JsonElement after JSON round-trip"
  - "Unknown joiner treated as all-of (fail-safe, matches TS behavior)"
  - "Unknown kind and unknown operator return false (fail-safe)"
  - "No short-circuit: results[] array evaluates every rule before applying joiner (per CONTEXT D-06)"
  - "whitespace-only is NOT empty (matches TS IsEmpty semantics)"
  - "ignore-punctuation strips $, pound, euro, comma, period via pre-compiled Regex"
  - "Date comparison is ISO-8601 ordinal string comparison — no parsing, no timezone math (per D-03)"
metrics:
  duration: "~30 minutes"
  completed: "2026-08-18T19:39:51Z"
  tasks-completed: 2
  tests-added: 126
  total-tests-after: 622
---

# Phase 32 Plan 02: .NET Wire Types + FilterHelper Reference Truth Summary

FilterSpec/FilterDescriptor/FilterRule wire types added to ViewModels.cs; TableColumn.Filter and TableNode.FilterDescriptorBinds added as last positional parameters. FilterHelper.MatchesFilter implemented as the .NET reference truth function byte-parallel with the TS matchesFilter, with a 126-case NASA xUnit suite covering all 5 kinds × all operators × edge values including negative integers, decimals, JsonElement deserialization, and both joiners.

## Tasks Completed

| Task | Commit | Description |
|------|--------|-------------|
| 1 — Wire types | d4d58d6 | FilterSpec, FilterDescriptor, FilterRule records; TableColumn.Filter?; TableNode.FilterDescriptorBinds? |
| 2 — FilterHelper + Tests | 9e97c64 | FilterHelper.MatchesFilter + ColumnFilterTests.cs (126 cases, 622 total, all pass) |

## Wire Types Added (ViewModels.cs)

### New records

```csharp
public record FilterSpec(
    string Kind,
    IReadOnlyList<string>? Options = null,     // [JsonIgnore WhenWritingNull]
    IReadOnlyList<string>? MatchingHints = null // [JsonIgnore WhenWritingNull]
);

public record FilterRule(
    string Operator,
    object? Value = null                        // [JsonIgnore WhenWritingNull]
);

public record FilterDescriptor(
    IReadOnlyList<FilterRule> Rules,
    string Joiner
);
```

### New fields on existing records

- `TableColumn`: last positional param `FilterSpec? Filter = null` (WhenWritingNull)
- `TableNode`: last positional param `Dictionary<string, string>? FilterDescriptorBinds = null` (WhenWritingNull)

All old fields (`Filterable`, `FilterValue`, `FilterBinds`, `FilterAction`) are completely untouched.

## FilterHelper.MatchesFilter API

```csharp
public static bool MatchesFilter(
    FilterDescriptor descriptor,
    object? rawValue,
    string displayString,
    string kind,
    IReadOnlyList<string>? matchingHints = null)
```

**Supported kinds**: text, number, date, fixed-set, yes-no (fail-safe false on unknown kind)

**Joiner semantics**: all-of (AND), any-of (OR), unknown joiner treated as all-of

**No short-circuit**: all rules evaluated before applying joiner (per CONTEXT D-06)

**Operator coverage per kind**:
- text: contains, equals, starts-with, ends-with, is-empty, is-not-empty
- number: contains, equals, does-not-equal, greater-than, greater-than-or-equal, less-than, less-than-or-equal, between, is-empty, is-not-empty
- date: contains, is, before, after, in-range, is-empty, is-not-empty
- fixed-set: contains, is, is-not, is-empty, is-not-empty
- yes-no: contains, is-true, is-false, is-empty, is-not-empty

## Test Suite

**File**: `viewmodel-shell-dotnet/Tests/ColumnFilterTests.cs`
**Cases**: 126 Theory cases (622 total suite tests, all pass)

Coverage includes:
- All 5 kinds × all operators
- Negative integers (rawValue=-5), decimals (3.14), negative decimals (-2.5)
- Four ISO date shapes: date-only, datetime+offset, datetime+Z, datetime-local
- ignore-punctuation hint ($, £, €, comma, period stripped)
- JsonElement deserialization (TryGetDouble, GetRuleString, ToBool, DeserializeDoubleArray/StringArray)
- 2-rule all-of, 2-rule any-of, 3-rule all-of, 3-rule any-of
- No-short-circuit verification cases
- Unknown joiner (treated as all-of), unknown kind (false), unknown operator (false)
- Edge cases: null rawValue, empty display string, between/in-range null bounds

## Mutation-Verify Session

All 7 mutations caught (fail-before, pass-after verified):

| Mutation | Tests Failed | Caught By |
|----------|-------------|-----------|
| contains: OrdinalIgnoreCase → Ordinal | 6 | Case-insensitive contains cases |
| number equals: == → != | 9 | Number equals match + JsonElement equals |
| is-empty: null → false | 8 | All is-empty null cases across kinds |
| greater-than: > → >= | 1 | "number greater-than no match equal" |
| date is: == 0 → != 0 | 8 | All date is match cases |
| fixed-set is: Ordinal → OrdinalIgnoreCase | 2 | Case-sensitive is match cases |
| is-true: == true → != true | 9 | All yes-no is-true cases |

## Verification

- `dotnet test` (622 total, 0 failed)
- Markdown companion builds clean (0 warnings, 0 errors)
- Every nullable field carries `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` per gotcha #8
- Old wire fields (Filterable, FilterValue, FilterBinds, FilterAction) untouched

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- viewmodel-shell-dotnet/FilterHelper.cs: FOUND
- viewmodel-shell-dotnet/Tests/ColumnFilterTests.cs: FOUND
- Commit d4d58d6 (Task 1): FOUND
- Commit 9e97c64 (Task 2): FOUND
