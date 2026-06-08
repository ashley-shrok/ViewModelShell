---
phase: 07-error-envelope-ok-flag-1-0-0-release-closeout
plan: "04"
subsystem: parity-harness
tags: [parity, error-envelope, ok-flag, expectStatus, malformedBody, compareIgnoreFields, fixture]
dependency_graph:
  requires: [07-01, 07-02, 07-03]
  provides: [feature-probe-envelope-fixture, ok-sweep-D20, T2-status-mitigation-parity-layer]
  affects:
    - parity/run.ts
    - parity/README.md
    - parity/backends.json
    - parity/fixtures/feature-probe-envelope.json
    - demo/Tasks-bun/server.ts
    - demo/ContactManager-bun/server.ts
    - demo/ExpenseTracker-bun/server.ts
    - demo/RetroBoard-bun/server.ts
    - demo/Reorder-bun/server.ts
    - demo/FeatureProbe-bun/handler.ts
    - demo/HelpDesk-bun/server.ts
tech_stack:
  added: []
  patterns: [expectStatus-envelope-gate, malformedBody-fixture-construction, compareIgnoreFields-per-step-diff-exclusion, ok-sweep-D20]
key_files:
  created:
    - parity/fixtures/feature-probe-envelope.json
  modified:
    - parity/run.ts
    - parity/README.md
    - parity/backends.json
    - demo/Tasks-bun/server.ts
    - demo/ContactManager-bun/server.ts
    - demo/ExpenseTracker-bun/server.ts
    - demo/RetroBoard-bun/server.ts
    - demo/Reorder-bun/server.ts
    - demo/FeatureProbe-bun/handler.ts
    - demo/HelpDesk-bun/server.ts
decisions:
  - "D-20 ok:true sweep enforced at parity layer — every success-path step asserts body.ok === true; every expectStatus-bearing step asserts body.ok === false"
  - "compareIgnoreFields scoped to parse-error step's errors[0].message only — all other fields on all other steps are fully diffed; plan 01's OfParseError factory is NOT modified (D-18: shipped contracts locked)"
  - "Bun demo GET handlers needed ok:true added manually — createAction wrapper only covers POST; the D-20 assertion exposed this gap across 7 servers (Rule 2: auto-added missing correctness requirement)"
  - "clearPath helper uses JSON.parse(JSON.stringify()) deep clone before field deletion — no Structuredclone dependency concern in Bun runtime"
  - "status field folded into CapturedResponse so cross-backend diff includes HTTP status — proves T2 status-misclassification mitigation at parity layer"
metrics:
  duration: "~20m"
  completed_date: "2026-06-08"
  tasks_completed: 1
  files_created: 1
  files_modified: 10
---

# Phase 7 Plan 04: Parity Envelope Fixture + ok:true Sweep Summary

Parity harness extended with three additive FixtureStep fields (expectStatus, malformedBody, compareIgnoreFields), D-20 ok:true assertion sweep on all success-path steps, new feature-probe-envelope fixture covering the three envelope cases, and bun demo GET handler ok:true wiring. All 8 fixtures pass across all 15 backends.

## Tasks Completed

| Task | Description | Commit | Result |
|------|-------------|--------|--------|
| 1 | parity runner extensions + feature-probe-envelope fixture + ok:true sweep | eaf192d | 8/8 fixtures ✓ all backends agree across 15 backends |

## Runner Changes — parity/run.ts

### New FixtureStep Fields

Three additive optional fields added at the FixtureStep interface (lines 64-80 in the new code):

**`expectStatus?: number`** (line 64):
- Honored in the capture loop: asserts `res.status === step.expectStatus` instead of throwing on `!res.ok`
- Also asserts `body.ok === false` on such steps (envelope-path gate)

**`malformedBody?: "empty-action" | "non-json" | "missing-action-field"`** (line 71):
- Honored in the multipart body construction (before the existing `form.append("_action", ...)` call)
- `"empty-action"` appends `_action` with empty string; `"non-json"` with broken JSON; `"missing-action-field"` skips appending entirely
- Step's `action` field is ignored when `malformedBody` is set

**`compareIgnoreFields?: string[]`** (line 77):
- Honored in the diff loop; for each field, `clearPath()` is called on a `JSON.parse(JSON.stringify(...))` deep clone of both baseline and other responses BEFORE `normalize()` + `diff()`
- Used only for `errors.0.message` on the parse-error step (library-flavored divergence: System.Text.Json vs JSON.parse messages)

### D-20 ok:true Assertion Sweep

In the capture loop (lines following the `expectStatus` check):
- Success-path steps (no `expectStatus`): asserts `body.ok === true` — fails with clear message if `ok` is absent or wrong
- Envelope-path steps (with `expectStatus`): asserts `body.ok === false` — proves the framework signals failure correctly

### clearPath Helper

Private helper at `parity/run.ts` (before `loadFixture`):
- Splits dotted path on `.`, walks to the parent node, deletes the leaf
- No-ops on missing intermediate segments (defensive)
- Array segments handled via `Number(seg)` — supports `errors.0.message` path pattern

### CapturedResponse Interface

Added `status?: number`, `ok?: boolean`, and `errors?: unknown` — so the `status` field is folded into each captured response and the cross-backend diff includes it (T2 status-misclassification proof at parity layer).

## New Fixture — parity/fixtures/feature-probe-envelope.json

Four steps:

| Step ID | Method | malformedBody | expectStatus | compareIgnoreFields |
|---------|--------|---------------|--------------|---------------------|
| initial-load | GET | — | — | — |
| malformed-payload | POST | empty-action | 400 | errors.0.message |
| unknown-action | POST | — | 400 | — |
| uncaught-throw | POST | — | 500 | — |

Representative captured response for the parse-error step (pre-diff state, with `errors[0].message` present but excluded from comparison):

```json
{
  "step": "malformed-payload",
  "status": 400,
  "ok": false,
  "errors": [
    {
      "message": "<differs per backend — excluded by compareIgnoreFields>",
      "code": "parse_error"
    }
  ]
}
```

The `status`, `ok`, and `errors[0].code` fields ARE fully diffed and must be byte-identical across .NET, bun, and node. Only `errors[0].message` is excluded.

## backends.json — FeatureProbe Backend Updates

Three backends updated from `["feature-probe"]` to `["feature-probe", "feature-probe-envelope"]`:
- `dotnet-probe` (line 115)
- `bun-probe` (line 125)
- `node-probe` (line 135)

## Parity Run Output

```
Fixture 'tasks' across 2 backends:
  ✓ all backends agree
Fixture 'contacts' across 2 backends:
  ✓ all backends agree
Fixture 'retro' across 2 backends:
  ✓ all backends agree
Fixture 'expenses' across 2 backends:
  ✓ all backends agree
Fixture 'helpdesk' across 2 backends:
  ✓ all backends agree
Fixture 'feature-probe' across 3 backends:
  ✓ all backends agree
Fixture 'feature-probe-envelope' across 3 backends:
  ✓ all backends agree
Fixture 'reorder' across 2 backends:
  ✓ all backends agree

✓ Parity tests passed
```

## Shipped Contract Verification

```
git diff viewmodel-shell/src/server.ts viewmodel-shell-dotnet/ViewModels.cs
# Returns nothing (0 lines) — Plan 01's contracts are NOT modified in this plan
```

## Pre-existing Test Results

- **vitest (full suite):** 236 tests pass, 1 skipped (unchanged from Plan 03)
- **.NET xUnit framework tests:** 45/45 pass (unchanged from Plan 03)
- **core-globals check:** PASS — no changes to index.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing correctness requirement] Added ok:true to all 7 bun demo GET handlers**

- **Found during:** Task 1 — first parity run attempt failed with `bun-tasks step 'initial-load' expected ok:true on success path, got ok:undefined`
- **Issue:** The D-20 ok:true assertion sweep correctly caught that bun demo GET handlers (`/api/<route>` endpoints) return `Response.json({ vm, state })` without `ok: true`. The `createAction` wrapper from Plan 01 only covers POST action endpoints — the GET initial-load path was never updated to include `ok: true`.
- **Root cause:** Plan 01 centralized `ok: true` in `createAction` (POST path) and `ShellResponse<TState>.Ok = true` (in .NET — auto-included in all responses). The TS bun demos' GET handlers call `Response.json({ vm, state })` directly, bypassing the createAction wrapper.
- **Fix:** Added `ok: true` to all 7 bun demo GET handler `Response.json()` calls: Tasks-bun, ContactManager-bun, ExpenseTracker-bun, RetroBoard-bun, Reorder-bun, FeatureProbe-bun/handler.ts (covers both bun-probe and node-probe), HelpDesk-bun (both agent and requester GET endpoints)
- **Files modified:** 7 bun demo server files
- **Commit:** eaf192d (same commit as main task — applied inline, re-ran parity to confirm)

## Known Stubs

None — all new types fully implemented. The envelope fixture is complete and passes. No placeholder data or incomplete wiring.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. Changes are entirely in the parity test harness (which only runs locally/CI) and in the bun demo GET handlers (adding a field that was already present in .NET). T-07-10 (status misclassification) mitigation is active: the `expectStatus` check in the harness proves a future "simplify to uniform 200" refactor breaks the build immediately.

## Self-Check: PASSED

- parity/fixtures/feature-probe-envelope.json: FOUND
- parity/run.ts (expectStatus, malformedBody, compareIgnoreFields, clearPath): FOUND (8, 5, 5, 3 matches)
- parity/backends.json (3 × feature-probe-envelope): FOUND (count=3)
- parity/README.md updated: FOUND
- 7 bun demo GET handlers with ok:true: VERIFIED
- viewmodel-shell/src/server.ts unchanged: VERIFIED (git diff returns 0 lines)
- viewmodel-shell-dotnet/ViewModels.cs unchanged: VERIFIED (git diff returns 0 lines)
- Commit eaf192d: FOUND
- vitest 236/237: PASSED
- dotnet test 45/45: PASSED
- parity bun run run.ts exit 0: PASSED (8/8 fixtures, 15/15 backends)
