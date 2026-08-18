---
phase: 32-column-filter-expansion-phase-1-wire-types-reference-truth-f
plan: "01"
subsystem: framework-wire
tags:
  - column-filter
  - typed-filter
  - matchesFilter
  - nasa-tests
dependency_graph:
  requires: []
  provides:
    - FilterSpec type (index.ts)
    - FilterDescriptor type (index.ts)
    - ValueKind type (index.ts)
    - operator aliases (index.ts)
    - MatchingHint type (index.ts)
    - TableColumn.filter? (index.ts)
    - TableNode.filterDescriptorBinds? (index.ts)
    - matchesFilter (server.ts)
    - column-filter NASA vitest suite (test/column-filter.test.ts)
  affects:
    - viewmodel-shell/src/index.ts (additive wire types)
    - viewmodel-shell/src/server.ts (new export)
tech_stack:
  added: []
  patterns:
    - table-driven vitest with it.each for exhaustive Cartesian coverage
    - "ISO date string comparison (lexicographic = chronological, D-03)"
    - "no-short-circuit multi-rule evaluation (all rules evaluated)"
key_files:
  created:
    - viewmodel-shell/test/column-filter.test.ts (162 test cases)
  modified:
    - viewmodel-shell/src/index.ts (lines 1279-1441 — 174 lines added before TableColumn)
    - viewmodel-shell/src/server.ts (lines 1350-1568 — 219 lines added)
decisions:
  - "FilterSpec is a plain record with named subfields (kind, options?, matchingHints?) — NOT a discriminated union — matching the existing wire-type convention (D-01)"
  - "matchesFilter takes matchingHints as optional 5th arg (not embedded in descriptor) — kind is column schema, descriptor is filter instance (CONTEXT Claude's Discretion)"
  - "Unknown operators return false (no match) — tamper-safe per T-32-01-01"
  - "isEmpty: null|undefined|'' only; whitespace-only NOT empty — raw value semantics per SPEC Req 6"
  - "No short-circuit: all rules evaluated regardless of intermediate results — SPEC Req 6 / CONTEXT D-03"
  - "equals on text is case-sensitive (matches raw value semantics)"
  - "starts-with/ends-with on text are case-insensitive"
  - "0 and false are not empty (valid typed values)"
metrics:
  duration: "~30 minutes"
  completed: "2026-08-18T19:36:00Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 32 Plan 01: TypeScript wire types + matchesFilter reference truth function + NASA vitest suite — Summary

TypeScript side of Phase 32: additive filter wire vocabulary (ValueKind, operator aliases, FilterSpec, FilterDescriptor, MatchingHint) on index.ts; matchesFilter reference truth function on server.ts; 162-case NASA vitest suite covering every operator x type x value-shape combination.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add TS wire types to index.ts | 11c5163 | viewmodel-shell/src/index.ts |
| 2 | Add matchesFilter + NASA vitest suite | 944eda4 | viewmodel-shell/src/server.ts, viewmodel-shell/test/column-filter.test.ts |

## What Was Built

### Task 1 — index.ts wire types (commit 11c5163)

Added before `export interface TableColumn` (lines ~1279-1441 in the modified file):

- `ValueKind` — closed union: `"text" | "number" | "date" | "fixed-set" | "yes-no"`
- `TextOperator` — 6 operators: `contains`, `equals`, `starts-with`, `ends-with`, `is-empty`, `is-not-empty`
- `NumberOperator` — 10 operators: `contains`, `equals`, `does-not-equal`, `greater-than`, `greater-than-or-equal`, `less-than`, `less-than-or-equal`, `between`, `is-empty`, `is-not-empty`
- `DateOperator` — 7 operators: `contains`, `is`, `before`, `after`, `in-range`, `is-empty`, `is-not-empty`
- `FixedSetOperator` — 5 operators: `contains`, `is`, `is-not`, `is-empty`, `is-not-empty`
- `YesNoOperator` — 5 operators: `contains`, `is-true`, `is-false`, `is-empty`, `is-not-empty`
- `MatchingHint` — `"ignore-punctuation"` (strips $, £, €, commas, periods before contains comparison)
- `FilterRule` — `{ operator, value?: unknown }` (value absent for no-value operators per gotcha #8)
- `FilterDescriptor` — `{ rules: FilterRule[], joiner: "all-of" | "any-of" }`
- `FilterSpec` — `{ kind: ValueKind, options?: string[], matchingHints?: MatchingHint[] }`
- `TableColumn.filter?: FilterSpec` — after existing `filterValue?` (old fields UNTOUCHED)
- `TableNode.filterDescriptorBinds?: Record<string, string>` — after existing `filterBinds?` (old field UNTOUCHED)

All four legacy fields (`filterable`, `filterValue`, `filterBinds`, `filterAction`) remain present and unmodified.

### Task 2 — server.ts matchesFilter + test suite (commit 944eda4)

**server.ts additions** (exported `matchesFilter` plus private helpers):

- `isEmpty(v: unknown): boolean` — null | undefined | "" → empty; whitespace-only NOT empty
- `applyContains(displayString, ruleValue, matchingHints?)` — case-insensitive display-string contains; strips `[$£€,.]` when `ignore-punctuation` in matchingHints
- `isoCompare(a, b): number` — lexicographic comparison (ISO-8601's chron-sort property)
- `evaluateRule(rule, rawValue, displayString, kind, matchingHints?)` — switch on kind → switch on operator → return boolean. Unknown operators return false (T-32-01-01 tamper safety)
- `export function matchesFilter(descriptor, rawValue, displayString, kind, matchingHints?)` — collects per-rule results (no short-circuit), combines by joiner

**test/column-filter.test.ts** (162 test cases across 6 describe blocks):

| Describe block | Cases |
|----------------|-------|
| TEXT kind | 31 |
| NUMBER kind | 40 |
| DATE kind (four ISO shapes — D-03) | 34 |
| FIXED-SET kind | 12 |
| YES-NO kind | 14 |
| MULTI-RULE (2-rule representative + 3-rule diagonal) | 30 |
| Total count assertion | 1 |

The test includes:
- All operators × all kinds × representative value shapes
- null, empty string, whitespace-only, unicode (multi-byte, combining marks, RTL), very-long (≥1000 chars)
- Negative integers, decimals, negative decimals for number (SPEC Req 8)
- All four D-03 ISO date shapes: date-only (`2026-08-15`), datetime+offset (`2026-08-15T09:00:00-04:00`), UTC-Z (`2026-08-15T13:00:00Z`), naive (`2026-08-15T09:00:00`)
- ignore-punctuation hint cases: $, £, €, comma formatting
- Joiner proven: both all-of and any-of, with disagreement cases
- 3-rule diagonal per kind per joiner: all match / some match / one match
- Unknown operator returns false (tamper-safe)

## Verification Command Results

```
cd viewmodel-shell && npx vitest run test/column-filter.test.ts
# ✓ test/column-filter.test.ts (162 tests) 8ms
# Tests  162 passed (162)

cd viewmodel-shell && npx vitest run
# Test Files  87 passed (87)
# Tests  1561 passed | 1 skipped (1562) — zero regressions

cd viewmodel-shell && npm run check:test-types
# (exits 0 — no output = success)

cd viewmodel-shell && npm run check:core-globals
# ✓ AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals.
```

## Mutation-Verify Session

Documented one-time session run during Task 2 execution. Each stub below caused at least one test case to go red, confirming the suite is not vacuously passing.

| Operator Stubbed | Stub | Failures Observed |
|-----------------|------|-------------------|
| text/contains → `return false` | always false | 16 failures |
| text/is-empty → `return false` | always false | 3 failures |
| number/equals → `return true` | always true | 4 failures |
| date/before → `return false` | always false | 5 failures |
| fixed-set/is → `return false` | always false | 2 failures |
| yes-no/is-true → `return false` | always false | 2 failures |
| number/between → `return true` | always true | 2 failures |
| any-of joiner → `return false` | always false | 8 failures |

**Result: 8/8 stubs caused test failures.** No stub produced zero failures. The suite is mutation-verified.

## Deviations from Plan

None — plan executed exactly as written. One test-case value correction during implementation: the test `text/contains/unicode-multibyte` initially used `"sume"` as the search term against `"résumé"` but `"résumé"` = r + é + s + u + m + é, so "sume" is not a substring. Corrected to `"sum"` which IS a substring. This is a test authoring fix, not a deviation from the plan's intent.

## Threat Flags

None found. The implementation introduces no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. `matchesFilter` is a pure function with no I/O.

## Known Stubs

None. All operators are fully implemented. The test suite proves every operator path.

## Self-Check

- [x] `viewmodel-shell/src/index.ts` — modified with 174 new lines. Commit 11c5163.
- [x] `viewmodel-shell/src/server.ts` — modified with 219 new lines. Commit 944eda4.
- [x] `viewmodel-shell/test/column-filter.test.ts` — created with 162 test cases. Commit 944eda4.
- [x] All commits exist: `git log --oneline | grep "11c5163\|944eda4"` → both present.
- [x] Old fields intact: filterable(5), filterBinds(5) grepcounts confirm.
- [x] check:test-types: exits 0.
- [x] check:core-globals: exits 0.
- [x] Full vitest suite: 87 files, 1561 passed, 0 regressions.

## Self-Check: PASSED
