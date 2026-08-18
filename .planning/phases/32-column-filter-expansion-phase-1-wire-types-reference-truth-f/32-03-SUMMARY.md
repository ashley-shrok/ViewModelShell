---
phase: 32
plan: "03"
subsystem: parity
tags: [parity, filter, cross-backend, tdd, mutation-verify, wire-types]
dependency-graph:
  requires: [32-01, 32-02]
  provides: [column-filter-wire-shape fixture, column-filter-helper fixture, FilterHelperProbe endpoint]
  affects:
    - parity/fixtures/column-filter-wire-shape.json
    - parity/fixtures/column-filter-helper.json
    - parity/backends.json
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - demo/FeatureProbe-bun/handler.ts
tech-stack:
  added: []
  patterns: [parity-fixture, findNulls-invariant, expectBodyContains-tripwire, mutation-verify, state-threaded-probe]
key-files:
  created:
    - parity/fixtures/column-filter-wire-shape.json
    - parity/fixtures/column-filter-helper.json
  modified:
    - parity/backends.json
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - demo/FeatureProbe-bun/handler.ts
decisions:
  - "FilterDescriptor stored in FeatureProbeState (FilterWireShapeDescriptor? field) so it serializes into the state JSON in the ShellResponse body where expectBodyContains can assert on wire substrings — building the descriptor only locally in BuildVm never reaches the response body"
  - "column-filter-helper fixture starts with a GET step to populate lastState with all fields before stateMutations apply — without this, the first POST step starts from null lastState and creates a partial state missing required fields like TableFilters, causing NullReferenceException"
  - "Mutation-verify requires rebuilding dist/server.js after applying the source stub — the bun/node-probe backends load dist/server.js not the raw TypeScript source"
  - "expectBodyContains uses haystack = JSON.stringify(body) so double-escaped quotes like \"\\\"operator\\\":\\\"contains\\\"\" are the correct fixture strings for matching inner JSON"
metrics:
  duration: "~90 minutes"
  completed: "2026-08-18T21:00:00Z"
  tasks-completed: 2
  wire-shape-fixture-steps: 5
  helper-fixture-steps: 101
  backends-covered: 3
---

# Phase 32 Plan 03: Column Filter Parity Fixtures + Cross-Backend Byte-Parallel Summary

Cross-backend parity coverage for Phase 32 column filter expansion. Two fixtures prove that FilterSpec/FilterDescriptor wire types serialize byte-identically (wire-shape fixture) and that matchesFilter / FilterHelper.MatchesFilter return byte-identical boolean results (helper fixture) across all three FeatureProbe backends. `bun run parity/run.ts` fully green. REQ-CF1-07 mutation-verify completed.

## Tasks Completed

| Task | Commit | Description |
|------|--------|-------------|
| 1 — Extend FeatureProbe backends | a327486 | FilterWireShapeProbe + FilterHelperProbe + FilterHelperProbeResult state slots, action arms, buildVm sections on both .NET and bun twins |
| 2 — Fixtures + backends.json + mutation-verify | f1b9d01 | column-filter-wire-shape.json (5 steps) + column-filter-helper.json (101 steps) created; backends.json updated; FilterWireShapeDescriptor? added to state for wire-body serialization; mutation-verify completed |

## Fixtures Created

### column-filter-wire-shape.json (5 steps)

Proves that FilterSpec + FilterDescriptor serialize byte-identically across all 3 FeatureProbe backends. Covers the four FilterDescriptor combinations required by SPEC Requirement 3:

| Step | Branch | expectBodyContains tripwires |
|------|--------|------------------------------|
| wire-shape-initial | GET / unset | `FilterWireShapeProbe=`, `Phase 32 filter wire-shape probe` |
| wire-shape-one-rule-with-value | one rule + value | `FilterWireShapeProbe=one-rule-with-value`, `"operator":"contains"`, `"joiner":"all-of"`, `"value":"hello"` |
| wire-shape-one-rule-no-value | is-empty (no value) | `FilterWireShapeProbe=one-rule-no-value`, `"operator":"is-empty"` — findNulls proves value ABSENT |
| wire-shape-two-rules-any-of | 2-rule any-of | `FilterWireShapeProbe=two-rules-any-of`, `"joiner":"any-of"` |
| wire-shape-three-rules-all-of | 3-rule all-of | `FilterWireShapeProbe=three-rules-all-of`, `"joiner":"all-of"`, `"starts-with"` |

SPEC Req 3 acceptance criteria proven:
- (a) is-empty rule: `"value"` key ABSENT from serialized rule (proven by findNulls always-on invariant + absence of `"value"` in the fixture's expectBodyContains for that step)
- (b) any-of joiner: `"joiner":"any-of"` crosses the wire byte-identically
- (c) three-rule all-of: `"starts-with"` only appears in the third rule, confirming all three rules serialized

### column-filter-helper.json (101 steps)

101 steps (1 GET initial + 100 probe cases) proving matchesFilter (TS) / FilterHelper.MatchesFilter (.NET) return byte-identical boolean results across all 3 backends on a representative sample:

| Group | Steps | Operators covered |
|-------|-------|------------------|
| TEXT | ~16 | contains (match/no-match/case-insensitive/ignore-punctuation), equals (exact/case-sensitive/different), starts-with, ends-with, is-empty (null/empty string/whitespace), is-not-empty |
| NUMBER | ~12 | contains, equals, does-not-equal, greater-than, greater-than-or-equal, less-than, less-than-or-equal, between (match/boundary/no-match), is-empty (null/0), is-not-empty |
| DATE | ~20 | is, before, after, in-range × all 4 D-03 ISO date shapes |
| FIXED-SET | ~9 | contains (case-insensitive match/no-match), is (exact/case-sensitive-no-match), is-not (no-match/match-inverted), is-empty (null/value), is-not-empty |
| YES-NO | ~10 | is-true (true/false/null), is-false (false/true/null), is-empty (null/false/true), is-not-empty |
| MULTI-RULE | ~9 | all-of (2-rule both match/second-fails/first-fails), any-of (first-matches/both-fail/second-matches), 3-rule all-of (all-match/one-fails), 3-rule any-of (one-matches) |
| EDGE CASES | ~8 | negative integer, decimal, negative decimal, ignore-punctuation (euro/pound), between boundary at edges, null rawValue across kinds |

All four D-03 ISO date shapes present:
- `2026-08-15` (date-only)
- `2026-08-15T09:00:00-04:00` (datetime + offset)
- `2026-08-15T13:00:00Z` (UTC-Z)
- `2026-08-15T09:00:00` (naive datetime)

## backends.json Changes

Three FeatureProbe backend entries (dotnet-probe, bun-probe, node-probe) updated:
```
"fixtures": ["feature-probe", "feature-probe-envelope", "chat-composer", "textnode-maxlines", "column-filter-wire-shape", "column-filter-helper"]
```

## Parity Run Results

```
Fixture 'column-filter-wire-shape' across 3 backends:
  dotnet-probe: 5 steps captured
  bun-probe: 5 steps captured
  node-probe: 5 steps captured
  ✓ all backends agree
Fixture 'column-filter-helper' across 3 backends:
  dotnet-probe: 101 steps captured
  bun-probe: 101 steps captured
  node-probe: 101 steps captured
  ✓ all backends agree
✓ Parity tests passed
```

## Cross-backend Gate Mutation-verify (REQ-CF1-07)

**Operator stubbed:** `text` / `contains` in `viewmodel-shell/src/server.ts`

**Stub applied:** Changed `return applyContains(displayString, rule.value, matchingHints)` to `return !applyContains(displayString, rule.value, matchingHints)` in the `text` kind `contains` case of `matchesFilter`.

**dist rebuilt:** `npm run build` in `viewmodel-shell/` to propagate the stub to `dist/server.js` (which bun/node-probe backends load at runtime — the source change alone is invisible to the backends).

**Parity exit code with stub:** `1` (non-zero — gate failed as required)

**Failing step:** `bun-probe step 'text-contains-match'` — missing expected substring `FilterHelperProbeResult=true`. The stub caused the text/contains operator to return `false` (inverted), so a match case returned false, failing the `expectBodyContains` tripwire.

**Stub restored:** `git checkout viewmodel-shell/src/server.ts` + `npm run build`

**Parity exit code after restore:** `0` (gate returned to green)

**Conclusion:** The parity gate reliably detects a single-operator divergence between TS and .NET backends. The tripwire (`expectBodyContains: ["FilterHelperProbeResult=true"]`) catches the inverted result because the bun/TS backend returns false while the assertion expects true — fail-loud, not silently vacuous.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FilterDescriptor not serialized into response body**
- **Found during:** Task 2 parity run (step 'wire-shape-one-rule-with-value' failed `expectBodyContains`)
- **Issue:** The FilterDescriptor was built as a local variable in BuildVm and referenced via `FilterDescriptorBinds` (a string→string path map). The descriptor never appeared in the response body (neither `vm` nor `state`), so `expectBodyContains` for `"operator":"contains"` always failed.
- **Fix:** Added `FilterWireShapeDescriptor? FilterDescriptor` to FeatureProbeState (.NET) / `filterWireShapeDescriptor?: FilterDescriptor` to bun state interface. Updated action arms to store the descriptor in state alongside the discriminator string. Updated `FilterDescriptorBinds` to reference `"filterWireShapeDescriptor"` (the actual state path). The descriptor now serializes into the `state` field of the ShellResponse body.
- **Files modified:** `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`, `demo/FeatureProbe-bun/handler.ts`
- **Commit:** f1b9d01

**2. [Rule 1 - Bug] column-filter-helper fixture NullReferenceException on first POST step**
- **Found during:** Task 2 parity run (step 'text-contains-match' 500 on dotnet-probe)
- **Issue:** The helper fixture had no GET initial step. The harness starts each fixture with `lastState = null`. `stateMutations` applied to null creates a state with only one field (`filterHelperProbe`). When .NET deserializes this partial state, `TableFilters` is null and `Window(s)` crashes at `s.TableFilters.Name`.
- **Fix:** Added `{ "id": "initial", "method": "GET", ... }` as the first step of `column-filter-helper.json`. This populates `lastState` with the full initial state before any POST steps apply mutations.
- **Files modified:** `parity/fixtures/column-filter-helper.json`
- **Commit:** f1b9d01

**3. [Rule 1 - Bug] Mutation-verify stub not visible to parity backends (dist rebuild required)**
- **Found during:** Mutation-verify step — parity exited 0 after applying the source stub
- **Issue:** The bun/node-probe backends load `dist/server.js` (the compiled output) not the raw TypeScript source. Mutating `server.ts` has no effect until `npm run build` is run in `viewmodel-shell/`.
- **Fix:** Added `npm run build` step in `viewmodel-shell/` after applying the stub AND after restoring it, to ensure the dist reflects the current source state.
- **Files modified:** None (process fix, not code fix)

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes beyond the planned FeatureProbe probe endpoint (T-32-03-01 accepted, dev/parity demo only, returns a boolean, no sensitive data).

## Self-Check: PASSED

- parity/fixtures/column-filter-wire-shape.json: FOUND (5 steps)
- parity/fixtures/column-filter-helper.json: FOUND (101 steps)
- Commit a327486 (Task 1): FOUND
- Commit f1b9d01 (Task 2): FOUND
- `grep -c "column-filter-wire-shape" parity/backends.json` = 3: PASSED
- `grep -c "column-filter-helper" parity/backends.json` = 3: PASSED
- `grep -c "2026-08-15T09:00:00-04:00" parity/fixtures/column-filter-helper.json` >= 1: PASSED (= 2)
- `bun run parity/run.ts` exit 0 (restored): PASSED
